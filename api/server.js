
const express = require('express');
const pool = require('./database');
const cookieParser = require('cookie-parser');
const rotasAdmin = require('./rotas-admin');
const path = require('node:path');

const app = express();
const PORTA = process.env.PORT || 3000;


app.use(express.json());
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
    const arquivo = req.path === '/'
        ? 'index.html'
        : req.path.slice(1);

    if (!arquivosPublicosAdmin.has(arquivo)) {
        return res.sendStatus(404);
    }

    res.sendFile(path.join(pastaAdmin, arquivo));
});

app.use((req, res, next) => {
    console.log('Requisição recebida:', req.method, req.url);
    next();
});

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
            WHERE c.ativa = 1
              AND g.ativo = 1
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

        res.status(500).json({
            erro: 'Não foi possível consultar os produtos.'
        });
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
});


console.log(
    'Rotas registradas:',
    app.router.stack
        .filter((camada) => camada.route)
        .map((camada) => camada.route.path)
);

const HOST = process.env.NODE_ENV === 'test'
    ? '127.0.0.1'
    : '0.0.0.0';

app.listen(PORTA, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORTA}`);
});