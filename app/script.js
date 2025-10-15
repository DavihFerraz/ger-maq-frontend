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
    getItemHistory,
    getSetores,
    registrarSaidaAlmoxarifado,
    getHistoricoItemAlmoxarifado,
    devolverItemAlmoxarifado
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
let mapaDeUso = {}; 

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

// Substitua a sua função carregarDados por esta versão de diagnóstico
async function carregarDados() {
    exibirInfoUtilizador();
    try {
        const [itens, emprestimos] = await Promise.all([getItens(), getEmprestimos()]);
        todoEstoque = itens;
        todasAssociacoes = emprestimos.filter(e => !e.data_devolucao);

        // Cria um mapa de cada item em uso e quem o está a usar
        mapaDeUso = {};
        todasAssociacoes.forEach(emp => {
            // Mapeia o item principal
            if (emp.item_id) {
                mapaDeUso[emp.item_id] = emp.pessoa_depto;
            }
            // Mapeia TODOS os monitores associados
            if (Array.isArray(emp.monitores_associados_ids)) {
                emp.monitores_associados_ids.forEach(monitorId => {
                    mapaDeUso[monitorId] = emp.pessoa_depto;
                });
            }
        });

        renderizarEstoque();
        renderizarMobiliario();
        renderizarOutrosAtivos();
        renderizarAlmoxarifado();
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// =================================================================
// 4. FUNÇÕES DE RENDERIZAÇÃO
// =================================================================

function renderizarTudo() {
    // Estas funções dependem da sua implementação de HTML e CSS.
    // Adapte os nomes dos campos se necessário (ex: .modelo para .modelo_tipo)
    renderizarEstoque();
    renderizarMobiliario();
    renderizarResumos();
    renderizarGraficos();
    renderizarHistorico();
    popularDropdownMonitores();
    renderizarOutrosAtivos();
}

function renderizarEstoque() {
    const listaEstoqueUI = document.getElementById('lista-estoque');
    if (!listaEstoqueUI) return;

    const todoMaquinasMonitores = todoEstoque.filter(item => item.categoria === 'COMPUTADOR' || item.categoria === 'MONITOR');
    
    const termoBusca = (document.getElementById('campo-busca-estoque')?.value || '').toLowerCase();
    const filtroSetor = document.getElementById('filtro-setor-estoque')?.value;
    const filtroGPM = document.getElementById('filtro-gpm-estoque')?.value;
    const filtroStatus = document.getElementById('filtro-status-estoque')?.value;

    let estoqueParaRenderizar = todoMaquinasMonitores.filter(item => {
        const nomeUtilizador = (mapaDeUso[item.id] || '').toLowerCase();
        const buscaOk = termoBusca === '' || `${item.modelo_tipo} ${item.patrimonio} ${item.categoria} ${nomeUtilizador}`.toLowerCase().includes(termoBusca);
        const setorOk = !filtroSetor || item.setor_id == filtroSetor;
        const gpmOk = !filtroGPM || (filtroGPM === 'sim' && item.cadastrado_gpm) || (filtroGPM === 'nao' && !item.cadastrado_gpm);
        const statusOk = !filtroStatus || item.status === filtroStatus;
        return buscaOk && setorOk && gpmOk && statusOk;
    });

    estoqueParaRenderizar.sort((a, b) => a.modelo_tipo.localeCompare(b.modelo_tipo));
    listaEstoqueUI.innerHTML = '';
    if (estoqueParaRenderizar.length === 0) {
        listaEstoqueUI.innerHTML = '<li>Nenhum item encontrado com os filtros aplicados.</li>';
        return;
    }

    estoqueParaRenderizar.forEach(item => {
        const estaEmUso = item.status === 'Em Uso';
        let detalhesHtml = '';
        let utilizadorHtml = '';
        let botaoInativarHtml = '';

        if (mapaDeUso[item.id]) {
            const nomePessoa = mapaDeUso[item.id].split(' - ')[0];
            utilizadorHtml = `<br><small class="user-info">Utilizador: <strong>${nomePessoa}</strong></small>`;
        }

        if (item.categoria === 'COMPUTADOR') {
            detalhesHtml = `<br><small>Processador: ${item.espec_processador || 'N/A'}</small><br><small>RAM: ${item.espec_ram || 'N/A'}</small><br><small>Armazenamento: ${item.espec_armazenamento || 'N/A'}</small>`;
        }
        
        if (item.status === 'Inativo') {
            botaoInativarHtml = `<button class="btn-item btn-reativar" data-id="${item.id}">Reativar</button>`;
        } else {
            botaoInativarHtml = `<button class="btn-item btn-inativar" data-id="${item.id}" ${estaEmUso ? 'disabled' : ''}>Inativar</button>`;
        }

        const li = document.createElement('li');
        const statusClass = item.status ? item.status.toLowerCase().replace(/ /g, '-') : 'desconhecido';
        li.classList.add(`status-${statusClass}`);
        
        const botoesHTML = `
            <button class="btn-item btn-historico" data-id="${item.id}">Histórico</button>
            ${botaoInativarHtml}
            <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
            <button class="btn-item btn-excluir-estoque" data-id="${item.id}" ${estaEmUso || item.status === 'Inativo' ? 'disabled' : ''}>Excluir</button>
        `;
        
        const statusGASCadastroHTML = item.cadastrado_gpm ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>` : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;
        
        li.innerHTML = `
    <div class="info-item">
        <span>
            <strong>${item.modelo_tipo}</strong> (Património: ${formatarPatrimonio(item.patrimonio)})
            <br><small>Categoria: ${item.categoria}</small>
            <br><small>Setor: ${item.setor_nome || 'N/A'}</small>
            <br><small>Estado: ${item.estado_conservacao || 'N/A'}</small>
            ${utilizadorHtml} 
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

    const todoMobiliario = todoEstoque.filter(item => item.categoria === 'MOBILIARIO');

    const termoBusca = (document.getElementById('campo-busca-mobiliario')?.value || '').toLowerCase();
    const filtroSetor = document.getElementById('filtro-setor-mobiliario')?.value;
    const filtroGPM = document.getElementById('filtro-gpm-mobiliario')?.value;
    const filtroStatus = document.getElementById('filtro-status-mobiliario')?.value;

    let mobiliarioParaRenderizar = todoMobiliario.filter(item => {
        const buscaOk = termoBusca === '' || `${item.modelo_tipo} ${item.patrimonio}`.toLowerCase().includes(termoBusca);
        const setorOk = !filtroSetor || item.setor_id == filtroSetor;
        const gpmOk = !filtroGPM || (filtroGPM === 'sim' && item.cadastrado_gpm) || (filtroGPM === 'nao' && !item.cadastrado_gpm);
        const statusOk = !filtroStatus || item.status === filtroStatus;
        return buscaOk && setorOk && gpmOk && statusOk;
    });

    listaMobiliarioUI.innerHTML = '';
    if (mobiliarioParaRenderizar.length === 0) {
        listaMobiliarioUI.innerHTML = '<li>Nenhum mobiliário encontrado com os filtros aplicados.</li>';
        return;
    }

    mobiliarioParaRenderizar.sort((a, b) => a.modelo_tipo.localeCompare(b.modelo_tipo));
    
    mobiliarioParaRenderizar.forEach(item => {
        const estaEmUso = item.status === 'Em Uso';
        let utilizadorHtml = '';
        let botaoInativarHtml = '';

        if (mapaDeUso[item.id]) {
            const nomePessoa = mapaDeUso[item.id].split(' - ')[0];
            utilizadorHtml = `<br><small class="user-info">Utilizador: <strong>${nomePessoa}</strong></small>`;
        }

        if (item.status === 'Inativo') {
            botaoInativarHtml = `<button class="btn-item btn-reativar" data-id="${item.id}">Reativar</button>`;
        } else {
            botaoInativarHtml = `<button class="btn-item btn-inativar" data-id="${item.id}" ${estaEmUso ? 'disabled' : ''}>Inativar</button>`;
        }

        const li = document.createElement('li');
        const statusClass = item.status ? item.status.toLowerCase().replace(/ /g, '-') : 'status-desconhecido';
        li.classList.add(`status-${statusClass}`);

        const botoesHTML = `
            <button class="btn-item btn-historico" data-id="${item.id}">Histórico</button>
            ${botaoInativarHtml}
            <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
            <button class="btn-item btn-excluir-estoque" data-id="${item.id}" ${estaEmUso || item.status === 'Inativo' ? 'disabled' : ''}>Excluir</button>
        `;
        
        const statusGASCadastroHTML = item.cadastrado_gpm ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>` : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;
        
        li.innerHTML = `<div class="info-item"><span><strong>${item.modelo_tipo}</strong> (Património: ${formatarPatrimonio(item.patrimonio)})<br><small>Setor: ${item.setor_nome || 'N/A'}</small><br><small>Categoria: ${item.categoria || 'N/A'}</small><br><small>Estado: ${item.estado_conservacao || 'N/A'}</small>${item.observacoes ? `<br><small>${item.observacoes}</small>` : ''}${utilizadorHtml}</span><div class="status-badges-container"><span class="status-badge status-${statusClass}">${item.status || 'Desconhecido'}</span>${statusGASCadastroHTML}</div></div><div class="botoes-item">${botoesHTML}</div>`;
        listaMobiliarioUI.appendChild(li);
    });
}


function renderizarOutrosAtivos() {
    const listaUI = document.getElementById('lista-outros-ativos');
    if (!listaUI) return;

    const todoOutros = todoEstoque.filter(item => item.categoria === 'OUTROS');
    
    const termoBusca = (document.getElementById('campo-busca-outros')?.value || '').toLowerCase();
    const filtroSetor = document.getElementById('filtro-setor-outros')?.value;
    const filtroGPM = document.getElementById('filtro-gpm-outros')?.value;
    const filtroStatus = document.getElementById('filtro-status-outros')?.value;

    const filtrados = todoOutros.filter(item => {
        const buscaOk = termoBusca === '' || `${item.modelo_tipo} ${item.patrimonio}`.toLowerCase().includes(termoBusca);
        const setorOk = !filtroSetor || item.setor_id == filtroSetor;
        const gpmOk = !filtroGPM || (filtroGPM === 'sim' && item.cadastrado_gpm) || (filtroGPM === 'nao' && !item.cadastrado_gpm);
        const statusOk = !filtroStatus || item.status === filtroStatus;
        return buscaOk && setorOk && gpmOk && statusOk;
    });

    listaUI.innerHTML = '';
    if (filtrados.length === 0) {
        listaUI.innerHTML = '<li>Nenhum item encontrado com os filtros aplicados.</li>';
        return;
    }

    filtrados.sort((a, b) => (a.modelo_tipo || '').localeCompare(b.modelo_tipo || ''));

    filtrados.forEach(item => {
        const estaEmUso = item.status === 'Em Uso';
        let utilizadorHtml = '';
        let botaoInativarHtml = '';
        
        if (mapaDeUso[item.id]) {
            const nomePessoa = mapaDeUso[item.id].split(' - ')[0];
            utilizadorHtml = `<br><small class="user-info">Utilizador: <strong>${nomePessoa}</strong></small>`;
        }
        
        if (item.status === 'Inativo') {
            botaoInativarHtml = `<button class="btn-item btn-reativar" data-id="${item.id}">Reativar</button>`;
        } else {
            botaoInativarHtml = `<button class="btn-item btn-inativar" data-id="${item.id}" ${estaEmUso ? 'disabled' : ''}>Inativar</button>`;
        }

        const li = document.createElement('li');
        const statusClass = item.status ? item.status.toLowerCase().replace(/ /g, '-') : 'desconhecido';
        li.classList.add(`status-${statusClass}`);

        const botoesHTML = `
            <button class="btn-item btn-historico" data-id="${item.id}">Histórico</button>
            ${botaoInativarHtml}
            <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
            <button class="btn-item btn-excluir-estoque" data-id="${item.id}" ${estaEmUso || item.status === 'Inativo' ? 'disabled' : ''}>Excluir</button>
        `;
        
        const statusGASCadastroHTML = item.cadastrado_gpm ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>` : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;
        
        li.innerHTML = `
    <div class="info-item">
        <span>
            <strong>${item.modelo_tipo}</strong> (Património: ${formatarPatrimonio(item.patrimonio)})
            <br><small>Setor: ${item.setor_nome || 'N/A'}</small>
            <br><small>Categoria: ${item.categoria || 'N/A'}</small>
            <br><small>Estado: ${item.estado_conservacao || 'N/A'}</small> ${item.observacoes ? `<br><small>Observações: ${item.observacoes}</small>` : ''}
            ${utilizadorHtml}
        </span>
        <div class="status-badges-container">
            <span class="status-badge status-${statusClass}">${item.status || 'Desconhecido'}</span>
            ${statusGASCadastroHTML}
        </div>
    </div>
    <div class="botoes-item">${botoesHTML}</div>`;
        listaUI.appendChild(li);
    });
}

async function renderizarAlmoxarifado() {
    const listaUI = document.getElementById('lista-almoxarifado');
    if (!listaUI) return;

    // --- Lógica Otimizada ---
    // 1. Filtra os itens de almoxarifado do estoque principal
    const todosItensAlmoxarifado = todoEstoque.filter(item => item.categoria === 'ALMOXARIFADO');
    
    // 2. Busca o histórico de TODOS os itens de almoxarifado de uma vez (se houver algum)
    const historicoCompleto = [];
    if (todosItensAlmoxarifado.length > 0) {
        // Cria uma lista de promises para buscar o histórico de cada item
        const promisesHistorico = todosItensAlmoxarifado.map(item => getHistoricoItemAlmoxarifado(item.id));
        // Executa todas as buscas em paralelo
        const resultadosHistorico = await Promise.all(promisesHistorico);
        // Junta todos os resultados em uma única array
        resultadosHistorico.forEach(hist => historicoCompleto.push(...hist));
    }

    const emprestimosAtivos = historicoCompleto.filter(mov => mov.tipo_movimentacao === 'SAIDA' && !mov.data_devolucao);

    const contagemEmprestimos = emprestimosAtivos.reduce((acc, mov) => {
        acc[mov.item_id] = (acc[mov.item_id] || 0) + mov.quantidade_movimentada;
        return acc;
    }, {});
    
    // --- Lógica de Filtro e Renderização (igual à anterior) ---
    const termoBusca = (document.getElementById('campo-busca-almoxarifado')?.value || '').toLowerCase();
    const mostrarApenasEmprestimo = document.getElementById('filtro-em-emprestimo')?.checked;

    let itensFiltrados = todosItensAlmoxarifado.filter(item => {
        const buscaOk = termoBusca === '' || `${item.modelo_tipo} ${item.patrimonio}`.toLowerCase().includes(termoBusca);
        const emprestimoOk = !mostrarApenasEmprestimo || (contagemEmprestimos[item.id] > 0);
        return buscaOk && emprestimoOk;
    });

    listaUI.innerHTML = '';
    if (itensFiltrados.length === 0) {
        listaUI.innerHTML = '<li>Nenhum item encontrado.</li>';
        return;
    }

    itensFiltrados.sort((a, b) => a.modelo_tipo.localeCompare(b.modelo_tipo));

    itensFiltrados.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('status-disponivel'); 

        const qtdEmprestada = contagemEmprestimos[item.id] || 0;
        const podeRetirar = item.quantidade > 0;

        const botoesHTML = `
            <button class="btn-item btn-retirada" data-id="${item.id}" data-nome="${item.modelo_tipo}" data-qtd="${item.quantidade}" ${!podeRetirar ? 'disabled' : ''}>Registrar Saída</button>
            <button class="btn-item btn-historico" data-id="${item.id}" data-nome="${item.modelo_tipo}">Histórico</button>
            <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
            <button class="btn-item btn-excluir-estoque" data-id="${item.id}">Excluir</button>
        `;
        
        // TAG "EM EMPRÉSTIMO" DE VOLTA
        const emprestimoBadgeHTML = qtdEmprestada > 0
            ? `<span class="status-badge status-em-emprestimo">${qtdEmprestada} em Empréstimo</span>`
            : '';

             let alertaDataHTML = '';
            if (qtdEmprestada > 0) {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0); // Zera o horário para comparar apenas a data

                // Encontra a data de retorno mais próxima para este item
                const dataMaisProxima = emprestimosAtivos
                    .filter(mov => mov.item_id === item.id && mov.data_prevista_devolucao)
                    .map(mov => new Date(mov.data_prevista_devolucao))
                    .sort((a, b) => a - b)[0];

                if (dataMaisProxima) {
                    const diffTime = dataMaisProxima - hoje;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) {
                        alertaDataHTML = `<span class="status-badge status-atrasado">Atrasado</span>`;
                    } else if (diffDays <= 7) {
                        alertaDataHTML = `<span class="status-badge status-aviso">Devolver em ${diffDays} dias</span>`;
                    }
                }
            }

        li.innerHTML = `
            <div class="info-item">
                <span>
                    <strong>${item.modelo_tipo}</strong> (Código: ${item.patrimonio || 'N/A'})
                    <br><small>Quantidade em Estoque: <strong>${item.quantidade || 0}</strong></small>
                </span>
                <div class="status-badges-container">
                    ${emprestimoBadgeHTML}
                </div>
            </div>
            <div class="botoes-item">${botoesHTML}</div>`;
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

            // Mapa de cores (lógica existente)
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


            
            if (dadosUtilizador.permissao === 'admin'){
                const navAdmin = document.getElementById('nav-admin');
                if (navAdmin) navAdmin.style.display = 'block';
            }
            
            const containerAlmoxarifado = document.querySelector('.almoxarifado-container');
            if (containerAlmoxarifado) {
                // Se o departamento do usuário NÃO for 'GAS', esconde o container
                if (depto.toUpperCase() !== 'GAS') {
                    containerAlmoxarifado.style.display = 'none';
                } else {
                    // Garante que ele apareça se o usuário for do GAS (caso estivesse escondido por algum motivo)
                    containerAlmoxarifado.style.display = 'block';
                }
            }
        }
    }
}

// Abre o modal de edição e preenche com os dados da máquina
function abrirModalEditarMaquina(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('modal-maquina');
    if (!modal) return;

    // Preenche os campos comuns
    document.getElementById('editar-maquina-id').value = item.id;
    document.getElementById('editar-maquina-modelo').value = item.modelo_tipo || '';
    document.getElementById('editar-maquina-patrimonio').value = item.patrimonio || '';
    document.getElementById('editar-maquina-setor').value = item.setor_nome || ''; 
    document.getElementById('editar-maquina-observacoes').value = item.observacoes || '';
    document.getElementById('editar-maquina-cadastrado-gpm').checked = item.cadastrado_gpm || false;
    document.getElementById('editar-maquina-estado').value = item.estado_conservacao || 'Regular';


    // Elementos dinâmicos
    const tituloModal = document.getElementById('modal-maquina-titulo');
    const specFields = modal.querySelectorAll('.spec-field');

    // Verifica a categoria para personalizar o modal
    if (item.categoria === 'COMPUTADOR') {
        tituloModal.textContent = 'Editar Máquina';
        document.getElementById('editar-maquina-processador').value = item.espec_processador || '';
        document.getElementById('editar-maquina-ram').value = item.espec_ram || '';
        document.getElementById('editar-maquina-armazenamento').value = item.espec_armazenamento || '';
        specFields.forEach(field => field.style.display = 'block');
    } else if (item.categoria === 'MONITOR') {
        tituloModal.textContent = 'Editar Monitor';
        specFields.forEach(field => field.style.display = 'none');
    }
    
    modal.classList.add('visible');
}

function fecharModalEditarMaquina() {
    const modal = document.getElementById('modal-maquina');
    if(modal) modal.classList.remove('visible');
}

async function salvarEdicaoMaquina(event) {
    event.preventDefault(); // Impede o recarregamento da página

    const form = document.getElementById('form-editar-item');
    const id = form.querySelector('#editar-id').value;

    // Coleta todos os dados do formulário de edição da máquina
    const dadosAtualizados = {
        patrimonio: form.querySelector('#editar-patrimonio').value.trim(),
        categoria: form.querySelector('#editar-categoria').value,
        modelo_tipo: form.querySelector('#editar-modelo-tipo').value.trim(),
        setor: form.querySelector('#editar-setor').value,
        espec_processador: form.querySelector('#editar-espec-processador').value.trim(),
        espec_ram: form.querySelector('#editar-espec-ram').value.trim(),
        espec_armazenamento: form.querySelector('#editar-espec-armazenamento').value.trim(),
        observacoes: form.querySelector('#editar-observacoes').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-cadastrado-gpm').checked
    };

    try {
        // Envia os dados atualizados para a API
        await updateItem(id, dadosAtualizados);
        
        Toastify({ text: "Máquina atualizada com sucesso!" }).showToast();
        fecharModalEditar(); // Fecha o modal
        carregarDados(); // Recarrega os dados para atualizar a lista na tela
    } catch (error) {
        console.error("Erro ao atualizar máquina:", error);
        Toastify({ text: `Erro ao atualizar: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}


// Funções para o modal de Mobiliário
function abrirModalEditarMobiliario(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    // Preenche todos os campos do formulário com os dados do item
    document.getElementById('editar-mobiliario-id').value = item.id;
    document.getElementById('editar-mobiliario-tipo').value = item.modelo_tipo || '';
    document.getElementById('editar-mobiliario-patrimonio').value = item.patrimonio || '';
    document.getElementById('editar-mobiliario-setor').value = item.setor_nome || ''; // Corrigido para setor_nome
    document.getElementById('editar-mobiliario-estado').value = item.estado_conservacao || 'Regular'; // Campo novo
    document.getElementById('editar-mobiliario-observacoes').value = item.observacoes || ''; // Campo novo
    document.getElementById('editar-mobiliario-cadastrado-gpm').checked = item.cadastrado_gpm || false;

    // Mostra o modal
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
    document.getElementById('editar-monitor-setor').value = item.setor_nome || '';
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

function abrirModalEditarOutro(outroId) {
    console.log("Dentro da função abrirModalEditarOutro para o ID:", outroId); // VERIFICAÇÃO 1
    
    const outro = todoEstoque.find(o => o.id === outroId);
    if (!outro) {
        console.error("Não foi possível encontrar o item 'Outro' no estoque local.");
        return;
    }

    // Tenta preencher os campos
    try {
        document.getElementById('editar-outro-id').value = outro.id;
        document.getElementById('editar-outro-modelo').value = outro.modelo_tipo || '';
        document.getElementById('editar-outro-patrimonio').value = outro.patrimonio || '';
        document.getElementById('editar-outro-setor').value = outro.setor_nome || '';
        document.getElementById('editar-outro-observacoes').value = outro.observacoes || '';
        document.getElementById('editar-outro-cadastrado-gpm').checked = outro.cadastrado_gpm || false;
        document.getElementById('editar-outro-estado').value = outro.estado_conservacao || 'Regular';

        console.log("Campos do formulário preenchidos com sucesso."); // VERIFICAÇÃO 2
    } catch (e) {
        console.error("ERRO ao tentar preencher os campos do formulário!", e);
        return;
    }
    
    // Tenta encontrar e abrir o modal
    const modal = document.getElementById('modal-outros');
    console.log("Procurando por #modal-outros. Encontrado:", modal); // VERIFICAÇÃO 3

    if (modal) {
        modal.classList.add('visible');
        console.log("Modal aberto com sucesso!"); // VERIFICAÇÃO 4
    } else {
        console.error("ERRO CRÍTICO: O HTML do modal com id='modal-outros' não foi encontrado na página.");
    }
}

function fecharModalEditarOutros() {
    document.getElementById('modal-outros').classList.remove('visible');
}

async function salvarEdicaoOutro(event) {
    event.preventDefault(); // Impede o recarregamento da página

    const form = event.target;
    const outroId = form.querySelector('#editar-outro-id').value;

    // Coleta todos os dados do formulário de edição
    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-outro-modelo').value.trim(),
        patrimonio: form.querySelector('#editar-outro-patrimonio').value.trim(),
        setor: form.querySelector('#editar-outro-setor').value.trim(),
        observacoes: form.querySelector('#editar-outro-observacoes').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-outro-cadastrado-gpm').checked,
        estado_conservacao: form.querySelector('#editar-outro-estado').value,

    };

    try {
        // Envia os dados atualizados para a API
        await updateItem(outroId, dadosAtualizados);
        
        Toastify({ text: "Ativo atualizado com sucesso!" }).showToast();
        
        fecharModalEditarOutros(); // Fecha o modal
        carregarDados(); // Recarrega os dados para atualizar a lista na tela
    } catch (error) {
        console.error("Erro ao atualizar o ativo:", error);
        Toastify({ text: `Erro ao atualizar: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

function abrirModalEditarAlmoxarifado(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    // Preenche os campos do novo modal
    document.getElementById('editar-almox-id').value = item.id;
    document.getElementById('editar-almox-nome').value = item.modelo_tipo || '';
    document.getElementById('editar-almox-sku').value = item.patrimonio || '';
    document.getElementById('editar-almox-quantidade').value = item.quantidade || 0;
    document.getElementById('editar-almox-observacoes').value = item.observacoes || '';

    // Mostra o modal
    document.getElementById('modal-almoxarifado-editar').classList.add('visible');
}

function fecharModalEditarAlmoxarifado() {
    document.getElementById('modal-almoxarifado-editar').classList.remove('visible');
}

async function salvarEdicaoAlmoxarifado(event) {
    event.preventDefault();
    const form = event.target;
    const itemId = form.querySelector('#editar-almox-id').value;

    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-almox-nome').value.trim(),
        patrimonio: form.querySelector('#editar-almox-sku').value.trim(),
        quantidade: parseInt(form.querySelector('#editar-almox-quantidade').value, 10),
        observacoes: form.querySelector('#editar-almox-observacoes').value.trim(),
    };

    try {
        await updateItem(itemId, dadosAtualizados);
        Toastify({ text: "Item do almoxarifado atualizado!" }).showToast();
        fecharModalEditarAlmoxarifado();
        carregarDados();
    } catch (error) {
        console.error("Erro ao atualizar item do almoxarifado:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

async function salvarItemAlmoxarifado(event) {
    event.preventDefault();
    const form = event.target;
    const dados = {
        modelo_tipo: form.querySelector('#almox-nome').value.trim(),
        patrimonio: form.querySelector('#almox-sku').value.trim(),
        quantidade: parseInt(form.querySelector('#almox-quantidade').value, 10),
        setor: 'Almoxarifado', 
        observacoes: form.querySelector('#almox-observacoes').value.trim(),
        categoria: 'ALMOXARIFADO', 
        status: 'Disponível' 
    };

    if (isNaN(dados.quantidade) || dados.quantidade < 0) {
        Toastify({ text: 'Por favor, insira uma quantidade válida.', backgroundColor: "red" }).showToast();
        return;
    }

    try {
        await createItem(dados);
        Toastify({ text: "Item adicionado ao almoxarifado!" }).showToast();
        form.reset();
        carregarDados();
    } catch (error) {
        console.error("Erro ao adicionar item de almoxarifado:", error);
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
async function salvarEdicaoMobiliario(event) {
    event.preventDefault(); // Impede o recarregamento da página

    const form = document.getElementById('form-editar-mobiliario');
    const id = form.querySelector('#editar-mobiliario-id').value;

    // Coleta todos os dados do formulário de edição
    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-mobiliario-tipo').value.trim(),
        patrimonio: form.querySelector('#editar-mobiliario-patrimonio').value.trim(),
        setor: form.querySelector('#editar-mobiliario-setor').value, // <-- A linha que faltava
        estado_conservacao: form.querySelector('#editar-mobiliario-estado').value,
        observacoes: form.querySelector('#editar-mobiliario-observacoes').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-mobiliario-cadastrado-gpm').checked
    };

    try {
        // Envia os dados atualizados para a API
        await updateItem(id, dadosAtualizados);
        
        Toastify({ text: "Mobiliário atualizado com sucesso!" }).showToast();
        fecharModalEditarMobiliario(); // Fecha o modal
        carregarDados(); // Recarrega os dados para atualizar a lista na tela
    } catch (error) {
        console.error("Erro ao atualizar mobiliário:", error);
        Toastify({ text: `Erro ao atualizar: ${error.message}`, backgroundColor: "red" }).showToast();
    }
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

let tipoAssociacaoAtual = null;

/**
 * Abre o modal unificado de associação, configurando-o para o tipo de ativo específico.
 * @param {'COMPUTADOR' | 'MONITOR' | 'MOBILIARIO'} tipo O tipo de ativo a ser associado.
 */
async function abrirModalAssociacao(tipo) {
    tipoAssociacaoAtual = tipo;
    const modal = document.getElementById('modal-associacao');
    if (!modal) return;

    document.getElementById('form-associacao-unificado').reset();

    const titulo = modal.querySelector('#associacao-titulo');
    const labelAtivo = modal.querySelector('#assoc-busca-label');
    const buscaAtivoInput = modal.querySelector('#assoc-busca-ativo');

    switch (tipo) {
        case 'COMPUTADOR':
            titulo.textContent = 'Associar Nova Máquina';
            labelAtivo.textContent = 'Máquina Disponível:';
            buscaAtivoInput.placeholder = 'Digite o modelo ou patrimônio da máquina...';
            break;
        case 'MONITOR':
            titulo.textContent = 'Associar Novo Monitor';
            labelAtivo.textContent = 'Monitor Disponível:';
            buscaAtivoInput.placeholder = 'Digite o modelo ou patrimônio do monitor...';
            break;
        case 'MOBILIARIO':
            titulo.textContent = 'Associar Novo Mobiliário';
            labelAtivo.textContent = 'Mobiliário Disponível:';
            buscaAtivoInput.placeholder = 'Digite o nome ou patrimônio do mobiliário...';
            break;
    }

    await popularDropdownSetores();
    modal.classList.add('visible');
}

/**
 * Fecha o modal unificado de associação.
 */
function fecharModalAssociacao() {
    const modal = document.getElementById('modal-associacao');
    if (modal) modal.classList.remove('visible');
}

/**
 * Salva a nova associação a partir do formulário unificado.
 */
async function salvarAssociacaoUnificada(event) {
    event.preventDefault();

    const nomePessoa = document.getElementById('assoc-nome-pessoa').value.trim();
    const departamento = document.getElementById('assoc-departamento').value;
    const itemId = document.getElementById('assoc-id-ativo').value;

    if (!nomePessoa || !departamento || !itemId) {
        Toastify({ text: "Pessoa, Departamento e Ativo são obrigatórios." }).showToast();
        return;
    }

    const pessoa_depto = `${nomePessoa} - ${departamento}`;

    // A lógica agora é a mesma para todos os tipos de ativo
    const dadosEmprestimo = {
        item_id: parseInt(itemId),
        pessoa_depto: pessoa_depto,
    };

    try {
        await createEmprestimo(dadosEmprestimo);
        Toastify({ text: "Associação registrada com sucesso!" }).showToast();
        fecharModalAssociacao();
        carregarDados();
    } catch (error) {
        console.error("Erro ao salvar associação:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
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
        setor: form.querySelector('#mobiliario-setor').value, // <-- Alterado aqui para o novo ID
        estado_conservacao: form.querySelector('#mobiliario-estado').value,
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


async function salvarAlteracoesMaquina(event) {
    event.preventDefault(); // Impede o recarregamento da página

    const form = event.target;
    const maquinaId = form.querySelector('#editar-maquina-id').value;

    const itemAtual = todoEstoque.find(i => i.id == maquinaId);
    if (!itemAtual) {
        Toastify({ text: "Erro: Item não encontrado.", backgroundColor: "red" }).showToast();
        return;
    }

    // Começa com os dados que são comuns a ambos
    const dadosAtualizados = {
        modelo_tipo: form.querySelector('#editar-maquina-modelo').value.trim(),
        patrimonio: form.querySelector('#editar-maquina-patrimonio').value.trim(),
        setor: form.querySelector('#editar-maquina-setor').value,
        estado_conservacao: form.querySelector('#editar-maquina-estado').value, // <-- A LINHA QUE FALTAVA
        observacoes: form.querySelector('#editar-maquina-observacoes').value.trim(),
        cadastrado_gpm: form.querySelector('#editar-maquina-cadastrado-gpm').checked,
        categoria: itemAtual.categoria
    };

    // Se for um COMPUTADOR, adiciona os campos de especificações
    if (itemAtual.categoria === 'COMPUTADOR') {
        dadosAtualizados.espec_processador = form.querySelector('#editar-maquina-processador').value.trim();
        dadosAtualizados.espec_ram = form.querySelector('#editar-maquina-ram').value.trim();
        dadosAtualizados.espec_armazenamento = form.querySelector('#editar-maquina-armazenamento').value.trim();
    }

    try {
        await updateItem(maquinaId, dadosAtualizados);
        
        Toastify({ text: "Dados do ativo atualizados com sucesso!" }).showToast();
        
        fecharModalEditarMaquina();
        carregarDados();
    } catch (error) {
        console.error("Erro ao atualizar o ativo:", error);
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

async function alternarStatusAtivo(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    const novoStatus = item.status === 'Inativo' ? 'Disponível' : 'Inativo';
    const acao = novoStatus === 'Inativo' ? 'inativar' : 'reativar';

    exibirModalConfirmacao(`Tem a certeza que deseja ${acao} o item "${item.modelo_tipo}"?`, async () => {
        try {
            await updateItem(itemId, { status: novoStatus });
            Toastify({ text: `Item ${acao} com sucesso!` }).showToast();
            carregarDados(); // Recarrega os dados para atualizar a lista e os botões
        } catch (error) {
            console.error(`Erro ao ${acao} o item:`, error);
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

async function popularDropdownSetores() {
    // Lista COMPLETA de todos os IDs de dropdowns de setor
    const ids = [
        // Formulários de ADIÇÃO
        'estoque-setor',
        'mobiliario-setor',
        'outros-setor',
        'modal-saida-setor',

        // Formulários de ASSOCIAÇÃO (os que estavam a faltar)
        'departamento-pessoa-assoc',
        'departamento-pessoa-mobiliario-assoc',
        'assoc-departamento',

        // FILTROS das listas
        'filtro-setor-estoque',
        'filtro-setor-mobiliario',
        'filtro-setor-outros',
        'editar-maquina-setor',    
        'editar-mobiliario-setor', 
        'editar-outro-setor',
        'editar-monitor-setor',
        'departamento-pessoa-monitor-assoc'  
    ];

    const selects = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (selects.length === 0) return;

    try {
        const setores = await getSetores();

        selects.forEach(selectElement => {
            const placeholder = selectElement.querySelector('option');
            selectElement.innerHTML = '';
            if (placeholder) {
                selectElement.appendChild(placeholder);
            }

            setores.forEach(setor => {
                const option = document.createElement('option');
                
                // Lógica inteligente: verifica se o dropdown é um filtro ou um formulário
                const isFilter = selectElement.id.startsWith('filtro-');

                // Filtros usam o ID do setor como valor, formulários usam o NOME
                option.value = isFilter ? setor.id : setor.nome;
                option.textContent = setor.nome;
                
                selectElement.appendChild(option);
            });
        });

    } catch (error) {
        console.error('Erro ao carregar setores:', error);
        selects.forEach(s => s.innerHTML = '<option value="">Erro ao carregar</option>');
    }
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

function exportarInventarioCSV() {
    if (!todoEstoque || todoEstoque.length === 0) {
        alert("Não há itens no inventário para exportar.");
        return;
    }

    const delimiter = ';';
    const cabecalhos = [
        'Patrimonio', 'Modelo/Tipo', 'Categoria', 'Status', 'Setor', 
        'Estado de Conservacao', 'Cadastrado GPM', 'Utilizador Atual'
    ];

    const linhas = todoEstoque.map(item => {
        const utilizador = mapaDeUso[item.id] ? mapaDeUso[item.id].split(' - ')[0] : 'N/A';
        const cleanValue = (value) => `"${String(value || '').replace(/"/g, '""')}"`;

        return [
            // --- CORREÇÃO APLICADA AQUI ---
            cleanValue(formatarPatrimonio(item.patrimonio)), // Usa a função para formatar o património
            
            cleanValue(item.modelo_tipo),
            cleanValue(item.categoria),
            cleanValue(item.status),
            cleanValue(item.setor_nome),
            cleanValue(item.estado_conservacao),
            cleanValue(item.cadastrado_gpm ? 'Sim' : 'Nao'),
            cleanValue(utilizador)
        ].join(delimiter);
    });

    const conteudoCSV = [cabecalhos.join(delimiter), ...linhas].join('\n');
    
    const bom = '\uFEFF';
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(bom + conteudoCSV);
    link.download = 'inventario_completo.csv';
    link.click();
}

/**
 * Gera e baixa um relatório PDF de todo o inventário.
 */
function exportarInventarioPDF() {
    if (!todoEstoque || todoEstoque.length === 0) {
        alert("Não há itens no inventário para gerar o relatório.");
        return;
    }

    // 1. Abre uma nova janela/aba em branco
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Não foi possível abrir a nova aba. Por favor, desative o bloqueador de pop-ups e tente novamente.");
        return;
    }

    // 2. Constrói o HTML completo do relatório
    let tabelaHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Inventário Completo</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; }
                table { width: 100%; border-collapse: collapse; font-size: 10pt; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                th { background-color: #f7f7f7; font-weight: 600; }
                h1 { font-size: 24px; text-align: center; margin-bottom: 20px; }
                @media print {
                    body { -webkit-print-color-adjust: exact; } /* Garante que as cores de fundo sejam impressas */
                }
            </style>
        </head>
        <body>
            <h1>Relatório de Inventário Completo</h1>
            <table>
                <thead>
                    <tr>
                        <th>Património</th><th>Modelo/Tipo</th><th>Categoria</th><th>Status</th>
                        <th>Setor</th><th>Estado</th><th>Utilizador Atual</th>
                    </tr>
                </thead>
                <tbody>
    `;

    const estoqueOrdenado = [...todoEstoque].sort((a, b) => a.categoria.localeCompare(b.categoria));

    estoqueOrdenado.forEach(item => {
        const utilizador = mapaDeUso[item.id] ? mapaDeUso[item.id].split(' - ')[0] : 'N/A';
        tabelaHtml += `
            <tr>
                <td>${item.patrimonio || ''}</td><td>${item.modelo_tipo || ''}</td><td>${item.categoria || ''}</td>
                <td>${item.status || ''}</td><td>${item.setor_nome || ''}</td><td>${item.estado_conservacao || ''}</td>
                <td>${utilizador}</td>
            </tr>
        `;
    });

    tabelaHtml += '</tbody></table></body></html>';

    // 3. Escreve o HTML na nova janela e deixa-a aberta
    printWindow.document.open();
    printWindow.document.write(tabelaHtml);
    printWindow.document.close();
}

function exportarAlmoxarifadoPDF() {
    const itensAlmoxarifado = todoEstoque.filter(item => item.categoria === 'ALMOXARIFADO');
    if (itensAlmoxarifado.length === 0) {
        alert("Não há itens no almoxarifado para gerar o PDF.");
        return;
    }

    const printWindow = window.open('', '_blank');
    let tabelaHtml = `
        <!DOCTYPE html><html><head><title>Relatório de Almoxarifado</title>
        <style>body{font-family:sans-serif} table{width:100%; border-collapse:collapse} th,td{border:1px solid #ddd; padding:8px} th{background-color:#f2f2f2}</style>
        </head><body><h1>Inventário do Almoxarifado</h1>
        <table><thead><tr><th>Item</th><th>Patrimonio</th><th>Status</th><th>Quantidade</th><th>Observações</th></tr></thead><tbody>
    `;
    itensAlmoxarifado.forEach(item => {
        tabelaHtml += `
            <tr>
                <td>${item.modelo_tipo || ''}</td>
                <td>${item.patrimonio || 'N/A'}</td>
                <td>${item.status || ''}</td>
                <td>${item.quantidade || 0}</td>
                <td>${item.observacoes || ''}</td>
            </tr>
        `;
    });
    tabelaHtml += '</tbody></table></body></html>';
    printWindow.document.open();
    printWindow.document.write(tabelaHtml);
    printWindow.document.close();
}

function exportarAlmoxarifadoCSV() {
    const itensAlmoxarifado = todoEstoque.filter(item => item.categoria === 'ALMOXARIFADO');
    if (itensAlmoxarifado.length === 0) {
        alert("Não há itens no almoxarifado para exportar.");
        return;
    }

    const delimiter = ';';
    let csvContent = '\uFEFF'; // BOM para garantir a codificação correta no Excel

    // Seção 1: Inventário Atual
    csvContent += 'Inventario Atual do Almoxarifado\n';
    const cabecalhosInventario = ['Item', 'Codigo/SKU', 'Status', 'Quantidade', 'Observacoes'];
    csvContent += cabecalhosInventario.join(delimiter) + '\n';

    itensAlmoxarifado.forEach(item => {
        const linha = [
            `"${item.modelo_tipo || ''}"`,
            `"${item.patrimonio || ''}"`,
            `"${item.status || ''}"`,
            item.quantidade || 0,
            `"${item.observacoes || ''}"`
        ].join(delimiter);
        csvContent += linha + '\n';
    });

    // Adiciona uma linha em branco para separar as seções
    csvContent += '\n';

    // Se você quiser adicionar o histórico de movimentações também, precisaremos de uma nova função na API.
    // Por enquanto, vamos manter simples, exportando apenas o inventário atual.

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csvContent);
    link.download = 'relatorio_almoxarifado.csv';
    link.click();
}


// Função para abrir o modal de registro de saída
function abrirModalSaida(itemId, itemName, itemQuantidade) {
    document.getElementById('modal-saida-item-id').value = itemId;
    document.getElementById('modal-saida-nome-item').textContent = itemName;
    document.getElementById('modal-saida-estoque-atual').textContent = itemQuantidade;
    document.getElementById('modal-saida-quantidade').max = itemQuantidade; // Define o máximo que pode ser retirado
    
    document.getElementById('form-saida-almoxarifado').reset(); // Limpa o formulário
    document.getElementById('modal-saida-almoxarifado').style.display = 'flex';
}

// Função para abrir o modal de histórico
async function abrirModalHistoricoAlmoxarifado(itemId, itemName) {
    document.getElementById('modal-historico-nome-item').textContent = itemName;
    const modal = document.getElementById('modal-historico-almoxarifado');
    const tabelaBody = modal.querySelector('tbody');
    // Ajusta o colspan para 8 por causa da nova coluna
    tabelaBody.innerHTML = '<tr><td colspan="8">Carregando histórico...</td></tr>';
    modal.style.display = 'flex';

    try {
        const historico = await getHistoricoItemAlmoxarifado(itemId);
        tabelaBody.innerHTML = '';
        if (historico.length === 0) {
            tabelaBody.innerHTML = '<tr><td colspan="8">Nenhuma movimentação registrada.</td></tr>';
            return;
        }

        historico.forEach(mov => {
            const tr = document.createElement('tr');
            
            const destino = mov.pessoa_nome || mov.setor_nome || 'N/A';
            const departamento = mov.pessoa_nome ? mov.setor_nome || 'Pessoal' : '---';
            
            // --- NOVA LÓGICA PARA FORMATAR A DATA PREVISTA ---
            let dataPrevistaFormatada = 'N/A';
            if (mov.data_prevista_devolucao) {
                // new Date() corrige o fuso horário que o PostgreSQL pode adicionar
                dataPrevistaFormatada = new Date(mov.data_prevista_devolucao).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            }

            const ehEmprestimoAtivo = mov.tipo_movimentacao === 'SAIDA' && !mov.data_devolucao;
            let acaoHTML = '';
            
            if (ehEmprestimoAtivo) {
                // Se for um empréstimo que ainda não foi devolvido, mostra o botão
                acaoHTML = `<button class="btn-item btn-devolver" data-mov-id="${mov.id}">Devolver</button>`;
            } else if (mov.data_devolucao && mov.tipo_movimentacao === 'DEVOLUCAO') {
                // Se já foi devolvido (e o tipo é DEVOLUCAO), mostra a data e hora
                acaoHTML = `Devolvido em ${new Date(mov.data_devolucao).toLocaleString('pt-BR')}`;
            } else {
                // Para todos os outros casos (item de consumo), mostra 'N/A'
                acaoHTML = 'N/A';
            }


            tr.innerHTML = `
                <td>${new Date(mov.data_movimentacao).toLocaleString('pt-BR')}</td>
                <td>${mov.tipo_movimentacao}</td>
                <td>${mov.quantidade_movimentada}</td>
                <td>${destino}</td>
                <td>${departamento}</td>
                <td>${dataPrevistaFormatada}</td> <td>${mov.usuario_nome || 'Sistema'}</td>
                <td>${acaoHTML}</td>
            `;
            tabelaBody.appendChild(tr);
        });

    } catch (error) {
        tabelaBody.innerHTML = `<tr><td colspan="8">Erro ao carregar histórico: ${error.message}</td></tr>`;
    }
}
// Função para lidar com a submissão do formulário de saída
async function handleSubmissaoSaida(event) {
    event.preventDefault();
    const form = event.target;
    const tipoSaida = form.querySelector('input[name="tipoSaida"]:checked').value;
    const dataRetorno = form.querySelector('#modal-saida-data-retorno').value;

    const dados = {
        itemId: form.querySelector('#modal-saida-item-id').value,
        quantidade: parseInt(form.querySelector('#modal-saida-quantidade').value, 10),
        pessoaNome: form.querySelector('#modal-saida-pessoa').value.trim() || null,
        setor: form.querySelector('#modal-saida-setor').value || null, // Enviando o nome
        observacoes: form.querySelector('#modal-saida-observacoes').value.trim(),
        ehDevolucao: tipoSaida === 'emprestimo',
        data_prevista_devolucao: (tipoSaida === 'emprestimo' && dataRetorno) ? dataRetorno : null
    };

    if (!dados.pessoaNome && !dados.setor) {
        Toastify({ text: 'Preencha o nome da pessoa ou selecione um setor.', backgroundColor: "orange" }).showToast();
        return;
    }

    try {
        const response = await registrarSaidaAlmoxarifado(dados); // Função que criaremos na API
        Toastify({ text: "Saída registrada com sucesso!" }).showToast();
        document.getElementById('modal-saida-almoxarifado').style.display = 'none';
        carregarDados(); // Recarrega os dados para atualizar a quantidade em estoque
    } catch (error) {
        console.error("Erro ao registrar saída:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
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
    popularDropdownSetores();


    const formEditarMobiliario = document.getElementById('form-editar-mobiliario');
    if (formEditarMobiliario) {
        formEditarMobiliario.addEventListener('submit', salvarEdicaoMobiliario);
    }


    const formEditarMaquina = document.getElementById('form-editar-maquina');
    if (formEditarMaquina) {
        formEditarMaquina.addEventListener('submit', salvarAlteracoesMaquina);
    }

    const formEditarOutro = document.getElementById('form-editar-outro');
    if (formEditarOutro) {
        formEditarOutro.addEventListener('submit', salvarEdicaoOutro);
    }

    const formOutrosAtivos = document.getElementById('form-outros-ativos');
    if (formOutrosAtivos) {
        formOutrosAtivos.addEventListener('submit', salvarOutroAtivo);
    }
    const formAssociacaoUnificado = document.getElementById('form-associacao-unificado');
    if (formAssociacaoUnificado) formAssociacaoUnificado.addEventListener('submit', salvarAssociacaoUnificada);

    const fecharModalExportAlmoxarifado = () => {
        const modal = document.getElementById('modal-exportar-almoxarifado');
        if (modal) {
            // A classe 'visible' que usamos nos outros modais controla a visibilidade.
            // Se o seu CSS usa 'display', mude para: modal.style.display = 'none';
            modal.classList.remove('visible');
        }
    };

    // Listener para ABRIR o modal ao clicar no botão "Exportar Dados do Almoxarifado"
    document.getElementById('btn-abrir-modal-exportar-almoxarifado')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-exportar-almoxarifado');
        if (modal) {
            modal.classList.add('visible');
        }
    });

     document.querySelectorAll('input[name="tipoSaida"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const containerData = document.getElementById('container-data-retorno');
            if (event.target.value === 'emprestimo') {
                containerData.style.display = 'block';
            } else {
                containerData.style.display = 'none';
            }
        });
    });

    // Listener para FECHAR o modal com o botão "Cancelar"
    document.getElementById('btn-fechar-modal-exportar-almoxarifado')?.addEventListener('click', fecharModalExportAlmoxarifado);

    // Listener para o botão de exportar para CSV
    document.getElementById('btn-exportar-almoxarifado-csv')?.addEventListener('click', () => {
        exportarAlmoxarifadoCSV();
        fecharModalExportAlmoxarifado(); // Fecha o modal após a ação
    });

    // Listener para o botão de visualizar PDF
    document.getElementById('btn-exportar-almoxarifado-pdf')?.addEventListener('click', () => {
        exportarAlmoxarifadoPDF();
        fecharModalExportAlmoxarifado(); // Fecha o modal após a ação
    });


    // Listener para o novo formulário de almoxarifado
    const formAlmoxarifado = document.getElementById('form-almoxarifado');
    if (formAlmoxarifado) {
        formAlmoxarifado.addEventListener('submit', salvarItemAlmoxarifado);
    }

    // Listener para o campo de busca do almoxarifado
    const campoBuscaAlmoxarifado = document.getElementById('campo-busca-almoxarifado');
    if (campoBuscaAlmoxarifado) {
        campoBuscaAlmoxarifado.addEventListener('input', renderizarAlmoxarifado);
    }

    const formEditarAlmoxarifado = document.getElementById('form-editar-almoxarifado');
    if (formEditarAlmoxarifado) {
        formEditarAlmoxarifado.addEventListener('submit', salvarEdicaoAlmoxarifado);
    }

     const filtroEmprestimo = document.getElementById('filtro-em-emprestimo');
    if (filtroEmprestimo) {
        filtroEmprestimo.addEventListener('change', renderizarAlmoxarifado);
    }

    const btnCancelarEdicaoAlmox = document.getElementById('btn-editar-almox-cancelar');
    if(btnCancelarEdicaoAlmox) {
        btnCancelarEdicaoAlmox.addEventListener('click', fecharModalEditarAlmoxarifado);
    }

    const modalHistorico = document.getElementById('modal-historico-almoxarifado');
    if (modalHistorico) {
        modalHistorico.addEventListener('click', async (event) => {
            if (event.target.classList.contains('btn-devolver')) {
                const movId = event.target.dataset.movId;
                
                if (confirm('Deseja realmente registrar a devolução deste item?')) {
                    try {
                        await devolverItemAlmoxarifado(movId);
                        Toastify({ text: "Item devolvido com sucesso!" }).showToast();
                        modalHistorico.style.display = 'none';
                        carregarDados(); // Recarrega a lista principal
                    } catch (error) {
                        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
                    }
                }
            }
        });
    }


    // Listener para os botões da lista do almoxarifado (retirada e histórico)
    const listaAlmoxarifado = document.getElementById('lista-almoxarifado');
    if (listaAlmoxarifado) {
        listaAlmoxarifado.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('btn-retirada')) {
                const itemId = target.dataset.id;
                const itemName = target.dataset.nome;
                const itemQtd = target.dataset.qtd;
                abrirModalSaida(itemId, itemName, itemQtd);
            }
            if (target.classList.contains('btn-historico')) {
                const itemId = target.dataset.id;
                const itemName = target.dataset.nome;
                abrirModalHistoricoAlmoxarifado(itemId, itemName);
            }
        });
    }

    // Listener para o formulário de saída do modal
    const formSaida = document.getElementById('form-saida-almoxarifado');
    if (formSaida) {
        formSaida.addEventListener('submit', handleSubmissaoSaida);
    }
    
    // Listeners para fechar os modais
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.target.closest('.modal-container').style.display = 'none';
        });
    });

    // Popular o dropdown de setores no modal de saída
    popularDropdownSetores();

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

    const formNovoItem = document.getElementById('form-novo-item');
    if (formNovoItem) formNovoItem.addEventListener('submit', salvarNovoItem);

   
    
    const formEstoque = document.getElementById('form-estoque');
    if (formEstoque) formEstoque.addEventListener('submit', salvarAtivoEstoque);
    
    const categoriaSelect = document.getElementById('estoque-categoria');
    if (categoriaSelect) {
        categoriaSelect.addEventListener('change', (event) => {
            const camposComputador = document.getElementById('campos-especificos-computador');
            camposComputador.style.display = (event.target.value === 'COMPUTADOR') ? 'block' : 'none';
        });
    }
    
    const formMobiliario = document.getElementById('form-mobiliario');
    if (formMobiliario) {
        formMobiliario.addEventListener('submit', salvarMobiliario);
    }
    
    const buscaMonitorAssocInput = document.getElementById('busca-monitor-assoc');
    const monitorAssocResultadosDiv = document.getElementById('monitor-assoc-resultados');
    const monitorIdInput = document.getElementById('id-monitor-emprestimo');

    if (buscaMonitorAssocInput) {
        buscaMonitorAssocInput.addEventListener('input', () => {
            const termoBusca = buscaMonitorAssocInput.value.toLowerCase();
            monitorIdInput.value = ''; // Limpa o ID se o texto mudar
            if (termoBusca.length < 2) {
                monitorAssocResultadosDiv.style.display = 'none';
                return;
            }
            const monitoresDisponiveis = todoEstoque.filter(item =>
                item.categoria === 'MONITOR' && item.status === 'Disponível'
            );
            const resultados = monitoresDisponiveis.filter(monitor =>
                monitor.modelo_tipo.toLowerCase().includes(termoBusca) ||
                monitor.patrimonio.toLowerCase().includes(termoBusca)
            );
            // Reutiliza a função mostrarResultados para exibir as opções
            mostrarResultados(resultados, monitorAssocResultadosDiv, buscaMonitorAssocInput, monitorIdInput);
        });
    }


    document.getElementById('btn-abrir-assoc-maquina')?.addEventListener('click', () => abrirModalAssociacao('COMPUTADOR'));
    document.getElementById('btn-abrir-assoc-monitor')?.addEventListener('click', () => abrirModalAssociacao('MONITOR'));
    document.getElementById('btn-abrir-assoc-mobiliario')?.addEventListener('click', () => abrirModalAssociacao('MOBILIARIO'));

    // Botão para FECHAR o modal
    document.getElementById('assoc-btn-cancelar')?.addEventListener('click', fecharModalAssociacao);

    // Submissão do formulário unificado
    document.getElementById('form-associacao-unificado')?.addEventListener('submit', salvarAssociacaoUnificada);

    // Lógica de Autocomplete para o campo de ativo principal
    const buscaAtivoInput = document.getElementById('assoc-busca-ativo');
    const resultadosAtivoDiv = document.getElementById('assoc-resultados');
    const idAtivoInput = document.getElementById('assoc-id-ativo');

    buscaAtivoInput?.addEventListener('input', () => {
        const termo = buscaAtivoInput.value.toLowerCase();
        idAtivoInput.value = '';
        if (termo.length < 2) {
            resultadosAtivoDiv.style.display = 'none';
            return;
        }
        // Filtra o estoque com base no tipo de associação que estamos a fazer
        const ativosDisponiveis = todoEstoque.filter(item => 
            item.categoria === tipoAssociacaoAtual && item.status === 'Disponível'
        );
        const resultados = ativosDisponiveis.filter(item => 
            item.modelo_tipo.toLowerCase().includes(termo) || 
            (item.patrimonio || '').toLowerCase().includes(termo)
        );
        mostrarResultados(resultados, resultadosAtivoDiv, buscaAtivoInput, idAtivoInput);
    });


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

    const filtrosEstoque = ['filtro-setor-estoque', 'filtro-gpm-estoque', 'filtro-status-estoque'];
    filtrosEstoque.forEach(idFiltro => {
        const filtro = document.getElementById(idFiltro);
        if (filtro) {
            filtro.addEventListener('change', renderizarEstoque);
        }
    });
    const filtrosMobiliario = ['filtro-setor-mobiliario', 'filtro-gpm-mobiliario', 'filtro-status-mobiliario'];
    filtrosMobiliario.forEach(idFiltro => {
        const filtro = document.getElementById(idFiltro);
        if (filtro) {
            filtro.addEventListener('change', renderizarMobiliario);
        }
    });

    const filtrosOutros = ['filtro-setor-outros', 'filtro-gpm-outros', 'filtro-status-outros'];
    filtrosOutros.forEach(idFiltro => {
        const filtro = document.getElementById(idFiltro);
        if (filtro) {
            filtro.addEventListener('change', renderizarOutrosAtivos);
        }
    });

    const campoBuscaEstoque = document.getElementById('campo-busca-estoque');
    if (campoBuscaEstoque) {
        campoBuscaEstoque.addEventListener('input', renderizarEstoque);
    }

    // Ativa a barra de pesquisa para Mobiliário
    const campoBuscaMobiliario = document.getElementById('campo-busca-mobiliario');
    if (campoBuscaMobiliario) {
        campoBuscaMobiliario.addEventListener('input', renderizarMobiliario);
    }

    // Ativa a barra de pesquisa para Outros Ativos
    const campoBuscaOutros = document.getElementById('campo-busca-outros');
    if (campoBuscaOutros) {
        campoBuscaOutros.addEventListener('input', renderizarOutrosAtivos);
    }

    const fecharModalInventario = () => {
    const modal = document.getElementById('modal-exportar-inventario');
    if (modal) modal.classList.remove('visible');
    };

    // Botão para ABRIR o modal
    document.getElementById('btn-abrir-modal-exportar-inventario')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-exportar-inventario');
        if (modal) modal.classList.add('visible');
    });

    // Botão para FECHAR o modal
    document.getElementById('btn-fechar-modal-exportar-inventario')?.addEventListener('click', fecharModalInventario);

    // Botão para exportar como CSV
    document.getElementById('btn-exportar-inventario-csv')?.addEventListener('click', () => {
        exportarInventarioCSV();
        fecharModalInventario();
    });

    // Botão para exportar como PDF
    document.getElementById('btn-exportar-inventario-pdf')?.addEventListener('click', () => {
        exportarInventarioPDF();
        fecharModalInventario();
    });

document.body.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.disabled) return;
    
    // Lógica para remover tags de monitor (mantida)
    if (target.classList.contains('remove-monitor')) {
        const tagElement = target.closest('.monitor-tag');
        if (tagElement) removerMonitorTag(tagElement);
        return;
    }

    const id = target.dataset.id;
    if (!id) return;

    
    if (target.classList.contains('btn-editar-estoque')) {
        const itemParaEditar = todoEstoque.find(i => i.id == id);
        if (itemParaEditar) {
            const categoria = itemParaEditar.categoria.toUpperCase();
            
            // Lógica de decisão
            if (categoria === 'ALMOXARIFADO') {
                abrirModalEditarAlmoxarifado(parseInt(id)); // <-- Chama o novo modal
            }
            else if (categoria === 'COMPUTADOR' || categoria === 'MONITOR') {
                abrirModalEditarMaquina(parseInt(id));
            } 
            else if (categoria === 'MOBILIARIO') {
                abrirModalEditarMobiliario(parseInt(id));
            } else if (categoria === 'OUTROS') {
                abrirModalEditarOutro(parseInt(id));
            }
        }
    } 
    else if (target.classList.contains('btn-inativar') || target.classList.contains('btn-reativar')) {
        alternarStatusAtivo(parseInt(id));
    } 
    // Outras lógicas de clique (histórico, excluir, etc.)
    else if (target.classList.contains('btn-historico')) {
        // CONDIÇÃO ADICIONADA:
        // Verifica se o botão clicado NÃO está dentro da lista do almoxarifado.
        if (!target.closest('#lista-almoxarifado')) {
            // Se não for do almoxarifado, chama a função do modal antigo.
            abrirModalHistorico(parseInt(id));
        }
        // Se o clique veio da lista do almoxarifado, este código é ignorado,
        // e apenas o outro EventListener (o específico da lista) será executado.
    } else if (target.classList.contains('spec-link')) {
        event.preventDefault();
        abrirModalEspecificacoes(parseInt(id));
    } else if (target.classList.contains('btn-excluir-estoque')) {
        excluirMaquinaEstoque(parseInt(id));
    }
});
});