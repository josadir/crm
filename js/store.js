// Datenhaltung: ein JSON-Dokument (Kontakte, Vorgänge, Aktivitäten, Aufgaben),
// immer im localStorage, zusätzlich per sync.js auf GitHub.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util;
  const LS = { data: 'crm.data', settings: 'crm.settings', meta: 'crm.meta' };

  const K = {
    PHASEN: ['Anfrage', 'Erstgespräch', 'Angebot', 'Verhandlung', 'Gewonnen', 'Verloren'],
    OFFEN: ['Anfrage', 'Erstgespräch', 'Angebot', 'Verhandlung'],
    STATUS: ['Interessent', 'Kunde', 'Partner', 'Archiv'],
    QUELLEN: ['Empfehlung', 'Website', 'LinkedIn', 'Netzwerk/Event', 'Schulung', 'Kaltakquise', 'Bestandskunde', 'Sonstiges'],
    VERLUST: ['Preis', 'Zeitpunkt', 'Kein Bedarf', 'Wettbewerber', 'Keine Rückmeldung', 'Sonstiges'],
    AKTIVITAET: ['Notiz', 'Anruf', 'E-Mail', 'Termin'],
  };

  const leer = () => ({ version: 1, updatedAt: U.nowIso(), contacts: [], deals: [], activities: [], tasks: [] });

  function lies(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function normalisiere(d) {
    if (!d || typeof d !== 'object') d = leer();
    d.version = 1;
    for (const k of ['contacts', 'deals', 'activities', 'tasks']) if (!Array.isArray(d[k])) d[k] = [];
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

  // Jede fachliche Änderung läuft hier durch: Zeitstempel, dirty-Markierung, Speichern, Benachrichtigen.
  function commit(label) {
    data.updatedAt = U.nowIso();
    persist();
    saveMeta({ dirty: true, lastLabel: label || 'Änderung' });
    emit();
  }
  // Kompletten Datenstand ersetzen (Sync, Import, Demo). dirty=true, wenn der Stand noch nicht auf GitHub liegt.
  function replaceData(neu, dirty) {
    data = normalisiere(JSON.parse(JSON.stringify(neu)));
    if (dirty) data.updatedAt = U.nowIso();
    persist();
    saveMeta({ dirty: !!dirty, lastLabel: dirty ? 'Datenstand ersetzt' : meta.lastLabel });
    emit();
  }

  // ---- Kontakte
  const kontakt = (id) => data.contacts.find((c) => c.id === id);
  const kontaktName = (id) => { const c = kontakt(id); return c ? (c.firma || c.person || '(ohne Namen)') : '(gelöschter Kontakt)'; };
  function neuerKontakt(f) {
    const c = Object.assign({
      id: U.uid(), firma: '', person: '', email: '', telefon: '', website: '', ort: '', branche: '', quelle: '',
      status: 'Interessent', einwilligungEmail: false, einwilligungDatum: '', notizen: '',
      erstellt: U.nowIso(), geaendert: U.nowIso(),
    }, f);
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
    const name = kontaktName(id);
    data.contacts = data.contacts.filter((c) => c.id !== id);
    data.deals = data.deals.filter((d) => d.contactId !== id);
    data.activities = data.activities.filter((a) => a.contactId !== id);
    data.tasks = data.tasks.filter((t) => t.contactId !== id);
    commit('Kontakt gelöscht: ' + name);
  }

  // ---- Vorgänge (Deals)
  const vorgang = (id) => data.deals.find((d) => d.id === id);
  function schliesseFalls(d) {
    if (d.phase === 'Gewonnen' || d.phase === 'Verloren') {
      if (!d.geschlossen) d.geschlossen = U.heute();
      if (d.phase === 'Gewonnen') { d.verlustgrund = ''; const c = kontakt(d.contactId); if (c && c.status === 'Interessent') c.status = 'Kunde'; }
    } else {
      d.geschlossen = '';
      d.verlustgrund = '';
    }
  }
  function neuerVorgang(f) {
    const d = Object.assign({
      id: U.uid(), contactId: '', titel: '', phase: 'Anfrage', wert: 0, naechsterSchritt: '', faellig: '',
      verlustgrund: '', notizen: '', erstellt: U.nowIso(), geaendert: U.nowIso(), geschlossen: '',
    }, f);
    schliesseFalls(d);
    data.deals.push(d);
    commit('Vorgang angelegt: ' + d.titel);
    return d;
  }
  function aendereVorgang(id, f) {
    const d = vorgang(id); if (!d) return null;
    Object.assign(d, f, { geaendert: U.nowIso() });
    schliesseFalls(d);
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
    const a = Object.assign({ id: U.uid(), contactId: '', dealId: '', typ: 'Notiz', text: '', datum: U.nowIso() }, f);
    data.activities.push(a);
    commit(a.typ + ' bei ' + kontaktName(a.contactId));
    return a;
  }
  function loescheAktivitaet(id) {
    data.activities = data.activities.filter((a) => a.id !== id);
    commit('Aktivität gelöscht');
  }

  // ---- Aufgaben
  const aufgabe = (id) => data.tasks.find((t) => t.id === id);
  function neueAufgabe(f) {
    const t = Object.assign({ id: U.uid(), contactId: '', dealId: '', titel: '', faellig: '', erledigt: '', erstellt: U.nowIso() }, f);
    data.tasks.push(t);
    commit('Aufgabe angelegt: ' + t.titel);
    return t;
  }
  function aendereAufgabe(id, f) {
    const t = aufgabe(id); if (!t) return null;
    Object.assign(t, f);
    commit('Aufgabe geändert: ' + t.titel);
    return t;
  }
  function erledigeAufgabe(id, erledigt) {
    const t = aufgabe(id); if (!t) return;
    t.erledigt = erledigt ? U.nowIso() : '';
    commit((erledigt ? 'Aufgabe erledigt: ' : 'Aufgabe wieder offen: ') + t.titel);
  }
  function loescheAufgabe(id) {
    data.tasks = data.tasks.filter((t) => t.id !== id);
    commit('Aufgabe gelöscht');
  }

  // ---- Abfragen
  const letzteAktivitaet = (contactId) => U.sortiere(data.activities.filter((a) => a.contactId === contactId), 'datum', true)[0] || null;
  const offeneVorgaenge = () => data.deals.filter((d) => K.OFFEN.includes(d.phase));
  const offeneAufgaben = () => data.tasks.filter((t) => !t.erledigt);

  // ---- Demo-Daten (fiktiv), zum Ausprobieren
  function demoDaten() {
    const d = leer();
    const k = (f) => { const c = Object.assign({ id: U.uid(), website: '', einwilligungEmail: false, einwilligungDatum: '', notizen: '', erstellt: U.nowIso(), geaendert: U.nowIso() }, f); d.contacts.push(c); return c; };
    const h = U.heute();
    const c1 = k({ firma: 'Hotel Rheinblick (Demo)', person: 'Frau Vogel', email: 'vogel@beispiel.de', telefon: '+49 214 222333', ort: 'Leverkusen', branche: 'Hotel', quelle: 'Netzwerk/Event', status: 'Interessent', notizen: 'Messekontakt, sucht Komplettlösung für Gästekommunikation.' });
    const c2 = k({ firma: 'Bäckerei Demir (Demo)', person: 'Herr Demir', email: 'demir@beispiel.de', telefon: '+49 221 444276', ort: 'Köln', branche: 'Bäckerei', quelle: 'Empfehlung', status: 'Kunde', einwilligungEmail: true, einwilligungDatum: U.inTagen(-40), notizen: '3 Filialen, Website-Relaunch läuft.' });
    const c3 = k({ firma: 'Pixelwald Werbeagentur (Demo)', person: 'Frau Okafor', email: 'okafor@beispiel.de', telefon: '', ort: 'Köln', branche: 'Agentur', quelle: 'LinkedIn', status: 'Interessent', notizen: 'Erstgespräch zu Automatisierung im Kundenservice, 20 Personen.' });
    const c4 = k({ firma: 'Steuerkanzlei Averbeck (Demo)', person: 'Herr Averbeck', email: 'averbeck@beispiel.de', telefon: '+49 221 555889', ort: 'Köln', branche: 'Steuerberatung', quelle: 'Schulung', status: 'Kunde', einwilligungEmail: true, einwilligungDatum: U.inTagen(-90), notizen: 'Teilnehmer KI-Manager-Schulung, preisbewusst.' });
    const c5 = k({ firma: 'Modehaus Eleganz (Demo)', person: 'Frau Richter', email: 'richter@beispiel.de', telefon: '+49 89 123456', ort: 'München', branche: 'Einzelhandel', quelle: 'Website', status: 'Archiv', notizen: 'Wollte nur Preisvergleich, kein Bedarf.' });
    const v = (f) => d.deals.push(Object.assign({ id: U.uid(), verlustgrund: '', notizen: '', erstellt: U.nowIso(), geaendert: U.nowIso(), geschlossen: '' }, f));
    v({ contactId: c1.id, titel: 'Chatbot Gästeanfragen', phase: 'Angebot', wert: 4800, naechsterSchritt: 'Angebot nachfassen', faellig: U.inTagen(2) });
    v({ contactId: c3.id, titel: 'Workshop Automatisierung', phase: 'Erstgespräch', wert: 1900, naechsterSchritt: 'Bedarf konkretisieren', faellig: U.inTagen(-1) });
    v({ contactId: c2.id, titel: 'Website-Relaunch Filialen', phase: 'Gewonnen', wert: 6500, naechsterSchritt: '', faellig: '', geschlossen: U.inTagen(-20) });
    v({ contactId: c4.id, titel: 'Postfach-Automatisierung', phase: 'Verhandlung', wert: 2400, naechsterSchritt: 'Preisgespräch', faellig: U.inTagen(5) });
    v({ contactId: c5.id, titel: 'Online-Shop-Beratung', phase: 'Verloren', wert: 1200, naechsterSchritt: '', faellig: '', verlustgrund: 'Preis', geschlossen: U.inTagen(-10) });
    const a = (f) => d.activities.push(Object.assign({ id: U.uid(), dealId: '' }, f));
    a({ contactId: c1.id, typ: 'Termin', text: 'Messegespräch, 40 Zimmer, will Komplettlösung.', datum: new Date(Date.now() - 6 * 864e5).toISOString() });
    a({ contactId: c1.id, typ: 'E-Mail', text: 'Angebot über 4.800 € gesendet.', datum: new Date(Date.now() - 2 * 864e5).toISOString() });
    a({ contactId: c3.id, typ: 'Anruf', text: 'Erstgespräch: Kundenservice-Mails sollen vorsortiert werden.', datum: new Date(Date.now() - 4 * 864e5).toISOString() });
    a({ contactId: c2.id, typ: 'Notiz', text: 'Relaunch-Kickoff mit allen drei Filialleitungen.', datum: new Date(Date.now() - 12 * 864e5).toISOString() });
    const t = (f) => d.tasks.push(Object.assign({ id: U.uid(), dealId: '', erledigt: '', erstellt: U.nowIso() }, f));
    t({ contactId: c1.id, titel: 'Angebot Hotel Rheinblick nachfassen', faellig: U.inTagen(2) });
    t({ contactId: c3.id, titel: 'Beispiel-Workflow für Pixelwald vorbereiten', faellig: h });
    t({ contactId: c2.id, titel: 'Rechnung Website-Relaunch stellen', faellig: U.inTagen(-3) });
    t({ contactId: '', titel: 'LinkedIn-Beitrag zur Schulung', faellig: '' });
    return d;
  }

  CRM.store = {
    K, leer, demoDaten,
    get data() { return data; }, get settings() { return settings; }, get meta() { return meta; },
    on, commit, replaceData, saveMeta, saveSettings,
    kontakt, kontaktName, neuerKontakt, aendereKontakt, loescheKontakt,
    vorgang, neuerVorgang, aendereVorgang, loescheVorgang,
    neueAktivitaet, loescheAktivitaet,
    aufgabe, neueAufgabe, aendereAufgabe, erledigeAufgabe, loescheAufgabe,
    letzteAktivitaet, offeneVorgaenge, offeneAufgaben,
  };
})(window.CRM);
