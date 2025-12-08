// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// Haptic
const haptic = {
    light: () => tg?.HapticFeedback?.impactOccurred('light'),
    medium: () => tg?.HapticFeedback?.impactOccurred('medium'),
    success: () => tg?.HapticFeedback?.notificationOccurred('success'),
    error: () => tg?.HapticFeedback?.notificationOccurred('error')
};

// State
const state = {
    wishes: [],
    userId: null, // UUID из Supabase
    telegramId: tg?.initDataUnsafe?.user?.id?.toString() || null,
    userName: tg?.initDataUnsafe?.user?.first_name || 'Пользователь',
    username: tg?.initDataUnsafe?.user?.username || 'user',
    photoUrl: tg?.initDataUnsafe?.user?.photo_url || null
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
    await initUser();
    await loadWishes();
    render();
    
    document.getElementById('addWishBtn').onclick = () => { haptic.medium(); openAddModal(); };
    document.getElementById('wishForm').onsubmit = handleSubmit;
});

// Инициализация пользователя в Supabase
async function initUser() {
    const sb = window.supabaseClient;
    
    console.log('initUser - telegramId:', state.telegramId, 'supabase:', !!sb);
    
    if (!state.telegramId || !sb) {
        console.log('No telegram ID or supabase client');
        return;
    }
    
    try {
        // Ищем пользователя
        const { data: existingUser, error: findError } = await sb
            .from('users')
            .select('*')
            .eq('telegram_id', state.telegramId)
            .single();
        
        console.log('Find user result:', existingUser, findError);
        
        if (existingUser) {
            state.userId = existingUser.id;
            console.log('User found:', existingUser.id);
        } else {
            // Создаём нового
            console.log('Creating new user...');
            const { data: newUser, error } = await sb
                .from('users')
                .insert([{
                    telegram_id: parseInt(state.telegramId),
                    username: state.username,
                    first_name: state.userName,
                    photo_url: state.photoUrl
                }])
                .select()
                .single();
            
            console.log('Create user result:', newUser, error);
            
            if (newUser) {
                state.userId = newUser.id;
                console.log('User created:', newUser.id);
            } else {
                console.error('Failed to create user:', error);
            }
        }
    } catch (err) {
        console.error('Init user error:', err);
    }
}

// Загрузка желаний из Supabase
async function loadWishes() {
    const sb = window.supabaseClient;
    
    if (!state.userId || !sb) {
        console.log('loadWishes - no userId or supabase, using localStorage');
        state.wishes = JSON.parse(localStorage.getItem('wishes') || '[]');
        return;
    }
    
    try {
        const { data, error } = await sb
            .from('wishes')
            .select('*')
            .eq('user_id', state.userId)
            .order('created_at', { ascending: false });
        
        console.log('Load wishes result:', data, error);
        
        if (data) {
            state.wishes = data.map(w => ({
                id: w.id,
                name: w.name,
                description: w.description,
                price: w.price,
                currency: w.currency || '₽',
                url: w.url,
                photo: w.photo_url,
                reserved: w.reserved,
                createdAt: new Date(w.created_at).getTime()
            }));
            console.log('Loaded wishes:', state.wishes.length);
        }
    } catch (err) {
        console.error('Load wishes error:', err);
        state.wishes = JSON.parse(localStorage.getItem('wishes') || '[]');
    }
}

function render() {
    const list = document.getElementById('wishesList');
    const empty = document.getElementById('emptyState');
    
    if (state.wishes.length === 0) {
        list.innerHTML = '';
        empty.classList.add('active');
        return;
    }
    
    empty.classList.remove('active');
    list.innerHTML = state.wishes.map((w, i) => createCard(w, i)).join('');
    
    document.querySelectorAll('.card').forEach(card => {
        const id = card.dataset.id;
        card.querySelector('.btn-edit')?.addEventListener('click', (e) => { e.stopPropagation(); haptic.light(); editWish(id); });
        card.querySelector('.btn-delete')?.addEventListener('click', (e) => { e.stopPropagation(); haptic.medium(); deleteWish(id); });
    });
}

function createCard(wish, i) {
    const img = wish.photo 
        ? `<img src="${wish.photo}" class="card-image" loading="lazy">` 
        : `<div class="card-image-placeholder">🎁</div>`;
    const price = wish.price ? `<span class="card-price">${Number(wish.price).toLocaleString('ru-RU')} ${wish.currency}</span>` : '';
    const link = wish.url ? `<a href="${wish.url}" target="_blank" style="color: #667eea; font-size: 14px; text-decoration: none; display: block; margin-bottom: 8px;">🔗 Где купить</a>` : '';
    const desc = wish.description ? `<p class="card-subtitle">${esc(wish.description)}</p>` : '';
    
    return `
        <div class="card ${wish.reserved ? 'reserved' : ''}" data-id="${wish.id}">
            ${img}
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
                    <h3 class="card-title">${esc(wish.name)}</h3>
                    ${price}
                </div>
                ${desc}
                ${link}
                ${!wish.reserved ? `
                <div class="card-actions">
                    <button class="btn btn-secondary btn-edit">✏️ Изменить</button>
                    <button class="btn btn-danger btn-delete">🗑️</button>
                </div>` : ''}
            </div>
        </div>
    `;
}

// Add Modal
function openAddModal(wish = null) {
    const modal = document.getElementById('addModal');
    const preview = document.getElementById('photoPreview');
    
    if (wish) {
        document.getElementById('modalTitle').textContent = 'Редактировать';
        document.getElementById('wishId').value = wish.id;
        document.getElementById('wishName').value = wish.name;
        document.getElementById('wishUrl').value = wish.url || '';
        document.getElementById('wishPrice').value = wish.price || '';
        document.getElementById('wishCurrency').value = wish.currency || '₽';
        document.getElementById('wishDescription').value = wish.description || '';
        if (wish.photo) {
            preview.style.backgroundImage = `url(${wish.photo})`;
            preview.classList.add('has-image');
        }
    } else {
        document.getElementById('modalTitle').textContent = 'Новое желание';
        document.getElementById('wishForm').reset();
        document.getElementById('wishId').value = '';
        preview.style.backgroundImage = '';
        preview.classList.remove('has-image');
    }
    
    modal.classList.add('active');
}

window.closeAddModal = function() {
    document.getElementById('addModal').classList.remove('active');
};

async function handleSubmit(e) {
    e.preventDefault();
    haptic.success();
    
    const id = document.getElementById('wishId').value;
    const preview = document.getElementById('photoPreview');
    const photoUrl = preview.style.backgroundImage.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1') || null;
    
    const wishData = {
        name: document.getElementById('wishName').value.trim(),
        url: document.getElementById('wishUrl').value.trim(),
        price: document.getElementById('wishPrice').value || null,
        currency: document.getElementById('wishCurrency').value,
        description: document.getElementById('wishDescription').value.trim(),
        photo: photoUrl
    };
    
    const sb = window.supabaseClient;
    
    // Сохраняем в Supabase
    if (state.userId && sb) {
        try {
            if (id) {
                // Обновляем
                console.log('Updating wish:', id);
                const { error } = await sb
                    .from('wishes')
                    .update({
                        name: wishData.name,
                        description: wishData.description,
                        price: wishData.price,
                        currency: wishData.currency,
                        url: wishData.url,
                        photo_url: wishData.photo
                    })
                    .eq('id', id);
                
                console.log('Update result:', error);
                
                if (!error) {
                    const idx = state.wishes.findIndex(w => w.id === id);
                    if (idx !== -1) {
                        state.wishes[idx] = { ...state.wishes[idx], ...wishData };
                    }
                    showToast('✓ Обновлено');
                } else {
                    showToast('Ошибка: ' + error.message);
                }
            } else {
                // Создаём новое
                console.log('Creating wish for user:', state.userId);
                const { data: newWish, error } = await sb
                    .from('wishes')
                    .insert([{
                        user_id: state.userId,
                        name: wishData.name,
                        description: wishData.description,
                        price: wishData.price,
                        currency: wishData.currency,
                        url: wishData.url,
                        photo_url: wishData.photo
                    }])
                    .select()
                    .single();
                
                console.log('Create wish result:', newWish, error);
                
                if (newWish) {
                    const isFirstWish = state.wishes.length === 0;
                    state.wishes.unshift({
                        id: newWish.id,
                        ...wishData,
                        reserved: false,
                        createdAt: Date.now()
                    });
                    showToast('✓ Добавлено');
                    confetti();
                    
                    // Показываем модалку после первого желания
                    if (isFirstWish) {
                        setTimeout(() => showFirstWishModal(), 500);
                    }
                } else {
                    console.error('Create wish error:', error);
                    showToast('Ошибка: ' + (error?.message || 'неизвестная'));
                }
            }
        } catch (err) {
            console.error('Save wish error:', err);
            showToast('Ошибка: ' + err.message);
        }
    } else {
        console.log('No supabase, saving to localStorage. userId:', state.userId, 'sb:', !!sb);
        // Fallback на localStorage
        const isFirstWish = !id && state.wishes.length === 0;
        const localData = {
            id: id || genId(),
            ...wishData,
            reserved: false,
            createdAt: id ? state.wishes.find(w => w.id === id)?.createdAt : Date.now()
        };
        
        if (id) {
            const idx = state.wishes.findIndex(w => w.id === id);
            if (idx !== -1) state.wishes[idx] = localData;
            showToast('✓ Обновлено');
        } else {
            state.wishes.unshift(localData);
            showToast('✓ Добавлено');
            confetti();
            
            // Показываем модалку после первого желания
            if (isFirstWish) {
                setTimeout(() => showFirstWishModal(), 500);
            }
        }
        saveLocal();
    }
    
    render();
    window.closeAddModal();
}

function editWish(id) {
    const wish = state.wishes.find(w => w.id === id);
    if (wish) openAddModal(wish);
}

async function deleteWish(id) {
    if (confirm('Удалить желание?')) {
        haptic.error();
        
        const sb = window.supabaseClient;
        
        // Удаляем из Supabase
        if (state.userId && sb) {
            try {
                const { error } = await sb
                    .from('wishes')
                    .delete()
                    .eq('id', id);
                console.log('Delete result:', error);
            } catch (err) {
                console.error('Delete wish error:', err);
            }
        }
        
        state.wishes = state.wishes.filter(w => w.id !== id);
        saveLocal();
        render();
        showToast('Удалено');
    }
}

window.handlePhoto = function(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Макс. 5MB'); return; }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('photoPreview');
        preview.style.backgroundImage = `url(${e.target.result})`;
        preview.classList.add('has-image');
        haptic.success();
    };
    reader.readAsDataURL(file);
};



// Utils
function saveLocal() { localStorage.setItem('wishes', JSON.stringify(state.wishes)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substring(2); }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function showToast(msg) { 
    const toast = document.getElementById('toast');
    toast.textContent = msg; 
    toast.classList.add('active'); 
    setTimeout(() => toast.classList.remove('active'), 2000); 
}

function confetti() {
    const colors = ['#667eea', '#f093fb', '#4facfe', '#38ef7d', '#fee140'];
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 3000);
        }, i * 30);
    }
}

// Модалка первого желания
function showFirstWishModal() {
    // Создаём модалку
    const modal = document.createElement('div');
    modal.id = 'firstWishModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeFirstWishModal()"></div>
        <div class="modal-content" style="text-align: center; padding: 32px 24px;">
            <div style="font-size: 80px; margin-bottom: 16px;">🎉</div>
            <h2 style="color: white; margin-bottom: 12px; font-size: 24px;">Первое желание есть!</h2>
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 24px; font-size: 16px;">
                Хочешь поделиться своим вишлистом в Stories?
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button onclick="closeFirstWishModal()" style="
                    padding: 14px 24px;
                    background: rgba(255,255,255,0.1);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                ">Позже</button>
                <button onclick="goToStoryEditor()" style="
                    padding: 14px 24px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                ">📸 Да, создать!</button>
            </div>
        </div>
    `;
    modal.className = 'modal active';
    document.body.appendChild(modal);
    haptic.success();
}

window.closeFirstWishModal = function() {
    const modal = document.getElementById('firstWishModal');
    if (modal) modal.remove();
};

window.goToStoryEditor = function() {
    closeFirstWishModal();
    // Переходим на страницу профиля с открытием редактора Stories
    window.location.href = 'profile.html?openStory=1';
};
