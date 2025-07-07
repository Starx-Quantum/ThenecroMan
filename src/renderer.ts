import * as sprites from "./sprites.json";
import { canvas, clear, ctx, drawNineSlice, drawSceneSprite, drawSprite, particleEmitters, Sprite, write } from "./engine";
import { clamp, Point, randomInt } from "./helpers";
import { INTRO, PLAYING, SHOPPING } from "./game";
import { shop } from "./shop";
import { Frozen } from "./behaviours";

const ICON_SOULS = "$";

let screenShakeTimer = 0;

export function screenshake(time: number) {
  screenShakeTimer = time;
}

let sceneOrigin = Point(0, 150);

export function screenToSceneCoords(x: number, y: number): Point {
  let r = canvas.getBoundingClientRect();
  let sx = (x - r.x) * (canvas.width / r.width) | 0;
  let sy = (y - r.y) * (canvas.height / r.height) | 0;
  return { x: sx, y: sceneOrigin.y - sy };
}

export function render(dt: number) {
  clear();
  ctx.save();

  if (screenShakeTimer > 0) {
    screenShakeTimer -= dt;
    ctx.translate(randomInt(2), randomInt(2));
  }

  ctx.translate(sceneOrigin.x, sceneOrigin.y);
  drawBackground();
  drawParticles();
  drawObjects();
  if (game.state === PLAYING) drawReticle();
  ctx.restore();

  drawHud();

  if (game.state === SHOPPING) {
    drawShop();
  }
}

// Add a list of stoic shop quotes
const SHOP_QUOTES = [
  "\"Fate brings both hardship and opportunity.\"",
  "\"Let me choose wisely, unmoved by fortune or loss.\"",
  "\"The obstacle on my path is my path.\"",
  "\"I cannot control what happens, only how I respond.\"",
  "\"To endure is to prevail.\"",
  "\"All things serve to strengthen me.\"",
  "\"Suffering is inevitable, misery is a choice.\"",
  "\"What stands in the way becomes the way.\"",
  "\"Peace comes from acceptance, not victory.\"",
];

function drawShop() {
  // Dynamic stoic quote
  let quote = SHOP_QUOTES[game.shopVisitCount % SHOP_QUOTES.length];
  write(
    `Between battles, Norman reflects:\n${quote}\n`,
    160, 8
  );
  write("Rituals\n\n", 160, 36);
  let selected = shop.items[shop.selectedIndex];
  for (let item of shop.items) {
    write(
      `${item === selected ? ">" : " "}${item.name} $${item.cost}\n`,
    );
  }
  write("\n" + selected?.description + "\n");
}

// Add subtle shadow to HUD text for readability
function writeWithShadow(text: string, x: number, y: number) {
  ctx.save();
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  write(text, x, y);
  ctx.restore();
}

function drawHud() {
  if (game.dialogue.length) {
    writeWithShadow(game.dialogue[0], 75, 50);
  }

  if (game.state === INTRO) return;

  drawSprite(sprites.norman_icon, 0, 0);

  for (let i = 0; i < game.player.maxHp; i++) {
    let sprite = i < game.player.hp ? sprites.health_orb : sprites.health_orb_empty;
    drawSprite(sprite, 11 + i * 4, 0);
  }

  for (let i = 0; i < game.spell.maxCasts; i++) {
    let sprite = i < game.spell.casts ? sprites.cast_orb : sprites.cast_orb_empty;
    drawSprite(sprite, 11 + i * 4, 6);
  }

  let souls = game.souls | 0;
  if (souls) {
    let multiplier = game.getStreakMultiplier();
    let bonus = multiplier ? `(+${multiplier * 100 + "%"})` : "";
    writeWithShadow(`${ICON_SOULS}${souls} ${bonus}`, canvas.width / 2 - 30, 0);
  }

  writeWithShadow(`${game.level+1}-10`, canvas.width - 30, 2);

  if (game.state === PLAYING) {
    let x = 150;
    let y = canvas.height - 12;
    let progress = clamp(game.ability.timer / game.ability.cooldown, 0, 1);
    drawNineSlice(sprites.pink_frame, x, y, 52 * (1 - progress) | 0, 10);
    writeWithShadow("Resurrect", x + 10, y + 2);
    if (progress === 1) writeWithShadow(" (Space)", x + 70, y + 2);
    else writeWithShadow(" (" + (((1 - progress) * game.ability.cooldown) / 1000 | 0) + "s)", x + 70, y + 2);
    drawSprite(sprites.skull, x + 1, y + 1);
  }

  // Developer credit
  writeWithShadow("Developed by Aman", canvas.width - 120, canvas.height - 18);
}

function drawOrbs(
  x: number,
  y: number,
  value: number,
  maxValue: number,
  sprite: Sprite,
  emptySprite: Sprite,
) {
  let x0 = x - (maxValue * 4) / 2;
  for (let i = 0; i < maxValue; i++) {
    drawSceneSprite(i < value ? sprite : emptySprite, x0 + i * 4, y);
  }
}

function drawObjects() {
  for (let object of game.objects) {
    drawSceneSprite(object.sprite, object.x, object.y + object.hop);

    if (object.getBehaviour(Frozen)) {
      drawNineSlice(sprites.ice, object.x, -object.sprite[3], object.sprite[2], object.sprite[3]);
    }

    if (object.maxHp > 1 && object !== game.player) {
      if (object.maxHp < 10) {
        let { x } = object.center();
        drawOrbs(x, -6, object.hp, object.maxHp, sprites.health_orb, sprites.health_orb_empty);
      } else {
        drawSceneSprite(sprites.health_orb, object.x, -6);
        write(`${object.hp}/${object.maxHp}`, object.x + 6, 0);
      }
    }

    let { x } = object;
    for (let behaviour of object.behaviours) {
      if (behaviour.sprite) {
        drawSceneSprite(behaviour.sprite, x, -12);
        x += behaviour.sprite[2] + 1;
      }
    }
  }
}

let cloudOffset = 0;
const CLOUD_SPEED = 0.03;
const CLOUD_SPRITES = [
  sprites.cloud_1,
  sprites.cloud_2,
  sprites.cloud_3,
];

function drawBackground() {
  // Draw clouds first
  drawClouds();
  for (let i = 0; i < game.stage.width / 16; i++) {
    let sprite = i % 5 ? sprites.wall : sprites.door;
    drawSceneSprite(sprite, i * 16, 0);
    drawSceneSprite(sprites.floor, i * 16, -sprites.floor[3]);
    drawSceneSprite(sprites.ceiling, i * 16, game.stage.ceiling);
  }
}

// Add this function for clouds
function drawClouds() {
  cloudOffset += CLOUD_SPEED;
  let width = game.stage.width;
  let y = -sprites.floor[3] - 12;
  for (let i = 0; i < 4; i++) {
    let sprite = CLOUD_SPRITES[i % CLOUD_SPRITES.length];
    // Only draw if sprite is defined and has at least 4 elements
    if (sprite && sprite.length >= 4) {
      let x = ((i * 80 + cloudOffset * (20 + i * 10)) % (width + 60)) - 30;
      drawSceneSprite(sprite, x, y - (i % 2) * 6);
    }
  }
}

function drawReticle() {
  let { x, y } = game.getCastingPoint();
  let sprite = sprites.reticle;
  drawSceneSprite(sprite, x - sprite[2] / 2, y - sprite[3] / 2);
}

function drawParticles() {
  for (let emitter of particleEmitters) {
    for (let particle of emitter.particles) {
      let variant = emitter.variants[particle.variant];
      let progress = particle.elapsed / particle.duration;
      let sprite = variant[progress * variant.length | 0];
      drawSceneSprite(sprite, particle.x, particle.y);
    }
  }
}
