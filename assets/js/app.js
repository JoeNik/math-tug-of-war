const PRESETS = {
  easy: {
    label: "幼儿模式",
    operators: ["add", "sub"],
    add: { min: 1, max: 9, resultMax: 10 },
    sub: { min: 1, max: 10, resultMin: 0, resultMax: 10 },
    mul: null
  },
  basic: {
    label: "基础模式",
    operators: ["add", "sub", "mul"],
    add: { min: 1, max: 15, resultMax: 20 },
    sub: { min: 1, max: 20, resultMin: 0, resultMax: 20 },
    mul: { aMin: 1, aMax: 5, bMin: 1, bMax: 5, resultMax: 25 }
  },
  advanced: {
    label: "进阶模式",
    operators: ["add", "sub", "mul"],
    add: { min: 2, max: 30, resultMax: 50 },
    sub: { min: 2, max: 50, resultMin: 0, resultMax: 50 },
    mul: { aMin: 1, aMax: 9, bMin: 1, bMax: 9, resultMax: 81 }
  }
};

const PRESET_KEYS = ["easy", "basic", "advanced"];
const PRAISE = ["太棒了！", "回答正确！", "真厉害！", "继续加油！", "做得很好！"];

const state = {
  phase: "idle", // idle | running | paused | ended
  timer: 0,
  timerId: null,
  audio: true,
  presetKey: "basic",
  targetIndex: 0,
  targets: [5, 7, 10],
  rope: 0,
  left: { input: "0", answer: 0, score: 0, lastType: "" },
  right: { input: "0", answer: 0, score: 0, lastType: "" }
};

const $ = (id) => document.getElementById(id);
const els = {
  leftQuestion: $("leftQuestion"),
  rightQuestion: $("rightQuestion"),
  leftAnswer: $("leftAnswer"),
  rightAnswer: $("rightAnswer"),
  leftFeedback: $("leftFeedback"),
  rightFeedback: $("rightFeedback"),
  leftQBox: $("leftQBox"),
  rightQBox: $("rightQBox"),

  leftScore: $("leftScore"),
  rightScore: $("rightScore"),
  leftBadge: $("leftBadge"),
  rightBadge: $("rightBadge"),
  timer: $("timer"),

  modeBtn: $("modeBtn"),
  targetBtn: $("targetBtn"),
  startPauseBtn: $("startPauseBtn"),
  resetBtn: $("resetBtn"),
  topResetBtn: $("topResetBtn"),
  soundBtn: $("soundBtn"),
  fullscreenBtn: $("fullscreenBtn"),

  leftPad: $("leftPad"),
  rightPad: $("rightPad"),

  arena: $("arena"),
  message: $("message"),

  winOverlay: $("winOverlay"),
  winnerText: $("winnerText"),
  winnerSub: $("winnerSub"),
  playAgainBtn: $("playAgainBtn")
};

function isRunning() {
  return state.phase === "running";
}
function currentTarget() {
  return state.targets[state.targetIndex];
}
function currentPreset() {
  return PRESETS[state.presetKey];
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function beep(type = "ok") {
  if (!state.audio) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = type === "ok" ? 760 : type === "win" ? 980 : 230;
    gain.gain.value = 0.06;

    osc.start();
    osc.stop(ctx.currentTime + (type === "win" ? 0.2 : 0.12));
  } catch (e) {}
}

function setFeedback(side, text, cls = "") {
  const el = side === "left" ? els.leftFeedback : els.rightFeedback;
  el.className = `feedback ${cls}`.trim();
  el.textContent = text;
}

function renderButtons() {
  els.modeBtn.textContent = `题目：${currentPreset().label}`;
  els.targetBtn.textContent = `目标：${currentTarget()}步获胜`;
  els.soundBtn.textContent = state.audio ? "🔊" : "🔇";

  if (state.phase === "idle") els.startPauseBtn.textContent = "开始游戏";
  if (state.phase === "running") els.startPauseBtn.textContent = "暂停";
  if (state.phase === "paused") els.startPauseBtn.textContent = "继续";
  if (state.phase === "ended") els.startPauseBtn.textContent = "开始游戏";
}

function renderScores() {
  els.leftScore.textContent = state.left.score;
  els.rightScore.textContent = state.right.score;
  els.leftBadge.textContent = state.left.score;
  els.rightBadge.textContent = state.right.score;
}

function renderAnswers() {
  els.leftAnswer.textContent = state.left.input || "0";
  els.rightAnswer.textContent = state.right.input || "0";
}

function renderRope() {
  // 每分移动 40px，可按图片比例调整
  document.documentElement.style.setProperty("--shift", `${state.rope * 40}px`);
}

function setRunningVisual(isRun) {
  els.arena.classList.toggle("running", isRun);
}

function pulsePull(side) {
  els.arena.classList.remove("pull-left", "pull-right");
  void els.arena.offsetWidth;
  els.arena.classList.add(side === "left" ? "pull-left" : "pull-right");
  setTimeout(() => els.arena.classList.remove("pull-left", "pull-right"), 240);
}

function shakeQ(side) {
  const box = side === "left" ? els.leftQBox : els.rightQBox;
  box.classList.remove("shake");
  void box.offsetWidth;
  box.classList.add("shake");
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (state.phase !== "running") return;
    state.timer += 1;
    els.timer.textContent = fmt(state.timer);
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function generateQuestion(side) {
  const p = currentPreset();
  let ops = [...p.operators];
  const last = state[side].lastType;

  // 避免连续同类型
  if (last) {
    const filtered = ops.filter((x) => x !== last);
    if (filtered.length) ops = filtered;
  }

  const type = pick(ops);
  let a = 1, b = 1, ans = 2, text = "1 + 1 = ?";

  if (type === "add") {
    do {
      a = rand(p.add.min, p.add.max);
      b = rand(p.add.min, p.add.max);
      ans = a + b;
    } while (ans > p.add.resultMax);
    text = `${a} + ${b} = ?`;
  }

  if (type === "sub") {
    do {
      a = rand(p.sub.min, p.sub.max);
      b = rand(p.sub.min, p.sub.max);
      if (b > a) [a, b] = [b, a];
      ans = a - b;
    } while (ans < p.sub.resultMin || ans > p.sub.resultMax);
    text = `${a} - ${b} = ?`;
  }

  if (type === "mul") {
    do {
      a = rand(p.mul.aMin, p.mul.aMax);
      b = rand(p.mul.bMin, p.mul.bMax);
      ans = a * b;
    } while (ans > p.mul.resultMax);
    text = `${a} × ${b} = ?`;
  }

  state[side].answer = ans;
  state[side].lastType = type;
  state[side].input = "0";

  if (side === "left") els.leftQuestion.textContent = text;
  else els.rightQuestion.textContent = text;
}

function checkWin() {
  const target = currentTarget();
  if (state.rope <= -target) return endGame("left");
  if (state.rope >= target) return endGame("right");
}

function endGame(winnerSide) {
  state.phase = "ended";
  stopTimer();
  setRunningVisual(false);
  renderButtons();

  const winner = winnerSide === "left" ? "🔵 蓝队" : "🔴 红队";
  els.winnerText.textContent = `${winner} 获胜！`;
  els.winnerSub.textContent = `用时 ${fmt(state.timer)} · 比分 ${state.left.score}:${state.right.score}`;
  els.winOverlay.classList.add("show");
  els.message.textContent = `${winner} 赢下本局！`;
  beep("win");
}

function submit(side) {
  if (!isRunning()) return;

  const team = state[side];
  const val = Number(team.input || "0");

  if (val === team.answer) {
    team.score += 1;
    state.rope += side === "left" ? -1 : 1;

    renderScores();
    renderRope();
    pulsePull(side);

    setFeedback(side, `✅ ${pick(PRAISE)}`, "ok");
    setFeedback(side === "left" ? "right" : "left", "继续加油！", "ok");
    els.message.textContent = side === "left"
      ? "蓝队答对，绳子向左移动！"
      : "红队答对，绳子向右移动！";

    beep("ok");
    generateQuestion(side);
    renderAnswers();
    checkWin();
  } else {
    shakeQ(side);
    setFeedback(side, `❌ 答错了，正确答案是 ${team.answer}`, "err");
    els.message.textContent = side === "left"
      ? "蓝队答错了，别着急，再试一次！"
      : "红队答错了，别着急，再试一次！";
    beep("wrong");

    team.input = "0";
    renderAnswers();

    // 错题反馈后换新题
    setTimeout(() => {
      if (state.phase === "running") {
        generateQuestion(side);
        renderAnswers();
      }
    }, 850);
  }
}

function appendInput(side, n) {
  if (!isRunning()) return;
  const team = state[side];

  if (team.input === "0") team.input = n;
  else if (team.input.length < 2) team.input += n; // 儿童版限制2位
  renderAnswers();
}

function clearInput(side) {
  state[side].input = "0";
  renderAnswers();
  setFeedback(side, "已清空答案。");
}

function handlePadClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;

  const side = btn.dataset.side;
  if (!side) return;

  const val = btn.dataset.val;
  const action = btn.dataset.action;

  if (action === "clear") return clearInput(side);
  if (action === "submit") return submit(side);
  if (typeof val !== "undefined") return appendInput(side, val);
}

function startOrPause() {
  if (state.phase === "ended") {
    resetGame();
    return;
  }

  if (state.phase === "idle") {
    state.phase = "running";
    startTimer();
    setRunningVisual(true);
    setFeedback("left", "开始作答！", "ok");
    setFeedback("right", "开始作答！", "ok");
    els.message.textContent = "游戏开始！答对把绳结拉向自己！";
    renderButtons();
    return;
  }

  if (state.phase === "running") {
    state.phase = "paused";
    setRunningVisual(false);
    setFeedback("left", "已暂停", "pause");
    setFeedback("right", "已暂停", "pause");
    els.message.textContent = "已暂停，点击“继续”恢复。";
    renderButtons();
    return;
  }

  if (state.phase === "paused") {
    state.phase = "running";
    setRunningVisual(true);
    setFeedback("left", "继续作答！", "ok");
    setFeedback("right", "继续作答！", "ok");
    els.message.textContent = "已继续，快答题！";
    renderButtons();
  }
}

function cyclePreset() {
  const idx = PRESET_KEYS.indexOf(state.presetKey);
  state.presetKey = PRESET_KEYS[(idx + 1) % PRESET_KEYS.length];
  resetGame();
}

function cycleTarget() {
  state.targetIndex = (state.targetIndex + 1) % state.targets.length;
  resetGame();
}

function toggleSound() {
  state.audio = !state.audio;
  renderButtons();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (e) {}
}

function resetGame() {
  stopTimer();

  state.phase = "idle";
  state.timer = 0;
  state.rope = 0;
  state.left = { input: "0", answer: 0, score: 0, lastType: "" };
  state.right = { input: "0", answer: 0, score: 0, lastType: "" };

  els.timer.textContent = "00:00";
  els.winOverlay.classList.remove("show");
  setRunningVisual(false);

  generateQuestion("left");
  generateQuestion("right");

  renderButtons();
  renderScores();
  renderAnswers();
  renderRope();

  setFeedback("left", "准备好了就开始吧。");
  setFeedback("right", "准备好了就开始吧。");
  els.message.textContent = "规则：每答对一题，绳结向本队移动1格。";
}

function bindEvents() {
  els.leftPad.addEventListener("click", handlePadClick);
  els.rightPad.addEventListener("click", handlePadClick);

  els.startPauseBtn.addEventListener("click", startOrPause);
  els.resetBtn.addEventListener("click", resetGame);
  els.topResetBtn.addEventListener("click", resetGame);

  els.modeBtn.addEventListener("click", cyclePreset);
  els.targetBtn.addEventListener("click", cycleTarget);
  els.soundBtn.addEventListener("click", toggleSound);
  els.fullscreenBtn.addEventListener("click", toggleFullscreen);

  els.playAgainBtn.addEventListener("click", () => {
    els.winOverlay.classList.remove("show");
    resetGame();
  });
}

bindEvents();
resetGame();
