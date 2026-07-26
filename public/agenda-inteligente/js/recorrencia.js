// recorrencia.js — motor de recorrência.
// Funções puras sobre datas no formato YYYY-MM-DD (sempre local, nunca UTC).

import { RECORRENCIAS, hojeISO } from "./model.js";

/** Converte YYYY-MM-DD em Date local (evita o deslocamento de fuso do new Date("2026-08-10")). */
export function paraData(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function paraISO(date) {
  return hojeISO(date);
}

export function somarDias(iso, n) {
  const d = paraData(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}

export function ultimoDiaDoMes(ano, mesZeroBased) {
  return new Date(ano, mesZeroBased + 1, 0).getDate();
}

/**
 * Soma meses preservando o dia do vencimento.
 * 31/01 + 1 mês = 28/02 (ou 29/02 em ano bissexto) — nunca "vaza" para março.
 */
export function somarMeses(iso, n) {
  const d = paraData(iso);
  const diaOriginal = d.getDate();
  const alvoMes = d.getMonth() + n;
  const ano = d.getFullYear() + Math.floor(alvoMes / 12);
  const mes = ((alvoMes % 12) + 12) % 12;
  const dia = Math.min(diaOriginal, ultimoDiaDoMes(ano, mes));
  return paraISO(new Date(ano, mes, dia));
}

/** Próxima data de vencimento, ou null quando o compromisso é único. */
export function proximaData(iso, recorrencia) {
  const regra = RECORRENCIAS.find((r) => r.id === recorrencia);
  if (!regra || regra.id === "unico") return null;
  if (regra.dias) return somarDias(iso, regra.dias);
  if (regra.meses) return somarMeses(iso, regra.meses);
  return null;
}

/** Lista as próximas N ocorrências a partir de uma data (sem incluí-la). */
export function proximasOcorrencias(iso, recorrencia, quantidade = 3) {
  const out = [];
  let atual = iso;
  for (let i = 0; i < quantidade; i++) {
    const prox = proximaData(atual, recorrencia);
    if (!prox) break;
    out.push(prox);
    atual = prox;
  }
  return out;
}

/**
 * Avança a data até que ela seja >= referência.
 * Usado quando um recorrente é quitado com muito atraso: evita gerar
 * o "próximo" vencimento também no passado.
 */
export function proximaDataFutura(iso, recorrencia, referencia = hojeISO()) {
  let prox = proximaData(iso, recorrencia);
  if (!prox) return null;
  let guarda = 0;
  while (prox < referencia && guarda < 500) {
    const seguinte = proximaData(prox, recorrencia);
    if (!seguinte) break;
    prox = seguinte;
    guarda++;
  }
  return prox;
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diffDias(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((paraData(b).getTime() - paraData(a).getTime()) / MS);
}

/** Intervalo [inicio, fim] da semana corrente (segunda a domingo). */
export function semanaDe(iso = hojeISO()) {
  const d = paraData(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  const inicio = somarDias(iso, -dow);
  return { inicio, fim: somarDias(inicio, 6) };
}

/** Intervalo [inicio, fim] do mês da data informada. */
export function mesDe(iso = hojeISO()) {
  const d = paraData(iso);
  const ano = d.getFullYear();
  const mes = d.getMonth();
  return {
    inicio: paraISO(new Date(ano, mes, 1)),
    fim: paraISO(new Date(ano, mes, ultimoDiaDoMes(ano, mes))),
  };
}

export function dentroDoIntervalo(iso, inicio, fim) {
  return iso >= inicio && iso <= fim;
}
