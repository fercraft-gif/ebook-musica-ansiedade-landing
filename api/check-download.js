// api/check-download.js
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const EBOOK_FILE_URL =
  'https://octopusaxisebook.com/files/musica-ansiedade.pdf';
// ↑ troque para a URL real do PDF (pode ser Supabase Storage, S3, etc.)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }

    const { data, error } = await supabaseAdmin
      .from('ebook_order')
      .select('*')
      .eq('email', email)
      .eq('download_allowed', true)
      .eq('status', 'approved') // precisa existir no enum
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro Supabase check-download', error);
      return res.status(500).json({ error: 'Erro ao verificar no banco.' });
    }

    if (!data) {
      return res.status(404).json({
        error:
          'Nenhuma compra liberada encontrada para este e-mail. Verifique se o pagamento já foi confirmado.',
      });
    }

    // Se achou uma compra liberada, devolve a URL do arquivo
    return res.status(200).json({ downloadUrl: EBOOK_FILE_URL });
  } catch (err) {
    console.error('Erro geral check-download', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}
