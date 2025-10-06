// Importa apenas as funções da API que esta página realmente utiliza
import { getItens, getEmprestimos, devolverEmprestimo } from './api.js';

// --- ESTADO LOCAL ---
let todoEstoque = [];
let todasAssociacoes = [];
let todasAssociacoesMobiliario = [];
let dadosFiltrados = []; // Mantém os dados atualmente exibidos na tela

// --- FUNÇÕES DE LÓGICA E AUTENTICAÇÃO ---

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function exibirInfoUtilizador() {
    const infoUtilizadorUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    if (infoUtilizadorUI && token) {
        const d = parseJwt(token);
        if (d) {
            const n = d.nome || 'Utilizador', t = d.departamento || 'N/D', c = { 'TI': { icon: '#3498db', bg: '#eaf4fc', text: '#2980b9' }, 'GAS': { icon: '#27ae60', bg: '#e9f7ef', text: '#229954' }, 'default': { icon: '#8e8e8e', bg: '#f0f0f0', text: '#5e5e5e' } }, o = c[t.toUpperCase()] || c['default'];
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

        todasAssociacoes = emprestimosAtivos
            .map(e => ({ ...e, item_info: todoEstoque.find(t => t.id == e.item_id) }))
            .filter(e => e.item_info && e.item_info.categoria === 'COMPUTADOR');

        todasAssociacoesMobiliario = emprestimosAtivos
            .map(e => ({ ...e, item_info: todoEstoque.find(t => t.id == e.item_id) }))
            .filter(e => e.item_info && e.item_info.categoria === 'MOBILIARIO');

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
    const ehMaquina = tipo === 'maquina';
    const listaUI = document.getElementById(ehMaquina ? 'lista-associacoes' : 'lista-associacoes-mobiliario');
    const associacoesSource = ehMaquina ? todasAssociacoes : todasAssociacoesMobiliario;
    if (!listaUI) return;

    const termoBusca = document.getElementById('campo-busca').value.toLowerCase();
    const filtroDepto = document.getElementById('filtro-departamento').value;

    let associacoesFiltradas = associacoesSource;
    if (filtroDepto) {
        associacoesFiltradas = associacoesFiltradas.filter(a => {
            const depto = a.pessoa_depto ? (a.pessoa_depto.split(' - ')[1] || '').trim() : '';
            return depto === filtroDepto;
        });
    }
    if (termoBusca) {
        associacoesFiltradas = associacoesFiltradas.filter(a => {
            const item = a.item_info;
            if (!item) return false;
            const searchString = `${a.pessoa_depto || ''} ${item.modelo_tipo || ''} ${item.patrimonio || ''}`.toLowerCase();
            return searchString.includes(termoBusca);
        });
    }

    dadosFiltrados = associacoesFiltradas; // Atualiza a variável global com os dados filtrados
    listaUI.innerHTML = '';

    if (dadosFiltrados.length === 0) {
        listaUI.innerHTML = `<li>Nenhuma associação encontrada.</li>`;
        return;
    }

    dadosFiltrados.forEach(a => {
        const i = a.item_info;
        const li = document.createElement('li');
        li.innerHTML = `
            <span>
                <strong>${a.pessoa_depto}</strong> está com: 
                <a href="#" class="spec-link" data-id="${i.id}">${i.modelo_tipo}</a>
                <br>
                <small class="patrimonio-info">Patrimônio: ${i.patrimonio}</small>
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

// --- FUNÇÕES DE AÇÃO ---

function exibirModalConfirmacao(mensagem, onConfirm) {
    const modal = document.getElementById('modal-confirmacao');
    const textoModal = document.getElementById('modal-texto');
    const btnConfirmar = document.getElementById('btn-modal-confirmar');
    const btnCancelar = document.getElementById('btn-modal-cancelar');
    if (!modal) return;
    textoModal.textContent = mensagem;
    modal.classList.add('visible');
    const fecharModal = () => modal.classList.remove('visible');
    btnConfirmar.onclick = () => { fecharModal(); onConfirm(); };
    btnCancelar.onclick = fecharModal;
}

async function handleDevolverClick(emprestimoId) {
    const associacao = [...todasAssociacoes, ...todasAssociacoesMobiliario].find(a => a.id === emprestimoId);
    if (!associacao || !associacao.item_info) return;
    const mensagem = `Tem certeza que deseja devolver o item "${associacao.item_info.modelo_tipo}" que está com ${associacao.pessoa_depto}?`;
    exibirModalConfirmacao(mensagem, async () => {
        try {
            await devolverEmprestimo(emprestimoId);
            carregarDados();
        } catch (error) {
            console.error("Erro ao devolver o item:", error);
        }
    });
}

function exportarParaCSV(dados, nomeArquivo) {
    if (!dados || dados.length === 0) return alert("Não há dados para exportar.");
    const cabecalhos = ['Patrimônio', 'Tipo/Modelo', 'Pessoa/Departamento', 'Data de Associação'];
    const linhas = dados.map(row => [
        `"${row.item_info.patrimonio || ''}"`,
        `"${row.item_info.modelo_tipo || ''}"`,
        `"${row.pessoa_depto || ''}"`,
        `"${new Date(row.data_emprestimo).toLocaleDateString()}"`
    ].join(','));
    const conteudoCSV = [cabecalhos.join(','), ...linhas].join('\n');
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(conteudoCSV);
    link.target = '_blank';
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }
    carregarDados();

    const campoBusca = document.getElementById('campo-busca');
    const filtroDepartamento = document.getElementById('filtro-departamento');
    const currentPagePath = window.location.pathname;

    const tipoPagina = currentPagePath.includes('lista_mobiliario.html') ? 'mobiliario' : 'maquina';
    
    if (campoBusca) campoBusca.addEventListener('input', () => renderizarListaAssociada(tipoPagina));
    if (filtroDepartamento) filtroDepartamento.addEventListener('change', () => renderizarListaAssociada(tipoPagina));

    document.body.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-devolver')) {
            const emprestimoId = parseInt(event.target.dataset.id, 10);
            if (emprestimoId) handleDevolverClick(emprestimoId);
        }
    });

    const btnExportarMaquinas = document.getElementById('btn-exportar');
    if (btnExportarMaquinas) {
        btnExportarMaquinas.addEventListener('click', () => exportarParaCSV(dadosFiltrados, 'associacoes_maquinas.csv'));
    }

    const btnExportarMobiliario = document.getElementById('btn-exportar-mobiliario');
    if (btnExportarMobiliario) {
        btnExportarMobiliario.addEventListener('click', () => exportarParaCSV(dadosFiltrados, 'associacoes_mobiliario.csv'));
    }
});