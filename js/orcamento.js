/* FARLO — js/orcamento.js: "Monte seu orçamento" na página de contato.
   Formulário em 3 etapas que aparecem uma de cada vez. No fim, abre o WhatsApp
   com as respostas numa mensagem pronta. Nada é enviado pelo site. */
(function () {
  "use strict";
  var form = document.querySelector("[data-orcamento]");
  if (!form) return;

  var en = (document.body.getAttribute("data-lang") || document.documentElement.lang || "pt").indexOf("en") === 0;
  var cfg = (window.FARLO && window.FARLO.config) || {};
  var wa = /^\d{10,15}$/.test(cfg.whatsapp || "") ? cfg.whatsapp : null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var T = en ? {
    hello: "Hi! I came from the FARLO website and I'd like a quote.",
    name: "Name", need: "I need", branch: "Business", found: "How I found FARLO",
    and: " and ", errName: "Please tell us your name.", errNeed: "Choose at least one option.",
    errBranch: "Please tell us your business.", errFound: "Choose one option.",
    subject: "Quote request from the FARLO website"
  } : {
    hello: "Olá! Vim pelo site da FARLO e quero um orçamento.",
    name: "Nome", need: "Preciso de", branch: "Ramo da empresa", found: "Como encontrei a FARLO",
    and: " e ", errName: "Escreva o seu nome.", errNeed: "Escolha pelo menos uma opção.",
    errBranch: "Escreva o ramo da sua empresa.", errFound: "Escolha uma opção.",
    subject: "Orçamento pelo site da FARLO"
  };

  var steps = [].slice.call(form.querySelectorAll("[data-step]"));
  var send = form.querySelector("[data-orc-send]");
  var nameI = form.querySelector("#o-name");
  var branchI = form.querySelector("#o-branch");
  var otherI = form.querySelector("#o-found-other");

  function checked(sel) { return [].slice.call(form.querySelectorAll(sel + ":checked")); }
  function labelOf(inp) { var l = form.querySelector('label[for="' + inp.id + '"]'); return l ? l.textContent.trim() : inp.value; }
  function foundValue() {
    var r = checked('input[name="found"]')[0];
    if (!r) return "";
    if (r.value === "outro") return otherI.value.trim() ? labelOf(r) + ": " + otherI.value.trim() : labelOf(r);
    return labelOf(r);
  }

  var done = [
    function () { return nameI.value.trim() !== "" && checked('input[name="need"]').length > 0; },
    function () { return branchI.value.trim().length >= 2; },
    function () { return foundValue() !== ""; }
  ];

  function show(el) {
    if (!el.hidden) return;
    el.hidden = false;
    if (!reduce) { el.classList.add("is-entering"); requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove("is-entering"); }); }); }
  }

  /* abre a etapa seguinte quando a atual está completa; nunca fecha uma etapa já aberta */
  function update() {
    for (var i = 0; i < steps.length - 1; i++) { if (done[i]()) show(steps[i + 1]); else break; }
    if (done[0]() && done[1]() && done[2]()) show(send.parentNode);
    otherI.hidden = !(checked('input[name="found"]')[0] && checked('input[name="found"]')[0].value === "outro");
  }

  var branchTimer;
  form.addEventListener("input", function (e) {
    var err = form.querySelector("#" + (e.target.getAttribute("aria-describedby") || "x"));
    if (err) { err.hidden = true; e.target.removeAttribute("aria-invalid"); }
    if (e.target === branchI) { clearTimeout(branchTimer); branchTimer = setTimeout(update, 700); } else update();
  });
  form.addEventListener("change", update);
  branchI.addEventListener("blur", update);
  form.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type === "text") { e.preventDefault(); update(); }
  });

  function fail(inp, errId, msg) {
    var err = form.querySelector("#" + errId);
    if (err) { err.textContent = msg; err.hidden = false; }
    if (inp) { inp.setAttribute("aria-invalid", "true"); inp.focus(); }
    return false;
  }

  function message() {
    var needs = checked('input[name="need"]').map(labelOf);
    var need = needs.length > 1 ? needs.slice(0, -1).join(", ") + T.and + needs[needs.length - 1] : needs[0];
    return T.hello + "\n\n" +
      T.name + ": " + nameI.value.trim() + "\n" +
      T.need + ": " + need + "\n" +
      T.branch + ": " + branchI.value.trim() + "\n" +
      T.found + ": " + foundValue();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!nameI.value.trim()) return fail(nameI, "oe-name", T.errName);
    if (!checked('input[name="need"]').length) return fail(form.querySelector('input[name="need"]'), "oe-need", T.errNeed);
    if (!branchI.value.trim()) return fail(branchI, "oe-branch", T.errBranch);
    if (!foundValue()) return fail(form.querySelector('input[name="found"]'), "oe-found", T.errFound);
    var txt = message();
    var url = wa ? "https://wa.me/" + wa + "?text=" + encodeURIComponent(txt)
                 : "mailto:" + (cfg.email || "contato@farlo.online") + "?subject=" + encodeURIComponent(T.subject) + "&body=" + encodeURIComponent(txt);
    window.open(url, "_blank", "noopener");
  });

  update();
})();
