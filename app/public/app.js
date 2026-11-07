// Comportamento das telas da loja. Um único arquivo, separado por página (atributo data-pagina do <body>).

const CHAVE_CARRINHO = 'checkout-demo-carrinho';
const FRETE = 19.9;
const FRETE_GRATIS_A_PARTIR_DE = 200;
const QUANTIDADE_MAXIMA = 10;

const $ = (seletor) => document.querySelector(`[data-cy="${seletor}"]`);
const moeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let modoBugs = false;

async function api(metodo, caminho, corpo) {
  const resposta = await fetch(caminho, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resposta.ok) throw Object.assign(new Error(dados?.mensagem || 'Erro inesperado.'), { dados, status: resposta.status });
  return dados;
}

function mostrar(elemento, texto) {
  elemento.textContent = texto;
  elemento.classList.remove('oculto');
}

function esconder(elemento) {
  elemento.classList.add('oculto');
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Carrinho (guardado no navegador) ----------

function lerCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || [];
  } catch {
    return [];
  }
}

function salvarCarrinho(itens) {
  localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
}

function calcularTotais(itens, produtos) {
  const subtotal = itens.reduce((soma, item) => {
    const produto = produtos.find((p) => p.id === item.produtoId);
    return soma + (produto ? produto.preco * item.quantidade : 0);
  }, 0);
  const frete = itens.length === 0 || subtotal >= FRETE_GRATIS_A_PARTIR_DE ? 0 : FRETE;
  return { subtotal, frete, total: subtotal + frete };
}

function htmlTotais({ subtotal, frete, total }, prefixo) {
  return `
    <div class="linha-total"><span>Subtotal</span><span data-cy="${prefixo}-subtotal">${moeda(subtotal)}</span></div>
    <div class="linha-total"><span>Frete</span><span data-cy="${prefixo}-frete">${frete === 0 ? 'Grátis' : moeda(frete)}</span></div>
    <div class="linha-total total"><span>Total</span><span data-cy="${prefixo}-total">${moeda(total)}</span></div>`;
}

// ---------- Página: catálogo ----------

async function paginaCatalogo() {
  const produtos = await api('GET', '/api/produtos');
  const lista = $('lista-produtos');

  lista.innerHTML = produtos
    .map(
      (p) => `
      <article class="cartao produto" data-cy="produto-card" data-produto-id="${p.id}">
        <h3 data-cy="produto-nome">${escapar(p.nome)}</h3>
        <div class="preco" data-cy="produto-preco">${moeda(p.preco)}</div>
        <div class="estoque" data-cy="produto-estoque">${p.estoque > 0 ? `${p.estoque} em estoque` : 'Esgotado'}</div>
        <button type="button" data-cy="botao-adicionar" data-produto-id="${p.id}" ${p.estoque === 0 ? 'disabled' : ''}>
          ${p.estoque > 0 ? 'Adicionar ao carrinho' : 'Indisponível'}
        </button>
      </article>`
    )
    .join('');

  function limiteDe(produto) {
    return Math.min(produto.estoque, QUANTIDADE_MAXIMA);
  }

  function alterarQuantidade(produtoId, delta) {
    const aviso = $('mensagem-carrinho');
    esconder(aviso);
    const produto = produtos.find((p) => p.id === produtoId);
    const itens = lerCarrinho();
    const item = itens.find((i) => i.produtoId === produtoId);
    const atual = item ? item.quantidade : 0;
    const nova = atual + delta;

    if (nova > limiteDe(produto)) {
      mostrar(aviso, `Quantidade máxima disponível para "${produto.nome}": ${limiteDe(produto)}.`);
      return;
    }
    if (nova <= 0) {
      salvarCarrinho(itens.filter((i) => i.produtoId !== produtoId));
    } else if (item) {
      item.quantidade = nova;
      salvarCarrinho(itens);
    } else {
      salvarCarrinho([...itens, { produtoId, quantidade: nova }]);
    }
    desenharCarrinho();
  }

  function desenharCarrinho() {
    // Remove do carrinho produtos que não existem mais.
    const itens = lerCarrinho().filter((i) => produtos.some((p) => p.id === i.produtoId));
    salvarCarrinho(itens);

    $('contador-carrinho').textContent = itens.reduce((s, i) => s + i.quantidade, 0);
    $('itens-carrinho').innerHTML =
      itens.length === 0
        ? '<p class="vazio" data-cy="carrinho-vazio">Seu carrinho está vazio.</p>'
        : itens
            .map((i) => {
              const p = produtos.find((x) => x.id === i.produtoId);
              return `
              <div class="item-carrinho" data-cy="item-carrinho" data-produto-id="${p.id}">
                <span>${escapar(p.nome)}</span>
                <span class="controles">
                  <button type="button" class="pequeno secundario" data-cy="botao-diminuir" data-produto-id="${p.id}" aria-label="Diminuir">−</button>
                  <span data-cy="quantidade-item">${i.quantidade}</span>
                  <button type="button" class="pequeno secundario" data-cy="botao-aumentar" data-produto-id="${p.id}" aria-label="Aumentar">+</button>
                </span>
              </div>`;
            })
            .join('');
    $('resumo-carrinho').innerHTML = itens.length ? htmlTotais(calcularTotais(itens, produtos), 'carrinho') : '';
    $('botao-finalizar').disabled = itens.length === 0;
  }

  document.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-produto-id]');
    if (!botao) return;
    const id = Number(botao.dataset.produtoId);
    const acao = botao.dataset.cy;
    if (acao === 'botao-adicionar' || acao === 'botao-aumentar') alterarQuantidade(id, 1);
    if (acao === 'botao-diminuir') alterarQuantidade(id, -1);
  });

  $('botao-finalizar').addEventListener('click', () => {
    window.location.href = '/checkout.html';
  });

  desenharCarrinho();
}

// ---------- Página: checkout ----------

async function paginaCheckout() {
  const itens = lerCarrinho();
  if (itens.length === 0) {
    window.location.href = '/';
    return;
  }
  const produtos = await api('GET', '/api/produtos');

  $('itens-resumo').innerHTML = itens
    .map((i) => {
      const p = produtos.find((x) => x.id === i.produtoId);
      return p ? `<div class="linha-total" data-cy="item-resumo"><span>${i.quantidade}× ${escapar(p.nome)}</span><span>${moeda(p.preco * i.quantidade)}</span></div>` : '';
    })
    .join('');
  $('resumo-checkout').innerHTML = htmlTotais(calcularTotais(itens, produtos), 'checkout');

  const form = $('form-checkout');
  const blocoCartao = $('bloco-cartao');
  form.addEventListener('change', () => {
    blocoCartao.classList.toggle('oculto', form.metodo.value !== 'cartao');
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const erro = $('mensagem-erro');
    esconder(erro);
    const botao = $('botao-pagar');
    botao.disabled = true;

    try {
      const pedido = await api('POST', '/api/pedidos', {
        itens: lerCarrinho(),
        cliente: { nome: form.nome.value, email: form.email.value, cep: form.cep.value },
        pagamento: { metodo: form.metodo.value, numeroCartao: form.numeroCartao.value },
      });
      salvarCarrinho([]);
      window.location.href = `/pedido.html?id=${encodeURIComponent(pedido.id)}&novo=1`;
    } catch (falha) {
      mostrar(erro, falha.message);
      botao.disabled = false;
    }
  });
}

// ---------- Página: pedido ----------

async function paginaPedido() {
  const parametros = new URLSearchParams(window.location.search);
  const id = parametros.get('id');
  const erro = $('mensagem-erro');
  const sucesso = $('mensagem-sucesso');
  let chaveReembolso = crypto.randomUUID();

  if (parametros.get('novo')) mostrar(sucesso, 'Pedido confirmado! Acompanhe o status abaixo.');

  function desenhar(pedido) {
    $('numero-pedido').textContent = pedido.id;
    $('status-pedido').textContent = pedido.status;
    $('itens-pedido').innerHTML = pedido.itens
      .map((i) => `<tr data-cy="item-pedido"><td>${escapar(i.nome)}</td><td>${i.quantidade}</td><td>${moeda(i.subtotal)}</td></tr>`)
      .join('');
    $('totais-pedido').innerHTML =
      htmlTotais(pedido, 'pedido') +
      (pedido.valorReembolsado > 0
        ? `<div class="linha-total"><span>Reembolsado</span><span data-cy="pedido-reembolsado">${moeda(pedido.valorReembolsado)}</span></div>`
        : '');
    $('historico-pedido').innerHTML = pedido.historico
      .map((h) => `<li data-cy="evento-historico">${h.status} — ${new Date(h.em).toLocaleString('pt-BR')}</li>`)
      .join('');
    $('lista-reembolsos').innerHTML = pedido.reembolsos.length
      ? pedido.reembolsos
          .map((r) => `<li data-cy="item-reembolso">${r.id}: ${moeda(r.valor)} — ${escapar(r.motivo)}</li>`)
          .join('')
      : '<li class="vazio" data-cy="sem-reembolsos">Nenhum reembolso.</li>';
    $('saldo-reembolsavel').textContent = moeda(pedido.saldoReembolsavel);

    $('botao-cancelar').classList.toggle('oculto', pedido.status !== 'PAGO');
    $('botao-avancar-entrega').classList.toggle('oculto', !['PAGO', 'ENVIADO'].includes(pedido.status));
    $('bloco-reembolso').classList.toggle('oculto', pedido.status !== 'ENTREGUE');
  }

  async function executar(acao, mensagemOk) {
    esconder(erro);
    esconder(sucesso);
    try {
      const resultado = await acao();
      desenhar(resultado.pedido || resultado);
      if (mensagemOk) mostrar(sucesso, mensagemOk);
      return true;
    } catch (falha) {
      mostrar(erro, falha.message);
      return false;
    }
  }

  try {
    desenhar(await api('GET', `/api/pedidos/${encodeURIComponent(id)}`));
  } catch (falha) {
    esconder($('detalhe-pedido'));
    mostrar(erro, falha.message);
    return;
  }

  $('botao-cancelar').addEventListener('click', () =>
    executar(() => api('POST', `/api/pedidos/${id}/cancelamento`), 'Pedido cancelado. O valor total será reembolsado.')
  );
  $('botao-avancar-entrega').addEventListener('click', () => executar(() => api('POST', `/api/pedidos/${id}/avancar-entrega`)));

  const form = $('form-reembolso');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const botao = $('botao-reembolso');
    // Correção do bug de reembolso duplicado: o botão fica bloqueado enquanto a solicitação é enviada.
    // No modo com bugs, o botão continua clicável.
    if (!modoBugs) botao.disabled = true;
    const ok = await executar(
      () => api('POST', `/api/pedidos/${id}/reembolsos`, { valor: Number(form.valor.value), motivo: form.motivo.value, chave: chaveReembolso }),
      'Reembolso solicitado com sucesso.'
    );
    if (ok) {
      form.reset();
      chaveReembolso = crypto.randomUUID();
    }
    botao.disabled = false;
  });
}

// ---------- Início ----------

(async function iniciar() {
  try {
    modoBugs = (await api('GET', '/api/config')).modoBugs;
  } catch {
    modoBugs = false;
  }
  if (modoBugs) document.querySelectorAll('[data-cy="selo-bugs"]').forEach((e) => e.classList.remove('oculto'));

  const paginas = { catalogo: paginaCatalogo, checkout: paginaCheckout, pedido: paginaPedido };
  await paginas[document.body.dataset.pagina]?.();
})();
