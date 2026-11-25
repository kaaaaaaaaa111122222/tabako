"""生成した人物（上半身・A ポーズ）に骨と口の動きを入れて書き出す。

  blender -b -P bl_people.py -- <glb のフォルダ> <出力フォルダ>

書き出す座標（glTF）：原点 = 首の付け根、+Y = 上、+Z = 顔の正面。
骨：torso, head, arm_px_0 / arm_px_1（+X 側の上腕・前腕）, arm_nx_0 / arm_nx_1。
腕の骨は親子にせず、ゲーム側の逆運動学で置く。モーフ "talk" で口が開く。
"""
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = argv[0], argv[1]

# 生成メッシュ上の位置（x は +X 側の値、y は上下）。奥行きは断面から求める
PEOPLE = {
    "ojisan": {
        "seed": 136, "scale": 1.02, "neck": 0.215, "head": 0.262,
        "shoulder": (0.188, 0.108), "elbow": (0.345, -0.03), "end": (0.496, -0.16),
        "mouth": 0.262, "chin": 0.17, "bottom": -0.40,
    },
    "salaryman": {
        "seed": 146, "scale": 1.02, "neck": 0.225, "head": 0.262,
        "shoulder": (0.170, 0.118), "elbow": (0.345, 0.0), "end": (0.496, -0.11),
        "mouth": 0.262, "chin": 0.205, "bottom": -0.40,
    },
}


def bl(p):
    return Vector((float(p[0]), float(-p[2]), float(p[1])))


def build(name, spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLB, f"{name}_{spec['seed']}.glb"))
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode="OBJECT")
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    mesh = obj.data
    co = np.array([v.co for v in mesh.vertices])
    V = np.stack([co[:, 0], co[:, 2], -co[:, 1]], axis=1)  # glTF の軸

    def depth(x, y, r=0.02):
        near = (np.abs(V[:, 0] - x) < r) & (np.abs(V[:, 1] - y) < r)
        return float((V[near, 2].min() + V[near, 2].max()) / 2) if near.any() else 0.0

    points = {}
    for tag, side in (("px", 1), ("nx", -1)):
        points[tag] = [np.array([side * x, y, depth(side * x, y)]) for x, y in (spec["shoulder"], spec["elbow"], spec["end"])]
    neck = np.array([0, spec["neck"], depth(0, spec["neck"] + 0.02, 0.03)])
    head = np.array([0, spec["head"], neck[2]])
    print(name, "neck", np.round(neck, 3).tolist(), {k: [np.round(p, 3).tolist() for p in v] for k, v in points.items()})

    # 腰から下は画面の外まで延ばす
    low = V[:, 1] < spec["bottom"]
    V[low, 1] = spec["bottom"] + (V[low, 1] - spec["bottom"]) * 6.5

    # 首の付け根を原点に、実寸へ
    def place(p):
        return (np.asarray(p) - neck) * spec["scale"]

    V = place(V)
    for tag in points:
        points[tag] = [place(p) for p in points[tag]]
    head = place(head)
    for v, p in zip(mesh.vertices, V):
        v.co = bl(p)
    mesh.update()

    # 骨
    data = bpy.data.armatures.new("rig")
    arm = bpy.data.objects.new("rig", data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(bname, a, b):
        e = data.edit_bones.new(bname)
        e.head, e.tail = bl(a), bl(b)

    top = V[:, 1].max()
    bone("torso", [0, V[:, 1].min() * 0.8, 0], [0, -0.04, 0])
    bone("head", head, [0, top, head[2] + 0.02])
    for tag in points:
        s, e, w = points[tag]
        inner = s * np.array([0.45, 1, 1])
        bone(f"clav_{tag}", inner, s * 0.94 + inner * 0.06)
        bone(f"arm_{tag}_0", s, e)
        bone(f"arm_{tag}_1", e, w)
        bone(f"arm_{tag}_2", w, w + (w - e) * 0.2)  # 手首の位置（重みは付けない）
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    names = ["torso", "head"] + [f"arm_{t}_{k}" for t in points for k in (0, 1)]
    col = {n: k for k, n in enumerate(names)}
    W = np.zeros((len(V), len(names)))
    for v in mesh.vertices:
        for g in v.groups:
            gname = obj.vertex_groups[g.group].name
            gname = gname[:-1] + "1" if gname.startswith("arm_") and gname.endswith("_2") else gname
            W[v.index, col.get(gname, 0)] += g.weight
    empty = W.sum(1) < 1e-4
    print("UNWEIGHTED", int(empty.sum()))
    W[empty, 0] = 1
    # 体のまんなかと、反対側の腕には効かせない
    for tag, side in (("px", 1), ("nx", -1)):
        sx = points[tag][0][0]
        inside = np.clip((V[:, 0] * side - abs(sx) * 0.62) / (abs(sx) * 0.38), 0, 1)
        for k in (0, 1):
            c = col[f"arm_{tag}_{k}"]
            W[:, 0] += W[:, c] * (1 - inside)
            W[:, c] *= inside
    # 頭は首から上だけ（マフラーや襟は胴体につける）
    up = np.clip((V[:, 1] - head[1] * 0.35) / (head[1] * 0.9 + 0.03), 0, 1)
    W[:, 0] += W[:, col["head"]] * (1 - up)
    W[:, col["head"]] *= up
    W /= W.sum(1, keepdims=True)
    edges = np.array([e.vertices[:] for e in mesh.edges])
    deg = np.bincount(edges.ravel(), minlength=len(V)).astype(float)[:, None]
    for _ in range(6):
        acc = np.zeros_like(W)
        np.add.at(acc, edges[:, 0], W[edges[:, 1]])
        np.add.at(acc, edges[:, 1], W[edges[:, 0]])
        W = 0.5 * W + 0.5 * acc / np.maximum(deg, 1)
    order = np.argsort(-W, axis=1)[:, 4:]
    np.put_along_axis(W, order, 0, axis=1)
    W /= W.sum(1, keepdims=True)

    obj.vertex_groups.clear()
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for tag in points:
        data.edit_bones.remove(data.edit_bones[f"clav_{tag}"])
    bpy.ops.object.mode_set(mode="OBJECT")
    for n in names:
        group = obj.vertex_groups.new(name=n)
        for vi in np.nonzero(W[:, col[n]] > 1e-4)[0]:
            group.add([int(vi)], float(W[vi, col[n]]), "REPLACE")

    # 口を開けるモーフ：口の線より下・顔の前側を下へ
    mouth = (spec["mouth"] - spec["neck"]) * spec["scale"]
    chin = (spec["chin"] - spec["neck"]) * spec["scale"]
    face_z = V[(np.abs(V[:, 0]) < 0.03) & (np.abs(V[:, 1] - mouth) < 0.02), 2].max()
    front = np.clip((V[:, 2] - (face_z - 0.07)) / 0.05, 0, 1)
    side = np.clip(1 - np.abs(V[:, 0]) / 0.06, 0, 1) ** 0.6
    below = np.clip((mouth - V[:, 1]) / 0.012, 0, 1) * np.clip((V[:, 1] - (chin - 0.03)) / 0.03, 0, 1)
    amount = front * side * below
    print("MOUTH verts", int((amount > 0.3).sum()), "face_z", round(float(face_z), 3))
    obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name="talk")
    for i in np.nonzero(amount > 1e-3)[0]:
        p = V[i] + np.array([0, -0.016, -0.004]) * amount[i]
        key.data[int(i)].co = bl(p)
    key.value = 0

    for poly in mesh.polygons:
        poly.use_smooth = True
    for mat in mesh.materials:
        tree = mat.node_tree
        bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
        for socket, value in (("Metallic", 0.0), ("Roughness", 0.8)):
            for link in list(bsdf.inputs[socket].links):
                tree.links.remove(link)
            bsdf.inputs[socket].default_value = value
        for node in tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                size = 2048 if "olor" in node.image.name or node.outputs[0].links and node.outputs[0].links[0].to_node == bsdf else 1024
                if node.image.size[0] > size:
                    node.image.scale(size, size)
    obj.name = name
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    arm.select_set(True)
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_image_format="JPEG",
                              export_jpeg_quality=86, export_skins=True, export_animations=False, export_morph=True,
                              export_morph_normal=False, export_def_bones=False)
    print(f"EXPORT {name}: {os.path.getsize(path) // 1024} KB, {len(mesh.polygons)} tris, bounds", np.round(V.min(0), 3).tolist(), np.round(V.max(0), 3).tolist())


for person, spec in PEOPLE.items():
    build(person, spec)
