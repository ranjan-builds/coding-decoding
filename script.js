// --- Constants & Data ---
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Fixed: Expanded fallback dictionary by word lengths (3 to 8) so offline length selection works!
const FALLBACK_WORDS = {
  3: ["CAT", "DOG", "SUN", "RUN", "SKY", "BOX", "RED", "NEW", "ART", "ICE"],
  4: [
    "BLUE",
    "FIRE",
    "CODE",
    "DARK",
    "MIND",
    "WORD",
    "GAME",
    "STAR",
    "TIME",
    "DATA",
  ],
  5: [
    "APPLE",
    "BRAIN",
    "CLOUD",
    "DANCE",
    "EAGLE",
    "FLAME",
    "GRAPE",
    "HEART",
    "IMAGE",
    "JUICE",
    "KNIFE",
    "LEMON",
    "MAGIC",
    "NIGHT",
    "OCEAN",
    "PIZZA",
    "QUEEN",
    "RIVER",
    "SNAKE",
    "TRAIN",
    "UNION",
    "VOICE",
    "WATER",
    "XENON",
    "YACHT",
    "ZEBRA",
  ],
  6: [
    "PLANET",
    "ROCKET",
    "SILVER",
    "DRAGON",
    "MEMORY",
    "PUZZLE",
    "JUNGLE",
    "WINDOW",
    "SHADOW",
    "CASTLE",
  ],
  7: [
    "MYSTERY",
    "JOURNEY",
    "DIAMOND",
    "FREEDOM",
    "THUNDER",
    "STATION",
    "PROJECT",
    "CRYSTAL",
    "GRAVITY",
  ],
  8: [
    "MOUNTAIN",
    "UNIVERSE",
    "COMPUTER",
    "SUNLIGHT",
    "TREASURE",
    "HIGHWAY",
    "SYMPHONY",
    "FESTIVAL",
  ],
};

// --- State ---
let currentMode = "forward";
let wordLength = 5;
let wordQueue = [];
let isFetching = false;
let currentQuestion = {
  word: "",
  answer: "",
  explanation: "",
  ruleText: "",
  hintText: "",
};
let stats = {
  correct: 0,
  total: 0,
  streak: 0,
  highestStreak: 0,
};

// --- DOM Elements ---
const ui = {
  modeButtons: document.querySelectorAll(".mode-btn"),
  ruleBadge: document.getElementById("current-rule-badge"),
  targetWord: document.getElementById("target-word"),
  inputHint: document.getElementById("input-hint"),
  answerInput: document.getElementById("answer-input"),
  feedbackArea: document.getElementById("feedback-area"),
  feedbackIcon: document.getElementById("feedback-icon"),
  feedbackTitle: document.getElementById("feedback-title"),
  feedbackMessage: document.getElementById("feedback-message"),
  explanationBox: document.getElementById("explanation-box"),
  nextBtn: document.getElementById("next-btn"),
  skipBtn: document.getElementById("skip-btn"),
  scoreCounter: document.getElementById("score-counter"),
  streakCounter: document.getElementById("streak-counter"),
  refTbody: document.getElementById("reference-tbody"),
  toggleRefBtn: document.getElementById("toggle-reference-btn"),
  refContent: document.getElementById("reference-content"),
  refCaret: document.getElementById("ref-caret"),

  // Settings UI
  openSettingsBtn: document.getElementById("open-settings-btn"),
  closeSettingsBtn: document.getElementById("close-settings-btn"),
  settingsModal: document.getElementById("settings-modal"),
  settingsCard: document.getElementById("settings-card"),
  lengthSlider: document.getElementById("length-slider"),
  lengthDisplay: document.getElementById("length-display"),
  saveSettingsBtn: document.getElementById("save-settings-btn"),
};

// --- Core Logic Functions ---

const getFwdPos = (char) => ALPHABET.indexOf(char.toUpperCase()) + 1;
const getOppositeChar = (char) => ALPHABET[26 - getFwdPos(char)];

const shiftChar = (char, shift) => {
  let idx = ALPHABET.indexOf(char.toUpperCase());
  let newIdx = (idx + shift) % 26;
  if (newIdx < 0) newIdx += 26;
  return ALPHABET[newIdx];
};

// Fixed: Use working API (vercel.app) with proper fallback logic
async function prefetchWords() {
  if (isFetching || wordQueue.length >= 3) return;
  isFetching = true;
  try {
    const response = await fetch(
      `https://random-word-api.vercel.app/api?words=5&length=${wordLength}`,
    );
    if (response.ok) {
      const data = await response.json();
      data.forEach((w) => wordQueue.push(w.toUpperCase()));
    }
  } catch (error) {
    console.warn(
      "API offline or unreachable, relying on local length-matched dictionary.",
    );
  }
  isFetching = false;
}

function generateQuestion() {
  // Fixed: Set inputmode instead of type="number" to avoid browser number-field bugs
  if (currentMode === "forward") {
    ui.answerInput.setAttribute("inputmode", "numeric");
  } else {
    ui.answerInput.setAttribute("inputmode", "text");
  }

  ui.answerInput.value = "";
  ui.answerInput.disabled = false;
  hideFeedback();

  let fetchedWord = "";
  if (currentMode !== "letterMath") {
    if (wordQueue.length > 0) {
      fetchedWord = wordQueue.shift();
    } else {
      // Fixed: Safely fallback to the selected word length category
      const sourceList = FALLBACK_WORDS[wordLength] || FALLBACK_WORDS[5];
      fetchedWord = sourceList[Math.floor(Math.random() * sourceList.length)];
    }
    prefetchWords();
  }

  ui.answerInput.focus();

  let answerParts = [];
  let explainParts = [];

  switch (currentMode) {
    case "forward":
      currentQuestion.word = fetchedWord;
      currentQuestion.ruleText = "Rule: A=1, B=2, C=3...";
      currentQuestion.hintText = "Enter the numbers continuously (e.g., 123)";
      for (let char of currentQuestion.word) {
        const val = getFwdPos(char);
        answerParts.push(val);
        explainParts.push(`${char}=${val}`);
      }
      currentQuestion.answer = answerParts.join("");
      break;

    case "letterMath": {
      const randomChar = ALPHABET[Math.floor(Math.random() * 26)];
      let mathShift = 0;
      while (mathShift === 0) {
        mathShift = Math.floor(Math.random() * 15) - 7;
      }
      const op = mathShift > 0 ? "+" : "-";
      const absShift = Math.abs(mathShift);

      currentQuestion.word = `${randomChar} ${op} ${absShift}`;
      currentQuestion.ruleText = "Rule: Find the resulting letter position";
      currentQuestion.hintText = "Enter the resulting single letter";

      const resultChar = shiftChar(randomChar, mathShift);
      currentQuestion.answer = resultChar;

      const startPos = getFwdPos(randomChar);
      const rawSum = mathShift > 0 ? startPos + absShift : startPos - absShift;
      const finalPos = getFwdPos(resultChar);

      // Fixed: Mathematically accurate explanation when wrapping occurs around 1 or 26
      explainParts.push(`Position of ${randomChar} is ${startPos}`);
      if (rawSum > 26) {
        explainParts.push(
          `${startPos} + ${absShift} = ${rawSum} (wraps to ${rawSum} - 26 = ${finalPos})`,
        );
      } else if (rawSum < 1) {
        explainParts.push(
          `${startPos} - ${absShift} = ${rawSum} (wraps to ${rawSum} + 26 = ${finalPos})`,
        );
      } else {
        explainParts.push(`${startPos} ${op} ${absShift} = ${finalPos}`);
      }
      explainParts.push(`Letter at position ${finalPos} is ${resultChar}`);
      break;
    }

    case "opposite":
      currentQuestion.word = fetchedWord;
      currentQuestion.ruleText = "Rule: A↔Z, B↔Y, C↔X...";
      currentQuestion.hintText = "Enter the corresponding opposite letters";
      for (let char of currentQuestion.word) {
        const val = getOppositeChar(char);
        answerParts.push(val);
        explainParts.push(`${char}↔${val}`);
      }
      currentQuestion.answer = answerParts.join("");
      break;

    case "shift": {
      currentQuestion.word = fetchedWord;
      let shift = 0;
      while (shift === 0) {
        shift = Math.floor(Math.random() * 7) - 3;
      }
      const shiftStr = shift > 0 ? `+${shift}` : `${shift}`;

      currentQuestion.ruleText = `Rule: Shift every letter by ${shiftStr}`;
      currentQuestion.hintText = "Enter the shifted letters";

      for (let char of currentQuestion.word) {
        const val = shiftChar(char, shift);
        answerParts.push(val);
        explainParts.push(`${char}→${val}`);
      }
      currentQuestion.answer = answerParts.join("");
      break;
    }
  }

  currentQuestion.explanation = explainParts.join(" | ");
  renderQuestion();
}

function renderQuestion() {
  ui.targetWord.textContent = currentQuestion.word;
  ui.ruleBadge.innerHTML = `<i class="ph ph-info"></i> ${currentQuestion.ruleText}`;
  ui.inputHint.textContent = currentQuestion.hintText;
}

function formatUserInput(input) {
  let clean = input.trim().toUpperCase().replace(/\s+/g, "");
  if (currentMode === "forward") {
    clean = clean.replace(/[^0-9]/g, "");
  } else {
    clean = clean.replace(/[^A-Z]/g, "");
  }
  return clean;
}

function checkAnswer() {
  const rawInput = ui.answerInput.value;
  if (!rawInput.trim()) return;

  const processedInput = formatUserInput(rawInput);
  const isCorrect = processedInput === currentQuestion.answer;

  ui.answerInput.disabled = true;
  stats.total++;

  if (isCorrect) {
    stats.correct++;
    stats.streak++;
    if (stats.streak > stats.highestStreak) stats.highestStreak = stats.streak;
    showFeedback("success");
  } else {
    stats.streak = 0;
    ui.answerInput.classList.add("shake");
    setTimeout(() => ui.answerInput.classList.remove("shake"), 500);
    showFeedback("error", processedInput);
  }

  updateStatsDisplay();
}

// --- UI Feedback & Utilities ---

function showFeedback(type, userInput = "") {
  ui.feedbackArea.classList.remove(
    "hidden",
    "bg-emerald-950/30",
    "border-emerald-500/50",
    "text-emerald-400",
    "bg-rose-950/30",
    "border-rose-500/50",
    "text-rose-400",
  );
  ui.feedbackIcon.className = "ph text-3xl mt-0.5";
  ui.explanationBox.classList.remove("hidden");

  if (type === "success") {
    ui.feedbackArea.classList.add(
      "bg-emerald-950/30",
      "border-emerald-500/50",
      "text-emerald-400",
    );
    ui.feedbackIcon.classList.add("ph-check-circle");
    ui.feedbackTitle.textContent = "Mission Accomplished!";
    ui.feedbackMessage.textContent =
      "Perfectly decoded. Review the breakdown below:";

    ui.explanationBox.innerHTML = `
                    <div class="text-emerald-500/80 mb-1 text-xs uppercase tracking-widest">Logic Breakdown</div>
                    <div class="text-emerald-100">${currentQuestion.explanation}</div>
                `;
  } else {
    ui.feedbackArea.classList.add(
      "bg-rose-950/30",
      "border-rose-500/50",
      "text-rose-400",
    );
    ui.feedbackIcon.classList.add("ph-x-circle");
    ui.feedbackTitle.textContent = "Access Denied";

    const formattedInputDisplay = userInput
      ? `(You entered: ${userInput})`
      : "";
    ui.feedbackMessage.textContent = `Correct code was ${currentQuestion.answer}. ${formattedInputDisplay}`;

    ui.explanationBox.innerHTML = `
                    <div class="text-rose-500/80 mb-1 text-xs uppercase tracking-widest">Correct Logic</div>
                    <div class="text-rose-100">${currentQuestion.explanation}</div>
                `;
  }

  // Fixed: Always show Next button so user can read explanation at their own pace
  ui.nextBtn.classList.remove("hidden");
  ui.nextBtn.focus();
}

function hideFeedback() {
  ui.feedbackArea.classList.add("hidden");
  ui.explanationBox.classList.add("hidden");
  ui.nextBtn.classList.add("hidden");
  ui.answerInput.classList.remove(
    "border-emerald-500/50",
    "border-rose-500/50",
  );
}

function updateStatsDisplay() {
  ui.scoreCounter.textContent = `Score: ${stats.correct}/${stats.total}`;
  ui.streakCounter.innerHTML = `<i class="ph-fill ph-fire"></i> ${stats.streak}`;

  if (stats.streak > 0) {
    ui.streakCounter.classList.add(
      "scale-110",
      "text-orange-300",
      "transition-transform",
    );
    setTimeout(() => {
      ui.streakCounter.classList.remove("scale-110", "text-orange-300");
    }, 300);
  }
}

function buildReferenceTable() {
  let html = "";
  for (let i = 0; i < 26; i++) {
    const char = ALPHABET[i];
    const fwd = i + 1;
    const opp = ALPHABET[25 - i];

    const isVowel = ["A", "E", "I", "O", "U"].includes(char);
    const bgClass = isVowel ? "bg-cyan-950/20" : "";
    const textHighlight = isVowel ? "text-cyan-300" : "text-zinc-300";

    html += `
                    <tr class="hover:bg-zinc-800/50 transition-colors ${bgClass}">
                        <td class="py-2 px-2 font-bold ${textHighlight}">${char}</td>
                        <td class="py-2 px-2 mono-font text-zinc-500">${fwd}</td>
                        <td class="py-2 px-2 font-bold ${textHighlight}">${opp}</td>
                    </tr>
                `;
  }
  ui.refTbody.innerHTML = html;
}

// --- Event Listeners ---

ui.modeButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    ui.modeButtons.forEach((b) => {
      b.classList.remove(
        "active",
        "bg-cyan-500/10",
        "text-cyan-400",
        "border-cyan-500/30",
        "shadow-[0_0_15px_rgba(34,211,238,0.1)]",
      );
      b.classList.add("bg-zinc-900/50", "text-zinc-400", "border-white/5");
    });

    const clickedBtn = e.currentTarget;
    clickedBtn.classList.add(
      "active",
      "bg-cyan-500/10",
      "text-cyan-400",
      "border-cyan-500/30",
      "shadow-[0_0_15px_rgba(34,211,238,0.1)]",
    );
    clickedBtn.classList.remove(
      "bg-zinc-900/50",
      "text-zinc-400",
      "border-white/5",
    );

    currentMode = clickedBtn.dataset.mode;
    generateQuestion();
  });
});

ui.answerInput.addEventListener("input", () => {
  if (ui.answerInput.disabled) return;
  const processedInput = formatUserInput(ui.answerInput.value);
  if (processedInput === currentQuestion.answer) {
    checkAnswer();
  }
});

// Fixed: Allow pressing Enter to advance if feedback is currently displayed
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!ui.answerInput.disabled && document.activeElement === ui.answerInput) {
      checkAnswer();
    } else if (!ui.nextBtn.classList.contains("hidden")) {
      generateQuestion();
    }
  }
});

ui.nextBtn.addEventListener("click", generateQuestion);
ui.skipBtn.addEventListener("click", generateQuestion);

ui.toggleRefBtn.addEventListener("click", () => {
  const isHidden = ui.refContent.classList.contains("hidden");
  if (isHidden) {
    ui.refContent.classList.remove("hidden");
    ui.refCaret.classList.add("rotate-180");
  } else {
    ui.refContent.classList.add("hidden");
    ui.refCaret.classList.remove("rotate-180");
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) {
    ui.refContent.classList.remove("hidden");
    ui.refCaret.classList.add("hidden");
  } else {
    ui.refContent.classList.add("hidden");
    ui.refCaret.classList.remove("hidden", "rotate-180");
  }
});

// Settings Modal Handlers
const toggleModal = (show) => {
  if (show) {
    ui.settingsModal.classList.remove("opacity-0", "pointer-events-none");
    ui.settingsCard.classList.remove("scale-95");
    ui.settingsCard.classList.add("scale-100");
  } else {
    ui.settingsModal.classList.add("opacity-0", "pointer-events-none");
    ui.settingsCard.classList.remove("scale-100");
    ui.settingsCard.classList.add("scale-95");
    ui.answerInput.focus();
  }
};

ui.openSettingsBtn.addEventListener("click", () => toggleModal(true));
ui.closeSettingsBtn.addEventListener("click", () => toggleModal(false));
ui.settingsModal.addEventListener("click", (e) => {
  if (e.target === ui.settingsModal) toggleModal(false);
});

ui.lengthSlider.addEventListener("input", (e) => {
  ui.lengthDisplay.textContent = `${e.target.value} Letters`;
});

ui.saveSettingsBtn.addEventListener("click", () => {
  const newLength = parseInt(ui.lengthSlider.value);
  if (newLength !== wordLength) {
    wordLength = newLength;
    wordQueue = [];
    stats = { correct: 0, total: 0, streak: 0, highestStreak: 0 };
    updateStatsDisplay();
    generateQuestion();
    prefetchWords();
  }
  toggleModal(false);
});

// --- Initialization ---
buildReferenceTable();

if (window.innerWidth >= 768) {
  ui.refContent.classList.remove("hidden");
  ui.refCaret.classList.add("hidden");
}

generateQuestion();
prefetchWords();
