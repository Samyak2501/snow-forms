import React, { useState } from"react";
import { Link, useNavigate } from"react-router-dom";
import { api } from"../../lib/api";
import { Mail, User as UserIcon, ArrowRight, AlertCircle, ShieldCheck } from"lucide-react";

export const SignupPage: React.FC = () => {
 const navigate = useNavigate();
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSignup = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);

 const cleanEmail = email.trim().toLowerCase();
 if (!cleanEmail.endsWith("@avantika.edu.in") && !cleanEmail.endsWith(".avantika.edu.in")) {
 setError("Registration is strictly restricted to Avantika University accounts (@avantika.edu.in).");
 return;
 }

 setLoading(true);
 try {
 await api.auth.sendOtp(cleanEmail, name.trim(),"signup");
 // Navigate to verification screen with email and name state
 navigate(`/verify-otp?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(name.trim())}&purpose=signup`);
 } catch (err: any) {
 setError(err.message ||"Failed to send verification code. Please check your email.");
 } finally {
 setLoading(false);
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
 Create your Snow Forms Account
 </h1>
 <p className="text-sm text-muted-foreground mt-1.5">
 Step 1 of 3: College Email Verification
 </p>
 </div>

 {/* Security Notice */}
 <div className="mb-6 p-3.5 rounded-xl bg-flamingo/5 border border-flamingo/20 flex items-start gap-2.5">
 <ShieldCheck className="w-5 h-5 text-flamingo flex-shrink-0 mt-0.5"/>
 <div className="text-xs text-neutral-600 leading-relaxed">
 Enter your official <strong className="text-flamingo">@avantika.edu.in</strong> email address. We'll send a single-use 6-digit OTP code to verify your campus identity.
 </div>
 </div>

 {error && (
 <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in">
 <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
 <div>{error}</div>
 </div>
 )}

 {/* Form */}
 <form onSubmit={handleSignup} className="space-y-4">
 <div>
 <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
 Full Name
 </label>
 <div className="relative">
 <UserIcon className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5"/>
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Enter your full name"
 className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo focus:border-transparent transition"
 />
 </div>
 </div>

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
 <p className="text-[11px] text-muted-foreground mt-1">
 Must end with @avantika.edu.in
 </p>
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
 Send Verification Code
 <ArrowRight className="w-4 h-4"/>
 </>
 )}
 </button>
 </form>

 {/* Footer */}
 <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
 <p className="text-sm text-muted-foreground">
 Already have an account?{""}
 <Link to="/login"className="text-flamingo font-semibold hover:underline">
 Sign In
 </Link>
 </p>
 </div>
 </div>
 </div>
 );
};
