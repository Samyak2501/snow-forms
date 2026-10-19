import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, FormItem } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../lib/utils";
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
  Archive,
  QrCode,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
    archived: 0,
    totalResponses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeMenuFormId, setActiveMenuFormId] = useState<string | null>(null);

  // Modals
  const [shareModalForm, setShareModalForm] = useState<FormItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deleteModalForm, setDeleteModalForm] = useState<FormItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (searchParams.get("action") === "new") {
      handleCreateForm(false);
    }
  }, [searchParams]);

  const handleCreateForm = async (isQuiz = false, templateTitle = "Untitled Form") => {
    try {
      const res = await api.forms.create({
        title: templateTitle,
        isQuiz,
      });
      navigate(`/editor/${res.id}`);
    } catch (err: any) {
      alert("Failed to create form: " + err.message);
    }
  };

  const handleDuplicate = async (form: FormItem) => {
    try {
      const res = await api.forms.duplicate(form.id);
      setActiveMenuFormId(null);
      await fetchForms();
      navigate(`/editor/${res.id}`);
    } catch (err: any) {
      alert("Failed to duplicate form: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalForm) return;
    setDeleting(true);
    try {
      await api.forms.delete(deleteModalForm.id);
      setDeleteModalForm(null);
      await fetchForms();
    } catch (err: any) {
      alert("Failed to delete form: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleFormStatus = async (form: FormItem) => {
    const nextStatus = form.status === "published" ? "closed" : "published";
    try {
      await api.forms.update(form.id, { status: nextStatus });
      setActiveMenuFormId(null);
      await fetchForms();
    } catch (err: any) {
      alert("Failed to change form status: " + err.message);
    }
  };

  const copyPublicLink = (publicId: string) => {
    const url = `${window.location.origin}/forms/${publicId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-alabaster dark:bg-neutral-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome & Stats Row */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                Welcome back, {user?.name.split(" ")[0]}!
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Avantika University Form Management & Academic Surveys
              </p>
            </div>
            <button
              onClick={() => handleCreateForm(false)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-flamingo hover:bg-flamingo-600 text-white font-semibold rounded-xl shadow-md shadow-flamingo/25 active:scale-95 transition"
            >
              <Plus className="w-5 h-5" />
              Blank Form
            </button>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-6">
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="text-xs font-medium text-muted-foreground">Total Forms</div>
              <div className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">
                {summary.total}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Published</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {summary.published}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Drafts</div>
              <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {summary.draft}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Closed</div>
              <div className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
                {summary.closed}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="text-xs font-medium text-flamingo">Total Responses</div>
              <div className="text-2xl font-bold mt-1 text-flamingo">
                {summary.totalResponses}
              </div>
            </div>
          </div>
        </div>

        {/* Templates Banner */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-flamingo" />
            Start with a campus template
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => handleCreateForm(false, "Event Registration Form")}
              className="p-3 text-left rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-flamingo/10 text-flamingo flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-neutral-900 dark:text-white">Event Registration</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Symposiums & workshops</div>
            </button>

            <button
              onClick={() => handleCreateForm(true, "Academic Quiz")}
              className="p-3 text-left rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-neutral-900 dark:text-white">Graded Quiz</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Points & auto-scoring</div>
            </button>

            <button
              onClick={() => handleCreateForm(false, "Student Course Feedback")}
              className="p-3 text-left rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-neutral-900 dark:text-white">Course Feedback</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Ratings & text evaluations</div>
            </button>

            <button
              onClick={() => handleCreateForm(false, "Faculty Questionnaire")}
              className="p-3 text-left rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-flamingo/50 hover:bg-flamingo/5 transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-neutral-900 dark:text-white">General Survey</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Custom data collection</div>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-neutral-200/60 dark:bg-neutral-900 rounded-xl overflow-x-auto text-xs font-semibold">
            {["all", "published", "draft", "closed", "archived"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  statusFilter === st
                    ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm font-bold"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms by title..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-flamingo"
            />
          </div>
        </div>

        {/* Form List / Cards */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading forms from Turso...</p>
          </div>
        ) : forms.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
            <div className="w-14 h-14 bg-flamingo/10 text-flamingo rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">No forms found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || statusFilter !== "all"
                ? "Try clearing your search or status filter."
                : "Create your first Avantika University form to start collecting responses."}
            </p>
            <button
              onClick={() => handleCreateForm(false)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl hover:bg-flamingo-600 transition"
            >
              <Plus className="w-4 h-4" />
              Create First Form
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => {
              const statusColors: Record<string, string> = {
                published: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                draft: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                closed: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
                archived: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700",
              };

              return (
                <div
                  key={form.id}
                  className="group relative bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-flamingo/40 hover:shadow-lg hover:shadow-neutral-200/40 dark:hover:shadow-none transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Badges & Menu */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            statusColors[form.status] || statusColors.draft
                          }`}
                        >
                          {form.status}
                        </span>

                        {form.isQuiz && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" />
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
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuFormId === form.id && (
                          <div className="absolute right-0 top-8 z-30 w-44 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
                            <button
                              onClick={() => {
                                setShareModalForm(form);
                                setActiveMenuFormId(null);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                            >
                              <Share2 className="w-3.5 h-3.5 text-flamingo" />
                              Share / Link / QR
                            </button>

                            <button
                              onClick={() => {
                                window.open(`/forms/${form.publicId}`, "_blank");
                                setActiveMenuFormId(null);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Public Link
                            </button>

                            <button
                              onClick={() => handleDuplicate(form)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                              Duplicate Form
                            </button>

                            <button
                              onClick={() => toggleFormStatus(form)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {form.status === "published" ? "Close Form" : "Publish Form"}
                            </button>

                            <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

                            <button
                              onClick={() => {
                                setDeleteModalForm(form);
                                setActiveMenuFormId(null);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Form
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <Link to={`/editor/${form.id}`} className="block group-hover:text-flamingo transition">
                      <h2 className="font-bold text-base text-neutral-900 dark:text-white line-clamp-1">
                        {form.title}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[32px]">
                        {form.description || "No description provided."}
                      </p>
                    </Link>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 font-medium text-neutral-700 dark:text-neutral-300">
                      <BarChart3 className="w-3.5 h-3.5 text-flamingo" />
                      <span>{form.responseCount} responses</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span>{formatDate(form.updatedAt)}</span>
                      <Link
                        to={`/editor/${form.id}`}
                        className="p-1 text-flamingo hover:text-flamingo-700 rounded transition"
                        title="Edit Form"
                      >
                        <Eye className="w-4 h-4" />
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
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              Share "{shareModalForm.title}"
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Anyone with this published link can submit responses (subject to form settings).
            </p>

            {/* QR Code */}
            <div className="my-5 p-4 bg-white rounded-xl border border-neutral-200 flex flex-col items-center justify-center">
              <QRCodeSVG
                value={`${window.location.origin}/forms/${shareModalForm.publicId}`}
                size={160}
                level="M"
                includeMargin
              />
              <span className="text-[11px] text-neutral-500 mt-2">Scan to open on mobile</span>
            </div>

            {/* Link Box */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Public Form Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/forms/${shareModalForm.publicId}`}
                  className="flex-1 px-3 py-2 text-xs bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-mono"
                />
                <button
                  onClick={() => copyPublicLink(shareModalForm.publicId)}
                  className="px-3.5 py-2 bg-flamingo text-white text-xs font-semibold rounded-xl hover:bg-flamingo-600 transition flex items-center gap-1.5 flex-shrink-0"
                >
                  {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShareModalForm(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
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
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-sm w-full p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Delete this form?
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Are you sure you want to delete <strong>"{deleteModalForm.title}"</strong>? All associated questions, sections, and collected responses will be permanently removed.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                disabled={deleting}
                onClick={() => setDeleteModalForm(null)}
                className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-xl transition shadow-sm"
              >
                {deleting ? "Deleting..." : "Delete Form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
