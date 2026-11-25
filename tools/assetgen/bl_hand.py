"""生成した手のメッシュに骨を入れ、ゲームの手のリグ（src/three/hand.js）の寸法へ合わせて書き出す。

  blender -b -P bl_hand.py -- in.glb out.glb [--debug debug.png]

リグの座標（右手）：原点 = 手首、+Y = 指先、+Z = 手の甲、-X = 親指側、単位 = 手のひらの長さ。
生成メッシュ（Blender に読み込んだ状態）は 手のひら = -Y、指先 = +Z、親指 = +X を向いている。
"""
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = argv[0], argv[1]
DEBUG = argv[argv.index("--debug") + 1] if "--debug" in argv else None

# ---------------------------------------------------------------- ゲーム側のリグ（hand.js と同じ値）
FINGERS = [
    {"base": [-0.3, 0.9, 0.0], "splay": 0.06, "lengths": [0.41, 0.25, 0.19], "tip": 0.066},
    {"base": [-0.1, 0.93, 0.005], "splay": 0.0, "lengths": [0.46, 0.29, 0.205], "tip": 0.069},
    {"base": [0.1, 0.9, 0.0], "splay": -0.05, "lengths": [0.43, 0.27, 0.195], "tip": 0.066},
    {"base": [0.29, 0.82, -0.01], "splay": -0.13, "lengths": [0.34, 0.205, 0.175], "tip": 0.059},
]
THUMB = {"base": [-0.26, 0.12, -0.09], "lengths": [0.38, 0.29, 0.24], "tip": 0.088}
WRIST_PIVOT = np.array([0.0, -0.06, 0.0])

# ---------------------------------------------------------------- 生成メッシュ上の関節（おおよその位置。あとで断面の中心へ寄せる）
# 順に MCP, PIP, DIP, 先端（親指は CMC, MCP, IP, 先端）を (x, z) で。奥行き y は断面から求める
GEN = {
    "f0": [(0.075, 0.040), (0.103, 0.210), (0.115, 0.332), (0.122, 0.432)],
    "f1": [(-0.031, 0.055), (-0.032, 0.245), (-0.036, 0.378), (-0.037, 0.495)],
    "f2": [(-0.130, 0.045), (-0.165, 0.227), (-0.182, 0.339), (-0.191, 0.439)],
    "f3": [(-0.231, 0.010), (-0.287, 0.140), (-0.315, 0.216), (-0.336, 0.283)],
    "t": [(0.100, -0.262), (0.176, -0.115), (0.240, 0.005), (0.345, 0.090)],
}
GEN_WRIST = (-0.051, -0.335)
RADIAL = 1.36  # 手のひらの厚みの倍率（実際の手と同じくらいの厚みにする）
RADIAL_OF = {"f0": 2.08, "f1": 2.02, "f2": 2.02, "f3": 2.12, "t": 2.2}  # 指の太さの倍率（握ったときに道具へ埋もれない太さ）
SKIN = (0.83, 0.655, 0.56)  # 肌の平均色（sRGB）


def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.mesh.quads_convert_to_tris()
    bpy.ops.object.mode_set(mode="OBJECT")
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def to_rig_axes(p):
    p = np.asarray(p)
    return np.stack([-p[..., 0], p[..., 2], p[..., 1]], axis=-1)


def unit(v):
    return v / np.linalg.norm(v)


def frame(along, dorsal=(0, 0, 1)):
    y = unit(np.asarray(along, float))
    z = np.asarray(dorsal, float)
    z = unit(z - y * z.dot(y))
    return np.stack([np.cross(y, z), y, z], axis=1)


def refine(V, pts, radius):
    """関節の点を、指の断面の中心へ寄せる（リグの軸で処理）。"""
    out = [p.copy() for p in pts]
    for _ in range(4):
        for k in range(len(out) - 1):
            a = unit(out[min(k + 1, len(out) - 1)] - out[max(k - 1, 0)])
            d = V - out[k]
            t = d @ a
            perp = d - np.outer(t, a)
            sel = (np.abs(t) < 0.02) & (np.linalg.norm(perp, axis=1) < radius)
            if sel.sum() < 8:
                continue
            f = frame(a)
            q = perp[sel] @ f[:, [0, 2]]
            mid = (q.min(0) + q.max(0)) / 2
            # 掌の中の点（MCP・CMC）は横へ動かさず、奥行きだけ合わせる
            if k == 0:
                out[k] = out[k] + f[:, 2] * mid[1] * 0.8
            else:
                out[k] = out[k] + f[:, 0] * mid[0] + f[:, 2] * mid[1]
    # 先端 = 最後の節の軸方向で一番遠い点
    a = unit(out[-1] - out[-2])
    d = V - out[-2]
    t = d @ a
    perp = np.linalg.norm(d - np.outer(t, a), axis=1)
    near = (perp < radius) & (t > 0)
    out[-1] = out[-2] + a * t[near].max()
    return out


obj = load()
mesh = obj.data
Vb = np.array([v.co for v in mesh.vertices])
V = to_rig_axes(Vb)  # 生成メッシュ（リグの軸の向き、スケールはそのまま）
print("VERTS", len(V), "TRIS", len(mesh.polygons))

names, gen_pts = [], {}
for key, pts in GEN.items():
    guess = []
    for x, z in pts:
        near = (np.abs(Vb[:, 0] - x) < 0.02) & (np.abs(Vb[:, 2] - z) < 0.02)
        y = (Vb[near, 1].min() + Vb[near, 1].max()) / 2 if near.any() else 0.0
        guess.append(to_rig_axes(np.array([x, y, z])))
    gen_pts[key] = refine(V, guess, 0.062 if key != "t" else 0.085)
near = (np.abs(Vb[:, 2] - GEN_WRIST[1]) < 0.01)
wrist_mid = (Vb[near].min(0) + Vb[near].max(0)) / 2
gen_wrist = to_rig_axes(np.array([wrist_mid[0], wrist_mid[1], GEN_WRIST[1]]))
for key, pts in gen_pts.items():
    print("GEN", key, [np.round(p, 3).tolist() for p in pts])
print("GEN wrist", np.round(gen_wrist, 3).tolist())

# ---------------------------------------------------------------- 骨（生成メッシュの形に合わせて作り、自動ウェイト）
# Blender 座標 = リグの軸 (x, y, z) → (x, -z, y)
def bl(p):
    return Vector((float(p[0]), float(-p[2]), float(p[1])))


for v, p in zip(mesh.vertices, V):
    v.co = bl(p)
mesh.update()

arm_data = bpy.data.armatures.new("rig")
arm = bpy.data.objects.new("rig", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")


def add_bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = bl(head), bl(tail)
    if parent:
        b.parent = arm_data.edit_bones[parent]
    return b


mid_mcp = gen_pts["f1"][0]
low = V[:, 1].min()
add_bone("wrist", gen_wrist + np.array([0, -0.02, 0]), np.array([gen_wrist[0], low, gen_wrist[2]]))
add_bone("palm", gen_wrist + np.array([0, 0.01, 0]), gen_wrist * 0.12 + mid_mcp * 0.88)
for i in range(4):
    # 手のひらの骨（あとで palm へまとめる）
    p0 = gen_pts[f"f{i}"][0]
    add_bone(f"palm_{i}", gen_wrist * 0.75 + p0 * 0.25, gen_wrist * 0.08 + p0 * 0.92, "palm")
    for j in range(3):
        add_bone(f"f{i}_{j}", gen_pts[f"f{i}"][j], gen_pts[f"f{i}"][j + 1], f"f{i}_{j - 1}" if j else "palm")
for j in range(3):
    add_bone(f"t_{j}", gen_pts["t"][j], gen_pts["t"][j + 1], f"t_{j - 1}" if j else "palm")
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

BONES = ["wrist", "palm"] + [f"f{i}_{j}" for i in range(4) for j in range(3)] + [f"t_{j}" for j in range(3)]
index = {n: k for k, n in enumerate(BONES)}
W = np.zeros((len(V), len(BONES)))
for v in mesh.vertices:
    for g in v.groups:
        name = obj.vertex_groups[g.group].name
        if name.startswith("palm"):
            name = "palm"
        W[v.index, index[name]] += g.weight
bad = W.sum(1) < 1e-4
print("UNWEIGHTED", int(bad.sum()))
W[bad, index["palm"]] = 1
W /= W.sum(1, keepdims=True)

# 指どうし・指と親指の混ざりをなくす：一番強い指だけを残す
digits = [[index[f"f{i}_{j}"] for j in range(3)] for i in range(4)] + [[index[f"t_{j}"] for j in range(3)]]
sums = np.stack([W[:, d].sum(1) for d in digits], axis=1)
best = sums.argmax(1)
for k, d in enumerate(digits):
    other = best != k
    spill = W[np.ix_(other, d)].sum(1)
    W[np.ix_(other, d)] = 0
    W[other, index["palm"]] += spill
W /= W.sum(1, keepdims=True)

# ウェイトを少しならす（隣の頂点との平均）
edges = np.array([e.vertices[:] for e in mesh.edges])
deg = np.bincount(edges.ravel(), minlength=len(V)).astype(float)[:, None]
for _ in range(3):
    acc = np.zeros_like(W)
    np.add.at(acc, edges[:, 0], W[edges[:, 1]])
    np.add.at(acc, edges[:, 1], W[edges[:, 0]])
    W = 0.5 * W + 0.5 * acc / np.maximum(deg, 1)

# ---------------------------------------------------------------- ゲームのリグの寸法へ変形
def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def thumb_frame():
    along = unit(np.array([-0.52, 0.76, -0.4]))
    nail = np.array([-0.72, 0.05, 0.69])
    nail = unit(nail - along * nail.dot(along))
    return np.stack([np.cross(along, nail), along, nail], axis=1)


canon = {}  # 骨 → (回転 3x3, 原点, 長さ)
for i, f in enumerate(FINGERS):
    R = rot_z(f["splay"])
    origin = np.array(f["base"], float)
    for j in range(3):
        length = f["lengths"][j] + (f["tip"] if j == 2 else 0)
        canon[f"f{i}_{j}"] = (R, origin.copy(), length)
        origin = origin + R[:, 1] * f["lengths"][j]
R = thumb_frame()
origin = np.array(THUMB["base"], float)
for j in range(3):
    length = THUMB["lengths"][j] + (THUMB["tip"] if j == 2 else 0)
    canon[f"t_{j}"] = (R, origin.copy(), length)
    origin = origin + R[:, 1] * THUMB["lengths"][j]

# 手のひら：手首と 4 本の付け根が合うアフィン変換（x, y は最小二乗、z は太さの倍率）
src = [gen_wrist] + [gen_pts[f"f{i}"][0] for i in range(4)] + [gen_pts["t"][0]]
dst = [np.zeros(3)] + [np.array(f["base"], float) for f in FINGERS] + [np.array(THUMB["base"], float)]
weight = np.array([3, 1, 1, 1, 1, 0.5])
A = np.array([[p[0], p[1], 1] for p in src]) * weight[:, None]
B = np.array([[p[0], p[1]] for p in dst]) * weight[:, None]
M, *_ = np.linalg.lstsq(A, B, rcond=None)
print("PALM affine", np.round(M, 3).tolist())


def palm_map(P):
    out = np.zeros_like(P)
    out[:, :2] = np.c_[P[:, :2], np.ones(len(P))] @ M
    # 手のひらの厚みの中心線（手首 → 付け根）を z = 0 に揃える
    t = np.clip((P[:, 1] - gen_wrist[1]) / (mid_mcp[1] - gen_wrist[1]), -0.4, 1.0)
    zc = gen_wrist[2] + (mid_mcp[2] - gen_wrist[2]) * t
    out[:, 2] = (P[:, 2] - zc) * RADIAL
    return out


def digit_map(name, P):
    key, j = name.split("_")
    j = int(j)
    g0, g1 = gen_pts[key][j], gen_pts[key][j + 1]
    R1, o1, length = canon[name]
    # 爪側の向き：指は手の甲、親指は爪の向き（生成メッシュの親指の爪は甲側・外側を向く）
    dorsal = (0, 0, 1) if key != "t" else (-0.45, 0.0, 0.9)
    R0 = frame(g1 - g0, dorsal)
    local = (P - g0) @ R0
    radial = RADIAL_OF[key]
    local = local * np.array([radial, length / np.linalg.norm(g1 - g0), radial])
    return local @ R1.T + o1


maps = {"palm": palm_map, "wrist": palm_map}
New = np.zeros_like(V)
for name in BONES:
    w = W[:, index[name]]
    sel = w > 1e-6
    if sel.any():
        fn = maps.get(name)
        New[sel] += (fn(V[sel]) if fn else digit_map(name, V[sel])) * w[sel, None]

# 手首から先（前腕）は、袖に入る長さまで延ばす
stretch_from, end = -0.22, -1.15
bottom = New[:, 1].min()
below = New[:, 1] < stretch_from
k = (end - stretch_from) / (bottom - stretch_from)
s = (New[below, 1] - stretch_from) * k
New[below, 1] = stretch_from + s
# 延ばした部分の太さをそろえる（腕へ向かってわずかに太く）
ring = (New[:, 1] < -0.2) & (New[:, 1] > -0.3)
c = (New[ring].min(0) + New[ring].max(0)) / 2
half = (New[ring].max(0) - New[ring].min(0)) / 2
print("WRIST half", np.round(half, 3).tolist(), "centre", np.round(c, 3).tolist())
depth = np.clip((stretch_from - New[:, 1]) / (stretch_from - end), 0, 1)
for axis in (0, 2):
    New[:, axis] -= c[axis] * np.clip((0.1 - New[:, 1]) / 0.35, 0, 1) * 0.9
angle = np.arctan2(New[:, 2] / half[2], New[:, 0] / half[0])
rx, rz = 0.27 + 0.05 * depth, 0.2 + 0.07 * depth
mix = np.clip(depth * 4, 0, 1)[:, None]
target = np.stack([np.cos(angle) * rx, New[:, 1], np.sin(angle) * rz], axis=1)
New = np.where(below[:, None], New * (1 - mix) + target * mix, New)

# 手首の骨のウェイトは高さから決め直す（-0.06 を中心に曲がる）
wr = np.clip((0.02 - New[:, 1]) / 0.26, 0, 1)
wr = wr * wr * (3 - 2 * wr)
palm_side = W[:, index["palm"]] + W[:, index["wrist"]]
W[:, index["wrist"]] = palm_side * wr
W[:, index["palm"]] = palm_side * (1 - wr)

# ---------------------------------------------------------------- 曲げたときに痩せないよう、関節ごとに「半分だけ曲がる骨」を足す
JOINTS = [("palm", f"f{i}_0") for i in range(4)] + [(f"f{i}_{j - 1}", f"f{i}_{j}") for i in range(4) for j in (1, 2)]
JOINTS += [("palm", "t_0"), ("t_0", "t_1"), ("t_1", "t_2"), ("palm", "wrist")]
ALL = BONES + [child + "h" for _, child in JOINTS]
full = np.zeros((len(V), len(ALL)))
full[:, : len(BONES)] = W
pos = {n: k for k, n in enumerate(ALL)}
for parent, child in JOINTS:
    a, b = full[:, pos[parent]].copy(), full[:, pos[child]].copy()
    h = 2 * np.minimum(a, b)
    full[:, pos[parent]] = a - h / 2
    full[:, pos[child]] = b - h / 2
    full[:, pos[child + "h"]] += h
# 影響は 4 本まで
order = np.argsort(-full, axis=1)[:, 4:]
np.put_along_axis(full, order, 0, axis=1)
full /= full.sum(1, keepdims=True)

# ---------------------------------------------------------------- 書き出し
for v, p in zip(mesh.vertices, New):
    v.co = bl(p)
mesh.update()
obj.modifiers.clear()
obj.parent = None
bpy.data.objects.remove(arm)
obj.vertex_groups.clear()

arm_data = bpy.data.armatures.new("hand_rig")
arm = bpy.data.objects.new("hand_rig", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for name in ALL:
    base = name[:-1] if name.endswith("h") else name
    if base in canon:
        R1, o1, length = canon[base]
        head, tail = o1, o1 + R1[:, 1] * length
    elif base == "wrist":
        head, tail = WRIST_PIVOT, WRIST_PIVOT + np.array([0, -0.5, 0])
    else:
        head, tail = np.zeros(3), np.array([0, 0.9, 0])
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = bl(head), bl(tail)
bpy.ops.object.mode_set(mode="OBJECT")
for name in ALL:
    group = obj.vertex_groups.new(name=name)
    col = full[:, pos[name]]
    for vi in np.nonzero(col > 1e-4)[0]:
        group.add([int(vi)], float(col[vi]), "REPLACE")
obj.parent = arm
mod = obj.modifiers.new("Armature", "ARMATURE")
mod.object = arm
obj.name = "hand"

# 閉じた底（前腕の切り口）は袖の中なので残してよい。材質は色と法線だけ使う（粗さはゲーム側で決める）
def tune_skin(image):
    px = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
    rgb = px[:, :3]
    used = rgb.sum(1) > 0.15  # 余白（黒）を除く
    mean = np.median(rgb[used], axis=0)
    print("SKIN median", np.round(mean, 3).tolist())
    lum = rgb.mean(1, keepdims=True)
    detail = (rgb - mean) * 0.8 + (lum - mean.mean()) * 0.2
    px[:, :3] = np.where(used[:, None], np.clip(np.array(SKIN) + detail, 0, 1), rgb)
    image.pixels = px.ravel().tolist()
    image.update()
    image.pack()


for mat in mesh.materials:
    bc = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"]
    if bc.links and bc.links[0].from_node.type == "TEX_IMAGE":
        tune_skin(bc.links[0].from_node.image)
for mat in mesh.materials:
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    for socket in ("Metallic", "Roughness"):
        for link in list(bsdf.inputs[socket].links):
            mat.node_tree.links.remove(link)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.55

print("RESULT bounds", np.round(New.min(0), 3).tolist(), np.round(New.max(0), 3).tolist())
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=DST, use_selection=True, export_format="GLB", export_yup=True, export_image_format="JPEG",
                          export_jpeg_quality=88, export_skins=True, export_animations=False, export_all_influences=False,
                          export_def_bones=False, export_tangents=False)

if DEBUG:
    bpy.ops.wm.save_as_mainfile(filepath=DEBUG)
