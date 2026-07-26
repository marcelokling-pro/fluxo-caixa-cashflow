// backup.js — exportação e restauração completa dos dados.

import * as db from "./db.js";
import { novoCompromisso, novoHistorico, agoraISO, hojeISO, formatarData } from "./model.js";

export const FORMATO = "agenda-inteligente/backup";
export const FORMATO_VERSAO = 1;

/** Snapshot completo do banco — nada fica de fora. */
export async function montarBackup() {
  const [compromissos, historico, categorias, config, lembretes] = await Promise.all([
    db.listar(db.STORES.compromissos),
    db.listar(db.STORES.historico),
    db.listar(db.STORES.categorias),
    db.listar(db.STORES.config),
    db.listar(db.STORES.lembretes),
  ]);
  return {
    formato: FORMATO,
    versao: FORMATO_VERSAO,
    exportadoEm: agoraISO(),
    totais: { compromissos: compromissos.length, historico: historico.length },
    compromissos,
    historico,
    categorias,
    config,
    lembretes,
  };
}

function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportarJSON() {
  const backup = await montarBackup();
  baixar(`agenda-backup-${hojeISO()}.json`, JSON.stringify(backup, null, 2), "application/json");
  await db.setConfig("ultimoBackup", agoraISO());
  return backup.totais;
}

const COLUNAS_CSV = [
  ["titulo", "Título"],
  ["categoria", "Categoria"],
  ["data", "Vencimento"],
  ["hora", "Hora"],
  ["valor", "Valor"],
  ["status", "Situação"],
  ["prioridade", "Prioridade"],
  ["recorrencia", "Recorrência"],
  ["lembretes", "Lembretes (dias antes)"],
  ["descricao", "Descrição"],
  ["observacoes", "Observações"],
  ["pagamentoData", "Data do pagamento"],
  ["pagamentoValor", "Valor pago"],
];

function campoCSV(v) {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com separador ";" e BOM — abre direto no Excel em pt-BR. */
export async function exportarCSV(lista = null) {
  const compromissos = lista || (await db.listarCompromissos());
  const linhas = [COLUNAS_CSV.map(([, rotulo]) => rotulo).join(";")];
  compromissos
    .slice()
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .forEach((c) => {
      const plano = {
        ...c,
        data: formatarData(c.data),
        valor: c.valor == null ? "" : String(c.valor).replace(".", ","),
        lembretes: (c.lembretes || []).join(" / "),
        pagamentoData: c.pagamento?.data ? formatarData(c.pagamento.data) : "",
        pagamentoValor: c.pagamento?.valor != null ? String(c.pagamento.valor).replace(".", ",") : "",
      };
      linhas.push(COLUNAS_CSV.map(([campo]) => campoCSV(plano[campo])).join(";"));
    });
  baixar(`agenda-${hojeISO()}.csv`, "﻿" + linhas.join("\r\n"), "text/csv;charset=utf-8");
  return compromissos.length;
}

export function validarBackup(dados) {
  if (!dados || typeof dados !== "object") return "Arquivo inválido.";
  if (dados.formato && dados.formato !== FORMATO) return "Este arquivo não é um backup da Agenda Inteligente.";
  if (!Array.isArray(dados.compromissos)) return "Backup sem a lista de compromissos.";
  if (dados.versao && Number(dados.versao) > FORMATO_VERSAO)
    return "Backup gerado por uma versão mais nova do aplicativo.";
  return null;
}

/**
 * Restaura um backup.
 * modo "mesclar" (padrão): mantém o que existe e sobrescreve por id.
 * modo "substituir": apaga tudo antes — usado na restauração de aparelho novo.
 */
export async function restaurar(dados, modo = "mesclar") {
  const erro = validarBackup(dados);
  if (erro) throw new Error(erro);

  if (modo === "substituir") {
    await Promise.all([
      db.limparStore(db.STORES.compromissos),
      db.limparStore(db.STORES.historico),
      db.limparStore(db.STORES.categorias),
      db.limparStore(db.STORES.lembretes),
    ]);
  }

  const compromissos = dados.compromissos.map((c) => novoCompromisso(c));
  const historico = Array.isArray(dados.historico) ? dados.historico : [];
  const categorias = Array.isArray(dados.categorias)
    ? dados.categorias.map((c) => (typeof c === "string" ? { nome: c, criadaEm: agoraISO() } : c))
    : [];
  const lembretes = Array.isArray(dados.lembretes) ? dados.lembretes : [];

  await db.gravarVarios(db.STORES.compromissos, compromissos, "compromissos");
  await db.gravarVarios(db.STORES.historico, historico, "historico");
  await db.gravarVarios(db.STORES.categorias, categorias, "categorias");
  await db.gravarVarios(db.STORES.lembretes, lembretes, "lembretes");
  await db.registrarHistorico(
    novoHistorico(
      "sistema",
      "restaurado",
      `Backup de ${dados.exportadoEm || "origem desconhecida"} restaurado (${modo}): ${compromissos.length} compromissos`
    )
  );
  await db.setConfig("ultimaRestauracao", agoraISO());

  return { compromissos: compromissos.length, historico: historico.length, categorias: categorias.length };
}

export function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        resolve(JSON.parse(String(leitor.result)));
      } catch (e) {
        reject(new Error("Não foi possível ler o arquivo: JSON inválido."));
      }
    };
    leitor.onerror = () => reject(leitor.error || new Error("Falha ao ler o arquivo."));
    leitor.readAsText(file);
  });
}
