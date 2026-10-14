/* Horário regular da loja. Não consulta o iFood nem considera feriados/exceções.
 * Usa o relógio do dispositivo, convertido para o fuso de São Paulo.
 */
"use strict";
(() => {
    const indicador = document.getElementById("statusFuncionamento");
    if (!indicador) return;

    const horarioLocal = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    });
    const abertura = 10 * 60;
    const fechamento = 22 * 60 + 40;

    function atualizarFuncionamento() {
        const partes = Object.fromEntries(horarioLocal.formatToParts(new Date())
            .map(parte => [parte.type, parte.value]));
        const minutos = Number(partes.hour) * 60 + Number(partes.minute);
        // Às 10h abre; a partir das 22h40 fecha. Domingo permanece fechado.
        const aberto = partes.weekday !== "Sun" && minutos >= abertura && minutos < fechamento;
        const estado = aberto ? "aberto" : "fechado";
        if (indicador.dataset.estado === estado) return;
        indicador.dataset.estado = estado;
        indicador.textContent = aberto ? "Aberto" : "Fechado";
    }

    atualizarFuncionamento();
    window.setInterval(atualizarFuncionamento, 1000);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) atualizarFuncionamento();
    });
})();
