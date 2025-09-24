import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'npm:@supabase/supabase-js'
import * as kv from './kv_store.tsx'

const app = new Hono()

app.use('*', cors())
app.use('*', logger(console.log))

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Types
interface League {
  id: string
  name: string
  creator: string
  entryFee: number
  participants: string[]
  startDate: string
  endDate: string
  status: 'pending' | 'active' | 'completed'
  totalPool: number
  yieldGenerated: number
  winnerDistribution: {
    top1: number
    top3: number
    top10Percent: number
  }
  matches: Match[]
}

interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  date: string
  result?: { home: number, away: number }
  status: 'upcoming' | 'live' | 'finished'
}

interface Bet {
  userId: string
  matchId: string
  leagueId: string
  prediction: { home: number, away: number }
  points: number
}

interface User {
  id: string
  name: string
  email: string
  totalPoints: { [leagueId: string]: number }
  wallet: {
    balance: number
    totalDeposited: number
    totalEarned: number
  }
}

// Routes

// Inscription utilisateur
app.post('/make-server-f4729f06/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json()
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    })
    
    if (error) throw error
    
    // Créer le profil utilisateur
    const user: User = {
      id: data.user.id,
      name,
      email,
      totalPoints: {},
      wallet: {
        balance: 0,
        totalDeposited: 0,
        totalEarned: 0
      }
    }
    
    await kv.set(`user:${data.user.id}`, user)
    
    return c.json({ success: true, user })
  } catch (error) {
    console.log('Erreur lors de l\'inscription:', error)
    return c.json({ error: 'Erreur lors de l\'inscription' }, 500)
  }
})

// Créer une nouvelle ligue
app.post('/make-server-f4729f06/leagues', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const { name, entryFee, endDate, winnerDistribution, matches } = await c.req.json()
    
    const league: League = {
      id: crypto.randomUUID(),
      name,
      creator: user.id,
      entryFee,
      participants: [user.id],
      startDate: new Date().toISOString(),
      endDate,
      status: 'pending',
      totalPool: entryFee,
      yieldGenerated: 0,
      winnerDistribution: winnerDistribution || { top1: 100, top3: 0, top10Percent: 0 },
      matches
    }
    
    await kv.set(`league:${league.id}`, league)
    
    // Déduire l'entry fee du portefeuille de l'utilisateur
    const userData = await kv.get(`user:${user.id}`) as User
    userData.wallet.balance -= entryFee
    userData.wallet.totalDeposited += entryFee
    await kv.set(`user:${user.id}`, userData)
    
    return c.json({ success: true, league })
  } catch (error) {
    console.log('Erreur lors de la création de la ligue:', error)
    return c.json({ error: 'Erreur lors de la création de la ligue' }, 500)
  }
})

// Rejoindre une ligue
app.post('/make-server-f4729f06/leagues/:id/join', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const leagueId = c.req.param('id')
    const league = await kv.get(`league:${leagueId}`) as League
    
    if (!league) {
      return c.json({ error: 'Ligue introuvable' }, 404)
    }
    
    if (league.participants.includes(user.id)) {
      return c.json({ error: 'Déjà inscrit à cette ligue' }, 400)
    }
    
    const userData = await kv.get(`user:${user.id}`) as User
    
    if (userData.wallet.balance < league.entryFee) {
      return c.json({ error: 'Solde insuffisant' }, 400)
    }
    
    // Ajouter le participant et déduire l'entry fee
    league.participants.push(user.id)
    league.totalPool += league.entryFee
    
    userData.wallet.balance -= league.entryFee
    userData.wallet.totalDeposited += league.entryFee
    userData.totalPoints[leagueId] = 0
    
    await kv.set(`league:${leagueId}`, league)
    await kv.set(`user:${user.id}`, userData)
    
    return c.json({ success: true, league })
  } catch (error) {
    console.log('Erreur lors de l\'inscription à la ligue:', error)
    return c.json({ error: 'Erreur lors de l\'inscription à la ligue' }, 500)
  }
})

// Placer un pari
app.post('/make-server-f4729f06/bets', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const { leagueId, matchId, prediction } = await c.req.json()
    
    const bet: Bet = {
      userId: user.id,
      matchId,
      leagueId,
      prediction,
      points: 0
    }
    
    await kv.set(`bet:${leagueId}:${matchId}:${user.id}`, bet)
    
    return c.json({ success: true, bet })
  } catch (error) {
    console.log('Erreur lors de la mise du pari:', error)
    return c.json({ error: 'Erreur lors de la mise du pari' }, 500)
  }
})

// Obtenir les ligues d'un utilisateur
app.get('/make-server-f4729f06/user/leagues', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const allLeagues = await kv.getByPrefix('league:')
    const userLeagues = allLeagues.filter((league: League) => 
      league.participants.includes(user.id)
    )
    
    return c.json({ leagues: userLeagues })
  } catch (error) {
    console.log('Erreur lors de la récupération des ligues:', error)
    return c.json({ error: 'Erreur lors de la récupération des ligues' }, 500)
  }
})

// Simuler les rendements DeFi (appelé périodiquement)
app.post('/make-server-f4729f06/simulate-yield', async (c) => {
  try {
    const allLeagues = await kv.getByPrefix('league:')
    const activeLeagues = allLeagues.filter((league: League) => league.status === 'active')
    
    for (const league of activeLeagues) {
      // Simuler un rendement de 5% annuel (adapté à la durée de la ligue)
      const daysActive = Math.floor((Date.now() - new Date(league.startDate).getTime()) / (1000 * 60 * 60 * 24))
      const annualYield = 0.05
      const dailyYield = annualYield / 365
      const yieldToAdd = league.totalPool * dailyYield
      
      league.yieldGenerated += yieldToAdd
      await kv.set(`league:${league.id}`, league)
    }
    
    return c.json({ success: true, message: 'Rendements simulés' })
  } catch (error) {
    console.log('Erreur lors de la simulation des rendements:', error)
    return c.json({ error: 'Erreur lors de la simulation' }, 500)
  }
})

// Finaliser une ligue et distribuer les gains
app.post('/make-server-f4729f06/leagues/:id/finalize', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const leagueId = c.req.param('id')
    const league = await kv.get(`league:${leagueId}`) as League
    
    if (!league || league.creator !== user.id) {
      return c.json({ error: 'Ligue introuvable ou non autorisé' }, 404)
    }
    
    // Calculer les classements finaux
    const rankings = await calculateRankings(leagueId)
    
    // Distribuer les gains selon les paramètres de la ligue
    await distributeWinnings(league, rankings)
    
    league.status = 'completed'
    await kv.set(`league:${leagueId}`, league)
    
    return c.json({ success: true, rankings })
  } catch (error) {
    console.log('Erreur lors de la finalisation de la ligue:', error)
    return c.json({ error: 'Erreur lors de la finalisation' }, 500)
  }
})

async function calculateRankings(leagueId: string) {
  const allBets = await kv.getByPrefix(`bet:${leagueId}:`)
  const userPoints: { [userId: string]: number } = {}
  
  for (const bet of allBets) {
    if (!userPoints[bet.userId]) userPoints[bet.userId] = 0
    userPoints[bet.userId] += bet.points
  }
  
  return Object.entries(userPoints)
    .sort(([,a], [,b]) => b - a)
    .map(([userId, points], index) => ({ userId, points, rank: index + 1 }))
}

async function distributeWinnings(league: League, rankings: any[]) {
  const totalYield = league.yieldGenerated
  const entryFee = league.entryFee
  
  for (let i = 0; i < rankings.length; i++) {
    const { userId, rank } = rankings[i]
    const userData = await kv.get(`user:${userId}`) as User
    
    let winnings = entryFee // Récupération de la mise de base
    
    // Distribution des rendements selon la configuration
    if (rank === 1 && league.winnerDistribution.top1 > 0) {
      winnings += totalYield * (league.winnerDistribution.top1 / 100)
    } else if (rank <= 3 && league.winnerDistribution.top3 > 0) {
      winnings += totalYield * (league.winnerDistribution.top3 / 100) / Math.min(3, rankings.length)
    } else if (rank <= Math.ceil(rankings.length * 0.1) && league.winnerDistribution.top10Percent > 0) {
      const top10Count = Math.ceil(rankings.length * 0.1)
      winnings += totalYield * (league.winnerDistribution.top10Percent / 100) / top10Count
    }
    
    userData.wallet.balance += winnings
    userData.wallet.totalEarned += (winnings - entryFee)
    
    await kv.set(`user:${userId}`, userData)
  }
}

// Obtenir le profil utilisateur
app.get('/make-server-f4729f06/user/profile', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const userData = await kv.get(`user:${user.id}`) as User
    
    if (!userData) {
      return c.json({ error: 'Utilisateur introuvable' }, 404)
    }
    
    return c.json({ user: userData })
  } catch (error) {
    console.log('Erreur lors de la récupération du profil:', error)
    return c.json({ error: 'Erreur lors de la récupération du profil' }, 500)
  }
})

// Recharger le portefeuille (simulation)
app.post('/make-server-f4729f06/wallet/deposit', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const { amount } = await c.req.json()
    const userData = await kv.get(`user:${user.id}`) as User
    
    userData.wallet.balance += amount
    await kv.set(`user:${user.id}`, userData)
    
    return c.json({ success: true, newBalance: userData.wallet.balance })
  } catch (error) {
    console.log('Erreur lors du dépôt:', error)
    return c.json({ error: 'Erreur lors du dépôt' }, 500)
  }
})

Deno.serve(app.fetch)