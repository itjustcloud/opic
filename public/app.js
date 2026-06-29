const state = {
  data: { version: 1, scripts: [] },
  fillersData: { version: 1, fillers: [] },
  selectedId: null,
  dirty: false,
  dataSource: "spreadsheet",
  mode: "study",
  studyIndex: 0,
  studyViewMode: "single",
  showEnglish: false
};

const scriptsSpreadsheetUrl =
  "https://docs.google.com/spreadsheets/d/1P2jZmJJv4t_AMjFEPbHFPqc5iKeHz_oPdnn8ktUpIiQ/edit?usp=sharing";
const scriptsSpreadsheetCsvUrl = buildGoogleSheetsCsvUrl(scriptsSpreadsheetUrl);

const elements = {
  addScriptButton: document.querySelector("#addScriptButton"),
  topicFilter: document.querySelector("#topicFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  searchInput: document.querySelector("#searchInput"),
  scriptList: document.querySelector("#scriptList"),
  sourceStatus: document.querySelector("#sourceStatus"),
  editTab: document.querySelector("#editTab"),
  studyTab: document.querySelector("#studyTab"),
  fillersTab: document.querySelector("#fillersTab"),
  editorView: document.querySelector("#editorView"),
  studyView: document.querySelector("#studyView"),
  fillersView: document.querySelector("#fillersView"),
  scriptForm: document.querySelector("#scriptForm"),
  titleInput: document.querySelector("#titleInput"),
  topicInput: document.querySelector("#topicInput"),
  typeInput: document.querySelector("#typeInput"),
  tagsInput: document.querySelector("#tagsInput"),
  topicOptions: document.querySelector("#topicOptions"),
  typeOptions: document.querySelector("#typeOptions"),
  addSentenceButton: document.querySelector("#addSentenceButton"),
  sentenceEditor: document.querySelector("#sentenceEditor"),
  sentenceTemplate: document.querySelector("#sentenceTemplate"),
  duplicateButton: document.querySelector("#duplicateButton"),
  deleteButton: document.querySelector("#deleteButton"),
  copyScriptJsonButton: document.querySelector("#copyScriptJsonButton"),
  scriptJsonTextarea: document.querySelector("#scriptJsonTextarea"),
  scriptJsonStatus: document.querySelector("#scriptJsonStatus"),
  studyMeta: document.querySelector("#studyMeta"),
  studyTitle: document.querySelector("#studyTitle"),
  studyCounter: document.querySelector("#studyCounter"),
  studySingleModeButton: document.querySelector("#studySingleModeButton"),
  studyFlowModeButton: document.querySelector("#studyFlowModeButton"),
  studyCard: document.querySelector("#studyCard"),
  studyFlow: document.querySelector("#studyFlow"),
  koreanPrompt: document.querySelector("#koreanPrompt"),
  noteBox: document.querySelector("#noteBox"),
  englishAnswer: document.querySelector("#englishAnswer"),
  fillerCategoryFilter: document.querySelector("#fillerCategoryFilter"),
  fillerSearchInput: document.querySelector("#fillerSearchInput"),
  fillersCounter: document.querySelector("#fillersCounter"),
  fillersList: document.querySelector("#fillersList"),
  prevSentenceButton: document.querySelector("#prevSentenceButton"),
  toggleEnglishButton: document.querySelector("#toggleEnglishButton"),
  nextSentenceButton: document.querySelector("#nextSentenceButton")
};

function createSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildGoogleSheetsCsvUrl(shareUrl) {
  const url = new URL(shareUrl);
  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/u);

  if (!match) {
    throw new Error("스프레드시트 주소에서 시트 ID를 찾지 못했습니다.");
  }

  const gidFromHash = url.hash.match(/gid=(\d+)/u)?.[1];
  const gid = url.searchParams.get("gid") || gidFromHash || "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

function parseCsv(text) {
  const rows = [];
  const source = text.replace(/^\uFEFF/u, "");
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === "\"") {
        if (source[index + 1] === "\"") {
          value += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.length > 0));
}

function hasSpreadsheetHeader(row = []) {
  return cleanText(row[0]) === "순번" && cleanText(row[1]) === "유형" && cleanText(row[2]) === "스크립트";
}

function buildScriptsDataFromSpreadsheet(rows) {
  const headerPresent = hasSpreadsheetHeader(rows[0]);
  const dataRows = headerPresent ? rows.slice(1) : rows;
  const usedIds = new Set();
  const scripts = [];

  dataRows.forEach((row, index) => {
    const cellValue = cleanText(row[2]);
    const sheetRowNumber = (headerPresent ? 2 : 1) + index;

    if (!cellValue) return;

    let parsed;
    try {
      parsed = JSON.parse(cellValue);
    } catch (error) {
      throw new Error(`스프레드시트 ${sheetRowNumber}행 C열 JSON 파싱 실패: ${error.message}`);
    }

    try {
      const script = assignUniqueIds([normalizeScriptShape(parsed, scripts.length)], usedIds)[0];
      scripts.push(script);
    } catch (error) {
      throw new Error(`스프레드시트 ${sheetRowNumber}행 C열 검증 실패: ${error.message}`);
    }
  });

  if (scripts.length === 0) {
    throw new Error("스프레드시트 C열에서 유효한 스크립트를 찾지 못했습니다.");
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    scripts
  };
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(cleanText).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [...new Set(value.split(",").map(cleanText).filter(Boolean))];
  }

  return [];
}

function normalizeSentence(value, index, title) {
  if (!value || typeof value !== "object") {
    throw new Error(`${title}: ${index + 1}번째 문장 형식이 올바르지 않습니다.`);
  }

  const korean = cleanText(value.korean);
  const english = cleanText(value.english);
  const note = cleanText(value.note);

  if (!korean || !english) {
    throw new Error(`${title}: ${index + 1}번째 문장의 한글/영어가 필요합니다.`);
  }

  return note ? { korean, english, note } : { korean, english };
}

function normalizeScriptShape(value, index = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${index + 1}번째 스크립트 형식이 올바르지 않습니다.`);
  }

  const title = cleanText(value.title);
  const topic = cleanText(value.topic);
  const type = cleanText(value.type);

  if (!title) throw new Error(`${index + 1}번째 스크립트 제목이 필요합니다.`);
  if (!topic) throw new Error(`${title}: 주제가 필요합니다.`);
  if (!type) throw new Error(`${title}: 유형이 필요합니다.`);
  if (!Array.isArray(value.sentences) || value.sentences.length === 0) {
    throw new Error(`${title}: 문장이 1개 이상 필요합니다.`);
  }

  const now = new Date().toISOString();
  const id = createSlug(cleanText(value.id) || title) || `script-${index + 1}`;

  return {
    id,
    title,
    topic,
    type,
    tags: normalizeTags(value.tags),
    createdAt: cleanText(value.createdAt) || now,
    updatedAt: cleanText(value.updatedAt) || now,
    sentences: value.sentences.map((sentence, sentenceIndex) =>
      normalizeSentence(sentence, sentenceIndex, title)
    )
  };
}

function assignUniqueIds(scripts, usedIds = new Set()) {
  return scripts.map((script, index) => {
    const baseId = createSlug(script.id || script.title) || `script-${index + 1}`;
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);
    return { ...script, id };
  });
}

function selectedScript() {
  return state.data.scripts.find((script) => script.id === state.selectedId) || null;
}

function renderSourceStatus() {
  const sourceLabel = state.dataSource === "backup" ? "백업 JSON 기준" : "스프레드시트 기준";
  elements.sourceStatus.textContent = state.dirty ? `${sourceLabel} · 임시 편집 중` : sourceLabel;
  elements.sourceStatus.classList.toggle("dirty", state.dirty);
  elements.sourceStatus.classList.remove("error");
}

function setDirty(isDirty = true) {
  state.dirty = isDirty;
  renderSourceStatus();
}

function setError(message) {
  elements.sourceStatus.textContent = message;
  elements.sourceStatus.classList.add("error");
}

function setScriptJsonStatus(message = "", isError = false) {
  elements.scriptJsonStatus.textContent = message;
  elements.scriptJsonStatus.classList.toggle("error", isError);
}

function defaultScriptJsonStatus() {
  if (!selectedScript()) return "";
  return state.dirty
    ? "수정됨. 복사 후 스프레드시트 C열에 붙여넣으세요."
    : "복사해서 스프레드시트 C열에 붙여넣으세요.";
}

function updateScriptJsonView(status = defaultScriptJsonStatus()) {
  const script = selectedScript();
  const hasScript = Boolean(script);
  elements.scriptJsonTextarea.disabled = !hasScript;
  elements.copyScriptJsonButton.disabled = !hasScript;

  if (!hasScript) {
    elements.scriptJsonTextarea.value = "";
    setScriptJsonStatus("");
    return;
  }

  elements.scriptJsonTextarea.value = JSON.stringify(script, null, 2);
  setScriptJsonStatus(status);
}

function uniqueValues(key) {
  return [...new Set(state.data.scripts.map((script) => script[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

function renderSelect(select, values, allLabel) {
  const current = select.value;
  select.replaceChildren(new Option(allLabel, ""));
  values.forEach((value) => select.append(new Option(value, value)));
  select.value = values.includes(current) ? current : "";
}

function renderDatalist(list, values) {
  list.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    return option;
  }));
}

function filteredScripts() {
  const topic = elements.topicFilter.value;
  const type = elements.typeFilter.value;
  const query = elements.searchInput.value.trim().toLowerCase();

  return state.data.scripts.filter((script) => {
    const matchesTopic = !topic || script.topic === topic;
    const matchesType = !type || script.type === type;
    const haystack = [
      script.title,
      script.topic,
      script.type,
      ...(script.tags || []),
      ...script.sentences.flatMap((sentence) => [sentence.korean, sentence.english, sentence.note || ""])
    ]
      .join(" ")
      .toLowerCase();
    return matchesTopic && matchesType && (!query || haystack.includes(query));
  });
}

function fillerCategories() {
  return [...new Set(state.fillersData.fillers.map((filler) => filler.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

function filteredFillers() {
  const category = elements.fillerCategoryFilter.value;
  const query = elements.fillerSearchInput.value.trim().toLowerCase();

  return state.fillersData.fillers.filter((filler) => {
    const matchesCategory = !category || filler.category === category;
    const haystack = [
      filler.category,
      filler.english,
      filler.korean,
      filler.usage,
      filler.level
    ]
      .join(" ")
      .toLowerCase();

    return matchesCategory && (!query || haystack.includes(query));
  });
}

function renderFilters() {
  const topics = uniqueValues("topic");
  const types = uniqueValues("type");
  renderSelect(elements.topicFilter, topics, "전체 주제");
  renderSelect(elements.typeFilter, types, "전체 유형");
  renderDatalist(elements.topicOptions, topics);
  renderDatalist(elements.typeOptions, types);
}

function renderFillerFilters() {
  renderSelect(elements.fillerCategoryFilter, fillerCategories(), "전체 상황");
}

function renderScriptList() {
  const scripts = filteredScripts();

  if (scripts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "표시할 스크립트가 없습니다.";
    elements.scriptList.replaceChildren(empty);
    return;
  }

  const nodes = scripts.map((script) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "script-item";
    button.classList.toggle("active", script.id === state.selectedId);
    button.addEventListener("click", () => {
      commitEditor();
      state.selectedId = script.id;
      state.studyIndex = 0;
      state.showEnglish = false;
      state.mode = "study";
      renderAll();
      scrollStudyIntoView();
    });

    const title = document.createElement("div");
    title.className = "script-title";
    title.textContent = script.title;

    const meta = document.createElement("div");
    meta.className = "script-meta";
    [script.topic, script.type, `${script.sentences.length}문장`, ...(script.tags || [])].forEach((value) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = value;
      meta.append(chip);
    });

    button.append(title, meta);
    return button;
  });

  elements.scriptList.replaceChildren(...nodes);
}

function scrollStudyIntoView() {
  requestAnimationFrame(() => {
    elements.studyView.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  });
}

function renderFillers() {
  const fillers = filteredFillers();
  elements.fillersCounter.textContent = String(fillers.length);

  if (fillers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "표시할 필러가 없습니다.";
    elements.fillersList.replaceChildren(empty);
    return;
  }

  const nodes = fillers.map((filler) => {
    const card = document.createElement("article");
    card.className = "filler-card";

    const english = document.createElement("p");
    english.className = "filler-english";
    english.textContent = filler.english;

    const korean = document.createElement("p");
    korean.className = "filler-korean";
    korean.textContent = filler.korean;

    const usage = document.createElement("p");
    usage.className = "filler-usage";
    usage.textContent = filler.usage;

    const actions = document.createElement("div");
    actions.className = "filler-actions";

    const tags = document.createElement("div");
    tags.className = "filler-tags";
    [filler.category, filler.level].filter(Boolean).forEach((value) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = value;
      tags.append(chip);
    });

    actions.append(tags);
    card.append(english, korean, usage, actions);
    return card;
  });

  elements.fillersList.replaceChildren(...nodes);
}

function renderEditor() {
  const script = selectedScript();
  const hasScript = Boolean(script);
  elements.scriptForm.toggleAttribute("inert", !hasScript);
  elements.addSentenceButton.disabled = !hasScript;
  elements.duplicateButton.disabled = !hasScript;
  elements.deleteButton.disabled = !hasScript;

  if (!script) {
    elements.titleInput.value = "";
    elements.topicInput.value = "";
    elements.typeInput.value = "";
    elements.tagsInput.value = "";
    elements.sentenceEditor.replaceChildren();
    updateScriptJsonView();
    return;
  }

  elements.titleInput.value = script.title;
  elements.topicInput.value = script.topic;
  elements.typeInput.value = script.type;
  elements.tagsInput.value = (script.tags || []).join(", ");

  const sentenceNodes = script.sentences.map((sentence, index) => {
    const node = elements.sentenceTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".sentence-number").textContent = index + 1;
    node.querySelector(".sentence-korean").value = sentence.korean;
    node.querySelector(".sentence-english").value = sentence.english;
    node.querySelector(".sentence-note").value = sentence.note || "";
    node.querySelector(".move-up").disabled = index === 0;
    node.querySelector(".move-down").disabled = index === script.sentences.length - 1;
    node.querySelector(".remove-sentence").disabled = script.sentences.length <= 1;

    node.querySelectorAll("textarea").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const current = selectedScript();
        if (!current) return;
        current.sentences[index] = {
          korean: node.querySelector(".sentence-korean").value,
          english: node.querySelector(".sentence-english").value,
          note: node.querySelector(".sentence-note").value
        };
        setDirty();
        renderStudy();
        updateScriptJsonView();
      });
    });

    node.querySelector(".move-up").addEventListener("click", () => moveSentence(index, -1));
    node.querySelector(".move-down").addEventListener("click", () => moveSentence(index, 1));
    node.querySelector(".remove-sentence").addEventListener("click", () => removeSentence(index));

    return node;
  });

  elements.sentenceEditor.replaceChildren(...sentenceNodes);
  updateScriptJsonView();
}

function renderStudy() {
  const script = selectedScript();
  const isSingleMode = state.studyViewMode === "single";
  elements.studySingleModeButton.classList.toggle("active", isSingleMode);
  elements.studyFlowModeButton.classList.toggle("active", !isSingleMode);
  elements.studyCard.classList.toggle("hidden", !isSingleMode);
  elements.studyFlow.classList.toggle("hidden", isSingleMode);

  if (!script) {
    elements.studyMeta.textContent = "-";
    elements.studyTitle.textContent = "스크립트 선택";
    elements.studyCounter.textContent = "0 / 0";
    elements.koreanPrompt.textContent = "스크립트를 선택하세요.";
    elements.noteBox.classList.add("hidden");
    elements.englishAnswer.classList.add("hidden");
    elements.toggleEnglishButton.textContent = state.studyViewMode === "flow" ? "영어 전체 보기" : "영어 보기";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "스크립트를 선택하면 전체 흐름을 한 번에 볼 수 있습니다.";
    elements.studyFlow.replaceChildren(empty);
    elements.prevSentenceButton.disabled = true;
    elements.nextSentenceButton.disabled = true;
    elements.toggleEnglishButton.disabled = true;
    return;
  }

  state.studyIndex = Math.min(state.studyIndex, script.sentences.length - 1);
  const sentence = script.sentences[state.studyIndex];
  elements.studyMeta.textContent = `${script.topic} · ${script.type}`;
  elements.studyTitle.textContent = script.title;
  elements.studyCounter.textContent = `${state.studyIndex + 1} / ${script.sentences.length}`;
  elements.koreanPrompt.textContent = sentence.korean || "한글 문장을 입력하세요.";
  elements.prevSentenceButton.disabled = state.studyIndex === 0;
  elements.nextSentenceButton.disabled = state.studyIndex === script.sentences.length - 1;
  elements.toggleEnglishButton.disabled = false;
  elements.toggleEnglishButton.textContent = state.showEnglish
    ? "영어 숨기기"
    : state.studyViewMode === "flow"
      ? "영어 전체 보기"
      : "영어 보기";

  if (isSingleMode && sentence.note) {
    elements.noteBox.textContent = sentence.note;
    elements.noteBox.classList.remove("hidden");
  } else {
    elements.noteBox.classList.add("hidden");
  }

  elements.englishAnswer.textContent = sentence.english || "영어 문장을 입력하세요.";
  elements.englishAnswer.classList.toggle("hidden", !isSingleMode || !state.showEnglish);

  const flowNodes = script.sentences.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "study-flow-item";
    const isActive = index === state.studyIndex;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.addEventListener("click", () => {
      if (state.studyIndex === index) return;
      state.studyIndex = index;
      renderStudy();
    });

    const heading = document.createElement("span");
    heading.className = "study-flow-heading";

    const number = document.createElement("span");
    number.className = "study-flow-number";
    number.textContent = `${index + 1}번째 문장`;
    heading.append(number);

    const korean = document.createElement("span");
    korean.className = "study-flow-korean";
    korean.textContent = item.korean || "한글 문장을 입력하세요.";
    button.append(heading, korean);

    if (item.note) {
      const note = document.createElement("span");
      note.className = "note-box study-flow-note";
      note.textContent = item.note;
      button.append(note);
    }

    if (state.showEnglish) {
      const english = document.createElement("span");
      english.className = "english-answer study-flow-english";
      english.textContent = item.english || "영어 문장을 입력하세요.";
      button.append(english);
    }

    return button;
  });

  elements.studyFlow.replaceChildren(...flowNodes);
}

function renderMode() {
  const isEdit = state.mode === "edit";
  const isStudy = state.mode === "study";
  const isFillers = state.mode === "fillers";
  elements.editTab.classList.toggle("active", isEdit);
  elements.studyTab.classList.toggle("active", isStudy);
  elements.fillersTab.classList.toggle("active", isFillers);
  elements.editorView.classList.toggle("active", isEdit);
  elements.studyView.classList.toggle("active", isStudy);
  elements.fillersView.classList.toggle("active", isFillers);
}

function renderAll() {
  renderSourceStatus();
  renderFilters();
  renderFillerFilters();
  renderScriptList();
  renderFillers();
  renderEditor();
  renderStudy();
  renderMode();
}

function commitEditor() {
  const script = selectedScript();
  if (!script) return;

  script.title = elements.titleInput.value.trim();
  script.topic = elements.topicInput.value.trim();
  script.type = elements.typeInput.value.trim();
  script.tags = elements.tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  script.sentences = [...elements.sentenceEditor.querySelectorAll(".sentence-item")].map((node) => ({
    korean: node.querySelector(".sentence-korean").value.trim(),
    english: node.querySelector(".sentence-english").value.trim(),
    note: node.querySelector(".sentence-note").value.trim()
  }));
}

function createNewScript() {
  commitEditor();
  const today = new Date().toISOString();
  let baseId = createSlug(`새 스크립트 ${state.data.scripts.length + 1}`) || `script-${Date.now()}`;
  let id = baseId;
  let suffix = 2;
  while (state.data.scripts.some((script) => script.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const script = {
    id,
    title: "새 스크립트",
    topic: "일상",
    type: "묘사",
    tags: [],
    createdAt: today,
    updatedAt: today,
    sentences: [
      {
        korean: "한글 문장을 입력하세요.",
        english: "Write the English sentence here."
      }
    ]
  };

  state.data.scripts.unshift(script);
  state.selectedId = id;
  state.mode = "edit";
  state.studyIndex = 0;
  state.showEnglish = false;
  setDirty();
  renderAll();
  elements.titleInput.focus();
  elements.titleInput.select();
}

function duplicateScript() {
  commitEditor();
  const script = selectedScript();
  if (!script) return;
  const copy = structuredClone(script);
  copy.title = `${script.title} 복사본`;
  copy.id = createSlug(copy.title) || `script-${Date.now()}`;
  let suffix = 2;
  const baseId = copy.id;
  while (state.data.scripts.some((item) => item.id === copy.id)) {
    copy.id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = copy.createdAt;
  const index = state.data.scripts.findIndex((item) => item.id === script.id);
  state.data.scripts.splice(index + 1, 0, copy);
  state.selectedId = copy.id;
  setDirty();
  renderAll();
}

function deleteScript() {
  const script = selectedScript();
  if (!script) return;
  const confirmed = window.confirm(`"${script.title}" 스크립트를 삭제할까요?`);
  if (!confirmed) return;

  const index = state.data.scripts.findIndex((item) => item.id === script.id);
  state.data.scripts.splice(index, 1);
  state.selectedId = state.data.scripts[Math.max(0, index - 1)]?.id || state.data.scripts[0]?.id || null;
  state.studyIndex = 0;
  state.showEnglish = false;
  setDirty();
  renderAll();
}

function addSentence() {
  commitEditor();
  const script = selectedScript();
  if (!script) return;
  script.sentences.push({
    korean: "",
    english: "",
    note: ""
  });
  setDirty();
  renderAll();
  const last = elements.sentenceEditor.querySelector(".sentence-item:last-child .sentence-korean");
  last?.focus();
}

function moveSentence(index, direction) {
  commitEditor();
  const script = selectedScript();
  if (!script) return;
  const target = index + direction;
  if (target < 0 || target >= script.sentences.length) return;
  const [sentence] = script.sentences.splice(index, 1);
  script.sentences.splice(target, 0, sentence);
  state.studyIndex = target;
  setDirty();
  renderAll();
}

function removeSentence(index) {
  commitEditor();
  const script = selectedScript();
  if (!script || script.sentences.length <= 1) return;
  script.sentences.splice(index, 1);
  state.studyIndex = Math.min(state.studyIndex, script.sentences.length - 1);
  setDirty();
  renderAll();
}

async function copyScriptJson() {
  commitEditor();
  const script = selectedScript();
  if (!script) return;

  const content = JSON.stringify(script, null, 2);
  elements.scriptJsonTextarea.value = content;

  try {
    if (window.navigator.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(content);
    } else {
      elements.scriptJsonTextarea.focus();
      elements.scriptJsonTextarea.select();
      const copied = document.execCommand("copy");
      elements.scriptJsonTextarea.setSelectionRange(0, 0);
      elements.scriptJsonTextarea.blur();
      if (!copied) throw new Error("JSON을 복사하지 못했습니다.");
    }
    setScriptJsonStatus("복사됨. 스프레드시트 C열에 붙여넣으세요.");
  } catch (error) {
    setScriptJsonStatus(error.message || "JSON을 복사하지 못했습니다.", true);
  }
}

async function fetchText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} 요청 실패`);
  return response.text();
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} 요청 실패`);
  return response.json();
}

async function fetchSpreadsheetScriptsData() {
  const csvText = await fetchText(scriptsSpreadsheetCsvUrl);
  return buildScriptsDataFromSpreadsheet(parseCsv(csvText));
}

async function loadData() {
  try {
    state.data = await fetchSpreadsheetScriptsData();
    state.dataSource = "spreadsheet";
  } catch {
    state.data = await fetchJson("data/scripts.json");
    state.dataSource = "backup";
  }
  state.selectedId = state.data.scripts[0]?.id || null;
}

async function loadFillers() {
  try {
    state.fillersData = await fetchJson("/api/fillers");
  } catch {
    state.fillersData = await fetchJson("data/fillers.json");
  }
}

async function loadInitialData() {
  await Promise.all([loadData(), loadFillers()]);
  renderAll();
}

function bindEvents() {
  elements.addScriptButton.addEventListener("click", createNewScript);
  elements.addSentenceButton.addEventListener("click", addSentence);
  elements.duplicateButton.addEventListener("click", duplicateScript);
  elements.deleteButton.addEventListener("click", deleteScript);
  elements.copyScriptJsonButton.addEventListener("click", () => {
    void copyScriptJson();
  });

  [elements.topicFilter, elements.typeFilter, elements.searchInput].forEach((element) => {
    element.addEventListener("input", renderScriptList);
  });

  [elements.fillerCategoryFilter, elements.fillerSearchInput].forEach((element) => {
    element.addEventListener("input", renderFillers);
  });

  [elements.titleInput, elements.topicInput, elements.typeInput, elements.tagsInput].forEach((input) => {
    input.addEventListener("input", () => {
      commitEditor();
      setDirty();
      renderFilters();
      renderScriptList();
      renderStudy();
      updateScriptJsonView();
    });
  });

  elements.editTab.addEventListener("click", () => {
    state.mode = "edit";
    renderMode();
  });

  elements.studyTab.addEventListener("click", () => {
    commitEditor();
    state.mode = "study";
    state.showEnglish = false;
    renderStudy();
    renderMode();
  });

  elements.fillersTab.addEventListener("click", () => {
    commitEditor();
    state.mode = "fillers";
    renderFillers();
    renderMode();
  });

  elements.prevSentenceButton.addEventListener("click", () => {
    state.studyIndex = Math.max(0, state.studyIndex - 1);
    state.showEnglish = false;
    renderStudy();
  });

  elements.nextSentenceButton.addEventListener("click", () => {
    const script = selectedScript();
    if (!script) return;
    state.studyIndex = Math.min(script.sentences.length - 1, state.studyIndex + 1);
    state.showEnglish = false;
    renderStudy();
  });

  elements.toggleEnglishButton.addEventListener("click", () => {
    state.showEnglish = !state.showEnglish;
    renderStudy();
  });

  elements.studySingleModeButton.addEventListener("click", () => {
    if (state.studyViewMode === "single") return;
    state.studyViewMode = "single";
    renderStudy();
  });

  elements.studyFlowModeButton.addEventListener("click", () => {
    if (state.studyViewMode === "flow") return;
    state.studyViewMode = "flow";
    renderStudy();
  });

  window.addEventListener("keydown", (event) => {
    if (state.mode !== "study") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const activeTag = document.activeElement?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(activeTag)) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!elements.prevSentenceButton.disabled) {
        elements.prevSentenceButton.click();
      }
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!elements.nextSentenceButton.disabled) {
        elements.nextSentenceButton.click();
      }
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (!event.repeat && !elements.toggleEnglishButton.disabled) {
        elements.toggleEnglishButton.click();
      }
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

bindEvents();
loadInitialData().catch((error) => {
  setError(error.message);
});
