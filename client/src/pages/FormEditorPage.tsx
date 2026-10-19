import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, FormItem, FormSection, FormElement } from "../lib/api";
import { QuestionCard } from "../components/editor/QuestionCard";
import { ContentBlockCard } from "../components/editor/ContentBlockCard";
import { FloatingToolbar } from "../components/editor/FloatingToolbar";
import { ResponsesTab } from "../components/editor/ResponsesTab";
import { SettingsTab } from "../components/editor/SettingsTab";
import {
  ArrowLeft,
  Eye,
  Share2,
  CheckCircle2,
  MoreVertical,
  Plus,
  Trash2,
  Copy,
  Clock,
  Sparkles,
  Split,
  FolderPlus,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const FormEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<any>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [elements, setElements] = useState<FormElement[]>([]);
  const [activeTab, setActiveTab] = useState<"questions" | "responses" | "settings">("questions");
  const [activeElementId, setActiveElementId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Debounce ref for saving
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchFormDetails = async () => {
    if (!id) return;
    try {
      const data = await api.forms.get(id);
      setForm(data);
      setSections(data.sections || []);
      setElements(data.elements || []);
      if (data.elements?.length > 0) {
        setActiveElementId(data.elements[0].id);
      }
    } catch (err) {
      console.error(err);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFormDetails();
  }, [id]);

  // Autosave when layout or form updates
  const triggerSave = (
    updatedForm: any,
    updatedSections: FormSection[],
    updatedElements: FormElement[]
  ) => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (!id) return;
        await Promise.all([
          api.forms.update(id, {
            title: updatedForm.title,
            description: updatedForm.description,
            status: updatedForm.status,
            isQuiz: updatedForm.isQuiz,
            formSettings: updatedForm.formSettings,
            themeSettings: updatedForm.themeSettings,
            quizSettings: updatedForm.quizSettings,
            opensAt: updatedForm.opensAt,
            closesAt: updatedForm.closesAt,
            maxResponses: updatedForm.maxResponses,
          }),
          api.forms.saveLayout(id, {
            sections: updatedSections,
            elements: updatedElements,
          }),
        ]);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Autosave error", err);
        setSaveStatus("unsaved");
      }
    }, 800);
  };

  const handleUpdateForm = (updates: any) => {
    const nextForm = { ...form, ...updates };
    setForm(nextForm);
    triggerSave(nextForm, sections, elements);
  };

  // Sections management
  const handleAddSection = () => {
    const nextOrder = sections.length;
    const newSection: FormSection = {
      id: crypto.randomUUID(),
      orderIndex: nextOrder,
      title: `Section ${nextOrder + 1}`,
      description: "",
    };
    const nextSections = [...sections, newSection];
    setSections(nextSections);

    // Also add a default question to the new section
    const newElement: FormElement = {
      id: crypto.randomUUID(),
      sectionId: newSection.id,
      orderIndex: 0,
      type: "short_answer",
      title: "Untitled Question",
      description: "",
      isRequired: false,
      points: form.isQuiz ? 1 : 0,
      options: "[]",
    };
    const nextElements = [...elements, newElement];
    setElements(nextElements);
    setActiveElementId(newElement.id);

    triggerSave(form, nextSections, nextElements);
  };

  // Elements management
  const handleAddElement = (type: string = "multiple_choice") => {
    const activeSecId = sections[0]?.id || crypto.randomUUID();
    const newElement: FormElement = {
      id: crypto.randomUUID(),
      sectionId: activeSecId,
      orderIndex: elements.length,
      type: type as any,
      title: type === "title_desc" ? "Untitled Title" : "Untitled Question",
      description: "",
      isRequired: false,
      points: form.isQuiz ? 1 : 0,
      options: ["multiple_choice", "checkboxes", "dropdown"].includes(type)
        ? JSON.stringify([{ id: "opt_1", text: "Option 1" }])
        : "[]",
    };

    const nextElements = [...elements, newElement];
    setElements(nextElements);
    setActiveElementId(newElement.id);
    triggerSave(form, sections, nextElements);
  };

  const handleUpdateElement = (elementId: string, updates: Partial<FormElement>) => {
    const nextElements = elements.map((el) => (el.id === elementId ? { ...el, ...updates } : el));
    setElements(nextElements);
    triggerSave(form, sections, nextElements);
  };

  const handleDuplicateElement = (element: FormElement) => {
    const cloned: FormElement = {
      ...element,
      id: crypto.randomUUID(),
      title: `${element.title} (Copy)`,
      orderIndex: element.orderIndex + 1,
    };
    const nextElements = [...elements, cloned];
    setElements(nextElements);
    setActiveElementId(cloned.id);
    triggerSave(form, sections, nextElements);
  };

  const handleDeleteElement = (elementId: string) => {
    if (elements.length <= 1) {
      alert("A form must have at least one question or block.");
      return;
    }
    const nextElements = elements.filter((el) => el.id !== elementId);
    setElements(nextElements);
    triggerSave(form, sections, nextElements);
  };

  const copyPublicLink = () => {
    if (!form) return;
    const url = `${window.location.origin}/forms/${form.publicId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-alabaster dark:bg-neutral-950 text-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-border px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Back + Form Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link
              to="/dashboard"
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <img src="/avantika-logo.svg" alt="AU" className="w-7 h-7 object-contain hidden sm:block" />

            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleUpdateForm({ title: e.target.value })}
                className="text-base sm:text-lg font-bold bg-transparent border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-flamingo px-1 py-0.5 focus:outline-none transition truncate max-w-sm sm:max-w-md"
              />
            </div>

            {/* Save Status */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              {saveStatus === "saving" && (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Saving...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Saved to Turso</span>
                </>
              )}
              {saveStatus === "unsaved" && (
                <span className="text-amber-500">Unsaved changes</span>
              )}
            </div>
          </div>

          {/* Right: Preview, Share, Status */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(`/forms/${form.publicId}`, "_blank")}
              title="Preview Form"
              className="p-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-flamingo hover:bg-flamingo-600 rounded-lg shadow-sm shadow-flamingo/20 transition active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>

            {/* Publish Toggle Button */}
            <button
              onClick={() =>
                handleUpdateForm({
                  status: form.status === "published" ? "closed" : "published",
                })
              }
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                form.status === "published"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-border hover:bg-neutral-200"
              }`}
            >
              {form.status === "published" ? "Published" : "Draft (Publish)"}
            </button>
          </div>
        </div>

        {/* 3 Main Tabs: Questions, Responses, Settings */}
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 mt-2 text-xs font-bold border-t border-border pt-1">
          <button
            onClick={() => setActiveTab("questions")}
            className={`py-2 px-3 border-b-2 transition ${
              activeTab === "questions"
                ? "border-flamingo text-flamingo"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Questions
          </button>

          <button
            onClick={() => setActiveTab("responses")}
            className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "responses"
                ? "border-flamingo text-flamingo"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Responses</span>
            <span className="px-1.5 py-0.2 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px]">
              {form.responseCount || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`py-2 px-3 border-b-2 transition ${
              activeTab === "settings"
                ? "border-flamingo text-flamingo"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <main className="max-w-5xl mx-auto px-4 py-8 relative">
        {activeTab === "questions" && (
          <div className="flex items-start gap-4">
            {/* Questions Canvas */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Form Title & Description Card */}
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border-t-8 border-t-flamingo border-x border-b border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleUpdateForm({ title: e.target.value })}
                  placeholder="Form title"
                  className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent border-b-2 border-transparent focus:border-flamingo pb-1 focus:outline-none transition mb-3"
                />

                <textarea
                  rows={2}
                  value={form.description || ""}
                  onChange={(e) => handleUpdateForm({ description: e.target.value })}
                  placeholder="Form description (supports hyperlinks, event schedule, rules...)"
                  className="w-full text-sm text-neutral-600 dark:text-neutral-400 bg-transparent border-b border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 pb-1 focus:outline-none resize-none"
                />
              </div>

              {/* Elements List */}
              {elements.map((el) => {
                const isQuestion = ![
                  "title_desc",
                  "image",
                  "video",
                ].includes(el.type);

                if (isQuestion) {
                  return (
                    <QuestionCard
                      key={el.id}
                      element={el}
                      sections={sections}
                      isQuiz={Boolean(form.isQuiz)}
                      isActive={activeElementId === el.id}
                      onSelect={() => setActiveElementId(el.id)}
                      onChange={(updates: Partial<FormElement>) => handleUpdateElement(el.id, updates)}
                      onDuplicate={() => handleDuplicateElement(el)}
                      onDelete={() => handleDeleteElement(el.id)}
                    />
                  );
                } else {
                  return (
                    <ContentBlockCard
                      key={el.id}
                      element={el}
                      isActive={activeElementId === el.id}
                      onSelect={() => setActiveElementId(el.id)}
                      onChange={(updates: Partial<FormElement>) => handleUpdateElement(el.id, updates)}
                      onDuplicate={() => handleDuplicateElement(el)}
                      onDelete={() => handleDeleteElement(el.id)}
                    />
                  );
                }
              })}
            </div>

            {/* Google Forms Floating Toolbar */}
            <FloatingToolbar
              onAddQuestion={() => handleAddElement("multiple_choice")}
              onAddTitleDesc={() => handleAddElement("title_desc")}
              onAddImage={() => handleAddElement("image")}
              onAddVideo={() => handleAddElement("video")}
              onAddSection={handleAddSection}
            />
          </div>
        )}

        {activeTab === "responses" && (
          <ResponsesTab
            form={form}
            onStatusToggle={(status: "published" | "closed") => handleUpdateForm({ status })}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab form={form} onChange={handleUpdateForm} />
        )}
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              Share "{form.title}"
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Distribute this public link or QR code to respondents across campus.
            </p>

            <div className="my-5 p-4 bg-white rounded-xl border border-neutral-200 flex flex-col items-center justify-center">
              <QRCodeSVG
                value={`${window.location.origin}/forms/${form.publicId}`}
                size={160}
                level="M"
                includeMargin
              />
              <span className="text-[11px] text-neutral-500 mt-2 font-medium">
                Scan to open on phone
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Public Form Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/forms/${form.publicId}`}
                  className="flex-1 px-3 py-2 text-xs bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-mono"
                />
                <button
                  onClick={copyPublicLink}
                  className="px-3.5 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl hover:bg-flamingo-600 transition flex items-center gap-1.5 flex-shrink-0"
                >
                  {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
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
