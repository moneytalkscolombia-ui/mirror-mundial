import { h } from 'preact'
import styles from './ReadOnly.css?inline'

export default function ErrorEmpty() {
  return (
    <div>
      <style>{styles}</style>
      <div class="card">
        <p class="eyebrow">Mirror Mundial</p>
        <h1 class="headline">No hay partidos por ahora</h1>
        <p class="empty-msg">Vuelve pronto. El próximo partido del Mundial aparecerá acá para que hagas tu predicción.</p>
      </div>
    </div>
  )
}