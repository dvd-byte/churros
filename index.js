"use strict";

/* Tempos em milissegundos. Ajuste aqui para mudar a duração de cada slide. */
const TEMPO_HERO = 8000;
const TEMPO_NOVIDADES = 6000;

/**
 * Um único relógio controla a troca e a barra de progresso.
 * A aba oculta preserva o tempo; a navegação manual reinicia o intervalo.
 * Hero não depende de controles nem pausa ao passar o mouse.
 */
function iniciarCarrossel({ raiz, total, duracao, mostrar, barra, controles, pausarNaLeitura = false }) {
    if (!raiz || total < 1) return;
    const anterior = controles?.querySelector("[data-anterior]");
    const proximo = controles?.querySelector("[data-proximo]");
    let indice = 0;
    let decorrido = 0;
    let ultimoTempo = null;
    let quadro = null;
    let ponteiroDentro = false;
    let lendoLink = false;

    const atualizarBarra = () => {
        if (barra) barra.style.width = Math.min(100, decorrido / duracao * 100) + "%";
    };
    const podeRodar = () => total > 1 && !ponteiroDentro && !lendoLink && !document.hidden;
    const trocar = (passo) => {
        indice = (indice + passo + total) % total;
        decorrido = 0;
        ultimoTempo = null;
        mostrar(indice);
        atualizarBarra();
    };
    const animar = (agora) => {
        quadro = null;
        if (!podeRodar()) { ultimoTempo = null; return; }
        // Mantém 100% por um quadro antes de reiniciar no próximo slide.
        if (decorrido >= duracao) trocar(1);
        if (ultimoTempo !== null) decorrido += agora - ultimoTempo;
        ultimoTempo = agora;
        // Hero não tem barra: pode trocar já no quadro que completa 8 segundos.
        if (!barra && decorrido >= duracao) {
            trocar(1);
            ultimoTempo = agora;
        }
        atualizarBarra();
        quadro = requestAnimationFrame(animar);
    };
    const sincronizar = () => {
        if (quadro !== null) cancelAnimationFrame(quadro);
        quadro = null;
        ultimoTempo = null;
        if (podeRodar()) quadro = requestAnimationFrame(animar);
    };

    anterior?.addEventListener("click", () => { trocar(-1); sincronizar(); });
    proximo?.addEventListener("click", () => { trocar(1); sincronizar(); });
    raiz.addEventListener("pointerenter", (evento) => {
        if (!pausarNaLeitura || evento.pointerType !== "mouse") return;
        ponteiroDentro = true;
        sincronizar();
    });
    raiz.addEventListener("pointerleave", () => {
        if (!pausarNaLeitura) return;
        ponteiroDentro = false;
        sincronizar();
    });
    raiz.addEventListener("focusin", (evento) => {
        if (!pausarNaLeitura) return;
        lendoLink = Boolean(evento.target.closest("a"));
        sincronizar();
    });
    raiz.addEventListener("focusout", (evento) => {
        if (!pausarNaLeitura) return;
        lendoLink = Boolean(evento.relatedTarget && raiz.contains(evento.relatedTarget)
            && evento.relatedTarget.closest("a"));
        sincronizar();
    });
    document.addEventListener("visibilitychange", sincronizar);
    mostrar(indice);
    atualizarBarra();
    if (controles) controles.hidden = total < 2;
    sincronizar();
}

(() => {
    const navInicio = document.querySelector(".paginaInicio nav");
    if (navInicio) {
        const atualizarNav = () => navInicio.classList.toggle("navVisivel", window.scrollY >= 100);
        atualizarNav();
        document.body.classList.add("navPorRolagem");
        window.addEventListener("scroll", atualizarNav, { passive: true });
        window.addEventListener("pageshow", atualizarNav);
    }
    const hero = document.querySelector(".hero");
    if (hero) {
        const imagens = ["images/pastel.png", "images/hamburguer.png", "images/churros.png"];
        const imagensMoveis = ["images/churroscelular.png", "images/hamburguercelular.jpg", "images/pastelcelular.png"];
        const telaMovel = window.matchMedia("(width < 600px)");
        let indiceAtual = 0;
        [...imagens, ...imagensMoveis].forEach((caminho) => { const imagem = new Image(); imagem.src = caminho; });
        const configuracaoHero = {
            raiz: hero,
            total: imagens.length,
            duracao: TEMPO_HERO,
            mostrar: (indice) => {
                indiceAtual = indice;
                const anterior = getComputedStyle(hero).backgroundImage;
                hero.querySelector(".heroTransicao")?.remove();
                const conjunto = telaMovel.matches ? imagensMoveis : imagens;
                hero.style.setProperty("--imagemHero", 'url("' + conjunto[indice] + '")');
                if (anterior === getComputedStyle(hero).backgroundImage ||
                    window.matchMedia("(prefers-reduced-motion: reduce)").matches || !hero.animate) return;
                const camada = document.createElement("div");
                camada.className = "heroTransicao";
                camada.setAttribute("aria-hidden", "true");
                camada.style.backgroundImage = anterior;
                hero.prepend(camada);
                const animacao = camada.animate([{ opacity: 1 }, { opacity: 0 }], {
                    duration: 650, easing: "ease-in-out", fill: "forwards"
                });
                animacao.finished.then(() => camada.remove(), () => camada.remove());
            }
        };
        iniciarCarrossel(configuracaoHero);
        telaMovel.addEventListener("change", () => configuracaoHero.mostrar(indiceAtual));
    }

    const carrossel = document.querySelector(".novidades .carrossel");
    const posts = Array.isArray(window.postsBlog) ? window.postsBlog.slice(0, 3) : [];
    if (carrossel && posts.length) {
        posts.forEach((post) => { const imagem = new Image(); imagem.src = post.imagem; });
        iniciarCarrossel({
            raiz: carrossel,
            total: posts.length,
            duracao: TEMPO_NOVIDADES,
            controles: carrossel.querySelector(".indicadores"),
            pausarNaLeitura: true,
            barra: carrossel.querySelector(".progresso span"),
            mostrar: (indice) => {
                const post = posts[indice];
                carrossel.querySelector(".textoEtiqueta").textContent = post.categoria;
                carrossel.querySelector("h2").textContent = post.titulo;
                carrossel.querySelector(".conteudoCarrossel p").textContent = post.resumo;
                const imagem = carrossel.querySelector(".imagemCarrossel img");
                imagem.src = post.imagem;
                imagem.alt = post.alt;
                carrossel.querySelector(".tipoCarrossel").textContent = post.categoria;
                carrossel.querySelector(".botaoPromocao").href = "paginas/blog.html#" + encodeURIComponent(post.id);
                carrossel.querySelector(".marcador").textContent = (indice + 1) + " / " + posts.length;
            }
        });
    }

    document.getElementById("btn1")?.addEventListener("click", () => {
        window.location.hash = "novidades";
    });
    document.getElementById("btnCardapioHero")?.addEventListener("click", () => {
        window.location.href = "paginas/cardapio.html";
    });
})();

