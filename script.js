// script.js — usado apenas na página obrigado.html

document.addEventListener("DOMContentLoaded", () => {
  const downloadBtn = document.getElementById("download-btn");
  if (!downloadBtn) return;

  downloadBtn.addEventListener("click", () => {
    // inicia o download do PDF
    window.location.href = "musica-e-ansiedade.pdf.pdf"; 
    // se você mudar o nome/posição do arquivo, ajuste o caminho aqui
  });
});