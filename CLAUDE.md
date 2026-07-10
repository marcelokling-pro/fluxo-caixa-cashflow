# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
```

O servidor Vite atualiza o browser automaticamente ao salvar arquivos. Após reiniciar o computador, é necessário um F5 manual uma única vez para reconectar — depois disso volta automático.

### Deploy da Edge Function

Após qualquer alteração em `supabase/functions/send-alerts/index.ts`, fazer o deploy via CLI:

```bash
supabase functions deploy send-alerts --project-ref xioqemsshqxagvwdttte
```

O push para o GitHub **não** faz o deploy automático da edge function.

No test suite is configured (`npm test` exits with error).

## Architecture

**Single-file React SPA** — the entire application lives in `App.jsx` (~2700 lines). There is no routing library; navigation is tab-based via a `tab` state variable in the root `App` component. All state is managed in `App` with `useState`/`useMemo`/`useCallback`.

**Tabs**: `fluxo`, `lancamentos`, `importar`, `pendencias`, `forecast`, `projecao`, `classificacoes`, `agenda`, `operacional`.

**Backend**: Supabase (auth + PostgreSQL + realtime). Credentials are hardcoded at the top of `App.jsx` (lines 4–8) — no `.env` file. Tables used:

| Table | Purpose |
|---|---|
| `transactions` | All financial entries |
| `categories` | User-defined classification overrides |
| `settings` | Key-value store (e.g. `saldo_inicial`) |
| `agenda` | Recurring payment schedules |
| `agenda_ocorrencias` | Per-month status of each agenda item |
| `transaction_details` | Sub-items for a transaction (e.g. credit card line items) |
| `extras_fluxo` | Manual investment/receivables totals per month |

## Classification Pipeline

Transactions imported from bank CSV/XLSX are classified in this order:

1. **Local match** (`localClassify`): checks `customCats` (user overrides from Supabase) first, then `BASE_CLASSIFICATIONS` (hardcoded at top of file). Both use longest-match-wins on the description string.
2. **Gemini fallback** (`classifyWithGemini`): calls Gemini 2.0 Flash if local match fails.
3. **Review queue**: if Gemini also returns null, the row is flagged `needs_review:true` and shown in `ReviewModal` for manual classification before saving.

`BASE_CLASSIFICATIONS` is sorted by keyword length descending (`SORTED_CLASSIFICATIONS`) so the most specific keyword wins when multiple entries match.

## Import Flow

File upload → `openColumnMapper` (auto-detects header row and maps date/desc/value columns) → user confirms column mapping → `processColumnMapper` → `classifyAndSave` (local + Gemini) → `ReviewModal` if unknowns exist → insert to Supabase in batches of 50.

Duplicate detection uses a hash of `date|description|value` stored in `importedHashes` (Set rebuilt from DB on load).

XLSX parsing uses the `xlsx` library loaded dynamically from CDN at runtime (`window.XLSX`) — it is not a bundled dependency. The Itaú bank Excel format has a special parser (`parseExcelItau`) that reads fixed column positions (row 27+, cols 0/2/10).

## Versionamento

A versão atual está hardcoded no `App.jsx` em 3 locais (buscar por `Fluxo de Caixa-`).

Formato: `MAJOR.MINOR.PATCH`

| Dígito | Quando bumpar |
|---|---|
| MAJOR | Mudança significativa na aplicação (nova seção, redesign, mudança estrutural) |
| MINOR | Demanda nova concluída e funcionando completamente |
| PATCH | Ajuste/correção em uma demanda que ainda não estava completa |

**Regra:** ao concluir qualquer demanda, bumpar a versão e atualizar a string na sidebar antes de reportar o trabalho como feito. **Antes de aplicar qualquer alteração, informar ao usuário qual será a próxima versão** (ex: "esta alteração será a v6.7.0") para que ele saiba o que esperar.

**Commit e push:** após confirmação do teste no localhost, fazer o commit E o push para o GitHub na mesma etapa, sem precisar que o usuário solicite o push separadamente. Nunca commitar sem fazer o push logo em seguida — o GitHub deve sempre refletir o último commit local.

**Nunca recriar arquivos existentes do zero.** Sempre editar o arquivo original com as ferramentas Edit ou pequenas substituições. Nunca usar `git show ... > arquivo` ou Write para sobrescrever — isso pode corromper o estado do Vite e do git.

**Sempre partir da última versão do GitHub.** Antes de qualquer alteração, confirmar que o arquivo local está em sincronia com o último commit do repositório. Fazer incrementos sobre o que existe — nunca reescrever do zero.

**Formato do commit:** iniciar sempre com a versão: `v4.6.4 descrição do que foi feito`.

**Ao aplicar qualquer alteração:** informar previamente a versão, o número de linhas que serão modificadas e o total de linhas do arquivo após a alteração.

**Durante discussões de requisito:** se o usuário estiver descrevendo uma ideia ou solicitando algo sem ter chegado a um entendimento claro, perguntar antes de implementar — nunca sair codificando no meio de uma conversa em aberto. Só implementar quando o usuário confirmar explicitamente ou der o sinal de "pode ir".

**Respostas mais objetivas.** Ir direto ao ponto, sem rodeios. Só oferecer mais detalhamento se o usuário pedir.

**Instruções de configuração externa:** sempre detalhar passo a passo com exatamente onde clicar em cada tela — nunca resumir em "gere uma API Key" ou "faça o deploy". O usuário não conhece as particularidades de cada serviço.

## Lições do ciclo DEV/PROD (jul/2026)

**Ao investigar "funciona em PROD mas não em DEV" (ou vice-versa), comparar CONFIGURAÇÃO antes de código.** Checklist de paridade entre os projetos Supabase (PROD `xioqemsshqxagvwdttte`, DEV `fhrulvdwkqhkyrwqnbet`): extensões (`pg_cron`, `pg_net`), publications/realtime (tabela `transactions` deve estar em `supabase_realtime` — sem isso a tela não atualiza após insert/delete), constraints UNIQUE (`agenda_ocorrencias(agenda_id,mes,ano)`, `extras_fluxo(tipo)`, `categories(name)`, `settings(key)`), functions SQL (`manage_alert_schedule` — recriar com URL/key do projeto), RLS policies, edge functions deployadas e secrets/settings (`resend_api_key`).

**Não propor fix de código sem antes descartar diferença de ambiente.** Dois fixes desnecessários foram propostos por pular essa etapa (reload pós-importação e pós-exclusão — o realtime já cobria).

**Não afirmar causa sem verificar.** Inferências erradas custaram tempo: "sessão expirada", "eu gerei os dados de teste". Verificar no banco/config antes de concluir.

## Lições do ciclo de Classificações (jun/2026)

**Keywords devem ser texto manual exato, sem fuzzy match.** Já existiu um recurso de "Popular Keywords" (auto-geração a partir de transações) e uma lógica de match parcial no `flexMatch` (aceitava bater só pelas 4 primeiras letras de uma palavra). Ambos foram removidos por causarem contaminação cruzada entre categorias (ex: "transporte" classificando como "transferência", "BEM MAIS GES" pegando lançamentos de "BOLETO PAGO" genérico). Não reintroduzir fuzzy matching nas keywords — `flexMatch` deve continuar fazendo apenas substring exata (com ou sem espaços).

**Exclusão de classificações "base"** (as fixas em `BASE_CLASSIFICATIONS` no código, sem registro no banco) funciona via lista de ocultação salva em `settings` (chave `hidden_base_classifications`) — não existe exclusão real para essas, só ocultação. Categorias custom (tabela `categories`) excluem de verdade via `deleteCustom`.

**Não existe undo/lixeira.** Toda exclusão é definitiva no banco. Sempre confirmar com o usuário antes de excluir, e nunca implementar ações de exclusão em massa sem confirmação explícita.

**Acesso ao Supabase fora do app é bloqueado por RLS.** A chave anônima não consegue ler/escrever nas tabelas (`categories`, `transactions`, etc.) via curl ou script externo — só funciona dentro do app com o usuário logado. Para inspecionar dados reais, pedir para o usuário rodar SQL no Supabase Studio (SQL Editor) ou colar print/texto da tela.

**R/D e Classificação são obrigatórios em qualquer categoria.** Sem os dois preenchidos, a categoria fica "inerte" — o `localClassify` pula qualquer categoria com `rd` ou `classificacao` vazios, mesmo que tenha keywords boas cadastradas. Validação obrigatória já existe em `saveEdit`/`saveNew` na aba Classificações.

## Backlog v8 (roadmap futuro)

**Unificar keywords de classificação e agenda num único cadastro.** Hoje as keywords da aba Classificações (usadas por `localClassify` na importação) e as keywords da agenda (usadas só pelo botão Sugerir e por `saveAgendaItem` para reclassificação em massa) são cadastros separados e desconectados. Avaliar um cadastro único de keywords referenciado por ambos os fluxos.

**Modularizar `App.jsx` em estrutura não monolítica.** O arquivo tem ~3.400 linhas com toda a lógica (UI, classificação, agenda, importação, reconciliação) num único componente. Dividir por domínio (ex: `lib/classify.js`, `lib/format.js`, `components/Agenda.jsx`, `components/Lancamentos.jsx`) mantendo o comportamento idêntico. Fazer aos poucos, começando pelas funções puras já cobertas por teste (`parseValue`, `merchantKey`, `flexMatch`, `localClassify`) — menor risco — antes de separar componentes de UI.

## Testes automatizados

`npm run test` roda testes unitários (Vitest) sobre funções puras críticas em `App.test.jsx` — cobre bugs já documentados neste arquivo (`merchantKey` números finais, `flexMatch` keyword curta, `localClassify` categoria sem rd/classificacao). `.env.test` usa as credenciais DEV apenas para o `createClient` não quebrar no import — os testes não fazem chamadas reais ao Supabase.

**Nunca rodar o teste sem perguntar antes** — mesmo quando o Claude julgar necessário (ex: após alterar uma das funções cobertas). Sempre perguntar primeiro, seja por demanda do usuário ou iniciativa do Claude. Apresentar o resultado sempre em tabela (função testada, caso, esperado, status).

Testes E2E (Playwright, contra o banco DEV) ainda não implementados — parte 2 do plano de testes, cobriria telas e fluxos completos (import, edição, agenda).

## Styles

All inline styles are generated by `mkS(sidebarOpen)` which returns a style object keyed by element type (`s.card`, `s.btn`, `s.badge`, etc.). Color palette: background `#0F1923`, card `#162130`, accent `#00C9A7`, danger `#E8445A`, warning `#F5A623`.
