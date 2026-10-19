
ALTER TABLE produtos
    ADD CONSTRAINT fk_produtos_imagem
    FOREIGN KEY (imagem_id)
    REFERENCES midias(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT;
