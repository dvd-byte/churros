
const express = require('express');
const pool = require('./database');
const cookieParser = require('cookie-parser');
const rotasAdmin = require('./rotas-admin');
const path = require('node:path');
const helmet = require('helmet');

const app = express();
const PORTA = process.env.PORT || 3000;


app.disable('x-powered-by');

app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api/admin', rotasAdmin);
const pastaAdmin = path.join(__dirname, '..', 'admin');

const arquivosPublicosAdmin = new Set([
    'index.html',
    'admin.css',
    'admin.js',
    'api.js'
]);

app.use('/admin', (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(405);
    if (req.originalUrl.split('?')[0] === '/admin') return res.redirect(308, '/admin/');
    const arquivo = req.path === '/'
        ? 'index.html'
        : req.path.slice(1);

    if (!arquivosPublicosAdmin.has(arquivo)) {
        return res.sendStatus(404);
    }

    res.sendFile(path.join(pastaAdmin, arquivo));
});

// Servir somente recursos públicos; nunca expor a raiz do repositório.
const raizSite = path.join(__dirname, '..');
const paginasPublicas = new Set(['blog.html', 'cardapio.html', 'promocoes.html', 'onde-comprar.html', 'sobre.html', 'galeria.html']);
app.get(['/', '/index.html', '/index.css', '/index.js'], (req, res) => {
    res.sendFile(path.join(raizSite, req.path === '/' ? 'index.html' : req.path.slice(1)));
});
app.use('/paginas', (req, res, next) => {
    if (!paginasPublicas.has(req.path.slice(1))) return res.sendStatus(404);
    if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(405);
    res.sendFile(path.join(raizSite, 'paginas', req.path.slice(1)));
});
for (const [pasta, extensoes] of [
    ['css', new Set(['.css'])], ['js', new Set(['.js'])],
    ['images', new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif', '.ico'])]
]) {
    app.use('/' + pasta, (req, res, next) => {
        if (!extensoes.has(path.extname(req.path).toLowerCase())) return res.sendStatus(404);
        next();
    }, express.static(path.join(raizSite, pasta), { dotfiles: 'deny', index: false, redirect: false }));
}

app.get('/api/teste', (req, res) => {
    res.json({ mensagem: 'Rota de teste funcionando!' });
});


// Rota para verificar se a API está funcionando
app.get('/api', (req, res) => {
    res.json({
        mensagem: 'API do Churros em Casa funcionando!'
    });
});


 // Rota para consultar os produtos
app.get('/api/produtos', async (req, res) => {
    let conexao;

    try {
        conexao = await pool.getConnection();

        const produtos = await conexao.query(`
            SELECT
                p.id,
                p.categoria_id,
                c.nome AS categoria,
                p.grupo_id,
                g.nome AS grupo,
                p.nome,
                p.descricao,
                p.preco,
                p.imagem_id,
                p.disponivel,
                p.ordem
            FROM produtos AS p
            INNER JOIN categorias_cardapio AS c
                ON c.id = p.categoria_id
            INNER JOIN grupos_cardapio AS g
                ON g.id = p.grupo_id
            WHERE c.status = 'publicado'
              AND p.status = 'publicado'
              AND g.ativo = 1
              AND g.categoria_id = p.categoria_id
            ORDER BY
                c.ordem,
                g.ordem,
                p.ordem,
                p.nome
        `);

        res.json({
    ok: true,
    data: {
        items: produtos
    }
});
    } catch (erro) {
        console.error(
            'Erro ao consultar produtos:',
            erro.code || 'desconhecido'
        );

        res.status(500).json({ ok: false, data: null,
            erro: 'Não foi possível consultar os produtos.' });
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
});


app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, data: null, erro: 'Rota não disponível.' });
});
app.use((erro, req, res, next) => {
    if (res.headersSent) return next(erro);
        console.error(
    'Erro global da API:',
    erro.name,
    erro.message
);
    const status = erro.type === 'entity.parse.failed' ? 400
        : erro.type === 'entity.too.large' ? 413
        : erro.status === 404 ? 404 : 500;
    // Não expor corpo recebido, query string, stack ou caminho do servidor.
    res.status(status).json({ ok: false, data: null,
        erro: status === 400 ? 'JSON inválido.' : status === 413 ? 'Requisição muito grande.' : 'Não foi possível atender à solicitação.' });
});

const HOST = process.env.NODE_ENV === 'test'
    ? '127.0.0.1'
    : '0.0.0.0';

if (require.main === module) {
    app.listen(PORTA, HOST, () => {
        console.log(`Servidor rodando em http://${HOST}:${PORTA}`);
    });
}
module.exports = app;
