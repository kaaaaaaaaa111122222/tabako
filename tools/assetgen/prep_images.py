"""生成した 2D 画像を、ゲームで使う大きさ・形に整えて src/assets/images/ へ書き出す。

  python prep_images.py   （ComfyUI の Python で実行。numpy / Pillow を使う）
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import comfy

PHOTO = os.path.join(comfy.WORK, "photo")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "assets", "images")
os.makedirs(OUT, exist_ok=True)


def load(name):
    return Image.open(os.path.join(PHOTO, name + ".png")).convert("RGB")


def save(im, name, quality=86):
    path = os.path.join(OUT, name)
    im.save(path, quality=quality, optimize=True)
    print(f"{name}: {im.width}x{im.height} {os.path.getsize(path) // 1024} KB")


def normal_map(im, strength=2.0, blur=0.6):
    """明るさを高さとみなして法線マップを作る（明るい = 高い）。"""
    h = np.asarray(im.convert("L").filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32) / 255
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, dy, np.ones_like(h)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))


def flatten(im, radius=160, amount=0.7):
    """大きな明暗のむらを減らす（繰り返したときに目立たないように）。"""
    a = np.asarray(im, dtype=np.float32)
    low = np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)
    mean = a.reshape(-1, 3).mean(0)
    return Image.fromarray(np.clip(a - (low - mean) * amount, 0, 255).astype(np.uint8))


# 場所の小さな絵（thumb_*.jpg）は、ゲームの 3D 画面を撮って作る
save(load("keyvisual_463").resize((1600, 906), Image.LANCZOS), "title.jpg", 82)

# 質感（MirroredRepeat で並べる）
for name, source, strength in (
    ("concrete", "concrete_323", 2.2),
    ("wall", "wall_333", 2.6),
    ("wood_dark", "wood_dark_472", 1.2),
    ("wood_plank", "wood_plank_476", 2.4),
    ("steel", "steel_480", 0.8),
):
    im = flatten(load(source))
    save(im, f"{name}.jpg", 84)
    save(normal_map(im, strength).resize((512, 512), Image.LANCZOS), f"{name}_n.jpg", 88)

# 3D の場所の質感
for name, source in (("asphalt", "asphalt_601"), ("forest", "forest_603"), ("plaster", "plaster_606"), ("snow", "snow_608")):
    save(flatten(load(source)).resize((768, 768), Image.LANCZOS), f"{name}.jpg", 80)
for name, source, gain in (("bark", "bark_621", 2.0), ("panel", "panel_622", 1.0), ("roofdeck", "roofdeck_631", 1.0), ("quay", "quay_633", 1.0), ("brickwall", "brickwall_634", 1.0)):
    save(flatten(load(source)).resize((768, 768), Image.LANCZOS).point(lambda v: min(255, int(v * gain))), f"{name}.jpg", 80)
for name, source in (("facade", "facade_610"), ("facade2", "facade2_612")):
    save(load(source).resize((768, 768), Image.LANCZOS), f"{name}.jpg", 82)
# 店の棚・冷蔵ケース・ステンドグラス（余白を切り落とす）
for name, source, (l, t, r, b), size in (
    ("goods", "goods_627", (0.0, 0.09, 1.0, 0.93), (768, 640)),
    ("fridge", "fridge_628", (0.05, 0.15, 0.96, 0.85), (768, 590)),
    ("stained", "stained_624", (0.06, 0.04, 0.94, 0.96), (480, 660)),
):
    im = load(source)
    save(im.crop((int(im.width * l), int(im.height * t), int(im.width * r), int(im.height * b))).resize(size, Image.LANCZOS), f"{name}.jpg", 82)

# 紙マッチの表紙（上面）：奥の長辺にヤスリの帯。props.js の寸法（0.115 x 0.065、帯の中心は奥から 22%）に合わせる
cover = load("matchbook_282")
arr = np.asarray(cover.convert("L"))
dark = arr < 140
ys, xs = np.where(dark)
pad = 6
cover = cover.crop((xs.min() + pad, ys.min() + pad, xs.max() - pad, ys.max() - pad)).resize((920, 520), Image.LANCZOS)
striker = load("striker_285").resize((512, 512), Image.LANCZOS)
top, bottom = int(520 * 0.08), int(520 * 0.365)
# 表紙は帯の手前側だけに収める
face = cover.resize((920, 520 - bottom), Image.LANCZOS)
sheet = Image.new("RGB", (920, 520))
sheet.paste(cover.crop((0, 0, 920, top)), (0, 0))
sheet.paste(face, (0, bottom))
band = Image.new("RGB", (920, bottom - top))
for x in range(0, 920, 512):
    band.paste(striker.crop((0, 0, 512, bottom - top)), (x, 0))
sheet.paste(band, (0, top))
draw = ImageDraw.Draw(sheet)
draw.rectangle((0, top - 2, 920, top), fill=(20, 24, 40))
draw.rectangle((0, bottom, 920, bottom + 2), fill=(20, 24, 40))
save(sheet, "matchbook.jpg", 88)

# スマホ
save(load("wallpaper_341").resize((600, 1200), Image.LANCZOS), "wallpaper.jpg", 86)
for who, source in (("boss", "avatar_boss_351"), ("mother", "avatar_mother_353"), ("landlord", "avatar_landlord_352")):
    im = load(source)
    w = im.width
    im.crop((int(w * 0.12), 0, int(w * 0.88), int(w * 0.76))).resize((224, 224), Image.LANCZOS).save(os.path.join(OUT, f"avatar_{who}.jpg"), quality=86)
print("ok")
