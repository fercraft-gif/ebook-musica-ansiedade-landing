// /api/mp-webhook.js

import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import crypto from 'crypto';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    // 🔒 Validação opcional de assinatura (só roda se TUDO existir)
    const signature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (signature && xRequestId && secret) {
      const [tsPart, v1Part] = signature.split(',');
      const ts = tsPart.split('=')[1];
      const v1 = v1Part.split('=')[1];

      // tenta pegar o id tanto de IPN quanto de Webhook
      const dataIdForTemplate =
        req.query['data.id'] ||
        req.query.id ||
        req.body?.data?.id ||
        req.body?.id;

      const template = `id:${dataIdForTemplate};request-id:${xRequestId};ts:${ts};`;

      const hash = crypto
        .createHmac('sha256', secret)
        .update(template)
        .digest('hex');

      if (hash !== v1) {
        console.warn('Assinatura inválida no webhook MP');
        return res.status(401).end();
      }
    }

    // 🔔 identifica tipo de evento
    const topic =
      req.query.topic ||      // IPN: ?topic=payment&id=...
      req.query.type ||       // variações
      req.body?.type ||       // Webhook novo
      req.body?.action;       // fallback

    // id do pagamento (várias formas possíveis)
    const paymentId =
      req.query.id ||         // IPN clássico
      req.query['data.id'] || // Webhook moderno
      req.body?.data?.id ||
      req.body?.id;

    if (topic !== 'payment' || !paymentId) {
      console.log('Webhook não é de pagamento, ignorando', { topic, paymentId });
      return res.status(200).json({ ignored: true });
    }

    // 🔍 consulta o pagamento no Mercado Pago
    const paymentResponse = await mercadopago.payment.findById(paymentId);
    const payment = paymentResponse.body;

    const orderId = payment.external_reference; // vem do create-checkout
    const mpStatus = payment.status;

    const update = {
      mp_payment_id: String(payment.id),
      mp_status: mpStatus,
      mp_raw: payment,
    };

    if (mpStatus === 'approved') {
      update.status = 'paid';
      update.download_allowed = true;
    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(mpStatus)) {
      update.status = 'failed';
      update.download_allowed = false;
    }

    if (!orderId) {
      console.warn('Pagamento sem external_reference, não sei qual pedido atualizar');
      return res.status(200).json({ ok: true, skipped: true });
    }

    const { error: supaError } = await supabaseAdmin
      .from('ebook_order')
      .update(update)
      .eq('id', orderId);

    if (supaError) {
      console.error('Erro ao atualizar pedido na Supabase:', supaError);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro webhook:', err);
    // Mercado Pago só precisa de 200 pra parar de reenviar
    return res.status(200).json({ error: true });
  }
}
