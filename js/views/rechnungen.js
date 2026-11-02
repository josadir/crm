window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, B = CRM.belege, esc = U.esc;
  const zustand = { filter: 'offen' };

  function liste() {
    const h = U.heute();
    const alle = U.sortiere(S.data.invoices, 'nummer', true);
    const offen = S.offeneRechnungen(), ueber = S.ueberfaelligeRechnungen();
    const jahr = h.slice(0, 4);
    const bezahltJahr = S.data.invoices.filter((r) => r.status === 'Bezahlt' && String(r.bezahltAm).startsWith(jahr)).reduce((s, r) => s + r.netto, 0);
    const gestelltJahr = S.data.invoices.filter((r) => r.status !== 'Storniert' && String(r.datum).startsWith(jahr)).reduce((s, r) => s + r.netto, 0);
    const zeilen = alle.filter((r) => zustand.filter === 'alle' || (zustand.filter === 'offen' && r.status === 'Offen') || (zustand.filter === 'ueberfaellig' && r.status === 'Offen' && r.faellig < h) || (zustand.filter === 'bezahlt' && r.status === 'Bezahlt') || (zustand.filter === 'storno' && (r.status === 'Storniert' || r.status === 'Storno')));
    return `
      <h1>Rechnungen</h1>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${U.fmtEur(offen.reduce((s, r) => s + r.brutto, 0))}</div><div class="titel">${offen.length} offene Rechnungen (brutto)</div></div>
        <div class="kachel"><div class="zahl ${ueber.length ? 'ueberfaellig' : ''}">${U.fmtEur(ueber.reduce((s, r) => s + r.brutto, 0))}</div><div class="titel">${ueber.length} überfällig</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(gestelltJahr)}</div><div class="titel">gestellt ${esc(jahr)} (netto)</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(bezahltJahr)}</div><div class="titel">bezahlt ${esc(jahr)} (netto)</div></div>
      </div>
      <div class="toolbar">
        <select id="rechnung-filter">${U.options([['offen', 'Offen'], ['ueberfaellig', 'Überfällig'], ['bezahlt', 'Bezahlt'], ['storno', 'Storniert / Storno'], ['alle', 'Alle']], zustand.filter)}</select>
        <span class="abstand"></span>
        <button class="btn" data-action="csv-rechnungen">CSV exportieren</button>
        <button class="btn btn-primary" data-action="rechnung-schnell">Schnellrechnung</button>
      </div>
      <div class="panel">${zeilen.length ? `<table><thead><tr><th>Nummer</th><th>Datum</th><th>Kontakt</th><th>Titel</th><th class="rechts">Brutto</th><th>Fällig</th><th>Status</th></tr></thead><tbody>
        ${zeilen.map((r) => `<tr class="klickbar" data-action="gehe-zu" data-ziel="#/rechnungen/${esc(r.id)}"><td><strong>${esc(r.nummer)}</strong></td><td>${U.fmtDatum(r.datum)}</td><td>${esc(S.kontaktName(r.contactId))}</td><td>${esc(r.titel)}</td><td class="rechts">${U.fmtEur(r.brutto)}</td><td class="${r.status === 'Offen' ? U.faelligKlasse(r.faellig) : ''}">${r.status === 'Offen' || r.status === 'Bezahlt' ? U.fmtDatum(r.faellig) : ''}</td><td>${B.badge(r.status)}${r.mahnungen && r.mahnungen.length ? ` <span class="badge">${esc(K.MAHNSTUFEN[r.mahnungen.length - 1])}</span>` : ''}</td></tr>`).join('')}
      </tbody></table>` : '<div class="leer">Keine Rechnungen in dieser Auswahl. Rechnungen entstehen aus Aufträgen (Auftrag → „Rechnung stellen") oder per Schnellrechnung.</div>'}</div>`;
  }

  function detail(r) {
    if (!r) return '<h1>Rechnung</h1><div class="panel"><div class="leer">Rechnung nicht gefunden.</div></div>';
    const a = r.absender || {};
    const aktionen = [];
    if (r.status === 'Offen') {
      aktionen.push(`<button class="btn btn-primary" data-action="rechnung-bezahlt" data-id="${esc(r.id)}">Zahlung erfassen</button>`);
      if (r.mahnungen.length < K.MAHNSTUFEN.length) aktionen.push(`<button class="btn" data-action="rechnung-mahnen" data-id="${esc(r.id)}">${esc(K.MAHNSTUFEN[r.mahnungen.length])} eintragen</button>`);
    }
    if (r.status === 'Bezahlt') aktionen.push(`<button class="btn" data-action="rechnung-bezahlt-zurueck" data-id="${esc(r.id)}">Zahlung zurücknehmen</button>`);
    if (r.status === 'Offen' || r.status === 'Bezahlt') aktionen.push(`<button class="btn btn-gefahr" data-action="rechnung-storno" data-id="${esc(r.id)}">Stornieren</button>`);
    aktionen.push(`<button class="btn" data-action="drucken">Drucken / PDF</button>`);
    const zahlung = r.status === 'Storno' ? `Dieser Beleg storniert die Rechnung ${r.stornoVon} vollständig.`
      : r.kleinunternehmer ? `Zahlbar bis ${U.fmtDatum(r.faellig)} ohne Abzug.` : `Zahlbar bis ${U.fmtDatum(r.faellig)} ohne Abzug${a.iban ? ' auf das unten genannte Konto' : ''}. Bitte geben Sie die Rechnungsnummer ${r.nummer} als Verwendungszweck an.`;
    const leistung = r.leistungVon && r.leistungBis && r.leistungVon !== r.leistungBis ? `${U.fmtDatum(r.leistungVon)} bis ${U.fmtDatum(r.leistungBis)}` : U.fmtDatum(r.leistungVon || r.leistungBis || r.datum);
    return `
      <div class="nicht-drucken">
        <div class="detail-kopf">
          <div><h1 style="margin:0">${r.status === 'Storno' ? 'Storno-Beleg' : 'Rechnung'} ${esc(r.nummer)} ${B.badge(r.status)}</h1>
          <div class="muted">${esc(r.titel)} · <a href="#/kontakte/${esc(r.contactId)}">${esc(S.kontaktName(r.contactId))}</a>${r.orderId && S.auftrag(r.orderId) ? ` · Auftrag <a href="#/auftraege/${esc(r.orderId)}">${esc(S.auftrag(r.orderId).nummer)}</a>` : ''}${r.stornoId ? ` · storniert durch <a href="#/rechnungen/${esc(r.stornoId)}">${esc((S.rechnung(r.stornoId) || {}).nummer || '')}</a>` : ''}</div></div>
        </div>
        <div class="toolbar">${aktionen.join('')}<span class="abstand"></span><a class="btn" href="#/rechnungen">Zur Liste</a></div>
        <div class="kacheln">
          <div class="kachel"><div class="zahl">${U.fmtEur(r.brutto)}</div><div class="titel">brutto · ${U.fmtEur(r.netto)} netto</div></div>
          <div class="kachel"><div class="zahl ${r.status === 'Offen' ? U.faelligKlasse(r.faellig) : ''}">${U.fmtDatum(r.faellig)}</div><div class="titel">fällig (${r.zahlungszielTage} Tage)</div></div>
          <div class="kachel"><div class="zahl">${r.bezahltAm ? U.fmtDatum(r.bezahltAm) : '–'}</div><div class="titel">${r.bezahltAm ? 'bezahlt · ' + esc(r.zahlungsart) : 'noch nicht bezahlt'}</div></div>
          <div class="kachel"><div class="zahl">${r.mahnungen.length}</div><div class="titel">${r.mahnungen.length ? esc(K.MAHNSTUFEN[r.mahnungen.length - 1]) + ' am ' + U.fmtDatum(r.mahnungen[r.mahnungen.length - 1].datum) : 'keine Mahnung'}</div></div>
        </div>
        <div class="panel">${B.journal(r.id)}</div>
      </div>
      ${B.dokument({ art: r.status === 'Storno' ? 'Stornorechnung' : 'Rechnung', nummer: r.nummer, titel: r.titel, absender: a, empfaenger: r.empfaenger, kopfzeilen: [['Rechnungsnummer', r.nummer], ['Rechnungsdatum', U.fmtDatum(r.datum)], ['Leistungsdatum', leistung], r.stornoVon ? ['Storno zu', r.stornoVon] : ['Fällig am', U.fmtDatum(r.faellig)], r.orderId && S.auftrag(r.orderId) ? ['Auftrag', S.auftrag(r.orderId).nummer] : ['', '']], hinweis: r.hinweis, einleitung: r.status === 'Storno' ? '' : 'für die erbrachten Leistungen berechne ich wie folgt:', positionen: r.positionen, sum: { netto: r.netto, steuer: r.steuer, brutto: r.brutto, saetze: r.saetze }, kleinunternehmer: r.kleinunternehmer, zahlung, fuss: r.status === 'Storno' ? '' : r.fuss })}`;
  }

  CRM.actions['csv-rechnungen'] = () => {
    const z = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
    const spalten = [{ key: 'nummer', titel: 'Nummer' }, { titel: 'Datum', wert: (r) => U.fmtDatum(r.datum) }, { titel: 'Kunde', wert: (r) => S.kontaktName(r.contactId) }, { key: 'titel', titel: 'Titel' },
      { titel: 'Netto', wert: (r) => z(r.netto) }, { titel: 'USt', wert: (r) => z(r.steuer) }, { titel: 'Brutto', wert: (r) => z(r.brutto) }, { titel: 'Faellig', wert: (r) => U.fmtDatum(r.faellig) }, { key: 'status', titel: 'Status' }, { titel: 'BezahltAm', wert: (r) => U.fmtDatum(r.bezahltAm) }, { key: 'zahlungsart', titel: 'Zahlungsart' }, { titel: 'Mahnstufe', wert: (r) => r.mahnungen.length }, { key: 'stornoVon', titel: 'StornoZu' }];
    U.download(`rechnungen_${U.heute()}.csv`, CRM.csv.schreibe(spalten, U.sortiere(S.data.invoices, 'nummer')), 'text/csv;charset=utf-8');
  };

  function render(params) { return params[0] ? detail(S.rechnung(params[0])) : liste(); }
  function mount(view, params) {
    const sel = view.querySelector('#rechnung-filter');
    if (sel) sel.addEventListener('change', () => { zustand.filter = sel.value; CRM.render(); });
    document.body.classList.toggle('druckansicht', !!params[0]);
  }
  CRM.views.rechnungen = { render, mount };
})(window.CRM);
