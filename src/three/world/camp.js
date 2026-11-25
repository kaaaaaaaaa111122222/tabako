import * as THREE from "three";
import { createKit, seeded } from "./kit.js";
import { TAU, forest, ridges, stringLights, trunk } from "./parts.js";

/*
 * キャンプ場（湖と焚き火）。焚き火の前の低い椅子に座り、折りたたみの小さな机で吸う。
 */

export async function camp() {
  const kit = await createKit({
    eye: 1.0,
    models: ["tent", "logs", "conifer", "campchair", "lantern", "rock", "firewood", "cooler", "kettle", "mug", "logseat", "camptable", "stump", "backpack", "fern", "canoe", "tripod", "sandals"],
    images: ["forest", "bark", "wood_plank"],
  });
  const random = seeded(17);
  kit.sky({ top: "#040818", horizon: "#1a2c52", below: "#0a1020", glow: "#142238", stars: 1.2, milky: 1.2, clouds: 0, cloudColor: "#18233c", height: 0.5 });

  // 地面：焚き火のまわりは平ら、湖へ向けて少し下がる
  const soil = kit.material("forest", { repeat: [26, 14], color: "#9a9086", bump: 2 });
  const land = new THREE.PlaneGeometry(90, 40, 120, 60);
  land.rotateX(-Math.PI / 2);
  const position = land.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i) - 10;
    const shore = -13.5 + Math.sin(x * 0.35) * 0.8 + Math.sin(x * 0.11 + 2) * 1.6;
    let y = Math.sin(x * 0.9 + z * 0.4) * 0.03 + Math.sin(x * 0.37 - z * 0.8) * 0.05;
    y *= Math.min(1, Math.hypot(x, z + 2.5) / 5);
    y += Math.max(0, Math.abs(x) - 7) * 0.1;
    if (z < shore) y -= (shore - z) * 0.22;
    position.setXYZ(i, x, y, z);
  }
  land.computeVertexNormals();
  kit.mesh(land, soil).userData.noCast = true;
  kit.water({ size: [260, 150], y: -0.42, position: [0, -88], deep: "#071022", shallow: "#34568f", sparkle: "#9fb6e0", glitter: 0.14, scale: 0.6, lights: [[[-0.9, 0.9, -3.1], "#ff8a3a"], [[2.6, 1.2, -5.2], "#ffb868"]] });
  ridges(kit, [{ z: -230, color: "#1b2a4a", height: 46, seed: 3 }, { z: -200, color: "#121f38", height: 28, seed: 8 }]);

  /* ---- 手前の机（吸う所） ---- */
  kit.put("camptable", [0.34, 0, -1.32], { height: 0.6, yaw: -0.03 });
  kit.put("mug", [-0.04, 0.6, -1.54], { height: 0.095, yaw: 0.6 });
  kit.steam({ at: [-0.04, 0.7, -1.54], spread: [0.03, 0.03], count: 5, size: 0.05, grow: 0.12, rise: 0.3, opacity: 0.08, speed: 0.25 });
  kit.put("lantern", [0.66, 0.6, -1.52], { height: 0.24, glow: 1.3, threshold: 0.55, tint: "#ffcf90", yaw: 0.4 });
  kit.light("#ffc27a", 0.6, [0.66, 0.8, -1.42], 2.4, 1.6);

  /* ---- 焚き火 ---- */
  const fire = [-0.86, 0.0, -2.75];
  // 焚き火台（六角の鉢と、四本の脚）
  const iron = kit.solid("#26282a", { metalness: 0.7, roughness: 0.5 });
  const bowl = kit.mesh(new THREE.CylinderGeometry(0.44, 0.22, 0.2, 6, 1, true), kit.solid("#2e2f30", { metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide }), [fire[0], 0.34, fire[2]], [0, 0.3, 0]);
  bowl.userData.noCast = true;
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * TAU + 0.6;
    kit.tube([[fire[0] + Math.cos(a) * 0.42, 0, fire[2] + Math.sin(a) * 0.42], [fire[0] - Math.cos(a) * 0.12, 0.36, fire[2] - Math.sin(a) * 0.12]], 0.014, iron, { segments: 2 });
  }
  kit.put("logs", [fire[0], 0.32, fire[2]], { scale: 0.56, glow: 1.6, threshold: 0.5, tint: "#ff8a3c" }).userData.noCast = true;
  for (let i = 0; i < 13; i += 1) {
    const a = (i / 13) * TAU + 0.2;
    kit.put("rock", [fire[0] + Math.cos(a) * 0.82, -0.05, fire[2] + Math.sin(a) * 0.74], { height: 0.16 + random() * 0.1, yaw: random() * TAU, color: "#6e665e" });
  }
  kit.fire([fire[0], 0.36, fire[2]], { width: 0.92, height: 0.95, layers: 4 });
  kit.cylinder(0.62, 0.62, 0.012, [fire[0], 0.015, fire[2]], kit.solid("#171412"), undefined, undefined, 32);
  kit.bulb([0.17], "#ff5a1c", 1.6, [fire[0], 0.37, fire[2]]).scale.set(1.3, 0.35, 1.3);
  kit.light("#ff8a3c", 15, [fire[0] + 0.05, 0.85, fire[2] + 0.1], 15, 1.5, { shadow: true, flicker: 0.12 });
  kit.particles({ count: 40, area: { x: [-1.4, -0.4], y: [0.5, 3.4], z: [-3.1, -2.4] }, color: "#ff9a48", size: 0.02, fall: -0.7, sway: 0.35 });
  kit.steam({ at: [fire[0], 1.2, fire[2]], spread: [0.3, 0.2], count: 10, size: 0.35, grow: 1.2, rise: 2.6, opacity: 0.05, speed: 0.16, color: "#8a8078" });
  kit.put("tripod", [-3.7, 0, -6.2], { height: 1.4, yaw: 0.5 });
  kit.put("kettle", [fire[0] + 0.78, 0.02, fire[2] - 0.55], { height: 0.24, yaw: 2.2 });

  /* ---- まわりの物 ---- */
  kit.put("tent", [3.1, 0.02, -5.4], { yaw: -0.55, height: 1.75, glow: 0.75, threshold: 0.5, tint: "#ffb868" });
  kit.light("#ffb060", 1.6, [2.6, 0.6, -4.4], 4.5, 1.7);
  kit.put("sandals", [2.05, 0.02, -4.35], { height: 0.1, yaw: 2.4 });
  kit.put("campchair", [-2.75, 0, -3.1], { yaw: 1.35 });
  kit.put("campchair", [-1.9, 0, -4.9], { yaw: 0.6 });
  kit.put("logseat", [0.35, 0, -4.5], { height: 0.36, yaw: 0.5 });
  kit.put("logseat", [-3.6, 0, -4.9], { height: 0.4, yaw: 1.9 });
  kit.put("firewood", [-2.3, 0, -2.55], { height: 0.42, yaw: 0.5 });
  kit.put("firewood", [-4.6, 0, -6.4], { height: 0.7, yaw: 0.2 });
  kit.put("cooler", [1.75, 0, -2.75], { height: 0.42, yaw: -0.5 });
  kit.put("backpack", [1.5, 0, -4.2], { height: 0.66, yaw: -0.6 });
  kit.put("stump", [1.0, 0, -5.6], { height: 0.72, yaw: 0.8 });
  kit.put("lantern", [1.72, 0.42, -2.75], { height: 0.22, glow: 1.2, threshold: 0.6, tint: "#ffcf90" });
  kit.put("lantern", [1.35, 0, -5.0], { height: 0.28, glow: 1.2, threshold: 0.6, tint: "#ffcf90" });
  kit.put("mug", [0.3, 0.36, -4.4], { height: 0.09 });
  kit.put("canoe", [-3.2, -0.05, -10.8], { height: 0.75, yaw: 0.25 });
  // 桟橋
  const plank = kit.material("wood_plank", { repeat: [0.5, 0.2], color: "#7a6c5c", bump: 1 });
  for (let i = 0; i < 22; i += 1) kit.box([1.3, 0.05, 0.26], [2.4 + (random() - 0.5) * 0.04, -0.05, -11.6 - i * 0.3], plank, [0, (random() - 0.5) * 0.04, 0]);
  for (let i = 0; i < 5; i += 1) for (const side of [-0.6, 0.6]) kit.cylinder(0.07, 0.08, 1.3, [2.4 + side, -0.25, -11.8 - i * 1.5], plank, undefined, undefined, 8);
  kit.put("lantern", [1.95, -0.02, -17.6], { height: 0.34, glow: 1.4, threshold: 0.5, tint: "#ffcf90" });

  /* ---- 木と草 ---- */
  const bark = kit.material("bark", { repeat: [2, 5], color: "#8a7666", bump: 3 });
  trunk(kit, -3.9, -4.0, { radius: 0.2, height: 11, mat: bark, seed: 1, branches: 7 });
  trunk(kit, -5.6, -7.2, { radius: 0.26, height: 13, mat: bark, seed: 2, lean: 0.02 });
  trunk(kit, 4.9, -7.6, { radius: 0.24, height: 13, mat: bark, seed: 3, lean: -0.02 });
  trunk(kit, 5.9, -5.0, { radius: 0.28, height: 12, mat: bark, seed: 4 });
  trunk(kit, -7.4, -5.2, { radius: 0.3, height: 13, mat: bark, seed: 5 });
  trunk(kit, 3.4, -9.6, { radius: 0.18, height: 11, mat: bark, seed: 6 });
  trunk(kit, -4.6, -10.2, { radius: 0.2, height: 12, mat: bark, seed: 7 });
  trunk(kit, 8.0, -9.2, { radius: 0.3, height: 14, mat: bark, seed: 8 });
  stringLights(kit, [-3.8, 2.9, -4.0], [3.0, 2.2, -5.6], { sag: 0.55, count: 13, radius: 0.026 });
  stringLights(kit, [3.0, 2.2, -5.6], [5.8, 3.0, -5.0], { sag: 0.3, count: 6, radius: 0.026 });
  const trees = [];
  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 ? -1 : 1;
    trees.push({ position: [side * (7.5 + random() * 15), 0.5, -4 - random() * 15], yaw: random() * TAU, scale: 0.8 + random() * 0.7 });
  }
  kit.scatter("conifer", trees, { color: "#39463a" });
  forest(kit, { count: 320, x: [-220, 220], z: [-190, -164], y: -0.6, height: [9, 20], color: "#0f1a22", seed: 3 });
  forest(kit, { count: 130, x: [-70, -16], z: [-40, -2], y: 0, height: [9, 16], color: "#0f1a1c", seed: 5 });
  forest(kit, { count: 130, x: [16, 70], z: [-40, -2], y: 0, height: [9, 16], color: "#0f1a1c", seed: 6 });
  const clear = (x, z) => Math.hypot(x + 0.86, z + 2.75) < 1.3 || (Math.abs(x - 3.1) < 1.4 && Math.abs(z + 5.4) < 1.3) || z < -13;
  kit.grass({ count: 1500, x: [-10, 10], z: [-13, -1.8], height: [0.08, 0.26], color: ["#333f22", "#5c6638"], seed: 4, avoid: (x, z) => clear(x, z) || (Math.abs(x) < 3.4 && z > -6 && Math.sin(x * 5 + z * 3) > -0.2) });
  kit.pebbles({ count: 420, x: [-6, 6], z: [-13, -1.6], size: [0.012, 0.06], color: ["#4a443c", "#7d766a"], seed: 8 });
  kit.scatter("fern", [[-4.6, -3.3], [-3.4, -5.6], [-5.0, -5.6], [4.9, -5.9], [4.2, -3.9], [5.6, -3.4], [-6.2, -4.0], [2.2, -8.2], [4.2, -8.8], [-2.6, -8.4], [-6.0, -8.6]].map(([x, z]) => ({ position: [x, -0.02, z], yaw: random() * TAU, height: 0.4 + random() * 0.3 })), { color: "#9ab08a" });
  kit.scatter("rock", [[-2.4, -7.2, 0.5], [5.4, -10.4, 0.9], [-1.0, -11.6, 0.4], [0.6, -12.6, 0.5], [4.4, -12.8, 0.7], [-5.8, -11.4, 0.8], [6.6, -6.8, 0.6]].map(([x, z, height]) => ({ position: [x, -0.1, z], yaw: random() * TAU, height })), { color: "#7d7d80" });

  return kit.finish({ y: 0.6, item: [-0.03, -1.2], phone: [0.5, -1.22], tray: [0.22, -1.4], chillTray: [0.02, -1.28] });
}
