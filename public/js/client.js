import { GameWorld } from "./world.js";
import { sfx } from "./audio.js";
import { ARENA_INFO, ARENA_IDS } from "./arenas.js";

const $ = (id) => document.getElementById(id);
const socket = window.io({ transports: ["websocket", "polling"] });
const world = new GameWorld($("view"));

const nameInput = $("name");
const codeInput = $("code");
nameInput.value = localStorage.getItem("zk-name") || "";

let myId = null;
let lobby = null;
let playing = false;
let lastBombT = 99;
const keys = Object.create(null);
let jumpQueued = false;
let punchQueued = false;
let dashQueued = false;
let pointerLocked = false;
let lookIgnoreUntil = 0;

const MODE_LABEL = { sumo: "Zhodiť", bomb: "Bomba", hill: "Kráľ kopca" };

function show(el, on) {
  el.classList.toggle("hidden", !on);
}

function menuErr(msg) {
  $("menu-err").hidden = !msg;
  $("menu-err").textContent = msg || "";
}

function syncArenaVisual(data) {
  if (!data) return;
  world.buildArena(
    data.radius || 13,
    data.mode === "hill" && data.shards?.length ? "hill" : data.mode || "sumo",
    data.shards || null,
    data.pieces || null,
    data.layoutKey || "",
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
  const name = nameInput.value.trim();
  localStorage.setItem("zk-name", name);
  socket.emit("create", { name });
};

$("btn-join").onclick = () => {
  sfx.unlock();
  sfx.click();
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
  world.buildArenaMaybe(st.radius, st.mode, st.shards, st.pieces, st.layoutKey);
  world.syncPlayers(st.players);
  world.syncBoxes(st.boxes);
  world.syncDebris(st.debris);
  if (st.shards) world.syncShards(st.shards);
  world.setBomb(st.bombId);

  const me = st.players.find((p) => p.id === myId);
  const aliveN = st.players.filter((p) => p.alive).length;
  $("alive-pill").textContent = `${aliveN} v hre`;
  if (st.phase === "playing" && me && !me.alive) {
    $("you-dead").classList.remove("hidden");
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
      world.buildArenaMaybe(data.radius, data.mode, null, data.pieces, data.layoutKey);
    }
  }
  $("mode-pill").textContent = MODE_LABEL[data.mode] || data.mode;
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
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    dashQueued = true;
    if (playing) sfx.dash();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

$("view").addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    if (!world.spectating) punchQueued = true;
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
  const mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const mz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  socket.emit("in", {
    mx,
    mz,
    yaw: world.yaw,
    jump: jumpQueued,
    punch: punchQueued,
    dash: dashQueued,
  });
  jumpQueued = false;
  punchQueued = false;
  dashQueued = false;
}, 1000 / 30);

function loop() {
  world.update(playing);
  requestAnimationFrame(loop);
}
loop();
