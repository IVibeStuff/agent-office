// Procedural canvas textures: floor, carpets with lettering, sky, and the
// animated screens. Everything is drawn at high resolution so text stays sharp.
import * as THREE from 'three';

let maxAniso = 8;
export const setMaxAnisotropy = (n) => { maxAniso = n; };

export function tex(canvas, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
export const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// mix two hex colors in sRGB (perceptual) space
export function mix(a, b, t) {
  const p = (h) => { h = new THREE.Color(h).getHexString(); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export function woodFloor() {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d'), r = rng(7);
  const rowH = 64;
  for (let y = 0; y < S; y += rowH) {
    let x = -Math.floor(r() * 300);
    while (x < S) {
      const len = 260 + r() * 340;
      const l = 40 + r() * 8, s = 34 + r() * 9, li = 40 + r() * 8;
      g.fillStyle = `hsl(${l - 14}, ${s}%, ${li}%)`;
      g.fillRect(x, y, len, rowH);
      g.globalAlpha = 0.09;
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = r() > 0.5 ? '#3a2412' : '#e0b183';
        g.lineWidth = 1 + r() * 1.5;
        g.beginPath();
        const yy = y + 6 + r() * (rowH - 12);
        g.moveTo(x, yy);
        g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 6, x + len * 0.7, yy + (r() - 0.5) * 6, x + len, yy);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(40,22,10,.55)';
      g.fillRect(x, y, 2, rowH);
      x += len;
    }
    g.fillStyle = 'rgba(40,22,10,.5)';
    g.fillRect(0, y, S, 2);
  }
  return tex(c, { repeat: [4, 3] });
}

export function tiles() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, S, S);
  const n = 4, t = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? '#cfcbc3' : '#dcd9d2';
    g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
  }
  return tex(c, { repeat: [3, 3] });
}

export function letter(g, text, x, y, size, color, spacing = 0.22) {
  g.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const chars = text.toUpperCase().split('');
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * size * (chars.length - 1);
  let cx = x - total / 2;
  chars.forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + spacing * size; });
}

// Rectangular department carpet with its name lettered into the front strip
export function carpet(color, label, wU, dU) {
  const ppu = 160;
  const W = Math.min(2048, Math.round(wU * ppu)), H = Math.min(2048, Math.round(dU * ppu));
  const sx = W / wU, sy = H / dU;
  const c = canvas(W, H), g = c.getContext('2d'), r = rng(label.length * 97);
  const base = mix(color, '#2c313a', 0.76);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // woven texture
  g.globalAlpha = 0.05;
  for (let i = 0; i < W * H / 220; i++) {
    g.fillStyle = r() > 0.5 ? '#ffffff' : '#000000';
    g.fillRect(r() * W, r() * H, 2, 2);
  }
  g.globalAlpha = 1;
  // inset border
  g.strokeStyle = mix(color, base, 0.55);
  g.lineWidth = 0.05 * sx;
  const inset = 0.18 * sx;
  g.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  // lettering
  letter(g, label, W / 2, H - 0.55 * sy, Math.round(0.42 * sy), mix(color, base, 0.25));
  return tex(c);
}

export function roundRug(color, label, rU) {
  const S = 2048, c = canvas(S, S), g = c.getContext('2d'), ppu = S / (rU * 2);
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  g.lineWidth = 0.06 * ppu; g.strokeStyle = mix(color, '#ffffff', 0.18);
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 0.22 * ppu, 0, Math.PI * 2); g.stroke();
  letter(g, label, S / 2, S / 2 + 1.6 * ppu, Math.round(0.42 * ppu), mix(color, '#ffffff', 0.32));
  return tex(c);
}

export function floorLabel(label, color, wU, dU) {
  const ppu = 160, W = Math.round(wU * ppu), H = Math.round(dU * ppu);
  const c = canvas(W, H), g = c.getContext('2d');
  letter(g, label, W / 2, H / 2, Math.round(0.4 * ppu), color);
  return tex(c);
}

// Sky seen through the windows
export const SKY = {
  day:     ['#7fb7e6', '#cfe6f5', '#e9f2f7'],
  evening: ['#3c3f78', '#d8786a', '#f3b47c'],
  night:   ['#070b18', '#121a33', '#1d2645'],
};
export function skyTexture() {
  const c = canvas(64, 512);
  const t = tex(c);
  const draw = (tod) => {
    const g = c.getContext('2d');
    const [a, b, d] = SKY[tod];
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, a); gr.addColorStop(0.65, b); gr.addColorStop(1, d);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
    t.needsUpdate = true;
  };
  draw('day');
  return { texture: t, draw };
}

// City skyline silhouette strip (sits behind the windows)
export function skylineTexture() {
  const W = 2048, H = 256, c = canvas(W, H), g = c.getContext('2d'), r = rng(42);
  const t = tex(c);
  const lights = [];
  let x = 0;
  const bld = [];
  while (x < W) { const w = 40 + r() * 90, h = 50 + r() * 170; bld.push([x, w, h]); x += w + 4; }
  for (const [bx, w, h] of bld)
    for (let wy = H - h + 10; wy < H - 8; wy += 14)
      for (let wx = bx + 6; wx < bx + w - 8; wx += 12) if (r() > 0.45) lights.push([wx, wy]);
  const draw = (tod) => {
    g.clearRect(0, 0, W, H);
    const col = tod === 'day' ? '#8aa3b8' : tod === 'evening' ? '#4a3d5e' : '#0d1222';
    g.fillStyle = col;
    for (const [bx, w, h] of bld) g.fillRect(bx, H - h, w, h);
    if (tod !== 'day') {
      g.fillStyle = tod === 'night' ? 'rgba(255,214,140,.85)' : 'rgba(255,214,140,.45)';
      for (const [lx, ly] of lights) g.fillRect(lx, ly, 5, 7);
    }
    t.needsUpdate = true;
  };
  draw('day');
  return { texture: t, draw };
}

// ---------- animated screens ----------
class Screen {
  constructor(w, h) { this.c = canvas(w, h); this.g = this.c.getContext('2d'); this.texture = tex(this.c); this.w = w; this.h = h; }
  flush() { this.texture.needsUpdate = true; }
}

export class ChartScreen extends Screen {
  constructor() { super(640, 400); this.a = []; this.b = []; this.r = rng(3); for (let i = 0; i < 48; i++) this.step(); }
  step() {
    const r = this.r, la = this.a.at(-1) ?? 0.5, lb = this.b.at(-1) ?? 0.35;
    this.a.push(Math.min(0.92, Math.max(0.1, la + (r() - 0.47) * 0.09)));
    this.b.push(Math.min(0.9, Math.max(0.08, lb + (r() - 0.5) * 0.07)));
    if (this.a.length > 48) { this.a.shift(); this.b.shift(); }
  }
  draw() {
    this.step();
    const { g, w, h } = this;
    g.fillStyle = '#0c1220'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7f8ba3'; g.font = '600 22px system-ui, sans-serif'; g.fillText('THROUGHPUT', 26, 40);
    g.strokeStyle = '#1b2539'; g.lineWidth = 2;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(24, 60 + i * 64); g.lineTo(w - 24, 60 + i * 64); g.stroke(); }
    const plot = (arr, color) => {
      g.beginPath();
      arr.forEach((v, i) => { const x = 24 + (i / 47) * (w - 48), y = h - 30 - v * (h - 110); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = color; g.lineWidth = 4; g.stroke();
    };
    plot(this.b, '#14b8a6'); plot(this.a, '#7c8cff');
    this.flush();
  }
}

const US = [[-124.7,48.4],[-123,46.2],[-124.2,43],[-124.4,40.4],[-122.4,37.2],[-120.6,34.6],[-117.1,32.6],[-114.7,32.7],[-111,31.3],[-108.2,31.3],[-106.5,31.8],[-104.5,29.6],[-103,29],[-101.4,29.8],[-99.5,27.5],[-97.4,25.9],[-97.2,27.8],[-94.7,29.4],[-91,29.2],[-89.4,30.2],[-88,30.4],[-85.3,29.7],[-83.6,29],[-82.6,27.5],[-81.6,25.2],[-80.4,25.2],[-80.1,26.9],[-81.3,30.4],[-80.9,32],[-78.6,33.9],[-75.5,35.3],[-76.1,37.2],[-75.2,38.4],[-74,40.5],[-71.8,41.3],[-70,41.8],[-70.6,42.7],[-70.2,43.7],[-67,44.8],[-67.8,47.1],[-69.2,47.4],[-71.5,45],[-74.9,45],[-76.5,44.2],[-79.2,43.4],[-78.9,42.9],[-82.4,41.7],[-83.5,42.2],[-82.4,43],[-82.6,45.4],[-84.7,46.5],[-88.3,48.3],[-89.6,48],[-95.2,49],[-123,49]];
const CITIES = [[-122.4,37.8],[-118.2,34.1],[-87.6,41.9],[-74,40.7],[-95.4,29.8],[-96.8,32.8],[-84.4,33.7],[-104.9,39.7],[-122.3,47.6],[-80.2,25.8],[-71.1,42.4],[-112.1,33.4]];

export class MapScreen extends Screen {
  constructor() {
    super(640, 400);
    this.t = 0;
    const proj = ([lon, lat]) => [40 + ((lon + 125) / 58) * 560, 60 + ((49.5 - lat) / 25) * 300];
    const g = this.g;
    const path = new Path2D();
    US.forEach((p, i) => { const [x, y] = proj(p); i ? path.lineTo(x, y) : path.moveTo(x, y); });
    path.closePath();
    this.dots = [];
    for (let y = 60; y < 370; y += 11) for (let x = 40; x < 610; x += 11) if (g.isPointInPath(path, x, y)) this.dots.push([x, y]);
    this.cities = CITIES.map(proj);
  }
  draw() {
    this.t++;
    const { g, w, h } = this;
    g.fillStyle = '#0c1220'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7f8ba3'; g.font = '600 22px system-ui, sans-serif'; g.fillText('COVERAGE', 26, 40);
    g.fillStyle = '#26324a';
    for (const [x, y] of this.dots) { g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); }
    this.cities.forEach(([x, y], i) => {
      const p = ((this.t * 0.06 + i * 0.37) % 1);
      g.strokeStyle = `rgba(20,184,166,${0.7 * (1 - p)})`; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 6 + p * 22, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#2dd4bf'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    });
    this.flush();
  }
}

const TERMINAL_LINES = [
  '> summarize sources --top 5', 'reading 12 documents…', 'extracting key claims', 'cross-checking dates',
  'confidence: high', '> draft outline', 'section 1: background', 'section 2: findings', 'section 3: open questions',
  '> compare options a b c', 'cost  ▓▓▓▓▓░░  ', 'speed ▓▓▓▓▓▓░  ', 'risk  ▓▓░░░░░  ', 'done ✓',
];
export class TerminalScreen extends Screen {
  constructor() { super(640, 400); this.lines = []; this.i = 0; this.ch = 0; }
  draw() {
    const src = TERMINAL_LINES[this.i % TERMINAL_LINES.length];
    this.ch += 3;
    if (this.ch > src.length + 6) { this.lines.push(src); this.i++; this.ch = 0; if (this.lines.length > 9) this.lines.shift(); }
    const { g, w, h } = this;
    g.fillStyle = '#0a0f17'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7f8ba3'; g.font = '600 22px system-ui, sans-serif'; g.fillText('AI TERMINAL', 26, 40);
    g.font = '24px ui-monospace, Consolas, monospace';
    this.lines.forEach((l, k) => { g.fillStyle = l.startsWith('>') ? '#a5b4fc' : '#8ee6d4'; g.fillText(l, 26, 88 + k * 32); });
    const partial = src.slice(0, Math.min(this.ch, src.length));
    g.fillStyle = partial.startsWith('>') ? '#a5b4fc' : '#8ee6d4';
    const y = 88 + this.lines.length * 32;
    g.fillText(partial, 26, y);
    if ((this.ch >> 2) % 2 === 0) g.fillRect(28 + g.measureText(partial).width, y - 20, 12, 24);
    this.flush();
  }
}

// One shared "code" texture for every working desk monitor
export class CodeScreen extends Screen {
  constructor() {
    super(384, 240); this.r = rng(11); this.rows = [];
    for (let i = 0; i < 14; i++) this.rows.push(this.row());
  }
  row() {
    const r = this.r, segs = [], indent = Math.floor(r() * 4) * 18;
    let x = 18 + indent;
    const n = 1 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const w = 20 + r() * 70; segs.push([x, w, ['#7c8cff', '#2dd4bf', '#fbbf24', '#9aa4b5', '#f472b6'][Math.floor(r() * 5)]]); x += w + 10; }
    return segs;
  }
  draw() {
    this.rows.shift(); this.rows.push(this.row());
    const { g, w, h } = this;
    g.fillStyle = '#0d1424'; g.fillRect(0, 0, w, h);
    this.rows.forEach((segs, i) => segs.forEach(([x, sw, c]) => { g.fillStyle = c; g.globalAlpha = 0.85; g.fillRect(x, 14 + i * 16, sw, 7); }));
    g.globalAlpha = 1;
    this.flush();
  }
}

// Weekly usage board on the wall. Only shows real readings.
export class UsageBoard extends Screen {
  constructor(style = {}) {
    super(1200, 580);
    this.s = { bg: '#10151f', frame: '#263044', title: 'WEEKLY USAGE', accent: '#5b6cf0', big: '#eef0f4', text: '#c7cdd8', muted: '#8a93a3', faint: '#5d6676', track: '#232a36', font: 'system-ui, sans-serif', ...style };
    this.draw(null);
  }
  draw(u) {
    const { g, w, h } = this;
    g.fillStyle = this.s.bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = this.s.frame; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = this.s.muted; g.font = '600 40px ' + this.s.font; g.textBaseline = 'alphabetic';
    g.fillText(this.s.title, 56, 90);
    if (!u) {
      g.fillStyle = this.s.text; g.font = '600 58px ' + this.s.font;
      g.fillText('No reading yet', 56, 250);
      g.fillStyle = this.s.muted; g.font = '34px ' + this.s.font;
      g.fillText('Fills from Claude Code logs or a usage push', 56, 320);
      return this.flush();
    }
    const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
    if (u.limitTokens) {
      const left = Math.max(0, 1 - u.usedTokens / u.limitTokens);
      g.fillStyle = this.s.big; g.font = '700 150px ' + this.s.font;
      const pct = `${Math.round(left * 100)}%`;
      g.fillText(pct, 52, 270);
      const pw = g.measureText(pct).width;
      g.fillStyle = this.s.muted; g.font = '40px ' + this.s.font;
      g.fillText('left this week', 52 + pw + 28, 262);
      g.fillStyle = this.s.track; g.fillRect(56, 320, w - 112, 26);
      g.fillStyle = left < 0.15 ? '#f87171' : this.s.accent; g.fillRect(56, 320, (w - 112) * (1 - left), 26);
      g.fillStyle = this.s.muted; g.font = '34px ' + this.s.font;
      g.fillText(`${fmt(u.usedTokens)} of ${fmt(u.limitTokens)} tokens used`, 56, 410);
    } else {
      g.fillStyle = this.s.big; g.font = '700 150px ' + this.s.font;
      g.fillText(fmt(u.usedTokens), 52, 270);
      g.fillStyle = this.s.muted; g.font = '40px ' + this.s.font;
      g.fillText('tokens used this week', 56, 340);
    }
    if (u.resetsAt) {
      const ms = new Date(u.resetsAt) - Date.now();
      const d = Math.floor(ms / 864e5), hh = Math.floor((ms % 864e5) / 36e5);
      g.fillStyle = this.s.text; g.font = '600 38px ' + this.s.font;
      g.fillText(ms > 0 ? `Resets in ${d}d ${hh}h` : 'Resetting…', 56, 490);
    }
    g.fillStyle = this.s.faint; g.font = '30px ' + this.s.font;
    const src = `${u.source || ''} · read ${new Date(u.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    g.textAlign = 'right'; g.fillText(src, w - 56, 490); g.textAlign = 'left';
    this.flush();
  }
}
