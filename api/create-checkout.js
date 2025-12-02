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
    // TEM QUE SER "let" pra poder normalizar o paymentMethod
    let { name, email, paymentMethod } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({
        step: 'validation',
        error: 'Nome e e-mail são obrigatórios.',
      });
    }

    // normaliza paymentMethod
    if (paymentMethod !== 'pix' && paymentMethod !== 'card') {
      paymentMethod = 'pix';
    }

    // 1) INSERÇÃO INICIAL NA SUPABASE
    const { data: order, error: supaError } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        // Nomes IGUAIS aos da tabela:
        name,                  // text
        email,                 // text
        status: 'pending',     // text
        mp_status: 'pending',  // text
        download_allowed: false, // bool
        // mp_raw            -> jsonb, fica NULL por enquanto
        // mp_external_reference -> text, fica NULL por enquanto
        // mp_payment_id     -> text, será preenchido no webhook
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

    // 2) CRIA A PREFERÊNCIA NO MERCADO PAGO
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
            unit_price: 129, // R$
          },
        ],
        external_reference: orderId, // vamos casar com `mp_external_reference`
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

    // 3) ATUALIZA A LINHA NA SUPABASE COM OS CAMPOS EXTRAS
    const { error: supaUpdateError } = await supabaseAdmin
      .from('ebook_order')
      .update({
        // nomes exatamente como na tabela:
        mp_external_reference: String(orderId), // text
        mp_raw: preference.body,               // jsonb -> objeto inteiro
        // mp_payment_id continua NULL aqui;
        // será preenchido no /api/mp-webhook quando o pagamento for aprovado
      })
      .eq('id', orderId);

    if (supaUpdateError) {
      console.error(
        'Erro ao atualizar pedido com dados da preferência:',
        JSON.stringify(supaUpdateError, null, 2)
      );
      // não bloqueia o checkout
    }

    // 4) RESPONDE PARA O FRONTEND
    return res.status(200).json({
      initPoint: initPoint,
      preferenceId: prefId,
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
