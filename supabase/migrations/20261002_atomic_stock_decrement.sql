-- Atomic, all-or-nothing stock decrement for a paid order (founder decision,
-- 2 Oct 2026). Called by decrementStockForOrder in lib/inventory.ts when a UPI
-- payment is confirmed (admin "Mark Paid" and the bank-SMS auto-confirm share
-- that path). Until this is applied the app falls back to a per-line
-- compare-and-set, which is safe but not one transaction.
--
-- p_items: [{"slug": "...", "quantity": 2}, ...]
-- Returns one row per line with the new stock_on_hand. If any line is short,
-- nothing is changed and the short line comes back with stock_on_hand = null.
-- Products with no inventory row are not stock-tracked and are skipped.

create or replace function decrement_order_stock(p_items jsonb)
returns table (chapter_slug text, stock_on_hand integer)
language plpgsql
as $$
declare
  line jsonb;
  short_slug text;
begin
  -- Lock every row first, in a fixed order, so two confirmations can't deadlock.
  perform 1 from inventory i
    where i.chapter_slug in (select x->>'slug' from jsonb_array_elements(p_items) x)
    order by i.chapter_slug
    for update;

  select x->>'slug' into short_slug
    from jsonb_array_elements(p_items) x
    join inventory i on i.chapter_slug = x->>'slug'
    where i.stock_on_hand < (x->>'quantity')::int
    limit 1;
  if short_slug is not null then
    return query select short_slug, null::integer;
    return;
  end if;

  for line in select * from jsonb_array_elements(p_items) loop
    return query
      update inventory i
         set stock_on_hand = i.stock_on_hand - (line->>'quantity')::int,
             updated_at = now()
       where i.chapter_slug = line->>'slug'
         and i.stock_on_hand >= (line->>'quantity')::int
      returning i.chapter_slug, i.stock_on_hand;
  end loop;
end;
$$;

-- Belt and braces: stock can never go negative.
alter table inventory drop constraint if exists inventory_stock_on_hand_nonnegative;
alter table inventory add constraint inventory_stock_on_hand_nonnegative check (stock_on_hand >= 0) not valid;
