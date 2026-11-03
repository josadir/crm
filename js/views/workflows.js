// Workflows: Liste und Baukasten (Auslöser → Schritte: Aktion, Wenn/Dann, Warten, Ende).
// Gemeinsame Datei für beide CRMs. Zugriff auf Daten nur über den Adapter CRM.auto.
window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, J = window.CRMJourney, esc = U.esc;
  const A = () => CRM.auto;
  const sicher = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); U.toast(e.message || String(e), 'fehler'); } };
  let ed = null; // { wf, geaendert }
  const kopf = (t) => `<div class="modal-kopf"><h2>${esc(t)}</h2><button type="button" class="btn-icon" data-action="modal-schliessen" aria-label="Schließen">×</button></div>`;
  const knoepfe = (text) => `<div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">${esc(text || 'Übernehmen')}</button></div>`;
  const art = () => A().art;

  // ------------------------------------------------ Beschreibungen
  const ausloeserMeta = (typ) => J.AUSLOESER.find((a) => a.typ === typ) || { name: typ || '–' };
  const aktionMeta = (a) => J.AKTIONEN.find((x) => x.aktion === a) || { name: a, felder: [] };
  const bedMeta = (f) => J.BEDINGUNGEN.find((b) => b.feld === f) || { name: f, ops: ['ist'] };
  function wertName(b) {
    const m = bedMeta(b.feld);
    const w = (m.werte || []).find((x) => x[0] === b.wert);
    return w ? w[1] : b.wert;
  }
  const beschreibeBedingung = (b) => `${bedMeta(b.feld).name} ${b.op} „${wertName(b)}"`;
  function beschreibeAusloeser(a) {
    if (!a || !a.typ) return 'Kein Auslöser gewählt';
    const m = ausloeserMeta(a.typ);
    let t = m.name;
    if (a.typ === 'touchpoint') t += ': ' + (J.ART_NAME[a.art] || a.art || '?') + (a.kampagneId ? ' (' + ((A().kampagnen().find((k) => k.id === a.kampagneId) || {}).name || 'Kampagne') + ')' : '');
    if (a.typ === 'journey_stufe') t += ': ' + ((J.STUFEN.find((s) => s.key === a.stufe) || {}).name || '?');
    if (a.typ === 'vorgang_phase') t += ': ' + (a.phase || '?');
    if (a.typ === 'aufgabe_erledigt' && a.stichwort) t += ' mit „' + a.stichwort + '"';
    if (['inaktiv', 'angebot_offen', 'rechnung_ueberfaellig'].includes(a.typ)) t += ' (' + (a.tage || 0) + ' Tage)';
    if ((a.bedingungen || []).length) t += ' · nur wenn ' + a.bedingungen.map(beschreibeBedingung).join(' und ');
    return t;
  }
  function beschreibeKnoten(k) {
    if (k.typ === 'warten') return 'Warten: ' + [k.tage ? k.tage + ' Tag' + (k.tage == 1 ? '' : 'e') : '', k.stunden ? k.stunden + ' Std.' : ''].filter(Boolean).join(' ') || 'Warten: sofort weiter';
    if (k.typ === 'bedingung') return (k.name ? k.name + ' · ' : '') + ((k.bedingungen || []).map(beschreibeBedingung).join(' und ') || 'keine Bedingung (immer ja)');
    if (k.typ === 'ende') return 'Workflow beenden';
    const p = k.params || {};
    const detail = p.titel || p.tag || p.status || p.phase || (p.art ? J.ART_NAME[p.art] : '') || p.url || (p.text || '').slice(0, 60);
    return aktionMeta(k.aktion).name + (detail ? ': ' + detail : '');
  }
  const symbol = (k) => ({ aktion: '⚡', bedingung: '◇', warten: '⏱', ende: '■' }[k.typ] || '•');

  // ------------------------------------------------ Liste
  function liste() {
    const wfs = A().workflows().slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
    const laeufe = A().laeufe();
    const bearbeiten = A().darfBearbeiten();
    return `
      <div class="toolbar"><h1 style="margin:0">Workflows</h1><span class="abstand"></span>
        <button class="btn" data-action="wf-jetzt">Jetzt ausführen</button>
        ${bearbeiten ? '<button class="btn btn-primary" data-action="wf-neu">+ Workflow</button>' : ''}</div>
      <div class="hinweis info klein">${esc(A().ausfuehrungsHinweis())} Ein Workflow startet mit einem <strong>Auslöser</strong>, danach folgen Schritte: <strong>Aktion</strong>, <strong>Wenn/Dann</strong> (verzweigt in Ja und Nein), <strong>Warten</strong>. Jeder Kontakt läuft einzeln hindurch.</div>
      ${wfs.length ? `<div class="panel"><ul class="liste">${wfs.map((w) => {
        const l = laeufe.filter((x) => x.workflowId === w.id);
        const laufend = l.filter((x) => x.status === 'laeuft').length, fertig = l.filter((x) => x.status === 'fertig').length;
        return `<li>
          ${bearbeiten ? `<input type="checkbox" data-change="wf-aktiv" data-id="${esc(w.id)}" ${w.aktiv ? 'checked' : ''} title="aktiv" aria-label="aktiv">` : `<span class="badge ${w.aktiv ? 'Gewonnen' : 'Inaktiv'}">${w.aktiv ? 'aktiv' : 'aus'}</span>`}
          <span class="dehnen"><a href="#/workflows/${esc(w.id)}"><strong>${esc(w.name)}</strong></a> ${w.aktiv ? '<span class="badge Gewonnen">aktiv</span>' : '<span class="badge Inaktiv">aus</span>'}
            <div class="meta">⚑ ${esc(beschreibeAusloeser(w.ausloeser))}</div>
            ${w.beschreibung ? `<div class="klein">${esc(w.beschreibung)}</div>` : ''}
            <div class="meta">${J.zaehleKnoten(w.schritte)} Schritte · ${laufend} laufen · ${fertig} fertig</div></span>
          <span class="ende">${bearbeiten ? `<button class="btn btn-klein" data-action="wf-kopieren" data-id="${esc(w.id)}">Kopieren</button>` : ''}</span></li>`;
      }).join('')}</ul></div>` : `<div class="panel"><div class="leer">Noch keine Workflows. ${bearbeiten ? 'Mit „+ Workflow" eine Vorlage wählen oder leer beginnen.' : ''}</div></div>`}`;
  }

  // ------------------------------------------------ Editor
  function laden(id) {
    if (ed && ed.wf.id === id) return ed;
    const w = A().workflows().find((x) => x.id === id);
    ed = w ? { wf: JSON.parse(JSON.stringify(w)), geaendert: false } : null;
    return ed;
  }
  const listeFuer = (ref) => { if (ref === 'root') return ed.wf.schritte; const [id, zweig] = ref.split(':'); const f = J.finde(ed.wf.schritte, id); return f ? f.knoten[zweig] : null; };
  const plus = (ref, index) => A().darfBearbeiten() ? `<div class="wf-plus-zeile"><button class="wf-plus" data-action="wf-plus" data-ref="${esc(ref)}" data-index="${index}" title="Schritt einfügen">+</button></div>` : '<div class="wf-plus-zeile"><span class="wf-linie"></span></div>';

  function kette(liste, ref) {
    let html = `<div class="wf-kette">${plus(ref, 0)}`;
    liste.forEach((k, i) => { html += knotenHtml(k, ref, i, liste.length) + plus(ref, i + 1); });
    return html + '</div>';
  }
  function knotenHtml(k, ref, i, n) {
    const b = A().darfBearbeiten();
    const steuer = b ? `<span class="wf-steuer">${i > 0 ? `<button class="btn-icon klein" data-action="wf-verschieben" data-id="${esc(k.id)}" data-richtung="-1" title="nach oben">↑</button>` : ''}${i < n - 1 ? `<button class="btn-icon klein" data-action="wf-verschieben" data-id="${esc(k.id)}" data-richtung="1" title="nach unten">↓</button>` : ''}<button class="btn-icon klein" data-action="wf-knoten-loeschen" data-id="${esc(k.id)}" title="löschen">×</button></span>` : '';
    const karte = `<div class="wf-knoten wf-${k.typ}" ${b ? `data-action="wf-knoten-bearbeiten" data-id="${esc(k.id)}"` : ''}><span class="wf-sym">${symbol(k)}</span><span class="dehnen">${esc(beschreibeKnoten(k))}</span>${steuer}</div>`;
    if (k.typ !== 'bedingung') return karte;
    return `<div class="wf-bedingung">${karte}<div class="wf-zweige">
      <div class="wf-zweig"><div class="wf-zweig-kopf ja">Ja</div>${kette(k.ja || [], k.id + ':ja')}</div>
      <div class="wf-zweig"><div class="wf-zweig-kopf nein">Nein</div>${kette(k.nein || [], k.id + ':nein')}</div>
    </div></div>`;
  }

  function editor(id) {
    const e = laden(id);
    if (!e) return '<h1>Workflow</h1><div class="panel"><div class="leer">Workflow nicht gefunden.</div></div><a class="btn" href="#/workflows">Zur Liste</a>';
    const w = e.wf, b = A().darfBearbeiten();
    const laeufe = A().laeufe().filter((l) => l.workflowId === w.id).sort((a, c) => String(c.start).localeCompare(String(a.start))).slice(0, 30);
    const knName = (kid) => { const f = kid && J.finde(w.schritte, kid); return f ? beschreibeKnoten(f.knoten) : '–'; };
    return `
      <div class="toolbar"><a class="btn btn-klein" href="#/workflows">‹ Workflows</a><span class="abstand"></span>
        <button class="btn" data-action="wf-testen">Mit Kontakt testen</button>
        ${b ? `<button class="btn btn-gefahr" data-action="wf-loeschen">Löschen</button><button class="btn btn-primary" data-action="wf-speichern">${e.geaendert ? 'Speichern •' : 'Gespeichert'}</button>` : ''}</div>
      <div class="spalten-2 wf-layout">
        <div>
          <div class="panel">
            ${b ? `<div class="feld"><label>Name</label><input data-wf-feld="name" value="${esc(w.name)}"></div>
            <div class="feld"><label>Beschreibung (wofür ist der Workflow?)</label><input data-wf-feld="beschreibung" value="${esc(w.beschreibung || '')}"></div>
            <div class="feld-check"><input type="checkbox" id="wf-aktiv" data-wf-feld="aktiv" ${w.aktiv ? 'checked' : ''}><label for="wf-aktiv"><strong>Aktiv</strong> (nimmt neue Kontakte auf und führt Schritte aus)</label></div>
            <div class="feld-check"><input type="checkbox" id="wf-mehrfach" data-wf-feld="mehrfach" ${w.mehrfach ? 'checked' : ''}><label for="wf-mehrfach">Kontakte dürfen mehrfach teilnehmen (bei jedem neuen Auslöser)</label></div>` : `<h1>${esc(w.name)}</h1><p>${esc(w.beschreibung || '')}</p>`}
          </div>
          <div class="wf-baum">
            <div class="wf-knoten wf-ausloeser" ${b ? 'data-action="wf-ausloeser"' : ''}><span class="wf-sym">⚑</span><span class="dehnen"><strong>Auslöser</strong><div class="klein">${esc(beschreibeAusloeser(w.ausloeser))}</div></span></div>
            ${kette(w.schritte, 'root')}
            <div class="wf-knoten wf-ende-fix"><span class="wf-sym">■</span><span class="dehnen muted">Ende</span></div>
          </div>
          <p class="muted klein">Platzhalter in Texten: {name} {vorname} {firma} {email} {objekt} {datum}. „Objekt" ist der auslösende Vorgang, das Angebot oder die Rechnung.</p>
        </div>
        <div>
          <div class="panel"><div class="panel-kopf"><h2>Läufe</h2><span class="muted klein">${laeufe.length ? 'neueste zuerst' : ''}</span></div>
            ${laeufe.length ? `<ul class="liste">${laeufe.map((l) => `<li><span class="dehnen"><a href="${esc(A().kontaktLink(l.kontaktId))}"><strong>${esc(A().kontaktName(l.kontaktId))}</strong></a> <span class="badge ${l.status === 'laeuft' ? 'Interessent' : l.status === 'fertig' ? 'Gewonnen' : 'Verloren'}">${l.status === 'laeuft' ? 'läuft' : l.status}</span>
              <div class="meta">${l.status === 'laeuft' ? 'Jetzt: ' + esc(knName(l.knoten)) + (l.weiterAb ? ' · weiter ab ' + esc(U.fmtZeit(l.weiterAb)) : '') : 'Start ' + esc(U.fmtZeit(l.start))}</div>
              <details><summary class="klein">Protokoll</summary><ul class="klein">${(l.protokoll || []).map((p) => `<li>${esc(U.fmtZeit(p.zeit))} · ${esc(p.text)}</li>`).join('')}</ul></details>
              ${l.status === 'laeuft' && b ? `<button class="btn btn-klein" data-action="wf-lauf-stoppen" data-id="${esc(l.id)}">Abbrechen</button>` : ''}</span></li>`).join('')}</ul>` : '<div class="leer klein">Noch niemand aufgenommen.</div>'}
          </div>
        </div>
      </div>`;
  }

  function render(params) { if (!params[0]) ed = null; return params[0] ? editor(params[0]) : liste(); }
  function mount(view) {
    view.querySelectorAll('[data-wf-feld]').forEach((el) => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      ed.wf[el.dataset.wfFeld] = el.type === 'checkbox' ? el.checked : el.value;
      if (!ed.geaendert) { ed.geaendert = true; const k = view.querySelector('[data-action=wf-speichern]'); if (k) k.textContent = 'Speichern •'; }
    }));
  }
  const geaendert = () => { ed.geaendert = true; CRM.render(); };

  // ------------------------------------------------ Bedingungs-Zeilen (für Auslöser-Filter und Wenn/Dann)
  function werteFuer(feld) {
    const m = bedMeta(feld);
    if (m.werte) return m.werte;
    if (feld === 'status') return A().statusWerte().map((s) => [s, s]);
    if (feld === 'quelle') return A().quellenWerte().map((s) => [s, s]);
    return null;
  }
  function bedingungsZeilen(liste) {
    const felder = J.fuer(J.BEDINGUNGEN, art());
    return `<div data-bed-liste>${(liste || []).map((b, i) => {
      const m = bedMeta(b.feld), werte = werteFuer(b.feld);
      return `<div class="wf-bed-zeile" data-bed>
        <select data-bed-feld>${U.options(felder.map((f) => [f.feld, f.name]), b.feld)}</select>
        <select data-bed-op>${U.options(m.ops || ['ist'], b.op)}</select>
        ${werte ? `<select data-bed-wert>${U.options(werte, b.wert)}</select>` : `<input data-bed-wert value="${esc(b.wert || '')}" placeholder="${b.feld === 'kaeufe' ? 'Zahl' : b.feld === 'bezug_status' ? 'z. B. Bezahlt, Angebot, erledigt' : 'Wert'}" ${b.feld === 'bezug_status' ? 'list="wf-bezug-werte"' : ''}>`}
        <button type="button" class="btn-icon" data-action="wf-bed-weg" data-i="${i}" title="entfernen">×</button></div>`;
    }).join('')}</div>
    <datalist id="wf-bezug-werte">${A().phasen().concat(['Offen', 'Bezahlt', 'Gesendet', 'Angenommen', 'Abgelehnt', 'erledigt', 'offen']).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
    <button type="button" class="btn btn-klein" data-action="wf-bed-hinzu">+ Bedingung</button>`;
  }
  const bedingungenLesen = (form) => [...form.querySelectorAll('[data-bed]')].map((z) => ({ feld: z.querySelector('[data-bed-feld]').value, op: z.querySelector('[data-bed-op]').value, wert: z.querySelector('[data-bed-wert]').value }));

  // ------------------------------------------------ Auslöser-Formular
  let formStand = null; // aktueller Stand im offenen Formular (für Neuaufbau bei Auswahlwechsel)
  function ausloeserFormular(a) {
    const typen = J.fuer(J.AUSLOESER, art());
    const m = ausloeserMeta(a.typ);
    const f = m.felder || [];
    return `${kopf('Auslöser')}
      <form data-submit="wf-ausloeser-speichern" data-neuaufbau="ausloeser">
        <div class="feld"><label>Wann startet der Workflow?</label><select name="typ" data-neu>${U.options(typen.map((t) => [t.typ, t.name]), a.typ, '– bitte wählen –')}</select>
          ${m.text ? `<p class="muted klein" style="margin-top:4px">${esc(m.text)}</p>` : ''}</div>
        ${f.includes('art') ? `<div class="feld"><label>Ereignis</label><select name="art">${U.options(J.ARTEN.map((x) => [x[0], x[1]]), a.art)}</select></div>` : ''}
        ${f.includes('kampagneId') ? `<div class="feld"><label>Nur bei Kampagne (optional)</label><select name="kampagneId">${U.options(A().kampagnen().map((k) => [k.id, k.name]), a.kampagneId, '– jede –')}</select></div>` : ''}
        ${f.includes('stufe') ? `<div class="feld"><label>Stufe</label><select name="stufe">${U.options(J.STUFEN.map((s) => [s.key, s.name]), a.stufe)}</select></div>` : ''}
        ${f.includes('phase') ? `<div class="feld"><label>Phase</label><select name="phase">${U.options(A().phasen(), a.phase)}</select></div>` : ''}
        ${f.includes('stichwort') ? `<div class="feld"><label>Titel enthält (optional)</label><input name="stichwort" value="${esc(a.stichwort || '')}"></div>` : ''}
        ${f.includes('tage') ? `<div class="feld"><label>Tage</label><input name="tage" type="number" min="1" value="${esc(a.tage || 7)}"></div>` : ''}
        <label>Nur wenn (alle müssen zutreffen)</label>${bedingungsZeilen(a.bedingungen)}
        ${m.zeit ? '<p class="muted klein">Zeitbasierte Auslöser werden einmal täglich geprüft.</p>' : ''}
        ${knoepfe()}
      </form>`;
  }
  function ausloeserLesen(form) {
    const f = U.formData(form);
    const a = { typ: f.typ, bedingungen: bedingungenLesen(form) };
    ['art', 'kampagneId', 'stufe', 'phase', 'stichwort'].forEach((n) => { if (f[n]) a[n] = f[n]; });
    if (f.tage) a.tage = Number(f.tage);
    return a;
  }

  // ------------------------------------------------ Knoten-Formulare
  function zuweisenOptionen() { return [['betreuer', 'Betreuer des Kontakts'], ['admins', 'Alle Admins'], ['alle', 'Ganzes Team']].concat(A().personen()).concat([['niemand', 'Niemand']]); }
  function aktionFeld(n, p) {
    const v = p[n] ?? '';
    switch (n) {
      case 'titel': return `<div class="feld"><label>Titel</label><input name="titel" value="${esc(v)}" required></div>`;
      case 'beschreibung': return `<div class="feld"><label>Beschreibung</label><textarea name="beschreibung" style="min-height:50px">${esc(v)}</textarea></div>`;
      case 'text': return `<div class="feld"><label>Text</label><textarea name="text" style="min-height:60px">${esc(v)}</textarea></div>`;
      case 'faelligTage': return `<div class="feld"><label>Fällig in Tagen (0 = heute)</label><input name="faelligTage" type="number" min="0" value="${esc(v === '' ? 0 : v)}"></div>`;
      case 'inStunden': return `<div class="feld"><label>In Stunden (0 = sofort)</label><input name="inStunden" type="number" min="0" value="${esc(v === '' ? 0 : v)}"></div>`;
      case 'zuweisen': return art() === 'team' ? `<div class="feld"><label>An wen?</label><select name="zuweisen">${U.options(zuweisenOptionen(), v || 'betreuer')}</select></div>` : '';
      case 'tag': return `<div class="feld"><label>Schlagwort</label><input name="tag" value="${esc(v)}" required></div>`;
      case 'status': return `<div class="feld"><label>Status</label><select name="status">${U.options(A().statusWerte(), v)}</select></div>`;
      case 'phase': return `<div class="feld"><label>Phase</label><select name="phase">${U.options(A().phasen(), v)}</select></div>`;
      case 'wert': return `<div class="feld"><label>Wert (€, optional)</label><input name="wert" type="number" min="0" value="${esc(v)}"></div>`;
      case 'art': return `<div class="feld"><label>Ereignis</label><select name="art">${U.options(J.ARTEN.map((x) => [x[0], x[1]]), v)}</select></div>`;
      case 'url': return `<div class="feld"><label>Webhook-Adresse (https://…, z. B. aus n8n)</label><input name="url" type="url" value="${esc(v)}" required placeholder="https://"></div><p class="muted klein">Bekommt Kontaktdaten als JSON (POST). Nur Adressen eintragen, denen du die Daten anvertraust.</p>`;
      default: return '';
    }
  }
  function knotenFormular(k, neu) {
    if (k.typ === 'aktion') {
      const aktionen = J.fuer(J.AKTIONEN, art());
      const m = aktionMeta(k.aktion);
      return `${kopf(neu ? 'Aktion hinzufügen' : 'Aktion bearbeiten')}
        <form data-submit="wf-knoten-speichern" data-neuaufbau="knoten">
          <div class="feld"><label>Was soll passieren?</label><select name="aktion" data-neu>${U.options(aktionen.map((a) => [a.aktion, a.name]), k.aktion)}</select></div>
          ${(m.felder || []).map((n) => aktionFeld(n, k.params || {})).join('')}
          ${knoepfe()}
        </form>`;
    }
    if (k.typ === 'warten') return `${kopf('Warten')}<form data-submit="wf-knoten-speichern">
        <div class="feld-reihe"><div class="feld"><label>Tage</label><input name="tage" type="number" min="0" value="${esc(k.tage || 0)}"></div><div class="feld"><label>Stunden</label><input name="stunden" type="number" min="0" value="${esc(k.stunden || 0)}"></div></div>
        <p class="muted klein">Danach geht es mit dem nächsten Schritt weiter.</p>${knoepfe()}</form>`;
    if (k.typ === 'bedingung') return `${kopf('Wenn/Dann')}<form data-submit="wf-knoten-speichern" data-neuaufbau="knoten">
        <div class="feld"><label>Name (z. B. „Schon gekauft?")</label><input name="name" value="${esc(k.name || '')}"></div>
        <label>Ja, wenn alle zutreffen:</label>${bedingungsZeilen(k.bedingungen)}
        <p class="muted klein">Trifft alles zu, geht es links (Ja) weiter, sonst rechts (Nein). Leere Zweige springen direkt zum Schritt nach der Verzweigung.</p>${knoepfe()}</form>`;
    return `${kopf('Ende')}<form data-submit="wf-knoten-speichern"><p>An dieser Stelle endet der Workflow für den Kontakt.</p>${knoepfe()}</form>`;
  }
  function knotenLesen(form, k) {
    const f = U.formData(form);
    const n = { id: k.id, typ: k.typ };
    if (k.typ === 'aktion') { n.aktion = f.aktion; n.params = {}; (aktionMeta(f.aktion).felder || []).forEach((x) => { if (f[x] !== undefined && f[x] !== '') n.params[x] = f[x]; }); }
    if (k.typ === 'warten') { n.tage = Number(f.tage) || 0; n.stunden = Number(f.stunden) || 0; }
    if (k.typ === 'bedingung') { n.name = f.name || ''; n.bedingungen = bedingungenLesen(form); n.ja = k.ja || []; n.nein = k.nein || []; }
    return n;
  }

  // Formular neu aufbauen, wenn eine Auswahl die Felder ändert
  function formularOeffnen(html, stand) {
    formStand = stand;
    U.modal(html, (dlg) => {
      if (dlg.dataset.wfHoerer) return; // nur einmal anhängen, der Dialog bleibt bestehen
      dlg.dataset.wfHoerer = '1';
      dlg.addEventListener('change', (e) => {
        const form = dlg.querySelector('form[data-neuaufbau]');
        if (!form || !formStand || !(e.target.matches('[data-neu]') || e.target.matches('[data-bed-feld]'))) return;
        neuAufbauen(form);
      });
    });
  }
  function neuAufbauen(form, mutation) {
    const s = formStand;
    if (s.art === 'ausloeser') { const a = ausloeserLesen(form); if (mutation) mutation(a.bedingungen); formularOeffnen(ausloeserFormular(a), s); }
    else { const k = knotenLesen(form, s.knoten); if (k.typ === 'aktion') k.params = Object.assign({}, s.knoten.params, k.params); if (mutation) mutation(k.bedingungen); s.knoten = k; formularOeffnen(knotenFormular(k, s.neu), s); }
  }

  // ------------------------------------------------ Aktionen
  const AK = CRM.actions;
  AK['wf-neu'] = () => {
    const v = J.vorlagen(art());
    U.modal(`${kopf('Neuer Workflow')}
      <p class="muted">Vorlage wählen und anpassen, oder leer beginnen. Neue Workflows starten ausgeschaltet.</p>
      <ul class="liste">${v.map((x, i) => `<li class="klickbar" data-action="wf-aus-vorlage" data-i="${i}"><span class="dehnen"><strong>${esc(x.name)}</strong><div class="klein">${esc(x.beschreibung)}</div><div class="meta">⚑ ${esc(beschreibeAusloeser(x.ausloeser))}</div></span><span class="muted">›</span></li>`).join('')}
        <li class="klickbar" data-action="wf-aus-vorlage" data-i="-1"><span class="dehnen"><strong>Leer beginnen</strong></span><span class="muted">›</span></li></ul>`);
  };
  AK['wf-aus-vorlage'] = sicher(async (d) => {
    const v = Number(d.i) >= 0 ? J.vorlagen(art())[Number(d.i)] : { name: 'Neuer Workflow', beschreibung: '', aktiv: false, mehrfach: false, ausloeser: { typ: 'kontakt_neu', bedingungen: [] }, schritte: [] };
    const w = await A().workflowSpeichern(v);
    U.closeModal();
    ed = null;
    location.hash = '#/workflows/' + w.id;
  });
  AK['wf-kopieren'] = sicher(async (d) => {
    const w = A().workflows().find((x) => x.id === d.id); if (!w) return;
    const kopie = JSON.parse(JSON.stringify(w)); delete kopie.id; kopie.name += ' (Kopie)'; kopie.aktiv = false;
    const neu = await A().workflowSpeichern(kopie);
    location.hash = '#/workflows/' + neu.id;
  });
  AK['wf-aktiv'] = sicher(async (d, el) => { const w = A().workflows().find((x) => x.id === d.id); if (!w) return; await A().workflowSpeichern(Object.assign({}, w, { aktiv: el.checked })); U.toast(el.checked ? 'Workflow aktiv' : 'Workflow pausiert', 'ok'); });
  AK['wf-speichern'] = sicher(async () => {
    if (!ed.wf.ausloeser || !ed.wf.ausloeser.typ) { U.toast('Erst einen Auslöser wählen', 'fehler'); return; }
    const w = await A().workflowSpeichern(ed.wf);
    ed = { wf: JSON.parse(JSON.stringify(w)), geaendert: false };
    U.toast('Workflow gespeichert' + (w.aktiv ? ' und aktiv' : ' (ausgeschaltet)'), 'ok');
    CRM.render();
  });
  AK['wf-loeschen'] = sicher(async () => {
    if (!confirm(`Workflow „${ed.wf.name}" löschen? Laufende Kontakte werden abgebrochen. Bereits angelegte Aufgaben bleiben.`)) return;
    await A().workflowLoeschen(ed.wf.id);
    ed = null;
    location.hash = '#/workflows';
  });
  AK['wf-ausloeser'] = () => formularOeffnen(ausloeserFormular(JSON.parse(JSON.stringify(ed.wf.ausloeser || { bedingungen: [] }))), { art: 'ausloeser' });
  AK['wf-ausloeser-speichern'] = (f, form) => {
    const a = ausloeserLesen(form);
    if (!a.typ) { U.toast('Auslöser wählen', 'fehler'); return; }
    ed.wf.ausloeser = a; U.closeModal(); geaendert();
  };
  AK['wf-bed-hinzu'] = (d, el) => neuAufbauen(el.closest('form'), (liste) => liste.push({ feld: 'status', op: 'ist', wert: A().statusWerte()[0] || '' }));
  AK['wf-bed-weg'] = (d, el) => { const form = el.closest('form'); el.closest('[data-bed]').remove(); neuAufbauen(form); };
  AK['wf-plus'] = (d) => {
    U.modal(`${kopf('Schritt einfügen')}<div class="wf-wahl">
      <button class="btn" data-action="wf-neuer-knoten" data-typ="aktion" data-ref="${esc(d.ref)}" data-index="${esc(d.index)}">⚡ Aktion<div class="klein muted">Aufgabe, Notiz, Schlagwort …</div></button>
      <button class="btn" data-action="wf-neuer-knoten" data-typ="bedingung" data-ref="${esc(d.ref)}" data-index="${esc(d.index)}">◇ Wenn/Dann<div class="klein muted">Verzweigung Ja / Nein</div></button>
      <button class="btn" data-action="wf-neuer-knoten" data-typ="warten" data-ref="${esc(d.ref)}" data-index="${esc(d.index)}">⏱ Warten<div class="klein muted">Tage oder Stunden</div></button>
      <button class="btn" data-action="wf-neuer-knoten" data-typ="ende" data-ref="${esc(d.ref)}" data-index="${esc(d.index)}">■ Ende<div class="klein muted">hier aufhören</div></button></div>`);
  };
  AK['wf-neuer-knoten'] = (d) => {
    const k = { id: J.neueId(), typ: d.typ };
    if (d.typ === 'aktion') { k.aktion = 'aufgabe'; k.params = { faelligTage: 0, zuweisen: 'betreuer' }; }
    if (d.typ === 'warten') { k.tage = 1; k.stunden = 0; }
    if (d.typ === 'bedingung') { k.bedingungen = [{ feld: 'ereignis_seit_start', op: 'vorhanden', wert: 'gespraech' }]; k.ja = []; k.nein = []; }
    formularOeffnen(knotenFormular(k, true), { art: 'knoten', knoten: k, neu: true, ref: d.ref, index: Number(d.index) });
  };
  AK['wf-knoten-bearbeiten'] = (d) => { const f = J.finde(ed.wf.schritte, d.id); if (f) formularOeffnen(knotenFormular(JSON.parse(JSON.stringify(f.knoten)), false), { art: 'knoten', knoten: JSON.parse(JSON.stringify(f.knoten)), neu: false }); };
  AK['wf-knoten-speichern'] = (f, form) => {
    const s = formStand;
    const k = knotenLesen(form, s.knoten);
    if (k.typ === 'aktion' && (aktionMeta(k.aktion).felder || []).includes('titel') && !k.params.titel) { U.toast('Titel fehlt', 'fehler'); return; }
    if (s.neu) { const liste = listeFuer(s.ref); liste.splice(s.index, 0, k); }
    else { const fnd = J.finde(ed.wf.schritte, k.id); if (fnd) fnd.liste[fnd.index] = k; }
    U.closeModal(); geaendert();
  };
  AK['wf-knoten-loeschen'] = (d) => {
    const f = J.finde(ed.wf.schritte, d.id); if (!f) return;
    if (f.knoten.typ === 'bedingung' && J.zaehleKnoten(f.knoten.ja) + J.zaehleKnoten(f.knoten.nein) > 0 && !confirm('Verzweigung samt allen Schritten in Ja und Nein löschen?')) return;
    f.liste.splice(f.index, 1); geaendert();
  };
  AK['wf-verschieben'] = (d) => { const f = J.finde(ed.wf.schritte, d.id); if (!f) return; const ziel = f.index + Number(d.richtung); if (ziel < 0 || ziel >= f.liste.length) return; const [k] = f.liste.splice(f.index, 1); f.liste.splice(ziel, 0, k); geaendert(); };
  AK['wf-lauf-stoppen'] = sicher(async (d) => { if (!confirm('Lauf für diesen Kontakt abbrechen?')) return; await A().laufAbbrechen(d.id); CRM.render(); });
  AK['wf-jetzt'] = sicher(async () => { U.toast('Workflows laufen …'); const r = await A().jetztAusfuehren(); U.toast('Fertig: ' + (r.aufgenommen || 0) + ' aufgenommen, ' + (r.effekte || 0) + ' Aktionen', 'ok'); CRM.render(); });

  // Test: Weg eines Kontakts simulieren, ohne etwas zu ändern (Wartezeiten werden übersprungen)
  AK['wf-testen'] = () => {
    const kontakte = A().kontakte().slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
    U.modal(`${kopf('Mit Kontakt testen')}<form data-submit="wf-test-start">
      <div class="feld"><label>Kontakt</label><select name="kontaktId" required>${U.options(kontakte.map((k) => [k.id, k.name]), '', '– wählen –')}</select></div>
      <p class="muted klein">Spielt den Workflow mit dem aktuellen Stand des Kontakts durch. Wartezeiten werden übersprungen, es wird nichts gespeichert.</p>
      ${knoepfe('Testen')}</form><div id="wf-test-ergebnis"></div>`);
  };
  AK['wf-test-start'] = (f) => {
    const wf = Object.assign({}, ed.wf, { aktiv: true });
    const k = A().kontakte().find((x) => x.id === f.kontaktId);
    const tps = A().tpsNachKontakt().get(f.kontaktId) || [];
    let jetzt = Date.now();
    let lauf = J.manuellAufnehmen(wf, f.kontaktId, jetzt);
    const ausloeserOk = (wf.ausloeser.bedingungen || []).every((b) => J.pruefe(b, { kontakt: k, tps, cfg: A().journeyKonfig() }));
    const effekte = [];
    for (let i = 0; i < 25 && lauf.status === 'laeuft'; i++) {
      const r = J.ausfuehren(wf, lauf, { jetzt, kontakt: k, tps, bezug: null, cfg: A().journeyKonfig() });
      effekte.push(...r.effekte); lauf = r.lauf;
      if (lauf.status === 'laeuft' && lauf.weiterAb) jetzt = Date.parse(lauf.weiterAb) + 1000; else if (lauf.status === 'laeuft') break;
    }
    document.getElementById('wf-test-ergebnis').innerHTML = `
      ${ausloeserOk ? '' : '<div class="hinweis">Achtung: Die „Nur wenn"-Bedingungen des Auslösers treffen auf diesen Kontakt nicht zu. Er würde nicht automatisch aufgenommen.</div>'}
      <h3>Ablauf</h3><ol class="klein">${lauf.protokoll.map((p) => `<li>${esc(p.text)}</li>`).join('')}</ol>
      <h3>Das würde passieren</h3>${effekte.length ? `<ul class="klein">${effekte.map((e) => `<li><strong>${esc(aktionMeta(e.aktion).name)}</strong>${e.titel ? ': ' + esc(e.titel) : ''}${e.text ? ': ' + esc(e.text) : ''}${e.tag ? ': ' + esc(e.tag) : ''}${e.status ? ': ' + esc(e.status) : ''}${e.phase ? ': ' + esc(e.phase) : ''}${e.faelligTage != null ? ' (fällig in ' + e.faelligTage + ' Tagen)' : ''}</li>`).join('')}</ul>` : '<p class="muted klein">Keine Aktionen.</p>'}`;
  };

  CRM.views.workflows = { render, mount, titel: 'Workflows' };
  CRM.workflowUI = { beschreibeAusloeser, beschreibeKnoten };
})(window.CRM);
