// ui.js — renderização e eventos da interface.
// Mantém o estado em memória apenas como espelho do IndexedDB: toda escrita
// vai para o banco e a tela é redesenhada a partir do que voltou de lá.

import * as db from "./db.js";
import * as servico from "./servico.js";
import * as consultas from "./consultas.js";
import * as backup from "./backup.js";
import * as notificacoes from "./notificacoes.js";
import { Assistente, Escuta, falar, calarBoca, reconhecimentoDisponivel } from "./voz.js";
import { proximoLembrete, avisosAtivos } from "./lembretes.js";
import {
  RECORRENCIAS,
  PRIORIDADES,
  STATUS,
  LEMBRETES_PRESET,
  TIPOS_HISTORICO,
  hojeISO,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  labelRecorrencia,
  labelPrioridade,
  corPrioridade,
  labelStatus,
  corStatus,
  labelLembrete,
  statusEfetivo,
  estaAberto,
  VERSAO,
  MODO_ARQUIVO,
  MODOS_ASSISTENTE,
  ABAS_INICIAIS,
} from "./model.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const estado = {
  compromissos: [],
  categorias: [],
  modoAssistente: "automatico",
  abaInicial: "painel",
  aba: "painel",
  filtros: {},
  lembretesSelecionados: new Set(),
  assistente: null,
  escuta: null,
};

export function esc(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let timerToast = null;
/**
 * Mensagem curta some sozinha; instrução longa fica fixa até o usuário fechar —
 * ninguém consegue ler e executar um passo a passo que desaparece em 5 segundos.
 */
export function toast(mensagem, erro = false, fixo = null) {
  const el = $("#toast");
  const permanente = fixo == null ? String(mensagem).length > 80 : fixo;
  el.textContent = mensagem;
  el.classList.toggle("erro", !!erro);
  el.classList.toggle("fixo", permanente);
  el.hidden = false;
  el.onclick = () => (el.hidden = true);
  clearTimeout(timerToast);
  if (!permanente) timerToast = setTimeout(() => (el.hidden = true), erro ? 5200 : 3000);
}

/* ---------- Carga e render ---------- */

export async function carregar() {
  const { compromissos, categorias } = await servico.carregarTudo();
  estado.compromissos = compromissos;
  estado.categorias = categorias;
  renderizar();
}

export function renderizar() {
  renderPainel();
  renderLista();
  renderSelects();
  renderCategoriasAjustes();
  renderChips();
}

function itemHTML(c) {
  const st = statusEfetivo(c);
  const cor = st === "atrasado" ? "#E8445A" : corStatus(st);
  const relativo = consultas.rotuloRelativo(c.data);
  const lembrete = proximoLembrete(c);
  return `
    <article class="item ${c.status === "pago" ? "pago" : ""}" data-id="${c.id}" style="border-left-color:${cor}">
      <div class="item-topo">
        <span class="item-titulo">${esc(c.titulo)}</span>
        <span class="item-valor">${c.valor != null ? formatarMoeda(c.valor) : ""}</span>
      </div>
      <div class="item-meta">
        <span>${formatarData(c.data)}${c.hora ? " · " + esc(c.hora) : ""} · ${relativo}</span>
        <span class="tag" style="color:${cor}">${labelStatus(st)}</span>
        <span class="tag" style="color:${corPrioridade(c.prioridade)}">${labelPrioridade(c.prioridade)}</span>
        <span>${esc(c.categoria)}</span>
        ${c.recorrencia !== "unico" ? `<span>🔁 ${labelRecorrencia(c.recorrencia)}</span>` : ""}
        ${lembrete ? `<span>🔔 ${esc(lembrete.label)}</span>` : ""}
      </div>
    </article>`;
}

function pintarLista(elId, itens, vazio) {
  const el = $(elId);
  el.innerHTML = itens.length ? itens.map(itemHTML).join("") : `<p class="vazio">${vazio}</p>`;
}

/**
 * Avisos na própria tela. É o que garante o lembrete quando o navegador não
 * deixa notificar (app aberto como arquivo, permissão negada, iOS).
 */
function renderAvisos() {
  const el = $("#aviso-lembretes");
  // sem persistência, o aviso mais importante é esse — vem antes de qualquer lembrete
  if (db.modoArmazenamento() === "memoria") {
    el.hidden = false;
    el.innerHTML = `
      <h2>⚠ Os dados não estão sendo salvos</h2>
      <p class="nota">Este navegador (ou visualizador de arquivo) bloqueou o armazenamento local.
      Tudo que você cadastrar some ao fechar a tela. Abra o arquivo pelo Chrome — pelos Downloads
      do próprio Chrome — para o app voltar a salvar.</p>`;
    return;
  }
  const ativos = avisosAtivos(estado.compromissos);
  if (!ativos.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const semNotificacao = notificacoes.permissao() !== "granted";
  el.hidden = false;
  el.innerHTML = `
    <h2>🔔 ${ativos.length} lembrete(s) ativo(s)</h2>
    ${ativos
      .map(
        (a) => `<div class="linha" data-id="${a.compromisso.id}">
          <span>${esc(a.compromisso.titulo)}${a.compromisso.valor != null ? " · " + formatarMoeda(a.compromisso.valor) : ""}</span>
          <span class="quando">${esc(consultas.rotuloRelativo(a.compromisso.data))}</span>
        </div>`
      )
      .join("")}
    ${semNotificacao ? `<p class="nota">As notificações do sistema estão desativadas neste modo — os avisos aparecem aqui ao abrir o app.</p>` : ""}`;
}

function renderPainel() {
  renderAvisos();
  const r = consultas.resumo(estado.compromissos);
  $("#resumo-cards").innerHTML = `
    <div class="card ${r.vencidos.length ? "perigo" : "ok"}">
      <div class="rotulo">Vencidos</div>
      <div class="valor">${r.vencidos.length}</div>
      <div class="sub">${formatarMoeda(r.totalVencido)}</div>
    </div>
    <div class="card alerta">
      <div class="rotulo">Hoje</div>
      <div class="valor">${r.hoje.length}</div>
      <div class="sub">${formatarData(hojeISO())}</div>
    </div>
    <div class="card">
      <div class="rotulo">Previsto no mês</div>
      <div class="valor">${formatarMoeda(r.totalPrevistoMes)}</div>
      <div class="sub">${r.quantidadeMes} compromisso(s)</div>
    </div>
    <div class="card ok">
      <div class="rotulo">Já pago no mês</div>
      <div class="valor">${formatarMoeda(r.totalPagoMes)}</div>
      <div class="sub">Pendente: ${formatarMoeda(r.totalPendenteMes)}</div>
    </div>`;

  $("#cont-vencidos").textContent = r.vencidos.length;
  $("#cont-hoje").textContent = r.hoje.length;
  $("#cont-proximos").textContent = r.proximos.length;

  pintarLista("#lista-vencidos", r.vencidos, "Nenhum compromisso vencido. 👍");
  pintarLista("#lista-hoje", r.hoje, "Nada para hoje.");
  pintarLista("#lista-proximos", r.proximos, "Nada nos próximos 7 dias.");

  const cats = consultas.porCategoria(consultas.doMes(estado.compromissos));
  $("#painel-categorias").innerHTML = cats.length
    ? cats
        .map(
          (c) => `<article class="item" style="cursor:default;border-left-color:var(--borda)">
            <div class="item-topo">
              <span class="item-titulo">${esc(c.categoria)}</span>
              <span class="item-valor">${formatarMoeda(c.total)}</span>
            </div>
            <div class="item-meta"><span>${c.quantidade} compromisso(s) no mês</span></div>
          </article>`
        )
        .join("")
    : `<p class="vazio">Sem compromissos neste mês.</p>`;
}

function lerFiltros() {
  return {
    texto: $("#f-texto").value,
    categoria: $("#f-categoria").value,
    status: $("#f-status").value,
    prioridade: $("#f-prioridade").value,
    recorrencia: $("#f-recorrencia").value,
    de: $("#f-de").value,
    ate: $("#f-ate").value,
    valorMin: $("#f-valor-min").value,
    valorMax: $("#f-valor-max").value,
    ordem: $("#f-ordem").value,
  };
}

function renderLista() {
  const f = estado.filtros.ordem ? estado.filtros : lerFiltros();
  estado.filtros = f;
  let itens = consultas.filtrar(estado.compromissos, f);

  const ordens = {
    data: (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0),
    valor: (a, b) => Number(b.valor || 0) - Number(a.valor || 0),
    titulo: (a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"),
    prioridade: (a, b) => {
      const ordem = PRIORIDADES.map((p) => p.id).reverse();
      return ordem.indexOf(b.prioridade) - ordem.indexOf(a.prioridade);
    },
  };
  itens = itens.sort(ordens[f.ordem] || ordens.data);

  const total = itens.reduce((s, c) => s + Number(c.valor || 0), 0);
  const emAberto = itens.filter(estaAberto).reduce((s, c) => s + Number(c.valor || 0), 0);
  $("#contador-lista").textContent = `${itens.length} compromisso(s) · total ${formatarMoeda(total)} · em aberto ${formatarMoeda(emAberto)}`;
  pintarLista("#lista-compromissos", itens, "Nenhum compromisso encontrado com esses filtros.");
}

function opcoes(lista, selecionado = "") {
  return lista.map((o) => `<option value="${esc(o.id ?? o)}" ${(o.id ?? o) === selecionado ? "selected" : ""}>${esc(o.label ?? o)}</option>`).join("");
}

function renderSelects() {
  const cats = estado.categorias;
  const manter = (sel, primeiro, itens) => {
    const el = $(sel);
    const atual = el.value;
    el.innerHTML = `<option value="">${primeiro}</option>` + opcoes(itens);
    el.value = atual;
  };
  manter("#f-categoria", "Categoria: todas", cats);
  manter("#f-status", "Situação: todas", STATUS);
  manter("#f-prioridade", "Prioridade: todas", PRIORIDADES);
  manter("#f-recorrencia", "Recorrência: todas", RECORRENCIAS);

  const cSel = $("#c-categoria");
  const catAtual = cSel.value;
  cSel.innerHTML = opcoes(cats.length ? cats : ["Pessoal"]);
  if (catAtual) cSel.value = catAtual;
  $("#c-prioridade").innerHTML = opcoes(PRIORIDADES);
  $("#c-recorrencia").innerHTML = opcoes(RECORRENCIAS);
  $("#c-status").innerHTML = opcoes(STATUS.filter((s) => !s.derivado));
}

function renderCategoriasAjustes() {
  $("#lista-categorias").innerHTML = estado.categorias
    .map((c) => `<span class="chip acao remover" data-categoria="${esc(c)}">${esc(c)}</span>`)
    .join("");
}

function renderChips() {
  // a versão vem primeiro: sem ela não dá para saber se um problema é bug ou cópia velha
  const chips = [`<span class="chip versao">v${VERSAO}</span>`];
  if (MODO_ARQUIVO) chips.push(`<span class="chip alerta">📄 arquivo local</span>`);
  chips.push(
    navigator.onLine
      ? `<span class="chip ok">● online</span>`
      : `<span class="chip alerta">● offline — tudo continua funcionando</span>`
  );
  // no modo arquivo o chip acima já explica; não faz sentido oferecer algo que o navegador nega
  if (!MODO_ARQUIVO) {
    const perm = notificacoes.permissao();
    const mapa = {
      granted: `<span class="chip ok">🔔 notificações ativas</span>`,
      denied: `<span class="chip erro">🔕 notificações bloqueadas</span>`,
      default: `<span class="chip alerta acao" data-acao="pedir-notificacao">🔔 ativar notificações</span>`,
      unsupported: `<span class="chip">🔕 sem suporte a notificações</span>`,
    };
    chips.push(mapa[perm] || mapa.default);
  }
  const modo = db.modoArmazenamento();
  if (modo === "memoria")
    chips.push(`<span class="chip erro">⚠ dados não estão sendo salvos</span>`);
  else if (modo === "local") chips.push(`<span class="chip alerta">💾 armazenamento simples</span>`);
  else if (estado.persistencia?.persistente) chips.push(`<span class="chip ok">💾 armazenamento persistente</span>`);
  $("#chips-status").innerHTML = chips.join("");
}

/* ---------- Formulário ---------- */

function renderChipsLembrete() {
  const sel = estado.lembretesSelecionados;
  const extras = [...sel].filter((d) => !LEMBRETES_PRESET.includes(d));
  const todos = [...LEMBRETES_PRESET, ...extras].sort((a, b) => b - a);
  $("#c-lembretes").innerHTML = todos
    .map(
      (d) =>
        `<span class="chip-lembrete ${sel.has(d) ? "ativo" : ""}" data-dias="${d}">${esc(labelLembrete(d))}</span>`
    )
    .join("");
}

export function abrirForm(id = null) {
  const c = id ? estado.compromissos.find((x) => x.id === id) : null;
  $("#titulo-modal-form").textContent = c ? "Editar compromisso" : "Novo compromisso";
  $("#c-id").value = c?.id || "";
  $("#c-titulo").value = c?.titulo || "";
  $("#c-categoria").value =
    c?.categoria || (estado.categorias.includes("Pessoal") ? "Pessoal" : estado.categorias[0] || "Pessoal");
  $("#c-data").value = c?.data || hojeISO();
  $("#c-hora").value = c?.hora || "";
  $("#c-valor").value = c?.valor ?? "";
  $("#c-prioridade").value = c?.prioridade || "media";
  $("#c-recorrencia").value = c?.recorrencia || "unico";
  $("#c-descricao").value = c?.descricao || "";
  $("#c-observacoes").value = c?.observacoes || "";
  $("#c-status").value = c?.status || "pendente";
  $("#linha-status").hidden = !c;
  estado.lembretesSelecionados = new Set(c ? c.lembretes : [1]);
  renderChipsLembrete();
  abrirModal("modal-form");
  setTimeout(() => $("#c-titulo").focus(), 120);
}

async function submeterForm(ev) {
  ev.preventDefault();
  const id = $("#c-id").value;
  const dados = {
    titulo: $("#c-titulo").value.trim(),
    categoria: $("#c-categoria").value,
    data: $("#c-data").value,
    hora: $("#c-hora").value,
    valor: $("#c-valor").value === "" ? null : Number($("#c-valor").value),
    prioridade: $("#c-prioridade").value,
    recorrencia: $("#c-recorrencia").value,
    descricao: $("#c-descricao").value.trim(),
    observacoes: $("#c-observacoes").value.trim(),
    lembretes: [...estado.lembretesSelecionados],
  };
  if (!dados.titulo) return toast("Informe o título.", true);
  if (!dados.data) return toast("Informe a data.", true);

  try {
    if (id) {
      dados.status = $("#c-status").value;
      await servico.atualizar(id, dados);
      toast("Compromisso atualizado.");
    } else {
      await servico.criar(dados);
      toast("Compromisso salvo.");
    }
    fecharModal("modal-form");
  } catch (e) {
    console.error(e);
    toast("Erro ao salvar: " + e.message, true);
  }
}

/* ---------- Detalhe ---------- */

async function abrirDetalhe(id) {
  const c = estado.compromissos.find((x) => x.id === id);
  if (!c) return;
  const st = statusEfetivo(c);
  const historico = await db.historicoDe(id);
  const lembrete = proximoLembrete(c);

  $("#titulo-modal-detalhe").textContent = c.titulo;
  $("#detalhe-conteudo").innerHTML = `
    <div class="detalhe-grid">
      ${campo("Vencimento", `${formatarData(c.data)}${c.hora ? " às " + esc(c.hora) : ""}`)}
      ${campo("Situação", `<span style="color:${corStatus(st)}">${labelStatus(st)}</span>`)}
      ${campo("Valor", c.valor != null ? formatarMoeda(c.valor) : "—")}
      ${campo("Categoria", esc(c.categoria))}
      ${campo("Prioridade", `<span style="color:${corPrioridade(c.prioridade)}">${labelPrioridade(c.prioridade)}</span>`)}
      ${campo("Recorrência", labelRecorrencia(c.recorrencia))}
      ${campo("Lembretes", (c.lembretes || []).length ? c.lembretes.map(labelLembrete).join(", ") : "—")}
      ${campo("Próximo aviso", lembrete ? `${esc(lembrete.label)} (${formatarData(lembrete.alvo)})` : "—")}
      ${c.pagamento ? campo("Pago em", `${formatarData(c.pagamento.data)} — ${formatarMoeda(c.pagamento.valor)}`) : ""}
      ${c.descricao ? campo("Descrição", esc(c.descricao)) : ""}
      ${c.observacoes ? campo("Observações", esc(c.observacoes)) : ""}
      ${campo("Criado em", formatarDataHora(c.criadoEm))}
    </div>
    <div class="acoes-detalhe">
      ${estaAberto(c) ? `<button class="btn-primario" data-acao="pagar" data-id="${c.id}">✓ Pagar / Concluir</button>` : ""}
      ${estaAberto(c) ? `<button class="btn-secundario" data-acao="adiar" data-id="${c.id}">📅 Adiar</button>` : ""}
      ${c.status === "pago" || c.status === "cancelado" ? `<button class="btn-secundario" data-acao="reabrir" data-id="${c.id}">↺ Reabrir</button>` : ""}
      <button class="btn-secundario" data-acao="editar" data-id="${c.id}">✎ Editar</button>
      ${estaAberto(c) ? `<button class="btn-secundario" data-acao="cancelar" data-id="${c.id}">🚫 Cancelar</button>` : ""}
      <button class="btn-perigo" data-acao="excluir" data-id="${c.id}">🗑 Excluir</button>
    </div>
    <div class="historico">
      <h3>Histórico (${historico.length})</h3>
      ${
        historico.length
          ? historico
              .map(
                (h) => `<div class="hist-item">
                  <div class="quando">${formatarDataHora(h.em)} · ${esc(TIPOS_HISTORICO[h.tipo] || h.tipo)}</div>
                  <div>${esc(h.descricao)}</div>
                </div>`
              )
              .join("")
          : `<p class="vazio">Sem registros.</p>`
      }
    </div>`;
  abrirModal("modal-detalhe");
}

function campo(rotulo, conteudo) {
  return `<div class="detalhe-item"><div class="rotulo">${esc(rotulo)}</div><div class="conteudo">${conteudo}</div></div>`;
}

/* ---------- Ações ---------- */

async function executarAcao(acao, id) {
  const c = estado.compromissos.find((x) => x.id === id);
  if (!c) return;
  switch (acao) {
    case "pagar":
      $("#p-id").value = id;
      $("#p-resumo").textContent = `${c.titulo} — vencimento ${formatarData(c.data)}`;
      $("#p-data").value = hojeISO();
      $("#p-valor").value = c.valor ?? "";
      $("#p-obs").value = "";
      fecharModal("modal-detalhe");
      abrirModal("modal-pagamento");
      break;
    case "adiar":
      $("#a-id").value = id;
      $("#a-data").value = c.data;
      $("#a-motivo").value = "";
      fecharModal("modal-detalhe");
      abrirModal("modal-adiar");
      break;
    case "editar":
      fecharModal("modal-detalhe");
      abrirForm(id);
      break;
    case "cancelar":
      if (!confirm(`Cancelar "${c.titulo}"?`)) return;
      await servico.mudarStatus(id, "cancelado");
      fecharModal("modal-detalhe");
      toast("Compromisso cancelado.");
      break;
    case "reabrir":
      await servico.reabrir(id);
      fecharModal("modal-detalhe");
      toast("Compromisso reaberto.");
      break;
    case "excluir":
      if (!confirm(`Excluir "${c.titulo}" definitivamente? O histórico será mantido, mas o compromisso não pode ser recuperado.`)) return;
      await servico.excluir(id);
      fecharModal("modal-detalhe");
      toast("Compromisso excluído.");
      break;
    default:
      break;
  }
}

async function confirmarPagamento(ev) {
  ev.preventDefault();
  const id = $("#p-id").value;
  try {
    const { proximo } = await servico.marcarPago(id, {
      data: $("#p-data").value,
      valor: $("#p-valor").value === "" ? null : Number($("#p-valor").value),
      observacao: $("#p-obs").value.trim(),
    });
    fecharModal("modal-pagamento");
    toast(proximo ? `Pago. Próximo vencimento gerado para ${formatarData(proximo.data)}.` : "Pagamento registrado.");
  } catch (e) {
    toast("Erro ao registrar: " + e.message, true);
  }
}

async function confirmarAdiar(ev) {
  ev.preventDefault();
  try {
    await servico.adiar($("#a-id").value, $("#a-data").value, $("#a-motivo").value.trim());
    fecharModal("modal-adiar");
    toast("Compromisso adiado.");
  } catch (e) {
    toast("Erro ao adiar: " + e.message, true);
  }
}

/* ---------- Modais e abas ---------- */

export function abrirModal(id) {
  $("#" + id).hidden = false;
  document.body.style.overflow = "hidden";
}

export function fecharModal(id) {
  $("#" + id).hidden = true;
  document.body.style.overflow = "";
}

export function abrirAba(aba) {
  estado.aba = aba;
  $$(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  $$(".view").forEach((v) => v.classList.toggle("ativa", v.id === "view-" + aba));
  // o botão flutuante fica sobre o "Enviar" do assistente
  $("#btn-novo").classList.toggle("oculto", aba === "assistente");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Tela cheia: é o mais perto de "cara de app" quando o arquivo é aberto no
 * navegador — a barra de endereço só some de verdade com o app instalado,
 * e instalar exige origem https.
 */
async function alternarTelaCheia() {
  const raiz = document.documentElement;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (raiz.requestFullscreen) await raiz.requestFullscreen({ navigationUI: "hide" });
    else if (raiz.webkitRequestFullscreen) raiz.webkitRequestFullscreen();
    else toast("Este navegador não permite tela cheia aqui.", true);
  } catch (e) {
    toast("Não foi possível entrar em tela cheia: " + e.message, true);
  }
}

/* ---------- Assistente ---------- */

function balao(msg) {
  const div = document.createElement("div");
  div.className = "balao " + (msg.de === "usuario" ? "usuario" : "assistente");
  div.textContent = msg.texto;
  if (msg.itens?.length) {
    const lista = document.createElement("div");
    lista.className = "itens";
    msg.itens.slice(0, 8).forEach((c) => {
      const linha = document.createElement("div");
      linha.textContent = `• ${c.titulo} — ${formatarData(c.data)}${c.valor ? " — " + formatarMoeda(c.valor) : ""}`;
      lista.appendChild(linha);
    });
    div.appendChild(lista);
  }
  const chat = $("#chat");
  const parcial = chat.querySelector(".balao.parcial");
  if (parcial) parcial.remove();
  // não repetir a mesma mensagem em sequência (tocar duas vezes no microfone, por exemplo)
  const ultimo = chat.lastElementChild;
  if (ultimo && ultimo.className === div.className && ultimo.textContent === div.textContent) return;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function mostrarParcial(texto) {
  const chat = $("#chat");
  let el = chat.querySelector(".balao.parcial");
  if (!el) {
    el = document.createElement("div");
    el.className = "balao usuario parcial";
    chat.appendChild(el);
  }
  el.textContent = texto;
  chat.scrollTop = chat.scrollHeight;
}

/** Mostra o que o assistente está esperando — sem isso o usuário fica sem saber o que responder. */
function renderEstadoAssistente(ultimaPergunta = "") {
  const el = $("#estado-assistente");
  const entrada = $("#entrada-assistente");
  if (!estado.assistente?.emCadastro) {
    el.hidden = true;
    el.innerHTML = "";
    entrada.placeholder = "Fale, digite ou use o microfone do teclado...";
    return;
  }
  const pergunta = ultimaPergunta || estado.ultimaPergunta || "Responda para continuar";
  estado.ultimaPergunta = pergunta;
  el.hidden = false;
  el.innerHTML = `<span>Cadastrando — <span class="pergunta">${esc(pergunta)}</span></span>
    <button type="button" id="btn-cancelar-cadastro">Cancelar</button>`;
  entrada.placeholder = "Responda aqui: " + pergunta;
}

async function enviarAoAssistente(texto) {
  if (!texto.trim()) return;
  $("#entrada-assistente").value = "";
  const resposta = await estado.assistente.processar(texto);
  renderEstadoAssistente(estado.assistente.emCadastro ? resposta : "");
  if ($("#chk-falar").checked) falar(resposta);
}

function alternarMicrofone() {
  const btn = $("#btn-microfone");
  if (estado.escuta?.ativa) {
    estado.escuta.parar();
    btn.classList.remove("ouvindo");
    return;
  }
  // Modo arquivo: o Android nunca libera o microfone da página, e o botão já virou ⌨.
  // Então ele só leva ao campo — a explicação aparece uma única vez, para quem tocou
  // esperando gravar. Repetir a cada toque era só ruído.
  if (MODO_ARQUIVO || !reconhecimentoDisponivel()) {
    $("#entrada-assistente").focus();
    if (!estado.dicaTecladoVista) {
      estado.dicaTecladoVista = true;
      db.setConfig("dicaTecladoVista", true).catch(() => {});
      toast("Use o 🎤 do seu teclado — eu entendo igual.", false, false);
    }
    return;
  }
  calarBoca();
  estado.escuta = new Escuta({
    onParcial: mostrarParcial,
    onFinal: (texto) => {
      btn.classList.remove("ouvindo");
      enviarAoAssistente(texto);
    },
    onFim: () => btn.classList.remove("ouvindo"),
    onErro: (e) => {
      btn.classList.remove("ouvindo");
      $("#chat").querySelector(".balao.parcial")?.remove();
      // no chat a instrução fica disponível enquanto o usuário executa os passos
      balao({ de: "assistente", texto: e.message });
      if (/microfone|reconhecimento de voz/i.test(e.message)) $("#entrada-assistente").focus();
    },
  });
  if (estado.escuta.iniciar()) btn.classList.add("ouvindo");
}

/* ---------- Preferências ---------- */

const AJUDA_MODO = {
  guiado: "Pergunta uma coisa de cada vez, mesmo que você já tenha dito tudo. Melhor para quem não lembra o que precisa informar.",
  automatico: "Aproveita o que veio na frase e pergunta só o que faltou. Você pode dizer tudo de uma vez ou aos poucos.",
  rapido: "Só pergunta título e data. O que não for dito vira padrão: sem valor, único, aviso 1 dia antes.",
};

export async function carregarPreferencias() {
  estado.modoAssistente = await db.config("modoAssistente", "automatico");
  estado.abaInicial = await db.config("abaInicial", "painel");
  estado.telaCheiaAuto = await db.config("telaCheiaAuto", false);
  estado.dicaTecladoVista = await db.config("dicaTecladoVista", false);
  $("#cfg-tela-cheia").checked = !!estado.telaCheiaAuto;
  if (estado.telaCheiaAuto) armarTelaCheiaNoPrimeiroToque();
  const sel = $("#cfg-modo-assistente");
  sel.innerHTML = opcoes(MODOS_ASSISTENTE);
  sel.value = estado.modoAssistente;
  const aba = $("#cfg-aba-inicial");
  aba.innerHTML = opcoes(ABAS_INICIAIS);
  aba.value = estado.abaInicial;
  $("#ajuda-modo").textContent = AJUDA_MODO[estado.modoAssistente] || "";
  return { abaInicial: estado.abaInicial };
}

/**
 * Tela cheia exige gesto do usuário: não dá para entrar sozinho ao carregar.
 * Então fica armado para o primeiro toque em qualquer lugar da tela.
 */
function armarTelaCheiaNoPrimeiroToque() {
  const entrar = () => {
    document.removeEventListener("pointerdown", entrar);
    if (document.fullscreenElement) return;
    const raiz = document.documentElement;
    Promise.resolve(raiz.requestFullscreen?.({ navigationUI: "hide" })).catch(() => {});
  };
  document.addEventListener("pointerdown", entrar, { once: false });
}

/** Abre o assistente já com o campo focado — um toque do 🎤 do teclado. */
export function focarAssistente() {
  abrirAba("assistente");
  const campo = $("#entrada-assistente");
  campo.focus({ preventScroll: false });
  campo.click();
}

/* ---------- Ajustes ---------- */

async function atualizarStatusNotificacoes() {
  const perm = notificacoes.permissao();
  if (MODO_ARQUIVO) {
    $("#status-notificacoes").textContent =
      "A agenda está aberta como arquivo, e nesse modo o navegador não permite notificação do " +
      "sistema. Os lembretes aparecem em destaque no painel sempre que você abrir o app. Para " +
      "receber aviso com o app fechado seria preciso abri-la por um endereço https.";
    // botão que não faz nada é pior que botão ausente: some no modo arquivo
    $("#btn-permitir-notificacoes").hidden = true;
    $("#btn-testar-notificacao").hidden = true;
    $("#btn-verificar-lembretes").textContent = "Ver lembretes ativos";
    renderChips();
    return;
  }
  $("#btn-permitir-notificacoes").hidden = false;
  $("#btn-testar-notificacao").hidden = false;
  const textos = {
    granted: "Notificações liberadas. Os lembretes configurados serão exibidos automaticamente.",
    denied: "Notificações bloqueadas pelo navegador. Libere nas configurações do site para receber lembretes.",
    default: "Ainda não autorizado. Toque em “Permitir notificações”.",
    unsupported: "Este navegador não suporta notificações. Os lembretes continuam visíveis no painel.",
  };
  $("#status-notificacoes").textContent = textos[perm] || textos.default;
  renderChips();
}

async function atualizarStatusArmazenamento() {
  const p = estado.persistencia || (await db.garantirPersistencia());
  estado.persistencia = p;
  const partes = [];
  const modo = db.modoArmazenamento();
  if (modo === "memoria")
    partes.push(
      "ATENÇÃO: este navegador bloqueou IndexedDB e localStorage, então nada está sendo salvo — " +
        "ao fechar a tela os dados somem. Isso costuma acontecer ao abrir o arquivo dentro de outro " +
        "aplicativo (visualizador de anexo). Baixe o arquivo e abra pelo Chrome."
    );
  else if (modo === "local")
    partes.push(
      "Usando armazenamento simples (localStorage) porque o IndexedDB não está disponível aqui. " +
        "Os dados ficam salvos no aparelho normalmente; só não há transação atômica."
    );
  else partes.push(p.persistente ? "Armazenamento persistente concedido — os dados não são apagados pelo navegador." : "Armazenamento padrão (o navegador pode limpar em situações extremas de falta de espaço). Instale o app na tela inicial para reforçar a persistência.");
  if (p.uso) {
    const mb = (n) => (n / 1024 / 1024).toFixed(1) + " MB";
    partes.push(`Uso: ${mb(p.uso.usado)} de ${mb(p.uso.cota)} disponíveis.`);
  }
  const ultimo = await db.config("ultimoBackup", null);
  partes.push(ultimo ? `Último backup exportado em ${formatarDataHora(ultimo)}.` : "Nenhum backup exportado ainda.");
  $("#status-armazenamento").textContent = partes.join(" ");
}

async function importarBackup(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  try {
    const dados = await backup.lerArquivo(file);
    const modo = $("#chk-substituir").checked ? "substituir" : "mesclar";
    const aviso =
      modo === "substituir"
        ? "Isso APAGA todos os dados atuais e coloca no lugar os do arquivo. Continuar?"
        : `Importar ${dados.compromissos?.length || 0} compromissos, mantendo os atuais?`;
    if (!confirm(aviso)) return;
    const r = await backup.restaurar(dados, modo);
    $("#status-backup").textContent = `Restaurado: ${r.compromissos} compromissos, ${r.historico} registros de histórico, ${r.categorias} categorias.`;
    toast("Backup restaurado.");
  } catch (e) {
    console.error(e);
    $("#status-backup").textContent = "Falha: " + e.message;
    toast(e.message, true);
  } finally {
    ev.target.value = "";
  }
}

/* ---------- Wiring ---------- */

export function iniciar({ persistencia } = {}) {
  estado.persistencia = persistencia;

  $$(".aba").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));
  $("#btn-novo").addEventListener("click", () => abrirForm());

  // fechar modais
  $$("[data-fechar]").forEach((b) => b.addEventListener("click", () => fecharModal(b.dataset.fechar)));
  $$(".modal").forEach((m) =>
    m.addEventListener("click", (ev) => {
      if (ev.target === m) fecharModal(m.id);
    })
  );
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") $$(".modal:not([hidden])").forEach((m) => fecharModal(m.id));
  });

  // formulário
  $("#form-compromisso").addEventListener("submit", submeterForm);
  $("#c-lembretes").addEventListener("click", (ev) => {
    const chip = ev.target.closest(".chip-lembrete");
    if (!chip) return;
    const dias = Number(chip.dataset.dias);
    if (estado.lembretesSelecionados.has(dias)) estado.lembretesSelecionados.delete(dias);
    else estado.lembretesSelecionados.add(dias);
    renderChipsLembrete();
  });
  $("#btn-add-lembrete").addEventListener("click", () => {
    const v = Number($("#c-lembrete-custom").value);
    if (!Number.isFinite(v) || v < 0) return toast("Informe um número de dias válido.", true);
    estado.lembretesSelecionados.add(v);
    $("#c-lembrete-custom").value = "";
    renderChipsLembrete();
  });

  $("#form-pagamento").addEventListener("submit", confirmarPagamento);
  $("#form-adiar").addEventListener("submit", confirmarAdiar);

  // listas: abrir detalhe
  ["#lista-vencidos", "#lista-hoje", "#lista-proximos", "#lista-compromissos"].forEach((sel) => {
    $(sel).addEventListener("click", (ev) => {
      const item = ev.target.closest(".item[data-id]");
      if (item) abrirDetalhe(item.dataset.id);
    });
  });
  $("#aviso-lembretes").addEventListener("click", (ev) => {
    const linha = ev.target.closest(".linha[data-id]");
    if (linha) abrirDetalhe(linha.dataset.id);
  });
  $("#detalhe-conteudo").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-acao]");
    if (btn) executarAcao(btn.dataset.acao, btn.dataset.id);
  });

  // filtros
  const aoFiltrar = () => {
    estado.filtros = lerFiltros();
    renderLista();
  };
  ["#f-texto", "#f-categoria", "#f-status", "#f-prioridade", "#f-recorrencia", "#f-de", "#f-ate", "#f-valor-min", "#f-valor-max", "#f-ordem"].forEach(
    (sel) => {
      $(sel).addEventListener("input", aoFiltrar);
      $(sel).addEventListener("change", aoFiltrar);
    }
  );
  $("#btn-limpar-filtros").addEventListener("click", (ev) => {
    ev.preventDefault();
    ["#f-texto", "#f-categoria", "#f-status", "#f-prioridade", "#f-recorrencia", "#f-de", "#f-ate", "#f-valor-min", "#f-valor-max"].forEach(
      (sel) => ($(sel).value = "")
    );
    aoFiltrar();
  });

  // assistente
  estado.assistente = new Assistente({
    getCompromissos: () => estado.compromissos,
    getCategorias: () => estado.categorias,
    onMensagem: balao,
    aoSalvar: () => toast("Compromisso criado pelo assistente."),
    getModo: () => estado.modoAssistente,
  });
  balao({
    de: "assistente",
    texto:
      'Oi! Posso cadastrar e consultar compromissos. Experimente: "cadastrar pagamento do condomínio" ou "quais contas vencem esta semana?".',
  });
  $("#btn-enviar").addEventListener("click", () => enviarAoAssistente($("#entrada-assistente").value));
  $("#entrada-assistente").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") enviarAoAssistente($("#entrada-assistente").value);
  });
  $("#btn-telacheia").addEventListener("click", alternarTelaCheia);
  document.addEventListener("fullscreenchange", () => {
    $("#btn-telacheia").textContent = document.fullscreenElement ? "⤢" : "⛶";
    $("#btn-telacheia").title = document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia";
  });
  // no modo arquivo o botão não grava áudio: leva ao teclado. O ícone tem que dizer isso,
  // e o microfone do topo saiu — dois ícones iguais na tela confundiam.
  if (MODO_ARQUIVO) {
    $("#btn-microfone").textContent = "⌨";
    $("#btn-microfone").title = "Usar o microfone do teclado";
  }
  $("#btn-microfone").addEventListener("click", alternarMicrofone);
  $("#estado-assistente").addEventListener("click", (ev) => {
    if (!ev.target.closest("#btn-cancelar-cadastro")) return;
    estado.assistente.cancelar();
    renderEstadoAssistente("");
    if ($("#chk-falar").checked) calarBoca();
  });
  $$(".dica").forEach((d) => d.addEventListener("click", () => enviarAoAssistente(d.dataset.frase)));

  // ajustes
  $("#btn-permitir-notificacoes").addEventListener("click", async () => {
    const r = await notificacoes.pedirPermissao();
    await atualizarStatusNotificacoes();
    if (r === "granted") {
      notificacoes.registrarVerificacaoEmSegundoPlano();
      toast("Notificações ativadas.");
      notificacoes.verificar(estado.compromissos);
    } else toast("Permissão não concedida.", true);
  });
  $("#btn-testar-notificacao").addEventListener("click", async () => {
    if (notificacoes.permissao() !== "granted") return toast("Permita as notificações primeiro.", true);
    await notificacoes.notificarAgora("Agenda Inteligente", "Notificação de teste — está funcionando. ✅");
  });
  $("#btn-verificar-lembretes").addEventListener("click", async () => {
    // No modo arquivo não existe permissão a liberar: mandar "libere as notificações"
    // seria mandar o usuário procurar um ajuste que o navegador não oferece.
    if (MODO_ARQUIVO) {
      const ativos = avisosAtivos(estado.compromissos).length;
      if (!ativos) return toast("Nenhum lembrete ativo agora.");
      abrirAba("painel");
      return toast(`${ativos} lembrete(s) ativo(s) — mostrando no topo do painel.`);
    }
    const r = await notificacoes.verificar(estado.compromissos);
    if (r.semPermissao) {
      toast(
        r.devidos
          ? `${r.devidos} lembrete(s) prontos, mas as notificações estão bloqueadas. Libere em "Permitir notificações" para recebê-los.`
          : "Nenhum lembrete pendente agora.",
        !!r.devidos
      );
    } else toast(r.disparados ? `${r.disparados} lembrete(s) enviado(s).` : "Nenhum lembrete pendente agora.");
  });

  $("#cfg-modo-assistente").addEventListener("change", async (ev) => {
    estado.modoAssistente = ev.target.value;
    $("#ajuda-modo").textContent = AJUDA_MODO[estado.modoAssistente] || "";
    await db.setConfig("modoAssistente", estado.modoAssistente);
    toast("Modo do assistente: " + (MODOS_ASSISTENTE.find((m) => m.id === estado.modoAssistente)?.label || ""));
  });
  $("#cfg-tela-cheia").addEventListener("change", async (ev) => {
    estado.telaCheiaAuto = ev.target.checked;
    await db.setConfig("telaCheiaAuto", estado.telaCheiaAuto);
    if (estado.telaCheiaAuto) {
      alternarTelaCheia();
      toast("A partir de agora o app entra em tela cheia no primeiro toque.");
    } else toast("Tela cheia automática desligada.");
  });
  $("#cfg-aba-inicial").addEventListener("change", async (ev) => {
    estado.abaInicial = ev.target.value;
    await db.setConfig("abaInicial", estado.abaInicial);
    toast("O app passará a abrir em: " + (ABAS_INICIAIS.find((a) => a.id === estado.abaInicial)?.label || ""));
  });
  $("#btn-add-categoria").addEventListener("click", async () => {
    const nome = $("#nova-categoria").value.trim();
    if (!nome) return toast("Informe o nome da categoria.", true);
    await db.adicionarCategoria(nome);
    $("#nova-categoria").value = "";
    toast("Categoria adicionada.");
  });
  $("#lista-categorias").addEventListener("click", async (ev) => {
    const chip = ev.target.closest("[data-categoria]");
    if (!chip) return;
    const nome = chip.dataset.categoria;
    const emUso = estado.compromissos.filter((c) => c.categoria === nome).length;
    if (emUso) return toast(`"${nome}" está em uso por ${emUso} compromisso(s).`, true);
    if (!confirm(`Remover a categoria "${nome}"?`)) return;
    await db.removerCategoria(nome);
    toast("Categoria removida.");
  });

  $("#btn-exportar-json").addEventListener("click", async () => {
    const t = await backup.exportarJSON();
    $("#status-backup").textContent = `Backup gerado: ${t.compromissos} compromissos e ${t.historico} registros de histórico.`;
    atualizarStatusArmazenamento();
  });
  $("#btn-exportar-csv").addEventListener("click", async () => {
    const n = await backup.exportarCSV(estado.compromissos);
    $("#status-backup").textContent = `CSV gerado com ${n} compromissos.`;
  });
  $("#arquivo-backup").addEventListener("change", importarBackup);

  $("#chips-status").addEventListener("click", (ev) => {
    if (ev.target.closest('[data-acao="pedir-notificacao"]')) $("#btn-permitir-notificacoes").click();
  });

  window.addEventListener("online", renderChips);
  window.addEventListener("offline", renderChips);

  // o banco é a fonte da verdade: qualquer escrita redesenha a tela
  db.onMudanca(() => carregar().catch((e) => console.error(e)));

  atualizarStatusNotificacoes();
  atualizarStatusArmazenamento();
}

export { estado };
