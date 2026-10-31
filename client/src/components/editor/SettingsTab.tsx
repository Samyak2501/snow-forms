import React, { useState, useRef } from"react";
import { FormItem, api } from"../../lib/api";
import {
 GraduationCap,
 Mail,
 ShieldCheck,
 RotateCw,
 Eye,
 Clock,
 Palette,
 CheckCircle2,
 Upload,
 Link2,
 Loader2,
 X,
 AlertCircle,
 Trash2,
 Image as ImageIcon,
} from"lucide-react";

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

 const [bannerProgress, setBannerProgress] = useState<number | null>(null);
 const [isUploadingBanner, setIsUploadingBanner] = useState(false);
 const [bannerError, setBannerError] = useState<string | null>(null);
 const [bannerUrlInput, setBannerUrlInput] = useState("");
 const bannerInputRef = useRef<HTMLInputElement | null>(null);

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

 const handleBannerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setBannerError(null);
 const allowed = ["image/jpeg","image/png","image/webp","image/gif"];
 if (!allowed.includes(file.type)) {
 setBannerError("Please select a valid image (JPEG, PNG, WebP, GIF).");
 return;
 }

 if (file.size > 10 * 1024 * 1024) {
 setBannerError("Image size exceeds the 10MB limit.");
 return;
 }

 setIsUploadingBanner(true);
 setBannerProgress(0);

 try {
 let res;
 if (form.id) {
 res = await api.media.uploadForForm(form.id, file, (percent) => {
 setBannerProgress(percent);
 });
 } else {
 res = await api.media.uploadGeneric(file, (percent) => {
 setBannerProgress(percent);
 });
 }
 updateThemeSettings("headerImage", res.url);
 setBannerProgress(null);
 } catch (err: any) {
 console.error("Banner upload failed", err);
 setBannerError(err.message ||"Failed to upload banner image.");
 } finally {
 setIsUploadingBanner(false);
 if (bannerInputRef.current) {
 bannerInputRef.current.value ="";
 }
 }
 };

 return (
 <div className="max-w-3xl mx-auto space-y-6 pb-20">
 {/* 1. QUIZ SETTINGS */}
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
 <div className="flex items-center justify-between pb-4 border-b border-border">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
 <GraduationCap className="w-5 h-5"/>
 </div>
 <div>
 <h3 className="font-bold text-base text-neutral-900">Make this a quiz</h3>
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
 <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-flamingo"/>
 </label>
 </div>

 {form.isQuiz && (
 <div className="mt-5 space-y-4 text-xs animate-in fade-in">
 <div>
 <label className="font-semibold text-neutral-800 block mb-2">
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
 <label className="font-semibold text-neutral-800 block">
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
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
 <div className="flex items-center gap-3 pb-3 border-b border-border">
 <div className="w-10 h-10 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center">
 <ShieldCheck className="w-5 h-5"/>
 </div>
 <div>
 <h3 className="font-bold text-base text-neutral-900">Responses & Access</h3>
 <p className="text-xs text-muted-foreground mt-0.5">
 Manage respondent permissions, university authentication, and capacity
 </p>
 </div>
 </div>

 <div className="space-y-4 text-xs text-neutral-800">
 <label className="flex items-center justify-between cursor-pointer">
 <div className="pr-4">
 <div className="font-semibold">Restrict to Avantika University accounts</div>
 <div className="text-[11px] text-muted-foreground mt-0.5">
 Requires logging in with an official @avantika.edu.in account
 </div>
 </div>
 <input
 type="checkbox"
 checked={Boolean(formSettings.requireCollegeLogin)}
 onChange={(e) => updateFormSettings("requireCollegeLogin", e.target.checked)}
 className="accent-flamingo w-4 h-4 rounded flex-shrink-0"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer">
 <div className="pr-4">
 <div className="font-semibold">Limit to 1 response</div>
 <div className="text-[11px] text-muted-foreground mt-0.5">
 Requires respondents to sign in and prevents more than one submission per person.
 </div>
 </div>
 <input
 type="checkbox"
 checked={Boolean(formSettings.limitOneResponse)}
 onChange={(e) => updateFormSettings("limitOneResponse", e.target.checked)}
 className="accent-flamingo w-4 h-4 rounded flex-shrink-0"
 />
 </label>
 </div>
 </div>

 {/* 3. SCHEDULE & DEADLINES */}
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
 <div className="flex items-center gap-3 pb-3 border-b border-border">
 <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
 <Clock className="w-5 h-5"/>
 </div>
 <div>
 <h3 className="font-bold text-base text-neutral-900">Schedule & Deadlines</h3>
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
 value={form.opensAt ? new Date(form.opensAt).toISOString().slice(0, 16) :""}
 onChange={(e) => onChange({ opensAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
 className="w-full px-3 py-2 bg-neutral-50 border rounded-xl"
 />
 </div>

 <div>
 <label className="font-semibold block mb-1">Closing Deadline (Optional)</label>
 <input
 type="datetime-local"
 value={form.closesAt ? new Date(form.closesAt).toISOString().slice(0, 16) :""}
 onChange={(e) => onChange({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
 className="w-full px-3 py-2 bg-neutral-50 border rounded-xl"
 />
 </div>

 <div className="sm:col-span-2">
 <label className="font-semibold block mb-1">Maximum Response Limit (Optional)</label>
 <input
 type="number"
 min={1}
 value={form.maxResponses ||""}
 onChange={(e) => onChange({ maxResponses: e.target.value ? parseInt(e.target.value, 10) : null })}
 placeholder="e.g. 100 registrations max"
 className="w-full px-3 py-2 bg-neutral-50 border rounded-xl"
 />
 </div>
 </div>
 </div>

 {/* 4. PRESENTATION & CONFIRMATION */}
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
 <div className="flex items-center gap-3 pb-3 border-b border-border">
 <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
 <Eye className="w-5 h-5"/>
 </div>
 <div>
 <h3 className="font-bold text-base text-neutral-900">Presentation</h3>
 <p className="text-xs text-muted-foreground mt-0.5">
 Customize progress bars, question ordering, and completion messages
 </p>
 </div>
 </div>

 <div className="space-y-3.5 text-xs text-neutral-800">
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
 value={formSettings.confirmationMessage ||"Your response has been recorded. Thank you!"}
 onChange={(e) => updateFormSettings("confirmationMessage", e.target.value)}
 className="w-full px-3 py-2 bg-neutral-50 border rounded-xl text-xs"
 />
 </div>
 </div>
 </div>

 {/* 5. THEME & HEADER IMAGE */}
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-5">
 <div className="flex items-center gap-3 pb-3 border-b border-border">
 <div className="w-10 h-10 rounded-xl bg-flamingo/10 text-flamingo flex items-center justify-center">
 <Palette className="w-5 h-5"/>
 </div>
 <div>
 <h3 className="font-bold text-base text-neutral-900">Theme & Header Banner</h3>
 <p className="text-xs text-muted-foreground mt-0.5">
 Avantika University Coding Ninjas Brand System (Flamingo #F16222 & Alabaster #FAFAFA)
 </p>
 </div>
 </div>

 {/* Header Banner Configuration */}
 <div className="space-y-3 text-xs">
 <div className="flex items-center justify-between">
 <label className="font-bold text-neutral-900 text-xs">
 Header Banner Image
 </label>
 <span className="text-[11px] text-muted-foreground">
 Displays across the top of published forms
 </span>
 </div>

 {/* Banner Upload Error */}
 {bannerError && (
 <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
 <AlertCircle className="w-4 h-4 flex-shrink-0"/>
 <span className="flex-1">{bannerError}</span>
 <button
 type="button"
 onClick={() => setBannerError(null)}
 className="text-destructive/70 hover:text-destructive"
 >
 <X className="w-3.5 h-3.5"/>
 </button>
 </div>
 )}

 {/* Upload Progress */}
 {isUploadingBanner && (
 <div className="p-4 rounded-xl border border-flamingo/20 bg-flamingo/5 text-center space-y-2 animate-in fade-in">
 <div className="flex items-center justify-center gap-2 text-flamingo font-semibold text-xs">
 <Loader2 className="w-4 h-4 animate-spin"/>
 <span>Uploading banner... {bannerProgress !== null ?`${bannerProgress}%`:""}</span>
 </div>
 <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
 <div
 className="bg-flamingo h-full rounded-full transition-all duration-200 ease-out"
 style={{ width:`${bannerProgress ?? 20}%`}}
 />
 </div>
 </div>
 )}

 {/* Current Banner Preview */}
 {themeSettings.headerImage && !isUploadingBanner && (
 <div className="space-y-2">
 <div className="relative rounded-xl overflow-hidden border border-border shadow-sm group">
 <img
 src={themeSettings.headerImage}
 alt="Form Header Banner"
 className="w-full max-h-48 object-cover rounded-xl"
 onError={(e) => {
 const target = e.target as HTMLElement;
 target.style.opacity ="0.5";
 }}
 />
 </div>

 {/* Replace / Remove Controls */}
 <div className="flex items-center justify-between pt-1">
 <div className="flex items-center gap-2">
 <input
 ref={bannerInputRef}
 type="file"
 className="hidden"
 accept="image/jpeg,image/png,image/webp,image/gif"
 onChange={handleBannerFileSelect}
 />
 <button
 type="button"
 onClick={() => bannerInputRef.current?.click()}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
 >
 <Upload className="w-3.5 h-3.5 text-flamingo"/>
 <span>Replace from device</span>
 </button>
 <button
 type="button"
 onClick={() => {
 const newUrl = prompt("Enter banner image URL:", themeSettings.headerImage);
 if (newUrl !== null) {
 updateThemeSettings("headerImage", newUrl.trim());
 }
 }}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
 >
 <Link2 className="w-3.5 h-3.5 text-flamingo"/>
 <span>Edit URL</span>
 </button>
 </div>

 <button
 type="button"
 onClick={() => updateThemeSettings("headerImage","")}
 className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 <span>Remove Banner</span>
 </button>
 </div>
 </div>
 )}

 {/* Empty Banner State: Options to Upload from Device or Enter URL */}
 {!themeSettings.headerImage && !isUploadingBanner && (
 <div className="space-y-3">
 <input
 ref={bannerInputRef}
 type="file"
 className="hidden"
 accept="image/jpeg,image/png,image/webp,image/gif"
 onChange={handleBannerFileSelect}
 />
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {/* Upload Button */}
 <button
 type="button"
 onClick={() => bannerInputRef.current?.click()}
 className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-neutral-300 hover:border-flamingo bg-neutral-50/50 hover:bg-flamingo/5 transition group text-center"
 >
 <div className="w-9 h-9 rounded-full bg-flamingo/10 text-flamingo flex items-center justify-center mb-2 group-hover:scale-110 transition">
 <Upload className="w-4 h-4"/>
 </div>
 <span className="font-bold text-xs text-neutral-800 group-hover:text-flamingo">
 Upload from device
 </span>
 <span className="text-[10px] text-muted-foreground mt-0.5">
 JPEG, PNG, WebP up to 10MB
 </span>
 </button>

 {/* URL Input */}
 <div className="flex flex-col justify-center p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
 <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-800">
 <Link2 className="w-3.5 h-3.5 text-flamingo"/>
 <span>Enter image URL</span>
 </div>
 <input
 type="url"
 value={bannerUrlInput}
 onChange={(e) => setBannerUrlInput(e.target.value)}
 placeholder="https://... (banner image URL)"
 className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs focus:ring-1 focus:ring-flamingo focus:outline-none"
 />
 <button
 type="button"
 onClick={() => {
 if (bannerUrlInput.trim()) {
 updateThemeSettings("headerImage", bannerUrlInput.trim());
 }
 }}
 disabled={!bannerUrlInput.trim()}
 className="self-end px-3 py-1 bg-flamingo text-white text-xs font-semibold rounded-lg hover:bg-flamingo-600 transition disabled:opacity-40"
 >
 Apply URL
 </button>
 </div>
 </div>

 <p className="text-[11px] text-muted-foreground">
 Tip: For best presentation, use an image with an approximate 4:1 aspect ratio (e.g., 1200×300 px).
 </p>
 </div>
 )}

 {/* Font Family */}
 <div className="pt-2 border-t border-border">
 <label className="font-semibold block mb-1">Font Family</label>
 <select
 value={themeSettings.fontFamily ||"Inter"}
 onChange={(e) => updateThemeSettings("fontFamily", e.target.value)}
 className="w-full px-3 py-2 bg-neutral-50 border rounded-xl"
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
