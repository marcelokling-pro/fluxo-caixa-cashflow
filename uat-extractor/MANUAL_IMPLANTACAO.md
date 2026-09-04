# Manual de Implantação — UAT MS Lists Extractor

> Tempo estimado: 20–30 minutos (primeira vez) | 2 minutos (execuções seguintes)

---

## O que esta ferramenta faz

Conecta-se à sua MS List no SharePoint via Microsoft Graph API, extrai todos os registros de cenários e passos de UAT (incluindo as imagens anexadas a cada item) e gera um arquivo Excel `.xlsx` formatado com:

- **Aba Capa** — data de extração, fonte e totalizadores rápidos  
- **Aba Detalhes UAT** — uma linha por passo, com imagens embutidas na coluna Evidências  
- **Aba Resumo** — contagem de aprovados/reprovados/bloqueados por cenário  

---

## Pré-requisitos

| Requisito | Versão mínima |
|---|---|
| Python | 3.9 |
| Acesso ao Azure Active Directory (Entra ID) do tenant | — |
| Permissão de leitura na MS List no SharePoint | — |

---

## Passo 1 — Registrar o Aplicativo no Azure (feito uma única vez)

> Precisa de permissão de **Administrador** no Azure AD. Se não tiver, peça ao time de TI para executar este passo e te fornecer os valores de **Tenant ID** e **Client ID**.

1. Acesse [portal.azure.com](https://portal.azure.com) e faça login.  
2. No menu lateral, clique em **Microsoft Entra ID** (ou "Azure Active Directory").  
3. Clique em **Registros de aplicativos** → **Novo registro**.  
4. Preencha:  
   - **Nome**: `UAT Extractor` (qualquer nome)  
   - **Tipos de conta suportados**: *Contas neste diretório organizacional apenas*  
   - **URI de redirecionamento**: deixe em branco  
5. Clique em **Registrar**.  
6. Na tela do app, copie:  
   - **ID do aplicativo (cliente)** → será seu `CLIENT_ID`  
   - **ID do diretório (locatário)** → será seu `TENANT_ID`  
7. No menu lateral do app, clique em **Permissões de API** → **Adicionar uma permissão**.  
8. Selecione **Microsoft Graph** → **Permissões delegadas**.  
9. Pesquise e adicione as seguintes permissões:  
   - `Sites.Read.All`  
   - `Files.ReadWrite.All` *(só se quiser upload automático)*  
10. Clique em **Conceder consentimento do administrador** (botão azul no topo da lista).

---

## Passo 2 — Instalar dependências Python

Abra o terminal na pasta `uat-extractor/`:

```bash
pip install -r requirements.txt
```

Se tiver restrições de ambiente, use ambiente virtual:

```bash
python -m venv .venv
source .venv/bin/activate        # Linux/Mac
.venv\Scripts\activate.bat       # Windows
pip install -r requirements.txt
```

---

## Passo 3 — Configurar os 3 campos em `config.py`

Abra o arquivo `config.py` e preencha **apenas estes 3 campos**:

```python
SHAREPOINT_URL = "https://EMPRESA.sharepoint.com/sites/SITE"
LIST_NAME      = "Nome da MS List"
EXCEL_LIBRARY  = "Documentos Compartilhados/UAT"
```

### Como encontrar cada valor

#### `SHAREPOINT_URL`
Abra o site do SharePoint no navegador. Copie a URL até o nome do site, **sem barra no final**:

```
https://contoso.sharepoint.com/sites/ProjetoX
                                     ^^^^^^^^^ — só até aqui
```

#### `LIST_NAME`
Abra a MS List no SharePoint. O nome aparece no topo da página (acima da barra de filtros). Copie exatamente como está, incluindo maiúsculas e espaços.

#### `EXCEL_LIBRARY`
É o caminho da **biblioteca de documentos** dentro do site onde o arquivo Excel será salvo. Para descobrir:
1. Acesse o SharePoint → clique em **Documentos** (ou outra biblioteca de destino) no menu lateral.  
2. Navegue até a pasta desejada.  
3. Copie o trecho da URL depois de `/Forms/AllItems.aspx`:  
   - URL: `.../sites/ProjetoX/Documentos%20Compartilhados/UAT/...`  
   - Valor para o campo: `Documentos Compartilhados/UAT`  

> ⚠️ **Atenção**: não inclua o domínio nem `/sites/NomeSite/` — apenas o caminho relativo dentro do site.

---

## Passo 4 — Preencher `TENANT_ID` e `CLIENT_ID`

No mesmo `config.py`, preencha com os valores copiados no Passo 1:

```python
TENANT_ID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
CLIENT_ID = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
```

---

## Passo 5 — Mapear as colunas da MS List (se necessário)

A seção `FIELD_MAP` em `config.py` conecta os campos internos do script aos nomes das colunas da sua MS List.

Para verificar o nome interno de uma coluna:
1. Abra a MS List no SharePoint.  
2. Clique no ícone de engrenagem (⚙️) → **Configurações da lista**.  
3. Clique no nome de uma coluna.  
4. Observe a URL: `.../List/NomeLista/EditField.aspx?Field=**NomeInterno**`  
5. O valor depois de `Field=` é o nome interno — use esse valor no `FIELD_MAP`.

Exemplo: se a coluna se chama "Descrição do Passo" mas o nome interno é `DescPasso`, ajuste:

```python
"descricao_passo": "DescPasso",
```

---

## Passo 6 — Executar

```bash
python extractor.py
```

Na primeira execução (e sempre que o token expirar), o terminal exibirá:

```
🔐  AUTENTICAÇÃO NECESSÁRIA
=============================================
Para fazer login, acesse: https://microsoft.com/devicelogin
E insira o código: ABCD-EFGH
=============================================
```

1. Abra o link no navegador.  
2. Digite o código exibido.  
3. Faça login com sua conta corporativa.  
4. Volte ao terminal — a extração continuará automaticamente.

Ao final, o Excel será salvo na pasta corrente com o nome `UAT_Resultados_YYYY-MM-DD.xlsx`. O script perguntará se deseja fazer upload para o SharePoint.

---

## Resultado esperado

```
UAT_Resultados_2026-07-14.xlsx
└── Capa              ← totalizadores e metadados
└── Detalhes UAT      ← uma linha por passo, imagens embutidas
└── Resumo            ← por cenário: total, aprovados, reprovados, bloqueados
```

---

## Ajustes opcionais em `config.py`

| Campo | Padrão | O que faz |
|---|---|---|
| `EMBED_IMAGES` | `True` | `False` → salva imagens em pasta `/evidencias/` separada |
| `IMAGE_MAX_HEIGHT` | `200` | Altura máxima de cada imagem embutida (px) |
| `IMAGE_MAX_WIDTH` | `300` | Largura máxima de cada imagem embutida (px) |
| `SHEET_SUMMARY` | `True` | `False` → omite a aba Resumo |
| `OUTPUT_FILENAME` | `UAT_Resultados_{data}.xlsx` | Nome do arquivo de saída |

---

## Solução de problemas

| Mensagem | Causa | Solução |
|---|---|---|
| `❌ List 'X' não encontrada` | Nome da lista diferente do exato | Verifique o nome em Configurações da lista |
| `❌ Falha na autenticação` | Permissões não concedidas | Refaça o Passo 1, item 10 |
| `AADSTS50020` | Conta pessoal em tenant corporativo | Use a conta do domínio da empresa |
| `403 Forbidden` na API | Consentimento de admin não dado | Passo 1, item 10 — precisa de admin |
| Imagens não aparecem | Anexos sem extensão de imagem | Verifique que os arquivos têm `.png/.jpg` |
| Excel sem coluna Evidências | `FIELD_MAP` com campo errado | Revise os nomes internos (Passo 5) |

---

## Atualização / reexecução

Para extrair novamente (ex: novo ciclo de testes), basta executar `python extractor.py` — não precisa reconfigurar. O token fica em cache por ~1 hora.

---

*Ferramenta gerada em 2026-07-14. Compatível com Microsoft Graph API v1.0.*
