import * as THREE from "three";
import { POSES, approachPose, applyPose, clonePose } from "./hand.js";
import { createAsh, createButt } from "./props.js";
import { createSmokeRig } from "./rigs.js";

/*
 * まったりモードの所作。左手の人差し指と中指で煙草を挟み、吸うときだけ口元へ運ぶ。
 *   light  新しい 1 本を口にくわえ、右手のライターで火をつける
 *   free   手元で休む ⇄ 口元で吸う（入力で動く）
 *   ash    灰皿の上へ手を伸ばして、灰を落とす
 *   stub   灰皿でもみ消して、吸い殻を捨てる
 */

const GRIP_X = 0.7; // 煙草のモデル座標で、指が挟む位置（フィルターの上）
const TIP_X = -0.32;
const BURN_RATE = { idle: 0.006, puff: 0.045 };
const ASH_PER_BURN = 0.72;
export const ASH_LIMIT = 0.15; // これより長くなると、落ちる前に自分で灰皿へ落とす
const MOUTH_TIME = 0.42; // 手元 → 口元にかかる秒数
const LUNG = { fill: 0.37, recover: 0.5 };
const MAX_BUTTS = 7;
const MAX_ASH = 12;

const LIGHT = { raise: 0.75, lighterIn: [0.45, 1.15], flame: [1.2, 2.35], catches: 1.55, lighterOut: [2.35, 3.0], end: 3.1 };
const ASH = { reach: 0.6, taps: [0.68, 0.92], back: 1.2, end: 1.75 };
const STUB = { reach: 0.65, press: 0.85, twist: 1.75, release: 1.9, end: 2.5 };

const HAND_BELOW = new THREE.Vector3(-0.62, 0.42, 7.15);
const REST = { position: new THREE.Vector3(-0.36, 0.99, 6.86), tip: new THREE.Vector3(0.3, 0.78, -0.55), finger: new THREE.Vector3(0.75, 0.2, -0.35) };
const MOUTH_FINGER = new THREE.Vector3(0.85, 0.42, 0.1);
const TAP = { tip: new THREE.Vector3(0.78, -0.42, -0.46), finger: new THREE.Vector3(0.12, 0.3, -0.95) };
const PRESS = { tip: new THREE.Vector3(0.5, -0.8, -0.34), finger: new THREE.Vector3(0.1, 0.0, -1) };
const LIGHTER_DOWN = new THREE.Vector3(0.62, 0.3, 7.15);

const ease = (t) => {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const span = (t, [from, to]) => ease((t - from) / (to - from));

export function createSmoker({ scene, camera, cig, ashtray, smoke, sfx, leftArm, rightArm, lighterRig, lighter, elbows, toast, onCough }) {
  const rig = createSmokeRig();
  rig.group.visible = false;
  scene.add(rig.group);
  const butts = [];
  const ashes = [];
  const litter = new THREE.Group(); // 灰皿の中身
  scene.add(litter);
  const rightPose = clonePose(POSES.relaxed);

  const state = {
    action: "light",
    t: 0,
    time: 0,
    count: 0,
    mouth: 0, // 0 = 手元, 1 = 口元
    inhaling: false,
    lung: 0,
    coughLock: 0,
    exhaleAmount: 0,
    exhalePending: 0,
    breath: 0, // いま吐いている息の残り時間
    breathForce: 0,
    consumed: 0,
    ash: 0,
    lit: 0,
    flameLit: false,
    smokeTimer: 0,
    stubbed: false,
    tapped: 0,
  };

  /* ---------------- 姿勢 ---------------- */

  const poseA = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const poseB = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const axisX = new THREE.Vector3();
  const axisY = new THREE.Vector3();
  const axisZ = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tray = new THREE.Vector3();
  const tipWorld = new THREE.Vector3();
  const mouthTip = new THREE.Vector3();
  const cigScale = () => cig.group.scale.x;
  const tipLength = () => (GRIP_X - (TIP_X + state.consumed * cig.burnable)) * cigScale(); // 指から火種まで

  // 煙草の向き（火種の方）と指の向きから、手の回転を作る
  function orient(tipDirection, fingerDirection, quaternion) {
    axisX.copy(tipDirection).normalize().negate();
    axisY.copy(fingerDirection).addScaledVector(axisX, -fingerDirection.dot(axisX)).normalize();
    axisZ.crossVectors(axisX, axisY);
    return quaternion.setFromRotationMatrix(basis.makeBasis(axisX, axisY, axisZ));
  }

  // 口にくわえた位置（カメラに固定された煙草の定位置）
  const mouthPosition = new THREE.Vector3();
  const mouthQuaternion = new THREE.Quaternion();
  function setMouth(position, quaternion) {
    mouthPosition.copy(position);
    mouthQuaternion.copy(quaternion);
  }
  function mouthPose(target) {
    tmp.set(GRIP_X * cigScale(), 0, 0).applyQuaternion(mouthQuaternion).add(mouthPosition);
    camera.localToWorld(target.position.copy(tmp));
    mouthTip.set(-1, 0, 0).applyQuaternion(mouthQuaternion).transformDirection(camera.matrixWorld);
    orient(mouthTip, MOUTH_FINGER, target.quaternion);
    return target;
  }
  function restPose(target, time) {
    target.position.copy(REST.position);
    target.position.x += Math.sin(time * 0.7) * 0.006;
    target.position.y += Math.sin(time * 0.95) * 0.008;
    orient(REST.tip, REST.finger, target.quaternion);
    return target;
  }
  function belowPose(target) {
    target.position.copy(HAND_BELOW);
    orient(REST.tip, REST.finger, target.quaternion);
    return target;
  }
  // 火種が tip（ワールド座標）に来る姿勢
  function tipPose(target, shape, tip) {
    tmp2.copy(shape.tip).normalize();
    target.position.copy(tip).addScaledVector(tmp2, -tipLength());
    orient(shape.tip, shape.finger, target.quaternion);
    return target;
  }
  function mix(a, b, t, arc = 0) {
    out.position.lerpVectors(a.position, b.position, t);
    out.position.y += Math.sin(Math.PI * t) * arc;
    out.quaternion.slerpQuaternions(a.quaternion, b.quaternion, t);
    return out;
  }

  function applyPoseTo(pose) {
    rig.group.position.copy(pose.position);
    rig.group.quaternion.copy(pose.quaternion);
    rig.group.updateMatrixWorld(true);
    leftArm.update(rig.hand, elbows.left);
    if (state.stubbed) return; // もう手から離した
    cig.group.quaternion.copy(pose.quaternion);
    cig.group.position.copy(pose.position).sub(tmp.set(GRIP_X * cigScale(), 0, 0).applyQuaternion(pose.quaternion));
    cig.group.updateMatrixWorld(true);
  }

  /* ---------------- 灰皿 ---------------- */

  function trayPoint(target, height) {
    ashtray.getWorldPosition(target);
    target.y += height;
    return target;
  }

  function dropAsh() {
    const length = Math.max(0.03, state.ash);
    state.ash = 0;
    sfx.ashTap();
    const mesh = createAsh(length, cigScale());
    cig.tip.getWorldPosition(mesh.position);
    mesh.quaternion.copy(cig.group.quaternion);
    litter.add(mesh);
    ashes.push({ mesh, velocity: -0.1, spin: (Math.random() - 0.5) * 5, landed: false, floor: ashtray.position.y + 0.03 + Math.random() * 0.012 });
    if (ashes.length > MAX_ASH) litter.remove(ashes.shift().mesh);
    for (let i = 0; i < 3; i += 1) {
      smoke.emit(mesh.position, { size: 0.014, grow: 0.03, life: 0.7, alpha: 0.28, vel: tmp.set((Math.random() - 0.5) * 0.08, 0.03, (Math.random() - 0.5) * 0.08) });
    }
  }

  function updateAshes(delta) {
    for (const ash of ashes) {
      if (ash.landed) continue;
      ash.velocity -= 3.2 * delta;
      ash.mesh.position.y += ash.velocity * delta;
      ash.mesh.rotation.x += ash.spin * delta;
      if (ash.mesh.position.y <= ash.floor) {
        ash.mesh.position.y = ash.floor;
        ash.mesh.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
        ash.landed = true;
      }
    }
  }

  // 吸い殻を灰皿に残す
  function leaveButt() {
    const butt = createButt(state.consumed, cigScale());
    const angle = Math.random() * Math.PI * 2;
    trayPoint(butt.position, 0.06 + Math.random() * 0.02);
    butt.position.x += Math.cos(angle) * 0.05 - cigScale() * 0.6 * Math.cos(angle);
    butt.position.z += Math.sin(angle) * 0.05 + cigScale() * 0.6 * Math.sin(angle);
    butt.rotation.set(0, angle, (Math.random() - 0.5) * 0.2);
    litter.add(butt);
    butts.push(butt);
    if (butts.length > MAX_BUTTS) litter.remove(butts.shift());
  }

  /* ---------------- 進行 ---------------- */

  function setAction(action) {
    state.action = action;
    state.t = 0;
    state.tapped = 0;
  }

  function start() {
    Object.assign(state, {
      time: 0, count: 0, mouth: 0, inhaling: false, lung: 0, coughLock: 0, exhaleAmount: 0, exhalePending: 0, breath: 0,
      consumed: 0, ash: 0, lit: 0, flameLit: false, smokeTimer: 0, stubbed: false,
    });
    litter.clear();
    butts.length = 0;
    ashes.length = 0;
    scene.add(cig.group);
    cig.group.visible = true;
    rig.group.visible = true;
    cig.setConsumed(0, 0);
    setAction("light");
  }

  function stop() {
    rig.group.visible = false;
    state.flameLit = false;
    litter.clear();
    butts.length = 0;
    ashes.length = 0;
    cig.group.visible = true;
    camera.add(cig.group);
  }

  function exhale(amount) {
    sfx.exhale(amount);
    state.breath = 0.35 + amount * 0.75;
    state.breathForce = amount;
  }

  // 細い息から、広がっていく煙へ（一度に出さず、吐いている間ずっと出す）
  function updateBreath(delta) {
    if (state.breath <= 0) return;
    state.breath -= delta;
    const amount = state.breathForce;
    let count = delta * (22 + amount * 22);
    count = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      camera.localToWorld(tmp.set((Math.random() - 0.5) * 0.03, -0.25 + (Math.random() - 0.5) * 0.02, -0.5));
      const speed = (0.75 + Math.random() * 0.5) * (0.7 + amount * 0.6);
      smoke.emit(tmp, {
        size: 0.025,
        grow: 0.45 + amount * 0.5,
        life: 1.9 + amount * 1.1,
        alpha: 0.07 + amount * 0.07,
        vel: tmp2.set((Math.random() - 0.5) * 0.22 + 0.08, 0.06 + Math.random() * 0.16, -speed),
      });
    }
  }

  function burnDown(delta) {
    if (state.lit < 0.5) return;
    const rate = (BURN_RATE.idle + (state.inhaling ? BURN_RATE.puff : 0)) * delta;
    state.consumed = Math.min(1, state.consumed + rate);
    state.ash = Math.min(ASH_LIMIT * 1.4, state.ash + rate * ASH_PER_BURN);
  }

  // 右手のライター（火をつけるときだけ出てくる）
  const lighterGoal = new THREE.Vector3();
  function updateLighter(amount, flameHot, delta) {
    const shown = amount > 0.001;
    lighterRig.group.visible = shown;
    rightArm.group.visible = shown;
    lighter.group.visible = shown;
    if (!shown) return;
    // 炎のいちばん熱い所が火種に来る位置
    cig.tip.getWorldPosition(tipWorld);
    lighterGoal.copy(lighterRig.group.position).add(tipWorld).sub(flameHot);
    lighterRig.group.position.lerpVectors(LIGHTER_DOWN, lighterGoal, amount);
    lighterRig.group.rotation.set(0, 0, 0);
    approachPose(rightPose, state.flameLit ? lighterRig.gripDown : lighterRig.gripUp, delta, 14);
    applyPose(lighterRig.hand, rightPose);
    lighterRig.group.updateMatrixWorld(true);
    lighterRig.mount.getWorldPosition(lighter.group.position);
    lighterRig.mount.getWorldQuaternion(lighter.group.quaternion);
    lighter.group.updateMatrixWorld(true);
    rightArm.update(lighterRig.hand, elbows.right);
  }

  // input: { inhale: 吸う, tap: 灰を落とす }
  function update(delta, time, input, flameHot) {
    state.t += delta;
    state.time += delta;
    state.coughLock = Math.max(0, state.coughLock - delta);
    trayPoint(tray, 0);
    let lighterAmount = 0;
    let wasInhaling = state.inhaling;
    state.inhaling = false;

    if (state.action === "light") {
      // くわえる → ライターで火をつける
      const raise = ease(state.t / LIGHT.raise);
      applyPoseTo(mix(belowPose(poseA), mouthPose(poseB), raise));
      lighterAmount = span(state.t, LIGHT.lighterIn) * (1 - span(state.t, LIGHT.lighterOut));
      const flameOn = state.t >= LIGHT.flame[0] && state.t < LIGHT.flame[1];
      if (flameOn && !state.flameLit) {
        sfx.strike("good");
        sfx.ignite();
      }
      state.flameLit = flameOn;
      if (state.t >= LIGHT.catches && state.lit < 1) {
        if (state.lit === 0) sfx.inhale();
        state.lit = Math.min(1, state.lit + delta * 1.6);
        state.inhaling = true;
        state.exhaleAmount = 0.45;
      }
      if (state.t >= LIGHT.end) {
        state.mouth = 1;
        state.flameLit = false;
        state.exhalePending = 0.35;
        setAction("free");
      }
    } else if (state.action === "free") {
      const wants = input.inhale && state.coughLock === 0;
      state.mouth = THREE.MathUtils.clamp(state.mouth + (wants ? delta : -delta) / MOUTH_TIME, 0, 1);
      const m = ease(state.mouth);
      applyPoseTo(mix(restPose(poseA, time), mouthPose(poseB), m, 0.03));
      state.inhaling = wants && state.mouth > 0.96;
      if (state.inhaling) {
        if (!wasInhaling) sfx.inhale();
        state.lung = Math.min(1, state.lung + LUNG.fill * delta);
        state.exhaleAmount = Math.max(state.exhaleAmount, state.lung);
      } else if (wasInhaling && state.exhaleAmount > 0.08) {
        state.exhalePending = 0.45; // 手をどけてから吐く
      }
      if (state.lung >= 1) {
        state.lung = 0.35;
        state.coughLock = 1.2;
        state.exhaleAmount = 0;
        state.exhalePending = 0;
        state.inhaling = false;
        onCough();
      }
      burnDown(delta);
      if (state.consumed >= 1) setAction("stub");
      else if (state.ash >= ASH_LIMIT || (input.tap && state.ash > 0.02)) setAction("ash");
    } else if (state.action === "ash") {
      // 灰皿の上で軽くたたく
      state.mouth = Math.max(0, state.mouth - delta / MOUTH_TIME);
      tipPose(poseB, TAP, tmp.copy(tray).add(tmp2.set(0.02, 0.17, 0.02)));
      mix(restPose(poseA, time), poseB, state.t < ASH.back ? ease(state.t / ASH.reach) : 1 - span(state.t, [ASH.back, ASH.end]), 0.06);
      ASH.taps.forEach((at, index) => {
        const hit = Math.max(0, 1 - Math.abs(state.t - at) / 0.07);
        out.position.y -= hit * 0.03;
        if (state.t >= at && state.tapped === index) {
          state.tapped += 1;
          if (index === 0) dropAsh();
          else sfx.ashTap();
        }
      });
      applyPoseTo(out);
      burnDown(delta);
      if (state.t >= ASH.end) setAction("free");
    } else if (state.action === "stub") {
      // 灰皿に押し付けてもみ消し、吸い殻を離す
      const press = span(state.t, [STUB.reach, STUB.press]);
      const twisting = state.t > STUB.press && state.t < STUB.twist;
      const height = THREE.MathUtils.lerp(0.2, 0.05, press);
      tipPose(poseB, PRESS, tmp.copy(tray).add(tmp2.set(0.01, height, 0)));
      if (state.t < STUB.release) {
        mix(restPose(poseA, time), poseB, ease(state.t / STUB.reach), 0.06);
        if (twisting) {
          out.position.x += Math.sin(state.t * 16) * 0.012;
          out.position.z += Math.cos(state.t * 16) * 0.01;
          state.lit = Math.max(0, state.lit - delta * 1.6);
          if (Math.random() < delta * 14) smoke.emit(cig.tip.getWorldPosition(tmp), { size: 0.02, grow: 0.14, life: 1.5, alpha: 0.3 });
        }
        applyPoseTo(out);
        if (state.t >= STUB.press && state.tapped === 0) {
          state.tapped = 1;
          state.ash = 0;
          sfx.stub();
        }
      } else {
        if (!state.stubbed) {
          state.stubbed = true;
          state.lit = 0;
          state.count += 1;
          leaveButt();
          cig.group.visible = false;
          toast(`${state.count} 本吸い終わった`, "good");
        }
        applyPoseTo(mix(poseB, belowPose(poseA), span(state.t, [STUB.release, STUB.end])));
      }
      if (state.t >= STUB.end) {
        // 次の 1 本
        state.stubbed = false;
        state.consumed = 0;
        state.ash = 0;
        cig.group.visible = true;
        sfx.pickup();
        setAction("light");
      }
    }

    if (!state.inhaling) state.lung = Math.max(0, state.lung - LUNG.recover * delta);
    if (state.exhalePending > 0) {
      state.exhalePending -= delta;
      if (state.exhalePending <= 0) {
        exhale(state.exhaleAmount);
        state.exhaleAmount = 0;
      }
    }
    updateBreath(delta);
    updateLighter(lighterAmount, flameHot, delta);
    updateAshes(delta);
    cig.setConsumed(state.consumed, state.ash);

    // 火種から立ちのぼる煙
    state.smokeTimer -= delta;
    if (state.lit > 0.5 && state.smokeTimer <= 0 && !state.stubbed) {
      cig.tip.getWorldPosition(tmp);
      smoke.emit(tmp, state.inhaling ? { size: 0.02, grow: 0.09, life: 1.3, alpha: 0.34 } : { size: 0.012, grow: 0.12, life: 2.8, alpha: 0.28 });
      state.smokeTimer = state.inhaling ? 0.08 : 0.16;
    }
  }

  return { state, start, stop, update, setMouth, rig };
}
