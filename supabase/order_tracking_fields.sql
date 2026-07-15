-- Add order tracking fields for Global SIM Help.
-- Run this once in Supabase SQL Editor before using logistics updates in admin.

alter table public.orders
  add column if not exists logistics_company text,
  add column if not exists logistics_no text,
  add column if not exists logistics_status text default 'pending',
  add column if not exists logistics_note text,
  add column if not exists logistics_image_data text,
  add column if not exists shipped_at timestamptz,
  add column if not exists logistics_updated_at timestamptz,
  add column if not exists logistics_image_updated_at timestamptz;

create index if not exists orders_receiver_phone_idx on public.orders (receiver_phone);
create index if not exists orders_logistics_no_idx on public.orders (logistics_no);
