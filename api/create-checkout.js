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
    const { name, email } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    }

    //
    // 1) CRIA pedido inicial na tabela
    //
    const { data: order, error: insertErr } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name,
        email,
        status: 'pending',
        mp_status: null,
        download_allowed: false
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Erro ao inserir pedido:', insertErr);
      return res.status(500).json({
        step: 'supabase-insert',
        error: 'Erro ao criar pedido no Supabase',
        details: insertErr
      });
    }

    const orderId = order.id;

    //
    // 2) Cria preferência no Mercado Pago
    //
    let preference;
    try {
      preference = await mercadopago.preferences.create({
        items: [
          {
            title: 'E-book Música & Ansiedade',
            quantity: 1,
            unit_price: 129.0
          }
        ],
        external_reference: orderId,
        payer: { email }
      });
    } catch (mpErr) {
      console.error('Erro Mercado Pago:', mpErr);
      return res.status(500).json({
        step: 'mp-preference',
        error: 'Erro ao criar preferência no Mercado Pago',
        details: mpErr?.response?.body || mpErr?.message || String(mpErr)
      });
    }

    const initPoint = preference?.body?.init_point;
    const prefId = preference?.body?.id;

    if (!initPoint || !prefId) {
      console.error('Resposta inesperada do MP:', preference?.body);
      return res.status(500).json({
        step: 'mp-missing-init-point',
        error: 'MP não retornou initPoint'
      });
    }

    //
    // 3) Atualiza o registro com dados da preferência
    //
    const { error: updateErr } = await supabaseAdmin
      .from('ebook_order')
      .update({
        mp_external_reference: String(orderId),
        mp_raw: preference.body
      })
      .eq('id', orderId);

    if (updateErr) {
      console.error('Erro ao atualizar preferência no Supabase:', updateErr);
      // Não bloqueia — continua
    }

    //
    // 4) RETORNA PARA O FRONT
    //
    return res.status(200).json({
      initPoint,
      preferenceId: prefId,
      orderId,
      name,
      email
    });

  } catch (err) {
    console.error('Erro interno em /api/create-checkout:', err);
    return res.status(500).json({
      step: 'internal',
      error: 'Erro interno ao criar checkout.',
      details: err?.message || String(err)
    });
  }
}
