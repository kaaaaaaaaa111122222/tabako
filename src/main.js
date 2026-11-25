import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { AVATAR_URLS, loadAssets } from "./assets.js";
import { createAudio } from "./audio.js";
import { CHILL_KEYS, DIFFICULTIES, FAIL_LINE, STRESS, tremorOf, unlimitedRound } from "./rules.js";
import { PLACES, PLACE_IDS } from "./places.js";
import { createTouch, enterFullscreen } from "./touch.js";
import { createEnvironment } from "./three/environment.js";
import { POSES, applyPose, approachPose, blendPose, clonePose, createArm } from "./three/hand.js";
import { HAND_SCALE, LIGHTER_SCALE, createLighterRig, createMatchRig, createShieldRig } from "./three/rigs.js";
import {
  createAshtray,
  createCigarette,
  createMatchbook,
  createMatchbox,
  createMoth,
  createPhone,
} from "./three/props.js";
import { createFlame, createGlow, createRain, createSmoke } from "./three/effects.js";
import { createStranger } from "./three/people.js";
import { ASH_LIMIT, createSmoker } from "./three/smoker.js";
import { createCloseup } from "./three/closeup.js";
import { MATCH_SETTINGS, createMatchCloseup } from "./three/closeupMatch.js";

/* ======================================================================
 * チューニング値
 * ==================================================================== */

const BASE_WIND_DIR = -1; // -1 = 左から吹く風 / +1 = 右から吹く風
const CAMERA_BASE = new THREE.Vector3(0, 1.4, 8.2);
const CAMERA_FOV = 48;
const MIN_HORIZONTAL_FOV = 66;
// 煙草はカメラ（＝目）から見た位置で指定する。フィルターは画面下端、先端は画面中央付近。
const CIG_FILTER_END = new THREE.Vector3(-0.12, -0.37, -0.88);
const CIG_TIP = new THREE.Vector3(0.0, -0.1, -1.38);

const RIG_Z = 6.8;
const SHIELD_Z = 6.74;
const RIG_IDLE = new THREE.Vector3(0.62, 0.72, 7.0);
const RIG_START = new THREE.Vector3(0.36, 0.92, RIG_Z);
const RIG_REST = new THREE.Vector3(0.55, 0.82, 6.95);
const SHIELD_IDLE = new THREE.Vector3(-0.66, 0.62, 7.05);
const SHIELD_START = new THREE.Vector3(0.12, 1.07, SHIELD_Z);
const ELBOW_RIGHT = new THREE.Vector3(1.05, 0.2, 7.8);
const ELBOW_LEFT = new THREE.Vector3(-1.05, 0.25, 7.8);
// 道具・スマホを置く所（場所ごとに違う。changePlace で決まる）
const itemAt = new THREE.Vector3();
const phoneAt = new THREE.Vector3();

const RIG_BOUNDS = { minX: -0.75, maxX: 0.95, minY: 0.66, maxY: 1.4 };
const SHIELD_BOUNDS = { minX: -0.95, maxX: 0.95, minY: 0.72, maxY: 1.65 };
// ライターを持つ手は少し重く：感度を下げ、ゆっくり追いつかせる
const MOUSE_GAIN = 1.15;
const RIG_FOLLOW = 6;
const SHIELD_KEY_SPEED = 1.35;
const SHIELD_TURN_SPEED = 2.4; // Q / E で手首を回す速さ（ラジアン/秒）
const SHIELD_YAW_LIMIT = 1.7;
const SHIELD_YAW_START = 1.12; // 手のひらが右（炎の方）を向いた状態
const ROOF_COVER = { x: 0.17, below: 0.03, above: 0.34 }; // F でかざした手が煙草を雨から守れる範囲
const TIP_RANGE = 0.085; // 炎と煙草の先端の許容距離（画面平面上）
const SHIELD_ZONE = { near: 0.08, far: 0.42, below: 0.26, above: 0.2, burn: 0.13 };
const PROTECTION = {
  normal: { none: 0, open: 0.8, cup: 0.97 },
  gust: { none: 0, open: 0.45, cup: 0.95 },
};
const LIGHT = { lungFill: 0.46, lungRecover: 0.5, burnRate: 0.5, coughLock: 1.2 };

// 点火画面：握る指のキー（左手のホームポジション）→ 人差し指・中指・薬指・小指
const GRIP_KEYS = { KeyF: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
const DROP_PENALTY = 2.5;
const LIT_HOLD_TO_EXIT = 0.7; // 点火してから一人称視点へ戻るまで
const THUMB_RESUME_GRACE = 1.2; // 一時停止から戻ったあと、レバーを押し直すまでの猶予
const TITLE_HOLD = 0.6; // プレイ中に R でタイトルへ戻るのに必要な長押し
const TOUCH_GAIN = 1.7; // タッチで炎を動かす感度
const TOUCH_IGNITE_GAIN = 1.25; // タッチで親指・マッチを動かす感度
const TOUCH_LIFT_GRACE = 0.45; // タッチで指を離しても、火が消えるまで待つ時間
const VIEW_FADE = { out: 0.16, in: 0.3 };

const TOOLS = {
  lighter: {
    label: "ライター",
    flame: { width: 0.07, height: 0.175, sink: 0 },
    wind: 1,
  },
  boxMatch: {
    label: "箱マッチ",
    kind: "box",
    flame: { width: 0.042, height: 0.1, sink: 0.006 },
    wind: 1.25,
  },
  paperMatch: {
    label: "紙マッチ",
    kind: "paper",
    flame: { width: 0.038, height: 0.09, sink: 0.006 },
    wind: 1.5,
  },
};

const RANK_LETTERS = ["S", "A", "B", "C", "D"];
const RANK_COPY = {
  S: "職人の手さばき。一発で決める指先。",
  A: "見事。擦る→点火→吸いつけの流れが滑らか。",
  B: "着火成功。握りを保ったまま素早く擦ればもっと速い。",
  C: "なんとか着火。押し付ける強さと速さのバランスを意識しよう。",
  D: "ぎりぎり間に合った。まずは握りを安定させよう。",
  F: "時間がかかりすぎた。火はついたが、ランクは F。",
};

const STORAGE = {
  best: (difficulty) => `windproof-best-v5-${difficulty}`,
  cleared: "windproof-cleared-v5",
  difficulty: "windproof-difficulty",
  chillPlace: "windproof-chill-place",
  unlimited: "windproof-unlimited-best",
};

const ICONS = {
  gust: '<svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>',
  moth: '<svg viewBox="0 0 24 24"><path d="M12 7v11"/><path d="M12 10C9 5 4 5 4 9s5 4 8 2"/><path d="M12 10c3-5 8-5 8-1s-5 4-8 2"/><path d="M12 13c-2 1-5 3-4 5s3 0 4-3"/><path d="M12 13c2 1 5 3 4 5s-3 0-4-3"/><path d="M11 6 9.5 3.5M13 6l1.5-2.5"/></svg>',
  sneeze: '<svg viewBox="0 0 24 24"><circle cx="11" cy="12" r="8"/><path d="M8 10h.01M14 10h.01"/><path d="M8.5 15.5c1.5 1 3.5 1 5 0"/><path d="M20 6l2-2M21 10h2M18 3l1-2"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/><path d="M3.5 8c-1 2.5-1 5.5 0 8M20.5 8c1 2.5 1 5.5 0 8"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  rain: '<svg viewBox="0 0 24 24"><path d="M7 15a4 4 0 0 1-.6-8A6 6 0 0 1 18 8.5a3.5 3.5 0 0 1-.5 6.5H7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></svg>',
  beggar: '<svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="3.5"/><path d="M3 21c0-4 2.7-7 6-7s6 3 6 7"/><path d="M15 12h4a2 2 0 0 1 0 4h-2"/></svg>',
  lender: '<svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="3.5"/><path d="M2 21c0-4 2.7-7 6-7s6 3 6 7"/><rect x="16" y="9" width="4" height="8" rx="1"/><path d="M18 9V7"/></svg>',
};

const PHONE_MESSAGES = [
  ["上司", "例の件、至急折り返して。", "#3a6fd8"],
  ["母", "ちゃんとご飯食べてる？野菜送ったからね。", "#4fae6b"],
  ["ショップ", "【本日限定】全品50%OFF！今すぐチェック", "#e0663a"],
  ["友達", "今どこ？もう着いてるんだけど", "#4fae6b"],
  ["天気アプリ", "まもなく強い風が吹く見込みです。", "#3aa6d8"],
  ["カレンダー", "5分後: 定例ミーティング", "#d84a4a"],
  ["銀行", "ご利用明細が確定しました。", "#6a5ad8"],
  ["グループ", "今夜の飲み会、場所変更です！", "#4fae6b"],
];
const PHONE_DURATION = 10;
const SWIPE_DISTANCE = 95;

// くしゃみのこらえキー（握る指 A S D F・風よけ W・手首 Q E と重ならない左手側のキー）
const SNEEZE_KEYS = [
  ["KeyZ", "Z"],
  ["KeyX", "X"],
  ["KeyC", "C"],
  ["KeyV", "V"],
  ["KeyG", "G"],
  ["KeyB", "B"],
];

// イベントが起きる画面（点火画面では手元のイベントだけ）
const EVENT_PHASES = {
  gust: ["light"],
  moth: ["light"],
  rain: ["light"],
  moocher: ["light"],
  lender: ["light"],
  sneeze: ["ignite", "light"],
  phone: ["ignite", "light"],
  call: ["ignite", "light"],
};

const CALLERS = ["上司", "母", "非通知", "知らない番号", "大家さん"];

const PHASE_LABEL = {
  ready: "READY",
  pickup: "PICK UP",
  grab: "PICK UP",
  ignite: "IGNITION",
  light: "LIGHT IT UP",
  success: "SUCCESS",
  failed: "FAILED",
  chill: "CHILL",
};

/* ======================================================================
 * DOM
 * ==================================================================== */

const $ = (selector) => document.querySelector(selector);
const ui = {
  mount: $("#scene"),
  sceneWrap: $("#scene-wrap"),
  startScreen: $("#start-screen"),
  gameLayout: $("#game-layout"),
  startButton: $("#start-button"),
  startLabel: $("#start-label"),
  modeList: $("#mode-list"),
  placePicker: $("#place-picker"),
  placeList: $("#place-list"),
  help: $("#help"),
  helpButton: $("#help-button"),
  soundToggle: $("#sound-toggle"),
  timer: $("#timer"),
  timerCard: $("#timer-card"),
  timerRank: $("#timer-rank"),
  limitBar: $("#limit-bar"),
  best: $("#best-time"),
  phase: $("#phase-label"),
  difficultyChip: $("#difficulty-chip"),
  stockChip: $("#stock-chip"),
  guardChip: $("#guard-chip"),
  windWidget: $("#wind-widget"),
  windArrow: $("#wind-arrow"),
  windSpeed: $("#wind-speed"),
  flash: $("#scene-flash"),
  veil: $("#zoom-veil"),
  banner: $("#event-banner"),
  bannerIcon: $("#event-icon"),
  bannerKicker: $("#event-kicker"),
  bannerTitle: $("#event-title"),
  bannerCopy: $("#event-copy"),
  bannerPips: $("#event-pips"),
  bannerKey: $("#event-key"),
  bannerTimer: $("#event-timer-bar"),
  igniteSteps: [...document.querySelectorAll("#ignite-steps li")],
  fingerKeys: [...document.querySelectorAll("#finger-keys [data-finger]")],
  slipWarning: $("#slip-warning"),
  strokePop: $("#stroke-pop"),
  gripBar: $("#grip-bar"),
  gripNeed: $("#grip-need"),
  gripValue: $("#grip-value"),
  pressBar: $("#press-bar"),
  pressValue: $("#press-value"),
  pressLimit: $("#press-limit"),
  speedBar: $("#speed-bar"),
  speedValue: $("#speed-value"),
  speedSweet: $("#speed-sweet"),
  stressBar: $("#stress-bar"),
  stressValue: $("#stress-value"),
  fuelBar: $("#fuel-bar"),
  fuelValue: $("#fuel-value"),
  timerLabel: $("#timer-limit"),
  heatBar: $("#heat-bar"),
  heatValue: $("#heat-value"),
  extraGauge: $("#extra-gauge"),
  extraLabel: $("#extra-label"),
  extraBar: $("#extra-bar"),
  extraValue: $("#extra-value"),
  phoneUi: $("#phone-ui"),
  phoneNotify: $("#phone-notify"),
  phoneCall: $("#phone-call"),
  callName: $("#call-name"),
  callAvatar: $("#call-avatar"),
  callStatus: $("#call-status"),
  callButtons: [...document.querySelectorAll("[data-call]")],
  speech: $("#speech-bubble"),
  rainVeil: $("#rain-veil"),
  phoneStack: $("#phone-stack"),
  phoneFinger: $("#phone-finger"),
  phoneScreen: $("#phone-screen"),
  phoneClock: $("#phone-clock"),
  phoneTimer: $("#phone-timer-bar"),
  toastLayer: $("#toast-layer"),
  message: $("#message"),
  messageKicker: $("#message-kicker"),
  messageTitle: $("#message-title"),
  messageCopy: $("#message-copy"),
  flameBar: $("#flame-bar"),
  flameValue: $("#flame-value"),
  matchBar: $("#match-bar"),
  matchValue: $("#match-value"),
  burnBar: $("#burn-bar"),
  burnValue: $("#burn-value"),
  lungBar: $("#lung-bar"),
  lungValue: $("#lung-value"),
  chillCount: $("#chill-count"),
  chillTime: $("#chill-time"),
  ashBar: $("#ash-bar"),
  keyHints: $("#key-hints"),
  restartHint: $("#restart-hint"),
  result: $("#result-card"),
  resultKicker: $("#result-kicker"),
  resultDifficulty: $("#result-difficulty"),
  resultRank: $("#result-rank"),
  resultTime: $("#result-time"),
  resultBest: $("#result-best"),
  resultCopy: $("#result-copy"),
  resultUnlock: $("#result-unlock"),
  resStrikes: $("#res-strikes"),
  resDrops: $("#res-drops"),
  resDropsLabel: $("#res-drops-label"),
  resEvents: $("#res-events"),
  resMistakes: $("#res-mistakes"),
  replayButton: $("#replay-button"),
  titleButton: $("#title-button"),
  steps: [$("#step-1"), $("#step-2"), $("#step-3")],
};

document.querySelectorAll("[data-icon]").forEach((element) => {
  element.innerHTML = ICONS[element.dataset.icon] ?? "";
});

const touch = createTouch({
  root: $("#touch-ui"),
  onPause: () => (state.paused ? resetToTitle() : canPause() && pauseGame()),
  onAsh: () => {
    state.tapAsh = true;
  },
});

/* ======================================================================
 * 素材の読み込み（終わるまで開始できない）
 * ==================================================================== */

ui.startButton.disabled = true;
ui.startLabel.textContent = "読み込み中…";
try {
  await loadAssets((progress) => {
    ui.startLabel.textContent = `読み込み中… ${Math.round(progress * 100)}%`;
  });
} catch (error) {
  ui.startLabel.textContent = "素材を読み込めませんでした（再読み込みしてください）";
  throw error;
}
ui.startButton.disabled = false;

/* ======================================================================
 * シーン（一人称視点）
 * ==================================================================== */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch.active ? 1.25 : 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
ui.mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.08, 1400);
camera.position.copy(CAMERA_BASE);
camera.lookAt(0, 1, 0);
scene.add(camera);

const environment = createEnvironment(renderer, scene);

// 点火画面（手元のズームアップ）は道具ごとに別シーン。マッチの画面は必要になったときに作る
const closeups = { lighter: createCloseup(), boxMatch: null, paperMatch: null };
const currentPlace = { id: null };
function getCloseup(tool) {
  if (!closeups[tool]) {
    closeups[tool] = createMatchCloseup({ kind: TOOLS[tool].kind });
    closeups[tool].setPlace(environment.blurTexture, scene.environment, environment.place.surface);
    resizeRenderer();
  }
  return closeups[tool];
}

// 場所を切り替える（モデルを読み込んで組み立ててから）
async function changePlace(id) {
  await environment.setPlace(id);
  currentPlace.id = id;
  Object.values(closeups).forEach((closeup) => closeup?.setPlace(environment.blurTexture, scene.environment, environment.place.surface));
  placeThings();
}

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// 煙草（カメラ＝口元に固定）
const cig = createCigarette();
placeCigarette(cig.group);
const cigRestPosition = cig.group.position.clone();
const cigRestQuaternion = cig.group.quaternion.clone();
camera.add(cig.group);
const emberLight = new THREE.PointLight("#ff4a1c", 0, 0.6, 1);
scene.add(emberLight);
const emberGlow = createGlow("255,96,36");
emberGlow.visible = false;
scene.add(emberGlow);

// 右手：ライターを握る手と、マッチをつまむ手（難易度で切り替える）
const lighterRig = createLighterRig();
scene.add(lighterRig.group);
const lighter = lighterRig.lighter;
lighter.group.scale.setScalar(LIGHTER_SCALE);
scene.add(lighter.group);
// マッチは左上へ向け、手の甲を右上・手前に見せる
const MATCH_AIM = { axis: new THREE.Vector3(-0.6, 0.66, -0.45), back: new THREE.Vector3(0.45, 0.7, 0.35) };
const matchRigs = { boxMatch: createMatchRig("box", MATCH_AIM), paperMatch: createMatchRig("paper", MATCH_AIM) };
Object.values(matchRigs).forEach((rig) => {
  applyPose(rig.hand, rig.pinch);
  rig.group.visible = false;
  scene.add(rig.group);
});
const rightArm = createArm();
scene.add(rightArm.group);

// 机などに置いてある道具
const tableItems = {
  lighter: lighter.group,
  boxMatch: createMatchbox().group,
  paperMatch: createMatchbook().group,
};
const ITEM_LIFT = { lighter: 0.035, boxMatch: 0.021, paperMatch: 0.032 }; // 紙マッチは、表紙が見えるように立てかける
const ITEM_QUATERNIONS = {
  lighter: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.55)),
  boxMatch: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0.4)),
  paperMatch: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, 0.35, 0)),
};
scene.add(tableItems.boxMatch, tableItems.paperMatch);

// 左手（風よけ）
const shieldRig = createShieldRig();
const shieldHand = shieldRig.hand;
scene.add(shieldHand.root);
const leftArm = createArm();
scene.add(leftArm.group);

// 炎・煙
const flame = createFlame();
scene.add(flame.mesh, flame.halo);
// 指のすぐ横で光るので、距離の2乗で減衰させると至近距離が白飛びする。減衰はゆるめにする
const flameLight = new THREE.PointLight("#ffa04d", 0, 1.8, 1);
scene.add(flameLight);
const smoke = createSmoke(110);
scene.add(smoke.object);

// 机などに置いてある小物
const phone = createPhone();
phone.group.scale.setScalar(0.42);
phone.group.rotation.y = -0.35;
scene.add(phone.group);
const ashtray = createAshtray();
scene.add(ashtray);
// まったりモードでは、手の届く手前に大きく置く
const ASHTRAY_SCALE = { challenge: 0.55, chill: 1.15 };
let ashtrayMode = "challenge";
function placeAshtray(mode) {
  ashtrayMode = mode;
  ashtray.scale.setScalar(ASHTRAY_SCALE[mode]);
  ashtray.position.copy(environment.spot.tray[mode]);
  ashtray.updateMatrixWorld(true);
}
// いまの場所の机に、道具・スマホ・灰皿を並べる
function placeThings() {
  itemAt.copy(environment.spot.item);
  phoneAt.copy(environment.spot.phone);
  phoneAt.y += 0.008;
  phone.group.position.copy(phoneAt);
  placeAshtray(ashtrayMode);
  placeItem();
}
const moth = createMoth();
scene.add(moth.group);
const rain = createRain();
scene.add(rain.object);
// 横から話しかけてくる人
const strangers = { ojisan: createStranger("ojisan"), salaryman: createStranger("salaryman") };
Object.values(strangers).forEach((stranger) => {
  stranger.add(scene);
  stranger.setVisible(false);
});

/* ======================================================================
 * 状態
 * ==================================================================== */

const sfx = createAudio();
const clock = new THREE.Clock();
const pressedKeys = new Set();
const carriedKeys = new Set(); // 点火画面から押しっぱなしのキー（離すまで左手には効かない）
const rigBase = RIG_IDLE.clone();
const shieldBase = SHIELD_IDLE.clone();
const tremor = new THREE.Vector3();
const flameAnchor = new THREE.Vector3();
const flameHot = new THREE.Vector3();
const tipWorld = new THREE.Vector3();
const palmWorld = new THREE.Vector3();
const palmNormal = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const textCache = new WeakMap();
const handPose = clonePose(POSES.relaxed);
const handPoseTarget = clonePose(POSES.relaxed);
const shieldPose = clonePose(POSES.relaxed);
const shieldPoseTarget = clonePose(POSES.relaxed);
const shieldQuaternion = new THREE.Quaternion();

const state = {
  phase: "ready",
  mode: "challenge", // challenge | unlimited | chill
  spec: DIFFICULTIES.easy, // いまの難易度（チャレンジでは 1 本ごとに変わる）
  rules: DIFFICULTIES.easy.rules,
  stress: 0,
  round: 0,
  totalTime: 0,
  nextRoundIn: 0,
  gasLeft: Infinity,
  baseWindDir: BASE_WIND_DIR,
  flipIn: 0,
  difficulty: readSetting(STORAGE.difficulty, "easy"),
  tool: "lighter",
  view: "main",
  transition: null,
  paused: false,
  elapsed: 0,
  rigTarget: RIG_START.clone(),
  shieldTarget: SHIELD_START.clone(),
  pickupT: 1,
  // 風
  windPhase: 0,
  windSpeed: 12,
  windStrength: 0.6,
  windDir: BASE_WIND_DIR,
  gustBoost: 1,
  // 右手（左クリック）
  thumbDown: false,
  thumbGrace: 0, // 一時停止から戻ったあと、レバーを押し直すまでの猶予
  titleHold: 0, // R の長押し時間（0 = 押していない）
  closeDX: 0,
  closeDY: 0,
  lastScrapeSound: 0,
  lastStrokePop: 0,
  hintedIgnite: false,
  // マッチ
  matchesLeft: 0,
  matchBurn: 0,
  // 左手
  cup: 0,
  cupHeld: false,
  cupLock: 0,
  guard: "none",
  protection: 0,
  facing: 1,
  shieldYaw: SHIELD_YAW_START,
  roof: 0,
  covered: false,
  rainLevel: 0,
  // 吸いつけ
  stability: 1,
  burn: 0,
  lung: 0,
  coughLock: 0,
  keyInhale: false,
  mouseInhale: false,
  puffing: false,
  inRange: false,
  hintedPuff: false,
  // まったりモード
  chillPlace: readSetting(STORAGE.chillPlace, "balcony"),
  tapAsh: false,
  // イベント
  event: null,
  nextEventAt: 0,
  lastEventType: null,
  extraTremor: 0,
  phoneFinger: { x: 0, y: 0 },
  phoneHeld: false, // タッチでスマホの画面に触れている
  // 演出
  shake: 0,
  smokeTimer: 0,
  successT: 0,
  exhaled: false,
  stats: newStats(),
};

const cleared = new Set(readJSON(STORAGE.cleared, []));

const smoker = createSmoker({
  scene,
  camera,
  cig,
  ashtray,
  smoke,
  sfx,
  leftArm,
  rightArm,
  lighterRig,
  lighter,
  elbows: { left: ELBOW_LEFT, right: ELBOW_RIGHT },
  toast,
  onCough: chillCough,
});
smoker.setMouth(cigRestPosition, cigRestQuaternion);
await changePlace("balcony");

function newStats() {
  return { attempts: 0, drops: 0, flameOuts: 0, coughs: 0, burns: 0, eventsCleared: 0, eventsTotal: 0 };
}

/* ======================================================================
 * 入力
 * ==================================================================== */

resizeRenderer();
new ResizeObserver(resizeRenderer).observe(ui.mount);
ui.mount.addEventListener("pointermove", onPointerMove);
ui.mount.addEventListener("pointerdown", onPointerDown);
ui.mount.addEventListener("contextmenu", (event) => event.preventDefault());
ui.phoneUi.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", onWindowBlur);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) onWindowBlur();
});
ui.phoneUi.addEventListener("pointerdown", onPhonePointerDown);
ui.phoneUi.addEventListener("pointerup", onPhonePointerUp);
ui.phoneUi.addEventListener("pointercancel", () => {
  state.phoneHeld = false;
});
ui.banner.addEventListener("pointerdown", onBannerTap);
ui.helpButton.addEventListener("click", () => ui.help.showModal());
ui.help.addEventListener("click", (event) => {
  if (event.target === ui.help) ui.help.close();
});
document.addEventListener("pointerlockchange", onPointerLockChange);
ui.startButton.addEventListener("click", startSelected);
ui.replayButton.addEventListener("click", replay);
ui.titleButton.addEventListener("click", resetToTitle);
ui.soundToggle.addEventListener("click", toggleSound);
buildTitle();
renderSoundToggle();
renderTitle();

const HELD_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyQ", "KeyE"]);

function onKeyDown(event) {
  const code = event.code;
  const inGame = !ui.gameLayout.hidden;
  if (inGame && (HELD_KEYS.has(code) || code === "Space" || code.startsWith("Arrow"))) event.preventDefault();
  if (HELD_KEYS.has(code)) pressedKeys.add(code);
  if (code === "ShiftLeft" || code === "ShiftRight") state.cupHeld = true;
  if (event.repeat || ui.help.open) return;

  if (state.paused) {
    if (code === "KeyQ") resetToTitle();
    else if (code === "Enter" || code === "Escape" || code === "KeyP") resumeFromPause();
    return;
  }
  if ((code === "Escape" || code === "KeyP") && inGame && canPause()) {
    event.preventDefault();
    pauseGame();
    return;
  }
  if (code === "KeyR" && inGame) {
    // 左手のキーの隣なので、プレイ中は長押しでだけ戻る
    if (isTiming()) state.titleHold = 1e-4;
    else resetToTitle();
    return;
  }
  if (code === "Enter" && (state.phase === "ready" || state.phase === "success" || state.phase === "failed")) {
    event.preventDefault();
    if (state.phase === "ready") startSelected();
    else replay();
    return;
  }
  if (state.event?.type === "sneeze" && sneezeKey(state.event, code)) return;
  if (code === "Space") {
    if (state.phase === "pickup") pickUp();
    else state.keyInhale = true;
  }
  if (code === "KeyF" && state.phase === "chill") state.tapAsh = true;
}

function onKeyUp(event) {
  pressedKeys.delete(event.code);
  carriedKeys.delete(event.code);
  if (event.code === "KeyR") state.titleHold = 0;
  if (event.code === "Space") state.keyInhale = false;
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") state.cupHeld = false;
}

function onWindowBlur() {
  if (canPause() && !state.paused) pauseGame();
  else releaseAllInput();
}

function releaseAllInput() {
  pressedKeys.clear();
  carriedKeys.clear();
  state.titleHold = 0;
  state.keyInhale = false;
  state.mouseInhale = false;
  state.cupHeld = false;
  touch.reset();
  touchPointer.id = null;
  if (state.thumbDown) releaseThumb();
}

// タッチは movementX が端末ごとに違うので、自分で差分を取る。右手に使う指は 1 本だけ
const touchPointer = { id: null, x: 0, y: 0 };
function pointerDelta(event) {
  if (event.pointerType !== "touch") return [event.movementX, event.movementY];
  if (event.pointerId !== touchPointer.id) return [0, 0];
  const delta = [event.clientX - touchPointer.x, event.clientY - touchPointer.y];
  touchPointer.x = event.clientX;
  touchPointer.y = event.clientY;
  return delta;
}

function onPointerMove(event) {
  if (state.paused) return;
  const [dx, dy] = pointerDelta(event);
  // スマホを見ている間は、マウスは画面をなぞる指になる
  if (isPhoneOpen()) {
    if (event.pointerType !== "touch") movePhoneFinger(dx, dy);
    else if (event.currentTarget === ui.phoneUi) movePhoneFinger(...touchOnPhone(event));
    return;
  }
  if (state.phase === "ignite") {
    state.closeDX += dx * (event.pointerType === "touch" ? TOUCH_IGNITE_GAIN : 1);
    state.closeDY += dy * (event.pointerType === "touch" ? TOUCH_IGNITE_GAIN : 1);
    return;
  }
  if (state.phase !== "light") return;
  const rect = ui.mount.getBoundingClientRect();
  const scale = (event.pointerType === "touch" ? TOUCH_GAIN : MOUSE_GAIN) / Math.max(1, rect.height);
  state.rigTarget.x = clamp(state.rigTarget.x + dx * scale, RIG_BOUNDS.minX, RIG_BOUNDS.maxX);
  state.rigTarget.y = clamp(state.rigTarget.y - dy * scale, RIG_BOUNDS.minY, RIG_BOUNDS.maxY);
}

// スマホの画面に触れた位置までの動き
function touchOnPhone(event) {
  const rect = ui.phoneScreen.getBoundingClientRect();
  return [event.clientX - rect.left - state.phoneFinger.x, event.clientY - rect.top - state.phoneFinger.y];
}

function onPhonePointerDown(event) {
  if (event.pointerType !== "touch" || !isPhoneOpen()) return;
  event.preventDefault();
  state.phoneHeld = true;
  const rect = ui.phoneScreen.getBoundingClientRect();
  state.phoneFinger.x = clamp(event.clientX - rect.left, 0, rect.width);
  state.phoneFinger.y = clamp(event.clientY - rect.top, 0, rect.height);
  renderPhoneFinger();
}

function onPhonePointerUp(event) {
  state.phoneHeld = false;
  if (event.pointerType === "touch" && isPhoneOpen()) pressPhone();
}

// くしゃみ：タッチではバナーを連打する
function onBannerTap(event) {
  if (state.event?.type !== "sneeze") return;
  event.preventDefault();
  sneezeKey(state.event, state.event.data.code);
}

function onPointerDown(event) {
  if (state.paused) {
    resumeFromPause();
    // 左クリックで再開したら、そのままレバー（押し付け）を押さえ直したことにする
    if (event.button === 0 && isPlaying()) state.thumbDown = true;
    return;
  }
  if (event.button === 2) {
    state.mouseInhale = true;
    return;
  }
  if (event.button !== 0) return;
  if (state.phase === "pickup") {
    lockPointer();
    pickUp();
    return;
  }
  if (state.phase === "chill") {
    state.mouseInhale = true;
    return;
  }
  if (isPhoneOpen()) {
    pressPhone();
    return;
  }
  if (!isPlaying()) return;
  if (event.pointerType === "touch") {
    if (touchPointer.id !== null) return; // もう片方の指
    touchPointer.id = event.pointerId;
    touchPointer.x = event.clientX;
    touchPointer.y = event.clientY;
    ui.mount.setPointerCapture?.(event.pointerId);
    // ライターは指を置き直すたびに、親指をホイールの後ろから擦り直せる
    if (state.phase === "ignite" && !getCloseup(state.tool).state.lit) getCloseup(state.tool).home();
  }
  state.thumbDown = true;
}

function onPointerUp(event) {
  if (event.pointerType === "touch") {
    if (state.phase === "chill") state.mouseInhale = false;
    if (event.pointerId !== touchPointer.id) return;
    touchPointer.id = null;
    if (!state.thumbDown) return;
    // 指を置き直すまで少しだけ待つ（ガスがすぐ止まらないように）
    if (state.phase === "light" && state.tool === "lighter") {
      state.thumbDown = false;
      state.thumbGrace = TOUCH_LIFT_GRACE;
    } else releaseThumb();
    return;
  }
  if (event.button === 2) {
    state.mouseInhale = false;
    return;
  }
  if (event.button === 0 && state.phase === "chill") state.mouseInhale = false;
  if (event.button === 0 && state.thumbDown) releaseThumb();
}

function releaseThumb() {
  state.thumbDown = false;
  if (state.paused) return;
  // ライターは親指でガスレバーを押さえている。離すと火が消える
  if (state.phase === "light" && state.tool === "lighter") flameOut("親指を離したらガスが止まった");
}

function lockPointer() {
  if (touch.active) return;
  try {
    const request = ui.mount.requestPointerLock?.();
    if (request && typeof request.catch === "function") request.catch(() => {});
  } catch {
    // ポインタロックが使えない環境でも、キャンバス上のマウス移動で遊べる
  }
}

function canPause() {
  return isTiming() || state.phase === "chill";
}

function onPointerLockChange() {
  const locked = document.pointerLockElement === ui.mount;
  if (!locked && state.phase !== "chill" && canPause() && !state.paused) pauseGame();
}

function pauseGame() {
  if (state.paused) return;
  state.paused = true;
  state.thumbGrace = state.thumbDown ? THUMB_RESUME_GRACE : 0;
  releaseAllInput();
  sfx.setRain(0);
  sfx.setWind(0);
  sfx.setPuff(0);
  sfx.setMoth(0);
  if (document.pointerLockElement) document.exitPointerLock?.();
  showMessage("PAUSED", "一時停止中", touch.active ? "画面をタップで再開　右上の Ⅱ でタイトルへ" : "クリック / Enter で再開　Q でタイトルへ");
}

function resumeFromPause() {
  if (!state.paused) return;
  state.paused = false;
  hideMessage();
  if (state.phase !== "chill") lockPointer();
  if (state.thumbGrace > 0 && state.phase === "light") toast(touch.active ? "指を置き直せ！" : "クリックを押し直せ！", "info");
}

// 親指でレバーを押さえているか（再開直後は、押し直すまで少しだけ待つ）
function isThumbHeld() {
  return state.thumbDown || state.thumbGrace > 0;
}

function updateThumbGrace(delta) {
  if (state.thumbGrace <= 0) return;
  state.thumbGrace = state.thumbDown ? 0 : Math.max(0, state.thumbGrace - delta);
  if (state.thumbGrace === 0 && !state.thumbDown) releaseThumb();
}

function updateLeftHandKeys(delta) {
  if (state.phase !== "light") return;
  const held = (code) => Number(pressedKeys.has(code) && !carriedKeys.has(code));
  const x = held("KeyD") - held("KeyA") + touch.stickX;
  const y = held("KeyW") - held("KeyS") - touch.stickY;
  if (x || y) {
    const length = Math.max(1, Math.hypot(x, y));
    const step = SHIELD_KEY_SPEED * (touch.active ? 1.25 : 1) * delta;
    state.shieldTarget.x = clamp(state.shieldTarget.x + (x / length) * step, SHIELD_BOUNDS.minX, SHIELD_BOUNDS.maxX);
    state.shieldTarget.y = clamp(state.shieldTarget.y + (y / length) * step, SHIELD_BOUNDS.minY, SHIELD_BOUNDS.maxY);
  }
  // 手首を回して、手のひらの向きを自分で決める（Q = 左へ、E = 右へ）
  const turn = held("KeyE") - held("KeyQ");
  if (touch.active) {
    // タッチではキーが足りないので、手のひらは自動で炎の方を向く
    const goal = clamp(Math.atan2(flameHot.x - palmWorld.x, 0.16), -1.2, 1.2);
    state.shieldYaw += clamp(goal - state.shieldYaw, -SHIELD_TURN_SPEED * delta, SHIELD_TURN_SPEED * delta);
  } else if (turn) {
    state.shieldYaw = clamp(state.shieldYaw + turn * SHIELD_TURN_SPEED * delta, -SHIELD_YAW_LIMIT, SHIELD_YAW_LIMIT);
  }
  // F 長押しで手を水平にして、煙草の上にかざす（雨よけ）
  const roofGoal = Math.max(held("KeyF"), Number(touch.roof));
  state.roof += (roofGoal - state.roof) * Math.min(1, delta * 9);
}

function fingerInput() {
  if (touch.grip) return [true, true, true, true];
  const fingers = [false, false, false, false];
  for (const [code, index] of Object.entries(GRIP_KEYS)) fingers[index] = pressedKeys.has(code);
  return fingers;
}

// 紙マッチの本体を持つ左手
function bookInput() {
  const held = (code) => Number(pressedKeys.has(code));
  return {
    x: held("KeyD") - held("KeyA") + touch.stickX,
    y: held("KeyW") - held("KeyS") - touch.stickY,
    tilt: held("KeyQ") - held("KeyE"),
    hold: state.cupHeld || touch.grip || touch.stickHeld,
  };
}

function toggleSound() {
  sfx.setEnabled(!sfx.isEnabled());
  renderSoundToggle();
}

/* ======================================================================
 * タイトル画面（難易度の選択）
 * ==================================================================== */

function chillUnlocked() {
  return CHILL_KEYS.every((key) => cleared.has(key));
}

function selectMode(mode) {
  if (mode === "chill" && !chillUnlocked()) return;
  const special = mode === "chill" || mode === "unlimited";
  state.mode = special ? mode : "challenge";
  if (!special) {
    state.difficulty = mode;
    writeSetting(STORAGE.difficulty, mode);
  }
  renderTitle();
}

function modeCard({ key, level, title, note, limits, place, className = "" }) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `mode-card ${className}`;
  card.innerHTML = `
    <span class="mode-thumb" style="background-image:url('${PLACES[place].thumb}')"></span>
    <span class="mode-body">
      <span class="mode-level">${level}</span>
      <strong>${title}</strong>
      <span class="mode-desc">${note}</span>
      <span class="mode-limits">${limits.map((text) => `<i>${text}</i>`).join("")}</span>
      <span class="mode-foot"><span data-best>BEST --.--</span><span class="mode-clear" data-clear hidden>CLEAR</span></span>
    </span>`;
  card.addEventListener("click", () => selectMode(key));
  ui.modeList.append(card);
  return card;
}

function buildTitle() {
  if (!DIFFICULTIES[state.difficulty]) state.difficulty = "easy";
  ui.modeCards = Object.entries(DIFFICULTIES).map(([key, spec]) => {
    const card = modeCard({ key, level: spec.label, title: TOOLS[spec.tool].label, note: spec.note, limits: spec.limits, place: spec.place });
    card.dataset.difficulty = key;
    return card;
  });
  ui.unlimitedCard = modeCard({
    key: "unlimited",
    level: "UNLIMITED",
    title: "チャレンジ",
    note: "何本つけられるか。1 本ごとに厳しくなり、ストレスが限界で終わり。",
    limits: ["道具と場所が毎回変わる"],
    place: "rooftop",
    className: "mode-unlimited",
  });
  ui.unlimitedCard.id = "mode-unlimited";
  ui.chillCard = modeCard({
    key: "chill",
    level: "おまけ",
    title: "まったり喫煙",
    note: "場所を選んで、ただ吸って、吐く。",
    limits: [],
    place: "kissaten",
    className: "mode-chill",
  });
  ui.chillCard.id = "mode-chill";
  ui.chillCard.querySelector(".mode-foot").innerHTML = `<span class="mode-lock" data-lock>${ICONS.lock}かんたん〜むずかしいをクリアで解放</span>`;
  if (!PLACES[state.chillPlace]) state.chillPlace = PLACE_IDS[0];
  ui.placeList.setAttribute("role", "radiogroup");
  ui.placeList.setAttribute("aria-label", "場所");
  ui.placeCards = PLACE_IDS.map((id) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "place-card";
    card.setAttribute("role", "radio");
    card.dataset.place = id;
    card.style.backgroundImage = `url("${PLACES[id].thumb}")`;
    const label = document.createElement("span");
    label.textContent = PLACES[id].label;
    const note = document.createElement("small");
    note.textContent = PLACES[id].note;
    label.append(note);
    card.append(label);
    card.addEventListener("click", () => {
      state.chillPlace = id;
      writeSetting(STORAGE.chillPlace, id);
      environment.preload(id).catch(() => {});
      renderTitle();
    });
    ui.placeList.append(card);
    return card;
  });
}

function renderTitle() {
  ui.modeCards.forEach((card) => {
    const key = card.dataset.difficulty;
    const selected = state.mode === "challenge" && key === state.difficulty;
    card.setAttribute("aria-pressed", String(selected));
    const best = readBest(key);
    card.querySelector("[data-best]").textContent = best ? `BEST ${formatTime(best)}` : "BEST --.--";
    card.querySelector("[data-clear]").hidden = !cleared.has(key);
  });
  const record = readJSON(STORAGE.unlimited, null);
  ui.unlimitedCard.setAttribute("aria-pressed", String(state.mode === "unlimited"));
  ui.unlimitedCard.querySelector("[data-best]").textContent = record ? `BEST ${record.count} 本` : "BEST -- 本";
  const unlocked = chillUnlocked();
  ui.chillCard.disabled = !unlocked;
  ui.chillCard.classList.toggle("is-locked", !unlocked);
  ui.chillCard.setAttribute("aria-pressed", String(state.mode === "chill"));
  ui.chillCard.querySelector("[data-lock]").hidden = unlocked;
  ui.placePicker.hidden = state.mode !== "chill";
  ui.placeCards.forEach((card) => card.setAttribute("aria-checked", String(card.dataset.place === state.chillPlace)));
  // 選んだ場所を先に組み立てておく
  const nextPlace = state.mode === "chill" ? state.chillPlace : state.mode === "unlimited" ? unlimitedRound(0).place : DIFFICULTIES[state.difficulty].place;
  environment.preload(nextPlace).catch(() => {});
  if (state.mode === "chill") ui.startLabel.textContent = `${PLACES[state.chillPlace].label}で、まったり吸う`;
  else if (state.mode === "unlimited") ui.startLabel.textContent = "チャレンジを始める";
  else ui.startLabel.textContent = `${DIFFICULTIES[state.difficulty].label}（${TOOLS[DIFFICULTIES[state.difficulty].tool].label}）でスタート`;
}

function startSelected() {
  if (touch.active) enterFullscreen();
  if (state.mode === "chill") startChill();
  else if (state.mode === "unlimited") startUnlimited();
  else startGame(state.difficulty);
}

// 結果画面からもう一度
function replay() {
  if (state.mode === "unlimited") startUnlimited();
  else startGame(state.difficulty);
}

/* ======================================================================
 * 進行
 * ==================================================================== */

// 場所を組み立ててから begin を呼ぶ。読み込んでいる間に別の操作があったら何もしない
let placeRequest = 0;
async function enterPlace(id, begin) {
  placeRequest += 1;
  const request = placeRequest;
  ui.startButton.disabled = true;
  try {
    if (currentPlace.id !== id) await changePlace(id);
  } catch {
    toast("場所を読み込めなかった。もう一度試して", "danger");
    return;
  } finally {
    ui.startButton.disabled = false;
  }
  if (request !== placeRequest) return;
  begin();
  sfx.setAmbience(id);
}

function startGame(difficulty) {
  if (!["ready", "success", "failed"].includes(state.phase)) return;
  sfx.unlock();
  document.activeElement?.blur?.();
  state.mode = "challenge";
  state.difficulty = difficulty;
  beginRun(DIFFICULTIES[difficulty]);
}

// チャレンジ（UNLIMITED）：つけられなくなるまで続ける
function startUnlimited() {
  if (!["ready", "success", "failed"].includes(state.phase)) return;
  sfx.unlock();
  document.activeElement?.blur?.();
  state.mode = "unlimited";
  state.round = 0;
  state.totalTime = 0;
  state.stats = newStats();
  beginRun(unlimitedRound(0));
}

function nextRound() {
  state.round += 1;
  beginRun(unlimitedRound(state.round));
}

function beginRun(spec) {
  enterPlace(spec.place, () => {
    state.spec = spec;
    state.rules = spec.rules;
    state.tool = spec.tool;
    ui.startScreen.hidden = true;
    ui.gameLayout.hidden = false;
    const carried = state.mode === "unlimited" && state.round > 0 ? state.stats : null;
    resetRun();
    if (carried) state.stats = carried;
    setPhase("pickup");
    setStep(-1);
    const item = { lighter: "ライター", boxMatch: "マッチ箱", paperMatch: "紙マッチ" }[state.tool];
    const copy = touch.active ? "画面をタップして手に取ろう" : "クリックで手に取ろう（マウスがゲームに固定されます。Esc で解除）";
    const limit = state.rules.timeLimit ? `　制限 ${Math.round(state.rules.timeLimit)} 秒` : "";
    showMessage(`${spec.label}・${PLACES[currentPlace.id].label}${limit}`, `${item}は目の前。`, copy);
    resizeRenderer();
  });
}

function matchStock() {
  const kind = TOOLS[state.tool].kind;
  return kind ? (state.rules.stock ?? MATCH_SETTINGS[kind].stock) : 0;
}

/* ----------------------------------------------------------------------
 * ストレス：うまくいかないほど、時間がたつほど溜まり、手が震える
 * -------------------------------------------------------------------- */

function addStress(amount) {
  if (state.mode === "chill") return;
  state.stress = clamp(state.stress + amount * state.rules.stress, 0, 1);
}

function relieveStress(amount) {
  state.stress = Math.max(0, state.stress - amount);
}

function updateRules(delta) {
  if (!isTiming()) return;
  addStress(STRESS.time * delta);
  if (state.phase === "light" && state.puffing) relieveStress(STRESS.inhale * delta);
  if (state.rules.stressOut && state.stress >= 1) {
    failGame("ストレスが限界に達した");
    return;
  }
  if (state.rules.timeLimit && state.elapsed >= state.rules.timeLimit) {
    failGame("時間切れ");
    return;
  }
  // ガスの残り（鬼など）：レバーを押している間だけ減る
  if (state.tool === "lighter" && Number.isFinite(state.gasLeft)) {
    const open = state.phase === "light" ? isThumbHeld() : state.phase === "ignite" && getCloseup("lighter").state.gas > 0.3;
    if (open) state.gasLeft -= delta;
    if (state.gasLeft <= 0) {
      failGame("ガスが切れた");
      return;
    }
  }
  // 風向きが勝手に変わる（地獄など）
  if (state.rules.windFlip && state.event?.type !== "gust") {
    state.flipIn -= delta;
    if (state.flipIn <= 0) {
      state.flipIn = state.rules.windFlip * randRange(0.75, 1.35);
      state.baseWindDir *= -1;
      state.windDir = state.baseWindDir;
      toast(`風向きが変わった（${sideName(state.windDir)}から）`, "info");
    }
  }
}

function resetToTitle() {
  if (document.pointerLockElement) document.exitPointerLock?.();
  resetRun();
  // タイトル画面では毎フレームの更新が止まるので、雨音はここで消しておく
  sfx.stopAll();
  setPhase("ready");
  ui.gameLayout.hidden = true;
  ui.startScreen.hidden = false;
  hideMessage();
  renderTitle();
}

function resetRun() {
  clearEvent();
  releaseAllInput();
  ui.gameLayout.dataset.mode = state.mode;
  smoker.stop();
  placeAshtray(state.mode === "chill" ? "chill" : "challenge");
  phone.group.visible = state.mode !== "chill";
  Object.assign(state, {
    paused: false,
    elapsed: 0,
    pickupT: 1,
    windDir: BASE_WIND_DIR,
    gustBoost: 1,
    thumbDown: false,
    thumbGrace: 0,
    titleHold: 0,
    closeDX: 0,
    closeDY: 0,
    matchesLeft: matchStock(),
    stress: state.mode === "unlimited" && state.round > 0 ? state.stress : 0,
    nextRoundIn: 0,
    gasLeft: state.rules.gas ?? Infinity,
    baseWindDir: BASE_WIND_DIR,
    flipIn: state.rules.windFlip ?? 0,
    matchBurn: 0,
    cup: 0,
    cupLock: 0,
    guard: "none",
    protection: 0,
    facing: 1,
    shieldYaw: SHIELD_YAW_START,
    roof: 0,
    covered: false,
    rainLevel: 0,
    stability: 1,
    burn: 0,
    lung: 0,
    coughLock: 0,
    puffing: false,
    inRange: false,
    hintedPuff: false,
    tapAsh: false,
    nextEventAt: 0,
    lastEventType: null,
    extraTremor: 0,
    shake: 0,
    smokeTimer: 0,
    successT: 0,
    exhaled: false,
    stats: newStats(),
  });
  setView("main");
  state.rigTarget.copy(RIG_START);
  state.shieldTarget.copy(SHIELD_START);
  rigBase.copy(RIG_IDLE);
  shieldBase.copy(SHIELD_IDLE);
  ui.sceneWrap.dataset.tool = state.tool === "lighter" ? "lighter" : "match";
  ui.sceneWrap.dataset.hands = state.tool === "paperMatch" ? "two" : "one";
  ui.sceneWrap.dataset.blind = String(state.rules.blind && state.mode !== "chill");
  ui.sceneWrap.dataset.gas = String(state.rules.gas !== null && state.tool === "lighter");
  Object.entries(tableItems).forEach(([tool, item]) => {
    item.visible = tool === state.tool && state.mode !== "chill";
  });
  placeItem();
  Object.values(matchRigs).forEach((rig) => rig.match.setBurn(0, 0));
  smoke.clear();
  cig.setConsumed(0, 0);
  flame.mesh.visible = false;
  flame.halo.visible = false;
  ui.result.hidden = true;
  ui.toastLayer.replaceChildren();
  closePhoneUi();
  Object.values(strangers).forEach((stranger) => stranger.setVisible(false));
  setText(ui.timer, "00.00");
  renderBest();
  renderDifficultyChip();
}

function placeItem() {
  const item = tableItems[state.tool];
  item.position.copy(itemAt);
  item.position.y += ITEM_LIFT[state.tool];
  item.quaternion.copy(ITEM_QUATERNIONS[state.tool]);
}

function pickUp() {
  if (state.phase !== "pickup") return;
  state.elapsed = 0;
  state.nextEventAt = state.rules.firstEvent;
  hideMessage();
  sfx.pickup();
  if (state.tool === "lighter") {
    // ライターは手の中に収まってから手元のズームアップへ
    state.pickupT = 0;
    setPhase("grab");
    setStep(-1);
  } else {
    enterIgnite({ fresh: true });
  }
}

function setPhase(phase) {
  state.phase = phase;
  ui.sceneWrap.dataset.phase = phase;
  setText(ui.phase, PHASE_LABEL[phase] ?? phase.toUpperCase());
  renderHints();
}

function renderHints() {
  const match = state.tool !== "lighter";
  const hints = {
    pickup: [["CLICK", match ? "マッチを取る" : "ライターを取る"]],
    ignite: touch.active ? [] : [["MOUSE", match ? "マッチを動かす" : "親指を動かす"], ["CLICK", "押し付ける"]],
    light: match
      ? [["MOUSE", "炎を先端へ"], ["SPACE", "吸う"], ["WASD / SHIFT", "風よけ"], ["Q / E", "手首"], ["F", "かざす"]]
      : [["CLICK 長押し", "ガス"], ["MOUSE", "炎を先端へ"], ["SPACE", "吸う"], ["WASD / SHIFT", "風よけ"], ["Q / E", "手首"], ["F", "かざす"]],
    chill: [["SPACE 長押し", "吸う"], ["離す", "吐く"], ["F", "灰を落とす"], ["R", "タイトルへ"]],
  }[state.phase] ?? [];
  ui.keyHints.innerHTML = hints.map(([key, label]) => `<span class="hint"><kbd>${key}</kbd>${label}</span>`).join("");
}

function setStep(completedIndex) {
  ui.steps.forEach((step, index) => {
    step.classList.toggle("done", index <= completedIndex);
    step.classList.toggle("active", index === completedIndex + 1);
  });
}

function isPlaying() {
  return state.phase === "ignite" || state.phase === "light";
}

function isTiming() {
  return isPlaying() || state.phase === "grab";
}

function isMatchTool() {
  return state.tool !== "lighter";
}

function renderDifficultyChip() {
  if (state.mode === "chill") {
    setText(ui.difficultyChip, `まったり喫煙・${PLACES[state.chillPlace].label}`);
    return;
  }
  setText(ui.difficultyChip, `${state.spec.label}・${TOOLS[state.tool].label}・${PLACES[state.spec.place].label}`);
}

/* ----------------------------------------------------------------------
 * 画面の切り替え（一人称 ⇄ 手元のズームアップ）
 * -------------------------------------------------------------------- */

function setView(view) {
  state.view = view;
  state.transition = null;
  ui.veil.style.opacity = "0";
  applyRenderTarget(view);
}

function applyRenderTarget(view) {
  const closeup = view === "close" ? getCloseup(state.tool) : null;
  renderPass.scene = closeup ? closeup.scene : scene;
  renderPass.camera = closeup ? closeup.camera : camera;
}

function switchView(view) {
  state.transition = { t: 0, view, swapped: false };
}

function updateTransition(rawDelta) {
  const transition = state.transition;
  if (!transition) return;
  transition.t += Math.min(rawDelta, 0.05);
  if (!transition.swapped && transition.t >= VIEW_FADE.out) {
    transition.swapped = true;
    state.view = transition.view;
    applyRenderTarget(transition.view);
  }
  const opacity = transition.swapped
    ? 1 - clamp((transition.t - VIEW_FADE.out) / VIEW_FADE.in, 0, 1)
    : clamp(transition.t / VIEW_FADE.out, 0, 1);
  ui.veil.style.opacity = String(opacity);
  if (transition.swapped && transition.t >= VIEW_FADE.out + VIEW_FADE.in) {
    state.transition = null;
    ui.veil.style.opacity = "0";
  }
}

/* ----------------------------------------------------------------------
 * 02 火をつける：手元にズームして、指で道具を操作する
 * -------------------------------------------------------------------- */

function enterIgnite({ fresh }) {
  setPhase("ignite");
  setStep(0);
  // 手元の画面では起こらないイベントは片付ける
  if (state.event && !EVENT_PHASES[state.event.type].includes("ignite")) clearEvent();
  state.closeDX = 0;
  state.closeDY = 0;
  const closeup = getCloseup(state.tool);
  // 前回の点火状態が残らないよう、暗転を待たずにすぐリセットする
  closeup.enter({ fresh });
  renderIgniteSteps(closeup);
  switchView("close");
  if (!state.hintedIgnite) {
    state.hintedIgnite = true;
    const hint = touch.active
      ? state.tool === "paperMatch"
        ? "左のスティックに触れて本体を持ち、右側をなぞって擦れ"
        : isMatchTool() ? "左の「握る」を押さえ、光る所を右側でなぞって擦れ" : `左の「握る」を押さえ、右側を${closeup.forwardSide}下へ素早くはじけ`
      : state.tool === "paperMatch"
        ? "左手：SHIFT で持ち、WASD で動かし、Q / E で水平に。右手：マウス"
        : isMatchTool() ? "A S D F でつまみ、光る所を擦れ" : "A S D F で握り、親指をホイールの上へ";
    setTimeout(() => toast(hint, "info"), 450);
  }
}

function renderIgniteSteps(closeup) {
  const texts =
    state.tool === "lighter"
      ? ["親指をホイールの上へ", `押し付けて${closeup.forwardSide}下へ素早く擦り下ろす`, "熱が溜まったら、そのまま赤いレバーを押し込む"]
      : state.tool === "boxMatch"
        ? ["マッチの頭をヤスリへ", "光る所を、SPEED の帯の速さで擦る", "場所が変わるたびに、狙い直す"]
        : ["左手で本体を持ち、水平に保つ", "光る所を、SPEED の帯の速さで軽く擦る", "場所が変わるたびに、狙い直す"];
  ui.igniteSteps.forEach((element, index) => {
    element.innerHTML = `<b>${index + 1}</b>${texts[index]}`;
  });
  ui.extraGauge.hidden = !closeup.state.extraLabel;
  ui.extraLabel.textContent = closeup.state.extraLabel ?? "";
}

const STROKE_TEXT = {
  good: (gain) => `いい擦り！ 熱 +${Math.max(1, Math.round(gain * 100))}%`,
  slow: () => "遅い！ もっと素早く",
  weak: () => (touch.active ? "押し付けが弱い" : "押し付けが弱い（クリックしたまま）"),
  grip: () => (touch.active ? "握りが甘い（左手）" : state.tool === "paperMatch" ? "左手の力が甘い（SHIFT）" : "握りが甘い（A S D F）"),
  hard: () => "強すぎ！ 折れるぞ",
  late: () => "熱は十分！ 擦ってすぐレバーへ",
  fast: () => "速すぎ！ 軸が傷む",
  spot: () => "場所が違う！ 光る所を擦れ",
  long: () => "幅が広すぎ！ 光る所だけを擦れ",
  tilt: () => "傾いている！ 左手で水平に",
};

function updateIgnitePhase(delta, time) {
  const closeup = getCloseup(state.tool);
  const phoneOpen = isPhoneOpen();
  const events = closeup.update(delta, time, {
    dx: phoneOpen ? 0 : state.closeDX,
    dy: phoneOpen ? 0 : state.closeDY,
    pressing: isThumbHeld() && !phoneOpen,
    fingers: fingerInput(),
    left: bookInput(),
    heatRate: state.rules.heatRate,
    tremor: tremorIntensity(),
    viewportHeight: ui.mount.clientHeight,
  });
  state.closeDX = 0;
  state.closeDY = 0;

  for (const ev of events) {
    if (ev.type === "spark") {
      if (time - state.lastScrapeSound > 0.07) {
        state.lastScrapeSound = time;
        sfx.strike(ev.amount > 7 ? "perfect" : ev.amount > 3 ? "good" : "weak");
      }
    } else if (ev.type === "scrape") {
      if (time - state.lastScrapeSound > 0.06) {
        state.lastScrapeSound = time;
        sfx.scrape(ev.amount);
      }
    } else if (ev.type === "stroke") {
      state.stats.attempts += 1;
      popStroke(STROKE_TEXT[ev.quality](ev.gain), ev.quality === "good" ? "good" : "bad");
      if (ev.quality !== "good") {
        sfx.dud();
        addStress(STRESS.badStroke);
      }
    } else if (ev.type === "ignite") {
      state.stats.attempts += 1;
      relieveStress(STRESS.lit);
      if (isMatchTool()) sfx.matchIgnite();
      else sfx.ignite();
      flash("ignite");
      toast(isMatchTool() ? "点いた！ そのまま煙草へ" : touch.active ? "点火！ 指は離さない" : "点火！ クリックは押したまま", "good");
    } else if (ev.type === "flameOut") {
      sfx.fizz();
      addStress(STRESS.flameOut * 0.5);
      toast("レバーを離したら消えた", "danger");
    } else if (ev.type === "blownOut") {
      sfx.fizz();
      addStress(STRESS.flameOut);
      spendMatch("速く振りすぎて消えた");
      if (state.phase === "ignite") closeup.enter({ fresh: false });
    } else if (ev.type === "broken") {
      sfx.snap();
      flash("hit");
      addStress(STRESS.broken);
      spendMatch(ev.reason === "pressure" ? "マッチが折れた！ 押し付けすぎ" : "マッチが折れた！ 速く擦りすぎ");
    } else if (ev.type === "bookDrop") {
      sfx.dud();
      flash("hit");
      addStress(STRESS.dropped);
      state.elapsed += ev.penalty;
      toast(`紙マッチを落とした！（+${ev.penalty} 秒）`, "danger");
    } else if (ev.type === "bookRegrip") {
      sfx.pickup();
    } else if (ev.type === "drop") {
      state.stats.drops += 1;
      addStress(STRESS.dropped);
      if (isMatchTool()) sfx.dud();
      else sfx.drop();
      flash("hit");
      if (isMatchTool()) spendMatch("マッチを落とした！");
      else {
        state.elapsed += DROP_PENALTY;
        toast(`ライターを落とした！（+${DROP_PENALTY} 秒）`, "danger");
      }
    } else if (ev.type === "regrip") {
      if (state.phase === "ignite") {
        if (isMatchTool()) sfx.matchTake();
        else sfx.pickup();
        toast(isMatchTool() ? "新しいマッチを取った" : "拾い直した。しっかり握れ", "info");
      }
    }
  }

  // 火がついたまま少し保てたら、一人称視点へ戻って吸いつけへ
  const holding = isMatchTool() || isThumbHeld();
  if (state.phase === "ignite" && closeup.state.lit && closeup.state.litTime >= LIT_HOLD_TO_EXIT && holding && !state.transition) {
    exitToLight(closeup);
  }
}

function spendMatch(message) {
  state.matchesLeft = Math.max(0, state.matchesLeft - 1);
  if (state.matchesLeft <= 0) {
    toast(message, "danger");
    failGame("マッチが尽きた");
    return;
  }
  toast(`${message}（残り ${state.matchesLeft} 本）`, "danger");
}

function exitToLight(closeup) {
  setPhase("light");
  setStep(1);
  pressedKeys.forEach((code) => carriedKeys.add(code));
  state.stability = 0.85;
  state.lung = 0;
  state.coughLock = 0;
  state.pickupT = 1;
  state.matchBurn = isMatchTool() ? closeup.state.burn : 0;
  switchView("main");
  toast(isMatchTool() ? "燃え尽きる前に煙草の先端へ" : touch.active ? "炎を煙草の先端へ。指は離さない" : "炎を煙草の先端へ。クリックは押したまま", "good");
}

/* ----------------------------------------------------------------------
 * 左手の風よけ（向きは Q / E で自分で決める）
 * -------------------------------------------------------------------- */

function updateGuard(delta) {
  state.cupLock = Math.max(0, state.cupLock - delta);
  const wantCup = (state.cupHeld || touch.cup) && state.cupLock === 0 && state.phase === "light";
  state.cup += ((wantCup ? 1 : 0) - state.cup) * Math.min(1, delta * 12);

  const dx = (palmWorld.x - flameHot.x) * state.windDir;
  const dy = palmWorld.y - flameHot.y;
  const inZone = dx >= SHIELD_ZONE.near && dx <= SHIELD_ZONE.far && dy >= -SHIELD_ZONE.below && dy <= SHIELD_ZONE.above;
  // 手のひらが炎の方を向いているか
  tmpVec.set(flameHot.x - palmWorld.x, 0, flameHot.z - palmWorld.z).normalize();
  state.facing = palmNormal.x * tmpVec.x + palmNormal.z * tmpVec.z;
  const facingFactor = smoothstep(0.1, 0.55, state.facing);
  const cupped = state.cup > 0.6;
  if (!inZone) state.guard = "none";
  else if (facingFactor < 0.2) state.guard = "back";
  else state.guard = cupped ? "cup" : "open";
  const table = isGustActive() ? PROTECTION.gust : PROTECTION.normal;
  state.protection = state.guard === "back" ? 0 : table[state.guard] * facingFactor;

  // 雨よけ：水平にした手が煙草の先の上にあるか
  state.covered =
    state.roof > 0.6 &&
    Math.abs(palmWorld.x - tipWorld.x) < ROOF_COVER.x &&
    palmWorld.y - tipWorld.y > ROOF_COVER.below &&
    palmWorld.y - tipWorld.y < ROOF_COVER.above;

  // すぼめた指が炎に近すぎるとやけど
  const nearX = Math.abs(palmWorld.x - flameHot.x);
  if (state.phase === "light" && cupped && state.facing > 0.2 && nearX < SHIELD_ZONE.burn && Math.abs(dy) < 0.2) burnFingers();
}

function currentExposure() {
  return 1 - state.protection;
}

function burnFingers() {
  const away = Math.sign(palmWorld.x - flameHot.x) || -state.windDir;
  state.shieldTarget.x = clamp(flameHot.x + away * 0.34, SHIELD_BOUNDS.minX, SHIELD_BOUNDS.maxX);
  shieldBase.x += away * 0.12;
  state.cupLock = 1.1;
  state.cup = 0;
  state.stats.burns += 1;
  addStress(STRESS.burn);
  state.shake = Math.max(state.shake, 0.35);
  state.stability = Math.max(0, state.stability - 0.12);
  sfx.cough();
  flash("hit");
  toast("あつっ！ 指を近づけすぎた", "danger");
}

/* ----------------------------------------------------------------------
 * 03 吸いつける
 * -------------------------------------------------------------------- */

function updateLightPhase(delta) {
  const exposure = currentExposure();
  const windFactor = TOOLS[state.tool].wind * state.rules.wind;
  let drain = 0.03 + state.windStrength * exposure * 0.5 * windFactor;
  if (isGustActive()) drain += 0.8 * exposure * windFactor;
  state.stability -= drain * delta;
  if (exposure < 0.3) state.stability += 0.3 * delta;
  state.stability = clamp(state.stability, 0, 1);

  // マッチは燃え尽きる
  if (isMatchTool()) {
    state.matchBurn += delta / MATCH_SETTINGS[TOOLS[state.tool].kind].life;
    if (state.matchBurn >= 1) {
      state.shake = Math.max(state.shake, 0.4);
      flameOut("あつっ！ マッチが燃え尽きた", { spend: true });
      return;
    }
  }

  const distance = Math.hypot(flameHot.x - tipWorld.x, flameHot.y - tipWorld.y);
  state.inRange = distance < TIP_RANGE;
  if (state.inRange && !state.hintedPuff) {
    state.hintedPuff = true;
    toast(touch.active ? "先端に当たった！「吸う」を長押し" : "先端に当たった！ SPACE 長押しで吸え", "info");
  }
  state.coughLock = Math.max(0, state.coughLock - delta);
  const inhaling = (state.keyInhale || state.mouseInhale || touch.inhale) && state.coughLock === 0;
  if (inhaling && !state.puffing) sfx.inhale();
  state.puffing = inhaling;

  if (inhaling) state.lung = Math.min(1, state.lung + (LIGHT.lungFill / state.rules.breath) * delta);
  else state.lung = Math.max(0, state.lung - LIGHT.lungRecover * delta);

  if (state.inRange) {
    const rate = inhaling ? LIGHT.burnRate * (0.45 + 0.55 * state.protection) * (0.4 + 0.6 * state.stability) : 0.03;
    state.burn = Math.min(1, state.burn + rate * delta);
  } else {
    state.burn = Math.max(0, state.burn - 0.04 * delta);
  }

  if (state.lung >= 1) cough();
  if (state.stability <= 0.015) {
    flameOut("火が消えた！ もう一度つけ直せ", { spend: true });
    return;
  }
  if (state.burn >= 1) winGame();
}

function cough() {
  state.coughLock = LIGHT.coughLock;
  state.lung = 0.35;
  state.burn = Math.max(0, state.burn - 0.18);
  state.stability = Math.max(0, state.stability - 0.2);
  state.shake = Math.max(state.shake, 0.55);
  state.stats.coughs += 1;
  addStress(STRESS.cough);
  jolt(0.06);
  sfx.cough();
  flash("hit");
  toast("ゲホッ！ 吸いすぎてむせた", "danger");
}

function flameOut(message, { spend = false } = {}) {
  if (state.phase !== "light") return;
  state.lung = 0;
  state.burn *= 0.7;
  state.puffing = false;
  state.stats.flameOuts += 1;
  addStress(STRESS.flameOut);
  sfx.fizz();
  flash("hit");
  // マッチは一度消えたら使い捨て
  if (isMatchTool() && spend) {
    spendMatch(message);
    if (state.phase === "failed") return;
  } else {
    toast(message, "danger");
  }
  enterIgnite({ fresh: false });
}

/* ----------------------------------------------------------------------
 * 結果
 * -------------------------------------------------------------------- */

// ランク F になる秒数（制限時間のある難易度は、その時間）
function failLine() {
  return state.rules.timeLimit ?? FAIL_LINE;
}

function rankFor(difficulty, seconds) {
  if (seconds > failLine()) return "F";
  const limits = DIFFICULTIES[difficulty].ranks;
  const index = limits.findIndex((limit) => seconds <= limit);
  return RANK_LETTERS[index === -1 ? RANK_LETTERS.length - 1 : index];
}

function winGame() {
  clearEvent();
  closePhoneUi();
  setPhase("success");
  setStep(2);
  state.burn = 1;
  state.successT = 0;
  state.exhaled = false;
  state.thumbDown = false;
  state.rigTarget.copy(RIG_REST);
  if (state.mode === "unlimited") {
    // 次の 1 本へ
    state.totalTime += state.elapsed;
    relieveStress(STRESS.nextRound);
    state.nextRoundIn = 2.4;
    sfx.success();
    flash("ignite");
    showMessage("LIT", `${state.round + 1} 本目、着火。`, `合計 ${formatTime(state.totalTime)} 秒　次は ${PLACES[unlimitedRound(state.round + 1).place].label}`);
    return;
  }
  const rank = rankFor(state.difficulty, state.elapsed);
  const best = readBest(state.difficulty);
  const isBest = !best || state.elapsed < best;
  if (isBest) writeSetting(STORAGE.best(state.difficulty), String(state.elapsed));
  // ランク F 以外で着火したらクリア
  const wasUnlocked = chillUnlocked();
  if (rank !== "F") {
    cleared.add(state.difficulty);
    writeSetting(STORAGE.cleared, JSON.stringify([...cleared]));
  }
  const unlockedNow = !wasUnlocked && chillUnlocked();
  renderBest();
  sfx.success();
  flash("ignite");
  if (document.pointerLockElement) document.exitPointerLock?.();
  showResult({ success: true, rank, isBest, unlockedNow });
}

function failGame(reason) {
  clearEvent();
  closePhoneUi();
  setPhase("failed");
  state.thumbDown = false;
  state.rigTarget.copy(RIG_REST);
  if (state.view === "close" || state.transition) switchView("main");
  sfx.fail();
  if (document.pointerLockElement) document.exitPointerLock?.();
  showResult({ success: false, rank: "F", isBest: false, unlockedNow: false, reason });
}

function showResult({ success, rank, isBest, unlockedNow, reason }) {
  const stats = state.stats;
  const unlimited = state.mode === "unlimited";
  if (unlimited) {
    // チャレンジ：つけた本数が記録になる
    const record = readJSON(STORAGE.unlimited, null);
    const time = state.totalTime + state.elapsed;
    isBest = state.round > 0 && (!record || state.round > record.count || (state.round === record.count && time < record.time));
    if (isBest) writeSetting(STORAGE.unlimited, JSON.stringify({ count: state.round, time }));
    rank = String(state.round);
  }
  ui.result.dataset.tone = (success && rank !== "F") || (unlimited && state.round > 0) ? "success" : "fail";
  ui.resultKicker.textContent = unlimited ? "UNLIMITED" : success ? "CIGARETTE LIT" : "FAILED";
  ui.resultDifficulty.textContent = unlimited ? `${state.spec.label}で終了` : `${state.spec.label}・${TOOLS[state.tool].label}`;
  ui.resultRank.textContent = rank;
  ui.resultTime.textContent = formatTime(unlimited ? state.totalTime + state.elapsed : state.elapsed);
  ui.resultBest.hidden = !isBest;
  ui.resultCopy.textContent = unlimited
    ? `${reason}。${state.round} 本つけた。`
    : success ? RANK_COPY[rank] : `${reason}。火をつけられなかったのでランクは F。`;
  ui.resultUnlock.hidden = !unlockedNow;
  ui.resStrikes.textContent = String(stats.attempts);
  if (isMatchTool()) {
    const used = matchStock() - state.matchesLeft + (success ? 1 : 0);
    ui.resDropsLabel.textContent = "使ったマッチ";
    ui.resDrops.textContent = `${used} 本`;
  } else {
    ui.resDropsLabel.textContent = "落とした";
    ui.resDrops.textContent = String(stats.drops);
  }
  ui.resEvents.textContent = `${stats.eventsCleared}/${stats.eventsTotal}`;
  ui.resMistakes.textContent = `${stats.flameOuts} / ${stats.coughs}`;
  ui.result.hidden = false;
  setText(ui.timer, formatTime(state.elapsed));
  if (unlockedNow) setTimeout(() => toast("まったり喫煙モードが解放された！", "good"), 600);
}

/* ======================================================================
 * まったり喫煙モード（3 つの難易度をクリアすると遊べる）
 * ==================================================================== */

function startChill() {
  if (!chillUnlocked()) return;
  sfx.unlock();
  document.activeElement?.blur?.();
  state.mode = "chill";
  state.tool = "lighter";
  enterPlace(state.chillPlace, () => {
    ui.startScreen.hidden = true;
    ui.gameLayout.hidden = false;
    resetRun();
    setPhase("chill");
    setStep(2);
    smoker.start();
    showMessage("CHILL", "ただ、吸う。", touch.active ? "画面を長押しで吸って、離して吐く" : "SPACE かクリックの長押しで吸って、離して吐く");
    setTimeout(hideMessage, 2600);
    resizeRenderer();
  });
}

function chillCough() {
  state.shake = Math.max(state.shake, 0.55);
  sfx.cough();
  flash("hit");
  toast("ゲホッ！ 吸いすぎてむせた", "danger");
}

function updateChill(delta, time) {
  smoker.update(delta, time, { inhale: state.keyInhale || state.mouseInhale, tap: state.tapAsh }, flameHot);
  state.tapAsh = false;
  state.puffing = smoker.state.inhaling;
  state.lung = smoker.state.lung;
  state.coughLock = smoker.state.coughLock;
}

/* ======================================================================
 * お邪魔イベント
 * ==================================================================== */

const EVENTS = {
  gust: { weight: 3, start: startGust, update: updateGust, cleanup: cleanupGust },
  moth: { weight: 2, start: startMoth, update: updateMoth, cleanup: cleanupMoth },
  sneeze: { weight: 2, start: startSneeze, update: updateSneeze, cleanup: cleanupSneeze },
  phone: { weight: 2, start: startPhone, update: updatePhone, cleanup: cleanupPhone },
  call: { weight: 2, start: startCall, update: updateCall, cleanup: cleanupPhone },
  rain: { weight: 2, start: startRain, update: updateRain, cleanup: cleanupRain },
  moocher: { weight: 2, start: startMoocher, update: updateMoocher, cleanup: cleanupStranger },
  lender: { weight: 2, start: startLender, update: updateLender, cleanup: cleanupStranger },
};

function updateEvents(delta) {
  const ev = state.event;
  if (!ev) {
    if (state.elapsed >= state.nextEventAt && !state.transition) {
      const type = pickEventType();
      if (type) startEvent(type);
    }
    return;
  }
  ev.t += delta;
  EVENTS[ev.type].update(ev, delta, clock.elapsedTime);
}

function pickEventType() {
  const entries = Object.entries(EVENTS).filter(
    ([type]) => type !== state.lastEventType && EVENT_PHASES[type].includes(state.phase),
  );
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, def]) => sum + def.weight, 0);
  let roll = Math.random() * total;
  for (const [type, def] of entries) {
    roll -= def.weight;
    if (roll <= 0) return type;
  }
  return entries[0][0];
}

function startEvent(type) {
  const ev = { type, t: 0, stage: "active", data: {} };
  state.event = ev;
  state.stats.eventsTotal += 1;
  sfx.alert();
  EVENTS[type].start(ev);
}

function endEvent(success, message) {
  const ev = state.event;
  if (!ev) return;
  EVENTS[ev.type].cleanup(ev);
  state.event = null;
  state.lastEventType = ev.type;
  state.nextEventAt = state.elapsed + randRange(...state.rules.events);
  if (success) {
    state.stats.eventsCleared += 1;
    relieveStress(STRESS.eventCleared);
    sfx.clear();
  } else if (message) {
    addStress(STRESS.eventFailed);
  }
  hideBanner();
  if (message) toast(message, success ? "good" : "danger");
}

function clearEvent() {
  if (state.event) {
    EVENTS[state.event.type].cleanup(state.event);
    state.nextEventAt = state.elapsed + randRange(state.rules.events[0] * 0.8, state.rules.events[1] * 0.75);
  }
  state.event = null;
  hideBanner();
}

function isGustActive() {
  return state.event?.type === "gust" && state.event.stage === "active";
}

function sideName(dir) {
  return dir < 0 ? "左" : "右";
}

/* --- 突風 --- */

function startGust(ev) {
  const dir = Math.random() < 0.6 ? -state.baseWindDir : state.baseWindDir;
  ev.stage = "warn";
  ev.data = { dir, warn: 1.5, duration: 2.8, exposed: 0 };
  showBanner({
    icon: "gust",
    kicker: "GUST WARNING",
    title: `${sideName(dir)}から突風が来る！`,
    copy: touch.active ? `左手を炎の${sideName(dir)}側へ動かし、「すぼめる」` : `左手を炎の${sideName(dir)}側へ。Q / E で手のひらを炎へ向け、SHIFT ですぼめろ`,
    tone: "warn",
  });
}

function updateGust(ev, delta) {
  const data = ev.data;
  if (ev.stage === "warn") {
    setBannerTimer(1 - ev.t / data.warn);
    if (ev.t >= data.warn) {
      ev.stage = "active";
      ev.t = 0;
      state.windDir = data.dir;
      state.gustBoost = 1.9;
      state.shake = Math.max(state.shake, 0.18);
      sfx.gust();
      showBanner({
        icon: "gust",
        kicker: "GUST",
        title: "突風！ 火を守れ",
        copy: `炎の${sideName(data.dir)}側をガード`,
        tone: "danger",
      });
    }
    return;
  }
  if (state.protection < 0.9) data.exposed += delta;
  setBannerTimer(1 - ev.t / data.duration);
  if (ev.t >= data.duration) {
    const ok = data.exposed < data.duration * 0.4;
    const restored = data.dir !== state.baseWindDir;
    endEvent(ok, ok ? "突風をしのいだ！" : "突風をまともに受けた…");
    if (restored) toast(`風向きが元に戻った（${sideName(state.baseWindDir)}から）`, "info");
  }
}

function cleanupGust() {
  state.windDir = state.baseWindDir;
  state.gustBoost = 1;
}

/* --- 蛾 --- */

function startMoth(ev) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const start = new THREE.Vector3(side * 1.15, 1.6 + Math.random() * 0.2, RIG_Z - 0.04);
  moth.group.position.copy(start);
  moth.group.visible = true;
  ev.data = { start, duration: 4.4, mode: "approach", after: 0, vel: new THREE.Vector3() };
  showBanner({
    icon: "moth",
    kicker: "MOTH",
    title: "蛾が火に寄ってくる！",
    copy: touch.active ? "左手（スティック）で払いのけろ" : "左手（WASD）で払いのけろ",
    tone: "warn",
  });
}

function updateMoth(ev, delta) {
  const data = ev.data;
  const body = moth.group;
  const flap = Math.sin(ev.t * 42) * 0.95;
  moth.wings.forEach((pivot) => {
    pivot.rotation.y = flap * pivot.userData.side;
  });
  body.rotation.z = Math.sin(ev.t * 5) * 0.3;

  if (data.mode === "approach") {
    sfx.setMoth(Math.min(1, ev.t / data.duration));
    const progress = Math.min(1, ev.t / data.duration);
    const eased = progress * progress * (3 - 2 * progress);
    body.position.lerpVectors(data.start, flameHot, eased);
    const wobble = (1 - progress) * 0.12 + 0.012;
    body.position.x += Math.sin(ev.t * 6.3) * wobble;
    body.position.y += Math.sin(ev.t * 8.7 + 1) * wobble * 0.7;
    setBannerTimer(1 - progress);
    if (palmWorld.distanceTo(body.position) < 0.2) {
      shooMoth(ev);
      return;
    }
    if (progress >= 1) landMoth(ev);
    return;
  }

  if (data.mode === "landed") {
    body.position.copy(flameHot).add(tmpVec2.set(Math.sin(ev.t * 30) * 0.004, 0.01, 0));
    data.after += delta;
    if (data.after > 1.2) {
      data.mode = "leave";
      data.after = 0;
      data.vel.set(randRange(-0.6, 0.6), 1.1, 0);
    }
    return;
  }

  body.position.addScaledVector(data.vel, delta);
  data.after += delta;
  if (data.after > 0.8) endEvent(data.mode === "flee", data.mode === "flee" ? "蛾を追い払った！" : null);
}

function shooMoth(ev) {
  const data = ev.data;
  if (data.mode !== "approach") return;
  data.mode = "flee";
  data.after = 0;
  tmpVec.subVectors(moth.group.position, palmWorld).setZ(0);
  if (tmpVec.lengthSq() < 1e-4) tmpVec.set(0, 1, 0);
  data.vel.copy(tmpVec.normalize().multiplyScalar(2.2)).add(tmpVec2.set(0, 0.8, 0));
  sfx.swat();
  showBanner({ icon: "moth", kicker: "MOTH", title: "追い払った！", copy: "", tone: "good" });
  setBannerTimer(0);
}

function landMoth(ev) {
  ev.data.mode = "landed";
  ev.data.after = 0;
  state.stability = Math.max(0, state.stability - 0.4);
  toast("蛾が炎に飛び込んだ！", "danger");
  flash("hit");
  showBanner({ icon: "moth", kicker: "MOTH", title: "やられた…", copy: "", tone: "danger" });
  setBannerTimer(0);
}

function cleanupMoth() {
  sfx.setMoth(0);
  moth.group.visible = false;
}

/* --- 着信 --- */

function startCall(ev) {
  const caller = pick(CALLERS);
  ev.data = { duration: 9, nextRing: 0, talking: -1, dwell: 0, dwellOn: null };
  ui.callName.textContent = caller;
  const avatar = AVATAR_URLS[caller];
  ui.callAvatar.style.backgroundImage = avatar ? `url("${avatar}")` : "";
  ui.callAvatar.classList.toggle("has-photo", Boolean(avatar));
  ui.callStatus.textContent = "着信中…";
  ui.phoneCall.classList.remove("is-talking");
  ui.callButtons.forEach((button) => button.style.setProperty("--dwell", "0"));
  phone.setNotification(caller, "着信中");
  phone.setLit(1.1);
  state.extraTremor = 0.2;
  openPhoneUi("call");
  showBanner({
    icon: "phone",
    kicker: "INCOMING CALL",
    title: `${caller}から電話！`,
    copy: touch.active ? "「拒否」をタップ" : "スマホの「拒否」を押せ（指を乗せてクリック、または乗せたまま待つ）",
    tone: "warn",
  });
}

function updateCall(ev, delta) {
  const data = ev.data;
  ui.phoneTimer.style.transform = `scaleX(${clamp(1 - ev.t / data.duration, 0, 1)})`;
  if (data.talking >= 0) {
    data.talking += delta;
    setBannerTimer(1 - data.talking / 2.6);
    if (data.talking >= 2.6) endEvent(false, "電話に出てしまった…");
    return;
  }
  setBannerTimer(1 - ev.t / data.duration);
  if (ev.t >= data.nextRing) {
    sfx.ring();
    data.nextRing += 1.2;
  }
  // 指を乗せたまま少し待っても押せる（ガスを押さえたままでも操作できるように）
  const button = hoveredCallButton();
  const choice = button?.dataset.call ?? null;
  if (choice !== data.dwellOn) {
    data.dwellOn = choice;
    data.dwell = 0;
  }
  data.dwell = choice ? data.dwell + delta : 0;
  ui.callButtons.forEach((element) => {
    element.style.setProperty("--dwell", element.dataset.call === choice ? String(Math.min(1, data.dwell / 0.7)) : "0");
  });
  if (choice && data.dwell >= 0.7) {
    answerCall(ev, choice);
    return;
  }
  const buzzing = ev.t % 1.2 < 0.5;
  phone.group.position.x = phoneAt.x + (buzzing ? Math.sin(ev.t * 95) * 0.004 : 0);
  if (ev.t >= data.duration) endEvent(false, "着信に気を取られた…");
}

/* --- 急な雨：F で手をかざして煙草を守る --- */

function startRain(ev) {
  ev.stage = "warn";
  ev.data = { warn: 1.2, duration: 6, wet: 0 };
  showBanner({
    icon: "rain",
    kicker: "RAIN",
    title: "急に雨が降ってきた！",
    copy: touch.active ? "「かざす」で左手を水平にして、煙草の先の上へ" : "F 長押しで左手を水平にして、煙草の先の上にかざせ",
    tone: "warn",
  });
}

function updateRain(ev, delta) {
  const data = ev.data;
  if (ev.stage === "warn") {
    state.rainLevel = Math.min(0.35, ev.t / data.warn * 0.35);
    setBannerTimer(1 - ev.t / data.warn);
    if (ev.t >= data.warn) {
      ev.stage = "active";
      ev.t = 0;
      showBanner({ icon: "rain", kicker: "RAIN", title: "どしゃ降り！ 煙草を守れ", copy: touch.active ? "「かざす」で手をかざす" : "F で手をかざす", tone: "danger" });
    }
    return;
  }
  state.rainLevel = Math.min(1, 0.35 + ev.t * 1.2) * (ev.t > data.duration - 0.8 ? (data.duration - ev.t) / 0.8 : 1);
  setBannerTimer(1 - ev.t / data.duration);
  if (!state.covered && state.phase === "light") {
    data.wet += delta;
    state.stability = Math.max(0, state.stability - 0.32 * delta);
    state.burn = Math.max(0, state.burn - 0.06 * delta);
  }
  if (ev.t >= data.duration) {
    const ok = data.wet < 1.5;
    endEvent(ok, ok ? "雨をしのいだ！" : "煙草が湿ってしまった…");
  }
}

function cleanupRain() {
  state.rainLevel = 0;
}

/* --- 一本くれよおじさん：左手を振って追い返す --- */

function placeStranger(stranger, side, x) {
  stranger.group.position.set(x, 1.33, 6.35);
  stranger.group.rotation.y = Math.atan2(CAMERA_BASE.x - x, CAMERA_BASE.z - 6.35) + side * 0.15;
}

function startMoocher(ev) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const stranger = strangers.ojisan;
  stranger.setVisible(true);
  placeStranger(stranger, side, side * 2.2);
  ev.data = { side, stranger, need: 6, waves: 0, lastDir: 0, lastPalmX: palmWorld.x, duration: 7, leaving: -1, line: "なぁ兄ちゃん、一本くれよ〜", voiced: 1 };
  sfx.voiceSmoke();
  showBanner({
    icon: "beggar",
    kicker: "BEGGAR",
    title: "一本くれよおじさん",
    copy: `左手をおじさん（${sideName(side)}）側へ出して${touch.active ? "スティックを左右に" : " A / D を素早く"}往復、シッシッと追い返せ`,
    tone: "warn",
    pips: ev.data.need,
  });
}

function updateMoocher(ev, delta, time) {
  const data = ev.data;
  const stranger = data.stranger;
  if (data.leaving >= 0) {
    data.leaving += delta;
    placeStranger(stranger, data.side, data.side * (1.18 + data.leaving * 2));
    stranger.reach(tmpVec.set(data.side * 1.0, 0.9, 6.7));
    if (data.leaving > 0.6) endEvent(data.result, data.message);
    return;
  }
  const enter = Math.min(1, ev.t / 0.7);
  placeStranger(stranger, data.side, data.side * (2.2 - 1.02 * (1 - (1 - enter) ** 3)));
  // 手のひらを上にして「ちょうだい」
  stranger.reach(tmpVec.set(data.side * 0.5, 0.98 + Math.sin(ev.t * 3) * 0.02, 7.05), { palmUp: true });
  // 声に合わせて口を動かす。しばらくしたらもう一度言う
  if (data.voiced === 1 && ev.t > 3.8) {
    data.voiced = 2;
    sfx.voiceSmoke();
  }
  const speaking = ev.t % 3.8;
  stranger.talk(ev.t, speaking < 2.1 ? 1 : 0.1);
  showSpeech(stranger, ev.t < 3.8 ? data.line : "なぁ、いいだろ〜");

  // おじさん側で左手を往復させた回数を数える
  const vx = (palmWorld.x - data.lastPalmX) / Math.max(delta, 1e-4);
  data.lastPalmX = palmWorld.x;
  const onHisSide = palmWorld.x * data.side > 0.12;
  if (onHisSide && Math.abs(vx) > 0.5) {
    const dir = Math.sign(vx);
    if (dir !== data.lastDir && data.lastDir !== 0) {
      data.waves += 1;
      renderPips(data.waves, data.need);
      sfx.shoo();
      popStroke("シッ！", "good");
    }
    data.lastDir = dir;
  }
  setBannerTimer(1 - ev.t / data.duration);
  if (data.waves >= data.need) {
    data.leaving = 0;
    data.result = true;
    data.message = "おじさんを追い返した";
    showSpeech(stranger, "ちぇっ、ケチだなぁ…");
    return;
  }
  if (ev.t >= data.duration) {
    state.elapsed += 3;
    data.leaving = 0;
    data.result = false;
    data.message = "1 本持っていかれた…（+3 秒）";
    showSpeech(stranger, "へへ、ありがとよ");
  }
}

/* --- ライター貸してくださいおじさん：右手を遠ざけて断る --- */

function startLender(ev) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const stranger = strangers.salaryman;
  stranger.setVisible(true);
  placeStranger(stranger, side, side * 2.2);
  ev.data = {
    side,
    stranger,
    duration: 5.5,
    leaving: -1,
    reachPos: new THREE.Vector3(side * 0.9, 1.0, 6.9),
    line: "すみません、ライター貸してもらえます？",
  };
  sfx.voiceLighter();
  showBanner({
    icon: "lender",
    kicker: "BORROWER",
    title: "ライター貸してくださいおじさん",
    copy: touch.active ? "手が伸びてくる。右手を遠ざけて断れ" : "手が伸びてくる。右手（マウス）を遠ざけて断れ",
    tone: "warn",
  });
}

function updateLender(ev, delta) {
  const data = ev.data;
  const stranger = data.stranger;
  if (data.leaving >= 0) {
    data.leaving += delta;
    placeStranger(stranger, data.side, data.side * (1.18 + data.leaving * 2));
    stranger.reach(data.reachPos.lerp(tmpVec.set(data.side * 1.2, 0.9, 6.7), Math.min(1, delta * 4)), { palmUp: false });
    if (data.leaving > 0.6) endEvent(data.result, data.message);
    return;
  }
  const enter = Math.min(1, ev.t / 0.7);
  placeStranger(stranger, data.side, data.side * (2.2 - 1.02 * (1 - (1 - enter) ** 3)));
  stranger.talk(ev.t, ev.t < 2.7 ? 1 : 0.1);
  showSpeech(stranger, data.line);
  // 手がこちらの右手（ライター / マッチ）へ伸びてくる
  const rig = activeRig().group.position;
  if (ev.t > 0.8) {
    tmpVec.copy(rig).sub(data.reachPos);
    const step = Math.min(tmpVec.length(), 0.42 * delta);
    data.reachPos.addScaledVector(tmpVec.normalize(), step);
  }
  stranger.reach(data.reachPos, { palmUp: false });
  setBannerTimer(1 - ev.t / data.duration);
  if (data.reachPos.distanceTo(rig) < 0.09) {
    data.leaving = 0;
    data.result = false;
    showSpeech(stranger, isMatchTool() ? "マッチでもいいや、どうも〜" : "どうも〜");
    if (isMatchTool()) {
      data.message = null;
      endEvent(false, null);
      spendMatch("マッチを 1 本取られた");
      if (state.phase === "light") flameOut("取られた拍子に火が消えた");
    } else {
      state.elapsed += 4;
      endEvent(false, "ライターを貸してしまった（+4 秒）");
      flameOut("返してもらったら火は消えていた");
    }
    return;
  }
  if (ev.t >= data.duration) {
    data.leaving = 0;
    data.result = true;
    data.message = "きっぱり断った";
    showSpeech(stranger, "あ、そうですか…");
  }
}

function cleanupStranger(ev) {
  ev.data.stranger?.setVisible(false);
  ui.speech.hidden = true;
}

function showSpeech(stranger, text) {
  stranger.head.getWorldPosition(tmpVec2);
  tmpVec2.y += 0.2;
  const point = projectToScene(tmpVec2, tmpVec2);
  ui.speech.hidden = false;
  if (ui.speech.textContent !== text) ui.speech.textContent = text;
  const width = ui.sceneWrap.clientWidth;
  ui.speech.style.left = `${clamp(point.x, 120, width - 120)}px`;
  ui.speech.style.top = `${clamp(point.y, 70, ui.sceneWrap.clientHeight - 120)}px`;
}

/* --- くしゃみ --- */

function startSneeze(ev) {
  const [code, label] = pick(SNEEZE_KEYS);
  ev.data = { code, label, need: 6, count: 0, duration: 2.8 };
  state.extraTremor = 0.35;
  showBanner({
    icon: "sneeze",
    kicker: "SNEEZE",
    title: "ハ…ハッ…！",
    copy: touch.active ? "ここを連打してこらえろ" : `${label} を連打してこらえろ`,
    tone: "warn",
    key: touch.active ? "TAP" : label,
    tappable: true,
    pips: ev.data.need,
  });
}

function sneezeKey(ev, code) {
  if (code !== ev.data.code) return false;
  ev.data.count += 1;
  renderPips(ev.data.count, ev.data.need);
  sfx.tick();
  state.shake = Math.max(state.shake, 0.05);
  if (ev.data.count >= ev.data.need) endEvent(true, "くしゃみをこらえた！");
  return true;
}

function updateSneeze(ev) {
  setBannerTimer(1 - ev.t / ev.data.duration);
  if (ev.t >= ev.data.duration) {
    sneezeHit();
    endEvent(false, "ハックション！");
  }
}

function sneezeHit() {
  sfx.sneeze();
  addStress(STRESS.sneeze);
  flash("hit");
  state.shake = 1;
  if (state.phase === "ignite") {
    getCloseup(state.tool).jolt(0.3);
  } else if (state.phase === "light") {
    jolt(0.2, true);
    state.stability = Math.max(0, state.stability - 0.35);
    state.burn = Math.max(0, state.burn - 0.12);
  }
}

function cleanupSneeze() {
  state.extraTremor = 0;
}

/* --- スマホ通知：画面にスマホを出し、指（マウス）で通知をスワイプして消す --- */

function startPhone(ev) {
  const count = state.spec.notifications;
  const messages = [...PHONE_MESSAGES].sort(() => Math.random() - 0.5).slice(0, count);
  ev.data = { duration: PHONE_DURATION, nextBuzz: 0, cards: [] };
  ui.phoneStack.replaceChildren();
  messages.forEach(([from, text, color], index) => {
    const card = document.createElement("div");
    card.className = "notif";
    card.style.setProperty("--app", color);
    card.innerHTML = `<div class="notif-head"><i></i><span>MESSAGE</span><span>${index === 0 ? "今" : `${index + 1}分前`}</span></div><strong></strong><p></p>`;
    card.querySelector("strong").textContent = from;
    card.querySelector("p").textContent = text;
    ui.phoneStack.appendChild(card);
    ev.data.cards.push({ element: card, drag: 0, gone: false });
  });
  phone.setNotification(messages[0][0], messages[0][1]);
  phone.setLit(1.1);
  state.extraTremor = 0.25;
  openPhoneUi("notify");
  showBanner({
    icon: "phone",
    kicker: "INCOMING",
    title: `スマホに通知が ${count} 件`,
    copy: touch.active ? "通知を左右にスワイプして全部消せ" : "マウスで通知を左右にスワイプして全部消せ",
    tone: "warn",
  });
}

function isPhoneOpen() {
  return (state.event?.type === "phone" || state.event?.type === "call") && !ui.phoneUi.hidden;
}

function openPhoneUi(mode) {
  ui.phoneUi.hidden = false;
  ui.phoneUi.dataset.mode = mode;
  ui.phoneNotify.hidden = mode !== "notify";
  ui.phoneCall.hidden = mode !== "call";
  const now = new Date();
  ui.phoneClock.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  restartAnimation(ui.phoneUi);
  const rect = ui.phoneScreen.getBoundingClientRect();
  state.phoneFinger.x = rect.width / 2;
  state.phoneFinger.y = rect.height * 0.78;
  renderPhoneFinger();
}

function closePhoneUi() {
  ui.phoneUi.hidden = true;
  state.phoneHeld = false;
}

function movePhoneFinger(dx, dy) {
  const ev = state.event;
  if (!ev) return;
  const rect = ui.phoneScreen.getBoundingClientRect();
  const previousX = state.phoneFinger.x;
  state.phoneFinger.x = clamp(state.phoneFinger.x + dx, 0, rect.width);
  state.phoneFinger.y = clamp(state.phoneFinger.y + dy, 0, rect.height);
  renderPhoneFinger();
  if (ev.type === "call") return;
  // 指が乗っている通知を、横の動きの分だけ引っぱる。
  // 判定は動かす前の配置（offset*）で行う（スワイプ中もカードから外れないように）
  const fingerX = state.phoneFinger.x;
  const fingerY = state.phoneFinger.y;
  const moved = state.phoneFinger.x - previousX;
  for (const card of ev.data.cards) {
    if (card.gone) continue;
    const element = card.element;
    const left = element.offsetLeft;
    const top = element.offsetTop;
    const over =
      fingerX >= left && fingerX <= left + element.offsetWidth && fingerY >= top && fingerY <= top + element.offsetHeight;
    if (!over) continue;
    card.drag += moved;
    card.element.classList.add("is-dragging");
    if (Math.abs(card.drag) >= SWIPE_DISTANCE) dismissCard(ev, card);
    break;
  }
}

// 指の下にある着信ボタン（拒否 / 応答）
function hoveredCallButton() {
  const rect = ui.phoneScreen.getBoundingClientRect();
  const x = rect.left + state.phoneFinger.x;
  const y = rect.top + state.phoneFinger.y;
  return ui.callButtons.find((button) => {
    const box = button.getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  });
}

// スマホを開いている間のクリック = 画面を押す
function pressPhone() {
  const ev = state.event;
  if (ev?.type !== "call" || ev.data.talking >= 0) return;
  const button = hoveredCallButton();
  if (button) answerCall(ev, button.dataset.call);
}

function answerCall(ev, choice) {
  if (choice === "decline") {
    sfx.swipe();
    endEvent(true, "着信を拒否した");
    return;
  }
  // 出てしまった：しばらく話が終わらない
  ev.data.talking = 0;
  ui.callStatus.textContent = "通話中…「もしもし、今ちょっといい？」";
  ui.phoneCall.classList.add("is-talking");
  sfx.mumble(1.2);
}

function dismissCard(ev, card) {
  card.gone = true;
  card.element.classList.remove("is-dragging");
  card.element.classList.add(card.drag > 0 ? "is-gone-right" : "is-gone-left");
  sfx.swipe();
  setTimeout(() => card.element.remove(), 260);
  if (ev.data.cards.every((entry) => entry.gone)) {
    setTimeout(() => {
      if (state.event === ev) endEvent(true, "通知を全部消した");
    }, 220);
  }
}

function renderPhoneFinger() {
  ui.phoneFinger.style.transform = `translate(${state.phoneFinger.x}px, ${state.phoneFinger.y}px)`;
}

function updatePhone(ev, delta) {
  setBannerTimer(1 - ev.t / ev.data.duration);
  ui.phoneTimer.style.transform = `scaleX(${clamp(1 - ev.t / ev.data.duration, 0, 1)})`;
  // 指が離れた通知は元の位置へ戻る
  for (const card of ev.data.cards) {
    if (card.gone) continue;
    if (!state.phoneHeld && !card.element.classList.contains("is-dragging")) card.drag *= Math.exp(-delta * 10);
    card.element.classList.remove("is-dragging");
    card.element.style.transform = `translateX(${card.drag}px) rotate(${card.drag * 0.05}deg)`;
    card.element.style.opacity = String(1 - Math.min(0.6, Math.abs(card.drag) / (SWIPE_DISTANCE * 2)));
  }
  const buzzing = ev.t % 0.9 < 0.35;
  phone.group.position.x = phoneAt.x + (buzzing ? Math.sin(ev.t * 95) * 0.004 : 0);
  if (ev.t >= ev.data.nextBuzz) {
    sfx.buzz();
    ev.data.nextBuzz += 0.9;
  }
  if (ev.t >= ev.data.duration) endEvent(false, "通知に気を取られた…");
}

function cleanupPhone() {
  closePhoneUi();
  phone.setLit(0);
  phone.group.position.copy(phoneAt);
  state.extraTremor = 0;
}

/* ======================================================================
 * 毎フレームの更新（一人称視点）
 * ==================================================================== */

function updateRainVisual(delta) {
  rain.update(delta, state.rainLevel, -state.windDir * state.windStrength * 0.8);
  ui.rainVeil.style.opacity = String(state.rainLevel * 0.55);
  sfx.setRain(state.paused ? 0 : state.rainLevel);
  sfx.setPuff(!state.paused && state.puffing ? 1 : 0);
}

function updateWind(delta) {
  state.windPhase += delta;
  const base = clamp(11 + Math.sin(state.windPhase * 0.55) * 7 + Math.sin(state.windPhase * 1.7) * 3, 3, 22);
  state.windSpeed = base * state.gustBoost;
  state.windStrength = state.windSpeed / 20;
  // 屋内や風の弱い場所では、風も弱い
  state.windStrength *= environment.outdoor * state.rules.wind ** 0.5;
  environment.update(delta, state.windDir, state.windStrength, state.gustBoost, clock.elapsedTime);
  sfx.setWind(state.paused ? 0 : environment.outdoor * (0.06 + Math.max(0, state.windStrength - 0.5) * 0.35));
}

function tremorIntensity() {
  if (!isPlaying()) return 0.2;
  return tremorOf(state.stress) + state.extraTremor;
}

function jolt(amount, persistent = false) {
  const offset = tmpVec2.set(randRange(-amount, amount), randRange(-amount * 0.8, amount * 0.6), 0);
  rigBase.add(offset);
  if (persistent) {
    state.rigTarget.x = clamp(state.rigTarget.x + offset.x, RIG_BOUNDS.minX, RIG_BOUNDS.maxX);
    state.rigTarget.y = clamp(state.rigTarget.y + offset.y, RIG_BOUNDS.minY, RIG_BOUNDS.maxY);
  }
}

function activeRig() {
  return state.tool === "lighter" ? lighterRig : matchRigs[state.tool];
}

function updateRightHand(delta, time) {
  const rig = activeRig();
  lighterRig.group.visible = rig === lighterRig;
  Object.values(matchRigs).forEach((matchRig) => {
    matchRig.group.visible = matchRig === rig;
  });
  const holding = !["ready", "pickup", "chill"].includes(state.phase);
  // マッチは火がついている間だけ手に持っている
  const showMatch = isMatchTool() && (state.phase === "light" || state.phase === "success");
  if (isMatchTool()) rig.match.group.visible = showMatch;

  const goal = holding ? state.rigTarget : RIG_IDLE;
  rigBase.lerp(goal, Math.min(1, delta * (holding ? RIG_FOLLOW : 4)));
  const intensity = holding ? tremorIntensity() : 0.15;
  tremor.set(
    (Math.sin(time * 19) + Math.sin(time * 31 + 1.4) * 0.45) * 0.011 * intensity,
    (Math.sin(time * 23 + 0.8) + Math.sin(time * 37) * 0.35) * 0.008 * intensity,
    Math.sin(time * 17 + 2.1) * 0.006 * intensity,
  );
  rig.group.position.copy(rigBase).add(tremor);
  // 手首を少しだけ動きの方向へ傾ける
  const lean = clamp((state.rigTarget.x - rigBase.x) * -1.2, -0.25, 0.25);
  rig.group.rotation.z += (lean - rig.group.rotation.z) * Math.min(1, delta * 6);
  rig.group.rotation.x = Math.sin(time * 0.9) * 0.02;

  if (rig === lighterRig) {
    // 吸いつけ中は親指でガスレバーを押さえている
    if (!holding) blendPose(POSES.relaxed, POSES.relaxed, 0, handPoseTarget);
    else if (state.phase === "light") blendPose(lighterRig.gripDown, lighterRig.gripDown, 0, handPoseTarget);
    else blendPose(lighterRig.gripUp, lighterRig.gripUp, 0, handPoseTarget);
  } else if (showMatch) {
    blendPose(rig.pinch, rig.pinch, 0, handPoseTarget);
  } else {
    blendPose(POSES.relaxed, POSES.relaxed, 0, handPoseTarget);
  }
  approachPose(handPose, handPoseTarget, delta, holding ? 16 : 8);
  applyPose(rig.hand, handPose);
  rig.group.updateMatrixWorld(true);

  if (rig === lighterRig) {
    // ライター本体：拾う動作の間は机から手の中へ
    lighterRig.mount.getWorldPosition(tmpVec);
    lighterRig.mount.getWorldQuaternion(tmpQuat);
    if (!holding || state.mode === "chill") {
      lighter.group.visible = state.mode !== "chill";
      placeItem();
    } else if (state.pickupT < 1) {
      state.pickupT = Math.min(1, state.pickupT + delta / 0.45);
      const t = state.pickupT * state.pickupT * (3 - 2 * state.pickupT);
      lighter.group.position.lerpVectors(itemAt, tmpVec, t);
      lighter.group.position.y += Math.sin(t * Math.PI) * 0.12 + (1 - t) * ITEM_LIFT.lighter;
      lighter.group.quaternion.slerpQuaternions(ITEM_QUATERNIONS.lighter, tmpQuat, t);
      // 手に収まったら手元のズームアップへ
      if (state.pickupT >= 1 && state.phase === "grab") enterIgnite({ fresh: true });
    } else {
      lighter.group.position.copy(tmpVec);
      lighter.group.quaternion.copy(tmpQuat);
    }
    lighter.group.updateMatrixWorld(true);
  } else {
    rig.match.setBurn(state.matchBurn, showMatch && state.phase === "light" ? 1 : 0);
  }

  rightArm.update(rig.hand, ELBOW_RIGHT);
}

const shieldBasis = new THREE.Matrix4();
const shieldUp = new THREE.Vector3();
const shieldDorsal = new THREE.Vector3();
const shieldThumb = new THREE.Vector3();
const palmOffset = new THREE.Vector3();
const roofQuat = new THREE.Quaternion();

function updateShieldHand(delta, time) {
  const active = state.phase === "light";
  const goal = active ? state.shieldTarget : SHIELD_IDLE;
  shieldBase.lerp(goal, Math.min(1, delta * (active ? 11 : 4)));

  // 手のひらの向きはプレイヤーが Q / E で決める（yaw = 0 で手のひらが奥、+ で右、- で左）
  const yaw = active ? state.shieldYaw : SHIELD_YAW_START;
  palmNormal.set(Math.sin(yaw), 0, -Math.cos(yaw));
  shieldUp.set(palmNormal.x * 0.26, 1, 0.08).normalize();
  shieldDorsal.copy(palmNormal).negate();
  shieldDorsal.addScaledVector(shieldUp, -shieldDorsal.dot(shieldUp)).normalize();
  shieldThumb.crossVectors(shieldUp, shieldDorsal);
  shieldBasis.makeBasis(shieldThumb, shieldUp, shieldDorsal);
  tmpQuat.setFromRotationMatrix(shieldBasis);
  // F：手を水平にして手のひらを下へ（煙草の先の上にかざす屋根）
  if (active && state.roof > 0.01) {
    const toward = Math.sign(tipWorld.x - shieldBase.x) || 1;
    shieldUp.set(toward * 0.75, -0.05, -0.65).normalize();
    shieldDorsal.set(0, 1, 0).addScaledVector(shieldUp, -shieldUp.y).normalize();
    shieldThumb.crossVectors(shieldUp, shieldDorsal);
    shieldBasis.makeBasis(shieldThumb, shieldUp, shieldDorsal);
    roofQuat.setFromRotationMatrix(shieldBasis);
    tmpQuat.slerp(roofQuat, state.roof);
  }
  shieldQuaternion.slerp(tmpQuat, Math.min(1, delta * 12));
  shieldHand.root.quaternion.copy(shieldQuaternion);

  // 手のひらの中心が目標位置に来るよう手首の位置を決める
  palmOffset.copy(shieldHand.palmAnchor.position).multiplyScalar(HAND_SCALE);
  palmOffset.x *= -1; // 左手はミラー
  palmOffset.applyQuaternion(shieldQuaternion);
  shieldHand.root.position.copy(shieldBase).sub(palmOffset);
  shieldHand.root.position.y += Math.sin(time * 1.3) * 0.004;

  if (active) blendPose(POSES.flat, POSES.cup, state.cup, shieldPoseTarget);
  else blendPose(POSES.relaxed, POSES.relaxed, 0, shieldPoseTarget);
  approachPose(shieldPose, shieldPoseTarget, delta, 14);
  applyPose(shieldHand, shieldPose);
  shieldHand.root.updateMatrixWorld(true);
  shieldHand.palmAnchor.getWorldPosition(palmWorld);
  // 実際の手のひらの向き（補間後）
  palmNormal.set(0, 0, -1).applyQuaternion(shieldQuaternion);

  leftArm.update(shieldHand, ELBOW_LEFT);
}

function updateCameraAndCigarette(delta, time) {
  state.shake = Math.max(0, state.shake - delta * 2.2);
  const shake = state.shake * state.shake * 0.05;
  camera.position.set(
    CAMERA_BASE.x + Math.sin(time * 53) * shake,
    CAMERA_BASE.y + Math.sin(time * 61 + 1) * shake,
    CAMERA_BASE.z,
  );
  camera.updateMatrixWorld(true);
  if (state.phase === "chill") return; // まったりモードでは手が持っている
  const intensity = isPlaying() ? tremorIntensity() : 0.15;
  cig.group.position.copy(cigRestPosition);
  cig.group.position.x += Math.sin(time * 18 + 0.3) * 0.016 * intensity;
  cig.group.position.y += Math.sin(time * 25 + 1.2) * 0.014 * intensity;
  // 吸っている間は煙草が少し持ち上がる
  if (state.puffing) cig.group.position.y += 0.006;
  cig.group.quaternion.copy(cigRestQuaternion);
  camera.updateMatrixWorld(true);
  cig.tip.getWorldPosition(tipWorld);
}

function updateFlame(delta, time) {
  const tool = TOOLS[state.tool];
  const anchor = state.tool === "lighter" ? lighter.flameAnchor : matchRigs[state.tool].match.headAnchor;
  anchor.getWorldPosition(flameAnchor);
  flameAnchor.y -= tool.flame.sink;
  const lean = state.windDir * -1 * Math.min(1.4, state.windStrength * state.gustBoost) * (0.25 + currentExposure() * 0.9);
  const lit = state.phase === "light" || (state.phase === "chill" && smoker.state.flameLit);
  const stability = state.phase === "light" ? state.stability : 1;
  // マッチは燃え尽きる直前に炎が小さくなる
  const fade = isMatchTool() ? 1 - smoothstep(0.75, 1, state.matchBurn) * 0.5 : 1;

  const width = tool.flame.width * (0.75 + stability * 0.3) * fade;
  const height = tool.flame.height * (0.6 + stability * 0.45) * fade;
  flame.mesh.visible = lit;
  flame.halo.visible = lit;
  flame.mesh.position.copy(flameAnchor);
  flame.mesh.scale.set(width, Math.max(0.001, height), 1);
  flame.mesh.rotation.set(0, Math.atan2(camera.position.x - flameAnchor.x, camera.position.z - flameAnchor.z), 0);
  flame.uniforms.uTime.value = time;
  flame.uniforms.uLean.value = lean;
  flame.uniforms.uIntensity.value = 0.55 + stability * 0.45;
  flame.uniforms.uCool.value = 0;

  // 一番熱い点（炎の上寄り、風で流れた分も含む）
  flameHot.copy(flameAnchor);
  flameHot.y += height * 0.55;
  flameHot.x += lean * 0.3 * width;

  flame.halo.position.copy(flameHot);
  const haloSize = (0.1 + stability * 0.07) * (tool.flame.width / 0.07);
  flame.halo.scale.set(haloSize, haloSize * 1.2, 1);
  flame.halo.material.opacity = 0.26 + Math.sin(time * 21) * 0.05;

  flameLight.position.copy(flameHot);
  flameLight.position.y += 0.06;
  const lightLevel = lit ? (0.1 + stability * 0.22) * fade : 0;
  flameLight.intensity = lightLevel * (1 + Math.sin(time * 27) * 0.08);
}

function updateCigaretteVisual(delta, time) {
  const chill = state.phase === "chill";
  const lit = state.phase === "success" ? 1 : chill ? smoker.state.lit : state.burn;
  const puffGlow = state.puffing && (chill || state.inRange) && lit > 0 ? 0.7 + Math.sin(time * 20) * 0.1 : 0;
  const breathing = state.phase === "success" || (chill && lit > 0) ? 0.35 + Math.sin(time * 1.6) * 0.15 : 0;
  const glow = clamp(lit * 0.9 + puffGlow + breathing, 0, 2);
  cig.setBurning(lit, glow, delta);
  if (chill) cig.tip.getWorldPosition(tipWorld);
  emberGlow.visible = glow > 0.05 && cig.group.visible;
  emberGlow.position.copy(tipWorld);
  const glowSize = 0.03 + glow * 0.022;
  emberGlow.scale.set(glowSize, glowSize, 1);
  emberGlow.material.opacity = Math.min(0.55, glow * 0.42);
  emberLight.position.copy(tipWorld);
  emberLight.intensity = glow * 0.12;
}

function updateSmoke(delta) {
  state.smokeTimer -= delta;
  if (state.smokeTimer <= 0) {
    if (state.phase === "light" && state.puffing && state.inRange) {
      smoke.emit(tipWorld, { size: 0.02, grow: 0.09, life: 1.3, alpha: 0.4 });
      state.smokeTimer = 0.07;
    } else if (state.phase === "light" && state.burn > 0.25) {
      smoke.emit(tipWorld, { size: 0.015, grow: 0.07, life: 1.6, alpha: 0.22 });
      state.smokeTimer = 0.35;
    } else if (state.phase === "success") {
      smoke.emit(tipWorld, { size: 0.012, grow: 0.12, life: 2.6, alpha: 0.3 });
      state.smokeTimer = 0.18;
    } else {
      state.smokeTimer = 0.1;
    }
  }

  // 着火後、ひと呼吸おいてから煙を吐く
  if (state.phase === "success") {
    state.successT += delta;
    if (!state.exhaled && state.successT > 1.1) {
      state.exhaled = true;
      for (let i = 0; i < 14; i += 1) {
        camera.localToWorld(tmpVec.set(randRange(-0.04, 0.04), -0.26 + randRange(-0.02, 0.02), -0.5));
        smoke.emit(tmpVec, {
          size: 0.05,
          grow: 0.7,
          life: 2.6,
          alpha: 0.28,
          vel: tmpVec2.set(randRange(-0.12, 0.12), randRange(0.05, 0.18), randRange(-0.8, -0.45)),
        });
      }
    }
  }
  smoke.update(delta, -state.windDir * state.windStrength * 0.15);
}

/* ======================================================================
 * HUD
 * ==================================================================== */

const CHILL_LABEL = { light: "火をつけている", ash: "灰を落としている", stub: "もみ消している" };
const GUARD_LABEL = { none: "NG", open: "OPEN", cup: "CUP", back: "向きが逆", burn: "あつっ", roof: "かざし中" };

function updateHud() {
  const timing = isTiming();
  if (timing && !state.paused) setText(ui.timer, formatTime(state.elapsed));
  if (state.phase === "chill") setText(ui.timer, formatTime(smoker.state.time));
  const limit = failLine();
  ui.limitBar.style.transform = `scaleX(${clamp(state.elapsed / limit, 0, 1)})`;
  ui.restartHint.style.setProperty("--hold", String(clamp(state.titleHold / TITLE_HOLD, 0, 1)));
  const overF = state.mode === "challenge" && state.elapsed > limit;
  ui.timerCard.classList.toggle("is-late", timing && limit - state.elapsed < 10);
  ui.timerCard.classList.toggle("is-over", overF);
  setText(ui.timerLabel, state.rules.timeLimit && state.mode !== "chill" ? `/ ${Math.round(state.rules.timeLimit)}` : "");
  setText(ui.timerRank, state.mode === "chill" ? "" : state.mode === "unlimited" ? `${state.round + 1} 本目` : overF ? "F" : rankFor(state.difficulty, state.elapsed));

  // ストレス
  const stress = state.mode === "chill" ? 0 : state.stress;
  setBar(ui.stressBar, stress);
  ui.stressBar.parentElement.classList.toggle("is-danger", stress > 0.7);
  setText(ui.stressValue, stress > 0.9 ? "限界" : stress > 0.7 ? "イライラ" : stress > 0.4 ? "そわそわ" : "平常");
  ui.sceneWrap.style.setProperty("--stress", stress.toFixed(3));
  if (Number.isFinite(state.gasLeft)) {
    setBar(ui.fuelBar, state.gasLeft / state.rules.gas);
    ui.fuelBar.parentElement.classList.toggle("is-danger", state.gasLeft < state.rules.gas * 0.3);
    setText(ui.fuelValue, `${Math.max(0, state.gasLeft).toFixed(1)} 秒`);
  }

  // 風
  ui.windWidget.hidden = environment.outdoor === 0;
  setText(ui.windSpeed, String(Math.round(state.windSpeed * environment.outdoor)));
  const pendingDir = state.event?.type === "gust" && state.event.stage === "warn" ? state.event.data.dir : null;
  setText(ui.windArrow, (pendingDir ?? state.windDir) > 0 ? "←" : "→");
  ui.windWidget.classList.toggle("is-warn", pendingDir !== null);
  ui.windWidget.classList.toggle("is-gust", isGustActive());

  // 風よけ
  const lightPhase = state.phase === "light";
  const guard = state.cupLock > 0 ? "burn" : state.roof > 0.6 ? "roof" : state.guard;
  ui.guardChip.dataset.guard = lightPhase ? guard : "idle";
  setText(ui.guardChip.lastElementChild, lightPhase ? GUARD_LABEL[guard] : "—");

  // マッチの残り
  ui.stockChip.hidden = !isMatchTool() || state.mode === "chill" || !["pickup", "grab", "ignite", "light"].includes(state.phase);
  setText(ui.stockChip.lastElementChild, `×${state.matchesLeft}`);

  // 吸いつけのゲージ
  setBar(ui.flameBar, state.stability);
  ui.flameBar.parentElement.classList.toggle("is-danger", state.stability < 0.3);
  setText(ui.flameValue, state.stability < 0.3 ? "危険" : state.protection > 0.7 ? "安定" : "揺れている");
  setBar(ui.matchBar, 1 - state.matchBurn);
  ui.matchBar.parentElement.classList.toggle("is-danger", state.matchBurn > 0.75);
  setText(ui.matchValue, state.matchBurn > 0.75 ? "指が熱い" : `${Math.ceil((1 - state.matchBurn) * 100)}%`);
  setBar(ui.burnBar, state.burn);
  setText(ui.burnValue, state.inRange ? `${Math.floor(state.burn * 100)}%` : "先端へ");
  setBar(ui.lungBar, state.lung);
  ui.lungBar.parentElement.classList.toggle("is-danger", state.lung > 0.75);
  setText(ui.lungValue, state.coughLock > 0 ? "むせ中" : state.lung > 0.75 ? "限界" : state.lung > 0.4 ? "吸ってる" : "余裕");

  if (state.phase === "chill") {
    const s = smoker.state;
    setText(ui.chillCount, `${s.count} 本`);
    setText(ui.chillTime, CHILL_LABEL[s.action] ?? `${Math.round((1 - s.consumed) * 100)}% 残り`);
    setBar(ui.ashBar, s.ash / ASH_LIMIT);
    ui.ashBar.parentElement.classList.toggle("is-danger", s.ash > ASH_LIMIT * 0.75);
  }

  // 点火画面のゲージ
  if (state.phase === "ignite") {
    const cs = getCloseup(state.tool).state;
    const fingers = fingerInput();
    ui.fingerKeys.forEach((element) => {
      element.classList.toggle("is-on", fingers[Number(element.dataset.finger)]);
    });
    setBar(ui.gripBar, cs.grip);
    ui.gripNeed.style.left = `${clamp(cs.required, 0, 1) * 100}%`;
    ui.gripBar.parentElement.classList.toggle("is-danger", cs.grip < cs.required);
    setText(ui.gripValue, `${Math.round(cs.grip * 100)}%`);
    ui.slipWarning.classList.toggle("is-visible", cs.slip > 0.2 && cs.dropT < 0);
    setBar(ui.pressBar, cs.effectivePressure);
    // 紙マッチは押しすぎると折れる：その境目を線で示し、超えたら赤くする
    const limit = cs.pressLimit ?? 1;
    ui.pressLimit.hidden = limit >= 1;
    ui.pressLimit.style.left = `${limit * 100}%`;
    const overLimit = cs.effectivePressure > limit;
    ui.pressBar.parentElement.classList.toggle("is-danger", overLimit);
    setText(ui.pressValue, cs.contact === "none" ? "—" : overLimit ? "強すぎ！" : `${Math.round(cs.effectivePressure * 100)}%`);
    setBar(ui.speedBar, cs.speedNorm);
    // ちょうどよい速さの帯（マッチ）
    ui.speedSweet.hidden = !cs.sweet;
    if (cs.sweet) {
      ui.speedSweet.style.left = `${cs.sweet[0] * 100}%`;
      ui.speedSweet.style.width = `${(cs.sweet[1] - cs.sweet[0]) * 100}%`;
      ui.speedBar.parentElement.classList.toggle("is-sweet", cs.speedNorm >= cs.sweet[0] && cs.speedNorm <= cs.sweet[1]);
      ui.speedBar.parentElement.classList.toggle("is-danger", cs.speedNorm > cs.sweet[1] * 1.15);
    }
    setText(ui.speedValue, cs.speedNorm > 0.05 ? `${Math.round(cs.speedNorm * 100)}%` : "—");
    setBar(ui.heatBar, Math.min(1, cs.heat));
    ui.heatBar.parentElement.classList.toggle("is-hot", cs.heat >= 1);
    setText(ui.heatValue, cs.lit ? "点火" : cs.heat >= 1 ? "MAX" : `${Math.round(Math.min(1, cs.heat) * 100)}%`);
    if (cs.extraLabel) {
      setBar(ui.extraBar, cs.extra);
      const danger = cs.extraLabel === "WEAR" && cs.extra > 0.85;
      ui.extraBar.parentElement.classList.toggle("is-danger", danger);
      setText(ui.extraValue, cs.extraLabel === "GAS" ? (cs.gas > 0.5 ? "シュー" : "—") : danger ? "折れる！" : `${Math.round(cs.extra * 100)}%`);
    }
    ui.igniteSteps.forEach((element, index) => {
      element.classList.toggle("is-done", cs.step > index);
      element.classList.toggle("is-active", cs.step === index && !cs.lit);
    });
  }
}

function renderSoundToggle() {
  const on = sfx.isEnabled();
  ui.soundToggle.setAttribute("aria-pressed", String(on));
  ui.soundToggle.lastElementChild.textContent = on ? "ON" : "OFF";
}

function renderBest() {
  if (state.mode === "unlimited") {
    const record = readJSON(STORAGE.unlimited, null);
    ui.best.textContent = record ? `${record.count} 本` : "--";
    return;
  }
  const best = state.mode === "chill" ? 0 : readBest(state.difficulty);
  ui.best.textContent = best ? formatTime(best) : "--.--";
}

function showBanner({ icon, kicker, title, copy, tone = "warn", key = null, pips = 0, tappable = false }) {
  ui.banner.hidden = false;
  ui.banner.classList.toggle("is-tappable", tappable);
  ui.banner.dataset.tone = tone;
  ui.bannerIcon.innerHTML = ICONS[icon] ?? "";
  ui.bannerKicker.textContent = kicker;
  ui.bannerTitle.textContent = title;
  ui.bannerCopy.textContent = copy;
  ui.bannerCopy.hidden = !copy;
  ui.bannerKey.hidden = !key;
  ui.bannerKey.textContent = key ?? "";
  ui.bannerPips.hidden = !pips;
  if (pips) renderPips(0, pips);
  setBannerTimer(1);
}

function renderPips(count, need) {
  ui.bannerPips.innerHTML = Array.from({ length: need }, (_, i) => `<i class="${i < count ? "on" : ""}"></i>`).join("");
}

function setBannerTimer(fraction) {
  ui.bannerTimer.style.transform = `scaleX(${clamp(fraction, 0, 1)})`;
}

function hideBanner() {
  ui.banner.hidden = true;
}

function showMessage(kicker, title, copy) {
  ui.messageKicker.textContent = kicker;
  ui.messageTitle.textContent = title;
  ui.messageCopy.textContent = copy;
  ui.message.classList.remove("hidden");
}

function hideMessage() {
  ui.message.classList.add("hidden");
}

function toast(text, tone = "info") {
  const element = document.createElement("div");
  element.className = `toast toast-${tone}`;
  element.textContent = text;
  ui.toastLayer.appendChild(element);
  while (ui.toastLayer.children.length > 3) ui.toastLayer.firstElementChild.remove();
  setTimeout(() => element.remove(), 1900);
}

// 一回擦るごとの手応え（点火画面の中央下に出す）
function popStroke(text, tone) {
  ui.strokePop.textContent = text;
  ui.strokePop.dataset.tone = tone;
  restartAnimation(ui.strokePop);
}

function flash(kind) {
  ui.flash.className = "scene-flash";
  void ui.flash.offsetWidth;
  ui.flash.className = `scene-flash flash-${kind}`;
}

function restartAnimation(element) {
  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "";
}

function projectToScene(worldPoint, out) {
  out.copy(worldPoint).project(camera);
  out.set(((out.x + 1) / 2) * ui.sceneWrap.clientWidth, ((1 - out.y) / 2) * ui.sceneWrap.clientHeight, 0);
  return out;
}

function setText(element, text) {
  if (textCache.get(element) === text) return;
  textCache.set(element, text);
  element.textContent = text;
}

function setBar(element, fraction) {
  element.style.transform = `scaleX(${clamp(fraction, 0, 1)})`;
}

/* ======================================================================
 * ユーティリティ
 * ==================================================================== */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function formatTime(seconds) {
  return seconds.toFixed(2).padStart(5, "0");
}

function readSetting(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できない環境ではこのセッション中だけ保持する
  }
}

function readJSON(key, fallback) {
  try {
    return JSON.parse(readSetting(key, "null")) ?? fallback;
  } catch {
    return fallback;
  }
}

function readBest(difficulty) {
  return Number(readSetting(STORAGE.best(difficulty), 0)) || 0;
}

function placeCigarette(group) {
  // モデルは -x 方向が先端（x = -0.32）、+x 方向がフィルター端（x = 0.835）
  const modelLength = 0.32 + 0.835;
  const direction = new THREE.Vector3().subVectors(CIG_TIP, CIG_FILTER_END);
  const length = direction.length();
  direction.normalize();
  const scale = length / modelLength;
  group.scale.set(scale, scale * 0.62, scale * 0.62);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), direction);
  group.position.copy(CIG_TIP).addScaledVector(direction, -0.32 * scale);
}

function resizeRenderer() {
  const width = ui.mount.clientWidth;
  const height = ui.mount.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  camera.aspect = width / height;
  // 横に狭い画面では、左右が見切れないように縦の画角を広げる
  const minimum = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(MIN_HORIZONTAL_FOV / 2)) / camera.aspect));
  camera.fov = clamp(minimum, CAMERA_FOV, 78);
  camera.updateProjectionMatrix();
  Object.values(closeups).forEach((closeup) => closeup?.resize(width, height));
}

/* ======================================================================
 * ループ
 * ==================================================================== */

// 重い環境では自動でブルームを切り、解像度を下げる
const quality = { frames: 0, total: 0, lowered: false };
function adaptQuality(rawDelta) {
  if (quality.lowered || rawDelta > 0.25) return;
  quality.frames += 1;
  quality.total += rawDelta;
  if (quality.frames < 90) return;
  const average = quality.total / quality.frames;
  quality.frames = 0;
  quality.total = 0;
  if (average > 1 / 32) {
    quality.lowered = true;
    bloom.enabled = false;
    renderer.setPixelRatio(1);
    resizeRenderer();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 0.05);
  const time = clock.elapsedTime;
  if (ui.gameLayout.hidden) return;
  adaptQuality(rawDelta);
  updateTransition(rawDelta);

  if (state.paused) {
    composer.render();
    return;
  }

  if (state.titleHold > 0) {
    state.titleHold += delta;
    if (state.titleHold >= TITLE_HOLD) {
      resetToTitle();
      return;
    }
  }

  updateWind(delta);
  updateLeftHandKeys(delta);
  updateThumbGrace(delta);
  // 経過時間はゲーム内時間で数える（FPS が落ちても動きの速さとずれない）
  if (isTiming()) state.elapsed += delta;
  updateRules(delta);
  if (state.nextRoundIn > 0) {
    state.nextRoundIn -= delta;
    if (state.nextRoundIn <= 0) nextRound();
  }

  if (state.view === "main") {
    updateCameraAndCigarette(delta, time);
    if (state.phase === "chill") {
      shieldHand.root.visible = false;
      updateChill(delta, time);
      updateFlame(delta, time);
    } else {
      shieldHand.root.visible = true;
      rightArm.group.visible = true;
      updateRightHand(delta, time);
      updateFlame(delta, time);
      updateShieldHand(delta, time);
      updateGuard(delta);
    }
  }

  if (state.phase === "ignite") updateIgnitePhase(delta, time);
  else if (state.phase === "light" && state.view === "main") updateLightPhase(delta);

  if (isPlaying()) updateEvents(delta);

  if (state.view === "main") {
    updateCigaretteVisual(delta, time);
    updateSmoke(delta);
  }
  updateRainVisual(delta);
  updateHud();
  composer.render();
}

resetRun();
setView("main");
animate();

if (import.meta.env?.DEV) {
  window.__windproof = {
    state,
    get closeup() {
      return getCloseup(state.tool);
    },
    getCloseup,
    startEvent,
    clearEvent,
    flameHot,
    tipWorld,
    palmWorld,
    lighter,
    lighterRig,
    matchRigs,
    shieldHand,
    camera,
    cleared,
    smoker,
    changePlace,
    scene,
    renderer,
    environment,
  };
}
