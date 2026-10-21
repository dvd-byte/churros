
const path = require('node:path');
const caminhoEnv = process.env.NODE_ENV === 'test'
    ? '.env.teste'
    : '.env';

require('dotenv').config({ path: path.join(__dirname, caminhoEnv), quiet: true });
if (
    process.env.NODE_ENV === 'test' &&
    process.env.DB_NAME !== 'churros_em_casa_teste_017'
) {
    throw new Error(
        'Segurança: ambiente de teste configurado com banco não autorizado.'
    );
}

// Esta entrega continua restrita a testes, inclusive antes de criar o pool.
if (process.env.NODE_ENV !== 'test') {
    throw new Error('API bloqueada fora do ambiente de teste. Produção exige configuração e homologação próprias.');
}
for (const campo of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (!process.env[campo]?.trim()) throw new Error(`Configuração obrigatória ausente: ${campo}`);
}
const portaBanco = Number(process.env.DB_PORT || 3306);
if (!Number.isInteger(portaBanco) || portaBanco < 1 || portaBanco > 65535) {
    throw new Error('DB_PORT inválida.');
}

const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    port: portaBanco,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5,
    timezone: '+00:00'
});

module.exports = pool;
