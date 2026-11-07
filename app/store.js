// Regras de negócio da loja de demonstração "Checkout Demo".
// Os dados ficam num banco SQLite (veja app/banco.js) e podem ser restaurados com reset().
// Valores monetários são guardados em centavos para evitar erros de arredondamento.

const { abrirBanco } = require('./banco');

const FRETE_CENTAVOS = 1990;
const FRETE_GRATIS_A_PARTIR_DE = 20000; // R$ 200,00
const QUANTIDADE_MAXIMA_POR_ITEM = 10;

const CARTAO_APROVADO = '4111111111111111';
const CARTAO_RECUSADO = '4000000000000002';

const PRODUTOS_INICIAIS = [
  { id: 1, nome: 'Jogo de Panelas Inox 5 peças', precoCentavos: 34990, estoque: 5 },
  { id: 2, nome: 'Conjunto de Toalhas de Banho', precoCentavos: 8990, estoque: 10 },
  { id: 3, nome: 'Luminária de Mesa LED', precoCentavos: 12990, estoque: 3 },
  { id: 4, nome: 'Organizador de Gavetas', precoCentavos: 4010, estoque: 20 }, // + Jogo de Cama = R$ 200,00 exatos
  { id: 5, nome: 'Cafeteira Elétrica', precoCentavos: 19990, estoque: 0 },
  { id: 6, nome: 'Jogo de Cama Casal', precoCentavos: 15990, estoque: 8 },
];

// Modo com bugs conhecidos (usado nos bug reports de exemplo).
// Ative com: npm run start:bugs
let modoBugs = false;

const db = abrirBanco();
const agora = () => new Date().toISOString();

class ErroNegocio extends Error {
  constructor(status, codigo, mensagem, campo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campo = campo;
  }
}

// Executa várias operações como uma só: ou todas são gravadas, ou nenhuma.
function transacao(fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}

// Consultas usadas pela loja (com parâmetros "?", que evitam SQL injection).
const sql = {
  produtos: db.prepare('SELECT * FROM produtos ORDER BY id'),
  produto: db.prepare('SELECT * FROM produtos WHERE id = ?'),
  inserirProduto: db.prepare('INSERT INTO produtos (id, nome, preco_centavos, estoque) VALUES (?, ?, ?, ?)'),
  ajustarEstoque: db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?'),
  movimentar: db.prepare(
    'INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, pedido_id, em) VALUES (?, ?, ?, ?, ?)'
  ),
  contarPedidos: db.prepare('SELECT COUNT(*) AS total FROM pedidos'),
  inserirPedido: db.prepare(`
    INSERT INTO pedidos (id, status, cliente_nome, cliente_email, cliente_cep, pagamento_metodo, cartao_final,
                         subtotal_centavos, frete_centavos, total_centavos, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  inserirItem: db.prepare(`
    INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unitario_centavos)
    VALUES (?, ?, ?, ?, ?)`),
  pedido: db.prepare('SELECT * FROM pedidos WHERE id = ?'),
  itens: db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ? ORDER BY id'),
  reembolsos: db.prepare('SELECT * FROM reembolsos WHERE pedido_id = ? ORDER BY id'),
  reembolsoPorChave: db.prepare('SELECT * FROM reembolsos WHERE pedido_id = ? AND chave = ?'),
  inserirReembolso: db.prepare(`
    INSERT INTO reembolsos (pedido_id, codigo, valor_centavos, motivo, chave, criado_em)
    VALUES (?, ?, ?, ?, ?, ?)`),
  historico: db.prepare('SELECT status, em FROM historico_status WHERE pedido_id = ? ORDER BY id'),
  mudarStatus: db.prepare('UPDATE pedidos SET status = ? WHERE id = ?'),
  registrarStatus: db.prepare('INSERT INTO historico_status (pedido_id, status, em) VALUES (?, ?, ?)'),
};

// Apaga todos os pedidos e volta os produtos e o estoque aos valores iniciais.
function reset() {
  transacao(() => {
    db.exec(`
      DELETE FROM movimentacoes_estoque;
      DELETE FROM historico_status;
      DELETE FROM reembolsos;
      DELETE FROM itens_pedido;
      DELETE FROM pedidos;
      DELETE FROM produtos;
    `);
    for (const p of PRODUTOS_INICIAIS) {
      sql.inserirProduto.run(p.id, p.nome, p.precoCentavos, p.estoque);
      sql.movimentar.run(p.id, 'CARGA_INICIAL', p.estoque, null, agora());
    }
  });
}

function ativarModoBugs(ativo) {
  modoBugs = Boolean(ativo);
}

function emReais(centavos) {
  return Math.round(centavos) / 100;
}

// Converte as linhas do banco para o formato que a API devolve.
function produtoPublico(p) {
  return { id: p.id, nome: p.nome, preco: emReais(p.preco_centavos), estoque: p.estoque };
}

function reembolsoPublico(r) {
  return { id: r.codigo, valor: emReais(r.valor_centavos), motivo: r.motivo, criadoEm: r.criado_em };
}

function pedidoPublico(idPedido) {
  const p = sql.pedido.get(idPedido);
  const reembolsos = sql.reembolsos.all(idPedido);
  const reembolsadoCentavos = reembolsos.reduce((soma, r) => soma + r.valor_centavos, 0);
  return {
    id: p.id,
    status: p.status,
    cliente: { nome: p.cliente_nome, email: p.cliente_email, cep: p.cliente_cep },
    pagamento: p.pagamento_metodo === 'cartao' ? { metodo: 'cartao', final: p.cartao_final } : { metodo: 'pix' },
    itens: sql.itens.all(idPedido).map((i) => ({
      produtoId: i.produto_id,
      nome: i.nome_produto,
      quantidade: i.quantidade,
      precoUnitario: emReais(i.preco_unitario_centavos),
      subtotal: emReais(i.preco_unitario_centavos * i.quantidade),
    })),
    subtotal: emReais(p.subtotal_centavos),
    frete: emReais(p.frete_centavos),
    total: emReais(p.total_centavos),
    valorReembolsado: emReais(reembolsadoCentavos),
    saldoReembolsavel: emReais(p.total_centavos - reembolsadoCentavos),
    reembolsos: reembolsos.map(reembolsoPublico),
    historico: sql.historico.all(idPedido).map((h) => ({ status: h.status, em: h.em })),
  };
}

function listarProdutos() {
  return sql.produtos.all().map(produtoPublico);
}

function buscarProduto(id) {
  const produto = sql.produto.get(Number(id) || 0);
  if (!produto) throw new ErroNegocio(404, 'PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado.');
  return produtoPublico(produto);
}

function calcularFrete(subtotalCentavos) {
  const freteGratis = modoBugs
    ? subtotalCentavos > FRETE_GRATIS_A_PARTIR_DE // BUG: valor exato de R$ 200,00 paga frete
    : subtotalCentavos >= FRETE_GRATIS_A_PARTIR_DE;
  return freteGratis ? 0 : FRETE_CENTAVOS;
}

function validarCliente(cliente) {
  if (!cliente || typeof cliente !== 'object') {
    throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'Dados do cliente são obrigatórios.', 'cliente');
  }
  const nome = String(cliente.nome || '').trim();
  const email = String(cliente.email || '').trim();
  const cep = String(cliente.cep || '').replace(/\D/g, '');
  if (nome.length < 3) throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'Informe o nome completo.', 'nome');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'Informe um e-mail válido.', 'email');
  }
  if (cep.length !== 8) throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'Informe um CEP com 8 dígitos.', 'cep');
  return { nome, email, cep };
}

function processarPagamento(pagamento) {
  const metodo = pagamento && pagamento.metodo;
  if (metodo === 'pix') return { metodo: 'pix' };
  if (metodo === 'cartao') {
    const numero = String(pagamento.numeroCartao || '').replace(/\s/g, '');
    if (numero === CARTAO_RECUSADO) {
      throw new ErroNegocio(402, 'PAGAMENTO_RECUSADO', 'Pagamento recusado pela operadora do cartão.');
    }
    if (numero !== CARTAO_APROVADO) {
      throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'Número de cartão inválido.', 'numeroCartao');
    }
    return { metodo: 'cartao', final: numero.slice(-4) };
  }
  throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'Escolha a forma de pagamento: cartao ou pix.', 'metodo');
}

function criarPedido({ itens, cliente, pagamento } = {}) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroNegocio(400, 'CARRINHO_VAZIO', 'O pedido precisa ter pelo menos um item.', 'itens');
  }

  // Valida todos os itens antes de mexer no estoque.
  const linhas = itens.map((item) => {
    const produto = sql.produto.get(Number(item.produtoId) || 0);
    if (!produto) throw new ErroNegocio(404, 'PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado.', 'produtoId');
    const quantidade = Number(item.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAXIMA_POR_ITEM) {
      throw new ErroNegocio(400, 'DADOS_INVALIDOS', `A quantidade deve ser de 1 a ${QUANTIDADE_MAXIMA_POR_ITEM}.`, 'quantidade');
    }
    return { produto, quantidade };
  });

  for (const { produto } of linhas) {
    const totalPedido = linhas.filter((l) => l.produto.id === produto.id).reduce((s, l) => s + l.quantidade, 0);
    if (totalPedido > produto.estoque) {
      throw new ErroNegocio(409, 'ESTOQUE_INSUFICIENTE', `Estoque insuficiente para "${produto.nome}".`, 'quantidade');
    }
  }

  const clienteValido = validarCliente(cliente);
  const pagamentoAprovado = processarPagamento(pagamento);

  const subtotalCentavos = linhas.reduce((s, l) => s + l.produto.preco_centavos * l.quantidade, 0);
  const freteCentavos = calcularFrete(subtotalCentavos);

  // Pedido, itens, baixa de estoque e histórico são gravados juntos.
  const idPedido = transacao(() => {
    const id = `PED-${String(sql.contarPedidos.get().total + 1).padStart(4, '0')}`;
    sql.inserirPedido.run(
      id, 'PAGO', clienteValido.nome, clienteValido.email, clienteValido.cep,
      pagamentoAprovado.metodo, pagamentoAprovado.final ?? null,
      subtotalCentavos, freteCentavos, subtotalCentavos + freteCentavos, agora()
    );
    for (const { produto, quantidade } of linhas) {
      sql.inserirItem.run(id, produto.id, produto.nome, quantidade, produto.preco_centavos);
      sql.ajustarEstoque.run(-quantidade, produto.id);
      sql.movimentar.run(produto.id, 'VENDA', -quantidade, id, agora());
    }
    sql.registrarStatus.run(id, 'PAGO', agora());
    return id;
  });
  return pedidoPublico(idPedido);
}

function encontrarPedido(id) {
  const pedido = sql.pedido.get(String(id));
  if (!pedido) throw new ErroNegocio(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.');
  return pedido;
}

function buscarPedido(id) {
  return pedidoPublico(encontrarPedido(id).id);
}

function mudarStatus(idPedido, status) {
  sql.mudarStatus.run(status, idPedido);
  sql.registrarStatus.run(idPedido, status, agora());
}

// Simula a atualização enviada pela transportadora: PAGO -> ENVIADO -> ENTREGUE.
function avancarEntrega(id) {
  const pedido = encontrarPedido(id);
  const proximo = { PAGO: 'ENVIADO', ENVIADO: 'ENTREGUE' }[pedido.status];
  if (!proximo) {
    throw new ErroNegocio(409, 'TRANSICAO_INVALIDA', `Não é possível avançar um pedido com status ${pedido.status}.`);
  }
  transacao(() => mudarStatus(pedido.id, proximo));
  return pedidoPublico(pedido.id);
}

function cancelarPedido(id) {
  const pedido = encontrarPedido(id);
  if (pedido.status !== 'PAGO') {
    throw new ErroNegocio(409, 'CANCELAMENTO_NAO_PERMITIDO', 'Só é possível cancelar pedidos que ainda não foram enviados.');
  }
  transacao(() => {
    if (!modoBugs) {
      // Devolve os itens ao estoque. (No modo com bugs, isso não acontece.)
      for (const item of sql.itens.all(pedido.id)) {
        sql.ajustarEstoque.run(item.quantidade, item.produto_id);
        sql.movimentar.run(item.produto_id, 'DEVOLUCAO', item.quantidade, pedido.id, agora());
      }
    }
    const codigo = `REE-${sql.reembolsos.all(pedido.id).length + 1}`;
    sql.inserirReembolso.run(pedido.id, codigo, pedido.total_centavos, 'Cancelamento do pedido', null, agora());
    mudarStatus(pedido.id, 'CANCELADO');
  });
  return pedidoPublico(pedido.id);
}

// Reembolso parcial de um pedido entregue.
// A "chave" identifica a solicitação: repetir a mesma chave não pode gerar um segundo reembolso.
function solicitarReembolso(id, { valor, motivo, chave } = {}) {
  const pedido = encontrarPedido(id);
  if (!chave || typeof chave !== 'string') {
    throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'A chave da solicitação é obrigatória.', 'chave');
  }
  // BUG (modo com bugs): sem esta verificação, a mesma solicitação gera dois reembolsos.
  const existente = modoBugs ? undefined : sql.reembolsoPorChave.get(pedido.id, chave);
  if (existente) {
    return { repetida: true, reembolso: reembolsoPublico(existente), pedido: pedidoPublico(pedido.id) };
  }
  if (pedido.status !== 'ENTREGUE') {
    throw new ErroNegocio(409, 'REEMBOLSO_NAO_PERMITIDO', 'O reembolso só pode ser solicitado para pedidos entregues.');
  }

  const valorCentavos = Math.round(Number(valor) * 100);
  const jaReembolsado = sql.reembolsos.all(pedido.id).reduce((s, r) => s + r.valor_centavos, 0);
  const saldo = pedido.total_centavos - jaReembolsado;
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) {
    throw new ErroNegocio(422, 'VALOR_INVALIDO', 'Informe um valor de reembolso maior que zero.', 'valor');
  }
  if (valorCentavos > saldo) {
    throw new ErroNegocio(422, 'VALOR_INVALIDO', 'O valor solicitado é maior que o saldo reembolsável.', 'valor');
  }
  const motivoLimpo = String(motivo || '').trim();
  if (motivoLimpo.length < 5) {
    throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'Descreva o motivo do reembolso (mínimo de 5 caracteres).', 'motivo');
  }

  const reembolso = transacao(() => {
    const codigo = `REE-${sql.reembolsos.all(pedido.id).length + 1}`;
    sql.inserirReembolso.run(pedido.id, codigo, valorCentavos, motivoLimpo, chave, agora());
    if (valorCentavos === saldo) mudarStatus(pedido.id, 'REEMBOLSADO');
    return sql.reembolsos.all(pedido.id).find((r) => r.codigo === codigo);
  });
  return { repetida: false, reembolso: reembolsoPublico(reembolso), pedido: pedidoPublico(pedido.id) };
}

reset();

module.exports = {
  ErroNegocio,
  reset,
  ativarModoBugs,
  listarProdutos,
  buscarProduto,
  criarPedido,
  buscarPedido,
  avancarEntrega,
  cancelarPedido,
  solicitarReembolso,
  get modoBugs() {
    return modoBugs;
  },
  constantes: { FRETE_CENTAVOS, FRETE_GRATIS_A_PARTIR_DE, CARTAO_APROVADO, CARTAO_RECUSADO },
};
