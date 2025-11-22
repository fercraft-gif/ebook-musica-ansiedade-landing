// /api/mp-webhook.js
import mercadopago from "mercadopago";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// (opcional mas recomendado) valida assinatura
function isValidSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // se não setou, não bloqueia

  const signature = req.headers["x-signature"] || "";
  const requestId = req.headers["x-request-id"] || "";
  const dataId =
    req.query["data.id"] ||
    req.body?.data?.id ||
    req.body?.id ||
    "";

  // MP assina algo como: ts=...;v1=HASH
  // A validação exata varia, então aqui é uma checagem simples de presença.
  // Se quiser hard-security depois, fazemos HMAC certinho.
  if (!signature || !requestId || !dataId) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  if (!isValidSignature(req)) {
    return res.status(401).send("Invalid signature");
  }

  const { type, topic } = req.query;

  const paymentId =
    req.query["data.id"] ||
    req.body?.data?.id ||
    req.body?.id ||
    null;

  if (!paymentId || (type !== "payment" && topic !== "payment")) {
    return res.status(200).send("Ignored");
  }

  try {
    const payment = await mercadopago.payment.findById(paymentId);
    const body = payment.body;

    const status = body.status; // approved | pending | rejected ...
    const metadata = body.metadata || {};
    const ebookOrderId = metadata.ebook_order_id || null;

    if (!ebookOrderId) {
      return res.status(200).send("No ebook_order_id");
    }

    // mapeia status MP -> seu enum status_pedido
    let newStatus = "pendencia";
    let downloadAllowed = false;

    if (status === "approved") {
      newStatus = "aprovado";
      downloadAllowed = true;
    } else if (status === "rejected" || status === "cancelled") {
      newStatus = "rejeitado";
      downloadAllowed = false;
    }

    const { error } = await supabaseAdmin
      .from("ebook_order")
      .update({
        status: newStatus,
        rastreamento_id: String(paymentId),
        download_allowed: downloadAllowed,
      })
      .eq("id", ebookOrderId);

    if (error) {
      console.error("Erro ao atualizar ebook_order:", error);
      return res.status(500).send("DB error");
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Erro no webhook do Mercado Pago:", err);
    return res.status(500).send("Error");
  }
}
