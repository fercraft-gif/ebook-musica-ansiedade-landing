// /api/mp-webhook.js
import crypto from 'crypto';
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🔒 Validação opcional da assinatura (x-signature)
    const signature = req.headers['x-signature']; // "ts=...,v1=..."
    const xRequestId = req.headers['x-request-id'];
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (signature && xRequestId && secret) {
      const [tsPart, v1Part] = signature.split(',');
      const ts = tsPart.split('=')[1];
      const v1 = v1Part.split('=')[1];

      const template = `id:${req.query['data.id'] || req.query.id};request-id:${xRequestId};ts:${ts};`;

      const hash = crypto
        .createHmac('sha256', secret)
        .update(template)
        .digest('hex');

      if (hash !== v1) {
        console.warn('Assinatura inválida no webhook MP');
        return res.status(401).end();
      }
    }

    // Tópico + ID
    const topic = req.query.topic || req.body.type;
    const dataId = req.query.id || req.query['data.id'] || req.body.data?.id;

    if (topic !== 'payment' || !dataId) {
      return res.status(200).json({ ignored: true });
    }

    // Busca o pagamento no MP
    const paymentResponse = await mercadopago.payment.findById(dataId);
    const payment = paymentResponse.body;

    const orderId = payment.external_reference;
    const mpStatus = payment.status;

    const update = {
      mp_payment_id: String(payment.id),
      mp_status: mpStatus,
      mp_raw: payment,
    };

    if (mpStatus === 'approved') {
      update.status = 'paid';
      update.download_allowed = true;
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      update.status = 'failed';
      update.download_allowed = false;
    }

    await supabaseAdmin
      .from('public.ebook_order')
      .update(update)
      .eq('id', orderId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro webhook:', err);
    // MP só precisa de 200 para parar de reenviar, então não manda 500 aqui
    return res.status(200).json({ error: true });
  }
}
