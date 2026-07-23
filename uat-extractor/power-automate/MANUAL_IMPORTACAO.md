# Manual de Importação — UAT Extractor (Power Automate)

Solução 100% Microsoft, sem instalação: um fluxo do Power Automate que lê a MS List, salva as imagens anexadas em pastas por ID no SharePoint e monta a planilha Excel com miniatura (`=IMAGE()`) e link por item.

**Arquivos:**
- `UAT_Extractor_Flow.zip` → pacote do fluxo (importar no Power Automate)
- `UAT_Resultados_Modelo.xlsx` → planilha destino com a tabela `TabelaUAT` (fazer upload no SharePoint)

---

## Passo 1 — Subir o Excel modelo no SharePoint

1. Abra o site do SharePoint → biblioteca onde o Excel ficará (ex: **Documentos → UAT**).
2. Clique em **Carregar → Arquivos** e envie `UAT_Resultados_Modelo.xlsx`.
3. Pronto — a planilha já contém a tabela nomeada `TabelaUAT` com as colunas: ID, Cenário, Passo, Resultado, Evidência 1 a 5, Link.

## Passo 2 — Importar o fluxo

1. Acesse [make.powerautomate.com](https://make.powerautomate.com).
2. Menu lateral esquerdo → **Meus fluxos**.
3. Barra superior → **Importar → Importar pacote (herdado)** *(Import Package (Legacy))*.
4. Clique em **Carregar** e selecione `UAT_Extractor_Flow.zip`.
5. Na tela "Revisar detalhes do pacote", na seção **Recursos relacionados**:
   - Linha **SharePoint** → clique em **Selecionar durante a importação** → escolha sua conexão SharePoint existente (ou clique em **+ Nova conexão**).
   - Linha **Excel Online (Business)** → mesmo procedimento.
6. Clique em **Importar** (botão no rodapé).

## Passo 3 — Configurar os 3 valores

Abra o fluxo importado (**Meus fluxos → UAT - Extrair MS Lists para Excel → Editar**). As **3 primeiras ações** do fluxo são as variáveis de configuração — edite apenas o campo **Valor** de cada uma:

| Ação | O que informar | Exemplo |
|---|---|---|
| `varSiteUrl` | **URL do SharePoint** (site, sem barra final) | `https://contoso.sharepoint.com/sites/Projetos` |
| `varNomeLista` | **Nome da MS List** (exato) | `UAT - Cenários e Passos` |
| `varBiblioteca` | **Biblioteca/pasta do Excel** (caminho relativo) | `Documentos Compartilhados/UAT` |

## Passo 4 — Apontar o arquivo Excel

1. Ainda no editor, abra a ação **Adicionar_linha_no_Excel** (dentro do loop "Para_cada_item").
2. Nos campos **Local / Biblioteca de Documentos / Arquivo**, use os dropdowns para navegar até o `UAT_Resultados_Modelo.xlsx` que você subiu no Passo 1.
3. No campo **Tabela**, selecione `TabelaUAT`.
4. Verifique também as ações **Obter_itens** e **Obter_anexos**: se os dropdowns de Site/Lista mostrarem aviso, selecione o site e a lista pelos dropdowns (os valores das variáveis continuam valendo para as URLs das imagens).
5. Clique em **Salvar**.

## Passo 5 — Executar

1. **Meus fluxos** → clique no fluxo → **Executar** (botão ▶ no topo).
2. Ao terminar:
   - As imagens estarão em `.../SuaBiblioteca/Evidencias/Item_{ID}/`;
   - A planilha terá uma linha por item, com até 5 miniaturas (`Evidência 1–5`) e o link **📷 Abrir pasta** com todas as evidências do ID.

> As colunas Evidência usam a função `=IMAGE()` — disponível no **Excel Microsoft 365** (Online ou desktop atualizado). Em versões antigas a célula mostra `#NOME?`, mas o link continua funcionando.

---

## Compartilhamento

Duas formas:
- **Compartilhar o fluxo**: no fluxo → **Compartilhar** → adicionar colegas como coproprietários (eles executam com a própria conta).
- **Distribuir o zip**: qualquer pessoa importa o mesmo `UAT_Extractor_Flow.zip` no ambiente dela (Passos 2–4).

## Mapeamento de colunas da List

O fluxo espera na MS List as colunas internas `Title` (Cenário), `Passo` e `Resultado`. Se as suas tiverem outros nomes, ajuste na ação **Adicionar_linha_no_Excel** usando o conteúdo dinâmico do "Obter_itens" (clique no campo → painel de conteúdo dinâmico → escolha a coluna certa).

## Limites conhecidos

- Até **5 imagens em miniatura** por ID (Evidência 1–5); a partir da 6ª, ficam acessíveis só pelo link da pasta (todas são salvas).
- Execução sequencial (1 item por vez) para preservar a ordem das linhas — listas grandes (>500 itens) podem levar alguns minutos.
- Se a MS List usa anexo por **coluna de imagem** (não "Anexos" clássico), me avise — o tratamento é outro conector.

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Erro ao importar o pacote | Conexões não mapeadas | Refaça o Passo 2 item 5 |
| `#NOME?` na coluna Evidência | Excel sem suporte a `=IMAGE()` | Abrir no Excel Online |
| Imagem não renderiza (ícone quebrado) | Usuário sem acesso à pasta Evidencias | Conceder acesso à biblioteca |
| Fluxo falha em "Salvar_imagem" | Caminho da biblioteca errado em `varBiblioteca` | Conferir o caminho relativo (sem domínio, sem `/sites/...`) |
| Linhas duplicadas | Fluxo executado 2x | Limpar a TabelaUAT antes de reexecutar |
