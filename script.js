document.addEventListener("DOMContentLoaded", () => {
  const downloadBtn = document.getElementById("download-btn");
  const messageEl = document.getElementById("download-message"); // opcional, um <p id="download-message">

  if (!downloadBtn) return;

  downloadBtn.addEventListener("click", async () => {
    if (messageEl) messageEl.textContent = "Verificando seu pagamento...";

    let email = null;
    try {
      email = localStorage.getItem("buyer_email");
    } catch {}

    if (!email) {
      if (messageEl) {
        messageEl.textContent =
          "Não encontrei seu e-mail. Volte para a página de compra e tente novamente.";
      }
      return;
    }

    try {
      const res = await fetch("/api/check-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.allowed) {
        if (messageEl) {
          messageEl.textContent =
            "Seu pagamento ainda não foi confirmado. Aguarde alguns minutos e recarregue a página.";
        }
        return;
      }

      // se a API devolveu uma URL assinada do Supabase:
      const downloadUrl =
        data.downloadUrl || "/downloads/musica-e-ansiedade.pdf";

      if (messageEl) messageEl.textContent = "Iniciando download...";
      window.location.href = downloadUrl;
    } catch (err) {
      console.error(err);
      if (messageEl) {
        messageEl.textContent =
          "Ocorreu um erro ao liberar o download. Tente novamente em instantes.";
      }
    }
  });
});