// --- 状態 ---
let names = ['Aさん', 'Bさん', 'Cさん'];
let prizes = ['1等', '2等', '3等'];
let bridges = [];
let animating = false;
let revealed = [];

const ROWS = 12;
const COL_W = 100;
const ROW_H = 40;
const TOP_PAD = 60;
const BOT_PAD = 60;
const SIDE_PAD = 60;

// --- 初期化 ---
window.onload = () => {
  renderInputs();
};

function renderInputs() {
  renderList('names-list', names, 'name');
  renderList('prizes-list', prizes, 'prize');
}

function renderList(containerId, arr, type) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  arr.forEach((val, i) => {
    const row = document.createElement('div');
    row.className = 'input-row';
    row.innerHTML = `
      <input type="text" value="${val}" placeholder="${type === 'name' ? '名前' : '結果'}"
        oninput="${type === 'name' ? 'names' : 'prizes'}[${i}] = this.value">
      <button class="btn-delete" onclick="removeItem('${type}', ${i})">×</button>
    `;
    el.appendChild(row);
  });
}

function addName() {
  names.push('');
  syncPrizes();
  renderInputs();
}

function addPrize() {
  prizes.push('');
  syncNames();
  renderInputs();
}

function syncPrizes() {
  while (prizes.length < names.length) prizes.push('');
  while (prizes.length > names.length) prizes.pop();
}

function syncNames() {
  while (names.length < prizes.length) names.push('');
  while (names.length > prizes.length) names.pop();
}

function removeItem(type, i) {
  if (type === 'name') {
    names.splice(i, 1);
    if (prizes.length > names.length) prizes.pop();
  } else {
    prizes.splice(i, 1);
    if (names.length > prizes.length) names.pop();
  }
  renderInputs();
}

// --- あみだ生成 ---
function startAmida() {
  // 入力値を最新化
  document.querySelectorAll('#names-list input').forEach((el, i) => names[i] = el.value || `参加者${i+1}`);
  document.querySelectorAll('#prizes-list input').forEach((el, i) => prizes[i] = el.value || `${i+1}等`);

  const n = Math.max(names.length, prizes.length);
  while (names.length < n) names.push(`参加者${names.length+1}`);
  while (prizes.length < n) prizes.push(`${prizes.length+1}等`);

  generateBridges(n);
  revealed = new Array(n).fill(false);

  document.getElementById('setup-screen').classList.remove('active');
  document.getElementById('amida-screen').classList.add('active');

  drawAmida();
}

function generateBridges(n) {
  bridges = [];
  for (let row = 0; row < ROWS; row++) {
    let usedCols = new Set();
    for (let col = 0; col < n - 1; col++) {
      if (!usedCols.has(col) && !usedCols.has(col + 1) && Math.random() < 0.45) {
        bridges.push({ row, col });
        usedCols.add(col);
        usedCols.add(col + 1);
      }
    }
  }
}

// --- 描画 ---
function getCanvasSize(n) {
  return {
    w: SIDE_PAD * 2 + COL_W * (n - 1),
    h: TOP_PAD + ROW_H * ROWS + BOT_PAD,
  };
}

function colX(col) { return SIDE_PAD + col * COL_W; }
function rowY(row) { return TOP_PAD + row * ROW_H; }

function drawAmida(highlightCol = -1, pathCells = []) {
  const n = names.length;
  const canvas = document.getElementById('amida-canvas');
  const { w, h } = getCanvasSize(n);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, w, h);

  // 縦線
  for (let col = 0; col < n; col++) {
    ctx.beginPath();
    ctx.moveTo(colX(col), TOP_PAD);
    ctx.lineTo(colX(col), TOP_PAD + ROW_H * ROWS);
    ctx.strokeStyle = col === highlightCol ? '#667eea' : '#ccc';
    ctx.lineWidth = col === highlightCol ? 3 : 2;
    ctx.stroke();
  }

  // 横線（橋）
  for (const b of bridges) {
    const onPath = pathCells.some(p => p.row === b.row && p.col === b.col);
    ctx.beginPath();
    ctx.moveTo(colX(b.col), rowY(b.row) + ROW_H / 2);
    ctx.lineTo(colX(b.col + 1), rowY(b.row) + ROW_H / 2);
    ctx.strokeStyle = onPath ? '#e53935' : '#bbb';
    ctx.lineWidth = onPath ? 3 : 2;
    ctx.stroke();
  }

  // 上部ラベル（名前）
  for (let col = 0; col < n; col++) {
    const isSelected = col === highlightCol;
    ctx.fillStyle = isSelected ? '#667eea' : '#444';
    ctx.font = isSelected ? 'bold 14px sans-serif' : '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(names[col], colX(col), TOP_PAD - 10);
  }

  // 下部ラベル（結果）
  for (let col = 0; col < n; col++) {
    const destCol = getDestination(col);
    const isRevealed = revealed[col];
    const isSelected = col === highlightCol;

    // 結果ボックス
    const bx = colX(destCol) - 36;
    const by = TOP_PAD + ROW_H * ROWS + 8;
    ctx.fillStyle = isSelected ? '#667eea' : (isRevealed ? '#f3f0ff' : '#f5f5f5');
    ctx.beginPath();
    ctx.roundRect(bx, by, 72, 30, 6);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#667eea' : '#ddd';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    if (isRevealed || isSelected) {
      ctx.fillStyle = isSelected ? 'white' : '#555';
      ctx.font = isSelected ? 'bold 13px sans-serif' : '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prizes[destCol], colX(destCol), by + 20);
    } else {
      ctx.fillStyle = '#bbb';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('？', colX(destCol), by + 20);
    }
  }

  // クリック判定用に名前の位置を設定
  canvas.onclick = (e) => handleClick(e, canvas, n);
}

function handleClick(e, canvas, n) {
  if (animating) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  for (let col = 0; col < n; col++) {
    const cx = colX(col);
    if (Math.abs(x - cx) < 36 && y < TOP_PAD) {
      animatePath(col);
      return;
    }
  }
}

// --- パス計算 ---
function getDestination(startCol) {
  let col = startCol;
  for (let row = 0; row < ROWS; row++) {
    const bridge = bridges.find(b => b.row === row && b.col === col);
    if (bridge) { col = col + 1; continue; }
    const bridgeLeft = bridges.find(b => b.row === row && b.col === col - 1);
    if (bridgeLeft) { col = col - 1; }
  }
  return col;
}

function getPath(startCol) {
  let col = startCol;
  const path = [];
  for (let row = 0; row < ROWS; row++) {
    const bridge = bridges.find(b => b.row === row && b.col === col);
    if (bridge) {
      path.push({ row, col, dir: 'right' });
      col = col + 1;
      continue;
    }
    const bridgeLeft = bridges.find(b => b.row === row && b.col === col - 1);
    if (bridgeLeft) {
      path.push({ row, col, dir: 'left' });
      col = col - 1;
    }
  }
  return { finalCol: col, path };
}

// --- アニメーション ---
function animatePath(startCol) {
  animating = true;
  const n = names.length;
  const { finalCol, path } = getPath(startCol);
  const pathSet = new Set(path.map(p => `${p.row},${p.col === startCol ? p.col : (p.dir === 'right' ? p.col - 1 : p.col + 1)}`));

  let step = 0;
  const pathCells = [];

  function tick() {
    if (step <= path.length) {
      const cells = path.slice(0, step);
      drawAmida(startCol, cells);
      drawAnimatedDot(startCol, step, path);
      step++;
      requestAnimationFrame(tick);
    } else {
      revealed[startCol] = true;
      drawAmida(startCol, path);
      animating = false;
    }
  }
  tick();
}

function drawAnimatedDot(startCol, step, path) {
  const canvas = document.getElementById('amida-canvas');
  const ctx = canvas.getContext('2d');

  let col = startCol;
  let y = TOP_PAD;

  // stepに応じた現在位置計算
  let currentRow = step;
  for (let i = 0; i < Math.min(step, path.length); i++) {
    const p = path[i];
    if (p.dir === 'right') col++;
    else if (p.dir === 'left') col--;
  }

  const dotY = step < ROWS
    ? TOP_PAD + step * ROW_H
    : TOP_PAD + ROWS * ROW_H;

  ctx.beginPath();
  ctx.arc(colX(col), dotY, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#e53935';
  ctx.fill();
}

// --- リセット ---
function resetAll() {
  names = ['Aさん', 'Bさん', 'Cさん'];
  prizes = ['1等', '2等', '3等'];
  bridges = [];
  revealed = [];
  animating = false;

  document.getElementById('amida-screen').classList.remove('active');
  document.getElementById('setup-screen').classList.add('active');
  renderInputs();
}
