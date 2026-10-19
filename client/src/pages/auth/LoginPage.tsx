import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.auth.login(email.trim().toLowerCase(), password);
      await refreshUser();
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-alabaster dark:bg-neutral-950">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl shadow-neutral-200/50 dark:shadow-none border border-neutral-200 dark:border-neutral-800 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-2 mb-3 rounded-2xl bg-flamingo/10">
            <img src="/avantika-logo.svg" alt="Avantika University" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Welcome back to AU Forms
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Sign in with your Avantika University account
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              College Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="samyak.jain1@avantika.edu.in"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-flamingo hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-flamingo hover:bg-flamingo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-flamingo/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 text-center">
          <p className="text-sm text-muted-foreground">
            New to AU Forms?{" "}
            <Link to="/signup" className="text-flamingo font-semibold hover:underline">
              Register with college email
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
