-- Consultas de validação de dados da loja Checkout Demo.
--
-- Cada consulta procura INCONSISTÊNCIAS: se ela não devolve nenhuma linha, os dados estão corretos.
-- Se devolve linhas, cada linha é um problema a investigar (e, possivelmente, um bug).
--
-- Rodar todas:            npm run sql:validar
-- Rodar uma consulta solta: npm run sql -- "SELECT * FROM produtos"
--
-- Valores em centavos: 19990 = R$ 199,90.

-- @V01 Total do pedido diferente de subtotal + frete
-- Risco R02 (cobrança errada). Usa: SELECT, WHERE com cálculo.
SELECT id, subtotal_centavos, frete_centavos, total_centavos
FROM pedidos
WHERE total_centavos <> subtotal_centavos + frete_centavos;

-- @V02 Subtotal do pedido diferente da soma dos itens
-- Risco R02 (cobrança errada). Usa: JOIN, SUM, GROUP BY, HAVING.
SELECT p.id,
       p.subtotal_centavos,
       SUM(i.quantidade * i.preco_unitario_centavos) AS soma_dos_itens
FROM pedidos p
JOIN itens_pedido i ON i.pedido_id = p.id
GROUP BY p.id, p.subtotal_centavos
HAVING p.subtotal_centavos <> SUM(i.quantidade * i.preco_unitario_centavos);

-- @V03 Frete cobrado em compra que deveria ter frete grátis (a partir de R$ 200,00)
-- Risco R02, BUG-01. Usa: WHERE com AND e valor-limite.
SELECT id, subtotal_centavos, frete_centavos
FROM pedidos
WHERE subtotal_centavos >= 20000
  AND frete_centavos > 0;

-- @V04 Mesma solicitação de reembolso (mesma chave) registrada mais de uma vez
-- Risco R01, BUG-03. Usa: GROUP BY, COUNT, HAVING.
SELECT pedido_id, chave, COUNT(*) AS vezes, SUM(valor_centavos) AS total_centavos
FROM reembolsos
WHERE chave IS NOT NULL
GROUP BY pedido_id, chave
HAVING COUNT(*) > 1;

-- @V05 Reembolsos somando mais do que o valor pago no pedido
-- Risco R01. Usa: JOIN, SUM, GROUP BY, HAVING.
SELECT p.id, p.total_centavos, SUM(r.valor_centavos) AS reembolsado_centavos
FROM pedidos p
JOIN reembolsos r ON r.pedido_id = p.id
GROUP BY p.id, p.total_centavos
HAVING SUM(r.valor_centavos) > p.total_centavos;

-- @V06 Pedido cancelado cujos itens não voltaram ao estoque
-- Risco R05, BUG-02. Usa: LEFT JOIN e IS NULL (procura o que deveria existir e não existe).
SELECT p.id AS pedido_id, i.produto_id, i.nome_produto, i.quantidade
FROM pedidos p
JOIN itens_pedido i ON i.pedido_id = p.id
LEFT JOIN movimentacoes_estoque m
       ON m.pedido_id = p.id
      AND m.produto_id = i.produto_id
      AND m.tipo = 'DEVOLUCAO'
WHERE p.status = 'CANCELADO'
  AND m.id IS NULL;

-- @V07 Estoque atual diferente do registrado nas movimentações
-- Risco R03 (vender sem estoque). Usa: subconsulta com SUM e COALESCE.
SELECT pr.id, pr.nome, pr.estoque,
       COALESCE((SELECT SUM(m.quantidade) FROM movimentacoes_estoque m WHERE m.produto_id = pr.id), 0)
         AS estoque_pelas_movimentacoes
FROM produtos pr
WHERE pr.estoque <> COALESCE((SELECT SUM(m.quantidade) FROM movimentacoes_estoque m WHERE m.produto_id = pr.id), 0);

-- @V08 Produto com estoque negativo
-- Risco R03. Usa: SELECT simples com WHERE.
SELECT id, nome, estoque
FROM produtos
WHERE estoque < 0;

-- @V09 Pedido sem nenhum item
-- Integridade. Usa: NOT EXISTS.
SELECT p.id, p.status
FROM pedidos p
WHERE NOT EXISTS (SELECT 1 FROM itens_pedido i WHERE i.pedido_id = p.id);

-- @V10 Status do pedido diferente do último status do histórico
-- Risco R08 (status errado ou desatualizado). Usa: subconsulta com ORDER BY e LIMIT.
SELECT p.id, p.status,
       (SELECT h.status FROM historico_status h WHERE h.pedido_id = p.id ORDER BY h.id DESC LIMIT 1)
         AS ultimo_status_no_historico
FROM pedidos p
WHERE p.status <> (SELECT h.status FROM historico_status h WHERE h.pedido_id = p.id ORDER BY h.id DESC LIMIT 1);
