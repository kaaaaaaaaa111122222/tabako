import * as THREE from "three";
import { createKit, seeded, some } from "./kit.js";
import { TAU, antenna, can, cottages, powerPole, slats } from "./parts.js";

/*
 * マンションのベランダ（夕暮れの街）。立って、手すりに掛けた小さなテーブルで吸う。
 */

export async function balcony() {
  const kit = await createKit({
    eye: 1.5,
    models: ["mixed", "house", "tree", "car", "flowers", "potplant", "laundry", "palm"],
    images: ["facade", "facade2", "concrete", "asphalt", "wood_plank"],
  });
  const random = seeded(5);
  const base = -17;
  kit.sky({ top: "#232a6a", horizon: "#c07a90", below: "#2a2238", glow: "#5a3424", stars: 0.15, clouds: 0.65, cloudColor: "#6a4a80", height: 0.4, sun: [0.12, -0.03, -1], sunColor: "#8a4630" });
  city(kit, base, random);

  /* ---- ベランダ ---- */
  const steel = kit.solid("#7d8288", { metalness: 0.75, roughness: 0.38 });
  kit.ground([9, 3.4], 0, kit.material("concrete", { repeat: [4, 1.5], color: "#8b8780", bump: 0.4 }), [0, -0.1]);
  kit.box([9, 0.14, 0.2], [0, 0.07, -1.58], kit.material("concrete", { repeat: [4, 0.1], color: "#9a968f" }));
  kit.tube([[-4.4, 1.2, -1.56], [4.4, 1.2, -1.56]], 0.03, steel, { segments: 4, radial: 12 });
  kit.tube([[-4.4, 0.2, -1.56], [4.4, 0.2, -1.56]], 0.018, steel, { segments: 4 });
  kit.tube([[-4.4, 1.08, -1.56], [4.4, 1.08, -1.56]], 0.014, steel, { segments: 4 });
  kit.many(
    new THREE.CylinderGeometry(0.009, 0.009, 0.9, 8),
    steel,
    Array.from({ length: 72 }, (_, i) => ({ position: [-4.3 + i * 0.12, 0.64, -1.56] })),
  );
  for (const x of [-2.6, -0.9, 0.9, 2.6]) kit.box([0.05, 1.1, 0.05], [x, 0.62, -1.56], steel);

  // 手すりに掛けたテーブル
  const board = kit.material("wood_plank", { repeat: [0.9, 0.12], color: "#c59a6c", roughness: 0.6, bump: 0.6 });
  slats(kit, { width: 1.0, depth: 0.52, y: 1.1, z0: -0.99, count: 6, mat: board });
  const iron = kit.solid("#2b2d30", { metalness: 0.5, roughness: 0.5 });
  for (const x of [-0.42, 0.42]) {
    kit.box([0.03, 0.03, 0.54], [x, 1.063, -1.26], iron);
    kit.tube([[x, 1.06, -1.5], [x, 1.24, -1.5], [x, 1.24, -1.61], [x, 1.14, -1.61]], 0.01, iron);
    kit.tube([[x, 1.05, -1.05], [x, 0.8, -1.5]], 0.012, iron, { segments: 2 });
  }
  can(kit, [-0.4, 1.1, -1.4], { color: "#23384a", band: "#e0a64a" });
  kit.put("potplant", [0.42, 1.1, -1.42], { height: 0.2, yaw: 1 });

  // 花・鉢植え・洗濯物
  kit.put("flowers", [-0.92, 1.02, -1.72], { height: 0.36, yaw: 0.04 });
  kit.put("flowers", [1.02, 1.0, -1.72], { height: 0.36, yaw: 3.1, color: "#ffe2ec" });
  kit.put("flowers", [-2.1, 1.02, -1.72], { height: 0.36 });
  kit.put("palm", [-1.36, 0.18, -1.2], { height: 1.55, yaw: 0.6 });
  kit.put("potplant", [1.5, 0.35, -1.3], { height: 0.85, yaw: 2 });
  const pole = kit.solid("#c8ccd0", { metalness: 0.6, roughness: 0.3 });
  kit.tube([[-4, 2.21, -1.42], [4, 2.21, -1.42]], 0.016, pole, { segments: 2 });
  kit.put("laundry", [1.16, 1.58, -1.42], { height: 0.64, yaw: 0.05 });
  // となりとの仕切り板
  const partition = kit.solid("#b9b7b2", { roughness: 0.7 });
  for (const side of [-1, 1]) {
    kit.box([0.03, 1.7, 1.6], [side * 1.62, 1.05, -0.75], partition);
    kit.box([0.06, 2.6, 0.06], [side * 1.62, 1.3, -1.52], steel);
  }
  kit.ground([9, 3.4], 2.5, kit.material("concrete", { repeat: [4, 1.5], color: "#7b766f" }), [0, 0]).rotation.x = Math.PI / 2;
  kit.box([9, 0.24, 0.14], [0, 2.5, -1.75], kit.material("concrete", { repeat: [4, 0.1], color: "#8d8983" }));

  // 風鈴：風の向きに短冊がなびく
  const bell = kit.add(new THREE.Group(), [-0.62, 2.06, -1.35]);
  const glass = new THREE.MeshStandardMaterial({ color: "#bfe4ea", transparent: true, opacity: 0.45, roughness: 0.08, side: THREE.DoubleSide });
  kit.mesh(new THREE.SphereGeometry(0.05, 20, 14, 0, TAU, 0, 2.2), glass, [0, -0.1, 0], undefined, bell);
  kit.cylinder(0.002, 0.002, 0.46, [0, -0.1, 0], kit.solid("#f2efe6"), undefined, bell, 6);
  const strip = kit.panel(0.05, 0.16, [0, -0.36, 0], undefined, (ctx, w, h) => {
    ctx.fillStyle = "#f4efe0";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#3a6a9c";
    ctx.lineWidth = w * 0.09;
    for (const y of [0.35, 0.5, 0.65]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.15, h * y);
      ctx.bezierCurveTo(w * 0.4, h * (y - 0.08), w * 0.6, h * (y + 0.08), w * 0.85, h * y);
      ctx.stroke();
    }
  }, { parent: bell, side: THREE.DoubleSide, pixels: 128 });
  kit.onUpdate((delta, time, wind) => {
    bell.rotation.z = wind * 0.22 + Math.sin(time * 2.3) * 0.05 * (1 + Math.abs(wind));
    strip.rotation.y = Math.sin(time * 3.1) * 0.7;
  });
  // 部屋からもれる灯り
  kit.light("#ffcf98", 2.6, [0.6, 2.2, 0.3], 5, 1.5);

  return kit.finish({ y: 1.1, item: [-0.2, -1.2], phone: [0.33, -1.2], tray: [0.12, -1.34], chillTray: [-0.06, -1.24] });
}

function city(kit, base, random) {
  kit.ground([900, 700], base, kit.material("asphalt", { repeat: [70, 54], color: "#34343f" }), [0, -258]);
  // 区画：3 軒ごとに道が通る
  const near = [];
  const far = [];
  const trees = [];
  const blocks = [];
  const lamps = [];
  for (let gz = 0; gz < 13; gz += 1) {
    const z = -24 - gz * 11.5 - Math.floor(gz / 2) * 6;
    for (let gx = -13; gx <= 13; gx += 1) {
      const x = gx * 11 + Math.floor((gx + 60) / 3) * 5 - 96 + (random() - 0.5) * 2;
      if (Math.abs(x) > 40 + gz * 12) continue;
      const roll = random();
      const yaw = Math.floor(random() * 4) * (Math.PI / 2) + (random() - 0.5) * 0.06;
      if (roll < 0.14) {
        for (let k = 0; k < 3; k += 1) trees.push({ position: [x - 3 + random() * 6, base, z - 3 + random() * 6], yaw: random() * TAU, scale: 0.7 + random() * 0.5 });
      } else if (gz < 5 && roll < 0.62) near.push({ position: [x, base, z], yaw, scale: 0.95 + random() * 0.2 });
      else if (roll < 0.74) far.push({ position: [x, base, z], yaw, scale: 0.95 + random() * 0.3 });
      else blocks.push([x, z]);
      if (gx % 3 === 0) lamps.push([x + 6.5, base + 5, z + 6]);
    }
  }
  kit.scatter("house", near.slice(0, some(40)), { glow: 1.0, threshold: 0.72, tint: "#ffd29a" });
  cottages(kit, [...far, ...near.slice(some(40))], { walls: ["#7d7684", "#675f70", "#8a7f86"], lit: 0.55, seed: 3 });
  kit.scatter("tree", trees.slice(0, some(60)), { color: "#5f6a68" });
  kit.scatter("mixed", blocks.filter((_, i) => i % 3 === 0).slice(0, some(16)).map(([x, z]) => ({ position: [x, base, z], yaw: Math.floor(random() * 4) * (Math.PI / 2), scale: 0.7 + random() * 0.25 })), { glow: 1.1, threshold: 0.6, tint: "#ffd29a" });
  kit.towers({ count: 60, area: { x: [-120, 120], z: [-170, -44] }, base, height: [5, 13], width: [8, 13], image: "facade", seed: 7, glow: 0.95, gain: 1.8 });
  // すぐ近くのマンション
  kit.towers({ count: 2, kinds: 1, area: { x: [30, 36], z: [-46, -40] }, base, height: [26, 26], width: [13, 15], image: "facade", seed: 4, glow: 1.1, gain: 1.8 });
  kit.towers({ count: 1, kinds: 1, area: { x: [-36, -32], z: [-60, -56] }, base, height: [24, 24], width: [13, 15], image: "facade", seed: 9, glow: 1.1, gain: 1.8 });
  kit.towers({ count: 240, area: { x: [-340, 340], z: [-330, -150] }, base, height: [8, 24], width: [12, 24], image: "facade", seed: 11, glow: 1.1, gain: 1.8 });
  kit.towers({ count: 90, area: { x: [-330, 330], z: [-408, -240] }, base, height: [18, 62], width: [14, 24], image: "facade2", seed: 23, glow: 1.0, gain: 1.4 });

  // 大通りと車の灯り、街灯
  kit.box([7, 0.06, 380], [9, base + 0.05, -212], kit.material("asphalt", { repeat: [1, 40], color: "#4a4650" }));
  const cars = [];
  const heads = [];
  const tails = [];
  for (let i = 0; i < 60; i += 1) {
    const z = -30 - i * 5.4 - random() * 3;
    const side = i % 2 ? 1 : -1;
    if (i < 14) cars.push({ position: [9 + side * 1.7, base + 0.1, z], yaw: side > 0 ? Math.PI : 0 });
    (side < 0 ? heads : tails).push([9 + side * 1.7 - 0.5, base + 0.8, z + 2], [9 + side * 1.7 + 0.5, base + 0.8, z + 2]);
    lamps.push([9 + (i % 2 ? 4.4 : -4.4), base + 6, -26 - i * 6]);
  }
  kit.scatter("car", cars, { color: "#b9b3c0" });
  kit.dots(heads, "#ffe6c0", 1.1);
  kit.dots(tails, "#ff4a36", 0.95);
  for (let i = 0; i < 160; i += 1) lamps.push([-160 + random() * 320, base + 4 + random() * 4, -60 - random() * 260]);
  kit.dots(lamps, "#ffc078", 1.15);
  const poles = [[-9, -30], [-11, -56], [-13, -84], [-15, -114]].map(([x, z]) => powerPole(kit, x, z, 10, base));
  kit.wires(poles, 5);
  const cross = [[-9, -30], [14, -34], [38, -38]].map(([x, z]) => [x, base + 9.2, z]);
  kit.wires(cross, 3);
  // 屋上のアンテナ
  for (const [x, y, z] of [[-18, -10.5, -30], [17, -10.4, -36], [-4, -10.6, -42]]) antenna(kit, [x, y, z], { yaw: random() * 3, height: 2.6 });
  const beacons = kit.dots([[-60, 58, -308], [40, 64, -338], [120, 46, -288], [-150, 40, -330]], "#ff3a2c", 3.0);
  kit.onUpdate((delta, time) => {
    beacons.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(time * 1.7)) ** 2;
  });
}
