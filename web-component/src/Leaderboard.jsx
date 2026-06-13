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
          <p class="lb-scoring-title">¿Cómo se suman los puntos?</p>
          <div class="lb-scoring-rows">
            <div class="lb-scoring-row">
              <span class="lb-scoring-badge lb-scoring-badge--full">5 pts</span>
              <div>
                <div class="lb-scoring-name">Marcador exacto</div>
                <div class="lb-scoring-ex">Predijiste 2-1 y quedó 2-1</div>
              </div>
            </div>
            <div class="lb-scoring-row">
              <span class="lb-scoring-badge lb-scoring-badge--mid">3 pts</span>
              <div>
                <div class="lb-scoring-name">Ganador + diferencia de goles</div>
                <div class="lb-scoring-ex">Predijiste 3-1 y quedó 2-0</div>
              </div>
            </div>
            <div class="lb-scoring-row">
              <span class="lb-scoring-badge lb-scoring-badge--mid">2 pts</span>
              <div>
                <div class="lb-scoring-name">Empate predicho, marcador errado</div>
                <div class="lb-scoring-ex">Predijiste 1-1 y quedó 2-2</div>
              </div>
            </div>
            <div class="lb-scoring-row">
              <span class="lb-scoring-badge lb-scoring-badge--mid">1 pt</span>
              <div>
                <div class="lb-scoring-name">Solo el ganador</div>
                <div class="lb-scoring-ex">Predijiste 1-0 y quedó 3-1</div>
              </div>
            </div>
            <div class="lb-scoring-row lb-scoring-row--dim">
              <span class="lb-scoring-badge lb-scoring-badge--zero">0 pts</span>
              <div>
                <div class="lb-scoring-name">Errado</div>
                <div class="lb-scoring-ex">Predijiste 1-0 y ganó el otro equipo</div>
              </div>
            </div>
            <div class="lb-scoring-row lb-scoring-row--bonus">
              <span class="lb-scoring-badge lb-scoring-badge--bonus">× 2</span>
              <div>
                <div class="lb-scoring-name lb-scoring-name--gold">Partidos de Colombia valen doble</div>
                <div class="lb-scoring-ex">Exacto en Colombia = 10 pts</div>
              </div>
            </div>
            <div class="lb-scoring-row lb-scoring-row--bonus">
              <span class="lb-scoring-badge lb-scoring-badge--bonus">+15 pts</span>
              <div>
                <div class="lb-scoring-name lb-scoring-name--gold">Si adivinas el campeón del Mundial</div>
                <div class="lb-scoring-ex">El mayor bonus — se revela al final</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}