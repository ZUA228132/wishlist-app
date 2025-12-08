const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const haptic = {
    light: () => tg?.HapticFeedback?.impactOccurred('light'),
    medium: () => tg?.HapticFeedback?.impactOccurred('medium'),
    heavy: () => tg?.HapticFeedback?.impactOccurred('heavy'),
    success: () => tg?.HapticFeedback?.notificationOccurred('success')
};

const state = {
    groups: JSON.parse(localStorage.getItem('santaGroups') || '[]'),
    currentGroup: null,
    userId: tg?.initDataUnsafe?.user?.id?.toString() || 'demo_' + Math.random().toString(36).substr(2, 9),
    userName: tg?.initDataUnsafe?.user?.first_name || 'Пользователь'
};

const $ = id => document.getElementById(id);
const mainView = $('mainView');
const detailView = $('detailView');
const createModal = $('createModal');
const wishesModal = $('wishesModal');
const toast = $('toast');

function init() {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) joinGroup(invite);
    
    renderGroups();
    setupEvents();
}

function setupEvents() {
    $('createGroupBtn').onclick = () => { haptic.medium(); createModal.classList.add('active'); };
    $('closeCreateModal').onclick = () => createModal.classList.remove('active');
    $('cancelCreateBtn').onclick = () => createModal.classList.remove('active');
    createModal.querySelector('.modal-overlay').onclick = () => createModal.classList.remove('active');
    $('createForm').onsubmit = handleCreate;
    
    $('backBtn').onclick = () => { haptic.light(); hideDetail(); };
    $('copyInviteBtn').onclick = copyInvite;
    $('shareInviteBtn').onclick = shareInvite;
    $('shuffleBtn').onclick = shuffle;
    $('viewWishesBtn').onclick = viewTargetWishes;
    
    $('closeWishesModal').onclick = () => wishesModal.classList.remove('active');
    wishesModal.querySelector('.modal-overlay').onclick = () => wishesModal.classList.remove('active');
    $('addWishBtn').onclick = () => { haptic.light(); addWishInput(); };
    $('wishesForm').onsubmit = saveWishes;
}

function renderGroups() {
    const list = $('groupsList');
    const empty = $('emptyGroups');
    
    if (state.groups.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    list.innerHTML = state.groups.map(g => {
        const badge = g.shuffled ? 'done' : (g.participants.length >= 3 ? 'ready' : 'waiting');
        const badgeText = g.shuffled ? '✓ Готово' : (g.participants.length >= 3 ? '🎲 Готово' : '⏳ Ждём');
        
        return `
            <div class="group-card" onclick="showDetail('${g.id}')">
                <div class="group-header">
                    <span class="group-name">🎄 ${esc(g.name)}</span>
                    <span class="group-badge ${badge}">${badgeText}</span>
                </div>
                <div class="group-meta">
                    <span>👥 ${g.participants.length}</span>
                    ${g.budget ? `<span>💰 ${g.budget} ${g.currency}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function handleCreate(e) {
    e.preventDefault();
    haptic.success();
    
    const group = {
        id: genId(),
        name: $('groupNameInput').value.trim(),
        budget: $('groupBudget').value || null,
        currency: $('groupCurrency').value,
        adminId: state.userId,
        participants: [{ id: state.userId, name: state.userName, wishes: [], isAdmin: true }],
        shuffled: false,
        assignments: {},
        createdAt: Date.now()
    };
    
    state.groups.push(group);
    save();
    renderGroups();
    createModal.classList.remove('active');
    $('createForm').reset();
    
    showToast('✓ Группа создана');
    confetti();
    showDetail(group.id);
}

window.showDetail = function(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    
    haptic.light();
    state.currentGroup = group;
    
    mainView.style.display = 'none';
    detailView.style.display = 'block';
    
    $('groupName').textContent = group.name;
    $('groupStatus').textContent = group.shuffled ? '✓ Жеребьёвка проведена' : `👥 ${group.participants.length} участников`;
    
    renderParticipants(group);
    
    const base = window.location.origin + window.location.pathname;
    $('inviteLink').value = `${base}?invite=${group.id}`;
    
    $('adminSection').style.display = group.adminId === state.userId && !group.shuffled ? 'block' : 'none';
    
    const result = $('resultSection');
    if (group.shuffled && group.assignments[state.userId]) {
        const target = group.participants.find(p => p.id === group.assignments[state.userId]);
        if (target) {
            $('targetName').textContent = target.name;
            result.style.display = 'block';
        }
    } else {
        result.style.display = 'none';
    }
};

function hideDetail() {
    detailView.style.display = 'none';
    mainView.style.display = 'block';
    state.currentGroup = null;
}

function renderParticipants(group) {
    $('participantsCount').textContent = group.participants.length;
    
    $('participantsList').innerHTML = group.participants.map(p => {
        const isYou = p.id === state.userId;
        const badges = [];
        if (isYou) badges.push('<span class="participant-badge you">Ты</span>');
        if (p.isAdmin) badges.push('<span class="participant-badge admin">👑</span>');
        
        return `
            <div class="participant-item">
                <div class="participant-avatar">${getInitials(p.name)}</div>
                <div class="participant-info">
                    <div class="participant-name">${esc(p.name)}</div>
                    <div class="participant-meta">${p.wishes?.length || 0} желаний</div>
                </div>
                ${badges.join('')}
                ${isYou ? `<button class="btn btn-text" onclick="openWishesModal()">✏️</button>` : ''}
            </div>
        `;
    }).join('');
}

function joinGroup(inviteCode) {
    let group = state.groups.find(g => g.id === inviteCode);
    
    if (group && group.participants.some(p => p.id === state.userId)) {
        showToast('Ты уже в группе');
        showDetail(inviteCode);
        window.history.replaceState({}, '', window.location.pathname);
        return;
    }
    
    if (!group) {
        group = {
            id: inviteCode,
            name: 'Новогодняя группа',
            budget: 2000,
            currency: '₽',
            adminId: 'other',
            participants: [{ id: 'other', name: 'Организатор', wishes: [], isAdmin: true }],
            shuffled: false,
            assignments: {},
            createdAt: Date.now()
        };
        state.groups.push(group);
    }
    
    group.participants.push({ id: state.userId, name: state.userName, wishes: [], isAdmin: false });
    save();
    
    haptic.success();
    showToast('✓ Ты в группе!');
    confetti();
    
    window.history.replaceState({}, '', window.location.pathname);
    renderGroups();
    showDetail(group.id);
}

function copyInvite() {
    haptic.success();
    $('inviteLink').select();
    document.execCommand('copy');
    showToast('✓ Скопировано');
}

function shareInvite() {
    haptic.medium();
    const url = $('inviteLink').value;
    const text = `🎅 Присоединяйся к "${state.currentGroup.name}" в Giftly!`;
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    tg ? tg.openTelegramLink(link) : window.open(link, '_blank');
}

function shuffle() {
    const group = state.currentGroup;
    if (!group || group.participants.length < 3) {
        haptic.medium();
        showToast('Минимум 3 участника');
        return;
    }
    
    if (!confirm('Провести жеребьёвку?')) return;
    
    haptic.heavy();
    
    const participants = [...group.participants];
    let assignments = {};
    
    for (let attempt = 0; attempt < 100; attempt++) {
        const shuffled = [...participants].sort(() => Math.random() - 0.5);
        let valid = true;
        assignments = {};
        
        for (let i = 0; i < participants.length; i++) {
            if (participants[i].id === shuffled[i].id) { valid = false; break; }
            assignments[participants[i].id] = shuffled[i].id;
        }
        
        if (valid) break;
    }
    
    group.assignments = assignments;
    group.shuffled = true;
    save();
    
    showDetail(group.id);
    haptic.success();
    showToast('✓ Жеребьёвка проведена!');
    confetti();
}

function viewTargetWishes() {
    haptic.light();
    const group = state.currentGroup;
    if (!group?.assignments[state.userId]) return;
    
    const target = group.participants.find(p => p.id === group.assignments[state.userId]);
    
    if (target?.wishes?.length > 0) {
        alert(`🎁 Желания ${target.name}:\n\n${target.wishes.map((w, i) => `${i + 1}. ${w}`).join('\n')}`);
    } else {
        alert(`${target?.name || 'Участник'} не добавил желания`);
    }
}

window.openWishesModal = function() {
    haptic.light();
    const participant = state.currentGroup?.participants.find(p => p.id === state.userId);
    const wishes = participant?.wishes || [];
    
    $('wishesInputs').innerHTML = wishes.length === 0 
        ? createWishInput(0) 
        : wishes.map((w, i) => createWishInput(i, w)).join('');
    
    wishesModal.classList.add('active');
};

function createWishInput(i, value = '') {
    return `
        <div class="form-group wish-row">
            <div style="display: flex; gap: 8px;">
                <input type="text" class="form-input wish-input" placeholder="Желание ${i + 1}" value="${esc(value)}">
                <button type="button" class="btn btn-danger" onclick="this.closest('.wish-row').remove()">×</button>
            </div>
        </div>
    `;
}

function addWishInput() {
    const count = document.querySelectorAll('.wish-row').length;
    $('wishesInputs').insertAdjacentHTML('beforeend', createWishInput(count));
}

function saveWishes(e) {
    e.preventDefault();
    haptic.success();
    
    const inputs = document.querySelectorAll('.wish-input');
    const wishes = Array.from(inputs).map(i => i.value.trim()).filter(w => w);
    
    const participant = state.currentGroup?.participants.find(p => p.id === state.userId);
    if (participant) {
        participant.wishes = wishes;
        save();
        renderParticipants(state.currentGroup);
        showToast('✓ Сохранено');
    }
    
    wishesModal.classList.remove('active');
}

function confetti() {
    const colors = ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de'];
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

function save() { localStorage.setItem('santaGroups', JSON.stringify(state.groups)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function getInitials(n) { return n.split(' ').map(x => x[0]).join('').toUpperCase().substr(0, 2); }
function showToast(msg) { toast.textContent = msg; toast.classList.add('active'); setTimeout(() => toast.classList.remove('active'), 2000); }

init();
