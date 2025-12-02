// /script.js

document.addEventListener('DOMContentLoaded', () => {
  setupModalCheckout();
  setupDownloadFlow();
});

/**
 * CHECKOUT NO MODAL (PIX / CARTÃO)
 */
function setupModalCheckout() {
  const API_CHECKOUT_URL = '/api/create-checkout';
  const MP_CARD_URL = 'https://mpago.la/1qEwwRM'; // fallback cartão
  const PIX_COPY_CODE =
    '00020126670014br.gov.bcb.pix013659669241-d4c7-4964-b437-8ff9ca16e2ab0205venda5204000053039865406129.005802BR5925Fernanda Franzoni Zaguini6008Brasilia62080504mpda6304A395';

  // Botões de abertura do modal
  const payPixBtn = document.getElementById('pay-pix');
  const payPixSecondaryBtn = document.getElementById('pay-pix-secondary');
  const payCardBtn = document.getElementById('pay-card');
  const payCardFinalBtn = document.getElementById('pay-card-final');

  // Modal e campos
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

  // Se a estrutura do modal não existir, não quebra o site
  if (
    !modal ||
    !checkoutForm ||
    !buyerNameInput ||
    !buyerEmailInput ||
    !modalMessage
  ) {
    console.warn(
      'Modal/inputs não encontrados — checkout do modal não será inicializado.'
    );
    return;
  }

  let currentPaymentMethod = null; // 'pix' | 'card'

  function openModal(method) {
    currentPaymentMethod = method;
    modal.classList.remove('hidden');

    // reset visual
    checkoutForm.reset();
    modalMessage.textContent = '';
    if (pixBox) pixBox.classList.add('hidden');
    if (pixCodeDisplay) pixCodeDisplay.textContent = '';
    if (copyPixFeedback) copyPixFeedback.textContent = '';
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // abre modal
  payPixBtn?.addEventListener('click', () => openModal('pix'));
  payPixSecondaryBtn?.addEventListener('click', () => openModal('pix'));
  payCardBtn?.addEventListener('click', () => openModal('card'));
  payCardFinalBtn?.addEventListener('click', () => openModal('card'));
  modalClose?.addEventListener('click', closeModal);

  // fecha clicando fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // SUBMIT DO FORM DO MODAL
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

      let data = null;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error('Resposta da API não era JSON:', jsonError);
      }

      console.log('create-checkout →', res.status, data);

      // salva email SEMPRE (antes de redirect)
      try {
        localStorage.setItem('buyer_email', email);
      } catch {}

      // 👇 AQUI está o alinhamento com o backend:
      if (!res.ok || !data?.initPoint) {
        console.error('Falha em /api/create-checkout:', data);

        if (paymentMethod === 'pix') {
          modalMessage.textContent =
            'Não foi possível abrir o checkout automático. Use o código Pix abaixo:';
          if (pixBox) pixBox.classList.remove('hidden');
          if (pixCodeDisplay) pixCodeDisplay.textContent = PIX_COPY_CODE;
        } else {
          modalMessage.textContent =
            'Não foi possível abrir o checkout automático. Vou te levar para o pagamento seguro.';
          window.location.href = MP_CARD_URL;
        }
        return;
      }

      // SUCESSO → redireciona para o Checkout Pro do Mercado Pago
      window.location.href = data.initPoint;
    } catch (err) {
      console.error('Erro de rede em /api/create-checkout:', err);

      if (paymentMethod === 'pix') {
        modalMessage.textContent =
          'Erro no checkout automático. Use o código Pix abaixo:';
        if (pixBox) pixBox.classList.remove('hidden');
        if (pixCodeDisplay) pixCodeDisplay.textContent = PIX_COPY_CODE;
      } else {
        modalMessage.textContent =
          'Erro no checkout automático. Vou te levar para o pagamento seguro.';
        window.location.href = MP_CARD_URL;
      }
    }
  });

  // COPIAR PIX
  copyPixBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(PIX_COPY_CODE);
      if (copyPixFeedback) {
        copyPixFeedback.textContent =
          'Código Pix copiado! Agora é só colar no app do seu banco.';
      }
    } catch (e) {
      console.error('Erro ao copiar PIX:', e);
      if (copyPixFeedback) {
        copyPixFeedback.textContent =
          'Não foi possível copiar automaticamente. Copie manualmente, por favor.';
      }
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

      console.log('check-download →', checkResp.status, checkData);

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
