-- User-facing copy: product renamed Gym Rats → Echo.
update public.features
set body = replace(body, 'Gym Rats', 'Echo')
where body like '%Gym Rats%';
