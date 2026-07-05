export function heading(level: number, text: string): string {
  return `${"#".repeat(level)} ${text}\n`;
}

export function bold(text: string): string {
  return `**${text}**`;
}

export function italic(text: string): string {
  return `*${text}*`;
}

export function code(text: string): string {
  return `\`${text}\``;
}

export function codeBlock(lang: string, text: string): string {
  return "```" + lang + "\n" + text + "\n```\n";
}

export function list(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function checkbox(label: string, checked: boolean): string {
  return `- [${checked ? "X" : " "}] ${label}`;
}

export function table(headers: string[], rows: string[][]): string {
  const headerRow = "| " + headers.join(" | ") + " |";
  const sepRow = "|" + headers.map(() => "---").join("|") + "|";
  const dataRows = rows.map((row) => "| " + row.join(" | ") + " |");
  return [headerRow, sepRow, ...dataRows].join("\n") + "\n";
}

export function section(title: string, content: string): string {
  return `## ${title}\n\n${content}\n`;
}

export function hr(): string {
  return "\n---\n";
}

export function comment(text: string): string {
  return `<!-- ${text} -->`;
}

export function link(text: string, url: string): string {
  return `[${text}](${url})`;
}

export const MARKER_START = "<!-- ===== DEVFLOW INTEGRATION START ===== -->";
export const MARKER_END = "<!-- ===== DEVFLOW INTEGRATION END ===== -->";
