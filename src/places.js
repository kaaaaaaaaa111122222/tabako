/*
 * 煙草を吸う場所。難易度ごとに決まっていて、まったりモードでは自分で選べる。3D の中身は three/world/scenes.js。
 *   surface  マッチを擦る手元の台の質感（その場所の机に合わせる）
 *   light    空・主な灯り・月明かり・正面からの照り返し
 *   fog      霞の色と濃さ
 *   reflect  金属などへの写り込みの強さ
 *   shadow   月明かり・朝日で影を落とすか
 *   outdoor  風の当たりやすさ（0 = 屋内）
 */

export const PLACES = {
  balcony: {
    label: "ベランダ",
    note: "マンションの夕暮れ",
    thumb: new URL("./assets/images/thumb_balcony.jpg", import.meta.url).href,
    surface: { image: "wood_plank", color: "#b98f64", roughness: 0.65 },
    shadow: true,
    outdoor: 1,
    light: { sky: ["#98a0d8", "#4a3a3c", 1.3], lamp: ["#ffb978", 4.6, [1.9, 2.3, 7.3]], moon: ["#e0a8b8", 1.5, [3, 3.2, -6]], fill: ["#a080b0", 0.7] },
    fog: ["#6a4a6a", 0.0024],
    reflect: 1.0,
  },
  konbini: {
    label: "コンビニ前",
    note: "夜の喫煙所",
    thumb: new URL("./assets/images/thumb_konbini.jpg", import.meta.url).href,
    surface: { image: "steel", color: "#9aa0a6", roughness: 0.42, metalness: 0.6 },
    shadow: false,
    outdoor: 1,
    light: { sky: ["#8a9cc4", "#34363c", 0.9], lamp: ["#fff0dc", 6.5, [-1.4, 2.5, 7.7]], moon: ["#8ea6d8", 0.7, [-3, 5, 2]], fill: ["#c6d8f4", 0.4] },
    fog: ["#0b0e16", 0.006],
    reflect: 1.2,
  },
  rooftop: {
    label: "ビルの屋上",
    note: "風の強い夜",
    thumb: new URL("./assets/images/thumb_rooftop.jpg", import.meta.url).href,
    surface: { image: "wood_plank", color: "#84766a", roughness: 0.85 },
    shadow: true,
    outdoor: 1,
    light: { sky: ["#7c9ad8", "#30343e", 1.5], lamp: ["#ffcf9a", 4.4, [1.0, 2.6, 7.0]], moon: ["#a8c2f4", 2.2, [-3, 4, 2]], fill: ["#5f7cc0", 0.6] },
    fog: ["#1c3050", 0.0026],
    reflect: 1.3,
  },
  kissaten: {
    label: "純喫茶",
    note: "喫煙席・テーブル",
    thumb: new URL("./assets/images/thumb_kissaten.jpg", import.meta.url).href,
    surface: { image: "wood_dark", color: "#c09a76", roughness: 0.4 },
    shadow: false,
    outdoor: 0,
    light: { sky: ["#d8ac7c", "#4a3020", 1.0], lamp: ["#ffbe78", 5.0, [-1.2, 2.5, 7.0]], moon: ["#ffcb8e", 0.35, [2, 4, 2]], fill: ["#d08a4c", 0.35] },
    fog: ["#2a180c", 0.012],
    reflect: 1.0,
  },
  camp: {
    label: "キャンプ場",
    note: "湖と焚き火",
    thumb: new URL("./assets/images/thumb_camp.jpg", import.meta.url).href,
    surface: { image: "wood_plank", color: "#a08464", roughness: 0.85 },
    shadow: true,
    outdoor: 0.75,
    light: { sky: ["#7f9ad4", "#33302c", 1.1], lamp: ["#ff9a4a", 5.0, [-1.2, 1.2, 6.2]], moon: ["#9fb6ea", 1.5, [3, 5, 3]], fill: ["#ff9c54", 0.25] },
    fog: ["#0c1424", 0.004],
    reflect: 1.2,
    flicker: 0.2, // 焚き火のゆらぎ
  },
  harbor: {
    label: "港の防波堤",
    note: "明け方の海",
    thumb: new URL("./assets/images/thumb_harbor.jpg", import.meta.url).href,
    surface: { image: "steel", color: "#c8ced4", roughness: 0.6 },
    shadow: true,
    outdoor: 1,
    light: { sky: ["#b0c8ec", "#7a6658", 1.5], lamp: ["#ffcfa0", 1.6, [2.4, 2.2, 4.5]], moon: ["#ffc498", 2.0, [4, 2.8, -7]], fill: ["#a8c4ea", 0.35] },
    fog: ["#a8806a", 0.0026],
    reflect: 0.8,
  },
  engawa: {
    label: "温泉宿の縁側",
    note: "雪の庭",
    thumb: new URL("./assets/images/thumb_engawa.jpg", import.meta.url).href,
    surface: { image: "wood_dark", color: "#4a2c24", roughness: 0.3 },
    shadow: true,
    outdoor: 0.75,
    light: { sky: ["#8fa8dc", "#4a4a58", 0.95], lamp: ["#ffc689", 3.4, [-1.6, 2.2, 7.4]], moon: ["#a9c0f2", 1.3, [2, 5, -4]], fill: ["#7f98d0", 0.45] },
    fog: ["#22324e", 0.014],
    reflect: 1.0,
  },
};

export const PLACE_IDS = Object.keys(PLACES);
