import { fightMultipliers, settleFight } from "./settle.js";
import { matchingContacts, rememberContact } from "./contacts.js";
import { supabaseConfig } from "./supabase-config.js";
import { createCloudStore } from "./cloud.js";

const STORAGE_KEY = "apuestas-locales";
const CONTACTS_KEY = "apuestas-contactos";

const board = document.querySelector("#board");
const archiveBoard = document.querySelector("#archive-board");
const archiveSection = document.querySelector("#archive-section");
const archiveLabel = document.querySelector("#archive-label");
const newFightForm = document.querySelector("#new-fight-form");
const newFightError = document.querySelector("#new-fight-error");

let fights = loadFights();
let contacts = loadContacts();
const cloudConfigured = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
let cloud = null;
let client = null;
let cloudReady = false;
let saving = false;
let checkpoint = null;
let poll = null;
const cloudStatus = document.querySelector("#cloud-status");
const loginForm = document.querySelector("#login-form");
const recoveryForm = document.querySelector("#recovery-form");
let recovering = new URLSearchParams(location.hash.slice(1)).get("type") === "recovery" ||
  sessionStorage.getItem("club-password-recovery") === "true";
const recoveryRedirect = "https://reencabj.github.io/apuestasredsrow/";
const refreshButton = document.querySelector("#cloud-refresh");
const importButton = document.querySelector("#cloud-import");
const logoutButton = document.querySelector("#cloud-logout");

function canChange() {
  return !saving && (!cloudConfigured || cloudReady);
}

function drafts() {
  return [...board.querySelectorAll(".bet-form")].map((form) => ({
    id: fightFrom(form).id,
    name: form.nombre.value, phone: form.telefono.value, amount: form.monto.value,
    side: form.querySelector('[aria-pressed="true"]')?.dataset.side,
    focused: form.contains(document.activeElement) ? document.activeElement.name : null,
    start: form.contains(document.activeElement) ? document.activeElement.selectionStart : null,
    end: form.contains(document.activeElement) ? document.activeElement.selectionEnd : null,
  }));
}

function restoreDrafts(saved) {
  for (const draft of saved) {
    const card = [...board.children].find((node) => node.dataset.fightId === draft.id);
    const form = card?.querySelector(".bet-form");
    if (!form) continue;
    form.nombre.value = draft.name;
    form.telefono.value = draft.phone;
    form.monto.value = draft.amount;
    for (const button of form.querySelectorAll("[data-side]")) {
      button.setAttribute("aria-pressed", String(button.dataset.side === draft.side));
    }
    if (draft.focused) {
      const input = form.elements.namedItem(draft.focused);
      input?.focus();
      if (draft.start != null && input?.setSelectionRange) input.setSelectionRange(draft.start, draft.end);
    }
  }
}

function loadContacts() {
  let saved = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTACTS_KEY) || "[]");
    if (Array.isArray(parsed)) saved = parsed.filter((item) =>
      item && typeof item.name === "string" && typeof item.phone === "string");
  } catch {}
  let history = [];
  for (const fight of [...fights].reverse()) {
    for (const bet of fight.bets) history = rememberContact(history, bet.name, bet.phone);
  }
  for (const contact of [...saved].reverse()) {
    history = rememberContact(history, contact.name, contact.phone);
  }
  return history;
}

function loadFights() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveFights() {
  saving = true;
  try {
    if (cloudConfigured) {
      if (!cloudReady) throw new Error("Iniciá sesión antes de cargar apuestas.");
      cloudStatus.textContent = "Guardando…";
      await cloud.save(fights, contacts);
      checkpoint = structuredClone({ fights, contacts });
      cloudStatus.textContent = "Guardado online. Datos compartidos.";
      importButton.hidden = true;
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fights));
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    }
    return true;
  } catch (error) {
    const savedDrafts = drafts();
    if (checkpoint) ({ fights, contacts } = structuredClone(checkpoint));
    if (cloudConfigured) cloudStatus.textContent = `No se guardó el cambio. ${error.message || "Revisá la conexión e intentá nuevamente."}`;
    else showError(newFightError, "No se pudo guardar en este navegador.");
    render();
    restoreDrafts(savedDrafts);
    return false;
  } finally {
    saving = false;
  }
}

function money(amount) {
  return `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function showError(node, message) {
  node.hidden = false;
  node.textContent = message;
}

function sideTotal(fight, side) {
  return fight.bets
    .filter((bet) => bet.side === side)
    .reduce((sum, bet) => sum + bet.amount, 0);
}

function phoneNode(phone) {
  const callable = phone.replace(/[^\d+]/g, "");
  if (!callable) return el("span", "phone", phone);
  const link = el("a", "phone", phone);
  link.href = `tel:${callable}`;
  return link;
}

function oddsLabel(value) {
  if (value == null) return "sin apuestas";
  const digits = value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `paga ${digits}x`;
}

function renderSide(fight, side) {
  const box = el("div", `side ${side}`);
  if (fight.winner === side) box.classList.add("winner");
  const name = el("div", "name", fight[side]);
  const total = el("strong", "total", money(sideTotal(fight, side)));
  const rate = el("p", "multiplier", oddsLabel(fightMultipliers(fight.bets)[side]));
  box.append(name, total, rate);
  return box;
}

function renderBetForm(fight) {
  const form = el("form", "bet-form");
  form.innerHTML = `
    <label>Nombre <input name="nombre" autocomplete="off" placeholder="Escribí para buscar o cargar alguien nuevo" /></label>
    <div class="contact-suggestions" hidden aria-label="Personas guardadas"></div>
    <label>Teléfono <input name="telefono" type="tel" autocomplete="tel" /></label>
    <label>Monto <input name="monto" inputmode="numeric" /></label>
  `;
  const pick = el("div", "side-pick");
  for (const side of ["a", "b"]) {
    const button = el("button", null, fight[side]);
    button.type = "button";
    button.dataset.side = side;
    button.setAttribute("aria-pressed", "false");
    pick.append(button);
  }
  const submit = el("button", "primary", "Cargar apuesta");
  submit.type = "submit";
  const error = el("p", "error");
  error.hidden = true;
  form.append(pick, submit, error);
  return form;
}

function renderBet(bet, fight) {
  const item = el("li", "bet");
  const text = el("div");
  const who = el("p", "who", bet.name);
  const meta = el("p", "meta");
  meta.append(phoneNode(bet.phone), document.createTextNode(` · ${money(bet.amount)} · ${fight[bet.side]}`));
  text.append(who, meta);
  const remove = el("button", "ghost", "Borrar");
  remove.type = "button";
  remove.dataset.delete = bet.id;
  item.append(text, remove);
  return item;
}

function renderClose(fight) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Cerrar pelea";
  const actions = el("div", "close-actions");
  for (const side of ["a", "b"]) {
    const button = el("button", null, `Ganó ${fight[side]}`);
    button.type = "button";
    button.dataset.winner = side;
    actions.append(button);
  }
  details.append(summary, actions);
  return details;
}

function renderSettlement(fight) {
  const result = settleFight(fight.bets, fight.winner);
  const section = el("section", "settlement");
  const winner = el("h3", null, `Ganó ${fight[fight.winner]}`);
  section.append(winner);

  for (const [label, amount] of [
    ["Pozo", result.pool],
    ["Casa", result.house],
  ]) {
    const row = el("div", "summary");
    row.append(el("p", null, label), el("strong", null, money(amount)));
    section.append(row);
  }

  if (result.payouts.length === 0) {
    const notice = el(
      "p",
      "notice",
      result.pool === 0
        ? "No hubo apuestas."
        : "Nadie apostó al ganador. El pozo queda para la casa.",
    );
    section.append(notice);
  } else {
    const list = el("ul", "payouts");
    list.tabIndex = 0;
    list.setAttribute("aria-label", "Pagos de la pelea");
    for (const payout of result.payouts) {
      const item = el("li", "payout");
      const text = el("div");
      text.append(el("p", "who", payout.name), phoneNode(payout.phone));
      item.append(text, el("strong", "payout-amount", money(payout.amount)));
      list.append(item);
    }
    section.append(list);
  }

  const actions = el("div", "close-actions");
  if (!fight.archived) {
    const reopen = el("button", "quiet", "Reabrir");
    reopen.type = "button";
    reopen.dataset.reopen = "true";
    actions.append(reopen);
  }
  const archive = el("button", "quiet", fight.archived ? "Recuperar pelea" : "Archivar pelea");
  archive.type = "button";
  archive.dataset.archive = "true";
  actions.append(archive);
  section.append(actions);
  return section;
}

function renderCard(fight) {
  const card = el("article", fight.status === "closed" ? "card is-closed" : "card");
  card.dataset.fightId = fight.id;
  const sides = el("div", "sides");
  sides.append(renderSide(fight, "a"), renderSide(fight, "b"));
  card.append(sides);

  if (fight.status === "open") {
    card.append(el("p", "notice", "Pago estimado si gana, con el 10% de la casa descontado. Incluye lo apostado y cambia con cada apuesta."));
    card.append(renderBetForm(fight));
    if (fight.bets.length === 0) {
      card.append(el("p", "notice", "Todavía no hay apuestas."));
    } else {
      const list = el("ul", "bets");
      list.tabIndex = 0;
      list.setAttribute("aria-label", "Apuestas cargadas");
      for (const bet of [...fight.bets].reverse()) list.append(renderBet(bet, fight));
      card.append(list);
    }
    card.append(renderClose(fight));
  } else {
    card.append(renderSettlement(fight));
  }

  return card;
}

function render() {
  const current = fights.filter((fight) => !fight.archived);
  const archived = fights.filter((fight) => fight.archived);
  board.replaceChildren(...(current.length
    ? current.map(renderCard)
    : [el("p", "empty", "No hay peleas. Creá la primera arriba.")]));
  archiveSection.hidden = archived.length === 0;
  archiveLabel.textContent = `Peleas archivadas (${archived.length})`;
  archiveBoard.replaceChildren(...archived.map(renderCard));
}

function fightFrom(target) {
  const card = target.closest("[data-fight-id]");
  if (!card) return null;
  return fights.find((fight) => fight.id === card.dataset.fightId) || null;
}

newFightForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canChange()) return;
  const first = newFightForm.a.value.trim();
  const second = newFightForm.b.value.trim();
  if (!first || !second) {
    showError(newFightError, "Completá los dos nombres.");
    return;
  }
  if (first.toLocaleLowerCase("es") === second.toLocaleLowerCase("es")) {
    showError(newFightError, "Los dos nombres tienen que ser distintos.");
    return;
  }
  fights.unshift({
    id: crypto.randomUUID(),
    a: first,
    b: second,
    status: "open",
    winner: null,
    bets: [],
  });
  if (!await saveFights()) return;
  newFightForm.reset();
  newFightError.hidden = true;
  render();
});

async function handleFightClick(event) {
  if (!canChange()) return;
  const fight = fightFrom(event.target);
  if (fight && fight.status === "closed" && event.target.matches("[data-archive]")) {
    fight.archived = !fight.archived;
    if (!await saveFights()) return;
    render();
    return;
  }
  if (fight?.archived) return;
  if (!fight || fight.status !== "open") {
    if (fight && event.target.matches("[data-reopen]")) {
      fight.status = "open";
      fight.winner = null;
      if (!await saveFights()) return;
      render();
    }
    return;
  }

  const contactButton = event.target.closest("[data-contact]");
  if (contactButton) {
    const contact = contacts[Number(contactButton.dataset.contact)];
    if (!contact) return;
    const form = contactButton.closest("form");
    form.nombre.value = contact.name;
    form.telefono.value = contact.phone;
    form.querySelector(".contact-suggestions").hidden = true;
    form.monto.focus();
    return;
  }

  if (event.target.matches("[data-side]")) {
    const form = event.target.closest("form");
    for (const button of form.querySelectorAll("[data-side]")) {
      button.setAttribute("aria-pressed", String(button === event.target));
    }
    return;
  }

  if (event.target.matches("[data-delete]")) {
    fight.bets = fight.bets.filter((bet) => bet.id !== event.target.dataset.delete);
    if (!await saveFights()) return;
    render();
    return;
  }

  if (event.target.matches("[data-winner]")) {
    fight.status = "closed";
    fight.winner = event.target.dataset.winner;
    if (!await saveFights()) return;
    render();
  }
}

board.addEventListener("click", handleFightClick);
archiveBoard.addEventListener("click", handleFightClick);

function showContacts(input) {
  const form = input.closest(".bet-form");
  if (!form || input.name !== "nombre") return;
  const suggestions = form.querySelector(".contact-suggestions");
  const matches = matchingContacts(contacts, input.value);
  suggestions.replaceChildren(...matches.map((contact) => {
    const button = el("button", "contact-option");
    button.type = "button";
    button.dataset.contact = contacts.indexOf(contact);
    button.append(el("strong", null, contact.name), el("span", null, contact.phone));
    return button;
  }));
  suggestions.hidden = matches.length === 0;
}

board.addEventListener("input", (event) => showContacts(event.target));
board.addEventListener("focusin", (event) => showContacts(event.target));
board.addEventListener("focusout", (event) => {
  const form = event.target.closest(".bet-form");
  if (form && !form.contains(event.relatedTarget)) {
    form.querySelector(".contact-suggestions").hidden = true;
  }
});
board.addEventListener("keydown", (event) => {
  const form = event.target.closest(".bet-form");
  if (form && event.key === "Escape") form.querySelector(".contact-suggestions").hidden = true;
});

board.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.matches(".bet-form")) return;
  event.preventDefault();
  if (!canChange()) return;
  const fight = fightFrom(form);
  if (!fight || fight.status !== "open") return;

  const error = form.querySelector(".error");
  const name = form.nombre.value.trim();
  const phone = form.telefono.value.trim();
  const amountText = form.monto.value.trim();
  const sideButton = form.querySelector('[aria-pressed="true"]');
  const parsedAmount = /^[1-9]\d*$/.test(amountText) ? Number(amountText) : 0;
  const amount = Number.isSafeInteger(parsedAmount) &&
    Number.isSafeInteger(parsedAmount + fight.bets.reduce((sum, bet) => sum + bet.amount, 0))
    ? parsedAmount : 0;

  if (!name || !phone || !amount || !sideButton) {
    showError(error, "Completá nombre, teléfono, monto y a quién va.");
    return;
  }

  fight.bets.push({
    id: crypto.randomUUID(),
    name,
    phone,
    amount,
    side: sideButton.dataset.side,
  });
  contacts = rememberContact(contacts, name, phone);
  if (!await saveFights()) return;
  render();
});

function showCloudAccess(ready) {
  cloudReady = ready;
  document.querySelector(".new-fight").hidden = !ready;
  document.querySelector(".board-heading").hidden = !ready;
  board.hidden = !ready;
  loginForm.hidden = ready;
  refreshButton.hidden = !ready;
  logoutButton.hidden = !ready;
  if (!ready) {
    board.replaceChildren();
    archiveBoard.replaceChildren();
    archiveSection.hidden = true;
    importButton.hidden = true;
  }
}

async function refreshCloud() {
  if (saving || !cloud || recovering) return;
  saving = true;
  try {
    const data = await cloud.load();
    const savedDrafts = drafts();
    const changed = !checkpoint || JSON.stringify(checkpoint) !== JSON.stringify({ fights: data.fights, contacts: data.contacts });
    fights = data.fights;
    contacts = data.contacts;
    checkpoint = structuredClone({ fights, contacts });
    showCloudAccess(true);
    if (changed) { render(); restoreDrafts(savedDrafts); }
    importButton.hidden = fights.length > 0 || contacts.length > 0 ||
      (loadFights().length === 0 && !localStorage.getItem(CONTACTS_KEY));
    cloudStatus.textContent = "Conectado. Datos compartidos; actualización cada 5 segundos.";
  } catch (error) {
    if (error.code === "42501" || error.code === "PGRST116") showCloudAccess(false);
    cloudStatus.textContent = "No se pudo actualizar. Revisá la conexión, la instalación y la autorización de tu cuenta.";
  } finally { saving = false; }
}

async function initializeCloud() {
  document.querySelector("#cloud-panel").hidden = false;
  showCloudAccess(false);
  cloudStatus.textContent = "Conectando con Supabase…";
  try {
    if (!supabaseConfig.url || !supabaseConfig.publishableKey ||
        supabaseConfig.publishableKey.startsWith("sb_secret_")) {
      throw new Error("Completá la URL y la clave pública en supabase-config.js.");
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.8");
    client = createClient(supabaseConfig.url, supabaseConfig.publishableKey);
    cloud = createCloudStore(client);
    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recovering = true;
        sessionStorage.setItem("club-password-recovery", "true");
        showCloudAccess(false);
        loginForm.hidden = true;
        recoveryForm.hidden = false;
        cloudStatus.textContent = "Elegí una nueva contraseña de al menos 8 caracteres.";
      }
      if (event === "SIGNED_OUT") {
        recovering = false;
        sessionStorage.removeItem("club-password-recovery");
        recoveryForm.hidden = true;
        clearInterval(poll);
        checkpoint = null;
        fights = []; contacts = [];
        showCloudAccess(false);
        cloudStatus.textContent = "Iniciá sesión con una cuenta autorizada.";
      }
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session && recovering) {
      sessionStorage.setItem("club-password-recovery", "true");
      loginForm.hidden = true;
      recoveryForm.hidden = false;
      cloudStatus.textContent = "Elegí una nueva contraseña de al menos 8 caracteres.";
    } else if (data.session) await refreshCloud();
    else if (recovering) {
      recovering = false;
      sessionStorage.removeItem("club-password-recovery");
      recoveryForm.hidden = true;
      loginForm.hidden = false;
      cloudStatus.textContent = "El enlace venció o ya fue usado. Pedí otro con Olvidé mi contraseña.";
    }
    else cloudStatus.textContent = "Iniciá sesión con una cuenta autorizada.";
    poll = setInterval(() => { if (cloudReady && !document.hidden) refreshCloud(); }, 5000);
  } catch (error) {
    cloudStatus.textContent = error.message || "No se pudo conectar con Supabase.";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client || saving) return;
  const submit = loginForm.querySelector("button");
  submit.disabled = true;
  try {
    const { error } = await client.auth.signInWithPassword({
      email: loginForm.email.value.trim(), password: loginForm.password.value,
    });
    loginForm.password.value = "";
    if (error) throw error;
    await refreshCloud();
    clearInterval(poll);
    poll = setInterval(() => { if (cloudReady && !document.hidden) refreshCloud(); }, 5000);
  } catch { cloudStatus.textContent = "No se pudo ingresar. Revisá email, contraseña y conexión."; }
  finally { submit.disabled = false; }
});
document.querySelector("#forgot-password").addEventListener("click", async () => {
  if (!client || !loginForm.email.reportValidity()) return;
  const button = document.querySelector("#forgot-password");
  button.disabled = true;
  try {
    const { error } = await client.auth.resetPasswordForEmail(loginForm.email.value.trim(), {
      redirectTo: recoveryRedirect,
    });
    if (error) throw error;
    cloudStatus.textContent = "Si el email tiene una cuenta, recibirás un enlace para elegir una nueva contraseña.";
  } catch { cloudStatus.textContent = "No se pudo pedir el enlace. Esperá un momento y probá de nuevo."; }
  finally { button.disabled = false; }
});
recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client || !recovering) return;
  const password = recoveryForm.newPassword.value;
  if (password !== recoveryForm.confirmPassword.value) {
    cloudStatus.textContent = "Las contraseñas no coinciden.";
    return;
  }
  const button = recoveryForm.querySelector("button");
  button.disabled = true;
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    recoveryForm.reset();
    recoveryForm.hidden = true;
    recovering = false;
    sessionStorage.removeItem("club-password-recovery");
    await refreshCloud();
  } catch { cloudStatus.textContent = "No se pudo cambiar la contraseña. Usá una distinta y segura; si el enlace venció, pedí otro."; }
  finally { button.disabled = false; }
});
refreshButton.addEventListener("click", refreshCloud);
logoutButton.addEventListener("click", async () => {
  if (saving) return;
  const { error } = await client.auth.signOut();
  if (error) cloudStatus.textContent = "No se pudo cerrar sesión. Intentá nuevamente.";
});
importButton.addEventListener("click", async () => {
  if (!canChange() || fights.length || contacts.length) return;
  fights = loadFights();
  contacts = loadContacts();
  if (await saveFights()) render();
});

if (cloudConfigured) initializeCloud();
else {
  render();
  if (supabaseConfig.url) {
    document.querySelector("#cloud-panel").hidden = false;
    cloudStatus.textContent = "Supabase pendiente de configuración. Por ahora los datos se guardan solo en este navegador.";
  }
}
