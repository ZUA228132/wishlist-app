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
    
    # Проверяем параметры (для deep linking)
    args = context.args
    
    # Создаём клавиатуру с WebApp кнопками
    keyboard = [
        [InlineKeyboardButton(
            "🎁 Мой вишлист",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/index.html")
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
        user_id = args[0].replace('wishlist_', '')
        keyboard.append([InlineKeyboardButton(
            "👀 Посмотреть вишлист",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/shared.html?user={user_id}")
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

async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка данных из WebApp"""
    data = json.loads(update.effective_message.web_app_data.data)
    user_id = str(update.effective_user.id)
    
    # Загружаем данные
    db = load_data()
    
    action = data.get('action')
    
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
