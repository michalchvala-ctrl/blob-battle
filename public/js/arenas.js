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
  random: { name: "Náhodný", blurb: "Každé kolo iný tvar" },
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
    default:
      return buildPresetLayout("circle");
  }
}

/** Procedural 3–6 islands (boxes / cylinders). */
export function buildProceduralLayout() {
  const n = 3 + ((Math.random() * 4) | 0);
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 4 + Math.random() * 7;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    if (Math.random() < 0.55) {
      pieces.push(cyl(x, z, 2.4 + Math.random() * 2.4));
    } else {
      const w = 4 + Math.random() * 5;
      const d = 4 + Math.random() * 5;
      pieces.push(box(x, z, w, d, Math.random() * Math.PI));
    }
  }
  return layout("proc", pieces);
}

/**
 * Resolve lobby selection to a concrete layout.
 * `random` → preset or procedural each call.
 */
export function resolveArenaLayout(arenaId) {
  if (arenaId === "random") {
    if (Math.random() < 0.55) {
      const id = PRESET_IDS[(Math.random() * PRESET_IDS.length) | 0];
      return buildPresetLayout(id);
    }
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
