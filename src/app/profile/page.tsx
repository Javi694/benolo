"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { translations } from "@/data/content";

interface ProfileFormState {
  display_name: string;
  avatar_url: string;
  preferred_language: string;
  country_code: string;
  bio: string;
  role: string;
}

interface WalletRecord {
  id: number;
  address: string;
  network: string;
  is_primary: boolean;
  verified: boolean;
  label: string | null;
  linked_at: string;
}

const defaultState: ProfileFormState = {
  display_name: "",
  avatar_url: "",
  preferred_language: "en",
  country_code: "",
  bio: "",
  role: "user",
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = supabaseBrowserClient;
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<ProfileFormState>(defaultState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [syncingWallet, setSyncingWallet] = useState(false);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const languageOptions = useMemo(() => Object.keys(translations), []);

  const loadProfile = useCallback(async () => {
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session?.user) {
      router.replace("/" as Route);
      return;
    }

     setUserId(session.user.id);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, preferred_language, country_code, bio, role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
    } else {
      let resolvedRole = profileData?.role ?? 'user';
      if (profileData) {
        const { data: adminRows } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1);

        if ((adminRows?.length ?? 0) === 0) {
          const { error: promoteError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', session.user.id);
          if (promoteError) {
            setError(promoteError.message);
          } else {
            resolvedRole = 'admin';
          }
        }

        setFormState({
          display_name: profileData.display_name ?? session.user.email ?? "",
          avatar_url: profileData.avatar_url ?? "",
          preferred_language: profileData.preferred_language ?? "en",
          country_code: profileData.country_code ?? "",
          bio: profileData.bio ?? "",
          role: resolvedRole,
        });
      } else {
        setFormState((state) => ({
          ...state,
          display_name: session.user.email ?? "",
          role: state.role ?? 'user',
        }));
      }
    }

    const { data: walletData, error: walletFetchError } = await supabase
      .from("user_wallets")
      .select("id, address, network, is_primary, verified, label, linked_at")
      .eq("user_id", session.user.id)
      .order("linked_at", { ascending: false });

    if (walletFetchError) {
      setWalletError(walletFetchError.message);
    } else {
      setWallets(walletData ?? []);
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleChange = (field: keyof ProfileFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({ ...prev, [field]: value }));
    };

  const handleLanguageChange = (value: string) => {
    setFormState((prev) => ({ ...prev, preferred_language: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) {
      router.replace("/" as Route);
      return;
    }

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: session.user.id,
        display_name: formState.display_name,
        avatar_url: formState.avatar_url,
        preferred_language: formState.preferred_language,
        country_code: formState.country_code,
        bio: formState.bio,
        role: formState.role,
      });

    if (upsertError) {
      setError(upsertError.message);
    } else {
      setSuccess("Profil mis à jour avec succès.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Chargement du profil…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 min-h-screen py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Profil utilisateur</h1>
            <p className="text-sm text-muted-foreground">
              Modifie tes informations publiques et préférences Benolo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            {formState.role === "admin" && (
              <Button variant="outline" onClick={() => router.push("/admin" as Route)}>
                Espace admin
              </Button>
            )}
          </div>
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
            <CardTitle>Informations générales</CardTitle>
            <CardDescription>
              Le nom affiché est visible par les autres joueurs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="display_name">Nom affiché</Label>
                <Input
                  id="display_name"
                  value={formState.display_name}
                  onChange={handleChange("display_name")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">Avatar (URL)</Label>
                <Input
                  id="avatar_url"
                  value={formState.avatar_url}
                  onChange={handleChange("avatar_url")}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_language">Langue préférée</Label>
                <Select
                  value={formState.preferred_language}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une langue" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country_code">Pays (code ISO)</Label>
                <Input
                  id="country_code"
                  value={formState.country_code}
                  onChange={handleChange("country_code")}
                  placeholder="FR"
                  maxLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Biographie</Label>
                <Textarea
                  id="bio"
                  value={formState.bio}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, bio: event.target.value }))
                  }
                  placeholder="Parle-nous de tes ligues, de tes sports préférés, etc."
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/" as Route)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="gap-2" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Sauvegarder
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Wallet EVM</CardTitle>
            <CardDescription>
              Connecte ton wallet pour recevoir les récompenses Benolo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <ConnectButton />
              {isConnected && (
                <Button variant="outline" onClick={() => disconnect()}>
                  Déconnecter
                </Button>
              )}
            </div>

            {walletError && (
              <Alert variant="destructive">
                <AlertDescription>{walletError}</AlertDescription>
              </Alert>
            )}

            {walletMessage && (
              <Alert>
                <AlertDescription>{walletMessage}</AlertDescription>
              </Alert>
            )}

            <WalletList
              wallets={wallets}
              syncing={syncingWallet}
              onRefresh={loadProfile}
              supabaseAvailable={Boolean(supabase && userId)}
              setWalletError={setWalletError}
              setWalletMessage={setWalletMessage}
              setSyncingWallet={setSyncingWallet}
              userId={userId}
              currentConnectedAddress={address ?? null}
              onUpdateUserId={setUserId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface WalletListProps {
  wallets: WalletRecord[];
  syncing: boolean;
  onRefresh: () => Promise<void> | void;
  supabaseAvailable: boolean;
  setWalletError: (value: string | null) => void;
  setWalletMessage: (value: string | null) => void;
  setSyncingWallet: (value: boolean) => void;
  userId: string | null;
  currentConnectedAddress: string | null;
  onUpdateUserId: (value: string | null) => void;
}

function WalletList({
  wallets,
  syncing,
  onRefresh,
  supabaseAvailable,
  setWalletError,
  setWalletMessage,
  setSyncingWallet,
  userId,
  currentConnectedAddress,
  onUpdateUserId,
}: WalletListProps) {
  const supabase = supabaseBrowserClient;

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const handleSetPrimary = async (walletId: number) => {
    if (!supabase || !userId) return;
    setSyncingWallet(true);
    setWalletError(null);
    const { error } = await supabase
      .from("user_wallets")
      .update({ is_primary: true })
      .eq("id", walletId)
      .eq("user_id", userId);
    if (error) {
      setWalletError(error.message);
    } else {
      setWalletMessage("Wallet principal mis à jour.");
      await onRefresh();
    }
    setSyncingWallet(false);
  };

  const handleRemove = async (walletId: number) => {
    if (!supabase || !userId) return;
    setSyncingWallet(true);
    setWalletError(null);
    const { error } = await supabase
      .from("user_wallets")
      .delete()
      .eq("id", walletId)
      .eq("user_id", userId);
    if (error) {
      setWalletError(error.message);
    } else {
      setWalletMessage("Wallet supprimé.");
      await onRefresh();
    }
    setSyncingWallet(false);
  };

  const linkCurrentWallet = async () => {
    if (!supabase || !currentConnectedAddress) {
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setWalletError('Session expirée. Veuillez vous reconnecter.');
      return;
    }
    onUpdateUserId(uid);
    const alreadyLinked = wallets.some(
      (wallet) => wallet.address.toLowerCase() === currentConnectedAddress.toLowerCase(),
    );
    if (alreadyLinked) {
      setWalletMessage("Ce wallet est déjà associé à votre compte.");
      return;
    }
    setSyncingWallet(true);
    setWalletError(null);
    const { error } = await supabase.from('user_wallets').upsert({
      user_id: uid,
      address: currentConnectedAddress,
      network: 'evm',
      is_primary: wallets.length === 0,
    });
    if (error) {
      if (error.message.includes('foreign key constraint')) {
        setWalletError('Ta session est invalide. Déconnecte-toi puis reconnecte-toi avant d\'associer un wallet.');
        await supabase.auth.signOut();
      } else {
      setWalletError(error.message);
      }
    } else {
      setWalletMessage("Wallet associé avec succès.");
      await onRefresh();
    }
    setSyncingWallet(false);
  };

  if (!supabaseAvailable) {
    return null;
  }

  return (
    <div className="space-y-4">
      {currentConnectedAddress && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm">
            Wallet connecté : <span className="font-mono">{formatAddress(currentConnectedAddress)}</span>
          </p>
          <Button
            type="button"
            className="mt-3"
            onClick={linkCurrentWallet}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Associer ce wallet"
            )}
          </Button>
        </div>
      )}

      {wallets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {"Aucun wallet lié pour l\u2019instant. Connecte ton wallet et associe-le à ton profil."}
        </p>
      ) : (
        <div className="space-y-3">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-mono text-sm">{wallet.address}</p>
                <p className="text-xs text-muted-foreground">
                  Réseau : {wallet.network.toUpperCase()} · Ajouté le {new Date(wallet.linked_at).toLocaleDateString()}
                </p>
                {wallet.is_primary && (
                  <span className="mt-1 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                    Wallet principal
                  </span>
                )}
                {wallet.verified && (
                  <span className="ml-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                    Vérifié
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!wallet.is_primary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSetPrimary(wallet.id)}
                    disabled={syncing}
                  >
                    Définir principal
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemove(wallet.id)}
                  disabled={syncing}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
