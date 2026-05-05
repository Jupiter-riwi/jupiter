-- ============================================================
-- Seed de desarrollo — datos demo para Jupiter Sales Evaluator
-- SOLO ejecutar en entorno de desarrollo
-- ============================================================

-- Tenant demo
insert into public.tenants (id, name, plan) values
  ('00000000-0000-0000-0000-000000000001', 'Acme Corp (demo)', 'pro');

-- Preguntas de evaluación demo
insert into public.questions (tenant_id, prompt, category, target_skill) values
  ('00000000-0000-0000-0000-000000000001',
   'Presentá nuestro producto principal a un cliente nuevo que no conoce la empresa.',
   'presentacion', 'claridad'),
  ('00000000-0000-0000-0000-000000000001',
   'Un cliente te dice que el precio es muy alto. ¿Cómo manejás la objeción?',
   'objeciones', 'confianza'),
  ('00000000-0000-0000-0000-000000000001',
   'Cerrá una venta con un cliente que está indeciso entre nosotros y la competencia.',
   'cierre', 'escucha_activa');

-- Nota: los usuarios (profiles) se crean cuando se registran via Supabase Auth.
-- Para crear usuarios demo, hacerlo desde el dashboard de Supabase:
--   Authentication > Users > Add user
-- Y luego ejecutar manualmente:
--
-- insert into public.profiles (id, tenant_id, role, first_name, last_name) values
--   ('<uuid-del-usuario>', '00000000-0000-0000-0000-000000000001', 'admin', 'Admin', 'Demo'),
--   ('<uuid-del-usuario>', '00000000-0000-0000-0000-000000000001', 'seller', 'Juan', 'Vendedor');
