/* Work carousel: real 3D phones.
   Each phone project gets a small WebGL scene over its phone-free plate: a
   real phone model (an iPhone 15 Pro Max, or a Pixel 6 Pro for the Android
   project; assets/models, see CREDITS there) with the project's original
   flat screen from Figma on its display. The phone hangs
   on an orbit whose pivot sits behind it, so as the carousel moves it swings
   around that point, turning to one side, then through face-on, then to the
   other. The carousel drives it with setAt(position), where position is the
   (possibly fractional, mid-drag) index of the open card. */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

// Handsets. `screen` names the display mesh; `width` is the body's overall
// width in millimeters (the models come in their own units, so each is
// scaled to that). Both models' displays face -Z and map a screenshot
// upright with the default texture orientation.
var MODELS = {
  iphone: { url: new URL('./models/iphone-15-pro-max.glb', import.meta.url).href, screen: 'xXDHkMplTIDAXLN', width: 77.7 },
  pixel:  { url: new URL('./models/pixel-6-pro.glb', import.meta.url).href, screen: 'Screen_Screen_0', width: 77.0 }
};

// Motion. Per unit of pose (one card away from open):
var ORBIT = {
  radius: 70,    // pivot distance behind the phone (mm)
  yaw: 30,       // degrees turned around the pivot
  pitch: -4,     // the handset leans back a touch (top away), in place
  restYaw: -8    // the open card still shows a sliver of its left edge
};
var FOV = 20;
var DROP = 10; // mm lower than the original shot, so tilted bottoms stay off-frame
var SPRING = { k: 40, c: 12 }; // stiffness / damping: settles in ~1s, just after the card lands

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

// Loads a handset once and normalizes it: turned to face the camera, scaled
// to millimeters, and centered on its display, with the display's size
// measured (template.userData.dims). window.WORK_PHONE_MODELS[id] (a URL or
// the .glb's bytes as an ArrayBuffer, or a promise of either) can stand in
// for the file, e.g. on a preview host that won't serve .glb files.
var modelPromises = {};
function loadModel(id) {
  if (!modelPromises[id]) {
    var m = MODELS[id], loader = new GLTFLoader();
    var override = window.WORK_PHONE_MODELS && window.WORK_PHONE_MODELS[id];
    modelPromises[id] = Promise.resolve(override || m.url).then(function(src) {
      return typeof src === 'string' ? loader.loadAsync(src) : loader.parseAsync(src, '');
    }).then(function(gltf) {
      var inner = gltf.scene, holder = new THREE.Group();
      inner.rotation.y = Math.PI; // displays face -Z
      holder.add(inner);
      holder.updateMatrixWorld(true);
      var body = new THREE.Box3().setFromObject(inner);
      var k = m.width / (body.max.x - body.min.x);
      inner.scale.multiplyScalar(k);
      holder.updateMatrixWorld(true);
      body = new THREE.Box3().setFromObject(inner);
      var disp = new THREE.Box3().setFromObject(inner.getObjectByName(m.screen));
      var dc = disp.getCenter(new THREE.Vector3());
      inner.position.set(-dc.x, -dc.y, -body.getCenter(new THREE.Vector3()).z);
      holder.userData.dims = {
        phone: { w: body.max.x - body.min.x, h: body.max.y - body.min.y },
        screen: { w: disp.max.x - disp.min.x, h: disp.max.y - disp.min.y }
      };
      holder.userData.screenName = m.screen;
      return holder;
    });
  }
  return modelPromises[id];
}

// A handset with this project's screen: the shared, normalized model, cloned
// (geometry and materials are shared; only the display gets its own
// material).
function buildPhone(template, screenTex) {
  var phone = template.clone(true);
  var screen = phone.getObjectByName(template.userData.screenName);
  // The display sits flush with the bezel; a small depth offset makes it win
  // any tie so the two never z-fight.
  screen.material = new THREE.MeshBasicMaterial({
    map: screenTex, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });

  // Cover glass: reflection only (black dielectric, added on top), so the
  // room glints across the screen as it turns.
  var sheen = new THREE.Mesh(screen.geometry, new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  }));
  sheen.renderOrder = 1;
  screen.add(sheen);

  return phone;
}

function Phone(cfg, template) {
  this.cfg = cfg;
  this.dims = template.userData.dims;
  this.pose = cfg.pose; this.vel = 0; this.target = cfg.pose;
  this.dirty = true; this.ready = false; this.visible = true;

  var renderer = new THREE.WebGLRenderer({ canvas: cfg.canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  this.renderer = renderer;

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  var key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(-60, 120, 160);
  scene.add(key);
  this.scene = scene;

  this.camera = new THREE.PerspectiveCamera(FOV, 1.5, 10, 5000);

  // Rig: root (rest placement + in-plane roll from the original shot)
  //        -> orbit (pivot, ORBIT.radius behind the phone; yaw here)
  //          -> phone (pushed back out to the front of the pivot, leaning back)
  this.root = new THREE.Group();
  this.orbit = new THREE.Group();
  this.orbit.position.z = -ORBIT.radius;
  this.root.add(this.orbit);
  scene.add(this.root);

  this.shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(this.dims.phone.w * 1.55, this.dims.phone.h * 1.3),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.13, depthWrite: false, toneMapped: false })
  );
  scene.add(this.shadow);

  var self = this;
  var tex = new THREE.TextureLoader().load(cfg.screen, function() {
    self.ready = true; self.dirty = true; kick();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  this.phone = buildPhone(template, tex);
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
  var SCREEN = this.dims.screen;
  var frameW = SCREEN.w / (s[2] / 100);
  var frameH = frameW / this.camera.aspect;
  var dist = (frameH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  this.camera.position.set(0, 0, dist);
  // Hug the scene's depth (phone swinging within ~±90mm of the pivot, the
  // shadow just behind it): a tight near/far keeps the depth buffer precise
  // enough on phone GPUs that the display and its bezel don't flicker.
  this.camera.near = Math.max(1, dist - ORBIT.radius - 100);
  this.camera.far = dist + ORBIT.radius + 100;
  this.camera.updateProjectionMatrix();
  var roll = THREE.MathUtils.degToRad(s[3]);
  var cx = (s[0] / 100 - 0.5) * frameW;
  var topY = (0.5 - s[1] / 100) * frameH;
  // Screen top-center sits SCREEN.h/2 above the display's center (the rig's
  // origin); undo the roll.
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

var phones = [], raf = null, last = 0, target = 0;
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function poseFor(index, at) {
  return reduceMotion.matches ? 0 : Math.max(-1, Math.min(1, index - at));
}

function frame(t) {
  raf = null;
  var dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
  last = t;
  var busy = false;
  for (var i = 0; i < phones.length; i++) {
    var ph = phones[i];
    ph.step(dt);
    if (ph.visible) ph.render();
    // Keep going while anything is still moving, or a visible phone still
    // owes a draw. (Off-screen phones stay dirty until they come back into
    // view; the IntersectionObserver kicks the loop then.)
    if (ph.pose !== ph.target || (ph.visible && ph.dirty)) busy = true;
  }
  if (busy) raf = requestAnimationFrame(frame); else last = 0;
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }

// Progress for anyone listening ('loading' | 'ready' | 'error'); the site
// itself doesn't need it, a preview page can show it.
function status(state, error) {
  document.dispatchEvent(new CustomEvent('work-phones', { detail: { state: state, error: error && String(error.message || error) } }));
}

/* entries: [{ index, canvas, screen, place, model ('iphone' | 'pixel'), onReady }]. Returns a controller
   right away; the phones appear once the model has loaded. If WebGL or the
   model isn't available, nothing happens and the cut-out images stay. */
export function init(entries, at) {
  target = at;
  status('loading');
  var ids = [];
  entries.forEach(function(e) { e.model = e.model || 'iphone'; if (ids.indexOf(e.model) < 0) ids.push(e.model); });
  Promise.all(ids.map(loadModel)).then(function(templates) {
    entries.forEach(function(e) {
      e.pose = poseFor(e.index, target);
      phones.push(new Phone(e, templates[ids.indexOf(e.model)]));
    });
    status('ready');
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
  }).catch(function(err) { status('error', err); /* keep the cut-outs */ });

  return {
    setAt: function(at) {
      target = at;
      phones.forEach(function(p) { p.target = poseFor(p.cfg.index, at); });
      kick();
    }
  };
}
