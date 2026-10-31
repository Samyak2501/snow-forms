import React from"react";
import { Link, Navigate } from"react-router-dom";
import { useAuth } from"../context/AuthContext";
import {
 FileText,
 CheckCircle2,
 BarChart3,
 Sparkles,
 ShieldCheck,
 Split,
 GraduationCap,
 ArrowRight,
 Clock,
 Download,
} from"lucide-react";

export const LandingPage: React.FC = () => {
 const { user, loading } = useAuth();

 if (loading) {
 return (
 <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-alabaster">
 <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin"/>
 </div>
 );
 }

 if (user) {
 return <Navigate to="/dashboard"replace />;
 }

 return (
 <div className="min-h-screen bg-alabaster text-foreground selection:bg-flamingo selection:text-white">
 {/* Hero Section */}
 <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
 {/* Subtle decorative background glow */}
 <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-flamingo/10 rounded-full blur-[120px] pointer-events-none"/>

 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
 <div className="text-center max-w-3xl mx-auto">
 {/* Campus Badge */}
 <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-flamingo/10 border border-flamingo/20 text-flamingo text-xs font-bold tracking-wide uppercase mb-6 animate-in fade-in slide-in-from-bottom-2">
 <GraduationCap className="w-4 h-4"/>
 <span>Snow Manage &bull; Official Form Engine</span>
 </div>

 {/* Headline */}
 <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.15]">
 Form collection built for <br />
 <span className="text-flamingo">Avantika University.</span>
 </h1>

 {/* Subtitle */}
 <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed">
 Replace outdated Google Forms with high-performance, branded registrations, quizzes, academic surveys, and feedback collection.
 </p>

 {/* CTAs */}
 <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
 <Link
 to="/signup"
 className="w-full sm:w-auto px-7 py-3.5 bg-flamingo hover:bg-flamingo-600 text-white font-semibold rounded-xl shadow-lg shadow-flamingo/25 flex items-center justify-center gap-2 transition active:scale-95 text-base"
 >
 Get Started with College Email
 <ArrowRight className="w-4 h-4"/>
 </Link>
 <Link
 to="/login"
 className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 font-semibold rounded-xl shadow-sm transition active:scale-95 text-base"
 >
 Sign In
 </Link>
 </div>

 {/* Campus Trust Note */}
 <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
 <span className="flex items-center gap-1.5">
 <ShieldCheck className="w-4 h-4 text-emerald-500"/>
 @avantika.edu.in Verified
 </span>
 <span className="flex items-center gap-1.5">
 <CheckCircle2 className="w-4 h-4 text-emerald-500"/>
 100% Free for Campus
 </span>
 <span className="flex items-center gap-1.5">
 <Sparkles className="w-4 h-4 text-emerald-500"/>
 Real-time Analytics
 </span>
 </div>
 </div>
 </div>
 </section>

 {/* Feature Breakdown Grid */}
 <section className="py-20 bg-white border-t border-neutral-200">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
 <div className="text-center max-w-2xl mx-auto mb-16">
 <h2 className="text-3xl font-extrabold text-neutral-900">
 Google Forms Power, Tailored for Avantika
 </h2>
 <p className="mt-3 text-muted-foreground">
 Every feature you rely on in Google Forms, engineered natively with campus-first privacy and custom branding.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
 {/* Feature 1 */}
 <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-flamingo/40 transition">
 <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
 <FileText className="w-6 h-6"/>
 </div>
 <h3 className="text-lg font-bold text-neutral-900">All 11 Question Formats</h3>
 <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
 Short answer, paragraph, multiple choice (with write-in"Other"), checkboxes, dropdowns, linear rating scales, matrix grids, date, time, and file uploads.
 </p>
 </div>

 {/* Feature 2 */}
 <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-flamingo/40 transition">
 <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
 <GraduationCap className="w-6 h-6"/>
 </div>
 <h3 className="text-lg font-bold text-neutral-900">Quizzing & Auto-Grading</h3>
 <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
 Assign point weights, configure objective answer keys, provide automated correct/incorrect feedback with video links, and release scores instantly.
 </p>
 </div>

 {/* Feature 3 */}
 <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-flamingo/40 transition">
 <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
 <Split className="w-6 h-6"/>
 </div>
 <h3 className="text-lg font-bold text-neutral-900">Conditional Logic & Sections</h3>
 <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
 Multi-page sections with dynamic"Go to section based on answer"routing rules, question shuffling, and progress bar trackers.
 </p>
 </div>

 {/* Feature 4 */}
 <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-flamingo/40 transition">
 <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
 <BarChart3 className="w-6 h-6"/>
 </div>
 <h3 className="text-lg font-bold text-neutral-900">Instant Analytics & Charts</h3>
 <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
 Automated pie charts, bar distributions, and rating averages that update in real time with persisted Turso responses.
 </p>
 </div>

 {/* Feature 5 */}
 <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-flamingo/40 transition">
 <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
 <Clock className="w-6 h-6"/>
 </div>
 <h3 className="text-lg font-bold text-neutral-900">Schedules & Capacity Limits</h3>
 <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
 Set opening times, closing deadlines, maximum response caps, and limit to 1 response per human with server-side enforcement.
 </p>
 </div>

 {/* Feature 6 */}
 <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-flamingo/40 transition">
 <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
 <Download className="w-6 h-6"/>
 </div>
 <h3 className="text-lg font-bold text-neutral-900">CSV & Spreadsheet Export</h3>
 <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
 Download your clean, tabular data in CSV format ready for Microsoft Excel, Google Sheets, or institutional archiving.
 </p>
 </div>
 </div>
 </div>
 </section>

 {/* Footer */}
 <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <img src="/avantika-logo.svg"alt="Avantika University"className="w-8 h-8 object-contain"/>
 <div className="text-xs text-muted-foreground">
 <strong>Avantika University</strong> &bull; Vishwagarma, Ujjain, Madhya Pradesh, India.
 </div>
 </div>
 <div className="text-xs text-muted-foreground">
 Snow Forms &bull; Built with Flamingo & Alabaster Design System
 </div>
 </div>
 </footer>
 </div>
 );
};
