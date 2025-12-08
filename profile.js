// Telegram WebApp initialization
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// Haptic Feedback
const haptic = {
    light: () => tg?.HapticFeedback?.impactOccurred('light'),
    medium: () => tg?.HapticFeedback?.impactOccurred('medium'),
    success: () => tg?.HapticFeedback?.notificationOccurred('success'),
    warning: () => tg?.HapticFeedback?.notificationOccurred('warning'),
    selection: () => tg?.HapticFeedback?.selectionChanged()
};

// State
const state = {
    userId: tg?.initDataUnsafe?.user?.id || 'demo_user',
    userName: tg?.initDataUnsafe?.user?.first_name || 'Пользователь',
    username: tg?.initDataUnsafe?.user?.username || 'user',
    photoUrl: tg?.initDataUnsafe?.user?.photo_url || null,
    privacy: localStorage.getItem('privacy') || 'public'
};

const toast = document.getElementById('toast');

// Initialize
function init() {
    loadProfile();
    loadStats();
    generateQR();
    setupEventListeners();
    checkAchievements();
}

function setupEventListeners() {
    // Privacy settings
    document.getElementById('menuPrivacy').addEventListener('click', () => {
        haptic.light();
        showPrivacyModal();
    });
    
    // Notifications
    document.getElementById('menuNotifications').addEventListener('click', () => {
        haptic.light();
        showNotificationsModal();
    });
    
    // Share profile
    document.getElementById('menuShare').addEventListener('click', () => {
        haptic.medium();
        shareProfile();
    });
    
    // Support
    document.getElementById('menuSupport').addEventListener('click', () => {
        haptic.light();
        if (tg) {
            tg.openTelegramLink('https://t.me/wishlist_support_bot');
        } else {
            window.open('https://t.me/wishlist_support_bot', '_blank');
        }
    });
    
    document.getElementById('downloadQR').addEventListener('click', downloadQR);
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        haptic.warning();
        if (confirm('Выйти из аккаунта? Данные будут удалены с этого устройства.')) {
            localStorage.clear();
            showToast('👋 До встречи!');
            setTimeout(() => {
                if (tg) tg.close();
                else location.reload();
            }, 1000);
        }
    });
    
    // Achievement clicks
    document.querySelectorAll('.achievement').forEach(ach => {
        ach.addEventListener('click', () => {
            haptic.selection();
            const name = ach.querySelector('.achievement-name').textContent;
            const isLocked = ach.classList.contains('locked');
            showToast(isLocked ? `🔒 ${name}` : `✅ ${name}`);
        });
    });
}

function loadProfile() {
    document.getElementById('profileName').textContent = state.userName;
    document.getElementById('profileUsername').textContent = `@${state.username}`;
    
    const avatarEl = document.getElementById('profileAvatar');
    const emojiEl = document.getElementById('avatarEmoji');
    
    if (state.photoUrl) {
        emojiEl.style.display = 'none';
        const img = document.createElement('img');
        img.src = state.photoUrl;
        img.alt = state.userName;
        avatarEl.appendChild(img);
    } else {
        const emojis = ['🎅', '🤶', '⛄', '🦌', '🎄', '🎁', '❄️', '🌟'];
        emojiEl.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    }
}

function loadStats() {
    const wishes = JSON.parse(localStorage.getItem('wishes') || '[]');
    const groups = JSON.parse(localStorage.getItem('santaGroups') || '[]');
    const gifted = wishes.filter(w => w.reserved).length;
    
    animateValue('wishesCount', 0, wishes.length, 600);
    animateValue('giftedCount', 0, gifted, 600);
    animateValue('santaCount', 0, groups.length, 600);
}

function animateValue(id, start, end, duration) {
    const el = document.getElementById(id);
    if (!el || start === end) { el.textContent = end; return; }
    
    const startTime = performance.now();
    const range = end - start;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + range * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    
    requestAnimationFrame(update);
}

function checkAchievements() {
    const wishes = JSON.parse(localStorage.getItem('wishes') || '[]');
    const groups = JSON.parse(localStorage.getItem('santaGroups') || '[]');
    const gifted = wishes.filter(w => w.reserved).length;
    
    if (wishes.length > 0) document.getElementById('ach1').classList.remove('locked');
    if (groups.length > 0) document.getElementById('ach2').classList.remove('locked');
    if (gifted > 0) document.getElementById('ach3').classList.remove('locked');
    if (wishes.length >= 10) document.getElementById('ach4').classList.remove('locked');
    
    const createdGroups = groups.filter(g => g.adminId === state.userId);
    if (createdGroups.length > 0) document.getElementById('ach5').classList.remove('locked');
}

function generateQR() {
    const qrContainer = document.getElementById('qrCode');
    let shareUrl = `${window.location.origin}${window.location.pathname.replace('profile.html', '')}shared.html?user=${state.userId}`;
    shareUrl += `&name=${encodeURIComponent(state.userName)}`;
    if (state.photoUrl) {
        shareUrl += `&photo=${encodeURIComponent(state.photoUrl)}`;
    }
    
    if (typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        QRCode.toCanvas(shareUrl, {
            width: 160,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        }, (err, canvas) => {
            if (!err) {
                canvas.style.borderRadius = '12px';
                qrContainer.appendChild(canvas);
            }
        });
    }
}

function downloadQR() {
    haptic.success();
    const canvas = document.querySelector('#qrCode canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = 'wishlist-qr.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('📥 QR-код сохранён!');
    }
}

function shareProfile() {
    // Формируем URL с именем и фото владельца
    let shareUrl = `${window.location.origin}${window.location.pathname.replace('profile.html', '')}shared.html?user=${state.userId}`;
    shareUrl += `&name=${encodeURIComponent(state.userName)}`;
    if (state.photoUrl) {
        shareUrl += `&photo=${encodeURIComponent(state.photoUrl)}`;
    }
    
    // Показываем выбор: сторис или обычный шеринг
    showShareOptions(shareUrl);
}

function showShareOptions(shareUrl) {
    const html = `
        <div class="menu-item" data-action="story">
            <div class="menu-icon purple">📸</div>
            <div class="menu-content">
                <div class="menu-title">Поделиться в сторис</div>
                <div class="menu-desc">Красивая картинка + кнопка</div>
            </div>
        </div>
        <div class="menu-item" data-action="message">
            <div class="menu-icon blue">💬</div>
            <div class="menu-content">
                <div class="menu-title">Отправить сообщением</div>
                <div class="menu-desc">Ссылка в чат</div>
            </div>
        </div>
        <div class="menu-item" data-action="copy">
            <div class="menu-icon gold">📋</div>
            <div class="menu-content">
                <div class="menu-title">Скопировать ссылку</div>
                <div class="menu-desc">В буфер обмена</div>
            </div>
        </div>
    `;
    
    showActionSheet('Поделиться вишлистом', html, (el) => {
        const action = el.dataset.action;
        if (action === 'story') {
            shareToStory(shareUrl);
        } else if (action === 'message') {
            shareToMessage(shareUrl);
        } else if (action === 'copy') {
            navigator.clipboard.writeText(shareUrl);
            haptic.success();
            showToast('📋 Ссылка скопирована!');
        }
    });
}

function shareToStory(shareUrl) {
    // Используем готовую картинку story-image.png
    const storyImageUrl = `${window.location.origin}${window.location.pathname.replace('profile.html', '')}story-image.png`;
    
    if (tg && tg.shareToStory) {
        haptic.success();
        tg.shareToStory(storyImageUrl, {
            text: '🎁 Мой вишлист',
            widget_link: {
                url: shareUrl,
                name: 'Открыть вишлист'
            }
        });
    } else {
        // Fallback если shareToStory недоступен
        showToast('📸 Сторис доступны только в Telegram');
        shareToMessage(shareUrl);
    }
}

function shareToMessage(shareUrl) {
    const text = `🎁 Мой новогодний вишлист!\n\nВыбери что хочешь мне подарить 🎄`;
    
    if (tg) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
        navigator.share({ title: 'Мой вишлист', text, url: shareUrl });
    } else {
        navigator.clipboard.writeText(shareUrl);
        showToast('📋 Ссылка скопирована!');
    }
}

// Privacy Modal
function showPrivacyModal() {
    const options = [
        { value: 'public', icon: '🌍', title: 'Публичный', desc: 'Любой может открыть' },
        { value: 'friends', icon: '👥', title: 'Только друзья', desc: 'Пользователи Telegram' },
        { value: 'private', icon: '🔐', title: 'Приватный', desc: 'Только по ссылке' }
    ];
    
    const current = state.privacy;
    const html = options.map(opt => `
        <div class="menu-item privacy-choice ${opt.value === current ? 'selected' : ''}" data-value="${opt.value}">
            <div class="menu-icon blue">${opt.icon}</div>
            <div class="menu-content">
                <div class="menu-title">${opt.title}</div>
                <div class="menu-desc">${opt.desc}</div>
            </div>
            ${opt.value === current ? '<span style="color: var(--accent);">✓</span>' : ''}
        </div>
    `).join('');
    
    showActionSheet('Приватность вишлиста', html, (el) => {
        const value = el.dataset.value;
        if (value) {
            haptic.success();
            state.privacy = value;
            localStorage.setItem('privacy', value);
            showToast('✅ Настройки сохранены');
        }
    });
}

// Notifications Modal
function showNotificationsModal() {
    const notifications = localStorage.getItem('notifications') !== 'false';
    
    const html = `
        <div class="menu-item" data-action="toggle">
            <div class="menu-icon gold">🔔</div>
            <div class="menu-content">
                <div class="menu-title">Уведомления</div>
                <div class="menu-desc">${notifications ? 'Включены' : 'Выключены'}</div>
            </div>
            <div style="width: 50px; height: 30px; background: ${notifications ? 'var(--accent-green)' : 'var(--bg-tertiary)'}; border-radius: 15px; position: relative; transition: background 0.2s;">
                <div style="width: 26px; height: 26px; background: white; border-radius: 50%; position: absolute; top: 2px; ${notifications ? 'right: 2px' : 'left: 2px'}; transition: all 0.2s;"></div>
            </div>
        </div>
        <div class="menu-item" data-action="test">
            <div class="menu-icon purple">📲</div>
            <div class="menu-content">
                <div class="menu-title">Тестовое уведомление</div>
                <div class="menu-desc">Проверить работу</div>
            </div>
        </div>
    `;
    
    showActionSheet('Уведомления', html, (el) => {
        const action = el.dataset.action;
        if (action === 'toggle') {
            haptic.selection();
            const newState = localStorage.getItem('notifications') === 'false';
            localStorage.setItem('notifications', newState);
            showToast(newState ? '🔔 Уведомления включены' : '🔕 Уведомления выключены');
            showNotificationsModal();
        } else if (action === 'test') {
            haptic.success();
            showToast('🎉 Уведомления работают!');
        }
    });
}

// Action Sheet (iOS style)
function showActionSheet(title, content, onClick) {
    const existing = document.querySelector('.action-sheet-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'action-sheet-overlay';
    overlay.innerHTML = `
        <div class="action-sheet">
            <div class="action-sheet-header">${title}</div>
            <div class="action-sheet-content">${content}</div>
            <button class="action-sheet-cancel">Отмена</button>
        </div>
    `;
    
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 5000;
        display: flex; align-items: flex-end; justify-content: center;
    `;
    
    const sheet = overlay.querySelector('.action-sheet');
    sheet.style.cssText = `
        background: #1c1c1e; width: 100%; max-width: 430px;
        border-radius: 20px 20px 0 0; padding: 20px; padding-bottom: 40px;
    `;
    
    overlay.querySelector('.action-sheet-header').style.cssText = `
        font-size: 17px; font-weight: 600; text-align: center; margin-bottom: 16px; color: white;
    `;
    
    overlay.querySelector('.action-sheet-cancel').style.cssText = `
        width: 100%; padding: 16px; background: #2c2c2e; border: none;
        border-radius: 12px; color: #0a84ff; font-size: 17px; font-weight: 600;
        margin-top: 12px; cursor: pointer;
    `;
    
    // Style menu items in action sheet
    const menuItems = overlay.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.style.cssText = `
            background: #2c2c2e; border-radius: 12px; padding: 14px 16px;
            margin-bottom: 8px; display: flex; align-items: center; gap: 14px;
            cursor: pointer; color: white;
        `;
    });
    
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            haptic.light();
            overlay.remove();
        }
    };
    
    // Close on cancel
    overlay.querySelector('.action-sheet-cancel').onclick = () => {
        haptic.light();
        overlay.remove();
    };
    
    // Handle menu item clicks
    menuItems.forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            if (onClick) onClick(item);
            overlay.remove();
        };
    });
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 2500);
}

init();
