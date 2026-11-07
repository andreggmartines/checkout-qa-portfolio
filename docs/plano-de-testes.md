# Plano de Testes — Checkout Demo

| | |
|---|---|
| **Projeto** | Checkout Demo (loja de artigos para casa) |
| **Autor** | André Martines |
| **Versão** | 1.0 |
| **Abordagem** | Testes baseados em risco |

## 1. Objetivo

Garantir que o fluxo de compra da loja funcione do começo ao fim — catálogo, carrinho, checkout, pagamento, entrega, cancelamento e reembolso — priorizando as falhas que causam **prejuízo financeiro** ou **perda de confiança do cliente**.

## 2. Escopo

**Dentro do escopo**

- Catálogo: preços, estoque e produtos esgotados.
- Carrinho: inclusão, quantidades, limites de estoque, cálculo de frete e total.
- Checkout: validação dos dados do cliente e pagamento por Pix e cartão.
- Pós-venda: acompanhamento da entrega, cancelamento e reembolso parcial.
- API REST: contratos, status HTTP e mensagens de erro.

**Fora do escopo**

- Testes de desempenho e carga.
- Testes de segurança (autenticação, injeção etc.).
- Compatibilidade com vários navegadores (os testes rodam no Chrome/Electron).
- Integração real com gateway de pagamento e transportadora (ambos são simulados).

## 3. Análise de riscos

Cada risco recebe uma nota de **probabilidade** e de **impacto** de 1 (baixo) a 3 (alto). O **nível** é o produto das duas notas e define a prioridade dos testes.

| ID | Risco | Prob. | Impacto | Nível | Prioridade |
|---|---|:-:|:-:|:-:|:-:|
| R01 | Reembolso pago em duplicidade ou acima do valor do pedido | 2 | 3 | 6 | Alta |
| R02 | Valor cobrado errado (subtotal, frete ou total) | 2 | 3 | 6 | Alta |
| R03 | Venda de produto sem estoque | 2 | 3 | 6 | Alta |
| R04 | Pagamento recusado gerar pedido mesmo assim | 1 | 3 | 3 | Média |
| R05 | Cancelamento não devolver os itens ao estoque | 2 | 2 | 4 | Média |
| R06 | Cancelamento permitido depois do envio | 1 | 3 | 3 | Média |
| R07 | Dados de entrega inválidos aceitos (nome, e-mail, CEP) | 2 | 2 | 4 | Média |
| R08 | Status da entrega incorreto ou desatualizado | 1 | 2 | 2 | Baixa |
| R09 | Carrinho perder os itens ao navegar ou recarregar a página | 1 | 2 | 2 | Baixa |
| R10 | Catálogo com preço ou disponibilidade errados | 1 | 2 | 2 | Baixa |

**Por que esses riscos estão no topo:** reembolso duplicado, cobrança errada e venda sem estoque geram prejuízo direto para a empresa ou para o cliente e costumam virar reclamação pública. Por isso recebem mais cenários, incluindo valores-limite e casos negativos.

## 4. Estratégia

| Camada | Ferramenta | O que cobre |
|---|---|---|
| Interface (E2E) | Cypress + JavaScript | Os 24 cenários da seção 5, simulando o cliente na loja |
| API | Postman + Newman | Contratos, status HTTP, regras de negócio e erros, direto na API |
| Dados | SQL (SQLite) | Consultas de validação que procuram inconsistências no banco, como reembolso duplicado e estoque não devolvido ([sql/](../sql/)) |
| Exploratório | Manual | Sessões guiadas pelos riscos para achar o que os roteiros não preveem |
| Regressão | GitHub Actions | Cypress, Newman e validações SQL executados a cada push e pull request |

Técnicas usadas para criar os cenários: **partição de equivalência**, **análise de valor-limite** (frete em exatamente R$ 200,00, quantidade igual ao estoque, reembolso igual ao saldo) e **transição de estados** (Pago → Enviado → Entregue → Reembolsado / Cancelado).

## 5. Cenários E2E (Cypress)

Prioridade: **A** = alta, **M** = média, **B** = baixa. Tipo: **+** = caminho positivo, **−** = caminho negativo.

### Catálogo e carrinho

| ID | Cenário | Risco | Prior. | Tipo |
|---|---|---|:-:|:-:|
| CT01 | Exibir os produtos com nome, preço e estoque | R10 | B | + |
| CT02 | Produto esgotado aparece como indisponível e não pode ser adicionado | R03 | A | − |
| CT03 | Adicionar um produto atualiza o contador e o total do carrinho | R02 | A | + |
| CT04 | Aumentar e diminuir a quantidade recalcula o subtotal | R02 | A | + |
| CT05 | Remover o último item esvazia o carrinho e bloqueia "Finalizar compra" | R09 | B | + |
| CT06 | Não permitir quantidade acima do estoque disponível | R03 | A | − |
| CT07 | Cobrar frete de R$ 19,90 em compras abaixo de R$ 200,00 | R02 | A | + |
| CT08 | Frete grátis em compra de exatamente R$ 200,00 (valor-limite) | R02 | A | + |
| CT09 | Manter os itens do carrinho após recarregar a página | R09 | B | + |

### Checkout e pagamento

| ID | Cenário | Risco | Prior. | Tipo |
|---|---|---|:-:|:-:|
| CT10 | Concluir compra com Pix e exibir o pedido como PAGO | R02 | A | + |
| CT11 | Concluir compra com cartão aprovado | R04 | M | + |
| CT12 | Cartão recusado exibe mensagem e não cria pedido | R04 | M | − |
| CT13 | Número de cartão inválido é rejeitado | R04 | M | − |
| CT14 | Nome com menos de 3 caracteres é rejeitado | R07 | M | − |
| CT15 | E-mail em formato inválido é rejeitado | R07 | M | − |
| CT16 | CEP com menos de 8 dígitos é rejeitado | R07 | M | − |
| CT17 | Acessar o checkout com o carrinho vazio redireciona para a loja | R09 | B | − |
| CT18 | Compra concluída reduz o estoque exibido no catálogo | R03 | A | + |

### Pós-venda: entrega, cancelamento e reembolso

| ID | Cenário | Risco | Prior. | Tipo |
|---|---|---|:-:|:-:|
| CT19 | Acompanhar a entrega de PAGO para ENVIADO e ENTREGUE | R08 | B | + |
| CT20 | Cancelar pedido pago devolve os itens ao estoque | R05 | M | + |
| CT21 | Opção de cancelar some depois que o pedido é enviado | R06 | M | − |
| CT22 | Reembolso parcial válido atualiza o saldo reembolsável | R01 | A | + |
| CT23 | Reembolso acima do saldo é rejeitado | R01 | A | − |
| CT24 | Clique duplo em "Solicitar reembolso" gera um único reembolso | R01 | A | − |

**Resumo:** 24 cenários — 11 de prioridade alta, 8 média e 5 baixa; 13 positivos e 11 negativos.

## 6. Cenários de API (Postman/Newman)

Complementam os testes de interface, validando direto na API as regras mais críticas e os contratos de resposta.

| ID | Requisição | Resultado esperado |
|---|---|---|
| API01 | Listar produtos | 200, lista com `id`, `nome`, `preco` e `estoque` |
| API02 | Buscar produto inexistente | 404, `PRODUTO_NAO_ENCONTRADO` |
| API03 | Criar pedido válido com Pix | 201, status `PAGO`, total correto |
| API04 | Criar pedido com carrinho vazio | 400, `CARRINHO_VAZIO` |
| API05 | Criar pedido acima do estoque | 409, `ESTOQUE_INSUFICIENTE` |
| API06 | Criar pedido com cartão recusado | 402, `PAGAMENTO_RECUSADO` |
| API07 | Criar pedido com e-mail inválido | 400, `DADOS_INVALIDOS`, campo `email` |
| API08 | Reembolsar pedido ainda não entregue | 409, `REEMBOLSO_NAO_PERMITIDO` |
| API09 | Reembolso parcial válido | 201, saldo reduzido pelo valor reembolsado |
| API10 | Repetir a mesma solicitação de reembolso | 200, nenhum reembolso novo |
| API11 | Reembolso acima do saldo | 422, `VALOR_INVALIDO` |
| API12 | Reembolso do saldo total | 201, status `REEMBOLSADO` |
| API13 | Cancelar pedido já enviado | 409, `CANCELAMENTO_NAO_PERMITIDO` |
| API14 | Consultar pedido inexistente | 404, `PEDIDO_NAO_ENCONTRADO` |

## 7. Ambiente e dados de teste

- Aplicação rodando localmente em `http://localhost:3000` (`npm start`).
- Antes de cada teste, os dados são restaurados com `POST /api/test/reset`, para cada cenário ser independente.
- Cartões de teste: `4111 1111 1111 1111` (aprovado) e `4000 0000 0000 0002` (recusado).
- Combinação para o valor-limite do frete: Organizador de Gavetas (R$ 40,10) + Jogo de Cama Casal (R$ 159,90) = R$ 200,00.

## 8. Critérios de entrada e saída

**Entrada:** aplicação sobe sem erros e o reset de dados responde 204.

**Saída:**
- 100% dos cenários de prioridade alta executados e aprovados.
- Nenhum defeito crítico ou alto em aberto.
- Defeitos médios e baixos registrados, com decisão do time sobre a correção.

## 9. Gestão de defeitos

Defeitos são registrados com título, ambiente, passos para reproduzir, resultado esperado, resultado obtido, evidências e severidade. Depois da correção, o cenário é reexecutado (reteste) junto com os cenários relacionados (regressão). Exemplos em [`docs/bugs`](bugs/).
