

import { supabase } from './supabase.js';
import { toggleLoading, formatCurrency, formatDate, renderWeeklyCalendar, showToast, toInputDate } from './ui.js';
import { getAppointmentsForRange, getServices, getAllPets, updateAppointmentFull, getEmployees, createEmployeeRecord, createProduct } from './booking.js';
import { signUp } from './auth.js';

let loadedAppointments = []; 
let currentView = 'dashboard'; // dashboard | kanban | employees | products
let charts = {}; // Referência aos gráficos

export async function getAppointments() {
    // Adicionado employee_id e join com profiles do employee para mostrar nome
    const { data, error } = await supabase
        .from('appointments')
        .select(`
            id, start_time, end_time, status, pet_id, service_id, client_id, employee_id,
            pets (name, breed), 
            services (name, price), 
            profiles (full_name, phone)
        `)
        .order('start_time', { ascending: true });
        
    // Nota: O Supabase pode ter dificuldade com joins complexos de profiles duas vezes (client e employee)
    // Se o nome do funcionário não aparecer, precisaremos de uma query separada, mas vamos tentar assim.
    if (error) throw error;
    return data;
}

export async function updateAppointmentStatus(id, newStatus) {
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    return true;
}

// --- Funções de Renderização das Abas ---

async function renderChartsView() {
    // Processamento de Dados
    const statusCounts = { pending:0, confirmed:0, in_progress:0, completed:0, cancelled:0 };
    const serviceRevenue = {};
    const monthlyStats = {};

    loadedAppointments.forEach(app => {
        // Status
        if(statusCounts[app.status] !== undefined) statusCounts[app.status]++;
        
        // Revenue (Apenas confirmados/completos)
        if(['confirmed','in_progress','completed'].includes(app.status)) {
            const sName = app.services?.name || 'Outros';
            const price = app.services?.price || 0;
            serviceRevenue[sName] = (serviceRevenue[sName] || 0) + price;

            // Monthly
            const month = new Date(app.start_time).toLocaleString('pt-BR', { month: 'short' });
            monthlyStats[month] = (monthlyStats[month] || 0) + 1;
        }
    });

    return `
        <div class="charts-grid fade-in">
            <div class="card">
                <h3>Visão Geral da Semana</h3>
                <p>Ocupação atual.</p>
                ${renderWeeklyCalendar(await getAppointmentsForRange(new Date(), new Date(Date.now() + 7*24*60*60*1000)), false)}
            </div>
            <div class="card">
                <h3>Agendamentos por Status</h3>
                <div class="chart-container"><canvas id="chartStatus"></canvas></div>
            </div>
            <div class="card">
                <h3>Receita por Serviço</h3>
                <div class="chart-container"><canvas id="chartRevenue"></canvas></div>
            </div>
        </div>
    `;
}

function initCharts() {
    // Destrói anteriores se existirem
    Object.values(charts).forEach(c => c.destroy());

    // Dados
    const statusData = { pending:0, confirmed:0, in_progress:0, completed:0, cancelled:0 };
    const revenueData = {};
    
    loadedAppointments.forEach(app => {
        statusData[app.status]++;
        if(['confirmed','in_progress','completed'].includes(app.status)) {
             const sName = app.services?.name || 'Unknown';
             revenueData[sName] = (revenueData[sName] || 0) + (app.services?.price || 0);
        }
    });

    // Chart 1: Status (Bar)
    const ctxStatus = document.getElementById('chartStatus')?.getContext('2d');
    if(ctxStatus) {
        charts.status = new Chart(ctxStatus, {
            type: 'bar',
            data: {
                labels: ['Pendente', 'Confirmado', 'No Banho', 'Concluído', 'Cancelado'],
                datasets: [{
                    label: 'Qtd',
                    data: [statusData.pending, statusData.confirmed, statusData.in_progress, statusData.completed, statusData.cancelled],
                    backgroundColor: ['#FDCB6E', '#00B894', '#0984E3', '#636E72', '#FF7675'],
                    borderRadius: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Chart 2: Revenue (Pie)
    const ctxRev = document.getElementById('chartRevenue')?.getContext('2d');
    if(ctxRev) {
        charts.revenue = new Chart(ctxRev, {
            type: 'doughnut',
            data: {
                labels: Object.keys(revenueData),
                datasets: [{
                    data: Object.values(revenueData),
                    backgroundColor: ['#FF8C42', '#2D3436', '#00B894', '#636E72', '#FDCB6E'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

async function renderEmployeesView() {
    const employees = await getEmployees();
    
    return `
        <div class="fade-in">
            <div class="card">
                <h3>Cadastrar Novo Membro</h3>
                <form id="form-employee" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Nome Completo</label>
                        <input type="text" id="emp-name" required>
                    </div>
                    <div class="form-group">
                        <label>Email Corporativo</label>
                        <input type="email" id="emp-email" required>
                    </div>
                    <div class="form-group">
                        <label>Senha Provisória</label>
                        <input type="password" id="emp-pass" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-secondary">Cadastrar Funcionário</button>
                    <p class="form-note">*Nota: Ao criar usuário, você será deslogado da conta atual por segurança.</p>
                </form>
            </div>

            <div class="card">
                <h3>Equipe Atual</h3>
                <div class="employee-grid">
                    ${employees.map(emp => `
                        <div class="employee-item">
                            <div>
                                <strong>${emp.full_name}</strong>
                                <div class="employee-role">${emp.role.toUpperCase()}</div>
                            </div>
                            <div class="employee-avatar">👤</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

async function renderProductsView() {
    return `
        <div class="fade-in">
            <div class="card">
                <h3>Cadastrar Novo Produto (Loja)</h3>
                <form id="form-product" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Nome do Produto</label>
                        <input type="text" id="prod-name" required placeholder="Ex: Ração Premium 15kg">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label>SKU (Código)</label>
                            <input type="text" id="prod-sku" required placeholder="Ex: RAC-001">
                        </div>
                        <div class="form-group">
                            <label>Categoria</label>
                            <select id="prod-cat" required>
                                <option value="food">Rações & Petiscos</option>
                                <option value="toys">Brinquedos</option>
                                <option value="hygiene">Higiene</option>
                                <option value="accessories">Acessórios</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label>Preço (R$)</label>
                            <input type="number" id="prod-price" required step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label>Estoque (Qtd)</label>
                            <input type="number" id="prod-stock" required min="0" value="10">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>URL da Imagem</label>
                        <input type="url" id="prod-image" required placeholder="https://...">
                    </div>

                    <div class="form-group">
                        <label>Descrição Curta</label>
                        <textarea id="prod-desc" rows="3" style="width:100%; padding:12px; border:2px solid var(--bg-input); border-radius:12px;" required></textarea>
                    </div>

                    <button type="submit" class="btn btn-primary">Salvar Produto</button>
                </form>
            </div>
        </div>
    `;
}

function renderKanbanBoard(appointments) {
    const cols = {
        pending: appointments.filter(a => a.status === 'pending'),
        confirmed: appointments.filter(a => a.status === 'confirmed'),
        in_progress: appointments.filter(a => a.status === 'in_progress'),
        completed: appointments.filter(a => a.status === 'completed')
    };

    return `
        <div class="kanban-board fade-in">
            <div class="kanban-column">
                <div class="kanban-title">🟡 Solicitações (${cols.pending.length})</div>
                ${cols.pending.map(app => renderKanbanCard(app, 'pending')).join('')}
            </div>
            <div class="kanban-column">
                <div class="kanban-title">🟢 Agendados (${cols.confirmed.length})</div>
                ${cols.confirmed.map(app => renderKanbanCard(app, 'confirmed')).join('')}
            </div>
            <div class="kanban-column">
                <div class="kanban-title">🛁 No Banho (${cols.in_progress.length})</div>
                ${cols.in_progress.map(app => renderKanbanCard(app, 'in_progress')).join('')}
            </div>
            <div class="kanban-column">
                <div class="kanban-title">🏁 Concluídos (${cols.completed.length})</div>
                ${cols.completed.map(app => renderKanbanCard(app, 'completed')).join('')}
            </div>
        </div>
    `;
}

function renderKanbanCard(app, columnType) {
    let actions = '';
    
    // Botões de ação rápida de status
    if (columnType === 'pending') {
        actions = `<button onclick="window.handleStatus('${app.id}', 'confirmed')" class="btn-xs btn-action-positive">Aprovar</button>`;
    } else if (columnType === 'confirmed') {
        actions = `<button onclick="window.handleStatus('${app.id}', 'in_progress')" class="btn-xs btn-action-positive">Iniciar Banho</button>`;
    } else if (columnType === 'in_progress') {
        actions = `<button onclick="window.handleStatus('${app.id}', 'completed')" class="btn-xs btn-action-positive">Finalizar</button>`;
    }

    return `
    <div class="kanban-card border-${app.status}">
        <div class="kanban-card-header">
            <div class="kanban-date">${formatDate(app.start_time)}</div>
            <button class="kanban-edit-btn" onclick="window.openEditModal('${app.id}')">✏️</button>
        </div>
        <div class="kanban-pet-name">${app.pets?.name}</div>
        <div class="kanban-client-name">${app.profiles?.full_name}</div>
        <div class="kanban-service-tag">${app.services?.name}</div>
        <div class="kanban-actions">${actions}</div>
    </div>
    `;
}

// --- Main Render ---

export async function renderAdminDashboard() {
    loadedAppointments = await getAppointments();
    
    // Configura listeners globais uma vez
    setTimeout(() => {
        setupAdminListeners();
        if(currentView === 'dashboard') initCharts();
    }, 100);

    let content = '';
    if (currentView === 'dashboard') content = await renderChartsView();
    else if (currentView === 'kanban') content = renderKanbanBoard(loadedAppointments);
    else if (currentView === 'employees') content = await renderEmployeesView();
    else if (currentView === 'products') content = await renderProductsView();

    return `
        <div class="container fade-in" style="padding-top:20px;">
            <div class="admin-header">
                <div>
                    <h2>Painel Admin</h2>
                    <span class="master-view-badge">Master View</span>
                </div>
            </div>

            <!-- Navegação Tabs -->
            <div class="admin-tabs">
                <button class="tab-btn ${currentView === 'dashboard' ? 'active' : ''}" onclick="window.setAdminTab('dashboard')">📊 Visão Geral</button>
                <button class="tab-btn ${currentView === 'kanban' ? 'active' : ''}" onclick="window.setAdminTab('kanban')">📋 Operacional</button>
                <button class="tab-btn ${currentView === 'employees' ? 'active' : ''}" onclick="window.setAdminTab('employees')">👥 Equipe</button>
                <button class="tab-btn ${currentView === 'products' ? 'active' : ''}" onclick="window.setAdminTab('products')">🛍️ Produtos</button>
            </div>

            <div id="admin-content-area">
                ${content}
            </div>

            <!-- Modal de Edição Completa -->
            <div id="edit-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Editar Agendamento</h3>
                        <button onclick="document.getElementById('edit-modal').classList.remove('open')" class="modal-close-btn">&times;</button>
                    </div>
                    <form id="edit-form">
                        <input type="hidden" id="edit-id">
                        <div class="form-group">
                            <label>Data e Hora</label>
                            <input type="datetime-local" id="edit-date" required>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="edit-status">
                                <option value="pending">Pendente</option>
                                <option value="confirmed">Confirmado</option>
                                <option value="in_progress">No Banho</option>
                                <option value="completed">Concluído</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Atribuir Funcionário</label>
                            <select id="edit-employee">
                                <option value="">-- Selecione --</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Serviço</label>
                            <select id="edit-service"></select>
                        </div>
                         <div class="form-group">
                            <label>Pet (ID)</label>
                            <input type="text" id="edit-pet-id" readonly class="input-readonly">
                        </div>
                        <button type="submit" class="btn btn-primary">Salvar Alterações</button>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function setupAdminListeners() {
    // Listener do form de funcionário
    const empForm = document.getElementById('form-employee');
    if(empForm) {
        empForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('emp-email').value;
            const pass = document.getElementById('emp-pass').value;
            const name = document.getElementById('emp-name').value;
            toggleLoading(true);
            try {
                // 1. Cria usuário (Supabase auth) - isso insere em profiles via trigger
                const { data } = await signUp(email, pass, name, '99999999', 'employee'); 
                
                // 2. Garante que role no profile seja employee
                if (data?.user) {
                    await supabase.from('profiles').update({ role: 'employee' }).eq('id', data.user.id);
                    
                    // 3. CRUCIAL: Insere na tabela 'employees' para satisfazer FK
                    await createEmployeeRecord(data.user.id);
                }

                alert('Funcionário cadastrado com sucesso!\n\nPor segurança, a sessão administrativa foi encerrada pois o novo usuário foi logado.\n\nPor favor, faça login novamente como Admin.');
                window.location.reload();
            } catch(err) {
                showToast('Erro: ' + err.message, 'error');
                toggleLoading(false);
            }
        };
    }

    // Listener do form de produto
    const prodForm = document.getElementById('form-product');
    if(prodForm) {
        prodForm.onsubmit = async (e) => {
            e.preventDefault();
            const product = {
                name: document.getElementById('prod-name').value,
                sku: document.getElementById('prod-sku').value,
                category: document.getElementById('prod-cat').value,
                price: parseFloat(document.getElementById('prod-price').value),
                stock_quantity: parseInt(document.getElementById('prod-stock').value),
                image: document.getElementById('prod-image').value,
                description: document.getElementById('prod-desc').value
            };

            toggleLoading(true);
            try {
                await createProduct(product);
                showToast('Produto cadastrado!', 'success');
                prodForm.reset();
            } catch(err) {
                showToast('Erro: ' + err.message, 'error');
            } finally {
                toggleLoading(false);
            }
        };
    }

    // Listener do form de edição
    const editForm = document.getElementById('edit-form');
    if(editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const status = document.getElementById('edit-status').value;
            const dateStr = document.getElementById('edit-date').value;
            const serviceId = document.getElementById('edit-service').value;
            const empId = document.getElementById('edit-employee').value; // Novo campo
            
            toggleLoading(true);
            try {
                const start = new Date(dateStr);
                const end = new Date(start.getTime() + 60*60000); 

                const payload = {
                    status,
                    service_id: serviceId,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                };

                // Só envia employee_id se selecionado (ou null para limpar)
                if (empId) payload.employee_id = empId;
                else payload.employee_id = null;

                await updateAppointmentFull(id, payload);
                showToast('Agendamento atualizado!', 'success');
                document.getElementById('edit-modal').classList.remove('open');
                
                // Refresh
                const app = document.getElementById('app');
                app.innerHTML = await renderAdminDashboard();

            } catch(err) {
                showToast(err.message, 'error');
            } finally {
                toggleLoading(false);
            }
        }
    }
}

// --- Globais para Eventos Inline ---

window.setAdminTab = async (tab) => {
    currentView = tab;
    const app = document.getElementById('app');
    app.innerHTML = await renderAdminDashboard();
};

window.openEditModal = async (appId) => {
    const app = loadedAppointments.find(a => a.id === appId);
    if(!app) return;

    toggleLoading(true);
    const services = await getServices();
    const employees = await getEmployees(); // Busca lista de funcionários
    toggleLoading(false);

    // Popula Modal
    document.getElementById('edit-id').value = app.id;
    document.getElementById('edit-date').value = toInputDate(new Date(app.start_time));
    document.getElementById('edit-status').value = app.status;
    document.getElementById('edit-pet-id').value = app.pets?.name + ' (ID: ' + app.pet_id + ')';

    const srvSelect = document.getElementById('edit-service');
    srvSelect.innerHTML = services.map(s => `<option value="${s.id}" ${s.id === app.service_id ? 'selected' : ''}>${s.name}</option>`).join('');

    // Popula Select de Funcionários
    const empSelect = document.getElementById('edit-employee');
    empSelect.innerHTML = '<option value="">-- Sem responsável --</option>' + 
        employees.map(e => `<option value="${e.id}" ${e.id === app.employee_id ? 'selected' : ''}>${e.full_name}</option>`).join('');

    document.getElementById('edit-modal').classList.add('open');
};