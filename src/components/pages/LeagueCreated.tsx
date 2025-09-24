"use client";

import React, { useState } from 'react';
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { CheckCircle, Copy } from 'lucide-react';

interface LeagueCreatedProps {
  createdLeague: any;
  translations: any;
  onBack: () => void;
  language?: string;
}

export function LeagueCreated({ createdLeague, translations: t, onBack, language = 'en' }: LeagueCreatedProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!createdLeague?.code) return;
    navigator.clipboard.writeText(createdLeague.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!createdLeague) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <Card className="shadow-xl border-2 border-green-200 bg-green-50">
        <CardContent className="p-12">
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold text-green-900 mb-4">
            {t.leagueCreated || 'League Created Successfully!'}
          </h1>
          <p className="text-lg text-green-700 mb-8">
            {t.leagueCodeGenerated || 'Your league code is:'}
          </p>
          
          <div className="bg-white p-6 rounded-2xl border-2 border-green-200 mb-8">
            <div className="flex items-center justify-center gap-4">
              <span className="text-4xl font-mono font-bold text-green-800">{createdLeague?.code ?? 'XXXXXX'}</span>
              <Button
                onClick={copyCode}
                variant="outline"
                className="border-green-300 hover:bg-green-100"
              >
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <p className="text-green-700 mb-8">
            {t.shareCode || 'Share this code with your friends to let them join!'}
          </p>

          {createdLeague?.isPaid && (
            <div className="mb-8 rounded-2xl border border-emerald-200 bg-white p-6 text-left text-sm text-slate-600">
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                {t.smartContractNext || 'Next step: deploy the payout smart contract'}
              </h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>{t.connectWalletReminder || 'Connect your wallet from the profile page if not already done.'}</li>
                <li>{t.reviewParameters || 'Review the league parameters (stake, strategy, penalties) — they will be baked into the contract.'}</li>
                <li>{t.signatureInfo || 'A deployment modal will soon request your signature to lock funds and activate the league vault.'}</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                {t.smartContractDisclaimer || 'Smart contract deployment is not yet automated in this preview; you will be notified when it is available.'}
              </p>
            </div>
          )}
          
          <Button
            onClick={onBack}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 text-lg font-bold"
          >
            {t.continueToDashboard || 'Continue to Dashboard'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
