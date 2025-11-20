// /api/mp-webhook.js
// Webhook do Mercado Pago -> Supabase (tabela ebook_order)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 1. Só aceita POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body ?? {};
    const { type, data } = body;

    // Notificação típica:
    // { type: "payment", action: "payment.updated", data: { id: "123456" } }
    if (type !== "payment" || !data?.id) {
      return res.status(200).json({ ignored: true });
    }

    const paymentId = String(data.id);

    // 2. Busca detalhes completos do pagamento no Mercado Pago
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!mpRes.ok) {
      const text = await mpRes.text();
      console.error(
        "Erro ao consultar pagamento no Mercado Pago:",
        mpRes.status,
        text
      );
      return res.status(500).json({ error: "Mercado Pago lookup failed" });
    }

    const payment = await mpRes.json();

    // 3. Só mexe no Supabase se o pagamento estiver APROVADO
    if (payment.status !== "approved") {
      console.log("Pagamento ainda não aprovado. Status:", payment.status);
      return res.status(200).json({ ok: true, status: payment.status });
    }

    // 4. E-mail do pagador vindo do Mercado Pago
    const payerEmail =
      payment?.payer?.email ||
      payment?.additional_info?.payer?.email ||
      null;

    if (!payerEmail) {
      // >>> AQUI ENTRA SUA REGRA: NÃO ACEITO PAGAMENTO APROVADO SEM E-MAIL <<<
      console.error(
        "Pagamento APROVADO, mas o Mercado Pago não enviou e-mail do pagador no payload. ID:",
        paymentId
      );
      // NÃO libera download, não marca ok
      return res
        .status(500)
        .json({ error: "Pagamento sem e-mail do pagador no payload" });
    }

    // 5. Atualiza a linha correspondente no Supabase
    const { error } = await supabase
      .from("ebook_order")
      .update({
        status: "paid",
        download_allowed: true,
      })
      .eq("email", payerEmail)
      .eq("status", "pending"); // cuidado com typo aqui

    if (error) {
      console.error(
        "Erro ao atualizar Supabase com pagamento aprovado:",
        error
      );
      return res.status(500).json({ error: "Supabase update failed" });
    }

    // Sucesso: pagamento aprovado + e-mail presente + download liberado
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Erro no webhook do Mercado Pago:", e);
    return res.status(500).json({ error: "webhook failed" });
  }
}