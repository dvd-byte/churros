-- 017 ja foi executada no ambiente do colaborador: nao reescrever seu historico.
-- A loja unica pode ter qualquer ID. Novos horarios devem informar o ID real.
-- Nao altera IDs nem linhas existentes e preserva a chave estrangeira.
ALTER TABLE horarios_semanais
    ALTER COLUMN loja_id DROP DEFAULT;
