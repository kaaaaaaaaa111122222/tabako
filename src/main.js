import * as THREE from "three";

const mount = document.querySelector("#scene");
const startScreen = document.querySelector("#start-screen");
const gameLayout = document.querySelector("#game-layout");
const cigaretteTransitionScreen = document.querySelector("#cigarette-transition-screen");
const cigaretteScreen = document.querySelector("#cigarette-screen");
const cigaretteStageContent = document.querySelector("#cigarette-stage-content");
const cigaretteTimerElement = document.querySelector("#cigarette-timer");
const gameColumn = gameLayout.querySelector(".game-column");
const gameSceneWrap = mount.parentElement;
const underScene = gameLayout.querySelector(".under-scene");
const restartHint = gameLayout.querySelector(".restart-hint");
const timerElement = document.querySelector("#timer");
const bestElement = document.querySelector("#best-time");
const phaseElement = document.querySelector("#phase-label");
const messageElement = document.querySelector("#message");
const messageKicker = messageElement.querySelector(".message-kicker");
const messageTitle = messageElement.querySelector("strong");
const messageCopy = messageElement.querySelector("span:last-child");
const flameMeter = document.querySelector("#flame-meter");
const flameState = document.querySelector("#flame-state");
const statusElement = document.querySelector("#run-status");
const statusWrap = statusElement.parentElement;
const windSpeedElement = document.querySelector("#wind-speed");
const startButton = document.querySelector("#start-button");
const continueCigaretteButton = document.querySelector("#continue-cigarette-button");
const replayButton = document.querySelector("#replay-button");
const steps = [
  document.querySelector("#step-1"),
  document.querySelector("#step-2"),
  document.querySelector("#step-3"),
];

const scene = new THREE.Scene();
scene.background = new THREE.Color("#344949");
scene.fog = new THREE.Fog("#344949", 10, 23);
const lightingDurationMs = 900;

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 50);
camera.position.set(0, 1.4, 8.2);
camera.lookAt(0, 1, 0);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
mount.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight("#e2f0d7", "#283a3b", 2.1));
const keyLight = new THREE.DirectionalLight("#f4d8a1", 3.2);
keyLight.position.set(-4, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const fillLight = new THREE.PointLight("#b5d68e", 1.2, 8);
fillLight.position.set(2, 4, 1);
scene.add(fillLight);

const material = (color, roughness = 0.75, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const table = new THREE.Mesh(
  new THREE.BoxGeometry(15, 0.35, 8),
  material("#745a47", 0.92),
);
table.position.set(0, -0.25, 0);
table.receiveShadow = true;
scene.add(table);

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 12),
  material("#304445", 0.96),
);
wall.position.set(0, 3, -3.2);
wall.receiveShadow = true;
scene.add(wall);

const wallLines = new THREE.Group();
const lineMaterial = new THREE.MeshBasicMaterial({ color: "#49605a", transparent: true, opacity: 0.33 });
for (let i = 0; i < 9; i += 1) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(18, 0.012, 0.01), lineMaterial);
  line.position.set(0, 0.1 + i * 0.68, -3.13);
  wallLines.add(line);
}
scene.add(wallLines);

const cigarette = new THREE.Group();
const cigaretteBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.055, 0.055, 1.2, 16),
  material("#e6dfc9", 0.68),
);
cigaretteBody.rotation.z = Math.PI / 2;
cigaretteBody.position.x = 0.28;
cigaretteBody.castShadow = true;
cigarette.add(cigaretteBody);

const cigaretteFilter = new THREE.Mesh(
  new THREE.CylinderGeometry(0.057, 0.057, 0.31, 16),
  material("#bc7654", 0.8),
);
cigaretteFilter.rotation.z = Math.PI / 2;
cigaretteFilter.position.x = 0.68;
cigaretteFilter.castShadow = true;
cigarette.add(cigaretteFilter);
cigarette.position.set(0.09, -0.3, -1.2);
cigarette.scale.setScalar(0.32);
cigarette.rotation.z = -0.15;
cigarette.rotation.y = -1.25;
const cigaretteRestPosition = cigarette.position.clone();
const cigaretteRestRotation = cigarette.rotation.clone();
camera.add(cigarette);

const cigTip = new THREE.Mesh(
  new THREE.CircleGeometry(0.055, 16),
  material("#6f5140", 0.9),
);
cigTip.position.set(-0.32, 0, 0);
cigTip.rotation.y = -Math.PI / 2;
cigarette.add(cigTip);
const cigaretteEmber = new THREE.Mesh(
  new THREE.CylinderGeometry(0.052, 0.052, 0.07, 16),
  new THREE.MeshStandardMaterial({
    color: "#e83b20",
    emissive: "#c51f0b",
    emissiveIntensity: 1.5,
    roughness: 0.8,
  }),
);
cigaretteEmber.rotation.z = Math.PI / 2;
cigaretteEmber.position.x = -0.29;
cigaretteEmber.visible = false;
cigarette.add(cigaretteEmber);
const cigaretteEmberLight = new THREE.PointLight("#ff3217", 0, 0.8);
scene.add(cigaretteEmberLight);
camera.updateMatrixWorld(true);

const lighter = new THREE.Group();
const lighterBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.35, 0.72, 0.19),
  material("#d4a84e", 0.34, 0.55),
);
lighterBody.castShadow = true;
lighter.add(lighterBody);
const lighterSide = new THREE.Mesh(
  new THREE.BoxGeometry(0.37, 0.12, 0.2),
  material("#8e6335", 0.36, 0.45),
);
lighterSide.position.y = 0.17;
lighter.add(lighterSide);
const lighterTop = new THREE.Mesh(
  new THREE.BoxGeometry(0.35, 0.11, 0.19),
  material("#bfc5b2", 0.26, 0.72),
);
lighterTop.position.y = 0.42;
lighter.add(lighterTop);
const wheel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.075, 0.075, 0.08, 16),
  material("#6c7470", 0.32, 0.7),
);
wheel.rotation.x = Math.PI / 2;
wheel.position.set(0.03, 0.5, 0.04);
lighter.add(wheel);
const lighterSwitch = new THREE.Mesh(
  new THREE.CylinderGeometry(0.045, 0.055, 0.07, 16),
  material("#bf7253", 0.38, 0.25),
);
lighterSwitch.position.set(0.13, 0.51, 0.045);
lighter.add(lighterSwitch);
const lighterSwitchRestY = lighterSwitch.position.y;
const ignitionHitbox = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1.2, 0.55),
  new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
);
lighter.add(ignitionHitbox);
const lighterDeskPosition = new THREE.Vector3(-0.9, 0.29, 3.2);
lighter.position.copy(lighterDeskPosition);
scene.add(lighter);

const flameMaterial = new THREE.MeshBasicMaterial({
  color: "#ffbd62",
  transparent: true,
  opacity: 0.95,
});
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.47, 16), flameMaterial);
flame.position.y = 0.69;
flame.visible = false;
lighter.add(flame);

const flameCore = new THREE.Mesh(
  new THREE.ConeGeometry(0.055, 0.25, 12),
  new THREE.MeshBasicMaterial({ color: "#fff2b0" }),
);
flameCore.position.set(0, 0.65, 0.015);
flameCore.visible = false;
lighter.add(flameCore);

const flameGlow = new THREE.PointLight("#ffb651", 0, 3);
flameGlow.position.set(0, 0.75, 0.1);
lighter.add(flameGlow);

const handMaterial = material("#c98969", 0.82);
const sleeveMaterial = material("#364952", 0.94);
const hand = makeHand();
const shieldHand = makeHand();
hand.scale.setScalar(0.58);
shieldHand.scale.setScalar(0.52);
hand.position.set(-0.85, 0.3, 6.3);
shieldHand.position.set(0.15, 1.05, 6.65);
setHandPose(shieldHand, "fan");
scene.add(shieldHand);

const windGroup = new THREE.Group();
const windMaterial = new THREE.MeshBasicMaterial({
  color: "#d0dfc7",
  transparent: true,
  opacity: 0.4,
});
const windLines = [];
for (let i = 0; i < 17; i += 1) {
  const length = 0.2 + Math.random() * 0.8;
  const strand = new THREE.Mesh(new THREE.BoxGeometry(length, 0.012, 0.012), windMaterial);
  strand.position.set(5 - Math.random() * 10, 0.65 + Math.random() * 3.5, -0.5 + Math.random() * 0.4);
  strand.userData.speed = 1.2 + Math.random() * 2.2;
  windLines.push(strand);
  windGroup.add(strand);
}
scene.add(windGroup);

const smokeGroup = new THREE.Group();
const smokePuffs = [];
const smokeMaterial = new THREE.MeshBasicMaterial({
  color: "#9da5a2",
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
for (let i = 0; i < 9; i += 1) {
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.065 + Math.random() * 0.08, 12, 10), smokeMaterial.clone());
  puff.visible = false;
  smokeGroup.add(puff);
  smokePuffs.push(puff);
}
scene.add(smokeGroup);

const state = {
  phase: "ready",
  runStartedAt: 0,
  elapsed: 0,
  caughtAt: 0,
  litAt: 0,
  transitionShown: false,
  lastFrameAt: 0,
  activeHand: "lighter",
  lighterTarget: new THREE.Vector3(-0.48, 1, 6.65),
  shieldTarget: new THREE.Vector3(0.15, 1.05, 6.65),
  stability: 1,
  inhaleProgress: 0,
  windPhase: 0,
  windSpeed: 12,
  windStrength: 0.6,
  cigaretteLit: false,
  cigaretteSmoldering: false,
  inhaling: false,
};

const pressedKeys = new Set();
const clock = new THREE.Clock();
const cigaretteTipWorld = new THREE.Vector3();
const lighterTremor = new THREE.Vector3();
const pointerNdc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const lighterSwitchWorldPosition = new THREE.Vector3();
const switchHandTarget = new THREE.Vector3();
const switchHandOffset = new THREE.Vector3(-0.13, -0.04, -0.03);
let bestTime = Number(localStorage.getItem("windproof-best") || 0);
bestElement.textContent = bestTime ? bestTime.toFixed(2) : "--.--";
resizeRenderer();
window.addEventListener("resize", resizeRenderer);
mount.addEventListener("pointermove", onPointerMove);
mount.addEventListener("pointerdown", onPointerDown);
mount.addEventListener("wheel", onWheel, { passive: false });
startButton.addEventListener("click", startGame);
continueCigaretteButton.addEventListener("click", startCigaretteStage);
replayButton.addEventListener("click", startGame);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

function getSwitchHandTarget() {
  lighter.updateMatrixWorld(true);
  lighterSwitch.getWorldPosition(lighterSwitchWorldPosition);
  return switchHandTarget.copy(lighterSwitchWorldPosition).add(switchHandOffset);
}

function aimHandAtLighterSwitch() {
  state.shieldTarget.copy(getSwitchHandTarget());
  setHandPose(shieldHand, "press");
}

function onPointerDown(event) {
  if (state.phase !== "caught" || event.button !== 0) return;
  const rect = mount.getBoundingClientRect();
  pointerNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointerNdc, camera);
  lighter.updateMatrixWorld(true);
  if (raycaster.intersectObject(ignitionHitbox, false).length === 0) return;

  aimHandAtLighterSwitch();
  event.preventDefault();
  setPhaseLabel("PRESS SWITCH");
  showMessage("LIGHTER IGNITION", "右手をスイッチに合わせた。", "手がスイッチに届いたらBキーで押して着火。");
}

function makeHand() {
  const group = new THREE.Group();
  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.68, 4, 8), sleeveMaterial);
  sleeve.rotation.z = 0.12;
  sleeve.position.set(0, -0.48, -0.015);
  sleeve.castShadow = true;
  group.add(sleeve);

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 24), handMaterial);
  palm.scale.set(1, 0.74, 0.54);
  palm.position.set(0.04, 0.03, 0);
  palm.castShadow = true;
  group.add(palm);
  group.userData.palm = palm;

  const fingers = [];
  const fingerLengths = [
    [0.085, 0.06, 0.04],
    [0.095, 0.07, 0.048],
    [0.09, 0.065, 0.044],
    [0.078, 0.055, 0.038],
  ];
  for (let i = 0; i < 4; i += 1) {
    const finger = makeFinger([0.041, 0.038, 0.034], fingerLengths[i]);
    finger.position.set(-0.18 + i * 0.13, 0.19, 0.045);
    finger.rotation.z = -0.1 + i * 0.085;
    group.add(finger);
    fingers.push(finger);
  }

  const thumb = makeFinger([0.05, 0.043, 0.036], [0.11, 0.075, 0.045]);
  thumb.rotation.z = -1.05;
  thumb.position.set(0.25, 0.08, 0.06);
  group.add(thumb);
  group.userData.sleeve = sleeve;
  group.userData.fingers = fingers;
  group.userData.thumb = thumb;
  return group;
}

function makeFinger(radii, lengths) {
  const finger = new THREE.Group();
  const jointGeometry = new THREE.SphereGeometry(1, 16, 12);
  const joints = [];
  let segmentParent = finger;
  for (let i = 0; i < 3; i += 1) {
    const radius = radii[i];
    const length = lengths[i];
    const segment = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, length, 8, 16),
      handMaterial,
    );
    segment.position.y = length * 0.5 + radius * 0.55;
    segment.castShadow = true;
    segmentParent.add(segment);

    if (i < 2) {
      const joint = new THREE.Group();
      joint.position.y = length + radius * 1.4;
      const knuckle = new THREE.Mesh(jointGeometry, handMaterial);
      knuckle.scale.setScalar(radius * 0.76);
      joint.add(knuckle);
      segmentParent.add(joint);
      joints.push(joint);
      segmentParent = joint;
    }
  }
  finger.userData.joints = joints;
  return finger;
}

function setHandPose(group, pose) {
  const fingers = group.userData.fingers;
  const thumb = group.userData.thumb;
  const sleeve = group.userData.sleeve;
  const palm = group.userData.palm;
  palm.position.z = 0;
  fingers.forEach((finger, index) => {
    finger.position.set(-0.18 + index * 0.13, 0.19 + Math.abs(1.5 - index) * -0.015, 0.045);
    finger.rotation.set(0, 0, -0.1 + index * 0.085);
    finger.userData.joints.forEach((joint) => {
      joint.rotation.x = 0;
      joint.rotation.z = 0;
    });
  });
  thumb.position.set(0.25, 0.08, 0.06);
  thumb.rotation.set(0, 0, -1.05);
  thumb.scale.set(1, 1, 1);
  thumb.userData.joints.forEach((joint) => {
    joint.rotation.x = 0;
    joint.rotation.z = 0;
  });
  sleeve.rotation.z = 0.12;
  sleeve.position.set(0, -0.48, -0.015);
  group.userData.poseRotationZ = 0;
  group.rotation.z = 0;

  if (pose === "grip") {
    const fingerRoots = [
      [-0.23, 0.18],
      [-0.21, 0.075],
      [-0.19, -0.03],
      [-0.17, -0.135],
    ];
    fingers.forEach((finger, index) => {
      const [rootX, rootY] = fingerRoots[index];
      finger.position.set(rootX, rootY, index === 0 ? 0.08 : -0.07);
      finger.rotation.set(index === 0 ? 0.45 : 1, 0, index === 0 ? -1.5 : -1.52 + index * 0.025);
      finger.userData.joints[0].rotation.x = index === 0 ? 0.2 : 0.4;
      finger.userData.joints[1].rotation.x = -0.2;
      finger.userData.joints[0].rotation.z = index === 0 ? -0.25 : -0.15 - index * 0.015;
      finger.userData.joints[1].rotation.z = index === 0 ? -0.35 : -0.1 - index * 0.015;
    });
    palm.position.z = -0.14;
    thumb.position.set(-0.07, 0.02, 0.08);
    thumb.rotation.z = -0.35;
    thumb.userData.joints[0].rotation.z = -0.9;
    thumb.userData.joints[1].rotation.z = -0.4;
    thumb.scale.set(1, 0.72, 1);
  } else if (pose === "fan") {
    fingers.forEach((finger, index) => {
      finger.position.set(-0.12 + index * 0.08, 0.13, 0.055);
      finger.rotation.z = -0.05 + index * 0.035;
      finger.userData.joints[0].rotation.z = -0.02;
      finger.userData.joints[1].rotation.z = -0.02;
    });
    thumb.position.set(0.2, 0.04, 0.06);
    thumb.rotation.z = -0.65;
    thumb.userData.joints[0].rotation.z = 0.65;
    thumb.userData.joints[1].rotation.z = 0.04;
    thumb.scale.set(1, 0.62, 1);
    thumb.userData.joints[0].rotation.z = -0.08;
    thumb.userData.joints[1].rotation.z = -0.04;
    sleeve.rotation.z = 0.12;
    sleeve.position.set(0, -0.48, -0.015);
    group.userData.poseRotationZ = Math.PI / 2;
    group.rotation.z = group.userData.poseRotationZ;
  } else if (pose === "press") {
    fingers.forEach((finger, index) => {
      finger.position.set(-0.15 + index * 0.095, 0.13, 0.075);
      finger.rotation.set(0.35, 0, -0.35 + index * 0.03);
      finger.userData.joints[0].rotation.x = 0.3;
      finger.userData.joints[1].rotation.x = 0.2;
    });
    thumb.position.set(0.25, 0.12, 0.09);
    thumb.rotation.set(Math.PI / 2, 0, -0.45);
    thumb.userData.joints[0].rotation.x = -0.35;
    thumb.userData.joints[1].rotation.x = -0.25;
    sleeve.rotation.z = -0.08;
    sleeve.position.set(0, -0.48, -0.015);
  }
}

function resizeRenderer() {
  const width = mount.clientWidth;
  const height = mount.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function showCigaretteScreen() {
  cigaretteStageContent.append(gameSceneWrap, underScene);
  gameLayout.hidden = true;
  cigaretteTransitionScreen.hidden = true;
  cigaretteScreen.hidden = false;
  resizeRenderer();
}

function showCigaretteTransition() {
  gameLayout.hidden = true;
  cigaretteScreen.hidden = true;
  cigaretteTransitionScreen.hidden = false;
}

function showLighterScreen() {
  if (gameSceneWrap.parentElement === cigaretteStageContent) {
    gameColumn.insertBefore(underScene, restartHint);
    gameColumn.insertBefore(gameSceneWrap, underScene);
  }
  cigaretteTransitionScreen.hidden = true;
  cigaretteScreen.hidden = true;
  gameLayout.hidden = false;
  resizeRenderer();
}

function startCigaretteStage() {
  if (state.phase !== "handoff") return;
  state.phase = "shield";
  state.runStartedAt = performance.now() - state.elapsed * 1000;
  statusElement.textContent = "炎を煙草の先端へ近づけよう";
  setPhaseLabel("PROTECT THE FLAME");
  showCigaretteScreen();
}

function onWheel(event) {
  if (state.phase !== "caught" && state.phase !== "shield") return;
  event.preventDefault();
  const depthChange = event.deltaY * 0.003;
  state.lighterTarget.z = THREE.MathUtils.clamp(state.lighterTarget.z + depthChange, 6.2, 7.8);
  if (state.phase === "shield") {
    state.shieldTarget.z = THREE.MathUtils.clamp(state.shieldTarget.z + depthChange, 6.2, 7.8);
  }
}

function onPointerMove(event) {
  if (state.phase !== "caught" && state.phase !== "shield") return;
  const rect = mount.getBoundingClientRect();
  const movementScale = 2.4 / Math.max(1, rect.height);
  if (state.phase === "caught" || state.activeHand === "shield") {
    state.shieldTarget.x = THREE.MathUtils.clamp(
      state.shieldTarget.x + event.movementX * movementScale,
      -0.85,
      0.85,
    );
    state.shieldTarget.y = THREE.MathUtils.clamp(
      state.shieldTarget.y - event.movementY * movementScale,
      0.65,
      1.65,
    );
  } else {
    state.lighterTarget.x = THREE.MathUtils.clamp(
      state.lighterTarget.x + event.movementX * movementScale,
      -0.85,
      0.85,
    );
    state.lighterTarget.y = THREE.MathUtils.clamp(
      state.lighterTarget.y - event.movementY * movementScale,
      0.65,
      1.65,
    );
  }
}

function onKeyDown(event) {
  const movementKey =
    ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code);
  if (movementKey) {
    pressedKeys.add(event.code);
    event.preventDefault();
  }
  if (event.repeat) return;
  if (event.code === "KeyR") {
    resetToReady();
    return;
  }
  if (event.code === "Space") {
    if (state.phase === "pickup") {
      event.preventDefault();
      attemptCatch();
    }
    return;
  }
  if (event.code === "KeyB") {
    pressLighterSwitch();
    return;
  }
  if (event.code === "KeyE") {
    if (state.phase === "shield") {
      state.inhaling = true;
      event.preventDefault();
    }
    return;
  }
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
    switchHand();
  }
}

function onKeyUp(event) {
  pressedKeys.delete(event.code);
  if (event.code === "KeyE") state.inhaling = false;
}

function updateKeyboardHands(delta) {
  if (state.phase !== "caught" && state.phase !== "shield") return;
  const moveX = (right, left) => Number(pressedKeys.has(right)) - Number(pressedKeys.has(left));
  const moveY = (up, down) => Number(pressedKeys.has(up)) - Number(pressedKeys.has(down));
  const lighterX = moveX("KeyD", "KeyA");
  const lighterY = moveY("KeyW", "KeyS");
  const shieldX = moveX("ArrowRight", "ArrowLeft");
  const shieldY = moveY("ArrowUp", "ArrowDown");
  const lighterMagnitude = Math.hypot(lighterX, lighterY) || 1;
  const shieldMagnitude = Math.hypot(shieldX, shieldY) || 1;
  const speed = 2.4 * delta;

  state.lighterTarget.x = THREE.MathUtils.clamp(
    state.lighterTarget.x + (lighterX / lighterMagnitude) * speed,
    -0.85,
    0.85,
  );
  state.lighterTarget.y = THREE.MathUtils.clamp(
    state.lighterTarget.y + (lighterY / lighterMagnitude) * speed,
    0.65,
    1.65,
  );
  state.shieldTarget.x = THREE.MathUtils.clamp(
    state.shieldTarget.x + (shieldX / shieldMagnitude) * speed,
    -0.85,
    0.85,
  );
  state.shieldTarget.y = THREE.MathUtils.clamp(
    state.shieldTarget.y + (shieldY / shieldMagnitude) * speed,
    0.65,
    1.65,
  );
}

function startGame() {
  if (state.phase !== "ready" && state.phase !== "success" && state.phase !== "failed") return;
  showLighterScreen();
  startScreen.hidden = true;
  replayButton.hidden = true;
  resizeRenderer();
  resetScene();
  state.phase = "pickup";
  statusElement.textContent = "ライターを拾おう";
  statusWrap.className = "run-status running";
  setPhaseLabel("PICK UP");
  showMessage("READY", "ライターは机の上。", "SPACEキーで手に取り、反対の手で風を防ごう。");
}

function resetScene() {
  state.elapsed = 0;
  state.activeHand = "lighter";
  state.stability = 1;
  state.inhaleProgress = 0;
  state.cigaretteLit = false;
  state.cigaretteSmoldering = false;
  state.inhaling = false;
  cigaretteEmberLight.intensity = 0;
  cigaretteEmber.visible = false;
  state.lighterTarget.set(-0.48, 1, 6.65);
  state.shieldTarget.set(0.15, 1.05, 6.65);
  lighter.scale.setScalar(1);
  lighter.position.copy(lighterDeskPosition);
  lighterTremor.set(0, 0, 0);
  lighter.rotation.set(0, 0, 0);
  wheel.rotation.z = 0;
  lighterSwitch.position.y = lighterSwitchRestY;
  flame.visible = false;
  flame.scale.setScalar(1);
  flameCore.visible = false;
  flameCore.scale.setScalar(1);
  flameGlow.intensity = 0;
  flameMaterial.color.set("#ffbd62");
  flameMaterial.opacity = 0.95;
  cigaretteBody.material.color.set("#e6dfc9");
  cigTip.material.color.set("#6f5140");
  cigTip.material.emissive.set("#000000");
  flameState.textContent = "—";
  smokePuffs.forEach((puff) => {
    puff.visible = false;
    puff.material.opacity = 0;
  });
  hand.position.set(-0.85, 0.3, 6.3);
  shieldHand.position.set(0.15, 1.05, 6.65);
  setHandPose(hand, "open");
  setHandPose(shieldHand, "fan");
  setActiveHand();
  updateFlameMeter();
  steps.forEach((step, index) => {
    step.classList.toggle("active", index === 0);
    step.classList.remove("done");
  });
  timerElement.textContent = "00.00";
  cigaretteTimerElement.textContent = "00.00";
}

function resetToReady() {
  state.phase = "ready";
  showLighterScreen();
  gameLayout.hidden = true;
  startScreen.hidden = false;
  cigaretteScreen.hidden = true;
  replayButton.hidden = true;
  resetScene();
  statusElement.textContent = "待機中";
  statusWrap.className = "run-status";
  setPhaseLabel("READY");
  showMessage("READY?", "風に負けるな。", "準備ができたら、ゲームを始めよう。");
  resizeRenderer();
}

function attemptCatch() {
  if (state.phase !== "pickup") return;
  state.phase = "caught";
  state.caughtAt = performance.now();
  state.runStartedAt = state.caughtAt;
  state.elapsed = 0;
  state.activeHand = "shield";
  state.lighterTarget.set(-0.48, 1, 6.65);
  state.shieldTarget.set(0.15, 1.05, 6.65);
  lighter.position.copy(state.lighterTarget);
  setHandPose(hand, "grip");
  setHandPose(shieldHand, "fan");
  lighterSwitch.position.y = lighterSwitchRestY;
  lighter.scale.setScalar(0.36);
  setStep(0);
  setActiveHand();
  setPhaseLabel("LIGHTER");
  showMessage("LIGHTER IGNITION", "右手でスイッチを押そう。", "ライターをクリックして右手を上部スイッチへ移動し、Bキーで押す。");
  statusElement.textContent = "右手をスイッチへ";
}

function pressLighterSwitch() {
  if (state.phase !== "caught") return;
  const handDistance = shieldHand.position.distanceTo(getSwitchHandTarget());
  statusElement.textContent = `スイッチまでの距離: ${handDistance.toFixed(2)}`;
  if (handDistance > 0.38) {
    return;
  }
  setHandPose(shieldHand, "press");
  lighterSwitch.position.y = lighterSwitchRestY - 0.025;
  ignite(true);
  if (state.phase === "caught") lighterSwitch.position.y = lighterSwitchRestY;
}

function ignite(isShielding) {
  if (state.phase !== "caught") return;
  const effectiveWind = state.windStrength * (isShielding ? 0.2 : 1);
  if (effectiveWind > 0.68) {
    lighterSwitch.position.y = lighterSwitchRestY;
    showMessage("WIND TOO STRONG", "風で火がつかない。", "右手でスイッチを押さえながら、もう一度Bキーを押そう。");
    statusElement.textContent = "風よけ・点火待ち";
    return;
  }
  clearLighterTremor();
  state.phase = "handoff";
  state.litAt = performance.now();
  state.transitionShown = false;
  state.elapsed = (state.litAt - state.runStartedAt) / 1000;
  state.activeHand = "shield";
  state.stability = isShielding ? 0.92 : 0.68;
  state.inhaleProgress = 0;
  lighter.position.copy(state.lighterTarget);
  lighter.scale.setScalar(0.36);
  hand.position.set(
    state.lighterTarget.x + 0.04,
    state.lighterTarget.y - 0.03,
    state.lighterTarget.z + 0.02,
  );
  state.shieldTarget.set(0.15, 1.05, state.lighterTarget.z);
  setHandPose(shieldHand, "fan");
  flame.visible = true;
  flameCore.visible = true;
  flame.scale.setScalar(0.2);
  flameCore.scale.setScalar(0.2);
  flameGlow.intensity = 0.45;
  setActiveHand();
  setStep(1);
  setPhaseLabel("IGNITING");
  statusElement.textContent = "煙草の着火画面へ進もう";
  hideMessage();
}

function switchHand() {
  if (state.phase !== "shield") return;
  state.activeHand = state.activeHand === "lighter" ? "shield" : "lighter";
  setActiveHand();
}

function isFlameShielded(lighterPosition = lighter.position) {
  const flamePosition = lighterPosition
    .clone()
    .add(new THREE.Vector3(0, 0.68 * lighter.scale.y, 0));
  const handDistance = state.shieldTarget.distanceTo(flamePosition);
  return handDistance < 0.95 && state.shieldTarget.x > flamePosition.x + 0.1;
}

function setActiveHand() {
  phaseElement.dataset.hand = state.activeHand;
}

function updateShield(delta) {
  state.elapsed = (performance.now() - state.runStartedAt) / 1000;
  state.lighterTarget.x = THREE.MathUtils.clamp(state.lighterTarget.x, -0.85, 0.85);
  state.lighterTarget.y = THREE.MathUtils.clamp(state.lighterTarget.y, 0.65, 1.65);
  state.lighterTarget.z = THREE.MathUtils.clamp(state.lighterTarget.z, 6.2, 7.8);
  state.shieldTarget.z = THREE.MathUtils.clamp(state.shieldTarget.z, 6.2, 7.8);
  lighter.position.lerp(state.lighterTarget, Math.min(1, delta * 8));

  const shieldDestination = new THREE.Vector3(
    state.shieldTarget.x,
    state.shieldTarget.y,
    state.shieldTarget.z,
  );
  shieldHand.position.lerp(shieldDestination, Math.min(1, delta * 9));
  hand.position.lerp(
    new THREE.Vector3(lighter.position.x + 0.04, lighter.position.y - 0.03, lighter.position.z + 0.02),
    Math.min(1, delta * 7),
  );
  lighter.rotation.z = THREE.MathUtils.lerp(
    lighter.rotation.z,
    THREE.MathUtils.clamp((state.lighterTarget.x - lighter.position.x) * -0.18, -0.3, 0.3),
    delta * 5,
  );

  applyAddictionTremor();
  const targetFlameTip = lighter.position
    .clone()
    .add(new THREE.Vector3(0, 0.92 * lighter.scale.y, 0));
  cigTip.getWorldPosition(cigaretteTipWorld);
  const targetDistance = targetFlameTip.distanceTo(cigaretteTipWorld);
  const isShielding = isFlameShielded();
  const inLightingRange = targetDistance < 0.16;
  state.cigaretteSmoldering = inLightingRange;
  const exposed = isShielding ? 0.15 : 0.55 + state.windStrength * 0.55;

  state.stability -= (0.05 + state.windStrength * exposed * 0.46) * delta;
  if (isShielding) state.stability += 0.48 * delta;
  state.stability = THREE.MathUtils.clamp(state.stability, 0, 1);
  const canInhale = inLightingRange && isShielding && state.stability > 0.2;
  if (state.inhaling && canInhale) state.inhaleProgress += delta;
  else state.inhaleProgress = Math.max(0, state.inhaleProgress - delta * 0.7);

  if (state.inhaling) {
    const inhalePercent = Math.min(100, Math.floor((state.inhaleProgress / 1.5) * 100));
    setPhaseLabel(`INHALE ${inhalePercent}%`);
    statusElement.textContent = canInhale ? "吸って火を定着中" : "炎を煙草の先端に近づけ、風を防ごう";
  } else {
    setPhaseLabel("PROTECT THE FLAME");
    statusElement.textContent = state.cigaretteSmoldering
      ? "先端が燃焼中・Eキー長押しで吸う"
      : `風よけ中・煙草に炎を近づけよう（距離 ${targetDistance.toFixed(2)}）`;
  }

  const stability = state.stability;
  flame.scale.setScalar(0.68 + stability * 0.4);
  flame.rotation.z =
    Math.sin(state.elapsed * (14 + state.windStrength * 8)) *
    (1 - stability) *
    (0.35 + state.windStrength * 0.55);
  flameMaterial.opacity = 0.43 + stability * 0.52;
  flameGlow.intensity = 0.5 + stability * 2.1;
  flameGlow.position.x = Math.sin(state.elapsed * 12) * (1 - stability) * 0.08;
  if (stability < 0.28) {
    flameMaterial.color.set("#ff7455");
    flameState.textContent = "危険";
  } else {
    flameMaterial.color.set("#ffbd62");
    flameState.textContent = isShielding ? "風を防いでいる" : "風にさらされている";
  }
  updateFlameMeter();
  updateSmoke(delta);

  if (state.stability <= 0.015) {
    failGame("FLAME OUT", "火が消えてしまった。", "反対の手で風をさえぎろう。");
  } else if (state.inhaleProgress >= 1.5) {
    winGame();
  } else if (state.elapsed > 30) {
    failGame("TIME UP", "時間切れ。", "落ち着いて、もう一度挑戦しよう。");
  }
}

function updateSmoke(delta) {
  const lit = state.cigaretteLit || state.cigaretteSmoldering;
  cigaretteBody.material.color.set(lit ? "#f5e3bc" : "#e6dfc9");
  cigTip.material.color.lerp(new THREE.Color(lit ? "#f04425" : "#6f5140"), delta * 5);
  cigTip.material.emissive.set(lit ? "#d92712" : "#000000");
  cigTip.material.emissiveIntensity = lit ? 1.4 : 0;
  cigaretteEmber.visible = lit;
  cigTip.getWorldPosition(cigaretteTipWorld);
  cigaretteEmberLight.position.copy(cigaretteTipWorld);
  cigaretteEmberLight.intensity = lit ? 0.65 : 0;

  if (!lit) {
    smokePuffs.forEach((puff) => {
      puff.material.opacity = Math.max(0, puff.material.opacity - delta * 0.28);
      if (puff.material.opacity === 0) puff.visible = false;
    });
    return;
  }

  const elapsed = clock.elapsedTime;
  smokePuffs.forEach((puff, index) => {
    puff.visible = true;
    const offset = (elapsed * 0.42 + index / smokePuffs.length) % 1;
    cigTip.getWorldPosition(cigaretteTipWorld);
    puff.position.set(
      cigaretteTipWorld.x + Math.sin(elapsed * 1.5 + index) * 0.12,
      cigaretteTipWorld.y + 0.1 + offset * 0.9,
      cigaretteTipWorld.z,
    );
    puff.scale.setScalar(0.55 + offset * 0.8);
    puff.material.opacity = (1 - offset) * 0.22;
  });
}

function clearLighterTremor() {
  lighter.position.sub(lighterTremor);
  lighterTremor.set(0, 0, 0);
}

function applyAddictionTremor() {
  if (state.phase !== "caught" && state.phase !== "shield") {
    cigarette.position.copy(cigaretteRestPosition);
    cigarette.rotation.copy(cigaretteRestRotation);
    return;
  }

  const time = clock.elapsedTime;
  const intensity = Math.min(1, 0.35 + state.elapsed * 0.055);
  lighterTremor.set(
    (Math.sin(time * 19) + Math.sin(time * 31 + 1.4) * 0.45) * 0.014 * intensity,
    (Math.sin(time * 23 + 0.8) + Math.sin(time * 37) * 0.35) * 0.01 * intensity,
    Math.sin(time * 17 + 2.1) * 0.008 * intensity,
  );
  lighter.position.add(lighterTremor);

  cigarette.position.copy(cigaretteRestPosition);
  cigarette.position.x += Math.sin(time * 18 + 0.3) * 0.024 * intensity;
  cigarette.position.y += Math.sin(time * 25 + 1.2) * 0.022 * intensity;
  cigarette.rotation.set(
    cigaretteRestRotation.x + Math.sin(time * 21) * 0.025 * intensity,
    cigaretteRestRotation.y + Math.sin(time * 16 + 1) * 0.03 * intensity,
    cigaretteRestRotation.z + Math.sin(time * 27 + 0.5) * 0.035 * intensity,
  );
}

function updateFlameMeter() {
  flameMeter.style.width = `${Math.round(state.stability * 100)}%`;
  flameMeter.style.background = state.stability < 0.28 ? "#ff7455" : "#c1e39e";
}

function setStep(completedIndex) {
  steps.forEach((step, index) => {
    step.classList.toggle("done", index <= completedIndex);
    step.classList.toggle("active", index === completedIndex + 1);
  });
}

function setPhaseLabel(label) {
  phaseElement.textContent = label;
}

function showMessage(kicker, title, copy) {
  messageKicker.textContent = kicker;
  messageTitle.textContent = title;
  messageCopy.textContent = copy;
  messageElement.classList.remove("hidden");
}

function hideMessage() {
  messageElement.classList.add("hidden");
}

function failGame(kicker, title, copy) {
  if (state.phase === "failed" || state.phase === "success") return;
  state.phase = "failed";
  state.cigaretteSmoldering = false;
  state.inhaling = false;
  flame.visible = false;
  flameCore.visible = false;
  flameGlow.intensity = 0;
  statusElement.textContent = "失敗";
  statusWrap.className = "run-status";
  setPhaseLabel("TRY AGAIN");
  showMessage(kicker, title, copy);
  replayButton.hidden = false;
}

function winGame() {
  state.phase = "success";
  state.cigaretteLit = true;
  state.cigaretteSmoldering = false;
  state.inhaling = false;
  flame.visible = false;
  flameCore.visible = false;
  flameGlow.intensity = 0;
  state.elapsed = (performance.now() - state.runStartedAt) / 1000;
  flameState.textContent = "着火成功";
  statusElement.textContent = "着火成功";
  statusWrap.className = "run-status success";
  setPhaseLabel("SUCCESS");
  setStep(2);
  if (!bestTime || state.elapsed < bestTime) {
    bestTime = state.elapsed;
    localStorage.setItem("windproof-best", String(bestTime));
    bestElement.textContent = bestTime.toFixed(2);
  }
  showMessage("CIGARETTE LIT", "やった、着火成功。", `記録は ${state.elapsed.toFixed(2)} 秒。自己ベストを更新できたかな？`);
  replayButton.hidden = false;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  clearLighterTremor();
  updateKeyboardHands(delta);

  if (state.phase === "shield") {
    updateShield(delta);
  } else if (state.phase === "pickup") {
    lighter.position.copy(lighterDeskPosition);
  } else if (state.phase === "caught") {
    state.elapsed = (now - state.runStartedAt) / 1000;
    lighter.position.lerp(state.lighterTarget, Math.min(1, delta * 8));
    hand.position.lerp(
      new THREE.Vector3(lighter.position.x + 0.04, lighter.position.y - 0.03, lighter.position.z + 0.02),
      Math.min(1, delta * 7),
    );
    shieldHand.position.lerp(state.shieldTarget, Math.min(1, delta * 9));
    applyAddictionTremor();
  } else if (state.phase === "handoff") {
    shieldHand.position.lerp(state.shieldTarget, Math.min(1, delta * 9));
    const progress = THREE.MathUtils.clamp((now - state.litAt) / lightingDurationMs, 0, 1);
    const growthProgress = Math.min(progress / 0.8, 1);
    const flareScale = 0.2 + 1.3 * growthProgress * (2 - growthProgress);
    const flameScale = progress < 0.8
      ? flareScale
      : THREE.MathUtils.lerp(1.5, 1, (progress - 0.8) / 0.2);
    flame.scale.setScalar(flameScale);
    flameCore.scale.setScalar(flameScale);
    flameGlow.intensity = THREE.MathUtils.lerp(0.45, 1.8, progress);
    if (progress === 1 && !state.transitionShown) {
      state.transitionShown = true;
      setPhaseLabel("LIGHTER LIT");
      showCigaretteTransition();
    }
  } else if (state.phase === "success") {
    updateSmoke(delta);
  } else if (state.phase === "failed") {
    updateSmoke(delta);
  }

  if (state.phase === "caught" || state.phase === "shield" || state.phase === "success") {
    const timerText = state.elapsed.toFixed(2).padStart(5, "0");
    timerElement.textContent = timerText;
    cigaretteTimerElement.textContent = timerText;
  }

  state.windPhase += delta;
  state.windSpeed = THREE.MathUtils.clamp(
    11 + Math.sin(state.windPhase * 0.55) * 8 + Math.sin(state.windPhase * 1.7) * 3,
    2,
    23,
  );
  state.windStrength = state.windSpeed / 20;
  windSpeedElement.textContent = String(Math.round(state.windSpeed));
  windLines.forEach((strand) => {
    strand.position.x -= strand.userData.speed * delta;
    if (strand.position.x < -5.2) strand.position.x = 5.2;
  });
  lighter.position.y += state.phase === "ready" ? Math.sin(clock.elapsedTime * 1.5) * 0.0007 : 0;
  hand.rotation.z = hand.userData.poseRotationZ + Math.sin(clock.elapsedTime * 1.4) * 0.018;
  shieldHand.rotation.z = shieldHand.userData.poseRotationZ + Math.sin(clock.elapsedTime * 1.2 + 1) * 0.025;
  if (state.phase !== "caught" && state.phase !== "shield") {
    applyAddictionTremor();
  }
  renderer.render(scene, camera);
}

animate();
