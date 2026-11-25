import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/*
 * ローカルの ComfyUI で作ったモデルと画像の読み込み（作り方は tools/assetgen/）。
 * ゲームの部品を組み立てる前に loadAssets() を待つ。
 */

const MODEL_URLS = {
  hand: new URL("./assets/models/hand.glb", import.meta.url).href,
  sleeve: new URL("./assets/models/sleeve.glb", import.meta.url).href,
  lighter: new URL("./assets/models/lighter.glb", import.meta.url).href,
  cigarette: new URL("./assets/models/cigarette.glb", import.meta.url).href,
  matchBox: new URL("./assets/models/match_box.glb", import.meta.url).href,
  matchPaper: new URL("./assets/models/match_paper.glb", import.meta.url).href,
  matchbox: new URL("./assets/models/matchbox.glb", import.meta.url).href,
  phone: new URL("./assets/models/phone.glb", import.meta.url).href,
  ashtray: new URL("./assets/models/ashtray.glb", import.meta.url).href,
  moth: new URL("./assets/models/moth.glb", import.meta.url).href,
  ojisan: new URL("./assets/models/ojisan.glb", import.meta.url).href,
  salaryman: new URL("./assets/models/salaryman.glb", import.meta.url).href,
};

const IMAGE_URLS = {
  concrete: new URL("./assets/images/concrete.jpg", import.meta.url).href,
  concreteNormal: new URL("./assets/images/concrete_n.jpg", import.meta.url).href,
  wall: new URL("./assets/images/wall.jpg", import.meta.url).href,
  wallNormal: new URL("./assets/images/wall_n.jpg", import.meta.url).href,
  wood_dark: new URL("./assets/images/wood_dark.jpg", import.meta.url).href,
  woodDarkNormal: new URL("./assets/images/wood_dark_n.jpg", import.meta.url).href,
  wood_plank: new URL("./assets/images/wood_plank.jpg", import.meta.url).href,
  woodPlankNormal: new URL("./assets/images/wood_plank_n.jpg", import.meta.url).href,
  steel: new URL("./assets/images/steel.jpg", import.meta.url).href,
  steelNormal: new URL("./assets/images/steel_n.jpg", import.meta.url).href,
  matchbook: new URL("./assets/images/matchbook.jpg", import.meta.url).href,
  wallpaper: new URL("./assets/images/wallpaper.jpg", import.meta.url).href,
};

// 着信画面の顔写真（CSS の背景として使う）
export const AVATAR_URLS = {
  上司: new URL("./assets/images/avatar_boss.jpg", import.meta.url).href,
  母: new URL("./assets/images/avatar_mother.jpg", import.meta.url).href,
  大家さん: new URL("./assets/images/avatar_landlord.jpg", import.meta.url).href,
};

const COLOR_IMAGES = new Set(["concrete", "wall", "wood_dark", "wood_plank", "steel", "matchbook", "wallpaper"]);
const ANISOTROPY = 8;

const models = {};
const images = {};

export async function loadAssets(onProgress = () => {}) {
  const gltf = new GLTFLoader();
  const loader = new THREE.TextureLoader();
  const total = Object.keys(MODEL_URLS).length + Object.keys(IMAGE_URLS).length;
  let done = 0;
  const step = () => {
    done += 1;
    onProgress(done / total);
  };
  await Promise.all([
    ...Object.entries(MODEL_URLS).map(async ([name, url]) => {
      const { scene } = await gltf.loadAsync(url);
      scene.updateMatrixWorld(true);
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap"]) {
          if (object.material[key]) object.material[key].anisotropy = ANISOTROPY;
        }
      });
      models[name] = scene;
      step();
    }),
    ...Object.entries(IMAGE_URLS).map(async ([name, url]) => {
      const texture = await loader.loadAsync(url);
      if (COLOR_IMAGES.has(name)) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = ANISOTROPY;
      images[name] = texture;
      step();
    }),
  ]);
}

// 読み込んだモデルの元（共有）。書き換えずに使う
export function getModel(name) {
  if (!models[name]) throw new Error(`モデルが読み込まれていない: ${name}`);
  return models[name];
}

// モデルの中の部品（名前で探す）
export function getPart(name, part) {
  const object = getModel(name).getObjectByName(part);
  if (!object) throw new Error(`モデル ${name} に ${part} がない`);
  return object;
}

// 部品を複製する（形と材質は共有）
export function cloneModel(name) {
  return getModel(name).clone(true);
}

export function getImage(name) {
  if (!images[name]) throw new Error(`画像が読み込まれていない: ${name}`);
  return images[name];
}

// 並べて使う質感（鏡映しで継ぎ目を出さない）
export function tiledImage(name, repeatX, repeatY) {
  const texture = getImage(name).clone();
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}
