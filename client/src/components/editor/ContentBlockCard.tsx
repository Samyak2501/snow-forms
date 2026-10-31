import React, { useState, useRef } from"react";
import { FormElement, api } from"../../lib/api";
import { RichTextField } from"./RichTextField";
import { stripHtml } from"../../lib/sanitize";
import {
 GripVertical,
 Trash2,
 Copy,
 Heading,
 Image as ImageIcon,
 Youtube,
 AlignLeft,
 AlignCenter,
 AlignRight,
 Upload,
 Link2,
 Loader2,
 X,
 AlertCircle,
 Video,
 Calendar,
} from"lucide-react";

interface ContentBlockCardProps {
 element: FormElement;
 isActive: boolean;
 formId?: string;
 onSelect: () => void;
 onChange: (updated: Partial<FormElement>) => void;
 onDuplicate: () => void;
 onDelete: () => void;
 dragHandleProps?: any;
}

const getDescriptionPlaceholder = (title?: string) => {
 const t = stripHtml(title ||"").trim().toLowerCase();
 if (t ==="event date and time"|| t ==="event date & time"|| t ==="event date") {
 return"Add event details or select a date and time below";
 }
 if (t ==="event venue"|| t ==="venue") {
 return"Enter event venue details";
 }
 if (t ==="prizes") {
 return"Describe the prizes or awards";
 }
 if (t ==="organizer contact") {
 return"Add organizer contact information";
 }
 return"Description (optional)";
};

export const ContentBlockCard: React.FC<ContentBlockCardProps> = ({
 element,
 isActive,
 formId,
 onSelect,
 onChange,
 onDuplicate,
 onDelete,
 dragHandleProps,
}) => {
 const [mediaMode, setMediaMode] = useState<"upload"|"url">(
 element.mediaUrl ?"url":"upload"
 );
 const [uploadProgress, setUploadProgress] = useState<number | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadError, setUploadError] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement | null>(null);

 let parsedMeta: any = { alignment:"center", caption:""};
 try {
 if (element.mediaMeta) {
 parsedMeta =
 typeof element.mediaMeta ==="string"
 ? JSON.parse(element.mediaMeta)
 : element.mediaMeta;
 }
 } catch {}
 const mediaMeta = parsedMeta;
 const eventDateTime = parsedMeta?.eventDateTime ||"";

 const isEventDateBlock =
 element.type ==="title_desc"&&
 (stripHtml(element.title ||"").toLowerCase().includes("event date") ||
 Boolean(parsedMeta?.eventDateTime));

 const handleDateTimeChange = (newVal: string) => {
 const updated = { ...parsedMeta, eventDateTime: newVal };
 onChange({ mediaMeta: JSON.stringify(updated) });
 };

 const handleClearDateTime = (e: React.MouseEvent) => {
 e.stopPropagation();
 const updated = { ...parsedMeta, eventDateTime:""};
 onChange({ mediaMeta: JSON.stringify(updated) });
 };

 // Extract YouTube ID if video block
 const getYouTubeId = (url?: string) => {
 if (!url) return null;
 const match = url.match(
 /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
 );
 return match ? match[1] : null;
 };

 const isVideo = element.type ==="video";
 const isImage = element.type ==="image";
 const ytId = isVideo ? getYouTubeId(element.mediaUrl) : null;

 // Handle native device file upload
 const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setUploadError(null);

 // Frontend validation
 if (isImage) {
 const allowedImageTypes = [
"image/jpeg",
"image/png",
"image/webp",
"image/gif",
 ];
 if (!allowedImageTypes.includes(file.type)) {
 setUploadError("Please select a supported image (JPEG, PNG, WebP, GIF).");
 return;
 }
 if (file.size > 10 * 1024 * 1024) {
 setUploadError("Image file size exceeds the 10MB limit.");
 return;
 }
 } else if (isVideo) {
 const allowedVideoTypes = ["video/mp4","video/webm","video/quicktime"];
 if (!allowedVideoTypes.includes(file.type)) {
 setUploadError("Please select a supported video (MP4 or WebM).");
 return;
 }
 if (file.size > 50 * 1024 * 1024) {
 setUploadError("Video file size exceeds the 50MB limit.");
 return;
 }
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
 ...mediaMeta,
 originalFilename: res.originalFilename || file.name,
 provider: res.provider,
 bytes: res.bytes || file.size,
 }),
 });
 setUploadProgress(null);
 } catch (err: any) {
 console.error("Upload failed", err);
 setUploadError(err.message ||"Upload failed. Please try again.");
 } finally {
 setIsUploading(false);
 if (fileInputRef.current) {
 fileInputRef.current.value ="";
 }
 }
 };

 const handleRemoveMedia = () => {
 onChange({ mediaUrl:""});
 setUploadError(null);
 setUploadProgress(null);
 };

 return (
 <div
 onClick={onSelect}
 className={`relative bg-white rounded-2xl border transition-all ${
 isActive
 ?"border-flamingo shadow-md shadow-flamingo/10 ring-1 ring-flamingo"
 :"border-neutral-200 hover:border-neutral-300"
 } p-5 sm:p-6 mb-4`}
 >
 {/* Top Drag Handle */}
 <div
 {...dragHandleProps}
 className="flex items-center justify-center -mt-3 mb-2 cursor-grab active:cursor-grabbing text-neutral-400 hover:text-flamingo transition select-none touch-none"
 title="Drag to reorder block"
 aria-label="Drag to reorder block"
 >
 <GripVertical className="w-5 h-5 rotate-90"/>
 </div>

 {/* Block Type Indicator & Alignment Toolbar */}
 <div className="flex items-center justify-between mb-3">
 <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600">
 {element.type ==="title_desc"&& <Heading className="w-3 h-3 text-flamingo"/>}
 {element.type ==="image"&& <ImageIcon className="w-3 h-3 text-flamingo"/>}
 {element.type ==="video"&& <Youtube className="w-3 h-3 text-red-500"/>}
 {element.type ==="title_desc"
 ?"Title & Description"
 : element.type ==="image"
 ?"Image Block"
 :"Video Block"}
 </span>

 {/* Alignment buttons for media */}
 {(isImage || isVideo) && (
 <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg">
 {(["left","center","right"] as const).map((align) => (
 <button
 key={align}
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 onChange({
 mediaMeta: JSON.stringify({ ...mediaMeta, alignment: align }),
 });
 }}
 className={`p-1 rounded ${
 mediaMeta.alignment === align
 ?"bg-white shadow-xs text-flamingo"
 :"text-muted-foreground hover:text-foreground"
 }`}
 title={`Align ${align}`}
 >
 {align ==="left"&& <AlignLeft className="w-3.5 h-3.5"/>}
 {align ==="center"&& <AlignCenter className="w-3.5 h-3.5"/>}
 {align ==="right"&& <AlignRight className="w-3.5 h-3.5"/>}
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Title */}
 <div className="mb-2">
 <RichTextField
 value={element.title ||""}
 onChange={(title) => onChange({ title })}
 placeholder={
 element.type ==="image"
 ?"Image Title"
 : element.type ==="video"
 ?"Video Title"
 :"Title"
 }
 singleLine
 underlineColor="flamingo"
 className="text-base sm:text-lg font-normal text-neutral-900"
 />
 </div>

 {/* Description */}
 <div className="mb-3">
 <RichTextField
 value={element.description ||""}
 onChange={(description) => onChange({ description })}
 placeholder={getDescriptionPlaceholder(element.title)}
 singleLine={false}
 underlineColor="neutral"
 className="text-xs sm:text-sm font-normal text-neutral-600"
 />
 </div>

 {/* Optional Event Date and Time Selector (for Event Date and Time block) */}
 {isEventDateBlock && (
 <div className="mb-3 pt-3 border-t border-neutral-100">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
 <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
 <Calendar className="w-3.5 h-3.5 text-flamingo"/>
 Event Date & Time (Optional)
 </label>
 {eventDateTime && (
 <button
 type="button"
 onClick={handleClearDateTime}
 className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 self-start sm:self-auto transition"
 >
 <X className="w-3 h-3"/>
 Clear date & time
 </button>
 )}
 </div>
 <div className="flex items-center gap-2 max-w-xs sm:max-w-sm">
 <input
 type="datetime-local"
 value={eventDateTime}
 onChange={(e) => handleDateTimeChange(e.target.value)}
 className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-flamingo transition"
 />
 </div>
 <p className="text-[11px] text-muted-foreground mt-1.5">
 Optional: Pick an event date and time to display on the published registration form.
 </p>
 </div>
 )}

 {/* Media Configuration for Image and Video */}
 {(isImage || isVideo) && (
 <div className="space-y-3 pt-2">
 {/* Upload Error Banner */}
 {uploadError && (
 <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
 <AlertCircle className="w-4 h-4 flex-shrink-0"/>
 <span className="flex-1">{uploadError}</span>
 <button
 type="button"
 onClick={() => setUploadError(null)}
 className="text-destructive/70 hover:text-destructive"
 >
 <X className="w-3.5 h-3.5"/>
 </button>
 </div>
 )}

 {/* Mode Switcher (Upload from Device vs Use URL) */}
 {!element.mediaUrl && !isUploading && (
 <div className="flex items-center gap-2 border-b border-neutral-100 pb-2 text-xs">
 <button
 type="button"
 onClick={() => setMediaMode("upload")}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
 mediaMode ==="upload"
 ?"bg-flamingo text-white shadow-xs"
 :"text-muted-foreground hover:bg-neutral-100"
 }`}
 >
 <Upload className="w-3.5 h-3.5"/>
 <span>Upload from device</span>
 </button>
 <button
 type="button"
 onClick={() => setMediaMode("url")}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
 mediaMode ==="url"
 ?"bg-flamingo text-white shadow-xs"
 :"text-muted-foreground hover:bg-neutral-100"
 }`}
 >
 <Link2 className="w-3.5 h-3.5"/>
 <span>Use a URL</span>
 </button>
 </div>
 )}

 {/* Upload Progress Indicator */}
 {isUploading && (
 <div className="p-5 rounded-2xl border border-flamingo/20 bg-flamingo/5 text-center space-y-3 animate-in fade-in">
 <div className="flex items-center justify-center gap-2 text-flamingo font-semibold text-xs">
 <Loader2 className="w-4 h-4 animate-spin"/>
 <span>Uploading {isImage ?"image":"video"}... {uploadProgress !== null ?`${uploadProgress}%`:""}</span>
 </div>
 <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
 <div
 className="bg-flamingo h-full rounded-full transition-all duration-200 ease-out"
 style={{ width:`${uploadProgress ?? 15}%`}}
 />
 </div>
 <p className="text-[11px] text-muted-foreground">
 Optimizing and storing in persistent storage...
 </p>
 </div>
 )}

 {/* Empty Upload State: File Picker Dropzone */}
 {!element.mediaUrl && !isUploading && mediaMode ==="upload"&& (
 <div>
 <input
 ref={fileInputRef}
 type="file"
 className="hidden"
 accept={
 isImage
 ?"image/jpeg,image/png,image/webp,image/gif"
 :"video/mp4,video/webm,video/quicktime"
 }
 onChange={handleFileSelect}
 />
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="w-full border-2 border-dashed border-neutral-300 hover:border-flamingo rounded-2xl p-6 text-center transition group bg-neutral-50/50"
 >
 <div className="w-10 h-10 rounded-full bg-flamingo/10 text-flamingo flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition">
 {isImage ? <ImageIcon className="w-5 h-5"/> : <Video className="w-5 h-5"/>}
 </div>
 <div className="text-xs font-bold text-neutral-800 group-hover:text-flamingo transition">
 Click to choose {isImage ?"an image":"a video"} from your device
 </div>
 <div className="text-[11px] text-muted-foreground mt-1">
 {isImage
 ?"Supports JPEG, PNG, WebP, GIF (Max 10MB)"
 :"Supports MP4, WebM (Max 50MB)"}
 </div>
 </button>
 </div>
 )}

 {/* Empty URL Input State */}
 {!element.mediaUrl && !isUploading && mediaMode ==="url"&& (
 <div className="space-y-1.5">
 <input
 type="url"
 value={element.mediaUrl ||""}
 onChange={(e) => onChange({ mediaUrl: e.target.value })}
 placeholder={
 isImage
 ?"Paste public image URL (e.g. https://...)"
 :"Paste YouTube or video URL (e.g. https://www.youtube.com/watch?v=... or https://.../video.mp4)"
 }
 className="w-full text-xs px-3.5 py-2.5 bg-neutral-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-flamingo"
 />
 <p className="text-[11px] text-muted-foreground">
 {isImage
 ?"Enter any direct image link from the web"
 :"Supports YouTube watch links, youtu.be, or direct video files (.mp4, .webm)"}
 </p>
 </div>
 )}

 {/* Render Active Media Preview (with Replace / Remove controls) */}
 {element.mediaUrl && !isUploading && (
 <div className="space-y-2">
 <div
 className={`flex justify-${
 mediaMeta.alignment ==="left"
 ?"start"
 : mediaMeta.alignment ==="right"
 ?"end"
 :"center"
 }`}
 >
 {/* Image Preview */}
 {isImage && (
 <div className="relative group max-w-full">
 <img
 src={element.mediaUrl}
 alt={stripHtml(element.title) ||"Image block"}
 className="max-h-72 w-auto object-contain rounded-xl border border-neutral-200 shadow-sm"
 onError={(e) => {
 const target = e.target as HTMLElement;
 target.style.opacity ="0.5";
 }}
 />
 </div>
 )}

 {/* Video Preview (YouTube or Direct/Uploaded Video) */}
 {isVideo && (
 <div className="w-full max-w-xl">
 {ytId ? (
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
 ) : (
 <div className="w-full rounded-xl overflow-hidden border border-neutral-200 bg-black shadow-sm">
 <video
 controls
 src={element.mediaUrl}
 className="w-full max-h-80 object-contain mx-auto"
 preload="metadata"
 >
 Your browser does not support HTML5 video preview.
 </video>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Action Toolbar for Media: Replace & Remove */}
 <div className="flex items-center justify-between text-xs pt-1 px-1">
 <input
 ref={fileInputRef}
 type="file"
 className="hidden"
 accept={
 isImage
 ?"image/jpeg,image/png,image/webp,image/gif"
 :"video/mp4,video/webm,video/quicktime"
 }
 onChange={handleFileSelect}
 />
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
 >
 <Upload className="w-3 h-3"/>
 <span>Replace from device</span>
 </button>
 <button
 type="button"
 onClick={() => {
 const newUrl = prompt("Enter new media URL:", element.mediaUrl);
 if (newUrl !== null && newUrl.trim() !=="") {
 onChange({ mediaUrl: newUrl.trim() });
 }
 }}
 className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
 >
 <Link2 className="w-3 h-3"/>
 <span>Edit URL</span>
 </button>
 </div>

 <button
 type="button"
 onClick={handleRemoveMedia}
 className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline"
 >
 <X className="w-3.5 h-3.5"/>
 <span>Remove media</span>
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Bottom Actions */}
 <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 text-xs">
 {/* Duplicate and Delete */}
 <button
 type="button"
 onClick={onDuplicate}
 title="Duplicate block"
 className="p-1.5 text-muted-foreground hover:text-foreground rounded transition hover:bg-neutral-100"
 >
 <Copy className="w-4 h-4"/>
 </button>
 <button
 type="button"
 onClick={onDelete}
 title="Delete block"
 className="p-1.5 text-muted-foreground hover:text-destructive rounded transition hover:bg-destructive/10"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </div>
 );
};
