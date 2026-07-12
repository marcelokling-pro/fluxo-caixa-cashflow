import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const GEMINI_KEY = "AIzaSyBA_x38gjMtrZTRjJFQrMEK6x7BHONvDic";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Classificações base (sem duplicatas, corrigidas) ─────────────────────────
// FIX #1: removidas duplicatas BOLETO PAGO, BUSINESS; corrigido PIX TRANSF
// FIX #10: PIX TRANSF → MOVIMENTAÇÃO (era RECEITA por erro)
const BASE_CLASSIFICATIONS = [
  {d:"99APP",             r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"ACABAMENTOS",       r:"DESPESAS VARIÁVEIS", c:"DESPESA COM PRODUTOS"},
  {d:"ADIANTAMENTO",      r:"DESPESAS VARIÁVEIS", c:"DESPESAS COM PESSOAL"},
  {d:"ADVOGADOS",         r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"AGÊNCIA NIMBUS",    r:"DESPESAS VARIÁVEIS", c:"MIDIAS E INTERNET"},
  {d:"ÁGUA",              r:"DESPESAS FIXAS",     c:"DESPESA OPERACIONAL LOJA"},
  {d:"AIR FRANCE",        r:"DESPESAS VARIÁVEIS", c:"VIAGENS"},
  {d:"ALUGUEL",           r:"DESPESAS FIXAS",     c:"DESPESA OPERACIONAL LOJA"},
  {d:"ALIMENTAÇÃO",       r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"APLICAÇÃO FINANC",  r:"INVESTIMENTOS",      c:"INVESTIMENTOS"},
  {d:"APLICATIVOS",       r:"DESPESAS VARIÁVEIS", c:"TECNOLOGIA E SISTEMAS"},
  {d:"BILHETE ÚNICO",     r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"BOLETO PAGO",       r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"BUSINESS",          r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"CAF",               r:"DESPESAS VARIÁVEIS", c:"IMPOSTOS"},
  {d:"CARTÃO BUSINESS",   r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"CARTÃO INTER",      r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"CARTSTACK",         r:"DESPESAS FIXAS",     c:"TECNOLOGIA E SISTEMAS"},
  {d:"CASH BACK",         r:"RECEITA",            c:"RECEITA FINANCEIRA"},
  {d:"CLARO",             r:"DESPESAS FIXAS",     c:"MIDIAS E INTERNET"},
  {d:"COMISSÃO DE VENDAS",r:"DESPESAS VARIÁVEIS", c:"DESPESA COM VENDAS"},
  {d:"CONSULTORIA",       r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"CONTA DE LUZ",      r:"DESPESAS FIXAS",     c:"DESPESA OPERACIONAL LOJA"},
  {d:"CONTADOR",          r:"DESPESAS FIXAS",     c:"DESPESAS ADMINISTRATIVAS"},
  {d:"CORREIOS",          r:"DESPESAS VARIÁVEIS", c:"DESPESA COM PRODUTOS"},
  {d:"DARF",              r:"DESPESAS VARIÁVEIS", c:"IMPOSTOS"},
  {d:"DÉCIMO TERCEIRO",   r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"DEP DIN",           r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"DEPÓSITO",          r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"DESPESAS COM FUNC", r:"DESPESAS VARIÁVEIS", c:"DESPESAS COM PESSOAL"},
  {d:"DEVOLUÇÃO",         r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"DIFAL",             r:"DESPESAS VARIÁVEIS", c:"IMPOSTOS"},
  {d:"DINHEIRO",          r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"DOOCA",             r:"DESPESAS FIXAS",     c:"TECNOLOGIA E SISTEMAS"},
  {d:"E2U",               r:"DESPESAS FIXAS",     c:"MIDIAS E INTERNET"},
  {d:"ELETROPAULO",       r:"DESPESAS FIXAS",     c:"DESPESA OPERACIONAL LOJA"},
  {d:"EMBALAGENS",        r:"DESPESAS VARIÁVEIS", c:"DESPESA COM PRODUTOS"},
  {d:"ESTACIONAMENTO",    r:"DESPESAS VARIÁVEIS", c:"DESPESA DE VIAGEM"},
  {d:"FACEBOOK",          r:"DESPESAS VARIÁVEIS", c:"MIDIAS E INTERNET"},
  {d:"FARMÁCIA",          r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"FGTS",              r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"FRETE",             r:"DESPESAS VARIÁVEIS", c:"DESPESA COM PRODUTOS"},
  {d:"GOOGLE ADS",        r:"DESPESAS VARIÁVEIS", c:"MIDIAS E INTERNET"},
  {d:"GOOGLE",            r:"DESPESAS FIXAS",     c:"TECNOLOGIA E SISTEMAS"},
  {d:"GPS",               r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"IMPOSTO SOBRE VENDA",r:"DESPESAS FIXAS",    c:"IMPOSTOS"},
  {d:"INSS",              r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"IOF",               r:"DESPESAS VARIÁVEIS", c:"IMPOSTOS"},
  {d:"IPTU",              r:"DESPESAS FIXAS",     c:"DESPESA OPERACIONAL LOJA"},
  {d:"IR ",               r:"DESPESAS FIXAS",     c:"IMPOSTOS"},
  {d:"IRRF",              r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"JUROS DE APLICAÇÃO",r:"RECEITA",            c:"RECEITA DE INVESTIMENTOS"},
  {d:"JUROS",             r:"DESPESAS VARIÁVEIS", c:"DESPESA BANCÁRIA"},
  {d:"LUZ",               r:"DESPESAS FIXAS",     c:"DESPESA OPERACIONAL LOJA"},
  {d:"MANUTENÇÃO",        r:"DESPESAS VARIÁVEIS", c:"DESPESA OPERACIONAL LOJA"},
  {d:"MATERIAL DE ESCRIT",r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"MATERIAL DE LIMPEZ",r:"DESPESAS VARIÁVEIS", c:"DESPESA OPERACIONAL LOJA"},
  {d:"MEI",               r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"MOTOBOY",           r:"DESPESAS VARIÁVEIS", c:"DESPESA COM PRODUTOS"},
  {d:"MULTAS E ENCARGOS", r:"DESPESAS VARIÁVEIS", c:"DESPESA FINANCEIRA"},
  {d:"OMIEXPERIENCE",     r:"DESPESAS FIXAS",     c:"TECNOLOGIA E SISTEMAS"},
  {d:"PAGSEGURO",         r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"PASSAGENS",         r:"DESPESAS VARIÁVEIS", c:"VIAGENS"},
  {d:"PDV",               r:"DESPESAS FIXAS",     c:"TECNOLOGIA E SISTEMAS"},
  {d:"PINTEREST",         r:"DESPESAS VARIÁVEIS", c:"MIDIAS E INTERNET"},
  {d:"PLANO DE SAÚDE",    r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"PRÓ LABORE",        r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"REDE",              r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"RECEBIMENTO",       r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"RENDIMENTO",        r:"RECEITA",            c:"RECEITA DE INVESTIMENTOS"},
  {d:"RESCISÃO",          r:"DESPESAS VARIÁVEIS", c:"DESPESAS COM PESSOAL"},
  {d:"RESGATE",           r:"INVESTIMENTOS",      c:"INVESTIMENTOS"},
  {d:"SACOLAS",           r:"DESPESAS VARIÁVEIS", c:"DESPESA COM PRODUTOS"},
  {d:"SALÁRIO",           r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"SALDO ANTERIOR",    r:"SALDO INICIAL",      c:"SALDO INICIAL"},
  {d:"SIMPLES NACIONAL",  r:"DESPESAS VARIÁVEIS", c:"IMPOSTOS"},
  {d:"SIMPLES",           r:"DESPESAS VARIÁVEIS", c:"IMPOSTOS"},
  {d:"SINDICATO",         r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"SISPAG SALARIOS",   r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"SISPAG",            r:"MOVIMENTAÇÃO",       c:"MOVIMENTAÇÃO"},
  {d:"TAG",               r:"DESPESAS VARIÁVEIS", c:"DESPESA COM PRODUTOS"},
  {d:"TAR PIXQR LIQ",     r:"DESPESAS VARIÁVEIS", c:"DESPESA BANCÁRIA"},
  {d:"TAR PIXQR",         r:"DESPESAS FIXAS",     c:"DESPESA BANCÁRIA"},
  {d:"TARIFA BANCÁRIA",   r:"DESPESAS FIXAS",     c:"DESPESA BANCÁRIA"},
  {d:"TARIFA DE VENDAS",  r:"DESPESA FINANCEIRA", c:"DESPESA COM VENDAS"},
  {d:"TARIFA MEIO",       r:"DESPESAS VARIÁVEIS", c:"DESPESA COM VENDAS"},
  {d:"TARIFA PIX",        r:"DESPESAS FIXAS",     c:"DESPESA BANCÁRIA"},
  {d:"TAXA DE ANTECIP",   r:"DESPESA FINANCEIRA", c:"DESPESA COM VENDAS"},
  {d:"TELEFONICA",        r:"DESPESAS FIXAS",     c:"MIDIAS E INTERNET"},
  {d:"TINY",              r:"DESPESAS FIXAS",     c:"TECNOLOGIA E SISTEMAS"},
  {d:"TRANSFERÊNCIA ENTRE CONTAS", r:"MOVIMENTAÇÃO", c:"MOVIMENTAÇÃO"},
  {d:"TRANSPORTE",        r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"TRAY",              r:"DESPESAS FIXAS",     c:"TECNOLOGIA E SISTEMAS"},
  {d:"UBER",              r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"VENDAS",            r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"VINDI",             r:"RECEITA",            c:"RECEITA DE VENDAS"},
  {d:"VIVO",              r:"DESPESAS FIXAS",     c:"MIDIAS E INTERNET"},
  {d:"VR ",               r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  {d:"VT ",               r:"DESPESAS FIXAS",     c:"DESPESAS COM PESSOAL"},
  // Itaú specific
  {d:"PIX QR CODE RECEBIDO", r:"RECEITA",         c:"RECEITA DE VENDAS"},
  {d:"PIX RECEBIDO",         r:"RECEITA",         c:"RECEITA DE VENDAS"},
  {d:"PIX QR CODE COBR",     r:"RECEITA",         c:"RECEITA DE VENDAS"},
  {d:"PAGAMENTOS PIX QR",    r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"PAGAMENTOS TRIB",      r:"DESPESAS VARIÁVEIS", c:"IMPOSTOS"},
  {d:"PAG BOLETO",           r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"TED RECEBIDA",         r:"RECEITA",         c:"RECEITA DE VENDAS"},
  {d:"TED ENVIADA",          r:"MOVIMENTAÇÃO",    c:"MOVIMENTAÇÃO"},
  {d:"PIX ENVIADO",          r:"MOVIMENTAÇÃO",    c:"MOVIMENTAÇÃO"},
  {d:"PIX TRANSF",           r:"MOVIMENTAÇÃO",    c:"MOVIMENTAÇÃO"},
  {d:"CH COMPENSADO",        r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS"},
  {d:"DA  ELETROPAULO",      r:"DESPESAS FIXAS",  c:"DESPESA OPERACIONAL LOJA"},
  {d:"DA  CLARO",            r:"DESPESAS FIXAS",  c:"MIDIAS E INTERNET"},
  {d:"DA  VIVO",             r:"DESPESAS FIXAS",  c:"MIDIAS E INTERNET"},
];

// Sorted by length descending so longest match wins
const SORTED_CLASSIFICATIONS = [...BASE_CLASSIFICATIONS].sort((a,b) => b.d.length - a.d.length);

const RD_TYPES = ["RECEITA","DESPESAS FIXAS","DESPESAS VARIÁVEIS","MOVIMENTAÇÃO","INVESTIMENTOS","DESPESA FINANCEIRA","SALDO INICIAL"];
const CLASSIFICACOES = [...new Set(BASE_CLASSIFICATIONS.map(c=>c.c))].sort();
const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v??0);

export const parseValue = (raw) => {
  if (raw === null || raw === undefined || raw === "") return NaN;
  const s = String(raw).trim().replace(/\s/g,"").replace(/[^\d,.\-]/g,"");
  if (!s) return NaN;
  // BR format 1.234,56
  if (s.includes(",") && s.includes(".")) return parseFloat(s.replace(/\./g,"").replace(",","."));
  // comma as decimal
  if (s.includes(",")) return parseFloat(s.replace(",","."));
  return parseFloat(s);
};

const parseDate = (raw) => {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y,m,d] = s.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
};

// Convert DD/MM/YYYY to YYYY-MM-DD for sorting
const dateToSortable = (d) => {
  if (!d) return "";
  const p = d.split("/");
  return p.length===3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
};

const generateHash = (date, desc, value) =>
  `${date}|${String(desc).trim().toUpperCase()}|${parseFloat(value).toFixed(2)}`;

const isCCTransaction = (t) => {
  if ((t.origin||"") === "fatura") return true;
  if ((t.conta||"").startsWith("CC/")) return true;
  if (/\d{3,}\/\d/.test(t.conta||"")) return true;
  return false;
};

// Strip common bank prefixes to isolate merchant name
export const merchantKey = (desc) => String(desc).toUpperCase().trim()
  .replace(/^(BOLETO\s+PAGO|COMPRA\s+\S+|PIX\s+ENVIADO|PIX\s+RECEBIDO|PIX\s+|PAGAMENTO\s+|TED\s+|DOC\s+|TRANSFERENCIA\s+|DEBITO\s+|CREDITO\s+)\s*/,'')
  .replace(/\s\d[\d\s.\/-]*$/,'')
  .replace(/\s+/g,' ').trim();

// Description-to-description similarity: no-space of the shorter must be substring of the longer (min 6 chars)
const descSimilar = (a, b) => {
  const da = String(a).replace(/\s+/g,'').toUpperCase();
  const db = String(b).replace(/\s+/g,'').toUpperCase();
  if (!da || !db) return false;
  const [shorter, longer] = da.length <= db.length ? [da, db] : [db, da];
  return shorter.length >= 6 && longer.includes(shorter);
};

// Flexible description match: handles spaces ("J B" vs "JB") and bank truncation ("SANTOS" vs "SANT")
export const flexMatch = (desc, kw) => {
  const d = String(desc).toUpperCase().trim();
  const k = String(kw).trim().toUpperCase();
  if (!k || !d) return false;
  // Keywords curtas (<=4 letras) só batem como palavra inteira, nunca como pedaço de outra palavra
  // (ex: "ISS" não pode bater dentro de "LARISSA")
  if (k.length <= 4 && !k.includes(" ")) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp(`(^|[^A-ZÀ-Ú0-9])${escaped}([^A-ZÀ-Ú0-9]|$)`).test(d);
  }
  if (d.includes(k)) return true;
  if (d.replace(/\s+/g,"").includes(k.replace(/\s+/g,""))) return true;
  return false;
};

// ── FIX #2: localClassify — longest match wins, custom cats checked first ────
export const localClassify = (desc, customCats = []) => {
  const d = String(desc).toUpperCase().trim();
  const sorted = [...customCats].sort((a,b) => b.name.length - a.name.length);
  // Pass 1: match by category name
  for (const cat of sorted) {
    if (cat.rd && cat.classificacao && d.includes(cat.name.toUpperCase()))
      return { r: cat.rd, c: cat.classificacao, sub: cat.subcategoria||null, catId: cat.id, matchedKw: cat.name };
  }
  // Pass 2: match by keywords[] — flexMatch protege keywords curtas (<=4) de bater dentro de outras palavras
  for (const cat of sorted) {
    if (!cat.rd || !cat.classificacao) continue;
    for (const kw of (cat.keywords||[])) {
      if (kw && flexMatch(d, kw))
        return { r: cat.rd, c: cat.classificacao, sub: cat.subcategoria||null, catId: cat.id, matchedKw: kw };
    }
  }
  // Pass 3: base classifications
  for (const cls of SORTED_CLASSIFICATIONS) {
    if (d.includes(cls.d.toUpperCase().trim())) return { r: cls.r, c: cls.c, sub: null, catId: null, matchedKw: cls.d };
  }
  return null;
};

// ── Gemini classification ─────────────────────────────────────────────────────
const classifyWithGemini = async (description) => {
  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ contents:[{ parts:[{ text:
`Você é um especialista em classificação de extratos bancários brasileiros.
Analise a transação e retorne SOMENTE JSON com "rd" e "classificacao".

Transação: "${description}"

R/D disponíveis: ${RD_TYPES.join(", ")}
Classificações disponíveis: ${CLASSIFICACOES.join(", ")}

Regras CRÍTICAS (siga rigorosamente):
- RECEBIMENTO, PIX RECEBIDO, PIX QR CODE RECEBIDO, REDE AMEX/VISA/MAST, PAGSEGURO, VINDI = RECEITA / RECEITA DE VENDAS
- RENDIMENTO, JUROS DE APLICAÇÃO, CDB, TESOURO = RECEITA / RECEITA DE INVESTIMENTOS
- PIX ENVIADO, TED ENVIADA, TRANSFERÊNCIA, SISPAG (sem SALARIO) = MOVIMENTAÇÃO / MOVIMENTAÇÃO
- APLICAÇÃO, RESGATE = INVESTIMENTOS / INVESTIMENTOS
- DARF, SIMPLES, ISS, ICMS, IOF, IRPF, IRPJ, TRIBUTO = DESPESAS VARIÁVEIS / IMPOSTOS
- SALÁRIO, INSS, FGTS, VR, VT, PRÓ LABORE, FÉRIAS, RESCISÃO = DESPESAS FIXAS / DESPESAS COM PESSOAL
- ALUGUEL, CONDOMÍNIO, IPTU = DESPESAS FIXAS / DESPESA OPERACIONAL LOJA
- TARIFA, TAR PIX, TAR TED, TAR DOC = DESPESAS FIXAS / DESPESA BANCÁRIA
- LUZ, ÁGUA, ENERGIA, ELETROPAULO, TELEFONE, CLARO, VIVO = DESPESAS FIXAS / DESPESA OPERACIONAL LOJA
- BOLETO PAGO, PAG BOLETO, PAGAMENTOS PIX QR-CODE = DESPESAS VARIÁVEIS / DESPESAS ADMINISTRATIVAS
- UBER, 99, TÁXI, IFOOD, RAPPI = DESPESAS VARIÁVEIS / DESPESAS ADMINISTRATIVAS
- GOOGLE ADS, FACEBOOK, INSTAGRAM, PINTEREST = DESPESAS VARIÁVEIS / MIDIAS E INTERNET

Responda SOMENTE JSON válido sem markdown:
{"rd":"...","classificacao":"..."}` }] }] })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||"{}";
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
    if (parsed.rd && parsed.classificacao) return parsed;
  } catch(e) { console.error("Gemini error:", e); }
  return null; // null = needs review
};

// ── CSV parser ────────────────────────────────────────────────────────────────
const detectSep = (line) => {
  const c = {";": (line.match(/;/g)||[]).length, ",": (line.match(/,/g)||[]).length, "\t": (line.match(/\t/g)||[]).length};
  return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0];
};

const normHeader = (h) => String(h).toLowerCase().trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g," ").trim();

const DATE_ALIASES = ["data","date","dt","data mov","data lancamento","data transacao","data operacao"];
const DESC_ALIASES = ["lancamento","descricao","description","historico","memo","detalhe","complemento","estabelecimento","nome"];
const VAL_ALIASES  = ["valor","value","amount","vlr","vl","valor r$","valor lancamento"];
const CONTA_ALIASES= ["conta","account","agencia","banco","origem","numero conta"];
const TYPE_ALIASES = ["tipo","type","natureza","cd","c d","cr db"];

const findCol = (headers, aliases) => {
  const norm = headers.map(normHeader);
  for (const a of aliases) {
    const i = norm.findIndex(n => n === a);
    if (i !== -1) return i;
  }
  for (const a of aliases) {
    const i = norm.findIndex(n => n.includes(a) || a.includes(n));
    if (i !== -1) return i;
  }
  return -1;
};

// FIX #9: refined debit keywords — more specific, avoids false positives
const DEBIT_DESC = ["PIX ENVIADO","TED ENVIADA","DOC ENVIADO","PAGAMENTOS PIX","PAG BOLETO","BOLETO PAGO",
  "DARF","SISPAG","CH COMPENSADO","TARIFA","IOF","DÉBITO EM CONTA","SAQUE","RESGAT",
  "PAGAMENTOS TRIB","IMPOSTO","TAXA DE ANTEC"];
const looksLikeDebit = (desc) => DEBIT_DESC.some(k => String(desc).toUpperCase().includes(k));

const SKIP_ROWS = ["SALDO TOTAL","SALDO DO DIA","TOTAL DO DIA","SALDO DISPONÍV","SALDO DISPONIVEL"];
const shouldSkip = (cols) => SKIP_ROWS.some(k => cols.some(c => String(c).toUpperCase().includes(k)));

const parseBankCSV = (text) => {
  const cleaned = text.replace(/^\uFEFF/, "");
  const rawLines = cleaned.split(/\r?\n/).filter(l => l.trim());
  if (!rawLines.length) return [];

  const sep = detectSep(rawLines[0]);

  // Find header line: must have date column AND (description OR value) column
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rawLines.length); i++) {
    const cols = rawLines[i].split(sep).map(c=>c.replace(/"/g,"").trim());
    const norm = cols.map(normHeader);
    const hasDate = DATE_ALIASES.some(a => norm.some(n => n===a));
    const hasDesc = DESC_ALIASES.some(a => norm.some(n => n===a || n.includes(a)));
    const hasVal  = VAL_ALIASES.some(a => norm.some(n => n===a || n.includes(a)));
    if (hasDate && (hasDesc || hasVal)) { headerIdx = i; break; }
  }

  let dataStart=0, getDate=0, getDesc=1, getVal=2, getConta=-1, getType=-1;

  if (headerIdx !== -1) {
    const h = rawLines[headerIdx].split(sep).map(c=>c.replace(/"/g,"").trim());
    dataStart = headerIdx + 1;
    const di = findCol(h, DATE_ALIASES);
    const dsi= findCol(h, DESC_ALIASES);
    const vi = findCol(h, VAL_ALIASES);
    const ci = findCol(h, CONTA_ALIASES);
    const ti = findCol(h, TYPE_ALIASES);
    getDate  = di  !== -1 ? di  : 0;
    getDesc  = dsi !== -1 ? dsi : 1;
    getVal   = vi  !== -1 ? vi  : 2;
    getConta = ci;
    getType  = ti;
  } else {
    // No header: find first line starting with date
    for (let i=0; i<rawLines.length; i++) {
      const c0 = rawLines[i].split(sep)[0]?.replace(/"/g,"").trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(c0)||/^\d{4}-\d{2}-\d{2}/.test(c0)) { dataStart=i; break; }
    }
    const sample = rawLines[dataStart].split(sep).map(c=>c.replace(/"/g,"").trim());
    // Find value column
    for (let i=1; i<sample.length; i++) {
      if (!isNaN(parseValue(sample[i]))) { getVal=i; break; }
    }
    // Description = longest remaining string column
    const used = new Set([getDate, getVal]);
    getDesc = sample.map((_,i)=>i).filter(i=>!used.has(i))
      .sort((a,b)=>sample[b].length-sample[a].length)[0] ?? 1;
  }

  const result = [];
  for (let i = dataStart; i < rawLines.length; i++) {
    const cols = rawLines[i].split(sep).map(c=>c.replace(/"/g,"").trim());
    if (cols.length < 2 || shouldSkip(cols)) continue;

    const date = parseDate(cols[getDate]||"");
    if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) continue;

    const desc = cols[getDesc]||"";
    let val = parseValue(cols[getVal]);
    if (isNaN(val) || val === 0) continue;

    // Handle C/D type column
    if (getType !== -1 && cols[getType]) {
      const t = cols[getType].toUpperCase().trim();
      if (["D","DB","DEB","DEBITO","DÉBITO"].includes(t) && val > 0) val = -val;
      if (["C","CR","CRE","CREDITO","CRÉDITO"].includes(t) && val < 0) val = Math.abs(val);
    } else if (val > 0 && looksLikeDebit(desc)) {
      val = -val;
    }

    const conta = getConta !== -1 ? (cols[getConta]||"") : "";
    result.push({ date, description: desc, value: val, conta });
  }
  return result;
};

// ── Excel Itaú parser (col0=data, col2=desc, col10=valor, header row 26, data from row 27) ──
const parseExcelItau = (workbook) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(sheet, {header:1, defval:""});
  const result = [];
  // Data starts at index 26 (row 27, 0-indexed)
  for (let i = 26; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 11) continue;
    const rawDate = row[0];
    const rawDesc = String(row[2]||"").trim();
    const rawVal  = row[10];
    if (!rawDate || !rawDesc) continue;
    // Parse date: Excel serial or string DD/MM/YYYY
    let date = "";
    if (typeof rawDate === "number") {
      // Excel serial date
      const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
      const dd = String(d.getUTCDate()).padStart(2,"0");
      const mm = String(d.getUTCMonth()+1).padStart(2,"0");
      const yy = d.getUTCFullYear();
      date = `${dd}/${mm}/${yy}`;
    } else {
      date = parseDate(String(rawDate));
    }
    if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) continue;
    const val = parseValue(rawVal);
    if (isNaN(val) || val === 0) continue;
    result.push({ date, description: rawDesc, value: val });
  }
  return result;
};

// ── Forecast ──────────────────────────────────────────────────────────────────
const generateForecast = (transactions) => {
  const months = {};
  transactions.forEach(t => {
    const p = t.date?.split("/");
    if (!p||p.length<3) return;
    const d = new Date(`${p[2]}-${p[1]}-${p[0]}`);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!months[key]) months[key]={in:0,out:0};
    if (Number(t.value)>0) months[key].in += Number(t.value);
    else months[key].out += Math.abs(Number(t.value));
  });
  const keys = Object.keys(months).sort();
  const last3 = keys.slice(-3);
  const avgIn  = last3.reduce((s,k)=>s+months[k].in,0)  / (last3.length||1);
  const avgOut = last3.reduce((s,k)=>s+months[k].out,0) / (last3.length||1);
  const now = new Date();
  return Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()+i+1, 1);
    const label = d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
    const noise = () => 0.88 + Math.random()*0.24;
    const entrada = avgIn*noise(), saida = avgOut*noise();
    return { label, entrada, saida, saldo: entrada-saida };
  });
};

// ── Export CSV ────────────────────────────────────────────────────────────────
const exportFluxoCSV = (transactions) => {
  const months = {};
  transactions.forEach(t => {
    const p = t.date?.split("/");
    if (!p||p.length<3) return;
    const mName = MONTHS[parseInt(p[1])-1]||"";
    if (!months[mName]) months[mName]={};
    const rd = t.rd||"OUTROS";
    months[mName][rd] = (months[mName][rd]||0) + Number(t.value);
  });
  const activeMonths = MONTHS.filter(m=>months[m]);
  let csv = "FLUXO DE CAIXA\n\nDESCRIÇÃO;" + activeMonths.join(";") + ";TOTAL\n";
  RD_TYPES.forEach(rd => {
    const vals = activeMonths.map(m=>(months[m]?.[rd]||0));
    const total = vals.reduce((s,v)=>s+v,0);
    if (vals.every(v=>v===0)) return;
    csv += rd + ";" + vals.map(v=>v.toFixed(2).replace(".",",")).join(";") + ";" + total.toFixed(2).replace(".",",") + "\n";
  });
  const totals = activeMonths.map(m=>Object.values(months[m]||{}).reduce((s,v)=>s+v,0));
  const grand = totals.reduce((s,v)=>s+v,0);
  csv += "TOTAL;" + totals.map(v=>v.toFixed(2).replace(".",",")).join(";") + ";" + grand.toFixed(2).replace(".",",") + "\n";
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="fluxo-caixa.csv"; a.click();
  URL.revokeObjectURL(url);
};

// ── Mini bar chart ────────────────────────────────────────────────────────────
const BarMini = ({data}) => {
  const max = Math.max(...data.map(d=>Math.max(d.entrada,d.saida)),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:64}}>
            <div style={{flex:1,background:"#00C9A7",height:`${(d.entrada/max)*100}%`,borderRadius:"3px 3px 0 0",minHeight:2}}/>
            <div style={{flex:1,background:"#E8445A",height:`${(d.saida/max)*100}%`,borderRadius:"3px 3px 0 0",minHeight:2}}/>
          </div>
          <span style={{fontSize:9,color:"#6B8299"}}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const mkS = (open) => ({
  app:  {fontFamily:"'Inter','Segoe UI',sans-serif",background:"#0F1923",minHeight:"100vh",color:"#E8EDF2"},
  sidebar:{position:"fixed",left:0,top:0,bottom:0,width:open?228:60,background:"#162130",borderRight:"1px solid #1E2D3D",display:"flex",flexDirection:"column",zIndex:100,transition:"width .2s ease",overflow:"hidden"},
  main: {marginLeft:open?228:60,padding:"28px 28px 64px",transition:"margin-left .2s ease"},
  card: {background:"#162130",borderRadius:12,padding:20,border:"1px solid #1E2D3D"},
  btn:  (v="primary")=>({padding:"9px 18px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,
          background:v==="primary"?"#00C9A7":v==="danger"?"#E8445A":v==="warn"?"#F5A623":"#1E2D3D",
          color:v==="ghost"?"#6B8299":"#0F1923"}),
  badge:(k)=>({display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,
          background:k==="RECEITA"?"rgba(46,204,113,0.15)":k==="DESPESAS FIXAS"?"rgba(232,68,90,0.2)":k==="DESPESAS VARIÁVEIS"?"rgba(232,68,90,0.12)":k==="MOVIMENTAÇÃO"?"rgba(107,130,153,0.2)":k==="INVESTIMENTOS"?"rgba(0,201,167,0.15)":"rgba(245,166,35,0.15)",
          color:k==="RECEITA"?"#2ECC71":k==="DESPESAS FIXAS"?"#E8445A":k==="DESPESAS VARIÁVEIS"?"#FF7A7A":k==="MOVIMENTAÇÃO"?"#6B8299":k==="INVESTIMENTOS"?"#00C9A7":"#F5A623"}),
  table:{width:"100%",borderCollapse:"collapse"},
  th:   {textAlign:"left",padding:"8px 10px",fontSize:11,color:"#6B8299",textTransform:"uppercase",letterSpacing:"0.5px",borderBottom:"1px solid #1E2D3D",whiteSpace:"nowrap"},
  td:   {padding:"8px 10px",fontSize:12,borderBottom:"1px solid rgba(30,45,61,0.5)",verticalAlign:"middle"},
  input:{background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:8,padding:"10px 14px",color:"#E8EDF2",fontSize:13,width:"100%",boxSizing:"border-box"},
  sel:  {background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:8,padding:"8px 12px",color:"#E8EDF2",fontSize:13},
  modal:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16},
  mbox: {background:"#162130",borderRadius:16,padding:28,width:"100%",maxWidth:520,border:"1px solid #1E2D3D",maxHeight:"90vh",overflowY:"auto"},
  toast:(k)=>({position:"fixed",bottom:24,right:24,background:k==="error"?"#E8445A":k==="warn"?"#F5A623":"#00C9A7",color:"#0F1923",padding:"12px 20px",borderRadius:10,fontWeight:600,fontSize:13,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}),
  nav:  (active,open)=>({display:"flex",alignItems:"center",gap:12,padding:open?"10px 24px":"10px 0",justifyContent:open?"flex-start":"center",cursor:"pointer",color:active?"#00C9A7":"#6B8299",background:active?"rgba(0,201,167,0.08)":"transparent",borderLeft:open?(active?"2px solid #00C9A7":"2px solid transparent"):"none",fontSize:14,fontWeight:active?600:400,transition:"all .15s",whiteSpace:"nowrap"}),
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════
const LoginScreen = ({onLogin}) => {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState("");
  const [mode,setMode]=useState("login"); const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const go = async () => {
    setBusy(true); setErr("");
    const res = mode==="login"
      ? await supabase.auth.signInWithPassword({email,password:pass})
      : await supabase.auth.signUp({email,password:pass});
    if (res.error) setErr(res.error.message);
    else if (mode==="signup") setErr("Conta criada! Verifique seu e-mail para confirmar.");
    else onLogin(res.data.user);
    setBusy(false);
  };
  const inp = {background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:8,padding:"10px 14px",color:"#E8EDF2",fontSize:13,width:"100%",boxSizing:"border-box"};
  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#0F1923",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#162130",borderRadius:20,padding:40,width:"100%",maxWidth:400,border:"1px solid #1E2D3D",color:"#E8EDF2"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:32}}>💰</div>
          <div style={{fontSize:22,fontWeight:700,color:"#00C9A7",marginTop:6}}>CashFlow</div>
          <div style={{fontSize:13,color:"#6B8299",marginTop:4}}>Gestão Financeira Colaborativa</div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:24,background:"#0F1923",borderRadius:10,padding:4}}>
          {["login","signup"].map(m=>(
            <button key={m} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,background:mode===m?"#1E2D3D":"transparent",color:mode===m?"#E8EDF2":"#6B8299"}} onClick={()=>setMode(m)}>
              {m==="login"?"Entrar":"Criar Conta"}
            </button>
          ))}
        </div>
        <div style={{marginBottom:14}}><div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>E-mail</div><input style={inp} type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
        <div style={{marginBottom:16}}><div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>Senha</div><input style={inp} type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
        {err&&<div style={{fontSize:12,color:err.includes("Conta")?"#2ECC71":"#E8445A",marginBottom:14,padding:"8px 12px",background:"rgba(232,68,90,0.08)",borderRadius:8}}>{err}</div>}
        <button style={{width:"100%",padding:"12px",borderRadius:10,border:"none",cursor:busy?"not-allowed":"pointer",fontWeight:700,fontSize:14,background:"#00C9A7",color:"#0F1923",opacity:busy?0.7:1}} onClick={go} disabled={busy}>{busy?"Aguarde...":mode==="login"?"Entrar":"Criar Conta"}</button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// REVIEW MODAL — FIX #8: tipo change also updates rd/classificacao suggestion
// ══════════════════════════════════════════════════════════════════════════════
const ReviewModal = ({items, onConfirm, onCancel, allClassificacoes}) => {
  const [rows, setRows] = useState(items.map(t=>({...t})));
  const update = (idx, field, val) => setRows(prev => prev.map((r,i) => {
    if (i !== idx) return r;
    const updated = {...r, [field]: val};
    // When tipo changes, auto-adjust rd
    if (field === "value") {
      const isPos = Number(val) > 0;
      if (isPos && updated.rd !== "RECEITA" && updated.rd !== "INVESTIMENTOS") {
        updated.rd = "RECEITA";
        updated.classificacao = "RECEITA DE VENDAS";
      } else if (!isPos && updated.rd === "RECEITA") {
        updated.rd = "DESPESAS VARIÁVEIS";
        updated.classificacao = "DESPESAS ADMINISTRATIVAS";
      }
    }
    return updated;
  }));

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}>
      <div style={{background:"#162130",borderRadius:16,padding:24,width:"100%",maxWidth:760,border:"1px solid #F5A623",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>🤖 Revisão de Classificações</div>
        <div style={{fontSize:13,color:"#6B8299",marginBottom:4}}>{rows.length} lançamento(s) não reconhecidos — ajuste se necessário e confirme.</div>
        <div style={{fontSize:11,color:"#F5A623",marginBottom:16}}>⚠ Ao mudar o Tipo (Entrada/Saída), R/D é ajustado automaticamente.</div>
        {rows.map((t,i)=>(
          <div key={i} style={{background:"#0F1923",borderRadius:10,padding:14,marginBottom:10,border:"1px solid #1E2D3D"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{t.description}</div>
            <div style={{fontSize:11,color:"#6B8299",marginBottom:10}}>{t.date} · {fmt(Math.abs(Number(t.value)))}</div>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:8}}>
              <div>
                <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Tipo</div>
                <select style={{background:"#162130",border:"1px solid #1E2D3D",borderRadius:8,padding:"7px 10px",color:"#E8EDF2",fontSize:12}}
                  value={Number(t.value)>0?"entrada":"saída"}
                  onChange={e=>{const abs=Math.abs(Number(t.value));update(i,"value",e.target.value==="entrada"?abs:-abs);}}>
                  <option value="entrada">↑ Entrada (+)</option>
                  <option value="saída">↓ Saída (-)</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>R/D</div>
                <select style={{background:"#162130",border:"1px solid #1E2D3D",borderRadius:8,padding:"7px 10px",color:"#E8EDF2",fontSize:12,width:"100%"}} value={t.rd||""} onChange={e=>update(i,"rd",e.target.value)}>
                  {RD_TYPES.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Classificação</div>
                <select style={{background:"#162130",border:"1px solid #1E2D3D",borderRadius:8,padding:"7px 10px",color:"#E8EDF2",fontSize:12,width:"100%"}} value={t.classificacao||""} onChange={e=>update(i,"classificacao",e.target.value)}>
                  {allClassificacoes.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,background:"#1E2D3D",color:"#6B8299"}} onClick={onCancel}>Cancelar</button>
          <button style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,background:"#00C9A7",color:"#0F1923"}} onClick={()=>onConfirm(rows)}>✓ Confirmar e Salvar ({rows.length})</button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE TAB — BI: KPIs, evolução mensal, hierarquia R/D→Classificação→Subcategoria
// ══════════════════════════════════════════════════════════════════════════════
const AnaliseTab = ({transactions, s, fmt}) => {
  const now = new Date();
  const [biMes, setBiMes] = useState("todos");
  const [biAno, setBiAno] = useState(String(now.getFullYear()));
  const [biRd,  setBiRd]  = useState("todos");
  const [expanded, setExpanded] = useState({});
  const [drillDown, setDrillDown] = useState(null); // null | {rd} | {rd,cl}

  const DCOLORS = ["#4F8EF7","#F5A623","#E8445A","#00C9A7","#9B59B6","#E67E22","#1ABC9C","#E74C3C"];
  const RD_COLORS = {"RECEITA":"#4F8EF7","DESPESAS FIXAS":"#E8445A","DESPESAS VARIÁVEIS":"#FF8C42","MOVIMENTAÇÃO":"#9B59B6"};
  const rdColor = rd => RD_COLORS[rd] || "#F5A623";

  const anos = [...new Set(transactions.map(t=>t.date?.split("/")?.[2]).filter(Boolean))].sort();

  const filtrado = transactions.filter(t=>{
    const p = t.date?.split("/");
    if(!p||p.length<3) return false;
    if(biAno!=="todos" && p[2]!==biAno) return false;
    if(biMes!=="todos" && parseInt(p[1])!==parseInt(biMes)) return false;
    if(biRd!=="todos" && t.rd!==biRd) return false;
    return true;
  });

  const receita = filtrado.filter(t=>Number(t.value)>0).reduce((acc,t)=>acc+Number(t.value),0);
  const despesa = filtrado.filter(t=>Number(t.value)<0).reduce((acc,t)=>acc+Math.abs(Number(t.value)),0);
  const saldo   = receita - despesa;
  const count   = filtrado.length;

  // Previous year for % comparison
  const prevFiltrado = transactions.filter(t=>{
    const p = t.date?.split("/");
    if(!p||p.length<3) return false;
    if(biAno!=="todos"){ if(p[2]!==String(Number(biAno)-1)) return false; }
    if(biMes!=="todos" && parseInt(p[1])!==parseInt(biMes)) return false;
    if(biRd!=="todos" && t.rd!==biRd) return false;
    return true;
  });
  const prevRec = prevFiltrado.filter(t=>Number(t.value)>0).reduce((acc,t)=>acc+Number(t.value),0);
  const prevDes = prevFiltrado.filter(t=>Number(t.value)<0).reduce((acc,t)=>acc+Math.abs(Number(t.value)),0);
  const prevSaldo = prevRec - prevDes;
  const pctChg = (cur,prev) => prev===0?null:((cur-prev)/Math.abs(prev)*100);

  // Base filtered (sem filtro de R/D — usado no drill down do gráfico)
  const baseFiltered = transactions.filter(t=>{
    const p = t.date?.split("/");
    if(!p||p.length<3) return false;
    if(biAno!=="todos" && p[2]!==biAno) return false;
    if(biMes!=="todos" && parseInt(p[1])!==parseInt(biMes)) return false;
    return true;
  });

  // Monthly evolution — meses do ano selecionado (ou últimos 12 se "todos")
  const evolucao = [];
  if(biAno!=="todos"){
    const year=Number(biAno);
    const maxM = year===now.getFullYear()?now.getMonth():11;
    for(let mi=0;mi<=maxM;mi++){
      const m=String(mi+1).padStart(2,"0"), a=String(year);
      const lbl=new Date(year,mi,1).toLocaleDateString("pt-BR",{month:"short"}).replace(".","");
      const ts=transactions.filter(t=>{const p=t.date?.split("/");return p&&p[1]===m&&p[2]===a;});
      const rec=ts.filter(t=>Number(t.value)>0).reduce((acc,t)=>acc+Number(t.value),0);
      const des=ts.filter(t=>Number(t.value)<0).reduce((acc,t)=>acc+Math.abs(Number(t.value)),0);
      evolucao.push({lbl,rec,des,saldo:rec-des,m,a});
    }
    // Remove meses sem dados no início
    while(evolucao.length>1&&evolucao[0].rec===0&&evolucao[0].des===0) evolucao.shift();
  } else {
    for(let i=11;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const m=String(d.getMonth()+1).padStart(2,"0"),a=String(d.getFullYear());
      const lbl=d.toLocaleDateString("pt-BR",{month:"short"}).replace(".","");
      const ts=transactions.filter(t=>{const p=t.date?.split("/");return p&&p[1]===m&&p[2]===a;});
      const rec=ts.filter(t=>Number(t.value)>0).reduce((acc,t)=>acc+Number(t.value),0);
      const des=ts.filter(t=>Number(t.value)<0).reduce((acc,t)=>acc+Math.abs(Number(t.value)),0);
      evolucao.push({lbl,rec,des,saldo:rec-des,m,a});
    }
  }

  // Sparkline helper
  const Spark = ({data,color,w=80,h=26})=>{
    if(!data||data.length<2) return null;
    const mx=Math.max(...data,0.01), mn=Math.min(...data);
    const rng=mx-mn||1;
    const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*(h-4)-2}`).join(" ");
    const lx=pts.split(" ").pop().split(",");
    return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/><circle cx={lx[0]} cy={lx[1]} r={2.5} fill={color}/></svg>;
  };

  // SVG line chart
  const CW=600,CH=160,PL=40,PR=10,PT=8,PB=4;
  const cW=CW-PL-PR, cH=CH-PT-PB;
  const allV=evolucao.flatMap(e=>[e.rec,e.des,e.saldo]);
  const cMax=Math.max(...allV,1), cMin=Math.min(...allV,0), cRng=cMax-cMin||1;
  const toX=i=>PL+(i/(evolucao.length-1))*cW;
  const toY=v=>PT+cH-((v-cMin)/cRng)*cH;
  const makePath=(data,toYFn=toY)=>{
    if(!data||data.length<2) return "";
    const pts=data.map((v,i)=>({x:toX(i),y:toYFn(v)}));
    let d=`M ${pts[0].x} ${pts[0].y}`;
    for(let i=1;i<pts.length;i++){
      const cp1x=pts[i-1].x+(pts[i].x-pts[i-1].x)/3;
      const cp2x=pts[i].x-(pts[i].x-pts[i-1].x)/3;
      d+=` C ${cp1x} ${pts[i-1].y}, ${cp2x} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };
  const makeArea=(data,toYFn=toY)=>{
    const p=makePath(data,toYFn);
    if(!p) return "";
    return p+` L ${toX(data.length-1)} ${toYFn(0)} L ${PL} ${toYFn(0)} Z`;
  };
  const recPath=makePath(evolucao.map(e=>e.rec));
  const desPath=makePath(evolucao.map(e=>e.des));
  const saldoPath=makePath(evolucao.map(e=>e.saldo));
  const gridVals=[cMin,cMin+cRng*0.25,cMin+cRng*0.5,cMin+cRng*0.75,cMax];

  // Drill-down: linhas do gráfico variam conforme o nível
  const chartLines = (() => {
    if(!drillDown){
      return [
        {label:"Receitas",c:"#4F8EF7",data:evolucao.map(e=>e.rec),area:true,dashed:false},
        {label:"Despesas",c:"#E8445A",data:evolucao.map(e=>e.des),area:true,dashed:false},
        {label:"Saldo Acumulado",c:"#9B59B6",data:evolucao.map(e=>e.saldo),area:false,dashed:true},
      ];
    }
    // Agrupa valores mensais por chave (classificação ou subcategoria)
    const groupMap = {};
    evolucao.forEach((ev,i)=>{
      baseFiltered.filter(t=>{
        const p=t.date?.split("/");
        if(!p||p[1]!==ev.m||p[2]!==ev.a) return false;
        if(t.rd!==drillDown.rd) return false;
        if(drillDown.cl && t.classificacao!==drillDown.cl) return false;
        return true;
      }).forEach(t=>{
        const key = drillDown.cl ? (t.subcategoria||"SEM SUBCATEGORIA") : (t.classificacao||"SEM CLASSIFICAÇÃO");
        if(!groupMap[key]) groupMap[key]=new Array(evolucao.length).fill(0);
        groupMap[key][i]+=Number(t.value);
      });
    });
    return Object.entries(groupMap)
      .sort((a,b)=>Math.abs(b[1].reduce((s,v)=>s+v,0))-Math.abs(a[1].reduce((s,v)=>s+v,0)))
      .slice(0,5)
      .map(([label,data],i)=>({label,c:DCOLORS[i],data,area:false,dashed:false}));
  })();

  // Recalcula limites do SVG com base nas linhas ativas
  const drillAllV = chartLines.flatMap(l=>l.data);
  const drillMax = Math.max(...drillAllV,1), drillMin=Math.min(...drillAllV,0), drillRng=drillMax-drillMin||1;
  const toYd = v=>PT+cH-((v-drillMin)/drillRng)*cH;
  const drillGridVals=[drillMin,drillMin+drillRng*0.25,drillMin+drillRng*0.5,drillMin+drillRng*0.75,drillMax];

  // Category breakdown
  const catMap={};
  filtrado.forEach(t=>{
    const cl=t.classificacao||"SEM CLASSIFICAÇÃO";
    if(!catMap[cl]) catMap[cl]={total:0,count:0};
    catMap[cl].total+=Number(t.value);
    catMap[cl].count++;
  });
  const totalAbs=Object.values(catMap).reduce((s,c)=>s+Math.abs(c.total),0)||1;
  const catSorted=Object.entries(catMap).sort((a,b)=>Math.abs(b[1].total)-Math.abs(a[1].total)).slice(0,8);

  // Donut
  const DR=52, DS=22, DC=2*Math.PI*DR;
  let dOff=0;
  const donut=catSorted.map(([name,data],i)=>{
    const pct=Math.abs(data.total)/totalAbs;
    const sl={name,pct,color:DCOLORS[i%DCOLORS.length],off:DC*(1-dOff),len:DC*pct};
    dOff+=pct; return sl;
  });

  // Destaques
  const mediaRec=evolucao.reduce((s,e)=>s+e.rec,0)/evolucao.length;
  const mediaDes=evolucao.reduce((s,e)=>s+e.des,0)/evolucao.length;
  const melhor=[...evolucao].sort((a,b)=>b.saldo-a.saldo)[0];
  const pior=[...evolucao].sort((a,b)=>a.saldo-b.saldo)[0];

  // Hierarquia expandível
  const hierarquia={};
  filtrado.forEach(t=>{
    const rd=t.rd||"SEM R/D", cl=t.classificacao||"SEM CLASSIFICAÇÃO", sub=t.subcategoria||"SEM SUBCATEGORIA";
    if(!hierarquia[rd]) hierarquia[rd]={total:0,cls:{}};
    hierarquia[rd].total+=Number(t.value);
    if(!hierarquia[rd].cls[cl]) hierarquia[rd].cls[cl]={total:0,subs:{}};
    hierarquia[rd].cls[cl].total+=Number(t.value);
    if(!hierarquia[rd].cls[cl].subs[sub]) hierarquia[rd].cls[cl].subs[sub]={total:0};
    hierarquia[rd].cls[cl].subs[sub].total+=Number(t.value);
  });
  const maxHier=Math.max(...Object.values(hierarquia).map(r=>Math.abs(r.total)),1);
  const toggle=k=>setExpanded(e=>({...e,[k]:!e[k]}));

  const PctBadge=({v})=>v===null?null:(
    <span style={{fontSize:10,fontWeight:600,color:v>=0?"#2ECC71":"#E8445A",background:v>=0?"rgba(46,204,113,0.12)":"rgba(232,68,90,0.12)",borderRadius:4,padding:"1px 5px"}}>
      {v>=0?"+":""}{v.toFixed(1)}%
    </span>
  );

  return (
    <>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:22,fontWeight:700,letterSpacing:-0.5}}>Análise</div>
          <div style={{fontSize:12,color:"#6B8299",marginTop:2}}>Acompanhe o desempenho financeiro do período selecionado.</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <select style={s.sel} value={biAno} onChange={e=>setBiAno(e.target.value)}>
            <option value="todos">Todos os anos</option>
            {anos.map(a=><option key={a}>{a}</option>)}
          </select>
          <select style={s.sel} value={biMes} onChange={e=>setBiMes(e.target.value)}>
            <option value="todos">Todos os meses</option>
            {MONTHS.map((m,i)=><option key={i} value={String(i+1).padStart(2,"0")}>{m}</option>)}
          </select>
          <select style={s.sel} value={biRd} onChange={e=>setBiRd(e.target.value)}>
            <option value="todos">Todos R/D</option>
            {RD_TYPES.map(r=><option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
        {[
          {l:"Receitas Totais",  v:fmt(receita), pct:pctChg(receita,prevRec),   c:"#2ECC71", bc:"rgba(46,204,113,0.15)",  icon:"📈", spark:evolucao.map(e=>e.rec),   sc:"#00C9A7"},
          {l:"Despesas Totais",  v:fmt(despesa), pct:pctChg(despesa,prevDes),   c:"#E8445A", bc:"rgba(232,68,90,0.12)",   icon:"📉", spark:evolucao.map(e=>e.des),   sc:"#E8445A"},
          {l:"Saldo do Período", v:fmt(saldo),   pct:pctChg(saldo,prevSaldo),   c:saldo>=0?"#00C9A7":"#E8445A", bc:"rgba(0,201,167,0.08)", icon:"⚖️", spark:evolucao.map(e=>e.saldo), sc:"#9B59B6"},
          {l:"Lançamentos",      v:count,        pct:null,                       c:"#F5A623", bc:"rgba(245,166,35,0.08)",  icon:"📋", spark:null, sc:"#F5A623"},
        ].map(k=>(
          <div key={k.l} style={{...s.card,borderLeft:`3px solid ${k.c}`,overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:"#6B8299",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>{k.l}</div>
                <div style={{fontSize:19,fontWeight:700,color:"#E8EDF2",marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{k.v}</div>
                <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                  <PctBadge v={k.pct}/>
                  {k.pct!==null&&<span style={{fontSize:9,color:"#4A5E6D"}}>vs ano ant.</span>}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,marginLeft:8}}>
                <span style={{fontSize:22}}>{k.icon}</span>
                {k.spark&&<Spark data={k.spark} color={k.sc}/>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Destaques */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:12,marginBottom:14}}>
        {/* SVG Line Chart */}
        <div style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {drillDown&&(
                <button onClick={()=>setDrillDown(drillDown.cl?{rd:drillDown.rd}:null)}
                  style={{background:"none",border:"1px solid #2A3F52",borderRadius:5,color:"#6B8299",fontSize:10,cursor:"pointer",padding:"2px 7px"}}>← Voltar</button>
              )}
              <div style={{fontSize:13,fontWeight:600}}>
                {drillDown
                  ? (drillDown.cl
                    ? <span><span style={{color:"#6B8299"}}>{drillDown.rd} → </span><span style={{color:rdColor(drillDown.rd)}}>{drillDown.cl}</span></span>
                    : <span><span style={{color:"#6B8299"}}>Evolução Mensal → </span><span style={{color:rdColor(drillDown.rd)}}>{drillDown.rd}</span></span>)
                  : "Evolução Mensal"}
              </div>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {chartLines.map(lg=>(
                <span key={lg.label} style={{fontSize:10,color:lg.c,display:"flex",alignItems:"center",gap:4}}>
                  <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke={lg.c} strokeWidth={2} strokeDasharray={lg.dashed?"4,2":undefined}/></svg>
                  {lg.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{width:"100%",overflowX:"hidden"}}>
          <svg viewBox={`0 0 ${CW} ${CH+26}`} style={{width:"100%",height:"auto",display:"block"}} preserveAspectRatio="xMidYMid meet">
            <defs>
              {chartLines.filter(l=>l.area).map((l,i)=>(
                <linearGradient key={i} id={`biGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={l.c} stopOpacity="0.22"/>
                  <stop offset="100%" stopColor={l.c} stopOpacity="0.02"/>
                </linearGradient>
              ))}
            </defs>
            {/* Grid */}
            {drillGridVals.map((v,i)=>{
              const y=toYd(v);
              return (
                <g key={i}>
                  <line x1={PL} y1={y} x2={PL+cW} y2={y} stroke="rgba(107,130,153,0.1)" strokeWidth={1}/>
                  <text x={PL-4} y={y+4} fontSize={8} fill="#4A5E6D" textAnchor="end">{v>=1000||v<=-1000?`${(v/1000).toFixed(0)}k`:v.toFixed(0)}</text>
                </g>
              );
            })}
            {drillMin<0&&<line x1={PL} y1={toYd(0)} x2={PL+cW} y2={toYd(0)} stroke="rgba(255,255,255,0.08)" strokeWidth={1}/>}
            {/* Area fills */}
            {chartLines.filter(l=>l.area).map((l,i)=>(
              <path key={i} d={makeArea(l.data,toYd)} fill={`url(#biGrad${i})`}/>
            ))}
            {/* Lines + Dots */}
            {chartLines.map((l,li)=>(
              <g key={li}>
                <path d={makePath(l.data,toYd)} fill="none" stroke={l.c} strokeWidth={l.dashed?1.5:2}
                  strokeDasharray={l.dashed?"5,3":undefined} strokeLinejoin="round" strokeLinecap="round"/>
                {l.data.map((v,i)=>(
                  <circle key={i} cx={toX(i)} cy={toYd(v)} r={3} fill={l.c} stroke="#162130" strokeWidth={1.5}/>
                ))}
              </g>
            ))}
            {/* Month labels */}
            {evolucao.map((e,i)=>(
              <text key={i} x={toX(i)} y={CH+20} fontSize={9} fill="#4A5E6D" textAnchor="middle">{e.lbl}</text>
            ))}
          </svg>
          </div>
        </div>

        {/* Destaques */}
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Destaques do Período</div>
          {[
            {icon:"💰",l:"Economia do Período",    sub:"Receitas − Despesas",    v:fmt(saldo),    c:saldo>=0?"#2ECC71":"#E8445A", p:pctChg(saldo,prevSaldo)},
            {icon:"📊",l:"Média Mensal de Receitas",sub:"Últimos 12 meses",       v:fmt(mediaRec), c:"#4F8EF7",  p:null},
            {icon:"🧾",l:"Média Mensal de Despesas",sub:"Últimos 12 meses",       v:fmt(mediaDes), c:"#E8445A",  p:null},
            {icon:"⬆️",l:"Melhor Mês",             sub:melhor?.lbl||"—",         v:fmt(melhor?.saldo||0), c:"#2ECC71", p:null},
            {icon:"⬇️",l:"Pior Mês",               sub:pior?.lbl||"—",           v:fmt(pior?.saldo||0),   c:"#E8445A", p:null},
          ].map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<4?"1px solid rgba(255,255,255,0.04)":"none"}}>
              <span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>{d.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:"#E8EDF2",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.l}</div>
                <div style={{fontSize:10,color:"#6B8299"}}>{d.sub}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:12,fontWeight:700,color:d.c,whiteSpace:"nowrap"}}>{d.v}</div>
                <PctBadge v={d.p}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr 210px",gap:12,marginBottom:14}}>
        {/* Donut */}
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Composição</div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
            <svg viewBox="0 0 140 140" width={110} height={110}>
              {donut.map((sl,i)=>(
                <circle key={i} cx={70} cy={70} r={DR} fill="none" stroke={sl.color} strokeWidth={DS}
                  strokeDasharray={`${sl.len} ${DC-sl.len}`} strokeDashoffset={sl.off}
                  style={{transform:"rotate(-90deg)",transformOrigin:"70px 70px"}}/>
              ))}
              <text x={70} y={65} textAnchor="middle" fontSize={9}  fill="#6B8299">Total</text>
              <text x={70} y={78} textAnchor="middle" fontSize={10} fill="#E8EDF2" fontWeight="bold">{(totalAbs/1000).toFixed(0)}k</text>
            </svg>
          </div>
          {donut.slice(0,6).map((sl,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{width:8,height:8,borderRadius:2,background:sl.color,flexShrink:0}}/>
              <span style={{fontSize:10,color:"#E8EDF2",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sl.name}</span>
              <span style={{fontSize:10,color:"#6B8299",flexShrink:0}}>{(sl.pct*100).toFixed(1)}%</span>
            </div>
          ))}
        </div>

        {/* Category table */}
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Evolução por Categoria</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 110px 55px 45px",marginBottom:6}}>
            {["Categoria","Valor (R$)","% Total","Lanç."].map(h=>(
              <div key={h} style={{fontSize:9,color:"#4A5E6D",textTransform:"uppercase",padding:"0 4px 4px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>{h}</div>
            ))}
          </div>
          {catSorted.map(([name,data],i)=>{
            const pct=Math.abs(data.total)/totalAbs*100;
            const color=DCOLORS[i%DCOLORS.length];
            return (
              <div key={name} style={{display:"grid",gridTemplateColumns:"1fr 110px 55px 45px",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",alignItems:"center"}}>
                <div style={{padding:"0 4px"}}>
                  <div style={{fontSize:11,color:"#E8EDF2",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
                  <div style={{height:3,background:"#1E2D3D",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2}}/>
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:600,color:data.total>=0?"#2ECC71":"#E8445A",padding:"0 4px",textAlign:"right"}}>{fmt(data.total)}</div>
                <div style={{fontSize:11,color:"#6B8299",padding:"0 4px",textAlign:"right"}}>{pct.toFixed(1)}%</div>
                <div style={{fontSize:11,color:"#6B8299",padding:"0 4px",textAlign:"right"}}>{data.count}</div>
              </div>
            );
          })}
        </div>

        {/* Fluxo de Caixa */}
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Fluxo de Caixa</div>
          {[{l:"Receitas",v:receita,c:"#2ECC71"},{l:"Despesas",v:-despesa,c:"#E8445A"}].map((row,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <span style={{fontSize:12,color:"#A8B4C0"}}>{row.l}</span>
              <span style={{fontSize:12,fontWeight:600,color:row.c}}>{fmt(row.v)}</span>
            </div>
          ))}
          <div style={{marginTop:14,background:"rgba(0,201,167,0.07)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"#6B8299",marginBottom:4}}>Saldo Final</div>
            <div style={{fontSize:19,fontWeight:700,color:saldo>=0?"#00C9A7":"#E8445A"}}>{fmt(saldo)}</div>
          </div>
          <div style={{marginTop:10}}>
            <Spark data={evolucao.map(e=>e.saldo)} color={saldo>=0?"#00C9A7":"#E8445A"} w={186} h={38}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
              <span style={{fontSize:9,color:"#4A5E6D"}}>{evolucao[0]?.lbl}</span>
              <span style={{fontSize:9,color:"#4A5E6D"}}>{evolucao[evolucao.length-1]?.lbl}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hierarquia expandível */}
      <div style={s.card}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Hierarquia R/D → Classificação → Subcategoria</div>
        {Object.entries(hierarquia).sort((a,b)=>Math.abs(b[1].total)-Math.abs(a[1].total)).map(([rd,rdData])=>{
          const rdPct=Math.abs(rdData.total)/maxHier*100;
          const rdKey=`rd_${rd}`;
          const rdc=rdColor(rd);
          const isDrilled=drillDown?.rd===rd;
          return (
            <div key={rd} style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:4,background:isDrilled?"rgba(79,142,247,0.05)":"none",borderRadius:6,padding:"2px 4px"}}
                onClick={()=>{toggle(rdKey);setDrillDown(isDrilled?null:{rd});}}>
                <span style={{fontSize:11,color:"#4A5E6D",width:12}}>{expanded[rdKey]?"▼":"▶"}</span>
                <span style={{...s.badge(rd),fontSize:10,minWidth:160}}>{rd}</span>
                {isDrilled&&<span style={{fontSize:9,color:rdc,background:`${rdc}22`,borderRadius:4,padding:"1px 5px"}}>no gráfico ↑</span>}
                <div style={{flex:1,height:6,background:"#1E2D3D",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${rdPct}%`,background:rdc,borderRadius:3}}/>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:rdData.total>=0?"#2ECC71":"#E8445A",minWidth:110,textAlign:"right"}}>{fmt(rdData.total)}</span>
              </div>
              {expanded[rdKey]&&(
                <div style={{paddingLeft:24}}>
                  {Object.entries(rdData.cls).sort((a,b)=>Math.abs(b[1].total)-Math.abs(a[1].total)).map(([cl,clData],cli)=>{
                    const clPct=Math.abs(clData.total)/Math.abs(rdData.total)*100;
                    const clKey=`cl_${rd}_${cl}`;
                    const clc=DCOLORS[cli%DCOLORS.length];
                    const isClDrilled=drillDown?.rd===rd&&drillDown?.cl===cl;
                    return (
                      <div key={cl} style={{marginBottom:5}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:2,background:isClDrilled?"rgba(79,142,247,0.05)":"none",borderRadius:5,padding:"2px 4px"}}
                          onClick={e=>{e.stopPropagation();toggle(clKey);setDrillDown(isClDrilled?{rd}:{rd,cl});}}>
                          <span style={{fontSize:11,color:"#4A5E6D",width:12}}>{expanded[clKey]?"▼":"▶"}</span>
                          <span style={{fontSize:11,color:"#E8EDF2",minWidth:160}}>{cl}</span>
                          {isClDrilled&&<span style={{fontSize:9,color:clc,background:`${clc}22`,borderRadius:4,padding:"1px 5px"}}>no gráfico ↑</span>}
                          <div style={{flex:1,height:4,background:"#1E2D3D",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${clPct}%`,background:clc,borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:11,color:"#6B8299",minWidth:50,textAlign:"right"}}>{clPct.toFixed(1)}%</span>
                          <span style={{fontSize:11,fontWeight:600,color:clData.total>=0?"#2ECC71":"#E8445A",minWidth:110,textAlign:"right"}}>{fmt(clData.total)}</span>
                        </div>
                        {expanded[clKey]&&(
                          <div style={{paddingLeft:24}}>
                            {Object.entries(clData.subs).sort((a,b)=>Math.abs(b[1].total)-Math.abs(a[1].total)).map(([sub,subData])=>{
                              const subPct=Math.abs(subData.total)/Math.abs(clData.total)*100;
                              return (
                                <div key={sub} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                                  <span style={{fontSize:10,color:"#6B8299",minWidth:172}}>{sub}</span>
                                  <div style={{flex:1,height:3,background:"#1E2D3D",borderRadius:3,overflow:"hidden"}}>
                                    <div style={{height:"100%",width:`${subPct}%`,background:"#2A4A5A",borderRadius:3}}/>
                                  </div>
                                  <span style={{fontSize:10,color:"#6B8299",minWidth:50,textAlign:"right"}}>{subPct.toFixed(1)}%</span>
                                  <span style={{fontSize:10,color:subData.total>=0?"#2ECC71":"#E8445A",minWidth:110,textAlign:"right"}}>{fmt(subData.total)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

// CLASSIFICAÇÕES TAB — unified, editable, searchable
// ══════════════════════════════════════════════════════════════════════════════
const ClassificacoesTab = ({customCats, loadCustomCats, showToast, s, loadTransactions, hiddenBaseCls, hideBaseClassification}) => {
  const [search, setSearch] = useState("");
  const [filterRd, setFilterRd] = useState("todos");
  const [editingRow, setEditingRow] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({detalhe:"", rd:"RECEITA", classificacao:"RECEITA DE VENDAS", subcategoria:"", keywords:""});
  const [saving, setSaving] = useState(false);
  const [pendingApply, setPendingApply] = useState(null);
  const [applyingRule, setApplyingRule] = useState(false);
  const [sortCol, setSortCol] = useState("detalhe");
  const [sortDir, setSortDir] = useState("asc");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const allRows = useMemo(() => {
    const custom = customCats.map(c=>({
      id: c.id,
      detalhe: c.name||"",
      rd: c.rd||"",
      classificacao: c.classificacao||"",
      subcategoria: c.subcategoria||"",
      keywords: (c.keywords||[]).filter(k=>k&&k!==c.name?.toLowerCase()),
      isCustom: true
    }));
    const customNames = new Set(custom.map(c=>c.detalhe.toUpperCase()));
    const hidden = new Set((hiddenBaseCls||[]).map(n=>n.toUpperCase()));
    const base = BASE_CLASSIFICATIONS
      .filter(c => !customNames.has(c.d.toUpperCase().trim()) && !hidden.has(c.d.toUpperCase().trim()))
      .map(c=>({id:"base_"+c.d, detalhe:c.d, rd:c.r, classificacao:c.c, isCustom:false}));
    return [...custom, ...base].sort((a,b)=>a.detalhe.localeCompare(b.detalhe));
  }, [customCats, hiddenBaseCls]);

  const toggleSort = (col) => {
    if (sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const base = allRows.filter(r => {
      const ms = !search || r.detalhe.toLowerCase().includes(search.toLowerCase()) || r.classificacao.toLowerCase().includes(search.toLowerCase());
      const mr = filterRd==="todos" || r.rd===filterRd;
      return ms && mr;
    });
    return [...base].sort((a,b)=>{
      const av = (a[sortCol]||"").toLowerCase();
      const bv = (b[sortCol]||"").toLowerCase();
      return sortDir==="asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [allRows, search, filterRd, sortCol, sortDir]);

  const findAffected = async (keywords) => {
    const kws = (Array.isArray(keywords)?keywords:[keywords]).map(k=>k.trim().toUpperCase()).filter(Boolean);
    const {data} = await supabase.from("transactions").select("id,date,description,rd,classificacao,conta,origin");
    return (data||[]).filter(t =>
      kws.some(kw=>flexMatch(t.description, kw)) && !isCCTransaction(t)
    );
  };

  const saveEdit = async () => {
    if (!editingRow?.detalhe.trim()) { showToast("Descrição obrigatória.","error"); return; }
    if (!editingRow.rd || !editingRow.classificacao) { showToast("R/D e Classificação são obrigatórios.","error"); return; }
    setSaving(true);
    const nameKw = editingRow.detalhe.trim().toLowerCase();
    const editKws = (editingRow.keywordsText||"").split(",").map(k=>k.trim().toLowerCase()).filter(Boolean);
    const mergedKws = [...new Set([nameKw, ...editKws])];
    if (editingRow.isCustom && !editingRow.id.startsWith("base_")) {
      await supabase.from("categories").update({
        name: editingRow.detalhe.trim().toUpperCase(),
        rd: editingRow.rd, classificacao: editingRow.classificacao,
        subcategoria: editingRow.subcategoria||null,
        keywords: mergedKws,
      }).eq("id", editingRow.id);
    } else {
      const {error} = await supabase.from("categories").upsert({
        name: editingRow.detalhe.trim().toUpperCase(),
        rd: editingRow.rd, classificacao: editingRow.classificacao,
        subcategoria: editingRow.subcategoria||null,
        keywords: mergedKws,
      }, {onConflict:"name"});
      if (error) { showToast("Erro: "+error.message,"error"); setSaving(false); return; }
    }
    const affected = await findAffected([editingRow.detalhe, ...editKws]);
    // Keywords removidas: re-avaliar lançamentos que eram classificados por elas
    const removedKws = (editingRow.keywords||[]).map(k=>k.toLowerCase()).filter(k=>!mergedKws.includes(k));
    let reeval = [];
    if (removedKws.length > 0) {
      const {data:freshCats} = await supabase.from("categories").select("*");
      const matched = await findAffected(removedKws);
      reeval = matched.map(t=>{
        const local = localClassify(t.description, freshCats||[]);
        const sugRd = local?.r||null, sugClass = local?.c||null;
        return (sugRd!==t.rd||sugClass!==t.classificacao) ? {...t, suggestedRd:sugRd, suggestedClass:sugClass, suggestedSub:local?.sub||null} : null;
      }).filter(Boolean);
    }
    await loadCustomCats(); setEditingRow(null); setSaving(false);
    const reevalPayload = reeval.length > 0 ? {ruleName:editingRow.detalhe.trim().toUpperCase(), reeval:true, trans:reeval} : null;
    if (affected.length > 0) {
      setPendingApply({ruleName:editingRow.detalhe.trim().toUpperCase(), rd:editingRow.rd, classificacao:editingRow.classificacao, subcategoria:editingRow.subcategoria||null, trans:affected, next:reevalPayload});
    } else if (reevalPayload) {
      setPendingApply(reevalPayload);
    } else {
      showToast("Classificação salva!");
    }
  };

  const saveNew = async () => {
    if (!newRow.detalhe.trim()) { showToast("Descrição obrigatória.","error"); return; }
    setSaving(true);
    const name = newRow.detalhe.trim().toUpperCase();
    const kws = newRow.keywords.split(",").map(k=>k.trim().toLowerCase()).filter(Boolean);
    const {error} = await supabase.from("categories").upsert({
      name, rd: newRow.rd, classificacao: newRow.classificacao,
      subcategoria: newRow.subcategoria||null,
      keywords: [...new Set([newRow.detalhe.trim().toLowerCase(), ...kws])],
    }, {onConflict:"name"});
    if (error) { showToast("Erro ao salvar: "+error.message,"error"); setSaving(false); return; }
    const affected = await findAffected([newRow.detalhe, ...kws]);
    await loadCustomCats();
    setNewRow({detalhe:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",subcategoria:"",keywords:""});
    setShowAdd(false); setSaving(false);
    if (affected.length > 0) {
      setPendingApply({ruleName:name, rd:newRow.rd, classificacao:newRow.classificacao, subcategoria:newRow.subcategoria||null, trans:affected});
    } else {
      showToast("Classificação salva!");
    }
  };

  const deleteCustom = async (id, msg) => {
    const {error} = await supabase.from("categories").delete().eq("id",id);
    if (error) { showToast("Erro ao remover: "+error.message,"error"); return; }
    await loadCustomCats(); showToast(msg||"Removida.");
  };

  const II = {background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"5px 8px",color:"#E8EDF2",fontSize:12,width:"100%",boxSizing:"border-box"};
  const IS = {background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"5px 8px",color:"#E8EDF2",fontSize:12,width:"100%"};
  const allCls = [...new Set([...CLASSIFICACOES,...customCats.map(c=>c.classificacao||"").filter(Boolean)])].sort();

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontSize:21,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
            Classificações
            <span title={"Como atua no fluxo:\n1. Ao importar um extrato, cada linha é comparada com essa lista (nome + keywords).\n2. Se bater, o lançamento já entra com R/D, Classificação e Subcategoria preenchidos.\n3. Se não bater com nada aqui, tenta a IA (Gemini); se também falhar, vai para revisão manual."}
              style={{fontSize:12,width:18,height:18,borderRadius:"50%",border:"1px solid #6B8299",color:"#6B8299",display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"help",fontWeight:600}}>?</span>
          </div>
          <div style={{fontSize:13,color:"#6B8299",marginTop:2}}>{filtered.length} de {allRows.length} · {customCats.length} personalizadas</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={{...s.btn("ghost"),padding:"9px 14px",fontSize:12}} title="Upload Excel/CSV com classificações" onClick={()=>document.getElementById("classUploadInput").click()}>⬆ Importar</button>
          <input id="classUploadInput" type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={async e=>{
            const file = e.target.files[0]; if(!file) return; e.target.value="";
            try {
              let rows = [];
              if(file.name.endsWith(".csv")||file.name.endsWith(".txt")){
                const text = await file.text();
                const lines = text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(l=>l.trim());
                const sep = lines[0].includes(";") ? ";" : ",";
                lines.slice(1).forEach(l=>{
                  const cols = l.split(sep).map(c=>c.replace(/"/g,"").trim());
                  if(cols[0]&&cols[1]&&cols[2]) rows.push({detalhe:cols[0],rd:cols[1],classificacao:cols[2]});
                });
              } else {
                if(!window.XLSX){ await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);}); }
                const buf = await file.arrayBuffer();
                const wb = window.XLSX.read(buf,{type:"array"});
                const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});
                data.slice(1).forEach(r=>{ if(r[0]&&r[1]&&r[2]) rows.push({detalhe:String(r[0]).trim(),rd:String(r[1]).trim(),classificacao:String(r[2]).trim()}); });
              }
              if(!rows.length){ showToast("Nenhuma classificação encontrada.","error"); return; }
              for(let i=0;i<rows.length;i+=50){
                await supabase.from("categories").upsert(rows.slice(i,i+50).map(r=>({name:r.detalhe.toUpperCase(),rd:r.rd,classificacao:r.classificacao,keywords:[r.detalhe.toLowerCase()]})),{onConflict:"name"});
              }
              await loadCustomCats();
              showToast(`${rows.length} classificações importadas!`);
            } catch(err){ showToast("Erro: "+err.message,"error"); }
          }}/>
          <button style={{...s.btn("warn"),padding:"9px 14px",fontSize:12}} onClick={async()=>{
            const {data:trans} = await supabase.from("transactions").select("id,date,description,rd,classificacao,subcategoria,conta,origin");
            const {data:freshCats} = await supabase.from("categories").select("*");
            if(!trans) return;
            const diffs = trans.filter(t=>!isCCTransaction(t)).map(t=>{
              const local = localClassify(t.description, freshCats||[]);
              if(!local) return null;
              return (local.r!==t.rd||local.c!==t.classificacao||(local.sub||null)!==(t.subcategoria||null))
                ? {...t, suggestedRd:local.r, suggestedClass:local.c, suggestedSub:local.sub||null} : null;
            }).filter(Boolean);
            if(diffs.length===0){ showToast("Tudo já está conforme as regras."); return; }
            setPendingApply({ruleName:"Reclassificação geral", reeval:true, trans:diffs});
          }}>🔄 Reclassificar</button>
          <button style={s.btn()} onClick={()=>setShowAdd(a=>!a)}>{showAdd?"✕ Cancelar":"+ Nova Classificação"}</button>
        </div>
      </div>


      {confirmDelete&&(
        <div style={s.modal} onClick={()=>setConfirmDelete(null)}>
          <div style={{...s.mbox,maxWidth:440}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:10}}>🗑 Remover classificação?</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:12}}>Remover <strong style={{color:"#E8EDF2"}}>"{confirmDelete.row.detalhe}"</strong> da lista de classificações?</div>
            {confirmDelete.count>0?(
              <div style={{background:"#1a1a2e",border:"1px solid #F5A62344",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#F5A623",marginBottom:20}}>
                ⚠ <strong>{confirmDelete.count} lançamento(s)</strong> usam esta classificação hoje. Eles não serão alterados, mas deixarão de ser reconhecidos automaticamente por esta regra em futuras importações.
              </div>
            ):(
              <div style={{fontSize:12,color:"#6B8299",marginBottom:20}}>Nenhum lançamento usa esta classificação atualmente.</div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setConfirmDelete(null)}>Cancelar</button>
              <button style={{...s.btn("danger"),flex:1}} onClick={()=>{
                const {row,count}=confirmDelete;
                const msg = count>0 ? `Removida. ${count} lançamento(s) não foram alterados.` : "Removida. Nenhum lançamento foi impactado.";
                row.isCustom ? deleteCustom(row.id, msg) : hideBaseClassification(row.detalhe, msg);
                setConfirmDelete(null);
              }}>Remover</button>
            </div>
          </div>
        </div>
      )}

      {pendingApply&&(
        <div style={{...s.card,marginBottom:16,border:"1px solid #00C9A7",padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#00C9A7",marginBottom:3}}>
                {pendingApply.reeval
                  ? `${pendingApply.ruleName} — ${pendingApply.trans.length} lançamento(s) divergem das regras atuais`
                  : `Regra "${pendingApply.ruleName}" salva — ${pendingApply.trans.length} lançamento(s) encontrado(s)`}
              </div>
              <div style={{fontSize:11,color:"#6B8299"}}>
                {pendingApply.reeval
                  ? "Revise as mudanças sugeridas abaixo e aplique se estiverem corretas."
                  : <>Deseja aplicar <strong style={{color:"#E8EDF2"}}>{pendingApply.rd} / {pendingApply.classificacao}</strong> em todos?</>}
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:16}}>
              <button style={{...s.btn(),padding:"7px 16px",fontSize:12}} disabled={applyingRule} onClick={async()=>{
                setApplyingRule(true);
                let error = null;
                if (pendingApply.reeval) {
                  const groups = {};
                  for (const t of pendingApply.trans) {
                    const key = `${t.suggestedRd}|${t.suggestedClass}|${t.suggestedSub||""}`;
                    (groups[key] ||= {rd:t.suggestedRd, classificacao:t.suggestedClass, subcategoria:t.suggestedSub||null, ids:[]}).ids.push(t.id);
                  }
                  for (const g of Object.values(groups)) {
                    const {error:e} = await supabase.from("transactions").update({rd:g.rd,classificacao:g.classificacao,subcategoria:g.subcategoria,needs_review:!g.rd}).in("id",g.ids);
                    if(e) error = e;
                  }
                } else {
                  const ids = pendingApply.trans.map(t=>t.id);
                  ({error} = await supabase.from("transactions").update({rd:pendingApply.rd,classificacao:pendingApply.classificacao,subcategoria:pendingApply.subcategoria||null,needs_review:false}).in("id",ids));
                }
                await loadTransactions?.();
                setApplyingRule(false);
                setPendingApply(pendingApply.next||null);
                if(error) showToast("Erro: "+error.message,"error");
                else showToast(`✓ ${pendingApply.trans.length} lançamento(s) atualizados`);
              }}>{applyingRule?"Aplicando...":"Aplicar em todos"}</button>
              <button style={{...s.btn("ghost"),padding:"7px 16px",fontSize:12}} disabled={applyingRule} onClick={()=>{setPendingApply(pendingApply.next||null);if(!pendingApply.next)showToast("Classificação salva.");}}>Pular</button>
            </div>
          </div>
          <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
            {pendingApply.trans.map(t=>(
              <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,padding:"5px 8px",borderRadius:4,background:"rgba(0,201,167,0.04)",border:"1px solid rgba(0,201,167,0.1)"}}>
                <span style={{color:"#E8EDF2",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{t.date} — {t.description}</span>
                <span style={{marginLeft:12,whiteSpace:"nowrap",flexShrink:0}}>
                  <span style={{color:"#F5A623"}}>{t.rd||"—"} / {t.classificacao||"—"}</span>
                  <span style={{color:"#6B8299",margin:"0 6px"}}>→</span>
                  <span style={{color:"#00C9A7"}}>{pendingApply.reeval?`${t.suggestedRd||"⚠ revisar"} / ${t.suggestedClass||"—"}`:`${pendingApply.rd} / ${pendingApply.classificacao}`}</span>
                </span>
                <button title="Aceitar só este" style={{...s.btn("ghost"),padding:"3px 8px",fontSize:11,marginLeft:8,flexShrink:0}}
                  onClick={async()=>{
                    const rd = pendingApply.reeval?t.suggestedRd:pendingApply.rd;
                    const classificacao = pendingApply.reeval?t.suggestedClass:pendingApply.classificacao;
                    const subcategoria = pendingApply.reeval?(t.suggestedSub||null):(pendingApply.subcategoria||null);
                    const {error} = await supabase.from("transactions").update({rd,classificacao,subcategoria,needs_review:!rd}).eq("id",t.id);
                    if(error){ showToast("Erro: "+error.message,"error"); return; }
                    const remaining = pendingApply.trans.filter(x=>x.id!==t.id);
                    await loadTransactions?.();
                    if(remaining.length>0) setPendingApply({...pendingApply, trans:remaining});
                    else { setPendingApply(pendingApply.next||null); showToast("Lançamento atualizado!"); }
                  }}>✓</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd&&(
        <div style={{...s.card,marginBottom:16,border:"1px solid #00C9A7"}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14,color:"#00C9A7"}}>Nova Classificação</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
            <div>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Descrição</div>
              <input style={{...II,padding:"8px 10px",fontSize:13}} placeholder="Ex: FORNECEDOR SILVA LTDA"
                value={newRow.detalhe} onChange={e=>setNewRow(r=>({...r,detalhe:e.target.value}))}/>
            </div>
            <div>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>R/D</div>
              <select style={{...IS,padding:"8px 10px",fontSize:13}} value={newRow.rd} onChange={e=>setNewRow(r=>({...r,rd:e.target.value}))}>
                {RD_TYPES.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Classificação</div>
              <select style={{...IS,padding:"8px 10px",fontSize:13}} value={newRow.classificacao} onChange={e=>setNewRow(r=>({...r,classificacao:e.target.value}))}>
                {allCls.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Subcategoria</div>
              <input style={{...II,padding:"8px 10px",fontSize:13}} placeholder="Opcional"
                value={newRow.subcategoria||""} onChange={e=>setNewRow(r=>({...r,subcategoria:e.target.value}))}/>
            </div>
            <button style={{...s.btn(),padding:"8px 16px"}} onClick={saveNew} disabled={saving}>{saving?"...":"Salvar"}</button>
          </div>
          <div style={{marginTop:10}}>
            <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Keywords (separadas por vírgula, opcional)</div>
            <input style={{...II,padding:"8px 10px",fontSize:13}} placeholder="Ex: termo1, termo2"
              value={newRow.keywords} onChange={e=>setNewRow(r=>({...r,keywords:e.target.value}))}/>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input style={{...s.input,flex:1,minWidth:200}} placeholder="🔍 Buscar por descrição ou classificação..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={s.sel} value={filterRd} onChange={e=>setFilterRd(e.target.value)}>
          <option value="todos">Todos R/D</option>
          {RD_TYPES.map(r=><option key={r}>{r}</option>)}
        </select>
        <button style={{...s.btn("ghost"),padding:"8px 14px"}} onClick={()=>toggleSort(sortCol)} title="Alternar ordem">
          {sortCol==="detalhe"?"Descrição":sortCol==="rd"?"R/D":sortCol==="classificacao"?"Classificação":"Subcategoria"} {sortDir==="asc"?"↑":"↓"}
        </button>
        <button style={{...s.btn("ghost"),padding:"8px 14px"}} onClick={()=>{setSearch("");setFilterRd("todos");setSortCol("detalhe");setSortDir("asc");}}>Limpar filtros</button>
      </div>

      <div style={{...s.card,padding:0,overflow:"hidden"}}>
        <div style={{overflowY:"auto",maxHeight:"60vh"}}>
        <table style={s.table}>
          <thead style={{position:"sticky",top:0,zIndex:2,background:"#162130"}}>
            <tr>
              {[{l:"Descrição",k:"detalhe"},{l:"R/D",k:"rd"},{l:"Classificação",k:"classificacao"},{l:"Subcategoria",k:"subcategoria"},{l:"Keywords",k:null}].map(({l,k})=>(
                <th key={l} style={{...s.th,cursor:k?"pointer":"default",userSelect:"none",background:"#162130"}}
                  onClick={()=>k&&toggleSort(k)}>
                  {l}{k&&sortCol===k?(sortDir==="asc"?" ↑":" ↓"):""}
                </th>
              ))}
              <th style={{...s.th,width:80,textAlign:"center",background:"#162130"}}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row=>(
              <tr key={row.id} style={row.isCustom?{background:"rgba(0,201,167,0.03)"}:{}}>
                {editingRow?.id===row.id?(
                  <>
                    <td style={s.td}><input style={II} value={editingRow.detalhe} onChange={e=>setEditingRow(r=>({...r,detalhe:e.target.value}))}/></td>
                    <td style={s.td}><select style={IS} value={editingRow.rd} onChange={e=>setEditingRow(r=>({...r,rd:e.target.value}))}>{!editingRow.rd&&<option value="">Selecione...</option>}{RD_TYPES.map(r=><option key={r}>{r}</option>)}</select></td>
                    <td style={s.td}><select style={IS} value={editingRow.classificacao} onChange={e=>setEditingRow(r=>({...r,classificacao:e.target.value}))}>{!editingRow.classificacao&&<option value="">Selecione...</option>}{allCls.map(c=><option key={c}>{c}</option>)}</select></td>
                    <td style={s.td}><input style={II} value={editingRow.subcategoria||""} placeholder="Subcategoria" onChange={e=>setEditingRow(r=>({...r,subcategoria:e.target.value}))}/></td>
                    <td style={s.td}>
                      <input style={II} placeholder="kw1, kw2" value={editingRow.keywordsText??""}
                        onChange={e=>setEditingRow(r=>({...r,keywordsText:e.target.value}))}/>
                    </td>
                    <td style={{...s.td,textAlign:"center"}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        <button style={{...s.btn(),padding:"3px 8px",fontSize:11}} onClick={saveEdit} disabled={saving}>✓</button>
                        <button style={{...s.btn("ghost"),padding:"3px 8px",fontSize:11}} onClick={()=>setEditingRow(null)}>✕</button>
                      </div>
                    </td>
                  </>
                ):(
                  <>
                    <td style={{...s.td,fontWeight:row.isCustom?600:400}}>
                      {row.detalhe}
                    </td>
                    <td style={s.td}><span style={{...s.badge(row.rd),fontSize:10}}>{row.rd}</span></td>
                    <td style={{...s.td,fontSize:12,color:"#6B8299"}}>{row.classificacao}</td>
                    <td style={{...s.td,fontSize:12,color:"#6B8299"}}>{row.subcategoria||<span style={{color:"#3a4a5a"}}>—</span>}</td>
                    <td style={{...s.td,maxWidth:220}}>{row.isCustom&&(row.keywords||[]).length>0?<div style={{display:"flex",flexWrap:"wrap",gap:3,maxHeight:44,overflow:"hidden"}} title={(row.keywords||[]).join(", ")}>{(row.keywords||[]).slice(0,3).map(k=><span key={k} style={{background:"#1E2D3D",color:"#6B8299",borderRadius:20,fontSize:10,padding:"1px 6px",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k}</span>)}{(row.keywords||[]).length>3&&<span style={{fontSize:10,color:"#6B8299"}}>+{(row.keywords||[]).length-3}</span>}</div>:<span style={{color:"#3a4a5a"}}>—</span>}</td>
                    <td style={{...s.td,textAlign:"center"}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        <button style={{...s.btn("ghost"),padding:"3px 8px",fontSize:11}} onClick={()=>setEditingRow({...row,keywordsText:(row.keywords||[]).join(", ")})}>✏</button>
                        <button style={{...s.btn("danger"),padding:"3px 8px",fontSize:11}} onClick={async()=>{
                          const affected = await findAffected([row.detalhe, ...(row.keywords||[])]);
                          setConfirmDelete({row, count:affected.length});
                        }}>✕</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]         = useState(null);
  const [authChecked,setAuthChecked] = useState(false);
  const [tab,setTab]           = useState("fluxo");
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [transactions,setTransactions] = useState([]);
  const [customCats,setCustomCats] = useState([]);
  const [saldoInicial,setSaldoInicial] = useState(0);
  const [hiddenBaseCls,setHiddenBaseCls] = useState([]);
  const [alertCronExpr,setAlertCronExpr] = useState("");
  const [filter,setFilter]     = useState({rd:"todos",classificacao:"todas",status:"todos",dateFrom:"",dateTo:""});
  const [sortDir,setSortDir]   = useState("desc");
  const [confirmDelete,setConfirmDelete] = useState(null);
  const [searchText,setSearchText] = useState("");
  const [sortCol,setSortCol] = useState("date");
  const [drillDown,setDrillDown] = useState(null); // {rd, dateFrom, dateTo, label}
  const [showModal,setShowModal] = useState(false);
  const [modalMode,setModalMode] = useState("lancamento");
  const [form,setForm]         = useState({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});
  const [editingId,setEditingId] = useState(null);
  const [editingRazaoSocial,setEditingRazaoSocial] = useState("");
  const [saldoForm,setSaldoForm] = useState("");
  const [dragOver,setDragOver] = useState(false);
  const [pendingImport,setPendingImport] = useState(null);
  const [reviewItems,setReviewItems] = useState(null);
  const [similarPending,setSimilarPending] = useState(null);
  const [toast,setToast]       = useState(null);
  const [aiLoading,setAiLoading] = useState(false);
  const [saving,setSaving]     = useState(false);
  const [showConfirmClear,setShowConfirmClear] = useState(false);
  const [confirmDeleteBatch,setConfirmDeleteBatch] = useState(null);
  const [confirmDeleteDetail,setConfirmDeleteDetail] = useState(null); // {id, description, count}
  const [fluxoGroupBy,setFluxoGroupBy] = useState("rd");
  const [fluxoGroupOrder,setFluxoGroupOrder] = useState({});
  const [dragGroupIdx,setDragGroupIdx] = useState(null);
  const [agenda,setAgenda]               = useState([]);
  const [agendaOcorrencias,setAgendaOcorrencias] = useState([]);
  const [alertDaysAhead,setAlertDaysAhead]     = useState(3);
  const [alertRecurrence,setAlertRecurrence]   = useState("1");
  const [alertContacts,setAlertContacts]       = useState([]);
  const [contactForm,setContactForm]           = useState({name:"",email:""});
  const [sendingAlert,setSendingAlert]         = useState(false);
  const [agendaMes,setAgendaMes]         = useState(new Date().getMonth()+1);
  const [agendaAno,setAgendaAno]         = useState(new Date().getFullYear());
  const [showAgendaModal,setShowAgendaModal] = useState(false);
  const [editingAgenda,setEditingAgenda] = useState(null);
  const [agendaForm,setAgendaForm]       = useState({nome:"",tipo:"",dia_vencimento:"",keywords:"",rd:"DESPESAS FIXAS",classificacao:""});
  const [kwSuggestions,setKwSuggestions] = useState(null);
  const [reconciliarModal,setReconciliarModal] = useState(null); // {items:[...], mes, ano}
  const [showSemMatchModal,setShowSemMatchModal] = useState(false);
  const [reconciliarSugs,setReconciliarSugs]   = useState({});  // {itemId: [{desc,id,value,date}]}
  const [reclassifyList,setReclassifyList]   = useState(null);
  const [applyingSimilar,setApplyingSimilar] = useState(false);
  const [reclassifySelected,setReclassifySelected] = useState([]);
  const [associating,setAssociating]     = useState(null);
  const [agendaSortCol,setAgendaSortCol] = useState("dia_vencimento");
  const [agendaSortDir,setAgendaSortDir] = useState("asc");
  const [agendaDiaFilter,setAgendaDiaFilter] = useState([]);
  const [showDiaFilter,setShowDiaFilter] = useState(false);
  const [fluxoMonth,setFluxoMonth] = useState("todos");
  const [showAtrasadosModal,setShowAtrasadosModal] = useState(false);
  const [importedHashes,setImportedHashes] = useState(new Set());
  // v3.0 — Transaction details
  const [detailModal,setDetailModal]       = useState(null); // {transaction}
  const [detailItems,setDetailItems]       = useState([]); // items for current detail modal
  const [detailLoading,setDetailLoading]   = useState(false);
  const [detailSaving,setDetailSaving]     = useState(false);
  const [detailPendingFile,setDetailPendingFile] = useState(null); // file aguardando confirmação de tipo
  const [detailSortCol,setDetailSortCol] = useState("date");
  const [detailSortDir,setDetailSortDir] = useState("asc");
  const [transDetailsMap,setTransDetailsMap] = useState({}); // {transaction_id: count}
  // v3.3 — column mapper
  const [columnMapper,setColumnMapper] = useState(null);
  // v3.5 — Extras editáveis
  const [extrasFluxo, setExtrasFluxo] = useState({investimentos:{}, contasReceber:{}});
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [extrasMonthly, setExtrasMonthly] = useState({investimentos:{}, contasReceber:{}});
  const extrasMonthlyRef = React.useRef({investimentos:{}, contasReceber:{}});

  const s = mkS(sidebarOpen);
  const showToast = (msg,kind="success") => { setToast({msg,kind}); setTimeout(()=>setToast(null),3500); };

  const allClassificacoes = useMemo(()=>[...new Set([...CLASSIFICACOES,...customCats.map(c=>c.classificacao||"").filter(Boolean)])].sort(),[customCats]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setUser(data.session?.user??null);setAuthChecked(true);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setUser(s?.user??null));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    const handleEsc = (e) => { if(e.key==="Escape"){ setShowDiaFilter(false); setShowAtrasadosModal(false); setShowSemMatchModal(false); setShowModal(false); } };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  },[]);

  useEffect(()=>{
    if(!user) return;
    loadAll();
    // FIX #5: realtime still useful for multi-user sync
    const ch=supabase.channel("rt").on("postgres_changes",{event:"*",schema:"public",table:"transactions"},loadTransactions).subscribe();
    return ()=>supabase.removeChannel(ch);
  },[user]);


  const loadExtrasFluxo = async () => {
    const {data} = await supabase.from("extras_fluxo").select("*");
    if(data){
      const inv = data.find(d=>d.tipo==="investimentos");
      const rec = data.find(d=>d.tipo==="contas_receber");
      const invM = data.find(d=>d.tipo==="investimentos_mensal");
      const recM = data.find(d=>d.tipo==="contas_receber_mensal");
      setExtrasFluxo({
        investimentos: {todos: inv?.valor||0},
        contasReceber: {todos: rec?.valor||0},
      });
      const monthly = {
        investimentos: invM ? JSON.parse(invM.valor_json||"{}") : {},
        contasReceber: recM ? JSON.parse(recM.valor_json||"{}") : {},
      };
      extrasMonthlyRef.current = monthly;
      setExtrasMonthly(monthly);
    }
  };

  const saveExtraMonthly = async (tipo, mes, val) => {
    const dbTipo = tipo==="investimentos" ? "investimentos_mensal" : "contas_receber_mensal";
    const updated = {...(extrasMonthlyRef.current[tipo]||{}), [mes]: val};
    extrasMonthlyRef.current = {...extrasMonthlyRef.current, [tipo]: updated};
    setExtrasMonthly({...extrasMonthlyRef.current});
    await supabase.from("extras_fluxo").upsert({tipo:dbTipo, valor:0, valor_json:JSON.stringify(updated)},{onConflict:"tipo"});
  };

  const loadAll = () => { loadTransactions(); loadSettings(); loadCustomCats(); loadAgenda(); loadDetailsMap(); loadExtrasFluxo(); loadAlertContacts(); };

  const saveExtraFluxo = async (tipo, val) => {
    const dbTipo = tipo==="investimentos" ? "investimentos" : "contas_receber";
    await supabase.from("extras_fluxo").update({valor:val, updated_at:new Date().toISOString()}).eq("tipo",dbTipo);
    setExtrasFluxo(prev=>({...prev, [tipo]:{todos:val}}));
  };

  const loadTransactions = async () => {
    // FIX #5: order by created_at (reliable) instead of text date field
    const {data}=await supabase.from("transactions").select("*").order("created_at",{ascending:false});
    if(data){
      setTransactions(data);
      setImportedHashes(new Set(data.map(t=>generateHash(t.date,t.description,t.value))));
    }
  };

  const loadSettings = async () => {
    const {data}=await supabase.from("settings").select("*");
    if(data){
      const s=data.find(d=>d.key==="saldo_inicial"); if(s) setSaldoInicial(parseFloat(s.value)||0);
      const ad=data.find(d=>d.key==="alert_days_ahead"); if(ad?.value) setAlertDaysAhead(parseInt(ad.value)||3);
      const ar=data.find(d=>d.key==="alert_recurrence"); if(ar?.value) setAlertRecurrence(ar.value);
      const go=data.find(d=>d.key==="fluxo_group_order"); if(go?.value) try{setFluxoGroupOrder(JSON.parse(go.value));}catch{}
      const hb=data.find(d=>d.key==="hidden_base_classifications"); if(hb?.value) try{setHiddenBaseCls(JSON.parse(hb.value));}catch{}
      const ce=data.find(d=>d.key==="alert_cron_expr"); if(ce?.value) setAlertCronExpr(ce.value);
    }
  };

  const hideBaseClassification = async (name, msg) => {
    const next = [...new Set([...hiddenBaseCls, name])];
    const {error} = await supabase.from("settings").upsert({key:"hidden_base_classifications",value:JSON.stringify(next)},{onConflict:"key"});
    if (error) { console.error("hideBaseClassification erro:", error); showToast("Erro ao remover: "+error.message,"error"); return; }
    setHiddenBaseCls(next);
    showToast(msg||"Removida.");
  };

  const saveFluxoGroupOrder = async (newNames) => {
    const updated = {...fluxoGroupOrder,[fluxoGroupBy]:newNames};
    setFluxoGroupOrder(updated);
    await supabase.from("settings").upsert({key:"fluxo_group_order",value:JSON.stringify(updated)},{onConflict:"key"});
  };

  const loadCustomCats = async () => {
    const {data}=await supabase.from("categories").select("*").order("name");
    if(data) setCustomCats(data);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const metrics = useMemo(()=>{
    const rec = transactions.filter(t=>Number(t.value)>0).reduce((s,t)=>s+Number(t.value),0);
    const des = transactions.filter(t=>Number(t.value)<0).reduce((s,t)=>s+Math.abs(Number(t.value)),0);
    return {rec, des, saldo:saldoInicial+rec-des};
  },[transactions,saldoInicial]);

  const forecast = useMemo(()=>generateForecast(transactions),[transactions]);

  const filtered = useMemo(()=>{
    let list=transactions.filter(t=>!isCCTransaction(t));
    // drillDown overrides filter when set
    if(drillDown){
      if(drillDown.rd) list=list.filter(t=>t.rd===drillDown.rd);
      if(drillDown.dateFrom) list=list.filter(t=>dateToSortable(t.date)>=drillDown.dateFrom);
      if(drillDown.dateTo)   list=list.filter(t=>dateToSortable(t.date)<=drillDown.dateTo);
    } else {
      if(filter.rd!=="todos")           list=list.filter(t=>t.rd===filter.rd);
      if(filter.classificacao!=="todas") list=list.filter(t=>t.classificacao===filter.classificacao);
      if(filter.status==="nao_classificados") list=list.filter(t=>t.needs_review||!t.classificacao||!t.rd);
      if(filter.dateFrom)                list=list.filter(t=>dateToSortable(t.date)>=filter.dateFrom);
      if(filter.dateTo)                  list=list.filter(t=>dateToSortable(t.date)<=filter.dateTo);
    }
    list.sort((a,b)=>{
      if(sortCol==="value"){
        const va=Number(a.value), vb=Number(b.value);
        return sortDir==="asc"?va-vb:vb-va;
      }
      let va="", vb="";
      if(sortCol==="date"){va=dateToSortable(a.date)||"";vb=dateToSortable(b.date)||"";}
      else if(sortCol==="description"){va=a.description||"";vb=b.description||"";}
      else if(sortCol==="razao_social"){va=a.razao_social||"";vb=b.razao_social||"";}
      else if(sortCol==="rd"){va=a.rd||"";vb=b.rd||"";}
      else if(sortCol==="classificacao"){va=a.classificacao||"";vb=b.classificacao||"";}
      else if(sortCol==="conta"){va=a.conta||"";vb=b.conta||"";}
      else if(sortCol==="subcategoria"){
        const ae=!a.subcategoria, be=!b.subcategoria;
        if(ae&&be) return 0;
        if(ae) return sortDir==="asc"?1:-1;
        if(be) return sortDir==="asc"?-1:1;
        va=a.subcategoria; vb=b.subcategoria;
      }
      else{va=dateToSortable(a.date)||"";vb=dateToSortable(b.date)||"";}
      return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);
    });
    if(searchText.trim()){
      const q=searchText.toLowerCase();
      list=list.filter(t=>
        (t.description||"").toLowerCase().includes(q)||
        (t.rd||"").toLowerCase().includes(q)||
        (t.classificacao||"").toLowerCase().includes(q)||
        (t.conta||"").toLowerCase().includes(q)||
        (t.date||"").includes(q)||
        String(Math.abs(Number(t.value))).includes(q)
      );
    }
    return list;
  },[transactions,filter,sortDir,sortCol,drillDown,searchText]);

  const fluxoData = useMemo(()=>{
    let list=transactions;
    if(fluxoMonth!=="todos") list=list.filter(t=>{
      const p=t.date?.split("/"); return p?.length===3&&parseInt(p[1])===parseInt(fluxoMonth);
    });
    const groups={};
    list.forEach(t=>{
      let key;
      if(fluxoGroupBy==="rd") key=t.rd||"Não classificado";
      else if(fluxoGroupBy==="classificacao") key=t.classificacao||"Não classificado";
      else { const p=t.date?.split("/"); key=p?.length===3?MONTHS[parseInt(p[1])-1]:"Sem data"; }
      if(!groups[key]) groups[key]={total:0,count:0,rdCounts:{}};
      groups[key].total+=Number(t.value); groups[key].count++;
      const rdKey=t.rd||"—";
      groups[key].rdCounts[rdKey]=(groups[key].rdCounts[rdKey]||0)+1;
    });
    Object.values(groups).forEach(g=>{
      g.dominantRd = Object.entries(g.rdCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    });
    const order = fluxoGroupOrder[fluxoGroupBy] || [];
    return Object.entries(groups).sort((a,b)=>{
      const ia=order.indexOf(a[0]), ib=order.indexOf(b[0]);
      if(ia===-1&&ib===-1) return Math.abs(b[1].total)-Math.abs(a[1].total);
      if(ia===-1) return 1;
      if(ib===-1) return -1;
      return ia-ib;
    });
  },[transactions,fluxoGroupBy,fluxoMonth,fluxoGroupOrder]);

  // ── Classify & save ────────────────────────────────────────────────────────
  const classifyAndSave = async (rows, fileName="", isCreditCard=false) => {
    setAiLoading(true);
    const toSave=[], toReview=[];
    for (const row of rows) {
      if(importedHashes.has(generateHash(row.date,row.description,row.value))) continue;
      const local = localClassify(row.description, customCats);
      if (local) {
        toSave.push({...row, conta:isCreditCard?"CC/"+(row.conta||""):(row.conta||null), type:Number(row.value)>=0?"entrada":"saída", rd:local.r, classificacao:local.c, subcategoria:local.sub||null, status:"confirmado", origin:isCreditCard?"fatura":"extrato", ai_classified:false, needs_review:false, created_by:user.id, source_file:fileName||null});
      } else {
        const ai = await classifyWithGemini(row.description);
        if (ai) {
          toSave.push({...row, conta:isCreditCard?"CC/"+(row.conta||""):(row.conta||null), type:Number(row.value)>=0?"entrada":"saída", rd:ai.rd, classificacao:ai.classificacao, status:"confirmado", origin:isCreditCard?"fatura":"extrato", ai_classified:true, needs_review:false, created_by:user.id, source_file:fileName||null});
        } else {
          toReview.push({...row, conta:isCreditCard?"CC/"+(row.conta||""):(row.conta||null), type:Number(row.value)>=0?"entrada":"saída", rd:Number(row.value)>=0?"RECEITA":"DESPESAS VARIÁVEIS", classificacao:Number(row.value)>=0?"RECEITA DE VENDAS":"DESPESAS ADMINISTRATIVAS", status:"pendente", origin:isCreditCard?"fatura":"extrato", ai_classified:true, needs_review:true, created_by:user.id, source_file:fileName||null});
        }
      }
    }
    // Insert in batches of 50
    for(let i=0;i<toSave.length;i+=50){
      const {error}=await supabase.from("transactions").insert(toSave.slice(i,i+50));
      if(error) console.error("Insert error:",error);
    }
    setAiLoading(false);
    if(toReview.length){
      setReviewItems(toReview);
    } else {
      showToast(`${toSave.length} lançamentos importados!`);
      setPendingImport(null);
      setTab("lancamentos");
    }
  };

  // ── Agenda functions ─────────────────────────────────────────────────────
  const loadAgenda = async () => {
    const {data:ag} = await supabase.from("agenda").select("*").order("dia_vencimento");
    if (ag) setAgenda(ag);
    const {data:oc} = await supabase.from("agenda_ocorrencias").select("*");
    if (oc) setAgendaOcorrencias(oc);
  };

  // v3.0 — load details count map (which transactions have details)
  const loadDetailsMap = async () => {
    const {data} = await supabase.from("transaction_details").select("transaction_id");
    if (data) {
      const map = {};
      data.forEach(d => { map[d.transaction_id] = (map[d.transaction_id]||0)+1; });
      setTransDetailsMap(map);
    }
  };

  const openDetailModal = async (t) => {
    setDetailModal(t);
    setDetailLoading(true);
    const {data} = await supabase.from("transaction_details").select("*").eq("transaction_id",t.id).order("date");
    setDetailItems(data||[]);
    setDetailLoading(false);
  };

  const handleDetailFile = async (file, transaction) => {
    setDetailPendingFile(null);
    await openColumnMapper(file, "detalhe", transaction);
  };

  const processDetailFile = async (file, transaction, isCartao) => {
    setDetailPendingFile(null);
    await openColumnMapper(file, "detalhe", transaction);
    // isCartao will be set in the mapper UI
  };

  const saveDetailItems = async () => {
    if (!detailModal) return;
    setDetailSaving(true);
    await supabase.from("transaction_details").delete().eq("transaction_id",detailModal.id);
    const toInsert = detailItems.map(({transaction_id,date,description,value,rd,classificacao,subcategoria,keywords,ai_classified,needs_review})=>
      ({transaction_id,date,description,value,rd,classificacao,subcategoria:subcategoria||null,keywords:keywords?.length?keywords:null,ai_classified,needs_review}));
    for(let i=0;i<toInsert.length;i+=50){
      const {error} = await supabase.from("transaction_details").insert(toInsert.slice(i,i+50));
      if(error){ showToast("Erro ao salvar: "+error.message,"error"); setDetailSaving(false); return; }
    }
    await loadDetailsMap();
    showToast(`${toInsert.length} itens salvos!`);
    setDetailSaving(false);
    setDetailModal(null);
  };

  const updateDetailItem = (idx, field, val) => {
    setDetailItems(prev => prev.map((item,i) => i===idx ? {...item,[field]:val,needs_review:false} : item));
  };

  const getOcorrencia = (agendaId, mes, ano) =>
    agendaOcorrencias.find(o=>o.agenda_id===agendaId&&o.mes===mes&&o.ano===ano);

  const reconcileAgenda = async (mes, ano) => {
    showToast("Reconciliando...", "success");
    try {
      let jaResolvidos = 0;
      const pendentes = [];
      for (const item of agenda) {
        if (!item.ativo) continue;
        const oc = getOcorrencia(item.id, mes, ano);
        if (oc?.status==="pago"||oc?.status==="baixado") { jaResolvidos++; continue; }
        const keywords = item.keywords||[];
        const match = keywords.length>0 ? transactions.find(t=>{
          const p=t.date?.split("/");
          if(!p||p.length<3) return false;
          if(parseInt(p[1])!==mes||parseInt(p[2])!==ano) return false;
          return keywords.some(k=>
            t.description?.toUpperCase().includes(k.toUpperCase()) ||
            (t.subcategoria&&t.subcategoria.toUpperCase().includes(k.toUpperCase()))
          );
        }) : null;
        pendentes.push({item, match});
      }
      const results = await Promise.all(pendentes.map(({item, match}) =>
        supabase.from("agenda_ocorrencias").upsert({
          agenda_id:item.id, mes, ano,
          status: match?"pago":"pendente",
          transaction_id: match?.id||null,
          data_pagamento: match?.date||null,
          valor_pago: match?Math.abs(Number(match.value)):null,
        },{onConflict:"agenda_id,mes,ano"})
      ));
      const firstError = results.find(r=>r.error);
      if (firstError) throw firstError.error;
      let reconciliados = 0;
      const semMatchItems = [];
      pendentes.forEach(({item, match})=>{ if(match) reconciliados++; else semMatchItems.push(item); });
      await loadAgenda();
      // Salva itens sem match para o botão lateral
      if (semMatchItems.length>0) {
        setReconciliarModal({items: semMatchItems, mes, ano});
      } else {
        setReconciliarModal(null);
        setReconciliarSugs({});
      }
      const semMatch = semMatchItems.length;
      const msg = reconciliados>0
        ? `✅ ${reconciliados} reconciliado(s)${semMatch>0?` · ⚠️ ${semMatch} sem lançamento`:""}${jaResolvidos>0?` · ${jaResolvidos} já resolvidos`:""}`
        : semMatch>0
          ? `⚠️ ${semMatch} item(s) sem lançamento${jaResolvidos>0?` · ${jaResolvidos} já resolvidos`:""}`
          : `ℹ️ Todos os ${jaResolvidos} itens já estavam resolvidos`;
      showToast(msg, reconciliados>0?"success":"warning");
    } catch(e) {
      console.error("Reconciliar erro:", e);
      showToast("Erro ao reconciliar: " + (e?.message||"verifique o console"), "error");
    }
  };

  // Espelha exatamente a lógica da edge function send-alerts (atrasados + a vencer)
  const getAlertaItems = () => {
    const today = new Date();
    const mes = today.getMonth()+1, ano = today.getFullYear(), todayDay = today.getDate();
    const DONE = ["pago","baixado"];
    const map = new Map();
    agendaOcorrencias.forEach(oc=>{
      if(DONE.includes(oc.status)) return;
      if(oc.ano>ano || (oc.ano===ano && oc.mes>=mes)) return;
      const item = agenda.find(a=>a.id===oc.agenda_id);
      if(!item) return;
      const key = `${item.id}_${oc.mes}_${oc.ano}`;
      if(!map.has(key)) map.set(key,{...item, checkMes:oc.mes, checkAno:oc.ano, retroativo:true});
    });
    agenda.filter(a=>a.ativo).forEach(item=>{
      const oc = agendaOcorrencias.find(o=>o.agenda_id===item.id&&o.mes===mes&&o.ano===ano);
      if(oc && DONE.includes(oc.status)) return;
      const daysDiff = item.dia_vencimento - todayDay;
      if(daysDiff<0 || daysDiff<=alertDaysAhead){
        const key = `${item.id}_${mes}_${ano}`;
        if(!map.has(key)) map.set(key,{...item, checkMes:mes, checkAno:ano, daysUntil:daysDiff});
      }
    });
    return [...map.values()].sort((a,b)=>(a.daysUntil??-9999)-(b.daysUntil??-9999));
  };

  const saveAgendaItem = async () => {
    if (!agendaForm.nome.trim()||!agendaForm.dia_vencimento) {
      showToast("Nome e dia obrigatórios.","error"); return;
    }
    const keywords = agendaForm.keywords.split(",").map(k=>k.trim()).filter(Boolean);
    const payload = {
      nome:agendaForm.nome.trim(), tipo:agendaForm.tipo.trim(),
      dia_vencimento:parseInt(agendaForm.dia_vencimento),
      keywords, rd:agendaForm.rd, classificacao:agendaForm.classificacao, ativo:true,
    };
    if (editingAgenda) {
      await supabase.from("agenda").update(payload).eq("id",editingAgenda);
      const affected = transactions.filter(t=>
        keywords.some(k=>t.description?.toUpperCase().includes(k.toUpperCase()))
      );
      if (affected.length>0) {
        setReclassifyList({items:affected,rd:agendaForm.rd,classificacao:agendaForm.classificacao});
        setReclassifySelected(affected.map(t=>t.id));
      } else showToast("Compromisso atualizado!");
    } else {
      await supabase.from("agenda").insert(payload);
      showToast("Compromisso adicionado!");
    }
    await loadAgenda();
    setShowAgendaModal(false); setEditingAgenda(null);
    setAgendaForm({nome:"",tipo:"",dia_vencimento:"",keywords:"",rd:"DESPESAS FIXAS",classificacao:""});
  };

  const applyReclassify = async () => {
    const {error} = await supabase.from("transactions").update({
      rd:reclassifyList.rd, classificacao:reclassifyList.classificacao,
    }).in("id",reclassifySelected);
    if(error){ showToast("Erro: "+error.message,"error"); return; }
    showToast(reclassifySelected.length+" lançamento(s) reclassificado(s)!");
    setReclassifyList(null); setReclassifySelected([]);
    await loadTransactions();
  };

  const associateTransaction = async (ocId, transactionId) => {
    const t = transactions.find(x=>x.id===transactionId);
    if (!t) return;
    await supabase.from("agenda_ocorrencias").update({
      status:"pago", transaction_id:transactionId,
      data_pagamento:t.date, valor_pago:Math.abs(Number(t.value)),
    }).eq("id",ocId);
    await loadAgenda(); setAssociating(null);
    showToast("Lançamento associado!");
  };

  // ── Manual entry — FIX #3: operator precedence ────────────────────────────
  const saveManual = async () => {
    if(!form.date||!form.description||!form.value){ showToast("Preencha todos os campos.","error"); return; }
    const val = parseValue(form.value);
    if(isNaN(val)){ showToast("Valor inválido — use vírgula para decimais (ex: 1.234,56).","error"); return; }
    setSaving(true);
    const payload={date:form.date,description:form.description,value:val,type:val>=0?"entrada":"saída",rd:form.rd,classificacao:form.classificacao,conta:form.conta,subcategoria:form.subcategoria||null,status:"confirmado",origin:"manual",ai_classified:false,needs_review:false,created_by:user.id};
    try{
    if(editingId){
      const {error:updErr} = await supabase.from("transactions").update(payload).eq("id",editingId);
      if(updErr) throw updErr;
      // After editing, find other transactions with similar description that have different classification
      const {data:all} = await supabase.from("transactions").select("id,date,description,rd,classificacao,conta,origin");
      const editedMerchant = merchantKey(form.description);
      const similar = (all||[]).filter(t =>
        t.id !== editingId &&
        !isCCTransaction(t) &&
        descSimilar(merchantKey(t.description), editedMerchant) &&
        (t.rd !== form.rd || t.classificacao !== form.classificacao || (t.subcategoria||null) !== (form.subcategoria||null))
      ).map(t=>({...t,suggestedRd:form.rd,suggestedClass:form.classificacao,suggestedSub:form.subcategoria||null}));
      // Populate keyword for future auto-classification
      try {
        const kwEntry = merchantKey(form.description).toLowerCase();
        if (kwEntry && form.rd && form.classificacao) {
          const existing = customCats.find(c => c.name?.toLowerCase()===kwEntry || (c.keywords||[]).includes(kwEntry));
          const merged = [...new Set([...(existing?.keywords||[]),kwEntry])];
          await supabase.from("categories").upsert({
            name: existing?.name||kwEntry.toUpperCase(),
            rd: form.rd, classificacao: form.classificacao,
            subcategoria: form.subcategoria||existing?.subcategoria||null,
            keywords: merged,
          },{onConflict:"name"});
          await loadCustomCats();
        }
      } catch(e){ console.error("KW populate:",e); }
      setForm({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});
      setEditingId(null); setShowModal(false); setSaving(false);
      if(similar.length>0){
        setSimilarPending({items:similar,count:1,subcategoria:form.subcategoria||null});
      } else {
        showToast("Lançamento atualizado!");
      }
    } else {
      const {error:insErr} = await supabase.from("transactions").insert(payload);
      if(insErr) throw insErr;
      showToast("Lançamento adicionado!");
      setForm({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});
      setEditingId(null); setShowModal(false); setSaving(false);
    }
    } catch(e){
      console.error("saveManual erro:",e);
      showToast("Erro ao salvar: "+(e?.message||"verifique o console"),"error");
      setSaving(false);
    }
  };

  const startEdit = (t) => {
    setForm({date:t.date,description:t.description,value:String(Number(t.value)).replace(".",","),rd:t.rd||"RECEITA",classificacao:t.classificacao||"",conta:t.conta||"",subcategoria:t.subcategoria||""});
    setEditingRazaoSocial(t.razao_social||"");
    setEditingId(t.id); setModalMode("lancamento"); setShowModal(true);
  };

  // ── Column mapper — v3.3 ─────────────────────────────────────────────────
  const openColumnMapper = async (file, mode, transaction=null) => {
    try {
      let headers = [], preview = [], allRows = [];
      const isXlsx = file.name.match(/\.(xlsx|xls)$/i);
      if (isXlsx) {
        if (!window.XLSX) {
          await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});
        }
        const buf = await file.arrayBuffer();
        const wb = window.XLSX.read(buf,{type:"array",sheetRows:0});
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Read cell by cell to avoid truncation on null numeric cells
        const ref = ws['!ref'] ? window.XLSX.utils.decode_range(ws['!ref']) : {s:{r:0,c:0},e:{r:0,c:0}};
        // Expand range using all cell keys
        Object.keys(ws).filter(k=>!k.startsWith('!')).forEach(k=>{
          const a=window.XLSX.utils.decode_cell(k);
          if(a.r>ref.e.r) ref.e.r=a.r;
          if(a.c>ref.e.c) ref.e.c=a.c;
        });
        for(let r=ref.s.r;r<=ref.e.r;r++){
          const row=[];
          for(let c=ref.s.c;c<=ref.e.c;c++){
            const cell=ws[window.XLSX.utils.encode_cell({r,c})];
            row.push(cell&&cell.v!=null?String(cell.v):"");
          }
          allRows.push(row);
        }
      } else {
        const text = await file.text();
        const cleaned = text.replace(/^\uFEFF/,"");
        const lines = cleaned.split(/\r?\n/).filter(l=>l.trim());
        const sep = lines[0].includes(";") ? ";" : ",";
        allRows = lines.map(l=>l.split(sep).map(c=>c.replace(/"/g,"").trim()));
      }
      // Find best header row
      let hi = 0, bestScore = 0;
      for(let i=0;i<Math.min(30,allRows.length);i++){
        const row = allRows[i];
        const filled = row.filter(c=>String(c).trim()).length;
        if(filled < 2) continue;
        let dateScore = 0;
        for(let j=i+1;j<Math.min(i+4,allRows.length);j++){
          const nextRow = allRows[j];
          const firstFilled = nextRow.find(c=>String(c).trim());
          if(firstFilled && /^\d{2}\/\d{2}/.test(String(firstFilled))) dateScore+=2;
        }
        const textCells = row.filter(c=>isNaN(Number(String(c).replace(/[,\.]/g,"")))&&String(c).trim()&&!/^\d{2}\/\d{2}/.test(String(c))).length;
        const score = dateScore * 3 + textCells;
        if(score > bestScore){ bestScore = score; hi = i; }
      }
      headers = allRows[hi].map((c,i)=>String(c).trim()||`col ${i}`);
      preview = allRows.slice(hi+1,hi+4).map(r=>headers.map((_,i)=>String(r[i]||"")));
      const normHeader = s=>String(s).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
      const guessCol = (aliases, fallback=0) => {
        const idx = headers.findIndex(h=>aliases.some(a=>normHeader(h).includes(normHeader(a))));
        return idx >= 0 ? idx : fallback;
      };
      const autoDate = guessCol(["DATA","DATE","DT","DT_MOV","DATA_MOV"]);
      const autoDesc = guessCol(["ESTABELECIMENTO","HISTORICO","DESCRICAO","DESCRIPTION","LANCAMENTO","COMPLEMENTO"]);
      const autoVal  = guessCol(["VALOR","VALUE","AMOUNT","VLR"]);
      const autoConta= guessCol(["CONTA","ACCOUNT","CONTA_CORRENTE","AGENCIA"]);
      const autoRazaoSocial = guessCol(["RAZAO SOCIAL","RAZÃO SOCIAL","FAVORECIDO","NOME FAVORECIDO"], -1);
      let autoContaValue = "";
      for(let i=0;i<Math.min(hi,allRows.length);i++){
        const rowText = allRows[i].map(c=>String(c||"")).join(";");
        const m = rowText.match(/(?:conta|account|n[ºo°]\.?\s*conta|numero\s*conta|ag[eê]ncia\/conta|ag\/conta)[:\s;]+([0-9\-\/\.]+)/i);
        if(m) { autoContaValue = m[1].trim(); break; }
      }
      setColumnMapper({file, headers, preview, allRows, headerIdx:hi, mode, transaction,
        map:{date:autoDate, desc:autoDesc, val:autoVal, conta:autoConta, razaoSocial:autoRazaoSocial},
        autoContaValue,
        isCartao: mode==="detalhe",
      });
    } catch(e) {
      showToast("Erro ao ler arquivo: "+e.message,"error");
    }
  };

  const processColumnMapper = async () => {
    if(!columnMapper) return;
    const {file, allRows, headerIdx, mode, transaction, map, isCartao, autoContaValue} = columnMapper;
    const yearMatches = file.name.match(/\d{4}/g);
    const inferredYear = yearMatches ? yearMatches[yearMatches.length-1] : String(new Date().getFullYear());
    const rawRows = allRows.slice(headerIdx+1);
    const parsed = rawRows.map(cols=>{
      const rawDate = String(cols[map.date]||"").trim();
      const rawDesc = String(cols[map.desc]||"").trim();
      const rawVal  = cols[map.val];
      const rawConta= autoContaValue || "";
      const rawRazaoSocial = map.razaoSocial>=0 ? String(cols[map.razaoSocial]||"").trim() : "";
      if(!rawDesc) return null;
      // Parse date: DD/MM, DD/MM/YYYY, or Excel serial
      let date = "";
      if(/^\d{2}\/\d{2}$/.test(rawDate)) {
        date = `${rawDate}/${inferredYear}`;
      } else if(/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
        date = rawDate;
      } else if(typeof rawDate==="number"||/^\d{5}$/.test(rawDate)) {
        const d=new Date(Math.round((Number(rawDate)-25569)*86400*1000));
        date=`${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
      } else {
        date = parseDate(rawDate);
      }
      if(!date||!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return null;
      let val = parseValue(rawVal);
      if(isNaN(val)||val===0) return null;
      // Cartão: positivos viram negativos (despesas), negativos ficam positivos (estornos/créditos)
      if(isCartao) val = -val;
      return {date, description:rawDesc, value:val, conta:rawConta, razao_social:rawRazaoSocial||null};
    }).filter(Boolean);

    setColumnMapper(null);

    if(mode==="extrato"){
      if(!parsed.length){showToast("Nenhum lançamento encontrado.","error");return;}
      const newRows = parsed.filter(r=>!importedHashes.has(generateHash(r.date,r.description,r.value)));
      setPendingImport({fileName:file.name,rows:parsed,newRows,dups:parsed.length-newRows.length,isCreditCard:isCartao||false});
      setTab("importar");
    } else {
      // detalhe
      if(!parsed.length){showToast("Nenhum item encontrado.","error");return;}
      setDetailLoading(true);
      const items = parsed.map(row=>{
        const local = localClassify(row.description, customCats);
        return {transaction_id:transaction.id,date:row.date,description:row.description,value:row.value,rd:local?.r||"",classificacao:local?.c||"",subcategoria:local?.sub||null,ai_classified:false,needs_review:!local};
      });
      setDetailItems(items);
      setDetailLoading(false);
    }
  };

  // ── File import ────────────────────────────────────────────────────────────
  const handleFile = useCallback((file)=>{
    if(!file) return;
    openColumnMapper(file, "extrato");
  },[importedHashes]);

  const confirmReview = async (reviewed) => {
    const rows = reviewed.map(r=>({...r,type:Number(r.value)>=0?"entrada":"saída",needs_review:false,status:"confirmado"}));
    for(let i=0;i<rows.length;i+=50){
      await supabase.from("transactions").insert(rows.slice(i,i+50));
    }
    // Auto-add keyword: register description in categories so future imports classify automatically
    for (const r of reviewed) {
      if (!r.rd || !r.classificacao) continue;
      const desc = String(r.description).toUpperCase().trim();
      const match = customCats.find(c => c.rd===r.rd && c.classificacao===r.classificacao &&
        (desc.includes((c.name||"").toUpperCase()) || (c.keywords||[]).some(k=>k&&desc.includes(k.toUpperCase()))));
      const kwEntry = r.description.toLowerCase().trim();
      if (match) {
        const existing = (match.keywords||[]).map(k=>k.toLowerCase());
        if (!existing.includes(kwEntry) && match.name.toLowerCase()!==kwEntry)
          await supabase.from("categories").update({keywords:[...(match.keywords||[]),kwEntry]}).eq("id",match.id);
      } else {
        await supabase.from("categories").upsert({name:desc,rd:r.rd,classificacao:r.classificacao,keywords:[kwEntry]},{onConflict:"name"});
      }
    }
    // Find other unclassified transactions similar to the ones just reviewed
    const {data:similar} = await supabase.from("transactions").select("id,date,description,rd,classificacao,conta,origin").eq("needs_review",true);
    const hits = (similar||[]).filter(t=>!isCCTransaction(t)).map(t=>{
      const td = String(t.description).toUpperCase();
      const match = reviewed.find(r=>{
        const words = String(r.description).toUpperCase().split(/\s+/).filter(w=>w.length>3);
        return words.some(w=>td.includes(w));
      });
      return match ? {...t,suggestedRd:match.rd,suggestedClass:match.classificacao} : null;
    }).filter(Boolean);
    await loadCustomCats();
    setReviewItems(null);
    setPendingImport(null);
    if (hits.length) {
      setSimilarPending({items:hits, count:rows.length});
    } else {
      showToast(`${rows.length} lançamentos revisados e salvos!`);
      setTab("lancamentos");
    }
  };

  const cancelReview = () => { setReviewItems(null); setPendingImport(null); };

  const confirmSimilarPending = async (apply) => {
    if (apply) {
      setApplyingSimilar(true);
      const rd = similarPending.items[0]?.suggestedRd;
      const cls = similarPending.items[0]?.suggestedClass;
      // Group by (rd, classificacao, sub) to update each group in a single batch call
      const groups = {};
      for (const t of similarPending.items) {
        const sub = t.suggestedSub||similarPending.subcategoria||null;
        const key = `${t.suggestedRd}|${t.suggestedClass}|${sub||""}`;
        (groups[key] ||= {rd:t.suggestedRd, classificacao:t.suggestedClass, subcategoria:sub, ids:[]}).ids.push(t.id);
      }
      for (const g of Object.values(groups))
        await supabase.from("transactions").update({rd:g.rd,classificacao:g.classificacao,subcategoria:g.subcategoria,needs_review:false,status:"confirmado"}).in("id",g.ids);
      // Populate keywords so future imports classify automatically
      try {
        if (rd && cls) {
          const newKws = [...new Set(similarPending.items.map(t=>merchantKey(t.description).toLowerCase()).filter(Boolean))];
          for (const kw of newKws) {
            const existing = customCats.find(c => c.name?.toLowerCase()===kw || (c.keywords||[]).includes(kw));
            const merged = [...new Set([...(existing?.keywords||[]),kw])];
            await supabase.from("categories").upsert({
              name: existing?.name||kw.toUpperCase(),
              rd, classificacao: cls,
              subcategoria: similarPending.subcategoria||existing?.subcategoria||null,
              keywords: merged,
            },{onConflict:"name"});
          }
          await loadCustomCats();
        }
      } catch(e){ console.error("KW populate:",e); }
      await loadTransactions();
      setApplyingSimilar(false);
      showToast(`${similarPending.items.length} transações classificadas e keywords atualizadas!`);
    } else {
      showToast("Lançamento salvo.");
    }
    setSimilarPending(null);
  };

  const saveSaldoInicial = async () => {
    const v=parseValue(saldoForm);
    if(isNaN(v)){ showToast("Valor inválido.","error"); return; }
    await supabase.from("settings").upsert({key:"saldo_inicial",value:String(v)},{onConflict:"key"});
    setSaldoInicial(v); setSaldoForm(""); setShowModal(false); showToast("Registro Incluído com Sucesso");
  };

  const deleteT = (id) => setConfirmDelete(id);
  const doDelete = async () => {
    if (!confirmDelete) return;
    if (String(confirmDelete).startsWith("agenda_")) {
      const agendaId = String(confirmDelete).replace("agenda_","");
      await supabase.from("agenda_ocorrencias").delete().eq("agenda_id",agendaId);
      await supabase.from("agenda").delete().eq("id",agendaId);
      await loadAgenda();
    } else {
      const {error} = await supabase.from("transactions").delete().eq("id",confirmDelete);
      if(error){ showToast("Erro ao excluir: "+error.message,"error"); setConfirmDelete(null); return; }
      setTransactions(prev=>prev.filter(t=>t.id!==confirmDelete));
      showToast("Lançamento excluído!");
    }
    setConfirmDelete(null);
  };
  const doDeleteBatch = async () => {
    if(!confirmDeleteBatch) return;
    const ids = confirmDeleteBatch.ids;
    for(let i=0;i<ids.length;i+=50){
      await supabase.from("transactions").delete().in("id",ids.slice(i,i+50));
    }
    setTransactions(prev=>prev.filter(t=>!ids.includes(t.id)));
    setConfirmDeleteBatch(null);
    showToast(`${ids.length} lançamentos removidos.`);
  };
  const loadAlertContacts = async () => {
    const {data}=await supabase.from("alert_contacts").select("*").eq("user_id",user.id).order("name");
    if(data) setAlertContacts(data);
  };

  const addContact = async () => {
    if(!contactForm.name||!contactForm.email){ showToast("Preencha nome e e-mail","error"); return; }
    await supabase.from("alert_contacts").insert({user_id:user.id, name:contactForm.name, phone:contactForm.email});
    setContactForm({name:"",email:""});
    await loadAlertContacts();
    showToast("Destinatário adicionado!");
  };

  const removeContact = async (id) => {
    await supabase.from("alert_contacts").delete().eq("id",id);
    await loadAlertContacts();
  };

  const saveAlertDays = async (days) => {
    setAlertDaysAhead(days);
    const {error} = await supabase.from("settings").upsert({key:"alert_days_ahead",value:String(days)},{onConflict:"key"});
    if(error) showToast("Erro ao salvar antecedência: "+error.message,"error");
    else showToast(`Antecedência atualizada: ${days} dia(s)`);
  };

  // Monta a expressão cron a partir da recorrência escolhida no Fluxo de Caixa — a origem da decisão é sempre aqui, nunca fixa no banco
  const buildAlertCron = (recurrence) => {
    const hoursByRecurrence = {"1":[8], "2":[8,18], "3":[8,13,18]};
    const hours = hoursByRecurrence[recurrence] || [8];
    return `0 ${hours.join(",")} * * *`;
  };

  const saveAlertRecurrence = async (val) => {
    setAlertRecurrence(val);
    await supabase.from("settings").upsert({key:"alert_recurrence",value:val},{onConflict:"key"});
    const cronExpr = buildAlertCron(val);
    await supabase.from("settings").upsert({key:"alert_cron_expr",value:cronExpr},{onConflict:"key"});
    const {error} = await supabase.rpc("manage_alert_schedule", {p_cron: cronExpr});
    if (error) showToast("Erro ao agendar: "+error.message,"error");
    else showToast(`Agendamento atualizado: ${val}x/dia`);
  };

  const sendAlertsNow = async () => {
    setSendingAlert(true);
    try {
      const {error} = await supabase.functions.invoke("send-alerts");
      if(error) showToast("Erro ao enviar: "+error.message,"error");
      else showToast("Alertas enviados com sucesso!");
    } catch(e){ showToast("Erro: "+e.message,"error"); }
    setSendingAlert(false);
  };

  const clearAll = async () => {
    await supabase.from("transactions").delete().neq("id","00000000-0000-0000-0000-000000000000");
    await supabase.from("settings").upsert({key:"saldo_inicial",value:"0"});
    setSaldoInicial(0); setShowConfirmClear(false); showToast("Todos os dados apagados.");
  };

  // ── Render guard ──────────────────────────────────────────────────────────
  if(!authChecked) return <div style={{background:"#0F1923",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#6B8299",fontFamily:"Inter,sans-serif"}}>Carregando...</div>;
  if(!user) return <LoginScreen onLogin={setUser}/>;

  const navItems=[
    {id:"fluxo",        icon:"⊟", label:"Fluxo de Caixa"},
    {id:"lancamentos",  icon:"≡", label:"Lançamentos"},
    {id:"importar",     icon:"↑", label:"Importar Extrato"},
    {id:"forecast",     icon:"∿", label:"Forecast"},
    {id:"projecao",     icon:"↗", label:"Projeção"},
    {id:"classificacoes",icon:"⊞",label:"Classificações"},
    {id:"agenda",       icon:"📅",label:"Agenda"},
    {id:"operacional",  icon:"⚙", label:"Operacional"},
    {id:"analise",      icon:"📊", label:"Análise"},
  ];

  const rdColor={RECEITA:"#2ECC71","DESPESAS FIXAS":"#E8445A","DESPESAS VARIÁVEIS":"#FF7A7A",MOVIMENTAÇÃO:"#6B8299",INVESTIMENTOS:"#00C9A7","DESPESA FINANCEIRA":"#F5A623","SALDO INICIAL":"#6B8299"};

  return (
    <div style={s.app}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0F1923; margin: 0; padding: 0; overflow-x: hidden; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0F1923; }
        ::-webkit-scrollbar-thumb { background: #1E2D3D; border-radius: 3px; }
      `}</style>
      {/* ── Sidebar ── */}
      <div style={s.sidebar}>
        <div style={{padding:sidebarOpen?"20px 24px 16px":"20px 0 16px",borderBottom:"1px solid #1E2D3D",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center"}}>
          {sidebarOpen&&<div>
            <div style={{fontSize:17,fontWeight:700,color:"#00C9A7"}}>CashFlow</div>
            {import.meta.env.DEV&&<div style={{fontSize:9,background:"#F5A623",color:"#0F1923",borderRadius:4,padding:"1px 6px",fontWeight:700,display:"inline-block",marginTop:2}}>DEV</div>}
          </div>}
          <button style={{background:"none",border:"none",color:"#6B8299",cursor:"pointer",fontSize:18,padding:4}} onClick={()=>setSidebarOpen(o=>!o)}>{sidebarOpen?"◀":"▶"}</button>
        </div>
        <div style={{flex:1,paddingTop:8,overflowY:"auto"}}>
          {navItems.map(n=>(
            <div key={n.id} style={s.nav(tab===n.id,sidebarOpen)} onClick={()=>setTab(n.id)} title={!sidebarOpen?n.label:""}>
              <span style={{fontSize:17,minWidth:20,textAlign:"center"}}>{n.icon}</span>
              {sidebarOpen&&<span>{n.label}</span>}
            </div>
          ))}
        </div>
        {sidebarOpen&&(
          <div style={{padding:"16px 24px",borderTop:"1px solid #1E2D3D"}}>
            <div style={{fontSize:11,color:"#6B8299",marginBottom:8}}>{user.email}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:10,color:"#6B8299",opacity:0.5,fontFamily:"monospace",letterSpacing:"0.3px"}}>Fluxo de Caixa-100726 V.6.19.5 · by MKK</span>
              <span style={{color:"#00C9A7",fontSize:11,cursor:"pointer",fontWeight:600}} onClick={()=>supabase.auth.signOut()}>Sair</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div style={s.main}>

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <div><div style={{fontSize:21,fontWeight:700}}>Dashboard</div><div style={{fontSize:13,color:"#6B8299",marginTop:2}}>{transactions.length} lançamentos</div></div>
              <div style={{display:"flex",gap:10}}>
                <button style={s.btn("ghost")} onClick={()=>{setModalMode("saldo");setSaldoForm(String(saldoInicial));setShowModal(true)}}>Saldo Inicial</button>
                <button style={s.btn()} onClick={()=>{setModalMode("lancamento");setEditingId(null);setEditingRazaoSocial("");setForm({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});setShowModal(true)}}>+ Lançamento</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
              {[{l:"Saldo Atual",v:fmt(metrics.saldo),c:metrics.saldo>=0?"#00C9A7":"#E8445A"},{l:"Saldo Inicial",v:fmt(saldoInicial),c:"#6B8299"},{l:"Total Receitas",v:fmt(metrics.rec),c:"#2ECC71"},{l:"Total Despesas",v:fmt(metrics.des),c:"#E8445A"}].map(m=>(
                <div key={m.l} style={s.card}><div style={{fontSize:11,color:"#6B8299",marginBottom:6,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:22,fontWeight:700,color:m.c}}>{m.v}</div></div>
              ))}
            </div>
            <div style={{marginBottom:20}}>
              <div style={s.card}>
                <div style={{fontSize:11,color:"#6B8299",marginBottom:14,textTransform:"uppercase"}}>Por R/D</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {RD_TYPES.map(rd=>{
                    const total=transactions.filter(t=>t.rd===rd).reduce((s,t)=>s+Number(t.value),0);
                    if(total===0) return null;
                    return (
                      <div key={rd} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:"1px solid #1E2D3D"}}>
                        <span style={{fontSize:12,color:rdColor[rd]||"#6B8299",fontWeight:500}}>{rd}</span>
                        <span style={{fontSize:13,fontWeight:700,color:total>=0?"#2ECC71":"#E8445A"}}>{fmt(total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={s.card}>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:12,textTransform:"uppercase"}}>Últimos Lançamentos</div>
              <table style={s.table}>
                <thead><tr>{["Data","Descrição","R/D","Classificação","Conta","Valor","Status"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {transactions.slice(0,8).map(t=>(
                    <tr key={t.id}>
                      <td style={s.td}>{t.date}</td>
                      <td style={{...s.td,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</td>
                      <td style={s.td}><span style={{...s.badge(t.rd),fontSize:10}}>{t.rd||"—"}</span></td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.classificacao||"—"}</td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{isCCTransaction(t)?<span style={{color:"#F5A623",fontWeight:600}}>CC/{(t.conta||"").replace(/^CC\//,"")}</span>:(t.conta||"—")}</td>
                      <td style={{...s.td,fontWeight:600,color:Number(t.value)>=0?"#2ECC71":"#E8445A"}}>{fmt(Number(t.value))}</td>
                      <td style={s.td}><span style={{fontSize:11,color:t.needs_review?"#F5A623":t.status==="confirmado"?"#2ECC71":"#6B8299"}}>{t.needs_review?"⚠ revisar":t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* LANÇAMENTOS */}
        {tab==="lancamentos"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div style={{fontSize:21,fontWeight:700}}>Lançamentos</div>
                  {drillDown&&(
                    <span style={{fontSize:12,background:"rgba(0,201,167,0.15)",color:"#00C9A7",padding:"4px 12px",borderRadius:20,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                      onClick={()=>{setDrillDown(null);setTab("fluxo");}}>
                      ← {drillDown.label||"Fluxo de Caixa"} &nbsp;✕
                    </span>
                  )}
                </div>
                <div style={{fontSize:13,color:"#6B8299",marginTop:4}}>
                  {filtered.length} registros
                  {drillDown?.rd&&<span style={{color:"#00C9A7",fontWeight:600}}> · {drillDown.rd}</span>}
                  {drillDown?.dateFrom&&<span> · {drillDown.dateFrom.split("-").reverse().join("/")} até {drillDown.dateTo.split("-").reverse().join("/")}</span>}
                </div>
              </div>
              <button style={s.btn()} onClick={()=>{setModalMode("lancamento");setEditingId(null);setEditingRazaoSocial("");setForm({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});setShowModal(true)}}>+ Novo</button>
            </div>
            <div style={{marginBottom:10,position:"relative"}}>
              <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#6B8299",fontSize:16,pointerEvents:"none"}}>🔍</div>
              <input style={{...s.input,paddingLeft:38}} placeholder="Buscar em qualquer campo — descrição, data, valor, classificação..."
                value={searchText} onChange={e=>setSearchText(e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              <select style={s.sel} value={filter.rd} onChange={e=>setFilter(f=>({...f,rd:e.target.value}))}>
                <option value="todos">Todos R/D</option>{RD_TYPES.map(r=><option key={r}>{r}</option>)}
              </select>
              <select style={s.sel} value={filter.classificacao} onChange={e=>setFilter(f=>({...f,classificacao:e.target.value}))}>
                <option value="todas">Todas Classificações</option>{allClassificacoes.map(c=><option key={c}>{c}</option>)}
              </select>
              <select style={s.sel} value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}>
                <option value="todos">Todos</option><option value="nao_classificados">Não classificados</option>
              </select>
              <input style={{...s.sel,width:130}} type="date" value={filter.dateFrom} onChange={e=>setFilter(f=>({...f,dateFrom:e.target.value}))} title="De"/>
              <input style={{...s.sel,width:130}} type="date" value={filter.dateTo} onChange={e=>setFilter(f=>({...f,dateTo:e.target.value}))} title="Até"/>
              <button style={{...s.btn("ghost"),padding:"8px 14px"}} onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} title="Ordenar por data">
                Data {sortDir==="asc"?"↑":"↓"}
              </button>
              <button style={{...s.btn("ghost"),padding:"8px 14px"}} onClick={()=>{setFilter({rd:"todos",classificacao:"todas",status:"todos",dateFrom:"",dateTo:""});setSearchText("");}}>Limpar filtros</button>
            </div>
            <div style={{...s.card,padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 280px)"}}>
              <table style={s.table}>
                <thead style={{position:"sticky",top:0,zIndex:10,background:"#162130"}}><tr>
                  {[{l:"Data",k:"date"},{l:"Descrição",k:"description"},{l:"Razão Social",k:"razao_social"},{l:"R/D",k:"rd"},{l:"Classificação",k:"classificacao"},{l:"Subcategoria",k:"subcategoria"},{l:"Conta",k:"conta"},{l:"Valor",k:"value"},{l:"",k:""}].map(({l,k})=>(
                    <th key={l} style={{...s.th,cursor:k?"pointer":"default",userSelect:"none",whiteSpace:"nowrap",padding:"10px 10px"}}
                      onClick={()=>{if(!k)return;if(sortCol===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(k);setSortDir("asc");}}}>
                      {l}{k&&sortCol===k?(sortDir==="asc"?" ↑":" ↓"):""}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(t=>(
                    <tr key={t.id} style={t.needs_review?{background:"rgba(245,166,35,0.04)"}:{}}>
                      <td style={s.td}>{t.date}</td>
                      <td style={{...s.td,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {transDetailsMap[t.id]>0&&(
                          <span title={`${transDetailsMap[t.id]} itens de detalhe`}
                            style={{cursor:"pointer",marginRight:4,fontSize:10,background:"rgba(0,201,167,0.15)",color:"#00C9A7",borderRadius:10,padding:"1px 5px",fontWeight:700}}
                            onClick={()=>openDetailModal(t)}>
                            📎{transDetailsMap[t.id]}
                          </span>
                        )}
                        {t.description}
                      </td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.razao_social||"—"}</td>
                      <td style={s.td}><span style={{...s.badge(t.rd),fontSize:10}}>{t.rd||"—"}</span></td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.classificacao||"—"}</td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.subcategoria||"—"}</td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{isCCTransaction(t)?<span style={{color:"#F5A623",fontWeight:600}}>CC/{(t.conta||"").replace(/^CC\//,"")}</span>:(t.conta||"—")}</td>
                      <td style={{...s.td,fontWeight:600,color:Number(t.value)>=0?"#2ECC71":"#E8445A"}}>
                        {transDetailsMap[t.id]>0
                          ? <button style={{background:"none",border:"none",cursor:"pointer",fontWeight:600,fontSize:12,color:Number(t.value)>=0?"#2ECC71":"#E8445A",padding:0,textDecoration:"underline dotted",textUnderlineOffset:3}} title="Ver detalhamento" onClick={()=>openDetailModal(t)}>{fmt(Number(t.value))} ↗</button>
                          : fmt(Number(t.value))
                        }
                      </td>
                      <td style={s.td}>
                        <div style={{display:"flex",gap:4}}>
                          <button style={{...s.btn("ghost"),padding:"3px 7px",fontSize:11}} title="Detalhamento" onClick={()=>openDetailModal(t)}>📎</button>
                          <button style={{...s.btn("ghost"),padding:"3px 7px",fontSize:11}} onClick={()=>startEdit(t)}>✏</button>
                          <button style={{...s.btn("danger"),padding:"3px 7px",fontSize:11}} onClick={()=>deleteT(t.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}

        {/* FLUXO DE CAIXA */}
        {tab==="fluxo"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div><div style={{fontSize:21,fontWeight:700}}>Fluxo de Caixa</div><div style={{fontSize:13,color:"#6B8299",marginTop:2}}>Agrupado por {fluxoGroupBy==="rd"?"R/D":fluxoGroupBy==="classificacao"?"Classificação":"Mês"}</div></div>
              <div style={{display:"flex",gap:8}}>
                <button style={s.btn("ghost")} onClick={()=>{setModalMode("saldo");setSaldoForm(String(saldoInicial));setShowModal(true)}}>Incluir Registro</button>
                <button style={s.btn("ghost")} onClick={()=>exportFluxoCSV(transactions)}>⬇ CSV</button>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:4,background:"#162130",borderRadius:10,padding:4,border:"1px solid #1E2D3D"}}>
                {[["rd","Por R/D"],["classificacao","Por Classificação"],["month","Por Mês"]].map(([v,l])=>(
                  <button key={v} style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,background:fluxoGroupBy===v?"#00C9A7":"transparent",color:fluxoGroupBy===v?"#0F1923":"#6B8299"}} onClick={()=>setFluxoGroupBy(v)}>{l}</button>
                ))}
              </div>
              <select style={s.sel} value={fluxoMonth} onChange={e=>setFluxoMonth(e.target.value)}>
                <option value="todos">Todos os meses</option>{MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:20}}>
              {(()=>{
                const lastInv = Object.values(extrasMonthly.investimentos||{}).filter(v=>v>0).at(-1)||0;
                const lastRec = Object.values(extrasMonthly.contasReceber||{}).filter(v=>v>0).at(-1)||0;
                const disponibilidade = metrics.saldo + lastInv + lastRec;
                return [
                  {l:"Saldo Inicial",  v:saldoInicial, c:"#6B8299"},
                  {l:"Total Receitas", v:transactions.filter(t=>Number(t.value)>0).reduce((s,t)=>s+Number(t.value),0), c:"#2ECC71"},
                  {l:"Total Despesas", v:Math.abs(transactions.filter(t=>Number(t.value)<0).reduce((s,t)=>s+Number(t.value),0)), c:"#E8445A"},
                  {l:"Resultado",      v:transactions.reduce((s,t)=>s+Number(t.value),0), c:transactions.reduce((s,t)=>s+Number(t.value),0)>=0?"#00C9A7":"#E8445A"},
                  {l:"Saldo Atual",    v:metrics.saldo, c:metrics.saldo>=0?"#00C9A7":"#E8445A"},
                  {l:"Disponibilidade",v:disponibilidade, c:disponibilidade>=0?"#00C9A7":"#E8445A"},
                ].map(m=>(
                  <div key={m.l} style={{...s.card,padding:"10px 12px"}}><div style={{fontSize:10,color:"#6B8299",marginBottom:4,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:16,fontWeight:700,color:m.c}}>{fmt(m.v)}</div></div>
                ));
              })()}
            </div>
            <div style={s.card}>
              <table style={s.table}>
                <thead><tr><th style={s.th}>Grupo</th><th style={{...s.th,textAlign:"right"}}>Total</th><th style={{...s.th,textAlign:"right"}}>Qtd</th><th style={s.th}>Distribuição</th></tr></thead>
                <tbody>
                  {(()=>{
                    const lastInv=Object.values(extrasMonthly.investimentos||{}).filter(v=>v>0).at(-1)||0;
                    const lastRec=Object.values(extrasMonthly.contasReceber||{}).filter(v=>v>0).at(-1)||0;
                    const grandTotal=fluxoData.reduce((acc,[,d])=>acc+d.total,0)+lastInv+lastRec;
                    const monthFiltered = fluxoMonth!=="todos" ? transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&parseInt(p[1])===parseInt(fluxoMonth);}) : transactions;
                    const geracaoTotal = monthFiltered.filter(t=>t.rd!=="MOVIMENTAÇÃO"&&t.rd!=="INVESTIMENTOS").reduce((s,t)=>s+Number(t.value),0);
                    const grupoNameColors={RECEITA:"#2ECC71","DESPESAS FIXAS":"#E8445A","DESPESAS VARIÁVEIS":"#E8445A",MOVIMENTAÇÃO:"#6B8299",INVESTIMENTOS:"#8E7CC3"};
                    const colorForGroup=(g,d)=>fluxoGroupBy==="rd" ? (grupoNameColors[g]||"#00C9A7") : (grupoNameColors[d.dominantRd]||"#00C9A7");
                    const txItems=fluxoData.map(([g,d])=>({group:g,data:{...d,isExtra:false},nameColor:colorForGroup(g,d),rowStyle:{}}));
                    const extraItems=[
                      ...(lastInv>0?[{group:"INVESTIMENTOS",data:{total:lastInv,count:null,isExtra:true},nameColor:"#8E7CC3",rowStyle:{background:"rgba(142,124,195,0.04)",borderTop:"1px dashed #1E2D3D"}}]:[]),
                      ...(lastRec>0?[{group:"CONTAS A RECEBER",data:{total:lastRec,count:null,isExtra:true},nameColor:"#2ECC71",rowStyle:{background:"rgba(46,204,113,0.04)"}}]:[]),
                    ];
                    const allItems=[...txItems,...extraItems];
                    const order=fluxoGroupOrder[fluxoGroupBy]||[];
                    const inOrder=order.filter(n=>allItems.some(r=>r.group===n)).map(n=>allItems.find(r=>r.group===n));
                    const notInOrder=allItems.filter(r=>!order.includes(r.group));
                    const sortedRows=[...inOrder,...notInOrder];
                    const maxAbs=Math.max(...sortedRows.map(r=>Math.abs(r.data.total)),1);
                    const isNaoOperacional = g => g==="MOVIMENTAÇÃO"||g==="INVESTIMENTOS"||g==="CONTAS A RECEBER";
                    const renderRow=(row,idx)=>{
                      const {group,data,nameColor,rowStyle}=row;
                      const pct=Math.round((Math.abs(data.total)/maxAbs)*100);
                      const handleGroupClick=()=>{
                        if(data.isExtra) return;
                        if(group==="Não classificado") setFilter({rd:"todos",classificacao:"todas",status:"nao_classificados",dateFrom:"",dateTo:""});
                        else if(fluxoGroupBy==="rd") setFilter({rd:group,classificacao:"todas",status:"todos",dateFrom:fluxoMonth!=="todos"?`${new Date().getFullYear()}-${String(fluxoMonth).padStart(2,"0")}-01`:"",dateTo:fluxoMonth!=="todos"?`${new Date().getFullYear()}-${String(fluxoMonth).padStart(2,"0")}-${new Date(new Date().getFullYear(),fluxoMonth,0).getDate()}`:"" });
                        else if(fluxoGroupBy==="classificacao") setFilter({rd:"todos",classificacao:group,status:"todos",dateFrom:"",dateTo:""});
                        else setFilter({rd:"todos",classificacao:"todas",status:"todos",dateFrom:"",dateTo:""});
                        setTab("lancamentos");
                      };
                      return (
                        <tr key={group} style={{cursor:data.isExtra?"default":"pointer",...rowStyle}}
                          draggable={true}
                          onDragStart={()=>setDragGroupIdx(idx)}
                          onDragOver={e=>e.preventDefault()}
                          onDrop={()=>{
                            if(dragGroupIdx===null||dragGroupIdx===idx){setDragGroupIdx(null);return;}
                            const names=sortedRows.map(r=>r.group);
                            const [dragged]=names.splice(dragGroupIdx,1);
                            names.splice(idx,0,dragged);
                            setDragGroupIdx(null);
                            saveFluxoGroupOrder(names);
                          }}
                          onClick={handleGroupClick}>
                          <td style={{...s.td,fontWeight:600,color:nameColor}}>
                            <span style={{marginRight:6,color:"#2D3F50",cursor:"grab",userSelect:"none"}} onClick={e=>e.stopPropagation()}>⠿</span>
                            {group}
                          </td>
                          <td style={{...s.td,textAlign:"right",fontWeight:700,color:data.total>=0?"#2ECC71":"#E8445A"}}>{fmt(data.total)}</td>
                          <td style={{...s.td,textAlign:"right",color:"#6B8299"}}>{data.count!==null?data.count:"—"}</td>
                          <td style={{...s.td,width:200}}>
                            {!data.isExtra&&<div style={{background:"#1E2D3D",borderRadius:4,height:8}}><div style={{background:data.total>=0?"#2ECC71":"#E8445A",width:`${pct}%`,height:"100%",borderRadius:4}}/></div>}
                          </td>
                        </tr>
                      );
                    };
                    return (<>
                      {fluxoGroupBy==="rd"?(<>
                        {sortedRows.map((row,idx)=>isNaoOperacional(row.group)?null:renderRow(row,idx))}
                        <tr style={{borderTop:"2px solid #1E2D3D",background:"rgba(0,201,167,0.06)"}}>
                          <td style={{...s.td,fontWeight:700,color:"#00C9A7"}}>GERAÇÃO DE CAIXA</td>
                          <td style={{...s.td,textAlign:"right",fontWeight:700,color:geracaoTotal>=0?"#2ECC71":"#E8445A"}}>{fmt(geracaoTotal)}</td>
                          <td colSpan={2}/>
                        </tr>
                        {sortedRows.map((row,idx)=>isNaoOperacional(row.group)?renderRow(row,idx):null)}
                      </>):(
                        sortedRows.map((row,idx)=>renderRow(row,idx))
                      )}
                      <tr>
                        <td style={{...s.td,fontWeight:700}}>SALDO DE CAIXA TOTAL</td>
                        <td style={{...s.td,textAlign:"right",fontWeight:700,color:grandTotal>=0?"#2ECC71":"#E8445A"}}>{fmt(grandTotal)}</td>
                        <td colSpan={2}/>
                      </tr>
                    </>);
                  })()}
                </tbody>
              </table>
            </div>
            {(()=>{
              const activeMths=MONTHS.filter(m=>transactions.some(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m;}));
              if(!activeMths.length) return null;
              return (
                <div style={{...s.card,marginTop:16,overflowX:"auto"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontSize:11,color:"#6B8299",textTransform:"uppercase"}}>Resumo Mensal por R/D</div>
                    <button style={{...s.btn("ghost"),fontSize:11,padding:"5px 12px"}} onClick={()=>setShowExtrasModal(true)}>+ Investimentos / Contas a Receber</button>
                  </div>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={{...s.th,minWidth:140}}>R/D</th>
                        {activeMths.map(m=><th key={m} style={{...s.th,textAlign:"right"}}>{m.substring(0,3)}</th>)}
                        <th style={{...s.th,textAlign:"right"}}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["RECEITA","DESPESAS FIXAS","DESPESAS VARIÁVEIS","DESPESA FINANCEIRA","SALDO INICIAL","__GERACAO__","MOVIMENTAÇÃO","INVESTIMENTOS"].map(rd=>{
                        if(rd==="__GERACAO__"){
                          const tots=activeMths.map(m=>transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m&&t.rd!=="INVESTIMENTOS"&&t.rd!=="MOVIMENTAÇÃO";}).reduce((s,t)=>s+Number(t.value),0));
                          const grand=tots.reduce((s,v)=>s+v,0);
                          return (
                            <tr key="geracao" style={{borderTop:"2px solid #1E2D3D",background:"rgba(0,201,167,0.06)"}}>
                              <td style={{...s.td,fontWeight:700,color:"#00C9A7"}}>GERAÇÃO DE CAIXA</td>
                              {tots.map((v,i)=><td key={i} style={{...s.td,textAlign:"right",fontWeight:700,color:v>=0?"#2ECC71":"#E8445A",whiteSpace:"nowrap"}}>{fmt(v)}</td>)}
                              <td style={{...s.td,textAlign:"right",fontWeight:700,color:grand>=0?"#2ECC71":"#E8445A",whiteSpace:"nowrap"}}>{fmt(grand)}</td>
                            </tr>
                          );
                        }
                        const vals=activeMths.map(m=>transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m&&t.rd===rd;}).reduce((s,t)=>s+Number(t.value),0));
                        const total=vals.reduce((s,v)=>s+v,0);
                        if(vals.every(v=>v===0)) return null;
                        const rdColor2={RECEITA:"#2ECC71","DESPESAS FIXAS":"#E8445A","DESPESAS VARIÁVEIS":"#FF7A7A",MOVIMENTAÇÃO:"#6B8299",INVESTIMENTOS:"#8E7CC3"};
                        return (
                          <tr key={rd}>
                            <td style={{...s.td,fontWeight:600,color:rdColor2[rd]||"#E8EDF2"}}>{rd}</td>
                            {vals.map((v,i)=>{
                              const mName=activeMths[i];
                              const mIdx=MONTHS.indexOf(mName)+1;
                              const txYear=transactions.find(t=>{const p=t.date?.split("/");return p?.length===3&&parseInt(p[1])===mIdx;})?.date?.split("/")?.[2]||"2026";
                              const mm=String(mIdx).padStart(2,"0");
                              const lastDay=new Date(Number(txYear),mIdx,0).getDate();
                              return (
                                <td key={i} style={{...s.td,textAlign:"right",fontSize:11,color:v>0?"#2ECC71":v<0?"#E8445A":"#6B8299"}}>
                                  {v!==0?(
                                    <button
                                      onClick={()=>{
                                        setDrillDown({rd,dateFrom:`${txYear}-${mm}-01`,dateTo:`${txYear}-${mm}-${String(lastDay).padStart(2,"0")}`,label:`${rd} · ${mName}`});
                                        setTab("lancamentos");
                                      }}
                                      style={{background:"none",border:"none",color:"inherit",cursor:"pointer",fontSize:11,fontWeight:500,padding:0}}>
                                      {fmt(v)}
                                    </button>
                                  ):"—"}
                                </td>
                              );
                            })}
                            <td style={{...s.td,textAlign:"right",fontWeight:700,color:total>=0?"#2ECC71":"#E8445A"}}>
                              <button
                                onClick={()=>{setDrillDown({rd,dateFrom:"",dateTo:"",label:rd});setTab("lancamentos");}}
                                style={{background:"none",border:"none",color:"inherit",cursor:"pointer",fontSize:13,fontWeight:700,padding:0}}>
                                {fmt(total)}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* INVESTIMENTOS mensal */}
                      {(()=>{
                        const invVals = activeMths.map(m=>((extrasMonthly.investimentos||{})[String(MONTHS.indexOf(m)+1)])||0);
                        const recVals = activeMths.map(m=>((extrasMonthly.contasReceber||{})[String(MONTHS.indexOf(m)+1)])||0);
                        const investRdVals = activeMths.map(m=>transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m&&t.rd==="INVESTIMENTOS";}).reduce((s,t)=>s+Number(t.value),0));
                        const movimentacaoVals = activeMths.map(m=>transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m&&t.rd==="MOVIMENTAÇÃO";}).reduce((s,t)=>s+Number(t.value),0));
                        const tots = activeMths.map(m=>transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m&&t.rd!=="INVESTIMENTOS"&&t.rd!=="MOVIMENTAÇÃO";}).reduce((s,t)=>s+Number(t.value),0));
                        const hasInv = invVals.some(v=>v!==0);
                        const hasRec = recVals.some(v=>v!==0);
                        const hasInvestRd = investRdVals.some(v=>v!==0);
                        const hasMovimentacao = movimentacaoVals.some(v=>v!==0);
                        if(!hasInv&&!hasRec&&!hasInvestRd&&!hasMovimentacao) return null;
                        // Last month with value
                        const lastInv = invVals.filter(v=>v!==0).at(-1)||0;
                        const lastRec = recVals.filter(v=>v!==0).at(-1)||0;
                        return (<>
                          {hasInv&&(
                            <tr style={{background:"rgba(0,201,167,0.04)",borderTop:"1px dashed #1E2D3D"}}>
                              <td style={{...s.td,fontWeight:600,color:"#00C9A7"}}>INVESTIMENTOS</td>
                              {invVals.map((v,i)=>(
                                <td key={i} style={{...s.td,textAlign:"right",fontWeight:600,color:"#00C9A7"}}>{v?fmt(v):"—"}</td>
                              ))}
                              <td style={{...s.td,textAlign:"right",fontWeight:700,color:"#00C9A7"}}>{fmt(lastInv)}</td>
                            </tr>
                          )}
                          {hasRec&&(
                            <tr style={{background:"rgba(46,204,113,0.04)"}}>
                              <td style={{...s.td,fontWeight:600,color:"#2ECC71"}}>CONTAS A RECEBER</td>
                              {recVals.map((v,i)=>(
                                <td key={i} style={{...s.td,textAlign:"right",fontWeight:600,color:"#2ECC71"}}>{v?fmt(v):"—"}</td>
                              ))}
                              <td style={{...s.td,textAlign:"right",fontWeight:700,color:"#2ECC71"}}>{fmt(lastRec)}</td>
                            </tr>
                          )}
                          <tr style={{borderTop:"2px solid #1E2D3D"}}>
                            <td style={{...s.td,fontWeight:700}}>SALDO DE CAIXA TOTAL</td>
                            {tots.map((v,i)=>{
                              const total = v + invVals[i] + recVals[i] + investRdVals[i] + movimentacaoVals[i];
                              return <td key={i} style={{...s.td,textAlign:"right",fontWeight:700,color:total>=0?"#2ECC71":"#E8445A",whiteSpace:"nowrap"}}>{fmt(total)}</td>;
                            })}
                            <td style={{...s.td,textAlign:"right",fontWeight:700,color:(tots.reduce((s,v)=>s+v,0)+lastInv+lastRec+investRdVals.reduce((s,v)=>s+v,0)+movimentacaoVals.reduce((s,v)=>s+v,0))>=0?"#2ECC71":"#E8445A",whiteSpace:"nowrap"}}>{fmt(tots.reduce((s,v)=>s+v,0)+lastInv+lastRec+investRdVals.reduce((s,v)=>s+v,0)+movimentacaoVals.reduce((s,v)=>s+v,0))}</td>
                          </tr>
                        </>);
                      })()}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}

        {/* IMPORTAR */}
        {tab==="importar"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div><div style={{fontSize:21,fontWeight:700}}>Importar Extrato</div><div style={{fontSize:13,color:"#6B8299",marginTop:2}}>Detecta automaticamente o formato do arquivo</div></div>
            </div>
            {aiLoading&&(
              <div style={{...s.card,textAlign:"center",padding:48,marginBottom:20}}>
                <div style={{fontSize:32,marginBottom:10}}>🤖</div>
                <div style={{fontSize:16,fontWeight:600,color:"#00C9A7"}}>Classificando com IA...</div>
                <div style={{fontSize:13,color:"#6B8299",marginTop:8}}>Consultando {BASE_CLASSIFICATIONS.length} classificações locais + Gemini para desconhecidos.</div>
              </div>
            )}
            {pendingImport&&!aiLoading?(
              <div style={s.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>📄 {pendingImport.fileName}</div>
                    <div style={{fontSize:13,color:"#6B8299",marginTop:4}}>
                      {pendingImport.rows.length} detectados ·
                      <span style={{color:"#2ECC71"}}> {pendingImport.newRows.length} novos</span>
                      {pendingImport.dups>0&&<span style={{color:"#F5A623"}}> · {pendingImport.dups} duplicados ignorados</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button style={s.btn("danger")} onClick={()=>setPendingImport(null)}>✕ Cancelar</button>
                    <button style={s.btn()} onClick={()=>classifyAndSave(pendingImport.newRows, pendingImport.fileName, pendingImport.isCreditCard)} disabled={pendingImport.newRows.length===0}>
                      🤖 Classificar e Importar ({pendingImport.newRows.length})
                    </button>
                  </div>
                </div>
                <table style={s.table}>
                  <thead><tr>{["Data","Descrição","Valor","Status"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {pendingImport.rows.slice(0,20).map((t,i)=>{
                      const dup=importedHashes.has(generateHash(t.date,t.description,t.value));
                      return (<tr key={i} style={dup?{opacity:0.35}:{}}>
                        <td style={s.td}>{t.date}</td>
                        <td style={{...s.td,maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</td>
                        <td style={{...s.td,fontWeight:600,color:t.value>=0?"#2ECC71":"#E8445A"}}>{fmt(t.value)}</td>
                        <td style={s.td}><span style={{fontSize:11,color:dup?"#F5A623":"#2ECC71"}}>{dup?"duplicado":"novo"}</span></td>
                      </tr>);
                    })}
                    {pendingImport.rows.length>20&&<tr><td colSpan={4} style={{...s.td,color:"#6B8299",textAlign:"center"}}>... e mais {pendingImport.rows.length-20}</td></tr>}
                  </tbody>
                </table>
              </div>
            ):!aiLoading&&(
              <>
                <div style={{border:`2px dashed ${dragOver?"#00C9A7":"#1E2D3D"}`,borderRadius:12,padding:48,textAlign:"center",cursor:"pointer",background:dragOver?"rgba(0,201,167,0.05)":"transparent",transition:"all .2s"}}
                  onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                  onDragLeave={()=>setDragOver(false)}
                  onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}}
                  onClick={()=>document.getElementById("fileInput").click()}>
                  <div style={{fontSize:40,marginBottom:12}}>📂</div>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Arraste o extrato ou clique para selecionar</div>
                  <div style={{fontSize:13,color:"#6B8299"}}>CSV, TXT ou XLSX — mapeamento de colunas automático</div>
                  <div style={{fontSize:12,color:"#00C9A7",marginTop:8}}>🤖 {BASE_CLASSIFICATIONS.length} classificações locais + Gemini</div>
                  <div style={{fontSize:11,color:"#6B8299",marginTop:4}}>Duplicados ignorados automaticamente</div>
                </div>
                <div style={{...s.card,marginTop:20}}>
                  <div style={{fontSize:11,color:"#6B8299",marginBottom:10,textTransform:"uppercase"}}>Formato esperado</div>
                  <div style={{background:"#0F1923",borderRadius:8,padding:14,fontFamily:"monospace",fontSize:12,color:"#6B8299",lineHeight:2}}>
                    <div style={{color:"#00C9A7"}}>Data;Lançamento;Razão Social;CPF/CNPJ;Valor (R$);Saldo (R$)</div>
                    <div>19/03/2026;RECEBIMENTO REDE AMEX;REDECARD S.A.;;204,37;</div>
                    <div>20/03/2026;PIX ENVIADO FORNECEDOR;;;-1.500,00;</div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* PENDÊNCIAS */}

        {/* FORECAST */}
        {tab==="forecast"&&(
          <>
            <div style={{fontSize:21,fontWeight:700,marginBottom:4}}>Forecast</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:20}}>Projeção baseada nos últimos 3 meses</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              {forecast.slice(0,3).map(m=>(
                <div key={m.label} style={s.card}>
                  <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:"#00C9A7"}}>{m.label}</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:"#6B8299"}}>Receitas</span><span style={{color:"#2ECC71",fontWeight:600}}>{fmt(m.entrada)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:"#6B8299"}}>Despesas</span><span style={{color:"#E8445A",fontWeight:600}}>{fmt(m.saida)}</span></div>
                  <div style={{borderTop:"1px solid #1E2D3D",paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,color:"#6B8299"}}>Resultado</span>
                    <span style={{fontSize:14,fontWeight:700,color:m.saldo>=0?"#00C9A7":"#E8445A"}}>{fmt(m.saldo)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:14,textTransform:"uppercase"}}>Próximos 6 Meses</div>
              <div style={{display:"flex",gap:14,marginBottom:14}}><span style={{fontSize:12,color:"#00C9A7"}}>■ Receitas</span><span style={{fontSize:12,color:"#E8445A"}}>■ Despesas</span></div>
              <BarMini data={forecast}/>
            </div>
          </>
        )}

        {/* PROJEÇÃO */}
        {tab==="projecao"&&(
          <>
            <div style={{fontSize:21,fontWeight:700,marginBottom:4}}>Projeção Futura</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:20}}>3 cenários — próximos 6 meses</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {["Pessimista (−20%)","Realista","Otimista (+20%)"].map((label,idx)=>{
                const factor=[0.8,1,1.2][idx];
                const color=["#E8445A","#00C9A7","#2ECC71"][idx];
                const total=forecast.reduce((s,m)=>s+(m.saldo*factor),0);
                return (
                  <div key={label} style={{...s.card,borderColor:color+"44"}}>
                    <div style={{fontSize:13,color,fontWeight:700,marginBottom:12}}>{label}</div>
                    {forecast.map(m=>(
                      <div key={m.label} style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:12}}>
                        <span style={{color:"#6B8299"}}>{m.label}</span>
                        <span style={{color:m.saldo*factor>=0?"#2ECC71":"#E8445A",fontWeight:500}}>{fmt(m.saldo*factor)}</span>
                      </div>
                    ))}
                    <div style={{borderTop:"1px solid #1E2D3D",paddingTop:8,marginTop:4,display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:12,color:"#6B8299"}}>Total 6 meses</span>
                      <span style={{fontSize:14,fontWeight:700,color}}>{fmt(total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* AGENDA */}
        {tab==="agenda"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{fontSize:21,fontWeight:700}}>Agenda de Pagamentos</div>
                <div style={{fontSize:13,color:"#6B8299",marginTop:2}}>{agenda.filter(a=>a.ativo).length} compromissos ativos</div>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <select style={s.sel} value={agendaMes} onChange={e=>{setAgendaMes(Number(e.target.value));setReconciliarModal(null);}}>
                  {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
                </select>
                <select style={s.sel} value={agendaAno} onChange={e=>{setAgendaAno(Number(e.target.value));setReconciliarModal(null);}}>
                  {(()=>{
                    const cur = new Date().getFullYear();
                    const fromData = transactions.map(t=>parseInt(t.date?.split("/")?.[2])).filter(y=>y>2000);
                    const min = Math.min(...fromData, cur);
                    return Array.from({length: cur+2-min+1}, (_,i)=>min+i).map(y=><option key={y}>{y}</option>);
                  })()}
                </select>
                <button style={s.btn("ghost")} onClick={()=>reconcileAgenda(agendaMes,agendaAno)}>🔄 Reconciliar</button>
                {(()=>{
                  const items=getAlertaItems();
                  return items.length>0&&(
                    <button
                      style={{background:"#2A1A1A",border:"1px solid #E8445A",color:"#E8445A",borderRadius:6,fontSize:12,padding:"4px 12px",cursor:"pointer",fontWeight:700}}
                      onClick={()=>setShowAtrasadosModal(true)}
                    >⚠ {items.length} alerta(s)</button>
                  );
                })()}
                {(()=>{
                  if(!reconciliarModal) return null;
                  const pendentesCount = reconciliarModal.items.filter(item=>{
                    const oc=getOcorrencia(item.id,reconciliarModal.mes,reconciliarModal.ano);
                    return oc?.status!=="pago"&&oc?.status!=="baixado";
                  }).length;
                  return pendentesCount>0&&(
                    <button
                      style={{background:"#2A1A1A",border:"1px solid #E8445A",color:"#E8445A",borderRadius:6,fontSize:12,padding:"4px 12px",cursor:"pointer",fontWeight:700}}
                      onClick={()=>setShowSemMatchModal(true)}
                    >⚠️ {pendentesCount} sem match</button>
                  );
                })()}
                <button style={s.btn()} onClick={()=>{setEditingAgenda(null);setAgendaForm({nome:"",tipo:"",dia_vencimento:"",keywords:"",rd:"DESPESAS FIXAS",classificacao:""});setShowAgendaModal(true);}}>+ Novo</button>
              </div>
            </div>
            {(()=>{
              const ocs=agendaOcorrencias.filter(o=>o.mes===agendaMes&&o.ano===agendaAno);
              const pagos=ocs.filter(o=>o.status==="pago").length;
              const pendentes=ocs.filter(o=>o.status==="pendente").length;
              const totalPago=ocs.filter(o=>o.status==="pago").reduce((s,o)=>s+(o.valor_pago||0),0);
              const agAtivos=agenda.filter(a=>a.ativo);
              const semOc=agAtivos.filter(a=>!ocs.find(o=>o.agenda_id===a.id)).length;
              return (
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
                  {[{l:"Compromissos",v:agAtivos.length,c:"#6B8299"},{l:"Pagos",v:pagos,c:"#2ECC71"},{l:"Pendentes",v:pendentes+semOc,c:"#F5A623"},{l:"Total Pago",v:fmt(totalPago),c:"#00C9A7"}].map(m=>(
                    <div key={m.l} style={{...s.card,padding:"8px 12px"}}>
                      <div style={{fontSize:10,color:"#6B8299",marginBottom:3,textTransform:"uppercase"}}>{m.l}</div>
                      <div style={{fontSize:m.l==="Total Pago"?13:18,fontWeight:700,color:m.c}}>{m.v}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{...s.card,padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 200px)",overscrollBehavior:"contain"}}>
              <table style={s.table}>
                <thead style={{position:"sticky",top:0,zIndex:10,background:"#162130"}}><tr>
                  {[{l:"Compromisso",k:"nome"},{l:"Tipo",k:"tipo"},{l:"Vence dia",k:"dia_vencimento"},{l:"Keywords",k:""},{l:"Status",k:"status"},{l:"Valor Pago",k:"valor"},{l:"Ação",k:""}].map(({l,k})=>(
                    <th key={l} style={{...s.th,cursor:k?"pointer":"default",userSelect:"none",position:"relative"}}
                      onClick={()=>{
                        if(!k) return;
                        if(agendaSortCol===k) setAgendaSortDir(d=>d==="asc"?"desc":"asc");
                        else{setAgendaSortCol(k);setAgendaSortDir("asc");}
                      }}>
                      {l}{k&&agendaSortCol===k?(agendaSortDir==="asc"?" ↑":" ↓"):""}
                      {k==="dia_vencimento"&&(
                        <span style={{marginLeft:4,fontSize:10,color:"#00C9A7",cursor:"pointer"}}
                          onClick={e=>{e.stopPropagation();setShowDiaFilter(f=>!f);}}>
                          {agendaDiaFilter.length>0?`(${agendaDiaFilter.length})`:""} ▾
                        </span>
                      )}
                      {k==="dia_vencimento"&&showDiaFilter&&(
                        <div style={{position:"absolute",top:"100%",left:0,background:"#162130",border:"1px solid #1E2D3D",borderRadius:8,padding:10,zIndex:200,minWidth:180,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}
                          onClick={e=>e.stopPropagation()}>
                          <div style={{fontSize:11,color:"#6B8299",marginBottom:8,fontWeight:600}}>FILTRAR POR DIA</div>
                          {[...new Set(agenda.filter(a=>a.ativo).map(a=>a.dia_vencimento))].sort((a,b)=>a-b).map(dia=>(
                            <label key={dia} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:"pointer",fontSize:12}}>
                              <input type="checkbox" checked={agendaDiaFilter.includes(dia)}
                                onChange={e=>setAgendaDiaFilter(prev=>e.target.checked?[...prev,dia]:prev.filter(d=>d!==dia))}/>
                              dia {dia}
                            </label>
                          ))}
                          {agendaDiaFilter.length>0&&(
                            <button style={{...s.btn("ghost"),fontSize:11,padding:"4px 8px",marginTop:8,width:"100%"}}
                              onClick={()=>setAgendaDiaFilter([])}>Limpar filtro</button>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {agenda.filter(a=>a.ativo).filter(a=>agendaDiaFilter.length===0||agendaDiaFilter.includes(a.dia_vencimento)).sort((a,b)=>{
                    const dir=agendaSortDir==="asc"?1:-1;
                    if(agendaSortCol==="nome") return a.nome.localeCompare(b.nome)*dir;
                    if(agendaSortCol==="tipo") return (a.tipo||"").localeCompare(b.tipo||"")*dir;
                    if(agendaSortCol==="status"){
                      const oa=agendaOcorrencias.find(o=>o.agenda_id===a.id&&o.mes===agendaMes&&o.ano===agendaAno);
                      const ob=agendaOcorrencias.find(o=>o.agenda_id===b.id&&o.mes===agendaMes&&o.ano===agendaAno);
                      return ((oa?.status||"z").localeCompare(ob?.status||"z"))*dir;
                    }
                    if(agendaSortCol==="valor"){
                      const oa=agendaOcorrencias.find(o=>o.agenda_id===a.id&&o.mes===agendaMes&&o.ano===agendaAno);
                      const ob=agendaOcorrencias.find(o=>o.agenda_id===b.id&&o.mes===agendaMes&&o.ano===agendaAno);
                      return ((oa?.valor_pago||0)-(ob?.valor_pago||0))*dir;
                    }
                    return (a.dia_vencimento-b.dia_vencimento)*dir;
                  }).map(item=>{
                    const oc=getOcorrencia(item.id,agendaMes,agendaAno);
                    const status=oc?.status||"sem registro";
                    const statusColor=status==="pago"?"#2ECC71":status==="baixado"?"#6B8299":status==="pendente"?"#F5A623":"#6B8299";
                    const statusLabel=status==="pago"?"✓ Pago":status==="baixado"?"✓ Baixado":status==="pendente"?"⏳ Pendente":"— Não verificado";
                    return (
                      <tr key={item.id} style={status==="pendente"?{background:"rgba(245,166,35,0.04)"}:{}}>
                        <td style={{...s.td,fontWeight:600}}>{item.nome}</td>
                        <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{item.tipo||"—"}</td>
                        <td style={{...s.td,textAlign:"center"}}><span style={{background:"#1E2D3D",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600}}>dia {item.dia_vencimento}</span></td>
                        <td style={{...s.td,maxWidth:180}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {(item.keywords||[]).slice(0,3).map(k=><span key={k} style={{background:"#1E2D3D",color:"#6B8299",borderRadius:20,fontSize:10,padding:"1px 6px"}}>{k}</span>)}
                            {(item.keywords||[]).length>3&&<span style={{fontSize:10,color:"#6B8299"}}>+{item.keywords.length-3}</span>}
                          </div>
                        </td>
                        <td style={s.td}><span style={{fontSize:12,color:statusColor,fontWeight:600}}>{statusLabel}</span></td>
                        <td style={{...s.td,fontWeight:600,color:"#E8445A"}}>{oc?.valor_pago?fmt(-oc.valor_pago):"—"}</td>
                        <td style={s.td}>
                          <div style={{display:"flex",gap:4}}>
                            <button style={{...s.btn("ghost"),padding:"3px 7px",fontSize:11}}
                              onClick={()=>{setEditingAgenda(item.id);setAgendaForm({nome:item.nome,tipo:item.tipo||"",dia_vencimento:String(item.dia_vencimento),keywords:(item.keywords||[]).join(", "),rd:item.rd||"DESPESAS FIXAS",classificacao:item.classificacao||""});setShowAgendaModal(true);}}>✏</button>
                            <button style={{...s.btn("danger"),padding:"3px 7px",fontSize:11}}
                              onClick={()=>setConfirmDelete("agenda_"+item.id)}>✕</button>
                            {status==="pendente"&&(
                              <button title="Baixar manualmente" style={{...s.btn("ghost"),padding:"3px 7px",fontSize:11}}
                                onClick={async()=>{
                                  await supabase.from("agenda_ocorrencias").upsert({
                                    agenda_id:item.id, mes:agendaMes, ano:agendaAno,
                                    status:"baixado", transaction_id:null, data_pagamento:null, valor_pago:null
                                  },{onConflict:"agenda_id,mes,ano"});
                                  await loadAgenda();
                                  showToast("Compromisso baixado!");
                                }}>✓</button>
                            )}
                            {status==="baixado"&&(
                              <button title="Desfazer baixa" style={{...s.btn("warn"),padding:"3px 7px",fontSize:11}}
                                onClick={async()=>{
                                  await supabase.from("agenda_ocorrencias").upsert({
                                    agenda_id:item.id, mes:agendaMes, ano:agendaAno,
                                    status:"pendente", transaction_id:null, data_pagamento:null, valor_pago:null
                                  },{onConflict:"agenda_id,mes,ano"});
                                  await loadAgenda();
                                  showToast("Baixa desfeita!");
                                }}>↩</button>
                            )}
                            {status==="pendente"&&oc&&(
                              <button style={{...s.btn("warn"),padding:"3px 7px",fontSize:11}}
                                onClick={()=>setAssociating({ocId:oc.id,agendaId:item.id,nome:item.nome,mes:agendaMes,ano:agendaAno})}>🔗</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
            {showAtrasadosModal&&(()=>{
              const items=getAlertaItems();
              const label=(item)=>{
                if(item.retroativo) return `ATRASADO desde ${MONTHS[item.checkMes-1]} de ${item.checkAno}`;
                if(item.daysUntil<0) return `ATRASADO ${Math.abs(item.daysUntil)} dia(s)`;
                if(item.daysUntil===0) return "HOJE";
                if(item.daysUntil===1) return "AMANHÃ";
                return `em ${item.daysUntil} dias`;
              };
              const isAtraso=(item)=>item.retroativo||item.daysUntil<0;
              return (
                <div style={s.modal} onClick={()=>setShowAtrasadosModal(false)}>
                  <div style={{...s.card,maxWidth:420,width:"100%",maxHeight:"70vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#E8445A"}}>⚠ Alertas de vencimento</div>
                      <button style={{...s.btn("ghost"),padding:"3px 9px"}} onClick={()=>setShowAtrasadosModal(false)}>✕</button>
                    </div>
                    {items.map(item=>(
                      <div key={item.id+"_"+item.checkMes+"_"+item.checkAno} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:6,background:"#0F1923",marginBottom:6}}>
                        <span style={{fontSize:13,fontWeight:600}}>{item.nome}</span>
                        <span style={{fontSize:12,fontWeight:600,color:isAtraso(item)?"#E8445A":"#F5A623"}}>{label(item)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* CLASSIFICAÇÕES */}
        {tab==="classificacoes"&&(
          <ClassificacoesTab customCats={customCats} loadCustomCats={loadCustomCats} showToast={showToast} s={s} loadTransactions={loadTransactions} hiddenBaseCls={hiddenBaseCls} hideBaseClassification={hideBaseClassification}/>
        )}

        {/* OPERACIONAL */}
        {tab==="operacional"&&(
          <>
            <div style={{fontSize:21,fontWeight:700,marginBottom:20}}>⚙ Operacional</div>

            {/* Sistema */}
            <div style={{...s.card,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:"#00C9A7",marginBottom:14}}>Sistema</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{fontSize:12,color:"#6B8299"}}>☁ Tempo real ativo</div>
                <div style={{fontSize:12,color:"#6B8299"}}>Versão: <span style={{color:"#00C9A7",fontWeight:600}}>Fluxo de Caixa-100726 V.6.19.5</span></div>
                <div style={{fontSize:12,color:"#6B8299"}}>by MKK</div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:14}}>
                <button style={{...s.btn("ghost"),fontSize:12,padding:"7px 14px"}} onClick={()=>exportFluxoCSV(transactions)}>⬇ Exportar CSV</button>
                <button style={{...s.btn("danger"),fontSize:12,padding:"7px 14px"}} onClick={()=>setShowConfirmClear(true)}>🗑 Apagar todos os dados</button>
              </div>
            </div>

            {/* Alertas de Vencimento WhatsApp */}
            <div style={{...s.card,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:"#00C9A7",marginBottom:14}}>🔔 Alertas de Vencimento — E-mail</div>

              {/* Antecedência */}
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:16}}>
                <span style={{fontSize:12,color:"#6B8299"}}>Avisar com:</span>
                {[3,5,7,10].map(d=>(
                  <button key={d} style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                    background:alertDaysAhead===d?"#00C9A7":"#1E2D3D",color:alertDaysAhead===d?"#0F1923":"#6B8299"}}
                    onClick={()=>saveAlertDays(d)}>{d}d</button>
                ))}
                <span style={{fontSize:11,color:"#6B8299",marginLeft:4}}>de antecedência</span>
              </div>

              {/* Recorrência */}
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:"#6B8299"}}>Recorrência:</span>
                {[{v:"1",l:"1x/dia"},{v:"2",l:"2x/dia"},{v:"3",l:"3x/dia"}].map(({v,l})=>(
                  <button key={v} style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                    background:alertRecurrence===v?"#00C9A7":"#1E2D3D",color:alertRecurrence===v?"#0F1923":"#6B8299"}}
                    onClick={()=>saveAlertRecurrence(v)}>{l}</button>
                ))}
                <button style={{...s.btn(),fontSize:12,padding:"4px 14px",marginLeft:8}} onClick={sendAlertsNow} disabled={sendingAlert}>
                  {sendingAlert?"Enviando...":"▶ Enviar agora"}
                </button>
              </div>
              {alertCronExpr&&<div style={{fontSize:11,color:"#6B8299",marginBottom:16}}>📅 Agendamento automático ativo (cron: <code style={{color:"#00C9A7"}}>{alertCronExpr}</code>)</div>}

              {/* Cadastro de destinatários */}
              <div style={{background:"#0F1923",borderRadius:8,padding:"12px 14px",border:"1px solid #1E2D3D",marginBottom:16}}>
                <div style={{fontSize:11,color:"#6B8299",marginBottom:10,fontWeight:600}}>Destinatários dos alertas</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginBottom:10,alignItems:"flex-end"}}>
                  <div>
                    <div style={{fontSize:10,color:"#6B8299",marginBottom:3}}>Nome</div>
                    <input style={{...s.input,padding:"6px 10px",fontSize:12}} placeholder="Nome"
                      value={contactForm.name} onChange={e=>setContactForm(f=>({...f,name:e.target.value}))}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:"#6B8299",marginBottom:3}}>E-mail</div>
                    <input style={{...s.input,padding:"6px 10px",fontSize:12}} placeholder="email@gmail.com"
                      value={contactForm.email} onChange={e=>setContactForm(f=>({...f,email:e.target.value}))}/>
                  </div>
                  <button style={{...s.btn(),fontSize:12,padding:"6px 14px"}} onClick={addContact}>+ Adicionar</button>
                </div>
                {alertContacts.length===0
                  ? <div style={{fontSize:12,color:"#6B8299"}}>Nenhum destinatário cadastrado.</div>
                  : alertContacts.map(c=>(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",borderRadius:6,background:"#162130",marginBottom:4}}>
                      <div>
                        <span style={{fontSize:12,color:"#E8EDF2",fontWeight:600}}>{c.name}</span>
                        <span style={{fontSize:11,color:"#6B8299",marginLeft:10}}>{c.phone}</span>
                      </div>
                      <button style={{...s.btn("danger"),fontSize:11,padding:"3px 8px"}} onClick={()=>removeContact(c.id)}>✕</button>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Histórico de arquivos importados */}
            <div style={s.card}>
              <div style={{fontSize:13,fontWeight:600,color:"#00C9A7",marginBottom:14}}>Histórico de Importações</div>
              {(()=>{
                const extratos = {};
                transactions.filter(t=>t.source_file).forEach(t=>{
                  const batchKey = t.created_at ? t.created_at.slice(0,16) : "unknown";
                  const key = (t.conta||"sem conta") + "__" + batchKey;
                  if(!extratos[key]) extratos[key]={conta:t.conta||"sem conta",importedAt:batchKey,fileName:t.source_file||"—",count:0,min:"",max:"",ids:[]};
                  extratos[key].count++;
                  extratos[key].ids.push(t.id);
                  if(!extratos[key].min||dateToSortable(t.date)<dateToSortable(extratos[key].min)) extratos[key].min=t.date;
                  if(!extratos[key].max||dateToSortable(t.date)>dateToSortable(extratos[key].max)) extratos[key].max=t.date;
                });
                const rows = Object.values(extratos).sort((a,b)=>b.importedAt.localeCompare(a.importedAt));
                const fmtImport = iso => {
                  if(!iso||iso==="unknown") return "—";
                  const dt = new Date(iso+":00Z");
                  if(isNaN(dt)) return "—";
                  return dt.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).replace(",","");
                };
                if(!rows.length) return <div style={{color:"#6B8299",fontSize:13}}>Nenhum extrato importado ainda.</div>;
                return (
                  <table style={s.table}>
                    <thead><tr>
                      <th style={s.th}>Conta</th>
                      <th style={s.th}>Importado em</th>
                      <th style={s.th}>Lançamentos</th>
                      <th style={s.th}>Período início</th>
                      <th style={s.th}>Período fim</th>
                      <th style={s.th}>Arquivo</th>
                      <th style={s.th}></th>
                    </tr></thead>
                    <tbody>
                      {rows.map(r=>(
                        <tr key={r.conta+r.importedAt}>
                          <td style={s.td}>{r.conta}</td>
                          <td style={s.td}>{fmtImport(r.importedAt)}</td>
                          <td style={s.td}>{r.count}</td>
                          <td style={s.td}>{r.min||"—"}</td>
                          <td style={s.td}>{r.max||"—"}</td>
                          <td style={s.td}>{r.fileName}</td>
                          <td style={s.td}><button style={{...s.btn("danger"),fontSize:11,padding:"4px 10px"}} onClick={()=>setConfirmDeleteBatch(r)}>↩ Desfazer</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Detalhamentos salvos */}
            <div style={{...s.card,marginTop:16}}>
              <div style={{fontSize:13,fontWeight:600,color:"#00C9A7",marginBottom:14}}>Detalhamentos Vinculados</div>
              {Object.keys(transDetailsMap).length===0
                ? <div style={{color:"#6B8299",fontSize:13}}>Nenhum detalhamento salvo ainda.</div>
                : (()=>{
                    const linked = transactions.filter(t=>transDetailsMap[t.id]>0);
                    return (
                      <table style={s.table}>
                        <thead><tr>
                          <th style={s.th}>Data</th>
                          <th style={s.th}>Descrição</th>
                          <th style={s.th}>Itens</th>
                          <th style={s.th}>Valor</th>
                          <th style={{...s.th,width:60,textAlign:"center"}}>Ação</th>
                        </tr></thead>
                        <tbody>
                          {linked.map(t=>(
                            <tr key={t.id} style={{cursor:"pointer"}} onClick={()=>{setTab("lancamentos");setTimeout(()=>openDetailModal(t),100);}}>
                              <td style={s.td}>{t.date}</td>
                              <td style={{...s.td,maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</td>
                              <td style={s.td}><span style={{background:"rgba(0,201,167,0.15)",color:"#00C9A7",borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:700}}>📎{transDetailsMap[t.id]}</span></td>
                              <td style={{...s.td,fontWeight:600,color:Number(t.value)>=0?"#2ECC71":"#E8445A"}}>{fmt(Number(t.value))}</td>
                              <td style={{...s.td,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                                <button style={{...s.btn("danger"),padding:"3px 8px",fontSize:11}} onClick={()=>setConfirmDeleteDetail({id:t.id,description:t.description,count:transDetailsMap[t.id]})}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()
              }
            </div>
          </>
        )}

        {tab==="analise"&&(
          <AnaliseTab transactions={transactions} s={s} fmt={fmt}/>
        )}

      </div>{/* end main */}
      <div style={{position:"fixed",bottom:6,right:12,fontSize:10,color:"#6B8299",opacity:0.5,zIndex:50,fontFamily:"monospace"}}>Fluxo de Caixa-100726 V.6.19.5 · by MKK</div>

      {/* Modal lançamento / saldo */}
      {showModal&&(
        <div style={s.modal} onClick={()=>setShowModal(false)}>
          <div style={s.mbox} onClick={e=>e.stopPropagation()}>
            {modalMode==="saldo"?(
              <>
                <div style={{fontSize:17,fontWeight:700,marginBottom:6}}>Incluir Registro</div>
                <div style={{fontSize:13,color:"#6B8299",marginBottom:20}}>Informe o saldo inicial de abertura.</div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>Saldo Inicial (R$)</div>
                  <input style={s.input} placeholder="Ex: 7.351,01" value={saldoForm} onChange={e=>setSaldoForm(e.target.value)}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setShowModal(false)}>Cancelar</button>
                  <button style={{...s.btn(),flex:1}} onClick={saveSaldoInicial}>Salvar</button>
                </div>
              </>
            ):(
              <>
                <div style={{fontSize:16,fontWeight:700,marginBottom:12}}>{editingId?"Editar":"Novo"} Lançamento</div>
                {[{l:"Data",k:"date",ph:"DD/MM/AAAA"},{l:"Descrição",k:"description",ph:"Ex: RECEBIMENTO REDE VISA"}].map(({l,k,ph})=>(
                  <div key={k} style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>{l}</div>
                    <input style={{...s.input,padding:"7px 12px"}} placeholder={ph} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
                  </div>
                ))}
                {editingRazaoSocial&&(
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Razão Social</div>
                    <div style={{...s.input,padding:"7px 12px",color:"#8E7CC3",background:"#0F1923"}}>{editingRazaoSocial}</div>
                  </div>
                )}
                {[{l:"Valor (R$)",k:"value",ph:"Ex: 1.234,56"},{l:"Conta (opcional)",k:"conta",ph:"Ex: 1618994634"}].map(({l,k,ph})=>(
                  <div key={k} style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>{l}</div>
                    <input style={{...s.input,padding:"7px 12px"}} placeholder={ph} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
                  </div>
                ))}
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>R/D</div>
                  <select style={{...s.input,padding:"7px 12px"}} value={form.rd} onChange={e=>setForm(f=>({...f,rd:e.target.value}))}>
                    {RD_TYPES.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Classificação</div>
                  <select style={{...s.input,padding:"7px 12px"}} value={form.classificacao} onChange={e=>setForm(f=>({...f,classificacao:e.target.value}))}>
                    <option value="">Selecione...</option>
                    {allClassificacoes.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Subcategoria</div>
                  <input style={{...s.input,padding:"7px 12px"}} placeholder="Ex: PAGAMENTOS TRIB" value={form.subcategoria||""} onChange={e=>setForm(f=>({...f,subcategoria:e.target.value}))}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setShowModal(false)}>Cancelar</button>
                  <button style={{...s.btn(),flex:1}} onClick={saveManual} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm clear */}
      {showConfirmClear&&(
        <div style={s.modal} onClick={()=>setShowConfirmClear(false)}>
          <div style={s.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:10}}>🗑 Limpar todos os dados?</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:24}}>Apaga <strong style={{color:"#E8EDF2"}}>todos os lançamentos</strong> do banco para todos os usuários. Irreversível.</div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setShowConfirmClear(false)}>Cancelar</button>
              <button style={{...s.btn("danger"),flex:1}} onClick={clearAll}>Sim, apagar tudo</button>
            </div>
          </div>
        </div>
      )}

      {/* Agenda Modal */}
      {showAgendaModal&&(
        <div style={s.modal} onClick={()=>{setShowAgendaModal(false);setKwSuggestions(null);}}>
          <div style={s.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:20}}>{editingAgenda?"Editar":"Novo"} Compromisso</div>
            {[{l:"Nome",k:"nome",ph:"Ex: Aluguel"},{l:"Tipo (opcional)",k:"tipo",ph:"Ex: DP"},{l:"Dia de vencimento",k:"dia_vencimento",ph:"Ex: 5"}].map(({l,k,ph})=>(
              <div key={k} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>{l}</div>
                <input style={s.input} placeholder={ph} value={agendaForm[k]} onChange={e=>setAgendaForm(f=>({...f,[k]:e.target.value}))}/>
              </div>
            ))}
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:12,color:"#6B8299"}}>Keywords (separadas por vírgula)</div>
                <button style={{background:"transparent",border:"1px solid #00C9A7",color:"#00C9A7",borderRadius:6,fontSize:11,padding:"2px 10px",cursor:"pointer",fontWeight:600}} onClick={()=>{
                  if(!agendaForm.nome.trim()) return;
                  const norm=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
                  const words = norm(agendaForm.nome).split(/\s+/).filter(w=>w.length>2);
                  const now2 = new Date();
                  const recentMonths = [0,1,2,3,4,5].map(i=>{
                    const d=new Date(now2.getFullYear(),now2.getMonth()-i,1);
                    return {m:String(d.getMonth()+1).padStart(2,"0"),a:String(d.getFullYear())};
                  });
                  const matches = transactions.filter(t=>{
                    const p=t.date?.split("/");
                    if(!p) return false;
                    if(!recentMonths.some(rm=>rm.m===p[1]&&rm.a===p[2])) return false;
                    return words.some(w=>norm(t.description||"").includes(w));
                  });
                  const seen=new Set((agendaForm.keywords||"").split(",").map(k=>k.trim().toUpperCase()));
                  const seenNorm=new Set((agendaForm.keywords||"").split(",").map(k=>norm(k.trim())));
                  const allDescs=[...new Set(matches.map(t=>t.description?.toUpperCase().trim()).filter(Boolean))];
                  const nomeWords=agendaForm.nome.trim().split(/\s+/).filter(w=>w.length>2&&!seenNorm.has(norm(w)));
                  const sugs=[...new Set([...nomeWords,...allDescs.filter(d=>!seen.has(d))])].slice(0,10);
                  setKwSuggestions({sugs,allKnown:allDescs.length>0&&sugs.length===0});
                }}>🔍 Sugerir</button>
              </div>
              <input style={s.input} placeholder="Ex: aluguel, locação" value={agendaForm.keywords} onChange={e=>{setAgendaForm(f=>({...f,keywords:e.target.value}));setKwSuggestions(null);}}/>
              {kwSuggestions&&kwSuggestions.sugs.length>0&&(
                <div style={{marginTop:8,padding:"10px 12px",background:"rgba(0,201,167,0.06)",borderRadius:8,border:"1px solid rgba(0,201,167,0.15)"}}>
                  <div style={{fontSize:10,color:"#6B8299",marginBottom:6}}>Clique para adicionar como keyword:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {kwSuggestions.sugs.map((sug,i)=>(
                      <span key={i} onClick={()=>{
                        const cur=(agendaForm.keywords||"").split(",").map(k=>k.trim()).filter(Boolean);
                        if(!cur.map(k=>k.toUpperCase()).includes(sug.toUpperCase())){
                          setAgendaForm(f=>({...f,keywords:[...cur,sug].join(", ")}));
                        }
                        setKwSuggestions(prev=>({...prev,sugs:prev.sugs.filter((_,j)=>j!==i)}));
                      }} style={{fontSize:10,background:"#1E2D3D",border:"1px solid #2A3F52",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"#E8EDF2",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:200}}>
                        + {sug}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {kwSuggestions===null&&agendaForm.nome&&<div style={{fontSize:10,color:"#4A5E6D",marginTop:4}}>Clique em "Sugerir" para buscar lançamentos dos últimos 6 meses.</div>}
              {kwSuggestions!==null&&kwSuggestions.sugs.length===0&&!kwSuggestions.allKnown&&<div style={{fontSize:10,color:"#4A5E6D",marginTop:4}}>Nenhuma sugestão encontrada nos últimos 6 meses.</div>}
              {kwSuggestions?.allKnown&&<div style={{fontSize:10,color:"#00C9A7",marginTop:4}}>As descrições encontradas já constam nas keywords.</div>}
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>R/D</div>
              <select style={{...s.input}} value={agendaForm.rd} onChange={e=>setAgendaForm(f=>({...f,rd:e.target.value}))}>
                {RD_TYPES.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>Classificação</div>
              <select style={{...s.input}} value={agendaForm.classificacao} onChange={e=>setAgendaForm(f=>({...f,classificacao:e.target.value}))}>
                <option value="">Selecione...</option>
                {allClassificacoes.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{fontSize:11,color:"#6B8299",marginBottom:16,padding:"8px 12px",background:"rgba(0,201,167,0.05)",borderRadius:8}}>
              💡 Keywords usadas para correlacionar com lançamentos importados.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setShowAgendaModal(false)}>Cancelar</button>
              <button style={{...s.btn(),flex:1}} onClick={saveAgendaItem}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Reclassify Modal */}
      {reclassifyList&&(
        <div style={s.modal} onClick={()=>setReclassifyList(null)}>
          <div style={{...s.mbox,maxWidth:680}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Reclassificar Lançamentos</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:4}}>{reclassifyList.items.length} lançamento(s) batem com a nova keyword.</div>
            <div style={{fontSize:12,color:"#00C9A7",marginBottom:16}}>Nova: <strong>{reclassifyList.rd} / {reclassifyList.classificacao}</strong></div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <button style={{...s.btn("ghost"),fontSize:12,padding:"5px 12px"}} onClick={()=>setReclassifySelected(reclassifyList.items.map(t=>t.id))}>Selecionar todos</button>
              <button style={{...s.btn("ghost"),fontSize:12,padding:"5px 12px"}} onClick={()=>setReclassifySelected([])}>Desmarcar todos</button>
            </div>
            <div style={{maxHeight:300,overflowY:"auto",marginBottom:16}}>
              {reclassifyList.items.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #1E2D3D"}}>
                  <input type="checkbox" checked={reclassifySelected.includes(t.id)}
                    onChange={e=>setReclassifySelected(prev=>e.target.checked?[...prev,t.id]:prev.filter(x=>x!==t.id))}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600}}>{t.description}</div>
                    <div style={{fontSize:11,color:"#6B8299"}}>{t.date} · {fmt(Math.abs(Number(t.value)))} · {t.rd}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setReclassifyList(null)}>Cancelar</button>
              <button style={{...s.btn(),flex:1}} onClick={applyReclassify} disabled={reclassifySelected.length===0}>
                Aplicar em {reclassifySelected.length} lançamento(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sem Match Modal */}
      {showSemMatchModal&&reconciliarModal&&(
        <div style={s.modal} onClick={()=>setShowSemMatchModal(false)}>
          <div style={{...s.mbox,maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Itens sem match</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:16}}>Compromissos de {MONTHS[reconciliarModal.mes-1]}/{reconciliarModal.ano} sem lançamento correspondente. Clique em 🔗 para associar manualmente.</div>
            <div style={{maxHeight:400,overflowY:"auto"}}>
              {reconciliarModal.items.filter(item=>{
                const oc=getOcorrencia(item.id,reconciliarModal.mes,reconciliarModal.ano);
                return oc?.status!=="pago"&&oc?.status!=="baixado";
              }).map(item=>(
                <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1E2D3D"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{item.nome}</div>
                    <div style={{fontSize:11,color:"#6B8299"}}>Dia {item.dia_vencimento} · {item.tipo||"—"}</div>
                  </div>
                  <button style={{...s.btn("ghost"),fontSize:12,padding:"4px 10px"}}
                    onClick={()=>{
                      const oc=getOcorrencia(item.id,reconciliarModal.mes,reconciliarModal.ano);
                      if(!oc) return;
                      setShowSemMatchModal(false);
                      setAssociating({ocId:oc.id,agendaId:item.id,nome:item.nome,mes:reconciliarModal.mes,ano:reconciliarModal.ano});
                    }}>🔗 Associar</button>
                </div>
              ))}
            </div>
            <button style={{...s.btn("ghost"),width:"100%",marginTop:14}} onClick={()=>setShowSemMatchModal(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Associate Modal */}
      {associating&&(
        <div style={s.modal} onClick={()=>setAssociating(null)}>
          <div style={{...s.mbox,maxWidth:640}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Associar Lançamento</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:16}}>Selecione o lançamento que quitou: <strong style={{color:"#E8EDF2"}}>{associating.nome}</strong> em {MONTHS[associating.mes-1]}/{associating.ano}</div>
            <div style={{maxHeight:350,overflowY:"auto"}}>
              {transactions.filter(t=>{
                const p=t.date?.split("/");
                return p?.length===3&&parseInt(p[1])===associating.mes&&parseInt(p[2])===associating.ano&&Number(t.value)<0;
              }).map(t=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1E2D3D",cursor:"pointer"}}
                  onClick={()=>associateTransaction(associating.ocId,t.id)}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{t.description}</div>
                    <div style={{fontSize:11,color:"#6B8299"}}>{t.date} · {t.rd}</div>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:"#E8445A"}}>{fmt(Number(t.value))}</span>
                </div>
              ))}
            </div>
            <button style={{...s.btn("ghost"),width:"100%",marginTop:14}} onClick={()=>setAssociating(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {confirmDeleteBatch&&(
        <div style={s.modal} onClick={()=>setConfirmDeleteBatch(null)}>
          <div style={{...s.mbox,maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:10}}>↩ Desfazer importação</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:8}}>
              Conta: <strong style={{color:"#fff"}}>{confirmDeleteBatch.conta}</strong><br/>
              Importado em: <strong style={{color:"#fff"}}>{confirmDeleteBatch.importedAt}</strong><br/>
              Período: <strong style={{color:"#fff"}}>{confirmDeleteBatch.min} → {confirmDeleteBatch.max}</strong>
            </div>
            <div style={{background:"#1a1a2e",border:"1px solid #E8445A44",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#E8445A",marginBottom:20}}>
              ⚠ Atenção: <strong>{confirmDeleteBatch.count} lançamentos</strong> serão excluídos permanentemente. Classificações e detalhamentos vinculados também serão perdidos. O arquivo poderá ser reimportado após a exclusão.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setConfirmDeleteBatch(null)}>Cancelar</button>
              <button style={{...s.btn("danger"),flex:1}} onClick={doDeleteBatch}>Sim, desfazer importação</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDetail&&(
        <div style={s.modal} onClick={()=>setConfirmDeleteDetail(null)}>
          <div style={{...s.mbox,maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:10}}>🗑 Remover detalhamento</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:8}}>
              Lançamento: <strong style={{color:"#fff"}}>{confirmDeleteDetail.description}</strong>
            </div>
            <div style={{fontSize:13,color:"#F5A623",marginBottom:20}}>
              ⚠ Atenção: <strong>{confirmDeleteDetail.count} itens</strong> serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setConfirmDeleteDetail(null)}>Cancelar</button>
              <button style={{...s.btn("danger"),flex:1}} onClick={async()=>{
                const {error} = await supabase.from("transaction_details").delete().eq("transaction_id",confirmDeleteDetail.id);
                if(error){showToast("Erro: "+error.message,"error");setConfirmDeleteDetail(null);return;}
                await loadDetailsMap();
                showToast("Detalhamento removido.");
                setConfirmDeleteDetail(null);
              }}>Sim, remover</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete&&(
        <div style={s.modal} onClick={()=>setConfirmDelete(null)}>
          <div style={{...s.mbox,maxWidth:380}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:10}}>🗑 Confirmar exclusão</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:24}}>Tem certeza? Esta ação não pode ser desfeita.</div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setConfirmDelete(null)}>Cancelar</button>
              <button style={{...s.btn("danger"),flex:1}} onClick={doDelete}>Sim, excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewItems&&(
        <ReviewModal items={reviewItems} onConfirm={confirmReview} onCancel={cancelReview} allClassificacoes={allClassificacoes}/>
      )}

      {/* Similar pending panel */}
      {similarPending&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}>
          <div style={{background:"#162130",borderRadius:16,padding:24,width:"100%",maxWidth:700,border:"1px solid #F5A623",maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{fontSize:16,fontWeight:700,color:"#F5A623",marginBottom:4}}>⚡ Transações similares encontradas</div>
            <div style={{fontSize:13,color:"#6B8299",marginBottom:16}}>{similarPending.items.length} lançamento(s) com padrão semelhante ainda marcado(s) para revisão — deseja classificar?</div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:320,overflowY:"auto",marginBottom:16}}>
              {similarPending.items.map(t=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,padding:"6px 10px",borderRadius:6,background:"rgba(245,166,35,0.05)",border:"1px solid rgba(245,166,35,0.15)"}}>
                  <span style={{color:"#E8EDF2",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.date} — {t.description}</span>
                  <span style={{marginLeft:12,flexShrink:0,color:"#00C9A7",fontWeight:600,fontSize:11}}>{t.suggestedRd} / {t.suggestedClass}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:applyingSimilar?"default":"pointer",fontWeight:700,background:"#00C9A7",color:"#0F1923",opacity:applyingSimilar?0.6:1}} disabled={applyingSimilar} onClick={()=>confirmSimilarPending(true)}>{applyingSimilar?"Aplicando...":`✓ Aplicar em todos (${similarPending.items.length})`}</button>
              <button style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,background:"#1E2D3D",color:"#6B8299"}} disabled={applyingSimilar} onClick={()=>confirmSimilarPending(false)}>Pular</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal — v3.0 */}
      {detailModal&&(
        <div style={{...s.modal,zIndex:250}} onClick={()=>setDetailModal(null)}>
          <div style={{background:"#162130",borderRadius:16,padding:28,width:"100%",maxWidth:900,border:"1px solid #1E2D3D",maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:17,fontWeight:700}}>📎 Detalhamento de Lançamento</div>
                <div style={{fontSize:12,color:"#6B8299",marginTop:4}}>{detailModal.date} · {detailModal.description}</div>
                <div style={{fontSize:13,fontWeight:700,color:Number(detailModal.value)>=0?"#2ECC71":"#E8445A",marginTop:2}}>{fmt(Number(detailModal.value))}</div>
              </div>
              <button style={{background:"none",border:"none",color:"#6B8299",cursor:"pointer",fontSize:20}} onClick={()=>setDetailModal(null)}>✕</button>
            </div>

            {/* Upload area (shown when no items) */}
            {!detailLoading&&detailItems.length===0&&(
              <div style={{border:"2px dashed #1E2D3D",borderRadius:12,padding:40,textAlign:"center",marginBottom:16,cursor:"pointer"}}
                onClick={()=>document.getElementById("detailFileInput").click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#00C9A7"}}
                onDragLeave={e=>{e.currentTarget.style.borderColor="#1E2D3D"}}
                onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="#1E2D3D";const f=e.dataTransfer.files[0];if(f) handleDetailFile(f,detailModal);}}>
                <div style={{fontSize:32,marginBottom:8}}>📊</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Upload da Fatura do Cartão (Excel .xlsx)</div>
                <div style={{fontSize:12,color:"#6B8299"}}>Itaú · col0=data · col2=descrição · col10=valor · dados a partir da linha 27</div>
              </div>
            )}
            <input id="detailFileInput" type="file" accept=".xlsx,.xls" style={{display:"none"}}
              onChange={e=>{const f=e.target.files[0];if(f){handleDetailFile(f,detailModal);e.target.value="";}}}/>

            {detailLoading&&(
              <div style={{textAlign:"center",padding:32,color:"#00C9A7"}}>⏳ Processando...</div>
            )}

            {/* Confirmação: fatura de cartão? */}
            {detailPendingFile&&!detailLoading&&(
              <div style={{background:"#0F1923",borderRadius:12,padding:24,border:"1px solid #F5A623",textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:22,marginBottom:10}}>💳</div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Este arquivo é uma fatura de cartão?</div>
                <div style={{fontSize:12,color:"#6B8299",marginBottom:20}}>Faturas de cartão têm valores positivos que são despesas — eles serão invertidos automaticamente.</div>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <button style={{...s.btn("ghost"),minWidth:120}} onClick={()=>processDetailFile(detailPendingFile,detailModal,false)}>Não, é extrato</button>
                  <button style={{...s.btn(),minWidth:120}} onClick={()=>processDetailFile(detailPendingFile,detailModal,true)}>Sim, é fatura 💳</button>
                </div>
              </div>
            )}

            {/* Items loaded */}
            {!detailLoading&&detailItems.length>0&&(()=>{
              const totalItems = detailItems.reduce((s,d)=>s+Number(d.value),0);
              const parent = Number(detailModal.value);
              const diff = totalItems - parent;
              const match = Math.abs(diff) < 0.02;
              return (
                <>
                  {/* Totals summary */}
                  <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
                    <div style={{flex:1,background:"#0F1923",borderRadius:8,padding:"10px 14px",border:"1px solid #1E2D3D"}}>
                      <div style={{fontSize:10,color:"#6B8299",textTransform:"uppercase"}}>Lançamento Pai</div>
                      <div style={{fontSize:15,fontWeight:700,color:parent>=0?"#2ECC71":"#E8445A"}}>{fmt(parent)}</div>
                    </div>
                    <div style={{flex:1,background:"#0F1923",borderRadius:8,padding:"10px 14px",border:"1px solid #1E2D3D"}}>
                      <div style={{fontSize:10,color:"#6B8299",textTransform:"uppercase"}}>Total Itens</div>
                      <div style={{fontSize:15,fontWeight:700,color:totalItems>=0?"#2ECC71":"#E8445A"}}>{fmt(totalItems)}</div>
                    </div>
                    <div style={{flex:1,background:"#0F1923",borderRadius:8,padding:"10px 14px",border:`1px solid ${match?"#00C9A7":"#F5A623"}`}}>
                      <div style={{fontSize:10,color:"#6B8299",textTransform:"uppercase"}}>Diferença</div>
                      <div style={{fontSize:15,fontWeight:700,color:match?"#00C9A7":"#F5A623"}}>{match?"✓ Confere":fmt(diff)}</div>
                    </div>
                    <div style={{flex:1,background:"#0F1923",borderRadius:8,padding:"10px 14px",border:"1px solid #1E2D3D"}}>
                      <div style={{fontSize:10,color:"#6B8299",textTransform:"uppercase"}}>Itens</div>
                      <div style={{fontSize:15,fontWeight:700}}>
                        {detailItems.filter(d=>d.needs_review).length>0
                          ?<span style={{color:"#F5A623"}}>⚠ {detailItems.filter(d=>d.needs_review).length} p/ revisar</span>
                          :<span style={{color:"#00C9A7"}}>✓ {detailItems.length} ok</span>}
                      </div>
                    </div>
                  </div>

                  {/* Upload another */}
                  <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                    <button style={{...s.btn("ghost"),fontSize:12,padding:"6px 12px"}} onClick={()=>document.getElementById("detailFileInput").click()}>↑ Trocar arquivo</button>
                  </div>

                  {/* Items table */}
                  <div style={{maxHeight:340,overflowY:"auto",marginBottom:14}}>
                    <table style={s.table}>
                      <thead style={{position:"sticky",top:0,zIndex:5,background:"#162130"}}>
                        <tr>
                          {[{l:"Data",k:"date"},{l:"Descrição",k:"description"},{l:"Valor",k:"value"},{l:"R/D",k:"rd"},{l:"Classificação",k:"classificacao"},{l:"Subcategoria",k:"subcategoria"},{l:"Keywords",k:null}].map(({l,k})=>(
                            <th key={l} style={{...s.th,cursor:k?"pointer":"default",userSelect:"none",textAlign:l==="Valor"?"right":"left"}}
                              onClick={()=>{if(!k)return;if(detailSortCol===k)setDetailSortDir(d=>d==="asc"?"desc":"asc");else{setDetailSortCol(k);setDetailSortDir("asc");}}}>
                              {l}{k&&detailSortCol===k?(detailSortDir==="asc"?" ↑":" ↓"):""}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...detailItems].sort((a,b)=>{
                          const av = detailSortCol==="value"?Number(a.value):(a[detailSortCol]||"").toLowerCase();
                          const bv = detailSortCol==="value"?Number(b.value):(b[detailSortCol]||"").toLowerCase();
                          return detailSortDir==="asc"?(av>bv?1:av<bv?-1:0):(av<bv?1:av>bv?-1:0);
                        }).map((item,idx)=>(
                          <tr key={idx} style={item.needs_review?{background:"rgba(245,166,35,0.06)"}:{}}>
                            <td style={{...s.td,whiteSpace:"nowrap"}}>{item.date}</td>
                            <td style={{...s.td,maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={item.description}>
                              {item.needs_review&&<span style={{color:"#F5A623",marginRight:4}}>⚠</span>}
                              {item.description}
                            </td>
                            <td style={{...s.td,textAlign:"right",fontWeight:600,color:Number(item.value)>=0?"#2ECC71":"#E8445A",whiteSpace:"nowrap"}}>{fmt(Number(item.value))}</td>
                            <td style={s.td}>
                              <select style={{background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"3px 6px",color:"#E8EDF2",fontSize:11,width:"100%"}}
                                value={item.rd||""} onChange={e=>updateDetailItem(idx,"rd",e.target.value)}>
                                <option value="">—</option>
                                {RD_TYPES.map(r=><option key={r}>{r}</option>)}
                              </select>
                            </td>
                            <td style={s.td}>
                              <select style={{background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"3px 6px",color:"#E8EDF2",fontSize:11,width:"100%"}}
                                value={item.classificacao||""} onChange={e=>updateDetailItem(idx,"classificacao",e.target.value)}>
                                <option value="">—</option>
                                {allClassificacoes.map(c=><option key={c}>{c}</option>)}
                              </select>
                            </td>
                            <td style={s.td}>
                              <input style={{background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"3px 6px",color:"#E8EDF2",fontSize:11,width:"100%"}}
                                placeholder="—" value={item.subcategoria||""}
                                onChange={e=>updateDetailItem(idx,"subcategoria",e.target.value)}/>
                            </td>
                            <td style={s.td}>
                              <input style={{background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"3px 6px",color:"#E8EDF2",fontSize:11,width:"100%"}}
                                placeholder="kw1, kw2" value={(item.keywords||[]).join(", ")}
                                onChange={e=>updateDetailItem(idx,"keywords",e.target.value.split(",").map(k=>k.trim()).filter(Boolean))}/>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer buttons */}
                  <div style={{display:"flex",gap:10}}>
                    <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setDetailModal(null)}>Cancelar</button>
                    <button style={{...s.btn(),flex:2}} onClick={saveDetailItems} disabled={detailSaving}>
                      {detailSaving?"Salvando...":"💾 Salvar Detalhamento"}
                    </button>
                  </div>
                </>
              );
            })()}

            {/* No items yet and not loading — show only upload */}
            {!detailLoading&&detailItems.length===0&&(
              <div style={{display:"flex",gap:10,marginTop:8}}>
                <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setDetailModal(null)}>Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Column Mapper Modal — v3.3 */}
      {columnMapper&&(
        <div style={{...s.modal,zIndex:300}} onClick={()=>setColumnMapper(null)}>
          <div style={{background:"#162130",borderRadius:16,padding:28,width:"100%",maxWidth:760,border:"1px solid #1E2D3D",maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontSize:17,fontWeight:700}}>🗂 Mapeamento de Colunas</div>
                <div style={{fontSize:12,color:"#6B8299",marginTop:4}}>{columnMapper.file.name} · {columnMapper.headers.length} colunas detectadas</div>
              </div>
              <button style={{background:"none",border:"none",color:"#6B8299",cursor:"pointer",fontSize:20}} onClick={()=>setColumnMapper(null)}>✕</button>
            </div>

            {/* Preview table */}
            <div style={{marginBottom:16,overflowX:"auto"}}>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:6,textTransform:"uppercase"}}>Prévia do arquivo</div>
              <table style={{...s.table,fontSize:11}}>
                <thead>
                  <tr>{columnMapper.headers.map((h,i)=>(
                    <th key={i} style={{...s.th,background:
                      columnMapper.map.date===i?"rgba(0,201,167,0.15)":
                      columnMapper.map.desc===i?"rgba(46,204,113,0.1)":
                      columnMapper.map.val===i?"rgba(232,68,90,0.1)":
                      columnMapper.map.razaoSocial===i?"rgba(142,124,195,0.15)":"transparent"
                    }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {columnMapper.preview.map((row,ri)=>(
                    <tr key={ri}>{row.map((cell,ci)=>(
                      <td key={ci} style={{...s.td,background:
                        columnMapper.map.date===ci?"rgba(0,201,167,0.07)":
                        columnMapper.map.desc===ci?"rgba(46,204,113,0.05)":
                        columnMapper.map.val===ci?"rgba(232,68,90,0.05)":
                        columnMapper.map.razaoSocial===ci?"rgba(142,124,195,0.07)":"transparent"
                      ,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cell}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Field mapping */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[
                {label:"📅 Data",key:"date",required:true,color:"#00C9A7"},
                {label:"📝 Descrição",key:"desc",required:true,color:"#2ECC71"},
                {label:"💰 Valor",key:"val",required:true,color:"#E8445A"},
                {label:"🏦 Conta",key:"conta",required:false,color:"#6B8299"},
                {label:"🏢 Razão Social",key:"razaoSocial",required:false,color:"#8E7CC3"},
              ].map(({label,key,required,color})=>(
                <div key={key} style={{background:"#0F1923",borderRadius:8,padding:"10px 14px",border:`1px solid ${color}22`}}>
                  <div style={{fontSize:11,color,marginBottom:6,fontWeight:600}}>{label} {required&&<span style={{color:"#E8445A"}}>*</span>}</div>
                  {key==="conta"&&columnMapper.autoContaValue
                    ? <div style={{background:"#162130",border:"1px solid #1E2D3D",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#00C9A7"}}>
                        ✓ Detectado automaticamente: <strong>{columnMapper.autoContaValue}</strong>
                      </div>
                    : <select style={{...s.input,padding:"6px 10px",fontSize:12}}
                        value={columnMapper.map[key]}
                        onChange={e=>setColumnMapper(m=>({...m,map:{...m.map,[key]:Number(e.target.value)}}))}>
                        {!required&&<option value={-1}>— não importar —</option>}
                        {columnMapper.headers.map((h,i)=><option key={i} value={i}>{h||`col ${i}`}</option>)}
                      </select>
                  }
                </div>
              ))}
            </div>

            {/* Tipo arquivo — só para detalhe */}
            {columnMapper.mode==="detalhe"&&(
              <div style={{background:"#0F1923",borderRadius:8,padding:"12px 14px",border:"1px solid #1E2D3D",marginBottom:16}}>
                <div style={{fontSize:11,color:"#6B8299",marginBottom:8,fontWeight:600}}>Tipo de arquivo</div>
                <div style={{display:"flex",gap:16}}>
                  {[{v:false,l:"Extrato bancário"},{v:true,l:"💳 Fatura de cartão (inverte sinal)"}].map(({v,l})=>(
                    <label key={String(v)} style={{fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                      <input type="radio" name="mapperTipo" checked={columnMapper.isCartao===v}
                        onChange={()=>setColumnMapper(m=>({...m,isCartao:v}))}/>
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:10}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setColumnMapper(null)}>Cancelar</button>
              <button style={{...s.btn(),flex:2}} onClick={processColumnMapper}>✓ Confirmar e processar</button>
            </div>
          </div>
        </div>
      )}

      {/* Extras Mensal Modal */}
      {showExtrasModal&&(
        <div style={{...s.modal,zIndex:260}} onClick={()=>setShowExtrasModal(false)}>
          <div style={{background:"#162130",borderRadius:16,padding:28,width:"100%",maxWidth:520,border:"1px solid #1E2D3D",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Investimentos / Contas a Receber</div>
            <div style={{fontSize:12,color:"#6B8299",marginBottom:20}}>Informe os valores por mês. A coluna Total exibirá o valor do último mês registrado.</div>
            {MONTHS.filter(m=>transactions.some(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m;})).map(m=>{
              const mIdx = String(MONTHS.indexOf(m)+1);
              return (
                <div key={m} style={{marginBottom:16,background:"#0F1923",borderRadius:8,padding:"12px 14px",border:"1px solid #1E2D3D"}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#E8EDF2",marginBottom:10}}>{m}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:11,color:"#00C9A7",marginBottom:4}}>Investimentos (R$)</div>
                      <input type="number" step="0.01" style={{...s.input,padding:"6px 10px",fontSize:12}}
                        defaultValue={(extrasMonthly.investimentos||{})[mIdx]||""}
                        onBlur={e=>saveExtraMonthly("investimentos",mIdx,parseFloat(e.target.value)||0)}
                        placeholder="0,00"/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#2ECC71",marginBottom:4}}>Contas a Receber (R$)</div>
                      <input type="number" step="0.01" style={{...s.input,padding:"6px 10px",fontSize:12}}
                        defaultValue={(extrasMonthly.contasReceber||{})[mIdx]||""}
                        onBlur={e=>saveExtraMonthly("contasReceber",mIdx,parseFloat(e.target.value)||0)}
                        placeholder="0,00"/>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setShowExtrasModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <input id="fileInput" type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}}
        onChange={e=>{const f=e.target.files[0];if(f){handleFile(f);e.target.value="";}}}/>

      {toast&&<div style={s.toast(toast.kind)}>{toast.msg}</div>}
    </div>
  );
}