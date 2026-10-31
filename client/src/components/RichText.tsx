import React, { useMemo } from "react";
import { sanitizeRichText, hasRichText } from "../lib/sanitize";

interface RichTextProps {
  content: string | null | undefined;
  className?: string;
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4";
}

/**
 * Safely renders rich-text content in public respondent forms, previews, and headings.
 * Handles bold, italic, underline, safe hyperlinks, and line breaks while protecting against XSS.
 */
export const RichText: React.FC<RichTextProps> = ({
  content,
  className = "",
  as: Component = "span",
}) => {
  if (!content) return null;

  const isRich = useMemo(() => hasRichText(content), [content]);
  const sanitizedHtml = useMemo(() => {
    if (!isRich) return "";
    return sanitizeRichText(content);
  }, [content, isRich]);

  if (!isRich) {
    return <Component className={className}>{content}</Component>;
  }

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};
