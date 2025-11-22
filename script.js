// /script.js

document.addEventListener('DOMContentLoaded', () => {
  setupModalCheckout();
  setupDownloadFlow();
});

/**
 * CHECKOUT NO MODAL (PIX / CARTÃO)
 */
function setupModalCheckout() {
  // URLs principais
  const API_CHECKOUT_URL = '/api/create-checkout';
  const MP_CARD_URL = 'https://mpago.la/1qEwwRM'; // fallback cartão
  const PIX_COPY_CODE =
    '00020126670014br.gov.bcb.pix013659669241-d4c7-4964-b437-8ff9ca16e2ab0205venda5204000053039865406129.005802BR5925Fernanda Franzoni Zaguini6008Brasilia62080504mpda6304A395';

  // ELEMENTOS
  const payPixBtn = document.getElementById('pay-pix');
  const payPixSecondaryBtn = document.getElementById('pay-pix-secondary');
  const payCardBtn = document.getElementById('pay-card');
  const payCardFinalBtn = document.getElementById('pay-card-final');

  const modal = document.getElementById('checkout-modal');
  const modalClose = document.getElementById('modal-close');
  const checkoutForm = document.getElementById('checkout-form');

  const buyerNameInput = document.getElementById('buyer-name');
  const buyerEmailInput = document.getElementById('buyer-email');
  const modalMessage = document.getElementById('modal-message');

  const pixBox = document.getElementById('pix-box');
  const pixCodeDisplay = document.getElementById('pix-code-display');
  const copyPixBtn = document.getElementById('copy-pix-code');
  const copyPixFeedback = document.getElementById('copy-pix-feedback');

  if (!modal || !checkoutForm || !buyerNameInput || !buyerEmailInput) {
    console.warn('Modal de checkout não encontrado na página.');
    return;
  }

  let currentPaymentMethod = null;

  function openModal(method) {
    currentPaymentMethod = method; // 'pix' ou 'card'
    modal.classList.remove('hidden');
    pixBox.classList.add('hidden');
    pixCodeDisplay.textContent = '';
    copyPixFeedback.textContent = '';
    modalMessage.textContent = '';
    checkoutForm.reset();
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // Botões → abre modal
  payPixBtn?.addEventListener('click', () => openModal('pix'));
  payPixSecondaryBtn?.addEventListener('click', () => openModal('pix'));
  payCardBtn?.addEventListener('click', () => openModal('card'));
  payCardFinalBtn?.addEventListener('click', () => openModal('card'));
  modalClose?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Envio do formulário → cria checkout via API
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = buyerNameInput.value.trim();
    const email = buyerEmailInput.value.trim();
    const paymentMethod = currentPaymentMethod;

    if (!name || !email) {
      modalMessage.textContent = 'Preencha nome e e-mail para continuar.';
      return;
    }

    if (!paymentMethod) {
      modalMessage.textContent = 'Escolha primeiro uma forma de pagamento.';
      return;
    }

    modalMessage.textContent = 'Registrando seus dados...';

    try {
      const res = await fetch(API_CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, paymentMethod }),
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error('Resposta não era JSON:', jsonError);
        data = null;
      }

      // guarda e-mail no navegador para páginas futuras (obrigado/download)
      try {
        localStorage.setItem('buyer_email', email);
      } catch {}

      if (!res.ok || !data || !data.checkoutUrl) {
        console.error('Falha em /api/create-checkout:', data);

        // fallback se a API falhar
        if (paymentMethod === 'pix') {
          modalMessage.textContent =
            'Não foi possível abrir o checkout automático. Use o código Pix abaixo:';
          pixBox.classList.remove('hidden');
          pixCodeDisplay.textContent = PIX_COPY_CODE;
        } else {
          modalMessage.textContent =
            'Não foi possível abrir o checkout automático. Vou te levar para o pagamento seguro.';
          window.location.href = MP_CARD_URL;
        }
        return;
      }

      // Sucesso → Redireciona para o checkout do Mercado Pago
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Erro de rede em /api/create-checkout:', err);

      if (currentPaymentMethod === 'pix') {
        modalMessage.textContent =
          'Erro no checkout automático. Use o código Pix abaixo:';
        pixBox.classList.remove('hidden');
        pixCodeDisplay.textContent = PIX_COPY_CODE;
      } else {
        modalMessage.textContent =
          'Erro no checkout automático. Vou te levar para o pagamento seguro.';
        window.location.href = MP_CARD_URL;
      }
    }
  });

  // Copiar PIX
  copyPixBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(PIX_COPY_CODE);
      copyPixFeedback.textContent =
        'Código Pix copiado! Agora é só colar no app do seu banco.';
    } catch {
      copyPixFeedback.textContent =
        'Não foi possível copiar automaticamente. Copie manualmente, por favor.';
    }
  });
}

/**
 * FLUXO DE DOWNLOAD (APÓS PAGAMENTO)
 */
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
