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
    wishes: JSON.parse(localStorage.getItem('wishes') || '[]'),
    userId: tg?.initDataUnsafe?.user?.id || 'demo_' + Math.random().toString(36).substr(2, 9),
    userName: tg?.initDataUnsafe?.user?.first_name || 'Пользователь',
    username: tg?.initDataUnsafe?.user?.username || 'user'
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    render();
    
    document.getElementById('addWishBtn').onclick = () => { haptic.medium(); openAddModal(); };
    document.getElementById('storyBtn').onclick = () => { haptic.medium(); openStoryModal(); };
    document.getElementById('wishForm').onsubmit = handleSubmit;
});

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

function handleSubmit(e) {
    e.preventDefault();
    haptic.success();
    
    const id = document.getElementById('wishId').value;
    const preview = document.getElementById('photoPreview');
    
    const data = {
        id: id || genId(),
        name: document.getElementById('wishName').value.trim(),
        url: document.getElementById('wishUrl').value.trim(),
        price: document.getElementById('wishPrice').value,
        currency: document.getElementById('wishCurrency').value,
        description: document.getElementById('wishDescription').value.trim(),
        photo: preview.style.backgroundImage.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1') || null,
        reserved: false,
        createdAt: id ? state.wishes.find(w => w.id === id)?.createdAt : Date.now()
    };
    
    if (id) {
        const idx = state.wishes.findIndex(w => w.id === id);
        if (idx !== -1) {
            data.reserved = state.wishes[idx].reserved;
            state.wishes[idx] = data;
        }
        showToast('✓ Обновлено');
    } else {
        state.wishes.unshift(data);
        showToast('✓ Добавлено');
        confetti();
    }
    
    save();
    render();
    window.closeAddModal();
}

function editWish(id) {
    const wish = state.wishes.find(w => w.id === id);
    if (wish) openAddModal(wish);
}

function deleteWish(id) {
    if (confirm('Удалить желание?')) {
        haptic.error();
        state.wishes = state.wishes.filter(w => w.id !== id);
        save();
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
window.openStoryModal = function() {
    if (state.wishes.length === 0) {
        showToast('Сначала добавь желание');
        return;
    }
    
    const select = document.getElementById('storyWishSelect');
    select.innerHTML = '<option value="">-- Выбери --</option>' + 
        state.wishes.filter(w => !w.reserved).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
    
    document.getElementById('storyUsername').textContent = `@${state.username}`;
    document.getElementById('storyModal').classList.add('active');
};

window.closeStoryModal = function() {
    document.getElementById('storyModal').classList.remove('active');
};

window.selectTemplate = function(el) {
    document.querySelectorAll('.story-template').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    haptic.light();
    
    const bg = el.dataset.bg;
    const preview = document.getElementById('storyPreview');
    const gradients = {
        purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        warm: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        cool: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        green: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        sunset: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    };
    preview.style.background = gradients[bg] || gradients.purple;
};

window.updateStoryPreview = function() {
    const wishId = document.getElementById('storyWishSelect').value;
    const wish = state.wishes.find(w => w.id === wishId);
    
    document.getElementById('storyWishName').textContent = wish ? wish.name : 'Выбери желание';
    document.getElementById('storyWishPrice').textContent = wish?.price ? `${Number(wish.price).toLocaleString('ru-RU')} ${wish.currency}` : '💫';
    haptic.light();
};

window.downloadStory = async function() {
    haptic.medium();
    const preview = document.getElementById('storyPreview');
    
    try {
        showToast('⏳ Создаём...');
        const canvas = await html2canvas(preview, { scale: 2, backgroundColor: null, useCORS: true });
        const link = document.createElement('a');
        link.download = 'giftly-story.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        haptic.success();
        showToast('✓ Сохранено');
    } catch (err) {
        showToast('Ошибка');
    }
};

// Utils
function save() { localStorage.setItem('wishes', JSON.stringify(state.wishes)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
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
