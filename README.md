# Checkout Demo — Portfólio de QA

[![Testes](https://github.com/andreggmartines/checkout-qa-portfolio/actions/workflows/testes.yml/badge.svg)](https://github.com/andreggmartines/checkout-qa-portfolio/actions/workflows/testes.yml)

Projeto de portfólio de **Quality Assurance** de [André Martines](https://www.linkedin.com/in/andreggmartines/).

Uma loja virtual de artigos para casa, criada só para ser testada. O foco é o fluxo de **compra, estoque, pagamento, entrega, cancelamento e reembolso parcial**, parecido com o que existe num e-commerce de varejo real.

## Em resumo

| Entrega | Onde está |
|---|---|
| Plano de testes baseado em risco: 10 riscos priorizados por probabilidade × impacto | [docs/plano-de-testes.md](docs/plano-de-testes.md) |
| 24 cenários E2E em Gherkin (BDD), rastreáveis até os riscos | [docs/cenarios](docs/cenarios/) |
| 24 testes E2E automatizados em Cypress/JavaScript | [cypress/e2e](cypress/e2e/) |
| 14 cenários de API no Postman, com 74 verificações rodando no Newman | [postman](postman/) |
| 10 consultas SQL de validação de dados, também usadas dentro dos testes E2E | [sql](sql/) |
| Execução automática a cada push no GitHub Actions | [.github/workflows/testes.yml](.github/workflows/testes.yml) |
| 3 bug reports com passos, evidências, impacto e plano de reteste | [docs/bugs](docs/bugs/) |

**Os testes realmente pegam bugs.** A loja tem um modo com três defeitos conhecidos. Contra ele, a suíte falha exatamente nos cenários certos:

| Bug | Detectado por |
|---|---|
| Frete cobrado em compra de exatamente R$ 200,00 | CT08 |
| Cancelamento não devolve os itens ao estoque | CT20 |
| Clique duplo gera reembolso em duplicidade | CT24, API10 e consulta SQL V04 |

> Uso de IA: usei IA como apoio para rascunhos de código e documentação. A cobertura, a lógica dos testes e o código foram revisados por mim.

## Como rodar a loja

Pré-requisito: [Node.js](https://nodejs.org/) 22.13 ou mais recente. A loja não tem dependências: o banco de dados é SQLite, que já vem embutido no Node.

```bash
npm start
```

Abra http://localhost:3000.

### Modo com bugs

A loja tem alguns **bugs conhecidos**, colocados de propósito para os bug reports de exemplo. Para ligar esses bugs:

```bash
npm run start:bugs
```

Uma etiqueta vermelha "modo com bugs" aparece no topo da página.

## Testes E2E com Cypress

Os 24 cenários do [plano de testes](docs/plano-de-testes.md) estão automatizados em [`cypress/e2e`](cypress/e2e/), um arquivo por funcionalidade, seguindo os cenários em [Gherkin](docs/cenarios/).

```bash
npm install          # instala o Cypress (só na primeira vez)
npm run test:e2e     # sobe a loja e roda os 24 testes
npm run cy:open      # abre o Cypress no modo interativo (com a loja já rodando)
```

Para conferir que os testes realmente pegam os bugs, rode a suíte contra a loja no modo com bugs:

```bash
npm run test:e2e:bugs
```

Resultado esperado: **21 testes passam e 3 falham** (CT08, CT20 e CT24), um para cada bug conhecido.

**Boas práticas aplicadas**

- Seletores `data-cy`, que não quebram quando o layout ou o texto mudam.
- Dados restaurados pela API antes de cada teste (`cy.restaurarLoja()`), então os testes são independentes e podem rodar em qualquer ordem.
- Preparação pela API e verificação pela interface: nos testes de pós-venda, o pedido é criado com `cy.request()` e só o comportamento em teste passa pela tela.
- Comandos customizados em [`cypress/support/commands.js`](cypress/support/commands.js) e massa de dados em [`cypress/fixtures`](cypress/fixtures/).
- Testes de valor-limite (frete em exatamente R$ 200,00, reembolso R$ 0,01 acima do saldo).
- Validação em camadas: CT20 e CT24 conferem a tela e também o banco de dados, com SQL (`cy.consultarBanco()`).

## Integração contínua (GitHub Actions)

O workflow [`testes.yml`](.github/workflows/testes.yml) roda a cada push na `main`, em todo pull request e também sob demanda. São dois jobs em paralelo:

| Job | O que faz |
|---|---|
| **API (Postman/Newman)** | Sobe a loja, roda a coleção de API, valida os dados gravados com SQL e guarda o relatório JUnit |
| **E2E (Cypress)** | Sobe a loja, roda os 24 testes E2E e, se algo falhar, guarda as capturas de tela |

O selo no topo deste README mostra o resultado da última execução. Os detalhes de cada execução ficam na aba [Actions](https://github.com/andreggmartines/checkout-qa-portfolio/actions).

## Testes de API com Postman/Newman

A coleção em [`postman/`](postman/) cobre os 14 cenários de API do plano (API01 a API14), com **74 verificações**: status HTTP, contrato da resposta (JSON Schema), códigos de erro, regras de negócio e tempo de resposta.

```bash
npm run test:api        # sobe a loja e roda a coleção com o Newman
npm run test:api:bugs   # roda contra a loja no modo com bugs
```

Para abrir no Postman: **Import** → selecione os dois arquivos da pasta `postman/` → escolha o ambiente "Checkout Demo — Local" → rode a coleção com o **Collection Runner**, em ordem.

**Destaques**

- Encadeamento de requisições: o ID do pedido criado em API03 é salvo numa variável e reaproveitado no pós-venda.
- Teste de idempotência (API10): a mesma solicitação de reembolso, com a mesma chave, é enviada duas vezes e não pode gerar dois reembolsos.
- Validação de contrato com JSON Schema em produtos e pedidos.
- Verificações globais (tempo de resposta e `Content-Type`) aplicadas a todas as requisições.
- Relatório JUnit gerado em `reports/newman.xml`, usado no CI.

No modo com bugs, a API10 falha (o reembolso é duplicado) e, em consequência, a API12 também falha, porque o saldo já foi consumido pelo reembolso indevido.

## Validação de dados com SQL

A loja grava tudo num banco **SQLite** (`data/checkout.db`). O arquivo [`sql/consultas-validacao.sql`](sql/consultas-validacao.sql) tem 10 consultas que procuram dados inconsistentes, cada uma ligada a um risco do plano. Se uma consulta não devolve linhas, os dados estão corretos.

```bash
npm run sql:validar                          # roda as 10 validações no banco
npm run sql -- "SELECT * FROM produtos"      # roda uma consulta qualquer
```

Exemplo: depois de `npm run test:api:bugs`, a validação **V04** encontra a mesma solicitação de reembolso gravada duas vezes (o BUG-03 visto direto no banco).

O guia [`sql/README.md`](sql/README.md) explica as tabelas e cada consulta, linha por linha, e traz exercícios.

<details>
<summary>Problemas para rodar o Cypress no Windows?</summary>

Se o Cypress fechar sem mensagem de erro (falha da GPU do Electron), rode no PowerShell desativando a GPU e usando o Edge:

```powershell
$env:ELECTRON_EXTRA_LAUNCH_ARGS = "--disable-gpu --disable-gpu-sandbox"
npm start          # em um terminal
npx cypress run --browser edge   # em outro terminal
```

</details>

## Regras de negócio

| Regra | Comportamento esperado |
|---|---|
| Estoque | Não é possível comprar mais do que o estoque disponível. Produto com estoque zero aparece como esgotado. |
| Quantidade | De 1 a 10 unidades por produto. |
| Frete | R$ 19,90. Grátis para compras **a partir de** R$ 200,00. |
| Pagamento | Pix é sempre aprovado. Cartão `4111 1111 1111 1111` é aprovado, `4000 0000 0000 0002` é recusado e qualquer outro número é inválido. |
| Entrega | O status avança de `PAGO` para `ENVIADO` e depois `ENTREGUE` (simulando a transportadora). |
| Cancelamento | Só para pedidos `PAGO`, ainda não enviados. O valor total é reembolsado e os itens voltam ao estoque. |
| Reembolso parcial | Só para pedidos `ENTREGUE`. O valor deve ser maior que zero e no máximo o saldo reembolsável. Quando o saldo zera, o pedido fica `REEMBOLSADO`. |
| Solicitação repetida | Cada solicitação de reembolso tem uma chave única. Repetir a mesma chave (por exemplo, com clique duplo) **não** pode gerar um segundo reembolso. |

## API REST

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos` | Lista produtos, preços e estoque |
| GET | `/api/produtos/:id` | Detalha um produto |
| POST | `/api/pedidos` | Cria um pedido (itens, cliente e pagamento) |
| GET | `/api/pedidos/:id` | Consulta um pedido |
| POST | `/api/pedidos/:id/avancar-entrega` | Simula a transportadora avançando o status |
| POST | `/api/pedidos/:id/cancelamento` | Cancela um pedido ainda não enviado |
| POST | `/api/pedidos/:id/reembolsos` | Solicita reembolso parcial (`valor`, `motivo`, `chave`) |
| POST | `/api/test/reset` | Restaura produtos e estoque e apaga os pedidos no banco (apoio aos testes) |

Erros retornam um JSON no formato `{ "codigo": "...", "mensagem": "...", "campo": "..." }`, com status HTTP 400, 402, 404, 409 ou 422, conforme o caso.

Exemplo de criação de pedido:

```json
POST /api/pedidos
{
  "itens": [{ "produtoId": 1, "quantidade": 1 }],
  "cliente": { "nome": "Ana Souza", "email": "ana@exemplo.com", "cep": "01310-100" },
  "pagamento": { "metodo": "cartao", "numeroCartao": "4111111111111111" }
}
```

## Estrutura

```
app/
  server.js        servidor HTTP e rotas da API
  banco.js         banco SQLite: tabelas e conexão
  store.js         regras de negócio
  public/          telas da loja (catálogo, checkout e pedido)
docs/
  plano-de-testes.md   riscos, estratégia e matriz de cenários
  cenarios/            cenários em Gherkin (BDD)
  bugs/                bug reports com evidências
cypress/
  e2e/             testes E2E (CT01 a CT24)
  support/         comandos customizados
  fixtures/        dados de teste
postman/
  checkout-demo.postman_collection.json   coleção com os testes de API
  local.postman_environment.json          ambiente local (baseUrl)
sql/
  consultas-validacao.sql   consultas que procuram dados inconsistentes
  executar.js               roda as consultas no banco (somente leitura)
  README.md                 guia de estudo das consultas
```
