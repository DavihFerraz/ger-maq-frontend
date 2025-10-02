// app/sidebar.js - VERSÃO FINAL

// Função para controlar o modal de senha
function abrirModalSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) modal.classList.add('visible');
}

function fecharModalSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) modal.classList.remove('visible');
}

// Função principal que inicializa toda a barra lateral
function inicializarSidebar() {
    // Lógica para o botão de expandir/colapsar a sidebar (hamburguer)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // Lógica para ABRIR/FECHAR o submenu ao clicar no item pai ("Associações")
    document.querySelectorAll('.has-submenu > a').forEach(menu => {
        menu.addEventListener('click', function (e) {
            e.preventDefault(); // Impede a navegação para '#'
            e.stopPropagation(); // Impede que o clique se propague para elementos pais
            
            const parentLi = this.parentElement;
            
            // Fecha outros submenus que possam estar abertos
            if (!parentLi.classList.contains('open')) {
                document.querySelectorAll('.has-submenu.open').forEach(openMenu => {
                    openMenu.classList.remove('open');
                });
            }
            
            // Abre ou fecha o submenu atual
            parentLi.classList.toggle('open');
        });
    });

    // Lógica para manter o submenu aberto se a página atual for um de seus filhos
    const currentPage = window.location.pathname;
    document.querySelectorAll('.submenu a').forEach(link => {
        if (currentPage.includes(link.getAttribute('href'))) {
            const parentLi = link.closest('.has-submenu');
            if (parentLi) {
                parentLi.classList.add('open');
            }
        }
    });

    // Lógica para o botão de logout
    const btnLogout = document.getElementById('btn-logout-sidebar');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }

    // Lógica para o botão de mudar senha (agora usa a função local)
    const btnMudarSenha = document.getElementById('btn-mudar-senha-sidebar');
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener('click', abrirModalSenha);
    }
    
    // Listeners para o formulário do modal de senha
    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if (btnSenhaCancelar) {
        btnSenhaCancelar.addEventListener('click', fecharModalSenha);
    }
}

// Garante que a inicialização ocorra após o carregamento completo da página
document.addEventListener('DOMContentLoaded', inicializarSidebar);