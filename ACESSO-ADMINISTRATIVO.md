# Acesso e recuperação administrativa

O login local com a conta existente foi confirmado pelo proprietário em 23/10/2026. Credenciais de banco (DB_USER/DB_PASSWORD) são distintas do e-mail/senha do painel. Não enviar nenhuma delas por chat.

## Procedimento em caso de senha esquecida

Este é o procedimento para preparar uma recuperação controlada, não um comando já implementado ou executado. Não existe endpoint público de redefinição nesta entrega.

1. O responsável pela hospedagem verifica a identidade/autorização do proprietário fora do painel. Sem isso, não alterar acesso.
2. Em terminal privado do servidor e com conta operacional autorizada, confirmar domínio, ambiente e banco alvo; fazer backup protegido. A conta web não deve ganhar privilégios de administração do banco para isso.
3. Um utilitário de manutenção revisado deverá localizar exatamente o administrador existente por ID/e-mail e perfil proprietário ativo. Nunca criar um segundo proprietário para contornar a senha e nunca reativar conta sem decisão explícita.
4. Ler nova senha duas vezes com entrada oculta, sem argumentos CLI, logs, arquivos SQL ou variável de ambiente persistente. Exigir no mínimo 12 caracteres e no máximo 128 bytes; gerar Argon2id usando a biblioteca do projeto.
5. Em uma transação, bloquear e atualizar somente esse administrador, revogar todas as suas sessões e registrar auditoria sem senha/hash/token. Reverter tudo em caso de erro; confirmar uma única conta afetada.
6. O proprietário faz login novo por HTTPS; testar que a senha anterior e sessões antigas falham, nova sessão funciona e logout revoga. Remover o acesso temporário de manutenção.

Antes de disponibilizar esse utilitário em produção, testar transação/rollback, inexistência/ambiguidade, autorização, revogação e ausência de segredos nos logs em homologação. O script criar-admin-inicial.js existente é exclusivo de testes e não serve para recuperar uma conta. Uma recuperação por e-mail exigiria projeto adicional de tokens de uso único, expiração, limites e canal de envio validado.
