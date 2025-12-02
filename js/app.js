

import { supabase } from './supabase.js';
import { signIn, signUp, signOut } from './auth.js';
import { getServices, getMyPets, createAppointment, createPet, getAppointmentById, getAppointmentsForRange } from './booking.js';
import { renderAdminDashboard, updateAppointmentStatus } from './admin.js';
import { showToast, toggleLoading, formatCurrency, formatDate, renderWeeklyCalendar, initScrollAnimations } from './ui.js';
import { renderChatView, initChat } from './chat.js';
import { renderMarketplace } from './marketplace.js';

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
        // Lógica para fechar o balão flutuante
        if(e.target.closest('.bot-invite-close')) {
            const bubble = document.querySelector('.bot-invite-wrapper');
            if(bubble) bubble.style.display = 'none';
            return;
        }

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

    // Mobile Links
    const homeItem = `<a href="#" data-route="home" class="nav-item ${isActive('home')}"><span class="icon"><i data-lucide="home"></i></span></a>`;
    const servicesItem = `<a href="#" data-route="services" class="nav-item ${isActive('services')}"><span class="icon"><i data-lucide="sparkles"></i></span></a>`;
    const marketItem = `<a href="#" data-route="marketplace" class="nav-item ${isActive('marketplace')}"><span class="icon"><i data-lucide="shopping-bag"></i></span></a>`; // Novo item
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
        mobileNav.innerHTML = homeItem + servicesItem + marketItem + chatItem + userItems;
        lucide.createIcons();
    }

    // Desktop Links
    if (desktopNav) {
        desktopNav.innerHTML = `
            <a href="#" data-route="home" class="nav-link-item ${isActive('home')}">Início</a>
            <a href="#" data-route="services" class="nav-link-item ${isActive('services')}">Serviços</a>
            <a href="#" data-route="marketplace" class="nav-link-item ${isActive('marketplace')}">Loja</a>
            <a href="#" data-route="chat" class="nav-link-item nav-link-cta ${isActive('chat')}">Assistente IA</a>
            ${state.user 
                ? `<a href="#" data-route="dashboard" class="btn btn-primary btn-sm">Minha Agenda</a> 
                   <a href="#" data-route="profile" class="btn btn-ghost btn-sm" style="border:none;">Meu Perfil</a>
                   <a href="#" id="logout-desk" class="logout-link">Sair</a>` 
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
    
    // Adiciona classe de animação de entrada da página
    app.classList.remove('page-fade-in');
    void app.offsetWidth; // Trigger reflow
    app.classList.add('page-fade-in');

    // Proteção de Rota
    if (['dashboard', 'new-pet', 'tracker', 'profile'].includes(state.view) && !state.user) return navigateTo('login');
    if (state.view === 'admin' && state.profile?.role !== 'admin') return navigateTo('dashboard');

    switch (state.view) {
        case 'home':
            app.innerHTML = renderHome();
            setTimeout(initLeafletMap, 100); 
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
        case 'marketplace': 
            app.innerHTML = renderMarketplace();
            break;
        case 'login':
            app.innerHTML = renderLogin();
            bindLoginEvents(); // Vinculo específico
            break;
        case 'register':
            app.innerHTML = renderRegister();
            bindRegisterEvents(); // Vinculo específico
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
    initScrollAnimations(); // Inicia o observer para animações on-scroll
}

async function getMyAppointments() {
    if(!state.user) return [];
    // Busca TODOS (inclusive cancelados e passados) para histórico
    const { data } = await supabase.from('appointments').select('*, services(*), pets(*)').eq('client_id', state.user.id).order('start_time', {ascending: false});
    return data || [];
}

// --- Funções de Mapa (Leaflet) ---
function initLeafletMap() {
    const mapContainer = document.getElementById('contact-map');
    if (!mapContainer || mapContainer._leaflet_id) return; // Evita re-inicializar

    // Coordenadas fictícias (Centro de SP para exemplo)
    const lat = -23.550520;
    const lng = -46.633308;

    const map = L.map('contact-map').setView([lat, lng], 15);

    // Tiles Gratuitos do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Ícone Personalizado
    const pawIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/1076/1076928.png', // Ícone de pata livre
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
    });

    L.marker([lat, lng], {icon: pawIcon}).addTo(map)
        .bindPopup('<b>🐾 PetSpa</b><br>Rua dos Pets Felizes, 123<br>Estacionamento no local.')
        .openPopup();
}

// --- Templates (Atualizados com classes de animação) ---

function renderHome() {
    return `
        <!-- 1. Hero Section -->
        <header class="hero-header scroll-hidden">
            <div class="hero-content">
                <h1>Seu pet limpo,<br>feliz e saudável!</h1>
                <p>Confiança, carinho e tecnologia. Agendamento inteligente com IA e profissionais apaixonados pelo que fazem.</p>
                <div class="hero-actions">
                    <button class="btn btn-primary hero-btn" data-route="${state.user ? 'dashboard' : 'login'}">Agendar Banho</button>
                    <!-- Ajuste: Ícone de Cachorro + Sparkles para IA -->
                    <button class="btn btn-ghost hero-btn-outline" data-route="chat">
                        <i data-lucide="dog"></i>
                        <i data-lucide="sparkles" style="width:16px; margin-left:-6px; margin-bottom:8px;"></i> 
                        Falar com Assistente
                    </button>
                </div>
            </div>
            <img src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80" class="hero-bg-decoration" alt="Dog">
        </header>
        
        <!-- Balão Flutuante de Convite do Bot -->
        <div class="bot-invite-wrapper" data-route="chat">
            <div class="bot-invite-bubble">
                <button class="bot-invite-close">✕</button>
                <span style="font-size:1.5rem;">🤖</span>
                <div>
                    <strong>Psiu! Alguma dúvida?</strong>
                    <br>Posso ajudar com dicas e agendamento!
                </div>
            </div>
            <!-- Avatar Flutuante (Desktop only visual) -->
            <div class="bot-floating-avatar">
                <img src="https://cdn-icons-png.flaticon.com/512/4712/4712035.png" alt="Bot">
            </div>
        </div>

        <div class="container" style="animation-delay: 0.1s;">
            
            <!-- 2. Services Preview -->
            <h2 class="section-title scroll-hidden">Nossos Cuidados</h2>
            <div class="services-preview-grid">
                <div class="service-preview-card scroll-hidden delay-100">
                    <div class="service-preview-icon"><i data-lucide="scissors" size="32"></i></div>
                    <h4>Banho & Tosa</h4>
                    <p>Completo e relaxante</p>
                </div>
                <div class="service-preview-card scroll-hidden delay-200">
                    <div class="service-preview-icon"><i data-lucide="droplet" size="32"></i></div>
                    <h4>Hidratação</h4>
                    <p>Pelos macios e brilhantes</p>
                </div>
                <div class="service-preview-card scroll-hidden delay-300">
                    <div class="service-preview-icon"><i data-lucide="sparkles" size="32"></i></div>
                    <h4>Higiene</h4>
                    <p>Unhas e ouvidos limpos</p>
                </div>
                <div class="service-preview-card scroll-hidden delay-100">
                    <div class="service-preview-icon"><i data-lucide="heart" size="32"></i></div>
                    <h4>Carinho Extra</h4>
                    <p>Equipe apaixonada</p>
                </div>
            </div>

            <!-- 3. Differentials -->
            <div class="differentials-section scroll-hidden">
                <div class="card diff-grid">
                    <div class="diff-text">
                        <h2 style="margin-bottom:24px;">Por que escolher a PetSpa?</h2>
                        <ul class="diff-list">
                            <li class="diff-item">
                                <i data-lucide="check-circle" class="diff-check"></i>
                                <div class="diff-content">
                                    <h4>Profissionais Especializados</h4>
                                    <p>Equipe treinada constantemente para o bem-estar animal.</p>
                                </div>
                            </li>
                            <li class="diff-item">
                                <i data-lucide="check-circle" class="diff-check"></i>
                                <div class="diff-content">
                                    <h4>Produtos Hipoalergênicos</h4>
                                    <p>Shampoos e condicionadores de alta qualidade e seguros.</p>
                                </div>
                            </li>
                            <li class="diff-item">
                                <i data-lucide="check-circle" class="diff-check"></i>
                                <div class="diff-content">
                                    <h4>Ambiente Climatizado</h4>
                                    <p>Conforto térmico e segurança total durante o banho.</p>
                                </div>
                            </li>
                             <li class="diff-item">
                                <i data-lucide="check-circle" class="diff-check"></i>
                                <div class="diff-content">
                                    <h4>Agendamento Inteligente</h4>
                                    <p>Use nossa IA para marcar horários sem fila de espera.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                    <div class="diff-img-wrapper">
                        <img src="https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=600&q=80" style="width:100%; border-radius:16px; object-fit:cover; height:100%;" alt="Happy Dog">
                    </div>
                </div>
            </div>

            <!-- 4. Testimonials -->
            <h2 class="section-title scroll-hidden">Quem ama, recomenda</h2>
            <div class="testimonials-grid">
                <div class="testimonial-card scroll-hidden delay-100">
                    <div class="quote-icon">“</div>
                    <p class="testimonial-text">Meu Thor sai sempre cheiroso e feliz! O atendimento é maravilhoso e me sinto segura em deixá-lo.</p>
                    <div class="testimonial-author">
                        <img src="https://randomuser.me/api/portraits/women/44.jpg" class="testimonial-avatar">
                        <div>
                            <strong>Ana Souza</strong>
                            <div style="font-size:0.8rem; color:var(--text-light);">Tutora do Thor</div>
                        </div>
                    </div>
                </div>
                 <div class="testimonial-card scroll-hidden delay-200">
                    <div class="quote-icon">“</div>
                    <p class="testimonial-text">A facilidade de agendar pela IA é incrível. E o banho dura muito, a Paçoca volta parecendo uma princesa.</p>
                    <div class="testimonial-author">
                        <img src="https://randomuser.me/api/portraits/men/32.jpg" class="testimonial-avatar">
                        <div>
                            <strong>Carlos Lima</strong>
                            <div style="font-size:0.8rem; color:var(--text-light);">Tutor da Paçoca</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 5. Gallery (Happy Pets) -->
            <h2 class="section-title scroll-hidden">Clientes de Quatro Patas</h2>
            <p class="section-subtitle scroll-hidden">Veja a alegria dos pets após um dia de spa!</p>
            <div class="gallery-grid">
                <img src="https://images.unsplash.com/photo-1591856331906-8c9035252814?auto=format&fit=crop&w=400&q=80" class="gallery-img scroll-hidden delay-100" alt="Pet 1">
                <img src="https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?auto=format&fit=crop&w=400&q=80" class="gallery-img scroll-hidden delay-200" alt="Pet 2">
                <img src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80" class="gallery-img scroll-hidden delay-300" alt="Pet 3">
            </div>

            <!-- 6. Contact Footer -->
            <div class="contact-section scroll-hidden">
                <h2>Venha nos visitar!</h2>
                <div class="contact-info-grid">
                    <div class="contact-item">
                        <i data-lucide="map-pin"></i> Rua dos Pets Felizes, 123 - Centro
                    </div>
                    <div class="contact-item">
                        <i data-lucide="phone"></i> (11) 99999-9999
                    </div>
                    <div class="contact-item">
                        <i data-lucide="clock"></i> Terça a Sábado: 09h às 18h
                    </div>
                </div>
                
                <!-- Mapa Interativo (Leaflet) -->
                <div class="contact-map-placeholder" style="overflow: hidden; padding: 0;">
                    <div id="contact-map" style="width: 100%; height: 100%; border-radius: var(--radius-sm);"></div>
                </div>
            </div>
        </div>
    `;
}

function renderServicesList(services) {
    return `
        <div class="container" style="padding-top:20px;">
            <h2 style="margin-bottom:24px;" class="scroll-hidden">Menu de Serviços</h2>
            ${services.map((s, idx) => `
                <div class="card service-card service-card-inner scroll-hidden" style="transition-delay: ${idx * 0.1}s">
                    <div class="service-info">
                        <h3 class="service-title">${s.name}</h3>
                        <p class="service-desc">${s.description || 'Cuidado completo para seu pet.'}</p>
                        <div class="service-meta">
                            <span class="service-duration">⏱ ${s.duration_minutes} min</span>
                        </div>
                    </div>
                    <div class="service-action">
                        <strong class="service-price">${formatCurrency(s.price)}</strong>
                        <button class="btn btn-primary btn-sm" data-route="${state.user ? 'dashboard' : 'login'}">Agendar</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderLogin() {
    return `
        <div class="container auth-container">
            <div class="card auth-card scroll-hidden">
                <div class="auth-header">
                    <h1 class="auth-title">Bem-vindo</h1>
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
                    <div class="auth-footer">
                        <a href="#" data-route="register" class="auth-link">Criar conta nova</a>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderRegister() {
    return `
        <div class="container auth-container">
            <div class="card auth-card scroll-hidden">
                <h2 class="auth-title auth-header">Criar Conta</h2>
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
                    <p class="auth-footer">
                        <a href="#" data-route="login" class="auth-link auth-link-secondary">Já tenho conta</a>
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
        <div class="container dashboard-grid" style="padding-top:24px;">
            <div>
                <div class="card dashboard-header-card scroll-hidden">
                    <div class="dashboard-welcome">
                        <h3>Olá, ${profile?.full_name?.split(' ')[0] || 'Cliente'}!</h3>
                        <p>Seu painel de controle.</p>
                    </div>
                    <div class="dashboard-icon">🐶</div>
                </div>

                ${nextApp ? `
                    <div class="card next-app-card scroll-hidden delay-100">
                        <div class="next-app-header">
                            <div>
                                <h3 class="next-app-label">Próximo</h3>
                                <div class="next-app-time">${formatDate(nextApp.start_time)}</div>
                                <span class="next-app-detail">${nextApp.services.name} para <strong>${nextApp.pets.name}</strong></span>
                            </div>
                            <div style="text-align:right;">
                                <div class="status-badge bg-${nextApp.status}">${getStatusLabel(nextApp.status)}</div>
                            </div>
                        </div>
                        <button class="btn btn-primary" style="margin-top:20px;" data-route="tracker" data-param="${nextApp.id}">Acompanhar Pedido</button>
                    </div>
                ` : ''}

                <div class="pet-section-header scroll-hidden delay-100">
                     <h3>Meus Pets</h3>
                </div>

                ${pets.length === 0 
                    ? `<div class="card empty-pets scroll-hidden">
                         <div class="empty-pets-icon"><i data-lucide="dog"></i></div>
                         <p>Nenhum pet cadastrado.</p>
                         <button class="btn btn-primary" data-route="new-pet">Cadastrar Pet</button>
                       </div>` 
                    : `<div class="pet-grid scroll-hidden delay-100">
                        ${pets.map(p => `
                            <div class="card pet-card">
                                <div class="pet-icon">🐾</div>
                                <strong>${p.name}</strong>
                                <div class="pet-breed">${p.breed || 'SRD'}</div>
                            </div>
                        `).join('')}
                         <div class="card add-pet-card" data-route="new-pet">
                            <span class="add-pet-content">
                                <i data-lucide="plus-circle" size="24"></i> Adicionar
                            </span>
                        </div>
                       </div>`
                }
            </div>

            ${pets.length > 0 ? `
            <div>
                <div class="card scroll-hidden delay-200">
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

                <div class="card scroll-hidden delay-300">
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
        <div class="container" style="padding-top:20px;">
             <div class="profile-header scroll-hidden">
                <div class="profile-avatar">${profile.full_name.charAt(0)}</div>
                <div class="profile-info">
                    <h2 style="color:white;">${profile.full_name}</h2>
                    <p>Membro desde 2024</p>
                </div>
                <button id="logout-btn-profile" class="btn btn-ghost profile-logout-btn">Sair</button>
             </div>

             <div class="stat-grid">
                <div class="stat-card scroll-hidden delay-100">
                    <div class="stat-value">${completedCount}</div>
                    <div class="stat-label">Banhos Realizados</div>
                </div>
                <div class="stat-card scroll-hidden delay-200">
                    <div class="stat-value" style="font-size:1.4rem;">${formatCurrency(totalSpent)}</div>
                    <div class="stat-label">Investido em Carinho</div>
                </div>
             </div>

             <div class="card scroll-hidden delay-300">
                <h3>Histórico Completo</h3>
                ${appointments.length === 0 ? '<p>Sem histórico ainda.</p>' : `
                    <div class="history-list">
                        ${appointments.map(app => `
                            <div class="history-item">
                                <div>
                                    <div class="history-title">${app.services?.name}</div>
                                    <div class="history-meta">${formatDate(app.start_time)} • ${app.pets?.name}</div>
                                </div>
                                <div class="history-badge tag-${app.status}">
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
        <div class="container" style="padding-top:24px;">
            <div class="tracker-header scroll-hidden">
                <button class="btn btn-ghost" style="width:auto; height:48px;" data-route="dashboard">← Voltar</button>
                <h2>Meus Agendamentos</h2>
                <div style="width:40px;"></div>
            </div>

            ${sorted.length === 0 ? `
                <div class="card text-center scroll-hidden" style="padding:60px;">
                    <p>Você ainda não tem agendamentos.</p>
                    <button class="btn btn-primary" data-route="dashboard" style="max-width:200px; margin:0 auto;">Agendar Agora</button>
                </div>
            ` : sorted.map((app, idx) => {
                const label = getStatusLabel(app.status);
                const isClickable = app.status !== 'cancelled';
                
                return `
                <div class="card tracker-card border-${app.status} ${isClickable ? 'clickable' : 'default'} scroll-hidden" 
                     style="transition-delay: ${idx * 0.1}s"
                     ${isClickable ? `data-route="tracker" data-param="${app.id}"` : ''}
                >
                    <div class="tracker-info">
                         <div class="tracker-icon">
                            <i data-lucide="calendar"></i>
                         </div>
                         <div>
                            <div class="tracker-date">${formatDate(app.start_time)}</div>
                            <strong class="tracker-service">${app.services.name}</strong>
                            <div class="tracker-pet">Pet: <strong>${app.pets.name}</strong></div>
                        </div>
                    </div>
                    <div class="tracker-actions">
                        <span class="status-badge tag-${app.status}">
                            ${label}
                        </span>
                        ${isClickable ? '<div class="tracker-chevron"><i data-lucide="chevron-right"></i></div>' : ''}
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
        <div class="container" style="padding-top:24px;">
            <div class="tracker-detail-header scroll-hidden">
                <button class="btn btn-ghost" style="width:auto;" data-route="tracker">← Voltar</button>
            </div>
            
            <div class="card status-card scroll-hidden">
                <div class="status-icon-lg">
                    <i data-lucide="dog"></i>
                </div>
                <h2 class="status-title">Status do Pedido</h2>
                <p class="status-pet">Pet: <strong>${appointment.pets.name}</strong></p>
                <div class="status-pill">
                    ${appointment.services.name} • ${formatDate(appointment.start_time)}
                </div>
                
                ${appointment.status === 'cancelled' ? '<strong class="status-cancelled-msg">PEDIDO CANCELADO</strong>' : ''}
            </div>

            ${appointment.status !== 'cancelled' ? `
            <div class="tracker-container scroll-hidden delay-100">
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

            <div class="card message-card scroll-hidden delay-200">
                <strong class="message-label">Mensagem</strong>
                <p class="message-text">
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
        <div class="container" style="padding-top:24px;">
            <h2 style="margin-bottom:24px;" class="scroll-hidden">Adicionar Novo Pet</h2>
            <div class="card scroll-hidden delay-100">
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
// Status colors moved to CSS
function getStatusLabel(status) {
    const map = { pending: 'Pendente', confirmed: 'Agendado', in_progress: 'No Banho', completed: 'Pronto', cancelled: 'Cancelado' };
    return map[status] || status;
}

// --- Event Binders ---

// Ligação manual dos formulários de login e registro
function bindLoginEvents() {
    const form = document.getElementById('login-form');
    if(!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const pass = document.getElementById('password').value;
        handleLoginSubmit(email, pass);
    });
}

function bindRegisterEvents() {
    const form = document.getElementById('register-form');
    if(!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Mapeia os inputs pelos IDs corretos para garantir a ordem dos argumentos
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const email = document.getElementById('reg-email').value.trim(); // Trim remove espaços acidentais
        const pass = document.getElementById('reg-password').value;
        
        handleRegisterSubmit(email, pass, name, phone);
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
        initScrollAnimations();
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