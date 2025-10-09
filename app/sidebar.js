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

async function mudarSenha(event) {
    event.preventDefault();
    const form = event.target;
    const senhaAtual = form.querySelector('#senha-atual').value;
    const novaSenha = form.querySelector('#nova-senha').value;
    
    try {
        const response = await apiChangePassword(senhaAtual, novaSenha);
        Toastify({ text: response.message || "Senha alterada com sucesso!" }).showToast();
        fecharModalSenha();
        form.reset();
    } catch (error) {
        Toastify({ text: "Erro: " + error.message, backgroundColor: "red" }).showToast();
    }
}

// --- Função Principal de Inicialização ---

function inicializarSidebar() {
    exibirInfoUsuario();

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (sidebarToggle && sidebar && mainContent) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded'); // A linha que empurra o conteúdo
        });
    }

    document.querySelectorAll('.has-submenu > a').forEach(menu => {
        menu.addEventListener('click', function (e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });
    
    const btnLogout = document.getElementById('btn-logout-sidebar');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }

    const btnMudarSenha = document.getElementById('btn-mudar-senha-sidebar');
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener('click', abrirModalSenha);
    }
    
    const formMudarSenha = document.getElementById('form-mudar-senha');
    if (formMudarSenha) formMudarSenha.addEventListener('submit', mudarSenha);

    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if (btnSenhaCancelar) btnSenhaCancelar.addEventListener('click', fecharModalSenha);
}

document.addEventListener('DOMContentLoaded', inicializarSidebar);