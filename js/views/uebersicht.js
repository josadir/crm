window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, esc = U.esc;
  const dauer = (min) => `${Math.floor(min / 60)}:${String(Math.round(min) % 60).padStart(2, '0')} h`;

  function render() {
    const d = S.data, h = U.heute(), jahr = h.slice(0, 4);
    const kunden = d.contacts.filter((c) => c.status === 'Kunde').length;
    const interessenten = d.contacts.filter((c) => c.status === 'Interessent').length;
    const offen = S.offeneVorgaenge();
    const vorVertrag = offen.filter((x) => K.VORVERTRAG.includes(x.phase));
    const offenSumme = vorVertrag.reduce((s, x) => s + (Number(x.wert) || 0), 0);
    const aufgaben = S.offeneAufgaben();
    const ueberfaellig = aufgaben.filter((t) => t.faellig && t.faellig < h).length;
    const offeneRe = S.offeneRechnungen(), ueberRe = S.ueberfaelligeRechnungen();
    const gestellt = d.invoices.filter((r) => r.status !== 'Storniert' && String(r.datum).startsWith(jahr)).reduce((s, r) => s + r.netto, 0);
    const bezahlt = d.invoices.filter((r) => r.status === 'Bezahlt' && String(r.bezahltAm).startsWith(jahr)).reduce((s, r) => s + r.netto, 0);
    const inArbeit = d.orders.filter((o) => o.status === 'In Arbeit' || o.status === 'Neu');
    const fertigUnberechnet = d.orders.filter((o) => o.status === 'Fertig');
    const offenZeit = d.times.filter((t) => t.abrechenbar && t.orderId && !t.abgerechnetPositionId);
    const offenZeitWert = offenZeit.reduce((s, t) => { const o = S.auftrag(t.orderId); return s + t.minuten / 60 * (o ? Number(o.stundensatz) || 0 : 0); }, 0);
    const mo = new Date(h + 'T12:00:00'); mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7));
    const wocheMin = S.minutenImZeitraum(U.localDate(mo), h);
    const timer = S.timer();

    const maxSumme = Math.max(1, ...K.VORVERTRAG.map((p) => vorVertrag.filter((x) => x.phase === p).reduce((s, x) => s + (Number(x.wert) || 0), 0)));
    const balken = K.VORVERTRAG.map((p) => {
      const liste = vorVertrag.filter((x) => x.phase === p);
      const summe = liste.reduce((s, x) => s + (Number(x.wert) || 0), 0);
      return `<div class="balken"><span class="name">${esc(p)}</span><span class="spur"><span class="fuellung" style="width:${Math.round(summe / maxSumme * 100)}%"></span></span><span class="wert">${liste.length} · ${U.fmtEur(summe)}</span></div>`;
    }).join('');

    const faellig = [
      ...aufgaben.filter((t) => t.faellig).map((t) => ({ datum: t.faellig, art: 'Aufgabe', text: t.titel, wer: t.contactId ? S.kontaktName(t.contactId) : '', link: t.contactId ? '#/kontakte/' + t.contactId : '#/aufgaben' })),
      ...offen.filter((x) => x.faellig).map((x) => ({ datum: x.faellig, art: 'Vorgang · ' + x.phase, text: (x.naechsterSchritt || 'Nächster Schritt') + ' · ' + x.titel, wer: S.kontaktName(x.contactId), link: '#/kontakte/' + x.contactId })),
      ...offeneRe.map((r) => ({ datum: r.faellig, art: 'Rechnung fällig', text: r.nummer + ' · ' + U.fmtEur(r.brutto), wer: S.kontaktName(r.contactId), link: '#/rechnungen/' + r.id })),
      ...d.orders.filter((o) => o.status !== 'Berechnet' && o.faellig).map((o) => ({ datum: o.faellig, art: 'Auftrag fertig bis', text: o.nummer + ' · ' + o.titel, wer: S.kontaktName(o.contactId), link: '#/auftraege/' + o.id })),
      ...d.quotes.filter((q) => q.status === 'Gesendet' && q.gueltigBis).map((q) => ({ datum: q.gueltigBis, art: 'Angebot läuft ab', text: q.nummer + ' · ' + q.titel, wer: S.kontaktName(q.contactId), link: '#/angebote/' + q.id })),
    ].sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0).slice(0, 14);
    const faelligHtml = faellig.length ? `<ul class="liste">${faellig.map((f) => `
      <li><span class="${U.faelligKlasse(f.datum)}" style="flex:0 0 78px">${U.fmtDatum(f.datum)}</span>
      <span class="dehnen"><a href="${esc(f.link)}">${esc(f.text)}</a><div class="meta">${esc(f.art)}${f.wer ? ' · ' + esc(f.wer) : ''}</div></span></li>`).join('')}</ul>`
      : '<div class="leer">Nichts fällig.</div>';

    const termine = U.sortiere(d.appointments.filter((t) => t.datum >= h && t.datum <= U.inTagen(7)), 'datum');
    const termineHtml = termine.length ? `<ul class="liste">${termine.map((t) => `<li><span style="flex:0 0 78px">${t.datum === h ? '<strong>Heute</strong>' : U.fmtDatum(t.datum)}</span><span class="dehnen"><button class="btn-link" data-action="termin-bearbeiten" data-id="${esc(t.id)}">${esc(t.titel)}</button><div class="meta">${t.von ? esc(t.von) + (t.bis ? '–' + esc(t.bis) : '') + ' · ' : ''}${t.contactId ? esc(S.kontaktName(t.contactId)) : esc(t.kategorie)}${t.ort ? ' · ' + esc(t.ort) : ''}</div></span></li>`).join('')}</ul>` : '<div class="leer">Keine Termine in den nächsten 7 Tagen.</div>';

    const letzte = U.sortiere(d.activities, 'datum', true).slice(0, 6);
    const letzteHtml = letzte.length ? `<ul class="liste zeitstrahl">${letzte.map((a) => `
      <li><span class="meta" style="flex:0 0 100px">${U.fmtZeit(a.datum)}</span>
      <span class="dehnen"><a href="#/historie/${esc(a.contactId)}">${esc(S.kontaktName(a.contactId))}</a> · <span class="badge">${esc(a.typ)}</span><div class="text">${esc(a.betreff ? a.betreff + ': ' + a.text : a.text)}</div></span></li>`).join('')}</ul>`
      : '<div class="leer">Noch keine Gespräche erfasst.</div>';

    const ohneBewegung = d.contacts.filter((c) => c.status === 'Interessent').map((c) => { const a = S.letzteAktivitaet(c.id); return { c, datum: a ? a.datum : c.erstellt }; })
      .filter((x) => x.datum < new Date(Date.now() - 14 * 864e5).toISOString()).sort((a, b) => a.datum < b.datum ? -1 : 1).slice(0, 6);

    return `
      <h1>Übersicht</h1>
      ${timer ? `<div class="hinweis">Timer läuft seit ${U.fmtZeit(timer.start)}${timer.beschreibung ? ': ' + esc(timer.beschreibung) : ''}. <a href="#/zeiten">Zu den Zeiten</a></div>` : ''}
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${U.fmtEur(offenSumme)}</div><div class="titel">Pipeline vor Abschluss · ${vorVertrag.length} Vorgänge</div></div>
        <div class="kachel"><div class="zahl ${ueberRe.length ? 'ueberfaellig' : ''}">${U.fmtEur(offeneRe.reduce((s, r) => s + r.brutto, 0))}</div><div class="titel">${offeneRe.length} offene Rechnungen${ueberRe.length ? ' · ' + ueberRe.length + ' überfällig' : ''}</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(gestellt)}</div><div class="titel">Umsatz ${esc(jahr)} gestellt · ${U.fmtEur(bezahlt)} bezahlt</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(offenZeitWert)}</div><div class="titel">${dauer(offenZeit.reduce((s, t) => s + t.minuten, 0))} nicht abgerechnete Zeit</div></div>
      </div>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${inArbeit.length}</div><div class="titel">Aufträge offen${fertigUnberechnet.length ? ' · <span class="heute">' + fertigUnberechnet.length + ' fertig, nicht berechnet</span>' : ''}</div></div>
        <div class="kachel"><div class="zahl">${dauer(wocheMin)}</div><div class="titel">Zeit diese Woche</div></div>
        <div class="kachel"><div class="zahl ${ueberfaellig ? 'ueberfaellig' : ''}">${aufgaben.length}</div><div class="titel">offene Aufgaben${ueberfaellig ? ' · ' + ueberfaellig + ' überfällig' : ''}</div></div>
        <div class="kachel"><div class="zahl">${d.contacts.length}</div><div class="titel">Kontakte · ${kunden} Kunden, ${interessenten} Interessenten</div></div>
      </div>
      <div class="spalten-2">
        <div>
          <div class="panel"><h3>Fällig</h3>${faelligHtml}</div>
          <div class="panel"><h3>Pipeline vor Abschluss</h3>${vorVertrag.length ? balken : '<div class="leer">Keine offenen Vorgänge.</div>'}</div>
        </div>
        <div>
          <div class="panel"><h3>Nächste 7 Tage</h3>${termineHtml}</div>
          <div class="panel"><h3>Letzte Gespräche</h3>${letzteHtml}</div>
          <div class="panel"><h3>Interessenten ohne Bewegung (über 14 Tage)</h3>
            ${ohneBewegung.length ? `<ul class="liste">${ohneBewegung.map((x) => `<li><span class="dehnen"><a href="#/kontakte/${esc(x.c.id)}">${esc(x.c.firma || x.c.person)}</a><div class="meta">letzte Bewegung ${U.fmtDatum(x.datum)}</div></span></li>`).join('')}</ul>` : '<div class="leer">Alle Interessenten haben aktuelle Aktivitäten.</div>'}
          </div>
        </div>
      </div>`;
  }

  CRM.views.uebersicht = { render };
})(window.CRM);
