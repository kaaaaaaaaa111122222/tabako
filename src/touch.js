/*
 * スマホ・タブレットのタッチ操作。
 *   右半分をなぞる … 右手（親指・マッチ・炎）。main.js がそのまま受け取る
 *   左下           … 点火画面では「握る」、吸いつけでは左手のスティック
 *   ボタン         … 吸う / すぼめる / かざす / 灰を落とす / 一時停止
 * 指で触れる端末（pointer: coarse）か、?touch を付けた URL で有効になる。
 */

const STICK_RADIUS = 46;

export function createTouch({ root, onPause, onAsh }) {
  const forced = new URLSearchParams(location.search).has("touch");
  const active = forced || window.matchMedia?.("(pointer: coarse)").matches === true;
  const state = { active, grip: false, inhale: false, cup: false, roof: false, stickX: 0, stickY: 0, stickHeld: false, reset };
  document.documentElement.classList.toggle("is-touch", active);
  root.hidden = !active;
  if (!active) return state;

  const $ = (selector) => root.querySelector(selector);

  // 押している間だけ効くボタン
  const hold = (element, set) => {
    const release = () => {
      element.classList.remove("is-on");
      set(false);
    };
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);
      element.classList.add("is-on");
      set(true);
    });
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
  };
  hold($("[data-touch=grip]"), (on) => {
    state.grip = on;
  });
  hold($("[data-touch=inhale]"), (on) => {
    state.inhale = on;
  });

  // 押すたびに切り替わるボタン（左手の指が足りなくなるので、押しっぱなしにしない）
  const toggles = [];
  const toggle = (key, others = []) => {
    const element = $(`[data-touch=${key}]`);
    const render = () => element.classList.toggle("is-on", state[key]);
    toggles.push(render);
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      state[key] = !state[key];
      if (state[key]) others.forEach((other) => (state[other] = false));
      toggles.forEach((update) => update());
    });
  };
  toggle("cup", ["roof"]);
  toggle("roof", ["cup"]);

  $("[data-touch=ash]").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    onAsh();
  });
  $("[data-touch=pause]").addEventListener("click", onPause);

  // 左手のスティック：触れた所が中心になる
  const stick = $(".touch-stick");
  const knob = stick.querySelector("i");
  let stickId = null;
  let originX = 0;
  let originY = 0;
  const moveStick = (x, y) => {
    const length = Math.hypot(x, y);
    const scale = length > STICK_RADIUS ? STICK_RADIUS / length : 1;
    state.stickX = (x * scale) / STICK_RADIUS;
    state.stickY = (y * scale) / STICK_RADIUS;
    knob.style.transform = `translate(${x * scale}px, ${y * scale}px)`;
  };
  stick.addEventListener("pointerdown", (event) => {
    if (stickId !== null) return;
    event.preventDefault();
    stickId = event.pointerId;
    stick.setPointerCapture?.(stickId);
    originX = event.clientX;
    originY = event.clientY;
    stick.classList.add("is-on");
    state.stickHeld = true;
  });
  stick.addEventListener("pointermove", (event) => {
    if (event.pointerId === stickId) moveStick(event.clientX - originX, event.clientY - originY);
  });
  const endStick = (event) => {
    if (event && event.pointerId !== stickId) return;
    stickId = null;
    state.stickHeld = false;
    stick.classList.remove("is-on");
    moveStick(0, 0);
  };
  stick.addEventListener("pointerup", endStick);
  stick.addEventListener("pointercancel", endStick);
  stick.addEventListener("lostpointercapture", endStick);

  function reset() {
    Object.assign(state, { grip: false, inhale: false, cup: false, roof: false, stickX: 0, stickY: 0, stickHeld: false });
    if (!active) return;
    root.querySelectorAll(".is-on").forEach((element) => element.classList.remove("is-on"));
    stickId = null;
    knob.style.transform = "";
  }
  return state;
}

// 全画面にして横向きに固定する（対応していない端末では何もしない）
export async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    await screen.orientation?.lock?.("landscape");
  } catch {
    // iPhone の Safari などでは使えない。横向きの案内を出すだけにする
  }
}
