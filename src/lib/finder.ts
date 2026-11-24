import React from '../vendor/react.js';
import DOM from '../vendor/react-dom.js';
import {tasks,budgets,mobility,recommendations} from './data';
import {mini,action,icon} from './ui';
const h=React.createElement;
function Finder(){
 const [answers,setAnswers]=React.useState([0,2,1]);
 const [applied,setApplied]=React.useState([0,2,1]);
 const [task,budget,place]=applied;
 const matches=recommendations(task,budget,place===0);
 const config=['От 8 ГБ ОЗУ · встроенная графика','От 16 ГБ ОЗУ · SSD от 512 ГБ','От 16 ГБ ОЗУ · графика Intel Arc или GeForce','32 ГБ ОЗУ · дискретная GeForce RTX'][task]+(place===0?' · вес до 1,5 кг':'');
 const options=[tasks,budgets,mobility];const dirty=answers.some((v:number,i:number)=>v!==applied[i]);
 return h('div',{className:'finder-layout'},h('form',{className:'panel pad',onSubmit:(e:Event)=>{e.preventDefault();setApplied([...answers])}},h('div',{className:'sectiontitle'},h('h3',null,'Ваши параметры'),h('b',{className:'textlink'},'Шаг 3 из 3')),h('div',{className:'progress'},...['Задача','Бюджет','Мобильность'].map(t=>h('span',{key:t},t))),...options.map((items,group)=>h('fieldset',{className:'finder-group',key:group},h('legend',null,['Для чего нужен ноутбук?','Ваш бюджет','Как будете использовать устройство?'][group]),h('div',{className:'picks group-'+group},...items.map((name,i)=>h('label',{key:name,className:answers[group]===i?'picked':''},h('input',{type:'radio',name:'question'+group,checked:answers[group]===i,onChange:()=>setAnswers(answers.map((v:number,k:number)=>k===group?i:v))}),name))))),h('div',{className:'note'},h('b',null,'Подходящая конфигурация'),h('small',null,config)),h('button',{className:'btn primary wide'},'Показать подходящие модели'),dirty&&h('small',{role:'status'},'Примените параметры для пересчёта.')),h('section',{className:'panel pad finder-results','aria-live':'polite'},h('h3',null,'Рекомендуемые модели'),h('p',null,tasks[task]+' · '+budgets[budget]),...(matches.length?matches.map(p=>h('article',{className:'recommend',key:p.id},h('div',{dangerouslySetInnerHTML:{__html:mini(p)}}),h('small',null,'Подходит по задаче · '+p.specs['Оперативная память']+' · '+p.specs['Вес']),h('div',{className:'actionlinks',dangerouslySetInnerHTML:{__html:action('compare',p,'Сравнить','link','chart-no-axes-column')}}))):[h('div',{className:'note',key:'none'},h('b',null,'Точных совпадений нет'),h('p',null,'Среди моделей в наличии нет конфигурации для этой задачи, бюджета и веса. Измените один из параметров.'))]),h('a',{className:'btn secondary wide',href:'/compare/'},'Открыть сравнение')));
}
export function mount(el:HTMLElement){DOM.createRoot(el).render(h(Finder))}
