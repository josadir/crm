// Abgleich mit GitHub: localStorage ist immer die Arbeitskopie, GitHub die Ablage.
// Regeln: nach jeder Änderung verzögert hochladen; beim Start herunterladen;
// bei zwei abweichenden Ständen nie stillschweigend überschreiben, sondern fragen.
window.CRM = window.CRM || {};
(function (CRM) {
  const S = CRM.store, G = CRM.github, U = CRM.util;

  let status = { zustand: 'lokal', text: 'Nur lokal, kein GitHub eingerichtet' };
  let konflikt = null; // { remoteData, remoteSha }
  let timer = null;
  let laeuft = false;
  const listeners = new Set();
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  function setStatus(zustand, text) { status = { zustand, text }; listeners.forEach((fn) => fn(status)); }

  const konfiguriert = () => { const s = S.settings; return !!(s.owner && s.repo && s.token && s.path); };

  async function pull(modus) {
    if (!konfiguriert()) { setStatus('lokal', 'Nur lokal, kein GitHub eingerichtet'); return; }
    if (laeuft) return;
    laeuft = true;
    setStatus('laeuft', 'Lade von GitHub …');
    try {
      const remote = await G.getFile(S.settings);
      if (!remote) {
        // Datei gibt es noch nicht: lokalen Stand anlegen.
        laeuft = false;
        await push(true);
        return;
      }
      let remoteData;
      try { remoteData = JSON.parse(remote.content); } catch (e) { setStatus('fehler', 'Datei auf GitHub ist kein gültiges JSON'); return; }

      if (modus === 'remote' || !S.meta.dirty) {
        S.replaceData(remoteData, false);
        S.saveMeta({ sha: remote.sha, dirty: false, lastSync: U.nowIso() });
        setStatus('ok', 'Synchron, Stand ' + U.fmtZeit(S.meta.lastSync));
        return;
      }
      // Lokal gibt es ungesicherte Änderungen.
      if (modus === 'lokal' || S.meta.sha === remote.sha) {
        S.saveMeta({ sha: remote.sha });
        laeuft = false;
        await push();
        return;
      }
      konflikt = { remoteData, remoteSha: remote.sha };
      setStatus('konflikt', 'Konflikt: GitHub hat einen anderen Stand als dieser Browser');
    } catch (e) {
      setStatus('fehler', e.message);
    } finally {
      laeuft = false;
    }
  }

  async function push(anlegen) {
    if (!konfiguriert()) return;
    if (laeuft) { planePush(); return; }
    laeuft = true;
    setStatus('laeuft', 'Speichere auf GitHub …');
    try {
      const inhalt = JSON.stringify(S.data, null, 2) + '\n';
      const nachricht = 'crm: ' + (S.meta.lastLabel || 'Änderung');
      const res = await G.putFile(S.settings, inhalt, anlegen ? null : S.meta.sha, nachricht);
      S.saveMeta({ sha: res.content.sha, dirty: false, lastSync: U.nowIso() });
      setStatus('ok', 'Synchron, Stand ' + U.fmtZeit(S.meta.lastSync));
    } catch (e) {
      if (e.status === 409 || e.status === 422) {
        // Stand auf GitHub hat sich geändert: nachladen und entscheiden lassen.
        try {
          const remote = await G.getFile(S.settings);
          if (remote) {
            konflikt = { remoteData: JSON.parse(remote.content), remoteSha: remote.sha };
            setStatus('konflikt', 'Konflikt: GitHub hat einen anderen Stand als dieser Browser');
          } else setStatus('fehler', e.message);
        } catch (e2) { setStatus('fehler', e2.message); }
      } else {
        setStatus('fehler', e.message);
      }
    } finally {
      laeuft = false;
    }
  }

  function planePush() {
    if (!konfiguriert()) return;
    clearTimeout(timer);
    timer = setTimeout(() => push(), 1500);
  }

  function loeseKonflikt(wahl) {
    if (!konflikt) return;
    const k = konflikt; konflikt = null;
    if (wahl === 'remote') {
      S.replaceData(k.remoteData, false);
      S.saveMeta({ sha: k.remoteSha, dirty: false, lastSync: U.nowIso() });
      setStatus('ok', 'GitHub-Stand übernommen');
    } else {
      S.saveMeta({ sha: k.remoteSha, lastLabel: 'Browser-Stand nach Konflikt übernommen' });
      push();
    }
  }

  S.on(() => { if (S.meta.dirty && !konflikt) planePush(); });
  window.addEventListener('online', () => { if (konfiguriert()) pull(); });
  window.addEventListener('beforeunload', (e) => {
    if (konfiguriert() && (S.meta.dirty || status.zustand === 'laeuft')) { e.preventDefault(); e.returnValue = ''; }
  });

  CRM.sync = { pull, push, planePush, on, konfiguriert, loeseKonflikt, status: () => status, get konflikt() { return konflikt; } };
})(window.CRM);
