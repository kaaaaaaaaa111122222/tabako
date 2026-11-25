import * as THREE from "three";
import { createKit, seeded } from "./kit.js";
import { framed } from "./parts.js";

/*
 * 純喫茶（喫煙席）。奥のボックス席に座り、テーブルの灰皿で吸う。
 */

export async function kissaten() {
  const kit = await createKit({
    eye: 1.13,
    models: ["chair", "lamp", "siphon", "cup", "grinder", "cabinet", "sofa", "cafetable", "sugar", "menu", "water", "clock", "palm", "register", "showcase", "jars", "record", "stool"],
    images: ["wood_dark", "plaster", "wood_plank", "panel", "stained"],
  });
  const random = seeded(51);
  const wood = kit.material("wood_dark", { repeat: [3, 1], color: "#b08a6a", roughness: 0.4, bump: 0.5 });
  const dark = kit.material("wood_dark", { repeat: [2, 1], color: "#7a5a42", roughness: 0.5 });
  const trim = kit.solid("#3a2213", { roughness: 0.45 });
  const panelWall = (repeat) => kit.material("panel", { repeat, color: "#c9a686", roughness: 0.5, bump: 0.6 });
  const plaster = kit.material("plaster", { repeat: [4, 1], color: "#c2a070", roughness: 0.95 });
  kit.ground([12, 16], 0, kit.material("wood_plank", { repeat: [7, 9], color: "#5f412c", roughness: 0.5, bump: 0.6 }), [0.4, -4]);
  kit.ground([12, 16], 2.65, kit.material("plaster", { repeat: [4, 6], color: "#6f5438" }), [0.4, -4]).rotation.x = Math.PI / 2;
  for (let i = -3; i <= 3; i += 1) kit.box([0.14, 0.16, 16], [0.4 + i * 1.5, 2.58, -4], dark);
  for (const z of [-1.8, -4.8]) kit.box([12, 0.2, 0.16], [0.4, 2.56, z], dark);

  /* ---- 壁 ---- */
  const left = -2.35;
  const right = 3.5;
  const back = -7.2;
  kit.box([0.1, 2.65, 10], [left - 0.05, 1.32, -3], panelWall([5, 1.3]));
  kit.box([0.1, 2.65, 10], [right + 0.05, 1.32, -3], panelWall([5, 1.3]));
  kit.box([12, 2.65, 0.1], [0.4, 1.32, back - 1.4], plaster);
  for (const x of [left + 0.02, right - 0.02]) {
    kit.box([0.06, 0.09, 10], [x, 0.92, -3], trim);
    kit.box([0.06, 0.16, 10], [x, 0.08, -3], trim);
    kit.box([0.06, 0.1, 10], [x, 2.34, -3], trim);
  }
  // 奥の仕切り：腰壁と柱、その向こうがカウンター
  kit.box([1.5, 2.65, 0.14], [left + 0.7, 1.32, back + 0.6], panelWall([0.8, 1.3]));
  kit.box([0.9, 2.65, 0.14], [right - 0.4, 1.32, back + 0.6], panelWall([0.5, 1.3]));
  kit.box([4.0, 0.98, 0.5], [0.75, 0.49, back + 0.6], panelWall([2, 0.5]));
  kit.box([4.2, 0.06, 0.72], [0.75, 1.01, back + 0.62], kit.material("wood_dark", { repeat: [3, 0.5], color: "#c79a72", roughness: 0.22 }));
  kit.box([4.2, 0.3, 0.18], [0.75, 2.5, back + 0.6], dark);
  for (const x of [-1.22, 2.72]) kit.box([0.16, 2.65, 0.2], [x, 1.32, back + 0.6], dark);

  /* ---- 手前のテーブル（吸う所） ---- */
  const top = kit.material("wood_dark", { repeat: [1.6, 0.9], color: "#e0a878", roughness: 0.24, bump: 0.2, envMapIntensity: 0.6 });
  kit.rbox([1.5, 0.045, 0.78], 0.02, [0, 0.708, -1.29], top);
  kit.rbox([1.42, 0.05, 0.7], 0.02, [0, 0.665, -1.29], trim);
  kit.cylinder(0.05, 0.07, 0.62, [0, 0.34, -1.3], kit.solid("#1c1a18", { metalness: 0.6, roughness: 0.4 }));
  kit.cylinder(0.26, 0.3, 0.04, [0, 0.02, -1.3], kit.solid("#1c1a18", { metalness: 0.6, roughness: 0.4 }));
  const cup = (x, z, yaw) => kit.put("cup", [x, 0.731, z], { yaw, height: 0.085 });
  cup(0.5, -1.2, 0.6);
  cup(-0.48, -1.5, 2.6);
  kit.steam({ at: [0.5, 0.82, -1.2], spread: [0.03, 0.03], count: 5, size: 0.05, grow: 0.12, rise: 0.28, opacity: 0.09, speed: 0.25 });
  kit.put("sugar", [0.3, 0.731, -1.56], { height: 0.11 });
  kit.put("menu", [0.02, 0.731, -1.6], { height: 0.2, yaw: 0.1 });
  kit.put("water", [0.64, 0.731, -1.42], { height: 0.12, roughness: 0.15 });
  kit.put("water", [-0.64, 0.731, -1.38], { height: 0.12, roughness: 0.15 });
  kit.rbox([0.09, 0.012, 0.05], 0.004, [-0.3, 0.737, -1.58], kit.solid("#8a2a22"));
  kit.cylinder(0.02, 0.02, 0.07, [0.18, 0.766, -1.6], kit.solid("#e8e0d0"), undefined, undefined, 12);

  /* ---- 席 ---- */
  kit.put("sofa", [0.0, 0, -2.45], { height: 0.98 });
  kit.put("sofa", [-1.75, 0, -3.9], { height: 0.98, yaw: Math.PI / 2 });
  kit.put("sofa", [-1.75, 0, -5.6], { height: 0.98, yaw: Math.PI / 2 });
  kit.put("cafetable", [-0.7, 0, -4.1], { height: 0.7 });
  kit.put("cafetable", [-0.75, 0, -5.7], { height: 0.7 });
  kit.put("chair", [0.15, 0, -4.3], { yaw: -1.5, height: 0.85 });
  kit.put("chair", [0.1, 0, -5.8], { yaw: -1.6, height: 0.85 });
  kit.put("cafetable", [2.5, 0, -2.9], { height: 0.7 });
  kit.put("chair", [2.0, 0, -2.0], { yaw: 2.8, height: 0.85 });
  kit.put("chair", [2.75, 0, -3.8], { yaw: 0.2, height: 0.85 });
  kit.put("cafetable", [2.5, 0, -5.0], { height: 0.7 });
  kit.put("chair", [2.9, 0, -5.8], { yaw: 0.1, height: 0.85 });
  for (const [x, z] of [[-0.8, -4.0], [-0.6, -5.6], [2.4, -2.9], [2.6, -5.0]]) {
    kit.put("cup", [x, 0.7, z], { yaw: random() * 6, height: 0.085 });
    kit.put("sugar", [x + 0.18, 0.7, z - 0.16], { height: 0.11 });
    kit.put("menu", [x - 0.15, 0.7, z - 0.18], { height: 0.18, yaw: random() - 0.5 });
  }
  kit.scatter("stool", [-0.5, 0.4, 1.3, 2.2].map((x) => ({ position: [x, 0, back + 1.4], height: 0.62, yaw: x })), { color: "#8a5a3a" });

  /* ---- カウンターの中 ---- */
  for (const x of [-0.6, 0.75, 2.1]) kit.put("cabinet", [x, 0, back - 1.0], { height: 2.1 });
  const bar = 1.04;
  kit.put("siphon", [-0.6, bar, back + 0.6], { yaw: 0.4 });
  kit.put("siphon", [-0.2, bar, back + 0.55], { yaw: 1.2 });
  kit.put("grinder", [0.3, bar, back + 0.6], { yaw: -0.3 });
  kit.put("jars", [0.95, bar, back + 0.58], { height: 0.24, yaw: 0.1 });
  kit.scatter("cup", [1.4, 1.58, 1.76, 1.95].map((x, i) => ({ position: [x, bar, back + 0.5 + (i % 2) * 0.12], yaw: i * 1.4, height: 0.09 })));
  kit.put("register", [2.35, bar, back + 0.6], { height: 0.42, yaw: -0.4 });
  kit.put("showcase", [-1.0, bar, back + 0.6], { height: 0.28, yaw: 0.1, glow: 0.25, threshold: 0.7 });
  kit.scatter("cup", Array.from({ length: 7 }, (_, i) => ({ position: [-0.6 + i * 0.4, 2.0, back + 0.35], yaw: i, height: 0.09 })));
  kit.box([3.6, 0.03, 0.26], [0.75, 1.985, back + 0.36], dark);

  /* ---- 壁ぎわの物 ---- */
  kit.put("palm", [-2.0, 0, -2.5], { height: 1.65, yaw: 0.5 });
  kit.put("palm", [3.05, 0, -6.0], { height: 1.5, yaw: 2 });
  kit.box([0.46, 0.85, 0.9], [right - 0.25, 0.42, -4.0], dark);
  kit.put("record", [right - 0.3, 0.85, -4.0], { height: 0.62, yaw: -1.2 });
  kit.put("clock", [left + 0.1, 1.28, -4.7], { height: 0.85, yaw: Math.PI / 2 });
  // ステンドグラスの窓
  const glass = (x, z, yaw) => {
    const map = kit.material("stained").map;
    kit.mesh(new THREE.PlaneGeometry(0.72, 0.96), new THREE.MeshBasicMaterial({ map, color: new THREE.Color("#ffffff").multiplyScalar(1.15) }), [x, 1.58, z], [0, yaw, 0]);
    const [dx, dz] = [Math.sin(yaw), Math.cos(yaw)];
    for (const k of [-0.39, 0.39]) kit.box([0.06, 1.1, 0.06], [x + dz * k + dx * 0.01, 1.58, z - dx * k + dz * 0.01], trim, [0, yaw, 0]);
    for (const k of [-0.51, 0.51]) kit.box([0.84, 0.06, 0.06], [x + dx * 0.01, 1.58 + k, z + dz * 0.01], trim, [0, yaw, 0]);
  };
  glass(left + 0.02, -3.3, Math.PI / 2);
  glass(right - 0.02, -2.4, -Math.PI / 2);
  glass(right - 0.02, -5.2, -Math.PI / 2);
  // 額・品書きの短冊（文字のない線だけ）
  const picture = (ctx, w, h, sky, hill) => {
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hill;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.7);
    ctx.quadraticCurveTo(w * 0.3, h * 0.35, w * 0.55, h * 0.65);
    ctx.quadraticCurveTo(w * 0.8, h * 0.45, w, h * 0.72);
    ctx.lineTo(w, h);
    ctx.fill();
  };
  framed(kit, 0.5, 0.36, [left + 0.03, 1.7, -2.35], [0, Math.PI / 2, 0], (ctx, w, h) => picture(ctx, w, h, "#b8a888", "#5d6a58"));
  framed(kit, 0.34, 0.44, [left + 0.03, 1.62, -5.5], [0, Math.PI / 2, 0], (ctx, w, h) => picture(ctx, w, h, "#8a9aa0", "#4a4238"));
  framed(kit, 0.6, 0.42, [right - 0.03, 1.72, -3.8], [0, -Math.PI / 2, 0], (ctx, w, h) => picture(ctx, w, h, "#c0a878", "#7a4a30"));
  framed(kit, 0.4, 0.5, [-1.9, 1.7, back + 0.69], undefined, (ctx, w, h) => picture(ctx, w, h, "#a8b0a0", "#3d4a44"));
  for (let i = 0; i < 6; i += 1) {
    kit.panel(0.11, 0.42, [left + 0.03, 1.92, -6.1 + i * 0.0 - i * 0.0 + (i - 3) * 0.16], [0, Math.PI / 2, 0], (ctx, w, h) => {
      ctx.fillStyle = "#e6d6b0";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#3a2a1c";
      for (let k = 0; k < 5; k += 1) ctx.fillRect(w * 0.36, h * (0.1 + k * 0.12), w * 0.28, h * 0.07);
      ctx.fillStyle = "#a03a2a";
      ctx.fillRect(w * 0.4, h * 0.78, w * 0.2, h * 0.1);
    }, { pixels: 128 });
  }

  /* ---- ペンダントランプ ---- */
  const hangLamp = (x, y, z, scale, power) => {
    kit.put("lamp", [x, y, z], { scale, glow: 1.6, threshold: 0.4, tint: "#ffcf90" });
    kit.box([0.012, 2.6 - y - 0.28 * scale, 0.012], [x, (2.6 + y + 0.28 * scale) / 2, z], trim);
    kit.bulb([0.045 * scale], "#ffdca0", 2.4, [x, y + 0.07, z]);
    if (power) kit.light("#ffbe74", power, [x, y - 0.06, z], 6, 1.5, { shadow: power > 2 });
  };
  hangLamp(-0.55, 1.5, -1.75, 0.95, 2.4);
  hangLamp(1.5, 1.62, -3.2, 0.95, 1.6);
  hangLamp(-1.2, 1.66, -4.4, 0.9, 1.4);
  hangLamp(2.4, 1.66, -5.2, 0.9, 0);
  hangLamp(-0.2, 1.75, back + 0.6, 0.75, 1.3);
  hangLamp(1.6, 1.75, back + 0.6, 0.75, 0);
  kit.light("#ffca8c", 2.4, [0.8, 2.2, back - 0.4], 6, 1.4);
  kit.light("#ffb060", 0.9, [2.9, 1.5, -2.4], 3.5, 1.6);
  // 天井近くにたまった煙
  kit.steam({ at: [0.3, 1.5, -4.2], spread: [3.5, 4], count: 12, size: 1.2, grow: 0.8, rise: 0.4, opacity: 0.025, speed: 0.05, color: "#e0c8a0" });

  return kit.finish({ y: 0.7305, item: [-0.2, -1.24], phone: [0.3, -1.34], tray: [0.1, -1.4], chillTray: [-0.04, -1.27] });
}
