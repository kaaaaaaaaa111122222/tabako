import * as THREE from "three";
import { createKit, seeded } from "./kit.js";
import { TAU, can, ridges } from "./parts.js";

/*
 * 港の防波堤（明け方の海）。釣り座に座り、クーラーボックスを机がわりにして吸う。
 */

export async function harbor() {
  const kit = await createKit({
    eye: 0.95,
    models: ["boat", "lighthouse", "tetrapod", "bollard", "house", "cooler", "tackle", "bluebucket", "rope", "nets", "buoy", "fishcrates", "gull", "truck", "shed", "tree", "cone"],
    images: ["quay", "concrete", "asphalt", "brickwall"],
  });
  const random = seeded(13);
  kit.sky({ top: "#5c92d6", horizon: "#eec8a6", below: "#5d7488", glow: "#4a2a1a", clouds: 0.3, cloudColor: "#e8b8a0", height: 0.3, sun: [0.16, 0.03, -1], sunColor: "#b8764a" });
  kit.water({ size: [620, 480], y: -1.5, position: [0, -225], deep: "#123850", shallow: "#7f8c9a", sparkle: "#ffe4c4", glitter: 0.14, scale: 0.5, lights: [[[70, 16, -420], "#ffb878"], [[-14, 6, -60], "#5a4a3a"]] });

  /* ---- 岸壁 ---- */
  const quay = kit.material("quay", { repeat: [9, 2.4], color: "#b9b3a8", bump: 1.4 });
  const face = kit.material("brickwall", { repeat: [9, 0.5], color: "#8f8a82", bump: 1 });
  kit.ground([26, 8], 0, quay, [-3, 0.6]);
  kit.box([26, 2.4, 0.2], [-3, -1.21, -3.5], face);
  const curb = kit.material("concrete", { repeat: [10, 0.1], color: "#c9b46a" });
  for (let i = 0; i < 13; i += 1) kit.box([1.9, 0.2, 0.32], [-15 + i * 2.05, 0.1, -3.3], i % 2 ? curb : kit.material("concrete", { repeat: [1, 0.1], color: "#a9a59c" }));
  // 右へ折れて奥へのびる船着き場
  kit.ground([12, 70], 0, kit.material("quay", { repeat: [4, 24], color: "#aaa498", bump: 1.2 }), [15.6, -32]);
  kit.box([0.3, 2.4, 70], [9.7, -1.21, -32], face);
  for (let i = 0; i < 16; i += 1) kit.box([0.32, 0.2, 2.6], [9.8, 0.1, -5 - i * 4], curb);
  for (let i = 0; i < 8; i += 1) kit.mesh(new THREE.TorusGeometry(0.34, 0.14, 10, 22), kit.solid("#17181a", { roughness: 0.95 }), [9.5, -0.75, -7 - i * 6], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 7; i += 1) kit.mesh(new THREE.TorusGeometry(0.3, 0.13, 10, 22), kit.solid("#17181a", { roughness: 0.95 }), [-9 + i * 3.4, -0.7, -3.66]);

  /* ---- 机がわりのクーラーボックスと釣り道具（吸う所） ---- */
  kit.put("cooler", [-0.1, 0, -1.34], { height: 0.56, yaw: 0.04 });
  kit.put("tackle", [0.86, 0, -1.95], { height: 0.3, yaw: -0.35 });
  can(kit, [0.62, 0.3, -1.98], { color: "#6d2a1e", band: "#d8b26a" });
  can(kit, [-0.36, 0.555, -1.5], { color: "#23384a", band: "#e0a64a" });
  kit.put("bluebucket", [-1.05, 0, -2.2], { height: 0.36 });
  kit.put("bluebucket", [-1.62, 0, -2.3], { height: 0.3, color: "#ffd8a0" });
  kit.put("rope", [1.35, 0, -2.75], { height: 0.2 });
  kit.put("rope", [-3.2, 0, -2.6], { height: 0.2, yaw: 2 });
  kit.put("nets", [-2.55, 0, -2.3], { height: 0.62, yaw: 0.6 });
  kit.put("buoy", [-1.95, 0, -2.9], { height: 0.36 });
  kit.put("buoy", [-2.2, 0, -3.0], { height: 0.3, yaw: 2, color: "#ffd060" });
  kit.put("fishcrates", [3.3, 0, -2.9], { height: 0.8, yaw: 0.2 });
  kit.put("fishcrates", [4.7, 0, -2.8], { height: 0.6, yaw: -0.3 });
  kit.put("nets", [2.3, 0, -2.7], { height: 0.5, yaw: 2 });
  kit.put("cone", [5.6, 0, -2.9], { height: 0.6 });
  kit.put("bollard", [-0.9, 0, -3.0], { yaw: 0.4, color: "#9a8a80", scale: 0.8 });
  kit.put("bollard", [3.1, 0, -3.1], { yaw: 1.4, color: "#9a8a80", scale: 0.8 });
  // 釣り竿（置き竿）と糸
  const rod = kit.solid("#22262c", { roughness: 0.35, metalness: 0.3 });
  const rods = [
    [[0.55, 0.22, -2.6], [0.85, 0.95, -3.5], [1.4, 1.85, -5.2], [1.62, 1.95, -5.9]],
    [[-0.35, 0.22, -2.7], [-0.62, 0.95, -3.6], [-1.2, 1.8, -5.2], [-1.45, 1.88, -5.9]],
  ];
  for (const points of rods) {
    kit.tube(points, 0.011, rod, { segments: 24, radial: 8 });
    const [a, b] = points;
    kit.tube([a, [a[0] + (b[0] - a[0]) * 0.4, a[1] + (b[1] - a[1]) * 0.4, a[2] + (b[2] - a[2]) * 0.4]], 0.02, kit.solid("#6a3a24"), { segments: 4 });
    kit.mesh(new THREE.TorusGeometry(0.04, 0.016, 8, 16), kit.solid("#9aa0a6", { metalness: 0.7, roughness: 0.3 }), [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45 - 0.05, a[2] + (b[2] - a[2]) * 0.45]);
    const tip = points[3];
    kit.wires([tip, [tip[0] * 1.5, -1.5, tip[2] - 9]], 1, { sag: 0.1, color: "#c8d4dc" });
    kit.box([0.14, 0.1, 0.2], [a[0], 0.2, a[2]], kit.solid("#3a3e44", { metalness: 0.5, roughness: 0.5 }));
    kit.bulb([0.05], "#ff6a3c", 1.2, [tip[0] * 1.5, -1.46, tip[2] - 9]);
  }
  // もやい綱
  const cord = kit.solid("#b8a888", { roughness: 1 });

  /* ---- 防波堤と灯台 ---- */
  const wall = kit.material("brickwall", { repeat: [14, 0.6], color: "#9a958d", bump: 1 });
  kit.box([74, 2.6, 4], [-50, -0.3, -50], wall, [0, 0.16, 0]);
  kit.box([74, 1.0, 0.8], [-50, 1.4, -51.4], wall, [0, 0.16, 0]);
  kit.put("lighthouse", [-15.5, 1.0, -56], { scale: 1.05 });
  const beacon = kit.dots([[-15.5, 10.2, -55]], "#ffe8b0", 2.6);
  kit.onUpdate((delta, time) => {
    beacon.material.opacity = 0.2 + 0.8 * Math.max(0, Math.sin(time * 1.1)) ** 8;
  });
  kit.box([60, 2.0, 4], [36, -0.6, -92], wall, [0, -0.06, 0]);
  const blocks = [];
  for (let i = 0; i < 74; i += 1) blocks.push({ position: [-84 + i * 0.95 + random(), -2.0 + random() * 1.0, -45.4 + random() * 2.4 - (i / 74) * 0.6 - (i * 0.95 - 34) * 0.155], yaw: random() * TAU, scale: 0.8 + random() * 0.5 });
  kit.scatter("tetrapod", blocks);
  // 左手前の消波ブロック
  kit.scatter("tetrapod", [[-6.5, -5.0], [-7.9, -5.8], [-9.4, -4.9], [-8.8, -7.4], [-11.4, -6.4], [-10.4, -8.6], [-13.4, -5.6], [-12.8, -8.4]].map(([x, z]) => ({ position: [x, -1.7 + random() * 0.4, z], yaw: random() * TAU, scale: 1.0 + random() * 0.3 })));

  /* ---- 漁船（波でゆれる） ---- */
  const boats = [];
  [[7.0, -10.5, 0.1, 0.72], [7.0, -18.5, -0.05, 0.78], [6.8, -27, 0.08, 0.8], [6.9, -36, 0.0, 0.8], [6.6, -46, 0.1, 0.85], [-4.6, -22, 2.7, 0.7], [-12, -34, 3.3, 0.75], [1.8, -58, 0.5, 0.8], [-30, -40, 2.9, 0.8]].forEach(([x, z, yaw, scale], index) => {
    const boat = kit.put("boat", [x, -2.1, z], { yaw: yaw + (index < 5 ? Math.PI / 2 : 0), scale, color: ["#ffffff", "#e8f0ff", "#fff0e0"][index % 3] });
    boats.push({ boat, phase: random() * 10, y: -2.1 });
    if (index < 5) kit.hang([x + 0.9, -0.5, z + 1.6], [9.8, 0.25, z + 2.6], 0.25, 0.02, cord);
  });
  kit.onUpdate((delta, time) => {
    boats.forEach(({ boat, phase, y }) => {
      boat.position.y = y + Math.sin(time * 0.9 + phase) * 0.06;
      boat.rotation.z = Math.sin(time * 0.7 + phase) * 0.025;
    });
  });
  // 沖の浮き
  const floats = [];
  for (const [x, z] of [[-3, -12], [1.2, -15], [-7, -17], [-9, -26], [3.4, -30]]) floats.push({ float: kit.put("buoy", [x, -1.75, z], { height: 0.55 }), phase: random() * 9 });
  kit.onUpdate((delta, time) => {
    floats.forEach(({ float, phase }) => {
      float.position.y = -1.72 + Math.sin(time * 1.2 + phase) * 0.07;
      float.rotation.z = Math.sin(time * 0.9 + phase) * 0.16;
    });
  });

  /* ---- 船着き場の上 ---- */
  kit.put("truck", [11.9, 0, -13.5], { height: 1.75, yaw: 0.5 });
  kit.put("shed", [15.2, 0, -16], { height: 3.3, yaw: -0.5 });
  kit.put("shed", [15.6, 0, -24], { height: 3.6, yaw: -0.35, color: "#c8d0d8" });
  kit.put("shed", [15.8, 0, -34], { height: 3.4, yaw: -0.6, color: "#d8c8b8" });
  for (let i = 0; i < 12; i += 1) kit.put(["fishcrates", "nets", "fishcrates"][i % 3], [10.9 + random() * 1.8, 0, -11 - i * 2.7], { height: 0.6 + random() * 0.4, yaw: random() * 6 });
  kit.scatter("bollard", Array.from({ length: 8 }, (_, i) => ({ position: [10.4, 0, -6 - i * 6], yaw: i })), { color: "#9a8a80" });
  const metal = kit.solid("#6f7478", { metalness: 0.4, roughness: 0.6 });
  for (const [x, z] of [[10.8, -13], [10.8, -29], [10.8, -45], [-7.2, -3.0]]) {
    kit.cylinder(0.05, 0.08, 5.2, [x, 2.6, z], metal, undefined, undefined, 10);
    kit.bulb([0.16], "#ffe8c0", 1.4, [x, 5.3, z]);
    kit.cylinder(0.02, 0.22, 0.14, [x, 5.46, z], metal, undefined, undefined, 12);
  }
  kit.wires([[10.8, 5.0, -13], [10.8, 5.0, -29], [10.8, 5.0, -45], [12, 5.0, -62]], 2, { spread: 0.2, sag: 0.4, color: "#2a2e34" });

  /* ---- 対岸の町と丘 ---- */
  const houses = [];
  for (let i = 0; i < 20; i += 1) houses.push({ position: [18 + (i % 10) * 7 + random() * 2, 0.4 + Math.floor(i / 10) * 2.6, -78 - Math.floor(i / 10) * 11 - random() * 4], yaw: Math.floor(random() * 4) * (Math.PI / 2), scale: 0.9 + random() * 0.3 });
  kit.scatter("house", houses, { color: "#c9b8aa" });
  kit.scatter("tree", Array.from({ length: 26 }, (_, i) => ({ position: [14 + i * 3.4, 1 + random() * 3, -94 - random() * 12], yaw: random() * TAU, height: 5 + random() * 4 })), { color: "#8f9a8c" });
  kit.box([120, 3, 40], [74, -1.4, -96], kit.material("asphalt", { repeat: [14, 5], color: "#6a6f68" })).userData.far = true;
  for (const [x, z, s, color] of [[70, -140, 34, "#4f6064"], [130, -180, 50, "#62727a"], [-140, -300, 52, "#8a8794"], [-40, -380, 40, "#a0929a"]]) {
    const hill = kit.mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 1 }), [x, -2, z]);
    hill.scale.set(s * 1.7, s * 0.4, s);
    hill.userData.far = true;
  }
  ridges(kit, [{ z: -405, color: "#b59a9c", height: 16, seed: 5 }]);

  /* ---- かもめ ---- */
  for (const [x, y, z, yaw] of [[-0.9, 0.46, -3.0, 0.6], [4.0, 0.2, -3.3, -0.4], [-4.6, 0.2, -3.3, 1.0], [2.5, 0.9, -2.4, 2.4]]) kit.put("gull", [x, y, z], { height: 0.3, yaw });
  const wing = new THREE.BufferGeometry();
  wing.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.09, 0, 0, 0.1, 0.5, 0.05, 0, 0.5, 0.05, 0, 0, 0, 0.1, 0.3, 0.03, 0.1], 3));
  wing.computeVertexNormals();
  const white = new THREE.MeshStandardMaterial({ color: "#eef0f2", side: THREE.DoubleSide, roughness: 0.9 });
  const flock = Array.from({ length: 8 }, (_, i) => {
    const bird = kit.add(new THREE.Group());
    const body = kit.mesh(new THREE.SphereGeometry(0.09, 10, 8), white, [0, 0, 0], undefined, bird);
    body.scale.set(0.7, 0.6, 2.4);
    const wings = [1, -1].map((side) => {
      const part = kit.mesh(wing, white, [0, 0.02, 0], undefined, bird);
      part.scale.x = side;
      return part;
    });
    return { bird, wings, center: [-6 + random() * 18, 3.5 + random() * 4, -20 - random() * 22], radius: 4 + random() * 7, speed: (0.16 + random() * 0.14) * (i % 2 ? 1 : -1), phase: random() * 9 };
  });
  kit.onUpdate((delta, time) => {
    flock.forEach(({ bird, wings, center, radius, speed, phase }) => {
      const a = time * speed + phase;
      bird.position.set(center[0] + Math.cos(a) * radius, center[1] + Math.sin(time * 0.6 + phase) * 0.5, center[2] + Math.sin(a) * radius * 0.6);
      bird.rotation.set(0, -a + (speed > 0 ? Math.PI : 0), speed > 0 ? 0.25 : -0.25);
      const flap = Math.sin(time * 6 + phase) * 0.5 * Math.max(0.15, Math.sin(time * 0.5 + phase));
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
    });
  });
  kit.pebbles({ count: 160, x: [-6, 6], z: [-3.1, -1.6], size: [0.006, 0.022], color: ["#7d786f", "#a39d92"], seed: 5 });

  return kit.finish({ y: 0.56, item: [-0.22, -1.2], phone: [0.2, -1.28], tray: [0.06, -1.42], chillTray: [-0.05, -1.28] });
}
