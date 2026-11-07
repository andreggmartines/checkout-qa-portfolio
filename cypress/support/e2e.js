import './commands';

// Cada teste começa com a loja no estado inicial: estoque original e nenhum pedido.
beforeEach(() => {
  cy.restaurarLoja();
});
