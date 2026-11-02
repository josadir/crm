window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, B = CRM.belege, esc = U.esc;
  const zustand = { status: '' };
  const dauer = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`;

  function liste() {
    const o = U.sortiere(S.data.orders, 'nummer', true).filter((x) => !zustand.status || x.status === zustand.status);
    const aktiv = S.data.orders.filter((x) => x.status !== 'Berechnet');
    return `
      <h1>Aufträge <span class="muted klein">${aktiv.length} offen</span></h1>
      ${B.filterLeiste('auftrag-status', K.AUFTRAG_STATUS, zustand.status, `<span class="abstand"></span><button class="btn btn-primary" data-action="auftrag-neu">+ Auftrag</button>`)}
      <div class="panel">${o.length ? `<table><thead><tr><th>Nummer</th><th>Kontakt</th><th>Titel</th><th class="rechts">Positionen netto</th><th class="rechts">Zeit offen</th><th>Fällig</th><th>Status</th></tr></thead><tbody>
        ${o.map((x) => { const sum = S.summen(x.positionen, S.data.stammdaten.kleinunternehmer); const offen = S.unabgerechneteZeiten(x.id).reduce((s, t) => s + t.minuten, 0); return `<tr class="klickbar" data-action="gehe-zu" data-ziel="#/auftraege/${esc(x.id)}"><td><strong>${esc(x.nummer)}</strong></td><td>${esc(S.kontaktName(x.contactId))}</td><td>${esc(x.titel)}</td><td class="rechts">${U.fmtEur(sum.netto)}</td><td class="rechts">${offen ? dauer(offen) : '–'}</td><td class="${x.status !== 'Berechnet' ? U.faelligKlasse(x.faellig) : ''}">${U.fmtDatum(x.faellig)}</td><td>${B.badge(x.status)}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="leer">Noch keine Aufträge. Ein Auftrag entsteht aus einem angenommenen Angebot oder direkt über „+ Auftrag".</div>'}</div>`;
  }

  function detail(o) {
    if (!o) return '<h1>Auftrag</h1><div class="panel"><div class="leer">Auftrag nicht gefunden.</div></div>';
    const s = S.data.stammdaten;
    const sum = S.summen(o.positionen, s.kleinunternehmer);
    const editierbar = o.status !== 'Berechnet';
    const zeiten = U.sortiere(S.data.times.filter((t) => t.orderId === o.id), 'datum', true);
    const minutenGesamt = zeiten.reduce((a, t) => a + t.minuten, 0);
    const offen = S.unabgerechneteZeiten(o.id);
    const offenMin = offen.reduce((a, t) => a + t.minuten, 0);
    const rechnungen = S.data.invoices.filter((r) => r.orderId === o.id);
    const aufgaben = S.data.tasks.filter((t) => t.orderId === o.id && !t.erledigt);
    const termine = S.data.appointments.filter((t) => t.orderId === o.id && t.datum >= U.heute());
    const ausgaben = S.data.expenses.filter((a) => a.orderId === o.id);
    const statusKnopf = (st, text) => o.status === st ? `<span class="badge s-${esc(st.replace(/\s/g, '-'))}">${esc(st)}</span>` : `<button class="btn btn-klein" data-action="auftrag-status" data-id="${esc(o.id)}" data-status="${esc(st)}">${esc(text || st)}</button>`;
    return `
      <div class="detail-kopf">
        <div><h1 style="margin:0">Auftrag ${esc(o.nummer)} ${B.badge(o.status)}</h1><div class="muted">${esc(o.titel)} · <a href="#/kontakte/${esc(o.contactId)}">${esc(S.kontaktName(o.contactId))}</a>${o.quoteId && S.angebot(o.quoteId) ? ` · aus Angebot <a href="#/angebote/${esc(o.quoteId)}">${esc(S.angebot(o.quoteId).nummer)}</a>` : ''}</div></div>
      </div>
      <div class="toolbar">
        <span class="muted klein">Status:</span> ${statusKnopf('Neu')} ${statusKnopf('In Arbeit')} ${statusKnopf('Fertig')} ${o.status === 'Berechnet' ? B.badge('Berechnet') : ''}
        <span class="abstand"></span>
        <button class="btn" data-action="auftrag-bearbeiten" data-id="${esc(o.id)}">Bearbeiten</button>
        ${editierbar ? `<button class="btn btn-primary" data-action="rechnung-erstellen" data-order-id="${esc(o.id)}">Rechnung stellen</button>` : ''}
        <a class="btn" href="#/auftraege">Zur Liste</a>
      </div>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${U.fmtEur(sum.netto)}</div><div class="titel">Positionen netto${o.budget ? ' · Budget ' + U.fmtEur(o.budget) : ''}</div></div>
        <div class="kachel"><div class="zahl">${dauer(minutenGesamt)}</div><div class="titel">Zeit gesamt · ${dauer(offenMin)} offen</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(offenMin / 60 * (Number(o.stundensatz) || 0))}</div><div class="titel">offene Zeiten zu ${U.fmtEur(o.stundensatz)}/Std</div></div>
        <div class="kachel"><div class="zahl ${U.faelligKlasse(o.status !== 'Berechnet' ? o.faellig : '')}">${o.faellig ? U.fmtDatum(o.faellig) : '–'}</div><div class="titel">Fertigstellung${o.fertigAm ? ' · fertig am ' + U.fmtDatum(o.fertigAm) : ''}</div></div>
      </div>
      <div class="spalten-2" style="grid-template-columns: 1.4fr 1fr">
        <div>
          <div class="panel">
            ${o.beschreibung ? `<div class="text" style="margin-bottom:10px">${esc(o.beschreibung)}</div>` : ''}
            ${B.positionenEditor('auftrag', o, editierbar)}
            ${o.notizen ? `<h3 style="margin-top:14px">Interne Notizen</h3><div class="text muted">${esc(o.notizen)}</div>` : ''}
          </div>
          <div class="panel">
            <div class="abschnitt-kopf" style="margin-top:0"><h3>Zeiten</h3>
              ${editierbar && offen.length ? `<button class="btn btn-klein" data-action="zeiten-abrechnen" data-id="${esc(o.id)}">${offen.length} Einträge (${dauer(offenMin)}) als Position übernehmen</button>` : ''}
              <button class="btn btn-klein btn-primary" data-action="zeit-neu" data-order-id="${esc(o.id)}" ${editierbar ? '' : 'disabled'}>+ Zeit</button></div>
            ${zeiten.length ? `<ul class="liste">${zeiten.slice(0, 30).map((t) => `<li><span style="flex:0 0 80px">${U.fmtDatum(t.datum)}</span><span class="dehnen"><button class="btn-link" data-action="zeit-bearbeiten" data-id="${esc(t.id)}">${esc(t.beschreibung || '(ohne Beschreibung)')}</button>${!t.abrechenbar ? ' <span class="badge">nicht abrechenbar</span>' : t.abgerechnetPositionId ? ' <span class="badge s-Berechnet">abgerechnet</span>' : ''}</span><span class="rechts" style="flex:0 0 60px">${dauer(t.minuten)}</span></li>`).join('')}</ul>` : '<div class="leer klein">Noch keine Zeiten auf diesem Auftrag.</div>'}
          </div>
        </div>
        <div>
          <div class="panel">
            <h3>Rechnungen</h3>
            ${rechnungen.length ? `<ul class="liste">${rechnungen.map((r) => `<li><span class="dehnen"><a href="#/rechnungen/${esc(r.id)}"><strong>${esc(r.nummer)}</strong></a> · ${U.fmtDatum(r.datum)}</span>${B.badge(r.status)}<span class="rechts" style="flex:0 0 90px">${U.fmtEur(r.brutto)}</span></li>`).join('')}</ul>` : '<div class="leer klein">Noch keine Rechnung.</div>'}
            ${ausgaben.length ? `<h3 style="margin-top:14px">Zugeordnete Ausgaben</h3><ul class="liste">${ausgaben.map((a) => `<li><span class="dehnen">${esc(a.lieferant)} · ${esc(a.beschreibung)}</span><span class="rechts">${U.fmtEur(a.brutto)}</span></li>`).join('')}</ul>` : ''}
          </div>
          <div class="panel">
            <div class="abschnitt-kopf" style="margin-top:0"><h3>Aufgaben</h3><button class="btn btn-klein" data-action="aufgabe-neu" data-order-id="${esc(o.id)}" data-contact-id="${esc(o.contactId)}">+ Aufgabe</button></div>
            ${aufgaben.length ? `<ul class="liste">${aufgaben.map((t) => `<li><input type="checkbox" data-change="aufgabe-erledigt" data-id="${esc(t.id)}" aria-label="erledigt"><span class="dehnen"><button class="btn-link" data-action="aufgabe-bearbeiten" data-id="${esc(t.id)}">${esc(t.titel)}</button></span><span class="klein ${U.faelligKlasse(t.faellig)}">${U.fmtDatum(t.faellig)}</span></li>`).join('')}</ul>` : '<div class="leer klein">Keine offenen Aufgaben.</div>'}
            <div class="abschnitt-kopf"><h3>Termine</h3><button class="btn btn-klein" data-action="termin-neu" data-order-id="${esc(o.id)}" data-contact-id="${esc(o.contactId)}">+ Termin</button></div>
            ${termine.length ? `<ul class="liste">${termine.map((t) => `<li><span style="flex:0 0 80px">${U.fmtDatum(t.datum)}</span><span class="dehnen"><button class="btn-link" data-action="termin-bearbeiten" data-id="${esc(t.id)}">${esc(t.titel)}</button>${t.von ? ' · ' + esc(t.von) : ''}</span></li>`).join('')}</ul>` : '<div class="leer klein">Keine anstehenden Termine.</div>'}
          </div>
          <div class="panel">${B.journal(o.id) || '<div class="leer klein">Kein Verlauf.</div>'}</div>
        </div>
      </div>`;
  }

  function render(params) { return params[0] ? detail(S.auftrag(params[0])) : liste(); }
  function mount(view) {
    const sel = view.querySelector('#auftrag-status');
    if (sel) sel.addEventListener('change', () => { zustand.status = sel.value; CRM.render(); });
  }
  CRM.views.auftraege = { render, mount };
})(window.CRM);
