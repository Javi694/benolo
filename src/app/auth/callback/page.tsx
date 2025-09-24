"use client";

import { Suspense, useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}> 
      <AuthCallbackHandler />
    </Suspense>
  );
}

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const exchangeSession = async () => {
      if (!supabaseBrowserClient) {
        // eslint-disable-next-line react/no-unescaped-entities
        setErrorMessage("Supabase n'est pas configuré.");
        return;
      }

      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      if (error) {
        setErrorMessage(errorDescription || error);
        return;
      }

      const code = searchParams.get("code");
      if (!code) {
        router.replace("/");
        return;
      }

      const { error: exchangeError } = await supabaseBrowserClient.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setErrorMessage(exchangeError.message);
        return;
      }

      const redirectTo = (searchParams.get("redirect") ?? "/") as Route;
      router.replace(redirectTo);
    };

    exchangeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthCallbackLayout errorMessage={errorMessage} onBack={() => router.replace("/")} />;
}

function AuthCallbackFallback() {
  return <AuthCallbackLayout errorMessage={null} />;
}

interface AuthCallbackLayoutProps {
  errorMessage: string | null;
  onBack?: () => void;
}

function AuthCallbackLayout({ errorMessage, onBack }: AuthCallbackLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader>
          <CardTitle>Connexion en cours</CardTitle>
          <CardDescription>
            {errorMessage ? (
              <>
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                {"Nous n'avons pas pu finaliser votre connexion."}
              </>
            ) : (
              "Merci de patienter pendant que nous validons votre compte."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          {errorMessage ? (
            <p className="text-sm text-red-600 text-center">{errorMessage}</p>
          ) : (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
              <p className="text-sm text-muted-foreground">
                {"Redirection automatique vers l\u2019application…"}
              </p>
            </>
          )}
          {errorMessage && onBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              {"Retour à l\u2019accueil"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
