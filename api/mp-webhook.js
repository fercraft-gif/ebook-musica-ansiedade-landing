// /api/mp-webhook.js
import crypto from 'crypto';
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
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
      console.log('[MP Webhook] Ignorado: topic', topic, 'dataId', dataId);
      return res.status(200).json({ ignored: true });
    }

    // Busca o pagamento no MP
    const paymentResponse = await mercadopago.payment.findById(dataId);
    const payment = paymentResponse.body;
    console.log('[MP Webhook] Recebido:', {
      dataId,
      paymentId: payment.id,
      external_reference: payment.external_reference,
      preference_id: payment.preference_id,
      status: payment.status
    });

    let orderId = payment.external_reference;
    const preferenceIdFromPayment = payment.preference_id || payment.preference?.id || payment.order?.preference_id;
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

    let updatedOrder;
    let updateError;

    // Tenta atualizar por external_reference
    if (orderId) {
      ({ data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('ebook_order')
        .update(update)
        .eq('id', orderId)
        .select('id, email')
        .single());
      if (updateError) {
        console.error('[MP Webhook] Erro ao atualizar por external_reference:', JSON.stringify(updateError, null, 2));
      } else if (updatedOrder) {
        console.log('[MP Webhook] Pedido atualizado por external_reference:', updatedOrder);
      }
    }

    // Fallback: se não achou por external_reference, tenta por mp_preference_id
    if ((!orderId || updateError || !updatedOrder) && preferenceIdFromPayment) {
      const { data: found, error: findError } = await supabaseAdmin
        .from('ebook_order')
        .select('id')
        .eq('mp_preference_id', String(preferenceIdFromPayment))
        .limit(1)
        .maybeSingle();

      if (findError) {
        console.error('[MP Webhook] Erro ao buscar pedido por mp_preference_id:', JSON.stringify(findError, null, 2));
      } else if (found?.id) {
        orderId = found.id;
        ({ data: updatedOrder, error: updateError } = await supabaseAdmin
          .from('ebook_order')
          .update(update)
          .eq('id', orderId)
          .select('id, email')
          .single());
        if (updateError) {
          console.error('[MP Webhook] Erro ao atualizar por mp_preference_id:', JSON.stringify(updateError, null, 2));
        } else if (updatedOrder) {
          console.log('[MP Webhook] Pedido atualizado por mp_preference_id:', updatedOrder);
        }
      } else {
        console.warn('[MP Webhook] Nenhum pedido encontrado para mp_preference_id:', preferenceIdFromPayment);
      }
    }

    if (!updatedOrder) {
      console.warn('[MP Webhook] Nenhum pedido atualizado para pagamento:', dataId, 'preference:', preferenceIdFromPayment, 'external_reference:', orderId);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro webhook:', err);
    // MP só precisa de 200 para parar de reenviar, então não manda 500 aqui
    return res.status(200).json({ error: true });
  }
}
