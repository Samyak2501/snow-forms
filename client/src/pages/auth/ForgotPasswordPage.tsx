import React, { useState } from"react";
import { Link, useNavigate } from"react-router-dom";
import { api } from"../../lib/api";
import { Mail, ArrowRight, AlertCircle, KeyRound } from"lucide-react";

export const ForgotPasswordPage: React.FC = () => {
 const navigate = useNavigate();
 const [email, setEmail] = useState("");
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 setLoading(true);

 try {
 await api.auth.sendOtp(email.trim().toLowerCase(), undefined,"password_reset");
 navigate(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&purpose=password_reset`);
 } catch (err: any) {
 setError(err.message ||"Failed to initiate password reset.");
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-alabaster">
 <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-neutral-200/50 border border-neutral-200 p-8">
 <div className="text-center mb-8">
 <div className="inline-flex items-center justify-center p-3 mb-3 rounded-2xl bg-flamingo/10 text-flamingo">
 <KeyRound className="w-8 h-8"/>
 </div>
 <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
 Reset Password
 </h1>
 <p className="text-sm text-muted-foreground mt-1.5">
 Enter your Avantika University email to receive a password reset code
 </p>
 </div>

 {error && (
 <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in">
 <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
 <div>{error}</div>
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
 College Email (@avantika.edu.in)
 </label>
 <div className="relative">
 <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5"/>
 <input
 type="email"
 required
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="student@avantika.edu.in"
 className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
 />
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
 Send Reset Code
 <ArrowRight className="w-4 h-4"/>
 </>
 )}
 </button>
 </form>

 <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
 <Link to="/login"className="text-sm text-flamingo font-semibold hover:underline">
 Back to Sign In
 </Link>
 </div>
 </div>
 </div>
 );
};
