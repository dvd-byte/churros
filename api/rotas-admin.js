
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
function respostaNaoAutorizada(res) {
    return res.status(401).json({
        ok: false,
        data: null
    });
}

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

async function exigirAutenticacao(req, res, next) {
    let conexao;

    try {
        const token = req.cookies?.[COOKIE];

        if (!tokenValido(token)) {
            return respostaNaoAutorizada(res);
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
            return respostaNaoAutorizada(res);
        }

        const csrfEsperado = hashToken(gerarCsrf(token));

        if (
            typeof sessao.csrf_hash !== 'string' ||
            !/^[a-f0-9]{64}$/.test(sessao.csrf_hash) ||
            !crypto.timingSafeEqual(
                Buffer.from(sessao.csrf_hash, 'hex'),
                Buffer.from(csrfEsperado, 'hex')
            )
        ) {
            return respostaNaoAutorizada(res);
        }

        req.admin = {
            id: sessao.id,
            nome: sessao.nome,
            perfil: sessao.perfil
        };

        next();
    } catch (erro) {
        return res.status(500).json({
            ok: false,
            data: null
        });
    } finally {
        if (conexao) conexao.release();
    }
}
function exigirCsrf(req, res, next) {
    const tokenSessao = req.cookies?.[COOKIE];
    const csrfRecebido = req.get('X-CSRF-Token');

    if (
        !tokenValido(tokenSessao) ||
        !tokenValido(csrfRecebido)
    ) {
        return res.status(403).json({
            ok: false,
            data: null
        });
    }

    const csrfEsperado = gerarCsrf(tokenSessao);

    if (
        !crypto.timingSafeEqual(
            Buffer.from(csrfRecebido, 'hex'),
            Buffer.from(csrfEsperado, 'hex')
        )
    ) {
        return res.status(403).json({
            ok: false,
            data: null
        });
    }

    next();
}
function exigirPermissao(recurso) {
    return (req, res, next) => {
        if (!req.admin) {
            return respostaNaoAutorizada(res);
        }

        if (req.admin.perfil !== 'proprietario') {
            return res.status(403).json({
                ok: false,
                data: null
            });
        }

        next();
    };
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
            `SELECT id, nome, senha_hash, ativo, perfil
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
        user: {
            id: usuario.id,
            nome: usuario.nome,
            permissions: usuario.perfil === 'proprietario' ? ['*'] : []
        },
        csrfToken: csrf
    }
});
          }  catch (erro) {
    console.error(
        'Erro no login:',
        erro.name,
        erro.message
    );
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

        const { maxAge, ...opcoesCookie } = cookieOptions(req);

res.clearCookie(COOKIE, opcoesCookie);

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

router.get('/loja', exigirAutenticacao, async (req, res) => {
    let conexao;

    try {
        conexao = await pool.getConnection();

        const lojas = await conexao.query(
            `SELECT
                id, nome, descricao, telefone, endereco,
                link_ifood, link_99food, instagram_url,
                whatsapp_url, mapa_url, historia_json,
                imagem_sobre_id, alt_sobre, publicada,
                fuso, versao
             FROM loja
             WHERE loja_unica = 1
             LIMIT 1`
        );

        const loja = lojas[0];

        if (!loja) {
            return res.status(404).json({
                ok: false,
                data: null
            });
        }
        let historia = [];

try {
    const valor = Array.isArray(loja.historia_json)
        ? loja.historia_json
        : JSON.parse(loja.historia_json ?? '[]');

    if (
        Array.isArray(valor) &&
        valor.every(item => typeof item === 'string')
    ) {
        historia = valor;
    }
} catch {
    console.error('História da loja contém JSON inválido');
}

        const horarios = await conexao.query(
            `SELECT
                dia_semana,
                hora_abertura,
                hora_fechamento,
                fechado
             FROM horarios_semanais
             WHERE loja_id = ?
             ORDER BY dia_semana`,
            [loja.id]
        );
        const nomesDias = {
    1: 'segunda',
    2: 'terça',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'sábado',
    7: 'domingo'
};

const diasAbertos = horarios
    .filter(horario => Number(horario.fechado) === 0)
    .map(horario => nomesDias[horario.dia_semana])
    .filter(Boolean);
    const intervalos = horarios
    .filter(horario => Number(horario.fechado) === 0)
    .map(horario => ({
        abertura: String(horario.hora_abertura).slice(0, 5),
        fechamento: String(horario.hora_fechamento).slice(0, 5)
    }));

const horariosIguais = intervalos.every(
    intervalo =>
        intervalo.abertura === intervalos[0].abertura &&
        intervalo.fechamento === intervalos[0].fechamento
);
if (!horariosIguais) {
    return res.status(409).json({
        ok: false,
        data: null
    });
}

        return res.json({
    ok: true,
    data: {
        ...loja,
        whatsapp: loja.whatsapp_url ?? '',
        instagram: loja.instagram_url ?? '',
        ifood: loja.link_ifood ?? '',
        food99: loja.link_99food ?? '',
        mapa: loja.mapa_url ?? '',
        altSobre: loja.alt_sobre ?? '',
        imagemSobre: '',
       historia,
dias: diasAbertos,
abertura: intervalos[0]?.abertura ?? '',
fechamento: intervalos[0]?.fechamento ?? '',
horarios
    }
});
    } catch (erro) {
        console.error(
            'Erro ao consultar loja:',
            erro.code || 'desconhecido'
        );

        return res.status(500).json({
            ok: false,
            data: null
        });
    } finally {
        if (conexao) conexao.release();
    }
});
router.put(
    '/loja',
    exigirAutenticacao,
    exigirCsrf,
    exigirPermissao('loja'),
    async (req, res) => {
        const nome = req.body?.nome;

if (
    typeof nome !== 'string' ||
    nome.trim().length === 0 ||
    nome.trim().length > 120
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'O nome da loja deve ter entre 1 e 120 caracteres.'
    });
}
const endereco = req.body?.endereco;

if (
    typeof endereco !== 'string' ||
    endereco.trim().length === 0 ||
    endereco.length > 5000
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'O endereço deve ter entre 1 e 5000 caracteres.'
    });
}
const telefone = req.body?.telefone;

if (
    telefone != null &&
    (
        typeof telefone !== 'string' ||
        telefone.length > 30
    )
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'O telefone deve ser um texto de até 30 caracteres.'
    });
}
const versao = req.body?.versao;

if (
    !Number.isSafeInteger(versao) ||
    versao < 1
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'A versão da loja deve ser um número inteiro positivo.'
    });
}
const historia = req.body?.historia;

if (
    !Array.isArray(historia) ||
    historia.length === 0 ||
    historia.some(
        paragrafo =>
            typeof paragrafo !== 'string' ||
            paragrafo.trim().length === 0
    )
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'A história deve conter pelo menos um parágrafo de texto válido.'
    });
}

const dias = req.body?.dias;
const numeroDias = {
    segunda: 1,
    terça: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sábado: 6,
    domingo: 7
};



const diasPermitidos = [
    'segunda', 'terça', 'quarta',
    'quinta', 'sexta', 'sábado', 'domingo'
];

if (
    !Array.isArray(dias) ||
    dias.length === 0 ||
    dias.some(dia => !diasPermitidos.includes(dia)) ||
    new Set(dias).size !== dias.length
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'Selecione dias de funcionamento válidos, sem repetições.'
    });
}
const diasSelecionados = new Set(
    dias.map(dia => numeroDias[dia])
);

const abertura = req.body?.abertura;
const fechamento = req.body?.fechamento;

const horarioValido = horario =>
    typeof horario === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);

if (
    !horarioValido(abertura) ||
    !horarioValido(fechamento) ||
    fechamento <= abertura
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'Informe horários válidos, com o fechamento após a abertura.'
    });
}
const instagram = req.body?.instagram;

function urlValida(valor) {
    if (valor == null || valor === '') return true;

    if (typeof valor !== 'string' || valor.length > 2048) {
        return false;
    }

    try {
        const url = new URL(valor);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

if (!urlValida(instagram)) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'Informe uma URL válida para o Instagram.'
    });
}
const links = {
    whatsapp: req.body?.whatsapp,
    ifood: req.body?.ifood,
    food99: req.body?.food99,
    mapa: req.body?.mapa
};

for (const [campo, valor] of Object.entries(links)) {
    if (!urlValida(valor)) {
        return res.status(400).json({
            ok: false,
            data: null,
            mensagem: `Informe uma URL válida para ${campo}.`
        });
    }
}
const altSobre = req.body?.altSobre;

if (
    altSobre != null &&
    (
        typeof altSobre !== 'string' ||
        altSobre.length > 500
    )
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'A descrição da imagem deve ter até 500 caracteres.'
    });
}
const imagemSobre = req.body?.imagemSobre;

if (
    imagemSobre != null &&
    imagemSobre !== ''
) {
    return res.status(400).json({
        ok: false,
        data: null,
        mensagem: 'O gerenciamento de imagens ainda não está disponível.'
    });
}
let conexao;

try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();

const lojas = await conexao.query(
    `SELECT id, versao
     FROM loja
     WHERE loja_unica = 1
     FOR UPDATE`
);

const lojaAtual = lojas[0];

if (!lojaAtual) {
    await conexao.rollback();

    return res.status(404).json({
        ok: false,
        data: null,
        mensagem: 'Loja não encontrada.'
    });
}

if (Number(lojaAtual.versao) !== versao) {
    await conexao.rollback();

    return res.status(409).json({
        ok: false,
        data: null,
        mensagem: 'A loja foi modificada. Atualize a página antes de salvar.'
    });
}

const dadosLoja = {
    nome: nome.trim(),
    endereco: endereco.trim(),
    telefone: telefone?.trim() || null,
    historia_json: JSON.stringify(historia),
    instagram_url: instagram || null,
    whatsapp_url: links.whatsapp || null,
    link_ifood: links.ifood || null,
    link_99food: links.food99 || null,
    mapa_url: links.mapa || null,
    alt_sobre: altSobre?.trim() || null
};

const sqlAtualizarLoja = `
    UPDATE loja
    SET nome = ?,
        endereco = ?,
        telefone = ?,
        historia_json = ?,
        instagram_url = ?,
        whatsapp_url = ?,
        link_ifood = ?,
        link_99food = ?,
        mapa_url = ?,
        alt_sobre = ?,
        versao = versao + 1,
        atualizado_em = CURRENT_TIMESTAMP(3)
    WHERE id = ? AND versao = ?
`;

const parametrosAtualizacao = [
    dadosLoja.nome,
    dadosLoja.endereco,
    dadosLoja.telefone,
    dadosLoja.historia_json,
    dadosLoja.instagram_url,
    dadosLoja.whatsapp_url,
    dadosLoja.link_ifood,
    dadosLoja.link_99food,
    dadosLoja.mapa_url,
    dadosLoja.alt_sobre,
    lojaAtual.id,
    versao
];

const horariosParaSalvar = [];

for (let dia = 1; dia <= 7; dia++) {
    const aberto = diasSelecionados.has(dia);

    horariosParaSalvar.push({
        dia_semana: dia,
        hora_abertura: aberto ? abertura : null,
        hora_fechamento: aberto ? fechamento : null,
        fechado: aberto ? 0 : 1
    });
}
const resultadoAtualizacao = await conexao.query(
    sqlAtualizarLoja,
    parametrosAtualizacao
);

if (Number(resultadoAtualizacao.affectedRows) !== 1) {
    await conexao.rollback();

    return res.status(409).json({
        ok: false,
        data: null,
        mensagem: 'Não foi possível atualizar a versão da loja.'
    });
}
for (const horario of horariosParaSalvar) {
    await conexao.query(
        `INSERT INTO horarios_semanais
            (loja_id, dia_semana, hora_abertura, hora_fechamento, fechado)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            hora_abertura = VALUES(hora_abertura),
            hora_fechamento = VALUES(hora_fechamento),
            fechado = VALUES(fechado),
            atualizado_em = CURRENT_TIMESTAMP(3)`,
        [
            lojaAtual.id,
            horario.dia_semana,
            horario.hora_abertura,
            horario.hora_fechamento,
            horario.fechado
        ]
    );
}

await conexao.commit();
} catch (erro) {
    if (conexao) {
        await conexao.rollback();
    }

    console.error('Erro ao preparar edição da loja:', erro.code || 'desconhecido');

    return res.status(500).json({
        ok: false,
        data: null,
        mensagem: 'Não foi possível preparar a edição da loja.'
    });
} finally {
    if (conexao) {
        conexao.release();
    }
}
       return res.status(200).json({
    ok: true,
    data: {
        mensagem: 'Loja atualizada com sucesso.'
    }
});
    }
);
module.exports = router;
