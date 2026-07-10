import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { data: settings } = await supabase.from("settings").select("key,value");
  const get = (k: string) => settings?.find((s: any) => s.key === k)?.value || "";

  const resendKey = get("resend_api_key");
  const daysAhead = parseInt(get("alert_days_ahead")) || 3;

  if (!resendKey) return new Response("Resend API key não configurada", { status: 500, headers: corsHeaders });

  const today = new Date();
  const mes   = today.getMonth() + 1;
  const ano   = today.getFullYear();
  const todayDay = today.getDate();

  const { data: agenda }      = await supabase.from("agenda").select("*");
  const { data: ocorrencias } = await supabase.from("agenda_ocorrencias").select("*");
  const { data: contacts }    = await supabase.from("alert_contacts").select("*");

  if (!contacts?.length) return new Response("Nenhum destinatário cadastrado", { status: 200, headers: corsHeaders });

  const DONE_STATUSES = ["pago", "baixado"];

  const upcomingMap = new Map<string, any>();

  // 1. Ocorrências de meses ANTERIORES em aberto (sem limite de retroatividade)
  (ocorrencias || []).forEach((oc: any) => {
    if (DONE_STATUSES.includes(oc.status)) return;
    // Apenas meses antes do atual
    if (oc.ano > ano || (oc.ano === ano && oc.mes >= mes)) return;

    const item = (agenda || []).find((a: any) => a.id === oc.agenda_id);
    if (!item) return;

    const key = `${item.id}_${oc.mes}_${oc.ano}`;
    if (!upcomingMap.has(key)) {
      upcomingMap.set(key, { ...item, checkMes: oc.mes, checkAno: oc.ano, daysUntil: -9999 });
    }
  });

  // 2. Mês atual: itens vencidos ou vencendo em breve sem baixa
  (agenda || []).forEach((item: any) => {
    const oc = (ocorrencias || []).find(
      (o: any) => o.agenda_id === item.id && o.mes === mes && o.ano === ano
    );
    if (oc && DONE_STATUSES.includes(oc.status)) return;

    const daysDiff = item.dia_vencimento - todayDay;
    if (daysDiff < 0 || daysDiff <= daysAhead) {
      const key = `${item.id}_${mes}_${ano}`;
      if (!upcomingMap.has(key)) {
        upcomingMap.set(key, { ...item, checkMes: mes, checkAno: ano, daysUntil: daysDiff });
      }
    }
  });

  const upcoming = [...upcomingMap.values()].sort((a, b) => {
    // Mais antigos primeiro, depois por dia de vencimento
    if (a.checkAno !== b.checkAno) return a.checkAno - b.checkAno;
    if (a.checkMes !== b.checkMes) return a.checkMes - b.checkMes;
    return a.dia_vencimento - b.dia_vencimento;
  });

  if (!upcoming.length) return new Response("Nenhum vencimento pendente", { status: 200, headers: corsHeaders });

  const monthName = (m: number, y: number) =>
    new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const whenLabel = (i: any) => {
    if (i.checkMes !== mes || i.checkAno !== ano)
      return `ATRASADO desde ${monthName(i.checkMes, i.checkAno)}`;
    return i.daysUntil < 0  ? `ATRASADO ${Math.abs(i.daysUntil)} dia(s)` :
           i.daysUntil === 0 ? "HOJE" :
           i.daysUntil === 1 ? "AMANHÃ" :
                               `em ${i.daysUntil} dias`;
  };

  const htmlRows = upcoming.map((i: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.nome}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">
        dia ${i.dia_vencimento}${i.checkMes !== mes ? ` <span style="color:#999;font-size:11px">(${i.checkMes}/${i.checkAno})</span>` : ""}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#E8445A;font-weight:600">${whenLabel(i)}</td>
    </tr>`).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#00C9A7">🔔 Alertas de Vencimento</h2>
      <p style="color:#666">Compromissos pendentes (vencidos ou com vencimento nos próximos ${daysAhead} dias):</p>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left">Compromisso</th>
            <th style="padding:8px 12px">Vencimento</th>
            <th style="padding:8px 12px">Quando</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:20px">Fluxo de Caixa v6.13.1 · ${today.toLocaleDateString("pt-BR")}</p>
    </div>`;

  let sent = 0;
  for (const contact of contacts) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Fluxo de Caixa <alertas@hannakling.com>",
        to: [contact.phone],
        subject: `🔔 ${upcoming.length} vencimento(s) pendente(s)`,
        html
      })
    });
    sent++;
  }

  return new Response(`Alertas enviados para ${sent} destinatário(s)`, { status: 200, headers: corsHeaders });
});
