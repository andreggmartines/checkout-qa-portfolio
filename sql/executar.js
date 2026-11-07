// Executa SQL no banco da loja (data/checkout.db), sempre em modo somente leitura.
//
//   npm run sql:validar                       roda todas as consultas de sql/consultas-validacao.sql
//   npm run sql -- "SELECT * FROM produtos"   roda uma consulta qualquer e mostra o resultado em tabela
//
// Na validação, cada consulta procura inconsistências: 0 linhas = OK. Se alguma encontrar problemas,
// o comando termina com código 1 (o que faria um pipeline de CI falhar).

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { CAMINHO_BANCO } = require('../app/banco');

if (!fs.existsSync(CAMINHO_BANCO)) {
  console.error(`Banco não encontrado em ${CAMINHO_BANCO}. Suba a loja uma vez com "npm start".`);
  process.exit(1);
}

const db = new DatabaseSync(CAMINHO_BANCO, { readOnly: true });
const consultaAvulsa = process.argv.slice(2).join(' ').trim();

if (consultaAvulsa) {
  const linhas = db.prepare(consultaAvulsa).all();
  console.table(linhas.map((l) => ({ ...l })));
  console.log(`${linhas.length} linha(s).`);
  process.exit(0);
}

// Separa o arquivo em blocos que começam com "-- @V01 Título".
const arquivo = fs.readFileSync(path.join(__dirname, 'consultas-validacao.sql'), 'utf8');
const blocos = arquivo.split(/^-- @/m).slice(1).map((bloco) => {
  const [titulo, ...resto] = bloco.split('\n');
  return { titulo: titulo.trim(), sql: resto.join('\n') };
});

let comProblema = 0;
for (const { titulo, sql } of blocos) {
  const linhas = db.prepare(sql).all();
  if (linhas.length === 0) {
    console.log(`OK     ${titulo}`);
  } else {
    comProblema += 1;
    console.log(`FALHOU ${titulo} (${linhas.length} linha(s))`);
    console.table(linhas.map((l) => ({ ...l })));
  }
}

const totalPedidos = db.prepare('SELECT COUNT(*) AS total FROM pedidos').get().total;
console.log(`\n${blocos.length - comProblema} de ${blocos.length} validações OK, em ${totalPedidos} pedido(s) no banco.`);
process.exit(comProblema > 0 ? 1 : 0);
