'use strict';

const express = require('express');
const pool = require('./database');
const router = express.Router();

function linkPublico(valor) {
    if (typeof valor !== 'string' || !valor) return '';
    try {
        const url = new URL(valor);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}

router.get('/loja', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let c;
    try {
        c = await pool.getConnection();
        // Uma fotografia consistente da loja e de seus horários durante edições.
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        const [loja] = await c.query(`SELECT nome, telefone, endereco,
            link_ifood, link_99food, instagram_url, whatsapp_url, mapa_url,
            historia_json, alt_sobre, imagem_sobre_id, id
            FROM loja WHERE loja_unica = 1 AND publicada = 1 LIMIT 1`);
        if (!loja) {
            await c.rollback();
            return res.status(404).json({ok: false, data: null});
        }
        const historia = Array.isArray(loja.historia_json)
            ? loja.historia_json : JSON.parse(loja.historia_json ?? '[]');
        if (!Array.isArray(historia) || historia.some(p => typeof p !== 'string')) throw new Error('Conteudo invalido');
        const horarios = await c.query(`SELECT dia_semana, hora_abertura, hora_fechamento, fechado
            FROM horarios_semanais WHERE loja_id = ? ORDER BY dia_semana`, [loja.id]);
        const midias = loja.imagem_sobre_id == null ? [] : await c.query(
            'SELECT caminho_arquivo FROM midias WHERE id = ?', [loja.imagem_sobre_id]);
        await c.commit();
        const imagem = midias[0]?.caminho_arquivo ?? '';
        // Apenas arquivos da pasta pública já servida pela API.
        const imagemSobre = /^(?:\/)?(?:images|uploads)\/(?:[\w-]+\/)*[\w.-]+\.(?:png|jpe?g|webp|avif)$/i.test(imagem)
            && !imagem.includes('..') ? '/' + imagem.replace(/^\//, '') : '';
        return res.json({ok: true, data: {
            nome: loja.nome, endereco: loja.endereco ?? '', telefone: loja.telefone ?? '',
            ifood: linkPublico(loja.link_ifood), food99: linkPublico(loja.link_99food),
            instagram: linkPublico(loja.instagram_url), whatsapp: linkPublico(loja.whatsapp_url),
            mapa: linkPublico(loja.mapa_url), historia, imagemSobre, altSobre: loja.alt_sobre ?? '',
            fuso: 'America/Sao_Paulo',
            horarios: horarios.map(h => ({dia: Number(h.dia_semana), fechado: Number(h.fechado) !== 0,
                abertura: h.hora_abertura == null ? null : String(h.hora_abertura),
                fechamento: h.hora_fechamento == null ? null : String(h.hora_fechamento)}))
        }});
    } catch {
        if (c) { try { await c.rollback(); } catch {} }
        console.error('Falha na consulta publica da loja.');
        return res.status(503).json({ok: false, data: null});
    } finally { if (c) c.release(); }
});

router.use(require('./rotas-catalogo'));
module.exports = router;
