/** Shared arena presets: piece descriptors for physics (server) + visuals (client). */

export const ARENA_INFO = {
  circle: { name: "Kruh", blurb: "Klasický disk" },
  square: { name: "Štvorec", blurb: "Plošina do štvorca" },
  donut: { name: "Donut", blurb: "Diera v strede" },
  bridge: { name: "Most", blurb: "Dva ostrovy + most" },
  plus: { name: "Plus", blurb: "Krížová plocha" },
  triangle: { name: "Trojuholník", blurb: "Tri hrany" },
  eight: { name: "Ósemka", blurb: "Dva prekrývajúce kruhy" },
  star: { name: "Hviezda", blurb: "Okvetné lístky" },
  corridor: { name: "Cesta", blurb: "Dlhá chodba" },
  islands: { name: "Ostrovčeky", blurb: "Niekoľko plošín" },
  random: { name: "Generovaná", blurb: "Nový náhodný tvar každé kolo" },
};

export const PRESET_IDS = [
  "circle",
  "square",
  "donut",
  "bridge",
  "plus",
  "triangle",
  "eight",
  "star",
  "corridor",
  "islands",
];

export const ARENA_IDS = [...PRESET_IDS, "random"];

const H = 1.15;

function cyl(x, z, r) {
  return { t: "cyl", x, z, r, h: H };
}

function box(x, z, w, d, rotY = 0) {
  return { t: "box", x, z, w, d, h: H, rotY };
}

/** Triangular prism — 3-gon cylinder look. */
function tri(x, z, r) {
  return { t: "tri", x, z, r, h: H };
}

function spawnsOnPieces(pieces, n = 8) {
  const solid = pieces.filter((p) => p.t === "cyl" || p.t === "box" || p.t === "tri");
  if (!solid.length) return [{ x: 0, z: 0 }];
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = solid[i % solid.length];
    const ang = (i / n) * Math.PI * 2;
    let sx = p.x;
    let sz = p.z;
    if (p.t === "cyl" || p.t === "tri") {
      const rr = Math.min(p.r * 0.45, 4.5);
      sx += Math.cos(ang) * rr;
      sz += Math.sin(ang) * rr;
    } else {
      const hx = p.w * 0.28;
      const hz = p.d * 0.28;
      sx += Math.cos(ang) * hx;
      sz += Math.sin(ang) * hz;
    }
    out.push({ x: sx, z: sz });
  }
  return out;
}

function boundsRadius(pieces) {
  let m = 8;
  for (const p of pieces) {
    if (p.t === "cyl" || p.t === "tri") {
      m = Math.max(m, Math.hypot(p.x, p.z) + p.r);
    } else {
      const half = Math.hypot(p.w, p.d) * 0.5;
      m = Math.max(m, Math.hypot(p.x, p.z) + half);
    }
  }
  return m + 0.5;
}

function layout(id, pieces) {
  return {
    id,
    pieces,
    radius: boundsRadius(pieces),
    spawns: spawnsOnPieces(pieces),
  };
}

export function buildPresetLayout(id) {
  switch (id) {
    case "circle":
      return layout("circle", [cyl(0, 0, 13)]);
    case "square":
      return layout("square", [box(0, 0, 22, 22)]);
    case "donut": {
      const pieces = [];
      const n = 22;
      const mid = 9.2;
      const thick = 4.2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pieces.push(box(Math.cos(a) * mid, Math.sin(a) * mid, thick, (2 * Math.PI * mid) / n + 0.35, a));
      }
      return layout("donut", pieces);
    }
    case "bridge":
      return layout("bridge", [cyl(-9.2, 0, 5.2), cyl(9.2, 0, 5.2), box(0, 0, 10.5, 3.4)]);
    case "plus":
      return layout("plus", [box(0, 0, 24, 5.8), box(0, 0, 5.8, 24)]);
    case "triangle":
      return layout("triangle", [tri(0, 0, 14)]);
    case "eight":
      return layout("eight", [cyl(-5.6, 0, 7.2), cyl(5.6, 0, 7.2)]);
    case "star": {
      const pieces = [cyl(0, 0, 4.2)];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        pieces.push(box(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 9.5, 3.1, a));
      }
      return layout("star", pieces);
    }
    case "corridor":
      return layout("corridor", [box(0, 0, 7.2, 34)]);
    case "islands":
      return layout("islands", [
        cyl(7.2, 6.4, 3.4),
        cyl(-7.4, 5.8, 3.2),
        cyl(-6.2, -6.8, 3.5),
        cyl(6.8, -6.2, 3.3),
        cyl(0, 0, 2.6),
      ]);
    case "battlefield":
      return layout("battlefield", [
        cyl(0, 0, 36),
        box(0, 0, 28, 28),
        cyl(-28, -18, 8),
        cyl(28, -18, 8),
        cyl(-28, 18, 8),
        cyl(28, 18, 8),
        box(0, -32, 18, 8),
        box(0, 32, 18, 8),
        box(-32, 0, 8, 18),
        box(32, 0, 8, 18),
      ]);
    default:
      return buildPresetLayout("circle");
  }
}

const PROC_COLORS = ["#ff7ad9", "#ff8ec4", "#e87ad9", "#ff9ad0", "#f06bb8", "#ffa0d8"];

function tint(piece, i) {
  piece.color = PROC_COLORS[i % PROC_COLORS.length];
  return piece;
}

/** Overlapping blob — one walkable mass of random boxes/cylinders. */
function proceduralBlob() {
  const n = 4 + ((Math.random() * 5) | 0); // 4–8
  const pieces = [tint(cyl(0, 0, 3.2 + Math.random() * 2.2), 0)];
  for (let i = 1; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 2.2 + Math.random() * 5.5;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    if (Math.random() < 0.5) {
      pieces.push(tint(cyl(x, z, 2.6 + Math.random() * 2.8), i));
    } else {
      pieces.push(
        tint(box(x, z, 4.2 + Math.random() * 5.5, 4.2 + Math.random() * 5.5, Math.random() * Math.PI), i),
      );
    }
  }
  return pieces;
}

/** Ring of pads linked by short bridges — fun for chase / sumo. */
function proceduralRing() {
  const n = 3 + ((Math.random() * 4) | 0); // 3–6 pads
  const R = 6.5 + Math.random() * 3.5;
  const pieces = [];
  const pads = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.2;
    const x = Math.cos(ang) * R;
    const z = Math.sin(ang) * R;
    pads.push({ x, z, ang });
    if (Math.random() < 0.55) {
      pieces.push(tint(cyl(x, z, 2.8 + Math.random() * 1.8), i));
    } else {
      pieces.push(tint(box(x, z, 5 + Math.random() * 2.5, 5 + Math.random() * 2.5, ang), i));
    }
  }
  // Bridges between neighbors (+ optional hub)
  for (let i = 0; i < n; i++) {
    const a = pads[i];
    const b = pads[(i + 1) % n];
    const mx = (a.x + b.x) * 0.5;
    const mz = (a.z + b.z) * 0.5;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const rot = Math.atan2(b.x - a.x, b.z - a.z);
    pieces.push(tint(box(mx, mz, 3.2 + Math.random() * 1.2, Math.max(4.5, len * 0.92), rot), n + i));
  }
  if (Math.random() < 0.65) {
    pieces.push(tint(cyl(0, 0, 2.4 + Math.random() * 1.6), n * 2));
  }
  return pieces;
}

/** Irregular outline approximated by rotated boxes + center fill. */
function proceduralPoly() {
  const n = 5 + ((Math.random() * 4) | 0); // 5–8 edges
  const pieces = [];
  const verts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const r = 7 + Math.random() * 5;
    verts.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r });
  }
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const mx = (a.x + b.x) * 0.5;
    const mz = (a.z + b.z) * 0.5;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const rot = Math.atan2(b.x - a.x, b.z - a.z);
    pieces.push(tint(box(mx, mz, 4.5 + Math.random() * 2, Math.max(5, len * 1.05), rot), i));
  }
  pieces.push(tint(cyl(0, 0, 4 + Math.random() * 2.5), n));
  // A few interior blobs so the middle is not empty
  const extras = 1 + ((Math.random() * 2) | 0);
  for (let i = 0; i < extras; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 2 + Math.random() * 4;
    pieces.push(
      tint(
        Math.random() < 0.5
          ? cyl(Math.cos(ang) * dist, Math.sin(ang) * dist, 2.5 + Math.random() * 2)
          : box(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              4 + Math.random() * 3,
              4 + Math.random() * 3,
              Math.random() * Math.PI,
            ),
        n + 1 + i,
      ),
    );
  }
  return pieces;
}

/**
 * True procedural arena (never a preset). Walkable for 2+ players:
 * overlapping blob, bridged ring, or irregular polygon-ish mass.
 */
export function buildProceduralLayout() {
  const roll = Math.random();
  let pieces;
  if (roll < 0.34) pieces = proceduralBlob();
  else if (roll < 0.67) pieces = proceduralRing();
  else pieces = proceduralPoly();
  // Clamp to a sensible playable footprint
  const L = layout("random", pieces);
  if (L.radius > 22) {
    const s = 22 / L.radius;
    for (const p of pieces) {
      p.x *= s;
      p.z *= s;
      if (p.t === "cyl" || p.t === "tri") p.r *= s;
      else {
        p.w *= s;
        p.d *= s;
      }
    }
    return layout("random", pieces);
  }
  return L;
}

/**
 * Resolve lobby selection to a concrete layout.
 * `random` → brand-new procedural shape every call (lobby preview + each round).
 */
export function resolveArenaLayout(arenaId) {
  if (arenaId === "random" || arenaId === "nahodny") {
    return buildProceduralLayout();
  }
  return buildPresetLayout(arenaId);
}

export function pointOverPiece(x, z, p, slack = 0) {
  if (p.t === "cyl" || p.t === "tri") {
    return Math.hypot(x - p.x, z - p.z) <= p.r + slack;
  }
  if (p.t === "box") {
    const dx = x - p.x;
    const dz = z - p.z;
    const c = Math.cos(-(p.rotY || 0));
    const s = Math.sin(-(p.rotY || 0));
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    return Math.abs(lx) <= p.w * 0.5 + slack && Math.abs(lz) <= p.d * 0.5 + slack;
  }
  return false;
}

export function pointOverLayout(x, z, pieces, slack = 0) {
  if (!pieces?.length) return Math.hypot(x, z) <= 13 + slack;
  return pieces.some((p) => pointOverPiece(x, z, p, slack));
}
