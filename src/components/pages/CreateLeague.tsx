"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Users,
  Shield,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Lock,
  Globe,
  Calendar,
  Coins,
  Wallet,
  Sparkles,
  Percent,
  Plus,
  Minus,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription } from "../ui/alert";
import { Switch } from "../ui/switch";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useAccount, useChainId } from "wagmi";
import { base } from "wagmi/chains";
import { keccak256, parseUnits, stringToHex } from "viem";
import { CHAMPIONSHIPS, DEFI_STRATEGIES, getRewardDistributions, type LanguageCode } from "@/data/content";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { leagueFactoryAddress, usdcTokenAddress } from "@/config/contracts";
import { useLeagueFactoryCreate } from "@/lib/wagmi/hooks/useLeagueFactoryCreate";
import { updateLeagueVaultAddress, deleteLeagueById } from "@/lib/supabase/leagues";

type LeagueVisibility = "public" | "private";
type DurationMode = "season" | "matchdays";
type LeagueType = "free" | "paid";

interface CustomDistributionEntry {
  rank: number;
  percentage: string;
}

interface CreateLeagueProps {
  onBack: () => void;
  onLeagueCreated: (league: any) => void;
  translations: any;
  language?: LanguageCode;
}

interface LeagueFormState {
  visibility: LeagueVisibility;
  name: string;
  description: string;
  championship: string;
  durationMode: DurationMode;
  durationMatchdays: string;
  startMode: "date" | "participants";
  startDate: string;
  startParticipantGoal: string;
  leagueType: LeagueType;
  entryFee: string;
  investmentStrategy: string;
  allowEarlyExit: boolean;
  earlyExitPenalty: string;
  rewardDistribution: string;
  customDistribution: CustomDistributionEntry[];
  commissionBps: number;
}

const defaultFormState: LeagueFormState = {
  visibility: "public",
  name: "",
  description: "",
  championship: "",
  durationMode: "season",
  durationMatchdays: "5",
  startMode: "date",
  startDate: "",
  startParticipantGoal: "8",
  leagueType: "free",
  entryFee: "50",
  investmentStrategy: "",
  allowEarlyExit: false,
  earlyExitPenalty: "10",
  rewardDistribution: "winner-only",
  customDistribution: [{ rank: 1, percentage: "100" }],
  commissionBps: 1000,
};

const numberFromString = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const formatBpsToPercent = (bps: number | null | undefined): string => {
  if (bps == null) {
    return "-";
  }
  const percent = bps / 100;
  return percent % 1 === 0 ? `${percent.toFixed(0)}%` : `${percent.toFixed(2)}%`;
};

const toDateTimeLocal = (isoString: string): string => {
  if (!isoString) {
    return "";
  }
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
};

const isFutureDate = (value: string) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return date.getTime() > Date.now();
};

export function CreateLeague({ onBack, onLeagueCreated, translations: t, language = "en" }: CreateLeagueProps) {
  const [formData, setFormData] = useState<LeagueFormState>(defaultFormState);
  const [currentStep, setCurrentStep] = useState<WizardStep>("visibility");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [walletCheckError, setWalletCheckError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { address } = useAccount();
  const chainId = useChainId();
  const { createLeague } = useLeagueFactoryCreate();

  useEffect(() => {
    const supabase = supabaseBrowserClient;
    if (!supabase) {
      return;
    }

    let active = true;

    const fetchWalletInfo = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        return;
      }

      if (!active) {
        return;
      }

      setUserId(session.user.id);

      const { data: walletRows, error } = await supabase
        .from("user_wallets")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);

      if (!active) {
        return;
      }

      if (error) {
        setWalletCheckError(error.message);
      } else {
        setHasWallet((walletRows?.length ?? 0) > 0);
      }
    };

    void fetchWalletInfo();

    return () => {
      active = false;
    };
  }, []);

  const steps = useMemo<WizardStep[]>(() => {
    const base: WizardStep[] = [
      "visibility",
      "name",
      "championship",
      "duration",
      "start",
      "type",
    ];

    if (formData.leagueType === "paid") {
      base.push("financials", "earlyExit", "distribution");
    }

    return base;
  }, [formData.leagueType]);

  useEffect(() => {
    if (!steps.includes(currentStep)) {
      setCurrentStep(steps[steps.length - 1] ?? "visibility");
    }
  }, [steps, currentStep]);

  const safeRewardDistributions = useMemo(() => getRewardDistributions(language) ?? [], [language]);

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  const championshipInfo = useMemo(
    () => CHAMPIONSHIPS.find((champ) => champ.id === formData.championship) ?? null,
    [formData.championship],
  );

  const selectedStrategy = useMemo(
    () => DEFI_STRATEGIES.find((strategy) => strategy.id === formData.investmentStrategy) ?? null,
    [formData.investmentStrategy],
  );

  useEffect(() => {
    if (formData.leagueType !== "paid") {
      return;
    }
    if (selectedStrategy && formData.commissionBps !== selectedStrategy.commissionBps) {
      setFormData((prev) => ({
        ...prev,
        commissionBps: selectedStrategy.commissionBps,
      }));
    }
  }, [selectedStrategy, formData.leagueType, formData.commissionBps]);

  const customDistributionTotal = useMemo(() =>
    formData.customDistribution.reduce((sum, entry) => {
      const value = Number(entry.percentage);
      if (!Number.isFinite(value)) {
        return sum;
      }
      return sum + value;
    }, 0),
  [formData.customDistribution]);

  const handleFieldChange = <Key extends keyof LeagueFormState>(field: Key, value: LeagueFormState[Key]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCustomDistributionChange = (index: number, field: "rank" | "percentage", value: string) => {
    setFormData((prev) => ({
      ...prev,
      customDistribution: prev.customDistribution.map((entry, i) =>
        i === index
          ? {
              ...entry,
              [field]: field === "rank" ? Number(value) || entry.rank : value,
            }
          : entry,
      ),
    }));
  };

  const addCustomDistributionEntry = () => {
    setFormData((prev) => ({
      ...prev,
      customDistribution: [...prev.customDistribution, { rank: prev.customDistribution.length + 1, percentage: "0" }],
    }));
  };

  const removeCustomDistributionEntry = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      customDistribution: prev.customDistribution.filter((_, i) => i !== index),
    }));
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      void handleSubmit();
    }
  };

  const handleBackStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    } else {
      onBack();
    }
  };

  const validateCustomDistribution = () => {
    if (formData.rewardDistribution !== "custom") {
      return true;
    }

    const entries = formData.customDistribution;
    if (entries.length === 0) {
      return false;
    }

    const total = entries.reduce((sum, entry) => {
      const value = Number(entry.percentage);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    if (Math.abs(total - 100) > 0.01) {
      return false;
    }

    return entries.every((entry) => entry.rank > 0 && Number(entry.percentage) >= 0);
  };

  const canProceed = () => {
    switch (currentStep) {
      case "visibility":
        return true;
      case "name":
        return formData.name.trim().length > 0;
      case "championship":
        return formData.championship !== "";
      case "duration":
        if (formData.durationMode === "matchdays") {
          const value = numberFromString(formData.durationMatchdays);
          return Boolean(value && value > 0);
        }
        return true;
      case "start":
        if (formData.startMode === "date") {
          if (!formData.startDate.trim()) {
            return false;
          }
          return isFutureDate(formData.startDate);
        }

        {
          const value = numberFromString(formData.startParticipantGoal);
          return Boolean(value && value >= 2);
        }
      case "type":
        if (formData.leagueType === "paid" && hasWallet === false) {
          return false;
        }
        return true;
      case "financials":
        if (formData.leagueType !== "paid") {
          return true;
        }
        return Boolean(numberFromString(formData.entryFee) && selectedStrategy);
      case "earlyExit":
        if (formData.leagueType !== "paid") {
          return true;
        }
        if (!formData.allowEarlyExit) {
          return true;
        }
        if (!formData.earlyExitPenalty.trim()) {
          return false;
        }
        const penaltyValue = numberFromString(formData.earlyExitPenalty);
        return penaltyValue != null && penaltyValue >= 0 && penaltyValue <= 100;
      case "distribution":
        if (formData.leagueType !== "paid") {
          return true;
        }
        if (formData.rewardDistribution === "custom") {
          return validateCustomDistribution();
        }
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    const supabase = supabaseBrowserClient;
    if (!supabase) {
      setSubmitError("Supabase n'est pas configuré.");
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        setSubmitError("Votre session a expiré. Veuillez vous reconnecter.");
        return;
      }

      if (formData.leagueType === "paid") {
        if (!leagueFactoryAddress || !usdcTokenAddress) {
          setSubmitError("Configuration manquante pour les contrats Benolo. Contacte l'équipe.");
          return;
        }

        if (!selectedStrategy) {
          setSubmitError("Sélectionne une stratégie d'investissement pour ta ligue.");
          setCurrentStep("financials");
          return;
        }

        if (!address) {
          setSubmitError("Connecte ton wallet pour créer une ligue payante.");
          return;
        }

        if (chainId !== base.id) {
          setSubmitError("Passe ton wallet sur Base (chainId 8453) pour continuer.");
          return;
        }
      }

      if (formData.leagueType === "paid" && hasWallet === false) {
        setSubmitError("Un wallet EVM doit être lié à votre compte pour créer une ligue payante.");
        setCurrentStep("type");
        return;
      }

      const entryFee = formData.leagueType === "paid" ? numberFromString(formData.entryFee) ?? 0 : 0;
      const earlyExitPenaltyRate =
        formData.leagueType === "paid" && formData.allowEarlyExit
          ? Number(formData.earlyExitPenalty)
          : 0;
      if (
        formData.leagueType === "paid" &&
        formData.allowEarlyExit &&
        (Number.isNaN(earlyExitPenaltyRate) || earlyExitPenaltyRate < 0 || earlyExitPenaltyRate > 100)
      ) {
        setSubmitError("La pénalité doit être comprise entre 0 et 100%.");
        setCurrentStep("earlyExit");
        return;
      }

      const commissionBps = formData.leagueType === "paid" ? formData.commissionBps ?? 1000 : null;

      if (formData.leagueType === "paid" && entryFee <= 0) {
        setSubmitError("Veuillez saisir un montant d'entrée valide.");
        setCurrentStep("financials");
        return;
      }

      if (formData.leagueType === "paid" && formData.rewardDistribution === "custom" && !validateCustomDistribution()) {
        setSubmitError("La distribution personnalisée doit totaliser 100%.");
        setCurrentStep("distribution");
        return;
      }

      const startCondition = formData.startMode === "participants" ? "participants" : "date";
      const startMinParticipantsValue = formData.startMode === "participants"
        ? numberFromString(formData.startParticipantGoal)
        : null;

      if (startCondition === "participants" && (!startMinParticipantsValue || startMinParticipantsValue < 2)) {
        setSubmitError(t.startParticipantGoalError || "Le nombre minimal de joueurs doit être supérieur ou égal à 2.");
        setCurrentStep("start");
        return;
      }

      const startAtISO = formData.startMode === "date" && formData.startDate
        ? new Date(formData.startDate).toISOString()
        : null;

      if (startCondition === "date" && !startAtISO) {
        setSubmitError(t.startDateMissing || "Renseigne une date de démarrage valide.");
        setCurrentStep("start");
        return;
      }

      const selectedChampionship = CHAMPIONSHIPS.find((champ) => champ.id === formData.championship);
      const signupDeadlineISO = startCondition === "date" ? startAtISO : null;

      const nowIso = new Date().toISOString();
      let status = "pending";
      let startedAt: string | null = null;

      if (startCondition === "date" && startAtISO && new Date(startAtISO).getTime() <= Date.now()) {
        status = "active";
        startedAt = nowIso;
      } else if (startCondition === "participants" && startMinParticipantsValue != null && startMinParticipantsValue <= 1) {
        status = "active";
        startedAt = nowIso;
      }

      const computedEndAt =
        formData.durationMode === "season" && selectedChampionship?.endDate
          ? new Date(selectedChampionship.endDate).toISOString()
          : null;

      const customDistributionPayload =
        formData.leagueType === "paid" && formData.rewardDistribution === "custom"
          ? formData.customDistribution.map((entry) => ({
              rank: entry.rank,
              percentage: Number(entry.percentage),
            }))
          : null;

      const { data, error } = await supabase
        .from("leagues")
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          championship: formData.championship || null,
          creator_id: session.user.id,
          entry_fee: entryFee,
          currency: "USDC",
          is_public: formData.visibility === "public",
          status,
          strategy: selectedStrategy?.id ?? null,
          max_members: null,
          can_leave: formData.leagueType === "paid" && formData.allowEarlyExit,
          reward_distribution: formData.leagueType === "paid" ? formData.rewardDistribution : "none",
          signup_deadline: signupDeadlineISO,
          duration_type: formData.durationMode,
          duration_value: formData.durationMode === "matchdays" ? Number(formData.durationMatchdays) : null,
          end_at: computedEndAt,
          start_condition: startCondition,
          start_min_participants: startMinParticipantsValue,
          start_at: startAtISO,
          started_at: startedAt,
          is_paid: formData.leagueType === "paid",
          investment_protocol: selectedStrategy?.name ?? null,
          investment_apy_range: selectedStrategy?.apyRange ?? null,
          investment_risk_level: selectedStrategy?.risk ?? null,
          early_exit_penalty_rate: earlyExitPenaltyRate,
          reward_distribution_custom: customDistributionPayload,
          strategy_id: selectedStrategy?.id ?? null,
          commission_bps: commissionBps,
        })
        .select(
          "id, code, name, description, entry_fee, currency, status, reward_distribution, reward_distribution_custom, can_leave, strategy, strategy_id, commission_bps, max_members, championship, creator_id, signup_deadline, duration_type, duration_value, end_at, is_public, is_paid, investment_protocol, investment_apy_range, investment_risk_level, early_exit_penalty_rate, start_condition, start_min_participants, start_at, started_at, vault_address",
        )
        .single();

      if (error) {
        throw error;
      }

      let leagueRecord = data;

      if (formData.leagueType === "paid" && leagueFactoryAddress && usdcTokenAddress && selectedStrategy) {
        const exitPenaltyBpsValue = formData.allowEarlyExit
          ? Math.round(Number(formData.earlyExitPenalty) * 100)
          : 0;
        const strategyBytes32 = keccak256(stringToHex(selectedStrategy.id));
        const leagueIdBytes32 = keccak256(stringToHex(leagueRecord.id));
        const entryAmount = parseUnits(formData.entryFee || "0", 6);

        try {
          const { vaultAddress } = await createLeague({
            factoryAddress: leagueFactoryAddress,
            params: {
              leagueId: leagueIdBytes32,
              creator: address!,
              asset: usdcTokenAddress,
              entryAmount,
              exitPenaltyBps: exitPenaltyBpsValue,
              commissionBps: commissionBps ?? 1000,
              strategyId: strategyBytes32,
              canEarlyExit: formData.allowEarlyExit,
            },
          });

          await updateLeagueVaultAddress(leagueRecord.id, vaultAddress);
          leagueRecord = {
            ...leagueRecord,
            vault_address: vaultAddress,
          };
        } catch (onChainError) {
          await deleteLeagueById(leagueRecord.id).catch(() => {});
          throw onChainError;
        }
      }

      onLeagueCreated(leagueRecord);
    } catch (error: any) {
      setSubmitError(error.message || "Erreur lors de la création de la ligue");
    } finally {
      setLoading(false);
    }
  };

  const renderVisibilityStep = () => (
    <div className="grid gap-6 md:grid-cols-2">
      {[
        {
          value: "public" as LeagueVisibility,
          title: t.publicLeagueTitle || "Ligue publique",
          description:
            t.publicLeagueDescription ||
            "Ta ligue sera visible dans la liste des ligues ouvertes et accessible à tous avec ou sans code.",
          icon: <Globe className="h-6 w-6 text-emerald-500" />,
        },
        {
          value: "private" as LeagueVisibility,
          title: t.privateLeagueTitle || "Ligue privée",
          description:
            t.privateLeagueDescription ||
            "La ligue est invisible dans la recherche, seuls les joueurs avec le code d'invitation pourront la rejoindre.",
          icon: <Lock className="h-6 w-6 text-slate-600" />,
        },
      ].map((option) => {
        const selected = formData.visibility === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleFieldChange("visibility", option.value)}
            className={`flex h-full flex-col items-start gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
              selected ? "border-slate-900 bg-slate-50 shadow-lg" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3 text-slate-900">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">{option.icon}</span>
              <div className="text-xl font-semibold">{option.title}</div>
            </div>
            <p className="text-sm text-slate-600">{option.description}</p>
            {option.value === "private" && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                {t.privateLeagueHint || "Accès par code uniquement"}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderNameStep = () => (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          {t.whatLeagueName || "Quel est le nom de ta ligue ?"}
        </h2>
        <p className="text-lg text-slate-600">
          {t.leagueNameDesc || "Choisis un nom mémorable qui représente ton groupe"}
        </p>
      </div>
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <Input
          value={formData.name}
          onChange={(event) => handleFieldChange("name", event.target.value)}
          placeholder="Benolo Premier League"
          className="py-6 text-center text-2xl"
        />
        <Textarea
          value={formData.description}
          onChange={(event) => handleFieldChange("description", event.target.value)}
          placeholder={t.leagueDescriptionPlaceholder || "Décris ta ligue, les règles, etc."}
          className="min-h-[120px]"
        />
      </div>
    </div>
  );

  const renderChampionshipStep = () => (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          {t.whichChampionship || "Sur quel championnat ?"}
        </h2>
        <p className="text-lg text-slate-600">
          {t.championshipDesc || "Sélectionne la compétition sur laquelle vous vous affrontez"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {CHAMPIONSHIPS.map((championship) => {
          const selected = formData.championship === championship.id;
          return (
            <button
              key={championship.id}
              type="button"
              onClick={() => handleFieldChange("championship", championship.id)}
              className={`flex h-full flex-col items-start gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
                selected ? "border-slate-900 bg-slate-50 shadow-lg" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3 text-slate-900">
                <span className="text-3xl">{championship.logo}</span>
                <div>
                  <div className="text-xl font-semibold">{championship.name}</div>
                  <div className="text-sm text-slate-500">{championship.country}</div>
                </div>
              </div>
              <div className="flex w-full items-center justify-between rounded-xl bg-slate-100/80 p-3 text-xs text-slate-500">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t.season || "Saison"}: {championship.season}
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  {t.ends || "Fin"}: {new Date(championship.endDate).toLocaleDateString()}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDurationStep = () => (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          {t.durationQuestion || "Durée de la ligue"}
        </h2>
        <p className="text-lg text-slate-600">
          {t.durationDescription || "Choisis si la ligue couvre toute la saison ou seulement quelques journées"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => handleFieldChange("durationMode", "season")}
          className={`flex h-full flex-col items-start gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
            formData.durationMode === "season"
              ? "border-slate-900 bg-slate-50 shadow-lg"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-emerald-500" />
            <div className="text-xl font-semibold text-slate-900">
              {t.fullSeason || "Toute la saison"}
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {t.fullSeasonDesc || "La ligue se termine à la date officielle de fin du championnat."}
          </p>
          {championshipInfo && (
            <div className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700">
              <span className="font-medium">{championshipInfo.name}</span> · {t.ends || "Fin"}
              {": "}
              {new Date(championshipInfo.endDate).toLocaleDateString()}
            </div>
          )}
        </button>
        <div
          className={`flex h-full flex-col gap-4 rounded-2xl border-2 p-6 transition-all ${
            formData.durationMode === "matchdays"
              ? "border-slate-900 bg-slate-50 shadow-lg"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <button
            type="button"
            onClick={() => handleFieldChange("durationMode", "matchdays")}
            className="flex items-center gap-3 text-left text-xl font-semibold text-slate-900"
          >
            <Users className="h-6 w-6 text-blue-500" />
            {t.matchdayDuration || "Nombre de journées"}
          </button>
          <p className="text-sm text-slate-600">
            {t.matchdayDurationDesc || "Choisis un nombre de journées pour limiter la ligue (idéal pour des challenges courts)."}
          </p>
          <div className="flex items-center gap-3">
            <Label htmlFor="matchdays" className="text-sm text-slate-500">
              {t.matchdayCount || "Nombre de journées"}
            </Label>
            <Input
              id="matchdays"
              type="number"
              min={1}
              value={formData.durationMatchdays}
              onChange={(event) => handleFieldChange("durationMatchdays", event.target.value)}
              disabled={formData.durationMode !== "matchdays"}
              className="max-w-[120px]"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStartStep = () => {
    const isDateMode = formData.startMode === "date";

    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-4xl font-bold text-slate-900">
            {t.leagueStartQuestion || "Quand démarre la ligue ?"}
          </h2>
          <p className="text-lg text-slate-600">
            {t.leagueStartQuestionDesc || "Définis le déclencheur qui ouvrira les pronostics."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                startMode: "date",
                startDate: prev.startDate || toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
              }));
            }}
            className={`flex h-full flex-col gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
              isDateMode ? "border-slate-900 bg-slate-50 shadow-lg" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3 text-slate-900">
              <Calendar className="h-6 w-6 text-emerald-500" />
              <div className="text-xl font-semibold">
                {t.leagueStartAfterDate || "Après une date précise"}
              </div>
            </div>
            <p className="text-sm text-slate-600">
              {t.leagueStartAfterDateDesc || "Les inscriptions restent ouvertes jusqu'à la date programmée; les paris s'ouvrent ensuite automatiquement."}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                startMode: "participants",
              }));
            }}
            className={`flex h-full flex-col gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
              !isDateMode ? "border-slate-900 bg-slate-50 shadow-lg" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3 text-slate-900">
              <Users className="h-6 w-6 text-blue-500" />
              <div className="text-xl font-semibold">
                {t.leagueStartAfterParticipants || "Après un nombre de joueurs"}
              </div>
            </div>
            <p className="text-sm text-slate-600">
              {t.leagueStartAfterParticipantsDesc || "Les pronostics s'ouvrent lorsque le seuil de joueurs est atteint."}
            </p>
          </button>
        </div>

        {isDateMode ? (
          <div className="mx-auto flex max-w-xl flex-col gap-3">
            <Label htmlFor="start-date">{t.startDateLabel || "Date de démarrage"}</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={formData.startDate}
              onChange={(event) => handleFieldChange("startDate", event.target.value)}
              className="py-4"
            />
            <p className="text-xs text-slate-500">
              {t.startDateHint || "Cette date clôture les inscriptions et ouvre les paris."}
            </p>
            {formData.startDate && !isFutureDate(formData.startDate) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t.startDatePast || "Choisis une date à venir."}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col gap-3">
            <Label htmlFor="start-participants">
              {t.startParticipantGoalLabel || "Nombre de joueurs requis"}
            </Label>
            <Input
              id="start-participants"
              type="number"
              min={2}
              value={formData.startParticipantGoal}
              onChange={(event) => handleFieldChange("startParticipantGoal", event.target.value)}
              className="py-4"
            />
            <p className="text-xs text-slate-500">
              {t.startParticipantGoalHint || "Le créateur compte comme un joueur."}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderTypeStep = () => (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          {t.leagueType || "Type de ligue"}
        </h2>
        <p className="text-lg text-slate-600">
          {t.leagueTypeDesc || "Choisis entre une ligue gratuite ou payante (avec smart contract)."}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <button
          type="button"
          onClick={() => handleFieldChange("leagueType", "free")}
          className={`flex h-full flex-col gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
            formData.leagueType === "free"
              ? "border-slate-900 bg-slate-50 shadow-lg"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3 text-slate-900">
            <Users className="h-6 w-6 text-blue-500" />
            <div className="text-xl font-semibold">{t.freeLeague || "Ligue gratuite"}</div>
          </div>
          <p className="text-sm text-slate-600">
            {t.freeLeagueDesc || "Idéale pour des ligues entre amis sans enjeu financier."}
          </p>
          <Badge className="bg-blue-100 text-blue-700" variant="secondary">
            {t.justForFun || "Juste pour le fun"}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => handleFieldChange("leagueType", "paid")}
          className={`flex h-full flex-col gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
            formData.leagueType === "paid"
              ? "border-slate-900 bg-slate-50 shadow-lg"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3 text-slate-900">
            <Coins className="h-6 w-6 text-emerald-500" />
            <div className="text-xl font-semibold">{t.paidLeague || "Ligue payante"}</div>
          </div>
          <p className="text-sm text-slate-600">
            {t.paidLeagueDesc || "Chaque joueur dépose des USDC et les gains proviennent des intérêts générés."}
          </p>
          <Badge className="bg-emerald-500/10 text-emerald-600" variant="secondary">
            {t.rewardsIncluded || "Récompenses Benolo"}
          </Badge>
          {hasWallet === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <div className="flex items-center gap-2 font-medium">
                <Wallet className="h-4 w-4" /> {t.walletRequired || "Wallet requis"}
              </div>
              <p className="mt-2">
                {t.walletRequiredDesc || "Connecte un wallet EVM dans ton profil avant de créer une ligue payante."}
              </p>
            </div>
          )}
          {hasWallet && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle className="h-4 w-4" /> {t.walletLinked || "Wallet connecté"}
              </div>
              <p className="mt-2">
                {t.walletLinkedDesc || "Tu pourras signer la création du smart contract après la configuration."}
              </p>
            </div>
          )}
          {walletCheckError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {walletCheckError}
            </div>
          )}
        </button>
      </div>
    </div>
  );

  const renderFinancialsStep = () => (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          {t.financialParameters || "Paramètres financiers"}
        </h2>
        <p className="text-lg text-slate-600">
          {t.financialParametersDesc || "Définis la mise par joueur et la stratégie d'investissement Benolo."}
        </p>
      </div>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <Label htmlFor="entryFee">{t.entryFee || "Mise par joueur (USDC)"}</Label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <Input
              id="entryFee"
              type="number"
              min={1}
              value={formData.entryFee}
              onChange={(event) => handleFieldChange("entryFee", event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-700">
            {t.chooseStrategy || "Choisis la stratégie d'investissement"}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {DEFI_STRATEGIES.map((strategy) => {
              const selected = formData.investmentStrategy === strategy.id;
              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => handleFieldChange("investmentStrategy", strategy.id)}
                  className={`flex h-full flex-col gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                    selected ? "border-emerald-500 bg-emerald-50 shadow-lg" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{strategy.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{strategy.name}</div>
                      <div className="text-xs text-slate-500">{strategy.protocol}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/80 p-3 text-xs text-slate-600">
                    <span className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-emerald-500" /> APY: {strategy.apyRange}
                    </span>
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-500" /> {strategy.risk}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{strategy.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {selectedStrategy && (
          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Benolo commission</span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-700">
                {formatBpsToPercent(formData.commissionBps)}
              </span>
            </div>
            <p>
              {t.benoloCommissionHint ||
                "Cette commission est prélevée sur le rendement généré avant distribution aux joueurs."}
            </p>
            {selectedStrategy.riskNote && (
              <p className="text-xs text-emerald-700/80">
                {t.strategyRiskNoteLabel || "Note"}
                {": "}
                {selectedStrategy.riskNote}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderEarlyExitStep = () => (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          {t.earlyExitQuestion || "Sortie anticipée"}
        </h2>
        <p className="text-lg text-slate-600">
          {t.earlyExitDescription || "Permets aux joueurs de quitter la ligue avant la fin avec une pénalité."}
        </p>
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t.allowEarlyExit || "Autoriser la sortie anticipée"}
              </p>
              <p className="text-xs text-slate-500">
                {t.allowEarlyExitDesc || "Les joueurs récupèrent leur mise moins la pénalité définie."}
              </p>
            </div>
            <Switch
              checked={formData.allowEarlyExit}
              onCheckedChange={(checked) => handleFieldChange("allowEarlyExit", checked)}
            />
          </div>
          {formData.allowEarlyExit && (
            <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> {t.penaltySettings || "Pénalité"}
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="penalty" className="text-xs uppercase tracking-wide">
                  {t.penaltyPercentage || "% de pénalité"}
                </Label>
                <Input
                  id="penalty"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.earlyExitPenalty}
                  onChange={(event) => handleFieldChange("earlyExitPenalty", event.target.value)}
                  className="max-w-[120px]"
                />
                <span className="text-xs text-slate-500">
                  {t.penaltyHint || "Ce pourcentage est rebasculé dans le pot de rendement."}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDistributionStep = () => (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          {t.rewardDistribution || "Distribution des intérêts"}
        </h2>
        <p className="text-lg text-slate-600">
          {t.rewardDistributionDesc || "Choisis comment les intérêts générés seront partagés entre les joueurs."}
        </p>
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <RadioGroup value={formData.rewardDistribution} onValueChange={(value) => handleFieldChange("rewardDistribution", value)}>
          <div className="grid gap-4 md:grid-cols-2">
            {safeRewardDistributions.map((distribution) => (
              <label
                key={distribution.id}
                className={`flex h-full cursor-pointer flex-col gap-3 rounded-2xl border-2 p-4 ${
                  formData.rewardDistribution === distribution.id
                    ? "border-emerald-500 bg-emerald-50 shadow-lg"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={distribution.id} />
                  <div>
                    <p className="font-semibold text-slate-900">{distribution.name}</p>
                    <p className="text-xs text-slate-500">{distribution.description}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
                  {distribution.example}
                </div>
              </label>
            ))}
            <label
              className={`flex h-full cursor-pointer flex-col gap-3 rounded-2xl border-2 p-4 ${
                formData.rewardDistribution === "custom"
                  ? "border-emerald-500 bg-emerald-50 shadow-lg"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="custom" />
                <div>
                  <p className="font-semibold text-slate-900">
                    {t.customSplit || "Répartition personnalisée"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.customSplitDesc || "Définis ta propre distribution (le total doit faire 100%)."}
                  </p>
                </div>
              </div>
              {formData.rewardDistribution === "custom" && (
                <div className="space-y-3 rounded-xl bg-white/80 p-3">
                  {formData.customDistribution.map((entry, index) => (
                    <div key={`custom-dist-${index}`} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={entry.rank}
                        onChange={(event) => handleCustomDistributionChange(index, "rank", event.target.value)}
                        className="w-20"
                      />
                      <span className="text-sm text-slate-600">{t.rankLabel || "Place"}</span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={entry.percentage}
                        onChange={(event) => handleCustomDistributionChange(index, "percentage", event.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">%</span>
                      {formData.customDistribution.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeCustomDistributionEntry(index)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div>
                      {t.total || "Total"}: {customDistributionTotal}%
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomDistributionEntry}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {t.addRank || "Ajouter"}
                    </Button>
                  </div>
                  {Math.abs(customDistributionTotal - 100) > 0.01 && (
                    <p className="text-xs text-red-600">
                      {t.customSplitError || "La somme doit être égale à 100%."}
                    </p>
                  )}
                </div>
              )}
            </label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case "visibility":
        return renderVisibilityStep();
      case "name":
        return renderNameStep();
      case "championship":
        return renderChampionshipStep();
      case "duration":
        return renderDurationStep();
      case "start":
        return renderStartStep();
      case "type":
        return renderTypeStep();
      case "financials":
        return renderFinancialsStep();
      case "earlyExit":
        return renderEarlyExitStep();
      case "distribution":
        return renderDistributionStep();
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBackStep} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t.backToDashboard || "Retour"}
        </Button>
        <Badge className="bg-emerald-500/10 text-emerald-600">
          {t.autoRevenueTitle || "Benolo Yield Automation"}
        </Badge>
      </div>

      <Card className="border-2 border-slate-200 bg-white shadow-lg">
        <CardHeader className="text-center pb-8">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900">
              <Trophy className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="mx-auto mb-6 max-w-md">
            <div className="mb-2 flex justify-between text-sm text-slate-500">
              <span>
                {t.step || "Étape"} {currentStepIndex + 1}/{steps.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            {t.createNewLeague || "Créer une ligue"}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {t.stepByStepConfiguration || "Configure ta ligue pas à pas"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 px-8 pb-10">
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          <div className="min-h-[420px]">{renderStepContent()}</div>
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleBackStep}
              className="gap-2"
              disabled={currentStepIndex === 0}
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back || "Retour"}
            </Button>
            <Button
              type="button"
              onClick={handleNext}
              disabled={loading || !canProceed()}
              className="gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t.creatingLeague || "Création..."}
                </span>
              ) : currentStepIndex === steps.length - 1 ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t.createLeague || "Créer la ligue"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t.next || "Suivant"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type WizardStep =
  | "visibility"
  | "name"
  | "championship"
  | "duration"
  | "start"
  | "type"
  | "financials"
  | "earlyExit"
  | "distribution";
