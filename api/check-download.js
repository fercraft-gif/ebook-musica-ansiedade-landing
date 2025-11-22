// /api/check-download.js
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const EBOOK_BUCKET = "ebook_musica_medicina";
const EBOOK_FILE_PATH = "musica-e-ansiedade.pdf";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: "Email obrigatório" });
    return;
  }

  try {
    // pega o pedido mais recente desse e-mail
    const { data, error } = await supabaseAdmin
      .from("ebook_order")
      .select("status, download_allowed")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data || data.status !== "paid" || !data.download_allowed) {
      // ainda não liberado
      res.status(200).json({ allowed: false });
      return;
    }

    // gera URL assinada para o PDF (válida por 1h = 3600s)
    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from(EBOOK_BUCKET)
      .createSignedUrl(EBOOK_FILE_PATH, 60 * 60);

    if (signedErr) throw signedErr;

    res.status(200).json({
      allowed: true,
      downloadUrl: signed.signedUrl,
    });
  } catch (err) {
    console.error("Erro em /api/check-download:", err);
    res.status(500).json({ error: "Erro interno" });
  }
}
