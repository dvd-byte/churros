# API consolidada — 23/10/2026

Este documento descreve o estado atual; instruções históricas dos relatórios não são passos pendentes. Os módulos já implementados não precisam ser refeitos.

## Proveniência e validação

Base dos módulos: commit `b974ad89c4d712accd90f2ed3e71f07ade7a332c`. Correção da mensagem de login: `bfb9e1c`. A revisão atual partiu de `de49976`; a comparação com a base confirma que os arquivos de execução de `api/` são os mesmos da entrega validada. As diferenças posteriores nesse diretório eram o teste da mensagem de login; no cliente `admin/api.js`, a mensagem de credenciais inválidas. Atualizações de ícones/HTML do colaborador foram preservadas.

Repetição nesta etapa no computador local: **77 verificações reais aprovadas**, mensagem `LIMPEZA_CONCLUIDA`, fixture `ensaio-5940c935b3`; **13 testes automatizados aprovados** (12 existentes e um novo pré-voo). A primeira tentativa automatizada foi impedida pelo sandbox de acessar loopback; a repetição com acesso permitido passou integralmente. O usuário confirmou novo login com a senha administrativa após o ajuste de UTC. Isso não é teste de produção nem teste no computador do colaborador.

O ensaio real usa sessão temporária, não altera senhas, remove seus registros e restaura a referência da imagem da Loja; versões/timestamps podem avançar e eventos agregados de teste não representam clientes. Resultado e limites históricos completos: [relatório dos módulos](RELATORIO-MODULOS-2026-10-23.md).

## Contrato HTTP

Mesma origem para site e API. JSON UTF-8, exceto upload multipart. Sucesso dos recursos: `{"ok":true,"data":...}`. Listas: `data.items`; escritas de conteúdo: `data.id` como string e `data.versao` como inteiro. Falha: `ok:false,data:null`, podendo incluir `erro` ou `mensagem`; clientes devem usar o status HTTP. Não depender de uma única chave de mensagem. Rotas de diagnóstico `/api` e `/api/teste` usam mensagem simples.

| Endpoints | Métodos e acesso |
| --- | --- |
| `/api/admin/login` | POST `{email,senha}`; retorna administrador e csrfToken, define cookie |
| `/api/admin/session` | GET; consulta sessão e fornece csrfToken |
| `/api/admin/logout` | POST com cookie e X-CSRF-Token; revoga sessão |
| `/api/admin/loja` | GET/PUT; proprietário; PUT contém versão e formulário completo |
| `/api/admin/{categorias,grupos,produtos,blog,galeria,cupons}` | GET lista; POST cria; PUT `/:id` edita; DELETE `/:id` remove/arquiva |
| Mesmos recursos, exceto grupos | PATCH `/:id`, `{versao,status}` |
| `/api/admin/midias` | GET lista; POST multipart campo `arquivo` |
| `/api/admin/dashboard`, `/api/admin/resgates` | GET `?period=today\|7d\|30d\|90d`, padrão 7d; proprietário |
| `/api/public/loja` | GET; informações e horários publicados |
| `/api/public/catalogo` | GET; items de categorias, cada uma com grupos e produtos publicados |
| `/api/public/blog`, `/api/public/galeria`, `/api/public/cupons` | GET listas públicas filtradas; cupons sem códigos |
| `/api/public/eventos` | POST evento agregado enumerado, mesma origem |
| `/api/public/resgates` | POST sempre 409; resgate desativado |
| `/api/produtos` | GET legado, produtos com categoria publicada e grupo ativo; preferir catálogo |
| `/uploads/<uuid>.webp` | GET imagem processada; nunca diretório arbitrário |

Todas as escritas administrativas exigem Origin da mesma origem; após login exigem cookie e X-CSRF-Token. Cookie HttpOnly, SameSite=Strict, path=/api/admin, duração de oito horas; Secure conforme HTTPS/host na implementação local atual. Essas condições ainda precisam de homologação no proxy definitivo. Visitantes não recebem CPF, hashes, sessões, códigos de cupom ou rascunhos nos recursos públicos.

PUT substitui os campos editáveis do formulário, não é edição parcial. PUT/PATCH/DELETE exigem a versão recebida no GET; conflito retorna 409 e exige recarregar. POST não recebe versão. DELETE de cupom arquiva; dependências impedem exclusões incoerentes. Não existe PATCH de grupos. Não existe GET individual de conteúdo por ID.

| Recurso | Campos do formulário |
| --- | --- |
| categorias | nome, slug, status, ordem, imagem, alt |
| grupos | nome, categoriaId, ordem |
| produtos | nome, descricao, grupoId, preco, disponivel, destaque, status, ordem, imagem, alt |
| blog | titulo, categoria, resumo, paragrafos (array de texto), status, publicadoEm, link, textoLink, imagem, alt |
| galeria | src, alt, legenda, status, ordem |
| cupons | nome, descricao, plataforma, codigoIfood, codigo99, inicio, validade, limiteResgates, condicoes, status |

IDs de conteúdo são strings; preços decimais como `"12.30"`; booleanos JSON reais. Estado editorial: rascunho/publicado/inativo; cupom: rascunho/ativo/inativo. Plataforma: ifood/99food/ambas. Datas dos formulários são locais de America/Sao_Paulo, `YYYY-MM-DDTHH:mm`; armazenamento UTC. Datas públicas ISO UTC. Imagens referenciam mídia cadastrada, não URLs arbitrárias; upload JPG/PNG/WebP até 8 MiB, processado em WebP, resposta com id/src. Galeria usa src; demais conteúdos usam imagem. Sem foto, usar string vazia onde permitido. Confira validações e campos exatos em `api/conteudo.js`, `api/rotas-admin.js` (Loja) e os exemplos executáveis em `api/testes/modulos-real.js`.

Eventos: `{evento,pagina,origem,dispositivo}`. Evento: visualizacao/clique_ifood/clique_99/clique_whatsapp; página: `/` ou caminho de uma das seis páginas públicas; origem: direto/instagram/busca/referencia/desconhecido; dispositivo: celular/tablet/desktop/desconhecido. Não enviar CPF, IP ou URL de referência completa. Dashboard distingue ausência de coleta de zero observado; resgates limita a 500 linhas e não expõe identificação.

Status relevantes: 401 sem sessão/credenciais inválidas; 403 permissão/Origin/CSRF; 404 inexistente; 409 versão/dependência/regra; 422 validação; 413 tamanho; 429 limite; 500/503 falha genérica. Consultar sessão ao abrir painel; em perda de sessão, pedir novo login. Após timeout de escrita, conferir estado antes de reenviar.

## Preparação de produção e limites

`api/producao.env.example` é um modelo sem credenciais. `node api/operacoes/validar-producao.js` verifica as variáveis já fornecidas pelo ambiente; não carrega .env, não abre conexão, não imprime valores, não migra e não habilita produção. Pode rodar no ambiente da hospedagem para apontar nomes de campos pendentes. O teste de persistência deve ocorrer antes de marcar MEDIA_PERSISTENCE_VERIFIED=yes. O validador verifica formato, não garante privilégios exclusivos, existência de volume ou topologia correta do proxy.

O servidor e database.js continuam restritos a testes; o modelo ainda não é consumido pelo runtime. A ativação futura precisa ligar origem canônica, proxy restrito, cookie Secure obrigatório e UPLOADS_DIR ao runtime em uma etapa própria, depois de confirmar infraestrutura e homologar. Não tentar publicar apenas trocando NODE_ENV ou apagando guardas.

Pendências externas: domínio, Node no hPanel, versão/compatibilidade do SQL, banco novo e conta exclusiva com segredos no painel, proxy/HTTPS e volume persistente ou armazenamento de objetos. Migrações 001–022 exigem ensaio em base vazia no servidor alvo antes de importar dados aprovados. Não reaplicar histórico sobre banco usado nem usar o banco original local.

Backup remoto deve incluir dump consistente e imagens do mesmo estado, inventário/checksums, retenção definida pelo proprietário, cópia fora do servidor e restauração em destino isolado. O teste anterior restaurou 15 tabelas, mas tinha zero uploads permanentes: restauração com imagem real e persistência após redeploy continuam pendentes. Não rotular os scripts de teste como backup de produção.

Recuperação administrativa: procedimento operacional proposto em [ACESSO-ADMINISTRATIVO.md](ACESSO-ADMINISTRATIVO.md); não há recuperação pública por e-mail implementada. Cupons aguardam decisão de identificação/CPF e unicidade. Os 152 produtos rascunho aguardam aprovação editorial.

## Aceite conjunto na hospedagem

Registrar commit publicado e ambiente, sem segredos. Executar login novo, consulta de sessão, expiração e logout; editar/persistir conteúdo; upload/publicação/desativação/exclusões; navegação anônima e negativas administrativas; datas/horários e conflito entre duas edições. Reiniciar e republicar confirmando uma imagem real; restaurar banco+imagem em base isolada e comparar. Resultados locais não substituem esse aceite. No computador do colaborador, instalar pelo lockfile e repetir npm test; o ensaio real exige exclusivamente o ambiente de testes autorizado e nenhuma edição humana simultânea.
