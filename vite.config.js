import { defineConfig } from "vite";

// three 本体とアドオンを最初からまとめて事前バンドルしておく。
// （後から見つかると依存の再最適化が走り、three が二重に読み込まれることがある）
export default defineConfig({
  // どの URL の下に置いても動くように、相対パスで書き出す（スマホ用に Web へ置くとき）
  base: "./",
  optimizeDeps: {
    include: [
      "three",
      "three/addons/postprocessing/EffectComposer.js",
      "three/addons/postprocessing/RenderPass.js",
      "three/addons/postprocessing/UnrealBloomPass.js",
      "three/addons/postprocessing/OutputPass.js",
      "three/addons/loaders/GLTFLoader.js",
      "three/addons/geometries/RoundedBoxGeometry.js",
      "three/addons/utils/BufferGeometryUtils.js",
    ],
  },
});
