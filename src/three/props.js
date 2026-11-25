import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { cloneModel, getImage, getPart, tiledImage } from "../assets.js";
import { phoneScreenTexture, tobaccoTexture } from "./textures.js";

// 金属の部品は夜の暗い映り込みだけだと黒く沈むので、映り込みを強める
function brightMetal(model, part, { intensity = 2.4, roughness = null, color = null } = {}) {
  const material = getPart(model, part).material.clone();
  material.envMapIntensity = intensity;
  if (roughness !== null) material.roughness = roughness;
  if (color) material.color.set(color);
  return material;
}

// モデルの部品を、形と材質を共有したメッシュとして取り出す
function partMesh(model, part, material = null) {
  const source = getPart(model, part);
  const mesh = new THREE.Mesh(source.geometry, material ?? source.material);
  mesh.castShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* フリントホイール式ライター                                          */
/*   ローカル座標：原点 = 胴体の中心、+Y = 上、-Z = 前（炎の側）        */
/*   前から順に、フードと炎の出口 → ホイール → 赤いガスレバー（+Z、親指側） */
/*   モデルの部品はこの寸法に合わせてある（tools/assetgen/bl_props.py） */
/* ------------------------------------------------------------------ */

// 点火画面の当たり判定と共有する寸法（ライターのローカル単位）
export const LIGHTER_LAYOUT = {
  wheel: { y: 0.443, z: -0.012, radius: 0.066 },
  lever: { y: 0.39, z: 0.1, height: 0.04, depth: 0.085, travel: 0.028 },
  nozzle: { y: 0.41, z: -0.062, top: 0.445 },
  hood: { frontOfWheel: -0.045, top: 0.47 },
  shoulderTop: 0.338,
};

export function createLighter() {
  const L = LIGHTER_LAYOUT;
  const group = new THREE.Group();
  const chrome = brightMetal("lighter", "hood", { intensity: 3.2, roughness: 0.3 });
  const steel = brightMetal("lighter", "wheel", { intensity: 2.6 });
  group.add(partMesh("lighter", "body"), partMesh("lighter", "hood", chrome), partMesh("lighter", "vent"), partMesh("lighter", "nozzle"));

  const lever = partMesh("lighter", "lever");
  lever.position.set(0, L.lever.y, L.lever.z);
  group.add(lever);

  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(0, L.wheel.y, L.wheel.z);
  wheelPivot.add(partMesh("lighter", "wheel", steel), partMesh("lighter", "axle", brightMetal("lighter", "axle", { intensity: 3 })));
  group.add(wheelPivot);

  const flameAnchor = new THREE.Object3D();
  flameAnchor.position.set(0, L.nozzle.top, L.nozzle.z);
  group.add(flameAnchor);
  // 親指が乗る位置（ホイールの上 → 手前のレバーの上）
  const thumbStart = new THREE.Object3D();
  thumbStart.position.set(0, 0.55, -0.01);
  group.add(thumbStart);
  const thumbEnd = new THREE.Object3D();
  thumbEnd.position.set(0, 0.44, 0.112);
  group.add(thumbEnd);

  return { group, wheelPivot, flameAnchor, thumbStart, thumbEnd, lever, leverRestY: L.lever.y };
}

/* ------------------------------------------------------------------ */
/* 燃える材質：軸に沿った位置で、焦げ・赤熱・燃え尽きを描く            */
/* ------------------------------------------------------------------ */

function burnMaterial(base, axis, uniforms, fragment) {
  const material = base.clone();
  const declare = Object.keys(uniforms)
    .map((name) => `uniform float ${name};`)
    .join("\n");
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBurn;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBurn = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vBurn;
        ${declare}
        float burnNoise(vec3 p) { return fract(sin(dot(floor(p), vec3(127.1, 311.7, 74.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float along = vBurn.${axis};
          ${fragment}
        }`,
      );
  };
  // 同じ種類の材質でも差し込む式が違うので、シェーダーを使い回さない
  material.customProgramCacheKey = () => `burn-${axis}-${fragment.length}`;
  return material;
}

/* ------------------------------------------------------------------ */
/* 煙草                                                                */
/*   ローカル座標：-X が先端（x = -0.32）、+X がフィルター端（x = 0.835） */
/* ------------------------------------------------------------------ */

const CIGARETTE_TIP = -0.32;
const CIGARETTE_BURNABLE = 0.8; // 先端から、指で持てる長さを残した所まで
const CIGARETTE_ASPECT = 0.62; // 長さに対する太さの倍率

const CIGARETTE_BURN = `
          if (along < uTip) discard;
          float n = burnNoise(vBurn * 160.0);
          float d = along - max(uTip, -0.32) + (n - 0.5) * 0.014;
          float charred = uLit * (1.0 - smoothstep(0.018, 0.085, d));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.028, 0.024, 0.022), charred);
          totalEmissiveRadiance += vec3(1.0, 0.23, 0.05) * uGlow * uLit * (1.0 - smoothstep(0.0, 0.045, d)) * (0.45 + 0.55 * n);
`;

function cigaretteMesh(uniforms) {
  const source = getPart("cigarette", "cigarette");
  const material = burnMaterial(source.material, "x", uniforms, CIGARETTE_BURN);
  material.color.set("#ece7df");
  return new THREE.Mesh(source.geometry, material);
}

// 灰皿に残す吸い殻（consumed まで燃えて消えたもの）。scale = 煙草の長さの倍率
export function createButt(consumed, scale) {
  const tipX = CIGARETTE_TIP + consumed * CIGARETTE_BURNABLE;
  const mesh = cigaretteMesh({ uTip: { value: tipX }, uLit: { value: 1 }, uGlow: { value: 0 } });
  mesh.material.side = THREE.DoubleSide;
  const group = new THREE.Group();
  group.add(mesh);
  // 押しつぶされて少し平たい
  group.scale.set(scale, scale * CIGARETTE_ASPECT * 0.85, scale * CIGARETTE_ASPECT);
  return group;
}

// 落ちていく灰のかたまり
export function createAsh(length, scale) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.044, length, 10),
    new THREE.MeshStandardMaterial({ map: tiledImage("concrete", 1, 0.5), color: "#a9a49d", roughness: 1 }),
  );
  mesh.geometry.rotateZ(Math.PI / 2);
  mesh.scale.set(scale, scale * CIGARETTE_ASPECT, scale * CIGARETTE_ASPECT);
  return mesh;
}

export function createCigarette() {
  const group = new THREE.Group();
  const radius = 0.055;
  const uniforms = { uTip: { value: CIGARETTE_TIP - 0.1 }, uLit: { value: 0 }, uGlow: { value: 0 } };
  group.add(cigaretteMesh(uniforms));

  // 先端の断面（火種）
  const tipMaterial = new THREE.MeshStandardMaterial({
    map: tobaccoTexture(),
    roughness: 0.95,
    emissive: "#ff3d0d",
    emissiveIntensity: 0,
  });
  const tip = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.96, 32), tipMaterial);
  tip.position.x = CIGARETTE_TIP - 0.001;
  tip.rotation.y = -Math.PI / 2;
  group.add(tip);

  // 灰（まったりモードで先端に伸びていく）
  const ash = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.97, radius * 0.9, 1, 24),
    new THREE.MeshStandardMaterial({ map: tiledImage("concrete", 1, 0.5), color: "#a9a49d", roughness: 1 }),
  );
  ash.rotation.z = Math.PI / 2;
  ash.visible = false;
  group.add(ash);

  // consumed: 0 = 新品, 1 = フィルター手前まで燃えた。ashLength: 先端に残っている灰の長さ
  function setConsumed(consumed, ashLength = 0) {
    const tipX = CIGARETTE_TIP + THREE.MathUtils.clamp(consumed, 0, 1) * CIGARETTE_BURNABLE;
    uniforms.uTip.value = consumed > 0 ? tipX : CIGARETTE_TIP - 0.1;
    tip.position.x = tipX - 0.001;
    ash.visible = ashLength > 0.004;
    ash.scale.y = Math.max(0.001, ashLength);
    ash.position.x = tipX - ashLength / 2;
  }

  // lit: 0..1（どれだけ火が回ったか）、glow: 火種の明るさ
  function setBurning(lit, glow, delta) {
    uniforms.uLit.value += ((lit > 0.2 ? 1 : lit * 2) - uniforms.uLit.value) * Math.min(1, delta * 3);
    uniforms.uGlow.value = glow;
    tipMaterial.emissiveIntensity = glow * 1.4;
  }

  return { group, tip, burnable: CIGARETTE_BURNABLE, setConsumed, setBurning };
}

/* ------------------------------------------------------------------ */
/* スマホ・蛾・灰皿                                                     */
/* ------------------------------------------------------------------ */

export function createPhone() {
  const group = new THREE.Group();
  group.add(partMesh("phone", "phone"));
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: "#05080a",
    roughness: 0.15,
    emissive: "#ffffff",
    emissiveIntensity: 0,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.85), screenMaterial);
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.0185;
  group.add(screen);
  const glow = new THREE.PointLight("#9fd4ff", 0, 1.8, 2);
  glow.position.y = 0.3;
  group.add(glow);

  return {
    group,
    glow,
    setNotification(from, text) {
      if (screenMaterial.emissiveMap) screenMaterial.emissiveMap.dispose();
      screenMaterial.emissiveMap = phoneScreenTexture(from, text, getImage("wallpaper").image);
      screenMaterial.needsUpdate = true;
    },
    setLit(amount) {
      screenMaterial.emissiveIntensity = amount;
      glow.intensity = amount * 0.6;
    },
  };
}

export function createMoth() {
  const group = cloneModel("moth");
  const wings = [
    [-1, "wing_l"],
    [1, "wing_r"],
  ].map(([side, name]) => {
    const pivot = group.getObjectByName(name);
    pivot.userData.side = side;
    return pivot;
  });
  group.visible = false;
  return { group, wings };
}

export function createAshtray() {
  const group = cloneModel("ashtray");
  group.traverse((object) => {
    if (object.isMesh) object.material = brightMetal("ashtray", "ashtray", { intensity: 2.6 });
  });
  return group;
}

/* ------------------------------------------------------------------ */
/* マッチ                                                              */
/*   ローカル座標：軸は +Y、y = 0 が持ち手側の端、y = length が頭薬   */
/*   単位はワールド単位（そのままのスケールで使う）                     */
/* ------------------------------------------------------------------ */

export function createMatch(kind = "box") {
  const paper = kind === "paper";
  const length = paper ? 0.1 : 0.12;
  const group = new THREE.Group();
  const uniforms = { uBurn: { value: 0 }, uGlow: { value: 0 }, uLength: { value: length } };
  const source = getPart(paper ? "matchPaper" : "matchBox", "match");
  const material = burnMaterial(
    source.material,
    "y",
    uniforms,
    `
          float n = burnNoise(vBurn * 900.0);
          float edge = uLength * (1.0 - uBurn * 0.85) + (n - 0.5) * 0.004;
          float lit = step(0.005, uBurn);
          float charred = lit * smoothstep(edge - 0.005, edge + 0.002, along);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.022, 0.018, 0.016), charred * 0.95);
          float ember = lit * exp(-abs(along - edge) * 320.0);
          float head = smoothstep(uLength - 0.012, uLength - 0.002, along);
          totalEmissiveRadiance += vec3(1.0, 0.36, 0.1) * uGlow * (head * (0.55 + 0.45 * n) + ember * 0.8);
    `,
  );
  const mesh = new THREE.Mesh(source.geometry, material);
  mesh.castShadow = true;
  group.add(mesh);

  const headAnchor = new THREE.Object3D();
  headAnchor.position.y = length + 0.004;
  group.add(headAnchor);

  return {
    group,
    length,
    thickness: paper ? 0.0022 : 0.0068, // 軸の厚み（つまむときの指の間隔）
    headAnchor,
    // burn: 0..1（燃えた割合）、glow: 頭の赤熱
    setBurn(burn, glow = 0) {
      uniforms.uBurn.value = THREE.MathUtils.clamp(burn, 0, 1);
      uniforms.uGlow.value = glow;
    },
  };
}

// 箱マッチ：側面のヤスリ（擦る面）を上に向けて置く。
// ローカル座標：原点 = ヤスリ面の中心、+Y = ヤスリ面の法線、X = ヤスリの長手方向
export function createMatchbox() {
  const group = new THREE.Group();
  group.add(partMesh("matchbox", "matchbox"));
  return { group, striker: { halfLength: 0.068, halfWidth: 0.021 } };
}

// 紙マッチ（ブックマッチ）：表紙の端にヤスリの帯。帯を上に向けて置く。
// ローカル座標：原点 = ヤスリ帯の中心、+Y = 法線
export function createMatchbook() {
  const group = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ color: "#1b2740", roughness: 0.85 });
  const top = new THREE.MeshStandardMaterial({ map: getImage("matchbook"), roughness: 0.78 });
  // BoxGeometry の面の順番：+x, -x, +y, -y, +z, -z
  const cover = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.007, 0.065, 2, 0.002), [side, side, top, side, side, side]);
  cover.position.set(0, -0.0035, 0.018);
  cover.castShadow = true;
  group.add(cover);
  return { group, striker: { halfLength: 0.05, halfWidth: 0.008 } };
}
