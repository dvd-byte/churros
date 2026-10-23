# Validação local do módulo Loja — 23/10/2026

> Continuidade posterior: veja RELATORIO-MODULOS-2026-10-23.md. Novos módulos/mídia foram implementados e a versão final da Loja passou a 11 após ensaio de foto com restauração. A hipótese de relógios divergentes registrada abaixo foi corrigida: o problema observado era interpretação local de DATETIME pelo conector. O processo agora também usa TZ=UTC, sem converter dados históricos.

## Resultado final desta etapa

Validação e integração pública de Loja concluídas no ambiente local de testes. O primeiro commit, `e18b100`, já foi enviado para `dvd-byte/churros`, branch main, após confirmação explícita do destino pelo responsável. Nenhuma credencial foi incluída.

### Implementação adicional

- `api/rotas-publicas.js` e registro em `api/server.js`: GET /api/public/loja sem autenticação, somente loja publicada e campos permitidos, leitura consistente da loja e horários. Não retorna ID, versão ou dados de administração. 404 para ausente/não publicada; 503 genérico em falha; no-store.
- `js/loja-publica.js`, `index.html` e seis HTMLs em `paginas/`: fonte compartilhada para Sobre, Onde Comprar, links públicos e rodapés. Reconsulta ao recarregar ou voltar à página. Fetch sem cookies, textos sem interpretação HTML, iframe limitado a Google Maps e imagens restritas à pasta pública. Dados vazios não reaproveitam contatos estáticos. Em falha, mostra aviso e oculta dados antigos; file:// preserva demonstração.
- `js/onde-comprar.js`: status usa horários recebidos e fuso America/Sao_Paulo, com abertura inclusiva, fechamento exclusivo e estado indisponível se o dia não tiver informação. Não verifica aplicativos nem feriados.
- `index.css`: respeito ao atributo hidden, estilo do aviso e preservação de quebras de linha em endereço.
- `api/rotas-admin.js`: expiração de novas sessões calculada no próprio MariaDB com NOW(3) + 8 horas. Encontrada diferença observável de três horas entre Date do Node e NOW/UTC_TIMESTAMP do banco; a primeira sessão temporária de dez minutos foi rejeitada pelo CHECK de expiração, sem criar registro. O ensaio foi corrigido e repetido com sucesso. Não se alteraram relógios do sistema ou datas históricas.
- Contratos atualizados: api/README.md, admin/INTEGRACAO.md e banco/INTEGRACAO-API.md.

### Verificações finais

- `npm.cmd test`: 9 aprovados; HTTP/Express/Argon2 reais com banco simulado, contrato público e teste de limites de horário/fuso com relógio controlado.
- `node testes/estrutura-real.js`: consultas somente de leitura, comparando os arquivos 001–022. Presentes 15 tabelas InnoDB, 161 colunas, 37 restrições nomeadas e composição de 10 índices nomeados. FKs e CHECKs habilitados, loja_id sem DEFAULT. Isso não comprova histórico de migrações nem equivalência integral dos tipos/expressões de CHECK/FK. Nenhuma migração reaplicada.
- `node testes/concorrencia-loja-real.js --confirmar-banco-teste`: sessão temporária real para proprietário existente, duas requisições paralelas retornaram 200 e 409. A API pública sem cookie mostrou a edição persistida. Conteúdo original restaurado pela API; apenas versão e timestamps avançaram. Logout sem token recusado, logout válido confirmou revogação no banco, cookie expirado e acesso posterior 401. Somente a sessão gerada pelo ensaio foi removida. Não foi um novo teste de senha/login; o login real havia sido executado pelo responsável no navegador.
- Navegador: nome temporário `[integracao]` salvo pelo painel apareceu em Sobre e no rodapé de Onde Comprar; história/endereço/horários vieram do banco. Nome restaurado e restauração observada no site público. A consulta pública não envia cookies administrativos. Conferência visual na largura padrão do navegador; não se declara uma matriz completa de testes responsivos.
- Servidor isolado sem banco em 127.0.0.1:3002: erro público 503 mostrou aviso no navegador, sem reutilizar contatos, mapa ou horários da demonstração. Servidor encerrado após o ensaio.
- Rollback repetido com o código final: uma alteração real da loja e duas de horários antes de falha controlada; HTTP 500, um rollback, nenhum commit e comparação integral confirmando estado final idêntico ao inicial, versão 9.
- Sintaxe dos JavaScripts novos/alterados e git diff --check aprovados; sete páginas conferidas com carregador público e campos de rodapé. Não houve execução de migração, modificação de privilégios pela aplicação ou acesso aos registros do banco original.

Estado final observado: nome `Churros em Casa`, versão 9, sete horários preservados. A API final foi reiniciada em 127.0.0.1:3001, ainda com NODE_ENV=test e banco exclusivo autorizado. Não foi removida nenhuma trava.

### Limites e continuidade

Esta etapa cobre Loja; não conclui os outros módulos do painel. Upload, CRUDs restantes, métricas/dashboard, publicação/HTTPS e configuração de produção continuam pendentes. Dados atuais de teste incluem endereço de teste e links vazios; seu preenchimento com conteúdo real deve ser feito pelo responsável, sem importar conteúdo automaticamente. Revisão integral do histórico/schema e teste de migração em base nova continuam separados; este ensaio de leitura não é certificação de equivalência completa. Também não foram simulados queda de conexão, falha do servidor ou commit de resultado incerto. A correção do login para oito horas tem SQL coberto na suíte e operação DATE_ADD exercitada no ensaio real de sessão, mas não houve novo login com senha após essa correção.

Os registros abaixo são cronológicos e descrevem o estado e pendências de momentos anteriores; o resultado final acima prevalece.

## Escopo executado

- Código conferido em `api/database.js`, `api/server.js`, `api/rotas-admin.js`, `admin/api.js`, trechos do editor em `admin/admin.js`, testes e contratos.
- Confirmadas travas de ambiente/banco, configuração por caminho do módulo, autenticação de proprietário, CSRF, preservação da imagem, controle de versão, ID real da loja e transação envolvendo loja e horários.
- `npm.cmd test`: 7 testes aprovados, com banco simulado. A execução no sandbox falhou por EACCES no HTTP local; repetição autorizada fora do sandbox passou.
- `node --check`: aprovados server.js, rotas-admin.js, admin/api.js e admin/admin.js.
- Consultas reais de leitura realizadas em transação READ ONLY, encerrada com rollback. Não houve gravação de dados, login real, migração ou criação de usuário.

## Banco observado

- Servidor: 13.0.2-MariaDB.
- Banco selecionado: `churros_em_casa_teste_017`.
- Fuso da sessão: `+00:00`.
- SQL mode inclui `STRICT_TRANS_TABLES`; foreign_key_checks e check_constraint_checks habilitados.
- 15 tabelas visíveis, todas InnoDB.
- Um administrador ativo com perfil proprietário. Isso não confirma a disponibilidade da senha para login nem a aprovação desse registro como conta de teste.
- Uma loja: ID 1, loja_unica=1, versão 3, publicada, fuso America/Sao_Paulo, JSON da história válido, sem imagem associada. O conteúdo não foi aprovado nesta verificação.
- Sete horários vinculados ao ID real: segunda, quarta e sexta, 09:00–18:00; demais dias fechados, com horários nulos.
- `horarios_semanais.loja_id`: NOT NULL e sem DEFAULT, estado compatível com a migração 022. Isso não comprova o histórico completo de aplicação das migrações.
- Nenhuma tabela de controle de migrações apareceu na listagem. A aplicação integral de 001–022 ainda exige conferir estrutura/restrições e eventual registro externo; não reaplicar arquivos com base apenas nisso.

## Bloqueio antes de gravações reais

A conta local configurada possui SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX e ALTER tanto no banco de testes quanto em `churros_em_casa`. Portanto, ainda não atende ao requisito de usuário exclusivo do banco de testes. Não foram lidos registros nem realizadas alterações no banco original.

Configurar uma conta exclusiva do banco de testes, com os privilégios necessários à API, sem permissões sobre o original. Fazer a configuração de credenciais localmente, sem compartilhar senha, hash, token ou arquivo .env. Não revogar permissões da conta atual sem avaliar seus outros usos.

## Próximos passos

### Rollback real após falha controlada — aprovado

Executado `node testes/rollback-loja-real.js --confirmar-banco-teste`, após explicação e autorização do responsável. Script manual separado de npm test, com guardas de banco, conta efetiva e InnoDB. Não altera schema, não cria sessão nem administrador e não muda o servidor do painel. Autenticação sintética somente no processo isolado; rota PUT e transação executadas com MariaDB real.

A rota executou UPDATE da loja e gravações dos dias 1 e 2. Dentro da transação, verificou-se nome temporário, versão incrementada e horários alterados. Outra conexão continuou vendo o estado anterior. Uma exceção controlada antes da gravação do dia 3 acionou o tratamento da rota: HTTP 500 genérico, um rollback e nenhum commit. A comparação integral das colunas da loja e dos sete horários, por conexão independente, confirmou estado final idêntico ao inicial, incluindo timestamps. Nome final `Churros em Casa`, versão 5.

Verificação de sintaxe do script aprovada. A falha foi injetada no adaptador de conexão do ensaio; não foi um erro SQL gerado pelo servidor MariaDB. O teste comprova reversão real após exceção durante a sequência de gravações; não comprova comportamento sob queda de conexão, indisponibilidade do servidor ou commit com resultado incerto. Nenhum acesso a registros do banco original.

Arquivos adicionados nesta validação: este relatório e `api/testes/rollback-loja-real.js`. Código da aplicação e migrações preservados. Permanecem pendentes a conferência completa das migrações/restrições, requisições simultâneas, logout real e integração pública da Loja. As seções abaixo registram etapas e pendências históricas; configuração restrita, gravação, conflito entre formulários e rollback controlado já foram concluídos conforme os registros acima.

### Conflito entre formulários e restauração confirmados

O responsável manteve o formulário antigo aberto na aba A e restaurou o nome para `Churros em Casa` pela aba B. Ao salvar o formulário antigo da aba A, recebeu: "A loja foi modificada. Atualize a página antes de salvar."

Consulta independente no MariaDB confirmou o nome original, versão 5 (um incremento desde a versão 4) e os sete horários preservados. A tentativa desatualizada não sobrescreveu o nome nem provocou outro incremento. Trata-se de teste real de conflito entre formulários, com requisições sequenciais; não comprova requisições simultâneas ou rollback após falha na gravação dos horários.

### Gravação real pelo painel confirmada

O responsável autorizou o uso do administrador e da loja existentes. API iniciada em ambiente test, escutando em 127.0.0.1:3001. HTTP real: /admin/ retornou 200; /api/admin/session e /api/admin/loja sem autenticação retornaram 401.

O responsável confirmou login e visualização dos dados no editor. Alterou o nome para `Churros em Casa [teste]`, salvou e confirmou que o valor permaneceu após recarregar. Consulta independente, somente de leitura, confirmou nome persistido, ID 1 e versão 4 (antes: 3). Os sete horários continuam iguais ao estado inicial: segunda, quarta e sexta 09:00–18:00; demais dias fechados com horários nulos. Isso confirma gravação e leitura reais neste cenário; concorrência e rollback real ainda não foram testados. Resta restaurar o nome e validar conflito com edição desatualizada.

### Atualização após configuração da conta de testes

O responsável criou a conta e atualizou localmente o arquivo de configuração. Nova consulta real, somente de leitura, confirmou:

- Conta efetiva: `churros_app_teste@localhost`.
- Banco: `churros_em_casa_teste_017`; fuso da sessão: `+00:00`.
- Privilégios de banco visíveis: somente SELECT, INSERT, UPDATE e DELETE no banco de testes.
- Privilégios globais: somente USAGE; nenhum privilégio por tabela ou coluna listado.
- O bloqueio relativo à conta compartilhada foi resolvido na configuração da API de testes. Não houve gravação de dados pela verificação.

1. Configurar e conferir a conta restrita no `api/.env.teste`.
2. Confirmar com o responsável que o administrador e o conteúdo atual da loja são adequados ao teste.
3. Conferir restrições, índices e estrutura relevantes às migrações, somente por leitura.
4. Explicar previamente cada gravação: login cria sessão; PUT altera loja e sete horários e incrementa versão; logout revoga sessão.
5. Testar login real, consulta, CSRF, edição persistida e conflito de versão.
6. Planejar teste transacional isolado, com alvo e efeitos explícitos, sem alterar schema ou introduzir falhas no banco original.
7. Validar visualmente o painel. Consulta pública da Loja e integração com as páginas continuam pendentes.

Nenhuma conclusão de prontidão para produção ou de integração completa decorre desta etapa.
