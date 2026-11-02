window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;
  const zustand = { monat: U.heute().slice(0, 7), alle: false };
  const eur2 = CRM.belege.eur2;

  function verschiebe(r) { const [j, m] = zustand.monat.split('-').map(Number); const d = new Date(j, m - 1 + r, 1); zustand.monat = U.localDate(d).slice(0, 7); }

  function render() {
    const liste = U.sortiere(S.data.expenses.filter((a) => zustand.alle || String(a.datum).startsWith(zustand.monat)), 'datum', true);
    const brutto = liste.reduce((s, a) => s + a.brutto, 0), netto = liste.reduce((s, a) => s + a.netto, 0), vorsteuer = liste.reduce((s, a) => s + a.steuer, 0);
    const kategorien = {};
    liste.forEach((a) => { kategorien[a.kategorie] = (kategorien[a.kategorie] || 0) + a.netto; });
    const titel = new Date(zustand.monat + '-01T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const abos = S.data.expenses.filter((a) => a.wiederkehrend);
    return `
      <h1>Ausgaben</h1>
      <div class="toolbar">
        <button class="btn" id="ausgabe-zurueck" ${zustand.alle ? 'disabled' : ''}>‹</button><strong>${zustand.alle ? 'Alle Ausgaben' : esc(titel)}</strong><button class="btn" id="ausgabe-vor" ${zustand.alle ? 'disabled' : ''}>›</button>
        <label class="feld-check" style="margin:0 0 0 8px"><input type="checkbox" id="ausgabe-alle" ${zustand.alle ? 'checked' : ''}> alle Monate</label>
        <span class="abstand"></span>
        <button class="btn" data-action="csv-ausgaben">CSV exportieren</button>
        <button class="btn btn-primary" data-action="ausgabe-neu">+ Ausgabe</button>
      </div>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${U.fmtEur(brutto)}</div><div class="titel">brutto · ${liste.length} Belege</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(netto)}</div><div class="titel">netto (Betriebsausgaben)</div></div>
        <div class="kachel"><div class="zahl">${eur2(vorsteuer)}</div><div class="titel">enthaltene Vorsteuer</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(abos.reduce((s, a) => s + a.brutto, 0))}</div><div class="titel">${abos.length} wiederkehrende Posten (Abos, je Beleg)</div></div>
      </div>
      <div class="spalten-2" style="grid-template-columns: 1.6fr 1fr">
        <div class="panel">${liste.length ? `<table><thead><tr><th>Datum</th><th>Lieferant</th><th>Wofür</th><th>Kategorie</th><th class="rechts">Brutto</th><th class="rechts">USt</th></tr></thead><tbody>
          ${liste.map((a) => `<tr><td style="white-space:nowrap">${U.fmtDatum(a.datum)}</td><td><button class="btn-link" data-action="ausgabe-bearbeiten" data-id="${esc(a.id)}">${esc(a.lieferant)}</button>${a.wiederkehrend ? ' <span class="badge">Abo</span>' : ''}${!a.bezahlt ? ' <span class="badge s-Offen">offen</span>' : ''}</td><td>${esc(a.beschreibung)}${a.orderId && S.auftrag(a.orderId) ? `<div class="muted klein">${esc(S.auftrag(a.orderId).nummer)}</div>` : ''}</td><td class="klein">${esc(a.kategorie)}</td><td class="rechts">${eur2(a.brutto)}</td><td class="rechts klein muted">${a.steuersatz} %</td></tr>`).join('')}
        </tbody></table>` : '<div class="leer">Keine Ausgaben in diesem Zeitraum.</div>'}</div>
        <div class="panel"><h3>Nach Kategorie (netto)</h3>${Object.keys(kategorien).length ? `<ul class="liste">${Object.entries(kategorien).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span class="dehnen">${esc(k)}</span><span>${U.fmtEur(v)}</span></li>`).join('')}</ul>` : '<div class="leer klein">Nichts erfasst.</div>'}
          <p class="muted klein" style="margin-top:12px">Belege (PDF, Foto) bleiben außerhalb dieser App, z. B. im Ordner Buchhaltung/JJJJ-MM. Hier steht nur die Aufstellung, damit Finanzen und Umsatzsteuer rechnen können.</p></div>
      </div>`;
  }

  function mount(view) {
    view.querySelector('#ausgabe-zurueck').addEventListener('click', () => { verschiebe(-1); CRM.render(); });
    view.querySelector('#ausgabe-vor').addEventListener('click', () => { verschiebe(1); CRM.render(); });
    view.querySelector('#ausgabe-alle').addEventListener('change', (e) => { zustand.alle = e.target.checked; CRM.render(); });
  }

  CRM.actions['csv-ausgaben'] = () => {
    const z = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
    const spalten = [{ titel: 'Datum', wert: (a) => U.fmtDatum(a.datum) }, { key: 'lieferant', titel: 'Lieferant' }, { key: 'beschreibung', titel: 'Beschreibung' }, { key: 'kategorie', titel: 'Kategorie' }, { key: 'belegNr', titel: 'BelegNr' }, { titel: 'Netto', wert: (a) => z(a.netto) }, { titel: 'USt-Satz', wert: (a) => a.steuersatz }, { titel: 'Vorsteuer', wert: (a) => z(a.steuer) }, { titel: 'Brutto', wert: (a) => z(a.brutto) }, { key: 'zahlungsart', titel: 'Zahlungsart' }, { titel: 'Bezahlt', wert: (a) => a.bezahlt ? 'ja' : 'nein' }, { titel: 'Auftrag', wert: (a) => (S.auftrag(a.orderId) || {}).nummer || '' }];
    const liste = U.sortiere(S.data.expenses.filter((a) => zustand.alle || String(a.datum).startsWith(zustand.monat)), 'datum');
    U.download(`ausgaben_${zustand.alle ? 'alle' : zustand.monat}.csv`, CRM.csv.schreibe(spalten, liste), 'text/csv;charset=utf-8');
  };

  CRM.views.ausgaben = { render, mount };
})(window.CRM);
