"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { logLeagueTransaction } from "@/lib/supabase/leagues";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Shield, Users2, Plus, Trash2, Copy, Lock, Settings, Trophy, DollarSign, History } from "lucide-react";
import type { LeagueMatch } from "@/types/app";
import type { Route } from "next";
import { useAccount } from "wagmi";
import { isAddress, type Address, type Hex } from "viem";
import { useLeagueVaultActions, type WinnerShareInput } from "@/lib/wagmi/hooks/useLeagueVaultActions";

interface AdminProfileRow {
  id: string;
  display_name: string;
  role: string;
  country_code?: string | null;
  preferred_language?: string | null;
  created_at?: string;
  avatar_url?: string | null;
}

const ROLE_OPTIONS = [
  { label: "Utilisateur", value: "user" },
  { label: "Administrateur", value: "admin" },
];

interface AdminLeagueRow {
  id: string;
  name: string | null;
  code: string | null;
  status: string | null;
  vault_address: string | null;
  strategy_id: string | null;
  commission_bps: number | null;
  creator_id: string;
}

interface LeagueTransactionRow {
  id: string;
  league_id: string | null;
  action: string;
  tx_hash: string;
  wallet_address: string | null;
  chain_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = supabaseBrowserClient;
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matchLeagueId, setMatchLeagueId] = useState<string>("");
  const [matchHomeTeam, setMatchHomeTeam] = useState("");
  const [matchAwayTeam, setMatchAwayTeam] = useState("");
  const [matchStartAt, setMatchStartAt] = useState("");
  const [matchStatus, setMatchStatus] = useState("upcoming");
  const [matchList, setMatchList] = useState<LeagueMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [leagueOptions, setLeagueOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [managedLeagues, setManagedLeagues] = useState<AdminLeagueRow[]>([]);
  const [matchEdits, setMatchEdits] = useState<Record<string, { home: string; away: string; status: string }>>({});
  const [transactions, setTransactions] = useState<LeagueTransactionRow[]>([]);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const loadLeagues = useCallback(async () => {
    if (!supabase) {
      setLeagueOptions([]);
      setManagedLeagues([]);
      return;
    }

    const { data: leagueRows, error: leaguesError } = await supabase
      .from("leagues")
      .select("id, name, code, status, vault_address, strategy_id, commission_bps, creator_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (leaguesError) {
      setManagedLeagues([]);
      return;
    }

    const rows = leagueRows ?? [];
    setLeagueOptions(
      rows.map((row) => ({
        id: row.id,
        name: row.name ?? row.id,
        code: row.code ?? "",
      })),
    );
    setManagedLeagues(rows as AdminLeagueRow[]);
  }, [supabase]);

  const loadTransactions = useCallback(async () => {
    if (!supabase) {
      setTransactions([]);
      return;
    }

    setTransactionsError(null);
    const { data, error } = await supabase
      .from("league_transactions")
      .select("id, league_id, action, tx_hash, wallet_address, chain_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setTransactionsError(error.message);
      setTransactions([]);
    } else {
      setTransactions((data ?? []) as LeagueTransactionRow[]);
    }
  }, [supabase]);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) {
        setError("Supabase n\u2019est pas configuré.");
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        router.replace("/" as Route);
        return;
      }

      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (meError) {
        setError(meError.message);
        setLoading(false);
        return;
      }

      if (!me || me.role !== "admin") {
        router.replace("/" as Route);
        return;
      }

      setCurrentUserId(me.id);

      const { data: rows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, role, country_code, preferred_language, created_at, avatar_url")
        .order("created_at", { ascending: false });

      if (profilesError) {
        setError(profilesError.message);
      } else {
        setProfiles(rows ?? []);
      }

      await Promise.all([loadLeagues(), loadTransactions()]);

      setLoading(false);
    };

    void fetchData();
  }, [router, supabase, loadLeagues, loadTransactions]);

  const handleRoleChange = async (profileId: string, newRole: string) => {
    if (!supabase) {
      return;
    }
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setProfiles((prev) =>
        prev.map((row) =>
          row.id === profileId
            ? {
                ...row,
                role: newRole,
              }
            : row,
        ),
      );
      setSuccess("Rôle mis à jour.");
    }
  };

  const fetchMatches = async (leagueId: string) => {
    if (!supabase || !leagueId) {
      setMatchList([]);
      return;
    }

    setLoadingMatches(true);
    setMatchesError(null);
    const { data, error: fetchError } = await supabase
      .from("league_matches")
      .select("id, home_team, away_team, start_at, status, home_score, away_score")
      .eq("league_id", leagueId)
      .order("start_at", { ascending: true });

      if (fetchError) {
        setMatchesError(fetchError.message);
        setMatchList([]);
      } else {
        const mapped = (data ?? []).map((row) => ({
          id: row.id,
          leagueId,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
          startAt: row.start_at,
          status: row.status,
          homeScore: row.home_score,
          awayScore: row.away_score,
        } as LeagueMatch));
        setMatchList(mapped);
        const edits: Record<string, { home: string; away: string; status: string }> = {};
        mapped.forEach((match) => {
          edits[match.id] = {
            home: match.homeScore != null ? String(match.homeScore) : "",
            away: match.awayScore != null ? String(match.awayScore) : "",
            status: match.status ?? "upcoming",
          };
        });
        setMatchEdits(edits);
      }

    setLoadingMatches(false);
  };

  useEffect(() => {
    if (matchLeagueId) {
      void fetchMatches(matchLeagueId);
    } else {
      setMatchList([]);
      setMatchEdits({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchLeagueId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Chargement des utilisateurs…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Administration</h1>
            <p className="text-sm text-muted-foreground">
              {"Gère les utilisateurs Benolo et leurs rôles."}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/profile" as Route)}>
            Retour au profil
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Utilisateurs</CardTitle>
            <CardDescription>
              {"Liste des membres inscrits. Modifie leurs rôles pour leur donner accès à l\u2019administration."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun utilisateur trouvé. Demande aux premiers joueurs de se connecter.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Identité</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead>Langue</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {profile.display_name || profile.id}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {profile.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                          {profile.role === "admin" ? (
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" /> Admin
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Users2 className="h-3 w-3" /> User
                            </span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{profile.country_code?.toUpperCase() || "—"}</TableCell>
                      <TableCell>{profile.preferred_language?.toUpperCase() || "—"}</TableCell>
                      <TableCell>
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={profile.role}
                          onValueChange={(value) => handleRoleChange(profile.id, value)}
                          disabled={profile.id === currentUserId}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Choisir un rôle" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Gestion on-chain des ligues</CardTitle>
          <CardDescription>
            Exécute les actions smart contract (Base) pour les ligues payantes Benolo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {managedLeagues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune ligue récente à afficher. Crée ou importe une ligue payante pour activer les actions on-chain.
            </p>
          ) : (
            managedLeagues.map((league) => (
              <VaultActionsCard
                key={league.id}
                league={league}
                onRefresh={async () => {
                  await Promise.all([loadLeagues(), loadTransactions()]);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Journal des transactions on-chain</CardTitle>
          <CardDescription>
            Historique des actions exécutées via le smart contract (dernières 30 entrées).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {transactionsError && (
            <Alert variant="destructive">
              <AlertDescription>{transactionsError}</AlertDescription>
            </Alert>
          )}
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun événement enregistré pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Ligue</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-slate-900">
                        <span className="flex items-center gap-2">
                          <History className="h-4 w-4 text-slate-500" />
                          {tx.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="font-mono text-xs">
                          {tx.tx_hash.slice(0, 10)}…
                        </code>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.league_id ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.wallet_address ?? "—"}
                      </TableCell>
                      <TableCell>{tx.chain_id ?? "—"}</TableCell>
                      <TableCell>
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Gestion des matchs</CardTitle>
            <CardDescription>
              {`Ajoute ou supprime des matchs pour une ligue spécifique.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="league_id">ID de la ligue</Label>
                {leagueOptions.length > 0 ? (
                  <Select value={matchLeagueId} onValueChange={setMatchLeagueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une ligue" />
                    </SelectTrigger>
                    <SelectContent>
                      {leagueOptions.map((league) => (
                        <SelectItem key={league.id} value={league.id}>
                          {league.name} ({league.code || league.id.slice(0, 6)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="league_id"
                    value={matchLeagueId}
                    onChange={(event) => setMatchLeagueId(event.target.value)}
                    placeholder="UUID de la ligue"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Copie l&apos;ID depuis Supabase ou depuis l&apos;écran de confirmation de création.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_at">Date et heure</Label>
                <Input
                  id="start_at"
                  type="datetime-local"
                  value={matchStartAt}
                  onChange={(event) => setMatchStartAt(event.target.value)}
                  disabled={!matchLeagueId}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="home_team">Équipe domicile</Label>
                <Input
                  id="home_team"
                  value={matchHomeTeam}
                  onChange={(event) => setMatchHomeTeam(event.target.value)}
                  placeholder="Ex: Paris SG"
                  disabled={!matchLeagueId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="away_team">Équipe extérieure</Label>
                <Input
                  id="away_team"
                  value={matchAwayTeam}
                  onChange={(event) => setMatchAwayTeam(event.target.value)}
                  placeholder="Ex: Marseille"
                  disabled={!matchLeagueId}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={matchStatus} onValueChange={setMatchStatus} disabled={!matchLeagueId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">À venir</SelectItem>
                    <SelectItem value="live">En direct</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="match_notes">Notes</Label>
                <Textarea
                  id="match_notes"
                  placeholder="Optionnel"
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMatchHomeTeam("");
                  setMatchAwayTeam("");
                  setMatchStartAt("");
                  setMatchStatus("upcoming");
                }}
                disabled={!matchLeagueId}
              >
                Réinitialiser
              </Button>
              <Button
                type="button"
                className="gap-2"
                onClick={async () => {
                  if (!supabase || !matchLeagueId || !matchHomeTeam || !matchAwayTeam || !matchStartAt) {
                    setMatchesError("Merci de renseigner tous les champs obligatoires.");
                    return;
                  }
                  setMatchesError(null);
                  const { error: insertError } = await supabase
                    .from("league_matches")
                    .insert({
                      league_id: matchLeagueId,
                      home_team: matchHomeTeam,
                      away_team: matchAwayTeam,
                      start_at: new Date(matchStartAt).toISOString(),
                      status: matchStatus,
                    });
                  if (insertError) {
                    setMatchesError(insertError.message);
                  } else {
                    setMatchHomeTeam("");
                    setMatchAwayTeam("");
                    setMatchStartAt("");
                    setMatchStatus("upcoming");
                    await fetchMatches(matchLeagueId);
                    setSuccess("Match ajouté.");
                  }
                }}
                disabled={!matchLeagueId}
              >
                <Plus className="h-4 w-4" />
                Ajouter un match
              </Button>
            </div>

            <Separator />

            {matchLeagueId && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Matches existants</h3>
                {matchesError && (
                  <Alert variant="destructive">
                    <AlertDescription>{matchesError}</AlertDescription>
                  </Alert>
                )}
                {loadingMatches ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des matchs…
                  </div>
                ) : matchList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun match n&apos;est enregistré pour cette ligue.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {matchList.map((match) => (
                      <div
                        key={match.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {match.homeTeam} vs {match.awayTeam}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(match.startAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="secondary">{match.status ?? "upcoming"}</Badge>
                          </div>
                          <div className="grid gap-2 md:grid-cols-4">
                            <div>
                              <Label className="text-xs">Score domicile</Label>
                              <Input
                                value={matchEdits[match.id]?.home ?? ""}
                                onChange={(event) =>
                                  setMatchEdits((prev) => ({
                                    ...prev,
                                    [match.id]: {
                                      ...prev[match.id],
                                      home: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="—"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Score extérieur</Label>
                              <Input
                                value={matchEdits[match.id]?.away ?? ""}
                                onChange={(event) =>
                                  setMatchEdits((prev) => ({
                                    ...prev,
                                    [match.id]: {
                                      ...prev[match.id],
                                      away: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="—"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Statut</Label>
                              <Select
                                value={matchEdits[match.id]?.status ?? match.status ?? "upcoming"}
                                onValueChange={(value) =>
                                  setMatchEdits((prev) => ({
                                    ...prev,
                                    [match.id]: {
                                      ...prev[match.id],
                                      status: value,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="upcoming">À venir</SelectItem>
                                  <SelectItem value="live">En direct</SelectItem>
                                  <SelectItem value="completed">Terminé</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                className="w-full"
                                onClick={async () => {
                                  if (!supabase) {
                                    return;
                                  }
                                  const edit = matchEdits[match.id];
                                  const homeScore = edit?.home ? Number(edit.home) : null;
                                  const awayScore = edit?.away ? Number(edit.away) : null;
                                  if (
                                    (edit?.home && !Number.isInteger(Number(edit.home))) ||
                                    (edit?.away && !Number.isInteger(Number(edit.away)))
                                  ) {
                                    setMatchesError("Les scores doivent être des entiers.");
                                    return;
                                  }
                                  const { error: updateError } = await supabase
                                    .from("league_matches")
                                    .update({
                                      home_score: homeScore,
                                      away_score: awayScore,
                                      status: edit?.status ?? match.status,
                                    })
                                    .eq("id", match.id);
                                  if (updateError) {
                                    setMatchesError(updateError.message);
                                  } else {
                                    await fetchMatches(matchLeagueId);
                                    setSuccess("Match mis à jour.");
                                  }
                                }}
                              >
                                Mettre à jour
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              void navigator.clipboard.writeText(match.id);
                              setSuccess("ID du match copié.");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                            Copier l&apos;ID
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-red-600 hover:text-red-700"
                            onClick={async () => {
                              if (!supabase) {
                                return;
                              }
                              const { error: deleteError } = await supabase
                                .from("league_matches")
                                .delete()
                                .eq("id", match.id);
                              if (deleteError) {
                                setMatchesError(deleteError.message);
                              } else {
                                await fetchMatches(matchLeagueId);
                                setSuccess("Match supprimé.");
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface VaultActionsCardProps {
  league: AdminLeagueRow;
  onRefresh: () => Promise<void>;
}

function VaultActionsCard({ league, onRefresh }: VaultActionsCardProps) {
  const { address: connectedAddress } = useAccount();
  const vaultAddress = (league.vault_address ?? null) as Address | null;
  const { lock, settle, setWinners, openClaims, claimCommission } = useLeagueVaultActions(vaultAddress);

  const [settleData, setSettleData] = useState<string>("0x");
  const [winnersRaw, setWinnersRaw] = useState<string>("[]");
  const [commissionTarget, setCommissionTarget] = useState<string>(connectedAddress ?? "");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasVault = Boolean(vaultAddress);

  const normaliseHexInput = (value: string): Hex => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "0x";
    }
    if (trimmed.startsWith("0x")) {
      return trimmed as Hex;
    }
    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      return (`0x${trimmed}`) as Hex;
    }
    throw new Error("Les données settle doivent être un hexadécimal valide");
  };

  const parseWinnersInput = (): WinnerShareInput[] => {
    const raw = winnersRaw.trim();
    if (!raw) {
      throw new Error("Renseigne la liste des gagnants (JSON)");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (jsonError) {
      throw new Error("JSON des gagnants invalide");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("La liste des gagnants doit contenir au moins une entrée");
    }
    const mapped: WinnerShareInput[] = parsed.map((item: any) => {
      const account: string | undefined = item.account ?? item.address;
      const share = Number(item.shareBps ?? item.share ?? item.bps);
      if (!account || !isAddress(account)) {
        throw new Error("Adresse de gagnant invalide");
      }
      if (!Number.isFinite(share) || share <= 0) {
        throw new Error("Les parts doivent être supérieures à 0");
      }
      return { account: account as Address, shareBps: Math.round(share) };
    });
    const total = mapped.reduce((sum, entry) => sum + entry.shareBps, 0);
    if (total !== 10_000) {
      throw new Error("La somme des parts doit être exactement 10000 bps (100%)");
    }
    return mapped;
  };

  const runAction = async (label: string, action: () => Promise<Hex | void>) => {
    if (!hasVault) {
      setError("Aucune adresse de vault enregistrée pour cette ligue.");
      return;
    }
    setLoadingAction(label);
    setFeedback(null);
    setError(null);
    try {
      const txHash = await action();
      if (typeof txHash === "string") {
        setFeedback(`Transaction envoyée : ${txHash.slice(0, 10)}…`);
        await logLeagueTransaction({
          leagueId: league.id,
          action: label,
          txHash,
          walletAddress: connectedAddress ?? undefined,
          chainId: 8453,
          metadata: { vaultAddress },
        });
      } else {
        setFeedback("Action exécutée");
      }
      await onRefresh();
    } catch (err: any) {
      setError(err?.message ?? "Action impossible");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLock = () => runAction("lock", () => lock());

  const handleSettle = () =>
    runAction("settle", () => {
      const hex = normaliseHexInput(settleData);
      return settle(hex);
    });

  const handleSetWinners = () =>
    runAction("setWinners", () => {
      const winners = parseWinnersInput();
      return setWinners(winners);
    });

  const handleOpenClaims = () => runAction("openClaims", () => openClaims());

  const handleClaimCommission = () =>
    runAction("claimCommission", () => {
      const recipient = commissionTarget.trim();
      if (!isAddress(recipient)) {
        throw new Error("Adresse de commission invalide");
      }
      return claimCommission(recipient as Address);
    });

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {league.name ?? league.id}
          </h3>
          <p className="text-xs font-mono text-muted-foreground">
            {league.id}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Statut : {league.status ?? "inconnu"}
            </span>
            <span className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Stratégie : {league.strategy_id ?? "—"}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Commission : {(league.commission_bps ?? 0) / 100}%
            </span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground md:items-end">
          <span className="font-mono">
            Vault : {hasVault ? league.vault_address : "non déployé"}
          </span>
          <span className="font-mono">Creator : {league.creator_id}</span>
        </div>
      </div>

      {feedback && (
        <p className="mt-3 text-sm text-emerald-600">{feedback}</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Argument `settle` (hexadecimal)</Label>
          <Input
            value={settleData}
            onChange={(event) => setSettleData(event.target.value)}
            placeholder="0x"
            disabled={!hasVault || loadingAction !== null}
          />
          <Button
            size="sm"
            className="gap-2"
            disabled={!hasVault || loadingAction !== null}
            onClick={handleSettle}
          >
            {loadingAction === "settle" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Lancer `settle`
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Commission – destinataire</Label>
          <Input
            value={commissionTarget}
            onChange={(event) => setCommissionTarget(event.target.value)}
            placeholder="0x..."
            disabled={!hasVault || loadingAction !== null}
          />
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            disabled={!hasVault || loadingAction !== null}
            onClick={handleClaimCommission}
          >
            {loadingAction === "claimCommission" ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            Récolter la commission
          </Button>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Gagnants (JSON [{"account","shareBps"}])</Label>
          <Textarea
            value={winnersRaw}
            onChange={(event) => setWinnersRaw(event.target.value)}
            rows={4}
            disabled={!hasVault || loadingAction !== null}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-2"
              disabled={!hasVault || loadingAction !== null}
              onClick={handleSetWinners}
            >
              {loadingAction === "setWinners" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Enregistrer les gagnants
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!hasVault || loadingAction !== null}
              onClick={handleOpenClaims}
            >
              {loadingAction === "openClaims" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Ouvrir les claims
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={!hasVault || loadingAction !== null}
          onClick={handleLock}
        >
          {loadingAction === "lock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Verrouiller (lock)
        </Button>
      </div>
    </div>
  );
}
