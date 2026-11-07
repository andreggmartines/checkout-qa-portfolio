// Cenários: docs/cenarios/02-checkout-e-pagamento.feature

const LUMINARIA = { produtoId: 3, quantidade: 1 };

describe('Checkout e pagamento', () => {
  let cliente;
  let cartoes;

  before(() => {
    cy.fixture('cliente').then((dados) => (cliente = dados));
    cy.fixture('pagamento').then((dados) => (cartoes = dados));
  });

  beforeEach(() => {
    cy.visitarComCarrinho('/checkout.html', [LUMINARIA]);
  });

  it('CT10 - Conclui a compra com Pix', () => {
    cy.preencherCliente(cliente);
    cy.pagarComPix();
    cy.dataCy('botao-pagar').click();

    cy.location('pathname').should('eq', '/pedido.html');
    cy.deveMostrar('mensagem-sucesso', 'Pedido confirmado! Acompanhe o status abaixo.');
    cy.deveMostrar('status-pedido', 'PAGO');
    cy.deveMostrar('pedido-total', 'R$ 149,80');
  });

  it('CT11 - Conclui a compra com cartão aprovado', () => {
    cy.preencherCliente(cliente);
    cy.pagarComCartao(cartoes.cartaoAprovado);
    cy.dataCy('botao-pagar').click();

    cy.deveMostrar('status-pedido', 'PAGO');
  });

  it('CT12 - Cartão recusado não gera pedido', () => {
    cy.preencherCliente(cliente);
    cy.pagarComCartao(cartoes.cartaoRecusado);
    cy.dataCy('botao-pagar').click();

    cy.deveMostrar('mensagem-erro', 'Pagamento recusado pela operadora do cartão.');
    cy.location('pathname').should('eq', '/checkout.html');
    cy.request({ url: '/api/pedidos/PED-0001', failOnStatusCode: false }).its('status').should('eq', 404);
  });

  it('CT13 - Número de cartão inválido é rejeitado', () => {
    cy.preencherCliente(cliente);
    cy.pagarComCartao(cartoes.cartaoInvalido);
    cy.dataCy('botao-pagar').click();

    cy.deveMostrar('mensagem-erro', 'Número de cartão inválido.');
  });

  it('CT14 - Nome muito curto é rejeitado', () => {
    cy.preencherCliente({ ...cliente, nome: 'Al' });
    cy.pagarComPix();
    cy.dataCy('botao-pagar').click();

    cy.deveMostrar('mensagem-erro', 'Informe o nome completo.');
  });

  it('CT15 - E-mail em formato inválido é rejeitado', () => {
    cy.preencherCliente({ ...cliente, email: 'ana.exemplo.com' });
    cy.pagarComPix();
    cy.dataCy('botao-pagar').click();

    cy.deveMostrar('mensagem-erro', 'Informe um e-mail válido.');
  });

  it('CT16 - CEP incompleto é rejeitado', () => {
    cy.preencherCliente({ ...cliente, cep: '0131' });
    cy.pagarComPix();
    cy.dataCy('botao-pagar').click();

    cy.deveMostrar('mensagem-erro', 'Informe um CEP com 8 dígitos.');
  });

  it('CT17 - Checkout com carrinho vazio volta para a loja', () => {
    cy.visitarComCarrinho('/checkout.html', []);

    cy.location('pathname').should('eq', '/');
  });

  it('CT18 - Compra concluída reduz o estoque do produto', () => {
    cy.preencherCliente(cliente);
    cy.pagarComPix();
    cy.dataCy('botao-pagar').click();
    cy.deveMostrar('status-pedido', 'PAGO');

    cy.visit('/');
    cy.cardDoProduto('Luminária de Mesa LED').within(() => {
      cy.deveMostrar('produto-estoque', '2 em estoque');
    });
  });
});
