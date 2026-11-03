// Datenhaltung: ein JSON-Dokument mit allen Sammlungen, immer im localStorage,
// zusätzlich per sync.js auf GitHub.
//
// Belegregeln (übernommen aus dem Belegwesen-Muster):
//  1. Belege mit Nummer (Angebot, Auftrag, Rechnung) werden nie gelöscht.
//     Statuswechsel werden im Journal angehängt, Rechnungen nur per Storno-Beleg aufgehoben.
//  2. Jeder Beleg trägt eine sprechende Nummer je Art und Jahr: AN-2026-0001, AUF-2026-0001, RE-2026-0001.
//  3. Eine Rechnung friert Positionen, Empfänger und Absender ein. Spätere Änderungen am Auftrag
//     oder an Stammdaten berühren sie nicht.
//  4. Summen werden gerechnet, nicht gepflegt: Beträge, Stunden, offene Posten, Umsatzsteuer.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util;
  const LS = { data: 'crm.data', settings: 'crm.settings', meta: 'crm.meta', timer: 'crm.timer' };

  const K = {
    // Abschluss = Kaufabschluss (Auftrag erteilt, Leistung läuft), Nachbereitung = Leistung erbracht, Feedback/Folgegeschäft,
    // Gewonnen = abgeschlossen und nachbereitet, Verloren = ohne Abschluss beendet.
    PHASEN: ['Anfrage', 'Erstgespräch', 'Angebot', 'Verhandlung', 'Abschluss', 'Nachbereitung', 'Gewonnen', 'Verloren'],
    OFFEN: ['Anfrage', 'Erstgespräch', 'Angebot', 'Verhandlung', 'Abschluss', 'Nachbereitung'],
    VORVERTRAG: ['Anfrage', 'Erstgespräch', 'Angebot', 'Verhandlung'],
    NACHBEREITUNG: [['feedback', 'Feedback eingeholt'], ['referenz', 'Referenz / Bewertung angefragt'], ['folgebedarf', 'Folgebedarf geklärt'], ['abschlussgespraech', 'Abschlussgespräch geführt']],
    STATUS: ['Interessent', 'Kunde', 'Partner', 'Archiv'],
    QUELLEN: ['Empfehlung', 'Website', 'LinkedIn', 'Netzwerk/Event', 'Schulung', 'Kaltakquise', 'Bestandskunde', 'Sonstiges'],
    VERLUST: ['Preis', 'Zeitpunkt', 'Kein Bedarf', 'Wettbewerber', 'Keine Rückmeldung', 'Sonstiges'],
    AKTIVITAET: ['Notiz', 'Anruf', 'E-Mail', 'Gespräch', 'Termin', 'Nachricht'],
    PRIORITAET: ['Normal', 'Hoch', 'Dringend'],
    BELEGE: { angebot: { prefix: 'AN', label: 'Angebot' }, auftrag: { prefix: 'AUF', label: 'Auftrag' }, rechnung: { prefix: 'RE', label: 'Rechnung' } },
    ANGEBOT_STATUS: ['Entwurf', 'Gesendet', 'Angenommen', 'Abgelehnt', 'Abgelaufen'],
    AUFTRAG_STATUS: ['Neu', 'In Arbeit', 'Fertig', 'Berechnet'],
    RECHNUNG_STATUS: ['Offen', 'Bezahlt', 'Storniert', 'Storno'],
    POSITIONSARTEN: ['Leistung', 'Pauschale', 'Auslage'],
    EINHEITEN: ['Std', 'Tag', 'Stk', 'pauschal', 'km', 'Monat'],
    STEUERSAETZE: [19, 7, 0],
    AUSGABEN_KATEGORIEN: ['Software/Abos', 'Hardware', 'Reise', 'Büro', 'Fortbildung', 'Marketing', 'Versicherung/Beiträge', 'Fremdleistung', 'Telefon/Internet', 'Sonstiges'],
    ZAHLUNGSARTEN: ['Überweisung', 'Karte', 'PayPal', 'Lastschrift', 'Bar'],
    TERMIN_KATEGORIEN: ['Kundentermin', 'Intern', 'Abwesenheit'],
    MAHNSTUFEN: ['Zahlungserinnerung', '1. Mahnung', '2. Mahnung'],
  };

  const STAMMDATEN_LEER = () => ({
    name: '', firma: '', strasse: '', plz: '', ort: '', land: 'Deutschland', email: '', telefon: '', website: '',
    steuernummer: '', ustId: '', iban: '', bic: '', bank: '',
    stundensatz: 0, zahlungszielTage: 14, steuersatz: 19, angebotGueltigTage: 30, kleinunternehmer: false,
    rechnungsFuss: 'Vielen Dank für die Zusammenarbeit. Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.',
    angebotsFuss: 'Alle Preise verstehen sich netto zuzüglich der gesetzlichen Umsatzsteuer.',
  });

  const SAMMLUNGEN = ['contacts', 'deals', 'activities', 'tasks', 'quotes', 'orders', 'invoices', 'times', 'expenses', 'appointments', 'journal', 'touchpoints', 'campaigns', 'workflows', 'workflowLaeufe'];
  const leer = () => {
    const d = { version: 2, updatedAt: U.nowIso(), stammdaten: STAMMDATEN_LEER() };
    for (const k of SAMMLUNGEN) d[k] = [];
    return d;
  };

  function lies(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function normalisiere(d) {
    if (!d || typeof d !== 'object') d = leer();
    d.version = 2;
    for (const k of SAMMLUNGEN) if (!Array.isArray(d[k])) d[k] = [];
    d.stammdaten = Object.assign(STAMMDATEN_LEER(), d.stammdaten || {});
    if (!d.journey || typeof d.journey !== 'object') d.journey = {};
    d.workflowStand = Object.assign({ letzterLauf: null, letzterTag: null }, d.workflowStand || {});
    d.contacts.forEach((c) => { if (!Array.isArray(c.tags)) c.tags = []; if (c.einwilligungTracking === undefined) c.einwilligungTracking = false; });
    if (!d.updatedAt) d.updatedAt = U.nowIso();
    return d;
  }

  let data = normalisiere(lies(LS.data, null));
  let settings = Object.assign({ owner: '', repo: '', branch: 'main', path: 'data/crm.json', token: '' }, lies(LS.settings, {}));
  let meta = Object.assign({ sha: null, dirty: false, lastSync: null, lastLabel: '' }, lies(LS.meta, {}));

  const listeners = new Set();
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = () => listeners.forEach((fn) => fn());

  function persist() { localStorage.setItem(LS.data, JSON.stringify(data)); }
  function saveMeta(m) { Object.assign(meta, m || {}); localStorage.setItem(LS.meta, JSON.stringify(meta)); }
  function saveSettings(s) { Object.assign(settings, s || {}); localStorage.setItem(LS.settings, JSON.stringify(settings)); }

  function commit(label) {
    data.updatedAt = U.nowIso();
    persist();
    saveMeta({ dirty: true, lastLabel: label || 'Änderung' });
    emit();
  }
  function replaceData(neu, dirty) {
    data = normalisiere(JSON.parse(JSON.stringify(neu)));
    if (dirty) data.updatedAt = U.nowIso();
    persist();
    saveMeta({ dirty: !!dirty, lastLabel: dirty ? 'Datenstand ersetzt' : meta.lastLabel });
    emit();
  }
  function saveStammdaten(f) { Object.assign(data.stammdaten, f); commit('Stammdaten geändert'); }

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const heute = () => U.heute();

  // ---- Nummernkreis und Journal
  function naechsteNummer(art) {
    const p = K.BELEGE[art].prefix;
    const jahr = Number(heute().slice(0, 4));
    const liste = art === 'angebot' ? data.quotes : art === 'auftrag' ? data.orders : data.invoices;
    const max = liste.filter((b) => b.jahr === jahr).reduce((m, b) => Math.max(m, b.laufendeNr || 0), 0);
    return { nummer: `${p}-${jahr}-${String(max + 1).padStart(4, '0')}`, jahr, laufendeNr: max + 1 };
  }
  function journal(belegart, beleg, ereignis, notiz) {
    data.journal.push({ id: U.uid(), datum: U.nowIso(), belegart, belegId: beleg.id, nummer: beleg.nummer, ereignis, notiz: notiz || '' });
  }
  const journalFuer = (belegId) => data.journal.filter((j) => j.belegId === belegId);

  // ---- Summen
  function summen(positionen, kleinunternehmer) {
    let netto = 0; const basis = {};
    for (const p of positionen || []) {
      const z = round2((Number(p.menge) || 0) * (Number(p.einzelpreis) || 0));
      netto += z;
      const s = kleinunternehmer ? 0 : (Number(p.steuersatz) || 0);
      basis[s] = (basis[s] || 0) + z;
    }
    netto = round2(netto);
    let steuer = 0;
    const saetze = Object.keys(basis).map(Number).sort((a, b) => b - a).map((s) => {
      const b = round2(basis[s] * s / 100); steuer += b;
      return { satz: s, basis: round2(basis[s]), betrag: b };
    });
    steuer = round2(steuer);
    return { netto, steuer, brutto: round2(netto + steuer), saetze };
  }
  const positionNeu = (f) => Object.assign({ id: U.uid(), art: 'Leistung', bezeichnung: '', menge: 1, einheit: 'Std', einzelpreis: 0, steuersatz: Number(data.stammdaten.steuersatz) || 19 }, f);

  // ---- Kontakte
  const kontakt = (id) => data.contacts.find((c) => c.id === id);
  const kontaktName = (id) => { const c = kontakt(id); return c ? (c.firma || c.person || '(ohne Namen)') : '(gelöschter Kontakt)'; };
  const KONTAKT_LEER = () => ({
    id: U.uid(), firma: '', person: '', email: '', telefon: '', website: '', strasse: '', plz: '', ort: '', land: 'Deutschland', ustId: '',
    branche: '', quelle: '', status: 'Interessent', einwilligungEmail: false, einwilligungDatum: '', einwilligungTracking: false, tags: [], notizen: '',
    erstellt: U.nowIso(), geaendert: U.nowIso(),
  });
  function neuerKontakt(f) {
    const c = Object.assign(KONTAKT_LEER(), f);
    data.contacts.push(c);
    commit('Kontakt angelegt: ' + (c.firma || c.person));
    return c;
  }
  function aendereKontakt(id, f) {
    const c = kontakt(id); if (!c) return null;
    Object.assign(c, f, { geaendert: U.nowIso() });
    commit('Kontakt geändert: ' + (c.firma || c.person));
    return c;
  }
  function loescheKontakt(id) {
    const belege = data.quotes.concat(data.orders, data.invoices).filter((b) => b.contactId === id);
    if (belege.length) throw new Error('Kontakt hat ' + belege.length + ' Beleg(e) (Angebote, Aufträge, Rechnungen). Belege bleiben erhalten, deshalb auf „Archiv" setzen statt löschen.');
    const name = kontaktName(id);
    data.contacts = data.contacts.filter((c) => c.id !== id);
    data.deals = data.deals.filter((d) => d.contactId !== id);
    data.activities = data.activities.filter((a) => a.contactId !== id);
    data.tasks = data.tasks.filter((t) => t.contactId !== id);
    data.appointments = data.appointments.filter((t) => t.contactId !== id);
    commit('Kontakt gelöscht: ' + name);
  }

  // ---- Vorgänge (Pipeline)
  const vorgang = (id) => data.deals.find((d) => d.id === id);
  function schliesseFalls(d) {
    const gewonnenSeite = ['Abschluss', 'Nachbereitung', 'Gewonnen'].includes(d.phase);
    if (gewonnenSeite) { d.verlustgrund = ''; if (!d.abschlussDatum) d.abschlussDatum = heute(); const c = kontakt(d.contactId); if (c && c.status === 'Interessent') c.status = 'Kunde'; }
    else d.abschlussDatum = '';
    if (d.phase === 'Gewonnen' || d.phase === 'Verloren') { if (!d.geschlossen) d.geschlossen = heute(); }
    else { d.geschlossen = ''; if (d.phase !== 'Verloren') d.verlustgrund = ''; }
    if (!d.nachbereitung) d.nachbereitung = {};
  }
  function neuerVorgang(f) {
    const d = Object.assign({ id: U.uid(), contactId: '', titel: '', phase: 'Anfrage', wert: 0, naechsterSchritt: '', faellig: '', verlustgrund: '', notizen: '', nachbereitung: {}, abschlussDatum: '', erstellt: U.nowIso(), geaendert: U.nowIso(), geschlossen: '' }, f);
    schliesseFalls(d);
    data.deals.push(d);
    journal('vorgang', { id: d.id, nummer: d.titel }, 'Vorgang angelegt', 'Phase ' + d.phase);
    commit('Vorgang angelegt: ' + d.titel);
    return d;
  }
  function aendereVorgang(id, f) {
    const d = vorgang(id); if (!d) return null;
    const vorher = d.phase;
    Object.assign(d, f, { geaendert: U.nowIso() });
    schliesseFalls(d);
    if (vorher !== d.phase) journal('vorgang', { id: d.id, nummer: d.titel }, 'Phase: ' + d.phase, vorher + ' → ' + d.phase + (d.phase === 'Verloren' && d.verlustgrund ? ' (' + d.verlustgrund + ')' : ''));
    commit('Vorgang geändert: ' + d.titel);
    return d;
  }
  function loescheVorgang(id) {
    const d = vorgang(id); if (!d) return;
    data.deals = data.deals.filter((x) => x.id !== id);
    data.activities = data.activities.filter((a) => a.dealId !== id);
    data.tasks = data.tasks.filter((t) => t.dealId !== id);
    commit('Vorgang gelöscht: ' + d.titel);
  }

  // ---- Aktivitäten
  function neueAktivitaet(f) {
    const a = Object.assign({ id: U.uid(), contactId: '', dealId: '', orderId: '', typ: 'Notiz', text: '', betreff: '', datum: U.nowIso() }, f, { erfasst: U.nowIso() });
    if (!a.datum) a.datum = U.nowIso();
    data.activities.push(a);
    commit(a.typ + ' bei ' + kontaktName(a.contactId));
    return a;
  }
  function aendereAktivitaet(id, f) { const a = data.activities.find((x) => x.id === id); if (!a) return null; Object.assign(a, f); commit('Aktivität geändert'); return a; }
  function loescheAktivitaet(id) { data.activities = data.activities.filter((a) => a.id !== id); commit('Aktivität gelöscht'); }

  // Komplette Chronik eines Kontakts: Gespräche, Belege, Termine, Phasenwechsel, erledigte Aufgaben
  function historie(contactId) {
    const e = [];
    data.activities.filter((a) => a.contactId === contactId).forEach((a) => e.push({ datum: a.datum, art: a.typ, gruppe: 'Gespräch', titel: a.betreff || a.typ, text: a.text, id: a.id, aktion: 'aktivitaet-bearbeiten', link: '' }));
    data.appointments.filter((t) => t.contactId === contactId && t.datum <= heute()).forEach((t) => e.push({ datum: t.datum + 'T' + (t.von || '00:00') + ':00', art: 'Termin', gruppe: 'Termin', titel: t.titel, text: [t.ort, t.notizen].filter(Boolean).join(' · '), id: t.id, aktion: 'termin-bearbeiten' }));
    data.tasks.filter((t) => t.contactId === contactId && t.erledigt).forEach((t) => e.push({ datum: t.erledigt, art: 'Aufgabe', gruppe: 'Aufgabe', titel: 'Erledigt: ' + t.titel, text: '', id: t.id, aktion: 'aufgabe-bearbeiten' }));
    const JN = window.CRMJourney ? window.CRMJourney.ART_NAME : {};
    (data.touchpoints || []).filter((t) => t.kontaktId === contactId).forEach((t) => e.push({ datum: t.datum, art: JN[t.art] || t.art, gruppe: 'Journey', titel: t.titel || JN[t.art] || t.art, text: t.wert ? fmtEurLokal(t.wert) : (t.quelle || ''), id: t.id, aktion: '' }));
    const belege = [];
    data.deals.filter((d) => d.contactId === contactId).forEach((d) => belege.push({ id: d.id, art: 'Vorgang', link: '#/pipeline', titel: d.titel }));
    data.quotes.filter((q) => q.contactId === contactId).forEach((q) => belege.push({ id: q.id, art: 'Angebot', link: '#/angebote/' + q.id, titel: q.nummer + ' ' + q.titel }));
    data.orders.filter((o) => o.contactId === contactId).forEach((o) => belege.push({ id: o.id, art: 'Auftrag', link: '#/auftraege/' + o.id, titel: o.nummer + ' ' + o.titel }));
    data.invoices.filter((r) => r.contactId === contactId).forEach((r) => belege.push({ id: r.id, art: 'Rechnung', link: '#/rechnungen/' + r.id, titel: r.nummer + ' ' + r.titel }));
    const belegIds = new Map(belege.map((b) => [b.id, b]));
    data.journal.filter((j) => belegIds.has(j.belegId)).forEach((j) => { const b = belegIds.get(j.belegId); e.push({ datum: j.datum, art: b.art, gruppe: 'Beleg', titel: j.ereignis + ': ' + b.titel, text: j.notiz, link: b.link }); });
    return e.sort((a, b) => a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0);
  }

  const fmtEurLokal = (n) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  // ---- Aufgaben
  const aufgabe = (id) => data.tasks.find((t) => t.id === id);
  function neueAufgabe(f) {
    const t = Object.assign({ id: U.uid(), contactId: '', dealId: '', orderId: '', titel: '', faellig: '', prioritaet: 'Normal', erledigt: '', erstellt: U.nowIso() }, f);
    data.tasks.push(t);
    commit('Aufgabe angelegt: ' + t.titel);
    return t;
  }
  function aendereAufgabe(id, f) { const t = aufgabe(id); if (!t) return null; Object.assign(t, f); commit('Aufgabe geändert: ' + t.titel); return t; }
  function erledigeAufgabe(id, erledigt) { const t = aufgabe(id); if (!t) return; t.erledigt = erledigt ? U.nowIso() : ''; commit((erledigt ? 'Aufgabe erledigt: ' : 'Aufgabe wieder offen: ') + t.titel); }
  function loescheAufgabe(id) { data.tasks = data.tasks.filter((t) => t.id !== id); commit('Aufgabe gelöscht'); }

  // ---- Angebote
  const angebot = (id) => data.quotes.find((q) => q.id === id);
  function neuesAngebot(f) {
    const nr = naechsteNummer('angebot');
    const q = Object.assign({
      id: U.uid(), contactId: '', dealId: '', titel: '', einleitung: '', datum: heute(),
      gueltigBis: U.inTagen(Number(data.stammdaten.angebotGueltigTage) || 30), positionen: [], status: 'Entwurf', notizen: '',
      erstellt: U.nowIso(), geaendert: U.nowIso(), orderId: '',
    }, f, nr);
    data.quotes.push(q);
    journal('angebot', q, 'Angelegt', '');
    commit('Angebot angelegt: ' + q.nummer);
    return q;
  }
  function aendereAngebot(id, f) {
    const q = angebot(id); if (!q) return null;
    if (q.status !== 'Entwurf') { const erlaubt = {}; if ('notizen' in f) erlaubt.notizen = f.notizen; f = erlaubt; }
    Object.assign(q, f, { geaendert: U.nowIso() });
    commit('Angebot geändert: ' + q.nummer);
    return q;
  }
  function setzeAngebotStatus(id, status, notiz) {
    const q = angebot(id); if (!q || q.status === status) return q;
    q.status = status; q.geaendert = U.nowIso();
    journal('angebot', q, status, notiz);
    if (q.dealId) { const d = vorgang(q.dealId); if (d) { if (status === 'Gesendet' && ['Anfrage', 'Erstgespräch'].includes(d.phase)) d.phase = 'Angebot'; if (status === 'Abgelehnt' && K.VORVERTRAG.includes(d.phase)) { d.phase = 'Verloren'; d.verlustgrund = d.verlustgrund || 'Sonstiges'; schliesseFalls(d); journal('vorgang', { id: d.id, nummer: d.titel }, 'Phase: Verloren', 'Angebot ' + q.nummer + ' abgelehnt'); } } }
    commit('Angebot ' + q.nummer + ': ' + status);
    return q;
  }
  function kopiereAngebot(id) {
    const q = angebot(id); if (!q) return null;
    return neuesAngebot({ contactId: q.contactId, dealId: q.dealId, titel: q.titel, einleitung: q.einleitung, positionen: q.positionen.map((p) => Object.assign({}, p, { id: U.uid() })), notizen: 'Kopie von ' + q.nummer });
  }
  function angebotZuAuftrag(id) {
    const q = angebot(id); if (!q) return null;
    const o = neuerAuftrag({ contactId: q.contactId, dealId: q.dealId, quoteId: q.id, titel: q.titel, positionen: q.positionen.map((p) => Object.assign({}, p, { id: U.uid() })) });
    q.status = 'Angenommen'; q.orderId = o.id; q.geaendert = U.nowIso();
    journal('angebot', q, 'Angenommen', 'Auftrag ' + o.nummer + ' angelegt');
    if (q.dealId) { const d = vorgang(q.dealId); if (d && K.VORVERTRAG.includes(d.phase)) { const vorher = d.phase; d.phase = 'Abschluss'; schliesseFalls(d); journal('vorgang', { id: d.id, nummer: d.titel }, 'Phase: Abschluss', vorher + ' → Abschluss, Auftrag ' + o.nummer); } }
    commit('Angebot ' + q.nummer + ' angenommen, Auftrag ' + o.nummer);
    return o;
  }

  // ---- Aufträge
  const auftrag = (id) => data.orders.find((o) => o.id === id);
  function neuerAuftrag(f) {
    const nr = naechsteNummer('auftrag');
    const o = Object.assign({
      id: U.uid(), contactId: '', dealId: '', quoteId: '', titel: '', beschreibung: '', datum: heute(), faellig: '',
      stundensatz: Number(data.stammdaten.stundensatz) || 0, budget: 0, positionen: [], status: 'Neu', notizen: '',
      erstellt: U.nowIso(), geaendert: U.nowIso(), fertigAm: '',
    }, f, nr);
    data.orders.push(o);
    journal('auftrag', o, 'Angelegt', '');
    commit('Auftrag angelegt: ' + o.nummer);
    return o;
  }
  function aendereAuftrag(id, f) {
    const o = auftrag(id); if (!o) return null;
    Object.assign(o, f, { geaendert: U.nowIso() });
    commit('Auftrag geändert: ' + o.nummer);
    return o;
  }
  function setzeAuftragStatus(id, status, notiz) {
    const o = auftrag(id); if (!o || o.status === status) return o;
    o.status = status; o.geaendert = U.nowIso();
    if (status === 'Fertig') o.fertigAm = heute();
    if (status === 'Neu' || status === 'In Arbeit') o.fertigAm = '';
    journal('auftrag', o, status, notiz);
    commit('Auftrag ' + o.nummer + ': ' + status);
    return o;
  }
  // Positionen an Angebot (nur Entwurf) oder Auftrag (nicht Berechnet)
  function belegFuerPositionen(belegart, belegId) {
    const b = belegart === 'angebot' ? angebot(belegId) : auftrag(belegId);
    if (!b) throw new Error('Beleg nicht gefunden');
    if (belegart === 'angebot' && b.status !== 'Entwurf') throw new Error('Angebot ist nicht mehr im Entwurf. Kopie anlegen, um Positionen zu ändern.');
    if (belegart === 'auftrag' && b.status === 'Berechnet') throw new Error('Auftrag ist berechnet. Positionen sind eingefroren.');
    return b;
  }
  function positionSpeichern(belegart, belegId, f) {
    const b = belegFuerPositionen(belegart, belegId);
    const vorhanden = f.id ? b.positionen.find((p) => p.id === f.id) : null;
    if (vorhanden) Object.assign(vorhanden, f); else b.positionen.push(positionNeu(f));
    b.geaendert = U.nowIso();
    commit('Position gespeichert: ' + b.nummer);
  }
  function positionLoeschen(belegart, belegId, posId) {
    const b = belegFuerPositionen(belegart, belegId);
    b.positionen = b.positionen.filter((p) => p.id !== posId);
    data.times.forEach((t) => { if (t.abgerechnetPositionId === posId) t.abgerechnetPositionId = ''; });
    b.geaendert = U.nowIso();
    commit('Position gelöscht: ' + b.nummer);
  }
  // Nicht abgerechnete, abrechenbare Zeiten eines Auftrags als eine Position übernehmen
  const unabgerechneteZeiten = (orderId) => data.times.filter((t) => t.orderId === orderId && t.abrechenbar && !t.abgerechnetPositionId);
  function zeitenAbrechnen(orderId) {
    const o = belegFuerPositionen('auftrag', orderId);
    const zeiten = unabgerechneteZeiten(orderId);
    if (!zeiten.length) throw new Error('Keine offenen abrechenbaren Zeiten.');
    const minuten = zeiten.reduce((s, t) => s + (Number(t.minuten) || 0), 0);
    const stunden = round2(minuten / 60);
    const tage = zeiten.map((t) => t.datum).sort();
    const p = positionNeu({ art: 'Leistung', bezeichnung: `Leistung nach Aufwand, ${U.fmtDatum(tage[0])} bis ${U.fmtDatum(tage[tage.length - 1])} (${zeiten.length} Einträge)`, menge: stunden, einheit: 'Std', einzelpreis: Number(o.stundensatz) || 0 });
    o.positionen.push(p);
    zeiten.forEach((t) => { t.abgerechnetPositionId = p.id; });
    o.geaendert = U.nowIso();
    journal('auftrag', o, 'Zeiten übernommen', `${stunden} Std aus ${zeiten.length} Einträgen`);
    commit('Zeiten abgerechnet: ' + o.nummer);
    return p;
  }

  // ---- Rechnungen
  const rechnung = (id) => data.invoices.find((r) => r.id === id);
  function empfaengerSnapshot(c) {
    return c ? { firma: c.firma, person: c.person, strasse: c.strasse, plz: c.plz, ort: c.ort, land: c.land, ustId: c.ustId, email: c.email } : {};
  }
  function neueRechnung(f) {
    const o = f.orderId ? auftrag(f.orderId) : null;
    const contactId = f.contactId || (o && o.contactId);
    const positionen = (f.positionen || (o && o.positionen) || []).map((p) => Object.assign({}, p));
    if (!positionen.length) throw new Error('Rechnung ohne Positionen ist nicht möglich.');
    const s = data.stammdaten;
    const nr = naechsteNummer('rechnung');
    const datum = f.datum || heute();
    const zieltage = Number(f.zahlungszielTage != null ? f.zahlungszielTage : s.zahlungszielTage) || 14;
    const d = new Date(datum + 'T12:00:00'); d.setDate(d.getDate() + zieltage);
    const sum = summen(positionen, s.kleinunternehmer);
    const r = Object.assign({
      id: U.uid(), contactId, orderId: f.orderId || '', titel: f.titel || (o && o.titel) || '', datum,
      leistungVon: f.leistungVon || '', leistungBis: f.leistungBis || '', faellig: U.localDate(d), zahlungszielTage: zieltage,
      positionen, netto: sum.netto, steuer: sum.steuer, brutto: sum.brutto, saetze: sum.saetze, kleinunternehmer: !!s.kleinunternehmer,
      empfaenger: empfaengerSnapshot(kontakt(contactId)), absender: JSON.parse(JSON.stringify(s)),
      hinweis: f.hinweis || '', status: 'Offen', bezahltAm: '', zahlungsart: '', mahnungen: [], stornoVon: '', stornoId: '',
      erstellt: U.nowIso(),
    }, nr);
    delete r.absender.rechnungsFuss; delete r.absender.angebotsFuss;
    r.fuss = s.rechnungsFuss;
    data.invoices.push(r);
    journal('rechnung', r, 'Gestellt', o ? 'aus Auftrag ' + o.nummer : '');
    if (o) { o.status = 'Berechnet'; o.geaendert = U.nowIso(); journal('auftrag', o, 'Berechnet', 'Rechnung ' + r.nummer); }
    commit('Rechnung gestellt: ' + r.nummer);
    return r;
  }
  function markiereBezahlt(id, datum, zahlungsart) {
    const r = rechnung(id); if (!r) return null;
    if (r.status !== 'Offen') throw new Error('Nur offene Rechnungen können als bezahlt markiert werden.');
    r.status = 'Bezahlt'; r.bezahltAm = datum || heute(); r.zahlungsart = zahlungsart || '';
    journal('rechnung', r, 'Bezahlt', (zahlungsart || '') + ' am ' + U.fmtDatum(r.bezahltAm));
    commit('Rechnung bezahlt: ' + r.nummer);
    return r;
  }
  function bezahltZuruecknehmen(id) {
    const r = rechnung(id); if (!r || r.status !== 'Bezahlt') return null;
    r.status = 'Offen'; r.bezahltAm = ''; r.zahlungsart = '';
    journal('rechnung', r, 'Zahlung zurückgenommen', '');
    commit('Zahlung zurückgenommen: ' + r.nummer);
    return r;
  }
  function mahnen(id, stufe, notiz) {
    const r = rechnung(id); if (!r) return null;
    if (r.status !== 'Offen') throw new Error('Nur offene Rechnungen können gemahnt werden.');
    r.mahnungen.push({ stufe, datum: heute(), notiz: notiz || '' });
    journal('rechnung', r, K.MAHNSTUFEN[stufe] || 'Mahnung', notiz);
    commit(K.MAHNSTUFEN[stufe] + ': ' + r.nummer);
    return r;
  }
  // Storno: Original bleibt, ein Storno-Beleg mit negativen Positionen hebt es auf.
  function storniere(id, grund) {
    const r = rechnung(id); if (!r) return null;
    if (r.status === 'Storniert' || r.status === 'Storno') throw new Error('Rechnung ist bereits storniert.');
    const nr = naechsteNummer('rechnung');
    const st = Object.assign(JSON.parse(JSON.stringify(r)), nr, {
      id: U.uid(), datum: heute(), faellig: heute(), status: 'Storno', stornoVon: r.nummer, stornoId: '', bezahltAm: '', zahlungsart: '', mahnungen: [],
      positionen: r.positionen.map((p) => Object.assign({}, p, { id: U.uid(), menge: -Math.abs(Number(p.menge) || 0) })),
      hinweis: 'Storno zu Rechnung ' + r.nummer + (grund ? '. Grund: ' + grund : ''), erstellt: U.nowIso(),
    });
    st.netto = -r.netto; st.steuer = -r.steuer; st.brutto = -r.brutto; st.saetze = r.saetze.map((s) => ({ satz: s.satz, basis: -s.basis, betrag: -s.betrag }));
    data.invoices.push(st);
    r.status = 'Storniert'; r.stornoId = st.id;
    journal('rechnung', r, 'Storniert', 'Storno-Beleg ' + st.nummer + (grund ? ': ' + grund : ''));
    journal('rechnung', st, 'Storno gestellt', 'zu ' + r.nummer);
    if (r.orderId) { const o = auftrag(r.orderId); if (o && o.status === 'Berechnet') { o.status = 'Fertig'; journal('auftrag', o, 'Fertig', 'Rechnung ' + r.nummer + ' storniert'); } }
    commit('Rechnung storniert: ' + r.nummer);
    return st;
  }
  const offeneRechnungen = () => data.invoices.filter((r) => r.status === 'Offen');
  const ueberfaelligeRechnungen = () => offeneRechnungen().filter((r) => r.faellig < heute());

  // ---- Zeiten
  const zeit = (id) => data.times.find((t) => t.id === id);
  function neueZeit(f) {
    const t = Object.assign({ id: U.uid(), datum: heute(), orderId: '', minuten: 0, beschreibung: '', abrechenbar: true, abgerechnetPositionId: '', erstellt: U.nowIso() }, f);
    t.minuten = Math.max(0, Math.round(Number(t.minuten) || 0));
    data.times.push(t);
    commit('Zeit erfasst: ' + Math.round(t.minuten) + ' min');
    return t;
  }
  function aendereZeit(id, f) {
    const t = zeit(id); if (!t) return null;
    if (t.abgerechnetPositionId) throw new Error('Zeit ist bereits abgerechnet und kann nicht mehr geändert werden.');
    Object.assign(t, f); t.minuten = Math.max(0, Math.round(Number(t.minuten) || 0));
    commit('Zeit geändert');
    return t;
  }
  function loescheZeit(id) {
    const t = zeit(id); if (!t) return;
    if (t.abgerechnetPositionId) throw new Error('Zeit ist bereits abgerechnet und kann nicht gelöscht werden.');
    data.times = data.times.filter((x) => x.id !== id);
    commit('Zeit gelöscht');
  }
  // Timer liegt nur auf diesem Gerät (localStorage), nicht in den Daten.
  const timer = () => lies(LS.timer, null);
  function timerStart(orderId, beschreibung) { localStorage.setItem(LS.timer, JSON.stringify({ start: U.nowIso(), orderId: orderId || '', beschreibung: beschreibung || '' })); emit(); }
  function timerStop() {
    const t = timer(); if (!t) return null;
    localStorage.removeItem(LS.timer);
    const minuten = Math.max(1, Math.round((Date.now() - new Date(t.start).getTime()) / 60000));
    return neueZeit({ datum: U.localDate(new Date(t.start)), orderId: t.orderId, minuten, beschreibung: t.beschreibung });
  }
  function timerVerwerfen() { localStorage.removeItem(LS.timer); emit(); }

  // ---- Ausgaben
  const ausgabe = (id) => data.expenses.find((a) => a.id === id);
  function ausgabeBetraege(f) {
    const brutto = round2(f.brutto);
    const satz = Number(f.steuersatz) || 0;
    const netto = round2(brutto / (1 + satz / 100));
    return { brutto, netto, steuer: round2(brutto - netto), steuersatz: satz };
  }
  function neueAusgabe(f) {
    const a = Object.assign({ id: U.uid(), datum: heute(), lieferant: '', beschreibung: '', kategorie: 'Sonstiges', belegNr: '', brutto: 0, steuersatz: 19, netto: 0, steuer: 0, bezahlt: true, zahlungsart: 'Überweisung', orderId: '', wiederkehrend: false, notizen: '', erstellt: U.nowIso() }, f, ausgabeBetraege(f));
    data.expenses.push(a);
    commit('Ausgabe erfasst: ' + a.lieferant);
    return a;
  }
  function aendereAusgabe(id, f) { const a = ausgabe(id); if (!a) return null; Object.assign(a, f, ausgabeBetraege(Object.assign({}, a, f))); commit('Ausgabe geändert: ' + a.lieferant); return a; }
  function loescheAusgabe(id) { data.expenses = data.expenses.filter((a) => a.id !== id); commit('Ausgabe gelöscht'); }

  // ---- Termine
  const termin = (id) => data.appointments.find((t) => t.id === id);
  function neuerTermin(f) {
    const t = Object.assign({ id: U.uid(), titel: '', datum: heute(), von: '', bis: '', ort: '', kategorie: 'Kundentermin', contactId: '', orderId: '', notizen: '', erstellt: U.nowIso() }, f);
    data.appointments.push(t);
    commit('Termin angelegt: ' + t.titel);
    return t;
  }
  function aendereTermin(id, f) { const t = termin(id); if (!t) return null; Object.assign(t, f); commit('Termin geändert: ' + t.titel); return t; }
  function loescheTermin(id) { data.appointments = data.appointments.filter((t) => t.id !== id); commit('Termin gelöscht'); }

  // ---- Abfragen
  const letzteAktivitaet = (contactId) => U.sortiere(data.activities.filter((a) => a.contactId === contactId), 'datum', true)[0] || null;
  const offeneVorgaenge = () => data.deals.filter((d) => K.OFFEN.includes(d.phase));
  const offeneAufgaben = () => data.tasks.filter((t) => !t.erledigt);
  const minutenImZeitraum = (von, bis) => data.times.filter((t) => t.datum >= von && t.datum <= bis).reduce((s, t) => s + (Number(t.minuten) || 0), 0);

  // Monatsauswertung eines Jahres: Umsatz (gestellt), Einnahmen (bezahlt), Ausgaben, USt
  function jahresauswertung(jahr) {
    const monate = Array.from({ length: 12 }, (_, i) => ({ monat: i + 1, gestelltNetto: 0, einnahmenNetto: 0, einnahmenBrutto: 0, ustVereinnahmt: 0, ausgabenNetto: 0, ausgabenBrutto: 0, vorsteuer: 0 }));
    const m = (d) => Number(String(d).slice(5, 7)) - 1;
    for (const r of data.invoices) {
      if (r.status === 'Storniert') continue; // Original und Storno heben sich auf; der Storno-Beleg zählt negativ
      if (String(r.datum).startsWith(jahr)) monate[m(r.datum)].gestelltNetto += r.netto;
      const zahlDatum = r.status === 'Bezahlt' ? r.bezahltAm : (r.status === 'Storno' ? r.datum : '');
      if (zahlDatum && String(zahlDatum).startsWith(jahr)) { const x = monate[m(zahlDatum)]; x.einnahmenNetto += r.netto; x.einnahmenBrutto += r.brutto; x.ustVereinnahmt += r.steuer; }
    }
    for (const a of data.expenses) {
      if (!String(a.datum).startsWith(jahr)) continue;
      const x = monate[m(a.datum)]; x.ausgabenNetto += a.netto; x.ausgabenBrutto += a.brutto; x.vorsteuer += a.steuer;
    }
    monate.forEach((x) => { for (const k of Object.keys(x)) if (k !== 'monat') x[k] = round2(x[k]); });
    const summe = monate.reduce((s, x) => { for (const k of Object.keys(x)) if (k !== 'monat') s[k] = round2((s[k] || 0) + x[k]); return s; }, {});
    return { monate, summe };
  }

  // ---- Demo-Daten (fiktiv)
  function demoDaten() {
    const alt = data; // damit die Nummernkreise auf den Demo-Daten rechnen
    const d = leer();
    Object.assign(d.stammdaten, { name: 'Beispiel Beratung', firma: 'Beispiel Beratung', strasse: 'Musterstraße 1', plz: '50667', ort: 'Köln', email: 'post@beispiel.de', telefon: '+49 221 000000', steuernummer: '000/000/00000', ustId: 'DE000000000', iban: 'DE00 0000 0000 0000 0000 00', bank: 'Musterbank', stundensatz: 95, zahlungszielTage: 14 });
    data = d;
    try {
      const h = heute();
      const k = (f) => { const c = Object.assign(KONTAKT_LEER(), f); d.contacts.push(c); return c; };
      const c1 = k({ firma: 'Hotel Rheinblick (Demo)', person: 'Frau Vogel', email: 'vogel@beispiel.de', telefon: '+49 214 222333', strasse: 'Uferweg 12', plz: '51373', ort: 'Leverkusen', branche: 'Hotel', quelle: 'Netzwerk/Event', status: 'Interessent', notizen: 'Messekontakt, sucht Komplettlösung für Gästekommunikation.' });
      const c2 = k({ firma: 'Bäckerei Demir (Demo)', person: 'Herr Demir', email: 'demir@beispiel.de', telefon: '+49 221 444276', strasse: 'Venloer Str. 200', plz: '50823', ort: 'Köln', branche: 'Bäckerei', quelle: 'Empfehlung', status: 'Kunde', einwilligungEmail: true, einwilligungDatum: U.inTagen(-40), notizen: '3 Filialen, Website-Relaunch läuft.' });
      const c3 = k({ firma: 'Pixelwald Werbeagentur (Demo)', person: 'Frau Okafor', email: 'okafor@beispiel.de', strasse: 'Aachener Str. 5', plz: '50674', ort: 'Köln', branche: 'Agentur', quelle: 'LinkedIn', status: 'Interessent', notizen: 'Erstgespräch zu Automatisierung im Kundenservice, 20 Personen.' });
      const c4 = k({ firma: 'Steuerkanzlei Averbeck (Demo)', person: 'Herr Averbeck', email: 'averbeck@beispiel.de', telefon: '+49 221 555889', strasse: 'Hohenzollernring 40', plz: '50672', ort: 'Köln', branche: 'Steuerberatung', quelle: 'Schulung', status: 'Kunde', einwilligungEmail: true, einwilligungDatum: U.inTagen(-90), notizen: 'Teilnehmer KI-Manager-Schulung, preisbewusst.' });
      const c5 = k({ firma: 'Modehaus Eleganz (Demo)', person: 'Frau Richter', email: 'richter@beispiel.de', ort: 'München', branche: 'Einzelhandel', quelle: 'Website', status: 'Archiv', notizen: 'Wollte nur Preisvergleich, kein Bedarf.' });
      const v = (f) => { const x = Object.assign({ id: U.uid(), verlustgrund: '', notizen: '', nachbereitung: {}, abschlussDatum: '', erstellt: U.nowIso(), geaendert: U.nowIso(), geschlossen: '' }, f); d.deals.push(x); journal('vorgang', { id: x.id, nummer: x.titel }, 'Vorgang angelegt', 'Phase ' + x.phase); return x; };
      const v1 = v({ contactId: c1.id, titel: 'Chatbot Gästeanfragen', phase: 'Angebot', wert: 4800, naechsterSchritt: 'Angebot nachfassen', faellig: U.inTagen(2) });
      v({ contactId: c3.id, titel: 'Workshop Automatisierung', phase: 'Erstgespräch', wert: 1900, naechsterSchritt: 'Bedarf konkretisieren', faellig: U.inTagen(-1) });
      v({ contactId: c2.id, titel: 'Website-Relaunch Filialen', phase: 'Abschluss', wert: 6500, abschlussDatum: U.inTagen(-20), naechsterSchritt: 'Abnahme Filialseiten', faellig: U.inTagen(6) });
      v({ contactId: c4.id, titel: 'KI-Schulung Kanzleiteam', phase: 'Nachbereitung', wert: 1400, abschlussDatum: U.inTagen(-50), naechsterSchritt: 'Feedbackgespräch, Folgebedarf Postfach', faellig: U.inTagen(3), nachbereitung: { feedback: true } });
      v({ contactId: c4.id, titel: 'Postfach-Automatisierung', phase: 'Verhandlung', wert: 2400, naechsterSchritt: 'Preisgespräch', faellig: U.inTagen(5) });
      v({ contactId: c5.id, titel: 'Online-Shop-Beratung', phase: 'Verloren', wert: 1200, verlustgrund: 'Preis', geschlossen: U.inTagen(-10) });
      const a = (f) => d.activities.push(Object.assign({ id: U.uid(), dealId: '' }, f));
      a({ contactId: c1.id, typ: 'Termin', text: 'Messegespräch, 40 Zimmer, will Komplettlösung.', datum: new Date(Date.now() - 6 * 864e5).toISOString() });
      a({ contactId: c1.id, typ: 'E-Mail', text: 'Angebot über 4.800 € gesendet.', datum: new Date(Date.now() - 2 * 864e5).toISOString() });
      a({ contactId: c3.id, typ: 'Anruf', text: 'Erstgespräch: Kundenservice-Mails sollen vorsortiert werden.', datum: new Date(Date.now() - 4 * 864e5).toISOString() });
      a({ contactId: c2.id, typ: 'Notiz', text: 'Relaunch-Kickoff mit allen drei Filialleitungen.', datum: new Date(Date.now() - 12 * 864e5).toISOString() });
      // Angebot (gesendet) zum Hotel
      const q1 = neuesAngebot({ contactId: c1.id, dealId: v1.id, titel: 'Chatbot für Gästeanfragen', einleitung: 'vielen Dank für das gute Gespräch auf der Messe. Wie besprochen erhalten Sie hiermit unser Angebot.', positionen: [positionNeu({ art: 'Pauschale', bezeichnung: 'Konzeption und Einrichtung Chatbot', menge: 1, einheit: 'pauschal', einzelpreis: 3200 }), positionNeu({ art: 'Leistung', bezeichnung: 'Schulung Rezeptionsteam', menge: 4, einheit: 'Std', einzelpreis: 95 }), positionNeu({ art: 'Pauschale', bezeichnung: 'Betreuung erste 3 Monate', menge: 3, einheit: 'Monat', einzelpreis: 400 })] });
      q1.status = 'Gesendet'; q1.datum = U.inTagen(-2); journal('angebot', q1, 'Gesendet', '');
      // Auftrag in Arbeit mit Zeiten (Bäckerei)
      const o1 = neuerAuftrag({ contactId: c2.id, titel: 'Website-Relaunch Filialen', beschreibung: 'Neue Website mit Filialseiten, Online-Vorbestellung, Pflegeschulung.', datum: U.inTagen(-20), faellig: U.inTagen(20), budget: 6500, positionen: [positionNeu({ art: 'Pauschale', bezeichnung: 'Konzept und Design', menge: 1, einheit: 'pauschal', einzelpreis: 2500 })] });
      o1.status = 'In Arbeit'; journal('auftrag', o1, 'In Arbeit', '');
      const z = (f) => d.times.push(Object.assign({ id: U.uid(), abrechenbar: true, abgerechnetPositionId: '', erstellt: U.nowIso() }, f));
      z({ datum: U.inTagen(-8), orderId: o1.id, minuten: 180, beschreibung: 'Filialseiten umgesetzt' });
      z({ datum: U.inTagen(-6), orderId: o1.id, minuten: 240, beschreibung: 'Vorbestell-Formular gebaut' });
      z({ datum: U.inTagen(-1), orderId: o1.id, minuten: 90, beschreibung: 'Abstimmung mit Filialleitung' });
      z({ datum: h, orderId: '', minuten: 45, beschreibung: 'Buchhaltung, Belege sortiert', abrechenbar: false });
      // Auftrag fertig und berechnet (Kanzlei): eine bezahlte Rechnung, eine offene überfällige
      const o2 = neuerAuftrag({ contactId: c4.id, titel: 'KI-Schulung Kanzleiteam', datum: U.inTagen(-50), positionen: [positionNeu({ art: 'Leistung', bezeichnung: 'Workshop KI im Kanzleialltag, 1 Tag', menge: 1, einheit: 'Tag', einzelpreis: 1400 })] });
      o2.status = 'Fertig'; o2.fertigAm = U.inTagen(-45);
      const r1 = neueRechnung({ orderId: o2.id, datum: U.inTagen(-44), leistungVon: U.inTagen(-46), leistungBis: U.inTagen(-46) });
      r1.status = 'Bezahlt'; r1.bezahltAm = U.inTagen(-30); r1.zahlungsart = 'Überweisung'; journal('rechnung', r1, 'Bezahlt', 'Überweisung');
      const o3 = neuerAuftrag({ contactId: c4.id, titel: 'Postfach-Vorsortierung Pilot', datum: U.inTagen(-30), positionen: [positionNeu({ art: 'Leistung', bezeichnung: 'Einrichtung Pilot-Workflow', menge: 12, einheit: 'Std', einzelpreis: 95 }), positionNeu({ art: 'Auslage', bezeichnung: 'Hosting Testumgebung', menge: 1, einheit: 'Monat', einzelpreis: 24 })] });
      o3.status = 'Fertig'; o3.fertigAm = U.inTagen(-22);
      const r2 = neueRechnung({ orderId: o3.id, datum: U.inTagen(-21), leistungVon: U.inTagen(-30), leistungBis: U.inTagen(-22) });
      r2.mahnungen.push({ stufe: 0, datum: U.inTagen(-3), notiz: '' }); journal('rechnung', r2, 'Zahlungserinnerung', '');
      // Ausgaben
      const g = (f) => d.expenses.push(Object.assign({ id: U.uid(), bezahlt: true, zahlungsart: 'Karte', orderId: '', wiederkehrend: false, notizen: '', belegNr: '', erstellt: U.nowIso() }, f, ausgabeBetraege(f)));
      g({ datum: U.inTagen(-28), lieferant: 'Cloud-Anbieter', beschreibung: 'Server Monat', kategorie: 'Software/Abos', brutto: 10.70, steuersatz: 19, wiederkehrend: true });
      g({ datum: U.inTagen(-15), lieferant: 'Bahn', beschreibung: 'Fahrt zum Kunden Leverkusen', kategorie: 'Reise', brutto: 23.80, steuersatz: 7 });
      g({ datum: U.inTagen(-10), lieferant: 'KI-Dienst', beschreibung: 'API-Nutzung', kategorie: 'Software/Abos', brutto: 47.60, steuersatz: 19 });
      g({ datum: U.inTagen(-4), lieferant: 'Fachbuchhandel', beschreibung: 'Fachliteratur Prozessautomation', kategorie: 'Fortbildung', brutto: 39.90, steuersatz: 7 });
      // Termine
      const tm = (f) => d.appointments.push(Object.assign({ id: U.uid(), von: '', bis: '', ort: '', orderId: '', notizen: '', erstellt: U.nowIso() }, f));
      tm({ titel: 'Angebotsbesprechung Hotel Rheinblick', datum: U.inTagen(2), von: '10:00', bis: '11:00', ort: 'Leverkusen', kategorie: 'Kundentermin', contactId: c1.id });
      tm({ titel: 'Abnahme Filialseiten', datum: U.inTagen(6), von: '14:00', bis: '15:30', ort: 'Video', kategorie: 'Kundentermin', contactId: c2.id, orderId: o1.id });
      tm({ titel: 'USt-Voranmeldung vorbereiten', datum: U.inTagen(8), kategorie: 'Intern', contactId: '' });
      // Aufgaben
      const t = (f) => d.tasks.push(Object.assign({ id: U.uid(), dealId: '', orderId: '', prioritaet: 'Normal', erledigt: '', erstellt: U.nowIso() }, f));
      t({ contactId: c1.id, titel: 'Angebot Hotel Rheinblick nachfassen', faellig: U.inTagen(2), prioritaet: 'Hoch' });
      t({ contactId: c3.id, titel: 'Beispiel-Workflow für Pixelwald vorbereiten', faellig: h });
      t({ contactId: c4.id, titel: 'Rechnung ' + r2.nummer + ' telefonisch nachfassen', faellig: U.inTagen(-3), prioritaet: 'Dringend' });
      t({ contactId: '', titel: 'LinkedIn-Beitrag zur Schulung', faellig: '' });
      // Journey: Kampagne, Ereignisse, Workflows (fiktiv)
      c2.einwilligungTracking = true; c4.einwilligungTracking = true; c2.tags = ['Newsletter']; c4.tags = ['Schulung'];
      const kamp = { id: U.uid(), name: 'Praxis-Newsletter Oktober', datum: U.inTagen(-20), kanal: 'Brevo', betreff: '3 Automationen, die jede Kanzlei braucht', ziel_url: 'https://beispiel.de/automation', extern_id: '', aggregat: { gesendet: 140, geoeffnet: 51, geklickt: 9, abgemeldet: 1 }, notiz: '', erstellt: U.nowIso() };
      d.campaigns.push(kamp);
      const tp = (kontaktId, art, tage, extra) => d.touchpoints.push(Object.assign({ id: U.uid(), kontaktId, art, datum: new Date(Date.now() - tage * 864e5).toISOString(), kampagneId: null, titel: '', wert: null, quelle: '', externId: null, erfasst: new Date(Date.now() - tage * 864e5).toISOString() }, extra || {}));
      tp(c2.id, 'newsletter_gesendet', 20, { kampagneId: kamp.id, titel: kamp.name, quelle: 'Newsletter' });
      tp(c2.id, 'newsletter_geklickt', 19.5, { kampagneId: kamp.id, titel: kamp.name, quelle: 'Newsletter' });
      tp(c4.id, 'newsletter_gesendet', 20, { kampagneId: kamp.id, titel: kamp.name, quelle: 'Newsletter' });
      tp(c4.id, 'newsletter_geoeffnet', 19, { kampagneId: kamp.id, titel: kamp.name, quelle: 'Newsletter' });
      tp(c4.id, 'empfehlung', 15, { titel: 'Hat die Schulung einer Kollegin empfohlen' });
      tp(c1.id, 'website', 8, { titel: 'Kontaktformular Website', quelle: 'Website' });
      const vorl = window.CRMJourney ? window.CRMJourney.vorlagen('solo') : [];
      vorl.filter((v) => ['Angebot nachfassen', 'Überfällige Rechnung', 'Newsletter-Klick nachfassen'].includes(v.name)).forEach((v) => d.workflows.push({ id: U.uid(), name: v.name, beschreibung: v.beschreibung, aktiv: v.name !== 'Newsletter-Klick nachfassen', mehrfach: false, ausloeser: v.ausloeser, schritte: v.schritte, erstellt: U.nowIso(), geaendert: U.nowIso() }));
      d.workflowStand = { letzterLauf: U.nowIso(), letzterTag: null };
    } finally {
      data = alt;
    }
    return d;
  }

  CRM.store = {
    K, leer, demoDaten, summen, positionNeu, round2, naechsteNummer, journalFuer,
    get data() { return data; }, get settings() { return settings; }, get meta() { return meta; },
    on, commit, replaceData, saveMeta, saveSettings, saveStammdaten,
    kontakt, kontaktName, neuerKontakt, aendereKontakt, loescheKontakt,
    vorgang, neuerVorgang, aendereVorgang, loescheVorgang,
    neueAktivitaet, aendereAktivitaet, loescheAktivitaet, historie,
    aufgabe, neueAufgabe, aendereAufgabe, erledigeAufgabe, loescheAufgabe,
    angebot, neuesAngebot, aendereAngebot, setzeAngebotStatus, kopiereAngebot, angebotZuAuftrag,
    auftrag, neuerAuftrag, aendereAuftrag, setzeAuftragStatus, positionSpeichern, positionLoeschen, unabgerechneteZeiten, zeitenAbrechnen,
    rechnung, neueRechnung, markiereBezahlt, bezahltZuruecknehmen, mahnen, storniere, offeneRechnungen, ueberfaelligeRechnungen,
    zeit, neueZeit, aendereZeit, loescheZeit, timer, timerStart, timerStop, timerVerwerfen,
    ausgabe, neueAusgabe, aendereAusgabe, loescheAusgabe,
    termin, neuerTermin, aendereTermin, loescheTermin,
    letzteAktivitaet, offeneVorgaenge, offeneAufgaben, minutenImZeitraum, jahresauswertung,
  };
})(window.CRM);
