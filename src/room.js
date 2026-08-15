import * as CANNON from "cannon-es";
import {
  ARENA_INFO,
  ARENA_IDS,
  resolveArenaLayout,
  pointOverLayout,
} from "../public/js/arenas.js";

export { ARENA_INFO, ARENA_IDS };

export const COLORS = [
  "#ff4d6d",
  "#4cc9f0",
  "#b8f25a",
  "#ffd60a",
  "#c77dff",
  "#ff9e00",
  "#80ffdb",
  "#ff6b6b",
];

export const MODE_INFO = {
  sumo: { name: "Zhodiť", blurb: "Posledný na ostrove vyhral. Ostrov ostáva veľký." },
  bomb: { name: "Bomba", blurb: "Dotyk odovzdá bombu. Kto ju drží, vybuchne." },
  hill: { name: "Kráľ kopca", blurb: "Kraje praskajú a úlomky padajú do prázdna. Vydrž." },
  guns: { name: "Streľba", blurb: "Zbrane, autá (E), životy. Veľká mapa. Strela = 20 %." },
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  return s;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function cylinder(rTop, rBot, height, segs = 18) {
  return new CANNON.Cylinder(rTop, rBot, height, segs);
}

/** Platform cylinder height 1.15 → top at ±0.575; sphere r=0.62 rests just above. */
const PLAYER_RADIUS = 0.62;
const PLATFORM_HALF_H = 0.575;
const PLATFORM_TOP = PLATFORM_HALF_H;
const PLAYER_REST_Y = PLATFORM_TOP + PLAYER_RADIUS;
const PLATFORM_HEIGHT = PLATFORM_HALF_H * 2;
/** Hill glass: keep a few inner pieces so the fight has a last foothold. */
const HILL_MIN_SHARDS = 3;

function normAngle(a) {
  const twoPi = Math.PI * 2;
  let x = a % twoPi;
  if (x < 0) x += twoPi;
  return x;
}

function angleInSector(ang, a0, a1) {
  const a = normAngle(ang);
  const start = normAngle(a0);
  const end = normAngle(a1);
  if (start <= end) return a >= start && a < end;
  return a >= start || a < end;
}

/** Unequal sector cuts around the circle (shattered look, not pizza). */
function randomSectorCuts(count, minFrac = 0.055) {
  const weights = Array.from({ length: count }, () => minFrac + Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  let acc = Math.random() * Math.PI * 2;
  const cuts = [acc];
  for (let i = 0; i < count; i++) {
    acc += (weights[i] / sum) * Math.PI * 2;
    cuts.push(acc);
  }
  return cuts;
}

/** 2D annular (or wedge) polygon in XZ — CCW when viewed from +Y. */
function annularPoly2d(a0, a1, rInner, rOuter, arcSegs = 5) {
  const span = Math.min(Math.PI * 0.95, a1 - a0);
  const n = Math.max(2, Math.ceil(arcSegs * Math.max(0.15, span / (Math.PI / 4))));
  const pts = [];
  // Outer arc a1 → a0 (decreasing θ) for CCW from +Y with (sin θ, cos θ)
  for (let i = n; i >= 0; i--) {
    const t = a0 + (span * i) / n;
    pts.push({ x: Math.sin(t) * rOuter, z: Math.cos(t) * rOuter });
  }
  if (rInner < 0.12) {
    pts.push({ x: 0, z: 0 });
  } else {
    for (let i = 0; i <= n; i++) {
      const t = a0 + (span * i) / n;
      pts.push({ x: Math.sin(t) * rInner, z: Math.cos(t) * rInner });
    }
  }
  return pts;
}

/**
 * Irregular glass layout: 2–3 concentric rings, each with its own random
 * sector angles (seams kink between rings — not equal pizza wedges).
 * ring 0 = outermost (breaks first).
 * Fewer, larger edge pieces so the hill shrinks faster.
 */
function generateGlassShatter(radius) {
  const nRings = Math.random() < 0.62 ? 2 : 3;
  const fracs = [];
  if (nRings === 2) {
    fracs.push(0.42 + Math.random() * 0.12);
    fracs.push(1);
  } else {
    fracs.push(0.28 + Math.random() * 0.08);
    fracs.push(0.58 + Math.random() * 0.1);
    fracs.push(1);
  }

  const shards = [];
  let id = 0;
  for (let ring = 0; ring < nRings; ring++) {
    const ringFromOuter = nRings - 1 - ring; // 0 = outer
    const rInner = ring === 0 ? 0 : radius * fracs[ring - 1];
    const rOuter = radius * fracs[ring];
    let nSec;
    if (ringFromOuter === 0) nSec = 4 + ((Math.random() * 3) | 0); // 4–6 large rim pieces
    else if (ringFromOuter === 1) nSec = 3 + ((Math.random() * 2) | 0); // 3–4
    else nSec = 2 + ((Math.random() * 2) | 0); // 2–3

    const cuts = randomSectorCuts(nSec, ringFromOuter === 0 ? 0.08 : 0.1);
    for (let s = 0; s < nSec; s++) {
      let a0 = cuts[s];
      let a1 = cuts[s + 1];
      // Keep each piece convex (span < π)
      if (a1 - a0 > Math.PI * 0.95) a1 = a0 + Math.PI * 0.95;
      const poly = annularPoly2d(a0, a1, rInner, rOuter, ringFromOuter === 0 ? 5 : 3);
      const mid = (a0 + a1) * 0.5;
      const rMid = rInner < 0.12 ? rOuter * 0.45 : (rInner + rOuter) * 0.5;
      shards.push({
        id: id++,
        ring: ringFromOuter,
        a0,
        a1,
        rInner,
        rOuter,
        radius,
        poly,
        cx: Math.sin(mid) * rMid,
        cz: Math.cos(mid) * rMid,
      });
    }
  }
  return shards;
}

/** Triangular prism (Y-up) matching Three.CylinderGeometry(..., 3). */
function makeTrianglePrism(radius, height) {
  const half = height * 0.5;
  const vertices = [];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    vertices.push(new CANNON.Vec3(x, -half, z));
    vertices.push(new CANNON.Vec3(x, half, z));
  }
  const faces = [
    [0, 2, 4],
    [1, 5, 3],
    [0, 1, 3, 2],
    [2, 3, 5, 4],
    [4, 5, 1, 0],
  ];
  return new CANNON.ConvexPolyhedron({ vertices, faces });
}

/** Oriented box under an annular shard — local to shard centroid (body at cx,cz). */
function makeShardBox(def, height) {
  const span = Math.abs(def.a1 - def.a0);
  const mid = (def.a0 + def.a1) * 0.5;
  const r0 = def.rInner;
  const r1 = def.rOuter;
  const rMid = r0 < 0.12 ? r1 * 0.45 : (r0 + r1) * 0.5;
  const radial = Math.max(0.55, r1 - r0) * 0.92;
  const tangential = Math.max(0.55, rMid * span) * 0.92;
  const shape = new CANNON.Box(
    new CANNON.Vec3(tangential * 0.5, height * 0.5, radial * 0.5),
  );
  const wx = Math.sin(mid) * rMid;
  const wz = Math.cos(mid) * rMid;
  const offset = new CANNON.Vec3(wx - def.cx, 0, wz - def.cz);
  const quat = new CANNON.Quaternion();
  quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), mid);
  return { shape, offset, quat };
}

export class GameRoom {
  constructor(code, io) {
    this.code = code;
    this.io = io;
    this.players = new Map();
    this.hostId = null;
    this.mode = "sumo";
    this.arenaId = "circle";
    this.layout = null;
    this.layoutKey = "";
    this.phase = "lobby";
    this.winnerId = null;
    this.winnerName = null;
    this.platformRadius = 13;
    this.bombId = null;
    this.bombT = 0;
    this.bombTransferLock = 0;
    this.roundT = 0;
    this.shrinkT = 0;
    this.nextBroadcast = 0;
    this.events = [];
    this.scores = new Map();
    this.roundKills = 0;
    this.bullets = [];
    this.bulletNextId = 1;

    this.groundMat = new CANNON.Material("ground");
    this.playerMat = new CANNON.Material("player");
    this.boxMat = new CANNON.Material("box");
    this.goatMat = new CANNON.Material("goat");
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.05;
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.groundMat, this.playerMat, {
        friction: 0.04,
        restitution: 0,
        contactEquationStiffness: 1e9,
        contactEquationRelaxation: 2,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.playerMat, this.playerMat, {
        friction: 0.2,
        restitution: 0.55,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.boxMat, this.playerMat, {
        friction: 0.15,
        restitution: 0.72,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.boxMat, this.groundMat, {
        friction: 0.4,
        restitution: 0.48,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.boxMat, this.boxMat, {
        friction: 0.3,
        restitution: 0.55,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.goatMat, this.groundMat, {
        friction: 0.0,
        restitution: 0.0,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.goatMat, this.playerMat, {
        friction: 0.08,
        restitution: 0.35,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.goatMat, this.boxMat, {
        friction: 0.2,
        restitution: 0.25,
      }),
    );

    this.platform = null;
    this.grounds = [];
    this.shards = [];
    this.boxes = [];
    this.boxNextId = 0;
    this.debris = [];
    this.debrisNextId = 1;
    this.debrisSpawnT = 2 + Math.random() * 2;
    this.maxDebris = 18;
    this.structures = [];
    this.vehicles = [];
    this.goats = [];
    this.maxGoats = 2;
    this.goatSpawnT = 6 + Math.random() * 8;
    this.medkitSpawnT = 8 + Math.random() * 6;
    this.medkits = [];
    this.maxMedkits = 4;
    this.ammoPacks = [];
    this.maxAmmoPacks = 6;
    this.ammoSpawnT = 6 + Math.random() * 4;
    this.grenades = [];
    this.smokes = [];
    this.smokeNextId = 1;
    this.snipers = [];
    this.sniperSpawnT = 45;
    this.ladders = [];
    this.windAngle = 0;
    this.dayPhase = 0;
    this.nextCrackT = Infinity;
    this.applyLayout(resolveArenaLayout("circle"));
  }

  emit(event, payload) {
    this.io.to(this.code).emit(event, payload);
  }

  clearShards() {
    for (const s of this.shards) this.world.removeBody(s.body);
    this.shards = [];
  }

  clearGrounds() {
    for (const b of this.grounds) this.world.removeBody(b);
    this.grounds = [];
    this.platform = null;
  }

  /** Apply concrete layout pieces as static ground (or hill shards for circle). */
  applyLayout(layout, opts = {}) {
    const { playing = this.phase === "playing" } = opts;
    for (const b of this.boxes) this.world.removeBody(b);
    this.boxes = [];
    for (const d of this.debris) this.world.removeBody(d);
    this.debris = [];
    this.debrisSpawnT = 2 + Math.random() * 2;
    for (const g of this.goats) this.world.removeBody(g);
    this.goats = [];
    this.goatSpawnT = 5 + Math.random() * 7;
    for (const m of this.medkits || []) this.world.removeBody(m);
    this.medkits = [];
    this.medkitSpawnT = 6 + Math.random() * 5;
    for (const a of this.ammoPacks || []) this.world.removeBody(a);
    this.ammoPacks = [];
    this.ammoSpawnT = 5 + Math.random() * 4;
    for (const g of this.grenades || []) this.world.removeBody(g);
    this.grenades = [];
    this.smokes = [];
    for (const s of this.snipers || []) this.world.removeBody(s);
    this.snipers = [];
    this.sniperSpawnT = 8 + Math.random() * 6;
    for (const v of this.vehicles || []) this.world.removeBody(v);
    this.vehicles = [];
    for (const p of this.players.values()) {
      p.vehicleId = null;
      if (p.body) p.body.collisionResponse = true;
    }
    this.ladders = [];
    this.clearStructures();
    this.clearShards();
    this.layout = layout;
    // Include sizes/rotation so procedural regenerations always force a client rebuild
    this.layoutKey = `${layout.id}:${layout.pieces
      .map((p) => {
        if (p.t === "cyl" || p.t === "tri") {
          return `${p.t},${p.x.toFixed(2)},${p.z.toFixed(2)},${p.r.toFixed(2)}`;
        }
        return `${p.t},${p.x.toFixed(2)},${p.z.toFixed(2)},${p.w.toFixed(2)},${p.d.toFixed(2)},${(p.rotY || 0).toFixed(3)}`;
      })
      .join("|")}`;
    this.platformRadius = layout.radius;

    const useHillShards =
      this.mode === "hill" && playing && layout.id === "circle" && layout.pieces.length === 1 && layout.pieces[0].t === "cyl";

    if (useHillShards) {
      this.clearGrounds();
      this.buildHillShards(layout.pieces[0].r);
      // Unique key so clients rebuild when shatter pattern regenerates each round
      this.layoutKey = `hill-glass:${this.shards.map((s) => `${s.ring},${s.a0.toFixed(4)},${s.rInner.toFixed(2)},${s.rOuter.toFixed(2)}`).join(";")}`;
    } else {
      this.rebuildGroundPhysics(layout.pieces);
    }

    if (layout.id === "battlefield" || this.mode === "guns") {
      this.spawnBattlefieldDecor();
      // No falling junk spheres/boxes from the old sumo map — buildings + pickups only
      this.maxDebris = 0;
    } else {
      this.maxDebris = 18;
      this.layout.structures = [];
    }

    const spots = [
      [5.2, 2.4, "#5ce1ff"],
      [-4.6, -3.2, "#d6ff4a"],
      [0.4, 6.1, "#c77dff"],
      [-2.2, 4.5, "#ff9e00"],
      [3.8, -5.1, "#80ffdb"],
    ];
    // Skip colorful walkable crates on the guns battlefield
    if (this.mode !== "guns" && layout.id !== "battlefield") {
    // On huge maps (non-guns), scatter a few more props across the pad
    if (this.platformRadius > 40) {
      const R = this.platformRadius * 0.55;
      const extra = ["#5ce1ff", "#d6ff4a", "#c77dff", "#ff9e00", "#80ffdb", "#ff7ad9"];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + 0.4;
        const r = R * (0.2 + (i % 4) * 0.18);
        spots.push([Math.cos(a) * r, Math.sin(a) * r, extra[i % extra.length]]);
      }
    }
    for (const [x, z, color] of spots) {
      if (!this.overAttachedPlatform(x, z, -0.4)) continue;
      if (useHillShards && !this.overAttachedPlatform(x, z)) continue;
      if (this.tooCloseToStructure(x, z, 4)) continue;
      const body = new CANNON.Body({
        mass: 7.5,
        material: this.boxMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.7, 0.85, 0.7)),
        position: new CANNON.Vec3(x, PLATFORM_TOP + 0.85, z),
        linearDamping: 0.42,
        angularDamping: 0.55,
      });
      body.userData = { id: this.boxNextId++, color, spawnX: x, spawnZ: z, kind: "crate" };
      this.world.addBody(body);
      this.boxes.push(body);
      if (this.boxes.length >= (this.platformRadius > 40 ? 16 : 3)) break;
    }
    }
  }

  clearStructures() {
    for (const b of this.structures || []) this.world.removeBody(b);
    this.structures = [];
  }

  tooCloseToStructure(x, z, minDist, list = null) {
    const arr = list || this.layout?.structures || [];
    for (const s of arr) {
      if (s.kind === "road") continue;
      const pad =
        s.kind === "building" || s.kind === "car"
          ? Math.max(s.w || 0, s.d || 0) * 0.55
          : (s.r || 2) + 1;
      if (Math.hypot(x - s.x, z - s.z) < minDist + pad) return true;
    }
    return false;
  }

  /** City blocks + trees for the guns map (solid buildings — no walking through walls). */
  spawnBattlefieldDecor() {
    this.clearStructures();
    this.ladders = [];
    const items = [];
    const lowModels = [
      "1Story",
      "1Story_Sign",
      "2Story",
      "2Story_Balcony",
      "2Story_Wide",
      "2Story_Wide_2Doors",
      "3Story_Balcony",
      "3Story_Slim",
    ];
    const skyModels = [
      "4Story",
      "4Story_Center",
      "4Story_Wide_2Doors",
      "6Story_Stack",
      "3Story_Balcony",
    ];
    const treeModels = [
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
    let n = 0;
    // City grid: building footprints with street gaps between blocks
    const cell = 28;
    const street = 12;
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        // Open plaza in the middle for fights / spawns
        if (Math.abs(ix) <= 1 && Math.abs(iz) <= 1) continue;
        const x = ix * (cell + street) + ((ix * 3 + iz) % 5) - 2;
        const z = iz * (cell + street) + ((ix + iz * 5) % 5) - 2;
        if (Math.hypot(x, z) < 28) continue;
        if (Math.abs(x) > 135 || Math.abs(z) > 135) continue;
        const tall = (n + ix + iz) % 4 === 0;
        const model = tall
          ? skyModels[n % skyModels.length]
          : lowModels[n % lowModels.length];
        const w = tall ? 16 + (n % 3) * 2 : 12 + (n % 4);
        const d = tall ? 14 + ((n * 2) % 3) * 2 : 11 + ((n * 3) % 4);
        const h = tall ? 22 + (n % 5) * 5 : 9 + (n % 5) * 2.5;
        items.push({
          id: n,
          kind: "building",
          model,
          tall: !!tall,
          x,
          z,
          w,
          d,
          h,
          rotY: ((n % 4) * 90) * (Math.PI / 180),
          color: "#c8d0d8",
          solid: true,
        });
        n++;
      }
    }
    // Street trees along grid lines
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2 + i * 0.11;
      const rr = 30 + (i % 9) * 12;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (Math.abs(x) > 140 || Math.abs(z) > 140) continue;
      if (this.tooCloseToStructure(x, z, 7, items)) continue;
      items.push({
        id: n++,
        kind: "tree",
        model: treeModels[i % treeModels.length],
        x,
        z,
        r: 2.0 + (i % 4) * 0.45,
        h: 6 + (i % 5) * 1.2,
        color: i % 2 === 0 ? "#3ecf6a" : "#2aad52",
      });
    }

    // Continuous Kenney road grid (tiles abut — no gaps)
    const TILE = 10;
    const grid = cell + street; // 40
    for (let ix = -4; ix <= 4; ix++) {
      const x = ix * grid;
      for (let z = -140; z <= 140; z += TILE) {
        if (Math.abs(x) > 140 || Math.abs(z) > 140) continue;
        if (Math.hypot(x, z) < 18) continue;
        const onCross = Math.abs(((z % grid) + grid) % grid) < 0.01 || Math.abs((((z % grid) + grid) % grid) - grid) < 0.01;
        items.push({
          id: n++,
          kind: "road",
          model: onCross ? "road_crossroad" : "road_straight",
          x,
          z,
          w: TILE,
          d: TILE,
          rotY: 0,
        });
      }
    }
    for (let iz = -4; iz <= 4; iz++) {
      const z = iz * grid;
      for (let x = -140; x <= 140; x += TILE) {
        if (Math.abs(x) > 140 || Math.abs(z) > 140) continue;
        if (Math.hypot(x, z) < 18) continue;
        // Skip cells already covered by N–S roads
        const onVert = Math.abs(((x % grid) + grid) % grid) < 0.01 || Math.abs((((x % grid) + grid) % grid) - grid) < 0.01;
        if (onVert) continue;
        items.push({
          id: n++,
          kind: "road",
          model: "road_straight",
          x,
          z,
          w: TILE,
          d: TILE,
          rotY: Math.PI / 2,
        });
      }
    }

    // Driveable cars parked along roads
    const carModels = ["BasicCar", "Taxi", "CopCar", "SimpleCarShort", "RaceCar"];
    const carSpawns = [];
    for (let i = 0; i < 24; i++) {
      const alongNS = i % 2 === 0;
      const lane = ((i / 2) | 0) - 5;
      const x = alongNS ? lane * grid + 6 : (lane * grid);
      const z = alongNS ? (lane % 5) * grid + 8 : lane * grid + 6;
      if (Math.abs(x) > 125 || Math.abs(z) > 125) continue;
      if (Math.hypot(x, z) < 28) continue;
      if (this.tooCloseToStructure(x, z, 5, items)) continue;
      carSpawns.push({
        model: carModels[i % carModels.length],
        x,
        z,
        w: 4.2,
        h: 1.55,
        d: 2.0,
        rotY: alongNS ? 0 : Math.PI / 2,
        color: ["#d64545", "#f0c418", "#2a5caa", "#6b7280", "#c0392b"][i % 5],
      });
    }

    // Soft hills at map edges (visual + walkable slope)
    const hills = [
      { x: -118, z: -110, r: 22, h: 9, color: "#4a7c46" },
      { x: 120, z: -95, r: 18, h: 7, color: "#3f6f42" },
      { x: -105, z: 115, r: 20, h: 8, color: "#557a48" },
      { x: 112, z: 108, r: 16, h: 6.5, color: "#466b40" },
    ];
    for (const hill of hills) {
      items.push({ id: n++, kind: "hill", ...hill });
    }

    this.layout.structures = items;
    this.layoutKey += `|city2:${items.length}:b${items.filter((s) => s.kind === "building").length}:v${carSpawns.length}:r${items.filter((s) => s.kind === "road").length}`;

    for (const s of items) {
      if (s.kind === "building") {
        this.buildSolidBuilding(s);
      } else if (s.kind === "hill") {
        const body = new CANNON.Body({
          mass: 0,
          type: CANNON.Body.STATIC,
          material: this.groundMat,
        });
        const r = s.r || 14;
        const h = s.h || 6;
        body.addShape(new CANNON.Sphere(r * 0.95));
        body.position.set(s.x, PLATFORM_TOP - r * 0.95 + h * 0.55, s.z);
        body.userData = { kind: "hill", id: s.id, static: true };
        this.world.addBody(body);
        this.structures.push(body);
      } else if (s.kind === "road") {
        // Visual only — asphalt pad already walkable
      } else {
        const body = new CANNON.Body({
          mass: 0,
          type: CANNON.Body.STATIC,
          material: this.boxMat,
        });
        const trunkH = s.h * 0.55;
        const canopyR = s.r;
        body.addShape(new CANNON.Cylinder(0.35, 0.45, trunkH, 8), new CANNON.Vec3(0, trunkH * 0.5, 0));
        body.addShape(new CANNON.Sphere(canopyR * 0.85), new CANNON.Vec3(0, trunkH + canopyR * 0.55, 0));
        body.position.set(s.x, PLATFORM_TOP, s.z);
        body.userData = { kind: s.kind, id: s.id, static: true };
        this.world.addBody(body);
        this.structures.push(body);
      }
    }

    this.spawnDriveableCars(carSpawns);
  }

  spawnDriveableCars(spawns) {
    for (const v of this.vehicles || []) this.world.removeBody(v);
    this.vehicles = [];
    for (const s of spawns || []) {
      const hw = (s.w || 4.2) * 0.5;
      const hh = 0.42; // low collider — keeps body above asphalt
      const hd = (s.d || 2.0) * 0.5;
      const body = new CANNON.Body({
        mass: 90,
        material: this.boxMat,
        shape: new CANNON.Box(new CANNON.Vec3(hw, hh, hd)),
        position: new CANNON.Vec3(s.x, PLATFORM_TOP + hh + 0.06, s.z),
        linearDamping: 0.08,
        angularDamping: 0.98,
        fixedRotation: true,
      });
      const yaw = s.rotY || 0;
      body.quaternion.setFromEuler(0, yaw, 0);
      body.userData = {
        id: this.debrisNextId++,
        kind: "vehicle",
        model: s.model || "BasicCar",
        color: s.color || "#c44",
        sx: s.w || 4.2,
        sy: s.h || 1.55,
        sz: s.d || 2.0,
        yaw,
        speed: 0,
        driverId: null,
        rideY: PLATFORM_TOP + hh + 0.06,
      };
      this.world.addBody(body);
      this.vehicles.push(body);
    }
  }

  /** Solid textured city block — walls block players/bullets; roof is walkable; ladder on +Z. */
  buildSolidBuilding(s) {
    const hw = (s.w || 12) * 0.5;
    const hd = (s.d || 12) * 0.5;
    const h = s.h || 12;
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.groundMat,
    });
    // Main volume: cannot walk through walls
    body.addShape(new CANNON.Box(new CANNON.Vec3(hw, h * 0.5, hd)));
    body.position.set(s.x, PLATFORM_TOP + h * 0.5, s.z);
    if (s.rotY) body.quaternion.setFromEuler(0, s.rotY, 0);
    body.userData = { kind: "building", id: s.id, static: true, solid: true };
    this.world.addBody(body);
    this.structures.push(body);

    // Thin roof lip slightly above the box so landing feels solid
    const roof = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.groundMat,
    });
    roof.addShape(new CANNON.Box(new CANNON.Vec3(hw + 0.15, 0.2, hd + 0.15)));
    roof.position.set(s.x, PLATFORM_TOP + h + 0.2, s.z);
    if (s.rotY) roof.quaternion.setFromEuler(0, s.rotY, 0);
    roof.userData = { kind: "building", id: s.id, static: true, roof: true };
    this.world.addBody(roof);
    this.structures.push(roof);

    // Ladder on local +Z face
    const c = Math.cos(s.rotY || 0);
    const sn = Math.sin(s.rotY || 0);
    const lx = 0;
    const lz = hd + 0.55;
    const lp = { x: s.x + lx * c - lz * sn, z: s.z + lx * sn + lz * c };
    const ladderBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.boxMat,
    });
    ladderBody.addShape(new CANNON.Box(new CANNON.Vec3(0.55, h * 0.5, 0.12)));
    ladderBody.position.set(lp.x, PLATFORM_TOP + h * 0.5, lp.z);
    if (s.rotY) ladderBody.quaternion.setFromEuler(0, s.rotY, 0);
    ladderBody.userData = { kind: "ladder", id: s.id, static: true };
    this.world.addBody(ladderBody);
    this.structures.push(ladderBody);
    this.ladders.push({
      x: lp.x,
      z: lp.z,
      y0: PLATFORM_TOP,
      y1: PLATFORM_TOP + h + 0.5,
      r: 1.45,
    });
  }

  /** @deprecated hollow interiors — kept unused; solid city buildings replace this */
  buildHollowBuilding(s) {
    this.buildSolidBuilding(s);
  }

  tickSniperDrop(dt) {
    if (this.mode !== "guns" || this.phase !== "playing") return;
    this.sniperSpawnT -= dt;
    if (this.sniperSpawnT > 0) return;
    this.sniperSpawnT = 60;
    if (this.snipers.length >= 2) return;
    const ang = Math.random() * Math.PI * 2;
    const rr = 20 + Math.random() * 100;
    let x = Math.cos(ang) * rr;
    let z = Math.sin(ang) * rr;
    if (this.tooCloseToStructure(x, z, 4)) {
      x = Math.cos(ang + 1) * (rr * 0.7);
      z = Math.sin(ang + 1) * (rr * 0.7);
    }
    const body = new CANNON.Body({
      mass: 2,
      material: this.boxMat,
      shape: new CANNON.Box(new CANNON.Vec3(0.55, 0.18, 0.18)),
      position: new CANNON.Vec3(x, 28 + Math.random() * 10, z),
      linearDamping: 0.1,
      angularDamping: 0.3,
    });
    body.velocity.set(0, -4, 0);
    body.userData = {
      id: this.debrisNextId++,
      kind: "sniper",
      color: "#1f2937",
      sx: 1.1,
      sy: 0.36,
      sz: 0.36,
    };
    this.world.addBody(body);
    this.snipers.push(body);
    this.events.push({ type: "sniperDrop", id: body.userData.id });
  }

  pickupSnipers() {
    for (let i = this.snipers.length - 1; i >= 0; i--) {
      const gun = this.snipers[i];
      if (gun.position.y < -8) {
        this.world.removeBody(gun);
        this.snipers.splice(i, 1);
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const dx = p.body.position.x - gun.position.x;
        const dy = p.body.position.y - gun.position.y;
        const dz = p.body.position.z - gun.position.z;
        if (Math.hypot(dx, dy, dz) < 1.8) {
          p.weapon = "sniper";
          p.hasSniper = true;
          p.ammo = (p.ammo || 0) + 5;
          this.world.removeBody(gun);
          this.snipers.splice(i, 1);
          this.events.push({ type: "sniperPickup", id: p.id, by: p.name });
          break;
        }
      }
    }
  }

  applyLadderClimb(dt) {
    if (!this.ladders?.length) return;
    for (const p of this.players.values()) {
      if (!p.alive || p.vehicleId) continue;
      const pos = p.body.position;
      let on = null;
      for (const L of this.ladders) {
        if (Math.hypot(pos.x - L.x, pos.z - L.z) <= L.r && pos.y >= L.y0 - 0.4 && pos.y <= L.y1 + 0.6) {
          on = L;
          break;
        }
      }
      if (!on) continue;
      const climb = (p.input.mz || 0) > 0.15 || p.input.jump;
      const down = (p.input.mz || 0) < -0.15;
      if (climb) {
        p.body.velocity.y = Math.max(p.body.velocity.y, 7.5);
        p.body.velocity.x *= 0.4;
        p.body.velocity.z *= 0.4;
        p.body.wakeUp();
      } else if (down) {
        p.body.velocity.y = Math.min(p.body.velocity.y, -4);
      } else if (pos.y > on.y0 + 0.8 && pos.y < on.y1 - 0.3) {
        p.body.velocity.y *= 0.5;
      }
    }
  }

  /** Rebuild arena for current arenaId (resolves random each call). */
  buildArena() {
    this.applyLayout(resolveArenaLayout(this.arenaId));
  }

  /** Hill: irregular glass shards (rings × random sectors) forming one disk. */
  buildHillShards(radius) {
    this.clearGrounds();
    this.platformRadius = radius;
    this.shards = [];
    const layout = generateGlassShatter(radius);
    for (const def of layout) {
      // Body at shard centroid so detach rotates around the piece, not disk origin
      const { shape, offset, quat } = makeShardBox(def, PLATFORM_HEIGHT);
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: this.groundMat,
        position: new CANNON.Vec3(def.cx, 0, def.cz),
      });
      body.addShape(shape, offset, quat);
      body.userData = { shardId: def.id };
      this.world.addBody(body);
      this.shards.push({
        id: def.id,
        ring: def.ring,
        a0: def.a0,
        a1: def.a1,
        rInner: def.rInner,
        rOuter: def.rOuter,
        radius,
        poly: def.poly,
        cx: def.cx,
        cz: def.cz,
        body,
        attached: true,
      });
    }
  }

  overAttachedPlatform(x, z, slack = 0.15) {
    const r = Math.hypot(x, z);
    if (this.mode === "hill" && this.shards.length) {
      if (r > this.platformRadius + slack) return false;
      const ang = Math.atan2(x, z); // matches (sin θ, cos θ) → θ = atan2(x, z)
      return this.shards.some((s) => {
        if (!s.attached) return false;
        if (r > s.rOuter + slack) return false;
        if (r < Math.max(0, s.rInner - slack)) return false;
        return angleInSector(ang, s.a0, s.a1);
      });
    }
    if (this.layout?.pieces?.length) {
      return pointOverLayout(x, z, this.layout.pieces, slack);
    }
    return r <= this.platformRadius + slack;
  }

  spawnDebris() {
    if (this.mode === "guns") return;
    if (this.debris.length >= this.maxDebris) return;
    const kinds = ["box", "box", "box", "sphere", "cylinder"];
    const kind = kinds[(Math.random() * kinds.length) | 0];
    const palette = [...COLORS, "#5ce1ff", "#ff7ad9", "#fff1a8", "#ff9e00", "#c77dff"];
    const color = palette[(Math.random() * palette.length) | 0];
    const hugeMap = this.mode === "guns" || this.platformRadius > 40;
    // House-sized chunks often on big maps; still chunky elsewhere
    const house = hugeMap ? Math.random() < 0.62 : Math.random() < 0.12;

    let x;
    let z;
    const pieces = this.layout?.pieces;
    if (pieces?.length) {
      const p = pieces[(Math.random() * pieces.length) | 0];
      const ang = Math.random() * Math.PI * 2;
      if (p.t === "cyl" || p.t === "tri") {
        const rr = p.r * (0.15 + Math.random() * 0.7);
        x = p.x + Math.cos(ang) * rr;
        z = p.z + Math.sin(ang) * rr;
      } else {
        x = p.x + (Math.random() - 0.5) * p.w * 0.7;
        z = p.z + (Math.random() - 0.5) * p.d * 0.7;
      }
    } else {
      const ang = Math.random() * Math.PI * 2;
      const r = this.platformRadius * (0.12 + Math.random() * 0.7);
      x = Math.cos(ang) * r;
      z = Math.sin(ang) * r;
    }
    if (this.tooCloseToStructure(x, z, house ? 8 : 3)) return;
    const y = house ? 42 + Math.random() * 38 : (hugeMap ? 22 : 13) + Math.random() * (hugeMap ? 16 : 7);

    let shape;
    let sx;
    let sy;
    let sz;
    let mass;
    if (house) {
      // ~house footprint: 6–14 m wide, 5–12 m tall
      const hx = 3.2 + Math.random() * 4.2;
      const hy = 2.6 + Math.random() * 3.8;
      const hz = 3.2 + Math.random() * 4.2;
      shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
      sx = hx * 2;
      sy = hy * 2;
      sz = hz * 2;
      mass = 80 + hx * hy * hz * 4;
    } else if (kind === "sphere") {
      const scale = hugeMap ? 2.2 + Math.random() * 2.5 : 1;
      const rad = (0.52 + Math.random() * 0.85) * scale;
      shape = new CANNON.Sphere(rad);
      sx = rad;
      sy = rad;
      sz = rad;
      mass = 2.2 + rad * 5;
    } else if (kind === "cylinder") {
      const scale = hugeMap ? 2.2 + Math.random() * 2.5 : 1;
      const rad = (0.42 + Math.random() * 0.65) * scale;
      const h = (0.85 + Math.random() * 1.5) * scale;
      shape = cylinder(rad, rad, h, 12);
      sx = rad;
      sy = h;
      sz = rad;
      mass = 2.8 + rad * h * 5;
    } else {
      const scale = hugeMap ? 2.4 + Math.random() * 3.2 : 1.2 + Math.random() * 0.8;
      const hx = (0.45 + Math.random() * 0.85) * scale;
      const hy = (0.45 + Math.random() * 0.85) * scale;
      const hz = (0.45 + Math.random() * 0.85) * scale;
      shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
      sx = hx * 2;
      sy = hy * 2;
      sz = hz * 2;
      mass = 2.5 + hx * hy * hz * 10;
    }

    const body = new CANNON.Body({
      mass,
      material: this.boxMat,
      shape,
      position: new CANNON.Vec3(x, y, z),
      linearDamping: house ? 0.06 : 0.12,
      angularDamping: house ? 0.1 : 0.18,
    });
    body.velocity.set((Math.random() - 0.5) * 4, -2 - Math.random() * 3, (Math.random() - 0.5) * 4);
    body.angularVelocity.set(
      (Math.random() - 0.5) * (house ? 1.2 : 4),
      (Math.random() - 0.5) * (house ? 1.2 : 4),
      (Math.random() - 0.5) * (house ? 1.2 : 4),
    );
    body.userData = { id: this.debrisNextId++, kind: house ? "box" : kind, color, sx, sy, sz, house: !!house };
    this.world.addBody(body);
    this.debris.push(body);
  }

  /** Heavy chaos goat from the sky — rams players and props. */
  spawnGoat() {
    if (this.goats.length >= this.maxGoats) return;
    let x;
    let z;
    const pieces = this.layout?.pieces;
    if (pieces?.length) {
      const p = pieces[(Math.random() * pieces.length) | 0];
      const ang = Math.random() * Math.PI * 2;
      if (p.t === "cyl" || p.t === "tri") {
        const rr = p.r * (0.1 + Math.random() * 0.75);
        x = p.x + Math.cos(ang) * rr;
        z = p.z + Math.sin(ang) * rr;
      } else {
        x = p.x + (Math.random() - 0.5) * p.w * 0.75;
        z = p.z + (Math.random() - 0.5) * p.d * 0.75;
      }
    } else {
      const ang = Math.random() * Math.PI * 2;
      const r = this.platformRadius * (0.1 + Math.random() * 0.65);
      x = Math.cos(ang) * r;
      z = Math.sin(ang) * r;
    }
    const y = 14 + Math.random() * 6;
    // Standing goat collision (body + legs)
    const hx = 0.45;
    const hy = 0.72;
    const hz = 0.85;
    const body = new CANNON.Body({
      mass: 28,
      material: this.goatMat,
      shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
      position: new CANNON.Vec3(x, y, z),
      linearDamping: 0.04,
      angularDamping: 0.95,
      fixedRotation: true,
    });
    body.velocity.set(0, -4 - Math.random() * 2, 0);
    body.userData = {
      id: this.debrisNextId++,
      kind: "goat",
      color: "#c4a574",
      sx: hx * 2,
      sy: hy * 2,
      sz: hz * 2,
      yaw: Math.random() * Math.PI * 2,
      hp: 60,
    };
    // Cannon may not retain arbitrary fields on some paths — mirror on body
    body.goat = true;
    this.world.addBody(body);
    this.goats.push(body);
    this.events.push({ type: "goat", id: body.userData.id });
  }

  spawnMedkit() {
    if (this.mode !== "guns") return;
    if (this.medkits.length >= this.maxMedkits) return;
    let x;
    let z;
    const pieces = this.layout?.pieces;
    if (pieces?.length) {
      const p = pieces[(Math.random() * pieces.length) | 0];
      const ang = Math.random() * Math.PI * 2;
      if (p.t === "cyl" || p.t === "tri") {
        const rr = p.r * (0.15 + Math.random() * 0.7);
        x = p.x + Math.cos(ang) * rr;
        z = p.z + Math.sin(ang) * rr;
      } else {
        x = p.x + (Math.random() - 0.5) * p.w * 0.7;
        z = p.z + (Math.random() - 0.5) * p.d * 0.7;
      }
    } else {
      const ang = Math.random() * Math.PI * 2;
      const r = this.platformRadius * (0.2 + Math.random() * 0.55);
      x = Math.cos(ang) * r;
      z = Math.sin(ang) * r;
    }
    const body = new CANNON.Body({
      mass: 1.2,
      material: this.boxMat,
      shape: new CANNON.Box(new CANNON.Vec3(0.35, 0.28, 0.35)),
      position: new CANNON.Vec3(x, 12 + Math.random() * 6, z),
      linearDamping: 0.15,
      angularDamping: 0.4,
    });
    body.velocity.set(0, -2, 0);
    body.userData = {
      id: this.debrisNextId++,
      kind: "medkit",
      color: "#2ecc71",
      sx: 0.7,
      sy: 0.56,
      sz: 0.7,
    };
    this.world.addBody(body);
    this.medkits.push(body);
    this.events.push({ type: "medkitDrop", id: body.userData.id });
  }

  pickupMedkits() {
    for (let i = this.medkits.length - 1; i >= 0; i--) {
      const kit = this.medkits[i];
      if (kit.position.y < -8) {
        this.world.removeBody(kit);
        this.medkits.splice(i, 1);
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const dx = p.body.position.x - kit.position.x;
        const dy = p.body.position.y - kit.position.y;
        const dz = p.body.position.z - kit.position.z;
        if (Math.hypot(dx, dy, dz) < 1.6) {
          const before = p.hp ?? 100;
          p.hp = Math.min(100, before + 40);
          this.world.removeBody(kit);
          this.medkits.splice(i, 1);
          this.events.push({ type: "medkit", id: p.id, by: p.name, hp: p.hp });
          break;
        }
      }
    }
  }

  spawnAmmoPack() {
    if (this.mode !== "guns") return;
    if ((this.ammoPacks || []).length >= this.maxAmmoPacks) return;
    const ang = Math.random() * Math.PI * 2;
    const rr = 18 + Math.random() * 110;
    let x = Math.cos(ang) * rr;
    let z = Math.sin(ang) * rr;
    if (this.tooCloseToStructure(x, z, 3.5)) {
      x = Math.cos(ang + 0.8) * (rr * 0.65);
      z = Math.sin(ang + 0.8) * (rr * 0.65);
    }
    const body = new CANNON.Body({
      mass: 1.1,
      material: this.boxMat,
      shape: new CANNON.Box(new CANNON.Vec3(0.32, 0.22, 0.42)),
      position: new CANNON.Vec3(x, 14 + Math.random() * 8, z),
      linearDamping: 0.12,
      angularDamping: 0.35,
    });
    body.velocity.set(0, -3, 0);
    body.userData = {
      id: this.debrisNextId++,
      kind: "ammo",
      color: "#f0c14a",
      sx: 0.64,
      sy: 0.44,
      sz: 0.84,
      amount: 12,
    };
    this.world.addBody(body);
    this.ammoPacks.push(body);
    this.events.push({ type: "ammoDrop", id: body.userData.id });
  }

  pickupAmmo() {
    for (let i = this.ammoPacks.length - 1; i >= 0; i--) {
      const pack = this.ammoPacks[i];
      if (pack.position.y < -8) {
        this.world.removeBody(pack);
        this.ammoPacks.splice(i, 1);
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const dx = p.body.position.x - pack.position.x;
        const dy = p.body.position.y - pack.position.y;
        const dz = p.body.position.z - pack.position.z;
        if (Math.hypot(dx, dy, dz) < 1.7) {
          const add = pack.userData?.amount || 12;
          p.ammo = Math.min(90, (p.ammo || 0) + add);
          this.world.removeBody(pack);
          this.ammoPacks.splice(i, 1);
          this.events.push({ type: "ammo", id: p.id, by: p.name, ammo: p.ammo });
          break;
        }
      }
    }
  }

  /** Steer goats: idle until a player is within 20 m, then sprint-charge. */
  steerGoats(dt) {
    if (!this.goats.length) return;
    const chaseRange = 20;
    for (const g of this.goats) {
      const ud = g.userData;
      let tx = null;
      let tz = null;
      let best = Infinity;
      for (const p of this.players.values()) {
        if (!p.alive && this.phase === "playing") continue;
        const dx = p.body.position.x - g.position.x;
        const dz = p.body.position.z - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < best) {
          best = d;
          tx = dx;
          tz = dz;
        }
      }
      const chasing = tx != null && best < chaseRange;
      // Still falling from the sky — don't wander, just settle
      const airborne = g.position.y > PLATFORM_TOP + 1.6 || g.velocity.y < -2.5;
      if (!chasing || airborne) {
        g.velocity.x *= airborne ? 0.92 : 0.15;
        g.velocity.z *= airborne ? 0.92 : 0.15;
        if (!airborne) {
          g.velocity.x = 0;
          g.velocity.z = 0;
        }
        if (g.velocity.y < 0) g.velocity.y *= 0.92;
        if (g.position.y < 2.2 && g.velocity.y > 0 && g.velocity.y < 6) {
          g.velocity.y *= 0.15;
        }
        g.quaternion.setFromEuler(0, ud.yaw || 0, 0);
        continue;
      }

      const inv = best > 0.15 ? 1 / best : 0;
      const wishX = tx * inv;
      const wishZ = tz * inv;
      const walkSpeed = 16.5;
      g.velocity.x = wishX * walkSpeed;
      g.velocity.z = wishZ * walkSpeed;
      if (g.velocity.y < 0) g.velocity.y *= 0.92;
      if (g.position.y < 2.2 && g.velocity.y > 0 && g.velocity.y < 6) {
        g.velocity.y *= 0.15;
      }
      if (Math.hypot(wishX, wishZ) > 0.05) {
        ud.yaw = Math.atan2(-wishX, -wishZ);
      }
      g.quaternion.setFromEuler(0, ud.yaw || 0, 0);
      g.wakeUp();

      if (best < 1.85) {
        for (const p of this.players.values()) {
          if (!p.alive && this.phase === "playing") continue;
          const dx = p.body.position.x - g.position.x;
          const dy = p.body.position.y - g.position.y;
          const dz = p.body.position.z - g.position.z;
          if (Math.hypot(dx, dy, dz) > 2.1) continue;
          this.yeetPlayerByGoat(p, g);
        }
      }
    }
  }

  yeetPlayerByGoat(player, goat) {
    const ud = goat.userData;
    if ((ud.lastHitT || 0) + 0.35 > this.roundT) return;
    ud.lastHitT = this.roundT;
    const gx = goat.velocity.x;
    const gz = goat.velocity.z;
    const spd = Math.hypot(gx, gz);
    let dx;
    let dz;
    if (spd > 1.2) {
      dx = gx / spd;
      dz = gz / spd;
    } else {
      dx = player.body.position.x - goat.position.x;
      dz = player.body.position.z - goat.position.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
    }
    const pb = player.body;
    const kick = 26 + Math.min(10, spd * 0.35);
    pb.velocity.x += dx * kick;
    pb.velocity.z += dz * kick;
    pb.velocity.y += 10;
    pb.wakeUp();
    goat.velocity.x *= 0.75;
    goat.velocity.z *= 0.75;
    goat.wakeUp();
    this.events.push({ type: "goatHit", id: player.id });
  }

  /** Kick oldest debris off the list so rim chunks always fit. */
  freeDebrisSlot() {
    while (this.debris.length >= this.maxDebris) {
      const old = this.debris.shift();
      if (old) this.world.removeBody(old);
    }
  }

  /**
   * Hill only: detach one whole outer-ring glass shard (no smash into bits).
   * Settle down a crack gap, then slide flat radially into the void.
   */
  breakOffShard() {
    const attached = this.shards.filter((s) => s.attached);
    if (attached.length <= HILL_MIN_SHARDS) return;
    const outerRing = Math.min(...attached.map((s) => s.ring));
    const candidates = attached.filter((s) => s.ring === outerRing);
    const shard = candidates[(Math.random() * candidates.length) | 0];
    shard.attached = false;
    const body = shard.body;
    const area =
      Math.max(0.2, shard.rOuter * shard.rOuter - shard.rInner * shard.rInner) *
      Math.max(0.08, Math.abs(shard.a1 - shard.a0));
    body.type = CANNON.Body.DYNAMIC;
    body.mass = Math.max(18, Math.min(90, area * 2.8));
    body.linearDamping = 0.06;
    body.angularDamping = 0.92;
    body.updateMassProperties();
    body.wakeUp();
    // Keep flat — no tumble into a vertical wall
    body.quaternion.set(0, 0, 0, 1);
    body.angularVelocity.set(
      (Math.random() - 0.5) * 0.06,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.06,
    );
    // Crack gap: drop a few pixels, then slide outward on XZ
    body.position.y = -0.045;
    const len = Math.hypot(body.position.x, body.position.z) || 1;
    const ox = body.position.x / len;
    const oz = body.position.z / len;
    const out = 3.2 + Math.random() * 1.6;
    body.velocity.set(ox * out, -0.45 - Math.random() * 0.25, oz * out);
    this.events.push({ type: "shard", id: shard.id });
  }

  removeFallenProps() {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const box = this.boxes[i];
      const offDisk =
        !this.overAttachedPlatform(box.position.x, box.position.z, 0.9) && box.position.y < 0.8;
      if (box.position.y < -2 || offDisk) {
        this.world.removeBody(box);
        this.boxes.splice(i, 1);
      }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      if (d.position.y < -8) {
        this.world.removeBody(d);
        this.debris.splice(i, 1);
      }
    }
    for (let i = this.goats.length - 1; i >= 0; i--) {
      const g = this.goats[i];
      if (g.position.y < -15) {
        this.world.removeBody(g);
        this.goats.splice(i, 1);
      }
    }
    for (let i = (this.vehicles || []).length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.position.y < -12) {
        if (v.userData.driverId) {
          const p = this.players.get(v.userData.driverId);
          if (p) this.exitVehicle(p, false);
        }
        this.world.removeBody(v);
        this.vehicles.splice(i, 1);
      }
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      if (!s.attached && s.body.position.y < -14) {
        this.world.removeBody(s.body);
        this.shards.splice(i, 1);
      }
    }
  }

  rebuildGroundPhysics(pieces) {
    this.clearShards();
    this.clearGrounds();
    for (const p of pieces) {
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: this.groundMat,
      });
      const h = p.h || PLATFORM_HEIGHT;
      if (p.t === "cyl") {
        body.addShape(cylinder(p.r, p.r, h, 28));
      } else if (p.t === "tri") {
        body.addShape(makeTrianglePrism(p.r, h));
      } else {
        body.addShape(new CANNON.Box(new CANNON.Vec3(p.w * 0.5, h * 0.5, p.d * 0.5)));
        if (p.rotY) body.quaternion.setFromEuler(0, p.rotY, 0);
      }
      body.position.set(p.x, 0, p.z);
      this.world.addBody(body);
      this.grounds.push(body);
    }
    this.platform = this.grounds[0] || null;
  }

  colorForIndex(i) {
    return COLORS[i % COLORS.length];
  }

  spawnPos(index, count) {
    const pos = this.randomMapSpawn();
    if (pos) return pos;
    // Fallback: ring near center
    const n = Math.max(count || this.players.size || 1, 1);
    const i = Math.max(index || 0, 0);
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = Math.min(8, this.platformRadius * 0.45);
    return new CANNON.Vec3(Math.cos(ang) * r, 2.4, Math.sin(ang) * r);
  }

  /** Random walkable point on the current map, away from buildings/trees/other players. */
  randomMapSpawn(minPlayerDist = 8) {
    const pieces = this.layout?.pieces;
    const others = [...this.players.values()].map((p) => p.body.position);
    const margin = this.platformRadius > 40 ? 12 : 1.2;
    const farFromOthers = (x, z) => {
      const need = this.platformRadius > 40 ? Math.max(minPlayerDist, 14) : Math.max(2.5, minPlayerDist * 0.35);
      for (const o of others) {
        if (Math.hypot(x - o.x, z - o.z) < need) return false;
      }
      return true;
    };

    for (let attempt = 0; attempt < 48; attempt++) {
      let x;
      let z;
      if (pieces?.length) {
        const p = pieces[(Math.random() * pieces.length) | 0];
        if (p.t === "cyl" || p.t === "tri") {
          const ang = Math.random() * Math.PI * 2;
          const rr = Math.max(0.2, p.r - margin) * Math.sqrt(Math.random());
          x = p.x + Math.cos(ang) * rr;
          z = p.z + Math.sin(ang) * rr;
        } else {
          const hw = Math.max(0.5, p.w * 0.5 - margin);
          const hd = Math.max(0.5, p.d * 0.5 - margin);
          const lx = (Math.random() * 2 - 1) * hw;
          const lz = (Math.random() * 2 - 1) * hd;
          const c = Math.cos(p.rotY || 0);
          const s = Math.sin(p.rotY || 0);
          x = p.x + lx * c + lz * s;
          z = p.z - lx * s + lz * c;
        }
      } else {
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.max(1, this.platformRadius - margin) * Math.sqrt(Math.random());
        x = Math.cos(ang) * rr;
        z = Math.sin(ang) * rr;
      }
      if (!this.overAttachedPlatform(x, z, 0.2)) continue;
      if (this.tooCloseToStructure(x, z, 3.5)) continue;
      if (!farFromOthers(x, z) && attempt < 36) continue;
      return new CANNON.Vec3(x, 2.4, z);
    }
    return null;
  }

  addPlayer(socket, name) {
    if (this.players.size >= 8) return { error: "Izba je plná (max 8)." };
    const clean = String(name || "").trim().slice(0, 16) || "Želé";
    const index = this.players.size;
    const pos = this.spawnPos(index, index + 1);
    const body = new CANNON.Body({
      mass: 4,
      material: this.playerMat,
      shape: new CANNON.Sphere(PLAYER_RADIUS),
      linearDamping: 0.04,
      angularDamping: 1,
      position: pos,
      fixedRotation: true,
    });
    body.ccdSpeedThreshold = 1;
    body.ccdSweptSphereRadius = PLAYER_RADIUS;
    this.world.addBody(body);

    const player = {
      id: socket.id,
      name: clean,
      color: this.colorForIndex(index),
      body,
      alive: true,
      input: { mx: 0, mz: 0, yaw: 0, pitch: 0, jump: false, punch: false, dash: false, sprint: false, shoot: false, grenade: false, grenadeCharge: 0, use: false },
      jumpHeld: false,
      useHeld: false,
      punchCd: 0,
      shootCd: 0,
      dashCd: 0,
      grenadeCd: 0,
      punchFlash: 0,
      shootFlash: 0,
      hp: 100,
      ammo: 20,
      weapon: "knife",
      hasSniper: false,
      lastHitBy: null,
      lastHitAt: 0,
      yaw: 0,
      vehicleId: null,
    };
    this.players.set(socket.id, player);
    this.scores.set(socket.id, this.scores.get(socket.id) || 0);
    if (!this.hostId) this.hostId = socket.id;
    socket.join(this.code);

    if (this.phase === "playing") {
      // late join – let them drop in and receive round state
      this.respawn(player, true);
      socket.emit("round", this.roundPayload());
    }
    this.broadcastLobby();
    return { ok: true };
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.exitVehicle(p, false);
    this.world.removeBody(p.body);
    this.players.delete(id);
    if (this.bombId === id) this.bombId = this.randomAliveId(id);
    if (this.hostId === id) {
      this.hostId = this.players.size ? [...this.players.keys()][0] : null;
    }
    if (this.players.size === 0) return "empty";
    this.broadcastLobby();
    if (this.phase === "playing") this.checkWin();
    return "ok";
  }

  setInput(id, data) {
    const p = this.players.get(id);
    if (!p) return;
    p.input.mx = clamp(Number(data.mx) || 0, -1, 1);
    p.input.mz = clamp(Number(data.mz) || 0, -1, 1);
    p.input.yaw = Number(data.yaw) || 0;
    p.input.pitch = clamp(Number(data.pitch) || 0, -1.52, 1.52);
    p.yaw = p.input.yaw;
    if (data.jump) p.input.jump = true;
    if (data.punch) p.input.punch = true;
    if (data.dash) p.input.dash = true;
    p.input.sprint = !!data.sprint;
    if (data.shoot) p.input.shoot = true;
    if (data.use) p.input.use = true;
    if (data.grenade) {
      p.input.grenade = true;
      p.input.grenadeCharge = clamp(Number(data.grenadeCharge) || 0.35, 0.12, 1);
    }
    const slot = Number(data.weaponSlot);
    if (slot === 1 || slot === 2 || slot === 3) {
      this.setWeaponSlot(p, slot);
    }
  }

  setWeaponSlot(p, slot) {
    if (slot === 1) p.weapon = "knife";
    else if (slot === 2) p.weapon = "pistol";
    else if (slot === 3 && p.hasSniper) p.weapon = "sniper";
  }

  setMode(id, mode) {
    if (id !== this.hostId || this.phase !== "lobby") return;
    if (!MODE_INFO[mode]) return;
    this.mode = mode;
    if (mode === "guns") {
      this.applyLayout(resolveArenaLayout("battlefield"), { playing: false });
      let i = 0;
      const n = this.players.size;
      for (const p of this.players.values()) {
        this.respawn(p, false, i, n);
        i++;
      }
    } else {
      this.buildArena();
      let i = 0;
      const n = this.players.size;
      for (const p of this.players.values()) {
        this.respawn(p, false, i, n);
        i++;
      }
    }
    this.broadcastLobby();
  }

  setArena(id, arenaId) {
    if (id !== this.hostId || this.phase !== "lobby") return;
    if (!ARENA_INFO[arenaId]) return;
    this.arenaId = arenaId;
    this.buildArena();
    let i = 0;
    const n = this.players.size;
    for (const p of this.players.values()) {
      this.respawn(p, false, i, n);
      i++;
    }
    this.broadcastLobby();
  }

  start(id) {
    if (id !== this.hostId) return;
    if (this.phase === "playing") return;
    if (this.players.size < 1) return;
    this.beginRound();
  }

  beginRound() {
    this.phase = "playing";
    this.winnerId = null;
    this.winnerName = null;
    this.roundT = 0;
    this.shrinkT = 0;
    this.bombTransferLock = 0;
    this.roundKills = 0;
    this.bullets = [];
    // Hill glass shards only work on the circle disk; other modes use selected arena.
    if (this.mode === "hill") {
      let layout = resolveArenaLayout("circle");
      const r = 8.5;
      layout = {
        ...layout,
        pieces: [{ ...layout.pieces[0], r }],
        radius: r,
        spawns: layout.spawns.map((s) => ({
          x: s.x * (r / 13),
          z: s.z * (r / 13),
        })),
      };
      this.applyLayout(layout, { playing: true });
      this.nextCrackT = 4 + Math.random() * 2.5;
    } else if (this.mode === "guns") {
      this.applyLayout(resolveArenaLayout("battlefield"), { playing: true });
      this.nextCrackT = Infinity;
    } else {
      this.buildArena();
      this.nextCrackT = Infinity;
    }
    // clear leftover medkits / ammo
    for (const m of this.medkits) this.world.removeBody(m);
    this.medkits = [];
    this.medkitSpawnT = 5 + Math.random() * 4;
    for (const a of this.ammoPacks || []) this.world.removeBody(a);
    this.ammoPacks = [];
    this.ammoSpawnT = 4 + Math.random() * 3;
    const list = [...this.players.values()];
    list.forEach((p, i) => {
      p.alive = true;
      p.hp = 100;
      p.ammo = 20;
      p.weapon = "knife";
      p.hasSniper = false;
      p.punchCd = 0;
      p.shootCd = 0;
      p.dashCd = 0;
      p.grenadeCd = 0;
      p.punchFlash = 0;
      p.shootFlash = 0;
      p.lastHitBy = null;
      this.respawn(p, false, i, list.length);
    });
    if (this.mode === "bomb") {
      this.bombId = this.randomAliveId();
      this.bombT = 9 + Math.random() * 5;
    } else {
      this.bombId = null;
      this.bombT = 0;
    }
    this.emit("round", this.roundPayload());
    this.broadcastLobby();
  }

  respawn(p, playingDrop, index, count) {
    this.exitVehicle(p, false);
    const i = index ?? [...this.players.keys()].indexOf(p.id);
    const n = count ?? this.players.size;
    const pos = this.spawnPos(Math.max(i, 0), n);
    p.body.position.copy(pos);
    p.body.velocity.set(0, 0, 0);
    p.body.angularVelocity.set(0, 0, 0);
    p.body.quaternion.set(0, 0, 0, 1);
    p.body.collisionResponse = true;
    p.body.wakeUp();
    if (playingDrop) p.alive = true;
  }

  randomAliveId(except) {
    const ids = [...this.players.values()].filter((p) => p.alive && p.id !== except).map((p) => p.id);
    if (!ids.length) return null;
    return ids[(Math.random() * ids.length) | 0];
  }

  isGrounded(body) {
    // cannon-es: ni points from bi → bj. Support from below = normal into the player (up).
    for (let i = 0; i < this.world.contacts.length; i++) {
      const c = this.world.contacts[i];
      if (c.bi !== body && c.bj !== body) continue;
      let ny = c.ni.y;
      if (c.bi === body) ny = -ny;
      if (ny > 0.35) return true;
    }
    // Fallback only for attached platform (contacts can miss a frame).
    const onPad = this.overAttachedPlatform(body.position.x, body.position.z, 0.4);
    return onPad && body.position.y <= PLAYER_REST_Y + 0.28 && body.velocity.y <= 1.2;
  }

  /** Keep sphere center on platform top + radius; kill dig/bounce into floor. */
  stabilizeOnPlatform(p) {
    const body = p.body;
    const { x, y, z } = body.position;
    if (!this.overAttachedPlatform(x, z, 0.15)) return;
    if (y > PLAYER_REST_Y + 0.55) return;
    if (y < PLAYER_REST_Y) {
      body.position.y = PLAYER_REST_Y;
      if (body.velocity.y < 0) body.velocity.y = 0;
    } else if (y < PLAYER_REST_Y + 0.08 && body.velocity.y < 0.35) {
      body.position.y = PLAYER_REST_Y;
      body.velocity.y = 0;
    }
  }

  /**
   * Flying boxes/debris knock players away. Uses prop approach speed along the
   * contact normal so standing on / walking into a resting cube does nothing.
   */
  applyPropHitKnockback() {
    const props = new Set([...this.boxes, ...this.debris, ...this.goats]);
    if (!props.size) return;
    const byBody = new Map();
    for (const p of this.players.values()) {
      if (p.alive || this.phase !== "playing") byBody.set(p.body, p);
    }
    if (!byBody.size) return;

    const hitPairs = new Set();
    for (let i = 0; i < this.world.contacts.length; i++) {
      const c = this.world.contacts[i];
      let player;
      let prop;
      let nx;
      let ny;
      let nz;
      if (byBody.has(c.bi) && props.has(c.bj)) {
        player = byBody.get(c.bi);
        prop = c.bj;
        // ni: bi → bj = player → prop; flip so normal points prop → player
        nx = -c.ni.x;
        ny = -c.ni.y;
        nz = -c.ni.z;
      } else if (byBody.has(c.bj) && props.has(c.bi)) {
        player = byBody.get(c.bj);
        prop = c.bi;
        nx = c.ni.x;
        ny = c.ni.y;
        nz = c.ni.z;
      } else {
        continue;
      }

      const isGoat = prop.userData?.kind === "goat";

      // Top/bottom contact (standing on a cube) — never yeet. Goats always ram.
      if (!isGoat && Math.abs(ny) > 0.72) continue;

      if (isGoat) {
        this.yeetPlayerByGoat(player, prop);
        continue;
      }

      // How fast the prop is moving into the player along the contact normal.
      const propInto = prop.velocity.x * nx + prop.velocity.y * ny + prop.velocity.z * nz;
      const minInto = 5.2;
      if (propInto < minInto) continue;

      const key = `${player.id}:${prop.id}`;
      if (hitPairs.has(key)) continue;
      hitPairs.add(key);

      const excess = propInto - minInto;
      const strength = Math.min(14, 5.5 + excess * 0.85);
      const hx = nx;
      const hz = nz;
      const hLen = Math.hypot(hx, hz);
      const inv = hLen > 0.12 ? 1 / hLen : 0;
      const dx = inv ? hx * inv : 0;
      const dz = inv ? hz * inv : 0;

      const pb = player.body;
      pb.velocity.x += dx * strength;
      pb.velocity.z += dz * strength;
      pb.velocity.y += Math.min(5.5, 1.2 + excess * 0.22);
      pb.wakeUp();

      prop.velocity.x -= dx * strength * 0.28;
      prop.velocity.z -= dz * strength * 0.28;
      prop.velocity.y += 0.8;
      prop.wakeUp();
    }
  }

  approach(cur, target, maxDelta) {
    const d = target - cur;
    if (Math.abs(d) <= maxDelta) return target;
    return cur + Math.sign(d) * maxDelta;
  }

  step(dt) {
    if (this.players.size === 0) return;
    this.roundT += dt;
    this.dayPhase = (this.roundT % 600) / 600;
    this.windAngle = (this.windAngle || 0) + dt * 0.12;
    if (
      this.phase === "playing" &&
      this.mode === "hill" &&
      this.shards.some((s) => s.attached) &&
      this.shards.filter((s) => s.attached).length > HILL_MIN_SHARDS &&
      this.roundT >= this.nextCrackT
    ) {
      this.breakOffShard();
      this.nextCrackT = this.roundT + 4 + Math.random() * 3;
    }
    if (this.phase === "playing" && this.mode === "bomb" && this.bombId) {
      this.bombT -= dt;
      this.bombTransferLock = Math.max(0, this.bombTransferLock - dt);
      if (this.bombT <= 0) this.explodeBomb();
    }

    for (const p of this.players.values()) {
      p.punchCd = Math.max(0, p.punchCd - dt);
      p.shootCd = Math.max(0, p.shootCd - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.grenadeCd = Math.max(0, (p.grenadeCd || 0) - dt);
      p.carHitCd = Math.max(0, (p.carHitCd || 0) - dt);
      p.punchFlash = Math.max(0, p.punchFlash - dt);
      p.shootFlash = Math.max(0, (p.shootFlash || 0) - dt);
      if (!p.alive && this.phase === "playing") {
        p.body.velocity.set(0, p.body.velocity.y, 0);
        continue;
      }
      this.control(p, dt);
    }

    this.steerGoats(dt);
    this.coastEmptyVehicles(dt);
    this.stepBullets(dt);
    this.stepGrenades(dt);
    this.stepSmokes(dt);
    this.world.step(1 / 60, dt, 4);
    // Re-apply goat chase after physics so friction cannot turn it into a snail
    this.steerGoats(0);
    this.attachDriversToVehicles();
    this.applyPropHitKnockback();
    this.applyVehicleHits();
    this.tickSniperDrop(dt);
    this.pickupSnipers();
    this.applyLadderClimb(dt);

    for (const p of this.players.values()) {
      if (!p.alive && this.phase === "playing") continue;
      if (p.vehicleId) continue;
      this.stabilizeOnPlatform(p);
    }

    if (this.phase === "lobby" || this.phase === "playing") {
      if (this.mode !== "guns") {
        this.debrisSpawnT -= dt;
        if (this.debrisSpawnT <= 0) {
          this.spawnDebris();
          this.debrisSpawnT = 3 + Math.random() * 3;
        }
      }
      this.goatSpawnT -= dt;
      if (this.goatSpawnT <= 0) {
        this.spawnGoat();
        this.goatSpawnT = 10 + Math.random() * 14;
      }
      if (this.mode === "guns" && this.phase === "playing") {
        this.medkitSpawnT -= dt;
        if (this.medkitSpawnT <= 0) {
          this.spawnMedkit();
          this.medkitSpawnT = 7 + Math.random() * 8;
        }
        this.pickupMedkits();
        this.ammoSpawnT -= dt;
        if (this.ammoSpawnT <= 0) {
          this.spawnAmmoPack();
          this.ammoSpawnT = 9 + Math.random() * 10;
        }
        this.pickupAmmo();
      }
    }
    this.removeFallenProps();

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const { y } = p.body.position;
      if (this.phase === "playing" && y < -2.4) this.kill(p, "fall");
      if (this.phase === "lobby" && y < -4) this.respawn(p, false);
    }

    if (this.phase === "playing" && this.mode === "bomb" && this.bombId && this.bombTransferLock <= 0) {
      this.tryBombPass();
    }
    if (this.phase === "playing") this.checkWin();
  }

  control(p, dt) {
    // Enter / exit vehicle (E)
    if (p.input.use && !p.useHeld && p.alive) {
      if (p.vehicleId) this.exitVehicle(p, true);
      else this.tryEnterVehicle(p);
    }
    p.useHeld = !!p.input.use;
    p.input.use = false;

    if (p.vehicleId) {
      this.controlVehicle(p, dt);
      return;
    }

    const body = p.body;
    const grounded = this.isGrounded(body);

    const yaw = p.input.yaw || 0;
    const fwd = new CANNON.Vec3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new CANNON.Vec3(Math.cos(yaw), 0, -Math.sin(yaw));
    const wish = new CANNON.Vec3();
    wish.vadd(fwd.scale(p.input.mz, new CANNON.Vec3()), wish);
    wish.vadd(right.scale(p.input.mx, new CANNON.Vec3()), wish);
    if (wish.length() > 1) wish.normalize();

    const sprint = !!p.input.sprint;
    const max = grounded ? (sprint ? 15.2 : 9.2) : sprint ? 16.2 : 10.5;
    const accel = grounded ? (sprint ? 85 : 70) : 22;
    const brake = grounded ? 90 : 12;
    const hasWish = wish.length() > 0.05;
    const tx = hasWish ? wish.x * max : 0;
    const tz = hasWish ? wish.z * max : 0;
    const rate = (hasWish ? accel : brake) * dt;
    body.velocity.x = this.approach(body.velocity.x, tx, rate);
    body.velocity.z = this.approach(body.velocity.z, tz, rate);
    if (grounded && body.velocity.y < 0.35) {
      body.velocity.y = 0;
      if (body.position.y < PLAYER_REST_Y + 0.12) body.position.y = PLAYER_REST_Y;
    }

    if (p.input.jump && !p.jumpHeld && grounded && body.velocity.y < 4) {
      body.velocity.y = 14.8;
    }
    p.jumpHeld = !!p.input.jump;
    p.input.jump = false;

    // Legacy dash pulse removed — Shift is hold-to-sprint
    p.input.dash = false;

    if (this.mode === "guns") {
      if ((p.input.shoot || p.input.punch) && p.shootCd <= 0 && p.alive) {
        const w = p.weapon || "knife";
        if (w === "knife") {
          this.doKnife(p);
          p.shootCd = 0.42;
          p.punchFlash = 0.18;
        } else if ((p.ammo || 0) > 0) {
          p.ammo -= 1;
          this.doShoot(p);
          p.shootCd = w === "sniper" ? 0.55 : 0.18;
          p.shootFlash = 0.12;
        } else {
          this.events.push({ type: "empty", id: p.id });
          p.shootCd = 0.25;
        }
      }
      if (p.input.grenade && (p.grenadeCd || 0) <= 0 && p.alive) {
        this.throwGrenade(p, p.input.grenadeCharge || 0.4, p.input.pitch || 0);
        p.grenadeCd = 2.6;
      }
      p.input.shoot = false;
      p.input.punch = false;
      p.input.grenade = false;
    } else {
      if (p.input.punch && p.punchCd <= 0) {
        this.doPunch(p, fwd);
        p.punchCd = 0.55;
        p.punchFlash = 0.22;
      }
      p.input.punch = false;
      p.input.shoot = false;
      p.input.grenade = false;
    }
  }

  findVehicle(id) {
    return (this.vehicles || []).find((v) => v.userData?.id === id) || null;
  }

  tryEnterVehicle(p) {
    if (this.mode !== "guns") return;
    let best = null;
    let bestD = 4.2;
    for (const v of this.vehicles || []) {
      if (v.userData.driverId) continue;
      const d = Math.hypot(v.position.x - p.body.position.x, v.position.z - p.body.position.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (!best) return;
    best.userData.driverId = p.id;
    p.vehicleId = best.userData.id;
    p.body.collisionResponse = false;
    p.body.velocity.set(0, 0, 0);
    this.events.push({ type: "enterCar", id: p.id });
  }

  exitVehicle(p, placeBeside = true) {
    if (!p?.vehicleId) return;
    const v = this.findVehicle(p.vehicleId);
    if (v && v.userData.driverId === p.id) {
      v.userData.driverId = null;
      v.userData.speed = (v.userData.speed || 0) * 0.35;
      if (placeBeside && p.body) {
        const yaw = v.userData.yaw || 0;
        const side = 2.6;
        p.body.position.set(
          v.position.x + Math.cos(yaw) * side,
          Math.max(PLAYER_REST_Y, v.position.y + 0.4),
          v.position.z + Math.sin(yaw) * side,
        );
        p.body.velocity.set(0, 2, 0);
      }
    }
    p.vehicleId = null;
    if (p.body) p.body.collisionResponse = true;
  }

  controlVehicle(p, dt) {
    const v = this.findVehicle(p.vehicleId);
    if (!v) {
      p.vehicleId = null;
      p.body.collisionResponse = true;
      return;
    }
    p.input.jump = false;
    p.input.shoot = false;
    p.input.punch = false;
    p.input.grenade = false;
    p.input.dash = false;

    let speed = v.userData.speed || 0;
    const throttle = p.input.mz || 0;
    const steer = -(p.input.mx || 0);
    // Faster than sprint run (~15) — cars feel quick
    const maxSpd = p.input.sprint ? 62 : 46;
    if (throttle > 0.08) speed = this.approach(speed, maxSpd * throttle, 78 * dt);
    else if (throttle < -0.08) speed = this.approach(speed, -maxSpd * 0.4 * Math.abs(throttle), 70 * dt);
    else speed = this.approach(speed, 0, 36 * dt);

    if (Math.abs(speed) > 0.5) {
      const turn = steer * dt * (2.8 * Math.min(1.25, Math.abs(speed) / 9)) * Math.sign(speed);
      v.userData.yaw = (v.userData.yaw || 0) + turn;
    }
    const yaw = v.userData.yaw || 0;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    v.velocity.x = fx * speed;
    v.velocity.z = fz * speed;
    v.velocity.y = 0;
    const rideY = v.userData.rideY ?? PLATFORM_TOP + 0.5;
    v.position.y = rideY;
    v.quaternion.setFromEuler(0, yaw, 0);
    v.userData.speed = speed;
    v.wakeUp();

    // Driver seated — camera follows this height
    p.body.position.set(v.position.x, rideY + 0.55, v.position.z);
    p.body.velocity.set(v.velocity.x, 0, v.velocity.z);
    p.yaw = yaw;
  }

  attachDriversToVehicles() {
    for (const p of this.players.values()) {
      if (!p.alive || !p.vehicleId) continue;
      const v = this.findVehicle(p.vehicleId);
      if (!v) {
        p.vehicleId = null;
        p.body.collisionResponse = true;
        continue;
      }
      const rideY = v.userData.rideY ?? PLATFORM_TOP + 0.5;
      v.position.y = rideY;
      v.velocity.y = 0;
      p.body.position.set(v.position.x, rideY + 0.55, v.position.z);
      p.body.velocity.set(v.velocity.x, 0, v.velocity.z);
    }
  }

  coastEmptyVehicles(dt) {
    for (const v of this.vehicles || []) {
      if (v.userData.driverId) continue;
      let speed = v.userData.speed || 0;
      speed = this.approach(speed, 0, 22 * dt);
      v.userData.speed = speed;
      const yaw = v.userData.yaw || 0;
      v.velocity.x = -Math.sin(yaw) * speed;
      v.velocity.z = -Math.cos(yaw) * speed;
      v.velocity.y = 0;
      const rideY = v.userData.rideY ?? PLATFORM_TOP + 0.5;
      v.position.y = rideY;
      v.quaternion.setFromEuler(0, yaw, 0);
    }
  }

  /** Fast cars damage pedestrians on contact. */
  applyVehicleHits() {
    if (this.mode !== "guns" || this.phase !== "playing") return;
    for (const v of this.vehicles || []) {
      const spd = Math.abs(v.userData.speed || 0);
      if (spd < 10) continue;
      const driverId = v.userData.driverId;
      for (const p of this.players.values()) {
        if (!p.alive || p.vehicleId || p.id === driverId) continue;
        if ((p.carHitCd || 0) > 0) continue;
        const d = Math.hypot(v.position.x - p.body.position.x, v.position.z - p.body.position.z);
        if (d > 3.2) continue;
        const dmg = Math.min(45, 12 + (spd - 10) * 1.4);
        p.hp = (p.hp ?? 100) - dmg;
        p.lastHitBy = driverId || null;
        p.lastHitAt = this.roundT;
        p.carHitCd = 0.85;
        const yaw = v.userData.yaw || 0;
        p.body.velocity.x += -Math.sin(yaw) * spd * 0.55;
        p.body.velocity.z += -Math.cos(yaw) * spd * 0.55;
        p.body.velocity.y += 6;
        this.events.push({ type: "hit", id: p.id, by: driverId });
        if (p.hp <= 0) this.kill(p, "shot");
      }
    }
  }

  /** Any connected player can throw — dedicated socket event + input flag. */
  requestGrenade(id, data = {}) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (this.mode !== "guns" || this.phase !== "playing") return;
    if ((p.grenadeCd || 0) > 0) return;
    const charge = clamp(Number(data.charge) || 0.4, 0.12, 1);
    const pitch = clamp(Number(data.pitch) ?? p.input.pitch ?? 0, -1.52, 1.52);
    if (data.yaw != null) {
      p.input.yaw = Number(data.yaw) || 0;
      p.yaw = p.input.yaw;
    }
    p.input.pitch = pitch;
    this.throwGrenade(p, charge, pitch);
    p.grenadeCd = 2.6;
  }

  throwGrenade(p, charge, pitch) {
    const c = clamp(charge, 0.12, 1);
    const yaw = p.input.yaw || p.yaw || 0;
    const pit = clamp(pitch, -1.52, 1.52);
    const cosP = Math.cos(pit);
    const sinP = Math.sin(pit);
    const fx = -Math.sin(yaw) * cosP;
    const fy = sinP;
    const fz = -Math.cos(yaw) * cosP;
    const power = 9 + c * 32;
    const loft = 5.5 + c * 11;
    const origin = p.body.position;
    const body = new CANNON.Body({
      mass: 1.8,
      material: this.boxMat,
      shape: new CANNON.Sphere(0.28),
      position: new CANNON.Vec3(origin.x + fx * 1.1, origin.y + 0.55, origin.z + fz * 1.1),
      linearDamping: 0.08,
      angularDamping: 0.2,
    });
    body.velocity.set(fx * power, loft + fy * power * 0.85, fz * power);
    body.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    body.userData = {
      id: this.debrisNextId++,
      kind: "grenade",
      color: "#c5cdd4",
      sx: 0.56,
      sy: 0.56,
      sz: 0.56,
      ownerId: p.id,
      fuse: 2.0,
      armed: 0.25,
    };
    this.world.addBody(body);
    this.grenades.push(body);
    this.events.push({ type: "grenadeThrow", id: p.id, by: p.name });
  }

  stepGrenades(dt) {
    if (!this.grenades?.length) return;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      const ud = g.userData;
      ud.fuse -= dt;
      ud.armed = Math.max(0, (ud.armed || 0) - dt);
      if (g.position.y < -12 || ud.fuse <= 0) {
        this.deploySmoke(g);
        this.world.removeBody(g);
        this.grenades.splice(i, 1);
      }
    }
  }

  deploySmoke(g) {
    const x = g.position.x;
    const y = Math.max(1.2, g.position.y);
    const z = g.position.z;
    const R = 16;
    const smoke = {
      id: this.smokeNextId++,
      x,
      y,
      z,
      r: R,
      life: 60,
      maxLife: 60,
      ownerId: g.userData?.ownerId,
    };
    this.smokes.push(smoke);
    this.events.push({ type: "smoke", id: smoke.id, x, y, z, r: R, life: 60 });
  }

  stepSmokes(dt) {
    if (!this.smokes?.length) return;
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      this.smokes[i].life -= dt;
      if (this.smokes[i].life <= 0) this.smokes.splice(i, 1);
    }
  }

  doKnife(p) {
    const origin = p.body.position;
    const yaw = p.input.yaw || p.yaw || 0;
    const pitch = clamp(p.input.pitch || 0, -1.52, 1.52);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const fx = -Math.sin(yaw) * cosP;
    const fy = sinP;
    const fz = -Math.cos(yaw) * cosP;
    const reach = 2.35;
    let hit = null;
    let best = reach;
    for (const o of this.players.values()) {
      if (o === p || !o.alive) continue;
      const dx = o.body.position.x - origin.x;
      const dy = o.body.position.y - origin.y;
      const dz = o.body.position.z - origin.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > reach || dist < 0.05) continue;
      const inv = 1 / dist;
      const dot = dx * inv * fx + dy * inv * fy + dz * inv * fz;
      if (dot < 0.45) continue;
      if (dist < best) {
        best = dist;
        hit = o;
      }
    }
    this.events.push({ type: "knife", id: p.id, by: p.name, hit: !!hit });
    if (!hit) return;
    hit.hp = Math.max(0, (hit.hp ?? 100) - 34);
    hit.lastHitBy = p.id;
    hit.lastHitAt = this.roundT;
    hit.body.velocity.x += fx * 6;
    hit.body.velocity.z += fz * 6;
    hit.body.velocity.y += 3.5;
    this.events.push({
      type: "hit",
      id: hit.id,
      by: p.name,
      victim: hit.name,
      hp: Math.round(hit.hp),
      x: hit.body.position.x,
      y: hit.body.position.y,
      z: hit.body.position.z,
      knife: true,
    });
    if (hit.hp <= 0) this.kill(hit, "shot");
  }

  doShoot(p) {
    const origin = p.body.position;
    const ox = origin.x;
    const oy = origin.y + 0.35;
    const oz = origin.z;
    const yaw = p.input.yaw || p.yaw || 0;
    const pitch = clamp(p.input.pitch || 0, -1.52, 1.52);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const fx = -Math.sin(yaw) * cosP;
    const fy = sinP;
    const fz = -Math.cos(yaw) * cosP;
    // First-version feel: fast projectiles (~hitscan); sniper even quicker
    const sniper = p.weapon === "sniper";
    const speed = sniper ? 320 : 180;
    const range = sniper
      ? Math.max(160, Math.min(320, this.platformRadius * 1.4))
      : Math.max(90, Math.min(240, this.platformRadius * 1.15));
    const dmg = sniper ? 40 : 20; // sniper = 2× pistol
    this.bullets.push({
      id: this.bulletNextId++,
      ownerId: p.id,
      by: p.name,
      x: ox,
      y: oy,
      z: oz,
      vx: fx * speed,
      vy: fy * speed,
      vz: fz * speed,
      speed,
      life: range / speed,
      maxLife: range / speed,
      dmg,
      sniper,
    });
    this.events.push({
      type: "shot",
      id: p.id,
      by: p.name,
      x0: ox,
      y0: oy,
      z0: oz,
      dx: fx,
      dy: fy,
      dz: fz,
      speed,
      range,
      sniper,
      hit: false,
    });
  }

  stepBullets(dt) {
    if (!this.bullets.length) return;
    const props = [...this.boxes, ...this.debris, ...this.goats, ...this.structures];
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const step = Math.min(dt, b.life);
      const dist = b.speed * step;
      const ox = b.x;
      const oy = b.y;
      const oz = b.z;
      const fx = b.vx / b.speed;
      const fy = b.vy / b.speed;
      const fz = b.vz / b.speed;
      let hitT = dist;
      let hitPlayer = null;
      let hitProp = null;

      for (const o of this.players.values()) {
        if (o.id === b.ownerId || !o.alive) continue;
        const dx = o.body.position.x - ox;
        const dy = o.body.position.y - oy;
        const dz = o.body.position.z - oz;
        const t = dx * fx + dy * fy + dz * fz;
        if (t < 0 || t > hitT) continue;
        const px = ox + fx * t;
        const py = oy + fy * t;
        const pz = oz + fz * t;
        const rad = Math.hypot(px - o.body.position.x, py - o.body.position.y, pz - o.body.position.z);
        if (rad < 1.15) {
          hitPlayer = o;
          hitT = t;
        }
      }
      for (const body of props) {
        if (body.userData?.kind === "medkit" || body.userData?.kind === "sniper" || body.userData?.kind === "ladder" || body.userData?.kind === "ammo")
          continue;
        const t = this.raycastBody(ox, oy, oz, fx, fy, fz, body, hitT);
        if (t == null || t >= hitT) continue;
        hitT = t;
        hitProp = body;
        hitPlayer = null;
      }

      if (hitPlayer || hitProp) {
        const ex = ox + fx * hitT;
        const ey = oy + fy * hitT;
        const ez = oz + fz * hitT;
        this.events.push({
          type: "bulletHit",
          x: ex,
          y: ey,
          z: ez,
          hit: !!hitPlayer,
          sniper: !!b.sniper,
        });
        if (hitProp && hitProp.userData?.kind === "goat") {
          const ud = hitProp.userData;
          ud.hp = Math.max(0, (ud.hp ?? 60) - (b.dmg || 20));
          hitProp.wakeUp();
          hitProp.velocity.x += fx * 8;
          hitProp.velocity.z += fz * 8;
          hitProp.velocity.y += 4;
          this.events.push({ type: "goatHit", id: ud.id, hp: ud.hp });
          if (ud.hp <= 0) {
            const gi = this.goats.indexOf(hitProp);
            if (gi >= 0) {
              this.world.removeBody(hitProp);
              this.goats.splice(gi, 1);
              this.events.push({ type: "goatKill", by: b.by });
            }
          }
          this.bullets.splice(i, 1);
          continue;
        }
        if (hitProp && hitProp.mass > 0 && hitProp.type !== CANNON.Body.STATIC) {
          hitProp.wakeUp();
          const kick = 14 + Math.min(22, 80 / Math.max(4, hitProp.mass));
          hitProp.velocity.x += fx * kick;
          hitProp.velocity.z += fz * kick;
          hitProp.velocity.y += 5.5 + fy * 4;
          hitProp.angularVelocity.x += (Math.random() - 0.5) * 8;
          hitProp.angularVelocity.y += (Math.random() - 0.5) * 10;
          hitProp.angularVelocity.z += (Math.random() - 0.5) * 8;
        }
        if (hitPlayer) {
          const shooter = this.players.get(b.ownerId);
          const dmg = b.dmg || 20;
          hitPlayer.hp = Math.max(0, (hitPlayer.hp ?? 100) - dmg);
          hitPlayer.lastHitBy = b.ownerId;
          hitPlayer.lastHitAt = this.roundT;
          hitPlayer.body.velocity.x += fx * (b.sniper ? 7 : 4.5);
          hitPlayer.body.velocity.z += fz * (b.sniper ? 7 : 4.5);
          hitPlayer.body.velocity.y += 1.5 + fy * 2;
          this.events.push({
            type: "hit",
            by: b.by || shooter?.name || "?",
            victim: hitPlayer.name,
            id: hitPlayer.id,
            hp: hitPlayer.hp,
            x: hitPlayer.body.position.x,
            y: hitPlayer.body.position.y,
            z: hitPlayer.body.position.z,
          });
          if (hitPlayer.hp <= 0) this.kill(hitPlayer, "shot");
        }
        this.bullets.splice(i, 1);
        continue;
      }

      b.x += b.vx * step;
      b.y += b.vy * step;
      b.z += b.vz * step;
      b.life -= step;
      if (b.life <= 0) this.bullets.splice(i, 1);
    }
  }

  /** Ray vs cannon body shapes (box / sphere / cylinder). Returns distance t or null. */
  raycastBody(ox, oy, oz, dx, dy, dz, body, maxT) {
    let best = null;
    for (let i = 0; i < body.shapes.length; i++) {
      const shape = body.shapes[i];
      const offset = body.shapeOffsets[i] || new CANNON.Vec3(0, 0, 0);
      const sq = body.shapeOrientations[i] || new CANNON.Quaternion(0, 0, 0, 1);
      const worldOff = body.quaternion.vmult(offset);
      const cx = body.position.x + worldOff.x;
      const cy = body.position.y + worldOff.y;
      const cz = body.position.z + worldOff.z;
      const q = sq.clone();
      body.quaternion.mult(q, q);
      const invQ = q.clone().conjugate();
      const locO = invQ.vmult(new CANNON.Vec3(ox - cx, oy - cy, oz - cz));
      const locD = invQ.vmult(new CANNON.Vec3(dx, dy, dz));

      let t = null;
      if (shape instanceof CANNON.Sphere) {
        t = this.raySphereLocal(locO, locD, shape.radius, maxT);
      } else if (shape instanceof CANNON.Box) {
        t = this.rayAABBLocal(locO, locD, shape.halfExtents, maxT);
      } else if (shape instanceof CANNON.Cylinder) {
        const he = new CANNON.Vec3(
          Math.max(shape.radiusTop, shape.radiusBottom),
          shape.height * 0.5,
          Math.max(shape.radiusTop, shape.radiusBottom),
        );
        t = this.rayAABBLocal(locO, locD, he, maxT);
      }
      if (t != null && t < maxT && (best == null || t < best)) best = t;
    }
    return best;
  }

  raySphereLocal(o, d, r, maxT) {
    const a = d.x * d.x + d.y * d.y + d.z * d.z;
    if (a < 1e-10) return null;
    const b = 2 * (o.x * d.x + o.y * d.y + o.z * d.z);
    const c = o.x * o.x + o.y * o.y + o.z * o.z - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t0 = (-b - s) / (2 * a);
    const t1 = (-b + s) / (2 * a);
    if (t0 >= 0.2 && t0 <= maxT) return t0;
    if (t1 >= 0.2 && t1 <= maxT) return t1;
    return null;
  }

  rayAABBLocal(o, d, he, maxT) {
    let tmin = 0;
    let tmax = maxT;
    const axes = [
      [o.x, d.x, he.x],
      [o.y, d.y, he.y],
      [o.z, d.z, he.z],
    ];
    for (const [oo, dd, hh] of axes) {
      if (Math.abs(dd) < 1e-9) {
        if (oo < -hh || oo > hh) return null;
        continue;
      }
      const inv = 1 / dd;
      let t1 = (-hh - oo) * inv;
      let t2 = (hh - oo) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    if (tmax < 0.2) return null;
    const t = tmin >= 0.2 ? tmin : tmax;
    return t <= maxT ? t : null;
  }

  doPunch(p, fwd) {
    const origin = p.body.position;
    let hit = null;
    let hitDist = 3.15;
    for (const o of this.players.values()) {
      if (o === p || (!o.alive && this.phase === "playing")) continue;
      const dx = o.body.position.x - origin.x;
      const dy = o.body.position.y - origin.y;
      const dz = o.body.position.z - origin.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > hitDist) continue;
      const dirn = dist > 0.001 ? (dx * fwd.x + dz * fwd.z) / dist : 0;
      if (dirn < 0.12 && dist > 1.7) continue;
      hit = o;
      hitDist = dist;
    }

    let hitBox = null;
    let boxDist = 2.9;
    for (const box of [...this.boxes, ...this.debris, ...this.goats]) {
      const dx = box.position.x - origin.x;
      const dy = box.position.y - origin.y;
      const dz = box.position.z - origin.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > boxDist) continue;
      const dirn = dist > 0.001 ? (dx * fwd.x + dz * fwd.z) / dist : 0;
      if (dirn < 0.08 && dist > 1.5) continue;
      hitBox = box;
      boxDist = dist;
    }

    p.body.velocity.x += fwd.x * 4;
    p.body.velocity.z += fwd.z * 4;

    if (hitBox && (!hit || boxDist < hitDist)) {
      const dx = hitBox.position.x - origin.x;
      const dz = hitBox.position.z - origin.z;
      const dist = Math.max(0.2, Math.hypot(dx, dz));
      const nx = dx / dist;
      const nz = dz / dist;
      hitBox.velocity.x += nx * 11 + fwd.x * 5;
      hitBox.velocity.z += nz * 11 + fwd.z * 5;
      hitBox.velocity.y += 4.5;
      hitBox.angularVelocity.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 6);
      hitBox.wakeUp();
      p.body.velocity.x -= nx * 5.5;
      p.body.velocity.z -= nz * 5.5;
      p.body.velocity.y += 2.2;
      this.events.push({ type: "whoosh", id: p.id });
      return;
    }

    if (!hit) {
      this.events.push({ type: "whoosh", id: p.id });
      return;
    }
    const dx = hit.body.position.x - origin.x;
    const dz = hit.body.position.z - origin.z;
    const dist = Math.max(0.2, Math.hypot(dx, dz));
    const nx = dx / dist;
    const nz = dz / dist;
    hit.body.velocity.x += nx * 16 + fwd.x * 6;
    hit.body.velocity.z += nz * 16 + fwd.z * 6;
    hit.body.velocity.y += 7.5;
    hit.body.angularVelocity.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10);
    hit.lastHitBy = p.id;
    hit.lastHitAt = this.roundT;
    if (this.mode === "bomb" && this.bombId === p.id) {
      this.bombId = hit.id;
      this.bombTransferLock = 0.7;
      this.bombT = Math.max(this.bombT, 1.4);
      this.events.push({ type: "pass", by: p.name, victim: hit.name });
    }
    this.events.push({ type: "punch", by: p.name, victim: hit.name, id: p.id, tid: hit.id });
  }

  tryBombPass() {
    const holder = this.players.get(this.bombId);
    if (!holder || !holder.alive) return;
    for (const o of this.players.values()) {
      if (o.id === holder.id || !o.alive) continue;
      const dx = o.body.position.x - holder.body.position.x;
      const dy = o.body.position.y - holder.body.position.y;
      const dz = o.body.position.z - holder.body.position.z;
      if (Math.hypot(dx, dy, dz) < 1.85) {
        this.bombId = o.id;
        this.bombTransferLock = 0.85;
        this.events.push({ type: "pass", by: holder.name, victim: o.name });
        break;
      }
    }
  }

  explodeBomb() {
    const holder = this.players.get(this.bombId);
    this.events.push({ type: "boom", victim: holder?.name || "?", id: this.bombId });
    if (holder && holder.alive) {
      holder.body.velocity.y += 18;
      holder.body.velocity.x += (Math.random() - 0.5) * 22;
      holder.body.velocity.z += (Math.random() - 0.5) * 22;
      this.kill(holder, "boom");
    }
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length >= 2) {
      this.bombId = this.randomAliveId();
      this.bombT = 7 + Math.random() * 5;
      this.bombTransferLock = 0.4;
    } else {
      this.bombId = null;
    }
  }

  kill(p, reason) {
    if (this.phase !== "playing") return;
    if (!p.alive) return;
    this.exitVehicle(p, true);
    p.alive = false;
    const killer = p.lastHitBy && this.roundT - p.lastHitAt < 3.2 ? this.players.get(p.lastHitBy) : null;
    this.events.push({
      type: reason === "boom" ? "boom" : reason === "shot" ? "kill" : "fall",
      victim: p.name,
      by: killer && killer.id !== p.id ? killer.name : null,
      id: p.id,
    });
    if (this.bombId === p.id) {
      this.bombId = this.randomAliveId(p.id);
      this.bombT = Math.max(this.bombT, 5);
    }
    p.body.velocity.x *= 0.3;
    p.body.velocity.z *= 0.3;

    if (this.mode === "guns") {
      if (reason === "shot" && killer && killer.id !== p.id) {
        this.roundKills = (this.roundKills || 0) + 1;
        this.scores.set(killer.id, (this.scores.get(killer.id) || 0) + 1);
      }
      // Soft respawn — keep map debris / buildings
      const victimId = p.id;
      setTimeout(() => {
        if (this.phase !== "playing" || this.mode !== "guns") return;
        const pl = this.players.get(victimId);
        if (!pl || pl.alive) return;
        pl.alive = true;
        pl.hp = 100;
        pl.lastHitBy = null;
        pl.shootCd = 0.4;
        this.respawn(pl, true);
      }, 1600);
      if ((this.roundKills || 0) >= 30) this.endGunsRound();
    }
  }

  endGunsRound() {
    if (this.phase !== "playing" || this.mode !== "guns") return;
    this.phase = "results";
    this.bullets = [];
    for (const g of this.grenades || []) this.world.removeBody(g);
    this.grenades = [];
    this.smokes = [];
    let best = null;
    let bestS = -1;
    for (const p of this.players.values()) {
      const s = this.scores.get(p.id) || 0;
      if (s > bestS) {
        bestS = s;
        best = p;
      }
    }
    this.winnerId = best?.id || null;
    this.winnerName = best?.name || "Nikto";
    this.emit("over", {
      winnerId: this.winnerId,
      winnerName: this.winnerName,
      scores: this.scoreboard(),
      roundKills: this.roundKills,
    });
    setTimeout(() => {
      if (this.phase === "results" && this.players.size) this.beginRound();
    }, 5200);
  }

  checkWin() {
    if (this.phase !== "playing") return;
    if (this.mode === "guns") {
      if ((this.roundKills || 0) >= 30) this.endGunsRound();
      return;
    }
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (this.players.size === 1) {
      // alone: win only after falling off? keep playing until they fall, or after 3s mark practice
      return;
    }
    if (alive.length <= 1) {
      const w = alive[0] || null;
      this.phase = "results";
      this.winnerId = w?.id || null;
      this.winnerName = w?.name || "Nikto";
      if (w) this.scores.set(w.id, (this.scores.get(w.id) || 0) + 1);
      this.emit("over", {
        winnerId: this.winnerId,
        winnerName: this.winnerName,
        scores: this.scoreboard(),
      });
      setTimeout(() => {
        if (this.phase === "results" && this.players.size) this.beginRound();
      }, 5200);
    }
  }

  backToLobby(id) {
    if (id !== this.hostId) return;
    this.phase = "lobby";
    this.winnerId = null;
    this.buildArena();
    let i = 0;
    const n = this.players.size;
    for (const p of this.players.values()) {
      p.alive = true;
      this.respawn(p, false, i, n);
      i++;
    }
    this.bombId = null;
    this.emit("lobby", this.lobbyPayload());
  }

  scoreboard() {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      score: this.scores.get(p.id) || 0,
      color: p.color,
    }));
  }

  lobbyPayload() {
    return {
      code: this.code,
      hostId: this.hostId,
      mode: this.mode,
      arenaId: this.arenaId,
      layoutId: this.layout?.id || "circle",
      layoutKey: this.layoutKey,
      pieces: this.layout?.pieces || [],
      structures: this.layout?.structures || [],
      radius: this.platformRadius,
      phase: this.phase,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        score: this.scores.get(p.id) || 0,
      })),
    };
  }

  roundPayload() {
    return {
      mode: this.mode,
      arenaId: this.arenaId,
      layoutId: this.layout?.id || "circle",
      layoutKey: this.layoutKey,
      pieces: this.layout?.pieces || [],
      structures: this.layout?.structures || [],
      radius: this.platformRadius,
      bombId: this.bombId,
      bombT: this.bombT,
      shards: this.shardSnapshot(),
    };
  }

  shardSnapshot() {
    if (this.mode !== "hill" || !this.shards.length) return null;
    return this.shards.map((s) => {
      const b = s.body;
      return {
        id: s.id,
        ring: s.ring,
        a0: s.a0,
        a1: s.a1,
        rInner: s.rInner,
        rOuter: s.rOuter,
        radius: s.radius,
        poly: s.poly,
        cx: s.cx,
        cz: s.cz,
        attached: s.attached,
        x: b.position.x,
        y: b.position.y,
        z: b.position.z,
        qx: b.quaternion.x,
        qy: b.quaternion.y,
        qz: b.quaternion.z,
        qw: b.quaternion.w,
      };
    });
  }

  broadcastLobby() {
    this.emit("lobby", this.lobbyPayload());
  }

  snapshot() {
    const players = [];
    for (const p of this.players.values()) {
      const b = p.body;
      players.push({
        id: p.id,
        name: p.name,
        color: p.color,
        x: b.position.x,
        y: b.position.y,
        z: b.position.z,
        qx: b.quaternion.x,
        qy: b.quaternion.y,
        qz: b.quaternion.z,
        qw: b.quaternion.w,
        vx: b.velocity.x,
        vy: b.velocity.y,
        vz: b.velocity.z,
        yaw: p.yaw,
        alive: p.alive,
        punch: p.punchFlash > 0,
        shoot: (p.shootFlash || 0) > 0,
        dashCd: p.dashCd,
        hp: p.hp ?? 100,
        ammo: p.ammo ?? 0,
        weapon: p.weapon || "knife",
        hasSniper: !!p.hasSniper,
        vehicleId: p.vehicleId || null,
      });
    }
    const boxes = this.boxes.map((b, i) => ({
      id: b.userData?.id ?? i,
      color: b.userData?.color || "#5ce1ff",
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
    }));
    const debris = this.debris.map((b) => ({
      id: b.userData?.id ?? 0,
      kind: b.userData?.kind || "box",
      color: b.userData?.color || "#ff9e00",
      sx: b.userData?.sx ?? 1,
      sy: b.userData?.sy ?? 1,
      sz: b.userData?.sz ?? 1,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      yaw: 0,
      vx: b.velocity.x,
      vy: b.velocity.y,
      vz: b.velocity.z,
    }));
    const goats = this.goats.map((b) => ({
      id: b.userData?.id ?? 0,
      kind: "goat",
      color: "#c4a574",
      sx: b.userData?.sx ?? 1,
      sy: b.userData?.sy ?? 1,
      sz: b.userData?.sz ?? 1,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      yaw: b.userData?.yaw ?? 0,
      vx: b.velocity.x,
      vy: b.velocity.y,
      vz: b.velocity.z,
    }));
    const medkits = (this.medkits || []).map((b) => ({
      id: b.userData?.id ?? 0,
      kind: "medkit",
      color: "#2ecc71",
      sx: b.userData?.sx ?? 0.7,
      sy: b.userData?.sy ?? 0.56,
      sz: b.userData?.sz ?? 0.7,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      yaw: 0,
      vx: b.velocity.x,
      vy: b.velocity.y,
      vz: b.velocity.z,
    }));
    const grenades = (this.grenades || []).map((b) => ({
      id: b.userData?.id ?? 0,
      kind: "grenade",
      color: "#2f6b3a",
      sx: b.userData?.sx ?? 0.56,
      sy: b.userData?.sy ?? 0.56,
      sz: b.userData?.sz ?? 0.56,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      yaw: 0,
      vx: b.velocity.x,
      vy: b.velocity.y,
      vz: b.velocity.z,
      fuse: b.userData?.fuse ?? 0,
    }));
    const snipers = (this.snipers || []).map((b) => ({
      id: b.userData?.id ?? 0,
      kind: "sniper",
      color: "#1f2937",
      sx: b.userData?.sx ?? 1.1,
      sy: b.userData?.sy ?? 0.36,
      sz: b.userData?.sz ?? 0.36,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      yaw: 0,
      vx: b.velocity.x,
      vy: b.velocity.y,
      vz: b.velocity.z,
    }));
    const ammoPacks = (this.ammoPacks || []).map((b) => ({
      id: b.userData?.id ?? 0,
      kind: "ammo",
      color: "#f0c14a",
      sx: b.userData?.sx ?? 0.64,
      sy: b.userData?.sy ?? 0.44,
      sz: b.userData?.sz ?? 0.84,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      yaw: 0,
      vx: b.velocity.x,
      vy: b.velocity.y,
      vz: b.velocity.z,
    }));
    // Client still reads one debris list — merge goats + medkits + grenades + snipers + ammo + vehicles
    const vehicles = (this.vehicles || []).map((b) => ({
      id: b.userData?.id ?? 0,
      kind: "vehicle",
      model: b.userData?.model || "BasicCar",
      color: b.userData?.color || "#c44",
      sx: b.userData?.sx ?? 4.4,
      sy: b.userData?.sy ?? 1.7,
      sz: b.userData?.sz ?? 2.2,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      yaw: b.userData?.yaw ?? 0,
      vx: b.velocity.x,
      vy: b.velocity.y,
      vz: b.velocity.z,
      driverId: b.userData?.driverId || null,
      speed: b.userData?.speed || 0,
    }));
    const debrisOut = [...debris, ...goats, ...medkits, ...grenades, ...snipers, ...ammoPacks, ...vehicles];
    const ev = this.events;
    this.events = [];
    return {
      phase: this.phase,
      mode: this.mode,
      arenaId: this.arenaId,
      layoutId: this.layout?.id || "circle",
      layoutKey: this.layoutKey,
      pieces: this.layout?.pieces || [],
      structures: this.layout?.structures || [],
      radius: this.platformRadius,
      bombId: this.bombId,
      bombT: this.bombT,
      winnerId: this.winnerId,
      winnerName: this.winnerName,
      roundKills: this.roundKills || 0,
      dayPhase: this.dayPhase || 0,
      windAngle: this.windAngle || 0,
      players,
      boxes,
      debris: debrisOut,
      smokes: (this.smokes || []).map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        z: s.z,
        r: s.r,
        life: s.life,
        maxLife: s.maxLife || 60,
      })),
      shards: this.shardSnapshot(),
      events: ev,
    };
  }
}
