// sanitizeSvg — strips XSS vectors from an uploaded SVG before it's ever
// stored or rendered. SVG is XML with a scriptable subset (inline
// <script>, on* event handler attributes, javascript: URIs, external
// references via <use>/<image> xlink:href, <foreignObject> that can embed
// arbitrary HTML) — sniffMimeType() only confirms the file IS an SVG, it
// says nothing about what's safe to trust inside it. This closes that gap.
//
// Implementation note: this is a targeted denylist sanitizer (regex-based,
// zero new dependencies) covering the actual attack surface that matters
// for artwork uploads — it is NOT a general-purpose XML sanitizer. If SVG
// upload volume/risk grows, swap this for a maintained library (DOMPurify
// running against jsdom, or SVGO's sanitize plugin) — callers only touch
// `sanitizeSvg()`, so that swap is contained to this one file.

const DANGEROUS_TAGS = ["script", "foreignObject", "iframe", "embed", "object", "animate"];

// Matches any attribute starting with "on" (onload, onclick, onerror, …),
// case-insensitively, whether double- or single-quoted.
const EVENT_HANDLER_ATTR_RE = /\son\w+\s*=\s*(".*?"|'.*?')/gi;

// javascript: / data:text/html URIs used as href/src/xlink:href values.
const SCRIPT_URI_ATTR_RE =
  /\s(?:href|xlink:href|src)\s*=\s*(["'])\s*(?:javascript|data:text\/html)[^"']*\1/gi;

function stripTag(svg: string, tagName: string): string {
  // Removes both `<tag ...>...</tag>` and self-closing `<tag ... />` forms.
  const pairedRe = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?</${tagName}\\s*>`, "gi");
  const selfClosingRe = new RegExp(`<${tagName}[^>]*/>`, "gi");
  return svg.replace(pairedRe, "").replace(selfClosingRe, "");
}

export interface SvgSanitizeResult {
  sanitized: string;
  /** True if anything was actually stripped — useful for logging/telemetry. */
  wasModified: boolean;
}

export function sanitizeSvg(rawSvg: string): SvgSanitizeResult {
  let svg = rawSvg;

  for (const tag of DANGEROUS_TAGS) {
    svg = stripTag(svg, tag);
  }

  svg = svg.replace(EVENT_HANDLER_ATTR_RE, "");
  svg = svg.replace(SCRIPT_URI_ATTR_RE, "");

  // XML comments can be used to break up/hide otherwise-matched patterns
  // (e.g. "java<!---->script:") — strip them entirely rather than trying
  // to parse around them.
  svg = svg.replace(/<!--[\s\S]*?-->/g, "");

  return { sanitized: svg, wasModified: svg !== rawSvg };
}
