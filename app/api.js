// app/api.js
const API_BASE_URL = '/api';

async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try { // Adicionamos um bloco try...catch em volta do fetch
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });
        
        if (response.status === 204) {
            return;
        }
        
        const isJsonResponse = response.headers.get('content-type')?.includes('application/json');
        const data = isJsonResponse ? await response.json() : await response.text();

        if (!response.ok) {
            // Se a resposta for um erro de autorização, redirecionamos
            if (response.status === 401 || response.status === 400) {
                 const errorMessage = (isJsonResponse ? data.message : data) || '';
                 if (errorMessage.toLowerCase().includes('token')) {
                    console.log("Token inválido ou expirado. A redirecionar para o login.");
                    localStorage.removeItem('authToken'); // Limpa o token antigo
                    window.location.href = 'login.html'; // Redireciona
                    // Lança um erro para parar a execução do código que fez a chamada
                    throw new Error('Sessão expirada.'); 
                 }
            }
            const message = isJsonResponse ? data.message : data;
            throw new Error(message || 'Ocorreu um erro na API.');
        }

        return data;

    } catch (error) {
        // Se houver um erro de rede ou o erro que lançámos, re-lançamo-lo
        // para que a função que chamou a API saiba que algo falhou.
        throw error;
    }
}

// --- Funções de Autenticação ---
export const apiLogin = (login, senha) => {
    return fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, senha }), // Envia um objeto com 'login' e 'senha'
    });
};
// --- Funções de Itens do Inventário ---
export const getItens = () => {
    return fetchAPI('/itens');
};

export const createItem = (itemData) => {
    return fetchAPI('/itens', {
        method: 'POST',
        body: JSON.stringify(itemData),
    });
};

export const updateItem = (itemId, itemData) => {
    return fetchAPI(`/itens/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(itemData),
    });
};

export const deleteItem = (itemId) => {
    return fetchAPI(`/itens/${itemId}`, {
        method: 'DELETE',
    });
};

// --- Funções de Empréstimos ---
export const getEmprestimos = () => {
    return fetchAPI('/emprestimos');
};

export const createEmprestimo = (emprestimoData) => {
    return fetchAPI('/emprestimos', {
        method: 'POST',
        body: JSON.stringify(emprestimoData),
    });
};

export const devolverEmprestimo = (emprestimoId) => {
    return fetchAPI(`/emprestimos/${emprestimoId}/devolver`, {
        method: 'PUT',
    });
};

export const apiChangePassword = (senhaAtual, novaSenha) => {
    return fetchAPI('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ senhaAtual, novaSenha }),
    });
};

export const getModelos = () => {
    return fetchAPI('/modelos');
};

export const createModelo = (modeloData) => {
    return fetchAPI('/modelos', {
        method: 'POST',
        body: JSON.stringify(modeloData),
    });
};

export const getDashboardData = () => {
    return fetchAPI('/dashboard');
};

export const getItemHistory = (itemId) => {
    return fetchAPI(`/itens/${itemId}/historico`);
};

export const getSetores = () => {
    return fetchAPI('/setores');
};

export const registrarSaidaAlmoxarifado = (dados) => {
    return fetchAPI('/almoxarifado/saida', {
        method: 'POST',
        body: JSON.stringify(dados),
    });
}

// Função para buscar o histórico de movimentações de um item
export const getHistoricoItemAlmoxarifado = (itemId) => {
    return fetchAPI(`/almoxarifado/historico/${itemId}`);
}

export const devolverItemAlmoxarifado = (movimentacaoId) => {
    return fetchAPI(`/almoxarifado/devolucao/${movimentacaoId}`, {
        method: 'POST',
    });
};