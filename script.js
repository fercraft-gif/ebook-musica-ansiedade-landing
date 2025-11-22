// /script.js
document.addEventListener('DOMContentLoaded', () => {
  setupCheckoutForm();
  setupDownloadFlow();
});

function setupCheckoutForm() {
  const form = document.querySelector('#checkout-form');
  const statusEl = document.querySelector('[data-checkout-status]');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (statusEl) statusEl.textContent = 'Processando pedido...';

    const formData = new FormData(form);
    const name = (formData.get('name') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const paymentMethod = formData.get('payment_method'); // 'pix' ou 'card'

    if (!name || !email || !paymentMethod) {
      if (statusEl) statusEl.textContent = 'Preencha todos os campos.';
      return;
    }

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Erro no create-checkout:', data);
        if (statusEl) {
          statusEl.textContent =
            data?.error || 'Não foi possível criar o checkout.';
        }
        return;
      }

      if (!data.checkoutUrl) {
        if (statusEl) {
          statusEl.textContent =
            'Erro inesperado: checkoutUrl não retornado pela API.';
        }
        return;
      }

      // Redireciona para o checkout do Mercado Pago
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Erro inesperado ao criar checkout:', err);
      if (statusEl) {
        statusEl.textContent = 'Erro de conexão. Tente novamente.';
      }
    }
  });
}

function setupDownloadFlow() {
  const emailInput = document.querySelector('#download-email');
  const button = document.querySelector('[data-download-btn]');
  const statusEl = document.querySelector('[data-download-status]');

  if (!emailInput || !button) return;

  button.addEventListener('click', async () => {
    const email = emailInput.value.trim();

    if (!email) {
      if (statusEl) statusEl.textContent = 'Informe o e-mail da compra.';
      return;
    }

    try {
      if (statusEl) statusEl.textContent = 'Verificando permissão...';

      const checkResp = await fetch(
        '/api/check-download?email=' + encodeURIComponent(email)
      );
      const checkData = await checkResp.json();

      if (!checkResp.ok) {
        if (statusEl) {
          statusEl.textContent =
            checkData?.error || 'Erro ao verificar o pedido.';
        }
        return;
      }

      if (!checkData.allowed) {
        if (statusEl) {
          statusEl.textContent =
            'Ainda não encontramos um pagamento aprovado para este e-mail.';
        }
        return;
      }

      if (statusEl) statusEl.textContent = 'Liberando download...';

      // Chama rota que redireciona pro PDF
      window.location.href =
        '/api/download?email=' + encodeURIComponent(email);
    } catch (err) {
      console.error('Erro ao verificar/baixar e-book:', err);
      if (statusEl) {
        statusEl.textContent = 'Erro de conexão. Tente novamente.';
      }
    }
  });
}
