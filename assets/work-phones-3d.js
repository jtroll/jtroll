/* Work carousel: real 3D phones.
   Each phone project gets a small WebGL scene over its phone-free plate: a
   modeled handset (rounded aluminum frame, black glass front, side buttons)
   with the project's flattened UI as its screen. The phone hangs on an
   orbit whose pivot sits behind it, so as the carousel moves it swings
   around that point, turning to one side, then through face-on, then to
   the other. The carousel drives it with setAt(position), where position
   is the (possibly fractional, mid-drag) index of the open card. */
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

// Handset, in millimeters (iPhone 15 Pro-ish proportions).
var PHONE = { w: 71.5, h: 147.5, d: 8.2, r: 11.5, bevel: 1.5 };
var SCREEN = { w: 62.4, r: 8.6 };
SCREEN.h = SCREEN.w * 19.5 / 9;

// Motion. Per unit of pose (one card away from open):
var ORBIT = {
  radius: 70,    // pivot distance behind the phone (mm)
  yaw: 22,       // degrees turned around the pivot
  pitch: -4,     // the handset leans back a touch (top away), in place
  restYaw: -8    // the open card still shows a sliver of its left edge
};
var FOV = 20;
var DROP = 10; // mm lower than the original shot, so tilted bottoms stay off-frame
var SPRING = { k: 70, c: 16 }; // stiffness / damping: settles in ~0.7s, barely overshoots

function roundedRect(w, h, r) {
  var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ShapeGeometry UVs are in shape units; remap them to 0..1 over the rect.
function planeUVs(geo, w, h) {
  var pos = geo.attributes.position, uv = geo.attributes.uv;
  for (var i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return geo;
}

function shadowTexture() {
  var c = document.createElement('canvas'); c.width = 256; c.height = 512;
  var g = c.getContext('2d');
  g.filter = 'blur(28px)';
  g.fillStyle = '#000';
  g.beginPath();
  if (g.roundRect) g.roundRect(56, 56, 144, 400, 34); else g.rect(56, 56, 144, 400);
  g.fill();
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPhone(screenTex) {
  var P = PHONE, b = P.bevel;
  var group = new THREE.Group();

  var bodyGeo = new THREE.ExtrudeGeometry(roundedRect(P.w - 2 * b, P.h - 2 * b, P.r - b), {
    depth: P.d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b,
    bevelSegments: 6, curveSegments: 40
  });
  bodyGeo.translate(0, 0, -(P.d - 2 * b) / 2);
  var glass = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
  var frame = new THREE.MeshPhysicalMaterial({ color: 0x3a3b40, roughness: 0.3, metalness: 0.9, clearcoat: 0.3 });
  group.add(new THREE.Mesh(bodyGeo, [glass, frame])); // ExtrudeGeometry groups: 0 = caps, 1 = sides

  var btnGeo = function(len) { return new THREE.BoxGeometry(1.0, len, 3.0); };
  [[-1, 0.305, 6.5], [-1, 0.2, 11], [-1, 0.105, 11], [1, 0.16, 17]].forEach(function(s) {
    var m = new THREE.Mesh(btnGeo(s[2]), frame);
    m.position.set(s[0] * (P.w / 2 + 0.25), P.h * (s[1]), 0);
    group.add(m);
  });

  var front = P.d / 2;
  var scrGeo = planeUVs(new THREE.ShapeGeometry(roundedRect(SCREEN.w, SCREEN.h, SCREEN.r), 24), SCREEN.w, SCREEN.h);
  var screen = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = front + 0.02;
  group.add(screen);

  // Cover glass: reflection only (black dielectric, added on top), so the
  // environment glints across the screen as it turns.
  var sheen = new THREE.Mesh(scrGeo, new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sheen.position.z = front + 0.06;
  group.add(sheen);

  return group;
}

function Phone(cfg) {
  this.cfg = cfg;
  this.pose = cfg.pose; this.vel = 0; this.target = cfg.pose;
  this.dirty = true; this.ready = false; this.visible = true;

  var canvas = cfg.canvas;
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  this.renderer = renderer;

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  var key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-60, 120, 160);
  scene.add(key);
  this.scene = scene;

  this.camera = new THREE.PerspectiveCamera(FOV, 1.5, 10, 5000);

  // Rig: root (rest placement + in-plane roll from the original shot)
  //        -> orbit (pivot, ORBIT.radius behind the phone; yaw/pitch here)
  //          -> phone (pushed back out to the front of the pivot)
  this.root = new THREE.Group();
  this.orbit = new THREE.Group();
  this.orbit.position.z = -ORBIT.radius;
  this.root.add(this.orbit);
  scene.add(this.root);

  this.shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(PHONE.w * 1.55, PHONE.h * 1.3),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.13, depthWrite: false, toneMapped: false })
  );
  scene.add(this.shadow);

  var self = this;
  var tex = new THREE.TextureLoader().load(cfg.screen, function() {
    self.ready = true; self.dirty = true; kick();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  this.phone = buildPhone(tex);
  this.phone.position.z = ORBIT.radius;
  this.phone.rotation.x = THREE.MathUtils.degToRad(ORBIT.pitch);
  this.orbit.add(this.phone);

  this.resize();
}

Phone.prototype.resize = function() {
  var c = this.cfg.canvas, w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  this.renderer.setSize(w, h, false);
  this.camera.aspect = w / h;

  // Frame the scene so the phone at rest lands where it was in the original
  // shot: screen width, horizontal center and top edge, as % of the frame.
  var s = this.cfg.place; // [centerX%, top%, width%, roll°]
  var frameW = SCREEN.w / (s[2] / 100);
  var frameH = frameW / this.camera.aspect;
  var dist = (frameH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  this.camera.position.set(0, 0, dist);
  this.camera.updateProjectionMatrix();
  var roll = THREE.MathUtils.degToRad(s[3]);
  var cx = (s[0] / 100 - 0.5) * frameW;
  var topY = (0.5 - s[1] / 100) * frameH;
  // Screen top-center sits SCREEN.h/2 above the phone's center; undo the roll.
  this.root.rotation.z = roll;
  // The rest yaw swings the phone sideways around the pivot; cancel that so
  // the open card's phone stays where the original put it.
  var restShift = ORBIT.radius * Math.sin(THREE.MathUtils.degToRad(ORBIT.restYaw));
  this.root.position.set(cx + Math.sin(roll) * SCREEN.h / 2 - restShift * Math.cos(roll),
                         topY - Math.cos(roll) * SCREEN.h / 2 - restShift * Math.sin(roll) - DROP, 0);
  this.dirty = true;
};

Phone.prototype.apply = function() {
  var d2r = THREE.MathUtils.degToRad, p = this.pose;
  this.orbit.rotation.y = d2r(ORBIT.restYaw - p * ORBIT.yaw);
  // Soft shadow on the "wall" behind, trailing the phone's swing.
  this.phone.updateWorldMatrix(true, false);
  var wp = new THREE.Vector3().setFromMatrixPosition(this.phone.matrixWorld);
  this.shadow.position.set(wp.x * 0.85 + 7, wp.y - 9, -ORBIT.radius * 0.9);
  this.shadow.rotation.z = this.root.rotation.z;
};

Phone.prototype.step = function(dt) {
  var x = this.pose - this.target;
  if (Math.abs(x) < 1e-4 && Math.abs(this.vel) < 1e-4) {
    if (this.pose !== this.target) { this.pose = this.target; this.vel = 0; this.dirty = true; }
    return;
  }
  var a = -SPRING.k * x - SPRING.c * this.vel;
  this.vel += a * dt;
  this.pose += this.vel * dt;
  this.dirty = true;
};

Phone.prototype.render = function() {
  if (!this.ready || !this.dirty) return;
  this.apply();
  this.renderer.render(this.scene, this.camera);
  this.dirty = false;
  if (!this.shown) { this.shown = true; this.cfg.onReady(); }
};

var phones = [], raf = null, last = 0;
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function frame(t) {
  raf = null;
  var dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
  last = t;
  var busy = false;
  for (var i = 0; i < phones.length; i++) {
    var ph = phones[i];
    ph.step(dt);
    if (ph.visible) ph.render();
    if (ph.dirty || ph.pose !== ph.target) busy = true;
  }
  if (busy) raf = requestAnimationFrame(frame); else last = 0;
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }

/* entries: [{ index, canvas, screen, place, onReady }]
   Returns null when WebGL isn't available (the cut-out images stay). */
export function init(entries, at) {
  try {
    entries.forEach(function(e) {
      e.pose = reduceMotion.matches ? 0 : Math.max(-1, Math.min(1, e.index - at));
      phones.push(new Phone(e));
    });
  } catch (err) {
    return null;
  }

  var ro = new ResizeObserver(function(list) {
    list.forEach(function(r) {
      phones.forEach(function(p) { if (p.cfg.canvas === r.target) p.resize(); });
    });
    kick();
  });
  var io = new IntersectionObserver(function(list) {
    list.forEach(function(r) {
      phones.forEach(function(p) { if (p.cfg.canvas === r.target) { p.visible = r.isIntersecting; p.dirty = true; } });
    });
    kick();
  });
  phones.forEach(function(p) { ro.observe(p.cfg.canvas); io.observe(p.cfg.canvas); });
  kick();

  return {
    setAt: function(at) {
      phones.forEach(function(p) {
        p.target = reduceMotion.matches ? 0 : Math.max(-1, Math.min(1, p.cfg.index - at));
      });
      kick();
    }
  };
}
