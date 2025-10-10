// app/sidebar.js - VERSÃO COMPLETA E FINAL

import { apiChangePassword } from './api.js';

// --- Funções Auxiliares ---

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
}

function exibirInfoUsuario() {
    const infoUsuarioUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    if (!infoUsuarioUI || !token) return;

    const decoded = parseJwt(token);
    if (decoded) {
        const nome = decoded.nome || 'Utilizador';
        const depto = decoded.departamento || 'N/D';
        const deptoColors = {
            'TI': { icon: '#3498db', bg: '#eaf4fc', text: '#2980b9' },
            'GAS': { icon: '#27ae60', bg: '#e9f7ef', text: '#229954' },
            'default': { icon: '#8e8e8e', bg: '#f0f0f0', text: '#5e5e5e' }
        };
        const colors = deptoColors[depto.toUpperCase()] || deptoColors['default'];
        infoUsuarioUI.innerHTML = `<span><i class="fas fa-user-circle" style="color: ${colors.icon};"></i> Olá, <strong style="background-color: ${colors.bg}; color: ${colors.text};">${nome}</strong> (${depto})</span>`;
    }
}

function abrirModalSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) modal.classList.add('visible');
}

function fecharModalSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) modal.classList.remove('visible');
}

// Função principal que organiza toda a lógica da barra lateral
function inicializarSidebar() {
    // Lógica para o botão de expandir/colapsar (hamburguer)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // Lógica para abrir/fechar o submenu "Associações"
    document.querySelectorAll('.has-submenu > a').forEach(menu => {
        menu.addEventListener('click', function (e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });

    // Lógica para o botão de logout
    const btnLogout = document.getElementById('btn-logout-sidebar');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }

    // Lógica para o botão de mudar senha
    const btnMudarSenha = document.getElementById('btn-mudar-senha-sidebar');
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener('click', abrirModalSenha);
    }
    
    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if (btnSenhaCancelar) {
        btnSenhaCancelar.addEventListener('click', fecharModalSenha);
    }

    // --- CÓDIGO NOVO ADICIONADO ---
    // Lógica para ABRIR o novo modal de exportação
    const btnAbrirModalExportar = document.getElementById('btn-abrir-modal-exportar');
    if (btnAbrirModalExportar) {
        btnAbrirModalExportar.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('modal-exportar');
            if (modal) modal.classList.add('visible');
        });
    }

    // Lógica para FECHAR o novo modal de exportação (botão "Cancelar")
    const btnFecharModalExportar = document.getElementById('btn-fechar-modal-exportar');
    if (btnFecharModalExportar) {
        btnFecharModalExportar.addEventListener('click', () => {
            const modal = document.getElementById('modal-exportar');
            if (modal) modal.classList.remove('visible');
        });
    }
}
document.addEventListener('DOMContentLoaded', inicializarSidebar);