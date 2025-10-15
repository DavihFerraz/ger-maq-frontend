import { getUsers, createUser, updateUser, deleteUser } from './api.js';

let editandoId = null;

// Função para renderizar a lista de usuários
function renderizarUsuarios(usuarios) {
    const listaUI = document.getElementById('lista-usuarios');
    listaUI.innerHTML = '';
    usuarios.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="info-item">
                <span>
                    <strong>${user.nome}</strong> (${user.email})
                    <br><small>Departamento: ${user.departamento} | Permissão: ${user.permissao}</small>
                </span>
            </div>
            <div class="botoes-item">
                <button class="btn-item btn-editar-estoque" data-id="${user.id}">Editar</button>
                <button class="btn-item btn-excluir-estoque" data-id="${user.id}">Excluir</button>
            </div>
        `;
        // Adiciona os listeners para os botões de cada usuário
        li.querySelector('.btn-editar-estoque').addEventListener('click', () => preencherFormularioParaEdicao(user));
        li.querySelector('.btn-excluir-estoque').addEventListener('click', () => handleExcluirUsuario(user.id, user.nome));
        listaUI.appendChild(li);
    });
}

// Função para preencher o formulário com dados para edição
function preencherFormularioParaEdicao(user) {
    document.getElementById('form-usuario-titulo').textContent = 'Editar Usuário';
    document.getElementById('usuario-id').value = user.id;
    document.getElementById('usuario-nome').value = user.nome;
    document.getElementById('usuario-email').value = user.email;
    document.getElementById('usuario-departamento').value = user.departamento;
    document.getElementById('usuario-permissao').value = user.permissao;
    document.getElementById('usuario-senha').required = false; // Senha não é obrigatória na edição
    document.getElementById('usuario-senha').placeholder = 'Deixe em branco para não alterar';
    document.getElementById('btn-cancelar-edicao').style.display = 'inline-block';
    editandoId = user.id;
    window.scrollTo(0, 0); // Rola a página para o topo
}

// Função para limpar e resetar o formulário
function resetarFormulario() {
    document.getElementById('form-usuario-titulo').textContent = 'Adicionar Novo Usuário';
    document.getElementById('form-usuario').reset();
    document.getElementById('usuario-id').value = '';
    document.getElementById('usuario-senha').required = true;
    document.getElementById('usuario-senha').placeholder = 'mín. 6 caracteres';
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
    editandoId = null;
}

// Função para lidar com o envio do formulário (criar ou atualizar)
async function handleSalvarUsuario(event) {
    event.preventDefault();
    const userData = {
        nome: document.getElementById('usuario-nome').value,
        email: document.getElementById('usuario-email').value,
        senha: document.getElementById('usuario-senha').value,
        departamento: document.getElementById('usuario-departamento').value,
        permissao: document.getElementById('usuario-permissao').value,
    };

    try {
        if (editandoId) {
            // Se não for fornecida uma nova senha, não a enviamos
            if (!userData.senha) {
                delete userData.senha;
            }
            await updateUser(editandoId, userData);
            Toastify({ text: "Usuário atualizado com sucesso!" }).showToast();
        } else {
            await createUser(userData);
            Toastify({ text: "Usuário criado com sucesso!" }).showToast();
        }
        resetarFormulario();
        carregarUsuarios();
    } catch (error) {
        Toastify({ text: `Erro: ${error.message}`, backgroundColor: 'red' }).showToast();
    }
}

// Função para deletar um usuário
function handleExcluirUsuario(userId, userName) {
    const modal = document.getElementById('modal-confirmacao');
    document.getElementById('modal-texto').textContent = `Tem certeza que deseja excluir o usuário "${userName}"? Esta ação não pode ser desfeita.`;
    modal.classList.add('visible');

    document.getElementById('btn-modal-confirmar').onclick = async () => {
        try {
            await deleteUser(userId);
            Toastify({ text: "Usuário excluído com sucesso!" }).showToast();
            carregarUsuarios();
        } catch (error) {
            Toastify({ text: `Erro: ${error.message}`, backgroundColor: 'red' }).showToast();
        }
        modal.classList.remove('visible');
    };
}

// Função principal para carregar os usuários da API
async function carregarUsuarios() {
    try {
        const usuarios = await getUsers();
        renderizarUsuarios(usuarios);
    } catch (error) {
        document.getElementById('lista-usuarios').innerHTML = `<li>Erro ao carregar usuários: ${error.message}</li>`;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    carregarUsuarios();
    document.getElementById('form-usuario').addEventListener('submit', handleSalvarUsuario);
    document.getElementById('btn-cancelar-edicao').addEventListener('click', resetarFormulario);
    document.getElementById('btn-modal-cancelar').addEventListener('click', () => {
        document.getElementById('modal-confirmacao').classList.remove('visible');
    });
});
