'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validar } = require('../operacoes/validar-producao');
const valido = () => ({ NODE_ENV:'production', PUBLIC_ORIGIN:'https://loja.example', PORT:'3000', DB_HOST:'sql.example', DB_PORT:'3306', DB_USER:'conta_exclusiva', DB_PASSWORD:'segredo-ficticio-de-teste', DB_NAME:'conta_loja_prod', TRUSTED_PROXY_CIDRS:'127.0.0.1/32,::1/128', UPLOADS_DIR:require('node:path').resolve('volume-persistente'), MEDIA_PERSISTENCE_VERIFIED:'yes' });
test('pré-voo não aceita banco original/testes, HTTP, proxy aberto ou persistência não verificada', () => {
    assert.deepEqual(validar(valido()), []);
    for (const [campo, valor] of [['DB_NAME','churros_em_casa'],['DB_NAME','churros_em_casa_teste_017'],['DB_USER','root'],['DB_PASSWORD',''],['PUBLIC_ORIGIN','http://loja.example'],['PUBLIC_ORIGIN','https://loja.example/caminho'],['TRUSTED_PROXY_CIDRS','true'],['TRUSTED_PROXY_CIDRS','0.0.0.0/0'],['TRUSTED_PROXY_CIDRS','::/0'],['UPLOADS_DIR','relativo/uploads'],['MEDIA_PERSISTENCE_VERIFIED','no']]) {
        assert(validar({...valido(), [campo]:valor}).includes(campo), campo);
    }
});
