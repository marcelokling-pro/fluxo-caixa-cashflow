# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run test     # Vitest — ver "Testes automatizados"
```

O servidor Vite recarrega sozinho ao salvar. Após reiniciar o computador, um F5 manual é necessário uma única vez para reconectar — depois volta automático.

**Deploy da Edge Function**: após qualquer alteração em `supabase/functions/send-alerts/index.ts`, rodar:
```bash
supabase functions deploy send-alerts --project-ref xioqemsshqxagvwdttte
```
O `git push` **não** publica a edge function automaticamente.

## Regras de trabalho (ler antes de editar)

**Antes de qualquer alteração**: informar a próxima versão, as linhas que serão modificadas e o total de linhas do arquivo após a alteração (ex: "v7.9.0, ~10 linhas em `App.jsx:2650-2660`, total 4190 linhas").

**Formato de versão** `MAJOR.MINOR.PATCH`:

| Dígito | Quando bumpar |
|---|---|
| MAJOR | Mudança significativa na aplicação (nova seção, redesign, mudança estrutural) |
| MINOR | Demanda nova concluída e funcionando completamente |
| PATCH | Ajuste/correção em uma demanda que ainda não estava completa |

Ao concluir, bumpar a versão nos 3 locais do `App.jsx` (buscar `Fluxo de Caixa-`) antes de reportar o trabalho como feito.

**Commit e push**: só depois de testar em DEV (localhost) **e perguntar explicitamente se o usuário também testou** — nunca assumir que um "commita"/"confirma" isolado já cobre isso. Commit e push sempre no mesmo passo, sem esperar o usuário pedir o push separadamente. Mensagem sempre começando com a versão (`v7.9.0 descrição do que foi feito`); se o commit reunir mais de uma versão num único push, listar cada uma no **corpo** da mensagem (não só resumir na linha de título) — fica registrado no `git show`/histórico do GitHub.

**Nunca recriar arquivos do zero.** Editar o original com Edit ou pequenas substituições. Nunca `git show ... > arquivo` ou Write para sobrescrever — corrompe o estado do Vite e do git. Sempre partir do último commit do GitHub antes de alterar.

**Ambiente**: ao confirmar que algo "funciona" ou "está resolvido", especificar DEV ou PROD. Testes automatizados via browser só rodam em DEV (localhost). Mudança de **dado** (não só código) não propaga de DEV pra PROD via push — exige ação manual do usuário em PROD.

**Discussão de requisito**: se o pedido não estiver claro, perguntar antes de implementar — nunca sair codificando no meio de uma conversa em aberto. Só implementar com confirmação explícita ("pode ir", "sim") ou instrução já direta e específica.

**Menor raio de impacto**: ao corrigir uma funcionalidade isolada (ex: BI), não tocar em código de outras (Fluxo de Caixa, Operacional, Agenda, Dashboard) só por estar "por perto" — a menos que o usuário peça explicitamente. Confirmar ao final que as outras telas não foram afetadas.

**Respostas objetivas.** Direto ao ponto, sem rodeios. Só detalhar mais se o usuário pedir.

**Configuração externa** (Supabase, Vercel etc.): detalhar passo a passo com onde clicar em cada tela — nunca resumir em "gere uma API Key" ou "faça o deploy".

## Architecture

**Single-file React SPA** — toda a aplicação vive em `App.jsx` (~4200 linhas e crescendo). Sem router; navegação por aba via state `tab` no componente raiz `App`. Estado gerenciado com `useState`/`useMemo`/`useCallback`.

**Abas**: `fluxo`, `lancamentos`, `importar`, `forecast`, `projecao`, `classificacoes`, `agenda`, `operacional`, `analise` (exibida como **"BI"** desde jul/2026 — o id interno continua `analise`, só o label/título mudou). (`pendencias` foi removida na v6.17.0.)

**Backend**: Supabase (auth + PostgreSQL + realtime). Credenciais hardcoded no topo do `App.jsx` (linhas 4–8) — sem `.env`.

| Table | Purpose |
|---|---|
| `transactions` | Todos os lançamentos financeiros |
| `categories` | Overrides de classificação definidos pelo usuário |
| `settings` | Key-value (ex: `saldo_inicial`, `hidden_base_classifications`) |
| `agenda` | Compromissos recorrentes |
| `agenda_ocorrencias` | Status por mês de cada compromisso |
| `transaction_details` | Itens de um lançamento (ex: linhas da fatura de cartão) — referência/auditoria, nunca conta no Fluxo de Caixa/BI |
| `extras_fluxo` | Totais manuais de investimento/contas a receber por mês |

**R/D types** (`RD_TYPES`): `RECEITA`, `DESPESAS FIXAS`, `DESPESAS VARIÁVEIS`, `MOVIMENTAÇÃO`, `INVESTIMENTOS`, `DESPESA FINANCEIRA`, `SALDO INICIAL`.

## Conceitos centrais

### Geração de Caixa vs. Saldo de Caixa Total

**Não confundir os dois indicadores — é o conceito mais importante da aplicação.**

- **Geração de Caixa** = `RECEITA − DESPESAS FIXAS − DESPESAS VARIÁVEIS`. Mede a saúde da operação. **Exclui** Movimentação e Investimentos.
- **Saldo de Caixa Total** = Geração de Caixa + Movimentação + Investimentos + Contas a Receber (extras). É o valor que bate com o extrato do banco.

Movimentação/Investimentos ficam fora da Geração de Caixa porque são dinheiro trocando de lugar (transferências, aplicações, resgates) — não representam resultado operacional. **Exceção**: JUROS DE APLICAÇÃO é R/D "RECEITA" (rendimento real) e conta na Geração; APLICAÇÃO FINANC/RESGATE continuam "INVESTIMENTOS".

**Regra de ouro para qualquer tela que somar dinheiro: somar por grupo de R/D (`t.rd`), nunca por sinal do valor (`Number(t.value)>0`).** Uma anulação/estorno de fatura de cartão é positiva mas continua pertencendo ao grupo de despesa — somar por sinal conta isso como receita e distorce o resultado. Essa regra já corrigiu dois bugs reais: `metrics.recOperacional/desOperacional` no Fluxo de Caixa (v7.0.7) e as métricas do BI (v7.5.0). Qualquer nova tela/indicador que some valores deve seguir essa mesma regra desde o início.

**Implementado em**: aba Fluxo de Caixa (painel GRUPO + tabela Resumo Mensal por R/D) e aba BI (Receitas/Despesas Totais, Evolução Mensal, Destaques). Ao adicionar um novo R/D, decidir explicitamente se é operacional (entra na Geração) ou movimentação de capital (só no Saldo Total) — nunca assumir por padrão.

### BI (ex-Análise)

Componente `AnaliseTab`, **autocontido** — filtros próprios (`biMes`/`biAno`/`biRd`), sem depender do `metrics` do componente principal. Segue a mesma regra de ouro acima; quando "Todos R/D" está selecionado, exclui Movimentação/Investimentos pra bater com a Geração de Caixa do Fluxo de Caixa.

**Cuidado ao mexer aqui**: é isolado por design — ajustes no BI não devem tocar `metrics`, `navItems` (além do label) ou qualquer código do Fluxo de Caixa/Operacional/Dashboard. Confirmar ao final que essas telas continuam idênticas.

Badge "vs ano ant." fica oculto quando não há base de comparação válida (filtro "Todos os anos" comparado consigo mesmo, ou variação >999% por base histórica pequena demais). "Melhor Mês"/"Pior Mês" ignoram meses sem nenhum lançamento (evita mês vazio vencer por padrão com saldo zero).

### Detalhamento de Fatura de Cartão

Ao detalhar uma fatura (`saveDetailItems`), cada item vira um lançamento real em `transactions` (não só uma linha em `transaction_details`), e uma transação "ANULAÇÃO FATURA" (mesmo valor do pai, sinal invertido) é criada pra zerar o lançamento-pai original — que **continua existindo como registro próprio** em `transactions`, só que cancelado pela anulação.

**Pegadinha comum**: buscar/filtrar por texto ou por sinal (ex: "Só saídas") pode esconder a anulação (positiva) e mostrar o pai como se fosse uma despesa real não cancelada — parece duplicar o gasto. Antes de estranhar uma diferença, olhar pai + anulação juntos (mesma data, mesmo valor absoluto, sinais opostos).

**Data (desde v7.6.0)**: cada item usa a data de cobrança do pai (`detailModal.date` — data real do extrato bancário), não a data da compra original do arquivo da fatura — importante pra parcelas, que senão caem no mês da compra em vez do mês da cobrança real. A data de compra original fica só na descrição (`"... (compra: DD/MM/AAAA)"`) quando diferente da data de cobrança, e integralmente em `transaction_details` (referência/auditoria, nunca conta no Fluxo de Caixa/BI). Detalhamentos já salvos antes da v7.6.0 só corrigem a data ao serem reabertos e salvos de novo — não é retroativo automaticamente.

## Classification Pipeline

Transactions imported from bank CSV/XLSX are classified in this order:

1. **Local match** (`localClassify`): checks `customCats` (user overrides from Supabase) first, then `BASE_CLASSIFICATIONS` (hardcoded at top of file). Both use longest-match-wins on the description string.
2. **Gemini fallback** (`classifyWithGemini`): calls Gemini 2.0 Flash if local match fails.
3. **Review queue**: if Gemini also returns null, the row is flagged `needs_review:true` and shown in `ReviewModal` for manual classification before saving.

`BASE_CLASSIFICATIONS` is sorted by keyword length descending (`SORTED_CLASSIFICATIONS`) so the most specific keyword wins when multiple entries match.

## Import Flow

File upload → `openColumnMapper` (auto-detects header row and maps date/desc/value columns) → user confirms column mapping → `processColumnMapper` → `classifyAndSave` (local + Gemini) → `ReviewModal` if unknowns exist → insert to Supabase in batches of 50.

Duplicate detection uses a hash of `date|description|value` stored in `importedHashes` (Set rebuilt from DB on load).

XLSX parsing uses the `xlsx` library loaded dynamically from CDN at runtime (`window.XLSX`) — it is not a bundled dependency. O caminho real de importação (CSV **e** XLSX) é `openColumnMapper → processColumnMapper`, genérico para qualquer banco. As funções `parseBankCSV` e `parseExcelItau` no topo do arquivo são **código morto** (nunca chamadas) — não confiar nelas.

### Sinal do valor na importação (desde v7.10.0)

Bancos expressam débito/crédito de formas diferentes. `resolveSign(rawVal,{tipo,debito,credito})` resolve nesta ordem: (1) colunas Débito/Crédito separadas → `valor = crédito − débito`; (2) coluna indicadora D/C → ajuste **corretivo** (só inverte quando o sinal contradiz o indicador); (3) valor como veio. As colunas Tipo/Débito/Crédito são auto-detectadas por **nome exato** de cabeçalho (evita ativar por engano) e ficam editáveis no modal de mapeamento. **Resgate**: se o extrato vem todo positivo e sem nenhuma coluna de sinal, `looksLikeDebit` infere as saídas por palavra-chave. Como o ajuste D/C é corretivo e o resgate só roda quando não há negativos, o Excel do Itaú (já assinado) passa intacto. CSV usa `splitCSVLine` (respeita separador dentro de aspas) e `detectSepMulti` (`;`, `,` ou tab por frequência). O usuário confere os sinais na prévia (`pendingImport`) antes de salvar.

## Padrões de UI

**Toda tabela/lista deve ter ordenação por coluna** (padrão desde v7.9.0): cabeçalho clicável com indicador ↑/↓, primeiro clique ordena asc, segundo inverte. Colunas numéricas ordenam por número, datas por `dateToSortable`, texto por `localeCompare`. Ao criar qualquer tabela nova, incluir sorting desde o início — não esperar o usuário pedir. Implementado em: Lançamentos, Classificações, Agenda, Histórico de Importações, Detalhamentos Vinculados.

## Lançamentos — filtros

Filtros disponíveis: R/D, Classificação, Status (Todos/Não classificados/💳 Cartão), sinal do valor (Todos valores/Só saídas/Só entradas — desde v7.8.0), intervalo de data, busca livre por texto. O cabeçalho mostra contagem + **total do valor filtrado** (soma simples de `t.value` respeitando todos os filtros ativos, incluindo a busca de texto).

## Lições aprendidas

### DEV vs PROD (jul/2026)

Ao investigar "funciona em PROD mas não em DEV" (ou vice-versa), checklist de paridade entre os projetos Supabase (PROD `xioqemsshqxagvwdttte`, DEV `fhrulvdwkqhkyrwqnbet`): extensões (`pg_cron`, `pg_net`), publications/realtime (tabela `transactions` precisa estar em `supabase_realtime` — sem isso a tela não atualiza após insert/delete), constraints UNIQUE (`agenda_ocorrencias(agenda_id,mes,ano)`, `extras_fluxo(tipo)`, `categories(name)`, `settings(key)`), functions SQL (`manage_alert_schedule` — recriar com URL/key do projeto), RLS policies, edge functions deployadas e secrets/settings (`resend_api_key`).

**Toda migration de schema precisa rodar em DEV e PROD antes/junto do `git push`.** O push já dispara deploy automático do código em PROD via Vercel — não existe um passo manual de "publicar" separado. Se uma migration (`alter table ... add column ...`) só for aplicada em DEV e o código correspondente for commitado, o app em PROD passa a referenciar uma coluna inexistente — pode não gerar erro visível se o código tiver fallback (`campo||"—"`), mascarando o problema até a migration ser aplicada lá também.

### Classificações (jun/2026)

**Keywords devem ser texto manual exato, sem fuzzy match.** Já existiu "Popular Keywords" (auto-geração a partir de transações) e um match parcial no `flexMatch` (batia só pelas 4 primeiras letras). Ambos foram removidos por causarem contaminação cruzada entre categorias (ex: "transporte" classificando como "transferência"). Não reintroduzir fuzzy matching — `flexMatch` faz só substring exata (com ou sem espaços).

**Exclusão de classificações "base"** (fixas em `BASE_CLASSIFICATIONS`, sem registro no banco) funciona via lista de ocultação em `settings` (`hidden_base_classifications`) — não existe exclusão real pra essas, só ocultação. Categorias custom (tabela `categories`) excluem de verdade via `deleteCustom`.

**Não existe undo/lixeira.** Toda exclusão é definitiva no banco. Sempre confirmar antes de excluir, nunca implementar exclusão em massa sem confirmação explícita.

**Acesso ao Supabase fora do app é bloqueado por RLS.** A chave anônima não lê/escreve nas tabelas via curl/script externo — só dentro do app com o usuário logado. Pra inspecionar dados reais, pedir para o usuário rodar SQL no Supabase Studio ou colar print/texto da tela.

**R/D e Classificação são obrigatórios em qualquer categoria.** Sem os dois preenchidos, a categoria fica "inerte" — `localClassify` pula qualquer categoria com `rd` ou `classificacao` vazios. Validação já existe em `saveEdit`/`saveNew`.

## Backlog v8 (roadmap futuro)

**Unificar keywords de classificação e agenda num único cadastro.** Hoje as keywords da aba Classificações (usadas por `localClassify` na importação) e as da agenda (usadas só pelo botão Sugerir e por `saveAgendaItem`) são cadastros separados e desconectados.

**Melhorar auto-detecção de colunas na importação (App.jsx).** O `openColumnMapper` hoje requer confirmação manual mesmo quando data/descrição/valor são óbvios. Implementar heurísticas mais robustas (nome + conteúdo da coluna) e pular a tela de confirmação quando a confiança for alta. Atenção: app é multi-usuário — testar bem antes de deployar.

**Modularizar `App.jsx` em estrutura não monolítica.** Dividir por domínio (ex: `lib/classify.js`, `lib/format.js`, `components/Agenda.jsx`, `components/Lancamentos.jsx`) mantendo o comportamento idêntico. Fazer aos poucos, começando pelas funções puras já cobertas por teste (`parseValue`, `merchantKey`, `flexMatch`, `localClassify`) antes de separar componentes de UI.

## Testes automatizados

`npm run test` roda testes unitários (Vitest) sobre funções puras críticas em `App.test.jsx` — cobre bugs já documentados neste arquivo (`merchantKey` números finais, `flexMatch` keyword curta, `localClassify` categoria sem rd/classificacao). `.env.test` usa as credenciais DEV só pra `createClient` não quebrar no import — os testes não fazem chamadas reais ao Supabase.

**Nunca rodar o teste sem perguntar antes** — mesmo quando o Claude julgar necessário. Sempre perguntar primeiro. Apresentar o resultado em tabela (função testada, caso, esperado, status).

Testes E2E (Playwright, contra o banco DEV) ainda não implementados.

## Styles

All inline styles are generated by `mkS(sidebarOpen)` which returns a style object keyed by element type (`s.card`, `s.btn`, `s.badge`, etc.). Color palette: background `#0F1923`, card `#162130`, accent `#00C9A7`, danger `#E8445A`, warning `#F5A623`.
