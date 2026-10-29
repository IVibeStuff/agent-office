// Office floor plan. Units are metres-ish. x: left(-) → right(+), z: back(-) → front(+).
// The camera looks from the front-right, so the back wall (z = -9) and the
// left wall (x = -12) are the two visible walls.

export const FLOOR = { minX: -12, maxX: 12, minZ: -9, maxZ: 9 };
export const WALL_H = 3.2;
export const BACK_WALL_Z = -8.85; // inner face
export const LEFT_WALL_X = -11.85; // inner face
export const WINDOWS_FROM_X = 0.4; // back wall is glass from here to the right edge

// facing helper: direction the bot looks → rotation.y (model faces +z at 0)
export const face = (dx, dz) => Math.atan2(dx, dz);

// Glass corner office for the lead
export const LEAD_OFFICE = { minX: 4.8, maxX: 11.85, minZ: BACK_WALL_Z, maxZ: -3.2, doorMinX: 5.6, doorMaxX: 7.0 };

// Department zones (carpets). label sits at the front strip, nothing placed on it.
// Desk slots. Team members pick one with "desk" in office.config.json;
// "lead" is the glass corner office. Unused slots show as "Open Desk". Eight in all:
// every theme defines a desk for each of these.
export const SLOTS = ['lead', 'back-mid', 'back-right', 'back-left', 'mid-left', 'mid-right', 'front-left', 'front-right'];

export const ZONES = {
  'back-left':  { minX: -11.6, maxX: -6.4, minZ: -8.6, maxZ: -3.8 },
  'back-mid':   { minX: -6.1,  maxX: -0.3, minZ: -8.6, maxZ: -3.8 },
  'back-right': { minX: 0.0,   maxX: 4.5,  minZ: -8.6, maxZ: -3.8 },
  'lead':       { minX: 5.1,   maxX: 11.6, minZ: -8.6, maxZ: -3.5 },
  'mid-left':   { minX: -11.6, maxX: -4.9, minZ: -2.9, maxZ: 2.7 },
  'mid-right':  { minX: -1.5,  maxX: 4.4,  minZ: -2.9, maxZ: 2.7 },
  'front-left': { minX: 5.4,   maxX: 8.4,  minZ: 3.6,  maxZ: 8.6 },
  'front-right':{ minX: 8.6,   maxX: 11.6, minZ: 3.6,  maxZ: 8.6 },
};

// Desks: chair on the south side (bot faces the back wall) except the lead,
// who sits behind the desk facing the door.
export const DESKS = {
  'back-left':  { x: -9.0, z: -6.6, w: 1.9, d: 0.85 },
  'back-mid':   { x: -2.4, z: -6.6, w: 1.9, d: 0.85 },
  'back-right': { x: 2.3,  z: -6.6, w: 1.9, d: 0.85 },
  'mid-left':   { x: -8.2, z: -0.9, w: 1.9, d: 0.85 },
  'mid-right':  { x: 1.5,  z: -0.9, w: 1.9, d: 0.85 },
  'front-left': { x: 6.9,  z: 4.9,  w: 1.9, d: 0.85 },
  'front-right':{ x: 10.1, z: 4.9,  w: 1.9, d: 0.85 },
  'lead':       { x: 8.6,  z: -7.1, w: 2.5, d: 1.0, north: true },
};

// Give every team member a desk slot (lead → glass office, others in order)
export function assignDesks(team, leadId) {
  const taken = new Set();
  const out = {};
  const lead = team.find((m) => m.id === leadId);
  if (lead) { out[lead.id] = 'lead'; taken.add('lead'); }
  for (const m of team) if (m.id !== leadId && m.desk && DESKS[m.desk] && !taken.has(m.desk)) { out[m.id] = m.desk; taken.add(m.desk); }
  for (const m of team) {
    if (out[m.id]) continue;
    const free = SLOTS.find((s) => !taken.has(s));
    if (free) { out[m.id] = free; taken.add(free); }
  }
  return out; // up to 8 members, one desk each
}

export function deskSeat(id, desks = DESKS) {
  const d = desks[id];
  if (d.rot !== undefined) return rotSeat(d);
  if (d.north) {
    const cz = d.z - d.d / 2 - 0.5;
    return { x: d.x, z: cz, rot: face(0, 1), sit: true, approach: { x: d.x + d.w / 2 + 0.7, z: cz } };
  }
  const cz = d.z + d.d / 2 + 0.5;
  return { x: d.x, z: cz, rot: face(0, -1), sit: true, approach: { x: d.x, z: cz + 0.85 } };
}

// Where a colleague stands to talk to someone at their desk / drop off work
export function deskVisitor(id, slot = 0, desks = DESKS) {
  const d = desks[id];
  if (d.rot !== undefined) return rotVisitor(d, slot);
  if (d.north) {
    const x = d.x + (slot ? 0.75 : -0.35);
    return { x, z: d.z + d.d / 2 + 0.75, rot: face(0, -1), sit: false };
  }
  const side = slot ? -1 : 1;
  const x = d.x + side * (d.w / 2 + 0.55);
  const z = d.z + d.d / 2 + 0.45;
  return { x, z, rot: face(-side, -0.3), sit: false };
}

// ---- desks at any angle (themes with their own floor plan) ----
// d = { x, z, w, d, rot }: rot is the direction the seated person faces
// (same convention as face()); the chair sits behind them, away from the desk.
// Optional: chairGap (default 0.5), approachGap (0.85), visitorGap (0.55).
const fwd = (rot) => [Math.sin(rot), Math.cos(rot)];
const right = (rot) => [-Math.cos(rot), Math.sin(rot)];
export function rotSeat(d) {
  const [fx, fz] = fwd(d.rot), back = d.d / 2 + (d.chairGap ?? 0.5), ap = d.approachGap ?? 0.85;
  const x = d.x - fx * back, z = d.z - fz * back;
  return { x, z, rot: d.rot, sit: true, approach: d.approach || { x: x - fx * ap, z: z - fz * ap } };
}
export function rotVisitor(d, slot = 0) {
  const [fx, fz] = fwd(d.rot), [rx, rz] = right(d.rot);
  const side = slot ? -1 : 1, off = d.w / 2 + (d.visitorGap ?? 0.55), back = d.d / 2 + 0.45;
  const x = d.x + rx * side * off - fx * back, z = d.z + rz * side * off - fz * back;
  const seat = rotSeat(d);
  return { x, z, rot: Math.atan2(seat.x - x, seat.z - z), sit: false };
}
// Seat on a bench/sofa facing `rot`, entered from `gap` in front
export function benchSeat(x, z, rot, gap = 0.85) {
  const [fx, fz] = fwd(rot);
  return { x, z, rot, sit: true, approach: { x: x + fx * gap, z: z + fz * gap } };
}

// Lounge
export const LOUNGE = { cx: -3.2, cz: 6.1, r: 2.75 };
export const SOFA_A = { x: -3.1, z: 3.95, w: 4.2, d: 0.95 };          // faces +z
export const SOFA_B = { x: -6.45, z: 6.55, w: 0.95, d: 3.4 };          // faces +x
export const ARMCHAIR = { x: 0.75, z: 6.4, w: 0.95, d: 0.95 };         // faces -x
export const COFFEE_TABLE = { x: -3.1, z: 6.15, w: 1.7, d: 0.9 };

export const LOUNGE_SEATS = [
  { x: -4.6, z: 4.2, rot: face(0, 1), sit: true, approach: { x: -4.6, z: 5.05 } },
  { x: -1.6, z: 4.2, rot: face(0, 1), sit: true, approach: { x: -1.6, z: 5.05 } },
  { x: -6.3, z: 5.6, rot: face(1, 0), sit: true, approach: { x: -5.35, z: 5.6 } },
  { x: -6.3, z: 7.5, rot: face(1, 0), sit: true, approach: { x: -5.35, z: 7.5 } },
  { x: -3.6, z: 4.2, rot: face(0, 1), sit: true, approach: { x: -3.6, z: 5.05 } },
  { x: -2.6, z: 4.2, rot: face(0, 1), sit: true, approach: { x: -2.6, z: 5.05 } },
  { x: -6.3, z: 6.55, rot: face(1, 0), sit: true, approach: { x: -5.35, z: 6.55 } },
  { x: 0.85, z: 6.4, rot: face(-1, 0), sit: true, approach: { x: -0.1, z: 6.4 } },
];

// Break room
export const BREAK = { minX: 5.3, maxX: 11.6, minZ: -2.8, maxZ: 3.0, label: 'Break Room' };
export const COUNTER = { x: 11.25, z: -0.9, w: 0.6, d: 3.0 };   // along the east edge
export const FRIDGE = { x: 11.2, z: 1.4, w: 0.7, d: 0.8 };
export const BREAK_TABLE = { x: 8.3, z: 0.5, r: 0.55 };
export const STOOLS = [ { x: 7.45, z: 0.75 }, { x: 9.15, z: 0.75 }, { x: 8.3, z: -0.35 } ];
export const WATER = { x: 11.2, z: 2.55 };

// Huddle table (front, between the lounge and the front desks)
export const HUDDLE = { x: 3.0, z: 6.7, w: 2.0, d: 1.0 };

// Research wall screens, server racks
export const WALL_SCREENS = [ { x: -10.5, kind: 'chart' }, { x: -9.0, kind: 'map' }, { x: -7.5, kind: 'terminal' } ];
export const RACKS = [ { x: -5.5 }, { x: -4.75 }, { x: -4.0 } ];
export const RACK = { z: -8.4, w: 0.7, d: 0.8, h: 2.1 };

export const USAGE_BOARD = { z: -0.3, y: 2.0, w: 3.0, h: 1.45 };
export const DOOR = { z: 5.9, w: 1.3 };

export const PLANTS = [
  { x: -11.25, z: -3.35, s: 1.0 }, { x: -11.2, z: 8.35, s: 1.15 }, { x: 11.3, z: 8.35, s: 1.1 },
  { x: 5.55, z: -8.25, s: 0.95 }, { x: 11.3, z: -8.3, s: 0.9 }, { x: -0.15, z: -8.35, s: 0.9 },
  { x: 3.7, z: 8.35, s: 0.85 }, { x: -11.25, z: 2.95, s: 0.8 }, { x: 0.9, z: 4.1, s: 0.75 },
];
