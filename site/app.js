const STORAGE_KEY = "frontierhuman:v2";
const THEME_KEY = "frontierhuman:theme";
const LETTERS = ["A", "B", "C", "D"];

const VERDICTS = [
  { min: 17, name: "Agent-level intent detection" },
  { min: 13, name: "Strong collaborator" },
  { min: 9, name: "Context-aware" },
  { min: 5, name: "Literal-leaning" },
  { min: 0, name: "Literal reader" }
];

const app = document.getElementById("app");
let data = null;
let state = loadState();
let reviewFilter = "all";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { answers: {}, index: 0, finished: false };
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function resetState() {
  state = { answers: {}, index: 0, finished: false };
  saveState();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

function render(view) {
  app.replaceChildren(view);
  window.scrollTo(0, 0);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function turnHtml(who, text, cls = "") {
  return `<div class="turn ${cls}"><div class="who">${who}</div><div class="text">${esc(text)}</div></div>`;
}

function chatHtml(item) {
  const history = (item.history || []).map((m) => turnHtml(m.who === "user" ? "Human" : "Agent", m.text, "past")).join("");
  return `<div class="chat">${history}${turnHtml("Agent", item.question)}${turnHtml("Human", item.reply, "reply")}</div>`;
}

/* ---------- Theme ---------- */

const themeBtn = document.getElementById("theme");

function syncThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  themeBtn.setAttribute("aria-pressed", String(dark));
}

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  syncThemeButton();
});

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch {}
  if (saved) return;
  document.documentElement.dataset.theme = e.matches ? "dark" : "light";
  syncThemeButton();
});

syncThemeButton();

/* ---------- Intro ---------- */

function renderIntro() {
  const answered = Object.keys(state.answers).length;
  const total = data.items.length;
  const secondary = state.finished
    ? `<button class="btn" data-go="report">Report</button>`
    : answered > 0
      ? `<button class="btn" data-go="resume">Resume ${pad(answered)}/${total}</button>`
      : "";

  render(
    el(`
    <section class="intro">
      <h1>What did they <mark>mean?</mark></h1>
      <div class="demo box">
        <div class="chat">
          ${turnHtml("Agent", "Should I delete the old migration?")}
          ${turnHtml("Human", "or", "reply")}
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-accent btn-xl" data-go="start">Start ${total} →</button>
        ${secondary}
      </div>
    </section>
  `)
  );
}

/* ---------- Exam ---------- */

function renderQuestion() {
  const total = data.items.length;
  const i = Math.min(state.index, total - 1);
  const item = data.items[i];
  const selected = state.answers[item.id];

  const cells = data.items
    .map((it, k) => `<i class="${k === i ? "now" : state.answers[it.id] !== undefined ? "done" : ""}"></i>`)
    .join("");

  render(
    el(`
    <section>
      <div class="exam-top">
        <div class="counter">${pad(i + 1)}<small>/${total}</small></div>
        <div class="cells" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Object.keys(state.answers).length}">${cells}</div>
      </div>

      <div class="q box">
        <div class="context">${esc(item.context)}</div>
        ${chatHtml(item)}
        <div class="options" role="radiogroup" aria-label="Interpretations">
          ${item.options
            .map(
              (o, k) => `
            <button class="option ${selected === k ? "selected" : ""}" role="radio" aria-checked="${selected === k}" data-opt="${k}">
              <span class="letter">${LETTERS[k]}</span><span class="label">${esc(o)}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>

      <div class="exam-nav">
        <button class="btn" data-go="prev" aria-label="Previous question" ${i === 0 ? "disabled" : ""}>←</button>
        <button class="btn btn-accent" data-go="next" ${selected === undefined ? "disabled" : ""}>${i === total - 1 ? "Finish" : "Next →"}</button>
      </div>
    </section>
  `)
  );
}

function choose(k) {
  const item = data.items[state.index];
  state.answers[item.id] = k;
  saveState();
  app.querySelectorAll(".option").forEach((b) => {
    const on = Number(b.dataset.opt) === k;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-checked", String(on));
  });
  const next = app.querySelector('[data-go="next"]');
  if (next) next.disabled = false;
}

function next() {
  const item = data.items[state.index];
  if (state.answers[item.id] === undefined) return;
  if (state.index < data.items.length - 1) {
    state.index += 1;
    saveState();
    renderQuestion();
  } else {
    state.finished = true;
    saveState();
    renderReport();
  }
}

function prev() {
  if (state.index > 0) {
    state.index -= 1;
    saveState();
    renderQuestion();
  }
}

/* ---------- Report ---------- */

function scoreFor(pick) {
  return data.items.reduce((s, it) => s + (pick(it) === it.correct ? 1 : 0), 0);
}

function groupScores(key) {
  const groups = {};
  for (const it of data.items) {
    const g = (groups[it[key]] ||= { n: 0, you: 0 });
    g.n += 1;
    if (state.answers[it.id] === it.correct) g.you += 1;
  }
  return groups;
}

function verdictFor(score) {
  return VERDICTS.find((v) => score >= v.min);
}

function meterRow(name, value, max, cls = "") {
  return `<div class="row ${cls}"><div class="name">${esc(name)}</div><div class="meter"><span style="width:${(value / max) * 100}%"></span></div><div class="val">${value}/${max}</div></div>`;
}

function breakdownHtml(groups, labels) {
  return Object.keys(labels)
    .filter((k) => groups[k])
    .map((k) => meterRow(labels[k].label, groups[k].you, groups[k].n))
    .join("");
}

function renderReport() {
  const total = data.items.length;
  const you = scoreFor((it) => state.answers[it.id]);
  const literal = scoreFor((it) => it.literal);
  const verdict = verdictFor(you);

  render(
    el(`
    <section>
      <div class="score">
        <div class="num" aria-label="${you} of ${total}">${you}<small>/${total}</small></div>
        <div class="verdict">${esc(verdict.name)}</div>
      </div>

      <h2 class="h2">vs.</h2>
      <div class="table">
        ${meterRow("You", you, total, "you")}
        ${meterRow("Strong agent", total, total)}
        ${meterRow("Literal reader", literal, total)}
      </div>

      <div class="split">
        <div>
          <h2 class="h2">Category</h2>
          <div class="table">${breakdownHtml(groupScores("category"), data.categories)}</div>
        </div>
        <div>
          <h2 class="h2">Difficulty</h2>
          <div class="table">${breakdownHtml(groupScores("difficulty"), data.difficulties)}</div>
        </div>
      </div>

      <h2 class="h2">Review</h2>
      <div class="filters">
        <button data-filter="all" class="${reviewFilter === "all" ? "on" : ""}" aria-label="All items">All</button>
        <button data-filter="missed" class="${reviewFilter === "missed" ? "on" : ""}" aria-label="Missed items">✕ ${total - you}</button>
        <button data-filter="correct" class="${reviewFilter === "correct" ? "on" : ""}" aria-label="Correct items">✓ ${you}</button>
      </div>
      <div class="review" id="review">${reviewHtml()}</div>

      <div class="report-actions">
        <button class="btn btn-accent" data-go="retake">Retake</button>
        <button class="btn" data-go="copy">Copy</button>
      </div>
    </section>
  `)
  );
}

function reviewHtml() {
  return data.items
    .map((it, i) => {
      const pick = state.answers[it.id];
      const ok = pick === it.correct;
      if (reviewFilter === "missed" && ok) return "";
      if (reviewFilter === "correct" && !ok) return "";
      const opts = it.options
        .map((o, k) => {
          const cls = k === it.correct ? "correct" : k === pick ? "wrong" : "";
          const tag = k === it.correct ? "✓" : k === pick ? "✕" : "";
          return `<div class="opt ${cls}"><span class="letter">${LETTERS[k]}</span><span class="label">${esc(o)}</span><span class="tag" aria-label="${k === it.correct ? "intended" : k === pick ? "your pick" : ""}">${tag}</span></div>`;
        })
        .join("");
      return `
      <details class="item ${ok ? "hit" : "miss"}">
        <summary>
          <span class="n">${pad(i + 1)}</span>
          <span class="mark" aria-label="${ok ? "correct" : "missed"}">${ok ? "✓" : "✕"}</span>
          <span class="r">${esc(it.reply)}</span>
          <span class="pick">${pick === undefined ? "–" : LETTERS[pick]}</span>
        </summary>
        <div class="body">
          <div class="context">${esc(it.context)}</div>
          ${chatHtml(it)}
          <div class="opts">${opts}</div>
          <div class="cue">${esc(it.cue)}</div>
          <p class="why">${esc(it.explanation)}</p>
        </div>
      </details>`;
    })
    .join("");
}

function copyResult() {
  const total = data.items.length;
  const you = scoreFor((it) => state.answers[it.id]);
  const grid = data.items.map((it) => (state.answers[it.id] === it.correct ? "■" : "□")).join("");
  const text = `FrontierHuman ${you}/${total} · ${verdictFor(you).name}\n${grid}\n${location.origin}${location.pathname}`;
  navigator.clipboard?.writeText(text).then(
    () => toast("Copied"),
    () => toast("Copy failed")
  );
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1400);
}

/* ---------- Events ---------- */

app.addEventListener("click", (e) => {
  const opt = e.target.closest("[data-opt]");
  if (opt) return choose(Number(opt.dataset.opt));

  const filter = e.target.closest("[data-filter]");
  if (filter) {
    reviewFilter = filter.dataset.filter;
    app.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("on", b === filter));
    document.getElementById("review").innerHTML = reviewHtml();
    return;
  }

  const go = e.target.closest("[data-go]");
  if (!go) return;
  switch (go.dataset.go) {
    case "start":
      resetState();
      renderQuestion();
      break;
    case "resume":
      renderQuestion();
      break;
    case "report":
      renderReport();
      break;
    case "next":
      next();
      break;
    case "prev":
      prev();
      break;
    case "retake":
      resetState();
      reviewFilter = "all";
      renderIntro();
      break;
    case "copy":
      copyResult();
      break;
  }
});

document.querySelector('[data-action="home"]').addEventListener("click", (e) => {
  e.preventDefault();
  if (data) renderIntro();
});

document.addEventListener("keydown", (e) => {
  if (!app.querySelector(".options")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest("button") && e.key === "Enter") return;
  const n = "1234".indexOf(e.key);
  const l = e.key.length === 1 ? "abcd".indexOf(e.key.toLowerCase()) : -1;
  if (n >= 0) choose(n);
  else if (l >= 0) choose(l);
  else if (e.key === "Enter") next();
  else if (e.key === "ArrowLeft") prev();
});

/* ---------- Boot ---------- */

async function boot() {
  try {
    const res = await fetch("data/items.json", { cache: "no-cache" });
    data = await res.json();
  } catch {
    app.textContent = "Couldn't load the exam.";
    return;
  }
  const params = new URLSearchParams(location.search);
  if (params.has("reset")) resetState();
  if (state.finished && params.get("view") === "report") renderReport();
  else renderIntro();
}

boot();
