// /api/mp-webhook.js
import mercadopago from "mercadopago";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  // Mercado Pago chama esse endpoint com query type/topic e data.id
  const { type, topic } = req.query;
  const paymentId =
    req.query["data.id"] ||
    req.body?.data?.id ||
    req.body?.id ||
    null;

  // Só tratamos notificações de pagamento
  if (!paymentId || (type !== "payment" && topic !== "payment")) {
    res.status(200).send("Ignored");
    return;
  }

  try {
    // 1) Buscar o pagamento no Mercado Pago
    const payment = await mercadopago.payment.findById(paymentId);
    const body = payment.body;

    const status = body.status; // "approved", "pending", etc.
    const metadata = body.metadata || {};
    const ebookOrderId = metadata.ebook_order_id || null;

    // 2) Só atualiza se tiver metadata e status aprovado
    if (status === "approved" && ebookOrderId) {
      const { error } = await supabaseAdmin
        .from("ebook_order")
        .update({
          status: "paid",           // precisa existir no enum status_pedido
          rastreamento_id: paymentId, // usa sua coluna de rastreamento
          download_allowed: true,  // libera o download
        })
        .eq("id", ebookOrderId);

      if (error) {
        console.error("Erro ao atualizar ebook_order pelo webhook:", error);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Erro no webhook do Mercado Pago:", err);
    res.status(500).send("Error");
  }
}
