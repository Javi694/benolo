"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Une erreur est survenue
            </CardTitle>
            <CardDescription>
              Nous avons rencontré un problème lors du chargement de la page. Vous pouvez réessayer ou revenir à l’accueil.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Détails : {error.message}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.location.assign("/")}>
                Aller à l’accueil
              </Button>
              <Button onClick={reset}>Réessayer</Button>
            </div>
          </CardContent>
        </Card>
      </body>
    </html>
  );
}
