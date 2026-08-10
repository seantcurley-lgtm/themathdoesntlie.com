import fs from 'node:fs';
import vm from 'node:vm';

const context = {};
vm.createContext(context);
for (const file of ['covered-call-lab/data.js','covered-call-lab/release-2.7.js','covered-call-lab/release-2.7.1.js','covered-call-lab/release-2.7.3.js']) {
  const source = fs.readFileSync(file, 'utf8').replace(/^const DATA/, 'DATA');
  vm.runInContext(source, context, { filename: file });
}
for (const file of ['covered-call-lab/sp500.js','covered-call-lab/schd.js']) {
  const source = fs.readFileSync(file, 'utf8').replace(/^window\./gm, 'this.');
  vm.runInContext(source, context, { filename: file });
}
const symbols = new Set(['SPY','QQQ','DIA','SPYI','BND']);
for (const row of context.DATA.holdings || []) symbols.add(row.ticker);
for (const row of context.SP500_SEED || []) symbols.add(row.ticker);
for (const row of context.SCHD_SEED?.holdings || []) symbols.add(row.ticker);
const normalized = [...symbols].map(x => String(x).trim().toUpperCase().replace('.', '-')).filter(Boolean).sort();
fs.writeFileSync('cloudflare/covered-call-quotes/src/generated-allowlist.js', `export const ALLOWED_TICKERS = ${JSON.stringify(normalized)};\n`);
console.log(`Generated ${normalized.length} approved tickers.`);
