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

  let { name, email, paymentMethod } = req.body || {};

  // normaliza método (enum mp_payment)
  if (paymentMethod !== 'pix' && paymentMethod !== 'card') {
    paymentMethod = 'pix';
  }

  if (!name || !email) {
    return res.status(400).json({
      error: 'Nome e e-mail são obrigatórios.'
    });
  }

  try {
    // 1) Cria pedido "pendencia"
    const { data: order, error: dbError } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name,
        email,
        payment_method: paymentMethod,
        status: 'pendencia',
        amount: 129.0,
        download_allowed: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      return res.status(500).json({
        error: dbError.message || 'Erro ao salvar pedido no banco.'
      });
    }

    // 2) Preferência Mercado Pago
    const preference = {
      items: [
        {
          title: 'E-book Música & Ansiedade',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: 129.0,
        },
      ],
      payer: { name, email },
      metadata: {
        ebook_order_id: order.id,
        payment_method: paymentMethod,
      },
      back_urls: {
        success: 'https://octopusaxisebook.com/obrigado.html',
        failure: 'https://octopusaxisebook.com/erro.html',
        pending: 'https://octopusaxisebook.com/pendente.html',
      },
      auto_return: 'approved',
    };

    const mpRes = await mercadopago.preferences.create(preference);

    const checkoutUrl =
      mpRes.body.init_point || mpRes.body.sandbox_init_point;

    if (!checkoutUrl) {
      console.error('MP sem init_point:', mpRes.body);
      return res.status(500).json({
        error: 'Mercado Pago não retornou checkoutUrl.'
      });
    }

    // 3) atualiza pedido com MP ids
    const { error: updateError } = await supabaseAdmin
      .from('ebook_order')
      .update({
        mp_preference_id: mpRes.body.id,
        mp_checkout_url: checkoutUrl,
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      // não derruba checkout
    }

    return res.status(200).json({ checkoutUrl });
  } catch (err) {
    console.error('Erro em /api/create-checkout:', err);
    return res.status(500).json({
      error: err?.message || 'Erro inesperado ao criar checkout.'
    });
  }
}
