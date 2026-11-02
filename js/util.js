// Kleine Helfer: Escaping, IDs, Datum, Geld, Modal, Toast, Download.
window.CRM = window.CRM || {};
(function (CRM) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const uid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const nowIso = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const heute = () => localDate(new Date());
  const inTagen = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };

  const fmtDatum = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return (y && m && d) ? `${d}.${m}.${y}` : String(iso);
  };
  const fmtZeit = (iso) => iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const fmtEur = (n) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  // Klasse für Fälligkeit: ueberfaellig / heute / leer
  function faelligKlasse(datum) {
    if (!datum) return '';
    const h = heute();
    if (datum < h) return 'ueberfaellig';
    if (datum === h) return 'heute';
    return '';
  }

  let toastTimer = null;
  function toast(msg, art) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + (art || '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, art === 'fehler' ? 6000 : 3000);
  }

  function modal(html, onOpen) {
    const dlg = document.getElementById('modal');
    document.getElementById('modal-body').innerHTML = html;
    if (!dlg.open) dlg.showModal();
    const erstes = dlg.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
    if (erstes) erstes.focus();
    if (onOpen) onOpen(dlg);
    return dlg;
  }
  function closeModal() {
    const dlg = document.getElementById('modal');
    if (dlg.open) dlg.close();
    document.getElementById('modal-body').innerHTML = '';
  }

  // Formular zu Objekt; Checkboxen immer als boolean, Zahlenfelder als Number
  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    form.querySelectorAll('input[type=checkbox][name]').forEach((cb) => { o[cb.name] = cb.checked; });
    form.querySelectorAll('input[type=number][name]').forEach((inp) => { o[inp.name] = inp.value === '' ? 0 : Number(inp.value); });
    return o;
  }

  // <option>-Liste; `leer` fügt eine leere Option mit Beschriftung voran
  function options(liste, gewaehlt, leer) {
    let html = leer !== undefined ? `<option value="">${esc(leer)}</option>` : '';
    for (const eintrag of liste) {
      const [wert, text] = Array.isArray(eintrag) ? eintrag : [eintrag, eintrag];
      html += `<option value="${esc(wert)}"${String(wert) === String(gewaehlt ?? '') ? ' selected' : ''}>${esc(text)}</option>`;
    }
    return html;
  }

  function download(name, inhalt, typ) {
    const blob = new Blob([inhalt], { type: typ || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  // Datei vom Rechner lesen (Text)
  function dateiWaehlen(accept) {
    return new Promise((resolve) => {
      const inp = document.getElementById('datei-import');
      inp.accept = accept || '';
      inp.value = '';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, text: String(r.result) });
        r.readAsText(f, 'utf-8');
      };
      inp.click();
    });
  }

  const sortiere = (arr, key, absteigend) => [...arr].sort((a, b) => {
    const x = (a[key] ?? ''), y = (b[key] ?? '');
    const r = x < y ? -1 : x > y ? 1 : 0;
    return absteigend ? -r : r;
  });

  CRM.util = { esc, uid, nowIso, heute, inTagen, localDate, fmtDatum, fmtZeit, fmtEur, faelligKlasse, toast, modal, closeModal, formData, options, download, dateiWaehlen, sortiere };
})(window.CRM);
