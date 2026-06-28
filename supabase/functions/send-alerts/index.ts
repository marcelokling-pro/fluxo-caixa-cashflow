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

  const upcoming = (agenda || []).filter((item: any) => {
    const oc = (ocorrencias || []).find(
      (o: any) => o.agenda_id === item.id && o.mes === mes && o.ano === ano
    );
    if (oc && DONE_STATUSES.includes(oc.status)) return false;

    // já venceu este mês e ainda não foi quitado
    if (item.dia_vencimento < todayDay) return true;

    // vence nos próximos daysAhead dias
    for (let d = 0; d <= daysAhead; d++) {
      const dt = new Date(today);
      dt.setDate(todayDay + d);
      if (dt.getDate() === item.dia_vencimento) return true;
    }
    return false;
  }).map((item: any) => ({ ...item, daysUntil: item.dia_vencimento - todayDay }));

  if (!upcoming.length) return new Response("Nenhum vencimento pendente", { status: 200, headers: corsHeaders });

  const whenLabel = (d: number) =>
    d < 0  ? `ATRASADO ${Math.abs(d)} dia(s)` :
    d === 0 ? "HOJE" :
    d === 1 ? "AMANHÃ" :
              `em ${d} dias`;

  const htmlRows = upcoming.map((i: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.nome}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">dia ${i.dia_vencimento}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${i.daysUntil<=0?"#E8445A":i.daysUntil<=2?"#F5A623":"#333"};font-weight:600">${whenLabel(i.daysUntil)}</td>
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
      <p style="color:#999;font-size:12px;margin-top:20px">Fluxo de Caixa v5.2.1 · ${today.toLocaleDateString("pt-BR")}</p>
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
