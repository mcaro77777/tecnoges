import {readFile,mkdir,copyFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const html=await readFile(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate HTML identifiers');
for(const [,id] of html.matchAll(/(?:href="#|aria-controls=")([^"\s]+)"/g))if(!ids.includes(id))throw new Error(`Missing target ${id}`);
const assets=[...new Set([...html.matchAll(/(?:src|href|poster)="([^"#][^"]*)"/g)].map(x=>x[1]).filter(x=>!x.includes(':')).map(x=>x.split(/[?#]/)[0]))];
for(const asset of assets)await access(path.join(root,asset));
if(!html.includes('https://wa.me/56993991036')||!html.includes('mailto:mcsolucionestecno@gmail.com'))throw new Error('Direct contact links are missing');
if(/contacto@mstecnologia\.cl|Próximamente|contactForm/.test(html))throw new Error('Stale contact placeholder detected');
if(/Lo Beltr|lobeltran|EL PARQUE|43197|2082/.test(html))throw new Error('Original customer data detected');
await rm(path.join(root,'dist'),{recursive:true,force:true});
for(const asset of ['index.html',...assets]){
  const destination=path.join(root,'dist',asset);
  await mkdir(path.dirname(destination),{recursive:true});
  await copyFile(path.join(root,asset),destination);
}
console.log(`Static build ready: ${assets.length+1} files; links, assets and direct contact verified.`);
