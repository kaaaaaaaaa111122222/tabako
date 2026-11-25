"""背景の小物の GLB を、足元が原点・指定の高さになるように整えて書き出す。

  blender -b -P bl_scene.py -- <glb のフォルダ> <出力フォルダ> [名前,名前]
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene_specs  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = argv[0], argv[1]
ONLY = argv[2].split(",") if len(argv) > 2 else []
os.makedirs(OUT, exist_ok=True)
# 金属として生成されても、夜の場面では黒く沈むので非金属にするもの
METAL = {"duct", "tank"}
# 葉のすき間に残った白い背景を、葉の色で埋めるもの
LEAVES = ("conifer", "bamboo", "fern")
# 斜めから撮った箱ものは、辺が軸にそろうように回す（丸いもの・木などは対象外）
SQUARE = {"flowers", "crates", "fan", "showcase", "rack", "icebox", "cafetable", "bench", "register", "cooler", "camptable", "tackle", "fishcrates", "shed", "truck", "zabuton",
          "andon", "stones", "bridge", "teaset", "firewood", "sofa"}


# 遠くにたくさん並べる木や茂み：減らしきれないので、かたまりに作り直して頂点の色で塗る
CLUMPS = {"tree": 3200, "bush": 1400}


def clump(obj, faces):
    mesh = obj.data
    image = next(n.image for m in mesh.materials for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and n.image.colorspace_settings.name == "sRGB")
    px = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)[:, :, :3]
    uv = np.array([d.uv for d in mesh.uv_layers.active.data])
    loop_vertex = np.array([loop.vertex_index for loop in mesh.loops])
    sample = px[(uv[:, 1] * (image.size[1] - 1)).astype(int) % image.size[1], (uv[:, 0] * (image.size[0] - 1)).astype(int) % image.size[0]]
    color = np.zeros((len(mesh.vertices), 3))
    count = np.zeros(len(mesh.vertices))
    np.add.at(color, loop_vertex, sample)
    np.add.at(count, loop_vertex, 1)
    color /= np.maximum(count, 1)[:, None]
    # 白い背景の写りこみは、葉の色にする
    green = (color[:, 1] > color[:, 0]) & (color[:, 1] > 0.08)
    pale = color.min(1) > 0.3
    color[pale] = np.median(color[green & ~pale], axis=0)
    color = np.where(color <= 0.04045, color / 12.92, ((color + 0.055) / 1.055) ** 2.4)  # 頂点の色はリニアで持つ
    tree = KDTree(len(mesh.vertices))
    for i, vertex in enumerate(mesh.vertices):
        tree.insert(vertex.co, i)
    tree.balance()
    size = max(obj.dimensions)
    mod = obj.modifiers.new("solid", "REMESH")
    mod.mode, mod.voxel_size = "VOXEL", size / 52
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("less", "DECIMATE")
    mod.ratio = min(1, faces / max(1, sum(len(p.vertices) - 2 for p in obj.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    layer = obj.data.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
    for i, vertex in enumerate(obj.data.vertices):
        near = tree.find_n(vertex.co, 5)
        rgb = np.mean([color[j] for _, j, _ in near], axis=0)
        layer.data[i].color = (*[float(c) for c in rgb], 1)
    obj.data.materials.clear()
    mat = bpy.data.materials.new(obj.name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    node.layer_name = "Color"
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    mat.node_tree.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    obj.data.materials.append(mat)
    return obj


def square_angle(points):
    """上から見た外接長方形がいちばん小さくなる角度（±45 度）"""
    best = (1e9, 0.0)
    for deg in np.arange(-45, 45, 1.0):
        r = math.radians(deg)
        c, s = math.cos(r), math.sin(r)
        x, y = points[:, 0] * c - points[:, 1] * s, points[:, 0] * s + points[:, 1] * c
        # 端の細い出っぱりに引きずられないように、外側 1% は見ない
        w = np.percentile(x, 99) - np.percentile(x, 1)
        d = np.percentile(y, 99) - np.percentile(y, 1)
        best = min(best, (w * d + abs(deg) * 1e-6, r))
    return best[1]


for name, spec in scene_specs.SCENE.items():
    if name.startswith("lighter") or (ONLY and name not in ONLY):
        continue
    src = os.path.join(GLB, f"{name}_{spec['seeds'][spec['pick']]}.glb")
    if not os.path.exists(src):
        print("MISSING", name)
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode="OBJECT")
    if name in CLUMPS:
        obj = clump(obj, CLUMPS[name])
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    v = np.array([p.co for p in obj.data.vertices])
    a = square_angle(v) if name in SQUARE else 0.0
    if a:
        print(f"SQUARE {name}: {math.degrees(a):.0f}")
    a += math.radians(spec["yaw"])
    v[:, :2] = v[:, :2] @ np.array([[math.cos(a), math.sin(a)], [-math.sin(a), math.cos(a)]])
    lo, hi = v.min(0), v.max(0)
    scale = spec["height"] / (hi[2] - lo[2])
    v = (v - np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])) * scale
    for p, c in zip(obj.data.vertices, v):
        p.co = c
    obj.data.update()
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    obj.name = name
    for mat in obj.data.materials:
        tree = mat.node_tree
        bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
        for socket, value in (("Metallic", 0.6 if name in METAL else 0.0), ("Roughness", 0.75)):
            for link in list(bsdf.inputs[socket].links):
                tree.links.remove(link)
            bsdf.inputs[socket].default_value = value
        # 法線マップは使わない（遠くの物なので、容量を減らす）
        for link in list(bsdf.inputs["Normal"].links):
            tree.links.remove(link)
        if name in LEAVES:
            link = bsdf.inputs["Base Color"].links
            if link and link[0].from_node.type == "TEX_IMAGE":
                image = link[0].from_node.image
                px = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
                rgb = px[:, :3]
                leaf = np.median(rgb[(rgb[:, 1] > rgb[:, 0]) & (rgb.sum(1) > 0.1)], axis=0)
                pale = (rgb.min(1) > 0.3) | (rgb.sum(1) < 0.06)
                px[pale, :3] = leaf * 0.8
                image.pixels = px.ravel().tolist()
                image.update()
                image.pack()
        for node in tree.nodes:
            if node.type == "TEX_IMAGE" and node.image and node.image.size[0] > spec["tex"]:
                node.image.scale(spec["tex"], spec["tex"])
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_image_format="JPEG",
                              export_jpeg_quality=80, export_animations=False)
    size = (hi - lo) * scale
    print(f"EXPORT {name}: {os.path.getsize(path) // 1024} KB, {len(obj.data.polygons)} tris, size {np.round(size, 2).tolist()}")
