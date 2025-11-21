// api/test-order.js
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name: 'Teste Supabase',
        email: 'teste@supabase.com',
        status: 'pending',
        payment_method: 'pix',
        amount: 1,
        download_allowed: false,
      })
      .select('*')
      .single();

    if (error) {
      console.error('ERRO TEST-ORDER:', error);
      return res.status(500).json({ error: 'Erro ao inserir no Supabase.' });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('ERRO GERAL TEST-ORDER:', err);
    return res.status(500).json({ error: 'Erro geral.' });
  }
}