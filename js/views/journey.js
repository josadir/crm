// Journey-Analytics: Trichter, Dauer zwischen Stufen, Quellen, typische Wege bis zum Kauf. Gemeinsame Datei für beide CRMs.
window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, J = window.CRMJourney, esc = U.esc;
  const A = () => CRM.auto;
  const zustand = { seitTagen: 365, typ: '', quelle: '' };
  const pz = (x) => x == null ? '–' : Math.round(x * 100) + ' %';
  const zahl = (x, n) => x == null ? '–' : (Math.round(x * 10) / 10).toLocaleString('de-DE') + (n || '');
  const kopf = (t) => `<div class="modal-kopf"><h2>${esc(t)}</h2><button type="button" class="btn-icon" data-action="modal-schliessen" aria-label="Schließen">×</button></div>`;

  function berechnen() {
    return J.analytics({ kontakte: A().kontakte(), tpsNachKontakt: A().tpsNachKontakt(), kampagnen: A().kampagnen(), cfg: A().journeyKonfig(), filter: { seitTagen: zustand.seitTagen || 0, typ: zustand.typ, quelle: zustand.quelle } });
  }

  function render() {
    const an = berechnen();
    const quellen = [...new Set(A().kontakte().map((k) => k.quelle).filter(Boolean))].sort();
    const max = Math.max(1, an.trichter[0].anzahl);
    return `
      <div class="toolbar"><h1 style="margin:0">Customer Journey</h1><span class="abstand"></span>
        <select id="jy-zeit">${U.options([[30, 'Erstkontakt in den letzten 30 Tagen'], [90, 'letzte 90 Tage'], [365, 'letzte 12 Monate'], [0, 'alle']], zustand.seitTagen)}</select>
        ${A().art === 'team' ? `<select id="jy-typ">${U.options([['b2c', 'Privat (B2C)'], ['b2b', 'Firmen (B2B)']], zustand.typ, 'B2C und B2B')}</select>` : ''}
        <select id="jy-quelle">${U.options(quellen, zustand.quelle, 'Alle Quellen')}</select>
        ${A().darfBearbeiten() ? '<button class="btn" data-action="jy-stufen">Stufen einstellen</button>' : ''}</div>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${an.anzahl}</div><div class="titel">Kontakte im Zeitraum</div></div>
        <div class="kachel"><div class="zahl">${an.trichter[3].anzahl}</div><div class="titel">haben gekauft · ${pz(an.trichter[3].anteil)}</div></div>
        <div class="kachel"><div class="zahl">${zahl(an.medianTouchpointsBisKauf)}</div><div class="titel">Kontaktpunkte bis zum Kauf (Median)</div></div>
        <div class="kachel"><div class="zahl">${zahl(an.medianTageBisKauf, ' T.')}</div><div class="titel">vom Erstkontakt bis zum Kauf (Median)</div></div>
      </div>
      <div class="spalten-2">
        <div>
          <div class="panel"><h2>Trichter</h2>
            ${an.trichter.map((t, i) => `<div class="jy-stufe klickbar" data-action="jy-stufe-kontakte" data-stufe="${esc(t.key)}">
              <div class="jy-name">${esc(t.name)}</div>
              <div class="jy-spur"><div class="jy-balken" style="width:${Math.max(2, Math.round(t.anzahl / max * 100))}%"></div></div>
              <div class="jy-wert"><strong>${t.anzahl}</strong>${i ? ` <span class="muted klein">${pz(t.vonVorstufe)} aus Vorstufe</span>` : ''}</div></div>`).join('')}
            <p class="muted klein">Klick auf eine Stufe zeigt die Kontakte, die gerade dort stehen. ${an.ohneStufe ? an.ohneStufe + ' Kontakte ohne erfasste Kontaktpunkte.' : ''}</p>
          </div>
          <div class="panel"><h2>Wie lange dauert es?</h2><ul class="liste">${an.dauer.map((d) => `<li><span class="dehnen">${esc(d.von)} → ${esc(d.nach)}</span><span class="ende">${d.medianTage == null ? '–' : zahl(d.medianTage, ' Tage')}</span></li>`).join('')}</ul></div>
        </div>
        <div>
          <div class="panel"><h2>Woher kommen Käufer?</h2>${an.quellen.length ? `<table class="jy-tabelle"><thead><tr><th>Quelle</th><th class="rechts">Kontakte</th><th class="rechts">Käufer</th><th class="rechts">Quote</th><th class="rechts">Umsatz</th></tr></thead><tbody>
            ${an.quellen.map((q) => `<tr><td>${esc(q.quelle)}</td><td class="rechts">${q.kontakte}</td><td class="rechts">${q.kaeufer}</td><td class="rechts">${pz(q.quote)}</td><td class="rechts">${U.fmtEur(q.umsatz)}</td></tr>`).join('')}</tbody></table>` : '<div class="leer">Keine Daten.</div>'}</div>
          <div class="panel"><h2>Typische Wege bis zum Kauf</h2>${an.topWege.length ? `<ul class="liste">${an.topWege.map((w) => `<li><span class="dehnen klein">${esc(w.weg)}</span><span class="ende"><strong>${w.anzahl}</strong></span></li>`).join('')}</ul>` : '<div class="leer klein">Noch keine Käufe im Zeitraum.</div>'}</div>
          <div class="panel"><div class="panel-kopf"><h2>Newsletter</h2><a class="btn btn-klein" href="#/newsletter">Auswertung</a></div>
            ${an.newsletter.slice(0, 4).map((n) => `<p class="klein"><strong>${esc(n.name)}</strong> · Öffnung ${pz(n.oeffnungsrate)} · Klick ${pz(n.klickrate)} · ${n.kaeufe} Käufe</p>`).join('') || '<div class="leer klein">Keine Kampagnen.</div>'}</div>
        </div>
      </div>
      <p class="muted klein">Stufen ergeben sich aus den Kontaktpunkten: Erstkontakt, Gespräche, Newsletter, Angebote, Phasenwechsel, Bestellungen und Zahlungen, eigene Ereignisse. Welche Art welcher Stufe zählt, legt „Stufen einstellen" fest.</p>`;
  }

  function mount(view) {
    const z = view.querySelector('#jy-zeit'), t = view.querySelector('#jy-typ'), q = view.querySelector('#jy-quelle');
    z.addEventListener('change', () => { zustand.seitTagen = Number(z.value); CRM.render(); });
    if (t) t.addEventListener('change', () => { zustand.typ = t.value; CRM.render(); });
    q.addEventListener('change', () => { zustand.quelle = q.value; CRM.render(); });
  }

  const AK = CRM.actions;
  AK['jy-stufe-kontakte'] = (d) => {
    const cfg = A().journeyKonfig(), map = A().tpsNachKontakt();
    const liste = A().kontakte().map((k) => ({ k, j: J.journey(map.get(k.id) || [], cfg, k) })).filter((x) => x.j.stufe === d.stufe).sort((a, b) => String((b.j.letzter || {}).datum || '').localeCompare(String((a.j.letzter || {}).datum || '')));
    U.modal(`${kopf('Aktuell in Stufe ' + ((J.STUFEN.find((s) => s.key === d.stufe) || {}).name || ''))}
      ${liste.length ? `<ul class="liste">${liste.slice(0, 200).map((x) => `<li><span class="dehnen"><a href="${esc(A().kontaktLink(x.k.id))}" data-action="modal-link">${esc(x.k.name)}</a><div class="meta">${x.j.letzter ? 'zuletzt: ' + esc(J.ART_NAME[x.j.letzter.art] || x.j.letzter.art) + ' am ' + esc(U.fmtDatum(x.j.letzter.datum)) : ''}</div></span><span class="ende">${x.j.kaeufe ? x.j.kaeufe + ' Käufe' : ''}</span></li>`).join('')}</ul>` : '<div class="leer">Niemand.</div>'}`);
  };
  AK['modal-link'] = AK['modal-link'] || ((d, el) => { U.closeModal(); location.hash = el.getAttribute('href'); });
  AK['jy-stufen'] = () => {
    const cfg = J.konfig(A().journeyKonfig());
    const stufen = [['', '– zählt nicht –']].concat(J.STUFEN.map((s) => [s.key, s.name]));
    U.modal(`${kopf('Journey-Stufen einstellen')}<form data-submit="jy-stufen-speichern">
      <p class="muted klein">Welche Kontaktpunkte bringen einen Kontakt in welche Stufe? Die höchste erreichte Stufe zählt.</p>
      <table class="jy-tabelle"><tbody>${J.ARTEN.filter((a) => a[0] !== 'phase').map((a) => `<tr><td>${esc(a[1])}</td><td><select name="art_${a[0]}">${U.options(stufen, cfg.arten[a[0]] || '')}</select></td></tr>`).join('')}
      <tr><td colspan="2"><strong>Vorgang erreicht Phase …</strong></td></tr>
      ${A().phasen().map((p) => `<tr><td>${esc(p)}</td><td><select name="phase_${esc(p)}">${U.options(stufen, cfg.phasen[p] || '')}</select></td></tr>`).join('')}</tbody></table>
      <div class="feld" style="margin-top:10px"><label>Ab wie vielen Käufen zählt „Bindung"?</label><input name="wiederkaufAb" type="number" min="2" value="${cfg.wiederkaufAb}"></div>
      <div class="form-aktionen"><button type="button" class="btn links" data-action="jy-stufen-standard">Standard</button><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div></form>`);
  };
  AK['jy-stufen-speichern'] = async (f) => {
    try {
      const cfg = { arten: {}, phasen: {}, wiederkaufAb: Number(f.wiederkaufAb) || 2 };
      Object.keys(f).forEach((k) => { if (k.startsWith('art_')) cfg.arten[k.slice(4)] = f[k]; if (k.startsWith('phase_')) cfg.phasen[k.slice(6)] = f[k]; });
      await A().journeyKonfigSpeichern(cfg);
      U.closeModal(); U.toast('Stufen gespeichert', 'ok'); CRM.render();
    } catch (e) { U.toast(e.message, 'fehler'); }
  };
  AK['jy-stufen-standard'] = async () => { try { await A().journeyKonfigSpeichern(J.standardKonfig()); U.closeModal(); U.toast('Standard wiederhergestellt', 'ok'); CRM.render(); } catch (e) { U.toast(e.message, 'fehler'); } };

  CRM.views.journey = { render, mount, titel: 'Customer Journey' };
})(window.CRM);
