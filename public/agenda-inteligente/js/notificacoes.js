// notificacoes.js — motor de notificações locais.
// Enquanto o app está aberto, o agendador roda aqui; com o app fechado,
// quem checa é o service worker (periodicsync / sync), usando as mesmas chaves.

import * as db from "./db.js";
import { agoraISO, hojeISO } from "./model.js";
import { lembretesDevidos } from "./lembretes.js";

const INTERVALO_MS = 60 * 1000;
let timer = null;
let registroSW = null;

export function suportado() {
  return typeof Notification !== "undefined";
}

export function permissao() {
  return suportado() ? Notification.permission : "unsupported";
}

export async function pedirPermissao() {
  if (!suportado()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function definirRegistroSW(reg) {
  registroSW = reg;
}

async function exibir(titulo, opcoes) {
  if (permissao() !== "granted") return false;
  try {
    const reg = registroSW || (await navigator.serviceWorker?.getRegistration?.());
    if (reg?.showNotification) {
      await reg.showNotification(titulo, opcoes);
      return true;
    }
    new Notification(titulo, opcoes);
    return true;
  } catch (e) {
    console.warn("[notificacoes] falha ao exibir", e);
    return false;
  }
}

async function enviadosSet() {
  const itens = await db.listarLembretesEnviados();
  return new Set(itens.map((i) => i.id));
}

/**
 * Verifica e dispara os lembretes vencidos.
 * Só marca como enviado o que realmente foi exibido — sem permissão, o lembrete
 * fica pendente e dispara assim que o usuário autorizar (nunca se perde).
 */
export async function verificar(compromissos = null) {
  const lista = compromissos || (await db.listarCompromissos());
  const enviados = await enviadosSet();
  const devidos = lembretesDevidos(lista, enviados, hojeISO());
  let disparados = 0;

  if (permissao() !== "granted") {
    return { devidos: devidos.length, disparados: 0, semPermissao: true };
  }

  for (const d of devidos) {
    const ok = await exibir(d.titulo, {
      body: d.corpo,
      tag: d.chave,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { compromissoId: d.compromisso.id, url: "./index.html" },
      requireInteraction: d.dias === 0,
      vibrate: [120, 60, 120],
    });
    if (!ok) continue;
    await db.marcarLembreteEnviado({
      id: d.chave,
      compromissoId: d.compromisso.id,
      dias: d.dias,
      dataCompromisso: d.compromisso.data,
      em: agoraISO(),
    });
    disparados++;
  }

  await db.setConfig("ultimaVerificacaoLembretes", agoraISO());
  return { devidos: devidos.length, disparados };
}

/** Notificação avulsa (usada em testes e confirmações do assistente). */
export function notificarAgora(titulo, corpo) {
  return exibir(titulo, { body: corpo, icon: "./icons/icon-192.png" });
}

/**
 * Agendador em primeiro plano: checa a cada minuto e sempre que a aba
 * volta a ficar visível (cobre o caso de o celular ter ficado suspenso).
 */
export function iniciarAgendador() {
  if (timer) return;
  const rodar = () => verificar().catch((e) => console.warn("[notificacoes] verificação falhou", e));
  rodar();
  timer = setInterval(rodar, INTERVALO_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") rodar();
  });
  window.addEventListener("online", rodar);
}

export function pararAgendador() {
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * Background: pede ao navegador para acordar o service worker periodicamente.
 * Só o Chrome/Android instalado como PWA concede — o fallback continua sendo
 * a verificação ao abrir o app.
 */
export async function registrarVerificacaoEmSegundoPlano() {
  try {
    const reg = registroSW || (await navigator.serviceWorker?.getRegistration?.());
    if (!reg) return { ativo: false, motivo: "sem service worker" };
    if ("periodicSync" in reg) {
      const status = await navigator.permissions?.query?.({ name: "periodic-background-sync" });
      if (!status || status.state === "granted") {
        await reg.periodicSync.register("checar-lembretes", { minInterval: 6 * 60 * 60 * 1000 });
        return { ativo: true, tipo: "periodicSync" };
      }
      return { ativo: false, motivo: "permissão negada" };
    }
    return { ativo: false, motivo: "periodicSync indisponível" };
  } catch (e) {
    return { ativo: false, motivo: e.message };
  }
}
