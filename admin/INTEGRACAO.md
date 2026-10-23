# Painel novo — contrato e limites da entrega

## Atualização: Loja integrada no ambiente local de testes

`GET /api/public/loja` foi implementado e consumido nas páginas públicas por `js/loja-publica.js`. Sobre recebe nome/história/imagem; Onde Comprar recebe endereço/horários/mapa/contatos; todas as páginas recebem links e rodapé. Campos sem configuração ficam ocultos e falhas não reutilizam dados estáticos como atuais. O HTML de demonstração é preservado para file://.

Validado em MariaDB real: consulta/edição pelo painel, rejeição de formulário antigo, duas requisições simultâneas (200/409), rollback controlado e logout por HTTP com sessão temporária real. Também foi observada uma edição do painel aparecer no site público sem enviar cookie administrativo na consulta. Produção, upload e demais módulos continuam fora dessa entrega. O estado anterior descrito abaixo não substitui o relatório atualizado em `../VALIDACAO-LOJA-2026-10-23.md`.

## Estado atual
Atualizado em 23/10/2026. Frontend em admin/index.html. API implementada: login, sessão, logout, consulta pública de produtos e GET/PUT administrativos de Loja. A revisão atual passou em sete testes automatizados com banco simulado; não homologou MariaDB real nem navegador. Demais módulos de CRUD, upload e métricas continuam pendentes. A imagem de Loja permanece somente leitura até o serviço de mídia existir. Não publicar como painel operacional. A prévia não concede autenticação, não lê registros privados, não grava no navegador e não modifica o site. Campos SQL e migrações atuais: ../banco/INTEGRACAO-API.md; execução: ../api/README.md.

Não se copiou a autenticação do painel antigo. Rotas hash são navegação de interface, não barreiras de segurança. Servidor deve proteger TODOS os endpoints /api/admin, independentemente do que a interface exibe. HTML/CSS/JS do painel não contêm segredos e podem ser públicos; dados e operações não podem.

## Rotas de interface
/admin/index.html (login), #dashboard, #graficos, #produtos, #categorias, #grupos, #blog, #galeria, #cupons, #resgates, #loja. Relatórios permanece fora desta etapa. Perfil único proprietário; permissões retornadas pelo backend permitem evolução.

## Transporte
Base relativa à raiz do projeto: api/admin/. HTTPS obrigatório fora de localhost. JSON em todas as respostas: {"ok":true,"data":...}. Nenhum sucesso HTTP com corpo HTML é aceito. Operações sem retorno também devem responder JSON, não 204. Erros usam HTTP 401/403/409/413/422/429/500. Não devolver stacks, SQL ou dados pessoais. Cache-Control: no-store nos endpoints administrativos e de resgate.

Autenticação: cookie de sessão HttpOnly, Secure, SameSite apropriado; rotação ao entrar e invalidação ao sair. Login sujeito a limitação de tentativas e verificação de Origin. Senha com hash adaptativo no servidor. Nenhuma senha embutida no frontend. Proteção CSRF por token associado à sessão + verificação Origin em toda mutação. Consultas parametrizadas, validação e autorização no servidor são obrigatórias.

## Autenticação
- GET session → {user:{id,nome,permissions:["*"]},csrfToken:"..."}. Alternativa: permissões por recurso, como galeria:write; servidor também deve restringir leitura.
- POST login {email,senha} → confirma login por cookie; frontend consulta session novamente.
- POST logout com X-CSRF-Token → invalida sessão; somente depois a interface afirma encerramento.

## CRUD
Recursos: blog, galeria, categorias, grupos, produtos, cupons.
- GET recurso → {items:[...]} (primeira versão retorna coleção completa; paginar exige também adaptar interface).
- POST recurso → registro criado com id/versao.
- PUT recurso/:id → registro atualizado.
- PATCH recurso/:id → alteração de status.
- DELETE recurso/:id → confirmação após exclusão.
- GET loja → objeto único com id, versao e campos do formulário; PUT loja → confirmação {mensagem,versao}, seguida de nova consulta pelo painel. Ambos exigem proprietário; PUT também exige CSRF. Sem loja inicial, GET retorna 404 orientando o provisionamento. História inválida ou horários distintos por dia retornam 409 para evitar perda de informação. A imagem atual não pode ser substituída ou removida por este endpoint.
- Toda mutação recebe versao quando disponível. Validar concorrência e retornar 409 se desatualizado. Não atualizar conteúdo com base apenas no ID enviado.
- Nomes e tipos dos campos estão centralizados em schemas, no admin.js. IDs são opacos. Preços decimais exatos no banco. Ordem é inteiro não negativo. Limite vazio significa null; zero não significa ilimitado. Produtos referenciam grupos; grupos referenciam categorias. Exclusões com dependências retornam 409.
- Blog: paragrafos é array de strings. Loja: historia é array; dias contém nomes em português. Datas dos formulários datetime-local são horário de São Paulo, SEM offset; backend converte para UTC e devolve os campos de edição no mesmo formato local. Não misturar esse formato com a resposta pública de validade, que exige ISO com offset.
- Cupons guardam codigoIfood e codigo99, exigidos conforme plataforma. Status configurável rascunho/ativo/inativo; statusCalculado pode ser expirado/esgotado. Recalcular pelo relógio e contagem do servidor. Nunca confiar no limite/estado informado pelo cliente público.

## Mídia
POST midias, multipart/form-data, campo arquivo → {id,src}. Endpoint único reutilizado por Galeria, Blog, produto, categoria e Sobre. Frontend limita PNG/JPEG/WebP a 8 MB; backend deve verificar assinatura real, tamanho, dimensões, reprocessar imagem, gerar nome seguro e impedir execução de uploads. Não aceitar SVG/HTML. Não confiar na extensão/MIME do navegador. Definir limpeza de uploads órfãos e exclusão de mídias ainda referenciadas. Caminho src relativo à raiz ou URL HTTPS.

## Dashboard
GET dashboard?period=today|7d|30d|90d → {periodo:{visualizacoes,cliquesIfood,cliques99,cliquesWhatsapp,resgates},atual:{fotosPublicadas,cuponsAtivos,cuponsVencendo,postsPublicados},diario:[{data,visualizacoes,resgates}],paginasMaisAcessadas:[{caminho,visualizacoes}],operacao:{produtosPublicados,ifoodConfigurado,food99Configurado,whatsappConfigurado,horariosConfigurados,estadoLoja},audiencia:{origemPredominante,dispositivoPredominante}}.
Hoje começa à meia-noite em São Paulo; demais períodos incluem hoje e dias anteriores. Situação atual independe do período; vencendo = próximos sete dias. Ausência de dado deve ser null, não zero inventado. Gráficos e números usam a mesma resposta. A coleta de eventos no servidor ainda não foi implementada. Não chamar cliques de vendas.

Ranking: agregar visualizações por caminho público normalizado, sem parâmetros pessoais na URL; excluir administração e retornar as seis páginas mais acessadas em ordem decrescente. Array vazio significa coleta disponível sem acessos; null significa indisponível. Contagens são inteiros não negativos. Cliques por canal substituem os antigos indicadores individuais, evitando duplicação.

Operação: produtosPublicados conta os produtos publicados atuais. Campos *Configurado são booleanos ou null: representam configuração válida, não teste de disponibilidade externa. horariosConfigurados representa horários completos e válidos. estadoLoja é aberta, fechada ou null, calculado pelo servidor em America/Sao_Paulo conforme horários da loja. Não inferir loja fechada quando os horários estiverem ausentes. Essas informações independem do filtro de período.

Audiência: origemPredominante e dispositivoPredominante são rótulos agregados dos visitantes públicos no período, ou null. Não usar o navegador do administrador ou seu referer como dados de audiência. Não enviar IP, identificadores pessoais ou URLs de referência completas ao painel. Novos blocos exibem ausência de dados enquanto estes serviços não existirem; não há rastreamento novo no site nesta entrega.

## Resgates
GET resgates?period=... → {items:[{id,promocaoNome,criadoEm,status}]}. Não enviar CPF, hash/HMAC do CPF ou códigos à tabela de resgates.
Coleta de CPF pendente de decisão; não ativar. Se aprovada, o banco usa UNIQUE(promocao_id,identificador_hash), com HMAC hexadecimal e chave só no servidor, transação e limite concorrente. Validar CPF na API, sem hash simples, logs ou armazenamento no navegador. Definir retenção/finalidade. CPF válido não comprova identidade; resgate não comprova uso no aplicativo.

## Conexão pública — implementada parcialmente e desativada por segurança
js/servico-publico.js liga os pontos já existentes da Galeria e Promoções. ATIVADO=false até backend real e testes. GET api/public/galeria → {ok:true,data:{items:[{src,alt,legenda}]}}; servidor retorna apenas publicados, ordenados. GET api/public/cupons → {ok:true,data:{items:[{id,nome,descricao,plataforma,validade,condicoes,status}]}}; não incluir códigos nem resgates privados.
POST api/public/resgates {cupomId,cpf} → envelope ok/data com contrato existente em INTEGRACAO-PROMOCOES.md. Requer rate limit, validação, transação e idempotência. A interface pública atual ainda espera um codigo por resposta. A evolução para dois códigos por promoção e reapresentação de resgate existente precisa ser concluída antes de ativar cupons para ambas as plataformas. Não concatenar códigos sem identificar a plataforma.

## Integrações ainda pendentes (não afirmar publicação fim a fim)
- Blog/home leem js/posts-blog.js; não leem ainda o CRUD do painel.
- Cardápio tem 152 itens no HTML e filtros inicializados sobre esses elementos. Precisa migrar os dados preservando categorias/grupos, adaptar renderização e revalidar busca.
- Loja/Sobre/rodapés/horários contêm conteúdo estático; precisam consumir uma fonte pública compartilhada. Não ativar salvar Loja em produção sem essa integração.
- Destaques atuais são estáticos; campo destaque do produto está preparado, ainda não consumido na home.
- Galeria e Promoções possuem adaptador pronto, mas não há servidor para confirmar publicação real.
- Banco e autenticação inicial foram entregues pelo colaborador em ambiente de teste; migração 022 acrescentada nesta revisão ainda não aplicada. Faltam CRUD, autorização por rota, upload, integração pública, backup/restauração e homologação. Não retirar o bloqueio de produção sem concluir configuração e testes.

## Critérios antes de entrega operacional
Testar login válido/inválido, expiração/logout, acesso direto sem sessão, CSRF e autorização; upload inválido e limite; CRUD com erros e concorrência; mídia publicada visível em outro navegador; rascunhos/códigos nunca presentes em endpoints públicos; resgate simultâneo e repetido; rede interrompida sem sucesso falso; teclado/dialog/mobile; layout 375/768/1024/1440; backup e restauração. Requisições que falham após envio podem ter sido processadas: consultar estado antes de repetir.
