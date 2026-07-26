# Agenda Inteligente de Compromissos — v1.6.0

App de celular independente (HTML + CSS + JavaScript puro, sem framework e sem build) para
gerenciar compromissos e pagamentos recorrentes com lembretes, assistente por voz e
funcionamento 100% offline. **Não compartilha código nem dados com o app de Fluxo de Caixa**,
não usa Supabase, não depende de Vercel nem de qualquer hospedagem — grava tudo no IndexedDB
do próprio aparelho.

## Levar para o celular (arquivo único)

**`AgendaInteligente-v<versão>.html`** é o app inteiro num arquivo só (~131 KB): CSS,
JavaScript e ícone embutidos, sem depender de servidor, internet, hospedagem ou build. É esse
arquivo que vai para o aparelho.

A versão aparece em três lugares, justamente para não haver dúvida sobre qual cópia está
aberta no celular: no **nome do arquivo**, no **rodapé** de todas as telas (`MKK · v…`) e em
**Ajustes → Sobre**. O gerador apaga as versões anteriores da pasta, deixando só a atual.

```bash
node agenda-inteligente/gerar-arquivo-unico.mjs    # ou: npm run agenda:arquivo
```
Regere sempre que mexer em `js/`, `css/` ou `index.html` — o HTML do celular não se atualiza sozinho.

### Android (Chrome)

1. Mande o arquivo para o celular (Drive, WhatsApp, e-mail, cabo).
2. **Baixe pelo próprio Chrome** e abra pela lista de downloads do Chrome (☰ → Downloads).
   Isso faz a página abrir como `file://…`, que é onde o navegador guarda os dados.
3. Menu do Chrome → **Adicionar à tela de início** cria o atalho.

> **Não abra o arquivo pelo visualizador de anexos de outro aplicativo** (o preview do
> WhatsApp, do Gmail, do Claude). Ali o Android roda a página num WebView que bloqueia o
> armazenamento; o app abre, mas com o aviso vermelho "os dados não estão sendo salvos".
> Baixe primeiro (ícone ⬇) e abra pelo Chrome.
>
> Confira uma vez: cadastre um compromisso, feche o Chrome por completo, reabra pelo atalho e
> veja se ele continua lá. O chip no topo mostra em que modo o armazenamento está.

### O que muda no modo arquivo

| Funciona | Não funciona |
|---|---|
| Cadastro, recorrência, situações, busca, histórico | **Notificação do sistema** (o navegador bloqueia em `file://`) |
| Dados salvos no aparelho e mantidos ao fechar o app | Instalar como app "de verdade" (só atalho) |
| Assistente por texto (e por voz, onde o navegador tiver) | Service worker / cache offline (desnecessário: o arquivo já é local) |
| Backup JSON e CSV | Armazenamento "persistente" garantido pelo navegador |

Como as notificações não existem nesse modo, **os lembretes vencidos aparecem em destaque no
topo do painel** toda vez que você abre a agenda — é o substituto direto do aviso do sistema.

**Cara de app**: a barra de endereço do Chrome só some com o app instalado, e instalar exige
origem `https`. No modo arquivo, o botão **⛶** no topo põe a agenda em tela cheia enquanto
ela estiver aberta — é o mais perto possível sem hospedagem.

Para ter notificação com o app fechado é obrigatório abrir a agenda por um endereço `https://`
ou `localhost` (regra do navegador, não do app) e instalá-la como PWA.

## Rodar no computador (app completo)

```bash
node agenda-inteligente/servir.mjs      # ou: npm run agenda
```
→ http://localhost:4321 — aqui sim com notificações, service worker e instalação como app,
porque `localhost` conta como origem segura.

O `servir.mjs` usa só o Node (nenhuma dependência, nenhum `npm install`). **Não depende do
Vite, do build nem de deploy** — a pasta está fora de `public/`, então o `npm run build` não
a inclui e o Vercel não publica nada dela.

Outra porta: `node agenda-inteligente/servir.mjs 8080`.

Para desenvolver, use este modo: o `index.html` da pasta carrega os módulos de `js/` direto,
sem precisar regerar o arquivo único a cada alteração. Serve também para conferir no PC o
comportamento das notificações, que o modo arquivo não tem.

`node agenda-inteligente/servir.mjs --rede` expõe o servidor na rede local (para abrir do
celular sem copiar o arquivo), mas por IP o navegador trata a origem como insegura — mesmas
limitações do modo arquivo.

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

O armazenamento escolhe sozinho o melhor disponível, na ordem:

| Modo | Quando | Salva? |
|---|---|---|
| **IndexedDB** | normal | Sim, com transações atômicas |
| **localStorage** | navegador bloqueia IndexedDB (WebView de outro app, aba anônima) | Sim, sem atomicidade |
| **memória** | tudo bloqueado | **Não** — o app avisa em vermelho no painel e no topo |

Isso existe porque abrir o arquivo dentro do visualizador de outro aplicativo (anexo de
mensageiro, por exemplo) faz o Android bloquear o IndexedDB — antes disso o app simplesmente
não abria. O modo em uso aparece sempre no chip do topo e em Ajustes → Armazenamento.

- Guarda compromissos, histórico, categorias, configurações e o controle de lembretes
  já disparados.
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

**Cadastro:** dá para dizer tudo numa frase — *"paga o condomínio dia 10 todo mês, 450, me
avisa 5 dias antes"* — ou só começar: *"cadastrar pagamento do condomínio"*, e o assistente
pergunta o que faltou. Em qualquer caso mostra o resumo e só grava após o "sim".

**Modo do assistente** (Ajustes → Assistente), porque nem todo mundo sabe ou lembra o que
precisa informar:

| Modo | Comportamento |
|---|---|
| Guiado | Pergunta uma coisa de cada vez, mesmo que a frase já tenha tudo |
| Automático *(padrão)* | Aproveita o que veio na frase e pergunta só o que faltou |
| Rápido | Só pergunta título e data; o resto assume padrão |

A barra acima do campo mostra a pergunta atual e permite cancelar. O botão **"O que posso
dizer?"** lista os comandos aceitos.

**Abertura**: em Ajustes dá para escolher se o app abre no Painel ou direto no Assistente com
o campo focado — nesse caso, o 🎤 do teclado fica a um toque.

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
