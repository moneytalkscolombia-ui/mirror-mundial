-- Helper: valida que un partido acepta predicciones en este momento
CREATE OR REPLACE FUNCTION is_match_open_for_predictions(p_match_id int)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT status IN ('scheduled', 'locked')
    AND kickoff_at - now() > interval '15 minutes'
  FROM matches
  WHERE id = p_match_id;
$$;

-- Trigger function: actualiza last_edited_at en cada UPDATE de predictions
CREATE OR REPLACE FUNCTION update_last_edited_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_edited_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS predictions_update_last_edited ON predictions;
CREATE TRIGGER predictions_update_last_edited
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_last_edited_at();

-- Tabla de admins
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users select own" ON admin_users;
CREATE POLICY "admin_users select own" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- Helper: verifica si un usuario es admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = p_user_id);
$$;

GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;

-- Resuelve un partido atómicamente: actualiza scores, recalcula puntos, refresca leaderboard
CREATE OR REPLACE FUNCTION resolve_match_db(
  p_match_id int,
  p_score_a int,
  p_score_b int
)
RETURNS TABLE (
  predictions_processed int,
  exact_count int,
  max_points_awarded int
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_colombia boolean;
BEGIN
  SELECT is_colombia INTO v_is_colombia
  FROM matches WHERE id = p_match_id;

  IF v_is_colombia IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE matches
  SET score_a = p_score_a,
      score_b = p_score_b,
      status = 'resolved',
      resolved_at = now()
  WHERE id = p_match_id;

  -- Idempotencia: reset antes de recalcular
  UPDATE predictions
  SET points_awarded = 0, is_exact = false
  WHERE match_id = p_match_id;

  -- Recalcular usando calculate_points con LATERAL (una sola query)
  UPDATE predictions p
  SET points_awarded = cp.points,
      is_exact = cp.is_exact
  FROM (
    SELECT pr.id, (cp_result).points, (cp_result).is_exact
    FROM predictions pr,
    LATERAL calculate_points(pr.pred_a, pr.pred_b, p_score_a, p_score_b, v_is_colombia) AS cp_result
    WHERE pr.match_id = p_match_id
  ) cp
  WHERE p.id = cp.id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;

  RETURN QUERY
  SELECT
    count(*)::int,
    sum(case when predictions.is_exact then 1 else 0 end)::int,
    coalesce(max(predictions.points_awarded), 0)::int
  FROM predictions WHERE predictions.match_id = p_match_id;
END;
$$;

-- Lockea partidos cuyo kickoff es en menos de 15 minutos (usa now() de Postgres)
CREATE OR REPLACE FUNCTION lock_matches_due()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE matches
  SET status = 'locked'
  WHERE status = 'scheduled'
    AND kickoff_at - now() < interval '15 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION lock_matches_due() TO service_role;
