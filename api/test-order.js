// /api/test-order.js
import { supabaseAdmin } from '../lib/supabaseAdmin';

export default async function handler(req, res) {
  const { error } = await supabaseAdmin
    .from('ebook_order')
    .insert({
      name: 'Teste ENV OK',
      email: 'teste@teste.com',
      status: 'test',
      payment_method: 'pix',
    });

  if (error) {
    console.error('Erro ao inserir no Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
