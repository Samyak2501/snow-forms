import React, { useState, useEffect, useRef } from"react";
import { useParams, useNavigate, Link } from"react-router-dom";
import { api, FormItem, FormSection, FormElement } from"../lib/api";
import { QuestionCard } from"../components/editor/QuestionCard";
import { ContentBlockCard } from"../components/editor/ContentBlockCard";
import { FloatingToolbar } from"../components/editor/FloatingToolbar";
import { ResponsesTab } from"../components/editor/ResponsesTab";
import { SettingsTab } from"../components/editor/SettingsTab";
import { RichTextField } from"../components/editor/RichTextField";
import { stripHtml } from"../lib/sanitize";
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
 Download,
 ExternalLink,
 AlertCircle,
 RotateCcw,
 GripVertical,
} from"lucide-react";
import { QRCodeSVG } from"qrcode.react";

import {
 DndContext,
 closestCenter,
 KeyboardSensor,
 MouseSensor,
 TouchSensor,
 useSensor,
 useSensors,
 DragEndEvent,
 DragStartEvent,
 DragOverlay,
} from"@dnd-kit/core";
import {
 arrayMove,
 SortableContext,
 sortableKeyboardCoordinates,
 verticalListSortingStrategy,
 useSortable,
} from"@dnd-kit/sortable";
import { CSS } from"@dnd-kit/utilities";

interface SortableBlockItemProps {
 id: string;
 children: (dragHandleProps: any, isDragging: boolean) => React.ReactNode;
}

const SortableBlockItem: React.FC<SortableBlockItemProps> = ({ id, children }) => {
 const {
 attributes,
 listeners,
 setNodeRef,
 transform,
 transition,
 isDragging,
 } = useSortable({ id });

 const style: React.CSSProperties = {
 transform: CSS.Translate.toString(transform),
 transition,
 zIndex: isDragging ? 50 : undefined,
 position:"relative",
 };

 return (
 <div
 ref={setNodeRef}
 style={style}
 className={
 isDragging
 ?"opacity-30 scale-[0.99] transition-all duration-200 pointer-events-none"
 :"transition-transform duration-200"
 }
 >
 {children({ ...attributes, ...listeners }, isDragging)}
 </div>
 );
};

const getFormDescriptionPlaceholder = (title?: string) => {
 const t = stripHtml(title ||"").trim().toLowerCase();
 if (t ==="course feedback") {
 return"Enter course name, instructor, semester, and additional information...";
 }
 if (t ==="graded quiz") {
 return"Enter quiz instructions, syllabus topics, and duration...";
 }
 return"Form description (optional)";
};

export const FormEditorPage: React.FC = () => {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();

 const [form, setForm] = useState<any>(null);
 const [sections, setSections] = useState<FormSection[]>([]);
 const [elements, setElements] = useState<FormElement[]>([]);
 const [activeTab, setActiveTab] = useState<"questions"|"responses"|"settings">("questions");
 const [activeElementId, setActiveElementId] = useState<string | null>(null);
 const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

 const [loading, setLoading] = useState(true);
 const [saveStatus, setSaveStatus] = useState<"saved"|"saving"|"unsaved"|"error">("saved");

 // Share & Publish Modals
 const [showShareModal, setShowShareModal] = useState(false);
 const [showPublishSuccessModal, setShowPublishSuccessModal] = useState(false);
 const [showDraftShareWarningModal, setShowDraftShareWarningModal] = useState(false);
 const [publishing, setPublishing] = useState(false);
 const [unpublishing, setUnpublishing] = useState(false);
 const [copiedLink, setCopiedLink] = useState(false);

 // Top-Left Header Plain-Text Title
 const [headerTitle, setHeaderTitle] = useState("");
 const isHeaderFocusedRef = useRef(false);

 useEffect(() => {
 if (!isHeaderFocusedRef.current && form) {
 const plain = stripHtml(form.title);
 setHeaderTitle(plain.trim().length === 0 ?"": plain);
 }
 }, [form?.title]);

 // Drag and drop state
 const [activeDragId, setActiveDragId] = useState<string | null>(null);

 // dnd-kit sensors: MouseSensor for instant desktop drag, TouchSensor with hold constraint to prevent accidental scrolling drag
 const sensors = useSensors(
 useSensor(MouseSensor, {
 activationConstraint: {
 distance: 8,
 },
 }),
 useSensor(TouchSensor, {
 activationConstraint: {
 delay: 250,
 tolerance: 6,
 },
 }),
 useSensor(KeyboardSensor, {
 coordinateGetter: sortableKeyboardCoordinates,
 })
 );

 // Debounce ref for saving
 const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

 const fetchFormDetails = async () => {
 if (!id) return;
 try {
 const data = await api.forms.get(id);
 const loadedSections =
 data.sections && data.sections.length > 0
 ? data.sections
 : [{ id: crypto.randomUUID(), orderIndex: 0, title:"", description:""}];
 setForm(data);
 setSections(loadedSections);
 setActiveSectionId(loadedSections[0].id);
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
 setSaveStatus("error");
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
 title:"",
 description:"",
 };
 const nextSections = [...sections, newSection];
 setSections(nextSections);
 setActiveSectionId(newSection.id);

 // Also add a default question to the new section
 const newElement: FormElement = {
 id: crypto.randomUUID(),
 sectionId: newSection.id,
 orderIndex: elements.length,
 type:"short_answer",
 title:"",
 description:"",
 isRequired: false,
 points: form?.isQuiz ? 1 : 0,
 options:"[]",
 };
 const nextElements = [...elements, newElement];
 setElements(nextElements);
 setActiveElementId(newElement.id);

 triggerSave(form, nextSections, nextElements);
 };

 const handleUpdateSection = (sectionId: string, updates: Partial<FormSection>) => {
 const nextSections = sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s));
 setSections(nextSections);
 triggerSave(form, nextSections, elements);
 };

 const handleDeleteSection = (sectionId: string) => {
 if (sections.length <= 1) {
 alert("A form must have at least one section.");
 return;
 }
 const secIndex = sections.findIndex((s) => s.id === sectionId);
 const targetSection = sections[secIndex > 0 ? secIndex - 1 : 1];

 // Safely reassign elements to neighboring section
 const nextElements = elements.map((el) =>
 el.sectionId === sectionId ? { ...el, sectionId: targetSection.id } : el
 );
 const nextSections = sections
 .filter((s) => s.id !== sectionId)
 .map((s, idx) => ({ ...s, orderIndex: idx }));

 setSections(nextSections);
 setElements(nextElements);
 setActiveSectionId(targetSection.id);
 triggerSave(form, nextSections, nextElements);
 };

 const getActiveSectionId = (): string => {
 if (activeSectionId && sections.some((s) => s.id === activeSectionId)) {
 return activeSectionId;
 }
 if (activeElementId) {
 const activeEl = elements.find((el) => el.id === activeElementId);
 if (activeEl && sections.some((s) => s.id === activeEl.sectionId)) {
 return activeEl.sectionId;
 }
 }
 return sections[0]?.id || crypto.randomUUID();
 };

 // Elements management
 const handleAddElement = (type: string ="multiple_choice") => {
 const targetSectionId = getActiveSectionId();
 const newElement: FormElement = {
 id: crypto.randomUUID(),
 sectionId: targetSectionId,
 orderIndex: elements.length,
 type: type as any,
 title:"",
 description:"",
 isRequired: false,
 points: form?.isQuiz ? 1 : 0,
        options: ["mc_grid", "checkbox_grid"].includes(type)
          ? JSON.stringify({
              rows: [
                { id: "row_1", text: "" },
                { id: "row_2", text: "" },
              ],
              columns: [
                { id: "col_1", text: "" },
                { id: "col_2", text: "" },
              ],
            })
          : ["multiple_choice", "checkboxes", "dropdown"].includes(type)
          ? JSON.stringify([{ id: "opt_1", text: "" }])
          : "[]",
 scaleSettings: type ==="rating"
 ? JSON.stringify({ max: 5, icon:"star"})
 : type ==="linear_scale"
 ? JSON.stringify({ min: 1, max: 5, minLabel:"", maxLabel:""})
 : undefined,
 };

 const nextElements = [...elements, newElement];
 setElements(nextElements);
 setActiveElementId(newElement.id);
 setActiveSectionId(targetSectionId);
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
 title: element.title ?`${element.title} (Copy)`:"",
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

 // Drag-and-Drop Handlers
 const handleDragStart = (event: DragStartEvent) => {
 setActiveDragId(String(event.active.id));
 };

 const handleDragEnd = (event: DragEndEvent) => {
 const { active, over } = event;
 setActiveDragId(null);

 if (!over || active.id === over.id) return;

 const activeId = String(active.id);
 const overId = String(over.id);

 const oldIndex = elements.findIndex((el) => el.id === activeId);
 const newIndex = elements.findIndex((el) => el.id === overId);

 if (oldIndex === -1 || newIndex === -1) return;

 // Move in elements array
 const reordered = arrayMove(elements, oldIndex, newIndex);

 // Keep section membership consistent with destination block
 const destinationElement = elements[newIndex];
 const destinationSectionId = destinationElement?.sectionId || elements[oldIndex].sectionId;

 const updatedElements = reordered.map((el, idx) => {
 if (el.id === activeId) {
 return { ...el, sectionId: destinationSectionId, orderIndex: idx };
 }
 return { ...el, orderIndex: idx };
 });

 setElements(updatedElements);
 triggerSave(form, sections, updatedElements);
 };


 const copyPublicLink = () => {
 if (!form) return;
 const url =`${window.location.origin}/forms/${form.publicId}`;
 navigator.clipboard.writeText(url);
 setCopiedLink(true);
 setTimeout(() => setCopiedLink(false), 2000);
 };

 const downloadQrCode = (elementId ="published-qr-code") => {
 const svg = document.getElementById(elementId);
 if (!svg) return;
 const svgData = new XMLSerializer().serializeToString(svg);
 const canvas = document.createElement("canvas");
 const ctx = canvas.getContext("2d");
 const img = new Image();
 img.onload = () => {
 canvas.width = img.width + 40;
 canvas.height = img.height + 40;
 if (ctx) {
 ctx.fillStyle ="#ffffff";
 ctx.fillRect(0, 0, canvas.width, canvas.height);
 ctx.drawImage(img, 20, 20);
 const pngFile = canvas.toDataURL("image/png");
 const downloadLink = document.createElement("a");
 const sanitizedTitle = (stripHtml(form.title) ||"au-form")
 .replace(/[^a-z0-9]/gi,"_")
 .toLowerCase();
 downloadLink.download =`${sanitizedTitle}_qr.png`;
 downloadLink.href = pngFile;
 downloadLink.click();
 }
 };
 img.src ="data:image/svg+xml;base64,"+ btoa(unescape(encodeURIComponent(svgData)));
 };

 const handlePublish = async () => {
 if (!id) return;

 // Pre-publish validation for question options
 for (const el of elements) {
 const qTitle = stripHtml(el.title || "Untitled Question").trim() || "Untitled Question";
 if (["multiple_choice", "checkboxes", "dropdown"].includes(el.type)) {
 let opts: any[] = [];
 try {
 opts = typeof el.options === "string" ? JSON.parse(el.options || "[]") : el.options || [];
 } catch {
 opts = [];
 }
 const valid = Array.isArray(opts) ? opts.filter((o) => o?.text && String(o.text).trim().length > 0) : [];
 if (valid.length === 0) {
 alert(`Cannot publish: Question "${qTitle}" needs at least one option with text.`);
 return;
 }
 } else if (["mc_grid", "checkbox_grid"].includes(el.type)) {
 let grid: any = {};
 try {
 grid = typeof el.options === "string" ? JSON.parse(el.options || "{}") : el.options || {};
 } catch {
 grid = {};
 }
 const rows = Array.isArray(grid.rows) ? grid.rows.filter((r: any) => r?.text && String(r.text).trim().length > 0) : [];
 const cols = Array.isArray(grid.columns) ? grid.columns.filter((c: any) => c?.text && String(c.text).trim().length > 0) : [];
 if (rows.length === 0 || cols.length === 0) {
 alert(`Cannot publish: Grid question "${qTitle}" needs at least one row and one column with text.`);
 return;
 }
 }
 }

 setPublishing(true);

 try {
 // 1. Flush any pending autosave
 if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
 await Promise.all([
 api.forms.update(id, {
 title: form.title,
 description: form.description,
 isQuiz: form.isQuiz,
 formSettings: form.formSettings,
 themeSettings: form.themeSettings,
 quizSettings: form.quizSettings,
 opensAt: form.opensAt,
 closesAt: form.closesAt,
 maxResponses: form.maxResponses,
 }),
 api.forms.saveLayout(id, {
 sections,
 elements,
 }),
 ]);

 // 2. Call publish API
 await api.forms.publish(id);

 // 3. Update local state
 setForm((prev: any) => ({
 ...prev,
 status:"published",
 isPublished: true,
 isDraft: false,
 isAcceptingResponses: true,
 }));
 setSaveStatus("saved");
 setShowDraftShareWarningModal(false);
 setShowPublishSuccessModal(true);
 } catch (err: any) {
 console.error("Publishing error", err);
 alert(`Publish failed: ${err.message ||"Please check form title and questions."}`);
 } finally {
 setPublishing(false);
 }
 };

 const handleUnpublish = async () => {
 if (!id) return;
 if (!confirm("Revert this form to draft? Anonymous respondents will not be able to view or submit it.")) return;
 setUnpublishing(true);
 try {
 await api.forms.unpublish(id);
 setForm((prev: any) => ({
 ...prev,
 status:"draft",
 isPublished: false,
 isDraft: true,
 }));
 setSaveStatus("saved");
 } catch (err: any) {
 alert(`Failed to unpublish: ${err.message}`);
 } finally {
 setUnpublishing(false);
 }
 };

 const handleToggleResponses = async (accepting: boolean) => {
 if (!id) return;
 try {
 const res = await api.forms.toggleResponses(id, accepting);
 setForm((prev: any) => {
 const curSettings = typeof prev?.formSettings ==="string"
 ? JSON.parse(prev.formSettings ||"{}")
 : (prev?.formSettings || {});
 return {
 ...prev,
 isAcceptingResponses: res.acceptingResponses,
 formSettings: {
 ...curSettings,
 acceptingResponses: res.acceptingResponses,
 },
 };
 });
 } catch (err: any) {
 alert(`Failed to toggle response collection: ${err.message}`);
 }
 };

 if (loading || !form) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin"/>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-alabaster text-foreground">
 {/* Top Navbar */}
 <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border px-3 sm:px-4 py-2 sm:py-2.5">
 <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
 {/* Left: Back + Form Title */}
 <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
 <Link
 to="/dashboard"
 className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-neutral-100 transition"
 title="Back to Dashboard"
 >
 <ArrowLeft className="w-5 h-5"/>
 </Link>

 <img src="/snowdevs.png" alt="Snow Devs Logo" className="w-7 h-7 object-contain hidden sm:block shrink-0" />

 <div className="flex-1 min-w-0">
 <input
 type="text"
 value={headerTitle}
 placeholder="Untitled Form"
 onFocus={() => {
 isHeaderFocusedRef.current = true;
 }}
 onBlur={() => {
 isHeaderFocusedRef.current = false;
 const plain = stripHtml(form?.title);
 setHeaderTitle(plain.trim().length === 0 ?"": plain);
 }}
 onChange={(e) => {
 const val = e.target.value;
 setHeaderTitle(val);
 handleUpdateForm({ title: val });
 }}
 className="w-full min-w-0 text-sm sm:text-lg font-bold bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-flamingo px-1 py-0.5 focus:outline-none transition truncate"
 />
 </div>

 {/* Save Status */}
 <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
 {saveStatus ==="saving"&& (
 <>
 <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"/>
 <span>Saving...</span>
 </>
 )}
 {saveStatus ==="saved"&& (
 <>
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500"/>
 <span>Saved</span>
 </>
 )}
 {saveStatus ==="unsaved"&& (
 <span className="text-amber-500">Unsaved changes</span>
 )}
 {saveStatus ==="error"&& (
 <div className="flex items-center gap-1.5 text-destructive">
 <AlertCircle className="w-3.5 h-3.5"/>
 <span>Couldn't save</span>
 <button
 onClick={() => triggerSave(form, sections, elements)}
 className="underline hover:opacity-80 font-medium ml-0.5"
 title="Retry saving changes"
 >
 Retry
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Right: Preview, Share, Status */}
 <div className="flex items-center gap-2">
 {/* Preview Action */}
 <button
 onClick={() => window.open(`/forms/${form.publicId}`,"_blank")}
 title="Preview Form"
 className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
 >
 <Eye className="w-4 h-4"/>
 </button>

 {form.status ==="draft"? (
 <>
 {/* Draft Status Badge */}
 <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
 Draft
 </span>

 {/* Draft Share Button (opens draft warning) */}
 <button
 onClick={() => setShowDraftShareWarningModal(true)}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg border border-border transition"
 title="Share options"
 >
 <Share2 className="w-3.5 h-3.5"/>
 <span>Share</span>
 </button>

 {/* Primary Publish Button */}
 <button
 onClick={handlePublish}
 disabled={publishing}
 className="inline-flex items-center gap-1 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold text-white bg-flamingo hover:bg-flamingo-600 rounded-lg shadow-sm shadow-flamingo/20 transition active:scale-95 disabled:opacity-50"
 >
 <Sparkles className="w-3.5 h-3.5"/>
 <span>{publishing ?"Publishing...":"Publish"}</span>
 </button>
 </>
 ) : (
 <>
 {/* Status Badge: Closed takes priority over Published */}
 {form.status ==="closed"|| form.formSettings?.acceptingResponses === false || form.isAcceptingResponses === false ? (
 <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>
 Closed
 </span>
 ) : (
 <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
 Published
 </span>
 )}

 {/* Share Button (opens real public share modal) */}
 <button
 onClick={() => setShowShareModal(true)}
 className="inline-flex items-center gap-1 px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs font-semibold text-white bg-flamingo hover:bg-flamingo-600 rounded-lg shadow-sm shadow-flamingo/20 transition active:scale-95"
 >
 <Share2 className="w-3.5 h-3.5"/>
 <span>Share</span>
 </button>

 {/* Unpublish option */}
 <button
 onClick={handleUnpublish}
 disabled={unpublishing}
 title="Revert to draft"
 className="p-1.5 text-xs text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition"
 >
 <RotateCcw className="w-3.5 h-3.5"/>
 </button>
 </>
 )}
 </div>
 </div>

 {/* 3 Main Tabs: Questions, Responses, Settings */}
 <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 mt-2 text-xs font-bold border-t border-border pt-1">
 <button
 onClick={() => setActiveTab("questions")}
 className={`py-2 px-3 border-b-2 transition ${
 activeTab ==="questions"
 ?"border-flamingo text-flamingo"
 :"border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 Questions
 </button>

 <button
 onClick={() => setActiveTab("responses")}
 className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
 activeTab ==="responses"
 ?"border-flamingo text-flamingo"
 :"border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 <span>Responses</span>
 <span className="px-1.5 py-0.2 bg-neutral-100 rounded-full text-[10px]">
 {form.responseCount || 0}
 </span>
 </button>

 <button
 onClick={() => setActiveTab("settings")}
 className={`py-2 px-3 border-b-2 transition ${
 activeTab ==="settings"
 ?"border-flamingo text-flamingo"
 :"border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 Settings
 </button>
 </div>
 </header>

 {/* Main Tab Views */}
 <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-28 sm:pb-12 relative">
 {activeTab ==="questions"&& (
 <div className="flex items-start gap-4">
 {/* Questions Canvas */}
 <div className="flex-1 min-w-0 space-y-4">
 {/* Form Header Banner (if configured in Settings) */}
 {form.themeSettings?.headerImage && (
 <div className="relative rounded-2xl overflow-hidden border border-neutral-200 shadow-sm mb-4">
 <img
 src={form.themeSettings.headerImage}
 alt="Form Header Banner"
 className="w-full max-h-48 object-cover rounded-2xl"
 />
 </div>
 )}

 {/* Form Title & Description Card */}
 <div
 onClick={() => {
 if (sections[0]) setActiveSectionId(sections[0].id);
 setActiveElementId(null);
 }}
 className="bg-white rounded-2xl border-t-8 border-t-flamingo border-x border-b border-neutral-200 p-6 shadow-sm cursor-default"
 >
 <div className="mb-3">
 <RichTextField
 value={form.title}
 onChange={(title) => handleUpdateForm({ title })}
 placeholder="Untitled Form"
 singleLine
 underlineColor="flamingo"
 className="text-2xl sm:text-3xl font-normal text-neutral-900"
 />
 </div>

 <div>
 <RichTextField
 value={form.description ||""}
 onChange={(description) => handleUpdateForm({ description })}
 placeholder={getFormDescriptionPlaceholder(form.title)}
 singleLine={false}
 underlineColor="neutral"
 className="text-sm font-normal text-neutral-600"
 />
 </div>
 </div>

 {/* Functional Drag-and-Drop Area for Content Blocks */}
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragStart={handleDragStart}
 onDragEnd={handleDragEnd}
 >
 <SortableContext
 items={elements.map((el) => el.id)}
 strategy={verticalListSortingStrategy}
 >
 {/* Sections Canvas */}
 {sections.map((section, secIdx) => {
 const sectionElements = elements.filter(
 (el) => el.sectionId === section.id || (!sections.some((s) => s.id === el.sectionId) && secIdx === 0)
 );
 const isSectionActive = activeSectionId === section.id;

 return (
 <div key={section.id} className="space-y-4">
 {/* Section Header Card (Section 1 is the main form; separate section cards only render for Section 2+) */}
 {secIdx > 0 && (
 <div
 onClick={() => {
 setActiveSectionId(section.id);
 setActiveElementId(null);
 }}
 className={`bg-white rounded-2xl border p-5 shadow-sm transition cursor-default ${
 isSectionActive
 ?"border-flamingo ring-2 ring-flamingo/20 shadow-md"
 :"border-neutral-200 hover:border-neutral-300"
 }`}
 >
 <div className="flex items-center justify-between gap-3 mb-2.5">
 <div className="flex items-center gap-2">
 <span className="px-3 py-1 rounded-full text-xs font-bold bg-flamingo/10 text-flamingo uppercase tracking-wider">
 Section {secIdx + 1} of {sections.length}
 </span>
 </div>

 <button
 onClick={(e) => {
 e.stopPropagation();
 if (confirm(`Delete Section ${secIdx + 1}? Its questions will be moved to the neighboring section.`)) {
 handleDeleteSection(section.id);
 }
 }}
 title="Delete section"
 className="p-1.5 text-neutral-400 hover:text-destructive rounded-lg hover:bg-destructive/10 transition"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>

 {/* Section Title Input */}
 <div className="mb-2">
 <RichTextField
 value={section.title ||""}
 onChange={(title) => handleUpdateSection(section.id, { title })}
 placeholder="Section title (optional)"
 singleLine
 underlineColor="flamingo"
 className="text-lg sm:text-xl font-normal text-neutral-900"
 />
 </div>

 {/* Section Description Textarea */}
 <div>
 <RichTextField
 value={section.description ||""}
 onChange={(description) => handleUpdateSection(section.id, { description })}
 placeholder="Description (optional)"
 singleLine={false}
 underlineColor="neutral"
 className="text-xs sm:text-sm font-normal text-neutral-600"
 />
 </div>
 </div>
 )}

 {/* Questions & Content Elements belonging to this section */}
 {sectionElements.map((el) => {
 const isQuestion = !["title_desc","image","video"].includes(el.type);

 return (
 <SortableBlockItem key={el.id} id={el.id}>
 {(dragHandleProps) =>
 isQuestion ? (
 <QuestionCard
 element={el}
 sections={sections}
 isQuiz={Boolean(form.isQuiz)}
 isActive={activeElementId === el.id}
 formId={form.id}
 onSelect={() => {
 setActiveElementId(el.id);
 setActiveSectionId(section.id);
 }}
 onChange={(updates: Partial<FormElement>) => handleUpdateElement(el.id, updates)}
 onDuplicate={() => handleDuplicateElement(el)}
 onDelete={() => handleDeleteElement(el.id)}
 dragHandleProps={dragHandleProps}
 />
 ) : (
 <ContentBlockCard
 element={el}
 isActive={activeElementId === el.id}
 formId={form.id}
 onSelect={() => {
 setActiveElementId(el.id);
 setActiveSectionId(section.id);
 }}
 onChange={(updates: Partial<FormElement>) => handleUpdateElement(el.id, updates)}
 onDuplicate={() => handleDuplicateElement(el)}
 onDelete={() => handleDeleteElement(el.id)}
 dragHandleProps={dragHandleProps}
 />
 )
 }
 </SortableBlockItem>
 );
 })}
 </div>
 );
 })}
 </SortableContext>

 {/* Floating Drag Overlay */}
 <DragOverlay>
 {activeDragId ? (
 <div className="bg-white rounded-2xl border-2 border-flamingo shadow-2xl p-5 ring-4 ring-flamingo/20 opacity-95 max-w-2xl cursor-grabbing">
 <div className="flex items-center gap-2 text-flamingo font-bold text-xs uppercase tracking-wider mb-1.5">
 <GripVertical className="w-4 h-4 rotate-90"/>
 <span>
 Moving:{""}
 {stripHtml(elements.find((e) => e.id === activeDragId)?.title) ||"Block"}
 </span>
 </div>
 <p className="text-xs text-muted-foreground capitalize">
 {elements.find((e) => e.id === activeDragId)?.type.replace("_","")}
 </p>
 </div>
 ) : null}
 </DragOverlay>
 </DndContext>
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

 {activeTab ==="responses"&& (
 <ResponsesTab
 form={form}
 onToggleResponses={handleToggleResponses}
 onStatusToggle={(status:"published"|"closed") => handleUpdateForm({ status })}
 />
 )}

 {activeTab ==="settings"&& (
 <SettingsTab form={form} onChange={handleUpdateForm} />
 )}
 </main>

 {/* 1. Publication Success Modal */}
 {showPublishSuccessModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
 <div className="bg-white rounded-2xl border border-neutral-200 max-w-lg w-full p-6 shadow-2xl space-y-5">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
 <CheckCircle2 className="w-7 h-7"/>
 </div>
 <div>
 <h3 className="text-xl font-extrabold text-neutral-900">
 Your form is published!
 </h3>
 <p className="text-xs text-muted-foreground mt-0.5">
 Anyone with this link can respond when your access settings permit it.
 </p>
 </div>
 </div>

 {/* Public Link Box */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-neutral-700">
 Public Respondent Link
 </label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 readOnly
 value={`${window.location.origin}/forms/${form.publicId}`}
 className="flex-1 px-3 py-2 text-xs bg-neutral-100 rounded-xl border border-neutral-200 font-mono text-neutral-800"
 />
 <button
 onClick={copyPublicLink}
 className="px-3.5 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl hover:bg-flamingo-600 transition flex items-center gap-1.5 flex-shrink-0"
 >
 {copiedLink ? <CheckCircle2 className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
 {copiedLink ?"Copied!":"Copy Link"}
 </button>
 </div>
 </div>

 {/* QR Code Container */}
 <div className="p-4 bg-white rounded-2xl border border-neutral-200 flex flex-col items-center justify-center">
 <div className="p-2 bg-white rounded-xl shadow-xs">
 <QRCodeSVG
 id="published-qr-code"
 value={`${window.location.origin}/forms/${form.publicId}`}
 size={150}
 level="H"
 includeMargin
 />
 </div>
 <div className="flex items-center gap-2 mt-3">
 <button
 onClick={() => downloadQrCode("published-qr-code")}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
 >
 <Download className="w-3.5 h-3.5"/>
 <span>Download QR Code (PNG)</span>
 </button>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex items-center justify-between pt-2 border-t border-border">
 <button
 onClick={() => window.open(`/forms/${form.publicId}`,"_blank")}
 className="inline-flex items-center gap-1.5 text-xs font-semibold text-flamingo hover:underline"
 >
 <ExternalLink className="w-3.5 h-3.5"/>
 <span>Open Public Form</span>
 </button>

 <button
 onClick={() => setShowPublishSuccessModal(false)}
 className="px-5 py-2 text-xs font-bold text-white bg-neutral-900 rounded-xl hover:opacity-90 transition"
 >
 Continue Editing
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 2. Draft Share Warning Modal */}
 {showDraftShareWarningModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
 <div className="bg-white rounded-2xl border border-neutral-200 max-w-md w-full p-6 shadow-2xl space-y-4">
 <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
 <AlertCircle className="w-6 h-6"/>
 </div>

 <div>
 <h3 className="text-lg font-bold text-neutral-900">
 Draft Form — Not Yet Published
 </h3>
 <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
 This form is currently an unpublished draft and is strictly private to you.
 Public respondents cannot view or submit answers to drafts.
 </p>
 </div>

 <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
 Publishing will make the public respondent link and QR code accessible to students and faculty.
 </div>

 <div className="flex items-center justify-end gap-2 pt-2">
 <button
 onClick={() => setShowDraftShareWarningModal(false)}
 className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition"
 >
 Keep as Draft
 </button>
 <button
 onClick={handlePublish}
 disabled={publishing}
 className="inline-flex items-center gap-1.5 px-4 py-2 bg-flamingo text-white text-xs font-bold rounded-xl hover:bg-flamingo-600 transition shadow-sm shadow-flamingo/20 disabled:opacity-50"
 >
 <Sparkles className="w-3.5 h-3.5"/>
 <span>{publishing ?"Publishing...":"Publish Form Now"}</span>
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 3. Published Form Share Modal */}
 {showShareModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
 <div className="bg-white rounded-2xl border border-neutral-200 max-w-md w-full p-6 shadow-2xl space-y-5">
 <div>
 <h3 className="text-lg font-bold text-neutral-900">
 Share"{stripHtml(form.title) ||"Untitled Form"}"
 </h3>
 <p className="text-xs text-muted-foreground mt-0.5">
 Distribute this public link or QR code to respondents across campus.
 </p>
 </div>

 <div className="p-4 bg-white rounded-xl border border-neutral-200 flex flex-col items-center justify-center">
 <div className="p-2 bg-white rounded-xl shadow-xs">
 <QRCodeSVG
 id="share-qr-code"
 value={`${window.location.origin}/forms/${form.publicId}`}
 size={150}
 level="H"
 includeMargin
 />
 </div>
 <button
 onClick={() => downloadQrCode("share-qr-code")}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
 >
 <Download className="w-3.5 h-3.5"/>
 <span>Download QR Code (PNG)</span>
 </button>
 </div>

 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-neutral-700">
 Public Form Link
 </label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 readOnly
 value={`${window.location.origin}/forms/${form.publicId}`}
 className="flex-1 px-3 py-2 text-xs bg-neutral-100 rounded-xl border border-neutral-200 font-mono text-neutral-800"
 />
 <button
 onClick={copyPublicLink}
 className="px-3.5 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl hover:bg-flamingo-600 transition flex items-center gap-1.5 flex-shrink-0"
 >
 {copiedLink ? <CheckCircle2 className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
 {copiedLink ?"Copied!":"Copy Link"}
 </button>
 </div>
 </div>

 <div className="flex items-center justify-between pt-2 border-t border-border">
 <button
 onClick={() => window.open(`/forms/${form.publicId}`,"_blank")}
 className="inline-flex items-center gap-1.5 text-xs font-semibold text-flamingo hover:underline"
 >
 <ExternalLink className="w-3.5 h-3.5"/>
 <span>Open Form</span>
 </button>

 <button
 onClick={() => setShowShareModal(false)}
 className="px-4 py-2 text-xs font-semibold text-neutral-700 rounded-xl hover:bg-neutral-100 transition"
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
