import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded, some } from "./kit.js";

/*
 * いくつかの場所で使う、ひとまとまりの部品。
 */

export const TAU = Math.PI * 2;

// 缶（ラベルは無地の帯だけ）
export function can(kit, [x, y, z], { color = "#6d2a1e", band = "#d8b26a", height = 0.105, radius = 0.026, parent } = {}) {
  const metal = kit.solid("#c9ccd0", { metalness: 0.85, roughness: 0.3 });
  kit.cylinder(radius, radius, height * 0.86, [x, y + height * 0.5, z], kit.solid(color, { roughness: 0.35, metalness: 0.3 }), undefined, parent);
  kit.cylinder(radius * 1.01, radius * 1.01, height * 0.16, [x, y + height * 0.5, z], kit.solid(band, { roughness: 0.35, metalness: 0.3 }), undefined, parent);
  kit.cylinder(radius * 0.86, radius, height * 0.07, [x, y + height * 0.965, z], metal, undefined, parent);
  kit.cylinder(radius, radius * 0.86, height * 0.07, [x, y + height * 0.035, z], metal, undefined, parent);
  kit.cylinder(radius * 0.36, radius * 0.36, 0.002, [x, y + height + 0.001, z + radius * 0.35], kit.solid("#0c0c0c"), undefined, parent);
}

// 板を並べた天板（z0 = 手前、depth = 奥行き）
export function slats(kit, { width, depth, y, x = 0, z0, count, mat, thickness = 0.022, gap = 0.008 }) {
  const each = depth / count;
  for (let i = 0; i < count; i += 1) {
    kit.rbox([width, thickness, each - gap], 0.005, [x, y - thickness / 2, z0 - each * (i + 0.5)], mat);
  }
}

// 電柱（変圧器と腕金つき）。戻り値は電線をかける点
export function powerPole(kit, x, z, height = 10, y = 0) {
  const pole = kit.material(null, { color: "#83827e", roughness: 0.95 });
  const metal = kit.solid("#6f7275", { metalness: 0.4, roughness: 0.6 });
  kit.cylinder(0.13, 0.18, height, [x, y + height / 2, z], pole, undefined, undefined, 12);
  for (const [at, width] of [[height - 0.7, 1.9], [height - 1.6, 1.5]]) {
    kit.box([width, 0.09, 0.09], [x, y + at, z + 0.12], metal);
    for (let i = -1; i <= 1; i += 1) kit.cylinder(0.04, 0.05, 0.16, [x + i * width * 0.42, y + at + 0.12, z + 0.12], kit.solid("#c9cdd0"), undefined, undefined, 8);
  }
  kit.cylinder(0.28, 0.28, 0.85, [x + 0.42, y + height - 2.6, z], metal, undefined, undefined, 14);
  kit.box([0.32, 0.45, 0.2], [x - 0.22, y + 3.2, z + 0.1], metal);
  return [x, y + height - 0.6, z];
}

// 道路の街灯
export function streetLamp(kit, x, z, { height = 5, color = "#ffd9a0", power = 5, reach = 10, arm = 0.9, y = 0 } = {}) {
  const metal = kit.solid("#4a4d52", { metalness: 0.5, roughness: 0.5 });
  kit.cylinder(0.045, 0.065, height, [x, y + height / 2, z], metal, undefined, undefined, 10);
  kit.tube([[x, y + height - 0.1, z], [x + arm * 0.5, y + height + 0.12, z], [x + arm, y + height + 0.1, z]], 0.03, metal);
  kit.box([0.5, 0.07, 0.18], [x + arm, y + height + 0.1, z], metal);
  kit.bulb([0.42, 0.03, 0.14], color, 2.4, [x + arm, y + height + 0.055, z]);
  if (power) kit.light(color, power, [x + arm, y + height - 0.1, z], reach, 1.5);
}

// 木の幹（近くの太い木）
export function trunk(kit, x, z, { radius = 0.22, height = 9, mat, y = 0, lean = 0, branches = 5, seed = 1, stubs = 0.6 } = {}) {
  const random = seeded(seed);
  const points = [];
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    points.push(new THREE.Vector3(Math.sin(t * 2 + seed) * 0.12 + lean * t * height, t * height, Math.cos(t * 2.4 + seed) * 0.1));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 20, radius, 14);
  // 根元は太く、上は細く
  const position = geometry.attributes.position;
  const center = new THREE.Vector3();
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    curve.getPointAt(t, center);
    const grow = (1 - t * 0.45) * (1 + 0.9 * Math.exp(-t * height * 2.2));
    for (let j = 0; j <= 14; j += 1) {
      const index = i * 15 + j;
      const bump = 1 + (Math.sin(j * 3.7 + i * 1.3) + Math.sin(j * 2.1 - i * 0.7)) * 0.035;
      position.setXYZ(
        index,
        center.x + (position.getX(index) - center.x) * grow * bump,
        center.y + (position.getY(index) - center.y) * grow,
        center.z + (position.getZ(index) - center.z) * grow * bump,
      );
    }
  }
  geometry.computeVertexNormals();
  kit.mesh(geometry, mat, [x, y, z]);
  for (let i = 0; i < branches; i += 1) {
    const h = height * (0.22 + random() * 0.6);
    const a = random() * TAU;
    const length = stubs * (0.5 + random());
    kit.tube(
      [
        [x + lean * h, y + h, z],
        [x + lean * h + Math.cos(a) * length * 0.6, y + h + 0.05, z + Math.sin(a) * length * 0.6],
        [x + lean * h + Math.cos(a) * length, y + h - 0.1, z + Math.sin(a) * length],
      ],
      radius * 0.14,
      mat,
      { segments: 6, radial: 5 },
    );
  }
}

// 遠くの針葉樹（四段の円すい）をまとめて植える
export function forest(kit, { count, x, z, y, height, color, seed, snow = null, avoid = null }) {
  const random = seeded(seed);
  const parts = [
    [0.5, 0.5, 0.3],
    [0.42, 0.42, 0.5],
    [0.32, 0.36, 0.68],
    [0.2, 0.3, 0.85],
  ].map(([radius, tall, at]) => {
    const geometry = new THREE.ConeGeometry(radius * 0.5, tall, 8);
    geometry.translate(0, at, 0);
    return geometry;
  });
  const geometry = mergeGeometries(parts);
  const a = new THREE.Color(color);
  const b = a.clone().offsetHSL(0, 0, 0.035);
  const items = [];
  for (let i = 0; i < some(count); i += 1) {
    const px = x[0] + (x[1] - x[0]) * random();
    const pz = z[0] + (z[1] - z[0]) * random();
    const h = height[0] + (height[1] - height[0]) * random();
    if (avoid && avoid(px, pz)) continue;
    items.push({ position: [px, y, pz], yaw: random() * TAU, scale: [h * 0.5, h, h * 0.5], color: a.clone().lerp(b, random()) });
  }
  const mesh = kit.many(geometry, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), items);
  mesh.userData.far = true;
  if (snow) {
    const cap = kit.many(geometry, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, color: snow }), items.map((item) => ({ ...item, position: [item.position[0], item.position[1] + item.scale[1] * 0.035, item.position[2] - 0.05], scale: [item.scale[0] * 0.9, item.scale[1] * 0.99, item.scale[2] * 0.9], color: snow })));
    cap.userData.far = true;
  }
  return mesh;
}

// 山並み（奥ほど明るい）
export function ridges(kit, rows) {
  for (const { z, color, height, seed, y = -2, width = 320 } of rows) {
    const shape = new THREE.Shape();
    const random = seeded(seed);
    shape.moveTo(-width, y - 20);
    for (let x = -width; x <= width; x += width / 22) shape.lineTo(x, y + height * (0.35 + 0.65 * Math.abs(Math.sin(x * 0.013 + seed))) + random() * height * 0.14);
    shape.lineTo(width, y - 20);
    kit.mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: false }), [0, 0, z]);
  }
}

// 中くらいの距離の家並み（切妻屋根の箱と、ところどころ明かりのついた窓）
export function cottages(kit, items, { walls = ["#8f8a86", "#6d6a70", "#a39a8e"], roofs = ["#2c2f38", "#3a302e", "#343a44"], window = "#ffcf8a", power = 1.3, lit = 0.45, seed = 5 }) {
  const random = seeded(seed);
  const body = new THREE.BoxGeometry(8, 5.4, 7);
  body.translate(0, 2.7, 0);
  const shape = new THREE.Shape();
  shape.moveTo(-4.5, 0);
  shape.lineTo(0, 2.2);
  shape.lineTo(4.5, 0);
  shape.lineTo(-4.5, 0);
  const roof = new THREE.ExtrudeGeometry(shape, { depth: 7.9, bevelEnabled: false });
  roof.translate(0, 5.3, -3.95);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const placed = items.map((item) => ({ ...item, wall: pick(walls), roofColor: pick(roofs) }));
  kit.many(body, new THREE.MeshStandardMaterial({ roughness: 0.95 }), placed.map((item) => ({ ...item, color: item.wall }))).userData.far = true;
  kit.many(roof, new THREE.MeshStandardMaterial({ roughness: 0.8 }), placed.map((item) => ({ ...item, color: item.roofColor }))).userData.far = true;
  const panes = [];
  for (const { position, yaw = 0, scale = 1 } of placed) {
    for (const [sx, sy] of [[-2.2, 1.6], [1.6, 1.6], [-2.2, 4.1], [1.8, 4.1], [0, 4.1]]) {
      for (const [face, offset] of [[0, 3.52], [Math.PI / 2, 4.02], [-Math.PI / 2, 4.02], [Math.PI, 3.52]]) {
        if (random() > lit * 0.5) continue;
        const turn = yaw + face;
        const x = sx * 0.9;
        panes.push({
          position: [position[0] + (Math.cos(turn) * x + Math.sin(turn) * offset) * scale, position[1] + sy * scale, position[2] + (-Math.sin(turn) * x + Math.cos(turn) * offset) * scale],
          yaw: turn,
          scale,
          color: new THREE.Color(window).multiplyScalar(0.35 + random() * 0.65),
        });
      }
    }
  }
  if (panes.length) kit.many(new THREE.PlaneGeometry(1.5, 1.2), kit.lit("#ffffff", power), panes);
}

// テレビのアンテナ
export function antenna(kit, [x, y, z], { height = 2.2, yaw = 0, color = "#9aa0a4" } = {}) {
  const metal = kit.solid(color, { metalness: 0.6, roughness: 0.4 });
  const holder = kit.add(new THREE.Group(), [x, y, z], [0, yaw, 0]);
  kit.cylinder(0.02, 0.02, height, [0, height / 2, 0], metal, undefined, holder, 8);
  kit.cylinder(0.012, 0.012, 1.3, [0, height - 0.1, 0], metal, [Math.PI / 2, 0, 0], holder, 6);
  for (let i = 0; i < 9; i += 1) kit.cylinder(0.006, 0.006, 0.5 - i * 0.025, [0, height - 0.1, -0.6 + i * 0.15], metal, [0, 0, Math.PI / 2], holder, 6);
}

// 電球を並べた線
export function stringLights(kit, a, b, { sag = 0.4, count = 9, color = "#ffcf8a", power = 2.2, radius = 0.03 } = {}) {
  kit.hang(a, b, sag, 0.006, kit.solid("#14161a"));
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const y = a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t);
    const at = [a[0] + (b[0] - a[0]) * t, y - 0.05, a[2] + (b[2] - a[2]) * t];
    kit.bulb([radius], color, power, at);
    kit.cylinder(0.012, 0.012, 0.04, [at[0], at[1] + radius + 0.012, at[2]], kit.solid("#14161a"), undefined, undefined, 8);
  }
}

// 額縁
export function framed(kit, w, h, position, rotation, draw, frame = "#3a2616") {
  const holder = kit.add(new THREE.Group(), position, rotation);
  kit.box([w + 0.06, h + 0.06, 0.03], [0, 0, 0], kit.solid(frame, { roughness: 0.5 }), undefined, holder);
  kit.panel(w, h, [0, 0, 0.017], undefined, draw, { parent: holder, roughness: 0.4 });
  return holder;
}
