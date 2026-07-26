// interpretador.js — compreensão de linguagem natural (pt-BR) do assistente.
// Puro e sem dependência de APIs do navegador: funciona igual para voz e para texto digitado.

import { hojeISO, formatarData, formatarMoeda, RECORRENCIAS } from "./model.js";
import { somarDias, somarMeses, paraData, paraISO } from "./recorrencia.js";
import * as q from "./consultas.js";

export function normalizar(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- Números por extenso ---------- */

const NUMEROS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14,
  catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezoito: 18,
  dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200,
  trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600,
  setecentos: 700, oitocentos: 800, novecentos: 900,
};

/** "duzentos e cinquenta" → 250 | "mil e quinhentos" → 1500. */
export function palavrasParaNumero(texto) {
  const tokens = normalizar(texto).split(/[\s-]+/).filter((t) => t && t !== "e");
  let total = 0;
  let atual = 0;
  let achou = false;
  for (const t of tokens) {
    if (t === "mil") {
      atual = (atual || 1) * 1000;
      total += atual;
      atual = 0;
      achou = true;
    } else if (t === "milhao" || t === "milhoes") {
      atual = (atual || 1) * 1000000;
      total += atual;
      atual = 0;
      achou = true;
    } else if (t in NUMEROS) {
      atual += NUMEROS[t];
      achou = true;
    }
  }
  const r = total + atual;
  return achou ? r : null;
}

/** Aceita "1.250,50", "1250.50", "250 reais" ou por extenso. */
export function extrairValor(texto, exigirContexto = false) {
  const t = normalizar(texto);
  const comMoeda = t.match(/(?:r\$|reais?|valor(?: de| e)?)\s*([\d.,]+)/) || t.match(/([\d.,]+)\s*(?:reais?|conto)/);
  if (comMoeda) {
    const n = numeroBR(comMoeda[1]);
    if (n != null) return n;
  }
  if (!exigirContexto) {
    const soNumero = t.match(/(?:^|\s)(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s|$)/);
    if (soNumero) {
      const n = numeroBR(soNumero[1]);
      if (n != null) return n;
    }
    const extenso = palavrasParaNumero(t.replace(/\b(dia|dias|horas?|minutos?)\b/g, ""));
    if (extenso != null && extenso > 0) return extenso;
  }
  return null;
}

function numeroBR(str) {
  if (!str) return null;
  let s = String(str).trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  // em pt-BR o ponto é milhar: "2.800" = 2800, "1.250.000" = 1250000.
  // Só sobra como decimal quando não forma grupos de três ("2.8", "10.55").
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ---------- Datas ---------- */

const MESES = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7,
  agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const SEMANA = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

function iso(ano, mes, dia) {
  return paraISO(new Date(ano, mes - 1, dia));
}

/** Interpreta datas faladas. Retorna YYYY-MM-DD ou null. */
export function extrairData(texto, hoje = hojeISO()) {
  const t = normalizar(texto);
  const base = paraData(hoje);

  if (/\bdepois de amanha\b/.test(t)) return somarDias(hoje, 2);
  if (/\bamanha\b/.test(t)) return somarDias(hoje, 1);
  if (/\bhoje\b/.test(t)) return hoje;
  if (/\bontem\b/.test(t)) return somarDias(hoje, -1);

  const emDias = t.match(/(?:daqui a|em|dentro de)\s+([\w]+)\s+dias?/);
  if (emDias) {
    const n = numeroBR(emDias[1]) ?? palavrasParaNumero(emDias[1]);
    if (n != null) return somarDias(hoje, n);
  }
  const emSemanas = t.match(/(?:daqui a|em|dentro de)\s+([\w]+)\s+semanas?/);
  if (emSemanas) {
    const n = numeroBR(emSemanas[1]) ?? palavrasParaNumero(emSemanas[1]);
    if (n != null) return somarDias(hoje, n * 7);
  }
  const emMeses = t.match(/(?:daqui a|em|dentro de)\s+([\w]+)\s+(?:mes|meses)/);
  if (emMeses) {
    const n = numeroBR(emMeses[1]) ?? palavrasParaNumero(emMeses[1]);
    if (n != null) return somarMeses(hoje, n);
  }

  // 10/08/2026 · 10/08 · 10-08-2026
  const numerica = t.match(/\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/);
  if (numerica) {
    const dia = Number(numerica[1]);
    const mes = Number(numerica[2]);
    let ano = numerica[3] ? Number(numerica[3]) : base.getFullYear();
    if (ano < 100) ano += 2000;
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      const candidato = iso(ano, mes, dia);
      if (!numerica[3] && candidato < hoje) return iso(ano + 1, mes, dia);
      return candidato;
    }
  }

  // 10 de agosto [de 2026]
  const porExtenso = t.match(/\b(\d{1,2}|[a-z]+)\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (porExtenso && MESES[porExtenso[2]]) {
    const dia = numeroBR(porExtenso[1]) ?? palavrasParaNumero(porExtenso[1]);
    const mes = MESES[porExtenso[2]];
    const ano = porExtenso[3] ? Number(porExtenso[3]) : base.getFullYear();
    if (dia >= 1 && dia <= 31) {
      const candidato = iso(ano, mes, dia);
      if (!porExtenso[3] && candidato < hoje) return iso(ano + 1, mes, dia);
      return candidato;
    }
  }

  // "dia 10" · "todo dia 10" → próxima ocorrência desse dia
  const soDia = t.match(/\bdia\s+(\d{1,2}|[a-z]+)\b/);
  if (soDia) {
    const dia = numeroBR(soDia[1]) ?? palavrasParaNumero(soDia[1]);
    if (dia >= 1 && dia <= 31) {
      const candidato = iso(base.getFullYear(), base.getMonth() + 1, dia);
      return candidato < hoje ? somarMeses(candidato, 1) : candidato;
    }
  }

  // "próxima segunda", "na sexta"
  const diaSemana = t.match(/\b(?:proxima|proximo|na|no)?\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/);
  if (diaSemana) {
    const alvo = SEMANA[diaSemana[1]];
    const atual = base.getDay();
    let delta = (alvo - atual + 7) % 7;
    if (delta === 0) delta = 7;
    return somarDias(hoje, delta);
  }

  const soAno = t.match(/\bproximo (mes|ano)\b/);
  if (soAno) return soAno[1] === "mes" ? somarMeses(hoje, 1) : somarMeses(hoje, 12);

  return null;
}

export function extrairHora(texto) {
  const t = normalizar(texto);
  const m = t.match(/\b(\d{1,2})(?:[:h](\d{2}))?\s*(?:horas?|h)\b/) || t.match(/\bas\s+(\d{1,2})(?:[:h](\d{2}))?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/* ---------- Recorrência, antecedência e confirmação ---------- */

export function extrairFrequencia(texto) {
  const t = normalizar(texto);
  if (/\b(nao|nenhuma|unico|unica|so uma vez|uma vez so|apenas uma vez)\b/.test(t) && !/\bmensal|todo mes\b/.test(t))
    return "unico";
  if (/\b(diario|diaria|todo dia|todos os dias)\b/.test(t)) return "diario";
  if (/\b(semanal|toda semana|por semana)\b/.test(t)) return "semanal";
  if (/\b(quinzenal|quinze em quinze|a cada quinze dias)\b/.test(t)) return "quinzenal";
  if (/\b(mensal|todo mes|por mes|mes a mes|mensalmente)\b/.test(t)) return "mensal";
  if (/\b(bimestral|a cada dois meses)\b/.test(t)) return "bimestral";
  if (/\b(trimestral|a cada tres meses)\b/.test(t)) return "trimestral";
  if (/\b(semestral|a cada seis meses)\b/.test(t)) return "semestral";
  if (/\b(anual|todo ano|por ano|anualmente)\b/.test(t)) return "anual";
  const direto = RECORRENCIAS.find((r) => normalizar(r.label) === t);
  return direto ? direto.id : null;
}

/** Antecedência do lembrete em dias. "no dia" → 0, "uma semana antes" → 7. */
export function extrairAntecedencia(texto) {
  const t = normalizar(texto);
  if (/\b(no dia|na hora|mesmo dia|no proprio dia)\b/.test(t)) return 0;
  if (/\b(nenhum|nao quero|sem lembrete|nao precisa)\b/.test(t)) return null;
  if (/\b(uma semana|sete dias)\b/.test(t)) return 7;
  if (/\b(duas semanas|quinze dias|quinzena)\b/.test(t)) return 15;
  if (/\b(um mes|trinta dias)\b/.test(t)) return 30;
  if (/\b(vespera|dia anterior|um dia antes)\b/.test(t)) return 1;
  const num = t.match(/(\d+)\s*dias?/) || t.match(/^(\d+)$/);
  if (num) return Number(num[1]);
  const extenso = t.match(/([a-z]+)\s+dias?/);
  if (extenso) {
    const n = palavrasParaNumero(extenso[1]);
    if (n != null) return n;
  }
  const solto = palavrasParaNumero(t);
  return solto != null ? solto : null;
}

export function ehSim(texto) {
  return /\b(sim|isso|confirmo|confirmar|pode|pode ser|claro|ok|okay|correto|certo|salvar|salva|positivo|e isso)\b/.test(
    normalizar(texto)
  );
}

export function ehNao(texto) {
  return /\b(nao|negativo|cancela|cancelar|errado|de novo|refazer|esquece)\b/.test(normalizar(texto));
}

export function ehPular(texto) {
  return /\b(pular|pula|nao sei|nao tem|sem valor|depois|deixa em branco|nenhum)\b/.test(normalizar(texto));
}

/* ---------- Frase única: tudo de uma vez ---------- */

/**
 * Igual a `normalizar`, mas SEM mexer nos espaços — assim cada caractere continua
 * na mesma posição do texto original (acento composto vira 1 caractere de novo),
 * e dá para apagar do original exatamente o trecho que já foi interpretado.
 */
function semAcento(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function apagarTrecho(texto, inicio, fim) {
  return texto.slice(0, inicio) + " ".repeat(fim - inicio) + texto.slice(fim);
}

/** Procura a primeira regex que casar e devolve o casamento + o texto sem aquele trecho. */
function consumir(texto, regexes) {
  const plano = semAcento(texto);
  for (const re of regexes) {
    const m = plano.match(re);
    if (m) return { m, restante: apagarTrecho(texto, m.index, m.index + m[0].length) };
  }
  return { m: null, restante: texto };
}

const RE_ANTECEDENCIA = [
  /\b(?:me\s+)?(?:avis[ae]r?|avise|lembr[ae]r?|lembre|alert[ae]r?)[^,.;]*?\b(\d{1,3}|[a-z]+)\s+dias?\s+antes\b/,
  /\b(\d{1,3}|[a-z]+)\s+dias?\s+antes\b/,
  /\b(uma semana|duas semanas|quinze dias|um mes|trinta dias|vespera)\s+antes\b/,
  /\b(?:me\s+)?(?:avis[ae]r?|avise|lembr[ae]r?|lembre)\s+(?:me\s+)?no dia\b/,
  /\bno (?:proprio )?dia\b(?=[^\d]|$)/,
];

const RE_FREQUENCIA = [
  /\b(todo dia|todos os dias|diariamente|diario)\b/,
  /\b(toda semana|semanalmente|semanal|por semana)\b/,
  /\b(quinzenal|a cada quinze dias|de quinze em quinze dias)\b/,
  /\b(todo mes|mensalmente|mensal|por mes|mes a mes)\b/,
  /\b(bimestral|a cada dois meses)\b/,
  /\b(trimestral|a cada tres meses)\b/,
  /\b(semestral|a cada seis meses)\b/,
  /\b(todo ano|anualmente|anual|por ano)\b/,
];

const RE_DATA = [
  /\b(?:depois de amanha|amanha|hoje)\b/,
  /\b(?:daqui a|dentro de|em)\s+\d{1,3}\s+(?:dias?|semanas?|mes(?:es)?)\b/,
  /\b\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?\b/,
  /\b(?:todo\s+)?(?:dia\s+)?\d{1,2}\s+de\s+[a-z]+(?:\s+de\s+\d{4})?\b/,
  /\b(?:todo\s+)?dia\s+\d{1,2}\b/,
  /\b(?:proxima|proximo|na|no)\s+(?:domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/,
];

const RE_HORA = [/\bas\s+\d{1,2}(?:[:h]\d{2})?\b/, /\b\d{1,2}[:h]\d{2}\b/, /\b\d{1,2}\s+horas?\b/];

const RE_VALOR = [
  /\br\$\s*[\d.,]+/,
  /\b[\d.,]+\s*reais\b/,
  /\bvalor\s+(?:de\s+)?[\d.,]+/,
  /\b[\d.]{1,3}(?:\.\d{3})*,\d{2}\b/,
  /\b\d{2,}\b/, // sobrou um número solto depois de data/hora/antecedência: é o valor
];

const VERBOS_TITULO =
  /^(?:cadastr\w*|agend\w*|anot\w*|cri[ae]r?|crie|adicion\w*|marc\w*|registr\w*|lembr\w*|pag[ao]r?|pague|coloc\w*|bota?r?|inclu\w*|novo|nova)\b\s*/;

const CONECTIVOS_TITULO = /^(?:o|a|os|as|um|uma|de|do|da|dos|das|para|pra|em|no|na|me|meu|minha|que|compromisso|lembrete)\b\s*/;

/**
 * Lê uma frase inteira e extrai tudo o que der: título, valor, data, hora,
 * recorrência e antecedência do lembrete. O que não vier fica null, e o
 * assistente pergunta só isso.
 *
 * "paga o condomínio dia 10 todo mês, 450, me avisa 5 dias antes"
 *   → { titulo: "Condomínio", data: 10 do mês que vem, recorrencia: "mensal",
 *       valor: 450, lembretes: [5] }
 *
 * A ordem importa: antecedência e data saem antes do valor, senão o "5" de
 * "5 dias antes" ou o "10" de "dia 10" seriam confundidos com dinheiro.
 */
export function interpretarFrase(texto, hoje = hojeISO()) {
  let resto = String(texto || "");
  const fora = { antecedencia: null, recorrencia: null, data: null, hora: null, valor: null };

  const ant = consumir(resto, RE_ANTECEDENCIA);
  if (ant.m) {
    fora.antecedencia = extrairAntecedencia(ant.m[0]);
    resto = ant.restante;
  }

  const freq = consumir(resto, RE_FREQUENCIA);
  if (freq.m) {
    fora.recorrencia = extrairFrequencia(freq.m[0]);
    resto = freq.restante;
  }

  const data = consumir(resto, RE_DATA);
  if (data.m) {
    fora.data = extrairData(data.m[0], hoje);
    if (fora.data) resto = data.restante;
  }

  const hora = consumir(resto, RE_HORA);
  if (hora.m) {
    fora.hora = extrairHora(hora.m[0]);
    if (fora.hora) resto = hora.restante;
  }

  const valor = consumir(resto, RE_VALOR);
  if (valor.m) {
    fora.valor = extrairValor(valor.m[0]);
    if (fora.valor != null) resto = valor.restante;
  }

  return {
    titulo: limparTitulo(resto),
    valor: fora.valor,
    data: fora.data,
    hora: fora.hora,
    recorrencia: fora.recorrencia,
    lembretes: fora.antecedencia == null ? [] : [fora.antecedencia],
  };
}

/** Sobra da frase → título apresentável. */
function limparTitulo(resto) {
  const primeiro =
    String(resto || "")
      .split(/[,;.]/)
      .map((p) => p.trim())
      .find((p) => /[a-zà-ú]/i.test(p)) || "";

  let t = primeiro.replace(/\s+/g, " ").trim();
  let anterior;
  do {
    anterior = t;
    const plano = semAcento(t);
    const verbo = plano.match(VERBOS_TITULO);
    if (verbo) t = t.slice(verbo[0].length).trim();
    const conectivo = semAcento(t).match(CONECTIVOS_TITULO);
    if (conectivo) t = t.slice(conectivo[0].length).trim();
  } while (t !== anterior && t);

  t = t.replace(/\s+(de|do|da|com|para|pra|e)$/i, "").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ---------- Intenção ---------- */

const VERBOS_CADASTRO =
  /^(cadastrar|cadastre|cadastra|agendar|agende|agenda|anotar|anote|anota|criar|crie|cria|adicionar|adicione|adiciona|marcar|marque|marca|lembrar|lembre|lembra|novo|nova|registrar|registre|pagar|paga|pague|colocar|coloca|incluir|inclui)\b/;

const STOPWORDS_TITULO = new Set([
  "compromisso", "um", "uma", "o", "a", "os", "as", "de", "do", "da", "dos",
  "das", "para", "pra", "me", "meu", "minha", "no", "na", "que",
]);

/**
 * Extrai o título da fala: remove o verbo inicial ("cadastrar") e as
 * palavras vazias seguintes, preservando o texto original das demais.
 * "Cadastrar o pagamento do condomínio" → "Pagamento do condomínio".
 */
export function extrairTitulo(texto) {
  let palavras = String(texto || "")
    .trim()
    .replace(/[.!?]+$/, "")
    .split(/\s+/)
    .filter(Boolean);

  if (palavras.length && VERBOS_CADASTRO.test(normalizar(palavras[0]))) palavras = palavras.slice(1);
  while (palavras.length > 1 && STOPWORDS_TITULO.has(normalizar(palavras[0]))) palavras = palavras.slice(1);
  if (palavras.length === 1 && STOPWORDS_TITULO.has(normalizar(palavras[0]))) return "";

  const t = palavras.join(" ").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const CONSULTAS = [
  { id: "vencidos", re: /\b(vencid|atrasad|em atraso|venceu)\w*/ },
  { id: "semana", re: /\b(esta|essa|nesta|dessa|da|na) semana\b|\bsemana\b/ },
  { id: "amanha", re: /\bamanha\b/ },
  { id: "hoje", re: /\bhoje\b/ },
  { id: "mes", re: /\b(este|esse|neste|desse|do|no) mes\b|\bmes\b/ },
  { id: "proximo", re: /\bproximo (compromisso|vencimento|pagamento)\b|\bqual (e )?o proximo\b/ },
  { id: "resumo", re: /\b(resumo|situacao geral|panorama|como estou)\b/ },
];

/**
 * Classifica a fala em: consulta, cadastro ou desconhecido.
 * Consultas têm prioridade — "tenho algo amanhã?" não é cadastro.
 */
export function detectarIntencao(texto) {
  const t = normalizar(texto);
  if (!t) return { tipo: "desconhecido" };

  const pergunta =
    /^(quais|quanto|quantos|quantas|tenho|tem|qual|o que|quando|me (diga|fala|mostra)|mostrar|mostre|listar|liste|consultar|consulte)\b/.test(
      t
    ) || /\?$/.test(String(texto).trim());

  if (pergunta) {
    for (const c of CONSULTAS) if (c.re.test(t)) return { tipo: "consulta", consulta: c.id };
    return { tipo: "consulta", consulta: "resumo" };
  }

  if (VERBOS_CADASTRO.test(t)) return { tipo: "cadastrar", ...interpretarFrase(texto) };

  // Sem verbo de comando: se a frase carrega dados de compromisso (título + data,
  // valor, recorrência ou aviso), é cadastro. Isso vem ANTES das consultas porque
  // "todo mês" e "dia 10" apareciam como se fossem pergunta sobre o mês.
  const lido = interpretarFrase(texto);
  const temDados =
    lido.titulo && (lido.data || lido.valor != null || lido.recorrencia || lido.lembretes.length);
  if (temDados) return { tipo: "cadastrar", ...lido };

  for (const c of CONSULTAS) if (c.re.test(t)) return { tipo: "consulta", consulta: c.id };

  return { tipo: "desconhecido" };
}

/** Escolhe a categoria mais provável a partir do título. */
export function sugerirCategoria(titulo, categorias = []) {
  const t = normalizar(titulo);
  let melhor = null;
  for (const cat of categorias) {
    const n = normalizar(cat);
    if (t.includes(n) && (!melhor || n.length > normalizar(melhor).length)) melhor = cat;
  }
  if (melhor) return melhor;
  const dicas = [
    [/\b(luz|energia|agua|gas|internet|telefone|celular|tv|boleto|fatura|conta)\b/, "Contas"],
    [/\b(cartao|credito|visa|master|nubank)\b/, "Cartão de Crédito"],
    [/\b(condominio|predio)\b/, "Condomínio"],
    [/\b(aluguel|locacao)\b/, "Aluguel"],
    [/\b(iptu|ipva|imposto|darf|inss|irpf|tributo)\b/, "Impostos"],
    [/\b(medico|dentista|exame|consulta|plano de saude|remedio|farmacia)\b/, "Saúde"],
    [/\b(seguro|apolice)\b/, "Seguros"],
    [/\b(reuniao|trabalho|cliente|projeto|entrega)\b/, "Trabalho"],
  ];
  for (const [re, cat] of dicas) if (re.test(t)) return categorias.includes(cat) ? cat : cat;
  return categorias[0] || "Pessoal";
}

/* ---------- Respostas de consulta ---------- */

function listarFalado(itens, limite = 5) {
  const nomes = itens.slice(0, limite).map((c) => {
    const valor = c.valor ? `, ${formatarMoeda(c.valor)}` : "";
    return `${c.titulo} em ${formatarData(c.data)}${valor}`;
  });
  const resto = itens.length - nomes.length;
  return nomes.join("; ") + (resto > 0 ? `; e mais ${resto}` : "");
}

function total(itens) {
  return itens.reduce((s, c) => s + Number(c.valor || 0), 0);
}

/** Gera a resposta (texto para falar + itens para exibir). */
export function responderConsulta(consulta, lista, hoje = hojeISO()) {
  const abertos = (arr) => arr.filter((c) => c.status === "pendente" || c.status === "adiado");

  switch (consulta) {
    case "vencidos": {
      const itens = q.vencidos(lista, hoje);
      if (!itens.length) return { texto: "Você não tem nenhum compromisso vencido. Tudo em dia.", itens };
      return {
        texto: `Você tem ${itens.length} compromisso${itens.length > 1 ? "s" : ""} vencido${itens.length > 1 ? "s" : ""}, somando ${formatarMoeda(total(itens))}: ${listarFalado(itens)}.`,
        itens,
      };
    }
    case "semana": {
      const itens = abertos(q.daSemana(lista, hoje));
      if (!itens.length) return { texto: "Nada vence nesta semana.", itens };
      return {
        texto: `Nesta semana vencem ${itens.length} compromisso${itens.length > 1 ? "s" : ""}, total de ${formatarMoeda(total(itens))}: ${listarFalado(itens)}.`,
        itens,
      };
    }
    case "amanha": {
      const dia = somarDias(hoje, 1);
      const itens = abertos(q.doDia(lista, dia));
      if (!itens.length) return { texto: "Amanhã você não tem nenhum compromisso.", itens };
      return {
        texto: `Amanhã você tem ${itens.length} compromisso${itens.length > 1 ? "s" : ""}: ${listarFalado(itens)}.`,
        itens,
      };
    }
    case "hoje": {
      const itens = abertos(q.doDia(lista, hoje));
      if (!itens.length) return { texto: "Hoje você não tem nenhum compromisso em aberto.", itens };
      return {
        texto: `Hoje você tem ${itens.length} compromisso${itens.length > 1 ? "s" : ""}: ${listarFalado(itens)}.`,
        itens,
      };
    }
    case "mes": {
      const r = q.resumo(lista, hoje);
      const itens = abertos(q.doMes(lista, hoje));
      return {
        texto: `Neste mês o previsto é ${formatarMoeda(r.totalPrevistoMes)}. Já foram pagos ${formatarMoeda(r.totalPagoMes)} e faltam ${formatarMoeda(r.totalPendenteMes)}.`,
        itens,
      };
    }
    case "proximo": {
      const c = q.proximoCompromisso(lista, hoje);
      if (!c) return { texto: "Não há compromissos futuros cadastrados.", itens: [] };
      const valor = c.valor ? `, no valor de ${formatarMoeda(c.valor)}` : "";
      return {
        texto: `O próximo é ${c.titulo}, ${q.rotuloRelativo(c.data, hoje)}, dia ${formatarData(c.data)}${valor}.`,
        itens: [c],
      };
    }
    default: {
      const r = q.resumo(lista, hoje);
      const partes = [];
      if (r.vencidos.length) partes.push(`${r.vencidos.length} vencido${r.vencidos.length > 1 ? "s" : ""}`);
      if (r.hoje.length) partes.push(`${r.hoje.length} para hoje`);
      if (r.proximos.length) partes.push(`${r.proximos.length} nos próximos sete dias`);
      const resumoTxt = partes.length ? partes.join(", ") : "nenhuma pendência próxima";
      return {
        texto: `Você tem ${resumoTxt}. No mês, ${formatarMoeda(r.totalPendenteMes)} ainda em aberto de um total de ${formatarMoeda(r.totalPrevistoMes)}.`,
        itens: [...r.vencidos, ...r.hoje, ...r.proximos],
      };
    }
  }
}
