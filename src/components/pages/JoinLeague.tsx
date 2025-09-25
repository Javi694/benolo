"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ArrowLeft, Trophy, Users, Search, Copy, Plus, Star, Loader2 } from 'lucide-react';
import { CHAMPIONSHIPS, DEFI_STRATEGIES } from '@/data/content';
import { supabaseBrowserClient } from '@/lib/supabase/client';
import { hasLeagueStarted } from '@/lib/leagues/start';

interface JoinLeagueProps {
  translations: any;
  onBack: () => void;
  onViewLeague: (league: any) => void;
  language?: string;
}

type LeagueRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  entry_fee: number | null;
  max_members: number | null;
  status: string | null;
  championship: string | null;
  strategy: string | null;
  can_leave: boolean | null;
  end_at: string | null;
  creator_id: string;
  created_at: string;
  is_public: boolean | null;
  is_paid: boolean | null;
  signup_deadline: string | null;
  duration_type: string | null;
  duration_value: number | null;
  start_condition: string | null;
  start_at: string | null;
  start_min_participants: number | null;
  started_at: string | null;
};

const deriveEndDate = (row: LeagueRow): string => {
  if (row.end_at) {
    return row.end_at;
  }
  const base = row.signup_deadline ?? row.created_at;
  if (row.duration_type === 'matchdays' && row.duration_value && row.duration_value > 0) {
    const baseDate = new Date(base);
    baseDate.setDate(baseDate.getDate() + row.duration_value * 7);
    return baseDate.toISOString();
  }
  return row.end_at ?? row.created_at;
};

const mapRowToLeague = (row: LeagueRow, memberCount: number) => {
  const startCondition = row.start_condition ?? 'date';
  const startAt = row.start_at ?? null;
  const minParticipants = row.start_min_participants != null
    ? Number(row.start_min_participants)
    : null;
  const participants = memberCount;

  const hasStarted = hasLeagueStarted({
    startCondition,
    startMinParticipants: minParticipants,
    startAt,
    signupDeadline: row.signup_deadline,
    participants,
    status: row.status,
  });

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    entryFee: Number(row.entry_fee ?? 0),
    participants,
    maxParticipants: row.max_members,
    status: row.status ?? (hasStarted ? 'active' : 'pending'),
    championship: row.championship ?? undefined,
    strategy: row.strategy ?? undefined,
    canLeave: row.can_leave ?? false,
    endDate: deriveEndDate(row),
    creatorId: row.creator_id,
    creator: row.creator_id,
    isPublic: row.is_public ?? true,
    isPaid: row.is_paid ?? false,
    featured: false,
    signupDeadline: row.signup_deadline ?? null,
    durationType: row.duration_type ?? null,
    durationValue: row.duration_value ?? null,
    startCondition,
    startAt,
    startMinParticipants: minParticipants,
    startedAt: row.started_at ?? null,
    hasStarted,
    createdAt: row.created_at,
  };
};

type PublicLeague = ReturnType<typeof mapRowToLeague>;

export function JoinLeague({ translations: t, onBack, onViewLeague, language = 'en' }: JoinLeagueProps) {
  const [leagueCode, setLeagueCode] = useState('');
  const [searchResults, setSearchResults] = useState<PublicLeague[]>([]);
  const [loading, setLoading] = useState(Boolean(supabaseBrowserClient));
  const [error, setError] = useState<string | null>(null);
  const [codeLookupMessage, setCodeLookupMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowserClient;
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchLeagues = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('leagues')
        .select(
          'id, code, name, description, entry_fee, reward_distribution, can_leave, strategy, max_members, championship, creator_id, created_at, end_at, is_public, is_paid, signup_deadline, duration_type, duration_value, start_condition, start_at, start_min_participants, started_at'
        )
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (!mounted) {
        return;
      }

      let countsByLeague: Record<string, number> = {};

      if (!queryError) {
        const publicIds = (data ?? []).map((row) => row.id);
        if (publicIds.length > 0) {
          const { data: membersData, error: membersError } = await supabase
            .from('league_members')
            .select('league_id')
            .in('league_id', publicIds);

          if (!mounted) {
            return;
          }

          if (membersError) {
            setError(membersError.message);
            setSearchResults([]);
            setLoading(false);
            return;
          }

          (membersData ?? []).forEach((member) => {
            const leagueId = member.league_id as string;
            countsByLeague[leagueId] = (countsByLeague[leagueId] ?? 0) + 1;
          });
        }
      }

      if (queryError) {
        setError(queryError.message);
        setSearchResults([]);
      } else {
        const mapped = (data ?? []).map((row) => mapRowToLeague(row as LeagueRow, countsByLeague[row.id] ?? 0));
        setSearchResults(mapped.length > 0 ? mapped : []);
      }

      setLoading(false);
    };

    void fetchLeagues();

    return () => {
      mounted = false;
    };
  }, []);

  const handleJoinWithCode = async () => {
    const trimmed = leagueCode.trim();
    if (!trimmed) {
      return;
    }

    const supabase = supabaseBrowserClient;
    setCodeLookupMessage(null);

    if (!supabase) {
      setCodeLookupMessage(t.supabaseUnavailable || 'Supabase configuration missing.');
      return;
    }

    const { data, error: codeError } = await supabase
      .from('leagues')
      .select(
        'id, code, name, description, entry_fee, reward_distribution, can_leave, strategy, max_members, championship, creator_id, created_at, end_at, is_public, is_paid, signup_deadline, duration_type, duration_value, start_condition, start_at, start_min_participants, started_at'
      )
      .ilike('code', trimmed)
      .limit(1)
      .maybeSingle();

    if (codeError || !data) {
      setCodeLookupMessage(t.leagueNotFound || 'League not found. Please check the code.');
      return;
    }

    const { count } = await supabase
      .from('league_members')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', data.id);

    onViewLeague(mapRowToLeague(data as LeagueRow, count ?? 0));
  };

  const getChampionshipInfo = (championshipId: string) =>
    CHAMPIONSHIPS.find((c) => c.id === championshipId);

  const getStrategyInfo = (strategyId: string) =>
    DEFI_STRATEGIES.find((s) => s.id === strategyId);


  return (
    <div className="max-w-7xl mx-auto space-y-12 px-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t.backToDashboard || 'Back to dashboard'}
        </Button>
        <Badge className="bg-emerald-500/10 text-emerald-600">
          {t.safeLeagueBanner || 'Powered by Benolo protocol'}
        </Badge>
      </div>
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-5xl font-bold text-slate-900 mb-6">
          {t.joinLeagueTitle || 'Join a League'}
        </h1>
        <p className="text-2xl text-slate-600">
          {t.joinLeagueSubtitle || 'Find and join leagues powered by Benolo Protocol'}
        </p>
      </div>

      <Tabs defaultValue="browse" className="space-y-12">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto bg-slate-100 p-1">
          <TabsTrigger value="browse" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            {t.browseLeagues || 'Browse Open Leagues'}
          </TabsTrigger>
          <TabsTrigger value="code" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            {t.enterLeagueCode || 'Enter League Code'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-8">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t.loading || 'Loading...'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {(searchResults && searchResults.length > 0) ? searchResults.map((league) => {
              const championship = getChampionshipInfo(league.championship);
              const strategy = league.strategy ? getStrategyInfo(league.strategy) : null;
              
              return (
                <Card key={league.id} className={`shadow-lg hover:shadow-xl transition-all duration-300 border-2 ${
                  league.featured ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'
                } hover:border-slate-400`}>
                  {league.featured && (
                    <div className="bg-slate-900 text-white text-center py-3 text-sm font-bold">
                      ⭐ {t.featuredLeague || 'FEATURED LEAGUE'} ⭐
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl text-slate-900 mb-2">{league.name}</CardTitle>
                        <CardDescription className="text-slate-600">
                          {t.leagueCreator || 'Created by'}: <span className="font-medium">{league.creator}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{championship?.logo}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigator.clipboard.writeText(league.code)}
                          className="p-2 h-8 w-8 hover:bg-slate-100"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        {league.isPublic === false ? (t.privateLeagueTitle || 'Private league') : (t.publicLeagueTitle || 'Public league')}
                      </Badge>
                      <Badge variant="secondary" className={league.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}>
                        {league.isPaid ? (t.paidLeague || 'Paid league') : (t.freeLeague || 'Free league')}
                      </Badge>
                      {league.durationType && (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {league.durationType === 'matchdays'
                            ? `${league.durationValue ?? 0} ${t.matchdayCount || 'matchdays'}`
                            : (t.fullSeason || 'Full season')}
                        </Badge>
                      )}
                      {league.signupDeadline && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                          {t.signupDeadline || 'Deadline'}: {new Date(league.signupDeadline).toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: t.leagueCode || 'League Code', value: league.code, mono: true },
                        { label: t.entryFee || 'Entry Fee', value: league.entryFee === 0 ? 'FREE' : `$${league.entryFee}` },
                        { label: t.participants || 'Participants', value: league.participants > 0 ? `${league.participants}${league.maxParticipants ? `/${league.maxParticipants}` : ''}` : '—' },
                        { label: t.endDate || 'End Date', value: new Date(league.endDate).toLocaleDateString(), small: true }
                      ].map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                          <p className={`font-medium ${item.mono ? 'font-mono' : ''} ${item.small ? 'text-sm' : ''}`}>
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {championship && (
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{championship.logo}</span>
                          <div>
                            <p className="font-bold text-blue-900">{championship.name}</p>
                            <p className="text-sm text-blue-700">{championship.country}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {strategy && (
                      <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{strategy.icon}</span>
                            <p className="font-bold text-green-900 text-sm">{strategy.name}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            {strategy.apyRange}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {league.entryFee === 0 && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-amber-600" />
                          <p className="font-bold text-amber-900">{t.freeLeague || 'Free League - No USDC required!'}</p>
                        </div>
                      </div>
                    )}

                    <p className="text-slate-600 text-sm leading-relaxed">{league.description}</p>

                    <Button
                      onClick={() => onViewLeague(league)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3"
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      {t.joinLeagueBtn || 'Join League'}
                    </Button>
                  </CardContent>
                </Card>
              );
              }) : (
                <div className="col-span-full py-20 text-center">
                <div className="text-8xl mb-6">🏆</div>
                <h3 className="text-2xl font-bold text-slate-400 mb-4">{t.noLeaguesFound || 'No open leagues found'}</h3>
                <p className="text-slate-500 mb-8">{t.createFirst || 'Be the first to create a league!'}</p>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.createFirstLeague || 'Create First League'}
                </Button>
              </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="space-y-8">
          <Card className="max-w-md mx-auto shadow-xl border-2 border-slate-200 bg-white">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Search className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-slate-900">{t.enterLeagueCode || 'Enter League Code'}</CardTitle>
              <CardDescription className="text-slate-600">
                {t.enterCodeDescription || 'Enter the 6-digit code shared by the league creator'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="leagueCode" className="text-slate-700">{t.leagueCode || 'League Code'}</Label>
                <Input
                  id="leagueCode"
                  value={leagueCode}
                  onChange={(e) => setLeagueCode(e.target.value.toUpperCase())}
                  placeholder={t.leagueCodePlaceholder || 'Enter 6-digit league code'}
                  className="text-center font-mono text-2xl tracking-widest border-2 border-slate-200 focus:border-slate-900 py-4"
                  maxLength={6}
                />
              </div>
              <Button
                onClick={handleJoinWithCode}
                disabled={leagueCode.length !== 6}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 font-medium disabled:opacity-50"
              >
                <Search className="h-4 w-4 mr-2" />
                {t.joinWithCode || 'Join with Code'}
              </Button>
              {codeLookupMessage && (
                <p className="text-center text-sm text-red-600">{codeLookupMessage}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
