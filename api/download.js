// download.js — usado apenas na página download.html

document.addEventListener("DOMContentLoaded", () => {
  const downloadBtn = document.getElementById("download-btn");
  const messageEl = document.getElementById("download-message");

  if (!downloadBtn) return;

  downloadBtn.addEventListener("click", async () => {
    if (messageEl) {
      messageEl.textContent = "Verificando seu pagamento...";
    }

    let email = null;
    try {
      email = localStorage.getItem("buyer_email");
    } catch {}

    if (!email) {
      if (messageEl) {
        messageEl.textContent =
          "Não encontrei seu e-mail. Volte para a página de compra ou escreva para Mmt.fernandazaguini@gmail.com com o comprovante.";
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

      if (!res.ok) {
        throw new Error(data.error || "Erro ao verificar download");
      }

      if (!data.allowed) {
        if (messageEl) {
          messageEl.textContent =
            "Seu pagamento ainda não foi confirmado pelo sistema. Aguarde alguns minutos e recarregue esta página.";
        }
        return;
      }

      if (messageEl) {
        messageEl.textContent = "Iniciando download...";
      }

      // URL assinada vinda da API (Supabase Storage)
      window.location.href = data.downloadUrl;
    } catch (err) {
      console.error(err);
      if (messageEl) {
        messageEl.textContent =
          "Não foi possível liberar o download agora. Tente novamente em alguns instantes.";
      }
    }
  });
});
