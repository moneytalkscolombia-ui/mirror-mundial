import { h } from 'preact'
import { useState } from 'preact/hooks'
import { signInWithMagicLink } from '../supabase.js'
import anonymousStyles from './Anonymous.css?inline'

const EMAIL_RE = /.+@.+\..+/

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

export default function Anonymous({ currentMatch, playersCount }) {
  const [email, setEmail] = useState('')
  const [uiState, setUiState] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()

    if (!EMAIL_RE.test(email.trim())) {
      setErrorMsg('Ingresá un email válido.')
      setUiState('error')
      return
    }

    setUiState('submitting')
    setErrorMsg('')

    const { error } = await signInWithMagicLink(email.trim())

    if (error) {
      setErrorMsg('Algo salió mal. Intentá de nuevo.')
      setUiState('error')
    } else {
      setUiState('sent')
    }
  }

  const matchDate = currentMatch ? formatMatchDate(currentMatch.kickoff_at) : null

  return (
    <div>
      <style>{anonymousStyles}</style>
      <div class="card">
        <h2 class="headline">El Mundial, <span>sin filtros.</span></h2>
        <p class="prizes">
          🏆 1° lugar: outfit Mirror completo · 2°: tenis · 3°: dos camisetas
        </p>

        {currentMatch && (
          <div class="match-info">
            <div class="match-teams">{currentMatch.team_a} vs {currentMatch.team_b}</div>
            {matchDate && <div class="match-date">{matchDate}</div>}
          </div>
        )}

        {playersCount > 0 && (
          <p class="players-count">
            <strong>{playersCount}</strong> personas ya están jugando
          </p>
        )}

        {uiState === 'sent' ? (
          <div class="sent-msg">
            <strong>¡Listo! Revisá tu email.</strong>
            Si no lo ves en 1 minuto, revisá spam.
          </div>
        ) : (
          <form class="form" onSubmit={handleSubmit}>
            <input
              class="input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onInput={(e) => setEmail(e.target.value)}
              disabled={uiState === 'submitting'}
              autocomplete="email"
              inputmode="email"
            />
            {uiState === 'error' && (
              <div class="error-msg">{errorMsg}</div>
            )}
            <button class="btn" type="submit" disabled={uiState === 'submitting'}>
              {uiState === 'submitting' ? 'Enviando…' : 'Predecir gratis'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
