/* Renderiza os posts da fonte compartilhada e abre o artigo indicado pelo link. */
"use strict";
(() => {
    const lista = document.querySelector(".listaPosts");
    if (!lista || !Array.isArray(window.postsBlog)) return;

    const criar = (tag, classe, texto) => {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto) elemento.textContent = texto;
        return elemento;
    };
    const fragmento = document.createDocumentFragment();
    window.postsBlog.forEach((post, indice) => {
        const artigo = criar("article", indice === 0 ? "postagem postagemPrincipal" : "postagem");
        artigo.id = post.id;
        const imagem = criar("img");
        imagem.src = post.imagem;
        imagem.alt = post.alt;
        imagem.loading = "lazy";
        const texto = criar("div", "textoPost");
        texto.append(criar("span", "subtitulo", post.categoria),
            criar("h2", "", post.titulo), criar("p", "", post.resumo));
        const detalhes = criar("details");
        const resumo = criar("summary", "", "Continuar lendo ");
        const seta = criar("span", "", "↗");
        seta.setAttribute("aria-hidden", "true");
        resumo.append(seta);
        const corpo = criar("div", "corpoPost");
        post.paragrafos.forEach((paragrafo) => corpo.append(criar("p", "", paragrafo)));
        const link = criar("a", "", post.textoLink);
        link.href = post.link;
        if (post.link.startsWith("https://")) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        }
        corpo.append(link);
        detalhes.append(resumo, corpo);
        texto.append(detalhes);
        artigo.append(imagem, texto);
        fragmento.append(artigo);
    });
    lista.replaceChildren(fragmento);
    const total = document.querySelector(".totalPosts");
    if (total) total.textContent = window.postsBlog.length + " postagens";

    const abrirPostIndicado = () => {
        let id;
        try { id = decodeURIComponent(window.location.hash.slice(1)); }
        catch { return; }
        const artigo = document.getElementById(id);
        if (!artigo?.matches(".postagem")) return;
        const detalhes = artigo.querySelector("details");
        if (detalhes) detalhes.open = true;
        artigo.scrollIntoView({ block: "start", behavior: "instant" });
    };
    window.addEventListener("hashchange", abrirPostIndicado);
    abrirPostIndicado();
})();

