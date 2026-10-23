# Publicação na Hostinger — preparação, ainda não executada

O responsável informou plano **Unlimited**. A documentação oficial atual inclui Business/Unlimited no suporte a aplicações Node.js/Express: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/. Limites e restrições: https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/.

## Estado deste repositório

A API continua bloqueada fora de `NODE_ENV=test` e de `churros_em_casa_teste_017`, vinculada a 127.0.0.1. Não configurar esse banco local como banco público e não remover as travas para obter um deploy. Nenhuma conexão com hPanel, banco remoto, alteração de DNS ou publicação foi realizada.

## Informações necessárias no hPanel

1. Domínio definitivo e opção de criar aplicação Node/Express disponível nessa conta.
2. Versão real do servidor de banco remoto (`SELECT VERSION()`), endereço e conexão permitida para a aplicação. Não presumir compatibilidade MySQL apenas porque o painel usa esse nome.
3. Banco novo para homologação remota, usuário exclusivo e credenciais configuradas no servidor, sem commit ou envio por chat.
4. Armazenamento persistente para mídia. Hoje os arquivos ficam em `api/var/uploads`, ignorados pelo Git; confirmar se o diretório persiste entre deploys. Se não persistir, configurar armazenamento de objetos antes de usar uploads em produção.
5. Terminação HTTPS/proxy e domínio canônico. A futura configuração deve usar origem explícita, cookie Secure e proxy confiável restrito ao proxy real; não confiar indiscriminadamente em X-Forwarded-For/Host/Proto.

## Revisão necessária antes de habilitar produção

- Criar configuração de produção separada e revisada, com banco próprio e travas contra o banco original. A configuração atual de testes permanece intacta até essa etapa ser autorizada e validada.
- Definir entrada da aplicação e estrutura do pacote: `api/server.js` depende dos arquivos públicos no diretório pai. Não enviar somente `api/` nem servir a raiz do repositório como diretório estático.
- Node 24 é a versão usada localmente. Instalar dependências em Linux a partir de `api/package-lock.json`; validar Argon2 e Sharp nesse ambiente. Não copiar node_modules do Windows.
- Revisar conteúdo aprovado, publicação e mídias. Os registros existentes não foram importados nem publicados em lote; demonstrações permanecem no HTML para file://.
- Validar migrações em base nova e compatibilidade da versão remota. Não reaplicar migrações históricas em base usada. O banco original local não é alvo de implantação.
- Preparar criação/recuperação administrativa com procedimento local autorizado, monitoramento, retenção de logs sem segredos e política de backup do banco e arquivos. Os scripts deste repositório são deliberadamente de testes.
- Repetir fluxo HTTP/HTTPS real: login novo, sessão/expiração/logout, CSRF, CRUD, upload, rascunhos, concorrência, clique/métrica, site em sessão sem autenticação, responsividade e restauração remota.
- Confirmar persistência de mídia e comportamento após reinício/deploy antes da entrega operacional.

## Promoções e privacidade

Listagem pública de condições implementada. Resgate no site retorna 409; códigos não são enviados publicamente; formulário CPF permanece oculto. Definição de identificação, unicidade, retenção e privacidade é decisão pendente do responsável. Não conectar um serviço de CPF ou divulgar códigos automaticamente para contornar essa decisão. O pagamento e os pedidos continuam exclusivamente nos aplicativos.

## Backup/restauração local reproduzível

Com a API parada, em api:

```powershell
node operacoes/backup-teste.js
node operacoes/restaurar-teste.js 'CAMINHO_LOCAL_DO_BACKUP' --confirmar-restauracao
```

O backup é salvo em backups/, fora do Git. Contém dados privados: não enviar ao chat/GitHub. A restauração só aceita o banco separado `churros_em_casa_teste_restauracao`, vazio, com conta exclusiva e `.env.restauracao` local. Compara SHA-256 do dump, schemas, registros e uploads disponíveis. Não apaga nem sobrescreve uma base já preenchida. Rotinas, triggers e eventos não são incluídos neste dump de tabelas; definir backup completo do ambiente real na publicação.

`node operacoes/limpar-midias.js` é somente leitura por padrão. O parâmetro `--excluir` remove explicitamente apenas mídias sem referência e arquivos sem registro com pelo menos 48 horas, dentro da pasta de uploads do banco de testes. Não foi executada exclusão por esse utilitário nesta etapa.
