import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { 
  Trophy, Users, DollarSign, TrendingUp, Target, Plus, Shield, 
  Zap, AlertTriangle, ArrowRight, CheckCircle, Lock, Info, 
  Sparkles, Star, Globe, ChevronRight, BarChart3, Coins
} from 'lucide-react';

interface HomePageProps {
  translations: any;
  onCreateLeague: () => void;
  onJoinLeague: () => void;
  onGetStarted: () => void;
  language?: string;
}

export function HomePage({ translations: t, onCreateLeague, onJoinLeague, onGetStarted, language = 'en' }: HomePageProps) {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent" />
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
              backgroundSize: '20px 20px'
            }} 
          />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-400 rounded-3xl flex items-center justify-center shadow-2xl">
                  <Trophy className="h-12 w-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="h-4 w-4 text-green-500" />
                </div>
              </div>
            </div>
            
            {/* Heading */}
            <div className="space-y-8">
              <div>
                <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                  <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    Predict Sports.
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                    Keep Your Money.
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-slate-300 mb-6 max-w-4xl mx-auto leading-relaxed">
                  {t.homeSubtitle || 'The revolutionary sports prediction protocol where your USDC grows in DeFi while you compete'}
                </p>
              </div>
              
              {/* Trust Indicators */}
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-4 py-2 text-sm font-medium">
                  <Shield className="h-4 w-4 mr-2" />
                  100% Principal Protected
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-4 py-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Real DeFi Yields
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-4 py-2 text-sm font-medium">
                  <Star className="h-4 w-4 mr-2" />
                  Battle-Tested Protocols
                </Badge>
              </div>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  onClick={onGetStarted}
                  className="bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white px-8 py-4 text-lg font-semibold shadow-2xl hover:shadow-green-500/25 transition-all duration-300 transform hover:scale-105"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  {t.getStarted || 'Start Predicting'}
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={onCreateLeague}
                  className="border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 px-8 py-4 text-lg font-semibold transition-all duration-300"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {t.createLeague || 'Create League'}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { label: 'Total Protected', value: '$2.1M', icon: Shield, color: 'text-green-600' },
              { label: 'Active Leagues', value: '847', icon: Trophy, color: 'text-blue-600' },
              { label: 'DeFi Yield Generated', value: '$156K', icon: TrendingUp, color: 'text-purple-600' },
              { label: 'Happy Predictors', value: '12.3K', icon: Users, color: 'text-orange-600' }
            ].map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-2">{stat.value}</div>
                <div className="text-slate-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-4 py-2 mb-6">
              How Benolo Works
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              {t.howItWorksTitle || 'The Future of Sports Prediction'}
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {t.howItWorksSubtitle || 'Revolutionary BEt-NO-LOss technology that protects your money while generating returns'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {[
              { 
                icon: Users, 
                title: t.step1Title || 'Create League', 
                desc: t.step1Desc || 'Start with friends or join existing leagues',
                number: '1',
                color: 'bg-blue-500'
              },
              { 
                icon: Coins, 
                title: t.step2Title || 'Pool USDC', 
                desc: t.step2Desc || 'Everyone contributes to the shared prize pool',
                number: '2',
                color: 'bg-green-500'
              },
              { 
                icon: Shield, 
                title: t.step3Title || 'DeFi Magic', 
                desc: t.step3Desc || 'Your USDC grows safely in battle-tested protocols',
                number: '3',
                color: 'bg-purple-500',
                highlight: true
              },
              { 
                icon: Target, 
                title: t.step4Title || 'Predict & Play', 
                desc: t.step4Desc || 'Make predictions and climb the leaderboard',
                number: '4',
                color: 'bg-orange-500'
              },
              { 
                icon: Trophy, 
                title: t.step5Title || 'Win-Win', 
                desc: t.step5Desc || 'Everyone gets USDC back + winners share yields',
                number: '5',
                color: 'bg-red-500'
              }
            ].map((step, index) => (
              <div key={index} className="relative group">
                <Card className={`p-6 h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
                  step.highlight 
                    ? 'border-2 border-purple-200 bg-purple-50 shadow-lg' 
                    : 'border border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <div className="text-center">
                    <div className="relative mb-6">
                      <div className={`w-16 h-16 mx-auto rounded-2xl ${step.color} flex items-center justify-center shadow-lg`}>
                        <step.icon className="h-8 w-8 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                        {step.number}
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 mb-3">{step.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </Card>
                
                {/* Arrow for desktop */}
                {index < 4 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 z-10">
                    <div className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="py-20 bg-gradient-to-r from-green-500 to-emerald-400">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t.safetyTitle || 'Your Money. Always Protected.'}
            </h2>
            <p className="text-xl text-green-100 max-w-3xl mx-auto">
              {t.safetySubtitle || 'Unlike traditional betting where you can lose everything, Benolo guarantees your principal back'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: Shield, 
                title: t.safetyPoint1 || 'Principal Protected', 
                desc: t.safetyPoint1Desc || 'Your USDC is always returned, no matter what happens'
              },
              { 
                icon: Lock, 
                title: t.safetyPoint2 || 'Battle-Tested DeFi', 
                desc: t.safetyPoint2Desc || 'Only use protocols with billions in TVL and proven track records'
              },
              { 
                icon: BarChart3, 
                title: t.safetyPoint3 || 'Real-Time Tracking', 
                desc: t.safetyPoint3Desc || 'Monitor your USDC growth and strategy performance live'
              }
            ].map((point, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur-sm border-white/20 p-8 text-center hover:bg-white/20 transition-all duration-300">
                <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                  <point.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{point.title}</h3>
                <p className="text-green-100 leading-relaxed">{point.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="bg-orange-100 text-orange-800 border-orange-200 px-4 py-2 mb-6">
              Why Choose Benolo?
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Traditional Betting vs Benolo
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              See the revolutionary difference that makes Benolo the future of sports prediction
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Traditional Betting */}
            <Card className="border-2 border-red-200 bg-red-50 overflow-hidden">
              <CardHeader className="text-center pb-6 bg-red-100">
                <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl text-red-900">Traditional Betting</CardTitle>
                <CardDescription className="text-red-700">The old way - high risk, house wins</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-4">
                  {[
                    'You lose everything if wrong',
                    'House always has the edge',
                    'No real ownership or control',
                    'Zero transparency in operations'
                  ].map((point, index) => (
                    <div key={index} className="flex items-center gap-3 text-red-700">
                      <div className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{point}</span>
                    </div>
                  ))}
                </div>
                
                <div className="pt-6 border-t-2 border-red-200 text-center">
                  <div className="text-4xl mb-3">💀</div>
                  <p className="text-red-800 font-bold text-lg">Total Loss Possible</p>
                </div>
              </CardContent>
            </Card>

            {/* Benolo Protocol */}
            <Card className="border-2 border-green-200 bg-green-50 overflow-hidden shadow-xl">
              <CardHeader className="text-center pb-6 bg-gradient-to-r from-green-100 to-emerald-100">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl text-green-900">Benolo Protocol</CardTitle>
                <CardDescription className="text-green-700">The future - your money grows safely</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-4">
                  {[
                    'Your USDC is always protected',
                    'Earn DeFi yields while you play',
                    'Full transparency and control',
                    'Community-owned and operated'
                  ].map((point, index) => (
                    <div key={index} className="flex items-center gap-3 text-green-700">
                      <div className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{point}</span>
                    </div>
                  ))}
                </div>
                
                <div className="pt-6 border-t-2 border-green-200 text-center">
                  <div className="text-4xl mb-3">🛡️</div>
                  <p className="text-green-800 font-bold text-lg">100% Principal Protected</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="space-y-8">
            <div className="text-6xl mb-6">🚀</div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Join the Revolution?
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Join thousands of smart predictors who are earning DeFi yields while competing in sports prediction leagues. 
              Your money grows, you have fun, everyone wins.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={onCreateLeague}
                className="bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500 text-white px-8 py-4 text-lg font-semibold shadow-2xl hover:shadow-green-500/25 transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-5 w-5 mr-2" />
                {t.createLeague || 'Create Your First League'}
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={onJoinLeague}
                className="border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 px-8 py-4 text-lg font-semibold transition-all duration-300"
              >
                <Users className="h-5 w-5 mr-2" />
                {t.joinLeague || 'Join Existing League'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
