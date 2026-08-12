import { describe, it, expect } from "vitest";
import { parseValue, merchantKey, flexMatch, localClassify, sameMerchant, applyDetailItemEdit, findDetailMatches, applyDetailPropagation } from "./App.jsx";

describe("parseValue", () => {
  it("converte formato BR com milhar e decimal", () => {
    expect(parseValue("1.234,56")).toBeCloseTo(1234.56);
  });
  it("converte vírgula decimal sem milhar", () => {
    expect(parseValue("1234,56")).toBeCloseTo(1234.56);
  });
  it("retorna NaN para valor vazio", () => {
    expect(parseValue("")).toBeNaN();
    expect(parseValue(null)).toBeNaN();
  });
});

describe("merchantKey", () => {
  it("remove números finais (bug v6.13.0 - CH COMPENSADO)", () => {
    expect(merchantKey("CH COMPENSADO 123")).toBe("CH COMPENSADO");
  });
  it("remove prefixos bancários", () => {
    expect(merchantKey("PIX ENVIADO JOAO SILVA")).toBe("JOAO SILVA");
  });
});

describe("flexMatch", () => {
  it("keyword curta não bate dentro de outra palavra (bug v6.5.1)", () => {
    expect(flexMatch("LARISSA SANTOS", "ISS")).toBe(false);
  });
  it("keyword curta bate como palavra inteira", () => {
    expect(flexMatch("PAGAMENTO ISS MUNICIPAL", "ISS")).toBe(true);
  });
  it("ignora espaços na comparação para keywords longas", () => {
    expect(flexMatch("J B COMERCIO LTDA", "COMERCIO LTDA")).toBe(true);
  });
});

// v7.15.0 — regra de sempre + alternativa concatenada (aditiva)
describe("sameMerchant", () => {
  it("mantém tudo que a regra atual já casava", () => {
    expect(sameMerchant("MINI EXTRA-5-CT", "MINI EXTRA-5-CT 03/06")).toBe(true);
    expect(sameMerchant("MINI EXTRA-5-CT", "MINI EXTRA -5 CT")).toBe(true);
    expect(sameMerchant("MINI EXTRA-5-CT", "MINI EXTRA-5-CT (compra: 15/06/2026)")).toBe(true);
    expect(sameMerchant("Vindi *MelhorEnvio", "Vindi *MelhorEnvio (compra: 04/05/2026)")).toBe(true);
  });
  it("casa o que só a concatenação resolve (hifenização divergente do banco)", () => {
    expect(sameMerchant("MINI EXTRA-5-CT", "MINI EXTRA5-C-T 19/06")).toBe(true);
  });
  it("não casa estabelecimentos distintos", () => {
    expect(sameMerchant("MINI EXTRA-5-CT", "99APP *99App")).toBe(false);
    expect(sameMerchant("BPG*LAVANDERY", "TORII -CT")).toBe(false);
    expect(sameMerchant("UBER *TRIP", "UBER *EATS")).toBe(false);
    expect(sameMerchant("PIX JOAO", "PIX MARIA")).toBe(false);
  });
  it("containment não gera o falso positivo de prefixo", () => {
    expect(sameMerchant("SUPERMERCADO ANGELONI", "SUPERMERCADO ZAFFARI")).toBe(false);
    expect(sameMerchant("RESTAURANTE DO JOAO", "RESTAURANTE PIZZARIA")).toBe(false);
    expect(sameMerchant("PANIFICADORA SILVA", "PANIFICADORA CENTRAL")).toBe(false);
  });
  it("não casa com lado vazio", () => {
    expect(sameMerchant("", "MINI EXTRA-5-CT")).toBe(false);
  });
});

// v7.15.0 — propagação dentro da fatura aberta
describe("applyDetailItemEdit", () => {
  const fatura = () => [
    { description:"MINI EXTRA-5-CT",      rd:"", classificacao:"", subcategoria:"", needs_review:true  },
    { description:"MINI EXTRA-5-CT 03/06", rd:"", classificacao:"", subcategoria:"", needs_review:true  },
    { description:"MINI EXTRA5-C-T 19/06", rd:"", classificacao:"", subcategoria:"", needs_review:true  },
    { description:"Vindi *MelhorEnvio",    rd:"DESPESAS FIXAS", classificacao:"MIDIAS E INTERNET", subcategoria:"ECOMMERCE", needs_review:false },
    { description:"99APP *99App",          rd:"", classificacao:"", subcategoria:"", needs_review:true  },
  ];
  it("edita só o item, nunca os outros", () => {
    const r = applyDetailItemEdit(fatura(), 0, "classificacao", "DESPESA OPERACIONAL LOJA");
    expect(r[0].classificacao).toBe("DESPESA OPERACIONAL LOJA");
    expect(r[1].classificacao).toBe("");
    expect(r[1].needs_review).toBe(true);
  });
  it("só R/D preenchido: nada a confirmar ainda", () => {
    const r = applyDetailItemEdit(fatura(), 0, "rd", "DESPESAS VARIÁVEIS");
    expect(findDetailMatches(r, 0)).toEqual([]);
  });
  it("R/D + Classificação: sugere os do mesmo estabelecimento", () => {
    let r = applyDetailItemEdit(fatura(), 0, "rd", "DESPESAS VARIÁVEIS");
    r = applyDetailItemEdit(r, 0, "classificacao", "DESPESA OPERACIONAL LOJA");
    expect(findDetailMatches(r, 0)).toEqual([1,2]);   // não inclui Vindi (3) nem 99APP (4)
  });
  it("aplicar propaga só nos confirmados", () => {
    let r = applyDetailItemEdit(fatura(), 0, "rd", "DESPESAS VARIÁVEIS");
    r = applyDetailItemEdit(r, 0, "classificacao", "DESPESA OPERACIONAL LOJA");
    r = applyDetailPropagation(r, findDetailMatches(r,0), "DESPESAS VARIÁVEIS", "DESPESA OPERACIONAL LOJA", "");
    expect(r[1].classificacao).toBe("DESPESA OPERACIONAL LOJA");
    expect(r[2].classificacao).toBe("DESPESA OPERACIONAL LOJA");
    expect(r[1].needs_review).toBe(false);
    expect(r[3].classificacao).toBe("MIDIAS E INTERNET");   // outro estabelecimento intacto
    expect(r[4].classificacao).toBe("");
  });
  it("pular não altera nada", () => {
    let r = applyDetailItemEdit(fatura(), 0, "rd", "DESPESAS VARIÁVEIS");
    r = applyDetailItemEdit(r, 0, "classificacao", "DESPESA OPERACIONAL LOJA");
    expect(r[1].classificacao).toBe("");
    expect(r[2].classificacao).toBe("");
  });
  it("subcategoria divergente entra como candidata (MERCADO vs SUPER)", () => {
    const base = [
      { description:"MINI EXTRA-5-CT", rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESA OPERACIONAL LOJA", subcategoria:"MERCADO", needs_review:false },
      { description:"MINI EXTRA-5-CT", rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESA OPERACIONAL LOJA", subcategoria:"SUPER",   needs_review:false },
    ];
    expect(findDetailMatches(base, 0)).toEqual([1]);
    expect(applyDetailPropagation(base, [1], "DESPESAS VARIÁVEIS", "DESPESA OPERACIONAL LOJA", "MERCADO")[1].subcategoria).toBe("MERCADO");
  });
  it("itens já alinhados não viram candidatos", () => {
    const base = [
      { description:"MINI EXTRA-5-CT", rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESA OPERACIONAL LOJA", subcategoria:"MERCADO", needs_review:false },
      { description:"MINI EXTRA-5-CT", rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESA OPERACIONAL LOJA", subcategoria:"MERCADO", needs_review:false },
    ];
    expect(findDetailMatches(base, 0)).toEqual([]);
  });
});

describe("localClassify", () => {
  it("categoria custom com keyword mais longa vence sobre base", () => {
    const customCats = [
      { id: 1, name: "PIX", rd: "DESPESAS VARIÁVEIS", classificacao: "OUTROS", keywords: [] },
      { id: 2, name: "PIX ENVIADO JOAO", rd: "DESPESAS FIXAS", classificacao: "ALUGUEL", keywords: [] },
    ];
    const result = localClassify("PIX ENVIADO JOAO SILVA", customCats);
    expect(result.c).toBe("ALUGUEL");
  });
  it("ignora categoria sem rd ou classificacao preenchidos", () => {
    const customCats = [
      { id: 1, name: "TESTE XYZ", rd: "", classificacao: "", keywords: [] },
    ];
    expect(localClassify("TESTE XYZ COMPRA", customCats)).toBeNull();
  });
});
