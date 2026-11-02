window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, esc = U.esc;
  const zustand = { abgeschlossene: false };

  function karte(d) {
    const nb = d.nachbereitung || {};
    const erledigt = K.NACHBEREITUNG.filter(([k]) => nb[k]).length;
    const angebot = S.data.quotes.find((q) => q.dealId === d.id && q.status !== 'Abgelehnt' && q.status !== 'Abgelaufen');
    const auftrag = S.data.orders.find((o) => o.dealId === d.id);
    return `<div class="karte" draggable="true" data-action="vorgang-bearbeiten" data-id="${esc(d.id)}" data-drag-id="${esc(d.id)}">
      <div class="titel">${esc(d.titel)}</div>
      <div class="firma">${esc(S.kontaktName(d.contactId))}</div>
      <div class="fuss"><span class="${U.faelligKlasse(d.faellig)}">${d.naechsterSchritt ? esc(d.naechsterSchritt) + ' ' : ''}${d.faellig ? U.fmtDatum(d.faellig) : ''}</span><strong>${d.wert ? U.fmtEur(d.wert) : ''}</strong></div>
      ${angebot || auftrag ? `<div class="muted klein">${angebot ? esc(angebot.nummer) + ' ' + esc(angebot.status) : ''}${angebot && auftrag ? ' · ' : ''}${auftrag ? esc(auftrag.nummer) + ' ' + esc(auftrag.status) : ''}</div>` : ''}
      ${['Nachbereitung', 'Gewonnen'].includes(d.phase) ? `<div class="muted klein">Nachbereitung ${erledigt}/${K.NACHBEREITUNG.length}</div>` : ''}
      ${d.phase === 'Verloren' && d.verlustgrund ? `<div class="muted klein">Grund: ${esc(d.verlustgrund)}</div>` : ''}
    </div>`;
  }

  function spalte(phase) {
    const abgeschlossen = !K.OFFEN.includes(phase);
    let liste = S.data.deals.filter((d) => d.phase === phase);
    liste = abgeschlossen ? U.sortiere(liste, 'geschlossen', true) : U.sortiere(liste, 'faellig').sort((a, b) => (a.faellig ? 0 : 1) - (b.faellig ? 0 : 1));
    const summe = liste.reduce((s, x) => s + (Number(x.wert) || 0), 0);
    const hilfe = { Anfrage: 'Kontakt hat Interesse gezeigt', Erstgespräch: 'Bedarf geklärt', Angebot: 'Angebot gesendet', Verhandlung: 'Rückfragen, Preis, Umfang', Abschluss: 'Kaufabschluss: Auftrag erteilt, Leistung läuft', Nachbereitung: 'Leistung erbracht: Feedback, Referenz, Folgebedarf', Gewonnen: 'abgeschlossen und nachbereitet', Verloren: 'ohne Abschluss beendet' }[phase] || '';
    return `<div class="spalte ${abgeschlossen ? 'abgeschlossen' : ''} ${phase === 'Abschluss' || phase === 'Nachbereitung' ? 'nachvertrag' : ''}" data-phase="${esc(phase)}">
      <div class="spalte-kopf"><span>${esc(phase)} <span class="muted">${liste.length}</span></span><span class="summe">${U.fmtEur(summe)}</span></div>
      <div class="muted klein" style="margin:0 4px 8px">${esc(hilfe)}</div>
      ${liste.map(karte).join('') || '<div class="leer klein">leer</div>'}
    </div>`;
  }

  function render() {
    const phasen = zustand.abgeschlossene ? K.PHASEN : K.OFFEN;
    const offen = S.offeneVorgaenge();
    const vorVertrag = offen.filter((d) => K.VORVERTRAG.includes(d.phase));
    const summe = vorVertrag.reduce((s, x) => s + (Number(x.wert) || 0), 0);
    return `
      <h1>Pipeline <span class="muted klein">${vorVertrag.length} vor Abschluss · ${U.fmtEur(summe)} · ${offen.length - vorVertrag.length} in Abschluss/Nachbereitung</span></h1>
      <div class="toolbar">
        <span class="muted klein">Karten per Drag &amp; Drop verschieben, Klick öffnet den Vorgang. Ein angenommenes Angebot schiebt den Vorgang automatisch auf „Abschluss".</span>
        <span class="abstand"></span>
        <label class="feld-check" style="margin:0"><input type="checkbox" id="pipeline-abgeschlossene" ${zustand.abgeschlossene ? 'checked' : ''}> Gewonnen/Verloren zeigen</label>
        <button class="btn btn-primary" data-action="vorgang-neu">+ Vorgang</button>
      </div>
      <div class="board">${phasen.map(spalte).join('')}</div>`;
  }

  function mount(view) {
    view.querySelector('#pipeline-abgeschlossene').addEventListener('change', (e) => { zustand.abgeschlossene = e.target.checked; CRM.render(); });
    let dragId = null;
    view.querySelectorAll('[data-drag-id]').forEach((el) => {
      el.addEventListener('dragstart', (e) => { dragId = el.dataset.dragId; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
      el.addEventListener('dragend', () => { dragId = null; view.querySelectorAll('.spalte.drop').forEach((s) => s.classList.remove('drop')); });
    });
    view.querySelectorAll('.spalte').forEach((sp) => {
      sp.addEventListener('dragover', (e) => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; sp.classList.add('drop'); } });
      sp.addEventListener('dragleave', () => sp.classList.remove('drop'));
      sp.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = dragId || e.dataTransfer.getData('text/plain');
        sp.classList.remove('drop');
        if (id) CRM.actions['vorgang-phase']({ id, phase: sp.dataset.phase });
      });
    });
  }

  CRM.views.pipeline = { render, mount };
})(window.CRM);
