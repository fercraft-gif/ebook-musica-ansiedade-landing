import { createPreference } from '../lib/mpCreatePreference.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { title = 'Meu produto', quantity = 1, unit_price = 2000 } = req.body || {};
    const preference = await createPreference({ title, quantity, unit_price });
    return res.status(200).json({ preference });
  } catch (err) {
    console.error('Erro ao criar preferência Mercado Pago:', err);
    return res.status(500).json({ error: 'Erro ao criar preferência', details: err.message });
  }
}
