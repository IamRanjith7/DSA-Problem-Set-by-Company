(() => {
  const FAANG_PLUS = new Set([
    "facebook",
    "google",
    "amazon",
    "apple",
    "netflix",
    "microsoft",
    "uber",
    "nvidia",
  ]);
  const PAGE_SIZE = 100;
  const SOLVED_STORAGE_KEY = "lc_explorer_solved_v1";
  const THEME_STORAGE_KEY = "lc_explorer_theme_v1";

  const state = {
    dataset: null,
    companyBySlug: new Map(),
    problemToCompanies: new Map(),
    selectedCompanies: new Set(["facebook"]),
    companySearch: "",
    matchAllSelected: false,
    problemSearch: "",
    difficulty: "ALL",
    topic: "",
    access: "ALL",
    solvedFilter: "ALL",
    sortBy: "frequency_desc",
    page: 1,
    solvedSlugs: new Set(),
  };

  const els = {
    sidebar: document.getElementById("sidebar"),
    sidebarBackdrop: document.getElementById("sidebarBackdrop"),
    openSidebarBtn: document.getElementById("openSidebarBtn"),
    closeSidebarBtn: document.getElementById("closeSidebarBtn"),
    companySearch: document.getElementById("companySearch"),
    presetFaang: document.getElementById("presetFaang"),
    presetAll: document.getElementById("presetAll"),
    presetClear: document.getElementById("presetClear"),
    selectedCountLabel: document.getElementById("selectedCountLabel"),
    matchModeToggle: document.getElementById("matchModeToggle"),
    companyList: document.getElementById("companyList"),
    activeHeading: document.getElementById("activeHeading"),
    activeSubheading: document.getElementById("activeSubheading"),
    statsPills: document.getElementById("statsPills"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    problemSearch: document.getElementById("problemSearch"),
    diffButtons: Array.from(document.querySelectorAll(".difficulty-pills .pill")),
    topicFilter: document.getElementById("topicFilter"),
    accessFilter: document.getElementById("accessFilter"),
    solvedFilter: document.getElementById("solvedFilter"),
    sortSelect: document.getElementById("sortSelect"),
    activeCompanyChips: document.getElementById("activeCompanyChips"),
    problemsBody: document.getElementById("problemsBody"),
    emptyState: document.getElementById("emptyState"),
    emptyMessage: document.getElementById("emptyMessage"),
    resetFiltersBtn: document.getElementById("resetFiltersBtn"),
    paginationInfo: document.getElementById("paginationInfo"),
    prevPageBtn: document.getElementById("prevPageBtn"),
    nextPageBtn: document.getElementById("nextPageBtn"),
    pageIndicator: document.getElementById("pageIndicator"),
  };

  function loadLocalPrefs() {
    try {
      const savedSolved = JSON.parse(localStorage.getItem(SOLVED_STORAGE_KEY) || "[]");
      if (Array.isArray(savedSolved)) {
        state.solvedSlugs = new Set(savedSolved);
      }
    } catch (_) {}

    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        applyTheme(savedTheme);
      }
    } catch (_) {}
  }

  function saveSolved() {
    try {
      localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify([...state.solvedSlugs]));
    } catch (_) {}
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    els.themeToggleBtn.textContent = theme === "dark" ? "☀" : "☾";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {}
  }

  function toggleSidebar(open) {
    els.sidebar.classList.toggle("open", open);
    els.sidebarBackdrop.classList.toggle("hidden", !open);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildIndexes(data) {
    const topics = new Set();
    for (const company of data.companies) {
      state.companyBySlug.set(company.slug, company);
      for (const entry of company.problems) {
        if (!state.problemToCompanies.has(entry.slug)) {
          state.problemToCompanies.set(entry.slug, []);
        }
        state.problemToCompanies.get(entry.slug).push({
          slug: company.slug,
          name: company.name,
          frequency: entry.frequency,
        });
      }
    }

    for (const problem of Object.values(data.problems)) {
      for (const t of problem.topics || []) {
        topics.add(t);
      }
    }

    const sortedTopics = [...topics].sort((a, b) => a.localeCompare(b));
    for (const topic of sortedTopics) {
      const opt = document.createElement("option");
      opt.value = topic;
      opt.textContent = topic;
      els.topicFilter.appendChild(opt);
    }

    // Default to first available company if facebook wasn't present
    if (!state.companyBySlug.has("facebook") && data.companies.length > 0) {
      state.selectedCompanies = new Set([data.companies[0].slug]);
    }
  }

  function renderSidebar() {
    const q = state.companySearch.trim().toLowerCase();
    const companies = state.dataset.companies.filter((c) =>
      !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );

    els.selectedCountLabel.textContent = `${state.selectedCompanies.size} of ${state.dataset.companies.length} selected`;

    const frag = document.createDocumentFragment();
    for (const company of companies) {
      const isSelected = state.selectedCompanies.has(company.slug);
      const li = document.createElement("li");
      li.className = `company-item${isSelected ? " selected" : ""}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(isSelected));
      li.dataset.slug = company.slug;

      li.innerHTML = `
        <span class="company-left">
          <input class="company-checkbox" type="checkbox" ${isSelected ? "checked" : ""} tabindex="-1" aria-hidden="true" />
          <span class="company-name">${escapeHtml(company.name)}</span>
        </span>
        <span class="company-count">${company.count}</span>
      `;
      frag.appendChild(li);
    }

    els.companyList.innerHTML = "";
    els.companyList.appendChild(frag);
  }

  function renderActiveChips() {
    if (state.selectedCompanies.size === 0 || state.selectedCompanies.size > 10) {
      els.activeCompanyChips.innerHTML = "";
      return;
    }
    const frag = document.createDocumentFragment();
    for (const slug of state.selectedCompanies) {
      const c = state.companyBySlug.get(slug);
      if (!c) continue;
      const chip = document.createElement("span");
      chip.className = "company-chip";
      chip.innerHTML = `
        <span>${escapeHtml(c.name)}</span>
        <button type="button" data-remove-slug="${escapeHtml(slug)}" aria-label="Remove ${escapeHtml(c.name)}">✕</button>
      `;
      frag.appendChild(chip);
    }
    els.activeCompanyChips.innerHTML = "";
    els.activeCompanyChips.appendChild(frag);
  }

  function getMatchingProblems() {
    const selected = [...state.selectedCompanies];
    if (selected.length === 0) return [];

    const freqByProblem = new Map();
    const matchedCompaniesByProblem = new Map();

    for (const cSlug of selected) {
      const company = state.companyBySlug.get(cSlug);
      if (!company) continue;
      for (const entry of company.problems) {
        if (!matchedCompaniesByProblem.has(entry.slug)) {
          matchedCompaniesByProblem.set(entry.slug, []);
          freqByProblem.set(entry.slug, entry.frequency);
        } else if (entry.frequency > freqByProblem.get(entry.slug)) {
          freqByProblem.set(entry.slug, entry.frequency);
        }
        matchedCompaniesByProblem.get(entry.slug).push({
          slug: company.slug,
          name: company.name,
          frequency: entry.frequency,
        });
      }
    }

    const search = state.problemSearch.trim().toLowerCase();
    const diffRank = { Easy: 1, Medium: 2, Hard: 3 };
    const rows = [];

    for (const [pSlug, matchedCompanies] of matchedCompaniesByProblem.entries()) {
      if (state.matchAllSelected && matchedCompanies.length < selected.length) {
        continue;
      }
      const p = state.dataset.problems[pSlug];
      if (!p) continue;

      if (state.difficulty !== "ALL" && p.difficulty !== state.difficulty) continue;
      if (state.access === "FREE" && p.paidOnly) continue;
      if (state.access === "PAID" && !p.paidOnly) continue;
      if (state.topic && !(p.topics || []).includes(state.topic)) continue;

      const isSolved = state.solvedSlugs.has(pSlug);
      if (state.solvedFilter === "SOLVED" && !isSolved) continue;
      if (state.solvedFilter === "UNSOLVED" && isSolved) continue;

      if (search) {
        const hay = `${p.id} ${p.title} ${(p.topics || []).join(" ")}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }

      matchedCompanies.sort((a, b) => b.frequency - a.frequency);
      rows.push({
        problem: p,
        frequency: freqByProblem.get(pSlug) || 0,
        matchedCompanies,
        allCompanies: state.problemToCompanies.get(pSlug) || matchedCompanies,
        isSolved,
      });
    }

    rows.sort((a, b) => {
      switch (state.sortBy) {
        case "companies_desc":
          if (b.matchedCompanies.length !== a.matchedCompanies.length) {
            return b.matchedCompanies.length - a.matchedCompanies.length;
          }
          return b.frequency - a.frequency;
        case "ac_desc":
          return (b.problem.acRate ?? -1) - (a.problem.acRate ?? -1);
        case "difficulty_asc":
          if (diffRank[a.problem.difficulty] !== diffRank[b.problem.difficulty]) {
            return diffRank[a.problem.difficulty] - diffRank[b.problem.difficulty];
          }
          return b.frequency - a.frequency;
        case "id_asc":
          return (parseInt(a.problem.id, 10) || 999999) - (parseInt(b.problem.id, 10) || 999999);
        case "frequency_desc":
        default:
          if (b.frequency !== a.frequency) return b.frequency - a.frequency;
          if (b.matchedCompanies.length !== a.matchedCompanies.length) {
            return b.matchedCompanies.length - a.matchedCompanies.length;
          }
          return (parseInt(a.problem.id, 10) || 999999) - (parseInt(b.problem.id, 10) || 999999);
      }
    });

    return rows;
  }

  function renderMain() {
    const selected = [...state.selectedCompanies];
    if (selected.length === 0) {
      els.activeHeading.textContent = "No companies selected";
      els.activeSubheading.textContent = "Toggle one or more companies in the left panel";
    } else if (selected.length === 1) {
      const c = state.companyBySlug.get(selected[0]);
      els.activeHeading.textContent = c ? c.name : selected[0];
      els.activeSubheading.textContent = "Last 6 months · sorted by interview frequency";
    } else if (selected.length === state.dataset.companies.length) {
      els.activeHeading.textContent = `All ${selected.length} Companies`;
      els.activeSubheading.textContent = state.matchAllSelected
        ? "Problems appearing in all selected companies (last 6 months)"
        : "Combined problems across all 50 companies (last 6 months)";
    } else {
      els.activeHeading.textContent = `${selected.length} Companies Selected`;
      els.activeSubheading.textContent = state.matchAllSelected
        ? "Intersection: problems appearing in every selected company"
        : "Union: problems appearing in any selected company";
    }

    renderActiveChips();

    const rows = getMatchingProblems();
    let easy = 0;
    let medium = 0;
    let hard = 0;
    for (const r of rows) {
      if (r.problem.difficulty === "Easy") easy++;
      else if (r.problem.difficulty === "Medium") medium++;
      else if (r.problem.difficulty === "Hard") hard++;
    }

    els.statsPills.innerHTML = `
      <span class="stat-pill">Total: <strong>${rows.length}</strong></span>
      <span class="stat-pill easy">Easy: ${easy}</span>
      <span class="stat-pill medium">Med: ${medium}</span>
      <span class="stat-pill hard">Hard: ${hard}</span>
    `;

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const startIdx = (state.page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(startIdx, startIdx + PAGE_SIZE);

    if (rows.length === 0) {
      els.problemsBody.innerHTML = "";
      els.emptyState.classList.remove("hidden");
      els.emptyMessage.textContent =
        selected.length === 0
          ? "Select at least one company on the left to view its 6-month problems."
          : "No problems match your current filters.";
    } else {
      els.emptyState.classList.add("hidden");
      const frag = document.createDocumentFragment();
      for (const row of pageRows) {
        const p = row.problem;
        const tr = document.createElement("tr");
        if (row.isSolved) tr.className = "is-solved";

        const topicsHtml = (p.topics || [])
          .slice(0, 4)
          .map((t) => `<span class="topic-tag">${escapeHtml(t)}</span>`)
          .join("");

        const showCompanies = row.matchedCompanies.slice(0, 3);
        const extraCount = row.matchedCompanies.length - showCompanies.length;
        const tooltipText = row.matchedCompanies
          .map((c) => `${c.name}: ${c.frequency.toFixed(1)}%`)
          .join("\n");

        const companyBadgesHtml =
          showCompanies
            .map(
              (c) =>
                `<span class="company-mini" title="${escapeHtml(c.name)}: ${c.frequency.toFixed(1)}%">${escapeHtml(c.name)}</span>`
            )
            .join("") +
          (extraCount > 0
            ? `<span class="company-mini" title="${escapeHtml(tooltipText)}">+${extraCount}</span>`
            : "");

        const acText = p.acRate != null ? `${p.acRate.toFixed(1)}%` : "—";
        const freqWidth = Math.max(0, Math.min(100, row.frequency));

        tr.innerHTML = `
          <td class="col-done">
            <input type="checkbox" class="solved-check" data-slug="${escapeHtml(p.slug)}" ${row.isSolved ? "checked" : ""} aria-label="Mark ${escapeHtml(p.title)} solved" />
          </td>
          <td class="col-id">${escapeHtml(p.id)}</td>
          <td class="col-title">
            <div class="title-row">
              <a class="problem-link" href="https://leetcode.com/problems/${encodeURIComponent(p.slug)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title)}</a>
              ${p.paidOnly ? '<span class="lock-badge">Premium</span>' : ""}
            </div>
            ${topicsHtml ? `<div class="topic-row">${topicsHtml}</div>` : ""}
          </td>
          <td class="col-diff"><span class="diff-badge ${escapeHtml(p.difficulty)}">${escapeHtml(p.difficulty)}</span></td>
          <td class="col-ac">${acText}</td>
          <td class="col-freq" title="${escapeHtml(tooltipText)}">
            <div class="freq-cell">
              <div class="freq-bar-track"><div class="freq-bar-fill" style="width:${freqWidth}%"></div></div>
              <span class="freq-val">${row.frequency.toFixed(1)}%</span>
            </div>
          </td>
          <td class="col-companies" title="${escapeHtml(tooltipText)}">
            <div class="company-badges">${companyBadgesHtml}</div>
          </td>
        `;
        frag.appendChild(tr);
      }
      els.problemsBody.innerHTML = "";
      els.problemsBody.appendChild(frag);
    }

    const from = rows.length === 0 ? 0 : startIdx + 1;
    const to = Math.min(rows.length, startIdx + pageRows.length);
    els.paginationInfo.textContent = `Showing ${from}–${to} of ${rows.length} problems`;
    els.pageIndicator.textContent = `Page ${state.page} / ${totalPages}`;
    els.prevPageBtn.disabled = state.page <= 1;
    els.nextPageBtn.disabled = state.page >= totalPages;
  }

  function wireEvents() {
    els.openSidebarBtn.addEventListener("click", () => toggleSidebar(true));
    els.closeSidebarBtn.addEventListener("click", () => toggleSidebar(false));
    els.sidebarBackdrop.addEventListener("click", () => toggleSidebar(false));

    els.themeToggleBtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(cur === "dark" ? "light" : "dark");
    });

    els.companySearch.addEventListener("input", (e) => {
      state.companySearch = e.target.value;
      renderSidebar();
    });

    els.companyList.addEventListener("click", (e) => {
      const item = e.target.closest(".company-item");
      if (!item) return;
      const slug = item.dataset.slug;
      if (state.selectedCompanies.has(slug)) {
        state.selectedCompanies.delete(slug);
      } else {
        state.selectedCompanies.add(slug);
      }
      state.page = 1;
      renderSidebar();
      renderMain();
    });

    els.activeCompanyChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-slug]");
      if (!btn) return;
      state.selectedCompanies.delete(btn.dataset.removeSlug);
      state.page = 1;
      renderSidebar();
      renderMain();
    });

    els.presetFaang.addEventListener("click", () => {
      state.selectedCompanies = new Set(
        state.dataset.companies.filter((c) => FAANG_PLUS.has(c.slug)).map((c) => c.slug)
      );
      state.page = 1;
      renderSidebar();
      renderMain();
    });

    els.presetAll.addEventListener("click", () => {
      state.selectedCompanies = new Set(state.dataset.companies.map((c) => c.slug));
      state.page = 1;
      renderSidebar();
      renderMain();
    });

    els.presetClear.addEventListener("click", () => {
      state.selectedCompanies.clear();
      state.page = 1;
      renderSidebar();
      renderMain();
    });

    els.matchModeToggle.addEventListener("change", (e) => {
      state.matchAllSelected = e.target.checked;
      state.page = 1;
      renderMain();
    });

    els.problemSearch.addEventListener("input", (e) => {
      state.problemSearch = e.target.value;
      state.page = 1;
      renderMain();
    });

    for (const btn of els.diffButtons) {
      btn.addEventListener("click", () => {
        for (const b of els.diffButtons) b.classList.remove("active");
        btn.classList.add("active");
        state.difficulty = btn.dataset.diff;
        state.page = 1;
        renderMain();
      });
    }

    els.topicFilter.addEventListener("change", (e) => {
      state.topic = e.target.value;
      state.page = 1;
      renderMain();
    });

    els.accessFilter.addEventListener("change", (e) => {
      state.access = e.target.value;
      state.page = 1;
      renderMain();
    });

    els.solvedFilter.addEventListener("change", (e) => {
      state.solvedFilter = e.target.value;
      state.page = 1;
      renderMain();
    });

    els.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      state.page = 1;
      renderMain();
    });

    els.problemsBody.addEventListener("change", (e) => {
      if (!e.target.classList.contains("solved-check")) return;
      const slug = e.target.dataset.slug;
      if (e.target.checked) {
        state.solvedSlugs.add(slug);
      } else {
        state.solvedSlugs.delete(slug);
      }
      saveSolved();
      const row = e.target.closest("tr");
      if (row) row.classList.toggle("is-solved", e.target.checked);
    });

    els.resetFiltersBtn.addEventListener("click", () => {
      state.problemSearch = "";
      state.difficulty = "ALL";
      state.topic = "";
      state.access = "ALL";
      state.solvedFilter = "ALL";
      state.matchAllSelected = false;
      els.problemSearch.value = "";
      els.topicFilter.value = "";
      els.accessFilter.value = "ALL";
      els.solvedFilter.value = "ALL";
      els.matchModeToggle.checked = false;
      for (const b of els.diffButtons) {
        b.classList.toggle("active", b.dataset.diff === "ALL");
      }
      if (state.selectedCompanies.size === 0 && state.dataset.companies.length > 0) {
        state.selectedCompanies.add(state.dataset.companies[0].slug);
      }
      state.page = 1;
      renderSidebar();
      renderMain();
    });

    els.prevPageBtn.addEventListener("click", () => {
      if (state.page > 1) {
        state.page--;
        renderMain();
      }
    });

    els.nextPageBtn.addEventListener("click", () => {
      state.page++;
      renderMain();
    });
  }

  async function init() {
    loadLocalPrefs();
    wireEvents();
    try {
      const resp = await fetch("./data/companies.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      state.dataset = await resp.json();
      buildIndexes(state.dataset);
      renderSidebar();
      renderMain();
    } catch (err) {
      els.activeHeading.textContent = "Failed to load dataset";
      els.activeSubheading.textContent = String(err);
      els.emptyState.classList.remove("hidden");
      els.emptyMessage.textContent =
        "Could not load ./data/companies.json. Serve this folder over HTTP (or GitHub Pages).";
    }
  }

  init();
})();
