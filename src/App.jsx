import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// ─── AUDIO ENGINE (lazy init — safe on iOS / strict autoplay) ───────────────
let _actx = null;
const getAudioContext = () => {
  if (!_actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _actx = new AC();
  }
  if (_actx.state === 'suspended' || _actx.state === 'interrupted') _actx.resume();
  return _actx;
};

const playSound = (type) => {
  try {
    const actx = getAudioContext();
    const osc  = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    const now = actx.currentTime;

    switch (type) {
      case 'shoot': // bow twang — sharp pluck descending
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now); osc.stop(now + 0.18);
        break;
      case 'hit': // magic impact — bright chime burst
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.22);
        osc.start(now); osc.stop(now + 0.22);
        break;
      case 'combo': // ascending magic chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(1980, now + 0.28);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.28);
        osc.start(now); osc.stop(now + 0.28);
        break;
      case 'miss': // dull thud — arrow in dirt
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.25);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
        break;
      case 'round_start': // herald fanfare — three rising tones
        osc.type = 'square';
        osc.frequency.setValueAtTime(392, now);
        osc.frequency.setValueAtTime(523, now + 0.12);
        osc.frequency.setValueAtTime(784, now + 0.24);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
        break;
      case 'laugh': // dragon/goblin low rumble chortle
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.18);
        osc.frequency.setValueAtTime(200, now + 0.22);
        osc.frequency.linearRampToValueAtTime(90,  now + 0.45);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now); osc.stop(now + 0.6);
        break;
      case 'wave_clear': // victory horn — bright rising arpeggio
        osc.type = 'square';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(1047, now + 0.22);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.55);
        osc.start(now); osc.stop(now + 0.55);
        break;
      case 'no_ammo': // empty quiver click
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
        break;
      default: break;
    }
  } catch (_) { /* audio unavailable */ }
};

// ─── SPRITES ────────────────────────────────────────────────────────────────
const CELL = 3;

// Goblin — replaces acrobat (keeps sine-wave swing movement)
const ACROBAT_SWING = [
  "....GGG.....",
  "...GYYGY....",
  "...GYYYG....",
  "....BGGB....",
  "...GGBBGG...",
  "..G.BBBB.G..",
  "..G..BB..G..",
  ".....GG.....",
  "....G..G....",
  "...GG..GG..."
];

// Wizard mascot — replaces vigilante (keeps slide-up animation)
const VIGILANTE_STAND = [
  ".....PPPP.......",
  "....PPPPPP......",
  "....PWWWWP......",
  "....PPPPPP......",
  "..BBBBBBBBBBB...",
  ".BBBWWBBWWBBBB..",
  ".BBBBWWWWBBBBB..",
  "..BBBBBBBBBBB...",
  "...BBB...BBB....",
  "...BB.....BB...."
];

// Dragon — replaces drone (keeps diagonal-up + shrink movement)
const DRONE_SPRITE = [
  "D.DDDDD.D..",
  ".DDRRRDD...",
  "DDDRWRDDD..",
  ".DDDDDDD...",
  "..D.D.D...."
];

const PALETTES = {
  acrobat:   { G: '#3a7d1e', Y: '#c8a020', B: '#1a1a1a', W: '#ffffff' }, // goblin: green body, yellow eyes
  vigilante: { P: '#7c3db5', W: '#e8d8ff', B: '#2a1a5e' },               // wizard: purple robe, pale face
  drone:     { D: '#8b2020', R: '#ff6600', W: '#ffdd00' }                 // dragon: dark red, orange fire, gold eye
};

const drawGrid = (ctx, x, y, grid, palette, flip = false, scale = 1) => {
  const H = grid.length, W = grid[0].length;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.translate(-(W * CELL * scale) / 2, -(H * CELL * scale) / 2);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = grid[r][c];
      if (ch !== '.') {
        ctx.fillStyle = palette[ch];
        ctx.fillRect(c * CELL * scale, r * CELL * scale, CELL * scale, CELL * scale);
      }
    }
  }
  ctx.restore();
};

// ─── TAUNT STRINGS ──────────────────────────────────────────────────────────
const MISS_TAUNTS = [
  "THE DRAGON ESCAPED!",
  "TOO SLOW, HUNTER!",
  "YOUR ARROWS MISS THE MARK!",
  "THE GOBLIN LAUGHS AT YOU!",
  "EVEN A SQUIRE AIMS BETTER!",
  "THE ENCHANTMENT FAILED!",
  "THAT ARROW FELL SHORT!",
  "THE FOREST SPIRITS WEEP!",
  "YOU CALL THAT ARCHERY?",
  "THE KING IS NOT AMUSED!",
  "WASTED ARROW, WASTED GLORY!",
  "THE DRAGON FLIES FREE!",
  "OPEN YOUR EYES, ARCHER!",
  "A BLIND WIZARD COULD DO BETTER!",
  "THE REALM IS DOOMED AT THIS RATE!"
];
const GAME_OVER_TAUNTS = [
  "THE KINGDOM FALLS TO THE DARKNESS.",
  "YOUR LEGEND ENDS HERE, HUNTER.",
  "THE DRAGONS HAVE WON THIS DAY.",
  "THE WIZARD WEEPS FOR YOUR AIM.",
  "EVEN THE GOBLINS PITY YOU.",
  "BACK TO THE TRAINING GROUNDS WITH YOU.",
  "THE ENCHANTED FOREST IS LOST.",
  "THE CASTLE GATES WILL NOT HOLD.",
  "THE KING REVOKES YOUR HUNTING LICENSE.",
  "PERHAPS TRY BEING A FARMER INSTEAD."
];
const ROUND_CLEAR_MSGS = [
  "WELL SHOT, HUNTER!", "GLORIOUS!", "PERFECT AIM!", "THE REALM REJOICES!",
  "LEGENDARY HUNTER!", "THE DRAGONS FLEE!", "UNSTOPPABLE VALOR!"
];

// ─── GAME ENGINE ─────────────────────────────────────────────────────────────
class GameEngine {
  constructor(canvas, updateReactState) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.updateReactState = updateReactState;

    this.W = 800; this.H = 450;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;

    this.state        = 'MENU';
    this.mode         = 1;
    this.score        = 0;
    this.hiScore      = parseInt(localStorage.getItem('retroweb_hi')) || 0;
    this.round        = 1;
    this.ammo         = 5;
    this.maxAmmo      = 5;

    this.targets      = [];
    this.particles    = [];
    this.hitMarkers   = [];   // visual ring at click position
    this.floatingTexts = [];
    this.history      = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.currentCombo = 0;
    this.gameOverTaunt = '';
    this.roundClearMsg = '';

    // ENHANCED: Power-ups system
    this.powerUps = [];
    this.activePowerUp = null;
    this.powerUpTimer = 0;

    // ENHANCED: Stats tracking
    this.stats = {
      totalShots: 0,
      totalHits: 0,
      totalKills: 0,
      perfectWaves: 0,
      maxCombo: 0,
      killStreak: 0,
      maxKillStreak: 0
    };

    // ENHANCED: Floating damage numbers
    this.damageNumbers = [];

    // ENHANCED: Kill streak system
    this.killStreak = 0;
    this.killStreakTimer = 0;

    // ENHANCED: Arrow projectiles (visual only)
    this.arrows = [];

    // ENHANCED: Settings (defaults)
    this.settings = {
      volume: parseFloat(localStorage.getItem('rh_volume')) || 0.5,
      particleDensity: parseFloat(localStorage.getItem('rh_particles')) || 1.0,
      screenShake: localStorage.getItem('rh_shake') !== 'false'
    };

    // Screen shake
    this.shakeTimer  = 0;
    this.shakeMag    = 0;

    // Cursor tracking for custom crosshair on canvas
    this.mouseX = this.W / 2;
    this.mouseY = this.H / 2;

    // Wave end guard — prevents duplicate endWave calls
    this._waveEndScheduled = false;

    // Pre-computed stars with phase for smooth twinkling
    this.stars = Array.from({ length: 55 }, (_, i) => ({
      x:     (Math.sin(i * 743.7) * 0.5 + 0.5) * this.W,
      y:     (Math.cos(i * 312.1) * 0.5 + 0.5) * (this.H * 0.62),
      size:  i % 3 === 0 ? 3 : 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.4
    }));

    this.mascot = { active: false, y: this.H, type: 'stand', timer: 0 };

    this.lastTime = performance.now();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  // ── GAME FLOW ──────────────────────────────────────────────────────────────
  startGame(mode) {
    this.mode          = mode;
    this.score         = 0;
    this.round         = 1;
    this.currentCombo  = 0;
    this.gameOverTaunt = '';
    this.roundClearMsg = '';
    // Clean state before starting
    this.targets       = [];
    this.particles     = [];
    this.floatingTexts = [];
    this.hitMarkers    = [];
    this.powerUps      = [];
    this.arrows        = [];
    this.damageNumbers = [];
    this.activePowerUp = null;
    this.powerUpTimer  = 0;
    this.killStreak    = 0;
    this.killStreakTimer = 0;
    this.mascot.active = false;
    this._waveEndScheduled = false;

    // Reset stats
    this.stats = {
      totalShots: 0,
      totalHits: 0,
      totalKills: 0,
      perfectWaves: 0,
      maxCombo: 0,
      killStreak: 0,
      maxKillStreak: 0
    };

    if (this.mode === 1)      this.maxAmmo = 6;
    else if (this.mode === 2) this.maxAmmo = 4;
    else                      this.maxAmmo = 3;
    this.ammo = this.maxAmmo; // BUG 4 FIX: ammo must be initialised here or restart shows stale count

    this.startRound();
  }

  startRound() {
    this.history        = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.targets        = [];
    this.particles      = [];
    this.floatingTexts  = [];
    this.hitMarkers     = [];
    this._waveEndScheduled = false;
    this.state          = 'ROUND_START';
    this.syncState();
    playSound('round_start');

    setTimeout(() => {
      if (this.state === 'ROUND_START') {
        this.state = 'PLAYING';
        this.spawnWave();
      }
    }, 1500);
  }

  spawnWave() {
    this.ammo    = this.maxAmmo;
    this.targets = [];
    this._waveEndScheduled = false;

    let count = 1;
    if (this.mode === 2) count = 2;
    if (this.mode === 3) count = 2;

    for (let i = 0; i < count; i++) {
      if (this.mode === 3 && i === 1) {
        this.targets.push(this.createDrone());
      } else {
        this.targets.push(this.createAcrobat());
      }
    }
    this.targetsSpawned += count;
    this.syncState();
  }

  // ── ENTITY FACTORIES ───────────────────────────────────────────────────────
  createAcrobat() {
    let speedMult = 0.45 + this.round * 0.04;
    if (this.mode === 2) speedMult = 0.72 + this.round * 0.05;
    if (this.mode === 3) speedMult = 1.05 + this.round * 0.08;
    speedMult = Math.min(speedMult, this.mode === 3 ? 2.8 : 2.0);

    const dir    = Math.random() > 0.5 ? 1 : -1;
    const startY = 140 + Math.random() * 110;
    const startX = dir === 1 ? -80 : this.W + 80;

    // ENHANCED: Spawn effect
    this.spawnEnemyEffect(startX, startY, '#3a7d1e');

    return {
      type:       'acrobat',
      x:          startX,
      y:          startY,
      baseY:      startY,
      vx:         (130 + Math.random() * 50) * speedMult * dir,
      amplitude:  130 + Math.random() * 55,
      phase:      Math.random() * Math.PI,
      phaseSpeed: (1.8 + Math.random() * 0.8) * speedMult,
      dead:       false,
      escaped:    false,
      escapeTimer: 0,
      hitFlash:   0,
      maxTime:    this.mode === 1 ? 5.5 : Math.max(2.0, 4.2 - this.round * 0.18)
    };
  }

  createDrone() {
    let speedMult = 0.9 + this.round * 0.08;
    speedMult = Math.min(speedMult, 2.4);
    const dir = Math.random() > 0.5 ? 1 : -1;
    const startX = dir === 1 ? -40 : this.W + 40;
    const startY = this.H * 0.45 + (Math.random() * 130 - 65);

    // ENHANCED: Spawn effect
    this.spawnEnemyEffect(startX, startY, '#8b2020');

    return {
      type:       'drone',
      x:          startX,
      y:          startY,
      vx:         (155 + Math.random() * 55) * speedMult * dir,
      vy:         (-18 - Math.random() * 28) * speedMult,
      scale:      2.5,
      dead:       false,
      escaped:    false,
      escapeTimer: 0,
      hitFlash:   0,
      maxTime:    Math.max(1.8, 3.6 - this.round * 0.14)
    };
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────
  shoot(x, y) {
    if (this.state !== 'PLAYING') return;
    
    // ENHANCED: Check for power-up collection first
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      if (!p.collected) {
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist < 30) {
          p.collected = true;
          this.activatePowerUp(p.type);
          this.powerUps.splice(i, 1);
          return; // Don't shoot when collecting power-up
        }
      }
    }
    
    if (this.ammo <= 0) { playSound('no_ammo'); return; }

    this.ammo--;
    this.stats.totalShots++;
    playSound('shoot');

    // ENHANCED: Spawn arrow projectile visual
    this.spawnArrowTrail(this.W / 2, this.H - 60, x, y);

    // Screen flash
    const flashEl = document.getElementById('screen-flash');
    if (flashEl) {
      flashEl.style.opacity = '0.35';
      setTimeout(() => { flashEl.style.opacity = '0'; }, 45);
    }

    // Mild screen shake on every shot (respects settings)
    if (this.settings.screenShake) {
      this.shakeTimer = 0.08;
      this.shakeMag   = 3;
    }

    // Hit marker ring at click point
    this.hitMarkers.push({ x, y, life: 0.45, maxLife: 0.45, hit: false });

    let hitAnything = false;
    let radiusMult  = 1.0;
    if (this.mode === 1) radiusMult = 1.45;
    if (this.mode === 3) radiusMult = 0.85;

    // ENHANCED: Double damage power-up
    const damageMultiplier = (this.activePowerUp === 'doubledamage') ? 2 : 1;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.dead || t.escaped) continue;

      const baseRadius = t.type === 'drone' ? 24 * t.scale : 32;
      const radius     = baseRadius * radiusMult;
      const dist       = Math.hypot(t.x - x, t.y - y);  // FIX #1: actual position

      if (dist < radius) {
        t.dead     = true;
        hitAnything = true;
        this.currentCombo++;
        this.stats.totalHits++;
        this.stats.totalKills++;
        this.killStreak++;
        this.killStreakTimer = 3.0; // 3 seconds to maintain streak
        
        // Track max combo and kill streak
        if (this.currentCombo > this.stats.maxCombo) {
          this.stats.maxCombo = this.currentCombo;
        }
        if (this.killStreak > this.stats.maxKillStreak) {
          this.stats.maxKillStreak = this.killStreak;
        }
        
        t.hitFlash = 1.0;

        // Mark hit marker as a hit
        if (this.hitMarkers.length > 0) {
          this.hitMarkers[this.hitMarkers.length - 1].hit = true;
        }

        playSound(this.currentCombo > 1 ? 'combo' : 'hit');

        // ENHANCED: Bigger shake on hit (respects settings)
        if (this.settings.screenShake) {
          this.shakeTimer = 0.14;
          this.shakeMag   = 7 + (this.currentCombo * 2); // more shake for higher combos
        }

        const basePts  = ((t.type === 'drone' ? 1000 : 500) + this.round * 100) * damageMultiplier;
        const comboMult = this.currentCombo > 1 ? this.currentCombo : 1;
        const totalPts = basePts * comboMult;

        this.score += totalPts;
        if (this.score > this.hiScore) {
          this.hiScore = this.score;
          localStorage.setItem('retroweb_hi', this.hiScore);
        }

        // ENHANCED: Floating damage number
        this.spawnDamageNumber(t.x, t.y - 20, totalPts, '#ffee80');

        this.floatingTexts.push({
          x: t.x, y: t.y - 28,
          text: `+${totalPts}`,
          color: '#f1c40f',
          life: 1.3, maxLife: 1.3,
          isTaunt: false, isCombo: false
        });
        if (this.currentCombo > 1) {
          this.floatingTexts.push({
            x: t.x, y: t.y - 52,
            text: `${this.currentCombo}× COMBO!`,
            color: this.currentCombo >= 5 ? '#c0ff60' : '#f0c040',
            life: 1.6, maxLife: 1.6,
            isTaunt: false, isCombo: true
          });
        }

        // ENHANCED: Kill streak callouts
        if (this.killStreak === 3) {
          this.floatingTexts.push({ x: this.W / 2, y: this.H / 2 - 40, text: 'TRIPLE KILL!', color: '#ff6600', life: 2.0, maxLife: 2.0, isTaunt: true });
        } else if (this.killStreak === 5) {
          this.floatingTexts.push({ x: this.W / 2, y: this.H / 2 - 40, text: 'MEGA KILL!', color: '#ff00ff', life: 2.0, maxLife: 2.0, isTaunt: true });
        } else if (this.killStreak === 7) {
          this.floatingTexts.push({ x: this.W / 2, y: this.H / 2 - 40, text: 'UNSTOPPABLE!', color: '#ffdd00', life: 2.0, maxLife: 2.0, isTaunt: true });
        }

        this.spawnExplosion(t.x, t.y);

        // ENHANCED: Random power-up drop (15% chance, or 30% on combo 5+)
        const dropChance = this.currentCombo >= 5 ? 0.30 : 0.15;
        if (Math.random() < dropChance) {
          this.spawnPowerUp(t.x, t.y);
        }

        // History: tag by stable index
        const idx = this.targetsSpawned - this.targets.length + i;
        if (idx >= 0 && idx < 10) this.history[idx] = 'hit';
        break;
      }
    }

    if (!hitAnything) {
      playSound('miss');
      this.currentCombo = 0;
      this.floatingTexts = this.floatingTexts.filter(ft => !ft.isTaunt);
      const taunt = MISS_TAUNTS[Math.floor(Math.random() * MISS_TAUNTS.length)];
      this.floatingTexts.push({
        x: this.W / 2, y: this.H / 3,
        text: taunt,
        color: '#ff6b6b',
        life: 2.2, maxLife: 2.2,
        isTaunt: true, isCombo: false
      });
    }

    this.checkWaveEnd();
    this.syncState();
  }

  // ENHANCED: Power-up activation
  activatePowerUp(type) {
    this.activePowerUp = type;
    this.powerUpTimer = 8.0; // 8 seconds duration
    
    // Visual feedback
    this.floatingTexts.push({
      x: this.W / 2,
      y: this.H / 2,
      text: this.getPowerUpName(type),
      color: '#00ffff',
      life: 2.5,
      maxLife: 2.5,
      isTaunt: true
    });
    
    playSound('wave_clear'); // reuse victory sound for power-up
  }

  getPowerUpName(type) {
    const names = {
      slowmo: 'SLOW MOTION!',
      rapidfire: 'RAPID FIRE!',
      doubledamage: 'DOUBLE DAMAGE!',
      shield: 'SHIELD!'
    };
    return names[type] || 'POWER UP!';
  }

  // ── WAVE LOGIC ─────────────────────────────────────────────────────────────
  checkWaveEnd() {
    if (this._waveEndScheduled) return;
    const allDone = this.targets.every(t => t.dead || t.escaped);
    if (!allDone) return;
    this._waveEndScheduled = true;
    setTimeout(() => this.endWave(), 500);
  }

  endWave() {
    // BUG 3 FIX: always clear the scheduling flag first — even if we bail early,
    // so a future wave can schedule itself without being blocked.
    this._waveEndScheduled = false;
    if (this.state !== 'PLAYING') return; // BUG 7 FIX: flag is already cleared above

    const caughtCount = this.targets.filter(t => t.dead).length;

    // Log escaped targets in history
    this.targets.forEach((t, i) => {
      if (t.escaped && !t.dead) {
        const idx = this.targetsSpawned - this.targets.length + i;
        if (idx >= 0 && idx < 10) this.history[idx] = 'miss';
      }
    });

    // BUG 5 FIX: reset combo whenever any target escaped, not only when ALL escaped
    if (this.targets.some(t => t.escaped && !t.dead)) this.currentCombo = 0;

    this.state         = 'END_ANIM';
    this.mascot.active = true;
    this.mascot.y      = this.H;
    this.mascot.timer  = 0;
    this.mascot.type   = caughtCount > 0 ? 'stand' : 'laugh';

    if (caughtCount > 0) playSound('wave_clear');
    else                 playSound('laugh');

    this.syncState();
  }

  // ── ROUND CLEAR CHECK ─────────────────────────────────────────────────────
  checkRoundClear() {
    const hits = this.history.filter(h => h === 'hit').length;
    let required = 5 + Math.floor(this.round / 2);
    if (this.mode === 1) required = Math.max(4, required - 1);
    required = Math.min(required, 10);

    if (hits >= required) {
      this.roundClearMsg = ROUND_CLEAR_MSGS[Math.min(this.round - 1, ROUND_CLEAR_MSGS.length - 1)];
      this.round++;
      this.startRound();
    } else {
      this.state         = 'GAME_OVER';
      this.gameOverTaunt = GAME_OVER_TAUNTS[Math.floor(Math.random() * GAME_OVER_TAUNTS.length)];
      this.syncState();
    }
  }

  // ── PARTICLES ─────────────────────────────────────────────────────────────
  spawnExplosion(x, y) {
    // ENHANCED: more spectacular magical burst with varied sizes and glow
    const magicColors = ['#c0ff60', '#60e0ff', '#c080ff', '#ffee80', '#ffffff'];
    const density = Math.floor(50 * this.settings.particleDensity);
    
    for (let i = 0; i < density; i++) {
      const angle  = (i / density) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed  = 80 + Math.random() * 350;
      const isGlow = Math.random() > 0.4;
      const size = isGlow ? (5 + Math.random() * 4) : (2 + Math.random() * 3);
      
      this.particles.push({
        x, y,
        vx:    Math.cos(angle) * speed + (Math.random() - 0.5) * 100,
        vy:    Math.sin(angle) * speed + (Math.random() - 0.5) * 100 - 50, // slight upward bias
        life:  0.7 + Math.random() * 0.8,
        maxLife: 0.7 + Math.random() * 0.8,
        size,
        color: isGlow ? '#ffffff' : magicColors[Math.floor(Math.random() * magicColors.length)],
        glow: isGlow,
        gravity: 180 + Math.random() * 120
      });
    }
  }

  // ENHANCED: Spawn animation when enemy appears
  spawnEnemyEffect(x, y, color = '#c080ff') {
    const density = Math.floor(20 * this.settings.particleDensity);
    for (let i = 0; i < density; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.4 + Math.random() * 0.4,
        size: 2 + Math.random() * 2,
        color,
        glow: true,
        gravity: 0
      });
    }
  }

  // ENHANCED: Arrow projectile effect
  spawnArrowTrail(x, y, targetX, targetY) {
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    
    this.arrows.push({
      x, y,
      targetX, targetY,
      angle,
      dist,
      progress: 0,
      speed: 2800 // pixels per second
    });
  }

  // ENHANCED: Floating damage number
  spawnDamageNumber(x, y, value, color = '#ffee80') {
    this.damageNumbers.push({
      x, y,
      value,
      color,
      life: 1.2,
      maxLife: 1.2,
      vy: -120
    });
  }

  // ENHANCED: Power-up drop
  spawnPowerUp(x, y) {
    const types = ['slowmo', 'rapidfire', 'doubledamage', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    this.powerUps.push({
      x, y,
      type,
      life: 8.0, // lasts 8 seconds before disappearing
      vy: 60, // falls slowly
      bounce: 0,
      collected: false
    });
  }

  // ── MAIN LOOP ──────────────────────────────────────────────────────────────
  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.update(dt, now);
    this.draw(now);
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt, now) {
    // Screen shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer === 0) this.shakeMag = 0;
    }

    if (this.state === 'PLAYING') {
      let activeCount = 0;

      this.targets.forEach(t => {
        if (t.dead) {
          t.y += 480 * dt;
          return;
        }
        if (t.escaped) return;

        t.escapeTimer += dt;
        if (t.escapeTimer > t.maxTime || t.x < -160 || t.x > this.W + 160 || t.y < -160) {
          t.escaped = true;
          this.checkWaveEnd();
          return;
        }

        if (t.type === 'acrobat') {
          t.x      += t.vx * dt;
          t.phase  += t.phaseSpeed * dt;
          t.y       = t.baseY + Math.sin(t.phase) * t.amplitude;
        } else if (t.type === 'drone') {
          t.x     += t.vx * dt;
          t.y     += t.vy * dt;
          t.scale  = Math.max(0.5, t.scale - 0.45 * dt);
        }
        activeCount++;
      });

      // Out of ammo — accelerate escape timers
      if (this.ammo === 0 && activeCount > 0) {
        this.targets.forEach(t => { if (!t.dead && !t.escaped) t.escapeTimer += dt * 4.5; });
      }
    }

    if (this.state === 'END_ANIM') {
      this.mascot.timer += dt;
      // Slide up fast
      if (this.mascot.timer < 0.45)       this.mascot.y -= 160 * dt;
      // Slide back down after bob
      else if (this.mascot.timer > 2.05)  this.mascot.y += 160 * dt;

      if (this.mascot.timer > 2.6) {
        this.mascot.active = false;
        if (this.targetsSpawned >= 10) this.checkRoundClear();
        else { this.state = 'PLAYING'; this.spawnWave(); }
      }
    }

    // ENHANCED: Particles with gravity and fadeout
    this.particles.forEach(p => {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      p.life -= dt * 1.3;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    // ENHANCED: Arrow projectiles
    this.arrows.forEach(a => {
      a.progress += (a.speed / a.dist) * dt;
    });
    this.arrows = this.arrows.filter(a => a.progress < 1);

    // ENHANCED: Damage numbers
    this.damageNumbers.forEach(d => {
      d.y -= d.vy * dt;
      d.life -= dt;
    });
    this.damageNumbers = this.damageNumbers.filter(d => d.life > 0);

    // ENHANCED: Power-ups
    this.powerUps.forEach(p => {
      if (!p.collected) {
        p.y += p.vy * dt;
        if (p.y >= this.H - 90) {
          p.y = this.H - 90;
          p.vy = -p.vy * 0.5; // bounce
          p.bounce++;
        }
        p.life -= dt;
        
        // Check collision with mouse area (click to collect)
        // Power-ups will be collected on click in shoot() method
      }
    });
    this.powerUps = this.powerUps.filter(p => p.life > 0 && !p.collected);

    // ENHANCED: Active power-up timer
    if (this.activePowerUp) {
      this.powerUpTimer -= dt;
      if (this.powerUpTimer <= 0) {
        this.activePowerUp = null;
        this.powerUpTimer = 0;
      }
    }

    // ENHANCED: Kill streak decay
    if (this.killStreak > 0) {
      this.killStreakTimer -= dt;
      if (this.killStreakTimer <= 0) {
        this.killStreak = 0;
      }
    }

    // Hit markers
    this.hitMarkers.forEach(m => { m.life -= dt; });
    this.hitMarkers = this.hitMarkers.filter(m => m.life > 0);

    // Floating texts
    this.floatingTexts.forEach(ft => {
      ft.y    -= (ft.isTaunt ? 6 : 48) * dt;
      ft.life -= dt;
    });
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
  }

  // ── RENDERING ─────────────────────────────────────────────────────────────
  draw(now) {
    const ctx = this.ctx;
    const t   = now * 0.001; // time in seconds for animations

    // Screen shake transform
    const shakeX = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMag : 0;
    const shakeY = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMag : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── BACKGROUND: deep midnight blue sky ──
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0,   '#060818');
    bg.addColorStop(0.6, '#0e1a3a');
    bg.addColorStop(1,   '#1a2d1a');
    ctx.fillStyle = bg;
    ctx.fillRect(-10, -10, this.W + 20, this.H + 20);

    // ── Magical atmosphere glow (purple/teal) ──
    const glow = ctx.createRadialGradient(this.W * 0.4, this.H * 0.25, 5, this.W * 0.4, this.H * 0.25, 360);
    glow.addColorStop(0, 'rgba(80,30,160,0.10)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.W, this.H);

    // ── Stars ──
    this.stars.forEach(s => {
      const brightness = Math.sin(t * s.speed + s.phase) * 0.5 + 0.5;
      if (brightness > 0.25) {
        ctx.fillStyle = `rgba(210,230,255,${(brightness * 0.85).toFixed(2)})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    });

    // ── Large magical moon ──
    ctx.fillStyle = '#e8ddb0';
    ctx.beginPath(); ctx.arc(120, 70, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#060818';
    ctx.beginPath(); ctx.arc(138, 56, 36, 0, Math.PI * 2); ctx.fill();
    const moonGlow = ctx.createRadialGradient(120, 70, 32, 120, 70, 90);
    moonGlow.addColorStop(0, 'rgba(220,210,140,0.15)');
    moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath(); ctx.arc(120, 70, 90, 0, Math.PI * 2); ctx.fill();

    // ── Distant mountains ──
    ctx.fillStyle = '#0c1c2c';
    ctx.beginPath();
    ctx.moveTo(0, this.H - 100);
    ctx.lineTo(80,  this.H - 200); ctx.lineTo(160, this.H - 130);
    ctx.lineTo(240, this.H - 220); ctx.lineTo(320, this.H - 160);
    ctx.lineTo(420, this.H - 240); ctx.lineTo(500, this.H - 170);
    ctx.lineTo(600, this.H - 210); ctx.lineTo(680, this.H - 150);
    ctx.lineTo(this.W, this.H - 180); ctx.lineTo(this.W, this.H - 100);
    ctx.closePath(); ctx.fill();

    // ── Castle silhouette ──
    const castleX = this.W - 240, castleY = this.H - 100;
    ctx.fillStyle = '#0a1520';
    // Main keep
    ctx.fillRect(castleX,      castleY - 130, 130, 130);
    // Battlements on keep
    for (let bx = castleX; bx < castleX + 130; bx += 18) {
      ctx.fillRect(bx, castleY - 148, 10, 18);
    }
    // Left tower
    ctx.fillRect(castleX - 30, castleY - 170, 50, 170);
    for (let bx = castleX - 30; bx < castleX + 20; bx += 14) {
      ctx.fillRect(bx, castleY - 186, 8, 16);
    }
    // Right tower
    ctx.fillRect(castleX + 110, castleY - 155, 48, 155);
    for (let bx = castleX + 110; bx < castleX + 158; bx += 14) {
      ctx.fillRect(bx, castleY - 171, 8, 16);
    }
    // Flag on left tower — animated wave
    const flagWave = Math.sin(t * 2.2) * 4;
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.moveTo(castleX - 10, castleY - 200);
    ctx.lineTo(castleX + 16 + flagWave, castleY - 192);
    ctx.lineTo(castleX + 16, castleY - 183);
    ctx.lineTo(castleX - 10, castleY - 183);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c0a060'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(castleX - 10, castleY - 200);
    ctx.lineTo(castleX - 10, castleY - 170); ctx.stroke();
    // Castle gate arch (top half = proper gothic arch)
    ctx.fillStyle = '#060818';
    ctx.beginPath();
    ctx.arc(castleX + 65, castleY - 25, 22, 0, Math.PI);
    ctx.rect(castleX + 43, castleY - 25, 44, 25);
    ctx.fill();
    // Castle lit windows
    ctx.fillStyle = `rgba(255,180,60,${0.4 + Math.sin(t * 1.3) * 0.15})`;
    ctx.fillRect(castleX + 20,  castleY - 100, 14, 20);
    ctx.fillRect(castleX + 96,  castleY - 100, 14, 20);
    ctx.fillStyle = `rgba(255,160,40,${0.3 + Math.sin(t * 1.7 + 1) * 0.15})`;
    ctx.fillRect(castleX - 20,  castleY - 130, 10, 14);

    // ── Enchanted forest (mid-ground tree silhouettes) ──
    const trees = [
      {x:30,h:90},{x:70,h:110},{x:105,h:80},{x:155,h:100},{x:195,h:125},
      {x:250,h:85},{x:290,h:105},{x:340,h:95},{x:380,h:115},{x:430,h:80}
    ];
    trees.forEach(tr => {
      // Trunk — sits on top of the ground platform, doesn't go into it
      ctx.fillStyle = '#0d1a0d';
      ctx.fillRect(tr.x - 4, this.H - 100, 8, 22);
      // Canopy layers
      ctx.fillStyle = '#0f2510';
      ctx.beginPath();
      ctx.moveTo(tr.x, this.H - 78 - tr.h);
      ctx.lineTo(tr.x - tr.h * 0.45, this.H - 78 - tr.h * 0.35);
      ctx.lineTo(tr.x + tr.h * 0.45, this.H - 78 - tr.h * 0.35);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#132e14';
      ctx.beginPath();
      ctx.moveTo(tr.x, this.H - 78 - tr.h * 1.25);
      ctx.lineTo(tr.x - tr.h * 0.35, this.H - 78 - tr.h * 0.55);
      ctx.lineTo(tr.x + tr.h * 0.35, this.H - 78 - tr.h * 0.55);
      ctx.closePath(); ctx.fill();
    });

    // ── Fireflies (magical floating motes) ──
    this.stars.slice(0, 12).forEach((s, i) => {
      const fy = (this.H - 130) + Math.sin(t * 0.8 + i * 1.3) * 28;
      const fx = (s.x % (this.W - 100)) + 20 + Math.cos(t * 0.5 + i) * 18;
      const fAlpha = (Math.sin(t * 1.8 + s.phase) * 0.5 + 0.5) * 0.7;
      if (fAlpha > 0.1) {
        ctx.fillStyle = `rgba(140,255,140,${fAlpha.toFixed(2)})`;
        ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    });

    // ── Ground mist ──
    const mist = ctx.createLinearGradient(0, this.H - 95, 0, this.H - 60);
    mist.addColorStop(0, 'rgba(100,140,200,0)');
    mist.addColorStop(1, 'rgba(80,110,160,0.18)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, this.H - 95, this.W, 35);

    // ── Stone/earth foreground platform ──
    ctx.fillStyle = '#0e1a0e';
    ctx.fillRect(0, this.H - 78, this.W, 78);
    // Stone block texture
    ctx.strokeStyle = 'rgba(40,60,40,0.5)';
    ctx.lineWidth = 1;
    for (let sx = 0; sx < this.W; sx += 60) {
      ctx.beginPath(); ctx.moveTo(sx, this.H - 78); ctx.lineTo(sx, this.H); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, this.H - 50); ctx.lineTo(this.W, this.H - 50); ctx.stroke();
    // Stone edge highlight
    ctx.strokeStyle = 'rgba(80,120,80,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, this.H - 78); ctx.lineTo(this.W, this.H - 78); ctx.stroke();

    // ── Torches on foreground ──
    [120, 360, 560, 700].forEach(tx => {
      // Torch pole
      ctx.fillStyle = '#4a3010';
      ctx.fillRect(tx - 2, this.H - 100, 4, 22);
      // Flame flicker
      const flicker = Math.sin(t * 8 + tx) * 0.4 + 0.8;
      const fh = 14 * flicker;
      const torchGlow = ctx.createRadialGradient(tx, this.H - 100, 0, tx, this.H - 100, 22);
      torchGlow.addColorStop(0, `rgba(255,180,40,${0.35 * flicker})`);
      torchGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = torchGlow;
      ctx.fillRect(tx - 22, this.H - 122, 44, 44);
      ctx.fillStyle = `rgba(255,${100 + Math.floor(flicker * 60)},20,0.9)`;
      ctx.beginPath();
      ctx.moveTo(tx, this.H - 100 - fh);
      ctx.lineTo(tx - 5, this.H - 100);
      ctx.lineTo(tx + 5, this.H - 100);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,220,80,${0.8 * flicker})`;
      ctx.beginPath();
      ctx.moveTo(tx, this.H - 100 - fh * 0.6);
      ctx.lineTo(tx - 2, this.H - 100);
      ctx.lineTo(tx + 2, this.H - 100);
      ctx.closePath(); ctx.fill();
    });

    // ── TARGETS ──
    this.targets.forEach(tgt => {
      if (tgt.escaped && !tgt.dead) return;

      if (tgt.type === 'acrobat') {
        // Goblin on enchanted vine
        if (!tgt.dead) {
          // Vine rope (green-tinted)
          const vineOpacity = Math.max(0.25, 0.8 - tgt.escapeTimer * 0.1);
          ctx.strokeStyle = `rgba(60,160,60,${vineOpacity.toFixed(2)})`;
          ctx.lineWidth = 2;
          // Slight vine sway
          const sway = Math.sin(t * 3 + tgt.phase) * 6;
          ctx.beginPath();
          ctx.moveTo(tgt.x + sway * 0.5, -260);
          ctx.quadraticCurveTo(tgt.x + sway, tgt.y - tgt.amplitude * 0.5, tgt.x, tgt.y);
          ctx.stroke();
          // Magical glow around goblin
          const gGlow = ctx.createRadialGradient(tgt.x, tgt.y, 0, tgt.x, tgt.y, 28);
          gGlow.addColorStop(0, 'rgba(60,200,60,0.18)');
          gGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gGlow;
          ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 28, 0, Math.PI * 2); ctx.fill();
          drawGrid(ctx, tgt.x, tgt.y, ACROBAT_SWING, PALETTES.acrobat, tgt.vx > 0, 1.8);
        }
      } else if (tgt.type === 'drone') {
        // Dragon
        if (!tgt.dead) {
          // Fire/magic trail behind dragon
          for (let fi = 1; fi <= 5; fi++) {
            const trailX = tgt.x - (tgt.vx / Math.abs(tgt.vx || 1)) * fi * 8;
            const trailY = tgt.y + fi * 3;
            const trailA = (0.35 - fi * 0.06) * tgt.scale;
            ctx.fillStyle = `rgba(255,${100 - fi * 14},0,${Math.max(0, trailA).toFixed(2)})`;
            const ts = (6 - fi) * tgt.scale * 0.5;
            ctx.beginPath(); ctx.arc(trailX, trailY, ts, 0, Math.PI * 2); ctx.fill();
          }
          // Wing flap: offset sprite top by sine
          const wingFlap = Math.sin(t * 10 + tgt.escapeTimer * 6) * 4 * tgt.scale;
          // Dragon body glow
          const dGlow = ctx.createRadialGradient(tgt.x, tgt.y, 0, tgt.x, tgt.y, 30 * tgt.scale);
          dGlow.addColorStop(0, 'rgba(200,60,10,0.28)');
          dGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = dGlow;
          ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 30 * tgt.scale, 0, Math.PI * 2); ctx.fill();
          drawGrid(ctx, tgt.x, tgt.y + wingFlap, DRONE_SPRITE, PALETTES.drone, tgt.vx < 0, tgt.scale);
        }
      }
    });

    // ── PARTICLES — magical burst colors ──
    this.particles.forEach(p => {
      const lifeRatio = p.maxLife ? (p.life / p.maxLife) : p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio * 1.4));
      ctx.fillStyle   = p.color;
      const sz = p.size * Math.max(0.2, lifeRatio);
      
      // ENHANCED: Add glow for glowing particles
      if (p.glow) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
      }
      
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    // ENHANCED: Arrow projectiles
    this.arrows.forEach(a => {
      if (a.progress < 1) {
        const currentX = a.x + (a.targetX - a.x) * a.progress;
        const currentY = a.y + (a.targetY - a.y) * a.progress;
        
        ctx.save();
        ctx.translate(currentX, currentY);
        ctx.rotate(a.angle);
        
        // Arrow shaft
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(-8, -1, 16, 2);
        
        // Arrow head
        ctx.fillStyle = '#c0a060';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();
        
        // Feathers
        ctx.fillStyle = '#e8d090';
        ctx.fillRect(-10, -2, 4, 1);
        ctx.fillRect(-10, 1, 4, 1);
        
        // Trail effect
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffd700';
        for (let i = 1; i <= 3; i++) {
          const trailX = -i * 6;
          ctx.fillRect(trailX, -0.5, 4, 1);
        }
        
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    });

    // ENHANCED: Damage numbers
    this.damageNumbers.forEach(d => {
      const lifeRatio = d.life / d.maxLife;
      ctx.globalAlpha = Math.max(0, lifeRatio);
      ctx.font = 'bold 18px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = d.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      
      const scale = 1 + (1 - lifeRatio) * 0.3; // pop effect
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(scale, scale);
      ctx.strokeText(`+${d.value}`, 0, 0);
      ctx.fillText(`+${d.value}`, 0, 0);
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // ENHANCED: Power-ups
    this.powerUps.forEach(p => {
      if (!p.collected) {
        const pulseScale = 1 + Math.sin(now * 0.005) * 0.15;
        const alpha = p.life < 2 ? (p.life / 2) : 1; // fade out in last 2 seconds
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.scale(pulseScale, pulseScale);
        
        // Power-up icon background
        const colors = {
          slowmo: '#4a90e2',
          rapidfire: '#ff6600',
          doubledamage: '#e23636',
          shield: '#2ecc71'
        };
        const color = colors[p.type] || '#ffffff';
        
        // Glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
        glow.addColorStop(0, color + '80');
        glow.addColorStop(1, color + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon symbol
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const symbols = {
          slowmo: '◷',
          rapidfire: '⚡',
          doubledamage: '×2',
          shield: '◈'
        };
        ctx.fillText(symbols[p.type] || '?', 0, 0);
        
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    });

    // ── HIT MARKERS — magical rune ring ──
    this.hitMarkers.forEach(m => {
      const progress = 1 - m.life / m.maxLife;
      const ringR    = 10 + progress * 24;
      const alpha    = m.life / m.maxLife;
      // Outer rune ring
      ctx.strokeStyle = m.hit
        ? `rgba(160,255,160,${alpha})`
        : `rgba(255,120,60,${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, ringR, 0, Math.PI * 2); ctx.stroke();
      // Inner rotating rune tick marks (4 ticks at 45° offset)
      const runeAngle = progress * Math.PI;
      ctx.strokeStyle = m.hit
        ? `rgba(255,255,180,${alpha * 0.8})`
        : `rgba(255,180,80,${alpha * 0.7})`;
      ctx.lineWidth = 1.5;
      for (let ri = 0; ri < 4; ri++) {
        const a = runeAngle + (ri * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(m.x + Math.cos(a) * (ringR - 5), m.y + Math.sin(a) * (ringR - 5));
        ctx.lineTo(m.x + Math.cos(a) * (ringR + 5), m.y + Math.sin(a) * (ringR + 5));
        ctx.stroke();
      }
    });

    // ── Wizard mascot (replaces vigilante — same slide-up logic) ──
    if (this.mascot.active) {
      const mY  = Math.max(this.mascot.y, this.H - 118);
      const bob = this.mascot.type === 'laugh'
        ? Math.sin(this.mascot.timer * 18) * 5 : 0;
      // Wizard staff glow
      const staffGlow = ctx.createRadialGradient(this.W / 2 + 22, mY + bob - 10, 0, this.W / 2 + 22, mY + bob - 10, 18);
      staffGlow.addColorStop(0, `rgba(120,80,255,${0.6 + Math.sin(t * 4) * 0.2})`);
      staffGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = staffGlow;
      ctx.beginPath(); ctx.arc(this.W / 2 + 22, mY + bob - 10, 18, 0, Math.PI * 2); ctx.fill();
      drawGrid(ctx, this.W / 2, mY + bob, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
    }

    // ── Floating texts ──
    ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife * 1.5));
      ctx.globalAlpha = alpha;
      ctx.font = ft.isTaunt
        ? 'bold 16px "Press Start 2P", monospace'
        : ft.isCombo
          ? 'bold 15px "Press Start 2P", monospace'
          : '13px "Press Start 2P", monospace';

      const tw  = ctx.measureText(ft.text).width;
      const drawX = Math.max(tw / 2 + 22, Math.min(this.W - tw / 2 - 22, ft.x));

      if (ft.isTaunt) {
        ctx.fillStyle = 'rgba(6,8,24,0.93)';
        ctx.fillRect(drawX - tw / 2 - 18, ft.y - 22, tw + 36, 33);
        ctx.strokeStyle = '#4a2080';
        ctx.lineWidth   = 2;
        ctx.strokeRect(drawX - tw / 2 - 18, ft.y - 22, tw + 36, 33);
      }

      ctx.fillStyle   = ft.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = 4;
      ctx.strokeText(ft.text, drawX, ft.y);
      ctx.fillText(ft.text, drawX, ft.y);
    });
    ctx.globalAlpha = 1;

    // ── Magical rune crosshair (outside shake) ──
    ctx.restore();

    if (this.state === 'PLAYING') {
      const cx = this.mouseX, cy = this.mouseY;
      const cr = 14; // ring radius
      const pulse = Math.sin(now * 0.004) * 0.25 + 0.75;

      // Outer rune ring
      ctx.strokeStyle = `rgba(160,120,255,${pulse.toFixed(2)})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();

      // Four rune ticks
      ctx.strokeStyle = `rgba(200,180,255,${(pulse * 0.9).toFixed(2)})`;
      ctx.lineWidth   = 2;
      const tickLen = 6, gap = 5;
      [[0, -1],[0, 1],[- 1, 0],[1, 0]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx * (cr + gap),     cy + dy * (cr + gap));
        ctx.lineTo(cx + dx * (cr + gap + tickLen), cy + dy * (cr + gap + tickLen));
        ctx.stroke();
      });

      // Center gem dot
      ctx.fillStyle = `rgba(220,180,255,${pulse.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

      // Inner cross gap lines
      ctx.strokeStyle = `rgba(180,140,255,${(pulse * 0.5).toFixed(2)})`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(cx - gap + 1, cy); ctx.lineTo(cx - 2, cy);
      ctx.moveTo(cx + 2, cy);       ctx.lineTo(cx + gap - 1, cy);
      ctx.moveTo(cx, cy - gap + 1); ctx.lineTo(cx, cy - 2);
      ctx.moveTo(cx, cy + 2);       ctx.lineTo(cx, cy + gap - 1);
      ctx.stroke();
    }
  }

  // ── STATE SYNC ─────────────────────────────────────────────────────────────
  syncState() {
    if (this.updateReactState) {
      this.updateReactState({
        state:         this.state,
        score:         this.score,
        hiScore:       this.hiScore,
        round:         this.round,
        ammo:          this.ammo,
        maxAmmo:       this.maxAmmo,
        history:       [...this.history],
        mode:          this.mode,
        gameOverTaunt: this.gameOverTaunt,
        roundClearMsg: this.roundClearMsg,
        currentCombo:  this.currentCombo,
        // ENHANCED: Pass new state
        activePowerUp: this.activePowerUp,
        powerUpTimer:  this.powerUpTimer,
        stats:         {...this.stats},
        killStreak:    this.killStreak
      });
    }
  }

  destroy() {
    cancelAnimationFrame(this.reqId);
  }
}

// ─── REACT COMPONENT ────────────────────────────────────────────────────────
const App = () => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [gameState, setGameState] = useState({
    state:         'MENU',
    score:         0,
    hiScore:       parseInt(localStorage.getItem('retroweb_hi')) || 0,
    round:         1,
    ammo:          5,
    maxAmmo:       5,
    history:       new Array(10).fill('empty'),
    mode:          2,
    gameOverTaunt: '',
    roundClearMsg: '',
    currentCombo:  0,
    activePowerUp: null,
    powerUpTimer:  0,
    stats:         { totalShots: 0, totalHits: 0, totalKills: 0, perfectWaves: 0, maxCombo: 0, killStreak: 0, maxKillStreak: 0 },
    killStreak:    0
  });

  const initEngine = useCallback(() => {
    if (!canvasRef.current) return; // BUG 19 FIX: guard against null canvas on first render
    if (engineRef.current) engineRef.current.destroy();
    engineRef.current = new GameEngine(canvasRef.current, setGameState);
    setGameState(prev => ({ ...prev, hiScore: engineRef.current.hiScore }));
  }, []);

  useEffect(() => {
    initEngine();
    return () => { if (engineRef.current) engineRef.current.destroy(); };
  }, [initEngine]);

  // Track mouse on canvas for engine crosshair
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e) => {
      const eng = engineRef.current;
      if (!eng) return;
      const rect   = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      eng.mouseX = (e.clientX - rect.left) * scaleX;
      eng.mouseY = (e.clientY - rect.top)  * scaleY;
    };
    canvas.addEventListener('mousemove', onMove);
    return () => canvas.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const eng = engineRef.current;
      if (!eng) return;
      switch (e.key.toLowerCase()) {
        case '1': if (eng.state === 'MENU') eng.startGame(1); break;
        case '2': if (eng.state === 'MENU') eng.startGame(2); break;
        case '3': if (eng.state === 'MENU') eng.startGame(3); break;
        case 'r':
          // Restart — only from PLAYING or GAME_OVER
          if (eng.state !== 'MENU') eng.startGame(eng.mode);
          break;
        case 'escape':
          // FIX #13: clean all transient state before returning to menu
          eng.targets        = [];
          eng.particles      = [];
          eng.floatingTexts  = [];
          eng.hitMarkers     = [];
          eng.mascot.active  = false;
          eng._waveEndScheduled = false;
          eng.state          = 'MENU';
          eng.syncState();
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCanvasClick = (e) => {
    const eng = engineRef.current;
    if (!eng || eng.state !== 'PLAYING') return;
    const rect   = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width  / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    eng.shoot(
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top)  * scaleY
    );
  };

  const modeNames = { 1: 'EASY', 2: 'MEDIUM', 3: 'VERY HARD' };
  const modeColors = { 1: '#2ecc71', 2: '#f39c12', 3: '#e23636' };

  return (
    <div className="game-area">
      <canvas ref={canvasRef} onClick={handleCanvasClick} />
      <div className="crt-overlay" />
      <div id="screen-flash" className="flash" />

      {/* Top HUD */}
      {gameState.state !== 'MENU' && (
        <div className="hud-top">

          {/* Left: combo meter */}
          <div className="hud-top-left">
            <div className="hud-combo-label">COMBO</div>
            <div className="hud-combo-row">
              {[1,2,3,4,5].map(n => (
                <div
                  key={n}
                  className={`combo-pip ${gameState.currentCombo >= n ? 'active' : ''} ${gameState.currentCombo >= n && n === 5 ? 'max' : ''}`}
                />
              ))}
            </div>
            {gameState.currentCombo > 1 && (
              <div
                key={gameState.currentCombo}
                className="hud-combo-value"
                style={{ color: gameState.currentCombo >= 5 ? '#c0ff60' : '#f0c040' }}
              >
                {gameState.currentCombo}×
              </div>
            )}
          </div>

          {/* Center: game title ticker + power-up indicator */}
          <div className="hud-top-center">
            <span className="hud-title-ticker">REALM HUNTER</span>
            {gameState.activePowerUp && gameState.powerUpTimer > 0 && (
              <div className="powerup-indicator" style={{
                fontSize: '0.7vmin',
                color: '#00ffff',
                marginTop: '2px',
                textShadow: '0 0 5px #00ffff',
                animation: gameState.powerUpTimer < 2 ? 'blink 0.5s infinite' : 'none'
              }}>
                {gameState.activePowerUp.toUpperCase()} {Math.ceil(gameState.powerUpTimer)}s
              </div>
            )}
            {!gameState.activePowerUp && (
              <span className="hud-mode-badge" style={{ background: modeColors[gameState.mode] }}>
                {modeNames[gameState.mode]}
              </span>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="hud-top-right">
            <button className="btn btn-restart" onClick={() => engineRef.current?.startGame(engineRef.current.mode)}>
              ↺ RESTART
            </button>
            <button className="btn btn-menu" onClick={() => {
              const eng = engineRef.current;
              if (!eng) return;
              eng.targets = []; eng.particles = []; eng.floatingTexts = [];
              eng.hitMarkers = []; eng.mascot.active = false;
              eng._waveEndScheduled = false;
              eng.state = 'MENU'; eng.syncState();
            }}>
              ⌂ MENU
            </button>
          </div>
        </div>
      )}

      {/* MENU */}
      {gameState.state === 'MENU' && (
        <div className="overlay-screen">
          <div className="menu-title-top">REALM HUNTER</div>
          
          <div className="menu-center">
            <button className="btn-start-game" onClick={() => engineRef.current?.startGame(gameState.mode || 2)}>
              START GAME
            </button>
            
            <div className="difficulty-selector">
              <div className="difficulty-label">DIFFICULTY</div>
              <div className="difficulty-options">
                <button 
                  className={`difficulty-btn easy ${gameState.mode === 1 ? 'selected' : ''}`}
                  onClick={() => setGameState(prev => ({ ...prev, mode: 1 }))}
                >
                  SQUIRE
                </button>
                <button 
                  className={`difficulty-btn medium ${gameState.mode === 2 ? 'selected' : ''}`}
                  onClick={() => setGameState(prev => ({ ...prev, mode: 2 }))}
                >
                  KNIGHT
                </button>
                <button 
                  className={`difficulty-btn hard ${gameState.mode === 3 ? 'selected' : ''}`}
                  onClick={() => setGameState(prev => ({ ...prev, mode: 3 }))}
                >
                  LEGEND
                </button>
              </div>
            </div>
            
            <div className="menu-hi-score">
              BEST SCORE: <span>{gameState.hiScore.toString().padStart(6, '0')}</span>
            </div>
          </div>
          
          <div className="menu-footer">
            <div className="menu-tagline">Nock your arrow · Aim true · Slay the darkness</div>
          </div>
        </div>
      )}

      {/* ROUND START */}
      {gameState.state === 'ROUND_START' && (
        <div className="overlay-screen round-start-screen">
          <div className="wave-label">WAVE</div>
          <div className="wave-number">{gameState.round}</div>
          {gameState.roundClearMsg && (
            <div className="round-clear-msg">{gameState.roundClearMsg}</div>
          )}
        </div>
      )}

      {/* GAME OVER */}
      {gameState.state === 'GAME_OVER' && (
        <div className="overlay-screen">
          <div className="title-glow" style={{ color: '#e23636', textShadow: '3px 3px 0 #8b0000' }}>
            GAME OVER
          </div>
          <div className="go-score">SCORE: <span>{gameState.score.toString().padStart(6, '0')}</span></div>
          {gameState.score >= gameState.hiScore && gameState.score > 0 && (
            <div className="new-hi">✦ NEW BEST SCORE! ✦</div>
          )}
          <p className="go-taunt">"{gameState.gameOverTaunt}"</p>
          <div style={{ display: 'flex', gap: '2vw', marginTop: '2vh' }}>
            <div className="menu-opt" onClick={() => engineRef.current?.startGame(gameState.mode)}>
              TRY AGAIN (R)
            </div>
            <div className="menu-opt" style={{ color: '#8ab4f8' }} onClick={() => {
              const eng = engineRef.current;
              if (!eng) return;
              eng.targets = []; eng.particles = []; eng.floatingTexts = [];
              eng.hitMarkers = []; eng.mascot.active = false;
              eng._waveEndScheduled = false;
              eng.state = 'MENU'; eng.syncState();
            }}>
              MENU (ESC)
            </div>
          </div>
        </div>
      )}

      {/* Bottom HUD */}
      {gameState.state !== 'MENU' && (
        <div className="hud-bottom">

          {/* LEFT — wave + accuracy tracker */}
          <div className="hud-bottom-left">
            <div className="hud-wave-block">
              <span className="hud-wave-label">WAVE</span>
              <span className="hud-wave-num">{String(gameState.round).padStart(2,'0')}</span>
            </div>
            <div className="hud-hit-track">
              {gameState.history.map((res, i) => (
                <div
                  key={i}
                  className={`hit-pip ${res === 'hit' ? 'hit' : res === 'miss' ? 'miss' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* CENTER — arrow quiver */}
          <div className="hud-bottom-center">
            <div className="hud-ammo-label">ARROWS</div>
            <div className="hud-ammo-rack">
              {Array.from({ length: gameState.maxAmmo }).map((_, i) => (
                <div key={i} className={`bullet-icon ${i < (gameState.maxAmmo - gameState.ammo) ? 'spent' : ''}`} />
              ))}
            </div>
            {gameState.ammo === 0 && (
              <div className="hud-reload-warn">QUIVER EMPTY!</div>
            )}
          </div>

          {/* RIGHT — score board */}
          <div className="hud-bottom-right">
            <div className="hud-score-row">
              <span className="hud-score-label">SCORE</span>
              <span className="hud-score-val">{gameState.score.toString().padStart(7, '0')}</span>
            </div>
            <div className="hud-score-row hud-hi-row">
              <span className="hud-score-label hud-hi-label">BEST</span>
              <span className="hud-score-val hud-hi-val">{gameState.hiScore.toString().padStart(7, '0')}</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default App;
