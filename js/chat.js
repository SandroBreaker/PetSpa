
import { supabase } from './supabase.js';
import { getMyPets, getServices, createAppointment, createPet } from './booking.js';

/* ========================================================================
   KNOWLEDGE BASE (LOCAL DATABASE)
   ======================================================================== */

const TIPS_DB = {
    'hygiene': '🚿 **Banho & Higiene:**\n- Cães de pelo curto: Banho a cada 15-30 dias.\n- Pelo longo: A cada 7-15 dias com escovação diária.\n- **Importante:** Sempre proteja os ouvidos com algodão impermeável para evitar otite!',
    'food': '🍖 **Alimentação:**\n- Evite dar restos de comida humana.\n- **Proibidos:** Chocolate, Uva, Cebola e Alho (são tóxicos!).\n- Mantenha água fresca sempre disponível, trocando 2x ao dia.',
    'behavior': '🎾 **Comportamento:**\n- Passeios diários de 30min ajudam a reduzir ansiedade.\n- Se o pet destrói móveis, ele pode estar entediado. Ofereça brinquedos de enriquecimento ambiental.',
    'health': 'vacina **Saúde:**\n- Vacinas V10 e Antirrábica devem ser anuais.\n- Vermífugo a cada 3-6 meses (consulte vet).\n- No verão, cuidado com o chão quente para não queimar as patinhas!'
};

const BREEDS_DB = {
    'small': {
        'pug': '🐶 **Pug**\n\n**Temperamento:** Carinhoso, palhaço e teimoso.\n**Cuidados:** Atenção redobrada com o calor e limpeza diária das dobrinhas do rosto para evitar fungos.',
        'yorkshire': '🐶 **Yorkshire**\n\n**Temperamento:** Corajoso, vivaz e protetor.\n**Cuidados:** Exige escovação diária para não embolar o pelo. Tende a acumular tártaro nos dentes.',
        'shihtzu': '🐶 **Shih Tzu**\n\n**Temperamento:** Dócil, independente e ótimo para ap.\n**Cuidados:** Os olhos são sensíveis e pedem limpeza frequente. Cuidado com a coprofagia (comer fezes).',
        'lulu': '🐶 **Spitz Alemão (Lulu)**\n\n**Temperamento:** Alerta, inteligente e barulhento.\n**Cuidados:** A tosa deve ser apenas higiênica (tesoura), nunca na máquina zero (alopecia).'
    },
    'medium': {
        'beagle': '🐶 **Beagle**\n\n**Temperamento:** Curioso, amigável e comilão.\n**Cuidados:** Tendência à obesidade, controle a ração! As orelhas caídas precisam de limpeza semanal.',
        'bulldog': '🐶 **Bulldog Francês**\n\n**Temperamento:** Afetuoso, paciente e pouco atlético.\n**Cuidados:** Não tolera calor excessivo. Cuidado com problemas de coluna (evite escadas altas).',
        'cocker': '🐶 **Cocker Spaniel**\n\n**Temperamento:** Gentil, brincalhão e sociável.\n**Cuidados:** Atenção total aos ouvidos (muita propensão a otite) e escovação frequente.',
        'srd_m': '🐶 **Vira-Lata (Médio)**\n\n**Temperamento:** Geralmente muito inteligentes e gratos.\n**Cuidados:** São resistentes, mas precisam de check-up anual igual aos de raça!'
    },
    'large': {
        'golden': '🐶 **Golden Retriever**\n\n**Temperamento:** Devotado, inteligente e ama água.\n**Cuidados:** Solta muito pelo! Escovação 3x na semana. Precisa de bastante exercício físico.',
        'german': '🐶 **Pastor Alemão**\n\n**Temperamento:** Leal, corajoso e obediente.\n**Cuidados:** Displasia coxofemoral é comum na velhice. Mantenha o peso controlado.',
        'labrador': '🐶 **Labrador**\n\n**Temperamento:** Extrovertido, ativo e guloso.\n**Cuidados:** Tendência a engordar. Ama nadar, mas seque bem a base da cauda e orelhas.',
        'boxer': '🐶 **Boxer**\n\n**Temperamento:** Eterno filhote, energético e leal.\n**Cuidados:** Precisa gastar energia ou destrói a casa. Sensível a temperaturas extremas.'
    }
};

/* ========================================================================
   FLOW ENGINE: State Management for Multi-step Conversations
   ======================================================================== */

let flowContext = {
    petId: null,
    serviceId: null,
    serviceDuration: 0,
    appointmentTime: null,
    newPetName: null,
    newPetBreed: null,
    newPetWeight: null
};

/* ========================================================================
   BRAIN: Decision Tree & Dynamic Handlers
   ======================================================================== */

const botBrain = {
    'START': {
        message: 'Olá! Sou o assistente virtual da PetSpa 🐶. Como posso te ajudar hoje?',
        options: [
            { label: '📅 Agendar Banho', nextNode: 'FLOW_SCHEDULE_INIT' },
            { label: '🐶 Raças & Dicas', nextNode: 'KNOWLEDGE_BASE' },
            { label: '🐾 Meus Pets', nextNode: 'CHECK_AUTH_PETS' },
            { label: '❓ Dúvidas / Preços', nextNode: 'FAQ' },
            { label: '👩‍💻 Falar com Humano', nextNode: 'CONTACT' }
        ]
    },

    // --- AGENDAMENTO FLOW (CONVERSACIONAL) ---
    'FLOW_SCHEDULE_INIT': {
        handler: async () => {
             const { data: { user } } = await supabase.auth.getUser();
             if(!user) return { message: 'Para agendar, preciso que você entre na sua conta.', options: [{ label: '🔐 Login', action: 'navLogin' }, {label:'⬅️ Voltar', nextNode:'START'}] };
             
             const pets = await getMyPets();
             if(pets.length === 0) return { message: 'Você ainda não tem pets cadastrados. Vamos cadastrar um?', options: [{ label: 'Sim, cadastrar', nextNode: 'FLOW_NEWPET_NAME' }, {label:'Não agora', nextNode:'START'}] };

             return {
                 message: 'Para qual pet seria o agendamento?',
                 options: pets.map(p => ({ 
                     label: p.name, 
                     action: 'setFlowData', 
                     payload: { key: 'petId', value: p.id },
                     nextNode: 'FLOW_SCHEDULE_SERVICE'
                 }))
             };
        }
    },
    'FLOW_SCHEDULE_SERVICE': {
        handler: async () => {
            const services = await getServices();
            return {
                message: 'Ótimo! Qual serviço vamos realizar?',
                options: services.map(s => ({
                    label: `${s.name} (R$ ${s.price})`,
                    action: 'setFlowData',
                    payload: { key: 'serviceId', value: s.id, extraKey: 'serviceDuration', extraValue: s.duration_minutes },
                    nextNode: 'FLOW_SCHEDULE_DATE'
                }))
            };
        }
    },
    'FLOW_SCHEDULE_DATE': {
        message: 'Para quando você gostaria? Selecione data e hora:',
        inputType: 'datetime-local',
        inputLabel: 'Confirmar Data',
        inputHandler: async (val) => {
             flowContext.appointmentTime = val;
             return 'FLOW_SCHEDULE_CONFIRM';
        }
    },
    'FLOW_SCHEDULE_CONFIRM': {
        handler: async () => {
             const dateObj = new Date(flowContext.appointmentTime);
             const dateStr = dateObj.toLocaleString('pt-BR');
             return {
                 message: `Confirmando:\n- Banho dia ${dateStr}\n\nPosso agendar?`,
                 options: [
                     { label: '✅ Sim, agendar', action: 'finalizeSchedule', nextNode: 'END_SUCCESS' },
                     { label: '❌ Cancelar', nextNode: 'START' }
                 ]
             };
        }
    },

    // --- NOVO PET FLOW (CONVERSACIONAL) ---
    'FLOW_NEWPET_NAME': {
        message: 'Que legal! Qual é o nome do seu pet?',
        inputType: 'text',
        inputLabel: 'Enviar Nome',
        inputPlaceholder: 'Ex: Paçoca',
        inputHandler: async (val) => {
            if(!val) return 'FLOW_NEWPET_NAME';
            flowContext.newPetName = val;
            return 'FLOW_NEWPET_BREED';
        }
    },
    'FLOW_NEWPET_BREED': {
        message: 'Qual a raça dele? (Se não souber, pode por SRD)',
        inputType: 'text',
        inputLabel: 'Enviar Raça',
        inputPlaceholder: 'Ex: Bulldog',
        inputHandler: async (val) => {
            flowContext.newPetBreed = val || 'SRD';
            return 'FLOW_NEWPET_WEIGHT';
        }
    },
    'FLOW_NEWPET_WEIGHT': {
        message: 'Qual o peso aproximado (kg)?',
        inputType: 'number',
        inputLabel: 'Enviar Peso',
        inputPlaceholder: 'Ex: 12.5',
        inputHandler: async (val) => {
            flowContext.newPetWeight = val;
            return 'FLOW_NEWPET_SAVE';
        }
    },
    'FLOW_NEWPET_SAVE': {
        handler: async () => {
            await createPet(flowContext.newPetName, flowContext.newPetBreed, flowContext.newPetWeight, 'Via Chat');
            return {
                message: `Oba! ${flowContext.newPetName} foi cadastrado com sucesso! 🎉\nO que deseja fazer agora?`,
                options: [
                    { label: '📅 Agendar Banho', nextNode: 'FLOW_SCHEDULE_INIT' },
                    { label: '🏠 Menu Inicial', nextNode: 'START' }
                ]
            };
        }
    },

    // --- RAMIFICAÇÃO DE CONHECIMENTO ---
    'KNOWLEDGE_BASE': {
        message: 'Adoro falar sobre isso! O que você quer explorar?',
        options: [
            { label: '🔍 Enciclopédia de Raças', nextNode: 'KB_BREEDS_SIZE' },
            { label: '💡 Dicas de Cuidados', nextNode: 'KB_TIPS_MENU' },
            { label: '⬅️ Voltar', nextNode: 'START' }
        ]
    },
    'KB_TIPS_MENU': {
        message: 'Escolha um tópico para receber dicas de especialista:',
        options: [
            { label: '🚿 Higiene', action: 'showTip', payload: 'hygiene', nextNode: 'KB_TIPS_LOOP' },
            { label: '🍖 Alimentação', action: 'showTip', payload: 'food', nextNode: 'KB_TIPS_LOOP' },
            { label: '🎾 Comportamento', action: 'showTip', payload: 'behavior', nextNode: 'KB_TIPS_LOOP' },
            { label: '🩺 Saúde', action: 'showTip', payload: 'health', nextNode: 'KB_TIPS_LOOP' },
            { label: '⬅️ Voltar', nextNode: 'KNOWLEDGE_BASE' }
        ]
    },
    'KB_TIPS_LOOP': {
        message: 'Quer ver outra dica?',
        options: [
            { label: 'Sim, outra dica', nextNode: 'KB_TIPS_MENU' },
            { label: 'Voltar ao Início', nextNode: 'START' }
        ]
    },
    'KB_BREEDS_SIZE': {
        message: 'Legal! Qual o porte do pet que você quer saber mais?',
        options: [
            { label: '🧸 Pequeno', nextNode: 'KB_LIST_SMALL' },
            { label: '🐕 Médio', nextNode: 'KB_LIST_MEDIUM' },
            { label: '🦁 Grande', nextNode: 'KB_LIST_LARGE' },
            { label: '⬅️ Voltar', nextNode: 'KNOWLEDGE_BASE' }
        ]
    },
    // Listas de Raças
    'KB_LIST_SMALL': {
        message: 'Selecione a raça:',
        options: [
            { label: 'Pug', action: 'showBreed', payload: 'small.pug', nextNode: 'KB_BREED_LOOP' },
            { label: 'Yorkshire', action: 'showBreed', payload: 'small.yorkshire', nextNode: 'KB_BREED_LOOP' },
            { label: 'Shih Tzu', action: 'showBreed', payload: 'small.shihtzu', nextNode: 'KB_BREED_LOOP' },
            { label: 'Lulu (Spitz)', action: 'showBreed', payload: 'small.lulu', nextNode: 'KB_BREED_LOOP' }
        ]
    },
    'KB_LIST_MEDIUM': {
        message: 'Selecione a raça:',
        options: [
            { label: 'Beagle', action: 'showBreed', payload: 'medium.beagle', nextNode: 'KB_BREED_LOOP' },
            { label: 'Bulldog Francês', action: 'showBreed', payload: 'medium.bulldog', nextNode: 'KB_BREED_LOOP' },
            { label: 'Cocker Spaniel', action: 'showBreed', payload: 'medium.cocker', nextNode: 'KB_BREED_LOOP' },
            { label: 'Vira-Lata (SRD)', action: 'showBreed', payload: 'medium.srd_m', nextNode: 'KB_BREED_LOOP' }
        ]
    },
    'KB_LIST_LARGE': {
        message: 'Selecione a raça:',
        options: [
            { label: 'Golden Retriever', action: 'showBreed', payload: 'large.golden', nextNode: 'KB_BREED_LOOP' },
            { label: 'Pastor Alemão', action: 'showBreed', payload: 'large.german', nextNode: 'KB_BREED_LOOP' },
            { label: 'Labrador', action: 'showBreed', payload: 'large.labrador', nextNode: 'KB_BREED_LOOP' },
            { label: 'Boxer', action: 'showBreed', payload: 'large.boxer', nextNode: 'KB_BREED_LOOP' }
        ]
    },
    'KB_BREED_LOOP': {
        message: 'Deseja consultar outra raça?',
        options: [
            { label: 'Sim, consultar', nextNode: 'KB_BREEDS_SIZE' },
            { label: 'Agendar Banho', nextNode: 'FLOW_SCHEDULE_INIT' },
            { label: 'Menu Inicial', nextNode: 'START' }
        ]
    },

    // --- STATIC INFO ---
    'FAQ': {
        message: 'Dúvidas Frequentes:',
        options: [
            { label: '📍 Localização', action: 'showLocation', nextNode: 'START_LOOP' },
            { label: '💰 Preços', action: 'showPrices', nextNode: 'START_LOOP' },
            { label: '⏰ Horários', action: 'showHours', nextNode: 'START_LOOP' },
            { label: '🛁 Como é o banho?', action: 'showBathInfo', nextNode: 'START_LOOP' },
            { label: '⬅️ Voltar', nextNode: 'START' }
        ]
    },
    'CONTACT': {
        message: 'Fale com a nossa equipe humana:',
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
    'END_SUCCESS': {
        message: 'Agendamento Realizado! 🐾\nVocê pode acompanhar o status pelo painel.',
        options: [ { label: '👀 Ver Pedido', action: 'navTracker' }, { label: '🏠 Menu', nextNode: 'START' } ]
    },
    'END': {
        message: 'Até logo! Estamos esperando seu pet para um dia de spa. 🐾',
        options: [ { label: '👋 Reiniciar', nextNode: 'START' } ]
    },
    'CHECK_AUTH_PETS': {
        handler: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) return { message: 'Faça login para ver seus pets.', options: [{ label: '🔐 Login', action: 'navLogin' }] };
            const pets = await getMyPets();
            if(pets.length === 0) return { message: 'Você não tem pets ainda.', options: [{ label: 'Cadastrar', nextNode: 'FLOW_NEWPET_NAME' }] };
            return { 
                message: 'Seus Pets Cadastrados:', 
                options: [...pets.map(p => ({ label: `🐾 ${p.name}`, action: 'none' })), { label: '⬅️ Voltar', nextNode: 'START' }] 
            };
        }
    }
};

// --- CHAT ENGINE ---

let chatHistoryContainer;
let currentUser = null;

export function renderChatView() {
    return `
    <div id="chat-layout" class="fade-in">
        <div class="chat-header">
            <div class="chat-bot-avatar">🤖</div>
            <div class="chat-header-text">
                <h3>Assistente PetSpa</h3>
                <span>Dicas, Raças e Agendamento</span>
            </div>
        </div>
        <div id="chat-history"></div>
    </div>
    `;
}

export async function initChat(onBack) {
    chatHistoryContainer = document.getElementById('chat-history');
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;
    processNode('START');
}

async function processNode(nodeId) {
    const nodeDef = botBrain[nodeId];
    if (!nodeDef) return;

    await showTyping();

    // 1. Resolve Dynamic Content (Handler)
    let finalNode = nodeDef;
    if (nodeDef.handler) {
        const dynamicResult = await nodeDef.handler();
        finalNode = { ...nodeDef, ...dynamicResult };
    }

    // 2. Show Message
    addBotMessage(finalNode.message, finalNode.options);

    // 3. Render Input Form if needed (Simulating User Input)
    if (finalNode.inputType) {
        renderInlineForm(finalNode.inputType, finalNode.inputLabel, finalNode.inputPlaceholder, finalNode.inputHandler);
    }
}

function addBotMessage(text, options = []) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = `<div>${text.replace(/\n/g, '<br>')}</div>`;
    
    if (options && options.length > 0) {
        const container = document.createElement('div');
        container.className = 'chat-options-container';
        bubble.appendChild(container);
        
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'chat-option-btn';
            btn.textContent = opt.label;
            btn.onclick = () => handleOptionClick(opt, container);
            container.appendChild(btn);
        });
    }
    chatHistoryContainer.appendChild(bubble);
    scrollToBottom();
}

function addUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.textContent = text;
    chatHistoryContainer.appendChild(bubble);
    scrollToBottom();
}

// Renderiza um mini-form dentro do chat para inputs específicos
function renderInlineForm(type, label, placeholder, submitHandler) {
    const formContainer = document.createElement('div');
    formContainer.className = 'chat-inline-form fade-in';
    
    const input = document.createElement('input');
    input.type = type;
    input.className = 'chat-input-inline';
    if(placeholder) input.placeholder = placeholder;
    
    // Configura data mínima se for datetime
    if(type === 'datetime-local') {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        input.min = now.toISOString().slice(0,16);
    }

    const btn = document.createElement('button');
    btn.className = 'chat-btn-inline';
    btn.textContent = label || 'Enviar';

    btn.onclick = async () => {
        const val = input.value;
        if(!val) return;
        
        // Remove form visualmente e adiciona como mensagem do usuário
        formContainer.remove();
        let displayVal = val;
        if(type === 'datetime-local') displayVal = new Date(val).toLocaleString('pt-BR');
        
        addUserMessage(displayVal);
        await showTyping();
        
        const nextNodeId = await submitHandler(val);
        processNode(nextNodeId);
    };

    formContainer.appendChild(input);
    formContainer.appendChild(btn);
    chatHistoryContainer.appendChild(formContainer);
    scrollToBottom();
}

async function handleOptionClick(option, container) {
    // Disable buttons visual feedback
    const allBtns = container.querySelectorAll('button');
    allBtns.forEach(b => {
        b.style.opacity = '0.5';
        b.style.pointerEvents = 'none';
        if (b.textContent !== option.label) b.style.display = 'none';
    });

    addUserMessage(option.label);

    if (option.action) {
        await executeAction(option.action, option.payload);
    }

    if (option.nextNode) {
        processNode(option.nextNode);
    }
}

async function executeAction(actionName, payload) {
    switch (actionName) {
        case 'setFlowData':
            flowContext[payload.key] = payload.value;
            if(payload.extraKey) flowContext[payload.extraKey] = payload.extraValue;
            break;
        case 'finalizeSchedule':
            try {
                const start = new Date(flowContext.appointmentTime);
                const end = new Date(start.getTime() + flowContext.serviceDuration * 60000);
                await createAppointment(flowContext.petId, flowContext.serviceId, start.toISOString(), end.toISOString());
            } catch(e) { console.error(e); }
            break;
        case 'showTip':
            if (TIPS_DB[payload]) await new Promise(r => setTimeout(r, 400)); addBotMessage(TIPS_DB[payload]);
            break;
        case 'showBreed':
            const [size, breedId] = payload.split('.');
            if (BREEDS_DB[size] && BREEDS_DB[size][breedId]) {
                 await new Promise(r => setTimeout(r, 400));
                 addBotMessage(BREEDS_DB[size][breedId]);
            }
            break;
        case 'showLocation': addBotMessage('📍 **Endereço:**\nRua dos Pets, 123 - Centro.\nTemos estacionamento gratuito!'); break;
        case 'showPrices': addBotMessage('💵 **Valores Base:**\n- Banho P: R$ 40\n- Banho M: R$ 50\n- Banho G: R$ 70\n- Tosa: + R$ 40\n\n_Valores podem variar conforme o pelo._'); break;
        case 'showHours': addBotMessage('⏰ **Horário de Atendimento:**\nTerça a Sábado: 09h às 18h.\nDomingo e Segunda: Fechado para descanso da equipe.'); break;
        case 'showBathInfo': addBotMessage('🛁 **Nosso Banho Inclui:**\n- Shampoo Hipoalergênico\n- Corte de unhas\n- Limpeza de ouvidos\n- Secagem silenciosa\n- Perfume importado'); break;
        case 'callPhone': window.open('tel:5511999999999'); break;
        case 'openWhatsapp': window.open('https://wa.me/5511999999999', '_blank'); break;
        case 'navLogin': window.navigateTo('login'); break;
        case 'navRegister': window.navigateTo('register'); break;
        case 'navTracker': window.navigateTo('tracker'); break;
        case 'none': break;
    }
}

function showTyping() {
    return new Promise(resolve => {
        const loader = document.createElement('div');
        loader.className = 'chat-bubble bot';
        loader.style.width = '60px';
        loader.innerHTML = '<span style="animation: pulse 1s infinite">...</span>';
        loader.id = 'typing-indicator';
        chatHistoryContainer.appendChild(loader);
        scrollToBottom();

        setTimeout(() => {
            loader.remove();
            resolve();
        }, 700); 
    });
}

function scrollToBottom() {
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
}
