import { describe, it, expect } from "vitest";
import { parseValue, merchantKey, flexMatch, localClassify, sameMerchant, applyDetailItemEdit, findDetailMatches, applyDetailPropagation, commonPrefix, groupByPrefix, generateHash, dedupeRows } from "./App.jsx";

// v7.20.1 — detecção de duplicados na importação do extrato
describe("generateHash", () => {
  it("mesma linha gera a mesma chave independente de caixa e espaços", () => {
    expect(generateHash("15/08/2026"," mini extra-5-ct ",-45.9))
      .toBe(generateHash("15/08/2026","MINI EXTRA-5-CT",-45.9));
  });
  it("normaliza o valor com 2 casas (float sujo não escapa)", () => {
    expect(generateHash("15/08/2026","X",-45.900000000000006))
      .toBe(generateHash("15/08/2026","X",-45.9));
  });
  it("data, descrição ou valor diferentes geram chaves diferentes", () => {
    const base = generateHash("15/08/2026","X",-10);
    expect(generateHash("16/08/2026","X",-10)).not.toBe(base);
    expect(generateHash("15/08/2026","Y",-10)).not.toBe(base);
    expect(generateHash("15/08/2026","X",-11)).not.toBe(base);
    expect(generateHash("15/08/2026","X",10)).not.toBe(base);  // sinal importa
  });
});

describe("dedupeRows", () => {
  const linha = (d,desc,v) => ({date:d, description:desc, value:v});

  it("descarta o que já está no banco", () => {
    const banco = new Set([generateHash("15/08/2026","MINI EXTRA-5-CT",-45.9)]);
    const r = dedupeRows([linha("15/08/2026","MINI EXTRA-5-CT",-45.9), linha("16/08/2026","UBER *TRIP",-22)], banco);
    expect(r.length).toBe(1);
    expect(r[0].description).toBe("UBER *TRIP");
  });

  it("descarta repetição dentro do próprio arquivo (bug v7.20.1)", () => {
    const r = dedupeRows([
      linha("15/08/2026","MINI EXTRA-5-CT",-45.9),
      linha("15/08/2026","MINI EXTRA-5-CT",-45.9),
      linha("15/08/2026","MINI EXTRA-5-CT",-45.9),
    ], new Set());
    expect(r.length).toBe(1);
  });

  it("mesma descrição e valor em datas diferentes são lançamentos distintos", () => {
    const r = dedupeRows([linha("15/08/2026","UBER *TRIP",-22), linha("16/08/2026","UBER *TRIP",-22)], new Set());
    expect(r.length).toBe(2);
  });

  it("mesma descrição e data com valores diferentes são distintos", () => {
    const r = dedupeRows([linha("15/08/2026","UBER *TRIP",-22), linha("15/08/2026","UBER *TRIP",-31)], new Set());
    expect(r.length).toBe(2);
  });

  it("preserva a ordem e devolve as próprias linhas (identidade, usada na prévia)", () => {
    const a=linha("15/08/2026","A",-1), b=linha("16/08/2026","B",-2), a2=linha("15/08/2026","A",-1);
    const r = dedupeRows([a,b,a2], new Set());
    expect(r).toEqual([a,b]);
    expect(r[0]).toBe(a);
    expect(r.includes(a2)).toBe(false);   // 2ª ocorrência marcada como duplicada na prévia
  });

  it("não altera o Set recebido", () => {
    const banco = new Set();
    dedupeRows([linha("15/08/2026","A",-1)], banco);
    expect(banco.size).toBe(0);
  });

  it("arquivo inteiro já importado devolve lista vazia", () => {
    const rows = [linha("15/08/2026","A",-1), linha("16/08/2026","B",-2)];
    const banco = new Set(rows.map(r=>generateHash(r.date,r.description,r.value)));
    expect(dedupeRows(rows, banco)).toEqual([]);
  });
});

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

// v7.16.0 — agrupamento das linhas revisadas para sugerir uma regra por padrão
describe("commonPrefix", () => {
  it("corta na última palavra inteira", () => {
    expect(commonPrefix("ENTRADA PIX QRS PALOMA DA SILVA","ENTRADA PIX QRS WU PAO CHEN")).toBe("ENTRADA PIX QRS");
  });
  it("não corta quando um é prefixo exato do outro", () => {
    expect(commonPrefix("PIX ENVIADO ORB COMERCIO","PIX ENVIADO ORB COMERCIO LTDA")).toBe("PIX ENVIADO ORB COMERCIO");
  });
  it("devolve vazio quando não há nada em comum", () => {
    expect(commonPrefix("DA SABESP","TINY ERP")).toBe("");
  });
});

describe("groupByPrefix", () => {
  const linhas = [
    {description:"ENTRADA PIX QRS PALOMA DA S12", rd:"RECEITA", classificacao:"RECEITA DE VENDAS"},
    {description:"ENTRADA PIX QRS WU PAO CHEN",   rd:"RECEITA", classificacao:"RECEITA DE VENDAS"},
    {description:"ENTRADA PIX QRS GREGORY NIC",   rd:"RECEITA", classificacao:"RECEITA DE VENDAS"},
    {description:"PIX ENVIADO ORB COMERCIO LTDA", rd:"DESPESAS VARIÁVEIS", classificacao:"FORNECEDORES"},
    {description:"PIX ENVIADO ORB COMERCIO ME",   rd:"DESPESAS VARIÁVEIS", classificacao:"FORNECEDORES"},
    {description:"DA SABESP 0812",                rd:"DESPESAS FIXAS", classificacao:"DESPESA OPERACIONAL LOJA"},
  ];
  it("consolida 6 lançamentos em 3 regras", () => {
    const g = groupByPrefix(linhas);
    expect(g.length).toBe(3);
    expect(g.map(x=>x.nome)).toEqual(["ENTRADA PIX QRS","PIX ENVIADO ORB COMERCIO","DA SABESP"]);
  });
  it("cada grupo guarda os lançamentos que o formaram", () => {
    const g = groupByPrefix(linhas);
    expect(g[0].itens.length).toBe(3);
    expect(g[1].itens.length).toBe(2);
    expect(g[2].itens.length).toBe(1);
  });
  it("não junta descrições parecidas com classificações diferentes", () => {
    const g = groupByPrefix([
      {description:"ENTRADA PIX QRS PALOMA", rd:"RECEITA", classificacao:"RECEITA DE VENDAS"},
      {description:"ENTRADA PIX QRS HANNA",  rd:"MOVIMENTAÇÃO", classificacao:"MOVIMENTAÇÃO"},
    ]);
    expect(g.length).toBe(2);
  });
  it("remover um item recalcula o nome do grupo", () => {
    const comOutlier = groupByPrefix([
      {description:"PIX ENVIADO ORB COMERCIO LTDA", rd:"D", classificacao:"F"},
      {description:"PIX ENVIADO ORB SERVICOS ME",   rd:"D", classificacao:"F"},
    ]);
    expect(comOutlier[0].nome).toBe("PIX ENVIADO ORB");
    const semOutlier = groupByPrefix([
      {description:"PIX ENVIADO ORB COMERCIO LTDA", rd:"D", classificacao:"F"},
      {description:"PIX ENVIADO ORB COMERCIO ME",   rd:"D", classificacao:"F"},
    ]);
    expect(semOutlier[0].nome).toBe("PIX ENVIADO ORB COMERCIO");
  });
  it("ignora linha sem R/D ou Classificação", () => {
    expect(groupByPrefix([{description:"X Y Z", rd:"", classificacao:""}])).toEqual([]);
  });
  it("prefixo curto demais não agrupa", () => {
    const g = groupByPrefix([
      {description:"DA CLARO 123", rd:"D", classificacao:"F"},
      {description:"DA VIVO 456",  rd:"D", classificacao:"F"},
    ]);
    expect(g.length).toBe(2);
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
