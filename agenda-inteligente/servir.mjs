#!/usr/bin/env node
// servir.mjs — servidor local da Agenda Inteligente.
// Sem dependências: usa só o Node. Não precisa de Vite, npm install, build ou deploy.
//
//   node agenda-inteligente/servir.mjs            → http://localhost:4321
//   node agenda-inteligente/servir.mjs 8080       → outra porta
//   node agenda-inteligente/servir.mjs --rede     → também aceita conexões da rede local
//
// O app precisa ser servido por http (e não aberto como arquivo) porque o service
// worker, o modo offline e as notificações só funcionam em "origem segura" —
// localhost conta como segura; abrir o index.html direto do disco, não.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const RAIZ = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const PORTA = Number(args.find((a) => /^\d+$/.test(a))) || 4321;
const REDE = args.includes("--rede");
const HOST = REDE ? "0.0.0.0" : "127.0.0.1";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let caminho = decodeURIComponent(url.pathname);
    if (caminho === "/" || caminho.endsWith("/")) caminho += "index.html";

    // impede sair da pasta do app (../../etc/passwd)
    const alvo = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ""));
    if (!alvo.startsWith(RAIZ)) {
      res.writeHead(403).end("Acesso negado");
      return;
    }

    const info = await stat(alvo).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Não encontrado: " + caminho);
      return;
    }

    const conteudo = await readFile(alvo);
    res.writeHead(200, {
      "content-type": TIPOS[extname(alvo).toLowerCase()] || "application/octet-stream",
      // o app é servido do disco: nada de cache do navegador atrapalhando a edição
      "cache-control": "no-cache",
      "service-worker-allowed": "/",
    });
    res.end(conteudo);
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("Erro: " + e.message);
  }
});

servidor.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  A porta ${PORTA} já está em uso. Rode com outra porta:\n    node agenda-inteligente/servir.mjs ${PORTA + 1}\n`);
    process.exit(1);
  }
  throw e;
});

servidor.listen(PORTA, HOST, () => {
  console.log(`\n  Agenda Inteligente rodando local\n`);
  console.log(`    → http://localhost:${PORTA}`);
  if (REDE) {
    for (const [nome, lista] of Object.entries(networkInterfaces())) {
      for (const i of lista || []) {
        if (i.family === "IPv4" && !i.internal) console.log(`    → http://${i.address}:${PORTA}  (${nome} — rede local)`);
      }
    }
    console.log(`\n  Atenção: pela rede local o navegador trata o endereço como inseguro,`);
    console.log(`  então service worker, modo offline e notificações ficam desativados.`);
    console.log(`  Para o app completo, use o endereço localhost nesta máquina.`);
  }
  console.log(`\n  Ctrl+C para parar.\n`);
});
