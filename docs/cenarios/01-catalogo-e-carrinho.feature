# language: pt

Funcionalidade: Catálogo e carrinho
  Como cliente da loja
  Quero ver os produtos disponíveis e montar meu carrinho
  Para saber quanto vou pagar antes de finalizar a compra

  Contexto:
    Dado que os dados da loja foram restaurados
    E que estou na página inicial da loja

  @CT01 @prioridade-baixa @risco-R10
  Cenário: Exibir os produtos com nome, preço e estoque
    Então devo ver 6 produtos no catálogo
    E o produto "Jogo de Panelas Inox 5 peças" deve custar "R$ 349,90"
    E o produto "Jogo de Panelas Inox 5 peças" deve mostrar "5 em estoque"

  @CT02 @prioridade-alta @risco-R03
  Cenário: Produto esgotado não pode ser adicionado ao carrinho
    Então o produto "Cafeteira Elétrica" deve aparecer como "Esgotado"
    E o botão de adicionar da "Cafeteira Elétrica" deve estar desabilitado

  @CT03 @prioridade-alta @risco-R02
  Cenário: Adicionar um produto atualiza o contador e o total do carrinho
    Quando adiciono o produto "Conjunto de Toalhas de Banho" ao carrinho
    Então o contador do carrinho deve mostrar 1
    E o subtotal do carrinho deve ser "R$ 89,90"

  @CT04 @prioridade-alta @risco-R02
  Cenário: Aumentar e diminuir a quantidade recalcula o subtotal
    Dado que adicionei o produto "Conjunto de Toalhas de Banho" ao carrinho
    Quando aumento a quantidade desse produto para 3
    Então o subtotal do carrinho deve ser "R$ 269,70"
    Quando diminuo a quantidade desse produto para 2
    Então o subtotal do carrinho deve ser "R$ 179,80"

  @CT05 @prioridade-baixa @risco-R09
  Cenário: Remover o último item esvazia o carrinho
    Dado que adicionei o produto "Organizador de Gavetas" ao carrinho
    Quando diminuo a quantidade desse produto para 0
    Então devo ver a mensagem "Seu carrinho está vazio."
    E o botão "Finalizar compra" deve estar desabilitado

  @CT06 @prioridade-alta @risco-R03
  Cenário: Não permitir quantidade acima do estoque disponível
    Dado que adicionei 3 unidades do produto "Luminária de Mesa LED", que tem 3 em estoque
    Quando tento adicionar mais uma unidade
    Então devo ver a mensagem "Quantidade máxima disponível para "Luminária de Mesa LED": 3."
    E a quantidade no carrinho deve continuar 3

  @CT07 @prioridade-alta @risco-R02
  Cenário: Cobrar frete em compras abaixo de R$ 200,00
    Quando adiciono o produto "Luminária de Mesa LED" ao carrinho
    Então o frete deve ser "R$ 19,90"
    E o total do carrinho deve ser "R$ 149,80"

  @CT08 @prioridade-alta @risco-R02 @valor-limite
  Cenário: Frete grátis em compra de exatamente R$ 200,00
    Quando adiciono os produtos "Organizador de Gavetas" e "Jogo de Cama Casal" ao carrinho
    Então o subtotal do carrinho deve ser "R$ 200,00"
    E o frete deve ser "Grátis"
    E o total do carrinho deve ser "R$ 200,00"

  @CT09 @prioridade-baixa @risco-R09
  Cenário: Manter os itens do carrinho após recarregar a página
    Dado que adicionei o produto "Jogo de Cama Casal" ao carrinho
    Quando recarrego a página
    Então o carrinho deve continuar com o produto "Jogo de Cama Casal"
    E o contador do carrinho deve mostrar 1
