const state = {
  data: { version: 1, scripts: [] },
  fillersData: { version: 1, fillers: [] },
  selectedId: null,
  dirty: false,
  mode: "edit",
  studyIndex: 0,
  showEnglish: false,
  tts: {
    supported: false,
    voices: [],
    voiceURI: "",
    rate: 1
  }
};

const elements = {
  addScriptButton: document.querySelector("#addScriptButton"),
  topicFilter: document.querySelector("#topicFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  searchInput: document.querySelector("#searchInput"),
  scriptList: document.querySelector("#scriptList"),
  saveButton: document.querySelector("#saveButton"),
  saveStatus: document.querySelector("#saveStatus"),
  downloadJsonButton: document.querySelector("#downloadJsonButton"),
  uploadJsonButton: document.querySelector("#uploadJsonButton"),
  jsonUploadInput: document.querySelector("#jsonUploadInput"),
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
  refreshScriptJsonButton: document.querySelector("#refreshScriptJsonButton"),
  applyScriptJsonButton: document.querySelector("#applyScriptJsonButton"),
  scriptJsonTextarea: document.querySelector("#scriptJsonTextarea"),
  scriptJsonStatus: document.querySelector("#scriptJsonStatus"),
  studyMeta: document.querySelector("#studyMeta"),
  studyTitle: document.querySelector("#studyTitle"),
  studyCounter: document.querySelector("#studyCounter"),
  koreanPrompt: document.querySelector("#koreanPrompt"),
  noteBox: document.querySelector("#noteBox"),
  englishAnswer: document.querySelector("#englishAnswer"),
  voiceSelect: document.querySelector("#voiceSelect"),
  rateInput: document.querySelector("#rateInput"),
  rateValue: document.querySelector("#rateValue"),
  autoSpeakEnglish: document.querySelector("#autoSpeakEnglish"),
  speakKoreanButton: document.querySelector("#speakKoreanButton"),
  speakEnglishButton: document.querySelector("#speakEnglishButton"),
  stopSpeechButton: document.querySelector("#stopSpeechButton"),
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

function currentSentence() {
  const script = selectedScript();
  return script?.sentences[state.studyIndex] || null;
}

function ttsAvailable() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function scoreVoice(voice) {
  if (voice.lang?.startsWith("ko")) return 0;
  if (voice.lang?.startsWith("en")) return 1;
  return 2;
}

function renderVoiceOptions() {
  if (!state.tts.supported) {
    elements.voiceSelect.replaceChildren(new Option("TTS 미지원", ""));
    elements.voiceSelect.disabled = true;
    return;
  }

  elements.voiceSelect.disabled = false;
  const current = state.tts.voiceURI || elements.voiceSelect.value;
  const voices = [...state.tts.voices].sort((a, b) => {
    const scoreDiff = scoreVoice(a) - scoreVoice(b);
    return scoreDiff || a.name.localeCompare(b.name);
  });

  elements.voiceSelect.replaceChildren(new Option("자동 선택", ""));
  voices.forEach((voice) => {
    elements.voiceSelect.append(new Option(`${voice.name} (${voice.lang})`, voice.voiceURI));
  });

  elements.voiceSelect.value = voices.some((voice) => voice.voiceURI === current) ? current : "";
  state.tts.voiceURI = elements.voiceSelect.value;
}

function loadVoices() {
  if (!state.tts.supported) return;
  state.tts.voices = window.speechSynthesis.getVoices();
  renderVoiceOptions();
  renderFillers();
}

function initTts() {
  state.tts.supported = ttsAvailable();
  elements.rateInput.value = String(state.tts.rate);
  elements.rateValue.value = `${state.tts.rate.toFixed(1)}x`;
  elements.rateValue.textContent = `${state.tts.rate.toFixed(1)}x`;

  if (!state.tts.supported) {
    elements.rateInput.disabled = true;
    elements.autoSpeakEnglish.disabled = true;
    renderVoiceOptions();
    return;
  }

  elements.rateInput.disabled = false;
  elements.autoSpeakEnglish.disabled = false;
  loadVoices();
  if ("addEventListener" in window.speechSynthesis) {
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  } else {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function preferredVoice(langPrefix) {
  if (!state.tts.supported) return null;

  if (state.tts.voiceURI) {
    return state.tts.voices.find((voice) => voice.voiceURI === state.tts.voiceURI) || null;
  }

  return (
    state.tts.voices.find((voice) => voice.lang?.toLowerCase().startsWith(langPrefix)) ||
    state.tts.voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ||
    null
  );
}

function stopSpeech() {
  if (state.tts.supported) {
    window.speechSynthesis.cancel();
  }
}

function speakText(text, lang) {
  if (!state.tts.supported || !text) return;

  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = state.tts.rate;

  const voice = preferredVoice(lang.toLowerCase().slice(0, 2));
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

function speakCurrentSentence(language) {
  const sentence = currentSentence();
  if (!sentence) return;

  if (language === "korean") {
    speakText(sentence.korean, "ko-KR");
    return;
  }

  speakText(sentence.english, "en-US");
}

function setDirty(isDirty = true) {
  state.dirty = isDirty;
  elements.saveStatus.textContent = isDirty ? "저장 필요" : "저장됨";
  elements.saveStatus.classList.toggle("dirty", isDirty);
  elements.saveStatus.classList.remove("error");
}

function setError(message) {
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.add("error");
}

function setScriptJsonStatus(message = "", isError = false) {
  elements.scriptJsonStatus.textContent = message;
  elements.scriptJsonStatus.classList.toggle("error", isError);
}

function updateScriptJsonView({ commit = false, force = false, status = "" } = {}) {
  if (commit) commitEditor();

  const script = selectedScript();
  const hasScript = Boolean(script);
  elements.scriptJsonTextarea.disabled = !hasScript;
  elements.refreshScriptJsonButton.disabled = !hasScript;
  elements.applyScriptJsonButton.disabled = !hasScript;

  if (!hasScript) {
    elements.scriptJsonTextarea.value = "";
    setScriptJsonStatus("");
    return;
  }

  if (!force && document.activeElement === elements.scriptJsonTextarea) {
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
      stopSpeech();
      commitEditor();
      state.selectedId = script.id;
      state.studyIndex = 0;
      state.showEnglish = false;
      renderAll();
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

    const speakButton = document.createElement("button");
    speakButton.type = "button";
    speakButton.className = "secondary-button";
    speakButton.textContent = "듣기";
    speakButton.disabled = !state.tts.supported;
    speakButton.addEventListener("click", () => speakText(filler.english, "en-US"));

    actions.append(tags, speakButton);
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
    updateScriptJsonView({ force: true });
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
  updateScriptJsonView({ force: true });
}

function renderStudy() {
  const script = selectedScript();
  if (!script) {
    elements.studyMeta.textContent = "-";
    elements.studyTitle.textContent = "스크립트 선택";
    elements.studyCounter.textContent = "0 / 0";
    elements.koreanPrompt.textContent = "스크립트를 선택하세요.";
    elements.noteBox.classList.add("hidden");
    elements.englishAnswer.classList.add("hidden");
    elements.prevSentenceButton.disabled = true;
    elements.nextSentenceButton.disabled = true;
    elements.toggleEnglishButton.disabled = true;
    elements.speakKoreanButton.disabled = true;
    elements.speakEnglishButton.disabled = true;
    elements.stopSpeechButton.disabled = !state.tts.supported;
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
  elements.toggleEnglishButton.textContent = state.showEnglish ? "영어 숨기기" : "영어 보기";
  elements.speakKoreanButton.disabled = !state.tts.supported;
  elements.speakEnglishButton.disabled = !state.tts.supported;
  elements.stopSpeechButton.disabled = !state.tts.supported;

  if (sentence.note) {
    elements.noteBox.textContent = sentence.note;
    elements.noteBox.classList.remove("hidden");
  } else {
    elements.noteBox.classList.add("hidden");
  }

  elements.englishAnswer.textContent = sentence.english || "영어 문장을 입력하세요.";
  elements.englishAnswer.classList.toggle("hidden", !state.showEnglish);
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

function downloadJson() {
  commitEditor();

  const content = `${JSON.stringify(state.data, null, 2)}\n`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `opic-scripts-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeJsonPayload(payload) {
  const now = new Date().toISOString();

  if (Array.isArray(payload)) {
    const scripts = assignUniqueIds(payload.map((script, index) => normalizeScriptShape(script, index)));
    return {
      kind: "dataset",
      data: { version: 1, updatedAt: now, scripts }
    };
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.scripts)) {
    const scripts = assignUniqueIds(
      payload.scripts.map((script, index) => normalizeScriptShape(script, index))
    );
    return {
      kind: "dataset",
      data: { version: 1, updatedAt: now, scripts }
    };
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.sentences)) {
    const usedIds = new Set(state.data.scripts.map((script) => script.id));
    const script = assignUniqueIds([normalizeScriptShape(payload)], usedIds)[0];
    return { kind: "script", script };
  }

  throw new Error("전체 scripts JSON 또는 단일 스크립트 JSON 파일이 필요합니다.");
}

function importJsonPayload(payload) {
  commitEditor();
  const imported = normalizeJsonPayload(payload);

  if (imported.kind === "dataset") {
    const confirmed = window.confirm("가져온 JSON으로 현재 스크립트 목록을 교체할까요?");
    if (!confirmed) return;

    state.data = imported.data;
    state.selectedId = state.data.scripts[0]?.id || null;
  } else {
    state.data.scripts.unshift(imported.script);
    state.selectedId = imported.script.id;
  }

  elements.topicFilter.value = "";
  elements.typeFilter.value = "";
  elements.searchInput.value = "";
  state.mode = "edit";
  state.studyIndex = 0;
  state.showEnglish = false;
  setDirty();
  renderAll();
}

async function uploadJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    importJsonPayload(payload);
  } catch (error) {
    setError(error.message || "JSON 파일을 가져오지 못했습니다.");
  } finally {
    event.target.value = "";
  }
}

function applyScriptJson() {
  const current = selectedScript();
  if (!current) return;

  try {
    const parsed = JSON.parse(elements.scriptJsonTextarea.value);
    const index = state.data.scripts.findIndex((script) => script.id === current.id);
    const usedIds = new Set(state.data.scripts.map((script) => script.id));
    usedIds.delete(current.id);
    const script = assignUniqueIds([normalizeScriptShape(parsed, index)], usedIds)[0];

    state.data.scripts[index] = script;
    state.selectedId = script.id;
    state.studyIndex = Math.min(state.studyIndex, script.sentences.length - 1);
    state.showEnglish = false;
    setDirty();
    renderAll();
    setScriptJsonStatus("JSON 적용됨");
  } catch (error) {
    setScriptJsonStatus(error.message || "JSON을 적용하지 못했습니다.", true);
  }
}

function validateBeforeSave() {
  commitEditor();
  for (const script of state.data.scripts) {
    if (!script.title.trim()) return "제목이 비어 있습니다.";
    if (!script.topic.trim()) return `"${script.title}"의 주제가 비어 있습니다.`;
    if (!script.type.trim()) return `"${script.title}"의 유형이 비어 있습니다.`;
    if (!script.sentences.length) return `"${script.title}"에 문장이 없습니다.`;
    for (const [index, sentence] of script.sentences.entries()) {
      if (!sentence.korean.trim() || !sentence.english.trim()) {
        return `"${script.title}" ${index + 1}번째 문장의 한글/영어가 비어 있습니다.`;
      }
    }
  }
  return "";
}

async function saveData() {
  const error = validateBeforeSave();
  if (error) {
    setError(error);
    return;
  }

  elements.saveButton.disabled = true;
  elements.saveStatus.textContent = "저장 중";

  try {
    const response = await fetch("/api/scripts", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state.data)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "저장 실패");
    state.data = payload;
    setDirty(false);
    renderAll();
  } catch (error) {
    setError(error.message);
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function loadData() {
  const response = await fetch("/api/scripts");
  if (!response.ok) throw new Error("데이터를 불러오지 못했습니다.");
  state.data = await response.json();
  state.selectedId = state.data.scripts[0]?.id || null;
}

async function loadFillers() {
  const response = await fetch("/api/fillers");
  if (!response.ok) throw new Error("필러 데이터를 불러오지 못했습니다.");
  state.fillersData = await response.json();
}

async function loadInitialData() {
  await Promise.all([loadData(), loadFillers()]);
  renderAll();
}

function bindEvents() {
  elements.addScriptButton.addEventListener("click", createNewScript);
  elements.saveButton.addEventListener("click", saveData);
  elements.downloadJsonButton.addEventListener("click", downloadJson);
  elements.uploadJsonButton.addEventListener("click", () => elements.jsonUploadInput.click());
  elements.jsonUploadInput.addEventListener("change", uploadJsonFile);
  elements.addSentenceButton.addEventListener("click", addSentence);
  elements.duplicateButton.addEventListener("click", duplicateScript);
  elements.deleteButton.addEventListener("click", deleteScript);
  elements.refreshScriptJsonButton.addEventListener("click", () => {
    updateScriptJsonView({ commit: true, force: true, status: "현재 편집 내용 반영됨" });
  });
  elements.applyScriptJsonButton.addEventListener("click", applyScriptJson);
  elements.voiceSelect.addEventListener("change", () => {
    state.tts.voiceURI = elements.voiceSelect.value;
  });
  elements.rateInput.addEventListener("input", () => {
    state.tts.rate = Number(elements.rateInput.value);
    elements.rateValue.value = `${state.tts.rate.toFixed(1)}x`;
    elements.rateValue.textContent = `${state.tts.rate.toFixed(1)}x`;
  });
  elements.speakKoreanButton.addEventListener("click", () => speakCurrentSentence("korean"));
  elements.speakEnglishButton.addEventListener("click", () => {
    if (!state.showEnglish) {
      state.showEnglish = true;
      renderStudy();
    }
    speakCurrentSentence("english");
  });
  elements.stopSpeechButton.addEventListener("click", stopSpeech);

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
    stopSpeech();
    state.mode = "edit";
    renderMode();
  });

  elements.studyTab.addEventListener("click", () => {
    stopSpeech();
    commitEditor();
    state.mode = "study";
    state.showEnglish = false;
    renderStudy();
    renderMode();
  });

  elements.fillersTab.addEventListener("click", () => {
    stopSpeech();
    commitEditor();
    state.mode = "fillers";
    renderFillers();
    renderMode();
  });

  elements.prevSentenceButton.addEventListener("click", () => {
    stopSpeech();
    state.studyIndex = Math.max(0, state.studyIndex - 1);
    state.showEnglish = false;
    renderStudy();
  });

  elements.nextSentenceButton.addEventListener("click", () => {
    const script = selectedScript();
    if (!script) return;
    stopSpeech();
    state.studyIndex = Math.min(script.sentences.length - 1, state.studyIndex + 1);
    state.showEnglish = false;
    renderStudy();
  });

  elements.toggleEnglishButton.addEventListener("click", () => {
    const shouldSpeak = !state.showEnglish && elements.autoSpeakEnglish.checked;
    state.showEnglish = !state.showEnglish;
    renderStudy();
    if (state.showEnglish && shouldSpeak) {
      speakCurrentSentence("english");
    }
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

initTts();
bindEvents();
loadInitialData().catch((error) => {
  setError(error.message);
});
