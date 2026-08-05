-- Seed data for local development only.
-- Creates an admin auth user so the /admin console can be exercised locally.
--   email:    admin@sydeinnovation.test
--   password: admin123456

do $$
declare
  admin_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from auth.users where email = 'admin@sydeinnovation.test') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'admin@sydeinnovation.test',
      crypt('admin123456', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      admin_id,
      admin_id,
      format('{"sub":"%s","email":"%s"}', admin_id, 'admin@sydeinnovation.test')::jsonb,
      'email',
      now(), now(), now()
    );
  end if;
end $$;

-- A sample portfolio project so the portfolio page has content out of the box.
insert into public.projects (title, description, category, tech)
select 'Sample Conveyor Assembly',
       'Parametric conveyor system modeled in Autodesk Inventor and driven by iLogic automation.',
       'Automation',
       'Inventor + APS'
where not exists (select 1 from public.projects);
