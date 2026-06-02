-- Supermarket register: support items sold by weight.
-- For a weighed item, price_cents is the price per unit of weight (e.g. per kg)
-- and the register prompts for the weight at checkout. `barcode` already exists.
alter table items add column if not exists sold_by_weight boolean not null default false;
alter table items add column if not exists weight_unit text; -- e.g. 'kg' / 'lb'; null for count items
