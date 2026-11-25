import * as THREE from "three";
import { createKit, seeded, some } from "./kit.js";
import { TAU, forest, ridges } from "./parts.js";

/*
 * 温泉宿の縁側（雪の庭）。縁側に腰を下ろし、お膳の灰皿で吸う。
 */

export async function engawa() {
  const kit = await createKit({
    eye: 0.8,
    models: ["toro", "pine", "rock", "bamboo", "conifer", "teaset", "zabuton", "andon", "hibachi", "geta", "shishi", "snowbush", "stones", "bridge", "pail"],
    images: ["snow", "wood_dark"],
  });
  const random = seeded(29);
  const yard = -0.5; // 庭の地面（縁側の床が 0）
  kit.sky({ top: "#0b1430", horizon: "#31548c", below: "#1a2438", glow: "#22365a", clouds: 0.8, cloudColor: "#2a3a58", cloudSpeed: 0.006 });

  /* ---- 縁側 ---- */
  const board = kit.material("wood_dark", { repeat: [3, 0.12], color: "#9a7858", roughness: 0.38, bump: 0.6 });
  for (let i = 0; i < 9; i += 1) kit.box([12, 0.05, 0.232], [0, -0.025, 0.2 - i * 0.24 + 0.0], board).position.x = (i % 2) * 0.4;
  const dark = kit.material("wood_dark", { repeat: [1, 2], color: "#5f4836", roughness: 0.55 });
  kit.box([12, 0.16, 0.1], [0, -0.1, -1.98], dark);
  for (const x of [-3.6, -1.56, 1.56, 3.6]) {
    kit.box([0.15, 3.4, 0.15], [x, 1.2, -1.86], dark);
    kit.box([0.14, 0.5, 0.14], [x, -0.28, -1.86], dark);
  }
  kit.box([12, 0.2, 0.16], [0, 2.1, -1.86], dark);
  kit.box([12, 0.1, 0.1], [0, 1.82, -1.86], dark);
  for (let i = -10; i <= 10; i += 1) kit.box([0.04, 0.2, 0.04], [i * 0.36, 1.95, -1.86], dark);
  // 軒
  kit.box([13, 0.06, 2.6], [0, 2.42, -2.2], dark, [0.2, 0, 0]);
  for (let i = -11; i <= 11; i += 1) kit.box([0.055, 0.07, 2.6], [i * 0.5, 2.36, -2.2], dark, [0.2, 0, 0]);
  kit.box([13, 0.2, 0.4], [0, 2.2, -3.4], kit.material("snow", { repeat: [5, 0.2], color: "#dfe8f6" }), [0.2, 0, 0]);
  kit.many(
    new THREE.ConeGeometry(0.018, 1, 6),
    new THREE.MeshStandardMaterial({ color: "#cfe2f6", roughness: 0.1, transparent: true, opacity: 0.75 }),
    Array.from({ length: 34 }, (_, i) => {
      const h = 0.08 + random() * 0.24;
      return { position: [-5.6 + i * 0.34 + random() * 0.1, 2.1 - h / 2, -3.56], rotation: [Math.PI, 0, 0], scale: [1, h, 1] };
    }),
  );
  // 障子（半分だけ開いている）
  const shoji = (x, z, yaw, width = 0.92) => {
    const holder = kit.add(new THREE.Group(), [x, 0, z], [0, yaw, 0]);
    const paper = kit.mesh(new THREE.PlaneGeometry(width, 1.78), new THREE.MeshStandardMaterial({ color: "#f2e8d4", emissive: "#ffcf90", emissiveIntensity: 0.32, side: THREE.DoubleSide, roughness: 1 }), [0, 0.92, 0], undefined, holder);
    paper.userData.noCast = true;
    for (const k of [-0.5, 0.5]) kit.box([0.045, 1.86, 0.035], [k * width, 0.93, 0], dark, undefined, holder);
    for (const y of [0.04, 1.82]) kit.box([width, 0.07, 0.035], [0, y, 0], dark, undefined, holder);
    for (let i = 1; i < 4; i += 1) kit.box([0.012, 1.8, 0.02], [(i / 4 - 0.5) * width, 0.92, 0], dark, undefined, holder);
    for (let i = 1; i < 6; i += 1) kit.box([width, 0.012, 0.02], [0, (i / 6) * 1.8, 0], dark, undefined, holder);
  };
  for (const side of [-1, 1]) {
    shoji(side * 2.02, -1.3, side * Math.PI / 2);
    shoji(side * 2.02, -0.35, side * Math.PI / 2);
  }

  /* ---- お膳（吸う所） ---- */
  const lacquer = kit.solid("#2a1614", { roughness: 0.24, envMapIntensity: 1.0 });
  const red = kit.solid("#a02a20", { roughness: 0.3 });
  kit.rbox([1.0, 0.03, 0.62], 0.012, [0, 0.385, -1.3], lacquer);
  for (const [w, d, x, z] of [[1.0, 0.02, 0, -1.0], [1.0, 0.02, 0, -1.6], [0.02, 0.62, -0.49, -1.3], [0.02, 0.62, 0.49, -1.3]]) kit.rbox([w, 0.045, d], 0.006, [x, 0.4, z], red);
  for (const x of [-0.44, 0.44]) for (const z of [-1.06, -1.54]) kit.rbox([0.05, 0.37, 0.05], 0.01, [x, 0.186, z], lacquer);
  kit.put("teaset", [0.24, 0.4, -1.46], { height: 0.14, yaw: -0.2 });
  kit.steam({ at: [0.34, 0.52, -1.42], spread: [0.03, 0.03], count: 5, size: 0.05, grow: 0.12, rise: 0.3, opacity: 0.09, speed: 0.25 });
  kit.put("zabuton", [-0.6, 0, -1.78], { height: 0.11, yaw: 0.15 });
  kit.put("zabuton", [0.78, 0, -1.78], { height: 0.11, yaw: -0.2 });
  kit.put("andon", [-1.2, 0, -1.6], { height: 0.56, yaw: 0.3, glow: 1.0, threshold: 0.6, tint: "#ffcf90" });
  kit.light("#ffbe78", 2.0, [-1.0, 0.5, -1.45], 4.5, 1.5, { shadow: true });
  kit.put("hibachi", [1.16, 0, -1.55], { height: 0.32, glow: 0.8, threshold: 0.6, tint: "#ff7a3a" });
  kit.bulb([0.07], "#ff5a1c", 1.3, [1.16, 0.27, -1.55]).scale.set(1.2, 0.4, 1.2);
  kit.light("#ff7a3a", 0.6, [1.16, 0.5, -1.55], 2.6, 1.6, { flicker: 0.12 });
  kit.put("pail", [1.55, 0, -1.3], { height: 0.22 });

  /* ---- 庭：地面・沓脱石・飛び石 ---- */
  const snow = kit.material("snow", { repeat: [14, 11], color: "#c3d1e8", roughness: 0.95, bump: 2.2 });
  const land = new THREE.PlaneGeometry(90, 60, 150, 100);
  land.rotateX(-Math.PI / 2);
  const position = land.attributes.position;
  const pondDepth = (x, z) => {
    const dx = (x - 0.6) / 3.3;
    const dz = (z + 6.6) / 2.0;
    const bend = Math.sin(Math.atan2(dz, dx) * 3) * 0.12;
    return 1 + bend - Math.hypot(dx, dz);
  };
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i) - 24;
    let y = Math.sin(x * 0.8 + z * 0.5) * 0.06 + Math.sin(x * 0.33 - z * 0.9) * 0.08;
    y += Math.max(0, -z - 11) * 0.11 + Math.max(0, Math.abs(x) - 6) * 0.09;
    const pond = pondDepth(x, z);
    if (pond > -0.12) y = Math.min(y, 0.06) - Math.max(0, pond + 0.12) * 0.9;
    if (z > -3.4) y = Math.min(y, 0.0);
    position.setXYZ(i, x, yard + y, z);
  }
  land.computeVertexNormals();
  kit.mesh(land, snow).userData.noCast = true;
  kit.rbox([1.5, 0.24, 0.62], 0.05, [0.1, yard + 0.12, -2.55], kit.solid("#5a5f66", { roughness: 0.9 }));
  kit.put("geta", [0.12, yard + 0.24, -2.5], { height: 0.09, yaw: 3.3 });
  kit.put("geta", [0.46, yard + 0.24, -2.55], { height: 0.09, yaw: 2.9 });
  for (const [x, z, yaw] of [[-0.3, -3.4, 0.2], [-0.95, -4.1, 0.7], [-1.9, -4.6, 1.1], [-2.8, -5.2, 0.6], [-3.4, -6.2, 0.2]]) kit.put("stones", [x, yard - 0.03, z], { height: 0.11, yaw });

  /* ---- 池・橋・湯気 ---- */
  kit.water({ size: [9, 6], y: yard - 0.14, position: [0.6, -6.6], deep: "#06141f", shallow: "#34547a", sparkle: "#cfe2f5", glitter: 0.1, scale: 1.3, lights: [[[-2.6, 0.5, -5.4], "#ffb866"], [[3.6, 1.2, -8.8], "#ff9a50"]] });
  kit.steam({ at: [0.6, yard - 0.1, -6.6], spread: [5.4, 3], count: 18, size: 0.7, grow: 1.7, rise: 1.9, opacity: 0.1, speed: 0.14, color: "#cfdcf0" });
  kit.put("bridge", [3.5, yard - 0.02, -7.2], { height: 0.95, yaw: 0.5 });
  for (let i = 0; i < 22; i += 1) {
    const a = (i / 22) * TAU;
    const r = 1.08 - Math.sin(a * 3) * 0.1;
    const x = 0.6 + Math.cos(a) * 3.3 * r;
    const z = -6.6 + Math.sin(a) * 2.0 * r;
    kit.put("rock", [x, yard - 0.16, z], { height: 0.3 + random() * 0.38, yaw: random() * TAU, color: i % 3 ? "#9aa2ae" : "#c4ccd8" });
  }

  /* ---- 灯籠・木・植え込み ---- */
  kit.put("toro", [-2.6, yard, -5.6], { yaw: 0.3, height: 1.45, glow: 0.7, threshold: 0.85, tint: "#ffb860" });
  kit.light("#ffb866", 2.4, [-2.45, yard + 1.02, -5.15], 6, 1.5, { shadow: true });
  kit.put("toro", [4.3, yard + 0.1, -9.6], { yaw: -0.4, height: 1.5, glow: 0.7, threshold: 0.85, tint: "#ffb860" });
  kit.light("#ffb866", 2.0, [4.1, yard + 1.1, -9.1], 6, 1.5);
  kit.put("pine", [-4.4, yard, -7.2], { yaw: 2.4, height: 4.2 });
  kit.put("pine", [4.6, yard, -6.0], { yaw: 0.6, height: 3.4 });
  kit.put("pine", [-1.2, yard + 0.1, -10.8], { yaw: 1.4, height: 3.6 });
  kit.put("pine", [7.4, yard + 0.3, -10.5], { yaw: 3.0, height: 4.6 });
  kit.put("pine", [-7.6, yard + 0.2, -9.5], { yaw: 4.4, height: 4.8 });
  kit.put("shishi", [2.5, yard, -4.2], { height: 0.78, yaw: -0.4 });
  const bushes = [[-3.5, -4.4, 0.6], [-4.3, -5.4, 0.8], [-1.6, -5.9, 0.45], [-3.3, -6.9, 0.55], [-5.6, -6.4, 0.9], [3.6, -4.8, 0.7], [4.6, -5.0, 0.8], [2.9, -3.8, 0.4], [5.8, -7.6, 1.0], [-0.6, -9.4, 0.7], [1.4, -9.6, 0.8], [2.6, -9.2, 0.6], [-2.4, -9.2, 0.8], [0.4, -10.2, 0.9], [5.6, -10.6, 1.1], [-6.0, -9.0, 1.0], [-3.6, -10.4, 0.9], [3.6, -11.2, 1.0], [-5.0, -3.6, 0.6], [5.6, -3.8, 0.7]];
  kit.scatter("snowbush", bushes.map(([x, z, height]) => ({ position: [x, yard - 0.04 + Math.max(0, -z - 11) * 0.11, z], height, yaw: random() * TAU })));
  kit.scatter("bamboo", Array.from({ length: some(16) }, (_, i) => ({ position: [1.4 + (i % 8) * 1.0 + random() * 0.6, yard + 0.2, -12.2 - Math.floor(i / 8) * 1.4 - random()], yaw: random() * TAU, scale: 1.0 + random() * 0.5 })), { color: "#f0fff0" });
  kit.scatter("conifer", Array.from({ length: some(14) }, () => ({ position: [-22 + random() * 44, yard + 0.8, -18 - random() * 7], yaw: random() * TAU, scale: 0.8 + random() * 0.4 })), { color: "#8fa2b8" });
  forest(kit, { count: 240, x: [-70, 70], z: [-54, -26], y: yard + 1, height: [7, 15], color: "#2a3a52", seed: 9, snow: "#7f93b4" });
  ridges(kit, [{ z: -120, color: "#22344f", height: 34, seed: 4 }]);

  /* ---- 竹垣 ---- */
  const bamboo = kit.solid("#a08a58", { roughness: 0.6 });
  kit.many(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), bamboo, Array.from({ length: 64 }, (_, i) => ({ position: [-8.6 + i * 0.12, yard + 0.75 + (random() - 0.5) * 0.05, -11.6], rotation: [0, random() * 6, (random() - 0.5) * 0.03], color: new THREE.Color("#b09a66").offsetHSL(0, 0, (random() - 0.5) * 0.1) })));
  for (const y of [0.4, 0.9, 1.35]) kit.tube([[-8.7, yard + y, -11.54], [-0.9, yard + y, -11.54]], 0.03, bamboo, { segments: 2 });
  kit.box([7.9, 0.07, 0.16], [-4.8, yard + 1.53, -11.6], kit.material("snow", { repeat: [3, 0.1], color: "#dfe8f6" }));
  // 置き行灯（雪に埋まった灯り）
  for (const [x, z] of [[-1.3, -3.5], [1.6, -3.6], [-3.9, -5.0]]) {
    kit.rbox([0.16, 0.26, 0.16], 0.015, [x, yard + 0.12, z], kit.solid("#3a2a1e"));
    kit.bulb([0.13, 0.17, 0.165], "#ffc078", 1.2, [x, yard + 0.13, z]);
    kit.light("#ffb060", 0.5, [x, yard + 0.35, z + 0.15], 2.2, 1.7);
  }
  kit.particles({ count: 620, area: { x: [-9, 9], y: [yard, 5], z: [-14, -2.3] }, color: "#eef4ff", size: 0.02, fall: 0.5, sway: 0.25 });

  return kit.finish({ y: 0.4, item: [-0.22, -1.2], phone: [0.3, -1.2], tray: [-0.02, -1.42], chillTray: [-0.06, -1.28] });
}
