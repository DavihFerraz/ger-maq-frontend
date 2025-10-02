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

// --- FUNÇÃO DE RENDERIZAÇÃO UNIFICADA ---
function renderizarListaAssociada(tipo) {
    const ehMaquina = tipo === 'maquina';
    const listaUI = document.getElementById(ehMaquina ? 'lista-associacoes' : 'lista-associacoes-mobiliario');
    const associacoesSource = ehMaquina ? todasAssociacoes : todasAssociacoesMobiliario;

    if (!listaUI) return;

    // --- CORREÇÃO APLICADA AQUI ---
    // Esta nova lógica encontra os campos, não importa a página
    const campoBusca = document.getElementById('campo-busca');
    const filtroDeptoSelect = document.getElementById('filtro-departamento');
    
    const termoBusca = campoBusca ? campoBusca.value.toLowerCase() : '';
    const filtroDepto = filtroDeptoSelect ? filtroDeptoSelect.value : '';
    // --- FIM DA CORREÇÃO ---
    
    console.log(`--- INICIANDO FILTRAGEM (${tipo}) ---`);
    console.log(`Termo: "${termoBusca}", Depto: "${filtroDepto}"`);

    let associacoesFiltradas = associacoesSource;
    console.log(`Passo 1: A lista original tem ${associacoesFiltradas.length} itens.`);

    if (filtroDepto) {
        associacoesFiltradas = associacoesFiltradas.filter(a => {
            const depto = a.pessoa_depto ? (a.pessoa_depto.split(' - ')[1] || '').trim() : '';
            return depto === filtroDepto;
        });
        console.log(`Passo 2: Após filtrar por DEPARTAMENTO, restam ${associacoesFiltradas.length} itens.`);
    }

    if (termoBusca) {
        associacoesFiltradas = associacoesFiltradas.filter(a => {
            const item = todoEstoque.find(t => t.id === a.item_id);
            if (!item) return false;
            const searchString = `${a.pessoa_depto || ''} ${item.modelo_tipo || ''} ${item.patrimonio || ''}`.toLowerCase();
            return searchString.includes(termoBusca);
        });
        console.log(`Passo 3: Após filtrar por BUSCA, restam ${associacoesFiltradas.length} itens.`);
    }

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
                <small class="patrimonio-info">Património: ${i.patrimonio || 'N/A'}</small>
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

// --- MODAL DE SENHA E OUTRAS FUNÇÕES ---
function abrirModalSenha() { const m = document.getElementById('modal-senha'); if (m) m.classList.add('visible'); }
function fecharModalSenha() { const m = document.getElementById('modal-senha'); if (m) m.classList.remove('visible'); }
async function mudarSenha(e) { e.preventDefault(); const a = document.getElementById('senha-atual').value, n = document.getElementById('nova-senha').value; try { const r = await apiChangePassword(a, n); alert(r.message); fecharModalSenha(); e.target.reset(); } catch (r) { alert("Erro: " + r.message); } }

// --- EVENT LISTENER PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOM completamente carregado. Iniciando script.');

    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }
    carregarDados();

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    document.querySelectorAll('.has-submenu > a').forEach(m => {
        m.addEventListener('click', function (e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });

    const c = window.location.pathname;
    document.querySelectorAll('.submenu a').forEach(l => {
        if (c.includes(l.getAttribute('href'))) {
            const p = l.closest('.has-submenu');
            if (p) p.classList.add('open');
        }
    });

    // --- CORREÇÃO FINAL: USANDO DELEGAÇÃO DE EVENTOS ---
    console.log('[DEBUG] Anexando eventos com a técnica de DELEGAÇÃO.');

    document.body.addEventListener('input', function(event) {
        // Verifica se o evento aconteceu no nosso campo de busca
        if (event.target.id === 'campo-busca') {
            console.log(`[DEBUG] Evento 'input' capturado em #${event.target.id}!`);
            const paginaAtual = window.location.pathname;
            if (paginaAtual.includes('lista.html')) {
                renderizarListaAssociada('maquina');
            } else if (paginaAtual.includes('lista_mobiliario.html')) {
                renderizarListaAssociada('mobiliario');
            }
        }
    });

    document.body.addEventListener('change', function(event) {
        // Verifica se o evento aconteceu no nosso filtro de departamento
        if (event.target.id === 'filtro-departamento') {
            console.log(`[DEBUG] Evento 'change' capturado em #${event.target.id}!`);
            const paginaAtual = window.location.pathname;
            if (paginaAtual.includes('lista.html')) {
                renderizarListaAssociada('maquina');
            } else if (paginaAtual.includes('lista_mobiliario.html')) {
                renderizarListaAssociada('mobiliario');
            }
        }
    });
    // --- FIM DA CORREÇÃO ---

    document.getElementById('btn-logout-sidebar').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });

    const btnMudarSenha = document.getElementById('btn-mudar-senha-sidebar');
    if (btnMudarSenha) btnMudarSenha.addEventListener('click', abrirModalSenha);
    const formMudarSenha = document.getElementById('form-mudar-senha');
    if (formMudarSenha) formMudarSenha.addEventListener('submit', mudarSenha);
    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if (btnSenhaCancelar) btnSenhaCancelar.addEventListener('click', fecharModalSenha);

    console.log('[DEBUG] Script finalizado.');
});