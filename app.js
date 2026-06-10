import { COUPLE_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const storageKey = `ab-wedding-app-${COUPLE_ID}`;
const configuredSupabase = SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

let state = null;
let supabase = null;
let currentUser = null;
let remoteChannel = null;
let saveTimer = null;
let lastRemoteStamp = "";
let authAction = "signin";

const collectionMeta = {
  notes: {
    list: "notesList",
    empty: "Nenhum lembrete cadastrado.",
    done: (item) => Boolean(item.done),
    toggle: (item) => ({ ...item, done: !item.done }),
    title: (item) => item.title,
    meta: () => ["Lembrete"]
  },
  tasks: {
    list: "tasksList",
    empty: "Nenhuma tarefa cadastrada.",
    done: (item) => Boolean(item.done),
    toggle: (item) => ({ ...item, done: !item.done }),
    title: (item) => item.title,
    meta: (item) => [
      item.period || "Sem período",
      item.owner || "Casal",
      item.dueDate ? formatDate(item.dueDate) : ""
    ],
    badge: (item) => item.done ? ["Concluída", "good"] : ["Pendente", "warn"]
  },
  guests: {
    list: "guestsList",
    empty: "Nenhum convidado cadastrado.",
    done: (item) => item.confirmed === "Sim",
    toggle: (item) => ({ ...item, confirmed: item.confirmed === "Sim" ? "" : "Sim" }),
    title: (item) => item.name,
    meta: (item) => [item.group || "Sem grupo", item.side || "Sem lado"],
    badge: (item) => {
      if (item.confirmed === "Sim") return ["Confirmado", "good"];
      if (item.confirmed === "Não") return ["Não vai", "bad"];
      return ["A confirmar", "warn"];
    }
  },
  shower: {
    list: "showerList",
    empty: "Nenhum item no chá de casa nova.",
    done: (item) => Boolean(item.received),
    toggle: (item) => ({ ...item, received: !item.received }),
    title: (item) => item.title,
    meta: (item) => [
      `Qtd. ${item.quantity || 1}`,
      item.person || "Sem nome",
      `Prioridade ${item.priority || "Normal"}`
    ],
    badge: (item) => item.received ? ["Recebido", "good"] : ["Aberto", "info"]
  },
  gifts: {
    list: "giftsList",
    empty: "Nenhum presente ganho registrado.",
    done: (item) => Boolean(item.thankYou),
    toggle: (item) => ({ ...item, thankYou: !item.thankYou }),
    title: (item) => item.title,
    meta: (item) => [
      item.from ? `De: ${item.from}` : "Sem remetente",
      item.receivedAt ? formatDate(item.receivedAt) : "",
      item.note || ""
    ],
    badge: (item) => item.thankYou ? ["Agradecido", "good"] : ["A agradecer", "warn"]
  },
  purchases: {
    list: "purchasesList",
    empty: "Nenhuma compra cadastrada.",
    done: (item) => Boolean(item.bought),
    toggle: (item) => ({ ...item, bought: !item.bought }),
    title: (item) => item.title,
    meta: (item) => [
      item.category || "Geral",
      `Qtd. ${item.quantity || 1}`,
      item.price ? formatMoney(item.price) : "",
      `Prioridade ${item.priority || "Normal"}`
    ],
    badge: (item) => item.bought ? ["Comprado", "good"] : ["Comprar", "info"]
  },
  budget: {
    list: "budgetList",
    empty: "Nenhum valor cadastrado.",
    done: (item) => Boolean(item.paid),
    toggle: (item) => ({ ...item, paid: !item.paid }),
    title: (item) => item.description,
    meta: (item) => [
      item.category || "Geral",
      `Estimado ${formatMoney(item.estimated)}`,
      `Real ${formatMoney(item.actual)}`
    ],
    badge: (item) => item.paid ? ["Pago", "good"] : ["Aberto", "warn"]
  },
  vendors: {
    list: "vendorsList",
    empty: "Nenhum fornecedor cadastrado.",
    done: (item) => Boolean(item.paid),
    toggle: (item) => ({ ...item, paid: !item.paid }),
    title: (item) => item.service,
    meta: (item) => [
      item.name || "Sem nome",
      item.contact || "Sem contato",
      item.value ? formatMoney(item.value) : ""
    ],
    badge: (item) => item.paid ? ["Pago", "good"] : ["A pagar", "warn"]
  }
};

state = hydrateState(loadLocalState());
init();

function init() {
  bindNavigation();
  bindForms();
  bindCollectionActions();
  bindUtilities();
  render();
  tickCountdown();
  setInterval(tickCountdown, 1000);
  initSupabase();
}

function defaultState() {
  return {
    version: 1,
    settings: {
      coupleName: "Alisson & Brenda",
      weddingDate: "2027-11-27T00:00",
      venue: "Igreja Batista Shekinah",
      city: "",
      message: "Organizando cada detalhe com carinho."
    },
    notes: [
      makeItem("notes", { title: "Revisar prioridades da semana" })
    ],
    tasks: [
      makeItem("tasks", { title: "Definir orçamento total", period: "2 anos a 1 ano e meio antes", owner: "Casal" }),
      makeItem("tasks", { title: "Criar lista preliminar de convidados", period: "2 anos a 1 ano e meio antes", owner: "Casal" }),
      makeItem("tasks", { title: "Escolher data e reservar local da cerimônia", period: "2 anos a 1 ano e meio antes", owner: "Casal", done: true, dueDate: "2027-11-27" }),
      makeItem("tasks", { title: "Contratar fotógrafo e filmagem", period: "1 ano antes", owner: "Alisson e Brenda", done: true }),
      makeItem("tasks", { title: "Contratar decoração", period: "1 ano antes", owner: "Brenda" }),
      makeItem("tasks", { title: "Montar lista de presentes", period: "5 a 3 meses antes", owner: "Casal" }),
      makeItem("tasks", { title: "Confirmar todos os fornecedores", period: "1 semana antes", owner: "Alisson" })
    ],
    guests: [
      makeItem("guests", { name: "Igreja", confirmed: "Sim", group: "Cerimônia", side: "Casal" }),
      makeItem("guests", { name: "Dreka", confirmed: "Sim", group: "Família", side: "Casal" }),
      makeItem("guests", { name: "Joabe / Val", confirmed: "Sim", group: "Família", side: "Casal" }),
      makeItem("guests", { name: "Fabiana", confirmed: "Sim", group: "Família", side: "Brenda" }),
      makeItem("guests", { name: "Anne", confirmed: "Sim", group: "Amigos", side: "Brenda" })
    ],
    shower: [
      makeItem("shower", { title: "Copos", quantity: 6, priority: "Alta" }),
      makeItem("shower", { title: "Jogo de toalhas", quantity: 2, priority: "Normal" }),
      makeItem("shower", { title: "Escorredor de pratos", quantity: 1, priority: "Normal" })
    ],
    gifts: [],
    purchases: [
      makeItem("purchases", { title: "Jogo de panelas", category: "Cozinha", quantity: 1, priority: "Alta", price: 0 }),
      makeItem("purchases", { title: "Toalhas de banho", category: "Casa nova", quantity: 4, priority: "Normal", price: 0 }),
      makeItem("purchases", { title: "Kit banheiro", category: "Casa nova", quantity: 1, priority: "Normal", price: 0 })
    ],
    budget: [
      makeItem("budget", { description: "Fotografia", category: "Fornecedor", estimated: 2700, actual: 2700 }),
      makeItem("budget", { description: "Penteado e maquiagem", category: "Fornecedor", estimated: 1700, actual: 1700 }),
      makeItem("budget", { description: "Decoração", category: "Fornecedor", estimated: 0, actual: 0 })
    ],
    vendors: [
      makeItem("vendors", { service: "Fotografia", name: "Thiago Canuto", contact: "", value: 2700 }),
      makeItem("vendors", { service: "Penteado e maquiagem", name: "Ludimila Canuto", contact: "", value: 1700 }),
      makeItem("vendors", { service: "Local", name: "Igreja Batista Shekinah", contact: "", value: 0 })
    ]
  };
}

function makeItem(collection, raw = {}) {
  const base = {
    id: raw.id || crypto.randomUUID(),
    createdAt: raw.createdAt || Date.now()
  };

  if (collection === "notes") {
    return { ...base, title: clean(raw.title), done: Boolean(raw.done) };
  }

  if (collection === "tasks") {
    return {
      ...base,
      title: clean(raw.title),
      period: clean(raw.period),
      owner: clean(raw.owner) || "Casal",
      dueDate: raw.dueDate || "",
      done: Boolean(raw.done)
    };
  }

  if (collection === "guests") {
    return {
      ...base,
      name: clean(raw.name),
      group: clean(raw.group),
      side: clean(raw.side),
      confirmed: clean(raw.confirmed),
      done: clean(raw.confirmed) === "Sim"
    };
  }

  if (collection === "shower") {
    return {
      ...base,
      title: clean(raw.title),
      quantity: positiveNumber(raw.quantity, 1),
      person: clean(raw.person),
      priority: clean(raw.priority) || "Normal",
      received: Boolean(raw.received)
    };
  }

  if (collection === "gifts") {
    return {
      ...base,
      title: clean(raw.title),
      from: clean(raw.from),
      receivedAt: raw.receivedAt || "",
      note: clean(raw.note),
      thankYou: Boolean(raw.thankYou)
    };
  }

  if (collection === "purchases") {
    return {
      ...base,
      title: clean(raw.title),
      category: clean(raw.category) || "Geral",
      quantity: positiveNumber(raw.quantity, 1),
      price: moneyNumber(raw.price),
      priority: clean(raw.priority) || "Normal",
      bought: Boolean(raw.bought)
    };
  }

  if (collection === "budget") {
    return {
      ...base,
      description: clean(raw.description),
      category: clean(raw.category) || "Geral",
      estimated: moneyNumber(raw.estimated),
      actual: moneyNumber(raw.actual),
      paid: Boolean(raw.paid)
    };
  }

  if (collection === "vendors") {
    return {
      ...base,
      service: clean(raw.service),
      name: clean(raw.name),
      contact: clean(raw.contact),
      value: moneyNumber(raw.value),
      paid: Boolean(raw.paid)
    };
  }

  return { ...base, ...raw };
}

function hydrateState(input) {
  const base = defaultState();
  const next = input && typeof input === "object" ? input : {};
  const hydrated = {
    ...base,
    ...next,
    settings: { ...base.settings, ...(next.settings || {}) }
  };

  Object.keys(collectionMeta).forEach((collection) => {
    hydrated[collection] = Array.isArray(next[collection])
      ? next[collection].map((item) => makeItem(collection, item)).filter(hasTitle(collection))
      : base[collection];
  });

  return hydrated;
}

function hasTitle(collection) {
  return (item) => {
    if (collection === "guests") return Boolean(item.name);
    if (collection === "budget") return Boolean(item.description);
    if (collection === "vendors") return Boolean(item.service);
    return Boolean(item.title);
  };
}

function loadLocalState() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveLocalState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
}

function showView(viewName) {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-visible", view.id === `view-${viewName}`);
  });

  const active = document.getElementById(`view-${viewName}`);
  document.getElementById("activeTitle").textContent = active?.dataset.title || "Início";
  document.getElementById("activeEyebrow").textContent = active?.dataset.eyebrow || "Painel";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindForms() {
  document.querySelectorAll("[data-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const collection = form.dataset.form;
      const raw = Object.fromEntries(new FormData(form).entries());
      const item = makeItem(collection, raw);
      state[collection].push(item);
      form.reset();
      persist(`Item salvo em ${labelFor(collection)}.`);
    });
  });

  document.getElementById("settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.settings = {
      ...state.settings,
      ...Object.fromEntries(new FormData(event.currentTarget).entries())
    };
    persist("Ajustes salvos.");
  });

  document.getElementById("authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuthSubmit(event.currentTarget, authAction);
  });

  document.querySelectorAll("[data-auth-action]").forEach((button) => {
    button.addEventListener("click", () => {
      authAction = button.dataset.authAction;
    });
  });
}

function bindCollectionActions() {
  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-toggle]");
    if (!input) return;
    toggleItem(input.dataset.toggle, input.dataset.id);
  });

  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete]");
    if (!deleteButton) return;
    deleteItem(deleteButton.dataset.delete, deleteButton.dataset.id);
  });
}

function bindUtilities() {
  document.getElementById("signOutButton").addEventListener("click", signOut);
  document.getElementById("exportButton").addEventListener("click", exportData);
  document.getElementById("importInput").addEventListener("change", importData);
}

function toggleItem(collection, id) {
  const meta = collectionMeta[collection];
  state[collection] = state[collection].map((item) => (
    String(item.id) === String(id) ? meta.toggle(item) : item
  ));
  persist("Atualizado.");
}

function deleteItem(collection, id) {
  state[collection] = state[collection].filter((item) => String(item.id) !== String(id));
  persist("Removido.");
}

function persist(message) {
  saveLocalState();
  render();
  queueRemoteSave();
  if (message) showToast(message);
}

function render() {
  renderSettings();
  renderHero();
  renderStats();
  Object.keys(collectionMeta).forEach(renderCollection);
  renderPriorityList();
  paintIcons();
}

function renderSettings() {
  const form = document.getElementById("settingsForm");
  form.coupleName.value = state.settings.coupleName;
  form.weddingDate.value = toDatetimeLocal(state.settings.weddingDate);
  form.venue.value = state.settings.venue || "";
  form.city.value = state.settings.city || "";
  form.message.value = state.settings.message || "";
}

function renderHero() {
  document.getElementById("heroCouple").textContent = state.settings.coupleName;
  document.getElementById("heroMessage").textContent = state.settings.message || "";
  document.getElementById("heroDate").textContent = formatDateTime(state.settings.weddingDate);
  document.getElementById("heroVenue").textContent = [state.settings.venue, state.settings.city].filter(Boolean).join(" · ") || "A definir";
  document.getElementById("heroGuests").textContent = `${confirmedGuests()} de ${state.guests.length}`;
  document.getElementById("heroSync").textContent = currentUser ? "Supabase" : "Local";
  document.getElementById("userChip").textContent = currentUser?.email || "Sem login";
}

function renderStats() {
  const doneTasks = state.tasks.filter((item) => item.done).length;
  const taskPct = state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) : 0;
  const pendingPurchases = state.purchases.filter((item) => !item.bought).length;
  const purchaseTotal = state.purchases
    .filter((item) => !item.bought)
    .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const thanked = state.gifts.filter((item) => item.thankYou).length;
  const receivedShower = state.shower.filter((item) => item.received).length;

  document.getElementById("statTasks").textContent = `${taskPct}%`;
  document.getElementById("statTasksSub").textContent = `${doneTasks} de ${state.tasks.length} concluídas`;
  document.getElementById("statPurchases").textContent = pendingPurchases;
  document.getElementById("statPurchasesSub").textContent = `${formatMoney(purchaseTotal)} previsto`;
  document.getElementById("statGifts").textContent = state.gifts.length;
  document.getElementById("statGiftsSub").textContent = `${thanked} agradecidos`;
  document.getElementById("statShower").textContent = state.shower.length;
  document.getElementById("statShowerSub").textContent = `${receivedShower} recebidos`;
}

function renderCollection(collection) {
  const meta = collectionMeta[collection];
  const list = document.getElementById(meta.list);
  const items = [...state[collection]].sort((a, b) => {
    const doneDiff = Number(meta.done(a)) - Number(meta.done(b));
    if (doneDiff) return doneDiff;
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  if (!items.length) {
    list.innerHTML = `<li class="empty-state">${meta.empty}</li>`;
    return;
  }

  list.innerHTML = items.map((item) => itemTemplate(collection, meta, item)).join("");
}

function itemTemplate(collection, meta, item) {
  const badge = meta.badge?.(item);
  const isDone = meta.done(item);
  const title = meta.title(item);
  const lines = meta.meta(item).filter(Boolean);

  return `
    <li class="item ${isDone ? "is-done" : ""}">
      <input class="check-input" type="checkbox" data-toggle="${collection}" data-id="${escapeAttr(item.id)}" ${isDone ? "checked" : ""} aria-label="Atualizar ${escapeAttr(title)}" />
      <div>
        <span class="item-title">${escapeHtml(title)}</span>
        <span class="item-meta">
          ${badge ? `<span class="badge ${badge[1]}">${escapeHtml(badge[0])}</span>` : ""}
          ${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
        </span>
      </div>
      <div class="item-actions">
        <button class="icon-button" type="button" data-delete="${collection}" data-id="${escapeAttr(item.id)}" title="Excluir" aria-label="Excluir ${escapeAttr(title)}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </li>
  `;
}

function renderPriorityList() {
  const openItems = [
    ...state.tasks.filter((item) => !item.done).map((item) => ({ title: item.title, meta: item.period || "Checklist" })),
    ...state.purchases.filter((item) => !item.bought).map((item) => ({ title: item.title, meta: item.category || "Compras" })),
    ...state.shower.filter((item) => !item.received).map((item) => ({ title: item.title, meta: "Chá de casa nova" })),
    ...state.budget.filter((item) => !item.paid && Number(item.actual || item.estimated || 0) > 0).map((item) => ({ title: item.description, meta: "Orçamento" }))
  ].slice(0, 7);

  const list = document.getElementById("priorityList");
  if (!openItems.length) {
    list.innerHTML = '<li class="empty-state">Tudo encaminhado por enquanto.</li>';
    return;
  }

  list.innerHTML = openItems.map((item) => `
    <li class="item">
      <span class="badge info">Aberto</span>
      <div>
        <span class="item-title">${escapeHtml(item.title)}</span>
        <span class="item-meta"><span>${escapeHtml(item.meta)}</span></span>
      </div>
      <div></div>
    </li>
  `).join("");
}

function tickCountdown() {
  const target = new Date(state.settings.weddingDate).getTime();
  const diff = Math.max(0, target - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  document.getElementById("countDays").textContent = String(days);
  document.querySelectorAll("#countdownGrid strong").forEach((slot, index) => {
    slot.textContent = String([hours, minutes, seconds][index]).padStart(2, "0");
  });
}

async function initSupabase() {
  if (!configuredSupabase) {
    setSyncStatus("Modo local");
    return;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data } = await supabase.auth.getSession();
    currentUser = data.session?.user || null;
    updateAuthUi();

    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateAuthUi();
      if (currentUser) loadRemoteState();
      if (!currentUser) stopRealtime();
    });

    if (currentUser) {
      await loadRemoteState();
    } else {
      setSyncStatus("Supabase pronto");
    }
  } catch (error) {
    console.error(error);
    setSyncStatus("Modo local");
    showToast("Supabase não conectou.");
  }
}

async function handleAuthSubmit(form, action) {
  if (!configuredSupabase || !supabase) {
    showToast("Preencha o Supabase em supabase-config.js.");
    return;
  }

  const formData = new FormData(form);
  const email = clean(formData.get("email"));
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    showToast("Informe e-mail e senha.");
    return;
  }

  setSyncStatus("Conectando...");
  const request = action === "signup"
    ? supabase.auth.signUp({ email, password })
    : supabase.auth.signInWithPassword({ email, password });
  const { error } = await request;

  if (error) {
    setSyncStatus("Erro no login");
    showToast(error.message);
    return;
  }

  form.reset();
  showToast(action === "signup" ? "Conta criada." : "Login feito.");
}

async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  currentUser = null;
  stopRealtime();
  updateAuthUi();
  showToast("Sessão encerrada.");
}

function updateAuthUi() {
  renderHero();
  if (currentUser) {
    setSyncStatus("Sincronizando");
  } else {
    setSyncStatus(configuredSupabase ? "Supabase pronto" : "Modo local");
  }
}

async function loadRemoteState() {
  if (!supabase || !currentUser) return;

  setSyncStatus("Carregando dados");
  const { data, error } = await supabase
    .from("wedding_state")
    .select("data, updated_at")
    .eq("couple_id", COUPLE_ID)
    .maybeSingle();

  if (error) {
    console.error(error);
    setSyncStatus("Sem permissão");
    showToast("Confira os membros no Supabase.");
    return;
  }

  if (data?.data) {
    lastRemoteStamp = data.updated_at || "";
    state = hydrateState(data.data);
    saveLocalState();
    render();
  } else {
    await saveRemoteNow();
  }

  startRealtime();
  setSyncStatus("Sincronizado");
}

function queueRemoteSave() {
  if (!supabase || !currentUser) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRemoteNow, 500);
}

async function saveRemoteNow() {
  if (!supabase || !currentUser) return;

  const payload = {
    couple_id: COUPLE_ID,
    data: state,
    updated_by: currentUser.id
  };

  const { data, error } = await supabase
    .from("wedding_state")
    .upsert(payload, { onConflict: "couple_id" })
    .select("updated_at")
    .single();

  if (error) {
    console.error(error);
    setSyncStatus("Erro ao salvar");
    showToast("Supabase não salvou.");
    return;
  }

  lastRemoteStamp = data?.updated_at || "";
  setSyncStatus("Sincronizado");
}

function startRealtime() {
  if (!supabase || remoteChannel) return;
  remoteChannel = supabase
    .channel(`wedding-state-${COUPLE_ID}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "wedding_state", filter: `couple_id=eq.${COUPLE_ID}` },
      (payload) => {
        const stamp = payload.new?.updated_at || "";
        if (!payload.new?.data || stamp === lastRemoteStamp) return;
        lastRemoteStamp = stamp;
        state = hydrateState(payload.new.data);
        saveLocalState();
        render();
        setSyncStatus("Sincronizado");
      }
    )
    .subscribe();
}

function stopRealtime() {
  if (remoteChannel && supabase) {
    supabase.removeChannel(remoteChannel);
  }
  remoteChannel = null;
}

function setSyncStatus(value) {
  document.getElementById("syncStatus").textContent = value;
  document.getElementById("heroSync").textContent = currentUser ? "Supabase" : "Local";
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alisson-brenda-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = hydrateState(JSON.parse(String(reader.result)));
      persist("Dados importados.");
    } catch {
      showToast("Arquivo inválido.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function labelFor(collection) {
  const labels = {
    notes: "lembretes",
    tasks: "checklist",
    guests: "convidados",
    shower: "chá de casa nova",
    gifts: "presentes",
    purchases: "compras",
    budget: "orçamento",
    vendors: "fornecedores"
  };
  return labels[collection] || "lista";
}

function confirmedGuests() {
  return state.guests.filter((item) => item.confirmed === "Sim").length;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function moneyNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function clean(value) {
  return String(value ?? "").trim();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
  if (!value) return "A definir";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function paintIcons() {
  window.lucide?.createIcons();
}
