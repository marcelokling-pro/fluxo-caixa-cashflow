// consultas.js — filtros, buscas e totalizações.
// Módulo puro (recebe a lista pronta): serve tanto à UI quanto ao assistente de voz.

import { statusEfetivo, estaAberto, hojeISO } from "./model.js";
import { mesDe, semanaDe, somarDias, dentroDoIntervalo, diffDias } from "./recorrencia.js";

function normalizar(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ordenarPorData(lista) {
  return [...lista].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    return (a.hora || "99:99").localeCompare(b.hora || "99:99");
  });
}

/**
 * Filtro único usado pela busca (requisito 11).
 * Campos aceitos: texto, categoria, status, prioridade, de, ate, valorMin, valorMax.
 * `status` compara com o status EFETIVO, então "atrasado" funciona mesmo sendo derivado.
 */
export function filtrar(lista, filtros = {}, hoje = hojeISO()) {
  const texto = normalizar(filtros.texto);
  return lista.filter((c) => {
    const st = statusEfetivo(c, hoje);
    if (filtros.categoria && c.categoria !== filtros.categoria) return false;
    if (filtros.status && st !== filtros.status) return false;
    if (filtros.prioridade && c.prioridade !== filtros.prioridade) return false;
    if (filtros.recorrencia && c.recorrencia !== filtros.recorrencia) return false;
    if (filtros.de && c.data < filtros.de) return false;
    if (filtros.ate && c.data > filtros.ate) return false;
    if (filtros.valorMin != null && filtros.valorMin !== "" && Number(c.valor || 0) < Number(filtros.valorMin)) return false;
    if (filtros.valorMax != null && filtros.valorMax !== "" && Number(c.valor || 0) > Number(filtros.valorMax)) return false;
    if (texto) {
      const alvo = normalizar(
        [c.titulo, c.descricao, c.categoria, c.observacoes, c.valor, c.data].join(" ")
      );
      if (!alvo.includes(texto)) return false;
    }
    return true;
  });
}

export function vencidos(lista, hoje = hojeISO()) {
  return ordenarPorData(lista.filter((c) => estaAberto(c) && c.data < hoje));
}

export function doDia(lista, dia = hojeISO()) {
  return ordenarPorData(lista.filter((c) => c.data === dia && c.status !== "cancelado"));
}

/** Próximos vencimentos em aberto dentro da janela de N dias (a partir de amanhã). */
export function proximos(lista, dias = 7, hoje = hojeISO()) {
  const limite = somarDias(hoje, dias);
  return ordenarPorData(
    lista.filter((c) => estaAberto(c) && c.data > hoje && c.data <= limite)
  );
}

export function proximoCompromisso(lista, hoje = hojeISO()) {
  return ordenarPorData(lista.filter((c) => estaAberto(c) && c.data >= hoje))[0] || null;
}

export function noIntervalo(lista, inicio, fim, apenasAbertos = false) {
  return ordenarPorData(
    lista.filter(
      (c) =>
        dentroDoIntervalo(c.data, inicio, fim) &&
        c.status !== "cancelado" &&
        (!apenasAbertos || estaAberto(c))
    )
  );
}

export function daSemana(lista, hoje = hojeISO()) {
  const { inicio, fim } = semanaDe(hoje);
  return noIntervalo(lista, inicio, fim);
}

export function doMes(lista, hoje = hojeISO()) {
  const { inicio, fim } = mesDe(hoje);
  return noIntervalo(lista, inicio, fim);
}

function soma(lista) {
  return lista.reduce((acc, c) => acc + Number(c.valor || 0), 0);
}

/** Números do painel inicial (requisito 10). */
export function resumo(lista, hoje = hojeISO()) {
  const { inicio, fim } = mesDe(hoje);
  const mes = lista.filter((c) => dentroDoIntervalo(c.data, inicio, fim) && c.status !== "cancelado");
  const pagosMes = mes.filter((c) => c.status === "pago");
  const abertosMes = mes.filter((c) => estaAberto(c));
  const listaVencidos = vencidos(lista, hoje);
  const listaHoje = doDia(lista, hoje).filter((c) => estaAberto(c));
  const lista7 = proximos(lista, 7, hoje);

  return {
    vencidos: listaVencidos,
    hoje: listaHoje,
    proximos: lista7,
    quantidadeMes: mes.length,
    totalPrevistoMes: soma(mes),
    totalPagoMes: soma(pagosMes),
    totalPendenteMes: soma(abertosMes),
    totalVencido: soma(listaVencidos),
    periodoMes: { inicio, fim },
  };
}

/** Agrupa por categoria com total e contagem — base do resumo por voz e da lista. */
export function porCategoria(lista) {
  const mapa = new Map();
  lista.forEach((c) => {
    const atual = mapa.get(c.categoria) || { categoria: c.categoria, quantidade: 0, total: 0 };
    atual.quantidade++;
    atual.total += Number(c.valor || 0);
    mapa.set(c.categoria, atual);
  });
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, "pt-BR"));
}

/** Rótulo relativo ("hoje", "amanhã", "em 3 dias", "há 2 dias"). */
export function rotuloRelativo(dataISO, hoje = hojeISO()) {
  const d = diffDias(hoje, dataISO);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d > 1) return `em ${d} dias`;
  return `há ${Math.abs(d)} dias`;
}
