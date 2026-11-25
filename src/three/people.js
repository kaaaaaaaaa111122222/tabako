import * as THREE from "three";
import { getModel } from "../assets.js";
import { POSES, applyPose, createHand } from "./hand.js";

/*
 * お邪魔イベントで横から顔を出す人。
 *   variant: "ojisan"（一本くれよおじさん）/ "salaryman"（ライター貸してくださいおじさん）
 * group の原点 = 首の付け根。+Z が顔の正面。モデルの骨は tools/assetgen/bl_people.py で入れてある。
 */

export const STRANGER_SCALE = 1.25;
const HAND_SCALE = 0.125; // 体に対する手の大きさ（手のひらの長さ）
const MAX_STRETCH = 1.75; // 腕を伸ばせる倍率（デフォルメ）
const HAND_HOLD = 0.6; // 手首から、差し出す点（手のひらの中ほど）まで（手のひらの長さに対する割合）

const DOWN = new THREE.Vector3(0, -1, 0);

export function createStranger(variant = "ojisan") {
  const model = getModel(variant);
  const group = new THREE.Group();
  group.scale.setScalar(STRANGER_SCALE);
  group.add(model);

  let body = null;
  model.traverse((object) => {
    if (object.isSkinnedMesh) body = object;
  });
  body.frustumCulled = false;
  const talkIndex = body.morphTargetDictionary?.talk ?? -1;
  const bones = Object.fromEntries(body.skeleton.bones.map((bone) => [bone.name, bone]));
  const headBone = bones.head;
  const headRest = headBone.quaternion.clone();
  const head = new THREE.Object3D();
  head.position.set(0, 0.16, 0);
  group.add(head);

  // 腕：+X 側（px、その人の左腕）と -X 側（nx、右腕）
  const arms = {};
  for (const [key, side] of [
    ["px", 1],
    ["nx", -1],
  ]) {
    const [upper, fore, wrist] = [0, 1, 2].map((index) => bones[`arm_${key}_${index}`]);
    const shoulder = upper.position.clone();
    const elbow = fore.position.clone();
    const end = wrist.position.clone();
    const hand = createHand({ side: side > 0 ? "left" : "right" });
    hand.root.scale.setScalar(HAND_SCALE);
    group.add(hand.root);
    arms[key] = {
      side,
      upper,
      fore,
      hand,
      shoulder,
      lengths: [elbow.distanceTo(shoulder), end.distanceTo(elbow)],
      restDirs: [elbow.clone().sub(shoulder).normalize(), end.clone().sub(elbow).normalize()],
      restQuats: [upper.quaternion.clone(), fore.quaternion.clone()],
      lean: new THREE.Vector3(),
    };
  }

  const target = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const elbowPos = new THREE.Vector3();
  const along = new THREE.Vector3();
  const back = new THREE.Vector3();
  const thumbSide = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const swing = new THREE.Quaternion();
  const wristPos = new THREE.Vector3();

  function aimBone(bone, position, direction, restDir, restQuat, stretch) {
    bone.position.copy(position);
    bone.quaternion.copy(swing.setFromUnitVectors(restDir, direction)).multiply(restQuat);
    bone.scale.set(1, stretch, 1);
  }

  // 手首が wrist（group のローカル座標）に来るように腕を曲げる（2 関節の逆運動学）
  function solveArm(arm, wrist) {
    toTarget.subVectors(wrist, arm.shoulder);
    const distance = Math.max(0.05, toTarget.length());
    toTarget.multiplyScalar(1 / distance);
    const reach = (arm.lengths[0] + arm.lengths[1]) * 0.985;
    const stretch = THREE.MathUtils.clamp(distance / reach, 1, MAX_STRETCH);
    const a = arm.lengths[0] * stretch;
    const b = arm.lengths[1] * stretch;
    const reachable = Math.min(distance, (a + b) * 0.999);
    const cos = THREE.MathUtils.clamp((a * a + reachable * reachable - b * b) / (2 * a * reachable), -1, 1);
    // ひじは下・外へ
    pole.set(arm.side * 0.5, -1, -0.25);
    pole.addScaledVector(toTarget, -pole.dot(toTarget)).normalize();
    elbowPos.copy(toTarget).multiplyScalar(cos * a).addScaledVector(pole, Math.sqrt(Math.max(0, 1 - cos * cos)) * a);
    along.copy(elbowPos).normalize();
    aimBone(arm.upper, arm.shoulder, along, arm.restDirs[0], arm.restQuats[0], stretch);
    wristPos.copy(toTarget).multiplyScalar(reachable).sub(elbowPos);
    elbowPos.add(arm.shoulder);
    along.copy(wristPos).normalize();
    aimBone(arm.fore, elbowPos, along, arm.restDirs[1], arm.restQuats[1], stretch);
    wristPos.add(elbowPos);
    return along;
  }

  // 手首の位置に手を置く（along = 指先の向き、back = 手の甲の向き）
  function placeHand(arm, direction, dorsal) {
    back.copy(dorsal).addScaledVector(direction, -dorsal.dot(direction)).normalize();
    thumbSide.crossVectors(direction, back);
    arm.hand.root.quaternion.setFromRotationMatrix(basis.makeBasis(thumbSide, direction, back));
    arm.hand.root.position.copy(wristPos);
    // 前腕は袖の中へまっすぐ
    arm.hand.wrist.quaternion.identity();
    arm.hand.wristHalf.quaternion.identity();
  }

  const restDorsal = new THREE.Vector3();
  function hang(arm) {
    wristPos.set(arm.side * 0.06, -0.94, 0.1).multiplyScalar((arm.lengths[0] + arm.lengths[1]) * 1.25).add(arm.shoulder);
    target.copy(wristPos);
    const direction = solveArm(arm, target);
    placeHand(arm, direction, restDorsal.set(arm.side, 0, 0.3));
    applyPose(arm.hand, POSES.relaxed);
  }

  return {
    group,
    head,
    // 手を worldTarget へ伸ばす。palmUp = 手のひらを上に向けて「ちょうだい」
    reach(worldTarget, { palmUp = true } = {}) {
      group.updateMatrixWorld(true);
      // 相手（画面の中央）に近い側の腕を使う
      const inner = group.position.x < 0 ? arms.px : arms.nx;
      const outer = inner === arms.px ? arms.nx : arms.px;
      group.worldToLocal(target.copy(worldTarget));
      along.subVectors(target, inner.shoulder).normalize();
      target.addScaledVector(along, -HAND_SCALE * HAND_HOLD);
      const direction = solveArm(inner, target);
      placeHand(inner, direction, palmUp ? DOWN : restDorsal.set(0, 0.9, 0.4));
      applyPose(inner.hand, palmUp ? POSES.relaxed : POSES.flat);
      hang(outer);
    },
    // 話している間は口が動き、頭が揺れる
    talk(time, amount) {
      if (talkIndex >= 0) {
        const open = Math.max(0, Math.sin(time * 17) * 0.6 + Math.sin(time * 29 + 1) * 0.4);
        body.morphTargetInfluences[talkIndex] = open * 1.3 * amount;
      }
      swing.setFromEuler(headEuler.set(Math.sin(time * 4.1) * 0.05 * amount, Math.sin(time * 1.7) * 0.06, Math.sin(time * 3) * 0.06 * amount));
      headBone.quaternion.copy(swing).multiply(headRest);
    },
    add(scene) {
      scene.add(group);
    },
    setVisible(visible) {
      group.visible = visible;
    },
  };
}

const headEuler = new THREE.Euler();
