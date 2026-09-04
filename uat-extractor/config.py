# =============================================================================
# CONFIGURAÇÃO — preencher apenas estes 3 campos antes de executar
# =============================================================================

SHAREPOINT_URL   = "https://EMPRESA.sharepoint.com/sites/SITE"
# Exemplo: "https://contoso.sharepoint.com/sites/Projetos"

LIST_NAME        = "UAT - Cenários e Passos"
# Nome exato da MS List (sensível a maiúsculas/minúsculas)

EXCEL_LIBRARY    = "Documentos Compartilhados/UAT/Resultados"
# Caminho relativo dentro do site SharePoint onde o Excel será salvo
# Exemplo: "Documentos Compartilhados"  ou  "Documentos Compartilhados/UAT"

# =============================================================================
# AUTENTICAÇÃO — Azure App Registration (passo a passo no manual)
# =============================================================================

TENANT_ID  = "SEU-TENANT-ID"
CLIENT_ID  = "SEU-CLIENT-ID"
# CLIENT_SECRET não é necessário; o script usa Device Code Flow (login interativo)

# =============================================================================
# MAPEAMENTO DE COLUNAS DA MS LIST → campos internos
# Ajuste os valores (lado direito) para bater com os nomes das colunas na sua List
# Os nomes devem ser os "internal names" (visíveis na URL ao editar a coluna)
# =============================================================================

FIELD_MAP = {
    "id_cenario":       "CenarioID",          # ID/número do cenário
    "nome_cenario":     "Title",              # Nome/título do cenário
    "id_passo":         "PassoID",            # Número do passo dentro do cenário
    "descricao_passo":  "DescricaoPasso",     # O que deve ser feito
    "resultado_esperado": "ResultadoEsperado",
    "resultado_obtido": "ResultadoObtido",
    "status":           "Status",             # Aprovado | Reprovado | Bloqueado | Não executado
    "responsavel":      "Responsavel",        # Pessoa que executou
    "data_execucao":    "DataExecucao",
    "observacoes":      "Observacoes",
    "ambiente":         "Ambiente",           # DEV | HML | UAT
    "versao":           "Versao",             # Versão do sistema testado
}

# =============================================================================
# OPÇÕES DE SAÍDA
# =============================================================================

OUTPUT_FILENAME  = "UAT_Resultados_{data}.xlsx"
# {data} é substituído automaticamente pela data de extração (YYYY-MM-DD)

EMBED_IMAGES     = True
# True  → imagens embutidas nas células do Excel (arquivo maior, mais legível)
# False → imagens salvas numa pasta /evidencias/ ao lado do Excel

IMAGE_MAX_HEIGHT = 200   # altura máxima de cada imagem embutida (pixels)
IMAGE_MAX_WIDTH  = 300   # largura máxima de cada imagem embutida (pixels)

SHEET_SUMMARY    = True  # gera aba "Resumo" com totais por cenário/status
