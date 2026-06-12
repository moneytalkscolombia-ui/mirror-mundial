import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { supabase } from '../supabase.js'
import styles from './ReadOnly.css?inline'

export default function Live({ user, currentMatch }) {
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

  return (
    <div>
      <style>{styles}</style>
      <div class="card">
        <p class="eyebrow">Mirror Mundial</p>
        <span class="status-badge status-badge--live">● En juego</span>
        <h1 class="headline">{currentMatch.team_a} vs {currentMatch.team_b}</h1>

        {prediction ? (
          <div class="info-box">
            <strong>Tu predicción: {prediction.pred_a} - {prediction.pred_b}.</strong> Cuando termine el partido verás tus puntos acá.
          </div>
        ) : (
          <div class="info-box">
            No predijiste este partido. El próximo se abre apenas termine este.
          </div>
        )}
      </div>
    </div>
  )
}