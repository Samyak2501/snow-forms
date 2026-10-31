import React, { useState, useEffect } from"react";
import { Link, useNavigate, useSearchParams } from"react-router-dom";
import { api, FormItem } from"../lib/api";
import { useAuth } from"../context/AuthContext";
import { formatDate } from"../lib/utils";
import { stripHtml } from"../lib/sanitize";
import {
 Plus,
 Search,
 FileText,
 GraduationCap,
 Sparkles,
 BarChart3,
 Share2,
 Copy,
 ExternalLink,
 MoreVertical,
 Trash2,
 CopyPlus,
 Eye,
 CheckCircle2,
 Clock,
 Layers,
 QrCode,
 Calendar,
 AlertCircle,
 Download,
} from"lucide-react";
import { QRCodeSVG } from"qrcode.react";

export const DashboardPage: React.FC = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { user } = useAuth();

 const [forms, setForms] = useState<FormItem[]>([]);
 const [summary, setSummary] = useState({
 total: 0,
 published: 0,
 draft: 0,
 closed: 0,
 totalResponses: 0,
 });
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [activeMenuFormId, setActiveMenuFormId] = useState<string | null>(null);

 // Modals & Notifications
 const [publishingFormId, setPublishingFormId] = useState<string | null>(null);
 const [shareModalForm, setShareModalForm] = useState<FormItem | null>(null);
 const [copiedLink, setCopiedLink] = useState(false);
 const [deleteModalForm, setDeleteModalForm] = useState<FormItem | null>(null);
 const [deleting, setDeleting] = useState(false);
 const [toast, setToast] = useState<{ message: string; type:"success"|"error"} | null>(null);

 useEffect(() => {
 if (!toast) return;
 const timer = setTimeout(() => setToast(null), 3500);
 return () => clearTimeout(timer);
 }, [toast]);

 const fetchForms = async () => {
 try {
 const data = await api.forms.list({ status: statusFilter, search });
 setForms(data.forms);
 setSummary(data.summary);
 } catch (err) {
 console.error("Failed to load forms", err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchForms();
 }, [statusFilter, search]);

 // Handle ?action=new
 useEffect(() => {
 if (searchParams.get("action") ==="new") {
 handleCreateForm(false);
 }
 }, [searchParams]);

 const handleCreateForm = async (isQuiz = false, templateTitle ="Untitled Form", template?: string) => {
 try {
 const res = await api.forms.create({
 title: templateTitle,
 isQuiz,
 template,
 });
 navigate(`/editor/${res.id}`);
 } catch (err: any) {
 setToast({ message:"Failed to create form:"+ err.message, type:"error"});
 }
 };

 const handleDuplicate = async (form: FormItem) => {
 try {
 const res = await api.forms.duplicate(form.id);
 setActiveMenuFormId(null);
 await fetchForms();
 navigate(`/editor/${res.id}`);
 } catch (err: any) {
 setToast({ message:"Failed to duplicate form:"+ err.message, type:"error"});
 }
 };

 const handleDelete = async () => {
 if (!deleteModalForm) return;
 const formIdToDelete = deleteModalForm.id;
 const formTitleToDelete = deleteModalForm.title;
 const formStatus = deleteModalForm.status;

 setDeleting(true);
 try {
 await api.forms.delete(formIdToDelete);
 // Immediately remove from dashboard without requiring a full page reload
 setForms((prev) => prev.filter((f) => f.id !== formIdToDelete));
 setSummary((prev) => ({
 ...prev,
 total: Math.max(0, prev.total - 1),
 published: formStatus ==="published"? Math.max(0, prev.published - 1) : prev.published,
 draft: formStatus ==="draft"? Math.max(0, prev.draft - 1) : prev.draft,
 closed: formStatus ==="closed"? Math.max(0, prev.closed - 1) : prev.closed,
 }));
 setDeleteModalForm(null);
 setToast({
 message:`"${formTitleToDelete}"deleted successfully.`,
 type:"success",
 });
 } catch (err: any) {
 setToast({
 message:`Failed to delete form: ${err.message}`,
 type:"error",
 });
 } finally {
 setDeleting(false);
 }
 };

 const handlePublishFromDashboard = async (form: FormItem) => {
 setPublishingFormId(form.id);
 try {
 await api.forms.publish(form.id);
 setActiveMenuFormId(null);
 setToast({
 message:`"${stripHtml(form.title) ||"Untitled Form"}"published successfully! Public link is now live.`,
 type:"success",
 });
 await fetchForms();
 } catch (err: any) {
 setToast({
 message:`Failed to publish: ${err.message}`,
 type:"error",
 });
 } finally {
 setPublishingFormId(null);
 }
 };

 const handleToggleResponsesFromDashboard = async (form: FormItem) => {
 const isCurrentlyAccepting = form.isAcceptingResponses ?? (form.formSettings?.acceptingResponses !== false);
 try {
 const res = await api.forms.toggleResponses(form.id, !isCurrentlyAccepting);
 setActiveMenuFormId(null);
 // Immediately reflect response collection update in local state
 setForms((prev) =>
 prev.map((f) =>
 f.id === form.id
 ? {
 ...f,
 status: res.acceptingResponses ?"published":"closed",
 isAcceptingResponses: res.acceptingResponses,
 formSettings: {
 ...(f.formSettings || {}),
 acceptingResponses: res.acceptingResponses,
 },
 }
 : f
 )
 );
 setToast({
 message: res.acceptingResponses
 ?`"${stripHtml(form.title) ||"Untitled Form"}"is now accepting responses.`
 :`"${stripHtml(form.title) ||"Untitled Form"}"responses are now paused.`,
 type:"success",
 });
 await fetchForms();
 } catch (err: any) {
 setToast({
 message:`Failed to toggle responses: ${err.message}`,
 type:"error",
 });
 }
 };

 const downloadQrCode = (elementId ="dashboard-qr-svg", formTitle ="au-form") => {
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
 const sanitizedTitle = formTitle.replace(/[^a-z0-9]/gi,"_").toLowerCase();
 downloadLink.download =`${sanitizedTitle}_qr.png`;
 downloadLink.href = pngFile;
 downloadLink.click();
 }
 };
 img.src ="data:image/svg+xml;base64,"+ btoa(unescape(encodeURIComponent(svgData)));
 };

 const copyPublicLink = (publicId: string) => {
 const url =`${window.location.origin}/forms/${publicId}`;
 navigator.clipboard.writeText(url);
 setCopiedLink(true);
 setTimeout(() => setCopiedLink(false), 2000);
 };

 return (
 <div className="min-h-[calc(100vh-4rem)] bg-alabaster p-4 sm:p-6 lg:p-8">
 <div className="max-w-7xl mx-auto space-y-8">
 {/* Welcome & Stats Row */}
 <div>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
 Welcome back, {user?.name ? user.name.trim().split(/\s+/)[0] : ""}!
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Avantika University Form Management & Academic Surveys
 </p>
 </div>
 <button
 onClick={() => handleCreateForm(false)}
 className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-flamingo hover:bg-flamingo-600 text-white font-semibold rounded-xl shadow-md shadow-flamingo/25 active:scale-95 transition"
 >
 <Plus className="w-5 h-5"/>
 Blank Form
 </button>
 </div>

 {/* Metrics summary cards */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-6">
 <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-sm">
 <div className="text-xs font-medium text-muted-foreground">Total Forms</div>
 <div className="text-2xl font-bold mt-1 text-neutral-900">
 {summary.total}
 </div>
 </div>

 <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-sm">
 <div className="text-xs font-medium text-emerald-600">Published</div>
 <div className="text-2xl font-bold mt-1 text-emerald-600">
 {summary.published}
 </div>
 </div>

 <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-sm">
 <div className="text-xs font-medium text-amber-600">Drafts</div>
 <div className="text-2xl font-bold mt-1 text-amber-600">
 {summary.draft}
 </div>
 </div>

 <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-sm">
 <div className="text-xs font-medium text-rose-600">Closed</div>
 <div className="text-2xl font-bold mt-1 text-rose-600">
 {summary.closed}
 </div>
 </div>

 <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-white border border-neutral-200 shadow-sm">
 <div className="text-xs font-medium text-flamingo">Total Responses</div>
 <div className="text-2xl font-bold mt-1 text-flamingo">
 {summary.totalResponses}
 </div>
 </div>
 </div>
 </div>

 {/* Templates Banner */}
 <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
 <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
 <Sparkles className="w-4 h-4 text-flamingo"/>
 Start with a campus template
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <button
 onClick={() => handleCreateForm(false,"Event Registration","event_registration")}
 className="p-3 text-left rounded-xl border border-neutral-200 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
 >
 <div className="w-8 h-8 rounded-lg bg-flamingo/10 text-flamingo flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="currentColor"aria-hidden="true">
 <path fillRule="evenodd"d="M6 2a1 1 0 0 1 1 1v1h10V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1zm14 7H4v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9zM7 12a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-1zm5-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1zm3 1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1z"clipRule="evenodd"/>
 </svg>
 </div>
 <div className="text-xs font-bold text-neutral-900">Event Registration</div>
 <div className="text-[11px] text-muted-foreground mt-0.5">Symposiums & workshops</div>
 </button>

 <button
 onClick={() => handleCreateForm(true,"Graded Quiz","graded_quiz")}
 className="p-3 text-left rounded-xl border border-neutral-200 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
 >
 <div className="w-8 h-8 rounded-lg bg-flamingo/10 text-flamingo flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="currentColor"aria-hidden="true">
 <path d="M12 2 1 7l11 5 9-4.09V14h2V7L12 2z"/>
 <path d="M5 11.5v4c0 2.21 3.13 4 7 4s7-1.79 7-4v-4l-7 3.18-7-3.18z"/>
 </svg>
 </div>
 <div className="text-xs font-bold text-neutral-900">Graded Quiz</div>
 <div className="text-[11px] text-muted-foreground mt-0.5">Points & auto-scoring</div>
 </button>

 <button
 onClick={() => handleCreateForm(false,"Course Feedback","course_feedback")}
 className="p-3 text-left rounded-xl border border-neutral-200 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
 >
 <div className="w-8 h-8 rounded-lg bg-flamingo/10 text-flamingo flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="currentColor"aria-hidden="true">
 <rect x="3"y="11"width="4"height="9"rx="1"/>
 <rect x="10"y="4"width="4"height="16"rx="1"/>
 <rect x="17"y="8"width="4"height="12"rx="1"/>
 <rect x="1.5"y="20.5"width="21"height="2"rx="1"/>
 </svg>
 </div>
 <div className="text-xs font-bold text-neutral-900">Course Feedback</div>
 <div className="text-[11px] text-muted-foreground mt-0.5">Ratings & text evaluations</div>
 </button>

 <button
 onClick={() => handleCreateForm(false,"Faculty Questionnaire")}
 className="p-3 text-left rounded-xl border border-neutral-200 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
 >
 <div className="w-8 h-8 rounded-lg bg-flamingo/10 text-flamingo flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="currentColor"aria-hidden="true">
 <path fillRule="evenodd"d="M4 3a2 2 0 0 1 2-2h8.586a2 2 0 0 1 1.414.586l4.414 4.414A2 2 0 0 1 21 7.414V21a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3zm10 0v4a1 1 0 0 0 1 1h4l-5-5zM8 12a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1z"clipRule="evenodd"/>
 </svg>
 </div>
 <div className="text-xs font-bold text-neutral-900">General Survey</div>
 <div className="text-[11px] text-muted-foreground mt-0.5">Custom data collection</div>
 </button>
 </div>
 </div>

 {/* Search & Filters */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
 {/* Status Tabs */}
 <div className="flex items-center gap-1 p-1 bg-neutral-200/60 rounded-xl overflow-x-auto text-xs font-semibold">
 {["all","published","draft","closed"].map((st) => (
 <button
 key={st}
 onClick={() => setStatusFilter(st)}
 className={`px-3 py-1.5 rounded-lg capitalize transition ${
 statusFilter === st
 ?"bg-white text-neutral-900 shadow-sm font-bold"
 :"text-neutral-600 hover:text-neutral-900"
 }`}
 >
 {st}
 </button>
 ))}
 </div>

 {/* Search Box */}
 <div className="relative w-full sm:w-72">
 <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3"/>
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search forms by title..."
 className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-flamingo"
 />
 </div>
 </div>

 {/* Form List / Cards */}
 {loading ? (
 <div className="py-20 text-center">
 <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
 <p className="text-sm text-muted-foreground">Loading forms from Turso...</p>
 </div>
 ) : forms.length === 0 ? (
 <div className="py-16 text-center bg-white rounded-2xl border border-neutral-200 p-8">
 <div className="w-14 h-14 bg-flamingo/10 text-flamingo rounded-2xl flex items-center justify-center mx-auto mb-4">
 <FileText className="w-7 h-7"/>
 </div>
 <h3 className="text-lg font-bold text-neutral-900">No forms found</h3>
 <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
 {search || statusFilter !=="all"
 ?"Try clearing your search or status filter."
 :"Create your first Snow form to start collecting responses."}
 </p>
 <button
 onClick={() => handleCreateForm(false)}
 className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl hover:bg-flamingo-600 transition"
 >
 <Plus className="w-4 h-4"/>
 Create First Form
 </button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {forms.map((form) => {
 const isDraft = form.status ==="draft"|| form.isDraft;
 const isAccepting = form.isAcceptingResponses ?? (form.formSettings?.acceptingResponses !== false);
 const isExpired = Boolean(form.closesAt && new Date(form.closesAt) < new Date());
 // The closed state must take priority over the published state
 const isClosed = !isDraft && (form.status ==="closed"|| !isAccepting || isExpired);
 const isPublished = !isDraft && !isClosed && (form.status ==="published"|| form.isPublished);

 return (
 <div
 key={form.id}
 className="group relative bg-white rounded-2xl border border-neutral-200 hover:border-flamingo/40 hover:shadow-lg hover:shadow-neutral-200/40 transition-all p-5 flex flex-col justify-between"
 >
 <div>
 {/* Top Badges & Menu */}
 <div className="flex items-center justify-between gap-2 mb-3">
 <div className="flex items-center gap-1.5 flex-wrap">
 {/* Status Badge: Exactly ONE status badge is rendered */}
 {publishingFormId === form.id ? (
 <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-200 flex items-center gap-1.5">
 <div className="w-2.5 h-2.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"/>
 Publishing
 </span>
 ) : isDraft ? (
 <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-200">
 Draft
 </span>
 ) : isClosed ? (
 <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-600 border-rose-200 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>
 Closed
 </span>
 ) : isPublished ? (
 <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-200 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
 Published
 </span>
 ) : (
 <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-neutral-100 text-neutral-600 border-neutral-200">
 {form.status}
 </span>
 )}

 {form.isQuiz && (
 <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-200 flex items-center gap-1">
 <GraduationCap className="w-3 h-3"/>
 Quiz
 </span>
 )}
 </div>

 {/* Dropdown Menu Trigger */}
 <div className="relative">
 <button
 onClick={() =>
 setActiveMenuFormId(activeMenuFormId === form.id ? null : form.id)
 }
 className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-neutral-100 transition"
 >
 <MoreVertical className="w-4 h-4"/>
 </button>

 {/* Dropdown Menu */}
 {activeMenuFormId === form.id && (
 <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-xl shadow-xl border border-neutral-200 py-1 text-xs">
 {isDraft ? (
 <>
 <Link
 to={`/editor/${form.id}`}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <FileText className="w-3.5 h-3.5 text-flamingo"/>
 Continue Editing
 </Link>

 <button
 onClick={() => {
 window.open(`/forms/${form.publicId}`,"_blank");
 setActiveMenuFormId(null);
 }}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <Eye className="w-3.5 h-3.5"/>
 Owner Preview
 </button>

 <button
 onClick={() => handlePublishFromDashboard(form)}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-emerald-600 font-semibold"
 >
 <Sparkles className="w-3.5 h-3.5"/>
 Publish Form
 </button>

 <button
 onClick={() => handleDuplicate(form)}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <CopyPlus className="w-3.5 h-3.5"/>
 Duplicate Form
 </button>

 <div className="my-1 border-t border-neutral-100"/>

 <button
 onClick={() => {
 setDeleteModalForm(form);
 setActiveMenuFormId(null);
 }}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive font-medium"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 Delete Draft
 </button>
 </>
 ) : (
 <>
 <Link
 to={`/editor/${form.id}`}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <FileText className="w-3.5 h-3.5 text-flamingo"/>
 Edit Form
 </Link>

 <button
 onClick={() => {
 setShareModalForm(form);
 setActiveMenuFormId(null);
 }}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <Share2 className="w-3.5 h-3.5 text-flamingo"/>
 Share / Link / QR
 </button>

 <button
 onClick={() => {
 window.open(`/forms/${form.publicId}`,"_blank");
 setActiveMenuFormId(null);
 }}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <ExternalLink className="w-3.5 h-3.5"/>
 Open Public Form
 </button>

 <button
 onClick={() => handleToggleResponsesFromDashboard(form)}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <Clock className="w-3.5 h-3.5"/>
 {isAccepting ?"Pause Responses":"Resume Responses"}
 </button>

 <button
 onClick={() => handleDuplicate(form)}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 text-neutral-800"
 >
 <CopyPlus className="w-3.5 h-3.5"/>
 Duplicate Form
 </button>

 <div className="my-1 border-t border-neutral-100"/>

 <button
 onClick={() => {
 setDeleteModalForm(form);
 setActiveMenuFormId(null);
 }}
 className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive font-medium"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 Delete Form
 </button>
 </>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Title & Description */}
 <Link to={`/editor/${form.id}`} className="block group-hover:text-flamingo transition">
 <h2 className="font-bold text-base text-neutral-900 line-clamp-1">
 {stripHtml(form.title) ||"Untitled Form"}
 </h2>
 <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[32px]">
 {stripHtml(form.description) ||"No description provided."}
 </p>
 </Link>
 </div>

 {/* Card Footer */}
 <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-muted-foreground">
 {isDraft ? (
 <div className="text-[11px] font-semibold text-amber-600">
 Private Draft
 </div>
 ) : (
 <div className="flex items-center gap-1 font-medium text-neutral-700">
 <BarChart3 className="w-3.5 h-3.5 text-flamingo"/>
 <span>{form.responseCount} responses</span>
 </div>
 )}

 <div className="flex items-center gap-2">
 <span>{formatDate(form.updatedAt)}</span>
 {isDraft ? (
 <button
 onClick={() => handlePublishFromDashboard(form)}
 className="px-2 py-0.5 text-[11px] font-bold bg-flamingo/10 text-flamingo hover:bg-flamingo hover:text-white rounded-md transition"
 >
 Publish
 </button>
 ) : (
 <button
 onClick={() => setShareModalForm(form)}
 className="p-1 text-neutral-400 hover:text-flamingo rounded transition"
 title="Share Link & QR"
 >
 <Share2 className="w-3.5 h-3.5"/>
 </button>
 )}
 <Link
 to={`/editor/${form.id}`}
 className="p-1 text-flamingo hover:text-flamingo-700 rounded transition"
 title={isDraft ?"Continue Editing":"Edit Form"}
 >
 <Eye className="w-4 h-4"/>
 </Link>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Share & QR Code Modal */}
 {shareModalForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
 <div className="bg-white rounded-2xl border border-neutral-200 max-w-md w-full p-6 shadow-2xl">
 <h3 className="text-lg font-bold text-neutral-900">
 Share"{stripHtml(shareModalForm.title) ||"Untitled Form"}"
 </h3>
 <p className="text-xs text-muted-foreground mt-1">
 Anyone with this published link can submit responses (subject to form settings).
 </p>

 {/* QR Code */}
 <div className="my-5 p-4 bg-white rounded-xl border border-neutral-200 flex flex-col items-center justify-center">
 <div className="p-2 bg-white rounded-xl shadow-xs">
 <QRCodeSVG
 id="dashboard-qr-svg"
 value={`${window.location.origin}/forms/${shareModalForm.publicId}`}
 size={150}
 level="H"
 includeMargin
 />
 </div>
 <button
 onClick={() => downloadQrCode("dashboard-qr-svg", stripHtml(shareModalForm.title) ||"form-qr")}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
 >
 <Download className="w-3.5 h-3.5"/>
 <span>Download QR Code (PNG)</span>
 </button>
 </div>

 {/* Link Box */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-neutral-700">
 Public Form Link
 </label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 readOnly
 value={`${window.location.origin}/forms/${shareModalForm.publicId}`}
 className="flex-1 px-3 py-2 text-xs bg-neutral-100 rounded-xl border border-neutral-200 font-mono text-neutral-800"
 />
 <button
 onClick={() => copyPublicLink(shareModalForm.publicId)}
 className="px-3.5 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl hover:bg-flamingo-600 transition flex items-center gap-1.5 flex-shrink-0"
 >
 {copiedLink ? <CheckCircle2 className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
 {copiedLink ?"Copied!":"Copy"}
 </button>
 </div>
 </div>

 <div className="mt-6 flex items-center justify-between pt-2 border-t border-border">
 <button
 onClick={() => window.open(`/forms/${shareModalForm.publicId}`,"_blank")}
 className="inline-flex items-center gap-1.5 text-xs font-semibold text-flamingo hover:underline"
 >
 <ExternalLink className="w-3.5 h-3.5"/>
 <span>Open Form</span>
 </button>

 <button
 onClick={() => setShareModalForm(null)}
 className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Delete Confirmation Modal */}
 {deleteModalForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
 <div className="bg-white rounded-2xl border border-neutral-200 max-w-sm w-full p-6 shadow-2xl">
 <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
 <AlertCircle className="w-5 h-5"/>
 </div>
 <h3 className="text-base font-bold text-neutral-900">
 Delete this form?
 </h3>
 <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
 Are you sure you want to delete <strong>"{stripHtml(deleteModalForm.title) ||"Untitled Form"}"</strong>? All associated questions, sections, and collected responses will be permanently removed.
 </p>

 <div className="mt-6 flex items-center justify-end gap-2.5">
 <button
 disabled={deleting}
 onClick={() => setDeleteModalForm(null)}
 className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition"
 >
 Cancel
 </button>
 <button
 disabled={deleting}
 onClick={handleDelete}
 className="px-4 py-2 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-xl transition shadow-sm"
 >
 {deleting ?"Deleting...":"Delete Form"}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Toast Notification */}
 {toast && (
 <div
 role="status"
 aria-live="polite"
 className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border bg-white border-neutral-200 animate-in slide-in-from-bottom-4"
 >
 {toast.type ==="success"? (
 <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
 <CheckCircle2 className="w-4 h-4"/>
 </div>
 ) : (
 <div className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0">
 <AlertCircle className="w-4 h-4"/>
 </div>
 )}
 <span className="text-xs font-semibold text-neutral-900 max-w-sm">
 {toast.message}
 </span>
 <button
 onClick={() => setToast(null)}
 className="ml-2 text-neutral-400 hover:text-neutral-700 text-sm font-bold leading-none p-1"
 >
 &times;
 </button>
 </div>
 )}
 </div>
 );
};
