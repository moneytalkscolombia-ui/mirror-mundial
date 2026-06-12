import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { supabase } from '../supabase.js'
import styles from './ReadOnly.css?inline'

function formatMatchDate(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function PredictionLocked({ user, currentMatch }) {
  const [prediction, setPrediction] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('predictions')
        .select('pred_a, pred_b')
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

  const matchDate = formatMatchDate(currentMatch.kickoff_at)

  return (
    <div>
      <style>{styles}</style>
      <div class="card">
        <p class="eyebrow">Mirror Mundial</p>
        <span class="status-badge">Predicciones cerradas</span>
        <h1 class="headline">{currentMatch.team_a} vs {currentMatch.team_b}</h1>
        {matchDate && <p class="match-date">{matchDate}</p>}

        {prediction ? (
          <div class="info-box">
            <strong>Tu predicción: {prediction.pred_a} - {prediction.pred_b}.</strong> El partido está por empezar. ¡Suerte!
          </div>
        ) : (
          <div class="info-box">
            No alcanzaste a predecir este partido. El próximo se abre apenas termine este.
          </div>
        )}
      </div>
    </div>
  )
}