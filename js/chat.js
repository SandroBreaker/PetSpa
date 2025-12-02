
import { supabase } from './supabase.js';

/* 
 * BRAIN: Árvore de Decisão do Bot 
 * Estrutura: id: { message: string, options: [{ label, nextNode, action? }] }
 */
const botBrain = {
    'START': {
        message: 'Olá! Sou o assistente virtual da PetSpa 🐶. Como posso te ajudar hoje?',
        options: [
            { label: '📅 Agendar Banho/Tosa', nextNode: 'CHECK_AUTH_SCHEDULE' },
            { label: '🐾 Meus Pets', nextNode: 'CHECK_AUTH_PETS' },
            { label: '❓ Dúvidas Frequentes', nextNode: 'FAQ' },
            { label: '👩‍💻 Falar com Humano', nextNode: 'CONTACT' }
        ]
    },
    'FAQ': {
        message: 'Sobre o que você quer saber?',
        options: [
            { label: '📍 Onde ficam?', action: 'showLocation', nextNode: 'START_LOOP' },
            { label: '💰 Preços', action: 'showPrices', nextNode: 'START_LOOP' },
            { label: '⏰ Horários', action: 'showHours', nextNode: 'START_LOOP' },
            { label: '⬅️ Voltar', nextNode: 'START' }
        ]
    },
    'CONTACT': {
        message: 'Claro! Você pode nos chamar no WhatsApp ou ligar.',
        options: [
            { label: '📞 (11) 99999-9999', action: 'callPhone', nextNode: 'START_LOOP' },
            { label: '💬 WhatsApp', action: 'openWhatsapp', nextNode: 'START_LOOP' },
            { label: '⬅️ Menu Inicial', nextNode: 'START' }
        ]
    },
    'START_LOOP': {
        message: 'Posso ajudar em algo mais?',
        options: [
            { label: 'Sim, menu inicial', nextNode: 'START' },
            { label: 'Não, obrigado', nextNode: 'END' }
        ]
    },
    'END': {
        message: 'Até logo! Estamos esperando seu pet. 🐾',
        options: [
             { label: '👋 Reiniciar', nextNode: 'START' }
        ]
    },
    // Nós de Verificação de Auth
    'AUTH_REQUIRED': {
        message: 'Para acessar essa função, preciso saber quem é você. Já tem cadastro?',
        options: [
            { label: '🔐 Fazer Login', action: 'navLogin' },
            { label: '📝 Criar Conta', action: 'navRegister' },
            { label: '⬅️ Voltar', nextNode: 'START' }
        ]
    },
    'NO_PETS': {
        message: 'Vi aqui que você ainda não cadastrou nenhum pet. Vamos cadastrar?',
        options: [
            { label: '➕ Cadastrar Pet', action: 'navNewPet' },
            { label: '⬅️ Menu Inicial', nextNode: 'START' }
        ]
    },
    'SELECT_ACTION_PET': {
        message: 'O que deseja fazer com seus pets?',
        options: [
            { label: '📅 Novo Agendamento', action: 'navDashboard' },
            { label: '📋 Ver Meus Pets', action: 'navDashboard' },
            { label: '➕ Adicionar Outro', action: 'navNewPet' }
        ]
    }
};

// Estado local do chat
let chatHistoryContainer;
let currentUser = null;

export function renderChatView() {
    return `
    <div id="chat-layout" class="fade-in">
        <div style="padding: 16px; border-bottom: 1px solid var(--primary-light); display:flex; align-items:center; gap:12px; background:white;">
            <div style="background:var(--primary-light); width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                🤖
            </div>
            <div>
                <h3 style="font-size:1rem; margin:0;">Assistente PetSpa</h3>
                <span style="font-size:0.75rem; color:var(--text-body);">Resposta instantânea</span>
            </div>
        </div>

        <div id="chat-history">
            <!-- Mensagens serão inseridas aqui -->
        </div>
    </div>
    `;
}

export async function initChat(onBack) {
    chatHistoryContainer = document.getElementById('chat-history');
    
    // Verifica Auth
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;

    // Inicia fluxo
    processNode('START');
}

async function processNode(nodeId) {
    // Lógica Especial: Interceptadores
    if (nodeId === 'CHECK_AUTH_SCHEDULE' || nodeId === 'CHECK_AUTH_PETS') {
        if (!currentUser) {
            processNode('AUTH_REQUIRED');
            return;
        }
        // Verifica se tem pets
        const { count } = await supabase.from('pets').select('*', { count: 'exact', head: true }).eq('owner_id', currentUser.id);
        
        if (count === 0) {
            processNode('NO_PETS');
        } else {
            if (nodeId === 'CHECK_AUTH_SCHEDULE') {
                // Atalho direto para dashboard se o objetivo é agendar
                addBotMessage('Redirecionando para sua agenda...', []);
                setTimeout(() => window.navigateTo('dashboard'), 1000);
            } else {
                processNode('SELECT_ACTION_PET');
            }
        }
        return;
    }

    const node = botBrain[nodeId];
    if (!node) return;

    // Simula "digitando"
    await showTyping();

    // Renderiza mensagem do bot e opções
    addBotMessage(node.message, node.options);

    // Executa ações imediatas se houver (apenas informativas)
    if (nodeId === 'FAQ') {
        // Exemplo: se tivesse lógica extra
    }
}

function addBotMessage(text, options = []) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = `
        <div>${text}</div>
        ${options.length > 0 ? `<div class="chat-options-container"></div>` : ''}
    `;
    
    chatHistoryContainer.appendChild(bubble);

    // Render Buttons
    if (options.length > 0) {
        const container = bubble.querySelector('.chat-options-container');
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'chat-option-btn';
            btn.textContent = opt.label;
            btn.onclick = () => handleOptionClick(opt, container);
            container.appendChild(btn);
        });
    }

    scrollToBottom();
}

function addUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.textContent = text;
    chatHistoryContainer.appendChild(bubble);
    scrollToBottom();
}

async function handleOptionClick(option, container) {
    // Desabilita botões após clique para evitar loop
    const allBtns = container.querySelectorAll('button');
    allBtns.forEach(b => {
        b.style.opacity = '0.5';
        b.style.pointerEvents = 'none';
        if (b.textContent !== option.label) b.style.display = 'none'; // Esconde os não clicados
    });

    // Mostra o que o usuário escolheu
    addUserMessage(option.label);

    // Executa Ação
    if (option.action) {
        await executeAction(option.action);
    }

    // Vai para o próximo nó
    if (option.nextNode) {
        processNode(option.nextNode);
    }
}

async function executeAction(actionName) {
    // Simula delay de processamento
    await new Promise(r => setTimeout(r, 500));

    switch (actionName) {
        case 'showLocation':
            addBotMessage('Estamos na Rua dos Pets, 123 - Centro. 📍');
            break;
        case 'showPrices':
            addBotMessage('Banho a partir de R$ 40,00 e Tosa a partir de R$ 60,00. Consulte tabela completa em "Serviços".');
            break;
        case 'showHours':
            addBotMessage('Funcionamos de Terça a Sábado, das 09h às 18h. ⏰');
            break;
        case 'callPhone':
            window.open('tel:5511999999999');
            break;
        case 'openWhatsapp':
            window.open('https://wa.me/5511999999999', '_blank');
            break;
        case 'navLogin':
            window.navigateTo('login');
            break;
        case 'navRegister':
            window.navigateTo('register');
            break;
        case 'navNewPet':
            window.navigateTo('new-pet');
            break;
        case 'navDashboard':
            window.navigateTo('dashboard');
            break;
    }
}

function showTyping() {
    return new Promise(resolve => {
        const loader = document.createElement('div');
        loader.className = 'chat-bubble bot';
        loader.style.width = '60px';
        loader.innerHTML = '<span class="animate-pulse">...</span>';
        loader.id = 'typing-indicator';
        chatHistoryContainer.appendChild(loader);
        scrollToBottom();

        setTimeout(() => {
            loader.remove();
            resolve();
        }, 800); // Tempo fake de "pensar"
    });
}

function scrollToBottom() {
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
}
