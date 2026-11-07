# Validação de dados com SQL

Guia de estudo das consultas usadas para validar os dados da loja.

**Por que um QA usa SQL?** A tela pode mostrar "1 reembolso" e o banco ter gravado dois. Validar no banco confirma que a regra de negócio foi cumprida de verdade, e não só na interface. É também o jeito mais rápido de preparar e investigar massa de dados.

## Como rodar

O banco é criado em `data/checkout.db` quando a loja sobe. Os comandos abaixo abrem o banco **somente para leitura**: não dá para estragar os dados.

```bash
npm start                                    # sobe a loja (cria o banco com os dados iniciais)
npm run sql -- "SELECT * FROM produtos"      # roda uma consulta qualquer
npm run sql:validar                          # roda as 10 consultas de validação
```

Para ver as validações encontrando bugs de verdade:

```bash
npm run test:api:bugs     # roda a coleção de API contra a loja com bugs
npm run sql:validar       # a V04 encontra o reembolso duplicado
```

## As tabelas

```
produtos                 pedidos                         itens_pedido
- id (PK)                - id (PK)  ex.: PED-0001        - id (PK)
- nome                   - status                        - pedido_id  -> pedidos.id
- preco_centavos         - cliente_nome / email / cep    - produto_id -> produtos.id
- estoque                - pagamento_metodo              - nome_produto
                         - cartao_final                  - quantidade
                         - subtotal_centavos             - preco_unitario_centavos
                         - frete_centavos
                         - total_centavos
                         - criado_em

reembolsos               historico_status                movimentacoes_estoque
- id (PK)                - id (PK)                       - id (PK)
- pedido_id -> pedidos   - pedido_id -> pedidos          - produto_id -> produtos
- codigo  ex.: REE-1     - status                        - tipo: CARGA_INICIAL, VENDA, DEVOLUCAO
- valor_centavos         - em                            - quantidade (+ entrada, - saída)
- motivo                                                 - pedido_id -> pedidos
- chave (idempotência)                                   - em
- criado_em
```

- **PK (chave primária):** identifica cada linha de forma única.
- **`->` (chave estrangeira):** liga uma linha a outra tabela. É por essas colunas que se faz o `JOIN`.
- **Valores em centavos:** `19970` = R$ 199,70. Guardar em centavos evita erros de arredondamento com dinheiro.
- **`movimentacoes_estoque`:** cada entrada e saída de estoque fica registrada. Somando as movimentações de um produto, o resultado tem que ser igual ao estoque atual.

## As consultas de validação, uma a uma

Todas seguem a mesma ideia: **procurar o que está errado**. Resultado vazio = dados corretos.

| ID | O que procura | Conceitos de SQL | Risco / bug |
|---|---|---|---|
| V01 | Total diferente de subtotal + frete | `WHERE` com cálculo, `<>` (diferente) | R02 |
| V02 | Subtotal diferente da soma dos itens | `JOIN`, `SUM`, `GROUP BY`, `HAVING` | R02 |
| V03 | Frete cobrado a partir de R$ 200,00 | `WHERE` com `AND`, valor-limite (`>=`) | R02, BUG-01 |
| V04 | Mesma chave de reembolso gravada 2 vezes | `GROUP BY`, `COUNT`, `HAVING` | R01, BUG-03 |
| V05 | Reembolsos acima do valor pago | `JOIN`, `SUM`, `HAVING` | R01 |
| V06 | Pedido cancelado sem devolução ao estoque | `LEFT JOIN` + `IS NULL` | R05, BUG-02 |
| V07 | Estoque diferente da soma das movimentações | subconsulta, `SUM`, `COALESCE` | R03 |
| V08 | Estoque negativo | `WHERE` simples | R03 |
| V09 | Pedido sem itens | `NOT EXISTS` | Integridade |
| V10 | Status diferente do último do histórico | subconsulta com `ORDER BY` e `LIMIT` | R08 |

### V04 explicada linha por linha (reembolso duplicado)

```sql
SELECT pedido_id, chave, COUNT(*) AS vezes, SUM(valor_centavos) AS total_centavos
FROM reembolsos
WHERE chave IS NOT NULL
GROUP BY pedido_id, chave
HAVING COUNT(*) > 1;
```

1. `FROM reembolsos`: olha a tabela de reembolsos.
2. `WHERE chave IS NOT NULL`: ignora os reembolsos de cancelamento, que não têm chave.
3. `GROUP BY pedido_id, chave`: junta numa linha só todos os reembolsos com o mesmo pedido e a mesma chave.
4. `COUNT(*)` conta quantos reembolsos caíram em cada grupo; `SUM(valor_centavos)` soma os valores.
5. `HAVING COUNT(*) > 1`: mostra só os grupos com mais de um reembolso. `HAVING` filtra **depois** do agrupamento; `WHERE` filtra **antes**.

Se essa consulta devolve alguma linha, a mesma solicitação gerou mais de um reembolso: é o BUG-03.

### V06 explicada linha por linha (estoque não devolvido)

```sql
SELECT p.id AS pedido_id, i.produto_id, i.nome_produto, i.quantidade
FROM pedidos p
JOIN itens_pedido i ON i.pedido_id = p.id
LEFT JOIN movimentacoes_estoque m
       ON m.pedido_id = p.id
      AND m.produto_id = i.produto_id
      AND m.tipo = 'DEVOLUCAO'
WHERE p.status = 'CANCELADO'
  AND m.id IS NULL;
```

1. `FROM pedidos p JOIN itens_pedido i`: junta cada pedido com seus itens. `p` e `i` são apelidos.
2. `LEFT JOIN movimentacoes_estoque m ...`: tenta achar, para cada item, a devolução ao estoque. O `LEFT JOIN` mantém o item **mesmo se não achar** a devolução; nesse caso, as colunas de `m` ficam nulas.
3. `WHERE p.status = 'CANCELADO'`: só pedidos cancelados.
4. `AND m.id IS NULL`: só os itens em que a devolução **não foi encontrada**.

Esse padrão (`LEFT JOIN` + `IS NULL`) serve para achar "o que deveria existir e não existe". Aparece muito em entrevista.

## Dentro dos testes E2E

Os testes CT20 e CT24 validam a tela **e** o banco, com o comando `cy.consultarBanco()` (veja [`cypress/support/commands.js`](../cypress/support/commands.js)):

```js
// CT24: depois do clique duplo, o banco precisa ter um único reembolso de R$ 50,00
cy.consultarBanco(
  'SELECT COUNT(*) AS quantidade, SUM(valor_centavos) AS total FROM reembolsos WHERE pedido_id = ?',
  [idPedido]
).should('deep.equal', [{ quantidade: 1, total: 5000 }]);
```

O `?` é um **parâmetro**: o valor é passado separado do SQL. Isso evita SQL injection e erros com aspas.

No CI, depois da coleção de API, o comando `npm run sql:validar` roda as 10 validações. Se alguma encontrar dados inconsistentes, o pipeline falha.

## Exercícios

Suba a loja, faça algumas compras pela tela (cancele uma, peça reembolso em outra) e tente resolver antes de abrir a resposta.

1. Liste o nome dos produtos esgotados.
2. Liste os produtos do mais caro ao mais barato, com o preço em reais.
3. Conte quantos pedidos existem em cada status.
4. Mostre quantas unidades foram vendidas de cada produto.
5. Para cada pedido, mostre o total, quanto já foi reembolsado e o saldo. Pedidos sem reembolso também devem aparecer.
6. Desafio: encontre pedidos pagos com cartão que não guardaram os 4 últimos dígitos.

<details>
<summary>Respostas</summary>

```sql
-- 1
SELECT nome FROM produtos WHERE estoque = 0;

-- 2  (dividir por 100.0, e não por 100, para manter os centavos)
SELECT nome, preco_centavos / 100.0 AS preco
FROM produtos
ORDER BY preco_centavos DESC;

-- 3
SELECT status, COUNT(*) AS quantidade
FROM pedidos
GROUP BY status;

-- 4
SELECT pr.nome, SUM(i.quantidade) AS unidades
FROM itens_pedido i
JOIN produtos pr ON pr.id = i.produto_id
GROUP BY pr.nome
ORDER BY unidades DESC;

-- 5  (LEFT JOIN para manter pedidos sem reembolso; COALESCE troca nulo por 0)
SELECT p.id,
       p.total_centavos,
       COALESCE(SUM(r.valor_centavos), 0) AS reembolsado,
       p.total_centavos - COALESCE(SUM(r.valor_centavos), 0) AS saldo
FROM pedidos p
LEFT JOIN reembolsos r ON r.pedido_id = p.id
GROUP BY p.id, p.total_centavos;

-- 6  (deve devolver 0 linhas; se devolver alguma, é um bug)
SELECT id
FROM pedidos
WHERE pagamento_metodo = 'cartao'
  AND cartao_final IS NULL;
```

</details>
