-- Sella Stage 40: remove the unused legacy delivery-release RPC.
-- Sellers now update packed, out-for-delivery, and delivered statuses directly.

drop function if exists public.release_order_escrow(uuid, text);
