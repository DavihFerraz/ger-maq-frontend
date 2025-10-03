import { getItens, getEmprestimos, devolverEmprestimo, apiChangePassword } from './api.js';

// --- ESTADO LOCAL DA APLICAÇÃO ---
let todoEstoque = [];
let todasAssociacoes = [];
let todasAssociacoesMobiliario = [];

// --- FUNÇÕES DE LÓGICA E AUTENTICAÇÃO ---
function parseJwt(token) { try { const u=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(atob(u).split('').map(c=>'%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))); } catch (e) { return null; } }

function exibirInfoUtilizador() {
    const infoUtilizadorUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    if (infoUtilizadorUI && token) {
        const d = parseJwt(token);
        if (d) {
            const n=d.nome||'Utilizador', t=d.departamento||'N/D', c={'TI':{icon:'#3498db',bg:'#eaf4fc',text:'#2980b9'},'GAS':{icon:'#27ae60',bg:'#e9f7ef',text:'#229954'},'default':{icon:'#8e8e8e',bg:'#f0f0f0',text:'#5e5e5e'}}, o=c[t.toUpperCase()]||c['default'];
            infoUtilizadorUI.innerHTML = `<span><i class="fas fa-user-circle" style="color: ${o.icon};"></i> Olá, <strong style="background-color: ${o.bg}; color: ${o.text};">${n}</strong> (${t})</span>`;
        }
    }
}

async function carregarDados() {
    exibirInfoUtilizador();
    try {
        const [itens, todosOsEmprestimos] = await Promise.all([getItens(), getEmprestimos()]);
        todoEstoque = itens;
        const emprestimosAtivos = todosOsEmprestimos.filter(e => !e.data_devolucao);
        todasAssociacoes = emprestimosAtivos.filter(e => { const i = todoEstoque.find(t => t.id == e.item_id); return i && i.categoria === 'COMPUTADOR'; });
        todasAssociacoesMobiliario = emprestimosAtivos.filter(e => { const i = todoEstoque.find(t => t.id == e.item_id); return i && i.categoria === 'MOBILIARIO'; });
        
        if (document.getElementById('lista-associacoes')) {
            renderizarListaAssociada('maquina');
            popularFiltroDepartamentos(todasAssociacoes);
        }
        if (document.getElementById('lista-associacoes-mobiliario')) {
            renderizarListaAssociada('mobiliario');
            popularFiltroDepartamentos(todasAssociacoesMobiliario);
        }
    } catch (error) { console.error("Erro ao carregar dados da API:", error); }
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function renderizarListaAssociada(tipo) {
    // 1. Define as variáveis corretas com base no 'tipo' (maquina ou mobiliario)
    const ehMaquina = tipo === 'maquina';
    const listaUI = document.getElementById(ehMaquina ? 'lista-associacoes' : 'lista-associacoes-mobiliario');
    const associacoesSource = ehMaquina ? todasAssociacoes : todasAssociacoesMobiliario;

    if (!listaUI) return;

    // 2. Obtém os valores dos filtros
    const termoBusca = document.getElementById('campo-busca').value.toLowerCase();
    const filtroDepto = document.getElementById('filtro-departamento').value;

    // Adicionado para depuração:
    console.log(`Renderizando lista: ${tipo}. Termo de busca: "${termoBusca}", Filtro Depto: "${filtroDepto}"`);

    // 3. Aplica os filtros
    let associacoesFiltradas = associacoesSource;

    if (filtroDepto) {
        associacoesFiltradas = associacoesFiltradas.filter(a => {
            // Garante que a propriedade pessoa_depto exista antes de tentar dividir
            const depto = a.pessoa_depto ? (a.pessoa_depto.split(' - ')[1] || '').trim() : '';
            return depto === filtroDepto;
        });
    }

    if (termoBusca) {
        associacoesFiltradas = associacoesFiltradas.filter(a => {
            const item = todoEstoque.find(t => t.id === a.item_id);
            if (!item) return false; // Se o item não for encontrado no estoque, remove da lista

            // Constrói uma string de busca segura, mesmo que alguns campos sejam nulos
            const searchString = `${a.pessoa_depto || ''} ${item.modelo_tipo || ''} ${item.patrimonio || ''}`.toLowerCase();
            return searchString.includes(termoBusca);
        });
    }

    // Adicionado para depuração:
    console.log(`Encontrados ${associacoesFiltradas.length} itens após o filtro.`);

    // 4. Renderiza a lista na tela
    listaUI.innerHTML = '';
    if (associacoesFiltradas.length === 0) {
        listaUI.innerHTML = `<li>Nenhuma associação ${ehMaquina ? '' : 'de mobiliário'} encontrada.</li>`;
        return;
    }

    associacoesFiltradas.forEach(a => {
        const i = todoEstoque.find(t => t.id === a.item_id);
        if (!i) return;
        const li = document.createElement('li');
        li.innerHTML = `
            <span>
                <strong>${a.pessoa_depto}</strong> está com: 
                <a href="#" class="spec-link" data-id="${i.id}">${i.modelo_tipo}</a>
                <br>
                <small class="patrimonio-info">Património: ${i.patrimonio}</small>
            </span>
            <div class="botoes-item">
                <button class="btn-item btn-devolver" data-id="${a.id}">Devolver</button>
            </div>
        `;
        listaUI.appendChild(li);
    });
}


function popularFiltroDepartamentos(associacoes) {
    const f = document.getElementById('filtro-departamento');
    if (!f) return;
    const d = [...new Set(associacoes.map(a => (a.pessoa_depto.split(' - ')[1] || '').trim()))].filter(Boolean).sort();
    f.innerHTML = '<option value="">-- Todos os Departamentos --</option>';
    d.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; f.appendChild(o); });
}

function abrirModalSenha() { const m = document.getElementById('modal-senha'); if (m) m.classList.add('visible'); }
function fecharModalSenha() { const m = document.getElementById('modal-senha'); if (m) m.classList.remove('visible'); }
async function mudarSenha(e) { e.preventDefault(); const a = document.getElementById('senha-atual').value, n = document.getElementById('nova-senha').value; try { const r = await apiChangePassword(a, n); alert(r.message); fecharModalSenha(); e.target.reset(); } catch (r) { alert("Erro: " + r.message); } }

/**
 * Formata um número de património (ex: 100001272541) para o formato com pontos (ex: 100.001.272.541).
 * @param {string} numero O número de património a ser formatado.
 * @returns {string} O número formatado ou o original se não for válido.
 */
function formatarPatrimonio(numero) {
    if (!numero || typeof numero !== 'string') {
        return numero; // Retorna o valor original se for nulo ou não for uma string
    }
    // Remove quaisquer caracteres que não sejam dígitos para limpar o número
    const numeroLimpo = numero.replace(/\D/g, '');

    // Aplica a formatação com pontos
    return numeroLimpo.replace(/(\d{3})(?=\d)/g, '$1.');
}


/**
 * Exibe um modal de confirmação para uma ação.
 * @param {string} mensagem A mensagem a ser exibida no modal.
 * @param {function} onConfirm A função a ser executada se o usuário confirmar.
 */
function exibirModalConfirmacao(mensagem, onConfirm) {
    const modal = document.getElementById('modal-confirmacao');
    const textoModal = document.getElementById('modal-texto');
    const btnConfirmar = document.getElementById('btn-modal-confirmar');
    const btnCancelar = document.getElementById('btn-modal-cancelar');

    if (!modal || !textoModal || !btnConfirmar || !btnCancelar) {
        console.error("Elementos do modal de confirmação não encontrados.");
        return;
    }

    textoModal.textContent = mensagem;
    modal.classList.add('visible');

    const fecharModal = () => modal.classList.remove('visible');

    // Usamos .onclick para garantir que apenas uma ação de confirmação esteja ativa por vez
    btnConfirmar.onclick = () => {
        fecharModal();
        onConfirm();
    };

    btnCancelar.onclick = fecharModal;
}

/**
 * Lida com o clique no botão "Devolver", mostrando um modal de confirmação
 * e chamando a API de devolução se confirmado.
 * @param {number} emprestimoId O ID do empréstimo a ser devolvido.
 */
async function handleDevolverClick(emprestimoId) {
    // Encontra a associação para obter detalhes para a mensagem de confirmação
    const associacao = [...todasAssociacoes, ...todasAssociacoesMobiliario].find(a => a.id === emprestimoId);
    const item = associacao ? todoEstoque.find(t => t.id === associacao.item_id) : null;

    if (!associacao || !item) {
        Toastify({ text: "Erro: Associação não encontrada.", backgroundColor: "red" }).showToast();
        return;
    }

    const mensagem = `Tem certeza que deseja devolver o item "${item.modelo_tipo}" que está com ${associacao.pessoa_depto}?`;

    exibirModalConfirmacao(mensagem, async () => {
        try {
            await devolverEmprestimo(emprestimoId);
            Toastify({ text: "Item devolvido com sucesso!", backgroundColor: "var(--cor-sucesso)" }).showToast();
            carregarDados(); // Recarrega e renderiza os dados atualizados
        } catch (error) {
            console.error("Erro ao devolver o item:", error);
            Toastify({ text: `Erro: ${error.message}`, backgroundColor: "var(--cor-perigo)" }).showToast();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Verifica a autenticação do usuário
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }
    // Carrega os dados iniciais da página
    carregarDados();

    // Lógica para o menu lateral (sidebar)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // Lógica para expandir submenus
    document.querySelectorAll('.has-submenu > a').forEach(m => {
        m.addEventListener('click', function (e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });

    // Mantém o submenu aberto se a página atual for dele
    const c = window.location.pathname;
    document.querySelectorAll('.submenu a').forEach(l => {
        if (c.includes(l.getAttribute('href'))) {
            const p = l.closest('.has-submenu');
            if (p) p.classList.add('open');
        }
    });

   
    // Adiciona os "escutadores" de eventos para busca e filtro
    const campoBusca = document.getElementById('campo-busca');
    const filtroDepartamento = document.getElementById('filtro-departamento');

    if (c.includes('lista.html')) {
        // Se estiver na página de máquinas
        if (campoBusca) campoBusca.addEventListener('input', () => renderizarListaAssociada('maquina'));
        if (filtroDepartamento) filtroDepartamento.addEventListener('change', () => renderizarListaAssociada('maquina'));
    } else if (c.includes('lista_mobiliario.html')) {
        // Se estiver na página de mobiliário
        if (campoBusca) campoBusca.addEventListener('input', () => renderizarListaAssociada('mobiliario'));
        if (filtroDepartamento) filtroDepartamento.addEventListener('change', () => renderizarListaAssociada('mobiliario'));
    }

    document.body.addEventListener('click', (event) => {
    const target = event.target; // O elemento que foi clicado

    // Verifica se o elemento clicado é um botão de "Devolver"
    if (target.classList.contains('btn-devolver')) {
        const emprestimoId = parseInt(target.dataset.id, 10);
        if (emprestimoId) {
            handleDevolverClick(emprestimoId);
        }
    }
});
  

    // Lógica para o botão de logout
    document.getElementById('btn-logout-sidebar').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });

    // Lógica para o modal de mudança de senha
    const btnMudarSenha = document.getElementById('btn-mudar-senha-sidebar');
    if (btnMudarSenha) btnMudarSenha.addEventListener('click', abrirModalSenha);
    const formMudarSenha = document.getElementById('form-mudar-senha');
    if (formMudarSenha) formMudarSenha.addEventListener('submit', mudarSenha);
    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if (btnSenhaCancelar) btnSenhaCancelar.addEventListener('click', fecharModalSenha);
});