// Newsletter: Kampagnen, Kennzahlen, Import der Versandberichte (CSV), Tracking-Links. Gemeinsame Datei für beide CRMs.
window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, J = window.CRMJourney, esc = U.esc;
  const A = () => CRM.auto;
  const sicher = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); U.toast(e.message || String(e), 'fehler'); } };
  const pz = (x) => x == null ? '–' : Math.round(x * 1000) / 10 + ' %';
  const kopf = (t) => `<div class="modal-kopf"><h2>${esc(t)}</h2><button type="button" class="btn-icon" data-action="modal-schliessen" aria-label="Schließen">×</button></div>`;
  const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

  const kennzahlen = () => J.analytics({ kontakte: A().kontakte(), tpsNachKontakt: A().tpsNachKontakt(), kampagnen: A().kampagnen(), cfg: A().journeyKonfig(), filter: {} }).newsletter;

  function liste() {
    const k = kennzahlen();
    return `
      <div class="toolbar"><h1 style="margin:0">Newsletter</h1><span class="abstand"></span><button class="btn btn-primary" data-action="nl-neu">+ Kampagne</button></div>
      <div class="hinweis info klein"><strong>Datenschutz:</strong> Öffnungen und Klicks personenbezogen auszuwerten braucht eine eigene Einwilligung (§ 25 TDDDG, DSGVO). Das CRM speichert sie deshalb nur bei Kontakten mit Häkchen „Erfolgsmessung". Bei allen anderen zählt es nur anonym je Kampagne.</div>
      <div class="panel">${k.length ? `<table class="jy-tabelle"><thead><tr><th>Kampagne</th><th>Datum</th><th class="rechts">Gesendet</th><th class="rechts">Öffnung</th><th class="rechts">Klick</th><th class="rechts nur-desktop">Abmeldungen</th><th class="rechts">Käufe ≤ 7 T.</th><th class="rechts nur-desktop">Umsatz</th></tr></thead><tbody>
        ${k.map((n) => `<tr class="klickbar" data-action="nl-oeffnen" data-id="${esc(n.id)}"><td><strong>${esc(n.name)}</strong></td><td>${esc(U.fmtDatum(n.datum))}</td><td class="rechts">${n.gesendet}</td><td class="rechts">${pz(n.oeffnungsrate)}</td><td class="rechts">${pz(n.klickrate)}</td><td class="rechts nur-desktop">${n.abgemeldet}</td><td class="rechts">${n.kaeufe}</td><td class="rechts nur-desktop">${U.fmtEur(n.umsatz)}</td></tr>`).join('')}</tbody></table>` : '<div class="leer">Noch keine Kampagne. Lege eine an, binde die Tracking-Links ein oder importiere nach dem Versand den Bericht aus deinem Newsletter-Tool.</div>'}</div>
      <p class="muted klein">Käufe ≤ 7 T.: Kontakte, die innerhalb von 7 Tagen nach einem Klick gekauft haben. Kampagnen-Klicks können als Auslöser in Workflows dienen.</p>`;
  }

  function detail(id) {
    const k = A().kampagnen().find((x) => x.id === id);
    if (!k) return '<h1>Kampagne</h1><div class="leer">Nicht gefunden.</div><a class="btn" href="#/newsletter">Zur Liste</a>';
    const n = kennzahlen().find((x) => x.id === id) || {};
    const tps = []; A().tpsNachKontakt().forEach((l) => l.forEach((t) => { if (t.kampagneId === id) tps.push(t); }));
    const personen = (art) => [...new Set(tps.filter((t) => t.art === art).map((t) => t.kontaktId))];
    const block = (titel, ids) => `<div class="panel"><h3>${esc(titel)} <span class="muted">${ids.length}</span></h3>${ids.length ? `<ul class="liste">${ids.slice(0, 50).map((cid) => `<li><a href="${esc(A().kontaktLink(cid))}">${esc(A().kontaktName(cid))}</a></li>`).join('')}</ul>` : '<div class="leer klein">niemand (personenbezogen)</div>'}</div>`;
    const ag = k.aggregat || {};
    return `
      <div class="toolbar"><a class="btn btn-klein" href="#/newsletter">‹ Newsletter</a><h1 style="margin:0">${esc(k.name)}</h1><span class="abstand"></span>
        <button class="btn" data-action="nl-links" data-id="${esc(id)}">Tracking-Links</button>
        <button class="btn" data-action="nl-import" data-id="${esc(id)}">Bericht importieren</button>
        <button class="btn" data-action="nl-bearbeiten" data-id="${esc(id)}">Bearbeiten</button></div>
      <div class="kacheln">
        <div class="kachel"><div class="zahl">${n.gesendet || 0}</div><div class="titel">gesendet</div></div>
        <div class="kachel"><div class="zahl">${pz(n.oeffnungsrate)}</div><div class="titel">Öffnungsrate · ${n.geoeffnet || 0}</div></div>
        <div class="kachel"><div class="zahl">${pz(n.klickrate)}</div><div class="titel">Klickrate · ${n.geklickt || 0} · ${pz(n.klickZuOeffnung)} der Öffner</div></div>
        <div class="kachel"><div class="zahl">${n.kaeufe || 0}</div><div class="titel">Käufe ≤ 7 Tage nach Klick · ${U.fmtEur(n.umsatz)}</div></div>
      </div>
      ${ag.geoeffnet || ag.geklickt || ag.gesendet ? `<p class="muted klein">Darin anonym gezählt (ohne Einwilligung zur Erfolgsmessung oder unbekannte Adresse): ${ag.gesendet || 0} gesendet, ${ag.geoeffnet || 0} geöffnet, ${ag.geklickt || 0} geklickt, ${ag.abgemeldet || 0} abgemeldet.</p>` : ''}
      <p class="klein">${k.betreff ? 'Betreff: <strong>' + esc(k.betreff) + '</strong> · ' : ''}${k.ziel_url ? 'Ziel: ' + esc(k.ziel_url) : ''} ${k.notiz ? '<br>' + esc(k.notiz) : ''}</p>
      <div class="spalten-2" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${block('Geklickt', personen('newsletter_geklickt'))}${block('Geöffnet', personen('newsletter_geoeffnet'))}${block('Abgemeldet', personen('newsletter_abgemeldet'))}</div>`;
  }

  function render(params) { return params[0] ? detail(params[0]) : liste(); }

  function kampagneFormular(k) {
    k = Object.assign({ name: '', datum: U.heute(), kanal: 'Newsletter', betreff: '', ziel_url: '', extern_id: '', notiz: '' }, k || {});
    return `${kopf(k.id ? 'Kampagne bearbeiten' : 'Neue Kampagne')}<form data-submit="nl-speichern">
      <input type="hidden" name="id" value="${esc(k.id || '')}">
      <div class="feld"><label>Name</label><input name="name" value="${esc(k.name)}" required placeholder="z. B. Adventsnewsletter 2026"></div>
      <div class="feld-reihe"><div class="feld"><label>Versanddatum</label><input name="datum" type="date" value="${esc(k.datum || '')}"></div><div class="feld"><label>Kanal / Tool</label><input name="kanal" value="${esc(k.kanal)}" placeholder="Brevo, Mailchimp …"></div></div>
      <div class="feld"><label>Betreff</label><input name="betreff" value="${esc(k.betreff)}"></div>
      <div class="feld"><label>Ziel-Adresse (Shop, Landingpage)</label><input name="ziel_url" type="url" value="${esc(k.ziel_url)}" placeholder="https://"></div>
      <div class="feld"><label>Kampagnen-ID im Newsletter-Tool (optional, für den Webhook)</label><input name="extern_id" value="${esc(k.extern_id)}"></div>
      <div class="feld"><label>Notiz</label><textarea name="notiz" style="min-height:50px">${esc(k.notiz)}</textarea></div>
      <div class="form-aktionen">${k.id ? `<button type="button" class="btn btn-gefahr links" data-action="nl-loeschen" data-id="${esc(k.id)}">Löschen</button>` : ''}<button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div></form>`;
  }

  const AK = CRM.actions;
  AK['nl-neu'] = () => U.modal(kampagneFormular());
  AK['nl-oeffnen'] = (d) => { location.hash = '#/newsletter/' + d.id; };
  AK['nl-bearbeiten'] = (d) => U.modal(kampagneFormular(A().kampagnen().find((x) => x.id === d.id)));
  AK['nl-speichern'] = sicher(async (f) => {
    if (!f.name) { U.toast('Name fehlt', 'fehler'); return; }
    const alt = f.id ? A().kampagnen().find((x) => x.id === f.id) : null;
    const k = await A().kampagneSpeichern(Object.assign({}, alt || {}, { name: f.name, datum: f.datum || null, kanal: f.kanal || '', betreff: f.betreff || '', ziel_url: f.ziel_url || '', extern_id: f.extern_id || '', notiz: f.notiz || '' }, f.id ? { id: f.id } : {}));
    U.closeModal(); U.toast('Kampagne gespeichert', 'ok');
    location.hash = '#/newsletter/' + k.id; CRM.render();
  });
  AK['nl-loeschen'] = sicher(async (d) => { if (!confirm('Kampagne löschen? Erfasste Ereignisse bleiben beim Kontakt, verlieren aber den Kampagnenbezug.')) return; await A().kampagneLoeschen(d.id); U.closeModal(); location.hash = '#/newsletter'; });

  AK['nl-links'] = (d) => {
    const k = A().kampagnen().find((x) => x.id === d.id); if (!k) return;
    const basis = A().trackingBasis();
    U.modal(`${kopf('Tracking-Links: ' + k.name)}
      <div class="feld"><label>Ziel-Adresse</label><input id="nl-ziel" type="url" value="${esc(k.ziel_url || '')}" placeholder="https://"></div>
      ${basis ? `<div class="feld"><label>Newsletter-Tool (für den Platzhalter der E-Mail-Adresse)</label><select id="nl-tool">${U.options([['{{ contact.EMAIL }}', 'Brevo'], ['*|EMAIL|*', 'Mailchimp'], ['{EMAIL}', 'CleverReach'], ['{{email}}', 'anderes (Platzhalter anpassen)']], '{{ contact.EMAIL }}')}</select></div>` : ''}
      <div id="nl-ausgabe"></div>
      <p class="muted klein">${basis ? 'Klick-Link und Pixel zählen nur bei Kontakten mit Einwilligung zur Erfolgsmessung personenbezogen. Weitergeleitet wird nur auf die Domain der Ziel-Adresse.' : 'Dieses CRM hat keinen eigenen Server. Die UTM-Parameter zeigen die Kampagne in der Shop- oder Website-Statistik. Öffnungen und Klicks je Person kommen über „Bericht importieren".'}</p>`, (dlg) => {
      const zeichne = () => {
        const ziel = dlg.querySelector('#nl-ziel').value.trim();
        let utm = '';
        try { const u = new URL(ziel); u.searchParams.set('utm_source', 'newsletter'); u.searchParams.set('utm_medium', 'email'); u.searchParams.set('utm_campaign', slug(k.name)); utm = u.toString(); } catch (_) { utm = ''; }
        const tool = dlg.querySelector('#nl-tool');
        const merge = tool ? tool.value : '';
        const feld = (titel, wert) => `<div class="feld"><label>${esc(titel)}</label><div style="display:flex;gap:6px"><input readonly value="${esc(wert)}" style="font-family:Consolas,monospace;font-size:12px"><button class="btn btn-klein" type="button" data-action="nl-kopieren" data-wert="${esc(wert)}">Kopieren</button></div></div>`;
        let html = utm ? feld('Link mit UTM-Parametern', utm) : '<p class="muted klein">Gültige Ziel-Adresse eintragen.</p>';
        if (basis && utm) {
          html += feld('Klick-Link (statt des normalen Links im Newsletter)', `${basis}?t=c&k=${k.id}&e=${merge}&u=${encodeURIComponent(utm)}`);
          html += feld('Öffnungs-Pixel (als HTML ans Ende des Newsletters)', `<img src="${basis}?t=o&k=${k.id}&e=${merge}" width="1" height="1" alt="" style="display:none">`);
          html += feld('Brevo-Webhook (einmalig unter Brevo → Einstellungen → Webhooks, Ereignisse: Geöffnet, Geklickt, Abgemeldet)', `${basis}?geheim=DEIN_TRACKING_SECRET`);
        }
        dlg.querySelector('#nl-ausgabe').innerHTML = html;
      };
      dlg.querySelector('#nl-ziel').addEventListener('input', zeichne);
      if (dlg.querySelector('#nl-tool')) dlg.querySelector('#nl-tool').addEventListener('change', zeichne);
      zeichne();
    });
  };
  AK['nl-kopieren'] = (d) => { if (navigator.clipboard) navigator.clipboard.writeText(d.wert).then(() => U.toast('Kopiert', 'ok')).catch(() => U.toast('Bitte manuell markieren und kopieren')); };

  // Import eines Versandberichts (CSV aus Brevo, Mailchimp, CleverReach …)
  const ALIAS = {
    email: ['email', 'e-mail', 'e mail', 'e-mail-adresse', 'emailadresse', 'email address', 'e-mail address', 'mail', 'contact email', 'empfänger', 'empfaenger'],
    geoeffnet: ['geöffnet', 'geoeffnet', 'opened', 'opens', 'öffnungen', 'open', 'open count', 'unique opens', 'geöffnet am'],
    geklickt: ['geklickt', 'clicked', 'clicks', 'klicks', 'click', 'click count', 'unique clicks', 'geklickt am'],
    abgemeldet: ['abgemeldet', 'unsubscribed', 'unsubscribe', 'abmeldung', 'unsubscribed at'],
    ereignis: ['event', 'ereignis', 'aktivität', 'aktivitaet', 'activity', 'type', 'action'],
    datum: ['datum', 'date', 'zeit', 'time', 'timestamp', 'date_event', 'event date'],
  };
  const norm = (s) => String(s || '').toLowerCase().replace(/[_]+/g, ' ').trim();
  const spalte = (kopfzeile, n) => kopfzeile.find((k) => ALIAS[n].includes(norm(k)));
  const wahr = (v) => !['', '0', 'no', 'nein', 'false', 'falsch', '-', 'n'].includes(norm(v));
  const EREIGNIS = (v) => { const t = norm(v); if (/unsub|abgemeld|abmeld/.test(t)) return 'newsletter_abgemeldet'; if (/click|klick/.test(t)) return 'newsletter_geklickt'; if (/open|öffn|geöffn|oeffn/.test(t)) return 'newsletter_geoeffnet'; if (/deliver|sent|zugestellt|gesendet|versendet/.test(t)) return 'newsletter_gesendet'; return ''; };

  AK['nl-import'] = sicher(async (d) => {
    const k = A().kampagnen().find((x) => x.id === d.id); if (!k) return;
    const datei = await U.dateiWaehlen('.csv,text/csv');
    if (!datei) return;
    const { kopf: kz, zeilen } = CRM.csv.parse(datei.text);
    const s = { email: spalte(kz, 'email'), geoeffnet: spalte(kz, 'geoeffnet'), geklickt: spalte(kz, 'geklickt'), abgemeldet: spalte(kz, 'abgemeldet'), ereignis: spalte(kz, 'ereignis'), datum: spalte(kz, 'datum') };
    if (!s.email) { U.toast('Keine Spalte mit E-Mail-Adressen gefunden. Spalten: ' + kz.join(', '), 'fehler'); return; }
    const kontakte = new Map(A().kontakte().filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));
    const datumVon = (z) => { const v = s.datum && z[s.datum]; const t = v ? Date.parse(String(v).replace(' ', 'T')) : NaN; return isNaN(t) ? (k.datum ? new Date(k.datum + 'T09:00:00').toISOString() : new Date().toISOString()) : new Date(t).toISOString(); };
    const tps = [], agg = { gesendet: 0, geoeffnet: 0, geklickt: 0, abgemeldet: 0 }, abmelden = new Set();
    let unbekannt = 0;
    const feldVon = { newsletter_gesendet: 'gesendet', newsletter_geoeffnet: 'geoeffnet', newsletter_geklickt: 'geklickt', newsletter_abgemeldet: 'abgemeldet' };
    for (const z of zeilen) {
      const mail = String(z[s.email] || '').trim().toLowerCase();
      if (!mail.includes('@')) continue;
      const c = kontakte.get(mail);
      const arten = [];
      if (s.ereignis) { const a = EREIGNIS(z[s.ereignis]); if (a) arten.push(a); }
      else {
        arten.push('newsletter_gesendet');
        if (s.geoeffnet && wahr(z[s.geoeffnet])) arten.push('newsletter_geoeffnet');
        if (s.geklickt && wahr(z[s.geklickt])) arten.push('newsletter_geklickt');
        if (s.abgemeldet && wahr(z[s.abgemeldet])) arten.push('newsletter_abgemeldet');
      }
      if (!c) unbekannt++;
      for (const a of arten) {
        const persoenlich = c && (c.tracking || a === 'newsletter_gesendet' || a === 'newsletter_abgemeldet');
        if (a === 'newsletter_abgemeldet' && c) abmelden.add(c.id);
        if (persoenlich) tps.push({ kontaktId: c.id, art: a, datum: datumVon(z), kampagneId: k.id, titel: k.name, quelle: 'Newsletter', externId: `nl:${k.id}:${a}:${mail}` });
        else agg[feldVon[a]]++;
      }
    }
    const pers = tps.length;
    if (!confirm(`${zeilen.length} Zeilen gelesen.\n${pers} Ereignisse personenbezogen (Kontakte mit Einwilligung), ${agg.geoeffnet + agg.geklickt} Öffnungen/Klicks anonym, ${unbekannt} Adressen ohne Kontakt im CRM.\n${abmelden.size} Abmeldungen: Werbeeinwilligung wird bei diesen Kontakten entfernt.\n\nImportieren?`)) return;
    const neu = await A().touchpointsAnlegen(tps);
    await A().kampagneZaehlen(k.id, agg);
    for (const cid of abmelden) await A().werbungAbmelden(cid);
    U.toast(`Import fertig: ${neu} neue Ereignisse`, 'ok');
    CRM.render();
  });

  CRM.views.newsletter = { render, titel: 'Newsletter' };
})(window.CRM);
