/* Interface de apresentação. Nenhum backend, armazenamento ou endpoint é simulado.
 * A integração futura deve chamar promocoesCasa.conectar(servico) em HTTPS.
 * Consulte INTEGRACAO-PROMOCOES.md para o contrato e responsabilidades do servidor.
 */
"use strict";
(() => {
    const porId = id => document.getElementById(id);
    const grade = porId("gradeCupons"), estado = porId("estadoCupons");
    const dialogo = porId("resgateCupom"), formulario = porId("formResgate");
    const cpf = porId("cpfResgate"), enviar = porId("enviarResgate");
    const mensagem = porId("mensagemResgate"), resultado = porId("resultadoResgate");
    if (!grade || !dialogo) return;
    let servico = null, selecionado = null, ocupado = false, versao = 0;
    const plataformas = { ifood: "iFood", "99food": "99 Food", ambas: "iFood e 99 Food" };
    const estados = { ativo: "Ativo", expirado: "Expirado", esgotado: "Esgotado", indisponivel: "Indisponível" };
    const texto = (tag, valor, classe) => {
        const el = document.createElement(tag);
        el.textContent = valor;
        if (classe) el.className = classe;
        return el;
    };
    function cpfValido(valor) {
        const entrada = valor.trim();
        if (!/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(entrada)) return false;
        const numeros = entrada.replace(/\D/g, "");
        if (/^(\d)\1{10}$/.test(numeros)) return false;
        for (let tamanho = 9; tamanho <= 10; tamanho++) {
            let soma = 0;
            for (let i = 0; i < tamanho; i++) soma += Number(numeros[i]) * (tamanho + 1 - i);
            const digito = (soma * 10) % 11 % 10;
            if (digito !== Number(numeros[tamanho])) return false;
        }
        return true;
    }
    function situacao(cupom) {
        if (!plataformas[cupom.plataforma]) return "indisponivel";
        if (cupom.validade && (!Number.isFinite(Date.parse(cupom.validade)) ||
            !/(Z|[+-]\d{2}:\d{2})$/.test(cupom.validade))) return "indisponivel";
        if (cupom.validade && Date.parse(cupom.validade) <= Date.now()) return "expirado";
        return estados[cupom.status] ? cupom.status : "indisponivel";
    }
    function avisar(valor, erro = false) {
        mensagem.textContent = valor;
        mensagem.dataset.estado = erro ? "erro" : "informacao";
    }
    function abrir(cupom) {
        selecionado = cupom;
        formulario.reset();
        cpf.removeAttribute("aria-invalid");
        resultado.replaceChildren();
        resultado.hidden = true;
        porId("tituloResgate").textContent = cupom.nome;
        const disponivel = !!servico && situacao(cupom) === "ativo";
        cpf.disabled = !disponivel;
        enviar.disabled = !disponivel;
        avisar(disponivel ? "Informe seu CPF para solicitar o resgate." :
            situacao(cupom) !== "ativo" ? "Este cupom não está disponível para resgate." :
                "O resgate ainda não está disponível. Nenhum CPF será solicitado até a integração do serviço.");
        dialogo.showModal();
    }
    function exibir(cupons = []) {
        grade.replaceChildren();
        const ids = new Set();
        for (const cupom of Array.isArray(cupons) ? cupons : []) {
            if (!cupom || typeof cupom.id !== "string" || !cupom.id.trim() || ids.has(cupom.id) ||
                typeof cupom.nome !== "string" || !cupom.nome.trim()) continue;
            ids.add(cupom.id);
            const card = texto("article", "", "cardInstitucional cardCupom");
            const status = situacao(cupom);
            card.append(texto("span", plataformas[cupom.plataforma] || "Plataforma não informada", "subtitulo"),
                texto("h3", cupom.nome), texto("span", estados[status], "statusCupom"));
            if (typeof cupom.descricao === "string") card.append(texto("p", cupom.descricao));
            if (cupom.validade && status !== "indisponivel") card.append(texto("p", "Válido até " +
                new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
                    .format(new Date(cupom.validade)) + " (horário de São Paulo)."));
            if (typeof cupom.condicoes === "string") card.append(texto("p", cupom.condicoes));
            // Código não pertence à listagem pública: apenas à resposta de resgate confirmado.
            const botao = texto("button", status === "ativo" ? "Solicitar resgate" : "Cupom indisponível", "linkPill");
            botao.type = "button";
            botao.disabled = status !== "ativo";
            botao.addEventListener("click", () => abrir(cupom));
            card.append(botao);
            grade.append(card);
        }
        grade.hidden = !grade.childElementCount;
        estado.hidden = !!grade.childElementCount;
        estado.textContent = "Ainda não há cupons disponíveis. Quando a loja publicar novas promoções, elas aparecerão aqui.";
    }
    async function carregar() {
        if (!servico) { exibir(); return; }
        const atual = ++versao;
        grade.hidden = true;
        estado.hidden = false;
        estado.textContent = "Carregando promoções…";
        grade.setAttribute("aria-busy", "true");
        try {
            const cupons = await servico.listar();
            if (atual !== versao) return;
            if (!Array.isArray(cupons)) throw new Error("Resposta inválida");
            exibir(cupons);
        } catch {
            if (atual !== versao) return;
            estado.textContent = "Não foi possível carregar as promoções. Tente novamente mais tarde.";
        } finally {
            if (atual === versao) grade.setAttribute("aria-busy", "false");
        }
    }
    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (ocupado) return;
        if (!servico || !selecionado || situacao(selecionado) !== "ativo") {
            cpf.value = "";
            avisar("O resgate deste cupom está indisponível.", true);
            return;
        }
        if (!cpfValido(cpf.value)) {
            cpf.setAttribute("aria-invalid", "true");
            avisar("Informe um CPF válido, com 11 dígitos. Confira os números digitados.", true);
            cpf.focus();
            return;
        }
        cpf.removeAttribute("aria-invalid");
        ocupado = true;
        enviar.disabled = true;
        cpf.disabled = true;
        porId("fecharResgate").disabled = true;
        formulario.setAttribute("aria-busy", "true");
        avisar("Aguardando confirmação do resgate…");
        let pedido = { cupomId: selecionado.id, cpf: cpf.value.replace(/\D/g, "") };
        cpf.value = "";
        let confirmado = false;
        try {
            const promessa = servico.resgatar(pedido);
            pedido = null;
            const resposta = await promessa;
            if (resposta?.status === "confirmado" && resposta.cupomId === selecionado.id &&
                typeof resposta.resgateId === "string" && resposta.resgateId.trim() &&
                typeof resposta.codigo === "string" && resposta.codigo.trim()) {
                confirmado = true;
                resultado.append(texto("p", "Código do cupom:"), texto("code", resposta.codigo));
                resultado.hidden = false;
                avisar("Resgate confirmado pelo serviço. Use o código na plataforma indicada, respeitando as condições do cupom.");
            } else {
                const erros = {
                    ja_resgatado: "Este CPF já resgatou este cupom.",
                    indisponivel: "Este cupom não está mais disponível.",
                    cpf_invalido: "O serviço não aceitou o CPF informado. Confira os números."
                };
                avisar(erros[resposta?.status] || "Não foi possível confirmar o resgate. Tente novamente mais tarde.", true);
            }
        } catch {
            avisar("Não foi possível confirmar o resgate. Verifique sua conexão e tente novamente mais tarde.", true);
        } finally {
            pedido = null;
            ocupado = false;
            cpf.value = "";
            cpf.disabled = confirmado;
            enviar.disabled = confirmado;
            porId("fecharResgate").disabled = false;
            formulario.setAttribute("aria-busy", "false");
        }
    });
    porId("fecharResgate").addEventListener("click", () => dialogo.close());
    dialogo.addEventListener("cancel", evento => { if (ocupado) evento.preventDefault(); });
    dialogo.addEventListener("close", () => {
        formulario.reset(); cpf.value = ""; selecionado = null;
        resultado.replaceChildren(); resultado.hidden = true;
    });
    window.addEventListener("pagehide", () => { cpf.value = ""; });
    window.promocoesCasa = Object.freeze({
        exibir,
        cpfValido,
        carregar,
        conectar(novoServico) {
            if (ocupado || dialogo.open) throw new Error("Feche o formulário antes de configurar o serviço.");
            if (window.location.protocol !== "https:" || typeof novoServico?.listar !== "function" ||
                typeof novoServico?.resgatar !== "function") throw new Error("Integração requer HTTPS e serviço completo.");
            servico = novoServico;
            porId("avisoIntegracao").textContent = "Solicite o resgate e aguarde a confirmação do serviço. Use o código apenas na plataforma indicada, conforme as condições da promoção.";
            return carregar();
        }
    });
    exibir();
})();
