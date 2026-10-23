/* Fonte compartilhada de Loja. Em file://, conserva a demonstração do HTML. */
'use strict';
(() => {
    if (location.protocol === 'file:') return;
    const raiz = new URL('../', document.currentScript.src);
    const aviso = document.createElement('p');
    aviso.className = 'avisoLoja';
    aviso.setAttribute('role', 'status');
    aviso.textContent = 'Consultando informações da loja…';
    document.querySelector('main')?.prepend(aviso);
    const elementos = () => document.querySelectorAll('[data-loja], [data-loja-link], [data-loja-horarios], [data-loja-historia], [data-loja-foto], [data-loja-copyright], #mapaLoja');
    // Evita apresentar contatos antigos como dados atuais enquanto a consulta falha.
    const ocultar = () => elementos().forEach(el => { el.hidden = true; });
    ocultar();
    function urlSegura(valor) {
        try {
            const u = new URL(valor);
            return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : '';
        } catch { return ''; }
    }
    function preencher(dados) {
        document.querySelectorAll('[data-loja]').forEach(el => {
            const campo = el.dataset.loja;
            const valor = campo === 'instagramNome' ? perfil(dados.instagram)
                : campo === 'telefone' && dados.whatsapp ? dados.telefone || 'WhatsApp' : dados[campo];
            el.textContent = valor || '';
            el.hidden = !valor;
        });
        document.querySelectorAll('[data-loja-link]').forEach(el => {
            const campo = el.dataset.lojaLink;
            const valor = campo === 'endereco' && dados.endereco
                ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dados.endereco)
                : dados[campo];
            const url = urlSegura(valor);
            el.hidden = !url;
            if (url) el.href = url;
            else el.removeAttribute('href');
            if (el.hasAttribute('aria-label') && ['instagram', 'whatsapp'].includes(campo)) {
                el.setAttribute('aria-label', campo === 'instagram' ? 'Visitar Instagram (abre em outra aba)' : 'Conversar pelo WhatsApp (abre em outra aba)');
            }
        });
        document.querySelectorAll('[data-loja-historia]').forEach(el => {
            el.replaceChildren(...dados.historia.map(texto => {
                const p = document.createElement('p'); p.textContent = texto; return p;
            }));
            el.hidden = false;
        });
        document.querySelectorAll('[data-loja-horarios]').forEach(el => {
            const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
            el.replaceChildren(...dados.horarios.map(h => {
                const p = document.createElement('p');
                p.textContent = `${dias[h.dia - 1]}: ${h.fechado ? 'fechado' : h.abertura.slice(0,5) + ' às ' + h.fechamento.slice(0,5)}`;
                return p;
            }));
            if (!dados.horarios.length) {
                const p = document.createElement('p'); p.textContent = 'Horários ainda não informados.'; el.append(p);
            }
            el.hidden = false;
        });
        document.querySelectorAll('[data-loja-foto]').forEach(el => {
            const src = dados.imagemSobre;
            el.replaceChildren();
            if (/^\/images\/(?:[\w-]+\/)*[\w.-]+\.(?:png|jpe?g|webp|avif)$/i.test(src) && !src.includes('..')) {
                const img = document.createElement('img'); img.src = new URL(src, raiz); img.alt = dados.altSobre || '';
                img.loading = 'lazy'; el.append(img); el.hidden = false;
            } else {
                const p = document.createElement('p'); p.textContent = 'Foto da loja ainda não disponível.';
                el.append(p); el.hidden = false;
            }
        });
        const mapa = document.querySelector('#mapaLoja');
        if (mapa) {
            const url = urlSegura(dados.mapa);
            const u = url ? new URL(url) : null;
            const permitido = u && u.protocol === 'https:' && ['www.google.com','maps.google.com','google.com'].includes(u.hostname)
                && (u.pathname === '/maps' || u.pathname.startsWith('/maps/'));
            mapa.replaceChildren();
            if (permitido) {
                const iframe = document.createElement('iframe');
                iframe.src = u.href; iframe.title = 'Localização de ' + dados.nome;
                iframe.loading = 'lazy'; iframe.width = '1200'; iframe.height = '460';
                iframe.referrerPolicy = 'no-referrer'; mapa.append(iframe);
            }
            mapa.hidden = !permitido;
        }
        const copyright = document.querySelector('[data-loja-copyright]');
        if (copyright) {
            copyright.textContent = `© ${new Date().getFullYear()} ${dados.nome}. Todos os direitos reservados.`;
            copyright.hidden = false;
        }
        window.dispatchEvent(new CustomEvent('loja:atualizada', {detail: dados}));
    }
    function perfil(valor) {
        try { return new URL(valor).pathname.split('/').filter(Boolean)[0]?.replace(/^/, '@') || 'Instagram'; }
        catch { return ''; }
    }
    async function carregar() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(new URL('api/public/loja', raiz), {
                credentials: 'omit', cache: 'no-store', headers: {Accept: 'application/json'}, signal: controller.signal
            });
            if (!response.ok) throw new Error('Indisponivel');
            const {ok, data} = await response.json();
            if (ok !== true || typeof data?.nome !== 'string' || !Array.isArray(data.historia)
                || data.historia.some(p => typeof p !== 'string') || !Array.isArray(data.horarios)
                || data.horarios.some(h => !Number.isInteger(h.dia) || h.dia < 1 || h.dia > 7
                    || (!h.fechado && (!/^\d{2}:\d{2}:\d{2}$/.test(h.abertura) || !/^\d{2}:\d{2}:\d{2}$/.test(h.fechamento))))) throw new Error('Resposta invalida');
            preencher(data);
            aviso.hidden = true;
        } catch {
            ocultar();
            document.querySelector('#mapaLoja')?.replaceChildren();
            aviso.hidden = false;
            aviso.textContent = 'Informações da loja temporariamente indisponíveis. Atualize a página para tentar novamente.';
            window.dispatchEvent(new CustomEvent('loja:indisponivel'));
        } finally { clearTimeout(timer); }
    }
    carregar();
    // Reconsulta ao voltar à página, sem compartilhar sessão com o painel.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) carregar(); });
})();
