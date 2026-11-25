import * as THREE from "three";
import { createKit, seeded, wet } from "./kit.js";
import { can, cottages, powerPole, streetLamp } from "./parts.js";

/*
 * コンビニ前（夜の駐車場）。店先のスタンド灰皿を囲んで、立って吸う。
 */

export async function konbini() {
  const kit = await createKit({
    eye: 1.55,
    models: ["vending", "car", "bins", "house", "mixed", "tree", "bush", "bicycle", "scooter", "cone", "rack", "icebox", "crates", "potplant", "truck"],
    images: ["asphalt", "concrete", "goods", "fridge", "steel", "brickwall"],
  });
  const random = seeded(9);
  kit.sky({ top: "#05070e", horizon: "#141a2a", below: "#0a0c12", glow: "#2a2018", stars: 0.35, clouds: 0.35, cloudColor: "#10141f" });
  kit.ground([140, 120], 0, wet(kit.material("asphalt", { repeat: [20, 17], color: "#b4b6ba", roughness: 0.75, bump: 1.2 }), { scale: 0.45, amount: 0.5, dark: 0.45 }), [0, -40]);

  /* ---- スタンド灰皿（吸う所） ---- */
  const steel = kit.material("steel", { repeat: [1, 1], color: "#d4d8dc", roughness: 0.36, metalness: 0.45, envMapIntensity: 1.2 });
  const dark = kit.solid("#24272b", { metalness: 0.5, roughness: 0.5 });
  kit.cylinder(0.46, 0.46, 0.022, [0, 1.139, -1.32], steel, undefined, undefined, 64);
  kit.mesh(new THREE.TorusGeometry(0.46, 0.014, 12, 64), steel, [0, 1.142, -1.32], [Math.PI / 2, 0, 0]);
  kit.cylinder(0.05, 0.05, 1.1, [0, 0.58, -1.32], steel);
  kit.cylinder(0.26, 0.3, 0.06, [0, 0.03, -1.32], dark);
  kit.cylinder(0.17, 0.15, 0.3, [0, 0.96, -1.32], dark);
  can(kit, [-0.35, 1.15, -1.36], { color: "#1f2a22", band: "#c9a24a" });
  can(kit, [0.3, 1.15, -1.58], { color: "#7a2420", band: "#e8dcc0" });

  // 喫煙所の札
  kit.cylinder(0.025, 0.025, 1.9, [-1.28, 0.95, -2.5], steel);
  kit.cylinder(0.2, 0.22, 0.05, [-1.28, 0.025, -2.5], dark);
  kit.panel(0.46, 0.62, [-1.28, 1.72, -2.46], [0, 0.35, 0], (ctx, w, h) => {
    ctx.fillStyle = "#f4f6f4";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1d6b5c";
    ctx.fillRect(0, h * 0.68, w, h * 0.32);
    ctx.strokeStyle = "#1d6b5c";
    ctx.lineWidth = w * 0.03;
    ctx.strokeRect(w * 0.03, w * 0.03, w * 0.94, h - w * 0.06);
    ctx.fillStyle = "#26303a";
    ctx.fillRect(w * 0.18, h * 0.46, w * 0.44, h * 0.07);
    ctx.fillStyle = "#d8622a";
    ctx.fillRect(w * 0.64, h * 0.46, w * 0.16, h * 0.07);
    ctx.lineWidth = w * 0.035;
    ctx.strokeStyle = "#7c8890";
    ctx.beginPath();
    ctx.moveTo(w * 0.72, h * 0.42);
    ctx.bezierCurveTo(w * 0.6, h * 0.32, w * 0.86, h * 0.26, w * 0.72, h * 0.14);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(w * 0.24)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("喫煙所", w / 2, h * 0.89);
  }, { glow: 0.25 });
  kit.put("cone", [-2.0, 0, -2.9], { yaw: 0.4 });
  kit.put("cone", [-2.7, 0, -3.8], { yaw: 1.4 });
  kit.put("crates", [2.3, 0, -3.2], { height: 0.62, yaw: 0.5 });
  // 喫煙所の上の灯り
  streetLamp(kit, -2.0, -2.2, { height: 2.75, power: 3.2, reach: 7, color: "#ffeed2", arm: 1.1 });
  kit.put("bicycle", [3.1, 0, -5.0], { height: 1.06, yaw: 0.5 });
  kit.put("bicycle", [3.8, 0, -5.5], { height: 1.06, yaw: 0.62, color: "#e0a8a0" });
  kit.put("scooter", [-2.9, 0, -5.4], { height: 1.12, yaw: 0.9 });

  /* ---- 店 ---- */
  const shop = buildStore(kit);
  shop.position.set(9.0, 0, -9.0);
  shop.rotation.y = -0.66;
  const front = (name, x, z, options = {}) => kit.put(name, [x, 0.14, z], { parent: shop, ...options });
  front("vending", -5.0, 4.3, { glow: 0.5, threshold: 0.85 });
  front("vending", -3.9, 4.3, { glow: 0.45, threshold: 0.8, color: "#8fb0f0" });
  front("bins", -2.4, 4.2);
  front("rack", -1.0, 4.15, { height: 1.3 });
  front("icebox", 3.4, 4.2, { height: 0.9 });
  front("potplant", 4.9, 4.2, { height: 0.8 });
  front("cone", 5.4, 5.2, { height: 0.6 });
  kit.light("#eef5ff", 3.4, [3.4, 2.4, -7.2], 9, 1.5, { shadow: true });
  kit.light("#eef5ff", 3.4, [7.2, 2.5, -3.9], 9, 1.5);
  kit.light("#ffe9d0", 1.2, [2.4, 1.5, -8.0], 5, 1.8);

  /* ---- 駐車場 ---- */
  const line = kit.material(null, { color: "#b8bcc0", roughness: 0.7 });
  const stopper = kit.material("concrete", { color: "#a9a9a6" });
  for (let i = 0; i < 7; i += 1) {
    kit.box([0.12, 0.01, 4.8], [-14.5 + i * 2.7, 0.006, -14.2], line).userData.flat = true;
    if (i < 6) kit.box([1.6, 0.13, 0.18], [-13.15 + i * 2.7, 0.065, -16.2], stopper);
  }
  kit.put("car", [-13.1, 0, -14.3], { yaw: 0.04 });
  kit.put("car", [-10.5, 0, -14.1], { yaw: 3.1, color: "#6f7a8c" });
  kit.put("truck", [-7.7, 0, -14.2], { yaw: 0.3, height: 1.75 });
  kit.put("car", [-5.0, 0, -14.4], { yaw: 0.02, color: "#d8c8a8" });
  kit.put("car", [-1.0, 0, -14.2], { yaw: 3.12, color: "#4d545e" });
  kit.put("car", [-6.4, 0, -6.6], { yaw: 0.9, color: "#c4ccd8" });
  for (const x of [-9.2, -8.4, -7.6]) kit.put("bicycle", [x, 0, -10.2], { height: 1.04, yaw: 1.5 + x * 0.05, color: x < -8 ? "#c8d8c0" : "#ffffff" });
  // 奥の塀と生け垣
  const wall = kit.material("brickwall", { repeat: [16, 0.6], color: "#8c8a86" });
  kit.box([44, 1.0, 0.16], [-8, 0.5, -17.6], wall);
  kit.fence(22, 1.2, [-14, 1.0, -17.6], 0);
  kit.box([0.16, 1.0, 22], [-18, 0.5, -8], wall);
  kit.scatter("bush", Array.from({ length: 18 }, (_, i) => ({ position: [-16.8 + (i % 2) * 0.1, 0, -16 + i * 0.95], yaw: random() * 6, height: 0.9 + random() * 0.3 })), { color: "#8ea38c" });
  kit.scatter("bush", Array.from({ length: 14 }, (_, i) => ({ position: [-3 + i * 1.0, 0, -18.4], yaw: random() * 6, height: 1.1 + random() * 0.3 })), { color: "#8ea38c" });
  kit.scatter("tree", [[-19, -19], [-12, -20], [1.5, -20], [-20, -6], [13, -22], [20, -17]].map(([x, z]) => ({ position: [x, 0, z], yaw: random() * 6, height: 4.8 + random() * 2 })), { color: "#7f8f7c" });

  /* ---- まわりの家・電柱・街灯 ---- */
  const houses = [];
  for (let i = 0; i < 9; i += 1) houses.push({ position: [-34 + i * 9 + random() * 2, 0, -25 - random() * 4], yaw: random() < 0.5 ? 0 : Math.PI / 2, scale: 0.95 + random() * 0.2 });
  for (const z of [-4, -13, -22]) houses.push({ position: [-27, 0, z], yaw: Math.PI / 2, scale: 1.0 });
  kit.scatter("house", houses, { glow: 1.5, threshold: 0.74, tint: "#ffd9a0" });
  cottages(kit, Array.from({ length: 24 }, (_, i) => ({ position: [-70 + i * 6 + random() * 3, 0, -42 - random() * 20], yaw: Math.floor(random() * 4) * (Math.PI / 2), scale: 1 + random() * 0.3 })), { walls: ["#34363e", "#2c2e36", "#403c3e"], roofs: ["#15171c", "#1c1a1c"], lit: 0.5, power: 1.0 });
  kit.scatter("mixed", [{ position: [-30, 0, -62], scale: 1.1 }, { position: [12, 0, -66], yaw: 1.6, scale: 1.3 }, { position: [34, 0, -56], yaw: 0.4 }], { glow: 1.1, threshold: 0.62, tint: "#ffd9a0" });
  const poles = [powerPole(kit, -22, -9, 10), powerPole(kit, -15.5, -18.8, 10), powerPole(kit, -2.5, -19.6, 10.5), powerPole(kit, 12, -20, 10)];
  kit.wires(poles, 5);
  kit.wires([poles[2], [4.5, 4.1, -13]], 2, { spread: 0.15 });
  streetLamp(kit, -11.6, -17.2, { height: 5.4, power: 22, reach: 14, color: "#ffe0b0" });
  streetLamp(kit, 1.4, -17.4, { height: 5.4, power: 14, reach: 11, color: "#ffe0b0" });
  // マンホールと湯気、道ばたの空き缶
  kit.cylinder(0.34, 0.34, 0.012, [-4.2, 0.007, -8.6], kit.solid("#3a3c3e", { metalness: 0.6, roughness: 0.6 }), undefined, undefined, 32);
  kit.steam({ at: [-4.2, 0.1, -8.6], spread: [0.4, 0.4], count: 12, size: 0.4, grow: 1.9, rise: 3.2, opacity: 0.07, speed: 0.14, color: "#9aa4b8" });

  return kit.finish({ y: 1.15, item: [-0.2, -1.2], phone: [0.3, -1.3], tray: [0.04, -1.42], chillTray: [-0.04, -1.3] });
}

// 店：ガラス越しに棚と商品が見える（看板は無地）
function buildStore(kit) {
  const random = seeded(21);
  const shop = new THREE.Group();
  kit.group.add(shop);
  const put = (geometry, material, position, rotation) => kit.mesh(geometry, material, position, rotation, shop);
  const block = (size, material, position, rotation) => put(new THREE.BoxGeometry(...size), material, position, rotation);
  const { solid, lit } = kit;
  const W = 12;
  const D = 7;
  const H = 3.0;
  const white = solid("#d4d6d6");
  block([W + 1, 0.14, 2.4], kit.material("concrete", { repeat: [5, 1], color: "#8f8f8c" }), [0, 0.07, D / 2 + 1.1]);
  block([W, 0.12, D], solid("#cfd2d2", { roughness: 0.4 }), [0, 0.1, 0]);
  block([W, 0.3, D], white, [0, H + 0.15, 0]);
  block([W, H, 0.15], white, [0, H / 2, -D / 2]);
  block([0.15, H, D], white, [W / 2, H / 2, 0]);
  // ひさしと、無地の帯の看板
  block([W + 1.2, 0.16, 2.0], solid("#b9bcbe"), [0, H + 0.06, D / 2 + 0.95]);
  block([W + 1.2, 0.8, 0.16], solid("#e4e8e8"), [0, H + 0.5, D / 2 + 1.9]);
  block([W + 1.22, 0.26, 0.18], lit("#2fa39a", 1.0), [0, H + 0.62, D / 2 + 1.91]);
  block([W + 1.22, 0.1, 0.18], lit("#f2a23a", 0.9), [0, H + 0.32, D / 2 + 1.91]);
  block([0.16, 0.8, D + 1.6], solid("#e4e8e8"), [-W / 2 - 0.55, H + 0.5, 0.95]);
  block([0.18, 0.26, D + 1.6], lit("#2fa39a", 1.0), [-W / 2 - 0.56, H + 0.62, 0.95]);
  for (let x = -5; x <= 5; x += 2.5) block([0.5, 0.03, 0.16], lit("#f6faff", 2.0), [x, H - 0.04, D / 2 + 1.0]);
  for (const x of [-W / 2 - 0.4, W / 2 + 0.4]) put(new THREE.CylinderGeometry(0.06, 0.06, H, 12), solid("#8b9094", { metalness: 0.5, roughness: 0.4 }), [x, H / 2, D / 2 + 1.75]);
  // 天井の蛍光灯
  for (const x of [-4.4, -1.6, 1.2, 4.0]) block([0.22, 0.05, D - 1.2], lit("#f4f8ff", 1.6), [x, H - 0.05, 0]);
  const inside = kit.light("#f0f5ff", 4.2, [-0.6, 2.4, 0.4], 7, 1.2);
  shop.add(inside);
  // 棚（写真の商品を貼る）と、手前に並ぶ商品
  const shelf = solid("#b9bdc0");
  const stock = kit.material("goods", { repeat: [3, 0.8], roughness: 0.6, emissive: "#ffffff", emissiveMap: kit.material("goods", { repeat: [3, 0.8] }).map, emissiveIntensity: 0.22 });
  const goods = [];
  for (let row = 0; row < 3; row += 1) {
    const z = 1.4 - row * 1.75;
    block([7.6, 0.1, 0.56], shelf, [-0.4, 0.2, z]);
    block([7.6, 1.35, 0.3], stock, [-0.4, 0.88, z]);
    for (const y of [0.3, 0.72, 1.14]) {
      block([7.6, 0.03, 0.56], shelf, [-0.4, y - 0.03, z]);
      for (let x = -4.1; x < 3.3; x += 0.17) goods.push([x + random() * 0.03, y, z + 0.2, 0.11 + random() * 0.05, 0.14 + random() * 0.18]);
    }
  }
  // 奥の冷蔵ケース
  const fridge = kit.material("fridge", { repeat: [4, 0.75] });
  block([W - 0.8, 2.3, 0.1], new THREE.MeshBasicMaterial({ map: fridge.map, color: new THREE.Color("#ffffff").multiplyScalar(0.95) }), [0, 1.3, -D / 2 + 0.15]);
  for (let x = -W / 2 + 0.6; x <= W / 2 - 0.6; x += 1.2) block([0.07, 2.3, 0.06], solid("#70767a", { metalness: 0.6, roughness: 0.4 }), [x, 1.3, -D / 2 + 0.23]);
  // 窓ぎわの雑誌
  for (let x = -5.0; x < 0.2; x += 0.26) goods.push([x, 0.75, D / 2 - 0.45, 0.22, 0.3]);
  block([5.6, 0.7, 0.35], shelf, [-2.4, 0.38, D / 2 - 0.45]);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.16), new THREE.MeshStandardMaterial({ roughness: 0.6 }), goods.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  goods.forEach(([x, y, z, w, h], index) => {
    dummy.position.set(x, y + h / 2, z);
    dummy.scale.set(w, h, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color.setHSL(random(), 0.55 + random() * 0.4, 0.4 + random() * 0.35));
  });
  mesh.frustumCulled = false;
  shop.add(mesh);
  // レジ
  block([2.6, 1.0, 0.7], solid("#d8d2c4"), [4.4, 0.6, 1.4]);
  block([0.4, 0.34, 0.3], solid("#2a2d30"), [4.0, 1.26, 1.4]);
  block([1.8, 0.7, 0.05], lit("#ffe0a8", 0.9), [4.4, 2.3, 0.2]);
  // ガラスと枠、自動ドア
  const glass = new THREE.MeshStandardMaterial({ color: "#cfe6f2", transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.1, depthWrite: false });
  put(new THREE.PlaneGeometry(W, H), glass, [0, H / 2, D / 2]);
  put(new THREE.PlaneGeometry(D, H), glass, [-W / 2, H / 2, 0], [0, -Math.PI / 2, 0]);
  const frame = solid("#6d7478", { metalness: 0.5, roughness: 0.4 });
  for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 8) block([0.08, H, 0.1], frame, [x, H / 2, D / 2]);
  for (let z = -D / 2; z <= D / 2 + 0.01; z += D / 4) block([0.1, H, 0.08], frame, [-W / 2, H / 2, z]);
  for (const y of [0.14, 2.4]) {
    block([W, 0.08, 0.1], frame, [0, y, D / 2]);
    block([0.1, 0.08, D], frame, [-W / 2, y, 0]);
  }
  for (const x of [1.0, 2.0]) block([0.1, 0.5, 0.04], solid("#cfd4d6", { metalness: 0.7, roughness: 0.3 }), [x, 1.1, D / 2 + 0.06]);
  // 窓の張り紙（文字のない絵）
  const colors = ["#e8483a", "#f4b63a", "#3a8fd8", "#4cae5c", "#e87aa8"];
  [[-5.2, 1.9], [-3.6, 1.95], [-2.2, 1.85], [3.6, 1.9], [5.2, 1.8]].forEach(([x, y], index) => {
    kit.panel(0.62, 0.86, [x, y, D / 2 + 0.07], undefined, (ctx, w, h) => {
      ctx.fillStyle = colors[index];
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff6e0";
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.42, w * 0.34, 0, 7);
      ctx.fill();
      ctx.fillStyle = colors[(index + 2) % 5];
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.45, w * 0.22, w * 0.15, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      for (const ky of [0.78, 0.86]) ctx.fillRect(w * 0.15, h * ky, w * (0.7 - (ky - 0.78) * 3), h * 0.04);
    }, { parent: shop, glow: 0.35 });
  });
  return shop;
}
