// GitHub Contents API: eine JSON-Datei in einem Repo lesen und schreiben.
// Jede Speicherung ist ein Commit im Daten-Repo, die Historie liefert GitHub gratis.
window.CRM = window.CRM || {};
(function (CRM) {
  const API = 'https://api.github.com';

  function b64enc(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function b64dec(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function anfrage(s, method, pfad, body) {
    let res;
    try {
      res = await fetch(API + pfad, {
        method,
        cache: 'no-store',
        headers: {
          'Authorization': 'Bearer ' + s.token,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const err = new Error('Keine Verbindung zu GitHub (offline oder blockiert)');
      err.status = 0;
      throw err;
    }
    if (res.status === 404 && method === 'GET') return null;
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(`GitHub ${res.status}: ${(json && json.message) || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  const repoPfad = (s) => `/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}`;
  const dateiPfad = (s) => repoPfad(s) + '/contents/' + String(s.path).split('/').filter(Boolean).map(encodeURIComponent).join('/');

  // Liefert {sha, content} oder null, wenn die Datei fehlt.
  async function getFile(s) {
    const j = await anfrage(s, 'GET', dateiPfad(s) + '?ref=' + encodeURIComponent(s.branch || 'main'));
    if (!j) return null;
    if (j.encoding !== 'base64' || typeof j.content !== 'string') {
      throw new Error('Datei zu groß für die Contents-API (über 1 MB). Bitte Daten aufteilen.');
    }
    return { sha: j.sha, content: b64dec(j.content) };
  }

  // sha = null legt die Datei neu an; sonst muss sha zum aktuellen Stand passen (sonst 409).
  async function putFile(s, inhalt, sha, message) {
    const body = { message, content: b64enc(inhalt), branch: s.branch || 'main' };
    if (sha) body.sha = sha;
    return anfrage(s, 'PUT', dateiPfad(s), body);
  }

  async function repoInfo(s) {
    return anfrage(s, 'GET', repoPfad(s));
  }

  CRM.github = { getFile, putFile, repoInfo };
})(window.CRM);
