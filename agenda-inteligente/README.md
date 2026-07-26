# Agenda Inteligente de Compromissos — v1.1.0

PWA independente (HTML + CSS + JavaScript puro, sem framework e sem build) para gerenciar
compromissos e pagamentos recorrentes com lembretes, assistente por voz e funcionamento
100% offline. **Não compartilha código nem dados com o app de Fluxo de Caixa** — vive
isolado nesta pasta e grava tudo no IndexedDB do próprio aparelho.

## Como abrir (100% local)

```bash
node agenda-inteligente/servir.mjs      # ou: npm run agenda
```
→ http://localhost:4321

O `servir.mjs` usa só o Node (nenhuma dependência, nenhum `npm install`). **Não depende do
Vite, do build nem de deploy** — a pasta está fora de `public/`, então o `npm run build` não
a inclui e o Vercel não publica nada dela.

Outra porta: `node agenda-inteligente/servir.mjs 8080`.

### Por que não abrir o `index.html` direto (duplo clique)?

Service worker, modo offline, notificações e instalação como app só funcionam em **origem
segura** — `https://` ou `localhost`. Em `file://` o navegador bloqueia tudo isso (e o Firefox
também bloqueia IndexedDB). Por isso o servidor local: `localhost` conta como origem segura e
o app roda completo, sem internet e sem nuvem.

### No celular

Como o app é local, o celular precisa alcançar a máquina: `node agenda-inteligente/servir.mjs --rede`
mostra o endereço da rede local. **Atenção**: por IP da rede o navegador trata a origem como
insegura, então cadastro, busca e histórico funcionam, mas service worker, modo offline e
notificações ficam desativados. Para o app completo no celular é preciso servir por HTTPS
(hospedagem própria ou túnel) — ou usar no desktop pelo `localhost`.

## Arquitetura (módulos independentes)

| Arquivo | Responsabilidade |
|---|---|
| `js/model.js` | Constantes (recorrências, status, prioridades, categorias) e formatação |
| `js/recorrencia.js` | Motor de recorrência — datas puras, sem fuso |
| `js/db.js` | IndexedDB: stores, transações, persistência e eventos de mudança |
| `js/servico.js` | Regras de negócio: criar, editar, pagar, adiar, cancelar (+ histórico) |
| `js/consultas.js` | Filtros, buscas e totalizações (puro) |
| `js/lembretes.js` | Quais lembretes estão vencidos agora (puro) |
| `js/notificacoes.js` | Permissão, exibição e agendador em primeiro plano |
| `js/interpretador.js` | Compreensão de pt-BR: datas, valores, frequência, intenção (puro) |
| `js/voz.js` | SpeechRecognition/SpeechSynthesis + diálogo de cadastro |
| `js/backup.js` | Exportação JSON/CSV e restauração |
| `js/ui.js` | Renderização e eventos |
| `js/app.js` | Inicialização (banco, service worker, notificações) |
| `sw.js` | Cache offline + verificação de lembretes em segundo plano |

Os módulos puros (`recorrencia`, `consultas`, `lembretes`, `interpretador`, `model`) são
cobertos por `agenda-inteligente.test.js` na raiz do repositório (`npm run test`).

## Persistência

- Tudo é gravado no IndexedDB (`agenda-inteligente`): compromissos, histórico, categorias,
  configurações e o controle de lembretes já disparados.
- Na abertura o app chama `navigator.storage.persist()` para pedir armazenamento
  **persistente** — o navegador deixa de descartar os dados por falta de espaço.
- Compromisso e histórico são gravados na **mesma transação**: nunca existe um sem o outro.
- Não há exclusão em massa nem "limpar tudo" acidental; excluir um compromisso preserva o
  histórico dele.

## Lembretes e notificações

- Cada compromisso aceita vários lembretes (30/15/10/7/5/3/1 dia antes, no dia, ou valor
  personalizado).
- Com o app aberto, um agendador verifica a cada minuto e sempre que a aba volta ao primeiro
  plano. Com o app fechado, o service worker verifica via `periodicSync` (Chrome/Android
  instalado como PWA); nos demais navegadores a verificação acontece ao abrir o app.
- Um lembrete **só é marcado como enviado depois de exibido**. Sem permissão de notificação
  ele continua pendente e dispara assim que o usuário autorizar.
- A chave do lembrete inclui a data do compromisso: ao adiar, os avisos rearmam sozinhos.

## Assistente

Funciona por voz (`🎤`) ou por texto — o mesmo interpretador atende aos dois, então
navegadores sem `SpeechRecognition` (Firefox, iOS antigo) continuam com o assistente completo
pelo campo de digitação.

**Cadastro:** "Cadastrar pagamento do condomínio" → o assistente pergunta valor, vencimento,
recorrência, frequência e antecedência do aviso, mostra o resumo e só grava após o "sim".

**Consultas:** "Quais contas vencem esta semana?", "Tenho algum compromisso amanhã?",
"Quanto preciso pagar este mês?", "Qual o próximo compromisso?", "O que está vencido?".

Entende datas ("amanhã", "dia 10", "10 de agosto", "10/08/2026", "daqui a 5 dias"), valores
("450 reais", "R$ 1.250,50", "quatrocentos e cinquenta") e frequências por extenso.

## Backup

- **Exportar JSON**: backup completo (compromissos + histórico + categorias + configurações).
- **Exportar CSV**: abre direto no Excel (separador `;` e BOM).
- **Importar**: mesclar (mantém o que existe) ou substituir tudo. Ambos pedem confirmação.

## Limitações conhecidas

- Sem sincronização em nuvem: os dados ficam só neste aparelho/navegador. Trocar de celular
  exige exportar e importar o backup.
- `periodicSync` só existe hoje no Chrome/Android com o app instalado; no iOS as notificações
  chegam quando o app é aberto.
- Reconhecimento de voz depende do navegador e, no Chrome, de conexão com a internet — o
  restante do app funciona offline.
- Export em PDF ainda não implementado (previsto na especificação como formato futuro).
