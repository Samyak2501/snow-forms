import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Lock, Check, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff, KeyRound } from "lucide-react";
import confetti from "canvas-confetti";

const COMMON_WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "1234466789", "1234567890", "01234567", "qwerty123", "admin123",
  "welcome1", "letmein1", "avantika123", "snowforms123", "student123",
  "password@123", "admin@123"
]);

interface SetPasswordPageProps {
  isReset?: boolean;
}

export const SetPasswordPage: React.FC<SetPasswordPageProps> = ({ isReset = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();

  const email = searchParams.get("email") || "";
  const tempToken = searchParams.get("tempToken") || "";
  const name = searchParams.get("name") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live validation checks
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const notOnlyNumeric = password.length > 0 && !/^\d+$/.test(password);
  const notRepeated = password.length > 0 && !/^(.)\1+$/.test(password);
  const notCommonWeak = password.length > 0 && !COMMON_WEAK_PASSWORDS.has(password.toLowerCase().trim());
  const isStrong = hasMinLength && hasLetter && hasNumber && notOnlyNumeric && notRepeated && notCommonWeak;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = isStrong && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!hasLetter) {
      setError("Password must contain at least one letter.");
      return;
    }
    if (!hasNumber) {
      setError("Password must contain at least one number.");
      return;
    }
    if (!notOnlyNumeric) {
      setError("Numeric-only passwords are not allowed. Please include letters.");
      return;
    }
    if (!notCommonWeak) {
      setError("This password is too common or weak. Please choose a stronger password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      if (isReset) {
        await api.auth.resetPassword(email, tempToken, password);
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 },
            colors: ["#F16222", "#FAFAFA", "#1F1F1F"],
          });
        } catch {}
        navigate("/login?reset=success");
      } else {
        await api.auth.setPassword(email, tempToken, password, name);
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
      }
    } catch (err: any) {
      setError(err.message || "Failed to update password. Session may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!email || !tempToken) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center p-6 bg-white rounded-xl border border-border">
          <p className="text-sm text-muted-foreground mb-4">Invalid or missing verification session.</p>
          <Link to={isReset ? "/forgot-password" : "/signup"} className="text-sm font-semibold text-flamingo hover:underline">
            {isReset ? "Start Password Reset Again" : "Start Registration Again"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-alabaster">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-neutral-200/50 border border-neutral-200 p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 mb-3 rounded-2xl bg-flamingo/10 text-flamingo">
            {isReset ? <KeyRound className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            {isReset ? "Reset Your Password" : "Choose Your Password"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
            {isReset
              ? "Create a new strong password for your verified account"
              : "Step 3 of 3: Secure your verified account for"}{" "}
            <br />
            <strong className="text-neutral-900 break-all">{email}</strong>
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="break-words">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} method="POST" className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              {isReset ? "New Password" : "Create Password"}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" aria-hidden="true" />
              <input
                id="new-password"
                name="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                spellCheck={false}
                className="w-full pl-10 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-neutral-700 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition select-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" aria-hidden="true" />
              <input
                id="confirm-password"
                name="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                spellCheck={false}
                className="w-full pl-10 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-neutral-700 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition select-none"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Password Live Validation Criteria */}
          <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-xl space-y-2 text-xs">
            <span className="font-semibold text-neutral-700 block mb-1">Password Requirements:</span>
            
            <div className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                hasMinLength ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-400"
              }`}>
                {hasMinLength ? "✓" : "•"}
              </span>
              <span className={hasMinLength ? "text-neutral-800 font-medium" : "text-muted-foreground"}>
                At least 8 characters
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                hasLetter ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-400"
              }`}>
                {hasLetter ? "✓" : "•"}
              </span>
              <span className={hasLetter ? "text-neutral-800 font-medium" : "text-muted-foreground"}>
                Contains at least one letter (a-z, A-Z)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                hasNumber && notOnlyNumeric ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-400"
              }`}>
                {hasNumber && notOnlyNumeric ? "✓" : "•"}
              </span>
              <span className={hasNumber && notOnlyNumeric ? "text-neutral-800 font-medium" : "text-muted-foreground"}>
                Contains at least one number (cannot be numbers only)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                notCommonWeak && notRepeated && password.length >= 8 ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-400"
              }`}>
                {notCommonWeak && notRepeated && password.length >= 8 ? "✓" : "•"}
              </span>
              <span className={notCommonWeak && notRepeated && password.length >= 8 ? "text-neutral-800 font-medium" : "text-muted-foreground"}>
                Not an easily guessed or common password
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-neutral-200">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                passwordsMatch ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-400"
              }`}>
                {passwordsMatch ? "✓" : "•"}
              </span>
              <span className={passwordsMatch ? "text-emerald-700 font-medium" : "text-muted-foreground"}>
                Passwords match
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2.5 px-4 bg-flamingo hover:bg-flamingo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-flamingo/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isReset ? "Reset Password & Continue" : "Finalize Account & Enter Dashboard"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
