
'use strict';

const express = require('express');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const rateLimit = require('express-rate-limit');
const pool = require('./database');
if (
    process.env.NODE_ENV !== 'test' ||
    process.env.DB_NAME !== 'churros_em_casa_teste_017'
) {
    throw new Error(
        'AutenticaÃ§Ã£o administrativa bloqueada fora do ambiente de teste.'
    );
}

const router = express.Router();
router.use((req, res, next) => {
    const endereco = req.socket.remoteAddress || '';

    const ambienteLocal =
        endereco === '127.0.0.1' ||
        endereco === '::1' ||
        endereco === '::ffff:127.0.0.1';

    if (!req.secure && !ambienteLocal) {
        return res.status(403).json({
            ok: false,
            data: null
        });
    }

    next();
});

const COOKIE = 'churros_admin';
const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

function tokenValido(token) {
    return typeof token === 'string' &&
        /^[a-f0-9]{64}$/.test(token);
}

function gerarCsrf(tokenSessao) {
    return crypto
        .createHmac('sha256', tokenSessao)
        .update('churros-admin-csrf-v1')
        .digest('hex');
}

function cookieOptions(req) {
    const ambienteLocal =
        req.hostname === 'localhost' ||
        req.hostname === '127.0.0.1' ||
        req.hostname === '::1';

    return {
        httpOnly: true,
        secure: !ambienteLocal || req.secure,
        sameSite: 'strict',
        path: '/api/admin',
        maxAge: DURACAO_SESSAO_MS
    };
}

function origemPermitida(req) {
    const origem = req.get('origin');

    if (!origem) return false;

    try {
        return new URL(origem).origin ===
            `${req.protocol}://${req.get('host')}`;
    } catch {
        return false;
    }
}

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return next();
    }

    if (!origemPermitida(req)) {
        return res.status(403).json({
            ok: false,
            data: null
        });
    }

    next();
});

const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        ok: false,
        data: null
    }
});

router.post('/login', limitarLogin, async (req, res) => {
    let conexao;
let transacaoIniciada = false;

    try {
        const { email, senha } = req.body || {};

        if (
            typeof email !== 'string' ||
            typeof senha !== 'string' ||
            !email ||
            !senha ||
            email.length > 254 ||
            senha.length > 1024
        ) {
            return res.status(422).json({
                ok: false,
                data: null
            });
        }

        conexao = await pool.getConnection();

        const usuarios = await conexao.query(
            `SELECT id, nome, senha_hash, ativo
             FROM administradores
             WHERE email = ?
             LIMIT 1`,
            [email.trim().toLowerCase()]
        );

        const usuario = usuarios[0];

        if (
            !usuario ||
            !usuario.ativo ||
            !(await argon2.verify(usuario.senha_hash, senha))
        ) {
            return res.status(401).json({
                ok: false,
                data: null
            });
        }
        await conexao.beginTransaction();
        transacaoIniciada = true;
const tokenAnterior = req.cookies?.[COOKIE];

if (tokenValido(tokenAnterior)) {
    await conexao.query(
        `UPDATE sessoes_admin
         SET revogado_em = NOW(3)
         WHERE token_hash = ?
           AND revogado_em IS NULL`,
        [hashToken(tokenAnterior)]
    );
}
        const token = gerarToken();
        const csrf = gerarCsrf(token);
        const expiraEm = new Date(
            Date.now() + DURACAO_SESSAO_MS
        );

        await conexao.query(
            `INSERT INTO sessoes_admin
                (administrador_id, token_hash, csrf_hash, expira_em)
             VALUES (?, ?, ?, ?)`,
            [
                usuario.id,
                hashToken(token),
                hashToken(csrf),
                expiraEm
            ]
        );

        await conexao.commit();
        transacaoIniciada = false;
        res.cookie(COOKIE, token, cookieOptions(req));

        return res.json({
            ok: true,
            data: {
                autenticado: true
            }
        });
          } catch {
        if (conexao && transacaoIniciada) {
            try {
                await conexao.rollback();
            } catch {
                // A conexÃ£o pode ter sido interrompida.
            }
        }

        return res.status(500).json({
            ok: false,
            data: null
        });
    } finally {
        if (conexao) conexao.release();
    }
});

router.get('/session', async (req, res) => {
    let conexao;

    try {
        const token = req.cookies?.[COOKIE];

        if (!tokenValido(token)) {
            return res.status(401).json({
                ok: false,
                data: null
            });
        }

        conexao = await pool.getConnection();

        const sessoes = await conexao.query(
            `SELECT
                a.id,
                a.nome,
                a.ativo,
                a.perfil,
                s.csrf_hash
             FROM sessoes_admin s
             JOIN administradores a
                ON a.id = s.administrador_id
             WHERE s.token_hash = ?
               AND s.revogado_em IS NULL
               AND s.expira_em > NOW(3)
             LIMIT 1`,
            [hashToken(token)]
        );

        const sessao = sessoes[0];

        if (!sessao || !sessao.ativo) {
            return res.status(401).json({
                ok: false,
                data: null
            });
        }

        const csrf = gerarCsrf(token);

if (
    typeof sessao.csrf_hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(sessao.csrf_hash) ||
    !crypto.timingSafeEqual(
        Buffer.from(sessao.csrf_hash, 'hex'),
        Buffer.from(hashToken(csrf), 'hex')
    )
) {
    return res.status(401).json({
        ok: false,
        data: null
    });
}

        return res.json({
            ok: true,
            data: {
                user: {
                    id: sessao.id,
                    nome: sessao.nome,
                    permissions: sessao.perfil === 'proprietario' ? ['*'] : []
                },
                csrfToken: csrf
            }
        });
    } catch {
        return res.status(500).json({
            ok: false,
            data: null
        });
    } finally {
        if (conexao) conexao.release();
    }
});

router.post('/logout', async (req, res) => {
    let conexao;

    try {
        const token = req.cookies?.[COOKIE];
        const csrf = req.get('X-CSRF-Token');

        if (!tokenValido(token) || !tokenValido(csrf)) {
            return res.status(401).json({
                ok: false,
                data: null
            });
        }

        conexao = await pool.getConnection();

        const resultado = await conexao.query(
            `UPDATE sessoes_admin
             SET revogado_em = NOW(3)
             WHERE token_hash = ?
               AND csrf_hash = ?
               AND revogado_em IS NULL
               AND expira_em > NOW(3)`,
            [hashToken(token), hashToken(csrf)]
        );

        if (Number(resultado.affectedRows) !== 1) {
            return res.status(403).json({
                ok: false,
                data: null
            });
        }

        res.clearCookie(COOKIE, {
            path: '/api/admin',
            httpOnly: true,
            secure: req.secure,
            sameSite: 'strict'
        });

        return res.json({
            ok: true,
            data: {
                autenticado: false
            }
        });
    } catch {
        return res.status(500).json({
            ok: false,
            data: null
        });
    } finally {
        if (conexao) conexao.release();
    }
});

module.exports = router;
