"""素材生成の入口。ComfyUI の Python（Pillow 入り）で実行する。

  python gen.py photos [--only a,b] [--seeds 2]   写真を作り、見比べ用の一覧画像を作る
  python gen.py images [--only a,b]               背景・質感・UI の画像を作る
  python gen.py scene                              背景の小物の写真をまとめて作る
  python gen.py mesh   --only a [--seed 102] [--mesh-seed 7] [--faces 20000]
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

import comfy  # noqa: E402
import scene_specs  # noqa: E402
import specs  # noqa: E402

specs.MODELS.update(scene_specs.SCENE)
specs.IMAGES.update(scene_specs.SCENE_IMAGES)

PHOTOS = os.path.join(comfy.WORK, "photo")


def photo(name, spec, seed):
    path = os.path.join(PHOTOS, f"{name}_{seed}.png")
    if not os.path.exists(path):
        os.makedirs(PHOTOS, exist_ok=True)
        width, height = spec["size"]
        reference = os.path.join(PHOTOS, spec["reference"] + ".png") if "reference" in spec else None
        comfy.flux(spec["prompt"], width, height, seed, f"raw/{name}_{seed}", steps=spec.get("steps", 4), reference=reference).save(path)
        print("photo", path, flush=True)
    return path


def sheet(rows, path, cell=256):
    cols = max(len(files) for files in rows)
    out = Image.new("RGB", (cell * cols, (cell + 18) * len(rows)), (28, 28, 28))
    draw = ImageDraw.Draw(out)
    for r, files in enumerate(rows):
        y = r * (cell + 18)
        for c, file in enumerate(files):
            im = Image.open(file).convert("RGB")
            im.thumbnail((cell, cell))
            out.paste(im, (c * cell, y + 18))
            draw.text((c * cell + 4, y + 3), os.path.basename(file), fill=(255, 220, 120))
    out.save(path)
    print("sheet", path, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["photos", "images", "mesh", "scene"])
    ap.add_argument("--only", default="")
    ap.add_argument("--seeds", type=int, default=0)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--mesh-seed", type=int)
    ap.add_argument("--faces", type=int, default=20000)
    ap.add_argument("--tex", type=int, default=2048)
    ap.add_argument("--remesh", type=int, default=512)
    ap.add_argument("--smooth", type=int, default=4)
    ap.add_argument("--sheet", default="sheet")
    args = ap.parse_args()
    only = [n for n in args.only.split(",") if n]

    if args.command == "scene":
        args.command, only = "photos", only or list(scene_specs.SCENE)
    if args.command in ("photos", "images"):
        table = dict(specs.MODELS if args.command == "photos" else specs.IMAGES)
        if args.command == "images":
            for key, text in specs.AVATARS.items():
                table["avatar_" + key] = {"prompt": specs.AVATAR_STYLE.format(text), "size": (768, 768), "seeds": [351, 352, 353]}
        rows = []
        for name, spec in table.items():
            if only and name not in only:
                continue
            seeds = spec["seeds"][: args.seeds] if args.seeds else spec["seeds"]
            rows.append([photo(name, spec, s) for s in seeds])
        sheet(rows, os.path.join(comfy.WORK, f"{args.sheet}.png"))
        return
    for name in only:
        spec = specs.MODELS[name]
        seed = args.seed or spec["seeds"][spec["pick"]]
        source = photo(name, spec, seed)
        comfy.trellis(source, name, args.mesh_seed or seed, faces=spec.get("faces", args.faces), tex=max(1024, spec.get("tex", args.tex)), remesh=args.remesh, smooth=args.smooth, fast="height" in spec and not name.startswith("lighter"))


if __name__ == "__main__":
    main()
