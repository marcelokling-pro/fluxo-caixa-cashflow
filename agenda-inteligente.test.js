// Testes unitários dos módulos puros da Agenda Inteligente (Vitest).
// Nenhum deles toca IndexedDB, DOM ou APIs de voz.

import { describe, it, expect } from "vitest";
import { somarDias, somarMeses, proximaData, proximaDataFutura, semanaDe, mesDe } from "./agenda-inteligente/js/recorrencia.js";
import { novoCompromisso, statusEfetivo } from "./agenda-inteligente/js/model.js";
import { filtrar, resumo, vencidos, proximos, proximoCompromisso, porCategoria } from "./agenda-inteligente/js/consultas.js";
import { lembretesDevidos, chaveLembrete, avisosAtivos } from "./agenda-inteligente/js/lembretes.js";
import { validarBackup } from "./agenda-inteligente/js/backup.js";
import * as interp from "./agenda-inteligente/js/interpretador.js";

const HOJE = "2026-07-26";

const compromisso = (over = {}) => novoCompromisso({ titulo: "X", data: HOJE, ...over });

describe("recorrência", () => {
  it("soma dias respeitando virada de mês", () => {
    expect(somarDias("2026-07-31", 1)).toBe("2026-08-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("mantém o dia do vencimento ao somar meses e nunca vaza para o mês seguinte", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29"); // bissexto
    expect(somarMeses("2026-08-10", 1)).toBe("2026-09-10");
    expect(somarMeses("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("calcula a próxima data por tipo de recorrência", () => {
    expect(proximaData("2026-08-10", "unico")).toBe(null);
    expect(proximaData("2026-08-10", "diario")).toBe("2026-08-11");
    expect(proximaData("2026-08-10", "semanal")).toBe("2026-08-17");
    expect(proximaData("2026-08-10", "quinzenal")).toBe("2026-08-24");
    expect(proximaData("2026-08-10", "mensal")).toBe("2026-09-10");
    expect(proximaData("2026-08-10", "bimestral")).toBe("2026-10-10");
    expect(proximaData("2026-08-10", "trimestral")).toBe("2026-11-10");
    expect(proximaData("2026-08-10", "semestral")).toBe("2027-02-10");
    expect(proximaData("2026-08-10", "anual")).toBe("2027-08-10");
  });

  it("ao quitar um recorrente muito atrasado, gera vencimento futuro (não no passado)", () => {
    expect(proximaDataFutura("2026-01-10", "mensal", HOJE)).toBe("2026-08-10");
  });

  it("delimita semana (segunda a domingo) e mês", () => {
    expect(semanaDe(HOJE)).toEqual({ inicio: "2026-07-20", fim: "2026-07-26" });
    expect(mesDe(HOJE)).toEqual({ inicio: "2026-07-01", fim: "2026-07-31" });
  });
});

describe("status derivado", () => {
  it("pendente com data passada aparece como atrasado sem gravar nada", () => {
    const c = compromisso({ data: "2026-07-20", status: "pendente" });
    expect(statusEfetivo(c, HOJE)).toBe("atrasado");
    expect(c.status).toBe("pendente");
  });

  it("pago no passado continua pago", () => {
    expect(statusEfetivo(compromisso({ data: "2026-07-20", status: "pago" }), HOJE)).toBe("pago");
  });
});

describe("consultas", () => {
  const lista = [
    compromisso({ id: "1", titulo: "Condomínio", categoria: "Condomínio", data: "2026-07-20", valor: 800 }),
    compromisso({ id: "2", titulo: "Conta de Luz", categoria: "Contas", data: "2026-07-26", valor: 250 }),
    compromisso({ id: "3", titulo: "Aluguel", categoria: "Aluguel", data: "2026-07-30", valor: 2000 }),
    compromisso({ id: "4", titulo: "IPTU", categoria: "Impostos", data: "2026-07-10", valor: 400, status: "pago" }),
    compromisso({ id: "5", titulo: "Curso", categoria: "Pessoal", data: "2026-08-20", valor: 500 }),
    compromisso({ id: "6", titulo: "Cancelado", categoria: "Pessoal", data: "2026-07-28", valor: 999, status: "cancelado" }),
  ];

  it("separa vencidos e próximos", () => {
    expect(vencidos(lista, HOJE).map((c) => c.id)).toEqual(["1"]);
    expect(proximos(lista, 7, HOJE).map((c) => c.id)).toEqual(["3"]);
    expect(proximoCompromisso(lista, HOJE).id).toBe("2");
  });

  it("totaliza o mês ignorando cancelados", () => {
    const r = resumo(lista, HOJE);
    expect(r.totalPrevistoMes).toBe(800 + 250 + 2000 + 400);
    expect(r.totalPagoMes).toBe(400);
    expect(r.totalPendenteMes).toBe(800 + 250 + 2000);
    expect(r.totalVencido).toBe(800);
  });

  it("busca por texto ignora acentos e maiúsculas", () => {
    expect(filtrar(lista, { texto: "condominio" }, HOJE).map((c) => c.id)).toEqual(["1"]);
    expect(filtrar(lista, { texto: "LUZ" }, HOJE).map((c) => c.id)).toEqual(["2"]);
  });

  it("filtra pelo status derivado atrasado", () => {
    expect(filtrar(lista, { status: "atrasado" }, HOJE).map((c) => c.id)).toEqual(["1"]);
    expect(filtrar(lista, { status: "pago" }, HOJE).map((c) => c.id)).toEqual(["4"]);
  });

  it("filtra por faixa de valor e período", () => {
    expect(filtrar(lista, { valorMin: 500, valorMax: 2000 }, HOJE).map((c) => c.id)).toEqual(["1", "3", "5", "6"]);
    expect(filtrar(lista, { de: "2026-08-01", ate: "2026-08-31" }, HOJE).map((c) => c.id)).toEqual(["5"]);
  });

  it("agrupa por categoria ordenando pelo maior total", () => {
    expect(porCategoria(lista)[0]).toEqual({ categoria: "Aluguel", quantidade: 1, total: 2000 });
  });
});

describe("lembretes", () => {
  it("dispara só o que já chegou na data-alvo", () => {
    // faltam 15 dias para 10/08: os avisos de 30 e 15 dias já venceram, o de 7 não
    const c = compromisso({ id: "a", data: "2026-08-10", lembretes: [30, 15, 7] });
    const devidos = lembretesDevidos([c], new Set(), HOJE);
    expect(devidos.map((d) => d.dias)).toEqual([30, 15]);
  });

  it("não repete lembrete já enviado", () => {
    const c = compromisso({ id: "a", data: "2026-08-10", lembretes: [30] });
    const enviados = new Set([chaveLembrete(c, 30)]);
    expect(lembretesDevidos([c], enviados, HOJE)).toEqual([]);
  });

  it("ignora compromissos pagos, cancelados e já vencidos", () => {
    const pago = compromisso({ id: "b", data: "2026-08-10", lembretes: [30], status: "pago" });
    const vencido = compromisso({ id: "c", data: "2026-07-01", lembretes: [0] });
    expect(lembretesDevidos([pago, vencido], new Set(), HOJE)).toEqual([]);
  });

  it("avisosAtivos lista cada compromisso uma vez, pela antecedência mais recente", () => {
    const c1 = compromisso({ id: "a", titulo: "Aluguel", data: "2026-08-10", lembretes: [30, 15, 7] });
    const c2 = compromisso({ id: "b", titulo: "IPVA", data: "2026-09-30", lembretes: [7] }); // ainda longe
    const ativos = avisosAtivos([c1, c2], HOJE);
    expect(ativos).toHaveLength(1);
    expect(ativos[0].compromisso.id).toBe("a");
    expect(ativos[0].dias).toBe(15); // o aviso mais recente que já disparou, não o de 30
  });

  it("avisosAtivos ignora pagos e vencidos (mesmo sem notificação disponível)", () => {
    const pago = compromisso({ id: "p", data: "2026-08-10", lembretes: [30], status: "pago" });
    const vencido = compromisso({ id: "v", data: "2026-07-01", lembretes: [30] });
    expect(avisosAtivos([pago, vencido], HOJE)).toEqual([]);
  });

  it("a chave muda quando a data do compromisso muda (lembrete rearma ao adiar)", () => {
    const c = compromisso({ id: "a", data: "2026-08-10" });
    expect(chaveLembrete(c, 7)).not.toBe(chaveLembrete({ ...c, data: "2026-09-10" }, 7));
  });
});

describe("interpretador de voz", () => {
  it("entende números por extenso", () => {
    expect(interp.palavrasParaNumero("duzentos e cinquenta")).toBe(250);
    expect(interp.palavrasParaNumero("mil e quinhentos")).toBe(1500);
    expect(interp.palavrasParaNumero("sete")).toBe(7);
  });

  it("extrai valores em vários formatos", () => {
    expect(interp.extrairValor("450 reais")).toBe(450);
    expect(interp.extrairValor("R$ 1.250,50")).toBe(1250.5);
    expect(interp.extrairValor("quatrocentos e cinquenta")).toBe(450);
    expect(interp.extrairValor("não sei")).toBe(null);
  });

  it("interpreta datas faladas", () => {
    expect(interp.extrairData("amanhã", HOJE)).toBe("2026-07-27");
    expect(interp.extrairData("depois de amanhã", HOJE)).toBe("2026-07-28");
    expect(interp.extrairData("dia 10", HOJE)).toBe("2026-08-10"); // dia 10 já passou em julho
    expect(interp.extrairData("dia 30", HOJE)).toBe("2026-07-30");
    expect(interp.extrairData("10 de agosto", HOJE)).toBe("2026-08-10");
    expect(interp.extrairData("10/08/2026", HOJE)).toBe("2026-08-10");
    expect(interp.extrairData("daqui a 5 dias", HOJE)).toBe("2026-07-31");
    expect(interp.extrairData("qualquer coisa", HOJE)).toBe(null);
  });

  it("interpreta frequência e antecedência", () => {
    expect(interp.extrairFrequencia("mensal")).toBe("mensal");
    expect(interp.extrairFrequencia("todo mês")).toBe("mensal");
    expect(interp.extrairFrequencia("não é recorrente")).toBe("unico");
    expect(interp.extrairAntecedencia("sete dias antes")).toBe(7);
    expect(interp.extrairAntecedencia("no dia")).toBe(0);
    expect(interp.extrairAntecedencia("5")).toBe(5);
    expect(interp.extrairAntecedencia("uma semana antes")).toBe(7);
  });

  it("separa consulta de cadastro", () => {
    expect(interp.detectarIntencao("Quais contas vencem esta semana?").consulta).toBe("semana");
    expect(interp.detectarIntencao("Tenho algum compromisso amanhã?").consulta).toBe("amanha");
    expect(interp.detectarIntencao("Quanto preciso pagar este mês?").consulta).toBe("mes");
    expect(interp.detectarIntencao("Qual o próximo compromisso?").consulta).toBe("proximo");
    const cad = interp.detectarIntencao("Cadastrar pagamento do condomínio");
    expect(cad.tipo).toBe("cadastrar");
    expect(cad.titulo).toBe("Pagamento do condomínio");
  });

  it("sugere categoria a partir do título", () => {
    const cats = ["Contas", "Condomínio", "Impostos", "Pessoal"];
    expect(interp.sugerirCategoria("Pagamento do condomínio", cats)).toBe("Condomínio");
    expect(interp.sugerirCategoria("Conta de luz", cats)).toBe("Contas");
    expect(interp.sugerirCategoria("IPTU 2026", cats)).toBe("Impostos");
  });

  it("responde consultas com texto falável", () => {
    const lista = [compromisso({ id: "1", titulo: "Aluguel", data: "2026-07-30", valor: 2000 })];
    const r = interp.responderConsulta("proximo", lista, HOJE);
    expect(r.texto).toContain("Aluguel");
    expect(r.itens).toHaveLength(1);
    expect(interp.responderConsulta("vencidos", lista, HOJE).texto).toContain("nenhum compromisso vencido");
  });
});

describe("backup", () => {
  it("recusa arquivo que não é backup da agenda", () => {
    expect(validarBackup({ formato: "outro-app", compromissos: [] })).toMatch(/não é um backup/);
    expect(validarBackup({ compromissos: "x" })).toMatch(/sem a lista/);
    expect(validarBackup({ formato: "agenda-inteligente/backup", compromissos: [] })).toBe(null);
  });
});
