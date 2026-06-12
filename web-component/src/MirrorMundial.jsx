import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { supabase, getCurrentUser, onAuthStateChange } from './supabase.js'
import Anonymous from './states/Anonymous.jsx'
import Onboarding from './states/Onboarding.jsx'
import PredictionOpen from './states/PredictionOpen.jsx'
import PredictionLocked from './states/PredictionLocked.jsx'
import Live from './states/Live.jsx'
import Resolved from './states/Resolved.jsx'
import ErrorEmpty from './states/ErrorEmpty.jsx'
import Leaderboard from './Leaderboard.jsx'
import AdminPanel from './AdminPanel.jsx'

function deriveStatus({ user, profile, match }) {
  if (!user) return 'anonymous'
  if (!profile?.display_name || !profile?.champion_pick) return 'onboarding'
  if (!match) return 'error_empty'

  if (match.status === 'live') return 'live'
  if (match.status === 'resolved') return 'resolved'
  if (match.status === 'locked' || !match.is_open) return 'prediction_locked'
  return 'prediction_open'
}

export default function MirrorMundial({ hostElement }) {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [currentMatch, setCurrentMatch] = useState(null)
  const [status, setStatus] = useState('anonymous')
  const [playersCount, setPlayersCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const realtimeRef = useRef(null)

  useEffect(() => {
    let authSub

    async function init() {
      loadPlayersCount()
      const { user: u } = await getCurrentUser()
      const resolved = u ?? null
      setUser(resolved)
      if (resolved) {
        await Promise.all([loadProfile(resolved.id), loadCurrentMatch(), loadIsAdmin(resolved.id)])
      }
    }

    init()

    authSub = onAuthStateChange(async (u) => {
      setUser(u)
      if (u) {
        await Promise.all([loadProfile(u.id), loadCurrentMatch(), loadIsAdmin(u.id)])
      } else {
        setProfile(null)
        setCurrentMatch(null)
        setIsAdmin(false)
      }
    })

    return () => { authSub?.unsubscribe() }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard:updates')
      .on('broadcast', { event: 'match_update' }, () => { loadCurrentMatch() })
      .subscribe()

    realtimeRef.current = channel

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (user === undefined) return
    setStatus(deriveStatus({ user, profile, match: currentMatch }))
  }, [user, profile, currentMatch])

  async function loadIsAdmin(userId) {
    const { data } = await supabase.rpc('is_admin', { p_user_id: userId })
    setIsAdmin(!!data)
  }

  async function loadPlayersCount() {
    const { count } = await supabase
      .from('leaderboard')
      .select('*', { count: 'exact', head: true })
    setPlayersCount(count ?? 0)
  }

  async function loadProfile(userId) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, champion_pick, created_at')
      .eq('id', userId)
      .single()

    if (profileData) {
      const { data: lb } = await supabase
        .from('leaderboard')
        .select('total_points, rank')
        .eq('user_id', userId)
        .maybeSingle()
      setProfile({ ...profileData, total_points: lb?.total_points ?? 0, rank: lb?.rank ?? null })
    } else {
      setProfile(null)
    }
  }

  async function loadCurrentMatch() {
    const { data: upcoming } = await supabase
      .from('matches')
      .select('*')
      .in('status', ['scheduled', 'locked'])
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (upcoming) {
      const { data: isOpen } = await supabase.rpc('is_match_open_for_predictions', {
        p_match_id: upcoming.id,
      })
      setCurrentMatch({ ...upcoming, is_open: isOpen ?? false })
      return
    }

    const { data: live } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'live')
      .order('kickoff_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (live) {
      setCurrentMatch({ ...live, is_open: false })
      return
    }

    const { data: resolved } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'resolved')
      .order('kickoff_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setCurrentMatch(resolved ? { ...resolved, is_open: false } : null)
  }

  if (user === undefined) return null

  async function handleProfileUpdated() {
    if (user) await loadProfile(user.id)
  }

  const sharedProps = { user, profile, currentMatch, playersCount, hostElement, onProfileUpdated: handleProfileUpdated }

  const stateView = (() => {
    switch (status) {
      case 'anonymous':         return <Anonymous {...sharedProps} />
      case 'onboarding':        return <Onboarding {...sharedProps} />
      case 'prediction_open':   return <PredictionOpen {...sharedProps} />
      case 'prediction_locked': return <PredictionLocked {...sharedProps} />
      case 'live':              return <Live {...sharedProps} />
      case 'resolved':          return <Resolved {...sharedProps} />
      default:                  return <ErrorEmpty {...sharedProps} />
    }
  })()

  const showLeaderboard = user && status !== 'anonymous' && status !== 'onboarding'

  return (
    <div>
      {stateView}
      {showLeaderboard && <Leaderboard user={user} refreshKey={currentMatch?.id} />}
      {isAdmin && <AdminPanel />}
    </div>
  )
}
