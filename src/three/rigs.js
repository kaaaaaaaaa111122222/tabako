import * as THREE from "three";
import { POSES, applyPose, blendPose, clonePose, createHand } from "./hand.js";
import { createLighter, createMatch } from "./props.js";

export const HAND_SCALE = 0.24;
export const LIGHTER_SCALE = 0.3;

// ライターを握る右手：指は FINGER_DIR の方向へ伸びてライターを包み、親指が上からホイールに乗る
const FINGER_DIR = new THREE.Vector3(-0.8, 0.1, -0.6).normalize();
// 手のローカル座標で、ライターの中心軸が通る位置（掌に沿う位置。POSES.grip とセットで決まる）
const GRIP_POINT = new THREE.Vector3(0.02, 0.655, -0.285);

export function createLighterRig() {
  const group = new THREE.Group();
  const hand = createHand({ side: "right" });
  hand.root.scale.setScalar(HAND_SCALE);

  const axisX = new THREE.Vector3(0, -1, 0); // 人差し指 → 小指 が下向き
  const axisY = FINGER_DIR.clone().addScaledVector(axisX, -FINGER_DIR.dot(axisX)).normalize();
  const axisZ = new THREE.Vector3().crossVectors(axisX, axisY);
  hand.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axisX, axisY, axisZ));
  hand.root.position.copy(GRIP_POINT).multiplyScalar(-HAND_SCALE).applyQuaternion(hand.root.quaternion);
  group.add(hand.root);

  // ライターの取り付け位置（前＝炎側を指の向きへ）
  const mount = new THREE.Object3D();
  mount.rotation.y = Math.atan2(-axisY.x, -axisY.z);
  group.add(mount);

  const lighter = createLighter();
  lighter.group.scale.setScalar(LIGHTER_SCALE);

  // 親指の「ホイールに乗せた姿勢」と「レバーまで押し込んだ姿勢」を求める
  mount.add(lighter.group);
  group.updateMatrixWorld(true);
  const target = new THREE.Vector3();
  const thumbUp = solveThumb(hand, lighter.thumbStart.getWorldPosition(target).clone(), POSES.grip.t);
  const thumbDown = solveThumb(hand, lighter.thumbEnd.getWorldPosition(target).clone(), thumbUp);
  mount.remove(lighter.group);

  const gripUp = clonePose(POSES.grip);
  gripUp.t = thumbUp;
  const gripDown = clonePose(POSES.grip);
  gripDown.t = thumbDown;
  applyPose(hand, POSES.relaxed);

  return { group, hand, mount, lighter, gripUp, gripDown };
}

// 親指の anchor（tip = 当たり判定の中心、pad = 腹の表面）が targetWorld に来る関節角を座標降下法で探す
export function solveThumb(hand, targetWorld, initial, { step: initialStep = 0.3, iterations = 400, anchor = "tip" } = {}) {
  const params = initial.slice();
  const pose = clonePose(POSES.grip);
  const tip = new THREE.Vector3();
  const limits = [
    [-0.6, 1.6],
    [-1.2, 1.0],
    [-0.3, 1.5],
    [-0.3, 1.5],
  ];
  const cost = (p) => {
    pose.t = p;
    applyPose(hand, pose);
    hand.root.updateMatrixWorld(true);
    hand.thumb[anchor].getWorldPosition(tip);
    // 届けばよいので、関節は曲げすぎないように少しだけ罰を与える
    const effort = 0.0004 * (p[1] * p[1] + p[2] * p[2] * 0.5 + p[3] * p[3] * 0.5);
    return tip.distanceToSquared(targetWorld) + effort * HAND_SCALE * HAND_SCALE;
  };
  let best = cost(params);
  let step = initialStep;
  for (let iteration = 0; iteration < iterations && step > 0.001; iteration += 1) {
    let improved = false;
    for (let k = 0; k < 4; k += 1) {
      for (const delta of [step, -step]) {
        const previous = params[k];
        params[k] = THREE.MathUtils.clamp(previous + delta, limits[k][0], limits[k][1]);
        const value = cost(params);
        if (value < best) {
          best = value;
          improved = true;
        } else {
          params[k] = previous;
        }
      }
    }
    if (!improved) step *= 0.5;
  }
  return params;
}

// 風よけの左手：手のひらを炎へ向けて立てる
export function createShieldRig() {
  const hand = createHand({ side: "left" });
  hand.root.scale.setScalar(HAND_SCALE);
  applyPose(hand, POSES.flat);
  return { hand };
}

// 紙マッチの本体を持つ左手。group の原点 = ヤスリの帯の中心（本体は奥 = -Z へ広がる）
export function createBookRig() {
  const group = new THREE.Group();
  const hand = createHand({ side: "left" });
  hand.root.scale.setScalar(HAND_SCALE);
  // 掌を上に、指先を右・奥へ
  const axisY = new THREE.Vector3(0.9, 0.06, -0.42).normalize();
  const axisZ = new THREE.Vector3(-0.1, -1, -0.12);
  axisZ.addScaledVector(axisY, -axisZ.dot(axisY)).normalize();
  const axisX = new THREE.Vector3().crossVectors(axisY, axisZ);
  hand.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axisX, axisY, axisZ));
  group.add(hand.root);

  const hold = clonePose(POSES.hold);
  applyPose(hand, hold);
  group.updateMatrixWorld(true);
  // 人差し指と中指の腹が、本体の裏に触れる
  const pads = [0, 1].map((index) => hand.fingers[index].pad.getWorldPosition(new THREE.Vector3()));
  const under = pads[0].add(pads[1]).multiplyScalar(0.5);
  hand.root.position.add(new THREE.Vector3(-0.004, -0.0075, -0.034).sub(under));
  group.updateMatrixWorld(true);
  // 親指の腹は、表紙の上
  hold.t = solveThumb(hand, new THREE.Vector3(-0.03, 0.0006, -0.036), hold.t, { anchor: "pad" });
  const open = clonePose(hold);
  open.f = open.f.map(([a, b, c, d]) => [a * 0.35, b * 0.5, c * 0.5, d]);
  open.t = [hold.t[0] - 0.22, hold.t[1], hold.t[2] * 0.4, hold.t[3] * 0.4];
  const pose = clonePose(hold);
  applyPose(hand, pose);
  return {
    group,
    hand,
    // amount: 0 = 力が抜けている, 1 = しっかり持っている
    update(amount) {
      blendPose(open, hold, amount, pose);
      applyPose(hand, pose);
      hand.root.updateMatrixWorld(true);
    },
  };
}

// 煙草を人差し指と中指で挟む左手。group の原点 = 挟んでいる点、-X = 火種の方向
export function createSmokeRig() {
  const group = new THREE.Group();
  const hand = createHand({ side: "left" });
  hand.root.scale.setScalar(HAND_SCALE);
  const pose = clonePose(POSES.smoke);
  applyPose(hand, pose);
  hand.root.updateMatrixWorld(true);

  const [index, middle] = hand.fingers;
  const onFinger = (finger, t) => finger.joints[1].localToWorld(new THREE.Vector3(0, finger.def.lengths[1] * t, 0));
  const a = onFinger(index, 0.75);
  const b = onFinger(middle, 0.5);
  const grip = a.clone().add(b).multiplyScalar(0.5);
  const across = b.clone().sub(a).normalize();
  const direction = (joint, v) => v.clone().transformDirection(joint.matrixWorld);
  const up = new THREE.Vector3(0, 1, 0);
  const along = direction(index.joints[1], up).add(direction(middle.joints[1], up)).normalize();
  // 煙草は 2 本の指にも指の向きにも直角で、手の甲の側へ出る
  const axis = new THREE.Vector3().crossVectors(along, across).normalize();
  const dorsal = direction(index.joints[1], new THREE.Vector3(0, 0, 1));
  if (axis.dot(dorsal) < 0) axis.negate();

  const x = axis.clone().negate();
  const y = along.clone().addScaledVector(x, -along.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  const inverse = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).invert();
  hand.root.quaternion.copy(inverse);
  hand.root.position.copy(grip).negate().applyQuaternion(inverse);
  group.add(hand.root);
  return { group, hand, pose };
}

// マッチをつまむ右手。group の原点 = つまんでいる点。マッチは mount に付ける（+Y が頭の向き）
// aim: マッチの向き axis と、手の甲の向き back（group のローカル座標）。省くと素の向きのまま
export function createMatchRig(kind = "box", aim = null) {
  const fingerDir = new THREE.Vector3(-0.55, 0.45, -0.7);
  const backDir = new THREE.Vector3(0.35, 0.85, 0.2);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const hand = createHand({ side: "right" });
  hand.root.scale.setScalar(HAND_SCALE);
  const axisY = fingerDir.clone().normalize();
  const axisZ = backDir.clone().addScaledVector(axisY, -backDir.dot(axisY)).normalize();
  const axisX = new THREE.Vector3().crossVectors(axisY, axisZ);
  hand.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axisX, axisY, axisZ));
  body.add(hand.root);

  // 人差し指の腹の表面から、マッチの太さ分だけ離れた所に親指の腹を合わせる
  const pinch = clonePose(POSES.pinch);
  applyPose(hand, pinch);
  group.updateMatrixWorld(true);
  const match = createMatch(kind);
  const index = hand.fingers[0];
  const indexPad = index.pad.getWorldPosition(new THREE.Vector3());
  const frame = index.joints[2].getWorldQuaternion(new THREE.Quaternion());
  const padOut = new THREE.Vector3(0, 0, -1).applyQuaternion(frame); // 腹の外向き
  const along = new THREE.Vector3(0, 1, 0).applyQuaternion(frame); // 指先の向き
  const thumbTarget = indexPad.clone().addScaledVector(padOut, match.thickness);
  pinch.t = solveThumb(hand, thumbTarget, pinch.t, { anchor: "pad" });
  const loose = clonePose(POSES.pinchLoose);
  loose.t = pinch.t.slice();
  applyPose(hand, pinch);
  group.updateMatrixWorld(true);

  // つまむ点（腹と腹のまんなか）を group の原点に合わせる
  const pinchPoint = indexPad.clone().addScaledVector(padOut, match.thickness / 2);
  hand.root.position.sub(pinchPoint);
  group.updateMatrixWorld(true);

  // マッチは腹に挟まれた面の中で、指先の向きへ（中指にかぶらないよう少し親指側へ）突き出す
  const mount = new THREE.Object3D();
  const matchAxis = along.clone().multiplyScalar(0.85).addScaledVector(axisX, -0.5);
  matchAxis.addScaledVector(padOut, -matchAxis.dot(padOut)).normalize();
  mount.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(matchAxis, padOut), matchAxis, padOut),
  );
  body.add(mount);
  match.group.position.y = -match.length * 0.28;
  mount.add(match.group);

  if (aim) {
    group.updateMatrixWorld(true);
    body.quaternion.copy(alignAxis(matchAxis, aim.axis, axisZ, aim.back));
    group.updateMatrixWorld(true);
  }

  return { group, hand, mount, match, pinch, loose };
}

// from を to へ向け、そのうえで spinFrom が spinTo の側に来るように to の軸まわりにひねる回転
export function alignAxis(from, to, spinFrom, spinTo) {
  const axis = to.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), axis);
  const flatten = (v) => v.clone().addScaledVector(axis, -v.dot(axis)).normalize();
  const a = flatten(spinFrom.clone().applyQuaternion(quaternion));
  const b = flatten(spinTo);
  const angle = Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(axis), a.dot(b));
  return quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
}
