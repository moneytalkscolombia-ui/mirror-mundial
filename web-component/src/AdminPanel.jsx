import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { supabase } from './supabase.js'
import styles from './AdminPanel.css?inline'

const TEAMS = [
  ['Alemania','de'],['Arabia Saudita','sa'],['Argelia','dz'],['Argentina','ar'],['Australia','au'],
  ['Austria','at'],['Bélgica','be'],['Bosnia y Herzegovina','ba'],['Brasil','br'],['Cabo Verde','cv'],
  ['Canadá','ca'],['Catar','qa'],['Chequia','cz'],['Colombia','co'],['Corea del Sur','kr'],
  ['Costa de Marfil','ci'],['Croacia','hr'],['Curazao','cw'],['DR Congo','cd'],['Ecuador','ec'],
  ['Egipto','eg'],['Escocia','gb-sct'],['España','es'],['Estados Unidos','us'],['Francia','fr'],
  ['Ghana','gh'],['Haití','ht'],['Inglaterra','gb-eng'],['Irán','ir'],['Iraq','iq'],
  ['Japón','jp'],['Jordania','jo'],['Marruecos','ma'],['México','mx'],['Noruega','no'],
  ['Nueva Zelanda','nz'],['Países Bajos','nl'],['Panamá','pa'],['Paraguay','py'],['Portugal','pt'],
  ['Senegal','sn'],['Sudáfrica','za'],['Suecia','se'],['Suiza','ch'],['Türkiye','tr'],
  ['Túnez','tn'],['Uruguay','uy'],['Uzbekistán','uz'],
]

const STAGES = ['grupo', 'octavos', 'cuartos', 'semi', 'tercero', 'final']

async function callAdmin(op, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Sesión expirada. Recarga.' }
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin_ops`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ op, ...payload }),
      }
    )
    return await res.json()
  } catch {
    return { error: 'Error de conexión' }
  }
}

function flagCode(teamName) {
  const found = TEAMS.find(t => t[0] === teamName)
  return found ? found[1] : ''
}

function MatchesTab() {
  const [matches, setMatches] = useState([])
  const [msg, setMsg] = useState(null)
  const [resolving, setResolving] = useState(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [newA, setNewA] = useState('')
  const [newB, setNewB] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newStage, setNewStage] = useState('grupo')
  const [newColombia, setNewColombia] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editDate, setEditDate] = useState('')

  const stale = matches.filter(m => m.status === 'live' && (Date.now() - new Date(m.kickoff_at).getTime()) > 3 * 3600 * 1000)

  async function load() {
    const r = await callAdmin('list_matches')
    if (r.matches) setMatches(r.matches)
  }
  useEffect(() => { load() }, [])

  function fmtLocal(iso) {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  }

  async function setLive(id) {
    setBusy(true)
    const r = await callAdmin('update_match', { match_id: id, fields: { status: 'live' } })
    setMsg(r.error ? { t: 'err', x: r.error } : { t: 'ok', x: 'Partido en vivo.' })
    await load(); setBusy(false)
  }

  async function doPreview(id) {
    setBusy(true)
    const r = await callAdmin('preview_resolve', { match_id: id, score_a: parseInt(scoreA, 10), score_b: parseInt(scoreB, 10) })
    if (r.error) setMsg({ t: 'err', x: r.error })
    else setPreview(r)
    setBusy(false)
  }

  async function doResolve(id) {
    setBusy(true)
    const r = await callAdmin('resolve', { match_id: id, score_a: parseInt(scoreA, 10), score_b: parseInt(scoreB, 10) })
    setMsg(r.error ? { t: 'err', x: r.error } : { t: 'ok', x: 'Partido resuelto. Puntos repartidos.' })
    setResolving(null); setPreview(null); setScoreA(''); setScoreB('')
    await load(); setBusy(false)
  }

  async function saveDate(id) {
    setBusy(true)
    const iso = new Date(editDate).toISOString()
    const r = await callAdmin('update_match', { match_id: id, fields: { kickoff_at: iso } })
    setMsg(r.error ? { t: 'err', x: r.error } : { t: 'ok', x: 'Fecha actualizada.' })
    setEditing(null)
    await load(); setBusy(false)
  }

  async function addMatch(e) {
    e.preventDefault()
    if (!newA || !newB || !newDate) { setMsg({ t: 'err', x: 'Completa equipos y fecha.' }); return }
    setBusy(true)
    const iso = new Date(newDate).toISOString()
    const r = await callAdmin('add_match', {
      team_a: newA, team_b: newB, kickoff_at: iso, stage: newStage,
      is_colombia: newColombia || newA === 'Colombia' || newB === 'Colombia',
      flag_a: flagCode(newA), flag_b: flagCode(newB),
    })
    setMsg(r.error ? { t: 'err', x: r.error } : { t: 'ok', x: 'Partido agregado.' })
    setNewA(''); setNewB(''); setNewDate(''); setNewStage('grupo'); setNewColombia(false)
    await load(); setBusy(false)
  }

  return (
    <div>
      {stale.length > 0 && (
        <div class="adm-msg adm-msg--err" style="margin-bottom:10px">
          ⚠️ {stale.length === 1 ? 'Hay 1 partido' : `Hay ${stale.length} partidos`} en vivo hace más de 3 horas sin resolver: {stale.map(m => `${m.team_a} vs ${m.team_b}`).join(', ')}. Resuélvelo para repartir los puntos.
        </div>
      )}

      {matches.map(m => (
        <div key={m.id} class="adm-row">
          <div class="adm-row-main">
            <div class="adm-row-title">{m.team_a} vs {m.team_b} {m.is_colombia ? '×2' : ''}</div>
            <div class="adm-row-sub">#{m.id} · {fmtLocal(m.kickoff_at)} · {m.stage} · {m.status}{m.status === 'resolved' ? ` · ${m.score_a}-${m.score_b}` : ''}</div>
          </div>
          {m.status === 'scheduled' && <button class="adm-btn adm-btn--ghost" disabled={busy} onClick={() => { setEditing(m.id); setEditDate('') }}>Fecha</button>}
          {(m.status === 'scheduled' || m.status === 'locked') && <button class="adm-btn" disabled={busy} onClick={() => setLive(m.id)}>Iniciar</button>}
          {m.status === 'live' && <button class="adm-btn adm-btn--warn" disabled={busy} onClick={() => { setResolving(m.id); setPreview(null) }}>Resolver</button>}

          {editing === m.id && (
            <div class="adm-form" style="width:100%">
              <label class="adm-label">Nueva fecha y hora (Colombia)</label>
              <input class="adm-input" type="datetime-local" value={editDate} onInput={e => setEditDate(e.target.value)} />
              <button class="adm-btn" disabled={busy || !editDate} onClick={() => saveDate(m.id)}>Guardar fecha</button>
            </div>
          )}

          {resolving === m.id && (
            <div class="adm-form" style="width:100%">
              <label class="adm-label">Marcador final ({m.team_a} - {m.team_b}) · con tiempo extra, sin penales</label>
              <div class="adm-form-row">
                <input class="adm-input" type="number" min="0" placeholder={m.team_a} value={scoreA} onInput={e => setScoreA(e.target.value)} />
                <input class="adm-input" type="number" min="0" placeholder={m.team_b} value={scoreB} onInput={e => setScoreB(e.target.value)} />
              </div>
              {!preview && <button class="adm-btn" disabled={busy || scoreA === '' || scoreB === ''} onClick={() => doPreview(m.id)}>Ver vista previa de puntos</button>}
              {preview && (
                <div class="adm-preview">
                  <strong>{preview.total_predictions} predicciones · puntos a repartir:</strong>
                  {preview.preview.map(p => (
                    <div class="adm-preview-row"><span>{p.display_name} ({p.pred})</span><span>{p.points} pts</span></div>
                  ))}
                  <button class="adm-btn adm-btn--warn" style="margin-top:8px" disabled={busy} onClick={() => doResolve(m.id)}>CONFIRMAR {scoreA}-{scoreB} (no se puede deshacer fácil)</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <form class="adm-form" onSubmit={addMatch}>
        <strong style="font-size:0.82rem">Agregar partido</strong>
        <div class="adm-form-row">
          <div>
            <label class="adm-label">Equipo A</label>
            <select class="adm-select" value={newA} onInput={e => setNewA(e.target.value)}>
              <option value="">—</option>
              {TEAMS.map(t => <option key={t[0]} value={t[0]}>{t[0]}</option>)}
            </select>
          </div>
          <div>
            <label class="adm-label">Equipo B</label>
            <select class="adm-select" value={newB} onInput={e => setNewB(e.target.value)}>
              <option value="">—</option>
              {TEAMS.map(t => <option key={t[0]} value={t[0]}>{t[0]}</option>)}
            </select>
          </div>
        </div>
        <div class="adm-form-row">
          <div>
            <label class="adm-label">Fecha y hora (Colombia)</label>
            <input class="adm-input" type="datetime-local" value={newDate} onInput={e => setNewDate(e.target.value)} />
          </div>
          <div>
            <label class="adm-label">Fase</label>
            <select class="adm-select" value={newStage} onInput={e => setNewStage(e.target.value)}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <label class="adm-check">
          <input type="checkbox" checked={newColombia} onInput={e => setNewColombia(e.target.checked)} />
          Puntos ×2 (se marca solo si juega Colombia)
        </label>
        <button class="adm-btn" type="submit" disabled={busy}>Agregar partido</button>
      </form>

      {msg && <div class={'adm-msg ' + (msg.t === 'ok' ? 'adm-msg--ok' : 'adm-msg--err')}>{msg.x}</div>}
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    const r = await callAdmin('list_users')
    if (r.users) setUsers(r.users)
  }
  useEffect(() => { load() }, [])

  async function toggleVip(u) {
    setBusy(true)
    const r = await callAdmin('set_vip', { user_id: u.id, is_vip: !u.is_vip })
    setMsg(r.error ? { t: 'err', x: r.error } : { t: 'ok', x: `${u.display_name}: VIP ${!u.is_vip ? 'activado (+10 pts)' : 'desactivado'}.` })
    await load(); setBusy(false)
  }

  const filtered = users.filter(u =>
    !q || (u.display_name || '').toLowerCase().includes(q.toLowerCase()) || (u.email || '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div>
      <input class="adm-input adm-search" placeholder="Buscar por apodo o email…" value={q} onInput={e => setQ(e.target.value)} />
      {filtered.map(u => (
        <div key={u.id} class="adm-row">
          <div class="adm-row-main">
            <div class="adm-row-title">{u.display_name}{u.is_vip && <span class="adm-badge">VIP</span>}</div>
            <div class="adm-row-sub">{u.email} · campeón: {u.champion_pick || '—'}</div>
          </div>
          <button class="adm-btn" disabled={busy} onClick={() => toggleVip(u)}>{u.is_vip ? 'Quitar VIP' : 'Hacer VIP'}</button>
        </div>
      ))}
      {msg && <div class={'adm-msg ' + (msg.t === 'ok' ? 'adm-msg--ok' : 'adm-msg--err')}>{msg.x}</div>}
    </div>
  )
}

function PredictionsTab() {
  const [matches, setMatches] = useState([])
  const [sel, setSel] = useState('')
  const [preds, setPreds] = useState(null)

  useEffect(() => {
    callAdmin('list_matches').then(r => { if (r.matches) setMatches(r.matches) })
  }, [])

  async function loadPreds(id) {
    setSel(id)
    if (!id) { setPreds(null); return }
    const r = await callAdmin('list_predictions', { match_id: parseInt(id, 10) })
    setPreds(r.predictions || [])
  }

  return (
    <div>
      <select class="adm-select" value={sel} onInput={e => loadPreds(e.target.value)}>
        <option value="">Elige un partido…</option>
        {matches.map(m => <option key={m.id} value={m.id}>#{m.id} {m.team_a} vs {m.team_b} ({m.status})</option>)}
      </select>
      {preds && preds.length === 0 && <p style="margin-top:12px;font-size:0.82rem;color:#888">Sin predicciones aún.</p>}
      {preds && preds.map((p, i) => (
        <div key={i} class="adm-row">
          <div class="adm-row-main">
            <div class="adm-row-title">{p.profiles?.display_name} · {p.pred_a}-{p.pred_b}</div>
            <div class="adm-row-sub">{p.profiles?.email} · editado: {new Date(p.last_edited_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}{p.points_awarded != null ? ` · ${p.points_awarded} pts` : ''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('matches')

  return (
    <div>
      <style>{styles}</style>
      <button class="adm-toggle" onClick={() => setOpen(!open)}>{open ? 'Cerrar admin' : 'Admin'}</button>
      {open && (
        <div class="adm-card">
          <div class="adm-tabs">
            <button class={'adm-tab' + (tab === 'matches' ? ' adm-tab--active' : '')} onClick={() => setTab('matches')}>Partidos</button>
            <button class={'adm-tab' + (tab === 'users' ? ' adm-tab--active' : '')} onClick={() => setTab('users')}>Usuarios</button>
            <button class={'adm-tab' + (tab === 'preds' ? ' adm-tab--active' : '')} onClick={() => setTab('preds')}>Predicciones</button>
          </div>
          {tab === 'matches' && <MatchesTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'preds' && <PredictionsTab />}
        </div>
      )}
    </div>
  )
}