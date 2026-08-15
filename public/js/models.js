/** Kenney CC0 City Kit Commercial + Nature trees (see /models/LICENSE-Kenney.txt). */

export const BUILDING_MODELS = [
  "building-a",
  "building-b",
  "building-c",
  "building-d",
  "building-e",
  "building-f",
  "building-g",
  "building-h",
  "building-i",
  "building-j",
  "building-k",
  "building-l",
  "building-m",
  "building-n",
];

export const SKYSCRAPER_MODELS = [
  "building-skyscraper-a",
  "building-skyscraper-b",
  "building-skyscraper-c",
  "building-skyscraper-d",
  "building-skyscraper-e",
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
