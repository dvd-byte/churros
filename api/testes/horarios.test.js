'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('horario publico usa Sao Paulo, limite de fechamento e dias cadastrados', () => {
    const eventos = {}, indicador = {dataset:{},textContent:''};
    let instante = '2026-10-23T11:59:00Z', atualizar;
    const contexto = {
        Date: class extends Date { constructor() { super(instante); } }, Intl,
        location:{protocol:'http:'},
        document:{getElementById:()=>indicador,addEventListener(){}},
        window:{addEventListener:(nome,fn)=>{eventos[nome]=fn;},setInterval:fn=>{atualizar=fn;}}
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../js/onde-comprar.js'),'utf8'),contexto);
    assert.equal(indicador.dataset.estado,'indisponivel');
    eventos['loja:atualizada']({detail:{horarios:[{dia:5,fechado:false,abertura:'09:00:00',fechamento:'18:00:00'},{dia:6,fechado:true,abertura:null,fechamento:null}]}});
    assert.equal(indicador.dataset.estado,'fechado');
    instante='2026-10-23T12:00:00Z'; atualizar(); assert.equal(indicador.dataset.estado,'aberto');
    instante='2026-10-23T21:00:00Z'; atualizar(); assert.equal(indicador.dataset.estado,'fechado');
    instante='2026-10-24T15:00:00Z'; atualizar(); assert.equal(indicador.dataset.estado,'fechado');
    instante='2026-10-25T15:00:00Z'; atualizar(); assert.equal(indicador.dataset.estado,'indisponivel');
    eventos['loja:indisponivel'](); assert.equal(indicador.dataset.estado,'indisponivel');
});
