import React from "react";
import { FormItem } from "../../lib/api";
import {
  GraduationCap,
  Mail,
  ShieldCheck,
  RotateCw,
  Eye,
  Clock,
  Palette,
  CheckCircle2,
} from "lucide-react";

interface SettingsTabProps {
  form: FormItem & {
    themeSettings: any;
    formSettings: any;
    quizSettings: any;
  };
  onChange: (updates: any) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ form, onChange }) => {
  const formSettings = form.formSettings || {};
  const quizSettings = form.quizSettings || {};
  const themeSettings = form.themeSettings || {};

  const updateFormSettings = (key: string, value: any) => {
    onChange({
      formSettings: { ...formSettings, [key]: value },
    });
  };

  const updateQuizSettings = (key: string, value: any) => {
    onChange({
      quizSettings: { ...quizSettings, [key]: value },
    });
  };

  const updateThemeSettings = (key: string, value: any) => {
    onChange({
      themeSettings: { ...themeSettings, [key]: value },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* 1. QUIZ SETTINGS */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">Make this a quiz</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign point values, set correct answers, and automatically score responses
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(form.isQuiz)}
              onChange={(e) => onChange({ isQuiz: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-flamingo" />
          </label>
        </div>

        {form.isQuiz && (
          <div className="mt-5 space-y-4 text-xs animate-in fade-in">
            <div>
              <label className="font-semibold text-neutral-800 dark:text-neutral-200 block mb-2">
                Release grades
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="release"
                    checked={quizSettings.immediateRelease !== false}
                    onChange={() => updateQuizSettings("immediateRelease", true)}
                    className="accent-flamingo"
                  />
                  <span>Immediately after each submission (instant auto-score)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="release"
                    checked={quizSettings.immediateRelease === false}
                    onChange={() => updateQuizSettings("immediateRelease", false)}
                    className="accent-flamingo"
                  />
                  <span>Later, after manual review (for paragraph / subjective evaluation)</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2.5">
              <label className="font-semibold text-neutral-800 dark:text-neutral-200 block">
                Respondent visibility
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Missed questions (identify incorrect answers)</span>
                <input
                  type="checkbox"
                  checked={quizSettings.showMissedQuestions !== false}
                  onChange={(e) => updateQuizSettings("showMissedQuestions", e.target.checked)}
                  className="accent-flamingo"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Correct answers (show answer keys after grades released)</span>
                <input
                  type="checkbox"
                  checked={quizSettings.showCorrectAnswers !== false}
                  onChange={(e) => updateQuizSettings("showCorrectAnswers", e.target.checked)}
                  className="accent-flamingo"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Point values (show total points and points received per question)</span>
                <input
                  type="checkbox"
                  checked={quizSettings.showPoints !== false}
                  onChange={(e) => updateQuizSettings("showPoints", e.target.checked)}
                  className="accent-flamingo"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 2. RESPONSES & ACCESS CONTROLS */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">Responses & Access</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage respondent permissions, university authentication, and capacity
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-neutral-800 dark:text-neutral-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-semibold">Collect email addresses</div>
              <div className="text-[11px] text-muted-foreground">Prompt respondents for their email address</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(formSettings.collectEmail)}
              onChange={(e) => updateFormSettings("collectEmail", e.target.checked)}
              className="accent-flamingo w-4 h-4 rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-semibold">Restrict to Avantika University accounts</div>
              <div className="text-[11px] text-muted-foreground">
                Requires logging in with an official @avantika.edu.in account
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(formSettings.requireCollegeLogin)}
              onChange={(e) => updateFormSettings("requireCollegeLogin", e.target.checked)}
              className="accent-flamingo w-4 h-4 rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-semibold">Limit to 1 response</div>
              <div className="text-[11px] text-muted-foreground">
                Prevents multiple submissions from the same student or email
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(formSettings.limitOneResponse)}
              onChange={(e) => updateFormSettings("limitOneResponse", e.target.checked)}
              className="accent-flamingo w-4 h-4 rounded"
            />
          </label>
        </div>
      </div>

      {/* 3. SCHEDULE & DEADLINES */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">Schedule & Deadlines</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automate opening and closing times with server-enforced deadline checks
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Opening Time (Optional)</label>
            <input
              type="datetime-local"
              value={form.opensAt ? new Date(form.opensAt).toISOString().slice(0, 16) : ""}
              onChange={(e) => onChange({ opensAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Closing Deadline (Optional)</label>
            <input
              type="datetime-local"
              value={form.closesAt ? new Date(form.closesAt).toISOString().slice(0, 16) : ""}
              onChange={(e) => onChange({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-semibold block mb-1">Maximum Response Limit (Optional)</label>
            <input
              type="number"
              min={1}
              value={form.maxResponses || ""}
              onChange={(e) => onChange({ maxResponses: e.target.value ? parseInt(e.target.value, 10) : null })}
              placeholder="e.g. 100 registrations max"
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* 4. PRESENTATION & CONFIRMATION */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">Presentation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize progress bars, question ordering, and completion messages
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-neutral-800 dark:text-neutral-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-semibold">Show progress bar</div>
              <div className="text-[11px] text-muted-foreground">Displays completion bar across multi-section forms</div>
            </div>
            <input
              type="checkbox"
              checked={formSettings.showProgressBar !== false}
              onChange={(e) => updateFormSettings("showProgressBar", e.target.checked)}
              className="accent-flamingo w-4 h-4 rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-semibold">Shuffle question order</div>
              <div className="text-[11px] text-muted-foreground">Randomizes question sequence for each respondent</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(formSettings.shuffleQuestions)}
              onChange={(e) => updateFormSettings("shuffleQuestions", e.target.checked)}
              className="accent-flamingo w-4 h-4 rounded"
            />
          </label>

          <div>
            <label className="font-semibold block mb-1">Confirmation message</label>
            <textarea
              rows={2}
              value={formSettings.confirmationMessage || "Your response has been recorded. Thank you!"}
              onChange={(e) => updateFormSettings("confirmationMessage", e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* 5. THEME & HEADER IMAGE */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">Theme & Header Banner</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Avantika University Coding Ninjas Brand System (Flamingo #F16222 & Alabaster #FAFAFA)
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Header Image URL (Optional)</label>
            <input
              type="url"
              value={themeSettings.headerImage || ""}
              onChange={(e) => updateThemeSettings("headerImage", e.target.value)}
              placeholder="https://... (banner image above form header)"
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Font Family</label>
            <select
              value={themeSettings.fontFamily || "Inter"}
              onChange={(e) => updateThemeSettings("fontFamily", e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
            >
              <option value="Inter">Inter (Clean Modern Sans)</option>
              <option value="Outfit">Outfit (Avantika Brand Display)</option>
              <option value="Roboto">Roboto</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
