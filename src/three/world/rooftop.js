import * as THREE from "three";
import { createKit, seeded, wet } from "./kit.js";
import { antenna, can, slats } from "./parts.js";

/*
 * ビルの屋上（風の強い夜）。パイプ椅子に座り、ビールケースに板を渡した机で吸う。
 */

// 大きな換気・冷却の箱（横縞の羽板と、上の丸い吹き出し口）
function cooling(kit, position, yaw) {
  const holder = kit.add(new THREE.Group(), position, [0, yaw, 0]);
  const shell = kit.solid("#8e959b", { metalness: 0.3, roughness: 0.6 });
  const dark = kit.solid("#2a2e33", { roughness: 0.8 });
  kit.rbox([1.7, 1.25, 1.2], 0.02, [0, 0.78, 0], shell, undefined, holder);
  kit.box([1.5, 0.9, 1.22], [0, 0.8, 0], dark, undefined, holder);
  for (let i = 0; i < 9; i += 1) kit.box([1.5, 0.05, 0.05], [0, 0.4 + i * 0.1, 0.62], shell, [0.5, 0, 0], holder);
  kit.cylinder(0.5, 0.52, 0.24, [0, 1.5, 0], shell, undefined, holder, 32);
  kit.cylinder(0.44, 0.44, 0.02, [0, 1.625, 0], dark, undefined, holder, 32);
  for (const x of [-0.75, 0.75]) kit.box([0.14, 0.16, 1.2], [x, 0.08, 0], dark, undefined, holder);
}

export async function rooftop() {
  const kit = await createKit({
    eye: 1.15,
    models: ["tank", "ac", "duct", "crates", "redcan", "bench", "dish", "pipechair", "fan", "stool", "bluebucket", "potplant", "cone"],
    images: ["roofdeck", "brickwall", "concrete", "facade", "facade2", "asphalt", "wood_plank"],
  });
  const random = seeded(31);
  const base = -34;
  kit.sky({ top: "#0a1230", horizon: "#5a88c8", below: "#0c1220", glow: "#2c4a74", clouds: 0.95, cloudColor: "#16233e", cloudSpeed: 0.03, height: 0.42 });
  kit.ground([30, 24], 0, wet(kit.material("roofdeck", { repeat: [8, 6], color: "#8b9098", roughness: 0.8, bump: 0.8 }), { scale: 0.55, amount: 0.42, dark: 0.4 }), [0, -8]);

  /* ---- 机と、座っている所 ---- */
  kit.put("crates", [0, 0, -1.42], { height: 0.72, yaw: 0.03 });
  slats(kit, { width: 1.36, depth: 0.78, y: 0.75, x: 0.02, z0: -1.0, count: 5, thickness: 0.03, mat: kit.material("wood_plank", { repeat: [1, 0.14], color: "#8d7e70", roughness: 0.85, bump: 0.8 }) });
  can(kit, [-0.46, 0.75, -1.56], { color: "#2a2d33", band: "#b9bec4" });
  can(kit, [0.5, 0.75, -1.62], { color: "#6d2a1e", band: "#d8b26a" });
  kit.put("pipechair", [-1.35, 0, -2.5], { yaw: 0.9 });
  kit.put("pipechair", [2.05, 0, -3.3], { yaw: -0.8 });
  kit.put("redcan", [1.16, 0, -2.75], { height: 0.46, yaw: 0.6 });
  kit.steam({ at: [1.16, 0.46, -2.75], spread: [0.1, 0.1], count: 5, size: 0.06, grow: 0.3, rise: 0.8, opacity: 0.1, speed: 0.16, color: "#aab4c4" });
  kit.put("stool", [-2.3, 0, -3.5], { height: 0.45 });
  can(kit, [-2.3, 0.45, -3.5], { color: "#23384a", band: "#e0a64a" });
  kit.put("bench", [3.2, 0, -4.4], { yaw: -0.5 });
  kit.put("bluebucket", [3.0, 0, -3.4], { height: 0.3 });
  kit.put("potplant", [-2.9, 0, -3.9], { height: 0.6, color: "#8a9a8a" });
  kit.put("potplant", [-3.5, 0, -4.2], { height: 0.8, color: "#7f907f", yaw: 2 });

  /* ---- ふちの壁と金網 ---- */
  const edge = kit.material("brickwall", { repeat: [9, 0.5], color: "#83888f", bump: 1 });
  const cap = kit.material("concrete", { repeat: [8, 0.1], color: "#7d8288" });
  kit.box([30, 0.75, 0.3], [0, 0.37, -17], edge);
  kit.box([30, 0.1, 0.4], [0, 0.8, -17], cap);
  for (const side of [-1, 1]) {
    kit.box([0.3, 0.75, 24], [side * 13, 0.37, -8], edge);
    kit.box([0.4, 0.1, 24], [side * 13, 0.8, -8], cap);
    kit.fence(24, 1.5, [side * 12.9, 0.8, -8], Math.PI / 2);
  }
  kit.fence(26, 1.5, [0, 0.8, -16.9], 0);

  /* ---- 左：一段高い機械置き場と水槽 ---- */
  const block = kit.material("brickwall", { repeat: [3, 1], color: "#868b92", bump: 1 });
  kit.box([4.6, 1.3, 11], [-8.8, 0.65, -11.4], block);
  kit.box([4.8, 0.1, 11.2], [-8.8, 1.32, -11.4], cap);
  kit.put("tank", [-8.8, 1.36, -9.2], { yaw: 0.5, scale: 0.8 });
  kit.put("tank", [-8.8, 1.36, -12.0], { yaw: 2.0, scale: 0.95 });
  kit.put("tank", [-8.0, 1.36, -14.8], { yaw: 1.0, scale: 0.8 });
  kit.put("dish", [-7.2, 1.36, -7.0], { yaw: 0.6, height: 1.5 });
  antenna(kit, [-9.6, 1.36, -7.2], { height: 3.2, yaw: 0.6 });
  antenna(kit, [-6.9, 1.36, -13.2], { height: 2.8, yaw: 1.4 });
  kit.scatter("ac", [0, 1, 2, 3].map((i) => ({ position: [-6.1, 0.15, -7.0 - i * 2.3], yaw: Math.PI / 2 + (random() - 0.5) * 0.1, scale: 1.05 })));
  // はしご
  const metal = kit.solid("#7a8086", { metalness: 0.6, roughness: 0.45 });
  for (const x of [-8.0, -7.6]) kit.cylinder(0.02, 0.02, 2.1, [x, 1.05, -5.86], metal, undefined, undefined, 8);
  for (let i = 0; i < 8; i += 1) kit.cylinder(0.014, 0.014, 0.4, [-7.8, 0.2 + i * 0.26, -5.86], metal, [0, 0, Math.PI / 2], undefined, 8);

  /* ---- 中央・右：コンクリートの台、換気扇、室外機、塔屋 ---- */
  kit.box([2.6, 1.0, 1.6], [-1.6, 0.5, -11.6], block);
  kit.box([2.8, 0.1, 1.8], [-1.6, 1.04, -11.6], cap);
  kit.put("duct", [-1.9, 1.08, -11.6], { yaw: 1.0, scale: 0.8 });
  cooling(kit, [2.5, 0, -9.4], 0.25);
  cooling(kit, [4.7, 0, -10.8], 0.1);
  kit.put("fan", [3.4, 0, -14.2], { height: 0.9, yaw: -0.2 });
  kit.scatter("duct", [{ position: [0.6, 0, -14.6], yaw: 0.8, scale: 1.1 }, { position: [5.2, 0, -14.4], yaw: 2.4, scale: 1.3 }, { position: [-3.6, 0, -15.0], yaw: 2, scale: 0.9 }]);
  kit.scatter("ac", [
    { position: [6.4, 0.15, -8.4], yaw: -0.5, scale: 1.1 },
    { position: [7.6, 0.15, -9.0], yaw: -0.5, scale: 1.1 },
    { position: [6.2, 0.15, -11.6], yaw: -0.2, scale: 1.1 },
    { position: [7.4, 0.15, -11.8], yaw: -0.2, scale: 1.1 },
    { position: [-3.0, 0.15, -9.0], yaw: 0.6, scale: 1.0 },
  ]);
  const house = kit.material("brickwall", { repeat: [2, 1.6], color: "#8b9096", bump: 1 });
  kit.box([4.4, 3.2, 4.6], [10.2, 1.6, -11.2], house);
  kit.box([4.8, 0.16, 5.0], [10.2, 3.26, -11.2], cap);
  kit.box([0.06, 2.0, 0.95], [7.97, 1.0, -10.2], kit.solid("#43606c", { metalness: 0.4, roughness: 0.6 }));
  kit.box([0.1, 0.12, 0.34], [7.94, 2.4, -10.2], kit.solid("#2a2d30"));
  kit.bulb([0.09, 0.07, 0.28], "#fff0cf", 2.6, [7.92, 2.35, -10.2]);
  kit.light("#ffd7a0", 7, [7.3, 2.2, -10.1], 9, 1.6, { shadow: true });
  kit.put("dish", [9.2, 3.3, -9.8], { yaw: -0.4, height: 1.8 });
  kit.put("dish", [11.0, 3.3, -10.2], { yaw: 0.2, height: 1.5 });
  antenna(kit, [10.4, 3.3, -12.4], { height: 3, yaw: 2.2 });
  kit.put("tank", [10.8, 3.3, -12.8], { scale: 0.6 });
  // 机の上の裸電球（物干し竿にぶら下げた工事用の灯り）
  kit.hang([-5.0, 2.6, -5.2], [4.4, 2.5, -5.2], 0.55, 0.008, kit.solid("#101216"));
  for (const x of [-5.0, 4.4]) {
    kit.cylinder(0.025, 0.03, 2.6, [x, 1.3, -5.2], metal, undefined, undefined, 10);
    kit.box([0.4, 0.12, 0.4], [x, 0.06, -5.2], cap);
  }
  for (const [x, y] of [[-2.8, 2.14], [-0.3, 1.98], [2.2, 2.1]]) {
    kit.cylinder(0.03, 0.02, 0.08, [x, y + 0.03, -5.2], kit.solid("#14161a"), undefined, undefined, 10);
    kit.bulb([0.05], "#ffd79a", 2.4, [x, y - 0.06, -5.2]);
  }
  kit.light("#ffcf90", 2.6, [-0.3, 1.8, -4.9], 8, 1.4);

  /* ---- 床の配管とケーブル ---- */
  for (const points of [
    [[-6, 0.1, -4.4], [-4.4, 0.1, -5.0], [-4.2, 0.1, -9], [-3.6, 0.1, -14]],
    [[-6, 0.22, -4.6], [-4.6, 0.22, -5.4], [-4.5, 0.22, -10], [-4.0, 0.22, -15]],
    [[7.9, 0.1, -7.2], [4.8, 0.1, -7.4], [2.6, 0.1, -10], [1.6, 0.1, -16.5]],
  ]) kit.tube(points, 0.06, metal, { segments: 40 });
  kit.tube([[4.4, 0.03, -5.2], [2.4, 0.02, -5.8], [0.4, 0.02, -5.4], [-1.6, 0.02, -6.4], [-5.2, 0.03, -6.2]], 0.014, kit.solid("#16181c"), { segments: 60 });
  for (let i = 0; i < 9; i += 1) kit.box([0.22, 0.08, 0.14], [-4.35 + i * 0.02, 0.04, -5.4 - i * 1.15], cap);
  kit.put("cone", [5.6, 0, -6.2], { height: 0.6 });
  kit.pebbles({ count: 160, x: [-6, 8], z: [-14, -2.2], size: [0.008, 0.025], color: ["#3a3d42", "#6a6d72"], seed: 5 });

  /* ---- 周りの街 ---- */
  kit.ground([900, 700], base, kit.material("asphalt", { repeat: [60, 46], color: "#23262e" }), [0, -290]);
  kit.towers({ count: 10, kinds: 3, area: { x: [-50, -26], z: [-74, -34] }, base, height: [22, 37], width: [12, 18], image: "facade", seed: 61, glow: 1.2, gain: 1.7 });
  kit.towers({ count: 10, kinds: 3, area: { x: [24, 52], z: [-78, -34] }, base, height: [24, 46], width: [12, 18], image: "facade", seed: 67, glow: 1.2, gain: 1.7 });
  kit.towers({ count: 40, area: { x: [-150, 150], z: [-140, -62] }, base, height: [20, 38], width: [14, 24], image: "facade", seed: 43, glow: 1.2, gain: 1.6 });
  kit.towers({ count: 60, area: { x: [-260, 260], z: [-270, -135] }, base, height: [26, 66], width: [16, 30], image: "facade2", seed: 41, glow: 1.2, gain: 1.3 });
  kit.towers({ count: 90, area: { x: [-340, 340], z: [-400, -250] }, base, height: [28, 96], width: [18, 34], image: "facade2", seed: 47, glow: 1.1, gain: 1.3 });
  // 屋上の看板（光る板。文字なし）
  for (const [x, y, z, w, h, color] of [[-30, 8, -60, 12, 4, "#d8463a"], [34, 12, -84, 14, 5, "#3a8fd8"], [8, 4, -118, 16, 5, "#e0b23a"]]) {
    kit.box([w + 0.6, h + 0.6, 0.5], [x, y, z - 0.4], kit.solid("#1a1d22"));
    kit.panel(w, h, [x, y, z], undefined, (ctx, cw, ch) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#fff4dc";
      ctx.beginPath();
      ctx.arc(cw * 0.2, ch / 2, ch * 0.3, 0, 7);
      ctx.fill();
      ctx.fillRect(cw * 0.36, ch * 0.3, cw * 0.5, ch * 0.16);
      ctx.fillRect(cw * 0.36, ch * 0.58, cw * 0.36, ch * 0.1);
    }, { glow: 1.1 });
  }
  const red = kit.dots([[-34, 22, -100], [38, 26, -112], [6, 48, -198], [-92, 44, -188], [96, 56, -228], [-150, 70, -308], [60, 78, -328]], "#ff3226", 2.4);
  kit.onUpdate((delta, time) => {
    red.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(time * 1.9)) ** 2;
  });
  return kit.finish({ y: 0.75, item: [-0.2, -1.26], phone: [0.34, -1.28], tray: [0.1, -1.38], chillTray: [-0.05, -1.28] });
}
