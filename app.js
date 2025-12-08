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
    document.getElementById('storyBtn').onclick = () => { haptic.medium(); openStoryModal(); };
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
                    state.wishes.unshift({
                        id: newWish.id,
                        ...wishData,
                        reserved: false,
                        createdAt: Date.now()
                    });
                    showToast('✓ Добавлено');
                    confetti();
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

// Story Modal
let storyType = 'wish'; // 'wish' или 'text'

window.openStoryModal = function() {
    const select = document.getElementById('storyWishSelect');
    const hasWishes = state.wishes.filter(w => !w.reserved).length > 0;
    
    // Заполняем список желаний
    select.innerHTML = '<option value="">-- Выбери подарок --</option>' + 
        state.wishes.filter(w => !w.reserved).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
    
    // Если нет желаний - переключаем на текст
    if (!hasWishes) {
        selectStoryType('text');
    } else {
        selectStoryType('wish');
    }
    
    document.getElementById('storyUsername').textContent = `@${state.username}`;
    document.getElementById('storyModal').classList.add('active');
};

window.closeStoryModal = function() {
    document.getElementById('storyModal').classList.remove('active');
};

window.selectStoryType = function(type) {
    storyType = type;
    haptic.light();
    
    // Обновляем табы
    document.querySelectorAll('.story-type-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === type);
    });
    
    // Показываем нужные поля
    document.getElementById('wishSelectGroup').style.display = type === 'wish' ? 'block' : 'none';
    document.getElementById('textInputGroup').style.display = type === 'text' ? 'block' : 'none';
    
    // Показываем нужный контент в превью
    document.getElementById('storyWishCard').style.display = type === 'wish' ? 'block' : 'none';
    document.getElementById('storyTextDisplay').style.display = type === 'text' ? 'flex' : 'none';
    
    updateStoryPreview();
};

window.setStoryText = function(text) {
    document.getElementById('storyTextInput').value = text;
    updateStoryPreview();
    haptic.light();
};

window.selectTemplate = function(el) {
    document.querySelectorAll('.story-template').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    haptic.light();
    
    const bg = el.dataset.bg;
    const preview = document.getElementById('storyPreview');
    const gradients = {
        green: 'linear-gradient(135deg, #165B33 0%, #146B3A 50%, #0B3D2E 100%)',
        warm: 'linear-gradient(135deg, #c41e3a 0%, #ff6b6b 100%)',
        cool: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        sunset: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    };
    preview.style.background = gradients[bg] || gradients.green;
};

window.updateStoryPreview = function() {
    if (storyType === 'wish') {
        const wishId = document.getElementById('storyWishSelect').value;
        const wish = state.wishes.find(w => w.id === wishId);
        
        document.getElementById('storyWishName').textContent = wish ? wish.name : 'Выбери желание';
        document.getElementById('storyWishPrice').textContent = wish?.price ? `${Number(wish.price).toLocaleString('ru-RU')} ${wish.currency}` : '💫';
    } else {
        const text = document.getElementById('storyTextInput').value || 'Загадай желание!';
        document.getElementById('storyTextContent').textContent = text;
    }
};

window.shareStory = async function() {
    haptic.medium();
    const preview = document.getElementById('storyPreview');
    
    // Проверяем что выбрано
    if (storyType === 'wish' && !document.getElementById('storyWishSelect').value) {
        showToast('Выбери желание');
        return;
    }
    
    try {
        showToast('⏳ Создаём...');
        
        // Генерируем картинку
        const canvas = await html2canvas(preview, { 
            scale: 2, 
            backgroundColor: null, 
            useCORS: true,
            logging: false
        });
        
        // Конвертируем в blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
        // Пробуем поделиться через Telegram Stories API
        if (tg?.shareToStory) {
            const base64 = canvas.toDataURL('image/png');
            const userId = state.userId;
            const shareUrl = `https://t.me/${window.BOT_USERNAME || 'giftl_robot'}?start=wishlist_${userId}`;
            
            tg.shareToStory(base64, {
                widget_link: {
                    url: shareUrl,
                    name: 'Открыть вишлист'
                }
            });
            haptic.success();
            showToast('✓ Открываем Stories');
            closeStoryModal();
        } else {
            // Fallback - скачиваем картинку
            const link = document.createElement('a');
            link.download = 'giftly-story.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            haptic.success();
            showToast('✓ Сохранено! Добавь в Stories');
        }
    } catch (err) {
        console.error('Story error:', err);
        showToast('Ошибка создания');
    }
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
