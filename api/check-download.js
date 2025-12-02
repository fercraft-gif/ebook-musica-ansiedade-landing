// /api/check-download.js
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const email =
    req.query.email ||
    req.body?.email ||
    '';

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ebook_order')
      .select('id, email, status, mp_status, download_allowed, mp_payment_id, mp_external_reference, created_at')
      .eq('email', email)
      .eq('download_allowed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // retorna null se não tiver linha

       if (error) {
      console.error(
        'Erro ao verificar download_allowed:',
        JSON.stringify(error, null, 2)
      );
      return res.status(500).json({ error: 'Erro ao consultar pedido.' });
    }

    if (!data) {
      // não encontrou pedido liberado para esse e-mail
      return res.status(200).json({ allowed: false });
    }

    // encontrou um pedido com download_allowed = true
    return res.status(200).json({
      allowed: true,
      orderId: data.id,
      email: data.email,
      status: data.status,
      mp_status: data.mp_status,
      mp_payment_id: data.mp_payment_id,
      mp_external_reference: data.mp_external_reference,
      created_at: data.created_at,
    });
  } catch (e) {
    console.error('Erro geral em /api/check-download:', e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
}