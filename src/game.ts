import {
  consumeClickTarget,
  consumeJump,
  consumeAttack,
  consumeAnyAction,
  getFlyTarget,
  getPressIndicator,
  setUiButtons,
  type UiButton,
} from "./input";
import { level1 } from "./level";
import { sprites, JUMP_SEQUENCE, type SpriteName } from "./sprites";
import { isMuted, setFlying, sfx, toggleMute } from "./audio";
import {
  INK,
  MARKER_FONT,
  drawBean,
  drawButton,
  drawCheckpoint,
  drawEnemy,
  drawHeart,
  drawPaper,
  drawPickupIcon,
  drawPlatform,
  drawPuffIcon,
  drawSpikes,
  drawToilet,
  drawWing,
  handText,
  hatch,
  pickupColor,
  pickupLabel,
  setBoil,
  sketchCircle,
  sketchLine,
  sketchRect,
  type ButtonIcon,
} from "./doodle";
import type { ActivePower, Enemy, Level, PowerKind, Rect } from "./types";
import { VIEW_H, VIEW_W } from "./view";

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
// Landing bleeds off leftover horizontal speed over a few frames (a short
// skid, shown with the run frames) instead of stopping dead.
const GROUND_FRICTION = 2600; // px/s^2

// Press and hold (don't release) to fly: ascends at a constant rate the
// whole time it's held, regardless of the pointer's position — only the
// pointer's horizontal side of the player (not how far) steers left/right.
const FLY_HOLD_VY_SPEED = 260; // px/s, constant ascend while held
const FLY_HOLD_VX_SPEED = 300; // px/s, horizontal steer toward the pointer's side
const FLY_HOLD_DEADZONE_PX = 10; // px; pointer within this of the player's x -> go straight up

const FLY_MIN_Y = 10; // keep the player from flying above the (unscrolled) top of the view

const POWER_DURATIONS: Record<PowerKind, number> = {
  speed: 6,
  jump: 6,
  shield: 6,
  fly: 8,
};
const POWER_WARN_SEC = 1.5; // power-up icons/auras blink for this long before expiring

// Farting Power: a stamina-like resource that regenerates on its own and is
// spent by every action. Running out doesn't lock the player out — it just
// makes move/jump/attack weaker until it recovers (or bean soup refills it).
const FARTING_MAX = 100;
const FARTING_REGEN_PER_SEC = 6;
const FARTING_WEAK_LAUNCH_COST = 6;
const FARTING_JUMP_COST = 12;
const FARTING_ATTACK_COST = 18;
// Flying is continuous, not a one-off action, so it's priced per second —
// 2.5x a single tap's cost per second of hold.
const FARTING_FLY_HOLD_COST_PER_SEC = FARTING_WEAK_LAUNCH_COST * 2.5;
const DEPLETED_SPEED_MULT = 0.5;
const DEPLETED_JUMP_MULT = 0.6;
const DEPLETED_ATTACK_RANGE_MULT = 0.4;
const FARTING_LOW = 22; // below this the meter blinks and the flight jet sputters
const BEAN_FARTING = 5; // each bean tops up this much
const BEAN_COMBO_SEC = 0.7; // beans grabbed within this of each other raise the blip's pitch

const ATTACK_RANGE = 40; // px, in front of the player
const ATTACK_COOLDOWN_SEC = 0.45;
const ATTACK_FLASH_SEC = 0.15;

// Getting hurt: the shield soaks a hit with knockback + a short blinking
// invulnerability window; without it you lose a life, play a short death
// tumble, and respawn (at the last checkpoint) also briefly invulnerable.
const INVULN_SEC = 1.2;
const DYING_SEC = 1.1;
const WIN_SEC = 2.6;
// Ignore input for a moment after a screen changes, so the tap that
// started/restarted the game (or its double-tap) doesn't also launch you.
const INPUT_GRACE_SEC = 0.3;

const CAM_LOOKAHEAD = 90; // px the camera leads in the facing direction
const MAX_PARTICLES = 450;
const BEST_TIME_KEY = "powerplatformer.bestTime";

interface Player extends Rect {
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
}

type ParticleKind = "puff" | "dust" | "spark" | "ring" | "text";

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  seed: number;
  text?: string;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

function readBestTime(): number | null {
  try {
    const v = Number(localStorage.getItem(BEST_TIME_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

type Status = "title" | "playing" | "paused" | "dying" | "winning" | "won" | "gameover";

const STRONG_FART_WORDS = ["BRAAP!", "PFFT!", "TOOT!", "FRRRT!", "POOT!"];

export class Game {
  private ctx: CanvasRenderingContext2D;
  private level: Level = level1;
  private player!: Player;
  private cameraX = 0;
  private camLead = 0;
  private lives = MAX_LIVES;
  private activePowers = new Map<PowerKind, ActivePower>();
  private status: Status = "title";
  private stateTime = 0;
  private lastTime = 0;
  private weakLaunchBuffer = 0;
  private weakDirX = 0;
  private weakDirY = -1;
  private jumpBuffer = 0;
  private jumpDirX = 0;
  private jumpDirY = -1;
  private launchTier: "weak" | "strong" | null = null;
  private isHoldFlying = false;
  private flightExhausted = false;
  private airTime = 0;
  private powerupFlash = 0;
  private elapsed = 0;
  private fartingPower = FARTING_MAX;
  private attackCooldown = 0;
  private attackFlash = 0;

  // Juice / feel
  private particles: Particle[] = [];
  private particleSeed = 0;
  private flyEmitAcc = 0;
  private shake = 0;
  private hitStop = 0;
  private invuln = 0;
  private squashX = 1;
  private squashY = 1;
  private groundedLastFrame = false;
  private idleTimer = 0;
  private idleNext = 4;
  private deadEnemies: { enemy: Enemy; t: number }[] = [];
  private checkpointRaise: number[] = [];

  // Run bookkeeping
  private respawnPoint = { x: 0, y: 0 };
  private dyingFromFall = false;
  private runTime = 0;
  private deaths = 0;
  private enemiesFarted = 0;
  private beansCollected = 0;
  private beanCombo = 0;
  private beanComboTimer = 0;
  private bestTime: number | null = readBestTime();
  private newBest = false;

  private readonly isTouch = window.matchMedia("(pointer: coarse)").matches;
  private readonly canFullscreen = !!document.fullscreenEnabled;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resetRun();
    this.status = "title";

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    window.addEventListener("blur", () => this.pause());
  }

  private setStatus(status: Status): void {
    this.status = status;
    this.stateTime = 0;
    if (status !== "playing") setFlying(false, false);
  }

  private pause(): void {
    if (this.status === "playing") this.setStatus("paused");
  }

  private resetRun(): void {
    this.lives = MAX_LIVES;
    this.activePowers.clear();
    for (const p of this.level.powerUps) p.collected = false;
    for (const b of this.level.beans) b.collected = false;
    for (const c of this.level.checkpoints) c.reached = false;
    this.checkpointRaise = this.level.checkpoints.map(() => 0);
    for (const e of this.level.enemies) {
      e.alive = true;
      e.dir = 1;
      e.x = e.minX;
    }
    this.deadEnemies = [];
    this.particles = [];
    this.fartingPower = FARTING_MAX;
    this.attackCooldown = 0;
    this.attackFlash = 0;
    this.runTime = 0;
    this.deaths = 0;
    this.enemiesFarted = 0;
    this.beansCollected = 0;
    this.newBest = false;
    this.respawnPoint = { ...this.level.playerStart };
    this.spawnPlayer();
    this.invuln = 0;
    this.setStatus("playing");
  }

  private spawnPlayer(): void {
    this.player = {
      x: this.respawnPoint.x,
      y: this.respawnPoint.y,
      w: 32,
      h: 44,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
    };
    this.weakLaunchBuffer = 0;
    this.jumpBuffer = 0;
    this.launchTier = null;
    this.isHoldFlying = false;
    this.flightExhausted = false;
    this.airTime = 0;
    this.squashX = 1;
    this.squashY = 1;
    this.camLead = 0;
    this.cameraX = this.clampCamera(this.player.x + this.player.w / 2 - VIEW_W / 2);
  }

  start(): void {
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(now: number): void {
    const dt = this.lastTime === 0 ? 0 : Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;
    this.elapsed += dt;
    this.stateTime += dt;
    setBoil(this.elapsed);

    switch (this.status) {
      // Menu screens always drain input, so a tap made during a screen's
      // lock-out period is dropped rather than firing once it ends.
      case "title":
        if (consumeAnyAction() && this.stateTime > INPUT_GRACE_SEC) {
          sfx("ui");
          this.resetRun();
        }
        break;
      case "playing":
        if (this.stateTime < INPUT_GRACE_SEC) consumeAnyAction();
        if (this.hitStop > 0) {
          this.hitStop = Math.max(0, this.hitStop - dt);
        } else {
          this.update(dt);
        }
        break;
      case "paused":
        if (consumeAnyAction() && this.stateTime > INPUT_GRACE_SEC) this.setStatus("playing");
        break;
      case "dying":
        this.updateDying(dt);
        break;
      case "winning":
        this.updateWinning(dt);
        break;
      case "won":
      case "gameover":
        if (consumeAnyAction() && this.stateTime > 0.8) {
          sfx("ui");
          this.resetRun();
        }
        break;
    }

    if (this.status !== "paused" && this.hitStop <= 0) this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 40);

    this.registerButtons();
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private hasPower(kind: PowerKind): boolean {
    return this.activePowers.has(kind);
  }

  private clampCamera(x: number): number {
    return Math.max(0, Math.min(x, this.level.widthPx - VIEW_W));
  }

  // Where fart effects come out: low and behind the player, relative to
  // the direction they're facing (matches the clouds drawn in the sprites).
  private buttPos(): { x: number; y: number } {
    const p = this.player;
    if (this.isHoldFlying) return { x: p.x + p.w / 2, y: p.y + p.h - 12 };
    return { x: p.x + p.w / 2 - p.facing * 10, y: p.y + p.h - 22 };
  }

  private update(dt: number): void {
    this.runTime += dt;

    for (const [kind, power] of this.activePowers) {
      power.remainingSec -= dt;
      if (power.remainingSec <= 0) {
        this.activePowers.delete(kind);
        const c = this.center();
        this.burst("spark", c.x, c.y, 8, 120, pickupColor(kind));
      }
    }

    // Regen first, action costs after — so a draining cost can actually
    // bring Farting Power to exactly 0 and hold it there, instead of this
    // frame's regen immediately topping it back up past a depleted check.
    this.fartingPower = Math.min(FARTING_MAX, this.fartingPower + FARTING_REGEN_PER_SEC * dt);

    const depleted = this.fartingPower <= 0;
    const p = this.player;
    const poweredFly = this.hasPower("fly");
    const wasHoldFlying = this.isHoldFlying;

    const flyHoldTarget = getFlyTarget();
    if (flyHoldTarget === null) {
      this.flightExhausted = false;
    }
    // Flying stops the instant Farting Power runs out — the player lands
    // instead of just flying weaker, unlike every other soft-penalized
    // action. Once exhausted mid-flight, it stays grounded even if still
    // held; releasing and holding again is what re-engages it (otherwise
    // regen would let it flicker back on a frame later).
    this.isHoldFlying = flyHoldTarget !== null && !this.flightExhausted;

    if (this.isHoldFlying) {
      if (!wasHoldFlying) {
        const b = this.buttPos();
        this.fartBurst(b.x, b.y, 0, 1, 7, 160, 6, 10);
        this.squashX = 0.85;
        this.squashY = 1.15;
      }
      const screenX = p.x + p.w / 2 - this.cameraX;
      const dx = flyHoldTarget!.x - screenX;
      if (Math.abs(dx) > FLY_HOLD_DEADZONE_PX) {
        p.vx = Math.sign(dx) * FLY_HOLD_VX_SPEED;
        p.facing = dx > 0 ? 1 : -1;
      } else {
        p.vx = 0;
      }
      p.vy = -FLY_HOLD_VY_SPEED;
      p.onGround = false;
      this.weakLaunchBuffer = 0;
      this.jumpBuffer = 0;
      this.launchTier = null;
      this.fartingPower = Math.max(0, this.fartingPower - FARTING_FLY_HOLD_COST_PER_SEC * dt);
      this.emitFlightJet(dt);
      if (this.fartingPower <= 0) {
        this.flightExhausted = true;
        const b = this.buttPos();
        this.fartBurst(b.x, b.y, 0, 1, 5, 60, 4, 7, "#c8c2ae");
        this.floatText(p.x + p.w / 2, p.y - 16, "EMPTY!", "#c62f2f", 24);
        sfx("empty");
      }
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
        this.ripple(clickTarget.x + this.cameraX, clickTarget.y, 16);
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
          const b = this.buttPos();
          this.fartBurst(b.x, b.y, -this.weakDirX, -this.weakDirY, depleted ? 2 : 5, 120, 4, 8);
          this.squashX = 0.85;
          this.squashY = 1.15;
          sfx(depleted ? "attackWeak" : "hop");
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
        this.ripple(jumpTarget.x + this.cameraX, jumpTarget.y, 26);
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
          const b = this.buttPos();
          if (depleted) {
            this.fartBurst(b.x, b.y, -this.jumpDirX, -this.jumpDirY, 3, 120, 4, 7);
            sfx("attackWeak");
          } else {
            this.fartBurst(b.x, b.y, -this.jumpDirX, -this.jumpDirY, 12, 220, 6, 13);
            this.floatText(b.x, b.y + 4, STRONG_FART_WORDS[Math.floor(Math.random() * STRONG_FART_WORDS.length)], "#5f8f2f", 22);
            this.shake = Math.max(this.shake, 3);
            sfx("jump");
          }
          this.squashX = 0.7;
          this.squashY = 1.3;
        } else {
          this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
        }
      }

      if (p.onGround) {
        // Only slow it once grounded and nothing fired this frame —
        // otherwise this would cancel an in-flight launch's horizontal
        // component the instant it starts.
        const slow = GROUND_FRICTION * dt;
        p.vx = Math.abs(p.vx) <= slow ? 0 : p.vx - Math.sign(p.vx) * slow;
        this.launchTier = null;
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.attackFlash > 0) {
      this.attackFlash = Math.max(0, this.attackFlash - dt);
    }
    const attackDir = consumeAttack(p.x + p.w / 2 - this.cameraX);
    if (attackDir !== null && this.attackCooldown <= 0) {
      this.performAttack(depleted, attackDir);
    }

    if (p.onGround) {
      this.airTime = 0;
    } else {
      this.airTime += dt;
    }
    if (this.powerupFlash > 0) {
      this.powerupFlash = Math.max(0, this.powerupFlash - dt);
    }
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

    this.moveAndCollide(dt, poweredFly);

    if (this.invuln <= 0) {
      for (const hazard of this.level.hazards) {
        if (intersects(p, hazard)) {
          this.handleContactDamage(hazard.x + hazard.w / 2);
          break;
        }
      }
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
      if (this.status === "playing" && this.invuln <= 0 && intersects(p, enemy)) {
        this.handleContactDamage(enemy.x + enemy.w / 2);
      }
    }
    for (const d of this.deadEnemies) d.t += dt;
    this.deadEnemies = this.deadEnemies.filter((d) => d.t < 0.3);

    this.collectPickups(dt);

    if (this.status === "playing" && intersects(p, this.level.goal)) {
      this.beginWin();
    }

    if (this.status === "playing" && p.y > this.level.heightPx + 80) {
      this.die(true);
    }

    this.updateIdle(dt);
    this.updateSquash(dt);

    const lead = p.facing * CAM_LOOKAHEAD;
    this.camLead += (lead - this.camLead) * Math.min(1, dt * 2.5);
    const camTarget = this.clampCamera(p.x + p.w / 2 - VIEW_W / 2 + this.camLead);
    this.cameraX += (camTarget - this.cameraX) * Math.min(1, dt * 7);

    setFlying(this.isHoldFlying && this.status === "playing", this.fartingPower < FARTING_LOW);
  }

  // Floating platforms (and the ground) are one-way: you can rise up
  // through them from below or the side, and only land on them from
  // above. Landing is checked against last frame's feet position, so a
  // fast fall can't tunnel through a thin platform between frames.
  private moveAndCollide(dt: number, poweredFly: boolean): void {
    const p = this.player;
    const prevBottom = p.y + p.h;
    const impactVy = p.vy;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 0 || p.x > this.level.widthPx - p.w) {
      p.x = Math.max(0, Math.min(p.x, this.level.widthPx - p.w));
      p.vx = 0;
    }
    if (poweredFly || this.isHoldFlying) {
      p.y = Math.max(FLY_MIN_Y, p.y);
    }

    p.onGround = false;
    if (p.vy >= 0) {
      let landY = Infinity;
      for (const platform of this.level.platforms) {
        const overlapsX = p.x + p.w > platform.x && p.x < platform.x + platform.w;
        if (!overlapsX) continue;
        if (prevBottom <= platform.y + 0.5 && p.y + p.h >= platform.y) {
          landY = Math.min(landY, platform.y);
        }
      }
      if (landY !== Infinity) {
        p.y = landY - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }

    if (p.onGround && !this.groundedLastFrame) this.onLand(impactVy);
    this.groundedLastFrame = p.onGround;
  }

  private onLand(impactVy: number): void {
    const p = this.player;
    if (impactVy < 150) return;
    const k = Math.min(1, impactVy / 900);
    this.squashX = 1 + 0.35 * k;
    this.squashY = 1 - 0.3 * k;
    const n = Math.round(3 + 6 * k);
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.spawn({
        kind: "dust",
        x: p.x + p.w / 2 + side * rand(4, 14),
        y: p.y + p.h - 2,
        vx: side * rand(40, 140) * k,
        vy: -rand(10, 60),
        life: rand(0.3, 0.5),
        size: rand(3, 6),
        color: "#c8bfa6",
        gravity: 60,
        drag: 4,
      });
    }
    if (impactVy > 900) this.shake = Math.max(this.shake, 3);
    sfx("land", 0.4 + 0.6 * k);
  }

  private collectPickups(dt: number): void {
    const p = this.player;
    for (const powerUp of this.level.powerUps) {
      if (powerUp.collected || !intersects(p, powerUp)) continue;
      powerUp.collected = true;
      this.powerupFlash = POWERUP_FLASH_SEC;
      const cx = powerUp.x + powerUp.w / 2;
      const cy = powerUp.y + powerUp.h / 2;
      this.burst("spark", cx, cy, 14, 220, pickupColor(powerUp.kind));
      this.ripple(cx, cy, 30, pickupColor(powerUp.kind));
      this.floatText(cx, cy - 28, pickupLabel(powerUp.kind), pickupColor(powerUp.kind), 24);
      if (powerUp.kind === "beansoup") {
        this.fartingPower = FARTING_MAX;
        sfx("beansoup");
      } else {
        this.activePowers.set(powerUp.kind, {
          kind: powerUp.kind,
          remainingSec: POWER_DURATIONS[powerUp.kind],
        });
        sfx("pickup");
      }
    }

    this.beanComboTimer = Math.max(0, this.beanComboTimer - dt);
    if (this.beanComboTimer <= 0) this.beanCombo = 0;
    // Beans get a slightly generous pickup box — they're small.
    const grab: Rect = { x: p.x - 6, y: p.y - 6, w: p.w + 12, h: p.h + 12 };
    for (const bean of this.level.beans) {
      if (bean.collected || !intersects(grab, bean)) continue;
      bean.collected = true;
      this.beansCollected++;
      this.fartingPower = Math.min(FARTING_MAX, this.fartingPower + BEAN_FARTING);
      this.beanCombo++;
      this.beanComboTimer = BEAN_COMBO_SEC;
      this.burst("spark", bean.x + bean.w / 2, bean.y + bean.h / 2, 5, 120, "#b5552a");
      sfx("bean", 1, 1 + Math.min(this.beanCombo - 1, 8) * 0.07);
    }

    this.level.checkpoints.forEach((cp, i) => {
      if (cp.reached || !intersects(p, cp)) return;
      cp.reached = true;
      this.respawnPoint = { x: cp.x, y: cp.y + cp.h - p.h };
      this.floatText(cp.x + 10, cp.y - 24, "CHECKPOINT!", "#4b8a2e", 24);
      this.burst("spark", cp.x + 10, cp.y + 10, 12, 180, "#7cc35a");
      this.checkpointRaise[i] = 0.01;
      sfx("checkpoint");
    });
    this.checkpointRaise = this.checkpointRaise.map((r) => (r > 0 ? Math.min(1, r + dt * 2.5) : 0));
  }

  private updateIdle(dt: number): void {
    const p = this.player;
    const idle = p.onGround && p.vx === 0 && !this.isHoldFlying && this.attackFlash <= 0;
    if (!idle) {
      this.idleTimer = 0;
      return;
    }
    this.idleTimer += dt;
    if (this.idleTimer >= this.idleNext) {
      this.idleTimer = 0;
      this.idleNext = rand(3.5, 7);
      const b = this.buttPos();
      this.fartBurst(b.x, b.y, -p.facing, -0.3, 3, 50, 3, 6);
      if (Math.random() < 0.4) this.floatText(b.x - p.facing * 10, b.y - 6, "pff", "#7a7a86", 16);
      sfx("idle");
    }
  }

  private updateSquash(dt: number): void {
    const k = 1 - Math.exp(-dt * 14);
    this.squashX += (1 - this.squashX) * k;
    this.squashY += (1 - this.squashY) * k;
  }

  private center(): { x: number; y: number } {
    const p = this.player;
    return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  }

  private handleContactDamage(sourceX: number): void {
    const p = this.player;
    if (this.hasPower("shield")) {
      this.activePowers.delete("shield");
      this.invuln = INVULN_SEC;
      const away = p.x + p.w / 2 >= sourceX ? 1 : -1;
      p.vx = away * 260;
      p.vy = -460;
      p.onGround = false;
      this.launchTier = "strong";
      this.hitStop = 0.08;
      this.shake = Math.max(this.shake, 6);
      const c = this.center();
      this.burst("spark", c.x, c.y, 16, 260, pickupColor("shield"));
      this.ripple(c.x, c.y, 40, pickupColor("shield"));
      this.floatText(c.x, p.y - 20, "SHIELD SAVED YOU!", pickupColor("shield"), 22);
      sfx("shield");
      return;
    }
    this.die(false);
  }

  private performAttack(depleted: boolean, dir: 1 | -1): void {
    const p = this.player;
    this.attackCooldown = ATTACK_COOLDOWN_SEC;
    this.attackFlash = ATTACK_FLASH_SEC;
    this.fartingPower = Math.max(0, this.fartingPower - FARTING_ATTACK_COST);
    p.facing = dir;

    const range = ATTACK_RANGE * (depleted ? DEPLETED_ATTACK_RANGE_MULT : 1);
    const hitbox: Rect =
      dir === 1
        ? { x: p.x + p.w, y: p.y, w: range, h: p.h }
        : { x: p.x - range, y: p.y, w: range, h: p.h };

    // The attack sprite's cloud is on the side it's attacking toward.
    const ox = p.x + p.w / 2 + dir * 14;
    const oy = p.y + p.h - 18;
    if (depleted) {
      this.fartBurst(ox, oy, dir, 0, 4, 90, 3, 6);
      this.floatText(ox + dir * 20, oy - 20, "pfff…", "#7a7a86", 18);
      sfx("attackWeak");
    } else {
      for (let i = 0; i < 16; i++) {
        this.spawn({
          kind: "puff",
          x: ox,
          y: oy + rand(-6, 6),
          vx: dir * rand(140, 420),
          vy: rand(-70, 50),
          life: rand(0.45, 0.85),
          size: rand(6, 13),
          color: "#b9d77f",
          gravity: -30,
          drag: 4.5,
        });
      }
      this.floatText(ox + dir * 40, oy - 30, "PFFFFT!", "#5f8f2f", 26);
      this.shake = Math.max(this.shake, 4);
      sfx("attack");
    }

    for (const enemy of this.level.enemies) {
      if (enemy.alive && intersects(hitbox, enemy)) {
        enemy.alive = false;
        this.enemiesFarted++;
        this.deadEnemies.push({ enemy, t: 0 });
        const ex = enemy.x + enemy.w / 2;
        const ey = enemy.y + enemy.h / 2;
        this.fartBurst(ex, ey, 0, -1, 10, 200, 6, 12, "#e8e2d0");
        this.burst("spark", ex, ey, 10, 240, "#e86a7d");
        this.floatText(ex, ey - 30, "POP!", "#c62f2f", 28);
        this.hitStop = 0.07;
        this.shake = Math.max(this.shake, 6);
        sfx("enemy");
      }
    }
  }

  private die(fell: boolean): void {
    const p = this.player;
    this.lives -= 1;
    this.deaths += 1;
    this.dyingFromFall = fell;
    this.activePowers.clear();
    this.hitStop = fell ? 0 : 0.12;
    this.shake = Math.max(this.shake, fell ? 4 : 9);
    if (!fell) {
      // Classic death hop: pop up, then tumble off the bottom of the screen.
      p.vy = -620;
      p.vx = -p.facing * 120;
      const c = this.center();
      this.fartBurst(c.x, c.y, 0, -1, 12, 220, 6, 12, "#e8e2d0");
      this.floatText(c.x, p.y - 20, "OUCH!", "#c62f2f", 28);
    }
    sfx("death");
    this.setStatus("dying");
  }

  private updateDying(dt: number): void {
    const p = this.player;
    if (!this.dyingFromFall) {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (this.stateTime < DYING_SEC) return;

    if (this.lives <= 0) {
      this.setStatus("gameover");
      return;
    }
    // Timed power-ups come back so a section that needed one stays
    // beatable; beans, enemies and checkpoints keep their progress.
    for (const pu of this.level.powerUps) pu.collected = false;
    this.fartingPower = FARTING_MAX;
    this.spawnPlayer();
    this.invuln = INVULN_SEC;
    this.groundedLastFrame = false;
    const c = this.center();
    this.burst("spark", c.x, c.y, 12, 160, "#f2b705");
    this.setStatus("playing");
  }

  private beginWin(): void {
    const g = this.level.goal;
    const p = this.player;
    p.vx = 0;
    p.vy = 0;
    p.x = g.x + g.w * 0.3 - p.w / 2;
    p.y = g.y + g.h * 0.48 - p.h;
    p.facing = 1;
    this.isHoldFlying = false;
    if (this.bestTime === null || this.runTime < this.bestTime) {
      this.bestTime = this.runTime;
      this.newBest = true;
      try {
        localStorage.setItem(BEST_TIME_KEY, String(this.runTime));
      } catch {
        // not saved, still shown this session
      }
    }
    sfx("win");
    this.setStatus("winning");
  }

  private updateWinning(dt: number): void {
    const b = { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h - 6 };
    if (this.stateTime < 0.9 && Math.random() < dt * 40) {
      this.fartBurst(b.x - 8, b.y, -1, 0.2, 2, 160, 7, 14);
    }
    if (this.stateTime > 0.9 && this.stateTime - dt <= 0.9) {
      this.floatText(b.x, b.y - 70, "FLUSH!", "#3b8fc4", 34);
      this.burst("spark", b.x, b.y - 20, 18, 260, "#9fd3f0");
    }
    this.updateSquash(dt);
    if (this.stateTime >= WIN_SEC) this.setStatus("won");
  }

  // --- particles -------------------------------------------------------------

  private spawn(p: Omit<Particle, "max" | "seed">): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ ...p, max: p.life, seed: this.particleSeed++ });
  }

  // A cloud of fart puffs heading roughly along (dirX, dirY).
  private fartBurst(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    count: number,
    speed: number,
    minSize: number,
    maxSize: number,
    color = "#cfe6a6",
  ): void {
    const len = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / len;
    const uy = dirY / len;
    for (let i = 0; i < count; i++) {
      const spread = rand(-0.6, 0.6);
      const sp = speed * rand(0.3, 1);
      const vx = (ux * Math.cos(spread) - uy * Math.sin(spread)) * sp;
      const vy = (ux * Math.sin(spread) + uy * Math.cos(spread)) * sp;
      this.spawn({
        kind: "puff",
        x: x + rand(-4, 4),
        y: y + rand(-4, 4),
        vx,
        vy,
        life: rand(0.4, 0.8),
        size: rand(minSize, maxSize),
        color,
        gravity: -25,
        drag: 3.5,
      });
    }
  }

  private emitFlightJet(dt: number): void {
    const sputter = this.fartingPower < FARTING_LOW;
    this.flyEmitAcc += dt * 40;
    while (this.flyEmitAcc >= 1) {
      this.flyEmitAcc -= 1;
      if (sputter && Math.random() < 0.55) continue;
      const b = this.buttPos();
      this.spawn({
        kind: "puff",
        x: b.x + rand(-5, 5),
        y: b.y,
        vx: -this.player.vx * 0.25 + rand(-35, 35),
        vy: rand(120, 220),
        life: rand(0.35, 0.65),
        size: sputter ? rand(3, 6) : rand(5, 9),
        color: sputter ? "#d6d0bc" : "#cfe6a6",
        gravity: -40,
        drag: 3,
      });
    }
  }

  private burst(kind: ParticleKind, x: number, y: number, count: number, speed: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = speed * rand(0.4, 1);
      this.spawn({
        kind,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.35, 0.7),
        size: rand(3, 6),
        color,
        gravity: 300,
        drag: 2,
      });
    }
  }

  private ripple(x: number, y: number, size: number, color = INK): void {
    this.spawn({ kind: "ring", x, y, vx: 0, vy: 0, life: 0.35, size, color, gravity: 0, drag: 0 });
  }

  private floatText(x: number, y: number, text: string, color: string, size: number): void {
    this.spawn({
      kind: "text",
      x,
      y,
      vx: 0,
      vy: -45,
      life: 1.0,
      size,
      color,
      gravity: 0,
      drag: 1.5,
      text,
    });
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      pt.life -= dt;
      const d = Math.exp(-pt.drag * dt);
      pt.vx *= d;
      pt.vy = pt.vy * d + pt.gravity * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  // --- UI buttons --------------------------------------------------------------

  private registerButtons(): void {
    const size = 46;
    const y = 8;
    const buttons: (UiButton & { icon: ButtonIcon })[] = [];
    let x = VIEW_W - size - 8;
    if (this.canFullscreen) {
      buttons.push({
        id: "fullscreen",
        icon: "fullscreen",
        x,
        y,
        w: size,
        h: size,
        onPress: () => {
          sfx("ui");
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen().catch(() => {});
        },
      });
      x -= size + 8;
    }
    buttons.push({
      id: "mute",
      icon: isMuted() ? "muted" : "sound",
      x,
      y,
      w: size,
      h: size,
      onPress: () => {
        toggleMute();
        sfx("ui");
      },
    });
    x -= size + 8;
    if (this.status === "playing" || this.status === "paused") {
      buttons.push({
        id: "pause",
        icon: this.status === "paused" ? "play" : "pause",
        x,
        y,
        w: size,
        h: size,
        onPress: () => {
          sfx("ui");
          if (this.status === "playing") this.setStatus("paused");
          else if (this.status === "paused") this.setStatus("playing");
        },
      });
    }
    this.buttons = buttons;
    setUiButtons(buttons);
  }

  private buttons: (UiButton & { icon: ButtonIcon })[] = [];

  // --- rendering -----------------------------------------------------------------

  private render(): void {
    const { ctx, canvas, level } = this;
    const scale = canvas.width / VIEW_W;
    const sx = this.shake > 0 ? rand(-1, 1) * this.shake : 0;
    const sy = this.shake > 0 ? rand(-1, 1) * this.shake : 0;
    ctx.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const cameraX = this.status === "title" ? 0 : this.cameraX;
    drawPaper(ctx, cameraX, level.widthPx);

    ctx.save();
    ctx.translate(-cameraX, 0);

    for (const hint of level.hints) {
      if (hint.x > cameraX + VIEW_W || hint.x + 400 < cameraX) continue;
      const text = !this.isTouch && hint.mouseText ? hint.mouseText : hint.text;
      ctx.globalAlpha = 0.7;
      handText(ctx, text, hint.x, hint.y, 22, "#4a4a5c", { align: "left", angle: -0.03 });
      ctx.globalAlpha = 1;
    }

    level.platforms.forEach((platform, i) => {
      if (platform.x > cameraX + VIEW_W || platform.x + platform.w < cameraX) return;
      drawPlatform(ctx, platform, i * 17 + 3, i === 0);
    });
    level.hazards.forEach((hazard, i) => drawSpikes(ctx, hazard, 300 + i * 13));
    level.checkpoints.forEach((cp, i) =>
      drawCheckpoint(ctx, cp, this.elapsed, cp.reached ? easeOutBack(this.checkpointRaise[i]) : 0),
    );

    for (const bean of level.beans) {
      if (bean.collected) continue;
      const bob = Math.sin(this.elapsed * 3 + bean.x * 0.1) * 2;
      drawBean(ctx, bean.x + bean.w / 2, bean.y + bean.h / 2 + bob, bean.w * 0.45, Math.sin(this.elapsed * 2 + bean.x) * 0.3);
    }

    level.powerUps.forEach((powerUp, i) => {
      if (powerUp.collected) return;
      const pcx = powerUp.x + powerUp.w / 2;
      const pcy = powerUp.y + powerUp.h / 2 + Math.sin(this.elapsed * 2.5 + i) * 4;
      // A dashed "glow" ring slowly turning around each pickup.
      ctx.save();
      ctx.strokeStyle = pickupColor(powerUp.kind);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.lineDashOffset = -this.elapsed * 12;
      ctx.beginPath();
      ctx.arc(pcx, pcy, powerUp.w * 0.78 + Math.sin(this.elapsed * 4 + i) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawPickupIcon(ctx, powerUp.kind, pcx, pcy, powerUp.w / 2, 400 + i * 7);
    });

    const pc = this.player ? this.center() : { x: 0, y: 0 };
    level.enemies.forEach((enemy, i) => {
      if (enemy.alive) drawEnemy(ctx, enemy, this.elapsed, pc.x, pc.y, 700 + i * 11);
    });
    for (const d of this.deadEnemies) {
      ctx.globalAlpha = 1 - d.t / 0.3;
      drawEnemy(ctx, d.enemy, this.elapsed, pc.x, pc.y, 700, Math.min(1, d.t / 0.15));
      ctx.globalAlpha = 1;
    }

    drawToilet(ctx, level.goal, this.elapsed, this.status === "winning" && this.stateTime > 0.9 ? 1 : 0);

    this.renderParticles(["puff", "dust"]);
    if (this.status !== "title") this.renderPlayer();
    this.renderParticles(["spark", "ring", "text"]);

    ctx.restore();

    this.renderPressIndicator();
    if (this.status !== "title") this.renderHud();

    switch (this.status) {
      case "title":
        this.renderTitle();
        break;
      case "paused":
        this.renderCard("Paused", ["Tap anywhere to keep going"], 0);
        break;
      case "won":
        this.renderWinCard();
        break;
      case "gameover":
        this.renderCard("Out of gas!", ["You ran out of lives.", "", this.isTouch ? "Tap to try again" : "Click to try again"], 0.02);
        break;
    }

    for (const b of this.buttons) drawButton(ctx, b, b.icon, b.x);
  }

  private renderParticles(kinds: ParticleKind[]): void {
    const ctx = this.ctx;
    for (const pt of this.particles) {
      if (!kinds.includes(pt.kind)) continue;
      const age = 1 - pt.life / pt.max; // 0 -> 1
      ctx.save();
      switch (pt.kind) {
        case "puff": {
          const r = pt.size * (0.6 + age * 1.1);
          ctx.globalAlpha = Math.min(1, (1 - age) * 1.4) * 0.85;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.1;
          sketchCircle(ctx, pt.x, pt.y, r, pt.seed, 0.15, pt.color);
          break;
        }
        case "dust": {
          ctx.globalAlpha = 1 - age;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * (1 - age * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "spark": {
          ctx.globalAlpha = 1 - age;
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          const s = pt.size * (1 - age * 0.6);
          ctx.beginPath();
          ctx.moveTo(pt.x - s, pt.y);
          ctx.lineTo(pt.x + s, pt.y);
          ctx.moveTo(pt.x, pt.y - s);
          ctx.lineTo(pt.x, pt.y + s);
          ctx.stroke();
          break;
        }
        case "ring": {
          ctx.globalAlpha = (1 - age) * 0.7;
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 2;
          sketchCircle(ctx, pt.x, pt.y, pt.size * (0.4 + age), pt.seed, 0.06);
          break;
        }
        case "text": {
          const pop = Math.min(1, age * 8);
          const size = pt.size * (0.6 + 0.4 * easeOutBack(pop));
          ctx.globalAlpha = age > 0.7 ? (1 - age) / 0.3 : 1;
          handText(ctx, pt.text ?? "", pt.x, pt.y, size, pt.color, {
            font: MARKER_FONT,
            outline: "#fbf7ea",
            angle: ((pt.seed % 7) - 3) * 0.03,
          });
          break;
        }
      }
      ctx.restore();
    }
  }

  private currentSpriteName(): SpriteName {
    if (this.status === "dying") return "jump4";
    if (this.status === "winning" || this.status === "won") return "powerup";
    if (this.attackFlash > 0) return "attack";
    if (this.powerupFlash > 0) return "powerup";
    if (this.isHoldFlying) return "flying";
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
    // Skidding to a stop after a landing.
    if (Math.abs(this.player.vx) > 40) {
      return Math.floor(this.elapsed / 0.08) % 2 === 0 ? "run1" : "run2";
    }
    return "standing";
  }

  private renderPlayer(): void {
    const { ctx, player: p } = this;
    if (this.status === "dying" && this.dyingFromFall) return;
    // Blink while invulnerable.
    if (this.invuln > 0 && Math.floor(this.invuln / 0.08) % 2 === 0) return;

    const cx = p.x + p.w / 2;
    const bottom = p.y + p.h;

    const shield = this.activePowers.get("shield");
    if (shield && !(shield.remainingSec < POWER_WARN_SEC && Math.floor(this.elapsed * 8) % 2 === 0)) {
      ctx.save();
      ctx.strokeStyle = pickupColor("shield");
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      sketchCircle(ctx, cx, p.y + p.h / 2 - 8, 46 + Math.sin(this.elapsed * 5) * 2, 900, 0.05, "rgba(22, 181, 207, 0.15)");
      ctx.restore();
    }

    const flyPower = this.activePowers.get("fly");
    const showWings =
      (flyPower && !(flyPower.remainingSec < POWER_WARN_SEC && Math.floor(this.elapsed * 8) % 2 === 0)) ||
      this.isHoldFlying;
    if (showWings) {
      const flapSpeed = this.isHoldFlying ? 22 : p.onGround ? 3 : 10;
      const flap = Math.sin(this.elapsed * flapSpeed) * 0.5 + 0.2;
      const wingCy = bottom - 50;
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawWing(ctx, cx - 8, wingCy, 22, pickupColor("fly"), false, flap);
      drawWing(ctx, cx + 8, wingCy, 22, pickupColor("fly"), true, flap);
      ctx.restore();
    }

    // Speed lines while the speed power-up is active and moving.
    if (this.hasPower("speed") && Math.abs(p.vx) > 50) {
      ctx.save();
      ctx.strokeStyle = pickupColor("speed");
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      const back = -Math.sign(p.vx);
      for (let i = 0; i < 3; i++) {
        const y = p.y + 8 + i * 13;
        sketchLine(ctx, cx + back * 22, y, cx + back * (40 + i * 6), y, 950 + i, 0.6);
      }
      ctx.restore();
    }

    const name = this.currentSpriteName();
    const img = sprites[name];
    if (!img.complete || img.naturalWidth === 0) return;

    const targetH =
      name === "powerup" ? 112 : name === "attack" || name === "flying" ? 90 : 74;
    const scale = targetH / img.naturalHeight;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    let sqX = this.squashX;
    let sqY = this.squashY;
    if (name === "standing") sqY *= 1 + Math.sin(this.elapsed * 3) * 0.015; // breathing

    let tilt = 0;
    if (name === "hop1" || name === "hop2") tilt = Math.max(-0.3, Math.min(0.3, p.vx / 1100));
    else if (name === "flying") tilt = Math.max(-0.2, Math.min(0.2, p.vx / 1500));

    ctx.save();
    if (this.status === "dying") {
      // Tumble around the sprite's middle.
      ctx.translate(cx, bottom - h / 2);
      ctx.rotate(this.stateTime * 10 * -p.facing);
      ctx.scale(p.facing, 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.translate(cx, bottom);
      ctx.rotate(tilt);
      ctx.scale(sqX * p.facing, sqY);
      ctx.drawImage(img, -w / 2, -h, w, h);
    }
    ctx.restore();
  }

  // Feedback for a press still being decided: a ring that fills over the
  // tap-vs-hold threshold, so holding to fly is discoverable.
  private renderPressIndicator(): void {
    if (this.status !== "playing") return;
    const press = getPressIndicator();
    if (!press) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(press.x, press.y, 20, -Math.PI / 2, -Math.PI / 2 + press.progress * Math.PI * 2);
    ctx.stroke();
    if (press.progress >= 1) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = pickupColor("fly");
      ctx.beginPath();
      ctx.arc(press.x, press.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderHud(): void {
    const ctx = this.ctx;
    // A torn paper strip behind the HUD so it reads over busy scenery.
    ctx.save();
    ctx.fillStyle = "rgba(251, 247, 234, 0.82)";
    ctx.fillRect(6, 8, 560, 46);
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.2;
    sketchRect(ctx, { x: 6, y: 8, w: 560, h: 46 }, 1200, 1);
    ctx.restore();

    for (let i = 0; i < MAX_LIVES; i++) {
      drawHeart(ctx, 30 + i * 30, 32, 11, i < this.lives, 1300 + i);
    }

    // Farting Power meter.
    drawPuffIcon(ctx, 128, 31, 15, 1400);
    const bar: Rect = { x: 150, y: 22, w: 170, h: 20 };
    const pct = this.fartingPower / FARTING_MAX;
    const low = this.fartingPower < FARTING_LOW;
    const blinkOff = low && Math.floor(this.elapsed * 6) % 2 === 0;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
    const fillRect = { x: bar.x, y: bar.y, w: bar.w * pct, h: bar.h };
    ctx.fillStyle = blinkOff ? "#f6c1c1" : pct > 0.5 ? "#9ccc4a" : pct > 0.22 ? "#f2c94c" : "#e5484d";
    ctx.fillRect(fillRect.x, fillRect.y, fillRect.w, fillRect.h);
    hatch(ctx, fillRect, 1500, INK, 6, 0.25);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    sketchRect(ctx, bar, 1501, 1);
    ctx.restore();

    // Beans.
    drawBean(ctx, 348, 31, 8, -0.3);
    handText(ctx, `${this.beansCollected}/${this.level.beans.length}`, 362, 32, 22, INK, { align: "left" });

    // Active power-ups: icon + draining ring, blinking just before expiry.
    let x = 440;
    for (const power of this.activePowers.values()) {
      const frac = power.remainingSec / POWER_DURATIONS[power.kind];
      const warn = power.remainingSec < POWER_WARN_SEC && Math.floor(this.elapsed * 8) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = warn ? 0.35 : 1;
      ctx.strokeStyle = "rgba(38,38,46,0.2)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, 31, 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pickupColor(power.kind);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x, 31, 17, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      drawPickupIcon(ctx, power.kind, x, 31, 10, 1600);
      ctx.restore();
      x += 44;
    }
  }

  // A sheet of paper "taped" over the middle of the screen.
  private drawCardFrame(w: number, h: number, tilt: number): Rect {
    const ctx = this.ctx;
    const r: Rect = { x: (VIEW_W - w) / 2, y: (VIEW_H - h) / 2, w, h };
    ctx.fillStyle = "rgba(38, 38, 46, 0.35)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    ctx.rotate(tilt);
    ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(r.x + 6, r.y + 8, r.w, r.h);
    ctx.fillStyle = "#fffdf5";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    sketchRect(ctx, r, 2000, 1.2);
    // Tape
    ctx.fillStyle = "rgba(240, 220, 140, 0.75)";
    for (const tx of [r.x + 30, r.x + r.w - 100]) {
      ctx.save();
      ctx.translate(tx + 35, r.y);
      ctx.rotate(tx < VIEW_W / 2 ? -0.12 : 0.1);
      ctx.fillRect(-35, -10, 70, 20);
      ctx.restore();
    }
    return r;
  }

  private renderCard(title: string, lines: string[], tilt: number): void {
    const ctx = this.ctx;
    ctx.save();
    const r = this.drawCardFrame(460, 70 + lines.length * 32 + 50, tilt);
    handText(ctx, title, VIEW_W / 2, r.y + 52, 44, INK, { font: MARKER_FONT });
    lines.forEach((line, i) => handText(ctx, line, VIEW_W / 2, r.y + 110 + i * 32, 26));
    ctx.restore();
  }

  private renderWinCard(): void {
    const ctx = this.ctx;
    ctx.save();
    const r = this.drawCardFrame(480, 330, -0.015);
    handText(ctx, "Flushed it!", VIEW_W / 2, r.y + 52, 46, "#3b8fc4", { font: MARKER_FONT });
    const rows: [string, string][] = [
      ["Time", formatTime(this.runTime)],
      ["Beans", `${this.beansCollected} / ${this.level.beans.length}`],
      ["Enemies farted", String(this.enemiesFarted)],
      ["Lives lost", String(this.deaths)],
    ];
    rows.forEach(([k, v], i) => {
      const y = r.y + 112 + i * 34;
      handText(ctx, k, r.x + 70, y, 26, INK, { align: "left" });
      handText(ctx, v, r.x + r.w - 70, y, 26, INK, { align: "right" });
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      sketchLine(ctx, r.x + 70, y + 16, r.x + r.w - 70, y + 16, 2100 + i, 0.6);
      ctx.globalAlpha = 1;
    });
    const best = this.bestTime !== null ? formatTime(this.bestTime) : "—";
    handText(ctx, this.newBest ? "NEW BEST TIME!" : `Best time: ${best}`, VIEW_W / 2, r.y + 262, 24, this.newBest ? "#c62f2f" : "#4a4a5c", {
      font: this.newBest ? MARKER_FONT : undefined,
      angle: this.newBest ? -0.04 : 0,
    });
    if (Math.floor(this.elapsed * 2) % 2 === 0 || this.stateTime < 0.8) {
      handText(ctx, this.isTouch ? "Tap to play again" : "Click to play again", VIEW_W / 2, r.y + 300, 24);
    }
    ctx.restore();
  }

  private renderTitle(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(251, 247, 234, 0.55)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const wobble = Math.sin(this.elapsed * 2) * 0.02;
    handText(ctx, "PowerPlatformer", VIEW_W / 2, 92, 72, INK, { font: MARKER_FONT, angle: -0.03 + wobble, outline: "#fffdf5" });
    handText(ctx, "a Farting Power adventure", VIEW_W / 2, 146, 28, "#5f8f2f", { angle: -0.02 });

    // Hero standing on the title, with the occasional toot.
    const img = sprites.standing;
    if (img.complete && img.naturalWidth > 0) {
      const h = 120;
      const w = (img.naturalWidth / img.naturalHeight) * h;
      ctx.save();
      ctx.translate(170, 430);
      ctx.scale(1, 1 + Math.sin(this.elapsed * 3) * 0.02);
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();
      drawPuffIcon(ctx, 130 + Math.sin(this.elapsed * 2) * 4, 400 - ((this.elapsed * 20) % 30), 14, 2400);
    }
    drawToilet(ctx, { x: 760, y: 340, w: 70, h: 92 }, this.elapsed);

    // Controls card.
    const card: Rect = { x: 270, y: 186, w: 420, h: 250 };
    ctx.fillStyle = "#fffdf5";
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    sketchRect(ctx, card, 2500, 1.2);
    handText(ctx, "How to play", card.x + card.w / 2, card.y + 28, 30, INK, { font: MARKER_FONT });
    const t = this.isTouch;
    const rows: [string, string][] = [
      [t ? "Tap" : "Click", "little hop toward it"],
      [t ? "Double-tap" : "Double-click", "BIG jump that way"],
      [t ? "Hold" : "Hold button", "fart-fly (burns gas!)"],
      [t ? "Swipe" : "Right-click", "fart attack"],
    ];
    rows.forEach(([k, v], i) => {
      const y = card.y + 72 + i * 34;
      handText(ctx, k, card.x + 150, y, 25, "#3b5bd6", { align: "right" });
      handText(ctx, "→ " + v, card.x + 165, y, 25, INK, { align: "left" });
    });
    handText(ctx, "Eat beans to refuel. Get to the toilet!", card.x + card.w / 2, card.y + 220, 22, "#4a4a5c");

    if (Math.floor(this.elapsed * 2) % 2 === 0) {
      handText(ctx, t ? "Tap anywhere to start" : "Click anywhere to start", VIEW_W / 2, 476, 30, "#c62f2f", { font: MARKER_FONT });
    }
    if (this.bestTime !== null) {
      handText(ctx, `Best time: ${formatTime(this.bestTime)}`, VIEW_W / 2, 516, 22, "#4a4a5c");
    }
    if (t && window.innerHeight > window.innerWidth) {
      handText(ctx, "Tip: turn your phone sideways ⟳", VIEW_W / 2, 170, 22, "#c62f2f");
    }
    ctx.restore();
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
