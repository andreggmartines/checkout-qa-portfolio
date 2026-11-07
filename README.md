# Checkout Demo — Portfólio de QA

Projeto de portfólio de **Quality Assurance** de André Martines.

Uma loja virtual de artigos para casa, criada só para ser testada. O foco é o fluxo de **compra, estoque, pagamento, entrega, cancelamento e reembolso parcial**, parecido com o que existe num e-commerce de varejo real.

> 🚧 **Em construção.** Etapas do projeto:
>
> - [x] Aplicação alvo (loja + API REST)
> - [x] [Plano de testes baseado em risco](docs/plano-de-testes.md)
> - [ ] Cenários em Gherkin (BDD)
> - [ ] Testes E2E com Cypress
> - [ ] Testes de API com Postman/Newman
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
  server.js    servidor HTTP e rotas da API
  store.js     regras de negócio e dados em memória
  public/      telas da loja (catálogo, checkout e pedido)
```
