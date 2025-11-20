// mp-webhook.js
// Endpoint para receber notificações do Mercado Pago

module.exports = async function (req, res) {
  // Exemplo: logar o corpo recebido
  console.log('Webhook recebido:', req.body);

  // TODO: Adicione lógica para processar notificações do Mercado Pago

  res.status(200).send('Webhook recebido com sucesso');
};
