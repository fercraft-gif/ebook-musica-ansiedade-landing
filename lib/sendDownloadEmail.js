// lib/sendDownloadEmail.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDownloadEmail({ to, name, downloadUrl }) {
  if (!to || !downloadUrl) return;

  const safeName = name || 'Olá';

  try {
    await resend.emails.send({
      from: 'Octopus Axis <no-reply@octopusaxis.com>', // ajuste o domínio
      to,
      subject: 'Seu e-book Música & Ansiedade está liberado',
      html: `
        <p>Olá, ${safeName},</p>

        <p>
        Obrigada por adquirir o e-book <strong>Música &amp; Ansiedade</strong>.
        Seu pagamento foi confirmado e o acesso já está liberado.
        </p>

        <p>Clique no botão abaixo para baixar o PDF com segurança:</p>

        <p>
          <a href="${downloadUrl}"
             style="display:inline-block;
                    padding:12px 20px;
                    background:#10b981;
                    color:#ffffff;
                    border-radius:8px;
                    text-decoration:none;
                    font-weight:600;">
            Baixar e-book Música &amp; Ansiedade
          </a>
        </p>

        <p style="font-size:14px;color:#6b7280;">
          Se o botão não funcionar, copie e cole este link no seu navegador:<br />
          <span style="word-break:break-all;">${downloadUrl}</span>
        </p>

        <p>
        Guarde este e-mail — você pode usá-lo sempre que quiser baixar o arquivo novamente.
        </p>

        <p>
        Com carinho,<br />
        <strong>Fernanda Franzoni Zaguini</strong><br />
        Série Música &amp; Medicina · Octopus Axis
        </p>
      `,
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail de download', err);
  }
}
