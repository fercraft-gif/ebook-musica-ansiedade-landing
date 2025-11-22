// /api/test-order.js
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name: 'Teste ENV OK',
        email: 'teste@teste.com',
        payment_method: 'pix',
        status: 'pendencia',
        amount: 129.0,
        download_allowed: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir teste em ebook_order:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    console.error('Erro geral em /api/test-order:', e);
    return res.status(500).json({ error: e.message });
  }
}
