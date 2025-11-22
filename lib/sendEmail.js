// lib/sendEmail.js
// Função genérica para enviar e-mail sem SDK
// Usa SMTP via nodemailer

import nodemailer from 'nodemailer';

/**
 * Envia um e-mail genérico usando SMTP
 * @param {Object} options
 * @param {string} options.to - E-mail de destino
 * @param {string} options.subject - Assunto do e-mail
 * @param {string} options.text - Corpo do e-mail (texto)
 * @param {string} [options.html] - Corpo do e-mail (HTML)
 * @returns {Promise<Object>} - Resultado do envio
 */
export async function sendEmail({ to, subject, text, html }) {
  // Configure o transporter com suas credenciais SMTP
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true para 465, false para outros
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, info };
  } catch (error) {
    return { success: false, error };
  }
}
