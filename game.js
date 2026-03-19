'use strict';

const GRID_SIZE = 20;        // number of cells per row/column
const CELL_SIZE = 24;        // pixels per cell
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;  // 480px

const COLORS = {
  background:  '#16213e',
  gridLine:    '#1a2545',
  snakeHead:   '#4ecca3',
  snakeBody:   '#38b28e',
  snakeBorder: '#2a8a6e',
  food:        '#e94560',
  foodGlow:    'rgba(233, 69, 96, 0.4)',
  scoreFlash:  '#f0a500',
};

// Direction vectors
const DIR = {
  UP:    { x: 0,  y: -1 },
  DOWN:  { x: 0,  y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x: 1,  y:  0 },
};

// Opposites – prevent 180° reversal
const OPPOSITE = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

// Base speed (ms per frame) and per-level speedup
const BASE_INTERVAL   = 160;
const MIN_INTERVAL    = 60;  // fastest possible tick rate (ms)
const SPEED_INCREMENT = 8;   // ms faster per level
const POINTS_PER_LEVEL = 5;  // food eaten to advance a level

class SnakeGame {
  constructor(canvas, scoreEl, highScoreEl, levelEl) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.scoreEl    = scoreEl;
    this.highScoreEl = highScoreEl;
    this.levelEl    = levelEl;

    this.canvas.width  = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;

    this.highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
    this.highScoreEl.textContent = this.highScore;

    this.animationId = null;
    this.lastTime    = 0;
    this.state       = 'idle'; // idle | running | paused | over

    this._bindKeys();
  }

  // ── Initialise / reset game state ──────────────────────────────────────────
  reset() {
    const mid = Math.floor(GRID_SIZE / 2);
    this.snake = [
      { x: mid,     y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    this.dir       = { ...DIR.RIGHT };
    this.nextDir   = 'RIGHT';
    this.score     = 0;
    this.level     = 1;
    this.foodEaten = 0;
    this.interval  = BASE_INTERVAL;
    this.elapsed   = 0;

    this.scoreEl.textContent = this.score;
    this.levelEl.textContent = this.level;

    this._placeFood();
  }

  // ── Food ───────────────────────────────────────────────────────────────────
  _placeFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
    this.food = pos;
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  start() {
    this.state    = 'running';
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  _loop(timestamp) {
    this.animationId = requestAnimationFrame(t => this._loop(t));
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.state !== 'running') return;

    this.elapsed += delta;
    if (this.elapsed >= this.interval) {
      this.elapsed = 0;
      this._tick();
    }

    this._draw();
  }

  _tick() {
    // Commit queued direction
    if (this.nextDir !== null && this.nextDir !== OPPOSITE[this._currentDirName()]) {
      this.dir = { ...DIR[this.nextDir] };
    }
    this.nextDir = null;

    const head = this.snake[0];
    const next = {
      x: head.x + this.dir.x,
      y: head.y + this.dir.y,
    };

    // Wall collision
    if (next.x < 0 || next.x >= GRID_SIZE || next.y < 0 || next.y >= GRID_SIZE) {
      this._gameOver();
      return;
    }

    // Self collision (skip tail because it will move)
    for (let i = 0; i < this.snake.length - 1; i++) {
      if (this.snake[i].x === next.x && this.snake[i].y === next.y) {
        this._gameOver();
        return;
      }
    }

    this.snake.unshift(next);

    if (next.x === this.food.x && next.y === this.food.y) {
      // Ate food – grow, score, maybe level up
      this.score++;
      this.foodEaten++;
      this.scoreEl.textContent = this.score;

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.highScoreEl.textContent = this.highScore;
        localStorage.setItem('snakeHighScore', this.highScore);
      }

      if (this.foodEaten % POINTS_PER_LEVEL === 0) {
        this.level++;
        this.levelEl.textContent = this.level;
        this.interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - (this.level - 1) * SPEED_INCREMENT);
      }

      this._placeFood();
    } else {
      this.snake.pop();
    }
  }

  _currentDirName() {
    for (const [name, vec] of Object.entries(DIR)) {
      if (vec.x === this.dir.x && vec.y === this.dir.y) return name;
    }
    return 'RIGHT';
  }

  _gameOver() {
    this.state = 'over';
    cancelAnimationFrame(this.animationId);
    this._draw();
    document.getElementById('finalScore').textContent = this.score;
    document.getElementById('gameOverOverlay').classList.add('visible');
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const cs  = CELL_SIZE;

    // Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cs, 0);
      ctx.lineTo(i * cs, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cs);
      ctx.lineTo(CANVAS_SIZE, i * cs);
      ctx.stroke();
    }

    // Food – glowing circle
    const fx = this.food.x * cs + cs / 2;
    const fy = this.food.y * cs + cs / 2;
    const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, cs * 0.7);
    glow.addColorStop(0, COLORS.food);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy, cs * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(fx, fy, cs * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Snake
    this.snake.forEach((seg, i) => {
      const x = seg.x * cs;
      const y = seg.y * cs;
      const pad = 1;
      const r = 4;

      ctx.fillStyle   = i === 0 ? COLORS.snakeHead : COLORS.snakeBody;
      ctx.strokeStyle = COLORS.snakeBorder;
      ctx.lineWidth   = 1;

      this._roundRect(ctx, x + pad, y + pad, cs - pad * 2, cs - pad * 2, r);
      ctx.fill();
      ctx.stroke();

      // Eyes on head – offset perpendicular to direction of travel
      if (i === 0) {
        ctx.fillStyle = '#1a1a2e';
        const eyeR  = 2.5;
        const d     = this.dir;
        const perpX = -d.y;
        const perpY =  d.x;

        const e1x = x + cs / 2 + perpX * 4 + d.x * 3;
        const e1y = y + cs / 2 + perpY * 4 + d.y * 3;
        const e2x = x + cs / 2 - perpX * 4 + d.x * 3;
        const e2y = y + cs / 2 - perpY * 4 + d.y * 3;

        ctx.beginPath(); ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  _bindKeys() {
    document.addEventListener('keydown', e => {
      const map = {
        ArrowUp: 'UP', w: 'UP', W: 'UP',
        ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
        ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
        ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
      };
      if (map[e.key]) {
        e.preventDefault();
        if (this.state === 'running') {
          this.nextDir = map[e.key];
        }
      }
    });
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const canvas       = document.getElementById('gameCanvas');
  const scoreEl      = document.getElementById('score');
  const highScoreEl  = document.getElementById('highScore');
  const levelEl      = document.getElementById('level');
  const startOverlay = document.getElementById('startOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const startBtn     = document.getElementById('startBtn');
  const restartBtn   = document.getElementById('restartBtn');

  const game = new SnakeGame(canvas, scoreEl, highScoreEl, levelEl);

  // Draw a static initial frame so the canvas isn't blank
  game.reset();
  game._draw();
  startOverlay.classList.add('visible');

  startBtn.addEventListener('click', () => {
    startOverlay.classList.remove('visible');
    game.reset();
    game.start();
  });

  restartBtn.addEventListener('click', () => {
    gameOverOverlay.classList.remove('visible');
    game.reset();
    game.start();
  });
});
