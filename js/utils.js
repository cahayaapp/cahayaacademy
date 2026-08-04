export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeUrl(value = "") {
  try {
    const url = new URL(String(value), window.location.origin);
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return url.href;
  } catch (_) {}
  return "#";
}

export function slugify(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDate(value, options = {}) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...options
  }).format(date);
}

export function formatDateTime(value) {
  return formatDate(value, { hour: "2-digit", minute: "2-digit" });
}

export function formatShortDate(value) {
  return formatDate(value, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function toInputDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name = "C") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "C";
}

export function objectToArray(object = {}) {
  return Object.entries(object || {}).map(([id, value]) => ({ id, ...(value || {}) }));
}

export function sortByDate(list, key = "createdAt", direction = "desc") {
  return [...list].sort((a, b) => {
    const av = new Date(a?.[key] || 0).getTime();
    const bv = new Date(b?.[key] || 0).getTime();
    return direction === "asc" ? av - bv : bv - av;
  });
}

export function youtubeId(input = "") {
  const value = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.split("/").filter(Boolean)[0] || "";
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || "";
    if (url.pathname.startsWith("/live/")) return url.pathname.split("/")[2] || "";
    return url.searchParams.get("v") || "";
  } catch (_) {
    return "";
  }
}

export function meetingStatus(meeting = {}) {
  if (meeting.status === "draft") return "draft";
  if (meeting.status === "live") return "live";
  if (meeting.status === "replay") return "replay";
  const now = Date.now();
  const start = meeting.startAt ? new Date(meeting.startAt).getTime() : 0;
  const end = meeting.endAt ? new Date(meeting.endAt).getTime() : start ? start + 2 * 60 * 60 * 1000 : 0;
  if (start && now < start) return "upcoming";
  if (start && now >= start && (!end || now <= end)) return "live";
  if (start && now > end) return "replay";
  return meeting.published === false ? "draft" : "replay";
}

export function statusLabel(status) {
  const labels = {
    live: "Sedang Live",
    upcoming: "Akan Datang",
    replay: "Tayangan Ulang",
    draft: "Draf",
    published: "Terbit",
    active: "Aktif",
    inactive: "Nonaktif",
    submitted: "Terkirim",
    late: "Terlambat",
    graded: "Dinilai"
  };
  return labels[status] || status || "-";
}

export function roleLabel(role) {
  return ({ admin: "Administrator", teacher: "Pengajar", student: "Peserta" })[role] || role || "Pengguna";
}

export function percent(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value || 0) / Number(total)) * 100)));
}

export function durationText(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}j ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}d`;
  return `${secs} detik`;
}

export function downloadCsv(filename, rows = []) {
  if (!rows.length) return;
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
