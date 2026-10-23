'use strict';
class ErroHttp extends Error { constructor(status, mensagem) { super(mensagem); this.status = status; } }
const exigir = (condicao, mensagem, status = 422) => { if (!condicao) throw new ErroHttp(status, mensagem); };
function texto(v, nome, max, obrigatorio = false) {
    exigir(v == null || typeof v === 'string', `Revise ${nome}.`);
    const s = (v ?? '').trim(); exigir(s.length <= max && (!obrigatorio || s.length > 0), `Revise ${nome}.`); return s;
}
function inteiro(v, nome, min = 0, max = 2147483647) { exigir(Number.isSafeInteger(v) && v >= min && v <= max, `Revise ${nome}.`); return v; }
function id(v) { exigir(typeof v === 'string' && /^[1-9]\d{0,9}$/.test(v) && Number(v) <= 4294967295, 'Identificador inválido.'); return v; }
function opcao(v, valores, nome) { exigir(valores.includes(v), `Revise ${nome}.`); return v; }
function booleano(v, nome) { exigir(typeof v === 'boolean', `Revise ${nome}.`); return v ? 1 : 0; }
function url(v, nome) {
    const s = texto(v, nome, 2048); if (!s) return '';
    let u; try { u = new URL(s); } catch { throw new ErroHttp(422, `Revise ${nome}.`); }
    exigir(['https:','http:'].includes(u.protocol) && !u.username && !u.password, `Revise ${nome}.`); return u.href;
}
function paragrafos(v) { exigir(Array.isArray(v) && v.length > 0 && v.length <= 100, 'Informe os parágrafos.'); return v.map(p => texto(p, 'parágrafo', 10000, true)); }
const formatador = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function local(v) { return v ? formatador.format(new Date(v)).replace(' ', 'T') : ''; }
function data(v, nome, obrigatoria = false) {
    const s = texto(v, nome, 16, obrigatoria); if (!s) return null;
    exigir(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s), `Revise ${nome}.`);
    const bruto = Date.parse(s + ':00Z'); exigir(Number.isFinite(bruto), `Revise ${nome}.`);
    const offsets = new Set([-36,0,36].map(h => { const t = bruto + h * 3600000; return Date.parse(local(new Date(t)) + ':00Z') - t; }));
    const candidatos = [...offsets].map(o => new Date(bruto - o)).filter(d => local(d) === s);
    exigir(candidatos.length === 1, `${nome}: horário inválido ou ambíguo.`); return candidatos[0];
}
function preco(v) {
    const s = typeof v === 'number' && Number.isFinite(v) ? String(v) : v;
    exigir(typeof s === 'string' && /^\d{1,8}(?:\.\d{1,2})?$/.test(s), 'Preço inválido (use até duas casas decimais).');
    const [reais, centavos = ''] = s.split('.'); return `${reais}.${centavos.padEnd(2,'0')}`;
}
function erro(res, e) {
    if (e instanceof ErroHttp) return res.status(e.status).json({ok:false,data:null,mensagem:e.message});
    if (['ER_DUP_ENTRY','ER_ROW_IS_REFERENCED_2','ER_NO_REFERENCED_ROW_2','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(e.code)) return res.status(409).json({ok:false,data:null,mensagem:'Registro duplicado, em uso ou modificado por outra operação. Atualize a lista.'});
    console.error('Falha interna em operação de conteúdo.'); return res.status(500).json({ok:false,data:null});
}
module.exports = {ErroHttp,exigir,texto,inteiro,id,opcao,booleano,url,paragrafos,local,data,preco,erro};
