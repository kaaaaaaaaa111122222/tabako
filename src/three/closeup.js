import * as THREE from "three";
import { POSES, applyPose, clonePose, createArm } from "./hand.js";
import { LIGHTER_SCALE, createLighterRig, solveThumb } from "./rigs.js";
import { LIGHTER_LAYOUT } from "./props.js";
import { createFlame, createSparks } from "./effects.js";
import { createBlurBackdrop } from "./environment.js";
import { radialTexture } from "./textures.js";

/*
 * 点火画面：手元にズームして、親指・握る指を細かく動かしてライターをつける。
 *
 * 親指の動きはライターを真横から見た 2D 平面で扱う（単位はライターのローカル単位）
 *   u = 前方向（ライターの -Z、炎とレバーの側）、v = 上（Y）
 */

const L = LIGHTER_LAYOUT;
const WHEEL = { u: -L.wheel.z, v: L.wheel.y, r: L.wheel.radius };
const LEVER = {
  u0: -(L.lever.z + L.lever.depth / 2),
  u1: -(L.lever.z - L.lever.depth / 2),
  top: L.lever.y + L.lever.height / 2,
  travel: L.lever.travel,
};
const HOOD = { u: -L.hood.frontOfWheel, top: L.hood.top };
const SHOULDER_TOP = L.shoulderTop;
const THUMB_RADIUS = 0.035; // 親指の腹の当たり判定
const PUSH_DEPTH = 0.07; // クリックで押し付けたときに目標が沈む量
const REGION = { u0: -0.24, u1: 0.12, v0: 0.36, v1: 0.68 };
const REST_TARGET = { u: 0.045, v: 0.6 }; // ホイールの上・前寄り。ここから手前へ擦り下ろす

const SPARK = { minSpeed: 0.5, rate: 5, decay: 0.2 };
// 火花の熱：擦るたびに溜まり、ゆっくり冷める。満タンで、火花が残っているうちにレバーを押すと点火
const HEAT = { gain: 1.5, cool: 0.05, max: 1.3, freshSpark: 0.02 };
const FINGER_WEIGHTS = [0.3, 0.3, 0.24, 0.16]; // 人差し指・中指・薬指・小指
const CAMERA_DISTANCE = 0.62;

const GRID = { u0: -0.25, u1: 0.13, nu: 10, v0: 0.36, v1: 0.69, nv: 8 };

const smoothstep = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createCloseup() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0a0f18");
  scene.environmentIntensity = 0.6;

  scene.add(new THREE.HemisphereLight("#a5b4d4", "#4a3d33", 1.0));
  const key = new THREE.DirectionalLight("#ffe2c4", 2.1);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#7f9dff", 1.6);
  scene.add(rim);

  // 右手とライター
  const rig = createLighterRig();
  rig.mount.add(rig.lighter.group);
  rig.lighter.group.scale.setScalar(LIGHTER_SCALE);
  // ライターの前（炎側）が画面の右へ向くように回す
  const forwardInRig = new THREE.Vector3(0, 0, -1).applyEuler(rig.mount.rotation);
  rig.group.rotation.y = Math.atan2(forwardInRig.z, forwardInRig.x) * -1 + 0;
  scene.add(rig.group);
  rig.group.updateMatrixWorld(true);
  const lighter = rig.lighter;
  const hand = rig.hand;
  const mountRest = { position: rig.mount.position.clone(), quaternion: rig.mount.quaternion.clone() };

  const arm = createArm();
  scene.add(arm.group);

  // 炎・火花
  const flame = createFlame();
  scene.add(flame.mesh, flame.halo);
  const flameLight = new THREE.PointLight("#ffa04d", 0, 1.2, 1);
  scene.add(flameLight);
  const sparks = createSparks(120);
  scene.add(sparks.object);

  // カメラ：ライターの真横から
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);
  const focus = lighter.group.localToWorld(new THREE.Vector3(0, 0.36, 0.02));
  const sideDir = new THREE.Vector3(-1, 0, 0).applyQuaternion(lighter.group.getWorldQuaternion(new THREE.Quaternion()));
  const forwardWorld = new THREE.Vector3(0, 0, -1).applyQuaternion(lighter.group.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const upWorld = new THREE.Vector3(0, 1, 0);
  function placeCamera(distance) {
    camera.position.copy(focus).addScaledVector(sideDir, distance).addScaledVector(upWorld, distance * 0.22);
    camera.position.addScaledVector(forwardWorld, -distance * 0.12);
    camera.lookAt(focus);
  }
  placeCamera(CAMERA_DISTANCE);
  camera.updateMatrixWorld(true);
  key.position.copy(focus).addScaledVector(sideDir, 1).add(new THREE.Vector3(0, 1.4, 0)).addScaledVector(forwardWorld, 0.6);
  rim.position.copy(focus).addScaledVector(sideDir, -1.2).add(new THREE.Vector3(0, 0.5, 0)).addScaledVector(forwardWorld, -0.8);
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const screenSign = Math.sign(forwardWorld.dot(cameraRight)) || 1;

  // 背景：ピントの外れた景色（場所ごとに差し替える）
  const backdrop = createBlurBackdrop(camera);
  scene.add(backdrop.plane);

  // 親指の通り道のガイド（ホイールの上 → 手前へ擦り下ろす → レバー）。点が流れて向きを示す
  const guidePath = [];
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI * 0.3 + (i / 10) * Math.PI * 0.6;
    guidePath.push(new THREE.Vector3(-0.16, WHEEL.v + Math.sin(a) * (WHEEL.r + 0.045), -(WHEEL.u + Math.cos(a) * (WHEEL.r + 0.045))));
  }
  guidePath.push(new THREE.Vector3(-0.16, LEVER.top + 0.05, 0.105));
  guidePath.push(new THREE.Vector3(-0.16, LEVER.top + 0.02, 0.11));
  const dotTexture = radialTexture([
    [0, "rgba(255,225,170,1)"],
    [0.45, "rgba(255,205,115,0.8)"],
    [1, "rgba(255,205,115,0)"],
  ]);
  const guideDots = guidePath.map((point) => {
    const dot = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dotTexture, transparent: true, depthTest: false, depthWrite: false }),
    );
    dot.position.copy(point);
    dot.scale.setScalar(0.03);
    dot.renderOrder = 9;
    lighter.group.add(dot);
    return dot;
  });

  // マウスの狙い位置の目印（小さな点）
  const targetMarker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture([
        [0, "rgba(255,255,255,0.9)"],
        [0.35, "rgba(255,255,255,0.5)"],
        [1, "rgba(255,255,255,0)"],
      ]),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  targetMarker.scale.setScalar(0.011);
  targetMarker.renderOrder = 10;
  scene.add(targetMarker);

  /* ---------------- 親指の逆運動学（あらかじめ格子状に解いておく） ---------------- */

  const grid = [];
  {
    const target = new THREE.Vector3();
    let rowStart = rig.gripUp.t.slice();
    for (let j = 0; j < GRID.nv; j += 1) {
      const v = GRID.v0 + ((GRID.v1 - GRID.v0) * j) / (GRID.nv - 1);
      const row = [];
      let previous = rowStart;
      for (let i = 0; i < GRID.nu; i += 1) {
        const u = GRID.u0 + ((GRID.u1 - GRID.u0) * i) / (GRID.nu - 1);
        lighter.group.localToWorld(target.set(0, v, -u));
        const params = solveThumb(hand, target, previous, { step: 0.14, iterations: 140 });
        row.push(params);
        previous = params;
        if (i === 0) rowStart = params;
      }
      grid.push(row);
    }
  }
  function sampleThumb(u, v, out) {
    const fu = THREE.MathUtils.clamp(((u - GRID.u0) / (GRID.u1 - GRID.u0)) * (GRID.nu - 1), 0, GRID.nu - 1.0001);
    const fv = THREE.MathUtils.clamp(((v - GRID.v0) / (GRID.v1 - GRID.v0)) * (GRID.nv - 1), 0, GRID.nv - 1.0001);
    const i = Math.floor(fu);
    const j = Math.floor(fv);
    const a = fu - i;
    const b = fv - j;
    for (let k = 0; k < 4; k += 1) {
      const top = grid[j][i][k] * (1 - a) + grid[j][i + 1][k] * a;
      const bottom = grid[j + 1][i][k] * (1 - a) + grid[j + 1][i + 1][k] * a;
      out[k] = top * (1 - b) + bottom * b;
    }
    return out;
  }

  /* ---------------- 状態 ---------------- */

  const state = {
    target: { u: REST_TARGET.u, v: REST_TARGET.v },
    thumb: { u: REST_TARGET.u, v: REST_TARGET.v },
    previous: { u: REST_TARGET.u, v: REST_TARGET.v },
    pressure: 0,
    effectivePressure: 0,
    contact: "none",
    wheelOmega: 0,
    wheelSpeed: 0,
    sparkCharge: 0,
    heat: 0,
    speedNorm: 0,
    extra: 0,
    extraLabel: "GAS",
    lever: 0,
    gas: 0,
    curls: [1, 1, 1, 1],
    grip: 1,
    required: 0.4,
    slip: 0,
    grace: 1.4,
    dropT: -1,
    lit: false,
    litTime: 0,
    pass: null,
    passResult: null,
    step: 0,
    cameraT: 1,
    tremorPhase: 0,
  };
  const pose = clonePose(POSES.grip);
  const thumbParams = [0, 0, 0, 0];
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const elbowWorld = new THREE.Vector3();

  function enter({ fresh = true } = {}) {
    state.target.u = REST_TARGET.u;
    state.target.v = REST_TARGET.v;
    state.thumb.u = REST_TARGET.u;
    state.thumb.v = REST_TARGET.v;
    state.previous.u = REST_TARGET.u;
    state.previous.v = REST_TARGET.v;
    state.pressure = 0;
    state.effectivePressure = 0;
    state.wheelOmega = 0;
    state.sparkCharge = 0;
    state.heat = 0;
    state.lever = 0;
    state.gas = 0;
    state.lit = false;
    state.litTime = 0;
    state.pass = null;
    state.passResult = null;
    state.step = 0;
    state.slip = 0;
    state.dropT = -1;
    state.grace = fresh ? 1.6 : 1.0;
    state.curls = [1, 1, 1, 1];
    state.cameraT = 0;
    rig.mount.position.copy(mountRest.position);
    rig.mount.quaternion.copy(mountRest.quaternion);
    sparks.clear();
    flame.mesh.visible = false;
    flame.halo.visible = false;
  }

  // くしゃみなどで手が跳ねる
  function jolt(amount) {
    state.target.u += (Math.random() - 0.5) * amount * 0.6;
    state.target.v += amount * 0.4;
    state.slip = Math.min(0.95, state.slip + amount * 2.2);
  }

  /* ---------------- 当たり判定 ---------------- */

  function pushOutOfCircle(p, cu, cv, radius) {
    const du = p.u - cu;
    const dv = p.v - cv;
    const distance = Math.hypot(du, dv);
    if (distance >= radius) return false;
    const scale = radius / Math.max(distance, 1e-5);
    p.u = cu + du * scale;
    p.v = cv + dv * scale;
    return true;
  }

  function resolve(p) {
    let wheel = false;
    let lever = false;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      if (pushOutOfCircle(p, WHEEL.u, WHEEL.v, WHEEL.r + THUMB_RADIUS)) wheel = true;
      // レバー（押し込まれた分だけ天面が下がる）
      const leverTop = LEVER.top - state.lever;
      if (p.u > LEVER.u0 - THUMB_RADIUS * 0.5 && p.u < LEVER.u1 && p.v < leverTop + THUMB_RADIUS) {
        p.v = leverTop + THUMB_RADIUS;
        lever = true;
      }
      // ホイールより前はフードの上
      if (p.u > HOOD.u && p.v < HOOD.top + THUMB_RADIUS) p.v = HOOD.top + THUMB_RADIUS;
      // 本体の肩
      if (p.v < SHOULDER_TOP + THUMB_RADIUS) p.v = SHOULDER_TOP + THUMB_RADIUS;
    }
    return { wheel, lever };
  }

  /* ---------------- 毎フレーム ---------------- */

  function update(delta, time, input) {
    const events = [];
    const dt = Math.max(delta, 1e-4);

    // カメラのズームイン
    state.cameraT = Math.min(1, state.cameraT + delta / 0.55);
    const ease = 1 - (1 - state.cameraT) ** 3;
    placeCamera(CAMERA_DISTANCE * (1.9 - 0.9 * ease));

    // マウス → 親指の狙い位置（画面の 1px がライター上でどれだけかを求める）
    const viewHeight = Math.max(1, input.viewportHeight);
    const worldPerPx = (2 * CAMERA_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / viewHeight;
    const unitsPerPx = worldPerPx / LIGHTER_SCALE;
    if (state.dropT < 0) {
      state.target.u = THREE.MathUtils.clamp(state.target.u + input.dx * unitsPerPx * screenSign, REGION.u0, REGION.u1);
      state.target.v = THREE.MathUtils.clamp(state.target.v - input.dy * unitsPerPx, REGION.v0, REGION.v1);
    }

    // 握る指
    for (let i = 0; i < 4; i += 1) {
      const goal = input.fingers[i] ? 1 : 0;
      // 指はゆっくり握り、ゆっくりほどける
      const rate = goal > state.curls[i] ? 4.5 : 2.4;
      state.curls[i] += (goal - state.curls[i]) * Math.min(1, dt * rate);
    }
    state.grip = state.curls.reduce((sum, curl, i) => sum + curl * FINGER_WEIGHTS[i], 0);

    // 震え（禁断症状）を狙い位置に足す
    state.tremorPhase += dt;
    const shake = 0.002 + input.tremor * 0.006;
    const jitterU = (Math.sin(time * 21) + Math.sin(time * 33 + 1.3) * 0.6) * shake;
    const jitterV = (Math.sin(time * 26 + 0.7) + Math.sin(time * 39) * 0.5) * shake;
    const push = input.pressing ? PUSH_DEPTH : 0;
    const desired = { u: state.target.u + jitterU, v: state.target.v + jitterV - push };

    // 親指は狙いへ少し遅れてついてくる
    state.previous.u = state.thumb.u;
    state.previous.v = state.thumb.v;
    const follow = Math.min(1, dt * 26);
    state.thumb.u += (desired.u - state.thumb.u) * follow;
    state.thumb.v += (desired.v - state.thumb.v) * follow;
    const contact = resolve(state.thumb);
    state.contact = contact.wheel ? "wheel" : contact.lever ? "lever" : "none";

    // 押し付ける力 = 狙いがどれだけ物に食い込んでいるか
    const depth = contact.wheel || contact.lever ? Math.hypot(desired.u - state.thumb.u, desired.v - state.thumb.v) : 0;
    state.pressure = THREE.MathUtils.clamp(depth / 0.05, 0, 1);
    state.required = 0.4 + 0.3 * state.pressure;
    const gripFactor = THREE.MathUtils.clamp(state.grip / state.required, 0.25, 1);
    state.effectivePressure = state.pressure * gripFactor;

    // 握りが足りないとライターがずり落ちる
    if (state.dropT < 0) {
      if (state.grace > 0) state.grace -= dt;
      else if (state.grip < state.required) state.slip += (state.required - state.grip) * 1.5 * dt;
      else state.slip = Math.max(0, state.slip - 0.35 * dt);
      if (state.slip >= 1) {
        state.dropT = 0;
        state.lit = false;
        events.push({ type: "drop" });
      }
    }

    // ホイール
    const toU = state.thumb.u - WHEEL.u;
    const toV = state.thumb.v - WHEEL.v;
    const toLength = Math.hypot(toU, toV) || 1;
    const onWheel = toLength <= WHEEL.r + THUMB_RADIUS + 0.004;
    if (onWheel) {
      // 手前へ擦り下ろす向きの接線（上側では -u）
      const tangentU = -toV / toLength;
      const tangentV = toU / toLength;
      const surface = ((state.thumb.u - state.previous.u) * tangentU + (state.thumb.v - state.previous.v) * tangentV) / dt;
      const traction = smoothstep(0.12, 0.55, state.effectivePressure);
      const targetOmega = (surface / WHEEL.r) * traction;
      state.wheelOmega += (targetOmega - state.wheelOmega) * Math.min(1, dt * 30);
      if (!state.pass) state.pass = { maxSpeed: 0, maxPressure: 0, gripLow: false, sparks: 0, travel: 0, leftAt: -1, heatStart: state.heat };
      state.pass.maxPressure = Math.max(state.pass.maxPressure, state.effectivePressure);
      state.pass.travel += Math.max(0, surface * dt);
      if (state.pressure > 0.3 && state.grip < state.required) state.pass.gripLow = true;
      state.pass.leftAt = -1;
    } else {
      state.wheelOmega *= Math.exp(-dt * 7);
      if (state.pass && state.pass.leftAt < 0) state.pass.leftAt = time;
    }
    state.wheelSpeed = Math.abs(state.wheelOmega) * WHEEL.r;
    if (state.pass && onWheel) state.pass.maxSpeed = Math.max(state.pass.maxSpeed, state.wheelSpeed);
    lighter.wheelPivot.rotation.x += state.wheelOmega * dt;

    // 火花：ホイールが速く回っている間、火打ち石から飛ぶ
    if (onWheel && state.wheelSpeed > SPARK.minSpeed && state.effectivePressure > 0.3) {
      // 火花が飛ぶのは、手前へ擦り下ろしたときだけ
      const rate = state.wheelOmega > 0 ? (state.wheelSpeed - SPARK.minSpeed) * SPARK.rate : 0;
      state.sparkCharge += rate * dt;
      if (!state.lit) state.heat = Math.min(HEAT.max, state.heat + rate * dt * HEAT.gain * (input.heatRate ?? 1));
      if (state.pass) state.pass.sparks += rate * dt;
      const count = rate > 0 ? Math.min(8, Math.round(rate * dt * 40 + Math.random())) : 0;
      lighter.group.localToWorld(tmp.set(0, WHEEL.v - WHEEL.r * 0.75, -(WHEEL.u + 0.03)));
      sparks.emit(tmp, count, { spread: 0.5, push: tmp2.copy(forwardWorld).multiplyScalar(0.9) });
      if (count > 0) events.push({ type: "spark", amount: rate });
    }
    state.sparkCharge *= Math.exp(-dt / SPARK.decay);
    if (!state.lit) state.heat = Math.max(0, state.heat - HEAT.cool * dt);
    state.speedNorm = THREE.MathUtils.clamp(state.wheelSpeed / 2.6, 0, 1);

    // レバー：上から押し込むとガスが出る
    let leverGoal = 0;
    if (contact.lever) leverGoal = THREE.MathUtils.clamp(LEVER.top + THUMB_RADIUS - desired.v, 0, LEVER.travel);
    state.lever += (leverGoal - state.lever) * Math.min(1, dt * 24);
    state.gas = state.lever / LEVER.travel;
    state.extra = state.gas;
    lighter.lever.position.y = lighter.leverRestY - state.lever;

    // 点火判定：火花が残っているうちにガスが出れば火がつく
    if (!state.lit && state.dropT < 0 && state.gas > 0.5 && state.heat >= 1 && state.sparkCharge > HEAT.freshSpark) {
      state.lit = true;
      state.litTime = 0;
      state.heat = 0;
      state.pass = null;
      events.push({ type: "ignite" });
    } else if (state.lit && state.gas < 0.3) {
      state.lit = false;
      events.push({ type: "flameOut" });
    }
    if (state.lit) state.litTime += dt;

    // 一回の擦りが終わったら評価を返す
    if (!state.lit && state.pass && state.pass.leftAt > 0 && time - state.pass.leftAt > 0.18) {
      const pass = state.pass;
      state.pass = null;
      // 軽く触れただけ（ほとんど回していない）なら何も言わない
      if (pass.travel >= 0.05) {
        let quality = "good";
        if (pass.maxPressure < 0.35) quality = pass.gripLow ? "grip" : "weak";
        else if (pass.maxSpeed < 0.9) quality = "slow";
        else if (state.heat >= 1 && state.gas < 0.5) quality = "late";
        events.push({ type: "stroke", quality, gain: state.heat - pass.heatStart });
      }
    }

    // 手順の進み具合（HUD 用：終わった手順の数）
    if (state.lit || (state.gas > 0.4 && state.heat >= 1)) state.step = 3;
    else if (state.heat >= 1) state.step = 2;
    else if (state.heat > 0.02 || (onWheel && state.thumb.v > WHEEL.v)) state.step = 1;
    else state.step = 0;

    // ずり落ち・落下の見た目
    if (state.dropT >= 0) {
      state.dropT += dt;
      rig.mount.position.y = mountRest.position.y - 0.9 * state.dropT * state.dropT * 3;
      rig.mount.rotation.z = mountRest.quaternion.z + state.dropT * 3;
      if (state.dropT > 0.9) {
        events.push({ type: "regrip" });
        enter({ fresh: false });
      }
    } else {
      const wobble = state.grip < state.required && state.grace <= 0 ? Math.sin(time * 30) * 0.02 : 0;
      rig.mount.position.copy(mountRest.position);
      rig.mount.position.y -= state.slip * 0.035;
      rig.mount.quaternion.copy(mountRest.quaternion);
      rig.mount.rotateX(state.slip * 0.22 + wobble);
    }

    // 手のポーズ：指ごとの握り＋親指の逆運動学
    for (let i = 0; i < 4; i += 1) {
      for (let k = 0; k < 4; k += 1) {
        pose.f[i][k] = THREE.MathUtils.lerp(POSES.loose.f[i][k], POSES.grip.f[i][k], state.curls[i]);
      }
    }
    sampleThumb(state.thumb.u, state.thumb.v, thumbParams);
    for (let k = 0; k < 4; k += 1) pose.t[k] = thumbParams[k];
    // 押し付けると親指の先が少しだけ反る
    pose.t[3] -= state.pressure * 0.12;
    applyPose(hand, pose);
    rig.group.position.y = Math.sin(time * 1.1) * 0.002;
    rig.group.updateMatrixWorld(true);

    hand.wristAnchor.getWorldPosition(elbowWorld);
    elbowWorld.add(tmp.set(0, -1.1, 0)).addScaledVector(sideDir, 0.35).addScaledVector(forwardWorld, -0.5);
    arm.update(hand, elbowWorld);

    // 目印とガイド
    lighter.group.localToWorld(targetMarker.position.set(-0.16, state.target.v, -state.target.u));
    targetMarker.material.opacity = input.pressing ? 0.85 : 0.45;
    const showGuide = !state.lit && state.dropT < 0;
    guideDots.forEach((dot, index) => {
      const wave = (time * 1.6 - index / guideDots.length) % 1;
      const pulse = Math.max(0, 1 - Math.abs(wave < 0 ? wave + 1 : wave) * 4);
      dot.visible = showGuide;
      dot.material.opacity = 0.18 + pulse * 0.7;
    });

    // 炎
    const showFlame = state.lit;
    flame.mesh.visible = showFlame;
    flame.halo.visible = showFlame;
    if (showFlame) {
      lighter.flameAnchor.getWorldPosition(tmp);
      flame.mesh.position.copy(tmp);
      flame.mesh.scale.set(0.07, 0.17 * (0.85 + Math.min(1, state.litTime * 4) * 0.15), 1);
      flame.mesh.rotation.set(0, Math.atan2(camera.position.x - tmp.x, camera.position.z - tmp.z), 0);
      flame.uniforms.uTime.value = time;
      flame.uniforms.uLean.value = 0.1;
      flame.uniforms.uIntensity.value = Math.min(1, state.litTime * 5);
      flame.uniforms.uCool.value = 0;
      flame.halo.position.copy(tmp).add(tmp2.set(0, 0.09, 0));
      flame.halo.scale.set(0.16, 0.2, 1);
      flame.halo.material.opacity = 0.25;
      flameLight.position.copy(tmp).add(tmp2.set(0, 0.12, 0));
      flameLight.intensity = 0.35 + Math.sin(time * 27) * 0.03;
    } else {
      flameLight.intensity = state.sparkCharge * 0.6 + Math.min(1, state.heat) * 0.08;
      lighter.group.localToWorld(flameLight.position.set(0, WHEEL.v, -WHEEL.u - 0.05));
    }
    sparks.update(delta);

    return events;
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  enter();
  // 擦り下ろす向き（手前 = レバーの側）が画面のどちらか
  const forwardSide = screenSign > 0 ? "左" : "右";
  function setPlace(images, environment) {
    backdrop.setPlace(images);
    scene.environment = environment;
  }
  // タッチ操作：指を置き直すたびに、親指をホイールの後ろへ戻す
  function home() {
    state.target.u = REST_TARGET.u;
    state.target.v = REST_TARGET.v;
  }
  return { scene, camera, state, update, enter, jolt, resize, home, setPlace, lighter, forwardSide, kind: "lighter" };
}
