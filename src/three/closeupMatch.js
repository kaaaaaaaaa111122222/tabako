import * as THREE from "three";
import { POSES, applyPose, clonePose, createArm } from "./hand.js";
import { alignAxis, createBookRig, createMatchRig } from "./rigs.js";
import { createMatchbook, createMatchbox } from "./props.js";
import { createFlame, createSmoke, createSparks } from "./effects.js";
import { createBlurBackdrop } from "./environment.js";
import { radialTexture } from "./textures.js";
import { tiledImage } from "../assets.js";

/*
 * マッチの点火画面。
 *   箱マッチ … ヤスリ面を上に向けた箱を台に置き、右手でつまんだマッチを擦る
 *   紙マッチ … 左手で紙マッチの本体を持ち、右手のマッチと擦り合わせる（両手操作）
 *
 * 2D 平面（ワールド単位）：u = ヤスリの長手方向（画面の右）、v = ヤスリ面の法線（上）。
 * 擦る面の当たり判定は、本体（箱・ブック）に固定した座標で行う。本体が動けば、その分も擦る速さになる。
 *
 * 火がつく条件：着火場所（新しいヤスリの面）だけを、ちょうどよい速さで、ほどよく押して擦る。
 * 熱は 1 回擦り終えるごとに入り、擦った幅が広いほど目減りする（全体を往復しても、つかずに折れる）。
 * 1 回通り過ぎるごとに、着火場所は別の所へ移る。
 */

export const MATCH_SETTINGS = {
  box: {
    label: "箱マッチ",
    sweet: [0.34, 0.8], // 熱くなる速さの帯
    pass: 0.27, // 着火場所を 1 回きれいに通り過ぎたときの熱
    zone: 0.034, // 着火場所の長さ
    cool: 0.08,
    wearRate: 1.5, // 速すぎる擦りで軸が傷む
    wearOutside: 0.9, // 着火場所の外を擦った長さで軸が傷む
    breakPressure: Infinity,
    breakTime: 1,
    life: 16, // 燃え尽きるまでの秒数
    blowSpeed: 1.05,
    stock: 10,
  },
  paper: {
    label: "紙マッチ",
    sweet: [0.26, 0.6],
    pass: 0.27,
    zone: 0.026,
    cool: 0.08,
    wearRate: 2.1,
    wearOutside: 1.1,
    breakPressure: 0.8,
    breakTime: 0.12,
    life: 10,
    blowSpeed: 0.8,
    stock: 6,
  },
};

const FINGER_WEIGHTS = [0.36, 0.32, 0.18, 0.14]; // 人差し指・中指・薬指・小指
const HEAD_RADIUS = 0.0065;
const PUSH_DEPTH = 0.022;
const CAMERA_DISTANCE = 0.56;
const REST_TARGET = { u: -0.085, v: 0.045 };
const PRECISION = { width: 2.1, power: 1.5 }; // 着火場所の何倍の幅までなら目減りしないか
// 紙マッチを持つ左手
const BOOK = { rest: { u: 0, v: 0.012, tilt: 0 }, speed: 0.16, turn: 1.6, limit: { u: 0.055, v: 0.035, tilt: 0.55 }, align: [0.16, 0.42], dropPenalty: 2 };

const smoothstep = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

const NORMAL_OF = { concrete: "concreteNormal", wood_dark: "woodDarkNormal", wood_plank: "woodPlankNormal", steel: "steelNormal" };
const tableMaterials = new Map();
// 手元の台：その場所の机に合わせた質感
function tableMaterial(surface) {
  if (!tableMaterials.has(surface)) {
    tableMaterials.set(
      surface,
      new THREE.MeshStandardMaterial({
        map: tiledImage(surface.image, 1.6, 0.5),
        normalMap: tiledImage(NORMAL_OF[surface.image], 1.6, 0.5),
        color: surface.color,
        roughness: surface.roughness,
        metalness: surface.metalness ?? 0,
      }),
    );
  }
  return tableMaterials.get(surface);
}

export function createMatchCloseup({ kind = "box" } = {}) {
  const cfg = MATCH_SETTINGS[kind];
  const paper = kind === "paper";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0a0f18");
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight("#a5b4d4", "#4a3d33", 0.95));
  const key = new THREE.DirectionalLight("#ffe2c4", 2.0);
  key.position.set(0.6, 1.4, 1.0);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#7f9dff", 1.4);
  rim.position.set(-1.2, 0.6, -1.0);
  scene.add(rim);

  // 擦る相手（ヤスリ面が原点・上向き）。holder ごと動く
  const strikerItem = paper ? createMatchbook() : createMatchbox();
  const holder = new THREE.Group();
  holder.add(strikerItem.group);
  // 紙マッチは、ヤスリの帯を手前に、表紙を奥へ（左手で奥を持つ）
  if (paper) strikerItem.group.rotation.y = Math.PI;
  scene.add(holder);
  const STRIKER = strikerItem.striker;
  const topHalf = paper ? 0.0575 : 0.075; // 擦れる上面の半分の長さ
  const ledgeTop = -0.1;
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7));
  ledge.position.set(0, ledgeTop - 0.04, -0.08);
  scene.add(ledge);

  // 着火場所：新しい面が光って見える
  const zoneMaterial = new THREE.MeshBasicMaterial({ color: "#ffb45a", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const zoneMesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.zone, STRIKER.halfWidth * 2), zoneMaterial);
  zoneMesh.rotation.x = -Math.PI / 2;
  zoneMesh.position.y = 0.0008;
  zoneMesh.renderOrder = 3;
  holder.add(zoneMesh);

  // マッチをつまむ右手（頭を左下へ向けて構える）
  const rig = createMatchRig(kind);
  scene.add(rig.group);
  const hand = rig.hand;
  const match = rig.match;
  const mountRest = rig.mount.quaternion.clone();
  const matchAxisRig = new THREE.Vector3(0, 1, 0).applyQuaternion(mountRest);
  // マッチは寝かせ気味に持ち、手は画面の右上（擦る面にかぶらない位置）に来るようにする
  const aimDir = new THREE.Vector3(-0.82, -0.48, -0.22).normalize();
  // 手首がヤスリの右奥・上に来るように（擦る面にかぶらないように）軸まわりにひねる
  rig.group.updateMatrixWorld(true);
  const wristRig = hand.wristAnchor.getWorldPosition(new THREE.Vector3());
  const baseQuat = alignAxis(matchAxisRig, aimDir, wristRig, new THREE.Vector3(0.45, 0.85, -0.35));
  const arm = createArm();
  scene.add(arm.group);

  // 紙マッチの本体を持つ左手
  const bookRig = paper ? createBookRig() : null;
  const bookArm = paper ? createArm() : null;
  if (paper) {
    holder.add(bookRig.group);
    scene.add(bookArm.group);
  }

  const flame = createFlame();
  scene.add(flame.mesh, flame.halo);
  const flameLight = new THREE.PointLight("#ffa04d", 0, 1, 1);
  scene.add(flameLight);
  const sparks = createSparks(60);
  scene.add(sparks.object);
  const smoke = createSmoke(16);
  scene.add(smoke.object);

  // カメラ：手前・上から擦る面を見下ろす
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);
  const focus = new THREE.Vector3(0.015, 0.03, 0);
  function placeCamera(distance) {
    camera.position.copy(focus).add(new THREE.Vector3(-0.28, 0.55, 0.86).normalize().multiplyScalar(distance));
    camera.lookAt(focus);
  }
  placeCamera(CAMERA_DISTANCE);

  // 背景：ピントの外れた景色（場所ごとに差し替える）
  const backdrop = createBlurBackdrop(camera, 2.4);
  scene.add(backdrop.plane);

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
  targetMarker.scale.setScalar(0.007);
  targetMarker.renderOrder = 10;
  scene.add(targetMarker);

  /* ---------------- 状態 ---------------- */

  const state = {
    target: { u: REST_TARGET.u, v: REST_TARGET.v },
    head: { u: REST_TARGET.u, v: REST_TARGET.v },
    local: { u: REST_TARGET.u, v: REST_TARGET.v }, // 本体から見たマッチの頭
    previous: { u: REST_TARGET.u, v: REST_TARGET.v },
    velocity: 0,
    pressure: 0,
    effectivePressure: 0,
    contact: "none",
    speed: 0,
    speedNorm: 0,
    sweet: [cfg.sweet[0] / 1.2, cfg.sweet[1] / 1.2],
    inZone: false,
    heat: 0,
    stress: 0,
    wear: 0,
    extra: 0,
    extraLabel: "WEAR",
    pressLimit: paper ? cfg.breakPressure : 1,
    curls: [1, 1, 1, 1],
    grip: 1,
    required: 0.35,
    slip: 0,
    grace: 1.4,
    dropT: -1,
    lit: false,
    litTime: 0,
    burn: 0,
    stroke: null,
    step: 0,
    cameraT: 1,
    zone: 0,
    twoHands: paper,
    book: { u: 0, v: 0, tilt: 0, hold: 1, slip: 0, dropT: -1 },
  };
  const pose = clonePose(POSES.pinch);
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const elbowWorld = new THREE.Vector3();
  const tiltQuat = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);

  // 着火場所を、今の所から離れた別の場所へ移す
  function moveZone() {
    const reach = STRIKER.halfLength - cfg.zone / 2;
    for (let i = 0; i < 12; i += 1) {
      const next = (Math.random() * 2 - 1) * reach;
      if (Math.abs(next - state.zone) > reach * 0.55 || i === 11) {
        state.zone = next;
        break;
      }
    }
    zoneMesh.position.x = state.zone;
  }

  function enter({ fresh = true } = {}) {
    Object.assign(state.target, REST_TARGET);
    Object.assign(state.head, REST_TARGET);
    Object.assign(state.local, REST_TARGET);
    Object.assign(state.previous, REST_TARGET);
    Object.assign(state, {
      velocity: 0,
      pressure: 0,
      effectivePressure: 0,
      speed: 0,
      heat: 0,
      stress: 0,
      wear: 0,
      slip: 0,
      dropT: -1,
      lit: false,
      litTime: 0,
      burn: 0,
      stroke: null,
      step: 0,
      cameraT: fresh ? 0 : state.cameraT,
      grace: fresh ? 1.6 : 1.1,
      curls: [1, 1, 1, 1],
    });
    Object.assign(state.book, { u: BOOK.rest.u, v: paper ? BOOK.rest.v : 0, tilt: 0, hold: 1, slip: 0, dropT: -1 });
    moveZone();
    rig.mount.position.set(0, 0, 0);
    rig.mount.quaternion.copy(mountRest);
    match.group.position.set(0, -match.length * 0.12, 0);
    match.group.rotation.set(0, 0, 0);
    match.setBurn(0, 0);
    sparks.clear();
    smoke.clear();
    flame.mesh.visible = false;
    flame.halo.visible = false;
  }

  function jolt(amount) {
    state.target.u += (Math.random() - 0.5) * amount * 0.25;
    state.target.v += amount * 0.12;
    state.slip = Math.min(0.95, state.slip + amount * 2.2);
    if (paper) {
      state.book.tilt += (Math.random() - 0.5) * amount * 1.6;
      state.book.slip = Math.min(0.95, state.book.slip + amount * 1.6);
    }
  }

  /* ---------------- 本体に固定した座標 ---------------- */

  function toLocal(p, out) {
    const du = p.u - state.book.u;
    const dv = p.v - state.book.v;
    const c = Math.cos(state.book.tilt);
    const s = Math.sin(state.book.tilt);
    out.u = du * c + dv * s;
    out.v = -du * s + dv * c;
    return out;
  }
  function toWorld(p, out) {
    const c = Math.cos(state.book.tilt);
    const s = Math.sin(state.book.tilt);
    const u = p.u * c - p.v * s + state.book.u;
    const v = p.u * s + p.v * c + state.book.v;
    out.u = u;
    out.v = v;
    return out;
  }

  // 上面・台から押し出す（本体の座標）
  function resolve(p) {
    let top = false;
    if (Math.abs(p.u) < topHalf + HEAD_RADIUS * 0.5 && p.v < HEAD_RADIUS && p.v > -0.05) {
      p.v = HEAD_RADIUS;
      top = true;
    }
    if (!paper && p.v < ledgeTop + HEAD_RADIUS) p.v = ledgeTop + HEAD_RADIUS;
    return top;
  }

  // 紙マッチの本体を動かす左手
  function updateBook(dt, time, input, events) {
    const book = state.book;
    const left = input.left ?? { x: 0, y: 0, tilt: 0, hold: true };
    const rate = left.hold ? 5 : 2.6;
    book.hold += ((left.hold ? 1 : 0) - book.hold) * Math.min(1, dt * rate);
    if (book.dropT >= 0) {
      // 落とした本体を拾い直す
      book.dropT += dt;
      book.v -= book.dropT * dt * 1.6;
      book.tilt += dt * 2;
      if (book.dropT > 0.9) {
        Object.assign(book, { ...BOOK.rest, hold: 1, slip: 0, dropT: -1 });
        state.grace = 1.1;
        events.push({ type: "bookRegrip" });
      }
      return;
    }
    const speed = BOOK.speed * (0.45 + 0.55 * book.hold);
    book.u = THREE.MathUtils.clamp(book.u + left.x * speed * dt, -BOOK.limit.u, BOOK.limit.u);
    book.v = THREE.MathUtils.clamp(book.v + left.y * speed * dt, BOOK.rest.v - BOOK.limit.v, BOOK.rest.v + BOOK.limit.v);
    book.tilt += left.tilt * BOOK.turn * dt;
    // 端を押すと傾く。しっかり持っているほど傾きにくい
    book.tilt -= state.local.u * state.effectivePressure * (2.4 - book.hold * 1.3) * 4.2 * dt;
    if (!left.tilt) book.tilt *= Math.exp(-dt * 0.35);
    book.tilt = THREE.MathUtils.clamp(book.tilt, -BOOK.limit.tilt, BOOK.limit.tilt);
    // 震え
    const shake = 0.0004 + input.tremor * 0.0016;
    book.u += (Math.sin(time * 17 + 2) + Math.sin(time * 29) * 0.6) * shake * 0.25;
    book.v += (Math.sin(time * 19 + 1) + Math.sin(time * 31) * 0.5) * shake * 0.25;
    book.tilt += Math.sin(time * 13) * input.tremor * 0.0022;
    // 持つ力が足りないと、ずり落ちる
    const required = 0.4 + 0.35 * state.pressure;
    if (state.grace <= 0 && book.hold < required) book.slip += (required - book.hold) * 1.3 * dt;
    else book.slip = Math.max(0, book.slip - 0.4 * dt);
    if (book.slip >= 1) {
      book.slip = 0;
      book.dropT = 0;
      state.heat *= 0.3;
      events.push({ type: "bookDrop", penalty: BOOK.dropPenalty });
    }
  }

  /* ---------------- 毎フレーム ---------------- */

  const desiredLocal = { u: 0, v: 0 };

  function update(delta, time, input) {
    const events = [];
    const dt = Math.max(delta, 1e-4);
    const heatRate = input.heatRate ?? 1;

    state.cameraT = Math.min(1, state.cameraT + delta / 0.55);
    const ease = 1 - (1 - state.cameraT) ** 3;
    placeCamera(CAMERA_DISTANCE * (1.9 - 0.9 * ease));

    // マウス → マッチの頭の狙い位置
    const viewHeight = Math.max(1, input.viewportHeight);
    const worldPerPx = (2 * CAMERA_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / viewHeight;
    if (state.dropT < 0) {
      state.target.u = THREE.MathUtils.clamp(state.target.u + input.dx * worldPerPx, -0.15, 0.15);
      state.target.v = THREE.MathUtils.clamp(state.target.v - input.dy * worldPerPx * 1.3, ledgeTop + 0.005, 0.13);
    }

    // つまむ指（紙マッチの右手は、つまんだまま）
    for (let i = 0; i < 4; i += 1) {
      const goal = paper || input.fingers[i] ? 1 : 0;
      const rate = goal > state.curls[i] ? 4.5 : 2.4;
      state.curls[i] += (goal - state.curls[i]) * Math.min(1, dt * rate);
    }
    if (paper) updateBook(dt, time, input, events);
    state.grip = paper ? state.book.hold : state.curls.reduce((sum, curl, i) => sum + curl * FINGER_WEIGHTS[i], 0);

    // 震え
    const shake = 0.0006 + input.tremor * 0.0018;
    const jitterU = (Math.sin(time * 21) + Math.sin(time * 33 + 1.3) * 0.6) * shake;
    const jitterV = (Math.sin(time * 26 + 0.7) + Math.sin(time * 39) * 0.5) * shake;
    const desired = {
      u: state.target.u + jitterU,
      v: state.target.v + jitterV - (input.pressing ? PUSH_DEPTH : 0),
    };

    // 頭は狙いへ少し遅れてついてくる。当たり判定は本体の座標で行う
    state.previous.u = state.local.u;
    state.previous.v = state.local.v;
    const follow = Math.min(1, dt * 22);
    state.head.u += (desired.u - state.head.u) * follow;
    state.head.v += (desired.v - state.head.v) * follow;
    toLocal(state.head, state.local);
    toLocal(desired, desiredLocal);
    const bookReady = state.book.dropT < 0;
    const resolvedTop = bookReady && resolve(state.local);
    toWorld(state.local, state.head);
    const onTop = bookReady && (resolvedTop || (Math.abs(state.local.u) < topHalf && Math.abs(state.local.v - HEAD_RADIUS) <= 0.0005));
    const onStrip = onTop && Math.abs(state.local.u) <= STRIKER.halfLength;
    state.contact = onStrip ? "strip" : onTop ? "top" : "none";

    state.pressure = onTop ? THREE.MathUtils.clamp((state.local.v - desiredLocal.v) / 0.016, 0, 1) : 0;
    state.required = 0.35 + 0.35 * state.pressure;
    const gripFactor = THREE.MathUtils.clamp(state.grip / state.required, 0.25, 1);
    // 紙マッチは、傾いているとヤスリに当たらない
    const align = paper ? 1 - smoothstep(BOOK.align[0], BOOK.align[1], Math.abs(state.book.tilt)) * 0.9 : 1;
    state.effectivePressure = state.pressure * gripFactor;
    state.velocity = (state.local.u - state.previous.u) / dt;
    // 1 フレームの揺れに振り回されないよう、少しならす
    state.speed += (Math.abs(state.velocity) - state.speed) * Math.min(1, dt * 30);
    state.speedNorm = THREE.MathUtils.clamp(state.speed / 1.2, 0, 1);

    // 握りが足りないとマッチが指の間でずれていく（箱マッチ）
    if (state.grace > 0) state.grace -= dt;
    else if (!paper && state.dropT < 0) {
      if (state.grip < state.required) state.slip += (state.required - state.grip) * 1.6 * dt;
      else state.slip = Math.max(0, state.slip - 0.35 * dt);
      if (state.slip >= 1) {
        state.dropT = 0;
        state.lit = false;
        events.push({ type: "drop" });
      }
    }

    // 擦る
    if (!state.lit && state.dropT < 0) {
      const [slow, fast] = cfg.sweet;
      const speedFactor = smoothstep(slow * 0.72, slow, state.speed) * (1 - smoothstep(fast, fast * 1.3, state.speed));
      state.inZone = onStrip && Math.abs(state.local.u - state.zone) <= cfg.zone / 2;
      if (onStrip) {
        const moved = Math.abs(state.local.u - state.previous.u);
        const press = smoothstep(0.12, 0.45, state.effectivePressure) * align;
        const earned = state.inZone ? (cfg.pass / cfg.zone) * moved * speedFactor * press * heatRate : 0;
        if (!state.inZone && state.effectivePressure > 0.1) state.wear += moved * cfg.wearOutside;
        // 速すぎると軸が傷む
        const over = Math.max(0, state.speed - fast);
        state.wear += state.effectivePressure * (over * over * 6 + state.speed * state.speed * 0.12) * cfg.wearRate * dt;
        if (state.wear >= 1) {
          state.wear = 0;
          state.dropT = 0;
          events.push({ type: "broken", reason: "wear" });
        }
        const rub = state.speed * state.effectivePressure;
        if (rub > 0.05) {
          events.push({ type: "scrape", amount: rub * (0.4 + 0.6 * speedFactor) });
          if (Math.random() < speedFactor * (state.inZone ? 0.6 : 0.04)) {
            match.headAnchor.getWorldPosition(tmp);
            sparks.emit(tmp, 1, { spread: 0.25, push: tmp2.set(Math.sign(state.velocity) * -0.3, 0.2, 0) });
          }
        }
        if (state.speed > 0.06) {
          if (!state.stroke) state.stroke = { maxSpeed: 0, maxPressure: 0, gripLow: false, tooHard: false, tilted: false, zone: false, quiet: 0, pending: 0, length: 0, dir: Math.sign(state.velocity) };
          const stroke = state.stroke;
          stroke.maxSpeed = Math.max(stroke.maxSpeed, state.speed);
          stroke.maxPressure = Math.max(stroke.maxPressure, state.effectivePressure);
          if (state.inZone) stroke.zone = true;
          if (state.pressure > 0.3 && state.grip < state.required) stroke.gripLow = true;
          if (paper && align < 0.5) stroke.tilted = true;
          stroke.quiet = 0;
          stroke.pending += earned;
          stroke.length += moved;
        }
        // 紙マッチは押し付けすぎると折れる
        if (paper && state.effectivePressure > cfg.breakPressure && state.speed > 0.05) {
          state.stress += dt;
          if (state.stroke) state.stroke.tooHard = true;
        } else {
          state.stress = Math.max(0, state.stress - dt * 1.5);
        }
        if (state.stress > cfg.breakTime && state.dropT < 0) {
          state.stress = 0;
          state.dropT = 0;
          events.push({ type: "broken", reason: "pressure" });
        }
      }
      // 一回の擦り（離れる・止まる・折り返す）が終わったら評価を返し、着火場所を移す
      if (state.stroke) {
        const turned = Math.sign(state.velocity) !== state.stroke.dir && Math.abs(state.velocity) > 0.05;
        if (!onStrip || state.speed < 0.04) state.stroke.quiet += dt;
        if (!onStrip || turned || state.stroke.quiet > 0.12) {
          const stroke = state.stroke;
          state.stroke = null;
          const precision = Math.min(1, (cfg.zone * PRECISION.width) / Math.max(stroke.length, 1e-4)) ** PRECISION.power;
          const gain = stroke.pending * precision;
          state.heat += gain;
          if (stroke.maxSpeed > 0.12 && stroke.maxPressure > 0.05) {
            let quality = "good";
            if (stroke.maxPressure < 0.22) quality = stroke.gripLow ? "grip" : "weak";
            else if (stroke.tooHard) quality = "hard";
            else if (stroke.tilted) quality = "tilt";
            else if (stroke.maxSpeed < cfg.sweet[0] * 0.9) quality = "slow";
            else if (stroke.maxSpeed > cfg.sweet[1] * 1.22) quality = "fast";
            else if (!stroke.zone) quality = "spot";
            else if (precision < 0.62) quality = "long";
            events.push({ type: "stroke", quality, gain });
          }
          if (stroke.zone) moveZone();
        }
      }
      state.heat = Math.max(0, state.heat - cfg.cool * dt);
      if (state.heat >= 1 && state.dropT < 0) {
        state.lit = true;
        state.litTime = 0;
        state.stroke = null;
        match.headAnchor.getWorldPosition(tmp);
        sparks.emit(tmp, 30, { spread: 0.6, push: tmp2.set(0, 0.4, 0) });
        for (let i = 0; i < 4; i += 1) smoke.emit(tmp, { size: 0.01, grow: 0.05, life: 1.4, alpha: 0.3 });
        events.push({ type: "ignite" });
      }
    }

    if (state.lit) {
      state.litTime += dt;
      state.burn = Math.min(1, state.litTime / cfg.life);
      // 火がついたマッチを速く振ると消える（ついた直後は、擦った勢いが残っているので見逃す）
      if (state.speed > cfg.blowSpeed && state.litTime > 0.45) {
        state.lit = false;
        events.push({ type: "blownOut" });
      }
    }
    state.extra = THREE.MathUtils.clamp(state.wear, 0, 1);

    // 手順（HUD 用：終わった手順の数）
    if (state.lit) state.step = 3;
    else if (state.heat > 0.15) state.step = 2;
    else if (onStrip) state.step = 1;
    else state.step = 0;

    // 本体と左手
    holder.position.set(state.book.u, state.book.v, 0);
    holder.rotation.z = state.book.tilt;
    holder.updateMatrixWorld(true);
    if (paper) {
      bookRig.update(state.book.hold);
      bookRig.hand.wristAnchor.getWorldPosition(elbowWorld);
      bookArm.update(bookRig.hand, elbowWorld.add(tmp.set(-0.95, -0.35, 0.35)));
    }
    zoneMaterial.opacity = state.lit ? 0 : 0.2 + (Math.sin(time * 5) * 0.5 + 0.5) * 0.22 + (state.inZone ? 0.25 : 0);

    // 手とマッチの位置：マッチの頭が head に来るように手全体を動かす
    const tilt = THREE.MathUtils.clamp(-state.velocity * 0.18, -0.22, 0.22) + state.pressure * 0.08;
    tiltQuat.setFromAxisAngle(zAxis, tilt);
    rig.group.quaternion.copy(baseQuat).premultiply(tiltQuat);
    rig.group.position.set(0, 0, 0);
    if (state.dropT >= 0) {
      state.dropT += dt;
      match.group.position.y = -match.length * 0.12 - 0.5 * state.dropT * state.dropT * 3;
      match.group.rotation.z = state.dropT * 4;
      if (state.dropT > 0.9) {
        events.push({ type: "regrip" });
        enter({ fresh: false });
      }
    } else {
      const wobble = !paper && state.grip < state.required && state.grace <= 0 ? Math.sin(time * 30) * 0.03 : 0;
      // マッチの取り付け向き（mountRest）を残したまま、ずり落ちる分だけ傾ける
      rig.mount.quaternion.copy(mountRest);
      rig.mount.rotateX(state.slip * 0.35 + wobble);
      match.group.position.y = -match.length * 0.12 - state.slip * 0.012;
    }
    rig.group.updateMatrixWorld(true);
    if (state.dropT < 0) {
      match.headAnchor.getWorldPosition(headWorld);
      rig.group.position.set(state.head.u - headWorld.x, state.head.v - headWorld.y, -headWorld.z);
    }
    rig.group.position.y += Math.sin(time * 1.1) * 0.0006;

    for (let i = 0; i < 4; i += 1) {
      for (let k = 0; k < 4; k += 1) {
        pose.f[i][k] = THREE.MathUtils.lerp(rig.loose.f[i][k], rig.pinch.f[i][k], state.curls[i]);
      }
    }
    for (let k = 0; k < 4; k += 1) pose.t[k] = rig.pinch.t[k];
    applyPose(hand, pose);
    rig.group.updateMatrixWorld(true);

    hand.wristAnchor.getWorldPosition(elbowWorld);
    elbowWorld.add(tmp.set(0.9, 0.45, 0.1));
    arm.update(hand, elbowWorld);

    // マッチの頭：擦って温まると赤く、火がつくと燃えていく
    match.setBurn(state.lit ? state.burn : 0, state.lit ? 1 : Math.min(1, state.heat * 0.9));

    // 目印
    targetMarker.position.set(state.target.u, Math.max(state.target.v, -0.02), STRIKER.halfWidth + 0.006);
    targetMarker.material.opacity = input.pressing ? 0.85 : 0.45;

    // 炎（点いた直後は大きく燃え上がる）
    flame.mesh.visible = state.lit;
    flame.halo.visible = state.lit;
    if (state.lit) {
      match.headAnchor.getWorldPosition(tmp);
      const flare = Math.max(0, 1 - state.litTime / 0.45);
      const width = 0.032 + flare * 0.03;
      const height = 0.075 + flare * 0.07;
      flame.mesh.position.copy(tmp).add(tmp2.set(0, -0.004, 0));
      flame.mesh.scale.set(width, height, 1);
      flame.mesh.rotation.set(0, Math.atan2(camera.position.x - tmp.x, camera.position.z - tmp.z), 0);
      flame.uniforms.uTime.value = time;
      flame.uniforms.uLean.value = THREE.MathUtils.clamp(-state.velocity * 2, -1, 1);
      flame.uniforms.uIntensity.value = Math.min(1, state.litTime * 6);
      flame.uniforms.uCool.value = flare * 0.25;
      flame.halo.position.copy(tmp).add(tmp2.set(0, height * 0.45, 0));
      flame.halo.scale.set(0.09 + flare * 0.08, 0.11 + flare * 0.08, 1);
      flame.halo.material.opacity = 0.25 + flare * 0.3;
      flameLight.position.copy(tmp).add(tmp2.set(0, 0.04, 0));
      flameLight.intensity = 0.25 + flare * 0.6 + Math.sin(time * 27) * 0.02;
    } else {
      match.headAnchor.getWorldPosition(flameLight.position);
      flameLight.intensity = state.heat * 0.12;
    }
    sparks.update(delta);
    smoke.update(delta, 0);
    return events;
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setPlace(images, environment, surface) {
    backdrop.setPlace(images);
    scene.environment = environment;
    ledge.material = tableMaterial(surface);
  }

  enter();
  return { scene, camera, state, update, enter, jolt, resize, home() {}, setPlace, forwardSide: "右", kind, settings: cfg };
}
