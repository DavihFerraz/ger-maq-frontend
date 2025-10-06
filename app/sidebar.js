// Importa a função da API para mudar a senha
import { apiChangePassword } from './api.js';

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
        alert(response.message); // Confirmação simples
        fecharModalSenha();
        form.reset();
    } catch (error) {
        alert("Erro: " + error.message);
    }
}

// --- Função Principal de Inicialização da Sidebar ---

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

    // Lógica para ABRIR/FECHAR o submenu
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

    // Lógica para o botão e modal de mudar senha
    const btnMudarSenha = document.getElementById('btn-mudar-senha-sidebar');
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