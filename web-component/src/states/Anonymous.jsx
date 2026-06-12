import { h } from 'preact'
import { useState } from 'preact/hooks'
import { signInWithMagicLink } from '../supabase.js'
import styles from './Anonymous.css?inline'

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
      setErrorMsg('Escribe un email válido.')
      setUiState('error')
      return
    }

    setUiState('submitting')
    setErrorMsg('')

    const { error } = await signInWithMagicLink(email.trim())

    if (error) {
      setErrorMsg('Algo salió mal. Intenta de nuevo.')
      setUiState('error')
    } else {
      setUiState('sent')
    }
  }

  const matchDate = currentMatch ? formatMatchDate(currentMatch.kickoff_at) : null

  return (
    <div>
      <style>{styles}</style>
      <div class="card">
        <p class="eyebrow">Mirror Mundial</p>
        <h1 class="headline">Predice el Mundial. Gana premios reales.</h1>
        <p class="subtitle">Predice los marcadores, suma puntos y compite por el ranking.</p>

        <ul class="prizes">
          <li class="prize-item">🥇 Primer lugar — Outfit completo Mirror</li>
          <li class="prize-item">🥈 Segundo — Un par de tenis</li>
          <li class="prize-item">🥉 Tercero — Dos camisetas</li>
        </ul>

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
            <strong>¡Listo! Revisa tu email.</strong>
            Te enviamos un link para entrar. Si no lo ves en 1 minuto, revisa spam.
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
            <p class="fineprint">Gratis. No necesitas comprar nada.</p>
          </form>
        )}
      </div>
    </div>
  )
}