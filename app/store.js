// Regras de negócio da loja de demonstração "Checkout Demo".
// Os dados ficam em memória e podem ser restaurados com reset().
// Valores monetários são guardados em centavos para evitar erros de arredondamento.

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

let produtos = [];
let pedidos = [];
let proximoPedido = 1;

class ErroNegocio extends Error {
  constructor(status, codigo, mensagem, campo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campo = campo;
  }
}

function reset() {
  produtos = PRODUTOS_INICIAIS.map((p) => ({ ...p }));
  pedidos = [];
  proximoPedido = 1;
}

function ativarModoBugs(ativo) {
  modoBugs = Boolean(ativo);
}

function emReais(centavos) {
  return Math.round(centavos) / 100;
}

function produtoPublico(p) {
  return { id: p.id, nome: p.nome, preco: emReais(p.precoCentavos), estoque: p.estoque };
}

function pedidoPublico(pedido) {
  const reembolsadoCentavos = pedido.reembolsos.reduce((soma, r) => soma + r.valorCentavos, 0);
  return {
    id: pedido.id,
    status: pedido.status,
    cliente: pedido.cliente,
    pagamento: pedido.pagamento,
    itens: pedido.itens.map((i) => ({
      produtoId: i.produtoId,
      nome: i.nome,
      quantidade: i.quantidade,
      precoUnitario: emReais(i.precoCentavos),
      subtotal: emReais(i.precoCentavos * i.quantidade),
    })),
    subtotal: emReais(pedido.subtotalCentavos),
    frete: emReais(pedido.freteCentavos),
    total: emReais(pedido.totalCentavos),
    valorReembolsado: emReais(reembolsadoCentavos),
    saldoReembolsavel: emReais(pedido.totalCentavos - reembolsadoCentavos),
    reembolsos: pedido.reembolsos.map((r) => ({
      id: r.id,
      valor: emReais(r.valorCentavos),
      motivo: r.motivo,
      criadoEm: r.criadoEm,
    })),
    historico: pedido.historico,
  };
}

function listarProdutos() {
  return produtos.map(produtoPublico);
}

function buscarProduto(id) {
  const produto = produtos.find((p) => p.id === Number(id));
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
    const produto = produtos.find((p) => p.id === Number(item.produtoId));
    if (!produto) throw new ErroNegocio(404, 'PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado.', 'produtoId');
    const quantidade = Number(item.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAXIMA_POR_ITEM) {
      throw new ErroNegocio(400, 'DADOS_INVALIDOS', `A quantidade deve ser de 1 a ${QUANTIDADE_MAXIMA_POR_ITEM}.`, 'quantidade');
    }
    return { produto, quantidade };
  });

  for (const { produto, quantidade } of linhas) {
    const totalPedido = linhas.filter((l) => l.produto.id === produto.id).reduce((s, l) => s + l.quantidade, 0);
    if (totalPedido > produto.estoque) {
      throw new ErroNegocio(409, 'ESTOQUE_INSUFICIENTE', `Estoque insuficiente para "${produto.nome}".`, 'quantidade');
    }
  }

  const clienteValido = validarCliente(cliente);
  const pagamentoAprovado = processarPagamento(pagamento);

  for (const { produto, quantidade } of linhas) produto.estoque -= quantidade;

  const itensPedido = linhas.map(({ produto, quantidade }) => ({
    produtoId: produto.id,
    nome: produto.nome,
    quantidade,
    precoCentavos: produto.precoCentavos,
  }));
  const subtotalCentavos = itensPedido.reduce((s, i) => s + i.precoCentavos * i.quantidade, 0);
  const freteCentavos = calcularFrete(subtotalCentavos);

  const pedido = {
    id: `PED-${String(proximoPedido++).padStart(4, '0')}`,
    status: 'PAGO',
    cliente: clienteValido,
    pagamento: pagamentoAprovado,
    itens: itensPedido,
    subtotalCentavos,
    freteCentavos,
    totalCentavos: subtotalCentavos + freteCentavos,
    reembolsos: [],
    chavesReembolso: new Map(),
    historico: [{ status: 'PAGO', em: new Date().toISOString() }],
  };
  pedidos.push(pedido);
  return pedidoPublico(pedido);
}

function encontrarPedido(id) {
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) throw new ErroNegocio(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.');
  return pedido;
}

function buscarPedido(id) {
  return pedidoPublico(encontrarPedido(id));
}

function mudarStatus(pedido, status) {
  pedido.status = status;
  pedido.historico.push({ status, em: new Date().toISOString() });
}

// Simula a atualização enviada pela transportadora: PAGO -> ENVIADO -> ENTREGUE.
function avancarEntrega(id) {
  const pedido = encontrarPedido(id);
  const proximo = { PAGO: 'ENVIADO', ENVIADO: 'ENTREGUE' }[pedido.status];
  if (!proximo) {
    throw new ErroNegocio(409, 'TRANSICAO_INVALIDA', `Não é possível avançar um pedido com status ${pedido.status}.`);
  }
  mudarStatus(pedido, proximo);
  return pedidoPublico(pedido);
}

function cancelarPedido(id) {
  const pedido = encontrarPedido(id);
  if (pedido.status !== 'PAGO') {
    throw new ErroNegocio(409, 'CANCELAMENTO_NAO_PERMITIDO', 'Só é possível cancelar pedidos que ainda não foram enviados.');
  }
  if (!modoBugs) {
    // Devolve os itens ao estoque. (No modo com bugs, isso não acontece.)
    for (const item of pedido.itens) {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (produto) produto.estoque += item.quantidade;
    }
  }
  pedido.reembolsos.push({
    id: `REE-${pedido.reembolsos.length + 1}`,
    valorCentavos: pedido.totalCentavos,
    motivo: 'Cancelamento do pedido',
    criadoEm: new Date().toISOString(),
  });
  mudarStatus(pedido, 'CANCELADO');
  return pedidoPublico(pedido);
}

// Reembolso parcial de um pedido entregue.
// A "chave" identifica a solicitação: repetir a mesma chave não pode gerar um segundo reembolso.
function solicitarReembolso(id, { valor, motivo, chave } = {}) {
  const pedido = encontrarPedido(id);
  if (!chave || typeof chave !== 'string') {
    throw new ErroNegocio(400, 'DADOS_INVALIDOS', 'A chave da solicitação é obrigatória.', 'chave');
  }
  if (!modoBugs && pedido.chavesReembolso.has(chave)) {
    // BUG (modo com bugs): sem esta verificação, a mesma solicitação gera dois reembolsos.
    return { repetida: true, reembolso: pedido.chavesReembolso.get(chave), pedido: pedidoPublico(pedido) };
  }
  if (pedido.status !== 'ENTREGUE') {
    throw new ErroNegocio(409, 'REEMBOLSO_NAO_PERMITIDO', 'O reembolso só pode ser solicitado para pedidos entregues.');
  }

  const valorCentavos = Math.round(Number(valor) * 100);
  const jaReembolsado = pedido.reembolsos.reduce((s, r) => s + r.valorCentavos, 0);
  const saldo = pedido.totalCentavos - jaReembolsado;
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

  const reembolso = {
    id: `REE-${pedido.reembolsos.length + 1}`,
    valorCentavos,
    motivo: motivoLimpo,
    criadoEm: new Date().toISOString(),
  };
  pedido.reembolsos.push(reembolso);
  const reembolsoPublico = { id: reembolso.id, valor: emReais(valorCentavos), motivo: motivoLimpo, criadoEm: reembolso.criadoEm };
  pedido.chavesReembolso.set(chave, reembolsoPublico);
  if (valorCentavos === saldo) mudarStatus(pedido, 'REEMBOLSADO');
  return { repetida: false, reembolso: reembolsoPublico, pedido: pedidoPublico(pedido) };
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
