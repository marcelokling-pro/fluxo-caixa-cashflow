# UAT Extractor — CLAUDE.md

Instruções para o Claude Code ao trabalhar neste projeto.

## Objetivo

Extrair dados e imagens de listas UAT no Microsoft Lists (SharePoint) e gerar um arquivo HTML com imagens embutidas em base64, salvo no OneDrive.

## Ambiente

- **SharePoint Site**: `https://odrlnet.sharepoint.com/sites/Intranet-Foresea-Sistemas`
- **Lista**: `UAT - ALMOXARIFADO DE (TESTES)`
- **Tenant**: `odrlnet.sharepoint.com`
- **Tenant ID**: `811ad58a-849e-4e62-bcbf-ae640a5c6dd9`

## Solução atual: Power Automate → HTML com imagens base64

### Flow no Power Automate (`make.powerautomate.com`)

Estrutura do flow:

1. **Trigger manual**
2. **Initialize variable** — `varHTML` (String), valor inicial: `<html><head><meta charset="utf-8"></head><body>`
3. **Get items** (SharePoint) — Site: URL do site, Lista: nome da lista
4. **Apply to each** (loop externo) — sobre os itens
   - **Append to string variable** — monta bloco HTML com colunas do item (ID, Título, Passo, Resultado)
   - **Get attachments** (SharePoint) — busca anexos do item atual
   - **Apply to each** (loop interno) — sobre os anexos
     - **Get attachment content** (SharePoint)
       - ID: `items('Apply_to_each')?['ID']` — loop *externo*
       - File Name: `items('Apply_to_each_2')?['FileName']` — loop *interno*
     - **Append to string variable** — monta tag `<img>` com base64
5. **Append to string variable** — fecha com `</body></html>`
6. **Create file** (OneDrive) — salva o HTML

### Expressão MIME dinâmica (obrigatória)

```
data:@{if(endsWith(toLower(items('Apply_to_each_2')?['FileName']),'.png'),'image/png','image/jpeg')};base64,@{base64(body('Get_attachment_content'))}
```

### Cuidados críticos

- **MIME fixo quebra PNG** — usar expressão condicional pela extensão do arquivo
- **Mapeamento de parâmetros**: ID vem do loop externo, FileName do loop interno — não confundir
- **Itens sem anexo**: configurar "Run after" para continuar em falha e não derrubar o flow
- **Nome do arquivo**: usar timestamp — `uat-@{formatDateTime(utcNow(),'yyyyMMdd-HHmm')}.html`

### Colunas mapeadas da lista

| Campo no Power Automate | Coluna na lista |
|---|---|
| `Title` | Cenário / ID do teste |
| `Passo` | Passo executado |
| `Resultado` | Resultado obtido |

Os nomes internos das colunas podem variar — verificar com "Get items" e inspecionar o output no histórico do flow.

## Aplicação web (alternativa)

Existe uma aplicação React + Vite em `web-app/` com MSAL.js para autenticação Microsoft e ExcelJS para geração de Excel com imagens embutidas. Requer Node.js instalado.

- **CLIENT_ID**: `727cd675-c75b-4c02-a1c8-1556d022313a`
- **Redirect URI configurado**: `http://localhost:5173` (SPA)
- **Scopes**: `Sites.Read.All`, `Files.Read.All`, `User.Read`, `AllSites.Read`

## Restrições do ambiente do usuário

- Sem permissão de instalação como administrador no Windows
- Solução preferida: Power Automate (sem instalação, acesso via browser)
- Power BI: não resolve — exibe imagens por referência, não embutidas

## Histórico de decisões

- `=IMAGE()` no Excel Online: bloqueado para URLs autenticadas do SharePoint — descartado
- Python com Graph API: descartado por requerer instalação admin
- Node.js/React local: descartado por requerer instalação admin
- **Solução adotada**: Power Automate gerando HTML com imagens base64 inline
