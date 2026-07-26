// lembretes.js — decide QUAIS lembretes estão vencidos agora.
// Puro: recebe a lista e o conjunto de já enviados, devolve o que falta disparar.

import { estaAberto, hojeISO, formatarData, formatarMoeda, labelLembrete } from "./model.js";
import { somarDias, diffDias } from "./recorrencia.js";

/** Chave estável por (compromisso, antecedência, data do vencimento). */
export function chaveLembrete(compromisso, dias) {
  return `${compromisso.id}:${dias}:${compromisso.data}`;
}

export function textoLembrete(c, dias) {
  const quando =
    dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`;
  const partes = [`${formatarData(c.data)}${c.hora ? " às " + c.hora : ""}`];
  if (c.valor) partes.push(formatarMoeda(c.valor));
  if (c.categoria) partes.push(c.categoria);
  return {
    titulo: `⏰ ${c.titulo} ${quando}`,
    corpo: partes.join(" • "),
  };
}

/**
 * Lembretes a disparar. Um lembrete vence quando a data-alvo
 * (vencimento − dias) já chegou e o compromisso continua em aberto.
 * Se o lembrete foi configurado depois da data-alvo, dispara assim mesmo
 * (o usuário não perde o aviso), mas nunca depois do vencimento.
 */
export function lembretesDevidos(compromissos, enviados = new Set(), hoje = hojeISO()) {
  const devidos = [];
  for (const c of compromissos) {
    if (!estaAberto(c)) continue;
    if (c.data < hoje) continue; // vencidos aparecem no painel, não geram lembrete novo
    for (const dias of c.lembretes || []) {
      const alvo = somarDias(c.data, -Number(dias));
      if (alvo > hoje) continue;
      const chave = chaveLembrete(c, dias);
      if (enviados.has(chave)) continue;
      devidos.push({ chave, compromisso: c, dias, ...textoLembrete(c, dias) });
    }
  }
  // Mais urgente primeiro.
  return devidos.sort((a, b) => diffDias(hoje, a.compromisso.data) - diffDias(hoje, b.compromisso.data));
}

/** Próximo lembrete futuro de um compromisso — usado no detalhe da tela. */
export function proximoLembrete(c, hoje = hojeISO()) {
  const futuros = (c.lembretes || [])
    .map((dias) => ({ dias, alvo: somarDias(c.data, -Number(dias)) }))
    .filter((l) => l.alvo >= hoje)
    .sort((a, b) => (a.alvo < b.alvo ? -1 : 1));
  if (!futuros.length) return null;
  return { ...futuros[0], label: labelLembrete(futuros[0].dias) };
}
