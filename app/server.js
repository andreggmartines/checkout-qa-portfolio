// Servidor da loja de demonstração. Sem dependências: usa apenas o módulo http do Node.
// Serve as telas (pasta public) e a API REST em /api.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');

const PORTA = Number(process.env.PORT) || 3000;
const PASTA_PUBLICA = path.join(__dirname, 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

store.ativarModoBugs(process.argv.includes('--bugs') || process.env.CHECKOUT_BUGS === '1');

function responder(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(corpo === undefined ? '' : JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (parte) => {
      dados += parte;
      if (dados.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!dados) return resolve({});
      try {
        resolve(JSON.parse(dados));
      } catch {
        reject(new store.ErroNegocio(400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.'));
      }
    });
    req.on('error', reject);
  });
}

// Rotas da API: [método, padrão, função]
const rotas = [
  ['GET', /^\/api\/config$/, () => [200, { modoBugs: store.modoBugs }]],
  ['GET', /^\/api\/produtos$/, () => [200, store.listarProdutos()]],
  ['GET', /^\/api\/produtos\/([^/]+)$/, (m) => [200, store.buscarProduto(m[1])]],
  ['POST', /^\/api\/pedidos$/, (m, corpo) => [201, store.criarPedido(corpo)]],
  ['GET', /^\/api\/pedidos\/([^/]+)$/, (m) => [200, store.buscarPedido(m[1])]],
  ['POST', /^\/api\/pedidos\/([^/]+)\/cancelamento$/, (m) => [200, store.cancelarPedido(m[1])]],
  ['POST', /^\/api\/pedidos\/([^/]+)\/avancar-entrega$/, (m) => [200, store.avancarEntrega(m[1])]],
  [
    'POST',
    /^\/api\/pedidos\/([^/]+)\/reembolsos$/,
    (m, corpo) => {
      const resultado = store.solicitarReembolso(m[1], corpo);
      return [resultado.repetida ? 200 : 201, { reembolso: resultado.reembolso, pedido: resultado.pedido }];
    },
  ],
  // Rota de apoio aos testes: restaura produtos e estoque e apaga os pedidos.
  ['POST', /^\/api\/test\/reset$/, () => (store.reset(), [204])],
];

async function tratarApi(req, res, caminho) {
  const candidatas = rotas.filter(([, padrao]) => padrao.test(caminho));
  if (candidatas.length === 0) return responder(res, 404, { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada.' });
  const rota = candidatas.find(([metodo]) => metodo === req.method);
  if (!rota) return responder(res, 405, { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Método não permitido.' });

  try {
    const corpo = req.method === 'POST' ? await lerCorpo(req) : {};
    const [status, resposta] = rota[2](caminho.match(rota[1]), corpo);
    responder(res, status, resposta);
  } catch (erro) {
    if (erro instanceof store.ErroNegocio) {
      return responder(res, erro.status, { codigo: erro.codigo, mensagem: erro.message, campo: erro.campo });
    }
    console.error(erro);
    responder(res, 500, { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor.' });
  }
}

function servirArquivo(res, caminho) {
  const nome = caminho === '/' ? 'index.html' : caminho.slice(1);
  const arquivo = path.normalize(path.join(PASTA_PUBLICA, nome));
  if (!arquivo.startsWith(PASTA_PUBLICA)) return responder(res, 403, { mensagem: 'Acesso negado.' });
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Página não encontrada.');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    res.end(conteudo);
  });
}

const servidor = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname.startsWith('/api/')) return tratarApi(req, res, pathname);
  servirArquivo(res, decodeURIComponent(pathname));
});

servidor.listen(PORTA, () => {
  console.log(`Checkout Demo rodando em http://localhost:${PORTA}${store.modoBugs ? ' (modo com bugs ATIVO)' : ''}`);
});
