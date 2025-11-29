// /api/download.js
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

// Ajuste esse caminho se o nome do arquivo for diferente
// (por exemplo, '/assets/musica-e-ansiedade.pdf' ou parecido)
const EBOOK_FILE_PATH = '/musica-e-ansiedade.pdf';

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
      .select('id, download_allowed, created_at')
      .eq('email', email)
      .eq('download_allowed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar permissão de download:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: 'Erro ao consultar pedido' });
    }

    if (!data) {
      return res
        .status(403)
        .json({ error: 'Download ainda não foi liberado para este e-mail.' });
    }

    // Redireciona para o arquivo estático do e-book
    res.setHeader('Location', EBOOK_FILE_PATH);
    res.statusCode = 302;
    res.end();
  } catch (e) {
    console.error('Erro geral em /api/download:', e);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
