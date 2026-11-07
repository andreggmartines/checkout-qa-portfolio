// Comandos reutilizáveis usados pelos testes E2E.

const CHAVE_CARRINHO = 'checkout-demo-carrinho';

// Valores em reais são exibidos com espaço não separável ("R$ 10,00"). Normaliza para comparar.
const normalizar = (texto) => texto.replace(/\s+/g, ' ').trim();

// Busca um elemento pelo atributo data-cy, que existe só para os testes e não muda com o layout.
Cypress.Commands.add('dataCy', (nome) => cy.get(`[data-cy="${nome}"]`));

// Verifica o texto de um elemento ignorando diferenças de espaçamento.
Cypress.Commands.add('deveMostrar', (nome, esperado) => {
  cy.dataCy(nome).should(($el) => {
    expect(normalizar($el.text())).to.eq(esperado);
  });
});

// Restaura produtos e estoque e apaga os pedidos, pela API.
Cypress.Commands.add('restaurarLoja', () => {
  cy.request('POST', '/api/test/reset').its('status').should('eq', 204);
});

// Card de um produto no catálogo, encontrado pelo nome.
Cypress.Commands.add('cardDoProduto', (nome) => cy.contains('[data-cy="produto-card"]', nome));

Cypress.Commands.add('adicionarAoCarrinho', (nome, vezes = 1) => {
  for (let i = 0; i < vezes; i += 1) {
    cy.cardDoProduto(nome).find('[data-cy="botao-adicionar"]').click();
  }
});

Cypress.Commands.add('itemDoCarrinho', (nome) => cy.contains('[data-cy="item-carrinho"]', nome));

// Abre uma página já com itens no carrinho (sem passar pelo catálogo).
Cypress.Commands.add('visitarComCarrinho', (caminho, itens) => {
  cy.visit(caminho, {
    onBeforeLoad(janela) {
      janela.localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
    },
  });
});

Cypress.Commands.add('preencherCliente', ({ nome, email, cep }) => {
  if (nome !== undefined) cy.dataCy('campo-nome').clear().type(nome);
  if (email !== undefined) cy.dataCy('campo-email').clear().type(email);
  if (cep !== undefined) cy.dataCy('campo-cep').clear().type(cep);
});

Cypress.Commands.add('pagarComCartao', (numero) => {
  cy.dataCy('pagamento-cartao').check();
  cy.dataCy('campo-cartao').clear().type(numero);
});

Cypress.Commands.add('pagarComPix', () => {
  cy.dataCy('pagamento-pix').check();
});

// Cria um pedido direto pela API. Usado para preparar os testes de pós-venda mais rápido.
Cypress.Commands.add('criarPedidoViaApi', (itens) =>
  cy.fixture('cliente').then((cliente) =>
    cy
      .request('POST', '/api/pedidos', { itens, cliente, pagamento: { metodo: 'pix' } })
      .its('body')
  )
);

// Simula a transportadora: cada chamada avança um status (PAGO -> ENVIADO -> ENTREGUE).
Cypress.Commands.add('avancarEntregaViaApi', (idPedido, vezes = 1) => {
  for (let i = 0; i < vezes; i += 1) {
    cy.request('POST', `/api/pedidos/${idPedido}/avancar-entrega`);
  }
});

Cypress.Commands.add('buscarPedidoViaApi', (idPedido) => cy.request(`/api/pedidos/${idPedido}`).its('body'));
