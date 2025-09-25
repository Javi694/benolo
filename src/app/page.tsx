"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dashboard } from "@/components/Dashboard";
import { JoinLeague } from "@/components/pages/JoinLeague";
import { CreateLeague } from "@/components/pages/CreateLeague";
import { HomePage } from "@/components/pages/HomePage";
import { LeagueCreated } from "@/components/pages/LeagueCreated";
import { LeagueDetail } from "@/components/pages/LeagueDetail";
import { MatchBetting } from "@/components/MatchBetting";
import { Wallet } from "@/components/Wallet";
import {
  ArrowLeft,
  ChevronDown,
  Coins,
  Flame,
  Globe,
  Home as HomeIcon,
  Menu,
  Moon,
  Plus,
  Shield,
  Sparkles,
  Star,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";

import { translations, type LanguageCode } from "@/data/content";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import type {
  CreatedLeagueSummary,
  DemoUser,
  LeagueSummary,
} from "@/types/app";

type ViewKey =
  | "home"
  | "dashboard"
  | "wallet"
  | "betting"
  | "create-league"
  | "join-league"
  | "league-created"
  | "league-detail";

const AUTH_REQUIRED_VIEWS: ViewKey[] = [
  "dashboard",
  "wallet",
  "betting",
  "create-league",
  "join-league",
  "league-created",
  "league-detail",
];

const isLanguageCode = (value: string): value is LanguageCode =>
  value in translations;

export default function Page() {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewKey>("home");
  const [selectedLeague, setSelectedLeague] = useState<LeagueSummary | null>(
    null,
  );
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [createdLeague, setCreatedLeague] = useState<CreatedLeagueSummary | null>(
    null,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [requestedView, setRequestedView] = useState<ViewKey | null>(null);
  const hasAutoRedirected = useRef(false);
  const supabase = supabaseBrowserClient;

  useEffect(() => {
    const savedDarkMode = window.localStorage.getItem("benolo-dark-mode");
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode));
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setDarkMode(prefersDark);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("benolo-dark-mode", JSON.stringify(darkMode));

    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  const syncUserFromSession = useCallback(async (activeSession: Session | null) => {
    if (!supabase) {
      return;
    }

    if (!activeSession) {
      setUser(null);
      return;
    }

    const baseName =
      (activeSession.user.user_metadata?.display_name as string | undefined) ||
      (activeSession.user.user_metadata?.full_name as string | undefined) ||
      activeSession.user.email ||
      "Player";

    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, preferred_language, role")
      .eq("id", activeSession.user.id)
      .maybeSingle();

    const displayName = profileData?.display_name ?? baseName;
    const preferredLanguage = profileData?.preferred_language;
    if (preferredLanguage && isLanguageCode(preferredLanguage)) {
      setLanguage(preferredLanguage);
    }

    setUser({
      id: activeSession.user.id,
      name: displayName,
      email: activeSession.user.email ?? "",
      access_token: activeSession.access_token,
      leagues: ["PL2025", "CHAMP01"],
      totalStaked: 1250,
      totalEarnings: 187.5,
      activeBets: 8,
      role: profileData?.role ?? "user",
    });
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      syncUserFromSession(data.session ?? null);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        syncUserFromSession(newSession ?? null);
        setIsLoading(false);
      },
    );

    return () => {
      listener?.subscription.unsubscribe();
      setIsLoading(false);
    };
  }, [supabase, syncUserFromSession]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (requestedView) {
      setCurrentView(requestedView);
      setRequestedView(null);
      hasAutoRedirected.current = true;
      setAuthDialogOpen(false);
      return;
    }

    if (!hasAutoRedirected.current && currentView === "home") {
      setCurrentView("dashboard");
      hasAutoRedirected.current = true;
    }

    setAuthDialogOpen(false);
  }, [user, requestedView, currentView]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleLanguageChange = (newLanguage: LanguageCode) => {
    setLanguage(newLanguage);
  };

  const t = useMemo(() => (translations?.[language] ?? translations.en) as Record<string, string>, [language]);

  const handleOAuthSignIn = useCallback(async (provider: "google" | "facebook") => {
    if (!supabase) {
      setAuthError("Supabase n'est pas configuré.");
      return;
    }

    setAuthError(null);
    setAuthDialogOpen(false);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }, [supabase]);

  const openAuthDialog = useCallback(() => {
    setAuthDialogOpen(true);
  }, []);

  const requireAuth = useCallback((view: ViewKey) => {
    if (!user) {
      setRequestedView(view);
      setAuthError(null);
      setAuthDialogOpen(true);
      return false;
    }
    return true;
  }, [user]);

  const handleLogin = useCallback(() => {
    openAuthDialog();
  }, [openAuthDialog]);

  const handleLogout = async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    setCurrentView("home");
    setMobileMenuOpen(false);
    setRequestedView(null);
    hasAutoRedirected.current = false;
  };

  const handleGoHome = () => {
    setCurrentView("home");
    setSelectedLeague(null);
    setMobileMenuOpen(false);
    hasAutoRedirected.current = false;
  };

  const handleCreateLeague = () => {
    setSelectedLeague(null);
    setCurrentView("create-league");
    setMobileMenuOpen(false);
    if (!requireAuth("create-league")) {
      return;
    }
  };

  const handleJoinLeague = () => {
    setSelectedLeague(null);
    setCurrentView("join-league");
    setMobileMenuOpen(false);
    if (!requireAuth("join-league")) {
      return;
    }
  };

  const handleGoAdmin = () => {
    router.push("/admin");
    setMobileMenuOpen(false);
  };

  const handleViewLeague = (league: LeagueSummary) => {
    setSelectedLeague(league);
    setCurrentView("league-detail");
    setMobileMenuOpen(false);
    if (!requireAuth("league-detail")) {
      return;
    }
  };

  const handleViewWallet = () => {
    setCurrentView("wallet");
    setMobileMenuOpen(false);
    if (!requireAuth("wallet")) {
      return;
    }
  };

  const mapLeagueRowToSummary = useCallback((row: any, participantCount = 0): LeagueSummary => {
    const deriveEndDate = () => {
      if (row.end_at) {
        return row.end_at;
      }
      const base = row.signup_deadline ?? row.start_at ?? row.created_at;
      if (row.duration_type === "matchdays" && row.duration_value && row.duration_value > 0) {
        const baseDate = new Date(base);
        const approxDays = Math.max(Number(row.duration_value), 1) * 7;
        baseDate.setDate(baseDate.getDate() + approxDays);
        return baseDate.toISOString();
      }
      return row.end_at ?? row.created_at;
    };

    const startCondition = row.start_condition ?? "date";
    const startAt = row.start_at ?? null;
    const startMinParticipants = row.start_min_participants != null
      ? Number(row.start_min_participants)
      : null;

    const effectiveStartDate = startAt ?? row.signup_deadline ?? null;
    let hasStarted = false;

    if (startCondition === "participants") {
      hasStarted = startMinParticipants != null && participantCount >= startMinParticipants;
    } else if (effectiveStartDate) {
      hasStarted = new Date(effectiveStartDate).getTime() <= Date.now();
    } else {
      hasStarted = true;
    }

    return {
      id: row.id,
      name: row.name,
      code: row.code ?? undefined,
      description: row.description ?? null,
      entryFee: row.entry_fee != null ? Number(row.entry_fee) : undefined,
      currency: row.currency ?? undefined,
      status: row.status ?? (hasStarted ? "active" : "pending"),
      rewardDistribution: row.reward_distribution ?? undefined,
      rewardDistributionCustom: row.reward_distribution_custom ?? undefined,
      canLeave: row.can_leave ?? undefined,
      strategy: row.strategy ?? undefined,
      strategyId: row.strategy_id ?? undefined,
      commissionBps: row.commission_bps ?? undefined,
      vaultAddress: row.vault_address ?? undefined,
      maxParticipants: row.max_members ?? null,
      championship: row.championship ?? null,
      creatorId: row.creator_id ?? undefined,
      participants: participantCount,
      isPublic: row.is_public ?? undefined,
      isPaid: row.is_paid ?? undefined,
      signupDeadline: row.signup_deadline ?? null,
      durationType: row.duration_type ?? null,
      durationValue: row.duration_value ?? null,
      endDate: deriveEndDate(),
      startCondition,
      startAt,
      startMinParticipants,
      startedAt: row.started_at ?? null,
      hasStarted,
      investmentProtocol: row.investment_protocol ?? null,
      investmentApyRange: row.investment_apy_range ?? null,
      investmentRiskLevel: row.investment_risk_level ?? null,
      earlyExitPenaltyRate: row.early_exit_penalty_rate ?? null,
    };
  }, []);

  const handleViewBetting = (
    leagueInput?: LeagueSummary | string | null,
  ) => {
    if (leagueInput && typeof leagueInput === "object") {
      setSelectedLeague(leagueInput);
    } else if (leagueInput && typeof leagueInput === "string") {
      setSelectedLeague({ id: leagueInput, name: "Benolo League" });
    } else if (!leagueInput) {
      setSelectedLeague(null);
    }

    setCurrentView("betting");
    setMobileMenuOpen(false);

    if (!requireAuth("betting")) {
      return;
    }

    if (leagueInput && typeof leagueInput === "string") {
      if (!supabase) {
        return;
      }
      void (async () => {
        const { data, error } = await supabase
          .from("leagues")
          .select(
            "id, code, name, description, entry_fee, currency, status, reward_distribution, reward_distribution_custom, can_leave, strategy, strategy_id, commission_bps, max_members, championship, creator_id, created_at, end_at, is_public, is_paid, signup_deadline, duration_type, duration_value, investment_protocol, investment_apy_range, investment_risk_level, early_exit_penalty_rate, start_condition, start_min_participants, start_at, started_at, vault_address",
          )
          .eq("id", leagueInput)
          .maybeSingle();

        if (error || !data) {
          setSelectedLeague({ id: leagueInput, name: "Benolo League" });
          return;
        }

        const { count } = await supabase
          .from("league_members")
          .select("id", { count: "exact", head: true })
          .eq("league_id", data.id);

        setSelectedLeague(mapLeagueRowToSummary(data, count ?? 0));
      })();
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setSelectedLeague(null);
    setCreatedLeague(null);
    setMobileMenuOpen(false);
    if (!requireAuth("dashboard")) {
      return;
    }
  };

  const handleLeagueCreated = (leagueData: any) => {
    const startCondition = leagueData.start_condition ?? "date";
    const startMinParticipants = leagueData.start_min_participants != null
      ? Number(leagueData.start_min_participants)
      : null;
    const startAt = leagueData.start_at ?? null;
    const signupDeadline = leagueData.signup_deadline ?? null;

    let hasStarted = false;
    if (startCondition === "participants") {
      hasStarted = startMinParticipants != null && 1 >= startMinParticipants;
    } else if (startAt) {
      hasStarted = new Date(startAt).getTime() <= Date.now();
    } else if (signupDeadline) {
      hasStarted = new Date(signupDeadline).getTime() <= Date.now();
    }

    const status = leagueData.status ?? (hasStarted ? "active" : "pending");

    const normalised: CreatedLeagueSummary = {
      id: leagueData.id,
      name: leagueData.name,
      code: leagueData.code,
      description: leagueData.description,
      entryFee: leagueData.entry_fee ?? 0,
      strategy: leagueData.strategy ?? null,
      strategyId: leagueData.strategy_id ?? null,
      commissionBps: leagueData.commission_bps ?? null,
      vaultAddress: leagueData.vault_address ?? null,
      rewardDistribution: leagueData.reward_distribution ?? 'winner-only',
      maxParticipants: leagueData.max_members ?? null,
      canLeave: leagueData.can_leave ?? false,
      status,
      currency: leagueData.currency ?? 'USDC',
      championship: leagueData.championship ?? null,
      participants: 1,
      isPublic: leagueData.is_public ?? true,
      isPaid: leagueData.is_paid ?? false,
      signupDeadline,
      durationType: leagueData.duration_type ?? null,
      durationValue: leagueData.duration_value ?? null,
      startCondition,
      startAt,
      startMinParticipants,
      startedAt: leagueData.started_at ?? null,
      hasStarted,
      investmentProtocol: leagueData.investment_protocol ?? null,
      investmentApyRange: leagueData.investment_apy_range ?? null,
      investmentRiskLevel: leagueData.investment_risk_level ?? null,
      earlyExitPenaltyRate: leagueData.early_exit_penalty_rate ?? null,
      rewardDistributionCustom: leagueData.reward_distribution_custom ?? null,
    } as any;
    setCreatedLeague(normalised);
    setCurrentView('league-created');
  };

  const getBackgroundClass = () =>
    darkMode
      ? "bg-slate-900"
      : "bg-gradient-to-br from-slate-50 via-white to-slate-100";

  const getNavClass = () =>
    darkMode
      ? "bg-slate-800/90 border-slate-700/60"
      : "bg-white/90 border-slate-200/60 backdrop-blur-xl";

  const getTextClass = () => (darkMode ? "text-slate-100" : "text-slate-900");

  const navigationButtons: Array<{
    icon: ReactNode;
    label: string;
    action: () => void;
    view: ViewKey;
  }> = [
    {
      icon: <HomeIcon className="h-4 w-4" />,
      label: t.home || "Home",
      action: handleGoHome,
      view: "home",
    },
    {
      icon: <Trophy className="h-4 w-4" />,
      label: t.dashboard || "Dashboard",
      action: handleBackToDashboard,
      view: "dashboard",
    },
    {
      icon: <Target className="h-4 w-4" />,
      label: t.betting || "Betting",
      action: () => handleViewBetting(),
      view: "betting",
    },
    {
      icon: <Zap className="h-4 w-4" />,
      label: t.wallet || "Wallet",
      action: handleViewWallet,
      view: "wallet",
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: t.joinLeague || "Join League",
      action: handleJoinLeague,
      view: "join-league",
    },
    {
      icon: <Plus className="h-4 w-4" />,
      label: t.createLeague || "Create League",
      action: handleCreateLeague,
      view: "create-league",
    },
  ];

  if (user?.role === "admin") {
    navigationButtons.push({
      icon: <Users className="h-4 w-4" />,
      label: "Admin",
      action: handleGoAdmin,
      view: "home",
    });
  }

  const renderAuthRequired = (view: ViewKey) => {
    const messages: Partial<Record<ViewKey, { title: string; description: string }>> = {
      dashboard: {
        title: t.loginRequiredDashboard || "Connectez-vous pour accéder au tableau de bord",
        description:
          t.loginRequiredDashboardDesc ||
          "Accédez à vos ligues, classements et performances personnelles après authentification.",
      },
      betting: {
        title: t.loginRequiredBetting || "Connexion requise pour pronostiquer",
        description:
          t.loginRequiredBettingDesc ||
          "Identifie-toi pour enregistrer tes pronostics et suivre les matchs de ta ligue.",
      },
      wallet: {
        title: t.loginRequiredWallet || "Connecte ton compte pour voir ton wallet",
        description:
          t.loginRequiredWalletDesc ||
          "Les informations financières et le suivi des rendements sont disponibles après connexion.",
      },
      "create-league": {
        title: t.loginRequiredCreate || "Connexion requise pour créer une ligue",
        description:
          t.loginRequiredCreateDesc ||
          "Crée des ligues, configure les paramètres et invite tes amis une fois connecté.",
      },
      "join-league": {
        title: t.loginRequiredJoin || "Connecte-toi pour rejoindre une ligue",
        description:
          t.loginRequiredJoinDesc ||
          "Retrouve les ligues publiques ou saisis un code d'invitation après authentification.",
      },
      "league-detail": {
        title: t.loginRequiredLeague || "Connexion requise pour voir la ligue",
        description:
          t.loginRequiredLeagueDesc ||
          "Les détails des ligues Benolo sont réservés aux membres authentifiés.",
      },
      "league-created": {
        title: t.loginRequiredLeague || "Connexion requise pour voir la ligue",
        description:
          t.loginRequiredLeagueDesc ||
          "Les détails des ligues Benolo sont réservés aux membres authentifiés.",
      },
    };

    const { title, description } =
      messages[view] ?? {
        title: t.loginRequired || "Connexion requise",
        description:
          t.loginRequiredDesc ||
          "Connecte-toi pour accéder à cette fonctionnalité Benolo.",
      };

    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-3xl border border-emerald-100/60 bg-white/80 p-10 text-center shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/60">
        <Shield className="h-10 w-10 text-emerald-500" />
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              setRequestedView(view);
              setAuthError(null);
              setAuthDialogOpen(true);
            }}
            className="gap-2 rounded-full bg-emerald-500 px-5 text-white shadow hover:bg-emerald-600"
          >
            <Sparkles className="h-4 w-4" />
            {t.login || "Se connecter"}
          </Button>
          <Button
            variant="outline"
            onClick={handleGoHome}
            className="rounded-full border-emerald-200 px-5"
          >
            {t.backToHome || "Retour à l'accueil"}
          </Button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <div className="simple-spinner h-12 w-12" />
          <p className="text-sm text-muted-foreground">{t.loading || "Loading..."}</p>
        </div>
      );
    }

    if (!user && AUTH_REQUIRED_VIEWS.includes(currentView)) {
      return renderAuthRequired(currentView);
    }

    switch (currentView) {
      case "home":
        return (
          <HomePage
            translations={t}
            onCreateLeague={handleCreateLeague}
            onJoinLeague={handleJoinLeague}
            onGetStarted={() => {
              if (user) {
                setCurrentView("dashboard");
              } else {
                openAuthDialog();
              }
            }}
            language={language}
          />
        );
      case "dashboard":
        return user ? (
          <Dashboard
            key={`dashboard-${language}`}
            user={user}
            onCreateLeague={handleCreateLeague}
            onJoinLeague={handleJoinLeague}
            onViewLeague={handleViewLeague}
            onViewWallet={handleViewWallet}
            onViewBetting={handleViewBetting}
            translations={t}
            language={language}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle>{t.hello || "Welcome back"}</CardTitle>
                <CardDescription>
                  {t.getStarted || "Get started with Benolo Protocol"}
                </CardDescription>
              </CardHeader>
              <CardContent>
              <div className="flex flex-col gap-4">
                  <Button onClick={openAuthDialog} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {"Choisir un mode de connexion"}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Connectez votre compte Benolo pour synchroniser vos ligues
                    et retrouver vos ligues favorites.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case "wallet":
        return (
          <Wallet
            user={user}
            onBack={handleBackToDashboard}
            translations={t}
            language={language}
          />
        );
      case "betting":
        return (
          <MatchBetting
            user={user}
            selectedLeague={selectedLeague}
            onBack={handleBackToDashboard}
            translations={t}
            language={language}
          />
        );
      case "create-league":
        return (
          <CreateLeague
            onBack={handleBackToDashboard}
            onLeagueCreated={handleLeagueCreated}
            translations={t}
            language={language}
          />
        );
      case "join-league":
        return (
          <JoinLeague
            onBack={handleBackToDashboard}
            onViewLeague={handleViewLeague}
            translations={t}
            language={language}
          />
        );
      case "league-created":
        return (
          <LeagueCreated
            onBack={handleBackToDashboard}
            createdLeague={createdLeague}
            translations={t}
            language={language}
          />
        );
      case "league-detail":
        if (!selectedLeague) {
          return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 text-slate-400" />
              <p>{t.leagueNotFound || "League not found."}</p>
              <Button onClick={handleBackToDashboard} variant="secondary">
                {t.backToDashboard || "Back to dashboard"}
              </Button>
            </div>
          );
        }

        return (
          <LeagueDetail
            league={selectedLeague}
            user={user}
            onBack={handleBackToDashboard}
            translations={t}
            language={language}
            onViewBetting={handleViewBetting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Se connecter à Benolo</DialogTitle>
            <DialogDescription>
              {"Choisis ton fournisseur d\u2019authentification préféré."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className="gap-2 rounded-full bg-[#4285F4] px-4 py-3 text-white shadow hover:bg-[#357ae8]"
              onClick={() => handleOAuthSignIn("google")}
            >
              Continuer avec Google
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-full bg-[#1877F2] px-4 py-3 text-white shadow hover:bg-[#0f63d1]"
              onClick={() => handleOAuthSignIn("facebook")}
            >
              Continuer avec Meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className={`${getBackgroundClass()} min-h-screen`}>
        <header
          className={`sticky top-0 z-50 border-b ${getNavClass()} ${getTextClass()}`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg">
                <Trophy className="h-6 w-6 text-white" />
                <span className="absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-emerald-600 shadow">
                  <Shield className="h-3 w-3" />
                  Benolo
                </span>
              </div>
            </div>

            <nav className="hidden items-center gap-2 lg:flex">
              {navigationButtons.map((button) => (
                <Button
                  key={button.view}
                  variant={currentView === button.view ? "default" : "ghost"}
                  onClick={button.action}
                  className={`gap-2 rounded-full px-4 py-2 ${
                    currentView === button.view
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "hover:bg-emerald-500/10"
                  }`}
                >
                  {button.icon}
                  <span>{button.label}</span>
                </Button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-[140px] rounded-full border border-emerald-200 bg-white/5 px-4 py-2 text-sm shadow-none">
                  <SelectValue placeholder="Language" />
                  <ChevronDown className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-emerald-100 bg-white/95 shadow-xl">
                  {Object.keys(translations).map((lang) => (
                    <SelectItem key={lang} value={lang} className="rounded-lg">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="uppercase">{lang}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="rounded-full border border-emerald-200/50 bg-white/10 backdrop-blur"
              >
                {darkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              <div className="hidden items-center gap-3 lg:flex">
                {user ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full border-emerald-200 bg-white/5" asChild>
                        <Link href="/profile">Profil</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="rounded-full border-emerald-200 bg-white/5"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t.logout || "Logout"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    onClick={openAuthDialog}
                    className="gap-2 rounded-full bg-emerald-500 px-4 text-white shadow-md hover:bg-emerald-600"
                  >
                    <Sparkles className="h-4 w-4" />
                    {"Se connecter"}
                  </Button>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-emerald-100/40 bg-white/90 px-4 py-4 shadow-lg dark:bg-slate-900/95 lg:hidden">
              <div className="flex flex-col gap-4">
                {navigationButtons.map((button) => (
                  <Button
                    key={`mobile-${button.view}`}
                    variant={currentView === button.view ? "default" : "ghost"}
                    onClick={button.action}
                    className={`justify-start gap-3 rounded-xl ${
                      currentView === button.view
                        ? "bg-emerald-500 text-white"
                        : "hover:bg-emerald-500/10"
                    }`}
                  >
                    {button.icon}
                    <span>{button.label}</span>
                  </Button>
                ))}

                <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {t.safetyMessage || "Your money is protected"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.safetyNote || "With Benolo safe strategies"}
                    </p>
                  </div>
                  <Shield className="h-5 w-5 text-emerald-500" />
                </div>

                {user ? (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="rounded-full border-emerald-200" asChild>
                      <Link href="/profile">Profil</Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      className="rounded-full border-emerald-200"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t.logout || "Logout"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={openAuthDialog}
                    className="gap-2 rounded-full bg-emerald-500 text-white"
                  >
                    <Sparkles className="h-4 w-4" />
                    {"Se connecter"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-7xl px-4 py-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-sm backdrop-blur dark:bg-slate-800/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Star className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-600">
                  {t.tagline || "Bet with friends without losing money"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.safetyNote || "With Benolo safe investment strategies"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="gap-2 rounded-full bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
                DeFi Yield Active
              </Badge>
              <Badge className="gap-2 rounded-full bg-emerald-500/10 text-emerald-600">
                <Coins className="h-4 w-4" />
                100% Principal Protected
              </Badge>
              <Badge className="gap-2 rounded-full bg-emerald-500/10 text-emerald-600">
                <Flame className="h-4 w-4" />
                Yield Sharing Enabled
              </Badge>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>
                {t.safetyMessage || "Your money is 100% protected with Benolo"}
              </span>
            </div>
            {authError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {authError}
              </div>
            )}
            {renderContent()}
          </div>
        </main>

        <footer className="border-t border-emerald-100/40 bg-white/70 py-6 text-sm text-muted-foreground dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-emerald-600">
              <Sparkles className="h-4 w-4" />
              Benolo Protocol
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span>© {new Date().getFullYear()} Benolo. All rights reserved.</span>
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Secure DeFi Infrastructure
              </span>
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Play Fair. Earn Yield.
              </span>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
