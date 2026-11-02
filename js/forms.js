// Formulare (Modal) für Kontakt, Vorgang, Aufgabe und die zugehörigen Aktionen.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, esc = U.esc;
  CRM.actions = CRM.actions || {};
  const A = CRM.actions;

  const kontaktOptionen = (gewaehlt) => U.options(
    U.sortiere(S.data.contacts, 'firma').map((c) => [c.id, (c.firma || c.person || '(ohne Namen)') + (c.firma && c.person ? ' · ' + c.person : '')]),
    gewaehlt, '– kein Kontakt –');

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
        <div class="feld-reihe">
          <div class="feld"><label>Website</label><input name="website" value="${esc(c.website)}" placeholder="https://"></div>
          <div class="feld"><label>Ort</label><input name="ort" value="${esc(c.ort)}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Branche</label><input name="branche" list="branchen" value="${esc(c.branche)}">
            <datalist id="branchen">${[...new Set(S.data.contacts.map((x) => x.branche).filter(Boolean))].map((b) => `<option value="${esc(b)}">`).join('')}</datalist></div>
          <div class="feld"><label>Quelle</label><select name="quelle">${U.options(K.QUELLEN, c.quelle, '– bitte wählen –')}</select></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Status</label><select name="status">${U.options(K.STATUS, c.status || 'Interessent')}</select></div>
          <div class="feld"><label>Einwilligung E-Mail-Werbung seit</label><input name="einwilligungDatum" type="date" value="${esc(c.einwilligungDatum)}"></div>
        </div>
        <div class="feld feld-check"><input type="checkbox" id="einw" name="einwilligungEmail" ${c.einwilligungEmail ? 'checked' : ''}><label for="einw">Einwilligung für E-Mail-Werbung liegt vor (Newsletter, Angebote)</label></div>
        <div class="feld"><label>Notizen</label><textarea name="notizen">${esc(c.notizen)}</textarea></div>
        <div class="form-aktionen">
          ${neu ? '' : `<button type="button" class="btn btn-gefahr links" data-action="kontakt-loeschen" data-id="${esc(c.id)}">Löschen</button>`}
          <button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button>
          <button type="submit" class="btn btn-primary">Speichern</button>
        </div>
      </form>`;
  }
  A['kontakt-neu'] = () => U.modal(kontaktFormular());
  A['kontakt-bearbeiten'] = (d) => { const c = S.kontakt(d.id); if (c) U.modal(kontaktFormular(c)); };
  A['kontakt-speichern'] = (f) => {
    if (!f.firma && !f.person) { U.toast('Firma oder Ansprechperson angeben', 'fehler'); return; }
    if (f.einwilligungEmail && !f.einwilligungDatum) f.einwilligungDatum = U.heute();
    if (!f.einwilligungEmail) f.einwilligungDatum = '';
    const id = f.id; delete f.id;
    if (id) { S.aendereKontakt(id, f); U.toast('Kontakt gespeichert', 'ok'); }
    else { const c = S.neuerKontakt(f); U.toast('Kontakt angelegt', 'ok'); location.hash = '#/kontakte/' + c.id; }
    U.closeModal();
  };
  A['kontakt-loeschen'] = (d) => {
    const c = S.kontakt(d.id); if (!c) return;
    const n = S.data.deals.filter((x) => x.contactId === c.id).length;
    if (!confirm(`„${c.firma || c.person}" endgültig löschen?` + (n ? `\nDamit verschwinden auch ${n} Vorgang/Vorgänge, alle Aktivitäten und Aufgaben dazu.` : ''))) return;
    S.loescheKontakt(c.id);
    U.closeModal();
    U.toast('Kontakt gelöscht');
    if (location.hash.startsWith('#/kontakte/')) location.hash = '#/kontakte';
  };

  // ---------- Vorgang
  function vorgangFormular(d, vorgabe) {
    d = Object.assign({ contactId: '', titel: '', phase: 'Anfrage', wert: 0, naechsterSchritt: '', faellig: '', verlustgrund: '', notizen: '' }, vorgabe || {}, d || {});
    const neu = !d.id;
    return `
      <h3>${neu ? 'Neuer Vorgang' : 'Vorgang bearbeiten'}</h3>
      <form data-submit="vorgang-speichern">
        <input type="hidden" name="id" value="${esc(d.id || '')}">
        <div class="feld"><label>Titel (was wird verkauft?)</label><input name="titel" value="${esc(d.titel)}" required autocomplete="off"></div>
        <div class="feld"><label>Kontakt</label><select name="contactId" required>${kontaktOptionen(d.contactId)}</select></div>
        <div class="feld-reihe">
          <div class="feld"><label>Phase</label><select name="phase" data-phase>${U.options(K.PHASEN, d.phase)}</select></div>
          <div class="feld"><label>Wert netto (€)</label><input name="wert" type="number" min="0" step="50" value="${esc(d.wert || '')}"></div>
        </div>
        <div class="feld-reihe">
          <div class="feld"><label>Nächster Schritt</label><input name="naechsterSchritt" value="${esc(d.naechsterSchritt)}"></div>
          <div class="feld"><label>Fällig am</label><input name="faellig" type="date" value="${esc(d.faellig)}"></div>
        </div>
        <div class="feld" data-verlust ${d.phase === 'Verloren' ? '' : 'hidden'}><label>Verlustgrund</label><select name="verlustgrund">${U.options(K.VERLUST, d.verlustgrund, '– bitte wählen –')}</select></div>
        <div class="feld"><label>Notizen</label><textarea name="notizen">${esc(d.notizen)}</textarea></div>
        <div class="form-aktionen">
          ${neu ? '' : `<button type="button" class="btn btn-gefahr links" data-action="vorgang-loeschen" data-id="${esc(d.id)}">Löschen</button>`}
          <button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button>
          <button type="submit" class="btn btn-primary">Speichern</button>
        </div>
      </form>`;
  }
  const verlustUmschalten = (dlg) => {
    const sel = dlg.querySelector('[data-phase]'), feld = dlg.querySelector('[data-verlust]');
    if (sel && feld) sel.addEventListener('change', () => { feld.hidden = sel.value !== 'Verloren'; });
  };
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
  // Phase direkt wechseln (Pipeline-Board); bei „Verloren" nach dem Grund fragen.
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

  // ---------- Aufgabe
  function aufgabeFormular(t, vorgabe) {
    t = Object.assign({ contactId: '', dealId: '', titel: '', faellig: '' }, vorgabe || {}, t || {});
    const neu = !t.id;
    const vorgaenge = S.data.deals.filter((d) => !t.contactId || d.contactId === t.contactId);
    return `
      <h3>${neu ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}</h3>
      <form data-submit="aufgabe-speichern">
        <input type="hidden" name="id" value="${esc(t.id || '')}">
        <div class="feld"><label>Was ist zu tun?</label><input name="titel" value="${esc(t.titel)}" required autocomplete="off"></div>
        <div class="feld-reihe">
          <div class="feld"><label>Fällig am</label><input name="faellig" type="date" value="${esc(t.faellig)}"></div>
          <div class="feld"><label>Kontakt</label><select name="contactId">${kontaktOptionen(t.contactId)}</select></div>
        </div>
        <div class="feld"><label>Vorgang</label><select name="dealId">${U.options(vorgaenge.map((d) => [d.id, d.titel + ' · ' + S.kontaktName(d.contactId)]), t.dealId, '– kein Vorgang –')}</select></div>
        <div class="form-aktionen">
          ${neu ? '' : `<button type="button" class="btn btn-gefahr links" data-action="aufgabe-loeschen" data-id="${esc(t.id)}">Löschen</button>`}
          <button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button>
          <button type="submit" class="btn btn-primary">Speichern</button>
        </div>
      </form>`;
  }
  A['aufgabe-neu'] = (d) => U.modal(aufgabeFormular(null, { contactId: d && d.contactId, dealId: d && d.dealId }));
  A['aufgabe-bearbeiten'] = (d) => { const t = S.aufgabe(d.id); if (t) U.modal(aufgabeFormular(t)); };
  A['aufgabe-speichern'] = (f) => {
    if (!f.titel) { U.toast('Titel fehlt', 'fehler'); return; }
    if (f.dealId && !f.contactId) { const v = S.vorgang(f.dealId); if (v) f.contactId = v.contactId; }
    const id = f.id; delete f.id;
    if (id) S.aendereAufgabe(id, f); else S.neueAufgabe(f);
    U.closeModal();
    U.toast('Aufgabe gespeichert', 'ok');
  };
  A['aufgabe-erledigt'] = (d, el) => S.erledigeAufgabe(d.id, el.checked);
  A['aufgabe-loeschen'] = (d) => {
    if (!confirm('Aufgabe löschen?')) return;
    S.loescheAufgabe(d.id);
    U.closeModal();
  };

  // ---------- Aktivität (Schnellerfassung in der Kontaktakte)
  A['aktivitaet-speichern'] = (f, form) => {
    if (!f.text) { U.toast('Text fehlt', 'fehler'); return; }
    S.neueAktivitaet({ contactId: f.contactId, dealId: f.dealId || '', typ: f.typ, text: f.text });
    form.reset();
  };
  A['aktivitaet-loeschen'] = (d) => { if (confirm('Eintrag löschen?')) S.loescheAktivitaet(d.id); };

  A['modal-schliessen'] = () => U.closeModal();
})(window.CRM);
