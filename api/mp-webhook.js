// api/mp-webhook.js
import { createClient } from "@supabase/supabase-js";

// CLIENTE ADMIN (SERVICE ROLE) — SÓ NO SERVIDOR
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const type = body.type;
    const data = body.data || {};

    // Ignora notificações que não são de pagamento
    if (type !== "payment" || !data.id) {
      return res.status(200).json({ ignored: true });
    }

    const paymentId = String(data.id);

    // 1. Buscar detalhes reais no Mercado Pago
    const mpRes = await fetch(
       `https://api.mercadopago.com/v1/payments/${paymentId}`,
       {
      headers: {
         Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
     }
  );

     const payment = await mpRes.json();

     // 2. Só continua se estiver aprovado
    if (payment.status !== "approved") {
      return res.status(200).json({ status: payment.status });
    }

    // 3. Garantir e-mail do pagador
    const payerEmail = payment?.payer?.email;

    if (!payerEmail) {
      console.error("Pagamento aprovado SEM e-mail. ID:", paymentId);
      return res
        .status(500)
        .json({ error: "Pagamento sem e-mail do pagador" });
    }

    // 4. Atualiza pedido no Supabase
    const { error } = await supabase
      .from("ebo ok_order")
      .update({
        status: "paid",
        download_allowed: true,
        mp_payment: paymentId,
      })
      .eq("email", payerEmail)
      .eq("status", "pending");

    if (error) {
      console.error("Erro ao atualizar Supabase:", error);
      return res.status(500).json({ error: "Supabase update failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("ERRO NO WEBHOOK:", e);
    return res.status(500).json({ error: "webhook failed" });
  }
}
