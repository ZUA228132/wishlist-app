// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// Haptic Feedback
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
document.addEventListener('DOMContentLoaded', () => {
    // Add haptic to all clickable elements
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.nav-item, .btn, .card, .list-item, .header-btn, .modal-close, .achievement, .task-card, .ticket-card, .group-card, .participant-card, .story-type-tab, .story-template, .preset-btn, .action-sheet-cancel, .photo-upload, .privacy-option');
        if (target) {
            haptic.light();
        }
    }, true);
    
    // Add haptic to form inputs on focus
    document.addEventListener('focus', (e) => {
        if (e.target.matches('.form-input, input, textarea, select')) {
            haptic.selection();
        }
    }, true);
});

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
    setupUrlInput();
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
    list.innerHTML = state.wishes.map(w => createCard(w)).join('');
    
    document.querySelectorAll('.card').forEach(card => {
        const id = card.dataset.id;
        card.querySelector('.btn-edit')?.addEventListener('click', (e) => { e.stopPropagation(); haptic.light(); editWish(id); });
        card.querySelector('.btn-delete')?.addEventListener('click', (e) => { e.stopPropagation(); haptic.medium(); deleteWish(id); });
        card.querySelector('.btn-share')?.addEventListener('click', (e) => { e.stopPropagation(); haptic.light(); showShareModal(); });
    });
}

// Модалка "Поделиться"
function showShareModal() {
    // Создаём модалку если её нет
    let modal = document.getElementById('shareInfoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shareInfoModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeShareModal()"></div>
            <div class="modal-content" style="text-align: center; padding: 32px 24px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📤</div>
                <h2 style="color: var(--text-primary); margin-bottom: 12px; font-size: 22px;">Поделиться вишлистом</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 15px; line-height: 1.5;">
                    Чтобы поделиться своим вишлистом с друзьями, перейди в <strong>Профиль</strong> и нажми «Поделиться» или «Поделиться в Stories»
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="closeShareModal()" style="
                        padding: 14px 24px;
                        background: var(--bg-tertiary);
                        border: none;
                        border-radius: 12px;
                        color: var(--text-primary);
                        font-size: 16px;
                        cursor: pointer;
                    ">Понятно</button>
                    <button onclick="closeShareModal(); location.href='profile.html'" style="
                        padding: 14px 24px;
                        background: var(--ios-green);
                        border: none;
                        border-radius: 12px;
                        color: white;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                    ">👤 В профиль</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.add('active');
}

window.closeShareModal = function() {
    const modal = document.getElementById('shareInfoModal');
    if (modal) modal.classList.remove('active');
};

function createCard(wish) {
    const img = wish.photo 
        ? `<img src="${wish.photo}" class="card-image" loading="lazy">` 
        : `<div class="card-image-placeholder">🎁</div>`;
    const price = wish.price ? `<span class="card-price">${Number(wish.price).toLocaleString('ru-RU')} ${wish.currency}</span>` : '';
    const link = wish.url ? `<a href="${wish.url}" target="_blank" style="color: #007aff; font-size: 14px; text-decoration: none; display: block; margin-bottom: 8px;">🔗 Где купить</a>` : '';
    const desc = wish.description ? `<p class="card-subtitle">${esc(wish.description)}</p>` : '';
    
    // Статус "кто-то хочет подарить"
    const reservedBadge = wish.reserved 
        ? `<div style="background: #34c759; color: white; padding: 10px 16px; border-radius: 12px; text-align: center; margin-top: 12px; font-weight: 600; font-size: 14px;">🎁 Кто-то хочет подарить!</div>`
        : '';
    
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
                ${reservedBadge}
                <div class="card-actions">
                    ${!wish.reserved ? `
                    <button class="btn btn-secondary btn-edit">✏️</button>
                    <button class="btn btn-danger btn-delete">🗑️</button>
                    ` : ''}
                    <button class="btn btn-secondary btn-share" style="flex: 1;">📤 Поделиться</button>
                </div>
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
    
    // Очищаем URL от мусора
    const rawUrl = document.getElementById('wishUrl').value.trim();
    const cleanUrl = extractUrl(rawUrl);
    
    const wishData = {
        name: document.getElementById('wishName').value.trim(),
        url: cleanUrl,
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



// Извлечение URL из текста с "мусором"
function extractUrl(text) {
    if (!text) return '';
    // Ищем URL в тексте
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = text.match(urlRegex);
    return match ? match[0] : text;
}

// Определение магазина по URL
function detectStore(url) {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('wildberries.ru')) return 'wildberries';
    if (lowerUrl.includes('ozon.ru')) return 'ozon';
    if (lowerUrl.includes('aliexpress')) return 'aliexpress';
    if (lowerUrl.includes('amazon.')) return 'amazon';
    if (lowerUrl.includes('lamoda.ru')) return 'lamoda';
    if (lowerUrl.includes('dns-shop.ru')) return 'dns';
    if (lowerUrl.includes('mvideo.ru')) return 'mvideo';
    if (lowerUrl.includes('eldorado.ru')) return 'eldorado';
    if (lowerUrl.includes('citilink.ru')) return 'citilink';
    return null;
}

// Обработчик вставки/ввода URL
function setupUrlInput() {
    const urlInput = document.getElementById('wishUrl');
    if (!urlInput) return;
    
    // При вставке - очищаем URL
    urlInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            const rawText = urlInput.value;
            const cleanUrl = extractUrl(rawText);
            if (cleanUrl !== rawText) {
                urlInput.value = cleanUrl;
                showToast('✓ Ссылка очищена');
            }
            // Пробуем получить инфо о товаре
            if (cleanUrl.startsWith('http')) {
                tryFetchProductInfo(cleanUrl);
            }
        }, 100);
    });
    
    // При потере фокуса тоже очищаем
    urlInput.addEventListener('blur', () => {
        const rawText = urlInput.value;
        const cleanUrl = extractUrl(rawText);
        if (cleanUrl !== rawText) {
            urlInput.value = cleanUrl;
        }
    });
}

// Попытка получить информацию о товаре
async function tryFetchProductInfo(url) {
    const store = detectStore(url);
    if (!store) return;
    
    const nameInput = document.getElementById('wishName');
    
    try {
        // Используем бесплатный API для получения метаданных
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
            const { title, image, description } = data.data;
            
            // Заполняем название если пустое
            if (title && !nameInput.value) {
                // Очищаем название от лишнего
                let cleanTitle = title
                    .replace(/купить.*$/i, '')
                    .replace(/- Wildberries.*$/i, '')
                    .replace(/- OZON.*$/i, '')
                    .replace(/\|.*$/, '')
                    .replace(/цена.*$/i, '')
                    .trim();
                
                if (cleanTitle.length > 100) {
                    cleanTitle = cleanTitle.substring(0, 100) + '...';
                }
                
                nameInput.value = cleanTitle;
                haptic.light();
            }
            
            // Заполняем фото если есть
            if (image?.url) {
                const preview = document.getElementById('photoPreview');
                if (!preview.classList.contains('has-image')) {
                    preview.style.backgroundImage = `url(${image.url})`;
                    preview.classList.add('has-image');
                }
            }
            
            // Описание
            const descInput = document.getElementById('wishDescription');
            if (description && !descInput.value && description.length < 200) {
                // Не заполняем автоматически, но можно раскомментировать
                // descInput.value = description;
            }
            
            showToast('✓ Данные загружены');
        }
    } catch (err) {
        console.log('Fetch product info error:', err);
    }
}

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
    const modal = document.createElement('div');
    modal.id = 'firstWishModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeFirstWishModal()"></div>
        <div class="modal-content" style="text-align: center; padding: 32px 24px;">
            <div style="font-size: 80px; margin-bottom: 16px;">🎉</div>
            <h2 style="color: #1b5e20; margin-bottom: 12px; font-size: 24px;">Первое желание есть!</h2>
            <p style="color: #8e8e93; margin-bottom: 24px; font-size: 16px;">
                Хочешь поделиться своим вишлистом в Stories?
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button onclick="closeFirstWishModal()" style="
                    padding: 14px 24px;
                    background: #e5e5ea;
                    border: none;
                    border-radius: 12px;
                    color: #000;
                    font-size: 16px;
                    cursor: pointer;
                ">Позже</button>
                <button onclick="goToStoryEditor()" style="
                    padding: 14px 24px;
                    background: #34c759;
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
