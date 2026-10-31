import React, { useState, useEffect } from"react";
import { useParams, useNavigate, Link } from"react-router-dom";
import { api, FormElement, FormSection } from"../lib/api";
import { useAuth } from"../context/AuthContext";
import {
 CheckCircle2,
 AlertCircle,
 Clock,
 ArrowRight,
 ArrowLeft,
 RotateCcw,
 Sparkles,
 Lock,
 Upload,
 Calendar,
 Eye,
 Star,
} from"lucide-react";
import confetti from"canvas-confetti";
import { RichText } from"../components/RichText";
import { stripHtml } from"../lib/sanitize";
import { parseGridConfig } from"../components/editor/QuestionCard";

const formatEventDateTime = (dtStr: string): string => {
 try {
 const d = new Date(dtStr);
 if (isNaN(d.getTime())) return dtStr;
 return new Intl.DateTimeFormat(undefined, {
 dateStyle:"full",
 timeStyle:"short",
 }).format(d);
 } catch {
 return dtStr;
 }
};

export const PublicFormPage: React.FC = () => {
 const { publicId } = useParams<{ publicId: string }>();
 const navigate = useNavigate();
 const { user } = useAuth();

 const [formData, setFormData] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Section Pagination State
 const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
 const [answers, setAnswers] = useState<Record<string, any>>({});
 const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
 const [showClearModal, setShowClearModal] = useState(false);
 const [formResetKey, setFormResetKey] = useState(0);
 const [hoveredRating, setHoveredRating] = useState<Record<string, number | null>>({});

 // Submission Success State
 const [submitted, setSubmitted] = useState(false);
 const [submissionResult, setSubmissionResult] = useState<any>(null);

 useEffect(() => {
 if (!publicId) return;
 setLoading(true);
 api.public
 .get(publicId)
 .then((data) => {
 setFormData(data);

 // Load autosaved draft from localStorage silently without showing banners
 const storageKey =`au_draft_${publicId}`;
 const savedDraft = localStorage.getItem(storageKey);
 if (savedDraft) {
 try {
 const parsed = JSON.parse(savedDraft);
 if (parsed.answers) setAnswers(parsed.answers);
 if (parsed.otherInputs) setOtherInputs(parsed.otherInputs);
 } catch {}
 }
 })
 .catch((err) => {
 setError(err.message ||"Failed to load form");
 })
 .finally(() => setLoading(false));
 }, [publicId]);

 // Autosave to localStorage on answer changes
 useEffect(() => {
 if (!publicId || !formData || submitted) return;
 const storageKey =`au_draft_${publicId}`;

 // If there are no answers, remove any existing draft rather than storing empty object
 const hasAnswers =
 Object.values(answers).some((val) => {
 if (val === null || val === undefined || val ==="") return false;
 if (Array.isArray(val) && val.length === 0) return false;
 if (typeof val ==="object"&& Object.keys(val).length === 0) return false;
 return true;
 }) ||
 Object.values(otherInputs).some((val) => Boolean(val && val.trim().length > 0));

 if (!hasAnswers) {
 localStorage.removeItem(storageKey);
 return;
 }

 localStorage.setItem(
 storageKey,
 JSON.stringify({ answers, otherInputs, savedAt: Date.now() })
 );
 }, [answers, otherInputs, publicId, formData, submitted]);

 const handleConfirmClearForm = () => {
 setAnswers({});
 setOtherInputs({});
 setCurrentSectionIndex(0);
 setError(null);
 if (publicId) {
 localStorage.removeItem(`au_draft_${publicId}`);
 }
 setFormResetKey((k) => k + 1);
 setShowClearModal(false);
 window.scrollTo({ top: 0, behavior:"smooth"});
 };

 const handleAnswerChange = (elementId: string, value: any) => {
 setAnswers((prev) => ({ ...prev, [elementId]: value }));
 };

 const handleRadioToggle = (elementId: string, optionValue: string) => {
 setAnswers((prev) => {
 const next = { ...prev };
 if (String(next[elementId]) === String(optionValue)) {
 delete next[elementId];
 } else {
 next[elementId] = optionValue;
 }
 return next;
 });
 };

 const handleRatingToggle = (elementId: string, ratingValue: number) => {
 setAnswers((prev) => {
 const next = { ...prev };
 if (next[elementId] === ratingValue) {
 delete next[elementId];
 } else {
 next[elementId] = ratingValue;
 }
 return next;
 });
 };

 const handleCheckboxChange = (elementId: string, optionText: string, isChecked: boolean) => {
 const current = (answers[elementId] as string[]) || [];
 let updated: string[];
 if (isChecked) {
 updated = [...current, optionText];
 } else {
 updated = current.filter((item) => item !== optionText);
 }
 setAnswers((prev) => ({ ...prev, [elementId]: updated }));
 };

 const handleGridChange = (elementId: string, row: string, col: string, isRadio: boolean) => {
 const current = answers[elementId] || {};
 let updated: any;
 if (isRadio) {
 updated = { ...current, [row]: col };
 } else {
 const rowList = (current[row] as string[]) || [];
 const nextRowList = rowList.includes(col) ? rowList.filter((c) => c !== col) : [...rowList, col];
 updated = { ...current, [row]: nextRowList };
 }
 setAnswers((prev) => ({ ...prev, [elementId]: updated }));
 };

 const handleGridRadioToggle = (elementId: string, row: string, col: string) => {
 setAnswers((prev) => {
 const current = prev[elementId] || {};
 const nextRowMap = { ...current };
 if (nextRowMap[row] === col) {
 delete nextRowMap[row];
 } else {
 nextRowMap[row] = col;
 }
 return { ...prev, [elementId]: nextRowMap };
 });
 };

 // Section navigation with required questions check
 const sections: FormSection[] = formData?.sections || [];
 const currentSection = sections[currentSectionIndex] || {
 id:"default",
 title:"",
 description:"",
 };

 const elementsForCurrentSection: FormElement[] = (formData?.elements || []).filter(
 (el: FormElement) => el.sectionId === currentSection.id || sections.length <= 1
 );

 const validateCurrentSection = (): boolean => {
 setError(null);
 for (const el of elementsForCurrentSection) {
 if (["title_desc","image","video"].includes(el.type)) continue;

 if (el.isRequired) {
 const val = answers[el.id];

 if (el.type ==="mc_grid") {
 const rawGrid = parseGridConfig(el.options);
 const gridRows = rawGrid.rows.filter((r) => r.text && r.text.trim().length > 0);
 const gridAns = val && typeof val ==="object"? val : {};
 const allAnswered = gridRows.every(
 (r) => gridAns[r.text] !== undefined && gridAns[r.text] !== null && gridAns[r.text] !==""
 );
 if (!allAnswered) {
 setError(`"${stripHtml(el.title) ||"Question"}"requires a response in each row.`);
 const elNode = document.getElementById(`q-${el.id}`);
 if (elNode) elNode.scrollIntoView({ behavior:"smooth", block:"center"});
 return false;
 }
 continue;
 }

 if (el.type ==="checkbox_grid") {
 const rawGrid = parseGridConfig(el.options);
 const gridRows = rawGrid.rows.filter((r) => r.text && r.text.trim().length > 0);
 const gridAns = val && typeof val ==="object"? val : {};
 const allAnswered = gridRows.every(
 (r) => Array.isArray(gridAns[r.text]) && gridAns[r.text].length > 0
 );
 if (!allAnswered) {
 setError(`"${stripHtml(el.title) ||"Question"}"requires at least one response in each row.`);
 const elNode = document.getElementById(`q-${el.id}`);
 if (elNode) elNode.scrollIntoView({ behavior:"smooth", block:"center"});
 return false;
 }
 continue;
 }

 const isEmpty =
 val === undefined ||
 val === null ||
 val ===""||
 (Array.isArray(val) && val.length === 0);

 if (isEmpty) {
 setError(`"${stripHtml(el.title) ||"Question"}"is required.`);
 // Scroll element into view
 const elNode = document.getElementById(`q-${el.id}`);
 if (elNode) elNode.scrollIntoView({ behavior:"smooth", block:"center"});
 return false;
 }
 }
 }
 return true;
 };

 const handleNextSection = () => {
 if (!validateCurrentSection()) return;

 // Check branching rules on current section elements
 let nextTargetSectionId: string | null = null;
 for (const el of elementsForCurrentSection) {
 if (["multiple_choice","dropdown"].includes(el.type) && el.branchingLogic) {
 try {
 const logic = typeof el.branchingLogic ==="string"? JSON.parse(el.branchingLogic) : el.branchingLogic;
 const userSelected = answers[el.id];
 if (userSelected && logic[userSelected]) {
 const target = logic[userSelected];
 if (target ==="submit") {
 handleSubmit();
 return;
 } else if (target !=="next") {
 nextTargetSectionId = target;
 }
 }
 } catch {}
 }
 }

 if (nextTargetSectionId) {
 const targetIdx = sections.findIndex((s) => s.id === nextTargetSectionId);
 if (targetIdx !== -1) {
 setCurrentSectionIndex(targetIdx);
 window.scrollTo({ top: 0, behavior:"smooth"});
 return;
 }
 }

 if (currentSectionIndex < sections.length - 1) {
 setCurrentSectionIndex((prev) => prev + 1);
 window.scrollTo({ top: 0, behavior:"smooth"});
 }
 };

 const handlePrevSection = () => {
 if (currentSectionIndex > 0) {
 setCurrentSectionIndex((prev) => prev - 1);
 window.scrollTo({ top: 0, behavior:"smooth"});
 }
 };

 const handleSubmit = async (e?: React.FormEvent) => {
 if (e) e.preventDefault();
 if (formData?.isDraftPreview) {
 setError("This is an owner preview of an unpublished draft. Submissions are disabled until the form is published.");
 return;
 }
 if (!validateCurrentSection()) return;

 setSubmitting(true);
 setError(null);

 try {
 if (!publicId) return;
 const res = await api.public.submit(publicId, {
 answers,
 respondentEmail: formData?.formSettings?.requireCollegeLogin ? user?.email : undefined,
 });

 // Clear draft
 localStorage.removeItem(`au_draft_${publicId}`);

 setSubmitted(true);
 setSubmissionResult(res);

 try {
 confetti({
 particleCount: 90,
 spread: 80,
 origin: { y: 0.6 },
 colors: ["#F16222","#FAFAFA","#1F1F1F"],
 });
 } catch {}
 } catch (err: any) {
 setError(err.message ||"Failed to submit form.");
 } finally {
 setSubmitting(false);
 }
 };

 const isMeaningfulTitle = (title?: string | null): boolean => {
 if (!title) return false;
 const plain = stripHtml(title).trim();
 if (!plain) return false;
 if (plain.toLowerCase() ==="untitled section") return false;
 return true;
 };

 const isMeaningfulDescription = (desc?: string | null): boolean => {
 if (!desc) return false;
 const plain = stripHtml(desc).trim();
 if (!plain) return false;
 if (plain.toLowerCase() ==="description (optional)") return false;
 return true;
 };

 if (loading) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-alabaster">
 <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin"/>
 </div>
 );
 }

 // Error screen when form cannot be loaded (e.g. 404 draft or not found)
 if (error && !formData) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4 bg-alabaster">
 <div className="w-full max-w-md bg-white rounded-2xl border border-border p-8 text-center shadow-xl">
 <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
 <AlertCircle className="w-6 h-6"/>
 </div>
 <h2 className="text-xl font-bold text-neutral-900 mb-2">
 Form Not Available
 </h2>
 <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
 {error.toLowerCase().includes("not found") || error.toLowerCase().includes("draft")
 ?"This form either does not exist or has not been published yet by its owner."
 : error}
 </p>
 <Link
 to="/"
 className="px-5 py-2.5 bg-neutral-100 text-neutral-800 font-semibold text-xs rounded-xl hover:bg-neutral-200 transition inline-block"
 >
 Return to Snow Forms
 </Link>
 </div>
 </div>
 );
 }

 // Unavailable / Closed / Auth Required states
 if (formData?.requiresAuth) {
 const isCollegeRequired = formData.authReason ==="college_login"|| formData.authReason ==="invalid_domain";
 return (
 <div className="min-h-screen flex items-center justify-center p-4 bg-alabaster">
 <div className="w-full max-w-md bg-white rounded-2xl border border-border p-8 text-center shadow-xl">
 <div className="w-12 h-12 rounded-2xl bg-flamingo/10 text-flamingo flex items-center justify-center mx-auto mb-4">
 <Lock className="w-6 h-6"/>
 </div>
 <h2 className="text-xl font-bold text-neutral-900 mb-2">
 Authentication Required
 </h2>
 <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
 {formData.message || (isCollegeRequired
 ?"This form is restricted to Avantika University students and faculty. Please sign in with your campus email (@avantika.edu.in) to continue."
 :"This form is limited to 1 response per person. Please sign in to submit your response.")}
 </p>
 <Link
 to={publicId ?`/login?redirect=${encodeURIComponent(`/forms/${publicId}`)}`:"/login"}
 className="w-full py-2.5 px-4 bg-flamingo text-white font-semibold text-xs rounded-xl shadow-md shadow-flamingo/20 inline-block hover:bg-flamingo-600 transition"
 >
 {isCollegeRequired ?"Sign In with College Email":"Sign In to Continue"}
 </Link>
 </div>
 </div>
 );
 }

 if (formData?.isClosed || formData?.alreadySubmitted) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4 bg-alabaster">
 <div className="w-full max-w-lg bg-white rounded-2xl border border-border p-8 text-center shadow-xl">
 <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
 <Clock className="w-6 h-6"/>
 </div>
 <h2 className="text-xl font-bold text-neutral-900 mb-2">
 <RichText content={formData.title} />
 </h2>
 <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
 {formData.alreadySubmitted
 ?"You have already submitted a response to this form."
 : formData.closedReason ||"This form is no longer accepting submissions."}
 </p>
 <Link
 to="/"
 className="px-5 py-2.5 bg-neutral-100 text-neutral-800 font-semibold text-xs rounded-xl hover:bg-neutral-200 transition"
 >
 Return to Snow Forms
 </Link>
 </div>
 </div>
 );
 }

 // Submission Completed Success Screen
 if (submitted && submissionResult) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4 bg-alabaster">
 <div className="w-full max-w-lg bg-white rounded-2xl border border-border p-8 text-center shadow-2xl">
 <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
 <CheckCircle2 className="w-8 h-8"/>
 </div>

 <h2 className="text-2xl font-extrabold text-neutral-900 mb-2">
 <RichText content={formData.title} />
 </h2>

 <p className="text-sm text-neutral-600 leading-relaxed mb-6">
 {submissionResult.message ||"Your response has been recorded. Thank you!"}
 </p>

 {/* Quiz Score Box if available */}
 {submissionResult.score && (
 <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 mb-6 text-center">
 <div className="text-xs uppercase font-bold text-purple-600 tracking-wider">Your Quiz Score</div>
 <div className="text-3xl font-extrabold text-purple-700 mt-1">
 {submissionResult.score.totalScore} / {submissionResult.score.maxScore}
 </div>
 <div className="text-xs text-muted-foreground mt-0.5">
 {submissionResult.score.percentage}% correct
 </div>
 </div>
 )}

 {submissionResult.allowSubmitAnother && (
 <button
 onClick={() => {
 setSubmitted(false);
 setAnswers({});
 setCurrentSectionIndex(0);
 }}
 className="text-xs font-semibold text-flamingo hover:underline block mx-auto"
 >
 Submit another response
 </button>
 )}
 </div>
 </div>
 );
 }

 // Calculate Progress percentage
 const totalSections = Math.max(sections.length, 1);
 const progressPercent = Math.round(((currentSectionIndex + 1) / totalSections) * 100);

 return (
 <div className="min-h-screen bg-alabaster text-foreground py-8 px-4 sm:px-6">
 <div className="max-w-2xl mx-auto space-y-4">
 {/* Progress Bar (if enabled) */}
 {formData.formSettings?.showProgressBar !== false && totalSections > 1 && (
 <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden mb-2">
 <div
 className="bg-flamingo h-full transition-all duration-300 ease-out"
 style={{ width:`${progressPercent}%`}}
 />
 </div>
 )}

 {/* Owner Draft Preview Banner */}
 {formData?.isDraftPreview && (
 <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center justify-between shadow-xs">
 <div className="flex items-center gap-2">
 <Eye className="w-4 h-4 text-amber-600 flex-shrink-0"/>
 <span>
 <strong>Owner Preview Mode:</strong> This form is an unpublished draft. Anonymous respondents cannot access this page.
 </span>
 </div>
 <Link
 to={`/editor/${formData.id}`}
 className="px-3 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold hover:bg-amber-700 transition flex-shrink-0"
 >
 Back to Editor
 </Link>
 </div>
 )}
 {/* Form Header Card */}
 <div className="bg-white rounded-2xl border-t-8 border-t-flamingo border-x border-b border-border p-6 shadow-sm">
 {formData.themeSettings?.headerImage && (
 <img
 src={formData.themeSettings.headerImage}
 alt="Form Banner"
 className="w-full max-h-48 object-cover rounded-xl mb-4 border"
 />
 )}

 <div className="flex items-center gap-2 mb-2">
 <img src="/snowdevs.png"alt="Snow Devs Logo"className="w-6 h-6 object-contain"/>
 <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
 Snow Forms
 </span>
 </div>

 <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
 <RichText content={formData.title} />
 </h1>

 {formData.description && (
 <div className="mt-3 text-sm text-neutral-600 whitespace-pre-line leading-relaxed">
 <RichText content={formData.description} />
 </div>
 )}

 {formData.formSettings?.collectEmail && (
 <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
 <span>Collecting email address</span>
 </div>
 )}

 <div className="mt-3 text-[11px] text-rose-500 font-medium">* Indicates required question</div>
 </div>

 {/* Section Header Card (Section 1 is the main form; separate section cards only render for Section 2+) */}
 {currentSectionIndex > 0 && (
 <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
 <div className="text-xs font-bold text-flamingo uppercase tracking-wider">
 SECTION {currentSectionIndex + 1} OF {totalSections}
 </div>
 {isMeaningfulTitle(currentSection.title) && (
 <h2 className="text-lg font-bold text-neutral-900 mt-1">
 <RichText content={currentSection.title} />
 </h2>
 )}
 {isMeaningfulDescription(currentSection.description) && (
 <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
 <RichText content={currentSection.description} />
 </div>
 )}
 </div>
 )}

 {/* Error Alert */}
 {error && (
 <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
 <AlertCircle className="w-5 h-5 flex-shrink-0"/>
 <div>{error}</div>
 </div>
 )}

 {/* Questions & Content Blocks for Current Section */}
 <div key={formResetKey} className="space-y-4">
 {elementsForCurrentSection.map((el) => {
  // Parse options for choice questions
  let optionsList: any[] = [];
  try {
    optionsList = typeof el.options === "string" ? JSON.parse(el.options || "[]") : el.options || [];
  } catch {
    optionsList = [];
  }
  // Ignore empty option entries for form fillers
  optionsList = (Array.isArray(optionsList) ? optionsList : []).filter(
    (opt) => opt && typeof opt.text === "string" && opt.text.trim().length > 0
  );

 let scaleSettings = { min: 1, max: 5, minLabel:"", maxLabel:""};
 try {
 if (el.scaleSettings) {
 scaleSettings = typeof el.scaleSettings ==="string"? JSON.parse(el.scaleSettings) : el.scaleSettings;
 }
 } catch {}

 let ratingSettings = { max: 5, icon:"star"};
 try {
 if (el.scaleSettings) {
 const s = typeof el.scaleSettings ==="string"? JSON.parse(el.scaleSettings) : el.scaleSettings;
 if (s && typeof s ==="object") {
 if (typeof s.max ==="number"&& s.max >= 3 && s.max <= 10) ratingSettings.max = s.max;
 if (s.icon) ratingSettings.icon = s.icon;
 }
 }
 } catch {}

 // Standalone Title & Description
 if (el.type ==="title_desc") {
 let meta: any = {};
 try {
 if (el.mediaMeta) {
 meta = typeof el.mediaMeta ==="string"? JSON.parse(el.mediaMeta) : el.mediaMeta;
 }
 } catch {}
 const eventDateTime = meta?.eventDateTime;
 const hasDescription = Boolean(el.description && stripHtml(el.description).trim());

 return (
 <div
 key={el.id}
 className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-3"
 >
 {el.title && (
 <h3 className="text-lg font-bold text-neutral-900">
 <RichText content={el.title} />
 </h3>
 )}

 {/* Optional Selected Event Date & Time (Read-only for respondents) */}
 {eventDateTime && (
 <div className="inline-flex items-center gap-2 py-1.5 px-3 rounded-xl bg-flamingo/10 text-flamingo text-xs sm:text-sm font-semibold">
 <Calendar className="w-4 h-4 text-flamingo flex-shrink-0"/>
 <span>{formatEventDateTime(eventDateTime)}</span>
 </div>
 )}

 {/* Description (only if provided and not empty) */}
 {hasDescription && (
 <div className="text-xs sm:text-sm text-neutral-600 whitespace-pre-line leading-relaxed">
 <RichText content={el.description} />
 </div>
 )}
 </div>
 );
 }

 // Dedicated Image
 if (el.type ==="image") {
 let mediaMeta: any = { alignment:"center"};
 try {
 if (el.mediaMeta) {
 mediaMeta = typeof el.mediaMeta ==="string"? JSON.parse(el.mediaMeta) : el.mediaMeta;
 }
 } catch {}

 return (
 <div
 key={el.id}
 className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-3"
 >
 {el.title && (
 <h3 className="text-sm font-bold text-neutral-900">
 <RichText content={el.title} />
 </h3>
 )}
 {el.mediaUrl && (
 <div className={`flex justify-${mediaMeta.alignment ==="left"?"start": mediaMeta.alignment ==="right"?"end":"center"}`}>
 <img
 src={el.mediaUrl}
 alt={stripHtml(el.title) ||"Form image"}
 className="max-h-80 w-auto rounded-xl object-contain border border-border shadow-xs"
 onError={(e) => {
 (e.target as HTMLElement).style.display ="none";
 }}
 />
 </div>
 )}
 {el.description && (
 <div className="text-xs text-muted-foreground whitespace-pre-line">
 <RichText content={el.description} />
 </div>
 )}
 </div>
 );
 }

 // Dedicated Video
 if (el.type ==="video") {
 let mediaMeta: any = { alignment:"center"};
 try {
 if (el.mediaMeta) {
 mediaMeta = typeof el.mediaMeta ==="string"? JSON.parse(el.mediaMeta) : el.mediaMeta;
 }
 } catch {}

 const ytMatch = el.mediaUrl?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
 const ytId = ytMatch ? ytMatch[1] : null;

 return (
 <div
 key={el.id}
 className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-3"
 >
 {el.title && (
 <h3 className="text-sm font-bold text-neutral-900">
 <RichText content={el.title} />
 </h3>
 )}
 {el.mediaUrl && (
 <div className={`flex justify-${mediaMeta.alignment ==="left"?"start": mediaMeta.alignment ==="right"?"end":"center"}`}>
 {ytId ? (
 <div className="aspect-video w-full max-w-2xl rounded-xl overflow-hidden border shadow-sm">
 <iframe
 width="100%"
 height="100%"
 src={`https://www.youtube-nocookie.com/embed/${ytId}`}
 title="YouTube video player"
 frameBorder="0"
 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
 allowFullScreen
 />
 </div>
 ) : (
 <div className="w-full max-w-2xl rounded-xl overflow-hidden border border-border bg-black shadow-sm">
 <video
 controls
 src={el.mediaUrl}
 className="w-full max-h-96 object-contain mx-auto"
 preload="metadata"
 >
 Your browser does not support HTML5 video playback.
 </video>
 </div>
 )}
 </div>
 )}
 {el.description && (
 <div className="text-xs text-muted-foreground whitespace-pre-line">
 <RichText content={el.description} />
 </div>
 )}
 </div>
 );
 }

 // Regular Question Card
 return (
 <div
 key={el.id}
 id={`q-${el.id}`}
 className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4"
 >
 {/* Question Header */}
 <div>
 <div className="font-semibold text-sm sm:text-base text-neutral-900 flex items-start gap-1">
 <span>
 <RichText content={el.title ||"Question"} />
 </span>
 {el.isRequired && <span className="text-rose-500 font-bold">*</span>}
 </div>
 {el.description && (
 <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
 <RichText content={el.description} />
 </div>
 )}
 </div>

              {/* Question Image Attachment */}
              {el.mediaUrl && (
                <div className="my-3 flex justify-center max-w-full overflow-hidden rounded-xl bg-neutral-50 border border-neutral-200">
                  <img
                    src={el.mediaUrl}
                    alt={stripHtml(el.title) || "Question image"}
                    className="max-h-80 w-auto max-w-full rounded-xl object-contain"
                    loading="lazy"
                  />
                </div>
              )}

 {/* 1. Short Answer */}
 {el.type ==="short_answer"&& (
 <input
 type="text"
 value={answers[el.id] ||""}
 onChange={(e) => handleAnswerChange(el.id, e.target.value)}
 placeholder="Your answer"
 className="w-full max-w-md text-sm px-1 py-2 bg-transparent border-b-2 border-neutral-300 focus:border-flamingo focus:outline-none transition"
 />
 )}

 {/* 2. Paragraph */}
 {el.type ==="paragraph"&& (
 <textarea
 rows={3}
 value={answers[el.id] ||""}
 onChange={(e) => handleAnswerChange(el.id, e.target.value)}
 placeholder="Your answer"
 className="w-full text-sm p-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:border-flamingo focus:outline-none transition resize-none"
 />
 )}

 {/* 3. Multiple Choice */}
 {el.type ==="multiple_choice"&& (
 <div className="space-y-2.5">
 {optionsList.map((opt) => (
 <label
 key={opt.id}
 className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 cursor-pointer select-none transition"
 >
 <input
 type="radio"
 name={el.id}
 value={opt.text}
 checked={answers[el.id] === opt.text}
 onClick={() => handleRadioToggle(el.id, opt.text)}
 onChange={() => handleAnswerChange(el.id, opt.text)}
 className="accent-flamingo w-4 h-4"
 />
 <span className="text-sm text-neutral-800">{opt.text}</span>
 </label>
 ))}
 </div>
 )}

 {/* 4. Checkboxes */}
 {el.type ==="checkboxes"&& (
 <div className="space-y-2.5">
 {optionsList.map((opt) => {
 const isChecked = ((answers[el.id] as string[]) || []).includes(opt.text);
 return (
 <label
 key={opt.id}
 className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 cursor-pointer select-none transition"
 >
 <input
 type="checkbox"
 value={opt.text}
 checked={isChecked}
 onChange={(e) => handleCheckboxChange(el.id, opt.text, e.target.checked)}
 className="accent-flamingo w-4 h-4 rounded"
 />
 <span className="text-sm text-neutral-800">{opt.text}</span>
 </label>
 );
 })}
 </div>
 )}

 {/* 5. Dropdown */}
 {el.type ==="dropdown"&& (
 <select
 value={answers[el.id] ||""}
 onChange={(e) => handleAnswerChange(el.id, e.target.value)}
 className="w-full max-w-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo"
 >
 <option value="">Choose an option...</option>
 {optionsList.map((opt) => (
 <option key={opt.id} value={opt.text}>
 {opt.text}
 </option>
 ))}
 </select>
 )}

 {/* 6. Linear Scale */}
 {el.type ==="linear_scale"&& (
 <div className="py-2">
 <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
 {scaleSettings.minLabel && (
 <span className="text-xs text-muted-foreground mr-2 font-medium">
 {scaleSettings.minLabel}
 </span>
 )}

 {Array.from(
 { length: scaleSettings.max - scaleSettings.min + 1 },
 (_, i) => scaleSettings.min + i
 ).map((num) => (
 <label
 key={num}
 className="flex flex-col items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-neutral-50"
 >
 <span className="text-xs font-semibold">{num}</span>
 <input
 type="radio"
 name={el.id}
 value={num}
 checked={String(answers[el.id]) === String(num)}
 onClick={() => handleRadioToggle(el.id, String(num))}
 onChange={() => handleAnswerChange(el.id, String(num))}
 className="accent-flamingo w-4 h-4"
 />
 </label>
 ))}

 {scaleSettings.maxLabel && (
 <span className="text-xs text-muted-foreground ml-2 font-medium">
 {scaleSettings.maxLabel}
 </span>
 )}
 </div>
 </div>
 )}

 {/* Rating Question */}
 {el.type ==="rating"&& (
 <div className="py-2 space-y-3">
 <div
 className="flex flex-wrap items-center gap-1.5 sm:gap-2.5"
 onMouseLeave={() => setHoveredRating((prev) => ({ ...prev, [el.id]: null }))}
 >
 {Array.from({ length: ratingSettings.max || 5 }, (_, i) => i + 1).map((starNum) => {
 const currentSelected = typeof answers[el.id] ==="number"? answers[el.id] : (answers[el.id] ? Number(answers[el.id]) : null);
 const currentHovered = hoveredRating[el.id] ?? null;
 const activeStars = currentHovered !== null ? currentHovered : (currentSelected || 0);
 const isFilled = starNum <= activeStars;

 return (
 <button
 key={starNum}
 type="button"
 role="radio"
 aria-checked={currentSelected === starNum}
 aria-label={`${starNum} of ${ratingSettings.max} stars`}
 onMouseEnter={() => setHoveredRating((prev) => ({ ...prev, [el.id]: starNum }))}
 onClick={() => handleRatingToggle(el.id, starNum)}
 className="p-1 rounded-xl hover:bg-neutral-100 transition transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-flamingo cursor-pointer"
 >
 <Star
 className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
 isFilled
 ?"text-amber-400 fill-amber-400 drop-shadow-xs"
 :"text-neutral-300 stroke-[1.5]"
 }`}
 />
 </button>
 );
 })}
 </div>

 <div className="text-xs text-muted-foreground flex items-center gap-2">
 {answers[el.id] ? (
 <span className="font-semibold text-neutral-800">
 Rated {answers[el.id]} / {ratingSettings.max} stars
 <span className="font-normal text-muted-foreground ml-1.5">(click to clear)</span>
 </span>
 ) : (
 <span>Select a rating (1 to {ratingSettings.max} stars)</span>
 )}
 </div>
 </div>
 )}

 {/* 7 & 8. Multiple Choice Grid & Checkbox Grid */}
 {["mc_grid","checkbox_grid"].includes(el.type) && (() => {
 const rawGrid = parseGridConfig(el.options);
 const grid = {
 rows: rawGrid.rows.filter((r) => r.text && r.text.trim().length > 0),
 columns: rawGrid.columns.filter((c) => c.text && c.text.trim().length > 0),
 };
 return (
 <div className="overflow-x-auto pb-2 -mx-2 px-2">
 <table className="w-full text-xs min-w-[320px]">
 <thead>
 <tr className="border-b border-border">
 <th className="py-2.5 px-3 text-left font-semibold text-neutral-700">
 {/* Empty corner cell */}
 </th>
 {grid.columns.map((col, idx) => (
 <th
 key={col.id || idx}
 className="py-2.5 px-3 text-center font-semibold text-neutral-700"
 >
 {col.text}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {grid.rows.map((row, rIdx) => (
 <tr
 key={row.id || rIdx}
 className={`border-b border-border/50 hover:bg-neutral-50/60 transition ${
 rIdx % 2 === 0 ?"bg-transparent":"bg-neutral-50/30"
 }`}
 >
 <td className="py-3 px-3 font-medium text-neutral-900">
 {row.text}
 </td>
 {grid.columns.map((col, cIdx) => {
 const isChecked =
 el.type ==="mc_grid"
 ? answers[el.id]?.[row.text] === col.text
 : (answers[el.id]?.[row.text] || []).includes(col.text);

 return (
 <td key={col.id || cIdx} className="py-3 px-3 text-center">
 <label className="inline-flex items-center justify-center p-1.5 cursor-pointer rounded-lg hover:bg-neutral-100 transition">
 <input
 type={el.type ==="mc_grid"?"radio":"checkbox"}
 name={`${el.id}_${row.id || rIdx}`}
 value={col.text}
 checked={isChecked}
 onClick={el.type ==="mc_grid"? () => handleGridRadioToggle(el.id, row.text, col.text) : undefined}
 onChange={() => handleGridChange(el.id, row.text, col.text, el.type ==="mc_grid")}
 className={`accent-flamingo cursor-pointer ${
 el.type ==="mc_grid"?"w-4 h-4":"w-4 h-4 rounded"
 }`}
 aria-label={`${row.text}, ${col.text}`}
 />
 </label>
 </td>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
 })()}

 {/* 9. File Upload */}
 {el.type ==="file_upload"&& (
 <div className="p-4 border-2 border-dashed border-neutral-300 rounded-xl bg-neutral-50 text-center">
 <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2"/>
 <label className="inline-block cursor-pointer px-4 py-2 bg-white border rounded-xl text-xs font-semibold shadow-xs hover:bg-neutral-50">
 <span>Select file to upload</span>
 <input
 type="file"
 className="sr-only"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) {
 handleAnswerChange(el.id, file.name);
 }
 }}
 />
 </label>
 {answers[el.id] && (
 <div className="mt-2 text-xs text-emerald-600 font-semibold">
 Attached: {answers[el.id]}
 </div>
 )}
 </div>
 )}

 {/* 10. Date */}
 {el.type ==="date"&& (
 <input
 type="date"
 value={answers[el.id] ||""}
 onChange={(e) => handleAnswerChange(el.id, e.target.value)}
 className="px-3 py-2 bg-neutral-50 border rounded-xl text-xs"
 />
 )}

 {/* 11. Time */}
 {el.type ==="time"&& (
 <input
 type="time"
 value={answers[el.id] ||""}
 onChange={(e) => handleAnswerChange(el.id, e.target.value)}
 className="px-3 py-2 bg-neutral-50 border rounded-xl text-xs"
 />
 )}
 </div>
 );
 })}
 </div>

 {/* Navigation & Submission Controls */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4">
 <div className="flex items-center gap-3">
 {currentSectionIndex > 0 && (
 <button
 type="button"
 onClick={handlePrevSection}
 className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-neutral-700 bg-white border rounded-xl hover:bg-neutral-50 shadow-xs transition"
 >
 <ArrowLeft className="w-4 h-4"/>
 Previous Section
 </button>
 )}

 {currentSectionIndex < totalSections - 1 ? (
 <button
 type="button"
 onClick={handleNextSection}
 className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-flamingo hover:bg-flamingo-600 rounded-xl shadow-md shadow-flamingo/20 transition active:scale-95"
 >
 <span>Next Section</span>
 <ArrowRight className="w-4 h-4"/>
 </button>
 ) : (
 <button
 type="button"
 disabled={submitting}
 onClick={() => handleSubmit()}
 className="inline-flex items-center gap-2 px-7 py-3 text-sm font-bold text-white bg-flamingo hover:bg-flamingo-600 rounded-xl shadow-lg shadow-flamingo/25 transition active:scale-95 disabled:opacity-50"
 >
 {submitting ? (
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
 ) : (
 <>
 <span>Submit Response</span>
 <CheckCircle2 className="w-4 h-4"/>
 </>
 )}
 </button>
 )}
 </div>

 {/* Secondary Google Forms-style Clear form button */}
 <button
 type="button"
 onClick={() => setShowClearModal(true)}
 className="text-xs font-medium text-neutral-500 hover:text-neutral-800 py-2 px-3 rounded-lg hover:bg-neutral-100 transition self-end sm:self-center"
 >
 Clear form
 </button>
 </div>

 {/* Clear Form Confirmation Modal */}
 {showClearModal && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
 onClick={(e) => {
 if (e.target === e.currentTarget) setShowClearModal(false);
 }}
 >
 <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
 <h3 className="text-lg font-bold text-neutral-900 mb-2">
 Clear form?
 </h3>
 <p className="text-sm text-neutral-600 mb-6">
 This will remove your answers from all questions and cannot be undone.
 </p>
 <div className="flex items-center justify-end gap-3">
 <button
 type="button"
 onClick={() => setShowClearModal(false)}
 className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleConfirmClearForm}
 className="px-4 py-2 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-xl shadow-xs transition"
 >
 Clear form
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Footer info */}
 <div className="text-center text-[11px] text-muted-foreground pt-6">
 Snow Forms &bull; Avantika University, Ujjain &bull; Never submit passwords through Snow Forms.
 </div>
 </div>
 </div>
 );
};
