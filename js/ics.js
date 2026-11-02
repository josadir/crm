// Kalender-Export: iCalendar (.ics) und Google-Kalender-Links.
// UIDs sind stabil (aus der Datensatz-ID), damit ein erneuter Import den Termin aktualisiert statt verdoppelt.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util;

  const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const kompakt = (datum) => String(datum).replace(/-/g, '');
  const kompaktZeit = (datum, zeit) => kompakt(datum) + 'T' + String(zeit).replace(':', '') + '00';
  const stempel = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function folgetag(datum) { const d = new Date(datum + 'T12:00:00'); d.setDate(d.getDate() + 1); return U.localDate(d); }

  // Ereignis: { uid, titel, datum, von?, bis?, ort?, beschreibung? }  (von/bis HH:MM, leer = ganztägig)
  function vevent(e) {
    const z = ['BEGIN:VEVENT', 'UID:' + e.uid + '@crm', 'DTSTAMP:' + stempel()];
    if (e.von) {
      z.push('DTSTART;TZID=Europe/Berlin:' + kompaktZeit(e.datum, e.von));
      z.push('DTEND;TZID=Europe/Berlin:' + kompaktZeit(e.datum, e.bis || e.von));
    } else {
      z.push('DTSTART;VALUE=DATE:' + kompakt(e.datum));
      z.push('DTEND;VALUE=DATE:' + kompakt(folgetag(e.datum)));
    }
    z.push('SUMMARY:' + icsText(e.titel));
    if (e.ort) z.push('LOCATION:' + icsText(e.ort));
    if (e.beschreibung) z.push('DESCRIPTION:' + icsText(e.beschreibung));
    z.push('END:VEVENT');
    return z;
  }

  function kalender(ereignisse) {
    const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CRM//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:CRM'];
    for (const e of ereignisse) zeilen.push(...vevent(e));
    zeilen.push('END:VCALENDAR');
    // Zeilen über 75 Zeichen falten (RFC 5545)
    return zeilen.map((l) => { let out = ''; while (l.length > 73) { out += l.slice(0, 73) + '\r\n '; l = l.slice(73); } return out + l; }).join('\r\n') + '\r\n';
  }

  function googleLink(e) {
    const p = new URLSearchParams();
    p.set('action', 'TEMPLATE');
    p.set('text', e.titel);
    p.set('dates', e.von ? kompaktZeit(e.datum, e.von) + '/' + kompaktZeit(e.datum, e.bis || e.von) : kompakt(e.datum) + '/' + kompakt(folgetag(e.datum)));
    if (e.von) p.set('ctz', 'Europe/Berlin');
    if (e.ort) p.set('location', e.ort);
    if (e.beschreibung) p.set('details', e.beschreibung);
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }

  function download(name, ereignisse) { U.download(name, kalender(ereignisse), 'text/calendar;charset=utf-8'); }

  CRM.ics = { kalender, googleLink, download };
})(window.CRM);
