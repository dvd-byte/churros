/* Busca e filtros do Cardápio. */"use strict";

const busca = document.getElementById("buscaCardapio");
const filtro = document.getElementById("filtroCategoria");
if (busca && filtro) {
    const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const resultado = document.getElementById("resultadoBusca");
    const semResultados = document.getElementById("semResultados");
    document.querySelector(".ferramentasCardapio").hidden = false;

    const filtrar = () => {
        const secoes = [...document.querySelectorAll("[data-categoria]")];
        const termos = normalizar(busca.value.trim()).split(/\s+/).filter(Boolean);
        let total = 0;
        secoes.forEach((secao) => {
            let totalSecao = 0;
            secao.querySelectorAll(".grupoProdutos").forEach((grupo) => {
                let totalGrupo = 0;
                grupo.querySelectorAll("[data-busca]").forEach((produto) => {
                    const texto = normalizar(produto.dataset.busca);
                    const visivel = (!filtro.value || filtro.value === secao.dataset.categoria)
                        && termos.every((termo) => texto.includes(termo));
                    produto.hidden = !visivel;
                    if (visivel) totalGrupo++;
                });
                grupo.hidden = totalGrupo === 0;
                totalSecao += totalGrupo;
            });
            secao.hidden = totalSecao === 0;
            total += totalSecao;
        });
        resultado.textContent = total === 1 ? "1 opção encontrada." : total + " opções encontradas.";
        semResultados.hidden = total > 0;
    };
    busca.addEventListener("input", filtrar);
    filtro.addEventListener("change", filtrar);
    document.getElementById("limparBusca").addEventListener("click", () => {
        busca.value = "";
        filtro.value = "";
        filtrar();
        busca.focus();
    });
    document.querySelectorAll(".atalhoCategoria").forEach((link) => {
        link.addEventListener("click", () => {
            busca.value = "";
            filtro.value = "";
            filtrar();
        });
    });
    filtrar();
    document.addEventListener('catalogo:atualizado',filtrar);
    document.querySelector('.categoriasVitrine').addEventListener('click',e=>{if(e.target.closest('.atalhoCategoria')){busca.value='';filtro.value='';filtrar();}});
}
