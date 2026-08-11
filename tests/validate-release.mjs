import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const htmlFiles=fs.readdirSync(root).filter(name=>name.endsWith('.html'));
assert(htmlFiles.includes('evidence-engine.html'));

for(const file of htmlFiles){
  const text=fs.readFileSync(path.join(root,file),'utf8');
  assert(!/<<<<<<<|=======|>>>>>>>/.test(text),`${file} contains a merge marker`);
  for(const match of text.matchAll(/(?:href|src)="([^"]+)"/g)){
    const value=match[1].split(/[?#]/)[0];
    if(!value||/^(?:https?:|mailto:|tel:)/.test(value))continue;
    const target=path.resolve(root,value.endsWith('/')?`${value}index.html`:value);
    assert(fs.existsSync(target),`${file} references missing ${value}`);
  }
}

const snapshot=JSON.parse(fs.readFileSync(path.join(root,'covered-call-lab/market-data.json'),'utf8'));
assert(snapshot.securities.length>=503,'shared universe lost S&P 500 coverage');
assert(snapshot.securities.every(row=>row.ticker&&row.name),'security identity is incomplete');
assert(snapshot.securities.every(row=>Number(row.price)>0),'one or more launch records lacks a price');

const launcher=fs.readFileSync(path.join(root,'evidence-engine.js'),'utf8');
for(const field of ['ticker','company','price','marketDate','marketUrl','source'])assert(launcher.includes(field),`launcher omitted ${field}`);
assert(launcher.includes('source: \'TMDL\''),'launcher does not activate the governed TMDL context');
console.log(`Validated Website 2.8.0: ${htmlFiles.length} pages, ${snapshot.securities.length} securities, Evidence Engine handoff present.`);
