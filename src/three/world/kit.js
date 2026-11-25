import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/*
 * 場所（3D の背景）を組み立てる共通部品。
 *
 * 座標は「煙草を吸う人」が基準で、長さの単位は m。
 *   足元の床が y = 0、目の高さが y = eye（立つ・座るで変わる）、正面が -Z、右が +X。
 * 手や道具は実物の SCALE 倍で作ってあるので、場所も目を中心に同じ倍率で拡大して重ねる。
 */

export const EYE = new THREE.Vector3(0, 1.4, 8.2);
export const SCALE = 2.2;

// スマホでは、置く数を減らし、影も省く
export const LIGHT_MODE = window.matchMedia?.("(pointer: coarse)").matches ?? false;
export const some = (count) => Math.max(1, Math.round(count * (LIGHT_MODE ? 0.5 : 1)));

const MODEL_URLS = {
  mixed: new URL("../../assets/scene/mixed.glb", import.meta.url).href,
  house: new URL("../../assets/scene/house.glb", import.meta.url).href,
  vending: new URL("../../assets/scene/vending.glb", import.meta.url).href,
  car: new URL("../../assets/scene/car.glb", import.meta.url).href,
  bins: new URL("../../assets/scene/bins.glb", import.meta.url).href,
  tank: new URL("../../assets/scene/tank.glb", import.meta.url).href,
  ac: new URL("../../assets/scene/ac.glb", import.meta.url).href,
  duct: new URL("../../assets/scene/duct.glb", import.meta.url).href,
  chair: new URL("../../assets/scene/chair.glb", import.meta.url).href,
  lamp: new URL("../../assets/scene/lamp.glb", import.meta.url).href,
  siphon: new URL("../../assets/scene/siphon.glb", import.meta.url).href,
  cup: new URL("../../assets/scene/cup.glb", import.meta.url).href,
  grinder: new URL("../../assets/scene/grinder.glb", import.meta.url).href,
  cabinet: new URL("../../assets/scene/cabinet.glb", import.meta.url).href,
  tent: new URL("../../assets/scene/tent.glb", import.meta.url).href,
  logs: new URL("../../assets/scene/logs.glb", import.meta.url).href,
  conifer: new URL("../../assets/scene/conifer.glb", import.meta.url).href,
  campchair: new URL("../../assets/scene/campchair.glb", import.meta.url).href,
  lantern: new URL("../../assets/scene/lantern.glb", import.meta.url).href,
  boat: new URL("../../assets/scene/boat.glb", import.meta.url).href,
  lighthouse: new URL("../../assets/scene/lighthouse.glb", import.meta.url).href,
  tetrapod: new URL("../../assets/scene/tetrapod.glb", import.meta.url).href,
  bollard: new URL("../../assets/scene/bollard.glb", import.meta.url).href,
  toro: new URL("../../assets/scene/toro.glb", import.meta.url).href,
  pine: new URL("../../assets/scene/pine.glb", import.meta.url).href,
  rock: new URL("../../assets/scene/rock.glb", import.meta.url).href,
  bamboo: new URL("../../assets/scene/bamboo.glb", import.meta.url).href,
  stool: new URL("../../assets/scene/stool.glb", import.meta.url).href,
  potplant: new URL("../../assets/scene/potplant.glb", import.meta.url).href,
  flowers: new URL("../../assets/scene/flowers.glb", import.meta.url).href,
  laundry: new URL("../../assets/scene/laundry.glb", import.meta.url).href,
  sandals: new URL("../../assets/scene/sandals.glb", import.meta.url).href,
  bicycle: new URL("../../assets/scene/bicycle.glb", import.meta.url).href,
  scooter: new URL("../../assets/scene/scooter.glb", import.meta.url).href,
  cone: new URL("../../assets/scene/cone.glb", import.meta.url).href,
  rack: new URL("../../assets/scene/rack.glb", import.meta.url).href,
  icebox: new URL("../../assets/scene/icebox.glb", import.meta.url).href,
  bush: new URL("../../assets/scene/bush.glb", import.meta.url).href,
  tree: new URL("../../assets/scene/tree.glb", import.meta.url).href,
  crates: new URL("../../assets/scene/crates.glb", import.meta.url).href,
  redcan: new URL("../../assets/scene/redcan.glb", import.meta.url).href,
  bench: new URL("../../assets/scene/bench.glb", import.meta.url).href,
  dish: new URL("../../assets/scene/dish.glb", import.meta.url).href,
  pipechair: new URL("../../assets/scene/pipechair.glb", import.meta.url).href,
  fan: new URL("../../assets/scene/fan.glb", import.meta.url).href,
  sofa: new URL("../../assets/scene/sofa.glb", import.meta.url).href,
  cafetable: new URL("../../assets/scene/cafetable.glb", import.meta.url).href,
  sugar: new URL("../../assets/scene/sugar.glb", import.meta.url).href,
  menu: new URL("../../assets/scene/menu.glb", import.meta.url).href,
  water: new URL("../../assets/scene/water.glb", import.meta.url).href,
  clock: new URL("../../assets/scene/clock.glb", import.meta.url).href,
  palm: new URL("../../assets/scene/palm.glb", import.meta.url).href,
  register: new URL("../../assets/scene/register.glb", import.meta.url).href,
  showcase: new URL("../../assets/scene/showcase.glb", import.meta.url).href,
  jars: new URL("../../assets/scene/jars.glb", import.meta.url).href,
  record: new URL("../../assets/scene/record.glb", import.meta.url).href,
  firewood: new URL("../../assets/scene/firewood.glb", import.meta.url).href,
  cooler: new URL("../../assets/scene/cooler.glb", import.meta.url).href,
  kettle: new URL("../../assets/scene/kettle.glb", import.meta.url).href,
  mug: new URL("../../assets/scene/mug.glb", import.meta.url).href,
  logseat: new URL("../../assets/scene/logseat.glb", import.meta.url).href,
  camptable: new URL("../../assets/scene/camptable.glb", import.meta.url).href,
  stump: new URL("../../assets/scene/stump.glb", import.meta.url).href,
  backpack: new URL("../../assets/scene/backpack.glb", import.meta.url).href,
  fern: new URL("../../assets/scene/fern.glb", import.meta.url).href,
  canoe: new URL("../../assets/scene/canoe.glb", import.meta.url).href,
  tripod: new URL("../../assets/scene/tripod.glb", import.meta.url).href,
  tackle: new URL("../../assets/scene/tackle.glb", import.meta.url).href,
  bluebucket: new URL("../../assets/scene/bluebucket.glb", import.meta.url).href,
  rope: new URL("../../assets/scene/rope.glb", import.meta.url).href,
  nets: new URL("../../assets/scene/nets.glb", import.meta.url).href,
  buoy: new URL("../../assets/scene/buoy.glb", import.meta.url).href,
  fishcrates: new URL("../../assets/scene/fishcrates.glb", import.meta.url).href,
  gull: new URL("../../assets/scene/gull.glb", import.meta.url).href,
  truck: new URL("../../assets/scene/truck.glb", import.meta.url).href,
  shed: new URL("../../assets/scene/shed.glb", import.meta.url).href,
  teaset: new URL("../../assets/scene/teaset.glb", import.meta.url).href,
  zabuton: new URL("../../assets/scene/zabuton.glb", import.meta.url).href,
  andon: new URL("../../assets/scene/andon.glb", import.meta.url).href,
  hibachi: new URL("../../assets/scene/hibachi.glb", import.meta.url).href,
  geta: new URL("../../assets/scene/geta.glb", import.meta.url).href,
  shishi: new URL("../../assets/scene/shishi.glb", import.meta.url).href,
  snowbush: new URL("../../assets/scene/snowbush.glb", import.meta.url).href,
  stones: new URL("../../assets/scene/stones.glb", import.meta.url).href,
  bridge: new URL("../../assets/scene/bridge.glb", import.meta.url).href,
  pail: new URL("../../assets/scene/pail.glb", import.meta.url).href,
};

const IMAGE_URLS = {
  facade: new URL("../../assets/images/facade.jpg", import.meta.url).href,
  facade2: new URL("../../assets/images/facade2.jpg", import.meta.url).href,
  asphalt: new URL("../../assets/images/asphalt.jpg", import.meta.url).href,
  forest: new URL("../../assets/images/forest.jpg", import.meta.url).href,
  plaster: new URL("../../assets/images/plaster.jpg", import.meta.url).href,
  snow: new URL("../../assets/images/snow.jpg", import.meta.url).href,
  concrete: new URL("../../assets/images/concrete.jpg", import.meta.url).href,
  wood_dark: new URL("../../assets/images/wood_dark.jpg", import.meta.url).href,
  wood_plank: new URL("../../assets/images/wood_plank.jpg", import.meta.url).href,
  steel: new URL("../../assets/images/steel.jpg", import.meta.url).href,
  bark: new URL("../../assets/images/bark.jpg", import.meta.url).href,
  panel: new URL("../../assets/images/panel.jpg", import.meta.url).href,
  stained: new URL("../../assets/images/stained.jpg", import.meta.url).href,
  goods: new URL("../../assets/images/goods.jpg", import.meta.url).href,
  fridge: new URL("../../assets/images/fridge.jpg", import.meta.url).href,
  roofdeck: new URL("../../assets/images/roofdeck.jpg", import.meta.url).href,
  quay: new URL("../../assets/images/quay.jpg", import.meta.url).href,
  brickwall: new URL("../../assets/images/brickwall.jpg", import.meta.url).href,
};

const gltf = new GLTFLoader();
const textures = new THREE.TextureLoader();
const models = new Map();
const images = new Map();

function loadModel(name) {
  if (!models.has(name)) {
    const promise = gltf.loadAsync(MODEL_URLS[name]).then(({ scene }) => {
      let mesh = null;
      scene.traverse((object) => {
        if (object.isMesh) mesh = object;
      });
      if (mesh.material.map) mesh.material.map.anisotropy = 4;
      mesh.geometry.computeBoundingBox();
      return { geometry: mesh.geometry, material: mesh.material, height: mesh.geometry.boundingBox.max.y };
    });
    promise.catch(() => models.delete(name));
    models.set(name, promise);
  }
  return models.get(name);
}

function loadImage(name) {
  if (!images.has(name)) {
    const promise = textures.loadAsync(IMAGE_URLS[name]).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
      texture.anisotropy = 8;
      return texture;
    });
    promise.catch(() => images.delete(name));
    images.set(name, promise);
  }
  return images.get(name);
}

// 決まった並びになる乱数（毎回同じ景色にする）
export function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function paint(width, height, draw, { repeat = null, color = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
  }
  return texture;
}

// 明るい所だけ光らせる（明かりのついた窓・看板・テントの中など）
export function glowing(material, strength = 1, threshold = 0.55, tint = "#ffffff") {
  const result = material.clone();
  const color = new THREE.Color(tint);
  result.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = { value: strength };
    shader.uniforms.uGlowTint = { value: color };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uGlow;\nuniform vec3 uGlowTint;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float peak = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
          totalEmissiveRadiance += diffuseColor.rgb * uGlowTint * smoothstep(${(threshold * 0.6).toFixed(3)}, ${threshold.toFixed(3)}, peak) * uGlow;
        }`,
      );
  };
  result.customProgramCacheKey = () => `glow-${threshold}`;
  return result;
}

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
`;

// 濡れた地面：水たまりの所だけ、つるつるにして景色を映す
export function wet(material, { scale = 0.5, amount = 0.5, dark = 0.5, base = 1 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWet = { value: new THREE.Vector4(scale / SCALE, amount, dark, base) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWetAt;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWetAt = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec2 vWetAt;\nuniform vec4 uWet;\nfloat wetness = 0.0;\n${NOISE}`)
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        {
          float n = fbm(vWetAt * uWet.x) * 0.75 + fbm(vWetAt * uWet.x * 0.31 + 9.0) * 0.25;
          wetness = smoothstep(0.72 - uWet.y * 0.45, 0.78 - uWet.y * 0.4, n);
          roughnessFactor = mix(roughnessFactor * uWet.w, 0.04, wetness);
          diffuseColor.rgb *= 1.0 - uWet.z * wetness;
        }`,
      )
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, wetness));");
  };
  material.customProgramCacheKey = () => "wet";
  return material;
}

/* ------------------------------------------------------------------ */
/* 組み立て                                                            */
/* ------------------------------------------------------------------ */

export async function createKit({ eye, models: modelNames, images: imageNames }) {
  const loadedModels = Object.fromEntries(await Promise.all(modelNames.map(async (name) => [name, await loadModel(name)])));
  const loadedImages = Object.fromEntries(await Promise.all(imageNames.map(async (name) => [name, await loadImage(name)])));
  const group = new THREE.Group();
  group.scale.setScalar(SCALE);
  group.position.set(EYE.x, EYE.y - eye * SCALE, EYE.z);
  group.updateMatrixWorld(true);
  const updates = [];

  // 場所の座標 → ワールド座標
  const toWorld = (position) => new THREE.Vector3(...position).multiplyScalar(SCALE).add(group.position);

  function material(image, { repeat = [1, 1], color = "#ffffff", roughness = 0.9, metalness = 0, bump = 0, ...rest } = {}) {
    let map = null;
    if (image) {
      map = loadedImages[image].clone();
      map.repeat.set(...repeat);
      map.needsUpdate = true;
    }
    const mat = new THREE.MeshStandardMaterial({ map, color, roughness, metalness, ...rest });
    if (bump && map) {
      mat.bumpMap = map;
      mat.bumpScale = bump;
    }
    return mat;
  }
  const solid = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...options });
  const lit = (color, power = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power) });

  function add(object, position = [0, 0, 0], rotation = [0, 0, 0], parent = group) {
    object.position.set(...position);
    object.rotation.set(...rotation);
    parent.add(object);
    return object;
  }
  const mesh = (geometry, mat, position, rotation, parent) => add(new THREE.Mesh(geometry, mat), position, rotation, parent);
  const box = (size, position, mat, rotation, parent) => mesh(new THREE.BoxGeometry(...size), mat, position, rotation, parent);
  const rbox = (size, radius, position, mat, rotation, parent) => mesh(new RoundedBoxGeometry(...size, 3, radius), mat, position, rotation, parent);
  const cylinder = (top, bottom, height, position, mat, rotation, parent, sides = 24) => mesh(new THREE.CylinderGeometry(top, bottom, height, sides), mat, position, rotation, parent);

  function ground(size, y, mat, position = [0, 0]) {
    const plane = mesh(new THREE.PlaneGeometry(size[0], size[1]), mat, [position[0], y, position[1]], [-Math.PI / 2, 0, 0]);
    plane.userData.flat = true;
    return plane;
  }

  // 点をつないだ管（手すり・ケーブル・ロープ）
  function tube(points, radius, mat, { segments = points.length * 8, radial = 8, parent = group } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(curve, segments, radius, radial), mat, undefined, undefined, parent);
  }
  // 2 点のあいだに垂らした線
  function hang(a, b, sag, radius, mat, options) {
    const points = [];
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
    }
    tube(points, radius, mat, { segments: 24, radial: 6, ...options });
    return points;
  }

  function look(name, { glow = 0, threshold = 0.55, tint = "#ffffff", color = null, roughness = null } = {}) {
    let mat = loadedModels[name].material;
    if (glow) mat = glowing(mat, glow, threshold, tint);
    if (color || roughness !== null) {
      if (mat === loadedModels[name].material) mat = mat.clone();
      if (color) mat.color.set(color);
      if (roughness !== null) mat.roughness = roughness;
    }
    return mat;
  }

  // 生成した小物を置く。height = 高さ（m）か scale = 倍率、yaw = 向き、lean = [x, z] の傾き
  function put(name, position, { yaw = 0, scale = 1, height = null, lean = [0, 0], parent = group, ...rest } = {}) {
    const source = loadedModels[name];
    const item = new THREE.Mesh(source.geometry, look(name, rest));
    item.scale.setScalar(height === null ? scale : height / source.height);
    return add(item, position, [lean[0], yaw, lean[1]], parent);
  }

  // 同じ小物をたくさん置く。items = [{ position, yaw, scale, height }]
  function scatter(name, items, options = {}) {
    const source = loadedModels[name];
    return many(source.geometry, look(name, options), items.map((item) => (item.height ? { ...item, scale: item.height / source.height } : item)));
  }

  function many(geometry, mat, items) {
    const result = new THREE.InstancedMesh(geometry, mat, items.length);
    const dummy = new THREE.Object3D();
    const tone = new THREE.Color();
    items.forEach((item, index) => {
      dummy.position.set(...item.position);
      if (item.rotation) dummy.rotation.set(...item.rotation);
      else dummy.rotation.set(0, item.yaw ?? 0, 0);
      if (Array.isArray(item.scale)) dummy.scale.set(...item.scale);
      else dummy.scale.setScalar(item.scale ?? 1);
      dummy.updateMatrix();
      result.setMatrixAt(index, dummy.matrix);
      if (item.color) result.setColorAt(index, tone.set(item.color));
    });
    result.frustumCulled = false;
    group.add(result);
    return result;
  }

  // 遠くの建物：窓の写真を貼った箱を大量に並べる（屋上には小屋や水槽も載せる）
  function towers({ count, area, base, height, width, image, seed, glow = 1.1, avoid = null, color = "#e4e6ec", gain = 1, kinds = 5 }) {
    const random = seeded(seed);
    for (let kind = 0; kind < kinds; kind += 1) {
      const h = height[0] + (height[1] - height[0]) * (kind / Math.max(1, kinds - 1)) ** 1.6;
      const w = width[0] + (width[1] - width[0]) * random();
      const d = width[0] + (width[1] - width[0]) * random();
      const body = new THREE.BoxGeometry(w, h, d);
      body.translate(0, h / 2, 0);
      // 1 枚 = 幅 24m・高さ 24m
      const uv = body.attributes.uv;
      const normal = body.attributes.normal;
      const shift = [random(), random()];
      for (let i = 0; i < uv.count; i += 1) {
        if (Math.abs(normal.getY(i)) > 0.5) {
          uv.setXY(i, 0.02, 0.02);
          continue;
        }
        const span = Math.abs(normal.getX(i)) > 0.5 ? d : w;
        uv.setXY(i, shift[0] + (uv.getX(i) * span) / 24, shift[1] + (uv.getY(i) * h) / 24);
      }
      const roof = [
        [w * 0.3, 2.6, d * 0.34, (random() - 0.5) * w * 0.5, (random() - 0.5) * d * 0.4],
        [w * 0.16, 1.4, d * 0.18, (random() - 0.5) * w * 0.7, (random() - 0.5) * d * 0.7],
        [w * 0.98, 0.9, 0.3, 0, d * 0.48],
        [w * 0.98, 0.9, 0.3, 0, -d * 0.48],
      ].map(([sx, sy, sz, x, z]) => {
        const part = new THREE.BoxGeometry(sx, sy, sz);
        part.translate(x, h + sy / 2, z);
        const flat = part.attributes.uv;
        for (let i = 0; i < flat.count; i += 1) flat.setXY(i, 0.02, 0.02);
        return part;
      });
      const mat = glowing(material(image, { color: new THREE.Color(color).multiplyScalar(gain), roughness: 0.85 }), glow / gain, 0.4 * Math.min(1.6, gain));
      const each = Math.ceil(count / kinds);
      const items = [];
      for (let i = 0; i < each; i += 1) {
        let x = 0;
        let z = 0;
        for (let tries = 0; tries < 20; tries += 1) {
          x = area.x[0] + (area.x[1] - area.x[0]) * random();
          z = area.z[0] + (area.z[1] - area.z[0]) * random();
          if (!avoid || !avoid(x, z)) break;
        }
        items.push({
          position: [x, base, z],
          yaw: (Math.floor(random() * 4) * Math.PI) / 2 + (random() - 0.5) * 0.12,
          scale: [0.8 + random() * 0.5, 0.75 + random() * 0.5, 0.8 + random() * 0.5],
          color: new THREE.Color().setHSL(0.6 + random() * 0.08, 0.05, 0.72 + random() * 0.28),
        });
      }
      many(mergeGeometries([body, ...roof]), mat, items).userData.far = true;
    }
  }

  // 空：上・地平線・地面の色、星、雲、地平線の明かり
  function sky({ top, horizon, below = horizon, glow = "#000000", stars = 0, milky = 0, clouds = 0, cloudColor = "#ffffff", cloudSpeed = 0.004, moon = null, height = 0.32, sun = null, sunColor = "#ffb070" }) {
    const uniforms = {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBelow: { value: new THREE.Color(below) },
      uGlow: { value: new THREE.Color(glow) },
      uCloud: { value: new THREE.Color(cloudColor) },
      uStars: { value: stars },
      uMilky: { value: milky },
      uClouds: { value: clouds },
      uTime: { value: 0 },
      uHeight: { value: height },
      uMoon: { value: moon ? new THREE.Vector3(...moon).normalize() : new THREE.Vector3(0, -1, 0) },
      uSun: { value: sun ? new THREE.Vector3(...sun).normalize() : new THREE.Vector3(0, -1, 0) },
      uSunColor: { value: new THREE.Color(sunColor) },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(420, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          uniform vec3 uTop, uHorizon, uBelow, uGlow, uCloud, uMoon, uSun, uSunColor;
          uniform float uStars, uMilky, uClouds, uTime, uHeight;
          ${NOISE}
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 color = mix(uHorizon, uTop, smoothstep(0.0, uHeight, h));
            color = mix(color, uBelow, smoothstep(0.0, -0.06, h));
            color += uGlow * exp(-abs(h) * 14.0);
            if (uSun.y > -0.5) {
              float m = max(dot(d, uSun), 0.0);
              color += uSunColor * (pow(m, 900.0) * 2.0 + pow(m, 40.0) * 0.35 + pow(m, 7.0) * 0.16);
            }
            if (uStars > 0.0 && h > 0.0) {
              float band = 0.0;
              if (uMilky > 0.0) {
                vec3 axis = normalize(vec3(0.75, 0.5, 0.28));
                float across = dot(d, axis);
                float cloud = fbm(d.xy * 5.0 + d.z * 3.0);
                band = exp(-across * across * 34.0) * smoothstep(0.2, 0.75, cloud);
                float lane = exp(-across * across * 260.0) * smoothstep(0.42, 0.62, fbm(d.xy * 9.0 + 4.0));
                color += (vec3(0.16, 0.2, 0.34) * band + vec3(0.2, 0.16, 0.16) * pow(band, 3.0)) * (1.0 - lane * 0.75) * uMilky * smoothstep(0.0, 0.14, h);
              }
              for (int layer = 0; layer < 2; layer++) {
                float k = layer == 0 ? 90.0 : 170.0;
                vec2 cell = vec2(atan(d.x, d.z) * k, asin(clamp(h, -1.0, 1.0)) * k);
                float s = hash(floor(cell) + float(layer) * 31.0);
                float big = hash(floor(cell) + 77.0);
                float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + s * 60.0);
                float dotShape = smoothstep((layer == 0 ? 0.1 : 0.2) + big * big * 0.2, 0.0, length(fract(cell) - 0.5));
                color += vec3(0.9, 0.95, 1.0) * step((layer == 0 ? 0.97 : 0.94) - band * 0.06, s) * dotShape * twinkle * uStars * (layer == 0 ? 1.0 : 0.35) * smoothstep(0.02, 0.2, h);
              }
            }
            if (uMoon.y > 0.0) {
              float m = dot(d, uMoon);
              color += vec3(1.0, 0.95, 0.85) * (smoothstep(0.99972, 0.99984, m) * 1.1 + pow(max(m, 0.0), 400.0) * 0.14);
            }
            if (uClouds > 0.0 && h > 0.01) {
              vec2 p = d.xz / (h + 0.12);
              float c = fbm(p * 1.3 + vec2(uTime * ${cloudSpeed.toFixed(4)}, 0.0));
              float cover = smoothstep(0.62 - uClouds * 0.3, 0.86, c) * smoothstep(0.01, 0.14, h);
              float light = fbm(p * 2.6 + 3.0);
              color = mix(color, uCloud * (0.6 + 0.6 * light), cover * 0.9);
            }
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    add(dome, [0, eye, 0]);
    updates.push((delta, time) => {
      uniforms.uTime.value = time;
    });
    return dome;
  }

  // 水面：空の色を映して、さざ波が動く。lights = [[位置, 色]]（映りこむ灯り、2 つまで）
  function water({ size, y, position = [0, 0], deep, shallow, sparkle = "#ffffff", scale = 1, glitter = 0.6, lights = [], shape = null }) {
    const at = (index) => (lights[index] ? toWorld(lights[index][0]) : new THREE.Vector3(0, -10000, 0));
    const uniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(deep) },
      uSky: { value: new THREE.Color(shallow) },
      uSparkle: { value: new THREE.Color(sparkle) },
      uScale: { value: scale / SCALE },
      uGlitter: { value: glitter },
      uLightA: { value: at(0) },
      uLightB: { value: at(1) },
      uColorA: { value: new THREE.Color(lights[0]?.[1] ?? "#000000") },
      uColorB: { value: new THREE.Color(lights[1]?.[1] ?? "#000000") },
    };
    const geometry = shape ? new THREE.ShapeGeometry(shape, 24) : new THREE.PlaneGeometry(size[0], size[1]);
    const surface = mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vWorld;
          uniform float uTime, uScale, uGlitter;
          uniform vec3 uDeep, uSky, uSparkle, uLightA, uLightB, uColorA, uColorB;
          ${NOISE}
          float waves(vec2 p) {
            return noise(p * 0.8 + vec2(uTime * 0.35, uTime * 0.2)) * 0.6 + noise(p * 2.1 - vec2(uTime * 0.5, uTime * 0.1)) * 0.3 + noise(p * 5.3 + uTime * 0.7) * 0.1;
          }
          void main() {
            vec2 p = vWorld.xz * uScale;
            float e = 0.08;
            float c = waves(p);
            float calm = 0.55 + length(cameraPosition - vWorld) * 0.004;
            vec3 n = normalize(vec3(c - waves(p + vec2(e, 0.0)), calm, c - waves(p + vec2(0.0, e))));
            vec3 toEye = normalize(cameraPosition - vWorld);
            float fresnel = pow(1.0 - max(dot(n, toEye), 0.0), 3.0);
            vec3 color = mix(uDeep, uSky, clamp(0.12 + fresnel * 0.95, 0.0, 1.0));
            color += uSparkle * pow(max(c - 0.62, 0.0) * 2.4, 2.0) * uGlitter;
            color += uColorA * pow(max(dot(reflect(-normalize(uLightA - vWorld), n), toEye), 0.0), 60.0);
            color += uColorB * pow(max(dot(reflect(-normalize(uLightB - vWorld), n), toEye), 0.0), 60.0);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
      [position[0], y, position[1]],
      [-Math.PI / 2, 0, 0],
    );
    updates.push((delta, time) => {
      uniforms.uTime.value = time;
    });
    return surface;
  }

  // 雪・火の粉など、ゆっくり動く粒
  function particles({ count, area, color, size, fall, sway = 0.3, opacity = 0.9 }) {
    const random = seeded(77);
    const total = some(count);
    const positions = new Float32Array(total * 3);
    const speeds = [];
    for (let i = 0; i < total; i += 1) {
      positions[i * 3] = area.x[0] + (area.x[1] - area.x[0]) * random();
      positions[i * 3 + 1] = area.y[0] + (area.y[1] - area.y[0]) * random();
      positions[i * 3 + 2] = area.z[0] + (area.z[1] - area.z[0]) * random();
      speeds.push(0.6 + random() * 0.8);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color, size: size * SCALE, map: dotTexture(), transparent: true, opacity, depthWrite: false, sizeAttenuation: true }),
    );
    points.frustumCulled = false;
    group.add(points);
    updates.push((delta, time, wind) => {
      for (let i = 0; i < total; i += 1) {
        const o = i * 3;
        positions[o] += (wind * 1.3 + Math.sin(time * 0.8 + i) * sway) * delta;
        positions[o + 1] -= fall * speeds[i] * delta;
        if (positions[o + 1] < area.y[0]) positions[o + 1] = area.y[1];
        if (positions[o + 1] > area.y[1]) positions[o + 1] = area.y[0];
        if (positions[o] < area.x[0]) positions[o] = area.x[1];
        if (positions[o] > area.x[1]) positions[o] = area.x[0];
      }
      geometry.attributes.position.needsUpdate = true;
    });
  }

  // 遠くの灯りの点（1 回の描画でまとめる）
  function dots(points, color, size, opacity = 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
    const result = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color, size: size * SCALE, map: dotTexture(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    );
    result.frustumCulled = false;
    group.add(result);
    return result;
  }

  // 立ちのぼる湯気・煙
  function steam({ at, spread = [0, 0], count = 4, size = 0.1, grow = 0.2, rise = 0.4, opacity = 0.12, speed = 0.3, color = "#dfe6f0" }) {
    const random = seeded(Math.round(at[0] * 100 + at[2] * 37 + 500));
    const puffs = Array.from({ length: count }, () => {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color, transparent: true, opacity: 0, depthWrite: false }));
      group.add(puff);
      return { puff, offset: random() * 6, x: at[0] + (random() - 0.5) * spread[0], z: at[2] + (random() - 0.5) * spread[1], turn: random() * 6 };
    });
    updates.push((delta, time, wind) => {
      puffs.forEach(({ puff, offset, x, z, turn }) => {
        const t = (time * speed + offset) % 1;
        puff.position.set(x + wind * t * rise * 0.5 + Math.sin(time + turn) * size * 0.3, at[1] + t * rise, z);
        puff.scale.setScalar(size + t * grow);
        puff.material.opacity = Math.sin(t * Math.PI) * opacity;
      });
    });
  }

  // 焚き火の炎
  function fire(position, { width = 0.7, height = 0.9, layers = 3 } = {}) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.translate(0, 0.5, 0);
    for (let i = 0; i < layers; i += 1) {
      const uniforms = { uTime: { value: 0 }, uSeed: { value: i * 7.3 + 1 }, uLean: { value: 0 } };
      const flame = mesh(
        geometry,
        new THREE.ShaderMaterial({
          uniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: /* glsl */ `
            varying vec2 vUv;
            uniform float uTime, uSeed, uLean;
            ${NOISE}
            void main() {
              float y = vUv.y;
              float x = (vUv.x - 0.5) * 2.0 - uLean * y * y * 0.5;
              float n = fbm(vec2(x * 1.7 + uSeed, y * 2.0 - uTime * 1.5));
              float tongue = fbm(vec2(x * 4.2 - uSeed, y * 2.6 - uTime * 2.3));
              x += (n - 0.5) * 0.9 * y;
              float reach = (1.0 - x * x * 1.15) * (0.45 + tongue * 0.9);
              float body = smoothstep(0.0, 0.5, reach - y) * smoothstep(1.0, 0.55, abs(x) * 1.15);
              body *= smoothstep(0.0, 0.1, y + 0.03);
              float heat = clamp(body * (1.25 - y * 0.9) + (n - 0.5) * 0.35, 0.0, 1.0);
              vec3 color = mix(vec3(0.75, 0.1, 0.01), vec3(1.0, 0.42, 0.06), smoothstep(0.1, 0.5, heat));
              color = mix(color, vec3(1.0, 0.82, 0.4), smoothstep(0.5, 0.95, heat));
              gl_FragColor = vec4(color * (0.4 + heat * 0.5), body * 0.45);
            }
          `,
        }),
        [position[0] + (i - (layers - 1) / 2) * width * 0.12, position[1], position[2] + (i - 1) * width * 0.16],
        [0, (i - 1) * 0.7, 0],
      );
      flame.renderOrder = 3;
      flame.scale.set(width * (1 - i * 0.12), height * (1 - i * 0.14), 1);
      updates.push((delta, time, wind) => {
        uniforms.uTime.value = time + i * 3.1;
        uniforms.uLean.value = wind * 0.5;
      });
    }
  }

  // 灯り。距離と明るさは m で指定する（場所の拡大に合わせて直す）
  function light(color, intensity, position, distance = 8, decay = 1.6, { shadow = false, flicker = 0 } = {}) {
    const power = intensity * SCALE ** decay;
    const point = new THREE.PointLight(color, power, distance * SCALE, decay);
    point.position.set(...position);
    if (shadow && !LIGHT_MODE) {
      point.castShadow = true;
      point.shadow.mapSize.set(1024, 1024);
      point.shadow.camera.near = 0.15;
      point.shadow.camera.far = distance * SCALE;
      point.shadow.bias = -0.003;
      point.shadow.normalBias = 0.03;
      point.shadow.radius = 3;
    }
    group.add(point);
    if (flicker) {
      updates.push((delta, time) => {
        point.intensity = power * (1 + (Math.sin(time * 11) * 0.5 + Math.sin(time * 17.3 + 1) * 0.3 + Math.sin(time * 29 + 2) * 0.2) * flicker);
      });
    }
    return point;
  }

  // 光って見えるだけの形（電球・蛍光灯・看板）
  function bulb(size, color, intensity, position, rotation, parent) {
    const geometry = size.length === 1 ? new THREE.SphereGeometry(size[0], 16, 10) : new THREE.BoxGeometry(...size);
    return mesh(geometry, lit(color, intensity), position, rotation, parent);
  }

  // 絵を描いた板（標識・張り紙・額）
  function panel(width, height, position, rotation, draw, { pixels = 256, glow = 0, parent = group, ...options } = {}) {
    const map = paint(Math.round((pixels * width) / Math.max(width, height)), Math.round((pixels * height) / Math.max(width, height)), draw);
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.7, ...options });
    if (glow) {
      mat.emissive.set("#ffffff");
      mat.emissiveMap = map;
      mat.emissiveIntensity = glow;
    }
    return mesh(new THREE.PlaneGeometry(width, height), mat, position, rotation, parent);
  }

  // 金網のフェンス
  function fence(width, height, position, yaw = 0, color = "#8f979c") {
    const map = paint(64, 64, (ctx, w) => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      for (const k of [-w, 0, w]) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k + w, w);
        ctx.moveTo(k + w, 0);
        ctx.lineTo(k, w);
        ctx.stroke();
      }
    }, { repeat: [width / 0.09, height / 0.09] });
    const holder = add(new THREE.Group(), position, [0, yaw, 0]);
    const net = mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, color, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.5, metalness: 0.4 }), [0, height / 2, 0], undefined, holder);
    net.renderOrder = 1;
    const pipe = solid(color, { metalness: 0.5, roughness: 0.5 });
    const posts = Math.max(1, Math.round(width / 2));
    for (let i = 0; i <= posts; i += 1) cylinder(0.03, 0.03, height + 0.06, [-width / 2 + (width * i) / posts, height / 2, 0], pipe, undefined, holder, 10);
    for (const y of [0.04, height]) cylinder(0.022, 0.022, width, [0, y, 0], pipe, [0, 0, Math.PI / 2], holder, 10);
    return holder;
  }

  // 草むら
  function grass({ count, x, z, y = 0, height = [0.1, 0.3], color = ["#3c4a2a", "#5f6a3a"], seed = 1, avoid = null }) {
    const random = seeded(seed);
    const positions = [];
    const normals = [];
    for (let b = 0; b < 5; b += 1) {
      const a = (b / 5) * Math.PI * 2 + 0.4;
      const lean = 0.25 + (b % 3) * 0.12;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const w = 0.035;
      const mid = [dx * lean * 0.4, 0.55, dz * lean * 0.4];
      const tip = [dx * lean * 1.1, 0.95 - (b % 2) * 0.2, dz * lean * 1.1];
      const at = [dx * 0.03, 0, dz * 0.03];
      const left = (p, k) => [p[0] - dz * w * k, p[1], p[2] + dx * w * k];
      const right = (p, k) => [p[0] + dz * w * k, p[1], p[2] - dx * w * k];
      positions.push(...left(at, 1), ...right(at, 1), ...left(mid, 0.8), ...right(at, 1), ...right(mid, 0.8), ...left(mid, 0.8), ...left(mid, 0.8), ...right(mid, 0.8), ...tip);
      for (let i = 0; i < 9; i += 1) normals.push(0, 1, 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    const a = new THREE.Color(color[0]);
    const b = new THREE.Color(color[1]);
    const items = [];
    for (let i = 0; i < some(count); i += 1) {
      const px = x[0] + (x[1] - x[0]) * random();
      const pz = z[0] + (z[1] - z[0]) * random();
      if (avoid && avoid(px, pz)) continue;
      const h = height[0] + (height[1] - height[0]) * random();
      items.push({ position: [px, y, pz], yaw: random() * 6.3, scale: [h * 1.2, h, h * 1.2], color: a.clone().lerp(b, random()) });
    }
    const result = many(geometry, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 }), items);
    result.userData.noCast = true;
    return result;
  }

  // 小石
  function pebbles({ count, x, z, y = 0, size = [0.02, 0.08], color = ["#4a463f", "#7a756a"], seed = 2, avoid = null }) {
    const random = seeded(seed);
    const a = new THREE.Color(color[0]);
    const b = new THREE.Color(color[1]);
    const items = [];
    for (let i = 0; i < some(count); i += 1) {
      const px = x[0] + (x[1] - x[0]) * random();
      const pz = z[0] + (z[1] - z[0]) * random();
      if (avoid && avoid(px, pz)) continue;
      const s = size[0] + (size[1] - size[0]) * random() ** 2;
      items.push({ position: [px, y + s * 0.2, pz], rotation: [random() * 6, random() * 6, random() * 6], scale: [s * 1.3, s * 0.75, s], color: a.clone().lerp(b, random()) });
    }
    return many(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), items);
  }

  // 電線
  function wires(points, lines, { spread = 0.5, sag = 0.7, color = "#0c0e12" } = {}) {
    const positions = [];
    for (let p = 0; p < points.length - 1; p += 1) {
      const [a, b] = [points[p], points[p + 1]];
      for (let l = 0; l < lines; l += 1) {
        const offset = (l - (lines - 1) / 2) * spread;
        for (let i = 0; i < 16; i += 1) {
          for (const t of [i / 16, (i + 1) / 16]) {
            positions.push(a[0] + (b[0] - a[0]) * t + offset, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color })));
  }

  // 影を落とす・受ける物を決める（場所ができあがったら 1 回だけ呼ぶ）
  function finish(spot) {
    group.traverse((object) => {
      if (!object.isMesh || !object.material.isMeshStandardMaterial || object.userData.far) return;
      object.receiveShadow = true;
      object.castShadow = !object.material.transparent && !object.userData.flat && !object.userData.noCast;
    });
    // 道具・スマホ・灰皿を置く所（ワールド座標）
    const at = ([x, z], y = spot.y) => toWorld([x, y, z]);
    return {
      group,
      update(delta, time, wind) {
        updates.forEach((fn) => fn(delta, time, wind));
      },
      spot: {
        item: at(spot.item),
        phone: at(spot.phone),
        tray: { challenge: at(spot.tray, spot.trayY ?? spot.y), chill: at(spot.chillTray ?? spot.tray, spot.trayY ?? spot.y) },
      },
    };
  }

  return {
    group,
    models: loadedModels,
    material,
    solid,
    lit,
    add,
    mesh,
    box,
    rbox,
    cylinder,
    ground,
    tube,
    hang,
    put,
    scatter,
    many,
    towers,
    sky,
    water,
    particles,
    dots,
    steam,
    fire,
    light,
    bulb,
    panel,
    fence,
    grass,
    pebbles,
    wires,
    toWorld,
    onUpdate: (fn) => updates.push(fn),
    finish,
  };
}

let dotMap = null;
function dotTexture() {
  dotMap ??= paint(64, 64, (ctx, w) => {
    const gradient = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.65)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, w);
  });
  return dotMap;
}
