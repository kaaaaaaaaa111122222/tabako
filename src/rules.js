/*
 * 難易度のルール。数字を変えるだけで調整できるように、1 か所に集めてある。
 *
 *   breath     息の長さ（1 = 約 2.2 秒でむせる。小さいほど短い）
 *   timeLimit  制限時間（秒）。マッチの難易度だけにある。null = なし
 *   heatRate   点火の熱の溜まり方（小さいほど火がつくまで長い）
 *   wind       風の強さ
 *   windFlip   風向きが勝手に変わる間隔（秒）。null = 変わらない
 *   stock      マッチの本数
 *   gas        ライターのガスの残り（秒）。null = 無限
 *   events     お邪魔の間隔（秒）[短, 長]
 *   firstEvent 最初のお邪魔までの秒数
 *   stress     ストレスの溜まりやすさ
 *   blind      ゲージを隠す（ストレスだけ見える）
 *   stressOut  ストレスが MAX になったら終わり
 */

const BASE = {
  breath: 1,
  timeLimit: null,
  heatRate: 1,
  wind: 1,
  windFlip: null,
  stock: null,
  gas: null,
  events: [4, 7],
  firstEvent: 6,
  stress: 1,
  blind: false,
  stressOut: false,
};

const rules = (changes) => ({ ...BASE, ...changes });

export const FAIL_LINE = 60; // 制限時間のない難易度で、これを超えたらランク F

export const DIFFICULTIES = {
  easy: {
    label: "かんたん",
    tool: "lighter",
    place: "balcony",
    notifications: 1,
    ranks: [15, 25, 35, 45, 60],
    rules: rules({}),
    note: "ホイールを擦り下ろして、そのままレバーを押す。",
    limits: ["制限なし"],
  },
  normal: {
    label: "ふつう",
    tool: "boxMatch",
    place: "konbini",
    notifications: 2,
    ranks: [22, 32, 42, 52, 60],
    rules: rules({ breath: 0.74, timeLimit: 60, stock: 10 }),
    note: "光る所を、ちょうどよい速さで擦る。10 本。",
    limits: ["制限 60 秒", "息が短い"],
  },
  hard: {
    label: "むずかしい",
    tool: "paperMatch",
    place: "rooftop",
    notifications: 3,
    ranks: [32, 44, 56, 66, 75],
    rules: rules({ breath: 0.6, timeLimit: 75, stock: 6, heatRate: 0.6 }),
    note: "左手に紙マッチ、右手に 1 本。両手で擦る。6 本。",
    limits: ["制限 75 秒", "息が短い", "火がつきにくい"],
  },
  oni: {
    label: "鬼",
    tool: "lighter",
    place: "harbor",
    notifications: 3,
    ranks: [18, 28, 38, 48, 60],
    rules: rules({ breath: 0.54, wind: 1.4, gas: 12, heatRate: 0.75, events: [3, 5], firstEvent: 4, stress: 1.35 }),
    note: "ガスが残りわずかのライター。海風が強い。",
    limits: ["ガス 12 秒", "強風", "息が短い"],
  },
  hell: {
    label: "地獄",
    tool: "boxMatch",
    place: "engawa",
    notifications: 3,
    ranks: [26, 34, 42, 50, 58],
    rules: rules({ breath: 0.5, timeLimit: 58, wind: 1.3, windFlip: 6, stock: 5, heatRate: 0.85, events: [2.6, 4.6], firstEvent: 3, stress: 1.6 }),
    note: "吹雪。風向きが勝手に変わる。5 本。",
    limits: ["制限 58 秒", "風向きが変わる", "5 本"],
  },
  extreme: {
    label: "極",
    tool: "paperMatch",
    place: "camp",
    notifications: 4,
    ranks: [40, 50, 60, 70, 80],
    rules: rules({ breath: 0.45, timeLimit: 80, wind: 1.25, stock: 4, heatRate: 0.55, events: [2.2, 4], firstEvent: 3, stress: 1.9, blind: true }),
    note: "ゲージが見えない。手の感覚だけで擦る。4 本。",
    limits: ["制限 80 秒", "ゲージなし", "4 本"],
  },
};

// まったり喫煙を解放するのに必要な難易度
export const CHILL_KEYS = ["easy", "normal", "hard"];

/* ------------------------------------------------------------------ */
/* チャレンジ（UNLIMITED）：火をつけ続ける。1 本ごとに厳しくなる       */
/* ------------------------------------------------------------------ */

const ROUND_TOOLS = ["lighter", "boxMatch", "paperMatch"];
const ROUND_PLACES = ["balcony", "konbini", "rooftop", "harbor", "engawa", "camp", "kissaten"];
const ROUND_STOCK = { boxMatch: 8, paperMatch: 6 };

export function unlimitedRound(n) {
  const tool = ROUND_TOOLS[n % ROUND_TOOLS.length];
  const base = { boxMatch: 60, paperMatch: 75 }[tool]; // 時間制限はマッチだけ
  return {
    label: `${n + 1} 本目`,
    tool,
    place: ROUND_PLACES[n % ROUND_PLACES.length],
    notifications: Math.min(4, 1 + Math.floor(n / 2)),
    rules: rules({
      breath: Math.max(0.36, 1 - n * 0.06),
      timeLimit: base ? Math.max(base * 0.45, base - n * 2.5) : null,
      wind: 1 + n * 0.05,
      windFlip: n >= 6 ? Math.max(4, 9 - n * 0.4) : null,
      stock: ROUND_STOCK[tool] ? Math.max(2, ROUND_STOCK[tool] - Math.floor(n / 3)) : null,
      gas: tool === "lighter" && n >= 3 ? Math.max(6, 16 - n) : null,
      heatRate: Math.max(0.5, (tool === "paperMatch" ? 0.75 : 1) - n * 0.02),
      events: [Math.max(1.8, 4 - n * 0.22), Math.max(3, 7 - n * 0.35)],
      firstEvent: Math.max(2, 6 - n * 0.4),
      stress: 1 + n * 0.07,
      stressOut: true,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* ストレス：MAX に近いほど手が震える                                  */
/* ------------------------------------------------------------------ */

export const STRESS = {
  // 増える
  time: 0.005, // 毎秒
  badStroke: 0.02, // うまく擦れなかった
  broken: 0.11, // マッチが折れた
  dropped: 0.1, // 落とした
  flameOut: 0.12, // 火が消えた
  cough: 0.05,
  burn: 0.05,
  sneeze: 0.07,
  eventFailed: 0.08,
  // 減る
  lit: 0.16, // 火がついた
  inhale: 0.13, // 吸っている間（毎秒）
  eventCleared: 0.03,
  nextRound: 0.22, // チャレンジで 1 本吸いつけた
};

// ストレス → 手の震え（0 = 落ち着いている）
export function tremorOf(stress) {
  return 0.28 + stress * 0.5 + stress ** 3 * 1.45;
}
