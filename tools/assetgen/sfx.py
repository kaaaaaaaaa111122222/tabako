"""効果音を ComfyUI（Stable Audio 3 small SFX）で作り、切り出して src/assets/audio/ へ書き出す。

  python sfx.py gen [--only a,b]     候補（シード違い）を作る → ComfyUI/output/tabako/sfx/*.npy
  python sfx.py build [--only a,b]   候補から選び、整えて mp3 にする。波形とスペクトルの一覧画像も作る

必要なモデル（ComfyUI/models）：
  checkpoints/stable_audio_3_small_sfx.safetensors, text_encoders/t5gemma_b_b_ul2.safetensors
"""
import argparse
import json
import os
import sys
import urllib.parse

import av
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comfy  # noqa: E402
from comfy import node  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(comfy.WORK, "sfx")
OUT = os.path.join(HERE, "..", "..", "src", "assets", "audio")
SR = 44100
SEEDS = 4

DRY = ", isolated, dry close-mic studio recording, no music, no voice"
FIELD = ", continuous field recording, steady, no music, no speech"

# kind: shot = 一発の音（length 秒に切る）, loop = つなぎ目のない環境音（length 秒）, voice = 声（切り方は shot と同じ）
SOUNDS = {
    # 点火
    "pickup": ("Picking up a small plastic lighter from a stone ledge, short soft plastic handling clack" + DRY, 2, "shot", 0.35),
    "strike_a": ("Flint wheel of a cigarette lighter flicked once, short sharp metallic scratch with sparks" + DRY, 2, "shot", 0.28),
    "strike_b": ("Single quick scrape of a lighter spark wheel against flint, crisp metallic rasp" + DRY, 2, "shot", 0.28),
    "ignite": ("Cigarette lighter ignites, gas hiss and a soft whoosh of a small flame lighting up" + DRY, 3, "shot", 0.9),
    "drop": ("Small plastic lighter dropped on concrete, bounces twice" + DRY, 2, "shot", 0.8),
    "scrape": ("Match head scraped once along the rough striker of a match box, short dry scratch" + DRY, 2, "shot", 0.3),
    "match_ignite": ("Match flares up and ignites with a fizzing hiss, then settles into a small flame" + DRY, 3, "shot", 1.3),
    "snap": ("Small wooden match stick snapped in half, one short crack" + DRY, 2, "shot", 0.25),
    "match_take": ("Fingers taking one match out of a small match box, light wooden rattle and cardboard slide" + DRY, 2, "shot", 0.6),
    "extinguish": ("Small flame blown out by wind, short soft puff and fading hiss" + DRY, 2, "shot", 0.7),
    # 吸う・吐く・灰
    "inhale": ("Person slowly inhaling through a cigarette, quiet airy draw with faint paper crackle" + DRY, 4, "shot", 2.0),
    "crackle": ("Very quiet crackling of burning tobacco and paper of a cigarette" + FIELD, 6, "loop", 3.0),
    "exhale": ("Person exhaling a long slow relaxed breath, blowing smoke softly" + DRY, 4, "shot", 1.8),
    "ash_tap": ("Finger tapping a cigarette twice on the edge of a metal ashtray, light ticks" + DRY, 2, "shot", 0.6),
    "stub": ("Cigarette stubbed out in a metal ashtray, pressed and twisted, short fizz and scrape" + DRY, 3, "shot", 1.1),
    "cough": ("A man coughing twice, dry smoker cough, close-mic, isolated, no music", 3, "voice", 1.1),
    # お邪魔
    "gust": ("Sudden strong gust of wind rushing past, whoosh rising and falling, no music", 4, "shot", 2.6),
    "sneeze": ("A man sneezing once loudly, achoo, close-mic, isolated, no music", 3, "voice", 1.0),
    "swat": ("Hand swatting quickly through the air and hitting a small insect, short whoosh and light slap" + DRY, 2, "shot", 0.4),
    "moth": ("Moth wings fluttering rapidly near the ear, soft papery flutter" + FIELD, 5, "loop", 2.0),
    "shoo": ("Hand waving quickly through the air, short light whoosh" + DRY, 2, "shot", 0.3),
    "buzz": ("Smartphone vibrating on a hard table, two short buzzes" + DRY, 2, "shot", 0.9),
    "ring": ("Generic smartphone ringtone, two short electronic marimba notes, clean" + ", isolated, no voice", 2, "shot", 1.0),
    "swipe": ("Soft user interface swipe whoosh, very short, clean" + ", isolated", 2, "shot", 0.25),
    "mumble_a": ("Old man mumbling a short friendly unintelligible phrase, low gravelly voice, close, no music", 3, "voice", 1.3),
    "mumble_b": ("Middle aged man mumbling a short polite unintelligible phrase, soft nasal voice, close, no music", 3, "voice", 1.3),
    # 画面の音
    "alert": ("Short soft warning chime, two quick notes, clean user interface sound, isolated", 2, "shot", 0.6),
    "clear": ("Short pleasant positive user interface chime, two rising notes, clean, isolated", 2, "shot", 0.7),
    "tick": ("Single very short soft wooden user interface click, clean, isolated", 1, "shot", 0.1),
    "dud": ("Single very short dull low muted thud, failed action, isolated", 1, "shot", 0.2),
    "success": ("Warm short success jingle, gentle vibraphone and soft pad, relaxed, resolves", 4, "shot", 2.6),
    "fail": ("Short sad descending two note tone, soft, game over, clean, isolated", 3, "shot", 1.2),
    # 環境音（場所ごと）
    "rain": ("Steady heavy rain falling on a concrete balcony" + FIELD, 14, "loop", 9.0),
    "wind": ("Steady moderate wind blowing at a high open place" + FIELD, 14, "loop", 9.0),
    "amb_balcony": ("Quiet distant city ambience at dusk heard from a high balcony, faint traffic hum" + FIELD, 16, "loop", 11.0),
    "amb_konbini": ("Night parking lot outside a convenience store, humming vending machine, distant passing car, crickets" + FIELD, 16, "loop", 11.0),
    "amb_rooftop": ("Windy rooftop at night, air conditioning units humming, distant city" + FIELD, 16, "loop", 11.0),
    "amb_kissaten": ("Quiet old coffee shop ambience, soft cup and spoon clinks, coffee siphon bubbling, room tone" + FIELD, 16, "loop", 11.0),
    "amb_camp": ("Campfire crackling by a calm lake at night, soft water lapping, distant owl" + FIELD, 16, "loop", 11.0),
    "amb_harbor": ("Calm small harbour at dawn, gentle waves against a breakwater, distant seagulls, boat ropes creaking" + FIELD, 16, "loop", 11.0),
    "amb_engawa": ("Quiet snowy Japanese garden at night, trickling hot spring water, very faint breeze" + FIELD, 16, "loop", 11.0),
}


# 切り出す場所を決め打ちする音：名前 → (候補の番号, 開始秒)
CUTS = {
    "ignite": (1, 0.22),  # カチッという音の前の、ガスが燃え広がる部分
}


# ---------------------------------------------------------------- 生成
def generate(name, prompt, seconds, seed):
    wf = {
        "ckpt": node("CheckpointLoaderSimple", ckpt_name="stable_audio_3_small_sfx.safetensors"),
        "clip": node("CLIPLoader", clip_name="t5gemma_b_b_ul2.safetensors", type="stable_audio", device="default"),
        "pos": node("CLIPTextEncode", clip=["clip", 0], text=prompt),
        "neg": node("CLIPTextEncode", clip=["clip", 0], text=""),
        "lat": node("EmptyLatentAudio", seconds=float(seconds), batch_size=1),
        "ks": node("KSampler", model=["ckpt", 0], positive=["pos", 0], negative=["neg", 0], latent_image=["lat", 0], seed=seed, steps=8, cfg=1.0, sampler_name="lcm", scheduler="simple", denoise=1.0),
        "dec": node("VAEDecodeAudio", samples=["ks", 0], vae=["ckpt", 2]),
        "save": node("SaveAudio", audio=["dec", 0], filename_prefix=f"{comfy.PREFIX}/raw/sfx_{name}_{seed}"),
    }
    item = comfy.run(wf, poll=0.3)["save"]["audio"][0]
    path = os.path.join(comfy.COMFY, "output", item["subfolder"], item["filename"])
    return read_audio(path)


def read_audio(path):
    with av.open(path) as c:
        resampler = av.AudioResampler(format="fltp", layout="stereo", rate=SR)
        chunks = [f.to_ndarray() for frame in c.decode(audio=0) for f in resampler.resample(frame)]
    return np.concatenate(chunks, axis=1).astype(np.float32)


def write_mp3(path, data, bitrate):
    """data: (ch, n)"""
    layout = "stereo" if data.shape[0] == 2 else "mono"
    with av.open(path, "w") as c:
        stream = c.add_stream("libmp3lame", rate=SR, layout=layout)
        stream.bit_rate = bitrate
        pcm = np.ascontiguousarray(np.clip(data, -1, 1).astype(np.float32))
        frame = av.AudioFrame.from_ndarray(pcm, format="fltp", layout=layout)
        frame.sample_rate = SR
        resampler = av.AudioResampler(format=stream.codec_context.format or "s16p", layout=layout, rate=SR, frame_size=1152)
        for f in resampler.resample(frame) + resampler.resample(None):
            for packet in stream.encode(f):
                c.mux(packet)
        for packet in stream.encode(None):
            c.mux(packet)


# ---------------------------------------------------------------- 整える
def moving_average(x, n):
    """幅 n の移動平均（累積和なので長い音でも速い）。"""
    n = max(1, min(int(n), len(x)))
    padded = np.pad(x.astype(np.float64), (n // 2, n - n // 2), mode="edge")
    total = np.concatenate([[0.0], np.cumsum(padded)])
    return ((total[n:] - total[:-n]) / n)[: len(x)]


def envelope(x, win=0.005):
    n = max(1, int(SR * win))
    mono = np.abs(x).max(0)
    pad = np.pad(mono, (0, (-len(mono)) % n))
    return pad.reshape(-1, n).max(1), n


def cut_shot(x, length):
    """一番はっきりした音の立ち上がりから length 秒を切り出す。"""
    env, n = envelope(x)
    peak = env.max() + 1e-9
    # 立ち上がりの候補：静かな所から大きくなる位置のうち、切り出した範囲のエネルギーが最大のもの
    want = int(length * SR / n)
    energy = np.convolve(env**2, np.ones(want), "full")[want - 1:][: len(env)]
    rise = np.r_[env[0], np.diff(env)]
    score = energy / energy.max() + 0.6 * np.clip(rise / peak, 0, 1)
    score[max(1, len(env) - want // 2):] = 0
    start = int(score.argmax())
    while start > 0 and env[start - 1] > peak * 0.03:
        start -= 1
    a = max(0, start * n - int(0.004 * SR))
    y = x[:, a: a + int(length * SR)].copy()
    fade_in, fade_out = int(0.003 * SR), int(min(0.35 * length, 0.4) * SR)
    y[:, :fade_in] *= np.linspace(0, 1, fade_in)
    k = min(fade_out, y.shape[1])
    y[:, -k:] *= np.linspace(1, 0, k) ** 1.5
    return y


def make_loop(x, length, cross=1.2):
    """末尾を頭へクロスフェードして、つなぎ目のない length 秒にする。前後に 0.1 秒ずつ巻き戻しを足す。"""
    edge = int(0.4 * SR)
    need, c = int(length * SR), int(cross * SR)
    body = x[:, edge: edge + need + c]
    if body.shape[1] < need + c:
        need = body.shape[1] - c
    t = np.linspace(0, 1, c)
    y = body[:, :need].copy()
    y[:, :c] = body[:, :c] * np.sqrt(t) + body[:, need: need + c] * np.sqrt(1 - t)
    # 大きな音量の波をならす
    env = np.sqrt(np.maximum(moving_average((y**2).mean(0), SR), 1e-8))
    env = np.pad(env, (0, y.shape[1] - len(env)), mode="edge")
    y /= np.clip(env / np.median(env), 0.6, 1.8)
    wrap = int(0.1 * SR)
    return np.concatenate([y[:, -wrap:], y, y[:, :wrap]], axis=1)


def quality(x, kind, length):
    """候補の良さ（大きいほど良い）。一発の音は「静かな背景にはっきり鳴る」、環境音は「むらがない」。"""
    env, _ = envelope(x)
    if env.max() < 1e-3:
        return -9
    if kind == "loop":
        level = np.sqrt(np.convolve(env**2, np.ones(100) / 100, "valid"))
        return -float(level.std() / (level.mean() + 1e-9))
    quiet = np.percentile(env, 20) / env.max()
    y = cut_shot(x, length)
    inside = (y**2).sum() / ((x**2).sum() + 1e-9)
    return float(inside - quiet * 1.5)


def normalize(y, peak=0.89, rms=None):
    y = y - y.mean(1, keepdims=True)
    if rms:
        y = y * (rms / (np.sqrt((y**2).mean()) + 1e-9))
        y = np.tanh(y / 0.95) * 0.95
    else:
        y = y * (peak / (np.abs(y).max() + 1e-9))
    return y


def spectrogram(x, width=220, height=72):
    mono = x.mean(0)
    n = 1024
    hop = max(1, (len(mono) - n) // width)
    frames = [mono[i * hop: i * hop + n] for i in range(width) if i * hop + n <= len(mono)]
    if not frames:
        return Image.new("RGB", (width, height))
    spec = np.abs(np.fft.rfft(np.stack(frames) * np.hanning(n), axis=1)).T
    bands = np.geomspace(2, n // 2 - 1, height + 1).astype(int)
    img = np.stack([spec[a: max(b, a + 1)].mean(0) for a, b in zip(bands[:-1], bands[1:])])[::-1]
    db = np.clip((20 * np.log10(img + 1e-6) + 50) / 80, 0, 1)
    rgb = np.stack([db, db**2, np.sqrt(db) * 0.6], axis=-1)
    return Image.fromarray((rgb * 255).astype(np.uint8)).resize((width, height))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["gen", "build"])
    ap.add_argument("--only", default="")
    ap.add_argument("--pick", default="", help="name=番号 をカンマ区切りで（自動で選ばず指定する）")
    args = ap.parse_args()
    only = [n for n in args.only.split(",") if n]
    picks = dict(p.split("=") for p in args.pick.split(",") if p)
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    rows = []
    total = 0
    for name, (prompt, seconds, kind, length) in SOUNDS.items():
        if only and name not in only:
            continue
        files = [os.path.join(WORK, f"{name}_{s}.npy") for s in range(SEEDS)]
        if args.command == "gen":
            for s, f in enumerate(files):
                if not os.path.exists(f):
                    np.save(f, generate(name, prompt, seconds, 900 + s * 17))
            print("gen", name, flush=True)
            continue
        takes = [np.load(f) for f in files]
        scores = [quality(x, kind, length) for x in takes]
        pick = int(picks.get(name, int(np.argmax(scores))))
        x = takes[pick]
        if kind == "loop":
            y = normalize(make_loop(x, length), rms=0.12 if name.startswith("amb") else 0.14)
            data = y if name.startswith("amb") or name in ("rain", "wind") else y.mean(0, keepdims=True)
            write_mp3(os.path.join(OUT, name + ".mp3"), data, 96000 if data.shape[0] == 2 else 64000)
        else:
            if name in CUTS:
                pick, start = CUTS[name]
                x = takes[pick][:, int(start * SR): int((start + length) * SR)]
            y = normalize(cut_shot(x, length))
            data = y.mean(0, keepdims=True)
            data = data * (0.89 / (np.abs(data).max() + 1e-9))
            write_mp3(os.path.join(OUT, name + ".mp3"), data, 80000)
        size = os.path.getsize(os.path.join(OUT, name + ".mp3"))
        total += size
        rows.append((name, pick, scores, takes, y, size))
        print(f"{name:14s} pick {pick}  {[round(s, 2) for s in scores]}  {size // 1024} KB", flush=True)
    if rows:
        sheet = Image.new("RGB", (120 + 230 * (SEEDS + 1), 84 * len(rows)), (20, 20, 20))
        draw = ImageDraw.Draw(sheet)
        for r, (name, pick, scores, takes, y, size) in enumerate(rows):
            draw.text((4, r * 84 + 30), f"{name}\n{size // 1024} KB", fill=(255, 230, 150))
            for c, x in enumerate(takes):
                sheet.paste(spectrogram(x), (120 + c * 230, r * 84 + 6))
                draw.rectangle((119 + c * 230, r * 84 + 5, 341 + c * 230, r * 84 + 79), outline=(90, 220, 120) if c == pick else (60, 60, 60))
            sheet.paste(spectrogram(y), (120 + SEEDS * 230, r * 84 + 6))
        sheet.save(os.path.join(comfy.WORK, "sheet_sfx.png"))
        print("total", total // 1024, "KB")


if __name__ == "__main__":
    main()
