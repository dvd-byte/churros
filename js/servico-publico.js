/* Consultas públicas; coleta de CPF e resgates continuam desativados. */
"use strict";
(() => {
    const ATIVADO = !window.conteudoCasa.demo;
    if (!ATIVADO) return;
    document.querySelector('.moldeGaleria')?.remove();
    const base = new URL("../api/public/", document.currentScript.src);
    async function request(path, data) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(new URL(path, base), { method: data ? "POST" : "GET", credentials: "omit", cache: "no-store", headers: { Accept: "application/json", ...(data ? { "Content-Type": "application/json" } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: controller.signal });
            if (!response.ok) throw new Error("Serviço indisponível");
            const result = await response.json();
            if (result?.ok !== true) throw new Error("Resposta inválida");
            return result.data;
        } finally { clearTimeout(timeout); }
    }
    if (window.exibirFotosGaleria) {
        const estado = document.getElementById("estadoGaleria");
        request("galeria").then(data => {
            if (!Array.isArray(data?.items)) throw new Error("Resposta inválida");
            window.exibirFotosGaleria(data.items);
        }).catch(() => {
            if (estado) { estado.hidden = false; document.getElementById("tituloEstadoGaleria").textContent = "Fotos temporariamente indisponíveis"; document.getElementById("textoEstadoGaleria").textContent = "Não foi possível consultar a galeria. Tente novamente mais tarde."; }
        });
    }
    if (window.promocoesCasa) request('cupons').then(data=>{
        if(!Array.isArray(data?.items))throw new Error('Resposta inválida');
        window.promocoesCasa.exibir(data.items);
    }).catch(()=>{const estado=document.getElementById('estadoCupons');estado.hidden=false;estado.textContent='Promoções temporariamente indisponíveis.';});
})();
