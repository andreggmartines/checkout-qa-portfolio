// Cenários: docs/cenarios/03-pos-venda.feature
// O pedido é criado pela API (mais rápido e estável); o comportamento é testado pela interface.

const DUAS_TOALHAS = [{ produtoId: 2, quantidade: 2 }]; // R$ 179,80 + frete R$ 19,90 = R$ 199,70

describe('Pós-venda: entrega, cancelamento e reembolso', () => {
  let idPedido;

  beforeEach(() => {
    cy.criarPedidoViaApi(DUAS_TOALHAS).then((pedido) => {
      idPedido = pedido.id;
    });
  });

  const abrirPedido = () => cy.visit(`/pedido.html?id=${idPedido}`);

  const entregarPedidoEAbrir = () => {
    cy.then(() => cy.avancarEntregaViaApi(idPedido, 2));
    cy.then(abrirPedido);
    cy.deveMostrar('status-pedido', 'ENTREGUE');
  };

  const preencherReembolso = (valor, motivo) => {
    cy.dataCy('campo-valor-reembolso').clear().type(valor);
    cy.dataCy('campo-motivo-reembolso').clear().type(motivo);
  };

  it('CT19 - Acompanha a entrega até o pedido ser entregue', () => {
    abrirPedido();
    cy.deveMostrar('status-pedido', 'PAGO');

    cy.dataCy('botao-avancar-entrega').click();
    cy.deveMostrar('status-pedido', 'ENVIADO');

    cy.dataCy('botao-avancar-entrega').click();
    cy.deveMostrar('status-pedido', 'ENTREGUE');

    cy.dataCy('evento-historico').should('have.length', 3);
    ['PAGO', 'ENVIADO', 'ENTREGUE'].forEach((status, i) => {
      cy.dataCy('evento-historico').eq(i).should('contain.text', status);
    });
  });

  it('CT20 - Cancelar pedido pago devolve os itens ao estoque', () => {
    abrirPedido();
    cy.dataCy('botao-cancelar').click();

    cy.deveMostrar('status-pedido', 'CANCELADO');
    cy.deveMostrar('mensagem-sucesso', 'Pedido cancelado. O valor total será reembolsado.');

    cy.visit('/');
    cy.cardDoProduto('Conjunto de Toalhas de Banho').within(() => {
      cy.deveMostrar('produto-estoque', '10 em estoque');
    });
  });

  it('CT21 - Não permite cancelar pedido que já foi enviado', () => {
    abrirPedido();
    cy.dataCy('botao-avancar-entrega').click();

    cy.deveMostrar('status-pedido', 'ENVIADO');
    cy.dataCy('botao-cancelar').should('not.be.visible');
  });

  it('CT22 - Reembolso parcial válido atualiza o saldo', () => {
    entregarPedidoEAbrir();
    cy.deveMostrar('saldo-reembolsavel', 'R$ 199,70');

    preencherReembolso('50.00', 'Uma toalha veio com defeito');
    cy.dataCy('botao-reembolso').click();

    cy.deveMostrar('mensagem-sucesso', 'Reembolso solicitado com sucesso.');
    cy.deveMostrar('saldo-reembolsavel', 'R$ 149,70');
    cy.dataCy('item-reembolso').should('have.length', 1);
  });

  it('CT23 - Reembolso acima do saldo é rejeitado (valor-limite)', () => {
    entregarPedidoEAbrir();

    preencherReembolso('199.71', 'Valor acima do pago');
    cy.dataCy('botao-reembolso').click();

    cy.deveMostrar('mensagem-erro', 'O valor solicitado é maior que o saldo reembolsável.');
    cy.deveMostrar('saldo-reembolsavel', 'R$ 199,70');
    cy.dataCy('sem-reembolsos').should('be.visible');
  });

  it('CT24 - Clique duplo no reembolso gera um único reembolso', () => {
    entregarPedidoEAbrir();

    preencherReembolso('50.00', 'Uma toalha veio com defeito');
    // Dois cliques seguidos, como um cliente impaciente faria.
    cy.dataCy('botao-reembolso').then(($botao) => {
      $botao[0].click();
      $botao[0].click();
    });

    cy.deveMostrar('mensagem-sucesso', 'Reembolso solicitado com sucesso.');
    // Espera curta e proposital: dá tempo de uma eventual segunda requisição chegar ao servidor.
    cy.wait(500);
    cy.then(() => cy.buscarPedidoViaApi(idPedido)).its('reembolsos').should('have.length', 1);
    cy.dataCy('item-reembolso').should('have.length', 1);
    cy.deveMostrar('saldo-reembolsavel', 'R$ 149,70');
  });
});
