import { consumeClickTarget, consumeJump, consumeAttack, consumeAnyAction, getFlyTarget } from "./input";
import { level1 } from "./level";
import { sprites, JUMP_SEQUENCE, type SpriteName } from "./sprites";
import type { ActivePower, Enemy, Level, PickupKind, PowerKind, Rect } from "./types";

const GRAVITY = 1800; // px/s^2
const FLY_GRAVITY_MULT = 0.18; // slow float-fall while the fly power-up is active (unheld)
const MAX_LIVES = 3;
const JUMP_ANIM_DURATION_SEC = 0.6;
const POWERUP_FLASH_SEC = 0.45;

// Every click/tap is an aimed launch toward that point, not a held run.
// A single click is a light launch; a double-click/tap is a full-strength
// one (unchanged from before). Both share the same buffer-then-fire
// mechanism: the direction is captured at click time, but the actual
// launch only applies once the player is grounded (or already flying),
// firing automatically the instant they land if that wasn't immediate.
const WEAK_LAUNCH_SPEED = 320; // px/s, single click
const JUMP_SPEED = 620; // px/s, double click
const JUMP_BOOST_SPEED = 820; // px/s, double click with the jump power-up
const LAUNCH_AIM_MIN_DIST = 6; // px; closer than this, aim straight up instead
const LAUNCH_BUFFER_SEC = 0.3;
const WEAK_LAUNCH_ANIM_SEC = 0.3; // cosmetic only: hop1 vs hop2 split while airborne
const SPEED_BOOST_MULT = 1.8;

// Press and hold (don't release) to fly toward the pointer: full manual
// velocity control, bypassing gravity for as long as it's held. Placeholder
// pose for now (reuses the jump sequence's last frame) until real art
// arrives for it.
const FLY_HOLD_SPEED = 300; // px/s
const FLY_HOLD_MIN_DIST = 6; // px; closer than this, just hover in place
const FARTING_FLY_HOLD_COST_PER_SEC = 14;

const FLY_MIN_Y = 10; // keep the player from flying above the (unscrolled) top of the view

const POWER_DURATIONS: Record<PowerKind, number> = {
  speed: 6,
  jump: 6,
  shield: 6,
  fly: 8,
};

// Farting Power: a stamina-like resource that regenerates on its own and is
// spent by every action. Running out doesn't lock the player out — it just
// makes move/jump/attack weaker until it recovers (or bean soup refills it).
const FARTING_MAX = 100;
const FARTING_REGEN_PER_SEC = 6;
const FARTING_WEAK_LAUNCH_COST = 6;
const FARTING_JUMP_COST = 12;
const FARTING_ATTACK_COST = 18;
const DEPLETED_SPEED_MULT = 0.5;
const DEPLETED_JUMP_MULT = 0.6;
const DEPLETED_ATTACK_RANGE_MULT = 0.4;

const ATTACK_RANGE = 40; // px, in front of the player
const ATTACK_COOLDOWN_SEC = 0.45;
const ATTACK_FLASH_SEC = 0.15;

interface Player extends Rect {
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

type Status = "playing" | "dead" | "won";

export class Game {
  private ctx: CanvasRenderingContext2D;
  private level: Level = level1;
  private player!: Player;
  private cameraX = 0;
  private lives = MAX_LIVES;
  private activePowers = new Map<PowerKind, ActivePower>();
  private status: Status = "playing";
  private lastTime = 0;
  private weakLaunchBuffer = 0;
  private weakDirX = 0;
  private weakDirY = -1;
  private jumpBuffer = 0;
  private jumpDirX = 0;
  private jumpDirY = -1;
  private launchTier: "weak" | "strong" | null = null;
  private isHoldFlying = false;
  private airTime = 0;
  private powerupFlash = 0;
  private elapsed = 0;
  private fartingPower = FARTING_MAX;
  private attackCooldown = 0;
  private attackFlash = 0;

  private hudLives: HTMLElement;
  private hudPower: HTMLElement;
  private hudFartingFill: HTMLElement;
  private overlay: HTMLElement;
  private overlayTitle: HTMLElement;
  private overlaySubtitle: HTMLElement;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.hudLives = document.getElementById("hud-lives")!;
    this.hudPower = document.getElementById("hud-power")!;
    this.hudFartingFill = document.getElementById("hud-farting-fill")!;
    this.overlay = document.getElementById("overlay")!;
    this.overlayTitle = document.getElementById("overlay-title")!;
    this.overlaySubtitle = document.getElementById("overlay-subtitle")!;
    this.resetRun();
  }

  private resetRun(): void {
    this.lives = MAX_LIVES;
    this.activePowers.clear();
    for (const p of this.level.powerUps) p.collected = false;
    for (const e of this.level.enemies) {
      e.alive = true;
      e.dir = 1;
      e.x = e.minX;
    }
    this.fartingPower = FARTING_MAX;
    this.attackCooldown = 0;
    this.attackFlash = 0;
    this.weakLaunchBuffer = 0;
    this.jumpBuffer = 0;
    this.launchTier = null;
    this.isHoldFlying = false;
    this.spawnPlayer();
    this.status = "playing";
    this.overlay.classList.add("hidden");
  }

  private spawnPlayer(): void {
    this.player = {
      x: this.level.playerStart.x,
      y: this.level.playerStart.y,
      w: 32,
      h: 44,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
    };
  }

  start(): void {
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;

    if (this.status === "playing") {
      this.update(dt || 0);
    } else if (consumeAnyAction()) {
      this.resetRun();
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private hasPower(kind: PowerKind): boolean {
    return this.activePowers.has(kind);
  }

  private update(dt: number): void {
    this.elapsed += dt;

    for (const [kind, power] of this.activePowers) {
      power.remainingSec -= dt;
      if (power.remainingSec <= 0) this.activePowers.delete(kind);
    }

    const depleted = this.fartingPower <= 0;
    const p = this.player;
    const poweredFly = this.hasPower("fly");

    const flyHoldTarget = getFlyTarget();
    this.isHoldFlying = flyHoldTarget !== null;

    if (this.isHoldFlying) {
      const screenX = p.x + p.w / 2 - this.cameraX;
      const screenY = p.y + p.h / 2;
      const dx = flyHoldTarget!.x - screenX;
      const dy = flyHoldTarget!.y - screenY;
      const dist = Math.hypot(dx, dy);
      const speed = FLY_HOLD_SPEED * (depleted ? DEPLETED_SPEED_MULT : 1);
      if (dist > FLY_HOLD_MIN_DIST) {
        p.vx = (dx / dist) * speed;
        p.vy = (dy / dist) * speed;
        if (Math.abs(dx) > dist * 0.05) p.facing = dx > 0 ? 1 : -1;
      } else {
        p.vx = 0;
        p.vy = 0;
      }
      p.onGround = false;
      this.weakLaunchBuffer = 0;
      this.jumpBuffer = 0;
      this.launchTier = null;
      this.fartingPower = Math.max(0, this.fartingPower - FARTING_FLY_HOLD_COST_PER_SEC * dt);
    } else {
      if (poweredFly) {
        p.vy += GRAVITY * FLY_GRAVITY_MULT * dt;
      } else {
        p.vy += GRAVITY * dt;
      }

      // Weak launch: single click/tap.
      const clickTarget = consumeClickTarget();
      if (clickTarget !== null) {
        const screenX = p.x + p.w / 2 - this.cameraX;
        const screenY = p.y + p.h / 2;
        const dx = clickTarget.x - screenX;
        const dy = clickTarget.y - screenY;
        const dist = Math.hypot(dx, dy);
        if (dist < LAUNCH_AIM_MIN_DIST) {
          this.weakDirX = 0;
          this.weakDirY = -1;
        } else {
          this.weakDirX = dx / dist;
          this.weakDirY = dy / dist;
        }
        this.weakLaunchBuffer = LAUNCH_BUFFER_SEC;
      }
      if (this.weakLaunchBuffer > 0) {
        if (p.onGround || poweredFly) {
          const baseSpeed = WEAK_LAUNCH_SPEED * (this.hasPower("speed") ? SPEED_BOOST_MULT : 1);
          const speed = depleted ? baseSpeed * DEPLETED_SPEED_MULT : baseSpeed;
          p.vx = this.weakDirX * speed;
          p.vy = this.weakDirY * speed;
          if (Math.abs(this.weakDirX) > 0.05) {
            p.facing = this.weakDirX > 0 ? 1 : -1;
          }
          p.onGround = false;
          this.launchTier = "weak";
          this.fartingPower = Math.max(0, this.fartingPower - FARTING_WEAK_LAUNCH_COST);
          this.weakLaunchBuffer = 0;
        } else {
          this.weakLaunchBuffer = Math.max(0, this.weakLaunchBuffer - dt);
        }
      }

      // Strong launch: double-click/tap (unchanged from before).
      const jumpTarget = consumeJump();
      if (jumpTarget !== null) {
        const screenX = p.x + p.w / 2 - this.cameraX;
        const screenY = p.y + p.h / 2;
        const dx = jumpTarget.x - screenX;
        const dy = jumpTarget.y - screenY;
        const dist = Math.hypot(dx, dy);
        if (dist < LAUNCH_AIM_MIN_DIST) {
          this.jumpDirX = 0;
          this.jumpDirY = -1;
        } else {
          this.jumpDirX = dx / dist;
          this.jumpDirY = dy / dist;
        }
        this.jumpBuffer = LAUNCH_BUFFER_SEC;
      }
      if (this.jumpBuffer > 0) {
        if (p.onGround || poweredFly) {
          const baseSpeed = this.hasPower("jump") ? JUMP_BOOST_SPEED : JUMP_SPEED;
          const speed = depleted ? baseSpeed * DEPLETED_JUMP_MULT : baseSpeed;
          p.vx = this.jumpDirX * speed;
          p.vy = this.jumpDirY * speed;
          if (Math.abs(this.jumpDirX) > 0.05) {
            p.facing = this.jumpDirX > 0 ? 1 : -1;
          }
          p.onGround = false;
          this.weakLaunchBuffer = 0;
          this.launchTier = "strong";
          this.fartingPower = Math.max(0, this.fartingPower - FARTING_JUMP_COST);
          this.jumpBuffer = 0;
        } else {
          this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
        }
      }

      if (p.onGround) {
        // Only zero it out once grounded and nothing fired this frame —
        // otherwise this would cancel an in-flight launch's horizontal
        // component the instant it starts.
        p.vx = 0;
        this.launchTier = null;
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.attackFlash > 0) {
      this.attackFlash = Math.max(0, this.attackFlash - dt);
    }
    if (consumeAttack() && this.attackCooldown <= 0) {
      this.performAttack(depleted);
    }

    this.fartingPower = Math.min(FARTING_MAX, this.fartingPower + FARTING_REGEN_PER_SEC * dt);

    if (p.onGround) {
      this.airTime = 0;
    } else {
      this.airTime += dt;
    }
    if (this.powerupFlash > 0) {
      this.powerupFlash = Math.max(0, this.powerupFlash - dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(0, Math.min(p.x, this.level.widthPx - p.w));
    if (poweredFly || this.isHoldFlying) {
      p.y = Math.max(FLY_MIN_Y, p.y);
    }

    p.onGround = false;
    for (const platform of this.level.platforms) {
      if (!intersects(p, platform)) continue;
      const fallingOntoTop =
        p.vy >= 0 && p.y + p.h - p.vy * dt <= platform.y + 1;
      if (fallingOntoTop) {
        p.y = platform.y - p.h;
        p.vy = 0;
        p.onGround = true;
      } else if (p.x + p.w / 2 < platform.x) {
        p.x = platform.x - p.w;
      } else if (p.x + p.w / 2 > platform.x + platform.w) {
        p.x = platform.x + platform.w;
      }
    }

    for (const hazard of this.level.hazards) {
      if (intersects(p, hazard)) this.handleContactDamage();
    }

    for (const enemy of this.level.enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.speed * enemy.dir * dt;
      if (enemy.x <= enemy.minX) {
        enemy.x = enemy.minX;
        enemy.dir = 1;
      } else if (enemy.x >= enemy.maxX) {
        enemy.x = enemy.maxX;
        enemy.dir = -1;
      }
      if (intersects(p, enemy)) {
        this.handleContactDamage();
      }
    }

    for (const powerUp of this.level.powerUps) {
      if (powerUp.collected || !intersects(p, powerUp)) continue;
      powerUp.collected = true;
      this.powerupFlash = POWERUP_FLASH_SEC;
      if (powerUp.kind === "beansoup") {
        this.fartingPower = FARTING_MAX;
      } else {
        this.activePowers.set(powerUp.kind, {
          kind: powerUp.kind,
          remainingSec: POWER_DURATIONS[powerUp.kind],
        });
      }
    }

    if (intersects(p, this.level.goal)) {
      this.status = "won";
      this.showOverlay("Level clear!", "Press R to play again");
    }

    if (p.y > this.level.heightPx + 80) {
      this.handleFallDeath();
    }

    const viewportW = this.canvas.width;
    this.cameraX = Math.max(
      0,
      Math.min(p.x + p.w / 2 - viewportW / 2, this.level.widthPx - viewportW),
    );

    this.updateHud();
  }

  private handleContactDamage(): void {
    if (this.hasPower("shield")) {
      this.activePowers.delete("shield");
      return;
    }
    this.loseLife();
  }

  private performAttack(depleted: boolean): void {
    const p = this.player;
    this.attackCooldown = ATTACK_COOLDOWN_SEC;
    this.attackFlash = ATTACK_FLASH_SEC;
    this.fartingPower = Math.max(0, this.fartingPower - FARTING_ATTACK_COST);

    const range = ATTACK_RANGE * (depleted ? DEPLETED_ATTACK_RANGE_MULT : 1);
    const hitbox: Rect =
      p.facing === 1
        ? { x: p.x + p.w, y: p.y, w: range, h: p.h }
        : { x: p.x - range, y: p.y, w: range, h: p.h };

    for (const enemy of this.level.enemies) {
      if (enemy.alive && intersects(hitbox, enemy)) {
        enemy.alive = false;
      }
    }
  }

  private handleFallDeath(): void {
    this.loseLife();
  }

  private loseLife(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.status = "dead";
      this.showOverlay("Game over", "Press R to restart");
      return;
    }
    this.spawnPlayer();
  }

  private showOverlay(title: string, subtitle: string): void {
    this.overlayTitle.textContent = title;
    this.overlaySubtitle.textContent = subtitle;
    this.overlay.classList.remove("hidden");
  }

  private updateHud(): void {
    this.hudLives.textContent = `Lives: ${"♥".repeat(Math.max(this.lives, 0))}`;
    const active = [...this.activePowers.values()]
      .map((p) => `${p.kind} ${p.remainingSec.toFixed(1)}s`)
      .join("  ");
    this.hudPower.textContent = active;

    const pct = this.fartingPower / FARTING_MAX;
    this.hudFartingFill.style.width = `${pct * 100}%`;
    this.hudFartingFill.style.background =
      pct > 0.5 ? "#84cc16" : pct > 0.2 ? "#facc15" : "#ef4444";
  }

  private render(): void {
    const { ctx, canvas, level, cameraX } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-cameraX, 0);

    ctx.fillStyle = "#2c2f66";
    for (const platform of level.platforms) {
      ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    }

    ctx.fillStyle = "#e23b3b";
    for (const hazard of level.hazards) {
      ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
    }

    for (const powerUp of level.powerUps) {
      if (powerUp.collected) continue;
      const pcx = powerUp.x + powerUp.w / 2;
      const pcy = powerUp.y + powerUp.h / 2;
      if (powerUp.kind === "fly") {
        drawWingIcon(ctx, pcx, pcy, powerUp.w / 2, powerUpColor(powerUp.kind));
      } else if (powerUp.kind === "beansoup") {
        drawBeanSoupIcon(ctx, pcx, pcy, powerUp.w / 2, powerUpColor(powerUp.kind));
      } else {
        ctx.fillStyle = powerUpColor(powerUp.kind);
        ctx.strokeStyle = "#1b1d3a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pcx, pcy, powerUp.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    for (const enemy of level.enemies) {
      if (enemy.alive) drawEnemy(ctx, enemy, this.elapsed);
    }

    ctx.fillStyle = "#f4d35e";
    ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);

    this.renderPlayerSprite();

    ctx.restore();
  }

  private currentSpriteName(): SpriteName {
    if (this.attackFlash > 0) return "attack";
    if (this.powerupFlash > 0) return "powerup";
    if (this.isHoldFlying) {
      // Placeholder pose until the real hold-to-fly art arrives.
      return JUMP_SEQUENCE[JUMP_SEQUENCE.length - 1];
    }
    if (this.launchTier === "weak" && !this.player.onGround) {
      return this.airTime < WEAK_LAUNCH_ANIM_SEC / 2 ? "hop1" : "hop2";
    }
    if (this.hasPower("fly") && !this.player.onGround) {
      return JUMP_SEQUENCE[JUMP_SEQUENCE.length - 1];
    }
    if (!this.player.onGround) {
      const idx = Math.min(
        JUMP_SEQUENCE.length - 1,
        Math.floor((this.airTime / JUMP_ANIM_DURATION_SEC) * JUMP_SEQUENCE.length),
      );
      return JUMP_SEQUENCE[idx];
    }
    return "standing";
  }

  private renderPlayerSprite(): void {
    const { ctx, player: p } = this;
    const cx = p.x + p.w / 2;
    const bottom = p.y + p.h;

    if (this.hasPower("shield")) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(cx, p.y + p.h / 2, Math.max(p.w, p.h) * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.hasPower("fly") || this.isHoldFlying) {
      const wingCy = p.y + p.h * 0.4;
      const wingSize = p.w * 0.65;
      ctx.save();
      ctx.globalAlpha = 0.85;
      drawWingIcon(ctx, p.x, wingCy, wingSize, powerUpColor("fly"), false);
      drawWingIcon(ctx, p.x + p.w, wingCy, wingSize, powerUpColor("fly"), true);
      ctx.restore();
    }

    const name = this.currentSpriteName();
    const img = sprites[name];
    if (!img.complete || img.naturalWidth === 0) return;

    const targetH = name === "powerup" ? 112 : name === "attack" ? 84 : 74;
    const scale = targetH / img.naturalHeight;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    ctx.save();
    if (p.facing === -1) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, bottom - h, w, h);
    } else {
      ctx.drawImage(img, cx - w / 2, bottom - h, w, h);
    }
    ctx.restore();
  }
}

function powerUpColor(kind: PickupKind): string {
  switch (kind) {
    case "speed":
      return "#facc15";
    case "jump":
      return "#60a5fa";
    case "shield":
      return "#22d3ee";
    case "fly":
      return "#a78bfa";
    case "beansoup":
      return "#d97706";
  }
}

// Placeholder wing icon (pickup + flight aura) — a simple feathered silhouette
// drawn with canvas paths until real art replaces it. `flip` mirrors it
// horizontally so a pair can be drawn either side of the player.
function drawWingIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  color: string,
  flip = false,
): void {
  const d = flip ? -1 : 1;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.1);

  ctx.beginPath();
  ctx.moveTo(cx - d * s, cy + s * 0.3);
  ctx.quadraticCurveTo(cx - d * s * 0.2, cy - s, cx + d * s, cy - s * 0.1);
  ctx.quadraticCurveTo(
    cx + d * s * 0.25,
    cy + s * 0.25,
    cx - d * s * 0.1,
    cy + s * 0.55,
  );
  ctx.quadraticCurveTo(cx - d * s * 0.6, cy + s * 0.55, cx - d * s, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha *= 0.6;
  for (const t of [0.35, 0.6, 0.85]) {
    ctx.beginPath();
    ctx.moveTo(cx + d * s * (1 - t) * 0.9, cy - s * (0.1 + t * 0.5));
    ctx.lineTo(cx - d * s * 0.5 * t, cy + s * 0.4 * t);
    ctx.stroke();
  }
  ctx.restore();
}

// Placeholder bean soup icon — a bowl outline with a few beans and steam,
// drawn with canvas paths until real art replaces it.
function drawBeanSoupIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, s * 0.18);

  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.3, s * 0.9, s * 0.5, 0, 0, Math.PI, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.05, s * 0.95, s * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  for (const [bx, by] of [
    [-0.4, -0.05],
    [0.1, 0.1],
    [0.45, -0.1],
  ]) {
    ctx.beginPath();
    ctx.ellipse(cx + bx * s, cy + by * s, s * 0.18, s * 0.1, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.6;
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy - s * 0.5);
  ctx.quadraticCurveTo(cx - s * 0.35, cy - s * 0.8, cx - s * 0.1, cy - s * 1.05);
  ctx.moveTo(cx + s * 0.25, cy - s * 0.5);
  ctx.quadraticCurveTo(cx + s * 0.1, cy - s * 0.8, cx + s * 0.35, cy - s * 1.05);
  ctx.stroke();
  ctx.restore();
}

// Placeholder enemy — a spiky, bobbing urchin shape drawn with canvas paths
// until real art replaces it.
function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number): void {
  const cx = enemy.x + enemy.w / 2;
  const cy = enemy.y + enemy.h / 2 + Math.sin(t * 4 + enemy.x * 0.05) * 3;
  const r = enemy.w / 2;
  const spikes = 8;

  ctx.save();
  ctx.fillStyle = "#b4213f";
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (Math.PI * i) / spikes;
    const rad = i % 2 === 0 ? r : r * 0.55;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.3, cy - r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a0a0a";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.1, r * 0.08, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.3, cy - r * 0.1, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

