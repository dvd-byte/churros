# API — revisão de integração de 23/10/2026

## Atualização após validação local com MariaDB

Consulta pública implementada: `GET /api/public/loja`, sem autenticação, somente para `loja_unica=1 AND publicada=1`. Retorna exclusivamente nome, endereço, telefone, links públicos, história, imagem permitida, alt, fuso e horários por dia. Não expõe IDs, versão, hashes ou sessões. Respostas sem cache; loja ausente/não publicada retorna 404; falha retorna 503 genérico. Loja e horários são lidos na mesma transação de leitura consistente.

`js/loja-publica.js` conecta Sobre, Onde Comprar, links de navegação/delivery e rodapés das sete páginas. Usa consulta sem cookies, texto via textContent, links HTTP(S) sem credenciais e iframe restrito ao Google Maps. Campos vazios não reutilizam contatos antigos. Falha exibe aviso e oculta dados antigos; em file:// permanece a demonstração. A API continua exclusivamente de testes: isso não habilita produção.

O login calcula `expira_em` com `DATE_ADD(NOW(3), INTERVAL 8 HOUR)`, no mesmo relógio usado para validar a sessão. Foi observada diferença de três horas entre Node e MariaDB neste computador; a causa do relógio não foi alterada. Não converter registros históricos automaticamente. Cookie mantém duração de oito horas.

Validação real detalhada em `../VALIDACAO-LOJA-2026-10-23.md`. Scripts manuais, separados de npm test:

```powershell
node testes/estrutura-real.js
node testes/rollback-loja-real.js --confirmar-banco-teste
node testes/concorrencia-loja-real.js --confirmar-banco-teste
```

O primeiro só lê. O segundo grava dentro de transação revertida, com autenticação simulada somente no processo. O terceiro cria uma sessão temporária real, faz duas requisições simultâneas, restaura conteúdo pela API e testa logout; remove somente a própria sessão ao terminar. Esse terceiro ensaio incrementa versão e timestamps e pode avançar AUTO_INCREMENT. Ambos os ensaios de escrita exigem a conta restrita configurada e não devem rodar durante edição humana. Nunca executar no banco original. Não executam migrações.

Os registros abaixo descrevem o estado anterior à validação local e suas limitações históricas; a atualização acima e o relatório prevalecem para Loja.

## Estado e limites

Node/Express com login, sessão, logout, GET /api/produtos e GET/PUT /api/admin/loja. Os demais módulos de CRUD, upload, dashboard e endpoints públicos de conteúdo ainda não estão prontos. A aplicação continua restrita a NODE_ENV=test e DB_NAME=churros_em_casa_teste_017. Não conectar ao banco original churros_em_casa; não remover essas proteções para publicar.

Esta revisão não criou administrador, não leu arquivos .env reais e não conectou ao banco. O relatório de entrega anterior registra testes do colaborador, não os desta revisão.

## Correções aplicadas

### Loja — 23/10/2026

- Consulta e edição exigem proprietário autenticado; edição também exige CSRF. Consulta retorna somente campos usados pelo formulário, resolvendo a imagem já cadastrada em midias.
- Imagem existente é preservada: o formulário mostra o caminho somente para leitura e desabilita upload de Loja. A API rejeita substituir/remover essa imagem até existir o serviço de mídia; permite editar os demais campos mantendo o caminho atual.
- Nome, endereço, história, horários, links e versão são validados. Versão desatualizada retorna 409; loja e sete dias são gravados na mesma transação, usando o ID real da loja.
- História inválida ou horários diferentes por dia retornam 409 sem converter silenciosamente os dados. Loja inexistente retorna 404 com orientação: provisionar o registro inicial com conteúdo aprovado; o endpoint não cria uma loja fictícia.
- Painel apresenta mensagens de validação do servidor para 400/404/409/422 como texto. Falhas internas permanecem genéricas. Logs de login e tratamento global não incluem mensagem de exceção nem corpo recebido.
- Dependências reinstaladas pelo lockfile, incluindo Helmet, sem scripts de instalação. Não houve auditoria de vulnerabilidades nesta etapa.
- Sete testes automatizados aprovados em 23/10: HTTP/Express/Argon2 reais com banco simulado, incluindo edição/consulta Loja, permissões, CSRF, conflito de versão, imagem preservada, rollback simulado e mensagens do cliente. Isso não valida SQL, concorrência ou rollback no MariaDB real.
- Não há api/.env.teste neste checkout. Não foi feita conexão com banco, gravação real ou validação visual no navegador nesta etapa. Nenhuma migração foi alterada.

- Produtos públicos exigem p.status e c.status publicados, grupo ativo e categoria do grupo coerente. Produto publicado indisponível continua elegível para exibição como indisponível. Não retornar rascunhos para obter a contagem antiga de 152; revisar os estados no banco de testes.
- Dotenv resolve api/.env.teste pelo diretório do módulo, não pela pasta do terminal. Validação de banco/ambiente antes de criar pool. Conector configurado com timezone UTC.
- Recursos públicos e logo servidos em diretórios limitados; não servir a raiz inteira, banco, api, documentos ou arquivos ocultos. /admin redireciona para /admin/ para manter caminhos relativos.
- Erros de JSON, tamanho e API desconhecida respondem JSON; não registrar URL completa, corpo ou stack para o visitante.
- Migração 022 remove DEFAULT 1 nos horários; loja deve ser encontrada por loja_unica=1 e horários recebem seu ID real. As migrações 001..021 foram preservadas.
- Teste SQL seguro usa bloco anônimo, verifica banco antes de escrever e tem rollback em erro. Inclui loja ID 42, horários, preço, categoria, códigos, duplicidade de resgate e métrica. Necessita execução real para homologação.

## Executar testes sem banco

Dentro de api:

```powershell
npm ci --ignore-scripts
npm test
```

As dependências não tiveram versões alteradas. Testes usam Node test runner, Express e Argon2 reais, HTTP loopback e um double de banco em memória injetado somente no processo de testes. Não lê .env nem usa credenciais. O cenário de falha do banco imprime TESTE_DB intencionalmente.

Cobertura: arquivos públicos/privados; redirecionamento do painel; presença dos filtros na SQL (não execução SQL); erros JSON/413/404/500; login/session/logout/CSRF; caminho absoluto de configuração; UTC configurado; bloqueio de produção/banco original. Não cobre transações reais, concorrência, driver conectado, visualização ou dependências auditadas.

## Executar API com banco de testes

1. Confirmar MariaDB e registros das migrações. Não reaplicar 001..021 em base existente; aplicar 022 só se pendente e após backup. Banco vazio: seguir banco/INTEGRACAO-API.md.
2. Criar api/.env.teste a partir do exemplo, com usuário restrito ao banco de testes. Não usar credenciais de produção.
3. Usar administrador de teste existente ou provisionar conforme criar-admin-inicial.js, com autorização explícita.
4. Executar:

```powershell
$env:NODE_ENV = 'test'
npm start
```

Com PORT=3001, painel em http://127.0.0.1:3001/admin/ e site em http://127.0.0.1:3001/. O site público ainda usa suas fontes estáticas; servir arquivos não significa que o CRUD esteja integrado.

Após restaurar `timezone: '+00:00'` no conector MariaDB, o login foi testado no ambiente local de testes. A sessão recém-criada apresentou duração de aproximadamente 28.800 segundos (8 horas), com `revogado_em` nulo. Verificação realizada em 21/10/2026 no banco `churros_em_casa_teste_017`. Esse teste confirma a duração da sessão observada, mas não substitui a homologação completa de datas, horários e registros históricos.

Conferir UTC da sessão e interpretação dos DATETIME já importados: a mudança da conexão não converte histórico gravado em horário local. Fonte técnica: https://mariadb.com/docs/connectors/mariadb-connector-nodejs/node-js-connection-options

## Próximo passo

Configurar api/.env.teste localmente com credenciais restritas e confirmar migrações, administrador e loja inicial no banco de desenvolvimento autorizado. Não enviar credenciais por chat ou Git. Homologar GET/PUT Loja no MariaDB real, inclusive versão antiga e falha na gravação dos horários. Depois implementar GET público com campos permitidos e conectar Onde Comprar/Sobre/rodapé. Só considerar o fluxo completo quando salvar no painel e enxergar o resultado em outra sessão, sem afetar o banco original. Alinhar a responsabilidade pelos demais endpoints antes de implementá-los em paralelo.

Produção exige configuração própria: HTTPS, cookies/proxy/origem definidos, credenciais mínimas, recuperação de acesso, armazenamento persistente, backups e teste de restauração. Não está habilitada. CPF continua pendente de decisão.
