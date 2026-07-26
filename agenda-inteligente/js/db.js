// db.js — camada de persistência.
// Toda escrita passa por aqui; nada de dados fica só em memória por descuido.
//
// Três backends, escolhidos automaticamente na abertura:
//   1. IndexedDB    — o normal, com transações de verdade
//   2. localStorage — quando o navegador bloqueia IndexedDB (WebView de outro app,
//                     visualizador de arquivo, aba anônima). Mesma API, sem atomicidade
//   3. memória      — último recurso: o app abre e funciona, mas avisa que não salva
//
// Sem isso, um WebView que bloqueia IndexedDB deixava o app inteiro inutilizável.

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

/** Chave primária de cada store — usada pelos backends que não são o IndexedDB. */
const CHAVES = {
  compromissos: "id",
  historico: "id",
  categorias: "nome",
  config: "chave",
  lembretes_enviados: "id",
};

const TODAS = Object.values(STORES);

let backend = null;
let promessaInicio = null;
const ouvintes = new Set();

/** "indexeddb" | "local" | "memoria" | null (ainda não iniciado) */
export function modoArmazenamento() {
  return backend?.modo || null;
}

export function armazenamentoConfiavel() {
  return backend?.modo === "indexeddb" || backend?.modo === "local";
}

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

/* ---------- Backend 1: IndexedDB ---------- */

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

async function abrirIndexedDB() {
  if (typeof indexedDB === "undefined" || !indexedDB) throw new Error("IndexedDB indisponível");
  const db = await new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NOME, DB_VERSAO);
    } catch (e) {
      reject(e);
      return;
    }
    // alguns WebViews nunca respondem: sem timeout o app ficaria travado na abertura
    const limite = setTimeout(() => reject(new Error("IndexedDB não respondeu")), 4000);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORES.compromissos)) {
        const s = d.createObjectStore(STORES.compromissos, { keyPath: "id" });
        s.createIndex("data", "data");
        s.createIndex("status", "status");
        s.createIndex("categoria", "categoria");
        s.createIndex("serieId", "serieId");
      }
      if (!d.objectStoreNames.contains(STORES.historico)) {
        const h = d.createObjectStore(STORES.historico, { keyPath: "id" });
        h.createIndex("compromissoId", "compromissoId");
        h.createIndex("em", "em");
      }
      if (!d.objectStoreNames.contains(STORES.categorias)) d.createObjectStore(STORES.categorias, { keyPath: "nome" });
      if (!d.objectStoreNames.contains(STORES.config)) d.createObjectStore(STORES.config, { keyPath: "chave" });
      if (!d.objectStoreNames.contains(STORES.lembretes)) {
        const l = d.createObjectStore(STORES.lembretes, { keyPath: "id" });
        l.createIndex("compromissoId", "compromissoId");
      }
    };
    req.onsuccess = () => {
      clearTimeout(limite);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(limite);
      reject(req.error || new Error("falha ao abrir IndexedDB"));
    };
    req.onblocked = () => console.warn("[db] abertura bloqueada por outra aba");
  });

  // schema incompleto (banco criado pela metade) não serve
  for (const store of TODAS) {
    if (!db.objectStoreNames.contains(store)) throw new Error("schema incompleto: falta " + store);
  }
  db.onversionchange = () => db.close();

  return {
    modo: "indexeddb",
    listar: (store) => pedido(db.transaction(store, "readonly").objectStore(store).getAll()),
    obter: (store, chave) => pedido(db.transaction(store, "readonly").objectStore(store).get(chave)),
    /** entradas: [{ store, registro }] — uma transação só, tudo ou nada. */
    gravarMulti: async (entradas) => {
      if (!entradas.length) return;
      const stores = [...new Set(entradas.map((e) => e.store))];
      const t = db.transaction(stores, "readwrite");
      entradas.forEach((e) => t.objectStore(e.store).put(e.registro));
      await concluir(t);
    },
    remover: async (store, chave) => {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).delete(chave);
      await concluir(t);
    },
    /** Remoções e gravações juntas — usado ao excluir preservando o histórico. */
    misto: async ({ remocoes = [], gravacoes = [] }) => {
      const stores = [...new Set([...remocoes.map((r) => r.store), ...gravacoes.map((g) => g.store)])];
      const t = db.transaction(stores, "readwrite");
      remocoes.forEach((r) => t.objectStore(r.store).delete(r.chave));
      gravacoes.forEach((g) => t.objectStore(g.store).put(g.registro));
      await concluir(t);
    },
    limpar: async (store) => {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).clear();
      await concluir(t);
    },
  };
}

/* ---------- Backend 2: localStorage ---------- */

function backendLocal() {
  // valida de verdade: em alguns WebViews o objeto existe mas escrever lança
  const teste = `${DB_NOME}:teste`;
  localStorage.setItem(teste, "1");
  localStorage.removeItem(teste);

  const chaveStore = (store) => `${DB_NOME}:${store}`;
  const ler = (store) => {
    try {
      return JSON.parse(localStorage.getItem(chaveStore(store)) || "[]");
    } catch {
      return [];
    }
  };
  const escrever = (store, lista) => localStorage.setItem(chaveStore(store), JSON.stringify(lista));
  const gravarUm = (store, registro) => {
    const kp = CHAVES[store];
    const lista = ler(store);
    const i = lista.findIndex((r) => r[kp] === registro[kp]);
    if (i >= 0) lista[i] = registro;
    else lista.push(registro);
    escrever(store, lista);
  };

  return {
    modo: "local",
    listar: async (store) => ler(store),
    obter: async (store, chave) => ler(store).find((r) => r[CHAVES[store]] === chave),
    gravarMulti: async (entradas) => entradas.forEach((e) => gravarUm(e.store, e.registro)),
    remover: async (store, chave) => escrever(store, ler(store).filter((r) => r[CHAVES[store]] !== chave)),
    misto: async ({ remocoes = [], gravacoes = [] }) => {
      remocoes.forEach((r) => escrever(r.store, ler(r.store).filter((x) => x[CHAVES[r.store]] !== r.chave)));
      gravacoes.forEach((g) => gravarUm(g.store, g.registro));
    },
    limpar: async (store) => escrever(store, []),
  };
}

/* ---------- Backend 3: memória (não persiste) ---------- */

function backendMemoria() {
  const dados = new Map(TODAS.map((s) => [s, []]));
  const lista = (store) => dados.get(store) || [];
  const gravarUm = (store, registro) => {
    const kp = CHAVES[store];
    const atual = lista(store);
    const i = atual.findIndex((r) => r[kp] === registro[kp]);
    if (i >= 0) atual[i] = registro;
    else atual.push(registro);
    dados.set(store, atual);
  };
  return {
    modo: "memoria",
    listar: async (store) => [...lista(store)],
    obter: async (store, chave) => lista(store).find((r) => r[CHAVES[store]] === chave),
    gravarMulti: async (entradas) => entradas.forEach((e) => gravarUm(e.store, e.registro)),
    remover: async (store, chave) => dados.set(store, lista(store).filter((r) => r[CHAVES[store]] !== chave)),
    misto: async ({ remocoes = [], gravacoes = [] }) => {
      remocoes.forEach((r) => dados.set(r.store, lista(r.store).filter((x) => x[CHAVES[r.store]] !== r.chave)));
      gravacoes.forEach((g) => gravarUm(g.store, g.registro));
    },
    limpar: async (store) => dados.set(store, []),
  };
}

/* ---------- Escolha do backend ---------- */

export function abrir() {
  if (backend) return Promise.resolve(backend);
  if (promessaInicio) return promessaInicio;
  promessaInicio = (async () => {
    try {
      backend = await abrirIndexedDB();
      console.info("[db] usando IndexedDB");
    } catch (eIDB) {
      console.warn("[db] IndexedDB indisponível:", eIDB?.message || eIDB);
      try {
        backend = backendLocal();
        console.info("[db] usando localStorage");
      } catch (eLocal) {
        console.warn("[db] localStorage indisponível:", eLocal?.message || eLocal);
        backend = backendMemoria();
        console.warn("[db] usando memória — os dados NÃO serão salvos");
      }
    }
    return backend;
  })();
  return promessaInicio;
}

/* ---------- API genérica ---------- */

export async function listar(store) {
  const b = await abrir();
  return (await b.listar(store)) || [];
}

export async function obter(store, chave) {
  const b = await abrir();
  return b.obter(store, chave);
}

export async function gravar(store, registro, motivo = store) {
  const b = await abrir();
  await b.gravarMulti([{ store, registro }]);
  notificar(motivo);
  return registro;
}

export async function gravarVarios(store, registros, motivo = store) {
  if (!registros.length) return;
  const b = await abrir();
  await b.gravarMulti(registros.map((registro) => ({ store, registro })));
  notificar(motivo);
}

export async function remover(store, chave, motivo = store) {
  const b = await abrir();
  await b.remover(store, chave);
  notificar(motivo);
}

export async function limparStore(store) {
  const b = await abrir();
  await b.limpar(store);
}

/* ---------- Compromissos ---------- */

export function listarCompromissos() {
  return listar(STORES.compromissos);
}

export function obterCompromisso(id) {
  return obter(STORES.compromissos, id);
}

/** Grava o compromisso e o histórico juntos (uma transação, no IndexedDB). */
export async function salvarCompromisso(compromisso, historico = null) {
  const b = await abrir();
  const entradas = [{ store: STORES.compromissos, registro: compromisso }];
  if (historico) entradas.push({ store: STORES.historico, registro: historico });
  await b.gravarMulti(entradas);
  notificar("compromissos");
  return compromisso;
}

/** Vários compromissos + históricos de uma vez (ex.: quitar recorrente gera o próximo). */
export async function salvarLote(compromissos = [], historicos = []) {
  const b = await abrir();
  await b.gravarMulti([
    ...compromissos.map((registro) => ({ store: STORES.compromissos, registro })),
    ...historicos.map((registro) => ({ store: STORES.historico, registro })),
  ]);
  notificar("compromissos");
}

/**
 * Exclui o compromisso. O histórico é preservado
 * (requisito 9: nenhuma informação histórica deve ser perdida).
 */
export async function excluirCompromisso(id, titulo = "") {
  const b = await abrir();
  await b.misto({
    remocoes: [{ store: STORES.compromissos, chave: id }],
    gravacoes: [
      {
        store: STORES.historico,
        registro: novoHistorico(id, "excluido", `Compromisso "${titulo}" excluído em ${agoraISO()}`),
      },
    ],
  });
  notificar("compromissos");
}

/* ---------- Histórico ---------- */

export async function historicoDe(compromissoId) {
  const itens = await listar(STORES.historico);
  return itens.filter((h) => h.compromissoId === compromissoId).sort((a, b) => (a.em < b.em ? 1 : -1));
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
 * Pede armazenamento persistente ao navegador para que os dados não sejam
 * descartados por pressão de espaço (requisito 7 — persistência crítica).
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
  return backend;
}
