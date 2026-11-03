// Customer Journey, Journey-Analytics und Workflow-Engine (Regeln mit Auslöser, Bedingungen, Warten, Aktionen).
// Reine Logik ohne Speicherzugriff. Identische Datei in beiden CRMs und in den Supabase Edge Functions.
// Läuft als klassisches Skript (Browser) und als ES-Modul (Deno: `import './journey.js'`), Zugriff über globalThis.CRMJourney.
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ Grundbegriffe
  const STUFEN = [
    { key: 'aufmerksamkeit', name: 'Aufmerksamkeit', text: 'Erster Kontakt, kennt uns' },
    { key: 'interesse', name: 'Interesse', text: 'Reagiert: Gespräch, Klick, Anfrage' },
    { key: 'erwaegung', name: 'Erwägung', text: 'Angebot oder Verhandlung' },
    { key: 'kauf', name: 'Kauf', text: 'Erste Bestellung oder Zahlung' },
    { key: 'bindung', name: 'Bindung', text: 'Wiederkauf' },
    { key: 'empfehlung', name: 'Empfehlung', text: 'Bewertung oder Weiterempfehlung' },
  ];
  // Touchpoint-Arten mit Standard-Stufe (über die Journey-Einstellungen änderbar)
  const ARTEN = [
    ['erstkontakt', 'Erstkontakt', 'aufmerksamkeit'],
    ['website', 'Website-Besuch', 'aufmerksamkeit'],
    ['social', 'Social Media', 'aufmerksamkeit'],
    ['newsletter_gesendet', 'Newsletter erhalten', ''],
    ['newsletter_geoeffnet', 'Newsletter geöffnet', 'interesse'],
    ['newsletter_geklickt', 'Newsletter geklickt', 'interesse'],
    ['newsletter_abgemeldet', 'Newsletter abgemeldet', ''],
    ['gespraech', 'Gespräch / Kontakt', 'interesse'],
    ['anfrage', 'Anfrage / Formular', 'interesse'],
    ['termin', 'Termin', 'interesse'],
    ['angebot', 'Angebot erhalten', 'erwaegung'],
    ['phase', 'Vorgang: Phasenwechsel', ''],
    ['bestellung', 'Bestellung', 'kauf'],
    ['zahlung', 'Zahlung', 'kauf'],
    ['aufgabe_erledigt', 'Aufgabe erledigt', ''],
    ['bewertung', 'Bewertung', 'empfehlung'],
    ['empfehlung', 'Weiterempfehlung', 'empfehlung'],
    ['reklamation', 'Reklamation', ''],
    ['eigenes', 'Eigenes Ereignis', ''],
  ];
  const ART_NAME = Object.fromEntries(ARTEN.map((a) => [a[0], a[1]]));
  const PHASE_STUFE = { Angebot: 'erwaegung', Verhandlung: 'erwaegung', Abschluss: 'kauf', Nachbereitung: 'kauf', Gewonnen: 'kauf' };
  const KAUF_ARTEN = ['bestellung', 'zahlung'];

  const standardKonfig = () => ({ arten: Object.fromEntries(ARTEN.map((a) => [a[0], a[2]])), phasen: Object.assign({}, PHASE_STUFE), wiederkaufAb: 2 });
  const konfig = (k) => { const s = standardKonfig(); k = k || {}; return { arten: Object.assign(s.arten, k.arten || {}), phasen: Object.assign(s.phasen, k.phasen || {}), wiederkaufAb: Number(k.wiederkaufAb) || 2 }; };
  const stufenIndex = (key) => STUFEN.findIndex((s) => s.key === key);
  const tag = 864e5;
  const ts = (d) => new Date(d).getTime();
  const nachDatum = (a, b) => ts(a.datum) - ts(b.datum);

  function stufeVon(tp, cfg) {
    if (tp.art === 'phase') return cfg.phasen[tp.titel] || '';
    return cfg.arten[tp.art] || '';
  }

  // Journey eines Kontakts: höchste erreichte Stufe, Datum je Stufe (erstes Erreichen), Käufe, Umsatz
  function journey(tps, cfgRoh, kontakt) {
    const cfg = konfig(cfgRoh);
    const liste = (tps || []).slice().sort(nachDatum);
    const erreicht = {};
    let kaeufe = 0, umsatz = 0;
    for (const tp of liste) {
      let s = stufeVon(tp, cfg);
      if (KAUF_ARTEN.includes(tp.art)) {
        kaeufe++; umsatz += Number(tp.wert) || 0;
        if (kaeufe >= cfg.wiederkaufAb) s = 'bindung';
      }
      if (s && !erreicht[s]) erreicht[s] = tp.datum;
    }
    if (kontakt && kontakt.status === 'Stammkunde' && !erreicht.bindung && erreicht.kauf) erreicht.bindung = erreicht.kauf;
    // Spätere Stufen schließen frühere ein (wer kauft, hatte Interesse)
    let hoechste = -1;
    STUFEN.forEach((s, i) => { if (erreicht[s.key]) hoechste = i; });
    const stufen = STUFEN.map((s, i) => ({ key: s.key, name: s.name, datum: erreicht[s.key] || null, erreicht: i <= hoechste }));
    return { stufe: hoechste >= 0 ? STUFEN[hoechste].key : '', stufeIndex: hoechste, stufen, kaeufe, umsatz: Math.round(umsatz * 100) / 100, touchpoints: liste, erster: liste[0] || null, letzter: liste[liste.length - 1] || null };
  }

  const median = (zahlen) => { const z = zahlen.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!z.length) return null; const m = Math.floor(z.length / 2); return z.length % 2 ? z[m] : (z[m - 1] + z[m]) / 2; };

  // Auswertung über alle Kontakte. filter: { seitTagen, typ, quelle }
  function analytics({ kontakte, tpsNachKontakt, kampagnen, cfg, filter, jetzt }) {
    filter = filter || {}; jetzt = jetzt || Date.now();
    const c = konfig(cfg);
    const grenze = filter.seitTagen ? jetzt - filter.seitTagen * tag : -Infinity;
    const auswahl = [];
    for (const k of kontakte) {
      if (filter.typ && k.typ !== filter.typ) continue;
      const j = journey(tpsNachKontakt.get(k.id) || [], c, k);
      const start = j.erster ? ts(j.erster.datum) : ts(k.erstellt || jetzt);
      if (start < grenze) continue;
      const quelle = k.quelle || (j.erster && j.erster.quelle) || 'ohne Angabe';
      if (filter.quelle && quelle !== filter.quelle) continue;
      auswahl.push({ k, j, quelle });
    }
    const n = auswahl.length;
    const trichter = STUFEN.map((s, i) => {
      const drin = auswahl.filter((x) => x.j.stufeIndex >= i);
      return { key: s.key, name: s.name, anzahl: drin.length, anteil: n ? drin.length / n : 0 };
    });
    trichter.forEach((t, i) => { t.vonVorstufe = i === 0 ? null : (trichter[i - 1].anzahl ? t.anzahl / trichter[i - 1].anzahl : 0); });
    // Dauer zwischen den Stufen (Tage, Median)
    const dauer = STUFEN.slice(1).map((s, i) => {
      const vorher = STUFEN[i].key;
      const werte = auswahl.map((x) => { const a = x.j.stufen.find((y) => y.key === vorher).datum, b = x.j.stufen.find((y) => y.key === s.key).datum; return a && b && ts(b) >= ts(a) ? (ts(b) - ts(a)) / tag : NaN; });
      return { von: STUFEN[i].name, nach: s.name, medianTage: median(werte) };
    });
    // Quellen
    const qMap = new Map();
    for (const x of auswahl) {
      const q = qMap.get(x.quelle) || { quelle: x.quelle, kontakte: 0, kaeufer: 0, umsatz: 0 };
      q.kontakte++; if (x.j.kaeufe) q.kaeufer++; q.umsatz += x.j.umsatz;
      qMap.set(x.quelle, q);
    }
    const quellen = [...qMap.values()].map((q) => Object.assign(q, { quote: q.kontakte ? q.kaeufer / q.kontakte : 0, umsatz: Math.round(q.umsatz * 100) / 100 })).sort((a, b) => b.kontakte - a.kontakte);
    // Wege bis zum ersten Kauf: Abfolge der Touchpoint-Arten (ohne Wiederholungen), Anzahl Touchpoints, Tage
    const wege = new Map(); const tpBisKauf = [], tageBisKauf = [];
    for (const x of auswahl) {
      const kaufIdx = x.j.touchpoints.findIndex((t) => KAUF_ARTEN.includes(t.art) || (t.art === 'phase' && c.phasen[t.titel] === 'kauf'));
      if (kaufIdx < 0) continue;
      const vorher = x.j.touchpoints.slice(0, kaufIdx).filter((t) => t.art !== 'newsletter_gesendet' && t.art !== 'aufgabe_erledigt');
      tpBisKauf.push(vorher.length);
      if (x.j.erster) tageBisKauf.push((ts(x.j.touchpoints[kaufIdx].datum) - ts(x.j.erster.datum)) / tag);
      const folge = [];
      vorher.forEach((t) => { const nme = t.art === 'phase' ? 'Phase ' + t.titel : (ART_NAME[t.art] || t.art); if (folge[folge.length - 1] !== nme) folge.push(nme); });
      const schluessel = (folge.length > 5 ? folge.slice(0, 2).concat(['…'], folge.slice(-2)) : folge).concat(['Kauf']).join(' → ');
      wege.set(schluessel, (wege.get(schluessel) || 0) + 1);
    }
    const topWege = [...wege.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([weg, anzahl]) => ({ weg, anzahl }));
    // Newsletter je Kampagne (personenbezogen erfasste Ereignisse plus anonyme Zählung)
    const alleTps = []; tpsNachKontakt.forEach((l) => l.forEach((t) => alleTps.push(t)));
    const newsletter = (kampagnen || []).map((k) => {
      const eigene = alleTps.filter((t) => t.kampagneId === k.id);
      const personen = (art) => new Set(eigene.filter((t) => t.art === art).map((t) => t.kontaktId)).size;
      const ag = k.aggregat || {};
      const gesendet = Math.max(personen('newsletter_gesendet'), Number(ag.gesendet) || 0);
      const geoeffnet = personen('newsletter_geoeffnet') + (Number(ag.geoeffnet) || 0);
      const geklickt = personen('newsletter_geklickt') + (Number(ag.geklickt) || 0);
      const abgemeldet = personen('newsletter_abgemeldet') + (Number(ag.abgemeldet) || 0);
      // Käufe innerhalb von 7 Tagen nach einem Klick
      const klicks = eigene.filter((t) => t.art === 'newsletter_geklickt');
      const kaeufer = new Set(); let umsatz = 0;
      for (const kl of klicks) {
        const kauf = (tpsNachKontakt.get(kl.kontaktId) || []).find((t) => KAUF_ARTEN.includes(t.art) && ts(t.datum) >= ts(kl.datum) && ts(t.datum) - ts(kl.datum) <= 7 * tag);
        if (kauf && !kaeufer.has(kl.kontaktId)) { kaeufer.add(kl.kontaktId); umsatz += Number(kauf.wert) || 0; }
      }
      return { id: k.id, name: k.name, datum: k.datum, gesendet, geoeffnet, geklickt, abgemeldet, oeffnungsrate: gesendet ? geoeffnet / gesendet : null, klickrate: gesendet ? geklickt / gesendet : null, klickZuOeffnung: geoeffnet ? geklickt / geoeffnet : null, kaeufe: kaeufer.size, umsatz: Math.round(umsatz * 100) / 100 };
    }).sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')));
    const verteilung = STUFEN.map((s, i) => ({ name: s.name, anzahl: auswahl.filter((x) => x.j.stufeIndex === i).length }));
    return { anzahl: n, trichter, dauer, quellen, topWege, medianTouchpointsBisKauf: median(tpBisKauf), medianTageBisKauf: median(tageBisKauf), newsletter, verteilung, ohneStufe: auswahl.filter((x) => x.j.stufeIndex < 0).length };
  }

  // ------------------------------------------------------------------ Workflows
  // Metadaten für den Editor. nur: 'team' | 'solo' schränkt auf ein CRM ein.
  const AUSLOESER = [
    { typ: 'kontakt_neu', name: 'Neuer Kontakt', text: 'Ein Kontakt wird angelegt' },
    { typ: 'touchpoint', name: 'Ereignis', text: 'Ein bestimmtes Ereignis tritt ein (z. B. Newsletter geklickt, Bestellung)', felder: ['art', 'kampagneId'] },
    { typ: 'journey_stufe', name: 'Journey-Stufe erreicht', text: 'Kontakt erreicht zum ersten Mal eine Stufe', felder: ['stufe'] },
    { typ: 'vorgang_phase', name: 'Vorgang wechselt Phase', text: 'Ein Vorgang kommt in eine bestimmte Phase', felder: ['phase'] },
    { typ: 'aufgabe_erledigt', name: 'Aufgabe erledigt', text: 'Eine Aufgabe wird erledigt (optional mit Titel-Stichwort)', felder: ['stichwort'] },
    { typ: 'inaktiv', name: 'Keine Aktivität', text: 'Seit X Tagen kein Ereignis beim Kontakt', felder: ['tage'], zeit: true },
    { typ: 'geburtstag', name: 'Geburtstag', text: 'Am Geburtstag des Kontakts', zeit: true, nur: 'team' },
    { typ: 'angebot_offen', name: 'Angebot ohne Antwort', text: 'Angebot seit X Tagen gesendet, nicht angenommen', felder: ['tage'], zeit: true, nur: 'solo' },
    { typ: 'rechnung_ueberfaellig', name: 'Rechnung überfällig', text: 'Rechnung seit X Tagen überfällig', felder: ['tage'], zeit: true, nur: 'solo' },
    { typ: 'manuell', name: 'Manuell', text: 'Kontakt wird von Hand aufgenommen (Button in der Kontaktakte)' },
  ];
  const BEDINGUNGEN = [
    { feld: 'typ', name: 'Kontakttyp', ops: ['ist'], werte: [['b2c', 'Privat (B2C)'], ['b2b', 'Firma (B2B)']], nur: 'team' },
    { feld: 'status', name: 'Status', ops: ['ist', 'ist nicht'] },
    { feld: 'quelle', name: 'Quelle', ops: ['ist', 'ist nicht'] },
    { feld: 'tag', name: 'Schlagwort', ops: ['enthält', 'enthält nicht'] },
    { feld: 'einwilligung', name: 'Einwilligung E-Mail-Werbung', ops: ['ist'], werte: [['ja', 'ja'], ['nein', 'nein']] },
    { feld: 'stufe', name: 'Journey-Stufe', ops: ['mindestens', 'unter'], werte: STUFEN.map((s) => [s.key, s.name]) },
    { feld: 'ereignis_seit_start', name: 'Ereignis seit Aufnahme', ops: ['vorhanden', 'nicht vorhanden'], werte: ARTEN.map((a) => [a[0], a[1]]) },
    { feld: 'kaeufe', name: 'Anzahl Käufe', ops: ['mindestens', 'unter'] },
    { feld: 'bezug_status', name: 'Status des Auslöse-Objekts (Phase, Rechnung, Angebot)', ops: ['ist', 'ist nicht'] },
  ];
  const AKTIONEN = [
    { aktion: 'aufgabe', name: 'Aufgabe anlegen', felder: ['titel', 'beschreibung', 'faelligTage', 'zuweisen'] },
    { aktion: 'erinnerung', name: 'Erinnerung setzen', felder: ['titel', 'inStunden', 'zuweisen'], nur: 'team' },
    { aktion: 'benachrichtigen', name: 'Team benachrichtigen', felder: ['titel', 'text', 'zuweisen'], nur: 'team' },
    { aktion: 'notiz', name: 'Notiz in die Historie', felder: ['text'] },
    { aktion: 'tag_setzen', name: 'Schlagwort setzen', felder: ['tag'] },
    { aktion: 'tag_entfernen', name: 'Schlagwort entfernen', felder: ['tag'] },
    { aktion: 'status', name: 'Kontaktstatus setzen', felder: ['status'] },
    { aktion: 'vorgang_anlegen', name: 'Vorgang anlegen', felder: ['titel', 'phase', 'wert'] },
    { aktion: 'vorgang_phase', name: 'Phase des auslösenden Vorgangs setzen', felder: ['phase'] },
    { aktion: 'ereignis', name: 'Ereignis eintragen', felder: ['art', 'titel'] },
    { aktion: 'webhook', name: 'Webhook aufrufen (z. B. n8n)', felder: ['url'] },
  ];
  const fuer = (liste, art) => liste.filter((x) => !x.nur || x.nur === art);

  const neueId = () => 'k' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  // Knoten im Baum finden: { knoten, liste, index, eltern }
  function finde(schritte, id, eltern) {
    for (let i = 0; i < (schritte || []).length; i++) {
      const k = schritte[i];
      if (k.id === id) return { knoten: k, liste: schritte, index: i, eltern: eltern || null };
      if (k.typ === 'bedingung') {
        const r = finde(k.ja, id, k) || finde(k.nein, id, k);
        if (r) return r;
      }
    }
    return null;
  }
  function naechster(wf, id) {
    const f = finde(wf.schritte, id);
    if (!f) return null;
    if (f.index + 1 < f.liste.length) return f.liste[f.index + 1].id;
    return f.eltern ? naechster(wf, f.eltern.id) : null;
  }
  const ersterKnoten = (wf) => (wf.schritte && wf.schritte[0]) ? wf.schritte[0].id : null;

  function zaehleKnoten(schritte) { let n = 0; (schritte || []).forEach((k) => { n++; if (k.typ === 'bedingung') n += zaehleKnoten(k.ja) + zaehleKnoten(k.nein); }); return n; }

  // Bedingung prüfen. ctx: { kontakt, tps (des Kontakts), lauf, bezug, cfg }
  function pruefe(b, ctx) {
    const k = ctx.kontakt || {};
    const w = String(b.wert ?? '');
    const neg = (b.op || '').includes('nicht') || b.op === 'unter';
    let r;
    switch (b.feld) {
      case 'typ': r = k.typ === w; break;
      case 'status': r = k.status === w; break;
      case 'quelle': r = (k.quelle || '') === w; break;
      case 'tag': r = (k.tags || []).map((t) => t.toLowerCase()).includes(w.toLowerCase()); break;
      case 'einwilligung': r = !!k.einwilligung === (w === 'ja'); return r;
      case 'stufe': { const j = journey(ctx.tps, ctx.cfg, k); r = j.stufeIndex >= stufenIndex(w); break; }
      case 'kaeufe': { const j = journey(ctx.tps, ctx.cfg, k); r = j.kaeufe >= (Number(w) || 0); break; }
      case 'ereignis_seit_start': { const ab = ts(ctx.lauf ? ctx.lauf.start : 0); r = (ctx.tps || []).some((t) => t.art === w && ts(t.datum) >= ab); break; }
      case 'bezug_status': r = !!ctx.bezug && String(ctx.bezug.status) === w; break;
      default: r = false;
    }
    return neg ? !r : r;
  }
  const alle = (bedingungen, ctx) => (bedingungen || []).every((b) => pruefe(b, ctx));

  // Platzhalter in Texten: {name} {vorname} {firma} {email} {kampagne} {datum} {objekt}
  function platzhalter(text, ctx) {
    const k = (ctx && ctx.kontakt) || {};
    const werte = { name: k.name || '', vorname: k.vorname || (k.name || '').split(' ')[0] || '', firma: k.firma || '', email: k.email || '', kampagne: (ctx && ctx.kampagne) || '', datum: new Date((ctx && ctx.jetzt) || Date.now()).toLocaleDateString('de-DE'), objekt: (ctx && ctx.bezug && ctx.bezug.titel) || '' };
    return String(text || '').replace(/\{(\w+)\}/g, (m, n) => (n in werte ? werte[n] : m));
  }

  // Passt ein Touchpoint zum Auslöser eines Workflows?
  function passtAusloeser(a, tp) {
    switch (a.typ) {
      case 'kontakt_neu': return tp.art === 'erstkontakt';
      case 'touchpoint': return tp.art === a.art && (!a.kampagneId || tp.kampagneId === a.kampagneId);
      case 'vorgang_phase': return tp.art === 'phase' && tp.titel === a.phase;
      case 'aufgabe_erledigt': return tp.art === 'aufgabe_erledigt' && (!a.stichwort || String(tp.titel || '').toLowerCase().includes(String(a.stichwort).toLowerCase()));
      default: return false;
    }
  }

  function darfAufnehmen(wf, laeufe, kontaktId, schluessel) {
    return !laeufe.some((l) => l.workflowId === wf.id && (wf.mehrfach ? l.schluessel === schluessel : (l.kontaktId === kontaktId && !String(l.schluessel || '').startsWith('manuell:'))));
  }
  function neuerLauf(wf, kontaktId, schluessel, jetzt, bezugId, grund) {
    return { id: null, workflowId: wf.id, kontaktId, bezugId: bezugId || null, schluessel, status: 'laeuft', knoten: ersterKnoten(wf), wartetAuf: null, weiterAb: null, start: new Date(jetzt).toISOString(), ende: null, protokoll: [{ zeit: new Date(jetzt).toISOString(), text: 'Aufgenommen: ' + grund }] };
  }

  // Ereignisbasierte Aufnahme. tpsNeu: neue Touchpoints seit dem letzten Lauf.
  function aufnehmenNachEreignis({ workflows, laeufe, tpsNeu, tpsNachKontakt, kontakte, cfg, jetzt }) {
    const neu = [];
    const bekannt = laeufe.slice();
    const aktiv = workflows.filter((w) => w.aktiv && w.ausloeser && !(AUSLOESER.find((a) => a.typ === w.ausloeser.typ) || {}).zeit);
    for (const tp of (tpsNeu || []).slice().sort(nachDatum)) {
      const kontakt = kontakte.get(tp.kontaktId);
      if (!kontakt) continue;
      for (const wf of aktiv) {
        const a = wf.ausloeser;
        let schluessel = null, grund = '';
        if (a.typ === 'journey_stufe') {
          const alleTps = tpsNachKontakt.get(tp.kontaktId) || [];
          const vorher = journey(alleTps.filter((t) => t.id !== tp.id && ts(t.datum) <= ts(tp.datum)), cfg, null);
          const nachher = journey(alleTps.filter((t) => ts(t.datum) <= ts(tp.datum)), cfg, null);
          const ziel = stufenIndex(a.stufe);
          if (vorher.stufeIndex < ziel && nachher.stufeIndex >= ziel) { schluessel = 'stufe:' + tp.kontaktId; grund = 'Stufe ' + (STUFEN[ziel] || {}).name + ' erreicht'; }
        } else if (passtAusloeser(a, tp)) { schluessel = 'tp:' + tp.id; grund = (ART_NAME[tp.art] || tp.art) + (tp.titel ? ': ' + tp.titel : ''); }
        if (!schluessel) continue;
        // Ohne „mehrfach" nimmt jeder Kontakt nur einmal teil; der Schlüssel macht das auch in der Datenbank eindeutig.
        if (!wf.mehrfach) schluessel = 'k:' + tp.kontaktId;
        const ctx = { kontakt, tps: tpsNachKontakt.get(tp.kontaktId) || [], cfg, bezug: null, lauf: null };
        if (!alle(a.bedingungen, ctx)) continue;
        if (!darfAufnehmen(wf, bekannt, tp.kontaktId, schluessel)) continue;
        const l = neuerLauf(wf, tp.kontaktId, schluessel, jetzt, tp.bezugId, grund);
        neu.push(l); bekannt.push(l);
      }
    }
    return neu;
  }

  // Zeitbasierte Aufnahme (einmal täglich reicht). letzterTp: Map kontaktId → Datum des letzten Touchpoints
  function aufnehmenNachZeit({ workflows, laeufe, kontakte, letzterTp, tpsNachKontakt, objekte, cfg, jetzt }) {
    const neu = [];
    const bekannt = laeufe.slice();
    const heute = new Date(jetzt);
    for (const wf of workflows.filter((w) => w.aktiv && w.ausloeser)) {
      const a = wf.ausloeser, tage = Number(a.tage) || 0;
      const kandidaten = [];
      if (a.typ === 'inaktiv') {
        kontakte.forEach((k) => { const l = letzterTp.get(k.id) || k.erstellt; if (l && jetzt - ts(l) >= tage * tag) kandidaten.push({ kontaktId: k.id, schluessel: 'inaktiv:' + k.id + ':' + String(l).slice(0, 10), grund: 'seit ' + tage + ' Tagen keine Aktivität' }); });
      } else if (a.typ === 'geburtstag') {
        const md = String(heute.getMonth() + 1).padStart(2, '0') + '-' + String(heute.getDate()).padStart(2, '0');
        kontakte.forEach((k) => { if (k.geburtstag && String(k.geburtstag).slice(5, 10) === md) kandidaten.push({ kontaktId: k.id, schluessel: 'geburtstag:' + k.id + ':' + heute.getFullYear(), grund: 'Geburtstag' }); });
      } else if (a.typ === 'angebot_offen') {
        ((objekte && objekte.angebote) || []).forEach((o) => { if (o.status === 'Gesendet' && o.datum && jetzt - ts(o.datum) >= tage * tag) kandidaten.push({ kontaktId: o.kontaktId, bezugId: o.id, schluessel: 'angebot:' + o.id, grund: 'Angebot ' + (o.titel || '') + ' seit ' + tage + ' Tagen offen' }); });
      } else if (a.typ === 'rechnung_ueberfaellig') {
        ((objekte && objekte.rechnungen) || []).forEach((o) => { if (o.status === 'Offen' && o.faellig && jetzt - ts(o.faellig) >= tage * tag) kandidaten.push({ kontaktId: o.kontaktId, bezugId: o.id, schluessel: 'rechnung:' + o.id, grund: 'Rechnung ' + (o.titel || '') + ' ' + tage + ' Tage überfällig' }); });
      } else continue;
      for (const c of kandidaten) {
        const kontakt = kontakte.get(c.kontaktId);
        if (!kontakt) continue;
        const ctx = { kontakt, tps: (tpsNachKontakt && tpsNachKontakt.get(c.kontaktId)) || [], cfg, bezug: null, lauf: null };
        if (!alle(a.bedingungen, ctx)) continue;
        if (!darfAufnehmen(Object.assign({}, wf, { mehrfach: true }), bekannt, c.kontaktId, c.schluessel)) continue;
        const l = neuerLauf(wf, c.kontaktId, c.schluessel, jetzt, c.bezugId, c.grund);
        neu.push(l); bekannt.push(l);
      }
    }
    return neu;
  }

  function manuellAufnehmen(wf, kontaktId, jetzt) { return neuerLauf(wf, kontaktId, 'manuell:' + kontaktId + ':' + jetzt, jetzt, null, 'von Hand'); }

  // Einen Lauf so weit wie möglich ausführen. Liefert { lauf, effekte }.
  // ctx: { jetzt, kontakt, tps, bezug, cfg, kampagne }
  function ausfuehren(wfRoh, laufRoh, ctx) {
    const wf = wfRoh, lauf = JSON.parse(JSON.stringify(laufRoh));
    const effekte = [];
    const log = (text) => lauf.protokoll.push({ zeit: new Date(ctx.jetzt).toISOString(), text });
    if (!wf || !wf.aktiv) { if (wf && !wf.aktiv) return { lauf, effekte }; lauf.status = 'abgebrochen'; log('Workflow gelöscht'); return { lauf, effekte }; }
    if (!ctx.kontakt) { lauf.status = 'abgebrochen'; lauf.ende = new Date(ctx.jetzt).toISOString(); log('Kontakt nicht mehr vorhanden'); return { lauf, effekte }; }
    const c = Object.assign({}, ctx, { lauf });
    for (let schutz = 0; schutz < 60; schutz++) {
      if (!lauf.knoten) { lauf.status = 'fertig'; lauf.ende = new Date(ctx.jetzt).toISOString(); log('Fertig'); break; }
      const f = finde(wf.schritte, lauf.knoten);
      if (!f) { lauf.status = 'abgebrochen'; lauf.ende = new Date(ctx.jetzt).toISOString(); log('Schritt wurde entfernt'); break; }
      const k = f.knoten;
      if (k.typ === 'warten') {
        const dauer = ((Number(k.tage) || 0) * 24 + (Number(k.stunden) || 0)) * 36e5;
        if (lauf.wartetAuf !== k.id) {
          lauf.wartetAuf = k.id; lauf.weiterAb = new Date(ctx.jetzt + dauer).toISOString();
          log('Wartet bis ' + new Date(lauf.weiterAb).toLocaleString('de-DE'));
          if (dauer > 0) break;
        }
        if (ts(lauf.weiterAb) > ctx.jetzt) break;
        lauf.wartetAuf = null; lauf.weiterAb = null;
        lauf.knoten = naechster(wf, k.id);
        continue;
      }
      if (k.typ === 'bedingung') {
        const ja = alle(k.bedingungen, c);
        log('Bedingung „' + (k.name || 'Wenn') + '": ' + (ja ? 'ja' : 'nein'));
        const zweig = ja ? k.ja : k.nein;
        lauf.knoten = zweig && zweig.length ? zweig[0].id : naechster(wf, k.id);
        continue;
      }
      if (k.typ === 'ende') { lauf.knoten = null; continue; }
      if (k.typ === 'aktion') {
        const p = k.params || {};
        const e = { aktion: k.aktion, kontaktId: lauf.kontaktId, bezugId: lauf.bezugId, workflow: wf.name, knotenId: k.id, laufSchluessel: lauf.schluessel };
        ['titel', 'beschreibung', 'text', 'tag', 'status', 'phase', 'art', 'url'].forEach((n) => { if (p[n] != null) e[n] = n === 'url' ? p[n] : platzhalter(p[n], c); });
        ['faelligTage', 'inStunden', 'wert'].forEach((n) => { if (p[n] != null && p[n] !== '') e[n] = Number(p[n]); });
        if (p.zuweisen) e.zuweisen = p.zuweisen;
        if (k.aktion === 'webhook') e.daten = { workflow: wf.name, kontakt: ctx.kontakt, zeit: new Date(ctx.jetzt).toISOString(), ausloeser: lauf.protokoll[0] && lauf.protokoll[0].text };
        effekte.push(e);
        log((AKTIONEN.find((a) => a.aktion === k.aktion) || { name: k.aktion }).name + (e.titel ? ': ' + e.titel : e.tag ? ': ' + e.tag : e.status ? ': ' + e.status : e.phase ? ': ' + e.phase : ''));
        lauf.knoten = naechster(wf, k.id);
        continue;
      }
      lauf.knoten = naechster(wf, k.id);
    }
    if (lauf.protokoll.length > 60) lauf.protokoll = lauf.protokoll.slice(-60);
    return { lauf, effekte };
  }

  // Vorlagen zum Starten
  function vorlagen(art) {
    const a = (aktion, params) => ({ id: neueId(), typ: 'aktion', aktion, params });
    const w = (tage, stunden) => ({ id: neueId(), typ: 'warten', tage: tage || 0, stunden: stunden || 0 });
    const wenn = (name, bedingungen, ja, nein) => ({ id: neueId(), typ: 'bedingung', name, bedingungen, ja: ja || [], nein: nein || [] });
    const liste = [
      { name: 'Newsletter-Klick nachfassen', beschreibung: 'Wer im Newsletter klickt, bekommt am nächsten Tag einen persönlichen Kontakt, wenn noch nicht gekauft wurde.', ausloeser: { typ: 'touchpoint', art: 'newsletter_geklickt', bedingungen: [] }, schritte: [w(1), wenn('Noch kein Kauf?', [{ feld: 'kaeufe', op: 'unter', wert: '1' }], [a('aufgabe', { titel: 'Nachfassen: {name} hat im Newsletter geklickt', faelligTage: 0, zuweisen: 'betreuer' })], [a('tag_setzen', { tag: 'Newsletter-Käufer' })])] },
      { name: 'Willkommen für neue Interessenten', beschreibung: 'Neuer Interessent: sofort eine Aufgabe, nach 3 Tagen prüfen, ob schon ein Gespräch stattfand.', ausloeser: { typ: 'kontakt_neu', bedingungen: [{ feld: 'status', op: 'ist', wert: 'Interessent' }] }, schritte: [a('aufgabe', { titel: 'Erstkontakt mit {name} aufnehmen', faelligTage: 1, zuweisen: 'betreuer' }), w(3), wenn('Gespräch stattgefunden?', [{ feld: 'ereignis_seit_start', op: 'vorhanden', wert: 'gespraech' }], [], [a('aufgabe', { titel: 'Noch kein Gespräch mit {name}: erneut melden', faelligTage: 0, zuweisen: 'betreuer' })])] },
      { name: 'Bewertung nach dem Kauf', beschreibung: '14 Tage nach dem ersten Kauf um eine Bewertung bitten.', ausloeser: { typ: 'journey_stufe', stufe: 'kauf', bedingungen: [] }, schritte: [w(14), a('aufgabe', { titel: 'Bewertung bei {name} anfragen', faelligTage: 0, zuweisen: 'betreuer' }), a('vorgang_phase', { phase: 'Nachbereitung' })] },
      { name: 'Reaktivierung nach 90 Tagen', beschreibung: 'Kunden ohne Aktivität seit 90 Tagen bekommen ein Schlagwort und eine Aufgabe.', ausloeser: { typ: 'inaktiv', tage: 90, bedingungen: [{ feld: 'stufe', op: 'mindestens', wert: 'kauf' }] }, schritte: [a('tag_setzen', { tag: 'Reaktivieren' }), a('aufgabe', { titel: '{name} reaktivieren (90 Tage still)', faelligTage: 3, zuweisen: 'betreuer' })] },
      { name: 'Abschluss: Nachbereitung starten', beschreibung: 'Kommt ein Vorgang in „Abschluss", wird nach 7 Tagen automatisch die Nachbereitung angestoßen.', ausloeser: { typ: 'vorgang_phase', phase: 'Abschluss', bedingungen: [] }, schritte: [a('notiz', { text: 'Workflow: Nachbereitung in 7 Tagen geplant' }), w(7), a('vorgang_phase', { phase: 'Nachbereitung' }), a('aufgabe', { titel: 'Feedback von {name} zu „{objekt}" einholen', faelligTage: 2, zuweisen: 'betreuer' })] },
    ];
    if (art === 'solo') {
      liste.push({ name: 'Angebot nachfassen', beschreibung: 'Angebot seit 7 Tagen ohne Antwort: Aufgabe zum Nachfassen.', ausloeser: { typ: 'angebot_offen', tage: 7, bedingungen: [] }, schritte: [a('aufgabe', { titel: 'Angebot „{objekt}" bei {name} nachfassen', faelligTage: 0 })] });
      liste.push({ name: 'Überfällige Rechnung', beschreibung: '3 Tage nach Fälligkeit Erinnerung, nach weiteren 7 Tagen prüfen, ob bezahlt.', ausloeser: { typ: 'rechnung_ueberfaellig', tage: 3, bedingungen: [] }, schritte: [a('aufgabe', { titel: 'Zahlungserinnerung an {name} ({objekt})', faelligTage: 0 }), w(7), wenn('Bezahlt?', [{ feld: 'bezug_status', op: 'ist', wert: 'Bezahlt' }], [], [a('aufgabe', { titel: '1. Mahnung an {name} ({objekt})', faelligTage: 0 })])] });
    } else {
      liste.push({ name: 'Geburtstagsgruß', beschreibung: 'Am Geburtstag eines B2C-Kunden mit Werbeeinwilligung eine Aufgabe für einen Gruß.', ausloeser: { typ: 'geburtstag', bedingungen: [{ feld: 'typ', op: 'ist', wert: 'b2c' }, { feld: 'einwilligung', op: 'ist', wert: 'ja' }] }, schritte: [a('aufgabe', { titel: 'Geburtstagsgruß an {vorname}', faelligTage: 0, zuweisen: 'betreuer' })] });
      liste.push({ name: 'Reklamation eskalieren', beschreibung: 'Bei einer Reklamation sofort das Team informieren und nach 2 Tagen prüfen.', ausloeser: { typ: 'touchpoint', art: 'reklamation', bedingungen: [] }, schritte: [a('benachrichtigen', { titel: 'Reklamation von {name}', text: 'Bitte heute klären.', zuweisen: 'admins' }), a('aufgabe', { titel: 'Reklamation {name} lösen', faelligTage: 0, zuweisen: 'betreuer' }), w(2), a('erinnerung', { titel: 'Ist die Reklamation von {name} erledigt?', inStunden: 0, zuweisen: 'betreuer' })] });
    }
    return liste.map((v) => Object.assign({ aktiv: false, mehrfach: false }, v));
  }

  const api = { STUFEN, ARTEN, ART_NAME, KAUF_ARTEN, standardKonfig, konfig, journey, analytics, stufenIndex, AUSLOESER, BEDINGUNGEN, AKTIONEN, fuer, neueId, finde, naechster, ersterKnoten, zaehleKnoten, pruefe, platzhalter, aufnehmenNachEreignis, aufnehmenNachZeit, manuellAufnehmen, ausfuehren, vorlagen };
  root.CRMJourney = api;
})(typeof window !== 'undefined' ? window : globalThis);
