// Package the compiled Astro pages for double-click demonstrations in Chrome.
import fs from 'node:fs/promises';
import path from 'node:path';
import {rolldown} from 'rolldown';
const dir='dist', assets=await fs.readdir(dir+'/_astro');
const bundle=await rolldown({input:'src/lib/client.ts',platform:'browser'});
const {output}=await bundle.generate({format:'iife',codeSplitting:false,minify:true});
await bundle.close();
const uri=async(file,mime)=>'data:'+mime+';base64,'+(await fs.readFile(file)).toString('base64');
let css=await fs.readFile(dir+'/_astro/'+assets.find(n=>n.endsWith('.css')),'utf8');
for(const n of await fs.readdir(dir+'/fonts'))css=css.replaceAll('/fonts/'+n,await uri(dir+'/fonts/'+n,'font/woff2'));
const media={};for(const n of await fs.readdir(dir+'/media'))media[n.replace('.webp','')]=await uri(dir+'/media/'+n,'image/webp');
const pages={};for(const n of await fs.readdir(dir,{recursive:true})){if(!n.endsWith('.html'))continue;const html=await fs.readFile(dir+'/'+n,'utf8');const id=n==='index.html'?'':n==='404.html'?'404':path.dirname(n);pages[id]=[html.match(/<title>(.*?)<\/title>/s)[1],html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')];}
const sprite=(await fs.readFile(dir+'/icons.svg','utf8')).replace('<svg ','<svg width="0" height="0" style="position:absolute" ');
const encode=o=>JSON.stringify(o).replace(/</g,'\\u003c');
const shell='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="'+await uri(dir+'/favicon.svg','image/svg+xml')+'"><style>'+css+'</style><body>'+sprite+'<div id="offlineRoot"></div><script>';
const boot=`window.technoMedia=${encode(media)};const pages=${encode(pages)};const key=new URLSearchParams(location.search).get('page')||'';const [title,body]=pages[key]||pages['404'];document.title=title;document.body.dataset.path=key;document.querySelector('#offlineRoot').innerHTML=body.replaceAll('/icons.svg#','#').replace(/src="\\/media\\/([^"]+)\\.webp"/g,(_,n)=>'src="'+window.technoMedia[n]+'"');document.addEventListener('click',e=>{const a=e.target.closest('a[href^="/"]');if(a){e.preventDefault();location.search='?page='+encodeURIComponent(a.getAttribute('href').replace(/^\\/|\\/$/g,''))}});document.addEventListener('submit',e=>{if(e.target.matches('form.search')){e.preventDefault();location.search='?page=search&q='+encodeURIComponent(e.target.elements.q.value)}});`;
await fs.writeFile('TechnoYasno.html',shell+boot+'</script><script>'+output[0].code.replace(/<\/script/gi,'<\\/script')+'</script></body></html>');
