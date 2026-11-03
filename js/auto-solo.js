// Adapter zwischen den gemeinsamen Journey-/Workflow-Ansichten und dem Solo-CRM (Daten als JSON auf GitHub).
// Touchpoints entstehen hier aus vorhandenen Daten (Kontakte, Gespräche, Phasen, Angebote, Zahlungen, Aufgaben, Termine)
// plus gespeicherte Ereignisse (Newsletter-Import, manuell). Workflows laufen im Browser, solange das CRM offen ist.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, J = window.CRMJourney;
  let cache = { stand: null, liste: [], map: null };

  const d = () => S.data;
  const kontaktNorm = (c) => ({ id: c.id, name: c.firma || c.person || '(ohne Namen)', vorname: c.person || c.firma || '', firma: c.firma, email: c.email, typ: 'b2b', status: c.status, quelle: c.quelle, tags: c.tags || [], einwilligung: !!c.einwilligungEmail, tracking: !!c.einwilligungTracking, betreuer: null, erstellt: c.erstellt });

  function abgeleitet() {
    const D = d(), tps = [];
    D.contacts.forEach((c) => tps.push({ id: 'c:' + c.id, kontaktId: c.id, art: 'erstkontakt', datum: c.erstellt, titel: 'Kontakt angelegt', quelle: c.quelle, erfasst: c.erstellt }));
    D.activities.forEach((a) => { if (a.typ !== 'Automation' && a.contactId) tps.push({ id: 'a:' + a.id, kontaktId: a.contactId, art: a.typ === 'Termin' ? 'termin' : 'gespraech', datum: a.datum, titel: (a.typ + ' ' + (a.betreff || '')).trim(), bezugId: a.dealId || null, erfasst: a.erfasst || a.datum }); });
    const deal = new Map(D.deals.map((x) => [x.id, x])), angebot = new Map(D.quotes.map((x) => [x.id, x])), rechnung = new Map(D.invoices.map((x) => [x.id, x]));
    D.journal.forEach((j) => {
      if (j.belegart === 'vorgang' && /^Phase: /.test(j.ereignis)) { const v = deal.get(j.belegId); if (v) tps.push({ id: 'j:' + j.id, kontaktId: v.contactId, art: 'phase', datum: j.datum, titel: j.ereignis.slice(7), wert: v.wert, bezugId: v.id, erfasst: j.datum }); }
      if (j.belegart === 'vorgang' && j.ereignis === 'Vorgang angelegt') { const v = deal.get(j.belegId); if (v) tps.push({ id: 'j:' + j.id, kontaktId: v.contactId, art: 'phase', datum: j.datum, titel: String(j.notiz || '').replace('Phase ', '') || v.phase, wert: v.wert, bezugId: v.id, erfasst: j.datum }); }
      if (j.belegart === 'angebot' && j.ereignis === 'Gesendet') { const q = angebot.get(j.belegId); if (q) tps.push({ id: 'j:' + j.id, kontaktId: q.contactId, art: 'angebot', datum: j.datum, titel: q.nummer + ' ' + q.titel, wert: S.summen(q.positionen, D.stammdaten.kleinunternehmer).netto, bezugId: q.id, erfasst: j.datum }); }
      if (j.belegart === 'rechnung' && j.ereignis === 'Bezahlt') { const r = rechnung.get(j.belegId); if (r && r.status !== 'Storniert') tps.push({ id: 'j:' + j.id, kontaktId: r.contactId, art: 'zahlung', datum: r.bezahltAm ? r.bezahltAm + 'T12:00:00' : j.datum, titel: r.nummer + ' ' + r.titel, wert: r.netto, bezugId: r.id, erfasst: j.datum }); }
    });
    D.tasks.forEach((t) => { if (t.erledigt && t.contactId) tps.push({ id: 't:' + t.id, kontaktId: t.contactId, art: 'aufgabe_erledigt', datum: t.erledigt, titel: t.titel, bezugId: t.id, erfasst: t.erledigt }); });
    D.appointments.forEach((t) => { if (t.contactId && t.datum <= U.heute()) tps.push({ id: 'm:' + t.id, kontaktId: t.contactId, art: 'termin', datum: t.datum + 'T' + (t.von || '09:00') + ':00', titel: t.titel, erfasst: t.erstellt }); });
    D.touchpoints.forEach((t) => tps.push(Object.assign({}, t)));
    return tps;
  }
  function alle() {
    if (cache.stand !== d().updatedAt || !cache.map) {
      const liste = abgeleitet(), map = new Map();
      liste.forEach((t) => { if (!map.has(t.kontaktId)) map.set(t.kontaktId, []); map.get(t.kontaktId).push(t); });
      cache = { stand: d().updatedAt, liste, map };
    }
    return cache;
  }

  // ------------------------------------------------ Ausführung im Browser
  function bezugVon(id) {
    if (!id) return null;
    const D = d();
    const v = D.deals.find((x) => x.id === id); if (v) return { status: v.phase, titel: v.titel, typ: 'vorgang' };
    const q = D.quotes.find((x) => x.id === id); if (q) return { status: q.status, titel: q.nummer + ' ' + q.titel, typ: 'angebot' };
    const r = D.invoices.find((x) => x.id === id); if (r) return { status: r.status, titel: r.nummer, typ: 'rechnung' };
    const t = D.tasks.find((x) => x.id === id); if (t) return { status: t.erledigt ? 'erledigt' : 'offen', titel: t.titel, typ: 'aufgabe' };
    return null;
  }
  function anwenden(e) {
    const c = S.kontakt(e.kontaktId); if (!c) return 'Kontakt fehlt';
    switch (e.aktion) {
      case 'aufgabe': { const b = bezugVon(e.bezugId); S.neueAufgabe({ contactId: c.id, titel: e.titel || 'Aufgabe aus Workflow', faellig: U.inTagen(Number(e.faelligTage) || 0), dealId: b && b.typ === 'vorgang' ? e.bezugId : '', orderId: '', prioritaet: 'Normal' }); break; }
      case 'notiz': S.neueAktivitaet({ contactId: c.id, typ: 'Automation', betreff: 'Workflow: ' + e.workflow, text: e.text || '' }); break;
      case 'tag_setzen': case 'tag_entfernen': { const tags = (c.tags || []).filter((t) => t.toLowerCase() !== String(e.tag || '').toLowerCase()); if (e.aktion === 'tag_setzen' && e.tag) tags.push(e.tag); S.aendereKontakt(c.id, { tags }); break; }
      case 'status': if (e.status) S.aendereKontakt(c.id, { status: e.status }); break;
      case 'vorgang_anlegen': S.neuerVorgang({ contactId: c.id, titel: e.titel || 'Vorgang aus Workflow', phase: e.phase || 'Anfrage', wert: Number(e.wert) || 0 }); break;
      case 'vorgang_phase': {
        let v = e.bezugId && d().deals.find((x) => x.id === e.bezugId);
        if (!v) v = d().deals.filter((x) => x.contactId === c.id && S.K.OFFEN.includes(x.phase)).sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert)))[0];
        if (v && e.phase && v.phase !== e.phase) S.aendereVorgang(v.id, { phase: e.phase });
        break;
      }
      case 'ereignis': speichereTps([{ kontaktId: c.id, art: e.art || 'eigenes', titel: e.titel || '', quelle: 'Workflow', datum: U.nowIso() }]); break;
      case 'webhook': if (/^https:\/\//.test(e.url || '')) fetch(e.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(e.daten || {}) }).catch(() => {}); break;
      default: return 'nicht unterstützt';
    }
    return 'ok';
  }
  function speichereTps(liste) {
    const D = d(), bekannt = new Set(D.touchpoints.map((t) => t.externId).filter(Boolean));
    let n = 0;
    for (const t of liste) {
      if (t.externId && bekannt.has(t.externId)) continue;
      D.touchpoints.push({ id: U.uid(), kontaktId: t.kontaktId, art: t.art, datum: t.datum || U.nowIso(), kampagneId: t.kampagneId || null, titel: t.titel || '', wert: t.wert ?? null, quelle: t.quelle || '', externId: t.externId || null, erfasst: U.nowIso() });
      if (t.externId) bekannt.add(t.externId);
      n++;
    }
    return n;
  }

  let laeuft = false;
  async function lauf() {
    if (laeuft) return { aufgenommen: 0, effekte: 0 };
    laeuft = true;
    try {
      const D = d(), jetzt = Date.now(), st = D.workflowStand;
      const workflows = D.workflows.filter((w) => w.aktiv);
      if (!workflows.length && !D.workflowLaeufe.some((l) => l.status === 'laeuft')) return { aufgenommen: 0, effekte: 0 };
      if (!st.letzterLauf) st.letzterLauf = new Date(jetzt).toISOString();
      const { liste, map } = alle();
      const kontakte = new Map(D.contacts.map((c) => [c.id, kontaktNorm(c)]));
      const tpsNeu = liste.filter((t) => t.erfasst && Date.parse(t.erfasst) > Date.parse(st.letzterLauf) - 5000);
      const cfg = D.journey;
      let neu = J.aufnehmenNachEreignis({ workflows, laeufe: D.workflowLaeufe, tpsNeu, tpsNachKontakt: map, kontakte, cfg, jetzt });
      const heute = U.heute();
      if (st.letzterTag !== heute) {
        const letzterTp = new Map(); map.forEach((l, k) => letzterTp.set(k, l.reduce((m, t) => (String(t.datum) > m ? String(t.datum) : m), '')));
        const objekte = { angebote: D.quotes.map((q) => ({ id: q.id, kontaktId: q.contactId, status: q.status, datum: q.datum, titel: q.nummer + ' ' + q.titel })), rechnungen: D.invoices.map((r) => ({ id: r.id, kontaktId: r.contactId, status: r.status, faellig: r.faellig, titel: r.nummer })) };
        neu = neu.concat(J.aufnehmenNachZeit({ workflows, laeufe: D.workflowLaeufe.concat(neu), kontakte, letzterTp, tpsNachKontakt: map, objekte, cfg, jetzt }));
        st.letzterTag = heute;
      }
      st.letzterLauf = new Date(jetzt).toISOString();
      neu.forEach((l) => { l.id = U.uid(); D.workflowLaeufe.push(l); });
      let effekte = 0, geaendert = neu.length > 0;
      for (const l of D.workflowLaeufe.filter((x) => x.status === 'laeuft' && (!x.weiterAb || Date.parse(x.weiterAb) <= jetzt))) {
        const wf = D.workflows.find((w) => w.id === l.workflowId);
        if (wf && !wf.aktiv) continue;
        const c = S.kontakt(l.kontaktId);
        const r = J.ausfuehren(wf || null, l, { jetzt, kontakt: c ? kontaktNorm(c) : null, tps: alle().map.get(l.kontaktId) || [], bezug: bezugVon(l.bezugId), cfg });
        r.effekte.forEach((e) => { const erg = anwenden(e); if (erg !== 'ok') r.lauf.protokoll.push({ zeit: new Date(jetzt).toISOString(), text: e.aktion + ': ' + erg }); });
        effekte += r.effekte.length;
        if (JSON.stringify(r.lauf) !== JSON.stringify(l)) { Object.assign(l, r.lauf); geaendert = true; }
      }
      // Abgeschlossene Läufe begrenzen, damit die Datendatei klein bleibt
      const fertig = D.workflowLaeufe.filter((x) => x.status !== 'laeuft');
      if (fertig.length > 400) { const weg = new Set(fertig.sort((a, b) => String(a.ende).localeCompare(String(b.ende))).slice(0, fertig.length - 400)); D.workflowLaeufe = D.workflowLaeufe.filter((x) => !weg.has(x)); }
      if (geaendert) S.commit('Workflows: ' + neu.length + ' aufgenommen, ' + effekte + ' Aktionen');
      return { aufgenommen: neu.length, effekte };
    } finally { laeuft = false; }
  }
  let geplant = null, gestartet = false;
  function start() {
    if (gestartet) return; gestartet = true;
    setTimeout(() => lauf().catch((e) => console.error('Workflows', e)), 2500);
    setInterval(() => lauf().catch((e) => console.error('Workflows', e)), 60000);
    S.on(() => { clearTimeout(geplant); geplant = setTimeout(() => lauf().catch((e) => console.error('Workflows', e)), 4000); });
  }

  CRM.auto = {
    art: 'solo',
    kontakte: () => d().contacts.map(kontaktNorm),
    kontaktName: (id) => S.kontaktName(id),
    kontaktLink: (id) => '#/kontakte/' + id,
    touchpoints: () => alle().liste,
    tpsNachKontakt: () => alle().map,
    kampagnen: () => d().campaigns.slice(),
    async kampagneSpeichern(k) {
      const D = d();
      let z = k.id && D.campaigns.find((x) => x.id === k.id);
      if (z) Object.assign(z, k); else { z = Object.assign({ id: U.uid(), aggregat: {}, erstellt: U.nowIso() }, k); D.campaigns.push(z); }
      S.commit('Kampagne gespeichert: ' + z.name);
      return z;
    },
    async kampagneLoeschen(id) { const D = d(); D.campaigns = D.campaigns.filter((x) => x.id !== id); D.touchpoints.forEach((t) => { if (t.kampagneId === id) t.kampagneId = null; }); S.commit('Kampagne gelöscht'); },
    async kampagneZaehlen(id, agg) { const k = d().campaigns.find((x) => x.id === id); if (!k) return; k.aggregat = k.aggregat || {}; Object.keys(agg).forEach((f) => { if (agg[f]) k.aggregat[f] = (Number(k.aggregat[f]) || 0) + agg[f]; }); S.commit('Kampagne gezählt: ' + k.name); },
    async touchpointsAnlegen(liste) { const n = speichereTps(liste); if (n) S.commit(n + ' Ereignisse erfasst'); return n; },
    async werbungAbmelden(cid) { S.aendereKontakt(cid, { einwilligungEmail: false, einwilligungDatum: '' }); },
    workflows: () => d().workflows.slice(),
    async workflowSpeichern(w) {
      const D = d();
      let z = w.id && D.workflows.find((x) => x.id === w.id);
      const daten = { name: w.name, beschreibung: w.beschreibung || '', aktiv: !!w.aktiv, mehrfach: !!w.mehrfach, ausloeser: w.ausloeser, schritte: w.schritte, geaendert: U.nowIso() };
      if (z) Object.assign(z, JSON.parse(JSON.stringify(daten))); else { z = Object.assign({ id: U.uid(), erstellt: U.nowIso() }, JSON.parse(JSON.stringify(daten))); D.workflows.push(z); }
      if (!D.workflowStand.letzterLauf) D.workflowStand.letzterLauf = U.nowIso();
      S.commit('Workflow gespeichert: ' + z.name);
      return JSON.parse(JSON.stringify(z));
    },
    async workflowLoeschen(id) { const D = d(); D.workflows = D.workflows.filter((x) => x.id !== id); D.workflowLaeufe = D.workflowLaeufe.filter((x) => x.workflowId !== id); S.commit('Workflow gelöscht'); },
    laeufe: () => d().workflowLaeufe.slice(),
    async laufAbbrechen(id) { const l = d().workflowLaeufe.find((x) => x.id === id); if (!l) return; l.status = 'abgebrochen'; l.ende = U.nowIso(); l.protokoll.push({ zeit: U.nowIso(), text: 'Von Hand abgebrochen' }); S.commit('Workflow-Lauf abgebrochen'); },
    async aufnehmen(wf, kontaktId) { const l = J.manuellAufnehmen(wf, kontaktId, Date.now()); l.id = U.uid(); d().workflowLaeufe.push(l); S.commit('In Workflow aufgenommen: ' + wf.name); await lauf(); },
    jetztAusfuehren: () => lauf(),
    ausfuehrungsHinweis: () => 'Workflows laufen in diesem Browser, solange das CRM geöffnet ist (jede Minute und nach jeder Änderung). Was in der Zwischenzeit fällig wurde, holt das CRM beim nächsten Öffnen nach. Am besten nur auf einem Gerät gleichzeitig offen haben.',
    journeyKonfig: () => d().journey || {},
    async journeyKonfigSpeichern(cfg) { d().journey = cfg; S.commit('Journey-Stufen eingestellt'); },
    personen: () => [],
    statusWerte: () => S.K.STATUS,
    quellenWerte: () => S.K.QUELLEN,
    phasen: () => S.K.PHASEN,
    trackingBasis: () => '',
    darfBearbeiten: () => true,
    start,
  };
})(window.CRM);
