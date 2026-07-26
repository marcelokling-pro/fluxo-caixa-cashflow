// servico.js — regras de negócio: criar, alterar, quitar, adiar, cancelar.
// Toda operação grava o compromisso e o histórico na mesma transação.

import * as db from "./db.js";
import {
  novoCompromisso,
  novoHistorico,
  agoraISO,
  hojeISO,
  uid,
  formatarData,
  formatarMoeda,
  labelStatus,
  labelRecorrencia,
} from "./model.js";
import { proximaDataFutura } from "./recorrencia.js";

const CAMPOS_RASTREADOS = {
  titulo: "Título",
  descricao: "Descrição",
  categoria: "Categoria",
  data: "Data",
  hora: "Hora",
  valor: "Valor",
  prioridade: "Prioridade",
  observacoes: "Observações",
  recorrencia: "Recorrência",
  lembretes: "Lembretes",
  status: "Situação",
};

function descreverAlteracoes(antes, depois) {
  const mudancas = [];
  for (const [campo, rotulo] of Object.entries(CAMPOS_RASTREADOS)) {
    const a = Array.isArray(antes[campo]) ? antes[campo].join(", ") : antes[campo] ?? "";
    const b = Array.isArray(depois[campo]) ? depois[campo].join(", ") : depois[campo] ?? "";
    if (String(a) !== String(b)) mudancas.push(`${rotulo}: "${a || "—"}" → "${b || "—"}"`);
  }
  return mudancas;
}

export async function criar(dados) {
  const c = novoCompromisso(dados);
  const h = novoHistorico(
    c.id,
    "criado",
    `Criado para ${formatarData(c.data)}${c.valor ? " — " + formatarMoeda(c.valor) : ""} (${labelRecorrencia(c.recorrencia)})`,
    { data: c.data, valor: c.valor }
  );
  await db.salvarCompromisso(c, h);
  return c;
}

export async function atualizar(id, dados) {
  const antes = await db.obterCompromisso(id);
  if (!antes) throw new Error("Compromisso não encontrado: " + id);
  const depois = novoCompromisso({
    ...antes,
    ...dados,
    id: antes.id,
    serieId: antes.serieId,
    criadoEm: antes.criadoEm,
    atualizadoEm: agoraISO(),
  });
  const mudancas = descreverAlteracoes(antes, depois);
  if (!mudancas.length) return antes;
  const h = novoHistorico(id, "alterado", mudancas.join(" | "), { mudancas });
  await db.salvarCompromisso(depois, h);
  return depois;
}

/**
 * Marca como pago/concluído. Quando o compromisso é recorrente, gera
 * automaticamente a próxima ocorrência (requisito 4) na mesma transação.
 * Retorna { atual, proximo }.
 */
export async function marcarPago(id, { data = hojeISO(), valor, observacao = "" } = {}) {
  const atual = await db.obterCompromisso(id);
  if (!atual) throw new Error("Compromisso não encontrado: " + id);

  const valorPago = valor === undefined || valor === "" || valor === null ? atual.valor : Number(valor);
  const pago = {
    ...atual,
    status: "pago",
    pagamento: { data, valor: valorPago, observacao },
    atualizadoEm: agoraISO(),
  };

  const historicos = [
    novoHistorico(
      id,
      "pago",
      `Pago em ${formatarData(data)}${valorPago ? " — " + formatarMoeda(valorPago) : ""}${observacao ? " (" + observacao + ")" : ""}`,
      { data, valor: valorPago, observacao }
    ),
  ];
  const compromissos = [pago];
  let proximo = null;

  const proximaData = proximaDataFutura(atual.data, atual.recorrencia, hojeISO());
  if (proximaData) {
    proximo = novoCompromisso({
      ...atual,
      id: uid(),
      serieId: atual.serieId,
      origemId: atual.id,
      data: proximaData,
      status: "pendente",
      pagamento: null,
      criadoEm: agoraISO(),
      atualizadoEm: agoraISO(),
    });
    compromissos.push(proximo);
    historicos.push(
      novoHistorico(
        proximo.id,
        "gerado",
        `Gerado automaticamente (${labelRecorrencia(atual.recorrencia)}) a partir de ${formatarData(atual.data)}`,
        { origemId: atual.id, data: proximaData }
      )
    );
  }

  await db.salvarLote(compromissos, historicos);
  return { atual: pago, proximo };
}

export async function reabrir(id) {
  const atual = await db.obterCompromisso(id);
  if (!atual) throw new Error("Compromisso não encontrado: " + id);
  const aberto = { ...atual, status: "pendente", pagamento: null, atualizadoEm: agoraISO() };
  const h = novoHistorico(id, "status", "Reaberto como pendente");
  await db.salvarCompromisso(aberto, h);
  return aberto;
}

export async function mudarStatus(id, status) {
  const atual = await db.obterCompromisso(id);
  if (!atual) throw new Error("Compromisso não encontrado: " + id);
  const novo = { ...atual, status, atualizadoEm: agoraISO() };
  const h = novoHistorico(id, "status", `Situação: ${labelStatus(atual.status)} → ${labelStatus(status)}`);
  await db.salvarCompromisso(novo, h);
  return novo;
}

/** Adia mantendo o registro da data anterior no histórico. */
export async function adiar(id, novaData, motivo = "") {
  const atual = await db.obterCompromisso(id);
  if (!atual) throw new Error("Compromisso não encontrado: " + id);
  const novo = { ...atual, data: novaData, status: "adiado", atualizadoEm: agoraISO() };
  const h = novoHistorico(
    id,
    "adiado",
    `Adiado de ${formatarData(atual.data)} para ${formatarData(novaData)}${motivo ? " — " + motivo : ""}`,
    { de: atual.data, para: novaData, motivo }
  );
  await db.salvarCompromisso(novo, h);
  return novo;
}

export async function excluir(id) {
  const atual = await db.obterCompromisso(id);
  await db.excluirCompromisso(id, atual?.titulo || "");
}

export async function carregarTudo() {
  const [compromissos, categorias] = await Promise.all([
    db.listarCompromissos(),
    db.listarCategorias(),
  ]);
  return { compromissos, categorias };
}
