import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, FormElement, FormSection } from "../lib/api";
import { useAuth } from "../context/AuthContext";
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
} from "lucide-react";
import confetti from "canvas-confetti";

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
  const [draftRestored, setDraftRestored] = useState(false);
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});

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

        // Load autosaved draft from localStorage
        const storageKey = `au_draft_${publicId}`;
        const savedDraft = localStorage.getItem(storageKey);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setAnswers(parsed.answers || {});
            setOtherInputs(parsed.otherInputs || {});
            setDraftRestored(true);
          } catch {}
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load form");
      })
      .finally(() => setLoading(false));
  }, [publicId]);

  // Autosave to localStorage on answer changes
  useEffect(() => {
    if (!publicId || !formData || submitted) return;
    const storageKey = `au_draft_${publicId}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ answers, otherInputs, savedAt: Date.now() })
    );
  }, [answers, otherInputs, publicId, formData, submitted]);

  const handleAnswerChange = (elementId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [elementId]: value }));
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

  // Section navigation with required questions check
  const sections: FormSection[] = formData?.sections || [];
  const currentSection = sections[currentSectionIndex] || {
    id: "default",
    title: "",
    description: "",
  };

  const elementsForCurrentSection: FormElement[] = (formData?.elements || []).filter(
    (el: FormElement) => el.sectionId === currentSection.id || sections.length <= 1
  );

  const validateCurrentSection = (): boolean => {
    setError(null);
    for (const el of elementsForCurrentSection) {
      if (["title_desc", "image", "video"].includes(el.type)) continue;

      if (el.isRequired) {
        const val = answers[el.id];
        const isEmpty =
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0);

        if (isEmpty) {
          setError(`"${el.title || "Question"}" is required.`);
          // Scroll element into view
          const elNode = document.getElementById(`q-${el.id}`);
          if (elNode) elNode.scrollIntoView({ behavior: "smooth", block: "center" });
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
      if (["multiple_choice", "dropdown"].includes(el.type) && el.branchingLogic) {
        try {
          const logic = typeof el.branchingLogic === "string" ? JSON.parse(el.branchingLogic) : el.branchingLogic;
          const userSelected = answers[el.id];
          if (userSelected && logic[userSelected]) {
            const target = logic[userSelected];
            if (target === "submit") {
              handleSubmit();
              return;
            } else if (target !== "next") {
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
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateCurrentSection()) return;

    setSubmitting(true);
    setError(null);

    try {
      if (!publicId) return;
      const res = await api.public.submit(publicId, {
        answers,
        respondentEmail: user?.email,
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
          colors: ["#F16222", "#FAFAFA", "#1F1F1F"],
        });
      } catch {}
    } catch (err: any) {
      setError(err.message || "Failed to submit form.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alabaster dark:bg-neutral-950">
        <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Unavailable / Closed / Auth Required states
  if (formData?.requiresAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-alabaster dark:bg-neutral-950">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-border p-8 text-center shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-flamingo/10 text-flamingo flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            Authentication Required
          </h2>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            This form is restricted to Avantika University students and faculty. Please sign in with your campus email (@avantika.edu.in) to continue.
          </p>
          <Link
            to="/login"
            className="w-full py-2.5 px-4 bg-flamingo text-white font-semibold text-xs rounded-xl shadow-md shadow-flamingo/20 inline-block hover:bg-flamingo-600 transition"
          >
            Sign In with College Email
          </Link>
        </div>
      </div>
    );
  }

  if (formData?.isClosed || formData?.alreadySubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-alabaster dark:bg-neutral-950">
        <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-border p-8 text-center shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            {formData.title}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
            {formData.alreadySubmitted
              ? "You have already responded to this form. This form is configured to allow only 1 submission per student."
              : formData.closedReason || "This form is no longer accepting submissions."}
          </p>
          <Link
            to="/"
            className="px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold text-xs rounded-xl hover:bg-neutral-200 transition"
          >
            Return to AU Forms
          </Link>
        </div>
      </div>
    );
  }

  // Submission Completed Success Screen
  if (submitted && submissionResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-alabaster dark:bg-neutral-950">
        <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-border p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white mb-2">
            {formData.title}
          </h2>

          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
            {submissionResult.message || "Your response has been recorded. Thank you!"}
          </p>

          {/* Quiz Score Box if available */}
          {submissionResult.score && (
            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800 mb-6 text-center">
              <div className="text-xs uppercase font-bold text-purple-600 tracking-wider">Your Quiz Score</div>
              <div className="text-3xl font-extrabold text-purple-700 dark:text-purple-300 mt-1">
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
    <div className="min-h-screen bg-alabaster dark:bg-neutral-950 text-foreground py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Progress Bar (if enabled) */}
        {formData.formSettings?.showProgressBar !== false && totalSections > 1 && (
          <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden mb-2">
            <div
              className="bg-flamingo h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Draft Restored Banner */}
        {draftRestored && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>Progress automatically restored from your local draft.</span>
            <button
              onClick={() => {
                setAnswers({});
                setDraftRestored(false);
                if (publicId) localStorage.removeItem(`au_draft_${publicId}`);
              }}
              className="text-amber-900 dark:text-amber-200 font-bold hover:underline ml-2"
            >
              Clear draft
            </button>
          </div>
        )}

        {/* Form Header Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-t-8 border-t-flamingo border-x border-b border-border p-6 shadow-sm">
          {formData.themeSettings?.headerImage && (
            <img
              src={formData.themeSettings.headerImage}
              alt="Form Banner"
              className="w-full max-h-48 object-cover rounded-xl mb-4 border"
            />
          )}

          <div className="flex items-center gap-2 mb-2">
            <img src="/avantika-logo.svg" alt="AU" className="w-6 h-6 object-contain" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Avantika University
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
            {formData.title}
          </h1>

          {formData.description && (
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-line leading-relaxed">
              {formData.description}
            </p>
          )}

          {formData.formSettings?.collectEmail && (
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <span>Collecting email address</span>
            </div>
          )}

          <div className="mt-3 text-[11px] text-rose-500 font-medium">* Indicates required question</div>
        </div>

        {/* Section Header Card (if multi-section) */}
        {totalSections > 1 && currentSection.title && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-5 shadow-sm">
            <div className="text-xs font-bold text-flamingo uppercase tracking-wider">
              Section {currentSectionIndex + 1} of {totalSections}
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
              {currentSection.title}
            </h2>
            {currentSection.description && (
              <p className="text-xs text-muted-foreground mt-1">{currentSection.description}</p>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Questions & Content Blocks for Current Section */}
        {elementsForCurrentSection.map((el) => {
          // Parse options for choice questions
          let optionsList: any[] = [];
          try {
            optionsList = typeof el.options === "string" ? JSON.parse(el.options || "[]") : el.options || [];
          } catch {
            optionsList = [];
          }

          let scaleSettings = { min: 1, max: 5, minLabel: "", maxLabel: "" };
          try {
            if (el.scaleSettings) {
              scaleSettings = typeof el.scaleSettings === "string" ? JSON.parse(el.scaleSettings) : el.scaleSettings;
            }
          } catch {}

          // Standalone Title & Description
          if (el.type === "title_desc") {
            return (
              <div
                key={el.id}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-2"
              >
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{el.title}</h3>
                {el.description && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                    {el.description}
                  </p>
                )}
              </div>
            );
          }

          // Dedicated Image
          if (el.type === "image") {
            return (
              <div
                key={el.id}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-3"
              >
                {el.title && <h3 className="text-sm font-bold">{el.title}</h3>}
                {el.mediaUrl && (
                  <img
                    src={el.mediaUrl}
                    alt={el.title || "Form image"}
                    className="max-h-72 mx-auto rounded-xl object-contain border"
                  />
                )}
                {el.description && <p className="text-xs text-muted-foreground">{el.description}</p>}
              </div>
            );
          }

          // Dedicated Video
          if (el.type === "video") {
            const ytMatch = el.mediaUrl?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
            const ytId = ytMatch ? ytMatch[1] : null;

            return (
              <div
                key={el.id}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-3"
              >
                {el.title && <h3 className="text-sm font-bold">{el.title}</h3>}
                {ytId && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden border shadow-sm">
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
                )}
                {el.description && <p className="text-xs text-muted-foreground">{el.description}</p>}
              </div>
            );
          }

          // Regular Question Card
          return (
            <div
              key={el.id}
              id={`q-${el.id}`}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm space-y-4"
            >
              {/* Question Header */}
              <div>
                <div className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-white flex items-start gap-1">
                  <span>{el.title}</span>
                  {el.isRequired && <span className="text-rose-500 font-bold">*</span>}
                </div>
                {el.description && (
                  <p className="text-xs text-muted-foreground mt-1">{el.description}</p>
                )}
              </div>

              {/* 1. Short Answer */}
              {el.type === "short_answer" && (
                <input
                  type="text"
                  value={answers[el.id] || ""}
                  onChange={(e) => handleAnswerChange(el.id, e.target.value)}
                  placeholder="Your answer"
                  className="w-full max-w-md text-sm px-1 py-2 bg-transparent border-b-2 border-neutral-300 dark:border-neutral-700 focus:border-flamingo focus:outline-none transition"
                />
              )}

              {/* 2. Paragraph */}
              {el.type === "paragraph" && (
                <textarea
                  rows={3}
                  value={answers[el.id] || ""}
                  onChange={(e) => handleAnswerChange(el.id, e.target.value)}
                  placeholder="Your answer"
                  className="w-full text-sm p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:border-flamingo focus:outline-none transition resize-none"
                />
              )}

              {/* 3. Multiple Choice */}
              {el.type === "multiple_choice" && (
                <div className="space-y-2.5">
                  {optionsList.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer select-none transition"
                    >
                      <input
                        type="radio"
                        name={el.id}
                        value={opt.text}
                        checked={answers[el.id] === opt.text}
                        onChange={() => handleAnswerChange(el.id, opt.text)}
                        className="accent-flamingo w-4 h-4"
                      />
                      <span className="text-sm text-neutral-800 dark:text-neutral-200">{opt.text}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* 4. Checkboxes */}
              {el.type === "checkboxes" && (
                <div className="space-y-2.5">
                  {optionsList.map((opt) => {
                    const isChecked = ((answers[el.id] as string[]) || []).includes(opt.text);
                    return (
                      <label
                        key={opt.id}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer select-none transition"
                      >
                        <input
                          type="checkbox"
                          value={opt.text}
                          checked={isChecked}
                          onChange={(e) => handleCheckboxChange(el.id, opt.text, e.target.checked)}
                          className="accent-flamingo w-4 h-4 rounded"
                        />
                        <span className="text-sm text-neutral-800 dark:text-neutral-200">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 5. Dropdown */}
              {el.type === "dropdown" && (
                <select
                  value={answers[el.id] || ""}
                  onChange={(e) => handleAnswerChange(el.id, e.target.value)}
                  className="w-full max-w-sm px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-flamingo"
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
              {el.type === "linear_scale" && (
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
                        className="flex flex-col items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <span className="text-xs font-semibold">{num}</span>
                        <input
                          type="radio"
                          name={el.id}
                          value={num}
                          checked={String(answers[el.id]) === String(num)}
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

              {/* 7 & 8. Multiple Choice Grid & Checkbox Grid */}
              {["mc_grid", "checkbox_grid"].includes(el.type) && (
                <div className="overflow-x-auto pb-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 px-3 text-left"></th>
                        {["Option A", "Option B", "Option C"].map((col, idx) => (
                          <th key={idx} className="py-2 px-3 text-center font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {["Row 1", "Row 2"].map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-border/50">
                          <td className="py-2.5 px-3 font-medium">{row}</td>
                          {["Option A", "Option B", "Option C"].map((col, cIdx) => (
                            <td key={cIdx} className="py-2.5 px-3 text-center">
                              <input
                                type={el.type === "mc_grid" ? "radio" : "checkbox"}
                                name={`${el.id}_${row}`}
                                checked={
                                  el.type === "mc_grid"
                                    ? answers[el.id]?.[row] === col
                                    : (answers[el.id]?.[row] || []).includes(col)
                                }
                                onChange={() => handleGridChange(el.id, row, col, el.type === "mc_grid")}
                                className="accent-flamingo"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 9. File Upload */}
              {el.type === "file_upload" && (
                <div className="p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800/30 text-center">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <label className="inline-block cursor-pointer px-4 py-2 bg-white dark:bg-neutral-800 border rounded-xl text-xs font-semibold shadow-xs hover:bg-neutral-50">
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
              {el.type === "date" && (
                <input
                  type="date"
                  value={answers[el.id] || ""}
                  onChange={(e) => handleAnswerChange(el.id, e.target.value)}
                  className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl text-xs"
                />
              )}

              {/* 11. Time */}
              {el.type === "time" && (
                <input
                  type="time"
                  value={answers[el.id] || ""}
                  onChange={(e) => handleAnswerChange(el.id, e.target.value)}
                  className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl text-xs"
                />
              )}
            </div>
          );
        })}

        {/* Navigation & Submission Controls */}
        <div className="flex items-center justify-between pt-4">
          {currentSectionIndex > 0 ? (
            <button
              type="button"
              onClick={handlePrevSection}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 border rounded-xl hover:bg-neutral-50 shadow-xs transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous Section
            </button>
          ) : (
            <div />
          )}

          {currentSectionIndex < totalSections - 1 ? (
            <button
              type="button"
              onClick={handleNextSection}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-flamingo hover:bg-flamingo-600 rounded-xl shadow-md shadow-flamingo/20 transition active:scale-95"
            >
              <span>Next Section</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit()}
              className="inline-flex items-center gap-2 px-7 py-3 text-sm font-bold text-white bg-flamingo hover:bg-flamingo-600 rounded-xl shadow-lg shadow-flamingo/25 transition active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Submit Response</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-muted-foreground pt-6">
          AU Forms &bull; Avantika University, Ujjain &bull; Never submit passwords through AU Forms.
        </div>
      </div>
    </div>
  );
};
