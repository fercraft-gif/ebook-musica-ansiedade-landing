// /api/mp-webhook.js
import mercadopago from "mercadopago";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendEbookEmail } from "../lib/sendEmail.js";

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  const { type, topic } = req.query;
  const paymentId =
    req.query["data.id"] ||
    req.body?.data?.id ||
    req.body?.id ||
    null;

  if (!paymentId || (type !== "payment" && topic !== "payment")) {
    res.status(200).send("Ignored");
    return;
  }

  try {
    const payment = await mercadopago.payment.findById(paymentId);
    const body = payment.body;

    const status = body.status;
    const metadata = body.metadata || {};
    const ebookOrderId = metadata.ebook_order_id || null;

    if (status === "approved" && ebookOrderId) {
      // 1) Atualiza pedido como pago + libera download
      const { data: order, error } = await supabaseAdmin
        .from("ebook_order")
        .update({
          status: "paid",
          rastreamento_id: paymentId,
          download_allowed: true,
        })
        .eq("id", ebookOrderId)
        .select("email, name")
        .single();

      if (error) {
        console.error("Erro ao atualizar ebook_order:", error);
      } else if (order?.email) {
        // 2) Dispara e-mail automático
        await sendEbookEmail({
          toEmail: order.email,
          toName: order.name,
        });
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Erro no webhook do Mercado Pago:", err);
    res.status(500).send("Error");
  }
}
