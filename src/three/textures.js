import * as THREE from "three";

// 画像ファイルを使わず、Canvas で質感テクスチャを生成する

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(width, height, draw, { srgb = true, wrap = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  if (wrap) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function speckle(ctx, width, height, count, colors, sizeRange, random) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    const size = sizeRange[0] + random() * (sizeRange[1] - sizeRange[0]);
    ctx.globalAlpha = 0.25 + random() * 0.6;
    ctx.fillRect(random() * width, random() * height, size, size * (0.5 + random()));
  }
  ctx.globalAlpha = 1;
}

export function radialTexture(stops = [[0, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]], size = 128) {
  return canvasTexture(size, size, (ctx) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

export function smokeTexture() {
  const random = seeded(7);
  return canvasTexture(128, 128, (ctx, w, h) => {
    for (let i = 0; i < 14; i += 1) {
      const x = w / 2 + (random() - 0.5) * w * 0.35;
      const y = h / 2 + (random() - 0.5) * h * 0.35;
      const r = w * (0.18 + random() * 0.2);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, "rgba(255,255,255,0.22)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

export function tobaccoTexture() {
  const random = seeded(31);
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 260; i += 1) {
      const colors = ["#8a6038", "#4a2f1a", "#a37445", "#3a2414"];
      ctx.strokeStyle = colors[Math.floor(random() * colors.length)];
      const x = random() * w;
      const y = random() * h;
      const angle = random() * Math.PI;
      const length = 4 + random() * 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }
  });
}

export function phoneScreenTexture(from = "", text = "", wallpaper = null) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#2b4a6b");
    gradient.addColorStop(1, "#162536");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    if (wallpaper) ctx.drawImage(wallpaper, 0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "600 54px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("21:47", w / 2, 120);
    if (!from) return;
    ctx.fillStyle = "rgba(240,244,238,0.92)";
    ctx.beginPath();
    ctx.roundRect(16, 170, w - 32, 110, 18);
    ctx.fill();
    ctx.fillStyle = "#18211f";
    ctx.textAlign = "left";
    ctx.font = "700 24px sans-serif";
    ctx.fillText(from, 32, 210);
    ctx.font = "20px sans-serif";
    ctx.fillText(text.slice(0, 11), 32, 244);
    ctx.fillText(text.slice(11, 22), 32, 270);
  });
}
