import { balcony } from "./balcony.js";
import { camp } from "./camp.js";
import { engawa } from "./engawa.js";
import { harbor } from "./harbor.js";
import { kissaten } from "./kissaten.js";
import { konbini } from "./konbini.js";
import { rooftop } from "./rooftop.js";

// 場所の名前 → 3D の中身を組み立てる関数（kit.js の finish() の戻り値を返す）
export const SCENES = { balcony, konbini, rooftop, kissaten, camp, harbor, engawa };
