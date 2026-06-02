-- =============================================================================
-- Mirror Mundial — Seed adicional: partidos de Colombia en fase de grupos
-- Migración: 20260101000003_colombia_group_stage.sql
-- =============================================================================
--
-- Agrega los 3 partidos confirmados de Colombia en el Grupo K del Mundial 2026.
-- Datos verificados contra NBC Sports, Yahoo Sports y FOX Sports (1 jun 2026).
--
-- Grupo K: Portugal, DR Congo, Uzbekistan, Colombia.
--
-- TODOS los partidos tienen is_colombia = true → puntos × 2.
--
-- Conversión horaria:
--   ET (EDT en junio, UTC-4) → UTC: hora ET + 4
--   Colombia (UTC-5, sin horario de verano) → UTC: hora COL + 5
--
-- Partido 1: Uzbekistán vs Colombia
--   17 jun 2026, 10pm ET = 9pm hora Colombia = 02:00 UTC del 18 jun
--   Estadio Azteca, Ciudad de México
--
-- Partido 2: Colombia vs DR Congo
--   23 jun 2026, 10pm ET = 9pm hora Colombia = 02:00 UTC del 24 jun
--   Estadio Akron, Guadalajara
--
-- Partido 3: Colombia vs Portugal
--   27 jun 2026, 7:30pm ET = 6:30pm hora Colombia = 23:30 UTC del 27 jun
--   Hard Rock Stadium, Miami
-- =============================================================================

INSERT INTO matches (team_a, team_b, team_a_flag, team_b_flag, kickoff_at, stage, is_colombia) VALUES
  -- Partido 1: Uzbekistán vs Colombia (CDMX)
  ('Uzbekistán', 'Colombia', '🇺🇿', '🇨🇴', '2026-06-18 02:00:00+00', 'grupo', true),

  -- Partido 2: Colombia vs DR Congo (Guadalajara)
  ('Colombia', 'DR Congo', '🇨🇴', '🇨🇩', '2026-06-24 02:00:00+00', 'grupo', true),

  -- Partido 3: Colombia vs Portugal (Miami)
  ('Colombia', 'Portugal', '🇨🇴', '🇵🇹', '2026-06-27 23:30:00+00', 'grupo', true);

-- Verificación: después de aplicar esta migración, la tabla matches debería tener 7 filas.
-- SELECT count(*) FROM matches;  -- Resultado esperado: 7
