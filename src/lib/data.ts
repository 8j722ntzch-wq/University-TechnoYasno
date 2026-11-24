import catalog from './products.json';
export const categories = {laptops:'Ноутбуки',monitors:'Мониторы',peripherals:'Периферия',accessories:'Аксессуары',kits:'Комплекты'} as const;
export type Category = keyof typeof categories;
export const categoryImages = {laptops:'laptop-blue',monitors:'monitor',peripherals:'keyboard',accessories:'bag',kits:'kit'};
export const tasks = ['Офисная работа и учёба','Программирование и аналитика','Дизайн и графика','Видеомонтаж и 3D'];
export const budgets=['До 1 000 BYN','1 000–1 500 BYN','1 500–2 500 BYN','От 2 500 BYN'];
export const mobility=['Часто ношу с собой','Преимущественно на рабочем месте'];
export const limits=[[0,999],[1000,1499],[1500,2499],[2500,Infinity]];
export const courier=10;
export interface Product {id:string;slug:string;sku:string;category:Category;name:string;brand:string;price:number;specs:Record<string,string>;images:string[];description:string;stock:boolean;related:string[];tasks:number[];weight:number;}
export const products = catalog as Product[];
export const byId=(id:string)=>products.find(p=>p.id===id);
export const money=(n:number)=>new Intl.NumberFormat('ru-RU').format(n)+' BYN';
export const url=(p:Product)=>'/product/'+p.slug+'/';
export function recommendations(task:number,budget:number,mobile:boolean){const [min,max]=limits[budget];return products.filter(p=>p.category==='laptops'&&p.stock&&p.tasks.includes(task)&&p.price>=min&&p.price<=max&&(!mobile||p.weight<=1.5)).sort((a,b)=>a.price-b.price).slice(0,3)}
