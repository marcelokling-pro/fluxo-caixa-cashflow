// db.js — camada de persistência (IndexedDB).
// Toda escrita passa por aqui; nada de dados fica só em memória.

import { CATEGORIAS_PADRAO, novoHistorico, agoraISO } from "./model.js";

export const DB_NOME = "agenda-inteligente";
export const DB_VERSAO = 1;

export const STORES = {
  compromissos: "compromissos",
  historico: "historico",
  categorias: "categorias",
  config: "config",
  lembretes: "lembretes_enviados",
};

let _db = null;
const ouvintes = new Set();

/** Assina mudanças no banco. Retorna a função de cancelamento. */
export function onMudanca(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function notificar(motivo) {
  ouvintes.forEach((fn) => {
    try {
      fn(motivo);
    } catch (e) {
      console.error("[db] ouvinte falhou", e);
    }
  });
}

export function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.compromissos)) {
        const s = db.createObjectStore(STORES.compromissos, { keyPath: "id" });
        s.createIndex("data", "data");
        s.createIndex("status", "status");
        s.createIndex("categoria", "categoria");
        s.createIndex("serieId", "serieId");
      }
      if (!db.objectStoreNames.contains(STORES.historico)) {
        const h = db.createObjectStore(STORES.historico, { keyPath: "id" });
        h.createIndex("compromissoId", "compromissoId");
        h.createIndex("em", "em");
      }
      if (!db.objectStoreNames.contains(STORES.categorias)) {
        db.createObjectStore(STORES.categorias, { keyPath: "nome" });
      }
      if (!db.objectStoreNames.contains(STORES.config)) {
        db.createObjectStore(STORES.config, { keyPath: "chave" });
      }
      if (!db.objectStoreNames.contains(STORES.lembretes)) {
        const l = db.createObjectStore(STORES.lembretes, { keyPath: "id" });
        l.createIndex("compromissoId", "compromissoId");
      }
      console.info("[db] schema criado/atualizado para v" + DB_VERSAO, ev.oldVersion);
    };
    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => {
        _db.close();
        _db = null;
      };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn("[db] abertura bloqueada por outra aba");
  });
}

function tx(stores, modo = "readonly") {
  return abrir().then((db) => db.transaction(stores, modo));
}

function pedido(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function concluir(transacao) {
  return new Promise((resolve, reject) => {
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
    transacao.onabort = () => reject(transacao.error || new Error("transação abortada"));
  });
}

export async function listar(store) {
  const t = await tx(store);
  return pedido(t.objectStore(store).getAll());
}

export async function obter(store, chave) {
  const t = await tx(store);
  return pedido(t.objectStore(store).get(chave));
}

export async function gravar(store, registro, motivo = store) {
  const t = await tx(store, "readwrite");
  t.objectStore(store).put(registro);
  await concluir(t);
  notificar(motivo);
  return registro;
}

export async function gravarVarios(store, registros, motivo = store) {
  if (!registros.length) return;
  const t = await tx(store, "readwrite");
  const s = t.objectStore(store);
  registros.forEach((r) => s.put(r));
  await concluir(t);
  notificar(motivo);
}

export async function remover(store, chave, motivo = store) {
  const t = await tx(store, "readwrite");
  t.objectStore(store).delete(chave);
  await concluir(t);
  notificar(motivo);
}

export async function limparStore(store) {
  const t = await tx(store, "readwrite");
  t.objectStore(store).clear();
  await concluir(t);
}

/* ---------- Compromissos ---------- */

export function listarCompromissos() {
  return listar(STORES.compromissos);
}

export function obterCompromisso(id) {
  return obter(STORES.compromissos, id);
}

/** Grava o compromisso e registra o histórico na MESMA transação (nunca um sem o outro). */
export async function salvarCompromisso(compromisso, historico = null) {
  const stores = historico ? [STORES.compromissos, STORES.historico] : [STORES.compromissos];
  const t = await tx(stores, "readwrite");
  t.objectStore(STORES.compromissos).put(compromisso);
  if (historico) t.objectStore(STORES.historico).put(historico);
  await concluir(t);
  notificar("compromissos");
  return compromisso;
}

/** Grava vários compromissos + históricos atomicamente (ex.: quitar recorrente gera o próximo). */
export async function salvarLote(compromissos = [], historicos = []) {
  const t = await tx([STORES.compromissos, STORES.historico], "readwrite");
  const sc = t.objectStore(STORES.compromissos);
  const sh = t.objectStore(STORES.historico);
  compromissos.forEach((c) => sc.put(c));
  historicos.forEach((h) => sh.put(h));
  await concluir(t);
  notificar("compromissos");
}

/**
 * Exclui o compromisso. O histórico é preservado por padrão
 * (requisito 9: nenhuma informação histórica deve ser perdida).
 */
export async function excluirCompromisso(id, titulo = "") {
  const t = await tx([STORES.compromissos, STORES.historico], "readwrite");
  t.objectStore(STORES.compromissos).delete(id);
  t.objectStore(STORES.historico).put(
    novoHistorico(id, "excluido", `Compromisso "${titulo}" excluído em ${agoraISO()}`)
  );
  await concluir(t);
  notificar("compromissos");
}

/* ---------- Histórico ---------- */

export async function historicoDe(compromissoId) {
  const t = await tx(STORES.historico);
  const idx = t.objectStore(STORES.historico).index("compromissoId");
  const itens = await pedido(idx.getAll(compromissoId));
  return itens.sort((a, b) => (a.em < b.em ? 1 : -1));
}

export function listarHistorico() {
  return listar(STORES.historico);
}

export function registrarHistorico(h) {
  return gravar(STORES.historico, h, "historico");
}

/* ---------- Categorias ---------- */

export async function listarCategorias() {
  const itens = await listar(STORES.categorias);
  return itens.map((c) => c.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function adicionarCategoria(nome) {
  const limpo = String(nome || "").trim();
  if (!limpo) return null;
  await gravar(STORES.categorias, { nome: limpo, criadaEm: agoraISO() }, "categorias");
  return limpo;
}

export function removerCategoria(nome) {
  return remover(STORES.categorias, nome, "categorias");
}

/* ---------- Config (key-value) ---------- */

export async function config(chave, padrao = null) {
  const r = await obter(STORES.config, chave);
  return r ? r.valor : padrao;
}

export function setConfig(chave, valor) {
  return gravar(STORES.config, { chave, valor }, "config");
}

/* ---------- Lembretes já disparados ---------- */

export function listarLembretesEnviados() {
  return listar(STORES.lembretes);
}

export function marcarLembreteEnviado(registro) {
  return gravar(STORES.lembretes, registro, "lembretes");
}

/* ---------- Inicialização ---------- */

/**
 * Pede armazenamento persistente ao navegador para que o IndexedDB não seja
 * descartado por pressão de espaço (requisito 7 — persistência crítica).
 */
export async function garantirPersistencia() {
  if (!navigator.storage?.persist) return { suportado: false, persistente: false };
  try {
    const jaPersistente = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const persistente = jaPersistente || (await navigator.storage.persist());
    let uso = null;
    if (navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      uso = { usado: e.usage || 0, cota: e.quota || 0 };
    }
    return { suportado: true, persistente, uso };
  } catch (e) {
    console.warn("[db] persistência não concedida", e);
    return { suportado: true, persistente: false };
  }
}

/** Cria as categorias padrão apenas na primeira abertura. */
export async function semear() {
  await abrir();
  const jaSemeado = await config("semeado", false);
  if (jaSemeado) return;
  const existentes = await listarCategorias();
  const faltando = CATEGORIAS_PADRAO.filter((c) => !existentes.includes(c));
  await gravarVarios(
    STORES.categorias,
    faltando.map((nome) => ({ nome, criadaEm: agoraISO(), padrao: true })),
    "categorias"
  );
  await setConfig("semeado", true);
}

export async function iniciar() {
  await abrir();
  await semear();
  return abrir();
}
