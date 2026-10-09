const API_BASE = '/api/v1';

// Состояние приложения
const state = {
    tokens: {
        access: localStorage.getItem('access_token') || null,
        refresh: localStorage.getItem('refresh_token') || null,
    },
    currentUser: null,
    currentTicketId: null,
};

// ==========================================
// 1. API КЛИЕНТ И РАБОТА С ТОКЕНАМИ
// ==========================================

async function apiRequest(endpoint, options = {}) {
    options.headers = options.headers || {};
    
    // Подставляем Bearer токен, если он есть
    if (state.tokens.access) {
        options.headers['Authorization'] = `Bearer ${state.tokens.access}`;
    }
    options.headers['Content-Type'] = 'application/json';

    let response = await fetch(`${API_BASE}${endpoint}`, options);

    // Если токен протух (401) — пытаемся обновить через Refresh токен
    if (response.status === 401 && state.tokens.refresh) {
        const refreshed = await refreshToken();
        if (refreshed) {
            options.headers['Authorization'] = `Bearer ${state.tokens.access}`;
            response = await fetch(`${API_BASE}${endpoint}`, options);
        } else {
            logout();
            return null;
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(errorData));
    }

    if (response.status === 204) return true;
    return response.json();
}

async function refreshToken() {
    try {
        const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: state.tokens.refresh }),
        });

        if (!res.ok) return false;

        const data = await res.json();
        state.tokens.access = data.access;
        localStorage.setItem('access_token', data.access);
        return true;
    } catch {
        return false;
    }
}

// Парсинг полезной нагрузки JWT без библиотек
function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

function setTokens(access, refresh) {
    state.tokens.access = access;
    state.tokens.refresh = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    
    // Считываем роль и никнейм из токена
    state.currentUser = parseJwt(access);
}

function logout() {
    state.tokens.access = null;
    state.tokens.refresh = null;
    localStorage.clear();
    showView('auth');
}

// ==========================================
// 2. УПРАВЛЕНИЕ ЭКРАНАМИ
// ==========================================

const views = {
    auth: document.getElementById('view-auth'),
    tickets: document.getElementById('view-tickets'),
    detail: document.getElementById('view-detail'),
    header: document.getElementById('main-header'),
};

function showView(name) {
    views.auth.classList.toggle('hidden', name !== 'auth');
    views.tickets.classList.toggle('hidden', name !== 'tickets');
    views.detail.classList.toggle('hidden', name !== 'detail');
    views.header.classList.toggle('hidden', name === 'auth');

    if (name !== 'auth' && state.tokens.access) {
        if (!state.currentUser) {
            state.currentUser = parseJwt(state.tokens.access);
        }
        const roleLabel = state.currentUser.role === 'client' ? 'Клиент' : 'Сотрудник поддержки';
        document.getElementById('user-info').textContent = 
            `${state.currentUser.username} (${roleLabel})`;
    }
}

// ==========================================
// 3. БИЗНЕС-ЛОГИКА И РЕНДЕР
// ==========================================

// Загрузка и показ списка тикетов
async function loadTickets(statusFilter = '') {
    const listEl = document.getElementById('tickets-list');
    listEl.innerHTML = '<div style="padding: 16px; color: var(--text-muted);">Загрузка...</div>';

    try {
        let endpoint = '/tickets/';
        if (statusFilter) endpoint += `?status=${statusFilter}`;
        
        const data = await apiRequest(endpoint);
        const tickets = data.results || data;

        if (tickets.length === 0) {
            listEl.innerHTML = '<div style="padding: 16px; color: var(--text-muted);">Обращений пока нет</div>';
            return;
        }

        listEl.innerHTML = tickets.map(ticket => `
            <div class="ticket-item" onclick="openTicketDetail(${ticket.id})">
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">#${ticket.id} ${escapeHtml(ticket.title)}</div>
                    <div style="font-size: 13px; color: var(--text-muted);">
                        Автор: ${ticket.author.username} | Ответов: ${ticket.comments_count}
                    </div>
                </div>
                <div>
                    <span class="badge badge-${ticket.status}">${ticket.status}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        listEl.innerHTML = `<div style="padding: 16px; color: var(--danger);">Ошибка загрузки данных</div>`;
    }
}

// Открытие одного тикета
async function openTicketDetail(ticketId) {
    state.currentTicketId = ticketId;
    showView('detail');

    try {
        const ticket = await apiRequest(`/tickets/${ticketId}/`);
        renderTicketDetail(ticket);
    } catch (err) {
        alert('Не удалось загрузить тикет: ' + err.message);
    }
}

function renderTicketDetail(ticket) {
    const container = document.getElementById('ticket-info');
    const isSupport = state.currentUser && (state.currentUser.role === 'support' || state.currentUser.role === 'admin');

    // Формируем кнопки в зависимости от статуса тикета и роли пользователя
    let actionButtons = '';

    if (isSupport) {
        // 1. Модератор/Саппорт может взять тикет в работу, если он ещё не назначен
        if (!ticket.assignee && ticket.status !== 'closed') {
            actionButtons += `<button onclick="assignToMe(${ticket.id})">Взять в работу</button>`;
        }
        
        // 2. Модератор/Саппорт может завершить диалог (перевести в статус 'resolved')
        if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
            actionButtons += `<button onclick="resolveTicket(${ticket.id})" style="background-color: var(--success); margin-left: 8px;">Завершить диалог (Решено)</button>`;
        }
    }

    // 3. Клиент может окончательно закрыть своё обращение, когда саппорт его решил
    if (!isSupport && ticket.status === 'resolved') {
        actionButtons += `<button onclick="closeTicket(${ticket.id})">Подтвердить и закрыть обращение</button>`;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <h2>#${ticket.id} ${escapeHtml(ticket.title)}</h2>
            <span class="badge badge-${ticket.status}">${ticket.status}</span>
        </div>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
            Создан: ${new Date(ticket.created_at).toLocaleString()} | 
            Автор: <b>${ticket.author.username}</b> | 
            Исполнитель: <b>${ticket.assignee ? ticket.assignee.username : 'Не назначен'}</b>
        </p>
        <div style="white-space: pre-wrap; margin-bottom: 20px;">${escapeHtml(ticket.description)}</div>
        <div style="display: flex; gap: 8px;">
            ${actionButtons}
        </div>
    `;

    // Рендер комментариев
    const commentsList = document.getElementById('comments-list');
    if (!ticket.comments || ticket.comments.length === 0) {
        commentsList.innerHTML = '<span style="color: var(--text-muted); font-size: 13px;">Комментариев пока нет</span>';
    } else {
        commentsList.innerHTML = ticket.comments.map(c => `
            <div style="background: var(--bg-color); padding: 12px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">
                    <b>${c.author.username}</b> (${new Date(c.created_at).toLocaleString()})
                </div>
                <div>${escapeHtml(c.text)}</div>
            </div>
        `).join('');
    }
}

// Защита от XSS при вставке в innerHTML
function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Экшены
async function assignToMe(id) {
    try {
        await apiRequest(`/tickets/${id}/assign-me/`, { method: 'POST' });
        openTicketDetail(id);
    } catch (err) {
        alert('Ошибка назначения: ' + err.message);
    }
}

async function closeTicket(id) {
    try {
        await apiRequest(`/tickets/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'closed' })
        });
        openTicketDetail(id);
    } catch (err) {
        alert('Ошибка изменения статуса: ' + err.message);
    }
}

async function resolveTicket(id) {
    try {
        await apiRequest(`/tickets/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'resolved' })
        });
        openTicketDetail(id);
    } catch (err) {
        alert('Ошибка при завершении диалога: ' + err.message);
    }
}

// ==========================================
// 4. СЛУШАТЕЛИ СОБЫТИЙ (EVENT LISTENERS)
// ==========================================

// Логин
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    errEl.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/auth/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('login-username').value,
                password: document.getElementById('login-password').value,
            })
        });

        if (!res.ok) throw new Error('Неверный логин или пароль');

        const data = await res.json();
        setTokens(data.access, data.refresh);
        showView('tickets');
        loadTickets();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
    }
});

// Выход
document.getElementById('btn-logout').addEventListener('click', logout);

// Навигация
document.getElementById('btn-back').addEventListener('click', () => {
    showView('tickets');
    loadTickets();
});

// Фильтрация
document.getElementById('filter-status').addEventListener('change', (e) => {
    loadTickets(e.target.value);
});

// Добавление комментария
document.getElementById('form-comment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('comment-text');
    try {
        await apiRequest(`/tickets/${state.currentTicketId}/comments/`, {
            method: 'POST',
            body: JSON.stringify({ text: input.value }),
        });
        input.value = '';
        openTicketDetail(state.currentTicketId);
    } catch (err) {
        alert('Не удалось отправить комментарий: ' + err.message);
    }
});

// Модалка создания тикета
const modal = document.getElementById('modal-create');
document.getElementById('btn-create-ticket').addEventListener('click', () => modal.classList.remove('hidden'));
document.getElementById('btn-cancel-modal').addEventListener('click', () => modal.classList.add('hidden'));

document.getElementById('form-create-ticket').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await apiRequest('/tickets/', {
            method: 'POST',
            body: JSON.stringify({
                title: document.getElementById('ticket-title').value,
                priority: document.getElementById('ticket-priority').value,
                description: document.getElementById('ticket-desc').value,
            })
        });
        modal.classList.add('hidden');
        document.getElementById('form-create-ticket').reset();
        loadTickets();
    } catch (err) {
        alert('Ошибка при создании: ' + err.message);
    }
});

// Инициализация при старте
if (state.tokens.access) {
    showView('tickets');
    loadTickets();
} else {
    showView('auth');
}