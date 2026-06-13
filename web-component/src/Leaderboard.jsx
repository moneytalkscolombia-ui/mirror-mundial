import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { supabase } from './supabase.js'
import styles from './Leaderboard.css?inline'

export default function Leaderboard({ user, refreshKey }) {
  const [rows, setRows] = useState([])
  const [myRow, setMyRow] = useState(null)
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, count } = await supabase
        .from('leaderboard')
        .select('user_id, display_name, total_points, rank, is_vip', { count: 'exact' })
        .order('rank', { ascending: true })
        .limit(10)

      if (cancelled) return

      setRows(data || [])
      setTotal(count || 0)

      const inTop = (data || []).some(r => r.user_id === user.id)
      if (!inTop) {
        const { data: me } = await supabase
          .from('leaderboard')
          .select('user_id, display_name, total_points, rank, is_vip')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!cancelled) setMyRow(me)
      } else {
        setMyRow(null)
      }

      if (!cancelled) setLoaded(true)
    }

    load()
    return () => { cancelled = true }
  }, [user.id, refreshKey])

  if (!loaded) return null

  function renderRow(r, extraClass) {
    const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null
    return (
      <li key={r.user_id} class={'lb-row' + (r.user_id === user.id ? ' lb-row--me' : '') + (extraClass || '')}>
        <span class="lb-rank">{medal || r.rank}</span>
        <span class="lb-name">
          {r.display_name}
          {r.is_vip && <span class="lb-vip">VIP</span>}
        </span>
        <span class="lb-points">{r.total_points} pts</span>
      </li>
    )
  }

  return (
    <div>
      <style>{styles}</style>
      <div class="lb-card">
        <div class="lb-header">
          <span class="lb-title">Ranking · Top 10</span>
          {total > 0 && <span class="lb-count">{total} jugando</span>}
        </div>

        {rows.length === 0 ? (
          <p class="lb-empty">Aún no hay puntos. Cuando se resuelva el primer partido, el ranking aparecerá acá.</p>
        ) : (
          <ul class="lb-list">
            {rows.map(r => renderRow(r))}
            {myRow && renderRow(myRow, ' lb-me-outside')}
          </ul>
        )}

        <div class="lb-scoring">
          <p class="lb-scoring-title">¿Cómo se suman puntos?</p>
          <div class="lb-scoring-grid">
            <span>Marcador exacto</span><span>5 pts</span>
            <span>Ganador + diferencia</span><span>3 pts</span>
            <span>Empate (no exacto)</span><span>2 pts</span>
            <span>Solo el ganador</span><span>1 pt</span>
            <span class="lb-scoring-highlight">Partido de Colombia</span><span class="lb-scoring-highlight">× 2</span>
            <span class="lb-scoring-highlight">Campeón del Mundial</span><span class="lb-scoring-highlight">+15 pts</span>
          </div>
        </div>
      </div>
    </div>
  )
}