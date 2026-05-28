-- =============================================================================
-- Mirror Mundial — Row Level Security (RLS)
-- Migración: 20260101000002_rls.sql
-- =============================================================================
-- Principio general:
--   - Lectura pública en profiles y matches (el leaderboard es visible a todos).
--   - Escritura solo sobre los propios datos (auth.uid() = id / user_id).
--   - Las operaciones de admin (insert/update en matches, resolve_match,
--     refresh del leaderboard) se hacen EXCLUSIVAMENTE desde Edge Functions
--     con service_role JWT, que bypasea RLS por diseño de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------------------
alter table profiles enable row level security;

-- Cualquiera puede ver todos los perfiles (necesario para el leaderboard).
create policy "profiles_select_all"
  on profiles for select
  using (true);

-- Solo el propio usuario puede insertar su perfil (en el onboarding).
create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

-- Solo el propio usuario puede editar su perfil.
-- Nota: champion_pick se setea una sola vez en el onboarding. La restricción
-- de "no editable después de confirmar" se enforcea en la Edge Function /
-- frontend, no a nivel de RLS (RLS no puede guardar estado previo del row).
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- MATCHES
-- -----------------------------------------------------------------------------
alter table matches enable row level security;

-- Cualquiera (incluso anónimo) puede ver los partidos.
-- Necesario para mostrar el banner a usuarios no logueados.
create policy "matches_select_all"
  on matches for select
  using (true);

-- INSERT / UPDATE / DELETE en matches: NO hay policy para usuarios normales.
-- Solo service_role (admin) puede escribir en matches. El service_role
-- bypasea RLS, por lo que no necesita policy explícita.

-- -----------------------------------------------------------------------------
-- PREDICTIONS
-- -----------------------------------------------------------------------------
alter table predictions enable row level security;

-- Cada usuario solo puede ver, crear y editar sus propias predicciones.
-- La política "for all" cubre SELECT, INSERT, UPDATE, DELETE.
-- El cierre de edición (15min antes del kickoff) se enforcea en la
-- Edge Function submit_prediction, no aquí.
create policy "predictions_own"
  on predictions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- LEADERBOARD (vista materializada)
-- Las vistas materializadas no soportan RLS directamente.
-- La seguridad está garantizada porque:
--   1. La vista solo expone display_name, puntos y ranking (no emails ni IDs sensibles).
--   2. Solo service_role puede hacer REFRESH (desde resolve_match).
--   3. El acceso de lectura es intencional: el leaderboard es público.
-- No se necesita política adicional.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- NOTA PARA LA FINAL DEL TORNEO — DESEMPATE POR CAMPEÓN (spec §3.4, criterio 2)
-- =============================================================================
-- El leaderboard materializado resuelve desempates por: puntos → exactos →
-- total predicciones → antigüedad de registro.
--
-- El criterio que falta es: "gana quien acertó al campeón del Mundial".
-- Este criterio solo se puede aplicar UNA VEZ, al final, cuando el campeón
-- es conocido.
--
-- ACCIÓN PENDIENTE (Sesión 4 — Admin panel):
--   Crear una función SQL o vista parametrizada que, recibiendo el nombre
--   del campeón real, devuelva el ranking final con los 4 criterios completos.
--   El admin podrá ejecutarla con un click desde el panel, sin escribir SQL.
--
-- Query de referencia (NO ejecutar ahora, es solo documentación):
--
--   SELECT
--     user_id, display_name, champion_pick, total_points,
--     exact_predictions, total_predictions, created_at,
--     rank() over (
--       order by
--         total_points desc,
--         (champion_pick = :campeon_real)::int desc,   -- criterio 2
--         exact_predictions desc,
--         total_predictions desc,
--         created_at asc
--     ) as rank_final
--   FROM leaderboard
--   ORDER BY rank_final;
--
-- =============================================================================
