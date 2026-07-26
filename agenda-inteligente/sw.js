/* sw.js — cache offline + verificação de lembretes em segundo plano.
   Service worker clássico (sem import de módulos) para máxima compatibilidade:
   a lógica de lembretes é uma cópia mínima e autocontida de js/lembretes.js. */

const VERSAO = "v1.1.0";
const CACHE = "agenda-inteligente-" + VERSAO;

const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/ui.js",
  "./js/db.js",
  "./js/model.js",
  "./js/servico.js",
  "./js/consultas.js",
  "./js/recorrencia.js",
  "./js/lembretes.js",
  "./js/notificacoes.js",
  "./js/interpretador.js",
  "./js/voz.js",
  "./js/backup.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches
      .open(CACHE)
      // addAll falha inteiro se um arquivo faltar; individual mantém o app instalável
      .then((cache) => Promise.all(ARQUIVOS.map((url) => cache.add(url).catch((e) => console.warn("[sw] sem cache:", url, e)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first para o shell (offline garantido), com atualização em segundo plano. */
self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  ev.respondWith(
    caches.match(req).then((cacheada) => {
      const rede = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => cacheada || caches.match("./index.html"));
      return cacheada || rede;
    })
  );
});

/* ---------- Notificações ---------- */

self.addEventListener("notificationclick", (ev) => {
  ev.notification.close();
  const id = ev.notification.data?.compromissoId;
  ev.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      for (const c of clientes) {
        if (c.url.includes("/agenda-inteligente") || c.url.includes("index.html")) {
          c.postMessage({ tipo: "abrir-compromisso", compromissoId: id });
          return c.focus();
        }
      }
      return self.clients.openWindow("./index.html");
    })
  );
});

/* ---------- Verificação em segundo plano ---------- */

const DB_NOME = "agenda-inteligente";
const DB_VERSAO = 1;

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function lerTudo(db, store) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, "readonly");
    const r = t.objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

function gravar(db, store, registro) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(registro);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function somarDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const data = new Date(y, m - 1, d + n);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function formatarData(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function formatarMoeda(v) {
  if (v == null) return "";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function checarLembretes() {
  let db;
  try {
    db = await abrirDB();
  } catch (e) {
    console.warn("[sw] banco indisponível", e);
    return 0;
  }
  const [compromissos, enviados] = await Promise.all([
    lerTudo(db, "compromissos"),
    lerTudo(db, "lembretes_enviados"),
  ]);
  const jaEnviados = new Set(enviados.map((e) => e.id));
  const hoje = hojeISO();
  let disparados = 0;

  for (const c of compromissos) {
    if (c.status !== "pendente" && c.status !== "adiado") continue;
    if (c.data < hoje) continue;
    for (const dias of c.lembretes || []) {
      const alvo = somarDias(c.data, -Number(dias));
      if (alvo > hoje) continue;
      const chave = `${c.id}:${dias}:${c.data}`;
      if (jaEnviados.has(chave)) continue;

      const quando = dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`;
      const corpo = [formatarData(c.data), formatarMoeda(c.valor), c.categoria].filter(Boolean).join(" • ");
      await self.registration.showNotification(`⏰ ${c.titulo} ${quando}`, {
        body: corpo,
        tag: chave,
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png",
        data: { compromissoId: c.id },
        requireInteraction: Number(dias) === 0,
        vibrate: [120, 60, 120],
      });
      // só marca depois de exibir: sem permissão, o lembrete continua pendente
      await gravar(db, "lembretes_enviados", {
        id: chave,
        compromissoId: c.id,
        dias: Number(dias),
        dataCompromisso: c.data,
        em: new Date().toISOString(),
      });
      disparados++;
    }
  }
  return disparados;
}

self.addEventListener("periodicsync", (ev) => {
  if (ev.tag === "checar-lembretes") ev.waitUntil(checarLembretes());
});

self.addEventListener("sync", (ev) => {
  if (ev.tag === "checar-lembretes") ev.waitUntil(checarLembretes());
});

self.addEventListener("message", (ev) => {
  if (ev.data?.tipo === "checar-lembretes") ev.waitUntil?.(checarLembretes());
  if (ev.data?.tipo === "pular-espera") self.skipWaiting();
});
