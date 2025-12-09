-- Supabase Schema for WishList App
-- Выполни этот SQL в Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    photo_url TEXT,
    privacy VARCHAR(20) DEFAULT 'public',
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Если таблица уже существует, добавь колонку:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Wishes table
CREATE TABLE wishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2),
    currency VARCHAR(10) DEFAULT '₽',
    url TEXT,
    photo_url TEXT,
    reserved BOOLEAN DEFAULT FALSE,
    reserved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Santa Groups table
CREATE TABLE santa_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
    budget DECIMAL(12, 2),
    currency VARCHAR(10) DEFAULT '₽',
    event_date DATE,
    shuffled BOOLEAN DEFAULT FALSE,
    assignments JSONB DEFAULT '{}',
    invite_code VARCHAR(20) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Santa Participants table
CREATE TABLE santa_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES santa_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wishes JSONB DEFAULT '[]',
    assigned_to UUID REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Indexes for better performance
CREATE INDEX idx_wishes_user_id ON wishes(user_id);
CREATE INDEX idx_wishes_reserved ON wishes(reserved);
CREATE INDEX idx_santa_participants_group ON santa_participants(group_id);
CREATE INDEX idx_santa_participants_user ON santa_participants(user_id);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_santa_groups_invite_code ON santa_groups(invite_code);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE santa_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE santa_participants ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (true);
CREATE POLICY "Anyone can create user" ON users FOR INSERT WITH CHECK (true);

-- Policies for wishes
CREATE POLICY "Anyone can view public wishes" ON wishes FOR SELECT USING (true);
CREATE POLICY "Users can manage own wishes" ON wishes FOR ALL USING (true);

-- Policies for santa_groups
CREATE POLICY "Anyone can view groups" ON santa_groups FOR SELECT USING (true);
CREATE POLICY "Anyone can create groups" ON santa_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update group" ON santa_groups FOR UPDATE USING (true);

-- Policies for santa_participants
CREATE POLICY "Anyone can view participants" ON santa_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join groups" ON santa_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can update own data" ON santa_participants FOR UPDATE USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wishes_updated_at BEFORE UPDATE ON wishes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.invite_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_santa_group_invite_code BEFORE INSERT ON santa_groups
    FOR EACH ROW EXECUTE FUNCTION generate_invite_code();

-- Verify Requests table (для заявок на верификацию)
CREATE TABLE verify_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT NOT NULL,
    user_name VARCHAR(255),
    username VARCHAR(255),
    photo_url TEXT,
    reason TEXT NOT NULL,
    socials TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_verify_requests_status ON verify_requests(status);
CREATE INDEX idx_verify_requests_telegram_id ON verify_requests(telegram_id);

ALTER TABLE verify_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view verify requests" ON verify_requests FOR SELECT USING (true);
CREATE POLICY "Anyone can create verify request" ON verify_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update verify request" ON verify_requests FOR UPDATE USING (true);

-- Storage bucket for images (run in Supabase Dashboard > Storage)
-- CREATE BUCKET wishlist-images WITH public = true;


-- ===== TICKETS SYSTEM =====

-- Добавляем поле tickets в users
ALTER TABLE users ADD COLUMN IF NOT EXISTS tickets INTEGER DEFAULT 0;

-- Задания за билетики (создаются через админку)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- subscribe, join_chat, open_app, daily, referral, action
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(10) DEFAULT '📋',
    link TEXT, -- ссылка на канал/чат/приложение
    reward INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(active);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tasks" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tasks" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tasks" ON tasks FOR DELETE USING (true);

-- Выполненные задания
CREATE TABLE IF NOT EXISTS completed_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(100) NOT NULL,
    reward INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

-- Билетики пользователей (для розыгрыша)
CREATE TABLE IF NOT EXISTS user_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(100), -- откуда получен билет (task_id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_in_raffle UUID -- ID розыгрыша если использован
);

-- Розыгрыши
CREATE TABLE IF NOT EXISTS raffles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prize_type VARCHAR(50) DEFAULT 'nft', -- nft, gift, etc
    prize_value TEXT, -- описание приза
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    winner_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Рефералы
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rewarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referred_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_completed_tasks_user ON completed_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tickets_user ON user_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- RLS
ALTER TABLE completed_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view completed_tasks" ON completed_tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert completed_tasks" ON completed_tasks FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view user_tickets" ON user_tickets FOR SELECT USING (true);
CREATE POLICY "Anyone can insert user_tickets" ON user_tickets FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view raffles" ON raffles FOR SELECT USING (true);

CREATE POLICY "Anyone can view referrals" ON referrals FOR SELECT USING (true);
CREATE POLICY "Anyone can insert referrals" ON referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update referrals" ON referrals FOR UPDATE USING (true);