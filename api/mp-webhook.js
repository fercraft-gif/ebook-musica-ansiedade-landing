// api/mp-webhook.js
import mercadopago from 'mercadopago';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { sendDownloadEmail } from '../lib/sendDownloadEmail.js';

const BUCKET = 'ebook_musica_medicina';
const FILE_PATH = 'musica-e-ansiedade.pdf';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const { type, data } = req.body;

    if (type !== 'payment' || !data?.id) {
      console.log('Webhook ignorado', req.body);
      return res.status(200).send('IGNORED');
    }

    const paymentId = data.id;

    const payment = await mercadopago.payment.findById(paymentId);
    const status = payment.body.status;
    const externalRef = payment.body.external_reference; // id da ebook_order

    if (status !== 'approved') {
      console.log('Pagamento ainda não aprovado:', paymentId, status);
      return res.status(200).send('NOT_APPROVED');
    }

    // 1) Atualiza pedido no Supabase
    const { error: updateError } = await supabaseAdmin
      .from('ebook_order')
      .update({
        status: 'approved',
        rastreamento_id: String(paymentId),
        download_allowed: true,
      })
      .eq('id', externalRef);

    if (updateError) {
      console.error('Erro update Supabase no webhook', updateError);
      return res.status(200).send('UPDATE_ERROR');
    }

    // 2) Busca dados do pedido (nome + e-mail)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('ebook_order')
      .select('name, email')
      .eq('id', externalRef)
      .maybeSingle();

    if (orderError) {
      console.error('Erro buscando pedido para e-mail', orderError);
    } else if (order?.email) {
      // 3) Gera URL assinada (ex.: válida por 24h para o e-mail)
      const { data: signed, error: signedError } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(FILE_PATH, 60 * 60 * 24);

      if (signedError) {
        console.error('Erro ao criar URL assinada para e-mail', signedError);
      } else {
        await sendDownloadEmail({
          to: order.email,
          name: order.name,
          downloadUrl: signed.signedUrl,
        });
      }
    }

    console.log('Pedido aprovado e liberado:', externalRef);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Erro no webhook', err);
    return res.status(200).send('ERROR');
  }
}