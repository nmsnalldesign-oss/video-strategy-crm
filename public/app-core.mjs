export const STATUSES = [
  { id: "idea", label: "Идея" },
  { id: "taken", label: "Взял в реализацию" },
  { id: "tried", label: "Выложил" },
  { id: "landed", label: "Залетело" },
  { id: "missed", label: "Не залетело" }
];

export const DEFAULT_SYNC_SETTINGS = {
  provider: "supabase",
  roomId: "vanya-strategy",
  firebaseConfigText: "",
  supabaseUrl: "https://sibaqjistqhpxjnidyiv.supabase.co",
  supabaseAnonKey: "sb_publishable_8eekRjcu3dhcQpJcUtVEjA_XX6dPtHG"
};

const STATUS_IDS = new Set(STATUSES.map((status) => status.id));

export function createIdea(input = {}, deps = {}) {
  const now = deps.now ?? (() => new Date().toISOString());
  const makeId = deps.makeId ?? defaultId;
  const createdAt = now();
  const title = clean(input.title);
  const referenceUrl = clean(input.referenceUrl);

  if (!title && !referenceUrl) {
    throw new Error("Нужно название или ссылка на референс.");
  }

  return normalizeIdea({
    id: makeId(),
    title: title || "Без названия",
    referenceUrl,
    track: clean(input.track),
    script: clean(input.script),
    notes: clean(input.notes),
    assignee: clean(input.assignee),
    status: STATUS_IDS.has(input.status) ? input.status : "idea",
    attachments: normalizeAttachments(input.attachments),
    createdAt,
    updatedAt: createdAt
  });
}

export function updateIdeaStatus(idea, status, deps = {}) {
  if (!STATUS_IDS.has(status)) {
    throw new Error(`Неизвестный статус: ${status}`);
  }

  const now = deps.now ?? (() => new Date().toISOString());
  return normalizeIdea({ ...idea, status, updatedAt: now() });
}

export function updateIdea(idea, changes = {}, deps = {}) {
  const now = deps.now ?? (() => new Date().toISOString());
  return normalizeIdea({
    ...idea,
    ...changes,
    attachments: changes.attachments ?? idea.attachments,
    updatedAt: now()
  });
}

export function filterIdeas(ideas, filters = {}) {
  const search = clean(filters.search).toLowerCase();
  const status = filters.status && filters.status !== "all" ? filters.status : "";

  return ideas.filter((idea) => {
    if (status && idea.status !== status) return false;
    if (!search) return true;

    return [
      idea.title,
      idea.referenceUrl,
      idea.track,
      idea.script,
      idea.notes,
      idea.assignee
    ].some((value) => String(value ?? "").toLowerCase().includes(search));
  });
}

export function getBoardSummary(ideas) {
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status.id, 0]));

  for (const idea of ideas) {
    if (byStatus[idea.status] !== undefined) {
      byStatus[idea.status] += 1;
    }
  }

  const resolved = byStatus.landed + byStatus.missed;
  const successRate = resolved === 0 ? 0 : Math.round((byStatus.landed / resolved) * 100);

  return {
    total: ideas.length,
    byStatus,
    active: byStatus.taken + byStatus.tried,
    successRate
  };
}

export function serializeBoard(ideas) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      ideas: ideas.map(normalizeIdea)
    },
    null,
    2
  );
}

export function parseBoard(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Не удалось прочитать JSON доски.");
  }

  const ideas = Array.isArray(parsed) ? parsed : parsed?.ideas;
  if (!Array.isArray(ideas)) {
    throw new Error("Не удалось прочитать JSON доски: нет массива ideas.");
  }

  return ideas.map(normalizeIdea);
}

export function getStatusLabel(statusId) {
  return STATUSES.find((status) => status.id === statusId)?.label ?? "Идея";
}

export function normalizeSyncSettings(settings = {}) {
  const hasFirebaseConfig = Boolean(clean(settings.firebaseConfigText));
  const provider = settings.provider === "firebase" && hasFirebaseConfig ? "firebase" : "supabase";

  return {
    provider,
    roomId: clean(settings.roomId) || DEFAULT_SYNC_SETTINGS.roomId,
    firebaseConfigText: clean(settings.firebaseConfigText),
    supabaseUrl: provider === "supabase" ? clean(settings.supabaseUrl) || DEFAULT_SYNC_SETTINGS.supabaseUrl : clean(settings.supabaseUrl),
    supabaseAnonKey: provider === "supabase" ? clean(settings.supabaseAnonKey) || DEFAULT_SYNC_SETTINGS.supabaseAnonKey : clean(settings.supabaseAnonKey)
  };
}

export function resolveInitialCloudIdeas(localIdeas, remoteIdeas) {
  const local = Array.isArray(localIdeas) ? localIdeas.map(normalizeIdea) : [];

  if (!Array.isArray(remoteIdeas)) {
    return { ideas: local, shouldSaveLocal: local.length > 0 };
  }

  const remote = remoteIdeas.map(normalizeIdea);
  if (!remote.length && local.length) {
    return { ideas: local, shouldSaveLocal: true };
  }

  return { ideas: remote, shouldSaveLocal: false };
}

export function shouldAcceptRemoteIdeas(remoteIdeas) {
  return Array.isArray(remoteIdeas);
}

export function normalizeCloudIdeas(remoteIdeas) {
  if (!Array.isArray(remoteIdeas)) {
    return [];
  }

  return remoteIdeas.map(normalizeIdea);
}

function normalizeIdea(idea) {
  const createdAt = clean(idea.createdAt) || new Date().toISOString();
  const status = clean(idea.status) === "trying" ? "taken" : clean(idea.status);
  return {
    id: clean(idea.id) || defaultId(),
    title: clean(idea.title) || "Без названия",
    referenceUrl: clean(idea.referenceUrl),
    track: clean(idea.track),
    script: clean(idea.script),
    notes: clean(idea.notes),
    assignee: clean(idea.assignee),
    status: STATUS_IDS.has(status) ? status : "idea",
    attachments: normalizeAttachments(idea.attachments),
    scaleRequested: Boolean(idea.scaleRequested),
    createdAt,
    updatedAt: clean(idea.updatedAt) || createdAt
  };
}

function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .filter((attachment) => attachment && attachment.dataUrl)
    .map((attachment) => ({
      id: clean(attachment.id) || defaultId(),
      name: clean(attachment.name) || "image",
      dataUrl: String(attachment.dataUrl)
    }));
}

function clean(value) {
  return String(value ?? "").trim();
}

function defaultId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `idea-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
