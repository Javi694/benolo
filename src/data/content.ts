// Benolo Protocol Constants and Data

export const translations = {
  en: {
    // App basics - Benolo integration
    appName: 'PronoPool',
    protocol: 'Powered by Benolo Protocol',
    benolo: 'Benolo',
    tagline: 'Bet with friends without losing money',
    safetyMessage: 'Your money is 100% protected',
    safetyNote: 'With safe investment strategies on Benolo',
    exploreApp: 'Explore App',
    getStarted: 'Get Started',
    loading: 'Loading...',
    hello: 'Welcome back',
    logout: 'Logout',
    
    // Navigation
    home: 'Home',
    dashboard: 'Dashboard',
    betting: 'Betting',
    wallet: 'Wallet',
    createLeague: 'Create League',
    joinLeague: 'Join League',
    backToDashboard: 'Back to Dashboard',
    backToHome: 'Back to Home',
    
    // Homepage content with Benolo explanations
    homeTitle: 'Compete with Friends Without Risk',
    homeSubtitle: 'The first sports betting protocol where everyone gets their money back',
    
    // How it works section
    howItWorksTitle: 'How Benolo Protocol Works',
    howItWorksSubtitle: 'Simple, safe, and fun - powered by BEt-NO-LOss technology',
    
    step1Title: 'Create or Join a League',
    step1Desc: 'Start a prediction league with friends or join an existing one',
    step2Title: 'Everyone Contributes',
    step2Desc: 'Each player deposits USDC - this forms the prize pool',
    step3Title: 'Money Grows Safely',
    step3Desc: 'Benolo invests your USDC in secure DeFi protocols automatically',
    step3Info: 'Your USDC is deposited into battle-tested protocols like Aave and Compound. These protocols have secured billions of dollars and offer stable returns. Your principal is always protected.',
    step4Title: 'Predict & Compete',
    step4Desc: 'Make predictions on real matches and climb the leaderboard',
    step5Title: 'Everyone Wins',
    step5Desc: 'Everyone gets their USDC back + winners share the yield profits',
    
    // Safety section
    safetyTitle: 'Your Money is Always Protected by Benolo',
    safetySubtitle: 'Unlike traditional betting, Benolo never puts your principal at risk',
    
    safetyPoint1: 'No Risk to Your Principal',
    safetyPoint1Desc: 'Your initial USDC deposit is always returned at the end',
    safetyPoint2: 'Battle-Tested Protocols',
    safetyPoint2Desc: 'Benolo only uses proven DeFi protocols with billions in TVL',
    safetyPoint3: 'Real-Time Transparency',
    safetyPoint3Desc: 'Track exactly where your USDC is invested and earnings in real-time',
    
    // Investment explanation
    investmentTitle: 'Where Does Your USDC Go?',
    investmentSubtitle: 'Benolo\'s transparent investment strategy explained',
    
    traditionalBetting: 'Traditional Betting',
    traditionalLose: 'You lose everything if wrong',
    traditionalHouse: 'House always wins',
    
    pronoPool: 'Benolo Protocol',
    pronoSafe: 'Your USDC stays protected',
    pronoGrows: 'USDC generates yield through DeFi',
    pronoEveryone: 'Everyone gets principal back',
    
    // Join League content
    joinLeagueTitle: 'Join a League',
    joinLeagueSubtitle: 'Find and join leagues powered by Benolo Protocol',
    
    browseLeagues: 'Browse Open Leagues',
    enterLeagueCode: 'Enter League Code',
    leagueCodePlaceholder: 'Enter 6-digit league code',
    joinWithCode: 'Join with Code',
    noLeaguesFound: 'No open leagues found',
    createFirst: 'Be the first to create a league!',
    featuredLeague: 'FEATURED LEAGUE',
    freeLeague: 'Free League - No USDC required!',
    createFirstLeague: 'Create First League',
    enterCodeDescription: 'Enter the 6-digit code shared by the league creator',
    leagueNotFound: 'League not found. Please check the code.',
    
    // League info
    leagueCode: 'League Code',
    entryFee: 'Entry Fee (USDC)',
    participants: 'Participants',
    endDate: 'End Date',
    strategy: 'Investment Strategy',
    joinLeagueBtn: 'Join League',
    leagueCreator: 'Created by',
    
    // Dashboard specific
    myDashboard: 'My Dashboard',
    personalStats: 'Personal Statistics',
    myLeagues: 'My Leagues',
    quickActions: 'Quick Actions',
    
    // League creation
    createNewLeague: 'Create New League',
    leagueConfiguration: 'Configure your sports prediction league with Benolo Protocol',
    leagueName: 'League Name',
    championship: 'Championship',
    chooseChampionship: 'Choose a championship',
    freeEntry: 'Free Entry (0 USDC)',
    unlimitedParticipants: 'Unlimited participants',
    canLeave: 'Players can leave anytime?',
    canLeaveDesc: 'If enabled, players lose 10% of their stake which goes to the prize pool',
    defiStrategy: 'Benolo Investment Strategy',
    chooseStrategy: 'Choose Benolo strategy',
    noStrategyNeeded: 'No investment strategy needed for free leagues',
    description: 'Description',
    descriptionPlaceholder: 'Describe your league, special rules, etc.',
    championshipSelected: 'Championship Selected',
    championshipDesc: 'Matches and calendars will be automatically synchronized with this championship.',
    autoRevenueTitle: 'Automatic Yield Generation with Benolo',
    autoRevenueDesc: 'All USDC stakes are automatically invested through Benolo Protocol in secure DeFi protocols. At the end, everyone gets their initial stake back and the best predictors share the generated yields.',
    rewardDistribution: 'Reward Distribution',
    rewardDistributionDesc: 'Choose who shares the Benolo yields at the end of the league',
    winnerSelection: 'Who wins the yields?',
    winnerSelectionDesc: 'Select how many participants will share the DeFi yields generated by Benolo',
    signupDeadlineQuestion: 'Registration deadline',
    signupDeadlineDescription: 'After this date, signups close and funds can be locked.',
    signupDeadlineHint: 'Players must join before this deadline.',
    signupDeadlinePast: 'The deadline must be in the future.',
    leagueStartQuestion: 'When does the league start?',
    leagueStartQuestionDesc: 'Choose the trigger that will unlock predictions for your players.',
    leagueStartAfterDate: 'After a specific date',
    leagueStartAfterDateDesc: 'Predictions open automatically on the scheduled date.',
    leagueStartAfterParticipants: 'After a player threshold',
    leagueStartAfterParticipantsDesc: 'Predictions open once the required number of players has joined.',
    startDateLabel: 'Launch date',
    startDateHint: 'This date closes registrations and opens predictions.',
    startDatePast: 'Choose a future launch date.',
    startParticipantGoalLabel: 'Players required to start',
    startParticipantGoalHint: 'The creator counts as one participant.',
    startParticipantGoalError: 'Set a minimum of 2 players to start the league.',
    startDateMissing: 'Select a valid launch date.',
    
    // Reward distribution options
    winnerOnly: 'Winner Takes All',
    winnerOnlyDesc: '1st place gets 100% of yields',
    topThree: 'Top 3 Podium',
    topThreeDesc: '60% / 25% / 15% split',
    topFive: 'Top 5 Leaders',
    topFiveDesc: '40% / 25% / 20% / 10% / 5% split',
    topTenPercent: 'Top 10%',
    topTenPercentDesc: 'Proportional split among top 10% of players',
    customSplit: 'Custom Split',
    customSplitDesc: 'Define your own distribution rules',
    
    creatingLeague: 'Creating league...',
    createLeagueBtn: 'Create League',
    leagueCreated: 'League Created Successfully!',
    leagueCodeGenerated: 'Your league code is:',
    shareCode: 'Share this code with your friends to let them join!',
    continueToDashboard: 'Continue to Dashboard',

    // League status & start info
    activeStatus: 'Active',
    pendingStatus: 'Pending',
    completedStatus: 'Completed',
    leagueNotStarted: 'Predictions will open when the league launches.',
    leaguePendingParticipants: 'This league will open once the required number of players have joined.',
    leaguePendingDate: 'This league will open on the scheduled launch date.',
    leaguePendingParticipantsShort: 'Waiting for players',
    leaguePendingDateShort: 'Waiting for launch date',
    leaguePendingParticipantsProgress: 'Players joined: {current}/{target}',
    leaguePendingDateInfo: 'Launch date: {date}',

    // League Detail
    leaderboard: 'Leaderboard',
    matches: 'Matches',
    statistics: 'Statistics',
    leagueInfo: 'League Info',
    currentStandings: 'Current standings and player performance',
    player: 'Player',
    points: 'Points',
    predictions: 'Predictions',
    accuracy: 'Accuracy',
    trend: 'Trend',
    last: 'Last',
    topPerformers: 'Top Performers',
    leagueStats: 'League Stats',
    avgAccuracy: 'Avg Accuracy',
    totalCorrect: 'Total Correct',
    matchesPlayed: 'Matches Played',
    upcoming: 'Upcoming',
    completed: 'Completed',
    playerPredictions: 'Player Predictions',
    noPrediction: 'No prediction',
    investmentStrategy: 'Investment Strategy',
    howItWorks: 'How it works',
    investmentDescription: 'Your USDC is automatically invested using this strategy. At the end of the league, everyone gets their principal back and winners share the generated yield.',
    freeLeagueDescription: 'This is a practice league - no money involved, just fun predictions!',
    justForFun: 'Just for Fun',
    benoloCommissionHint: 'Benolo keeps a small performance fee to cover protocol operations and risk management.',
    strategyRiskNoteLabel: 'Risk note',
    leagueDetails: 'League Details',
    competition: 'Competition',
    region: 'Region',
    createdBy: 'Created by',
    status: 'Status',
    active: 'Active',
    canLeaveLeague: 'Can Leave',
    yesWithPenalty: 'Yes (with penalty)',
    no: 'No',
    readyToPredictTitle: 'Ready to make your predictions?',
    readyToPredictFree: 'Start making predictions and compete with your friends!',
    readyToPredictPaid: 'Your USDC is safely invested while you compete for the yield rewards.',
    makePredictions: 'Make Predictions',
    currentYield: 'Current Yield',
    totalPool: 'Total Pool',
    estRewards: 'Est. Rewards',
    glory: 'Glory',
    
    // Leave League functionality
    leaveLeague: 'Leave League',
    leaveLeagueWarning: 'Leave League with 10% Penalty',
    leaveLeagueConfirm: 'Are you sure you want to leave this league?',
    leaveLeagueDesc: 'You will get back 90% of your entry fee (10% penalty goes to prize pool)',
    leaveLeagueSuccess: 'Successfully left the league',
    confirmLeave: 'Confirm Leave',
    cancel: 'Cancel',
    
    // Yield information
    yieldGenerated: 'Yield Generated',
    yieldGeneratedDesc: 'Current yield generated by your USDC investment',
    totalYieldPool: 'Total Yield Pool',
    totalYieldPoolDesc: 'Total yield generated by all participants\' USDC',
    yieldStrategy: 'Investment is active',
    noYieldYet: 'No yield generated yet',
    dailyYield: 'Daily Yield',
    projectedYield: 'Projected Final Yield'
  },
  fr: {
    // App basics
    appName: 'PronoPool',
    protocol: 'Propulsé par le Protocole Benolo',
    benolo: 'Benolo',
    tagline: 'Pariez entre amis sans perdre d\'argent',
    safetyMessage: 'Votre argent est protégé à 100%',
    safetyNote: 'Avec les stratégies Benolo sécurisées',
    exploreApp: 'Explorer l\'App',
    getStarted: 'Commencer',
    loading: 'Chargement...',
    hello: 'Bon retour',
    logout: 'Déconnexion',
    
    // Navigation
    home: 'Accueil',
    dashboard: 'Dashboard',
    betting: 'Paris',
    wallet: 'Portefeuille',
    createLeague: 'Créer une Ligue',
    joinLeague: 'Rejoindre une Ligue',
    backToDashboard: 'Retour au Dashboard',
    backToHome: 'Retour à l\'Accueil'
  },
  es: {
    // App basics
    appName: 'PronoPool',
    protocol: 'Impulsado por el Protocolo Benolo',
    benolo: 'Benolo',
    tagline: 'Apuesta con amigos sin perder dinero',
    safetyMessage: 'Tu dinero está 100% protegido',
    safetyNote: 'Con estrategias seguras de Benolo',
    exploreApp: 'Explorar App',
    getStarted: 'Comenzar',
    loading: 'Cargando...',
    hello: 'Bienvenido de vuelta',
    logout: 'Cerrar sesión'
  },
  pt: {
    // App basics
    appName: 'PronoPool',
    protocol: 'Alimentado pelo Protocolo Benolo',
    benolo: 'Benolo',
    tagline: 'Aposte com amigos sem perder dinheiro',
    safetyMessage: 'Seu dinheiro está 100% protegido',
    safetyNote: 'Com estratégias seguras do Benolo',
    exploreApp: 'Explorar App',
    getStarted: 'Começar',
    loading: 'Carregando...',
    hello: 'Bem-vindo de volta',
    logout: 'Sair'
  },
  zh: {
    // App basics
    appName: 'PronoPool',
    protocol: '由 Benolo 协议驱动',
    benolo: 'Benolo',
    tagline: '与朋友投注而不会亏钱',
    safetyMessage: '您的资金100%受保护',
    safetyNote: '使用Benolo安全策略',
    exploreApp: '探索应用',
    getStarted: '开始',
    loading: '加载中...',
    hello: '欢迎回来',
    logout: '登出'
  }
} as const;

export type LanguageCode = keyof typeof translations;

// Function to get reward distributions with translations
export const getRewardDistributions = (language: LanguageCode = 'en') => {
  const t = (translations[language] || translations.en) as Record<string, string>;
  
  return [
    {
      id: 'winner-only',
      name: t.winnerOnly || 'Winner Takes All',
      description: t.winnerOnlyDesc || '1st place gets 100% of yields',
      icon: '🏆',
      split: [100],
      minParticipants: 2,
      example: '100% to winner'
    },
    {
      id: 'top-three',
      name: t.topThree || 'Top 3 Podium',
      description: t.topThreeDesc || 'Classic podium distribution',
      icon: '🥇',
      split: [60, 25, 15],
      minParticipants: 3,
      example: '60% / 25% / 15%'
    },
    {
      id: 'top-five',
      name: t.topFive || 'Top 5 Leaders',
      description: t.topFiveDesc || 'Rewards spread among top 5',
      icon: '🏅',
      split: [40, 25, 20, 10, 5],
      minParticipants: 5,
      example: '40% / 25% / 20% / 10% / 5%'
    },
    {
      id: 'top-ten-percent',
      name: t.topTenPercent || 'Top 10%',
      description: t.topTenPercentDesc || 'Proportional split among top 10%',
      icon: '⭐',
      split: [],
      minParticipants: 10,
      example: 'Proportional among top 10%'
    }
  ];
};

// Championships data
export const CHAMPIONSHIPS = [
  {
    id: 'premier-league',
    name: 'Premier League',
    country: 'England',
    logo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    season: '2024-25',
    active: true,
    endDate: '2025-05-25'
  },
  {
    id: 'champions-league',
    name: 'Champions League',
    country: 'Europe',
    logo: '🏆',
    season: '2024-25',
    active: true,
    endDate: '2025-05-31'
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    country: 'Spain',
    logo: '🇪🇸',
    season: '2024-25',
    active: true,
    endDate: '2025-05-18'
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    country: 'Italy',
    logo: '🇮🇹',
    season: '2024-25',
    active: true,
    endDate: '2025-05-25'
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    country: 'Germany',
    logo: '🇩🇪',
    season: '2024-25',
    active: true,
    endDate: '2025-05-17'
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    country: 'France',
    logo: '🇫🇷',
    season: '2024-25',
    active: true,
    endDate: '2025-05-24'
  },
  {
    id: 'nba',
    name: 'NBA',
    country: 'USA',
    logo: '🏀',
    season: '2024-25',
    active: true,
    endDate: '2025-06-22'
  },
  {
    id: 'nfl',
    name: 'NFL',
    country: 'USA',
    logo: '🏈',
    season: '2024',
    active: true,
    endDate: '2025-02-09'
  }
] as const;

// DeFi Strategies
export const DEFI_STRATEGIES = [
  {
    id: 'aave-usdc-v3',
    name: 'Safe Yield – Aave v3',
    description: 'USDC supplied to Aave v3 on Base. Battle-tested lending market with deep liquidity.',
    apyRange: '4.5–5.5%',
    icon: '🛡️',
    risk: 'Low',
    protocol: 'Aave v3',
    commissionBps: 1000,
    riskNote: 'Minimal smart contract risk, variable borrow demand.',
  },
  {
    id: 'morpho-blue-usdc',
    name: 'Balanced Yield – Morpho Blue',
    description: 'USDC vault routed to Morpho Blue on Base. Higher APY through meta-morpho optimisations.',
    apyRange: '6.5–8%',
    icon: '⚖️',
    risk: 'Medium',
    protocol: 'Morpho Blue',
    commissionBps: 1250,
    riskNote: 'Oracle and isolation risk; requires regular monitoring.',
  },
  {
    id: 'pendle-usdc-yield',
    name: 'Yield+ – Pendle PT/GLP',
    description: 'Deposits routed to Pendle PT/GLP pools on Base for leveraged yield farming.',
    apyRange: '10–14%',
    icon: '🚀',
    risk: 'High',
    protocol: 'Pendle',
    commissionBps: 1500,
    riskNote: 'Higher smart contract and market risk, subject to de-pegs.',
  },
] as const;
export type Championship = (typeof CHAMPIONSHIPS)[number];
export type DefiStrategy = (typeof DEFI_STRATEGIES)[number];

export type TranslationMap = typeof translations;
export type TranslationStrings = Record<string, string>;
