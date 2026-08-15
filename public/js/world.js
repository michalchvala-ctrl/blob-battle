import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  BUILDING_MODELS,
  SKYSCRAPER_MODELS,
  TREE_MODELS,
  CAR_MODELS,
  ROAD_MODELS,
  buildingModelPath,
  treeModelPath,
  carModelPath,
  roadModelPath,
} from "./models.js";

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

function markWeaponShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

/** Low-poly pistol — grip, slide, barrel, sights (not sci-fi blaster). */
function makePistolMesh(scale = 1) {
  const g = new THREE.Group();
  const steel = toon("#2f3542");
  const dark = toon("#1a1e26");
  const gripC = toon("#3d2914");
  const accent = toon("#d6ff4a");
  const silver = toon("#9aa3b2");

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.11), gripC);
  grip.position.set(0, -0.1, 0.02);
  grip.rotation.x = 0.18;
  const gripDetail = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.02), dark);
  gripDetail.position.set(0, -0.12, 0.07);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.28), steel);
  frame.position.set(0, 0.02, 0.14);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.055, 0.26), dark);
  slide.position.set(0, 0.07, 0.13);
  const slideRidge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.08), silver);
  slideRidge.position.set(0, 0.1, 0.02);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.22, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.045, 0.36);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.04, 10), silver);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.045, 0.48);

  const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), dark);
  triggerGuard.rotation.y = Math.PI / 2;
  triggerGuard.position.set(0, -0.02, 0.1);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.015), silver);
  trigger.position.set(0, -0.01, 0.1);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.02), accent);
  frontSight.position.set(0, 0.12, 0.32);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.02), accent);
  rearSight.position.set(0, 0.115, 0.02);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.08), dark);
  mag.position.set(0, -0.14, 0.06);

  g.add(grip, gripDetail, frame, slide, slideRidge, barrel, muzzle, triggerGuard, trigger, frontSight, rearSight, mag);
  g.scale.setScalar(scale);
  return markWeaponShadows(g);
}

/** Long rifle with scope — FPS sniper + world pickup. */
function makeSniperMesh(scale = 1) {
  const g = new THREE.Group();
  const stock = toon("#5c3a21");
  const steel = toon("#1f2937");
  const dark = toon("#111827");
  const scopeC = toon("#374151");
  const glass = toon("#7ec8ff", { transparent: true, opacity: 0.55 });
  const accent = toon("#ef4444");

  const butt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.28), stock);
  butt.position.set(0, -0.02, -0.22);
  const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.18), stock);
  cheek.position.set(0, 0.06, -0.12);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.36), steel);
  receiver.position.set(0, 0.02, 0.12);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.7, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, 0.55);
  const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.08, 8), steel);
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.04, 0.92);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.1), dark);
  mag.position.set(0, -0.1, 0.08);
  const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), steel);
  bipodL.position.set(-0.05, -0.1, 0.55);
  bipodL.rotation.z = 0.35;
  const bipodR = bipodL.clone();
  bipodR.position.x = 0.05;
  bipodR.rotation.z = -0.35;

  const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 12), scopeC);
  scopeBody.rotation.x = Math.PI / 2;
  scopeBody.position.set(0, 0.14, 0.1);
  const scopeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.06, 12), dark);
  scopeFront.rotation.x = Math.PI / 2;
  scopeFront.position.set(0, 0.14, 0.28);
  const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), glass);
  scopeLens.position.set(0, 0.14, 0.312);
  const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.2), steel);
  scopeMount.position.set(0, 0.09, 0.1);
  const laser = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.08), accent);
  laser.position.set(0.05, 0.0, 0.35);

  g.add(
    butt,
    cheek,
    receiver,
    barrel,
    muzzleBrake,
    mag,
    bipodL,
    bipodR,
    scopeBody,
    scopeFront,
    scopeLens,
    scopeMount,
    laser,
  );
  g.scale.setScalar(scale);
  return markWeaponShadows(g);
}

/** Combat knife with tapered blade and guard. */
function makeKnifeMesh(scale = 1) {
  const g = new THREE.Group();
  const wood = toon("#6b3f1e");
  const steel = toon("#c5ced9");
  const dark = toon("#2a303c");
  const edge = toon("#eef2f7");

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.16, 8), wood);
  handle.position.set(0, -0.02, 0);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), dark);
  pommel.position.set(0, -0.1, 0);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.04), dark);
  guard.position.set(0, 0.06, 0);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 0.34), steel);
  blade.position.set(0, 0.08, 0.2);
  // Taper tip with a second wedge
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 4), edge);
  tip.rotation.x = -Math.PI / 2;
  tip.position.set(0, 0.08, 0.42);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.22), dark);
  fuller.position.set(0, 0.09, 0.18);

  g.add(handle, pommel, guard, blade, tip, fuller);
  g.scale.setScalar(scale);
  return markWeaponShadows(g);
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

  // Weapon in right hand (Streľba mode) — detailed pistol
  const gun = makePistolMesh(1.35);
  gun.position.set(0.12, -0.08, 0.28);
  gun.rotation.set(-0.25, 0.15, -0.35);
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
    this.scene.add(this.camera);
    this.yaw = 0;
    this.pitch = 0.14;
    this.invertMouseY = true;
    this.bleedAcc = 0;
    this.windAngle = 0;
    this.dayPhase = 0;
    this.aiming = false;
    this.hasSniper = false;
    this.weapon = "knife";
    this.ammo = 20;
    this.inVehicle = false;
    this.baseFov = 70;
    this.windParticles = null;
    this.gltfCache = new Map();
    this.pendingStructures = null;
    this.modelsReady = this.preloadStructureModels();
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
    this.pendingStructures = list || null;
    if (!list?.length) return;
    const paint = () => {
      if (this.pendingStructures !== list) return;
      this.clearStructures();
      for (const s of list) {
        this.structureGroup.add(this.makeStructureMesh(s));
      }
    };
    if (this.gltfCache.size) {
      paint();
      return;
    }
    this.modelsReady.then(paint).catch(() => paint());
  }

  async preloadStructureModels() {
    const loader = new GLTFLoader();
    const jobs = [];
    const buildingIds = [...new Set([...BUILDING_MODELS, ...SKYSCRAPER_MODELS])];
    for (const id of buildingIds) {
      jobs.push(
        loader.loadAsync(buildingModelPath(id)).then((gltf) => {
          this.prepareGltfScene(gltf.scene);
          this.gltfCache.set(`building:${id}`, gltf.scene);
        }),
      );
    }
    for (const id of TREE_MODELS) {
      jobs.push(
        loader.loadAsync(treeModelPath(id)).then((gltf) => {
          this.prepareGltfScene(gltf.scene);
          this.gltfCache.set(`tree:${id}`, gltf.scene);
        }),
      );
    }
    for (const id of CAR_MODELS) {
      jobs.push(
        loader.loadAsync(carModelPath(id)).then((gltf) => {
          this.prepareGltfScene(gltf.scene);
          this.gltfCache.set(`car:${id}`, gltf.scene);
        }),
      );
    }
    for (const id of ROAD_MODELS) {
      jobs.push(
        loader.loadAsync(roadModelPath(id)).then((gltf) => {
          this.prepareGltfScene(gltf.scene);
          this.gltfCache.set(`road:${id}`, gltf.scene);
        }),
      );
    }
    await Promise.allSettled(jobs);
    if (this.pendingStructures?.length) {
      const list = this.pendingStructures;
      this.clearStructures();
      for (const s of list) this.structureGroup.add(this.makeStructureMesh(s));
    }
  }

  prepareGltfScene(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        // Keep Kenney vertex colors / textures — just enable shadows & double-side
        m.side = THREE.FrontSide;
        m.shadowSide = THREE.FrontSide;
        if (m.map) {
          m.map.colorSpace = THREE.SRGBColorSpace;
          m.map.needsUpdate = true;
        }
        m.needsUpdate = true;
      }
    });
  }

  fitGltfToBox(model, tw, th, td, { uniform = true } = {}) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (size.x < 1e-4 || size.y < 1e-4 || size.z < 1e-4) return;
    let sx;
    let sy;
    let sz;
    if (uniform) {
      const s = Math.min(tw / size.x, td / size.z, th / size.y);
      sx = sy = sz = s;
    } else {
      sx = tw / size.x;
      sy = th / size.y;
      sz = td / size.z;
    }
    model.scale.set(sx, sy, sz);
    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model);
    const center = box2.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;
  }

  makeStructureMesh(s) {
    const g = new THREE.Group();
    if (s.kind === "tree") {
      const modelId = s.model || TREE_MODELS[Math.abs(s.id || 0) % TREE_MODELS.length];
      const proto = this.gltfCache.get(`tree:${modelId}`);
      if (proto) {
        const model = proto.clone(true);
        const h = s.h || 6;
        const r = s.r || 2.2;
        this.fitGltfToBox(model, r * 2.1, h, r * 2.1, { uniform: true });
        model.position.y += 0.575;
        g.add(model);
        g.userData.isTree = true;
        g.userData.canopy = model;
      } else {
        this.makeProceduralTree(g, s);
      }
    } else if (s.kind === "car") {
      const modelId = s.model || CAR_MODELS[Math.abs(s.id || 0) % CAR_MODELS.length];
      const proto = this.gltfCache.get(`car:${modelId}`);
      const w = s.w || 4.2;
      const h = s.h || 1.6;
      const d = s.d || 2.1;
      if (proto) {
        const model = proto.clone(true);
        this.fitGltfToBox(model, w, h, d, { uniform: true });
        model.position.y += 0.575;
        g.add(model);
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.55, d), toon(s.color || "#c44"));
        body.position.y = 0.575 + h * 0.35;
        g.add(body);
      }
    } else if (s.kind === "road") {
      const modelId = s.model || "road_straight";
      const proto = this.gltfCache.get(`road:${modelId}`);
      const w = s.w || 10;
      const d = s.d || 10;
      if (proto) {
        const model = proto.clone(true);
        this.fitGltfToBox(model, w, 0.35, d, { uniform: false });
        model.position.y += 0.62;
        g.add(model);
      } else {
        const asphalt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), toon("#2b2f36"));
        asphalt.position.y = 0.62;
        g.add(asphalt);
      }
    } else if (s.kind === "hill") {
      const r = s.r || 14;
      const h = s.h || 6;
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        toon(s.color || "#4a7c46"),
      );
      hill.scale.set(1, h / r, 1);
      hill.position.y = 0.575;
      hill.receiveShadow = true;
      hill.castShadow = true;
      g.add(hill);
    } else {
      const modelId = s.model || BUILDING_MODELS[Math.abs(s.id || 0) % BUILDING_MODELS.length];
      const proto = this.gltfCache.get(`building:${modelId}`);
      const h = s.h || 8;
      const w = s.w || 8;
      const d = s.d || 8;
      if (proto) {
        const model = proto.clone(true);
        // Stretch to exact collision box so walls match physics (no walking through)
        this.fitGltfToBox(model, w, h, d, { uniform: false });
        model.position.y += 0.575;
        g.add(model);
        this.addBuildingLadder(g, w, d, h);
      } else {
        this.makeProceduralBuilding(g, s);
      }
    }
    g.position.set(s.x || 0, 0, s.z || 0);
    if (s.rotY) g.rotation.y = s.rotY;
    return g;
  }

  addBuildingLadder(g, w, d, h) {
    const ladder = new THREE.Group();
    const railMat = toon("#8b5a2b");
    for (const lx of [-0.35, 0.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), railMat);
      rail.position.set(lx, 0.575 + h * 0.5, d * 0.5 + 0.55);
      ladder.add(rail);
    }
    const steps = Math.max(6, (h / 0.7) | 0);
    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.12), railMat);
      step.position.set(0, 0.7 + i * (h / steps), d * 0.5 + 0.55);
      ladder.add(step);
    }
    g.add(ladder);
  }

  makeProceduralTree(g, s) {
    const trunkH = (s.h || 6) * 0.55;
    const canopyR = s.r || 2.2;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, trunkH, 8),
      toon("#6b3f1e"),
    );
    trunk.position.y = 0.575 + trunkH * 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const canopy = new THREE.Group();
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
    canopy.add(leaf, leaf2);
    g.add(trunk, canopy);
    g.userData.isTree = true;
    g.userData.canopy = canopy;
  }

  makeProceduralBuilding(g, s) {
    const h = s.h || 8;
    const w = s.w || 8;
    const d = s.d || 8;
    const col = toon(s.color || "#ff8ec4");
    const dark = toon("#4a2040");
    const glass = new THREE.MeshBasicMaterial({
      color: "#7ec8ff",
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), dark);
    floor.position.y = 0.7;
    floor.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.35, d * 1.06), toon("#fff1a8"));
    roof.position.y = 0.575 + h + 0.2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(floor, roof);

    const thick = 0.4;
    const winW = Math.min(2.4, w * 0.28);
    const winH = Math.min(2.2, h * 0.28);
    const winY = 0.575 + h * 0.45;
    const doorW = Math.min(2.1, w * 0.32);
    const doorH = Math.min(h * 0.72, 3.2);
    const mkWallFace = (axis, sign, door = false) => {
      const alongX = axis === "z";
      const len = alongX ? w : d;
      const gapW = door ? doorW : winW;
      const panel = (len * 0.5 - gapW * 0.5) * 0.5;
      const off = gapW * 0.5 + panel;
      for (const sgn of [-1, 1]) {
        const wall = new THREE.Mesh(
          alongX
            ? new THREE.BoxGeometry(panel * 2, h, thick)
            : new THREE.BoxGeometry(thick, h, panel * 2),
          col,
        );
        wall.position.set(
          alongX ? sgn * off : sign * (w * 0.5 - thick * 0.5),
          0.575 + h * 0.5,
          alongX ? sign * (d * 0.5 - thick * 0.5) : sgn * off,
        );
        wall.castShadow = true;
        wall.receiveShadow = true;
        g.add(wall);
      }
      if (door) {
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.3, Math.max(0.4, h - doorH), thick), col);
        lintel.position.set(0, 0.575 + h - Math.max(0.2, (h - doorH) * 0.5), sign * (d * 0.5 - thick * 0.5));
        lintel.castShadow = true;
        g.add(lintel);
      } else {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.08), glass);
        pane.position.set(
          alongX ? 0 : sign * (w * 0.5 - thick * 0.5),
          winY,
          alongX ? sign * (d * 0.5 - thick * 0.5) : 0,
        );
        g.add(pane);
      }
    };
    mkWallFace("z", 1);
    mkWallFace("z", -1, true);
    mkWallFace("x", 1);
    mkWallFace("x", -1);
    this.addBuildingLadder(g, w, d, h);
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
      if (huge) {
        // Guns city asphalt instead of jelly pink
        const asphalt = toon("#3a3f48");
        const curb = toon("#5a616c");
        const top = new THREE.Mesh(new THREE.BoxGeometry(p.w, h, p.d), asphalt);
        top.receiveShadow = true;
        const surface = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.2, p.w - 0.4), 0.08, Math.max(0.2, p.d - 0.4)),
          curb,
        );
        surface.position.y = h * 0.5;
        surface.receiveShadow = true;
        g.add(top, surface);
        // Light street grid marks
        const lineMat = toon("#c9a227");
        for (let i = -3; i <= 3; i++) {
          if (i === 0) continue;
          const hx = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.9, 0.04, 0.35), lineMat);
          hx.position.set(0, h * 0.54, i * 40);
          const hz = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, p.d * 0.9), lineMat);
          hz.position.set(i * 40, h * 0.54, 0);
          g.add(hx, hz);
        }
      } else {
        const top = new THREE.Mesh(new THREE.BoxGeometry(p.w, h, p.d), pink);
        top.castShadow = true;
        top.receiveShadow = true;
        const icing = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.2, p.w - 0.55), 0.1, Math.max(0.2, p.d - 0.55)),
          cream,
        );
        icing.position.y = h * 0.5;
        icing.receiveShadow = true;
        g.add(top, icing);
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

  makeAmmoMesh(d) {
    const g = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.4, 0.84), toon("#f0c14a"));
    crate.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.2), toon("#1f2937"));
    stripe.position.y = 0.12;
    const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8), toon("#e8e8e8"));
    bullet.rotation.z = Math.PI / 2;
    bullet.position.set(0, 0.28, 0);
    g.add(crate, stripe, bullet);
    g.position.set(d.x, d.y, d.z);
    g.quaternion.set(d.qx, d.qy, d.qz, d.qw);
    return g;
  }

  makeGrenadeMesh(d) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toon(d.color || "#c5cdd4"));
    body.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12), toon("#6b7280"));
    band.rotation.x = Math.PI / 2;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6), toon("#e5e7eb"));
    pin.position.y = 0.28;
    g.add(body, band, pin);
    g.position.set(d.x || 0, d.y || 0, d.z || 0);
    return g;
  }

  makeSniperPickupMesh(d) {
    const g = makeSniperMesh(1.15);
    g.rotation.y = Math.PI / 2;
    g.position.set(d.x || 0, (d.y || 0) + 0.08, d.z || 0);
    return g;
  }

  spawnGrenadeBoom(ev) {
    // legacy explosive VFX unused for smoke grenades
    if (!ev) return;
  }

  spawnShotTrail(ev) {
    if (!ev) return;
    // Elongated tracer streak (not ball “guličky”)
    if (ev.speed != null && ev.dx != null) {
      const speed = ev.speed;
      const range = ev.range || 120;
      const dir = new THREE.Vector3(ev.dx, ev.dy || 0, ev.dz).normalize();
      const sniper = (ev.weapon || ev.kind) === "sniper";
      const len = sniper ? 1.6 : 1.05;
      const rad = sniper ? 0.035 : 0.028;
      const trail = new THREE.Mesh(
        new THREE.CylinderGeometry(rad * 0.45, rad, len, 6),
        new THREE.MeshBasicMaterial({
          color: sniper ? "#ff6b4a" : "#ffe66d",
          transparent: true,
          opacity: 0.95,
        }),
      );
      trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      trail.position.set(ev.x0, ev.y0 || 0, ev.z0);
      this.scene.add(trail);
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(rad * 1.6, rad * 0.8, len * 0.55, 5),
        new THREE.MeshBasicMaterial({
          color: sniper ? "#ffb39a" : "#ffb703",
          transparent: true,
          opacity: 0.45,
        }),
      );
      glow.quaternion.copy(trail.quaternion);
      this.scene.add(glow);
      const born = performance.now();
      const dur = (range / speed) * 1000;
      const tick = () => {
        const age = (performance.now() - born) / dur;
        if (age >= 1) {
          this.scene.remove(trail);
          this.scene.remove(glow);
          trail.geometry.dispose();
          trail.material.dispose();
          glow.geometry.dispose();
          glow.material.dispose();
          return;
        }
        const d = age * range;
        const px = ev.x0 + dir.x * d;
        const py = (ev.y0 || 0) + dir.y * d;
        const pz = ev.z0 + dir.z * d;
        trail.position.set(px, py, pz);
        glow.position.set(px - dir.x * len * 0.25, py - dir.y * len * 0.25, pz - dir.z * len * 0.25);
        trail.material.opacity = 0.95 * (1 - age * 0.35);
        glow.material.opacity = 0.45 * (1 - age * 0.5);
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
    if (d.kind === "ammo") return this.makeAmmoMesh(d);
    if (d.kind === "grenade") return this.makeGrenadeMesh(d);
    if (d.kind === "sniper") return this.makeSniperPickupMesh(d);
    if (d.kind === "vehicle") return this.makeVehicleMesh(d);
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

  makeVehicleMesh(d) {
    const g = new THREE.Group();
    const modelId = d.model || CAR_MODELS[0];
    const proto = this.gltfCache.get(`car:${modelId}`);
    const w = d.sx || 4.4;
    const h = d.sy || 1.7;
    const depth = d.sz || 2.2;
    if (proto) {
      const model = proto.clone(true);
      this.fitGltfToBox(model, w, h, depth, { uniform: true });
      model.position.y = -h * 0.5;
      g.add(model);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.55, depth), toon(d.color || "#c44"));
      body.position.y = -h * 0.15;
      g.add(body);
    }
    g.userData.isVehicle = true;
    g.position.set(d.x, d.y, d.z);
    g.quaternion.set(d.qx || 0, d.qy || 0, d.qz || 0, d.qw ?? 1);
    return g;
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
      const wantVehicle = d.kind === "vehicle";
      if (mesh && wantGoat && !mesh.userData.isGoat) {
        this.props.remove(mesh);
        mesh.geometry?.dispose?.();
        this.debrisMeshes.delete(d.id);
        mesh = null;
      }
      if (mesh && wantVehicle && !mesh.userData.isVehicle) {
        this.props.remove(mesh);
        mesh.traverse?.((o) => o.geometry?.dispose?.());
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
      if (wantVehicle) mesh.userData.isVehicle = true;
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
      const sdy = this.invertMouseY ? -dy : dy;
      this.specPitch = THREE.MathUtils.clamp(this.specPitch + sdy * 0.0022, 0.06, 0.82);
      return;
    }
    this.yaw -= dx * 0.0024;
    const lookDy = this.invertMouseY ? -dy : dy;
    this.pitch = THREE.MathUtils.clamp(this.pitch + lookDy * 0.0022, -1.52, 1.52);
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
      // First-person: hide own body while alive
      const hideSelf = local && p.alive && !this.spectating;
      m.visible = p.y > -20 && !hideSelf;
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
      const wpn = p.weapon || "pistol";
      if (ud.gun) {
        // Swap third-person prop when weapon changes
        if (ud.gunKind !== wpn) {
          ud.armR.remove(ud.gun);
          let prop;
          if (wpn === "sniper") {
            prop = makeSniperMesh(1.1);
            prop.position.set(0.1, -0.05, 0.22);
            prop.rotation.set(-0.2, 0.1, -0.25);
          } else if (wpn === "knife") {
            prop = makeKnifeMesh(1.2);
            prop.position.set(0.08, -0.02, 0.25);
            prop.rotation.set(-0.4, 0.5, -0.8);
          } else {
            prop = makePistolMesh(1.35);
            prop.position.set(0.12, -0.08, 0.28);
            prop.rotation.set(-0.25, 0.15, -0.35);
          }
          ud.gun = prop;
          ud.gunKind = wpn;
          ud.armR.add(prop);
        }
        ud.gun.visible = guns;
      }
      if (guns) {
        // Aim pose — right arm forward with weapon
        const kick = p.shoot ? -0.55 : -0.25;
        ud.armR.rotation.x = kick;
        ud.armR.rotation.z = -0.35;
        ud.armR.rotation.y = -0.15;
        ud.armL.rotation.x = -0.2;
        ud.armL.rotation.z = 0.35;
        if (ud.gun) {
          ud.gun.rotation.x = p.shoot ? -0.35 : -0.1;
          ud.gun.position.z = p.shoot ? 0.22 : 0.28;
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
    this.updateBlood(dt);
    this.updateBleed(dt);
    this.updateAtmosphere(dt);
    this.renderer.render(this.scene, this.camera);
  }

  setAtmosphere(dayPhase, windAngle) {
    if (dayPhase != null) this.dayPhase = dayPhase;
    if (windAngle != null) this.windAngle = windAngle;
  }

  updateAtmosphere(dt) {
    const phase = this.dayPhase || 0;
    // Day/night blend factor 0 = day, 1 = night
    let tNight = 0;
    if (phase < 0.08) tNight = 1 - phase / 0.08;
    else if (phase < 0.42) tNight = 0;
    else if (phase < 0.58) tNight = (phase - 0.42) / 0.16;
    else if (phase < 0.92) tNight = 1;
    else tNight = 1 - (phase - 0.92) / 0.08;

    const dayCol = new THREE.Color("#87b7ff");
    const nightCol = new THREE.Color("#0a0618");
    const bg = dayCol.clone().lerp(nightCol, tNight);
    this.scene.background.copy(bg);
    if (this.scene.fog) {
      this.scene.fog.color.copy(bg);
      this.scene.fog.near = 40 + tNight * 20;
      this.scene.fog.far = 160 + tNight * 40;
    }
    this.scene.traverse((o) => {
      if (o.isHemisphereLight) {
        o.intensity = 1.15 - tNight * 0.85;
      }
      if (o.isDirectionalLight) {
        o.intensity = 1.35 - tNight * 1.05;
      }
      if (o.isAmbientLight) {
        o.intensity = 0.18 + tNight * 0.12;
      }
    });

    // Tree sway
    const wind = this.windAngle || 0;
    if (this.structureGroup) {
      for (const child of this.structureGroup.children) {
        if (!child.userData?.isTree) continue;
        const sway = Math.sin(wind * 2 + child.position.x * 0.05) * 0.12;
        if (child.userData.canopy) child.userData.canopy.rotation.z = sway;
        else child.rotation.z = sway * 0.5;
      }
    }

    // Wind particles
    if (!this.windParticles) {
      const geo = new THREE.BufferGeometry();
      const N = 400;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 280;
        pos[i * 3 + 1] = 1 + Math.random() * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 280;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: "#ffffff",
        size: 0.35,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      this.windParticles = new THREE.Points(geo, mat);
      this.scene.add(this.windParticles);
    }
    const arr = this.windParticles.geometry.attributes.position.array;
    const wx = Math.cos(wind) * 18 * dt;
    const wz = Math.sin(wind) * 18 * dt;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += wx;
      arr[i + 2] += wz;
      if (arr[i] > 140) arr[i] -= 280;
      if (arr[i] < -140) arr[i] += 280;
      if (arr[i + 2] > 140) arr[i + 2] -= 280;
      if (arr[i + 2] < -140) arr[i + 2] += 280;
    }
    this.windParticles.geometry.attributes.position.needsUpdate = true;
    this.windParticles.material.opacity = 0.22 + tNight * 0.12;

    // Sniper zoom FOV
    const wantFov = this.aiming && this.weapon === "sniper" && this.gunsMode && !this.spectating ? 28 : this.baseFov;
    if (Math.abs(this.camera.fov - wantFov) > 0.2) {
      this.camera.fov += (wantFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }
  }

  updateBleed(dt) {
    if (!this.gunsMode || this.spectating) return;
    this.bleedAcc = (this.bleedAcc || 0) + dt;
    if (this.bleedAcc < 1) return;
    this.bleedAcc = 0;
    for (const rec of this.players.values()) {
      const p = rec.t;
      if (!p?.alive) continue;
      const hp = p.hp ?? 100;
      if (hp >= 100) continue;
      const missing = 100 - hp;
      // 1 drop at ~95 HP → ~14 drops near death
      const amount = Math.max(1, Math.round(1 + (missing / 100) * 13));
      this.spawnBlood(rec.mesh.position, amount);
    }
  }

  spawnBlood(pos, amount = 16) {
    if (!this.blood) this.blood = [];
    const PLATFORM_TOP = 0.575;
    for (let i = 0; i < amount; i++) {
      const r = 0.04 + Math.random() * 0.07;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 6, 5),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? "#8b0000" : "#c41e3a" }),
      );
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.45,
        pos.y + 0.2 + Math.random() * 0.55,
        pos.z + (Math.random() - 0.5) * 0.45,
      );
      this.scene.add(mesh);
      this.blood.push({
        mesh,
        vx: (Math.random() - 0.5) * 3.5,
        vy: 1.2 + Math.random() * 3.5,
        vz: (Math.random() - 0.5) * 3.5,
        life: 30,
        floorY: PLATFORM_TOP + 0.03,
        settled: false,
      });
    }
  }

  updateBlood(dt) {
    if (!this.blood?.length) return;
    for (let i = this.blood.length - 1; i >= 0; i--) {
      const b = this.blood[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.blood.splice(i, 1);
        continue;
      }
      if (b.settled) {
        b.mesh.material.transparent = true;
        b.mesh.material.opacity = b.life < 4 ? b.life / 4 : 0.92;
        continue;
      }
      b.vy -= 28 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      if (b.mesh.position.y <= b.floorY) {
        b.mesh.position.y = b.floorY;
        b.vx *= 0.2;
        b.vz *= 0.2;
        b.vy = 0;
        b.settled = true;
        b.life = 30;
        b.mesh.scale.set(1.8, 0.25, 1.8);
        b.mesh.material.color.set("#6b0f1a");
        b.mesh.material.transparent = true;
        b.mesh.material.opacity = 0.92;
      }
    }
  }

  syncSmokes(list) {
    if (!this.smokeMeshes) this.smokeMeshes = new Map();
    if (!list) list = [];
    const seen = new Set();
    for (const s of list) {
      seen.add(s.id);
      let group = this.smokeMeshes.get(s.id);
      if (!group) {
        group = this.makeSmokeCloud(s);
        this.scene.add(group);
        this.smokeMeshes.set(s.id, group);
      }
      group.position.set(s.x, s.y, s.z);
      const fade = Math.min(1, (s.life || 0) / 8);
      group.traverse((o) => {
        if (o.material?.opacity != null) {
          o.material.opacity = (o.userData.baseOp || 0.22) * fade;
        }
      });
      const grow = 0.85 + 0.15 * Math.min(1, 1 - (s.life || 0) / (s.maxLife || 60));
      group.scale.setScalar(grow);
    }
    for (const [id, group] of this.smokeMeshes) {
      if (!seen.has(id)) {
        this.scene.remove(group);
        group.traverse((o) => {
          o.geometry?.dispose?.();
          o.material?.dispose?.();
        });
        this.smokeMeshes.delete(id);
      }
    }
  }

  makeSmokeCloud(s) {
    const g = new THREE.Group();
    const R = s.r || 16;
    const cols = ["#9aa3ad", "#b8c0c8", "#7d868f", "#cfd5db"];
    for (let i = 0; i < 10; i++) {
      const rad = R * (0.35 + (i % 4) * 0.18);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(rad, 14, 10),
        new THREE.MeshBasicMaterial({
          color: cols[i % cols.length],
          transparent: true,
          opacity: 0.18 + (i % 3) * 0.04,
          depthWrite: false,
        }),
      );
      mesh.userData.baseOp = mesh.material.opacity;
      mesh.position.set(
        (Math.random() - 0.5) * R * 0.55,
        (Math.random() - 0.5) * R * 0.35,
        (Math.random() - 0.5) * R * 0.55,
      );
      g.add(mesh);
    }
    g.position.set(s.x || 0, s.y || 1.2, s.z || 0);
    return g;
  }

  makeSmokeCloud(s) {
    const g = new THREE.Group();
    const R = s.r || 16;
    const cols = ["#9aa3ad", "#b8c0c8", "#7d868f", "#cfd5db"];
    for (let i = 0; i < 10; i++) {
      const rad = R * (0.35 + (i % 4) * 0.18);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(rad, 14, 10),
        new THREE.MeshBasicMaterial({
          color: cols[i % cols.length],
          transparent: true,
          opacity: 0.18 + (i % 3) * 0.04,
          depthWrite: false,
        }),
      );
      mesh.userData.baseOp = mesh.material.opacity;
      mesh.position.set(
        (Math.random() - 0.5) * R * 0.55,
        (Math.random() - 0.5) * R * 0.35,
        (Math.random() - 0.5) * R * 0.55,
      );
      g.add(mesh);
    }
    g.position.set(s.x || 0, s.y || 1.2, s.z || 0);
    return g;
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
    // First-person: camera in the head, look with full yaw/pitch
    const eyeY = 0.52;
    const pitch = this.pitch;
    const yaw = this.yaw;
    const desired = new THREE.Vector3(pos.x, pos.y + eyeY, pos.z);
    if (this.snapCam) {
      this.camera.position.copy(desired);
      this.snapCam = false;
    } else {
      this.camera.position.lerp(desired, 0.92);
    }
    const lookDist = 12;
    const lx = pos.x + -Math.sin(yaw) * Math.cos(pitch) * lookDist;
    const ly = pos.y + eyeY + Math.sin(pitch) * lookDist;
    const lz = pos.z + -Math.cos(yaw) * Math.cos(pitch) * lookDist;
    this.camera.lookAt(lx, ly, lz);
    this.updateSunFollow(pos.x, pos.z);
    this.updateFpsGun();
  }

  updateFpsGun() {
    if (!this.fpsPistol) {
      this.fpsPistol = makePistolMesh(2.4);
      this.camera.add(this.fpsPistol);
    }
    if (!this.fpsSniper) {
      this.fpsSniper = makeSniperMesh(2.8);
      this.camera.add(this.fpsSniper);
    }
    if (!this.fpsKnife) {
      this.fpsKnife = makeKnifeMesh(1.1);
      this.camera.add(this.fpsKnife);
    }
    this.fpsGun = this.fpsPistol;

    const show = !!this.gunsMode && !this.spectating && !this.inVehicle;
    const w = this.weapon || "knife";
    this.fpsPistol.visible = show && w === "pistol";
    this.fpsSniper.visible = show && w === "sniper";
    this.fpsKnife.visible = show && w === "knife";

    const kick = this._gunKick || 0;
    this.fpsPistol.position.set(0.28, -0.22 - kick * 0.04, -0.48 + kick * 0.06);
    this.fpsPistol.rotation.set(0.05 + kick * 0.25, Math.PI + 0.08, 0.05);
    this.fpsSniper.position.set(0.2, -0.24 - kick * 0.05, -0.62 + kick * 0.08);
    this.fpsSniper.rotation.set(0.02 + kick * 0.3, Math.PI + 0.02, 0.02);
    this.fpsKnife.position.set(0.22, -0.18, -0.38);
    this.fpsKnife.rotation.set(0.2, 0.35, 0.55);
    this._gunKick = Math.max(0, kick - 0.08);
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
