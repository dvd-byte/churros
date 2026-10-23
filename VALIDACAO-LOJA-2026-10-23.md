# Validação local do módulo Loja — 23/10/2026

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
