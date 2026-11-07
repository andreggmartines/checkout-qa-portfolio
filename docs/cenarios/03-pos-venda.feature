# language: pt

Funcionalidade: Pós-venda: entrega, cancelamento e reembolso
  Como cliente da loja
  Quero acompanhar meu pedido, cancelar antes do envio e pedir reembolso depois da entrega
  Para resolver problemas da compra sem precisar falar com o atendimento

  Contexto:
    Dado que os dados da loja foram restaurados
    E que fiz um pedido do produto "Conjunto de Toalhas de Banho", com 2 unidades, pagando com Pix
    E que estou na página desse pedido

  @CT19 @prioridade-baixa @risco-R08
  Cenário: Acompanhar a entrega até o pedido ser entregue
    Então o pedido deve estar com status "PAGO"
    Quando a transportadora atualiza a entrega
    Então o pedido deve estar com status "ENVIADO"
    Quando a transportadora atualiza a entrega
    Então o pedido deve estar com status "ENTREGUE"
    E o histórico deve mostrar os status "PAGO", "ENVIADO" e "ENTREGUE"

  @CT20 @prioridade-media @risco-R05
  Cenário: Cancelar pedido pago devolve os itens ao estoque
    Quando cancelo o pedido
    Então o pedido deve estar com status "CANCELADO"
    E devo ver a mensagem "Pedido cancelado. O valor total será reembolsado."
    E o produto "Conjunto de Toalhas de Banho" deve voltar a ter "10 em estoque"

  @CT21 @prioridade-media @risco-R06
  Cenário: Não permitir cancelar pedido que já foi enviado
    Quando a transportadora atualiza a entrega
    Então o pedido deve estar com status "ENVIADO"
    E a opção de cancelar o pedido não deve estar disponível

  @CT22 @prioridade-alta @risco-R01
  Cenário: Reembolso parcial válido atualiza o saldo
    Dado que o pedido foi entregue
    E que o saldo reembolsável é "R$ 199,70"
    Quando solicito reembolso de 50,00 com o motivo "Uma toalha veio com defeito"
    Então devo ver a mensagem "Reembolso solicitado com sucesso."
    E o saldo reembolsável deve ser "R$ 149,70"
    E deve existir 1 reembolso no pedido

  @CT23 @prioridade-alta @risco-R01 @valor-limite
  Cenário: Reembolso acima do saldo é rejeitado
    Dado que o pedido foi entregue
    Quando solicito reembolso de 199,71 com o motivo "Valor acima do pago"
    Então devo ver a mensagem "O valor solicitado é maior que o saldo reembolsável."
    E o saldo reembolsável deve continuar "R$ 199,70"
    E não deve existir reembolso no pedido

  @CT24 @prioridade-alta @risco-R01
  Cenário: Clique duplo no reembolso gera um único reembolso
    Dado que o pedido foi entregue
    Quando preencho o reembolso de 50,00 com o motivo "Uma toalha veio com defeito"
    E clico duas vezes seguidas em "Solicitar reembolso"
    Então deve existir 1 reembolso no pedido
    E o saldo reembolsável deve ser "R$ 149,70"
