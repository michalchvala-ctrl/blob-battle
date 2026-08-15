let ctx;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep(freq, dur = 0.12, type = "square", vol = 0.06, slide = 0) {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.02);
}

export const sfx = {
  unlock: () => ac(),
  punch: () => beep(180, 0.1, "square", 0.07, -80),
  whoosh: () => beep(420, 0.08, "triangle", 0.04, -200),
  dash: () => beep(240, 0.14, "sawtooth", 0.05, 180),
  fall: () => beep(90, 0.35, "sawtooth", 0.07, -50),
  boom: () => {
    beep(70, 0.45, "square", 0.1, -30);
    beep(140, 0.25, "sawtooth", 0.06, -80);
  },
  pass: () => beep(520, 0.1, "triangle", 0.06, 80),
  win: () => {
    beep(523, 0.12, "square", 0.06);
    setTimeout(() => beep(659, 0.12, "square", 0.06), 90);
    setTimeout(() => beep(784, 0.22, "square", 0.07), 180);
  },
  tick: () => beep(880, 0.05, "square", 0.04),
  click: () => beep(700, 0.04, "triangle", 0.03),
  goat: () => {
    beep(220, 0.12, "sawtooth", 0.05, 40);
    setTimeout(() => beep(180, 0.18, "square", 0.06, -60), 70);
  },
  shoot: () => {
    // Punchy pistol bang
    beep(980, 0.04, "square", 0.09, -420);
    beep(220, 0.12, "sawtooth", 0.08, -120);
    beep(90, 0.16, "square", 0.07, -40);
  },
};
