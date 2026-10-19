import React, { useState } from "react";
import { FormElement, FormSection } from "../../lib/api";
import {
  GripVertical,
  Trash2,
  Copy,
  MoreVertical,
  Plus,
  X,
  Check,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  Split,
  Image as ImageIcon,
  ShieldCheck,
  FileQuestion,
  ChevronDown,
} from "lucide-react";

interface QuestionCardProps {
  element: FormElement;
  sections: FormSection[];
  isQuiz: boolean;
  isActive: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<FormElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandleProps?: any;
}

const QUESTION_TYPES = [
  { id: "short_answer", label: "Short answer", group: "Text" },
  { id: "paragraph", label: "Paragraph", group: "Text" },
  { id: "multiple_choice", label: "Multiple choice", group: "Choice" },
  { id: "checkboxes", label: "Checkboxes", group: "Choice" },
  { id: "dropdown", label: "Dropdown", group: "Choice" },
  { id: "linear_scale", label: "Linear scale", group: "Rating" },
  { id: "mc_grid", label: "Multiple choice grid", group: "Grid" },
  { id: "checkbox_grid", label: "Checkbox grid", group: "Grid" },
  { id: "file_upload", label: "File upload", group: "Media" },
  { id: "date", label: "Date", group: "Temporal" },
  { id: "time", label: "Time", group: "Temporal" },
];

export const QuestionCard: React.FC<QuestionCardProps> = ({
  element,
  sections,
  isQuiz,
  isActive,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
  dragHandleProps,
}) => {
  const [showDescription, setShowDescription] = useState(Boolean(element.description));
  const [showValidation, setShowValidation] = useState(Boolean(element.validation));
  const [showBranching, setShowBranching] = useState(Boolean(element.branchingLogic));
  const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Parse options
  let optionsList: Array<{ id: string; text: string; image?: string }> = [];
  try {
    optionsList = typeof element.options === "string" ? JSON.parse(element.options || "[]") : element.options || [];
    if (!Array.isArray(optionsList) || optionsList.length === 0) {
      if (["multiple_choice", "checkboxes", "dropdown"].includes(element.type)) {
        optionsList = [{ id: "opt_1", text: "Option 1" }];
      }
    }
  } catch {
    optionsList = [{ id: "opt_1", text: "Option 1" }];
  }

  // Parse linear scale settings
  let scaleSettings = { min: 1, max: 5, minLabel: "", maxLabel: "" };
  try {
    if (element.scaleSettings) {
      scaleSettings = typeof element.scaleSettings === "string" ? JSON.parse(element.scaleSettings) : element.scaleSettings;
    }
  } catch {}

  // Parse validation settings
  let validationSettings: any = null;
  try {
    if (element.validation) {
      validationSettings = typeof element.validation === "string" ? JSON.parse(element.validation) : element.validation;
    }
  } catch {}

  // Parse branching logic
  let branchingMap: Record<string, string> = {};
  try {
    if (element.branchingLogic) {
      branchingMap = typeof element.branchingLogic === "string" ? JSON.parse(element.branchingLogic) : element.branchingLogic;
    }
  } catch {}

  // Parse quiz answer key
  let answerKey = { correctAnswers: [] as string[], feedbackCorrect: "", feedbackIncorrect: "", youtubeFeedbackUrl: "" };
  try {
    if (element.quizAnswerKey) {
      answerKey = typeof element.quizAnswerKey === "string" ? JSON.parse(element.quizAnswerKey) : element.quizAnswerKey;
    }
  } catch {}

  const handleAddOption = () => {
    const nextIdx = optionsList.length + 1;
    const newOptions = [...optionsList, { id: `opt_${Date.now()}`, text: `Option ${nextIdx}` }];
    onChange({ options: JSON.stringify(newOptions) });
  };

  const handleUpdateOption = (index: number, text: string) => {
    const newOptions = [...optionsList];
    newOptions[index].text = text;
    onChange({ options: JSON.stringify(newOptions) });
  };

  const handleRemoveOption = (index: number) => {
    if (optionsList.length <= 1) return;
    const newOptions = optionsList.filter((_, i) => i !== index);
    onChange({ options: JSON.stringify(newOptions) });
  };

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white dark:bg-neutral-900 rounded-2xl border transition-all ${
        isActive
          ? "border-flamingo shadow-md shadow-flamingo/10 ring-1 ring-flamingo"
          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
      } p-5 sm:p-6 mb-4`}
    >
      {/* Top Drag Handle */}
      <div
        {...dragHandleProps}
        className="flex items-center justify-center -mt-3 mb-2 cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        <GripVertical className="w-5 h-5 rotate-90" />
      </div>

      {/* Header: Title Input + Question Type Dropdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 w-full">
          <input
            type="text"
            value={element.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Question title"
            className="w-full text-base sm:text-lg font-semibold bg-transparent border-b-2 border-transparent focus:border-flamingo pb-1 focus:outline-none transition"
          />
        </div>

        {/* Type selector */}
        <div className="relative w-full sm:w-56">
          <select
            value={element.type}
            onChange={(e) => onChange({ type: e.target.value as any })}
            className="w-full px-3 py-2 text-xs font-semibold bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-flamingo"
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description input */}
      {showDescription && (
        <div className="mt-2">
          <input
            type="text"
            value={element.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description or helper text"
            className="w-full text-xs text-muted-foreground bg-transparent border-b border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 pb-0.5 focus:outline-none"
          />
        </div>
      )}

      {/* Main Question Body by Type */}
      <div className="mt-5 space-y-3">
        {/* Short Answer */}
        {element.type === "short_answer" && (
          <div className="py-2">
            <input
              type="text"
              disabled
              placeholder="Short answer text"
              className="w-full max-w-sm text-sm text-muted-foreground bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-300 dark:border-neutral-700 pb-1.5 focus:outline-none cursor-not-allowed"
            />
          </div>
        )}

        {/* Paragraph */}
        {element.type === "paragraph" && (
          <div className="py-2">
            <textarea
              disabled
              rows={2}
              placeholder="Long answer text"
              className="w-full text-sm text-muted-foreground bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-300 dark:border-neutral-700 pb-1.5 focus:outline-none cursor-not-allowed resize-none"
            />
          </div>
        )}

        {/* Multiple Choice, Checkboxes, Dropdown */}
        {["multiple_choice", "checkboxes", "dropdown"].includes(element.type) && (
          <div className="space-y-2.5">
            {optionsList.map((opt, idx) => (
              <div key={opt.id || idx} className="flex items-center gap-2.5">
                {element.type === "multiple_choice" && (
                  <div className="w-4 h-4 rounded-full border-2 border-neutral-400 flex-shrink-0" />
                )}
                {element.type === "checkboxes" && (
                  <div className="w-4 h-4 rounded border-2 border-neutral-400 flex-shrink-0" />
                )}
                {element.type === "dropdown" && (
                  <span className="text-xs font-mono text-muted-foreground w-4 text-center">{idx + 1}.</span>
                )}

                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => handleUpdateOption(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 text-xs sm:text-sm bg-transparent border-b border-transparent focus:border-flamingo py-1 focus:outline-none"
                />

                {/* Conditional Branching Section Selector */}
                {showBranching && (
                  <select
                    value={branchingMap[opt.id] || "next"}
                    onChange={(e) => {
                      const updated = { ...branchingMap, [opt.id]: e.target.value };
                      onChange({ branchingLogic: JSON.stringify(updated) });
                    }}
                    className="text-[11px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700"
                  >
                    <option value="next">Continue to next section</option>
                    {sections.map((s, sIdx) => (
                      <option key={s.id} value={s.id}>
                        Go to section {sIdx + 1} ({s.title || "Section"})
                      </option>
                    ))}
                    <option value="submit">Submit form</option>
                  </select>
                )}

                {optionsList.length > 1 && (
                  <button
                    onClick={() => handleRemoveOption(idx)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Option Button */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddOption}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-flamingo hover:text-flamingo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add option
              </button>
            </div>
          </div>
        )}

        {/* Linear Scale */}
        {element.type === "linear_scale" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span>Scale from</span>
              <select
                value={scaleSettings.min}
                onChange={(e) => {
                  const updated = { ...scaleSettings, min: Number(e.target.value) };
                  onChange({ scaleSettings: JSON.stringify(updated) });
                }}
                className="px-2 py-1 bg-neutral-50 dark:bg-neutral-800 border border-border rounded"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
              <span>to</span>
              <select
                value={scaleSettings.max}
                onChange={(e) => {
                  const updated = { ...scaleSettings, max: Number(e.target.value) };
                  onChange({ scaleSettings: JSON.stringify(updated) });
                }}
                className="px-2 py-1 bg-neutral-50 dark:bg-neutral-800 border border-border rounded"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={scaleSettings.minLabel || ""}
                onChange={(e) => {
                  const updated = { ...scaleSettings, minLabel: e.target.value };
                  onChange({ scaleSettings: JSON.stringify(updated) });
                }}
                placeholder="Low endpoint label (e.g. Poor)"
                className="text-xs px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg"
              />
              <input
                type="text"
                value={scaleSettings.maxLabel || ""}
                onChange={(e) => {
                  const updated = { ...scaleSettings, maxLabel: e.target.value };
                  onChange({ scaleSettings: JSON.stringify(updated) });
                }}
                placeholder="High endpoint label (e.g. Excellent)"
                className="text-xs px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Multiple Choice Grid & Checkbox Grid */}
        {["mc_grid", "checkbox_grid"].includes(element.type) && (
          <div className="space-y-3 py-2 bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-border">
            <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Matrix Grid Configuration
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Rows</span>
                <div className="mt-1 space-y-1">
                  <div className="text-xs p-1.5 bg-white dark:bg-neutral-800 border rounded">Row 1</div>
                  <div className="text-xs p-1.5 bg-white dark:bg-neutral-800 border rounded">Row 2</div>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Columns</span>
                <div className="mt-1 space-y-1">
                  <div className="text-xs p-1.5 bg-white dark:bg-neutral-800 border rounded">Column 1</div>
                  <div className="text-xs p-1.5 bg-white dark:bg-neutral-800 border rounded">Column 2</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Upload */}
        {element.type === "file_upload" && (
          <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 text-center">
            <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Respondents will upload files through this field
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Supports PDF, Documents, Spreadsheets, and Images up to 10MB
            </div>
          </div>
        )}

        {/* Date & Time */}
        {element.type === "date" && (
          <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
            <span className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border">
              Day, month, year 📅
            </span>
          </div>
        )}

        {element.type === "time" && (
          <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
            <span className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border">
              Time (HH:MM AM/PM) ⏰
            </span>
          </div>
        )}

        {/* Data Validation Controls */}
        {showValidation && (
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl space-y-2 text-xs border border-neutral-200 dark:border-neutral-700 animate-in fade-in">
            <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center justify-between">
              <span>Data Validation Rules</span>
              <button
                onClick={() => {
                  setShowValidation(false);
                  onChange({ validation: null });
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={validationSettings?.rule || "email"}
                onChange={(e) => {
                  const updated = { ...validationSettings, rule: e.target.value };
                  onChange({ validation: JSON.stringify(updated) });
                }}
                className="px-2 py-1.5 bg-white dark:bg-neutral-700 rounded border text-xs"
              >
                <option value="email">Valid Email Address</option>
                <option value="url">Valid URL</option>
                <option value="max_length">Maximum Character Count</option>
                <option value="regex">Regular Expression Match</option>
              </select>

              <input
                type="text"
                value={validationSettings?.val || ""}
                onChange={(e) => {
                  const updated = { ...validationSettings, val: e.target.value };
                  onChange({ validation: JSON.stringify(updated) });
                }}
                placeholder="Constraint / Pattern"
                className="px-2 py-1.5 bg-white dark:bg-neutral-700 rounded border text-xs"
              />

              <input
                type="text"
                value={validationSettings?.customError || ""}
                onChange={(e) => {
                  const updated = { ...validationSettings, customError: e.target.value };
                  onChange({ validation: JSON.stringify(updated) });
                }}
                placeholder="Custom error text"
                className="px-2 py-1.5 bg-white dark:bg-neutral-700 rounded border text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls: Points, Required Toggle, Duplicate, Delete, 3-dots */}
      <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Quiz Answer Key Button */}
        {isQuiz && (
          <button
            onClick={() => setShowAnswerKeyModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Answer key ({element.points || 0} pts)</span>
          </button>
        )}

        <div className="flex items-center gap-4 ml-auto">
          {/* Duplicate */}
          <button
            onClick={onDuplicate}
            title="Duplicate question"
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            title="Delete question"
            className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Required switch */}
          <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700 dark:text-neutral-300 select-none">
            <span>Required</span>
            <input
              type="checkbox"
              checked={Boolean(element.isRequired)}
              onChange={(e) => onChange({ isRequired: e.target.checked })}
              className="accent-flamingo w-4 h-4 rounded cursor-pointer"
            />
          </label>

          {/* 3-dots extra menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-2 z-40 w-52 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-border py-1 text-xs">
                <button
                  onClick={() => {
                    setShowDescription(!showDescription);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <span>Description</span>
                  {showDescription && <Check className="w-3.5 h-3.5 text-flamingo" />}
                </button>

                {["multiple_choice", "dropdown"].includes(element.type) && (
                  <button
                    onClick={() => {
                      setShowBranching(!showBranching);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <span>Go to section based on answer</span>
                    {showBranching && <Check className="w-3.5 h-3.5 text-flamingo" />}
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowValidation(!showValidation);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <span>Response validation</span>
                  {showValidation && <Check className="w-3.5 h-3.5 text-flamingo" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Answer Key & Grading Modal */}
      {showAnswerKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                  Quiz Answer Key & Points
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Points:</label>
                <input
                  type="number"
                  min={0}
                  value={element.points || 0}
                  onChange={(e) => onChange({ points: parseInt(e.target.value, 10) || 0 })}
                  className="w-16 px-2 py-1 text-xs font-bold text-center border border-border rounded-lg bg-neutral-50 dark:bg-neutral-800"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Select the correct answer(s) below. AU Forms will automatically grade respondent submissions.
            </p>

            {/* Objective Choice Selector */}
            {["multiple_choice", "dropdown", "checkboxes"].includes(element.type) && (
              <div className="space-y-2 mb-5">
                {optionsList.map((opt) => {
                  const isChecked = answerKey.correctAnswers.includes(opt.text);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        let newAnswers: string[] = [];
                        if (element.type === "checkboxes") {
                          newAnswers = isChecked
                            ? answerKey.correctAnswers.filter((a) => a !== opt.text)
                            : [...answerKey.correctAnswers, opt.text];
                        } else {
                          newAnswers = [opt.text];
                        }
                        const updatedKey = { ...answerKey, correctAnswers: newAnswers };
                        onChange({ quizAnswerKey: JSON.stringify(updatedKey) });
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        isChecked
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-semibold"
                          : "border-border hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                      }`}
                    >
                      <span className="text-xs">{opt.text}</span>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Short Answer Exact Text */}
            {element.type === "short_answer" && (
              <div className="space-y-2 mb-5">
                <label className="text-xs font-semibold">Accepted Correct Answer(s)</label>
                <input
                  type="text"
                  value={answerKey.correctAnswers[0] || ""}
                  onChange={(e) => {
                    const updatedKey = { ...answerKey, correctAnswers: [e.target.value] };
                    onChange({ quizAnswerKey: JSON.stringify(updatedKey) });
                  }}
                  placeholder="Enter exact correct answer string"
                  className="w-full text-xs px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
                />
              </div>
            )}

            {/* Feedback fields */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Feedback for Correct Answers
                </label>
                <input
                  type="text"
                  value={answerKey.feedbackCorrect || ""}
                  onChange={(e) => {
                    const updatedKey = { ...answerKey, feedbackCorrect: e.target.value };
                    onChange({ quizAnswerKey: JSON.stringify(updatedKey) });
                  }}
                  placeholder="e.g. Great job! That's completely correct."
                  className="w-full text-xs px-3 py-2 mt-1 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Feedback for Incorrect Answers & YouTube Explanation
                </label>
                <input
                  type="text"
                  value={answerKey.feedbackIncorrect || ""}
                  onChange={(e) => {
                    const updatedKey = { ...answerKey, feedbackIncorrect: e.target.value };
                    onChange({ quizAnswerKey: JSON.stringify(updatedKey) });
                  }}
                  placeholder="e.g. Remember to review Chapter 4."
                  className="w-full text-xs px-3 py-2 mt-1 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAnswerKeyModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-flamingo hover:bg-flamingo-600 rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
