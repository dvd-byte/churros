/* Contrato HTTP real. Não contém credenciais, dados demonstrativos ou persistência local. */
"use strict";
window.apiAdmin = (() => {
    const base = new URL("../api/admin/", document.currentScript.src);
    let csrf = "";
    async function request(path, { method = "GET", data, signal } = {}) {
        const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
        if (location.protocol !== "https:" && !(local && location.protocol === "http:")) throw new Error("Abra por HTTPS ou servidor local. O painel não funciona por file://.");
        const headers = { Accept: "application/json" };
        const escrita = method !== "GET";
        if (escrita && path !== "login" && !csrf) throw new Error("Sessão administrativa indisponível.");
        if (escrita && csrf) headers["X-CSRF-Token"] = csrf;
        const multipart = data instanceof FormData;
        if (data && !multipart) headers["Content-Type"] = "application/json";
        let response;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const abort = () => controller.abort();
        signal?.addEventListener("abort", abort, { once: true });
        try {
            response = await fetch(new URL(path, base), { method, headers, credentials: "same-origin", cache: "no-store", signal: controller.signal, body: data ? (multipart ? data : JSON.stringify(data)) : undefined });
        } catch { throw new Error("Não foi possível acessar o serviço. Em caso de gravação, confira a lista antes de tentar novamente."); }
        finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
        if (response.status === 401) { csrf = ""; window.dispatchEvent(new Event("admin:expirou")); throw new Error("Sessão encerrada. Entre novamente."); }
        if (!response.ok) throw new Error(({403:"Ação não autorizada.",404:"Serviço ainda não disponível.",409:"Este registro mudou ou ainda está em uso. Atualize a lista.",413:"Arquivo muito grande.",422:"Revise os campos informados.",429:"Muitas tentativas. Aguarde antes de tentar novamente."})[response.status] || "O servidor não confirmou a operação.");
        let result;
        try { result = await response.json(); } catch { throw new Error("Resposta inválida do serviço."); }
        if (result?.ok !== true) throw new Error("O serviço não confirmou a operação.");
        return result.data;
    }
    async function session() {
        const data = await request("session");
        if (!data?.user?.id || !Array.isArray(data.user.permissions) || typeof data.csrfToken !== "string" || !data.csrfToken) throw new Error("Sessão inválida.");
        csrf = data.csrfToken;
        return data.user;
    }
    return Object.freeze({ request, session, clear: () => { csrf = ""; } });
})();
