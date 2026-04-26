// --- 状態 ---
let names = ['Aさん', 'Bさん', 'Cさん'];
let prizes = ['1等', '2等', '3等'];
let shuffledPrizes = [];
let bridges = [];
let animating = false;
let revealed = [];

const ROWS = 12;
const COL_W = 100;
const ROW_H = 40;
const TOP_PAD = 60;
const BOT_PAD = 60;
const SIDE_PAD = 60;
const HIT_RADIUS = 18;

// --- 初期化 ---
window.onload = () => { renderInputs(); };

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

function addName() { names.push(''); syncPrizes(); renderInputs(); }
function addPrize() { prizes.push(''); syncNames(); renderInputs(); }

function syncPrizes() {
  while (prizes.length < names.length) prizes.push('');
  while (prizes.length > names.length) prizes.pop();
}
function syncNames() {
  while (names.length < prizes.length) names.push('');
  while (names.length > prizes.length) names.pop();
}

function removeItem(type, i) {
  if (type === 'name') { names.splice(i, 1); if (prizes.length > names.length) prizes.pop(); }
  else { prizes.splice(i, 1); if (names.length > prizes.length) names.pop(); }
  renderInputs();
}

// --- 設定 → カスタマイズ ---
function goToCustomize() {
  // 入力値を確定
  document.querySelectorAll('#names-list input').forEach((el, i) => names[i] = el.value || `参加者${i+1}`);
  document.querySelectorAll('#prizes-list input').forEach((el, i) => prizes[i] = el.value || `${i+1}等`);

  const n = Math.max(names.length, prizes.length, 2);
  while (names.length < n) names.push(`参加者${names.length+1}`);
  while (prizes.length < n) prizes.push(`${prizes.length+1}等`);

  // ランダムに初期橋を生成
  generateBridges(n);

  // 結果をシャッフル
  shuffledPrizes = [...prizes].sort(() => Math.random() - 0.5);

  showScreen('customize-screen');
  drawCustomize();
}

function goBack() {
  showScreen('setup-screen');
}

function shufflePrizes() {
  const n = names.length;
  const newOrder = [...shuffledPrizes].sort(() => Math.random() - 0.5);
  animateShuffle(shuffledPrizes, newOrder, n, () => {
    shuffledPrizes = newOrder;
  });
}

function animateShuffle(fromOrder, toOrder, n, onDone) {
  const canvas = document.getElementById('customize-canvas');
  const ctx = canvas.getContext('2d');
  const duration = 500;
  const start = performance.now();

  const BOX_W = 72, BOX_H = 30;
  const baseY = TOP_PAD + ROW_H * ROWS + 8;

  function getBoxX(col) { return colX(col) - BOX_W / 2; }

  // fromOrder と toOrder の各インデックスの移動先を計算
  const fromPositions = fromOrder.map((_, i) => getBoxX(i));
  const toPositions = fromOrder.map((val) => {
    const destIdx = toOrder.indexOf(val);
    return getBoxX(destIdx);
  });

  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const e = easeInOut(t);

    // あみだ本体を再描画
    drawCustomizeBase(ctx, n);

    // ボックスをアニメーション
    fromOrder.forEach((label, i) => {
      const x = fromPositions[i] + (toPositions[i] - fromPositions[i]) * e;
      const bounce = Math.sin(t * Math.PI) * 12;
      const y = baseY - bounce;

      ctx.fillStyle = '#667eea';
      ctx.beginPath();
      ctx.roundRect(x, y, BOX_W, BOX_H, 6);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('？', x + BOX_W / 2, y + BOX_H / 2);
      ctx.textBaseline = 'alphabetic';
    });

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      onDone();
      drawCustomize();
    }
  }
  requestAnimationFrame(tick);
}

// あみだ本体（縦線・橋・ラベル）だけ描画するヘルパー
function drawCustomizeBase(ctx, n) {
  const { w, h } = getCanvasSize(n);
  ctx.clearRect(0, 0, w, h);

  for (let col = 0; col < n; col++) {
    ctx.beginPath();
    ctx.moveTo(colX(col), TOP_PAD);
    ctx.lineTo(colX(col), TOP_PAD + ROW_H * ROWS);
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < n - 1; col++) {
      const hasBridge = bridges.some(b => b.row === row && b.col === col);
      const neighborLeft = col > 0 && bridges.some(b => b.row === row && b.col === col - 1);
      const neighborRight = col < n - 2 && bridges.some(b => b.row === row && b.col === col + 1);
      if (!hasBridge && !neighborLeft && !neighborRight) {
        ctx.beginPath();
        ctx.moveTo(colX(col), bridgeMidY(row));
        ctx.lineTo(colX(col + 1), bridgeMidY(row));
        ctx.strokeStyle = 'rgba(102,126,234,0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  for (const b of bridges) {
    ctx.beginPath();
    ctx.moveTo(colX(b.col), bridgeMidY(b.row));
    ctx.lineTo(colX(b.col + 1), bridgeMidY(b.row));
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.stroke();
    const mx = bridgeMidX(b.col);
    const my = bridgeMidY(b.row);
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×', mx, my);
    ctx.textBaseline = 'alphabetic';
  }

  for (let col = 0; col < n; col++) {
    ctx.fillStyle = '#444';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(names[col], colX(col), TOP_PAD - 10);
  }
}

// --- カスタマイズ → プレイ ---
function goToPlay() {
  revealed = new Array(names.length).fill(false);
  showScreen('amida-screen');
  drawAmida();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// --- 橋生成 ---
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

// --- 座標ヘルパー ---
function getCanvasSize(n) {
  return { w: SIDE_PAD * 2 + COL_W * (n - 1), h: TOP_PAD + ROW_H * ROWS + BOT_PAD };
}
function colX(col) { return SIDE_PAD + col * COL_W; }
function rowY(row) { return TOP_PAD + row * ROW_H; }
function bridgeMidX(col) { return (colX(col) + colX(col + 1)) / 2; }
function bridgeMidY(row) { return rowY(row) + ROW_H / 2; }

// --- カスタマイズ描画 ---
function drawCustomize() {
  const n = names.length;
  const canvas = document.getElementById('customize-canvas');
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
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 追加可能スポット（薄いガイド）
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < n - 1; col++) {
      const hasBridge = bridges.some(b => b.row === row && b.col === col);
      const neighborLeft = col > 0 && bridges.some(b => b.row === row && b.col === col - 1);
      const neighborRight = col < n - 2 && bridges.some(b => b.row === row && b.col === col + 1);
      if (!hasBridge && !neighborLeft && !neighborRight) {
        // 追加できる場所をガイド表示
        ctx.beginPath();
        ctx.moveTo(colX(col), bridgeMidY(row));
        ctx.lineTo(colX(col + 1), bridgeMidY(row));
        ctx.strokeStyle = 'rgba(102,126,234,0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // 既存の橋
  for (const b of bridges) {
    ctx.beginPath();
    ctx.moveTo(colX(b.col), bridgeMidY(b.row));
    ctx.lineTo(colX(b.col + 1), bridgeMidY(b.row));
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 削除ヒント（中央に×アイコン）
    const mx = bridgeMidX(b.col);
    const my = bridgeMidY(b.row);
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×', mx, my);
    ctx.textBaseline = 'alphabetic';
  }

  // ラベル
  for (let col = 0; col < n; col++) {
    ctx.fillStyle = '#444';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(names[col], colX(col), TOP_PAD - 10);
  }
  // 下部は「？」で隠す
  for (let col = 0; col < n; col++) {
    const bx = colX(col) - 36;
    const by = TOP_PAD + ROW_H * ROWS + 8;
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.roundRect(bx, by, 72, 30, 6);
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#bbb';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('？', colX(col), by + 20);
  }

  canvas.onclick = (e) => handleCustomizeClick(e, canvas, n);
}

function handleCustomizeClick(e, canvas, n) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  // 既存の橋をクリック → 削除
  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    const mx = bridgeMidX(b.col);
    const my = bridgeMidY(b.row);
    if (Math.abs(x - mx) < HIT_RADIUS && Math.abs(y - my) < HIT_RADIUS) {
      bridges.splice(i, 1);
      drawCustomize();
      return;
    }
  }

  // 空きスポットをクリック → 追加
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < n - 1; col++) {
      const mx = bridgeMidX(col);
      const my = bridgeMidY(row);
      if (Math.abs(x - mx) < HIT_RADIUS && Math.abs(y - my) < HIT_RADIUS) {
        const hasBridge = bridges.some(b => b.row === row && b.col === col);
        const neighborLeft = col > 0 && bridges.some(b => b.row === row && b.col === col - 1);
        const neighborRight = col < n - 2 && bridges.some(b => b.row === row && b.col === col + 1);
        if (!hasBridge && !neighborLeft && !neighborRight) {
          bridges.push({ row, col });
          drawCustomize();
          return;
        }
      }
    }
  }
}

// --- プレイ画面描画 ---
function drawAmida(highlightCol = -1, pathCells = []) {
  const n = names.length;
  const canvas = document.getElementById('amida-canvas');
  const { w, h } = getCanvasSize(n);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  for (let col = 0; col < n; col++) {
    ctx.beginPath();
    ctx.moveTo(colX(col), TOP_PAD);
    ctx.lineTo(colX(col), TOP_PAD + ROW_H * ROWS);
    ctx.strokeStyle = col === highlightCol ? '#667eea' : '#ccc';
    ctx.lineWidth = col === highlightCol ? 3 : 2;
    ctx.stroke();
  }

  for (const b of bridges) {
    const onPath = pathCells.some(p => p.row === b.row && p.col === b.col);
    ctx.beginPath();
    ctx.moveTo(colX(b.col), bridgeMidY(b.row));
    ctx.lineTo(colX(b.col + 1), bridgeMidY(b.row));
    ctx.strokeStyle = onPath ? '#e53935' : '#bbb';
    ctx.lineWidth = onPath ? 3 : 2;
    ctx.stroke();
  }

  for (let col = 0; col < n; col++) {
    const isSelected = col === highlightCol;
    ctx.fillStyle = isSelected ? '#667eea' : '#444';
    ctx.font = isSelected ? 'bold 14px sans-serif' : '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(names[col], colX(col), TOP_PAD - 10);
  }

  for (let col = 0; col < n; col++) {
    const destCol = getDestination(col);
    const isRevealed = revealed[col];
    const isSelected = col === highlightCol;
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

  canvas.onclick = (e) => {
    if (animating) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    for (let col = 0; col < n; col++) {
      if (Math.abs(x - colX(col)) < 36 && y < TOP_PAD) { animatePath(col); return; }
    }
  };
}

// --- パス計算 ---
function getDestination(startCol) {
  let col = startCol;
  for (let row = 0; row < ROWS; row++) {
    if (bridges.some(b => b.row === row && b.col === col)) { col++; continue; }
    if (bridges.some(b => b.row === row && b.col === col - 1)) { col--; }
  }
  return col;
}

function getPath(startCol) {
  let col = startCol;
  const path = [];
  for (let row = 0; row < ROWS; row++) {
    if (bridges.some(b => b.row === row && b.col === col)) {
      path.push({ row, col, dir: 'right' }); col++; continue;
    }
    if (bridges.some(b => b.row === row && b.col === col - 1)) {
      path.push({ row, col, dir: 'left' }); col--;
    }
  }
  return { finalCol: col, path };
}

// --- アニメーション ---
function animatePath(startCol) {
  animating = true;
  const { path } = getPath(startCol);
  let step = 0;

  function tick() {
    if (step <= path.length) {
      drawAmida(startCol, path.slice(0, step));
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
  for (let i = 0; i < Math.min(step, path.length); i++) {
    if (path[i].dir === 'right') col++;
    else if (path[i].dir === 'left') col--;
  }
  const dotY = step < ROWS ? TOP_PAD + step * ROW_H : TOP_PAD + ROWS * ROW_H;
  ctx.beginPath();
  ctx.arc(colX(col), dotY, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#e53935';
  ctx.fill();
}

// --- リセット ---
function resetAll() {
  names = ['Aさん', 'Bさん', 'Cさん'];
  prizes = ['1等', '2等', '3等'];
  shuffledPrizes = [];
  bridges = [];
  revealed = [];
  animating = false;
  showScreen('setup-screen');
  renderInputs();
}
