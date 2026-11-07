// Banco de dados da loja: SQLite, embutido no Node (módulo node:sqlite), sem instalar nada.
// O arquivo fica em data/checkout.db e é recriado com os dados iniciais sempre que a loja sobe.
// Os testes podem abrir o mesmo arquivo (somente leitura) para validar os dados com SQL.

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const CAMINHO_BANCO = process.env.CHECKOUT_DB || path.join(__dirname, '..', 'data', 'checkout.db');

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS produtos (
    id              INTEGER PRIMARY KEY,
    nome            TEXT    NOT NULL,
    preco_centavos  INTEGER NOT NULL,
    estoque         INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id                 TEXT    PRIMARY KEY,          -- ex.: PED-0001
    status             TEXT    NOT NULL,             -- PAGO, ENVIADO, ENTREGUE, CANCELADO, REEMBOLSADO
    cliente_nome       TEXT    NOT NULL,
    cliente_email      TEXT    NOT NULL,
    cliente_cep        TEXT    NOT NULL,
    pagamento_metodo   TEXT    NOT NULL,             -- pix ou cartao
    cartao_final       TEXT,                         -- últimos 4 dígitos (só cartão)
    subtotal_centavos  INTEGER NOT NULL,
    frete_centavos     INTEGER NOT NULL,
    total_centavos     INTEGER NOT NULL,
    criado_em          TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS itens_pedido (
    id                       INTEGER PRIMARY KEY,
    pedido_id                TEXT    NOT NULL REFERENCES pedidos (id),
    produto_id               INTEGER NOT NULL REFERENCES produtos (id),
    nome_produto             TEXT    NOT NULL,
    quantidade               INTEGER NOT NULL,
    preco_unitario_centavos  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reembolsos (
    id              INTEGER PRIMARY KEY,
    pedido_id       TEXT    NOT NULL REFERENCES pedidos (id),
    codigo          TEXT    NOT NULL,                -- ex.: REE-1 (número dentro do pedido)
    valor_centavos  INTEGER NOT NULL,
    motivo          TEXT    NOT NULL,
    chave           TEXT,                            -- chave da solicitação (idempotência); nula no cancelamento
    criado_em       TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS historico_status (
    id         INTEGER PRIMARY KEY,
    pedido_id  TEXT NOT NULL REFERENCES pedidos (id),
    status     TEXT NOT NULL,
    em         TEXT NOT NULL
  );

  -- Toda entrada e saída de estoque fica registrada aqui, como num sistema de estoque real.
  -- quantidade positiva = entrada; negativa = saída.
  CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id          INTEGER PRIMARY KEY,
    produto_id  INTEGER NOT NULL REFERENCES produtos (id),
    tipo        TEXT    NOT NULL,                    -- CARGA_INICIAL, VENDA ou DEVOLUCAO
    quantidade  INTEGER NOT NULL,
    pedido_id   TEXT    REFERENCES pedidos (id),
    em          TEXT    NOT NULL
  );
`;

function abrirBanco() {
  fs.mkdirSync(path.dirname(CAMINHO_BANCO), { recursive: true });
  const db = new DatabaseSync(CAMINHO_BANCO);
  db.exec('PRAGMA journal_mode = WAL;'); // permite que os testes leiam enquanto a loja escreve
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(ESQUEMA);
  return db;
}

module.exports = { CAMINHO_BANCO, abrirBanco };
