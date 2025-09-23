import { getDashboardData }  from "./api.js";

// Função para descobrir o token armazenado
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);

    } catch (e) {
        return null;
    }
};

// Função para exibir as informações do utilizador
function exibirInfoUtilizador() {
    const infoUI = document.getElementById('info-utilizador');
    const token = localStorage.getItem('authToken');
    if (infoUI && token) {
        const dados = parseJwt(token);
        if(dados){
            infoUI.innerHTML= `<span>Bem-vindo, ${dados.nome} (${dados.departamento})</span>`;
        }
    }
};

// Função para renderizar os KPIs
function renderizarKPIs(kpis) {
    document.getElementById('kpi-total').textContent = kpis.total || 0;
    document.getElementById('kpi-disponivel').textContent = kpis.disponivel || 0;
    document.getElementById('kpi-em-uso').textContent = kpis.em_uso || 0;
}

// Função para renderizar o gráfico de departamentos
function renderizarGraficoDepartamentos(dados) {
    const ctx = document.getElementById('grafico-departamentos').getContext('2d');
    const departamentos = dados.map(d => d.departamento);
    const totais = dados.map(d => d.total);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: departamentos,
            datasets: [{
                label: 'Nº de Ativos',
                data: totais,
                backgroundColor: '#3498db',
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

// Função para renderizar a lista de atividade recente
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

// Função principal que carrega todos os dados do dashboard
async function carregarDashboard() {
    exibirInfoUtilizador();
    try {
        const dados = await getDashboardData();
        if (dados) {
            renderizarKPIs(dados.kpis);
            renderizarGraficoDepartamentos(dados.emprestimosPorDepto);
            renderizarAtividadeRecente(dados.atividadeRecente);
        }
    } catch (error) {
        console.error("Falha ao carregar dados do dashboard:", error);
        alert("Não foi possível carregar os dados do dashboard. Tente novamente mais tarde.");
    }
}

// Event listener para o botão de logout
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
});

// Verifica a autenticação e carrega os dados quando a página é aberta
if (!localStorage.getItem('authToken')) {
    window.location.href = 'login.html';
} else {
    carregarDashboard();
}