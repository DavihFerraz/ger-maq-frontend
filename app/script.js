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
    createModelo
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
    renderizarEstoqueMonitores();
    renderizarResumos();
    renderizarGraficos();
    renderizarHistorico();
    popularDropdownMaquinas();
    popularDropdownMobiliario();
    popularDropdownMonitores();
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
            <br><small class="patrimonio-info">Património: ${itemAssociado.patrimonio}</small>
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

    // Filtra para obter apenas os computadores do inventário
    const todoMaquinas = todoEstoque.filter(item => item.categoria === 'COMPUTADOR');
    const campoBuscaEstoque = document.getElementById('campo-busca-estoque');
    const termoBusca = campoBuscaEstoque ? campoBuscaEstoque.value.toLowerCase() : '';

    let estoqueParaRenderizar = todoMaquinas.filter(maquina => {
        const modelo = (maquina.modelo_tipo || '').toLowerCase();
        const patrimonio = (maquina.patrimonio || '').toLowerCase();
        
        // Encontra a associação para obter o nome do utilizador para a pesquisa
        const associacao = todasAssociacoes.find(emp => emp.item_id === maquina.id);
        const nomeUtilizador = (associacao ? associacao.pessoa_depto : '').toLowerCase();

        // Retorna verdadeiro se o termo de busca estiver em qualquer um dos campos
        return modelo.includes(termoBusca) || 
               patrimonio.includes(termoBusca) || 
               nomeUtilizador.includes(termoBusca);
    });

    // Ordena a lista por status e depois por modelo
    estoqueParaRenderizar.sort((a, b) => {
        if (a.status < b.status) return 1; // Coloca 'Em Uso' antes de 'Disponível'
        if (a.status > b.status) return -1;
        return a.modelo_tipo.localeCompare(b.modelo_tipo);
    });

    listaEstoqueUI.innerHTML = '';
    if (estoqueParaRenderizar.length === 0) {
        listaEstoqueUI.innerHTML = '<li>Nenhuma máquina encontrada.</li>';
        return;
    }

    estoqueParaRenderizar.forEach(maquina => {
        const statusAtual = maquina.status;
        const estaEmUso = statusAtual && statusAtual.toLowerCase() === 'em uso';

        let utilizadorHtml = '';
        if (estaEmUso) {
            const associacaoDaMaquina = todasAssociacoes.find(emp => emp.item_id === maquina.id);
            if (associacaoDaMaquina) {
                const nomePessoa = associacaoDaMaquina.pessoa_depto.split(' - ')[0];
                utilizadorHtml = `<br><small class="user-info">Utilizador: <strong>${nomePessoa}</strong></small>`;
            }
        }

        const li = document.createElement('li');
        const statusClass = statusAtual ? statusAtual.toLowerCase().replace(' ', '-') : 'status-desconhecido';
        li.classList.add(`status-${statusClass}`);

        // Lógica explícita para criar o HTML dos botões
        let botoesHTML = '';
        if (estaEmUso) {
            botoesHTML = `<button class="btn-item btn-editar-estoque" data-id="${maquina.id}">Editar</button>
                          <button class="btn-item btn-excluir-estoque" data-id="${maquina.id}" disabled title="Devolva a máquina antes de excluir.">Excluir</button>`;
        } else {
            botoesHTML = `<button class="btn-item btn-editar-estoque" data-id="${maquina.id}">Editar</button>
                          <button class="btn-item btn-excluir-estoque" data-id="${maquina.id}">Excluir</button>`;
        }
        
        const statusGASCadastroHTML = maquina.cadastrado_gpm
            ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>`
            : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;
        
        li.innerHTML = `
            <div class="info-item">
                <span>
                    <strong>${maquina.modelo_tipo}</strong> (Património: ${maquina.patrimonio})
                    <br><small>Setor: ${maquina.setor || 'N/P'}</small>
                    ${maquina.observacoes ? `<br><small>${maquina.observacoes}</small>` : ''}
                    ${utilizadorHtml}
                </span>
                <div class="status-badges-container">
                    <span class="status-badge status-${statusClass}">${statusAtual}</span>
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

    // Filtra o estoque para pegar apenas a categoria 'MOBILIARIO'
    const todoMobiliario = todoEstoque.filter(item => item.categoria === 'MOBILIARIO');
    const campoBuscaMobiliario = document.getElementById('campo-busca-mobiliario');
    const termoBusca = campoBuscaMobiliario ? campoBuscaMobiliario.value.toLowerCase() : '';

    let mobiliarioParaRenderizar = todoMobiliario.filter(item => {
        const tipo = item.modelo_tipo ? item.modelo_tipo.toLowerCase() : '';
        const patrimonio = item.patrimonio ? item.patrimonio.toLowerCase() : '';
        return tipo.includes(termoBusca) || patrimonio.includes(termoBusca);
    });

    // Ordena por status ('Em Uso' vem primeiro) e depois por tipo
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
        const estaEmUso = statusAtual === 'Em Uso';

        let utilizadorHtml = '';
        if (estaEmUso) {
            const associacao = todasAssociacoesMobiliario.find(emp => emp.item_id === item.id);
            if (associacao) {
                const nomePessoa = associacao.pessoa_depto.split(' - ')[0];
                utilizadorHtml = `<br><small class="user-info">Utilizador: <strong>${nomePessoa}</strong></small>`;
            }
        }

        const li = document.createElement('li');
        const statusClass = statusAtual.toLowerCase().replace(' ', '-');
        li.classList.add(`status-${statusClass}`);

        const botoesHTML = estaEmUso
            ? `<button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button> <button class="btn-item" disabled>Excluir</button>`
            : `<button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button> <button class="btn-item btn-excluir-estoque" data-id="${item.id}">Excluir</button>`;

        const statusGASCadastroHTML = item.cadastrado_gpm
            ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>`
            : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;

        li.innerHTML = `
            <div class="info-item">
                <span>
                    <strong>${item.modelo_tipo}</strong> (Património: ${item.patrimonio})
                    <br><small>Setor: ${item.setor || 'N/P'}</small>
                    ${utilizadorHtml}
                </span>
                <div class="status-badges-container">
                    <span class="status-badge status-${statusClass}">${statusAtual}</span>
                    ${statusGASCadastroHTML}
                </div>
            </div>
            <div class="botoes-item">${botoesHTML}</div>`;
        listaMobiliarioUI.appendChild(li);
    });
}

function renderizarEstoqueMonitores() {
    const listaUI = document.getElementById('lista-estoque-monitores');
    if (!listaUI) return;

    const todoMonitores = todoEstoque.filter(item => item.categoria === 'MONITOR');
    const campoBusca = document.getElementById('campo-busca-estoque-monitor');
    const termoBusca = campoBusca ? campoBusca.value.toLowerCase() : '';

    const monitoresFiltrados = todoMonitores.filter(item => {
        return (item.modelo_tipo || '').toLowerCase().includes(termoBusca) ||
               (item.patrimonio || '').toLowerCase().includes(termoBusca);
    });

    listaUI.innerHTML = '';
    if (monitoresFiltrados.length === 0) {
        listaUI.innerHTML = '<li>Nenhum monitor encontrado no inventário.</li>';
        return;
    }

    monitoresFiltrados.sort((a, b) => (a.modelo_tipo || '').localeCompare(b.modelo_tipo || ''));

    monitoresFiltrados.forEach(monitor => {
        const estaEmUso = monitor.status === 'Em Uso';
        let utilizadorHtml = '';

        if (estaEmUso) {
            const associacao = todasAssociacoes.find(assoc => 
                assoc.monitores_associados_ids && assoc.monitores_associados_ids.includes(monitor.id)
            );
            
            if (associacao) {
                const nomePessoa = associacao.pessoa_depto.split(' - ')[0];
                utilizadorHtml = `<br><small class="user-info">Utilizador: <strong>${nomePessoa}</strong></small>`;
            }
        }

        const li = document.createElement('li');
        const statusClass = monitor.status ? monitor.status.toLowerCase().replace(' ', '-') : 'status-desconhecido';
        li.classList.add(`status-${statusClass}`);

        const botoesHTML = estaEmUso
            ? `<button class="btn-item btn-editar-estoque" data-id="${monitor.id}">Editar</button> <button class="btn-item" disabled>Excluir</button>`
            : `<button class="btn-item btn-editar-estoque" data-id="${monitor.id}">Editar</button> <button class="btn-item btn-excluir-estoque" data-id="${monitor.id}">Excluir</button>`;

        const statusGASCadastroHTML = monitor.cadastrado_gpm
            ? `<span class="status-gas cadastrado-sim">Cadastrado GPM</span>`
            : `<span class="status-gas cadastrado-nao">Não Cadastrado</span>`;

        li.innerHTML = `
            <div class="info-item">
                <span>
                    <strong>${monitor.modelo_tipo}</strong> (Património: ${monitor.patrimonio})
                    <br><small>Setor: ${monitor.setor || 'N/P'}</small>
                    ${utilizadorHtml}
                </span>
                <div class="status-badges-container">
                    <span class="status-badge status-${statusClass}">${monitor.status}</span>
                    ${statusGASCadastroHTML}
                </div>
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
            <br><small class="patrimonio-info">Património: ${itemAssociado.patrimonio}</small>
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
        const dadosUtilizador = parseJwt(token); // Descodifica o token
        if (dadosUtilizador) {
            const nome = dadosUtilizador.nome || 'Utilizador';
            const depto = dadosUtilizador.departamento || 'N/D';
            infoUtilizadorUI.innerHTML = `<span>Olá, <strong>${nome}</strong> (${depto})</span>`;
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

function abrirModalEspecificacoes(itemId) {
    const item = todoEstoque.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('modal-especificacoes');
    if(!modal) return;

    modal.querySelector('#spec-modelo').textContent = item.modelo_tipo;
    const listaSpecs = modal.querySelector('#spec-lista');
    
    listaSpecs.innerHTML = `
        <li><strong>Património:</strong> ${item.patrimonio || 'N/P'}</li>
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


// =================================================================
// 5. FUNÇÕES DE MANIPULAÇÃO DE DADOS (CRUD)
// =================================================================

async function salvarMaquinaEstoque(event) {
    event.preventDefault();
    const form = event.target;
    const dados = {
        modelo_tipo: form.querySelector('#estoque-modelo').value.trim(),
        patrimonio: form.querySelector('#estoque-patrimonio').value.trim(),
        espec_processador: form.querySelector('#estoque-processador').value.trim(),
        espec_ram: form.querySelector('#estoque-ram').value.trim(),
        espec_armazenamento: form.querySelector('#estoque-armazenamento').value.trim(),
        setor: form.querySelector('#estoque-setor').value.trim(),
        observacoes: form.querySelector('#estoque-observacoes').value.trim(),
        cadastrado_gpm: form.querySelector('#maquina-cadastrado-gpm').checked,
        categoria: 'COMPUTADOR'
    };

    try {
        await createItem(dados);
        Toastify({ text: "Máquina adicionada ao estoque!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        form.reset();
        carregarDados();
    } catch (error) {
        console.error("Erro ao adicionar máquina:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

async function salvarMobiliario(event) {
    event.preventDefault();
    const form = event.target;
    const dados = {
        modelo_tipo: form.querySelector('#mobiliario-tipo').value.trim(),
        patrimonio: form.querySelector('#mobiliario-patrimonio').value.trim(),
        setor: form.querySelector('#mobiliario-material').value.trim(),
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
    
    // Recolhe os IDs de TODOS os monitores selecionados
    const monitoresSelect = document.getElementById('id-monitores-emprestimo');
    const monitoresIds = [...monitoresSelect.selectedOptions].map(option => parseInt(option.value));

    if (!pessoa || !itemId) {
        alert("Pessoa e Máquina são obrigatórios.");
        return;
    }

    // Cria o objeto de dados para a API, incluindo os IDs dos monitores
    const dadosEmprestimo = {
        item_id: parseInt(itemId),
        pessoa_depto: pessoa,
        monitores_ids: monitoresIds // Envia o array de IDs
    };

    try {
        await createEmprestimo(dadosEmprestimo);
        Toastify({ text: "Empréstimo registado com sucesso!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        document.getElementById('form-maquina').reset();
        carregarDados(); // Recarrega tudo para atualizar as listas
    } catch (error) {
        console.error("Erro ao salvar associação:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
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

async function salvarMonitorEstoque(event) {
    event.preventDefault(); // Impede o recarregamento da página
    const form = event.target;

    const dados = {
        modelo_tipo: form.querySelector('#monitor-estoque-modelo').value.trim(),
        setor: form.querySelector('#monitor-estoque-setor').value.trim(),
        patrimonio: form.querySelector('#monitor-estoque-patrimonio').value.trim(),
        cadastrado_gpm: form.querySelector('#monitor-cadastrado-gpm').checked,
        categoria: 'MONITOR' // Define a categoria correta para o item
    };

    try {
        // Usa a mesma função da API para criar qualquer item de inventário
        await createItem(dados); 
        
        Toastify({ 
            text: "Monitor adicionado ao inventário com sucesso!", 
            backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" 
        }).showToast();
        
        form.reset();
        
        // Recarrega todos os dados para atualizar as listas na página
        carregarDados();

    } catch(error) {
        console.error("Erro ao adicionar monitor:", error);
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
    if (!confirm("Tem a certeza que deseja excluir este item permanentemente?")) return;

    console.log("Excluindo item com ID:", itemId);

    try {
        await deleteItem(itemId);
        Toastify({ text: "Item excluído com sucesso!", backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)" }).showToast();
        carregarDados();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
}

// ... Funções de Salvar Alterações (Modais) devem ser adaptadas similarmente ...


// =================================================================
// 6. FUNÇÕES AUXILIARES E EVENT LISTENERS
// =================================================================

function popularDropdownMaquinas() {
    const maquinaSelect = document.getElementById('id-maquina-emprestimo');
    if (!maquinaSelect) return;

    maquinaSelect.innerHTML = '<option value="" disabled selected>-- Selecione uma máquina disponível --</option>';

    const maquinasDisponiveis = todoEstoque.filter(item =>
        item.categoria === 'COMPUTADOR' && item.status === 'Disponível'
    );

    maquinasDisponiveis.sort((a, b) => a.modelo_tipo.localeCompare(b.modelo_tipo));

    maquinasDisponiveis.forEach(maquina => {
        const option = document.createElement('option');
        option.value = maquina.id;
        option.textContent = `${maquina.modelo_tipo} (Património: ${maquina.patrimonio})`;
        maquinaSelect.appendChild(option);
    });
}

function popularDropdownMobiliario() {
    const mobiliarioSelect = document.getElementById('id-mobiliario-emprestimo');
    if (!mobiliarioSelect) return;

    mobiliarioSelect.innerHTML = '<option value="" disabled selected>-- Selecione um item disponível --</option>';

    const mobiliarioDisponivel = todoEstoque.filter(item =>
        item.categoria === 'MOBILIARIO' && item.status === 'Disponível'
    );
    
    mobiliarioDisponivel.sort((a, b) => a.modelo_tipo.localeCompare(b.modelo_tipo));

    mobiliarioDisponivel.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.modelo_tipo} (Património: ${item.patrimonio})`;
        mobiliarioSelect.appendChild(option);
    });
}

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
            option.textContent = `${monitor.modelo_tipo} (Património: ${monitor.patrimonio})`;
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


// =================================================================
// 7. CÓDIGO EXECUTADO QUANDO A PÁGINA CARREGA
// =================================================================

// Inicia a verificação de autenticação assim que o script carrega
checkAuth();

document.addEventListener('DOMContentLoaded', () => {
    // --- GESTORES DE EVENTOS PARA FORMULÁRIOS ---
    const formPrincipal = document.getElementById('form-maquina');
    if (formPrincipal) formPrincipal.addEventListener('submit', salvarAssociacao);

    const formEstoque = document.getElementById('form-estoque');
    if (formEstoque) formEstoque.addEventListener('submit', salvarMaquinaEstoque);

    const formMobiliario = document.getElementById('form-mobiliario');
    if (formMobiliario) formMobiliario.addEventListener('submit', salvarMobiliario);

    const formAssociarMobiliario = document.getElementById('form-associar-mobiliario');
    if (formAssociarMobiliario) formAssociarMobiliario.addEventListener('submit', salvarAssociacaoMobiliario);
    
    // Supondo que você tenha um formulário para o modal de edição
    const formEditarMaquina = document.getElementById('form-editar-maquina');
    if (formEditarMaquina) formEditarMaquina.addEventListener('submit', salvarAlteracoesMaquina);
    
    const formEstoqueMonitor = document.getElementById('form-estoque-monitor');
    if (formEstoqueMonitor) formEstoqueMonitor.addEventListener('submit', salvarMonitorEstoque);


    const formEditarMobiliario = document.getElementById('form-editar-mobiliario');
    if (formEditarMobiliario) formEditarMobiliario.addEventListener('submit', salvarAlteracoesMobiliario);

    const btnCancelarEdicaoMobiliario = document.getElementById('btn-editar-mobiliario-cancelar');
    if (btnCancelarEdicaoMobiliario) btnCancelarEdicaoMobiliario.addEventListener('click', fecharModalEditarMobiliario);

    const formEditarMonitor = document.getElementById('form-editar-monitor');
    if (formEditarMonitor) formEditarMonitor.addEventListener('submit', salvarAlteracoesMonitor);

    const btnCancelarEdicaoMonitor = document.getElementById('btn-editar-monitor-cancelar');
    if (btnCancelarEdicaoMonitor) btnCancelarEdicaoMonitor.addEventListener('click', fecharModalEditarMonitor);

    const btnMudarSenha = document.getElementById('btn-mudar-senha');
    if(btnMudarSenha) btnMudarSenha.addEventListener('click', abrirModalSenha);

    const formMudarSenha = document.getElementById('form-mudar-senha');
    if(formMudarSenha) formMudarSenha.addEventListener('submit', mudarSenha);

    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if(btnSenhaCancelar) btnSenhaCancelar.addEventListener('click', fecharModalSenha);

    const btnExportar = document.getElementById('btn-exportar');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarParaCSV);
    }

    const formNovoModelo = document.getElementById('form-novo-modelo');
    if (formNovoModelo) {
        formNovoModelo.addEventListener('submit', salvarNovoModelo);
    }


    // --- GESTORES DE EVENTOS PARA BOTÕES ESTÁTICOS ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }

    // Botões para fechar/cancelar os modais
    const btnFecharSpec = document.getElementById('btn-spec-fechar');
    if (btnFecharSpec) {
        btnFecharSpec.addEventListener('click', fecharModalEspecificacoes);
    }

    const btnCancelarEdicao = document.getElementById('btn-editar-maquina-cancelar');
    if (btnCancelarEdicao) {
        btnCancelarEdicao.addEventListener('click', fecharModalEditarMaquina);
    }


    // --- GESTORES DE EVENTOS PARA CAMPOS DE BUSCA ---
    const campoBuscaEstoque = document.getElementById('campo-busca-estoque');
    if(campoBuscaEstoque) campoBuscaEstoque.addEventListener('input', renderizarEstoque);

    const campoBuscaMobiliario = document.getElementById('campo-busca-mobiliario');
    if(campoBuscaMobiliario) campoBuscaMobiliario.addEventListener('input', renderizarMobiliario);

    const campoBuscaAssociacoes = document.getElementById('campo-busca');
    if (campoBuscaAssociacoes && window.location.pathname.includes('lista.html')) {
    campoBuscaAssociacoes.addEventListener('input', renderizarAssociacoes);
}
    if (campoBuscaAssociacoes && window.location.pathname.includes('lista_mobiliario.html')) {
        campoBuscaAssociacoes.addEventListener('input', renderizarAssociacoesMobiliario);
    }


    if (campoBuscaAssociacoes && window.location.pathname.includes('lista_mobiliario.html')) {
    campoBuscaAssociacoes.addEventListener('input', renderizarAssociacoesMobiliario);
}

    const btnExportarMobiliario = document.getElementById('btn-exportar-mobiliario');
    if (btnExportarMobiliario) {
        btnExportarMobiliario.addEventListener('click', exportarMobiliarioCSV);
    }


    const filtroDepartamento = document.getElementById('filtro-departamento');
    if (filtroDepartamento) {
        filtroDepartamento.addEventListener('change', renderizarAssociacoes);
    }

    const filtroDepartamentoMobiliario = document.getElementById('filtro-departamento');
    if (filtroDepartamentoMobiliario && window.location.pathname.includes('lista_mobiliario.html')) {
        filtroDepartamentoMobiliario.addEventListener('change', renderizarAssociacoesMobiliario);
    }

    const modeloSelect = document.getElementById('estoque-modelo');
    if (modeloSelect) {
        modeloSelect.addEventListener('change', (event) => {
            const nomeModeloSelecionado = event.target.value;
            const modelo = todosModelos.find(m => m.nome_modelo === nomeModeloSelecionado);

            if (modelo) {
                // Preenche os campos do formulário com as especificações do modelo
                document.getElementById('estoque-processador').value = modelo.espec_processador || '';
                document.getElementById('estoque-ram').value = modelo.espec_ram || '';
                document.getElementById('estoque-armazenamento').value = modelo.espec_armazenamento || '';
            }
        });
    }


    // --- GESTOR DE EVENTOS CENTRALIZADO PARA ITENS DINÂMICOS (BOTÕES NAS LISTAS) ---
    document.body.addEventListener('click', (event) => {
    const target = event.target;
    if (target.disabled) return;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('btn-editar-estoque')) {
        const itemParaEditar = todoEstoque.find(i => i.id == id);
        if (itemParaEditar) {
            // Verifica a categoria do item e chama a função do modal correto
            if (itemParaEditar.categoria.toUpperCase() === 'COMPUTADOR') {
                abrirModalEditarMaquina(parseInt(id));
            } else if (itemParaEditar.categoria.toUpperCase() === 'MOBILIARIO') {
                abrirModalEditarMobiliario(parseInt(id));
            } else if (itemParaEditar.categoria.toUpperCase() === 'MONITOR') {
              abrirModalEditarMonitor(parseInt(id)); 
            }
        }
    } else if (target.classList.contains('spec-link')) {
        event.preventDefault();
        abrirModalEspecificacoes(parseInt(id));
    } else if (target.classList.contains('btn-devolver')) {
        devolverMaquina(parseInt(id));
    } else if (target.classList.contains('btn-excluir-estoque')) {
        excluirMaquinaEstoque(parseInt(id));
    }
});
});