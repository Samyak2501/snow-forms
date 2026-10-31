import React, { useRef, useState, useEffect, useCallback } from"react";
import {
 Bold,
 Italic,
 Underline,
 Link as LinkIcon,
 Unlink,
 RotateCcw,
 Check,
 X,
} from"lucide-react";
import { sanitizeRichText, stripHtml } from"../../lib/sanitize";

interface RichTextFieldProps {
 value: string;
 onChange: (val: string) => void;
 placeholder?: string;
 className?: string;
 singleLine?: boolean;
 minHeight?: string;
 underlineColor?:"flamingo"|"neutral"|"none";
}

export const RichTextField: React.FC<RichTextFieldProps> = ({
 value,
 onChange,
 placeholder ="",
 className ="",
 singleLine = false,
 minHeight,
 underlineColor ="flamingo",
}) => {
 const editorRef = useRef<HTMLDivElement>(null);
 const containerRef = useRef<HTMLDivElement>(null);
 const [isFocused, setIsFocused] = useState(false);
 const [activeFormats, setActiveFormats] = useState({
 bold: false,
 italic: false,
 underline: false,
 isLink: false,
 });

 // Link Dialog State
 const [showLinkDialog, setShowLinkDialog] = useState(false);
 const [linkUrl, setLinkUrl] = useState("");
 const [linkText, setLinkText] = useState("");
 const [linkError, setLinkError] = useState<string | null>(null);
 const savedRangeRef = useRef<Range | null>(null);

 // Sync incoming value to contentEditable when not currently focused by user
 useEffect(() => {
 if (!editorRef.current) return;
 const currentHtml = editorRef.current.innerHTML;
 const incoming = value ||"";

 // Only update if fundamentally different to preserve user's cursor position during typing
 if (currentHtml !== incoming && document.activeElement !== editorRef.current) {
 editorRef.current.innerHTML = incoming;
 }
 }, [value]);

 // Update active formatting states based on current selection
 const updateActiveFormats = useCallback(() => {
 if (!isFocused || typeof document ==="undefined") return;

 try {
 const selection = window.getSelection();
 if (!selection || selection.rangeCount === 0) {
 setActiveFormats({ bold: false, italic: false, underline: false, isLink: false });
 return;
 }

 const anchorNode = selection.anchorNode;
 if (!editorRef.current || !editorRef.current.contains(anchorNode)) {
 setActiveFormats({ bold: false, italic: false, underline: false, isLink: false });
 return;
 }

 const bold = document.queryCommandState("bold");
 const italic = document.queryCommandState("italic");
 const underline = document.queryCommandState("underline");

 let isLink = false;
 let node: Node | null = anchorNode;
 while (node && node !== editorRef.current) {
 if (node.nodeName ==="A") {
 isLink = true;
 break;
 }
 node = node.parentNode;
 }

 setActiveFormats({ bold, italic, underline, isLink });
 } catch {
 setActiveFormats({ bold: false, italic: false, underline: false, isLink: false });
 }
 }, [isFocused]);

 useEffect(() => {
 const handleSelectionChange = () => {
 if (isFocused) {
 updateActiveFormats();
 }
 };
 document.addEventListener("selectionchange", handleSelectionChange);
 return () => document.removeEventListener("selectionchange", handleSelectionChange);
 }, [isFocused, updateActiveFormats]);

 // Emit changes to parent
 const handleInput = () => {
 if (!editorRef.current) return;
 const rawHtml = editorRef.current.innerHTML;
 const plainText = editorRef.current.innerText ||"";

 // If completely empty or only contains browser break tags
 if (!plainText.trim() && !rawHtml.includes("<img")) {
 onChange("");
 return;
 }

 const cleaned = sanitizeRichText(rawHtml);
 onChange(cleaned);
 updateActiveFormats();
 };

 // Keyboard shortcuts (Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+U) and single-line enforcement
 const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
 if (singleLine && e.key ==="Enter") {
 e.preventDefault();
 return;
 }

 if (e.ctrlKey || e.metaKey) {
 const key = e.key.toLowerCase();
 if (key ==="b") {
 e.preventDefault();
 applyFormat("bold");
 } else if (key ==="i") {
 e.preventDefault();
 applyFormat("italic");
 } else if (key ==="u") {
 e.preventDefault();
 applyFormat("underline");
 } else if (key ==="k") {
 e.preventDefault();
 openLinkDialog();
 }
 }
 };

 // Apply format while preserving selection
 const applyFormat = (command: string, arg?: string) => {
 if (!editorRef.current) return;
 editorRef.current.focus();
 document.execCommand(command, false, arg);
 handleInput();
 updateActiveFormats();
 };

 // Remove all formatting from selection
 const handleRemoveFormat = (e: React.MouseEvent) => {
 e.preventDefault();
 if (!editorRef.current) return;
 editorRef.current.focus();
 document.execCommand("removeFormat", false);
 document.execCommand("unlink", false);
 handleInput();
 updateActiveFormats();
 };

 // Link dialog handling
 const openLinkDialog = (e?: React.MouseEvent) => {
 if (e) e.preventDefault();
 if (!editorRef.current) return;

 const selection = window.getSelection();
 if (selection && selection.rangeCount > 0) {
 const range = selection.getRangeAt(0);
 savedRangeRef.current = range.cloneRange();

 let selectedText = range.toString();
 let existingHref ="";

 // Check if cursor is on an existing link
 let node: Node | null = selection.anchorNode;
 while (node && node !== editorRef.current) {
 if (node.nodeName ==="A") {
 const a = node as HTMLAnchorElement;
 existingHref = a.getAttribute("href") ||"";
 selectedText = a.textContent || selectedText;
 break;
 }
 node = node.parentNode;
 }

 setLinkText(selectedText);
 setLinkUrl(existingHref);
 setLinkError(null);
 setShowLinkDialog(true);
 }
 };

 const applyLink = (e: React.FormEvent) => {
 e.preventDefault();
 setLinkError(null);

 let cleanUrl = linkUrl.trim();
 if (!cleanUrl) {
 setLinkError("Please enter a valid URL.");
 return;
 }

 // Disallow dangerous schemes
 if (
 cleanUrl.toLowerCase().startsWith("javascript:") ||
 cleanUrl.toLowerCase().startsWith("data:") ||
 cleanUrl.toLowerCase().startsWith("vbscript:")
 ) {
 setLinkError("Unsafe link protocol is not permitted.");
 return;
 }

 // Prepend https:// if protocol is omitted
 if (!/^https?:\/\//i.test(cleanUrl) && !cleanUrl.startsWith("/") && !cleanUrl.startsWith("mailto:")) {
 cleanUrl =`https://${cleanUrl}`;
 }

 if (!editorRef.current) return;
 editorRef.current.focus();

 // Restore selection
 if (savedRangeRef.current) {
 const selection = window.getSelection();
 if (selection) {
 selection.removeAllRanges();
 selection.addRange(savedRangeRef.current);
 }
 }

 // If display text was provided and differs from selection, insert custom link HTML
 if (linkText.trim()) {
 const safeText = stripHtml(linkText.trim());
 const safeLinkHtml =`<a href="${cleanUrl}"target="_blank"rel="noopener noreferrer">${safeText}</a>`;
 document.execCommand("insertHTML", false, safeLinkHtml);
 } else {
 document.execCommand("createLink", false, cleanUrl);
 }

 handleInput();
 setShowLinkDialog(false);
 };

 const removeCurrentLink = (e: React.MouseEvent) => {
 e.preventDefault();
 if (!editorRef.current) return;
 editorRef.current.focus();

 if (savedRangeRef.current) {
 const selection = window.getSelection();
 if (selection) {
 selection.removeAllRanges();
 selection.addRange(savedRangeRef.current);
 }
 }

 document.execCommand("unlink", false);
 handleInput();
 setShowLinkDialog(false);
 };

 const isEmpty = !value || !stripHtml(value).trim();

 return (
 <div ref={containerRef} className="relative w-full group/rich">
 {/* Visual Placeholder when content is empty */}
 {isEmpty && (
 <div
 onClick={() => editorRef.current?.focus()}
 className="absolute inset-0 pointer-events-none select-none text-muted-foreground/60 transition-opacity truncate cursor-text"
 >
 {placeholder}
 </div>
 )}

 {/* 1. ContentEditable Editor Box */}
 <div
 ref={editorRef}
 contentEditable
 suppressContentEditableWarning
 onFocus={() => {
 setIsFocused(true);
 requestAnimationFrame(() => updateActiveFormats());
 }}
 onBlur={(e) => {
 // If blurring into the toolbar or link dialog within container, remain open
 if (containerRef.current?.contains(e.relatedTarget as Node)) {
 return;
 }
 // Delay closing so button clicks succeed
 setTimeout(() => {
 if (!containerRef.current?.contains(document.activeElement)) {
 setIsFocused(false);
 setShowLinkDialog(false);
 setActiveFormats({ bold: false, italic: false, underline: false, isLink: false });
 }
 }, 150);
 }}
 onInput={handleInput}
 onKeyDown={handleKeyDown}
 onKeyUp={updateActiveFormats}
 onMouseUp={updateActiveFormats}
 style={{ minHeight }}
 className={`w-full outline-none bg-transparent cursor-text font-normal transition ${
 singleLine ?"overflow-hidden whitespace-normal":"whitespace-pre-wrap"
 } ${className}`}
 />

 {/* 2. Active Underline: immediately below the editable text field */}
 {underlineColor !=="none"&& (
 <div
 className={`w-full transition-colors duration-150 mt-1 ${
 underlineColor ==="flamingo"
 ? isFocused
 ?"border-b-2 border-flamingo"
 :"border-b-2 border-transparent"
 : isFocused
 ?"border-b border-neutral-400"
 :"border-b border-transparent"
 }`}
 />
 )}

 {/* 3. Google Forms-Style Contextual Formatting Toolbar: immediately BELOW the underline */}
 {isFocused && (
 <div
 onMouseDown={(e) => e.preventDefault()}
 className="relative mt-2 flex items-center gap-0.5 p-1 bg-white border border-neutral-200 rounded-xl shadow-md z-30 w-fit select-none animate-in fade-in slide-in-from-top-1 duration-150"
 >
 {/* Bold */}
 <button
 type="button"
 onMouseDown={(e) => {
 e.preventDefault();
 applyFormat("bold");
 }}
 title="Bold (Ctrl+B)"
 aria-label="Bold"
 className={`p-1.5 rounded-lg transition text-xs flex items-center justify-center ${
 activeFormats.bold
 ?"bg-flamingo/15 text-flamingo font-black"
 :"text-neutral-600 hover:bg-neutral-100"
 }`}
 >
 <Bold className="w-3.5 h-3.5"/>
 </button>

 {/* Italic */}
 <button
 type="button"
 onMouseDown={(e) => {
 e.preventDefault();
 applyFormat("italic");
 }}
 title="Italic (Ctrl+I)"
 aria-label="Italic"
 className={`p-1.5 rounded-lg transition text-xs flex items-center justify-center ${
 activeFormats.italic
 ?"bg-flamingo/15 text-flamingo font-black"
 :"text-neutral-600 hover:bg-neutral-100"
 }`}
 >
 <Italic className="w-3.5 h-3.5"/>
 </button>

 {/* Underline */}
 <button
 type="button"
 onMouseDown={(e) => {
 e.preventDefault();
 applyFormat("underline");
 }}
 title="Underline (Ctrl+U)"
 aria-label="Underline"
 className={`p-1.5 rounded-lg transition text-xs flex items-center justify-center ${
 activeFormats.underline
 ?"bg-flamingo/15 text-flamingo font-black"
 :"text-neutral-600 hover:bg-neutral-100"
 }`}
 >
 <Underline className="w-3.5 h-3.5"/>
 </button>

 <div className="w-[1px] h-4 bg-neutral-200 mx-1"/>

 {/* Insert / Edit Link */}
 <button
 type="button"
 onMouseDown={(e) => {
 e.preventDefault();
 openLinkDialog(e);
 }}
 title="Insert link (Ctrl+K)"
 aria-label="Insert link"
 className={`p-1.5 rounded-lg transition text-xs flex items-center justify-center ${
 activeFormats.isLink || showLinkDialog
 ?"bg-flamingo/15 text-flamingo font-black"
 :"text-neutral-600 hover:bg-neutral-100"
 }`}
 >
 <LinkIcon className="w-3.5 h-3.5"/>
 </button>

 {/* Remove Formatting */}
 <button
 type="button"
 onMouseDown={handleRemoveFormat}
 title="Remove formatting"
 aria-label="Remove formatting"
 className="p-1.5 rounded-lg transition text-xs flex items-center justify-center text-neutral-600 hover:bg-neutral-100 hover:text-destructive"
 >
 <RotateCcw className="w-3.5 h-3.5"/>
 </button>
 </div>
 )}

 {/* Floating Link Dialog */}
 {showLinkDialog && (
 <div
 onMouseDown={(e) => e.stopPropagation()}
 className="absolute left-0 top-full mt-2 z-40 p-3 bg-white border border-neutral-200 rounded-2xl shadow-xl w-80 text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
 >
 <div className="flex items-center justify-between pb-1.5 border-b border-border">
 <span className="font-bold text-neutral-900 flex items-center gap-1.5">
 <LinkIcon className="w-3.5 h-3.5 text-flamingo"/>
 <span>{activeFormats.isLink ?"Edit Link":"Insert Link"}</span>
 </span>
 <button
 type="button"
 onClick={() => setShowLinkDialog(false)}
 className="p-1 text-muted-foreground hover:text-foreground rounded-md"
 >
 <X className="w-3.5 h-3.5"/>
 </button>
 </div>

 <form onSubmit={applyLink} className="space-y-2">
 <div>
 <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
 Text to display
 </label>
 <input
 type="text"
 value={linkText}
 onChange={(e) => setLinkText(e.target.value)}
 placeholder="Display text"
 className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-flamingo"
 />
 </div>

 <div>
 <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
 Link destination (URL)
 </label>
 <input
 type="text"
 autoFocus
 value={linkUrl}
 onChange={(e) => setLinkUrl(e.target.value)}
 placeholder="https://example.com"
 className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-flamingo"
 />
 </div>

 {linkError && (
 <div className="text-[11px] text-destructive font-medium">{linkError}</div>
 )}

 <div className="flex items-center justify-between pt-1">
 {activeFormats.isLink ? (
 <button
 type="button"
 onClick={removeCurrentLink}
 className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline"
 >
 <Unlink className="w-3 h-3"/>
 <span>Remove Link</span>
 </button>
 ) : (
 <div />
 )}

 <div className="flex items-center gap-1.5 ml-auto">
 <button
 type="button"
 onClick={() => setShowLinkDialog(false)}
 className="px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="px-3 py-1 bg-flamingo text-white text-[11px] font-bold rounded-lg hover:bg-flamingo-600 transition flex items-center gap-1 shadow-xs"
 >
 <Check className="w-3 h-3"/>
 <span>Apply</span>
 </button>
 </div>
 </div>
 </form>
 </div>
 )}
 </div>
 );
};
