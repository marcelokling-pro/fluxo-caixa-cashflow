import { describe, it, expect } from "vitest";
import { parseValue, merchantKey, flexMatch, localClassify, sameMerchant, applyDetailItemEdit, findDetailMatches, applyDetailPropagation, commonPrefix, groupByPrefix, parseOFX, fitKey, resolveSign, conciliar, contaKey, grupoKey, ehLinhaDeSaldo, partyKey, keywordGenerica, classificarPorContraparte, construirHistoricoContraparte, coberturaDaRegra, resumoDivergencia, soFormaDePagamento, nomeRegraSugerido, regraSoOperacao } from "./App.jsx";

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
  // v8.4.2 — trocado o exemplo de "SISPAG" pra "CONTADOR": SISPAG (bare) saiu da base.
  it("classifica pela base quando nada foi removido", () => {
    expect(localClassify("PAGAMENTO CONTADOR EMPRESA", [], []).matchedKw).toBeTruthy();
  });
  it("nao usa classificacao base que o usuario removeu", () => {
    const antes = localClassify("PAGAMENTO CONTADOR EMPRESA", [], []);
    expect(localClassify("PAGAMENTO CONTADOR EMPRESA", [], [antes.matchedKw])).toBeNull();
  });
  it("remocao de base nao afeta as outras regras base", () => {
    const antes = localClassify("PAGAMENTO CONTADOR EMPRESA", [], []);
    expect(localClassify("PIX QR CODE RECEBIDO CLIENTE", [], [antes.matchedKw])).not.toBeNull();
  });
  it("categoria propria do usuario vence mesmo com a base removida", () => {
    const antes = localClassify("PAGAMENTO CONTADOR EMPRESA", [], []);
    const cats = [{ id: 9, name: "CONTADOR EMPRESA", rd: "DESPESAS FIXAS", classificacao: "FORNECEDORES", keywords: [] }];
    expect(localClassify("PAGAMENTO CONTADOR EMPRESA", cats, [antes.matchedKw]).c).toBe("FORNECEDORES");
  });
  // v8.4.2 — verbo bancário puro (sem contraparte identificável) não chuta mais MOVIMENTAÇÃO;
  // fica sem match aqui e segue pra Gemini/revisão em vez de mascarar despesa real.
  it("PIX ENVIADO/TED ENVIADA/SISPAG soltos nao tem mais fallback pra MOVIMENTAÇÃO", () => {
    expect(localClassify("PIX ENVIADO", [], [])).toBeNull();
    expect(localClassify("TED ENVIADA", [], [])).toBeNull();
    expect(localClassify("SISPAG", [], [])).toBeNull();
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

// v8.2.0 — conciliação por grupo
const L = (date, description, value, conta="1618995128") => ({date, description, value, conta});
const SISPAG = [
  L("31/08/2026","SISPAG SALARIOS",-433.52),
  L("31/08/2026","SISPAG SALARIOS",-300),
  L("31/08/2026","SISPAG SALARIOS",-300),
];

describe("conciliar", () => {
  it("reimportar o mesmo arquivo nao traz nada", () => {
    expect(conciliar(SISPAG, SISPAG)).toEqual([]);
  });
  it("banco reemite o dia com um lancamento a mais: entra so o excedente", () => {
    const novo = [...SISPAG, L("31/08/2026","SISPAG SALARIOS",-300)];
    const r = conciliar(SISPAG, novo);
    expect(r.length).toBe(1);
    expect(r[0].value).toBe(-300);
  });
  it("dois lancamentos legitimos identicos entram os dois quando o banco nao tem nenhum", () => {
    expect(conciliar([], SISPAG).length).toBe(3);
  });
  it("texto reescrito pelo banco nao duplica", () => {
    const gravado = [L("31/08/2026","BOLETO PAGO J B DOS SANT",-128.66)];
    const arquivo = [L("31/08/2026","SAÍDA BOLETO  PAGO J B DOS SANT",-128.66)];
    expect(conciliar(gravado, arquivo)).toEqual([]);
  });
  it("ordem invertida no arquivo nao duplica", () => {
    expect(conciliar(SISPAG, [...SISPAG].reverse())).toEqual([]);
  });
  it("estorno de mesmo valor e sinal oposto entra", () => {
    const gravado = [L("31/08/2026","INTERMEDICA",-128.66)];
    const arquivo = [L("31/08/2026","ESTORNO INTERMEDICA",128.66)];
    expect(conciliar(gravado, arquivo).length).toBe(1);
  });
  it("mesmo valor e dia em contas diferentes nao se anulam", () => {
    const gravado = [L("31/08/2026","SISPAG SALARIOS",-300,"1618995128")];
    const arquivo = [L("31/08/2026","PAGAMENTO",-300,"196909244")];
    expect(conciliar(gravado, arquivo).length).toBe(1);
  });
  it("mesmo valor em dias diferentes entra", () => {
    const gravado = [L("31/07/2026","INTERMEDICA",-128.66)];
    const arquivo = [L("31/08/2026","INTERMEDICA",-128.66)];
    expect(conciliar(gravado, arquivo).length).toBe(1);
  });
  it("extrato parcial do dia: entram so os que faltavam", () => {
    const gravado = [L("04/09/2026","PIX RECEBIDO",9.9)];
    const arquivo = [L("04/09/2026","PIX RECEBIDO",9.9), L("04/09/2026","PIX RECEBIDO",9.9), L("04/09/2026","PIX RECEBIDO",9.9)];
    expect(conciliar(gravado, arquivo).length).toBe(2);
  });
});

describe("contaKey", () => {
  it("mesma conta escrita como no OFX e como na planilha do Itau", () => {
    expect(contaKey("1618995128")).toBe(contaKey("00995128"));
  });
  it("contas diferentes continuam diferentes", () => {
    expect(contaKey("1618995128")).not.toBe(contaKey("196909244"));
  });
  it("ignora pontuacao da conta", () => {
    expect(contaKey("0099512-8")).toBe(contaKey("00995128"));
  });
});

describe("ehLinhaDeSaldo", () => {
  it("reconhece as linhas de saldo dos tres bancos", () => {
    ["SALDO ANTERIOR","SALDO TOTAL DISPONÍVEL DIA","SALDO EM CONTA CORRENTE","Saldo do Dia"]
      .forEach(d => expect(ehLinhaDeSaldo(d)).toBe(true));
  });
  it("nao confunde com lancamento que so comeca parecido", () => {
    expect(ehLinhaDeSaldo("SALDOS E PAGAMENTOS LTDA")).toBe(false);
    expect(ehLinhaDeSaldo("PIX RECEBIDO")).toBe(false);
  });
});

// v8.4.0 — Fase 1: classificação por contraparte (quem pagou/recebeu), auditada contra a
// base real de PROD (1367 lançamentos, ver CLASSIFICACAO-diagnostico-e-proposta.md)
describe("partyKey", () => {
  it("usa a razão social quando ela é específica", () => {
    expect(partyKey("PIX ENVIADO", "HANNA GONCALVES KLING")).toBe("HANNA GONCALVES KLING");
  });
  it("sem razão social, extrai o nome que sobra da descrição após o verbo bancário", () => {
    expect(partyKey("PIX ENVIADO JANSO ADV PARTNERS LTDA", "")).toBe("JANSO ADV PARTNERS");
  });
  it("colunas trocadas: razão social é ela mesma um verbo bancário, usa a descrição", () => {
    expect(partyKey("Hanna Kling", "Pix enviado")).toBe("HANNA KLING");
  });
  it("sem nome nenhum (só o verbo), não força correspondência", () => {
    expect(partyKey("PIX ENVIADO", "")).toBeNull();
    expect(partyKey("PIX ENVIADO", null)).toBeNull();
  });
  it("remove CPF/CNPJ e sufixo societário", () => {
    expect(partyKey("", "M2K GERENCIAMENTO EMPRESARIAL LTDA")).toBe("M2K GERENCIAMENTO EMPRESARIAL");
    expect(partyKey("PIX ENVIADO FULANO DE TAL 123.456.789-00", "")).toBe("FULANO DE TAL");
  });
  it("sobra de operação não vira contraparte (achado real: 'PIX QR CODE' tratado como pessoa)", () => {
    expect(partyKey("PAGAMENTOS PIX QR-CODE", "")).toBeNull();
    expect(partyKey("PAGAMENTOS SISPAG PIX QR-CODE", null)).toBeNull();
  });
  it("verbo só com fronteira de palavra: 'TED' não come o começo de 'TEDESCO'", () => {
    expect(partyKey("PIX ENVIADO TEDESCO LTDA", "")).toBe("TEDESCO");
  });
});

describe("keywordGenerica", () => {
  it("recusa keyword que é só o verbo bancário", () => {
    expect(keywordGenerica("pix enviado")).toBe(true);
    expect(keywordGenerica("pagamentos")).toBe(true);
    expect(keywordGenerica("qr code recebido")).toBe(true);
  });
  it("aceita nome específico de contraparte", () => {
    expect(keywordGenerica("janso adv partners")).toBe(false);
    expect(keywordGenerica("isabela penha gomes 42370038845")).toBe(false);
  });
  it("aceita nome de categoria que não é verbo bancário", () => {
    expect(keywordGenerica("advogados")).toBe(false);
  });
  it("verbo seguido de outro verbo continua genérico", () => {
    expect(keywordGenerica("pagamentos pix qr-code")).toBe(true);
  });
});

describe("soFormaDePagamento", () => {
  it("descrição que é só forma de pagamento sobe pra decisão", () => {
    expect(soFormaDePagamento("PIX ENVIADO")).toBe(true);
    expect(soFormaDePagamento("PAGAMENTOS PIX QR-CODE")).toBe(true);
    expect(soFormaDePagamento("TED ENVIADA")).toBe(true);
    expect(soFormaDePagamento("PIX ENVIADO JANSO14/08")).toBe(true);
  });
  it("descrição que identifica segue pela classificação cadastrada", () => {
    expect(soFormaDePagamento("PIX ENVIADO JANSO ADV PARTNERS")).toBe(false);
    expect(soFormaDePagamento("RECEBIMENTO REDE MAST CD")).toBe(false);
    expect(soFormaDePagamento("SISPAG SALARIOS")).toBe(false);
    expect(soFormaDePagamento("TED RECEBIDA")).toBe(false);
    expect(soFormaDePagamento("DOCERIA DA ANA")).toBe(false);
  });
  it("não pega venda por QR code nem cheque com regra própria (achados reais: 74 vendas, 31 cheques)", () => {
    expect(soFormaDePagamento("PIX QR CODE RECEBIDO RAQUEL MONT16/09")).toBe(false);
    expect(soFormaDePagamento("CH COMPENSADO 341 000130")).toBe(false);
  });
});

describe("classificarPorContraparte", () => {
  const cats = [
    {id:1, name:"HANNA KLING", rd:"MOVIMENTAÇÃO", classificacao:"MOVIMENTAÇÃO", subcategoria:null},
    {id:2, name:"PDV OMIE", rd:"DESPESAS FIXAS", classificacao:"DESPESA OPERACIONAL LOJA", subcategoria:"PDV"},
    {id:3, name:"SAÍDA PIX ENVIADO JANSO ADV PA", rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESAS ADMINISTRATIVAS", subcategoria:"ADVOGADOS"},
  ];
  it("classificação cadastrada da contraparte vence o histórico (achado real: OMIEXPERIENCE)", () => {
    const comOmie = [...cats, {id:4, name:"OMIEXPERIENC", rd:"DESPESAS FIXAS", classificacao:"DESPESA OPERACIONAL LOJA", subcategoria:"PDV"}];
    const hist = construirHistoricoContraparte([
      {id:"a", description:"PAGAMENTOS", razao_social:"OMIEXPERIENCE S.A.", value:-70, rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESAS ADMINISTRATIVAS"},
      {id:"b", description:"PAGAMENTOS", razao_social:"OMIEXPERIENCE S.A.", value:-70, rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESAS ADMINISTRATIVAS"},
    ]);
    const r = classificarPorContraparte({description:"PAGAMENTOS", razao_social:"OMIEXPERIENCE S.A.", value:-72}, comOmie, hist);
    expect(r).toMatchObject({r:"DESPESAS FIXAS", c:"DESPESA OPERACIONAL LOJA", sub:"PDV"});
  });
  it("sem regra cadastrada, usa o histórico da contraparte", () => {
    const hist = construirHistoricoContraparte([
      {id:"a", description:"PIX ENVIADO", razao_social:"CIBELLY SOARES MANTOAN", value:-1420, rd:"DESPESAS FIXAS", classificacao:"DESPESAS COM PESSOAL", subcategoria:"SALÁRIOS"},
    ]);
    const r = classificarPorContraparte({description:"PIX ENVIADO", razao_social:"CIBELLY SOARES MANTOAN", value:-1500}, cats, hist);
    expect(r).toMatchObject({r:"DESPESAS FIXAS", c:"DESPESAS COM PESSOAL", sub:"SALÁRIOS"});
  });
  it("regra não pula palavras: 'HANNA KLING' não pega 'HANNA GONCALVES KLING'", () => {
    expect(classificarPorContraparte({description:"PIX ENVIADO", razao_social:"HANNA GONCALVES KLING", value:-500}, cats, new Map())).toBeNull();
    expect(classificarPorContraparte({description:"PIX ENVIADO", razao_social:"Hanna Kling", value:-500}, cats, new Map())).toMatchObject({r:"MOVIMENTAÇÃO"});
  });
  it("aceita nome truncado pelo banco só no fim ('BEM MAIS GES')", () => {
    const c2 = [{id:9, name:"BEM MAIS GES", rd:"DESPESAS VARIÁVEIS", classificacao:"DESPESAS COM PESSOAL", subcategoria:null}];
    expect(classificarPorContraparte({description:"PAGAMENTOS", razao_social:"BEM MAIS GESTORA DE PLANOS DE BENEFICIOS LTDA", value:-90}, c2, new Map())).toMatchObject({c:"DESPESAS COM PESSOAL"});
  });
  it("'PDV OMIE' não bate em contraparte 'OMIEXPERIENCE' (bug real: capturava FGTS/INSS de outras empresas)", () => {
    const r = classificarPorContraparte({description:"PAGAMENTOS", razao_social:"OMIEXPERIENCE S.A.", value:-71.19}, cats, new Map());
    expect(r).toBeNull();
  });
  it("sem razão social, o nome da descrição segue a mesma cascata (regra do nome)", () => {
    expect(classificarPorContraparte({description:"PIX ENVIADO JANSO ADV PARTNERS", razao_social:"", value:-1800}, cats, new Map())).toMatchObject({sub:"ADVOGADOS"});
  });
  it("sem razão social e sem regra, vale o que está gravado para o nome da descrição (J H I IMOVEI)", () => {
    const hist = construirHistoricoContraparte([1,2,3].map(i=>({id:i, description:"BOLETO PAGO J H I IMOVEI", value:-981, rd:"DESPESAS FIXAS", classificacao:"DESPESA OPERACIONAL LOJA"})));
    expect(classificarPorContraparte({description:"BOLETO PAGO J H I IMOVEI", value:-1140}, [], hist)).toMatchObject({c:"DESPESA OPERACIONAL LOJA"});
  });
  it("empate no gravado: vence o mais recente, não a ordem de carga", () => {
    const base=[{id:1,date:"20/07/2026",rd:"DESPESAS FIXAS",classificacao:"DESPESAS COM PESSOAL"},{id:2,date:"17/09/2026",rd:"DESPESAS VARIÁVEIS",classificacao:"DESPESAS ADMINISTRATIVAS"}]
      .map(x=>({...x, description:"PAGAMENTOS", razao_social:"CEF MATRIZ", value:-500}));
    for (const lista of [base, [...base].reverse()])
      expect(classificarPorContraparte({description:"PAGAMENTOS", razao_social:"CEF MATRIZ", value:-10}, [], construirHistoricoContraparte(lista))).toMatchObject({c:"DESPESAS ADMINISTRATIVAS"});
  });
  it("sem razão social e só operação, nada aqui (PIX ENVIADO, SISPAG SALARIOS)", () => {
    expect(classificarPorContraparte({description:"PIX ENVIADO", value:-10}, cats, new Map())).toBeNull();
    expect(classificarPorContraparte({description:"SISPAG SALARIOS", value:-10}, cats, new Map())).toBeNull();
  });
  it("'JANSO ADV PARTNERS' casa com a regra cadastrada 'SAÍDA PIX ENVIADO JANSO ADV PA' (prefixo assimétrico)", () => {
    const r = classificarPorContraparte({description:"", razao_social:"JANSO ADV PARTNERS LTDA", value:-1800}, cats, new Map());
    expect(r).toMatchObject({r:"DESPESAS VARIÁVEIS", c:"DESPESAS ADMINISTRATIVAS", sub:"ADVOGADOS"});
  });
  it("direção errada não casa (regra de saída não classifica entrada)", () => {
    const r = classificarPorContraparte({description:"PIX RECEBIDO", razao_social:"Janso Adv Partners", value:1800}, cats, new Map());
    expect(r).toBeNull();
  });
  it("sem contraparte identificável, devolve null (nunca herda de outra)", () => {
    expect(classificarPorContraparte({description:"PIX ENVIADO", razao_social:"", value:-100}, cats, new Map())).toBeNull();
  });
});

describe("construirHistoricoContraparte", () => {
  it("agrupa por contraparte + direção e exclui o próprio id (leave-one-out)", () => {
    const base = [
      {id:"x", description:"PIX ENVIADO", razao_social:"Cibelly Soares Mantoan", value:-100, rd:"RECEITA", classificacao:"RECEITA DE VENDAS", subcategoria:null},
      {id:"y", description:"PIX ENVIADO", razao_social:"Cibelly Soares Mantoan", value:-200, rd:"RECEITA", classificacao:"RECEITA DE VENDAS", subcategoria:null},
    ];
    const hist = construirHistoricoContraparte(base, "y");
    expect(hist.get("CIBELLY SOARES MANTOAN|S")).toHaveLength(1);
    expect(hist.get("CIBELLY SOARES MANTOAN|S")[0]).toMatchObject({r:"RECEITA", c:"RECEITA DE VENDAS"});
  });
});

// Cobertura real: o conflito de uma regra nova é medido pelos lançamentos que ela pegaria,
// não pelo nome parecido (que dava alarme falso em CONTA x CONTADOR e não via SISPAG x salários).
describe("coberturaDaRegra", () => {
  const DV="DESPESAS VARIÁVEIS", DA="DESPESAS ADMINISTRATIVAS";
  it("nome parecido sem lançamento em comum não é conflito (CONTA x CONTADOR)", () => {
    const tx=[{id:1, description:"PAGAMENTO CONTADOR SILVA", value:-500, rd:"DESPESAS FIXAS", classificacao:DA}];
    expect(coberturaDaRegra("CONTA AGUA LOJA CENTRO", DV, DA, tx).pegos).toBe(0);
  });
  it("conflito real: SISPAG pegaria salários com outra classificação", () => {
    const tx=[1,2,3].map(i=>({id:i, description:"SISPAG SALARIOS", value:-1000, rd:"DESPESAS FIXAS", classificacao:"DESPESAS COM PESSOAL"}));
    expect(coberturaDaRegra("SISPAG", DV, DA, tx).divergentes).toHaveLength(3);
  });
  it("regra mais longa já cadastrada ganha: SISPAG não disputa com SISPAG SALARIOS", () => {
    const tx=[1,2,3].map(i=>({id:i, description:"SISPAG SALARIOS", value:-1000, rd:"DESPESAS FIXAS", classificacao:"DESPESAS COM PESSOAL"}))
      .concat([{id:4, description:"SISPAG FORNECEDORES", value:-50, rd:"DESPESAS FIXAS", classificacao:"DESPESAS COM PESSOAL"}]);
    const cats=[{id:"s", name:"SISPAG SALARIOS", rd:"DESPESAS FIXAS", classificacao:"DESPESAS COM PESSOAL", keywords:[]}];
    const c=coberturaDaRegra("SISPAG", DV, DA, tx, null, cats);
    expect(c.divergentes.map(t=>t.id)).toEqual([4]);
  });
  it("razão social com histórico decide antes do texto: regra por texto não disputa", () => {
    const tx=[1,2].map(i=>({id:i, description:"SISPAG FORNEC X", razao_social:"ACME DISTRIBUIDORA LTDA", value:-10, rd:"DESPESAS FIXAS", classificacao:"FORNECEDORES"}));
    expect(coberturaDaRegra("SISPAG FORNEC", DV, DA, tx, null, []).divergentes).toHaveLength(0);
  });
  it("mesmo lançamento sozinho (sem outro histórico) cai no texto e é conflito", () => {
    const tx=[{id:1, description:"SISPAG FORNEC X", razao_social:"ACME DISTRIBUIDORA LTDA", value:-10, rd:"DESPESAS FIXAS", classificacao:"FORNECEDORES"}];
    expect(coberturaDaRegra("SISPAG FORNEC", DV, DA, tx, null, []).divergentes).toHaveLength(1);
  });
  it("só forma de pagamento sem razão social vai pra decisão: regra por texto não pega", () => {
    const tx=[{id:1, description:"PIX ENVIADO", value:-10, rd:DV, classificacao:"FORNECEDORES"}];
    expect(coberturaDaRegra("PIX ENVIADO", DV, DA, tx, null, []).pegos).toBe(0);
  });
  it("nome de outra regra ganha da keyword da nova", () => {
    const tx=[{id:1, description:"ALUGUEL LOJA CENTRO", value:-10, rd:"DESPESAS FIXAS", classificacao:"ALUGUEL"}];
    const cats=[{id:"a", name:"ALUGUEL", rd:"DESPESAS FIXAS", classificacao:"ALUGUEL", keywords:[]}];
    expect(coberturaDaRegra("IMOBILIARIA", DV, DA, tx, null, cats, ["imobiliaria","loja centro"]).pegos).toBe(0);
  });
  it("nome genérico mas consistente não é conflito (RECEBIMENTOS)", () => {
    const tx=[1,2].map(i=>({id:i, description:"RECEBIMENTOS", value:500, rd:"RECEITA", classificacao:"RECEITA DE VENDAS"}));
    const c=coberturaDaRegra("RECEBIMENTOS","RECEITA","RECEITA DE VENDAS",tx);
    expect(c.pegos).toBe(2); expect(c.divergentes).toHaveLength(0);
  });
  it("pega também pela contraparte da razão social, não só pelo texto", () => {
    const tx=[{id:1, description:"PIX ENVIADO", razao_social:"JANSO ADV PARTNERS LTDA", value:-100, rd:DV, classificacao:"MIDIAS E INTERNET"}];
    expect(coberturaDaRegra("JANSO ADV PARTNERS", DV, DA, tx).divergentes).toHaveLength(1);
  });
  it("ajustes contam o que está sendo salvo agora", () => {
    const tx=[{id:1, description:"PIX ENVIADO", razao_social:"JANSO ADV PARTNERS LTDA", value:-100, rd:DV, classificacao:"MIDIAS E INTERNET"}];
    const aj=new Map([[1,{rd:DV, classificacao:DA}]]);
    expect(coberturaDaRegra("JANSO ADV PARTNERS", DV, DA, tx, aj).divergentes).toHaveLength(0);
  });
  it("resumo mostra a classificação atual mais comum", () => {
    const r=resumoDivergencia([{rd:"A",classificacao:"X"},{rd:"A",classificacao:"X"},{rd:"B",classificacao:"Y"}]);
    expect(r).toMatchObject({total:3, principal:"A/X", qtd:2, outras:1});
  });
});

// Revisão: o nome sugerido para a regra é quem paga/recebe — nunca a operação (bug de origem:
// regra "PIX ENVIADO" criada pela revisão, que pegaria qualquer PIX de qualquer pessoa).
describe("nomeRegraSugerido / regraSoOperacao", () => {
  it("com razão social, sugere a razão social (sem sufixo societário)", () => {
    expect(nomeRegraSugerido({description:"PIX ENVIADO", razao_social:"FERNANDA ALVES COSTA", value:-275})).toBe("FERNANDA ALVES COSTA");
    expect(nomeRegraSugerido({description:"BOLETO PAGO", razao_social:"NOVA DISTRIBUIDORA DE EMBALAGENS LTDA", value:-640})).toBe("NOVA DISTRIBUIDORA DE EMBALAGENS");
  });
  it("sem razão social, sugere o nome que sobra depois da operação", () => {
    expect(nomeRegraSugerido({description:"BOLETO PAGO LOJA NOVA XPTO", value:-200})).toBe("LOJA NOVA XPTO");
  });
  it("só operação: nenhuma sugestão", () => {
    for (const d of ["PIX ENVIADO","TED ENVIADA","PAGAMENTOS PIX QR CODE","PAGAMENTOS PIX QR-CODE","BOLETO PAGO"])
      expect(nomeRegraSugerido({description:d, value:-10})).toBe("");
  });
  it("descrição que identifica sem operação continua sugerindo ela", () => {
    expect(nomeRegraSugerido({description:"PAGAMENTO CONTA AGUA LOJA CENTRO", value:-184})).not.toBe("");
  });
  it("regraSoOperacao barra nome de operação e deixa nome de pessoa/empresa", () => {
    expect(regraSoOperacao("PIX ENVIADO")).toBe(true);
    expect(regraSoOperacao("pagamentos pix qr code")).toBe(true);
    expect(regraSoOperacao("TED ENVIADA")).toBe(true);
    expect(regraSoOperacao("FERNANDA ALVES COSTA")).toBe(false);
    expect(regraSoOperacao("SISPAG SALARIOS")).toBe(false);
  });
});
