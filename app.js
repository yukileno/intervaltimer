/* ==========================================================================
   ドキドキ！どはでタイマー - アプリケーション・ロジック (堅牢デバッグ版)
   ========================================================================== */

// ログ出力用ヘルパー
function debugLog(msg, color = null) {
  const log = document.getElementById('debug-log');
  if (log) {
    if (color) {
      log.innerHTML += `<br><span style="color: ${color};">${msg}</span>`;
    } else {
      log.innerHTML += `<br>${msg}`;
    }
    log.scrollTop = log.scrollHeight; // 自動スクロール
  }
  console.log(msg);
}

// すぐに読み込まれたことを証明
debugLog("🚀 app.js の読み込みに成功しました（スクリプトパース開始）", "#00ff88");

// 簡易画面エラーデバッグ (万が一エラーが出た際に画面で確認可能にする)
window.addEventListener('error', function(e) {
  debugLog(`❌ JavaScript エラー: ${e.message} (${e.filename ? e.filename.split("/").pop() : '不明'}:${e.lineno}:${e.colno})`, "#ff3366");
});

// 1. 定数とデフォルト設定
const DEFAULT_TASKS = [
  { id: 't1', nameKanji: '漢字の練習', nameHiragana: 'かんじのれんしゅう', duration: 300, theme: 'theme-cyan' },
  { id: 't2', nameKanji: 'ちゅうけい（休憩）', nameHiragana: 'やすみじかん', duration: 120, theme: 'theme-magenta' },
  { id: 't3', nameKanji: '計算の練習', nameHiragana: 'けいさんのれんしゅう', duration: 300, theme: 'theme-yellow' }
];

const PRESETS = {
  'standard': [
    { nameKanji: '漢字の練習', nameHiragana: 'かんじのれんしゅう', minutes: 5, seconds: 0, theme: 'theme-cyan' },
    { nameKanji: 'やすみ時間', nameHiragana: 'やすみじかん', minutes: 2, seconds: 0, theme: 'theme-magenta' },
    { nameKanji: '計算の練習', nameHiragana: 'けいさんのれんしゅう', minutes: 5, seconds: 0, theme: 'theme-yellow' }
  ],
  'study-break': [
    { nameKanji: '国語のお勉強', nameHiragana: 'こくごのおべんきょう', minutes: 10, seconds: 0, theme: 'theme-cyan' },
    { nameKanji: 'のびのび休憩', nameHiragana: 'のびのびやすみ', minutes: 5, seconds: 0, theme: 'theme-magenta' },
    { nameKanji: '算数のテスト', nameHiragana: 'さんすうのテスト', minutes: 2, seconds: 0, theme: 'theme-yellow' }
  ],
  'free-time': [
    { nameKanji: '自由時間！', nameHiragana: 'じゆうじかん！', minutes: 15, seconds: 0, theme: 'theme-green' },
    { nameKanji: 'おかたづけ', nameHiragana: 'おかたづけ', minutes: 3, seconds: 0, theme: 'theme-magenta' }
  ],
  'test': [
    { nameKanji: '漢字（テスト）', nameHiragana: 'かんじ（てすと）', minutes: 0, seconds: 10, theme: 'theme-cyan' },
    { nameKanji: '休憩（テスト）', nameHiragana: 'やすみ（てすと）', minutes: 0, seconds: 10, theme: 'theme-magenta' },
    { nameKanji: '計算（テスト）', nameHiragana: 'けいさん（てすと）', minutes: 0, seconds: 10, theme: 'theme-yellow' }
  ]
};

// 2. アプリケーション状態変数
let tasks = [];
let currentTaskIndex = 0;
let remainingSeconds = 0;
let totalDuration = 0;
let isPaused = true;
let isHiragana = false;
let volume = 0.7;
let isMuted = false;
let loopEnabled = true;
let pulseEnabled = true;
let countdownSoundEnabled = true;

// タイマー精度向上のための変数 (Timestamp delta timing)
let timerId = null;
let lastTimestamp = 0;
let accumulatedMs = 0;

// Web Audio API 関連
let audioCtx = null;

// Canvas アニメーション関連
let particleCanvas, particleCtx;
let ambientCanvas, ambientCtx;
let particles = [];
let ambientOrbs = [];
let shockwaves = [];
let animationFrameId = null;
let flashOpacity = 0; // 切り替え時のホワイトアウト演出用

// SVG リングの外周長（半径85）
const RING_CIRCUMFERENCE = 2 * Math.PI * 85; // 約534.07

// 3. DOM要素を格納するオブジェクト
let DOM = {};

function initDOM() {
  debugLog("🛠️ DOMの解析を開始します...");
  DOM = {
    countdownTime: document.getElementById('countdown-time'),
    progressRing: document.getElementById('progress-ring'),
    currentTaskTitle: document.getElementById('current-task-title'),
    taskBadge: document.getElementById('task-badge'),
    nextTaskName: document.getElementById('next-task-name'),
    nextTaskPreviewArea: document.getElementById('next-task-preview-area'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    playIcon: document.getElementById('play-icon'),
    playText: document.getElementById('play-text'),
    resetBtn: document.getElementById('reset-btn'),
    skipBtn: document.getElementById('skip-btn'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    langToggleBtn: document.getElementById('lang-toggle-btn'),
    langToggleText: document.getElementById('lang-toggle-text'),
    appTitle: document.getElementById('app-title'),
    muteBtn: document.getElementById('mute-btn'),
    muteIcon: document.getElementById('mute-icon'),
    volumeSlider: document.getElementById('volume-slider'),
    scheduleList: document.getElementById('schedule-list'),
    addTaskForm: document.getElementById('add-task-form'),
    newMin: document.getElementById('new-task-minutes'),
    newSec: document.getElementById('new-task-seconds'),
    newKanji: document.getElementById('new-task-kanji'),
    newHiragana: document.getElementById('new-task-hiragana'),
    loopSwitch: document.getElementById('loop-switch'),
    pulseSwitch: document.getElementById('pulse-switch'),
    countdownSoundSwitch: document.getElementById('countdown-sound-switch'),
    chimeSelect: document.getElementById('chime-select')
  };

  // 欠損チェック
  let missing = [];
  for (const [key, el] of Object.entries(DOM)) {
    if (!el) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    debugLog(`⚠️ 以下のDOM要素が見つかりませんでした: ${missing.join(", ")}`, "#ffcc00");
  } else {
    debugLog("✅ すべての必要な画面パーツを正常に取得しました");
  }
}

// 4. 初期化処理
window.addEventListener('DOMContentLoaded', () => {
  try {
    debugLog("📅 DOMContentLoaded イベント検知 - 初期化プロセスを開始します");
    initDOM();
    
    debugLog("🎨 Canvas（演出画面）のセットアップ中...");
    setupCanvas();
    
    debugLog("💾 保存データとプリセットの読み込み中...");
    loadSettingsAndTasks();
    
    debugLog("⚡ 操作ボタンのイベント登録中...");
    setupEventListeners();
    
    debugLog("📺 画面表示（UI）の描画中...");
    updateUI();
    
    debugLog("🎮 アニメーション（演出ループ）の開始中...");
    animate();
    
    debugLog("🎉 タイマーの準備が完了しました！いつでも動かせます！", "#00ffff");
  } catch (err) {
    console.error("初期化処理でエラーが発生しました:", err);
    debugLog(`❌ 初期化中に障害が発生しました: ${err.message}`, "#ff3366");
  }
});

// Canvas セットアップ
function setupCanvas() {
  particleCanvas = document.getElementById('particle-canvas');
  particleCtx = particleCanvas ? particleCanvas.getContext('2d') : null;
  
  ambientCanvas = document.getElementById('ambient-canvas');
  ambientCtx = ambientCanvas ? ambientCanvas.getContext('2d') : null;
  
  if (!particleCtx || !ambientCtx) {
    debugLog("⚠️ Canvas コンテキストの取得に失敗しました", "#ffcc00");
  }
  
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  
  // 背景のアンビエントオーブを生成
  for (let i = 0; i < 8; i++) {
    ambientOrbs.push(createAmbientOrb());
  }
}

function resizeCanvases() {
  if (!particleCanvas || !ambientCanvas) return;
  
  const container = document.querySelector('.timer-visual-container');
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  
  particleCanvas.width = rect.width * 1.3 * scale;
  particleCanvas.height = rect.height * 1.3 * scale;
  if (particleCtx) particleCtx.scale(scale, scale);
  
  ambientCanvas.width = window.innerWidth * scale;
  ambientCanvas.height = window.innerHeight * scale;
  if (ambientCtx) ambientCtx.scale(scale, scale);
}

// 設定とタスクの読み込み
function loadSettingsAndTasks() {
  const savedTasks = localStorage.getItem('intervaltimer_tasks');
  if (savedTasks) {
    try {
      tasks = JSON.parse(savedTasks);
      if (!Array.isArray(tasks) || tasks.length === 0) {
        debugLog("💡 保存されたタスクリストが空だったため、デフォルト値を読み込みます");
        tasks = [...DEFAULT_TASKS];
      } else {
        debugLog(`💡 保存データから ${tasks.length} 件のタスクを読み込みました`);
      }
    } catch (e) {
      debugLog("⚠️ 保存タスクデータの解析に失敗したため、デフォルト値を読み込みます", "#ffcc00");
      tasks = [...DEFAULT_TASKS];
    }
  } else {
    debugLog("💡 保存データがないため、初期設定のタスクを読み込みました");
    tasks = [...DEFAULT_TASKS];
  }
  
  // オプション設定
  loopEnabled = localStorage.getItem('intervaltimer_loop') !== 'false';
  if (DOM.loopSwitch) DOM.loopSwitch.checked = loopEnabled;
  
  pulseEnabled = localStorage.getItem('intervaltimer_pulse') !== 'false';
  if (DOM.pulseSwitch) DOM.pulseSwitch.checked = pulseEnabled;

  countdownSoundEnabled = localStorage.getItem('intervaltimer_countdown_sound') !== 'false';
  if (DOM.countdownSoundSwitch) DOM.countdownSoundSwitch.checked = countdownSoundEnabled;

  const savedChime = localStorage.getItem('intervaltimer_chime');
  if (savedChime && DOM.chimeSelect) {
    DOM.chimeSelect.value = savedChime;
  }
  
  // ひらがなモード
  isHiragana = localStorage.getItem('intervaltimer_hiragana') === 'true';
  updateLanguageToggleUI();

  // 音量
  const savedVol = localStorage.getItem('intervaltimer_volume');
  if (savedVol !== null) {
    volume = parseFloat(savedVol);
    if (DOM.volumeSlider) DOM.volumeSlider.value = volume;
  }
  
  // 初期タスクの設定
  currentTaskIndex = 0;
  if (tasks.length > 0) {
    loadTask(0);
  }
}

// 5. 音声合成エンジン (Web Audio API)
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    debugLog("🔊 音声システム（AudioContext）を有効化しました");
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 音声生成用の汎用ヘルパー
function playTone(freq, duration, type = 'sine', gainVal = 0.5, slideTo = null) {
  if (isMuted || volume === 0) return;
  try {
    initAudio();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
    }
    
    gainNode.gain.setValueAtTime(gainVal * volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error("音声再生エラー:", e);
  }
}

// カウントダウン音 (ピッ)
function playCountdownBeep(high = false) {
  const freq = high ? 1200 : 800;
  const dur = high ? 0.3 : 0.15;
  playTone(freq, dur, 'sine', 0.6);
}

// 切り替え時の効果音
function playTransitionSound(type) {
  debugLog(`🎵 効果音再生: ${type}`);
  switch (type) {
    case 'fanfare-heroic':
      playHeroicFanfare();
      break;
    case 'retro-game':
      playRetroGameSound();
      break;
    case 'school-bell':
      playSchoolBellSound();
      break;
    case 'magic-sparkle':
      playMagicSparkleSound();
      break;
    default:
      playHeroicFanfare();
  }
}

// A. ヒーローファンファーレ (豪華な上昇和音)
function playHeroicFanfare() {
  const chords = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
  
  chords.forEach((freq, idx) => {
    setTimeout(() => {
      playTone(freq, 0.6, 'triangle', 0.4, freq * 1.05);
      playTone(freq * 2, 0.4, 'sine', 0.15);
    }, idx * 120);
  });
}

// B. レトロピコピコゲーム音 (矩形波による高速アルペジオ)
function playRetroGameSound() {
  const notes = [440, 554, 659, 880, 1109, 1318, 1760]; // A4, C#5, E5, A5...
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone(freq, 0.12, 'square', 0.3);
    }, idx * 60);
  });
}

// C. 学校のキーンコーンカーンコーン (伝統的なウェストミンスターチャイム風)
function playSchoolBellSound() {
  const notes = [349.23, 440.00, 392.00, 261.63];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone(freq, 1.2, 'sine', 0.4);
      playTone(freq * 2, 0.8, 'sine', 0.15);
      playTone(freq * 3, 0.6, 'sine', 0.05);
    }, idx * 700);
  });
}

// D. まほうのきらきら音 (高周波サイン波の連続)
function playMagicSparkleSound() {
  const notes = [880, 1046.50, 1174.66, 1318.51, 1567.98, 1760, 2093]; // A5, C6, D6, E6, G6, A6, C7
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      const randomFreq = notes[Math.floor(Math.random() * notes.length)];
      playTone(randomFreq + (Math.random() * 50 - 25), 0.25, 'sine', 0.25);
    }, i * 50);
  }
}

// 6. アニメーション & パーティクルエンジン
function createAmbientOrb() {
  return {
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 150 + 100,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    hue: Math.random() * 360,
    opacity: Math.random() * 0.15 + 0.05
  };
}

function updateAmbientOrbs() {
  ambientOrbs.forEach(orb => {
    orb.x += orb.vx;
    orb.y += orb.vy;
    
    if (orb.x < -orb.size) orb.x = window.innerWidth + orb.size;
    if (orb.x > window.innerWidth + orb.size) orb.x = -orb.size;
    if (orb.y < -orb.size) orb.y = window.innerHeight + orb.size;
    if (orb.y > window.innerHeight + orb.size) orb.y = -orb.size;
  });
}

function drawAmbientOrbs() {
  if (!ambientCtx) return;
  ambientCtx.clearRect(0, 0, ambientCanvas.width / (window.devicePixelRatio || 1), ambientCanvas.height / (window.devicePixelRatio || 1));
  
  ambientOrbs.forEach(orb => {
    const grad = ambientCtx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.size);
    grad.addColorStop(0, `hsla(${orb.hue}, 80%, 60%, ${orb.opacity})`);
    grad.addColorStop(1, 'rgba(5, 8, 20, 0)');
    
    ambientCtx.beginPath();
    ambientCtx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
    ambientCtx.fillStyle = grad;
    ambientCtx.fill();
  });
}

function spawnSpark(x, y, colorClass) {
  let color = '#00f2fe';
  if (colorClass === 'theme-magenta') color = '#ff2a85';
  if (colorClass === 'theme-yellow') color = '#ffd200';
  if (colorClass === 'theme-green') color = '#00e676';
  
  const angle = Math.random() * Math.PI * 2;
  const speed = Math.random() * 2 + 0.5;
  
  particles.push({
    x: x,
    y: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: Math.random() * 4 + 1.5,
    alpha: 1,
    decay: Math.random() * 0.02 + 0.01,
    color: color
  });
}

function spawnShockwave(x, y, colorClass) {
  let color = '#00f2fe';
  if (colorClass === 'theme-magenta') color = '#ff2a85';
  if (colorClass === 'theme-yellow') color = '#ffd200';
  if (colorClass === 'theme-green') color = '#00e676';

  shockwaves.push({
    x: x,
    y: y,
    radius: 5,
    maxRadius: 160,
    lineWidth: 15,
    alpha: 1,
    color: color
  });
  
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 6 + 2,
      alpha: 1,
      decay: Math.random() * 0.015 + 0.005,
      color: color
    });
  }
  
  flashOpacity = 0.8;
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.alpha -= p.decay;
    
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
  
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.radius += (sw.maxRadius - sw.radius) * 0.12;
    sw.lineWidth *= 0.92;
    sw.alpha -= 0.04;
    
    if (sw.alpha <= 0 || sw.lineWidth < 0.5) {
      shockwaves.splice(i, 1);
    }
  }
  
  if (flashOpacity > 0) {
    flashOpacity -= 0.03;
  }
}

function drawParticles() {
  if (!particleCtx) return;
  const w = particleCanvas.width / (window.devicePixelRatio || 1);
  const h = particleCanvas.height / (window.devicePixelRatio || 1);
  
  particleCtx.clearRect(0, 0, w, h);
  
  const centerX = w / 2;
  const centerY = h / 2;
  
  shockwaves.forEach(sw => {
    particleCtx.save();
    particleCtx.beginPath();
    particleCtx.arc(centerX, centerY, sw.radius, 0, Math.PI * 2);
    particleCtx.strokeStyle = sw.color;
    particleCtx.lineWidth = sw.lineWidth;
    particleCtx.globalAlpha = sw.alpha;
    particleCtx.shadowBlur = 15;
    particleCtx.shadowColor = sw.color;
    particleCtx.stroke();
    particleCtx.restore();
  });
  
  particles.forEach(p => {
    particleCtx.save();
    particleCtx.beginPath();
    particleCtx.arc(centerX + p.x, centerY + p.y, p.size, 0, Math.PI * 2);
    particleCtx.fillStyle = p.color;
    particleCtx.globalAlpha = p.alpha;
    particleCtx.shadowBlur = 8;
    particleCtx.shadowColor = p.color;
    particleCtx.fill();
    particleCtx.restore();
  });
  
  if (flashOpacity > 0) {
    particleCtx.save();
    particleCtx.fillStyle = '#ffffff';
    particleCtx.globalAlpha = flashOpacity;
    particleCtx.fillRect(0, 0, w, h);
    particleCtx.restore();
  }
}

function animate() {
  updateAmbientOrbs();
  drawAmbientOrbs();
  
  updateParticles();
  drawParticles();
  
  if (!isPaused && tasks.length > 0 && currentTaskIndex < tasks.length) {
    const currentTask = tasks[currentTaskIndex];
    const angle = ((remainingSeconds / totalDuration) * Math.PI * 2) - Math.PI / 2;
    const radius = 85;
    
    const sparkX = Math.cos(angle) * radius;
    const sparkY = Math.sin(angle) * radius;
    
    const isLastSpurt = remainingSeconds <= 10;
    const spawnRate = isLastSpurt ? 0.8 : 0.25;
    
    if (Math.random() < spawnRate) {
      spawnSpark(sparkX, sparkY, currentTask.theme);
      if (isLastSpurt) {
        spawnSpark(sparkX, sparkY, currentTask.theme);
      }
    }
  }
  
  animationFrameId = requestAnimationFrame(animate);
}

// 7. タイマー制御ロジック
function startTimer() {
  if (tasks.length === 0) {
    debugLog("⚠️ タスクが空のためスタートできません");
    return;
  }
  
  debugLog("▶️ タイマースタート");
  
  try {
    initAudio();
  } catch (e) {
    console.error("Audio init failed:", e);
  }
  
  isPaused = false;
  lastTimestamp = performance.now();
  accumulatedMs = 0;
  
  if (DOM.playPauseBtn) {
    DOM.playPauseBtn.classList.add('pulse');
  }
  if (DOM.playIcon) DOM.playIcon.textContent = '⏸️';
  if (DOM.playText) DOM.playText.textContent = isHiragana ? 'ストップ' : '一時停止';
  
  if (timerId) cancelAnimationFrame(timerId);
  timerId = requestAnimationFrame(runTimerLoop);
}

function pauseTimer() {
  debugLog("⏸️ タイマー一時停止");
  isPaused = true;
  if (timerId) {
    cancelAnimationFrame(timerId);
    timerId = null;
  }
  
  if (DOM.playPauseBtn) {
    DOM.playPauseBtn.classList.remove('pulse');
  }
  if (DOM.playIcon) DOM.playIcon.textContent = '▶️';
  if (DOM.playText) DOM.playText.textContent = isHiragana ? 'スタート' : 'スタート';
  document.body.classList.remove('pulse-active');
}

function runTimerLoop(timestamp) {
  if (isPaused) return;
  
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  accumulatedMs += delta;
  
  if (accumulatedMs >= 1000) {
    const elapsedSeconds = Math.floor(accumulatedMs / 1000);
    accumulatedMs %= 1000;
    
    remainingSeconds -= elapsedSeconds;
    
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      updateTimerDisplay();
      handleTaskCompletion();
      return; 
    } else {
      if (countdownSoundEnabled && remainingSeconds <= 3) {
        playCountdownBeep(remainingSeconds === 0);
      }
      
      if (pulseEnabled && remainingSeconds <= 10) {
        document.body.classList.add('pulse-active');
      } else {
        document.body.classList.remove('pulse-active');
      }
      
      updateTimerDisplay();
    }
  }
  
  timerId = requestAnimationFrame(runTimerLoop);
}

function handleTaskCompletion() {
  pauseTimer();
  document.body.classList.remove('pulse-active');
  
  if (currentTaskIndex >= tasks.length) return;
  const completedTask = tasks[currentTaskIndex];
  
  spawnShockwave(0, 0, completedTask.theme);
  
  if (DOM.chimeSelect) {
    playTransitionSound(DOM.chimeSelect.value);
  }
  
  setTimeout(() => {
    currentTaskIndex++;
    
    if (currentTaskIndex >= tasks.length) {
      if (loopEnabled) {
        currentTaskIndex = 0;
        loadTask(currentTaskIndex);
        startTimer();
      } else {
        currentTaskIndex = 0;
        loadTask(currentTaskIndex);
        alertUserAllDone();
      }
    } else {
      loadTask(currentTaskIndex);
      startTimer();
    }
  }, 1200);
}

function alertUserAllDone() {
  updateUI();
  setTimeout(() => {
    if (DOM.chimeSelect) {
      playTransitionSound(DOM.chimeSelect.value);
    }
  }, 500);
}

function loadTask(index) {
  if (index < 0 || index >= tasks.length) return;
  currentTaskIndex = index;
  const task = tasks[index];
  totalDuration = task.duration;
  remainingSeconds = totalDuration;
  
  debugLog(`📋 タスクを読み込みました: ${task.nameKanji} (${task.duration}秒)`);
  updateActiveThemeColors(task.theme);
  updateUI();
}

function updateActiveThemeColors(themeClass) {
  const root = document.documentElement;
  
  let activeColor = '#00f2fe';
  let activeGlow = 'rgba(0, 242, 254, 0.35)';
  
  if (themeClass === 'theme-magenta') {
    activeColor = '#ff2a85';
    activeGlow = 'rgba(255, 42, 133, 0.35)';
  } else if (themeClass === 'theme-yellow') {
    activeColor = '#ffd200';
    activeGlow = 'rgba(255, 210, 0, 0.35)';
  } else if (themeClass === 'theme-green') {
    activeColor = '#00e676';
    activeGlow = 'rgba(0, 230, 118, 0.35)';
  }
  
  root.style.setProperty('--active-color', activeColor);
  root.style.setProperty('--active-glow', activeGlow);
}

// 8. UI 更新ロジック
function updateUI() {
  updateTimerDisplay();
  updateScheduleList();
  
  if (tasks.length === 0) {
    if (DOM.currentTaskTitle) {
      DOM.currentTaskTitle.textContent = isHiragana ? 'タイマーをいれよう！' : 'タイマーを追加しよう！';
    }
    if (DOM.taskBadge) {
      DOM.taskBadge.textContent = isHiragana ? 'じゅんび中' : '準備中';
    }
    if (DOM.nextTaskName) {
      DOM.nextTaskName.textContent = isHiragana ? 'なし' : 'なし';
    }
    if (DOM.nextTaskPreviewArea) {
      DOM.nextTaskPreviewArea.style.opacity = '0';
    }
    return;
  }
  
  if (currentTaskIndex >= tasks.length) return;
  const currentTask = tasks[currentTaskIndex];
  
  if (DOM.currentTaskTitle) {
    DOM.currentTaskTitle.textContent = isHiragana ? currentTask.nameHiragana : currentTask.nameKanji;
  }
  if (DOM.taskBadge) {
    DOM.taskBadge.textContent = isHiragana ? `じかん ${currentTaskIndex + 1}/${tasks.length}` : `時間 ${currentTaskIndex + 1}/${tasks.length}`;
  }
  
  const nextIndex = currentTaskIndex + 1;
  if (nextIndex < tasks.length) {
    const nextTask = tasks[nextIndex];
    if (DOM.nextTaskName) {
      DOM.nextTaskName.textContent = isHiragana ? nextTask.nameHiragana : nextTask.nameKanji;
    }
    if (DOM.nextTaskPreviewArea) DOM.nextTaskPreviewArea.style.opacity = '1';
  } else {
    if (loopEnabled) {
      const firstTask = tasks[0];
      if (DOM.nextTaskName) {
        DOM.nextTaskName.textContent = (isHiragana ? firstTask.nameHiragana : firstTask.nameKanji) + '（最初からループ）';
      }
      if (DOM.nextTaskPreviewArea) DOM.nextTaskPreviewArea.style.opacity = '1';
    } else {
      if (DOM.nextTaskName) {
        DOM.nextTaskName.textContent = isHiragana ? 'おしまい' : 'おしまい';
      }
      if (DOM.nextTaskPreviewArea) DOM.nextTaskPreviewArea.style.opacity = '0.5';
    }
  }
}

function updateTimerDisplay() {
  if (!DOM.countdownTime) return;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  
  const minStr = String(minutes).padStart(2, '0');
  const secStr = String(seconds).padStart(2, '0');
  
  DOM.countdownTime.textContent = `${minStr}:${secStr}`;
  
  if (DOM.progressRing && totalDuration > 0) {
    const ratio = remainingSeconds / totalDuration;
    const strokeDashoffset = RING_CIRCUMFERENCE * (1 - ratio);
    DOM.progressRing.style.strokeDashoffset = strokeDashoffset;
    DOM.progressRing.style.strokeDasharray = RING_CIRCUMFERENCE;
    
    if (remainingSeconds <= 10) {
      DOM.progressRing.style.stroke = 'url(#ring-gradient-danger)';
    } else if (remainingSeconds <= 30) {
      DOM.progressRing.style.stroke = 'url(#ring-gradient-warning)';
    } else {
      DOM.progressRing.style.stroke = 'url(#ring-gradient-ok)';
    }
  } else if (DOM.progressRing) {
    DOM.progressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
  }
}

function updateScheduleList() {
  if (!DOM.scheduleList) return;
  DOM.scheduleList.innerHTML = '';
  
  tasks.forEach((task, idx) => {
    const item = document.createElement('div');
    item.className = `schedule-item ${task.theme} ${idx === currentTaskIndex ? 'current-item' : ''}`;
    
    const minutes = Math.floor(task.duration / 60);
    const seconds = task.duration % 60;
    const timeString = `${minutes}分${seconds > 0 ? seconds + '秒' : ''}`;
    const timeStringHiragana = `${minutes}ふん${seconds > 0 ? seconds + 'びょう' : ''}`;
    
    const taskName = isHiragana ? task.nameHiragana : task.nameKanji;
    const durationLabel = isHiragana ? timeStringHiragana : timeString;
    
    item.innerHTML = `
      <div class="schedule-item-info">
        <span class="item-index">${idx + 1}</span>
        <span class="item-name">${escapeHTML(taskName)}</span>
        <span class="item-duration">${durationLabel}</span>
      </div>
      <div class="schedule-item-actions">
        <button class="action-btn move-up-btn" data-index="${idx}" title="上へ移動" aria-label="上へ移動">▲</button>
        <button class="action-btn move-down-btn" data-index="${idx}" title="下へ移動" aria-label="下へ移動">▼</button>
        <button class="action-btn delete-btn" data-index="${idx}" title="削除する" aria-label="削除する">🗑️</button>
      </div>
    `;
    
    DOM.scheduleList.appendChild(item);
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// 9. イベントリスナー登録
function setupEventListeners() {
  if (DOM.playPauseBtn) {
    DOM.playPauseBtn.addEventListener('click', () => {
      if (isPaused) {
        startTimer();
      } else {
        pauseTimer();
      }
    });
  }
  
  if (DOM.resetBtn) {
    DOM.resetBtn.addEventListener('click', () => {
      pauseTimer();
      loadTask(currentTaskIndex);
    });
  }
  
  if (DOM.skipBtn) {
    DOM.skipBtn.addEventListener('click', () => {
      pauseTimer();
      if (tasks.length === 0) return;
      
      spawnShockwave(0, 0, tasks[currentTaskIndex].theme);
      
      setTimeout(() => {
        currentTaskIndex = (currentTaskIndex + 1) % tasks.length;
        loadTask(currentTaskIndex);
      }, 200);
    });
  }

  if (DOM.langToggleBtn) {
    DOM.langToggleBtn.addEventListener('click', () => {
      isHiragana = !isHiragana;
      localStorage.setItem('intervaltimer_hiragana', isHiragana);
      updateLanguageToggleUI();
      updateUI();
    });
  }
  
  if (DOM.volumeSlider) {
    DOM.volumeSlider.addEventListener('input', (e) => {
      volume = parseFloat(e.target.value);
      localStorage.setItem('intervaltimer_volume', volume);
      if (volume > 0) {
        isMuted = false;
        if (DOM.muteIcon) DOM.muteIcon.textContent = '🔊';
      } else {
        if (DOM.muteIcon) DOM.muteIcon.textContent = '🔇';
      }
    });
  }
  
  if (DOM.muteBtn) {
    DOM.muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      if (isMuted) {
        if (DOM.muteIcon) DOM.muteIcon.textContent = '🔇';
      } else {
        if (DOM.muteIcon) DOM.muteIcon.textContent = volume > 0 ? '🔊' : '🔇';
        playTone(600, 0.05, 'sine', 0.2);
      }
    });
  }

  if (DOM.fullscreenBtn) {
    DOM.fullscreenBtn.addEventListener('click', toggleFullscreen);
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      if (DOM.playPauseBtn) DOM.playPauseBtn.click();
    } else if (e.code === 'KeyR') {
      if (DOM.resetBtn) DOM.resetBtn.click();
    } else if (e.code === 'KeyN') {
      if (DOM.skipBtn) DOM.skipBtn.click();
    } else if (e.code === 'KeyF') {
      if (DOM.fullscreenBtn) DOM.fullscreenBtn.click();
    }
  });

  if (DOM.scheduleList) {
    DOM.scheduleList.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (isNaN(index)) return;
      
      if (e.target.classList.contains('delete-btn')) {
        deleteTask(index);
      } else if (e.target.classList.contains('move-up-btn')) {
        moveTask(index, -1);
      } else if (e.target.classList.contains('move-down-btn')) {
        moveTask(index, 1);
      }
    });
  }

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      loadPreset(presetKey);
    });
  });

  document.querySelectorAll('.quick-time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const min = parseInt(btn.dataset.time);
      if (DOM.newMin) DOM.newMin.value = min;
      if (DOM.newSec) DOM.newSec.value = 0;
    });
  });

  if (DOM.addTaskForm) {
    DOM.addTaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const nameKanji = DOM.newKanji ? DOM.newKanji.value.trim() : '';
      const nameHiragana = DOM.newHiragana ? DOM.newHiragana.value.trim() : '';
      const min = DOM.newMin ? (parseInt(DOM.newMin.value) || 0) : 0;
      const sec = DOM.newSec ? (parseInt(DOM.newSec.value) || 0) : 0;
      
      const duration = min * 60 + sec;
      if (duration <= 0) {
        alert(isHiragana ? '時間は1秒以上にしてください！' : '時間は1秒以上に設定してください！');
        return;
      }
      
      const themeRadio = document.querySelector('input[name="task-theme"]:checked');
      const theme = themeRadio ? themeRadio.value : 'theme-cyan';
      
      const newTask = {
        id: 'task_' + Date.now(),
        nameKanji: nameKanji,
        nameHiragana: nameHiragana,
        duration: duration,
        theme: theme
      };
      
      tasks.push(newTask);
      saveTasks();
      
      if (DOM.newKanji) DOM.newKanji.value = '';
      if (DOM.newHiragana) DOM.newHiragana.value = '';
      if (DOM.newMin) DOM.newMin.value = 5;
      if (DOM.newSec) DOM.newSec.value = 0;
      
      if (tasks.length === 1) {
        loadTask(0);
      } else {
        updateUI();
      }
    });
  }

  if (DOM.loopSwitch) {
    DOM.loopSwitch.addEventListener('change', (e) => {
      loopEnabled = e.target.checked;
      localStorage.setItem('intervaltimer_loop', loopEnabled);
      updateUI();
    });
  }
  
  if (DOM.pulseSwitch) {
    DOM.pulseSwitch.addEventListener('change', (e) => {
      pulseEnabled = e.target.checked;
      localStorage.setItem('intervaltimer_pulse', pulseEnabled);
      if (!pulseEnabled) {
        document.body.classList.remove('pulse-active');
      }
    });
  }

  if (DOM.countdownSoundSwitch) {
    DOM.countdownSoundSwitch.addEventListener('change', (e) => {
      countdownSoundEnabled = e.target.checked;
      localStorage.setItem('intervaltimer_countdown_sound', countdownSoundEnabled);
    });
  }
  
  if (DOM.chimeSelect) {
    DOM.chimeSelect.addEventListener('change', (e) => {
      localStorage.setItem('intervaltimer_chime', e.target.value);
      playTransitionSound(e.target.value);
    });
  }
}

// 10. タスク操作
function saveTasks() {
  localStorage.setItem('intervaltimer_tasks', JSON.stringify(tasks));
}

function deleteTask(index) {
  if (index < 0 || index >= tasks.length) return;
  
  tasks.splice(index, 1);
  saveTasks();
  
  if (tasks.length === 0) {
    pauseTimer();
    currentTaskIndex = 0;
    remainingSeconds = 0;
    totalDuration = 0;
  } else {
    if (currentTaskIndex >= tasks.length) {
      currentTaskIndex = tasks.length - 1;
    }
    
    if (index === currentTaskIndex) {
      loadTask(currentTaskIndex);
    } else if (index < currentTaskIndex) {
      currentTaskIndex--;
    }
  }
  
  updateUI();
}

function moveTask(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= tasks.length) return;
  
  const temp = tasks[index];
  tasks[index] = tasks[targetIndex];
  tasks[targetIndex] = temp;
  
  saveTasks();
  
  if (currentTaskIndex === index) {
    currentTaskIndex = targetIndex;
  } else if (currentTaskIndex === targetIndex) {
    currentTaskIndex = index;
  }
  
  updateUI();
}

function loadPreset(key) {
  const presetData = PRESETS[key];
  if (!presetData) return;
  
  pauseTimer();
  
  tasks = presetData.map((item, idx) => ({
    id: `preset_${key}_${idx}_${Date.now()}`,
    nameKanji: item.nameKanji,
    nameHiragana: item.nameHiragana,
    duration: item.minutes * 60 + item.seconds,
    theme: item.theme
  }));
  
  saveTasks();
  loadTask(0);
}

// 11. ひらがな・漢字のUI変更
function updateLanguageToggleUI() {
  const allTranslatableElements = document.querySelectorAll('[data-kanji][data-hiragana]');
  
  allTranslatableElements.forEach(el => {
    const text = isHiragana ? el.dataset.hiragana : el.dataset.kanji;
    
    if (el.tagName === 'INPUT') {
      el.placeholder = text;
    } else {
      const btnTextEl = el.querySelector('.btn-text, .control-text');
      if (btnTextEl) {
        btnTextEl.textContent = text;
      } else {
        el.textContent = text;
      }
    }
  });

  if (DOM.langToggleText) {
    DOM.langToggleText.textContent = isHiragana ? '漢字（かんじ）にする' : 'ひらがな にする';
  }
  if (DOM.appTitle) {
    DOM.appTitle.textContent = isHiragana ? 'ドキドキ！どはでタイマー' : 'ドキドキ！どはでタイマー';
  }
}

// 12. フルスクリーン
function toggleFullscreen() {
  const isFS = document.body.classList.contains('fullscreen-mode');
  
  if (!isFS) {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
    }
    document.body.classList.add('fullscreen-mode');
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    document.body.classList.remove('fullscreen-mode');
  }
  
  setTimeout(resizeCanvases, 100);
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove('fullscreen-mode');
    resizeCanvases();
  }
});
