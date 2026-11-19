/* Residência de demonstração FARLO — visualizador (three.js r128, build global).
   A casa vem de assets/models/casa.glb (modelada no Blender). Contrato de nomes do modelo:
   nós raiz Terreno, Terreo, Superior, Cobertura, Externo; materiais FAR_*; vazios Luz_* (pontos de luz à noite)
   Texturas PBR e vegetação: Poly Haven (CC0). Precisa de http (não abre por file://). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var canvas = $('#c'), stage = $('#stage');
  var params = new URLSearchParams(location.search);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var embed = params.get('embed') === '1', poster = params.get('poster') === '1';
  if (embed) document.body.classList.add('is-embed');
  if (poster) document.body.classList.add('is-poster');
  if (embed) $('#cta').setAttribute('target', '_top');

  function fail() { $('#loading').classList.add('is-done'); $('#nowebgl').hidden = false; }
  if (!window.THREE || !THREE.GLTFLoader) return fail();
  var T = window.THREE, renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: poster });
  } catch (e) { return fail(); }
  var small = Math.min(window.innerWidth, window.screen ? window.screen.width : 9999) < 860;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;                 // a sombra só é refeita quando algo que a afeta muda
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
      { id: 'porcelanato', label: 'Porcelanato', color: '#dcdbd7', set: 'porcelain', rough: 0.55 },
      { id: 'madeira', label: 'Madeira', color: '#c8a273', set: 'floorWood', rough: 1 },
      { id: 'concreto', label: 'Concreto polido', color: '#9b9b99', set: 'polished', rough: 0.8 }
    ]
  };
  var GROUPS = ['wall', 'wood', 'stone', 'floor'];
  var sel = { wall: 'gelo', wood: 'freijo', stone: 'saotome', floor: 'porcelanato' };
  GROUPS.forEach(function (k) { var v = params.get(k); if (v && FIN[k].some(function (o) { return o.id === v; })) sel[k] = v; });
  function pick(k) { return FIN[k].filter(function (o) { return o.id === sel[k]; })[0]; }
  function C(h) { return new T.Color(h).convertSRGBToLinear(); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- carga com progresso real ---------- */
  var LOAD = {}, fill = $('#loadfill'), pct = $('#loadpct');
  function track(id, weight) { LOAD[id] = { w: weight, p: 0 }; }
  function prog(id, p) {
    if (!LOAD[id]) return; LOAD[id].p = Math.max(LOAD[id].p, Math.min(1, p));
    var a = 0, b = 0; Object.keys(LOAD).forEach(function (k) { a += LOAD[k].w * LOAD[k].p; b += LOAD[k].w; });
    var v = b ? a / b : 0; fill.style.transform = 'scaleX(' + v.toFixed(3) + ')'; pct.textContent = Math.round(v * 100) + '%';
  }
  function xhrProg(id, fallbackBytes) { return function (e) { var t = e.lengthComputable && e.total ? e.total : fallbackBytes; prog(id, t ? Math.min(0.99, e.loaded / t) : 0.5); }; }

  var SETS = ['concrete', 'plaster', 'wood', 'deck', 'floorWood', 'porcelain', 'polished', 'stone', 'grass', 'paving', 'asphalt'];
  var PBR = {}, A = { casa: null, ao: null, sky: null, veg: {}, vegInfo: null };
  function loadTex(url, srgb, id) {
    if (id) track(id, 60);
    return new Promise(function (res) {
      new T.TextureLoader().load(url, function (t) {
        t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = maxAniso; t.flipY = false; if (srgb) t.encoding = T.sRGBEncoding;
        if (id) prog(id, 1); res(t);
      }, undefined, function () { if (id) prog(id, 1); res(null); });
    });
  }
  function loadAll() {
    var jobs = [];
    track('casa', 1900);
    jobs.push(new Promise(function (res, rej) {
      new T.GLTFLoader().load('assets/models/casa.glb', function (g) { A.casa = g; prog('casa', 1); res(); }, xhrProg('casa', 1900000), function (e) { rej(e); });
    }));
    jobs.push(loadTex('assets/casa_ao.jpg', false, 'ao').then(function (t) { if (t) { t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 1; } A.ao = t; }));
    SETS.forEach(function (k) {
      jobs.push(Promise.all([loadTex('assets/tex/' + k + '_diff.jpg', true, k + 'd'), loadTex('assets/tex/' + k + '_nor.jpg', false, k + 'n'), loadTex('assets/tex/' + k + '_rough.jpg', false, k + 'r')])
        .then(function (a) { if (a[0] && a[1] && a[2]) PBR[k] = { map: a[0], normal: a[1], rough: a[2] }; }));
    });
    if (T.RGBELoader) {
      track('sky', 1100);
      jobs.push(new Promise(function (res) {
        new T.RGBELoader().setDataType(T.HalfFloatType).load('assets/sky.hdr', function (t) { t.mapping = T.EquirectangularReflectionMapping; A.sky = t; prog('sky', 1); res(); }, xhrProg('sky', 1107348), function () { prog('sky', 1); res(); });
      }));
    }
    track('veg', 1800);
    jobs.push(fetch('assets/models/veg.json').then(function (r) { return r.json(); }).then(function (info) {
      A.vegInfo = info; var keys = Object.keys(info), done = 0, sub = [];
      keys.forEach(function (k) {
        sub.push(new Promise(function (res) {
          new T.GLTFLoader().load('assets/models/' + info[k].file, function (g) {
            var mats = info[k].materials, tj = [];
            g.scene.traverse(function (m) {
              if (!m.isMesh || !m.material || !mats[m.material.name] || m.material.userData.done) return;
              var d = mats[m.material.name], mt = m.material; mt.userData.done = true; mt.roughness = 0.9; mt.metalness = 0;
              if (d.map) tj.push(loadTex('assets/models/' + d.map, true).then(function (t) { if (!t) return; if (d.uvScale) t.repeat.set(d.uvScale[0], d.uvScale[1]); if (d.uvOffset) t.offset.set(d.uvOffset[0], d.uvOffset[1]); mt.map = t; mt.needsUpdate = true; }));
              if (d.alphaMap) tj.push(loadTex('assets/models/' + d.alphaMap, false).then(function (t) { if (!t) return; t.generateMipmaps = false; t.minFilter = T.LinearFilter; mt.alphaMap = t; mt.alphaTest = 0.4; mt.side = T.DoubleSide; mt.transparent = false; mt.needsUpdate = true; }));
            });
            Promise.all(tj).then(function () { A.veg[k] = g.scene; done++; prog('veg', done / keys.length); res(); });
          }, undefined, function () { done++; prog('veg', done / keys.length); res(); });
        }));
      });
      return Promise.all(sub);
    }).catch(function () { prog('veg', 1); }));
    return Promise.all(jobs);
  }

  /* ---------- materiais (por nome, vindos do glb) ---------- */
  var MATDEF = {
    FAR_parede: { set: 'plaster', noMap: true, ns: 0.5, rough: 1 },
    FAR_madeira: { set: 'wood', rough: 1 },
    FAR_pedra: { set: 'stone', ns: 1.3, rough: 1 },
    FAR_piso_interno: { set: 'porcelain', rough: 0.55 },
    FAR_concreto: { set: 'concrete', rough: 1 },
    FAR_deck: { set: 'deck', color: '#d9d0c4', rough: 1 },
    FAR_grama: { set: 'grass', color: '#a9c79c', rough: 1, ns: 0.35 },
    FAR_calcada: { set: 'paving', rough: 1 },
    FAR_asfalto: { set: 'asphalt', rough: 1 },
    FAR_piscina: { set: 'porcelain', color: '#6fc7d2', rough: 0.35 }
  };
  var M = {}, envMats = [], UVK = 1;
  function each(name, fn) { (M[name] || []).forEach(fn); }
  function applySet(m, key, rough, ns, noMap) {
    var p = PBR[key]; if (!p) return;
    m.map = noMap ? null : p.map; m.normalMap = p.normal; m.roughnessMap = p.rough; m.roughness = rough == null ? 1 : rough;
    m.normalScale.set(ns || 1, ns || 1); m.needsUpdate = true;
  }
  function tintWood(hex) { var c = C(hex), l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; each('FAR_madeira', function (m) { m.color.copy(c).lerp(new T.Color(l, l, l), 0.35).multiplyScalar(1.3); }); }
  function tintStone(hex) { each('FAR_pedra', function (m) { m.color.copy(C(hex)).lerp(new T.Color(1, 1, 1), 0.3); }); }
  function setFloor(o) { each('FAR_piso_interno', function (m) { applySet(m, o.set, o.rough); if (!PBR[o.set]) m.color.copy(C(o.color)); }); }

  var roots = {}, nightLights = [], house;
  function setupHouse() {
    house = A.casa.scene; scene.add(house);
    UVK = (A.casa.parser && A.casa.parser.json.asset && A.casa.parser.json.asset.extras && A.casa.parser.json.asset.extras.uvScale) || 1;
    SETS.forEach(function (k) {
      if (!PBR[k]) return; var f = k === 'polished' ? 0.4 : 1;     // concreto polido: placa de 3 m sobre UV de 1,2 m
      [PBR[k].map, PBR[k].normal, PBR[k].rough].forEach(function (t) { t.repeat.set(UVK * f, UVK * f); });
    });
    ['Terreno', 'Terreo', 'Superior', 'Cobertura', 'Externo'].forEach(function (n) { roots[n] = house.getObjectByName(n); });
    var base = {}, withAo = {};
    function prepare(src) {
      var n = src.name, d = MATDEF[n], m = src;
      if (d) { applySet(m, d.set, d.rough, d.ns, d.noMap); if (PBR[d.set]) m.color.copy(C(d.color || '#ffffff')); }
      if (n === 'FAR_vidro') { m.transparent = true; m.opacity = 0.16; m.roughness = 0.04; m.metalness = 0.1; m.depthWrite = false; m.side = T.DoubleSide; m.color.copy(C('#cfe3ea')); m.envMapIntensity = 1.0; }
      if (n === 'FAR_agua') { m.transparent = true; m.opacity = 0.78; m.roughness = 0.03; m.metalness = 0; m.color.copy(C('#27b3c4')); m.envMapIntensity = 1.4; }
      if (n === 'FAR_luz') { m.emissive = C('#ffd9a0'); m.emissiveIntensity = 0; m.color.copy(C('#e9e4da')); }
      m.userData.env = m.envMapIntensity; envMats.push(m); (M[n] = M[n] || []).push(m); return m;
    }
    house.traverse(function (o) {
      if (o.isMesh) {
        var n = o.material.name, hasAo = !!(o.geometry.attributes.uv2 && A.ao);
        if (!base[n]) base[n] = prepare(o.material);
        if (hasAo) {
          if (!withAo[n]) { var c = base[n].clone(); c.name = n; c.aoMap = A.ao; c.aoMapIntensity = 1; c.userData.env = base[n].userData.env; envMats.push(c); M[n].push(c); withAo[n] = c; }
          o.material = withAo[n];
        } else o.material = base[n];
        var see = n === 'FAR_vidro' || n === 'FAR_agua';
        o.castShadow = !see && n !== 'FAR_luz' && n !== 'FAR_grama' && n !== 'FAR_asfalto' && n !== 'FAR_faixa';
        o.receiveShadow = !see; if (see) o.renderOrder = n === 'FAR_agua' ? 1 : 2;
      } else if (/^Luz_/.test(o.name)) {
        var pool = /piscina/.test(o.name), out = /jardim|deck|entrada|varanda/.test(o.name);
        if (small && /jardim|deck|garagem|banho|galeria/.test(o.name)) return;
        var l = new T.PointLight(pool ? '#3fe0f0' : '#ffcf8a', 0, pool ? 6 : out ? 7 : 10, 2); l.userData.k = pool ? 4 : out ? 3.5 : 6; l.visible = false; o.add(l); nightLights.push(l);
      }
    });
    each('FAR_parede', function (m) { m.color.copy(C(pick('wall').color)); });
    tintWood(pick('wood').color); tintStone(pick('stone').color); setFloor(pick('floor'));
    // gramado até o horizonte
    var far = new T.Mesh(new T.CircleGeometry(190, 64), new T.MeshStandardMaterial({ color: C('#a9c79c'), roughness: 1 }));
    if (PBR.grass) ['map', 'normalMap', 'roughnessMap'].forEach(function (k, i) { var t = [PBR.grass.map, PBR.grass.normal, PBR.grass.rough][i].clone(); t.repeat.set(95, 95); t.needsUpdate = true; far.material[k] = t; }); far.material.normalScale.set(0.35, 0.35);
    far.rotation.x = -Math.PI / 2; far.position.y = -0.3; far.receiveShadow = false; far.material.userData.env = 1; envMats.push(far.material); scene.add(far);
  }

  /* ---------- vegetação (Poly Haven, CC0), instanciada ---------- */
  function vegUnit(key, upright) {
    // normaliza o modelo: base no chão, altura 1; "upright" põe em pé modelos que vêm deitados
    var src = A.veg[key]; if (!src) return null;
    var g = new T.Group(); g.add(src); g.updateMatrixWorld(true);
    var bb = new T.Box3().setFromObject(g), sz = bb.getSize(new T.Vector3());
    if (upright && sz.y < Math.max(sz.x, sz.z) * 0.6) { src.rotation.z = sz.x > sz.z ? Math.PI / 2 : 0; if (sz.z >= sz.x) src.rotation.x = -Math.PI / 2; g.updateMatrixWorld(true); bb.setFromObject(g); sz = bb.getSize(new T.Vector3()); }
    var c = bb.getCenter(new T.Vector3()), k = 1 / sz.y;
    var N = new T.Matrix4().makeScale(k, k, k).multiply(new T.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z));
    var parts = []; g.traverse(function (m) { if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, mx: new T.Matrix4().multiplyMatrices(N, m.matrixWorld) }); });
    parts.forEach(function (p) { p.mat.envMapIntensity = 0.7; p.mat.userData.env = 0.7; envMats.push(p.mat); });
    return { parts: parts, w: Math.max(sz.x, sz.z) * k };
  }
  function scatter(unit, list, parent) {
    // list: [x, z, altura, giro]
    if (!unit || !list.length) return;
    var P = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), tmp = new T.Matrix4();
    unit.parts.forEach(function (p) {
      var im = new T.InstancedMesh(p.geo, p.mat, list.length);
      list.forEach(function (it, i) { q.setFromAxisAngle(up, it[3] || 0); P.compose(new T.Vector3(it[0], it[4] || 0, it[1]), q, new T.Vector3(it[2], it[2], it[2])); im.setMatrixAt(i, tmp.multiplyMatrices(P, p.mx)); });
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; (parent || scene).add(im);
    });
  }
  function D(x, y) { return [x - 4, -(y + 1)]; }           // coordenadas de projeto (Blender) -> cena
  function setupVeg() {
    var tA = vegUnit('island_tree_02'), tB = vegUnit('tree_small_02'), fern = vegUnit('fern_02');
    var r = rng(11), la = [], lb = [];
    var TREES = [[-11, 16, 9, 0], [3, 19, 7.5, 1], [15, 17, 9.5, 0], [27, 13, 7, 1], [-22, 5, 8.5, 0], [-20, -8, 6.5, 1], [30, -1, 8, 0], [27, -10, 6, 1],
      [-34, -30, 8, 0], [38, -27, 7, 1], [-36, 14, 9, 0], [-10.8, -9.6, 4.6, 1], [-10.6, 7.6, 5.6, 1], [18.4, 7.6, 6.2, 0], [19.2, -9.8, 3.4, 1], [-2.9, -6.9, 2.6, 1]];
    if (small) TREES = TREES.filter(function (t, i) { return i % 2 === 0 || i > 10; });
    TREES.forEach(function (t) { var p = D(t[0], t[1]); (t[3] ? lb : la).push([p[0], p[1], t[2], r() * 6.28]); });
    scatter(tA, la); scatter(tB, lb);
    var lf = [];
    function bed(x0, y0, x1, y1, n, h) { for (var i = 0; i < n; i++) { var u = n > 1 ? i / (n - 1) : 0.5, p = D(x0 + (x1 - x0) * u + (r() - 0.5) * 0.3, y0 + (y1 - y0) * u + (r() - 0.5) * 0.3); lf.push([p[0], p[1], h * (0.8 + r() * 0.5), r() * 6.28]); } }
    bed(0.5, -11.5, 19.5, -11.5, small ? 4 : 6, 0.5); bed(18.9, -9, 18.9, 8.5, small ? 3 : 5, 0.5); bed(-8, 9.4, 18, 9.4, small ? 4 : 7, 0.55); bed(-11.9, -2, -11.9, 8.5, small ? 2 : 4, 0.5);
    scatter(fern, lf);
  }

  /* ---------- céu, luz, reflexos ---------- */
  var skyUni = { top: { value: new T.Color('#3a78c8') }, hor: { value: new T.Color('#dbe7f2') }, gnd: { value: new T.Color('#6f7a68') }, hdr: { value: null }, mixHdr: { value: 0 }, night: { value: 0 }, expo: { value: 1 } };
  var SKY_VS = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  var SKY_FS = 'uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform sampler2D hdr; uniform float mixHdr; uniform float night; uniform float expo; varying vec3 vP;' +
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
    'void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.5)) : mix(hor, gnd, smoothstep(0.0, 0.25, -y));' +
    'if (night > 0.01 && y > 0.02) { vec3 d = normalize(vP); vec2 a = vec2(atan(d.z, d.x), asin(d.y)) * 230.0; vec2 g = floor(a); float s = step(0.988, hash(g)) * hash(g + 3.1) * smoothstep(0.3, 0.05, length(fract(a) - 0.5)); c += vec3(0.9, 0.95, 1.0) * s * night * smoothstep(0.02, 0.25, y) * 0.9; }' +
    'if (mixHdr > 0.5) { vec3 d = normalize(vP); vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);' +
    ' vec3 h = min(texture2D(hdr, uv).rgb, vec3(40.0)) * expo; h *= vec3(0.72, 0.86, 1.2); h = mix(hor * 0.95, h, smoothstep(-0.02, 0.3, y)); c = mix(h, c, night); }' +
    ' gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}';
  function skyMat(uni) { return new T.ShaderMaterial({ uniforms: uni, side: T.BackSide, depthWrite: false, fog: false, vertexShader: SKY_VS, fragmentShader: SKY_FS }); }
  var sky = new T.Mesh(new T.SphereGeometry(200, 48, 32), skyMat(skyUni)); sky.renderOrder = -1; scene.add(sky);
  var SUN_DIR = new T.Vector3(0.55, 0.74, 0.39).normalize();
  function buildEnv() {
    var es = new T.Scene(), u;
    if (A.sky) {
            u = { top: skyUni.top, hor: skyUni.hor, gnd: skyUni.gnd, hdr: { value: A.sky }, mixHdr: { value: 1 }, night: { value: 0 }, expo: { value: 1 } };
      es.add(new T.Mesh(new T.SphereGeometry(50, 48, 32), skyMat(u)));
    } else {
      u = { top: { value: C('#6f9ad0') }, hor: { value: C('#dce8f2') }, gnd: { value: C('#5f6a58') }, hdr: { value: null }, mixHdr: { value: 0 }, night: { value: 0 }, expo: { value: 1 } };
      es.add(new T.Mesh(new T.SphereGeometry(50, 24, 16), skyMat(u)));
      var sunM = new T.Mesh(new T.SphereGeometry(5, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(1, 0.93, 0.82).multiplyScalar(14) }));
      sunM.position.copy(SUN_DIR).multiplyScalar(42); es.add(sunM);
    }
    if (params.get('noenv')) return; var pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
  }
  var hemi = new T.HemisphereLight('#ffffff', '#6f7a68', 0.3); scene.add(hemi);
  var sun = new T.DirectionalLight('#fff1dc', 2.4); sun.position.copy(SUN_DIR).multiplyScalar(60); sun.castShadow = true;
  var SM = small ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -0.0005; sun.shadow.normalBias = small ? 0.06 : 0.035;
  var sc = sun.shadow.camera; sc.left = -27; sc.right = 27; sc.top = 24; sc.bottom = -24; sc.near = 10; sc.far = 120;
  sun.target.position.set(0, 0, 0); scene.add(sun); scene.add(sun.target);
  scene.fog = new T.Fog('#dfe9f1', 80, 190);

  /* ---------- estado e câmera ---------- */
  var VIEWS = {
    fachada:  { th: 0.6, ph: 1.3, r: 40, t: [1.5, 2.6, 0], lr: 0, lu: 0 },
    aerea:    { th: 0.85, ph: 0.62, r: 54, t: [1.5, 0.5, 0], lr: 0, lu: 0 },
    terreo:   { th: 0.42, ph: 0.6, r: 30, t: [-1.5, 0.6, -0.5], lr: 1, lu: 1 },
    superior: { th: 0.42, ph: 0.6, r: 29, t: [-1.0, 3.6, -0.5], lr: 1, lu: 0 }
  };
  var goal = { th: 0, ph: 0, r: 0, tx: 0, ty: 0, tz: 0 }, cur = {};
  var st = { view: 'fachada', lr: 0, lu: 0, g: { lr: 0, lu: 0 }, night: 0, nightGoal: 0, auto: false, idle: 0, shadowDirty: true };
  function setView(name, instant) {
    var v = VIEWS[name]; if (!v) return;
    st.view = name; st.auto = false; st.g.lr = v.lr; st.g.lu = v.lu;
    goal.th = v.th; goal.ph = v.ph; goal.r = v.r * (camera.aspect < 0.9 ? 0.92 : 1); goal.tx = v.t[0]; goal.ty = v.t[1]; goal.tz = v.t[2];
    if (instant || reduce) { for (var k in goal) cur[k] = goal[k]; st.lr = st.g.lr; st.lu = st.g.lu; }
    invalidate();
  }
  var CL = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function clampGoal() { goal.ph = CL(goal.ph, 0.15, 1.5); goal.r = CL(goal.r, 10, 85); }

  var cTopD = C('#3b7fd4'), cTopN = new T.Color('#04060b'), cHorD = C('#c9dcee'), cHorN = new T.Color('#141c28'), cGndD = new T.Color('#6f7a68'), cGndN = new T.Color('#0b0f13');
  var L = { sun: 2.1, hemi: 0.3 }, cSunD = new T.Color('#fff1dc'), cSunN = new T.Color('#8fa6ff'), cWarm = C('#ffcf8a'), cPool = C('#12b8d0'), lastNight = -1;
  // A neblina é misturada depois do tone mapping: para o horizonte não marcar uma faixa, a cor dela tem de ser
  // a cor do céu como aparece na tela (ACES + sRGB, as mesmas contas do three r128).
  function shown(c, expo, out) {
    var k = expo / 0.6, r = c.r * k, g = c.g * k, b = c.b * k;
    var x = 0.59719 * r + 0.35458 * g + 0.04823 * b, y = 0.07600 * r + 0.90834 * g + 0.01566 * b, z = 0.02840 * r + 0.13383 * g + 0.83777 * b;
    function f(v) { return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
    x = f(x); y = f(y); z = f(z);
    function e(v) { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 0.41666) - 0.055; }
    return out.setRGB(e(1.60475 * x - 0.53108 * y - 0.07367 * z), e(-0.10208 * x + 1.10813 * y - 0.00605 * z), e(-0.00327 * x - 0.07276 * y + 1.07602 * z));
  }
  function applyFrame(dt) {
    var k = reduce ? 1 : 1 - Math.exp(-dt * 6), moving = false;
    if (st.auto) { goal.th += dt * 0.06; st.idle += dt; if (st.idle > 25) st.auto = false; }
    ['th', 'ph', 'r', 'tx', 'ty', 'tz'].forEach(function (p) { var d = goal[p] - cur[p]; if (Math.abs(d) > 0.0005) { cur[p] += d * k; moving = true; } else cur[p] = goal[p]; });
    ['lr', 'lu'].forEach(function (q) { var d = st.g[q] - st[q]; if (Math.abs(d) > 0.001) { st[q] += d * k; moving = true; st.shadowDirty = true; } else if (st[q] !== st.g[q]) { st[q] = st.g[q]; st.shadowDirty = true; } });
    var dn = st.nightGoal - st.night; if (Math.abs(dn) > 0.001) { st.night += dn * k; moving = true; } else st.night = st.nightGoal;

    var sp = Math.sin(cur.ph);
    camera.position.set(cur.tx + cur.r * sp * Math.sin(cur.th), cur.ty + cur.r * Math.cos(cur.ph), cur.tz + cur.r * sp * Math.cos(cur.th));
    camera.lookAt(cur.tx, cur.ty, cur.tz);

    // vistas de pavimento: a cobertura (e o pavimento de cima) sobem e somem
    if (roots.Cobertura) { roots.Cobertura.position.y = st.lr * 9; roots.Cobertura.visible = st.lr < 0.99; }
    if (roots.Superior) { roots.Superior.position.y = st.lu * 18; roots.Superior.visible = st.lu < 0.99; }

    var n = st.night;
    if (n !== lastNight) {
      lastNight = n; st.shadowDirty = true;
      sun.intensity = L.sun - n * (L.sun - 0.16); sun.color.copy(cSunD).lerp(cSunN, n); hemi.intensity = L.hemi - n * (L.hemi - 0.05);
      nightLights.forEach(function (l) { l.visible = n > 0.002; l.intensity = n * l.userData.k; });
      envMats.forEach(function (m) { m.envMapIntensity = (m.userData.env == null ? 1 : m.userData.env) * (1 - n * 0.93); });
      each('FAR_vidro', function (m) { m.emissive.copy(cWarm).multiplyScalar(n * 0.22); });
      each('FAR_agua', function (m) { m.emissive.copy(cPool).multiplyScalar(n * 0.55); });
      each('FAR_luz', function (m) { m.emissiveIntensity = n * 2.6; });
      skyUni.night.value = n; skyUni.expo.value = 0.6;
      skyUni.top.value.copy(cTopD).lerp(cTopN, n); skyUni.hor.value.copy(cHorD).lerp(cHorN, n); skyUni.gnd.value.copy(cGndD).lerp(cGndN, n);
      renderer.toneMappingExposure = 0.94 + n * 0.3; shown(skyUni.hor.value, renderer.toneMappingExposure, scene.fog.color);
    }
    return moving || st.auto;
  }

  /* ---------- tamanho e laço sob demanda ---------- */
  var ready = false, visible = true, onScreen = true, queued = false, last = 0;
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.9 ? 50 : 36; camera.updateProjectionMatrix(); invalidate();
  }
  function invalidate() { if (!ready || queued || !visible) return; queued = true; requestAnimationFrame(frame); }
  function frame(now) {
    queued = false; if (!visible) { last = 0; return; }
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016; last = now;
    var anim = applyFrame(dt);
    if (st.shadowDirty) { renderer.shadowMap.needsUpdate = true; st.shadowDirty = false; }
    renderer.render(scene, camera);
    /* fora da tela: desenha o que mudou, mas não mantém o laço de animação */
    if (anim && onScreen) invalidate(); else last = 0;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  if (window.IntersectionObserver) new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; if (onScreen) invalidate(); }).observe(stage);
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; if (visible) invalidate(); });
  canvas.addEventListener('webglcontextrestored', function () { st.shadowDirty = true; invalidate(); });

  /* ---------- entrada: arrastar, pinça, roda, teclado ---------- */
  var ptrs = {}, lastDist = 0;
  function stopAuto() { st.auto = false; $('#hint').classList.add('is-hidden'); }
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; stopAuto(); lastDist = 0; });
  canvas.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId]; if (!p) return; var ids = Object.keys(ptrs);
    if (ids.length === 1) { goal.th -= (e.clientX - p.x) * 0.006; goal.ph -= (e.clientY - p.y) * 0.006; }
    else if (ids.length === 2) { var o = ptrs[ids[0] === String(e.pointerId) ? ids[1] : ids[0]], d = Math.hypot(e.clientX - o.x, e.clientY - o.y); if (lastDist) goal.r *= lastDist / d; lastDist = d; }
    p.x = e.clientX; p.y = e.clientY; clampGoal(); invalidate();
  });
  function up(e) { delete ptrs[e.pointerId]; lastDist = 0; }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); stopAuto(); goal.r *= Math.exp(e.deltaY * 0.001); clampGoal(); invalidate(); }, { passive: false });
  canvas.addEventListener('keydown', function (e) {
    var h = true;
    if (e.key === 'ArrowLeft') goal.th -= 0.12; else if (e.key === 'ArrowRight') goal.th += 0.12;
    else if (e.key === 'ArrowUp') goal.ph -= 0.08; else if (e.key === 'ArrowDown') goal.ph += 0.08;
    else if (e.key === '+' || e.key === '=') goal.r *= 0.9; else if (e.key === '-') goal.r *= 1.1; else h = false;
    if (h) { e.preventDefault(); stopAuto(); clampGoal(); invalidate(); }
  });

  /* ---------- painel ---------- */
  function press(group, value) { [].forEach.call(document.querySelectorAll('[data-group="' + group + '"] button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === value)); }); }
  function apply(k, o) {
    sel[k] = o.id;
    if (k === 'wall') each('FAR_parede', function (m) { m.color.copy(C(o.color)); });
    else if (k === 'wood') tintWood(o.color);
    else if (k === 'stone') tintStone(o.color);
    else if (k === 'floor') setFloor(o);
    invalidate();
  }
  GROUPS.forEach(function (k) {
    var holder = document.querySelector('.chips[data-group="' + k + '"]');
    FIN[k].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-value', o.id); b.setAttribute('aria-pressed', String(o.id === sel[k]));
      var sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = o.color; b.appendChild(sw); b.appendChild(document.createTextNode(o.label));
      b.addEventListener('click', function () { press(k, o.id); if (ready) apply(k, o); else sel[k] = o.id; });
      holder.appendChild(b);
    });
  });
  function setTime(v) { press('time', v); st.nightGoal = v === 'noite' ? 1 : 0; if (reduce) st.night = st.nightGoal; invalidate(); }
  document.querySelector('.seg[data-group="view"]').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b || !ready) return; stopAuto(); press('view', b.getAttribute('data-value')); setView(b.getAttribute('data-value')); });
  document.querySelector('.seg[data-group="time"]').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; setTime(b.getAttribute('data-value')); });

  // Alguns aparelhos (ex.: renderização por software) devolvem o mapa de reflexos preto e a cena inteira sai escura.
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
      if (buf[0] + buf[1] + buf[2] < 6) { scene.environment = null; L.sun = 1.6; L.hemi = 0.75; lastNight = -1; }
    } catch (e) { /* sem o teste, segue com o reflexo */ }
  }

  /* ---------- início ---------- */
  function start() {
    setupHouse(); setupVeg(); buildEnv(); resize(); probeEnv();
    if (params.get('cam')) { var cm = params.get('cam').split(',').map(Number); if (cm.length === 6 && cm.every(isFinite)) VIEWS.fachada = { th: cm[0], ph: cm[1], r: cm[2], t: [cm[3], cm[4], cm[5]], lr: 0, lu: 0 }; }
    var v0 = params.get('view'); if (!VIEWS[v0]) v0 = 'fachada';
    ready = true; setView(v0, true); press('view', v0);
    st.auto = v0 === 'fachada' && !reduce && !poster && !params.get('cam') && params.get('auto') !== '0';
    var t0 = params.get('time'); if (t0 === 'noite' || params.get('night') === '1') { st.nightGoal = st.night = 1; press('time', 'noite'); }
    GROUPS.forEach(function (k) { press(k, sel[k]); });
    renderer.compile(scene, camera);
    resize(); invalidate();
    requestAnimationFrame(function () { requestAnimationFrame(function () { $('#loading').classList.add('is-done'); document.documentElement.setAttribute('data-3d', 'pronto'); }); });
    if (params.get('debug')) window.__dbg = { scene: scene, renderer: renderer, A: A, goal: goal, cur: cur, camera: camera, st: st, T: T, M: M };
  }
  if (location.protocol === 'file:') return fail();
  loadAll().then(function () { try { start(); } catch (e) { if (window.console) console.error(e); fail(); } }, function () { fail(); });
})();
