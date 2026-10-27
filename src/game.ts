import { isDown, consume } from "./input";
import { level1 } from "./level";
import { sprites, JUMP_SEQUENCE, type SpriteName } from "./sprites";
import type { ActivePower, Level, PowerKind, Rect } from "./types";

const GRAVITY = 1800; // px/s^2
const MOVE_SPEED = 280; // px/s
const SPEED_BOOST_MULT = 1.8;
const JUMP_VELOCITY = -620; // px/s
const JUMP_BOOST_VELOCITY = -820; // px/s
const POWER_DURATION_SEC = 6;
const MAX_LIVES = 3;
const JUMP_ANIM_DURATION_SEC = 0.6;
const POWERUP_FLASH_SEC = 0.45;

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
  private walkPhase = 0;
  private legSwing = 0;
  private airTime = 0;
  private powerupFlash = 0;

  private hudLives: HTMLElement;
  private hudPower: HTMLElement;
  private overlay: HTMLElement;
  private overlayTitle: HTMLElement;
  private overlaySubtitle: HTMLElement;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.hudLives = document.getElementById("hud-lives")!;
    this.hudPower = document.getElementById("hud-power")!;
    this.overlay = document.getElementById("overlay")!;
    this.overlayTitle = document.getElementById("overlay-title")!;
    this.overlaySubtitle = document.getElementById("overlay-subtitle")!;
    this.resetRun();
  }

  private resetRun(): void {
    this.lives = MAX_LIVES;
    this.activePowers.clear();
    for (const p of this.level.powerUps) p.collected = false;
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
    } else if (consume("r")) {
      this.resetRun();
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private hasPower(kind: PowerKind): boolean {
    return this.activePowers.has(kind);
  }

  private update(dt: number): void {
    for (const [kind, power] of this.activePowers) {
      power.remainingSec -= dt;
      if (power.remainingSec <= 0) this.activePowers.delete(kind);
    }

    const p = this.player;
    const speed = MOVE_SPEED * (this.hasPower("speed") ? SPEED_BOOST_MULT : 1);

    let moveX = 0;
    if (isDown("ArrowLeft", "a")) moveX -= 1;
    if (isDown("ArrowRight", "d")) moveX += 1;
    p.vx = moveX * speed;
    if (moveX !== 0) p.facing = moveX > 0 ? 1 : -1;

    if ((isDown("ArrowUp", "w", " ")) && p.onGround) {
      p.vy = this.hasPower("jump") ? JUMP_BOOST_VELOCITY : JUMP_VELOCITY;
      p.onGround = false;
    }

    const walking = p.onGround && Math.abs(p.vx) > 5;
    if (walking) {
      this.walkPhase += dt * 16 * (speed / MOVE_SPEED);
      this.legSwing = Math.sin(this.walkPhase);
    } else {
      this.walkPhase = 0;
      this.legSwing = 0;
    }

    if (p.onGround) {
      this.airTime = 0;
    } else {
      this.airTime += dt;
    }
    if (this.powerupFlash > 0) {
      this.powerupFlash = Math.max(0, this.powerupFlash - dt);
    }

    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(0, Math.min(p.x, this.level.widthPx - p.w));

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
      if (intersects(p, hazard)) this.handleHazardHit();
    }

    for (const powerUp of this.level.powerUps) {
      if (!powerUp.collected && intersects(p, powerUp)) {
        powerUp.collected = true;
        this.activePowers.set(powerUp.kind, {
          kind: powerUp.kind,
          remainingSec: POWER_DURATION_SEC,
        });
        this.powerupFlash = POWERUP_FLASH_SEC;
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

  private handleHazardHit(): void {
    if (this.hasPower("shield")) {
      this.activePowers.delete("shield");
      return;
    }
    this.loseLife();
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
      ctx.fillStyle = powerUpColor(powerUp.kind);
      ctx.beginPath();
      ctx.arc(
        powerUp.x + powerUp.w / 2,
        powerUp.y + powerUp.h / 2,
        powerUp.w / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.fillStyle = "#f4d35e";
    ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);

    this.renderPlayerSprite();

    ctx.restore();
  }

  private currentSpriteName(): SpriteName {
    if (this.powerupFlash > 0) return "powerup";
    if (!this.player.onGround) {
      const idx = Math.min(
        JUMP_SEQUENCE.length - 1,
        Math.floor((this.airTime / JUMP_ANIM_DURATION_SEC) * JUMP_SEQUENCE.length),
      );
      return JUMP_SEQUENCE[idx];
    }
    if (Math.abs(this.player.vx) > 5) {
      return this.legSwing >= 0 ? "run1" : "run2";
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
      ctx.fillStyle = "#6ee7ff";
      ctx.beginPath();
      ctx.arc(cx, p.y + p.h / 2, Math.max(p.w, p.h) * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const name = this.currentSpriteName();
    const img = sprites[name];
    if (!img.complete || img.naturalWidth === 0) return;

    const targetH = name === "powerup" ? 112 : 74;
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

function powerUpColor(kind: PowerKind): string {
  switch (kind) {
    case "speed":
      return "#facc15";
    case "jump":
      return "#60a5fa";
    case "shield":
      return "#6ee7ff";
  }
}
