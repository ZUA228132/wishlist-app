// Bot Configuration
// Замени на username своего бота (без @)
const BOT_USERNAME = 'giftl_robot';

// Supabase Configuration
// Замени на свои данные из Supabase Dashboard
const SUPABASE_URL = 'https://vmyzknraixtqvsceaujd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXprbnJhaXh0cXZzY2VhdWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxODU0NzAsImV4cCI6MjA4MDc2MTQ3MH0.ame1hcZVX__x3WqREK18LJiAM9CuuQdS8FnbKIWMH1c';

// Initialize Supabase Client
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database API
const db = {
    // Users
    async getUser(telegramId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', telegramId)
            .single();
        return { data, error };
    },

    async createUser(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
        return { data, error };
    },

    async updateUser(telegramId, updates) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('telegram_id', telegramId)
            .select()
            .single();
        return { data, error };
    },

    // Wishes
    async getWishes(userId) {
        const { data, error } = await supabase
            .from('wishes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async getWishesByTelegramId(telegramId) {
        const { data, error } = await supabase
            .from('wishes')
            .select('*, users!inner(telegram_id)')
            .eq('users.telegram_id', telegramId)
            .order('created_at', { ascending: false });
        return { data, error };
    },

    async createWish(wishData) {
        const { data, error } = await supabase
            .from('wishes')
            .insert([wishData])
            .select()
            .single();
        return { data, error };
    },

    async updateWish(wishId, updates) {
        const { data, error } = await supabase
            .from('wishes')
            .update(updates)
            .eq('id', wishId)
            .select()
            .single();
        return { data, error };
    },

    async deleteWish(wishId) {
        const { error } = await supabase
            .from('wishes')
            .delete()
            .eq('id', wishId);
        return { error };
    },

    async reserveWish(wishId, reservedBy) {
        const { data, error } = await supabase
            .from('wishes')
            .update({ reserved: true, reserved_by: reservedBy })
            .eq('id', wishId)
            .select()
            .single();
        return { data, error };
    },

    // Santa Groups
    async getGroups(userId) {
        const { data, error } = await supabase
            .from('santa_participants')
            .select('santa_groups(*)')
            .eq('user_id', userId);
        return { data: data?.map(p => p.santa_groups), error };
    },

    async getGroup(groupId) {
        const { data, error } = await supabase
            .from('santa_groups')
            .select('*, santa_participants(*, users(*))')
            .eq('id', groupId)
            .single();
        return { data, error };
    },

    async createGroup(groupData) {
        const { data, error } = await supabase
            .from('santa_groups')
            .insert([groupData])
            .select()
            .single();
        return { data, error };
    },

    async joinGroup(groupId, userId) {
        const { data, error } = await supabase
            .from('santa_participants')
            .insert([{ group_id: groupId, user_id: userId }])
            .select()
            .single();
        return { data, error };
    },

    async updateParticipantWishes(groupId, userId, wishes) {
        const { data, error } = await supabase
            .from('santa_participants')
            .update({ wishes })
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .select()
            .single();
        return { data, error };
    },

    async shuffleGroup(groupId, assignments) {
        const { data, error } = await supabase
            .from('santa_groups')
            .update({ shuffled: true, assignments })
            .eq('id', groupId)
            .select()
            .single();
        return { data, error };
    },

    // Upload image to Supabase Storage
    async uploadImage(file, path) {
        const { data, error } = await supabase.storage
            .from('wishlist-images')
            .upload(path, file);
        
        if (error) return { error };
        
        const { data: urlData } = supabase.storage
            .from('wishlist-images')
            .getPublicUrl(path);
        
        return { data: urlData.publicUrl, error: null };
    }
};

// Export for use
window.db = db;
window.SUPABASE_URL = SUPABASE_URL;
window.BOT_USERNAME = BOT_USERNAME;
