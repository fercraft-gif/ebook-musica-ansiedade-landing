// /api/mp-webhook.js
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  const { type, topic } = req.query;

  const paymentId =
    req.query['data.id'] ??
    req.body?.data?.id ??
    req.body?.id ??
    null;

  // Garante que é um webhook de pagamento
  if (!paymentId || (type !== 'payment' && topic !== 'payment')) {
    return res.status(200).send('Ignored');
  }

  try {
    const payment = await mercadopago.payment.findById(paymentId);
    const body = payment.body;

    const status = body.status; // 'approved', 'rejected', etc.
    const metadata = body.metadata || {};
    const ebookOrderId = metadata.ebook_order_id;

    if (!ebookOrderId) {
      console.warn('Webhook sem ebook_order_id no metadata');
      return res.status(200).send('No ebook_order_id');
    }

    // Pagamento aprovado → libera download
    if (status === 'approved') {
      const { error } = await supabaseAdmin
        .from('ebook_order')
        .update({
          status: 'aprovado',               // enum status_pedido
          rastreamento_id: String(paymentId),
          download_allowed: true,
        })
        .eq('id', ebookOrderId);

      if (error) {
        console.error('Erro ao atualizar ebook_order (approved):', error);
      }
    }

    // Pagamento rejeitado → marca como rejeitado
    if (status === 'rejected') {
      const { error } = await supabaseAdmin
        .from('ebook_order')
        .update({
          status: 'rejeitado',
          download_allowed: false,
        })
        .eq('id', ebookOrderId);

      if (error) {
        console.error('Erro ao atualizar ebook_order (rejected):', error);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Erro no webhook do Mercado Pago:', err);
    return res.status(500).send('Error');
  }
}
