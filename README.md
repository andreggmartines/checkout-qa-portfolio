# Checkout Demo — Portfólio de QA

Projeto de portfólio de **Quality Assurance** de André Martines.

Uma loja virtual de artigos para casa, criada só para ser testada. O foco é o fluxo de **compra, estoque, pagamento, entrega, cancelamento e reembolso parcial**, parecido com o que existe num e-commerce de varejo real.

> 🚧 **Em construção.** Etapas do projeto:
>
> - [x] Aplicação alvo (loja + API REST)
> - [x] [Plano de testes baseado em risco](docs/plano-de-testes.md)
> - [x] [Cenários em Gherkin (BDD)](docs/cenarios/)
> - [x] [Testes E2E com Cypress](cypress/e2e/)
> - [x] [Testes de API com Postman/Newman](postman/)
> - [ ] Execução em CI com GitHub Actions
> - [ ] Bug reports de exemplo

## Como rodar a loja

Pré-requisito: [Node.js](https://nodejs.org/) 20 ou mais recente. A loja não tem dependências.

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
| POST | `/api/test/reset` | Restaura produtos e estoque e apaga os pedidos (apoio aos testes) |

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
  store.js         regras de negócio e dados em memória
  public/          telas da loja (catálogo, checkout e pedido)
docs/
  plano-de-testes.md   riscos, estratégia e matriz de cenários
  cenarios/            cenários em Gherkin (BDD)
cypress/
  e2e/             testes E2E (CT01 a CT24)
  support/         comandos customizados
  fixtures/        dados de teste
postman/
  checkout-demo.postman_collection.json   coleção com os testes de API
  local.postman_environment.json          ambiente local (baseUrl)
```
