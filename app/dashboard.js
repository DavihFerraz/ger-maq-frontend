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
    const infoUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    if (infoUI && token) {
        const dados = parseJwt(token);
        if (dados) {
            infoUI.innerHTML = `<span><i class="fas fa-user-circle"></i> Olá, <strong>${dados.nome}</strong> (${dados.departamento})</span>`;
        }
    }
}

function renderizarResumos(dados) {
    document.getElementById('resumo-maquinas-total').textContent = dados.resumoMaquinas.total || 0;
    document.getElementById('resumo-maquinas-disponivel').textContent = dados.resumoMaquinas.disponivel || 0;
    document.getElementById('resumo-maquinas-em-uso').textContent = dados.resumoMaquinas.em_uso || 0;
    document.getElementById('resumo-mobiliario-total').textContent = dados.resumoMobiliario.total || 0;
    document.getElementById('resumo-mobiliario-disponivel').textContent = dados.resumoMobiliario.disponivel || 0;
    document.getElementById('resumo-mobiliario-em-uso').textContent = dados.resumoMobiliario.em_uso || 0;
    document.getElementById('resumo-outros-total').textContent = dados.resumoOutros.total || 0;
    document.getElementById('resumo-outros-disponivel').textContent = dados.resumoOutros.disponivel || 0;
    document.getElementById('resumo-outros-em-uso').textContent = dados.resumoOutros.em_uso || 0;
}

function renderizarGraficoDepartamentos(dados) {
    const ctx = document.getElementById('grafico-departamentos').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.departamento),
            datasets: [{
                label: 'Nº de Empréstimos',
                data: dados.map(d => d.total),
                backgroundColor: '#3498db',
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
    });
}

function renderizarGraficoSetores(dados) {
    const ctx = document.getElementById('grafico-setores').getContext('2d');
    const dadosAgrupados = dados.reduce((acc, item) => {
        acc[item.setor] = acc[item.setor] || { COMPUTADOR: 0, MOBILIARIO: 0 };
        acc[item.setor][item.categoria] = item.quantidade;
        return acc;
    }, {});

    const setores = Object.keys(dadosAgrupados);
    if (graficoSetoresInstance) graficoSetoresInstance.destroy();
    
    graficoSetoresInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: setores,
            datasets: [
                { label: 'Máquinas', data: setores.map(s => dadosAgrupados[s].COMPUTADOR || 0), backgroundColor: '#2980b9' },
                { label: 'Mobiliário', data: setores.map(s => dadosAgrupados[s].MOBILIARIO || 0), backgroundColor: '#27ae60' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: false, ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 } },
                y: { stacked: false, beginAtZero: true }
            }
        }
    });
}

function renderizarGraficoNaoLocalizados(dados) {
    const ctx = document.getElementById('grafico-nao-localizados').getContext('2d');
    const labels = dados.map(item => item.categoria);
    const quantidades = dados.map(item => item.quantidade);

    if (graficoNaoLocalizadosInstance) graficoNaoLocalizadosInstance.destroy();

    graficoNaoLocalizadosInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade',
                data: quantidades,
                backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'],
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
}

function renderizarGraficoEstado(dados) {
    const ctx = document.getElementById('grafico-estado-conservacao').getContext('2d');
    const labels = dados.map(item => item.estado_conservacao);
    const quantidades = dados.map(item => item.quantidade);
    
    const colorMap = {
        'Novo': '#27ae60',
        'Bom': '#3498db',
        'Regular': '#f39c12',
        'Inservível': '#e74c3c',
        'default': '#95a5a6'
    };
    const backgroundColors = labels.map(label => colorMap[label] || colorMap['default']);

    if (graficoEstadoInstance) graficoEstadoInstance.destroy();

    graficoEstadoInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade',
                data: quantidades,
                backgroundColor: backgroundColors
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function renderizarAtividadeRecente(atividades) {
    const listaUI = document.getElementById('lista-atividade-recente');
    listaUI.innerHTML = '';
    if (atividades.length === 0) {
        listaUI.innerHTML = '<li>Nenhuma atividade recente.</li>';
        return;
    }
    atividades.forEach(item => {
        const li = document.createElement('li');
        const acao = item.data_devolucao ? 'devolveu' : 'recebeu';
        li.innerHTML = `<strong>${item.pessoa_depto}</strong> ${acao} <em>${item.modelo_tipo}</em>`;
        listaUI.appendChild(li);
    });
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

// **NOVA FUNÇÃO PARA EXPORTAR**
async function exportarRelatorioDashboard() {
    const btn = document.getElementById('btn-exportar-dashboard');
    btn.textContent = 'A gerar...';
    btn.disabled = true;

    try {
        const token = localStorage.getItem('authToken');
        // A URL base já é definida no seu ficheiro api.js
        const response = await fetch('http://localhost:3000/api/dashboard/export', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Falha ao gerar o relatório no servidor.');
        }

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
        btn.textContent = 'Exportar Relatório';
        btn.disabled = false;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('authToken')) {
        window.location.href = 'login.html';
        return;
    }
    
    carregarDashboard();
    
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });
    
    document.getElementById('btn-exportar-dashboard').addEventListener('click', exportarRelatorioDashboard);
});