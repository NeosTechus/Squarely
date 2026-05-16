-- Seed plans (no real Stripe price IDs yet — fill in after creating Stripe products).
insert into plans (tier, display_name, monthly_price_cents, yearly_price_cents, device_limit, features)
values
  ('starter',    'Starter',    0,    0,     1,    '["pos","inventory_basic"]'),
  ('growth',     'Growth',     2900, 29000, 3,    '["pos","kiosk","inventory_full"]'),
  ('pro',        'Pro',        7900, 79000, 10,   '["pos","kiosk","kds","inventory_full","loyalty","multi_location","advanced_reports"]'),
  ('enterprise', 'Enterprise', 0,    0,     null, '["pos","kiosk","kds","inventory_full","loyalty","multi_location","advanced_reports","api_access","white_label"]')
on conflict (tier) do nothing;
