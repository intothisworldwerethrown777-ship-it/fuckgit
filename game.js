"use strict";

const canvas = document.getElementById("court");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("startButton");
const scoreLeft = document.getElementById("scoreLeft");
const scoreRight = document.getElementById("scoreRight");
const statusText = document.getElementById("statusText");

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener("resize", resize); resize();

const keys = {};
addEventListener("keydown", e => { keys[e.key.toLower = e.key.toLowerCase()] = true; if (e.code === "Space") { e.preventDefault(); swing(); } });
addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

const state = {
  running: false, pointCooldown: 0, scores: [0, 0], set: 1,
  player: { x: 0, y: .82, facing: -1, swing: 0, move: 0 },
  cpu: { x: 0, y: .18, facing: 1, swing: 0, move: 0 },
  ball: { x: 0, y: .56, z: 10, vx: 0, vy: 0, vz: 0, spin: 0, trail: [] }
};

function resetBall(server = 0) {
  const p = server ? state.cpu : state.player;
  state.ball.x = p.x; state.ball.y = p.y + (server ? .04 : -.04);
  state.ball.z = 18; state.ball.vx = 0; state.ball.vy = 0; state.ball.vz = 0;
  state.ball.trail.length = 0;
  state.pointCooldown = 45;
  statusText.textContent = "READY";
}

function startMatch() {
  state.running = true; state.scores = [0, 0];
  scoreLeft.textContent = scoreRight.textContent = "0";
  state.player.x = 0; state.player.y = .82;
  state.cpu.x = 0; state.cpu.y = .18;
  resetBall(0);
  startButton.classList.add("hidden");
}
startButton.addEventListener("click", startMatch);

function swing() {
  if (!state.running) return;
  const p = state.player;
  p.swing = 18;
  const b = state.ball;
  const dx = b.x - p.x, dy = b.y - p.y, dist = Math.hypot(dx, dy);
  if (dist < .24 && b.z < 75 && b.z > 3) {
    const aim = (keys.arrowleft ? -1 : 0) + (keys.arrowright ? 1 : 0);
    b.vx = dx * 1.05 + aim * .38;
    b.vy = -.95;
    b.vz = 5.8 + Math.random() * 1.2;
    b.z += 8;
    p.move = 1;
  }
}

document.getElementById("swingButton").addEventListener("pointerdown", e => { e.preventDefault(); swing(); });

const stick = document.getElementById("stick");
let stickVector = { x: 0, y: 0 }, stickActive = false;
function updateStick(e) {
  const r = stick.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let x = (e.clientX - cx) / (r.width * .38), y = (e.clientY - cy) / (r.height * .38);
  const mag = Math.hypot(x,y); if (mag > 1) { x /= mag; y /= mag; }
  stickVector = { x, y };
  stick.querySelector("i").style.transform = `translate(${x*22}px,${y*22}px)`;
}
stick.addEventListener("pointerdown", e => { stickActive=true; stick.setPointerCapture(e.pointerId); updateStick(e); });
stick.addEventListener("pointermove", e => { if (stickActive) updateStick(e); });
stick.addEventListener("pointerup", e => { stickActive=false; stickVector={x:0,y:0}; stick.querySelector("i").style.transform=""; });

function project(x, y, z = 0) {
  const horizon = H * .305;
  const bottom = H * .96;
  const courtHalfTop = W * .205;
  const courtHalfBottom = W * .47;
  const t = y;
  const half = courtHalfTop + (courtHalfBottom - courtHalfTop) * t;
  const sx = W / 2 + x * half;
  const sy = horizon + (bottom - horizon) * (t * t * .72 + t * .28);
  const elevation = z * (1 - t * .25) * Math.min(W/H, 1) * .9;
  return { x: sx, y: sy - elevation, scale: .48 + t * .72 };
}

function update(dt) {
  if (!state.running) return;
  const p = state.player;
  let mx = 0, my = 0;
  if (keys.a) mx -= 1; if (keys.d) mx += 1;
  if (keys.w) my -= 1; if (keys.s) my += 1;
  mx += stickVector.x; my += stickVector.y;
  const mag = Math.hypot(mx,my); if (mag > 1) { mx/=mag; my/=mag; }
  p.x = Math.max(-.55, Math.min(.55, p.x + mx * .0068 * dt));
  p.y = Math.max(.58, Math.min(.94, p.y + my * .0052 * dt));
  p.move = Math.abs(mx)+Math.abs(my);

  const cpu = state.cpu, b = state.ball;
  if (state.pointCooldown > 0) {
    state.pointCooldown -= dt;
    if (state.pointCooldown <= 0) {
      b.vx = (Math.random()-.5)*.18; b.vy = -.78; b.vz = 5.7;
      b.z += 8; statusText.textContent="PLAY";
    }
  } else {
    const targetX = b.y < .55 ? b.x : b.x*.25;
    cpu.x += Math.max(-.0045*dt, Math.min(.0045*dt, targetX-cpu.x));
    cpu.x = Math.max(-.55, Math.min(.55,cpu.x));
    cpu.move = Math.abs(targetX-cpu.x);

    b.trail.unshift({x:b.x,y:b.y,z:b.z}); if (b.trail.length>10)b.trail.pop();
    b.x += b.vx * .0068 * dt;
    b.y += b.vy * .0068 * dt;
    b.z += b.vz * .07 * dt;
    b.vz -= .16 * dt;

    if (b.z < 1) {
      b.z=1; b.vz=Math.abs(b.vz)*.68;
      b.vx*=.94; b.vy*=.94;
      if (b.y > 1.12) scorePoint(1);
      else if (b.y < -.12) scorePoint(0);
    }

    if (b.x > .72 || b.x < -.72) scorePoint(b.x > 0 ? 1 : 0);

    if (cpu.swing <= 0 && b.y < .42 && b.y > .02 && b.z < 65 && Math.hypot(b.x-cpu.x,b.y-cpu.y)<.24) {
      cpu.swing=18;
      b.vx=(b.x-cpu.x)*1.5+(Math.random()-.5)*.38;
      b.vy=.92; b.vz=5.5+Math.random()*1.2;
    }
    if (p.swing <= 0 && b.y > .58 && b.y < 1.02 && b.z < 65 && Math.hypot(b.x-p.x,b.y-p.y)<.24 && b.vy>0) swing();
  }

  p.swing=Math.max(0,p.swing-dt); cpu.swing=Math.max(0,cpu.swing-dt);
}

function scorePoint(winner) {
  if (state.pointCooldown > 0) return;
  state.scores[winner]++;
  scoreLeft.textContent=state.scores[0]; scoreRight.textContent=state.scores[1];
  statusText.textContent=winner ? "CPU POINT" : "YOUR POINT";
  state.pointCooldown=95;
  setTimeout(() => { if (state.running) resetBall(winner); }, 1000);
}

function drawCourt() {
  const sky=ctx.createLinearGradient(0,0,0,H*.38);
  sky.addColorStop(0,"#5c8192"); sky.addColorStop(1,"#b6a99a");
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  ctx.fillStyle="#1c3a32";
  ctx.fillRect(0,H*.27,W,H*.73);
  ctx.fillStyle="#3f4f3b";
  for(let i=0;i<70;i++) {
    const x=(i*173%997)/997*W, y=H*.27+(i*97%997)/997*H*.68;
    ctx.globalAlpha=.12; ctx.fillRect(x,y,2,Math.random()*5+2);
  }
  ctx.globalAlpha=1;

  const backLeft=project(-.82,0), backRight=project(.82,0);
  const nearLeft=project(-1.02,1), nearRight=project(1.02,1);
  ctx.beginPath(); ctx.moveTo(backLeft.x,backLeft.y); ctx.lineTo(backRight.x,backRight.y);
  ctx.lineTo(nearRight.x,nearRight.y); ctx.lineTo(nearLeft.x,nearLeft.y); ctx.closePath();
  ctx.fillStyle="#805d54"; ctx.fill();

  ctx.save(); ctx.beginPath(); ctx.moveTo(backLeft.x,backLeft.y);ctx.lineTo(backRight.x,backRight.y);
  ctx.lineTo(nearRight.x,nearRight.y);ctx.lineTo(nearLeft.x,nearLeft.y);ctx.closePath();ctx.clip();
  const grd=ctx.createLinearGradient(0,H*.28,0,H);
  grd.addColorStop(0,"#a9a0a0");grd.addColorStop(.46,"#7778a3");grd.addColorStop(1,"#4e5887");
  ctx.fillStyle=grd;ctx.fillRect(0,H*.26,W,H*.74);
  ctx.restore();

  ctx.strokeStyle="#eee9d7";ctx.lineWidth=Math.max(1.5,W*.003);
  ctx.beginPath();ctx.moveTo(project(-.78,0).x,project(-.78,0).y);ctx.lineTo(project(-.98,1).x,project(-.98,1).y);
  ctx.moveTo(project(.78,0).x,project(.78,0).y);ctx.lineTo(project(.98,1).x,project(.98,1).y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(project(-.78,0).x,project(-.78,0).y);ctx.lineTo(project(.78,0).x,project(.78,0).y);
  ctx.moveTo(project(-.98,1).x,project(-.98,1).y);ctx.lineTo(project(.98,1).x,project(.98,1).y);ctx.stroke();

  ctx.beginPath();ctx.moveTo(project(-.78,.5).x,project(-.78,.5).y);ctx.lineTo(project(.78,.5).x,project(.78,.5).y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(project(-.39,0).x,project(-.39,0).y);ctx.lineTo(project(-.39,1).x,project(-.39,1).y);
  ctx.moveTo(project(.39,0).x,project(.39,0).y);ctx.lineTo(project(.39,1).x,project(.39,1).y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(project(-.78,.5).x,project(-.78,.5).y);ctx.lineTo(project(-.39,.5).x,project(-.39,.5).y);
  ctx.moveTo(project(.78,.5).x,project(.78,.5).y);ctx.lineTo(project(.39,.5).x,project(.39,.5).y);ctx.stroke();

  const netL=project(-.92,.5), netR=project(.92,.5);
  ctx.fillStyle="#d8d5c4"; ctx.fillRect(netL.x,netL.y-5,netR.x-netL.x,10);
  ctx.strokeStyle="#263136";ctx.lineWidth=1;
  for(let i=0;i<45;i++) { const x=netL.x+(netR.x-netL.x)*i/44; ctx.beginPath();ctx.moveTo(x,netL.y-18);ctx.lineTo(x,netL.y+10);ctx.stroke(); }
  ctx.beginPath();ctx.moveTo(netL.x,netL.y-18);ctx.lineTo(netR.x,netR.y-18);ctx.stroke();
  ctx.fillStyle="#dfe2d7";ctx.fillRect(netL.x-3,netL.y-25,6,38);ctx.fillRect(netR.x-3,netR.y-25,6,38);
}

function drawPlayer(p, cpu=false) {
  const pos=project(p.x,p.y,0), s=pos.scale*(cpu?.72:1);
  ctx.save();ctx.translate(pos.x,pos.y);ctx.scale(s,s);
  ctx.fillStyle="rgba(0,0,0,.28)";ctx.beginPath();ctx.ellipse(0,8,16,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=cpu?"#dcd4cb":"#e1e0d5";
  ctx.beginPath();ctx.arc(0,-62,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=cpu?"#191e25":"#f0eee2";ctx.fillRect(-6,-53,12,7);
  ctx.fillStyle=cpu?"#d9d5c8":"#b8c1bd";ctx.beginPath();ctx.ellipse(0,-29,13,25,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=cpu?"#a94d43":"#256a62";ctx.fillRect(-13,-36,26,16);
  ctx.fillStyle="#1e2425";ctx.fillRect(-12,-23,10,28);ctx.fillRect(2,-23,10,28);
  ctx.fillStyle="#eeeae0";ctx.fillRect(-13,4,10,5);ctx.fillRect(3,4,10,5);
  ctx.fillStyle="#d8cbb1";
  const swing=p.swing>0?-1:0.3;
  ctx.save();ctx.translate(cpu?10:-10,-38);ctx.rotate(swing*(cpu?-.9:.9));ctx.fillRect(-3,-2,30,5);ctx.restore();
  ctx.fillStyle="#ddd";ctx.beginPath();ctx.ellipse(cpu?18:-18,-36,7,10,.4,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawBall() {
  const b=state.ball;
  for(let i=b.trail.length-1;i>=0;i--) {
    const q=b.trail[i], pos=project(q.x,q.y,q.z);
    ctx.globalAlpha=(b.trail.length-i)/b.trail.length*.18;
    ctx.fillStyle="#f5ef77";ctx.beginPath();ctx.arc(pos.x,pos.y,3*pos.scale,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  const pos=project(b.x,b.y,b.z);
  ctx.fillStyle="rgba(0,0,0,.22)";ctx.beginPath();ctx.ellipse(project(b.x,b.y,0).x,project(b.x,b.y,0).y,5*pos.scale,2*pos.scale,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#eff35c";ctx.beginPath();ctx.arc(pos.x,pos.y,4.8*pos.scale,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.7)";ctx.beginPath();ctx.arc(pos.x,pos.y,4.8*pos.scale,.2,1.8);ctx.stroke();
}

function draw() {
  drawCourt();
  const objects=[{p:state.cpu,c:true},{p:state.player,c:false},{ball:true}].sort((a,b)=>{
    const ay=a.ball?state.ball.y:a.p.y, by=b.ball?state.ball.y:b.p.y;return ay-by;
  });
  objects.forEach(o=>o.ball?drawBall():drawPlayer(o.p,o.c));
}

let last=performance.now();
function loop(now) {
  const dt=Math.min(2,(now-last)/16.667);last=now;
  update(dt);draw();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
