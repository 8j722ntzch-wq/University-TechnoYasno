import {categories, products, money, url} from './data';
import {card, empty, esc} from './ui';

const aliases: Record<string,string> = {леново:'lenovo', асус:'asus', асер:'acer', эйсер:'acer', интел:'intel', райзен:'ryzen', гб:'gb', ссд:'ssd'};
function normalize(text:string) {
  return text.toLowerCase().replace(/ё/g,'е').replace(/[а-я]+/g, word=>aliases[word] ?? word)
    .replace(/[^а-яa-z0-9]+/g,' ').trim();
}
export function searchProducts(query:string) {
  const normalized=normalize(query);
  if (!normalized) return [];
  const words=normalized.split(/\s+/);
  const compact=words.join('');
  const key=(value:string)=>normalize(value).replaceAll(' ','');
  const exact=products.find(p=>key(p.sku)===compact);
  if(exact)return [exact];
  return products.map(product=>{
    const name=key(product.name);
    const fields=[product.sku,product.name,product.brand,categories[product.category],...Object.values(product.specs)].map(key);
    const score=name===compact?3:name.startsWith(compact)?2:words.every(w=>fields.some(f=>f.includes(w)))?1:0;
    return {product,score};
  }).filter(hit=>hit.score>0).sort((a,b)=>b.score-a.score).map(hit=>hit.product);
}

export function setupSearch(){
  const form=document.querySelector<HTMLFormElement>('form.search')!;
  const input=form.querySelector('input')!;
  const panel=form.querySelector<HTMLElement>('.suggestions')!;
  const list=panel.querySelector<HTMLElement>('[role=listbox]')!;
  let selected=-1;
  function select(index:number){
    selected=index;
    Array.from(list.children).forEach((item,i)=>item.setAttribute('aria-selected',String(i===index)));
    if(index<0) input.removeAttribute('aria-activedescendant');
    else input.setAttribute('aria-activedescendant','suggest-'+index);
  }
  function close(){panel.hidden=true;input.setAttribute('aria-expanded','false');select(-1)}
  function show(){
    if(!input.value.trim()){close();return}
    const hits=searchProducts(input.value).slice(0,5);
    list.innerHTML=hits.map((p,i)=>'<a role="option" tabindex="-1" id="suggest-'+i+'" href="'+url(p)+'"><b>'+esc(p.name)+'</b><small>'+esc(p.sku)+' · '+money(p.price)+'</small></a>').join('') || '<p>Совпадений нет. Попробуйте другой запрос.</p>';
    panel.hidden=false;input.setAttribute('aria-expanded','true');select(-1);
  }
  input.addEventListener('input',show);
  input.addEventListener('focus',show);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return}
    if(event.key==='Enter' && !panel.hidden && selected>=0){
      event.preventDefault();(list.children[selected] as HTMLAnchorElement).click();return;
    }
    if(!['ArrowDown','ArrowUp'].includes(event.key))return;
    if(panel.hidden)show();
    const n=list.querySelectorAll('a').length;
    if(panel.hidden || !n)return;
    event.preventDefault();
    select(event.key==='ArrowDown'?(selected+1)%n:(selected<=0?n-1:selected-1));
  });
  form.addEventListener('focusout',e=>{if(!form.contains(e.relatedTarget as Node))close()});
  document.addEventListener('pointerdown',e=>{if(!form.contains(e.target as Node))close()});
}

export function renderSearch(el:HTMLElement, refreshCards:()=>void){
  const q=(new URLSearchParams(location.search).get('q')||'').trim().slice(0,100);
  const hits=searchProducts(q);
  const input=document.querySelector<HTMLInputElement>('.search input')!;
  if(document.activeElement!==input)input.value=q;
  const previousCategory=el.querySelector<HTMLSelectElement>('[name=category]')?.value||'';
  const previousOrder=el.querySelector<HTMLSelectElement>('[name=order]')?.value||'';
  el.innerHTML='<p class="lead">По запросу «'+esc(q)+'» найдено: '+hits.length+'</p>';
  if(!hits.length){el.innerHTML+=empty('Совпадений нет','Измените запрос в строке поиска или откройте каталог.');return}
  const groups=[...new Set(hits.map(p=>p.category))];
  el.insertAdjacentHTML('beforeend','<div class="search-controls"><label>Категория <select name="category"><option value="">Все категории</option>'+groups.map(k=>'<option value="'+k+'">'+categories[k]+'</option>').join('')+'</select></label><label>Сортировка <select name="order"><option value="">По соответствию</option><option value="asc">Сначала дешевле</option><option value="desc">Сначала дороже</option></select></label></div><div class="grid"></div>');
  const category=el.querySelector<HTMLSelectElement>('[name=category]')!, order=el.querySelector<HTMLSelectElement>('[name=order]')!;
  category.value=previousCategory;order.value=previousOrder;
  function update(){
    const items=hits.filter(p=>!category.value||category.value===p.category);
    if(order.value)items.sort((a,b)=>(order.value==='asc'?1:-1)*(a.price-b.price));
    el.querySelector('.grid')!.innerHTML=items.map(card).join('');
  }
  category.onchange=order.onchange=()=>{update();refreshCards()};
  update();
}
