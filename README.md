# churros

Vitrine e blog da Churros em Casa, com painel administrativo e API Node/Express/MariaDB. Pedidos e pagamentos acontecem exclusivamente no iFood/99 Food.

## Estado atual

CRUDs de conteúdo, upload, Loja, dashboard/métricas e consultas públicas implementados no ambiente local de testes. Produção ainda bloqueada. CPF e resgates públicos desativados por decisão pendente; códigos não são divulgados pela API pública.

- [Relatório mais recente e testes reais](RELATORIO-MODULOS-2026-10-23.md).
- [Execução e limites da API](api/README.md).
- [Contrato do painel](admin/INTEGRACAO.md).
- [Preparação para Hostinger Unlimited](PUBLICACAO-HOSTINGER.md).

Dentro de api, use `npm ci --ignore-scripts`, `npm test` e configure `.env.teste` localmente. Para iniciar, defina NODE_ENV=test no processo e execute npm start. Nunca versionar credenciais, backups, uploads ou node_modules.

## Entrega consolidada atual

Contrato HTTP, evidências de validação e pendências: [ENTREGA-API.md](ENTREGA-API.md). Preparação de variáveis de produção: `api/producao.env.example` e `api/operacoes/validar-producao.js` (pré-voo sem conexão e sem habilitar produção). Procedimento de recuperação proposto: [ACESSO-ADMINISTRATIVO.md](ACESSO-ADMINISTRATIVO.md).
