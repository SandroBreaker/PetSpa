
import { supabase } from './supabase.js';
import { signIn, signUp, signOut } from './auth.js';
import { getServices, getMyPets, createAppointment, createPet, getAppointmentById, getAppointmentsForRange } from './booking.js';
import { renderAdminDashboard, updateAppointmentStatus } from './admin.js';
import { showToast, toggleLoading, formatCurrency, formatDate, renderWeeklyCalendar } from './ui.js';
import { renderChatView, initChat } from './chat.js';

// --- Estado Global ---
const state = {
    user: null,
    profile: null,
    view: 'home',
    services: null,
    currentAppointmentId: null // Para o tracker
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    setupRouter();
    lucide.createIcons(); // Init icons
    render();
});

// --- Roteamento ---
function setupRouter() {
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-route]');
        if (target) {
            e.preventDefault();
            const route = target.dataset.route;
            const param = target.dataset.param;
            
            if (route === 'tracker') {
                state.currentAppointmentId = param || null;
            }
            
            navigateTo(route);
        }
    });
}

window.navigateTo = function(route) {
    state.view = route;
    render();
    updateNavUI();
}

// --- Lógica de Sessão ---
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        state.user = session.user;
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        state.profile = profile;
    } else {
        state.user = null;
        state.profile = null;
    }
    updateNavStructure();
}

function updateNavStructure() {
    const mobileNav = document.getElementById('mobile-links');
    const desktopNav = document.getElementById('desktop-links');
    
    const isActive = (r) => state.view === r ? 'active' : '';

    // Mobile Links (Minimalista: Apenas ícones)
    const homeItem = `<a href="#" data-route="home" class="nav-item ${isActive('home')}"><span class="icon"><i data-lucide="home"></i></span></a>`;
    const servicesItem = `<a href="#" data-route="services" class="nav-item ${isActive('services')}"><span class="icon"><i data-lucide="sparkles"></i></span></a>`;
    const chatItem = `<a href="#" data-route="chat" class="nav-item ${isActive('chat')}"><span class="icon"><i data-lucide="message-circle"></i></span></a>`;
    
    let userItems = '';
    
    if (state.user) {
        userItems = `
            <a href="#" data-route="dashboard" class="nav-item ${isActive('dashboard')}"><span class="icon"><i data-lucide="calendar"></i></span></a>
            <a href="#" data-route="profile" class="nav-item ${isActive('profile')}"><span class="icon"><i data-lucide="user"></i></span></a>
        `;
        if (state.profile?.role === 'admin') {
            userItems = `<a href="#" data-route="admin" class="nav-item ${isActive('admin')}"><span class="icon"><i data-lucide="zap"></i></span></a>` + userItems;
        }
    } else {
        userItems = `<a href="#" data-route="login" class="nav-item ${isActive('login')}"><span class="icon"><i data-lucide="user"></i></span></a>`;
    }

    if (mobileNav) {
        mobileNav.innerHTML = homeItem + servicesItem + chatItem + userItems;
        lucide.createIcons();
    }

    // Desktop Links
    if (desktopNav) {
        desktopNav.innerHTML = `
            <a href="#" data-route="home" class="${isActive('home')}">Início</a>
            <a href="#" data-route="services" class="${isActive('services')}">Serviços</a>
            <a href="#" data-route="chat" class="${isActive('chat')}" style="color:var(--primary);">Assistente IA</a>
            ${state.user 
                ? `<a href="#" data-route="dashboard" class="btn btn-primary btn-sm">Minha Agenda</a> 
                   <a href="#" data-route="profile" class="btn btn-ghost btn-sm" style="border:none;">Meu Perfil</a>
                   <a href="#" id="logout-desk" style="margin-left:10px; font-size:0.9rem;">Sair</a>` 
                : `<a href="#" data-route="login" class="btn btn-secondary btn-sm">Login / Cadastro</a>`
            }
        `;
        const logoutDesk = document.getElementById('logout-desk');
        if(logoutDesk) logoutDesk.addEventListener('click', handleLogout);
    }
}

function updateNavUI() {
    updateNavStructure();
}

// --- Auth Handlers ---
async function handleLoginSubmit(email, password) {
    toggleLoading(true);
    try {
        await signIn(email, password);
        showToast('Bem-vindo de volta!', 'success');
        await checkSession();
        navigateTo(state.profile?.role === 'admin' ? 'admin' : 'dashboard');
    } catch (error) {
        showToast('Email ou senha inválidos.', 'error');
    } finally {
        toggleLoading(false);
    }
}

async function handleRegisterSubmit(email, password, name, phone) {
    toggleLoading(true);
    try {
        await signUp(email, password, name, phone);
        showToast('Conta criada com sucesso!', 'success');
        await checkSession();
        navigateTo('dashboard');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        toggleLoading(false);
    }
}

async function handleLogout() {
    await signOut();
    state.user = null;
    state.profile = null;
    navigateTo('home');
    showToast('Até logo!', 'success');
}

// --- Renderização ---

async function render() {
    const app = document.getElementById('app');
    window.scrollTo(0, 0);

    // Gestão de Layout
    if (state.view === 'chat') {
        document.body.classList.add('mode-chat');
    } else {
        document.body.classList.remove('mode-chat');
    }

    // Proteção de Rota
    if (['dashboard', 'new-pet', 'tracker', 'profile'].includes(state.view) && !state.user) return navigateTo('login');
    if (state.view === 'admin' && state.profile?.role !== 'admin') return navigateTo('dashboard');

    switch (state.view) {
        case 'home':
            app.innerHTML = renderHome();
            break;
        case 'chat':
            app.innerHTML = renderChatView();
            initChat(() => navigateTo('home')); 
            break;
        case 'services':
            toggleLoading(true);
            if (!state.services) state.services = await getServices();
            app.innerHTML = renderServicesList(state.services);
            toggleLoading(false);
            break;
        case 'login':
            app.innerHTML = renderLogin();
            bindAuthForm('login-form', handleLoginSubmit);
            break;
        case 'register':
            app.innerHTML = renderRegister();
            bindAuthForm('register-form', handleRegisterSubmit);
            break;
        case 'dashboard':
            toggleLoading(true);
            const [pets, srv] = await Promise.all([getMyPets(), getServices()]);
            const appointments = await getMyAppointments();
            
            const now = new Date();
            const endWeek = new Date(now);
            endWeek.setDate(now.getDate() + 7);
            const globalApps = await getAppointmentsForRange(now, endWeek);

            app.innerHTML = renderDashboard(state.profile, pets, srv, appointments, globalApps);
            bindBookingForm();
            toggleLoading(false);
            break;
        case 'tracker':
            toggleLoading(true);
            try {
                if (state.currentAppointmentId) {
                    const appData = await getAppointmentById(state.currentAppointmentId);
                    app.innerHTML = renderTrackerDetail(appData);
                } else {
                    const allApps = await getMyAppointments();
                    app.innerHTML = renderTrackerList(allApps);
                }
            } catch (e) {
                console.error(e);
                showToast('Erro ao carregar dados', 'error');
                navigateTo('dashboard');
            }
            toggleLoading(false);
            break;
        case 'new-pet':
            app.innerHTML = renderPetForm();
            bindPetForm();
            break;
        case 'profile':
            toggleLoading(true);
            const myApps = await getMyAppointments();
            app.innerHTML = renderUserProfile(state.profile, myApps);
            toggleLoading(false);
            const logoutBtn = document.getElementById('logout-btn-profile');
            if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
            break;
        case 'admin':
            app.innerHTML = await renderAdminDashboard();
            break;
    }
    lucide.createIcons();
}

async function getMyAppointments() {
    if(!state.user) return [];
    // Busca TODOS (inclusive cancelados e passados) para histórico
    const { data } = await supabase.from('appointments').select('*, services(*), pets(*)').eq('client_id', state.user.id).order('start_time', {ascending: false});
    return data || [];
}

// --- Templates ---

function renderHome() {
    const portfolio = [
        { name: 'Paçoca', breed: 'Caramelo', img: 'https://images.unsplash.com/photo-1593134257782-e89567b7718a?auto=format&fit=crop&w=400&q=80', quote: 'A água estava na temperatura ideal, nem precisei tremer de frio!' },
        { name: 'Luna', breed: 'Husky', img: 'https://images.unsplash.com/photo-1547407139-3c921a66005c?auto=format&fit=crop&w=400&q=80', quote: 'Finalmente um lugar que sabe lidar com meu drama na hora de cortar as unhas.' },
        { name: 'Thor', breed: 'Bulldog', img: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=400&q=80', quote: 'O shampoo tem cheiro de vitória. Aprovado.' },
    ];

    return `
        <header class="hero-header fade-in">
            <div style="z-index:2; position:relative;">
                <h1>Cuidado Premium<br>para seu Melhor Amigo</h1>
                <p>Experiência de spa completa. Agende banho, tosa e cuidados especiais em segundos.</p>
                <div style="display:flex; gap:16px; flex-wrap:wrap; justify-content:center; margin-top:32px;">
                    <button class="btn btn-primary" style="width:auto;" data-route="${state.user ? 'dashboard' : 'login'}">Agendar Agora</button>
                    <button class="btn btn-ghost" style="width:auto; border-color:white; color:white;" data-route="chat">Falar com Assistente</button>
                </div>
            </div>
            <img src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80" style="position:absolute; right:-100px; bottom:-50px; height:120%; opacity:0.2; transform:rotate(-10deg); pointer-events:none;" alt="Dog">
        </header>
        
        <div class="container fade-in" style="animation-delay: 0.1s;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:48px;">
                <div class="card" style="display:flex; align-items:center; gap:20px; background:var(--primary-light); border:none;">
                    <div style="background:white; padding:16px; border-radius:50%; color:var(--primary);"><i data-lucide="bath" size="32"></i></div>
                    <div>
                        <strong style="color:var(--primary); font-size:1.1rem;">Banho Relaxante</strong>
                        <p style="margin:0; font-size:0.9rem; color:var(--primary-hover);">Produtos naturais e água ozonizada.</p>
                    </div>
                </div>
                <div class="card" style="display:flex; align-items:center; gap:20px; background:var(--bg-card);">
                    <div style="background:var(--bg-input); padding:16px; border-radius:50%; color:var(--secondary);"><i data-lucide="bot" size="32"></i></div>
                    <div>
                        <strong style="color:var(--secondary); font-size:1.1rem;">Assistente IA</strong>
                        <p style="margin:0; font-size:0.9rem;">Tire dúvidas sobre raças e cuidados.</p>
                    </div>
                </div>
            </div>

            <h3 style="margin-bottom:24px;">Quem já passou por aqui</h3>
            <div class="portfolio-grid">
                ${portfolio.map(p => `
                    <div class="portfolio-item">
                        <img src="${p.img}" alt="${p.name}" class="portfolio-img">
                        <div class="portfolio-quote">
                            <p>“${p.quote}”</p>
                            <strong>— ${p.name}, ${p.breed}</strong>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderServicesList(services) {
    return `
        <div class="container fade-in" style="padding-top:20px;">
            <h2 style="margin-bottom:24px;">Menu de Serviços</h2>
            ${services.map(s => `
                <div class="card service-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                    <div style="flex:1; min-width:200px;">
                        <h3 style="font-size:1.2rem; color:var(--secondary);">${s.name}</h3>
                        <p style="font-size:0.95rem; margin-top:4px;">${s.description || 'Cuidado completo para seu pet.'}</p>
                        <div style="display:flex; gap:12px; margin-top:8px;">
                            <span style="font-size:0.85rem; background:var(--bg-input); padding:4px 12px; border-radius:20px; color:var(--text-body);">⏱ ${s.duration_minutes} min</span>
                        </div>
                    </div>
                    <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                        <strong style="font-size:1.4rem; color:var(--primary);">${formatCurrency(s.price)}</strong>
                        <button class="btn btn-primary btn-sm" data-route="${state.user ? 'dashboard' : 'login'}">Agendar</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderLogin() {
    return `
        <div class="container fade-in" style="padding-top:40px; max-width:450px;">
            <div class="card" style="padding:40px;">
                <div style="text-align:center; margin-bottom:32px;">
                    <h1 style="font-size:2rem;">Bem-vindo</h1>
                    <p>Acesse para agendar o spa do seu pet</p>
                </div>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="email" required placeholder="seu@email.com">
                    </div>
                    <div class="form-group">
                        <label>Senha</label>
                        <input type="password" id="password" required placeholder="••••••">
                    </div>
                    <button type="submit" class="btn btn-primary" style="margin-bottom:20px;">Entrar</button>
                    <div class="text-center">
                        <a href="#" data-route="register" style="color:var(--primary); font-weight:700; text-decoration:none;">Criar conta nova</a>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderRegister() {
    return `
        <div class="container fade-in" style="padding-top:40px; max-width:450px;">
            <div class="card" style="padding:40px;">
                <h2 class="text-center" style="margin-bottom:32px; font-size:2rem;">Criar Conta</h2>
                <form id="register-form">
                    <div class="form-group">
                        <label>Nome Completo</label>
                        <input type="text" id="reg-name" required>
                    </div>
                    <div class="form-group">
                        <label>Telefone</label>
                        <input type="tel" id="reg-phone" required placeholder="(00) 00000-0000">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="reg-email" required>
                    </div>
                    <div class="form-group">
                        <label>Senha</label>
                        <input type="password" id="reg-password" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary">Cadastrar</button>
                    <p class="text-center" style="margin-top:24px;">
                        <a href="#" data-route="login" style="color:var(--text-body);">Já tenho conta</a>
                    </p>
                </form>
            </div>
        </div>
    `;
}

function renderDashboard(profile, pets, services, appointments, globalApps) {
    const now = new Date();
    // Filtra apenas agendamentos futuros ou ativos para destaque
    const activeAppointments = appointments
        .filter(a => ['pending', 'confirmed', 'in_progress'].includes(a.status))
        .filter(a => new Date(a.start_time) >= new Date(now.setHours(0,0,0,0)))
        .sort((a,b) => new Date(a.start_time) - new Date(b.start_time));

    const nextApp = activeAppointments.length > 0 ? activeAppointments[0] : null;

    return `
        <div class="container fade-in dashboard-grid" style="padding-top:24px;">
            <div>
                <div class="card" style="background:var(--secondary); color:white; border:none; display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <h3 style="color:white; font-size:1.5rem;">Olá, ${profile?.full_name?.split(' ')[0] || 'Cliente'}!</h3>
                        <p style="margin:0; color:rgba(255,255,255,0.7);">Seu painel de controle.</p>
                    </div>
                    <div style="font-size:2.5rem;">🐶</div>
                </div>

                ${nextApp ? `
                    <div class="card" style="border: 2px solid var(--primary);">
                        <div style="display:flex; justify-content:space-between; align-items:start;">
                            <div>
                                <h3 style="color:var(--primary); font-size:1rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Próximo</h3>
                                <div style="font-size:1.4rem; font-weight:700; color:var(--secondary);">${formatDate(nextApp.start_time)}</div>
                                <span style="font-size:1rem; color:var(--text-body);">${nextApp.services.name} para <strong>${nextApp.pets.name}</strong></span>
                            </div>
                            <div style="text-align:right;">
                                <div style="background:${getStatusColor(nextApp.status)}; color:white; padding:6px 12px; border-radius:20px; font-size:0.75rem; text-transform:uppercase; font-weight:800; display:inline-block; margin-bottom:8px;">${getStatusLabel(nextApp.status)}</div>
                            </div>
                        </div>
                        <button class="btn btn-primary" style="margin-top:20px;" data-route="tracker" data-param="${nextApp.id}">Acompanhar Pedido</button>
                    </div>
                ` : ''}

                <div style="display:flex; justify-content:space-between; align-items:center; margin: 32px 0 16px;">
                     <h3>Meus Pets</h3>
                </div>

                ${pets.length === 0 
                    ? `<div class="card" style="text-align:center; padding:40px;">
                         <div style="font-size:3rem; margin-bottom:16px; color:var(--text-light);"><i data-lucide="dog"></i></div>
                         <p>Nenhum pet cadastrado.</p>
                         <button class="btn btn-primary" data-route="new-pet">Cadastrar Pet</button>
                       </div>` 
                    : `<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:32px;">
                        ${pets.map(p => `
                            <div class="card" style="margin:0; text-align:center; padding:20px;">
                                <div style="width:60px; height:60px; background:var(--bg-input); border-radius:50%; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; color:var(--secondary); font-size:1.5rem;">🐾</div>
                                <strong>${p.name}</strong>
                                <div style="font-size:0.8rem; color:var(--text-body); margin-top:4px;">${p.breed || 'SRD'}</div>
                            </div>
                        `).join('')}
                         <div class="card" style="margin:0; text-align:center; padding:20px; border:2px dashed var(--text-light); box-shadow:none; display:flex; align-items:center; justify-content:center; cursor:pointer; background:transparent;" data-route="new-pet">
                            <span style="color:var(--text-body); font-weight:700; display:flex; flex-direction:column; align-items:center; gap:8px;">
                                <i data-lucide="plus-circle" size="24"></i> Adicionar
                            </span>
                        </div>
                       </div>`
                }
            </div>

            ${pets.length > 0 ? `
            <div>
                <div class="card">
                    <h3 style="margin-bottom:24px;">Novo Agendamento</h3>
                    <form id="booking-form">
                        <div class="form-group">
                            <label>Pet</label>
                            <select id="pet-select" required>
                                ${pets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Serviço</label>
                            <select id="service-select" required>
                                <option value="">Selecione...</option>
                                ${services.map(s => `
                                    <option value="${s.id}" data-duration="${s.duration_minutes}">
                                        ${s.name} (${formatCurrency(s.price)})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Data e Hora</label>
                            <input type="datetime-local" id="booking-date" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Confirmar Agendamento</button>
                    </form>
                </div>

                <div class="card">
                    <h3 style="margin-bottom:16px;">Disponibilidade</h3>
                    ${renderWeeklyCalendar(globalApps, true)}
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function renderUserProfile(profile, appointments) {
    const totalSpent = appointments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.services?.price || 0), 0);
    
    const completedCount = appointments.filter(a => a.status === 'completed').length;
    
    // Serviço mais pedido
    const servicesCount = {};
    appointments.forEach(a => {
        if(a.services?.name) servicesCount[a.services.name] = (servicesCount[a.services.name] || 0) + 1;
    });
    const favService = Object.keys(servicesCount).reduce((a, b) => servicesCount[a] > servicesCount[b] ? a : b, 'Nenhum');

    return `
        <div class="container fade-in" style="padding-top:20px;">
             <div class="profile-header">
                <div class="profile-avatar">${profile.full_name.charAt(0)}</div>
                <div>
                    <h2 style="color:white;">${profile.full_name}</h2>
                    <p style="color:rgba(255,255,255,0.8); margin:0;">Membro desde 2024</p>
                </div>
                <button id="logout-btn-profile" class="btn btn-ghost" style="position:absolute; right:20px; top:20px; color:white; border-color:white; width:auto; height:40px;">Sair</button>
             </div>

             <div class="stat-grid">
                <div class="stat-card">
                    <div class="stat-value">${completedCount}</div>
                    <div class="stat-label">Banhos Realizados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="font-size:1.4rem;">${formatCurrency(totalSpent)}</div>
                    <div class="stat-label">Investido em Carinho</div>
                </div>
             </div>

             <div class="card">
                <h3>Histórico Completo</h3>
                ${appointments.length === 0 ? '<p>Sem histórico ainda.</p>' : `
                    <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px;">
                        ${appointments.map(app => `
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:12px;">
                                <div>
                                    <div style="font-weight:700;">${app.services?.name}</div>
                                    <div style="font-size:0.85rem; color:var(--text-light);">${formatDate(app.start_time)} • ${app.pets?.name}</div>
                                </div>
                                <div style="background:${getStatusColor(app.status)}20; color:${getStatusColor(app.status)}; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:700;">
                                    ${getStatusLabel(app.status)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
             </div>
        </div>
    `;
}

function renderTrackerList(appointments) {
    const sorted = [...appointments].sort((a,b) => new Date(b.start_time) - new Date(a.start_time));

    return `
        <div class="container fade-in" style="padding-top:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <button class="btn btn-ghost" style="width:auto; height:48px;" data-route="dashboard">← Voltar</button>
                <h2>Meus Agendamentos</h2>
                <div style="width:40px;"></div>
            </div>

            ${sorted.length === 0 ? `
                <div class="card text-center" style="padding:60px;">
                    <p>Você ainda não tem agendamentos.</p>
                    <button class="btn btn-primary" data-route="dashboard" style="max-width:200px; margin:0 auto;">Agendar Agora</button>
                </div>
            ` : sorted.map(app => {
                const color = getStatusColor(app.status);
                const label = getStatusLabel(app.status);
                const isClickable = app.status !== 'cancelled';
                
                return `
                <div class="card" 
                     style="display:flex; justify-content:space-between; align-items:center; cursor:${isClickable ? 'pointer' : 'default'}; border-left: 6px solid ${color};"
                     ${isClickable ? `data-route="tracker" data-param="${app.id}"` : ''}
                >
                    <div style="display:flex; gap:16px; align-items:center;">
                         <div style="width:50px; height:50px; background:var(--bg-input); border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--text-light);">
                            <i data-lucide="calendar"></i>
                         </div>
                         <div>
                            <div style="font-size:0.85rem; color:var(--text-light); text-transform:uppercase; font-weight:700;">${formatDate(app.start_time)}</div>
                            <strong style="font-size:1.1rem; display:block; margin:2px 0; color:var(--secondary);">${app.services.name}</strong>
                            <div style="font-size:0.95rem;">Pet: <strong>${app.pets.name}</strong></div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="background:${color}15; color:${color}; padding:6px 16px; border-radius:20px; font-size:0.8rem; font-weight:800;">
                            ${label}
                        </span>
                        ${isClickable ? '<div style="margin-top:8px; font-size:1.2rem; color:var(--text-light);"><i data-lucide="chevron-right"></i></div>' : ''}
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderTrackerDetail(appointment) {
    if (!appointment) return `<div class="container text-center pt-5"><p>Agendamento não encontrado.</p><button class="btn btn-ghost" data-route="dashboard">Voltar</button></div>`;

    let stepIndex = 0;
    if (appointment.status === 'confirmed') stepIndex = 1;
    if (appointment.status === 'in_progress') stepIndex = 2;
    if (appointment.status === 'completed') stepIndex = 3; 

    const steps = [
        { label: 'Solicitado', icon: 'clipboard-list' },
        { label: 'Agendado', icon: 'calendar-check' },
        { label: 'No Banho', icon: 'droplets' },
        { label: 'Pronto!', icon: 'check-circle' }
    ];

    return `
        <div class="container fade-in" style="padding-top:24px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:24px;">
                <button class="btn btn-ghost" style="width:auto;" data-route="tracker">← Voltar</button>
            </div>
            
            <div class="card text-center" style="padding:40px 24px;">
                <div style="width:80px; height:80px; background:var(--primary-light); color:var(--primary); border-radius:50%; margin:0 auto 20px; display:flex; align-items:center; justify-content:center; font-size:2rem;">
                    <i data-lucide="dog"></i>
                </div>
                <h2 style="font-size:1.8rem;">Status do Pedido</h2>
                <p style="color:var(--text-body); font-size:1.1rem; margin-top:8px;">Pet: <strong>${appointment.pets.name}</strong></p>
                <div style="background:var(--bg-input); display:inline-block; padding:8px 16px; border-radius:20px; margin-top:16px; font-weight:600;">
                    ${appointment.services.name} • ${formatDate(appointment.start_time)}
                </div>
                
                ${appointment.status === 'cancelled' ? '<strong style="color:var(--danger); display:block; margin-top:24px; font-size:1.2rem;">PEDIDO CANCELADO</strong>' : ''}
            </div>

            ${appointment.status !== 'cancelled' ? `
            <div class="tracker-container">
                <div class="progress-track">
                    ${steps.map((step, idx) => {
                        let statusClass = '';
                        if (idx < stepIndex) statusClass = 'completed';
                        if (idx === stepIndex) statusClass = 'active';
                        
                        return `
                            <div class="step ${statusClass}">
                                <div class="step-circle">
                                    ${idx < stepIndex ? '<i data-lucide="check"></i>' : `<i data-lucide="${step.icon}"></i>`}
                                </div>
                                <div class="step-label">${step.label}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="card" style="background:var(--primary); color:white; border:none; text-align:center;">
                <strong style="text-transform:uppercase; letter-spacing:1px; font-size:0.9rem; opacity:0.9;">Mensagem</strong>
                <p style="margin-top:8px; font-size:1.2rem; font-weight:600; color:white;">
                    ${stepIndex === 0 ? 'Aguardando confirmação da equipe.' : ''}
                    ${stepIndex === 1 ? 'Agendamento confirmado! Aguardamos vocês.' : ''}
                    ${stepIndex === 2 ? 'Seu pet está aproveitando o banho agora!' : ''}
                    ${stepIndex === 3 ? 'Tudo pronto! Seu pet está cheiroso e feliz.' : ''}
                </p>
            </div>
            ` : ''}
        </div>
    `;
}

function renderPetForm() {
    return `
        <div class="container fade-in" style="padding-top:24px;">
            <h2 style="margin-bottom:24px;">Adicionar Novo Pet</h2>
            <div class="card">
                <form id="pet-form">
                    <div class="form-group">
                        <label>Nome do Pet</label>
                        <input type="text" id="pet-name" required placeholder="Ex: Paçoca">
                    </div>
                    <div class="form-group">
                        <label>Raça / Tipo</label>
                        <input type="text" id="pet-breed" placeholder="Ex: Vira-lata">
                    </div>
                    <div class="form-group">
                        <label>Peso Aproximado (kg)</label>
                        <input type="number" id="pet-weight" step="0.1" inputmode="decimal">
                    </div>
                    <div style="display:flex; gap:16px; margin-top:32px;">
                        <button type="button" class="btn btn-ghost" data-route="dashboard">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Pet</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// --- Utils ---
function getStatusColor(status) {
    const map = { 
        pending: '#FDCB6E',  // Amarelo
        confirmed: '#00B894', // Verde Teal
        in_progress: '#0984E3', // Azul Vivo
        completed: '#636E72', // Cinza Escuro
        cancelled: '#FF7675' // Vermelho Suave
    };
    return map[status] || '#B2BEC3';
}
function getStatusLabel(status) {
    const map = { pending: 'Pendente', confirmed: 'Agendado', in_progress: 'No Banho', completed: 'Pronto', cancelled: 'Cancelado' };
    return map[status] || status;
}

// --- Event Binders ---

function bindAuthForm(formId, handler) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = Array.from(form.elements).filter(el => el.tagName !== 'BUTTON');
        const values = inputs.map(i => i.value);
        handler(...values);
    });
}

function bindPetForm() {
    const form = document.getElementById('pet-form');
    if(!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleLoading(true);
        try {
            await createPet(
                document.getElementById('pet-name').value,
                document.getElementById('pet-breed').value,
                document.getElementById('pet-weight').value,
                ''
            );
            showToast('Pet salvo!', 'success');
            navigateTo('dashboard');
        } catch(err) { showToast(err.message, 'error'); } 
        finally { toggleLoading(false); }
    });
}

function bindBookingForm() {
    const form = document.getElementById('booking-form');
    if (!form) return;
    
    const dateInput = document.getElementById('booking-date');
    if(dateInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dateInput.min = now.toISOString().slice(0,16);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const petId = document.getElementById('pet-select').value;
        const srvSelect = document.getElementById('service-select');
        const srvId = srvSelect.value;
        const dateVal = dateInput.value;
        
        if(!srvId) return showToast('Selecione um serviço', 'error');

        const duration = parseInt(srvSelect.options[srvSelect.selectedIndex].dataset.duration);
        const start = new Date(dateVal);
        const end = new Date(start.getTime() + duration * 60000);

        toggleLoading(true);
        try {
            await createAppointment(petId, srvId, start.toISOString(), end.toISOString());
            showToast('Solicitação enviada!', 'success');
            navigateTo('dashboard');
        } catch(err) { showToast('Erro no agendamento.', 'error'); }
        finally { toggleLoading(false); }
    });
}

window.handleStatus = async (id, status) => {
    toggleLoading(true);
    try {
        await updateAppointmentStatus(id, status);
        showToast('Status atualizado', 'success');
        document.getElementById('app').innerHTML = await renderAdminDashboard();
    } catch(err) { 
        console.error(err);
        if (err.message?.includes('appointments_status_check') || err.code === '23514') {
            alert('⚠️ AÇÃO NECESSÁRIA NO BANCO DE DADOS ⚠️\n\nO Supabase bloqueou o status "No Banho".\n\nPor favor, copie o código do arquivo "migration.sql" e execute no SQL Editor do seu projeto Supabase para corrigir isso.');
        } else {
            showToast('Erro: ' + err.message, 'error'); 
        }
    }
    finally { toggleLoading(false); }
};
