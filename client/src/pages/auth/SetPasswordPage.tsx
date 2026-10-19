import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Lock, Check, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import confetti from "canvas-confetti";

export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();

  const email = searchParams.get("email") || "";
  const tempToken = searchParams.get("tempToken") || "";
  const name = searchParams.get("name") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      await api.auth.setPassword(email, tempToken, password, name);
      // Trigger confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#F16222", "#FAFAFA", "#1F1F1F"],
        });
      } catch {}

      await refreshUser();
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to set password. Session may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!email || !tempToken) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center p-6 bg-white dark:bg-neutral-900 rounded-xl border border-border">
          <p className="text-sm text-muted-foreground mb-4">Invalid or missing verification session.</p>
          <Link to="/signup" className="text-sm font-semibold text-flamingo hover:underline">
            Start Registration Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-alabaster dark:bg-neutral-950">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl shadow-neutral-200/50 dark:shadow-none border border-neutral-200 dark:border-neutral-800 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 mb-3 rounded-2xl bg-flamingo/10 text-flamingo">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Choose Your Password
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Step 3 of 3: Secure your verified account for <br />
            <strong className="text-neutral-900 dark:text-neutral-100">{email}</strong>
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              Create Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Password criteria */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${password.length >= 8 ? "bg-emerald-500 text-white" : "bg-neutral-300 dark:bg-neutral-700 text-neutral-500"}`}>✓</span>
              <span>Minimum 8 characters in length</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${password && password === confirmPassword ? "bg-emerald-500 text-white" : "bg-neutral-300 dark:bg-neutral-700 text-neutral-500"}`}>✓</span>
              <span>Passwords match</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-flamingo hover:bg-flamingo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-flamingo/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Finalize Account & Enter Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
