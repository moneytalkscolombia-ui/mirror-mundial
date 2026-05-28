-- =============================================================================
-- Mirror Mundial — Schema inicial
-- Migración: 20260101000001_schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLA: profiles
-- Un registro por usuario autenticado (auth.users).
-- display_name: único, 3-20 chars, alfanumérico + guion bajo.
-- champion_pick: texto libre, elegido una sola vez en el onboarding.
-- -----------------------------------------------------------------------------
create table profiles (
  id            uuid        primary key references auth.users on delete cascade,
  email         text        unique not null,
  display_name  text        unique not null
                            check (
                              length(display_name) between 3 and 20
                              and display_name ~ '^[a-zA-Z0-9_]+$'
                            ),
  champion_pick text,
  created_at    timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- TABLA: matches
-- Partidos cubiertos por el juego.
-- stage: 'octavos' | 'cuartos' | 'semi' | 'tercero' | 'final' | 'grupo'
-- status: 'scheduled' → 'locked' (15min antes) → 'live' (manual) →
--         'resolved' | 'postponed'
-- score_a / score_b: resultado oficial al final de 90min + tiempo extra.
--   Los penales NO cuentan para el cálculo de puntos.
-- is_colombia: true = puntos × 2 para todos los usuarios en ese partido.
-- -----------------------------------------------------------------------------
create table matches (
  id            serial      primary key,
  team_a        text        not null,
  team_b        text        not null,
  team_a_flag   text,
  team_b_flag   text,
  kickoff_at    timestamptz not null,
  stage         text        not null
                            check (stage in ('octavos','cuartos','semi','tercero','final','grupo')),
  status        text        not null default 'scheduled'
                            check (status in ('scheduled','locked','live','resolved','postponed')),
  score_a       int,
  score_b       int,
  is_colombia   boolean     not null default false,
  resolved_at   timestamptz,
  created_at    timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- TABLA: predictions
-- Una predicción por usuario por partido (UNIQUE user_id + match_id).
-- pred_a / pred_b: marcador predicho, enteros 0-20.
-- points_awarded: se calcula y escribe cuando el partido se resuelve.
-- is_exact: true solo cuando pred_a = score_a AND pred_b = score_b.
--   Se usa como criterio de desempate (ver spec §3.4).
-- last_edited_at: se actualiza en cada UPSERT para rastrear ediciones.
-- -----------------------------------------------------------------------------
create table predictions (
  id              serial      primary key,
  user_id         uuid        not null references profiles on delete cascade,
  match_id        int         not null references matches  on delete cascade,
  pred_a          int         not null check (pred_a between 0 and 20),
  pred_b          int         not null check (pred_b between 0 and 20),
  points_awarded  int         not null default 0,
  is_exact        boolean     not null default false,
  submitted_at    timestamptz default now(),
  last_edited_at  timestamptz default now(),
  unique(user_id, match_id)
);

-- -----------------------------------------------------------------------------
-- FUNCIÓN: calculate_points
-- Recibe la predicción del usuario y el resultado oficial.
-- Devuelve (points int, is_exact boolean).
-- Lógica (90min + tiempo extra; penales no cuentan):
--   5 pts  → marcador exacto
--   2 pts  → empate predicho, marcador errado (ej: predijo 1-1, fue 2-2)
--   3 pts  → ganador correcto Y diferencia de goles correcta
--   1 pt   → solo ganador correcto (sin diferencia exacta)
--   0 pts  → errado
-- Multiplicador: si is_colombia = true, points × 2.
-- -----------------------------------------------------------------------------
create or replace function calculate_points(
  pred_a     int,
  pred_b     int,
  score_a    int,
  score_b    int,
  is_colombia boolean
) returns table(points int, is_exact boolean) language plpgsql as $$
begin
  if pred_a = score_a and pred_b = score_b then
    -- Marcador exacto
    points := 5; is_exact := true;

  elsif pred_a = pred_b and score_a = score_b then
    -- Empate predicho pero marcador errado (ej: 1-1 vs 2-2)
    points := 2; is_exact := false;

  elsif sign(pred_a - pred_b) = sign(score_a - score_b) then
    -- Ganador correcto: verificar si la diferencia también es exacta
    if (pred_a - pred_b) = (score_a - score_b) then
      points := 3;  -- Ganador + diferencia exacta
    else
      points := 1;  -- Solo ganador correcto
    end if;
    is_exact := false;

  else
    -- Errado: ganador incorrecto
    points := 0; is_exact := false;
  end if;

  -- Multiplicador Colombia: los partidos de Colombia valen el doble
  if is_colombia then points := points * 2; end if;

  return next;
end; $$;

-- -----------------------------------------------------------------------------
-- VISTA MATERIALIZADA: leaderboard
-- Snapshot del ranking calculado desde predictions.
-- Se refresca con REFRESH MATERIALIZED VIEW CONCURRENTLY desde resolve_match.
-- Orden de desempate (spec §3.4):
--   1. total_points DESC
--   2. champion_correct (seteado externamente, no en la vista)
--   3. exact_predictions DESC
--   4. total_predictions DESC
--   5. created_at ASC (se registró primero)
-- El índice único en user_id habilita el REFRESH CONCURRENTLY.
-- -----------------------------------------------------------------------------
create materialized view leaderboard as
select
  p.id              as user_id,
  p.display_name,
  p.champion_pick,
  coalesce(sum(pr.points_awarded), 0)::int                            as total_points,
  coalesce(sum(case when pr.is_exact then 1 else 0 end), 0)::int      as exact_predictions,
  count(pr.id)::int                                                    as total_predictions,
  p.created_at,
  rank() over (
    order by
      coalesce(sum(pr.points_awarded), 0) desc,
      coalesce(sum(case when pr.is_exact then 1 else 0 end), 0) desc,
      count(pr.id) desc,
      p.created_at asc
  ) as rank
from profiles p
left join predictions pr on pr.user_id = p.id
group by p.id, p.display_name, p.champion_pick, p.created_at;

-- Índice único requerido para REFRESH MATERIALIZED VIEW CONCURRENTLY
create unique index on leaderboard(user_id);
