window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;
  const zustand = { art: 'woche', anker: U.heute() };
  const dauer = (min) => `${Math.floor(min / 60)}:${String(Math.round(min) % 60).padStart(2, '0')} h`;
  const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  function spanne() {
    const d = new Date(zustand.anker + 'T12:00:00');
    if (zustand.art === 'woche') {
      const mo = new Date(d); mo.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const so = new Date(mo); so.setDate(mo.getDate() + 6);
      return [U.localDate(mo), U.localDate(so), `KW ${kw(mo)} · ${U.fmtDatum(U.localDate(mo))} bis ${U.fmtDatum(U.localDate(so))}`];
    }
    const von = new Date(d.getFullYear(), d.getMonth(), 1), bis = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return [U.localDate(von), U.localDate(bis), von.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })];
  }
  function kw(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const tag = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - tag); const j = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - j) / 864e5 + 1) / 7); }
  function verschiebe(richtung) {
    const d = new Date(zustand.anker + 'T12:00:00');
    if (zustand.art === 'woche') d.setDate(d.getDate() + 7 * richtung); else d.setMonth(d.getMonth() + richtung);
    zustand.anker = U.localDate(d);
  }

  function timerBox() {
    const t = S.timer();
    const auftraege = U.sortiere(S.data.orders.filter((o) => o.status !== 'Berechnet'), 'nummer', true).map((o) => [o.id, o.nummer + ' · ' + o.titel]);
    if (t) {
      const o = S.auftrag(t.orderId);
      return `<div class="panel timer laeuft nicht-drucken"><div><div class="muted klein">Läuft seit ${U.fmtZeit(t.start)}${o ? ' · ' + esc(o.nummer) + ' ' + esc(o.titel) : ' · ohne Auftrag'}</div><div class="timer-zeit" id="timer-anzeige">0:00</div><div>${esc(t.beschreibung || '')}</div></div>
        <div style="display:flex;gap:6px;flex-direction:column"><button class="btn btn-primary" data-action="timer-stop">Stopp und erfassen</button><button class="btn" data-action="timer-verwerfen">Verwerfen</button></div></div>`;
    }
    return `<form class="panel timer nicht-drucken" onsubmit="return false">
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px"><select name="orderId">${U.options(auftraege, '', '– ohne Auftrag –')}</select><input name="beschreibung" placeholder="Woran arbeitest du?" autocomplete="off"></div>
      <button type="button" class="btn btn-primary" data-action="timer-start">▶ Timer starten</button>
    </form>`;
  }

  function render() {
    const [von, bis, titel] = spanne();
    const zeiten = U.sortiere(S.data.times.filter((t) => t.datum >= von && t.datum <= bis), 'datum', true);
    const gesamt = zeiten.reduce((s, t) => s + t.minuten, 0);
    const abrechenbar = zeiten.filter((t) => t.abrechenbar).reduce((s, t) => s + t.minuten, 0);
    const offenAlle = S.data.times.filter((t) => t.abrechenbar && t.orderId && !t.abgerechnetPositionId);
    const offenWert = offenAlle.reduce((s, t) => { const o = S.auftrag(t.orderId); return s + t.minuten / 60 * (o ? Number(o.stundensatz) || 0 : 0); }, 0);
    const proAuftrag = {};
    offenAlle.forEach((t) => { proAuftrag[t.orderId] = (proAuftrag[t.orderId] || 0) + t.minuten; });
    return `
      <h1>Zeiten</h1>
      ${timerBox()}
      <div class="toolbar">
        <select id="zeit-art">${U.options([['woche', 'Woche'], ['monat', 'Monat']], zustand.art)}</select>
        <button class="btn" id="zeit-zurueck">‹</button><strong>${esc(titel)}</strong><button class="btn" id="zeit-vor">›</button><button class="btn btn-klein" id="zeit-heute">Heute</button>
        <span class="abstand"></span>
        <button class="btn" data-action="csv-zeiten">CSV exportieren</button>
        <button class="btn btn-primary" data-action="zeit-neu">+ Zeit</button>
      </div>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${dauer(gesamt)}</div><div class="titel">im Zeitraum · ${dauer(abrechenbar)} abrechenbar</div></div>
        <div class="kachel"><div class="zahl">${dauer(offenAlle.reduce((s, t) => s + t.minuten, 0))}</div><div class="titel">noch nicht abgerechnet (alle Aufträge)</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(offenWert)}</div><div class="titel">Wert der offenen Zeiten</div></div>
      </div>
      <div class="spalten-2" style="grid-template-columns: 1.5fr 1fr">
        <div class="panel">${zeiten.length ? `<table><thead><tr><th>Datum</th><th>Auftrag</th><th>Beschreibung</th><th class="rechts">Dauer</th><th></th></tr></thead><tbody>
          ${zeiten.map((t) => { const o = S.auftrag(t.orderId); return `<tr><td style="white-space:nowrap">${TAGE[new Date(t.datum + 'T12:00:00').getDay()]} ${U.fmtDatum(t.datum)}</td><td>${o ? `<a href="#/auftraege/${esc(o.id)}">${esc(o.nummer)}</a><div class="muted klein">${esc(S.kontaktName(o.contactId))}</div>` : '<span class="muted">–</span>'}</td><td><button class="btn-link" data-action="zeit-bearbeiten" data-id="${esc(t.id)}">${esc(t.beschreibung || '(ohne Beschreibung)')}</button>${!t.abrechenbar ? ' <span class="badge">intern</span>' : t.abgerechnetPositionId ? ' <span class="badge s-Berechnet">abgerechnet</span>' : ''}</td><td class="rechts">${dauer(t.minuten)}</td><td></td></tr>`; }).join('')}
        </tbody></table>` : '<div class="leer">Keine Zeiten in diesem Zeitraum.</div>'}</div>
        <div class="panel"><h3>Offen je Auftrag</h3>${Object.keys(proAuftrag).length ? `<ul class="liste">${Object.entries(proAuftrag).map(([id, min]) => { const o = S.auftrag(id); return o ? `<li><span class="dehnen"><a href="#/auftraege/${esc(o.id)}">${esc(o.nummer)}</a> ${esc(o.titel)}<div class="meta">${esc(S.kontaktName(o.contactId))}</div></span><span class="rechts">${dauer(min)}<div class="meta">${U.fmtEur(min / 60 * (Number(o.stundensatz) || 0))}</div></span></li>` : ''; }).join('')}</ul>` : '<div class="leer klein">Alles abgerechnet.</div>'}</div>
      </div>`;
  }

  function mount(view) {
    view.querySelector('#zeit-art').addEventListener('change', (e) => { zustand.art = e.target.value; CRM.render(); });
    view.querySelector('#zeit-zurueck').addEventListener('click', () => { verschiebe(-1); CRM.render(); });
    view.querySelector('#zeit-vor').addEventListener('click', () => { verschiebe(1); CRM.render(); });
    view.querySelector('#zeit-heute').addEventListener('click', () => { zustand.anker = U.heute(); CRM.render(); });
    const anzeige = view.querySelector('#timer-anzeige');
    if (anzeige) {
      const t = S.timer();
      const tick = () => { const min = Math.floor((Date.now() - new Date(t.start).getTime()) / 60000); const sek = Math.floor((Date.now() - new Date(t.start).getTime()) / 1000) % 60; anzeige.textContent = `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}:${String(sek).padStart(2, '0')}`; };
      tick();
      CRM.ui.intervall = setInterval(tick, 1000);
    }
  }

  CRM.actions['csv-zeiten'] = () => {
    const [von, bis] = spanne();
    const spalten = [{ titel: 'Datum', wert: (t) => U.fmtDatum(t.datum) }, { titel: 'Auftrag', wert: (t) => (S.auftrag(t.orderId) || {}).nummer || '' }, { titel: 'Kunde', wert: (t) => { const o = S.auftrag(t.orderId); return o ? S.kontaktName(o.contactId) : ''; } }, { key: 'beschreibung', titel: 'Beschreibung' }, { titel: 'Minuten', wert: (t) => t.minuten }, { titel: 'Stunden', wert: (t) => (t.minuten / 60).toFixed(2).replace('.', ',') }, { titel: 'Abrechenbar', wert: (t) => t.abrechenbar ? 'ja' : 'nein' }, { titel: 'Abgerechnet', wert: (t) => t.abgerechnetPositionId ? 'ja' : 'nein' }];
    U.download(`zeiten_${von}_${bis}.csv`, CRM.csv.schreibe(spalten, U.sortiere(S.data.times.filter((t) => t.datum >= von && t.datum <= bis), 'datum')), 'text/csv;charset=utf-8');
  };

  CRM.views.zeiten = { render, mount };
})(window.CRM);
