window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;
  const zustand = { vergangene: false };
  const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function zeile(t) {
    return `<li>
      <span style="flex:0 0 100px" class="${t.kategorie === 'Abwesenheit' ? 'muted' : ''}">${t.von ? esc(t.von) + (t.bis ? ' – ' + esc(t.bis) : '') : 'ganztägig'}</span>
      <span class="dehnen"><button class="btn-link" data-action="termin-bearbeiten" data-id="${esc(t.id)}"><strong>${esc(t.titel)}</strong></button> <span class="badge">${esc(t.kategorie)}</span>
        <div class="meta">${t.contactId ? `<a href="#/kontakte/${esc(t.contactId)}">${esc(S.kontaktName(t.contactId))}</a>` : ''}${t.orderId && S.auftrag(t.orderId) ? ' · <a href="#/auftraege/' + esc(t.orderId) + '">' + esc(S.auftrag(t.orderId).nummer) + '</a>' : ''}${t.ort ? ' · ' + esc(t.ort) : ''}</div></span>
      <span style="white-space:nowrap"><button class="btn btn-klein" data-action="termin-google" data-id="${esc(t.id)}" title="In Google Kalender öffnen">Google</button> <button class="btn btn-klein" data-action="termin-ics" data-id="${esc(t.id)}" title=".ics für Outlook/Apple">.ics</button></span>
    </li>`;
  }

  function render() {
    const h = U.heute();
    const kommend = U.sortiere(S.data.appointments.filter((t) => t.datum >= h), 'datum').sort((a, b) => a.datum === b.datum ? (a.von || '').localeCompare(b.von || '') : 0);
    const vergangen = U.sortiere(S.data.appointments.filter((t) => t.datum < h), 'datum', true);
    const tage = {};
    kommend.forEach((t) => { (tage[t.datum] = tage[t.datum] || []).push(t); });
    const gruppen = Object.keys(tage).sort().map((d) => { const dt = new Date(d + 'T12:00:00'); const label = d === h ? 'Heute' : d === U.inTagen(1) ? 'Morgen' : TAGE[dt.getDay()]; return `<h3 style="margin-top:14px">${esc(label)}, ${U.fmtDatum(d)} <button class="btn btn-klein" data-action="termin-neu" data-datum="${d}" title="Termin an diesem Tag">+</button></h3><ul class="liste">${tage[d].map(zeile).join('')}</ul>`; }).join('');
    return `
      <h1>Termine <span class="muted klein">${kommend.length} anstehend</span></h1>
      <div class="toolbar">
        <label class="feld-check" style="margin:0"><input type="checkbox" id="termine-vergangene" ${zustand.vergangene ? 'checked' : ''}> Vergangene zeigen</label>
        <span class="abstand"></span>
        <button class="btn" data-action="kalender-export">Kalender exportieren (.ics)</button>
        <button class="btn btn-primary" data-action="termin-neu">+ Termin</button>
      </div>
      <div class="hinweis klein">Jeder Termin lässt sich mit „Google" direkt in den Google Kalender übernehmen oder als .ics in Outlook/Apple importieren. Der Sammel-Export nimmt Termine, Aufgaben und Rechnungsfristen auf einmal mit.</div>
      <div class="panel">${kommend.length ? gruppen : '<div class="leer">Keine anstehenden Termine.</div>'}
        ${zustand.vergangene && vergangen.length ? `<h3 style="margin-top:20px" class="muted">Vergangene</h3><ul class="liste">${vergangen.slice(0, 50).map((t) => `<li><span style="flex:0 0 100px" class="muted">${U.fmtDatum(t.datum)}</span><span class="dehnen muted"><button class="btn-link" data-action="termin-bearbeiten" data-id="${esc(t.id)}">${esc(t.titel)}</button>${t.contactId ? ' · ' + esc(S.kontaktName(t.contactId)) : ''}</span></li>`).join('')}</ul>` : ''}
      </div>`;
  }
  function mount(view) {
    view.querySelector('#termine-vergangene').addEventListener('change', (e) => { zustand.vergangene = e.target.checked; CRM.render(); });
  }
  CRM.views.termine = { render, mount };
})(window.CRM);
