import assert from 'node:assert/strict';
import {test} from 'node:test';
import {products, recommendations} from '../src/lib/data.ts';
import {searchProducts} from '../src/lib/search.ts';
import {total} from '../src/lib/state.ts';

test('Все артикулы однозначны с дефисом и без него',()=>{
  for(const p of products){
    for(const q of [p.sku,p.sku.replace('-','').toLowerCase()]){
      assert.deepEqual(searchProducts(q).map(item=>item.id),[p.id]);
    }
  }
});
test('Варианты названия, модель, характеристики и пустая выдача',()=>{
  for(const q of ['леново slim 3','IdeaPad Slim 3 15','Lenovo 16gb 512гб']){
    assert.ok(searchProducts(q).some(p=>p.sku==='DEMO-001'));
  }
  for(const q of ['','---','несуществующаямодель'])assert.deepEqual(searchProducts(q),[]);
});
test('Контрольный заказ с курьером и самовывозом',()=>{
  const state={cart:{'lenovo-ideapad-slim-3-15':1},fav:[],compare:[],mode:'courier'};
  assert.equal(total(state).total,1709);
  assert.equal(total({...state,mode:'pickup'}).total,1699);
});
test('Подбор учитывает наличие, бюджет и вес',()=>{
  const matches=recommendations(1,2,true);
  assert.ok(matches.length>0&&matches.length<=3);
  assert.ok(matches.every(p=>p.stock&&p.price>=1500&&p.price<=2499&&p.weight<=1.5&&p.tasks.includes(1)));
  assert.deepEqual(recommendations(3,0,false),[]);
});
