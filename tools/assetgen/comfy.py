"""ローカルの ComfyUI（127.0.0.1:8188）を API で動かすための共通部品。

  flux()     文章 → 画像（FLUX.2 klein 4B）。reference を渡すと参照画像つきの編集
  cutout()   背景除去（BiRefNet）→ 透過 PNG
  trellis()  画像 → 3D（TRELLIS.2）→ PBR テクスチャつき GLB

途中の画像や GLB は ComfyUI/output/tabako/ に残す。
"""
import io
import json
import os
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image

HOST = os.environ.get("COMFY_HOST", "http://127.0.0.1:8188")
COMFY = os.environ.get("COMFY_DIR", "C:/Users/jyori/ComfyUI")
PREFIX = "tabako"
WORK = os.path.join(COMFY, "output", PREFIX)


def _post(path, body):
    req = urllib.request.Request(HOST + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def _get(path):
    with urllib.request.urlopen(HOST + path) as r:
        return r.read()


def run(workflow, poll=1.0, timeout=None):
    """ワークフローを流して、出力（history の outputs）を返す。timeout 秒を超えたら止めて TimeoutError。"""
    started = time.time()
    try:
        prompt_id = _post("/prompt", {"prompt": workflow})["prompt_id"]
    except urllib.error.HTTPError as e:
        raise RuntimeError("ComfyUI がワークフローを拒否: " + e.read().decode("utf-8", "replace")[:3000])
    while True:
        history = json.loads(_get("/history/" + prompt_id))
        if prompt_id in history:
            entry = history[prompt_id]
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                errors = [m for m in status.get("messages", []) if m[0] == "execution_error"]
                raise RuntimeError(json.dumps(errors, ensure_ascii=False)[:3000])
            if status.get("completed"):
                return entry["outputs"]
        if timeout and time.time() - started > timeout:
            _post_raw("/interrupt")
            raise TimeoutError(f"{timeout} 秒を超えたので止めた")
        time.sleep(poll)


def _post_raw(path):
    urllib.request.urlopen(urllib.request.Request(HOST + path, data=b"", method="POST")).read()


def _images(outputs, node):
    out = []
    for item in outputs[node]["images"]:
        query = urllib.parse.urlencode({"filename": item["filename"], "subfolder": item["subfolder"], "type": item["type"]})
        out.append(Image.open(io.BytesIO(_get("/view?" + query))))
    return out


def put_input(path, name):
    """画像を ComfyUI/input に置いて、LoadImage で使う名前を返す。"""
    name = f"{PREFIX}_{name}.png"
    Image.open(path).save(os.path.join(COMFY, "input", name))
    return name


def node(class_type, **inputs):
    return {"class_type": class_type, "inputs": inputs}


def flux(prompt, width, height, seed, name, steps=4, reference=None):
    wf = {
        "1": node("UNETLoader", unet_name="flux-2-klein-4b-fp8.safetensors", weight_dtype="default"),
        "2": node("CLIPLoader", clip_name="qwen_3_4b.safetensors", type="flux2"),
        "3": node("VAELoader", vae_name="flux2-vae.safetensors"),
        "4": node("CLIPTextEncode", clip=["2", 0], text=prompt),
        "5": node("BasicGuider", model=["1", 0], conditioning=["4", 0]),
        "6": node("EmptyFlux2LatentImage", width=width, height=height, batch_size=1),
        "7": node("Flux2Scheduler", steps=steps, width=width, height=height),
        "8": node("KSamplerSelect", sampler_name="euler"),
        "9": node("RandomNoise", noise_seed=seed),
        "10": node("SamplerCustomAdvanced", noise=["9", 0], guider=["5", 0], sampler=["8", 0], sigmas=["7", 0], latent_image=["6", 0]),
        "11": node("VAEDecode", samples=["10", 0], vae=["3", 0]),
        "12": node("SaveImage", images=["11", 0], filename_prefix=f"{PREFIX}/{name}"),
    }
    if reference:
        wf["13"] = node("LoadImage", image=put_input(reference, "ref"))
        wf["14"] = node("ImageScaleToTotalPixels", image=["13", 0], upscale_method="lanczos", megapixels=1.0, resolution_steps=16)
        wf["15"] = node("VAEEncode", pixels=["14", 0], vae=["3", 0])
        wf["16"] = node("ReferenceLatent", conditioning=["4", 0], latent=["15", 0])
        wf["5"]["inputs"]["conditioning"] = ["16", 0]
    return _images(run(wf), "12")[0].convert("RGB")


def cutout(path, name):
    wf = {
        "1": node("LoadImage", image=put_input(path, "cut")),
        "2": node("LoadBackgroundRemovalModel", bg_removal_name="birefnet.safetensors"),
        "3": node("RemoveBackground", bg_removal_model=["2", 0], image=["1", 0]),
        "4": node("InvertMask", mask=["3", 0]),
        "5": node("JoinImageWithAlpha", image=["1", 0], alpha=["4", 0]),
        "6": node("SaveImage", images=["5", 0], filename_prefix=f"{PREFIX}/{name}_cut"),
    }
    return _images(run(wf), "6")[0].convert("RGBA")


def trellis(image_path, name, seed, faces=20000, tex=2048, remesh=512, resolution=1024, smooth=4, crease=50.0, fast=False):
    """TRELLIS.2 で GLB を作り、そのパスを返す。法線マップ・粗さ・金属も焼く。

    fast = 遠くに置く物用：高解像度化・逆投影・法線マップを省く（大きな物だと、ここに何分もかかる）。
    """
    image = put_input(image_path, name)
    solid = {"sign_mode": "solid", "sign_mode.fill": 20.0, "sign_mode.qef": False}
    qem = {
        "placement_mode": "qem",
        "placement_mode.line_quadric_weight": 0.0,
        "placement_mode.feature_edge_quadric_weight": 0.0,
        "placement_mode.feature_edge_min_dihedral_deg": 30.0,
        "placement_mode.clamp_v_to_edge": True,
    }
    sampler = {"seed": seed, "sampler_name": "euler", "denoise": 1.0}
    wf = {
        # 写真 → 切り抜き → 条件づけ
        "img": node("LoadImage", image=image),
        "bgm": node("LoadBackgroundRemovalModel", bg_removal_name="birefnet.safetensors"),
        "mask": node("RemoveBackground", bg_removal_model=["bgm", 0], image=["img", 0]),
        "crop": node("ImageCropToMask", images=["img", 0], masks=["mask", 0], width=1024, height=1024, pad_factor=1.1, grow_mask=0, background="#000000"),
        "clip": node("CLIPVisionLoader", clip_name="dino_v3_L_naf_fp32.safetensors"),
        "cond": node("Trellis2Conditioning", clip_vision_model=["clip", 0], image=["crop", 0]),
        "unet": node("UNETLoader", unet_name="trellis_2_int8_convrot.safetensors", weight_dtype="default"),
        "svae": node("VAELoader", vae_name="trellis_2_shape_vae_bf16.safetensors"),
        "tvae": node("VAELoader", vae_name="trellis_2_texture_vae_bf16.safetensors"),
        # 構造
        "cfg1": node("CFGOverride", model=["unet", 0], cfg=1.0, start_percent=0.667, end_percent=1.0),
        "res1": node("RescaleCFG", model=["cfg1", 0], multiplier=0.7),
        "shift": node("ModelSamplingSD3", model=["res1", 0], shift=5.0),
        "lat0": node("EmptyTrellis2LatentStructure", batch_size=1),
        "ks0": node("KSampler", model=["shift", 0], positive=["cond", 0], negative=["cond", 1], latent_image=["lat0", 0], steps=12, cfg=7.5, scheduler="normal", **sampler),
        "vox": node("VaeDecodeStructureTrellis2", samples=["ks0", 0], vae=["svae", 0], resolution="32"),
        # 形
        "shape": node("Trellis2ShapeStage", positive=["cond", 0], negative=["cond", 1], voxel=["vox", 0]),
        "cfg2": node("CFGOverride", model=["unet", 0], cfg=1.0, start_percent=0.769, end_percent=1.0),
        "res2": node("RescaleCFG", model=["cfg2", 0], multiplier=0.5),
        "ks1": node("KSampler", model=["res2", 0], positive=["shape", 0], negative=["shape", 1], latent_image=["shape", 2], steps=20, cfg=7.5, scheduler="normal", **sampler),
        "up": node("Trellis2UpsampleStage", positive=["shape", 0], negative=["shape", 1], shape_latent=["ks1", 0], vae=["svae", 0], target_resolution=resolution),
        "ks2": node("KSampler", model=["res2", 0], positive=["up", 0], negative=["up", 1], latent_image=["up", 2], steps=12, cfg=7.5, scheduler="simple", **sampler),
        "dense": node("VaeDecodeShapeTrellis", samples=["ks2", 0], vae=["svae", 0]),
        # 色と質感
        "texs": node("Trellis2TextureStage", positive=["up", 0], negative=["up", 1], shape_latent=["ks2", 0]),
        "ks3": node("KSampler", model=["unet", 0], positive=["texs", 0], negative=["texs", 1], latent_image=["texs", 2], steps=12, cfg=1.0, scheduler="normal", **sampler),
        "pbr": node("VaeDecodeTextureTrellis", samples=["ks3", 0], vae=["tvae", 0], shape_subdivides=["dense", 1]),
        # 閉じた面に直す → 面を減らす → UV → テクスチャと法線マップを焼く
        "remesh": node("RemeshMesh", mesh=["dense", 0], resolution=remesh, band=1.0, project_back=0.0, fix_poles=False, smooth_iters=smooth, drop_small_components=0.01, precluster_max_verts=20000000, **solid),
        "low": node("DecimateMesh", mesh=["remesh", 0], target_face_count=faces, **qem),
        "nrm": node("MeshSmoothNormals", mesh=["low", 0], crease_angle=crease),
        "uv": node("UnwrapMesh", mesh=["nrm", 0], segmenter="pec", resolution=tex, padding=4, weld_distance=0.0002),
        "bake": node("BakeTextureFromVoxel", mesh=["uv", 0], voxel_colors=["pbr", 0], reference_mesh=["dense", 0], texture_size=tex),
        "nmap": node("BakeNormalMapFromMesh", low_poly=["uv", 0], high_poly=["dense", 0], resolution=tex, cage_distance=0.02, ignore_backfaces=True),
        "mat": node("ApplyTextureToMesh", mesh=["uv", 0], base_color=["bake", 0], metallic=["bake", 1], roughness=["bake", 2], normal_map=["nmap", 0]),
        "save": node("SaveGLB", mesh=["mat", 0], filename_prefix=f"{PREFIX}/raw/{name}_{seed}"),
    }
    if fast:
        # 512 の段階で止める（1024 への引き上げを省く）
        del wf["up"], wf["ks2"]
        wf["dense"]["inputs"]["samples"] = ["ks1", 0]
        wf["texs"]["inputs"].update(positive=["shape", 0], negative=["shape", 1], shape_latent=["ks1", 0])
        wf["remesh"]["inputs"]["resolution"] = min(remesh, 384)
        del wf["bake"]["inputs"]["reference_mesh"], wf["nmap"], wf["mat"]["inputs"]["normal_map"]
    t0 = time.time()
    item = run(wf, poll=2.0, timeout=170 if fast else None)["save"]["3d"][0]
    src = os.path.join(COMFY, "output", item["subfolder"], item["filename"])
    dst = os.path.join(WORK, "glb", f"{name}_{seed}.glb")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(src, dst)
    print(f"{name}: TRELLIS.2 {time.time() - t0:.0f} s -> {dst} ({os.path.getsize(dst) // 1024} KB)", flush=True)
    return dst
