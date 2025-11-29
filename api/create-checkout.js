// /api/create-checkout.js

import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.error('MP_ACCESS_TOKEN não configurado!');
}

mercadopago.configure({ access_token: accessToken });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, paymentMethod } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({
        step: 'validation',
        error: 'Nome e e-mail são obrigatórios.',
      });
    }

    // 1) INSERÇÃO NA SUPABASE
    const { data: order, error: supaError } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name,
        email,
        status: 'pending',
        download_allowed: false,
      })
      .select('id')
      .single();

    if (supaError) {
      console.error('Erro ao inserir pedido na Supabase:', supaError);
      return res.status(500).json({
        step: 'supabase-insert',
        error: 'Erro ao criar pedido na Supabase',
        details: supaError,
      });
    }

    const orderId = order.id;

    // 2) CRIA A PREFERÊNCIA NO MERCADO PAGO
    let preference;
    try {
      preference = await mercadopago.preferences.create({
        items: [
          {
            title: 'E-book Música & Ansiedade',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: 129,
          },
        ],
        external_reference: orderId,
        metadata: {
          paymentMethod: paymentMethod || 'pix',
        },
        back_urls: {
          success: 'https://octopusaxisebook.com/obrigado.html',
          pending: 'https://octopusaxisebook.com/pagamento-pendente.html',
          failure: 'https://octopusaxisebook.com/pagamento-erro.html',
        },
        notification_url: 'https://octopusaxisebook.com/api/mp-webhook',
        auto_return: 'approved',
      });
    } catch (mpErr) {
      console.error('Erro Mercado Pago (preferences.create):', mpErr?.response?.body || mpErr);
      return res.status(500).json({
        step: 'mp-preference',
        error: 'Erro ao criar preferência no Mercado Pago',
        details: mpErr?.response?.body || mpErr?.message || mpErr,
      });
    }

    const initPoint = preference.body.init_point;
    const prefId = preference.body.id;

    // 3) ATUALIZA A LINHA NA SUPABASE COM INFO DA PREFERÊNCIA
    const { error: supaUpdateError } = await supabaseAdmin
      .from('ebook_order')
      .update({
        mp_external_reference: orderId,
        mp_raw: { preference_id: prefId },
      })
      .eq('id', orderId);

    if (supaUpdateError) {
      console.error('Erro ao atualizar pedido com dados da preferência:', supaUpdateError);
      // Não bloqueio o checkout — só aviso no JSON
    }

    // 4) RESPONDE PARA O FRONTEND NO FORMATO QUE O script.js ESPERA
    return res.status(200).json({
      checkoutUrl: initPoint,   // <-- script.js usa "checkoutUrl"
      preferenceId: prefId,
      orderId,
    });

  } catch (err) {
    console.error('Erro interno em /api/create-checkout:', err);
    return res.status(500).json({
      step: 'unknown',
      error: 'Erro interno ao criar checkout.',
      details: err?.message || err,
    });
  }
}
