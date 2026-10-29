// A little blocky person in its flat, matte profile color.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const SPEED = 1.55;
const HIP = 0.42;

function part(mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(box, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export class Bot {
  constructor(member, nav) {
    this.id = member.id;
    this.member = member;
    this.nav = nav;
    const mat = new THREE.MeshLambertMaterial({ color: member.color });
    const dark = new THREE.MeshLambertMaterial({ color: '#1b1f27' });

    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.group.userData.botId = member.id;

    const mkLimb = (x, y, w, h, d) => {
      const pivot = new THREE.Object3D();
      pivot.position.set(x, y, 0);
      const m = part(mat, w, h, d, 0, -h / 2, 0);
      m.userData.botId = member.id;
      pivot.add(m);
      this.body.add(pivot);
      return pivot;
    };
    this.legL = mkLimb(-0.09, HIP, 0.15, HIP, 0.17);
    this.legR = mkLimb(0.09, HIP, 0.15, HIP, 0.17);
    this.armL = mkLimb(-0.27, 0.82, 0.11, 0.38, 0.13);
    this.armR = mkLimb(0.27, 0.82, 0.11, 0.38, 0.13);
    const torso = part(mat, 0.42, 0.44, 0.25, 0, HIP + 0.22, 0);
    const head = part(mat, 0.32, 0.3, 0.3, 0, 0.86 + 0.18, 0);
    torso.userData.botId = head.userData.botId = member.id;
    this.body.add(torso, head);
    // eyes show which way the bot faces
    for (const x of [-0.07, 0.07]) this.body.add(part(dark, 0.05, 0.06, 0.02, x, 1.06, 0.151));

    // paperwork carried during a handoff
    this.paper = part(new THREE.MeshLambertMaterial({ color: '#f3f0e8' }), 0.26, 0.04, 0.2, 0, 0.66, 0.24);
    this.paper.visible = false;
    this.body.add(this.paper);

    // name tag
    this.tagEl = document.createElement('div');
    this.tagEl.className = 'tag';
    this.tagEl.innerHTML = `<span class="d"></span><span class="ico"></span><span class="n"></span><span class="full"></span>`;
    this.tagEl.querySelector('.n').textContent = member.name;
    this.tag = new CSS2DObject(this.tagEl);
    this.tag.position.set(0, 1.42, 0);
    this.group.add(this.tag);

    this.path = [];
    this.goalKey = null;
    this.goal = null;
    this.phase = 'idle'; // walking | entering | seated | standing
    this.walkT = 0;
    this.targetRot = 0;
    this.pose = 'rest'; // rest | type
    this.typeT = Math.random() * 10;
  }

  place(spot) {
    this.group.position.set(spot.x, this.heightAt ? this.heightAt(spot.x, spot.z) : 0, spot.z);
    this.group.rotation.y = this.targetRot = spot.rot ?? 0;
    this.goal = spot;
    this.path = [];
    if (spot.sit) this.sit(); else this.stand('standing');
  }

  get seated() { return this.phase === 'seated'; }
  arrivedAt(key) { return this.goalKey === key && (this.phase === 'seated' || this.phase === 'standing'); }

  goTo(key, spot, onArrive) {
    if (key === this.goalKey) return;
    this.goalKey = key;
    this.onArrive = onArrive || null;
    const from = this.group.position;
    // get up from a seat first, stepping back out the way we came in
    if (this.phase === 'seated' && this.goal?.approach) {
      this.stand('walking');
      this.path = [[this.goal.approach.x, this.goal.approach.z]];
      this.afterExit = true;
    } else {
      this.stand('walking');
      this.path = [];
      this.afterExit = false;
    }
    this.goal = spot;
    const start = this.afterExit ? this.path[0] : [from.x, from.z];
    const dest = spot.approach || spot;
    this.path.push(...this.nav.find(start[0], start[1], dest.x, dest.z));
    if (spot.approach) this.path.push([spot.x, spot.z, 'enter']);
  }

  sit() {
    this.phase = 'seated';
    this.body.position.y = 0.05;
    this.legL.rotation.x = this.legR.rotation.x = -Math.PI / 2;
    this.setArms();
  }
  stand(phase) {
    this.phase = phase;
    this.body.position.y = 0;
    this.legL.rotation.x = this.legR.rotation.x = 0;
    this.armL.rotation.x = this.armR.rotation.x = this.paper.visible ? -1.2 : 0;
  }
  setPose(pose) { this.pose = pose; if (this.phase === 'seated') this.setArms(); }
  setArms() {
    const a = this.pose === 'type' ? -1.15 : -0.35;
    this.armL.rotation.x = this.armR.rotation.x = a;
  }
  carry(on) {
    this.paper.visible = on;
    if (this.phase !== 'seated') this.armL.rotation.x = this.armR.rotation.x = on ? -1.2 : 0;
  }

  setTag(state, name, role, text) {
    const d = this.tagEl.querySelector('.d');
    d.className = 'd ' + state;
    const ico = this.tagEl.querySelector('.ico');
    ico.className = 'ico ' + state;
    ico.textContent = state === 'waiting' ? '?' : state === 'error' ? '!' : '';
    this.tagEl.querySelector('.full').textContent = ` · ${role}${text ? ' — ' + text : ''}`;
  }

  update(dt) {
    const p = this.group.position;
    if (this.heightAt) p.y = this.heightAt(p.x, p.z);
    if (this.phase === 'walking') {
      const next = this.path[0];
      if (!next) { this.arrive(); }
      else {
        const dx = next[0] - p.x, dz = next[1] - p.z;
        const dist = Math.hypot(dx, dz);
        const step = SPEED * dt * (next[2] === 'enter' ? 0.6 : 1);
        if (dist <= step) {
          p.x = next[0]; p.z = next[1];
          this.path.shift();
          if (!this.path.length) { this.arrive(); return this.turn(dt); }
        } else {
          p.x += (dx / dist) * step; p.z += (dz / dist) * step;
          if (next[2] !== 'enter') this.targetRot = Math.atan2(dx, dz);
        }
        // walk cycle (legs + arms only)
        this.walkT += dt * 9;
        const sw = Math.sin(this.walkT) * 0.55;
        this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
        if (!this.paper.visible) { this.armL.rotation.x = -sw * 0.8; this.armR.rotation.x = sw * 0.8; }
      }
    } else if (this.phase === 'seated' && this.pose === 'type') {
      // tiny typing motion in the forearms only; the body never bobs
      this.typeT += dt * 14;
      this.armL.rotation.x = -1.15 + Math.sin(this.typeT) * 0.05;
      this.armR.rotation.x = -1.15 + Math.sin(this.typeT + 1.7) * 0.05;
    }
    this.turn(dt);
  }

  turn(dt) {
    let dr = this.targetRot - this.group.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    if (Math.abs(dr) > 0.001) this.group.rotation.y += dr * Math.min(1, dt * 10);
  }

  arrive() {
    const g = this.goal;
    this.targetRot = g.rot ?? this.targetRot;
    if (g.sit) this.sit(); else this.stand('standing');
    const cb = this.onArrive; this.onArrive = null;
    cb?.();
  }
}
