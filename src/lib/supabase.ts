/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;
const supabaseUrl = (meta.env && meta.env.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (meta.env && meta.env.VITE_SUPABASE_ANON_KEY) || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// SQL schema for Supabase setup reference
export const SUPABASE_SQL_SCHEMA = `
-- 1. Create Users Table
create table if not exists public.users (
  id text primary key,
  username text unique,
  name text,
  avatar text,
  bio text,
  status text default 'online',
  fingerprint text,
  xaon_id text,
  created_at bigint default extract(epoch from now()) * 1000
);

-- 2. Create Rooms Table
create table if not exists public.rooms (
  id text primary key,
  name text,
  type text default 'group',
  participants text[],
  unread_count int default 0,
  is_encrypted boolean default true,
  fingerprint text,
  avatar text,
  created_at bigint default extract(epoch from now()) * 1000
);

-- 3. Create Messages Table
create table if not exists public.messages (
  id text primary key,
  room_id text references public.rooms(id) on delete cascade,
  sender_id text references public.users(id),
  receiver_id text,
  text text,
  encrypted_payload jsonb,
  attachment jsonb,
  is_voice_note boolean default false,
  audio_duration int,
  timestamp bigint default extract(epoch from now()) * 1000,
  status text default 'sent'
);

-- Enable RLS & Policies
alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.messages enable row level security;

create policy "Public users read access" on public.users for select using (true);
create policy "Users write access" on public.users for all using (true);
create policy "Public rooms access" on public.rooms for all using (true);
create policy "Public messages access" on public.messages for all using (true);
`;
