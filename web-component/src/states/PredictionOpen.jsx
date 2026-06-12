import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { supabase } from '../supabase.js'
import styles from './PredictionOpen.css?inline'

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

function Flag({ code }) {
  if (!code) return null
  return (
    <img
      class="flag"
      src={`https://flagcdn.com/w40/${code}.png`}
      srcset={`https://flagcdn.com/w80/${code}.png 2x`}
      width="24"
      alt=""
      loading="lazy"
    />
  )
}

export default function PredictionOpen({ user, currentMatch }) {
  const [predA, setPredA] = useState('')
  const [predB, setPredB] = useState('')
  const [existing, setExisting] = useState(null)
  const [uiState, setUiState] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadExisting() {
      const { data } = await supabase
        .from('predictions')
        .select('pred_a, pred_b')
        .eq('user_id', user.id)
        .eq('match_id', currentMatch.id)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setExisting(data)
        setPredA(String(data.pred_a))
        setPredB(String(data.pred_b))
      }
      setUiState('idle')
    }
    loadExisting()
    return () => { cancelled = true }
  }, [user.id, currentMatch.id])

  function sanitize(val) {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 0) return ''
    if (n > 20) return '20'
    return String(n)
  }

  const valid = predA !== '' && predB !== ''

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid || uiState === 'submitting') return

    setUiState('submitting')
    setErrorMsg('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setErrorMsg('Tu sesión expiró. Recarga la página.')
      setUiState('idle')
      return
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit_prediction`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            match_id: currentMatch.id,
            pred_a: parseInt(predA, 10),
            pred_b: parseInt(predB, 10),
          }),
        }
      )

      const json = await res.json()

      if (!res.ok) {
        setErrorMsg(json.error || 'Algo salió mal. Intenta de nuevo.')
        setUiState('idle')
        return
      }

      setExisting({ pred_a: parseInt(predA, 10), pred_b: parseInt(predB, 10) })
      setUiState('saved')
    } catch (err) {
      setErrorMsg('Error de conexión. Intenta de nuevo.')
      setUiState('idle')
    }
  }

  if (uiState === 'loading') return null

  const matchDate = formatMatchDate(currentMatch.kickoff_at)

  return (
    <div>
      <style>{styles}</style>
      <div class="card">
        <p class="eyebrow">Mirror Mundial · Tu predicción</p>

        {currentMatch.is_colombia && (
          <span class="colombia-badge">Colombia · Puntos × 2</span>
        )}

        <h1 class="headline"><Flag code={currentMatch.flag_a} /> {currentMatch.team_a} vs {currentMatch.team_b} <Flag code={currentMatch.flag_b} /></h1>
        {matchDate && <p class="match-date">{matchDate}</p>}

        {existing && uiState !== 'saved' && (
          <div class="saved-banner">
            <strong>Ya predijiste {existing.pred_a} - {existing.pred_b}.</strong> Puedes cambiar tu predicción hasta 15 minutos antes del partido.
          </div>
        )}

        {uiState === 'saved' && (
          <div class="saved-banner">
            <strong>¡Predicción guardada: {existing.pred_a} - {existing.pred_b}!</strong> Puedes cambiarla hasta 15 minutos antes del partido.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div class="score-row">
            <div class="team"><Flag code={currentMatch.flag_a} /> {currentMatch.team_a}</div>
            <input
              class="score-input"
              type="number"
              inputmode="numeric"
              min="0"
              max="20"
              value={predA}
              onInput={(e) => setPredA(sanitize(e.target.value))}
              disabled={uiState === 'submitting'}
            />
            <span class="score-sep">–</span>
            <input
              class="score-input"
              type="number"
              inputmode="numeric"
              min="0"
              max="20"
              value={predB}
              onInput={(e) => setPredB(sanitize(e.target.value))}
              disabled={uiState === 'submitting'}
            />
            <div class="team">{currentMatch.team_b} <Flag code={currentMatch.flag_b} /></div>
          </div>

          <p class="deadline">Cierra 15 minutos antes del partido</p>

          {errorMsg && <div class="error-msg">{errorMsg}</div>}

          <button class="btn" type="submit" disabled={!valid || uiState === 'submitting'}>
            {uiState === 'submitting' ? 'Guardando…' : existing ? 'Actualizar predicción' : 'Guardar predicción'}
          </button>
          <p class="hint">Marcador exacto: 5 pts · Ganador: 1 pt</p>
        </form>
      </div>
    </div>
  )
}