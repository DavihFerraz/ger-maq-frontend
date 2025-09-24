// app/dashboard.js
import { getDashboardData } from './api.js';

let dadosCompletosDashboard = null; // Para guardar os dados originais da API
let graficoSetoresInstance = null; // Para guardar a instância do gráfico e poder destruí-la

// Função para descodificar o token (sem alterações)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
}

// Função para exibir info do utilizador (sem alterações)
function exibirInfoUtilizador() {
    const infoUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    if (infoUI && token) {
        const dados = parseJwt(token);
        if (dados) {
            infoUI.innerHTML = `<span>Olá, <strong>${dados.nome}</strong> (${dados.departamento})</span>`;
        }
    }
}

// Funções para renderizar resumos e gráfico de depto (sem alterações)
function renderizarResumos(dados) {
    document.getElementById('resumo-maquinas-total').textContent = dados.resumoMaquinas.total || 0;
    document.getElementById('resumo-maquinas-disponivel').textContent = dados.resumoMaquinas.disponivel || 0;
    document.getElementById('resumo-maquinas-em-uso').textContent = dados.resumoMaquinas.em_uso || 0;
    document.getElementById('resumo-mobiliario-total').textContent = dados.resumoMobiliario.total || 0;
    document.getElementById('resumo-mobiliario-disponivel').textContent = dados.resumoMobiliario.disponivel || 0;
    document.getElementById('resumo-mobiliario-em-uso').textContent = dados.resumoMobiliario.em_uso || 0;
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

// ATUALIZADO: Função para renderizar o gráfico de setores com filtro
function renderizarGraficoSetores() {
    if (!dadosCompletosDashboard) return; // Garante que os dados já foram carregados

    const incluirMigrar = document.getElementById('filtro-migrar').checked;
    
    // Filtra os dados com base na checkbox
    const dadosFiltrados = incluirMigrar
        ? dadosCompletosDashboard.ativosPorSetor
        : dadosCompletosDashboard.ativosPorSetor.filter(item => item.setor !== 'A Migrar');

    const ctx = document.getElementById('grafico-setores').getContext('2d');
    
    const dadosAgrupados = dadosFiltrados.reduce((acc, item) => {
        acc[item.setor] = acc[item.setor] || { COMPUTADOR: 0, MOBILIARIO: 0 };
        acc[item.setor][item.categoria] = item.quantidade;
        return acc;
    }, {});

    const setores = Object.keys(dadosAgrupados);

    // Destrói o gráfico antigo antes de desenhar o novo, se ele existir
    if (graficoSetoresInstance) {
        graficoSetoresInstance.destroy();
    }

    graficoSetoresInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: setores,
            datasets: [
                {
                    label: 'Máquinas',
                    data: setores.map(setor => dadosAgrupados[setor].COMPUTADOR),
                    backgroundColor: '#2980b9',
                },
                {
                    label: 'Mobiliário',
                    data: setores.map(setor => dadosAgrupados[setor].MOBILIARIO),
                    backgroundColor: '#27ae60',
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: false },
                y: { stacked: false, beginAtZero: true }
            }
        }
    });
}

// Função de atividade recente (sem alterações)
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

// ATUALIZADO: Função principal que carrega os dados
async function carregarDashboard() {
    exibirInfoUtilizador();
    try {
        dadosCompletosDashboard = await getDashboardData(); // Guarda os dados globalmente
        if (dadosCompletosDashboard) {
            renderizarResumos(dadosCompletosDashboard);
            renderizarGraficoDepartamentos(dadosCompletosDashboard.emprestimosPorDepto);
            renderizarAtividadeRecente(dadosCompletosDashboard.atividadeRecente);
            renderizarGraficoSetores(); // Agora é chamada sem argumentos
        }
    } catch (error) {
        console.error("Falha ao carregar dados do dashboard:", error);
        alert("Não foi possível carregar os dados do dashboard. Tente novamente mais tarde.");
    }
}


function exportarRelatorioDashboard() {
    if (!dadosCompletosDashboard) {
        alert("Os dados do dashboard ainda não foram carregados. Por favor, aguarde.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Prepara o conteúdo do CSV

    // Secção 1: Resumo de Máquinas
    csvContent += "Resumo de Maquinas\r\n";
    csvContent += "Total;Disponivel;Em Uso\r\n";
    csvContent += `${dadosCompletosDashboard.resumoMaquinas.total};${dadosCompletosDashboard.resumoMaquinas.disponivel};${dadosCompletosDashboard.resumoMaquinas.em_uso}\r\n`;
    csvContent += "\r\n"; // Linha em branco para separar secções

    // Secção 2: Resumo de Mobiliário
    csvContent += "Resumo de Mobiliario\r\n";
    csvContent += "Total;Disponivel;Em Uso\r\n";
    csvContent += `${dadosCompletosDashboard.resumoMobiliario.total};${dadosCompletosDashboard.resumoMobiliario.disponivel};${dadosCompletosDashboard.resumoMobiliario.em_uso}\r\n`;
    csvContent += "\r\n";

    // Secção 3: Empréstimos por Departamento
    csvContent += "Emprestimos Ativos por Departamento\r\n";
    csvContent += "Departamento;Quantidade\r\n";
    dadosCompletosDashboard.emprestimosPorDepto.forEach(item => {
        csvContent += `${item.departamento};${item.total}\r\n`;
    });
    csvContent += "\r\n";

    // Secção 4: Ativos por Setor
    csvContent += "Ativos por Setor\r\n";
    csvContent += "Setor;Categoria;Quantidade\r\n";
    dadosCompletosDashboard.ativosPorSetor.forEach(item => {
        csvContent += `${item.setor};${item.categoria};${item.quantidade}\r\n`;
    });

    // Cria e aciona o link de download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_dashboard.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Event Listeners ---
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
});

// NOVO: Event listener para a checkbox de filtro
document.getElementById('filtro-migrar').addEventListener('change', renderizarGraficoSetores);

document.getElementById('btn-exportar-dashboard').addEventListener('click', exportarRelatorioDashboard);

// --- Inicialização ---
if (!localStorage.getItem('authToken')) {
    window.location.href = 'login.html';
} else {
    carregarDashboard();
}


