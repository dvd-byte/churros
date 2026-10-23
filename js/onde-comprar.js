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
    let horarios = location.protocol === 'file:'
        ? Array.from({length:7}, (_,i) => ({dia:i+1, fechado:i===6, abertura:'10:00:00', fechamento:'22:40:00'})) : null;

    function atualizarFuncionamento() {
        if (!horarios) {
            indicador.dataset.estado = 'indisponivel';
            indicador.textContent = 'Horário temporariamente indisponível';
            return;
        }
        const partes = Object.fromEntries(horarioLocal.formatToParts(new Date())
            .map(parte => [parte.type, parte.value]));
        const agora = `${partes.hour}:${partes.minute}:00`;
        const dia = {Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[partes.weekday];
        const h = horarios.find(item => item.dia === dia);
        if (!h) {
            indicador.dataset.estado = 'indisponivel';
            indicador.textContent = 'Horário de hoje não informado';
            return;
        }
        const aberto = h && !h.fechado && agora >= h.abertura && agora < h.fechamento;
        const estado = aberto ? "aberto" : "fechado";
        if (indicador.dataset.estado === estado) return;
        indicador.dataset.estado = estado;
        indicador.textContent = aberto ? "Aberto" : "Fechado";
    }

    atualizarFuncionamento();
    window.addEventListener('loja:atualizada', evento => {
        horarios = evento.detail.horarios;
        atualizarFuncionamento();
    });
    window.addEventListener('loja:indisponivel', () => { horarios = null; atualizarFuncionamento(); });
    window.setInterval(atualizarFuncionamento, 1000);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) atualizarFuncionamento();
    });
})();
