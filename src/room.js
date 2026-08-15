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
  guns: { name: "Streľba", blurb: "Zbrane, životy, lekárničky. Veľká mapa. Strela = 20 %." },
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
        friction: 0.85,
        restitution: 0.02,
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
    this.goats = [];
    this.maxGoats = 2;
    this.goatSpawnT = 6 + Math.random() * 8;
    this.medkitSpawnT = 8 + Math.random() * 6;
    this.medkits = [];
    this.maxMedkits = 4;
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
      this.maxDebris = 28;
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
    // On huge guns maps, scatter a few more props across the pad
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

  clearStructures() {
    for (const b of this.structures || []) this.world.removeBody(b);
    this.structures = [];
  }

  tooCloseToStructure(x, z, minDist, list = null) {
    const arr = list || this.layout?.structures || [];
    for (const s of arr) {
      const pad = s.kind === "building" ? Math.max(s.w || 0, s.d || 0) * 0.55 : (s.r || 2) + 1;
      if (Math.hypot(x - s.x, z - s.z) < minDist + pad) return true;
    }
    return false;
  }

  /** Static buildings + trees for the big guns map (cover, no fall). */
  spawnBattlefieldDecor() {
    this.clearStructures();
    const items = [];
    const buildingColors = ["#ff8ec4", "#c77dff", "#5ce1ff", "#ffd36a", "#80ffdb", "#ff9e00"];
    let n = 0;
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        if (Math.abs(ix) + Math.abs(iz) < 2) continue;
        const x = ix * 32 + ((ix * 17 + iz * 13) % 7) - 3;
        const z = iz * 32 + ((ix * 11 + iz * 19) % 7) - 3;
        if (Math.hypot(x, z) < 28) continue;
        if (Math.abs(x) > 138 || Math.abs(z) > 138) continue;
        const w = 7 + ((n * 3) % 9);
        const d = 7 + ((n * 5) % 8);
        const h = 6 + ((n * 7) % 14);
        items.push({
          id: n++,
          kind: "building",
          x,
          z,
          w,
          d,
          h,
          rotY: ((n % 4) * Math.PI) / 2,
          color: buildingColors[n % buildingColors.length],
        });
      }
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + i * 0.17;
      const rr = 22 + (i % 7) * 16 + (i % 3) * 4;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (Math.abs(x) > 140 || Math.abs(z) > 140) continue;
      if (this.tooCloseToStructure(x, z, 6, items)) continue;
      items.push({
        id: n++,
        kind: "tree",
        x,
        z,
        r: 2.2 + (i % 4) * 0.55,
        h: 5.5 + (i % 5) * 1.1,
        color: i % 2 === 0 ? "#3ecf6a" : "#2aad52",
      });
    }
    this.layout.structures = items;
    this.layoutKey += `|struct:${items.length}:${items.map((s) => `${s.kind},${s.x.toFixed(1)},${s.z.toFixed(1)}`).join(";")}`;

    for (const s of items) {
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: this.boxMat,
      });
      if (s.kind === "building") {
        const hy = s.h * 0.5;
        body.addShape(new CANNON.Box(new CANNON.Vec3(s.w * 0.5, hy, s.d * 0.5)));
        body.position.set(s.x, PLATFORM_TOP + hy, s.z);
        if (s.rotY) body.quaternion.setFromEuler(0, s.rotY, 0);
      } else {
        const trunkH = s.h * 0.55;
        const canopyR = s.r;
        body.addShape(new CANNON.Cylinder(0.35, 0.45, trunkH, 8), new CANNON.Vec3(0, trunkH * 0.5, 0));
        body.addShape(new CANNON.Sphere(canopyR), new CANNON.Vec3(0, trunkH + canopyR * 0.65, 0));
        body.position.set(s.x, PLATFORM_TOP, s.z);
      }
      body.userData = { kind: s.kind, id: s.id, static: true };
      this.world.addBody(body);
      this.structures.push(body);
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
      linearDamping: 0.18,
      angularDamping: 0.95,
      fixedRotation: true,
    });
    body.velocity.set((Math.random() - 0.5) * 2, -3 - Math.random() * 2, (Math.random() - 0.5) * 2);
    body.userData = {
      id: this.debrisNextId++,
      kind: "goat",
      color: "#c4a574",
      sx: hx * 2,
      sy: hy * 2,
      sz: hz * 2,
      yaw: Math.random() * Math.PI * 2,
      chargeT: 0.6 + Math.random() * 1.2,
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

  /** Steer goats: fast charge toward nearest player / wander. */
  steerGoats(dt) {
    if (!this.goats.length) return;
    const chaseRange = this.platformRadius > 40 ? 220 : 48;
    for (const g of this.goats) {
      const ud = g.userData;
      ud.chargeT = (ud.chargeT || 0) - dt;
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
      let wishX = 0;
      let wishZ = 0;
      if (tx != null && best < chaseRange) {
        const inv = best > 0.15 ? 1 / best : 0;
        wishX = tx * inv;
        wishZ = tz * inv;
      } else if (ud.chargeT <= 0) {
        const ang = Math.random() * Math.PI * 2;
        wishX = Math.cos(ang);
        wishZ = Math.sin(ang);
        ud.chargeT = 0.8 + Math.random() * 1.4;
      } else {
        wishX = -Math.sin(ud.yaw || 0);
        wishZ = -Math.cos(ud.yaw || 0);
      }
      const sprint = tx != null && best < chaseRange;
      const walkSpeed = sprint ? 19.5 : 12;
      const accel = sprint ? 55 : 28;
      g.velocity.x = this.approach(g.velocity.x, wishX * walkSpeed, accel * dt);
      g.velocity.z = this.approach(g.velocity.z, wishZ * walkSpeed, accel * dt);
      // kill ball-bounce on landing
      if (g.velocity.y < 0) g.velocity.y *= 0.92;
      if (g.position.y < 2.2 && g.velocity.y > 0 && g.velocity.y < 6) {
        g.velocity.y *= 0.15;
      }
      if (Math.hypot(wishX, wishZ) > 0.05) {
        ud.yaw = Math.atan2(-wishX, -wishZ);
      }
      g.quaternion.setFromEuler(0, ud.yaw || 0, 0);
      g.wakeUp();

      // Touch = yeet (even if contact solver is soft)
      if (sprint && best < 1.85) {
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
      input: { mx: 0, mz: 0, yaw: 0, jump: false, punch: false, dash: false, shoot: false },
      jumpHeld: false,
      punchCd: 0,
      shootCd: 0,
      dashCd: 0,
      punchFlash: 0,
      shootFlash: 0,
      hp: 100,
      lastHitBy: null,
      lastHitAt: 0,
      yaw: 0,
    };
    this.players.set(socket.id, player);
    this.scores.set(socket.id, this.scores.get(socket.id) || 0);
    if (!this.hostId) this.hostId = socket.id;
    socket.join(this.code);

    if (this.phase === "playing") {
      // late join – let them drop in
      this.respawn(player, true);
    }
    this.broadcastLobby();
    return { ok: true };
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
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
    p.yaw = p.input.yaw;
    if (data.jump) p.input.jump = true;
    if (data.punch) p.input.punch = true;
    if (data.dash) p.input.dash = true;
    if (data.shoot) p.input.shoot = true;
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
    // clear leftover medkits
    for (const m of this.medkits) this.world.removeBody(m);
    this.medkits = [];
    this.medkitSpawnT = 5 + Math.random() * 4;
    const list = [...this.players.values()];
    list.forEach((p, i) => {
      p.alive = true;
      p.hp = 100;
      p.punchCd = 0;
      p.shootCd = 0;
      p.dashCd = 0;
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
    const i = index ?? [...this.players.keys()].indexOf(p.id);
    const n = count ?? this.players.size;
    const pos = this.spawnPos(Math.max(i, 0), n);
    p.body.position.copy(pos);
    p.body.velocity.set(0, 0, 0);
    p.body.angularVelocity.set(0, 0, 0);
    p.body.quaternion.set(0, 0, 0, 1);
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
      p.punchFlash = Math.max(0, p.punchFlash - dt);
      p.shootFlash = Math.max(0, (p.shootFlash || 0) - dt);
      if (!p.alive && this.phase === "playing") {
        p.body.velocity.set(0, p.body.velocity.y, 0);
        continue;
      }
      this.control(p, dt);
    }

    this.steerGoats(dt);
    this.stepBullets(dt);
    this.world.step(1 / 60, dt, 4);
    this.applyPropHitKnockback();

    for (const p of this.players.values()) {
      if (!p.alive && this.phase === "playing") continue;
      this.stabilizeOnPlatform(p);
    }

    if (this.phase === "lobby" || this.phase === "playing") {
      this.debrisSpawnT -= dt;
      if (this.debrisSpawnT <= 0) {
        this.spawnDebris();
        this.debrisSpawnT =
          this.mode === "guns" || this.platformRadius > 40
            ? 2.2 + Math.random() * 2.8
            : 3 + Math.random() * 3;
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
    const body = p.body;
    const grounded = this.isGrounded(body);

    const yaw = p.input.yaw || 0;
    const fwd = new CANNON.Vec3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new CANNON.Vec3(Math.cos(yaw), 0, -Math.sin(yaw));
    const wish = new CANNON.Vec3();
    wish.vadd(fwd.scale(p.input.mz, new CANNON.Vec3()), wish);
    wish.vadd(right.scale(p.input.mx, new CANNON.Vec3()), wish);
    if (wish.length() > 1) wish.normalize();

    const max = grounded ? 9.2 : 10.5;
    const accel = grounded ? 70 : 22;
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

    if (p.input.dash && p.dashCd <= 0) {
      const dir = hasWish ? wish : fwd;
      body.velocity.x += dir.x * 12;
      body.velocity.z += dir.z * 12;
      body.velocity.y += 1.6;
      p.dashCd = 1.35;
    }
    p.input.dash = false;

    if (this.mode === "guns") {
      if ((p.input.shoot || p.input.punch) && p.shootCd <= 0 && p.alive) {
        this.doShoot(p, fwd);
        p.shootCd = 0.38;
        p.shootFlash = 0.12;
      }
      p.input.shoot = false;
      p.input.punch = false;
    } else {
      if (p.input.punch && p.punchCd <= 0) {
        this.doPunch(p, fwd);
        p.punchCd = 0.55;
        p.punchFlash = 0.22;
      }
      p.input.punch = false;
      p.input.shoot = false;
    }
  }

  doShoot(p, fwd) {
    const origin = p.body.position;
    const ox = origin.x;
    const oy = origin.y + 0.35;
    const oz = origin.z;
    const fx = fwd.x;
    const fz = fwd.z;
    // ~50% slower than the previous ~180 u/s hitscan-feel beam
    const speed = 90;
    const range = Math.max(90, Math.min(240, this.platformRadius * 1.15));
    this.bullets.push({
      id: this.bulletNextId++,
      ownerId: p.id,
      by: p.name,
      x: ox,
      y: oy,
      z: oz,
      vx: fx * speed,
      vy: 0,
      vz: fz * speed,
      speed,
      life: range / speed,
      maxLife: range / speed,
    });
    this.events.push({
      type: "shot",
      id: p.id,
      by: p.name,
      x0: ox,
      y0: oy,
      z0: oz,
      dx: fx,
      dy: 0,
      dz: fz,
      speed,
      range,
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
      const fz = b.vz / b.speed;
      let hitT = dist;
      let hitPlayer = null;
      let hitProp = null;

      for (const o of this.players.values()) {
        if (o.id === b.ownerId || !o.alive) continue;
        const dx = o.body.position.x - ox;
        const dy = o.body.position.y - oy;
        const dz = o.body.position.z - oz;
        const t = dx * fx + dy * 0 + dz * fz;
        if (t < 0 || t > hitT) continue;
        const px = ox + fx * t;
        const pz = oz + fz * t;
        const rad = Math.hypot(px - o.body.position.x, (oy - o.body.position.y) * 0.35, pz - o.body.position.z);
        if (rad < 1.15) {
          hitPlayer = o;
          hitT = t;
        }
      }
      for (const body of props) {
        if (body.userData?.kind === "medkit") continue;
        const t = this.raycastBody(ox, oy, oz, fx, 0, fz, body, hitT);
        if (t == null || t >= hitT) continue;
        hitT = t;
        hitProp = body;
        hitPlayer = null;
      }

      if (hitPlayer || hitProp) {
        const ex = ox + fx * hitT;
        const ey = oy;
        const ez = oz + fz * hitT;
        this.events.push({
          type: "bulletHit",
          x: ex,
          y: ey,
          z: ez,
          hit: !!hitPlayer,
        });
        if (hitProp && hitProp.mass > 0 && hitProp.type !== CANNON.Body.STATIC) {
          hitProp.wakeUp();
          const kick = 14 + Math.min(22, 80 / Math.max(4, hitProp.mass));
          hitProp.velocity.x += fx * kick;
          hitProp.velocity.z += fz * kick;
          hitProp.velocity.y += 5.5;
          hitProp.angularVelocity.x += (Math.random() - 0.5) * 8;
          hitProp.angularVelocity.y += (Math.random() - 0.5) * 10;
          hitProp.angularVelocity.z += (Math.random() - 0.5) * 8;
        }
        if (hitPlayer) {
          const shooter = this.players.get(b.ownerId);
          hitPlayer.hp = Math.max(0, (hitPlayer.hp ?? 100) - 20);
          hitPlayer.lastHitBy = b.ownerId;
          hitPlayer.lastHitAt = this.roundT;
          hitPlayer.body.velocity.x += fx * 4.5;
          hitPlayer.body.velocity.z += fz * 4.5;
          hitPlayer.body.velocity.y += 1.5;
          this.events.push({
            type: "hit",
            by: b.by || shooter?.name || "?",
            victim: hitPlayer.name,
            id: hitPlayer.id,
            hp: hitPlayer.hp,
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
    // Client still reads one debris list — merge goats + medkits with explicit kind
    const debrisOut = [...debris, ...goats, ...medkits];
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
      players,
      boxes,
      debris: debrisOut,
      shards: this.shardSnapshot(),
      events: ev,
    };
  }
}
