
'use strict';

if (process.env.NODE_ENV !== 'test') {
    console.error('Execução bloqueada: NODE_ENV precisa ser test.');
    process.exit(1);
}

const prompt = require('prompt-sync')({ sigint: true });
const argon2 = require('argon2');
const pool = require('./database');

const BANCO_PERMITIDO = 'churros_em_casa_teste_017';

async function main() {
    let conexao;

    try {
        const nome = prompt('Nome do administrador: ').trim();
        const email = prompt('E-mail do administrador: ')
            .trim()
            .toLowerCase();

        // A senha não é exibida durante a digitação.
        const senha = prompt.hide('Senha (mínimo de 12 caracteres): ');

        if (!nome || nome.length > 120) {
            throw new Error('Nome inválido.');
        }

        if (
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            throw new Error('E-mail inválido.');
        }

        if (
            senha.length < 12 ||
            Buffer.byteLength(senha, 'utf8') > 128
        ) {
            throw new Error(
                'A senha deve ter pelo menos 12 caracteres e até 128 bytes.'
            );
        }

        conexao = await pool.getConnection();

        const [banco] = await conexao.query(
            'SELECT DATABASE() AS nome'
        );

        if (banco?.nome !== BANCO_PERMITIDO) {
            throw new Error(
                'Banco não autorizado. Nenhuma conta foi criada.'
            );
        }

        const existentes = await conexao.query(
            'SELECT id FROM administradores WHERE email = ? LIMIT 1',
            [email]
        );

        if (existentes.length > 0) {
            throw new Error(
                'Já existe um administrador com esse e-mail.'
            );
        }

        const senhaHash = await argon2.hash(senha, {
            type: argon2.argon2id
        });

        await conexao.query(
            `INSERT INTO administradores
                (nome, email, senha_hash, perfil, ativo)
             VALUES (?, ?, ?, 'proprietario', 1)`,
            [nome, email, senhaHash]
        );

        console.log(
            'Administrador inicial criado no banco de teste.'
        );
    } finally {
        if (conexao) {
            conexao.release();
        }

        await pool.end();
    }
}

main().catch((erro) => {
    console.error(
        erro.message || 'Não foi possível criar o administrador.'
    );
    process.exitCode = 1;
});
