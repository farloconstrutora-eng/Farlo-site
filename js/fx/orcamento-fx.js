/* FARLO — js/fx/orcamento-fx.js (etapa 3): movimento do "Monte seu orçamento" (contato).
   js/orcamento.js chama FX.orc.before() e FX.orc.after() em volta de cada atualização; aqui se
   compara o antes e o depois e se anima o que mudou:
   - etapa ou botão de envio que abre: cresce no lugar (altura + gap), número da etapa entra e os
     filhos (rótulo, campo, opções) sobem em sequência; no celular a página desliza até a etapa;
   - aviso que aparece ou some: abre e fecha suave (quem sai é uma cópia muda, aria-hidden);
   - etapa completa: o número acende com um anel; o filete do topo da caixa mostra o progresso.
   Sem GSAP, sem fx.js ou com movimento reduzido, FX.orc.ready() é falso e orcamento.js só mostra. */
(function () {
  "use strict";
  var gsap = window.gsap, FX = window.FX;
  var form = document.querySelector("[data-orcamento]");
  if (!gsap || !FX || !form) return;

  var root = document.documentElement;
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var toArr = function (l) { return Array.prototype.slice.call(l); };
  var steps = toArr(form.querySelectorAll(".orc__step"));
  var blocks = steps.concat(toArr(form.querySelectorAll(".orc__send")));
  var notes = toArr(form.querySelectorAll(".field__err, .orc__falta, .orc__other"));
  var all = blocks.concat(notes);
  var snap = null, bar = null, settleT, scrollTw;

  function ready() { return root.classList.contains("fx-on") && !mq.matches; }
  function px(v) { return parseFloat(v) || 0; }
  function busy(el) { return el._orcTw && el._orcTw.isActive(); }
  function kill(el) { if (el._orcTw) { el._orcTw.progress(1).kill(); el._orcTw = null; } }

  /* espaço vertical do elemento além da altura: gap do pai (grid/flex), margem e padding */
  function box(el) {
    var ps = getComputedStyle(el.parentNode), cs = getComputedStyle(el);
    return {
      gap: /grid|flex/.test(ps.display) ? px(ps.rowGap) : 0,
      mt: px(cs.marginTop), pt: px(cs.paddingTop), pb: px(cs.paddingBottom)
    };
  }

  /* recalcula o ScrollTrigger/ScrollSmoother quando a caixa para de mudar de altura */
  function settle() {
    clearTimeout(settleT);
    settleT = setTimeout(function () { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }, 120);
  }

  /* abre no lugar: de altura 0 (e sem o gap de cima) até a altura natural */
  function grow(el, dur, onDone) {
    kill(el);
    var h = el.offsetHeight, b = box(el);
    el._orcTw = gsap.fromTo(el,
      { height: 0, marginTop: b.mt - b.gap, paddingTop: 0, paddingBottom: 0, opacity: 0, overflow: "hidden" },
      { height: h, marginTop: b.mt, paddingTop: b.pt, paddingBottom: b.pb, opacity: 1, duration: dur, ease: "expo.out",
        clearProps: "height,marginTop,paddingTop,paddingBottom,opacity,overflow",
        onComplete: function () { el._orcTw = null; settle(); if (onDone) onDone(); } });
    return h;
  }

  /* aviso que sumiu: uma cópia muda fica no lugar e fecha (o original já está hidden e vazio) */
  function ghost(el, old) {
    if (!old.h) return;
    var g = el.cloneNode(false);
    ["id", "name", "role", "aria-live", "aria-describedby", "aria-label", "data-orc-falta"].forEach(function (a) { g.removeAttribute(a); });
    g.hidden = false;
    g.setAttribute("aria-hidden", "true");
    g.classList.add("fx-orc-ghost");
    if (g.tagName === "INPUT") { g.value = old.value || ""; g.disabled = true; g.tabIndex = -1; }
    else g.textContent = old.text;
    el.parentNode.insertBefore(g, el.nextSibling);
    var b = box(g);
    gsap.fromTo(g, { height: old.h, overflow: "hidden" },
      { height: 0, marginTop: b.mt - b.gap, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, borderBottomWidth: 0, opacity: 0,
        duration: .35, ease: "power2.inOut", onComplete: function () { g.remove(); settle(); } });
  }

  /* aviso que continua visível mas mudou de tamanho (texto do "falta" mudou) */
  function morph(el, h0) {
    var h1 = el.offsetHeight;
    if (Math.abs(h1 - h0) < 2) return;
    el._orcTw = gsap.fromTo(el, { height: h0, overflow: "hidden" },
      { height: h1, duration: .35, ease: "power3.out", clearProps: "height,overflow", onComplete: function () { el._orcTw = null; settle(); } });
  }

  /* número aceso: anel que se expande uma vez (CSS em fx.css) */
  function ring(step) {
    var n = step.querySelector(".orc__num span");
    if (!n) return;
    n.classList.remove("is-lit");
    void n.offsetWidth;
    n.classList.add("is-lit");
  }

  /* leva a etapa nova para dentro da tela, só o necessário e sem esconder o topo dela */
  function reveal(el, h) {
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var top = el.getBoundingClientRect().top;
    var off = px(getComputedStyle(root).scrollPaddingTop) + 16;
    var delta = Math.min(top + h - (vh - 24), top - off);
    if (delta < 8) return;
    /* rola junto com a abertura: a altura cresce mais rápido (expo) que a rolagem (power2), então o
       limite de rolagem já existe a cada quadro; o ScrollSmoother acompanha a altura sozinho */
    var sm = FX.smoother;
    if (scrollTw) scrollTw.kill();
    var p = { y: sm ? sm.scrollTop() : window.pageYOffset };
    var stop = function () { if (scrollTw) scrollTw.kill(); };
    window.addEventListener("touchstart", stop, { once: true, passive: true });
    window.addEventListener("wheel", stop, { once: true, passive: true });
    scrollTw = gsap.to(p, { y: p.y + delta, duration: .9, ease: "power2.inOut",
      onUpdate: function () { if (sm) sm.scrollTop(p.y); else window.scrollTo({ top: p.y, behavior: "instant" }); },
      onComplete: function () { window.removeEventListener("touchstart", stop); window.removeEventListener("wheel", stop); } });
  }

  /* etapa (ou o envio) que abre */
  function enter(el) {
    reveal(el, grow(el, .75));
    var num = el.querySelector(".orc__num span");
    var kids = [];
    toArr(el.children).forEach(function (c) {
      if (c.hidden || c.classList.contains("orc__num")) return;
      if (c.classList.contains("orc__group")) {
        toArr(c.children).forEach(function (g) {
          if (g.hidden) return;
          if (g.classList.contains("orc__opts")) kids = kids.concat(toArr(g.children));
          else kids.push(g);
        });
      } else kids.push(c);
    });
    if (num) gsap.fromTo(num, { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, delay: .05, ease: "expo.out", clearProps: "transform,opacity" });
    if (kids.length) gsap.fromTo(kids, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .7, delay: .12, stagger: .05, ease: "expo.out", clearProps: "transform,opacity" });
  }

  function before() {
    snap = all.map(function (el) {
      return { hidden: el.hidden, text: el.textContent, value: el.value, h: el.hidden ? 0 : el.offsetHeight };
    });
  }

  function after(info) {
    if (!snap) return;
    var old = snap; snap = null;
    all.forEach(function (el, i) {
      var o = old[i], isNote = notes.indexOf(el) > -1;
      if (o.hidden && !el.hidden) { if (isNote) grow(el, .45); else enter(el); }
      else if (!o.hidden && el.hidden) { kill(el); if (isNote) ghost(el, o); }
      else if (!el.hidden && isNote && !busy(el)) morph(el, o.h);
    });
    if (!info) return;
    steps.forEach(function (s, i) {
      var d = !!(info.done && info.done[i]);
      if (d === s.classList.contains("fx-orc-done")) return;
      s.classList.toggle("fx-orc-done", d);
      if (d) ring(s);
    });
    if (bar) gsap.to(bar, { scaleX: Math.max(0, Math.min(1, info.progress || 0)), duration: .9, ease: "expo.out", overwrite: true });
  }

  if (ready()) {
    bar = document.createElement("div");
    bar.className = "fx-orc-bar";
    bar.setAttribute("aria-hidden", "true");
    form.insertBefore(bar, form.firstChild);
  }

  FX.orc = { ready: ready, before: before, after: after };
})();
