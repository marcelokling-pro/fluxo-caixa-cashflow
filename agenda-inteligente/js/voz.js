// voz.js — assistente por voz: reconhecimento, síntese e diálogo de cadastro.
// O diálogo funciona igual por voz ou por texto digitado (mesma função `processar`),
// então o assistente continua utilizável em navegadores sem SpeechRecognition.

import * as servico from "./servico.js";
import * as interp from "./interpretador.js";
import {
  hojeISO,
  formatarData,
  formatarMoeda,
  labelRecorrencia,
  labelLembrete,
  MODO_ARQUIVO,
} from "./model.js";

const Reconhecimento =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export { MODO_ARQUIVO };

export function reconhecimentoDisponivel() {
  return !!Reconhecimento;
}

export function falaDisponivel() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/* ---------- Síntese de voz ---------- */

let vozPtBr = null;

function escolherVoz() {
  if (!falaDisponivel()) return null;
  if (vozPtBr) return vozPtBr;
  const vozes = window.speechSynthesis.getVoices() || [];
  vozPtBr =
    vozes.find((v) => v.lang === "pt-BR") ||
    vozes.find((v) => (v.lang || "").startsWith("pt")) ||
    null;
  return vozPtBr;
}

if (falaDisponivel()) {
  window.speechSynthesis.onvoiceschanged = () => {
    vozPtBr = null;
    escolherVoz();
  };
}

export function falar(texto, ativo = true) {
  if (!ativo || !falaDisponivel() || !texto) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    u.rate = 1.02;
    u.pitch = 1;
    const v = escolherVoz();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("[voz] síntese falhou", e);
  }
}

export function calarBoca() {
  if (falaDisponivel()) window.speechSynthesis.cancel();
}

/* ---------- Reconhecimento ---------- */

export class Escuta {
  constructor({ onParcial, onFinal, onFim, onErro } = {}) {
    this.onParcial = onParcial || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onFim = onFim || (() => {});
    this.onErro = onErro || (() => {});
    this.rec = null;
    this.ativa = false;
  }

  iniciar() {
    if (!Reconhecimento) {
      this.onErro(new Error("Reconhecimento de voz não suportado neste navegador."));
      return false;
    }
    if (this.ativa) return true;
    calarBoca();
    const rec = new Reconhecimento();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let parcial = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          this.onFinal(r[0].transcript.trim());
          return;
        }
        parcial += r[0].transcript;
      }
      if (parcial) this.onParcial(parcial.trim());
    };
    rec.onerror = (ev) => {
      this.ativa = false;
      // Aberta como arquivo, a página não tem origem própria: o Android nunca concede
      // microfone a ela. Em vez de mandar o usuário caçar uma configuração que não existe,
      // aponta o caminho que funciona — o microfone do teclado.
      const semOrigem = MODO_ARQUIVO
        ? "No modo arquivo o Android não libera o microfone para a página. Toque no campo de texto e use o microfone do próprio teclado — o assistente entende igual."
        : null;
      const mensagens = {
        "not-allowed":
          semOrigem ||
          "Microfone bloqueado. Toque no ícone à esquerda do endereço → Permissões → Microfone → Permitir. " +
            "Se não aparecer, veja Configurações do Android → Apps → Chrome → Permissões → Microfone. " +
            "Enquanto isso, o assistente funciona igual pelo campo de texto.",
        "service-not-allowed":
          semOrigem || "O navegador bloqueou o reconhecimento de voz aqui. Use o campo de texto — o assistente entende do mesmo jeito.",
        "no-speech": "Não consegui ouvir nada. Tente de novo, mais perto do microfone.",
        network: "O reconhecimento de voz do Chrome precisa de internet. Sem rede, use o campo de texto.",
        "audio-capture": "Nenhum microfone disponível para o navegador.",
        aborted: "Escuta interrompida.",
      };
      this.onErro(new Error(mensagens[ev.error] || "Falha no reconhecimento: " + ev.error));
    };
    rec.onend = () => {
      this.ativa = false;
      this.onFim();
    };

    this.rec = rec;
    this.ativa = true;
    try {
      rec.start();
      return true;
    } catch (e) {
      this.ativa = false;
      this.onErro(e);
      return false;
    }
  }

  parar() {
    try {
      this.rec?.stop();
    } catch {
      /* ignora */
    }
    this.ativa = false;
  }
}

/* ---------- Diálogo ---------- */

const ETAPAS = ["titulo", "valor", "data", "recorrente", "frequencia", "lembrete", "confirmar"];

export class Assistente {
  /**
   * @param {object} deps
   * @param {() => Array} deps.getCompromissos lista atual (para consultas)
   * @param {() => Array} deps.getCategorias   categorias cadastradas
   * @param {(msg) => void} deps.onMensagem    ({ de, texto, itens })
   * @param {() => void} deps.aoSalvar         chamado após gravar
   */
  constructor({ getCompromissos, getCategorias, onMensagem, aoSalvar, getModo } = {}) {
    this.getCompromissos = getCompromissos || (() => []);
    this.getCategorias = getCategorias || (() => []);
    this.onMensagem = onMensagem || (() => {});
    this.aoSalvar = aoSalvar || (() => {});
    /** "guiado" | "automatico" | "rapido" — ver MODOS_ASSISTENTE. */
    this.getModo = getModo || (() => "automatico");
    this.etapa = "ocioso";
    this.rascunho = null;
  }

  get emCadastro() {
    return this.etapa !== "ocioso";
  }

  responder(texto, itens = null) {
    this.onMensagem({ de: "assistente", texto, itens });
    return texto;
  }

  cancelar() {
    this.etapa = "ocioso";
    this.rascunho = null;
    return this.responder("Cadastro cancelado. Pode falar outro comando.");
  }

  /** Entrada única do assistente (voz ou texto). Retorna o texto falado. */
  async processar(entrada) {
    const texto = String(entrada || "").trim();
    if (!texto) return "";
    this.onMensagem({ de: "usuario", texto });

    if (this.emCadastro) {
      if (/^(cancelar|cancela|para|parar|esquece)$/i.test(interp.normalizar(texto))) return this.cancelar();
      return this.continuarCadastro(texto);
    }

    const intencao = interp.detectarIntencao(texto);

    if (intencao.tipo === "consulta") {
      const r = interp.responderConsulta(intencao.consulta, this.getCompromissos(), hojeISO());
      return this.responder(r.texto, r.itens);
    }

    if (intencao.tipo === "cadastrar") {
      return this.iniciarCadastro(texto);
    }

    return this.responder(
      'Não entendi. Você pode dizer "cadastrar pagamento do condomínio" ou perguntar "quais contas vencem esta semana?".'
    );
  }

  /**
   * No modo guiado só o título é aproveitado da frase — o resto é perguntado,
   * porque quem não sabe o formato precisa ser conduzido. Nos outros modos, tudo
   * o que veio na frase já entra preenchido.
   */
  iniciarCadastro(frase) {
    const modo = this.getModo();
    const lido = interp.interpretarFrase(frase, hojeISO());
    const titulo = lido.titulo || "";
    const guiado = modo === "guiado";

    this.rascunho = {
      titulo,
      valor: guiado ? null : lido.valor,
      data: guiado ? null : lido.data,
      hora: guiado ? "" : lido.hora || "",
      recorrencia: guiado ? null : lido.recorrencia,
      lembretes: guiado ? [] : lido.lembretes,
      categoria: interp.sugerirCategoria(titulo, this.getCategorias()),
      prioridade: "media",
    };

    // Rápido: o que não foi dito assume padrão em vez de virar pergunta.
    if (modo === "rapido") {
      if (this.rascunho.valor == null) this.rascunho.valorPulado = true;
      if (!this.rascunho.recorrencia) this.rascunho.recorrencia = "unico";
      if (!this.rascunho.lembretes.length) {
        this.rascunho.lembretes = [1];
        this.rascunho.lembretePulado = true;
      }
    }

    if (!titulo) {
      this.etapa = "titulo";
      return this.responder("O que você quer cadastrar?");
    }
    return this.proximaPergunta();
  }

  /** Pergunta o próximo campo ainda vazio, na ordem da especificação. */
  proximaPergunta() {
    const r = this.rascunho;
    if (!r.titulo) {
      this.etapa = "titulo";
      return this.responder("O que você quer cadastrar?");
    }
    if (r.valor == null && !r.valorPulado) {
      this.etapa = "valor";
      return this.responder(`Qual o valor de ${r.titulo}? Se não tiver valor, diga "pular".`);
    }
    if (!r.data) {
      this.etapa = "data";
      return this.responder("Qual o vencimento?");
    }
    if (!r.recorrencia) {
      this.etapa = "recorrente";
      return this.responder("É recorrente?");
    }
    if (!r.lembretes.length && !r.lembretePulado) {
      this.etapa = "lembrete";
      return this.responder("Quantos dias antes deseja ser avisado?");
    }
    this.etapa = "confirmar";
    return this.responder(`${this.resumoRascunho()} O compromisso será salvo. Confirma?`);
  }

  resumoRascunho() {
    const r = this.rascunho;
    const partes = [r.titulo];
    if (r.valor != null) partes.push(`no valor de ${formatarMoeda(r.valor)}`);
    partes.push(`com vencimento em ${formatarData(r.data)}${r.hora ? " às " + r.hora : ""}`);
    partes.push(`recorrência ${labelRecorrencia(r.recorrencia).toLowerCase()}`);
    if (r.lembretes.length) partes.push(`aviso ${r.lembretes.map(labelLembrete).join(" e ").toLowerCase()}`);
    else partes.push("sem lembrete");
    partes.push(`na categoria ${r.categoria}`);
    return partes.join(", ") + ".";
  }

  async continuarCadastro(texto) {
    const r = this.rascunho;
    const pulou = interp.ehPular(texto);

    switch (this.etapa) {
      case "titulo": {
        const titulo = interp.extrairTitulo(texto) || texto.trim();
        r.titulo = titulo;
        r.categoria = interp.sugerirCategoria(titulo, this.getCategorias());
        return this.proximaPergunta();
      }
      case "valor": {
        if (pulou) {
          r.valorPulado = true;
          return this.proximaPergunta();
        }
        const v = interp.extrairValor(texto);
        if (v == null) return this.responder('Não entendi o valor. Diga por exemplo "450 reais" ou "pular".');
        r.valor = v;
        return this.proximaPergunta();
      }
      case "data": {
        const d = interp.extrairData(texto, hojeISO());
        if (!d) return this.responder('Não entendi a data. Diga por exemplo "dia 10", "10 de agosto" ou "amanhã".');
        r.data = d;
        return this.proximaPergunta();
      }
      case "recorrente": {
        const freq = interp.extrairFrequencia(texto);
        if (freq && freq !== "unico") {
          r.recorrencia = freq;
          return this.proximaPergunta();
        }
        if (interp.ehNao(texto) || freq === "unico") {
          r.recorrencia = "unico";
          return this.proximaPergunta();
        }
        if (interp.ehSim(texto)) {
          this.etapa = "frequencia";
          return this.responder("Qual a frequência? Diária, semanal, quinzenal, mensal, bimestral, trimestral, semestral ou anual?");
        }
        return this.responder('Não entendi. É recorrente? Responda "sim" ou "não".');
      }
      case "frequencia": {
        const freq = interp.extrairFrequencia(texto);
        if (!freq) return this.responder("Não entendi a frequência. Diga mensal, semanal, anual...");
        r.recorrencia = freq;
        return this.proximaPergunta();
      }
      case "lembrete": {
        if (pulou || interp.ehNao(texto)) {
          r.lembretePulado = true;
          return this.proximaPergunta();
        }
        const dias = interp.extrairAntecedencia(texto);
        if (dias == null) return this.responder('Não entendi. Diga por exemplo "5 dias antes" ou "no dia".');
        r.lembretes = [dias];
        return this.proximaPergunta();
      }
      case "confirmar": {
        if (interp.ehSim(texto)) return this.salvar();
        if (interp.ehNao(texto)) return this.cancelar();
        return this.responder('Confirma o cadastro? Responda "sim" ou "não".');
      }
      default:
        this.etapa = "ocioso";
        return this.responder("Pode falar.");
    }
  }

  async salvar() {
    const r = this.rascunho;
    const c = await servico.criar({
      titulo: r.titulo,
      valor: r.valor,
      data: r.data,
      hora: r.hora || "",
      recorrencia: r.recorrencia || "unico",
      lembretes: r.lembretes.length ? r.lembretes : [],
      categoria: r.categoria,
      prioridade: r.prioridade,
      descricao: "Cadastrado pelo assistente de voz",
    });
    this.etapa = "ocioso";
    this.rascunho = null;
    this.aoSalvar(c);
    return this.responder(
      `Pronto. ${c.titulo} salvo para ${formatarData(c.data)}${c.valor ? ", " + formatarMoeda(c.valor) : ""}.`,
      [c]
    );
  }
}

export const ETAPAS_CADASTRO = ETAPAS;
