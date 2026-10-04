/* Work carousel: the non-phone cards, brought to life.
   Each card's picture is rebuilt from its original Figma layers (assets/scenes,
   see scripts/build_work_scenes.py) and animated with the Web Animations API.
   At rest every scene composites back to exactly the flat image it replaces.
     - rl (Neural interfaces): a nerve signal runs up the forearm into the
       wristband, which answers with a ripple through its rings. Loops.
     - premeta: the startup and IDEO logos slide out from under the J shield.
     - mada: the logo glides from center to its place, the carrot mic rises
       (its leaves wiggle as it lands) and the press logos pop in.
     - sofi: the hand lifts off the phone, hovers, and taps; its shadow
       follows it. Loops.
     - cruise: the car pulls in from the left as its card opens and drives
       off to the right as you leave, its wheels turning with the distance.
       Follows the carousel's (possibly mid-drag) position like the phones.
   One-shot scenes (premeta, mada) wait in their opening pose on closed cards,
   play when their card opens, and rewind when it closes. Loops finish their
   current cycle before stopping. The carousel drives everything with
   setOpen(index), setAt(position) and setVisible(onScreen). */

var BASE = new URL('./scenes/', import.meta.url).href;

// Layer boxes are [left, top, width, height] in % of the scene's stage,
// which has its source image's aspect ratio and covers the card art the way
// the flat image does.
var SCENES = {
  rl: {
    size: [1740, 1158],
    layers: [
      { id: 'plate', src: 'rl/plate.webp', box: [0, 0, 100, 100] },
      // the rings sit on the wrist with Figma's hard-light blend; the echoes
      // are copies that ripple outward
      { id: 'outerEcho', src: 'rl/ring-outer.webp', box: [30.879, -0.402, 36.207, 101.554], cls: 'sc-hl', hidden: true },
      { id: 'innerEcho', src: 'rl/ring-inner.webp', box: [36.31, 12.25, 25.345, 76.252], cls: 'sc-hl', hidden: true },
      { id: 'outer', src: 'rl/ring-outer.webp', box: [30.879, -0.402, 36.207, 101.554], cls: 'sc-hl' },
      { id: 'inner', src: 'rl/ring-inner.webp', box: [36.31, 12.25, 25.345, 76.252], cls: 'sc-hl' },
      // the spark starts on the glow already in the forearm (28.45%, 62.2%)
      { id: 'spark', box: [24.95, 56.94, 7, 10.52], cls: 'sc-spark', hidden: true }
    ],
    loop: rlLoop
  },
  premeta: {
    size: [1740, 1158],
    color: '#faf8f5',
    layers: [
      { id: 'robot', src: 'premeta/robot.webp', box: [7.931, 27.202, 30.172, 45.337] },
      { id: 'ideo', src: 'premeta/ideo.webp', box: [70.69, 39.637, 13.793, 20.725] },
      // backed with the page colour so the others can hide beneath it
      { id: 'shield', src: 'premeta/shield.webp', box: [44.828, 41.451, 10.345, 17.098] }
    ],
    arrive: premetaArrive
  },
  mada: {
    size: [1160, 772],
    color: '#f3f3fa',
    layers: [
      { id: 'forbes', src: 'mada/forbes.webp', box: [10.172, 12.953, 13.793, 5.57] },
      { id: 'motherjones', src: 'mada/motherjones.webp', box: [26.724, 12.953, 13.793, 3.756] },
      { id: 'glenn', src: 'mada/glenn.webp', box: [10.172, 22.539, 13.793, 8.42] },
      { id: 'oprah', src: 'mada/oprah.webp', box: [26.724, 20.725, 13.793, 6.865] },
      { id: 'npr', src: 'mada/npr.webp', box: [10.065, 34.974, 13.793, 7.124] },
      { id: 'usatoday', src: 'mada/usatoday.webp', box: [26.755, 31.639, 13.793, 3.756] },
      { id: 'bbc', src: 'mada/bbc.webp', box: [10.129, 46.114, 13.793, 6.088] },
      { id: 'nyt', src: 'mada/nyt.webp', box: [26.724, 39.64, 13.793, 15.026] },
      { id: 'mic', box: [8.621, 52.073, 34.483, 55.699], children: [
        // the leaves tuck under the carrot
        { id: 'leaves', src: 'mada/leaves.webp', box: [0.325, 10.233, 25.75, 30.93] },
        { id: 'carrot', src: 'mada/mic.webp', box: [0, 0, 100, 100] }
      ] },
      { id: 'logo', src: 'mada/logo.webp', box: [50, 24.093, 34.483, 51.813] }
    ],
    arrive: madaArrive,
    openDelay: 40  // starts almost as soon as the card begins to open
  },
  sofi: {
    size: [1162, 776],
    layers: [
      { id: 'plate', src: 'sofi/plate.webp', box: [0, 0, 100, 100] },
      { id: 'tap', box: [36.6, 69.2, 7.6, 6.5], cls: 'sc-tap', hidden: true },
      // the hand's own shadow, lifted out of the photo; "darken" so it
      // shades whatever it lands on and never doubles the phone's shadow
      { id: 'shadow', src: 'sofi/shadow.webp', box: [45.611, 73.582, 14.630, 26.418], cls: 'sc-darken' },
      // the hand runs on below the frame so lifting it never shows its cut
      { id: 'hand', src: 'sofi/hand.webp', box: [13.769, 17.139, 34.854, 88.015] }
    ],
    loop: sofiLoop
  },
  cruise: {
    size: [1160, 772],
    layers: [
      { id: 'plate', src: 'cruise/plate.webp', box: [0, 0, 100, 100] },
      { id: 'car', box: [15.776, 32.124, 64.828, 46.369], children: [
        { id: 'body', src: 'cruise/car.webp', box: [0, 0, 100, 100] },
        { id: 'rear', src: 'cruise/wheel-rear.webp', box: [13.564, 56.425, 13.165, 27.374] },
        { id: 'front', src: 'cruise/wheel-front.webp', box: [77.394, 56.425, 13.165, 27.374] }
      ] },
      { id: 'logo', src: 'cruise/logo.webp', box: [79.397, 69.041, 15, 22.539] }
    ],
    drive: true
  }
};

/* ---------- choreography ---------- */

function frames(el, kf, opts) {
  return el.animate(kf, Object.assign({ fill: 'both' }, opts));
}

// Neural interfaces: 3.6s cycle. The spark accelerates along the fibres into
// the band (0–29%), flares, and the rings ripple: each swells, dips and
// settles while a copy of it spreads out and fades. The outer ring follows
// the inner by a beat.
function rlLoop(L) {
  var cycle = { duration: 3600, iterations: Infinity, fill: 'none' };
  // spark travel in units of its own box: to (44.5%, 56.1%) of the stage
  var end = 'translate(229.3%, -58%)';
  return [
    frames(L.spark, [
      { offset: 0, opacity: 0, transform: 'translate(0, 0) scale(0.5)', easing: 'linear' },
      { offset: 0.06, opacity: 1, transform: 'translate(13%, -3.4%) scale(0.85)', easing: 'cubic-bezier(0.5, 0, 0.9, 0.7)' },
      { offset: 0.29, opacity: 1, transform: end + ' scale(1)', easing: 'ease-out' },
      { offset: 0.34, opacity: 0, transform: end + ' scale(1.9)' },
      { offset: 1, opacity: 0, transform: end + ' scale(1.9)' }
    ], cycle),
    frames(L.inner, pulse(0.29, 1.09, 0.975), cycle),
    frames(L.outer, pulse(0.33, 1.07, 0.98), cycle),
    frames(L.innerEcho, echo(0.29, 0.9, 1.34), cycle),
    frames(L.outerEcho, echo(0.33, 0.75, 1.24), cycle)
  ];
}
function pulse(at, up, dip) {
  return [
    { offset: 0, transform: 'scale(1)' },
    { offset: at, transform: 'scale(1)', easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    { offset: at + 0.07, transform: 'scale(' + up + ')', easing: 'ease-in-out' },
    { offset: at + 0.18, transform: 'scale(' + dip + ')', easing: 'ease-in-out' },
    { offset: at + 0.28, transform: 'scale(1)' },
    { offset: 1, transform: 'scale(1)' }
  ];
}
function echo(at, peak, grow) {
  return [
    { offset: 0, opacity: 0, transform: 'scale(1)' },
    { offset: at, opacity: 0, transform: 'scale(1)' },
    { offset: at + 0.015, opacity: peak, transform: 'scale(1.02)', easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
    { offset: at + 0.34, opacity: 0, transform: 'scale(' + grow + ')' },
    { offset: 1, opacity: 0, transform: 'scale(' + grow + ')' }
  ];
}

// Pre-Meta: both logos start shrunk behind the shield's center and slide out
// to their places with a little overshoot; the shield gives a nudge.
function premetaArrive(L) {
  var out = 'cubic-bezier(0.3, 1.32, 0.5, 1)';
  return [
    // shield center (290, 193) sits 156.5px right of the robot's center:
    // 89.4% of the robot's width; IDEO's is 160px left: 200% of its width
    frames(L.robot, [
      { offset: 0, opacity: 0, transform: 'translate(89.4%, 0) scale(0.3)' },
      { offset: 0.12, opacity: 1 },
      { offset: 1, opacity: 1, transform: 'none' }
    ], { duration: 950, delay: 120, easing: out }),
    frames(L.ideo, [
      { offset: 0, opacity: 0, transform: 'translate(-200%, 0) scale(0.3)' },
      { offset: 0.12, opacity: 1 },
      { offset: 1, opacity: 1, transform: 'none' }
    ], { duration: 950, delay: 190, easing: out }),
    frames(L.shield, [
      { offset: 0, transform: 'none' },
      { offset: 0.3, transform: 'scale(1.07)' },
      { offset: 1, transform: 'none' }
    ], { duration: 650, delay: 120, easing: 'ease-out' })
  ];
}

// MADA: the logo starts centered (its center 100px left: 50% of its width)
// and glides right; the mic rises from below with a small bounce and its
// leaves wiggle as it lands; the press logos pop in, in reading order.
function madaArrive(L) {
  var anims = [
    frames(L.logo, [
      { transform: 'translate(-50%, 0) scale(1.06)' },
      { transform: 'none' }
    ], { duration: 615, delay: 0, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }),
    frames(L.mic, [
      { transform: 'translate(0, 95%)' },
      { transform: 'none' }
    ], { duration: 540, delay: 270, easing: 'cubic-bezier(0.3, 1.38, 0.6, 1)' }),
    frames(L.leaves, [
      { offset: 0, transform: 'none' },
      { offset: 0.3, transform: 'rotate(-9deg)' },
      { offset: 0.55, transform: 'rotate(6deg)' },
      { offset: 0.78, transform: 'rotate(-3deg)' },
      { offset: 1, transform: 'none' }
    ], { duration: 570, delay: 675, easing: 'ease-in-out' })
  ];
  ['forbes', 'motherjones', 'glenn', 'oprah', 'npr', 'usatoday', 'bbc', 'nyt'].forEach(function(id, i) {
    anims.push(frames(L[id], [
      { offset: 0, opacity: 0, transform: 'scale(0.6)' },
      { offset: 0.6, opacity: 1, transform: 'scale(1.06)' },
      { offset: 1, opacity: 1, transform: 'none' }
    ], { duration: 345, delay: 480 + i * 56, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' }));
  });
  return anims;
}

// SoFi: 4.4s cycle. Resting on the screen; the hand lifts toward the camera
// (pivoting at the wrist, below the frame), hovers, then taps back down; a
// soft press ripples out from under the fingertip. As the hand rises its
// shadow slides away and lightens.
function sofiLoop(L) {
  var cycle = { duration: 4400, iterations: Infinity, fill: 'none' };
  var lift = 'translate(0.3%, -0.7%) rotate(-1.2deg) scale(1.02)';
  var hover = 'translate(0.1%, -0.55%) rotate(-0.85deg) scale(1.017)';
  return [
    frames(L.hand, [
      { offset: 0, transform: 'none' },
      { offset: 0.06, transform: 'none', easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      { offset: 0.32, transform: lift, easing: 'ease-in-out' },
      { offset: 0.54, transform: hover, easing: 'cubic-bezier(0.6, 0, 0.9, 0.6)' },
      { offset: 0.61, transform: 'translate(0, 0.2%) rotate(0.3deg) scale(0.995)', easing: 'ease-out' },
      { offset: 0.68, transform: 'none' },
      { offset: 1, transform: 'none' }
    ], cycle),
    frames(L.shadow, [
      { offset: 0, opacity: 1, transform: 'none' },
      { offset: 0.06, opacity: 1, transform: 'none', easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      { offset: 0.32, opacity: 0.82, transform: 'translate(-3.2%, 1.8%) scale(1.012)', easing: 'ease-in-out' },
      { offset: 0.54, opacity: 0.86, transform: 'translate(-2.5%, 1.4%) scale(1.009)', easing: 'cubic-bezier(0.6, 0, 0.9, 0.6)' },
      { offset: 0.61, opacity: 1, transform: 'none' },
      { offset: 1, opacity: 1, transform: 'none' }
    ], cycle),
    frames(L.tap, [
      { offset: 0, opacity: 0, transform: 'rotate(-28deg) scale(0.3)' },
      { offset: 0.605, opacity: 0, transform: 'rotate(-28deg) scale(0.3)' },
      { offset: 0.625, opacity: 0.7, transform: 'rotate(-28deg) scale(0.6)', easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
      { offset: 0.8, opacity: 0, transform: 'rotate(-28deg) scale(1.7)' },
      { offset: 1, opacity: 0, transform: 'rotate(-28deg) scale(1.7)' }
    ], cycle)
  ];
}

// Cruise: the car sits DRIVE stage-widths left of center per card to the
// right of open (and as far right per card to the left), springing between
// positions; wheels roll with the distance (tyre radius 56px of the 1160px
// image), and the body pitches a touch with acceleration, squatting as it
// pulls away and dipping its nose as it brakes.
var DRIVE = 0.3;
var CAR_W = 0.64828;      // car box width, fraction of the stage
var TYRE = 56 / 1160;     // tyre radius, fraction of the stage width
var SPRING = { k: 30, c: 11 };
var PITCH = { per: 0.08, max: 1 }; // degrees per (stage widths / s^2)

/* ---------- plumbing ---------- */

function build(parent, defs, L) {
  defs.forEach(function(d) {
    var el = document.createElement(d.src ? 'img' : 'div');
    if (d.src) {
      el.src = BASE + d.src; el.alt = ''; el.decoding = 'async'; el.draggable = false;
    }
    el.className = 'sc-layer' + (d.cls ? ' ' + d.cls : '');
    el.style.left = d.box[0] + '%'; el.style.top = d.box[1] + '%';
    el.style.width = d.box[2] + '%'; el.style.height = d.box[3] + '%';
    if (d.hidden) el.style.opacity = '0';
    if (d.children) build(el, d.children, L);
    parent.appendChild(el);
    L[d.id] = el;
  });
}

function Scene(entry) {
  var def = SCENES[entry.name];
  this.index = entry.index;
  this.def = def;
  this.art = entry.art;
  var root = document.createElement('div');
  root.className = 'card-scene';
  root.setAttribute('aria-hidden', 'true');
  root.dataset.scene = entry.name;
  var stage = document.createElement('div');
  stage.className = 'sc-stage';
  stage.style.setProperty('--ar', def.size[0] / def.size[1]);
  if (def.color) stage.style.background = def.color;
  root.appendChild(stage);
  this.L = {};
  build(stage, def.layers, this.L);
  entry.art.appendChild(root);
  this.anims = [];
  this.open = false;
  this.running = false;
  this.timer = null;
  if (def.arrive) {
    this.anims = def.arrive(this.L);
    this.anims.forEach(function(a) { a.pause(); a.currentTime = 0; });
  } else if (def.loop) {
    this.anims = def.loop(this.L);
    this.anims.forEach(function(a) { a.pause(); a.currentTime = 0; });
    this.cycle = this.anims[0].effect.getTiming().duration;
  }
  if (def.drive) { this.p = 0; this.v = 0; this.target = 0; }
  // Everything that moves gets its own compositor layer, so motion slides
  // already-rasterised images around instead of repainting (and re-decoding)
  // them each frame. Static plates stay flat.
  var moving = this.anims.map(function(a) { return a.effect.target; });
  if (def.drive) moving.push(this.L.car, this.L.rear, this.L.front);
  moving.forEach(function(el) { el.style.willChange = 'transform, opacity'; });
  var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
  var self = this;
  this.ready = Promise.all(imgs.map(function(i) { return i.decode(); })).then(function() {
    entry.art.classList.add('has-scene');
    if (def.drive) self.place();
  });
}

Scene.prototype.setOpen = function(open, visible, delay) {
  if (open === this.open) return;
  this.open = open;
  clearTimeout(this.timer);
  var self = this;
  if (open) this.timer = setTimeout(function() { self.start(visible); }, delay || 0);
  else this.stop();
};

Scene.prototype.start = function(visible) {
  if (!this.anims.length) return;
  this.running = true;
  if (this.def.loop) {
    var dur = this.cycle;
    this.anims.forEach(function(a) {
      a.effect.updateTiming({ iterations: Infinity });
      if (a.playState === 'finished' || a.playState === 'idle') a.currentTime = 0;
    });
    // all of a loop's tracks share one cycle; keep them in step
    var t = this.anims[0].currentTime || 0;
    this.anims.forEach(function(a) { a.currentTime = t % dur; });
  }
  this.anims.forEach(function(a) { a.updatePlaybackRate(1); if (visible) a.play(); else a.pause(); });
};

Scene.prototype.stop = function() {
  if (!this.running) return;
  this.running = false;
  if (this.def.arrive) {
    // rewind to the opening pose, quickly
    this.anims.forEach(function(a) { a.updatePlaybackRate(-3); a.play(); });
  } else {
    // finish the current cycle, then rest
    var dur = this.cycle;
    this.anims.forEach(function(a) {
      var t = a.currentTime || 0;
      a.effect.updateTiming({ iterations: Math.floor(t / dur) + 1 });
      if (a.playState === 'paused') a.play();
    });
  }
};

Scene.prototype.setVisible = function(visible) {
  if (!this.running) return;
  this.anims.forEach(function(a) {
    if (visible && a.playState === 'paused') a.play();
    else if (!visible && a.playState === 'running') a.pause();
  });
};

Scene.prototype.place = function() {
  var x = -this.p * DRIVE;                       // stage widths
  var turn = x / TYRE * 180 / Math.PI;
  var pitch = Math.max(-PITCH.max, Math.min(PITCH.max, -this.ax * PITCH.per || 0));
  this.L.car.style.transform = 'translate3d(' + (x / CAR_W * 100).toFixed(3) + '%, 0, 0) rotate(' + pitch.toFixed(3) + 'deg)';
  this.L.rear.style.transform = this.L.front.style.transform = 'rotate(' + turn.toFixed(2) + 'deg)';
};

var scenes = [], raf = 0, last = 0, at = 0, openIndex = 0, onScreen = true;

function frame(t) {
  raf = 0;
  var dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
  last = t;
  var busy = false;
  scenes.forEach(function(s) {
    if (!s.def.drive) return;
    s.target = s.index - at;
    var a = SPRING.k * (s.target - s.p) - SPRING.c * s.v;
    s.v += a * dt; s.p += s.v * dt;
    s.ax = -a * DRIVE;                           // car acceleration, stage widths / s^2
    if (Math.abs(s.target - s.p) < 1e-4 && Math.abs(s.v) < 1e-3) { s.p = s.target; s.v = 0; s.ax = 0; }
    else busy = true;
    s.place();
  });
  if (busy) raf = requestAnimationFrame(frame); else last = 0;
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }

export function init(entries, opts) {
  at = opts.at || 0;
  openIndex = opts.open || 0;
  scenes = entries.filter(function(e) { return SCENES[e.name]; }).map(function(e) { return new Scene(e); });
  scenes.forEach(function(s) {
    if (s.def.drive) { s.p = s.target = s.index - at; s.v = 0; s.ax = 0; }
    s.ready.then(function() { s.setOpen(s.index === openIndex, onScreen, 0); });
  });
  return {
    // index of the open card; arrivals start once the card has begun to open
    setOpen: function(i) {
      openIndex = i;
      scenes.forEach(function(s) { s.setOpen(s.index === i, onScreen, s.def.openDelay != null ? s.def.openDelay : 180); });
    },
    // the carousel's position, fractional mid-drag
    setAt: function(position) { at = position; kick(); },
    setVisible: function(v) {
      onScreen = v;
      scenes.forEach(function(s) { s.setVisible(v); });
    }
  };
}
