import * as THREE from "three";
import { getPart } from "../assets.js";

/*
 * 手のリグ（手のひら + 指3関節 × 4 + 親指 + 手首）。見た目は assets/models/hand.glb のスキンメッシュ。
 * モデルはこのリグの寸法に合わせてあるので（tools/assetgen/bl_hand.py）、寸法を変えるときは両方直す。
 *
 * 手のローカル座標（右手基準、単位 = 手のひらの長さ）
 *   原点 = 手首、+Y = 指先方向、+Z = 手の甲、-Z = 手のひら、-X = 親指側
 * 左手は内部の mirror グループで X を反転して作る。
 */

const lerp = THREE.MathUtils.lerp;

const skinMaterial = new THREE.MeshPhysicalMaterial({
  color: "#fff4ee",
  roughness: 0.58,
  metalness: 0,
  sheen: 0.35,
  sheenRoughness: 0.55,
  sheenColor: new THREE.Color("#ff9a80"),
});

// 関節間の長さと、指先の腹の位置 pad = [節の長さに対する割合, 骨から腹の表面までの深さ]（モデルの実測値）
const FINGERS = [
  // 人差し指・中指・薬指・小指
  { base: [-0.3, 0.9, 0.0], splay: 0.06, lengths: [0.41, 0.25, 0.19], pad: [0.7, 0.089], tip: [1.1, 0.02] },
  { base: [-0.1, 0.93, 0.005], splay: 0.0, lengths: [0.46, 0.29, 0.205], pad: [0.7, 0.094], tip: [1.1, 0.02] },
  { base: [0.1, 0.9, 0.0], splay: -0.05, lengths: [0.43, 0.27, 0.195], pad: [0.7, 0.094], tip: [1.1, 0.02] },
  { base: [0.29, 0.82, -0.01], splay: -0.13, lengths: [0.34, 0.205, 0.175], pad: [0.7, 0.08], tip: [1.1, 0.02] },
];

// 親指は「伸びる向き」と「爪の向き」から姿勢を組み立てる
function thumbOrientation() {
  const along = new THREE.Vector3(-0.52, 0.76, -0.4).normalize();
  const nail = new THREE.Vector3(-0.72, 0.05, 0.69);
  nail.addScaledVector(along, -nail.dot(along)).normalize();
  const side = new THREE.Vector3().crossVectors(along, nail);
  const basis = new THREE.Matrix4().makeBasis(side, along, nail);
  return new THREE.Euler().setFromRotationMatrix(basis);
}

const THUMB = {
  base: [-0.26, 0.12, -0.09],
  orient: thumbOrientation(),
  lengths: [0.38, 0.29, 0.24],
  pad: [0.95, 0.122],
  tip: [1.14, 0.056],
};

/* ------------------------------------------------------------------ */
/* リグ                                                                */
/* ------------------------------------------------------------------ */

// 手首の曲がる中心。ここから先（前腕）は袖の方へ向く
const WRIST_PIVOT = new THREE.Vector3(0, -0.06, 0);

// 関節と、同じ位置で半分だけ曲がる補助の骨（深く曲げても指が痩せないように）
function createJoint(parent, y) {
  const joint = new THREE.Group();
  const half = new THREE.Group();
  joint.position.y = y;
  half.position.y = y;
  parent.add(joint, half);
  return { joint, half };
}

function buildDigit(def, parent, { isThumb = false } = {}) {
  const base = new THREE.Group();
  base.position.fromArray(def.base);
  if (isThumb) base.rotation.copy(def.orient);
  else base.rotation.z = def.splay;
  parent.add(base);

  const joints = [];
  const halves = [];
  let current = base;
  for (let i = 0; i < 3; i += 1) {
    const { joint, half } = createJoint(current, i > 0 ? def.lengths[i - 1] : 0);
    joints.push(joint);
    halves.push(half);
    current = joint;
  }

  // pad = 指の腹の表面、tip = 腹から少し内側の点（点火画面の当たり判定の中心）
  const pad = new THREE.Object3D();
  pad.position.set(0, def.lengths[2] * def.pad[0], -def.pad[1]);
  const tip = new THREE.Object3D();
  tip.position.set(0, def.lengths[2] * def.tip[0], -def.tip[1]);
  joints[2].add(pad, tip);

  return { base, joints, halves, pad, tip, def };
}

// モデルの骨の名前（f0_0 = 人差し指の付け根、t_2 = 親指の先、末尾 h = 補助の骨）→ リグの関節
function boneOf(rig, name) {
  if (name === "palm") return rig.palm;
  if (name === "wrist") return rig.wrist;
  if (name === "wristh") return rig.wristHalf;
  const [, key, joint, half] = /^(f\d|t)_(\d)(h?)$/.exec(name);
  const digit = key === "t" ? rig.thumb : rig.fingers[Number(key[1])];
  return (half ? digit.halves : digit.joints)[Number(joint)];
}

let skin = null;
function prepareSkin() {
  const source = getPart("hand", "hand");
  const mesh = source.isSkinnedMesh ? source : source.getObjectByProperty("isSkinnedMesh", true);
  skinMaterial.map = mesh.material.map;
  skinMaterial.normalMap = mesh.material.normalMap;
  skinMaterial.normalScale.set(0.6, 0.6);
  skinMaterial.needsUpdate = true;
  skin = { geometry: mesh.geometry, names: mesh.skeleton.bones.map((bone) => bone.name), inverses: null };
}

export function createHand({ side = "right" } = {}) {
  if (!skin) prepareSkin();
  const root = new THREE.Group();
  const mirror = new THREE.Group();
  mirror.scale.x = side === "left" ? -1 : 1;
  root.add(mirror);

  const palm = new THREE.Group();
  mirror.add(palm);
  const wrist = new THREE.Group();
  wrist.position.copy(WRIST_PIVOT);
  const wristHalf = new THREE.Group();
  wristHalf.position.copy(WRIST_PIVOT);
  mirror.add(wrist, wristHalf);

  const fingers = FINGERS.map((def) => buildDigit(def, mirror));
  const thumb = buildDigit(THUMB, mirror, { isThumb: true });

  const palmAnchor = new THREE.Object3D();
  palmAnchor.position.set(0, 0.55, -0.08);
  mirror.add(palmAnchor);
  const wristAnchor = new THREE.Object3D();
  wristAnchor.position.copy(WRIST_PIVOT);
  mirror.add(wristAnchor);

  const rig = { side, root, mirror, palm, wrist, wristHalf, fingers, thumb, palmAnchor, wristAnchor };

  // 関節がすべてまっすぐな今の姿勢が、モデルの基準姿勢
  const bones = skin.names.map((name) => boneOf(rig, name));
  root.updateMatrixWorld(true);
  if (!skin.inverses) {
    const toLocal = mirror.matrixWorld.clone().invert();
    skin.inverses = bones.map((bone) => toLocal.clone().multiply(bone.matrixWorld).invert());
  }
  const mesh = new THREE.SkinnedMesh(skin.geometry, skinMaterial);
  mesh.bind(new THREE.Skeleton(bones, skin.inverses), new THREE.Matrix4());
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mirror.add(mesh);

  applyPose(rig, POSES.relaxed);
  return rig;
}

/* ------------------------------------------------------------------ */
/* ポーズ                                                              */
/* ------------------------------------------------------------------ */
// f: 指ごとに [付け根, 第2関節, 第1関節, 開き]、t: 親指 [付け根の曲げ, 付け根の開き, 中間, 先]

export const POSES = {
  relaxed: {
    f: [
      [0.22, 0.32, 0.18, 0.02],
      [0.28, 0.38, 0.2, 0],
      [0.34, 0.44, 0.24, -0.02],
      [0.4, 0.5, 0.26, -0.03],
    ],
    t: [0.15, -0.15, 0.15, 0.15],
  },
  flat: {
    f: [
      [0.06, 0.06, 0.04, -0.06],
      [0.06, 0.06, 0.04, 0],
      [0.08, 0.07, 0.05, 0.05],
      [0.1, 0.08, 0.05, 0.12],
    ],
    t: [0.05, -0.38, 0.05, 0.05],
  },
  cup: {
    f: [
      [0.55, 0.72, 0.42, -0.04],
      [0.6, 0.78, 0.46, 0],
      [0.62, 0.8, 0.48, 0.04],
      [0.66, 0.82, 0.5, 0.09],
    ],
    t: [0.35, -0.15, 0.3, 0.3],
  },
  // ライターを握る指：指の表面が本体に触れるところまで閉じた角度（実メッシュから計算した値）
  grip: {
    f: [
      [1.47, 1.29, 0.69, 0.02],
      [1.47, 1.56, 0.36, 0],
      [1.47, 1.41, 0.6, 0],
      [1.2, 1.38, 0.48, 0.02],
    ],
    t: [0.25, -0.35, 0.05, 0.08],
  },
  // 親指と人差し指でマッチをつまむ（親指の角度は rigs.js で人差し指の腹に合わせて解く）
  pinch: {
    f: [
      [0.62, 0.78, 0.38, -0.04],
      [0.78, 0.98, 0.5, 0],
      [1.15, 1.35, 0.75, 0.03],
      [1.3, 1.45, 0.8, 0.07],
    ],
    t: [0.5, -0.1, 0.25, 0.2],
  },
  // 薄い物を、下から支えて親指で押さえる（親指は rigs.js で解く）
  hold: {
    f: [
      [0.16, 0.34, 0.2, 0.03],
      [0.2, 0.38, 0.22, 0],
      [0.34, 0.5, 0.3, -0.02],
      [0.5, 0.6, 0.34, -0.03],
    ],
    t: [0.4, -0.1, 0.2, 0.2],
  },
  // 人差し指と中指で煙草を挟む
  smoke: {
    f: [
      [0.3, 0.34, 0.22, 0.1],
      [0.3, 0.34, 0.22, -0.07],
      [0.72, 0.85, 0.45, -0.02],
      [0.86, 0.95, 0.5, -0.02],
    ],
    t: [0.35, -0.2, 0.3, 0.3],
  },
  // マッチをつまむ力を抜いた指
  pinchLoose: {
    f: [
      [0.3, 0.35, 0.18, -0.06],
      [0.38, 0.42, 0.22, 0],
      [0.55, 0.6, 0.32, 0.05],
      [0.65, 0.68, 0.36, 0.1],
    ],
    t: [0.5, -0.1, 0.25, 0.2],
  },
  // ライターから指を浮かせた状態（握る力を抜いた指）
  loose: {
    f: [
      [0.75, 0.62, 0.3, -0.02],
      [0.78, 0.7, 0.28, 0],
      [0.8, 0.68, 0.3, 0.03],
      [0.72, 0.68, 0.3, 0.07],
    ],
    t: [0.25, -0.35, 0.05, 0.08],
  },
};

export function clonePose(pose) {
  return { f: pose.f.map((finger) => finger.slice()), t: pose.t.slice() };
}

export function blendPose(a, b, t, out) {
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) out.f[i][j] = lerp(a.f[i][j], b.f[i][j], t);
  }
  for (let j = 0; j < 4; j += 1) out.t[j] = lerp(a.t[j], b.t[j], t);
  return out;
}

// 現在のポーズを目標へなめらかに近づける（指ごとに少し遅れをつけて生っぽくする）
export function approachPose(current, target, delta, speed = 14) {
  for (let i = 0; i < 4; i += 1) {
    const k = 1 - Math.exp(-delta * speed * (1 - i * 0.07));
    for (let j = 0; j < 4; j += 1) current.f[i][j] += (target.f[i][j] - current.f[i][j]) * k;
  }
  const kt = 1 - Math.exp(-delta * speed * 1.2);
  for (let j = 0; j < 4; j += 1) current.t[j] += (target.t[j] - current.t[j]) * kt;
  return current;
}

export function applyPose(rig, pose) {
  rig.fingers.forEach((finger, index) => {
    const [mcp, pip, dip, spread] = pose.f[index];
    finger.base.rotation.z = finger.def.splay + spread;
    bend(finger, 0, -mcp);
    bend(finger, 1, -pip);
    bend(finger, 2, -dip);
  });
  const [cmcFlex, cmcSpread, mcp, ip] = pose.t;
  rig.thumb.joints[0].rotation.set(-cmcFlex, 0, cmcSpread);
  rig.thumb.halves[0].rotation.set(-cmcFlex / 2, 0, cmcSpread / 2);
  bend(rig.thumb, 1, -mcp);
  bend(rig.thumb, 2, -ip);
}

function bend(digit, index, angle) {
  digit.joints[index].rotation.x = angle;
  digit.halves[index].rotation.x = angle / 2;
}

/* ------------------------------------------------------------------ */
/* 前腕と袖（手首から画面外のひじへ向ける）                            */
/* ------------------------------------------------------------------ */

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const IDENTITY = new THREE.Quaternion();
const SLEEVE_START = 0.13; // 手首から袖口まで

export function createArm() {
  const source = getPart("sleeve", "sleeve");
  const group = new THREE.Group();
  const material = source.material.clone();
  material.color.setRGB(2.1, 2.1, 2.2); // 夜でも布目が見えるように、生成した紺を少し持ち上げる
  const sleeve = new THREE.Mesh(source.geometry, material);
  sleeve.position.y = SLEEVE_START;
  sleeve.castShadow = true;
  group.add(sleeve);

  const wristWorld = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const local = new THREE.Vector3();
  return {
    group,
    // 手首からひじ（ワールド座標）へ、前腕の骨と袖を向ける
    update(hand, elbowWorld) {
      hand.wristAnchor.getWorldPosition(wristWorld);
      group.position.copy(wristWorld);
      direction.subVectors(elbowWorld, wristWorld).normalize();
      group.quaternion.setFromUnitVectors(UP, direction);
      hand.mirror.worldToLocal(local.copy(elbowWorld)).sub(WRIST_PIVOT).normalize();
      hand.wrist.quaternion.setFromUnitVectors(DOWN, local);
      hand.wristHalf.quaternion.slerpQuaternions(IDENTITY, hand.wrist.quaternion, 0.5);
      hand.wrist.updateMatrixWorld(true);
      hand.wristHalf.updateMatrixWorld(true);
    },
  };
}
