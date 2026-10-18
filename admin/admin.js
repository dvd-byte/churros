"use strict";
(() => {
    const $ = id => document.getElementById(id);
    const make = (tag, text = "", cls = "") => { const el = document.createElement(tag); el.textContent = text; el.className = cls; return el; };
    const button = (text, action, cls = "secundario") => { const b = make("button", text, cls); b.type = "button"; b.addEventListener("click", action); return b; };
    const field = (key, label, type = "text", required = false, options) => ({ key, label, type, required, options });
    const imageFields = [field("imagem", "Imagem (upload ou caminho)", "image"), field("alt", "Descrição da imagem para acessibilidade")];
    const publication = field("status", "Publicação", "select", true, ["rascunho", "publicado", "inativo"]);
    const order = field("ordem", "Ordem de exibição", "number");
    const schemas = {
        blog: { title: "Blog", singular: "publicação", fields: [field("titulo", "Título", "text", true), field("categoria", "Categoria", "text", true), field("resumo", "Resumo", "textarea", true), field("paragrafos", "Conteúdo (um parágrafo por linha em branco)", "paragraphs", true), ...imageFields, publication, field("publicadoEm", "Data de publicação", "datetime-local"), field("link", "Link complementar"), field("textoLink", "Texto do link")] },
        galeria: { title: "Galeria", singular: "foto", fields: [field("src", "Foto", "image", true), field("alt", "Descrição da foto para acessibilidade", "text", true), field("legenda", "Legenda"), publication, order] },
        categorias: { title: "Categorias", singular: "categoria", fields: [field("nome", "Nome", "text", true), field("slug", "Identificador na URL", "text", true), ...imageFields, publication, order] },
        grupos: { title: "Grupos do cardápio", singular: "grupo", fields: [field("nome", "Nome (ex.: Tradicionais)", "text", true), field("categoriaId", "Categoria", "relation", true, "categorias"), order] },
        produtos: { title: "Cardápio", singular: "produto", fields: [field("nome", "Nome", "text", true), field("descricao", "Descrição", "textarea"), field("grupoId", "Grupo", "relation", true, "grupos"), field("preco", "Preço em reais", "price", true), ...imageFields, field("disponivel", "Disponível", "checkbox"), field("destaque", "Exibir nos destaques da inicial", "checkbox"), publication, order] },
        cupons: { title: "Cupons", singular: "promoção", fields: [field("nome", "Nome", "text", true), field("descricao", "Descrição", "textarea", true), field("plataforma", "Plataformas", "select", true, ["ifood", "99food", "ambas"]), field("codigoIfood", "Código compartilhado do iFood"), field("codigo99", "Código compartilhado da 99 Food"), field("inicio", "Início (horário de São Paulo)", "datetime-local", true), field("validade", "Término (horário de São Paulo)", "datetime-local", true), field("limiteResgates", "Limite de resgates (vazio = sem limite)", "number"), field("condicoes", "Regras e condições", "textarea", true), field("status", "Estado configurado", "select", true, ["rascunho", "ativo", "inativo"])] },
        loja: { title: "Loja", singular: "configuração", singleton: true, fields: [field("nome", "Nome da loja", "text", true), field("endereco", "Endereço completo", "textarea", true), field("telefone", "Telefone de contato", "tel"), field("whatsapp", "Link do WhatsApp", "url"), field("instagram", "Link do Instagram", "url"), field("ifood", "Link do iFood", "url"), field("food99", "Link da 99 Food", "url"), field("mapa", "URL de incorporação do Google Maps", "url"), field("historia", "História da Churros em Casa", "paragraphs", true), field("imagemSobre", "Foto da página Sobre", "image"), field("altSobre", "Descrição da foto da página Sobre"), field("dias", "Dias de funcionamento", "days", true), field("abertura", "Abertura (São Paulo)", "time", true), field("fechamento", "Fechamento (São Paulo)", "time", true)] }
    };
    const navigation = [["dashboard", "Visão geral"], ["graficos", "Gráficos"], ["produtos", "Cardápio"], ["blog", "Blog"], ["galeria", "Galeria"], ["cupons", "Cupons"], ["resgates", "Resgates"], ["loja", "Loja"]];
    let preview = false, user = null, page = "dashboard", period = "7d", generation = 0, editing = null, busy = false;
    const permitted = resource => !preview && user?.permissions.some(p => p === "*" || p === resource + ":write");
    const safeImage = value => { try { const url = new URL(value, new URL("../", location.href)); return url.protocol === "https:" || (url.origin === location.origin && ["http:","file:"].includes(url.protocol)) ? url.href : ""; } catch { return ""; } };
    const notice = text => { $("mensagem").textContent = text; };
    function entrance(text = "Entre com sua conta administrativa.") {
        generation++; user = null; preview = false; window.apiAdmin.clear();
        $("painel").hidden = true; $("entrada").hidden = false; $("conteudo").replaceChildren();
        $("editor").close(); $("campos").replaceChildren(); editing = null;
        $("senha").value = ""; $("loginEstado").textContent = text;
    }
    window.addEventListener("admin:expirou", () => entrance("Sessão expirada. Entre novamente."));
    function enter(isPreview) {
        preview = isPreview; $("entrada").hidden = true; $("painel").hidden = false;
        $("aviso").hidden = !preview; $("sessao").textContent = preview ? "Prévia · sem conexão" : "Proprietário · sessão autenticada";
        $("navegacao").replaceChildren(...navigation.map(([id, title]) => { const a = make("a", title); a.href = "#" + id; return a; }));
        render();
    }
    $("previa").addEventListener("click", () => enter(true));
    $("login").addEventListener("submit", async e => {
        e.preventDefault(); const submit = e.submitter; submit.disabled = true;
        $("loginEstado").textContent = "Validando acesso…";
        try {
            await window.apiAdmin.request("login", { method: "POST", data: { email: $("email").value, senha: $("senha").value } });
            user = await window.apiAdmin.session(); enter(false);
        } catch (error) { $("loginEstado").textContent = error.message; }
        finally { $("senha").value = ""; submit.disabled = false; }
    });
    $("sair").addEventListener("click", async () => {
        if (preview) { entrance(); return; }
        try { await window.apiAdmin.request("logout", { method: "POST" }); entrance("Sessão encerrada pelo servidor."); }
        catch (error) { notice(error.message + " Não foi possível confirmar o encerramento no servidor."); }
    });
    $("menu").addEventListener("click", () => { const open = $("lateral").classList.toggle("aberto"); $("menu").setAttribute("aria-expanded", String(open)); });
    window.addEventListener("hashchange", () => { if (!$("painel").hidden) { notice(""); render(); } });
    function empty(message) { return make("p", message, "vazio"); }
    function filters(host) {
        const bar = make("div", "", "filtros");
        for (const [id, title] of [["today","Hoje"],["7d","7 dias"],["30d","30 dias"],["90d","90 dias"]]) {
            const b = button(title, () => { period = id; render(); }); b.setAttribute("aria-pressed", String(period === id)); bar.append(b);
        }
        host.append(bar, make("p", "Período em America/Sao_Paulo. Cliques não são pedidos ou vendas.", "nota"));
    }
    async function render() {
        const token = ++generation;
        page = location.hash.slice(1) || "dashboard";
        if (!schemas[page] && !["dashboard","graficos","resgates"].includes(page)) page = "dashboard";
        $("titulo").textContent = schemas[page]?.title || navigation.find(n => n[0] === page)?.[1];
        $("lateral").classList.remove("aberto"); $("menu").setAttribute("aria-expanded", "false");
        for (const a of $("navegacao").children) { a.removeAttribute("aria-current"); if (a.hash === "#" + page || (["grupos","categorias"].includes(page) && a.hash === "#produtos")) a.setAttribute("aria-current", "page"); }
        const host = $("conteudo"); host.replaceChildren(); host.setAttribute("aria-busy", "true");
        if (["dashboard","graficos","resgates"].includes(page)) filters(host);
        const loading = make("p", "Carregando…"); host.append(loading);
        try {
            const resource = page === "graficos" ? "dashboard" : page;
            const data = preview ? null : await window.apiAdmin.request(resource + (["dashboard","resgates"].includes(resource) ? "?period=" + period : ""));
            if (token !== generation) return;
            loading.remove();
            if (["dashboard","graficos"].includes(page)) dashboard(host, data);
            else if (page === "resgates") redemptions(host, data);
            else listing(host, data);
        } catch (error) { if (token === generation) { loading.remove(); host.append(empty(error.message), button("Tentar novamente", render)); } }
        finally { if (token === generation) host.setAttribute("aria-busy", "false"); }
    }
    function dashboard(host, data) {
        if (page === "graficos") {
            if (!Array.isArray(data?.diario) || !data.diario.length) { host.append(empty("Sem dados de evolução. A coleta centralizada precisa estar ativa.")); return; }
            for (const [key,label] of [["visualizacoes","Visualizações por dia"],["resgates","Resgates por dia"]]) {
                const card = make("section", "", "card barras"); card.append(make("h2",label));
                const max = Math.max(1,...data.diario.map(d => Number(d[key]) || 0));
                for (const d of data.diario) { const row = make("div","","linhaGrafico"); const bar = make("div","","barra"); bar.setAttribute("aria-hidden","true"); const fill = make("span"); fill.style.width = Math.max(0,Math.min(100,(Number(d[key]) || 0)/max*100))+"%"; bar.append(fill); row.append(make("span",d.data),bar,make("strong",String(d[key] ?? 0))); card.append(row); }
                host.append(card);
            }
            return;
        }
        host.append(make("h2", "Resultados do período"));
        const grid = make("div","","indicadores resumoPeriodo");
        for (const [key,label] of [["visualizacoes","Visualizações"],["resgates","Resgates confirmados no site"]]) { const card = make("article","","card"); card.append(make("strong", data?.periodo?.[key] == null ? "—" : String(data.periodo[key])),make("p",label)); grid.append(card); }
        host.append(grid,make("h2","Situação atual (independente do período)"));
        const current = make("div","","indicadores");
        for (const [key,label] of [["fotosPublicadas","Fotos publicadas"],["cuponsAtivos","Cupons ativos"],["cuponsVencendo","Vencem nos próximos 7 dias"],["postsPublicados","Posts publicados"]]) { const card=make("article","","card"); card.append(make("strong",data?.atual?.[key] == null ? "—" : String(data.atual[key])),make("p",label)); current.append(card); }
        host.append(current);
        const details = make("div", "", "detalhesDashboard");
        const ranking = make("section", "", "card");
        ranking.append(make("h2", "Páginas mais acessadas"), make("p", "Visualizações no período selecionado.", "nota"));
        const pages = Array.isArray(data?.paginasMaisAcessadas) ? data.paginasMaisAcessadas.filter(item => item && typeof item.caminho === "string" && Number.isInteger(item.visualizacoes) && item.visualizacoes >= 0).sort((a,b) => b.visualizacoes - a.visualizacoes).slice(0,6) : [];
        if (!pages.length) ranking.append(empty(Array.isArray(data?.paginasMaisAcessadas) ? "Nenhuma página acessada neste período." : "Ranking aguardando a coleta de acessos."));
        else {
            const list = make("ol", "", "rankingPaginas");
            const max = Math.max(1, ...pages.map(item => item.visualizacoes));
            for (const item of pages) {
                const row = make("li"); const text = make("div");
                text.append(make("strong", item.caminho), make("small", `${item.visualizacoes} visualizações`));
                const bar = make("div", "", "barra"); bar.setAttribute("aria-hidden", "true");
                const fill = make("span"); fill.style.width = `${item.visualizacoes / max * 100}%`; bar.append(fill);
                row.append(text, bar); list.append(row);
            }
            ranking.append(list);
        }
        const operation = make("section", "", "card");
        operation.append(make("h2", "Status da operação"), make("p", "Configurações atuais da loja. Link configurado não confirma disponibilidade do aplicativo.", "nota"));
        const status = make("dl", "", "statusOperacao");
        const config = data?.operacao;
        const configured = value => value === true ? "Configurado" : value === false ? "Não configurado" : "Não informado";
        const entries = [
            ["Cardápio", Number.isInteger(config?.produtosPublicados) && config.produtosPublicados >= 0 ? `${config.produtosPublicados} itens publicados` : "Não informado"],
            ["iFood", configured(config?.ifoodConfigurado)],
            ["99 Food", configured(config?.food99Configurado)],
            ["WhatsApp", configured(config?.whatsappConfigurado)],
            ["Horários", configured(config?.horariosConfigurados)],
            ["Loja", ({aberta:"Aberta",fechada:"Fechada"})[config?.estadoLoja] || "Não informado"],
            ["Origem predominante (período)", typeof data?.audiencia?.origemPredominante === "string" && data.audiencia.origemPredominante || "Não informado"],
            ["Dispositivo predominante (período)", typeof data?.audiencia?.dispositivoPredominante === "string" && data.audiencia.dispositivoPredominante || "Não informado"]
        ];
        for (const [label,value] of entries) { const row = make("div"); const result = make("dd", value); if (value === "Configurado" || value === "Aberta") result.className = "statusOk"; else if (value === "Não configurado" || value === "Fechada") result.className = "statusPendente"; row.append(make("dt",label), result); status.append(row); }
        operation.append(status); details.append(ranking, operation); host.append(details);
        const channels = make("section", "", "card canaisDashboard");
        channels.append(make("h2", "Cliques por canal"), make("p", "Período selecionado. Cliques não representam pedidos ou vendas confirmadas.", "nota"));
        const tiles = make("div", "", "canaisGrid");
        for (const [key,label] of [["cliquesIfood","iFood"],["cliques99","99 Food"],["cliquesWhatsapp","WhatsApp"]]) {
            const tile = make("div"); const value = data?.periodo?.[key];
            tile.append(make("h3",label),make("strong",Number.isInteger(value) && value >= 0 ? String(value) : "—")); tiles.append(tile);
        }
        channels.append(tiles); host.append(channels);
        if (!data) host.append(empty("Sem conexão com os dados. Os traços não representam zero nem resultados fictícios."));
        const shortcuts=make("div","","acoes"); for(const [id,title] of [["galeria","Gerenciar fotos"],["cupons","Gerenciar cupons"],["loja","Editar loja"]]) shortcuts.append(button(title,()=>{location.hash=id;})); host.append(shortcuts);
    }
    function redemptions(host,data) {
        host.append(make("p","Um resgate por promoção e cliente. Não comprova uso no aplicativo. Nenhum CPF é exibido aqui.","nota"));
        if (!Array.isArray(data?.items) || !data.items.length) {host.append(empty(preview ? "Consulta depende do backend autenticado." : "Nenhum resgate neste período."));return;}
        const wrap=make("div","","card tabela"), table=make("table"), head=make("tr");
        for(const label of ["Identificador","Promoção","Data","Estado"]) head.append(make("th",label)); const thead=make("thead");thead.append(head); table.append(thead);const body=make("tbody");
        for(const item of data.items){const row=make("tr");for(const key of ["id","promocaoNome","criadoEm","status"])row.append(make("td",String(item[key]??"—")));body.append(row);}table.append(body);wrap.append(table);host.append(wrap);
    }
    function listing(host,data) {
        const schema=schemas[page], resource=page;
        const actions=make("div","","acoes");
        const add=button(schema.singleton?"Editar informações":"Adicionar "+schema.singular,()=>edit(resource,schema.singleton?data||{}:{}));
        add.disabled=!preview&&!permitted(resource); actions.append(add);
        if(["produtos","categorias","grupos"].includes(page))for(const [id,title] of [["produtos","Produtos"],["categorias","Categorias"],["grupos","Grupos"]])actions.append(button(title,()=>{location.hash=id;}));
        host.append(actions);
        if(resource==="cupons")host.append(make("p","Cadastre códigos já criados nos aplicativos. Expiração e esgotamento são calculados pelo servidor; códigos não são enviados na listagem pública.","nota"));
        if(schema.singleton){host.append(empty(data?"Configuração carregada. Use Editar informações para revisar os campos.":"Configuração ainda não carregada. Não substituiremos os dados atuais por campos vazios."));return;}
        const items=data?.items;
        if(!Array.isArray(items)||!items.length){host.append(empty(preview?"Prévia sem registros. Abra o formulário para conhecer os campos; não haverá gravação.":"Nenhum registro cadastrado."));return;}
        const list=make("div","","lista");
        for(const item of items){const card=make("article","","card item");const image=item.src||item.imagem;if(image&&safeImage(image)){const img=make("img");img.src=safeImage(image);img.alt=item.alt||"";img.loading="lazy";card.append(img);}
            const info=make("div","","texto");info.append(make("h3",item.nome||item.titulo||item.legenda||item.alt||"Registro"),make("small",[item.statusCalculado||item.status,item.ordem!=null?"Ordem: "+item.ordem:""].filter(Boolean).join(" · ")));card.append(info);
            const tools=make("div","","acoes");const editButton=button("Editar",()=>edit(resource,item));editButton.disabled=!permitted(resource);tools.append(editButton);
            if(schema.fields.some(f=>f.key==="status")){const toggle=button(["ativo","publicado"].includes(item.status)?"Desativar":"Ativar",()=>mutate(resource,item.id,"PATCH",{status:["ativo","publicado"].includes(item.status)?"inativo":resource==="cupons"?"ativo":"publicado",versao:item.versao}));toggle.disabled=!permitted(resource);tools.append(toggle);}
            const remove=button("Excluir",()=>{if(confirm("Excluir este registro? Essa ação pode retirar conteúdo do site público."))mutate(resource,item.id,"DELETE",{versao:item.versao});},"secundario perigo");remove.disabled=!permitted(resource);tools.append(remove);card.append(tools);list.append(card);
        }host.append(list);
    }
    async function mutate(resource,id,method,data){if(busy)return;busy=true;notice("Aguardando confirmação…");try{await window.apiAdmin.request(resource+"/"+encodeURIComponent(id),{method,data});notice("Operação confirmada pelo servidor.");await render();}catch(error){notice(error.message);}finally{busy=false;}}
    async function edit(resource,item) {
        editing={resource,item};const schema=schemas[resource];$("tituloEditor").textContent=(item.id||schema.singleton?"Editar ":"Adicionar ")+schema.singular;$("campos").replaceChildren();$("erroEditor").textContent=preview?"Prévia: formulário disponível para avaliação; gravação e upload desativados.":"";
        $("salvar").disabled=preview||!permitted(resource);
        for(const f of schema.fields){const box=make("div","",["textarea","paragraphs","image"].includes(f.type)?"campo amplo":"campo");const label=make("label",f.label+(f.required?" *":""));label.htmlFor="campo-"+f.key;box.append(label);let input;
            if(["select","relation","days"].includes(f.type)){input=make("select");if(f.type==="days")input.multiple=true;const options=f.type==="days"?["domingo","segunda","terça","quarta","quinta","sexta","sábado"]:f.type==="select"?f.options:[];for(const option of options){const opt=make("option",option);opt.value=option;input.append(opt);}if(f.type==="relation"){
                input.append(make("option",preview?"Disponível após integração":"Carregando…"));input.firstChild.value="";
                if(!preview)window.apiAdmin.request(f.options).then(data=>{if(!input.isConnected)return;input.replaceChildren();const blank=make("option","Selecione");blank.value="";input.append(blank);for(const r of data.items||[]){const opt=make("option",r.nome);opt.value=r.id;input.append(opt);}input.value=item[f.key]||"";}).catch(()=>{$("erroEditor").textContent="Não foi possível carregar categorias/grupos.";});
            }}else if(["textarea","paragraphs"].includes(f.type))input=make("textarea");else{input=make("input");input.type=f.type==="image"?"text":f.type==="price"?"number":f.type;if(["number","price"].includes(f.type)){input.min="0";input.step=f.type==="price"?"0.01":"1";}}
            input.id="campo-"+f.key;input.name=f.key;input.required=f.required;
            if(f.type==="checkbox")input.checked=!!item[f.key];else if(f.type==="days")for(const opt of input.options)opt.selected=(item[f.key]||[]).includes(opt.value);else input.value=f.type==="paragraphs"?(item[f.key]||[]).join("\n\n"):item[f.key]??(f.type==="select"?f.options[0]:"");box.append(input);
            if(f.type==="image"){const upload=make("input");upload.type="file";upload.accept="image/jpeg,image/png,image/webp";upload.setAttribute("aria-label","Enviar arquivo: "+f.label);upload.disabled=preview;upload.addEventListener("change",async()=>{const file=upload.files[0];if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){$("erroEditor").textContent="Use JPG, PNG ou WebP de até 8 MB.";return;}$("salvar").disabled=true;upload.disabled=true;try{const form=new FormData();form.append("arquivo",file);const media=await window.apiAdmin.request("midias",{method:"POST",data:form});if(typeof media?.src!=="string"||!safeImage(media.src))throw new Error("Referência de imagem inválida.");input.value=media.src;$("erroEditor").textContent="Upload confirmado. Salve o registro para associar a foto.";}catch(error){$("erroEditor").textContent=error.message;}finally{upload.disabled=false;$("salvar").disabled=!permitted(resource);}});box.append(upload,make("small","Imagens são armazenadas no serviço de mídia, não no navegador."));}
            $("campos").append(box);
        }
        $("editor").showModal();
    }
    $("fechar").addEventListener("click",()=>{if(!busy)$("editor").close();});
    $("editor").addEventListener("cancel",e=>{if(busy)e.preventDefault();});
    $("editor").addEventListener("close",()=>{$("campos").replaceChildren();editing=null;});
    $("formEditor").addEventListener("submit",async e=>{
        e.preventDefault();if(preview||busy||!editing||!permitted(editing.resource))return;
        const {resource,item}=editing,schema=schemas[resource],data={};
        for(const f of schema.fields){const input=$("campo-"+f.key);data[f.key]=f.type==="checkbox"?input.checked:f.type==="days"?[...input.selectedOptions].map(o=>o.value):f.type==="paragraphs"?input.value.trim().split(/\n\s*\n/).filter(Boolean):["number","price"].includes(f.type)?input.value===""?null:Number(input.value):input.value.trim();}
        if(resource==="cupons"&&(data.validade<=data.inicio||(["ifood","ambas"].includes(data.plataforma)&&!data.codigoIfood)||(["99food","ambas"].includes(data.plataforma)&&!data.codigo99))){$("erroEditor").textContent="Informe os códigos das plataformas selecionadas e um término posterior ao início.";return;}
        if((data.imagem&&!data.alt)||(data.imagemSobre&&!data.altSobre)){ $("erroEditor").textContent="Preencha a descrição acessível da imagem.";return; }
        busy=true;$("salvar").disabled=true;$("erroEditor").textContent="Salvando…";
        try{data.versao=item.versao;await window.apiAdmin.request(resource+(item.id&&!schema.singleton?"/"+encodeURIComponent(item.id):""),{method:schema.singleton?"PUT":item.id?"PUT":"POST",data});$("editor").close();notice("Alterações confirmadas pelo servidor.");await render();}catch(error){$("erroEditor").textContent=error.message;}finally{busy=false;$("salvar").disabled=preview||!permitted(resource);}
    });
    window.apiAdmin.session().then(value=>{user=value;enter(false);}).catch(error=>{$("loginEstado").textContent=error.message+" A prévia não concede acesso administrativo.";});
})();
