/* Apresentação da galeria. O painel e a persistência ainda não foram implementados.
 * A futura integração deve fornecer fotos reais e chamar exibirFotosGaleria(fotos).
 * Contrato de apresentação (não é uma API existente):
 * [{ src: caminho relativo à raiz do site ou URL HTTPS, alt: descrição, legenda: opcional }]
 */
"use strict";
(() => {
    const grade = document.getElementById("gradeGaleria");
    const estado = document.getElementById("estadoGaleria");
    const titulo = document.getElementById("tituloEstadoGaleria");
    const texto = document.getElementById("textoEstadoGaleria");
    if (!grade || !estado || !titulo || !texto) return;
    const raizSite = new URL("../", document.currentScript.src);
    let versao = 0;

    window.exibirFotosGaleria = (fotos = []) => {
        const versaoAtual = ++versao;
        grade.replaceChildren();
        titulo.textContent = "Ainda não há fotos por aqui";
        texto.textContent = "As fotos da Churros em Casa ainda não estão disponíveis nesta página. Enquanto isso, você pode visitar nosso Instagram.";
        const itens = Array.isArray(fotos) ? fotos : [];
        for (const foto of itens) {
            if (!foto || typeof foto.src !== "string" || !foto.src.trim()
                || typeof foto.alt !== "string" || !foto.alt.trim()) continue;
            let url;
            try { url = new URL(foto.src, raizSite); } catch { continue; }
            const permitido = url.protocol === "https:" ||
                (url.protocol === "http:" && url.origin === raizSite.origin) ||
                (raizSite.protocol === "file:" && url.protocol === "file:");
            if (!permitido) continue;
            const figura = document.createElement("figure");
            figura.className = "fotoGaleria";
            const link = document.createElement("a");
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.setAttribute("aria-label", "Abrir foto: " + foto.alt.trim() + " (nova aba)");
            const imagem = document.createElement("img");
            imagem.src = url.href;
            imagem.alt = foto.alt.trim();
            imagem.loading = "lazy";
            imagem.decoding = "async";
            imagem.addEventListener("error", () => {
                if (versaoAtual !== versao) return;
                figura.remove();
                if (!grade.childElementCount) {
                    grade.hidden = true;
                    estado.hidden = false;
                    titulo.textContent = "Não foi possível carregar as fotos";
                    texto.textContent = "Tente novamente mais tarde. Você também pode visitar o Instagram da loja.";
                }
            });
            link.append(imagem);
            figura.append(link);
            if (typeof foto.legenda === "string" && foto.legenda.trim()) {
                const legenda = document.createElement("figcaption");
                legenda.textContent = foto.legenda.trim();
                figura.append(legenda);
            }
            grade.append(figura);
        }
        const quantidade = grade.childElementCount;
        grade.hidden = quantidade === 0;
        estado.hidden = quantidade > 0;
        return quantidade;
    };
    // CADASTRE SUAS FOTOS AQUI. Os caminhos são relativos à raiz do site.
    // Salve cada arquivo em images/ e copie um objeto para cada foto real.
    // Exemplo de formato (comentado: não carrega um arquivo inexistente):
    // { src: "images/NOME-DO-ARQUIVO.jpg", alt: "Descrição da foto", legenda: "Legenda opcional" },
    const fotosGaleria = [
    ];
    window.exibirFotosGaleria(fotosGaleria);
})();

