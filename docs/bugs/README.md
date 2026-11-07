# Bug reports

Defeitos encontrados pela suíte de testes rodando contra a loja no **modo com bugs** (`npm run start:bugs`). Cada relatório segue o formato usado no Jira: severidade, prioridade, passos para reproduzir, resultado esperado e obtido, evidências, impacto e plano de reteste.

| ID | Título | Severidade | Prioridade | Encontrado por |
|---|---|:-:|:-:|---|
| [BUG-01](BUG-01-frete-cobrado-no-valor-limite.md) | Frete cobrado em compra de exatamente R$ 200,00, embora o carrinho mostre "Grátis" | Alta | Alta | CT08 |
| [BUG-02](BUG-02-cancelamento-nao-devolve-estoque.md) | Cancelamento do pedido não devolve os itens ao estoque | Média | Alta | CT20 |
| [BUG-03](BUG-03-reembolso-duplicado.md) | Clique duplo em "Solicitar reembolso" gera dois reembolsos | Crítica | Alta | CT24 e API10 |

**Severidade × prioridade:** a severidade mede o tamanho do estrago; a prioridade, a urgência da correção. O BUG-02 tem severidade média (não cobra o cliente errado), mas prioridade alta, porque o estoque errado se acumula e trava vendas.
