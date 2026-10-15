# Promoções — implementação e integração futura

Rota: `paginas/promocoes.html`. Estilos: `css/promocoes.css`. Lógica: `js/promocoes.js`.

## Situação atual

O projeto contém apenas HTML, CSS e JavaScript. Não há painel administrativo, banco de dados, API de cupons ou mecanismo seguro de envio de CPF. Os posts vêm de um arquivo local e a galeria tem uma função de apresentação; nenhum deles oferece persistência administrativa reutilizável.

A nova página reutiliza cabeçalho, rodapé, menu móvel, abertura institucional, cards e botões. Links Promoções agora apontam para a página, sem remover o carrossel Novidades.

Não há cupons fictícios. A listagem começa vazia. Não há requisições de rede, localStorage, cookies ou logs de CPF. Sem serviço conectado, a ação de um eventual card apenas explica a indisponibilidade, com entrada e envio de CPF desabilitados. O formulário não possui atributo name no campo de CPF nem envio HTML nativo.

## Contrato de apresentação proposto (não é uma API implementada)

`window.promocoesCasa.exibir(cupons)` apresenta dados reais fornecidos pela integração. Cada item aceita:

- `id`: string estável, única e não vazia.
- `nome`: string não vazia.
- `descricao`: texto opcional.
- `plataforma`: `ifood`, `99food` ou `ambas`.
- `status`: `ativo`, `expirado`, `esgotado` ou `indisponivel`.
- `validade`: data/hora ISO opcional **com fuso explícito**, representando o instante em que expira. Exibição no horário de São Paulo. Datas inválidas bloqueiam o resgate.
- `condicoes`: texto opcional, sem HTML.

Não envie o código na listagem pública se ele só puder ser revelado após resgate. O frontend deliberadamente não lê um campo de código na listagem. A expiração pelo relógio do navegador é apenas uma ajuda visual; o servidor é a autoridade.

## Conectar o serviço futuro

Depois de implementar e revisar o backend, um adaptador confiável, carregado após `promocoes.js`, poderá chamar `window.promocoesCasa.conectar(servico)`. Essa configuração exige página HTTPS e duas funções:

1. `listar()`: Promise de uma lista no formato acima. Rejeitar em falhas; não converter erros em uma lista vazia.
2. `resgatar({ cupomId, cpf })`: Promise de uma resposta do backend. O CPF é normalizado para 11 dígitos e retirado do campo ao iniciar a solicitação. Usar POST HTTPS no corpo; nunca query string, logs, analytics, URL, armazenamento do navegador ou mensagem de erro. O adaptador deverá limitar o tempo de espera e rejeitar falhas de transporte. Não usar implementação mock em produção.

Resposta confirmada: `{ status: "confirmado", cupomId, resgateId, codigo }`, com identificadores e código não vazios. O cupomId deve corresponder ao solicitado. Só essa resposta revela o código. Outros estados reconhecidos: `ja_resgatado`, `indisponivel`, `cpf_invalido`. Respostas incompletas ou desconhecidas nunca mostram sucesso. Erros brutos do serviço não são exibidos.

O formulário verifica formato e dígitos verificadores do CPF; isso não comprova identidade nem consulta situação cadastral. A validação precisa ser repetida no servidor. Enquanto a resposta está pendente, o botão de envio é bloqueado. Ao fechar, o campo e o resultado são limpos. O código não é guardado no navegador.

## Responsabilidades que continuam pendentes

- Painel autenticado para publicar/editar cupons reais e informar plataforma, validade, condições e disponibilidade.
- Definição de banco e identificação de cliente; unicidade **atômica** da combinação cliente/cupom, inclusive em solicitações simultâneas ou repetidas após perda de conexão.
- Verificar expiração, estoque e elegibilidade no servidor antes de confirmar; não confiar no status, relógio ou CPF validado pelo navegador.
- Definir autenticação/verificação de identidade, proteção contra abuso, transporte seguro, tratamento e retenção dos dados e comunicação de privacidade antes de ativar coleta.
- Definir o tratamento de respostas perdidas e a recuperação de um código já concedido sem criar outro resgate.
- Confirmar como os códigos são emitidos/aceitos em cada plataforma. Controlar resgate neste site não garante uso único no iFood/99 Food; códigos compartilhados podem ser copiados. Não existe integração com as plataformas nesta entrega.

Não há backend nem deploy novo nesta entrega. A interface de integração está preparada, não conectada. Testes em ambiente simulado não confirmam funcionamento real de um servidor ou de plataformas externas.
