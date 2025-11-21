// api/mp-webhook.js
import { createClient } from "@supabase/supabase-js";

// CLIENTE ADMIN (SERVICE ROLE) — SÓ NO SERVIDOR
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const type = body.type;
    const data = body.data || {};

    // Ignora notificações que não são de pagamento
    if (type !== "payment" || !data.id) {
      return res.status(200).json({ ignored: true });
    }

    const paymentId = String(data.id);

    // 1. Buscar detalhes reais no Mercado Pago
    const mpRes = await fetch(
       `https://api.mercadopago.com/v1/payments/${paymentId}`,
       {
      headers: {
         Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
     }
  );

     const payment = await mpRes.json();

     // 2. Só continua se estiver aprovado
    if (payment.status !== "approved") {
      return res.status(200).json({ status: payment.status });
    }

    // 3. Garantir e-mail do pagador
    const payerEmail = payment?.payer?.email;

    if (!payerEmail) {
      console.error("Pagamento aprovado SEM e-mail. ID:", paymentId);
      return res
        // api/mp-webhook.js
        import mercadopago from 'mercadopago';
        import { supabaseAdmin } from '../lib/supabaseAdmin.js';

        mercadopago.configure({
          access_token: process.env.MP_ACCESS_TOKEN,
        });

        export default async function handler(req, res) {
          // MP pode bater com GET em testes → responde OK
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

            // 1) Busca o pagamento no MP
            const payment = await mercadopago.payment.findById(paymentId);

            const status = payment.body.status; // 'approved', 'pending', etc.
            const externalRef = payment.body.external_reference; // id da ebook_order

            if (status !== 'approved') {
              console.log('Pagamento ainda não aprovado:', paymentId, status);
              return res.status(200).send('NOT_APPROVED');
            }

            // 2) Atualiza pedido no Supabase
            const { error: updateError } = await supabaseAdmin
              .from('ebook_order')
              .update({
                status: 'approved',           // precisa existir no enum status_pedido
                rastreamento_id: String(paymentId),
                download_allowed: true,
              })
              .eq('id', externalRef);

            if (updateError) {
              console.error('Erro update Supabase no webhook', updateError);
              return res.status(200).send('UPDATE_ERROR');
            }

            console.log('Pedido aprovado e liberado:', externalRef);
            return res.status(200).send('OK');
          } catch (err) {
            console.error('Erro no webhook', err);
            // devolve 200 mesmo com erro para o MP não ficar rebatendo infinito
            return res.status(200).send('ERROR');
          }
        }