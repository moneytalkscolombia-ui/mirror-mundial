-- =============================================================================
-- Mirror Mundial — Seed de partidos garantizados
-- Archivo: supabase/seed.sql
-- =============================================================================
--
-- INSTRUCCIONES PARA EDITAR ESTE ARCHIVO
-- ---------------------------------------
-- Este seed contiene los 4 partidos garantizados del Mundial FIFA 2026.
-- Los equipos son placeholders que se actualizan desde el admin panel
-- conforme avance el bracket. Las fechas y horas son FIJAS por FIFA.
--
-- PARA ACTUALIZAR UN EQUIPO (cuando el bracket avance):
--   1. Abrí el admin panel → Partidos.
--   2. Editá team_a / team_b / team_a_flag / team_b_flag directamente.
--   NO es necesario volver a correr este seed.
--
-- REGLA DE CONVERSIÓN DE HORA:
--   Hora Colombia (COT, UTC-5) + 5 horas = UTC
--   Ejemplo: partido a las 2pm Colombia → 2 + 5 = 19:00 UTC
--   Ejemplo: partido a las 4pm Colombia → 4 + 5 = 21:00 UTC
--   Nota: en julio, Colombia NO usa horario de verano (siempre UTC-5).
--   USA Eastern en julio usa EDT (UTC-4): hora ET + 4 = UTC.
--
-- FECHAS FIJAS FIFA (NO modificar):
--   Las fechas y horas de kickoff_at son oficiales FIFA y no deben cambiarse.
--   Solo los campos team_a, team_b, team_a_flag, team_b_flag son editables.
--
-- =============================================================================

insert into matches
  (team_a, team_b, team_a_flag, team_b_flag, kickoff_at, stage, status, is_colombia)
values

  -- -------------------------------------------------------------------------
  -- SEMIFINAL 1
  -- Estadio: AT&T Stadium — Arlington, Texas
  -- Fecha local: 14 de julio de 2026, 3:00 PM ET (EDT, UTC-4)
  -- Hora Colombia: 2:00 PM COT (UTC-5)
  -- Hora UTC: 19:00 UTC  ← 3pm ET + 4 = 19:00 / 2pm COT + 5 = 19:00 ✓
  -- -------------------------------------------------------------------------
  (
    'Por definir',
    'Por definir',
    '🏳️',
    '🏳️',
    '2026-07-14T19:00:00Z',
    'semi',
    'scheduled',
    false
  ),

  -- -------------------------------------------------------------------------
  -- SEMIFINAL 2
  -- Estadio: Mercedes-Benz Stadium — Atlanta, Georgia
  -- Fecha local: 15 de julio de 2026, 3:00 PM ET (EDT, UTC-4)
  -- Hora Colombia: 2:00 PM COT (UTC-5)
  -- Hora UTC: 19:00 UTC  ← 3pm ET + 4 = 19:00 / 2pm COT + 5 = 19:00 ✓
  -- -------------------------------------------------------------------------
  (
    'Por definir',
    'Por definir',
    '🏳️',
    '🏳️',
    '2026-07-15T19:00:00Z',
    'semi',
    'scheduled',
    false
  ),

  -- -------------------------------------------------------------------------
  -- TERCER PUESTO
  -- Estadio: Hard Rock Stadium — Miami Gardens, Florida
  -- Fecha local: 18 de julio de 2026, 5:00 PM ET (EDT, UTC-4)
  -- Hora Colombia: 4:00 PM COT (UTC-5)
  -- Hora UTC: 21:00 UTC  ← 5pm ET + 4 = 21:00 / 4pm COT + 5 = 21:00 ✓
  -- -------------------------------------------------------------------------
  (
    'Por definir',
    'Por definir',
    '🏳️',
    '🏳️',
    '2026-07-18T21:00:00Z',
    'tercero',
    'scheduled',
    false
  ),

  -- -------------------------------------------------------------------------
  -- FINAL
  -- Estadio: MetLife Stadium — East Rutherford, New Jersey
  -- Fecha local: 19 de julio de 2026, 3:00 PM ET (EDT, UTC-4)
  -- Hora Colombia: 2:00 PM COT (UTC-5)
  -- Hora UTC: 19:00 UTC  ← 3pm ET + 4 = 19:00 / 2pm COT + 5 = 19:00 ✓
  -- -------------------------------------------------------------------------
  (
    'Por definir',
    'Por definir',
    '🏳️',
    '🏳️',
    '2026-07-19T19:00:00Z',
    'final',
    'scheduled',
    false
  );
