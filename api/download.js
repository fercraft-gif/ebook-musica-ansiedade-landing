// download.js
async function baixarEbook(abrirNovaAba = false) {
  const email = localStorage.getItem("buyer_email");

  if (!email) {
    alert("Não encontrei seus dados. Volte à página de compra.");
    return;
  }

  try {
    const res = await fetch(
      "/api/download?email=" + encodeURIComponent(email)
    );
    const json = await res.json();

    if (!json.url) {
      alert(json.error || "Erro ao validar compra. Tente novamente.");
      return;
    }

    if (abrirNovaAba) {
      window.open(json.url, "_blank");
    } else {
      window.location.href = json.url;
    }
  } catch (e) {
    console.error(e);
    alert("Erro ao tentar liberar o download. Tente novamente.");
  }
}

document
  .getElementById("download-ebook")
  ?.addEventListener("click", () => baixarEbook(false));

document
  .getElementById("open-ebook")
  ?.addEventListener("click", () => baixarEbook(true));