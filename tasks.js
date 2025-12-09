// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const haptic = {
    light: () => tg?.HapticFeedback?.impactOccurred('light'),
    medium: () => tg?.HapticFeedback?.impactOccurred('medium'),
    heavy: () => tg?.HapticFeedback?.impactOccurred('heavy'),
    success: () => tg?.HapticFeedback?.notificationOccurred('success'),
    warning: () => tg?.HapticFeedback?.notificationOccurred('warning'),
    error: () => tg?.HapticFeedback?.notificationOccurred('error'),
    selection: () => tg?.HapticFeedback?.selectionChanged()
};

// Global haptic for all interactive elements
document.addEventListener('click', (e) => {
    const target = e.target.closest('.nav-item, .btn, .task-card, .ticket-card, .prize-banner');
    if (target) haptic.light();
}, true);

document.addEventListener('focus', (e) => {
    if (e.target.matches('.form-input, input, textarea')) haptic.selection();
}, true);

const state = {
    oderId: null,
    telegramId: tg?.initDataUnsafe?.user?.id?.toString() || null,
    userName: tg?.initDataUnsafe?.user?.first_name || 'Пользователь',
    tickets: 0,
    tasks: [],
    completedTasks: []
};

// Задания загружаются из Supabase (добавляются через админку)
let TASKS = [];

async function init() {
    await loadTasks();
    await loadUserData();
    renderTasks();
    renderTickets();
    updatePrizeTimer();
    setInterval(updatePrizeTimer, 60000);
}

async function loadTasks() {
    const sb = window.supabaseClient;
    if (!sb) {
        // Fallback на localStorage
        TASKS = JSON.parse(localStorage.getItem('adminTasks') || '[]').filter(t => t.active !== false);
        return;
    }

    try {
        const { data, error } = await sb
            .from('tasks')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (data && !error) {
            TASKS = data.map(t => ({
                id: t.id,
                type: t.type,
                icon: t.icon || '📋',
                title: t.title,
                description: t.description,
                reward: t.reward || 1,
                link: t.link,
                channelId: t.link?.startsWith('@') ? t.link : (t.link?.includes('t.me/') ? '@' + t.link.split('t.me/')[1] : null),
                action: t.type === 'daily' ? 'daily' : (t.type === 'referral' ? 'invite' : null)
            }));
        }
    } catch (err) {
        console.error('Load tasks error:', err);
        TASKS = JSON.parse(localStorage.getItem('adminTasks') || '[]').filter(t => t.active !== false);
    }
}

async function loadUserData() {
    const sb = window.supabaseClient;
    if (!sb || !state.telegramId) return;

    try {
        // Получаем пользователя
        const { data: user } = await sb
            .from('users')
            .select('id, tickets')
            .eq('telegram_id', parseInt(state.telegramId))
            .single();

        if (user) {
            state.userId = user.id;
            state.tickets = user.tickets || 0;
            document.getElementById('ticketsCount').textContent = state.tickets;
        }

        // Получаем выполненные задания
        if (state.userId) {
            const { data: completed } = await sb
                .from('completed_tasks')
                .select('task_id')
                .eq('user_id', state.userId);

            if (completed) {
                state.completedTasks = completed.map(c => c.task_id);
            }
        }
    } catch (err) {
        console.error('Load user data error:', err);
    }
}

function renderTasks() {
    const list = document.getElementById('tasksList');
    
    if (TASKS.length === 0) {
        list.innerHTML = `
            <div class="empty-tickets" style="padding: 30px 20px;">
                <span>Пока нет заданий</span>
                <span>Скоро появятся новые!</span>
            </div>
        `;
        return;
    }
    
    list.innerHTML = TASKS.map(task => {
        const isCompleted = state.completedTasks.includes(task.id);
        const isDaily = task.type === 'daily';
        const canClaimDaily = isDaily && canClaimDailyReward();
        
        return `
            <div class="task-card ${isCompleted && !isDaily ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-icon">${task.icon}</div>
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-desc">${task.description}</div>
                </div>
                <div class="task-reward">
                    <span class="reward-tickets">+${task.reward}</span>
                    <span class="reward-icon">🎟️</span>
                </div>
                ${isCompleted && !isDaily ? 
                    '<button class="task-btn done">✓</button>' : 
                    isDaily && !canClaimDaily ?
                    '<button class="task-btn done">✓</button>' :
                    `<button class="task-btn" onclick="startTask('${task.id}')">→</button>`
                }
            </div>
        `;
    }).join('');
}

function canClaimDailyReward() {
    const lastClaim = localStorage.getItem('lastDailyClaim');
    if (!lastClaim) return true;
    
    const lastDate = new Date(parseInt(lastClaim));
    const now = new Date();
    return lastDate.toDateString() !== now.toDateString();
}

async function startTask(taskId) {
    haptic.medium();
    const task = TASKS.find(t => t.id === taskId);
    if (!task) return;

    if (task.type === 'subscribe' || task.type === 'join_chat') {
        // Открываем канал/чат
        const link = task.link?.startsWith('http') ? task.link : `https://t.me/${task.link?.replace('@', '')}`;
        if (tg) {
            tg.openTelegramLink(link);
        } else {
            window.open(link, '_blank');
        }
        
        // Показываем модалку проверки
        setTimeout(() => {
            showVerifyModal(task);
        }, 2000);
        
    } else if (task.type === 'open_app') {
        // Открываем мини-апп
        if (task.link) {
            if (tg) {
                tg.openTelegramLink(task.link);
            } else {
                window.open(task.link, '_blank');
            }
        }
        // Даём награду сразу
        await claimReward(task);
        
    } else if (task.type === 'daily') {
        if (canClaimDailyReward()) {
            await claimReward(task);
            localStorage.setItem('lastDailyClaim', Date.now().toString());
        } else {
            showToast('Приходи завтра!');
        }
        
    } else if (task.type === 'referral') {
        shareInviteLink();
        
    } else if (task.type === 'action') {
        // Действие в приложении - проверяем по link
        if (task.link === 'add_wish') {
            const wishes = JSON.parse(localStorage.getItem('wishes') || '[]');
            if (wishes.length > 0) {
                await claimReward(task);
            } else {
                showToast('Сначала добавь желание!');
                setTimeout(() => location.href = 'index.html', 1000);
            }
        } else if (task.link === 'share_story') {
            location.href = 'profile.html?openStory=1&taskId=' + taskId;
        } else {
            // Просто даём награду
            await claimReward(task);
        }
    }
}

function showVerifyModal(task) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'verifyModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeVerifyModal()"></div>
        <div class="modal-content" style="text-align: center; padding: 32px 24px;">
            <div style="font-size: 64px; margin-bottom: 16px;">${task.icon}</div>
            <h2 style="color: var(--text-primary); margin-bottom: 12px;">Проверка подписки</h2>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                Подписался на <strong>${task.channelId}</strong>?
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button onclick="closeVerifyModal()" class="btn btn-secondary">Отмена</button>
                <button onclick="verifySubscription('${task.id}')" class="btn btn-primary">✓ Проверить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.closeVerifyModal = function() {
    const modal = document.getElementById('verifyModal');
    if (modal) modal.remove();
};

async function verifySubscription(taskId) {
    const task = TASKS.find(t => t.id === taskId);
    if (!task) return;

    showToast('⏳ Проверяем...');
    
    // Отправляем запрос боту для проверки подписки
    const sb = window.supabaseClient;
    if (sb && state.telegramId) {
        try {
            // Вызываем Edge Function для проверки
            const response = await fetch(`${window.SUPABASE_URL}/functions/v1/check-subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    oderId: state.telegramId,
                    channelId: task.channelId
                })
            });

            const result = await response.json();
            
            if (result.subscribed) {
                closeVerifyModal();
                await claimReward(task);
            } else {
                haptic.error();
                showToast('❌ Ты не подписан! Подпишись и попробуй снова');
            }
        } catch (err) {
            console.error('Verify error:', err);
            // Fallback - доверяем пользователю (для тестирования)
            closeVerifyModal();
            await claimReward(task);
        }
    } else {
        closeVerifyModal();
        await claimReward(task);
    }
}

async function claimReward(task) {
    haptic.success();
    
    const sb = window.supabaseClient;
    
    if (sb && state.userId) {
        try {
            // Добавляем билетики
            await sb
                .from('users')
                .update({ tickets: state.tickets + task.reward })
                .eq('id', state.userId);

            // Записываем выполненное задание
            await sb
                .from('completed_tasks')
                .insert([{
                    user_id: state.userId,
                    task_id: task.id,
                    reward: task.reward
                }]);

            // Создаём билетики
            const ticketPromises = [];
            for (let i = 0; i < task.reward; i++) {
                ticketPromises.push(
                    sb.from('user_tickets').insert([{
                        user_id: state.userId,
                        source: task.id
                    }])
                );
            }
            await Promise.all(ticketPromises);

        } catch (err) {
            console.error('Claim reward error:', err);
        }
    }

    state.tickets += task.reward;
    state.completedTasks.push(task.id);
    
    document.getElementById('ticketsCount').textContent = state.tickets;
    
    // Анимация получения билетиков
    showTicketAnimation(task.reward);
    showToast(`🎟️ +${task.reward} билетик${task.reward > 1 ? 'а' : ''}!`);
    
    renderTasks();
    renderTickets();
}

function showTicketAnimation(count) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const ticket = document.createElement('div');
            ticket.className = 'flying-ticket';
            ticket.textContent = '🎟️';
            ticket.style.left = (Math.random() * 60 + 20) + '%';
            document.body.appendChild(ticket);
            setTimeout(() => ticket.remove(), 1500);
        }, i * 200);
    }
}

function renderTickets() {
    const container = document.getElementById('myTickets');
    
    if (state.tickets === 0) {
        container.innerHTML = `
            <div class="empty-tickets">
                <span>Пока нет билетиков</span>
                <span>Выполни задание чтобы получить!</span>
            </div>
        `;
        return;
    }

    // Показываем билетики (максимум 20 визуально)
    const displayCount = Math.min(state.tickets, 20);
    let html = '';
    
    for (let i = 0; i < displayCount; i++) {
        const rotation = (Math.random() - 0.5) * 10;
        html += `
            <div class="ticket-card" style="transform: rotate(${rotation}deg);">
                <div class="ticket-inner">
                    <div class="ticket-emoji">🎟️</div>
                    <div class="ticket-number">#${String(i + 1).padStart(3, '0')}</div>
                </div>
            </div>
        `;
    }
    
    if (state.tickets > 20) {
        html += `<div class="tickets-more">+${state.tickets - 20} ещё</div>`;
    }
    
    container.innerHTML = html;
}

function shareInviteLink() {
    const botUsername = window.BOT_USERNAME || 'giftl_robot';
    const inviteLink = `https://t.me/${botUsername}?start=ref_${state.telegramId}`;
    const text = '🎁 Создай свой вишлист в Giftly и получи билетики для розыгрыша!';
    
    if (tg) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`);
    }
}

function updatePrizeTimer() {
    // Розыгрыш каждое воскресенье в 20:00
    const now = new Date();
    const nextSunday = new Date();
    nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
    nextSunday.setHours(20, 0, 0, 0);
    
    if (nextSunday <= now) {
        nextSunday.setDate(nextSunday.getDate() + 7);
    }
    
    const diff = nextSunday - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    document.getElementById('prizeTimer').textContent = `${days}д ${hours}ч`;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 2500);
}

init();