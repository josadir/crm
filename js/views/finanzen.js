window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;
  const zustand = { jahr: U.heute().slice(0, 4) };
  const eur2 = CRM.belege.eur2;
  const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  function render() {
    const jahre = [...new Set(S.data.invoices.map((r) => String(r.datum).slice(0, 4)).concat(S.data.expenses.map((a) => String(a.datum).slice(0, 4)), [U.heute().slice(0, 4)]))].sort().reverse();
    const aw = S.jahresauswertung(zustand.jahr);
    const s = aw.summe;
    const offen = S.offeneRechnungen(), ueber = S.ueberfaelligeRechnungen();
    const quartale = [0, 1, 2, 3].map((q) => { const m = aw.monate.slice(q * 3, q * 3 + 3); const ust = m.reduce((a, x) => a + x.ustVereinnahmt, 0), vst = m.reduce((a, x) => a + x.vorsteuer, 0); return { q: q + 1, ust, vst, zahllast: S.round2(ust - vst) }; });
    const aeltesteOffen = U.sortiere(offen, 'faellig').slice(0, 8);
    const kl = S.data.stammdaten.kleinunternehmer;
    return `
      <h1>Finanzen</h1>
      <div class="toolbar">
        <select id="finanzen-jahr">${U.options(jahre, zustand.jahr)}</select>
        <span class="abstand"></span>
        <button class="btn" data-action="csv-rechnungen">Rechnungen CSV</button>
        <button class="btn" data-action="csv-ausgaben-jahr">Ausgaben ${esc(zustand.jahr)} CSV</button>
      </div>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${U.fmtEur(s.gestelltNetto)}</div><div class="titel">Umsatz gestellt (netto)</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(s.einnahmenNetto)}</div><div class="titel">Einnahmen bezahlt (netto)</div></div>
        <div class="kachel"><div class="zahl">${U.fmtEur(s.ausgabenNetto)}</div><div class="titel">Ausgaben (netto)</div></div>
        <div class="kachel"><div class="zahl ${s.einnahmenNetto - s.ausgabenNetto < 0 ? 'ueberfaellig' : ''}">${U.fmtEur(s.einnahmenNetto - s.ausgabenNetto)}</div><div class="titel">Ergebnis (Einnahmen − Ausgaben, netto)</div></div>
        <div class="kachel"><div class="zahl ${ueber.length ? 'ueberfaellig' : ''}">${U.fmtEur(offen.reduce((a, r) => a + r.brutto, 0))}</div><div class="titel">offene Posten · ${ueber.length} überfällig</div></div>
      </div>
      <div class="spalten-2" style="grid-template-columns: 1.6fr 1fr">
        <div>
          <div class="panel"><h3>Monatsübersicht ${esc(zustand.jahr)}</h3>
            <table class="klein"><thead><tr><th>Monat</th><th class="rechts">Gestellt netto</th><th class="rechts">Einnahmen netto</th><th class="rechts">Ausgaben netto</th><th class="rechts">Ergebnis</th></tr></thead><tbody>
              ${aw.monate.map((m) => `<tr><td>${MONATE[m.monat - 1]}</td><td class="rechts">${m.gestelltNetto ? eur2(m.gestelltNetto) : '<span class="muted">–</span>'}</td><td class="rechts">${m.einnahmenNetto ? eur2(m.einnahmenNetto) : '<span class="muted">–</span>'}</td><td class="rechts">${m.ausgabenNetto ? eur2(m.ausgabenNetto) : '<span class="muted">–</span>'}</td><td class="rechts ${m.einnahmenNetto - m.ausgabenNetto < 0 ? 'ueberfaellig' : ''}">${m.einnahmenNetto || m.ausgabenNetto ? eur2(m.einnahmenNetto - m.ausgabenNetto) : '<span class="muted">–</span>'}</td></tr>`).join('')}
              <tr style="font-weight:600"><td>Summe</td><td class="rechts">${eur2(s.gestelltNetto)}</td><td class="rechts">${eur2(s.einnahmenNetto)}</td><td class="rechts">${eur2(s.ausgabenNetto)}</td><td class="rechts">${eur2(s.einnahmenNetto - s.ausgabenNetto)}</td></tr>
            </tbody></table>
            <p class="muted klein" style="margin-top:8px">Einnahmen nach Zahlungseingang (Ist-Versteuerung, Zufluss), Ausgaben nach Belegdatum. Das ist die Logik der Einnahmenüberschussrechnung, aber keine Steuererklärung: Abschreibungen, private Anteile und Sonderfälle gehören zur Steuerberatung.</p>
          </div>
        </div>
        <div>
          <div class="panel"><h3>Umsatzsteuer ${esc(zustand.jahr)}</h3>
            ${kl ? '<p class="muted klein">Kleinunternehmerregelung aktiv: keine Umsatzsteuer, keine Vorsteuer.</p>' : `<table class="klein"><thead><tr><th>Quartal</th><th class="rechts">USt vereinnahmt</th><th class="rechts">Vorsteuer</th><th class="rechts">Zahllast</th></tr></thead><tbody>
              ${quartale.map((q) => `<tr><td>Q${q.q}</td><td class="rechts">${eur2(q.ust)}</td><td class="rechts">${eur2(q.vst)}</td><td class="rechts ${q.zahllast < 0 ? '' : ''}"><strong>${eur2(q.zahllast)}</strong></td></tr>`).join('')}
              <tr style="font-weight:600"><td>Jahr</td><td class="rechts">${eur2(s.ustVereinnahmt)}</td><td class="rechts">${eur2(s.vorsteuer)}</td><td class="rechts">${eur2(s.ustVereinnahmt - s.vorsteuer)}</td></tr>
            </tbody></table>
            <p class="muted klein" style="margin-top:8px">Vereinnahmte USt aus bezahlten Rechnungen (Ist-Versteuerung nach § 20 UStG, bei Gründung zu beantragen), Vorsteuer aus erfassten Ausgaben. Monatswerte stehen in der Monatstabelle, Quartale hier. Welcher Voranmeldungszeitraum gilt, legt das Finanzamt fest.</p>`}
          </div>
          <div class="panel"><h3>Älteste offene Posten</h3>
            ${aeltesteOffen.length ? `<ul class="liste">${aeltesteOffen.map((r) => `<li><span class="dehnen"><a href="#/rechnungen/${esc(r.id)}">${esc(r.nummer)}</a> ${esc(S.kontaktName(r.contactId))}<div class="meta ${U.faelligKlasse(r.faellig)}">fällig ${U.fmtDatum(r.faellig)}${r.mahnungen.length ? ' · ' + esc(S.K.MAHNSTUFEN[r.mahnungen.length - 1]) : ''}</div></span><span class="rechts">${eur2(r.brutto)}</span></li>`).join('')}</ul>` : '<div class="leer klein">Keine offenen Rechnungen.</div>'}
          </div>
        </div>
      </div>`;
  }

  function mount(view) {
    view.querySelector('#finanzen-jahr').addEventListener('change', (e) => { zustand.jahr = e.target.value; CRM.render(); });
  }

  CRM.actions['csv-ausgaben-jahr'] = () => {
    const z = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
    const spalten = [{ titel: 'Datum', wert: (a) => U.fmtDatum(a.datum) }, { key: 'lieferant', titel: 'Lieferant' }, { key: 'beschreibung', titel: 'Beschreibung' }, { key: 'kategorie', titel: 'Kategorie' }, { key: 'belegNr', titel: 'BelegNr' }, { titel: 'Netto', wert: (a) => z(a.netto) }, { titel: 'USt-Satz', wert: (a) => a.steuersatz }, { titel: 'Vorsteuer', wert: (a) => z(a.steuer) }, { titel: 'Brutto', wert: (a) => z(a.brutto) }, { key: 'zahlungsart', titel: 'Zahlungsart' }];
    U.download(`ausgaben_${zustand.jahr}.csv`, CRM.csv.schreibe(spalten, U.sortiere(S.data.expenses.filter((a) => String(a.datum).startsWith(zustand.jahr)), 'datum')), 'text/csv;charset=utf-8');
  };

  CRM.views.finanzen = { render, mount };
})(window.CRM);
