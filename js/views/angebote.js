window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, B = CRM.belege, esc = U.esc;
  const zustand = { status: '' };

  function liste() {
    const q = U.sortiere(S.data.quotes, 'nummer', true).filter((x) => !zustand.status || x.status === zustand.status);
    const offen = S.data.quotes.filter((x) => x.status === 'Gesendet');
    const offenSumme = offen.reduce((s, x) => s + S.summen(x.positionen, S.data.stammdaten.kleinunternehmer).netto, 0);
    return `
      <h1>Angebote <span class="muted klein">${offen.length} offen · ${U.fmtEur(offenSumme)} netto</span></h1>
      ${B.filterLeiste('angebot-status', K.ANGEBOT_STATUS, zustand.status, `<span class="abstand"></span><button class="btn btn-primary" data-action="angebot-neu">+ Angebot</button>`)}
      <div class="panel">${q.length ? `<table><thead><tr><th>Nummer</th><th>Datum</th><th>Kontakt</th><th>Titel</th><th class="rechts">Netto</th><th>Gültig bis</th><th>Status</th></tr></thead><tbody>
        ${q.map((x) => { const sum = S.summen(x.positionen, S.data.stammdaten.kleinunternehmer); return `<tr class="klickbar" data-action="gehe-zu" data-ziel="#/angebote/${esc(x.id)}"><td><strong>${esc(x.nummer)}</strong></td><td>${U.fmtDatum(x.datum)}</td><td>${esc(S.kontaktName(x.contactId))}</td><td>${esc(x.titel)}</td><td class="rechts">${U.fmtEur(sum.netto)}</td><td class="${x.status === 'Gesendet' ? U.faelligKlasse(x.gueltigBis) : ''}">${U.fmtDatum(x.gueltigBis)}</td><td>${B.badge(x.status)}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="leer">Noch keine Angebote. Ein Angebot entsteht aus einem Vorgang in der Pipeline oder direkt über „+ Angebot".</div>'}</div>`;
  }

  function detail(q) {
    if (!q) return '<h1>Angebot</h1><div class="panel"><div class="leer">Angebot nicht gefunden.</div></div>';
    const s = S.data.stammdaten;
    const sum = S.summen(q.positionen, s.kleinunternehmer);
    const entwurf = q.status === 'Entwurf';
    const c = S.kontakt(q.contactId);
    const aktionen = [];
    if (entwurf) aktionen.push(`<button class="btn" data-action="angebot-bearbeiten" data-id="${esc(q.id)}">Bearbeiten</button>`);
    if (entwurf) aktionen.push(`<button class="btn btn-primary" data-action="angebot-status" data-id="${esc(q.id)}" data-status="Gesendet">Als gesendet markieren</button>`);
    if (q.status === 'Gesendet') aktionen.push(`<button class="btn btn-primary" data-action="angebot-status" data-id="${esc(q.id)}" data-status="Angenommen">Angenommen → Auftrag anlegen</button>`);
    if (q.status === 'Gesendet') aktionen.push(`<button class="btn" data-action="angebot-status" data-id="${esc(q.id)}" data-status="Abgelehnt">Abgelehnt</button>`);
    if (q.status === 'Gesendet') aktionen.push(`<button class="btn" data-action="angebot-status" data-id="${esc(q.id)}" data-status="Abgelaufen">Abgelaufen</button>`);
    aktionen.push(`<button class="btn" data-action="angebot-kopieren" data-id="${esc(q.id)}">Kopieren</button>`);
    aktionen.push(`<button class="btn" data-action="drucken">Drucken / PDF</button>`);
    return `
      <div class="nicht-drucken">
        <div class="detail-kopf">
          <div><h1 style="margin:0">Angebot ${esc(q.nummer)} ${B.badge(q.status)}</h1><div class="muted">${esc(q.titel)} · <a href="#/kontakte/${esc(q.contactId)}">${esc(S.kontaktName(q.contactId))}</a>${q.orderId ? ` · Auftrag <a href="#/auftraege/${esc(q.orderId)}">${esc((S.auftrag(q.orderId) || {}).nummer || '')}</a>` : ''}</div></div>
        </div>
        <div class="toolbar">${aktionen.join('')}<span class="abstand"></span><a class="btn" href="#/angebote">Zur Liste</a></div>
        ${!c || !c.strasse ? '<div class="hinweis">Der Kontakt hat keine vollständige Anschrift. Für den Beleg unter Kontakte → Bearbeiten ergänzen.</div>' : ''}
        <div class="spalten-2" style="grid-template-columns: 1.4fr 1fr">
          <div class="panel">${B.positionenEditor('angebot', q, entwurf)}${B.journal(q.id)}</div>
          <div class="panel"><h3>Vorschau</h3><p class="muted klein">So wird das Angebot gedruckt. Druck über „Drucken / PDF", im Druckdialog „Als PDF speichern" wählen.</p></div>
        </div>
      </div>
      ${B.dokument({ art: 'Angebot', nummer: q.nummer, titel: q.titel, absender: s, empfaenger: c, kopfzeilen: [['Angebotsnummer', q.nummer], ['Datum', U.fmtDatum(q.datum)], ['Gültig bis', U.fmtDatum(q.gueltigBis)], ['Ansprechpartner', s.name]], einleitung: q.einleitung, positionen: q.positionen, sum, kleinunternehmer: s.kleinunternehmer, fuss: s.angebotsFuss, zahlung: q.gueltigBis ? `Dieses Angebot ist gültig bis ${U.fmtDatum(q.gueltigBis)}.` : '' })}`;
  }

  function render(params) { return params[0] ? detail(S.angebot(params[0])) : liste(); }
  function mount(view, params) {
    const sel = view.querySelector('#angebot-status');
    if (sel) sel.addEventListener('change', () => { zustand.status = sel.value; CRM.render(); });
    document.body.classList.toggle('druckansicht', !!params[0]);
  }
  CRM.actions['gehe-zu'] = (d) => { location.hash = d.ziel; };
  CRM.views.angebote = { render, mount };
})(window.CRM);
