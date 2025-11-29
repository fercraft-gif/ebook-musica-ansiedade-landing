// lib/mpCreatePreference.js
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

/**
 * Cria uma preferência de pagamento Mercado Pago
 * @param {Object} item - Produto a ser vendido
 * @param {string} item.title - Nome do produto
 * @param {number} item.quantity - Quantidade
 * @param {number} item.unit_price - Preço unitário
 * @returns {Promise<Object>} - Preferência criada
 */
export async function createPreference(item) {
  const preference = {
    items: [item],
    back_urls: {
      success: 'https://octopusaxisebook.com/obrigado',
      failure: 'https://octopusaxisebook.com/erro',
      pending: 'https://octopusaxisebook.com/pendente'
    },
    auto_return: 'approved'
  };
  const res = await mercadopago.preferences.create(preference);
  return res.body;
}
