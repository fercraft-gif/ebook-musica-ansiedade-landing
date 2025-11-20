// /api/mp-webhook.js
// Webhook do Mercado Pago -> Supabase (tabela ebook_order)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { type, action, data } = body;

    // Notificação do MP em geral vem como:
    // { type: "payment", action: "payment.updated", data: { id: "123456" } }
    if (type !== "payment" || !data || !data.id) {
      // nada a fazer, mas respondemos 200 pra MP não reenviar
      return res.status(200).json({ ignored: true });
    }

    const paymentId = data.id;

    // 1. Buscar detalhes completos do pagamento no Mercado Pago
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!mpRes.ok) {
      const text = await mpRes.text();
      console.error("Erro ao consultar pagamento no Mercado Pago:", mpRes.status, text);
      return res.status(500).json({ error: "Mercado Pago lookup failed" });
    }

    const payment = await mpRes.json();

    // 2. Só atualiza se estiver APROVADO
    if (payment.status === "approved") {
      const payerEmail = payment?.payer?.email || null;

      if (!payerEmail) {
        // ainda assim respondemos 200 para não gerar loop de notificações
        console.warn(
          "Pagamento aprovado mas sem e-mail do pagador no payload. ID:",
          paymentId
        );
        return res.status(200).json({ ok: true, warning: "no payer email" });
      }

      // 3. Atualiza a linha correspondente no Supabase
      const { error } = await supabase
        .from("ebook_order")
        .update({
          status: "paid",
          mp_payment: paymentId,
        })
        .eq("email", payerEmail)
        .eq("status", "pending");

      if (error) {
        console.error("Erro ao atualizar Supabase com pagamento aprovado:", error);
        return res.status(500).json({ error: "Supabase update failed" });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Erro no webhook do Mercado Pago:", e);
    return res.status(500).json({ error: "webhook failed" });
  }
}