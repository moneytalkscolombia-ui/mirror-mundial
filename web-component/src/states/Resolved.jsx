import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { supabase } from '../supabase.js'
import styles from './ReadOnly.css?inline'

export default function Resolved({ user, currentMatch }) {
  const [prediction, setPrediction] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('predictions')
        .select('pred_a, pred_b, points_awarded')
        .eq('user_id', user.id)
        .eq('match_id', currentMatch.id)
        .maybeSingle()
      if (cancelled) return
      setPrediction(data)
      setLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [user.id, currentMatch.id])

  if (!loaded) return null

  return (
    <div>
      <style>{styles}</style>
      <div class="card">
        <p class="eyebrow">Mirror Mundial</p>
        <span class="status-badge">Partido terminado</span>
        <h1 class="headline">{currentMatch.team_a} vs {currentMatch.team_b}</h1>

        <div class="score-display">
          <div class="team">{currentMatch.team_a}</div>
          <div class="score">{currentMatch.score_a}</div>
          <span class="score-sep">–</span>
          <div class="score">{currentMatch.score_b}</div>
          <div class="team">{currentMatch.team_b}</div>
        </div>

        {prediction ? (
          <div class="points-banner">
            <strong>Predijiste {prediction.pred_a} - {prediction.pred_b} → sumaste {prediction.points_awarded ?? 0} pts{currentMatch.is_colombia ? ' (Colombia × 2)' : ''}.</strong> El próximo partido se abre pronto.
          </div>
        ) : (
          <div class="info-box">
            No predijiste este partido. El próximo se abre pronto.
          </div>
        )}
      </div>
    </div>
  )
}