
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
        loader.className = 'loader-overlay';
        loader.innerHTML = '<div class="spinner"></div>';
        
        container.style.position = 'relative';
        container.appendChild(loader);
    } else {
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.remove();
    }
}

// --- Scroll Animations (IntersectionObserver) ---
export function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-visible');
                observer.unobserve(entry.target); // Anima apenas uma vez
            }
        });
    }, observerOptions);

    const hiddenElements = document.querySelectorAll('.scroll-hidden');
    hiddenElements.forEach(el => observer.observe(el));
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
    <div class="calendar-wrapper scroll-hidden">
        <div class="calendar-grid">
            <div class="cal-header-corner">🕒</div>
            ${calendarDays.map(d => `
                <div class="cal-header-day">
                    <div class="cal-day-label">${d.toLocaleDateString('pt-BR', {weekday: 'short'}).toUpperCase()}</div>
                    <div class="cal-date-label">${d.getDate()}/${d.getMonth()+1}</div>
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
        <div class="cal-legend">
             <div class="cal-legend-item"><span class="cal-legend-dot dot-free"></span> Livre</div>
             <div class="cal-legend-item"><span class="cal-legend-dot dot-busy"></span> Ocupado</div>
        </div>
    </div>`;

    return html;
}

export function clearElement(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = '';
}
