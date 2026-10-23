'use strict';
// Pré-voo somente: não importa database.js, não abre conexões e não habilita o servidor.
const path = require('node:path');
const net = require('node:net');
function validar(env) {
    const erros = [];
    const exigir = (ok, campo) => { if (!ok) erros.push(campo); };
    exigir(env.NODE_ENV === 'production', 'NODE_ENV');
    let origem;
    try { origem = new URL(env.PUBLIC_ORIGIN); } catch {}
    exigir(origem && origem.protocol === 'https:' && origem.origin === env.PUBLIC_ORIGIN && !origem.username && !origem.password && !/preencher/i.test(origem.hostname) && !['localhost','127.0.0.1','[::1]'].includes(origem.hostname), 'PUBLIC_ORIGIN');
    exigir(!!env.DB_HOST?.trim(), 'DB_HOST');
    exigir(/^\d+$/.test(env.DB_PORT || '') && +env.DB_PORT > 0 && +env.DB_PORT <= 65535, 'DB_PORT');
    exigir(!!env.DB_USER?.trim() && env.DB_USER.toLowerCase() !== 'root', 'DB_USER');
    exigir(!!env.DB_PASSWORD && !/^(sua_senha|preencher|changeme)$/i.test(env.DB_PASSWORD), 'DB_PASSWORD');
    exigir(/^[a-zA-Z0-9_]+$/.test(env.DB_NAME || '') && !/teste|test|restauracao/i.test(env.DB_NAME) && env.DB_NAME !== 'churros_em_casa', 'DB_NAME');
    exigir(/^\d+$/.test(env.PORT || '') && +env.PORT > 0 && +env.PORT <= 65535, 'PORT');
    const proxies = (env.TRUSTED_PROXY_CIDRS || '').split(',').map(x => x.trim());
    exigir(proxies.length > 0 && proxies.every(x => {
        const partes = x.split('/'), familia = net.isIP(partes[0]);
        return familia && partes.length <= 2 && (partes.length === 1 || /^\d+$/.test(partes[1]) && +partes[1] > 0 && +partes[1] <= (familia === 4 ? 32 : 128));
    }), 'TRUSTED_PROXY_CIDRS');
    exigir(path.isAbsolute(env.UPLOADS_DIR || '') && !env.UPLOADS_DIR.includes('PREENCHER'), 'UPLOADS_DIR');
    exigir(env.MEDIA_PERSISTENCE_VERIFIED === 'yes', 'MEDIA_PERSISTENCE_VERIFIED');
    return erros;
}
if (require.main === module) {
    // Credenciais fornecidas pelo ambiente da hospedagem; nenhum .env é carregado.
    const erros = validar(process.env);
    if (erros.length) {
        console.error('Pré-voo pendente. Revisar somente estes campos: ' + erros.join(', '));
        process.exitCode = 1;
    } else console.log('Campos de preparação válidos. Compatibilidade SQL, proxy, HTTPS e persistência ainda exigem homologação. Produção continua bloqueada no servidor atual.');
}
module.exports = { validar };
