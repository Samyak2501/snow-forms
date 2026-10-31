import React, { useState, useEffect, useRef } from"react";
import { useNavigate, useSearchParams, Link } from"react-router-dom";
import { api } from"../../lib/api";
import { KeyRound, ArrowRight, RotateCw, AlertCircle, Clock } from"lucide-react";

export const VerifyOtpPage: React.FC = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const email = searchParams.get("email") ||"";
 const name = searchParams.get("name") ||"";
 const purpose = (searchParams.get("purpose") as"signup"|"password_reset") ||"signup";

 const [digits, setDigits] = useState(["","","","","",""]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [resending, setResending] = useState(false);
 const [cooldown, setCooldown] = useState(45);
 const [timerSeconds, setTimerSeconds] = useState(300); // 5 minutes

 const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

 // 5-minute countdown
 useEffect(() => {
 if (timerSeconds <= 0) return;
 const interval = setInterval(() => {
 setTimerSeconds((prev) => prev - 1);
 }, 1000);
 return () => clearInterval(interval);
 }, [timerSeconds]);

 // Resend cooldown countdown
 useEffect(() => {
 if (cooldown <= 0) return;
 const interval = setInterval(() => {
 setCooldown((prev) => prev - 1);
 }, 1000);
 return () => clearInterval(interval);
 }, [cooldown]);

 const handleDigitChange = (index: number, val: string) => {
 if (!/^\d*$/.test(val)) return;

 const newDigits = [...digits];
 newDigits[index] = val.slice(-1);
 setDigits(newDigits);

 // Auto advance focus
 if (val && index < 5) {
 inputsRef.current[index + 1]?.focus();
 }
 };

 const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
 if (e.key ==="Backspace"&& !digits[index] && index > 0) {
 inputsRef.current[index - 1]?.focus();
 }
 };

 const handlePaste = (e: React.ClipboardEvent) => {
 e.preventDefault();
 const pasteData = e.clipboardData.getData("text").trim();
 if (/^\d{6}$/.test(pasteData)) {
 const splitDigits = pasteData.split("");
 setDigits(splitDigits);
 inputsRef.current[5]?.focus();
 }
 };

 const handleVerify = async (e: React.FormEvent) => {
 e.preventDefault();
 const code = digits.join("");
 if (code.length !== 6) {
 setError("Please enter the complete 6-digit verification code.");
 return;
 }

 setError(null);
 setLoading(true);

 try {
 const res = await api.auth.verifyOtp(email, code, purpose);
 if (purpose ==="signup") {
 navigate(
`/set-password?email=${encodeURIComponent(email)}&tempToken=${encodeURIComponent(
 res.tempToken
 )}&name=${encodeURIComponent(name)}`
 );
 } else {
 navigate(
`/reset-password-confirm?email=${encodeURIComponent(email)}&tempToken=${encodeURIComponent(
 res.tempToken
 )}`
 );
 }
 } catch (err: any) {
 setError(err.message ||"Verification failed. Check the code and try again.");
 } finally {
 setLoading(false);
 }
 };

 const handleResend = async () => {
 if (cooldown > 0) return;
 setResending(true);
 setError(null);

 try {
 const res = await api.auth.sendOtp(email, name, purpose);
 setCooldown(res.cooldownSeconds || 45);
 setTimerSeconds(300);
 setDigits(["","","","","",""]);
 inputsRef.current[0]?.focus();
 } catch (err: any) {
 setError(err.message ||"Failed to resend code.");
 } finally {
 setResending(false);
 }
 };

 const formatTimer = (seconds: number) => {
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return`${mins}:${secs < 10 ?"0":""}${secs}`;
 };

 if (!email) {
 return (
 <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
 <div className="text-center p-6 bg-white rounded-xl border border-border">
 <p className="text-sm text-muted-foreground mb-4">No email specified for verification.</p>
 <Link to="/signup"className="text-sm font-semibold text-flamingo hover:underline">
 Go to Signup
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
 <KeyRound className="w-8 h-8"/>
 </div>
 <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
 Verify 6-Digit Code
 </h1>
 <p className="text-sm text-muted-foreground mt-1.5">
 We sent a verification code to <br />
 <strong className="text-neutral-900">{email}</strong>
 </p>
 </div>

 {/* Expiry Countdown */}
 <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium text-neutral-600 bg-neutral-100 py-2 px-3 rounded-xl">
 <Clock className="w-4 h-4 text-flamingo"/>
 <span>Code expires in:</span>
 <span className="font-bold text-flamingo font-mono text-sm">{formatTimer(timerSeconds)}</span>
 </div>

 {error && (
 <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in">
 <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
 <div>{error}</div>
 </div>
 )}

 {/* Form */}
 <form onSubmit={handleVerify} className="space-y-6">
 {/* 6 Digit Inputs */}
 <div className="flex justify-center gap-2 sm:gap-3"onPaste={handlePaste}>
 {digits.map((digit, idx) => (
 <input
 key={idx}
 ref={(el) => (inputsRef.current[idx] = el)}
 type="text"
 inputMode="numeric"
 maxLength={1}
 value={digit}
 onChange={(e) => handleDigitChange(idx, e.target.value)}
 onKeyDown={(e) => handleKeyDown(idx, e)}
 className="w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-bold font-mono bg-neutral-50 border-2 border-neutral-300 rounded-xl focus:outline-none focus:border-flamingo focus:ring-2 focus:ring-flamingo/20 transition"
 />
 ))}
 </div>

 <p className="text-center text-xs text-muted-foreground">
 Maximum 3 attempts per code. Single-use only.
 </p>

 <button
 type="submit"
 disabled={loading || digits.join("").length !== 6 || timerSeconds <= 0}
 className="w-full py-2.5 px-4 bg-flamingo hover:bg-flamingo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-flamingo/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {loading ? (
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 ) : (
 <>
 Verify Code & Continue
 <ArrowRight className="w-4 h-4"/>
 </>
 )}
 </button>
 </form>

 {/* Resend Action */}
 <div className="mt-6 text-center">
 <button
 type="button"
 disabled={cooldown > 0 || resending}
 onClick={handleResend}
 className="inline-flex items-center gap-1.5 text-xs font-semibold text-flamingo hover:text-flamingo-700 disabled:opacity-50 disabled:hover:text-flamingo transition"
 >
 <RotateCw className={`w-3.5 h-3.5 ${resending ?"animate-spin":""}`} />
 {cooldown > 0 ?`Resend code in ${cooldown}s`:"Didn't receive code? Resend"}
 </button>
 </div>
 </div>
 </div>
 );
};
