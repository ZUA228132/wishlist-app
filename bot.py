"""
Giftly - Telegram Bot
Вишлист и Тайный Санта

Требования: pip install python-telegram-bot
Запуск: python bot.py
"""

import os
import json
import logging
from telegram import Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, MenuButtonWebApp
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Конфигурация
BOT_TOKEN = os.getenv('BOT_TOKEN', '8464473630:AAECaHY01t2lwqlKk33RlfdZrKPAJwWz_NU')
WEBAPP_URL = os.getenv('WEBAPP_URL', 'https://wishlist-app-vert.vercel.app')

# Простое хранилище данных (в продакшене используйте базу данных)
DATA_FILE = 'data.json'

def load_data():
    """Загрузка данных из файла"""
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'users': {}, 'groups': {}}

def save_data(data):
    """Сохранение данных в файл"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Команды бота
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start"""
    user = update.effective_user
    
    # Сохраняем пользователя в базу
    db = load_data()
    user_id = str(user.id)
    if user_id not in db['users']:
        db['users'][user_id] = {
            'name': user.first_name,
            'username': user.username,
            'wishes': [],
            'joined': str(update.message.date)
        }
        save_data(db)
    
    # Проверяем параметры (для deep linking)
    args = context.args
    
    # Обработка реферальной ссылки
    if args and args[0].startswith('ref_'):
        referrer_id = args[0].replace('ref_', '')
        if referrer_id != user_id:
            # Сохраняем реферала
            if 'referrals' not in db:
                db['referrals'] = {}
            if user_id not in db['referrals']:
                db['referrals'][user_id] = {
                    'referrer': referrer_id,
                    'rewarded': False
                }
                save_data(db)
                logger.info(f"New referral: {user_id} from {referrer_id}")
    
    # Создаём клавиатуру с WebApp кнопками
    keyboard = [
        [InlineKeyboardButton(
            "🎁 Мой вишлист",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/index.html")
        )],
        [InlineKeyboardButton(
            "🎟️ Билетики",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/tasks.html")
        )],
        [InlineKeyboardButton(
            "🎅 Тайный Санта",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/santa.html")
        )],
    ]
    
    # Если есть параметр приглашения в группу
    if args and args[0].startswith('santa_'):
        group_id = args[0].replace('santa_', '')
        keyboard.append([InlineKeyboardButton(
            "🎄 Присоединиться к группе",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/santa.html?invite={group_id}")
        )])
    
    # Если есть параметр просмотра вишлиста
    if args and args[0].startswith('wishlist_'):
        target_user_id = args[0].replace('wishlist_', '')
        keyboard.append([InlineKeyboardButton(
            "👀 Посмотреть вишлист",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/shared.html?user={target_user_id}")
        )])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    welcome_text = f"""
🐻‍❄️ Привет, {user.first_name}!

Добро пожаловать в Giftly!

Здесь ты можешь:
• 🎁 Создавать вишлист
• 🔗 Делиться с друзьями
• 🎅 Играть в Тайного Санту

Нажми кнопку чтобы начать!
"""
    
    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /help"""
    help_text = """
📖 Как пользоваться WishList Bot:

🎁 Мой вишлист
• Добавляй желания с фото, ценой и ссылкой
• Настраивай приватность
• Делись ссылкой с друзьями

🎅 Тайный Санта
• Создай группу для обмена подарками
• Пригласи друзей по ссылке
• Проведи жеребьёвку
• Узнай кому дарить подарок

📌 Команды:
/start - Главное меню
/wishlist - Открыть вишлист
/santa - Тайный Санта
/share - Поделиться вишлистом
/help - Эта справка
"""
    await update.message.reply_text(help_text)

async def wishlist_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Открыть вишлист"""
    keyboard = [[InlineKeyboardButton(
        "🎁 Открыть вишлист",
        web_app=WebAppInfo(url=f"{WEBAPP_URL}/index.html")
    )]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "Нажми кнопку, чтобы открыть свой вишлист:",
        reply_markup=reply_markup
    )

async def santa_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Открыть Тайного Санту"""
    keyboard = [[InlineKeyboardButton(
        "🎅 Тайный Санта",
        web_app=WebAppInfo(url=f"{WEBAPP_URL}/santa.html")
    )]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎄 Создай группу или присоединись к существующей!",
        reply_markup=reply_markup
    )

async def share_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Поделиться вишлистом"""
    user = update.effective_user
    share_url = f"https://t.me/{context.bot.username}?start=wishlist_{user.id}"
    
    text = f"""
🔗 Твоя ссылка на вишлист:

{share_url}

Отправь эту ссылку друзьям, чтобы они могли посмотреть твои желания и выбрать что подарить!
"""
    
    keyboard = [[InlineKeyboardButton(
        "📤 Переслать",
        switch_inline_query=f"Посмотри мой вишлист! {share_url}"
    )]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(text, reply_markup=reply_markup)

# Админские команды
ADMIN_ID = 7086128174

async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Админ-панель в боте"""
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("❌ Нет доступа")
        return
    
    db = load_data()
    users = db.get('users', {})
    groups = db.get('groups', {})
    total_wishes = sum(len(u.get('wishes', [])) for u in users.values())
    
    keyboard = [
        [InlineKeyboardButton("📢 Рассылка", callback_data="admin_broadcast")],
        [InlineKeyboardButton("👥 Пользователи", callback_data="admin_users")],
        [InlineKeyboardButton("📊 Подробная статистика", callback_data="admin_stats")],
        [InlineKeyboardButton("🌐 Открыть админку", web_app=WebAppInfo(url=f"{WEBAPP_URL}/admin.html"))]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"⚙️ Админ-панель Giftly\n\n"
        f"👥 Пользователей: {len(users)}\n"
        f"🎁 Желаний: {total_wishes}\n"
        f"🎅 Групп Санты: {len(groups)}\n\n"
        f"📢 Рассылка: /broadcast текст\n"
        f"📷 С фото: ответь на фото командой",
        reply_markup=reply_markup
    )

async def broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Рассылка сообщения всем пользователям"""
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("❌ Нет доступа")
        return
    
    if not context.args:
        await update.message.reply_text(
            "📢 Использование:\n"
            "/broadcast Текст сообщения\n\n"
            "Или ответьте на фото с командой /broadcast для рассылки с фото"
        )
        return
    
    message_text = ' '.join(context.args)
    db = load_data()
    users = db.get('users', {})
    
    if not users:
        await update.message.reply_text("❌ Нет пользователей для рассылки")
        return
    
    sent = 0
    failed = 0
    blocked = 0
    
    # Проверяем есть ли фото в ответе
    photo = None
    if update.message.reply_to_message and update.message.reply_to_message.photo:
        photo = update.message.reply_to_message.photo[-1].file_id
    
    status_msg = await update.message.reply_text(f"⏳ Начинаю рассылку {len(users)} пользователям...")
    
    for user_id in users.keys():
        try:
            if photo:
                await context.bot.send_photo(
                    chat_id=int(user_id),
                    photo=photo,
                    caption=message_text,
                    parse_mode='HTML'
                )
            else:
                await context.bot.send_message(
                    chat_id=int(user_id),
                    text=message_text,
                    parse_mode='HTML'
                )
            sent += 1
            
            # Обновляем статус каждые 10 сообщений
            if sent % 10 == 0:
                try:
                    await status_msg.edit_text(f"⏳ Отправлено: {sent}/{len(users)}...")
                except:
                    pass
                    
        except Exception as e:
            error_str = str(e).lower()
            if 'blocked' in error_str or 'deactivated' in error_str:
                blocked += 1
            else:
                failed += 1
            logger.error(f"Failed to send to {user_id}: {e}")
    
    await status_msg.edit_text(
        f"✅ Рассылка завершена!\n\n"
        f"📨 Отправлено: {sent}\n"
        f"🚫 Заблокировали: {blocked}\n"
        f"❌ Ошибок: {failed}"
    )

async def admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопок админ-панели"""
    query = update.callback_query
    user = query.from_user
    
    if user.id != ADMIN_ID:
        await query.answer("❌ Нет доступа", show_alert=True)
        return
    
    await query.answer()
    data = query.data
    db = load_data()
    
    if data == "admin_broadcast":
        await query.edit_message_text(
            "📢 Рассылка\n\n"
            "Используйте команду:\n"
            "/broadcast Текст сообщения\n\n"
            "Для рассылки с фото - ответьте на фото командой /broadcast"
        )
    
    elif data == "admin_users":
        users = db.get('users', {})
        if not users:
            await query.edit_message_text("👥 Пользователей пока нет")
            return
        
        text = "👥 Пользователи:\n\n"
        for uid, udata in list(users.items())[:20]:  # Первые 20
            name = udata.get('name', 'Без имени')
            wishes = len(udata.get('wishes', []))
            text += f"• {name} (ID: {uid}) - {wishes} желаний\n"
        
        if len(users) > 20:
            text += f"\n... и ещё {len(users) - 20}"
        
        await query.edit_message_text(text)
    
    elif data == "admin_stats":
        users = db.get('users', {})
        groups = db.get('groups', {})
        total_wishes = sum(len(u.get('wishes', [])) for u in users.values())
        
        await query.edit_message_text(
            f"📊 Статистика\n\n"
            f"👥 Пользователей: {len(users)}\n"
            f"🎁 Всего желаний: {total_wishes}\n"
            f"🎅 Групп Санты: {len(groups)}"
        )

async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка данных из WebApp"""
    data = json.loads(update.effective_message.web_app_data.data)
    user_id = str(update.effective_user.id)
    
    # Загружаем данные
    db = load_data()
    
    action = data.get('action')
    
    if action == 'broadcast':
        # Рассылка сообщений (только для админа)
        if user_id != '7086128174':
            await update.message.reply_text("❌ Нет прав для рассылки")
            return
        
        message = data.get('message', '')
        photo = data.get('photo')  # base64 encoded image
        recipients = data.get('recipients', [])
        
        sent_count = 0
        for recipient_id in recipients:
            try:
                if photo:
                    # Декодируем base64 фото
                    import base64
                    photo_data = photo.split(',')[1] if ',' in photo else photo
                    photo_bytes = base64.b64decode(photo_data)
                    await context.bot.send_photo(
                        chat_id=int(recipient_id),
                        photo=photo_bytes,
                        caption=message
                    )
                else:
                    await context.bot.send_message(
                        chat_id=int(recipient_id),
                        text=message
                    )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send to {recipient_id}: {e}")
        
        await update.message.reply_text(f"✅ Рассылка отправлена: {sent_count} получателей")
        return
    
    if action == 'save_wishes':
        # Сохранение вишлиста
        db['users'][user_id] = {
            'wishes': data.get('wishes', []),
            'privacy': data.get('privacy', 'public'),
            'name': update.effective_user.first_name
        }
        save_data(db)
        await update.message.reply_text("✅ Вишлист сохранён!")
    
    elif action == 'reserve_wish':
        # Резервирование подарка
        owner_id = data.get('owner_id')
        wish_id = data.get('wish_id')
        
        if owner_id in db['users']:
            for wish in db['users'][owner_id].get('wishes', []):
                if wish.get('id') == wish_id:
                    wish['reserved'] = True
                    wish['reserved_by'] = user_id
                    save_data(db)
                    await update.message.reply_text("🎁 Отлично! Ты зарезервировал(а) этот подарок!")
                    break
    
    elif action == 'create_santa_group':
        # Создание группы Тайного Санты
        group_id = data.get('group_id')
        db['groups'][group_id] = {
            'name': data.get('name'),
            'admin_id': user_id,
            'participants': [user_id],
            'budget': data.get('budget'),
            'date': data.get('date'),
            'shuffled': False,
            'assignments': {}
        }
        save_data(db)
        
        invite_link = f"https://t.me/{context.bot.username}?start=santa_{group_id}"
        await update.message.reply_text(
            f"🎄 Группа создана!\n\nСсылка для приглашения:\n{invite_link}"
        )
    
    elif action == 'shuffle_santa':
        # Жеребьёвка
        group_id = data.get('group_id')
        assignments = data.get('assignments', {})
        
        if group_id in db['groups']:
            db['groups'][group_id]['shuffled'] = True
            db['groups'][group_id]['assignments'] = assignments
            save_data(db)
            
            # Отправляем уведомления участникам
            group = db['groups'][group_id]
            for giver_id, receiver_id in assignments.items():
                try:
                    receiver_name = "участник"
                    for uid in db['users']:
                        if uid == receiver_id:
                            receiver_name = db['users'][uid].get('name', 'участник')
                            break
                    
                    await context.bot.send_message(
                        chat_id=int(giver_id),
                        text=f"🎅 Жеребьёвка в группе \"{group['name']}\" проведена!\n\n"
                             f"Ты даришь подарок: {receiver_name}\n\n"
                             f"Открой приложение, чтобы посмотреть желания!"
                    )
                except Exception as e:
                    logger.error(f"Failed to notify user {giver_id}: {e}")
            
            await update.message.reply_text("🎉 Жеребьёвка проведена! Все участники получили уведомления.")
    
    elif action == 'send_story_image':
        # Отправка картинки для Stories пользователю
        import base64
        import io
        
        image_data = data.get('image', '')
        
        if image_data:
            try:
                # Убираем префикс data:image/png;base64,
                if ',' in image_data:
                    image_data = image_data.split(',')[1]
                
                # Декодируем base64
                image_bytes = base64.b64decode(image_data)
                
                # Отправляем фото пользователю
                await context.bot.send_photo(
                    chat_id=int(user_id),
                    photo=io.BytesIO(image_bytes),
                    caption="📸 Твоя картинка для Stories!\n\n"
                            "Сохрани её и добавь в Telegram Stories 🎄"
                )
                await update.message.reply_text("✅ Картинка отправлена в чат!")
            except Exception as e:
                logger.error(f"Failed to send story image: {e}")
                await update.message.reply_text(f"❌ Ошибка: {str(e)}")

async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка inline запросов для шаринга"""
    from telegram import InlineQueryResultArticle, InputTextMessageContent
    
    query = update.inline_query.query
    user = update.effective_user
    
    results = [
        InlineQueryResultArticle(
            id='share_wishlist',
            title='🎁 Поделиться вишлистом',
            description='Отправить ссылку на твой вишлист',
            input_message_content=InputTextMessageContent(
                message_text=f"🎁 Посмотри мой вишлист!\n\n"
                            f"https://t.me/{context.bot.username}?start=wishlist_{user.id}"
            )
        )
    ]
    
    await update.inline_query.answer(results)

async def check_subscription(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Проверка подписки на канал"""
    user = update.effective_user
    
    if not context.args:
        await update.message.reply_text("Использование: /check @channel_username")
        return
    
    channel = context.args[0]
    
    try:
        member = await context.bot.get_chat_member(chat_id=channel, user_id=user.id)
        status = member.status
        
        if status in ['member', 'administrator', 'creator']:
            await update.message.reply_text(f"✅ Ты подписан на {channel}!")
        else:
            await update.message.reply_text(f"❌ Ты не подписан на {channel}")
    except Exception as e:
        logger.error(f"Check subscription error: {e}")
        await update.message.reply_text(f"❌ Ошибка проверки: {e}")

async def tickets_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать билетики пользователя"""
    keyboard = [[InlineKeyboardButton(
        "🎟️ Мои билетики",
        web_app=WebAppInfo(url=f"{WEBAPP_URL}/tasks.html")
    )]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎟️ Выполняй задания и получай билетики для розыгрыша!\n\n"
        "Каждый билетик = 1 шанс выиграть NFT подарок 🎁",
        reply_markup=reply_markup
    )

def main():
    """Запуск бота"""
    if BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
        print("❌ Ошибка: Установите BOT_TOKEN!")
        print("   Получите токен у @BotFather в Telegram")
        print("   Затем установите переменную окружения:")
        print("   export BOT_TOKEN='your_token_here'")
        return
    
    # Создаём приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Регистрируем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("wishlist", wishlist_command))
    application.add_handler(CommandHandler("santa", santa_command))
    application.add_handler(CommandHandler("share", share_command))
    application.add_handler(CommandHandler("tickets", tickets_command))
    application.add_handler(CommandHandler("check", check_subscription))
    
    # Админские команды
    application.add_handler(CommandHandler("admin", admin_command))
    application.add_handler(CommandHandler("broadcast", broadcast_command))
    application.add_handler(CallbackQueryHandler(admin_callback, pattern="^admin_"))
    
    # Обработчик данных из WebApp
    application.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data))
    
    # Inline режим
    from telegram.ext import InlineQueryHandler
    application.add_handler(InlineQueryHandler(inline_query))
    
    print("🚀 Бот запущен!")
    print(f"📱 WebApp URL: {WEBAPP_URL}")
    
    # Запускаем бота
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
