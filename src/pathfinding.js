// Grid A* over the office floor, with line-of-sight smoothing so bots walk
// natural straight lines instead of staircase paths.
import { FLOOR } from './layout.js';

const CELL = 0.2;
export const BOT_RADIUS = 0.3;

export class NavGrid {
  constructor() {
    this.w = Math.round((FLOOR.maxX - FLOOR.minX) / CELL);
    this.h = Math.round((FLOOR.maxZ - FLOOR.minZ) / CELL);
    this.blocked = new Uint8Array(this.w * this.h);
    // keep bots off the floor edges / walls
    this.blockRect(-99, FLOOR.minX + 0.45, -99, 99, 0);
    this.blockRect(FLOOR.maxX - 0.4, 99, -99, 99, 0);
    this.blockRect(-99, 99, -99, FLOOR.minZ + 0.45, 0);
    this.blockRect(-99, 99, FLOOR.maxZ - 0.35, 99, 0);
  }
  toCell(x, z) {
    return [Math.floor((x - FLOOR.minX) / CELL), Math.floor((z - FLOOR.minZ) / CELL)];
  }
  toWorld(cx, cz) {
    return [FLOOR.minX + (cx + 0.5) * CELL, FLOOR.minZ + (cz + 0.5) * CELL];
  }
  blockRect(minX, maxX, minZ, maxZ, pad = BOT_RADIUS) {
    const [x0, z0] = this.toCell(minX - pad, minZ - pad);
    const [x1, z1] = this.toCell(maxX + pad, maxZ + pad);
    for (let z = Math.max(0, z0); z <= Math.min(this.h - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.blocked[z * this.w + x] = 1;
  }
  blockBox(cx, cz, w, d, pad) { this.blockRect(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, pad); }
  // rotated rectangle (rot: same convention as layout.face / desk rot)
  blockOBB(cx, cz, w, d, rot, pad = BOT_RADIUS) {
    const c = Math.cos(rot), s = Math.sin(rot), r = Math.hypot(w, d) / 2 + pad;
    this.blockWhere(cx - r, cx + r, cz - r, cz + r, (x, z) => {
      const dx = x - cx, dz = z - cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c; // into the rectangle's frame
      return Math.abs(lx) <= w / 2 + pad && Math.abs(lz) <= d / 2 + pad;
    });
  }
  blockCircle(cx, cz, r, pad = BOT_RADIUS) {
    const R = r + pad;
    this.blockWhere(cx - R, cx + R, cz - R, cz + R, (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= R * R);
  }
  // block every cell in a box for which test(x, z) is true
  blockWhere(minX, maxX, minZ, maxZ, test) {
    const [x0, z0] = this.toCell(minX, minZ), [x1, z1] = this.toCell(maxX, maxZ);
    for (let cz = Math.max(0, z0); cz <= Math.min(this.h - 1, z1); cz++)
      for (let cx = Math.max(0, x0); cx <= Math.min(this.w - 1, x1); cx++) {
        const [x, z] = this.toWorld(cx, cz);
        if (test(x, z)) this.blocked[cz * this.w + cx] = 1;
      }
  }
  // keep bots inside an arbitrary floor shape: block where inside(x, z) is false
  keepInside(inside, pad = BOT_RADIUS) {
    const probe = [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]];
    this.blockWhere(-99, 99, -99, 99, (x, z) => probe.some(([dx, dz]) => !inside(x + dx, z + dz)));
  }
  unblockRect(minX, maxX, minZ, maxZ) {
    const [x0, z0] = this.toCell(minX, minZ);
    const [x1, z1] = this.toCell(maxX, maxZ);
    for (let z = Math.max(0, z0); z <= Math.min(this.h - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.blocked[z * this.w + x] = 0;
  }
  isBlocked(x, z) {
    const [cx, cz] = this.toCell(x, z);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return true;
    return this.blocked[cz * this.w + cx] === 1;
  }
  nearestFree(x, z) {
    if (!this.isBlocked(x, z)) return [x, z];
    for (let r = CELL; r < 3; r += CELL)
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
        if (!this.isBlocked(nx, nz)) return [nx, nz];
      }
    return [x, z];
  }
  lineClear(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(dist / 0.08);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  find(ax, az, bx, bz) {
    [ax, az] = this.nearestFree(ax, az);
    [bx, bz] = this.nearestFree(bx, bz);
    this.lastFound = true;
    if (this.lineClear(ax, az, bx, bz)) return [[bx, bz]];
    const [sx, sz] = this.toCell(ax, az);
    const [tx, tz] = this.toCell(bx, bz);
    const W = this.w, N = W * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const start = sz * W + sx, goal = tz * W + tx;
    g[start] = 0;
    heap.push(start, 0);
    const h = (i) => {
      const dx = Math.abs((i % W) - tx), dz = Math.abs(((i / W) | 0) - tz);
      return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
    };
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    let found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const ni = nz * W + nx;
        if (this.blocked[ni] || closed[ni]) continue;
        if (dx && dz && (this.blocked[cz * W + nx] || this.blocked[nz * W + cx])) continue; // no corner cutting
        const ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; heap.push(ni, ng + h(ni)); }
      }
    }
    this.lastFound = found;
    if (!found) return [[bx, bz]];
    const cells = [];
    for (let i = goal; i !== -1; i = from[i]) cells.push(this.toWorld(i % W, (i / W) | 0));
    cells.reverse();
    cells[cells.length - 1] = [bx, bz];
    // string-pull
    const out = [];
    let px = ax, pz = az, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineClear(px, pz, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]);
      [px, pz] = cells[j];
      i = j + 1;
    }
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p; K.push(k); P.push(p);
    let i = K.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (P[j] <= P[i]) break;
      [K[i], K[j]] = [K[j], K[i]]; [P[i], P[j]] = [P[j], P[i]]; i = j;
    }
  }
  pop() {
    const K = this.k, P = this.p, top = K[0];
    const lk = K.pop(), lp = P.pop();
    if (K.length) {
      K[0] = lk; P[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < K.length && P[l] < P[m]) m = l;
        if (r < K.length && P[r] < P[m]) m = r;
        if (m === i) break;
        [K[i], K[m]] = [K[m], K[i]]; [P[i], P[m]] = [P[m], P[i]]; i = m;
      }
    }
    return top;
  }
}
