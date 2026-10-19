import React from "react";
import { FormElement } from "../../lib/api";
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
} from "lucide-react";

interface ContentBlockCardProps {
  element: FormElement;
  isActive: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<FormElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandleProps?: any;
}

export const ContentBlockCard: React.FC<ContentBlockCardProps> = ({
  element,
  isActive,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
  dragHandleProps,
}) => {
  let mediaMeta = { alignment: "center", caption: "" };
  try {
    if (element.mediaMeta) {
      mediaMeta = typeof element.mediaMeta === "string" ? JSON.parse(element.mediaMeta) : element.mediaMeta;
    }
  } catch {}

  // Extract YouTube ID if video block
  const getYouTubeId = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const ytId = element.type === "video" ? getYouTubeId(element.mediaUrl) : null;

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

      {/* Block Type Indicator */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
          {element.type === "title_desc" && <Heading className="w-3 h-3 text-flamingo" />}
          {element.type === "image" && <ImageIcon className="w-3 h-3 text-flamingo" />}
          {element.type === "video" && <Youtube className="w-3 h-3 text-red-500" />}
          {element.type === "title_desc" ? "Title & Description" : element.type === "image" ? "Image Block" : "Video Block"}
        </span>

        {/* Alignment buttons for media */}
        {["image", "video"].includes(element.type) && (
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({
                    mediaMeta: JSON.stringify({ ...mediaMeta, alignment: align }),
                  });
                }}
                className={`p-1 rounded ${
                  mediaMeta.alignment === align ? "bg-white dark:bg-neutral-700 shadow-xs text-flamingo" : "text-muted-foreground"
                }`}
              >
                {align === "left" && <AlignLeft className="w-3.5 h-3.5" />}
                {align === "center" && <AlignCenter className="w-3.5 h-3.5" />}
                {align === "right" && <AlignRight className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <input
        type="text"
        value={element.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder={element.type === "title_desc" ? "Section or informational heading" : "Block title / Caption"}
        className="w-full text-base sm:text-lg font-bold bg-transparent border-b-2 border-transparent focus:border-flamingo pb-1 focus:outline-none transition mb-2"
      />

      {/* Description */}
      <textarea
        rows={element.type === "title_desc" ? 3 : 1}
        value={element.description || ""}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Detailed description, notes, or instructions..."
        className="w-full text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 bg-transparent border-b border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 pb-1 focus:outline-none resize-none mb-3"
      />

      {/* Image Block: URL input & preview */}
      {element.type === "image" && (
        <div className="space-y-3">
          <input
            type="url"
            value={element.mediaUrl || ""}
            onChange={(e) => onChange({ mediaUrl: e.target.value })}
            placeholder="Paste public image URL (e.g. https://...)"
            className="w-full text-xs px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
          />
          {element.mediaUrl && (
            <div className={`flex justify-${mediaMeta.alignment === "left" ? "start" : mediaMeta.alignment === "right" ? "end" : "center"}`}>
              <img
                src={element.mediaUrl}
                alt={element.title || "Image block"}
                className="max-h-64 rounded-xl object-contain border"
                onError={(e) => ((e.target as HTMLElement).style.display = "none")}
              />
            </div>
          )}
        </div>
      )}

      {/* Video Block: YouTube URL input & embed */}
      {element.type === "video" && (
        <div className="space-y-3">
          <input
            type="url"
            value={element.mediaUrl || ""}
            onChange={(e) => onChange({ mediaUrl: e.target.value })}
            placeholder="Paste YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
            className="w-full text-xs px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border rounded-xl"
          />
          {ytId && (
            <div className={`flex justify-${mediaMeta.alignment === "left" ? "start" : mediaMeta.alignment === "right" ? "end" : "center"}`}>
              <div className="aspect-video w-full max-w-md rounded-xl overflow-hidden border shadow-sm">
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
            </div>
          )}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3 text-xs">
        <button
          onClick={onDuplicate}
          title="Duplicate block"
          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          title="Delete block"
          className="p-1.5 text-muted-foreground hover:text-destructive rounded transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
