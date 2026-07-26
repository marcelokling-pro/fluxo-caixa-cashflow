// app.js — inicialização: banco, service worker, notificações e interface.

import * as db from "./db.js";
import * as ui from "./ui.js";
import * as notificacoes from "./notificacoes.js";

export const VERSAO = "1.1.0";

async function registrarServiceWorker() {
  const alvo = document.querySelector("#status-sw");
  if (!("serviceWorker" in navigator)) {
    if (alvo) alvo.textContent = "Service worker indisponível: o app funciona, mas sem cache offline.";
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    notificacoes.definirRegistroSW(reg);
    if (alvo) alvo.textContent = "Modo offline ativo (service worker registrado).";

    // Um clique na notificação abre o compromisso correspondente.
    navigator.serviceWorker.addEventListener("message", (ev) => {
      if (ev.data?.tipo === "abrir-compromisso") {
        ui.abrirAba("lista");
        document.querySelector("#f-texto").value = "";
        ui.toast("Compromisso do lembrete aberto na lista.");
      }
      if (ev.data?.tipo === "verificar-lembretes") {
        notificacoes.verificar().catch(() => {});
      }
    });
    return reg;
  } catch (e) {
    console.warn("[app] falha ao registrar service worker", e);
    if (alvo) alvo.textContent = "Não foi possível ativar o modo offline: " + e.message;
    return null;
  }
}

function prepararInstalacao() {
  const btn = document.querySelector("#btn-instalar");
  let evento = null;
  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    evento = ev;
    btn.hidden = false;
  });
  btn.addEventListener("click", async () => {
    if (!evento) return;
    evento.prompt();
    const escolha = await evento.userChoice;
    if (escolha.outcome === "accepted") btn.hidden = true;
    evento = null;
  });
  window.addEventListener("appinstalled", () => {
    btn.hidden = true;
    ui.toast("App instalado. Abra pela tela inicial para receber lembretes.");
  });
}

async function iniciar() {
  document.querySelector("#versao-app").textContent = "v" + VERSAO;

  try {
    await db.iniciar();
  } catch (e) {
    console.error("[app] banco indisponível", e);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<p style="padding:16px;color:#E8445A">Não foi possível abrir o banco local (IndexedDB). Em janelas anônimas alguns navegadores bloqueiam o armazenamento — abra em uma janela normal.</p>`
    );
    return;
  }

  const persistencia = await db.garantirPersistencia();
  ui.iniciar({ persistencia });
  await ui.carregar();

  // atalhos do manifest (ícone longo-pressionado na tela inicial)
  const acao = new URLSearchParams(location.search).get("acao");
  if (acao === "novo") ui.abrirForm();
  if (acao === "assistente") ui.abrirAba("assistente");

  await registrarServiceWorker();
  prepararInstalacao();

  if (notificacoes.permissao() === "granted") {
    notificacoes.registrarVerificacaoEmSegundoPlano();
  }
  notificacoes.iniciarAgendador();

  window.addEventListener("unhandledrejection", (ev) => {
    console.error("[app] promessa rejeitada", ev.reason);
    ui.toast("Ocorreu um erro: " + (ev.reason?.message || ev.reason), true);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
