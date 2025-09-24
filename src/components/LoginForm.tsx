"use client";

import React, { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Label } from './ui/label'
import { Trophy, TrendingUp, Users } from 'lucide-react'
import { functionsUrl, supabaseAnonKey } from '@/config/supabase'
import { supabaseBrowserClient } from '@/lib/supabase/client'

const supabaseClient = supabaseBrowserClient

interface LoginFormProps {
  onLogin: (session: any) => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase is not configured.');
      }

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la connexion');
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      if (!supabaseClient) {
        throw new Error('Supabase is not configured.');
      }

      const { data: { session }, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (session) {
        onLogin(session)
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la connexion')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      if (!functionsUrl || !supabaseClient) {
        throw new Error('Supabase functions are not configured.');
      }

      const response = await fetch(`${functionsUrl}/make-server-f4729f06/signup`, {        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ name, email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription')
      }

      // Connexion automatique après inscription
      if (!supabaseClient) {
        throw new Error('Supabase is not configured.');
      }

      const { data: { session }, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (session) {
        onLogin(session)
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">PronoPool</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Pariez entre amis, générez des revenus en DeFi, et gagnez plus que votre mise !
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center mb-4">
                <Users className="h-8 w-8 text-blue-600 mr-3" />
                <h3 className="text-lg font-semibold">Paris entre amis</h3>
              </div>
              <p className="text-gray-600">
                Créez des ligues privées avec vos amis et pronostiquez sur vos équipes favorites.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center mb-4">
                <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                <h3 className="text-lg font-semibold">Rendements DeFi</h3>
              </div>
              <p className="text-gray-600">
                Vos mises génèrent des intérêts automatiquement grâce aux protocoles de finance décentralisée.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center mb-4">
                <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
                <h3 className="text-lg font-semibold">Gagnez plus</h3>
              </div>
              <p className="text-gray-600">
                Les meilleurs pronostiqueurs remportent les intérêts générés. Tout le monde récupère sa mise !
              </p>
            </div>
          </div>

          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Rejoignez PronoPool</CardTitle>
              <CardDescription>
                Connectez-vous ou créez un compte pour commencer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border border-slate-200 hover:bg-slate-50"
                  onClick={() => handleOAuthSignIn('google')}
                >
                  Continuer avec Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border border-slate-200 hover:bg-slate-50"
                  onClick={() => handleOAuthSignIn('facebook')}
                >
                  Continuer avec Meta
                </Button>
              </div>
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Connexion</TabsTrigger>
                  <TabsTrigger value="signup">Inscription</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        required
                        placeholder="votre@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Mot de passe</Label>
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                      />
                    </div>
                    {error && (
                      <div className="text-red-600 text-sm">{error}</div>
                    )}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Connexion...' : 'Se connecter'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nom</Label>
                      <Input
                        id="signup-name"
                        name="name"
                        type="text"
                        required
                        placeholder="Votre nom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        required
                        placeholder="votre@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Mot de passe</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        minLength={6}
                      />
                    </div>
                    {error && (
                      <div className="text-red-600 text-sm">{error}</div>
                    )}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Création...' : 'Créer un compte'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
