// scripts/simulate-mp-webhook.js
// Simula uma chamada ao webhook Mercado Pago localmente

const axios = require('axios');

async function simulateWebhook() {
  // Ajuste os valores conforme o pedido criado
  const payload = {
    action: 'payment.created',
    data: {
      id: '1234567890', // id do pagamento Mercado Pago
      order: {
        id: 'ID_DO_PEDIDO_MERCADO_PAGO', // substitua pelo mp_order_id real
        external_reference: 'ext_ref_1234' // igual ao usado na criação
      }
    }
  };

  try {
    const res = await axios.post('http://localhost:3000/api/mp-webhook', payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Webhook response:', res.data);
  } catch (err) {
    console.error('Erro ao simular webhook:', err.response?.data || err.message);
  }
}

simulateWebhook();
