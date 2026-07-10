import { describe, it, expect } from "vitest";
import { parseValue, merchantKey, flexMatch, localClassify } from "./App.jsx";

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
