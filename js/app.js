// WordLab — vocabulary dashboard logic.
(function () {
  "use strict";

  const VOCAB = window.VOCAB || [];
  const STORE_KEY = "wordlab.v1";

  // ---- Persistent state -----------------------------------------------------
  const defaultState = {
    known: {},        // word -> true
    favourites: {},   // word -> true
    quizzes: [],       // { date, mode, total, correct }
    lastVisit: null,
    streak: 0
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? Object.assign({}, defaultState, JSON.parse(raw)) : Object.assign({}, defaultState);
    } catch (e) {
      return Object.assign({}, defaultState);
    }
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  const state = loadState();

  // ---- Streak tracking ------------------------------------------------------
  (function updateStreak() {
    const today = new Date().toDateString();
    if (state.lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      state.streak = state.lastVisit === yesterday ? (state.streak || 0) + 1 : 1;
      state.lastVisit = today;
      saveState();
    }
  })();

  // ---- Helpers --------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const categories = Array.from(new Set(VOCAB.map((w) => w.category))).sort();
  const diffLabel = { 1: "Foundation", 2: "Intermediate", 3: "Advanced" };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- Tab navigation -------------------------------------------------------
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".view").forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      $("#view-" + tab.dataset.view).classList.add("active");
      if (tab.dataset.view === "progress") renderProgress();
    });
  });

  // ---- Word of the day ------------------------------------------------------
  function renderWotd() {
    if (!VOCAB.length) return;
    const dayIndex = Math.floor(Date.now() / 86400000) % VOCAB.length;
    const w = VOCAB[dayIndex];
    $("#wotd").innerHTML =
      '<span class="wotd-tag">Word of the day</span>' +
      '<div class="wotd-word">' + esc(w.word) + ' <span class="wotd-pos">' + esc(w.pos) + '</span></div>' +
      '<div class="wotd-def">' + esc(w.definition) + '</div>' +
      '<div class="wotd-eg">&ldquo;' + esc(w.example) + '&rdquo;</div>';
  }

  // ---- Learn view -----------------------------------------------------------
  function populateCategorySelects() {
    const opts = '<option value="">All categories</option>' +
      categories.map((c) => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join("");
    $("#filter-category").innerHTML = opts;
    $("#quiz-category").innerHTML = opts;
  }

  function cardHTML(w) {
    const isKnown = !!state.known[w.word];
    const isFav = !!state.favourites[w.word];
    const syn = w.synonyms && w.synonyms.length
      ? '<div class="syn"><b>Synonyms:</b> ' + esc(w.synonyms.join(", ")) + '</div>' : "";
    return '<div class="card' + (isKnown ? " known" : "") + '" data-word="' + esc(w.word) + '">' +
      '<div class="card-top"><span class="word">' + esc(w.word) + '</span>' +
      '<span class="pos">' + esc(w.pos) + '</span></div>' +
      '<div class="def">' + esc(w.definition) + '</div>' +
      '<div class="eg">&ldquo;' + esc(w.example) + '&rdquo;</div>' +
      syn +
      '<div class="badges"><span class="badge cat">' + esc(w.category) + '</span>' +
      '<span class="badge d' + w.difficulty + '">' + diffLabel[w.difficulty] + '</span></div>' +
      '<div class="card-actions">' +
      '<button class="chip js-fav' + (isFav ? " active-fav" : "") + '">' + (isFav ? "★ Favourite" : "☆ Favourite") + '</button>' +
      '<button class="chip js-known' + (isKnown ? " active-known" : "") + '">' + (isKnown ? "✓ Known" : "Mark known") + '</button>' +
      '</div></div>';
  }

  function renderLearn() {
    const q = $("#search").value.trim().toLowerCase();
    const cat = $("#filter-category").value;
    const diff = $("#filter-difficulty").value;
    const favOnly = $("#filter-fav").checked;

    const filtered = VOCAB.filter((w) => {
      if (cat && w.category !== cat) return false;
      if (diff && String(w.difficulty) !== diff) return false;
      if (favOnly && !state.favourites[w.word]) return false;
      if (q) {
        const hay = (w.word + " " + w.definition + " " + (w.synonyms || []).join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    $("#learn-count").textContent = filtered.length + " of " + VOCAB.length + " words";
    $("#word-list").innerHTML = filtered.length
      ? filtered.map(cardHTML).join("")
      : '<p class="empty">No words match your filters.</p>';
  }

  // Delegated clicks for favourite / known toggles
  $("#word-list").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const word = card.dataset.word;
    if (e.target.classList.contains("js-fav")) {
      if (state.favourites[word]) delete state.favourites[word];
      else state.favourites[word] = true;
      saveState();
      renderLearn();
    } else if (e.target.classList.contains("js-known")) {
      if (state.known[word]) delete state.known[word];
      else state.known[word] = true;
      saveState();
      renderLearn();
    }
  });

  ["search", "filter-category", "filter-difficulty", "filter-fav"].forEach((id) => {
    const el = $("#" + id);
    el.addEventListener(el.tagName === "INPUT" && el.type === "search" ? "input" : "change", renderLearn);
  });

  // ---- Quiz engine ----------------------------------------------------------
  let quiz = null;

  function buildQuestions(mode, category, count) {
    let pool = VOCAB.filter((w) => !category || w.category === category);
    // fill-blank needs an example containing the word
    pool = shuffle(pool);
    const questions = [];
    for (const w of pool) {
      if (questions.length >= count) break;
      let type = mode === "mixed"
        ? ["def-to-word", "word-to-def", "fill-blank"][Math.floor(Math.random() * 3)]
        : mode;
      if (type === "fill-blank" && !blankable(w)) type = "def-to-word";
      questions.push(makeQuestion(w, type));
    }
    return questions;
  }

  function blankable(w) {
    return new RegExp("\\b" + escapeRe(w.word) + "\\b", "i").test(w.example);
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function distractors(correct, key, n) {
    const pool = shuffle(VOCAB.filter((w) => w[key] !== correct[key]));
    return pool.slice(0, n).map((w) => w[key]);
  }

  function makeQuestion(w, type) {
    if (type === "word-to-def") {
      const options = shuffle([w.definition].concat(distractors(w, "definition", 3)));
      return { type, word: w, label: "What does this word mean?", prompt: w.word + "  (" + w.pos + ")", options, answer: w.definition };
    }
    if (type === "fill-blank") {
      const blanked = w.example.replace(new RegExp("\\b" + escapeRe(w.word) + "\\b", "i"), "———");
      const options = shuffle([w.word].concat(distractors(w, "word", 3)));
      return { type, word: w, label: "Which word fills the gap?", prompt: "“" + blanked + "”", options, answer: w.word };
    }
    // def-to-word (default)
    const options = shuffle([w.word].concat(distractors(w, "word", 3)));
    return { type: "def-to-word", word: w, label: "Which word matches this definition?", prompt: w.definition, options, answer: w.word };
  }

  function startQuiz() {
    const mode = $("#quiz-mode").value;
    const category = $("#quiz-category").value;
    const count = parseInt($("#quiz-length").value, 10);
    const questions = buildQuestions(mode, category, count);
    if (!questions.length) return;
    quiz = { questions, idx: 0, correct: 0, mode, answers: [] };
    $("#quiz-setup").classList.add("hidden");
    $("#quiz-results").classList.add("hidden");
    $("#quiz-active").classList.remove("hidden");
    renderQuestion();
  }

  function renderQuestion() {
    const qq = quiz.questions[quiz.idx];
    $("#quiz-counter").textContent = "Question " + (quiz.idx + 1) + " of " + quiz.questions.length;
    $("#quiz-score").textContent = "Score: " + quiz.correct;
    $("#quiz-bar").style.width = (quiz.idx / quiz.questions.length * 100) + "%";
    $("#quiz-prompt-label").textContent = qq.label;
    $("#quiz-prompt").innerHTML = esc(qq.prompt);
    $("#quiz-feedback").textContent = "";
    $("#quiz-feedback").className = "quiz-feedback";
    $("#quiz-next").classList.add("hidden");
    $("#quiz-choices").innerHTML = qq.options
      .map((o) => '<button class="choice">' + esc(o) + "</button>").join("");
    $$("#quiz-choices .choice").forEach((btn) => {
      btn.addEventListener("click", () => answerQuestion(btn, qq));
    });
  }

  function answerQuestion(btn, qq) {
    const chosen = btn.textContent;
    const isRight = chosen === qq.answer;
    $$("#quiz-choices .choice").forEach((b) => {
      b.disabled = true;
      if (b.textContent === qq.answer) b.classList.add("correct");
      else if (b === btn) b.classList.add("wrong");
    });
    const fb = $("#quiz-feedback");
    if (isRight) {
      quiz.correct++;
      fb.className = "quiz-feedback right";
      fb.innerHTML = "✓ Correct!" + '<span class="fb-eg">' + esc(qq.word.word) + ": " + esc(qq.word.definition) + "</span>";
    } else {
      fb.className = "quiz-feedback incorrect";
      fb.innerHTML = "✗ Answer: <b>" + esc(qq.answer) + "</b>" + '<span class="fb-eg">“' + esc(qq.word.example) + "”</span>";
    }
    quiz.answers.push({ word: qq.word.word, definition: qq.word.definition, right: isRight });
    $("#quiz-score").textContent = "Score: " + quiz.correct;
    $("#quiz-next").classList.remove("hidden");
    $("#quiz-next").textContent = quiz.idx + 1 >= quiz.questions.length ? "See results →" : "Next →";
  }

  $("#quiz-next").addEventListener("click", () => {
    quiz.idx++;
    if (quiz.idx >= quiz.questions.length) finishQuiz();
    else renderQuestion();
  });

  function finishQuiz() {
    const total = quiz.questions.length;
    const pct = Math.round(quiz.correct / total * 100);
    state.quizzes.unshift({ date: new Date().toISOString(), mode: quiz.mode, total, correct: quiz.correct });
    state.quizzes = state.quizzes.slice(0, 20);
    saveState();

    $("#quiz-active").classList.add("hidden");
    $("#quiz-results").classList.remove("hidden");
    $("#quiz-final-score").innerHTML = "You scored <b>" + quiz.correct + " / " + total + "</b> (" + pct + "%) &mdash; " + verdict(pct);
    $("#quiz-review").innerHTML = quiz.answers.map((a) =>
      '<div class="review-row ' + (a.right ? "hit" : "miss") + '">' +
      (a.right ? "✓ " : "✗ ") + "<b>" + esc(a.word) + "</b> &mdash; " + esc(a.definition) + "</div>"
    ).join("");
  }

  function verdict(pct) {
    if (pct === 100) return "flawless!";
    if (pct >= 80) return "excellent work.";
    if (pct >= 60) return "solid &mdash; review the misses.";
    return "keep practising, you'll get there.";
  }

  $("#quiz-start").addEventListener("click", startQuiz);
  $("#quiz-restart").addEventListener("click", () => {
    $("#quiz-results").classList.add("hidden");
    $("#quiz-setup").classList.remove("hidden");
  });

  // ---- Progress view --------------------------------------------------------
  function renderProgress() {
    const knownCount = Object.keys(state.known).length;
    const favCount = Object.keys(state.favourites).length;
    const quizCount = state.quizzes.length;
    $("#stat-total").textContent = VOCAB.length;
    $("#stat-known").textContent = knownCount;
    $("#stat-fav").textContent = favCount;
    $("#stat-quizzes").textContent = quizCount;
    $("#stat-streak").textContent = state.streak || 0;

    const totals = state.quizzes.reduce((acc, q) => {
      acc.t += q.total; acc.c += q.correct; return acc;
    }, { t: 0, c: 0 });
    $("#stat-accuracy").textContent = totals.t ? Math.round(totals.c / totals.t * 100) + "%" : "0%";

    // Mastery by category
    $("#category-progress").innerHTML = categories.map((c) => {
      const words = VOCAB.filter((w) => w.category === c);
      const known = words.filter((w) => state.known[w.word]).length;
      const pct = Math.round(known / words.length * 100);
      return '<div class="cat-row"><div class="cat-head"><span>' + esc(c) + "</span><span>" +
        known + " / " + words.length + "</span></div>" +
        '<div class="bar"><div style="width:' + pct + '%"></div></div></div>';
    }).join("");

    // Recent quizzes
    $("#quiz-history").innerHTML = quizCount
      ? state.quizzes.map((q) => {
          const pct = Math.round(q.correct / q.total * 100);
          const d = new Date(q.date);
          const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
            d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          return '<div class="hist-row"><span>' + when + " &middot; " + esc(modeName(q.mode)) +
            '</span><span class="pct">' + q.correct + "/" + q.total + " (" + pct + "%)</span></div>";
        }).join("")
      : '<p class="empty">No quizzes yet &mdash; take one to start tracking.</p>';
  }

  function modeName(m) {
    return { "def-to-word": "Definition → word", "word-to-def": "Word → definition", "fill-blank": "Fill the blank", "mixed": "Mixed" }[m] || m;
  }

  $("#reset-progress").addEventListener("click", () => {
    if (!confirm("Reset all progress? This clears known words, favourites and quiz history.")) return;
    state.known = {}; state.favourites = {}; state.quizzes = [];
    saveState();
    renderProgress();
    renderLearn();
  });

  // ---- Init -----------------------------------------------------------------
  populateCategorySelects();
  renderWotd();
  renderLearn();
})();
