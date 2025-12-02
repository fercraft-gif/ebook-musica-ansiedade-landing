// /api/mp-webhook.js

import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.error('MP_ACCESS_TOKEN não configurado para webhook!');
} else {
  mercadopago.configure({ access_token: accessToken });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = req.body || {};
    const paymentId = body?.data?.id || body?.data?.payment?.id;

    if (!paymentId) {
      console.error('Webhook sem paymentId válido:', JSON.stringify(body));
      // responde 200 pra não fazer o MP ficar re-tentando sem parar
      return res.status(200).json({ received: true });
    }

    // 1) Busca detalhes do pagamento no Mercado Pago
    let payment;
    try {
      const resp = await mercadopago.payment.findById(paymentId);
      payment = resp.body;
    } catch (mpErr) {
      console.error(
        'Erro ao buscar payment no Mercado Pago:',
        mpErr?.response?.body || mpErr
      );
      return res.status(500).json({
        error: 'Erro ao consultar pagamento no Mercado Pago',
      });
    }

    const externalRef = payment.external_reference;
    const mpStatus = payment.status; // 'approved', 'pending', 'rejected', etc.
    const approved = mpStatus === 'approved';

    if (!externalRef) {
      console.error('Pagamento sem external_reference:', payment);
      return res.status(200).json({ ok: true });
    }

    // 2) Atualiza a linha na tabela ebook_order
    const { error: supaError } = await supabaseAdmin
      .from('ebook_order')
      .update({
        mp_status: mpStatus,                  // text
        mp_payment_id: String(paymentId),     // text
        status: approved ? 'paid' : 'pending', // text
        download_allowed: approved,           // bool
        mp_raw: payment,                      // jsonb (estado mais recente do payment)
        mp_external_reference: String(externalRef), // text (redundante, mas útil p/ debug)
      })
      .eq('id', externalRef); // external_reference = orderId (uuid) que criamos no checkout

    if (supaError) {
      console.error(
        'Erro ao atualizar pedido no webhook:',
        JSON.stringify(supaError, null, 2)
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro interno em /api/mp-webhook:', err);
    return res.status(500).json({ error: 'Erro interno no webhook' });
  }
}
