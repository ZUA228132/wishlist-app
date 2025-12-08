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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Storage bucket for images (run in Supabase Dashboard > Storage)
-- CREATE BUCKET wishlist-images WITH public = true;
