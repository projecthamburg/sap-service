import { mkdir, rm, cp, copyFile, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const out=resolve('dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp('public',out,{recursive:true});await cp('src',resolve(out,'src'),{recursive:true});await copyFile('index.html',resolve(out,'index.html'));
await writeFile(resolve(out,'.nojekyll'),'');
// Hash routes work both at a domain root and a GitHub Pages repository subpath.
await copyFile('index.html',resolve(out,'404.html'));
const base=process.env.SAP_SITE_URL||'https://projecthamburg.github.io/sap-service/';
await writeFile(resolve(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`);
await writeFile(resolve(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}</loc></url></urlset>`);
let bytes=0,files=0;async function count(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())await count(p);else{bytes+=(await readFile(p)).length;files++;}}}await count(out);
console.log(`Built ${files} public files (${(bytes/1024/1024).toFixed(2)} MB). Private material and credentials are excluded.`);
