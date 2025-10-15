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
  const token = localStorage.getItem('authToken');
    if (token) {
        const decoded = parseJwt(token);
        if (decoded && decoded.permissao === 'admin') {
            const navAdmin = document.getElementById('nav-admin');
            if (navAdmin) {
                navAdmin.style.display = 'block';
            }
        }
    }


      const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });


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
    // 1. Insere dinamicamente o HTML do menu lateral
    const sidebarElement = document.querySelector('.sidebar');
    if (sidebarElement) {
        sidebarElement.innerHTML = `
            <div class="sidebar-header">
                <h2>AMEP ATIVOS</h2>
            </div>
            <ul class="sidebar-nav">
                <li><a href="dashboard.html"><i class="fas fa-chart-pie"></i> <span class="nav-text">Dashboard</span></a></li>
                <li><a href="index.html"><i class="fas fa-tasks"></i> <span class="nav-text">Inventário</span></a></li>
                <li class="has-submenu">
                    <a href="#"><i class="fas fa-clipboard-list"></i> <span class="nav-text">Associações</span> <i class="fas fa-chevron-down submenu-arrow"></i></a>
                    <ul class="submenu">
                        <li><a href="lista.html"><span class="nav-text">Máquinas</span></a></li>
                        <li><a href="lista_mobiliario.html"><span class="nav-text">Mobiliário</span></a></li>
                    </ul>
                </li>
                <!-- Link do Painel de Admin, escondido por padrão -->
                <li id="nav-admin" style="display: none;"><a href="usuarios.html"><i class="fas fa-user-shield"></i> <span class="nav-text">Admin</span></a></li>
            </ul>
            <ul class="sidebar-actions">
                 <li><a href="#" id="btn-mudar-senha-sidebar"><i class="fas fa-key"></i> <span class="nav-text">Mudar Senha</span></a></li>
                 <li><a href="#" id="btn-logout-sidebar"><i class="fas fa-sign-out-alt"></i> <span class="nav-text">Sair</span></a></li>
            </ul>
        `;
    }

    // 2. Lógica para o botão de expandir/colapsar (hamburguer)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content');
    if (sidebarToggle && sidebarElement && mainContent) {
        sidebarToggle.addEventListener('click', () => {
            sidebarElement.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // 3. Lógica para abrir/fechar o submenu "Associações"
    document.querySelectorAll('.has-submenu > a').forEach(menu => {
        menu.addEventListener('click', function (e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });

    // 4. Lógica para os botões de ação (Logout, Mudar Senha)
    document.getElementById('btn-logout-sidebar')?.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });
    
    document.getElementById('btn-mudar-senha-sidebar')?.addEventListener('click', abrirModalSenha);

    // 5. LÓGICA DE EXIBIÇÃO DO LINK DE ADMIN
    const token = localStorage.getItem('authToken');
    if (token) {
        const decoded = parseJwt(token);
        // Verifica se o usuário tem a permissão 'admin'
        if (decoded && decoded.permissao === 'admin') {
            const navAdmin = document.getElementById('nav-admin');
            if (navAdmin) {
                // Se for admin, torna o link visível
                navAdmin.style.display = 'block';
            }
        }
    }

    // 6. Marca o link da página atual como 'ativo'
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-nav a, .submenu a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', inicializarSidebar);