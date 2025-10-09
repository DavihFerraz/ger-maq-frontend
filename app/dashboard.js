import { getDashboardData } from './api.js';

let dadosCompletosDashboard = null;
let graficoSetoresInstance = null;
let graficoNaoLocalizadosInstance = null;
let graficoEstadoInstance = null;

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
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
            infoUtilizadorUI.innerHTML = `<span><i class="fas fa-user-circle" style="color: ${colors.icon};"></i> Olá, <strong style="background-color: ${colors.bg}; color: ${colors.text};">${nome}</strong> (${depto})</span>`;
        }
    }
}

function renderizarResumos(dados) {
    document.getElementById('resumo-computadores-total').textContent = dados.resumoComputadores.total || 0;
    document.getElementById('resumo-computadores-disponivel').textContent = dados.resumoComputadores.disponivel || 0;
    document.getElementById('resumo-computadores-em-uso').textContent = dados.resumoComputadores.em_uso || 0;
    document.getElementById('resumo-monitores-total').textContent = dados.resumoMonitores.total || 0;
    document.getElementById('resumo-monitores-disponivel').textContent = dados.resumoMonitores.disponivel || 0;
    document.getElementById('resumo-monitores-em-uso').textContent = dados.resumoMonitores.em_uso || 0;
    document.getElementById('resumo-mobiliario-total').textContent = dados.resumoMobiliario.total || 0;
    document.getElementById('resumo-mobiliario-disponivel').textContent = dados.resumoMobiliario.disponivel || 0;
    document.getElementById('resumo-mobiliario-em-uso').textContent = dados.resumoMobiliario.em_uso || 0;
    document.getElementById('resumo-outros-total').textContent = dados.resumoOutros.total || 0;
    document.getElementById('resumo-outros-disponivel').textContent = dados.resumoOutros.disponivel || 0;
    document.getElementById('resumo-outros-em-uso').textContent = dados.resumoOutros.em_uso || 0;
}

function renderizarGraficoDepartamentos(dados) {
    const ctx = document.getElementById('grafico-departamentos').getContext('2d');
    new Chart(ctx, { type: 'bar', data: { labels: dados.map(d => d.departamento), datasets: [{ label: 'Nº de Empréstimos', data: dados.map(d => d.total), backgroundColor: '#3498db', }] }, options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
}

function renderizarGraficoSetores(dados) {
    const ctx = document.getElementById('grafico-setores').getContext('2d');
    const dadosAgrupados = dados.reduce((acc, item) => { acc[item.setor] = acc[item.setor] || { COMPUTADOR: 0, MOBILIARIO: 0, MONITOR: 0 }; acc[item.setor][item.categoria] = item.quantidade; return acc; }, {});
    const setores = Object.keys(dadosAgrupados);
    if (graficoSetoresInstance) graficoSetoresInstance.destroy();
    graficoSetoresInstance = new Chart(ctx, { type: 'bar', data: { labels: setores, datasets: [ { label: 'Computadores', data: setores.map(s => dadosAgrupados[s].COMPUTADOR || 0), backgroundColor: '#2980b9' }, { label: 'Monitores', data: setores.map(s => dadosAgrupados[s].MONITOR || 0), backgroundColor: '#3498db' }, { label: 'Mobiliário', data: setores.map(s => dadosAgrupados[s].MOBILIARIO || 0), backgroundColor: '#27ae60' } ] }, options: { responsive: true, scales: { x: { stacked: false, ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 } }, y: { stacked: false, beginAtZero: true } } } });
}

function renderizarGraficoNaoLocalizados(dados) {
    const ctx = document.getElementById('grafico-nao-localizados').getContext('2d');
    if (graficoNaoLocalizadosInstance) graficoNaoLocalizadosInstance.destroy();
    graficoNaoLocalizadosInstance = new Chart(ctx, { type: 'pie', data: { labels: dados.map(item => item.categoria), datasets: [{ label: 'Quantidade', data: dados.map(item => item.quantidade), backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'], }] }, options: { responsive: true, plugins: { legend: { position: 'top' } } } });
}

function renderizarGraficoEstado(dados) {
    const ctx = document.getElementById('grafico-estado-conservacao').getContext('2d');
    const colorMap = { 'Novo': '#27ae60', 'Bom': '#3498db', 'Regular': '#f39c12', 'Inservível': '#e74c3c', 'default': '#95a5a6' };
    if (graficoEstadoInstance) graficoEstadoInstance.destroy();
    graficoEstadoInstance = new Chart(ctx, { type: 'doughnut', data: { labels: dados.map(item => item.estado_conservacao), datasets: [{ label: 'Quantidade', data: dados.map(item => item.quantidade), backgroundColor: dados.map(item => colorMap[item.estado_conservacao] || colorMap['default']) }] }, options: { responsive: true, plugins: { legend: { position: 'top' } } } });
}

function renderizarAtividadeRecente(atividades) {
    const listaUI = document.getElementById('lista-atividade-recente');
    listaUI.innerHTML = '';
    if (atividades.length === 0) { listaUI.innerHTML = '<li>Nenhuma atividade recente.</li>'; return; }
    atividades.forEach(item => { const li = document.createElement('li'); const acao = item.data_devolucao ? 'devolveu' : 'recebeu'; li.innerHTML = `<strong>${item.pessoa_depto}</strong> ${acao} <em>${item.modelo_tipo}</em>`; listaUI.appendChild(li); });
}

function exportDashboardToCSV() {
    if (!dadosCompletosDashboard) {
        alert('Os dados do dashboard ainda não foram carregados.');
        return;
    }

    const delimiter = ';';
    let csvContent = '\uFEFF';

    csvContent += 'Resumo Geral\n';
    csvContent += ['Categoria', 'Total', 'Disponivel', 'Em Uso'].join(delimiter) + '\n';
    const { resumoComputadores, resumoMonitores, resumoMobiliario, resumoOutros } = dadosCompletosDashboard;
    [
        ['Computadores', resumoComputadores.total, resumoComputadores.disponivel, resumoComputadores.em_uso],
        ['Monitores', resumoMonitores.total, resumoMonitores.disponivel, resumoMonitores.em_uso],
        ['Mobiliario', resumoMobiliario.total, resumoMobiliario.disponivel, resumoMobiliario.em_uso],
        ['Outros', resumoOutros.total, resumoOutros.disponivel, resumoOutros.em_uso]
    ].forEach(row => { csvContent += row.join(delimiter) + '\n'; });

    csvContent += '\nAtivos por Setor\n';
    csvContent += ['Setor', 'Categoria', 'Quantidade'].join(delimiter) + '\n';
    dadosCompletosDashboard.ativosPorSetor.forEach(row => {
        csvContent += `"${row.setor}";"${row.categoria}";"${row.quantidade}"\n`; 
    });

    csvContent += '\nAtivos por Estado de Conservacao\n';
    csvContent += ['Estado', 'Quantidade'].join(delimiter) + '\n';
    dadosCompletosDashboard.ativosPorEstado.forEach(row => {
        csvContent += `"${row.estado_conservacao}";"${row.quantidade}"\n`; // Usa 'count'
    });

    csvContent += '\nEmprestimos por Departamento\n';
    csvContent += ['Departamento', 'Quantidade'].join(delimiter) + '\n';
    dadosCompletosDashboard.emprestimosPorDepto.forEach(row => {
        csvContent += `"${row.departamento}";"${row.total}"\n`; // CORRIGIDO AQUI: Usa 'count'
    });

    csvContent += '\nAtivos Nao Localizados (sem setor definido)\n';
    csvContent += ['Categoria', 'Quantidade'].join(delimiter) + '\n';
    dadosCompletosDashboard.ativosNaoLocalizados.forEach(row => {
        csvContent += `"${row.categoria}";"${row.quantidade}"\n`; // Usa 'count'
    });

    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csvContent);
    link.download = "Relatorio_Dashboard_Completo.csv";
    link.click();
}
/**
 * Gera um relatório HTML do dashboard numa nova aba.
 */
function exportToPDF() {
    if (!dadosCompletosDashboard) {
        alert('Os dados do dashboard ainda não foram carregados.');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Não foi possível abrir a nova aba. Por favor, desative o bloqueador de pop-ups.");
        return;
    }

    const { 
        resumoComputadores, resumoMonitores, resumoMobiliario, resumoOutros, 
        ativosPorSetor, ativosPorEstado, emprestimosPorDepto, ativosNaoLocalizados 
    } = dadosCompletosDashboard;

    let relatorioHtml = `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório do Dashboard</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; } h1 { font-size: 24px; text-align: center; }
            h2 { font-size: 18px; border-bottom: 2px solid #3498db; padding-bottom: 5px; margin-top: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10pt; } th { background-color: #f2f2f2; }
        </style></head><body><div class="container"><h1>Relatório do Dashboard de Ativos</h1>

        <h2>Resumo Geral do Inventário</h2>
        <table><thead><tr><th>Categoria</th><th>Total</th><th>Disponível</th><th>Em Uso</th></tr></thead><tbody>
            <tr><td>Computadores</td><td>${resumoComputadores.total}</td><td>${resumoComputadores.disponivel}</td><td>${resumoComputadores.em_uso}</td></tr>
            <tr><td>Monitores</td><td>${resumoMonitores.total}</td><td>${resumoMonitores.disponivel}</td><td>${resumoMonitores.em_uso}</td></tr>
            <tr><td>Mobiliário</td><td>${resumoMobiliario.total}</td><td>${resumoMobiliario.disponivel}</td><td>${resumoMobiliario.em_uso}</td></tr>
            <tr><td>Outros</td><td>${resumoOutros.total}</td><td>${resumoOutros.disponivel}</td><td>${resumoOutros.em_uso}</td></tr>
        </tbody></table>

        <h2>Ativos por Setor</h2>
        <table><thead><tr><th>Setor</th><th>Categoria</th><th>Quantidade</th></tr></thead><tbody>
        ${ativosPorSetor.map(row => `<tr><td>${row.setor}</td><td>${row.categoria}</td><td>${row.quantidade}</td></tr>`).join('')}
        </tbody></table>

        <h2>Ativos por Estado de Conservação</h2>
        <table><thead><tr><th>Estado</th><th>Quantidade</th></tr></thead><tbody>
        ${ativosPorEstado.map(row => `<tr><td>${row.estado_conservacao}</td><td>${row.quantidade}</td></tr>`).join('')}
        </tbody></table>

        <h2>Empréstimos Ativos por Departamento</h2>
        <table><thead><tr><th>Departamento</th><th>Quantidade</th></tr></thead><tbody>
        ${emprestimosPorDepto.map(row => `<tr><td>${row.departamento}</td><td>${row.total}</td></tr>`).join('')}
        </tbody></table>

        <h2>Ativos Não Localizados (sem setor)</h2>
        <table><thead><tr><th>Categoria</th><th>Quantidade</th></tr></thead><tbody>
        ${ativosNaoLocalizados.map(row => `<tr><td>${row.categoria}</td><td>${row.quantidade}</td></tr>`).join('')}
        </tbody></table>

        </div></body></html>`;

    printWindow.document.open();
    printWindow.document.write(relatorioHtml);
    printWindow.document.close();
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
        // A importação de 'apiChangePassword' foi adicionada no topo do ficheiro
        const response = await apiChangePassword(senhaAtual, novaSenha);
        alert(response.message); // Usamos um alerta simples para a confirmação
        fecharModalSenha();
        document.getElementById('form-mudar-senha').reset();
    } catch (error) {
        alert("Erro: " + error.message);
    }
}

async function carregarDashboard() {
    exibirInfoUtilizador();
    try {
        dadosCompletosDashboard = await getDashboardData();
        if (dadosCompletosDashboard) {
            renderizarResumos(dadosCompletosDashboard);
            renderizarGraficoDepartamentos(dadosCompletosDashboard.emprestimosPorDepto);
            renderizarAtividadeRecente(dadosCompletosDashboard.atividadeRecente);
            renderizarGraficoSetores(dadosCompletosDashboard.ativosPorSetor);
            renderizarGraficoNaoLocalizados(dadosCompletosDashboard.ativosNaoLocalizados);
            renderizarGraficoEstado(dadosCompletosDashboard.ativosPorEstado);
        }
    } catch (error) {
        console.error("Falha ao carregar dados do dashboard:", error);
        alert("Não foi possível carregar os dados do dashboard. Tente novamente mais tarde.");
    }
}

async function exportarRelatorioDashboard() {
    const btn = document.getElementById('btn-exportar-dashboard-sidebar');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span class="nav-text">A gerar...</span>';
    btn.disabled = true;
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('http://10.42.1.199:3000/api/dashboard/export', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) { throw new Error('Falha ao gerar o relatório no servidor.'); }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Relatorio_Dashboard.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        alert('Não foi possível descarregar o relatório. Tente novamente.');
    } finally {
        btn.innerHTML = '<i class="fas fa-file-excel"></i> <span class="nav-text">Exportar Relatório</span>';
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }
    carregarDashboard();

    const fecharModalExport = () => {
        const modal = document.getElementById('modal-exportar');
        if (modal) modal.classList.remove('visible');
    };

    const btnExportCSV = document.getElementById('btn-exportar-dashboard-csv');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', (e) => {
            e.preventDefault();
            exportDashboardToCSV();
            fecharModalExport();
        });
    }

    const btnExportPDF = document.getElementById('btn-exportar-dashboard-pdf');
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', (e) => {
            e.preventDefault();
            exportToPDF();
            fecharModalExport();
        });
    }
    
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    });

    document.getElementById('btn-logout-sidebar').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });
    
    
  const btnMudarSenha = document.getElementById('btn-mudar-senha-sidebar');
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener('click', abrirModalSenha);
    }

    const formMudarSenha = document.getElementById('form-mudar-senha');
    if (formMudarSenha) {
        formMudarSenha.addEventListener('submit', mudarSenha);
    }

    const btnSenhaCancelar = document.getElementById('btn-senha-cancelar');
    if (btnSenhaCancelar) {
        btnSenhaCancelar.addEventListener('click', fecharModalSenha);
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
});