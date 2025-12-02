// /api/create-checkout.js

import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.error('MP_ACCESS_TOKEN não configurado!');
} else {
  mercadopago.configure({ access_token: accessToken });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // usa let pra normalizar o paymentMethod
    let { name, email, paymentMethod } = req.body || {};

    // validação
    if (!name || !email) {
      return res.status(400).json({
        step: 'validation',
        error: 'Nome e e-mail são obrigatórios.',
      });
    }

    if (paymentMethod !== 'pix' && paymentMethod !== 'card') {
      paymentMethod = 'pix';
    }

    // 1) INSERIR LINHA NA TABELA ebook_order
    const { data: order, error: supaError } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name,                  // text
        email,                 // text
        status: 'pending',     // text
        mp_status: 'pending',  // text
        download_allowed: false, // bool
        // mp_raw, mp_external_reference, mp_payment_id ficam NULL por enquanto
      })
      .select('id')
      .single();

    if (supaError) {
      console.error(
        'Erro ao inserir pedido na Supabase:',
        JSON.stringify(supaError, null, 2)
      );
      return res.status(500).json({
        step: 'supabase-insert',
        error: 'Erro ao criar pedido na Supabase',
        details: supaError,
      });
    }

    const orderId = order.id;

    // 2) CRIAR PREFERÊNCIA NO MERCADO PAGO
    if (!accessToken) {
      console.error('MP_ACCESS_TOKEN ausente — abortando criação do checkout');
      return res.status(500).json({
        step: 'mp-preference',
        error: 'MP_ACCESS_TOKEN ausente no servidor',
      });
    }

    let preference;
    try {
      const notificationUrl =
        process.env.MP_NOTIFICATION_URL ||
        'https://octopusaxisebook.com/api/mp-webhook';

      preference = await mercadopago.preferences.create({
        items: [
          {
            title: 'E-book Música & Ansiedade',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: 129,
          },
        ],
        payer: {
          name,
          email,
        },
        external_reference: orderId, // uuid da linha que acabamos de criar
        metadata: {
          paymentMethod: paymentMethod || 'pix',
        },
        back_urls: {
          success: 'https://octopusaxisebook.com/obrigado.html',
          pending: 'https://octopusaxisebook.com/pagamento-pendente.html',
          failure: 'https://octopusaxisebook.com/pagamento-erro.html',
        },
        notification_url: notificationUrl,
        auto_return: 'approved',
      });
    } catch (mpErr) {
      if (mpErr?.response) {
        console.error(
          'Erro Mercado Pago (preferences.create): status',
          mpErr.response.status,
          'body',
          JSON.stringify(mpErr.response.body)
        );
      } else {
        console.error('Erro Mercado Pago (preferences.create):', mpErr);
      }

      return res.status(500).json({
        step: 'mp-preference',
        error: 'Erro ao criar preferência no Mercado Pago',
        details: mpErr?.response?.body || mpErr?.message || String(mpErr),
      });
    }

    const initPoint = preference?.body?.init_point;
    const prefId = preference?.body?.id;

    if (!initPoint || !prefId) {
      console.error(
        'Resposta inesperada do Mercado Pago:',
        JSON.stringify(preference?.body || preference)
      );
      return res.status(500).json({
        step: 'mp-preference',
        error:
          'Resposta inesperada do Mercado Pago, favor verificar logs no servidor',
      });
    }

    // 3) ATUALIZAR A LINHA COM OS DADOS DA PREFERÊNCIA
    const { error: supaUpdateError } = await supabaseAdmin
      .from('ebook_order')
      .update({
        mp_external_reference: String(orderId), // text
        mp_raw: preference.body,                // jsonb
      })
      .eq('id', orderId);

    if (supaUpdateError) {
      console.error(
        'Erro ao atualizar pedido com dados da preferência:',
        JSON.stringify(supaUpdateError, null, 2)
      );
      // não bloqueia o fluxo, só loga
    }

    // 4) RESPONDE PARA O FRONT
    return res.status(200).json({
      initPoint: initPoint,
      preferenceId: prefId,
      orderId,
      name,
      email,
    });
  } catch (err) {
    console.error('Erro interno em /api/create-checkout:', err);
    return res.status(500).json({
      step: 'unknown',
      error: 'Erro interno ao criar checkout.',
      details: err?.message || String(err),
    });
  }
}
