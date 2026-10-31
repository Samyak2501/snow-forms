import React, { useState } from"react";
import { Link, useNavigate, useSearchParams } from"react-router-dom";
import { api } from"../../lib/api";
import { useAuth } from"../../context/AuthContext";
import { Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from"lucide-react";

interface AuthErrorState {
 message: string;
 isUnverified?: boolean;
}

const INVALID_CREDENTIALS_MSG =
"Email or password is incorrect. Please check your credentials and try again.";

export function getAuthErrorMessage(err: any): AuthErrorState {
 // 1. Network or offline failure
 if (
 (typeof navigator !=="undefined"&& !navigator.onLine) ||
 err?.name ==="TypeError"||
 (typeof err?.message ==="string"&&
 (err.message.toLowerCase().includes("failed to fetch") ||
 err.message.toLowerCase().includes("networkerror") ||
 err.message.toLowerCase().includes("network request failed")))
 ) {
 return {
 message:"Unable to sign in right now. Please check your connection and try again.",
 };
 }

 const status = typeof err?.status ==="number"? err.status : undefined;
 const code = (err?.code || err?.data?.code ||"").toUpperCase();
 const rawMsg = (err?.message ||"").toLowerCase();

 // 2. Email verification required
 if (
 status === 403 ||
 code ==="EMAIL_NOT_VERIFIED"||
 code ==="USER_NOT_VERIFIED"||
 rawMsg.includes("verify your email") ||
 rawMsg.includes("email not verified") ||
 rawMsg.includes("verification required")
 ) {
 return {
 message:"Please verify your email address before signing in.",
 isUnverified: true,
 };
 }

 // 3. Too many attempts / Rate limiting
 if (
 status === 429 ||
 code ==="TOO_MANY_REQUESTS"||
 rawMsg.includes("too many requests") ||
 rawMsg.includes("rate limit")
 ) {
 return {
 message:"Too many sign-in attempts. Please wait a few minutes before trying again.",
 };
 }

 // 4. Server failure
 if (status && status >= 500) {
 return {
 message:"Unable to sign in right now. Please check your connection and try again.",
 };
 }

 // 5. Invalid credentials (401, credential errors, bad login)
 // Maps all credential issues (wrong password, unregistered email, bad input) to the exact generic message
 // to avoid revealing whether an account exists.
 if (
 status === 401 ||
 status === 400 ||
 code ==="INVALID_EMAIL_OR_PASSWORD"||
 code ==="USER_NOT_FOUND"||
 code ==="INVALID_CREDENTIALS"||
 code ==="INVALID_PASSWORD"||
 rawMsg.includes("invalid") ||
 rawMsg.includes("credential") ||
 rawMsg.includes("user not found") ||
 rawMsg.includes("not found") ||
 rawMsg.includes("password")
 ) {
 return {
 message: INVALID_CREDENTIALS_MSG,
 };
 }

 // 6. Safe generic fallback
 return {
 message: INVALID_CREDENTIALS_MSG,
 };
}

export const LoginPage: React.FC = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { refreshUser } = useAuth();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [resendingOtp, setResendingOtp] = useState(false);
 const [resendNotice, setResendNotice] = useState<string | null>(null);
 const [error, setError] = useState<AuthErrorState | null>(null);
 const resetSuccess = searchParams.get("reset") === "success";

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 setResendNotice(null);
 setLoading(true);

 try {
 await api.auth.login(email.trim().toLowerCase(), password);
 await refreshUser();
 const redirectTo = searchParams.get("redirect") ||"/dashboard";
 navigate(redirectTo);
 } catch (err: any) {
 setError(getAuthErrorMessage(err));
 } finally {
 setLoading(false);
 }
 };

 const handleResendVerification = async () => {
 const cleanEmail = email.trim().toLowerCase();
 if (!cleanEmail) return;
 setResendingOtp(true);
 setResendNotice(null);
 try {
 await api.auth.sendOtp(cleanEmail, undefined,"signup");
 setResendNotice("Verification code sent! Please check your inbox.");
 } catch {
 setResendNotice("Unable to resend code right now. Please try again later.");
 } finally {
 setResendingOtp(false);
 }
 };

 return (
 <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-alabaster">
 <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-neutral-200/50 border border-neutral-200 p-8">
 {/* Header */}
 <div className="text-center mb-8">
 <div className="inline-flex items-center justify-center p-2 mb-3 rounded-2xl bg-flamingo/10">
 <img src="/snowdevs.png"alt="Snow Devs Logo"className="w-12 h-12 object-contain"/>
 </div>
 <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
 Welcome back to Snow Forms
 </h1>
 <p className="text-sm text-muted-foreground mt-1.5">
 Sign in with your Avantika University account
 </p>
 </div>

 {resetSuccess && (
 <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5 animate-in fade-in">
 <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
 <div>Password reset successfully! You can now log in with your new password.</div>
 </div>
 )}

 {error && (
 <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex flex-col gap-2 animate-in fade-in">
 <div className="flex items-start gap-2.5">
 <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
 <div className="leading-snug">{error.message}</div>
 </div>

 {error.isUnverified && email.trim() && (
 <div className="mt-1 pt-2 border-t border-destructive/20 flex flex-wrap items-center justify-between gap-2 text-xs">
 <Link
 to={`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&purpose=signup`}
 className="font-bold underline hover:opacity-80"
 >
 Enter verification code
 </Link>
 <button
 type="button"
 disabled={resendingOtp}
 onClick={handleResendVerification}
 className="font-semibold underline hover:opacity-80 disabled:opacity-50"
 >
 {resendingOtp ?"Sending...":"Resend code"}
 </button>
 </div>
 )}

 {resendNotice && (
 <div className="mt-1 text-xs text-neutral-700">
 {resendNotice}
 </div>
 )}
 </div>
 )}

 {/* Form */}
 <form onSubmit={handleLogin} method="POST"className="space-y-4">
 <div>
 <label
 htmlFor="email"
 className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
 >
 College Email Address
 </label>
 <div className="relative">
 <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none"aria-hidden="true"/>
 <input
 id="email"
 name="email"
 type="email"
 autoComplete="username"
 required
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="student@avantika.edu.in"
 spellCheck={false}
 autoCapitalize="none"
 autoCorrect="off"
 className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
 />
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label
 htmlFor="password"
 className="text-xs font-semibold uppercase tracking-wider text-neutral-700"
 >
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
 <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none"aria-hidden="true"/>
 <input
 id="password"
 name="password"
 type={showPassword ?"text":"password"}
 autoComplete="current-password"
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="••••••••••••"
 spellCheck={false}
 className="w-full pl-10 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
 />
 <button
 type="button"
 onClick={() => setShowPassword((prev) => !prev)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-neutral-700 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-flamingo/40 transition select-none"
 aria-label={showPassword ?"Hide password":"Show password"}
 title={showPassword ?"Hide password":"Show password"}
 >
 {showPassword ? (
 <EyeOff className="w-4 h-4"aria-hidden="true"/>
 ) : (
 <Eye className="w-4 h-4"aria-hidden="true"/>
 )}
 </button>
 </div>
 </div>

 <button
 type="submit"
 disabled={loading}
 className="w-full py-2.5 px-4 bg-flamingo hover:bg-flamingo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-flamingo/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {loading ? (
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 ) : (
 <>
 Sign In
 <ArrowRight className="w-4 h-4"/>
 </>
 )}
 </button>
 </form>

 {/* Footer */}
 <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
 <p className="text-sm text-muted-foreground">
 New to Snow Forms?{""}
 <Link to="/signup"className="text-flamingo font-semibold hover:underline">
 Register with college email
 </Link>
 </p>
 </div>
 </div>
 </div>
 );
};
