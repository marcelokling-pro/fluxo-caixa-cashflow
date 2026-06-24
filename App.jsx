import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xioqemsshqxagvwdttte.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpb3FlbXNzaHF4YWd2d2R0dHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDI4OTYsImV4cCI6MjA5NzIxODg5Nn0.M8CVGaRerGT1wlwnO9Mql2ddaX9rL6fh82GkDbLBZIQ";
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
  {d:"JUROS DE APLICAÇÃO",r:"INVESTIMENTOS",      c:"RECEITA DE INVESTIMENTOS"},
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

const parseValue = (raw) => {
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

// ── FIX #2: localClassify — longest match wins, custom cats checked first ────
const localClassify = (desc, customCats = []) => {
  const d = String(desc).toUpperCase().trim();
  // Check custom categories first (user-defined takes priority)
  for (const cat of [...customCats].sort((a,b) => b.name.length - a.name.length)) {
    if (d.includes(cat.name.toUpperCase())) return { r: cat.rd, c: cat.classificacao };
  }
  // Then base classifications (already sorted by length desc)
  for (const cls of SORTED_CLASSIFICATIONS) {
    if (d.includes(cls.d.toUpperCase().trim())) return { r: cls.r, c: cls.c };
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
// CLASSIFICAÇÕES TAB — unified, editable, searchable
// ══════════════════════════════════════════════════════════════════════════════
const ClassificacoesTab = ({customCats, loadCustomCats, showToast, s}) => {
  const [search, setSearch] = useState("");
  const [filterRd, setFilterRd] = useState("todos");
  const [editingRow, setEditingRow] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({detalhe:"", rd:"RECEITA", classificacao:"RECEITA DE VENDAS"});
  const [saving, setSaving] = useState(false);

  const allRows = useMemo(() => {
    const custom = customCats.map(c=>({
      id: c.id,
      detalhe: c.name||"",
      rd: c.rd||c.keywords?.[0]||"",
      classificacao: c.classificacao||"",
      isCustom: true
    }));
    const customNames = new Set(custom.map(c=>c.detalhe.toUpperCase()));
    const base = BASE_CLASSIFICATIONS
      .filter(c => !customNames.has(c.d.toUpperCase().trim()))
      .map(c=>({id:"base_"+c.d, detalhe:c.d, rd:c.r, classificacao:c.c, isCustom:false}));
    return [...custom, ...base].sort((a,b)=>a.detalhe.localeCompare(b.detalhe));
  }, [customCats]);

  const filtered = useMemo(() => allRows.filter(r => {
    const ms = !search || r.detalhe.toLowerCase().includes(search.toLowerCase()) || r.classificacao.toLowerCase().includes(search.toLowerCase());
    const mr = filterRd==="todos" || r.rd===filterRd;
    return ms && mr;
  }), [allRows, search, filterRd]);

  const saveEdit = async () => {
    if (!editingRow?.detalhe.trim()) { showToast("Descrição obrigatória.","error"); return; }
    setSaving(true);
    if (editingRow.isCustom && !editingRow.id.startsWith("base_")) {
      await supabase.from("categories").update({
        name: editingRow.detalhe.trim().toUpperCase(),
        rd: editingRow.rd, classificacao: editingRow.classificacao,
        keywords: [editingRow.detalhe.trim().toLowerCase()],
      }).eq("id", editingRow.id);
      showToast("Classificação atualizada!");
    } else {
      // Editing a base entry: upsert custom override
      const {error} = await supabase.from("categories").upsert({
        name: editingRow.detalhe.trim().toUpperCase(),
        rd: editingRow.rd, classificacao: editingRow.classificacao,
        keywords: [editingRow.detalhe.trim().toLowerCase()],
      }, {onConflict:"name"});
      if (error) showToast("Erro: "+error.message,"error");
      else showToast("Classificação salva!");
    }
    await loadCustomCats(); setEditingRow(null); setSaving(false);
  };

  const saveNew = async () => {
    if (!newRow.detalhe.trim()) { showToast("Descrição obrigatória.","error"); return; }
    setSaving(true);
    const name = newRow.detalhe.trim().toUpperCase();
    // Try upsert: insert or update on conflict
    const {error} = await supabase.from("categories").upsert({
      name, rd: newRow.rd, classificacao: newRow.classificacao,
      keywords: [newRow.detalhe.trim().toLowerCase()],
    }, {onConflict:"name"});
    if (error) { showToast("Erro ao salvar: "+error.message,"error"); }
    else showToast("Classificação salva!");
    await loadCustomCats();
    setNewRow({detalhe:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS"});
    setShowAdd(false); setSaving(false);
  };

  const deleteCustom = async (id) => {
    await supabase.from("categories").delete().eq("id",id);
    await loadCustomCats(); showToast("Removida.");
  };

  const II = {background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"5px 8px",color:"#E8EDF2",fontSize:12,width:"100%",boxSizing:"border-box"};
  const IS = {background:"#0F1923",border:"1px solid #1E2D3D",borderRadius:6,padding:"5px 8px",color:"#E8EDF2",fontSize:12,width:"100%"};
  const allCls = [...new Set([...CLASSIFICACOES,...customCats.map(c=>c.classificacao||"").filter(Boolean)])].sort();

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontSize:21,fontWeight:700}}>Classificações</div>
          <div style={{fontSize:13,color:"#6B8299",marginTop:2}}>{filtered.length} de {allRows.length} · {customCats.length} personalizadas</div>
        </div>
        <button style={s.btn()} onClick={()=>setShowAdd(a=>!a)}>{showAdd?"✕ Cancelar":"+ Nova Classificação"}</button>
      </div>

      {showAdd&&(
        <div style={{...s.card,marginBottom:16,border:"1px solid #00C9A7"}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14,color:"#00C9A7"}}>Nova Classificação</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
            <div>
              <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>Descrição / Palavra-chave</div>
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
            <button style={{...s.btn(),padding:"8px 16px"}} onClick={saveNew} disabled={saving}>{saving?"...":"Salvar"}</button>
          </div>
          <div style={{fontSize:11,color:"#6B8299",marginTop:10}}>💡 Quanto mais específica a palavra-chave, melhor a correspondência automática.</div>
        </div>
      )}

      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <input style={{...s.input,flex:1}} placeholder="🔍 Buscar por descrição ou classificação..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={s.sel} value={filterRd} onChange={e=>setFilterRd(e.target.value)}>
          <option value="todos">Todos R/D</option>
          {RD_TYPES.map(r=><option key={r}>{r}</option>)}
        </select>
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Descrição / Palavra-chave</th>
              <th style={s.th}>R/D</th>
              <th style={s.th}>Classificação</th>
              <th style={{...s.th,width:80,textAlign:"center"}}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row=>(
              <tr key={row.id} style={row.isCustom?{background:"rgba(0,201,167,0.03)"}:{}}>
                {editingRow?.id===row.id?(
                  <>
                    <td style={s.td}><input style={II} value={editingRow.detalhe} onChange={e=>setEditingRow(r=>({...r,detalhe:e.target.value}))}/></td>
                    <td style={s.td}><select style={IS} value={editingRow.rd} onChange={e=>setEditingRow(r=>({...r,rd:e.target.value}))}>{RD_TYPES.map(r=><option key={r}>{r}</option>)}</select></td>
                    <td style={s.td}><select style={IS} value={editingRow.classificacao} onChange={e=>setEditingRow(r=>({...r,classificacao:e.target.value}))}>{allCls.map(c=><option key={c}>{c}</option>)}</select></td>
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
                      {row.isCustom&&<span style={{marginLeft:6,fontSize:9,color:"#00C9A7",background:"rgba(0,201,167,0.12)",padding:"1px 5px",borderRadius:10,fontWeight:600}}>custom</span>}
                    </td>
                    <td style={s.td}><span style={{...s.badge(row.rd),fontSize:10}}>{row.rd}</span></td>
                    <td style={{...s.td,fontSize:12,color:"#6B8299"}}>{row.classificacao}</td>
                    <td style={{...s.td,textAlign:"center"}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        <button style={{...s.btn("ghost"),padding:"3px 8px",fontSize:11}} onClick={()=>setEditingRow({...row})}>✏</button>
                        {row.isCustom&&<button style={{...s.btn("danger"),padding:"3px 8px",fontSize:11}} onClick={()=>deleteCustom(row.id)}>✕</button>}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
  const [tab,setTab]           = useState("dashboard");
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [transactions,setTransactions] = useState([]);
  const [customCats,setCustomCats] = useState([]);
  const [saldoInicial,setSaldoInicial] = useState(0);
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
  const [saldoForm,setSaldoForm] = useState("");
  const [dragOver,setDragOver] = useState(false);
  const [pendingImport,setPendingImport] = useState(null);
  const [reviewItems,setReviewItems] = useState(null);
  const [toast,setToast]       = useState(null);
  const [aiLoading,setAiLoading] = useState(false);
  const [saving,setSaving]     = useState(false);
  const [showConfirmClear,setShowConfirmClear] = useState(false);
  const [fluxoGroupBy,setFluxoGroupBy] = useState("rd");
  const [agenda,setAgenda]               = useState([]);
  const [agendaOcorrencias,setAgendaOcorrencias] = useState([]);
  const [agendaMes,setAgendaMes]         = useState(new Date().getMonth()+1);
  const [agendaAno,setAgendaAno]         = useState(new Date().getFullYear());
  const [showAgendaModal,setShowAgendaModal] = useState(false);
  const [editingAgenda,setEditingAgenda] = useState(null);
  const [agendaForm,setAgendaForm]       = useState({nome:"",tipo:"",dia_vencimento:"",keywords:"",rd:"DESPESAS FIXAS",classificacao:""});
  const [reclassifyList,setReclassifyList]   = useState(null);
  const [reclassifySelected,setReclassifySelected] = useState([]);
  const [associating,setAssociating]     = useState(null);
  const [agendaSortCol,setAgendaSortCol] = useState("dia_vencimento");
  const [agendaSortDir,setAgendaSortDir] = useState("asc");
  const [agendaDiaFilter,setAgendaDiaFilter] = useState([]);
  const [showDiaFilter,setShowDiaFilter] = useState(false);
  const [fluxoMonth,setFluxoMonth] = useState("todos");
  const [importedHashes,setImportedHashes] = useState(new Set());

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
    const handleEsc = (e) => { if(e.key==="Escape") setShowDiaFilter(false); };
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

  const loadAll = () => { loadTransactions(); loadSettings(); loadCustomCats(); loadAgenda(); };

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
    if(data){ const s=data.find(d=>d.key==="saldo_inicial"); if(s) setSaldoInicial(parseFloat(s.value)||0); }
  };

  const loadCustomCats = async () => {
    const {data}=await supabase.from("categories").select("*").order("name");
    if(data) setCustomCats(data);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const metrics = useMemo(()=>{
    const rec = transactions.filter(t=>Number(t.value)>0).reduce((s,t)=>s+Number(t.value),0);
    const des = transactions.filter(t=>Number(t.value)<0).reduce((s,t)=>s+Math.abs(Number(t.value)),0);
    const pen = transactions.filter(t=>t.needs_review||t.status==="pendente");
    return {rec, des, saldo:saldoInicial+rec-des, pen};
  },[transactions,saldoInicial]);

  const forecast = useMemo(()=>generateForecast(transactions),[transactions]);

  const filtered = useMemo(()=>{
    let list=[...transactions];
    // drillDown overrides filter when set
    if(drillDown){
      if(drillDown.rd) list=list.filter(t=>t.rd===drillDown.rd);
      if(drillDown.dateFrom) list=list.filter(t=>dateToSortable(t.date)>=drillDown.dateFrom);
      if(drillDown.dateTo)   list=list.filter(t=>dateToSortable(t.date)<=drillDown.dateTo);
    } else {
      if(filter.rd!=="todos")           list=list.filter(t=>t.rd===filter.rd);
      if(filter.classificacao!=="todas") list=list.filter(t=>t.classificacao===filter.classificacao);
      if(filter.status!=="todos")        list=list.filter(t=>t.status===filter.status);
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
      else if(sortCol==="rd"){va=a.rd||"";vb=b.rd||"";}
      else if(sortCol==="classificacao"){va=a.classificacao||"";vb=b.classificacao||"";}
      else if(sortCol==="conta"){va=a.conta||"";vb=b.conta||"";}
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
      if(!groups[key]) groups[key]={total:0,count:0};
      groups[key].total+=Number(t.value); groups[key].count++;
    });
    return Object.entries(groups).sort((a,b)=>Math.abs(b[1].total)-Math.abs(a[1].total));
  },[transactions,fluxoGroupBy,fluxoMonth]);

  // ── Classify & save ────────────────────────────────────────────────────────
  const classifyAndSave = async (rows) => {
    setAiLoading(true);
    const toSave=[], toReview=[];
    for (const row of rows) {
      if(importedHashes.has(generateHash(row.date,row.description,row.value))) continue;
      const local = localClassify(row.description, customCats);
      if (local) {
        toSave.push({...row, type:Number(row.value)>=0?"entrada":"saída", rd:local.r, classificacao:local.c, status:"confirmado", origin:"extrato", ai_classified:false, needs_review:false, created_by:user.id});
      } else {
        const ai = await classifyWithGemini(row.description);
        if (ai) {
          toSave.push({...row, type:Number(row.value)>=0?"entrada":"saída", rd:ai.rd, classificacao:ai.classificacao, status:"confirmado", origin:"extrato", ai_classified:true, needs_review:false, created_by:user.id});
        } else {
          toReview.push({...row, type:Number(row.value)>=0?"entrada":"saída", rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESAS ADMINISTRATIVAS", status:"pendente", origin:"extrato", ai_classified:true, needs_review:true, created_by:user.id});
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

  const getOcorrencia = (agendaId, mes, ano) =>
    agendaOcorrencias.find(o=>o.agenda_id===agendaId&&o.mes===mes&&o.ano===ano);

  const reconcileAgenda = async (mes, ano) => {
    for (const item of agenda) {
      if (!item.ativo) continue;
      const oc = getOcorrencia(item.id, mes, ano);
      if (oc?.status==="pago") continue;
      const keywords = item.keywords||[];
      const match = transactions.find(t=>{
        const p=t.date?.split("/");
        if(!p||p.length<3) return false;
        if(parseInt(p[1])!==mes||parseInt(p[2])!==ano) return false;
        return keywords.some(k=>t.description?.toUpperCase().includes(k.toUpperCase()));
      });
      await supabase.from("agenda_ocorrencias").upsert({
        agenda_id:item.id, mes, ano,
        status: match?"pago":"pendente",
        transaction_id: match?.id||null,
        data_pagamento: match?.date||null,
        valor_pago: match?Math.abs(Number(match.value)):null,
      },{onConflict:"agenda_id,mes,ano"});
    }
    await loadAgenda();
    showToast("Reconciliação concluída!");
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
    for (const id of reclassifySelected) {
      await supabase.from("transactions").update({
        rd:reclassifyList.rd, classificacao:reclassifyList.classificacao,
      }).eq("id",id);
    }
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
    // FIX #3: correct operator precedence
    const isPositive = form.rd==="RECEITA" || form.rd==="INVESTIMENTOS";
    const finalVal = isPositive ? Math.abs(val) : -Math.abs(val);
    setSaving(true);
    const payload={date:form.date,description:form.description,value:finalVal,type:finalVal>=0?"entrada":"saída",rd:form.rd,classificacao:form.classificacao,conta:form.conta,status:"confirmado",origin:"manual",ai_classified:false,needs_review:false,created_by:user.id};
    if(editingId){
      await supabase.from("transactions").update(payload).eq("id",editingId);
      showToast("Lançamento atualizado!");
    } else {
      await supabase.from("transactions").insert(payload);
      showToast("Lançamento adicionado!");
    }
    setForm({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});
    setEditingId(null); setShowModal(false); setSaving(false);
  };

  const startEdit = (t) => {
    setForm({date:t.date,description:t.description,value:String(Math.abs(Number(t.value))).replace(".",","),rd:t.rd||"RECEITA",classificacao:t.classificacao||"",conta:t.conta||""});
    setEditingId(t.id); setModalMode("lancamento"); setShowModal(true);
  };

  // ── File import ────────────────────────────────────────────────────────────
  const handleFile = useCallback((file)=>{
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      const parsed=parseBankCSV(e.target.result);
      if(!parsed.length){ showToast("Nenhum lançamento encontrado no arquivo.","error"); return; }
      const newRows=parsed.filter(r=>!importedHashes.has(generateHash(r.date,r.description,r.value)));
      const dups=parsed.length-newRows.length;
      setPendingImport({fileName:file.name,rows:parsed,newRows,dups});
      setTab("importar");
    };
    reader.readAsText(file,"UTF-8");
  },[importedHashes]);

  // FIX #4: confirmReview redirects and cleans state properly
  const confirmReview = async (reviewed) => {
    const rows = reviewed.map(r=>({...r,type:Number(r.value)>=0?"entrada":"saída",needs_review:false,status:"confirmado"}));
    for(let i=0;i<rows.length;i+=50){
      await supabase.from("transactions").insert(rows.slice(i,i+50));
    }
    showToast(`${rows.length} lançamentos revisados e salvos!`);
    setReviewItems(null);
    setPendingImport(null);
    setTab("lancamentos"); // FIX #4
  };

  const cancelReview = () => { setReviewItems(null); setPendingImport(null); };

  const saveSaldoInicial = async () => {
    const v=parseValue(saldoForm);
    if(isNaN(v)){ showToast("Valor inválido.","error"); return; }
    await supabase.from("settings").upsert({key:"saldo_inicial",value:String(v)},{onConflict:"key"});
    setSaldoInicial(v); setSaldoForm(""); setShowModal(false); showToast("Saldo inicial atualizado!");
  };

  const toggleStatus = async (t) => {
    await supabase.from("transactions").update({status:t.status==="pendente"?"confirmado":"pendente",needs_review:false}).eq("id",t.id);
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
      await supabase.from("transactions").delete().eq("id",confirmDelete);
    }
    setConfirmDelete(null);
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
    {id:"dashboard",    icon:"⬡", label:"Dashboard"},
    {id:"lancamentos",  icon:"≡", label:"Lançamentos"},
    {id:"fluxo",        icon:"⊟", label:"Fluxo de Caixa"},
    {id:"importar",     icon:"↑", label:"Importar Extrato"},
    {id:"pendencias",   icon:"◎", label:"Pendências"},
    {id:"forecast",     icon:"∿", label:"Forecast"},
    {id:"projecao",     icon:"↗", label:"Projeção"},
    {id:"classificacoes",icon:"⊞",label:"Classificações"},
    {id:"agenda",icon:"📅",label:"Agenda"},
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
          {sidebarOpen&&<div style={{fontSize:17,fontWeight:700,color:"#00C9A7"}}>CashFlow</div>}
          <button style={{background:"none",border:"none",color:"#6B8299",cursor:"pointer",fontSize:18,padding:4}} onClick={()=>setSidebarOpen(o=>!o)}>{sidebarOpen?"◀":"▶"}</button>
        </div>
        <div style={{flex:1,paddingTop:8,overflowY:"auto"}}>
          {navItems.map(n=>(
            <div key={n.id} style={s.nav(tab===n.id,sidebarOpen)} onClick={()=>setTab(n.id)} title={!sidebarOpen?n.label:""}>
              <span style={{fontSize:17,minWidth:20,textAlign:"center"}}>{n.icon}</span>
              {sidebarOpen&&<span>{n.label}</span>}
              {n.id==="pendencias"&&metrics.pen.length>0&&(
                <span style={{marginLeft:"auto",background:"#F5A623",color:"#0F1923",borderRadius:20,fontSize:10,padding:"1px 6px",fontWeight:700}}>{metrics.pen.length}</span>
              )}
            </div>
          ))}
        </div>
        {sidebarOpen&&(
          <div style={{padding:"16px 24px",borderTop:"1px solid #1E2D3D"}}>
            <div style={{fontSize:11,color:"#6B8299",marginBottom:4}}>{user.email}</div>
            <div style={{fontSize:11,color:"#6B8299",marginBottom:8}}>Saldo: <span style={{color:"#00C9A7",fontWeight:600}}>{fmt(saldoInicial)}</span> <span style={{color:"#00C9A7",cursor:"pointer",marginLeft:6}} onClick={()=>supabase.auth.signOut()}>Sair</span></div>
            <div style={{display:"flex",gap:6}}>
              <button style={{...s.btn("ghost"),fontSize:11,padding:"5px 10px",flex:1}} onClick={()=>exportFluxoCSV(transactions)}>⬇ CSV</button>
              <button style={{...s.btn("danger"),fontSize:11,padding:"5px 10px"}} onClick={()=>setShowConfirmClear(true)}>🗑</button>
            </div>
            <div style={{fontSize:10,color:"#6B8299",marginTop:8}}>☁ Tempo real</div>
            <div style={{fontSize:9,color:"#00C9A7",marginTop:4,opacity:0.5}}>v FluxoCaixa180626</div>
            <div style={{fontSize:9,color:"#1E4D3D",marginTop:4,background:"rgba(0,201,167,0.08)",padding:"3px 6px",borderRadius:4}}>v FluxoCaixa180626</div>
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
                <button style={s.btn()} onClick={()=>{setModalMode("lancamento");setEditingId(null);setForm({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});setShowModal(true)}}>+ Lançamento</button>
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
                <thead><tr>{["Data","Descrição","R/D","Classificação","Valor","Status"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {transactions.slice(0,8).map(t=>(
                    <tr key={t.id}>
                      <td style={s.td}>{t.date}</td>
                      <td style={{...s.td,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</td>
                      <td style={s.td}><span style={{...s.badge(t.rd),fontSize:10}}>{t.rd||"—"}</span></td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.classificacao||"—"}</td>
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
              <button style={s.btn()} onClick={()=>{setModalMode("lancamento");setEditingId(null);setForm({date:"",description:"",value:"",rd:"RECEITA",classificacao:"RECEITA DE VENDAS",conta:""});setShowModal(true)}}>+ Novo</button>
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
                <option value="todos">Todos Status</option><option value="confirmado">Confirmado</option><option value="pendente">Pendente</option>
              </select>
              <input style={{...s.sel,width:130}} type="date" value={filter.dateFrom} onChange={e=>setFilter(f=>({...f,dateFrom:e.target.value}))} title="De"/>
              <input style={{...s.sel,width:130}} type="date" value={filter.dateTo} onChange={e=>setFilter(f=>({...f,dateTo:e.target.value}))} title="Até"/>
              <button style={{...s.btn("ghost"),padding:"8px 14px"}} onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")} title="Ordenar por data">
                Data {sortDir==="asc"?"↑":"↓"}
              </button>
              <button style={{...s.btn("ghost"),padding:"8px 14px"}} onClick={()=>setFilter({rd:"todos",classificacao:"todas",status:"todos",dateFrom:"",dateTo:""})}>Limpar filtros</button>
            </div>
            <div style={s.card}>
              <table style={s.table}>
                <thead><tr>
                  {[{l:"Data",k:"date"},{l:"Descrição",k:"description"},{l:"R/D",k:"rd"},{l:"Classificação",k:"classificacao"},{l:"Conta",k:"conta"},{l:"Valor",k:"value"},{l:"Status",k:""},{l:"",k:""}].map(({l,k})=>(
                    <th key={l} style={{...s.th,cursor:k?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}
                      onClick={()=>{if(!k)return;if(sortCol===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(k);setSortDir("asc");}}}>
                      {l}{k&&sortCol===k?(sortDir==="asc"?" ↑":" ↓"):""}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(t=>(
                    <tr key={t.id} style={t.needs_review?{background:"rgba(245,166,35,0.04)"}:{}}>
                      <td style={s.td}>{t.date}</td>
                      <td style={{...s.td,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</td>
                      <td style={s.td}><span style={{...s.badge(t.rd),fontSize:10}}>{t.rd||"—"}</span></td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.classificacao||"—"}</td>
                      <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.conta||"—"}</td>
                      <td style={{...s.td,fontWeight:600,color:Number(t.value)>=0?"#2ECC71":"#E8445A"}}>{fmt(Number(t.value))}</td>
                      <td style={s.td}><span style={{fontSize:11,color:t.needs_review?"#F5A623":t.status==="confirmado"?"#2ECC71":"#6B8299"}}>{t.needs_review?"⚠ revisar":t.status}</span></td>
                      <td style={s.td}>
                        <div style={{display:"flex",gap:4}}>
                          <button style={{...s.btn("ghost"),padding:"3px 7px",fontSize:11}} onClick={()=>startEdit(t)}>✏</button>
                          <button style={{...s.btn("ghost"),padding:"3px 7px",fontSize:11}} onClick={()=>toggleStatus(t)}>{t.status==="pendente"||t.needs_review?"✓":"⏳"}</button>
                          <button style={{...s.btn("danger"),padding:"3px 7px",fontSize:11}} onClick={()=>deleteT(t.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* FLUXO DE CAIXA */}
        {tab==="fluxo"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div><div style={{fontSize:21,fontWeight:700}}>Fluxo de Caixa</div><div style={{fontSize:13,color:"#6B8299",marginTop:2}}>Agrupado por {fluxoGroupBy==="rd"?"R/D":fluxoGroupBy==="classificacao"?"Classificação":"Mês"}</div></div>
              <button style={s.btn("ghost")} onClick={()=>exportFluxoCSV(transactions)}>⬇ Exportar CSV</button>
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
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              {[
                {l:"Total Receitas",v:transactions.filter(t=>Number(t.value)>0).reduce((s,t)=>s+Number(t.value),0),c:"#2ECC71"},
                {l:"Total Despesas",v:Math.abs(transactions.filter(t=>Number(t.value)<0).reduce((s,t)=>s+Number(t.value),0)),c:"#E8445A"},
                {l:"Resultado",v:transactions.reduce((s,t)=>s+Number(t.value),0),c:transactions.reduce((s,t)=>s+Number(t.value),0)>=0?"#00C9A7":"#E8445A"}
              ].map(m=>(
                <div key={m.l} style={s.card}><div style={{fontSize:11,color:"#6B8299",marginBottom:6,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:22,fontWeight:700,color:m.c}}>{fmt(m.v)}</div></div>
              ))}
            </div>
            <div style={s.card}>
              <table style={s.table}>
                <thead><tr><th style={s.th}>Grupo</th><th style={{...s.th,textAlign:"right"}}>Total</th><th style={{...s.th,textAlign:"right"}}>Qtd</th><th style={s.th}>Distribuição</th></tr></thead>
                <tbody>
                  {fluxoData.map(([group,data])=>{
                    const maxAbs=Math.max(...fluxoData.map(([,d])=>Math.abs(d.total)),1);
                    const pct=Math.round((Math.abs(data.total)/maxAbs)*100);
                    const handleGroupClick=()=>{
                      if(fluxoGroupBy==="rd") setFilter({rd:group,classificacao:"todas",status:"todos",dateFrom:fluxoMonth!=="todos"?`${new Date().getFullYear()}-${String(fluxoMonth).padStart(2,"0")}-01`:"",dateTo:fluxoMonth!=="todos"?`${new Date().getFullYear()}-${String(fluxoMonth).padStart(2,"0")}-${new Date(new Date().getFullYear(),fluxoMonth,0).getDate()}`:"" });
                      else if(fluxoGroupBy==="classificacao") setFilter({rd:"todos",classificacao:group,status:"todos",dateFrom:"",dateTo:""});
                      else setFilter({rd:"todos",classificacao:"todas",status:"todos",dateFrom:"",dateTo:""});
                      setTab("lancamentos");
                    };
                    return (
                      <tr key={group} style={{cursor:"pointer"}} onClick={handleGroupClick}>
                        <td style={{...s.td,fontWeight:600,color:"#00C9A7"}}>{group}</td>
                        <td style={{...s.td,textAlign:"right",fontWeight:700,color:data.total>=0?"#2ECC71":"#E8445A"}}>{fmt(data.total)}</td>
                        <td style={{...s.td,textAlign:"right",color:"#6B8299"}}>{data.count}</td>
                        <td style={{...s.td,width:200}}>
                          <div style={{background:"#1E2D3D",borderRadius:4,height:8}}>
                            <div style={{background:data.total>=0?"#2ECC71":"#E8445A",width:`${pct}%`,height:"100%",borderRadius:4}}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(()=>{
              const activeMths=MONTHS.filter(m=>transactions.some(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m;}));
              if(!activeMths.length) return null;
              return (
                <div style={{...s.card,marginTop:16,overflowX:"auto"}}>
                  <div style={{fontSize:11,color:"#6B8299",marginBottom:14,textTransform:"uppercase"}}>Resumo Mensal por R/D</div>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={{...s.th,minWidth:140}}>R/D</th>
                        {activeMths.map(m=><th key={m} style={{...s.th,textAlign:"right"}}>{m.substring(0,3)}</th>)}
                        <th style={{...s.th,textAlign:"right"}}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RD_TYPES.map(rd=>{
                        const vals=activeMths.map(m=>transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m&&t.rd===rd;}).reduce((s,t)=>s+Number(t.value),0));
                        const total=vals.reduce((s,v)=>s+v,0);
                        if(vals.every(v=>v===0)) return null;
                        const rdColor2={RECEITA:"#2ECC71","DESPESAS FIXAS":"#E8445A","DESPESAS VARIÁVEIS":"#FF7A7A",MOVIMENTAÇÃO:"#6B8299",INVESTIMENTOS:"#00C9A7"};
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
                      {(()=>{
                        const tots=activeMths.map(m=>transactions.filter(t=>{const p=t.date?.split("/");return p?.length===3&&MONTHS[parseInt(p[1])-1]===m;}).reduce((s,t)=>s+Number(t.value),0));
                        const grand=tots.reduce((s,v)=>s+v,0);
                        return (
                          <tr style={{borderTop:"2px solid #1E2D3D"}}>
                            <td style={{...s.td,fontWeight:700}}>TOTAL GERAL</td>
                            {tots.map((v,i)=>{
                              const mName=activeMths[i];
                              const mIdx=MONTHS.indexOf(mName)+1;
                              const txYear=transactions.find(t=>{const p=t.date?.split("/");return p?.length===3&&parseInt(p[1])===mIdx;})?.date?.split("/")?.[2]||"2026";
                              const mm=String(mIdx).padStart(2,"0");
                              const lastDay=new Date(Number(txYear),mIdx,0).getDate();
                              return (
                                <td key={i} style={{...s.td,textAlign:"right",fontWeight:700,color:v>=0?"#2ECC71":"#E8445A"}}>
                                  {v!==0?(
                                    <button
                                      onClick={()=>{setDrillDown({rd:null,dateFrom:`${txYear}-${mm}-01`,dateTo:`${txYear}-${mm}-${String(lastDay).padStart(2,"0")}`,label:mName});setTab("lancamentos");}}
                                      style={{background:"none",border:"none",color:"inherit",cursor:"pointer",fontSize:13,fontWeight:700,padding:0}}>
                                      {fmt(v)}
                                    </button>
                                  ):fmt(v)}
                                </td>
                              );
                            })}
                            <td style={{...s.td,textAlign:"right",fontWeight:700,color:grand>=0?"#2ECC71":"#E8445A"}}>
                              <button
                                onClick={()=>{setDrillDown(null);setTab("lancamentos");}}
                                style={{background:"none",border:"none",color:"inherit",cursor:"pointer",fontSize:13,fontWeight:700,padding:0}}>
                                {fmt(grand)}
                              </button>
                            </td>
                          </tr>
                        );
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
                    <button style={s.btn()} onClick={()=>classifyAndSave(pendingImport.newRows)} disabled={pendingImport.newRows.length===0}>
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
                  <div style={{fontSize:13,color:"#6B8299"}}>CSV ou TXT — separador automático</div>
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
        {tab==="pendencias"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div><div style={{fontSize:21,fontWeight:700}}>Pendências</div><div style={{fontSize:13,color:"#6B8299",marginTop:2}}>{metrics.pen.length} itens aguardando</div></div>
            </div>
            {metrics.pen.length===0?(
              <div style={{...s.card,textAlign:"center",padding:60}}>
                <div style={{fontSize:40,marginBottom:10}}>✓</div>
                <div style={{fontSize:16,fontWeight:600,color:"#2ECC71"}}>Sem pendências!</div>
                <div style={{fontSize:13,color:"#6B8299",marginTop:6}}>Todos os lançamentos estão confirmados.</div>
              </div>
            ):(
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{["Data","Descrição","R/D","Classificação","Valor","Ação"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {metrics.pen.map(t=>(
                      <tr key={t.id} style={{background:"rgba(245,166,35,0.04)"}}>
                        <td style={s.td}>{t.date}</td>
                        <td style={{...s.td,maxWidth:240}}>{t.description}</td>
                        <td style={s.td}><span style={{...s.badge(t.rd),fontSize:10}}>{t.rd||"—"}</span></td>
                        <td style={{...s.td,fontSize:11,color:"#6B8299"}}>{t.classificacao||"—"}</td>
                        <td style={{...s.td,fontWeight:600,color:Number(t.value)>=0?"#2ECC71":"#E8445A"}}>{fmt(Number(t.value))}</td>
                        <td style={s.td}>
                          <div style={{display:"flex",gap:6}}>
                            <button style={{...s.btn(),padding:"5px 12px",fontSize:12}} onClick={()=>toggleStatus(t)}>✓ Confirmar</button>
                            <button style={{...s.btn("ghost"),padding:"5px 8px",fontSize:12}} onClick={()=>startEdit(t)}>✏</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{marginTop:14,padding:"10px 14px",background:"rgba(245,166,35,0.08)",borderRadius:8,fontSize:13,color:"#F5A623"}}>
                  Total pendente: {fmt(metrics.pen.reduce((s,t)=>s+Math.abs(Number(t.value)),0))}
                </div>
              </div>
            )}
          </>
        )}

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
                <select style={s.sel} value={agendaMes} onChange={e=>setAgendaMes(Number(e.target.value))}>
                  {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
                </select>
                <select style={s.sel} value={agendaAno} onChange={e=>setAgendaAno(Number(e.target.value))}>
                  {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
                </select>
                <button style={s.btn("ghost")} onClick={()=>reconcileAgenda(agendaMes,agendaAno)}>🔄 Reconciliar</button>
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
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
                  {[{l:"Compromissos",v:agAtivos.length,c:"#6B8299"},{l:"Pagos",v:pagos,c:"#2ECC71"},{l:"Pendentes",v:pendentes+semOc,c:"#F5A623"},{l:"Total Pago",v:fmt(totalPago),c:"#00C9A7"}].map(m=>(
                    <div key={m.l} style={s.card}>
                      <div style={{fontSize:11,color:"#6B8299",marginBottom:6,textTransform:"uppercase"}}>{m.l}</div>
                      <div style={{fontSize:m.l==="Total Pago"?16:22,fontWeight:700,color:m.c}}>{m.v}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={s.card}>
              <table style={s.table}>
                <thead><tr>
                  {[{l:"Compromisso",k:"nome"},{l:"Tipo",k:"tipo"},{l:"Vence dia",k:"dia_vencimento"},{l:"Palavras-chave",k:""},{l:"Status",k:"status"},{l:"Valor Pago",k:"valor"},{l:"Ação",k:""}].map(({l,k})=>(
                    <th key={l} style={{...s.th,cursor:k?"pointer":"default",userSelect:"none",position:"relative"}}
                      onClick={()=>{
                        if(!k) return;
                        if(k==="dia_vencimento"){
                          if(agendaSortCol===k) setAgendaSortDir(d=>d==="asc"?"desc":"asc");
                          else{setAgendaSortCol(k);setAgendaSortDir("asc");}
                          setShowDiaFilter(f=>!f);
                          return;
                        }
                        if(agendaSortCol===k) setAgendaSortDir(d=>d==="asc"?"desc":"asc");
                        else{setAgendaSortCol(k);setAgendaSortDir("asc");}
                      }}>
                      {l}{k&&k!=="dia_vencimento"&&agendaSortCol===k?(agendaSortDir==="asc"?" ↑":" ↓"):""}
                      {k==="dia_vencimento"&&(
                        <span style={{marginLeft:4,fontSize:10,color:"#00C9A7"}}>
                          {agendaSortCol==="dia_vencimento"?(agendaSortDir==="asc"?"↑ ":"↓ "):""}{agendaDiaFilter.length>0?`(${agendaDiaFilter.length})`:""} ▾
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
                    const statusColor=status==="pago"?"#2ECC71":status==="pendente"?"#F5A623":"#6B8299";
                    const statusLabel=status==="pago"?"✓ Pago":status==="pendente"?"⏳ Pendente":"— Não verificado";
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
          </>
        )}

        {/* CLASSIFICAÇÕES */}
        {tab==="classificacoes"&&(
          <ClassificacoesTab customCats={customCats} loadCustomCats={loadCustomCats} showToast={showToast} s={s}/>
        )}

      </div>{/* end main */}
      <div style={{position:"fixed",bottom:6,right:12,fontSize:10,color:"#00C9A7",opacity:0.4,zIndex:50,fontFamily:"monospace"}}>FluxoCaixa180626</div>
      {/* Version indicator */}
      <div style={{position:"fixed",bottom:4,right:8,fontSize:9,color:"#1E2D3D",zIndex:50}}>FluxoCaixa180626</div>

      {/* Modal lançamento / saldo */}
      {showModal&&(
        <div style={s.modal} onClick={()=>setShowModal(false)}>
          <div style={s.mbox} onClick={e=>e.stopPropagation()}>
            {modalMode==="saldo"?(
              <>
                <div style={{fontSize:17,fontWeight:700,marginBottom:6}}>Saldo Inicial</div>
                <div style={{fontSize:13,color:"#6B8299",marginBottom:20}}>Valor de abertura somado às movimentações para compor o saldo atual.</div>
                <div style={{marginBottom:20}}><div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>Valor (R$)</div><input style={s.input} placeholder="Ex: 7.351,01" value={saldoForm} onChange={e=>setSaldoForm(e.target.value)}/></div>
                <div style={{display:"flex",gap:10}}>
                  <button style={{...s.btn("ghost"),flex:1}} onClick={()=>setShowModal(false)}>Cancelar</button>
                  <button style={{...s.btn(),flex:1}} onClick={saveSaldoInicial}>Salvar</button>
                </div>
              </>
            ):(
              <>
                <div style={{fontSize:17,fontWeight:700,marginBottom:20}}>{editingId?"Editar":"Novo"} Lançamento</div>
                {[{l:"Data",k:"date",ph:"DD/MM/AAAA"},{l:"Descrição",k:"description",ph:"Ex: RECEBIMENTO REDE VISA"},{l:"Valor (R$)",k:"value",ph:"Ex: 1.234,56"},{l:"Conta (opcional)",k:"conta",ph:"Ex: 1618994634"}].map(({l,k,ph})=>(
                  <div key={k} style={{marginBottom:14}}>
                    <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>{l}</div>
                    <input style={s.input} placeholder={ph} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
                  </div>
                ))}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>R/D</div>
                  <select style={{...s.input}} value={form.rd} onChange={e=>setForm(f=>({...f,rd:e.target.value}))}>
                    {RD_TYPES.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>Classificação</div>
                  <select style={{...s.input}} value={form.classificacao} onChange={e=>setForm(f=>({...f,classificacao:e.target.value}))}>
                    <option value="">Selecione...</option>
                    {allClassificacoes.map(c=><option key={c}>{c}</option>)}
                  </select>
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
        <div style={s.modal} onClick={()=>setShowAgendaModal(false)}>
          <div style={s.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:20}}>{editingAgenda?"Editar":"Novo"} Compromisso</div>
            {[{l:"Nome",k:"nome",ph:"Ex: Aluguel"},{l:"Tipo (opcional)",k:"tipo",ph:"Ex: DP"},{l:"Dia de vencimento",k:"dia_vencimento",ph:"Ex: 5"},{l:"Palavras-chave (separadas por vírgula)",k:"keywords",ph:"Ex: aluguel, locação"}].map(({l,k,ph})=>(
              <div key={k} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:"#6B8299",marginBottom:6}}>{l}</div>
                <input style={s.input} placeholder={ph} value={agendaForm[k]} onChange={e=>setAgendaForm(f=>({...f,[k]:e.target.value}))}/>
              </div>
            ))}
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
              💡 Palavras-chave usadas para correlacionar com lançamentos importados.
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
            <div style={{fontSize:13,color:"#6B8299",marginBottom:4}}>{reclassifyList.items.length} lançamento(s) batem com a nova palavra-chave.</div>
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

      <input id="fileInput" type="file" accept=".csv,.txt" style={{display:"none"}}
        onChange={e=>{const f=e.target.files[0];if(f){handleFile(f);e.target.value="";}}}/>

      {toast&&<div style={s.toast(toast.kind)}>{toast.msg}</div>}
    </div>
  );
}