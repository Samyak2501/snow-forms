import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FileText,
  CheckCircle2,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Split,
  GraduationCap,
  ArrowRight,
  Layers,
  Clock,
  Download,
  Users,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-alabaster dark:bg-neutral-950 text-foreground selection:bg-flamingo selection:text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        {/* Subtle decorative background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-flamingo/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            {/* Campus Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-flamingo/10 border border-flamingo/20 text-flamingo text-xs font-bold tracking-wide uppercase mb-6 animate-in fade-in slide-in-from-bottom-2">
              <GraduationCap className="w-4 h-4" />
              <span>Avantika University &bull; Official Form Engine</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-[1.15]">
              Form collection built for <br />
              <span className="text-flamingo">Avantika University.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed">
              Replace outdated Google Forms with high-performance, branded registrations, quizzes, academic surveys, and feedback collection.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              {user ? (
                <Link
                  to="/dashboard"
                  className="w-full sm:w-auto px-7 py-3.5 bg-flamingo hover:bg-flamingo-600 text-white font-semibold rounded-xl shadow-lg shadow-flamingo/25 flex items-center justify-center gap-2 transition active:scale-95"
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="w-full sm:w-auto px-7 py-3.5 bg-flamingo hover:bg-flamingo-600 text-white font-semibold rounded-xl shadow-lg shadow-flamingo/25 flex items-center justify-center gap-2 transition active:scale-95 text-base"
                  >
                    Get Started with College Email
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto px-7 py-3.5 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 font-semibold rounded-xl shadow-sm transition active:scale-95 text-base"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Campus Trust Note */}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                @avantika.edu.in Verified
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                100% Free for Campus
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                Real-time Analytics
              </span>
            </div>
          </div>

          {/* Interactive Feature Preview Card */}
          <div className="mt-14 max-w-4xl mx-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-6 shadow-2xl shadow-neutral-200/50 dark:shadow-none">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-mono text-muted-foreground">
                  au-forms.avantika.edu.in/forms/event-registration
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Live Preview
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-flamingo/5 border-l-4 border-flamingo">
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                  Design Thinking Symposium 2026 Registration
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
                  Avantika University School of Design & Technology &bull; Annual Innovation Conclave
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Department / Major *
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    B.Des - Interaction Design
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Preferred Workshop Track *
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs bg-flamingo text-white font-medium">
                      AI & UI/UX
                    </span>
                    <span className="px-2.5 py-1 rounded-md text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                      Product Systems
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Breakdown Grid */}
      <section className="py-20 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
              Google Forms Power, Tailored for Avantika
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every feature you rely on in Google Forms, engineered natively with campus-first privacy and custom branding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 hover:border-flamingo/40 transition">
              <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">All 11 Question Formats</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Short answer, paragraph, multiple choice (with write-in "Other"), checkboxes, dropdowns, linear rating scales, matrix grids, date, time, and file uploads.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 hover:border-flamingo/40 transition">
              <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Quizzing & Auto-Grading</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Assign point weights, configure objective answer keys, provide automated correct/incorrect feedback with video links, and release scores instantly.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 hover:border-flamingo/40 transition">
              <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
                <Split className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Conditional Logic & Sections</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Multi-page sections with dynamic "Go to section based on answer" routing rules, question shuffling, and progress bar trackers.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 hover:border-flamingo/40 transition">
              <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Instant Analytics & Charts</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Automated pie charts, bar distributions, and rating averages that update in real time with persisted Turso responses.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 hover:border-flamingo/40 transition">
              <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Schedules & Capacity Limits</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Set opening times, closing deadlines, maximum response caps, and limit to 1 response per human with server-side enforcement.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 hover:border-flamingo/40 transition">
              <div className="w-12 h-12 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center mb-4">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">CSV & Spreadsheet Export</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Download your clean, tabular data in CSV format ready for Microsoft Excel, Google Sheets, or institutional archiving.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/avantika-logo.svg" alt="Avantika University" className="w-8 h-8 object-contain" />
            <div className="text-xs text-muted-foreground">
              <strong>Avantika University</strong> &bull; Vishwagarma, Ujjain, Madhya Pradesh, India.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            AU Forms &bull; Built with Flamingo & Alabaster Design System
          </div>
        </div>
      </footer>
    </div>
  );
};
