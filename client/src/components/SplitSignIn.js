// Splits the Sign In button into the username and password boxes.

const SPRING = { k: 55, damping: 11 };
const NECK = 0.34; // spring progress at which the liquid neck tears
const DROPS = [
  { r: 4.5, vx: -18, vy: 20 },
  { r: 3, vx: 24, vy: 60 },
  { r: 2, vx: -5, vy: 110 },
];
const GRAVITY = 900;
const FADE_START = 0.45; // seconds, when the blue gives way to the real boxes
const DURATION = 0.8; // seconds
const ROOM = { side: 24, top: 12, bottom: 90 }; // canvas space around the boxes

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function springAt(t) {
  const decay = SPRING.damping / 2;
  const freq = Math.sqrt(SPRING.k - decay * decay);
  return 1 - Math.exp(-decay * t) * (Math.cos(freq * t) + (decay / freq) * Math.sin(freq * t));
}

// One half as a closed path. side: -1 is left, 1 is right.
function addHalf(ctx, shape, side, g, waist) {
  const { cx, cy, h, radius, startHalfW, endOuter, gap } = shape;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const edge = cx + (side * g * gap) / 2;
  const outer = lerp(cx + side * startHalfW, cx + side * endOuter, g);
  const retract = clamp01((g - NECK) / (1 - NECK));

  // From a pointed, stretched tip at the tear to a normal box corner
  const round = lerp(h / 2, radius, retract);
  const start = edge + side * round;
  const c1x = edge + side * round * lerp(0.3, 0.45, retract);
  const tipX = lerp(cx, edge, retract);
  const tipY = lerp(waist / 2, h / 2 - radius, retract);
  const c2x = tipX;
  const c2y = lerp(waist / 2, h / 2 - radius * 0.45, retract);

  ctx.moveTo(start, top);
  ctx.bezierCurveTo(c1x, top, c2x, cy - c2y, tipX, cy - tipY);
  ctx.lineTo(tipX, cy + tipY);
  ctx.bezierCurveTo(c2x, cy + c2y, c1x, bottom, start, bottom);
  ctx.lineTo(outer - side * radius, bottom);
  ctx.quadraticCurveTo(outer, bottom, outer, bottom - radius);
  ctx.lineTo(outer, top + radius);
  ctx.quadraticCurveTo(outer, top, outer - side * radius, top);
  ctx.closePath();
}

function drawLabel(ctx, shape, style, g) {
  ctx.save();
  ctx.globalAlpha = 1 - clamp01(g / 0.5);
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.beginPath();
    const offset = (side * g * shape.gap) / 2 + side * g * 30;
    const left = side < 0 ? shape.cx - 400 : shape.cx;
    ctx.rect(left + offset, shape.cy - shape.h / 2, 400, shape.h);
    ctx.clip();
    ctx.fillText(style.label, shape.cx + offset, shape.cy);
    ctx.restore();
  }
  ctx.restore();
}

// Returns a function that cancels the animation
export function playSignInSplit(canvas, button, firstBox, secondBox, onDone) {
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    onDone();
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    finish();
    return () => {};
  }

  const parent = canvas.parentElement.getBoundingClientRect();
  const from = button.getBoundingClientRect();
  const a = firstBox.getBoundingClientRect();
  const b = secondBox.getBoundingClientRect();

  const width = parent.width + ROOM.side * 2;
  const height = parent.height + ROOM.top + ROOM.bottom;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.left = `${-ROOM.side}px`;
  canvas.style.top = `${-ROOM.top}px`;
  ctx.scale(dpr, dpr);

  const css = getComputedStyle(button);
  const shape = {
    cx: width / 2,
    cy: ROOM.top + (a.top - parent.top) + a.height / 2,
    h: a.height,
    radius: Math.min(parseFloat(css.borderTopLeftRadius) || 0, a.height / 2),
    startHalfW: from.width / 2,
    endOuter: (b.right - a.left) / 2,
    gap: b.left - a.right,
  };
  const style = {
    label: button.textContent,
    font: `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`,
    color: css.color,
    fill: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  };

  let frame;
  let tearTime = null;
  const startedAt = performance.now();

  function draw(now) {
    const t = (now - startedAt) / 1000;
    const g = springAt(t);
    const waist = Math.max(0, shape.h * (1 - g / NECK));

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1 - clamp01((t - FADE_START) / (DURATION - FADE_START));
    ctx.fillStyle = style.fill;

    ctx.beginPath();
    addHalf(ctx, shape, -1, g, waist);
    addHalf(ctx, shape, 1, g, waist);
    ctx.fill();
    if (waist > 0) ctx.fillRect(shape.cx - 1, shape.cy - waist / 2, 2, waist); // hides the seam

    // Tears when the waist reaches zero
    if (waist <= 0) {
      if (tearTime === null) tearTime = t;
      const age = t - tearTime;
      for (const drop of DROPS) {
        ctx.beginPath();
        ctx.arc(
          shape.cx + drop.vx * age,
          shape.cy + drop.vy * age + (GRAVITY * age * age) / 2,
          drop.r,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    drawLabel(ctx, shape, style, g);

    if (t < DURATION) {
      frame = requestAnimationFrame(draw);
    } else {
      finish();
    }
  }

  draw(startedAt);
  // Browsers pause animation frames in background tabs, so the boxes must still open
  const fallback = setTimeout(finish, (DURATION + 0.3) * 1000);

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(fallback);
  };
}
