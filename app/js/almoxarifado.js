import {
    getItens,
    createItem,
    updateItem,
    deleteItem,
    getSetores,
    registrarSaidaAlmoxarifado,
    getHistoricoItemAlmoxarifado,
    devolverItemAlmoxarifado,
    apiChangePassword,
    createAlmoxarifadoItem,
    getAnexosItem,
    API_BASE_URL
} from '../js/api.js';

let todoEstoque = [];
let mapaDeUso = {};
let arquivosParaUpload = [];

// Funções de Autenticação e Carregamento
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        if (window.location.pathname.indexOf('login.html') === -1) {
            window.location.href = '../html/login.html';
        }
    } else {
        carregarDados();
    }

    const dadosUtilizador = parseJwt(token);
    if (dadosUtilizador && dadosUtilizador.departamento.toUpperCase() !== 'GAS') {
        // Se o setor não for GAS, redireciona para a página principal
        window.location.href = '../html/index.html';
        return; 
    }
}

async function carregarDados() {
    exibirInfoUtilizador();
    try {
        const itens = await getItens();
        todoEstoque = itens;
        renderizarAlmoxarifado();
    } catch (error) {
        console.error("Erro ao carregar dados do almoxarifado:", error);
    }
}

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

function exibirInfoUtilizador() {
    const infoUtilizadorUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    if (infoUtilizadorUI && token) {
        const dadosUtilizador = parseJwt(token);
        if (dadosUtilizador) {
            const nome = dadosUtilizador.nome || 'Utilizador';
            const depto = dadosUtilizador.departamento || 'N/D';
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

            const navAlmoxarifado = document.getElementById('nav-almoxarifado');
            if (navAlmoxarifado && depto.toUpperCase() === 'GAS') {
                navAlmoxarifado.style.display = 'block';
            }
        }
    }
}


// Funções de Renderização
async function renderizarAlmoxarifado() {
    const listaUI = document.getElementById('lista-almoxarifado');
    if (!listaUI) return;

    const todosItensAlmoxarifado = todoEstoque.filter(item => item.categoria === 'ALMOXARIFADO');
    const historicoCompleto = [];
    if (todosItensAlmoxarifado.length > 0) {
        const promisesHistorico = todosItensAlmoxarifado.map(item => getHistoricoItemAlmoxarifado(item.id));
        const resultadosHistorico = await Promise.all(promisesHistorico);
        resultadosHistorico.forEach(hist => historicoCompleto.push(...hist));
    }

    const emprestimosAtivos = historicoCompleto.filter(mov => mov.tipo_movimentacao === 'SAIDA' && !mov.data_devolucao);
    const contagemEmprestimos = emprestimosAtivos.reduce((acc, mov) => {
        acc[mov.item_id] = (acc[mov.item_id] || 0) + mov.quantidade_movimentada;
        return acc;
    }, {});
    
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

                <button class="btn-item btn-anexos" data-id="${item.id}" data-nome="${item.modelo_tipo}">Anexos</button>

                <button class="btn-item btn-editar-estoque" data-id="${item.id}">Editar</button>
                <button class="btn-item btn-excluir-estoque" data-id="${item.id}">Excluir</button>
            `;
        const emprestimoBadgeHTML = qtdEmprestada > 0
            ? `<span class="status-badge status-em-emprestimo">${qtdEmprestada} em Empréstimo</span>`
            : '';
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

// Funções de Modal
function abrirModalEditarAlmoxarifado(itemId) {
    const item = todoEstoque.find(i => i.id == itemId);
    if (!item) return;
    document.getElementById('editar-almox-id').value = item.id;
    document.getElementById('editar-almox-nome').value = item.modelo_tipo || '';
    document.getElementById('editar-almox-sku').value = item.patrimonio || '';
    document.getElementById('editar-almox-quantidade').value = item.quantidade || 0;
    document.getElementById('editar-almox-observacoes').value = item.observacoes || '';
    document.getElementById('modal-almoxarifado-editar').classList.add('visible');
}

function fecharModalEditarAlmoxarifado() {
    document.getElementById('modal-almoxarifado-editar').classList.remove('visible');
}

function abrirModalSaida(itemId, itemName, itemQuantidade) {
    document.getElementById('modal-saida-item-id').value = itemId;
    document.getElementById('modal-saida-nome-item').textContent = itemName;
    document.getElementById('modal-saida-estoque-atual').textContent = itemQuantidade;
    document.getElementById('modal-saida-quantidade').max = itemQuantidade;
    document.getElementById('form-saida-almoxarifado').reset();
    document.getElementById('modal-saida-almoxarifado').style.display = 'flex';
}

async function abrirModalHistoricoAlmoxarifado(itemId, itemName) {
    document.getElementById('modal-historico-nome-item').textContent = itemName;
    const modal = document.getElementById('modal-historico-almoxarifado');
    const tabelaBody = modal.querySelector('tbody');
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
            let dataPrevistaFormatada = 'N/A';
            if (mov.data_prevista_devolucao) {
                dataPrevistaFormatada = new Date(mov.data_prevista_devolucao).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            }
            const ehEmprestimoAtivo = mov.tipo_movimentacao === 'SAIDA' && !mov.data_devolucao;
            let acaoHTML = '';
            if (ehEmprestimoAtivo) {
                acaoHTML = `<button class="btn-item btn-devolver" data-mov-id="${mov.id}">Devolver</button>`;
            } else if (mov.data_devolucao && mov.tipo_movimentacao === 'DEVOLUCAO') {
                acaoHTML = `Devolvido em ${new Date(mov.data_devolucao).toLocaleString('pt-BR')}`;
            } else {
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

function abrirModalSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) modal.classList.add('visible');
}

function fecharModalSenha() {
    const modal = document.getElementById('modal-senha');
    if (modal) modal.classList.remove('visible');
}

async function abrirModalAnexos(itemId, itemName) {
    const modal = document.getElementById('modal-anexos');
    const listaUI = document.getElementById('lista-anexos');

    document.getElementById('modal-anexos-nome-item').textContent = itemName;
    listaUI.innerHTML = '<li>Carregando anexos...</li>';
    modal.classList.add('visible');

    try {
        const anexos = await getAnexosItem(itemId);
        listaUI.innerHTML = ''; // Limpa o "Carregando..."

        if (anexos.length === 0) {
            listaUI.innerHTML = '<li>Nenhum anexo encontrado para este item.</li>';
            return;
        }
        const BACKEND_BASE_URL = 'http://localhost:3000';

        anexos.forEach(anexo => {
            const li = document.createElement('li');
            // IMPORTANTE: Construa a URL completa para o arquivo
            const urlArquivo = `${BACKEND_BASE_URL}/${anexo.caminho_arquivo}`;

            li.innerHTML = `
                <a href="${urlArquivo}" target="_blank" class="link-anexo">
                    <i class="fas fa-file-alt"></i> ${anexo.nome_arquivo}
                </a>
            `;
            listaUI.appendChild(li);
        });

    } catch (error) {
        console.error("Erro ao buscar anexos:", error);
        listaUI.innerHTML = `<li>Erro ao carregar anexos: ${error.message}</li>`;
    }
}

function fecharModalAnexos() {
    const modal = document.getElementById('modal-anexos');
    if (modal) {
        modal.classList.remove('visible');
    }
}

// Funções CRUD
async function salvarItemAlmoxarifado(event) {
    event.preventDefault();
    const form = event.target;

    const formData = new FormData();

    // Adiciona os campos de texto
    formData.append('modelo_tipo', form.querySelector('#almox-nome').value.trim());
    formData.append('patrimonio', form.querySelector('#almox-sku').value.trim());
    formData.append('quantidade', parseInt(form.querySelector('#almox-quantidade').value, 10));
    formData.append('observacoes', form.querySelector('#almox-observacoes').value.trim());
    formData.append('setor', 'Almoxarifado'); 

    // Validação de quantidade (mantida)
    if (isNaN(parseInt(form.querySelector('#almox-quantidade').value, 10))) {
        Toastify({ text: 'Por favor, insira uma quantidade válida.', backgroundColor: "red" }).showToast();
        return;
    }

    // MODIFICADO: Adiciona os ficheiros do nosso array
    if (arquivosParaUpload.length > 0) {
        for (const file of arquivosParaUpload) {
            formData.append('anexos', file); 
        }
    } else {
        // Opcional: pode remover esta verificação se anexos não forem obrigatórios
        // Toastify({ text: 'Adicione pelo menos um anexo.', backgroundColor: "orange" }).showToast();
        // return;
    }

    try {
        await createAlmoxarifadoItem(formData);

        Toastify({ text: "Item adicionado ao almoxarifado!" }).showToast();
        form.reset();
        arquivosParaUpload = []; // Limpa o array de ficheiros
        renderizarListaArquivosUpload(); // Limpa a lista na interface
        carregarDados();
    } catch (error) {
        console.error("Erro ao adicionar item de almoxarifado:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
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

async function excluirItemAlmoxarifado(itemId) {
    const item = todoEstoque.find(i => i.id == itemId);
    const nomeItem = item ? item.modelo_tipo : 'este item';
    if (confirm(`Tem a certeza que deseja excluir "${nomeItem}" permanentemente?`)) {
        try {
            await deleteItem(itemId);
            Toastify({ text: "Item excluído com sucesso!" }).showToast();
            carregarDados();
        } catch (error) {
            console.error("Erro ao excluir:", error);
            Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
        }
    }
}

async function handleSubmissaoSaida(event) {
    event.preventDefault();
    const form = event.target;
    const tipoSaida = form.querySelector('input[name="tipoSaida"]:checked').value;
    const dataRetorno = form.querySelector('#modal-saida-data-retorno').value;
    const dados = {
        itemId: form.querySelector('#modal-saida-item-id').value,
        quantidade: parseInt(form.querySelector('#modal-saida-quantidade').value, 10),
        pessoaNome: form.querySelector('#modal-saida-pessoa').value.trim() || null,
        setor: form.querySelector('#modal-saida-setor').value || null,
        observacoes: form.querySelector('#modal-saida-observacoes').value.trim(),
        ehDevolucao: tipoSaida === 'emprestimo',
        data_prevista_devolucao: (tipoSaida === 'emprestimo' && dataRetorno) ? dataRetorno : null
    };
    if (!dados.pessoaNome && !dados.setor) {
        Toastify({ text: 'Preencha o nome da pessoa ou selecione um setor.', backgroundColor: "orange" }).showToast();
        return;
    }
    try {
        await registrarSaidaAlmoxarifado(dados);
        Toastify({ text: "Saída registrada com sucesso!" }).showToast();
        document.getElementById('modal-saida-almoxarifado').style.display = 'none';
        carregarDados();
    } catch (error) {
        console.error("Erro ao registrar saída:", error);
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
    }
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

// Funções Auxiliares
async function popularDropdownSetores() {
    const ids = ['modal-saida-setor'];
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
                option.value = setor.nome;
                option.textContent = setor.nome;
                selectElement.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
        selects.forEach(s => s.innerHTML = '<option value="">Erro ao carregar</option>');
    }
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
    let csvContent = '\uFEFF';
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
    csvContent += '\n';
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csvContent);
    link.download = 'relatorio_almoxarifado.csv';
    link.click();
}

function renderizarListaArquivosUpload() {
    const container = document.getElementById('lista-anexos-upload');
    if (!container) return;

    container.innerHTML = ''; // Limpa a lista
    if (arquivosParaUpload.length === 0) {
        container.innerHTML = '<small>Nenhum anexo selecionado.</small>';
        return;
    }

    arquivosParaUpload.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.classList.add('anexo-item-upload');
        fileElement.innerHTML = `
            <span><i class="fas fa-paperclip"></i> ${file.name}</span>
            <button type="button" class="btn-remover-anexo" data-index="${index}" title="Remover">&times;</button>
        `;
        container.appendChild(fileElement);
    });
}

// NOVA FUNÇÃO: Remove um ficheiro da lista
function removerArquivoUpload(index) {
    arquivosParaUpload.splice(index, 1); // Remove o ficheiro do array
    renderizarListaArquivosUpload(); // Re-renderiza a lista
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    popularDropdownSetores();
    renderizarListaArquivosUpload();

    document.getElementById('form-almoxarifado')?.addEventListener('submit', salvarItemAlmoxarifado);
    document.getElementById('form-editar-almoxarifado')?.addEventListener('submit', salvarEdicaoAlmoxarifado);
    document.getElementById('campo-busca-almoxarifado')?.addEventListener('input', renderizarAlmoxarifado);
    document.getElementById('filtro-em-emprestimo')?.addEventListener('change', renderizarAlmoxarifado);
    document.getElementById('btn-editar-almox-cancelar')?.addEventListener('click', fecharModalEditarAlmoxarifado);
    document.getElementById('form-saida-almoxarifado')?.addEventListener('submit', handleSubmissaoSaida);
    document.getElementById('btn-mudar-senha-sidebar')?.addEventListener('click', abrirModalSenha);
    document.getElementById('btn-senha-cancelar')?.addEventListener('click', fecharModalSenha);
    document.getElementById('form-mudar-senha')?.addEventListener('submit', mudarSenha);
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('collapsed');
        document.querySelector('.main-content').classList.toggle('expanded');
    });
    document.getElementById('btn-logout-sidebar')?.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = '../html/login.html';
    });
    const submenuParent = document.querySelector('.has-submenu');
    if (submenuParent) {
        submenuParent.querySelector('a').addEventListener('click', function(event) {
            event.preventDefault();
            submenuParent.classList.toggle('open');
        });
    }

    document.getElementById('lista-almoxarifado')?.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('btn-retirada')) {
            abrirModalSaida(target.dataset.id, target.dataset.nome, target.dataset.qtd);
        } else if (target.classList.contains('btn-historico')) {
            abrirModalHistoricoAlmoxarifado(target.dataset.id, target.dataset.nome);
        } else if (target.classList.contains('btn-editar-estoque')) {
            abrirModalEditarAlmoxarifado(target.dataset.id);
        } else if (target.classList.contains('btn-excluir-estoque')) {
            excluirItemAlmoxarifado(target.dataset.id);
        }else if (target.classList.contains('btn-anexos')) { 
        abrirModalAnexos(target.dataset.id, target.dataset.nome);
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.target.closest('.modal-container').style.display = 'none';
        });
    });
     document.getElementById('modal-historico-almoxarifado')?.addEventListener('click', async (event) => {
        if (event.target.classList.contains('btn-devolver')) {
            const movId = event.target.dataset.movId;
            if (confirm('Deseja realmente registrar a devolução deste item?')) {
                try {
                    await devolverItemAlmoxarifado(movId);
                    Toastify({ text: "Item devolvido com sucesso!" }).showToast();
                    document.getElementById('modal-historico-almoxarifado').style.display = 'none';
                    carregarDados();
                } catch (error) {
                    Toastify({ text: `Erro: ${error.message}`, backgroundColor: "red" }).showToast();
                }
            }
        }
    });
    document.querySelectorAll('input[name="tipoSaida"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const containerData = document.getElementById('container-data-retorno');
            containerData.style.display = (event.target.value === 'emprestimo') ? 'block' : 'none';
        });
    });

    document.getElementById('btn-anexos-fechar')?.addEventListener('click', fecharModalAnexos);

    const inputAnexos = document.getElementById('almox-anexos');
    if (inputAnexos) {
        inputAnexos.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                // Adiciona os novos ficheiros ao nosso array
                arquivosParaUpload.push(...event.target.files);
                renderizarListaArquivosUpload();
            }
            // Limpa o input para que o utilizador possa selecionar mais ficheiros
            event.target.value = null; 
        });
    }

    const listaUploadContainer = document.getElementById('lista-anexos-upload');
    if (listaUploadContainer) {
        listaUploadContainer.addEventListener('click', (event) => {
            // Verifica se o clique foi no botão de remover
            if (event.target.classList.contains('btn-remover-anexo')) {
                const index = event.target.dataset.index;
                removerArquivoUpload(parseInt(index, 10));
            }
        });
    }

    // Modal de Exportação
    const fecharModalExportAlmoxarifado = () => {
        const modal = document.getElementById('modal-exportar-almoxarifado');
        if (modal) modal.classList.remove('visible');
    };
    document.getElementById('btn-abrir-modal-exportar-almoxarifado')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-exportar-almoxarifado');
        if (modal) modal.classList.add('visible');
    });
    document.getElementById('btn-fechar-modal-exportar-almoxarifado')?.addEventListener('click', fecharModalExportAlmoxarifado);
    document.getElementById('btn-exportar-almoxarifado-csv')?.addEventListener('click', () => {
        exportarAlmoxarifadoCSV();
        fecharModalExportAlmoxarifado();
    });
    document.getElementById('btn-exportar-almoxarifado-pdf')?.addEventListener('click', () => {
        exportarAlmoxarifadoPDF();
        fecharModalExportAlmoxarifado();
    });
});