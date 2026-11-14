/* FARLO — js/home3d.js: 3D do hero (three.js + modelos .glb carregados sob demanda) e demo da residência embutida.
   Sem WebGL, sem JS ou com falha de carga, o hero mostra a logo e a demo abre em tela cheia. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- demo da residência: só carrega quando o visitante pede ---------- */
  document.querySelectorAll("[data-embed-3d]").forEach(function (box) {
    var btn = box.querySelector("[data-embed-activate]");
    if (!btn) return;
    /* evita o salto de foco do scroll suave entre o mousedown e o mouseup */
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var f = document.createElement("iframe");
      f.src = btn.getAttribute("data-src");
      f.title = btn.getAttribute("data-title") || "3D";
      f.setAttribute("allow", "fullscreen");
      f.setAttribute("loading", "lazy");
      box.appendChild(f);
      box.classList.add("is-active");
      f.focus();
    });
  });

  /* ---------- hero 3D ---------- */
  var stage = document.querySelector("[data-hero3d]");
  if (!stage) return;
  var canvas = stage.querySelector("canvas");
  var three = stage.getAttribute("data-three");
  var base = three.replace("js/vendor/three.min.js", "");

  function script(src, cb) {
    var s = document.createElement("script");
    s.src = src; s.onload = function () { cb(); }; s.onerror = function () { cb(true); };
    document.head.appendChild(s);
  }
  function loadLibs(cb) {
    if (window.THREE && THREE.GLTFLoader && THREE.RGBELoader) return cb();
    script(three, function (e) {
      if (e) return;
      script(base + "js/vendor/GLTFLoader.js", function () { script(base + "js/vendor/RGBELoader.js", function () { cb(); }); });
    });
  }
  function start() { loadLibs(function () { try { init(window.THREE); } catch (e) { console.warn("[hero3d]", e); } }); }
  if (document.readyState === "complete") schedule(); else window.addEventListener("load", schedule);
  function schedule() { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(start); }

  function init(THREE) {
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 3.5, 11.6);
    camera.lookAt(0, 0.7, 0);

    var hemi = new THREE.HemisphereLight(0xdfe6ea, 0x1a2024, 0.35); scene.add(hemi);
    var key = new THREE.DirectionalLight(0xfff1d6, 2.2); key.position.set(4.5, 7, 5);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    var sc = key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 20; key.shadow.bias = -0.0004;
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xff7a1a, 0.9); rim.position.set(-5, 2.5, -4); scene.add(rim);

    /* luz de ambiente (HDRI): dá o reflexo e o brilho realistas aos materiais */
    new THREE.RGBELoader().setDataType(THREE.HalfFloatType).load(base + "assets/hdr/sky.hdr", function (t) {
      try {
        var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
        scene.environment = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
        hemi.intensity = 0.1; key.intensity = 1.8; request();
      } catch (e) { /* segue só com as luzes */ }
    });

    function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
    var AMBER = srgb(0xffb400);
    var texLoader = new THREE.TextureLoader();
    function tex(name, rep) {
      var t = texLoader.load(base + "residencia-3d/assets/tex/" + name, function () { request(); });
      t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
      t.anisotropy = 4; return t;
    }
    function std(o) { return new THREE.MeshStandardMaterial(o); }

    function plinth(g, top) {
      var p = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.14, 72), std({ color: srgb(0x20262b), roughness: 0.55, metalness: 0.25 }));
      p.position.y = -0.07; p.receiveShadow = true; g.add(p);
      var r = new THREE.Mesh(new THREE.RingGeometry(2.9, 2.95, 96), new THREE.MeshBasicMaterial({ color: AMBER, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2; r.position.y = 0.002; g.add(r);
      if (top) {
        var d = new THREE.Mesh(new THREE.CircleGeometry(2.86, 72), top);
        d.rotation.x = -Math.PI / 2; d.position.y = 0.003; d.receiveShadow = true; g.add(d);
      }
    }
    function shadows(o) { o.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
    function fit(o, size, x, z, ry) {
      var b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      var k = size / Math.max(s.x, s.y, s.z);
      o.scale.multiplyScalar(k); o.position.set(x - c.x * k, -b.min.y * k + 0.003, z - c.z * k); if (ry) o.rotation.y = ry;
      return o;
    }
    var gl = new THREE.GLTFLoader(), cache = {};
    function model(path) {
      if (!cache[path]) cache[path] = new Promise(function (res, rej) { gl.load(base + path + ".glb", function (g) { res(g.scene); }, undefined, rej); });
      return cache[path].then(function (s) { return s.clone(true); });
    }
    function box(g, w, h, d, x, y, z, mat) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
    }

    /* ---- 1) imóvel: casa com materiais reais, piscina, deck e árvore ---- */
    function buildHouse() {
      var g = new THREE.Group();
      plinth(g, std({ map: tex("grass_diff.jpg", 5), color: srgb(0x86b05a), roughness: 1 }));
      var plaster = std({ map: tex("plaster_diff.jpg", 1.5), roughness: 0.85 });
      var wood = std({ map: tex("wood_diff.jpg", 1.2), roughness: 0.7 });
      var conc = std({ map: tex("concrete_diff.jpg", 1.5), roughness: 0.8 });
      var deck = std({ map: tex("deck_diff.jpg", 1.6), roughness: 0.75 });
      var glass = std({ color: srgb(0x2c4a5c), roughness: 0.08, metalness: 0.7 });
      var water = std({ color: srgb(0x2fa9c4), roughness: 0.06, metalness: 0.1, emissive: srgb(0x063a46) });
      box(g, 2.9, 0.95, 1.9, -0.2, 0.475, 0, plaster);
      box(g, 1.9, 0.85, 1.5, 0.3, 1.375, -0.05, wood);
      box(g, 3.2, 0.12, 2.2, -0.2, 0.99, 0, conc);
      box(g, 2.2, 0.12, 1.8, 0.3, 1.86, -0.05, conc);
      box(g, 1.1, 0.55, 0.04, -0.85, 0.5, 0.96, glass);
      box(g, 1.2, 0.45, 0.04, 0.45, 1.35, 0.72, glass);
      box(g, 0.5, 0.75, 0.04, 0.6, 0.4, 0.96, wood);
      box(g, 1.7, 0.05, 1.0, -0.6, 0.025, 1.65, deck);
      box(g, 1.2, 0.04, 0.7, -0.6, 0.045, 1.65, water);
      box(g, 0.9, 0.95, 1.9, 1.7, 0.475, 0, conc);
      return model("residencia-3d/assets/models/tree_small_02").then(function (t) {
        fit(t, 2.4, -2.0, -1.2); shadows(t); g.add(t); return g;
      }, function () { return g; });
    }

    /* ---- 2) produto: câmera fotográfica ---- */
    function buildProduct() {
      var g = new THREE.Group(); plinth(g);
      var pd = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.25, 64), std({ color: srgb(0x3a444c), roughness: 0.25, metalness: 0.5 }));
      pd.position.y = 0.125; pd.castShadow = pd.receiveShadow = true; g.add(pd);
      return model("assets/models/Camera_01").then(function (m) {
        fit(m, 3.3, 0, 0, 0.5); shadows(m); m.position.y += 0.25; g.add(m); return g;
      });
    }

    /* ---- 3) ambiente: sala com sofá, poltrona, mesa e planta ---- */
    function buildSpace() {
      var g = new THREE.Group(); plinth(g, std({ map: tex("floorWood_diff.jpg", 3), roughness: 0.6 }));
      var rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.02, 64), std({ color: srgb(0x8d8a84), roughness: 1 }));
      rug.position.y = 0.012; rug.receiveShadow = true; g.add(rug);
      return Promise.all([model("assets/models/sofa_02"), model("assets/models/modern_arm_chair_01"), model("assets/models/round_wooden_table_01"), model("assets/models/potted_plant_02")]).then(function (a) {
        fit(a[0], 2.5, 0, -0.9, 0); fit(a[1], 1.15, 1.5, 0.35, -2.2); fit(a[2], 0.75, -0.2, 0.55, 0); fit(a[3], 1.3, -1.8, -0.9, 0.3);
        a.forEach(function (o) { shadows(o); g.add(o); }); return g;
      });
    }

    var builders = { house: buildHouse, product: buildProduct, space: buildSpace };
    var shapes = {}, st = {}, cur = "house", loading = {};
    function ensure(k) {
      if (shapes[k]) return Promise.resolve();
      if (!loading[k]) loading[k] = builders[k]().then(function (g) {
        g.position.y = k === "house" ? -0.9 : -1.0; g.visible = false; scene.add(g); shapes[k] = g; st[k] = { s: 0, t: 0 };
      }, function (e) { console.warn("[hero3d]", k, e); delete loading[k]; });
      return loading[k];
    }

    var yaw = 0.6, pitch = 0.0, vel = 0, dragging = false, lastX = 0, ty = 0, visible = true, raf = 0, last = 0;
    function size() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    function frame(now) {
      raf = 0;
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      if (!dragging) { yaw += (reduce ? 0 : 0.25 * dt) + vel; vel *= 0.94; }
      pitch += (ty * 0.1 - pitch) * 0.06;
      var moving = false;
      Object.keys(shapes).forEach(function (k) {
        var o = st[k], g = shapes[k];
        o.s += (o.t - o.s) * Math.min(1, dt * 8);
        if (Math.abs(o.t - o.s) > 0.002) moving = true; else o.s = o.t;
        g.visible = o.s > 0.01;
        g.scale.setScalar(Math.max(0.0001, o.s));
        g.rotation.y = yaw; g.rotation.x = pitch;
      });
      renderer.render(scene, camera);
      if (!reduce || dragging || moving || Math.abs(vel) > 0.0005) request();
    }
    function request() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }

    /* só mostra o 3D quando o primeiro modelo estiver pronto */
    ensure("house").then(function () {
      if (!shapes.house) return;
      st.house.t = 1; st.house.s = 1; shapes.house.visible = true;
      stage.classList.add("is-live"); size(); request();
    });
    if (window.ResizeObserver) new ResizeObserver(function () { size(); request(); }).observe(stage); else window.addEventListener("resize", function () { size(); request(); });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) request(); }).observe(stage);
    document.addEventListener("visibilitychange", request);

    canvas.addEventListener("pointerdown", function (e) { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture(e.pointerId); request(); });
    canvas.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect(); ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (dragging) { var d = (e.clientX - lastX) * 0.012; yaw += d; vel = d * 0.4; lastX = e.clientX; }
      request();
    });
    function up() { dragging = false; request(); }
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", function () { ty = 0; });
    canvas.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { vel -= 0.03; request(); e.preventDefault(); }
      else if (e.key === "ArrowRight") { vel += 0.03; request(); e.preventDefault(); }
    });

    var chips = Array.prototype.slice.call(stage.querySelectorAll("[data-shape]"));
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var k = c.getAttribute("data-shape"); if (k === cur) return;
        chips.forEach(function (o) { o.setAttribute("aria-pressed", String(o === c)); });
        c.setAttribute("aria-busy", "true"); var prev = cur; cur = k;
        ensure(k).then(function () {
          c.removeAttribute("aria-busy");
          if (cur !== k || !shapes[k]) return;
          if (st[prev]) st[prev].t = 0;
          st[k].t = 1; shapes[k].visible = true; request();
        });
      });
    });
  }
})();
