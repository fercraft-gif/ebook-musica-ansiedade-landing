// /api/create-checkout.js

import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.error('MP_ACCESS_TOKEN não configurado nas variáveis de ambiente!');
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
        error: 'Nome e e-mail são obrigatórios.',
      });
    }

    // 1. cria pedido na Supabase
    const { data: order, error } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name,
        email,
        status: 'pending',
        download_allowed: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao inserir pedido na Supabase:', error);
      return res.status(500).json({ error: 'Erro ao criar pedido' });
    }

    const orderId = order.id;

    // 2. cria preferência no Mercado Pago
    const preference = await mercadopago.preferences.create({
      items: [
        {
          title: 'E-book Música & Ansiedade',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: 129,
        },
      ],
      external_reference: orderId, // liga MP → Supabase
      metadata: {
        paymentMethod: paymentMethod || 'pix',
      },
      back_urls: {
        success: 'https://octopusaxisebook.com/obrigado.html',
        pending: 'https://octopusaxisebook.com/pagamento-pendente.html',
        failure: 'https://octopusaxisebook.com/pagamento-erro.html',
      },
      auto_return: 'approved',
      notification_url: 'https://octopusaxisebook.com/api/mp-webhook',
    });

    const initPoint = preference.body.init_point;
    const prefId = preference.body.id;

    // 3. salva referencia da preferência (opcional, mas bom)
    await supabaseAdmin
      .from('ebook_order')
      .update({
        mp_external_reference: orderId,
        mp_raw: { preference_id: prefId },
      })
      .eq('id', orderId);

    // 4. responde para o frontend
    return res.status(200).json({
      initPoint,
      preferenceId: prefId,
    });
  } catch (err) {
    console.error('Erro interno em /api/create-checkout:', err);
    return res.status(500).json({ error: 'Erro interno ao criar checkout.' });
  }
}
