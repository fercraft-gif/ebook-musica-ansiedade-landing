// /api/mp-webhook.js
import mercadopago from "mercadopago";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  // MP sempre manda POST
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const body = req.body || {};

    // paymentId pode vir nestes formatos
    const paymentId =
      body?.data?.id ||
      body?.id ||
      req.query?.data_id ||
      req.query?.id;

    if (!paymentId) {
      console.log("Webhook recebido sem paymentId:", body);
      return res.status(200).send("ok");
    }

    // Busca pagamento no MP
    const mpPayment = await mercadopago.payment.findById(paymentId);
    const p = mpPayment.body;

    const orderId = p.external_reference; // vem do create-checkout

    console.log("MP webhook pagamento:", {
      id: p.id,
      status: p.status,
      status_detail: p.status_detail,
      external_reference: orderId,
      payer_email: p.payer?.email,
      transaction_amount: p.transaction_amount,
      payment_type_id: p.payment_type_id,
    });

    if (!orderId) {
      console.warn("Pagamento sem external_reference. Não sei qual order atualizar.");
      return res.status(200).send("ok");
    }

    // Mapeia status MP -> seu enum
    let newStatus = "pendencia";
    let downloadAllowed = false;

    if (p.status === "approved") {
      newStatus = "aprovado";
      downloadAllowed = true;
    } else if (p.status === "rejected" || p.status === "cancelled") {
      newStatus = "rejeitado";
    } else {
      newStatus = "pendencia";
    }

    // Atualiza pedido na Supabase
    const { error } = await supabaseAdmin
      .from("ebook_order")
      .update({
        status: newStatus,
        download_allowed: downloadAllowed,
        mp_payment_id: p.id,
        mp_status: p.status,
        mp_status_detail: p.status_detail,
        paid_at: p.status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", orderId);

    if (error) {
      console.error("Erro atualizando order no Supabase:", error);
    } else {
      console.log("Order atualizada:", orderId, newStatus);
    }

    // SEMPRE responde 200 pro MP não ficar re-tentando
    return res.status(200).send("ok");
  } catch (err) {
    console.error("Erro no webhook MP:", err);
    // Mesmo em erro interno, MP exige 200
    return res.status(200).send("ok");
  }
}
