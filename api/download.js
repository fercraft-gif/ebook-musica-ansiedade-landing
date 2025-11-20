// download.js

// Função que chama a API /api/download e redireciona para o PDF assinado
async function baixarEbook(abrirNovaAba = false) {
  const email = localStorage.getItem("buyer_email");

  if (!email) {
    alert("Não encontrei seus dados. Volte à página de compra e finalize por lá.");
    return;
  }

  try {
    const res = await fetch(
      "/api/download?email=" + encodeURIComponent(email)
    );

    const json = await res.json();

    if (!json.url) {
      alert(json.error || "Erro ao validar compra. Tente novamente em alguns minutos.");
      return;
    }

    // Se tiver URL assinada, faz o download
    if (abrirNovaAba) {
      window.open(json.url, "_blank");
    } else {
      window.location.href = json.url;
    }
  } catch (e) {
    console.error(e);
    alert("Erro ao tentar liberar o download. Tente novamente em alguns minutos.");
  }
}

// Liga os botões da página de obrigado
document
  .getElementById("download-ebook")
  ?.addEventListener("click", () => baixarEbook(false));

document
  .getElementById("open-ebook")
  ?.addEventListener("click", () => baixarEbook(true));