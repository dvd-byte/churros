
const caminhoEnv = process.env.NODE_ENV === 'test'
    ? '.env.teste'
    : '.env';

require('dotenv').config({ path: caminhoEnv });
if (
    process.env.NODE_ENV === 'test' &&
    process.env.DB_NAME !== 'churros_em_casa_teste_017'
) {
    throw new Error(
        'Segurança: ambiente de teste configurado com banco não autorizado.'
    );
}

const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5
});

module.exports = pool;
