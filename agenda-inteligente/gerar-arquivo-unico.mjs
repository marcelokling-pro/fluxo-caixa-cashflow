#!/usr/bin/env node
// gerar-arquivo-unico.mjs — empacota o app inteiro num único HTML para levar no celular.
//
//   node agenda-inteligente/gerar-arquivo-unico.mjs      (ou: npm run agenda:arquivo)
//
// Gera `AgendaInteligente.html`: CSS, JavaScript e ícone embutidos, sem nenhum arquivo
// externo. É esse arquivo que vai para o celular (Drive, WhatsApp, e-mail, cabo).
//
// O código-fonte continua modular em js/ — este script só monta o pacote. Rode de novo
// depois de qualquer alteração, senão o arquivo do celular fica desatualizado.

import { readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const RAIZ = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(RAIZ, "AgendaInteligente.html");

const ESBUILD = join(RAIZ, "..", "node_modules", ".bin", "esbuild");

async function empacotarJS() {
  await stat(ESBUILD).catch(() => {
    throw new Error(
      "esbuild não encontrado em node_modules. Rode `npm install` uma vez nesta máquina — " +
        "é só para gerar o arquivo; o HTML final não depende de nada."
    );
  });
  const { stdout } = await exec(ESBUILD, [
    join(RAIZ, "js", "app.js"),
    "--bundle",
    "--format=iife",
    "--target=es2020",
    "--charset=utf8",
    "--legal-comments=none",
  ], { maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

const [html, css, js, icone] = await Promise.all([
  readFile(join(RAIZ, "index.html"), "utf8"),
  readFile(join(RAIZ, "css", "style.css"), "utf8"),
  empacotarJS(),
  readFile(join(RAIZ, "icons", "icon-192.png")),
]);

const iconeDataURI = "data:image/png;base64," + icone.toString("base64");

// ATENÇÃO: sempre substituir com FUNÇÃO, nunca com string. Numa string de substituição
// o "$$" é escape de "$" — e o código tem `$$(seletor)` para querySelectorAll, que viraria
// `$(seletor)` e quebraria a tela inteira (bug real, pego no teste em file://).
const trocar = (texto, alvo, novo) => texto.replace(alvo, () => novo);

let montado = html;
// sem arquivos externos: nada de manifest, ícone por caminho ou script separado
montado = trocar(montado, /\s*<link rel="manifest"[^>]*>/g, "");
montado = trocar(montado, /\s*<link rel="icon"[^>]*>/g, `\n    <link rel="icon" href="${iconeDataURI}" />`);
montado = trocar(montado, /\s*<link rel="apple-touch-icon"[^>]*>/g, `\n    <link rel="apple-touch-icon" href="${iconeDataURI}" />`);
montado = trocar(montado, /\s*<link rel="stylesheet" href="\.\/css\/style\.css" \/>/, `\n    <style>\n${css}\n    </style>`);
montado = trocar(montado, /\s*<script type="module" src="\.\/js\/app\.js"><\/script>/, `\n    <script>\n${js}\n    </script>`);
montado = trocar(
  montado,
  "<title>Agenda Inteligente</title>",
  "<title>Agenda Inteligente</title>\n    <!-- Arquivo único gerado por gerar-arquivo-unico.mjs — não editar à mão. -->"
);

if (montado.includes("./js/app.js") || montado.includes("./css/style.css")) {
  throw new Error("Sobrou referência a arquivo externo no HTML gerado.");
}
// o bundle precisa manter o querySelectorAll intacto (ver comentário sobre "$$" acima)
if (!/\$\$\s*=/.test(montado) || !montado.includes("$$(")) {
  throw new Error('O helper "$$" sumiu do bundle — substituição comeu o cifrão duplo.');
}

await writeFile(SAIDA, montado, "utf8");
const tamanho = (Buffer.byteLength(montado) / 1024).toFixed(0);
console.log(`\n  AgendaInteligente.html gerado (${tamanho} KB, tudo embutido)`);
console.log(`  → ${SAIDA}\n`);
