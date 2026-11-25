"""生成した小物の GLB を、ゲームの座標・寸法に合わせて書き出す。

  blender -b -P bl_props.py -- <glb のフォルダ> <出力フォルダ> [名前,名前]

ゲーム側の座標は glTF（Y が上）。ここでは読み込んだ直後に glTF の軸へ直した numpy 配列で計算し、書き戻す。
"""
import os
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = argv[0], argv[1]
ONLY = argv[2].split(",") if len(argv) > 2 else []


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load(name, seed, crease=45.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLB, f"{name}_{seed}.glb"))
    obj = next(o for o in set(bpy.data.objects) - before if o.type == "MESH")
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode="OBJECT")
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    obj["crease"] = crease
    return obj


def get(obj):
    """頂点を glTF の軸（x, y=上, z=手前）で返す。"""
    v = np.array([p.co for p in obj.data.vertices])
    return np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)


def put(obj, v):
    for p, c in zip(obj.data.vertices, v):
        p.co = (float(c[0]), float(-c[2]), float(c[1]))
    obj.data.update()


def fit(v, lo, hi):
    """外接箱を lo〜hi へぴったり合わせる（軸ごとに伸縮）。"""
    lo, hi = np.array(lo, float), np.array(hi, float)
    a, b = v.min(0), v.max(0)
    return lo + (v - a) / (b - a) * (hi - lo)


def finish(obj, name, size=None, rough=None, metal=None, flip=False):
    """面の向き・なめらかさ・材質を整える。size = テクスチャの大きさ。"""
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if flip:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.flip_normals()
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth_by_angle(angle=np.radians(obj.get("crease", 45.0)))
    obj.name = name
    for mat in obj.data.materials:
        tree = mat.node_tree
        bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
        for socket, value in (("Roughness", rough), ("Metallic", metal)):
            if value is not None:
                for link in list(bsdf.inputs[socket].links):
                    tree.links.remove(link)
                bsdf.inputs[socket].default_value = value
        if size:
            for node in tree.nodes:
                if node.type == "TEX_IMAGE" and node.image and node.image.size[0] > size:
                    node.image.scale(size, size)
    return obj


def simple_material(name, color, rough, metal):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return mat


def export(name, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_image_format="JPEG",
                              export_jpeg_quality=86, export_skins=False, export_animations=False)
    tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
    print(f"EXPORT {name}: {os.path.getsize(path) // 1024} KB, {tris} tris, " + ", ".join(o.name for o in objs))


# ---------------------------------------------------------------- ライター（props.js の LIGHTER_LAYOUT と同じ寸法）
def lighter():
    """前（-Z）から、金属のフードと炎の出口 → ホイール → 手前（+Z）に赤いガスレバー。"""
    body = load("lighter2_body", 582)
    put(body, fit(get(body), (-0.074, -0.365, -0.122), (0.074, 0.338, 0.122)))
    finish(body, "body", 1024, rough=0.26, metal=0.0)
    # 生成した紺を、明るい青へ寄せる（白い底はそのまま）
    for mat in body.data.materials:
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                px = np.array(node.image.pixels[:], dtype=np.float32).reshape(-1, 4)
                rgb = px[:, :3]
                blue = rgb.min(1) < 0.45  # 白い底以外
                lum = rgb.mean(1, keepdims=True)
                med = np.median(lum[blue]) + 1e-6
                tint = np.array([0.03, 0.33, 0.72]) * np.clip(lum / med, 0.85, 1.2) ** 0.4
                px[:, :3] = np.where(blue[:, None], np.clip(tint, 0, 1), rgb)
                node.image.pixels = px.ravel().tolist()
                node.image.update()
                node.image.pack()

    # フード：前が丸い U 字の板。後ろの上の角は、ホイールが見えるように斜めに落とす
    half, front, back, radius = 0.066, -0.117, 0.016, 0.052
    path = [(-half, back), (-half, -0.02)]
    for k in range(13):
        a = np.pi + (np.pi / 2) * (k / 12)
        path.append((-half + radius + np.cos(a) * radius, front + radius + np.sin(a) * radius))
    path += [(-x, z) for x, z in reversed(path)]
    verts, faces = [], []
    low = 0.332
    for x, z in path:
        top = 0.47 - 0.052 * float(np.clip((z + 0.03) / 0.046, 0, 1)) - 0.008 * float(np.clip((-z - 0.09) / 0.03, 0, 1))
        verts += [(x, low, z), (x, top, z)]
    for k in range(len(path) - 1):
        faces.append((2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2))
    mesh = bpy.data.meshes.new("hood")
    mesh.from_pydata([(x, -z, y) for x, y, z in verts], [], faces)
    hood = bpy.data.objects.new("hood", mesh)
    bpy.context.scene.collection.objects.link(hood)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = hood
    hood.select_set(True)
    solid = hood.modifiers.new("solid", "SOLIDIFY")
    solid.thickness = 0.008
    solid.offset = 0
    bevel = hood.modifiers.new("bevel", "BEVEL")
    bevel.width = 0.0025
    bevel.segments = 2
    for m in list(hood.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    hood.data.materials.append(simple_material("hood", (0.8, 0.81, 0.83), 0.3, 1.0))
    bpy.ops.object.shade_smooth_by_angle(angle=np.radians(35))
    # 横の小さな窓と、前の空気穴
    dark = simple_material("vent", (0.03, 0.03, 0.035), 0.8, 0.0)
    vents = []
    for x, z, w, h in ((-0.0705, -0.005, 0.03, 0.013), (0.0705, -0.005, 0.03, 0.013)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, 0.362))
        bpy.context.object.scale = (0.0022, w, h)
        vents.append(bpy.context.object)
    for x in (-0.018, 0.018):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0.1212, 0.40))
        bpy.context.object.scale = (0.012, 0.0022, 0.03)
        vents.append(bpy.context.object)
    bpy.ops.object.select_all(action="DESELECT")
    for o in vents:
        o.data.materials.append(dark)
        o.select_set(True)
    bpy.context.view_layer.objects.active = vents[0]
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vent = bpy.context.object
    vent.name = "vent"

    # ホイール：軸（生成時は手前向き）を X へ。原点 = 回転の中心
    wheel = load("lighter_wheel", 116, crease=30)
    v = get(wheel)
    v = np.stack([v[:, 2], v[:, 1], -v[:, 0]], axis=1)
    put(wheel, fit(v, (-0.04, -0.066, -0.066), (0.04, 0.066, 0.066)))
    finish(wheel, "wheel", 512, rough=0.42, metal=1.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.034, depth=0.114, rotation=(0, np.radians(90), 0))
    axle = bpy.context.object
    axle.data.materials.append(simple_material("axle", (0.62, 0.63, 0.65), 0.35, 1.0))
    bpy.ops.object.transform_apply(rotation=True)
    bpy.ops.object.shade_smooth_by_angle(angle=np.radians(40))
    axle.name = "axle"

    # レバー：赤い樹脂の板と、その下の柱。原点 = 押す板の中心
    red = simple_material("lever", (0.75, 0.02, 0.03), 0.32, 0.0)
    parts = []
    for size, loc in (((0.096, 0.085, 0.034), (0, 0, 0.003)), ((0.07, 0.05, 0.09), (0, 0.004, -0.05)), ((0.096, 0.012, 0.012), (0, -0.036, 0.02))):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.scale = size
        bpy.ops.object.transform_apply(scale=True)
        b = o.modifiers.new("b", "BEVEL")
        b.width = 0.007 if size[2] > 0.02 else 0.004
        b.segments = 3
        bpy.ops.object.modifier_apply(modifier="b")
        o.data.materials.append(red)
        parts.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lever = bpy.context.object
    lever.name = "lever"
    bpy.ops.object.shade_smooth_by_angle(angle=np.radians(40))

    # ガスの出口
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.012, depth=0.1, location=(0, 0.062, 0.395))
    nozzle = bpy.context.object
    bpy.ops.object.transform_apply(location=True)
    nozzle.data.materials.append(simple_material("nozzle", (0.62, 0.5, 0.3), 0.35, 1.0))
    bpy.ops.object.shade_smooth_by_angle(angle=np.radians(40))
    nozzle.name = "nozzle"
    export("lighter", [body, hood, vent, wheel, axle, lever, nozzle])


# ---------------------------------------------------------------- スマホ・灰皿・蛾
def phone():
    obj = load("phone", 152)
    put(obj, fit(get(obj), (-0.23, -0.0175, -0.46), (0.23, 0.0175, 0.46)))
    finish(obj, "phone", 512, rough=0.25, metal=0.2)
    export("phone", [obj])


def ashtray():
    obj = load("ashtray", 161)
    put(obj, fit(get(obj), (-0.19, 0.0, -0.19), (0.19, 0.084, 0.19)))
    finish(obj, "ashtray", 1024)
    export("ashtray", [obj])


def moth():
    obj = load("moth", 171, crease=180)
    v = get(obj)
    put(obj, (v - np.array([0, 0.03, 0])) * 0.2)
    finish(obj, "body", 512, rough=0.95, metal=0.0)
    edge = 0.066 * 0.2
    parts = [obj]
    for name, side in (("wing_r", 1), ("wing_l", -1)):
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for poly in obj.data.polygons:
            # 羽：体の横の外側（触角は残す）
            poly.select = poly.center[0] * side > edge and poly.center[2] < 0.052
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_mode(type="FACE")
        bpy.ops.object.mode_set(mode="OBJECT")
        for poly in obj.data.polygons:
            poly.select = poly.center[0] * side > edge and poly.center[2] < 0.052
        before = set(bpy.data.objects)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.separate(type="SELECTED")
        bpy.ops.object.mode_set(mode="OBJECT")
        wing = (set(bpy.data.objects) - before).pop()
        wing.name = name
        # 付け根を回転の中心にする
        w = get(wing)
        w[:, 0] -= side * edge
        put(wing, w)
        wing.location = (side * edge, 0, 0)
        parts.append(wing)
    export("moth", parts)


# ---------------------------------------------------------------- マッチ
def match(name, src, seed, length, thick):
    """軸は +Y、y = 0 が持ち手側の端。頭薬を上に向ける。"""
    obj = load(src, seed, crease=35)
    v = get(obj)
    # 生成時は軸が Z 向き。頭（太い方）を探して +Y へ
    front, back = v[v[:, 2] > 0.35], v[v[:, 2] < -0.35]
    head_front = np.ptp(front[:, 0]) * np.ptp(front[:, 1]) > np.ptp(back[:, 0]) * np.ptp(back[:, 1])
    if head_front:
        v = np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)
    else:
        v = np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1)
    top = length + 0.0105
    half = thick / 2
    put(obj, fit(v, (-half[0], 0, -half[1]), (half[0], top, half[1])))
    finish(obj, "match", 256, rough=0.8, metal=0.0)
    export(name, [obj])


def match_box():
    match("match_box", "match_box", 202, 0.12, np.array([0.0132, 0.0132]))


def match_paper():
    match("match_paper", "match_paper", 211, 0.1, np.array([0.0112, 0.0068]))


def matchbox():
    """原点 = ヤスリ面の中心（上向き）、X = ヤスリの長手方向、+Z = きれいな絵柄の面。"""
    obj = load("matchbox", 272, crease=30)
    v = get(obj)
    v[:, [0, 2]] *= -1  # 絵柄のきれいな背面を手前へ
    v[:, 2] -= 0.096 * v[:, 1]  # 生成時の傾き（せん断）を戻す
    put(obj, fit(v, (-0.075, -0.1, -0.021), (0.075, 0.0, 0.021)))
    finish(obj, "matchbox", 1024, rough=0.85, metal=0.0)
    export("matchbox", [obj])


def cigarette():
    """-X が先端（x = -0.32）、+X がフィルター端（x = 0.835）。"""
    obj = load("cigarette", 264, crease=40)
    v = get(obj)
    v[:, [0, 2]] *= -1
    # 中心線をまっすぐにする
    bins = np.linspace(v[:, 0].min(), v[:, 0].max() + 1e-6, 25)
    mids = []
    for a, b in zip(bins[:-1], bins[1:]):
        s = v[(v[:, 0] >= a) & (v[:, 0] < b)]
        mids.append(((a + b) / 2, *((s[:, 1:].min(0) + s[:, 1:].max(0)) / 2)))
    mids = np.array(mids)
    for k in (1, 2):
        v[:, k] -= np.interp(v[:, 0], mids[:, 0], mids[:, k])
    put(obj, fit(v, (-0.32, -0.055, -0.055), (0.835, 0.055, 0.055)))
    finish(obj, "cigarette", 1024, rough=0.85, metal=0.0)
    export("cigarette", [obj])


def sleeve():
    """+Y がひじの方向。y = 0 が袖口。"""
    obj = load("sleeve", 238, crease=60)
    v = get(obj)
    # 体の太さは保ち、長さだけ延ばす。袖口（下側のリブ）は短いまま残す
    y = v[:, 1] - v[:, 1].min()
    cuff = 0.12
    y = np.where(y < cuff, y * 0.8, cuff * 0.8 + (y - cuff) * 1.65)
    radial = 0.86
    put(obj, np.stack([v[:, 0] * radial, y, v[:, 2] * radial], axis=1))
    finish(obj, "sleeve", 1024, rough=0.9, metal=0.0)
    print("SLEEVE length", round(float(y.max()), 3), "radius", round(float(np.abs(v[:, 0]).max() * radial), 3))
    export("sleeve", [obj])


JOBS = [lighter, phone, ashtray, moth, match_box, match_paper, matchbox, cigarette, sleeve]
os.makedirs(OUT, exist_ok=True)
for job in JOBS:
    if ONLY and job.__name__ not in ONLY:
        continue
    reset()
    job()
