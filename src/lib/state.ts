import {byId,courier} from './data';
export type Mode='courier'|'pickup';
export type Basket=Record<string,number>;
export type State={cart:Basket,fav:string[],compare:string[],mode:Mode};
const key='technoyasno.v1';
export function read():State{let raw:any={};try{raw=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}const cart:Basket={};for(const [id,n] of Object.entries(raw.cart||{}))if(byId(id)?.stock&&typeof n==='number'&&Number.isInteger(n)&&n>0)cart[id]=Math.min(99,n);const unique=(v:unknown):string[]=>Array.isArray(v)?[...new Set(v.filter((s):s is string=>typeof s==='string'&&!!byId(s)))]:[];return {cart,fav:unique(raw.fav),compare:unique(raw.compare).filter(id=>byId(id)?.category==='laptops').slice(0,4),mode:raw.mode==='pickup'?'pickup':'courier'}}
export function save(state:State){localStorage.setItem(key,JSON.stringify(state))}
export function total(s:State){const entries=Object.entries(s.cart);const subtotal=entries.reduce((v,[id,n])=>v+byId(id)!.price*n,0);const shipping=entries.length&&s.mode==='courier'?courier:0;return {subtotal,shipping,total:subtotal+shipping,count:entries.reduce((v,[,n])=>v+n,0)}}
