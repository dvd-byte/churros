# Banco para integração — atualizado em 23/10/2026

API atual: autenticação, consulta pública de produtos e GET/PUT administrativos de Loja. Demais módulos de CRUD e integração pública de Loja ainda faltam. Em 23/10, sete testes automatizados passaram com banco simulado; nenhum SQL foi executado em MariaDB nesta etapa. O relatório de 20/10 informa testes em `churros_em_casa_teste_017` e preservação do banco original `churros_em_casa`. Esses testes reais foram relatados pelo colaborador, não reproduzidos nesta revisão. Não executar migrações/testes no banco original. Confirmar quem assume os endpoints restantes. Versão exata do MariaDB ainda precisa ser registrada.

Não houve alteração de estrutura ou nova migração em 23/10. Loja usa `loja_unica=1`, ID real, versão e transação com horários. Deve existir uma loja inicial com conteúdo aprovado antes de usar o editor. A mídia existente é resolvida por `midias.caminho_arquivo` e preservada; upload/substituição continuam pendentes. Próximo requisito: configurar o ambiente local de testes e homologar a gravação real antes da integração pública.

## Aplicação

1. Usar um banco MariaDB de desenvolvimento vazio, criado pelo responsável. Confirmar versão com `SELECT VERSION()` e usar SQL mode estrito, FKs e CHECKs habilitados. A sintaxe foi preparada para MariaDB moderno; não foi executada aqui. Não presumir compatibilidade MySQL.
2. Aplicar 001 a 016 em ordem, uma única vez. Nenhum desses arquivos foi alterado.
3. Rodar `verificacoes/antes_017.sql`; todas as contagens de problemas devem ser zero. Em base vazia serão zero. Convencionar segunda=1 e domingo=7 nos horários.
4. Base nova: aplicar 017 a 022 em ordem, parando no primeiro erro. Base já em 021: aplicar somente 022, após confirmar versão e backup. Não reaplicar migrações históricas. A 017 histórica ainda exige loja 1 se já houver horários ao aplicá-la; nesse caso o preflight bloqueia e a importação deve ser revisada, sem renumerar a loja automaticamente.
5. Executar `verificacoes/testes_integridade_seguro.sql` SOMENTE em `churros_em_casa_teste_integridade`, vazio e com 001..022. Usa bloco anônimo MariaDB e guarda de ambiente antes de qualquer escrita; não cria rotinas. Reverte registros ao terminar ou falhar, mas contadores AUTO_INCREMENT podem avançar. O teste antigo sem guarda é legado e não deve ser executado automaticamente.
6. Rodar `verificacoes/depois_021.sql` e revisar pendências de conteúdo. Importar os conteúdos aprovados do site atual em etapa separada.

ALTER TABLE/CREATE TABLE no MariaDB causam commits implícitos: um BEGIN não torna a sequência inteira reversível. Em base já utilizada: backup restaurável, janela de manutenção e teste prévio numa cópia. Nesta entrega não houve conexão com servidor, execução de SQL nem exclusão de dados.

Referências de sintaxe: https://mariadb.com/docs/server/reference/sql-statements/data-definition/alter/alter-table e https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit

## O que mudou

- 017: sessão com suporte a CSRF; Loja completa; no máximo uma loja via loja_unica, com ID não fixo; vínculo dos horários, validação de intervalo; autor opcional da mídia. Arquivo preservado nesta revisão porque já foi aplicado pelo colaborador.
- 018: slug/imagem/status de categoria; destaque/alt/status de produto; versões; relação composta impede produto em grupo de outra categoria.
- 019: parágrafos/categoria/link/alt no Blog; legenda própria e estados de publicação na Galeria.
- 020: plataformas, dois códigos, condições e arquivamento de promoções; exigências para ativação; índice temporal dos resgates.
- 021: métricas por página/origem/dispositivo/canal, preservando tabela antiga sem inventar dados históricos.
- 022: remove o DEFAULT 1 de horarios_semanais.loja_id; a API informa o ID real da loja, sem alterar registros existentes.

## Contrato HTTP: não mudar as chaves que o painel já usa

Rotas implementadas: `/api/admin/session`, `/api/admin/login`, `/api/admin/logout` e `/api/produtos`. Rotas administrativas previstas mas ainda não implementadas: `midias`, `dashboard`, `resgates`, `loja`, `blog`, `galeria`, `categorias`, `grupos`, `produtos`, `cupons`. Listagens retornam `{ok:true,data:{items:[]}}`; Loja retorna objeto em data; dashboard conforme documento do painel. Login/sessão por cookie, permissões e CSRF conforme `../admin/INTEGRACAO.md`. A consulta pública de produtos agora exige categoria/produto publicados e grupo ativo; produto publicado indisponível pode ser exibido como indisponível.

### Mapeamento obrigatório

| Recurso | Chave JSON do painel | Campo SQL/regra |
|---|---|---|
| todos editáveis | id, versao | id, versao; IDs serializados como strings |
| loja | nome, endereco, telefone | mesmos nomes |
| loja | whatsapp, instagram, ifood, food99, mapa | whatsapp_url, instagram_url, link_ifood, link_99food, mapa_url |
| loja | historia | historia_json; array de strings, nunca HTML arbitrário |
| loja | imagemSobre, altSobre | imagem_sobre_id resolvido para caminho_arquivo; alt_sobre |
| loja | dias, abertura, fechamento | horarios_semanais: dia_semana, hora_abertura, hora_fechamento, fechado |
| categorias | nome, slug, status, ordem, alt | mesmos nomes |
| categorias | imagem | imagem_id → midias.caminho_arquivo |
| grupos | nome, categoriaId, ordem | nome, categoria_id, ordem |
| produtos | nome, descricao, preco, grupoId | nome, descricao, preco, grupo_id |
| produtos | imagem, alt, status, destaque, disponivel, ordem | imagem_id → caminho_arquivo; demais mesmos nomes |
| blog | titulo, categoria, resumo, paragrafos | titulo, categoria, resumo, paragrafos_json |
| blog | imagem, alt, status, publicadoEm, link, textoLink | imagem_id → caminho_arquivo; alt, status, publicado_em, link, texto_link |
| galeria | src, alt, legenda, status, ordem | midia_id → caminho_arquivo; texto_alternativo, legenda, status, ordem |
| cupons | nome, descricao, condicoes, plataforma | titulo, descricao, condicoes, plataforma |
| cupons | codigoIfood, codigo99 | codigo_ifood, codigo_99 |
| cupons | inicio, validade, limiteResgates | inicio_em, termina_em, limite_usos |
| cupons | status | status; expirado/esgotado calculados pela API |
| resgates | id, promocaoNome, criadoEm, status | id, promocoes.titulo via JOIN, criado_em, validado traduzido como confirmado |

Valores DECIMAL são tratados com precisão; validar representação recebida e retornar formato esperado pelo formulário. Campo vazio limiteResgates vira NULL, nunca zero automático.

### Mídia

Upload existente retorna `{id,src}`. O frontend atualmente envia caminhos nos formulários; API resolve exclusivamente mídias registradas e autorizadas. Não aceitar qualquer caminho do sistema. Imagens atuais precisam ser cadastradas na migração de conteúdo. Campo alt é por uso, não alterar texto de todos os produtos ao editar uma mídia compartilhada.

Nome/caminho/MIME/tamanho do upload são gerados/validados no servidor. Banco permite AVIF por histórico, mas o frontend atual aceita somente JPEG/PNG/WebP até 8 MB. Não ampliar upload sem validar o fluxo completo.

### Publicação e campos legados

`status` passa a ser a fonte oficial. Não usar somente `ativa`, `publicada` ou `disponivel` para decidir o que é público. Por compatibilidade, a API mantém categorias.ativa = (status='publicado'), galeria.publicada = (status='publicado') e promocoes.ativa = (status='ativo' e não arquivada) nas escritas. Nenhum cliente antigo deve continuar gravando apenas flags antigas.

Grupos têm ativo legado: novas gravações mantêm true, consultas públicas filtram ativo; o painel não edita esse estado. Produto publicado só aparece se grupo ativo e categoria publicada. Destaques requerem produto publicado/disponível e ancestrais públicos.

Produtos mantêm categoria_id, mas a API deriva esse valor do grupo escolhido; não confiar em categoria enviada pelo cliente. A FK composta garante coerência. Mudar um grupo de categoria com produtos exige operação coordenada; nesta primeira etapa retornar 409 em vez de mover silenciosamente produtos.

Categorias legadas recebem slug técnico categoria-ID; revisar antes de importar os links reais. Produtos legados ficam rascunho (disponibilidade não comprova publicação). Na base vazia confirmada pelo usuário não há registros afetados.

Posts: API gera slug único no cadastro (não existe campo no formulário), sem alterar slug em toda edição de título. Recebe paragrafos como array de strings, guarda JSON e preenche `conteudo` legado com os parágrafos unidos por linha em branco, pois a coluna continua NOT NULL. Publicação pública usa JSON escapado como texto; conteúdo legado NULL no JSON precisa de importação/revisão, não interpretação como HTML. Estado legado arquivado é lido como inativo na interface. Novas escritas usam rascunho/publicado/inativo.

Galeria: texto alternativo é obrigatório na API; legado nulo deve ser revisado, não substituído por descrição inventada. Campo titulo antigo não é substituto automático de legenda.

### Loja e horários

Consultar a loja por loja_unica=1 e usar seu ID real. Primeira gravação insere sem forçar ID; capturar insertId e usá-lo em todos os horários. Demais gravações usam o ID encontrado. A restrição UNIQUE protege contra duas lojas concorrentes. Nome/endereço/história vêm de conteúdo aprovado, sem seed fictício. Ausência inicial deve ser tratada claramente. Não assumir que ID=1 em queries ou código.

Dias JSON: nomes em português do formulário, convertidos explicitamente para segunda=1, terça=2, quarta=3, quinta=4, sexta=5, sábado=6, domingo=7. Uma transação atualiza loja e os sete dias. Dia fechado tem ambos horários NULL. O editor atual só representa um mesmo intervalo nos dias abertos; não devolver horários distintos como se fossem iguais. Regra sem passagem pela meia-noite. Aberto quando abertura <= hora atual < fechamento, em America/Sao_Paulo.

Não aceitar o envio arbitrário de metricas_inicio_em/fuso pela atualização comum da loja. Estes campos são controlados pelo serviço. A versão da Loja controla também a edição dos horários.

### Datas e edição concorrente

Conexão configurada em UTC pelo connector Node (`timezone: '+00:00'`, que também define o fuso da sessão). DATETIME não converte registros antigos automaticamente. Conferir o fuso utilizado nos dados importados antes de homologar; não aplicar offsets indiscriminadamente. Converter datas de formulário de São Paulo para UTC ao gravar e de volta ao ler. Respostas públicas usam ISO com offset. `atualizado_em` é atualizado explicitamente pela API em toda alteração.

PUT/PATCH/DELETE recebem versão atual. UPDATE ... SET versao=versao+1, atualizado_em=... WHERE id=? AND versao=?; zero registros afetados exige distinguir ausente de conflito (404/409). Não sobrescrever silenciosamente edições. INSERT começa em versao=1.

### Cupons e resgates: não ativar coleta de CPF ainda

Cupons antigos preservam codigo sem inferir plataforma e ficam rascunho. Novos cupons escrevem somente codigo_ifood/codigo_99, deixando codigo antigo NULL; a unicidade antiga não restringe os códigos novos. No formulário, exigir códigos conforme plataforma, datas e condições. Nunca retornar códigos em listagens públicas, inclusive quando a promoção estiver expirada.

Arquivar promoção: definir status=inativo, ativa=false e arquivada_em na mesma operação. DELETE com histórico deve arquivar, não apagar. Não trocar códigos/plataformas de campanha já resgatada sem regra aprovada; retornar conflito e propor outra promoção.

Status existente solicitado/validado/cancelado foi preservado para não reclassificar histórico. Na integração inicial, inserir somente validado depois das verificações, na mesma transação. Não aceitar status do visitante. Não criar fluxo de cancelamento neste escopo. Se houver legado solicitado/cancelado, resolver regra antes de ativar. Histórico validado conta para limite; UNIQUE continua valendo para qualquer estado, impedindo reutilização inadvertida.

Se CPF for aprovado: identificador_hash guarda HMAC-SHA-256 em 64 caracteres hexadecimais, chave somente no servidor; não SHA simples. Não é dado anônimo nem autenticação. Não implementar a coleta enquanto finalidade, retenção e decisão com o chefe estiverem pendentes. Esta entrega não ativa coleta nem cria novo endpoint.

API deve bloquear a promoção com SELECT ... FOR UPDATE, validar estado/datas, verificar resgate anterior, contar válidos, respeitar limite_usos, inserir e COMMIT antes de revelar código. Exclusão/edição de limite deve coordenar o mesmo bloqueio. Repetição não cria nova linha nem consome vaga. CPF não prova identidade e não controla uso no aplicativo. Definir reapresentação de código e resposta para duas plataformas antes de liberar o fluxo público.

### Sessões e auditoria

csrf_hash é nullable só para compatibilidade; sessão autenticada sem CSRF válido não autoriza mutação. Implementar emissão/renovação e verificação vinculadas à sessão; GET session deve devolver o token correspondente, não seu hash. Cookie HttpOnly/Secure/SameSite, sessões aleatórias fortes e logout invalidando revogado_em no servidor. Permissões verificadas em todo endpoint. Hashes e credenciais nunca vão ao painel.

auditoria_admin.detalhes permanece para compatibilidade: novas gravações usam apenas campos permitidos, sem body bruto, CPF, tokens, senha ou códigos de cupom. Não fazer SELECT * em respostas administrativas/públicas.

### Dashboard

Nova fonte: metricas_dimensoes_diarias. metricas_diarias antiga é histórico e não deve ser somada à nova (duplicaria cliques e não fornece dimensões). Não inventar distribuição dos totais antigos. Registrar metricas_inicio_em ao ativar coleta real; null significa indisponível. Informar cobertura parcial no período se a coleta começou recentemente.

- periodo.visualizacoes: SUM quantidade com evento visualizacao.
- cliquesIfood/cliques99/cliquesWhatsapp: eventos clique_ifood/clique_99/clique_whatsapp.
- paginasMaisAcessadas: visualizações agrupadas por pagina, top 6 decrescente, desempate estável por caminho.
- audiencia: origem/dispositivo predominantes com base SOMENTE em visualizações.
- diario: visualizações por dia; resgates vêm da tabela resgates, não de evento do navegador.
- atual: contagens de conteúdos publicados e promoções elegíveis, independente do período.
- operacao: links válidos configurados, produtos públicos, horários e status calculado; link configurado não significa serviço externo disponível.

Incrementar métricas por UPSERT atômico. Rotas/eventos/categorias em listas permitidas; rejeitar páginas administrativas, URLs completas, queries e fragmentos. Não coletar CPF, IP ou identificador pessoal nessa tabela. Limitar abuso. Períodos e data_referencia em São Paulo; Hoje=dia atual, 7/30/90 incluem o dia atual. Nunca chamar clique de venda nem visita de visitante único.

## Verificação ainda necessária

Revisão de 20/10: testes HTTP locais com Express/Argon2 reais e banco simulado; nenhuma conexão ao MariaDB ou escrita em banco nesta revisão. Não houve teste visual. A 022 e o teste SQL atualizado precisam ser executados em base descartável. Testar migrações limpas, restrições, duas conexões simultâneas, permissões, CSRF, resgates, UTC/São Paulo e publicação em outro navegador. Detalhes da execução e próximos passos em `../api/README.md`.
