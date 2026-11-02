// CSV lesen (Trennzeichen ; oder , automatisch, Anführungszeichen nach RFC 4180) und schreiben.
window.CRM = window.CRM || {};
(function (CRM) {
  function trennzeichen(kopfzeile) {
    const semi = (kopfzeile.match(/;/g) || []).length;
    const komma = (kopfzeile.match(/,/g) || []).length;
    const tab = (kopfzeile.match(/\t/g) || []).length;
    if (tab > semi && tab > komma) return '\t';
    return semi >= komma ? ';' : ',';
  }

  function parse(text) {
    text = String(text).replace(/^﻿/, '');
    const ersteZeile = text.split(/\r?\n/)[0] || '';
    const sep = trennzeichen(ersteZeile);
    const zeilen = [];
    let zeile = [], feld = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuote) {
        if (c === '"') {
          if (text[i + 1] === '"') { feld += '"'; i++; } else { inQuote = false; }
        } else feld += c;
      } else if (c === '"') {
        inQuote = true;
      } else if (c === sep) {
        zeile.push(feld); feld = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        zeile.push(feld); feld = '';
        if (zeile.some((f) => f !== '')) zeilen.push(zeile);
        zeile = [];
      } else feld += c;
    }
    zeile.push(feld);
    if (zeile.some((f) => f !== '')) zeilen.push(zeile);
    if (!zeilen.length) return { kopf: [], zeilen: [] };
    const kopf = zeilen[0].map((h) => h.trim());
    const daten = zeilen.slice(1).map((z) => {
      const o = {};
      kopf.forEach((k, i) => { o[k] = (z[i] ?? '').trim(); });
      return o;
    });
    return { kopf, zeilen: daten };
  }

  function feldSchreiben(v) {
    const s = String(v ?? '');
    return /[";\n\r,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // Spalten: [{key, titel, wert?}]; Trennzeichen ; und BOM, damit Excel in Deutschland es direkt öffnet.
  function schreibe(spalten, zeilen) {
    const kopf = spalten.map((s) => feldSchreiben(s.titel)).join(';');
    const body = zeilen.map((z) => spalten.map((s) => feldSchreiben(typeof s.wert === 'function' ? s.wert(z) : z[s.key])).join(';'));
    return '﻿' + [kopf, ...body].join('\r\n') + '\r\n';
  }

  // Spaltennamen aus fremden Exporten auf unser Modell abbilden.
  const ALIAS = {
    firma: ['firma', 'unternehmen', 'company', 'organisation', 'organization', 'name'],
    person: ['person', 'ansprechpartner', 'kontakt', 'contact', 'vorname nachname', 'full name', 'ansprechperson'],
    email: ['email', 'e-mail', 'mail', 'e-mail-adresse', 'emailadresse'],
    telefon: ['telefon', 'tel', 'phone', 'telefonnummer', 'mobil', 'handy'],
    ort: ['ort', 'stadt', 'city', 'standort'],
    branche: ['branche', 'industry', 'sektor'],
    quelle: ['quelle', 'source', 'herkunft', 'lead source'],
    status: ['status', 'typ', 'kategorie'],
    notizen: ['notiz', 'notizen', 'notes', 'bemerkung', 'kommentar'],
    website: ['website', 'web', 'url', 'homepage'],
  };
  function zuordnung(kopf) {
    const map = {};
    const norm = (s) => s.toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
    for (const [ziel, namen] of Object.entries(ALIAS)) {
      const treffer = kopf.find((k) => namen.map(norm).includes(norm(k)));
      if (treffer && !Object.values(map).includes(treffer)) map[ziel] = treffer;
    }
    return map;
  }

  CRM.csv = { parse, schreibe, zuordnung };
})(window.CRM);
