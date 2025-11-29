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
      .from('public.ebook_order')
      .select('id, status, download_allowed, created_at')
      .eq('email', email)
      .eq('download_allowed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // retorna null se não tiver

    if (error) {
      console.error('Erro ao verificar download_allowed:', error);
      return res.status(500).json({ error: 'Erro ao consultar pedido' });
    }

    if (!data) {
      return res.status(200).json({ allowed: false });
    }

    return res.status(200).json({
      allowed: true,
      orderId: data.id,
      status: data.status,
    });
  } catch (e) {
    console.error('Erro geral em /api/check-download:', e);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
