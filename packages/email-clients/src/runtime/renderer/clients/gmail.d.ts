// Types for gmail.js (email-renderer, copied unchanged).
export function gmailClip(html: string): { kept: string; cut: number | null; clipped: boolean; size: number };
export function gmail(html: string, profileKey?: "gmail-web" | "gmail-app" | "gmail-app-other", options?: { clipped?: boolean; size?: number }): { html: string; removed: Record<string, number>; clipped: boolean; size: number };
