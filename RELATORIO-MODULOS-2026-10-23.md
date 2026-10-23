# Continuidade — módulos e integração local — 23/10/2026

## Autorização e limites

O responsável autorizou explicitamente implementar/testar categorias, grupos, produtos, blog, galeria, cupons, upload e métricas, somente em `churros_em_casa_teste_017`, preservando o original. Também autorizou a base separada de restauração e executou o preparo como root. Nenhum administrador foi criado nem senha existente alterada. CPF/resgates públicos permanecem desativados. Não houve publicação na Hostinger.

## Entrega de código

- CRUD administrativo de categorias, grupos, produtos, blog, galeria e cupons: autenticação de proprietário, CSRF e Origin, campos permitidos, versão, transação, dependências e auditoria sem corpo/códigos/senhas. Categoria do produto deriva do grupo; grupo com produtos não muda de categoria; cupons são arquivados, com histórico preservado, e códigos/plataformas não mudam após resgates.
- Preço decimal é validado sem arredondamento binário silencioso. Datas dos formulários são convertidas com a base IANA de America/Sao_Paulo; datas inválidas ou ambíguas são rejeitadas. PATCH de status não regrava outros campos.
- Upload autenticado JPG/PNG/WebP até 8 MiB, assinatura e decodificação reais, limite de pixels/dimensões, sem animação, reprocessado em WebP sem metadados, nome aleatório, pasta não versionada e associação somente por referência registrada. Dois processamentos simultâneos e limitação de frequência. Se o resultado do commit for incerto, o arquivo é preservado para evitar referência quebrada; limpeza de órfãos é separada.
- Foto da Loja agora pode ser substituída por mídia registrada, com alt e transação com a loja/horários. Remoção arbitrária continua bloqueada. Foi testada a associação temporária e a restauração da foto anterior.
- GET públicos de catálogo, blog, galeria e cupons: somente conteúdo publicado/elegível, campos permitidos e nenhuma exposição de códigos. POST resgates retorna 409 e não coleta CPF.
- Integração das páginas: Cardápio dinâmico com busca/filtros, Blog e Novidades, Galeria e fotos da inicial, categorias/destaques da inicial e condições de Promoções. Falhas e ausência de dados não apresentam rascunhos/demonstrações como conteúdo publicado. HTML e posts de demonstração preservados para file://.
- Métricas agregadas por dia de São Paulo, página permitida, origem/dispositivo enumerados e canal. Não guarda IP, cookie, identificador ou referrer completo na tabela; não combina a tabela antiga com a nova. Dashboard 1/7/30/90 dias, situação atual, ranking, canais, cobertura parcial e resgates sem identificação pessoal. Zero e coleta não iniciada são distintos.
- Scripts de backup, restauração vazia separada, preparo de conta local e inspeção/limpeza de mídias órfãs. Nenhum script remove dados do banco original.

## Correção importante de fuso

A hipótese anterior de relógios divergentes foi corrigida. A comparação entre DATE_FORMAT(NOW), UTC_TIMESTAMP, Date do Node e o código instalado do conector mostrou interpretação local de DATETIME ao ler/escrever. `timezone:'+00:00'` configurava a sessão, mas o processo Node continuava em São Paulo. A API agora define `process.env.TZ='UTC'` antes do pool e mantém a sessão SQL UTC. O fuso comercial continua explícito em Intl. Novo teste real confirmou 12:30 São Paulo → SQL 15:30 UTC → ISO 15:30Z. Nenhum offset foi aplicado automaticamente a dados históricos; sua origem precisa de revisão antes da produção.

Sessões novas continuam usando expiração calculada pelo relógio do próprio banco (`NOW(3)+8h`).

## Testes realmente executados

- `npm.cmd test`: **12 aprovados**; banco simulado, HTTP/Express/Argon2 reais, contrato público, segurança, UTC, limites de horário, precisão monetária e datas históricas ambíguas/inexistentes.
- `node testes/modulos-real.js --confirmar-banco-teste`: **77 verificações aprovadas no MariaDB real**, com sessão temporária real, sem testar a senha do proprietário. Incluiu upload válido/arquivo falso/tamanho excessivo/dimensão excessiva, publicação e rascunho, preços, edições completas, versão antiga, duas alterações paralelas de produto (200/409), dependências, grupo/categoria, blog, galeria, proteção de códigos/histórico de cupom, arquivamento, resgate desativado, foto da Loja, métricas e os quatro períodos.
- Fixtures identificadas e removidas. Uma pausa visual não pôde ser retomada pelo stdin do processo; foi encerrada e sua limpeza feita pelos IDs, marca e datas SQL conferidos, sem remover sessões anteriores. O mecanismo de pausa foi substituído por sinal em arquivo local com limite de dez minutos; nova execução terminou com LIMPEZA_CONCLUIDA.
- Navegador: busca do Cardápio (resultado e nenhum resultado), limpeza, artigo com `<script>` exibido literalmente, Galeria, condições do cupom sem CPF, Novidades/destaques e categoria/fotos da inicial. Legenda editada no painel apareceu no site público sem autenticação administrativa.
- Layout: sete páginas públicas e oito módulos administrativos nas larguras nominais 375/768/1024/1440, sem rolagem horizontal. Isso não substitui auditoria completa de acessibilidade, múltiplos navegadores ou dispositivos físicos.
- Backup local criado com API pausada e restaurado em `churros_em_casa_teste_restauracao`: **15 tabelas**, hashes de schemas e dados iguais ao manifesto. Havia **zero uploads permanentes** nesse snapshot; portanto não foi exercitada restauração de um arquivo real não vazio nesse ensaio. O backup é anterior ao último ensaio de foto da Loja e representa aquele snapshot, não mudanças posteriores.
- Limpeza de mídia em modo somente leitura: zero candidatos e zero exclusões. Auditoria npm: zero vulnerabilidades conhecidas reportadas nessa execução; isso não comprova segurança integral.
- Verificações de sintaxe e git diff --check aprovadas. Travas de ambiente/banco preservadas.
- Estrutura e rollback da Loja repetidos com o código final: aprovados, versão 11 e estado integral preservado após falha controlada.

Estado final conferido por leitura: Loja `Churros em Casa`, versão **11**, foto anterior restaurada (sem associação). Os **152 produtos existentes continuam em rascunho**; nenhum foi publicado em lote. Contagem de fixtures remanescentes em produtos/categorias/blog/cupons: zero. As visualizações do navegador de teste geraram métricas agregadas reais de desenvolvimento; não representam clientes.

## Organização dos arquivos

Backend: `api/validacao.js`, `api/conteudo.js`, `api/metricas.js`, novos routers de conteúdo/mídias/catálogo/relatórios, ajustes em database/server/rotas-admin/rotas-publicas e dependências/lockfile (Multer e Sharp).

Frontend: carregadores públicos compartilhados e catálogo/fotos da inicial; ajustes em index.js, Blog, filtros, Promoções, painel e referências nos sete HTMLs. CSS existente preservado, com ajuste para post sem imagem.

Testes/operações: testes de validação e ensaio real dos módulos; diretório `api/operacoes/` com backup/restauração/preparo/limpeza. `api/var/`, `.env*` reais e backups ignorados. Não versionar conteúdo dessas pastas.

## Pendências para terminar a entrega operacional

1. Conteúdo final aprovado: revisar/publicar registros corretos e cadastrar imagens e links reais. Não houve publicação em lote dos produtos legados nem importação automática.
2. Configuração e homologação na Hostinger Unlimited: banco remoto/versão, domínio/HTTPS/proxy, credenciais exclusivas e armazenamento persistente de mídia. A API atual continua exclusivamente local de testes; não remover travas para publicar. Roteiro em PUBLICACAO-HOSTINGER.md.
3. Exercitar novo login com senha e recuperação administrativa no ambiente definitivo; a senha do proprietário não foi solicitada ao agente.
4. Definir identificação e regras de resgate/privacidade antes de ativar qualquer coleta. Sem essa decisão, a entrega de Promoções é somente listagem/condições, sem códigos públicos.
5. Homologar mídia persistente após redeploy e restauração com uploads reais, além de backups completos do ambiente (não apenas tabelas).

Não se declara prontidão para produção nem integração com iFood/99 Food: os pedidos e pagamentos continuam nos aplicativos.
