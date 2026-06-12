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
        .select('user_id, display_name, total_points, rank', { count: 'exact' })
        .order('rank', { ascending: true })
        .limit(10)

      if (cancelled) return

      setRows(data || [])
      setTotal(count || 0)

      const inTop = (data || []).some(r => r.user_id === user.id)
      if (!inTop) {
        const { data: me } = await supabase
          .from('leaderboard')
          .select('user_id, display_name, total_points, rank')
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
            {rows.map(r => (
              <li key={r.user_id} class={'lb-row' + (r.user_id === user.id ? ' lb-row--me' : '')}>
                <span class="lb-rank">{r.rank}</span>
                <span class="lb-name">{r.display_name}</span>
                <span class="lb-points">{r.total_points} pts</span>
              </li>
            ))}
            {myRow && (
              <li class="lb-row lb-row--me lb-me-outside">
                <span class="lb-rank">{myRow.rank}</span>
                <span class="lb-name">{myRow.display_name}</span>
                <span class="lb-points">{myRow.total_points} pts</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}