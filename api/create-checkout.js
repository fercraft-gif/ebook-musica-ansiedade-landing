// /api/create-checkout.js
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { name, email, paymentMethod } = req.body || {};

  if (!name || !email || !paymentMethod) {
    res.status(400).json({ error: 'Dados obrigatórios faltando' });
    return;
  }

  try {
    // 1) Cria registro na tabela ebook_order como "pending"
    const { data: order, error: dbError } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        buyer_name: name,
        email,
        payment_method: paymentMethod,
        status: 'pending',      // texto simples
        amount: 129.0,
        download_allowed: false // começa bloqueado
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 2) Cria preferência no Mercado Pago
    const preference = {
      items: [
        {
          title: 'E-book Música & Ansiedade',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: 129.0, // ajuste se mudar o preço
        },
      ],
      payer: {
        name,
        email,
      },
      metadata: {
        ebook_order_id: order.id,     // para casar depois no webhook
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

    // 3) Atualiza o pedido com dados da preferência
    await supabaseAdmin
      .from('ebook_order')
      .update({
        mp_preference_id: mpRes.body.id,
        mp_checkout_url: checkoutUrl,
      })
      .eq('id', order.id);

    // 4) Responde para o front
    res.status(200).json({ checkoutUrl });
  } catch (err) {
    console.error('Erro em /api/create-checkout', err);
    res.status(500).json({ error: 'Erro ao criar checkout' });
  }
}
