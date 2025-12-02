
/**
 * ui.js - Gerenciamento de Interface e Utilitários
 */

// --- Notificações (Toasts) ---
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    
    // Reseta classes e define o texto
    toast.className = `visible ${type}`;
    toast.textContent = message;

    // Remove após 3 segundos
    setTimeout(() => {
        toast.className = 'hidden';
    }, 3000);
}

// --- Loading State ---
export function toggleLoading(isLoading, containerId = 'app') {
    const container = document.getElementById(containerId);
    if (isLoading) {
        // Salva o conteúdo atual se necessário ou apenas sobrepõe
        const loader = document.createElement('div');
        loader.id = 'loader-overlay';
        loader.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255,255,255,0.8); z-index: 50; display: flex;
            align-items: center; justify-content: center; backdrop-filter: blur(4px);
            border-radius: var(--radius-md);
        `;
        loader.innerHTML = '<div class="spinner" style="width:40px; height:40px; border:4px solid var(--primary-light); border-top-color:var(--primary); border-radius:50%; animation: spin 1s linear infinite;"></div>';
        
        // Add keyframes via JS for simplicity
        if(!document.getElementById('spin-style')) {
            const style = document.createElement('style');
            style.id = 'spin-style';
            style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        container.style.position = 'relative';
        container.appendChild(loader);
    } else {
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.remove();
    }
}

// --- Formatadores (Essenciais para Petshop) ---

export function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

export function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

export function toInputDate(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(dateObj - offset)).toISOString().slice(0, 16);
    return localISOTime;
}

// --- Componente de Calendário Semanal ---
export function renderWeeklyCalendar(appointments, isPrivate = true) {
    const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17]; 

    const today = new Date();
    const calendarDays = [];
    
    for (let i = 0; i < 6; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === 0) { 
             d.setDate(d.getDate() + 1); 
        }
        calendarDays.push(d);
    }

    let html = `
    <div class="calendar-wrapper">
        <div class="calendar-grid">
            <div class="cal-header-corner" style="display:flex; align-items:center; justify-content:center; color:var(--text-light);">🕒</div>
            ${calendarDays.map(d => `
                <div class="cal-header-day">
                    <div style="font-weight:800; font-size:0.85rem;">${d.toLocaleDateString('pt-BR', {weekday: 'short'}).toUpperCase()}</div>
                    <div style="font-size:0.75rem; color:var(--text-body);">${d.getDate()}/${d.getMonth()+1}</div>
                </div>
            `).join('')}
            
            ${hours.map(h => {
                const timeLabel = `${h}:00`;
                let rowHtml = `<div class="cal-time-label">${timeLabel}</div>`;
                
                rowHtml += calendarDays.map(day => {
                    const slotStart = new Date(day);
                    slotStart.setHours(h, 0, 0, 0);
                    const slotEnd = new Date(day);
                    slotEnd.setHours(h + 1, 0, 0, 0);

                    const busyApp = appointments.find(app => {
                        const appStart = new Date(app.start_time);
                        const appEnd = new Date(app.end_time);
                        return appStart < slotEnd && appEnd > slotStart;
                    });

                    if (busyApp) {
                        if (isPrivate) {
                            return `<div class="cal-cell busy" title="Ocupado"></div>`;
                        } else {
                            return `
                            <div class="cal-cell busy admin" title="${busyApp.profiles?.full_name}">
                                🐾 ${busyApp.pets?.name}
                            </div>`;
                        }
                    } else {
                        return `<div class="cal-cell free" title="Livre"></div>`;
                    }
                }).join('');
                
                return rowHtml;
            }).join('')}
        </div>
        <div style="margin-top:16px; display:flex; gap:24px; font-size:0.8rem; justify-content:center; color:var(--text-body); font-weight:600;">
             <div style="display:flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; background:#F0FFF4; border:1px solid #B8E9D6; border-radius:3px;"></span> Livre</div>
             <div style="display:flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; background:var(--bg-input); border-radius:3px;"></span> Ocupado</div>
        </div>
    </div>`;

    return html;
}

export function clearElement(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = '';
}
