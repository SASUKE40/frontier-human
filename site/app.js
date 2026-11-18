const STORAGE_KEY = "frontierhuman:v1";
const LETTERS = ["A", "B", "C", "D"];

const VERDICTS = [
  { min: 18, name: "Agent-level intent detection", desc: "You bind terse replies to the right referent, keep earlier constraints in mind, and read tone without over-reading plain answers. This is what a strong agent does." },
  { min: 14, name: "Strong collaborator", desc: "You recover intent most of the time. The misses are usually on the hard items: recap reordering, mixed labels, or a constraint from many turns back." },
  { min: 10, name: "Context-aware, literal-leaning", desc: "You use context, but you sometimes take the words at face value when tone or an earlier constraint should override them." },
  { min: 6, name: "Literal reader", desc: "You mostly answer the words, not the person. Sarcasm, hedges, and \"whatever's simpler\" tend to lead you to the surface reading." },
  { min: 0, name: "Lost in the conversation", desc: "Short replies are throwing you off. Try tracking what each label, pronoun, and earlier constraint refers to before choosing." }
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

function difficultyChip(d) {
  return `<span class="chip ${esc(d)}">${esc(data.difficulties[d].label)}</span>`;
}

function categoryChip(c) {
  return `<span class="chip">${esc(data.categories[c].label)}</span>`;
}

function chatHtml(item) {
  const history = (item.history || [])
    .map((m) => `<div class="bubble ${m.who === "user" ? "user" : "agent"} faded"><span class="who">${m.who === "user" ? "Human" : "Agent"}</span>${esc(m.text)}</div>`)
    .join("");
  return `
    <div class="chat">
      ${history}
      <div class="bubble agent"><span class="who">Agent</span>${esc(item.question)}</div>
      <div class="bubble user reply"><span class="who">Human</span>${esc(item.reply)}</div>
    </div>`;
}

/* ---------- Intro ---------- */

function renderIntro() {
  const answered = Object.keys(state.answers).length;
  const total = data.items.length;
  const resume = state.finished
    ? `<p class="resume-note">You already finished. <button data-go="report">View your report</button></p>`
    : answered > 0
      ? `<p class="resume-note">You're ${answered}/${total} in. <button data-go="resume">Resume where you left off</button></p>`
      : "";

  const counts = data.items.reduce((acc, it) => ((acc[it.difficulty] = (acc[it.difficulty] || 0) + 1), acc), {});

  const view = el(`
    <section class="hero fade-in">
      <span class="eyebrow">Intent-detection benchmark</span>
      <h1>The agent asked <span class="grad">"A or B?"</span><br/>The human said "b".</h1>
      <p class="lead">Real people answer clarifying questions with "the second one", "yeah that", or "whatever's simpler". Strong agents still work out what was meant. FrontierHuman checks whether <em>you</em> can too.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-go="start">Start the exam →</button>
        <span class="hero-meta">${total} questions · ~8 minutes · ${counts.easy || 0} easy · ${counts.medium || 0} medium · ${counts.hard || 0} hard</span>
      </div>
      ${resume}

      <div class="demo-chat card">
        <div class="chat">
          <div class="bubble agent"><span class="who">Agent</span>For PDFs: Puppeteer (bundled locally) or a hosted API like DocRaptor? DocRaptor is simpler.</div>
          <div class="bubble user reply"><span class="who">Human</span>whatever's simpler</div>
          <div class="bubble agent faded"><span class="who">Strong agent</span>Puppeteer. You said earlier this runs on an air-gapped server, so the hosted API won't work there.</div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card feature"><div class="icon">1</div><h3>Read the exchange</h3><p>Each item has a short context, the agent's clarifying question, and the human's terse reply.</p></div>
        <div class="card feature"><div class="icon">2</div><h3>Pick the real intent</h3><p>Four interpretations, one correct. The others are known agent failure modes: literal, over-inferred, wrong referent, or a dropped constraint.</p></div>
        <div class="card feature"><div class="icon">3</div><h3>Get your report</h3><p>Score, category and difficulty breakdowns, a verdict, a comparison with a strong-agent baseline, and an explanation for every item.</p></div>
      </div>

      <div class="cats">
        ${Object.entries(data.categories).map(([, c]) => `<span class="chip" title="${esc(c.blurb)}">${esc(c.label)}</span>`).join("")}
      </div>
    </section>
  `);
  render(view);
}

/* ---------- Exam ---------- */

function renderQuestion() {
  const total = data.items.length;
  const i = Math.min(state.index, total - 1);
  const item = data.items[i];
  const selected = state.answers[item.id];
  const pct = Math.round((Object.keys(state.answers).length / total) * 100);

  const view = el(`
    <section class="fade-in">
      <div class="exam-head">
        <span>Question <strong>${i + 1}</strong> of ${total}</span>
        <div class="q-tags">${categoryChip(item.category)}${difficultyChip(item.difficulty)}</div>
      </div>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div style="width:${pct}%"></div></div>

      <div class="card">
        <p class="q-context"><strong>Context:</strong> ${esc(item.context)}</p>
        ${chatHtml(item)}
        <div class="prompt">What does the human actually want?</div>
        <div class="options" role="radiogroup">
          ${item.options
            .map(
              (o, k) => `
            <button class="option ${selected === k ? "selected" : ""}" role="radio" aria-checked="${selected === k}" data-opt="${k}">
              <span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span>
            </button>`
            )
            .join("")}
        </div>
        <div class="exam-actions">
          <button class="btn btn-ghost" data-go="prev" ${i === 0 ? "disabled" : ""}>← Back</button>
          <span class="hint"><span class="kbd">1</span>–<span class="kbd">4</span> to choose · <span class="kbd">Enter</span> to continue</span>
          <button class="btn btn-primary" data-go="next" ${selected === undefined ? "disabled" : ""}>${i === total - 1 ? "See my report" : "Next →"}</button>
        </div>
      </div>
    </section>
  `);
  render(view);
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
  const pct = Math.round((Object.keys(state.answers).length / data.items.length) * 100);
  const bar = app.querySelector(".progress > div");
  if (bar) bar.style.width = pct + "%";
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
    const g = (groups[it[key]] ||= { n: 0, you: 0, literal: 0 });
    g.n += 1;
    if (state.answers[it.id] === it.correct) g.you += 1;
    if (it.literal === it.correct) g.literal += 1;
  }
  return groups;
}

function verdictFor(score) {
  return VERDICTS.find((v) => score >= v.min);
}

function breakdownHtml(groups, labels, order) {
  return order
    .filter((k) => groups[k])
    .map((k) => {
      const g = groups[k];
      const pct = Math.round((g.you / g.n) * 100);
      return `
      <div class="breakdown-row">
        <div class="top"><span>${esc(labels[k].label)}</span><span>${g.you}/${g.n} · agent ${g.n}/${g.n}</span></div>
        <div class="dual-bar" title="You ${pct}% · strong agent 100%"><div class="fill" style="width:${pct}%"></div><div class="marker"></div></div>
      </div>`;
    })
    .join("");
}

function renderReport() {
  const total = data.items.length;
  const you = scoreFor((it) => state.answers[it.id]);
  const agent = total;
  const literal = scoreFor((it) => it.literal);
  const verdict = verdictFor(you);
  const pct = you / total;
  const circumference = 2 * Math.PI * 74;

  const literalTraps = data.items.filter((it) => state.answers[it.id] === it.literal && it.literal !== it.correct).length;
  const overReads = data.items.filter((it) => it.literal === it.correct && state.answers[it.id] !== it.correct).length;
  const hardItems = data.items.filter((it) => it.difficulty === "hard");
  const hardRight = hardItems.filter((it) => state.answers[it.id] === it.correct).length;

  const gap = agent - you;
  const compareLine =
    gap === 0
      ? "You matched the strong-agent baseline on every item."
      : `You're ${gap} item${gap === 1 ? "" : "s"} behind the strong-agent baseline and ${you >= literal ? `${you - literal} ahead of` : `${literal - you} behind`} the literal reader.`;

  const view = el(`
    <section class="fade-in">
      <div class="card report-hero">
        <div class="ring" aria-label="Score ${you} of ${total}">
          <svg width="170" height="170" viewBox="0 0 170 170">
            <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
            <circle cx="85" cy="85" r="74" fill="none" stroke="#1b2030" stroke-width="14"/>
            <circle cx="85" cy="85" r="74" fill="none" stroke="url(#g)" stroke-width="14" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - pct)}"/>
          </svg>
          <div class="ring-label"><div><div class="big">${you}<span style="font-size:22px;color:var(--muted)">/${total}</span></div><div class="small">${Math.round(pct * 100)}% correct</div></div></div>
        </div>
        <div>
          <span class="eyebrow">Your verdict</span>
          <div class="verdict-name">${esc(verdict.name)}</div>
          <p class="verdict-desc">${esc(verdict.desc)}</p>
          <div class="bands">
            ${[...VERDICTS].reverse().map((v) => `<span class="band ${v === verdict ? "active" : ""}">${esc(v.name)} ${v.min}+</span>`).join("")}
          </div>
        </div>
      </div>

      <h2 class="section-title">You vs. the baselines</h2>
      <div class="card">
        <div class="compare-row"><span class="name"><strong>You</strong></span><div class="bar"><div class="you" style="width:${(you / total) * 100}%"></div></div><span class="val">${you}/${total}</span></div>
        <div class="compare-row"><span class="name">Strong agent</span><div class="bar"><div class="agent" style="width:${(agent / total) * 100}%"></div></div><span class="val">${agent}/${total}</span></div>
        <div class="compare-row"><span class="name">Literal reader</span><div class="bar"><div class="literal" style="width:${(literal / total) * 100}%"></div></div><span class="val">${literal}/${total}</span></div>
        <p class="compare-note">${esc(compareLine)} The strong-agent reference answers every item from its cue (it is the answer key). The literal reader always picks the surface reading of the reply, which is right only when the human meant exactly what they said.</p>
        <div class="stat-grid">
          <div class="stat"><div class="n">${literalTraps}</div><div class="l">literal traps fallen into</div></div>
          <div class="stat"><div class="n">${overReads}</div><div class="l">plain answers over-read</div></div>
          <div class="stat"><div class="n">${hardRight}/${hardItems.length}</div><div class="l">hard items solved</div></div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <h2 class="section-title">By category</h2>
          <div class="card">${breakdownHtml(groupScores("category"), data.categories, Object.keys(data.categories))}</div>
        </div>
        <div>
          <h2 class="section-title">By difficulty</h2>
          <div class="card">${breakdownHtml(groupScores("difficulty"), data.difficulties, ["easy", "medium", "hard"])}</div>
        </div>
      </div>

      <h2 class="section-title">Item review</h2>
      <div class="review-controls">
        <div class="seg" role="tablist">
          <button data-filter="all" class="${reviewFilter === "all" ? "on" : ""}">All ${total}</button>
          <button data-filter="missed" class="${reviewFilter === "missed" ? "on" : ""}">Missed ${total - you}</button>
          <button data-filter="correct" class="${reviewFilter === "correct" ? "on" : ""}">Correct ${you}</button>
        </div>
        <button class="btn btn-ghost" data-go="expand" style="padding:8px 14px">Expand all</button>
      </div>
      <div id="review">${reviewHtml()}</div>

      <div class="report-actions">
        <button class="btn btn-primary" data-go="copy">Copy result</button>
        <button class="btn" data-go="retake">Retake exam</button>
        <a class="btn btn-ghost" href="https://github.com/SASUKE40/frontier-human/blob/main/research.md" target="_blank" rel="noopener">Read the research →</a>
      </div>
    </section>
  `);
  render(view);
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
          const tag = k === it.correct && k === pick ? "Your pick ✓" : k === it.correct ? "Intended" : k === pick ? "Your pick" : k === it.literal ? "Literal" : "";
          return `<div class="opt ${cls}"><span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span>${tag ? `<span class="tag">${tag}</span>` : ""}</div>`;
        })
        .join("");
      return `
      <details class="card review-item">
        <summary>
          <span class="status ${ok ? "ok" : "no"}">${ok ? "✓" : "✕"}</span>
          <span><span class="s-title">${i + 1}. Reply: <span class="r">"${esc(it.reply)}"</span></span><br/><span class="s-meta">${esc(data.categories[it.category].label)} · ${esc(data.difficulties[it.difficulty].label)}</span></span>
          <span class="s-meta">${pick === undefined ? "skipped" : `you: ${LETTERS[pick]}`}</span>
        </summary>
        <div class="body">
          <p class="q-context" style="margin-top:14px"><strong>Context:</strong> ${esc(it.context)}</p>
          ${chatHtml(it)}
          <div class="opt-list">${opts}</div>
          <div class="cue"><b>Cue:</b> ${esc(it.cue)}</div>
          <p>${esc(it.explanation)}</p>
          <p class="grounding">Research tie-in: ${esc(it.grounding)}</p>
        </div>
      </details>`;
    })
    .join("");
}

function copyResult() {
  const total = data.items.length;
  const you = scoreFor((it) => state.answers[it.id]);
  const v = verdictFor(you);
  const grid = data.items.map((it) => (state.answers[it.id] === it.correct ? "🟩" : "🟥")).join("");
  const text = `FrontierHuman ${you}/${total} · ${v.name}\n${grid}\n${location.origin}${location.pathname}`;
  navigator.clipboard?.writeText(text).then(
    () => toast("Copied to clipboard"),
    () => toast("Couldn't copy")
  );
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
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
    case "expand": {
      const items = app.querySelectorAll(".review-item");
      const open = [...items].some((d) => !d.open);
      items.forEach((d) => (d.open = open));
      go.textContent = open ? "Collapse all" : "Expand all";
      break;
    }
  }
});

document.querySelector('[data-action="home"]').addEventListener("click", (e) => {
  e.preventDefault();
  renderIntro();
});

document.addEventListener("keydown", (e) => {
  if (!app.querySelector(".options")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const n = "1234".indexOf(e.key);
  const l = "abcd".indexOf(e.key.toLowerCase());
  if (n >= 0) choose(n);
  else if (l >= 0 && e.key.length === 1) choose(l);
  else if (e.key === "Enter") next();
  else if (e.key === "ArrowLeft") prev();
});

/* ---------- Boot ---------- */

async function boot() {
  try {
    const res = await fetch("data/items.json", { cache: "no-cache" });
    data = await res.json();
  } catch (err) {
    app.innerHTML = `<p class="card">Couldn't load the exam items.</p>`;
    return;
  }
  const params = new URLSearchParams(location.search);
  if (params.has("reset")) resetState();
  if (state.finished && params.get("view") === "report") renderReport();
  else renderIntro();
}

boot();
