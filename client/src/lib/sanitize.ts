/**
 * Snow Forms Rich-Text Sanitization and Utilities
 * Ensures safe rendering of formatted titles, descriptions, and questions without XSS risks.
 */

const ALLOWED_FORMATTING_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "A", "BR"]);

/**
 * Sanitizes rich-text HTML using the browser's native DOMParser.
 * Removes all unsafe elements (script, iframe, etc.), disallows all event handlers,
 * and validates hyperlink destinations (preventing javascript:, data:, vbscript: schemes).
 * If no rich-text formatting tags exist, returns clean plain text.
 */
export function sanitizeRichText(dirty: string | null | undefined): string {
  if (!dirty) return "";
  const trimmed = dirty.trim();
  if (!trimmed) return "";

  // If plain text with no tags, return directly
  if (!trimmed.includes("<") && !trimmed.includes(">")) {
    return trimmed;
  }

  // If no actual formatting tags exist (e.g. only <span>, <div>, <p>), return clean plain text
  if (!hasRichText(trimmed) && !/<br\s*\/?>/i.test(trimmed)) {
    return stripHtml(trimmed).trim();
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // Basic fallback if running outside browser
    return trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, "text/html");

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      // If tag is not in whitelist (such as SPAN, DIV, P), unwrap its children safely
      if (!ALLOWED_FORMATTING_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        el.childNodes.forEach((child) => {
          const cleaned = cleanNode(child);
          if (cleaned) fragment.appendChild(cleaned);
        });
        return fragment;
      }

      const newEl = document.createElement(tagName.toLowerCase());

      // Safe attribute handling for hyperlinks
      if (tagName === "A") {
        const rawHref = el.getAttribute("href") || "";
        const cleanHref = rawHref.trim();

        // Enforce safe link destinations only
        const isSafeProtocol =
          cleanHref.startsWith("http://") ||
          cleanHref.startsWith("https://") ||
          cleanHref.startsWith("mailto:") ||
          cleanHref.startsWith("/");

        if (isSafeProtocol) {
          newEl.setAttribute("href", cleanHref);
          newEl.setAttribute("target", "_blank");
          newEl.setAttribute("rel", "noopener noreferrer");
          newEl.setAttribute(
            "class",
            "text-flamingo underline hover:opacity-80 transition cursor-pointer font-medium"
          );
        } else {
          // Dangerous protocol: unwrap anchor and just preserve text
          const fragment = document.createDocumentFragment();
          el.childNodes.forEach((child) => {
            const cleaned = cleanNode(child);
            if (cleaned) fragment.appendChild(cleaned);
          });
          return fragment;
        }
      }

      el.childNodes.forEach((child) => {
        const cleaned = cleanNode(child);
        if (cleaned) newEl.appendChild(cleaned);
      });

      return newEl;
    }

    return null;
  }

  const container = document.createElement("div");
  doc.body.childNodes.forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) container.appendChild(cleaned);
  });

  return container.innerHTML;
}

/**
 * Decodes standard named and numeric HTML entities outside a full browser DOM.
 */
function decodeHtmlEntitiesFallback(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code === 160 ? " " : String.fromCharCode(code);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return code === 160 ? " " : String.fromCharCode(code);
    });
}

/**
 * Converts an HTML or rich-text string into clean, entity-decoded plain text.
 * Safely strips all HTML tags, decodes character entities (including &nbsp;, &amp;, &lt;, &gt;),
 * and normalizes non-breaking spaces (U+00A0) to standard spaces.
 * Useful for navigation headers, dashboard lists, CSV exports, and browser titles.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";

  // If already clean plain text with no HTML tags, entities, or non-breaking spaces
  if (!html.includes("<") && !html.includes("&") && !html.includes("\u00A0")) {
    return html;
  }

  let text = "";

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      text = doc.body.textContent || "";
    } catch {
      text = html.replace(/<[^>]*>/g, "");
    }
  } else {
    text = html.replace(/<[^>]*>/g, "");
    text = decodeHtmlEntitiesFallback(text);
  }

  // Normalize Unicode non-breaking space (U+00A0) to standard ASCII space
  text = text.replace(/\u00A0/g, " ");

  return text;
}

/**
 * Checks if a string contains formatting tags.
 */
export function hasRichText(content: string | null | undefined): boolean {
  if (!content) return false;
  return /<\s*(b|strong|i|em|u|a)\b[^>]*>/i.test(content);
}
