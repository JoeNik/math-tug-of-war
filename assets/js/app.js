const state = {
  started: false,
  modeIndex: 0,
  modes: ["add", "sub", "mul"],
  targetIndex: 0,
  targets: [5, 7, 10],
  timer: 0,
  timerId: null,
  audio: true,
  left: { input: "", score: 0, a: 0, b: 0, answer: 0 },
  right: { input: "", score: 0, a: 0, b: 0, answer: 0 },
  rope: 0
};

const $ = (id) => document.getElementById(id);

const els = {
  leftQuestion: $("leftQuestion"),
  rightQuestion: $("rightQuestion"),
  leftAnswer: $("leftAnswer"),
  rightAnswer: $("rightAnswer"),
  leftScore: $("leftScore"),
  rightScore: $("rightScore"),
  leftBadge: $("leftBadge"),
  rightBadge: $("rightBadge"),
  timer: $("timer"),
  message: $("message"),
  startBtn: $("startBtn"),
  restartBtn: $("restartBtn"),
  topRestartBtn: $("topRestartBtn"),
  modeBtn: $("modeBtn"),
  targetBtn: $("targetBtn"),
  soundBtn: $("soundBtn"),
  fullscreenBtn: $("fullscreenBtn"),
  leftPad: $("leftPad"),
  rightPad: $("rightPad"),
  winOverlay: $("winOverlay"),
  winnerText: $("winnerText"),
  winnerSub: $("winnerSub"),
  playAgainBtn: $("playAgainBtn"),
  closeOverlayBtn: $("closeOverlayBtn"),
  centerPanel: $("centerPanel")
};

function currentMode() {
  return state.modes[state.modeIndex];
}

function currentTarget() {
  return state.targets[state.targetIndex];
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setMessage(text) {
  els.message.textContent = text;
}

function renderAnswers() {
  els.leftAnswer.innerHTML = state.left.input || "&nbsp;";
  els.rightAnswer.innerHTML = state.right.input || "&nbsp;";
}

function renderScores() {
  els.leftScore.textContent = state.left.score;
  els.rightScore.textContent = state.right.score;
  els.leftBadge.textContent = state.left.score;
  els.rightBadge.textContent = state.right.score;
}

function renderButtons() {
  const modeNameMap = {
    add: "加法",
    sub: "减法",
    mul: "乘法"
  };

  els.modeBtn.textContent = `模式：${modeNameMap[currentMode()]}`;
  els.targetBtn.textContent = `目标：${currentTarget()}步获胜`;
  els.soundBtn.textContent = state.audio ? "🔊" : "🔇";
}

function renderRope() {
  const shift = state.rope * 42;
  document.documentElement.style.setProperty("--arena-shift", `${shift}px`);
}

function flash(el, cls) {
  el.classList.remove("correct-flash", "wrong-flash");
  void el.offsetWidth;
  el.classList.add(cls);
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

    if (type === "ok") osc.frequency.value = 740;
    if (type === "wrong") osc.frequency.value = 220;
    if (type === "win") osc.frequency.value = 980;

    gain.gain.value = 0.05;
    osc.start();
    osc.stop(ctx.currentTime + (type === "win" ? 0.2 : 0.12));
  } catch (e) {}
}

function speak(text) {
  if (!state.audio || !("speechSynthesis" in window)) return;

  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1;
    u.pitch = 1;
    speechSynthesis.speak(u);
  } catch (e) {}
}

function generateQuestion(mode) {
  let a, b, answer, text;

  if (mode === "add") {
    a = rand(1, 9);
    b = rand(1, 9);
    answer = a + b;
    text = `${a} + ${b} = ?`;
  } else if (mode === "sub") {
    a = rand(2, 18);
    b = rand(1, a);
    answer = a - b;
    text = `${a} - ${b} = ?`;
  } else {
    a = rand(1, 9);
    b = rand(1, 9);
    answer = a * b;
    text = `${a} × ${b} = ?`;
  }

  return { a, b, answer, text };
}

function createQuestion(side) {
  const question = generateQuestion(currentMode());

  state[side].a = question.a;
  state[side].b = question.b;
  state[side].answer = question.answer;
  state[side].input = "";

  if (side === "left") {
    els.leftQuestion.textContent = question.text;
  } else {
    els.rightQuestion.textContent = question.text;
  }

  renderAnswers();
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.timer++;
    els.timer.textContent = formatTime(state.timer);
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function startGame() {
  if (state.started) return;

  state.started = true;
  startTimer();
  createQuestion("left");
  createQuestion("right");
  setMessage("游戏开始！两边快答题，答对就能把绳子拉向自己！");
  speak("游戏开始");
}

function stopGame() {
  state.started = false;
  stopTimer();
}

function resetGame() {
  stopGame();

  state.timer = 0;
  state.rope = 0;
  state.left.input = "";
  state.right.input = "";
  state.left.score = 0;
  state.right.score = 0;

  els.timer.textContent = "00:00";

  renderAnswers();
  renderScores();
  renderRope();
  renderButtons();

  createQuestion("left");
  createQuestion("right");

  setMessage("点击“开始游戏”，左右两队分别输入答案，答对就向自己方向拉绳！");
  els.centerPanel.classList.remove("winner-glow");
  els.winOverlay.classList.remove("show");
}

function win(side) {
  stopGame();
  els.centerPanel.classList.add("winner-glow");

  const teamName = side === "left" ? "Team 1" : "Team 2";
  const emoji = side === "left" ? "🔵" : "🔴";

  els.winnerText.textContent = `${emoji} ${teamName} 获胜！`;
  els.winnerSub.textContent = `用时 ${formatTime(state.timer)} · 比分 ${state.left.score} : ${state.right.score}`;
  els.winOverlay.classList.add("show");

  setMessage(`🎉 ${teamName} 获胜！用时 ${formatTime(state.timer)}`);
  beep("win");
  speak(side === "left" ? "第一队获胜" : "第二队获胜");
}

function checkWin() {
  const target = currentTarget();

  if (state.rope <= -target) {
    win("left");
  } else if (state.rope >= target) {
    win("right");
  }
}

function submit(side) {
  if (!state.started) return;

  const team = state[side];
  if (team.input === "") return;

  const display = side === "left" ? els.leftAnswer : els.rightAnswer;
  const correct = Number(team.input) === team.answer;

  if (correct) {
    flash(display, "correct-flash");
    beep("ok");

    team.score += 1;

    if (side === "left") {
      state.rope -= 1;
      setMessage("Team 1 回答正确，绳子向左移动！");
      speak("左边答对了");
    } else {
      state.rope += 1;
      setMessage("Team 2 回答正确，绳子向右移动！");
      speak("右边答对了");
    }

    renderScores();
    renderRope();
    createQuestion(side);
    checkWin();
  } else {
    flash(display, "wrong-flash");
    beep("wrong");
    setMessage(side === "left" ? "Team 1 答错了，再试一次！" : "Team 2 答错了，再试一次！");
    team.input = "";
    renderAnswers();
  }
}

function handlePadClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;

  const side = btn.dataset.side;
  const val = btn.dataset.val;
  const action = btn.dataset.action;

  if (!side) return;

  if (!state.started && action !== "clear") {
    startGame();
  }

  const team = state[side];

  if (action === "clear") {
    team.input = "";
    renderAnswers();
    return;
  }

  if (action === "submit") {
    submit(side);
    return;
  }

  if (typeof val !== "undefined") {
    const limit = 2;
    if (team.input.length < limit) {
      team.input += val;
      renderAnswers();
    }
  }
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      document.body.classList.add("fullscreen");
    } else {
      await document.exitFullscreen();
      document.body.classList.remove("fullscreen");
    }
  } catch (e) {}
}

function cycleMode() {
  state.modeIndex = (state.modeIndex + 1) % state.modes.length;
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

function bindEvents() {
  els.leftPad.addEventListener("click", handlePadClick);
  els.rightPad.addEventListener("click", handlePadClick);

  els.startBtn.addEventListener("click", startGame);
  els.restartBtn.addEventListener("click", resetGame);
  els.topRestartBtn.addEventListener("click", resetGame);

  els.modeBtn.addEventListener("click", cycleMode);
  els.targetBtn.addEventListener("click", cycleTarget);
  els.soundBtn.addEventListener("click", toggleSound);
  els.fullscreenBtn.addEventListener("click", toggleFullscreen);

  els.playAgainBtn.addEventListener("click", resetGame);
  els.closeOverlayBtn.addEventListener("click", () => {
    els.winOverlay.classList.remove("show");
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove("fullscreen");
    }
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();

    const leftMap = {
      q: "1", w: "2", e: "3",
      a: "4", s: "5", d: "6",
      z: "7", x: "8", c: "9",
      v: "0"
    };

    const rightMap = {
      "1": "1", "2": "2", "3": "3",
      "4": "4", "5": "5", "6": "6",
      "7": "7", "8": "8", "9": "9",
      "0": "0"
    };

    if (!state.started && (/^[0-9]$/.test(k) || leftMap[k])) {
      startGame();
    }

    if (leftMap[k]) {
      if (state.left.input.length < 2) {
        state.left.input += leftMap[k];
        renderAnswers();
      }
      return;
    }

    if (rightMap[k]) {
      if (state.right.input.length < 2) {
        state.right.input += rightMap[k];
        renderAnswers();
      }
      return;
    }

    if (k === " ") {
      e.preventDefault();
      submit("left");
    }

    if (k === "enter") {
      submit("right");
    }

    if (k === "tab") {
      e.preventDefault();
      state.left.input = "";
      renderAnswers();
    }

    if (k === "backspace") {
      state.right.input = "";
      renderAnswers();
    }

    if (k === "f") toggleFullscreen();
    if (k === "r") resetGame();
  });
}

function init() {
  bindEvents();
  resetGame();
}

init();