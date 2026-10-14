/* Menu compartilhado da página inicial, Blog e Cardápio. */
"use strict";
document.body.classList.add("js");

const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");
if (menuToggle && navMenu) {
    const fecharMenu = () => {
        navMenu.classList.remove("menuAberto");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Abrir menu");
    };
    menuToggle.addEventListener("click", () => {
        const aberto = navMenu.classList.toggle("menuAberto");
        menuToggle.setAttribute("aria-expanded", String(aberto));
        menuToggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    });
    navMenu.addEventListener("click", (evento) => {
        if (evento.target.closest("a")) fecharMenu();
    });
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && navMenu.classList.contains("menuAberto")) {
            fecharMenu();
            menuToggle.focus();
        }
    });
    document.addEventListener("click", (evento) => {
        if (!evento.target.closest("nav")) fecharMenu();
    });
    window.matchMedia("(max-width: 1150px)").addEventListener("change", fecharMenu);
}

