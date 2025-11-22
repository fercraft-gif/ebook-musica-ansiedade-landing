// /api/test-order.js
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    // 1) Checar se as ENVs chegaram
    const infoEnv = {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // 2) Tentar inserir um registro de teste
    const { data, error } = await supabaseAdmin
      .from('ebook_order')
      .insert({
        name: 'Teste ENV OK',
        email: 'teste@teste.com',
        payment_method: 'pix',   // enum mp_payment: pix | card
        status: 'pendencia',     // enum status_pedido: pendencia | aprovado | rejeitado
        amount: 129.0,
        download_allowed: false,
      })
      .select()
      .single();

    // 3) Se o Supabase reclamou, devolve o erro em texto
    if (error) {
      console.error('Erro ao inserir teste em ebook_order:', error);
      return res.status(200).json({
        ok: false,
        step: 'insert',
        env: infoEnv,
        supabaseError: {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
      });
    }

    // 4) Sucesso
    return res.status(200).json({
      ok: true,
      env: infoEnv,
      data,
    });
  } catch (e) {
    console.error('Erro geral em /api/test-order:', e);
    return res.status(200).json({
      ok: false,
      step: 'exception',
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      error: e.message,
      stack: e.stack,
    });
  }
}
