// app/api.js

let API_BASE_URL;

// Verifica se o hostname é 'localhost' ou '127.0.0.1'
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Se for, estamos em ambiente de DESENVOLVIMENTO
    API_BASE_URL = 'http://localhost:3000/api';
    console.log('A executar em ambiente de Desenvolvimento. A ligar à API local.');
} else {
    // Caso contrário, estamos em ambiente de PRODUÇÃO
    API_BASE_URL = 'https://ger-maq-api.onrender.com/api'; // Use o seu URL da Render aqui
    console.log('A executar em ambiente de Produção. A ligar à API online.');
}


async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });
    
    // CORREÇÃO: Lida com respostas sem conteúdo
    if (response.status === 204) {
        return;
    }
    
    // CORREÇÃO: Tenta ler a resposta em JSON apenas se o status não for 404/500
    // Isso evita o erro de parsing se a resposta for HTML ou texto
    const isJsonResponse = response.headers.get('content-type')?.includes('application/json');
    let data;
    try {
        data = isJsonResponse ? await response.json() : await response.text();
    } catch {
        data = "Resposta do servidor não pôde ser lida.";
    }

    if (!response.ok) {
        // Agora o erro pode ser um objeto JSON ou apenas uma string
        const message = isJsonResponse ? data.message : data;
        throw new Error(message || 'Ocorreu um erro na API.');
    }

    return data;
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