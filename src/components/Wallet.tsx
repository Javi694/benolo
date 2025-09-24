"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  CreditCard,
  DollarSign,
  Info,
  Lock,
  Shield,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DemoUser, TranslationAwareProps } from "@/types/app";

interface WalletProps extends TranslationAwareProps {
  user: DemoUser | null;
  onBack: () => void;
}

interface WalletTransaction {
  id: string;
  type: "deposit" | "withdraw" | "league_entry" | "yield";
  amount: number;
  method: string;
  status: "completed" | "pending";
  date: string;
  description: string;
  league?: string;
}

interface WalletSnapshot {
  usdcBalance: number;
  availableBalance: number;
  lockedBalance: number;
  totalInvested: number;
  currentValue: number;
  totalYield: number;
  transactions: WalletTransaction[];
}

const mockWallet: WalletSnapshot = {
  usdcBalance: 250.5,
  availableBalance: 150.5,
  lockedBalance: 100,
  totalInvested: 150,
  currentValue: 157.25,
  totalYield: 7.25,
  transactions: [
    {
      id: "tx_1",
      type: "deposit",
      amount: 100,
      method: "Credit Card",
      status: "completed",
      date: "2025-01-10T10:00:00Z",
      description: "Deposit via Visa ending in 4242",
    },
    {
      id: "tx_2",
      type: "league_entry",
      amount: -50,
      method: "League Entry",
      status: "completed",
      date: "2025-01-11T15:30:00Z",
      description: "Entry fee for Premier League Predictions 2025",
      league: "PL2025",
    },
    {
      id: "tx_3",
      type: "deposit",
      amount: 200,
      method: "Crypto Wallet",
      status: "completed",
      date: "2025-01-12T09:15:00Z",
      description: "USDC deposit from MetaMask",
    },
    {
      id: "tx_4",
      type: "yield",
      amount: 7.25,
      method: "Benolo Protocol",
      status: "pending",
      date: "2025-01-14T00:00:00Z",
      description: "Projected yield from active investments",
    },
  ],
};

export function Wallet({ user, onBack, translations: t }: WalletProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<"card" | "wallet">("card");
  const [isProcessing, setIsProcessing] = useState(false);

  const wallet = useMemo(() => mockWallet, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const transactionIcon = (type: WalletTransaction["type"]) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="h-4 w-4 text-emerald-600" />;
      case "withdraw":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "league_entry":
        return <Coins className="h-4 w-4 text-blue-500" />;
      case "yield":
        return <TrendingUp className="h-4 w-4 text-emerald-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-slate-500" />;
    }
  };

  const transactionColor = (type: WalletTransaction["type"]) => {
    switch (type) {
      case "deposit":
        return "text-emerald-600";
      case "withdraw":
        return "text-red-500";
      case "league_entry":
        return "text-blue-500";
      case "yield":
        return "text-emerald-600";
      default:
        return "text-slate-600";
    }
  };

  const handleDeposit = () => {
    const parsed = Number(depositAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      window.alert("Please enter a valid deposit amount");
      return;
    }
    setIsProcessing(true);
    window.setTimeout(() => {
      setIsProcessing(false);
      window.alert(
        `Deposit of ${parsed.toFixed(2)} USDC initiated via ${depositMethod === "card" ? "credit card" : "crypto wallet"}`,
      );
      setDepositAmount("");
    }, 1500);
  };

  const handleWithdraw = () => {
    const parsed = Number(withdrawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      window.alert("Please enter a valid withdrawal amount");
      return;
    }
    if (parsed > wallet.availableBalance) {
      window.alert("Insufficient available balance");
      return;
    }
    setIsProcessing(true);
    window.setTimeout(() => {
      setIsProcessing(false);
      window.alert(`Withdrawal of ${parsed.toFixed(2)} USDC initiated`);
      setWithdrawAmount("");
    }, 1500);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
            <WalletIcon className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900">
          {t.wallet || "Your Benolo Wallet"}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Manage your USDC and track Benolo investments
        </p>
      </div>

      <Card className="shadow-md">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-3xl font-semibold">
              ${formatCurrency(wallet.usdcBalance)} USDC
            </CardTitle>
            <CardDescription>
              {t.totalBalance || "Total balance across Benolo"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="gap-1 rounded-full bg-emerald-500/10 text-emerald-600">
              <Coins className="h-4 w-4" />
              Available {formatCurrency(wallet.availableBalance)}
            </Badge>
            <Badge className="gap-1 rounded-full bg-slate-100 text-slate-700">
              <Lock className="h-4 w-4" />
              Locked {formatCurrency(wallet.lockedBalance)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-xs text-muted-foreground">Total invested</p>
            <p className="text-xl font-semibold text-slate-900">
              ${formatCurrency(wallet.totalInvested)}
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-xs text-muted-foreground">Current value</p>
            <p className="text-xl font-semibold text-slate-900">
              ${formatCurrency(wallet.currentValue)}
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-xs text-muted-foreground">Yield generated</p>
            <p className="text-xl font-semibold text-slate-900">
              ${formatCurrency(wallet.totalYield)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Manage funds</CardTitle>
                <CardDescription>
                  Deposit or withdraw USDC securely through Benolo
                </CardDescription>
              </div>
              <TabsList className="self-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deposit">Deposit</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <CardContent>
            <TabsContent value="overview" className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-semibold">Protected deposits</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Benolo routes USDC into battle-tested DeFi strategies. Your principal remains protected while generating yield for league rewards.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-semibold">Multiple payment rails</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Deposit via credit card (Circle) or connect a crypto wallet. Withdrawals settle back to your preferred method in minutes.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="deposit" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Amount (USDC)</Label>
                  <Input
                    id="deposit-amount"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder="100"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={depositMethod === "card" ? "default" : "outline"}
                      onClick={() => setDepositMethod("card")}
                      className="gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      Credit card
                    </Button>
                    <Button
                      type="button"
                      variant={depositMethod === "wallet" ? "default" : "outline"}
                      onClick={() => setDepositMethod("wallet")}
                      className="gap-2"
                    >
                      <Coins className="h-4 w-4" />
                      Crypto wallet
                    </Button>
                  </div>
                </div>
                <Button onClick={handleDeposit} disabled={isProcessing} className="w-full gap-2">
                  <ArrowDownLeft className="h-4 w-4" />
                  {isProcessing ? "Processing..." : "Confirm deposit"}
                </Button>
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Deposits settle instantly. Yield accrues as soon as funds lock into Benolo strategies.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">Amount (USDC)</Label>
                  <Input
                    id="withdraw-amount"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder="50"
                    inputMode="decimal"
                  />
                </div>
                <Button onClick={handleWithdraw} disabled={isProcessing} className="w-full gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  {isProcessing ? "Processing..." : "Request withdrawal"}
                </Button>
                <Alert variant="destructive">
                  <AlertDescription className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Withdrawals free up after active leagues end or when penalties apply based on league rules.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Track deposits, withdrawals, and league operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wallet.transactions.map((transaction) => (
            <div key={transaction.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  {transactionIcon(transaction.type)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(transaction.date)} • {transaction.method}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${transactionColor(transaction.type)}`}>
                  {transaction.amount > 0 ? "+" : ""}{transaction.amount.toFixed(2)} USDC
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {transaction.status}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          Back to dashboard
        </Button>
        <Button className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Explore Benolo strategies
        </Button>
      </div>
    </div>
  );
}
