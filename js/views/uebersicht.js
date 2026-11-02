window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, esc = U.esc;

  function render() {
    const d = S.data;
    const kunden = d.contacts.filter((c) => c.status === 'Kunde').length;
    const interessenten = d.contacts.filter((c) => c.status === 'Interessent').length;
    const offen = S.offeneVorgaenge();
    const offenSumme = offen.reduce((s, x) => s + (Number(x.wert) || 0), 0);
    const jahr = U.heute().slice(0, 4);
    const gewonnen = d.deals.filter((x) => x.phase === 'Gewonnen' && String(x.geschlossen).startsWith(jahr));
    const gewonnenSumme = gewonnen.reduce((s, x) => s + (Number(x.wert) || 0), 0);
    const aufgaben = S.offeneAufgaben();
    const ueberfaellig = aufgaben.filter((t) => t.faellig && t.faellig < U.heute()).length;

    const maxSumme = Math.max(1, ...K.OFFEN.map((p) => offen.filter((x) => x.phase === p).reduce((s, x) => s + (Number(x.wert) || 0), 0)));
    const balken = K.OFFEN.map((p) => {
      const liste = offen.filter((x) => x.phase === p);
      const summe = liste.reduce((s, x) => s + (Number(x.wert) || 0), 0);
      return `<div class="balken"><span class="name">${esc(p)}</span><span class="spur"><span class="fuellung" style="width:${Math.round(summe / maxSumme * 100)}%"></span></span><span class="wert">${liste.length} · ${U.fmtEur(summe)}</span></div>`;
    }).join('');

    // Fällig: offene Aufgaben mit Datum + nächste Schritte offener Vorgänge
    const faellig = [
      ...aufgaben.filter((t) => t.faellig).map((t) => ({ datum: t.faellig, art: 'Aufgabe', text: t.titel, wer: t.contactId ? S.kontaktName(t.contactId) : '', link: t.contactId ? '#/kontakte/' + t.contactId : '#/aufgaben' })),
      ...offen.filter((x) => x.faellig).map((x) => ({ datum: x.faellig, art: 'Vorgang', text: (x.naechsterSchritt || 'Nächster Schritt') + ' · ' + x.titel, wer: S.kontaktName(x.contactId), link: '#/kontakte/' + x.contactId })),
    ].sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0).slice(0, 12);
    const faelligHtml = faellig.length ? `<ul class="liste">${faellig.map((f) => `
      <li><span class="${U.faelligKlasse(f.datum)}" style="flex:0 0 78px">${U.fmtDatum(f.datum)}</span>
      <span class="dehnen"><a href="${esc(f.link)}">${esc(f.text)}</a><div class="meta">${esc(f.art)}${f.wer ? ' · ' + esc(f.wer) : ''}</div></span></li>`).join('')}</ul>`
      : '<div class="leer">Nichts fällig. Aufgaben oder nächste Schritte mit Datum erscheinen hier.</div>';

    const letzte = U.sortiere(d.activities, 'datum', true).slice(0, 8);
    const letzteHtml = letzte.length ? `<ul class="liste zeitstrahl">${letzte.map((a) => `
      <li><span class="meta" style="flex:0 0 100px">${U.fmtZeit(a.datum)}</span>
      <span class="dehnen"><a href="#/kontakte/${esc(a.contactId)}">${esc(S.kontaktName(a.contactId))}</a> · <span class="badge">${esc(a.typ)}</span><div class="text">${esc(a.text)}</div></span></li>`).join('')}</ul>`
      : '<div class="leer">Noch keine Aktivitäten erfasst.</div>';

    const ohneBewegung = d.contacts.filter((c) => c.status === 'Interessent').map((c) => {
      const a = S.letzteAktivitaet(c.id);
      return { c, datum: a ? a.datum : c.erstellt };
    }).filter((x) => x.datum < new Date(Date.now() - 14 * 864e5).toISOString()).sort((a, b) => a.datum < b.datum ? -1 : 1).slice(0, 6);

    return `
      <h1>Übersicht</h1>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${d.contacts.length}</div><div class="titel">Kontakte · ${kunden} Kunden, ${interessenten} Interessenten</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(offenSumme)}</div><div class="titel">${offen.length} offene Vorgänge</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(gewonnenSumme)}</div><div class="titel">gewonnen ${esc(jahr)} · ${gewonnen.length} Abschlüsse</div></div>
        <div class="kachel"><div class="zahl ${ueberfaellig ? 'ueberfaellig' : ''}">${aufgaben.length}</div><div class="titel">offene Aufgaben${ueberfaellig ? ' · ' + ueberfaellig + ' überfällig' : ''}</div></div>
      </div>
      <div class="spalten-2">
        <div>
          <div class="panel"><h3>Fällig</h3>${faelligHtml}</div>
          <div class="panel"><h3>Pipeline nach Phase</h3>${offen.length ? balken : '<div class="leer">Keine offenen Vorgänge.</div>'}</div>
        </div>
        <div>
          <div class="panel"><h3>Zuletzt passiert</h3>${letzteHtml}</div>
          <div class="panel"><h3>Interessenten ohne Bewegung (über 14 Tage)</h3>
            ${ohneBewegung.length ? `<ul class="liste">${ohneBewegung.map((x) => `<li><span class="dehnen"><a href="#/kontakte/${esc(x.c.id)}">${esc(x.c.firma || x.c.person)}</a><div class="meta">letzte Bewegung ${U.fmtDatum(x.datum)}</div></span></li>`).join('')}</ul>` : '<div class="leer">Alle Interessenten haben aktuelle Aktivitäten.</div>'}
          </div>
        </div>
      </div>`;
  }

  CRM.views.uebersicht = { render };
})(window.CRM);
