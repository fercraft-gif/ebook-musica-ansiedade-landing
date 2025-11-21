// api/create-checkout.js
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

const PRICE = 129.0; // ajuste se mudar

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { name, email, paymentMethod } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });
    }

    // 1) Cria pedido PENDING no Supabase
    const { data: order, error: insertError } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name,
        email,
        status: 'pending', // precisa existir no enum status_pedido
        payment_method: paymentMethod || 'pix',
        amount: PRICE,
        download_allowed: false,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Erro insert Supabase', insertError);
      return res.status(500).json({ error: 'Erro ao criar pedido' });
    }

    // 2) Cria preferência no Mercado Pago
    const preference = await mercadopago.preferences.create({
      payer: {
        name,
        email,
      },
      items: [
        {
          title: 'E-book Música & Ansiedade',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: PRICE,
        },
      ],
      external_reference: order.id, // ligação com a tabela
      back_urls: {
        success: 'https://octopusaxisebook.com/obrigada.html',
        failure: 'https://octopusaxisebook.com/erro.html',
        pending: 'https://octopusaxisebook.com/pendente.html',
      },
      auto_return: 'approved',
      notification_url:
        'https://octopusaxisebook.com/api/mp-webhook', // webhook hospedado na Vercel
    });

    const initPoint =
      preference.body.init_point || preference.body.sandbox_init_point;

    // 3) Envia link de checkout pro front
    return res.status(200).json({ checkoutUrl: initPoint });
  } catch (err) {
    console.error('Erro create-checkout', err);
    return res.status(500).json({ error: 'Erro interno no checkout' });
  }
}
