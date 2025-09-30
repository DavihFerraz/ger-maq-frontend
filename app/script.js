// =================================================================
// SCRIPT.JS - Versão para API Node.js/PostgreSQL
// =================================================================

// 1. IMPORTAÇÕES DO MÓDULO DA API
import {
    getItens,
    createItem,
    updateItem,
    deleteItem,
    getEmprestimos,
    createEmprestimo,
    devolverEmprestimo,
    apiChangePassword,
    getModelos, 
    createModelo,
    getItemHistory
} from './api.js';

// 2. ESTADO LOCAL DA APLICAÇÃO
let utilizadorAtual = null; // Pode ser preenchido no futuro com dados do usuário a partir do token
let todasAssociacoes = [];
let todoHistorico = []; // Esta variável precisará de um novo endpoint para ser populada
let todoEstoque = [];
let todasAssociacoesMobiliario = [];
let idEmEdicao = null;
let graficoPizza = null;
let graficoBarras = null;
let todosModelos = [];
let monitoresSelecionadosIds = new Set();

// =================================================================
// 3. LÓGICA DE AUTENTICAÇÃO E CARREGAMENTO DE DADOS
// =================================================================

function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        if (window.location.pathname.indexOf('login.html') === -1) {
            window.location.href = 'login.html';
        }
    } else {
        // Se houver um token, carregamos os dados da aplicação
        carregarDados();
    }
}

async function carregarDados() {
    exibirInfoUtilizador();
    try {
        const [itens, todosOsEmprestimos, modelos] = await Promise.all([
            getItens(),
            getEmprestimos(),
            getModelos()
        ]);

        // DEBUG: Vamos ver exatamente o que a API de produção está a enviar
        console.log("DADOS RECEBIDOS DA API DE PRODUÇÃO:", todosOsEmprestimos);

        todoEstoque = itens;
        todosModelos = modelos;
        
        const emprestimosAtivos = todosOsEmprestimos.filter(e => !e.data_devolucao);
        
        todasAssociacoes = emprestimosAtivos.filter(e => {
            const item = todoEstoque.find(i => i.id == e.item_id);
            return item && item.categoria && item.categoria.toUpperCase() === 'COMPUTADOR';
        });
        
        todasAssociacoesMobiliario = emprestimosAtivos.filter(e => {
            const item = todoEstoque.find(i => i.id == e.item_id);
            return item && item.categoria && item.categoria.toUpperCase() === 'MOBILIARIO';
        });
        
        todoHistorico = todosOsEmprestimos.filter(e => e.data_devolucao);

        renderizarTudo();
        popularFiltroDepartamentos();
        popularFiltroDepartamentosMobiliario();
        popularDropdownModelos();

    } catch (error) {
        console.error("Erro ao carregar dados da API:", error);
    }

   

}
// =================================================================
// 4. FUNÇÕES DE RENDERIZAÇÃO
// =================================================================

function renderizarTudo() {
    // Estas funções dependem da sua implementação de HTML e CSS.
    // Adapte os nomes dos campos se necessário (ex: .modelo para .modelo_tipo)
    renderizarEstoque();
    renderizarAssociacoes();
    renderizarMobiliario();
    renderizarAssociacoesMobiliario();
    renderizarResumos();
    renderizarGraficos();
    renderizarHistorico();
    popularDropdownMonitores();
    renderizarOutrosAtivos();
}


function renderizarAssociacoes() {
    const listaUI = document.getElementById('lista-associacoes');
    if (!listaUI) return;

    // Obtém os valores dos filtros
    const campoBusca = document.getElementById('campo-busca');
    const termoBusca = campoBusca ? campoBusca.value.toLowerCase() : '';
    
    const filtroDeptoSelect = document.getElementById('filtro-departamento');
    const filtroDepto = filtroDeptoSelect ? filtroDeptoSelect.value : '';

    let associacoesFiltradas = todasAssociacoes;

    // 1. Aplica o filtro de departamento, se um for selecionado
    if (filtroDepto) {
        associacoesFiltradas = associacoesFiltradas.filter(assoc => {
            const partes = assoc.pessoa_depto.split(' - ');
            return partes.length > 1 && partes[1].trim() === filtroDepto;
        });
    }

    // 2. Aplica o filtro de busca de texto sobre o resultado anterior
    if (termoBusca) {
        associacoesFiltradas = associacoesFiltradas.filter(assoc => {
            const itemAssociado = todoEstoque.find(item => item.id === assoc.item_id);
            if (!itemAssociado) return false;

            const textoCompleto = `${assoc.pessoa_depto} ${itemAssociado.modelo_tipo} ${itemAssociado.patrimonio}`.toLowerCase();
            return textoCompleto.includes(termoBusca);
        });
    }

    // 3. Renderiza o resultado final
    listaUI.innerHTML = '';
    if (associacoesFiltradas.length === 0) {
        listaUI.innerHTML = '<li>Nenhuma associação encontrada.</li>';
        return;
    }

    associacoesFiltradas.forEach(assoc => {
        const itemAssociado = todoEstoque.find(item => item.id === assoc.item_id);
        if (!itemAssociado) return; // Segurança extra

        const li = document.createElement('li');
        li.innerHTML = `
        <span>
            <strong>${assoc.pessoa_depto}</strong> está com: 
            <a href="#" class="spec-link" data-id="${itemAssociado.id}">${itemAssociado.modelo_tipo}</a>
            <br><small class="patrimonio-info">Património: ${formatarPatrimonio(itemAssociado.patrimonio)}</small>
        </span>
        <div class="botoes-item">
            <button class="btn-item btn-devolver" data-id="${assoc.id}">Devolver</button>
        </div>`;
        listaUI.appendChild(li);
    });
}


function renderizarEstoque() {
    const listaEstoqueUI = document.getElementById('lista-estoque');
    if (!listaEstoqueUI) return;

    // ATUALIZADO: Filtra para pegar COMPUTADOR e MONITOR
    const todoMaquinasMonitores = todoEstoque.filter(item => item.categoria === 'COMPUTADOR' || item.categoria === 'MONITOR');
    
    const campoBuscaEstoque = document.getElementById('campo-busca-estoque');
    if(campoBuscaEstoque) {
        campoBuscaEstoque.addEventListener('input', renderizarEstoque);
    }
    const termoBusca = campoBuscaEstoque ? campoBuscaEstoque.value.toLowerCase() : '';

    let estoqueParaRenderizar = todoMaquinasMonitores.filter(item => {
        const textoBusca = `${item.modelo_tipo || ''} ${item.patrimonio || ''} ${item.categoria || ''}`.toLowerCase();
        return textoBusca.includes(termoBusca);
    });

    estoqueParaRenderizar.sort((a, b) => a.modelo_tipo.localeCompare(b.modelo_tipo));

    listaEstoqueUI.innerHTML = '';
    if (estoqueParaRenderizar.length === 0) {
        listaEstoqueUI.innerHTML = '<li>Nenhum computador ou monitor encontrado.</li>';
        return;
    }

    estoqueParaRenderizar.forEach(item => {
        const estaEmUso = item.status && item.status.toLowerCase() === 'em uso';
        let detalhesHtml = '';
        
        // Mostra detalhes específicos se for um computador
        if (item.categoria === 'COMPUTADOR') {
            detalhesHtml = `
                <br><small>Processador: ${item.espec_processador || 'N/A'}</small>
                <br><small>RAM: ${item.espec_ram || 'N/A'}</small>
                <br><small>Armazenamento: ${item.espec_armazenamento || 'N/A'}</small>
            `;
        }

        const li = document.createElement('li');
        const statusClass = item.status ? item.status.toLowerCase().replace(' ', '-') : 'status-desconhecido';
        li.classList.add(`status-${statusClass}`);

        const botoesHTML = `
            <button class="btn-item btn-historico" data-id="${item.id}">Histórico</button>
            <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
            <button class="btn-item btn-excluir-estoque" data-id="${item.id}" ${estaEmUso ? 'disabled' : ''}>Excluir</button>
        `;
        
        const statusGASCadastroHTML = item.cadastrado_gpm ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>` : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;
        
        li.innerHTML = `
            <div class="info-item">
                <span>
                    <strong>${item.modelo_tipo}</strong> (Património: ${formatarPatrimonio(item.patrimonio)})
                    <br><small>Categoria: ${item.categoria}</small>
                    <br><small>Setor: ${item.setor || 'N/A'}</small>
                    ${detalhesHtml}
                </span>
                <div class="status-badges-container">
                    <span class="status-badge status-${statusClass}">${item.status}</span>
                    ${statusGASCadastroHTML}
                </div>
            </div>
            <div class="botoes-item">${botoesHTML}</div>`;
        listaEstoqueUI.appendChild(li);
    });
}


function renderizarMobiliario() {
    const listaMobiliarioUI = document.getElementById('lista-mobiliario');
    if (!listaMobiliarioUI) return;

    // Filtra para pegar apenas a categoria 'MOBILIARIO'
    const todoMobiliario = todoEstoque.filter(item => item.categoria === 'MOBILIARIO');
    const campoBuscaMobiliario = document.getElementById('campo-busca-mobiliario');
    if(campoBuscaMobiliario) {
    campoBuscaMobiliario.addEventListener('input', renderizarMobiliario);
    }
    const termoBusca = campoBuscaMobiliario ? campoBuscaMobiliario.value.toLowerCase() : '';
    const campoBuscaOutros = document.getElementById('campo-busca-outros');
    if(campoBuscaOutros) {
        campoBuscaOutros.addEventListener('input', renderizarOutrosAtivos);
    }

    // Filtro de busca atualizado para incluir o nome do utilizador
    let mobiliarioParaRenderizar = todoMobiliario.filter(item => {
        const tipo = (item.modelo_tipo || '').toLowerCase();
        const patrimonio = (item.patrimonio || '').toLowerCase();
        const associacao = todasAssociacoesMobiliario.find(emp => emp.item_id === item.id);
        const nomeUtilizador = (associacao ? associacao.pessoa_depto : '').toLowerCase();
        return tipo.includes(termoBusca) || patrimonio.includes(termoBusca) || nomeUtilizador.includes(termoBusca);
    });

    // Ordenação por status e depois por tipo
    mobiliarioParaRenderizar.sort((a, b) => {
        if (a.status < b.status) return 1;
        if (a.status > b.status) return -1;
        return a.modelo_tipo.localeCompare(b.modelo_tipo);
    });

    listaMobiliarioUI.innerHTML = '';
    if (mobiliarioParaRenderizar.length === 0) {
        listaMobiliarioUI.innerHTML = '<li>Nenhum mobiliário encontrado.</li>';
        return;
    }

    mobiliarioParaRenderizar.forEach(item => {
        const statusAtual = item.status;
        // Verificação de status consistente (case-insensitive)
        const estaEmUso = statusAtual && statusAtual.toLowerCase() === 'em uso';
        let utilizadorHtml = '';

        if (estaEmUso) {
            const associacao = todasAssociacoesMobiliario.find(emp => emp.item_id === item.id);
            if (associacao) {
                const nomePessoa = associacao.pessoa_depto.split(' - ')[0];
                utilizadorHtml = `<br><small class="user-info">Utilizador: <strong>${nomePessoa}</strong></small>`;
            }
        }

        const li = document.createElement('li');
        // Lógica de classe de status mais segura
        const statusClass = statusAtual ? statusAtual.toLowerCase().replace(' ', '-') : 'status-desconhecido';
        li.classList.add(`status-${statusClass}`);

        let botoesHTML = `
            <button class="btn-item btn-historico" data-id="${item.id}">Histórico</button>
            <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
            <button class="btn-item btn-excluir-estoque" data-id="${item.id}" ${estaEmUso ? 'disabled' : ''}>Excluir</button>
        `;
        const statusGASCadastroHTML = item.cadastrado_gpm ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>` : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;
        
        // Estrutura HTML do item para incluir os mesmos campos
        li.innerHTML = `
            <div class="info-item">
                <span>
                    <strong>${item.modelo_tipo}</strong> (Património: ${formatarPatrimonio(item.patrimonio)})
                    <br><small>Setor: ${item.setor || 'N/A'}</small>
                    <br><small>Classe: ${item.classe || 'N/A'}</small>
                    <br><small>Estado: ${item.estado_conservacao || 'N/A'}</small>
                    ${item.observacoes ? `<br><small>${item.observacoes}</small>` : ''}
                    ${utilizadorHtml}
                </span>
                <div class="status-badges-container">
                    <span class="status-badge status-${statusClass}">${statusAtual || 'Desconhecido'}</span>
                    ${statusGASCadastroHTML}
                </div>
            </div>
            <div class="botoes-item">${botoesHTML}</div>`;
        listaMobiliarioUI.appendChild(li);
    });
}



function renderizarOutrosAtivos() {
    const listaUI = document.getElementById('lista-outros-ativos');
    if (!listaUI) return;

    const todoOutros = todoEstoque.filter(item => item.categoria === 'OUTROS');
    const campoBusca = document.getElementById('campo-busca-outros');
    const termoBusca = campoBusca ? campoBusca.value.toLowerCase() : '';

    const filtrados = todoOutros.filter(item => {
        return (item.modelo_tipo || '').toLowerCase().includes(termoBusca) ||
               (item.patrimonio || '').toLowerCase().includes(termoBusca);
    });

    listaUI.innerHTML = '';
    if (filtrados.length === 0) {
        listaUI.innerHTML = '<li>Nenhum item "Outro" encontrado.</li>';
        return;
    }

    filtrados.sort((a, b) => (a.modelo_tipo || '').localeCompare(b.modelo_tipo || ''));

    filtrados.forEach(item => {
        const estaEmUso = item.status === 'Em Uso';
        const li = document.createElement('li');
        const statusClass = item.status ? item.status.toLowerCase().replace(' ', '-') : 'desconhecido';
        li.classList.add(`status-${statusClass}`);

        const botoesHTML = `
            <button class="btn-item btn-historico" data-id="${item.id}">Histórico</button>
            <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
            <button class="btn-item btn-excluir-estoque" data-id="${item.id}" ${estaEmUso ? 'disabled' : ''}>Excluir</button>
        `;
        
        li.innerHTML = `
            <div class="info-item">
                <span><strong>${item.modelo_tipo}</strong> (Património: ${formatarPatrimonio(item.patrimonio)})</span>
                <span class="status-badge status-${statusClass}">${item.status}</span>
            </div>
            <div class="botoes-item">${botoesHTML}</div>`;
        listaUI.appendChild(li);
    });
}

function renderizarAssociacoesMobiliario() {
    const listaUI = document.getElementById('lista-associacoes-mobiliario');
    if (!listaUI) return;

    const filtroDeptoSelect = document.getElementById('filtro-departamento');
    const filtroDepto = filtroDeptoSelect ? filtroDeptoSelect.value : '';

    let associacoesFiltradas = todasAssociacoesMobiliario;

    if (filtroDepto) {
        associacoesFiltradas = associacoesFiltradas.filter(assoc => {
            const partes = assoc.pessoa_depto.split(' - ');
            return partes.length > 1 && partes[1].trim() === filtroDepto;
        });
    }

    // A lógica de busca por texto continua a funcionar em conjunto com o filtro
    const campoBusca = document.getElementById('campo-busca');
    const termoBusca = campoBusca ? campoBusca.value.toLowerCase() : '';
    if (termoBusca) {
         associacoesFiltradas = associacoesFiltradas.filter(assoc => {
            const itemAssociado = todoEstoque.find(item => item.id === assoc.item_id);
            if (!itemAssociado) return false;
            const textoCompleto = `${assoc.pessoa_depto} ${itemAssociado.modelo_tipo} ${itemAssociado.patrimonio}`.toLowerCase();
            return textoCompleto.includes(termoBusca);
        });
    }

    listaUI.innerHTML = '';
    if (associacoesFiltradas.length === 0) {
        listaUI.innerHTML = '<li>Nenhuma associação de mobiliário encontrada.</li>';
        return;
    }

    associacoesFiltradas.forEach(assoc => {
        const itemAssociado = todoEstoque.find(item => item.id === assoc.item_id);
        if (!itemAssociado) return;
        const li = document.createElement('li');
        li.innerHTML = `
        <span>
            <strong>${assoc.pessoa_depto}</strong> está com: ${itemAssociado.modelo_tipo}
            <br><small class="patrimonio-info">Património: ${formatarPatrimonio(itemAssociado.patrimonio)}</small>
        </span>
        <div class="botoes-item">
            <button class="btn-item btn-devolver" data-id="${assoc.id}">Devolver</button>
        </div>`;
        listaUI.appendChild(li);
    });
}



function renderizarResumos() {
    // Seleciona todos os elementos do DOM para os resumos
    const totalMaquinasUI = document.getElementById('total-geral-maquinas');
    const totalPessoasUI = document.getElementById('total-pessoas');
    const totalInventarioUI = document.getElementById('total-inventario');
    const totalDisponivelUI = document.getElementById('total-disponivel');
    const totalEmUsoUI = document.getElementById('total-em-uso');
    const totalMobiliarioUI = document.getElementById('total-mobiliario');
    const totalMobiliarioDisponivelUI = document.getElementById('total-mobiliario-disponivel');
    const totalMobiliarioEmUsoUI = document.getElementById('total-mobiliario-em-uso');

    // --- Resumo de Máquinas Associadas ---
    if (totalMaquinasUI) {
        totalMaquinasUI.textContent = todasAssociacoes.length;
    }
    if (totalPessoasUI) {
        const pessoasUnicas = new Set(todasAssociacoes.map(assoc => assoc.pessoa_depto));
        totalPessoasUI.textContent = pessoasUnicas.size;
    }

    // --- Resumo do Estoque de Máquinas (Computadores) ---
    if (totalInventarioUI) {
        const maquinasNoEstoque = todoEstoque.filter(item => item.categoria.toUpperCase() === 'COMPUTADOR');
        const maquinasEmUso = maquinasNoEstoque.filter(item => item.status && item.status.toLowerCase() === 'em uso').length;
        
        totalInventarioUI.textContent = maquinasNoEstoque.length;
        totalEmUsoUI.textContent = maquinasEmUso;
        totalDisponivelUI.textContent = maquinasNoEstoque.length - maquinasEmUso;
    }

    // --- Resumo do Estoque de Mobiliário ---
    if (totalMobiliarioUI) {
        const mobiliarioNoEstoque = todoEstoque.filter(item => item.categoria.toUpperCase() === 'MOBILIARIO');
        const mobiliarioEmUso = mobiliarioNoEstoque.filter(item => item.status && item.status.toLowerCase() === 'em uso').length;

        totalMobiliarioUI.textContent = mobiliarioNoEstoque.length;
        totalMobiliarioEmUsoUI.textContent = mobiliarioEmUso;
        totalMobiliarioDisponivelUI.textContent = mobiliarioNoEstoque.length - mobiliarioEmUso;
    }
}

function renderizarGraficos() {
    const canvasPizza = document.getElementById('grafico-pizza-modelos');
    const canvasBarras = document.getElementById('grafico-barras-departamentos');
    if (!canvasPizza || !canvasBarras) return;

    // Gráfico de Pizza: Máquinas por Modelo
    const totaisPorModelo = {};
    todasAssociacoes.forEach(assoc => {
        const item = todoEstoque.find(i => i.id === assoc.item_id);
        if (item) {
            totaisPorModelo[item.modelo_tipo] = (totaisPorModelo[item.modelo_tipo] || 0) + 1;
        }
    });

    if (graficoPizza) graficoPizza.destroy();
    graficoPizza = new Chart(canvasPizza.getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(totaisPorModelo),
            datasets: [{
                data: Object.values(totaisPorModelo),
                backgroundColor: ['#3498db', '#f1c40f', '#2ecc71', '#e74c3c', '#9b59b6']
            }]
        }
    });

    // Gráfico de Barras: Empréstimos por Departamento
    const emprestimosPorDepto = {};
    todasAssociacoes.forEach(item => {
        const partes = item.pessoa_depto.split(' - ');
        if (partes.length > 1) {
            const departamento = partes[1].trim().toUpperCase();
            emprestimosPorDepto[departamento] = (emprestimosPorDepto[departamento] || 0) + 1;
        }
    });

    if (graficoBarras) graficoBarras.destroy();
    graficoBarras = new Chart(canvasBarras.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(emprestimosPorDepto),
            datasets: [{
                label: 'Nº de Empréstimos',
                data: Object.values(emprestimosPorDepto),
                backgroundColor: '#27ae60',
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

function renderizarHistorico() {
    const listaHistoricoUI = document.getElementById('lista-historico');
    if (!listaHistoricoUI) return;

    listaHistoricoUI.innerHTML = '';
    if (todoHistorico.length === 0) {
        listaHistoricoUI.innerHTML = '<li>Nenhum item encontrado no histórico.</li>';
        return;
    }

    // Ordena o histórico do mais recente para o mais antigo
    todoHistorico.sort((a, b) => new Date(b.data_devolucao) - new Date(a.data_devolucao));

    todoHistorico.forEach(item => {
        const itemInfo = todoEstoque.find(i => i.id === item.item_id);
        if (!itemInfo) return;

        const li = document.createElement('li');
        li.classList.add('item-historico');
        const dataDevolucaoFormatada = new Date(item.data_devolucao).toLocaleDateString('pt-BR');

        li.innerHTML = `
            <span>
                <strong>${item.pessoa_depto}</strong> devolveu: <em>${itemInfo.modelo_tipo}</em>
                <br><small class="patrimonio-info">Patrimônio: ${itemInfo.patrimonio}</small>
            </span>
            <span class="data-historico">Devolvido em: ${dataDevolucaoFormatada}</span>
        `;
        listaHistoricoUI.appendChild(li);
    });
}


// Função para descodificar o token JWT e obter os dados do utilizador
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

// Função para exibir as informações do utilizador na página
function exibirInfoUtilizador() {
    const infoUtilizadorUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    
    if (infoUtilizadorUI && token) {
        const dadosUtilizador = parseJwt(token);
        if (dadosUtilizador) {
            const nome = dadosUtilizador.nome || 'Utilizador';
            const depto = dadosUtilizador.departamento || 'N/D';

            // Mapa de cores por departamento
            const deptoColors = {
                'TI': { icon: '#3498db', bg: '#eaf4fc', text: '#2980b9' },
                'GAS': { icon: '#27ae60', bg: '#e9f7ef', text: '#229954' },
                'default': { icon: '#8e8e8e', bg: '#f0f0f0', text: '#5e5e5e' }
            };

            const colors = deptoColors[depto.toUpperCase()] || deptoColors['default'];

            infoUtilizadorUI.innerHTML = `
                <span>
                    <i class="fas fa-user-circle" style="color: ${colors.icon};"></i> Olá, 
                    <strong style="background-color: ${colors.bg}; color: ${colors.text};">${nome}</strong>
                    (${depto})
                </span>`;
        }
    }
}

// Abre o modal de edição e preenche com os dados da máquina
function abrirModalEditarMaquina(maquinaId) {
    const maquina = todoEstoque.find(m => m.id === maquinaId);
    if (!maquina) return;

    // Preenche o formulário com os dados atuais da máquina
    document.getElementById('editar-maquina-id').value = maquina.id;
    document.getElementById('editar-maquina-modelo').value = maquina.modelo_tipo || '';
    document.getElementById('editar-maquina-patrimonio').value = maquina.patrimonio || '';
    document.getElementById('editar-maquina-processador').value = maquina.espec_processador || '';
    document.getElementById('editar-maquina-ram').value = maquina.espec_ram || '';
    document.getElementById('editar-maquina-armazenamento').value = maquina.espec_armazenamento || '';
    document.getElementById('editar-maquina-setor').value = maquina.setor || '';
    document.getElementById('editar-maquina-observacoes').value = maquina.observacoes || '';
    document.getElementById('editar-maquina-cadastrado-gpm').checked = maquina.cadastrado_gpm || false;
    
    const modal = document.getElementById('modal-maquina');
    if(modal) modal.classList.add('visible');
}

function fecharModalEditarMaquina() {
    const modal = document.getElementById('modal-maquina');
    if(modal) modal.classList.remove('visible');
}


// Funções para o modal de Mobiliário
function abrirModalEditarMobiliario(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('editar-mobiliario-id').value = item.id;
    document.getElementById('editar-mobiliario-tipo').value = item.modelo_tipo;
    document.getElementById('editar-mobiliario-patrimonio').value = item.patrimonio;
    document.getElementById('editar-mobiliario-setor').value = item.setor;
    document.getElementById('editar-mobiliario-cadastrado-gpm').checked = item.cadastrado_gpm;

    document.getElementById('modal-mobiliario').classList.add('visible');
}

function fecharModalEditarMobiliario() {
    document.getElementById('modal-mobiliario').classList.remove('visible');
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
    const senhaAtual = document.getElementById('senha-atual').value;
    const novaSenha = document.getElementById('nova-senha').value;
    try {
        const response = await apiChangePassword(senhaAtual, novaSenha);
        alert(response.message);
        fecharModalSenha();
    } catch (error) {
        alert("Erro: " + error.message);
    }
}

async function salvarAlteracoesMobiliario(event) {
    event.preventDefault();
    const form = event.target;
    const itemId = form.querySelector('#editar-mobiliario-id').value;

    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-mobiliario-tipo').value.trim(),
        patrimonio: form.querySelector('#editar-mobiliario-patrimonio').value.trim(),
        setor: form.querySelector('#editar-mobiliario-setor').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-mobiliario-cadastrado-gpm').checked,
        categoria: 'MOBILIARIO' // Garante que a categoria não se perca
    };

    try {
        await updateItem(itemId, dadosAtualizados);
        Toastify({ text: "Mobiliário atualizado com sucesso!" }).showToast();
        fecharModalEditarMobiliario();
        carregarDados();
    } catch (error) {
        console.error("Erro ao atualizar mobiliário:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}


function abrirModalEditarMonitor(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('editar-monitor-id').value = item.id;
    document.getElementById('editar-monitor-modelo').value = item.modelo_tipo;
    document.getElementById('editar-monitor-patrimonio').value = item.patrimonio;
    document.getElementById('editar-monitor-setor').value = item.setor;
    document.getElementById('editar-monitor-cadastrado-gpm').checked = item.cadastrado_gpm;

    document.getElementById('modal-monitor').classList.add('visible');
}

function fecharModalEditarMonitor() {
    document.getElementById('modal-monitor').classList.remove('visible');
}

async function salvarAlteracoesMonitor(event) {
    event.preventDefault();
    const form = event.target;
    const itemId = form.querySelector('#editar-monitor-id').value;

    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-monitor-modelo').value.trim(),
        patrimonio: form.querySelector('#editar-monitor-patrimonio').value.trim(),
        setor: form.querySelector('#editar-monitor-setor').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-monitor-cadastrado-gpm').checked,
        categoria: 'MONITOR'
    };

    try {
        await updateItem(itemId, dadosAtualizados);
        Toastify({ text: "Monitor atualizado com sucesso!" }).showToast();
        fecharModalEditarMonitor();
        carregarDados();
    } catch (error) {
        console.error("Erro ao atualizar monitor:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

function abrirModalEditarOutros(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('editar-outros-id').value = item.id;
    document.getElementById('editar-outros-modelo').value = item.modelo_tipo;
    document.getElementById('editar-outros-patrimonio').value = item.patrimonio;
    document.getElementById('editar-outros-setor').value = item.setor;
    document.getElementById('editar-outros-cadastrado-gpm').checked = item.cadastrado_gpm;

    document.getElementById('modal-outros').classList.add('visible');
}

function fecharModalEditarOutros() {
    document.getElementById('modal-outros').classList.remove('visible');
}

async function salvarAlteracoesOutros(event) {
    event.preventDefault();
    const form = event.target;
    const itemId = form.querySelector('#editar-outros-id').value;

    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-outros-modelo').value.trim(),
        patrimonio: form.querySelector('#editar-outros-patrimonio').value.trim(),
        setor: form.querySelector('#editar-outros-setor').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-outros-cadastrado-gpm').checked,
        categoria: 'OUTROS'
    };

    try {
        await updateItem(itemId, dadosAtualizados);
        Toastify({ text: "Item atualizado com sucesso!" }).showToast();
        fecharModalEditarOutros();
        carregarDados();
    } catch (error) {
        console.error("Erro ao atualizar item:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

function abrirModalEspecificacoes(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('modal-especificacoes');
    if(!modal) return;

    modal.querySelector('#spec-modelo').textContent = item.modelo_tipo;
    const listaSpecs = modal.querySelector('#spec-lista');
    
    listaSpecs.innerHTML = `
        <li><strong>Património:</strong>${formatarPatrimonio(item.patrimonio) || 'N/P'}</li>
        <li><strong>Processador:</strong> ${item.espec_processador || 'N/P'}</li>
        <li><strong>Memória RAM:</strong> ${item.espec_ram || 'N/P'}</li>
        <li><strong>Armazenamento:</strong> ${item.espec_armazenamento || 'N/P'}</li>
        ${item.observacoes ? `<li><strong>Observações:</strong> ${item.observacoes}</li>` : ''}
    `;
    modal.classList.add('visible');
}

function fecharModalEspecificacoes() {
    const modal = document.getElementById('modal-especificacoes');
    if (modal) modal.classList.remove('visible');
}

function exportarParaCSV() {
    if (todasAssociacoes.length === 0) {
        Toastify({ text: "Não há dados para exportar." }).showToast();
        return;
    }

    // Cabeçalho do ficheiro CSV
    const cabecalho = ['Pessoa', 'Departamento', 'Maquina', 'Patrimonio', 'Data Emprestimo'];

    // Mapeia os dados das associações para o formato de linha do CSV
    const linhas = todasAssociacoes.map(assoc => {
        const item = todoEstoque.find(i => i.id === assoc.item_id);
        if (!item) return null; // Ignora se o item não for encontrado

        const [nome, departamento = 'N/D'] = assoc.pessoa_depto.split(' - ');
        const maquina = item.modelo_tipo;
        const patrimonio = item.patrimonio || 'N/A';
        const dataEmprestimo = new Date(assoc.data_emprestimo).toLocaleDateString('pt-BR');

        return [nome.trim(), departamento.trim(), maquina, patrimonio, dataEmprestimo];
    }).filter(linha => linha !== null); // Remove linhas nulas

    // Cria o conteúdo do ficheiro CSV
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + cabecalho.join(";") + "\n" 
        + linhas.map(e => e.join(";")).join("\n");

    // Cria um link de download e simula um clique
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_maquinas_associadas_${new Date().toLocaleDateString('pt-BR')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


function exportarMobiliarioCSV() {
    if (todasAssociacoesMobiliario.length === 0) {
        Toastify({ text: "Não há dados de mobiliário para exportar." }).showToast();
        return;
    }

    const cabecalho = ['Pessoa', 'Departamento', 'Tipo', 'Patrimonio', 'Data Associação'];
    const linhas = todasAssociacoesMobiliario.map(assoc => {
        const item = todoEstoque.find(i => i.id === assoc.item_id);
        if (!item) return null;

        const [nome, departamento = 'N/D'] = assoc.pessoa_depto.split(' - ');
        const dataAssociacao = new Date(assoc.data_emprestimo).toLocaleDateString('pt-BR');
        
        return [nome.trim(), departamento.trim(), item.modelo_tipo, item.patrimonio, dataAssociacao];
    }).filter(Boolean);

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + cabecalho.join(";") + "\n" 
        + linhas.map(e => e.join(";")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_mobiliario_${new Date().toLocaleDateString('pt-BR')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


async function abrirModalHistorico(itemId) {
    const modal = document.getElementById('modal-historico');
    const listaUI = document.getElementById('historico-lista');
    const tituloUI = document.getElementById('historico-titulo');
    if (!modal || !listaUI || !tituloUI) return;

    const item = todoEstoque.find(i => i.id === itemId);
    tituloUI.textContent = `Histórico de: ${item.modelo_tipo} (${item.patrimonio})`;
    listaUI.innerHTML = '<li>A carregar...</li>';
    modal.classList.add('visible');

    try {
        const historico = await getItemHistory(itemId);
        listaUI.innerHTML = '';
        if (historico.length === 0) {
            listaUI.innerHTML = '<li>Este item não possui histórico de empréstimos.</li>';
            return;
        }

        historico.forEach(reg => {
            const li = document.createElement('li');
            const dataEmprestimo = new Date(reg.data_emprestimo).toLocaleDateString('pt-BR');
            const dataDevolucao = reg.data_devolucao ? new Date(reg.data_devolucao).toLocaleDateString('pt-BR') : 'Em uso';
            
            li.innerHTML = `
                <strong>Utilizador:</strong> ${reg.pessoa_depto} <br>
                <small>Emprestado em: ${dataEmprestimo} | Devolvido em: ${dataDevolucao}</small>
            `;
            listaUI.appendChild(li);
        });
    } catch (error) {
        listaUI.innerHTML = '<li>Ocorreu um erro ao carregar o histórico.</li>';
        console.error("Erro ao buscar histórico:", error);
    }
}

function fecharModalHistorico() {
    const modal = document.getElementById('modal-historico');
    if (modal) modal.classList.remove('visible');
}

// =================================================================
// 5. FUNÇÕES DE MANIPULAÇÃO DE DADOS (CRUD)
// =================================================================

async function salvarAtivoEstoque(event) {
    event.preventDefault();
    const form = event.target;
    const categoria = form.querySelector('#estoque-categoria').value;

    const dados = {
        categoria: categoria,
        modelo_tipo: form.querySelector('#estoque-modelo').value.trim(),
        patrimonio: form.querySelector('#estoque-patrimonio').value.trim(),
        setor: form.querySelector('#estoque-setor').value.trim(),
        estado_conservacao: form.querySelector('#estoque-estado').value,
        observacoes: form.querySelector('#estoque-observacoes').value.trim(),
        cadastrado_gpm: form.querySelector('#maquina-cadastrado-gpm').checked
    };

    // Adiciona os campos específicos apenas se a categoria for "COMPUTADOR"
    if (categoria === 'COMPUTADOR') {
        dados.espec_processador = form.querySelector('#estoque-processador').value.trim();
        dados.espec_ram = form.querySelector('#estoque-ram').value.trim();
        dados.espec_armazenamento = form.querySelector('#estoque-armazenamento').value.trim();
    }

    try {
        await createItem(dados);
        Toastify({ text: "Ativo adicionado ao estoque!" }).showToast();
        form.reset();
        document.getElementById('campos-especificos-computador').style.display = 'block'; // Garante que os campos voltem a aparecer
        carregarDados();
    } catch (error) {
        console.error("Erro ao adicionar ativo:", error);
        Toastify({ text: `Erro: ${error.message}` }).showToast();
    }
}

async function salvarMobiliario(event) {
    event.preventDefault();
    const form = event.target;
    const dados = {
        modelo_tipo: form.querySelector('#mobiliario-tipo').value.trim(),
        patrimonio: form.querySelector('#mobiliario-patrimonio').value.trim(),
        setor: form.querySelector('#mobiliario-material').value.trim(),
        // ADICIONADOS:
        estado_conservacao: form.querySelector('#mobiliario-estado').value.trim(),
        // FIM DOS ADICIONADOS
        categoria: 'MOBILIARIO',
        cadastrado_gpm: form.querySelector('#mobiliario-cadastrado-outro-software').checked
    };

    try {
        await createItem(dados);
        Toastify({ text: "Mobiliário adicionado ao inventário!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        form.reset();
        carregarDados();
    } catch (error) {
        console.error("Erro ao adicionar mobiliário:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

async function salvarAssociacao(event) {
    event.preventDefault();
    const pessoa = document.getElementById('nome-pessoa').value.trim();
    const itemId = document.getElementById('id-maquina-emprestimo').value;

    if (!pessoa || !itemId) {
        alert("Pessoa e Máquina são obrigatórios.");
        return;
    }

    //  Pega os IDs do novo Set de monitores
    const dadosEmprestimo = {
        item_id: parseInt(itemId),
        pessoa_depto: pessoa,
        monitores_ids: Array.from(monitoresSelecionadosIds) // Converte o Set para um Array
    };

    try {
        await createEmprestimo(dadosEmprestimo);
        Toastify({ text: "Empréstimo registado com sucesso!" }).showToast();
        document.getElementById('form-maquina').reset();
        document.getElementById('monitores-selecionados-container').innerHTML = ''; // Limpa as etiquetas
        monitoresSelecionadosIds.clear(); // Limpa o Set de IDs
        carregarDados();
    } catch (error) {
        console.error("Erro ao salvar associação:", error);
        Toastify({ text: `Erro: ${error.message}` }).showToast();
    }
}


async function salvarAssociacaoMobiliario(event) {
    event.preventDefault();
    const form = document.getElementById('form-associar-mobiliario');
    const pessoa = form.querySelector('#nome-pessoa-mobiliario').value.trim();
    const itemId = form.querySelector('#id-mobiliario-emprestimo').value;

    if (!pessoa || !itemId) {
        Toastify({ text: "Pessoa e Mobiliário são obrigatórios." }).showToast();
        return;
    }

    try {
        await createEmprestimo({ item_id: parseInt(itemId), pessoa_depto: pessoa });
        Toastify({ text: "Associação de mobiliário registada com sucesso!" }).showToast();
        form.reset();
        carregarDados();
    } catch (error) {
        console.error("Erro ao salvar associação de mobiliário:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}


async function salvarAlteracoesMaquina(event) {
    event.preventDefault();
    const form = event.target;
    const maquinaId = form.querySelector('#editar-maquina-id').value;

    // Cria o objeto de dados com os nomes dos campos que a API espera
    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-maquina-modelo').value.trim(),
        patrimonio: form.querySelector('#editar-maquina-patrimonio').value.trim(),
        espec_processador: form.querySelector('#editar-maquina-processador').value.trim(),
        espec_ram: form.querySelector('#editar-maquina-ram').value.trim(),
        espec_armazenamento: form.querySelector('#editar-maquina-armazenamento').value.trim(),
        setor: form.querySelector('#editar-maquina-setor').value.trim(),
        observacoes: form.querySelector('#editar-maquina-observacoes').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-maquina-cadastrado-gpm').checked,
    };

    try {
        // Usa a função updateItem da nossa API
        await updateItem(maquinaId, dadosAtualizados);
        
        Toastify({ text: "Dados da máquina atualizados com sucesso!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        
        fecharModalEditarMaquina(); // Fecha o modal após o sucesso
        carregarDados(); // Recarrega os dados para mostrar as alterações na lista
    } catch (error) {
        console.error("Erro ao atualizar máquina:", error);
        Toastify({ text: `Erro ao atualizar: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

async function salvarOutroAtivo(event) {
    event.preventDefault();
    const form = event.target;

    const dados = {
        modelo_tipo: form.querySelector('#outros-modelo').value.trim(),
        patrimonio: form.querySelector('#outros-patrimonio').value.trim(),
        setor: form.querySelector('#outros-setor').value.trim(),
        // ADICIONADOS:
        estado_conservacao: form.querySelector('#outros-estado').value.trim(),
        // FIM DOS ADICIONADOS
        cadastrado_gpm: form.querySelector('#outros-cadastrado-gpm').checked,
        categoria: 'OUTROS'
    };

    try {
        await createItem(dados);
        Toastify({ text: "Item adicionado com sucesso!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        form.reset();
        carregarDados();
    } catch(error) {
        console.error("Erro ao adicionar item:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

async function devolverMaquina(emprestimoId) {
    try {
        await devolverEmprestimo(emprestimoId);
        Toastify({ text: "Máquina devolvida!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        carregarDados();
    } catch (error) {
        console.error("Erro ao devolver máquina:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

async function devolverMobiliario(emprestimoId) {
    try {
        await devolverEmprestimo(emprestimoId);
        Toastify({ text: "Mobiliário devolvido!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        carregarDados();
    } catch (error) {
        console.error("Erro ao devolver mobiliário:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}


async function excluirMaquinaEstoque(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    const nomeItem = item ? item.modelo_tipo : 'este item';

    exibirModalConfirmacao(`Tem a certeza que deseja excluir "${nomeItem}" permanentemente?`, async () => {
        try {
            await deleteItem(itemId);
            Toastify({ text: "Item excluído com sucesso!" }).showToast();
            carregarDados();
        } catch (error) {
            console.error("Erro ao excluir:", error);
            Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
        }
    });
}

// NOVA FUNÇÃO para exibir o modal de confirmação
function exibirModalConfirmacao(mensagem, onConfirm) {
    const modal = document.getElementById('modal-confirmacao');
    const textoModal = document.getElementById('modal-texto');
    const btnConfirmar = document.getElementById('btn-modal-confirmar');
    const btnCancelar = document.getElementById('btn-modal-cancelar');

    textoModal.textContent = mensagem;
    modal.classList.add('visible');

    // Função para fechar o modal
    const fecharModal = () => modal.classList.remove('visible');

    // Configura o clique no botão de confirmar (apenas uma vez)
    btnConfirmar.onclick = () => {
        fecharModal();
        onConfirm(); // Executa a ação que foi passada (ex: a exclusão)
    };

    // Configura o clique no botão de cancelar
    btnCancelar.onclick = fecharModal;
}


// FUNÇÃO para adicionar uma etiqueta de monitor
function adicionarMonitorTag(monitor) {
    if (monitoresSelecionadosIds.has(monitor.id)) {
        Toastify({ text: "Este monitor já foi adicionado." }).showToast();
        return;
    }

    monitoresSelecionadosIds.add(monitor.id);

    const container = document.getElementById('monitores-selecionados-container');
    const tag = document.createElement('div');
    tag.className = 'monitor-tag';
    tag.dataset.id = monitor.id;
    tag.innerHTML = `
        <span>${monitor.modelo_tipo}</span>
        <button class="remove-monitor" type="button">&times;</button>
    `;
    container.appendChild(tag);
}

//  FUNÇÃO para remover uma etiqueta de monitor
function removerMonitorTag(tagElement) {
    const id = parseInt(tagElement.dataset.id);
    monitoresSelecionadosIds.delete(id);
    tagElement.remove();
}

function mostrarResultados(resultados, resultadosDiv, inputBusca, inputId) {
    resultadosDiv.innerHTML = '';
    if (resultados.length === 0) {
        resultadosDiv.style.display = 'none';
        return;
    }

    resultados.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('autocomplete-item');
        itemDiv.textContent = `${item.modelo_tipo} (Património: ${formatarPatrimonio(item.patrimonio)})`;
        
        // Ação de clique num resultado
        itemDiv.addEventListener('click', () => {
            inputBusca.value = item.modelo_tipo; // Preenche o campo de busca com o nome
            inputId.value = item.id; // Guarda o ID no campo escondido
            resultadosDiv.style.display = 'none'; // Esconde a lista de resultados
        });
        
        resultadosDiv.appendChild(itemDiv);
    });

    resultadosDiv.style.display = 'block';
}

// Lógica para a busca de Máquina
const buscaMaquinaInput = document.getElementById('busca-maquina');
const maquinaResultadosDiv = document.getElementById('maquina-resultados');
const maquinaIdInput = document.getElementById('id-maquina-emprestimo');

if (buscaMaquinaInput) {
    buscaMaquinaInput.addEventListener('input', () => {
        const termoBusca = buscaMaquinaInput.value.toLowerCase();
        maquinaIdInput.value = '';
        if (termoBusca.length < 2) {
            maquinaResultadosDiv.style.display = 'none';
            return;
        }
        const maquinasDisponiveis = todoEstoque.filter(item =>
            item.categoria === 'COMPUTADOR' && item.status === 'Disponível'
        );
        const resultados = maquinasDisponiveis.filter(maquina =>
            maquina.modelo_tipo.toLowerCase().includes(termoBusca) ||
            maquina.patrimonio.toLowerCase().includes(termoBusca)
        );
        mostrarResultados(resultados, maquinaResultadosDiv, buscaMaquinaInput, maquinaIdInput);
    });
}

// Lógica para a busca de Mobiliário
const buscaMobiliarioInput = document.getElementById('busca-mobiliario');
const mobiliarioResultadosDiv = document.getElementById('mobiliario-resultados');
const mobiliarioIdInput = document.getElementById('id-mobiliario-emprestimo');

if (buscaMobiliarioInput) {
    buscaMobiliarioInput.addEventListener('input', () => {
        const termoBusca = buscaMobiliarioInput.value.toLowerCase();
        mobiliarioIdInput.value = '';
        if (termoBusca.length < 2) {
            mobiliarioResultadosDiv.style.display = 'none';
            return;
        }
        const mobiliarioDisponivel = todoEstoque.filter(item =>
            item.categoria === 'MOBILIARIO' && item.status === 'Disponível'
        );
        const resultados = mobiliarioDisponivel.filter(item =>
            item.modelo_tipo.toLowerCase().includes(termoBusca) ||
            item.patrimonio.toLowerCase().includes(termoBusca)
        );
        mostrarResultados(resultados, mobiliarioResultadosDiv, buscaMobiliarioInput, mobiliarioIdInput);
    });
}

// Esconde os resultados se o utilizador clicar fora
document.addEventListener('click', function(event) {
    if (!event.target.closest('.autocomplete-container')) {
        if (maquinaResultadosDiv) maquinaResultadosDiv.style.display = 'none';
        if (mobiliarioResultadosDiv) mobiliarioResultadosDiv.style.display = 'none';
        // A lógica para esconder os resultados de monitores já deve estar no seu ficheiro
    }
});



// =================================================================
// 6. FUNÇÕES AUXILIARES E EVENT LISTENERS
// =================================================================



function popularDropdownMonitores() {
    const monitoresSelect = document.getElementById('id-monitores-emprestimo');
    if (!monitoresSelect) return;

    monitoresSelect.innerHTML = ''; // Limpa opções antigas

    // Filtra o estoque para obter apenas monitores que estão disponíveis
    const monitoresDisponiveis = todoEstoque.filter(item =>
        item.categoria === 'MONITOR' && item.status === 'Disponível'
    );

    // Adiciona cada monitor disponível como uma opção na lista
    if (monitoresDisponiveis.length === 0) {
        monitoresSelect.innerHTML = '<option disabled>Nenhum monitor disponível</option>';
    } else {
        monitoresDisponiveis.forEach(monitor => {
            const option = document.createElement('option');
            option.value = monitor.id;
            option.textContent = `${monitor.modelo_tipo} (Património: ${formatarPatrimonio(monitor.patrimonio)})`;
            monitoresSelect.appendChild(option);
        });
    }
};

// Função para preencher o dropdown de modelos
function popularDropdownModelos() {
    const modeloSelect = document.getElementById('estoque-modelo');
    if (!modeloSelect) return;

    modeloSelect.innerHTML = '<option value="">-- Selecione um modelo --</option>'; // Limpa opções antigas

    todosModelos.forEach(modelo => {
        const option = document.createElement('option');
        option.value = modelo.nome_modelo; // O valor será o nome do modelo
        option.textContent = `${modelo.nome_modelo} (${modelo.fabricante || 'N/A'})`;
        modeloSelect.appendChild(option);
    });
}

// Função para salvar um novo modelo
async function salvarNovoModelo(event) {
    event.preventDefault();
    const form = event.target;
    const nomeModelo = form.querySelector('#novo-modelo-nome').value.trim();
    const fabricante = form.querySelector('#novo-modelo-fabricante').value.trim();

    try {
        await createModelo({ nome_modelo: nomeModelo, fabricante: fabricante });
        Toastify({ text: "Novo modelo adicionado com sucesso!" }).showToast();
        form.reset();
        // Recarrega os dados para que o novo modelo apareça no dropdown
        carregarDados();
    } catch (error) {
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}


function popularFiltroDepartamentos() {
    const filtroUI = document.getElementById('filtro-departamento');
    if (!filtroUI) return;

    // Extrai departamentos únicos das associações
    const departamentos = [... new Set(todasAssociacoes.map(assoc => {
        const partes = assoc.pessoa_depto.split(' - ');
        return partes.length > 1 ? partes[1].trim().toUpperCase() : 'N/D';
    }))].filter(Boolean).sort(); // Remove entradas vazias e ordena

    // Limpa opções antigas
    filtroUI.innerHTML = '<option value="">-- Todos os Departamentos --</option>';

    // Adiciona cada departamento como uma opção no dropdown
    departamentos.forEach(depto => {
        const option = document.createElement('option');
        option.value = depto;
        option.textContent = depto;
        filtroUI.appendChild(option);
    });
};


function popularFiltroDepartamentosMobiliario() {
    const filtroUI = document.getElementById('filtro-departamento');
    // A função só executa se o filtro estiver na página atual
    if (!filtroUI || !window.location.pathname.includes('lista_mobiliario.html')) return;

    const departamentos = [...new Set(todasAssociacoesMobiliario.map(assoc => {
        const partes = assoc.pessoa_depto.split(' - ');
        return partes.length > 1 ? partes[1].trim() : null;
    }))].filter(Boolean).sort();

    filtroUI.innerHTML = '<option value="">-- Todos os Departamentos --</option>';

    departamentos.forEach(depto => {
        const option = document.createElement('option');
        option.value = depto;
        option.textContent = depto;
        filtroUI.appendChild(option);
    });
}
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

// =================================================================
// 7. CÓDIGO EXECUTADO QUANDO A PÁGINA CARREGA
// =================================================================

// Inicia a verificação de autenticação assim que o script carrega
checkAuth();

document.addEventListener('DOMContentLoaded', () => {
    // 1. VERIFICAÇÃO DE AUTENTICAÇÃO
    if (!localStorage.getItem('authToken') && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }
    carregarDados();

    // 2. LÓGICA DO MENU LATERAL
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // 3. EVENT LISTENERS PARA BOTÕES NA BARRA LATERAL
    const btnLogoutSidebar = document.getElementById('btn-logout-sidebar');
    if (btnLogoutSidebar) {
        btnLogoutSidebar.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }

    const submenuParent = document.querySelector('.has-submenu');
    if (submenuParent) {
        // Lógica para abrir/fechar ao clicar
        submenuParent.querySelector('a').addEventListener('click', function(event) {
            event.preventDefault();
            submenuParent.classList.toggle('open');
        });

        // Lógica para verificar se deve começar aberto
        const currentPage = window.location.pathname;
        const submenuLinks = submenuParent.querySelectorAll('.submenu a');
        submenuLinks.forEach(link => {
            if (currentPage.includes(link.getAttribute('href'))) {
                submenuParent.classList.add('open');
            }
        });
    }

    document.querySelectorAll('.submenu a').forEach(submenuLink => {
        submenuLink.addEventListener('click', function() {
            const parentLi = this.closest('.has-submenu');
            if (parentLi) {
                parentLi.classList.remove('open');
            }
        });
    })
    const btnMudarSenhaSidebar = document.getElementById('btn-mudar-senha-sidebar');
    if (btnMudarSenhaSidebar) {
        btnMudarSenhaSidebar.addEventListener('click', abrirModalSenha);
    }

    // 4. LISTENERS PARA FORMULÁRIOS E CAMPOS DE BUSCA
    const formPrincipal = document.getElementById('form-maquina');
    if (formPrincipal) formPrincipal.addEventListener('submit', salvarAssociacao);
    
    const formEstoque = document.getElementById('form-estoque');
    if (formEstoque) formEstoque.addEventListener('submit', salvarAtivoEstoque);
    
    const categoriaSelect = document.getElementById('estoque-categoria');
    if (categoriaSelect) {
        categoriaSelect.addEventListener('change', (event) => {
            const camposComputador = document.getElementById('campos-especificos-computador');
            camposComputador.style.display = (event.target.value === 'COMPUTADOR') ? 'block' : 'none';
        });
    }

    const buscaMonitorInput = document.getElementById('busca-monitor');
    const monitorResultadosDiv = document.getElementById('monitor-resultados');
    if (buscaMonitorInput) {
        buscaMonitorInput.addEventListener('input', () => {
            const termoBusca = buscaMonitorInput.value.toLowerCase();
            if (termoBusca.length < 2) {
                monitorResultadosDiv.style.display = 'none';
                return;
            }
            const monitoresDisponiveis = todoEstoque.filter(item =>
                item.categoria === 'MONITOR' && item.status === 'Disponível' && !monitoresSelecionadosIds.has(item.id)
            );
            const resultados = monitoresDisponiveis.filter(monitor =>
                monitor.modelo_tipo.toLowerCase().includes(termoBusca) || monitor.patrimonio.toLowerCase().includes(termoBusca)
            );
            monitorResultadosDiv.innerHTML = '';
            if (resultados.length > 0) {
                resultados.forEach(monitor => {
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('autocomplete-item');
                    itemDiv.textContent = `${monitor.modelo_tipo} (Património: ${formatarPatrimonio(monitor.patrimonio)})`;
                    itemDiv.addEventListener('click', () => {
                        adicionarMonitorTag(monitor);
                        buscaMonitorInput.value = '';
                        monitorResultadosDiv.style.display = 'none';
                    });
                    monitorResultadosDiv.appendChild(itemDiv);
                });
                monitorResultadosDiv.style.display = 'block';
            } else {
                monitorResultadosDiv.style.display = 'none';
            }
        });
    }

    // 5. LISTENERS PARA MODAIS E BOTÕES DINÂMICOS
    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if(btnSenhaCancelar) btnSenhaCancelar.addEventListener('click', fecharModalSenha);

    const btnFecharSpec = document.getElementById('btn-spec-fechar');
    if(btnFecharSpec) btnFecharSpec.addEventListener('click', fecharModalEspecificacoes);

    const btnFecharHistorico = document.getElementById('btn-historico-fechar');
    if(btnFecharHistorico) btnFecharHistorico.addEventListener('click', fecharModalHistorico);

    const btnCancelarEdicaoMaquina = document.getElementById('btn-editar-maquina-cancelar');
    if(btnCancelarEdicaoMaquina) btnCancelarEdicaoMaquina.addEventListener('click', fecharModalEditarMaquina);

    const btnCancelarEdicaoMobiliario = document.getElementById('btn-editar-mobiliario-cancelar');
    if(btnCancelarEdicaoMobiliario) btnCancelarEdicaoMobiliario.addEventListener('click', fecharModalEditarMobiliario);

    const btnCancelarEdicaoMonitor = document.getElementById('btn-editar-monitor-cancelar');
    if(btnCancelarEdicaoMonitor) btnCancelarEdicaoMonitor.addEventListener('click', fecharModalEditarMonitor);

    const btnCancelarEdicaoOutros = document.getElementById('btn-editar-outros-cancelar');
    if(btnCancelarEdicaoOutros) btnCancelarEdicaoOutros.addEventListener('click', fecharModalEditarOutros);

    const formMudarSenha = document.getElementById('form-mudar-senha');
    if(formMudarSenha) formMudarSenha.addEventListener('submit', mudarSenha);

    document.body.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-monitor')) {
            const tagElement = event.target.closest('.monitor-tag');
            if (tagElement) removerMonitorTag(tagElement);
        }
        document.body.addEventListener('click', (event) => {
    const target = event.target;
    if (target.disabled) return;
    
    // Lógica para remover a etiqueta do monitor
    if (target.classList.contains('remove-monitor')) {
        const tagElement = target.closest('.monitor-tag');
        if (tagElement) {
            removerMonitorTag(tagElement);
        }
        return; // Para a execução para não procurar por 'data-id'
    }

    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('btn-historico')) {
        abrirModalHistorico(parseInt(id));

    } else if (target.classList.contains('btn-editar-estoque')) {
        const itemParaEditar = todoEstoque.find(i => i.id == id);
        if (itemParaEditar) {
            // Verifica a categoria do item e chama a função do modal correto
            if (itemParaEditar.categoria.toUpperCase() === 'COMPUTADOR') {
                abrirModalEditarMaquina(parseInt(id));
            } else if (itemParaEditar.categoria.toUpperCase() === 'MOBILIARIO') {
                abrirModalEditarMobiliario(parseInt(id));
            } else if (itemParaEditar.categoria.toUpperCase() === 'MONITOR') {
              abrirModalEditarMonitor(parseInt(id)); 
            } else if (itemParaEditar.categoria.toUpperCase() === 'OUTROS') {
                abrirModalEditarOutros(parseInt(id));
            }
        }
    } else if (target.classList.contains('spec-link')) {
        event.preventDefault();
        abrirModalEspecificacoes(parseInt(id));
    } else if (target.classList.contains('btn-devolver')) {
        devolverMaquina(parseInt(id)); // Esta função já deve tratar de mobiliário também
    } else if (target.classList.contains('btn-excluir-estoque')) {
        excluirMaquinaEstoque(parseInt(id));
    }
});
    });
});