import type { BrowserToolArguments } from "@/shared/stage-tools";

export const BROWSER_PROXY_BRIEF_MAX_CHARS = 4_000;

export type TBrowserProxyBriefInput = {
  args: BrowserToolArguments;
  extraBrief?: string;
};

const clipText = (value: string, max: number) => {
  if (value.length <= max) return value;

  return `${value.slice(0, max)}…`;
};

export const buildBrowserProxyBrief = (input: TBrowserProxyBriefInput): string => {
  const parts: string[] = [
    "YAHL browse brief. Stagehand tools only — do not invent bash, platform, set_context, or nixery.",
    `mode: ${input.args.mode}`,
  ];

  const url = input.args.url?.trim();

  if (url) {
    parts.push(`url: ${clipText(url, 500)}`);
  }

  const base = parts.join("\n\n");
  const extra = input.extraBrief?.trim();

  if (!extra) {
    return clipText(base, BROWSER_PROXY_BRIEF_MAX_CHARS);
  }

  const remaining = BROWSER_PROXY_BRIEF_MAX_CHARS - base.length - 2;

  if (remaining <= 0) {
    return clipText(base, BROWSER_PROXY_BRIEF_MAX_CHARS);
  }

  return clipText(`${base}\n\n${clipText(extra, remaining)}`, BROWSER_PROXY_BRIEF_MAX_CHARS);
};
