import React, { useState, useRef } from "react";
import { FormElement, FormSection, api } from "../../lib/api";
import { RichTextField } from "./RichTextField";
import { stripHtml } from "../../lib/sanitize";
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
  Star,
  Upload,
  Link2,
  Loader2,
  AlertCircle,
} from "lucide-react";

export interface GridItem {
  id: string;
  text: string;
}

export interface GridConfig {
  rows: GridItem[];
  columns: GridItem[];
}

export const parseGridConfig = (options: any): GridConfig => {
  let parsed: any = null;
  try {
    parsed = typeof options === "string" ? JSON.parse(options || "{}") : options;
  } catch {}

  let rows: GridItem[] = [];
  let columns: GridItem[] = [];

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (Array.isArray(parsed.rows)) {
      rows = parsed.rows.map((r: any, idx: number) => ({
        id: r?.id || `row_${idx + 1}`,
        text: typeof r === "string" ? r : (r?.text ?? ""),
      }));
    }
    if (Array.isArray(parsed.columns)) {
      columns = parsed.columns.map((c: any, idx: number) => ({
        id: c?.id || `col_${idx + 1}`,
        text: typeof c === "string" ? c : (c?.text ?? ""),
      }));
    }
  }

  // Fallback defaults if empty or not a grid config
  if (rows.length === 0) {
    rows = [
      { id: "row_1", text: "" },
      { id: "row_2", text: "" },
    ];
  }
  if (columns.length === 0) {
    columns = [
      { id: "col_1", text: "" },
      { id: "col_2", text: "" },
    ];
  }

  return { rows, columns };
};

interface QuestionCardProps {
  element: FormElement;
  sections: FormSection[];
  isQuiz: boolean;
  isActive: boolean;
  formId?: string;
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
  { id: "rating", label: "Rating", group: "Rating" },
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
  formId,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
  dragHandleProps,
}) => {
  const [showDescription, setShowDescription] = useState(Boolean(element.description));
  const [showBranching, setShowBranching] = useState(Boolean(element.branchingLogic));
  const [showAnswerKeyModal, setShowAnswerKeyModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Image attachment state
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [urlPreviewValid, setUrlPreviewValid] = useState<boolean | null>(null);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleVerifyUrl = (urlToTest: string) => {
    const trimmed = urlToTest.trim();
    if (!trimmed) {
      setUrlPreviewValid(null);
      setUploadError(null);
      return;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:image/")) {
      setUrlPreviewValid(false);
      setUploadError("Please enter a valid image URL starting with http:// or https://");
      return;
    }
    setIsValidatingUrl(true);
    setUploadError(null);
    const testImg = new window.Image();
    testImg.onload = () => {
      setIsValidatingUrl(false);
      setUrlPreviewValid(true);
      setUploadError(null);
    };
    testImg.onerror = () => {
      setIsValidatingUrl(false);
      setUrlPreviewValid(false);
      setUploadError("Could not load image from this URL. Please verify the link.");
    };
    testImg.src = trimmed;
  };

  const handleConfirmUrl = () => {
    if (!urlInput.trim() || !urlPreviewValid) return;
    onChange({ mediaUrl: urlInput.trim() });
    setShowImageModal(false);
    setUrlInput("");
    setUrlPreviewValid(null);
    setUploadError(null);
  };

  const processFileUpload = async (file: File) => {
    setUploadError(null);
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type.toLowerCase())) {
      setUploadError("Please select a supported image (JPG, JPEG, PNG, or WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image file size exceeds the 10MB limit.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let res;
      if (formId) {
        res = await api.media.uploadForForm(formId, file, (percent) => {
          setUploadProgress(percent);
        });
      } else {
        res = await api.media.uploadGeneric(file, (percent) => {
          setUploadProgress(percent);
        });
      }

      onChange({
        mediaUrl: res.url,
        mediaMeta: JSON.stringify({
          originalFilename: res.originalFilename || file.name,
          provider: res.provider,
          bytes: res.bytes || file.size,
        }),
      });
      setUploadProgress(null);
      setShowImageModal(false);
    } catch (err: any) {
      console.error("Image upload failed", err);
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Parse options
  let optionsList: Array<{ id: string; text: string; image?: string }> = [];
  try {
    optionsList = typeof element.options === "string" ? JSON.parse(element.options || "[]") : element.options || [];
    if (!Array.isArray(optionsList) || optionsList.length === 0) {
      if (["multiple_choice", "checkboxes", "dropdown"].includes(element.type)) {
        optionsList = [{ id: "opt_1", text: "" }];
      }
    }
  } catch {
    optionsList = [{ id: "opt_1", text: "" }];
  }

  // Parse linear scale settings
  let scaleSettings = { min: 1, max: 5, minLabel: "", maxLabel: "" };
  try {
    if (element.scaleSettings) {
      scaleSettings = typeof element.scaleSettings === "string" ? JSON.parse(element.scaleSettings) : element.scaleSettings;
    }
  } catch {}

  // Parse rating settings
  let ratingSettings = { max: 5, icon: "star" };
  try {
    if (element.scaleSettings) {
      const s = typeof element.scaleSettings === "string" ? JSON.parse(element.scaleSettings) : element.scaleSettings;
      if (s && typeof s === "object") {
        if (typeof s.max === "number" && s.max >= 3 && s.max <= 10) {
          ratingSettings.max = s.max;
        }
        if (s.icon) {
          ratingSettings.icon = s.icon;
        }
      }
    }
  } catch {}

  // Parse matrix grid configuration
  const gridConfig = parseGridConfig(element.options);

  const handleUpdateRow = (index: number, text: string) => {
    const updatedRows = [...gridConfig.rows];
    updatedRows[index] = { ...updatedRows[index], text };
    onChange({ options: JSON.stringify({ ...gridConfig, rows: updatedRows }) });
  };

  const handleAddRow = () => {
    const updatedRows = [
      ...gridConfig.rows,
      { id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, text: "" },
    ];
    onChange({ options: JSON.stringify({ ...gridConfig, rows: updatedRows }) });
  };

  const handleRemoveRow = (index: number) => {
    if (gridConfig.rows.length <= 1) return;
    const updatedRows = gridConfig.rows.filter((_, i) => i !== index);
    onChange({ options: JSON.stringify({ ...gridConfig, rows: updatedRows }) });
  };

  const handleUpdateColumn = (index: number, text: string) => {
    const updatedCols = [...gridConfig.columns];
    updatedCols[index] = { ...updatedCols[index], text };
    onChange({ options: JSON.stringify({ ...gridConfig, columns: updatedCols }) });
  };

  const handleAddColumn = () => {
    const updatedCols = [
      ...gridConfig.columns,
      { id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, text: "" },
    ];
    onChange({ options: JSON.stringify({ ...gridConfig, columns: updatedCols }) });
  };

  const handleRemoveColumn = (index: number) => {
    if (gridConfig.columns.length <= 1) return;
    const updatedCols = gridConfig.columns.filter((_, i) => i !== index);
    onChange({ options: JSON.stringify({ ...gridConfig, columns: updatedCols }) });
  };

  const handleTypeChange = (newType: string) => {
    const updates: Partial<FormElement> = { type: newType as any };

    if (["mc_grid", "checkbox_grid"].includes(newType)) {
      const currentConfig = parseGridConfig(element.options);
      updates.options = JSON.stringify(currentConfig);
    } else if (["multiple_choice", "checkboxes", "dropdown"].includes(newType)) {
      if (!Array.isArray(optionsList) || optionsList.length === 0) {
        updates.options = JSON.stringify([{ id: `opt_${Date.now()}`, text: "" }]);
      }
    } else if (newType === "rating") {
      updates.scaleSettings = JSON.stringify({
        max: ratingSettings.max || 5,
        icon: ratingSettings.icon || "star",
      });
    } else if (newType === "linear_scale") {
      updates.scaleSettings = JSON.stringify({
        min: scaleSettings.min ?? 1,
        max: scaleSettings.max ?? 5,
        minLabel: scaleSettings.minLabel ?? "",
        maxLabel: scaleSettings.maxLabel ?? "",
      });
    }

    onChange(updates);
  };

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
    const newOptions = [...optionsList, { id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, text: "" }];
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
      className={`relative bg-white rounded-2xl border transition-all ${
        isActive
          ? "border-flamingo shadow-md shadow-flamingo/10 ring-1 ring-flamingo"
          : "border-neutral-200 hover:border-neutral-300"
      } p-5 sm:p-6 mb-4`}
    >
      {/* Top Drag Handle (isolated button so only the 6-dot icon activates drag) */}
      <div className="flex items-center justify-center -mt-3 mb-2 select-none">
        <button
          type="button"
          {...dragHandleProps}
          className="inline-flex items-center justify-center p-1 px-3 rounded-md cursor-grab active:cursor-grabbing text-neutral-400 hover:text-flamingo hover:bg-neutral-100 transition select-none touch-none"
          title="Drag to reorder question (press & hold on touch)"
          aria-label="Drag handle to reorder question"
        >
          <GripVertical className="w-5 h-5 rotate-90" />
        </button>
      </div>

      {/* Header: Title Input + Question Image Attachment Button + Question Type Dropdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 w-full flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <RichTextField
              value={element.title || ""}
              onChange={(title) => onChange({ title })}
              placeholder="Question"
              singleLine
              underlineColor="flamingo"
              className="text-base sm:text-lg font-normal text-neutral-900"
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUploadError(null);
              setShowImageModal(true);
            }}
            className={`p-2 rounded-xl transition-colors flex-shrink-0 ${
              element.mediaUrl
                ? "text-flamingo bg-flamingo-50 hover:bg-flamingo-100"
                : "text-neutral-500 hover:text-flamingo hover:bg-neutral-100"
            }`}
            title={element.mediaUrl ? "Change question image" : "Add image to question"}
            aria-label="Add image to question"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Type selector */}
        <div className="relative w-full sm:w-56 flex-shrink-0">
          <select
            value={element.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-flamingo"
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
          <RichTextField
            value={element.description || ""}
            onChange={(description) => onChange({ description })}
            placeholder="Description or helper text"
            singleLine={false}
            underlineColor="neutral"
            className="text-xs font-normal text-muted-foreground"
          />
        </div>
      )}

      {/* Attached Question Image (Editor View) */}
      {element.mediaUrl && (
        <div className="mt-4 w-full">
          <div className="relative group inline-block max-w-full">
            <div className="rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50 p-1 flex items-center justify-start">
              <img
                src={element.mediaUrl}
                alt={stripHtml(element.title) || "Question image"}
                className="max-h-72 w-auto max-w-full object-contain rounded-lg"
              />
            </div>
            {/* Controls to Replace or Remove the image */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadError(null);
                  setShowImageModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
              >
                <ImageIcon className="w-3.5 h-3.5 text-neutral-500" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ mediaUrl: "" });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
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
              className="w-full max-w-sm text-sm text-muted-foreground bg-neutral-50 border-b border-neutral-300 pb-1.5 focus:outline-none cursor-not-allowed"
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
              className="w-full text-sm text-muted-foreground bg-neutral-50 border-b border-neutral-300 pb-1.5 focus:outline-none cursor-not-allowed resize-none"
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
                  placeholder="Enter option"
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
                    className="text-[11px] px-2 py-1 bg-neutral-100 rounded-lg border border-neutral-300"
                  >
                    <option value="next">Continue to next section</option>
                    {sections.map((s, sIdx) => (
                      <option key={s.id} value={s.id}>
                        Go to section {sIdx + 1} ({stripHtml(s.title) || "Section"})
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
                className="px-2 py-1 bg-neutral-50 border border-neutral-300 rounded"
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
                className="px-2 py-1 bg-neutral-50 border border-neutral-300 rounded"
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
                className="text-xs px-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg"
              />
              <input
                type="text"
                value={scaleSettings.maxLabel || ""}
                onChange={(e) => {
                  const updated = { ...scaleSettings, maxLabel: e.target.value };
                  onChange({ scaleSettings: JSON.stringify(updated) });
                }}
                placeholder="High endpoint label (e.g. Excellent)"
                className="text-xs px-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Rating Question Configuration */}
        {element.type === "rating" && (
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Icon Selector */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Rating icon:</span>
                <select
                  value={ratingSettings.icon || "star"}
                  onChange={(e) => {
                    const updated = { ...ratingSettings, icon: e.target.value };
                    onChange({ scaleSettings: JSON.stringify(updated) });
                  }}
                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-flamingo"
                >
                  <option value="star">Stars (★)</option>
                </select>
              </div>

              {/* Scale Selector (3 to 10 stars) */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Rating scale:</span>
                <select
                  value={ratingSettings.max || 5}
                  onChange={(e) => {
                    const updated = { ...ratingSettings, max: Number(e.target.value) };
                    onChange({ scaleSettings: JSON.stringify(updated) });
                  }}
                  className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-flamingo"
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} stars
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Editor Preview */}
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Preview ({ratingSettings.max || 5} Stars)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: ratingSettings.max || 5 }, (_, i) => i + 1).map((starNum) => (
                  <div
                    key={starNum}
                    className="flex flex-col items-center gap-1 text-muted-foreground"
                  >
                    <Star className="w-6 h-6 text-neutral-300 stroke-[1.5]" />
                    <span className="text-[10px] font-medium">{starNum}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Multiple Choice Grid & Checkbox Grid */}
        {["mc_grid", "checkbox_grid"].includes(element.type) && (
          <div className="space-y-4 py-2 bg-neutral-50/70 p-4 rounded-xl border border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800">
                Matrix Grid Configuration
              </span>
              <span className="text-[11px] text-muted-foreground">
                {element.type === "mc_grid" ? "One response per row (Radio)" : "Multiple responses per row (Checkbox)"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rows List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Rows
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {gridConfig.rows.length} {gridConfig.rows.length === 1 ? "row" : "rows"}
                  </span>
                </div>

                <div className="space-y-2">
                  {gridConfig.rows.map((row, idx) => (
                    <div key={row.id || idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={row.text}
                        onChange={(e) => handleUpdateRow(idx, e.target.value)}
                        placeholder="Enter row"
                        className="flex-1 text-xs px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-flamingo"
                      />
                      {gridConfig.rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-neutral-100 rounded-md transition"
                          title="Remove row"
                          aria-label={`Remove row ${idx + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-flamingo hover:text-flamingo-700 py-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add row</span>
                </button>
              </div>

              {/* Columns List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Columns
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {gridConfig.columns.length} {gridConfig.columns.length === 1 ? "column" : "columns"}
                  </span>
                </div>

                <div className="space-y-2">
                  {gridConfig.columns.map((col, idx) => (
                    <div key={col.id || idx} className="flex items-center gap-2">
                      <div className="w-5 flex justify-center flex-shrink-0">
                        {element.type === "mc_grid" ? (
                          <div className="w-3.5 h-3.5 rounded-full border border-neutral-400" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-xs border border-neutral-400" />
                        )}
                      </div>
                      <input
                        type="text"
                        value={col.text}
                        onChange={(e) => handleUpdateColumn(idx, e.target.value)}
                        placeholder="Enter column"
                        className="flex-1 text-xs px-3 py-1.5 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-flamingo"
                      />
                      {gridConfig.columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveColumn(idx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-neutral-100 rounded-md transition"
                          title="Remove column"
                          aria-label={`Remove column ${idx + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-flamingo hover:text-flamingo-700 py-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add column</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File Upload */}
        {element.type === "file_upload" && (
          <div className="p-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
            <div className="text-xs font-semibold text-neutral-800">
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
            <span className="px-3 py-1.5 bg-neutral-100 rounded-lg border border-neutral-200">
              Day, month, year 📅
            </span>
          </div>
        )}

        {element.type === "time" && (
          <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
            <span className="px-3 py-1.5 bg-neutral-100 rounded-lg border border-neutral-200">
              Time (HH:MM AM/PM) ⏰
            </span>
          </div>
        )}
      </div>

      {/* Footer Controls: Points, Required Toggle, Duplicate, Delete, 3-dots */}
      <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Quiz Answer Key Button */}
        {isQuiz && (
          <button
            onClick={() => setShowAnswerKeyModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 font-bold border border-purple-200 hover:bg-purple-100 transition"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Answer key ({element.points || 0} pts)</span>
          </button>
        )}

        <div className="flex items-center gap-3 ml-auto">
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

          <div className="h-4 w-px bg-neutral-200" />

          {/* Required switch */}
          <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700 select-none">
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
              <div className="absolute right-0 bottom-full mb-2 z-40 w-52 bg-white rounded-xl shadow-xl border border-neutral-200 py-1 text-xs">
                <button
                  onClick={() => {
                    setShowDescription(!showDescription);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-50"
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
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-50"
                  >
                    <span>Go to section based on answer</span>
                    {showBranching && <Check className="w-3.5 h-3.5 text-flamingo" />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Answer Key & Grading Modal */}
      {showAnswerKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-neutral-200 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-neutral-900">
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
                  className="w-16 px-2 py-1 text-xs font-bold text-center border border-border rounded-lg bg-neutral-50"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Select the correct answer(s) below. Snow Forms will automatically grade respondent submissions.
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
                          ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold"
                          : "border-border hover:bg-neutral-50 text-neutral-800"
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
                  className="w-full text-xs px-3 py-2 bg-neutral-50 border rounded-xl"
                />
              </div>
            )}

            {/* Feedback fields */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <label className="text-xs font-semibold text-neutral-700">
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
                  className="w-full text-xs px-3 py-2 mt-1 bg-neutral-50 border rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700">
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
                  className="w-full text-xs px-3 py-2 mt-1 bg-neutral-50 border rounded-xl"
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

      {/* Question Image Attachment Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-neutral-200 max-w-lg w-full p-6 shadow-2xl relative"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-flamingo" />
                <h3 className="font-bold text-base text-neutral-900">
                  {element.mediaUrl ? "Replace Question Image" : "Add Image to Question"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImageModal(false);
                  setUploadError(null);
                  setUploadProgress(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-6 mt-4 border-b border-neutral-200">
              <button
                type="button"
                onClick={() => {
                  setImageTab("upload");
                  setUploadError(null);
                }}
                className={`pb-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
                  imageTab === "upload"
                    ? "border-flamingo text-flamingo"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload from Device</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageTab("url");
                  setUploadError(null);
                }}
                className={`pb-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
                  imageTab === "url"
                    ? "border-flamingo text-flamingo"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span>Add Image Using URL</span>
              </button>
            </div>

            {/* Tab 1: Upload from Device */}
            {imageTab === "upload" && (
              <div className="mt-5 space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFileUpload(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    isDragging
                      ? "border-flamingo bg-flamingo-50/50"
                      : "border-neutral-300 hover:border-flamingo bg-neutral-50/50 hover:bg-flamingo-50/20"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processFileUpload(file);
                    }}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-flamingo-50 text-flamingo flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold text-neutral-800">
                      Click to upload or drag & drop
                    </div>
                    <div className="text-xs text-neutral-500">
                      JPG, JPEG, PNG, or WEBP (Max 10MB)
                    </div>
                  </div>
                </div>

                {isUploading && (
                  <div className="space-y-2 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="flex items-center justify-between text-xs font-medium text-neutral-700">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-flamingo" />
                        Uploading image...
                      </span>
                      <span>{uploadProgress ?? 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-flamingo transition-all duration-200"
                        style={{ width: `${uploadProgress ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Add Image Using URL */}
            {imageTab === "url" && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Image Link / URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUrlInput(val);
                        handleVerifyUrl(val);
                      }}
                      placeholder="https://example.com/image.png"
                      className="flex-1 text-xs px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-flamingo"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyUrl(urlInput)}
                      className="px-3 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
                    >
                      {isValidatingUrl ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Preview"
                      )}
                    </button>
                  </div>
                </div>

                {/* URL Preview */}
                {urlPreviewValid && urlInput.trim() && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      Live Preview
                    </span>
                    <div className="max-h-48 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-2 flex items-center justify-center">
                      <img
                        src={urlInput.trim()}
                        alt="Preview"
                        className="max-h-44 w-auto max-w-full object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={!urlPreviewValid || isValidatingUrl}
                    onClick={handleConfirmUrl}
                    className="px-5 py-2 text-xs font-bold text-white bg-flamingo hover:bg-flamingo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition"
                  >
                    Add Image
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
