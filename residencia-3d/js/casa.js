/* Residência Modelo 3D — protótipo FARLO (v2, alto padrão).
   three.js r128 (build global). v3: texturas PBR reais (Poly Haven, CC0), HDRI de céu, árvores e arbustos
   escaneados (glTF). Precisa de servidor local (http). Sem servidor (file://) cai nas texturas procedurais. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var canvas = $('#c'), stage = $('#stage');
  var params = new URLSearchParams(location.search);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fail() { $('#loading').classList.add('is-done'); $('#nowebgl').hidden = false; }
  if (!window.THREE) return fail();
  var T = window.THREE, renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return fail(); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  var maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, 1, 0.5, 400);

  /* ---------- acabamentos ---------- */
  var FIN = {
    wall: [
      { id: 'gelo', label: 'Branco gelo', color: '#efeeea' },
      { id: 'concreto', label: 'Cinza concreto', color: '#b9b9b5' },
      { id: 'areia', label: 'Areia', color: '#dccfb4' }
    ],
    wood: [
      { id: 'freijo', label: 'Freijó', color: '#b88a58' },
      { id: 'termo', label: 'Cinza termo', color: '#7d7569' },
      { id: 'ebano', label: 'Ébano', color: '#3d2f27' }
    ],
    stone: [
      { id: 'saotome', label: 'São Tomé', color: '#c9b48e' },
      { id: 'ardosia', label: 'Ardósia', color: '#6f7377' },
      { id: 'branca', label: 'Branca', color: '#d9d6ce' }
    ],
    floor: [
      { id: 'porcelanato', label: 'Porcelanato', color: '#dcdbd7' },
      { id: 'madeira', label: 'Madeira', color: '#c8a273' },
      { id: 'concreto', label: 'Concreto polido', color: '#9b9b99' }
    ]
  };
  var GROUPS = ['wall', 'wood', 'stone', 'floor'];
  var sel = { wall: 'gelo', wood: 'freijo', stone: 'saotome', floor: 'porcelanato' };
  GROUPS.forEach(function (k) { var v = params.get(k); if (v && FIN[k].some(function (o) { return o.id === v; })) sel[k] = v; });
  function pick(k) { return FIN[k].filter(function (o) { return o.id === sel[k]; })[0]; }

  /* ---------- utilidades ---------- */
  function C(h) { return new T.Color(h).convertSRGBToLinear(); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  function mk(n) { var c = document.createElement('canvas'); c.width = c.height = n; return c; }
  function shade(hex, f) {
    var c = parseInt(hex.slice(1), 16), r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255;
    function k(v) { return Math.max(0, Math.min(255, Math.round(v * f))); }
    return 'rgb(' + k(r) + ',' + k(g) + ',' + k(b) + ')';
  }
  function grain(ctx, n, amt, r) {
    var id = ctx.getImageData(0, 0, n, n), d = id.data;
    for (var i = 0; i < d.length; i += 4) { var v = (r() - 0.5) * amt; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    ctx.putImageData(id, 0, 0);
  }
  function blotch(ctx, n, count, rmin, rmax, r, a) {
    for (var i = 0; i < count; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')';
      var bx = r() * n, by = r() * n, br = rmin + r() * (rmax - rmin);
      for (var ox = -n; ox <= n; ox += n) for (var oy = -n; oy <= n; oy += n) { ctx.beginPath(); ctx.arc(bx + ox, by + oy, br, 0, 6.283); ctx.fill(); }
    }
  }
  function toTex(c) {
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = maxAniso; return t;
  }

  /* ---------- texturas procedurais ---------- */
  var TEX = {
    concrete: function () {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(11);
      x.fillStyle = '#b4b3ae'; x.fillRect(0, 0, n, n); blotch(x, n, 140, 20, 90, r, 0.035);
      x.strokeStyle = 'rgba(40,40,40,.22)'; x.lineWidth = 2;
      [0, 256].forEach(function (o) { x.beginPath(); x.moveTo(0, o); x.lineTo(n, o); x.moveTo(o, 0); x.lineTo(o, n); x.stroke(); });
      x.fillStyle = 'rgba(30,30,30,.4)';
      [0, 256].forEach(function (ox) { [0, 256].forEach(function (oy) { [64, 192].forEach(function (a) { [64, 192].forEach(function (b) { x.beginPath(); x.arc(ox + a, oy + b, 3, 0, 6.283); x.fill(); }); }); }); });
      grain(x, n, 16, r); return toTex(c);
    },
    plaster: function () {
      var n = 256, c = mk(n), x = c.getContext('2d'), r = rng(5);
      x.fillStyle = '#ecebe7'; x.fillRect(0, 0, n, n); blotch(x, n, 70, 10, 60, r, 0.02); grain(x, n, 10, r); return toTex(c);
    },
    wood: function (tone) {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(23), sw = 64;
      for (var s = 0; s < 8; s++) {
        var sx = s * sw; x.fillStyle = shade(tone, 0.86 + r() * 0.26); x.fillRect(sx, 0, sw, n);
        for (var l = 0; l < 26; l++) {
          var gx = sx + 3 + r() * (sw - 6), a = 0.06 + r() * 0.16, bend = (r() - 0.5) * 10;
          x.strokeStyle = r() > 0.4 ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,255,255,' + a * 0.6 + ')'; x.lineWidth = 0.6 + r() * 1.2;
          x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + bend, n * 0.33, gx - bend, n * 0.66, gx, n); x.stroke();
        }
        if (r() > 0.55) { var ky = r() * n; x.fillStyle = 'rgba(40,20,5,.35)'; x.beginPath(); x.ellipse(sx + sw / 2 + (r() - 0.5) * 20, ky, 6, 11, 0, 0, 6.283); x.fill(); }
        x.fillStyle = '#17120e'; x.fillRect(sx, 0, 3, n); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(sx + 3, 0, 2, n);
      }
      grain(x, n, 8, r); return toTex(c);
    },
    deck: function () {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(31), ph = 64;
      for (var p = 0; p < 8; p++) {
        var py = p * ph; x.fillStyle = shade('#86694b', 0.85 + r() * 0.3); x.fillRect(0, py, n, ph);
        for (var l = 0; l < 22; l++) { var gy = py + 3 + r() * (ph - 6); x.strokeStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.14) + ')'; x.lineWidth = 0.6 + r(); x.beginPath(); x.moveTo(0, gy); x.bezierCurveTo(n * 0.3, gy + (r() - 0.5) * 6, n * 0.7, gy - (r() - 0.5) * 6, n, gy); x.stroke(); }
        x.fillStyle = '#1b1510'; x.fillRect(0, py, n, 3); x.fillRect(r() * n, py, 2, ph);
      }
      grain(x, n, 8, r); return toTex(c);
    },
    floorWood: function () {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(41), ph = 85;
      for (var p = 0; p < 6; p++) {
        var py = p * ph; x.fillStyle = shade('#c8a273', 0.9 + r() * 0.2); x.fillRect(0, py, n, ph + 1);
        for (var l = 0; l < 16; l++) { var gy = py + 3 + r() * (ph - 6); x.strokeStyle = 'rgba(80,50,20,' + (0.05 + r() * 0.12) + ')'; x.lineWidth = 0.6 + r(); x.beginPath(); x.moveTo(0, gy); x.bezierCurveTo(n * 0.3, gy + (r() - 0.5) * 8, n * 0.7, gy - (r() - 0.5) * 8, n, gy); x.stroke(); }
        x.fillStyle = 'rgba(50,30,10,.45)'; x.fillRect(0, py, n, 1.5); x.fillRect((p * 211) % n, py, 1.5, ph);
      }
      grain(x, n, 6, r); return toTex(c);
    },
    porcelain: function () {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(51);
      x.fillStyle = '#dcdbd7'; x.fillRect(0, 0, n, n);
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) { blotch(x, n, 0, 0, 0, r, 0); x.fillStyle = 'rgba(' + (r() > 0.5 ? '255,255,255' : '0,0,0') + ',.03)'; x.fillRect(i * 256, j * 256, 256, 256); }
      x.lineCap = 'round';
      for (var v = 0; v < 9; v++) { x.strokeStyle = 'rgba(110,110,110,' + (0.06 + r() * 0.08) + ')'; x.lineWidth = 0.8 + r() * 2.2; x.beginPath(); var px = r() * n, py = r() * n; x.moveTo(px, py); x.bezierCurveTo(px + r() * 180 - 90, py + r() * 180 - 90, px + r() * 240 - 120, py + r() * 240 - 120, px + r() * 300 - 150, py + r() * 300 - 150); x.stroke(); }
      x.fillStyle = '#a9a7a2'; x.fillRect(0, 0, n, 3); x.fillRect(0, 254, n, 4); x.fillRect(0, 0, 3, n); x.fillRect(254, 0, 4, n);
      grain(x, n, 8, r); return toTex(c);
    },
    polished: function () {
      var n = 256, c = mk(n), x = c.getContext('2d'), r = rng(61);
      x.fillStyle = '#9b9b99'; x.fillRect(0, 0, n, n); blotch(x, n, 90, 10, 60, r, 0.04); grain(x, n, 8, r); return toTex(c);
    },
    stone: function (hex) {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(71), rows = [48, 64, 56, 40, 64, 48, 56, 64, 40, 32], y = 0;
      x.fillStyle = '#2a2824'; x.fillRect(0, 0, n, n);
      function stone(sx, sy, sw, rh) {
        x.fillStyle = shade(hex, 0.78 + r() * 0.42); x.fillRect(sx + 3, sy + 3, sw - 6, rh - 6);
        for (var b = 0; b < 6; b++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; x.beginPath(); x.arc(sx + r() * sw, sy + r() * rh, 6 + r() * 16, 0, 6.283); x.fill(); }
        x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(sx + 3, sy + 3, sw - 6, 2); x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(sx + 3, sy + rh - 5, sw - 6, 2);
      }
      rows.forEach(function (rh) {
        var sx = -r() * 120;
        while (sx < n) { var sw = 90 + r() * 140; stone(sx, y, sw, rh); if (sx + sw > n) stone(sx - n, y, sw, rh); sx += sw; }
        y += rh;
      });
      grain(x, n, 12, r); return toTex(c);
    },
    grass: function () {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(81), pal = ['#5c8a3f', '#3f6a2e', '#6a9a4a', '#35581f', '#4e7d34'];
      x.fillStyle = '#4a7336'; x.fillRect(0, 0, n, n); blotch(x, n, 160, 30, 90, r, 0.05);
      for (var i = 0; i < 9000; i++) { x.strokeStyle = pal[i % pal.length]; x.globalAlpha = 0.6; x.lineWidth = 1; var gx = r() * n, gy = r() * n; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (r() - 0.5) * 3, gy - 3 - r() * 4); x.stroke(); }
      x.globalAlpha = 1; grain(x, n, 10, r); return toTex(c);
    },
    paving: function () {
      var n = 512, c = mk(n), x = c.getContext('2d'), r = rng(91);
      x.fillStyle = '#6d6b66'; x.fillRect(0, 0, n, n);
      for (var i = 0; i < 2; i++) for (var j = 0; j < 3; j++) {
        x.fillStyle = shade('#b3b0a8', 0.9 + r() * 0.16); x.fillRect(i * 256 + 3, j * 170 + 3, 250, 164);
        x.fillStyle = 'rgba(' + (r() > 0.5 ? '255,255,255' : '0,0,0') + ',.04)'; x.fillRect(i * 256 + 3, j * 170 + 3, 250, 164);
      }
      blotch(x, n, 120, 6, 30, r, 0.04); grain(x, n, 14, r); return toTex(c);
    },
    leaf: function () {
      var n = 256, c = mk(n), x = c.getContext('2d'), r = rng(101), pal = ['#4a8040', '#2f5a2c', '#5a9a4a', '#244a22', '#3e7236'];
      x.fillStyle = '#3a6a38'; x.fillRect(0, 0, n, n);
      for (var i = 0; i < 2200; i++) { x.fillStyle = pal[i % pal.length]; x.globalAlpha = 0.7; x.beginPath(); x.arc(r() * n, r() * n, 2 + r() * 4, 0, 6.283); x.fill(); }
      x.globalAlpha = 1; return toTex(c);
    },
    asphalt: function () {
      var n = 256, c = mk(n), x = c.getContext('2d'), r = rng(111);
      x.fillStyle = '#2c2e30'; x.fillRect(0, 0, n, n); blotch(x, n, 60, 8, 40, r, 0.05); grain(x, n, 28, r); return toTex(c);
    },
    poolTile: function () {
      var n = 256, c = mk(n), x = c.getContext('2d'), r = rng(121);
      x.fillStyle = '#58bcc6'; x.fillRect(0, 0, n, n); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1;
      for (var i = 0; i <= n; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, n); x.moveTo(0, i); x.lineTo(n, i); x.stroke(); }
      grain(x, n, 6, r); return toTex(c);
    }
  };
  var maps = {};

  /* ---------- ativos reais (PBR, HDRI, modelos) ---------- */
  var PBR = {}, ASSETS = { sky: null, models: {} };
  var PBR_LIST = ['concrete', 'plaster', 'wood', 'deck', 'floorWood', 'porcelain', 'polished', 'stone', 'grass', 'paving', 'asphalt', 'pool'];
  var ALPHA = { island_tree_02: 'leaves_alpha', tree_small_02: 'leaves_alpha', grass_medium_01: 'Alpha' };
  var DIFFFIX = { island_tree_02: 'leaves_diff', tree_small_02: 'leaves_diff' };
  var MODEL_LIST = ['island_tree_02', 'tree_small_02', 'shrub_02', 'shrub_03', 'shrub_04', 'fern_02', 'grass_medium_01'];
  function loadTex(url, srgb) {
    return new Promise(function (res, rej) {
      new T.TextureLoader().load(url, function (t) {
        t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = maxAniso; if (srgb) t.encoding = T.sRGBEncoding; res(t);
      }, undefined, function () { rej(new Error(url)); });
    });
  }
  function loadAssets() {
    if (location.protocol === 'file:' || params.get('procedural')) return Promise.resolve();
    var jobs = [];
    PBR_LIST.forEach(function (k) {
      jobs.push(Promise.all([loadTex('assets/tex/' + k + '_diff.jpg', true), loadTex('assets/tex/' + k + '_nor.jpg', false), loadTex('assets/tex/' + k + '_rough.jpg', false)])
        .then(function (a) { PBR[k] = { map: a[0], normal: a[1], rough: a[2] }; }).catch(function () { }));
    });
    if (T.RGBELoader) jobs.push(new Promise(function (res) {
      new T.RGBELoader().setDataType(T.HalfFloatType).load('assets/sky.hdr', function (t) { t.mapping = T.EquirectangularReflectionMapping; ASSETS.sky = t; res(); }, undefined, function () { res(); });
    }));
    if (T.GLTFLoader) MODEL_LIST.forEach(function (k) {
      jobs.push(new Promise(function (res) {
        new T.GLTFLoader().load('assets/models/' + k + '.glb', function (g) {
          ASSETS.models[k] = g.scene;
          var an = ALPHA[k]; if (!an) return res();
          var dn = DIFFFIX[k];
          Promise.all([loadTex('assets/models/' + k + '__' + an + '.jpg', false), dn ? loadTex('assets/models/' + k + '__' + dn + '.jpg', true) : Promise.resolve(null)]).then(function (r) {
            r[0].flipY = false; r[0].generateMipmaps = false; r[0].minFilter = T.LinearFilter; r[0].needsUpdate = true; if (r[1]) { r[1].flipY = false; r[1].needsUpdate = true; }
            g.scene.traverse(function (m) { if (m.isMesh && m.material && /leaves|grass/i.test(m.material.name)) { m.material.alphaMap = r[0]; if (r[1]) m.material.map = r[1]; m.material.needsUpdate = true; } });
            res();
          }, function () { res(); });
        }, undefined, function () { res(); });
      }));
    });
    return Promise.all(jobs);
  }

  /* ---------- materiais ---------- */
  var envMats = [];
  function std(o) {
    var m = new T.MeshStandardMaterial({ color: C(o.color || '#ffffff'), roughness: o.r == null ? 0.85 : o.r, metalness: o.m || 0 });
    if (o.pbr && PBR[o.pbr]) {
      var p = PBR[o.pbr]; m.map = p.map; m.normalMap = p.normal; m.roughnessMap = p.rough; m.roughness = o.r == null ? 1 : o.r;
      if (o.ns) m.normalScale.set(o.ns, o.ns); m.userData.pbr = true;
    } else if (o.map) { m.map = o.map; if (o.bump) { m.bumpMap = o.map; m.bumpScale = o.bump; } }
    m.userData.tile = o.tile || [2, 2]; envMats.push(m); return m;
  }
  var cache = {};
  function mat(hex, r, m) {
    var k = hex + '|' + (r == null ? 0.7 : r) + '|' + (m || 0);
    return cache[k] || (cache[k] = std({ color: hex, r: r == null ? 0.7 : r, m: m || 0 }));
  }

  var M = {};
  function buildMaterials() {
    var hasP = function (k) { return !!PBR[k]; };
    function pm(k, proc, o) { o.pbr = k; if (!hasP(k)) { o.map = proc(); } return std(o); }
    maps.wood = hasP('wood') ? null : TEX.wood(pick('wood').color);
    maps.stone = hasP('stone') ? null : TEX.stone(pick('stone').color);
    maps.floor = hasP(floorKey(sel.floor)) ? null : floorMap(sel.floor);
    maps.leaf = TEX.leaf();
    M.plaster = pm('plaster', TEX.plaster, { color: pick('wall').color, r: 1, tile: [2.2, 2.2], ns: 0.8 });
    M.concrete = pm('concrete', TEX.concrete, { r: 1, bump: 0.6, tile: [2.4, 2.4] });
    M.wood = pm('wood', function () { return maps.wood; }, { r: 1, bump: 0.5, tile: [1.4, 1.4] });
    M.deck = pm('deck', TEX.deck, { r: 1, bump: 0.5, tile: [1.6, 1.6] });
    M.stone = pm('stone', function () { return maps.stone; }, { r: 1, bump: 1.2, tile: [1.8, 1.8], ns: 1.4 });
    M.floor = pm(floorKey(sel.floor), function () { return maps.floor; }, { r: sel.floor === 'porcelanato' ? 0.55 : 1, tile: floorTile(sel.floor) });
    M.polished = pm('polished', TEX.polished, { r: 1, tile: [3, 3] });
    M.grass = pm('grass', TEX.grass, { r: 1, tile: [4, 4] });
    M.paving = pm('paving', TEX.paving, { r: 1, bump: 0.4, tile: [2.0, 2.0] });
    M.asphalt = pm('asphalt', TEX.asphalt, { r: 1, tile: [4, 4] });
    M.poolTile = pm('pool', TEX.poolTile, { r: 1, tile: [1.6, 1.6] });
    M.leaf = std({ map: maps.leaf, r: 0.95, tile: [1, 1] });
    if (M.deck.userData.pbr) M.deck.color.copy(C('#d9d0c4'));
    if (M.grass.userData.pbr) M.grass.color.copy(C('#8db286'));
    if (M.wood.userData.pbr) tintWood(pick('wood').color);
    if (M.stone.userData.pbr) tintStone(pick('stone').color);
    M.frame = std({ color: '#151617', r: 0.35, m: 0.7 });
    M.coping = std({ color: '#e6e3dc', r: 0.7 });
    M.glass = new T.MeshStandardMaterial({ color: C('#cfe3ea'), roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.3, emissive: new T.Color(0, 0, 0), depthWrite: false });
    M.glass.userData.tile = [1, 1]; envMats.push(M.glass);
    M.water = new T.MeshStandardMaterial({ color: C('#1fb0c0'), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.8, emissive: new T.Color(0, 0, 0) });
    M.water.userData.tile = [1, 1]; envMats.push(M.water);
    M.led = new T.MeshStandardMaterial({ color: C('#d9d3c8'), roughness: 0.5, emissive: C('#ffd9a0'), emissiveIntensity: 0 });
    M.led.userData.tile = [1, 1];
    M.door = std({ color: '#1d1a18', r: 0.45, m: 0.2 });
    M.brass = std({ color: '#c9a45c', r: 0.3, m: 0.9 });
  }
  function floorKey(id) { return id === 'porcelanato' ? 'porcelain' : id === 'madeira' ? 'floorWood' : 'polished'; }
  function tintWood(hex) { var c = C(hex), l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; M.wood.color.copy(c).lerp(new T.Color(l, l, l), 0.35).multiplyScalar(1.3); }
  function tintStone(hex) { M.stone.color.copy(C(hex)).lerp(new T.Color(1, 1, 1), 0.3); }
  function floorMap(id) { return id === 'porcelanato' ? TEX.porcelain() : id === 'madeira' ? TEX.floorWood() : TEX.polished(); }
  function floorTile(id) { return id === 'concreto' ? [3, 3] : [1.2, 1.2]; }

  /* ---------- geometria ---------- */
  function box(parent, w, h, d, x, y, z, m) {
    var geo = new T.BoxGeometry(w, h, d), mm = typeof m === 'string' ? mat(m) : m;
    if (mm.map) {
      var t = mm.userData.tile, uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (var f = 0; f < 6; f++) for (var i = 0; i < 4; i++) { var k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / t[0], uv.getY(k) * dims[f][1] / t[1]); }
    }
    var o = new T.Mesh(geo, mm); o.position.set(x, y, z);
    o.castShadow = !mm.transparent; o.receiveShadow = !mm.transparent; parent.add(o); return o;
  }
  function cyl(parent, rt, rb, h, x, y, z, m, seg) {
    var o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 12), typeof m === 'string' ? mat(m) : m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  var TH = 0.25;
  // parede ao longo do x local; plano em z = 0; c = centro da abertura no eixo local
  function wall(len, H, ops, wm) {
    var g = new T.Group(), cur = -len / 2;
    ops.slice().sort(function (a, b) { return a.c - b.c; }).forEach(function (o) {
      var l = o.c - o.w / 2, r = o.c + o.w / 2;
      if (l > cur + 0.001) box(g, l - cur, H, TH, (cur + l) / 2, H / 2, 0, wm);
      if (o.y0 > 0.001) box(g, o.w, o.y0, TH, o.c, o.y0 / 2, 0, wm);
      var top = H - (o.y0 + o.h); if (top > 0.001) box(g, o.w, top, TH, o.c, o.y0 + o.h + top / 2, 0, wm);
      var cy = o.y0 + o.h / 2;
      if (o.t === 'glass') {
        box(g, o.w, o.h, 0.03, o.c, cy, 0, M.glass);
        var fr = 0.06;
        box(g, o.w, fr, 0.12, o.c, o.y0 + fr / 2, 0, M.frame); box(g, o.w, fr, 0.12, o.c, o.y0 + o.h - fr / 2, 0, M.frame);
        box(g, fr, o.h, 0.12, l + fr / 2, cy, 0, M.frame); box(g, fr, o.h, 0.12, r - fr / 2, cy, 0, M.frame);
        for (var k = 1; k <= (o.mull || 0); k++) box(g, 0.05, o.h, 0.1, l + o.w * k / (o.mull + 1), cy, 0, M.frame);
      } else if (o.t === 'panel') {
        box(g, o.w, o.h, 0.14, o.c, cy, 0.04, o.mat);
      }
      cur = r;
    });
    if (cur < len / 2 - 0.001) box(g, len / 2 - cur, H, TH, (cur + len / 2) / 2, H / 2, 0, wm);
    return g;
  }
  // junta, por material, tudo o que está dentro do grupo (menos chamadas de desenho)
  function merge(g) {
    if (params.get('nomerge')) return g;
    g.updateMatrixWorld(true);
    var inv = new T.Matrix4().copy(g.matrixWorld).invert(), buckets = {}, kill = [];
    g.traverse(function (o) { if (o.isMesh) { var b = buckets[o.material.uuid] || (buckets[o.material.uuid] = { m: o.material, items: [] }); b.items.push(o); kill.push(o); } });
    kill.forEach(function (o) { o.parent.remove(o); });
    Object.keys(buckets).forEach(function (key) {
      var b = buckets[key], pos = [], nor = [], uv = [], cast = false, rec = false, nm = new T.Matrix3(), v = new T.Vector3();
      b.items.forEach(function (o) {
        var geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
        var mm = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(mm);
        var p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
        for (var i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(mm); pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
          if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
        }
        cast = cast || o.castShadow; rec = rec || o.receiveShadow; o.geometry.dispose();
      });
      var geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geom.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      geom.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      var mesh = new T.Mesh(geom, b.m); mesh.castShadow = cast; mesh.receiveShadow = rec; g.add(mesh);
    });
    return g;
  }

  /* ---------- a residência ---------- */
  var H1 = 3.4, H2 = 3.1, SL = 0.35, UFY = H1 + SL;     // alturas; UFY = piso do pavimento superior
  var land, base, gfShell, gfFront, gfRight, gfFurn, upper, ufLevel, ufShell, ufFront, ufRight, ufFurn, roof2, slab1;
  var site = new T.Group(); scene.add(site);

  function buildHouse() {
    base = new T.Group(); site.add(base);
    // terreno, rua, calçada
    var far = new T.Mesh(new T.CircleGeometry(176, 64), M.grass); far.rotation.x = -Math.PI / 2; far.position.y = -0.34; far.receiveShadow = true;
    (function () { var uv = far.geometry.attributes.uv; for (var q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q) * 88, uv.getY(q) * 88); })(); base.add(far);
    box(base, 80.15, 0.2, 140, -29.925, -0.22, 0, M.grass); box(base, 53.05, 0.2, 140, 43.475, -0.22, 0, M.grass);
    box(base, 7.1, 0.2, 67.45, 13.4, -0.22, 36.275, M.grass); box(base, 7.1, 0.2, 63.55, 13.4, -0.22, -35.525, M.grass);
    box(base, 140, 0.18, 6, 0, -0.2, 24, M.asphalt); box(base, 140, 0.16, 2.2, 0, -0.18, 20.1, M.paving);
    for (var i = -34; i <= 34; i += 6) box(base, 2.4, 0.01, 0.18, i, -0.095, 24, '#d8d8d2');
    // plinto e piso externo
    box(base, 14.8, 0.3, 9.8, -1, -0.15, 0, M.concrete);
    box(base, 4.6, 0.12, 15.5, -5.8, -0.18, 12.9, M.paving);                       // garagem / acesso
    for (var s = 0; s < 8; s++) box(base, 1.3, 0.07, 0.65, 0, -0.09, 5.4 + s * 1.1, M.paving);   // pedras até a porta
    // deck, piscina, borda
    box(base, 3.6, 0.16, 11.2, 8.2, -0.12, -0.4, M.deck);
    box(base, 1.6, 0.16, 11.2, 17.6, -0.12, -0.4, M.deck);
    box(base, 6.8, 0.16, 2.8, 13.4, -0.12, 3.8, M.deck);
    box(base, 6.8, 0.16, 2.4, 13.4, -0.12, -4.8, M.deck);
    box(base, 6.8, 0.05, 0.3, 13.4, -0.03, 2.55, M.coping); box(base, 6.8, 0.05, 0.3, 13.4, -0.03, -3.75, M.coping);
    box(base, 0.3, 0.05, 6.6, 9.85, -0.03, -0.6, M.coping); box(base, 0.3, 0.05, 6.6, 16.95, -0.03, -0.6, M.coping);
    box(base, 6.8, 0.1, 6, 13.4, -1.55, -0.6, M.poolTile);
    box(base, 0.1, 1.4, 6, 10.05, -0.85, -0.6, M.poolTile); box(base, 0.1, 1.4, 6, 16.75, -0.85, -0.6, M.poolTile);
    box(base, 6.8, 1.4, 0.1, 13.4, -0.85, -3.55, M.poolTile); box(base, 6.8, 1.4, 0.1, 13.4, -0.85, 2.35, M.poolTile);
    box(base, 6.8, 0.02, 6.0, 13.4, -0.2, -0.6, M.water);
    // painel ripado de privacidade
    for (var sl = 0; sl < 17; sl++) box(base, 0.14, 2.5, 0.1, 10 + sl * 0.42, 1.25, -6.1, M.wood);
    box(base, 7.2, 0.1, 0.14, 13.4, 2.55, -6.1, M.frame);
    // espreguiçadeiras e sofá externo
    [11.3, 12.4].forEach(function (lx) {
      box(base, 0.7, 0.28, 2.0, lx, 0.1, 3.9, '#e9e6df'); var bk = box(base, 0.7, 0.1, 0.8, lx, 0.5, 3.0, '#e9e6df'); bk.rotation.x = 0.7;
      box(base, 0.74, 0.06, 2.04, lx, -0.02, 3.9, '#3a3836');
    });
    box(base, 0.5, 0.35, 0.5, 11.85, 0.12, 3.9, '#3a3836');
    box(base, 2.6, 0.4, 0.9, 7.6, 0.2, -2.6, '#cfc7bb'); box(base, 2.6, 0.5, 0.2, 7.6, 0.6, -3.0, '#cfc7bb');
    box(base, 0.9, 0.35, 0.9, 7.6, 0.17, -1.4, '#2a2b2d');
    // pedras nas luminárias de piso
    for (var lp = 0; lp < 6; lp++) box(base, 0.1, 0.1, 0.1, 10.6 + lp * 1.1, 0.0, 3.2, M.led);
    // faixas de LED sob as lajes
    box(base, 14.6, 0.05, 0.08, -1, H1 - 0.04, 4.78, M.led); box(base, 0.08, 0.05, 9.2, 6.3, H1 - 0.04, 0, M.led);
    box(base, 0.08, 0.05, 8.6, 9.3, H1 - 0.04, 0, M.led); box(base, 3.0, 0.05, 0.08, 7.9, H1 - 0.04, 4.28, M.led);
    merge(base);

    // ===== térreo =====
    gfShell = new T.Group(); site.add(gfShell);
    var gl = wall(8.75, H1, [], M.plaster); gl.position.set(-8, 0, 0); gl.rotation.y = Math.PI / 2; gfShell.add(gl);
    var gb = wall(14.25, H1, [{ c: -4, w: 4, y0: 0.9, h: 2.0, t: 'glass', mull: 2 }], M.plaster);
    gb.position.set(-1, 0, -4.5); gb.rotation.y = Math.PI; gfShell.add(gb);
    var gp = wall(8.75, H1, [{ c: -2.0, w: 0.9, y0: 0, h: 2.2 }], M.plaster); gp.position.set(-3.2, 0, 0); gp.rotation.y = Math.PI / 2; gfShell.add(gp);
    var fl = box(gfShell, 9.075, 0.03, 8.75, 1.4625, 0.015, 0, M.floor);
    box(gfShell, 4.55, 0.03, 8.75, -5.6, 0.015, 0, M.polished);
    // escada
    for (var st_ = 0; st_ < 14; st_++) box(gfShell, 0.26, 0.25 * (st_ + 1), 0.95, -2.9 + 0.26 * st_ + 0.13, 0.125 * (st_ + 1), -3.325, '#cfc7bb');
    box(gfShell, 3.7, 0.04, 0.04, -1.1, 1.85, -2.82, M.frame);
    // carro na garagem
    var car = new T.Group(); car.position.set(-5.6, 0, 0.3); gfShell.add(car);
    box(car, 1.85, 0.62, 4.4, 0, 0.62, 0, mat('#1d2024', 0.25, 0.7)); box(car, 1.6, 0.5, 2.3, 0, 1.18, -0.2, mat('#101214', 0.1, 0.6));
    [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]].forEach(function (w) { var c = cyl(car, 0.36, 0.36, 0.28, w[0], 0.36, w[1], '#0c0c0d', 14); c.rotation.z = Math.PI / 2; });
    merge(gfShell);

    gfFront = wall(14.25, H1, [
      { c: -4.7, w: 3.8, y0: 0, h: 2.7, t: 'panel', mat: M.wood },
      { c: 1.0, w: 1.4, y0: 0, h: 2.7, t: 'panel', mat: M.door },
      { c: 4.6, w: 4.6, y0: 0, h: 3.1, t: 'glass', mull: 3 }
    ], M.plaster);
    gfFront.position.set(-1, 0, 4.5);
    box(gfFront, 2.6, H1, 0.08, -1.3, H1 / 2, 0.165, M.stone);                      // pedra do hall
    box(gfFront, 0.04, 1.2, 0.04, 1.55, 1.2, 0.2, M.brass);                          // puxador
    merge(gfFront); site.add(gfFront);

    gfRight = wall(8.75, H1, [{ c: 0, w: 7.6, y0: 0, h: 3.1, t: 'glass', mull: 3 }], M.plaster);
    gfRight.position.set(6, 0, 0); gfRight.rotation.y = Math.PI / 2; merge(gfRight); site.add(gfRight);

    // mobiliário do térreo
    gfFurn = new T.Group(); site.add(gfFurn);
    box(gfFurn, 3.4, 2.5, 0.1, 4.3, 1.25, -4.3, mat('#2a2b2d', 0.8)); box(gfFurn, 3.0, 0.45, 0.45, 4.3, 0.28, -4.05, '#6b5239');
    box(gfFurn, 1.7, 0.95, 0.05, 4.3, 1.35, -4.2, mat('#0a0a0b', 0.2, 0.3));
    var sofa = new T.Group(); sofa.position.set(4.0, 0, -1.4); sofa.rotation.y = Math.PI; gfFurn.add(sofa);
    box(sofa, 3.2, 0.42, 1.0, 0, 0.27, 0, '#d2cbc0'); box(sofa, 3.2, 0.6, 0.25, 0, 0.72, -0.42, '#c8c0b4'); box(sofa, 1.0, 0.42, 1.8, -1.1, 0.27, 1.4, '#d2cbc0');
    box(sofa, 0.5, 0.3, 0.12, -0.8, 0.62, 0.0, '#8b7d6a'); box(sofa, 0.5, 0.3, 0.12, 0.9, 0.62, 0.0, '#3d3a37');
    cyl(gfFurn, 0.55, 0.55, 0.34, 4.0, 0.2, -2.9, '#2a2b2d', 24); cyl(gfFurn, 0.5, 0.5, 0.04, 4.0, 0.39, -2.9, '#e8e4dc', 24);
    box(gfFurn, 3.8, 0.02, 3.2, 4.0, 0.04, -2.4, mat('#d9d3c7', 1));
    // cozinha
    box(gfFurn, 0.65, 0.9, 4.2, -2.75, 0.45, 1.0, '#d8d4cc'); box(gfFurn, 0.68, 0.05, 4.2, -2.75, 0.92, 1.0, mat('#2a2b2d', 0.3));
    box(gfFurn, 0.7, 2.2, 0.8, -2.7, 1.1, 3.7, '#bfc3c6');
    box(gfFurn, 1.0, 0.92, 2.6, -1.2, 0.46, 0.6, '#d8d4cc'); box(gfFurn, 1.06, 0.05, 2.7, -1.2, 0.95, 0.6, mat('#e9e6df', 0.25));
    [-0.1, 0.9, 1.9].forEach(function (z) { box(gfFurn, 0.4, 0.45, 0.4, -0.45, 0.22, z - 0.4, '#6b5239'); cyl(gfFurn, 0.36, 0.36, 0.05, -0.45, 0.47, z - 0.4, '#6b5239', 16); });
    // jantar
    box(gfFurn, 2.6, 0.06, 1.0, 3.6, 0.76, 3.1, '#5a4430');
    box(gfFurn, 0.08, 0.74, 0.8, 2.5, 0.37, 3.1, '#1a1a1a'); box(gfFurn, 0.08, 0.74, 0.8, 4.7, 0.37, 3.1, '#1a1a1a');
    [2.9, 3.6, 4.3].forEach(function (x) { box(gfFurn, 0.45, 0.45, 0.45, x, 0.23, 2.35, '#2a2b2d'); box(gfFurn, 0.45, 0.45, 0.45, x, 0.23, 3.85, '#2a2b2d'); });
    box(gfFurn, 2.0, 0.04, 0.04, 3.6, 2.4, 3.1, M.led);
    merge(gfFurn);

    // ===== pavimento superior =====
    upper = new T.Group(); site.add(upper);
    slab1 = new T.Group(); upper.add(slab1);
    box(slab1, 5.4, SL, 9.8, -5.7, H1 + SL / 2, 0, M.concrete);
    box(slab1, 3.9, SL, 7.9, -1.05, H1 + SL / 2, 0.95, M.concrete);
    box(slab1, 3.9, SL, 0.6, -1.05, H1 + SL / 2, -4.6, M.concrete);
    box(slab1, 5.5, SL, 9.8, 3.65, H1 + SL / 2, 0, M.concrete);
    box(slab1, 3.0, SL, 8.8, 7.9, H1 + SL / 2, 0, M.concrete);                       // balanço
    merge(slab1);

    ufLevel = new T.Group(); ufLevel.position.y = UFY; upper.add(ufLevel);
    ufShell = new T.Group(); ufLevel.add(ufShell);
    var ul = wall(7.75, H2, [{ c: 0, w: 2.5, y0: 0.9, h: 1.8, t: 'glass', mull: 1 }], M.plaster); ul.position.set(-3, 0, 0); ul.rotation.y = Math.PI / 2; ufShell.add(ul);
    var ub = wall(12.25, H2, [{ c: -3, w: 3, y0: 1.0, h: 1.6, t: 'glass', mull: 1 }, { c: 2.5, w: 2.0, y0: 1.0, h: 1.6, t: 'glass', mull: 1 }], M.plaster);
    ub.position.set(3, 0, -4); ub.rotation.y = Math.PI; ufShell.add(ub);
    var up_ = wall(7.75, H2, [{ c: -2.8, w: 0.9, y0: 0, h: 2.2 }], M.plaster); up_.position.set(2.5, 0, 0); up_.rotation.y = Math.PI / 2; ufShell.add(up_);
    box(ufShell, 11.75, 0.03, 7.75, 3, 0.015, 0, M.floor);
    merge(ufShell);

    ufFront = wall(12.25, H2, [{ c: 0.4, w: 5.2, y0: 0.3, h: 2.6, t: 'glass', mull: 3 }], M.plaster);
    ufFront.position.set(3, 0, 4); ufLevel.add(ufFront);
    box(ufFront, 3.4, H2, 0.1, -4.3, H2 / 2, 0.17, M.wood);
    for (var rs = 0; rs < 11; rs++) box(ufFront, 0.1, H2 - 0.2, 0.12, 3.7 + rs * 0.25, H2 / 2, 0.2, M.wood);   // brise ripado
    merge(ufFront);

    ufRight = wall(7.75, H2, [{ c: 0, w: 5.6, y0: 0.3, h: 2.6, t: 'glass', mull: 3 }], M.plaster);
    ufRight.position.set(9, 0, 0); ufRight.rotation.y = Math.PI / 2; ufLevel.add(ufRight); merge(ufRight);

    ufFurn = new T.Group(); ufLevel.add(ufFurn);
    box(ufFurn, 2.1, 0.35, 2.2, 6, 0.2, -2.6, '#2c2a28'); box(ufFurn, 1.95, 0.25, 2.1, 6, 0.5, -2.6, '#efede8');
    box(ufFurn, 0.6, 0.14, 0.4, 5.4, 0.7, -3.5, '#ffffff'); box(ufFurn, 0.6, 0.14, 0.4, 6.6, 0.7, -3.5, '#ffffff');
    box(ufFurn, 1.95, 0.07, 0.9, 6, 0.65, -1.9, '#8b7d6a'); box(ufFurn, 2.7, 1.2, 0.08, 6, 0.8, -3.9, '#6b5239');
    box(ufFurn, 0.5, 0.45, 0.45, 4.5, 0.25, -3.4, '#6b5239'); box(ufFurn, 0.5, 0.45, 0.45, 7.5, 0.25, -3.4, '#6b5239');
    box(ufFurn, 3.4, 0.02, 3.2, 6, 0.04, -2.3, mat('#c9c2b5', 1));
    box(ufFurn, 0.6, 2.4, 5.2, 2.93, 1.2, -1.2, '#cfc8bb');
    box(ufFurn, 0.9, 0.6, 1.8, 8.0, 0.3, 2.0, '#f2f1ee');                            // banheira
    box(ufFurn, 0.8, 0.8, 0.8, 4.4, 0.4, 2.9, '#3d3a37'); box(ufFurn, 0.12, 0.6, 0.8, 4.0, 0.9, 2.9, '#3d3a37');
    var bed2 = new T.Group(); bed2.position.set(-1.6, 0, 1.2); bed2.rotation.y = Math.PI / 2; ufFurn.add(bed2);
    box(bed2, 1.8, 0.35, 2.1, 0, 0.2, 0, '#2c2a28'); box(bed2, 1.7, 0.25, 2.0, 0, 0.5, 0, '#e4e0d8'); box(bed2, 2.4, 1.1, 0.08, 0, 0.75, -1.1, '#6b5239');
    box(ufFurn, 1.5, 0.05, 0.65, 1.6, 0.75, 3.55, '#5a4430'); box(ufFurn, 0.08, 0.75, 0.6, 0.9, 0.37, 3.55, '#1a1a1a'); box(ufFurn, 0.08, 0.75, 0.6, 2.3, 0.37, 3.55, '#1a1a1a');
    box(ufFurn, 1.6, 2.2, 0.55, 1.7, 1.1, -3.65, '#cfc8bb');
    merge(ufFurn);

    roof2 = new T.Group(); ufLevel.add(roof2);
    box(roof2, 12.8, SL, 8.8, 3, H2 + SL / 2, 0, M.concrete);
    box(roof2, 12.6, 0.05, 0.08, 3, H2 - 0.04, 4.3, M.led);
    merge(roof2);

    // ===== paisagismo =====
    land = new T.Group(); site.add(land);
    function place(key, x, z, h, rot, parent) {
      var src = ASSETS.models[key]; if (!src) return null;
      var o = src.clone(true), bb = new T.Box3().setFromObject(o), sz = bb.getSize(new T.Vector3()), k = h / sz.y;
      o.scale.setScalar(k); o.rotation.y = rot || 0; o.position.set(x, -bb.min.y * k - 0.02, z);
      o.traverse(function (m) {
        if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
        var mt = m.material; if (mt) { mt.envMapIntensity = 0.8; if (mt.map) mt.map.anisotropy = maxAniso; if (mt.alphaMap || mt.alphaTest > 0 || mt.transparent) { mt.side = T.DoubleSide; mt.transparent = false; mt.depthWrite = true; mt.alphaTest = mt.alphaMap ? 0.4 : Math.max(mt.alphaTest, 0.5); } envMats.push(mt); if (params.get('noalpha') && mt.alphaMap) { mt.alphaMap = null; mt.alphaTest = 0; mt.needsUpdate = true; } }
      });
      (parent || land).add(o); return o;
    }
    var hasModels = ASSETS.models.island_tree_02 && ASSETS.models.tree_small_02;
    if (hasModels) {
      var TR = [[-14, -5, 'island_tree_02', 8.5], [-12, 9, 'tree_small_02', 6.5], [-17, 2, 'island_tree_02', 10], [3, -11, 'tree_small_02', 8],
        [21, -3, 'island_tree_02', 8], [29, 10, 'tree_small_02', 6.5], [31, 15, 'tree_small_02', 5.5], [-25, 13, 'island_tree_02', 7], [37, 3, 'tree_small_02', 6], [-24, -12, 'tree_small_02', 7.5], [12, -15, 'island_tree_02', 7.5]];
      TR.forEach(function (t, i) { place(t[2], t[0], t[1], t[3], i * 1.7); });
    }
    var shr = ['shrub_02', 'shrub_03', 'shrub_04'];
    if (ASSETS.models.shrub_02) {
      // sebe ao longo da rua
      for (var hx = -29; hx <= 29; hx += 1.7) place(shr[Math.abs(Math.round(hx)) % 3], hx, 18.5, 1.0 + ((Math.round(hx * 7) % 5) * 0.08), hx * 3.1);
      // canteiros na entrada e arbustos junto à casa
      [[-3.6, 5.4], [3.6, 5.4], [-3.4, 8], [3.4, 8.6]].forEach(function (p, i) { place(shr[i % 3], p[0], p[1], 0.9, i * 2.1); });
      [[-1.9, 6.4], [1.9, 6.4]].forEach(function (p, i) { place('shrub_04', p[0], p[1], 2.4, i * 1.3); });
      [[-9.5, 6], [-8.5, 7.2], [10, 8], [18.5, 5.2], [19.5, 7]].forEach(function (p, i) { place(shr[(i + 1) % 3], p[0], p[1], 1.1 + (i % 2) * 0.4, i * 1.9); });
      [[-9, -5.8], [-3, -6.2], [6, -6.6], [-12.5, 1], [20.5, -6]].forEach(function (p, i) { place(shr[i % 3], p[0], p[1], 1.5, i * 2.3); });
    }
    if (ASSETS.models.fern_02) [[-7, 6.2], [-6.2, 6.6], [7.6, 6.4], [9.5, 6.6], [-8.6, -5.4], [4.4, -5.9]].forEach(function (p, i) { place('fern_02', p[0], p[1], 0.8, i * 1.1); });
    if (ASSETS.models.grass_medium_01) {
      var gr = rng(7); for (var gi = 0; gi < 70; gi++) {
        var gx = -26 + gr() * 56, gz = -16 + gr() * 33;
        if ((gx > -9.5 && gx < 7.5 && gz > -5.5 && gz < 5.8) || (gx > 8.5 && gx < 18.5 && gz > -7 && gz < 5.5) || (gz > 5.5 && gz < 18 && gx > -8.5 && gx < -3.2) || (gx > -4.4 && gx < 4.4 && gz > 5 && gz < 10) || gz > 18) continue;
        place('grass_medium_01', gx, gz, 0.5 + gr() * 0.3, gr() * 6.28);
      }
    }
    if (!hasModels) {
      function tree(x, z, s, tint) {
        cyl(land, 0.13 * s, 0.2 * s, 2.6 * s, x, 1.3 * s, z, '#5b4331', 7);
        [[0, 3.4, 0, 1.55], [0.7, 2.8, 0.3, 1.15], [-0.6, 3.0, -0.4, 1.2], [0.1, 3.9, -0.3, 1.0]].forEach(function (b) {
          var m = new T.Mesh(new T.IcosahedronGeometry(b[3] * s, 1), tint); m.position.set(x + b[0] * s, b[1] * s, z + b[2] * s);
          m.scale.y = 0.85; m.castShadow = true; m.receiveShadow = true; land.add(m);
        });
      }
      var leafA = M.leaf, leafB = std({ color: '#d8f0c8', map: maps.leaf, r: 0.95 }), leafC = std({ color: '#c8d8b0', map: maps.leaf, r: 0.95 });
      tree(-14, -5, 1.2, leafA); tree(-12, 9, 1.0, leafB); tree(-17, 2, 1.4, leafC); tree(3, -11, 1.3, leafB);
      tree(21, -3, 1.2, leafA); tree(22, 9, 1.0, leafC); tree(7, 14, 0.9, leafB); tree(-9, 15, 1.1, leafA); tree(15, 13, 1.0, leafC);
      [-1.9, 1.9].forEach(function (x) { var c = new T.Mesh(new T.CylinderGeometry(0.1, 0.62, 5.2, 8), leafA); c.position.set(x, 2.5, 6.4); c.castShadow = true; land.add(c); });
      box(land, 60, 0.9, 0.9, 0, 0.35, 18.5, M.leaf);
      [[-3.6, 5.4], [3.6, 5.4], [-3.4, 8], [3.4, 8.6]].forEach(function (p) { box(land, 1.3, 0.55, 1.3, p[0], 0.2, p[1], M.leaf); });
      merge(land);
    }
  }

  /* ---------- céu, luz, reflexos ---------- */
  var skyUni = { top: { value: new T.Color('#7ea6d6') }, hor: { value: new T.Color('#dfe9f1') }, gnd: { value: new T.Color('#6f7a68') }, hdr: { value: null }, mixHdr: { value: 0 }, night: { value: 0 }, expo: { value: 1 } };
  var SKY_VS = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  var SKY_FS = 'uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform sampler2D hdr; uniform float mixHdr; uniform float night; uniform float expo; varying vec3 vP;' +
    'void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.55)) : mix(hor, gnd, smoothstep(0.0, 0.25, -y));' +
    'if (mixHdr > 0.5) { vec3 d = normalize(vP); vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);' +
    ' vec3 h = min(texture2D(hdr, uv).rgb, vec3(40.0)) * expo; h *= vec3(0.72, 0.86, 1.2); h = mix(hor * 0.95, h, smoothstep(-0.02, 0.3, y)); c = mix(h, c, night); }' +
    ' gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}';
  function skyMat(uni) { return new T.ShaderMaterial({ uniforms: uni, side: T.BackSide, depthWrite: false, fog: false, vertexShader: SKY_VS, fragmentShader: SKY_FS }); }
  var sky = new T.Mesh(new T.SphereGeometry(180, 48, 32), skyMat(skyUni)); sky.renderOrder = -1; scene.add(sky);
  var envTex = null, SUN_DIR = new T.Vector3(0.62, 0.72, 0.31).normalize();
  function buildEnv() {
    var es = new T.Scene(), u;
    if (ASSETS.sky) {
      skyUni.hdr.value = ASSETS.sky; skyUni.mixHdr.value = 1;
      u = { top: skyUni.top, hor: skyUni.hor, gnd: skyUni.gnd, hdr: { value: ASSETS.sky }, mixHdr: { value: 1 }, night: { value: 0 }, expo: { value: 1 } };
      es.add(new T.Mesh(new T.SphereGeometry(50, 48, 32), skyMat(u)));
    } else {
      u = { top: { value: C('#6f9ad0') }, hor: { value: C('#dce8f2') }, gnd: { value: C('#5f6a58') }, hdr: { value: null }, mixHdr: { value: 0 }, night: { value: 0 }, expo: { value: 1 } };
      es.add(new T.Mesh(new T.SphereGeometry(50, 24, 16), skyMat(u)));
      var sunM = new T.Mesh(new T.SphereGeometry(5, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(1, 0.93, 0.82).multiplyScalar(14) }));
      sunM.position.set(22, 30, 16).normalize().multiplyScalar(42); es.add(sunM);
    }
    if (params.get('noenv')) return; var pm = new T.PMREMGenerator(renderer); envTex = pm.fromScene(es, 0.03).texture; pm.dispose(); scene.environment = envTex;
  }

  var hemi = new T.HemisphereLight('#ffffff', '#6f7a68', 0.3); scene.add(hemi);
  var sun = new T.DirectionalLight('#fff1dc', 2.4); sun.position.set(SUN_DIR.x * 38, SUN_DIR.y * 38, SUN_DIR.z * 38); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  var sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 90;
  sun.target.position.set(4, 0, 0); scene.add(sun); scene.add(sun.target);
  function pl(c, d, x, y, z) { var l = new T.PointLight(c, 0, d, 2); l.position.set(x, y, z); scene.add(l); return l; }
  var lights = [pl('#ffcf8a', 11, 4, 2.8, -1), pl('#ffcf8a', 9, -1, 2.8, 1), pl('#ffcf8a', 10, 6, UFY + 2.7, 0),
    pl('#ffcf8a', 9, -0.5, UFY + 2.7, 1.5), pl('#ffc680', 8, 0, 3.0, 6.3), pl('#3fe0f0', 10, 13.4, -0.5, -0.6)];
  scene.fog = new T.Fog('#dfe9f1', 70, 172);

  /* ---------- estado e câmera ---------- */
  var VIEWS = {
    fachada: { th: 0.66, ph: 1.3, r: 42, t: [3, 2.2, 0], lr: 0, lu: 0, cg: 0, cu: 0 },
    aerea:   { th: 0.9, ph: 0.72, r: 46, t: [4, 0.5, 0], lr: 0, lu: 0, cg: 0, cu: 0 },
    terreo:  { th: 0.78, ph: 0.98, r: 28, t: [-0.5, 0.8, 0], lr: 1, lu: 1, cg: 1, cu: 0 },
    superior:{ th: 0.8, ph: 1.0, r: 27, t: [2, UFY + 0.6, 0], lr: 1, lu: 0, cg: 0, cu: 1 }
  };
  var goal = { th: 0, ph: 0, r: 0, tx: 0, ty: 0, tz: 0 }, cur = {};
  var st = { view: 'fachada', lr: 0, lu: 0, cg: 0, cu: 0, g: { lr: 0, lu: 0, cg: 0, cu: 0 }, night: 0, nightGoal: 0, auto: !reduce, idle: 0, dirty: true };
  function setView(name, instant) {
    var v = VIEWS[name]; if (!v) return;
    st.view = name; st.auto = false;
    st.g.lr = v.lr; st.g.lu = v.lu; st.g.cg = v.cg; st.g.cu = v.cu;
    goal.th = v.th; goal.ph = v.ph; goal.r = v.r; goal.tx = v.t[0]; goal.ty = v.t[1]; goal.tz = v.t[2];
    if (instant || reduce) { for (var k in goal) cur[k] = goal[k]; ['lr', 'lu', 'cg', 'cu'].forEach(function (q) { st[q] = st.g[q]; }); }
    st.dirty = true;
  }
  var CL = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function clampGoal() { goal.ph = CL(goal.ph, 0.15, 1.5); goal.r = CL(goal.r, 10, 70); }

  var cTopD = new T.Color('#7ea6d6'), cTopN = new T.Color('#05070c'), cHorD = new T.Color('#dfe9f1'), cHorN = new T.Color('#1a2330'), cGndD = new T.Color('#6f7a68'), cGndN = new T.Color('#10151a');
  var tmp = new T.Color();
  var L = { sun: 2.4, hemi: 0.3 };       // luz de dia; muda se o reflexo (PMREM) não funcionar neste aparelho
  function applyFrame(dt) {
    var k = reduce ? 1 : 1 - Math.exp(-dt * 6), moving = false;
    if (st.auto) { goal.th += dt * 0.06; st.idle += dt; if (st.idle > 25) st.auto = false; }
    ['th', 'ph', 'r', 'tx', 'ty', 'tz'].forEach(function (p) { var d = goal[p] - cur[p]; if (Math.abs(d) > 0.0005) { cur[p] += d * k; moving = true; } else cur[p] = goal[p]; });
    ['lr', 'lu', 'cg', 'cu'].forEach(function (q) { var d = st.g[q] - st[q]; if (Math.abs(d) > 0.001) { st[q] += d * k; moving = true; } else st[q] = st.g[q]; });
    var dn = st.nightGoal - st.night; if (Math.abs(dn) > 0.001) { st.night += dn * k; moving = true; } else st.night = st.nightGoal;

    var sp = Math.sin(cur.ph);
    camera.position.set(cur.tx + cur.r * sp * Math.sin(cur.th), cur.ty + cur.r * Math.cos(cur.ph), cur.tz + cur.r * sp * Math.cos(cur.th));
    camera.lookAt(cur.tx, cur.ty, cur.tz);

    upper.position.y = st.lu * 18; upper.visible = st.lu < 0.99;
    roof2.position.y = st.lr * 9; roof2.visible = st.lr < 0.99;
    gfFront.scale.y = gfRight.scale.y = 1 - st.cg * 0.92;
    ufFront.scale.y = ufRight.scale.y = 1 - st.cu * 0.92;

    var n = st.night;
    sun.intensity = L.sun - n * (L.sun - 0.25); sun.color.set(n > 0.5 ? '#9fb4ff' : '#fff1dc'); hemi.intensity = L.hemi - n * (L.hemi - 0.08);
    lights.forEach(function (l) { l.intensity = n * 14; }); lights[5].intensity = n * 9;
    envMats.forEach(function (m) { m.envMapIntensity = 1 - n * 0.9; });
    M.glass.emissive.copy(C('#ffcf8a')).multiplyScalar(n * 0.6); M.water.emissive.copy(C('#12b8d0')).multiplyScalar(n * 0.7);
    M.led.emissiveIntensity = n * 3;
    skyUni.night.value = n; skyUni.expo.value = 0.6;
    skyUni.top.value.copy(cTopD).lerp(cTopN, n); skyUni.hor.value.copy(cHorD).lerp(cHorN, n); skyUni.gnd.value.copy(cGndD).lerp(cGndN, n);
    scene.fog.color.copy(skyUni.hor.value); renderer.toneMappingExposure = 1 + n * 0.35;
    return moving || st.auto;
  }

  /* ---------- tamanho e laço ---------- */
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.9 ? 50 : 36; camera.updateProjectionMatrix(); st.dirty = true;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  var visible = true, last = performance.now(), statsEl = $('#stats'), frames = 0;
  if (window.IntersectionObserver) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) st.dirty = true; }).observe(stage);
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; st.dirty = true; });
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!visible) return;
    var anim = applyFrame(dt);
    if (anim || st.dirty) {
      renderer.render(scene, camera); st.dirty = false;
      if (++frames === 1) {
        var i = renderer.info;
        statsEl.textContent = 'Cena: ' + i.render.triangles.toLocaleString('pt-BR') + ' triângulos · ' + i.render.calls + ' draw calls · ' + i.memory.textures + ' texturas';
        $('#loading').classList.add('is-done');
      }
      
    }
  }

  /* ---------- entrada ---------- */
  var ptrs = {}, lastDist = 0;
  function stopAuto() { st.auto = false; $('#hint').classList.add('is-hidden'); }
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; stopAuto(); lastDist = 0; });
  canvas.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId]; if (!p) return; var ids = Object.keys(ptrs);
    if (ids.length === 1) { goal.th -= (e.clientX - p.x) * 0.006; goal.ph -= (e.clientY - p.y) * 0.006; }
    else if (ids.length === 2) { var o = ptrs[ids[0] === String(e.pointerId) ? ids[1] : ids[0]], d = Math.hypot(e.clientX - o.x, e.clientY - o.y); if (lastDist) goal.r *= lastDist / d; lastDist = d; }
    p.x = e.clientX; p.y = e.clientY; clampGoal(); st.dirty = true;
  });
  function up(e) { delete ptrs[e.pointerId]; lastDist = 0; }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); stopAuto(); goal.r *= Math.exp(e.deltaY * 0.001); clampGoal(); st.dirty = true; }, { passive: false });
  canvas.addEventListener('keydown', function (e) {
    var h = true;
    if (e.key === 'ArrowLeft') goal.th -= 0.12; else if (e.key === 'ArrowRight') goal.th += 0.12;
    else if (e.key === 'ArrowUp') goal.ph -= 0.08; else if (e.key === 'ArrowDown') goal.ph += 0.08;
    else if (e.key === '+' || e.key === '=') goal.r *= 0.9; else if (e.key === '-') goal.r *= 1.1; else h = false;
    if (h) { e.preventDefault(); stopAuto(); clampGoal(); st.dirty = true; }
  });

  /* ---------- painel ---------- */
  function press(group, value) { [].forEach.call(document.querySelectorAll('[data-group="' + group + '"] button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === value)); }); }
  function updateCta() {
    var msg = 'Olá! Tenho interesse na Residência Modelo (fachada ' + pick('wall').label.toLowerCase() + ', madeira ' + pick('wood').label.toLowerCase() + ', pedra ' + pick('stone').label.toLowerCase() + ', piso ' + pick('floor').label.toLowerCase() + ').';
    $('#cta').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  }
  function apply(k, o) {
    sel[k] = o.id;
    if (k === 'wall') M.plaster.color.copy(C(o.color));
    else if (k === 'wood' && M.wood.userData.pbr) tintWood(o.color);
    else if (k === 'stone' && M.stone.userData.pbr) tintStone(o.color);
    else if (k === 'wood') { maps.wood.dispose(); maps.wood = TEX.wood(o.color); M.wood.map = M.wood.bumpMap = maps.wood; M.wood.needsUpdate = true; }
    else if (k === 'stone') { maps.stone.dispose(); maps.stone = TEX.stone(o.color); M.stone.map = M.stone.bumpMap = maps.stone; M.stone.needsUpdate = true; }
    else if (k === 'floor') {
      var fk = floorKey(o.id);
      if (PBR[fk]) { M.floor.map = PBR[fk].map; M.floor.normalMap = PBR[fk].normal; M.floor.roughnessMap = PBR[fk].rough; M.floor.roughness = o.id === 'porcelanato' ? 0.55 : 1; }
      else { maps.floor.dispose(); maps.floor = floorMap(o.id); M.floor.map = maps.floor; M.floor.roughness = o.id === 'porcelanato' ? 0.25 : 0.6; }
      // o UV das lajes foi escalado para o ladrilho anterior: refaz as lajes do piso
      rebuildFloors(); M.floor.needsUpdate = true;
    }
    updateCta(); st.dirty = true;
  }
  function rebuildFloors() {
    M.floor.userData.tile = floorTile(sel.floor);
    [[gfShell, 9.075, 8.75], [ufShell, 11.75, 7.75]].forEach(function (p) {
      p[0].children.slice().forEach(function (m) { if (m.material === M.floor) { p[0].remove(m); m.geometry.dispose(); } });
    });
    var a = new T.Group(); box(a, 9.075, 0.03, 8.75, 1.4625, 0.015, 0, M.floor); merge(a); a.children.forEach(function (m) { gfShell.add(m.clone()); });
    var b = new T.Group(); box(b, 11.75, 0.03, 7.75, 3, 0.015, 0, M.floor); merge(b); b.children.forEach(function (m) { ufShell.add(m.clone()); });
  }
  GROUPS.forEach(function (k) {
    var holder = document.querySelector('.chips[data-group="' + k + '"]');
    FIN[k].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-value', o.id); b.setAttribute('aria-pressed', String(o.id === sel[k]));
      var sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = o.color; b.appendChild(sw); b.appendChild(document.createTextNode(o.label));
      b.addEventListener('click', function () { press(k, o.id); apply(k, o); });
      holder.appendChild(b);
    });
  });
  document.querySelector('.seg[data-group="view"]').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; press('view', b.getAttribute('data-value')); setView(b.getAttribute('data-value')); });
  document.querySelector('.seg[data-group="time"]').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var v = b.getAttribute('data-value'); press('time', v); st.nightGoal = v === 'noite' ? 1 : 0; st.dirty = true; });

  // Alguns aparelhos/navegadores (ex.: renderização por software) devolvem o mapa de reflexos preto e a cena inteira sai escura.
  // Testa com uma esfera branca; se vier preta, descarta o reflexo e usa só luz direta.
  function probeEnv() {
    if (!scene.environment) return;
    try {
      var ps = new T.Scene(); ps.environment = scene.environment;
      var pm = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), pg = new T.SphereGeometry(1, 16, 12);
      ps.add(new T.Mesh(pg, pm));
      var pc = new T.PerspectiveCamera(40, 1, 0.1, 10); pc.position.z = 3; renderer.render(ps, pc);
      var gl = renderer.getContext(), buf = new Uint8Array(4);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      pm.dispose(); pg.dispose();
      if (buf[0] + buf[1] + buf[2] < 6) { scene.environment = null; L.sun = 1.5; L.hemi = 0.5; }
    } catch (e) { /* sem o teste, segue com o reflexo */ }
  }

  /* ---------- início ---------- */
  function start() {
    buildMaterials(); buildHouse(); buildEnv(); resize(); probeEnv();
    if (params.get('cam')) { var cm = params.get('cam').split(',').map(Number); VIEWS.fachada = { th: cm[0], ph: cm[1], r: cm[2], t: [cm[3], cm[4], cm[5]], lr: 0, lu: 0, cg: 0, cu: 0 }; }
    var v0 = params.get('view'); if (!VIEWS[v0]) v0 = 'fachada';
    setView(v0, true); press('view', v0); st.auto = v0 === 'fachada' && !reduce;
    if (params.get('night') === '1') { st.nightGoal = st.night = 1; press('time', 'noite'); }
    GROUPS.forEach(function (k) { press(k, sel[k]); });
    updateCta(); resize(); requestAnimationFrame(function (t) { last = t; loop(t); });
  }
  var started = false;
  function go() { if (started) return; started = true; start(); if (params.get('debug')) window.__dbg = { scene: scene, renderer: renderer, ASSETS: ASSETS, goal: goal, cur: cur, camera: camera, st: st, T: T }; }
  setTimeout(function () { loadAssets().then(go, go); setTimeout(go, 20000); }, 30);
})();
