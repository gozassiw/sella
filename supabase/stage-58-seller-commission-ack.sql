-- Sella Stage 58: record one-time seller acknowledgement of the 3% platform commission.
alter table public.stores
  add column if not exists commission_acknowledged_at timestamptz;

notify pgrst, 'reload schema';

-- Seller ownership RLS already permits owners to update their own store row;
-- the API additionally requires approval_status = approved before setting this field.

-- The 3% rate remains controlled by the existing commission_rate app setting.
-- This migration only records that the seller saw and accepted the disclosure.

-- End Stage 58.
