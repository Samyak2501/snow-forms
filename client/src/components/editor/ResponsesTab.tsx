import React, { useState, useEffect } from "react";
import { api, FormItem } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import {
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Clock,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  List,
  Eye,
  FileSpreadsheet,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ResponsesTabProps {
  form: FormItem & { isQuiz: boolean };
  onStatusToggle: (status: "published" | "closed") => void;
}

const COLORS = ["#F16222", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#6B7280"];

export const ResponsesTab: React.FC<ResponsesTabProps> = ({ form, onStatusToggle }) => {
  const [subTab, setSubTab] = useState<"summary" | "individual">("summary");
  const [responses, setResponses] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Individual response browsing
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentDetail, setCurrentDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);

  const fetchResponses = async () => {
    try {
      const [respList, summary] = await Promise.all([
        api.analytics.getResponses(form.id),
        api.analytics.getSummary(form.id),
      ]);
      setResponses(respList.responses);
      setSummaryData(summary);
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResponses();
  }, [form.id]);

  // Load individual response detail when index changes
  useEffect(() => {
    if (subTab === "individual" && responses.length > 0) {
      const targetResp = responses[currentIndex];
      if (targetResp) {
        setDetailLoading(true);
        api.analytics
          .getResponseDetail(form.id, targetResp.id)
          .then((data) => setCurrentDetail(data))
          .catch((err) => console.error(err))
          .finally(() => setDetailLoading(false));
      }
    }
  }, [subTab, currentIndex, responses, form.id]);

  const handleGradeUpdate = async (elementId: string, score: number, feedback: string) => {
    if (!currentDetail?.response?.id) return;
    setSavingGrade(true);
    try {
      await api.analytics.gradeAnswer(form.id, currentDetail.response.id, {
        elementId,
        scoreAwarded: score,
        feedback,
      });
      // Refresh current detail
      const updated = await api.analytics.getResponseDetail(form.id, currentDetail.response.id);
      setCurrentDetail(updated);
    } catch (err) {
      alert("Failed to save grade");
    } finally {
      setSavingGrade(false);
    }
  };

  const handleDeleteResponse = async (responseId: string) => {
    if (!confirm("Are you sure you want to delete this response?")) return;
    try {
      await api.analytics.deleteResponse(form.id, responseId);
      await fetchResponses();
      if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
    } catch (err) {
      alert("Failed to delete response");
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading response analytics...</p>
      </div>
    );
  }

  const isAccepting = form.status === "published";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-3xl font-extrabold text-neutral-900 dark:text-white">
              {responses.length} {responses.length === 1 ? "response" : "responses"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Persisted in Avantika University Turso LibSQL Database
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* CSV Export Button */}
            <a
              href={api.analytics.getExportCsvUrl(form.id)}
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </a>

            {/* Accepting Responses Switch */}
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {isAccepting ? "Accepting responses" : "Not accepting responses"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAccepting}
                  onChange={(e) => onStatusToggle(e.target.checked ? "published" : "closed")}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-flamingo" />
              </label>
            </div>
          </div>
        </div>

        {/* Sub-tab navigation */}
        {responses.length > 0 && (
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
            <button
              onClick={() => setSubTab("summary")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                subTab === "summary"
                  ? "bg-flamingo/15 text-flamingo"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Summary Charts
            </button>
            <button
              onClick={() => setSubTab("individual")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                subTab === "individual"
                  ? "bg-flamingo/15 text-flamingo"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Individual Submissions
            </button>
          </div>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-border p-8">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-base text-neutral-900 dark:text-white">Waiting for responses</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Share the form's public link with respondents to begin collecting submissions.
          </p>
        </div>
      ) : subTab === "summary" ? (
        /* Summary Charts View */
        <div className="space-y-6">
          {/* Quiz Score Summary Card */}
          {form.isQuiz && summaryData?.quizSummary && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-purple-200 dark:border-purple-900/50 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                  Quiz Performance Overview
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl text-center border border-purple-100 dark:border-purple-900/30">
                  <div className="text-xs text-muted-foreground">Average Score</div>
                  <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-300 mt-1">
                    {summaryData.quizSummary.averageScore} / {summaryData.quizSummary.maxScore}
                  </div>
                </div>

                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl text-center border border-purple-100 dark:border-purple-900/30">
                  <div className="text-xs text-muted-foreground">Highest Score</div>
                  <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {Math.max(...(summaryData.quizSummary.scoreDistribution || [0]))} pts
                  </div>
                </div>

                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl text-center border border-purple-100 dark:border-purple-900/30">
                  <div className="text-xs text-muted-foreground">Total Graded</div>
                  <div className="text-2xl font-extrabold text-neutral-800 dark:text-neutral-200 mt-1">
                    {summaryData.quizSummary.totalGraded}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Question Analytics Cards */}
          {summaryData?.questions?.map((q: any) => (
            <div
              key={q.elementId}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                  {q.title || "Untitled Question"}
                </h4>
                <span className="text-xs text-muted-foreground font-medium">
                  {q.totalResponses} {q.totalResponses === 1 ? "response" : "responses"}
                </span>
              </div>

              {/* Pie Chart for Multiple Choice / Dropdown */}
              {["multiple_choice", "dropdown"].includes(q.type) && Array.isArray(q.data) && q.data.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={q.data}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          label={({ name, percentage }) => `${name} (${percentage}%)`}
                        >
                          {q.data.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {q.data.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-1.5 rounded bg-neutral-50 dark:bg-neutral-800/40">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="font-semibold">{item.count} ({item.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bar Chart for Checkboxes */}
              {q.type === "checkboxes" && Array.isArray(q.data) && q.data.length > 0 && (
                <div className="h-60 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.data} layout="vertical" margin={{ left: 30, right: 20 }}>
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#F16222" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Bar Chart for Linear Scale */}
              {q.type === "linear_scale" && Array.isArray(q.data) && q.data.length > 0 && (
                <div className="h-56 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.data}>
                      <XAxis dataKey="rating" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#F16222" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Text list for Short Answer & Paragraph */}
              {["short_answer", "paragraph", "date", "time"].includes(q.type) && Array.isArray(q.data) && (
                <div className="space-y-2 mt-2 max-h-56 overflow-y-auto pr-1">
                  {q.data.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No text responses yet.</div>
                  ) : (
                    q.data.map((txt: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-800 dark:text-neutral-200"
                      >
                        {txt}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Individual Response View */
        <div className="space-y-6">
          {/* Response Selector Bar */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-4 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => prev - 1)}
                className="p-1.5 rounded-lg border hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                {currentIndex + 1} of {responses.length}
              </span>
              <button
                disabled={currentIndex === responses.length - 1}
                onClick={() => setCurrentIndex((prev) => prev + 1)}
                className="p-1.5 rounded-lg border hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
              {currentDetail?.response?.respondentEmail && (
                <span className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
                  <Mail className="w-3.5 h-3.5 text-flamingo" />
                  {currentDetail.response.respondentEmail}
                </span>
              )}
              <span>{formatDate(responses[currentIndex]?.submittedAt)}</span>
              <button
                onClick={() => handleDeleteResponse(responses[currentIndex]?.id)}
                title="Delete this submission"
                className="p-1 text-destructive hover:bg-destructive/10 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Details list */}
          {detailLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading submission details...</div>
          ) : (
            currentDetail?.details?.map((item: any) => (
              <div
                key={item.elementId}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-border p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-neutral-900 dark:text-white">
                    {item.title}
                  </div>
                  {form.isQuiz && (
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="text-purple-600">
                        {item.scoreAwarded} / {item.points || 0} pts
                      </span>
                      {item.isCorrect === true && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {item.isCorrect === false && <XCircle className="w-4 h-4 text-rose-500" />}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 font-medium">
                  {Array.isArray(item.answer) ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.answer.map((a: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded-md">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    String(item.answer || "No response")
                  )}
                </div>

                {/* Manual Grading for Subjective / Paragraph Answers */}
                {form.isQuiz && item.type === "paragraph" && (
                  <div className="pt-2 border-t border-border flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground font-semibold">Manual Grade:</span>
                    <input
                      type="number"
                      min={0}
                      max={item.points || 10}
                      defaultValue={item.scoreAwarded || 0}
                      id={`grade-${item.elementId}`}
                      className="w-16 px-2 py-1 text-center border rounded bg-white dark:bg-neutral-800 font-bold"
                    />
                    <button
                      onClick={() => {
                        const inputEl = document.getElementById(`grade-${item.elementId}`) as HTMLInputElement;
                        const score = parseInt(inputEl?.value || "0", 10);
                        handleGradeUpdate(item.elementId, score, "");
                      }}
                      disabled={savingGrade}
                      className="px-3 py-1 bg-flamingo text-white font-semibold rounded-lg hover:bg-flamingo-600 transition"
                    >
                      Save Grade
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
