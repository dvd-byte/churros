'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const v=require('../validacao');
test('valores monetários mantêm centavos exatos e rejeitam precisão excedente',()=>{
    assert.equal(v.preco('12.30'),'12.30');assert.equal(v.preco(0.1),'0.10');assert.equal(v.preco('0'),'0.00');
    for(const x of [-1,'1e3','12.345','1,00',Infinity,0.1+0.2])assert.throws(()=>v.preco(x),v.ErroHttp);
});
test('datas locais de São Paulo convertem para UTC sem normalizar datas inválidas',()=>{
    const d=v.data('2026-10-23T12:30','data',true);assert.equal(d.toISOString(),'2026-10-23T15:30:00.000Z');assert.equal(v.local(d),'2026-10-23T12:30');
    for(const x of ['2026-02-30T12:00','2026-10-23T25:00','2018-11-04T00:30','2019-02-16T23:30'])assert.throws(()=>v.data(x,'data',true),v.ErroHttp);
});
test('links e identificadores rejeitam esquemas ativos e credenciais embutidas',()=>{
    for(const x of ['javascript:alert(1)','data:text/html,a','https://usuario:senha@example.com/'])assert.throws(()=>v.url(x,'link'),v.ErroHttp);
    for(const x of ['0','1 OR 1=1','-1','4294967296',1])assert.throws(()=>v.id(x),v.ErroHttp);
    assert.equal(v.id('42'),'42');assert.equal(v.url('https://example.com/','link'),'https://example.com/');
});
