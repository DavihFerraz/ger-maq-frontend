// Importa a função da API para mudar a senha
import { apiChangePassword } from './api.js';

// --- Funções de Autenticação e UI ---
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function exibirInfoUsuario() {
    const infoUsuarioUI = document.getElementById('info-usuario');
    const token = localStorage.getItem('authToken');
    if (!infoUsuarioUI || !token) return;

    const decoded = parseJwt(token);
    if (decoded) {
        const nome = decoded.nome || 'Usuário';
        const depto = decoded.departamento || 'N/D';
        infoUsuarioUI.innerHTML = `<span>Olá, <strong>${nome}</strong> (${depto})</span>`;
    }
}


// --- Funções do Modal de Senha ---
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

// --- Função Principal de Inicialização da Sidebar ---
function inicializarSidebar() {
    // Exibe as informações do usuário logado
    exibirInfoUsuario();

    // Lógica para o botão de expandir/colapsar (hamburguer)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // Lógica para ABRIR/FECHAR o submenu
    document.querySelectorAll('.has-submenu > a').forEach(menu => {
        menu.addEventListener('click', function (e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });

    // Lógica para o botão de logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }

    // Lógica para o botão e modal de mudar senha
    const btnMudarSenha = document.getElementById('btn-mudar-senha');
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener('click', abrirModalSenha);
    }
    
    const formMudarSenha = document.getElementById('form-mudar-senha');
    if (formMudarSenha) {
        formMudarSenha.addEventListener('submit', mudarSenha);
    }

    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if (btnSenhaCancelar) {
        btnSenhaCancelar.addEventListener('click', fecharModalSenha);
    }
}

// Inicializa a sidebar quando a página carregar
document.addEventListener('DOMContentLoaded', inicializarSidebar);