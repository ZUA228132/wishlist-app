// Проверка блокировки пользователя - подключать на всех страницах
async function checkUserBlockedGlobal() {
    const tg = window.Telegram?.WebApp;
    const telegramId = tg?.initDataUnsafe?.user?.id?.toString();
    const sb = window.supabaseClient;
    
    if (!sb || !telegramId) return false;
    
    try {
        const { data: user } = await sb
            .from('users')
            .select('is_blocked, blocked_reason, blocked_until')
            .eq('telegram_id', parseInt(telegramId))
            .single();
        
        if (user && user.is_blocked) {
            // Проверяем срок блокировки
            if (user.blocked_until) {
                const until = new Date(user.blocked_until);
                if (until < new Date()) {
                    // Срок истёк - разблокируем
                    await sb
                        .from('users')
                        .update({ is_blocked: false, blocked_reason: null, blocked_until: null })
                        .eq('telegram_id', parseInt(telegramId));
                    return false;
                }
            }
            
            // Показываем экран блокировки
            showBlockedScreenGlobal(user.blocked_reason, user.blocked_until);
            return true;
        }
    } catch (err) {
        console.error('Check blocked error:', err);
    }
    
    return false;
}

function showBlockedScreenGlobal(reason, until) {
    const untilText = until ? `до ${new Date(until).toLocaleDateString('ru-RU')}` : 'навсегда';
    
    document.body.innerHTML = `
        <div class="ambient-bg">
            <div class="ambient-orb" style="background: #ffcdd2;"></div>
            <div class="ambient-orb" style="background: #ef9a9a;"></div>
            <div class="ambient-orb" style="background: #e57373;"></div>
        </div>
        <div style="
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            z-index: 9999;
        ">
            <div style="
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(30px) saturate(180%);
                -webkit-backdrop-filter: blur(30px) saturate(180%);
                border-radius: 32px;
                padding: 40px 32px;
                text-align: center;
                max-width: 360px;
                border: 1px solid rgba(255, 255, 255, 0.8);
                box-shadow: 
                    0 24px 80px rgba(255, 69, 58, 0.2),
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.9);
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #ff453a 0%, #ff6961 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 36px;
                    box-shadow: 0 8px 24px rgba(255, 69, 58, 0.4);
                ">🚫</div>
                
                <h1 style="
                    font-size: 24px;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin-bottom: 8px;
                ">Аккаунт заблокирован</h1>
                
                <p style="
                    font-size: 15px;
                    color: #666;
                    margin-bottom: 20px;
                    line-height: 1.5;
                ">
                    ${reason ? `Причина: ${reason}` : 'Ваш аккаунт был заблокирован администратором'}
                </p>
                
                <div style="
                    background: rgba(255, 69, 58, 0.1);
                    border-radius: 12px;
                    padding: 12px 16px;
                    margin-bottom: 24px;
                ">
                    <span style="color: #ff453a; font-weight: 600;">⏱️ Блокировка: ${untilText}</span>
                </div>
                
                <a href="https://t.me/pravy_ru" style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 14px 28px;
                    background: linear-gradient(135deg, #007aff 0%, #5ac8fa 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 14px;
                    font-size: 16px;
                    font-weight: 600;
                    box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
                ">💬 Связаться с поддержкой</a>
            </div>
        </div>
    `;
}
