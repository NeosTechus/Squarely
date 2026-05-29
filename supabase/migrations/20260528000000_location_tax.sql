-- Location-based sales tax: resolve a store's rate from its state (+ optional
-- city). merchants.tax_rate_bps stays as an optional manual override.

create table if not exists tax_rates (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'US',
  state text not null,          -- 2-letter, uppercase
  city text,                    -- null = state base rate
  rate_bps int not null,        -- combined rate in basis points (825 = 8.25%)
  label text,
  unique (country, state, city)
);
alter table tax_rates enable row level security;
drop policy if exists tax_rates_read on tax_rates;
create policy tax_rates_read on tax_rates for select using (true);
grant select on tax_rates to anon, authenticated, service_role;
grant insert, update, delete on tax_rates to service_role;

-- Resolve the combined rate: most specific match wins (state+city, then state).
create or replace function public.resolve_tax_bps(p_state text, p_city text default null)
returns int
language sql
stable
as $$
  select coalesce(
    (select rate_bps from tax_rates
       where state = upper(coalesce(p_state,'')) and city is not null
         and lower(city) = lower(coalesce(p_city,'')) limit 1),
    (select rate_bps from tax_rates
       where state = upper(coalesce(p_state,'')) and city is null limit 1),
    0
  );
$$;
grant execute on function public.resolve_tax_bps(text, text) to anon, authenticated, service_role;

-- US state base rates (approximate statewide; local add-ons via city rows).
insert into tax_rates (state, city, rate_bps, label) values
 ('AL',null,400,'Alabama'),('AK',null,0,'Alaska'),('AZ',null,560,'Arizona'),
 ('AR',null,650,'Arkansas'),('CA',null,725,'California'),('CO',null,290,'Colorado'),
 ('CT',null,635,'Connecticut'),('DE',null,0,'Delaware'),('FL',null,600,'Florida'),
 ('GA',null,400,'Georgia'),('HI',null,400,'Hawaii'),('ID',null,600,'Idaho'),
 ('IL',null,625,'Illinois'),('IN',null,700,'Indiana'),('IA',null,600,'Iowa'),
 ('KS',null,650,'Kansas'),('KY',null,600,'Kentucky'),('LA',null,445,'Louisiana'),
 ('ME',null,550,'Maine'),('MD',null,600,'Maryland'),('MA',null,625,'Massachusetts'),
 ('MI',null,600,'Michigan'),('MN',null,688,'Minnesota'),('MS',null,700,'Mississippi'),
 ('MO',null,422,'Missouri'),('MT',null,0,'Montana'),('NE',null,550,'Nebraska'),
 ('NV',null,685,'Nevada'),('NH',null,0,'New Hampshire'),('NJ',null,663,'New Jersey'),
 ('NM',null,488,'New Mexico'),('NY',null,400,'New York'),('NC',null,475,'North Carolina'),
 ('ND',null,500,'North Dakota'),('OH',null,575,'Ohio'),('OK',null,450,'Oklahoma'),
 ('OR',null,0,'Oregon'),('PA',null,600,'Pennsylvania'),('RI',null,700,'Rhode Island'),
 ('SC',null,600,'South Carolina'),('SD',null,450,'South Dakota'),('TN',null,700,'Tennessee'),
 ('TX',null,625,'Texas'),('UT',null,485,'Utah'),('VT',null,600,'Vermont'),
 ('VA',null,530,'Virginia'),('WA',null,650,'Washington'),('WV',null,600,'West Virginia'),
 ('WI',null,500,'Wisconsin'),('WY',null,400,'Wyoming'),('DC',null,600,'Washington DC')
on conflict (country, state, city) do update set rate_bps = excluded.rate_bps, label = excluded.label;

-- Common city combined rates (state + county + city), examples.
insert into tax_rates (state, city, rate_bps, label) values
 ('CA','Los Angeles',950,'Los Angeles, CA'),('CA','San Francisco',863,'San Francisco, CA'),
 ('CA','San Diego',775,'San Diego, CA'),('NY','New York',888,'New York, NY'),
 ('IL','Chicago',1025,'Chicago, IL'),('WA','Seattle',1035,'Seattle, WA'),
 ('TX','Houston',825,'Houston, TX'),('TX','Austin',825,'Austin, TX'),
 ('TX','Dallas',825,'Dallas, TX'),('CO','Denver',881,'Denver, CO'),
 ('MI','Fenton',600,'Fenton, MI'),('AZ','Phoenix',860,'Phoenix, AZ'),
 ('FL','Miami',700,'Miami, FL'),('GA','Atlanta',890,'Atlanta, GA')
on conflict (country, state, city) do update set rate_bps = excluded.rate_bps, label = excluded.label;
