import { GameWorld } from "./world.js";
import { sfx } from "./audio.js";
import { ARENA_INFO, ARENA_IDS } from "./arenas.js";

const $ = (id) => document.getElementById(id);

const nameInput = $("name");
const codeInput = $("code");
nameInput.value = localStorage.getItem("zk-name") || "";

const invertY = $("invert-y");
invertY.checked = localStorage.getItem("zk-invert-y") !== "0";
const world = new GameWorld($("view"));
world.invertMouseY = invertY.checked;
invertY.addEventListener("change", () => {
  world.invertMouseY = invertY.checked;
  localStorage.setItem("zk-invert-y", invertY.checked ? "1" : "0");
});

let myId = null;
let lobby = null;
let playing = false;
let lastBombT = 99;
const keys = Object.create(null);
let jumpQueued = false;
let punchQueued = false;
let dashQueued = false;
let grenadeQueued = false;
let grenadeCharge = 0;
let grenadeHolding = false;
let grenadeHoldStart = 0;
let pointerLocked = false;
let lookIgnoreUntil = 0;

const MODE_LABEL = { sumo: "Zhodiť", bomb: "Bomba", hill: "Kráľ kopca", guns: "Streľba" };

function show(el, on) {
  el.classList.toggle("hidden", !on);
}

function menuErr(msg) {
  $("menu-err").hidden = !msg;
  $("menu-err").textContent = msg || "";
}

if (!window.io) {
  menuErr("Nepripojené na server — chýba Socket.io skript.");
  throw new Error("Socket.io client missing");
}

// Same-origin (works on https://blobbattle… via reverse proxy).
// Polling first + upgrade: if proxy blocks WebSocket, create/join still work over polling.
const socket = window.io({
  path: "/socket.io",
  transports: ["polling", "websocket"],
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  timeout: 12000,
});

function requireSocket() {
  if (socket.connected) return true;
  menuErr("Nepripojené na server");
  return false;
}

socket.on("connect", () => {
  const t = $("menu-err").textContent || "";
  if (t.startsWith("Nepripojené")) menuErr("");
});

socket.on("disconnect", () => {
  if (!playing && !lobby) menuErr("Nepripojené na server");
});

socket.on("connect_error", (err) => {
  console.error("Socket connect_error:", err?.message || err);
  menuErr("Nepripojené na server");
});

setTimeout(() => {
  if (!socket.connected && !lobby && !playing) menuErr("Nepripojené na server");
}, 3000);

function syncArenaVisual(data) {
  if (!data) return;
  world.buildArena(
    data.radius || 13,
    data.mode === "hill" && data.shards?.length ? "hill" : data.mode || "sumo",
    data.shards || null,
    data.pieces || null,
    data.layoutKey || "",
    data.structures || null,
  );
}

function buildArenaButtons() {
  const root = $("arenas");
  root.innerHTML = ARENA_IDS.map((id) => {
    const info = ARENA_INFO[id];
    const special = id === "random" ? " special" : "";
    return `<button type="button" class="arena${special}" data-arena="${id}">
      <strong>${info.name}</strong>
      <span>${info.blurb}</span>
    </button>`;
  }).join("");
  for (const btn of root.querySelectorAll(".arena")) {
    btn.onclick = () => {
      if (lobby?.hostId !== myId) return;
      socket.emit("arena", btn.dataset.arena);
    };
  }
}
buildArenaButtons();

function returnToMenu() {
  if (!myId && !lobby) return;
  myId = null;
  lobby = null;
  playing = false;
  world.spectating = false;
  document.exitPointerLock?.();
  socket.emit("leave");
  world.setLocal(null);
  show($("menu"), true);
  show($("lobby"), false);
  show($("hud"), false);
  show($("win"), false);
  $("you-dead").classList.add("hidden");
  menuErr("");
}

$("btn-create").onclick = () => {
  sfx.unlock();
  sfx.click();
  if (!requireSocket()) return;
  const name = nameInput.value.trim();
  localStorage.setItem("zk-name", name);
  socket.emit("create", { name });
};

$("btn-join").onclick = () => {
  sfx.unlock();
  sfx.click();
  if (!requireSocket()) return;
  const name = nameInput.value.trim();
  localStorage.setItem("zk-name", name);
  socket.emit("join", { name, code: codeInput.value });
};

codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btn-join").click();
});
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btn-create").click();
});

$("btn-copy").onclick = async () => {
  if (!lobby) return;
  try {
    await navigator.clipboard.writeText(lobby.code);
    $("btn-copy").textContent = "Skopírované";
    setTimeout(() => {
      $("btn-copy").textContent = "Kopírovať kód";
    }, 1200);
  } catch {
    $("btn-copy").textContent = lobby.code;
  }
};

$("btn-start").onclick = () => {
  sfx.click();
  socket.emit("start");
};

$("btn-lobby").onclick = () => socket.emit("lobby");

for (const btn of document.querySelectorAll(".mode")) {
  btn.onclick = () => {
    if (lobby?.hostId !== myId) return;
    socket.emit("mode", btn.dataset.mode);
  };
}

socket.on("err", menuErr);

socket.on("joined", (data) => {
  myId = data.id;
  world.setLocal(myId);
  menuErr("");
  show($("menu"), false);
  applyLobby(data);
});

socket.on("lobby", applyLobby);

socket.on("round", (r) => {
  playing = true;
  show($("lobby"), false);
  show($("win"), false);
  show($("hud"), true);
  $("you-dead").classList.add("hidden");
  $("mode-pill").textContent = MODE_LABEL[r.mode] || r.mode;
  world.gunsMode = r.mode === "guns";
  syncArenaVisual(r);
  world.setBomb(r.bombId);
  lastBombT = r.bombT;
  lockPointer();
});

socket.on("arena", (a) => {
  world.setVisualRadius(a.radius);
});

socket.on("over", (o) => {
  playing = false;
  document.exitPointerLock?.();
  show($("win"), true);
  $("win-title").textContent = `${o.winnerName} vyhral!`;
  $("win-sub").textContent = myId === lobby?.hostId ? "Ďalšie kolo štartuje samo. Alebo spať do lobby." : "Ďalšie kolo o chvíľu.";
  $("win-scores").innerHTML = (o.scores || [])
    .sort((a, b) => b.score - a.score)
    .map((s) => `<li><span class="dot" style="background:${s.color};color:${s.color}"></span>${escapeHtml(s.name)} · ${s.score}</li>`)
    .join("");
  $("btn-lobby").classList.toggle("hidden", myId !== lobby?.hostId);
  sfx.win();
  world.addShake(0.5);
});

socket.on("st", (st) => {
  world.buildArenaMaybe(st.radius, st.mode, st.shards, st.pieces, st.layoutKey, st.structures);
  world.syncPlayers(st.players);
  world.syncBoxes(st.boxes);
  world.syncDebris(st.debris);
  if (st.shards) world.syncShards(st.shards);
  world.setBomb(st.bombId);

  const me = st.players.find((p) => p.id === myId);
  const aliveN = st.players.filter((p) => p.alive).length;
  if (st.mode === "guns" && st.phase === "playing") {
    $("alive-pill").textContent = `${st.roundKills || 0}/30 zabití`;
  } else {
    $("alive-pill").textContent = `${aliveN} v hre`;
  }

  const gunsOn = st.mode === "guns" && st.phase === "playing";
  world.gunsMode = st.mode === "guns";
  const showGunsHud = gunsOn && !!me?.alive;
  $("hp-wrap").classList.toggle("hidden", !showGunsHud);
  $("crosshair").classList.toggle("hidden", !showGunsHud);
  if (!showGunsHud) $("nade-charge").classList.add("hidden");
  if (gunsOn && me) {
    const hp = Math.max(0, me.hp ?? 100);
    $("hp-fill").style.width = `${hp}%`;
    $("hp-text").textContent = `${Math.round(hp)}%`;
  }
  if ($("hint-bar")) {
    $("hint-bar").textContent = gunsOn
      ? "WASD · skok · klik STREĽBA · G granát · Shift beh · pohľad 1. osoba · reset po 30 zabitiach"
      : "WASD · skok · klik úder · Shift beh · pohľad 1. osoba · Esc uvoľní myš";
  }

  if (st.phase === "playing" && me && !me.alive) {
    $("you-dead").classList.remove("hidden");
    $("you-dead").textContent =
      st.mode === "guns" ? "Si dole. Respawns o chvíľu…" : "Si dole. Esc → menu.";
    world.spectating = true;
  } else {
    $("you-dead").classList.add("hidden");
    world.spectating = false;
    world.followId = myId;
  }

  const bombOn = st.mode === "bomb" && st.phase === "playing" && st.bombId;
  $("bomb-pill").classList.toggle("hidden", !bombOn);
  if (bombOn) {
    const tLeft = Math.max(0, st.bombT).toFixed(1);
    if (st.bombT < 3 && Math.floor(st.bombT * 2) !== Math.floor(lastBombT * 2)) sfx.tick();
    lastBombT = st.bombT;
    if (st.bombId === myId) $("bomb-pill").textContent = `💣 TY ${tLeft}s`;
    else {
      const h = st.players.find((p) => p.id === st.bombId);
      $("bomb-pill").textContent = `💣 ${h?.name || "?"} ${tLeft}s`;
    }
  }

  if (st.phase === "lobby") {
    playing = false;
    show($("hud"), false);
    show($("win"), false);
    if (lobby) show($("lobby"), true);
  } else if (st.phase === "playing") {
    show($("lobby"), false);
    show($("hud"), true);
  }

  for (const ev of st.events || []) handleEvent(ev);
});

function applyLobby(data) {
  lobby = data;
  $("room-code").textContent = data.code;
  const isHost = data.hostId === myId;
  $("btn-start").classList.toggle("hidden", !isHost || data.phase === "playing");
  $("wait-host").hidden = isHost;
  for (const btn of document.querySelectorAll(".mode")) {
    btn.classList.toggle("on", btn.dataset.mode === data.mode);
    btn.disabled = !isHost;
  }
  for (const btn of document.querySelectorAll(".arena")) {
    btn.classList.toggle("on", btn.dataset.arena === data.arenaId);
    btn.disabled = !isHost;
  }
  $("plist").innerHTML = data.players
    .map((p) => {
      const host = p.id === data.hostId ? '<span class="host-tag">hosť</span>' : "";
      const you = p.id === myId ? " (ty)" : "";
      return `<li><span class="dot" style="background:${p.color};color:${p.color}"></span>${escapeHtml(p.name)}${you}${host}</li>`;
    })
    .join("");
  if (data.phase === "lobby") {
    show($("lobby"), true);
    show($("hud"), false);
    show($("win"), false);
    playing = false;
    if (data.pieces) {
      world.buildArenaMaybe(data.radius, data.mode, null, data.pieces, data.layoutKey, data.structures);
    }
  }
  $("mode-pill").textContent = MODE_LABEL[data.mode] || data.mode;
  world.gunsMode = data.mode === "guns";
}

function handleEvent(ev) {
  const feed = $("feed");
  let text = "";
  if (ev.type === "punch") {
    text = `${ev.by} trepol ${ev.victim}`;
    sfx.punch();
    world.addShake(0.22);
  } else if (ev.type === "whoosh") {
    sfx.whoosh();
  } else if (ev.type === "fall") {
    text = ev.by ? `${ev.by} zhodil ${ev.victim}` : `${ev.victim} spadol do prázdna`;
    sfx.fall();
    world.addShake(0.4);
  } else if (ev.type === "boom") {
    text = `BUM! ${ev.victim} vybuchol`;
    sfx.boom();
    world.addShake(0.8);
  } else if (ev.type === "pass") {
    text = `${ev.by} hodil bombu na ${ev.victim}`;
    sfx.pass();
  } else if (ev.type === "shard") {
    world.addShake(0.28);
    sfx.fall();
  } else if (ev.type === "goat") {
    text = "🐐 Koza padá z neba!";
    sfx.goat?.();
    world.addShake(0.35);
  } else if (ev.type === "goatHit") {
    sfx.punch();
    world.addShake(0.45);
  } else if (ev.type === "shot") {
    world.spawnShotTrail?.(ev);
    if (ev.id !== myId) sfx.shoot();
    if (ev.hit) world.addShake(0.12);
  } else if (ev.type === "bulletHit") {
    if (ev.hit) world.addShake(0.1);
  } else if (ev.type === "hit") {
    text = `${ev.by} trafil ${ev.victim} (${ev.hp}%)`;
    sfx.punch();
    world.addShake(0.25);
    const pos =
      ev.x != null
        ? { x: ev.x, y: ev.y, z: ev.z }
        : world.players.get(ev.id)?.mesh?.position;
    if (pos) world.spawnBlood?.(pos);
  } else if (ev.type === "kill") {
    text = ev.by ? `${ev.by} zostrelil ${ev.victim}` : `${ev.victim} vypadol`;
    sfx.fall();
    world.addShake(0.4);
  } else if (ev.type === "grenadeThrow") {
    text = `${ev.by} hodil granát`;
    sfx.nade();
  } else if (ev.type === "grenadeBoom") {
    text = "💥 Granát!";
    sfx.boom();
    world.spawnGrenadeBoom?.(ev);
  } else if (ev.type === "medkit") {
    text = `${ev.by} zobral lekárničku (${ev.hp}%)`;
    sfx.pass();
  } else if (ev.type === "medkitDrop") {
    // silent drop
  }
  if (!text) return;
  const li = document.createElement("li");
  li.textContent = text;
  feed.prepend(li);
  while (feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => li.remove(), 4200);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === "Escape" && playing && world.spectating) {
    e.preventDefault();
    returnToMenu();
    return;
  }
  if (e.code === "Space") jumpQueued = true;
  if (e.code === "KeyG" && world.gunsMode && playing && !world.spectating && !e.repeat) {
    grenadeHolding = true;
    grenadeHoldStart = performance.now();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code === "KeyG" && grenadeHolding) {
    const held = (performance.now() - grenadeHoldStart) / 1400;
    grenadeCharge = Math.max(0.15, Math.min(1, held));
    grenadeQueued = true;
    grenadeHolding = false;
    $("nade-charge").classList.add("hidden");
  }
});

$("view").addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    if (!world.spectating) {
      punchQueued = true;
      if (world.gunsMode) sfx.shoot();
    }
    if (!pointerLocked) lockPointer();
  }
});

document.addEventListener("pointerlockchange", () => {
  const wasLocked = pointerLocked;
  pointerLocked = document.pointerLockElement === $("view");
  if (pointerLocked && !wasLocked) {
    // First events after lock often have bogus huge movementX/Y.
    lookIgnoreUntil = performance.now() + 120;
  }
  // Esc while pointer-locked often never reaches keydown — treat unlock while dead as leave-to-menu.
  if (wasLocked && !pointerLocked && playing && world.spectating) returnToMenu();
});

document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  if (performance.now() < lookIgnoreUntil) return;
  world.look(e.movementX || 0, e.movementY || 0);
});

$("view").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    world.zoom(e.deltaY);
  },
  { passive: false },
);

function lockPointer() {
  $("view").requestPointerLock?.();
}

setInterval(() => {
  if (!myId) return;
  if (grenadeHolding && world.gunsMode && playing) {
    const held = (performance.now() - grenadeHoldStart) / 1400;
    const c = Math.max(0.15, Math.min(1, held));
    $("nade-charge").classList.remove("hidden");
    $("nade-fill").style.width = `${Math.round(c * 100)}%`;
  }
  const mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const mz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  socket.emit("in", {
    mx,
    mz,
    yaw: world.yaw,
    pitch: world.pitch,
    jump: jumpQueued,
    punch: punchQueued,
    shoot: punchQueued,
    dash: false,
    sprint: !!(keys.ShiftLeft || keys.ShiftRight),
    grenade: grenadeQueued,
    grenadeCharge: grenadeCharge,
  });
  jumpQueued = false;
  punchQueued = false;
  dashQueued = false;
  grenadeQueued = false;
}, 1000 / 30);

function loop() {
  world.update(playing);
  requestAnimationFrame(loop);
}
loop();
