window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, B = CRM.belege, esc = U.esc;
  const zustand = { suche: '', status: '' };

  function gefiltert() {
    const q = zustand.suche.toLowerCase();
    return U.sortiere(S.data.contacts, 'firma').filter((c) => {
      if (zustand.status && c.status !== zustand.status) return false;
      if (!q) return true;
      return [c.firma, c.person, c.email, c.ort, c.branche, c.notizen, c.telefon].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }

  function liste(gewaehltId) {
    const rows = gefiltert();
    if (!rows.length) return '<div class="leer">Keine Kontakte gefunden.</div>';
    return `<table><thead><tr><th>Firma / Person</th><th>Status</th><th>Ort</th><th>Letzter Kontakt</th></tr></thead><tbody>
      ${rows.map((c) => {
        const a = S.letzteAktivitaet(c.id);
        return `<tr class="klickbar ${c.id === gewaehltId ? 'gewaehlt' : ''}" data-action="kontakt-oeffnen" data-id="${esc(c.id)}">
          <td><strong>${esc(c.firma || c.person)}</strong>${c.firma && c.person ? `<div class="muted klein">${esc(c.person)}</div>` : ''}</td>
          <td><span class="badge ${esc(c.status)}">${esc(c.status)}</span></td>
          <td>${esc(c.ort)}</td>
          <td class="klein muted">${a ? U.fmtDatum(a.datum) + ' · ' + esc(a.typ) : '–'}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function detail(c) {
    if (!c) return '<div class="panel"><div class="leer">Kontakt links auswählen oder neu anlegen.</div></div>';
    const vorgaenge = U.sortiere(S.data.deals.filter((d) => d.contactId === c.id), 'geaendert', true);
    const aufgaben = U.sortiere(S.data.tasks.filter((t) => t.contactId === c.id && !t.erledigt), 'faellig');
    const termine = U.sortiere(S.data.appointments.filter((t) => t.contactId === c.id && t.datum >= U.heute()), 'datum');
    const angebote = U.sortiere(S.data.quotes.filter((q) => q.contactId === c.id), 'nummer', true);
    const auftraege = U.sortiere(S.data.orders.filter((o) => o.contactId === c.id), 'nummer', true);
    const rechnungen = U.sortiere(S.data.invoices.filter((r) => r.contactId === c.id), 'nummer', true);
    const historie = S.historie(c.id).slice(0, 12);
    const umsatz = rechnungen.filter((r) => r.status === 'Bezahlt').reduce((s, r) => s + r.netto, 0);
    const offen = rechnungen.filter((r) => r.status === 'Offen').reduce((s, r) => s + r.brutto, 0);
    const link = (url) => { if (!url) return ''; const u = /^https?:\/\//.test(url) ? url : 'https://' + url; return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(url)}</a>`; };
    const adresse = [c.strasse, [c.plz, c.ort].filter(Boolean).join(' '), c.land && c.land !== 'Deutschland' ? c.land : ''].filter(Boolean).join(', ');
    return `
      <div class="panel">
        <div class="detail-kopf">
          <div><h2>${esc(c.firma || c.person)}</h2>${c.firma && c.person ? `<div class="muted">${esc(c.person)}</div>` : ''}</div>
          <span class="badge ${esc(c.status)}">${esc(c.status)}</span>
          <div class="aktionen">
            <a class="btn btn-klein" href="#/historie/${esc(c.id)}">Historie</a>
            <button class="btn btn-klein" data-action="kontakt-bearbeiten" data-id="${esc(c.id)}">Bearbeiten</button>
          </div>
        </div>
        <dl class="daten">
          <dt>E-Mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '–'}</dd>
          <dt>Telefon</dt><dd>${c.telefon ? `<a href="tel:${esc(c.telefon.replace(/\s/g, ''))}">${esc(c.telefon)}</a>` : '–'}</dd>
          <dt>Anschrift</dt><dd>${esc(adresse) || '<span class="ueberfaellig">fehlt (für Belege nötig)</span>'}</dd>
          <dt>Website</dt><dd>${link(c.website) || '–'}</dd>
          <dt>Branche</dt><dd>${esc(c.branche) || '–'}${c.ustId ? ` · USt-IdNr. ${esc(c.ustId)}` : ''}</dd>
          <dt>Quelle</dt><dd>${esc(c.quelle) || '–'}</dd>
          <dt>E-Mail-Werbung</dt><dd>${c.einwilligungEmail ? `<span class="badge Kunde">Einwilligung seit ${U.fmtDatum(c.einwilligungDatum)}</span>` : '<span class="badge">keine Einwilligung</span>'}</dd>
          ${(c.tags || []).length ? `<dt>Schlagwörter</dt><dd>${c.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join(' ')}</dd>` : ''}
          <dt>Umsatz</dt><dd>${U.fmtEur(umsatz)} bezahlt netto${offen ? ` · <span class="ueberfaellig">${U.fmtEur(offen)} offen</span>` : ''}</dd>
        </dl>
        ${c.notizen ? `<h3 style="margin-top:12px">Notizen</h3><div class="zeitstrahl"><div class="text">${esc(c.notizen)}</div></div>` : ''}

        <div class="toolbar" style="margin:14px 0 0">
          <button class="btn btn-klein" data-action="aktivitaet-neu" data-contact-id="${esc(c.id)}">+ Gespräch</button>
          <button class="btn btn-klein" data-action="vorgang-neu" data-contact-id="${esc(c.id)}">+ Vorgang</button>
          <button class="btn btn-klein" data-action="angebot-neu" data-contact-id="${esc(c.id)}">+ Angebot</button>
          <button class="btn btn-klein" data-action="auftrag-neu" data-contact-id="${esc(c.id)}">+ Auftrag</button>
          <button class="btn btn-klein" data-action="termin-neu" data-contact-id="${esc(c.id)}">+ Termin</button>
          <button class="btn btn-klein" data-action="aufgabe-neu" data-contact-id="${esc(c.id)}">+ Aufgabe</button>
        </div>

        ${CRM.journeyUI ? CRM.journeyUI.leiste(c.id) : ''}

        <div class="abschnitt-kopf"><h3>Vorgänge</h3></div>
        ${vorgaenge.length ? `<ul class="liste">${vorgaenge.map((d) => `
          <li><span class="dehnen"><button class="btn-link" data-action="vorgang-bearbeiten" data-id="${esc(d.id)}"><strong>${esc(d.titel)}</strong></button>
            <div class="meta">${d.naechsterSchritt ? esc(d.naechsterSchritt) : ''}${d.faellig ? ` · <span class="${U.faelligKlasse(d.faellig)}">${U.fmtDatum(d.faellig)}</span>` : ''}${d.phase === 'Verloren' && d.verlustgrund ? ' · Grund: ' + esc(d.verlustgrund) : ''}</div></span>
          <span class="badge ${esc(d.phase)}">${esc(d.phase)}</span><span style="flex:0 0 70px" class="rechts">${U.fmtEur(d.wert)}</span></li>`).join('')}</ul>` : '<div class="leer klein">Noch kein Vorgang.</div>'}

        <div class="abschnitt-kopf"><h3>Belege</h3></div>
        ${angebote.length + auftraege.length + rechnungen.length ? `<ul class="liste">
          ${angebote.map((q) => `<li><span class="dehnen"><a href="#/angebote/${esc(q.id)}"><strong>${esc(q.nummer)}</strong></a> ${esc(q.titel)}<div class="meta">Angebot · ${U.fmtDatum(q.datum)}</div></span>${B.badge(q.status)}<span class="rechts" style="flex:0 0 80px">${U.fmtEur(S.summen(q.positionen, S.data.stammdaten.kleinunternehmer).netto)}</span></li>`).join('')}
          ${auftraege.map((o) => `<li><span class="dehnen"><a href="#/auftraege/${esc(o.id)}"><strong>${esc(o.nummer)}</strong></a> ${esc(o.titel)}<div class="meta">Auftrag · ${U.fmtDatum(o.datum)}</div></span>${B.badge(o.status)}<span class="rechts" style="flex:0 0 80px">${U.fmtEur(S.summen(o.positionen, S.data.stammdaten.kleinunternehmer).netto)}</span></li>`).join('')}
          ${rechnungen.map((r) => `<li><span class="dehnen"><a href="#/rechnungen/${esc(r.id)}"><strong>${esc(r.nummer)}</strong></a> ${esc(r.titel)}<div class="meta">Rechnung · ${U.fmtDatum(r.datum)}${r.status === 'Offen' ? ` · fällig <span class="${U.faelligKlasse(r.faellig)}">${U.fmtDatum(r.faellig)}</span>` : ''}</div></span>${B.badge(r.status)}<span class="rechts" style="flex:0 0 80px">${U.fmtEur(r.brutto)}</span></li>`).join('')}
        </ul>` : '<div class="leer klein">Noch keine Belege.</div>'}

        <div class="abschnitt-kopf"><h3>Termine und Aufgaben</h3></div>
        ${termine.length || aufgaben.length ? `<ul class="liste">
          ${termine.map((t) => `<li><span style="flex:0 0 80px">${U.fmtDatum(t.datum)}</span><span class="dehnen"><button class="btn-link" data-action="termin-bearbeiten" data-id="${esc(t.id)}">${esc(t.titel)}</button>${t.von ? ' · ' + esc(t.von) : ''}</span><span class="badge">Termin</span></li>`).join('')}
          ${aufgaben.map((t) => `<li><input type="checkbox" data-change="aufgabe-erledigt" data-id="${esc(t.id)}" aria-label="erledigt"><span class="dehnen"><button class="btn-link" data-action="aufgabe-bearbeiten" data-id="${esc(t.id)}">${esc(t.titel)}</button></span><span class="klein ${U.faelligKlasse(t.faellig)}">${U.fmtDatum(t.faellig)}</span></li>`).join('')}
        </ul>` : '<div class="leer klein">Nichts anstehend.</div>'}

        <div class="abschnitt-kopf"><h3>Gesprächsverlauf</h3><a class="btn btn-klein" href="#/historie/${esc(c.id)}">Komplette Historie</a></div>
        <form class="schnell" data-submit="aktivitaet-speichern">
          <input type="hidden" name="contactId" value="${esc(c.id)}">
          <select name="typ">${U.options(K.AKTIVITAET, 'Gespräch')}</select>
          <textarea name="text" placeholder="Was wurde besprochen, was wurde vereinbart? (Strg+Enter speichert)"></textarea>
          <button type="submit" class="btn">Eintragen</button>
        </form>
        ${historie.length ? `<ul class="liste zeitstrahl">${historie.map((e) => `
          <li><span class="typ"><span class="badge">${esc(e.art)}</span></span>
            <span class="dehnen">${e.link ? `<a href="${esc(e.link)}">${esc(e.titel)}</a>` : e.aktion ? `<button class="btn-link" data-action="${esc(e.aktion)}" data-id="${esc(e.id)}">${esc(e.titel)}</button>` : esc(e.titel)}${e.text ? `<div class="text">${esc(e.text)}</div>` : ''}<div class="meta">${U.fmtZeit(e.datum)}</div></span></li>`).join('')}</ul>` : '<div class="leer klein">Noch keine Einträge.</div>'}
      </div>`;
  }

  function render(params) {
    const id = params[0] || '';
    const c = id ? S.kontakt(id) : null;
    return `
      <h1>Kontakte <span class="muted klein">${S.data.contacts.length}</span></h1>
      <div class="toolbar">
        <input type="search" id="kontakt-suche" placeholder="Suchen (Firma, Person, Ort, Notiz) …" value="${esc(zustand.suche)}" style="min-width:260px">
        <select id="kontakt-status">${U.options(K.STATUS, zustand.status, 'Alle Status')}</select>
        <span class="abstand"></span>
        <button class="btn" data-action="csv-import">CSV importieren</button>
        <button class="btn" data-action="csv-export">CSV exportieren</button>
        <button class="btn btn-primary" data-action="kontakt-neu">+ Kontakt</button>
      </div>
      <div class="kontakte">
        <div class="panel" id="kontakt-liste">${liste(id)}</div>
        <div id="kontakt-detail">${detail(c)}</div>
      </div>`;
  }

  function mount(view, params) {
    const suche = view.querySelector('#kontakt-suche');
    const status = view.querySelector('#kontakt-status');
    const neu = () => { view.querySelector('#kontakt-liste').innerHTML = liste(params[0] || ''); };
    suche.addEventListener('input', () => { zustand.suche = suche.value; neu(); });
    status.addEventListener('change', () => { zustand.status = status.value; neu(); });
    if (zustand.suche) { suche.focus(); suche.setSelectionRange(suche.value.length, suche.value.length); }
  }

  CRM.actions['kontakt-oeffnen'] = (d) => { location.hash = '#/kontakte/' + d.id; };

  CRM.actions['csv-export'] = () => {
    const spalten = [
      { key: 'firma', titel: 'Firma' }, { key: 'person', titel: 'Ansprechpartner' }, { key: 'email', titel: 'E-Mail' },
      { key: 'telefon', titel: 'Telefon' }, { key: 'website', titel: 'Website' }, { key: 'strasse', titel: 'Strasse' }, { key: 'plz', titel: 'PLZ' }, { key: 'ort', titel: 'Ort' }, { key: 'land', titel: 'Land' }, { key: 'ustId', titel: 'UStIdNr' }, { key: 'branche', titel: 'Branche' },
      { key: 'quelle', titel: 'Quelle' }, { key: 'status', titel: 'Status' },
      { titel: 'EinwilligungEmail', wert: (c) => c.einwilligungEmail ? 'ja' : 'nein' }, { key: 'einwilligungDatum', titel: 'EinwilligungSeit' },
      { titel: 'LetzteAktivitaet', wert: (c) => { const a = S.letzteAktivitaet(c.id); return a ? a.datum.slice(0, 10) : ''; } },
      { key: 'notizen', titel: 'Notiz' }, { key: 'erstellt', titel: 'Angelegt' },
    ];
    U.download(`kontakte_${U.heute()}.csv`, CRM.csv.schreibe(spalten, gefiltert()), 'text/csv;charset=utf-8');
  };

  CRM.actions['csv-import'] = async () => {
    const datei = await U.dateiWaehlen('.csv,text/csv');
    if (!datei) return;
    const { kopf, zeilen } = CRM.csv.parse(datei.text);
    if (!zeilen.length) { U.toast('Keine Datenzeilen gefunden', 'fehler'); return; }
    const map = CRM.csv.zuordnung(kopf);
    if (!map.firma && !map.person) { U.toast('Keine Spalte „Firma" oder „Ansprechpartner" erkannt. Spalten: ' + kopf.join(', '), 'fehler'); return; }
    const vorhanden = new Set(S.data.contacts.map((c) => (c.firma + '|' + c.email).toLowerCase()));
    let neu = 0, uebersprungen = 0;
    const statusNorm = (s) => { const t = String(s || '').toLowerCase(); if (t.startsWith('kund')) return 'Kunde'; if (t.startsWith('partner')) return 'Partner'; if (t.startsWith('archiv') || t.startsWith('inaktiv')) return 'Archiv'; return 'Interessent'; };
    const quelleNorm = (s) => K.QUELLEN.find((q) => q.toLowerCase() === String(s || '').toLowerCase()) || (s ? 'Sonstiges' : '');
    const daten = S.data;
    for (const z of zeilen) {
      const f = {};
      for (const [ziel, spalte] of Object.entries(map)) f[ziel] = z[spalte] || '';
      if (!f.firma && !f.person) { uebersprungen++; continue; }
      const key = (f.firma + '|' + f.email).toLowerCase();
      if (vorhanden.has(key)) { uebersprungen++; continue; }
      vorhanden.add(key);
      f.status = statusNorm(f.status);
      f.quelle = quelleNorm(f.quelle);
      daten.contacts.push(Object.assign({ id: U.uid(), firma: '', person: '', email: '', telefon: '', website: '', strasse: '', plz: '', ort: '', land: 'Deutschland', ustId: '', branche: '', quelle: '', status: 'Interessent', einwilligungEmail: false, einwilligungDatum: '', notizen: '', erstellt: U.nowIso(), geaendert: U.nowIso() }, f));
      neu++;
    }
    S.commit(`CSV-Import ${datei.name}: ${neu} neue Kontakte`);
    U.toast(`${neu} Kontakte importiert, ${uebersprungen} übersprungen (leer oder Dublette)`, 'ok');
  };

  CRM.views.kontakte = { render, mount };
})(window.CRM);
