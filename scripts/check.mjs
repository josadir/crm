// Syntaxprüfung aller Skripte: npm run check
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dateien = ['js', 'js/views'].flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f));
let fehler = 0;
for (const f of dateien) { try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { fehler++; console.error('FEHLER', f, String(e.stderr).split('\n').slice(0, 4).join('\n')); } }
console.log(fehler ? fehler + ' Fehler' : dateien.length + ' Dateien geprüft, alles in Ordnung');
process.exit(fehler ? 1 : 0);
