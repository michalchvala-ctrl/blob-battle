/** Quaternius buildings + Kenney nature/roads + Quaternius cars (CC0). */

export const BUILDING_MODELS = [
  "1Story",
  "1Story_Sign",
  "2Story",
  "2Story_Balcony",
  "2Story_Wide",
  "2Story_Wide_2Doors",
  "3Story_Balcony",
  "3Story_Slim",
  "4Story",
  "4Story_Center",
  "4Story_Wide_2Doors",
  "6Story_Stack",
];

/** Taller Quaternius buildings used as “skyscraper” slots. */
export const SKYSCRAPER_MODELS = [
  "4Story",
  "4Story_Center",
  "4Story_Wide_2Doors",
  "6Story_Stack",
  "3Story_Balcony",
];

export const TREE_MODELS = [
  "tree_oak",
  "tree_detailed",
  "tree_pineDefaultA",
  "tree_pineRoundC",
  "tree_fat",
  "tree_cone",
  "tree_default",
  "tree_pineSmallB",
  "tree-large",
  "tree-small",
];

export const CAR_MODELS = ["BasicCar", "Taxi", "CopCar", "SimpleCarShort", "RaceCar"];

export const ROAD_MODELS = [
  "road_straight",
  "road_crossroad",
  "road_crossing",
  "road_intersection",
  "road_bend",
  "road_curve",
  "road_side",
  "light_square",
];

export function buildingModelPath(id) {
  return `/models/city/${id}.glb`;
}

export function treeModelPath(id) {
  return `/models/trees/${id}.glb`;
}

export function carModelPath(id) {
  return `/models/cars/${id}.glb`;
}

export function roadModelPath(id) {
  return `/models/roads/${id}.glb`;
}
