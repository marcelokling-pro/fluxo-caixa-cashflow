import { describe, it, expect } from "vitest";
import { parseValue, merchantKey, flexMatch, localClassify, sameMerchant, applyDetailItemEdit, findDetailMatches, applyDetailPropagation, commonPrefix, groupByPrefix, parseOFX, fitKey, resolveSign } from "./App.jsx";

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

  // v7.22.0 — "Remover" numa classificacao base era so cosmetico: sumia da tela e continuava
  // classificando na importacao. hiddenBase agora faz o Passe 3 pular a regra removida.
  it("classifica pela base quando nada foi removido", () => {
    expect(localClassify("PAGAMENTO SISPAG FORNECEDOR", [], []).matchedKw).toBeTruthy();
  });
  it("nao usa classificacao base que o usuario removeu", () => {
    const antes = localClassify("PAGAMENTO SISPAG FORNECEDOR", [], []);
    expect(localClassify("PAGAMENTO SISPAG FORNECEDOR", [], [antes.matchedKw])).toBeNull();
  });
  it("remocao de base nao afeta as outras regras base", () => {
    const antes = localClassify("PAGAMENTO SISPAG FORNECEDOR", [], []);
    expect(localClassify("PIX QR CODE RECEBIDO CLIENTE", [], [antes.matchedKw])).not.toBeNull();
  });
  it("categoria propria do usuario vence mesmo com a base removida", () => {
    const antes = localClassify("PAGAMENTO SISPAG FORNECEDOR", [], []);
    const cats = [{ id: 9, name: "SISPAG FORNECEDOR", rd: "DESPESAS FIXAS", classificacao: "FORNECEDORES", keywords: [] }];
    expect(localClassify("PAGAMENTO SISPAG FORNECEDOR", cats, [antes.matchedKw]).c).toBe("FORNECEDORES");
  });
});

// v8.0.0 — leitura de OFX
const OFX_ITAU = `OFXHEADER:100
<OFX>
<BANKACCTFROM>
<BANKID>0341
<ACCTID>1618995128
</BANKACCTFROM>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260904100000[-03:EST]
<TRNAMT>12303.10
<FITID>20260904001
<MEMO>SALDO TOTAL DISPONÍVEL DIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260904100000[-03:EST]
<TRNAMT>9.90
<FITID>20260904003
<MEMO>PIX QR CODE RECEBIDO MICHELE SOA04/09 MICHELE SOARES DO NASCIMENTO 166.400.628-10
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260831100000[-03:EST]
<TRNAMT>-300.00
<FITID>20260831006
<MEMO>SISPAG SALARIOS
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260831100000[-03:EST]
<TRNAMT>-300.00
<FITID>20260831007
<MEMO>SISPAG SALARIOS
</STMTTRN>
</OFX>`;

const OFX_INTER = `OFXHEADER:100
<OFX>
<BANKACCTFROM>
<BANKID>077</BANKID>
<ACCTID>523342292</ACCTID>
</BANKACCTFROM>
<STMTTRN>
<TRNTYPE>PAYMENT</TRNTYPE>
<DTPOSTED>20260820</DTPOSTED>
<TRNAMT>-2600.00</TRNAMT>
<FITID>202608200772</FITID>
<MEMO>Pix enviado: "Cp :60701190-HANNA KLING"</MEMO>
<NAME>Hanna Kling</NAME>
</STMTTRN>
</OFX>`;

describe("parseOFX", () => {
  it("descarta bloco de saldo do dia (nao e movimento)", () => {
    const rows = parseOFX(OFX_ITAU);
    expect(rows.length).toBe(3);
    expect(rows.some(r => r.description.startsWith("SALDO "))).toBe(false);
  });
  it("converte data, valor com sinal e conta", () => {
    const [pix] = parseOFX(OFX_ITAU);
    expect(pix.date).toBe("04/09/2026");
    expect(pix.value).toBeCloseTo(9.90);
    expect(pix.conta).toBe("1618995128");
    expect(parseOFX(OFX_ITAU)[1].value).toBeCloseTo(-300);
  });
  it("separa razao social e descricao do MEMO do Itau", () => {
    const [pix] = parseOFX(OFX_ITAU);
    expect(pix.description).toBe("PIX QR CODE RECEBIDO MICHELE SOA04/09");
    expect(pix.razao_social).toBe("MICHELE SOARES DO NASCIMENTO");
  });
  it("dois SISPAG identicos no mesmo dia tem FITID diferente", () => {
    const sispag = parseOFX(OFX_ITAU).filter(r => r.description === "SISPAG SALARIOS");
    expect(sispag.length).toBe(2);
    expect(sispag[0].fitid).not.toBe(sispag[1].fitid);
  });
  it("le o Inter, com tags fechadas, data curta e NAME proprio", () => {
    const [t] = parseOFX(OFX_INTER);
    expect(t.date).toBe("20/08/2026");
    expect(t.value).toBeCloseTo(-2600);
    expect(t.razao_social).toBe("Hanna Kling");
    expect(t.fitid).toBe("202608200772");
    expect(t.conta).toBe("523342292");
  });
  it("ignora arquivo que nao e OFX", () => {
    expect(parseOFX("data;descricao;valor")).toEqual([]);
  });
});

describe("fitKey", () => {
  it("mesmo FITID em contas diferentes gera chaves diferentes", () => {
    expect(fitKey("1618995128", "20260904003")).not.toBe(fitKey("999", "20260904003"));
  });
  it("mesma conta e mesmo FITID gera a mesma chave", () => {
    expect(fitKey("1618995128", "20260904003")).toBe(fitKey("1618995128", "20260904003"));
  });
});

// v8.1.0 — cabeçalhos com sufixo de unidade e valor vindo de Débito/Crédito
describe("resolveSign com colunas separadas (layout C6)", () => {
  it("saida preenchida vira valor negativo", () => {
    expect(resolveSign(undefined, {debito:"2528.33", credito:"0.00"})).toBeCloseTo(-2528.33);
  });
  it("entrada preenchida vira valor positivo", () => {
    expect(resolveSign(undefined, {debito:"0.00", credito:"32130.00"})).toBeCloseTo(32130);
  });
  it("sem coluna de valor e sem par continua NaN", () => {
    expect(resolveSign(undefined, {})).toBeNaN();
  });
});
