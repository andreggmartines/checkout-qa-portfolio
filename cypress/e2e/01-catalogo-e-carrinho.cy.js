// Cenários: docs/cenarios/01-catalogo-e-carrinho.feature

describe('Catálogo e carrinho', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('CT01 - Exibe os produtos com nome, preço e estoque', () => {
    cy.dataCy('produto-card').should('have.length', 6);
    cy.cardDoProduto('Jogo de Panelas Inox 5 peças').within(() => {
      cy.deveMostrar('produto-preco', 'R$ 349,90');
      cy.deveMostrar('produto-estoque', '5 em estoque');
    });
  });

  it('CT02 - Produto esgotado não pode ser adicionado ao carrinho', () => {
    cy.cardDoProduto('Cafeteira Elétrica').within(() => {
      cy.deveMostrar('produto-estoque', 'Esgotado');
      cy.dataCy('botao-adicionar').should('be.disabled');
    });
  });

  it('CT03 - Adicionar um produto atualiza o contador e o total do carrinho', () => {
    cy.adicionarAoCarrinho('Conjunto de Toalhas de Banho');

    cy.deveMostrar('contador-carrinho', '1');
    cy.deveMostrar('carrinho-subtotal', 'R$ 89,90');
  });

  it('CT04 - Aumentar e diminuir a quantidade recalcula o subtotal', () => {
    cy.adicionarAoCarrinho('Conjunto de Toalhas de Banho');
    // O carrinho é redesenhado a cada clique, por isso o botão é buscado de novo.
    cy.itemDoCarrinho('Conjunto de Toalhas de Banho').find('[data-cy="botao-aumentar"]').click();
    cy.itemDoCarrinho('Conjunto de Toalhas de Banho').find('[data-cy="botao-aumentar"]').click();
    cy.deveMostrar('carrinho-subtotal', 'R$ 269,70');

    cy.itemDoCarrinho('Conjunto de Toalhas de Banho').find('[data-cy="botao-diminuir"]').click();
    cy.deveMostrar('carrinho-subtotal', 'R$ 179,80');
  });

  it('CT05 - Remover o último item esvazia o carrinho', () => {
    cy.adicionarAoCarrinho('Organizador de Gavetas');
    cy.itemDoCarrinho('Organizador de Gavetas').find('[data-cy="botao-diminuir"]').click();

    cy.deveMostrar('carrinho-vazio', 'Seu carrinho está vazio.');
    cy.dataCy('botao-finalizar').should('be.disabled');
  });

  it('CT06 - Não permite quantidade acima do estoque disponível', () => {
    cy.adicionarAoCarrinho('Luminária de Mesa LED', 3);
    cy.itemDoCarrinho('Luminária de Mesa LED').find('[data-cy="botao-aumentar"]').click();

    cy.deveMostrar('mensagem-carrinho', 'Quantidade máxima disponível para "Luminária de Mesa LED": 3.');
    cy.itemDoCarrinho('Luminária de Mesa LED').find('[data-cy="quantidade-item"]').should('have.text', '3');
  });

  it('CT07 - Cobra frete em compras abaixo de R$ 200,00', () => {
    cy.adicionarAoCarrinho('Luminária de Mesa LED');

    cy.deveMostrar('carrinho-frete', 'R$ 19,90');
    cy.deveMostrar('carrinho-total', 'R$ 149,80');
  });

  it('CT08 - Frete grátis em compra de exatamente R$ 200,00 (valor-limite)', () => {
    cy.adicionarAoCarrinho('Organizador de Gavetas');
    cy.adicionarAoCarrinho('Jogo de Cama Casal');

    cy.deveMostrar('carrinho-subtotal', 'R$ 200,00');
    cy.deveMostrar('carrinho-frete', 'Grátis');
    cy.deveMostrar('carrinho-total', 'R$ 200,00');

    // O valor cobrado no pedido precisa ser o mesmo que o cliente viu no carrinho.
    cy.dataCy('botao-finalizar').click();
    cy.fixture('cliente').then((cliente) => cy.preencherCliente(cliente));
    cy.pagarComPix();
    cy.dataCy('botao-pagar').click();
    cy.deveMostrar('status-pedido', 'PAGO');
    cy.deveMostrar('pedido-frete', 'Grátis');
    cy.deveMostrar('pedido-total', 'R$ 200,00');
  });

  it('CT09 - Mantém os itens do carrinho após recarregar a página', () => {
    cy.adicionarAoCarrinho('Jogo de Cama Casal');
    cy.reload();

    cy.itemDoCarrinho('Jogo de Cama Casal').should('be.visible');
    cy.deveMostrar('contador-carrinho', '1');
  });
});
