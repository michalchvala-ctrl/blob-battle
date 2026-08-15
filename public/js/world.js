import * as THREE from "three";

const gradient = (() => {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 1;
  const g = c.getContext("2d");
  const cols = ["#444", "#888", "#ccc", "#fff"];
  cols.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
})();

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...opts });
}

function makeLabel(text) {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 80;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 320, 80);
  ctx.fillStyle = "rgba(10, 4, 16, 0.55)";
  ctx.fillRect(20, 18, 280, 48);
  ctx.font = "700 28px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff7fb";
  ctx.fillText(text.slice(0, 16), 160, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false }),
  );
  spr.scale.set(2.4, 0.6, 1);
  spr.position.y = 1.75;
  spr.userData.tex = tex;
  return spr;
}

export function createJelly(color, name) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const mat = toon(color);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 22, 16), mat);
  belly.scale.set(1.05, 1.18, 1.05);
  const bum = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12), mat);
  bum.position.y = -0.55;
  bum.scale.set(1.15, 0.7, 1.15);
  const eyeW = toon("#fff");
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), eyeW);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.22, 0.22, 0.52);
  eyeR.position.set(0.22, 0.22, 0.52);
  const pupilM = toon("#1a1020");
  const pL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilM);
  const pR = pL.clone();
  pL.position.set(-0.22, 0.2, 0.66);
  pR.position.set(0.22, 0.2, 0.66);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toon("#3a1020"));
  mouth.scale.set(1.3, 0.45, 0.6);
  mouth.position.set(0, -0.08, 0.62);
  const armM = toon(color);
  const armL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), armM);
  const armR = armL.clone();
  armL.position.set(-0.72, -0.05, 0.1);
  armR.position.set(0.72, -0.05, 0.1);

  // Boxy blaster held in right hand (shown in Streľba mode)
  const gun = new THREE.Group();
  const gunMat = toon("#3d4454");
  const gunAccent = toon("#d6ff4a");
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.18), gunMat);
  grip.position.set(0, -0.12, 0);
  const bodyG = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.55), gunMat);
  bodyG.position.set(0, 0.06, 0.22);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.45), toon("#2a303c"));
  barrel.position.set(0, 0.08, 0.58);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.1), gunAccent);
  sight.position.set(0, 0.2, 0.15);
  gun.add(grip, bodyG, barrel, sight);
  gun.position.set(0.15, -0.05, 0.35);
  gun.rotation.set(-0.15, 0, -0.2);
  gun.visible = false;
  armR.add(gun);

  const back = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat);
  back.position.set(0, -0.12, -0.52);
  body.add(belly, bum, eyeL, eyeR, pL, pR, mouth, armL, armR, back);
  body.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const label = makeLabel(name || "Želé");
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), toon("#111", { emissive: "#ff2a2a", emissiveIntensity: 0.8 }));
  bomb.visible = false;
  root.add(body, label, shadow, bomb);
  root.userData = {
    body,
    armL,
    armR,
    gun,
    mouth,
    pL,
    pR,
    label,
    shadow,
    bomb,
    color,
    punchT: 0,
    squash: 1,
    landSquash: 0,
    prevVy: 0,
  };
  return root;
}

export class GameWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#14061f");
    this.scene.fog = new THREE.Fog("#14061f", 42, 120);
    this.clock = new THREE.Clock();

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.25, 220);
    this.camera.position.set(18, 14, 18);
    this.yaw = 0;
    this.pitch = 0.14;
    this.camDist = 6.8;
    this.camHeight = 1.9;
    this.snapCam = false;
    this.menuYaw = 0.7;
    this.specYaw = 0;
    this.specPitch = 0.4;
    this.specDist = 28;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight("#9ae6ff", "#4a1848", 1.15);
    const sun = new THREE.DirectionalLight("#ffe7b0", 1.35);
    sun.position.set(18, 28, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.target.position.set(0, 0, 0);
    this.sun = sun;
    this.scene.add(hemi, sun, sun.target, new THREE.AmbientLight("#ff9ad8", 0.18));

    this.arena = new THREE.Group();
    this.pad = new THREE.Group();
    this.props = new THREE.Group();
    this.boxMeshes = new Map();
    this.debrisMeshes = new Map();
    this.arena.add(this.pad, this.props);
    this.scene.add(this.arena);
    this.platform = null;
    this.platformRadius = 13;
    this.baseRadius = 13;
    this.layoutKey = "";
    this.hillMode = false;
    this.shardMeshes = new Map();
    this.buildArena(13);
    this.syncBoxes([
      { id: 0, color: "#5ce1ff", x: 5.2, y: 1.35, z: 2.4, qx: 0, qy: 0, qz: 0, qw: 1 },
      { id: 1, color: "#d6ff4a", x: -4.6, y: 1.35, z: -3.2, qx: 0, qy: 0, qz: 0, qw: 1 },
      { id: 2, color: "#c77dff", x: 0.4, y: 1.35, z: 6.1, qx: 0, qy: 0, qz: 0, qw: 1 },
    ]);
    this.addDecor();

    this.players = new Map();
    this.localId = null;
    this.shake = 0;
    this.followId = null;
    this.spectating = false;
    this.wasSpectating = false;
    this.gunsMode = false;
    this.dummies = [];
    this.spawnDummies();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  clearPad() {
    while (this.pad.children.length) {
      const c = this.pad.children[0];
      this.pad.remove(c);
      c.traverse?.((o) => {
        o.geometry?.dispose?.();
      });
    }
    this.shardMeshes = new Map();
    this.platform = null;
  }

  buildArena(radius, mode = "sumo", shards = null, pieces = null, layoutKey = "", structures = null) {
    this.baseRadius = radius;
    this.platformRadius = radius;
    this.fitViewDistance();
    this.hillMode = mode === "hill";
    this.layoutKey = layoutKey || "";
    this.clearPad();
    while (this.props.children.length) this.props.remove(this.props.children[0]);
    this.boxMeshes = new Map();
    this.debrisMeshes = new Map();
    this.clearStructures();
    this.pad.scale.set(1, 1, 1);

    if (this.hillMode && shards?.length) {
      this.buildCrackedPad(radius, shards);
      return;
    }

    if (pieces?.length) {
      this.buildPadFromPieces(pieces, radius);
      this.buildStructures(structures);
      return;
    }

    const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1.15, 48), toon("#ff7ad9"));
    top.receiveShadow = true;
    top.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.28, 10, 48), toon("#ffd36a"));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.55;
    const icing = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.12, 40),
      toon("#fff1a8"),
    );
    icing.position.y = 0.58;
    icing.receiveShadow = true;
    this.pad.add(top, rim, icing);
    this.platform = top;
    this.buildStructures(structures);
  }

  clearStructures() {
    if (!this.structureGroup) {
      this.structureGroup = new THREE.Group();
      this.arena.add(this.structureGroup);
    }
    while (this.structureGroup.children.length) {
      const c = this.structureGroup.children[0];
      this.structureGroup.remove(c);
      c.traverse?.((o) => o.geometry?.dispose?.());
    }
  }

  buildStructures(list) {
    this.clearStructures();
    if (!list?.length) return;
    for (const s of list) {
      this.structureGroup.add(this.makeStructureMesh(s));
    }
  }

  makeStructureMesh(s) {
    const g = new THREE.Group();
    if (s.kind === "tree") {
      const trunkH = (s.h || 6) * 0.55;
      const canopyR = s.r || 2.2;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, trunkH, 8),
        toon("#6b3f1e"),
      );
      trunk.position.y = 0.575 + trunkH * 0.5;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(canopyR, 10, 8), toon(s.color || "#3ecf6a"));
      leaf.position.y = 0.575 + trunkH + canopyR * 0.55;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      const leaf2 = new THREE.Mesh(
        new THREE.SphereGeometry(canopyR * 0.72, 8, 6),
        toon(s.color || "#2aad52"),
      );
      leaf2.position.set(canopyR * 0.25, leaf.position.y + canopyR * 0.2, -canopyR * 0.15);
      leaf2.castShadow = true;
      g.add(trunk, leaf, leaf2);
    } else {
      const h = s.h || 8;
      const w = s.w || 8;
      const d = s.d || 8;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(s.color || "#ff8ec4"));
      body.position.y = 0.575 + h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.08, Math.min(2.2, h * 0.18), d * 1.08),
        toon("#fff1a8"),
      );
      roof.position.y = 0.575 + h + Math.min(1.1, h * 0.09);
      roof.castShadow = true;
      const winMat = toon("#ffe66d");
      const mkWin = (lx, ly, lz) => {
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.2), winMat);
        wMesh.position.set(lx, ly, lz);
        g.add(wMesh);
      };
      const wy = 0.575 + h * 0.45;
      mkWin(0, wy, d * 0.5 + 0.05);
      mkWin(0, wy, -d * 0.5 - 0.05);
      mkWin(w * 0.5 + 0.05, wy, 0);
      mkWin(-w * 0.5 - 0.05, wy, 0);
      g.add(body, roof);
      if (s.rotY) g.rotation.y = s.rotY;
    }
    g.position.set(s.x || 0, 0, s.z || 0);
    return g;
  }

  buildPadFromPieces(pieces, radius) {
    let maxR = radius || 8;
    for (const p of pieces) {
      this.pad.add(this.makePadPiece(p));
      if (p.t === "cyl" || p.t === "tri") {
        maxR = Math.max(maxR, Math.hypot(p.x, p.z) + p.r);
      } else {
        maxR = Math.max(maxR, Math.hypot(p.x, p.z) + Math.hypot(p.w, p.d) * 0.5);
      }
    }
    this.platformRadius = maxR;
    this.baseRadius = maxR;
    this.platform = this.pad;
    this.fitViewDistance();
  }

  makePadPiece(p) {
    const g = new THREE.Group();
    const h = p.h || 1.15;
    const pink = toon(p.color || "#ff7ad9");
    const gold = toon("#ffd36a");
    const cream = toon("#fff1a8");

    if (p.t === "cyl") {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, h, 40), pink);
      top.castShadow = true;
      top.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(Math.max(0.4, p.r), 0.22, 8, 36), gold);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = h * 0.48;
      const icing = new THREE.Mesh(
        new THREE.CylinderGeometry(p.r * 0.86, p.r * 0.86, 0.1, 32),
        cream,
      );
      icing.position.y = h * 0.5;
      icing.receiveShadow = true;
      g.add(top, rim, icing);
    } else if (p.t === "tri") {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, h, 3), pink);
      top.castShadow = true;
      top.receiveShadow = true;
      const icing = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.88, p.r * 0.88, 0.1, 3), cream);
      icing.position.y = h * 0.5;
      icing.receiveShadow = true;
      // Gold edge strips along triangle sides
      for (let i = 0; i < 3; i++) {
        const a0 = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        const a1 = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / 3;
        const x0 = Math.cos(a0) * p.r;
        const z0 = Math.sin(a0) * p.r;
        const x1 = Math.cos(a1) * p.r;
        const z1 = Math.sin(a1) * p.r;
        const len = Math.hypot(x1 - x0, z1 - z0);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.28), gold);
        edge.position.set((x0 + x1) * 0.5, h * 0.48, (z0 + z1) * 0.5);
        edge.rotation.y = Math.atan2(x1 - x0, z1 - z0);
        g.add(edge);
      }
      g.add(top, icing);
    } else {
      const huge = Math.max(p.w || 0, p.d || 0) > 80;
      const top = new THREE.Mesh(new THREE.BoxGeometry(p.w, h, p.d), pink);
      top.castShadow = !huge;
      top.receiveShadow = true;
      const icing = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.2, p.w - 0.55), 0.1, Math.max(0.2, p.d - 0.55)),
        cream,
      );
      icing.position.y = h * 0.5;
      icing.receiveShadow = true;
      g.add(top, icing);
      if (!huge) {
        const rimW = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.15, 0.18, 0.28), gold);
        rimW.position.set(0, h * 0.48, p.d * 0.5);
        const rimW2 = rimW.clone();
        rimW2.position.z = -p.d * 0.5;
        const rimD = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, p.d + 0.15), gold);
        rimD.position.set(p.w * 0.5, h * 0.48, 0);
        const rimD2 = rimD.clone();
        rimD2.position.x = -p.w * 0.5;
        g.add(rimW, rimW2, rimD, rimD2);
      }
    }

    g.position.set(p.x, 0, p.z);
    if (p.rotY) g.rotation.y = p.rotY;
    return g;
  }

  /** Irregular glass shards with dark crack seams (poly from server). */
  buildCrackedPad(radius, shards) {
    const crackMat = toon("#1a0c14");
    const bodyMat = toon("#f2d9b8");
    const icingMat = toon("#fff8e8");
    const sideMat = toon("#e8a0b8");
    const H = 1.15;

    for (const s of shards) {
      const poly = s.poly;
      if (!poly?.length) continue;

      // Geometry local to shard centroid so physics body pose maps 1:1
      const cx =
        s.cx ??
        poly.reduce((a, p) => a + p.x, 0) / poly.length;
      const cz =
        s.cz ??
        poly.reduce((a, p) => a + p.z, 0) / poly.length;
      const loc = (p) => ({ x: p.x - cx, z: p.z - cz });

      const wedge = new THREE.Group();
      // Shape in XY with y = −z so rotateX(−π/2) lands on world XZ without mirror
      const shape = new THREE.Shape();
      const p0 = loc(poly[0]);
      shape.moveTo(p0.x, -p0.z);
      for (let i = 1; i < poly.length; i++) {
        const p = loc(poly[i]);
        shape.lineTo(p.x, -p.z);
      }
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: H,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      });
      // Extrude +Z → after rotateX(−π/2) spans y=0..H; shift down so slab is ±H/2 (matches physics)
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -H * 0.5, 0);

      const body = new THREE.Mesh(geo, sideMat);
      body.castShadow = true;
      body.receiveShadow = true;

      const inset = (p) => {
        const L = loc(p);
        return { x: L.x * 0.9, z: L.z * 0.9 };
      };
      const icingShape = new THREE.Shape();
      const ip0 = inset(poly[0]);
      icingShape.moveTo(ip0.x, -ip0.z);
      for (let i = 1; i < poly.length; i++) {
        const ip = inset(poly[i]);
        icingShape.lineTo(ip.x, -ip.z);
      }
      icingShape.closePath();
      const icingGeo = new THREE.ExtrudeGeometry(icingShape, {
        depth: 0.09,
        bevelEnabled: false,
        steps: 1,
      });
      icingGeo.rotateX(-Math.PI / 2);
      icingGeo.translate(0, 0.045, 0);
      const icing = new THREE.Mesh(icingGeo, icingMat);
      icing.position.y = H * 0.5 + 0.01;
      icing.receiveShadow = true;

      const topGeo = new THREE.ShapeGeometry(shape);
      topGeo.rotateX(-Math.PI / 2);
      const topCap = new THREE.Mesh(topGeo, bodyMat);
      topCap.position.y = H * 0.5 + 0.002;
      topCap.receiveShadow = true;

      for (let i = 0; i < poly.length; i++) {
        const a = loc(poly[i]);
        const b = loc(poly[(i + 1) % poly.length]);
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.08) continue;
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.085, 1.22, len * 0.98), crackMat);
        crack.position.set((a.x + b.x) * 0.5, 0.02, (a.z + b.z) * 0.5);
        crack.rotation.y = Math.atan2(dx, dz);
        wedge.add(crack);
      }

      wedge.add(body, topCap, icing);
      wedge.position.set(s.x ?? cx, s.y ?? 0, s.z ?? cz);
      if (s.qx != null) wedge.quaternion.set(s.qx, s.qy, s.qz, s.qw);
      wedge.userData = { id: s.id, attached: s.attached !== false, t: s, cx, cz };
      this.pad.add(wedge);
      this.shardMeshes.set(s.id, wedge);
    }

    this.platform = this.pad;
    this.platformRadius = radius;
    this.baseRadius = radius;
  }

  syncShards(list) {
    if (!this.hillMode) return;
    if (!list || !list.length) return;
    if (!this.shardMeshes.size) {
      this.buildCrackedPad(list[0].radius || this.baseRadius, list);
      return;
    }
    const seen = new Set();
    for (const s of list) {
      seen.add(s.id);
      let mesh = this.shardMeshes.get(s.id);
      if (!mesh) {
        this.buildCrackedPad(s.radius || this.baseRadius, list);
        return;
      }
      mesh.userData.t = s;
      mesh.userData.attached = !!s.attached;
      if (!s.attached) {
        // Falling piece — follow physics pose (interpolated in update)
      } else {
        const cx = s.cx ?? mesh.userData.cx ?? 0;
        const cz = s.cz ?? mesh.userData.cz ?? 0;
        mesh.position.set(s.x ?? cx, s.y ?? 0, s.z ?? cz);
        if (s.qx != null) mesh.quaternion.set(s.qx, s.qy, s.qz, s.qw);
        else mesh.quaternion.identity();
      }
    }
    for (const [id, mesh] of this.shardMeshes) {
      if (!seen.has(id)) {
        this.pad.remove(mesh);
        this.shardMeshes.delete(id);
      }
    }
  }

  makeGoatMesh(d) {
    // Obvious Minecraft-style goat from boxes (head + body + 4 legs + horns)
    const fur = "#c4a574";
    const dark = "#5a3d2a";
    const cream = "#f3ead4";
    const black = "#1a1210";
    const root = new THREE.Group();
    const legs = [];

    const box = (w, h, dep, col, x, y, z, parent = root) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), toon(col));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // Pivot at body center (matches physics box center). Face +Z.
    // Body
    box(1.1, 0.85, 1.6, fur, 0, 0.15, 0);
    // Chest fluff
    box(0.95, 0.4, 0.7, "#d7bc96", 0, -0.1, 0.35);
    // Neck
    box(0.45, 0.55, 0.4, fur, 0, 0.55, 0.85);
    // Head
    box(0.7, 0.6, 0.7, fur, 0, 0.85, 1.25);
    // Snout
    box(0.42, 0.28, 0.4, cream, 0, 0.7, 1.65);
    // Eyes
    box(0.12, 0.12, 0.1, black, -0.2, 0.98, 1.58);
    box(0.12, 0.12, 0.1, black, 0.2, 0.98, 1.58);
    // Ears
    box(0.18, 0.28, 0.1, fur, -0.45, 1.1, 1.15);
    box(0.18, 0.28, 0.1, fur, 0.45, 1.1, 1.15);
    // Horns
    const hL = box(0.14, 0.55, 0.14, cream, -0.22, 1.35, 1.1);
    hL.rotation.set(-0.4, 0, 0.45);
    const hR = box(0.14, 0.55, 0.14, cream, 0.22, 1.35, 1.1);
    hR.rotation.set(-0.4, 0, -0.45);
    // Beard
    box(0.16, 0.35, 0.12, cream, 0, 0.45, 1.7);
    // Tail
    box(0.14, 0.14, 0.35, dark, 0, 0.35, -0.9);

    const spots = [
      [-0.35, 0.45],
      [0.35, 0.45],
      [-0.35, -0.5],
      [0.35, -0.5],
    ];
    for (const [lx, lz] of spots) {
      const leg = new THREE.Group();
      leg.position.set(lx, -0.15, lz);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), toon(fur));
      upper.position.y = -0.2;
      upper.castShadow = true;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), toon(dark));
      lower.position.y = -0.6;
      lower.castShadow = true;
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.26), toon(black));
      hoof.position.y = -0.88;
      hoof.castShadow = true;
      leg.add(upper, lower, hoof);
      root.add(leg);
      legs.push(leg);
    }

    root.userData.legs = legs;
    root.userData.isGoat = true;
    root.userData.kind = "goat";
    root.position.set(d.x || 0, d.y || 0, d.z || 0);
    root.rotation.y = (d.yaw ?? 0) + Math.PI;
    return root;
  }

  makeMedkitMesh(d) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), toon("#2ecc71"));
    box.castShadow = true;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.12), toon("#fff"));
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.12), toon("#fff"));
    crossV.position.y = 0.05;
    crossH.position.y = 0.05;
    crossV.position.z = 0.36;
    crossH.position.z = 0.36;
    g.add(box, crossV, crossH);
    g.position.set(d.x, d.y, d.z);
    g.quaternion.set(d.qx, d.qy, d.qz, d.qw);
    return g;
  }

  spawnShotTrail(ev) {
    if (!ev) return;
    // Flying projectile (50% slower than old instant beam feel)
    if (ev.speed != null && ev.dx != null) {
      const speed = ev.speed;
      const range = ev.range || 120;
      const dir = new THREE.Vector3(ev.dx, ev.dy || 0, ev.dz).normalize();
      const geo = new THREE.SphereGeometry(0.18, 8, 6);
      const mat = new THREE.MeshBasicMaterial({ color: "#ffe66d" });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ev.x0, ev.y0 || 0, ev.z0);
      this.scene.add(mesh);
      const trail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5),
        new THREE.MeshBasicMaterial({ color: "#ffb703", transparent: true, opacity: 0.7 }),
      );
      trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.scene.add(trail);
      const born = performance.now();
      const dur = (range / speed) * 1000;
      const tick = () => {
        const age = (performance.now() - born) / dur;
        if (age >= 1) {
          this.scene.remove(mesh);
          this.scene.remove(trail);
          geo.dispose();
          mat.dispose();
          trail.geometry.dispose();
          trail.material.dispose();
          return;
        }
        const d = age * range;
        mesh.position.set(ev.x0 + dir.x * d, (ev.y0 || 0) + dir.y * d, ev.z0 + dir.z * d);
        trail.position.copy(mesh.position).addScaledVector(dir, -0.45);
        trail.material.opacity = 0.7 * (1 - age * 0.5);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return;
    }
    const dir = new THREE.Vector3(ev.x1 - ev.x0, (ev.y1 || 0) - (ev.y0 || 0), ev.z1 - ev.z0);
    const len = Math.max(0.5, dir.length());
    dir.normalize();
    const geo = new THREE.CylinderGeometry(0.04, 0.04, len, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: ev.hit ? "#ff6b6b" : "#ffe66d",
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((ev.x0 + ev.x1) / 2, ((ev.y0 || 0) + (ev.y1 || 0)) / 2, (ev.z0 + ev.z1) / 2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(mesh);
    const born = performance.now();
    const tick = () => {
      const age = (performance.now() - born) / 180;
      if (age >= 1) {
        this.scene.remove(mesh);
        geo.dispose();
        mat.dispose();
        return;
      }
      mat.opacity = 0.85 * (1 - age);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  makeDebrisMesh(d) {
    if (d.kind === "goat") return this.makeGoatMesh(d);
    if (d.kind === "medkit") return this.makeMedkitMesh(d);
    const color = d.color || "#ff9e00";
    let geo;
    if (d.kind === "sphere") {
      const r = d.sx || 0.5;
      geo = new THREE.SphereGeometry(r, 16, 12);
    } else if (d.kind === "cylinder") {
      const r = d.sx || 0.4;
      const h = d.sy || 0.8;
      geo = new THREE.CylinderGeometry(r, r, h, 14);
    } else {
      geo = new THREE.BoxGeometry(d.sx || 1, d.sy || 1, d.sz || 1);
    }
    const mesh = new THREE.Mesh(geo, toon(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(d.x, d.y, d.z);
    mesh.quaternion.set(d.qx, d.qy, d.qz, d.qw);
    return mesh;
  }

  syncBoxes(list) {
    if (!list) list = [];
    if (!this.boxMeshes) this.boxMeshes = new Map();
    const seen = new Set();
    for (const b of list) {
      seen.add(b.id);
      let mesh = this.boxMeshes.get(b.id);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.7, 1.4), toon(b.color || "#5ce1ff"));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(b.x, b.y, b.z);
        mesh.quaternion.set(b.qx, b.qy, b.qz, b.qw);
        this.props.add(mesh);
        this.boxMeshes.set(b.id, mesh);
      }
      mesh.userData.t = b;
    }
    for (const [id, mesh] of this.boxMeshes) {
      if (!seen.has(id)) {
        this.props.remove(mesh);
        this.boxMeshes.delete(id);
      }
    }
  }

  syncDebris(list) {
    if (!list) list = [];
    if (!this.debrisMeshes) this.debrisMeshes = new Map();
    const seen = new Set();
    for (const d of list) {
      seen.add(d.id);
      let mesh = this.debrisMeshes.get(d.id);
      const wantGoat = d.kind === "goat";
      if (mesh && wantGoat && !mesh.userData.isGoat) {
        this.props.remove(mesh);
        mesh.geometry?.dispose?.();
        this.debrisMeshes.delete(d.id);
        mesh = null;
      }
      if (!mesh) {
        mesh = this.makeDebrisMesh(d);
        this.props.add(mesh);
        this.debrisMeshes.set(d.id, mesh);
      }
      mesh.userData.t = d;
      if (wantGoat) mesh.userData.isGoat = true;
    }
    for (const [id, mesh] of this.debrisMeshes) {
      if (!seen.has(id)) {
        this.props.remove(mesh);
        mesh.traverse?.((o) => {
          o.geometry?.dispose?.();
        });
        mesh.geometry?.dispose?.();
        this.debrisMeshes.delete(id);
      }
    }
  }

  setVisualRadius(radius) {
    if (!radius || !this.baseRadius) return;
    if (this.hillMode) {
      this.platformRadius = radius;
      this.fitViewDistance();
      return;
    }
    this.platformRadius = radius;
    const s = radius / this.baseRadius;
    this.pad.scale.set(s, 1, s);
    this.fitViewDistance();
  }

  fitViewDistance() {
    const r = Math.max(this.platformRadius || 13, 8);
    const far = Math.max(220, r * 3.5 + 100);
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog) {
      this.scene.fog.near = Math.min(90, Math.max(28, r * 0.22));
      this.scene.fog.far = Math.min(far * 0.9, Math.max(120, r * 2.6 + 50));
    }
  }

  /** Rebuild when layout changes; hill uses shards; otherwise solid pieces/pad. */
  buildArenaMaybe(radius, mode, shards, pieces, layoutKey, structures = null) {
    if (mode === "hill" && shards?.length) {
      if (!this.hillMode || !this.shardMeshes.size || (layoutKey && layoutKey !== this.layoutKey)) {
        this.buildArena(radius || shards[0].radius || 13, "hill", shards, null, layoutKey, null);
      } else {
        this.syncShards(shards);
      }
      if (radius) this.platformRadius = radius;
      return;
    }
    if (layoutKey && layoutKey !== this.layoutKey) {
      this.buildArena(
        radius || this.platformRadius || 13,
        mode === "hill" ? "sumo" : mode || "sumo",
        null,
        pieces,
        layoutKey,
        structures,
      );
      return;
    }
    // Left hill / lobby / sumo-bomb: solid pad, never keep cracked glass
    if (this.hillMode) {
      this.buildArena(
        radius || this.baseRadius || 13,
        mode === "hill" ? "sumo" : mode || "sumo",
        null,
        pieces,
        layoutKey,
        structures,
      );
      return;
    }
    if (!radius) return;
    if (Math.abs(radius - this.platformRadius) < 0.015) return;
    if (radius > this.platformRadius + 0.4 || !this.baseRadius) {
      this.buildArena(radius, mode || "sumo", null, pieces, layoutKey, structures);
      return;
    }
    this.setVisualRadius(radius);
  }

  addDecor() {
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 + Math.random() * 1.4, 10, 8),
        toon(["#3b0d4a", "#6b1d7a", "#24112f", "#4cc9f0"][i % 4]),
      );
      const a = Math.random() * Math.PI * 2;
      const r = 22 + Math.random() * 38;
      m.position.set(Math.cos(a) * r, -8 + Math.random() * 22, Math.sin(a) * r);
      m.castShadow = true;
      this.scene.add(m);
    }
    const voidPlane = new THREE.Mesh(
      new THREE.CircleGeometry(90, 40),
      new THREE.MeshBasicMaterial({ color: "#2a0838", transparent: true, opacity: 0.35 }),
    );
    voidPlane.rotation.x = -Math.PI / 2;
    voidPlane.position.y = -18;
    this.scene.add(voidPlane);
  }

  spawnDummies() {
    const cols = ["#ff4d6d", "#4cc9f0", "#b8f25a"];
    const r = 5.5;
    for (let i = 0; i < 3; i++) {
      const j = createJelly(cols[i], ["Mišo", "Fero", "Želé"][i]);
      const a = (i / 3) * Math.PI * 2;
      j.position.set(Math.cos(a) * r, 1.15, Math.sin(a) * r);
      // Face tangent of +orbit (eyes are on +Z).
      j.rotation.y = -a;
      this.scene.add(j);
      this.dummies.push({ mesh: j, a, hop: i, spin: 1, hit: false });
    }
  }

  /** Menu-only: sphere vs static box AABB in XZ; returns true if pushed. */
  resolveMenuDummyBox(pos) {
    if (!this.boxMeshes?.size) return false;
    const jellyR = 0.78;
    const hx = 0.7;
    const hy = 0.85;
    const hz = 0.7;
    let hit = false;
    for (const mesh of this.boxMeshes.values()) {
      const bx = mesh.position.x;
      const by = mesh.position.y;
      const bz = mesh.position.z;
      if (pos.y < by - hy - 0.55 || pos.y > by + hy + 0.95) continue;
      const cx = THREE.MathUtils.clamp(pos.x, bx - hx, bx + hx);
      const cz = THREE.MathUtils.clamp(pos.z, bz - hz, bz + hz);
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      let distSq = dx * dx + dz * dz;
      if (distSq >= jellyR * jellyR) continue;
      hit = true;
      if (distSq < 1e-8) {
        const penX = hx + jellyR - Math.abs(pos.x - bx);
        const penZ = hz + jellyR - Math.abs(pos.z - bz);
        if (penX < penZ) pos.x = bx + Math.sign(pos.x - bx || 1) * (hx + jellyR);
        else pos.z = bz + Math.sign(pos.z - bz || 1) * (hz + jellyR);
      } else {
        const dist = Math.sqrt(distSq);
        const push = (jellyR - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
    return hit;
  }

  clearDummies() {
    for (const d of this.dummies) this.scene.remove(d.mesh);
    this.dummies = [];
  }

  setLocal(id) {
    this.localId = id;
    this.followId = id;
    this.clearDummies();
    this.snapCam = true;
  }

  syncPlayers(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let rec = this.players.get(p.id);
      if (!rec) {
        const mesh = createJelly(p.color, p.name);
        this.scene.add(mesh);
        rec = { mesh, t: p };
        this.players.set(p.id, rec);
      }
      rec.t = p;
      rec.mesh.userData.label.material.map.needsUpdate = false;
    }
    for (const [id, rec] of this.players) {
      if (!seen.has(id)) {
        this.scene.remove(rec.mesh);
        this.players.delete(id);
      }
    }
  }

  look(dx, dy) {
    // Pointer-lock / focus often emits huge movementX/Y spikes (~π yaw). Ignore them.
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (Math.abs(dx) > 80 || Math.abs(dy) > 80) return;
    dx = THREE.MathUtils.clamp(dx, -40, 40);
    dy = THREE.MathUtils.clamp(dy, -40, 40);
    if (this.spectating) {
      this.specYaw -= dx * 0.003;
      this.specPitch = THREE.MathUtils.clamp(this.specPitch + dy * 0.0022, 0.06, 0.82);
      return;
    }
    this.yaw -= dx * 0.0024;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0022, -0.2, 0.62);
  }

  zoom(deltaY) {
    const step = Math.sign(deltaY) * 1.15;
    if (this.spectating) {
      const maxD = Math.max(56, this.platformRadius * 0.55 + 20);
      this.specDist = THREE.MathUtils.clamp(this.specDist + step * 2.2, 12, maxD);
    } else {
      this.camDist = THREE.MathUtils.clamp(this.camDist + step, 3.2, 18);
    }
  }

  addShake(n = 0.35) {
    this.shake = Math.min(1.2, this.shake + n);
  }

  update(_playing) {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    if (this.dummies.length) {
      const r = 5.5;
      const omega = 0.35;
      for (const d of this.dummies) {
        const pos = d.mesh.position;
        const spin = d.spin || 1;
        // Tangential hop around island (spin flips on cube hit).
        pos.x += -Math.sin(d.a) * spin * omega * r * dt;
        pos.z += Math.cos(d.a) * spin * omega * r * dt;
        const curR = Math.hypot(pos.x, pos.z) || r;
        const pull = Math.min(1, 5 * dt);
        const nr = curR + (r - curR) * pull;
        pos.x *= nr / curR;
        pos.z *= nr / curR;
        pos.y = 1.15 + Math.abs(Math.sin(t * 3 + d.hop)) * 0.35;
        const hit = this.resolveMenuDummyBox(pos);
        if (hit && !d.hit) d.spin = -(d.spin || 1);
        d.hit = hit;
        d.a = Math.atan2(pos.z, pos.x);
        // Face travel: +orbit → -a; reverse → -a+π (eyes on +Z).
        d.mesh.rotation.y = -d.a + ((d.spin || 1) < 0 ? Math.PI : 0);
        d.mesh.userData.body.scale.y = 1 + Math.sin(t * 6 + d.hop) * 0.06;
      }
      // Menu orbit only — never touch play yaw/pitch.
      this.menuYaw += dt * 0.12;
      const ox = Math.sin(this.menuYaw) * 18;
      const oz = Math.cos(this.menuYaw) * 18;
      this.camera.position.lerp(new THREE.Vector3(ox, 8, oz), 0.12);
      this.camera.lookAt(0, 1.2, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.boxMeshes) {
      const bk = 1 - Math.exp(-18 * dt);
      for (const mesh of this.boxMeshes.values()) {
        const b = mesh.userData.t;
        if (!b) continue;
        mesh.position.lerp(new THREE.Vector3(b.x, b.y, b.z), bk);
        mesh.quaternion.slerp(new THREE.Quaternion(b.qx, b.qy, b.qz, b.qw), bk);
        mesh.visible = b.y > -18;
      }
    }
    if (this.debrisMeshes) {
      const dk = 1 - Math.exp(-16 * dt);
      for (const mesh of this.debrisMeshes.values()) {
        const d = mesh.userData.t;
        if (!d) continue;
        mesh.position.lerp(new THREE.Vector3(d.x, d.y, d.z), dk);
        if (mesh.userData.isGoat || d.kind === "goat") {
          // Mesh faces +Z; yaw 0 = world -Z (player convention)
          mesh.rotation.set(0, (d.yaw ?? 0) + Math.PI, 0);
          const spd = Math.hypot(d.vx || 0, d.vz || 0);
          const legs = mesh.userData.legs || [];
          const swing = spd > 0.35 ? Math.sin(t * 10) * Math.min(1.0, spd * 0.28) : 0;
          legs.forEach((leg, i) => {
            leg.rotation.x = i % 2 === 0 ? swing : -swing;
          });
        } else {
          mesh.quaternion.slerp(new THREE.Quaternion(d.qx, d.qy, d.qz, d.qw), dk);
        }
        mesh.visible = d.y > -20;
      }
    }
    if (this.shardMeshes?.size) {
      const sk = 1 - Math.exp(-18 * dt);
      for (const mesh of this.shardMeshes.values()) {
        const s = mesh.userData.t;
        if (!s) continue;
        if (s.attached) {
          const cx = s.cx ?? mesh.userData.cx ?? 0;
          const cz = s.cz ?? mesh.userData.cz ?? 0;
          mesh.position.set(s.x ?? cx, s.y ?? 0, s.z ?? cz);
          if (s.qx != null) mesh.quaternion.set(s.qx, s.qy, s.qz, s.qw);
          else mesh.quaternion.identity();
          mesh.visible = true;
        } else {
          mesh.position.lerp(new THREE.Vector3(s.x, s.y, s.z), sk);
          mesh.quaternion.slerp(new THREE.Quaternion(s.qx, s.qy, s.qz, s.qw), sk);
          mesh.visible = s.y > -22;
        }
      }
    }

    for (const rec of this.players.values()) {
      const p = rec.t;
      const m = rec.mesh;
      const local = p.id === this.localId;
      const k = 1 - Math.exp((local ? -28 : -14) * dt);
      const pred = local ? 0.04 : 0.02;
      m.position.lerp(new THREE.Vector3(p.x + p.vx * pred, p.y, p.z + p.vz * pred), k);
      // Face move direction (server fwd = -sin/cos yaw). Local uses mouse yaw only — never network.
      const faceYaw = local ? this.yaw : p.yaw;
      m.rotation.y = faceYaw + Math.PI;
      m.rotation.x = 0;
      m.rotation.z = 0;
      m.visible = p.y > -20;
      const ud = m.userData;
      ud.label.visible = !local && !this.gunsMode && !!p.alive;
      const spd = Math.hypot(p.vx, p.vz);
      const wobble = p.alive && spd > 0.8 ? Math.sin(t * 8) * Math.min(0.35, spd * 0.04) : 0;

      // Soft jelly land squash from impact — scale only, never push mesh through floor
      const PLATFORM_TOP = 0.575;
      const REST_Y = PLATFORM_TOP + 0.62;
      const nearPad = Math.hypot(m.position.x, m.position.z) < this.platformRadius + 0.6;
      const wasFalling = ud.prevVy < -2.2;
      const landed =
        p.alive &&
        wasFalling &&
        p.vy > ud.prevVy - 0.5 &&
        p.y < REST_Y + 0.55 &&
        nearPad;
      if (landed) {
        ud.landSquash = Math.min(1, Math.max(ud.landSquash, Math.abs(ud.prevVy) / 11));
      }
      ud.landSquash = Math.max(0, ud.landSquash - dt * 3.8);
      ud.prevVy = p.vy;

      const jelly = ud.landSquash;
      let targetSy = p.alive ? 1 + Math.abs(wobble) * 0.08 : 0.7;
      let targetSx = p.alive ? 1 - Math.abs(wobble) * 0.06 : 1.2;
      let targetSz = targetSx;
      if (jelly > 0.01) {
        targetSy = 1 - jelly * 0.42;
        targetSx = 1 + jelly * 0.32;
        targetSz = targetSx;
      } else if (p.alive && p.vy > 0.8) {
        // stretch slightly while rising, not while digging down
        targetSy += Math.min(0.12, p.vy * 0.02);
        targetSx -= Math.min(0.08, p.vy * 0.012);
        targetSz = targetSx;
      }
      ud.body.position.y = THREE.MathUtils.lerp(ud.body.position.y, 0, 0.3);
      ud.body.scale.y = THREE.MathUtils.lerp(ud.body.scale.y, targetSy, 0.28);
      ud.body.scale.x = THREE.MathUtils.lerp(ud.body.scale.x, targetSx, 0.28);
      ud.body.scale.z = THREE.MathUtils.lerp(ud.body.scale.z, targetSz, 0.28);

      const guns = this.gunsMode && p.alive;
      if (ud.gun) ud.gun.visible = guns;
      if (guns) {
        // Aim pose — right arm forward with blaster
        const kick = p.shoot ? -0.55 : -0.25;
        ud.armR.rotation.x = kick;
        ud.armR.rotation.z = -0.35;
        ud.armR.rotation.y = -0.15;
        ud.armL.rotation.x = -0.2;
        ud.armL.rotation.z = 0.35;
        if (ud.gun) {
          ud.gun.rotation.x = p.shoot ? -0.35 : -0.1;
          ud.gun.position.z = p.shoot ? 0.28 : 0.35;
        }
      } else {
        ud.armL.rotation.x = p.punch ? -0.4 : -wobble * 0.9;
        ud.armL.rotation.z = p.punch ? 0.9 : 0.15 + wobble * 0.2;
        ud.armL.rotation.y = 0;
        ud.armR.rotation.x = p.punch ? -1.1 : wobble * 0.9;
        ud.armR.rotation.z = p.punch ? -1.3 : -0.15 - wobble * 0.2;
        ud.armR.rotation.y = 0;
      }
      ud.bomb.visible = false;

      // Pin shadow to platform surface (stable; no flicker when y dips)
      const shadowWorldY = PLATFORM_TOP + 0.02;
      ud.shadow.position.set(0, shadowWorldY - m.position.y, 0);
      const heightAbove = Math.max(0, m.position.y - REST_Y);
      const shadowOp = nearPad && p.alive && m.position.y > -2
        ? 0.28 * THREE.MathUtils.clamp(1 - heightAbove * 0.12, 0.1, 1)
        : 0;
      ud.shadow.visible = shadowOp > 0.04;
      ud.shadow.material.opacity = shadowOp;
      const op = p.alive ? 1 : 0.35;
      m.traverse((o) => {
        if (o.material && o.material.opacity !== undefined && o !== ud.shadow && !o.isSprite) {
          o.material.transparent = !p.alive;
          if (o.material !== ud.bomb.material) o.material.opacity = op;
        }
      });
    }

    const bombHolder = [...this.players.values()].find((r) => r.t.id === this._bombId);
    if (bombHolder) {
      const b = bombHolder.mesh.userData.bomb;
      b.visible = true;
      b.position.set(Math.sin(t * 6) * 0.9, 1.15, Math.cos(t * 6) * 0.9);
    }

    const rec =
      this.players.get(this.followId) ||
      this.players.get(this.localId) ||
      [...this.players.values()].find((r) => r.t.alive);

    if (rec) {
      const p = rec.t;
      const pos = rec.mesh.position;
      const me = this.players.get(this.localId);
      const dead = this.spectating || (me && !me.t.alive);
      if (dead) this.spectateArena();
      else {
        this.wasSpectating = false;
        if (p.id === this.localId && p.alive) this.followLocal(pos);
        else this.orbit(pos, 10, 4.5);
      }
    } else {
      this.orbit(new THREE.Vector3(0, 1, 0), 16, 8);
    }

    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake *= 0.86;
    }
    this.renderer.render(this.scene, this.camera);
  }

  setBomb(id) {
    this._bombId = id;
  }

  spectateArena() {
    if (!this.wasSpectating) {
      this.specYaw = this.yaw;
      this.specPitch = 0.42;
      const r = Math.max(this.platformRadius, 8);
      this.specDist = r * 2.15 + 6;
      this.wasSpectating = true;
    }
    const dist = this.specDist;
    const pitch = this.specPitch;
    const yaw = this.specYaw;
    const ox = Math.sin(yaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist + 2.2;
    const oz = Math.cos(yaw) * Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(ox, Math.max(8, oy), oz);
    this.camera.position.lerp(desired, 0.14);
    this.camera.lookAt(0, 0.9, 0);
  }

  followLocal(pos) {
    // Orbit purely from mouse yaw/pitch; look at body center — no mesh rotation coupling.
    const dist = this.camDist;
    const pitch = this.pitch;
    const yaw = this.yaw;
    const ox = Math.sin(yaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist + this.camHeight;
    const oz = Math.cos(yaw) * Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(pos.x + ox, pos.y + oy, pos.z + oz);
    if (this.snapCam) {
      this.camera.position.copy(desired);
      this.snapCam = false;
    } else {
      // High follow so mouse turn feels locked to yaw; still soft enough to avoid jitter.
      this.camera.position.lerp(desired, 0.88);
    }
    this.camera.lookAt(pos.x, pos.y + 0.95, pos.z);
    this.updateSunFollow(pos.x, pos.z);
  }

  updateSunFollow(x, z) {
    if (!this.sun || (this.platformRadius || 0) < 40) return;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + 42, 58, z + 28);
    this.sun.target.updateMatrixWorld();
    const sc = this.sun.shadow.camera;
    sc.left = -48;
    sc.right = 48;
    sc.top = 48;
    sc.bottom = -48;
    sc.near = 2;
    sc.far = 140;
    sc.updateProjectionMatrix();
  }

  orbit(target, dist, height) {
    const ox = Math.sin(this.yaw) * dist;
    const oz = Math.cos(this.yaw) * dist;
    this.camera.position.lerp(new THREE.Vector3(target.x + ox, target.y + height, target.z + oz), 0.12);
    this.camera.lookAt(target.x, target.y + 0.8, target.z);
  }
}
