// hud.js — the lit instruments: big altitude / airspeed numbers, a heading
// compass strip, a drawn artificial horizon, throttle and fuel bars, score,
// rings and the countdown. Also owns the title / pause / game-over screens
// and the ring-pass banner, so main.js never touches the DOM directly.
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const horizon = $('horizon');
  const hctx = horizon.getContext('2d');
  let bannerTimer = null;

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function compassLabel(deg) {
    const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return pts[Math.round(deg / 45) % 8];
  }

  function drawHorizon(pitch, roll) {
    const w = horizon.width, h = horizon.height;
    const cx = w / 2, cy = h / 2, r = w / 2 - 4;
    hctx.clearRect(0, 0, w, h);
    hctx.save();
    hctx.beginPath();
    hctx.arc(cx, cy, r, 0, Math.PI * 2);
    hctx.clip();
    hctx.translate(cx, cy);
    hctx.rotate(-roll);
    const dy = pitch * 46;
    hctx.fillStyle = '#2f7fd0';
    hctx.fillRect(-r, -r - dy, r * 2, r + dy);
    hctx.fillStyle = '#8a6b46';
    hctx.fillRect(-r, -dy, r * 2, r + dy);
    hctx.fillStyle = '#ffffff';
    hctx.fillRect(-r, -dy - 1.5, r * 2, 3);
    hctx.restore();
    // Fixed wings + nose marker, drawn over the moving horizon.
    hctx.strokeStyle = '#ffd23f';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.moveTo(cx - 34, cy); hctx.lineTo(cx - 12, cy);
    hctx.moveTo(cx + 12, cy); hctx.lineTo(cx + 34, cy);
    hctx.moveTo(cx, cy - 4); hctx.lineTo(cx, cy + 4);
    hctx.stroke();
    hctx.strokeStyle = 'rgba(255,255,255,0.85)';
    hctx.lineWidth = 2;
    hctx.beginPath();
    hctx.arc(cx, cy, r, 0, Math.PI * 2);
    hctx.stroke();
  }

  function drawCompass(deg) {
    let ticks = '';
    for (let d = -60; d <= 60; d += 30) {
      const a = ((deg + d) % 360 + 360) % 360;
      const label = d % 45 === 0 ? compassLabel(a) : `${a}°`;
      ticks += `<span style="left:${50 + d * 0.55}%">${label}</span>`;
    }
    $('compass-strip').innerHTML = ticks;
    $('compass-read').textContent = `${String(deg).padStart(3, '0')}° ${compassLabel(deg)}`;
  }

  function update(state, sim, nextRing) {
    $('hud-alt').textContent = `${Math.max(0, Math.round(state.agl ?? 0))} m`;
    $('hud-speed').textContent = `${Math.round(state.speed * 3.6)} km/h`;
    $('hud-score').textContent = String(state.score);
    $('hud-rings').textContent = `${state.ringsPassed}/${CONFIG.ringCount}`;
    $('hud-timer').textContent = fmtTime(state.timeLeft);
    $('hud-timer').classList.toggle('low', state.timeLeft <= 20 && state.phase === 'playing');
    $('hud-fuel-fill').style.width = `${state.fuel}%`;
    $('hud-fuel-pct').textContent = `${Math.round(state.fuel)}%`;
    $('hud-fuel-fill').classList.toggle('low', state.fuel < 25);
    $('hud-throttle-fill').style.width = `${Math.round(state.throttle * 100)}%`;
    $('hud-damage').textContent = '♥'.repeat(CONFIG.hitsToCrash - state.damage) + '♡'.repeat(state.damage);
    $('hud-best').textContent = `BEST ${state.best}`;
    drawHorizon(state.pitch, state.roll);
    drawCompass(sim.headingDeg());
    if (nextRing) {
      const dx = nextRing.x - state.x, dz = nextRing.z - state.z;
      $('hud-next').textContent = `NEXT RING ${state.ringsPassed + 1} · ${Math.round(Math.hypot(dx, dz))} m`;
    } else {
      $('hud-next').textContent = 'COURSE COMPLETE';
    }
  }

  function banner(text, sub, sticky) {
    const b = $('banner');
    $('banner-title').textContent = text;
    $('banner-sub').textContent = sub || '';
    b.classList.add('show');
    clearTimeout(bannerTimer);
    if (!sticky) bannerTimer = setTimeout(() => b.classList.remove('show'), 1400);
  }

  function flashDamage() {
    const f = $('damage-flash');
    f.classList.add('show');
    setTimeout(() => f.classList.remove('show'), 350);
  }

  function showScreen(which, state) {
    $('title-screen').classList.toggle('hidden', which !== 'title');
    $('pause-screen').classList.toggle('hidden', which !== 'pause');
    $('end-screen').classList.toggle('hidden', which !== 'end');
    if (which === 'end') {
      $('end-title').textContent = state.phase === 'crashed' ? 'CRASHED!' : 'SORTIE COMPLETE';
      $('end-score').textContent = String(state.score);
      $('end-rings').textContent = `${state.ringsPassed} / ${CONFIG.ringCount} rings`;
      $('end-best').textContent = `Best score: ${state.best}`;
      $('end-note').textContent = state.phase === 'crashed'
        ? 'Three hits on the canyon walls. The plane is down — fly it again.'
        : 'Time up — the canyon course is still there. Fly it again.';
    }
  }

  return { update, banner, flashDamage, showScreen };
}
