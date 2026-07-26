// model.js — constantes, formatos e criação de compromissos.
// Módulo puro: não toca em DOM nem em IndexedDB.

/** Versão do app — fonte única: título, chip do topo, rodapé, "Sobre" e nome do arquivo. */
export const VERSAO = "1.6.1";

/**
 * Uma página só tem origem de verdade em http/https. O Android entrega HTML local como
 * `content://` (pelo gerenciador de arquivos) ou `file://` (pelos downloads do Chrome) —
 * checar apenas `file:` deixava o caso mais comum passando batido.
 * Sem origem, o navegador nega microfone, notificação, service worker e instalação.
 */
export function ehOrigemLocal(protocolo) {
  return !/^https?:$/.test(String(protocolo || ""));
}

export const MODO_ARQUIVO = typeof location !== "undefined" && ehOrigemLocal(location.protocol);

export const RECORRENCIAS = [
  { id: "unico", label: "Único" },
  { id: "diario", label: "Diário", dias: 1 },
  { id: "semanal", label: "Semanal", dias: 7 },
  { id: "quinzenal", label: "Quinzenal", dias: 14 },
  { id: "mensal", label: "Mensal", meses: 1 },
  { id: "bimestral", label: "Bimestral", meses: 2 },
  { id: "trimestral", label: "Trimestral", meses: 3 },
  { id: "semestral", label: "Semestral", meses: 6 },
  { id: "anual", label: "Anual", meses: 12 },
];

/** Como o assistente conduz o cadastro. Configurável em Ajustes. */
export const MODOS_ASSISTENTE = [
  { id: "guiado", label: "Guiado — pergunta uma coisa de cada vez" },
  { id: "automatico", label: "Automático — aproveita o que você já disse" },
  { id: "rapido", label: "Rápido — só pergunta o essencial" },
];

export const ABAS_INICIAIS = [
  { id: "painel", label: "Painel" },
  { id: "assistente", label: "Assistente (com o teclado pronto)" },
];

export const PRIORIDADES = [
  { id: "baixa", label: "Baixa", cor: "#5B7085" },
  { id: "media", label: "Média", cor: "#00C9A7" },
  { id: "alta", label: "Alta", cor: "#F5A623" },
  { id: "urgente", label: "Urgente", cor: "#E8445A" },
];

// "atrasado" nunca é gravado: é derivado de pendente + data vencida (ver statusEfetivo).
export const STATUS = [
  { id: "pendente", label: "Pendente", cor: "#4C9AFF" },
  { id: "pago", label: "Pago", cor: "#00C9A7" },
  { id: "atrasado", label: "Atrasado", cor: "#E8445A", derivado: true },
  { id: "cancelado", label: "Cancelado", cor: "#5B7085" },
  { id: "adiado", label: "Adiado", cor: "#F5A623" },
];

export const STATUS_ABERTOS = ["pendente", "adiado"];

export const CATEGORIAS_PADRAO = [
  "Contas",
  "Cartão de Crédito",
  "Condomínio",
  "Aluguel",
  "Impostos",
  "Saúde",
  "Seguros",
  "Trabalho",
  "Pessoal",
];

// Presets de lembrete em dias de antecedência (0 = no dia).
export const LEMBRETES_PRESET = [30, 15, 10, 7, 5, 3, 1, 0];

export const TIPOS_HISTORICO = {
  criado: "Criado",
  alterado: "Alterado",
  pago: "Pago",
  status: "Situação alterada",
  adiado: "Adiado",
  gerado: "Gerado por recorrência",
  restaurado: "Restaurado de backup",
  excluido: "Excluído",
};

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function agoraISO() {
  return new Date().toISOString();
}

/** Data local (não UTC) no formato YYYY-MM-DD. */
export function hojeISO(base = new Date()) {
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function labelRecorrencia(id) {
  return RECORRENCIAS.find((r) => r.id === id)?.label || "Único";
}

export function labelPrioridade(id) {
  return PRIORIDADES.find((p) => p.id === id)?.label || "Média";
}

export function corPrioridade(id) {
  return PRIORIDADES.find((p) => p.id === id)?.cor || "#00C9A7";
}

export function labelStatus(id) {
  return STATUS.find((s) => s.id === id)?.label || id;
}

export function corStatus(id) {
  return STATUS.find((s) => s.id === id)?.cor || "#5B7085";
}

/**
 * Status exibido ao usuário: um compromisso pendente com data passada
 * aparece como "atrasado" sem que isso seja gravado no banco.
 */
export function statusEfetivo(c, hoje = hojeISO()) {
  if (STATUS_ABERTOS.includes(c.status) && c.data < hoje) return "atrasado";
  return c.status;
}

export function estaAberto(c) {
  return STATUS_ABERTOS.includes(c.status);
}

/** Normaliza qualquer objeto vindo do formulário/voz/backup num compromisso completo. */
export function novoCompromisso(dados = {}) {
  const criadoEm = dados.criadoEm || agoraISO();
  return {
    id: dados.id || uid(),
    serieId: dados.serieId || dados.id || uid(),
    origemId: dados.origemId || null,
    titulo: (dados.titulo || "").trim() || "Sem título",
    descricao: (dados.descricao || "").trim(),
    categoria: (dados.categoria || "Pessoal").trim(),
    data: dados.data || hojeISO(),
    hora: dados.hora || "",
    valor: dados.valor === "" || dados.valor == null ? null : Number(dados.valor),
    prioridade: dados.prioridade || "media",
    observacoes: (dados.observacoes || "").trim(),
    recorrencia: dados.recorrencia || "unico",
    lembretes: Array.isArray(dados.lembretes) ? [...new Set(dados.lembretes.map(Number))].sort((a, b) => b - a) : [1],
    status: dados.status || "pendente",
    pagamento: dados.pagamento || null,
    criadoEm,
    atualizadoEm: dados.atualizadoEm || criadoEm,
  };
}

export function novoHistorico(compromissoId, tipo, descricao, dados = null) {
  return { id: uid(), compromissoId, tipo, descricao, dados, em: agoraISO() };
}

export function formatarMoeda(v) {
  if (v == null || v === "" || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatarDataHora(isoTimestamp) {
  if (!isoTimestamp) return "—";
  const d = new Date(isoTimestamp);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function labelLembrete(dias) {
  if (dias === 0) return "No dia";
  if (dias === 1) return "1 dia antes";
  return `${dias} dias antes`;
}
