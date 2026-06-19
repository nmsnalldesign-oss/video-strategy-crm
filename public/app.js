import {
  STATUSES,
  createIdea,
  filterIdeas,
  getBoardSummary,
  getStatusLabel,
  normalizeCloudIdeas,
  normalizeSyncSettings,
  parseBoard,
  resolveInitialCloudIdeas,
  serializeBoard,
  shouldAcceptRemoteIdeas,
  updateIdea,
  updateIdeaStatus
} from "./app-core.mjs?v=mobile-20260619";

const STORAGE_KEY = "content-crm-board";
const SETTINGS_KEY = "content-crm-settings";
const ROLE_KEY = "content-crm-role";

const STATUS_SORT_WEIGHT = {
  taken: 1,
  tried: 2,
  idea: 4,
  landed: 5,
  missed: 6
};

const RESULT_SORT_WEIGHT = {
  landed: 1,
  missed: 2,
  tried: 3,
  taken: 4,
  idea: 6
};

const state = {
  ideas: [],
  filter: { search: "", status: "all", sort: "newest" },
  editingId: null,
  role: loadRole(),
  cloud: null,
  applyingRemote: false,
  settings: loadSettings()
};

const elements = {
  roleGate: document.querySelector("#roleGate"),
  appShell: document.querySelector("#appShell"),
  roleAdminButton: document.querySelector("#roleAdminButton"),
  roleExecutorButton: document.querySelector("#roleExecutorButton"),
  dockAdminButton: document.querySelector("#dockAdminButton"),
  dockExecutorButton: document.querySelector("#dockExecutorButton"),
  roleSwitchButton: document.querySelector("#roleSwitchButton"),
  currentRoleLabel: document.querySelector("#currentRoleLabel"),
  form: document.querySelector("#ideaForm"),
  formTitle: document.querySelector("#formTitle"),
  submitButton: document.querySelector("#submitButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  formError: document.querySelector("#formError"),
  grid: document.querySelector("#ideaGrid"),
  emptyTemplate: document.querySelector("#emptyTemplate"),
  searchInput: document.querySelector("#searchInput"),
  statusTabs: document.querySelector("#statusTabs"),
  sortSelect: document.querySelector("#sortSelect"),
  totalCount: document.querySelector("#totalCount"),
  activeCount: document.querySelector("#activeCount"),
  landedCount: document.querySelector("#landedCount"),
  successRate: document.querySelector("#successRate"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  roomIdInput: document.querySelector("#roomIdInput"),
  providerInput: document.querySelector("#providerInput"),
  supabaseSettings: document.querySelector("#supabaseSettings"),
  supabaseUrlInput: document.querySelector("#supabaseUrlInput"),
  supabaseAnonKeyInput: document.querySelector("#supabaseAnonKeyInput"),
  firebaseSettings: document.querySelector("#firebaseSettings"),
  firebaseConfigInput: document.querySelector("#firebaseConfigInput"),
  generateRoomButton: document.querySelector("#generateRoomButton"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  copyShareLinkButton: document.querySelector("#copyShareLinkButton"),
  settingsError: document.querySelector("#settingsError"),
  syncState: document.querySelector("#syncState")
};

hydrateSettingsFromHash();
init();

async function init() {
  state.ideas = loadLocalIdeas();
  elements.roomIdInput.value = state.settings.roomId;
  elements.providerInput.value = state.settings.provider;
  elements.supabaseUrlInput.value = state.settings.supabaseUrl;
  elements.supabaseAnonKeyInput.value = state.settings.supabaseAnonKey;
  elements.firebaseConfigInput.value = state.settings.firebaseConfigText;
  elements.sortSelect.value = state.filter.sort;

  applyRole(state.role);
  renderProviderSettings();
  renderStatusTabs();
  bindEvents();
  render();
  await connectCloudIfReady();
}

function bindEvents() {
  elements.roleAdminButton.addEventListener("click", () => setRole("admin"));
  elements.roleExecutorButton.addEventListener("click", () => setRole("executor"));
  elements.dockAdminButton.addEventListener("click", () => setRole("admin"));
  elements.dockExecutorButton.addEventListener("click", () => setRole("executor"));
  elements.roleSwitchButton.addEventListener("click", () => setRole(""));
  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", stopEditing);
  elements.searchInput.addEventListener("input", () => {
    state.filter.search = elements.searchInput.value;
    render();
  });
  elements.sortSelect.addEventListener("change", () => {
    state.filter.sort = elements.sortSelect.value;
    render();
  });
  elements.exportButton.addEventListener("click", exportBoard);
  elements.importInput.addEventListener("change", importBoard);
  elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
  elements.generateRoomButton.addEventListener("click", () => {
    elements.roomIdInput.value = `room-${Math.random().toString(36).slice(2, 10)}`;
  });
  elements.providerInput.addEventListener("change", renderProviderSettings);
  elements.saveSettingsButton.addEventListener("click", saveSettingsFromDialog);
  elements.copyShareLinkButton.addEventListener("click", copyShareLink);
}

function setRole(role) {
  state.role = role;
  if (role) {
    localStorage.setItem(ROLE_KEY, role);
  } else {
    localStorage.removeItem(ROLE_KEY);
    stopEditing();
  }
  applyRole(role);
}

function applyRole(role) {
  document.body.classList.toggle("role-admin", role === "admin");
  document.body.classList.toggle("role-executor", role === "executor");
  elements.roleGate.classList.toggle("is-hidden", Boolean(role));
  elements.appShell.classList.toggle("is-locked", !role);
  elements.currentRoleLabel.textContent = role === "admin" ? "Админ ТЗ" : role === "executor" ? "Исполнитель" : "Не выбран";
  elements.dockAdminButton.classList.toggle("is-active", role === "admin");
  elements.dockExecutorButton.classList.toggle("is-active", role === "executor");
}

function loadRole() {
  const role = localStorage.getItem(ROLE_KEY);
  return role === "admin" || role === "executor" ? role : "";
}

async function handleSubmit(event) {
  event.preventDefault();
  elements.formError.textContent = "";

  try {
    const formData = new FormData(elements.form);
    const attachments = await readAttachments(elements.form.elements.attachments.files);
    const input = {
      title: formData.get("title"),
      referenceUrl: formData.get("referenceUrl"),
      track: formData.get("track"),
      assignee: formData.get("assignee"),
      script: formData.get("script"),
      notes: formData.get("notes"),
      attachments
    };

    if (state.editingId) {
      const existing = state.ideas.find((idea) => idea.id === state.editingId);
      const mergedAttachments = attachments.length ? attachments : existing.attachments;
      state.ideas = state.ideas.map((idea) =>
        idea.id === state.editingId ? updateIdea(idea, { ...input, attachments: mergedAttachments }) : idea
      );
      stopEditing();
    } else {
      state.ideas = [createIdea(input), ...state.ideas];
      elements.form.reset();
    }

    await persistAndRender();
  } catch (error) {
    elements.formError.textContent = error.message;
  }
}

function render() {
  const filtered = sortIdeas(filterIdeas(state.ideas, state.filter), state.filter.sort);
  const summary = getBoardSummary(state.ideas);
  renderStatusTabs(summary);

  elements.totalCount.textContent = summary.total;
  elements.activeCount.textContent = summary.active;
  elements.landedCount.textContent = summary.byStatus.landed;
  elements.successRate.textContent = `${summary.successRate}%`;

  elements.grid.replaceChildren();
  if (!filtered.length) {
    elements.grid.append(elements.emptyTemplate.content.cloneNode(true));
    return;
  }

  for (const idea of filtered) {
    elements.grid.append(renderIdeaCard(idea));
  }
}

function sortIdeas(ideas, sort) {
  const sorted = [...ideas];
  if (sort === "oldest") {
    return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
  if (sort === "active") {
    return sorted.sort((a, b) => (STATUS_SORT_WEIGHT[a.status] ?? 99) - (STATUS_SORT_WEIGHT[b.status] ?? 99) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  if (sort === "result") {
    return sorted.sort((a, b) => (RESULT_SORT_WEIGHT[a.status] ?? 99) - (RESULT_SORT_WEIGHT[b.status] ?? 99) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderStatusTabs(summary = getBoardSummary(state.ideas)) {
  const tabs = [{ id: "all", label: "Все идеи", count: summary.total }, ...STATUSES.map((status) => ({
    ...status,
    count: summary.byStatus[status.id] ?? 0
  }))];
  elements.statusTabs.replaceChildren(
    ...tabs.map((status) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "status-button";
      button.innerHTML = `<span>${escapeHtml(status.label)}</span><strong>${status.count}</strong>`;
      button.dataset.status = status.id;
      button.addEventListener("click", () => {
        state.filter.status = status.id;
        document.querySelectorAll(".status-tabs .status-button").forEach((tab) => {
          tab.classList.toggle("is-active", tab.dataset.status === status.id);
        });
        render();
      });
      if (status.id === state.filter.status) button.classList.add("is-active");
      return button;
    })
  );
}

function renderIdeaCard(idea) {
  const card = document.createElement("article");
  card.className = `idea-card status-${idea.status}`;

  const link = idea.referenceUrl
    ? `<a class="reference-button" href="${escapeAttribute(idea.referenceUrl)}" target="_blank" rel="noreferrer">Открыть ссылку</a>`
    : "";

  card.innerHTML = `
    <div class="idea-card__header">
      <div>
        <h3>${escapeHtml(idea.title)}</h3>
      </div>
      <div class="badge-stack">
        <span class="badge">${escapeHtml(getStatusLabel(idea.status))}</span>
        ${idea.scaleRequested ? `<span class="badge scale-badge">Масштабируем</span>` : ""}
      </div>
    </div>
    <div class="idea-card__body">
      <div class="idea-card__text">
        <div class="meta-row">
          ${idea.track ? `<span>Трек: ${escapeHtml(idea.track)}</span>` : ""}
          ${idea.assignee ? `<span>Делает: ${escapeHtml(idea.assignee)}</span>` : ""}
          <span>Обновлено: ${formatDate(idea.updatedAt)}</span>
        </div>
        ${idea.script ? `<p><strong>Сценарий</strong><br>${escapeHtml(idea.script)}</p>` : ""}
        ${idea.notes ? `<p><strong>Стратегия</strong><br>${escapeHtml(idea.notes)}</p>` : ""}
      </div>
      <div class="idea-card__side">
        ${link}
      </div>
    </div>
  `;

  if (idea.attachments.length) {
    const attachments = document.createElement("div");
    attachments.className = "attachments";
    for (const attachment of idea.attachments) {
      const image = document.createElement("img");
      image.src = attachment.dataUrl;
      image.alt = attachment.name;
      attachments.append(image);
    }
    card.append(attachments);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";
  for (const status of STATUSES.filter((statusItem) => statusItem.id !== idea.status)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "status-button";
    button.textContent = status.label;
    button.dataset.status = status.id;
    button.addEventListener("click", () => setStatus(idea.id, status.id));
    actions.append(button);
  }

  if (idea.status === "landed") {
    const scaleButton = document.createElement("button");
    scaleButton.type = "button";
    scaleButton.className = "status-button scale-button";
    scaleButton.textContent = idea.scaleRequested ? "Масштабируем" : "Масштабировать";
    scaleButton.dataset.status = "scale";
    scaleButton.addEventListener("click", () => toggleScale(idea.id));
    actions.append(scaleButton);
  }

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "status-button admin-only";
  editButton.textContent = "Править";
  editButton.addEventListener("click", () => startEditing(idea.id));
  actions.append(editButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "status-button admin-only";
  deleteButton.textContent = "Удалить";
  deleteButton.addEventListener("click", () => deleteIdea(idea.id));
  actions.append(deleteButton);

  card.append(actions);
  return card;
}

async function setStatus(id, status) {
  state.ideas = state.ideas.map((idea) => (idea.id === id ? updateIdeaStatus(idea, status) : idea));
  await persistAndRender();
}

async function toggleScale(id) {
  state.ideas = state.ideas.map((idea) =>
    idea.id === id ? updateIdea(idea, { scaleRequested: !idea.scaleRequested }) : idea
  );
  await persistAndRender();
}

async function deleteIdea(id) {
  if (!confirm("Удалить эту идею?")) return;
  state.ideas = state.ideas.filter((idea) => idea.id !== id);
  await persistAndRender();
}

function startEditing(id) {
  if (state.role !== "admin") return;
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea) return;

  state.editingId = id;
  elements.formTitle.textContent = "Редактировать ТЗ";
  elements.submitButton.textContent = "Сохранить";
  elements.cancelEditButton.classList.remove("is-hidden");
  elements.form.elements.title.value = idea.title;
  elements.form.elements.referenceUrl.value = idea.referenceUrl;
  elements.form.elements.track.value = idea.track;
  elements.form.elements.assignee.value = idea.assignee;
  elements.form.elements.script.value = idea.script;
  elements.form.elements.notes.value = idea.notes;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function stopEditing() {
  state.editingId = null;
  elements.form.reset();
  elements.formTitle.textContent = "Собрать ТЗ";
  elements.submitButton.textContent = "Добавить ТЗ";
  elements.cancelEditButton.classList.add("is-hidden");
}

async function persistAndRender() {
  saveLocalIdeas(state.ideas);
  render();

  if (state.cloud && !state.applyingRemote) {
    await state.cloud.save(state.ideas);
  }
}

function loadLocalIdeas() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return parseBoard(raw);
  } catch {
    return [];
  }
}

function saveLocalIdeas(ideas) {
  localStorage.setItem(STORAGE_KEY, serializeBoard(ideas));
}

function loadSettings() {
  try {
    return normalizeSyncSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
  } catch {
    return normalizeSyncSettings();
  }
}

function saveSettings(settings) {
  state.settings = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function saveSettingsFromDialog() {
  elements.settingsError.textContent = "";
  const settings = {
    provider: elements.providerInput.value,
    roomId: elements.roomIdInput.value.trim(),
    firebaseConfigText: elements.firebaseConfigInput.value.trim(),
    supabaseUrl: elements.supabaseUrlInput.value.trim(),
    supabaseAnonKey: elements.supabaseAnonKeyInput.value.trim()
  };

  if (settings.provider === "firebase" && settings.firebaseConfigText) {
    try {
      JSON.parse(settings.firebaseConfigText);
    } catch {
      elements.settingsError.textContent = "Firebase config должен быть валидным JSON.";
      return;
    }
  }

  saveSettings(normalizeSyncSettings(settings));
  await connectCloudIfReady();
  render();
}

async function connectCloudIfReady() {
  setSyncState("Локальный режим", false);
  state.cloud?.unsubscribe?.();
  state.cloud = null;

  if (!state.settings.roomId) return;
  if (state.settings.provider === "supabase") {
    await connectSupabaseIfReady();
    return;
  }
  if (!state.settings.firebaseConfigText) return;

  try {
    const config = JSON.parse(state.settings.firebaseConfigText);
    const [{ getApps, initializeApp }, { getFirestore, doc, onSnapshot, setDoc }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js")
    ]);

    const app = getApps()[0] ?? initializeApp(config);
    const db = getFirestore(app);
    const ref = doc(db, "rooms", state.settings.roomId);
    let firstSnapshot = true;

    state.cloud = {
      save: (ideas) => setDoc(ref, { ideas: ideas.map((idea) => ({ ...idea })), updatedAt: new Date().toISOString() }, { merge: true }),
      unsubscribe: onSnapshot(ref, async (snapshot) => {
        const remoteIdeas = snapshot.exists() && Array.isArray(snapshot.data().ideas) ? snapshot.data().ideas : null;

        if (shouldAcceptRemoteIdeas(remoteIdeas)) {
          const resolved = resolveInitialCloudIdeas(state.ideas, remoteIdeas);
          state.applyingRemote = true;
          state.ideas = resolved.ideas;
          saveLocalIdeas(state.ideas);
          state.applyingRemote = false;
          render();
          if (firstSnapshot && resolved.shouldSaveLocal) {
            await state.cloud.save(state.ideas);
          }
        } else if (firstSnapshot && state.ideas.length) {
          await state.cloud.save(state.ideas);
        }

        firstSnapshot = false;
        setSyncState(`Онлайн: ${state.settings.roomId}`, true);
      })
    };
  } catch (error) {
    setSyncState("Ошибка облака", false);
    elements.settingsError.textContent = error.message;
  }
}

async function connectSupabaseIfReady() {
  if (!state.settings.supabaseUrl || !state.settings.supabaseAnonKey) return;

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    const client = createClient(state.settings.supabaseUrl, state.settings.supabaseAnonKey);

    const loadRemote = async () => {
      const { data, error } = await client.from("rooms").select("ideas").eq("id", state.settings.roomId).maybeSingle();
      if (error) throw error;

      if (shouldAcceptRemoteIdeas(data?.ideas)) {
        const resolved = resolveInitialCloudIdeas(state.ideas, data.ideas);
        state.applyingRemote = true;
        state.ideas = resolved.ideas;
        saveLocalIdeas(state.ideas);
        state.applyingRemote = false;
        render();
        if (resolved.shouldSaveLocal) {
          await state.cloud.save(state.ideas);
        }
      } else if (state.ideas.length) {
        await state.cloud.save(state.ideas);
      }
    };

    state.cloud = {
      save: async (ideas) => {
        const { error } = await client
          .from("rooms")
          .upsert({ id: state.settings.roomId, ideas: ideas.map((idea) => ({ ...idea })), updated_at: new Date().toISOString() });
        if (error) throw error;
      },
      unsubscribe: () => subscription.unsubscribe()
    };

    const channelName = `room-${state.settings.roomId}`;
    const subscription = client
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${state.settings.roomId}` }, (payload) => {
        if (shouldAcceptRemoteIdeas(payload.new?.ideas)) {
          state.applyingRemote = true;
          state.ideas = normalizeCloudIdeas(payload.new.ideas);
          saveLocalIdeas(state.ideas);
          state.applyingRemote = false;
          render();
        }
      })
      .subscribe();

    await loadRemote();
    setSyncState(`Онлайн: ${state.settings.roomId}`, true);
  } catch (error) {
    setSyncState("Ошибка Supabase", false);
    elements.settingsError.textContent = error.message;
  }
}

function setSyncState(text, online) {
  elements.syncState.textContent = text;
  elements.syncState.classList.toggle("is-online", online);
}

function exportBoard() {
  const blob = new Blob([serializeBoard(state.ideas)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `video-strategy-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importBoard(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    state.ideas = parseBoard(await file.text());
    await persistAndRender();
  } catch (error) {
    alert(error.message);
  } finally {
    event.target.value = "";
  }
}

async function copyShareLink() {
  const roomId = elements.roomIdInput.value.trim() || state.settings.roomId;
  const provider = elements.providerInput.value || state.settings.provider;
  const configText = elements.firebaseConfigInput.value.trim() || state.settings.firebaseConfigText;
  const supabaseUrl = elements.supabaseUrlInput.value.trim() || state.settings.supabaseUrl;
  const supabaseAnonKey = elements.supabaseAnonKeyInput.value.trim() || state.settings.supabaseAnonKey;
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({
    provider,
    room: roomId,
    fb: configText ? toBase64Url(configText) : "",
    sbUrl: supabaseUrl ? toBase64Url(supabaseUrl) : "",
    sbKey: supabaseAnonKey ? toBase64Url(supabaseAnonKey) : ""
  }).toString();

  if (provider === "supabase" && roomId === "vanya-strategy") {
    url.hash = "";
  }

  await navigator.clipboard.writeText(url.toString());
  elements.settingsError.textContent = "Ссылка скопирована.";
}

function hydrateSettingsFromHash() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  const roomId = params.get("room");
  const provider = params.get("provider");
  const firebaseConfigText = params.get("fb") ? fromBase64Url(params.get("fb")) : "";
  const supabaseUrl = params.get("sbUrl") ? fromBase64Url(params.get("sbUrl")) : "";
  const supabaseAnonKey = params.get("sbKey") ? fromBase64Url(params.get("sbKey")) : "";

  if (roomId || provider || firebaseConfigText || supabaseUrl || supabaseAnonKey) {
    saveSettings(normalizeSyncSettings({
      provider: provider || state.settings.provider,
      roomId: roomId || state.settings.roomId,
      firebaseConfigText: firebaseConfigText || state.settings.firebaseConfigText,
      supabaseUrl: supabaseUrl || state.settings.supabaseUrl,
      supabaseAnonKey: supabaseAnonKey || state.settings.supabaseAnonKey
    }));
  }
}

function renderProviderSettings() {
  const provider = elements.providerInput.value;
  elements.supabaseSettings.classList.toggle("is-hidden", provider !== "supabase");
  elements.firebaseSettings.classList.toggle("is-hidden", provider !== "firebase");
}

function readAttachments(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve({ name: file.name, dataUrl: reader.result }));
          reader.addEventListener("error", () => reject(new Error(`Не удалось прочитать ${file.name}`)));
          reader.readAsDataURL(file);
        })
    )
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
