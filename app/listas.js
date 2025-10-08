// Importa apenas as funções da API que esta página realmente utiliza
import { getItens, getEmprestimos, devolverEmprestimo } from './api.js';

// --- ESTADO LOCAL ---
let todoEstoque = [];
let todasAssociacoes = [];
let todasAssociacoesMobiliario = [];
let dadosFiltrados = []; // Mantém os dados atualmente exibidos na tela
let todasAssociacoesMonitores = [];

// --- FUNÇÕES DE LÓGICA E AUTENTICAÇÃO ---


async function carregarDados() {
    try {
        const [itens, todosOsEmprestimos] = await Promise.all([getItens(), getEmprestimos()]);
        todoEstoque = itens;
        const emprestimosAtivos = todosOsEmprestimos.filter(e => !e.data_devolucao);

        // Filtra e separa as associações por categoria
        todasAssociacoes = emprestimosAtivos
            .map(e => ({ ...e, item_info: todoEstoque.find(t => t.id == e.item_id) }))
            .filter(e => e.item_info && e.item_info.categoria === 'COMPUTADOR');

        todasAssociacoesMonitores = emprestimosAtivos
            .map(e => ({ ...e, item_info: todoEstoque.find(t => t.id == e.item_id) }))
            .filter(e => e.item_info && e.item_info.categoria === 'MONITOR');

        todasAssociacoesMobiliario = emprestimosAtivos
            .map(e => ({ ...e, item_info: todoEstoque.find(t => t.id == e.item_id) }))
            .filter(e => e.item_info && e.item_info.categoria === 'MOBILIARIO');

        // Renderiza a lista inicial com base na página atual
        if (document.getElementById('lista-associacoes')) {
            renderizarListaAssociada();
            popularFiltroDepartamentos([...todasAssociacoes, ...todasAssociacoesMonitores]);
        }
        if (document.getElementById('lista-associacoes-mobiliario')) {
            renderizarListaAssociada();
            popularFiltroDepartamentos(todasAssociacoesMobiliario);
        }
    } catch (error) { 
        console.error("Erro ao carregar dados da API:", error); 
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function renderizarListaAssociada() {
    const tipoFiltro = document.getElementById('filtro-tipo-ativo-lista')?.value || 'MOBILIARIO'; // Usa MOBILIARIO como fallback

    const ehPaginaMobiliario = window.location.pathname.includes('lista_mobiliario.html');
    const listaUI = document.getElementById(ehPaginaMobiliario ? 'lista-associacoes-mobiliario' : 'lista-associacoes');

    if (!listaUI) return;

    let associacoesSource;
    if (ehPaginaMobiliario) {
        associacoesSource = todasAssociacoesMobiliario;
    } else {
        associacoesSource = tipoFiltro === 'COMPUTADOR' ? todasAssociacoes : todasAssociacoesMonitores;
    }

    const termoBusca = (document.getElementById('campo-busca')?.value || '').toLowerCase();
    const filtroDepto = document.getElementById('filtro-departamento')?.value;

    let associacoesFiltradas = associacoesSource.filter(a => {
        const depto = (a.pessoa_depto.split(' - ')[1] || '').trim();
        const searchString = `${a.pessoa_depto || ''} ${a.item_info.modelo_tipo || ''} ${a.item_info.patrimonio || ''}`.toLowerCase();
        const filtroDeptoOk = !filtroDepto || depto === filtroDepto;
        const buscaOk = !termoBusca || searchString.includes(termoBusca);
        return filtroDeptoOk && buscaOk;
    });

    listaUI.innerHTML = '';
    if (associacoesFiltradas.length === 0) {
        listaUI.innerHTML = `<li>Nenhuma associação encontrada.</li>`;
        return;
    }

    associacoesFiltradas.forEach(a => {
        const i = a.item_info;
        let monitoresHtml = '';
        if (tipoFiltro === 'COMPUTADOR' && Array.isArray(a.monitores_associados_ids) && a.monitores_associados_ids.length > 0) {
            const monitoresAssociados = a.monitores_associados_ids.map(id => todoEstoque.find(item => item.id === id))
                .filter(Boolean)
                .map(info => `<li><small>${info.modelo_tipo} (P/N: ${info.patrimonio})</small></li>`)
                .join('');
            if (monitoresAssociados) {
                monitoresHtml = `<ul class="monitores-na-associacao"><span>Monitores Associados:</span>${monitoresAssociados}</ul>`;
            }
        }

        const li = document.createElement('li');
        li.innerHTML = `<div><span><strong>${a.pessoa_depto}</strong> está com: <a href="#" class="spec-link" data-id="${i.id}">${i.modelo_tipo}</a><br><small class="patrimonio-info">Património: ${i.patrimonio}</small></span>${monitoresHtml}</div><div class="botoes-item"><button class="btn-item btn-devolver" data-id="${a.id}">Devolver</button></div>`;
        listaUI.appendChild(li);
    });
}

async function popularFiltroDepartamentos() {
    const filtroUI = document.getElementById('filtro-departamento');
    if (!filtroUI) return;

    try {
        // Vamos usar a API para buscar todos os setores cadastrados
        const response = await fetch('/api/setores', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (!response.ok) throw new Error('Falha ao buscar setores da API');
        
        const setores = await response.json();
        
        // Limpa opções antigas, mantendo a primeira ("Todos os Departamentos")
        const placeholder = filtroUI.querySelector('option');
        filtroUI.innerHTML = '';
        if (placeholder) filtroUI.appendChild(placeholder);

        // Adiciona os setores recebidos da API
        setores.forEach(setor => {
            const option = document.createElement('option');
            option.value = setor.nome; // O valor para filtrar será o NOME do setor
            option.textContent = setor.nome;
            filtroUI.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao popular filtro de departamentos:", error);
        filtroUI.innerHTML = '<option value="">Erro ao carregar</option>';
    }
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

// Adicione estas duas funções ao listas.js

function abrirModalEspecificacoes(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('modal-especificacoes');
    if(!modal) return;

    modal.querySelector('#spec-modelo').textContent = item.modelo_tipo;
    const listaSpecs = modal.querySelector('#spec-lista');
    
    // Começa a lista de HTML com as informações comuns a todos os ativos
    let specsHtml = `
        <li><strong>Património:</strong> ${item.patrimonio || 'N/P'}</li>
        <li><strong>Categoria:</strong> ${item.categoria || 'N/P'}</li>
        <li><strong>Setor:</strong> ${item.setor_nome || 'N/P'}</li>
    `;

    // Adiciona os campos de especificações APENAS se a categoria for COMPUTADOR
    if (item.categoria === 'COMPUTADOR') {
        specsHtml += `
            <li><strong>Processador:</strong> ${item.espec_processador || 'N/A'}</li>
            <li><strong>Memória RAM:</strong> ${item.espec_ram || 'N/A'}</li>
            <li><strong>Armazenamento:</strong> ${item.espec_armazenamento || 'N/A'}</li>
        `;
    }
    
    // Adiciona as observações no final, se existirem
    if (item.observacoes) {
        specsHtml += `<li><strong>Observações:</strong> ${item.observacoes}</li>`;
    }

    // Insere o HTML gerado na lista do modal
    listaSpecs.innerHTML = specsHtml;
    
    // Mostra o modal
    modal.classList.add('visible');
}

function fecharModalEspecificacoes() {
    const modal = document.getElementById('modal-especificacoes');
    if (modal) modal.classList.remove('visible');
}

function abrirModalSpecMobiliario(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('modal-spec-mobiliario');
    if(!modal) return;

    modal.querySelector('#spec-mobiliario-modelo').textContent = item.modelo_tipo;
    const listaSpecs = modal.querySelector('#spec-mobiliario-lista');

    // Preenche com os campos relevantes para mobiliário
    listaSpecs.innerHTML = `
        <li><strong>Património:</strong> ${item.patrimonio || 'N/P'}</li>
        <li><strong>Categoria:</strong> ${item.categoria || 'N/P'}</li>
        <li><strong>Setor:</strong> ${item.setor_nome || 'N/P'}</li>
        <li><strong>Estado de Conservação:</strong> ${item.estado_conservacao || 'N/A'}</li>
        ${item.observacoes ? `<li><strong>Observações:</strong> ${item.observacoes}</li>` : ''}
    `;

    modal.classList.add('visible');
}

function fecharModalSpecMobiliario() {
    const modal = document.getElementById('modal-spec-mobiliario');
    if (modal) modal.classList.remove('visible');
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

        if (event.target.classList.contains('spec-link')) {
        event.preventDefault(); // Impede que a página recarregue
        const itemId = parseInt(event.target.dataset.id, 10);
        if (itemId) {
            abrirModalEspecificacoes(itemId);
        }
    }

    if (event.target.classList.contains('spec-link')) {
        event.preventDefault();
        const itemId = parseInt(event.target.dataset.id, 10);
        if (!itemId) return;

        // Verifica em qual página estamos para abrir o modal correto
        if (window.location.pathname.includes('lista_mobiliario.html')) {
            abrirModalSpecMobiliario(itemId);
        } else {
            abrirModalEspecificacoes(itemId);
        }
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

    const btnFecharSpec = document.getElementById('btn-spec-fechar');
    if(btnFecharSpec) {
        btnFecharSpec.addEventListener('click', fecharModalEspecificacoes);
    }

    const btnFecharSpecMobiliario = document.getElementById('btn-spec-mobiliario-fechar');
    if(btnFecharSpecMobiliario) {
        btnFecharSpecMobiliario.addEventListener('click', fecharModalSpecMobiliario);
    }

    const filtroTipoAtivo = document.getElementById('filtro-tipo-ativo-lista');
    if (filtroTipoAtivo) {
        filtroTipoAtivo.addEventListener('change', renderizarListaAssociada);
    }
});