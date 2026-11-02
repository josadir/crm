window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;
  const zustand = { erledigte: false };

  function zeile(t) {
    const v = t.dealId ? S.vorgang(t.dealId) : null;
    return `<li>
      <input type="checkbox" data-change="aufgabe-erledigt" data-id="${esc(t.id)}" ${t.erledigt ? 'checked' : ''} aria-label="erledigt">
      <span class="dehnen ${t.erledigt ? 'erledigt' : ''}"><button class="btn-link" data-action="aufgabe-bearbeiten" data-id="${esc(t.id)}">${esc(t.titel)}</button>
        <div class="meta">${t.contactId ? `<a href="#/kontakte/${esc(t.contactId)}">${esc(S.kontaktName(t.contactId))}</a>` : ''}${v ? ' · ' + esc(v.titel) : ''}${t.erledigt ? ' · erledigt ' + U.fmtDatum(t.erledigt) : ''}</div></span>
      <span class="klein ${t.erledigt ? 'muted' : U.faelligKlasse(t.faellig)}" style="flex:0 0 80px;text-align:right">${U.fmtDatum(t.faellig)}</span>
    </li>`;
  }

  function gruppe(titel, liste) {
    if (!liste.length) return '';
    return `<h3 style="margin-top:14px">${esc(titel)} <span class="muted">${liste.length}</span></h3><ul class="liste">${liste.map(zeile).join('')}</ul>`;
  }

  function render() {
    const h = U.heute(), woche = U.inTagen(7);
    const offen = U.sortiere(S.offeneAufgaben(), 'faellig');
    const ueberfaellig = offen.filter((t) => t.faellig && t.faellig < h);
    const heute = offen.filter((t) => t.faellig === h);
    const dieseWoche = offen.filter((t) => t.faellig > h && t.faellig <= woche);
    const spaeter = offen.filter((t) => t.faellig > woche);
    const ohne = offen.filter((t) => !t.faellig);
    const erledigt = U.sortiere(S.data.tasks.filter((t) => t.erledigt), 'erledigt', true).slice(0, 30);
    return `
      <h1>Aufgaben <span class="muted klein">${offen.length} offen</span></h1>
      <div class="toolbar">
        <form data-submit="aufgabe-schnell" style="display:flex;gap:6px;flex:1">
          <input name="titel" placeholder="Neue Aufgabe … (Enter)" required autocomplete="off" style="flex:1">
          <input name="faellig" type="date" value="${esc(h)}">
          <button type="submit" class="btn btn-primary">Anlegen</button>
        </form>
        <label class="feld-check" style="margin:0"><input type="checkbox" id="aufgaben-erledigte" ${zustand.erledigte ? 'checked' : ''}> Erledigte zeigen</label>
      </div>
      <div class="panel">
        ${offen.length ? '' : '<div class="leer">Keine offenen Aufgaben.</div>'}
        ${gruppe('Überfällig', ueberfaellig)}${gruppe('Heute', heute)}${gruppe('Diese Woche', dieseWoche)}${gruppe('Später', spaeter)}${gruppe('Ohne Datum', ohne)}
        ${zustand.erledigte ? gruppe('Erledigt (letzte 30)', erledigt) : ''}
      </div>`;
  }

  function mount(view) {
    view.querySelector('#aufgaben-erledigte').addEventListener('change', (e) => { zustand.erledigte = e.target.checked; CRM.render(); });
  }

  CRM.actions['aufgabe-schnell'] = (f) => {
    if (!f.titel) return;
    S.neueAufgabe({ titel: f.titel, faellig: f.faellig || '' });
  };

  CRM.views.aufgaben = { render, mount };
})(window.CRM);
