import React, { useState } from"react";
import { useNavigate, useSearchParams, Link } from"react-router-dom";
import { api } from"../../lib/api";
import { useAuth } from"../../context/AuthContext";
import { Lock, Check, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff } from"lucide-react";
import confetti from"canvas-confetti";

export const SetPasswordPage: React.FC = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { refreshUser } = useAuth();

 const email = searchParams.get("email") ||"";
 const tempToken = searchParams.get("tempToken") ||"";
 const name = searchParams.get("name") ||"";

 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
 colors: ["#F16222","#FAFAFA","#1F1F1F"],
 });
 } catch {}

 await refreshUser();
 navigate("/dashboard");
 } catch (err: any) {
 setError(err.message ||"Failed to set password. Session may have expired.");
 } finally {
 setLoading(false);
 }
 };

 if (!email || !tempToken) {
 return (
 <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
 <div className="text-center p-6 bg-white rounded-xl border border-border">
 <p className="text-sm text-muted-foreground mb-4">Invalid or missing verification session.</p>
 <Link to="/signup"className="text-sm font-semibold text-flamingo hover:underline">
 Start Registration Again
 </Link>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-alabaster">
 <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-neutral-200/50 border border-neutral-200 p-8">
 {/* Header */}
 <div className="text-center mb-6">
 <div className="inline-flex items-center justify-center p-3 mb-3 rounded-2xl bg-flamingo/10 text-flamingo">
 <ShieldCheck className="w-8 h-8"/>
 </div>
 <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
 Choose Your Password
 </h1>
 <p className="text-sm text-muted-foreground mt-1.5">
 Step 3 of 3: Secure your verified account for <br />
 <strong className="text-neutral-900">{email}</strong>
 </p>
 </div>

 {error && (
 <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in">
 <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
 <div>{error}</div>
 </div>
 )}

 {/* Form */}
 <form onSubmit={handleSubmit} method="POST"className="space-y-4">
 <div>
 <label
 htmlFor="new-password"
 className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
 >
 Create Password
 </label>
 <div className="relative">
 <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none"aria-hidden="true"/>
 <input
 id="new-password"
 name="new-password"
 type={showPassword ?"text":"password"}
 autoComplete="new-password"
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="At least 8 characters"
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

 <div>
 <label
 htmlFor="confirm-password"
 className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
 >
 Confirm Password
 </label>
 <div className="relative">
 <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none"aria-hidden="true"/>
 <input
 id="confirm-password"
 name="confirm-password"
 type={showConfirmPassword ?"text":"password"}
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
 aria-label={showConfirmPassword ?"Hide password":"Show password"}
 title={showConfirmPassword ?"Hide password":"Show password"}
 >
 {showConfirmPassword ? (
 <EyeOff className="w-4 h-4"aria-hidden="true"/>
 ) : (
 <Eye className="w-4 h-4"aria-hidden="true"/>
 )}
 </button>
 </div>
 </div>

 {/* Password criteria */}
 <div className="p-3 bg-neutral-50 rounded-xl space-y-1.5 text-xs text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${password.length >= 8 ?"bg-emerald-500 text-white":"bg-neutral-300 text-neutral-500"}`}>✓</span>
 <span>Minimum 8 characters in length</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${password && password === confirmPassword ?"bg-emerald-500 text-white":"bg-neutral-300 text-neutral-500"}`}>✓</span>
 <span>Passwords match</span>
 </div>
 </div>

 <button
 type="submit"
 disabled={loading}
 className="w-full py-2.5 px-4 bg-flamingo hover:bg-flamingo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-flamingo/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
 >
 {loading ? (
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 ) : (
 <>
 Finalize Account & Enter Dashboard
 <ArrowRight className="w-4 h-4"/>
 </>
 )}
 </button>
 </form>
 </div>
 </div>
 );
};
