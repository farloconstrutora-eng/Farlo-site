/* FARLO — js/orcamento.js: "Monte seu orçamento" na página de contato.
   Formulário em 3 etapas que aparecem uma de cada vez. Campos obrigatórios marcados;
   quando falta algo, o formulário diz o que é. No fim, abre o WhatsApp com a mensagem pronta.
   Nada é enviado pelo site. */
(function () {
  "use strict";
  var form = document.querySelector("[data-orcamento]");
  if (!form) return;

  var en = (document.body.getAttribute("data-lang") || document.documentElement.lang || "pt").indexOf("en") === 0;
  var cfg = (window.FARLO && window.FARLO.config) || {};
  var wa = /^\d{10,15}$/.test(cfg.whatsapp || "") ? cfg.whatsapp : null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var T = en ? {
    and: " and ",
    missing: "To continue, fill in: ",
    err: { name: "Required: write your name.", need: "Required: choose at least one option.", branch: "Required: write your type of business.", found: "Required: choose one option." },
    item: { name: "Name", need: "What you need", branch: "Type of business", found: "How you found FARLO" },
    needs: { "Website": "website", "System": "system", "Automation": "automation" },
    found: { instagram: "an Instagram ad", recomendacao: "a recommendation", google: "a Google search", site: "a website made by FARLO", outro: "another way" },
    msg: function (d) {
      var art = d.onlyAutomation ? "an" : "a";
      return "Hi! I found FARLO through " + d.found + " and I'd like a quote. My name is " + d.name +
        " and I need " + art + " " + d.needs + " for the " + d.branch + " business.";
    },
    subject: "Quote request from the FARLO website"
  } : {
    and: " e ",
    missing: "Para continuar, preencha: ",
    err: { name: "Obrigatório: escreva o seu nome.", need: "Obrigatório: escolha pelo menos uma opção.", branch: "Obrigatório: escreva o ramo da sua empresa.", found: "Obrigatório: escolha uma opção." },
    item: { name: "Nome", need: "O que você precisa", branch: "Ramo da empresa", found: "Como encontrou a FARLO" },
    needs: { "Site": "site", "Sistema": "sistema", "Automação": "automação" },
    found: { instagram: "um anúncio no Instagram", recomendacao: "recomendação", google: "uma pesquisa no Google", site: "um site feito pela FARLO", outro: "outro meio" },
    msg: function (d) {
      var art = d.onlyAutomation ? "uma" : "um";
      return "Olá! Encontrei a FARLO por " + d.found + " e gostaria de fazer um orçamento. Meu nome é " + d.name +
        " e preciso de " + art + " " + d.needs + " para o ramo de " + d.branch + ".";
    },
    subject: "Orçamento pelo site da FARLO"
  };

  var steps = [].slice.call(form.querySelectorAll("[data-step]"));
  var sendBox = form.querySelector("[data-orc-send]").parentNode;
  var falta = form.querySelector("[data-orc-falta]");
  var nameI = form.querySelector("#o-name");
  var branchI = form.querySelector("#o-branch");
  var otherI = form.querySelector("#o-found-other");
  var touched = {};

  function checked(name) { return [].slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')); }
  function labelOf(inp) { var l = form.querySelector('label[for="' + inp.id + '"]'); return l ? l.textContent.trim() : inp.value; }

  /* os quatro itens obrigatórios, na ordem das etapas */
  var items = [
    { key: "name", step: 0, ok: function () { return nameI.value.trim() !== ""; }, el: nameI },
    { key: "need", step: 0, ok: function () { return checked("need").length > 0; }, el: form.querySelector('input[name="need"]') },
    { key: "branch", step: 1, ok: function () { return branchI.value.trim().length >= 2; }, el: branchI },
    { key: "found", step: 2, ok: function () { return checked("found").length > 0; }, el: form.querySelector('input[name="found"]') }
  ];
  function stepOk(i) { return items.every(function (it) { return it.step !== i || it.ok(); }); }

  function show(el) {
    if (!el.hidden) return;
    el.hidden = false;
    if (!reduce) { el.classList.add("is-entering"); requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove("is-entering"); }); }); }
  }

  function setError(it, on) {
    var err = form.querySelector("#oe-" + it.key);
    if (err) { err.textContent = on ? T.err[it.key] : ""; err.hidden = !on; }
    if (it.key === "need" || it.key === "found") {
      var ul = it.el.closest("ul"); if (ul) ul.classList.toggle("is-invalid", on);
    } else if (on) it.el.setAttribute("aria-invalid", "true"); else it.el.removeAttribute("aria-invalid");
  }

  function update() {
    /* abre a etapa seguinte quando a atual está completa; nunca fecha uma etapa já aberta */
    for (var i = 0; i < steps.length - 1; i++) { if (stepOk(i)) show(steps[i + 1]); else break; }
    var allOk = items.every(function (it) { return it.ok(); });
    if (allOk) show(sendBox);
    var f = checked("found")[0];
    otherI.hidden = !(f && f.value === "outro");

    /* mostra o que falta nas etapas abertas: o item é cobrado depois que a pessoa mexeu nele
       ou quando ela já está numa etapa seguinte */
    var lastOpen = 0;
    steps.forEach(function (s, i) { if (!s.hidden) lastOpen = i; });
    var faltando = [];
    items.forEach(function (it) {
      if (it.step > lastOpen) { setError(it, false); return; }
      var cobrar = touched[it.key] || it.step < lastOpen;
      var bad = !it.ok();
      setError(it, bad && cobrar);
      if (bad && cobrar) faltando.push(T.item[it.key]);
    });
    var tocou = Object.keys(touched).length > 0;
    if (faltando.length && tocou) {
      falta.textContent = T.missing + (faltando.length > 1 ? faltando.slice(0, -1).join(", ") + T.and + faltando[faltando.length - 1] : faltando[0]) + ".";
      falta.hidden = false;
    } else { falta.hidden = true; falta.textContent = ""; }
  }

  function keyOf(t) { return t === nameI ? "name" : t === branchI ? "branch" : t.name === "need" ? "need" : t.name === "found" ? "found" : null; }
  var branchTimer;
  form.addEventListener("input", function (e) {
    var k = keyOf(e.target);
    if (e.target === branchI) { clearTimeout(branchTimer); branchTimer = setTimeout(function () { touched.branch = true; update(); }, 700); }
    else { if (k && k !== "name") touched[k] = true; update(); }
  });
  form.addEventListener("change", function (e) { var k = keyOf(e.target); if (k) touched[k] = true; update(); });
  form.addEventListener("focusout", function (e) { var k = keyOf(e.target); if (k === "name" || k === "branch") { touched[k] = true; update(); } });
  form.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type === "text") { e.preventDefault(); var k = keyOf(e.target); if (k) touched[k] = true; update(); }
  });

  function join(list) { return list.length > 1 ? list.slice(0, -1).join(", ") + T.and + list[list.length - 1] : list[0]; }

  function message() {
    var needs = checked("need").map(function (i) { var l = labelOf(i); return T.needs[l] || l.toLowerCase(); });
    var f = checked("found")[0];
    var found = f.value === "outro" && otherI.value.trim() ? otherI.value.trim() : (T.found[f.value] || labelOf(f));
    return T.msg({
      found: found,
      name: nameI.value.trim(),
      needs: join(needs),
      onlyAutomation: needs.length === 1 && checked("need")[0].value === (en ? "Automation" : "Automação"),
      branch: branchI.value.trim()
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    items.forEach(function (it) { touched[it.key] = true; });
    update();
    var first = items.filter(function (it) { return !it.ok(); })[0];
    if (first) { first.el.focus(); return; }
    var txt = message();
    var url = wa ? "https://wa.me/" + wa + "?text=" + encodeURIComponent(txt)
                 : "mailto:" + (cfg.email || "contato@farlo.online") + "?subject=" + encodeURIComponent(T.subject) + "&body=" + encodeURIComponent(txt);
    window.open(url, "_blank", "noopener");
  });

  update();
})();
