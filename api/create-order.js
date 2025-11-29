const axios = require('axios');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

// Use seu token de teste do Mercado Pago
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-3543822089074656-112909-0d987cb5009960e0e0d9da80818c0da0-3004692366';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Dados do pedido recebidos do frontend
    const {
      total_amount = '200.00',
      external_reference = 'ext_ref_1234',
      payer_email = 'test@testuser.com',
      payment_token = '1223123',
      payment_method_id = 'master',
      installments = 1
    } = req.body;

    // Monta o payload para Mercado Pago
    const payload = {
      type: 'online',
      processing_mode: 'automatic',
      total_amount,
      external_reference,
      payer: {
        email: payer_email
      },
      transactions: {
        payments: [
          {
            amount: total_amount,
            payment_method: {
              id: payment_method_id,
              type: 'credit_card',
              token: payment_token,
              installments
            }
          }
        ]
      }
    };

    // Chave de idempotência única
    const idempotencyKey = `order_${external_reference}_${Date.now()}`;

    // Faz a requisição para Mercado Pago
    const mpRes = await axios.post('https://api.mercadopago.com/v1/orders', payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      }
    });

    // Salva o pedido no Supabase
    const mpOrder = mpRes.data;
    const { id: mp_order_id, external_reference: mp_external_reference, payer, total_amount: mp_total_amount } = mpOrder;

    // Adapte os campos conforme sua tabela 'orders'
    const { data, error: supabaseError } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          mp_order_id,
          external_reference: mp_external_reference,
          payer_email: payer?.email,
          total_amount: mp_total_amount,
          status: mpOrder.status || 'created',
          raw: mpOrder // salva o objeto completo para debug
        }
      ]);

    if (supabaseError) {
      console.error('Erro ao salvar pedido no Supabase:', supabaseError);
      // Retorna o pedido Mercado Pago, mas avisa do erro Supabase
      return res.status(200).json({ order: mpOrder, supabaseError });
    }

    return res.status(200).json({ order: mpOrder, supabaseOrder: data });
  } catch (error) {
    console.error('Erro ao criar pedido Mercado Pago:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao criar pedido Mercado Pago', details: error.response?.data || error.message });
  }
};
