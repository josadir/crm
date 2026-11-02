// Gemeinsame Bausteine für Belege: Dokumentansicht, Positionseditor, Summen, Journal.
window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, esc = U.esc;

  const badge = (status) => `<span class="badge s-${esc(String(status).replace(/\s/g, '-'))}">${esc(status)}</span>`;
  const menge = (n) => (Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  const eur2 = (n) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  function anrede(e) {
    if (!e || !e.person) return 'Sehr geehrte Damen und Herren,';
    const p = e.person.trim();
    if (/^frau\b/i.test(p)) return `Sehr geehrte ${esc(p)},`;
    if (/^herr\b/i.test(p)) return `Sehr geehrter ${esc(p)},`;
    return `Guten Tag ${esc(p)},`;
  }

  function summenBlock(sum, kleinunternehmer) {
    const zeilen = [`<tr><td>Nettobetrag</td><td class="rechts">${eur2(sum.netto)}</td></tr>`];
    if (kleinunternehmer) zeilen.push('<tr><td colspan="2" class="muted klein">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</td></tr>');
    else (sum.saetze || []).filter((s) => s.satz > 0).forEach((s) => zeilen.push(`<tr><td>zzgl. ${s.satz} % USt auf ${eur2(s.basis)}</td><td class="rechts">${eur2(s.betrag)}</td></tr>`));
    zeilen.push(`<tr class="gesamt"><td>Gesamtbetrag</td><td class="rechts">${eur2(sum.brutto)}</td></tr>`);
    return `<table class="summen">${zeilen.join('')}</table>`;
  }

  function positionenTabelle(positionen) {
    if (!positionen.length) return '<p class="muted klein">Noch keine Positionen.</p>';
    return `<table class="positionen"><thead><tr><th>Pos.</th><th>Bezeichnung</th><th class="rechts">Menge</th><th>Einheit</th><th class="rechts">Einzelpreis</th><th class="rechts">Gesamt</th></tr></thead><tbody>
      ${positionen.map((p, i) => `<tr><td>${i + 1}</td><td><div class="text">${esc(p.bezeichnung)}</div>${p.art === 'Auslage' ? '<div class="muted klein">Auslage</div>' : ''}</td><td class="rechts">${menge(p.menge)}</td><td>${esc(p.einheit)}</td><td class="rechts">${eur2(p.einzelpreis)}</td><td class="rechts">${eur2((Number(p.menge) || 0) * (Number(p.einzelpreis) || 0))}</td></tr>`).join('')}
    </tbody></table>`;
  }

  // Das Dokument: Angebot oder Rechnung in Briefform
  function dokument(o) {
    const a = o.absender || {}, e = o.empfaenger || {};
    const absenderZeile = [a.firma || a.name, a.strasse, [a.plz, a.ort].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    const kopf = (o.kopfzeilen || []).filter((z) => z[1]).map((z) => `<tr><td class="muted">${esc(z[0])}</td><td>${esc(z[1])}</td></tr>`).join('');
    return `
      <div class="beleg">
        <div class="beleg-kopf">
          <div class="beleg-absender">${esc(a.firma || a.name || 'Absender fehlt (Einstellungen → Stammdaten)')}${a.firma && a.name && a.firma !== a.name ? `<div class="muted klein">${esc(a.name)}</div>` : ''}</div>
          <div class="beleg-art">${esc(o.art)}</div>
        </div>
        <div class="beleg-adressen">
          <div>
            <div class="beleg-rueckadresse">${esc(absenderZeile)}</div>
            <div class="beleg-empfaenger">
              ${e.firma ? `<div>${esc(e.firma)}</div>` : ''}${e.person ? `<div>${esc(e.person)}</div>` : ''}
              ${e.strasse ? `<div>${esc(e.strasse)}</div>` : ''}${(e.plz || e.ort) ? `<div>${esc([e.plz, e.ort].filter(Boolean).join(' '))}</div>` : ''}
              ${e.land && e.land !== 'Deutschland' ? `<div>${esc(e.land)}</div>` : ''}
            </div>
          </div>
          <table class="beleg-meta">${kopf}</table>
        </div>
        <h2 class="beleg-titel">${esc(o.art)} ${esc(o.nummer)}${o.titel ? ': ' + esc(o.titel) : ''}</h2>
        ${o.hinweis ? `<p class="beleg-hinweis">${esc(o.hinweis)}</p>` : ''}
        <p>${anrede(e)}</p>
        ${o.einleitung ? `<p class="text">${esc(o.einleitung)}</p>` : ''}
        ${positionenTabelle(o.positionen)}
        <div class="beleg-summen">${summenBlock(o.sum, o.kleinunternehmer)}</div>
        ${o.zahlung ? `<p class="text">${esc(o.zahlung)}</p>` : ''}
        ${o.fuss ? `<p class="text">${esc(o.fuss)}</p>` : ''}
        <p>Mit freundlichen Grüßen<br><br>${esc(a.name || a.firma || '')}</p>
        <div class="beleg-fuss">
          <div>${esc(a.firma || a.name || '')}<br>${esc(a.strasse || '')}<br>${esc([a.plz, a.ort].filter(Boolean).join(' '))}</div>
          <div>${a.email ? esc(a.email) + '<br>' : ''}${a.telefon ? esc(a.telefon) + '<br>' : ''}${a.website ? esc(a.website) : ''}</div>
          <div>${a.steuernummer ? 'Steuernummer ' + esc(a.steuernummer) + '<br>' : ''}${a.ustId ? 'USt-IdNr. ' + esc(a.ustId) + '<br>' : ''}${e.ustId ? 'USt-IdNr. Empfänger ' + esc(e.ustId) : ''}</div>
          <div>${a.bank ? esc(a.bank) + '<br>' : ''}${a.iban ? 'IBAN ' + esc(a.iban) + '<br>' : ''}${a.bic ? 'BIC ' + esc(a.bic) : ''}</div>
        </div>
      </div>`;
  }

  // Positionen mit Bearbeiten/Löschen (Angebot im Entwurf, Auftrag bis Fertig)
  function positionenEditor(belegart, beleg, editierbar) {
    const sum = S.summen(beleg.positionen, S.data.stammdaten.kleinunternehmer);
    const zeilen = beleg.positionen.map((p, i) => `
      <tr><td>${i + 1}</td><td><div class="text">${esc(p.bezeichnung)}</div><div class="muted klein">${esc(p.art)} · ${p.steuersatz} % USt</div></td>
      <td class="rechts">${menge(p.menge)} ${esc(p.einheit)}</td><td class="rechts">${eur2(p.einzelpreis)}</td><td class="rechts"><strong>${eur2((Number(p.menge) || 0) * (Number(p.einzelpreis) || 0))}</strong></td>
      <td class="rechts" style="white-space:nowrap">${editierbar ? `<button class="btn btn-klein" data-action="position-bearbeiten" data-belegart="${belegart}" data-beleg-id="${esc(beleg.id)}" data-id="${esc(p.id)}">Bearbeiten</button> <button class="btn btn-klein btn-gefahr" data-action="position-loeschen" data-belegart="${belegart}" data-beleg-id="${esc(beleg.id)}" data-id="${esc(p.id)}">×</button>` : ''}</td></tr>`).join('');
    return `
      <div class="abschnitt-kopf"><h3>Positionen</h3>${editierbar ? `<button class="btn btn-klein btn-primary" data-action="position-neu" data-belegart="${belegart}" data-beleg-id="${esc(beleg.id)}">+ Position</button>` : '<span class="muted klein">eingefroren</span>'}</div>
      ${beleg.positionen.length ? `<table><thead><tr><th>#</th><th>Bezeichnung</th><th class="rechts">Menge</th><th class="rechts">Einzelpreis</th><th class="rechts">Gesamt</th><th></th></tr></thead><tbody>${zeilen}</tbody></table>` : '<div class="leer klein">Noch keine Positionen.</div>'}
      <div style="display:flex;justify-content:flex-end;margin-top:8px">${summenBlock(sum, S.data.stammdaten.kleinunternehmer)}</div>`;
  }

  function journal(belegId) {
    const j = U.sortiere(S.journalFuer(belegId), 'datum', true);
    if (!j.length) return '';
    return `<h3 style="margin-top:16px">Verlauf</h3><ul class="liste">${j.map((x) => `<li><span class="meta" style="flex:0 0 110px">${U.fmtZeit(x.datum)}</span><span class="dehnen"><strong>${esc(x.ereignis)}</strong>${x.notiz ? ' · ' + esc(x.notiz) : ''}</span></li>`).join('')}</ul>`;
  }

  // Statusfilter-Toolbar für Listen
  function filterLeiste(id, werte, aktuell, extra) {
    return `<div class="toolbar"><select id="${id}">${U.options([['', 'Alle']].concat(werte.map((w) => [w, w])), aktuell)}</select>${extra || ''}</div>`;
  }

  CRM.belege = { badge, menge, eur2, dokument, positionenEditor, journal, summenBlock, filterLeiste };
})(window.CRM);
