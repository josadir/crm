// Tests der gemeinsamen Engine (js/journey.js): Journey, Analytics, Workflow-Aufnahme und -Ausführung.
// Aufruf: node tests/journey.test.mjs
import path from 'node:path';
import { pathToFileURL } from 'node:url';
await import(pathToFileURL(path.resolve('js/journey.js')).href);
const J = globalThis.CRMJourney;
let fehler = 0;
const ok = (n, b, i = '') => { console.log((b ? 'OK   ' : 'FAIL ') + n + (i !== '' ? ' · ' + i : '')); if (!b) fehler++; };
const T0 = Date.parse('2026-10-01T10:00:00Z'), tag = 864e5;
const d = (t) => new Date(T0 + t * tag).toISOString();
const tp = (id, kontaktId, art, t, extra) => Object.assign({ id, kontaktId, art, datum: d(t) }, extra || {});

// Journey
const tps1 = [tp('1', 'a', 'erstkontakt', 0, { quelle: 'Instagram' }), tp('2', 'a', 'newsletter_geklickt', 3, { kampagneId: 'n1' }), tp('3', 'a', 'bestellung', 4, { wert: 50 }), tp('4', 'a', 'bestellung', 30, { wert: 70 })];
const j = J.journey(tps1, null, { status: 'Kunde' });
ok('Journey: höchste Stufe Bindung (2 Käufe)', j.stufe === 'bindung', j.stufe);
ok('Journey: Umsatz und Käufe', j.umsatz === 120 && j.kaeufe === 2);
ok('Journey: Interesse am Tag 3', j.stufen[1].datum === d(3));
ok('Phase Angebot → Erwägung', J.journey([tp('p', 'b', 'phase', 1, { titel: 'Angebot' })]).stufe === 'erwaegung');
ok('Eigene Zuordnung greift', J.journey([tp('x', 'b', 'newsletter_gesendet', 1)], { arten: { newsletter_gesendet: 'aufmerksamkeit' } }).stufe === 'aufmerksamkeit');

// Analytics
const kontakte = [{ id: 'a', quelle: 'Instagram', erstellt: d(0) }, { id: 'b', quelle: 'Messe', erstellt: d(0) }, { id: 'c', quelle: 'Instagram', erstellt: d(0) }];
const map = new Map([['a', tps1.concat([tp('10', 'a', 'newsletter_gesendet', 3, { kampagneId: 'n1' })])], ['b', [tp('5', 'b', 'erstkontakt', 0), tp('6', 'b', 'gespraech', 2)]], ['c', [tp('7', 'c', 'erstkontakt', 0), tp('8', 'c', 'newsletter_gesendet', 3, { kampagneId: 'n1' }), tp('9', 'c', 'newsletter_geoeffnet', 3, { kampagneId: 'n1' })]]]);
const an = J.analytics({ kontakte, tpsNachKontakt: map, kampagnen: [{ id: 'n1', name: 'Herbst', aggregat: { geoeffnet: 2 } }], jetzt: T0 + 40 * tag });
ok('Trichter: 3 Aufmerksamkeit, 1 Kauf', an.trichter[0].anzahl === 3 && an.trichter[3].anzahl === 1, an.trichter.map((t) => t.anzahl).join('/'));
ok('Quellen: Instagram 2 Kontakte, 50 % Kaufquote', an.quellen[0].quelle === 'Instagram' && an.quellen[0].quote === 0.5);
ok('Weg bis Kauf erkannt', an.topWege[0] && /Newsletter geklickt → Kauf/.test(an.topWege[0].weg), an.topWege[0] && an.topWege[0].weg);
const nl = an.newsletter[0];
ok('Newsletter: 2 gesendet, 1+2 geöffnet, 1 Klick, 1 Kauf nach Klick', nl.gesendet === 2 && nl.geoeffnet === 3 && nl.geklickt === 1 && nl.kaeufe === 1 && nl.umsatz === 50, JSON.stringify(nl));

// Workflow-Baum und Ausführung
const wf = { id: 'w1', name: 'Test', aktiv: true, ausloeser: { typ: 'touchpoint', art: 'newsletter_geklickt', bedingungen: [{ feld: 'einwilligung', op: 'ist', wert: 'ja' }] },
  schritte: [{ id: 's1', typ: 'aktion', aktion: 'notiz', params: { text: 'Klick von {name}' } }, { id: 's2', typ: 'warten', tage: 1 },
    { id: 's3', typ: 'bedingung', name: 'Gekauft?', bedingungen: [{ feld: 'ereignis_seit_start', op: 'vorhanden', wert: 'bestellung' }], ja: [{ id: 's4', typ: 'aktion', aktion: 'tag_setzen', params: { tag: 'Käufer' } }], nein: [{ id: 's5', typ: 'aktion', aktion: 'aufgabe', params: { titel: 'Nachfassen {vorname}', faelligTage: 0, zuweisen: 'betreuer' } }] },
    { id: 's6', typ: 'aktion', aktion: 'notiz', params: { text: 'Ende' } }] };
ok('Nächster nach Zweig-Ende = Knoten nach der Bedingung', J.naechster(wf, 's5') === 's6' && J.naechster(wf, 's4') === 's6' && J.naechster(wf, 's6') === null);
const kmap = new Map([['a', { id: 'a', name: 'Anna Beispiel', einwilligung: true, tags: [] }], ['c', { id: 'c', name: 'Carl', einwilligung: false }]]);
const klick = tp('k1', 'a', 'newsletter_geklickt', 5), klickC = tp('k2', 'c', 'newsletter_geklickt', 5);
const laeufe = J.aufnehmenNachEreignis({ workflows: [wf], laeufe: [], tpsNeu: [klick, klickC], tpsNachKontakt: new Map([['a', [klick]], ['c', [klickC]]]), kontakte: kmap, jetzt: T0 + 5 * tag });
ok('Aufnahme nur, wenn Bedingung des Auslösers stimmt', laeufe.length === 1 && laeufe[0].kontaktId === 'a');
const doppelt = J.aufnehmenNachEreignis({ workflows: [wf], laeufe, tpsNeu: [tp('k3', 'a', 'newsletter_geklickt', 6)], tpsNachKontakt: new Map(), kontakte: kmap, jetzt: T0 + 6 * tag });
ok('Keine zweite Aufnahme ohne „mehrfach"', doppelt.length === 0);
const mehrfach = J.aufnehmenNachEreignis({ workflows: [Object.assign({}, wf, { mehrfach: true })], laeufe, tpsNeu: [tp('k3', 'a', 'newsletter_geklickt', 6)], tpsNachKontakt: new Map(), kontakte: kmap, jetzt: T0 + 6 * tag });
ok('Mit „mehrfach" erneute Aufnahme je Ereignis', mehrfach.length === 1);
const r = J.ausfuehren(wf, laeufe[0], { jetzt: T0 + 5 * tag, kontakt: kmap.get('a'), tps: [klick] });
ok('Schritt 1 Notiz mit Platzhalter, dann warten', r.effekte.length === 1 && r.effekte[0].text === 'Klick von Anna Beispiel' && r.lauf.wartetAuf === 's2', JSON.stringify(r.effekte));
const r2 = J.ausfuehren(wf, r.lauf, { jetzt: T0 + 5.5 * tag, kontakt: kmap.get('a'), tps: [klick] });
ok('Vor Ablauf der Wartezeit nichts', r2.effekte.length === 0 && r2.lauf.status === 'laeuft');
const r3 = J.ausfuehren(wf, r2.lauf, { jetzt: T0 + 6.1 * tag, kontakt: kmap.get('a'), tps: [klick] });
ok('Nein-Zweig: Aufgabe, dann Ende-Notiz, fertig', r3.effekte.map((e) => e.aktion).join(',') === 'aufgabe,notiz' && r3.effekte[0].titel === 'Nachfassen Anna' && r3.lauf.status === 'fertig', r3.effekte.map((e) => e.aktion).join(','));
const rJa = J.ausfuehren(wf, r2.lauf, { jetzt: T0 + 6.1 * tag, kontakt: kmap.get('a'), tps: [klick, tp('b1', 'a', 'bestellung', 5.8)] });
ok('Ja-Zweig bei Kauf seit Aufnahme', rJa.effekte[0].aktion === 'tag_setzen' && rJa.effekte[0].tag === 'Käufer');
const pausiert = J.ausfuehren(Object.assign({}, wf, { aktiv: false }), r.lauf, { jetzt: T0 + 9 * tag, kontakt: kmap.get('a'), tps: [] });
ok('Pausierter Workflow hält Läufe an', pausiert.effekte.length === 0 && pausiert.lauf.status === 'laeuft');
const weg = J.ausfuehren(null, r.lauf, { jetzt: T0 + 9 * tag, kontakt: kmap.get('a'), tps: [] });
ok('Gelöschter Workflow bricht Lauf ab', weg.lauf.status === 'abgebrochen');

// Journey-Stufe als Auslöser
const wfStufe = { id: 'w2', name: 'Kauf', aktiv: true, ausloeser: { typ: 'journey_stufe', stufe: 'kauf', bedingungen: [] }, schritte: [] };
const kauf = tp('b9', 'a', 'bestellung', 8, { wert: 20 });
const st = J.aufnehmenNachEreignis({ workflows: [wfStufe], laeufe: [], tpsNeu: [kauf], tpsNachKontakt: new Map([['a', [klick, kauf]]]), kontakte: kmap, jetzt: T0 + 8 * tag });
ok('Journey-Stufe Kauf löst aus', st.length === 1);
const b10 = tp('b10', 'a', 'bestellung', 9);
const st2 = J.aufnehmenNachEreignis({ workflows: [wfStufe], laeufe: [], tpsNeu: [b10], tpsNachKontakt: new Map([['a', [klick, kauf, b10]]]), kontakte: kmap, jetzt: T0 + 9 * tag });
ok('Zweiter Kauf löst die Kauf-Stufe nicht erneut aus', st2.length === 0);

// Zeitbasiert
const wfInaktiv = { id: 'w3', name: 'Still', aktiv: true, ausloeser: { typ: 'inaktiv', tage: 30, bedingungen: [] }, schritte: [{ id: 'x', typ: 'aktion', aktion: 'tag_setzen', params: { tag: 'Still' } }] };
const z = J.aufnehmenNachZeit({ workflows: [wfInaktiv], laeufe: [], kontakte: kmap, letzterTp: new Map([['a', d(0)], ['c', d(20)]]), jetzt: T0 + 40 * tag });
ok('Inaktiv seit 30 Tagen: nur a', z.length === 1 && z[0].kontaktId === 'a');
const z2 = J.aufnehmenNachZeit({ workflows: [wfInaktiv], laeufe: z, kontakte: kmap, letzterTp: new Map([['a', d(0)]]), jetzt: T0 + 41 * tag });
ok('Am Folgetag nicht erneut', z2.length === 0);
const wfRe = { id: 'w4', name: 'Rechnung', aktiv: true, ausloeser: { typ: 'rechnung_ueberfaellig', tage: 3, bedingungen: [] }, schritte: [{ id: 'y1', typ: 'warten', tage: 7 }, { id: 'y2', typ: 'bedingung', bedingungen: [{ feld: 'bezug_status', op: 'ist', wert: 'Bezahlt' }], ja: [], nein: [{ id: 'y3', typ: 'aktion', aktion: 'aufgabe', params: { titel: 'Mahnung {objekt}' } }] }] };
const zr = J.aufnehmenNachZeit({ workflows: [wfRe], laeufe: [], kontakte: kmap, letzterTp: new Map(), objekte: { rechnungen: [{ id: 'r1', kontaktId: 'a', status: 'Offen', faellig: d(0), titel: 'RE-1' }] }, jetzt: T0 + 4 * tag });
ok('Überfällige Rechnung nimmt auf', zr.length === 1 && zr[0].bezugId === 'r1');
let rr = J.ausfuehren(wfRe, zr[0], { jetzt: T0 + 4 * tag, kontakt: kmap.get('a'), tps: [], bezug: { status: 'Offen', titel: 'RE-1' } });
rr = J.ausfuehren(wfRe, rr.lauf, { jetzt: T0 + 12 * tag, kontakt: kmap.get('a'), tps: [], bezug: { status: 'Offen', titel: 'RE-1' } });
ok('Nach 7 Tagen unbezahlt → Mahnaufgabe mit Objekt', rr.effekte.length === 1 && rr.effekte[0].titel === 'Mahnung RE-1');
const bezahlt = J.ausfuehren(wfRe, J.ausfuehren(wfRe, zr[0], { jetzt: T0 + 4 * tag, kontakt: kmap.get('a'), tps: [], bezug: { status: 'Offen' } }).lauf, { jetzt: T0 + 12 * tag, kontakt: kmap.get('a'), tps: [], bezug: { status: 'Bezahlt' } });
ok('Bezahlt → keine Mahnung', bezahlt.effekte.length === 0 && bezahlt.lauf.status === 'fertig');

for (const art of ['solo', 'team']) {
  const v = J.vorlagen(art);
  ok(`Vorlagen ${art}: ${v.length} Stück, Auslöser und Aktionen gültig`, v.every((x) => J.fuer(J.AUSLOESER, art).some((a) => a.typ === x.ausloeser.typ)));
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlle Prüfungen bestanden');
process.exit(fehler ? 1 : 0);
