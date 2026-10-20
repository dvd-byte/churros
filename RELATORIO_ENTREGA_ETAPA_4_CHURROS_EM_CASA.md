# Churros em Casa — Relatório técnico de entrega (até a etapa 4)

**Data:** 20/10/2026  
**Repositório:** https://github.com/dvd-byte/churros  
**Branch:** `main`  
**Commit de entrega:** `edf85ec` — `feat: implementa autenticacao administrativa e seguranca da API`  
**Escopo:** estrutura do banco de dados, API inicial, integração de leitura de produtos e segurança/autenticação administrativa em ambiente de testes.

> **Importante:** este documento registra o que foi desenvolvido e observado nos testes relatados. Não constitui auditoria formal de segurança nem declaração de prontidão para produção. O banco original `churros_em_casa` não deve ser alterado durante a continuidade dos testes.

## 1. Visão geral

O projeto possui um site/painel administrativo, uma API Node.js/Express e um banco MariaDB. Nesta entrega, a base de dados e a autenticação administrativa foram preparadas e testadas localmente. O desenvolvimento das rotas administrativas completas (CRUD, relatórios, métricas etc.) ficará para a próxima pessoa responsável.

### Organização principal

```text
churros/
├── admin/
│   ├── index.html
│   ├── admin.css
│   ├── admin.js
│   ├── api.js
│   └── INTEGRACAO.md
├── api/
│   ├── server.js
│   ├── database.js
│   ├── rotas-admin.js
│   ├── criar-admin-inicial.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
├── banco/
│   ├── migracoes/
│   └── verificacoes/
└── .gitignore
```

O arquivo `admin/INTEGRACAO.md` permanece no repositório para orientação técnica, mas foi bloqueado no acesso HTTP pelo servidor local.

## 2. Ambiente e separação dos bancos

- **Banco original:** `churros_em_casa`. Preservar; não executar migrações ou testes destrutivos nele.
- **Banco de desenvolvimento/testes da API:** `churros_em_casa_teste_017`.
- **Banco descartável mencionado pelo script de integridade:** `churros_em_casa_teste_integridade` (diferente do banco da API; não assumir que já existe ou está migrado).
- **Porta local de teste da API:** `3001`.
- **Ambiente:** Windows/PowerShell, Node.js, Express e MariaDB.

O `api/database.js` carrega `.env.teste` quando `NODE_ENV=test`, e `.env` em outros ambientes. Foi acrescentada uma checagem que, em `test`, exige `DB_NAME=churros_em_casa_teste_017`. O módulo `rotas-admin.js` também bloqueia a autenticação fora do ambiente de teste configurado. Essas verificações são defesas adicionais; não substituem privilégios mínimos no MariaDB, segregação de ambientes e revisão de deploy.

Os arquivos `.env` reais e `node_modules` estão ignorados pelo Git. O `api/.env.example` serve como modelo, sem credenciais reais.

## 3. Banco de dados

Foram criadas/organizadas migrações SQL e estruturas para as seguintes áreas (conforme as tabelas observadas durante o desenvolvimento):

- Administração: `administradores`, `sessoes_admin`, `auditoria_admin`.
- Cardápio: `categorias_cardapio`, `grupos_cardapio`, `produtos`.
- Conteúdo e mídia: `midias`, `galeria`, `posts_blog`.
- Promoções: `promocoes`, `resgates`.
- Loja e funcionamento: `loja`, `horarios_semanais`.
- Indicadores: `metricas_diarias`, `metricas_dimensoes_diarias`.

**Integridade observada:** testes de restrições `UNIQUE`, `CHECK` e chaves estrangeiras, incluindo rejeição de duplicidades e de referências inválidas. Alguns testes geraram erros esperados do MariaDB, usados para confirmar restrições.

**Migração 017:** a regra da tabela `loja` foi ajustada: em vez de exigir `id=1`, acrescenta `loja_unica` com `CHECK (loja_unica = 1)` e `UNIQUE (loja_unica)`, de modo a permitir **no máximo uma loja**, independentemente do ID. Isso não garante a existência de uma loja; garante apenas a unicidade.

**Scripts de verificação:** `banco/verificacoes/testes_integridade.sql` contém testes que podem modificar dados e/ou estruturas. **Não executar no banco original.** `testes_integridade_seguro.sql` foi preparado para um banco descartável separado, com teste de `INSERT`/`ROLLBACK`; sua execução e a validação de todos os cenários devem ser confirmadas antes de considerá-lo plenamente testado. Qualquer proteção baseada em `DATABASE()` depende da execução correta do script e das permissões do usuário.

## 4. API pública inicial

Arquivos principais: `api/server.js` e `api/database.js`.

- Servidor HTTP com Express e processamento de JSON.
- Rotas de diagnóstico e status usadas durante o desenvolvimento.
- **`GET /api/produtos`**: consulta produtos e retorna JSON, incluindo categoria e grupo por meio de `JOIN` com `categorias_cardapio` e `grupos_cardapio`; ordenação por categoria, grupo, ordem e nome.
- Durante os testes, o endpoint retornou o cardápio, com aproximadamente **152 itens reportados** (quantidade dependente do estado do banco).
- Painel administrativo estático servido em `/admin/`, com lista explícita de arquivos públicos (`index.html`, `admin.css`, `admin.js`, `api.js`). A tentativa de acessar `/admin/INTEGRACAO.md` retornou **404**.

**Atenção:** servir HTML/JS do painel publicamente não significa conceder acesso aos dados administrativos. A proteção efetiva deve existir em **cada endpoint da API**.

## 5. Segurança administrativa — etapa 4

Arquivo principal: `api/rotas-admin.js`.

### Funcionalidades implementadas

- `POST /api/admin/login`: autenticação com senha verificada por **Argon2id**.
- `GET /api/admin/session`: consulta da sessão autenticada e informações necessárias à interface.
- `POST /api/admin/logout`: revogação da sessão.
- Senhas armazenadas como hashes, não em texto simples.
- Consultas SQL parametrizadas.
- Tokens aleatórios de sessão; hash SHA-256 do token armazenado no banco.
- Cookie de sessão com `HttpOnly`, `SameSite=Strict`, escopo `/api/admin` e expiração configurada.
- Verificação de origem para requisições que modificam estado.
- Proteção CSRF com token conferido no backend.
- Limitação de tentativas de login (5 tentativas por janela de 15 minutos, no teste relatado).
- Validação de sessão ativa, não expirada e não revogada.
- Encerramento/revogação de sessão ao sair.
- Restrição do módulo de autenticação ao ambiente de testes e acesso HTTP local.
- Script `api/criar-admin-inicial.js` para criar o administrador proprietário inicial no banco de teste, com entrada de senha sem eco no terminal e hash Argon2id.

### Testes funcionais relatados

| Cenário | Resultado observado |
|---|---|
| Consultar sessão sem login | HTTP 401 |
| Login válido pelo painel | HTTP 200 |
| Consultar sessão após login | HTTP 200, usuário e token CSRF |
| Logout com token CSRF válido | HTTP 200 |
| Consultar sessão após logout | HTTP 401 |
| Verificar revogação da sessão no banco | Revogação observada |
| Logout sem cabeçalho `Origin` | HTTP 403 |
| Requisição com origem divergente | HTTP 403 |
| Seis tentativas inválidas de login | 401 nas cinco primeiras; 429 na sexta |
| Acesso a `/admin/` | Painel carregado |
| Acesso a `/admin/INTEGRACAO.md` | HTTP 404 |
| `node --check` em `database.js`, `rotas-admin.js` e `server.js` | Sem erros de sintaxe |

Esses resultados foram relatados durante o desenvolvimento local; não equivalem a testes automatizados completos, pentest ou homologação em produção.

## 6. Painel administrativo

O frontend do painel possui estrutura para dashboard, gráficos, produtos, categorias, grupos, blog, galeria, cupons, resgates e informações da loja. Há modelos de dados, formulários/listagens e mecanismos de navegação e pré-visualização.

**Limitação essencial:** a maior parte das operações administrativas ainda **não possui backend completo**. A autenticação foi integrada e testada, mas isso não significa que criar/editar/excluir produtos, gerenciar blog, resgates, métricas ou loja já esteja persistindo dados de ponta a ponta. Algumas seções continuam em modo de prévia ou sem conexão.

## 7. O que falta para o próximo desenvolvedor

1. Ler `admin/INTEGRACAO.md` e confrontar o contrato esperado pelo frontend com as rotas efetivamente existentes.
2. Implementar endpoints administrativos para cardápio, categorias, grupos, blog, galeria, promoções/cupons, resgates, loja e horários, conforme escopo combinado.
3. Implementar endpoints de métricas e gráficos, definindo coleta, agregação, período e fuso horário.
4. Aplicar **autenticação e autorização no servidor a cada rota**. Não confiar apenas em permissões ou controles da interface; definir papéis e ações permitidas.
5. Validar entradas e regras de negócio no backend; tratar erros de forma consistente e evitar vazamento de detalhes internos.
6. Implementar auditoria das alterações administrativas, quando exigida pelo contrato, e verificar políticas de concorrência/versionamento.
7. Definir armazenamento e publicação seguros de imagens/mídias, se necessários.
8. Criar testes automatizados de integração e segurança, inclusive falhas de sessão, CSRF, rate limit, SQL, permissões e transações.
9. Validar instalação do banco **do zero em ambiente descartável**, com todas as migrações na ordem correta. Não reaplicar migrações que já foram executadas sem avaliar seu efeito.
10. Planejar a adaptação para produção: HTTPS, cookies `Secure`, proxy confiável, CORS/origem, segredo/configuração de ambiente, privilégios mínimos, proteção de logs, monitoramento, backups e gestão de sessões/rate limit em múltiplas instâncias.

## 8. Como iniciar o ambiente local de testes

A partir do PowerShell:

```powershell
cd C:\Users\kevin\Documents\churros\api
npm install
$env:NODE_ENV = 'test'
node .\server.js
```

Antes de iniciar, preparar o arquivo `api/.env.teste` **localmente**, com valores apropriados e credenciais próprias, baseado no `.env.example`. **Nunca enviar `.env.teste` ao GitHub.** O banco `churros_em_casa_teste_017` deve existir e estar com o esquema esperado. Não utilizar credenciais do banco original para executar testes.

URLs locais de referência:

- `http://127.0.0.1:3001/admin/`
- `http://127.0.0.1:3001/api/produtos`
- `http://127.0.0.1:3001/api/admin/session`

O comando acima inicia a aplicação; não cria automaticamente banco, tabelas nem administrador. Para criação do administrador inicial, revisar o script correspondente e executá-lo **somente no ambiente de teste autorizado**, com as permissões adequadas.

## 9. Git e entrega

- Repositório: https://github.com/dvd-byte/churros
- Branch: `main`
- Commit enviado: `edf85ec`
- Push confirmado pelo terminal: `9b89a26..edf85ec  main -> main`.
- Arquivos novos incluídos no commit: `.gitignore`, `api/.env.example`, `api/criar-admin-inicial.js`, `api/rotas-admin.js`, `banco/verificacoes/testes_integridade_seguro.sql`.
- Arquivos atualizados no commit: `api/database.js`, `api/package.json`, `api/package-lock.json`, `api/server.js`, `banco/migracoes/017_completar_loja_e_sessoes.sql`, `banco/verificacoes/testes_integridade.sql`.

**Observação:** este relatório é um documento de entrega produzido após o push e não faz parte automaticamente do commit `edf85ec`. Para incluí-lo no repositório, é necessário adicioná-lo e realizar outro commit/push.

## 10. Resumo para quem assumirá o projeto

A base de dados, a API pública inicial de produtos e o fluxo local de autenticação administrativa foram desenvolvidos e testados em ambiente separado. O login, a sessão, o logout, a proteção CSRF, o rate limit e o bloqueio de arquivos administrativos não públicos apresentaram os resultados esperados nos testes manuais relatados. O frontend do painel já apresenta as áreas que deverão ser integradas, mas os endpoints administrativos completos ainda não estão implementados. **A próxima etapa é conectar cada funcionalidade do painel a rotas protegidas, testadas e persistidas no banco, sem tocar no banco original durante o desenvolvimento.**
