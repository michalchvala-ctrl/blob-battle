/** Kenney CC0 models used on the guns battlefield (see /models/LICENSE-Kenney.txt). */

export const BUILDING_MODELS = [
  "building-type-a",
  "building-type-b",
  "building-type-c",
  "building-type-d",
  "building-type-e",
  "building-type-g",
  "building-type-i",
  "building-type-k",
  "building-type-m",
  "building-type-o",
  "building-type-q",
  "building-type-s",
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

export function buildingModelPath(id) {
  return `/models/buildings/${id}.glb`;
}

export function treeModelPath(id) {
  return `/models/trees/${id}.glb`;
}
