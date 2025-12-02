// /api/download.js

import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // aceita email por query (?email=) ou body (POST)
  const email =
    req.query.email ||
    req.body?.email ||
    '';

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório.' });
  }

  try {
    // Confere se existe um pedido com download_allowed = true para esse email
    const { data, error } = await supabaseAdmin
      .from('ebook_order')
      .select('id, email, status, download_allowed')
      .eq('email', email)
      .eq('download_allowed', true)
      // .order('created_at', { ascending: false }) // <- removido, coluna não existe
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        'Erro ao verificar permissão de download:',
        JSON.stringify(error, null, 2)
      );
      return res.status(500).json({ error: 'Erro ao consultar pedido.' });
    }

    if (!data) {
      return res
        .status(403)
        .json({ error: 'Download não liberado para este e-mail.' });
    }

    // Caminho do arquivo do e-book (ajuste se estiver em outra pasta)
    const filePath = path.join(
      process.cwd(),
      'assets',
      'musica-e-ansiedade.pdf'
    );

    if (!fs.existsSync(filePath)) {
      console.error('Arquivo do e-book não encontrado em:', filePath);
      return res
        .status(500)
        .json({ error: 'Arquivo não encontrado no servidor.' });
    }

    // Define headers para download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="musica-e-ansiedade.pdf"'
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (e) {
    console.error('Erro geral em /api/download:', e);
    return res.status(500).json({ error: 'Erro interno no download.' });
  }
}
