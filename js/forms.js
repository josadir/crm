// Formulare (Modal) und die zugehörigen Aktionen für alle Datensätze.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, esc = U.esc;
  CRM.actions = CRM.actions || {};
  const A = CRM.actions;

  const kontaktOptionen = (gewaehlt) => U.options(
    U.sortiere(S.data.contacts, 'firma').map((c) => [c.id, (c.firma || c.person || '(ohne Namen)') + (c.firma && c.person ? ' · ' + c.person : '')]),
    gewaehlt, '– kein Kontakt –');
  const auftragOptionen = (gewaehlt, nurOffen) => U.options(
    U.sortiere(S.data.orders.filter((o) => !nurOffen || o.status !== 'Berechnet'), 'nummer', true).map((o) => [o.id, o.nummer + ' · ' + o.titel + ' · ' + S.kontaktName(o.contactId)]),
    gewaehlt, '– kein Auftrag –');
  const aktionen = (loeschAktion, id) => `<div class="form-aktionen">
      ${loeschAktion && id ? `<button type="button" class="btn btn-gefahr links" data-action="${loeschAktion}" data-id="${esc(id)}">Löschen</button>` : ''}
      <button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button>
      <button type="submit" class="btn btn-primary">Speichern</button></div>`;
  // Fehler aus dem Store als Toast, statt die Seite abzuschießen
  const sicher = (fn) => (...args) => { try { return fn(...args); } catch (e) { U.toast(e.message, 'fehler'); return null; } };
  // Vorgaben ohne undefined/null, damit sie Standardwerte nicht überschreiben
  const rein = (o) => { const r = {}; for (const k in (o || {})) if (o[k] !== undefined && o[k] !== null && o[k] !== '') r[k] = o[k]; return r; };

  // ---------- Kontakt
  function kontaktFormular(c) {
    c = c || {};
    const neu = !c.id;
    return `
      <h3>${neu ? 'Neuer Kontakt' : 'Kontakt bearbeiten'}</h3>
      <form data-submit="kontakt-speichern">
        <input type="hidden" name="id" value="${esc(c.id || '')}">
        <div class="feld-reihe">
          <div class="feld"><label>Firma</label><input name="firma" value="${esc(c.firma)}" autocomplete="off"></div>
          <div class="feld"><label>Ansprechperson</label><input name="person" value="${esc(c.person)}" autocomplete="off"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>E-Mail</label><input name="email" type="email" value="${esc(c.email)}"></div>
          <div class="feld"><label>Telefon</label><input name="telefon" value="${esc(c.telefon)}"></div>
        </div>
        <div class="feld"><label>Straße und Hausnummer (Rechnungsanschrift)</label><input name="strasse" value="${esc(c.strasse)}"></div>
        <div class="feld-reihe">
          <div class="feld"><label>PLZ</label><input name="plz" value="${esc(c.plz)}"></div>
          <div class="feld"><label>Ort</label><input name="ort" value="${esc(c.ort)}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Land</label><input name="land" value="${esc(c.land || 'Deutschland')}"></div>
          <div class="feld"><label>USt-IdNr. (optional)</label><input name="ustId" value="${esc(c.ustId)}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Website</label><input name="website" value="${esc(c.website)}" placeholder="https://"></div>
          <div class="feld"><label>Branche</label><input name="branche" list="branchen" value="${esc(c.branche)}">
            <datalist id="branchen">${[...new Set(S.data.contacts.map((x) => x.branche).filter(Boolean))].map((b) => `<option value="${esc(b)}">`).join('')}</datalist></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Quelle</label><select name="quelle">${U.options(K.QUELLEN, c.quelle, '– bitte wählen –')}</select></div>
          <div class="feld"><label>Status</label><select name="status">${U.options(K.STATUS, c.status || 'Interessent')}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld feld-check" style="align-self:end"><input type="checkbox" id="einw" name="einwilligungEmail" ${c.einwilligungEmail ? 'checked' : ''}><label for="einw">Einwilligung E-Mail-Werbung liegt vor</label></div>
          <div class="feld"><label>Einwilligung seit</label><input name="einwilligungDatum" type="date" value="${esc(c.einwilligungDatum)}"></div>
        </div>
        <div class="feld feld-check"><input type="checkbox" id="einwt" name="einwilligungTracking" ${c.einwilligungTracking ? 'checked' : ''}><label for="einwt">Einwilligung in die Erfolgsmessung (Öffnungen und Klicks im Newsletter)</label></div>
        <div class="feld"><label>Schlagwörter (mit Komma)</label><input name="tags" value="${esc((c.tags || []).join(', '))}" placeholder="Newsletter, Schulung"></div>
        <div class="feld"><label>Notizen</label><textarea name="notizen">${esc(c.notizen)}</textarea></div>
        ${aktionen('kontakt-loeschen', c.id)}
      </form>`;
  }
  A['kontakt-neu'] = () => U.modal(kontaktFormular());
  A['kontakt-bearbeiten'] = (d) => { const c = S.kontakt(d.id); if (c) U.modal(kontaktFormular(c)); };
  A['kontakt-speichern'] = (f) => {
    if (!f.firma && !f.person) { U.toast('Firma oder Ansprechperson angeben', 'fehler'); return; }
    if (f.einwilligungEmail && !f.einwilligungDatum) f.einwilligungDatum = U.heute();
    if (!f.einwilligungEmail) f.einwilligungDatum = '';
    f.tags = String(f.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const id = f.id; delete f.id;
    if (id) { S.aendereKontakt(id, f); U.toast('Kontakt gespeichert', 'ok'); }
    else { const c = S.neuerKontakt(f); U.toast('Kontakt angelegt', 'ok'); location.hash = '#/kontakte/' + c.id; }
    U.closeModal();
  };
  A['kontakt-loeschen'] = sicher((d) => {
    const c = S.kontakt(d.id); if (!c) return;
    const n = S.data.deals.filter((x) => x.contactId === c.id).length;
    if (!confirm(`„${c.firma || c.person}" endgültig löschen?` + (n ? `\nDamit verschwinden auch ${n} Vorgang/Vorgänge, alle Aktivitäten, Aufgaben und Termine dazu.` : ''))) return;
    S.loescheKontakt(c.id);
    U.closeModal();
    U.toast('Kontakt gelöscht');
    if (location.hash.startsWith('#/kontakte/')) location.hash = '#/kontakte';
  });

  // ---------- Vorgang (Pipeline)
  function vorgangFormular(d, vorgabe) {
    d = Object.assign({ contactId: '', titel: '', phase: 'Anfrage', wert: 0, naechsterSchritt: '', faellig: '', verlustgrund: '', notizen: '', nachbereitung: {} }, rein(vorgabe), d || {});
    const neu = !d.id;
    const nb = d.nachbereitung || {};
    const belege = neu ? '' : [
      ...S.data.quotes.filter((q) => q.dealId === d.id).map((q) => `<a href="#/angebote/${esc(q.id)}" data-action="modal-link">${esc(q.nummer)}</a>`),
      ...S.data.orders.filter((o) => o.dealId === d.id).map((o) => `<a href="#/auftraege/${esc(o.id)}" data-action="modal-link">${esc(o.nummer)}</a>`),
    ].join(', ');
    return `
      <h3>${neu ? 'Neuer Vorgang' : 'Vorgang bearbeiten'}</h3>
      <form data-submit="vorgang-speichern">
        <input type="hidden" name="id" value="${esc(d.id || '')}">
        <div class="feld"><label>Titel (was wird verkauft?)</label><input name="titel" value="${esc(d.titel)}" required autocomplete="off"></div>
        <div class="feld"><label>Kontakt</label><select name="contactId" required>${kontaktOptionen(d.contactId)}</select></div>
        <div class="feld-reihe">
          <div class="feld"><label>Phase</label><select name="phase" data-phase>${U.options(K.PHASEN, d.phase)}</select></div>
          <div class="feld"><label>Erwarteter Wert netto (€)</label><input name="wert" type="number" min="0" step="50" value="${esc(d.wert || '')}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Nächster Schritt</label><input name="naechsterSchritt" value="${esc(d.naechsterSchritt)}"></div>
          <div class="feld"><label>Fällig am</label><input name="faellig" type="date" value="${esc(d.faellig)}"></div>
        </div>
        <div class="feld" data-verlust ${d.phase === 'Verloren' ? '' : 'hidden'}><label>Verlustgrund</label><select name="verlustgrund">${U.options(K.VERLUST, d.verlustgrund, '– bitte wählen –')}</select></div>
        <div data-nachbereitung ${['Nachbereitung', 'Gewonnen'].includes(d.phase) ? '' : 'hidden'}>
          <label>Nachbereitung nach dem Kaufabschluss</label>
          ${K.NACHBEREITUNG.map(([k, text]) => `<div class="feld feld-check"><input type="checkbox" id="nb_${k}" name="nb_${k}" ${nb[k] ? 'checked' : ''}><label for="nb_${k}">${esc(text)}</label></div>`).join('')}
        </div>
        <div class="feld"><label>Notizen</label><textarea name="notizen">${esc(d.notizen)}</textarea></div>
        ${belege ? `<p class="klein muted">Belege zu diesem Vorgang: ${belege}</p>` : ''}
        <div class="form-aktionen">
          ${neu ? '' : `<button type="button" class="btn btn-gefahr links" data-action="vorgang-loeschen" data-id="${esc(d.id)}">Löschen</button>`}
          ${neu ? '' : `<button type="button" class="btn" data-action="vorgang-angebot" data-id="${esc(d.id)}">Angebot erstellen</button>`}
          <button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button>
          <button type="submit" class="btn btn-primary">Speichern</button>
        </div>
      </form>`;
  }
  const verlustUmschalten = (dlg) => {
    const sel = dlg.querySelector('[data-phase]'), feld = dlg.querySelector('[data-verlust]'), nb = dlg.querySelector('[data-nachbereitung]');
    if (sel) sel.addEventListener('change', () => { if (feld) feld.hidden = sel.value !== 'Verloren'; if (nb) nb.hidden = !['Nachbereitung', 'Gewonnen'].includes(sel.value); });
  };
  A['modal-link'] = (d, el) => { U.closeModal(); location.hash = el.getAttribute('href'); };
  A['vorgang-neu'] = (d) => {
    if (!S.data.contacts.length) { U.toast('Erst einen Kontakt anlegen', 'fehler'); return; }
    U.modal(vorgangFormular(null, { contactId: d && d.contactId }), verlustUmschalten);
  };
  A['vorgang-bearbeiten'] = (d) => { const v = S.vorgang(d.id); if (v) U.modal(vorgangFormular(v), verlustUmschalten); };
  A['vorgang-speichern'] = (f) => {
    if (!f.titel) { U.toast('Titel fehlt', 'fehler'); return; }
    if (!f.contactId) { U.toast('Kontakt fehlt', 'fehler'); return; }
    if (f.phase === 'Verloren' && !f.verlustgrund) { U.toast('Verlustgrund angeben', 'fehler'); return; }
    const id = f.id; delete f.id;
    f.nachbereitung = {};
    K.NACHBEREITUNG.forEach(([k]) => { f.nachbereitung[k] = !!f['nb_' + k]; delete f['nb_' + k]; });
    if (id) S.aendereVorgang(id, f); else S.neuerVorgang(f);
    U.closeModal();
    U.toast('Vorgang gespeichert', 'ok');
  };
  A['vorgang-loeschen'] = (d) => {
    const v = S.vorgang(d.id); if (!v) return;
    if (!confirm(`Vorgang „${v.titel}" löschen?`)) return;
    S.loescheVorgang(v.id);
    U.closeModal();
    U.toast('Vorgang gelöscht');
  };
  A['vorgang-phase'] = (d) => {
    const v = S.vorgang(d.id); if (!v || v.phase === d.phase) return;
    if (d.phase === 'Verloren') {
      U.modal(`
        <h3>Vorgang verloren</h3>
        <form data-submit="vorgang-verloren">
          <input type="hidden" name="id" value="${esc(v.id)}">
          <div class="feld"><label>Verlustgrund für „${esc(v.titel)}"</label><select name="verlustgrund" required>${U.options(K.VERLUST, '', '– bitte wählen –')}</select></div>
          <div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div>
        </form>`);
      return;
    }
    S.aendereVorgang(v.id, { phase: d.phase });
  };
  A['vorgang-verloren'] = (f) => {
    if (!f.verlustgrund) { U.toast('Verlustgrund angeben', 'fehler'); return; }
    S.aendereVorgang(f.id, { phase: 'Verloren', verlustgrund: f.verlustgrund });
    U.closeModal();
  };
  // Aus einem Vorgang direkt ein Angebot anlegen
  A['vorgang-angebot'] = (d) => {
    const v = S.vorgang(d.id); if (!v) return;
    const q = S.neuesAngebot({ contactId: v.contactId, dealId: v.id, titel: v.titel });
    U.closeModal();
    location.hash = '#/angebote/' + q.id;
  };

  // ---------- Aufgabe
  function aufgabeFormular(t, vorgabe) {
    t = Object.assign({ contactId: '', dealId: '', orderId: '', titel: '', faellig: '', prioritaet: 'Normal' }, rein(vorgabe), t || {});
    const neu = !t.id;
    return `
      <h3>${neu ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}</h3>
      <form data-submit="aufgabe-speichern">
        <input type="hidden" name="id" value="${esc(t.id || '')}">
        <div class="feld"><label>Was ist zu tun?</label><input name="titel" value="${esc(t.titel)}" required autocomplete="off"></div>
        <div class="feld-reihe">
          <div class="feld"><label>Fällig am</label><input name="faellig" type="date" value="${esc(t.faellig)}"></div>
          <div class="feld"><label>Priorität</label><select name="prioritaet">${U.options(K.PRIORITAET, t.prioritaet)}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Kontakt</label><select name="contactId">${kontaktOptionen(t.contactId)}</select></div>
          <div class="feld"><label>Auftrag</label><select name="orderId">${auftragOptionen(t.orderId, true)}</select></div>
        </div>
        ${aktionen('aufgabe-loeschen', t.id)}
      </form>`;
  }
  A['aufgabe-neu'] = (d) => U.modal(aufgabeFormular(null, { contactId: d && d.contactId, orderId: d && d.orderId }));
  A['aufgabe-bearbeiten'] = (d) => { const t = S.aufgabe(d.id); if (t) U.modal(aufgabeFormular(t)); };
  A['aufgabe-speichern'] = (f) => {
    if (!f.titel) { U.toast('Titel fehlt', 'fehler'); return; }
    if (f.orderId && !f.contactId) { const o = S.auftrag(f.orderId); if (o) f.contactId = o.contactId; }
    const id = f.id; delete f.id;
    if (id) S.aendereAufgabe(id, f); else S.neueAufgabe(f);
    U.closeModal();
    U.toast('Aufgabe gespeichert', 'ok');
  };
  A['aufgabe-erledigt'] = (d, el) => S.erledigeAufgabe(d.id, el.checked);
  A['aufgabe-loeschen'] = (d) => { if (!confirm('Aufgabe löschen?')) return; S.loescheAufgabe(d.id); U.closeModal(); };

  // ---------- Aktivität (Gesprächsverlauf)
  A['aktivitaet-speichern'] = (f, form) => {
    if (!f.text) { U.toast('Text fehlt', 'fehler'); return; }
    S.neueAktivitaet({ contactId: f.contactId, dealId: f.dealId || '', orderId: f.orderId || '', typ: f.typ, betreff: f.betreff || '', text: f.text, datum: f.datum ? new Date(f.datum).toISOString() : U.nowIso() });
    form.reset();
  };
  function aktivitaetFormular(a, vorgabe) {
    a = Object.assign({ contactId: '', dealId: '', typ: 'Gespräch', betreff: '', text: '', datum: U.nowIso() }, rein(vorgabe), a || {});
    const neu = !a.id;
    const lokal = new Date(a.datum); const dt = `${U.localDate(lokal)}T${String(lokal.getHours()).padStart(2, '0')}:${String(lokal.getMinutes()).padStart(2, '0')}`;
    const vorgaenge = S.data.deals.filter((d) => d.contactId === a.contactId).map((d) => [d.id, d.titel + ' (' + d.phase + ')']);
    return `
      <h3>${neu ? 'Gespräch / Eintrag erfassen' : 'Eintrag bearbeiten'}</h3>
      <form data-submit="aktivitaet-formular-speichern">
        <input type="hidden" name="id" value="${esc(a.id || '')}">
        <div class="feld"><label>Kontakt</label><select name="contactId" required>${kontaktOptionen(a.contactId)}</select></div>
        <div class="feld-reihe">
          <div class="feld"><label>Art</label><select name="typ">${U.options(K.AKTIVITAET, a.typ)}</select></div>
          <div class="feld"><label>Zeitpunkt</label><input name="datum" type="datetime-local" value="${dt}"></div>
        </div>
        <div class="feld"><label>Betreff / Thema</label><input name="betreff" value="${esc(a.betreff)}" autocomplete="off"></div>
        <div class="feld"><label>Verlauf, Ergebnis, Vereinbarungen</label><textarea name="text" style="min-height:120px" required>${esc(a.text)}</textarea></div>
        ${vorgaenge.length ? `<div class="feld"><label>Bezug zu Vorgang</label><select name="dealId">${U.options(vorgaenge, a.dealId, '– keiner –')}</select></div>` : ''}
        ${aktionen('aktivitaet-loeschen', a.id)}
      </form>`;
  }
  A['aktivitaet-neu'] = (d) => U.modal(aktivitaetFormular(null, { contactId: d && d.contactId }));
  A['aktivitaet-bearbeiten'] = (d) => { const a = S.data.activities.find((x) => x.id === d.id); if (a) U.modal(aktivitaetFormular(a)); };
  A['aktivitaet-formular-speichern'] = (f) => {
    if (!f.contactId || !f.text) { U.toast('Kontakt und Text angeben', 'fehler'); return; }
    const id = f.id; delete f.id;
    f.datum = f.datum ? new Date(f.datum).toISOString() : U.nowIso();
    if (id) S.aendereAktivitaet(id, f); else S.neueAktivitaet(f);
    U.closeModal();
    U.toast('Eintrag gespeichert', 'ok');
  };
  A['aktivitaet-loeschen'] = (d) => { if (confirm('Eintrag löschen?')) { S.loescheAktivitaet(d.id); U.closeModal(); } };

  // ---------- Angebot
  function angebotFormular(q, vorgabe) {
    q = Object.assign({ contactId: '', dealId: '', titel: '', einleitung: 'vielen Dank für Ihr Interesse. Gerne unterbreite ich Ihnen folgendes Angebot:', datum: U.heute(), gueltigBis: U.inTagen(Number(S.data.stammdaten.angebotGueltigTage) || 30), notizen: '' }, rein(vorgabe), q || {});
    const neu = !q.id;
    return `
      <h3>${neu ? 'Neues Angebot' : 'Angebot ' + esc(q.nummer) + ' bearbeiten'}</h3>
      <form data-submit="angebot-speichern">
        <input type="hidden" name="id" value="${esc(q.id || '')}">
        <div class="feld"><label>Kontakt (Empfänger)</label><select name="contactId" required>${kontaktOptionen(q.contactId)}</select></div>
        <div class="feld"><label>Titel / Betreff</label><input name="titel" value="${esc(q.titel)}" required autocomplete="off"></div>
        <div class="feld-reihe">
          <div class="feld"><label>Angebotsdatum</label><input name="datum" type="date" value="${esc(q.datum)}" required></div>
          <div class="feld"><label>Gültig bis</label><input name="gueltigBis" type="date" value="${esc(q.gueltigBis)}"></div>
        </div>
        <div class="feld"><label>Einleitungstext (nach der Anrede)</label><textarea name="einleitung">${esc(q.einleitung)}</textarea></div>
        <div class="feld"><label>Interne Notizen (nicht auf dem Beleg)</label><textarea name="notizen" style="min-height:40px">${esc(q.notizen)}</textarea></div>
        <p class="muted klein">Positionen werden danach in der Angebotsansicht erfasst.</p>
        ${aktionen(null)}
      </form>`;
  }
  A['angebot-neu'] = (d) => {
    if (!S.data.contacts.length) { U.toast('Erst einen Kontakt anlegen', 'fehler'); return; }
    U.modal(angebotFormular(null, { contactId: d && d.contactId }));
  };
  A['angebot-bearbeiten'] = (d) => { const q = S.angebot(d.id); if (!q) return; if (q.status !== 'Entwurf') { U.toast('Nur Entwürfe lassen sich bearbeiten. Kopie anlegen.', 'fehler'); return; } U.modal(angebotFormular(q)); };
  A['angebot-speichern'] = (f) => {
    if (!f.contactId || !f.titel) { U.toast('Kontakt und Titel angeben', 'fehler'); return; }
    const id = f.id; delete f.id;
    let q;
    if (id) q = S.aendereAngebot(id, f); else q = S.neuesAngebot(f);
    U.closeModal();
    location.hash = '#/angebote/' + q.id;
  };
  A['angebot-status'] = sicher((d) => {
    const q = S.angebot(d.id); if (!q) return;
    if (d.status === 'Angenommen') {
      if (!confirm(`Angebot ${q.nummer} als angenommen markieren und daraus Auftrag anlegen?`)) return;
      const o = S.angebotZuAuftrag(q.id);
      U.toast('Auftrag ' + o.nummer + ' angelegt', 'ok');
      location.hash = '#/auftraege/' + o.id;
      return;
    }
    if (d.status === 'Gesendet' && !q.positionen.length) { U.toast('Angebot ohne Positionen kann nicht gesendet werden', 'fehler'); return; }
    S.setzeAngebotStatus(q.id, d.status);
  });
  A['angebot-kopieren'] = (d) => { const q = S.kopiereAngebot(d.id); if (q) { U.toast('Kopie ' + q.nummer + ' als Entwurf angelegt', 'ok'); location.hash = '#/angebote/' + q.id; } };

  // ---------- Auftrag
  function auftragFormular(o, vorgabe) {
    o = Object.assign({ contactId: '', titel: '', beschreibung: '', datum: U.heute(), faellig: '', stundensatz: Number(S.data.stammdaten.stundensatz) || 0, budget: 0, notizen: '' }, rein(vorgabe), o || {});
    const neu = !o.id;
    return `
      <h3>${neu ? 'Neuer Auftrag' : 'Auftrag ' + esc(o.nummer) + ' bearbeiten'}</h3>
      <form data-submit="auftrag-speichern">
        <input type="hidden" name="id" value="${esc(o.id || '')}">
        <div class="feld"><label>Kontakt (Auftraggeber)</label><select name="contactId" required>${kontaktOptionen(o.contactId)}</select></div>
        <div class="feld"><label>Titel</label><input name="titel" value="${esc(o.titel)}" required autocomplete="off"></div>
        <div class="feld"><label>Beschreibung / Leistungsumfang</label><textarea name="beschreibung">${esc(o.beschreibung)}</textarea></div>
        <div class="feld-reihe">
          <div class="feld"><label>Auftragsdatum</label><input name="datum" type="date" value="${esc(o.datum)}" required></div>
          <div class="feld"><label>Fertigstellung bis</label><input name="faellig" type="date" value="${esc(o.faellig)}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Stundensatz netto (€) für Zeiten</label><input name="stundensatz" type="number" min="0" step="5" value="${esc(o.stundensatz || '')}"></div>
          <div class="feld"><label>Budget netto (€, optional)</label><input name="budget" type="number" min="0" step="50" value="${esc(o.budget || '')}"></div>
        </div>
        <div class="feld"><label>Interne Notizen</label><textarea name="notizen" style="min-height:40px">${esc(o.notizen)}</textarea></div>
        ${aktionen(null)}
      </form>`;
  }
  A['auftrag-neu'] = (d) => {
    if (!S.data.contacts.length) { U.toast('Erst einen Kontakt anlegen', 'fehler'); return; }
    U.modal(auftragFormular(null, { contactId: d && d.contactId }));
  };
  A['auftrag-bearbeiten'] = (d) => { const o = S.auftrag(d.id); if (o) U.modal(auftragFormular(o)); };
  A['auftrag-speichern'] = (f) => {
    if (!f.contactId || !f.titel) { U.toast('Kontakt und Titel angeben', 'fehler'); return; }
    const id = f.id; delete f.id;
    let o;
    if (id) o = S.aendereAuftrag(id, f); else o = S.neuerAuftrag(f);
    U.closeModal();
    location.hash = '#/auftraege/' + o.id;
  };
  A['auftrag-status'] = sicher((d) => {
    const o = S.auftrag(d.id); if (!o) return;
    if (d.status === 'Berechnet') { U.toast('„Berechnet" entsteht durch das Stellen der Rechnung', 'fehler'); return; }
    S.setzeAuftragStatus(o.id, d.status);
  });
  A['zeiten-abrechnen'] = sicher((d) => {
    const n = S.unabgerechneteZeiten(d.id).length;
    if (!confirm(`${n} Zeiteinträge als eine Position in den Auftrag übernehmen? Die Einträge sind danach eingefroren.`)) return;
    S.zeitenAbrechnen(d.id);
    U.toast('Zeiten als Position übernommen', 'ok');
  });

  // ---------- Position (Angebot oder Auftrag)
  function positionFormular(belegart, belegId, p) {
    p = Object.assign(S.positionNeu({ einzelpreis: Number(S.data.stammdaten.stundensatz) || 0 }), p || {});
    const neu = !p.id || !(belegart === 'angebot' ? S.angebot(belegId) : S.auftrag(belegId)).positionen.some((x) => x.id === p.id);
    return `
      <h3>${neu ? 'Position hinzufügen' : 'Position bearbeiten'}</h3>
      <form data-submit="position-speichern">
        <input type="hidden" name="belegart" value="${esc(belegart)}"><input type="hidden" name="belegId" value="${esc(belegId)}"><input type="hidden" name="id" value="${neu ? '' : esc(p.id)}">
        <div class="feld-reihe">
          <div class="feld"><label>Art</label><select name="art">${U.options(K.POSITIONSARTEN, p.art)}</select></div>
          <div class="feld"><label>Steuersatz %</label><select name="steuersatz">${U.options(K.STEUERSAETZE.map(String), String(p.steuersatz))}</select></div>
        </div>
        <div class="feld"><label>Bezeichnung (erscheint auf dem Beleg)</label><textarea name="bezeichnung" style="min-height:50px" required>${esc(p.bezeichnung)}</textarea></div>
        <div class="feld-reihe">
          <div class="feld"><label>Menge</label><input name="menge" type="number" step="0.25" value="${esc(p.menge)}" required></div>
          <div class="feld"><label>Einheit</label><select name="einheit">${U.options(K.EINHEITEN, p.einheit)}</select></div>
        </div>
        <div class="feld"><label>Einzelpreis netto (€)</label><input name="einzelpreis" type="number" step="0.01" value="${esc(p.einzelpreis)}" required></div>
        ${aktionen(null)}
      </form>`;
  }
  A['position-neu'] = (d) => U.modal(positionFormular(d.belegart, d.belegId));
  A['position-bearbeiten'] = (d) => {
    const b = d.belegart === 'angebot' ? S.angebot(d.belegId) : S.auftrag(d.belegId);
    const p = b && b.positionen.find((x) => x.id === d.id);
    if (p) U.modal(positionFormular(d.belegart, d.belegId, p));
  };
  A['position-speichern'] = sicher((f) => {
    if (!f.bezeichnung) { U.toast('Bezeichnung fehlt', 'fehler'); return; }
    const { belegart, belegId } = f; delete f.belegart; delete f.belegId;
    if (!f.id) delete f.id;
    f.steuersatz = Number(f.steuersatz);
    S.positionSpeichern(belegart, belegId, f);
    U.closeModal();
  });
  A['position-loeschen'] = sicher((d) => { if (confirm('Position löschen?')) S.positionLoeschen(d.belegart, d.belegId, d.id); });

  // ---------- Rechnung
  A['rechnung-erstellen'] = (d) => {
    const o = S.auftrag(d.orderId); if (!o) return;
    if (!o.positionen.length) { U.toast('Auftrag hat keine Positionen', 'fehler'); return; }
    const s = S.data.stammdaten;
    const sum = S.summen(o.positionen, s.kleinunternehmer);
    const zeiten = S.data.times.filter((t) => t.orderId === o.id).map((t) => t.datum).sort();
    U.modal(`
      <h3>Rechnung zu ${esc(o.nummer)} stellen</h3>
      <p class="muted klein">Die Rechnung erhält die nächste Nummer und friert ${o.positionen.length} Position(en), Empfänger und Absender ein. Netto ${U.fmtEur(sum.netto)}, brutto ${U.fmtEur(sum.brutto)}.</p>
      ${!s.name && !s.firma ? '<div class="hinweis fehler">Stammdaten (Absender) fehlen. Bitte zuerst unter Einstellungen ausfüllen.</div>' : ''}
      <form data-submit="rechnung-speichern">
        <input type="hidden" name="orderId" value="${esc(o.id)}">
        <div class="feld-reihe">
          <div class="feld"><label>Rechnungsdatum</label><input name="datum" type="date" value="${U.heute()}" required></div>
          <div class="feld"><label>Zahlungsziel (Tage)</label><input name="zahlungszielTage" type="number" min="0" value="${esc(s.zahlungszielTage || 14)}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Leistungszeitraum von</label><input name="leistungVon" type="date" value="${esc(zeiten[0] || o.datum)}"></div>
          <div class="feld"><label>bis</label><input name="leistungBis" type="date" value="${esc(zeiten[zeiten.length - 1] || o.fertigAm || U.heute())}"></div>
        </div>
        <div class="feld"><label>Hinweis auf der Rechnung (optional)</label><input name="hinweis" placeholder="z. B. Abschlagsrechnung, Projektnummer des Kunden"></div>
        <div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Rechnung stellen</button></div>
      </form>`);
  };
  A['rechnung-speichern'] = sicher((f) => {
    const r = S.neueRechnung(f);
    U.closeModal();
    U.toast('Rechnung ' + r.nummer + ' gestellt', 'ok');
    location.hash = '#/rechnungen/' + r.id;
  });
  // Schnellrechnung: ein Auftrag mit einer Position, sofort berechnet
  A['rechnung-schnell'] = (d) => {
    if (!S.data.contacts.length) { U.toast('Erst einen Kontakt anlegen', 'fehler'); return; }
    U.modal(`
      <h3>Schnellrechnung</h3>
      <p class="muted klein">Legt einen Auftrag mit einer Position an und stellt sofort die Rechnung.</p>
      <form data-submit="rechnung-schnell-speichern">
        <div class="feld"><label>Kontakt</label><select name="contactId" required>${kontaktOptionen(d && d.contactId)}</select></div>
        <div class="feld"><label>Leistung (Bezeichnung)</label><input name="bezeichnung" required autocomplete="off"></div>
        <div class="feld-reihe">
          <div class="feld"><label>Menge</label><input name="menge" type="number" step="0.25" value="1" required></div>
          <div class="feld"><label>Einheit</label><select name="einheit">${U.options(K.EINHEITEN, 'pauschal')}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Einzelpreis netto (€)</label><input name="einzelpreis" type="number" step="0.01" required></div>
          <div class="feld"><label>Steuersatz %</label><select name="steuersatz">${U.options(K.STEUERSAETZE.map(String), String(S.data.stammdaten.steuersatz || 19))}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Leistungsdatum</label><input name="leistung" type="date" value="${U.heute()}"></div>
          <div class="feld"><label>Rechnungsdatum</label><input name="datum" type="date" value="${U.heute()}"></div>
        </div>
        <div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Rechnung stellen</button></div>
      </form>`);
  };
  A['rechnung-schnell-speichern'] = sicher((f) => {
    const o = S.neuerAuftrag({ contactId: f.contactId, titel: f.bezeichnung, datum: f.leistung || U.heute(), positionen: [S.positionNeu({ art: 'Leistung', bezeichnung: f.bezeichnung, menge: f.menge, einheit: f.einheit, einzelpreis: f.einzelpreis, steuersatz: Number(f.steuersatz) })] });
    S.setzeAuftragStatus(o.id, 'Fertig');
    const r = S.neueRechnung({ orderId: o.id, datum: f.datum, leistungVon: f.leistung, leistungBis: f.leistung });
    U.closeModal();
    U.toast('Rechnung ' + r.nummer + ' gestellt', 'ok');
    location.hash = '#/rechnungen/' + r.id;
  });
  A['rechnung-bezahlt'] = (d) => {
    const r = S.rechnung(d.id); if (!r) return;
    U.modal(`
      <h3>Zahlung zu ${esc(r.nummer)} erfassen</h3>
      <form data-submit="rechnung-bezahlt-speichern">
        <input type="hidden" name="id" value="${esc(r.id)}">
        <div class="feld-reihe">
          <div class="feld"><label>Zahlungseingang am</label><input name="datum" type="date" value="${U.heute()}" required></div>
          <div class="feld"><label>Zahlungsart</label><select name="zahlungsart">${U.options(K.ZAHLUNGSARTEN, 'Überweisung')}</select></div>
        </div>
        <p class="muted klein">Betrag: ${U.fmtEur(r.brutto)}</p>
        <div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Als bezahlt markieren</button></div>
      </form>`);
  };
  A['rechnung-bezahlt-speichern'] = sicher((f) => { S.markiereBezahlt(f.id, f.datum, f.zahlungsart); U.closeModal(); U.toast('Zahlung erfasst', 'ok'); });
  A['rechnung-bezahlt-zurueck'] = sicher((d) => { if (confirm('Zahlung zurücknehmen? Die Rechnung ist danach wieder offen.')) S.bezahltZuruecknehmen(d.id); });
  A['rechnung-mahnen'] = sicher((d) => {
    const r = S.rechnung(d.id); if (!r) return;
    const stufe = Math.min(r.mahnungen.length, K.MAHNSTUFEN.length - 1);
    const notiz = prompt(`${K.MAHNSTUFEN[stufe]} zu ${r.nummer} eintragen. Notiz (optional):`, '');
    if (notiz === null) return;
    S.mahnen(r.id, stufe, notiz);
    U.toast(K.MAHNSTUFEN[stufe] + ' eingetragen', 'ok');
  });
  A['rechnung-storno'] = sicher((d) => {
    const r = S.rechnung(d.id); if (!r) return;
    const grund = prompt(`Rechnung ${r.nummer} stornieren? Es entsteht ein Storno-Beleg mit negativen Beträgen, das Original bleibt erhalten.\nGrund:`, '');
    if (grund === null) return;
    const st = S.storniere(r.id, grund);
    U.toast('Storno-Beleg ' + st.nummer + ' angelegt', 'ok');
    location.hash = '#/rechnungen/' + st.id;
  });

  // ---------- Zeit
  function zeitFormular(t, vorgabe) {
    t = Object.assign({ datum: U.heute(), orderId: '', minuten: 60, beschreibung: '', abrechenbar: true }, rein(vorgabe), t || {});
    const neu = !t.id;
    const h = Math.floor(t.minuten / 60), m = t.minuten % 60;
    return `
      <h3>${neu ? 'Zeit erfassen' : 'Zeit bearbeiten'}</h3>
      <form data-submit="zeit-speichern">
        <input type="hidden" name="id" value="${esc(t.id || '')}">
        <div class="feld-reihe">
          <div class="feld"><label>Datum</label><input name="datum" type="date" value="${esc(t.datum)}" required></div>
          <div class="feld"><label>Dauer</label><div style="display:flex;gap:6px;align-items:center"><input name="stunden" type="number" min="0" value="${h}" style="width:70px"> h <input name="min" type="number" min="0" max="59" step="5" value="${m}" style="width:70px"> min</div></div>
        </div>
        <div class="feld"><label>Auftrag</label><select name="orderId">${auftragOptionen(t.orderId, true)}</select></div>
        <div class="feld"><label>Was wurde gemacht?</label><input name="beschreibung" value="${esc(t.beschreibung)}" autocomplete="off"></div>
        <div class="feld feld-check"><input type="checkbox" id="abr" name="abrechenbar" ${t.abrechenbar ? 'checked' : ''}><label for="abr">abrechenbar (wird über den Stundensatz des Auftrags berechnet)</label></div>
        ${aktionen('zeit-loeschen', t.id)}
      </form>`;
  }
  A['zeit-neu'] = (d) => U.modal(zeitFormular(null, { orderId: d && d.orderId }));
  A['zeit-bearbeiten'] = (d) => { const t = S.zeit(d.id); if (!t) return; if (t.abgerechnetPositionId) { U.toast('Bereits abgerechnet, nicht mehr änderbar', 'fehler'); return; } U.modal(zeitFormular(t)); };
  A['zeit-speichern'] = sicher((f) => {
    const minuten = (Number(f.stunden) || 0) * 60 + (Number(f.min) || 0);
    if (minuten <= 0) { U.toast('Dauer fehlt', 'fehler'); return; }
    const id = f.id; const daten = { datum: f.datum, orderId: f.orderId, minuten, beschreibung: f.beschreibung, abrechenbar: !!f.abrechenbar };
    if (id) S.aendereZeit(id, daten); else S.neueZeit(daten);
    U.closeModal();
  });
  A['zeit-loeschen'] = sicher((d) => { if (confirm('Zeiteintrag löschen?')) { S.loescheZeit(d.id); U.closeModal(); } });
  A['timer-start'] = (d, el) => {
    const form = el.closest('form'); const f = U.formData(form);
    S.timerStart(f.orderId, f.beschreibung);
  };
  A['timer-stop'] = () => { const t = S.timerStop(); if (t) U.toast(Math.round(t.minuten) + ' min erfasst', 'ok'); };
  A['timer-verwerfen'] = () => { if (confirm('Laufende Zeit verwerfen?')) S.timerVerwerfen(); };

  // ---------- Ausgabe
  function ausgabeFormular(a) {
    a = Object.assign({ datum: U.heute(), lieferant: '', beschreibung: '', kategorie: 'Software/Abos', belegNr: '', brutto: '', steuersatz: 19, bezahlt: true, zahlungsart: 'Karte', orderId: '', wiederkehrend: false, notizen: '' }, a || {});
    const neu = !a.id;
    return `
      <h3>${neu ? 'Ausgabe erfassen' : 'Ausgabe bearbeiten'}</h3>
      <form data-submit="ausgabe-speichern">
        <input type="hidden" name="id" value="${esc(a.id || '')}">
        <div class="feld-reihe">
          <div class="feld"><label>Belegdatum</label><input name="datum" type="date" value="${esc(a.datum)}" required></div>
          <div class="feld"><label>Lieferant / Empfänger</label><input name="lieferant" value="${esc(a.lieferant)}" required autocomplete="off"></div>
        </div>
        <div class="feld"><label>Wofür</label><input name="beschreibung" value="${esc(a.beschreibung)}" autocomplete="off"></div>
        <div class="feld-reihe">
          <div class="feld"><label>Kategorie</label><select name="kategorie">${U.options(K.AUSGABEN_KATEGORIEN, a.kategorie)}</select></div>
          <div class="feld"><label>Beleg-/Rechnungsnummer</label><input name="belegNr" value="${esc(a.belegNr)}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Betrag brutto (€)</label><input name="brutto" type="number" step="0.01" min="0" value="${esc(a.brutto)}" required></div>
          <div class="feld"><label>Enthaltene USt %</label><select name="steuersatz">${U.options(K.STEUERSAETZE.map(String), String(a.steuersatz))}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Zahlungsart</label><select name="zahlungsart">${U.options(K.ZAHLUNGSARTEN, a.zahlungsart)}</select></div>
          <div class="feld"><label>Zugehöriger Auftrag (weiterberechenbar)</label><select name="orderId">${auftragOptionen(a.orderId)}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld feld-check"><input type="checkbox" id="bez" name="bezahlt" ${a.bezahlt ? 'checked' : ''}><label for="bez">bezahlt</label></div>
          <div class="feld feld-check"><input type="checkbox" id="wdh" name="wiederkehrend" ${a.wiederkehrend ? 'checked' : ''}><label for="wdh">wiederkehrend (Abo)</label></div>
        </div>
        <div class="feld"><label>Notizen</label><input name="notizen" value="${esc(a.notizen)}"></div>
        ${aktionen('ausgabe-loeschen', a.id)}
      </form>`;
  }
  A['ausgabe-neu'] = () => U.modal(ausgabeFormular());
  A['ausgabe-bearbeiten'] = (d) => { const a = S.ausgabe(d.id); if (a) U.modal(ausgabeFormular(a)); };
  A['ausgabe-speichern'] = (f) => {
    if (!f.lieferant || !(f.brutto > 0)) { U.toast('Lieferant und Betrag angeben', 'fehler'); return; }
    f.steuersatz = Number(f.steuersatz);
    const id = f.id; delete f.id;
    if (id) S.aendereAusgabe(id, f); else S.neueAusgabe(f);
    U.closeModal();
    U.toast('Ausgabe gespeichert', 'ok');
  };
  A['ausgabe-loeschen'] = (d) => { if (confirm('Ausgabe löschen?')) { S.loescheAusgabe(d.id); U.closeModal(); } };

  // ---------- Termin
  function terminFormular(t, vorgabe) {
    t = Object.assign({ titel: '', datum: U.heute(), von: '', bis: '', ort: '', kategorie: 'Kundentermin', contactId: '', orderId: '', notizen: '' }, rein(vorgabe), t || {});
    const neu = !t.id;
    return `
      <h3>${neu ? 'Neuer Termin' : 'Termin bearbeiten'}</h3>
      <form data-submit="termin-speichern">
        <input type="hidden" name="id" value="${esc(t.id || '')}">
        <div class="feld"><label>Titel</label><input name="titel" value="${esc(t.titel)}" required autocomplete="off"></div>
        <div class="feld-reihe">
          <div class="feld"><label>Datum</label><input name="datum" type="date" value="${esc(t.datum)}" required></div>
          <div class="feld"><label>Kategorie</label><select name="kategorie">${U.options(K.TERMIN_KATEGORIEN, t.kategorie)}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Von (leer = ganztägig)</label><input name="von" type="time" value="${esc(t.von)}"></div>
          <div class="feld"><label>Bis</label><input name="bis" type="time" value="${esc(t.bis)}"></div>
        </div>
        <div class="feld"><label>Ort / Link</label><input name="ort" value="${esc(t.ort)}"></div>
        <div class="feld-reihe">
          <div class="feld"><label>Kontakt</label><select name="contactId">${kontaktOptionen(t.contactId)}</select></div>
          <div class="feld"><label>Auftrag</label><select name="orderId">${auftragOptionen(t.orderId, true)}</select></div>
        </div>
        <div class="feld"><label>Notizen</label><textarea name="notizen" style="min-height:40px">${esc(t.notizen)}</textarea></div>
        ${aktionen('termin-loeschen', t.id)}
      </form>`;
  }
  A['termin-neu'] = (d) => U.modal(terminFormular(null, { contactId: d && d.contactId, orderId: d && d.orderId, datum: d && d.datum }));
  A['termin-bearbeiten'] = (d) => { const t = S.termin(d.id); if (t) U.modal(terminFormular(t)); };
  A['termin-speichern'] = (f) => {
    if (!f.titel || !f.datum) { U.toast('Titel und Datum angeben', 'fehler'); return; }
    if (f.von && f.bis && f.bis < f.von) { U.toast('Ende liegt vor Beginn', 'fehler'); return; }
    if (f.orderId && !f.contactId) { const o = S.auftrag(f.orderId); if (o) f.contactId = o.contactId; }
    const id = f.id; delete f.id;
    if (id) S.aendereTermin(id, f); else S.neuerTermin(f);
    U.closeModal();
    U.toast('Termin gespeichert', 'ok');
  };
  A['termin-loeschen'] = (d) => { if (confirm('Termin löschen?')) { S.loescheTermin(d.id); U.closeModal(); } };

  // Kalender: Termin als Ereignis
  function terminEreignis(t) {
    const teile = [];
    if (t.contactId) teile.push(S.kontaktName(t.contactId));
    if (t.orderId && S.auftrag(t.orderId)) teile.push(S.auftrag(t.orderId).nummer + ' ' + S.auftrag(t.orderId).titel);
    if (t.notizen) teile.push(t.notizen);
    return { uid: 'termin-' + t.id, titel: t.titel, datum: t.datum, von: t.von, bis: t.bis, ort: t.ort, beschreibung: teile.join('\n') };
  }
  A['termin-google'] = (d) => { const t = S.termin(d.id); if (t) window.open(CRM.ics.googleLink(terminEreignis(t)), '_blank', 'noopener'); };
  A['termin-ics'] = (d) => { const t = S.termin(d.id); if (t) CRM.ics.download('termin_' + t.datum + '.ics', [terminEreignis(t)]); };
  A['kalender-export'] = () => {
    U.modal(`
      <h3>Kalender exportieren (.ics)</h3>
      <p class="muted klein">Die Datei lässt sich in Google Kalender, Outlook und Apple Kalender importieren. Einträge haben feste Kennungen, ein erneuter Import aktualisiert statt zu verdoppeln.</p>
      <form data-submit="kalender-export-speichern">
        <div class="feld feld-check"><input type="checkbox" id="k1" name="termine" checked><label for="k1">Termine (${S.data.appointments.length})</label></div>
        <div class="feld feld-check"><input type="checkbox" id="k2" name="aufgaben" checked><label for="k2">Offene Aufgaben mit Fälligkeit (${S.offeneAufgaben().filter((t) => t.faellig).length})</label></div>
        <div class="feld feld-check"><input type="checkbox" id="k3" name="rechnungen"><label for="k3">Fälligkeiten offener Rechnungen (${S.offeneRechnungen().length})</label></div>
        <div class="feld feld-check"><input type="checkbox" id="k4" name="auftraege"><label for="k4">Fertigstellungstermine offener Aufträge</label></div>
        <div class="feld feld-check"><input type="checkbox" id="k5" name="nurZukunft" checked><label for="k5">nur ab heute</label></div>
        <div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">.ics herunterladen</button></div>
      </form>`);
  };
  A['kalender-export-speichern'] = (f) => {
    const h = U.heute(); const e = [];
    const ok = (datum) => datum && (!f.nurZukunft || datum >= h);
    if (f.termine) S.data.appointments.filter((t) => ok(t.datum)).forEach((t) => e.push(terminEreignis(t)));
    if (f.aufgaben) S.offeneAufgaben().filter((t) => ok(t.faellig)).forEach((t) => e.push({ uid: 'aufgabe-' + t.id, titel: 'Aufgabe: ' + t.titel, datum: t.faellig, beschreibung: t.contactId ? S.kontaktName(t.contactId) : '' }));
    if (f.rechnungen) S.offeneRechnungen().filter((r) => ok(r.faellig)).forEach((r) => e.push({ uid: 'rechnung-' + r.id, titel: 'Zahlungsziel ' + r.nummer + ' · ' + U.fmtEur(r.brutto), datum: r.faellig, beschreibung: S.kontaktName(r.contactId) }));
    if (f.auftraege) S.data.orders.filter((o) => o.status !== 'Berechnet' && ok(o.faellig)).forEach((o) => e.push({ uid: 'auftrag-' + o.id, titel: 'Fertigstellung ' + o.nummer + ' · ' + o.titel, datum: o.faellig, beschreibung: S.kontaktName(o.contactId) }));
    if (!e.length) { U.toast('Nichts zu exportieren', 'fehler'); return; }
    CRM.ics.download('crm-kalender_' + h + '.ics', e);
    U.closeModal();
    U.toast(e.length + ' Einträge exportiert', 'ok');
  };

  // ---------- Stammdaten
  A['stammdaten-speichern'] = (f) => {
    f.stundensatz = Number(f.stundensatz) || 0; f.zahlungszielTage = Number(f.zahlungszielTage) || 14; f.steuersatz = Number(f.steuersatz) || 0; f.angebotGueltigTage = Number(f.angebotGueltigTage) || 30;
    S.saveStammdaten(f);
    U.toast('Stammdaten gespeichert', 'ok');
  };

  A['modal-schliessen'] = () => U.closeModal();
  A['drucken'] = () => window.print();
})(window.CRM);
