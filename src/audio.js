/*
 * 効果音。ローカルの ComfyUI（Stable Audio 3）で作った音を再生する（作り方は tools/assetgen/sfx.py）。
 * 最初の操作（unlock）で音声を有効にし、短い音はまとめて、環境音は使う場所のものだけ読み込む。
 */

const STORAGE_KEY = "windproof-sound";

const URLS = {
  pickup: new URL("./assets/audio/pickup.mp3", import.meta.url).href,
  strikeA: new URL("./assets/audio/strike_a.mp3", import.meta.url).href,
  strikeB: new URL("./assets/audio/strike_b.mp3", import.meta.url).href,
  ignite: new URL("./assets/audio/ignite.mp3", import.meta.url).href,
  drop: new URL("./assets/audio/drop.mp3", import.meta.url).href,
  scrape: new URL("./assets/audio/scrape.mp3", import.meta.url).href,
  matchIgnite: new URL("./assets/audio/match_ignite.mp3", import.meta.url).href,
  snap: new URL("./assets/audio/snap.mp3", import.meta.url).href,
  matchTake: new URL("./assets/audio/match_take.mp3", import.meta.url).href,
  extinguish: new URL("./assets/audio/extinguish.mp3", import.meta.url).href,
  inhale: new URL("./assets/audio/inhale.mp3", import.meta.url).href,
  exhale: new URL("./assets/audio/exhale.mp3", import.meta.url).href,
  ashTap: new URL("./assets/audio/ash_tap.mp3", import.meta.url).href,
  stub: new URL("./assets/audio/stub.mp3", import.meta.url).href,
  cough: new URL("./assets/audio/cough.mp3", import.meta.url).href,
  gust: new URL("./assets/audio/gust.mp3", import.meta.url).href,
  sneeze: new URL("./assets/audio/sneeze.mp3", import.meta.url).href,
  swat: new URL("./assets/audio/swat.mp3", import.meta.url).href,
  shoo: new URL("./assets/audio/shoo.mp3", import.meta.url).href,
  buzz: new URL("./assets/audio/buzz.mp3", import.meta.url).href,
  ring: new URL("./assets/audio/ring.mp3", import.meta.url).href,
  swipe: new URL("./assets/audio/swipe.mp3", import.meta.url).href,
  mumbleA: new URL("./assets/audio/mumble_a.mp3", import.meta.url).href,
  mumbleB: new URL("./assets/audio/mumble_b.mp3", import.meta.url).href,
  voiceSmoke: new URL("./assets/audio/tabako_kure.mp3", import.meta.url).href,
  voiceLighter: new URL("./assets/audio/raita-kure.mp3", import.meta.url).href,
  alert: new URL("./assets/audio/alert.mp3", import.meta.url).href,
  clear: new URL("./assets/audio/clear.mp3", import.meta.url).href,
  tick: new URL("./assets/audio/tick.mp3", import.meta.url).href,
  dud: new URL("./assets/audio/dud.mp3", import.meta.url).href,
  success: new URL("./assets/audio/success.mp3", import.meta.url).href,
  fail: new URL("./assets/audio/fail.mp3", import.meta.url).href,
  crackle: new URL("./assets/audio/crackle.mp3", import.meta.url).href,
  moth: new URL("./assets/audio/moth.mp3", import.meta.url).href,
  rain: new URL("./assets/audio/rain.mp3", import.meta.url).href,
  wind: new URL("./assets/audio/wind.mp3", import.meta.url).href,
  amb_balcony: new URL("./assets/audio/amb_balcony.mp3", import.meta.url).href,
  amb_konbini: new URL("./assets/audio/amb_konbini.mp3", import.meta.url).href,
  amb_rooftop: new URL("./assets/audio/amb_rooftop.mp3", import.meta.url).href,
  amb_kissaten: new URL("./assets/audio/amb_kissaten.mp3", import.meta.url).href,
  amb_camp: new URL("./assets/audio/amb_camp.mp3", import.meta.url).href,
  amb_harbor: new URL("./assets/audio/amb_harbor.mp3", import.meta.url).href,
  amb_engawa: new URL("./assets/audio/amb_engawa.mp3", import.meta.url).href,
};

// くり返す音：つなぎ目のない長さ（秒）。前後に 0.1 秒ずつ続きが入っている（sfx.py の make_loop）
const LOOP_START = 0.08;
const LOOP_LENGTH = { crackle: 3, moth: 2, rain: 9, wind: 9 };
const AMBIENCE_LENGTH = 11;
const AMBIENCE_LEVEL = 0.5;
const isLoop = (name) => name in LOOP_LENGTH || name.startsWith("amb_");

function readPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = readPreference();
  let ambience = null;
  let preloaded = false;
  const buffers = new Map(); // 名前 → AudioBuffer
  const loading = new Map(); // 名前 → Promise
  const loops = new Map(); // 名前 → { source, gain, level }

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function load(name) {
    if (!loading.has(name)) {
      loading.set(
        name,
        fetch(URLS[name])
          .then((response) => response.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => {
            buffers.set(name, buffer);
            return buffer;
          })
          .catch(() => {
            loading.delete(name); // 次に鳴らすときにもう一度読む
            return null;
          }),
      );
    }
    return loading.get(name);
  }

  // 一発の音。rate = 高さ・速さ、jitter = 毎回少し変える幅
  function play(name, { gain = 1, rate = 1, jitter = 0.04, delay = 0, from = 0 } = {}) {
    const c = ensure();
    if (!c) return;
    const buffer = buffers.get(name);
    if (!buffer) {
      load(name);
      return;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
    const amp = c.createGain();
    amp.gain.value = gain;
    source.connect(amp);
    amp.connect(master);
    source.start(c.currentTime + delay, from);
  }

  // くり返す音の音量（0 で止める）
  function setLoop(name, level) {
    const current = loops.get(name);
    if (level <= 0) {
      if (!current) return;
      current.level = 0;
      if (current.gain && ctx) {
        current.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
        current.source.stop(ctx.currentTime + 1.5);
      }
      loops.delete(name);
      return;
    }
    const c = ensure();
    if (!c) return;
    if (current) {
      if (Math.abs(current.level - level) < 0.01) return;
      current.level = level;
      current.gain?.gain.setTargetAtTime(level, c.currentTime, 0.2);
      return;
    }
    const entry = { level, source: null, gain: null };
    loops.set(name, entry);
    load(name).then((buffer) => {
      // 読み込んでいる間に止められていたら鳴らさない
      if (!buffer || loops.get(name) !== entry) return;
      entry.source = c.createBufferSource();
      entry.source.buffer = buffer;
      entry.source.loop = true;
      entry.source.loopStart = LOOP_START;
      entry.source.loopEnd = LOOP_START + (LOOP_LENGTH[name] ?? AMBIENCE_LENGTH);
      entry.gain = c.createGain();
      entry.gain.gain.value = 0;
      entry.gain.gain.setTargetAtTime(entry.level, c.currentTime, 0.3);
      entry.source.connect(entry.gain);
      entry.gain.connect(master);
      entry.source.start(c.currentTime, LOOP_START);
    });
  }

  function stopLoops() {
    [...loops.keys()].forEach((name) => setLoop(name, 0));
  }

  return {
    unlock() {
      if (!ensure() || preloaded) return;
      preloaded = true;
      Object.keys(URLS)
        .filter((name) => !isLoop(name))
        .forEach(load);
    },
    isEnabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
      try {
        localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
      } catch {
        // 保存できなくても音の切り替え自体は効く
      }
      if (!value) {
        stopLoops();
        ctx?.suspend();
      } else {
        ensure();
        if (ambience) setLoop(`amb_${ambience}`, AMBIENCE_LEVEL);
      }
    },

    /* ---- 続く音 ---- */
    // 場所の環境音（null で止める）
    setAmbience(place) {
      if (ambience === place) return;
      if (ambience) setLoop(`amb_${ambience}`, 0);
      ambience = place;
      if (place && enabled) setLoop(`amb_${place}`, AMBIENCE_LEVEL);
    },
    setRain(level) {
      setLoop("rain", level * 0.8);
    },
    setWind(level) {
      setLoop("wind", level);
    },
    // 吸っている間の、葉が燃える音
    setPuff(level) {
      setLoop("crackle", level * 0.5);
    },
    setMoth(level) {
      setLoop("moth", level * 0.6);
    },
    stopAll() {
      ambience = null;
      stopLoops();
    },

    /* ---- 一発の音 ---- */
    pickup: () => play("pickup", { gain: 0.8 }),
    strike(quality) {
      const gain = { weak: 0.4, good: 0.6, perfect: 0.8 }[quality] ?? 0.5;
      play(Math.random() < 0.5 ? "strikeA" : "strikeB", { gain, jitter: 0.12 });
    },
    dud: () => play("dud", { gain: 0.5 }),
    // マッチをヤスリで擦る音
    scrape: (amount = 0.5) => play("scrape", { gain: Math.min(0.8, 0.2 + amount * 1.2), rate: 0.9 + Math.min(0.4, amount * 0.5), jitter: 0.1 }),
    ignite: () => play("ignite", { gain: 0.9 }),
    matchIgnite: () => play("matchIgnite", { gain: 0.9 }),
    matchTake: () => play("matchTake", { gain: 0.7 }),
    snap: () => play("snap", { gain: 0.9 }),
    drop: () => play("drop", { gain: 0.8 }),
    fizz: () => play("extinguish", { gain: 0.7 }),
    inhale: () => play("inhale", { gain: 0.5 }),
    exhale: (amount = 0.5) => play("exhale", { gain: 0.35 + amount * 0.5, rate: 1.1 - amount * 0.15 }),
    ashTap: () => play("ashTap", { gain: 0.7 }),
    stub: () => play("stub", { gain: 0.8 }),
    alert: () => play("alert", { gain: 0.5, jitter: 0 }),
    gust: () => play("gust", { gain: 0.9 }),
    buzz: () => play("buzz", { gain: 0.6, jitter: 0 }),
    ring: () => play("ring", { gain: 0.5, jitter: 0 }),
    swipe: () => play("swipe", { gain: 0.6 }),
    swat: () => play("swat", { gain: 0.8 }),
    shoo: () => play("shoo", { gain: 0.6, jitter: 0.1 }),
    tick: () => play("tick", { gain: 0.6, jitter: 0.06 }),
    sneeze: () => play("sneeze", { gain: 0.9 }),
    cough: () => play("cough", { gain: 0.8 }),
    // お邪魔のおじさんの生声（録音の頭の無音は飛ばす）
    voiceSmoke: () => play("voiceSmoke", { gain: 1, jitter: 0, from: 0.1 }),
    voiceLighter: () => play("voiceLighter", { gain: 1, jitter: 0, from: 0.4 }),
    // 電話の相手の声
    mumble: (pitch = 1) => play(pitch < 1 ? "mumbleA" : "mumbleB", { gain: 0.7, jitter: 0.06 }),
    clear: () => play("clear", { gain: 0.55, jitter: 0 }),
    success: () => play("success", { gain: 0.7, jitter: 0 }),
    fail: () => play("fail", { gain: 0.6, jitter: 0 }),
  };
}
