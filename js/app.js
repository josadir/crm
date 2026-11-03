// Einstieg: Routing über den Hash, Rendern der Ansichten, zentrale Ereignisbehandlung.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;
  const routen = CRM.views;
  CRM.ui = CRM.ui || { intervall: null };

  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, ...rest] = h.split('/');
    return { name: routen[name] ? name : 'uebersicht', params: rest.map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } }) };
  }

  function render() {
    const r = route();
    if (CRM.ui.intervall) { clearInterval(CRM.ui.intervall); CRM.ui.intervall = null; }
    document.body.classList.remove('druckansicht');
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('aktiv', a.dataset.route === r.name));
    const view = document.getElementById('view');
    const scrollY = window.scrollY;
    try {
      view.innerHTML = routen[r.name].render(r.params);
      if (routen[r.name].mount) routen[r.name].mount(view, r.params);
    } catch (e) {
      view.innerHTML = `<div class="hinweis fehler"><strong>Anzeigefehler:</strong> ${esc(e.message)}</div>`;
      console.error(e);
    }
    window.scrollTo(0, scrollY);
    renderSync();
  }

  function renderSync() {
    const st = CRM.sync.status();
    const box = document.getElementById('syncbox');
    let html = `<span class="punkt ${esc(st.zustand)}"></span>${esc(st.text)}`;
    if (st.zustand === 'konflikt') {
      html += `<button class="btn btn-klein btn-block" data-action="konflikt-remote">GitHub-Stand übernehmen</button>
               <button class="btn btn-klein btn-block" data-action="konflikt-lokal">Browser-Stand hochladen</button>`;
    } else if (st.zustand === 'fehler') {
      html += `<button class="btn btn-klein btn-block" data-action="sync-jetzt">Erneut versuchen</button>`;
    } else if (st.zustand === 'lokal') {
      html += `<div><a href="#/einstellungen" style="color:#fff">GitHub einrichten</a></div>`;
    }
    box.innerHTML = html;
  }

  CRM.actions['konflikt-remote'] = () => { CRM.sync.loeseKonflikt('remote'); render(); };
  CRM.actions['konflikt-lokal'] = () => { CRM.sync.loeseKonflikt('lokal'); render(); };

  // Klicks auf [data-action], Formulare mit [data-submit], Checkboxen mit [data-change]
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    // Links und Buttons innerhalb einer klickbaren Zeile/Karte haben Vorrang
    const inner = e.target.closest('a, button, input, select, textarea, label');
    if (inner && inner !== el && el.contains(inner) && !inner.dataset.action) return;
    const handler = CRM.actions[el.dataset.action];
    if (!handler) return;
    e.preventDefault();
    try { handler(Object.assign({}, el.dataset), el, e); } catch (err) { U.toast(err.message, 'fehler'); console.error(err); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-submit]');
    if (!f) return;
    e.preventDefault();
    const handler = CRM.actions[f.dataset.submit];
    if (!handler) return;
    try { handler(U.formData(f), f, e); } catch (err) { U.toast(err.message, 'fehler'); console.error(err); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const handler = CRM.actions[el.dataset.change];
    if (handler) handler(Object.assign({}, el.dataset), el, e);
  });
  // Strg+Enter in Textfeldern schickt das Formular ab
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target.matches('textarea')) {
      const f = e.target.closest('form');
      if (f) { e.preventDefault(); f.requestSubmit(); }
    }
  });
  document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') U.closeModal(); });

  window.addEventListener('hashchange', render);
  S.on(render);
  CRM.sync.on(renderSync);
  CRM.render = render;

  render();
  CRM.sync.pull();
  if (CRM.auto && CRM.auto.start) CRM.auto.start();
})(window.CRM);
