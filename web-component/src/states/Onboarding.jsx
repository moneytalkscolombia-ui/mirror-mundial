import { h } from 'preact'
import { useState } from 'preact/hooks'
import { supabase } from '../supabase.js'
import styles from './Onboarding.css?inline'

const TEAMS = [
  'Alemania', 'Arabia Saudita', 'Argelia', 'Argentina', 'Australia',
  'Austria', 'Bélgica', 'Bosnia y Herzegovina', 'Brasil', 'Cabo Verde',
  'Canadá', 'Catar', 'Chequia', 'Colombia', 'Corea del Sur',
  'Costa de Marfil', 'Croacia', 'Curazao', 'DR Congo', 'Ecuador',
  'Egipto', 'Escocia', 'España', 'Estados Unidos', 'Francia',
  'Ghana', 'Haití', 'Inglaterra', 'Irán', 'Iraq',
  'Japón', 'Jordania', 'Marruecos', 'México', 'Noruega',
  'Nueva Zelanda', 'Países Bajos', 'Panamá', 'Paraguay', 'Portugal',
  'Senegal', 'Sudáfrica', 'Suecia', 'Suiza', 'Türkiye',
  'Túnez', 'Uruguay', 'Uzbekistán',
]

const NAME_REGEX = /^[a-zA-Z0-9_]+$/

function validateName(val) {
  if (!val) return null
  if (val.length < 3) return 'Mínimo 3 letras.'
  if (val.length > 20) return 'Máximo 20 letras.'
  if (!NAME_REGEX.test(val)) return 'Solo letras, números y guion bajo.'
  return null
}

export default function Onboarding({ user, onProfileUpdated }) {
  const [step, setStep] = useState('welcome')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(null)
  const [nameTouched, setNameTouched] = useState(false)
  const [champion, setChampion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const nameValid = name.length >= 3 && name.length <= 20 && NAME_REGEX.test(name)
  const championValid = champion !== ''

  const progressFirst = step === 'nickname' || step === 'champion'
  const progressSecond = step === 'champion'

  function handleNameInput(e) {
    setName(e.target.value)
    if (nameTouched) setNameError(validateName(e.target.value))
  }

  function handleNameBlur() {
    setNameTouched(true)
    setNameError(validateName(name))
  }

  function handleChampionInput(e) {
    setChampion(e.target.value)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nameValid || !championValid || submitting) return

    setSubmitting(true)
    setSubmitError(null)

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, champion_pick: champion })
      .eq('id', user.id)

    setSubmitting(false)

    if (error) {
      if (error.code === '23505') {
        setSubmitError('Ese apodo ya está tomado. Vuelve atrás y elige otro.')
        setStep('nickname')
      } else {
        setSubmitError('Algo salió mal. Intenta de nuevo.')
      }
      return
    }

    if (onProfileUpdated) onProfileUpdated()
  }

  return (
    <div>
      <style>{styles}</style>
      <div class="card">

        {step === 'welcome' && (
          <div class="step">
            <div>
              <div class="progress">
                <div class={'progress-seg' + (progressFirst ? ' progress-seg--filled' : '')} />
                <div class={'progress-seg' + (progressSecond ? ' progress-seg--filled' : '')} />
              </div>
              <p class="eyebrow">Mirror Mundial</p>
              <h1 class="headline">Tres ganadores. Premios reales.</h1>
              <p class="subtitle">Predice los partidos del Mundial y suma puntos. Los tres que más sumen ganan.</p>
              <ul class="prizes">
                <li class="prize-item">🥇 Primer lugar — Outfit completo Mirror</li>
                <li class="prize-item">🥈 Segundo — Un par de tenis</li>
                <li class="prize-item">🥉 Tercero — Dos camisetas</li>
              </ul>
            </div>
            <div class="actions">
              <button class="btn" onClick={() => setStep('nickname')}>Empezar →</button>
              <p class="fineprint">Gratis. No necesitas comprar nada.</p>
            </div>
          </div>
        )}

        {step === 'nickname' && (
          <div class="step">
            <div>
              <div class="progress">
                <div class={'progress-seg' + (progressFirst ? ' progress-seg--filled' : '')} />
                <div class={'progress-seg' + (progressSecond ? ' progress-seg--filled' : '')} />
              </div>
              <p class="eyebrow">Paso 1 de 2</p>
              <h1 class="headline">¿Cómo quieres que te llamen?</h1>
              <p class="subtitle">Así te van a ver el resto de jugadores en el ranking.</p>
              <div class="field">
                <input
                  class={'input' + (nameTouched && nameError ? ' input--error' : '')}
                  type="text"
                  placeholder="andres_bog"
                  value={name}
                  onInput={handleNameInput}
                  onBlur={handleNameBlur}
                  maxLength={20}
                  autocomplete="off"
                />
                {nameTouched && nameError
                  ? <span class="field-error">{nameError}</span>
                  : <span class="hint">Mínimo 3 letras. Solo letras, números y guion bajo.</span>
                }
              </div>
              {submitError && <div class="error-msg">{submitError}</div>}
            </div>
            <div class="actions">
              <button
                class="btn"
                disabled={!nameValid}
                onClick={() => { setSubmitError(null); setStep('champion') }}
              >
                Continuar →
              </button>
              <button class="btn-back" onClick={() => setStep('welcome')}>← Volver</button>
            </div>
          </div>
        )}

        {step === 'champion' && (
          <div class="step">
            <div>
              <div class="progress">
                <div class={'progress-seg' + (progressFirst ? ' progress-seg--filled' : '')} />
                <div class={'progress-seg' + (progressSecond ? ' progress-seg--filled' : '')} />
              </div>
              <p class="eyebrow">Paso 2 de 2 · Último</p>
              <h1 class="headline">¿Quién crees que gana el Mundial?</h1>
              <p class="subtitle">Elige el equipo que crees que se queda con la copa.</p>
              <div class="field">
                <div class="select-wrapper">
                  <select
                    class="select"
                    value={champion}
                    onInput={handleChampionInput}
                  >
                    <option value="" disabled>Toca para elegir</option>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <span class="hint">Solo lo eliges una vez. No se puede cambiar.</span>
              </div>
              {submitError && <div class="error-msg">{submitError}</div>}
            </div>
            <div class="actions">
              <button
                class="btn"
                disabled={!championValid || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Guardando…' : 'Empezar a jugar →'}
              </button>
              <button class="btn-back" onClick={() => { setSubmitError(null); setStep('nickname') }}>← Volver</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
