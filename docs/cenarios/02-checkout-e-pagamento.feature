# language: pt

Funcionalidade: Checkout e pagamento
  Como cliente da loja
  Quero informar meus dados e pagar com Pix ou cartão
  Para concluir minha compra com segurança

  Contexto:
    Dado que os dados da loja foram restaurados
    E que tenho o produto "Luminária de Mesa LED" no carrinho
    E que estou na página de checkout

  @CT10 @prioridade-alta @risco-R02
  Cenário: Concluir compra com Pix
    Quando preencho nome "Ana Souza", e-mail "ana@exemplo.com" e CEP "01310-100"
    E escolho pagar com Pix
    E confirmo o pedido
    Então devo ver a mensagem "Pedido confirmado! Acompanhe o status abaixo."
    E o pedido deve estar com status "PAGO"
    E o total do pedido deve ser "R$ 149,80"

  @CT11 @prioridade-media @risco-R04
  Cenário: Concluir compra com cartão aprovado
    Quando preencho nome "Ana Souza", e-mail "ana@exemplo.com" e CEP "01310-100"
    E escolho pagar com o cartão "4111 1111 1111 1111"
    E confirmo o pedido
    Então o pedido deve estar com status "PAGO"

  @CT12 @prioridade-media @risco-R04
  Cenário: Cartão recusado não gera pedido
    Quando preencho nome "Ana Souza", e-mail "ana@exemplo.com" e CEP "01310-100"
    E escolho pagar com o cartão "4000 0000 0000 0002"
    E confirmo o pedido
    Então devo ver a mensagem "Pagamento recusado pela operadora do cartão."
    E devo continuar na página de checkout
    E nenhum pedido deve ter sido criado

  @CT13 @prioridade-media @risco-R04
  Cenário: Número de cartão inválido é rejeitado
    Quando preencho nome "Ana Souza", e-mail "ana@exemplo.com" e CEP "01310-100"
    E escolho pagar com o cartão "1234 5678"
    E confirmo o pedido
    Então devo ver a mensagem "Número de cartão inválido."

  @CT14 @prioridade-media @risco-R07
  Cenário: Nome muito curto é rejeitado
    Quando preencho nome "Al", e-mail "ana@exemplo.com" e CEP "01310-100"
    E escolho pagar com Pix
    E confirmo o pedido
    Então devo ver a mensagem "Informe o nome completo."

  @CT15 @prioridade-media @risco-R07
  Cenário: E-mail em formato inválido é rejeitado
    Quando preencho nome "Ana Souza", e-mail "ana.exemplo.com" e CEP "01310-100"
    E escolho pagar com Pix
    E confirmo o pedido
    Então devo ver a mensagem "Informe um e-mail válido."

  @CT16 @prioridade-media @risco-R07
  Cenário: CEP incompleto é rejeitado
    Quando preencho nome "Ana Souza", e-mail "ana@exemplo.com" e CEP "0131"
    E escolho pagar com Pix
    E confirmo o pedido
    Então devo ver a mensagem "Informe um CEP com 8 dígitos."

  @CT17 @prioridade-baixa @risco-R09
  Cenário: Checkout com carrinho vazio volta para a loja
    Dado que esvaziei o carrinho
    Quando acesso a página de checkout
    Então devo ser levado para a página inicial da loja

  @CT18 @prioridade-alta @risco-R03
  Cenário: Compra concluída reduz o estoque do produto
    Quando concluo a compra com Pix
    E volto para a página inicial da loja
    Então o produto "Luminária de Mesa LED" deve mostrar "2 em estoque"
