import * as THREE from "three";
import { radialTexture, smokeTexture } from "./textures.js";

/* ------------------------------------------------------------------ */
/* 炎：カメラに向く板にノイズで揺らぐ形を描く                          */
/* ------------------------------------------------------------------ */

const flameVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uLean;
  uniform float uCool;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    float y = vUv.y;
    float x = vUv.x - 0.5;
    float t = uTime;
    float height = 0.82 + noise(vec2(t * 7.0, uSeed)) * 0.18;
    float yy = y / height;
    // 上に行くほど風とゆらぎで横に流れる
    float sway = (noise(vec2(yy * 2.6 - t * 3.2, t * 1.3 + uSeed)) - 0.5) * 0.22 + uLean * 0.34;
    x -= sway * yy * yy;
    float width = 0.27 * pow(clamp(yy * 4.0, 0.0, 1.0), 0.55) * pow(max(0.0, 1.0 - yy), 0.85);
    width *= 0.9 + noise(vec2(yy * 6.0, t * 9.0)) * 0.2;
    float d = abs(x) / max(width, 0.0001);
    float body = (1.0 - smoothstep(0.55, 1.0, d)) * step(yy, 1.0) * step(0.0, yy);
    float core = (1.0 - smoothstep(0.0, 0.6, d)) * (1.0 - smoothstep(0.12, 0.62, yy));
    float base = 1.0 - smoothstep(0.0, 0.22, yy);

    vec3 orange = vec3(1.0, 0.42, 0.1);
    vec3 yellow = vec3(1.0, 0.84, 0.5);
    vec3 blue = vec3(0.22, 0.4, 1.0);
    vec3 color = mix(orange, yellow, core);
    color = mix(color, blue, base * 0.85);
    color = mix(color, vec3(0.38, 0.6, 1.0), uCool);
    float alpha = body * uIntensity;
    gl_FragColor = vec4(color * (0.8 + core * 1.8), alpha);
  }
`;

export function createFlame() {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uLean: { value: 0 },
      uCool: { value: 0 },
      uSeed: { value: Math.random() * 10 },
    },
    vertexShader: flameVertex,
    fragmentShader: flameFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 6;
  mesh.visible = false;

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture([
        [0, "rgba(255,190,110,0.55)"],
        [0.35, "rgba(255,140,60,0.18)"],
        [1, "rgba(255,120,40,0)"],
      ]),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  halo.renderOrder = 5;
  halo.visible = false;

  return { mesh, halo, material, uniforms: material.uniforms };
}

/* ------------------------------------------------------------------ */
/* 火花：速度方向に尾を引く線                                          */
/* ------------------------------------------------------------------ */

export function createSparks(count = 80) {
  const positions = new Float32Array(count * 6);
  const colors = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = 7;
  const particles = Array.from({ length: count }, () => ({
    life: 0,
    maxLife: 1,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
  }));

  const tmp = new THREE.Vector3();
  return {
    object: lines,
    emit(origin, amount, { drift = 0, spread = 1, push = null } = {}) {
      let emitted = 0;
      for (const p of particles) {
        if (emitted >= amount) break;
        if (p.life > 0) continue;
        p.pos.copy(origin).add(tmp.set((Math.random() - 0.5) * 0.01, 0.004, (Math.random() - 0.5) * 0.01));
        p.vel.set(
          ((Math.random() - 0.5) * 0.9 + drift) * spread,
          0.25 + Math.random() * 1.1,
          (Math.random() - 0.5) * 0.9 * spread,
        );
        if (push) p.vel.addScaledVector(push, 0.6 + Math.random() * 0.8);
        p.maxLife = 0.12 + Math.random() * 0.3;
        p.life = p.maxLife;
        emitted += 1;
      }
    },
    update(delta) {
      particles.forEach((p, i) => {
        const o = i * 6;
        if (p.life <= 0) {
          positions.fill(0, o, o + 6);
          colors.fill(0, o, o + 6);
          return;
        }
        p.life -= delta;
        p.vel.y -= 3.2 * delta;
        p.pos.addScaledVector(p.vel, delta);
        const k = Math.max(0, p.life / p.maxLife);
        positions[o] = p.pos.x;
        positions[o + 1] = p.pos.y;
        positions[o + 2] = p.pos.z;
        positions[o + 3] = p.pos.x - p.vel.x * 0.022;
        positions[o + 4] = p.pos.y - p.vel.y * 0.022;
        positions[o + 5] = p.pos.z - p.vel.z * 0.022;
        const r = 1.4 * k + 0.4;
        const g = 0.95 * k * k + 0.25;
        const b = 0.55 * k * k * k;
        colors[o] = r;
        colors[o + 1] = g;
        colors[o + 2] = b;
        colors[o + 3] = r * 0.3;
        colors[o + 4] = g * 0.2;
        colors[o + 5] = 0;
      });
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
    clear() {
      particles.forEach((p) => {
        p.life = 0;
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* 煙：やわらかいスプライト                                            */
/* ------------------------------------------------------------------ */

export function createSmoke(count = 40) {
  const texture = smokeTexture();
  const group = new THREE.Group();
  const puffs = Array.from({ length: count }, () => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, color: "#c9cfd3", transparent: true, opacity: 0, depthWrite: false }),
    );
    sprite.visible = false;
    group.add(sprite);
    return { sprite, life: 0, maxLife: 1, vel: new THREE.Vector3(), size: 0.03, grow: 0.1, alpha: 0.3, spin: 0 };
  });
  return {
    object: group,
    emit(origin, { size = 0.03, grow = 0.12, life = 1.8, alpha = 0.35, vel = null } = {}) {
      let puff = puffs.find((p) => p.life <= 0);
      if (!puff) puff = puffs.reduce((oldest, p) => (p.life < oldest.life ? p : oldest));
      puff.sprite.position.copy(origin);
      if (vel) puff.vel.copy(vel);
      else puff.vel.set((Math.random() - 0.5) * 0.04, 0.12 + Math.random() * 0.08, (Math.random() - 0.5) * 0.03);
      puff.size = size;
      puff.grow = grow;
      puff.alpha = alpha;
      puff.maxLife = life;
      puff.life = life;
      puff.spin = (Math.random() - 0.5) * 0.8;
      puff.sprite.material.rotation = Math.random() * Math.PI * 2;
      puff.sprite.visible = true;
    },
    update(delta, drift = 0) {
      for (const puff of puffs) {
        if (puff.life <= 0) continue;
        puff.life -= delta;
        if (puff.life <= 0) {
          puff.sprite.visible = false;
          continue;
        }
        puff.vel.x += drift * delta;
        puff.vel.multiplyScalar(1 - delta * 0.25);
        puff.sprite.position.addScaledVector(puff.vel, delta);
        const age = 1 - puff.life / puff.maxLife;
        const size = puff.size + puff.grow * age;
        puff.sprite.scale.set(size, size, 1);
        puff.sprite.material.rotation += puff.spin * delta;
        puff.sprite.material.opacity = puff.alpha * Math.min(1, age * 5) * (1 - age) ** 1.4;
      }
    },
    clear() {
      puffs.forEach((p) => {
        p.life = 0;
        p.sprite.visible = false;
      });
    },
  };
}

export function createGlow(color = "255,90,30") {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture([
        [0, `rgba(${color},0.9)`],
        [0.3, `rgba(${color},0.3)`],
        [1, `rgba(${color},0)`],
      ]),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.renderOrder = 6;
  return sprite;
}

/* ------------------------------------------------------------------ */
/* 雨：カメラの前に降る線                                              */
/* ------------------------------------------------------------------ */

export function createRain(count = 420) {
  const positions = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: "#b8c8e0", transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = 8;
  const drops = Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 4,
    y: Math.random() * 3.2,
    z: 4.6 + Math.random() * 3.2,
    speed: 5 + Math.random() * 3,
  }));
  return {
    object: lines,
    update(delta, intensity, windX = 0) {
      lines.visible = intensity > 0.01;
      material.opacity = Math.min(0.55, intensity * 0.55);
      if (!lines.visible) return;
      drops.forEach((drop, i) => {
        drop.y -= drop.speed * delta;
        drop.x += windX * delta;
        if (drop.y < -0.2) {
          drop.y = 3 + Math.random() * 0.4;
          drop.x = (Math.random() - 0.5) * 4;
        }
        const o = i * 6;
        const active = i < count * intensity;
        positions[o] = drop.x;
        positions[o + 1] = active ? drop.y : -50;
        positions[o + 2] = drop.z;
        positions[o + 3] = drop.x - windX * 0.02;
        positions[o + 4] = active ? drop.y + 0.07 : -50;
        positions[o + 5] = drop.z;
      });
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
