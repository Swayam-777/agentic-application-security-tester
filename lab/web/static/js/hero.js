import { reduced } from "./fx.js";

// Drifting network with a radar sweep; red "attack" packets fly at the shield and are absorbed.
export function startHero(canvas) {
  const ctx = canvas.getContext("2d");
  let W, H, nodes = [], packets = [], t = 0, mouse = { x: -999, y: -999 }, raf;
  const dpr = Math.min(2, devicePixelRatio || 1);

  function size() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes = Array.from({ length: Math.max(24, Math.floor(W / 28)) }, () => ({
      x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 }));
  }
  const shield = () => ({ x: W * 0.8, y: H * 0.5, r: Math.min(H * 0.28, 80) });

  function spawn() {
    const s = shield(), a = Math.random() * Math.PI * 2, d = Math.max(W, H) * .6;
    packets.push({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, life: 0 });
  }

  function frame() {
    t += 0.016;
    if (W < 40 || H < 40) { raf = requestAnimationFrame(frame); return; }
    ctx.clearRect(0, 0, W, H);
    const s = shield();
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) { ctx.strokeStyle = `rgba(56,189,248,${(1 - d / 110) * .22})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      ctx.fillStyle = dm < 120 ? "#7dd3fc" : "rgba(125,170,255,.55)";
      ctx.beginPath(); ctx.arc(a.x, a.y, dm < 120 ? 3.4 : 2, 0, 7); ctx.fill();
    }
    // radar sweep
    const ang = t * 1.2;
    const g = ctx.createConicGradient ? ctx.createConicGradient(ang, s.x, s.y) : null;
    if (g) { g.addColorStop(0, "rgba(56,189,248,.35)"); g.addColorStop(.18, "rgba(56,189,248,0)"); g.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.2, 0, 7); ctx.fill(); }
    for (let k = 1; k <= 3; k++) {
      ctx.strokeStyle = `rgba(56,189,248,${.32 / k})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (.7 + k * .55) + Math.sin(t * 2 + k) * 3, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = "rgba(56,189,248,.15)"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * .62, 0, 7); ctx.fill();
    ctx.fillStyle = "#38bdf8"; ctx.beginPath();
    const u = s.r * .42;
    ctx.moveTo(s.x, s.y - u); ctx.lineTo(s.x + u * .85, s.y - u * .55); ctx.lineTo(s.x + u * .85, s.y + u * .1);
    ctx.quadraticCurveTo(s.x + u * .6, s.y + u * .85, s.x, s.y + u); ctx.quadraticCurveTo(s.x - u * .6, s.y + u * .85, s.x - u * .85, s.y + u * .1);
    ctx.lineTo(s.x - u * .85, s.y - u * .55); ctx.closePath(); ctx.fill();
    // attack packets
    if (Math.random() < .035) spawn();
    packets = packets.filter((p) => {
      const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy);
      p.x += dx / d * 3.2; p.y += dy / d * 3.2; p.life++;
      ctx.fillStyle = "#fb5a6b"; ctx.shadowColor = "#fb5a6b"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      if (d < s.r * 1.25) {
        ctx.strokeStyle = "rgba(251,90,107,.7)"; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + Math.random() * 6, 0, 7); ctx.stroke();
        return false;
      }
      return true;
    });
    raf = requestAnimationFrame(frame);
  }
  canvas.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
  canvas.addEventListener("pointerleave", () => { mouse = { x: -999, y: -999 }; });
  new ResizeObserver(size).observe(canvas);
  size();
  if (reduced) { frame(); cancelAnimationFrame(raf); } else raf = requestAnimationFrame(frame);
  // the canvas sits behind text; let pointer events through the copy but keep hover on the card
  canvas.parentElement.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
}
