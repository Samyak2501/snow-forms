import React, { useState, useEffect } from"react";
import { useAuth } from"../context/AuthContext";
import { api } from"../lib/api";
import {
 User as UserIcon,
 Mail,
 ShieldCheck,
 FileText,
 BarChart3,
 LogOut,
 Calendar,
 Building,
} from"lucide-react";

export const ProfilePage: React.FC = () => {
 const { user, logout } = useAuth();
 const [stats, setStats] = useState({
 totalForms: 0,
 publishedForms: 0,
 draftForms: 0,
 closedForms: 0,
 });

 useEffect(() => {
 api.auth
 .getMe()
 .then((data) => {
 if (data.stats) setStats(data.stats);
 })
 .catch(console.error);
 }, []);

 return (
 <div className="min-h-[calc(100vh-4rem)] bg-alabaster p-4 sm:p-6 lg:p-8">
 <div className="max-w-3xl mx-auto space-y-6">
 {/* Profile Card */}
 <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
 <div className="flex flex-col sm:flex-row items-center gap-6">
 <div className="w-20 h-20 rounded-2xl bg-flamingo/15 text-flamingo font-extrabold text-3xl flex items-center justify-center border-2 border-flamingo/20">
 {user?.name?.charAt(0).toUpperCase() ||"A"}
 </div>

 <div className="text-center sm:text-left flex-1">
 <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
 <h1 className="text-2xl font-bold text-neutral-900">
 {user?.name}
 </h1>
 <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
 <ShieldCheck className="w-3.5 h-3.5"/>
 Verified College Account
 </span>
 </div>

 <div className="mt-2 space-y-1 text-xs text-muted-foreground">
 <div className="flex items-center justify-center sm:justify-start gap-2">
 <Mail className="w-4 h-4 text-flamingo"/>
 <span>{user?.email}</span>
 </div>
 <div className="flex items-center justify-center sm:justify-start gap-2">
 <Building className="w-4 h-4 text-flamingo"/>
 <span>Avantika University &bull; Ujjain, Madhya Pradesh</span>
 </div>
 </div>
 </div>

 <button
 onClick={logout}
 className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-xl transition"
 >
 <LogOut className="w-4 h-4"/>
 <span>Sign Out</span>
 </button>
 </div>
 </div>

 {/* Account Activity Stats */}
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
 <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
 Your Form Activity
 </h2>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 <div className="p-4 bg-neutral-50 rounded-xl border border-border text-center">
 <div className="text-xs text-muted-foreground">Total Forms</div>
 <div className="text-2xl font-extrabold text-neutral-900 mt-1">
 {stats.totalForms}
 </div>
 </div>

 <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center">
 <div className="text-xs text-emerald-600">Published</div>
 <div className="text-2xl font-extrabold text-emerald-600 mt-1">
 {stats.publishedForms}
 </div>
 </div>

 <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 text-center">
 <div className="text-xs text-amber-600">Drafts</div>
 <div className="text-2xl font-extrabold text-amber-600 mt-1">
 {stats.draftForms}
 </div>
 </div>

 <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100 text-center">
 <div className="text-xs text-rose-600">Closed</div>
 <div className="text-2xl font-extrabold text-rose-600 mt-1">
 {stats.closedForms}
 </div>
 </div>
 </div>
 </div>

 {/* Security & Password Guidelines */}
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm text-xs text-muted-foreground space-y-2">
 <h3 className="font-bold text-sm text-neutral-900">
 Security & University Privacy Policy
 </h3>
 <p className="leading-relaxed">
 Your Snow Forms account is authenticated using encrypted sessions stored directly in Avantika University's Turso database. Single-use OTPs are sent through the authorized Avantika University email notification system.
 </p>
 </div>
 </div>
 </div>
 );
};
