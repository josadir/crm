// Historie: komplette Chronik je Kunde (Gespräche, Belege, Termine, Phasenwechsel, erledigte Aufgaben).
window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;
  const zustand = { contactId: '', gruppe: '', suche: '' };

  const FARBE = { Gespräch: 's-Gespraech', Beleg: 's-Beleg', Termin: 's-Termin', Aufgabe: '' };

  function eintrag(e, mitKontakt) {
    const kopf = e.link ? `<a href="${esc(e.link)}"><strong>${esc(e.titel)}</strong></a>` : e.aktion ? `<button class="btn-link" data-action="${esc(e.aktion)}" data-id="${esc(e.id)}"><strong>${esc(e.titel)}</strong></button>` : `<strong>${esc(e.titel)}</strong>`;
    return `<li><span class="meta" style="flex:0 0 110px">${U.fmtZeit(e.datum)}</span>
      <span class="typ" style="flex:0 0 90px"><span class="badge ${FARBE[e.gruppe] || ''}">${esc(e.art)}</span></span>
      <span class="dehnen">${kopf}${mitKontakt ? ` <span class="muted klein">· <a href="#/historie/${esc(e.contactId)}">${esc(S.kontaktName(e.contactId))}</a></span>` : ''}${e.text ? `<div class="text klein">${esc(e.text)}</div>` : ''}</span></li>`;
  }

  function render(params) {
    if (params[0]) zustand.contactId = params[0];
    const kontakte = U.sortiere(S.data.contacts, 'firma');
    const c = zustand.contactId ? S.kontakt(zustand.contactId) : null;
    let eintraege;
    if (c) eintraege = S.historie(c.id).map((e) => Object.assign(e, { contactId: c.id }));
    else eintraege = kontakte.flatMap((k) => S.historie(k.id).map((e) => Object.assign(e, { contactId: k.id }))).sort((a, b) => a.datum < b.datum ? 1 : -1).slice(0, 200);
    if (zustand.gruppe) eintraege = eintraege.filter((e) => e.gruppe === zustand.gruppe);
    if (zustand.suche) { const q = zustand.suche.toLowerCase(); eintraege = eintraege.filter((e) => (e.titel + ' ' + e.text).toLowerCase().includes(q)); }
    const gruppen = {};
    eintraege.forEach((e) => { gruppen[e.gruppe] = (gruppen[e.gruppe] || 0) + 1; });
    // Nach Monat gruppieren
    const monate = {};
    eintraege.forEach((e) => { const m = String(e.datum).slice(0, 7); (monate[m] = monate[m] || []).push(e); });
    const monatsName = (m) => new Date(m + '-01T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return `
      <h1>Historie ${c ? `<span class="muted klein">${esc(c.firma || c.person)}</span>` : '<span class="muted klein">alle Kunden</span>'}</h1>
      <div class="toolbar">
        <select id="historie-kontakt" style="min-width:260px">${U.options(kontakte.map((k) => [k.id, (k.firma || k.person) + (k.firma && k.person ? ' · ' + k.person : '')]), zustand.contactId, 'Alle Kunden (letzte 200 Einträge)')}</select>
        <select id="historie-gruppe">${U.options([['Gespräch', 'Gespräche'], ['Journey', 'Newsletter & Ereignisse'], ['Beleg', 'Belege und Phasen'], ['Termin', 'Termine'], ['Aufgabe', 'Erledigte Aufgaben']], zustand.gruppe, 'Alles')}</select>
        <input type="search" id="historie-suche" placeholder="Im Verlauf suchen …" value="${esc(zustand.suche)}">
        <span class="abstand"></span>
        ${c ? `<a class="btn" href="#/kontakte/${esc(c.id)}">Kontaktakte</a><button class="btn btn-primary" data-action="aktivitaet-neu" data-contact-id="${esc(c.id)}">+ Gespräch erfassen</button>` : '<button class="btn btn-primary" data-action="aktivitaet-neu">+ Gespräch erfassen</button>'}
      </div>
      ${c ? `<div class="kacheln">
        <div class="kachel"><div class="zahl">${gruppen['Gespräch'] || 0}</div><div class="titel">Gespräche und Notizen</div></div>
        <div class="kachel"><div class="zahl">${S.data.invoices.filter((r) => r.contactId === c.id && r.status !== 'Storniert' && r.status !== 'Storno').length}</div><div class="titel">Rechnungen · ${U.fmtEur(S.data.invoices.filter((r) => r.contactId === c.id && r.status === 'Bezahlt').reduce((s, r) => s + r.netto, 0))} bezahlt netto</div></div>
        <div class="kachel"><div class="zahl">${S.data.deals.filter((d) => d.contactId === c.id).length}</div><div class="titel">Vorgänge · ${S.data.deals.filter((d) => d.contactId === c.id && ['Abschluss', 'Nachbereitung', 'Gewonnen'].includes(d.phase)).length} mit Abschluss</div></div>
        <div class="kachel"><div class="zahl">${eintraege.length ? U.fmtDatum(eintraege[0].datum) : '–'}</div><div class="titel">letzter Kontakt</div></div>
      </div>` : ''}
      <div class="panel">${eintraege.length ? Object.keys(monate).sort().reverse().map((m) => `<h3 style="margin-top:12px">${esc(monatsName(m))}</h3><ul class="liste zeitstrahl">${monate[m].map((e) => eintrag(e, !c)).join('')}</ul>`).join('') : '<div class="leer">Noch keine Einträge. Gespräche über „+ Gespräch erfassen" oder in der Kontaktakte eintragen; Belege und Phasenwechsel erscheinen automatisch.</div>'}</div>`;
  }

  function mount(view) {
    view.querySelector('#historie-kontakt').addEventListener('change', (e) => { zustand.contactId = e.target.value; location.hash = '#/historie' + (e.target.value ? '/' + e.target.value : ''); CRM.render(); });
    view.querySelector('#historie-gruppe').addEventListener('change', (e) => { zustand.gruppe = e.target.value; CRM.render(); });
    const s = view.querySelector('#historie-suche');
    s.addEventListener('input', () => { zustand.suche = s.value; const pos = s.selectionStart; CRM.render(); const s2 = document.getElementById('historie-suche'); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } });
  }
  CRM.views.historie = { render, mount };
})(window.CRM);
