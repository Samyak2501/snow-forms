import React, { useState, useEffect } from"react";
import { api, FormItem } from"../../lib/api";
import { formatDate } from"../../lib/utils";
import { RichText } from"../RichText";
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
 Star,
  AlertTriangle,
} from"lucide-react";
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
} from"recharts";

interface ResponsesTabProps {
 form: FormItem & { isQuiz: boolean };
 onStatusToggle?: (status:"published"|"closed") => void;
 onToggleResponses?: (accepting: boolean) => Promise<void> | void;
}

const COLORS = ["#F16222","#3B82F6","#10B981","#8B5CF6","#F59E0B","#EC4899","#6B7280"];

export const ResponsesTab: React.FC<ResponsesTabProps> = ({ form, onStatusToggle, onToggleResponses }) => {
 const [subTab, setSubTab] = useState<"summary"|"individual">("summary");
 const [responses, setResponses] = useState<any[]>([]);
 const [summaryData, setSummaryData] = useState<any>(null);
 const [loading, setLoading] = useState(true);

 // Individual response browsing
 const [currentIndex, setCurrentIndex] = useState(0);
 const [responseNumberInput, setResponseNumberInput] = useState<string>("1");
 const [currentDetail, setCurrentDetail] = useState<any>(null);
 const [detailLoading, setDetailLoading] = useState(false);
 const [savingGrade, setSavingGrade] = useState(false);

 // Sync editable response number whenever currentIndex changes
 useEffect(() => {
 setResponseNumberInput(String(currentIndex + 1));
 }, [currentIndex]);

 const handleCommitResponseNumber = () => {
 const trimmed = responseNumberInput.trim();
 const parsed = parseInt(trimmed, 10);
 if (!isNaN(parsed) && parsed >= 1 && parsed <= responses.length) {
 setCurrentIndex(parsed - 1);
 } else {
 // Revert back to the current valid response number
 setResponseNumberInput(String(currentIndex + 1));
 }
 };

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
 if (subTab ==="individual"&& responses.length > 0) {
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
 <div className="w-8 h-8 border-3 border-flamingo border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
 <p className="text-sm text-muted-foreground">Loading response analytics...</p>
 </div>
 );
 }

 const isDraft = form.status ==="draft";
 const parsedSettings = typeof form.formSettings ==="string"
 ? JSON.parse(form.formSettings ||"{}")
 : (form.formSettings || {});
 const isAccepting = !isDraft && parsedSettings.acceptingResponses !== false;

 return (
 <div className="max-w-4xl mx-auto space-y-6 pb-16">
 {/* Top Header Card */}
 <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <div className="text-3xl font-extrabold text-neutral-900">
 {responses.length} {responses.length === 1 ?"response":"responses"}
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 Persisted in Snow Manage Database
 </div>
 </div>

 <div className="flex items-center gap-3">
 {/* CSV Export Button */}
 <a
 href={api.analytics.getExportCsvUrl(form.id)}
 download
 className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition shadow-xs"
 >
 <FileSpreadsheet className="w-4 h-4 text-emerald-600"/>
 <span>Export CSV</span>
 </a>

 {/* Accepting Responses Switch */}
 <div className="flex items-center gap-2 pl-3 border-l border-border">
 <span className="text-xs font-semibold text-neutral-700">
 {isDraft
 ?"Draft (Responses disabled)"
 : isAccepting
 ?"Accepting responses"
 :"Not accepting responses"}
 </span>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 disabled={isDraft}
 checked={isAccepting}
 onChange={(e) => {
 if (onToggleResponses) {
 onToggleResponses(e.target.checked);
 } else if (onStatusToggle) {
 onStatusToggle(e.target.checked ?"published":"closed");
 }
 }}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-flamingo peer-disabled:opacity-40"/>
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
 subTab ==="summary"
 ?"bg-flamingo/15 text-flamingo"
 :"text-muted-foreground hover:text-foreground"
 }`}
 >
 Summary Charts
 </button>
 <button
 onClick={() => setSubTab("individual")}
 className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
 subTab ==="individual"
 ?"bg-flamingo/15 text-flamingo"
 :"text-muted-foreground hover:text-foreground"
 }`}
 >
 Individual Submissions
 </button>
 </div>
 )}
 </div>

 {responses.length === 0 ? (
 <div className="py-16 text-center bg-white rounded-2xl border border-border p-8">
 <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40"/>
 <h3 className="font-bold text-base text-neutral-900">Waiting for responses</h3>
 <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
 Share the form's public link with respondents to begin collecting submissions.
 </p>
 </div>
 ) : subTab ==="summary"? (
 /* Summary Charts View */
 <div className="space-y-6">
 {/* Quiz Score Summary Card */}
 {form.isQuiz && summaryData?.quizSummary && (
 <div className="bg-white rounded-2xl border border-purple-200 p-6 shadow-sm">
 <div className="flex items-center gap-2 mb-4">
 <GraduationCap className="w-5 h-5 text-purple-600"/>
 <h3 className="font-bold text-base text-neutral-900">
 Quiz Performance Overview
 </h3>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="p-4 bg-purple-50/50 rounded-xl text-center border border-purple-100">
 <div className="text-xs text-muted-foreground">Average Score</div>
 <div className="text-2xl font-extrabold text-purple-700 mt-1">
 {summaryData.quizSummary.averageScore} / {summaryData.quizSummary.maxScore}
 </div>
 </div>

 <div className="p-4 bg-purple-50/50 rounded-xl text-center border border-purple-100">
 <div className="text-xs text-muted-foreground">Highest Score</div>
 <div className="text-2xl font-extrabold text-emerald-600 mt-1">
 {Math.max(...(summaryData.quizSummary.scoreDistribution || [0]))} pts
 </div>
 </div>

 <div className="p-4 bg-purple-50/50 rounded-xl text-center border border-purple-100">
 <div className="text-xs text-muted-foreground">Total Graded</div>
 <div className="text-2xl font-extrabold text-neutral-800 mt-1">
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
 className="bg-white rounded-2xl border border-border p-6 shadow-sm"
 >
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-sm text-neutral-900">
 <RichText content={q.title ||"Question"} />
 </h4>
 <span className="text-xs text-muted-foreground font-medium">
 {q.totalResponses} {q.totalResponses === 1 ?"response":"responses"}
 </span>
 </div>

 {/* Pie Chart for Multiple Choice / Dropdown */}
 {["multiple_choice","dropdown"].includes(q.type) && Array.isArray(q.data) && q.data.length > 0 && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
 <div className="h-56">
 <ResponsiveContainer width="100%"height="100%">
 <PieChart>
 <Pie
 data={q.data}
 dataKey="count"
 nameKey="name"
 cx="50%"
 cy="50%"
 outerRadius={75}
 label={({ name, percentage }) =>`${name} (${percentage}%)`}
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
 <div key={i} className="flex items-center justify-between p-1.5 rounded bg-neutral-50">
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
 {q.type ==="checkboxes"&& Array.isArray(q.data) && q.data.length > 0 && (
 <div className="h-60 mt-2">
 <ResponsiveContainer width="100%"height="100%">
 <BarChart data={q.data} layout="vertical"margin={{ left: 30, right: 20 }}>
 <XAxis type="number"/>
 <YAxis dataKey="name"type="category"width={100} tick={{ fontSize: 11 }} />
 <Tooltip />
 <Bar dataKey="count"fill="#F16222"radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}

 {/* Bar Chart for Linear Scale & Rating */}
 {["linear_scale","rating"].includes(q.type) && Array.isArray(q.data) && q.data.length > 0 && (
 <div className="space-y-2 mt-2">
 {q.type ==="rating"&& (() => {
 const totalVotes = q.data.reduce((sum: number, item: any) => sum + (Number(item.count) || 0), 0);
 const weightedSum = q.data.reduce((sum: number, item: any) => sum + (Number(item.rating) * Number(item.count) || 0), 0);
 const avg = totalVotes > 0 ? (weightedSum / totalVotes).toFixed(1) :"0";
 return (
 <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
 <span>Average Rating:</span>
 <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 font-bold">
 ★ {avg}
 </span>
 <span className="text-muted-foreground font-normal">({totalVotes} {totalVotes === 1 ?"response":"responses"})</span>
 </div>
 );
 })()}
 <div className="h-56">
 <ResponsiveContainer width="100%"height="100%">
 <BarChart data={q.data}>
 <XAxis dataKey="rating"/>
 <YAxis allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="count"fill="#F16222"radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}

 {/* Matrix Grid Summary Table */}
 {["mc_grid","checkbox_grid"].includes(q.type) && q.data && typeof q.data ==="object"&& !Array.isArray(q.data) && (
 <div className="overflow-x-auto mt-2">
 <table className="w-full text-xs">
 <thead>
 <tr className="border-b border-border text-muted-foreground">
 <th className="py-2 px-3 text-left font-semibold">Row</th>
 <th className="py-2 px-3 text-left font-semibold">Responses</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border/40">
 {Object.entries(q.data).map(([row, counts]: [string, any]) => (
 <tr key={row}>
 <td className="py-2.5 px-3 font-semibold text-neutral-800">{row}</td>
 <td className="py-2.5 px-3">
 <div className="flex flex-wrap gap-2">
 {Object.entries(counts || {}).map(([col, cnt]) => (
 <span key={col} className="px-2 py-1 bg-neutral-100 rounded-lg text-xs">
 <span className="font-medium text-neutral-800">{col}</span>: <span className="text-flamingo font-bold">{String(cnt)}</span>
 </span>
 ))}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Text list for Short Answer & Paragraph */}
 {["short_answer","paragraph","date","time"].includes(q.type) && Array.isArray(q.data) && (
 <div className="space-y-2 mt-2 max-h-56 overflow-y-auto pr-1">
 {q.data.length === 0 ? (
 <div className="text-xs text-muted-foreground italic">No text responses yet.</div>
 ) : (
 q.data.map((txt: string, idx: number) => (
 <div
 key={idx}
 className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-800"
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
 <div className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between text-xs font-semibold">
 <div className="flex items-center gap-2">
 <button
 disabled={currentIndex === 0}
 onClick={() => setCurrentIndex((prev) => prev - 1)}
 className="p-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
 title="Previous response"
 aria-label="Previous response"
 >
 <ChevronLeft className="w-4 h-4"/>
 </button>

 <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
 <input
 type="text"
 inputMode="numeric"
 pattern="[0-9]*"
 value={responseNumberInput}
 onFocus={(e) => e.target.select()}
 onChange={(e) => {
 const cleaned = e.target.value.replace(/\D/g, "");
 setResponseNumberInput(cleaned);
 }}
 onBlur={handleCommitResponseNumber}
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 handleCommitResponseNumber();
 e.currentTarget.blur();
 } else if (e.key === "Escape") {
 setResponseNumberInput(String(currentIndex + 1));
 e.currentTarget.blur();
 }
 }}
 className="min-w-[2.75rem] max-w-[4.5rem] h-8 px-2 text-center text-xs font-bold bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 focus:border-flamingo rounded-lg focus:outline-none focus:ring-2 focus:ring-flamingo/20 transition-all shadow-xs"
 title="Enter response number to jump directly"
 aria-label="Current response number"
 />
 <span className="text-muted-foreground font-normal">
 of {responses.length}
 </span>
 </div>

 <button
 disabled={currentIndex === responses.length - 1}
 onClick={() => setCurrentIndex((prev) => prev + 1)}
 className="p-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
 title="Next response"
 aria-label="Next response"
 >
 <ChevronRight className="w-4 h-4"/>
 </button>
 </div>

 <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-muted-foreground">
            {currentDetail?.response?.submissionTrigger === "tab_switch_limit" && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5" title="Auto-submitted due to exceeding allowed tab switches">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                Auto-submitted ({currentDetail.response.tabSwitchCount ?? 0} tab switch{(currentDetail.response.tabSwitchCount ?? 0) === 1 ? "" : "es"})
              </span>
            )}
 {currentDetail?.response?.respondentEmail && (
 <span className="flex items-center gap-1.5 text-neutral-800">
 <Mail className="w-3.5 h-3.5 text-flamingo"/>
 {currentDetail.response.respondentEmail}
 </span>
 )}
 <span>{formatDate(responses[currentIndex]?.submittedAt)}</span>
 <button
 onClick={() => handleDeleteResponse(responses[currentIndex]?.id)}
 title="Delete this submission"
 className="p-1 text-destructive hover:bg-destructive/10 rounded"
 >
 <Trash2 className="w-4 h-4"/>
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
 className="bg-white rounded-2xl border border-border p-5 space-y-3"
 >
 <div className="flex items-center justify-between">
 <div className="font-bold text-sm text-neutral-900">
 <RichText content={item.title ||"Question"} />
 </div>
 {form.isQuiz && (
 <div className="flex items-center gap-1.5 text-xs font-bold">
 <span className="text-purple-600">
 {item.scoreAwarded} / {item.points || 0} pts
 </span>
 {item.isCorrect === true && <CheckCircle2 className="w-4 h-4 text-emerald-500"/>}
 {item.isCorrect === false && <XCircle className="w-4 h-4 text-rose-500"/>}
 </div>
 )}
 </div>

 <div className="p-3 bg-neutral-50 rounded-xl text-xs text-neutral-900 font-medium">
 {item.type ==="rating"? (() => {
 const ratingVal = Number(item.answer);
 let maxStars = 5;
 if (item.scaleSettings) {
 try {
 const s = typeof item.scaleSettings ==="string"? JSON.parse(item.scaleSettings) : item.scaleSettings;
 if (s?.max) maxStars = s.max;
 } catch {}
 }
 if (!item.answer || isNaN(ratingVal)) {
 return <span className="text-muted-foreground italic">No response</span>;
 }
 return (
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-0.5">
 {Array.from({ length: maxStars }, (_, i) => i + 1).map((sNum) => (
 <Star
 key={sNum}
 className={`w-4 h-4 ${
 sNum <= ratingVal
 ?"text-amber-400 fill-amber-400"
 :"text-neutral-300 stroke-[1.5]"
 }`}
 />
 ))}
 </div>
 <span className="font-semibold text-neutral-800">
 {ratingVal} / {maxStars} stars
 </span>
 </div>
 );
 })() : ["mc_grid","checkbox_grid"].includes(item.type) ? (() => {
 let parsed: Record<string, any> = {};
 try {
 parsed = typeof item.answer ==="string"? JSON.parse(item.answer) : item.answer || {};
 } catch {
 parsed = {};
 }
 const entries = Object.entries(parsed);
 if (entries.length === 0) {
 return <span className="text-muted-foreground italic">No response</span>;
 }
 return (
 <div className="space-y-1.5 divide-y divide-border/40">
 {entries.map(([row, colVal]) => (
 <div key={row} className="flex items-center justify-between pt-1 first:pt-0">
 <span className="font-semibold text-neutral-700">{row}</span>
 <span className="text-flamingo font-medium">
 {Array.isArray(colVal) ? colVal.join(",") : String(colVal)}
 </span>
 </div>
 ))}
 </div>
 );
 })() : Array.isArray(item.answer) ? (
 <div className="flex flex-wrap gap-1.5">
 {item.answer.map((a: string, i: number) => (
 <span key={i} className="px-2 py-0.5 bg-neutral-200 rounded-md">
 {a}
 </span>
 ))}
 </div>
 ) : (
 String(item.answer ||"No response")
 )}
 </div>

 {/* Manual Grading for Subjective / Paragraph Answers */}
 {form.isQuiz && item.type ==="paragraph"&& (
 <div className="pt-2 border-t border-border flex items-center gap-3 text-xs">
 <span className="text-muted-foreground font-semibold">Manual Grade:</span>
 <input
 type="number"
 min={0}
 max={item.points || 10}
 defaultValue={item.scoreAwarded || 0}
 id={`grade-${item.elementId}`}
 className="w-16 px-2 py-1 text-center border rounded bg-white font-bold"
 />
 <button
 onClick={() => {
 const inputEl = document.getElementById(`grade-${item.elementId}`) as HTMLInputElement;
 const score = parseInt(inputEl?.value ||"0", 10);
 handleGradeUpdate(item.elementId, score,"");
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
