"""GLB の見た目を 4 方向（正面・右・背面・上）から確認する。目盛り付きの正射影で描く。

  blender -b -P bl_preview.py -- in.glb out.png [--size 512]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
size = int(argv[argv.index("--size") + 1]) if "--size" in argv else 512

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
for o in [o for o in scene.objects if o.type == "MESH" and o.name.startswith("Icosphere")]:
    bpy.data.objects.remove(o)  # 骨の表示用に読み込み時に足される形
meshes = [o for o in scene.objects if o.type == "MESH"]
corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector([min(c[i] for c in corners) for i in range(3)])
hi = Vector([max(c[i] for c in corners) for i in range(3)])
centre, ext = (lo + hi) / 2, hi - lo
print("BOUNDS lo", [round(v, 4) for v in lo], "hi", [round(v, 4) for v in hi], "ext", [round(v, 4) for v in ext])
print("TRIS", sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons))

scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.57, 0.6, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.2
sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(25))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(ext) * 1.12
scene.collection.objects.link(cam)
scene.camera = cam
# Blender は Z が上、glTF の +Z（正面）は Blender の -Y
views = {"front": Vector((0, -1, 0)), "right": Vector((1, 0, 0)), "back": Vector((0, 1, 0)), "top": Vector((0, 0, 1))}
tmp = []
for name, d in views.items():
    cam.location = centre + d * max(ext) * 3
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y" if name != "top" else "Y").to_euler()
    path = os.path.splitext(dst)[0] + f"_{name}.png"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    tmp.append(path)

# 4 枚を横に並べる（numpy は Blender に入っている）
import numpy as np  # noqa: E402

rows = []
for path in tmp:
    img = bpy.data.images.load(path)
    rows.append(np.array(img.pixels[:]).reshape(size, size, 4))
    os.remove(path)
sheet = np.concatenate(rows, axis=1)
out = bpy.data.images.new("sheet", size * 4, size)
out.pixels = sheet.ravel().tolist()
out.filepath_raw = dst
out.file_format = "PNG"
out.save()
