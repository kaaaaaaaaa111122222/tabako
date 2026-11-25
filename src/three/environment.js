import * as THREE from "three";
import { PLACES } from "../places.js";
import { EYE, LIGHT_MODE, SCALE } from "./world/kit.js";
import { SCENES } from "./world/scenes.js";

/*
 * 煙草を吸う場所の景色。中身は 3D で組んである（world/）。
 * 道具や灰皿を置く所は場所ごとに違い、spot で受け取る。設定は places.js、切り替えは setPlace()。
 */

const BLUR_SIZE = { width: 512, height: 256 };

export function createEnvironment(renderer, scene) {
  scene.environmentIntensity = 0.55;
  scene.background = new THREE.Color("#0b101d");
  scene.fog = new THREE.FogExp2("#141c2b", 0.004);
  const pmrem = new THREE.PMREMGenerator(renderer);
  // 点火画面の背景に使う、この場所を写したもの（ミップマップでぼかす）
  const blurTarget = new THREE.WebGLRenderTarget(BLUR_SIZE.width, BLUR_SIZE.height, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    type: THREE.HalfFloatType,
  });
  const blurCamera = new THREE.PerspectiveCamera(58, BLUR_SIZE.width / BLUR_SIZE.height, 0.5, 1400);
  blurCamera.position.copy(EYE);
  blurCamera.lookAt(0, 1.6, 0);

  // 照明
  const sky = new THREE.HemisphereLight();
  const lamp = new THREE.PointLight("#fff", 1, 9, 1.6);
  const moon = new THREE.DirectionalLight();
  const fill = new THREE.DirectionalLight();
  fill.position.set(0.5, 0.4, -5);
  scene.add(sky, lamp, moon, moon.target, fill);
  // 場所は動かないので、影は場所を切り替えたときに 1 回だけ描く
  renderer.shadowMap.autoUpdate = false;
  const SHADOW_AREA = 11 * SCALE; // 影を落とす範囲（目の前の左右）
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -SHADOW_AREA, right: SHADOW_AREA, top: SHADOW_AREA, bottom: -SHADOW_AREA, near: 1, far: 120 });
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.05;
  moon.shadow.radius = 2.5;
  moon.target.position.set(0, 0, EYE.z - 7 * SCALE);

  // 風の流れ（細い線）
  const streakCount = 26;
  const streakPositions = new Float32Array(streakCount * 6);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3));
  const streakMaterial = new THREE.LineBasicMaterial({ color: "#b9c9e6", transparent: true, opacity: 0.16, depthWrite: false });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
  streaks.frustumCulled = false;
  scene.add(streaks);
  const streakData = Array.from({ length: streakCount }, () => ({
    x: (Math.random() - 0.5) * 9,
    y: 0.7 + Math.random() * 3,
    z: 1.5 + Math.random() * 4.2,
    speed: 0.6 + Math.random() * 1.2,
    length: 0.3 + Math.random() * 0.6,
  }));

  const built = new Map(); // 場所 → { kit（finish() の戻り値）, reflection }
  let current = null;
  let currentKit = null;
  let currentId = null;

  function build(id) {
    if (!built.has(id)) {
      const promise = SCENES[id]().then((kit) => {
        kit.group.visible = false;
        scene.add(kit.group);
        return { kit, reflection: null };
      });
      promise.catch(() => built.delete(id)); // 失敗したら次にやり直せるように
      built.set(id, promise);
    }
    return built.get(id);
  }

  // 手や道具を隠して、場所だけを写す
  function withPlaceOnly(kit, draw) {
    const hidden = [];
    scene.children.forEach((child) => {
      if (child === kit.group || child.isLight || !child.visible) return;
      child.visible = false;
      hidden.push(child);
    });
    draw();
    hidden.forEach((child) => {
      child.visible = true;
    });
  }

  async function setPlace(id) {
    const entry = await build(id);
    if (currentId === id) return;
    const place = PLACES[id];
    if (currentKit) currentKit.group.visible = false;
    current = place;
    currentId = id;
    currentKit = entry.kit;
    currentKit.group.visible = true;
    sky.color.set(place.light.sky[0]);
    sky.groundColor.set(place.light.sky[1]);
    sky.intensity = place.light.sky[2];
    lamp.color.set(place.light.lamp[0]);
    lamp.intensity = place.light.lamp[1];
    lamp.position.set(...place.light.lamp[2]);
    moon.color.set(place.light.moon[0]);
    moon.intensity = place.light.moon[1];
    moon.position.set(...place.light.moon[2]).normalize().multiplyScalar(60).add(moon.target.position);
    moon.castShadow = place.shadow && !LIGHT_MODE;
    fill.color.set(place.light.fill[0]);
    fill.intensity = place.light.fill[1];
    scene.fog.color.set(place.fog[0]);
    scene.fog.density = place.fog[1] / SCALE;
    scene.background.set(place.fog[0]);
    currentKit.update(0, 0, 0);

    const toneMapping = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    withPlaceOnly(currentKit, () => {
      renderer.shadowMap.needsUpdate = true;
      if (!entry.reflection) {
        scene.environment = null;
        entry.reflection = pmrem.fromScene(scene, 0.015, 0.3, 1400, { position: EYE }).texture;
      }
      scene.environment = entry.reflection;
      renderer.setRenderTarget(blurTarget);
      renderer.clear();
      renderer.render(scene, blurCamera);
      renderer.setRenderTarget(null);
    });
    renderer.toneMapping = toneMapping;
    scene.environmentIntensity = place.reflect;
  }

  return {
    setPlace,
    preload: build,
    blurTexture: blurTarget.texture,
    // 道具・スマホ・灰皿を置く所（ワールド座標）
    get spot() {
      return currentKit.spot;
    },
    get place() {
      return current;
    },
    get outdoor() {
      return current?.outdoor ?? 1;
    },
    update(delta, windDir, windStrength, gustBoost, time) {
      currentKit?.update(delta, time, -windDir * Math.min(1.5, windStrength) * gustBoost);
      if (current?.flicker) {
        const wave = Math.sin(time * 11) * 0.5 + Math.sin(time * 17.3 + 1) * 0.3 + Math.sin(time * 29 + 2) * 0.2;
        lamp.intensity = current.light.lamp[1] * (1 + wave * current.flicker);
      }
      streaks.visible = (current?.outdoor ?? 1) > 0;
      if (!streaks.visible) return;
      const flow = -windDir;
      streakData.forEach((s, i) => {
        s.x += flow * s.speed * (1.5 + windStrength * 3) * gustBoost * delta;
        if (s.x < -5) s.x = 5;
        if (s.x > 5) s.x = -5;
        const length = s.length * (0.5 + windStrength) * gustBoost;
        const o = i * 6;
        streakPositions[o] = s.x;
        streakPositions[o + 1] = s.y;
        streakPositions[o + 2] = s.z;
        streakPositions[o + 3] = s.x - flow * length;
        streakPositions[o + 4] = s.y + Math.sin(s.x * 2) * 0.02;
        streakPositions[o + 5] = s.z;
      });
      streakGeometry.attributes.position.needsUpdate = true;
      streakMaterial.opacity = (0.04 + windStrength * 0.05 + (gustBoost - 1) * 0.14) * Math.min(1, current?.outdoor ?? 1);
    },
  };
}

// 点火画面の背景：ピントの外れた景色。カメラの正面 distance だけ奥に置く
export function createBlurBackdrop(camera, distance = 3) {
  const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.5;
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { map: { value: null }, uGain: { value: 0.85 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // 円く散らして拾い、玉ぼけのように見せる
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D map;
      uniform float uGain;
      void main() {
        vec3 sum = vec3(0.0);
        float total = 0.0;
        for (int i = 0; i < 48; i++) {
          float k = float(i);
          float r = sqrt((k + 0.5) / 48.0);
          float a = k * 2.399963;
          vec2 offset = vec2(cos(a), sin(a) * 2.0) * r * 0.03;
          vec3 c = min(texture2D(map, vUv + offset, 3.2).rgb, vec3(3.0));
          float w = 1.0 + dot(c, vec3(0.25));
          sum += c * w;
          total += w;
        }
        gl_FragColor = vec4(sum / total * uGain, 1.0);
      }
    `,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(height * 2.2, height * 1.1), material);
  plane.renderOrder = -10;
  camera.updateMatrixWorld(true);
  plane.quaternion.copy(camera.quaternion);
  plane.position.copy(camera.position).add(new THREE.Vector3(0, 0, -distance).applyQuaternion(camera.quaternion));
  return {
    plane,
    setPlace(texture) {
      material.uniforms.map.value = texture;
    },
  };
}
