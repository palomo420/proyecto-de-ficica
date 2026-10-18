"use strict";
    // Utilidades comunes: formato, lienzos de alta densidad y dibujo de flechas.
    const Utils = {
      fmt(n, digits = 2) { return Number.isFinite(n) ? Number(n).toFixed(digits) : "—"; },
      eng(n, unit = "Ω") {
        if (!Number.isFinite(n)) return "—";
        const a = Math.abs(n);
        if (a >= 1e6) return `${this.fmt(n / 1e6, 3)} M${unit}`;
        if (a >= 1e3) return `${this.fmt(n / 1e3, 3)} k${unit}`;
        if (a > 0 && a < 1e-3) return `${this.fmt(n * 1e3, 3)} m${unit}`;
        return `${this.fmt(n, 3)} ${unit}`;
      },
      setupCanvas(canvas) {
        const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, w, h };
      },
      arrow(ctx, x1, y1, x2, y2, color, width = 2.5) {
        const a = Math.atan2(y2-y1, x2-x1), head = 9;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2,y2);
        ctx.lineTo(x2-head*Math.cos(a-.45), y2-head*Math.sin(a-.45));
        ctx.lineTo(x2-head*Math.cos(a+.45), y2-head*Math.sin(a+.45)); ctx.closePath(); ctx.fill();
      },
      css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
    };

    let oscillatorSim = {resize() {}, stop() {}};

    // Enrutador de vistas y comportamiento accesible del menú lateral.
    const Router = (() => {
      const titles = { home:"Inicio / Guía", projectile:"Movimiento parabólico", oscillator:"Péndulo y masa-resorte", vectors:"Vectores", circuits:"Circuitos eléctricos", chaos:"Péndulo doble" };
      let current = "home";
      function go(name) {
        if (!titles[name]) return;
        current = name;
        document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
        document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === name));
        document.getElementById("pageTitle").textContent = titles[name];
        Menu.close();
        if (name === "projectile") ProjectileSim.resize();
        if (name === "oscillator") oscillatorSim.resize();
        else oscillatorSim.stop();
        if (name === "vectors") VectorLab.draw();
        if (name === "circuits") CircuitLab.resize();
        if (name === "chaos") ChaosLab.start(); else ChaosLab.stop();
      }
      return { go, get current(){ return current; } };
    })();
    const Menu = (() => {
      const drawer = document.getElementById("drawer"), overlay = document.getElementById("overlay"), toggle = document.getElementById("menuToggle");
      function open() { drawer.classList.add("open"); overlay.classList.add("open"); drawer.setAttribute("aria-hidden","false"); toggle.setAttribute("aria-expanded","true"); toggle.setAttribute("aria-label","Cerrar menú de navegación"); drawer.querySelector(".nav-link.active").focus(); }
      function close() { drawer.classList.remove("open"); overlay.classList.remove("open"); drawer.setAttribute("aria-hidden","true"); toggle.setAttribute("aria-expanded","false"); toggle.setAttribute("aria-label","Abrir menú de navegación"); }
      toggle.addEventListener("click", () => drawer.classList.contains("open") ? close() : open());
      overlay.addEventListener("click", close);
      drawer.addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) Router.go(b.dataset.view); });
      document.addEventListener("keydown", e => { if(e.key === "Escape" && drawer.classList.contains("open")) { close(); toggle.focus(); } });
      document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => Router.go(b.dataset.go)));
      return {open, close};
    })();

    // Simulación de proyectil con solución analítica sin arrastre e integración Euler con arrastre.
    const ProjectileSim = (() => {
      const canvas = document.getElementById("projectileCanvas"), ctx = canvas.getContext("2d");
      const $ = id => document.getElementById(id);
      const state = { t:0, x:0, y:0, vx:0, vy:0, flight:0, range:0, maxH:0, impact:0, impactAngle:0, running:false, paused:false, last:0, paths:[], target:35, targetY:0 };
      function val(id) { return Number($(id).value); }
      function gravity() { return $("gravity").value === "custom" ? val("customGravity") : Number($("gravity").value); }
      function params() {
        const speed=val("speedNum"), angle=val("angleNum")*Math.PI/180, y0=val("heightNum"), g=gravity();
        return {speed, angle, y0, g, vx:speed*Math.cos(angle), vy:speed*Math.sin(angle), drag:$("airToggle").checked, k:val("dragK")};
      }
      function analytic(p) {
        const flight=(p.vy+Math.sqrt(p.vy*p.vy+2*p.g*p.y0))/p.g;
        return {flight, range:p.vx*flight, maxH:p.y0+p.vy*p.vy/(2*p.g), impact:Math.hypot(p.vx,p.vy-p.g*flight), impactAngle:Math.atan2(p.vy-p.g*flight,p.vx)*180/Math.PI};
      }
      function predict(p) {
        if (!p.drag) return analytic(p);
        let t=0,x=0,y=p.y0,vx=p.vx,vy=p.vy,maxH=y;
        const dt=.005, maxSteps=200000;
        for(let i=0;i<maxSteps && (i===0 || y>0);i++){
          const speed=Math.hypot(vx,vy);
          vx+=-p.k*speed*vx*dt;
          vy+=(-p.g-p.k*speed*vy)*dt;
          x+=vx*dt;y+=vy*dt;t+=dt;maxH=Math.max(maxH,y);
        }
        y=Math.max(0,y);
        return {flight:t,range:x,maxH,impact:Math.hypot(vx,vy),impactAngle:Math.atan2(vy,vx)*180/Math.PI};
      }
      function syncPair(rangeId,numId) {
        const r=$(rangeId), n=$(numId), updateFromRange=()=>n.value=r.value;
        r.addEventListener("input",()=>{updateFromRange(); updateStats();});
        n.addEventListener("input",()=>{const v=Number(n.value); if(n.value!=="" && Number.isFinite(v)) r.value=String(Math.max(Number(r.min),Math.min(Number(r.max),v))); updateStats();});
      }
      syncPair("speedRange","speedNum"); syncPair("angleRange","angleNum"); syncPair("heightRange","heightNum");
      $("gravity").addEventListener("change",()=>{ $("customGravity").classList.toggle("hidden",$("gravity").value!=="custom"); updateStats(); });
      ["customGravity","dragK","airToggle","showVectors","oldTrajectories"].forEach(id => $(id).addEventListener("input",updateStats));
      $("airToggle").addEventListener("change",()=>{$("dragGroup").classList.toggle("hidden",!$("airToggle").checked);updateStats();});
      $("launchBtn").addEventListener("click", launch);
      $("pauseBtn").addEventListener("click",()=>{ if(state.running){state.paused=!state.paused;$("pauseBtn").textContent=state.paused?"Reanudar":"Pausar";} });
      $("resetProjectile").addEventListener("click",()=>{state.running=false;state.paused=false;state.t=0;state.x=0;state.y=val("heightNum");const p=params();state.vx=p.vx;state.vy=p.vy;$("pauseBtn").textContent="Pausar";updateInstant();draw();});
      $("newTarget").addEventListener("click",()=>{state.target=Math.round(12+Math.random()*58); $("targetText").textContent=`Blanco a ${state.target} m. Ajusta v₀ y θ.`;draw();});
      $("challengeToggle").addEventListener("change",()=>{$("targetText").textContent=$("challengeToggle").checked?`Blanco a ${state.target} m. Ajusta v₀ y θ.`:"";draw();});
      function launch() {
        const p=params(), message=$("projectileMsg");
        if(!Number.isFinite(p.speed)||p.speed<0||p.speed>100||!Number.isFinite(p.angle)||p.angle<0||p.angle>Math.PI/2||!Number.isFinite(p.y0)||p.y0<0||!Number.isFinite(p.g)||p.g<=0||p.k<0) {message.textContent="Revisa los valores: velocidad, altura y ángulo deben estar en rango; g debe ser positiva.";return;}
        if($("oldTrajectories").checked && currentPath.length) state.paths.push({points:currentPath.slice(), color:"#8b98aa"});
        else if(!$("oldTrajectories").checked) state.paths=[];
        state.t=0;state.x=0;state.y=p.y0;state.vx=p.vx;state.vy=p.vy;state.running=true;state.paused=false;state.last=0;currentPath=[];
        $("pauseBtn").textContent="Pausar";message.textContent="";
        const result=predict(p); state.flight=result.flight;state.range=result.range;state.maxH=result.maxH;state.impact=result.impact;state.impactAngle=result.impactAngle;
        updateStats(); requestAnimationFrame(tick);
      }
      let currentPath=[];
      function tick(now) {
        if(!state.running) return;
        if(state.paused){state.last=now;requestAnimationFrame(tick);return;}
        if(!state.last) state.last=now;
        let dt=Math.min((now-state.last)/1000,0.04)*Number($("simSpeed").value); state.last=now;
        if(dt>0 && $("airToggle").checked) {
          const steps=Math.max(1,Math.ceil(dt/.008)), h=dt/steps, p=params();
          for(let i=0;i<steps;i++){const speed=Math.hypot(state.vx,state.vy);state.vx+=-p.k*speed*state.vx*h;state.vy+=(-p.g-p.k*speed*state.vy)*h;state.x+=state.vx*h;state.y+=state.vy*h;state.t+=h;if(state.y<=0&&state.t>0){state.y=0;state.running=false;break;}}
        } else {
          const p=params(); state.t+=dt; state.x=p.vx*state.t; state.y=p.y0+p.vy*state.t-.5*p.g*state.t*state.t;
          state.vx=p.vx; state.vy=p.vy-p.g*state.t;
          if(state.y<=0 && state.t>0){state.y=0;state.running=false;}
        }
        currentPath.push([state.x,state.y]); updateInstant();draw();
        if(state.running) requestAnimationFrame(tick);
        else if($("challengeToggle").checked) $("projectileMsg").textContent=Math.abs(state.x-state.target)<Math.max(1,state.target*.03)?"¡Impacto! Has acertado el blanco.":`El proyectil llegó a ${Utils.fmt(state.x,1)} m; el blanco está a ${state.target} m.`;
      }
      function boxStats(items) { return items.map(([name,value])=>`<div class="stat"><span>${name}</span><strong>${value}</strong></div>`).join(""); }
      function updateStats() {
        const p=params(), r=predict(p);
        state.flight=r.flight;state.range=r.range;state.maxH=r.maxH;state.impact=r.impact;state.impactAngle=r.impactAngle;
        $("projectileStats").innerHTML=boxStats([["Tiempo de vuelo",`${Utils.fmt(r.flight)} s`],["Alcance máximo",`${Utils.fmt(r.range)} m`],["Altura máxima",`${Utils.fmt(r.maxH)} m`],["Velocidad de impacto",`${Utils.fmt(r.impact)} m/s`],["Ángulo de impacto",`${Utils.fmt(r.impactAngle)}°`]]);
        if(!state.running && state.t===0){state.y=p.y0;state.vx=p.vx;state.vy=p.vy;}
        updateInstant();draw();
      }
      function updateInstant(){ $("instantStats").innerHTML=boxStats([["t",`${Utils.fmt(state.t,2)} s`],["x",`${Utils.fmt(state.x,2)} m`],["y",`${Utils.fmt(Math.max(0,state.y),2)} m`],["vx",`${Utils.fmt(state.vx,2)} m/s`],["vy",`${Utils.fmt(state.vy,2)} m/s`],["|v|",`${Utils.fmt(Math.hypot(state.vx,state.vy),2)} m/s`]]); }
      function draw() {
        const {ctx:c,w,h}=Utils.setupCanvas(canvas), p=params(), predicted={flight:state.flight,range:state.range,maxH:state.maxH}, ballistic=analytic(p);
        c.clearRect(0,0,w,h);
        const maxX=Math.max(10,predicted.range*1.12,state.x*1.15,$("challengeToggle").checked?state.target*1.2:0), maxY=Math.max(10,predicted.maxH*1.18,state.y*1.2);
        const pad={l:48,r:18,t:22,b:38}, sx=(w-pad.l-pad.r)/maxX, sy=(h-pad.t-pad.b)/maxY, scale=Math.min(sx,sy);
        const ox=pad.l, oy=h-pad.b, X=x=>ox+x*scale, Y=y=>oy-y*scale;
        c.strokeStyle=Utils.css("--line");c.lineWidth=1;c.fillStyle=Utils.css("--muted");c.font="11px system-ui";
        const step=maxX>150?25:maxX>60?10:5;
        for(let x=0;x<=maxX;x+=step){c.beginPath();c.moveTo(X(x),pad.t);c.lineTo(X(x),oy);c.stroke();c.fillText(`${x}`,X(x)-6,oy+17);}
        for(let y=0;y<=maxY;y+=step){c.beginPath();c.moveTo(ox,Y(y));c.lineTo(w-pad.r,Y(y));c.stroke();if(y)c.fillText(`${y}`,5,Y(y)+4);}
        c.strokeStyle=Utils.css("--muted");c.beginPath();c.moveTo(ox,pad.t);c.lineTo(ox,oy);c.lineTo(w-pad.r,oy);c.stroke();c.fillText("x (m)",w-48,h-8);c.fillText("y (m)",5,14);
        c.fillStyle=Utils.css("--line");c.fillRect(ox,oy,w-ox-pad.r,h-oy);
        state.paths.forEach(path=>{c.strokeStyle=path.color;c.beginPath();path.points.forEach((pt,i)=>i?c.lineTo(X(pt[0]),Y(pt[1])):c.moveTo(X(pt[0]),Y(pt[1])));c.stroke();});
        c.strokeStyle=Utils.css("--blue");c.lineWidth=2.5;c.beginPath();
        if(currentPath.length){currentPath.forEach((pt,i)=>i?c.lineTo(X(pt[0]),Y(pt[1])):c.moveTo(X(pt[0]),Y(pt[1])));}
        else {for(let t=0;t<=ballistic.flight;t+=Math.max(ballistic.flight/80,.01)){const yy=p.y0+p.vy*t-.5*p.g*t*t;if(yy>=0){const xx=p.vx*t;t===0?c.moveTo(X(xx),Y(yy)):c.lineTo(X(xx),Y(yy));}}}
        c.stroke();c.lineWidth=1;
        if($("challengeToggle").checked){c.fillStyle=Utils.css("--amber");c.beginPath();c.arc(X(state.target),oy-7,7,0,Math.PI*2);c.fill();c.fillText("blanco",X(state.target)+8,oy-9);}
        if(predicted.maxH>0){c.fillStyle=Utils.css("--green");c.beginPath();c.arc(X(predicted.range/2),Y(predicted.maxH),4,0,Math.PI*2);c.fill();c.fillText("H máx.",X(predicted.range/2)+6,Y(predicted.maxH)-7);}
        if(predicted.range>0){c.fillStyle=Utils.css("--muted");c.fillText(`R = ${Utils.fmt(predicted.range,1)} m`,X(predicted.range),oy-7);}
        if(state.y>=0 && (state.t>0||state.running)){const px=X(state.x),py=Y(state.y);c.fillStyle=Utils.css("--blue");c.beginPath();c.arc(px,py,7,0,Math.PI*2);c.fill();if($("showVectors").checked){const factor=1.1;c.setLineDash([]);Utils.arrow(c,px,py,px+state.vx*factor,py,Utils.css("--green"),2);Utils.arrow(c,px,py,px,py-state.vy*factor,Utils.css("--amber"),2);Utils.arrow(c,px,py,px+state.vx*.7,py-state.vy*.7,Utils.css("--danger"),2);}}
      }
      function resize(){draw();}
      window.addEventListener("resize",resize);
      updateStats();
      return {resize,draw};
    })();

    // Modelo armónico ideal para péndulo de ángulo pequeño y masa-resorte.
    oscillatorSim = (() => {
      const $ = id => document.getElementById(id);
      const canvas = $("oscillatorCanvas"), graph = $("oscillatorGraph");
      let time = 0, running = false, lastFrame = 0, frameId = 0;

      function parameters() {
        const kind = $("oscillatorType").value, mass = Number($("oscillatorMass").value);
        const length = Number($("pendulumLength").value), angle = Number($("pendulumAngle").value);
        const gravity = Number($("oscillatorGravity").value), spring = Number($("springConstant").value);
        const amplitude = Number($("springAmplitude").value);
        if (!Number.isFinite(mass) || mass < 0.1 || mass > 20) return null;
        if (kind === "pendulum" && (!Number.isFinite(length) || length < 0.1 || length > 5 ||
            !Number.isFinite(angle) || angle < 1 || angle > 30 || !Number.isFinite(gravity) || gravity <= 0)) return null;
        if (kind === "spring" && (!Number.isFinite(spring) || spring < 0.1 || spring > 100 ||
            !Number.isFinite(amplitude) || amplitude < 0.01 || amplitude > 1)) return null;
        const omega = kind === "pendulum" ? Math.sqrt(gravity / length) : Math.sqrt(spring / mass);
        return {kind, mass, length, angle: angle * Math.PI / 180, gravity, spring, amplitude, omega, period: 2 * Math.PI / omega};
      }

      function sample(p, t) {
        if (p.kind === "pendulum") {
          const theta = p.angle * Math.cos(p.omega * t), angularVelocity = -p.angle * p.omega * Math.sin(p.omega * t);
          const position = p.length * theta, velocity = p.length * angularVelocity;
          return {position, velocity, kinetic: 0.5 * p.mass * velocity ** 2, potential: 0.5 * p.mass * p.gravity * p.length * theta ** 2, theta};
        }
        const position = p.amplitude * Math.cos(p.omega * t), velocity = -p.amplitude * p.omega * Math.sin(p.omega * t);
        return {position, velocity, kinetic: 0.5 * p.mass * velocity ** 2, potential: 0.5 * p.spring * position ** 2, theta: 0};
      }

      function updateStats(p) {
        if (!p) { $("oscillatorStats").innerHTML = ""; return; }
        const state = sample(p, time);
        const values = [
          ["Periodo", `${Utils.fmt(p.period)} s`],
          ["Frecuencia angular", `${Utils.fmt(p.omega)} rad/s`],
          ["Posición", `${Utils.fmt(state.position)} m`],
          ["Velocidad", `${Utils.fmt(state.velocity)} m/s`],
          ...(p.kind === "pendulum" ? [["Ángulo", `${Utils.fmt(state.theta * 180 / Math.PI)}°`]] : []),
          ["Energía cinética", `${Utils.fmt(state.kinetic)} J`],
          ["Energía potencial", `${Utils.fmt(state.potential)} J`],
          ["Energía mecánica", `${Utils.fmt(state.kinetic + state.potential)} J`]
        ];
        $("oscillatorStats").innerHTML = values.map(([name, value]) => `<div class="stat"><span>${name}</span><strong>${value}</strong></div>`).join("");
      }

      function drawSystem(p) {
        const {ctx: c, w, h} = Utils.setupCanvas(canvas);
        c.clearRect(0, 0, w, h);
        if (!p) {
          c.fillStyle = Utils.css("--danger"); c.font = "14px system-ui"; c.fillText("Revisa los valores ingresados.", 18, 32);
          return;
        }
        const state = sample(p, time);
        c.strokeStyle = Utils.css("--line"); c.fillStyle = Utils.css("--text"); c.lineWidth = 2;
        if (p.kind === "pendulum") {
          const pivot = {x: w / 2, y: Math.max(38, h * 0.13)}, lengthPx = Math.min(h * 0.62, w * 0.38);
          const bob = {x: pivot.x + lengthPx * Math.sin(state.theta), y: pivot.y + lengthPx * Math.cos(state.theta)};
          c.beginPath(); c.moveTo(pivot.x - 65, pivot.y); c.lineTo(pivot.x + 65, pivot.y); c.stroke();
          c.strokeStyle = Utils.css("--blue"); c.lineWidth = 3; c.beginPath(); c.moveTo(pivot.x, pivot.y); c.lineTo(bob.x, bob.y); c.stroke();
          c.fillStyle = Utils.css("--amber"); c.beginPath(); c.arc(bob.x, bob.y, 17, 0, Math.PI * 2); c.fill();
          c.fillStyle = Utils.css("--text"); c.beginPath(); c.arc(pivot.x, pivot.y, 5, 0, Math.PI * 2); c.fill();
          c.strokeStyle = Utils.css("--muted"); c.setLineDash([4, 5]); c.beginPath(); c.moveTo(pivot.x, pivot.y); c.lineTo(pivot.x, pivot.y + lengthPx); c.stroke(); c.setLineDash([]);
          c.fillStyle = Utils.css("--muted"); c.font = "13px system-ui"; c.fillText(`L = ${Utils.fmt(p.length)} m`, pivot.x + 10, pivot.y + lengthPx * 0.56);
        } else {
          const wallX = w * 0.14, restX = w * 0.64, centerY = h * 0.52;
          const scale = Math.min(w * 0.35, h * 0.7), blockX = restX + state.position / p.amplitude * scale * 0.42;
          c.strokeStyle = Utils.css("--muted"); c.beginPath(); c.moveTo(wallX, centerY - 65); c.lineTo(wallX, centerY + 65); c.stroke();
          c.setLineDash([4, 5]); c.beginPath(); c.moveTo(restX, centerY - 55); c.lineTo(restX, centerY + 55); c.stroke(); c.setLineDash([]);
          const start = wallX, end = blockX, coils = 12, width = end - start;
          c.strokeStyle = Utils.css("--blue"); c.lineWidth = 3; c.beginPath(); c.moveTo(start, centerY);
          for (let i = 1; i < coils; i++) c.lineTo(start + width * i / coils, centerY + (i % 2 ? -14 : 14));
          c.lineTo(end, centerY); c.stroke();
          c.fillStyle = Utils.css("--amber"); c.fillRect(blockX, centerY - 27, 52, 54);
          c.fillStyle = Utils.css("--text"); c.font = "13px system-ui"; c.fillText(`x = ${Utils.fmt(state.position)} m`, wallX, centerY + 94);
        }
        c.fillStyle = Utils.css("--muted"); c.font = "13px system-ui"; c.fillText(`t = ${Utils.fmt(time, 2)} s`, 16, h - 16);
      }

      function drawGraph(p) {
        const {ctx: c, w, h} = Utils.setupCanvas(graph);
        c.clearRect(0, 0, w, h);
        if (!p) return;
        const pad = {left: 48, right: 18, top: 20, bottom: 32}, width = w - pad.left - pad.right, height = h - pad.top - pad.bottom;
        const span = 2 * p.period, amp = p.kind === "pendulum" ? p.length * p.angle : p.amplitude;
        const x = t => pad.left + t / span * width, y = q => pad.top + height * (0.5 - q / (2 * amp));
        c.strokeStyle = Utils.css("--line"); c.fillStyle = Utils.css("--muted"); c.lineWidth = 1; c.font = "11px system-ui";
        for (let i = 0; i <= 4; i++) {
          const gx = pad.left + width * i / 4;
          c.beginPath(); c.moveTo(gx, pad.top); c.lineTo(gx, h - pad.bottom); c.stroke();
          c.fillText(Utils.fmt(span * i / 4, 1), gx - 8, h - 10);
        }
        c.beginPath(); c.moveTo(pad.left, y(0)); c.lineTo(w - pad.right, y(0)); c.stroke();
        c.fillStyle = Utils.css("--muted"); c.fillText("t (s)", w - 38, h - 10); c.fillText("x (m)", 7, pad.top + 4);
        c.strokeStyle = Utils.css("--blue"); c.lineWidth = 2.5; c.beginPath();
        for (let i = 0; i <= 120; i++) {
          const t = span * i / 120, position = sample(p, t).position;
          i ? c.lineTo(x(t), y(position)) : c.moveTo(x(t), y(position));
        }
        c.stroke();
        const phase = time % span, current = sample(p, phase).position;
        c.strokeStyle = Utils.css("--amber"); c.setLineDash([4, 4]); c.beginPath(); c.moveTo(x(phase), pad.top); c.lineTo(x(phase), h - pad.bottom); c.stroke(); c.setLineDash([]);
        c.fillStyle = Utils.css("--amber"); c.beginPath(); c.arc(x(phase), y(current), 5, 0, Math.PI * 2); c.fill();
      }

      function render() {
        const p = parameters();
        if (!p && running) stop();
        $("oscillatorMessage").textContent = p ? "" : "Revisa que los valores estén dentro de los límites indicados.";
        updateStats(p); drawSystem(p); drawGraph(p);
      }
      function tick(now) {
        if (!running) return;
        if (lastFrame) time += Math.min((now - lastFrame) / 1000, 0.05);
        lastFrame = now; render(); frameId = requestAnimationFrame(tick);
      }
      function start() {
        if (running) { stop(); $("oscillatorStart").textContent = "Reanudar"; return; }
        if (!parameters()) { render(); return; }
        running = true; lastFrame = 0; $("oscillatorStart").textContent = "Pausar"; frameId = requestAnimationFrame(tick);
      }
      function stop() {
        running = false; lastFrame = 0; cancelAnimationFrame(frameId); $("oscillatorStart").textContent = "Iniciar";
      }
      function reset() { stop(); time = 0; render(); }
      $("oscillatorStart").addEventListener("click", start);
      $("oscillatorReset").addEventListener("click", reset);
      $("oscillatorType").addEventListener("change", () => {
        $("pendulumControls").classList.toggle("hidden", $("oscillatorType").value !== "pendulum");
        $("springControls").classList.toggle("hidden", $("oscillatorType").value !== "spring");
        reset();
      });
      ["oscillatorMass", "pendulumLength", "pendulumAngle", "oscillatorGravity", "springConstant", "springAmplitude"].forEach(id => {
        $(id).addEventListener("input", reset);
        $(id).addEventListener("change", reset);
      });
      window.addEventListener("resize", render);
      render();
      return {resize: render, stop};
    })();

    // Editor de vectores, cálculo vectorial, dibujo y verificación de ejercicios.
    const VectorLab = (() => {
      const colors=["#178b64","#2878e5","#bf7900","#b149bd"], names=["A","B","C","D"];
      let vectors=[[4,3,0],[-2,2,0]], score=0, challenge=null, dragIndex=-1, viewScale=24, offset={x:0,y:0};
      const $=id=>document.getElementById(id), rows=$("vectorRows"), canvas=$("vectorCanvas");
      const vec2=v=>v.map(Number);
      function renderRows(){
        rows.innerHTML=vectors.map((v,i)=>`<div class="vector-row" data-index="${i}"><strong><span class="color-dot" style="background:${colors[i]}"></span>${names[i]}</strong><input aria-label="${names[i]} componente x o magnitud" type="number" step="0.1" value="${Utils.fmt(v[0],2)}" data-axis="0"><input aria-label="${names[i]} componente y o ángulo" type="number" step="0.1" value="${Utils.fmt(v[1],2)}" data-axis="1"><input aria-label="${names[i]} componente z" class="${$("vector3d").checked?"":"hidden"}" type="number" step="0.1" value="${Utils.fmt(v[2],2)}" data-axis="2"><button class="delete-btn" aria-label="Eliminar vector ${names[i]}" data-delete="${i}">×</button></div>`).join("");
        rows.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",()=>{const i=Number(inp.closest(".vector-row").dataset.index),a=Number(inp.dataset.axis),n=Number(inp.value);if(Number.isFinite(n)){if($("vectorFormat").value==="polar"&&a<2){const mag=Number(rows.querySelector(`[data-index="${i}"] [data-axis="0"]`).value)||0,ang=Number(rows.querySelector(`[data-index="${i}"] [data-axis="1"]`).value)||0;vectors[i][0]=mag*Math.cos(ang*Math.PI/180);vectors[i][1]=mag*Math.sin(ang*Math.PI/180);}else vectors[i][a]=n;update();}}));
        rows.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{if(vectors.length<=2)return;$("vectorMsg").textContent="";vectors.splice(Number(b.dataset.delete),1);renderRows();update();}));
      }
      function toInput(i) {
        const row=rows.querySelector(`[data-index="${i}"]`);if(!row)return;
        if($("vectorFormat").value==="polar"){row.querySelector('[data-axis="0"]').value=Utils.fmt(Math.hypot(vectors[i][0],vectors[i][1]),2);row.querySelector('[data-axis="1"]').value=Utils.fmt(Math.atan2(vectors[i][1],vectors[i][0])*180/Math.PI,2);}
        else vectors[i].forEach((n,a)=>{const inp=row.querySelector(`[data-axis="${a}"]`);if(inp)inp.value=Utils.fmt(n,2);});
      }
      $("vectorFormat").addEventListener("change",()=>{renderRows();vectors.forEach((_,i)=>toInput(i));update();});
      $("vector3d").addEventListener("change",()=>{renderRows();update();});
      $("addVector").addEventListener("click",()=>{if(vectors.length>=4)return;$("vectorMsg").textContent="";vectors.push([Math.round(Math.random()*6-3),Math.round(Math.random()*6-3),0]);renderRows();update();});
      $("removeVector").addEventListener("click",()=>{if(vectors.length>2){vectors.pop();renderRows();update();}});
      $("vectorOperation").addEventListener("change",()=>{$("scalarGroup").classList.toggle("hidden",$("vectorOperation").value!=="scale");update();});
      $("vectorMethod").addEventListener("change",draw); $("componentsToggle").addEventListener("change",draw);
      function norm(v){return Math.hypot(...v);}
      function calcularDireccionVector(x,y){
        const grados=Math.atan2(y,x)*(180/Math.PI);
        return grados<0?grados+360:grados;
      }
      function calculate(){
        const op=$("vectorOperation").value, dim=$("vector3d").checked?3:2, A=vectors[0],B=vectors[1], vectorsUsed=vectors.map(v=>v.slice(0,dim));
        let result=null, scalar=null, explanation="";
        const comp=v=>`(${v.slice(0,dim).map(n=>Utils.fmt(n)).join(", ")})`;
        if(op==="sum"){result=Array(dim).fill(0).map((_,j)=>vectorsUsed.reduce((s,v)=>s+v[j],0));explanation=`R = ${vectorsUsed.map(comp).join(" + ")}\nRx = ${vectorsUsed.map(v=>Utils.fmt(v[0])).join(" + ")} = ${Utils.fmt(result[0])}\nRy = ${vectorsUsed.map(v=>Utils.fmt(v[1])).join(" + ")} = ${Utils.fmt(result[1])}\n|R| = √(${result.map(n=>Utils.fmt(n)+"²").join(" + ")}) = ${Utils.fmt(norm(result))}`;}
        else if(op==="subtract"){result=A.slice(0,dim).map((x,j)=>x-B[j]);explanation=`A − B = (${comp(A)} − ${comp(B)})\nR = ${comp(result)}\n|R| = ${Utils.fmt(norm(result))}`;}
        else if(op==="scale"){const k=Number($("vectorScalar").value)||0;result=A.slice(0,dim).map(x=>x*k);explanation=`kA = ${Utils.fmt(k)} · ${comp(A)}\nR = ${comp(result)}\n|R| = ${Utils.fmt(norm(result))}`;}
        else if(op==="dot"){scalar=A.slice(0,dim).reduce((s,x,j)=>s+x*B[j],0);explanation=`A · B = ${A.slice(0,dim).map((x,j)=>`${Utils.fmt(x)}·${Utils.fmt(B[j])}`).join(" + ")}\nA · B = ${Utils.fmt(scalar)} (unidades²)`;}
        else if(op==="cross"){const a=[...A.slice(0,3)],b=[...B.slice(0,3)];result=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];explanation=`A × B = (AyBz − AzBy, AzBx − AxBz, AxBy − AyBx)\nA × B = ${comp(result)}\n|A × B| = ${Utils.fmt(norm(result))}`;}
        else if(op==="angle"){const dot=A.slice(0,dim).reduce((s,x,j)=>s+x*B[j],0),den=norm(A.slice(0,dim))*norm(B.slice(0,dim));scalar=den?Math.acos(Math.max(-1,Math.min(1,dot/den)))*180/Math.PI:NaN;explanation=`cos θ = (A · B)/(|A||B|) = ${Utils.fmt(dot)}/(${Utils.fmt(norm(A.slice(0,dim)))}·${Utils.fmt(norm(B.slice(0,dim)))})\nθ = ${Utils.fmt(scalar)}°`;}
        else if(op==="direction"){
          const directions=["este","noreste","norte","noroeste","oeste","suroeste","sur","sureste"];
          explanation=`Orientación de cada vector en el plano XY (desde el este, en sentido antihorario):\n\n${vectors.map((v,i)=>{
            const [x,y]=v, magnitude=Math.hypot(x,y), label=names[i];
            if(magnitude===0)return `${label} = (${Utils.fmt(x)}, ${Utils.fmt(y)})\nEs el vector nulo; no tiene dirección ni sentido.`;
            const degrees=calcularDireccionVector(x,y), direction=directions[Math.round(degrees/45)%8];
            return `${label} = (${Utils.fmt(x)}, ${Utils.fmt(y)})\nθ = atan2(${Utils.fmt(y)}, ${Utils.fmt(x)}) = ${Utils.fmt(degrees)}°\nOrientación: ${direction}.`;
          }).join("\n\n")}`;
        }
        else if(op==="projection"){const dot=A.slice(0,dim).reduce((s,x,j)=>s+x*B[j],0),den=B.slice(0,dim).reduce((s,x)=>s+x*x,0);result=den?B.slice(0,dim).map(x=>x*dot/den):Array(dim).fill(NaN);explanation=`proy_B A = [(A · B)/|B|²]B\n= [${Utils.fmt(dot)}/${Utils.fmt(den)}]${comp(B)}\n= ${comp(result)}`;}
        else if(op==="unit"){const m=norm(A.slice(0,dim));result=m?A.slice(0,dim).map(x=>x/m):Array(dim).fill(NaN);explanation=`Â = A/|A| = ${comp(A)}/${Utils.fmt(m)}\nÂ = ${comp(result)}`;}
        else {scalar=norm(A.slice(0,dim));explanation=`|A| = √(${A.slice(0,dim).map(x=>Utils.fmt(x)+"²").join(" + ")}) = ${Utils.fmt(scalar)}`;}
        return {op,result,scalar,explanation};
      }
      function update(){const c=calculate();$("vectorSolution").textContent=c.explanation+(c.result?`\n\nResultado: ${compDisplay(c.result)}`:c.scalar!==null?`\n\nResultado: ${Utils.fmt(c.scalar)}${c.op==="angle"||c.op==="direction"?"°":""}`:"");draw();}
      function compDisplay(v){return `(${v.map(n=>Utils.fmt(n)).join(", ")})`;}
      function draw(){
        const {ctx:c,w,h}=Utils.setupCanvas(canvas), dark=matchMedia("(prefers-color-scheme: dark)").matches, fg=Utils.css("--muted"), grid=Utils.css("--line");
        c.clearRect(0,0,w,h);const origin={x:w*.5+offset.x,y:h*.54+offset.y}, scale=viewScale, X=x=>origin.x+x*scale,Y=y=>origin.y-y*scale;
        c.strokeStyle=grid;c.lineWidth=1;for(let x=origin.x%scale;x<w;x+=scale){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=origin.y%scale;y<h;y+=scale){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
        c.strokeStyle=fg;c.beginPath();c.moveTo(0,origin.y);c.lineTo(w,origin.y);c.moveTo(origin.x,0);c.lineTo(origin.x,h);c.stroke();c.fillStyle=fg;c.font="11px system-ui";for(let x=origin.x+scale;x<w;x+=scale)c.fillText(`${Math.round((x-origin.x)/scale)}`,x-4,origin.y+14);for(let y=origin.y-scale;y>0;y-=scale)c.fillText(`${Math.round((origin.y-y)/scale)}`,origin.x+5,y+4);c.fillText("x",w-14,origin.y-8);c.fillText("y",origin.x+8,12);
        vectors.forEach((v,i)=>{const px=X(v[0]),py=Y(v[1]);if($("componentsToggle").checked){c.save();c.setLineDash([4,4]);c.strokeStyle=colors[i];c.globalAlpha=.55;c.beginPath();c.moveTo(origin.x,py);c.lineTo(px,py);c.moveTo(px,py);c.lineTo(px,origin.y);c.stroke();c.restore();}
          Utils.arrow(c,origin.x,origin.y,px,py,colors[i],3);c.fillStyle=colors[i];c.font="bold 13px system-ui";c.fillText(names[i],px+6,py-7);});
        const result=calculate();
        if(result.result && result.result.length>=2 && result.result.slice(0,2).every(Number.isFinite)){
          const R=result.result, isSum=result.op==="sum";
          if(isSum && $("vectorMethod").value==="polygon" && vectors.length>=2){let x=0,y=0;c.save();vectors.forEach((v,i)=>{const nx=x+v[0],ny=y+v[1];Utils.arrow(c,X(x),Y(y),X(nx),Y(ny),colors[i],2);x=nx;y=ny;});c.restore();}
          if(isSum && $("vectorMethod").value==="parallelogram" && vectors.length===2){const [a,b]=vectors;c.strokeStyle=colors[1];c.setLineDash([5,4]);c.beginPath();c.moveTo(X(a[0]),Y(a[1]));c.lineTo(X(a[0]+b[0]),Y(a[1]+b[1]));c.moveTo(X(b[0]),Y(b[1]));c.lineTo(X(a[0]+b[0]),Y(a[1]+b[1]));c.stroke();c.setLineDash([]);}
          Utils.arrow(c,origin.x,origin.y,X(R[0]),Y(R[1]),dark?"#ff7b88":"#c43b48",4);c.fillStyle=dark?"#ff7b88":"#c43b48";c.font="bold 13px system-ui";c.fillText("R",X(R[0])+7,Y(R[1])-7);
        }
      }
      function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
      canvas.addEventListener("pointerdown",e=>{const p=pointerPos(e),origin={x:canvas.clientWidth*.5+offset.x,y:canvas.clientHeight*.54+offset.y};let best=18;vectors.forEach((v,i)=>{const d=Math.hypot(origin.x+v[0]*viewScale-p.x,origin.y-v[1]*viewScale-p.y);if(d<best){best=d;dragIndex=i;}});if(dragIndex>=0)canvas.setPointerCapture(e.pointerId);});
      canvas.addEventListener("pointermove",e=>{if(dragIndex<0)return;const p=pointerPos(e),origin={x:canvas.clientWidth*.5+offset.x,y:canvas.clientHeight*.54+offset.y};vectors[dragIndex][0]=Math.round((p.x-origin.x)/viewScale*10)/10;vectors[dragIndex][1]=Math.round((origin.y-p.y)/viewScale*10)/10;renderRows();update();});
      canvas.addEventListener("pointerup",()=>{dragIndex=-1;});
      canvas.addEventListener("wheel",e=>{e.preventDefault();viewScale=Math.max(10,Math.min(55,viewScale*(e.deltaY<0?1.1:.9)));draw();},{passive:false});
      let answerProblem=null;
      $("vectorChallenge").addEventListener("click",()=>{const a=[Math.floor(Math.random()*9)-4,Math.floor(Math.random()*9)-4],b=[Math.floor(Math.random()*9)-4,Math.floor(Math.random()*9)-4];answerProblem={a,b,r:[a[0]+b[0],a[1]+b[1]]};vectors=[a.concat(0),b.concat(0)];$("vectorOperation").value="sum";$("vectorQuestion").textContent=`Calcula A + B, si A = (${a.join(", ")}) y B = (${b.join(", ")}).`; $("vectorAnswer").value="";$("vectorMsg").textContent="";renderRows();update();});
      $("checkVectorAnswer").addEventListener("click",()=>{if(!answerProblem){$("vectorMsg").textContent="Genera primero un problema aleatorio.";return;}const raw=$("vectorAnswer").value.split(/[,\s]+/).map(Number);if(raw.length<2||raw.slice(0,2).some(n=>!Number.isFinite(n))){$("vectorMsg").textContent="Escribe dos componentes numéricas separadas por coma.";return;}const ok=Math.abs(raw[0]-answerProblem.r[0])<.01&&Math.abs(raw[1]-answerProblem.r[1])<.01;if(ok)score++;$("vectorScore").textContent=`Aciertos: ${score}`;$("vectorMsg").textContent=ok?"¡Correcto!":`Aún no. La suma es (${answerProblem.r.join(", ")}).`;});
      window.addEventListener("resize",draw);
      renderRows();update();
      return {draw};
    })();

    // Herramientas de circuitos: redes resistivas, mallas, Ohm y problemas.
    const CircuitLab = (() => {
      const $=id=>document.getElementById(id), canvas=$("circuitCanvas");
      let lastCircuit=null, animationFrame=0, quiz=null, score=0;
      const builderCanvas=$("builderCanvas");
      const builderParts=[];
      let builderResult=null, builderAnimationFrame=0, nextPartId=1;
      function resize(){
        if(!$("panel-resistors").classList.contains("hidden"))drawCircuit();
        if(!$("panel-builder").classList.contains("hidden"))drawBuilder();
      }
      function renderBuilderParts(){
        const list=$("builderComponents");
        if(!builderParts.length){
          list.innerHTML='<p class="footnote">Todavía no hay componentes. Usa los botones para empezar.</p>';
          drawBuilder();
          return;
        }
        list.innerHTML=builderParts.map((part,index)=>`<div class="builder-row">
          <label for="builderPart${part.id}">${part.type==="bulb"?"Foco":"Resistencia"} ${index+1} (Ω)</label>
          <div class="resistor-field"><input id="builderPart${part.id}" type="number" min="0.001" step="any" value="${Number.isFinite(part.resistance)?part.resistance:""}" data-builder-part="${part.id}" aria-label="Resistencia del componente ${index+1} en ohmios">
          <button class="delete-btn" type="button" data-remove-builder-part="${part.id}" aria-label="Quitar componente ${index+1}">×</button></div>
        </div>`).join("");
        drawBuilder();
      }
      function clearBuilderResults(){
        builderResult=null;
        $("builderResults").innerHTML="";
        $("builderComponentResults").innerHTML="";
        $("builderSolution").textContent="Agrega al menos un componente y pulsa «Simular circuito».";
      }
      function simulateBuilder(){
        const voltage=Number($("builderVoltage").value), config=$("builderConfig").value, msg=$("builderMsg");
        const resistances=builderParts.map(part=>part.resistance);
        if(!builderParts.length){msg.textContent="Agrega al menos una resistencia o un foco.";clearBuilderResults();drawBuilder();return;}
        if(!Number.isFinite(voltage)||voltage<=0||resistances.some(value=>!Number.isFinite(value)||value<=0)){
          msg.textContent="Ingresa un voltaje positivo y resistencias mayores que cero.";
          clearBuilderResults();drawBuilder();return;
        }
        const isOn=$("builderSwitch").checked;
        let equivalent;
        if(config==="series")equivalent=resistances.reduce((sum,value)=>sum+value,0);
        else {
          const conductance=resistances.reduce((sum,value)=>sum+1/value,0);
          equivalent=1/conductance;
        }
        const totalCurrent=isOn?voltage/equivalent:0;
        const rows=builderParts.map((part,index)=>{
          const current=isOn?(config==="series"?totalCurrent:voltage/part.resistance):0;
          const drop=isOn?(config==="series"?current*part.resistance:voltage):0;
          return {name:`${part.type==="bulb"?"Foco":"Resistencia"} ${index+1}`,resistance:part.resistance,voltage:drop,current,power:drop*current,type:part.type};
        });
        if(!Number.isFinite(equivalent)||!Number.isFinite(totalCurrent)||rows.some(row=>![row.voltage,row.current,row.power].every(Number.isFinite))){
          msg.textContent="Esos valores están fuera del rango que puede calcular el simulador.";
          clearBuilderResults();drawBuilder();return;
        }
        builderResult={voltage,config,equivalent,totalCurrent,rows,isOn};
        msg.textContent="";
        $("builderResults").innerHTML=`<div class="stat"><span>Resistencia equivalente</span><strong>${isOn?Utils.eng(equivalent):"Circuito abierto"}</strong></div>
          <div class="stat"><span>Corriente total</span><strong>${Utils.eng(totalCurrent,"A")}</strong></div>
          <div class="stat"><span>Voltaje de la pila</span><strong>${Utils.eng(voltage,"V")}</strong></div>
          <div class="stat"><span>Potencia total</span><strong>${Utils.eng(voltage*totalCurrent,"W")}</strong></div>`;
        $("builderComponentResults").innerHTML=`<table><thead><tr><th>Componente</th><th>R</th><th>V</th><th>I</th><th>P</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.name}</td><td>${Utils.eng(row.resistance)}</td><td>${Utils.eng(row.voltage,"V")}</td><td>${Utils.eng(row.current,"A")}</td><td>${Utils.eng(row.power,"W")}</td></tr>`).join("")}</tbody></table>`;
        const formula=config==="series"
          ?`Req = ${resistances.map(value=>Utils.eng(value)).join(" + ")} = ${Utils.eng(equivalent)}.\nEn serie, la corriente es igual en todos los componentes.`
          :`1/Req = ${resistances.map(value=>`1/${Utils.eng(value)}`).join(" + ")}; Req = ${Utils.eng(equivalent)}.\nEn paralelo, cada rama tiene el voltaje de la pila.`;
        $("builderSolution").textContent=`${formula}\n${isOn
          ?`Ley de Ohm: I = V/Req = ${Utils.eng(voltage,"V")}/${Utils.eng(equivalent)} = ${Utils.eng(totalCurrent,"A")}.\nLa corriente convencional sale del polo positivo de la pila.`
          :"El interruptor está abierto: no hay un camino cerrado, así que la corriente es cero y los focos están apagados."}`;
        $("builderSwitchState").textContent=isOn?"encendido":"apagado";
        drawBuilder();
      }
      function addBuilderPart(type){
        if(builderParts.length>=6){$("builderMsg").textContent="Puedes agregar hasta seis componentes.";return;}
        builderParts.push({id:nextPartId++,type,resistance:type==="bulb"?20:10});
        $("builderMsg").textContent="";
        renderBuilderParts();
        if(builderResult)simulateBuilder();
      }
      $("addBuilderResistor").addEventListener("click",()=>addBuilderPart("resistor"));
      $("addBuilderBulb").addEventListener("click",()=>addBuilderPart("bulb"));
      $("clearBuilder").addEventListener("click",()=>{
        builderParts.length=0;
        $("builderSwitch").checked=false;
        $("builderSwitchState").textContent="apagado";
        $("builderMsg").textContent="";
        clearBuilderResults();
        renderBuilderParts();
      });
      $("builderComponents").addEventListener("click",event=>{
        const button=event.target.closest("[data-remove-builder-part]");
        if(!button)return;
        const index=builderParts.findIndex(part=>part.id===Number(button.dataset.removeBuilderPart));
        if(index>=0)builderParts.splice(index,1);
        $("builderMsg").textContent="";
        renderBuilderParts();
        if(builderResult)simulateBuilder();
      });
      $("builderComponents").addEventListener("change",event=>{
        const input=event.target.closest("[data-builder-part]");
        if(!input)return;
        const part=builderParts.find(item=>item.id===Number(input.dataset.builderPart));
        if(part)part.resistance=Number(input.value);
        simulateBuilder();
      });
      $("builderVoltage").addEventListener("change",()=>{if(builderResult)simulateBuilder();});
      $("builderConfig").addEventListener("change",()=>{if(builderResult)simulateBuilder();});
      $("builderSwitch").addEventListener("change",()=>{
        $("builderSwitchState").textContent=$("builderSwitch").checked?"encendido":"apagado";
        if(builderParts.length)simulateBuilder();else drawBuilder();
      });
      $("builderAnimation").addEventListener("change",drawBuilder);
      $("simulateBuilder").addEventListener("click",simulateBuilder);
      function drawBuilder(){
        const {ctx:c,w,h}=Utils.setupCanvas(builderCanvas),fg=Utils.css("--text"),wire=Utils.css("--muted"),accent=Utils.css("--amber");
        c.clearRect(0,0,w,h);
        if(!builderParts.length){
          c.fillStyle=wire;c.font="15px system-ui";c.textAlign="center";
          c.fillText("Tu circuito está vacío. Agrega una resistencia o un foco para empezar.",w/2,h/2);
          c.textAlign="start";cancelAnimationFrame(builderAnimationFrame);return;
        }
        const config=$("builderConfig").value,isOn=$("builderSwitch").checked,center=h/2,left=44,right=w-30;
        const top=68,bottom=h-48,sourceX=left+8;
        c.strokeStyle=fg;c.lineWidth=2;c.beginPath();
        if(config==="series"){
          c.moveTo(sourceX,top);c.lineTo(right,top);c.lineTo(right,bottom);c.lineTo(sourceX,bottom);
          c.moveTo(sourceX,top);c.lineTo(sourceX,center-14);c.moveTo(sourceX,center+14);c.lineTo(sourceX,bottom);
        }else{
          c.moveTo(sourceX,top);c.lineTo(right,top);c.moveTo(sourceX,bottom);c.lineTo(right,bottom);
          c.moveTo(sourceX,top);c.lineTo(sourceX,center-14);c.moveTo(sourceX,center+14);c.lineTo(sourceX,bottom);
        }
        c.stroke();
        c.strokeStyle=accent;c.lineWidth=3;c.beginPath();
        c.moveTo(sourceX-9,center-6);c.lineTo(sourceX+9,center-6);
        c.moveTo(sourceX-5,center+6);c.lineTo(sourceX+5,center+6);c.stroke();
        c.fillStyle=fg;c.font="12px system-ui";c.fillText(`${Utils.fmt(Number($("builderVoltage").value))} V`,sourceX+13,center+4);
        if(config==="series"){
          const gap=(right-sourceX)/(builderParts.length+1);
          builderParts.forEach((part,index)=>drawBuilderPart(c,sourceX+gap*(index+1),top,part,index,isOn,false));
        }else{
          const gap=(bottom-top)/(builderParts.length+1);
          builderParts.forEach((part,index)=>{
            const y=top+gap*(index+1),x=(sourceX+right)/2;
            c.strokeStyle=fg;c.beginPath();c.moveTo(sourceX,y);c.lineTo(x-25,y);c.moveTo(x+25,y);c.lineTo(right,y);c.stroke();
            drawBuilderPart(c,x,y,part,index,isOn,true);
          });
        }
        c.fillStyle=wire;c.font="12px system-ui";c.fillText(isOn?"Interruptor cerrado":"Interruptor abierto",left,20);
        if($("builderAnimation").checked&&isOn){
          const travel=Math.max(1,right-sourceX),phase=(performance.now()/24)%travel;
          c.fillStyle=accent;c.beginPath();c.arc(sourceX+phase,top,4,0,Math.PI*2);c.fill();
          cancelAnimationFrame(builderAnimationFrame);builderAnimationFrame=requestAnimationFrame(drawBuilder);
        }else cancelAnimationFrame(builderAnimationFrame);
      }
      function drawBuilderPart(c,x,y,part,index,isOn,vertical){
        c.save();c.translate(x,y);if(vertical)c.rotate(Math.PI/2);
        c.strokeStyle=Utils.css("--text");c.lineWidth=2;c.beginPath();
        if(part.type==="bulb"){
          const radius=13;c.moveTo(-25,0);c.lineTo(-radius,0);c.moveTo(radius,0);c.lineTo(25,0);c.stroke();
          c.beginPath();c.arc(0,0,radius,0,Math.PI*2);
          const row=builderResult&&builderResult.rows.find(item=>item.name===`${part.type==="bulb"?"Foco":"Resistencia"} ${index+1}`);
          if(isOn&&row&&row.power>0){c.shadowColor="#ffc928";c.shadowBlur=Math.min(28,8+row.power*3);c.fillStyle="#ffd84d";c.fill();}
          c.stroke();c.shadowBlur=0;c.strokeStyle="#8b6b13";c.lineWidth=1.5;c.beginPath();c.moveTo(-5,-6);c.lineTo(5,6);c.moveTo(-5,6);c.lineTo(5,-6);c.stroke();
        }else{
          c.moveTo(-25,0);c.lineTo(-18,0);c.lineTo(-12,-8);c.lineTo(-4,8);c.lineTo(4,-8);c.lineTo(12,8);c.lineTo(18,0);c.lineTo(25,0);c.stroke();
        }
        c.restore();
        c.fillStyle=Utils.css("--text");c.font="11px system-ui";
        if(vertical){
          c.textAlign="left";
          c.fillText(`${part.type==="bulb"?"F":"R"}${index+1}: ${Number.isFinite(part.resistance)?Utils.eng(part.resistance):"—"}`,x+31,y+4);
        }else{
          c.textAlign="center";
          c.fillText(`${part.type==="bulb"?"Foco":"R"}${index+1}`,x,y-18);
          c.fillStyle=Utils.css("--muted");c.fillText(Number.isFinite(part.resistance)?Utils.eng(part.resistance):"—",x,y+25);
        }
        c.textAlign="start";
      }
      function buildResistorInputs(){
        const count=Number($("resistorCount").value);
        $("resistorInputs").innerHTML=Array.from({length:count},(_,i)=>`<div><label for="res${i}">R${i+1}</label><div class="resistor-field"><input id="res${i}" type="number" min="0.001" step="any" value="${i===0?10:20}" aria-label="Valor resistencia ${i+1}"><select id="unit${i}" aria-label="Unidad resistencia ${i+1}"><option value="1">Ω</option><option value="1000">kΩ</option><option value="1000000">MΩ</option></select></div></div>`).join("");
      }
      $("resistorCount").addEventListener("change",buildResistorInputs);buildResistorInputs();
      function calculateResistors(){
        const n=Number($("resistorCount").value), voltage=Number($("sourceVoltage").value), config=$("circuitConfig").value;
        const rs=Array.from({length:n},(_,i)=>Number($(`res${i}`).value)*Number($(`unit${i}`).value));
        const msg=$("circuitMsg");
        if(!Number.isFinite(voltage)||voltage<=0||rs.some(r=>!Number.isFinite(r)||r<=0)){msg.textContent="Ingresa un voltaje positivo y resistencias numéricas mayores que cero.";return;}
        let req, branchR=[];
        if(config==="series"){req=rs.reduce((a,b)=>a+b,0);branchR=rs.slice();}
        else if(config==="parallel"){req=1/rs.reduce((a,b)=>a+1/b,0);branchR=rs.slice();}
        else if(n<3){msg.textContent="La configuración mixta requiere al menos tres resistencias.";return;}
        else {const parallel=1/(1/rs[0]+1/rs[1]);req=parallel+rs.slice(2).reduce((a,b)=>a+b,0);branchR=[parallel,...rs.slice(2)];}
        const totalI=voltage/req, rows=[];
        if(config==="series"){let current=totalI;rs.forEach((r,i)=>rows.push({name:`R${i+1}`,r,v:current*r,i:current,p:current*current*r}));}
        else if(config==="parallel"){rs.forEach((r,i)=>rows.push({name:`R${i+1}`,r,v:voltage,i:voltage/r,p:voltage*voltage/r}));}
        else {const vp=totalI*branchR[0], ip=vp/branchR[0];rs.slice(0,2).forEach((r,i)=>rows.push({name:`R${i+1}`,r,v:vp,i:vp/r,p:vp*vp/r}));rs.slice(2).forEach((r,j)=>{const cur=totalI;rows.push({name:`R${j+3}`,r,v:cur*r,i:cur,p:cur*cur*r});});}
        lastCircuit={config,voltage,rs,req,totalI,rows};
        msg.textContent=""; $("circuitResults").innerHTML=`<div class="stats">${[
          ["Resistencia equivalente",Utils.eng(req)],["Corriente total",Utils.eng(totalI,"A")],["Voltaje de fuente",`${Utils.fmt(voltage)} V`],["Potencia total",Utils.eng(voltage*totalI,"W")]
        ].map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join("")}</div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Elemento</th><th>R</th><th>V</th><th>I</th><th>P</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.name}</td><td>${Utils.eng(r.r)}</td><td>${Utils.eng(r.v,"V")}</td><td>${Utils.eng(r.i,"A")}</td><td>${Utils.eng(r.p,"W")}</td></tr>`).join("")}</tbody></table></div>`;
        const formula=config==="series"?"Req = ΣR":"parallel";
        $("circuitSolution").textContent=`Configuración: ${config==="mixed"?"mixta":config}.\n${config==="series"?`Req = ${rs.map(r=>Utils.eng(r)).join(" + ")} = ${Utils.eng(req)}`:config==="parallel"?`1/Req = ${rs.map(r=>`1/${Utils.eng(r)}`).join(" + ")}\nReq = ${Utils.eng(req)}`:`Rp = (${Utils.eng(rs[0])} × ${Utils.eng(rs[1])})/(${Utils.eng(rs[0])} + ${Utils.eng(rs[1])}) = ${Utils.eng(branchR[0])}\nReq = Rp + ${rs.slice(2).map(r=>Utils.eng(r)).join(" + ")} = ${Utils.eng(req)}`}\nLey de Ohm: I = V/Req = ${Utils.fmt(voltage)}/${Utils.fmt(req)} = ${Utils.eng(totalI,"A")}.\nPotencia total: P = VI = ${Utils.eng(voltage*totalI,"W")}.`;
        drawCircuit();
      }
      $("calculateCircuit").addEventListener("click",calculateResistors);
      $("currentAnimation").addEventListener("change",drawCircuit);
      document.querySelectorAll(".tab-btn").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab-btn").forEach(b=>{b.classList.toggle("active",b===btn);b.setAttribute("aria-selected",b===btn?"true":"false");});document.querySelectorAll(".circuit-panel").forEach(p=>p.classList.toggle("hidden",p.id!==`panel-${btn.dataset.tab}`));if(btn.dataset.tab==="resistors")drawCircuit();if(btn.dataset.tab==="builder")drawBuilder();}));
      function drawCircuit(){
        const {ctx:c,w,h}=Utils.setupCanvas(canvas), fg=Utils.css("--text"), line=Utils.css("--muted"), accent=Utils.css("--amber");c.clearRect(0,0,w,h);
        if(!lastCircuit){c.fillStyle=line;c.font="15px system-ui";c.fillText("Configura resistencias y pulsa «Calcular circuito».",18,35);return;}
        const y=h/2, x0=Math.max(35,w*.08), x1=w-x0, res=lastCircuit.rs, config=lastCircuit.config;
        c.strokeStyle=fg;c.lineWidth=2;c.beginPath();c.moveTo(x0,y);c.lineTo(x0,y-85);c.lineTo(x1,y-85);c.lineTo(x1,y);c.lineTo(x1,y+75);c.lineTo(x0,y+75);c.lineTo(x0,y);c.stroke();
        c.fillStyle=Utils.css("--surface");c.fillRect(x0-9,y-23,18,46);c.strokeStyle=accent;c.lineWidth=3;c.beginPath();c.moveTo(x0,y-12);c.lineTo(x0,y-2);c.moveTo(x0-8,y+2);c.lineTo(x0+8,y+2);c.moveTo(x0,y+8);c.lineTo(x0,y+18);c.stroke();c.fillStyle=fg;c.font="13px system-ui";c.fillText(`${Utils.fmt(lastCircuit.voltage)} V`,x0+12,y+7);
        const n=res.length;
        if(config==="series"){
          const space=(x1-x0-55)/(n+1);res.forEach((r,i)=>drawResistor(c,x0+30+(i+1)*space,y,r,`R${i+1}`));
        }else if(config==="parallel"){
          const branchGap=Math.min((h-125)/n,58), top=y-(n-1)*branchGap/2;
          for(let i=0;i<n;i++){const yy=top+i*branchGap;c.strokeStyle=fg;c.beginPath();c.moveTo(x0,yy);c.lineTo(x0+18,yy);c.moveTo(x1-18,yy);c.lineTo(x1,yy);c.stroke();drawResistor(c,(x0+x1)/2,yy,res[i],`R${i+1}`);}
          c.strokeStyle=fg;c.beginPath();c.moveTo(x0,y-85);c.lineTo(x0,top);c.moveTo(x1,y-85);c.lineTo(x1,top);c.moveTo(x0,top+(n-1)*branchGap);c.lineTo(x0,y);c.moveTo(x1,top+(n-1)*branchGap);c.lineTo(x1,y);c.stroke();
        }else{
          const mid=(x0+x1)/2;c.strokeStyle=fg;c.beginPath();c.moveTo(x0,y);c.lineTo(x0+12,y);c.lineTo(x0+12,y-30);c.lineTo(mid-22,y-30);c.moveTo(x0+12,y);c.lineTo(x0+12,y+30);c.lineTo(mid-22,y+30);c.moveTo(mid+22,y-30);c.lineTo(x1-12,y-30);c.lineTo(x1-12,y);c.moveTo(mid+22,y+30);c.lineTo(x1-12,y+30);c.lineTo(x1-12,y);c.stroke();
          drawResistor(mid,y-30,res[0],"R1");drawResistor(mid,y+30,res[1],"R2");res.slice(2).forEach((r,i)=>drawResistor(x0+35+(i+1)*(x1-x0-70)/(res.length-1),y,r,`R${i+3}`));
        }
        if($("currentAnimation").checked){const t=(performance.now()/28)%(x1-x0);c.fillStyle=accent;c.beginPath();c.arc(x0+t,y-85,4,0,Math.PI*2);c.fill();cancelAnimationFrame(animationFrame);animationFrame=requestAnimationFrame(drawCircuit);}
        else cancelAnimationFrame(animationFrame);
      }
      function drawResistor(c,x,y,r,name){
        c.strokeStyle=Utils.css("--amber");c.lineWidth=3;c.beginPath();c.moveTo(x-24,y);c.lineTo(x-17,y-9);c.lineTo(x-8,y+9);c.lineTo(x,y-9);c.lineTo(x+8,y+9);c.lineTo(x+17,y-9);c.lineTo(x+24,y);c.stroke();c.fillStyle=Utils.css("--text");c.font="12px system-ui";c.textAlign="center";c.fillText(name,x,y-16);c.fillText(Utils.eng(r),x,y+25);c.textAlign="start";
      }
      // Resuelve sistema 2x2 con eliminación gaussiana.
      function solveMesh(){
        const r1=Number($("meshR1").value),r2=Number($("meshR2").value),r3=Number($("meshShared").value),e1=Number($("meshE1").value),e2=Number($("meshE2").value);
        if([r1,r2,r3,e1,e2].some(n=>!Number.isFinite(n))||[r1,r2,r3].some(n=>n<=0)){ $("meshSolution").textContent="Usa resistencias positivas y valores numéricos válidos.";return;}
        let a=r1+r3,b=-r3,c=-r3,d=r2+r3,u=e1,v=e2;
        const factor=c/a,d2=d-factor*b,v2=v-factor*u,i2=v2/d2,i1=(u-b*i2)/a;
        $("meshResults").innerHTML=`<div class="stat"><span>Corriente de malla I₁</span><strong>${Utils.eng(i1,"A")}</strong></div><div class="stat"><span>Corriente de malla I₂</span><strong>${Utils.eng(i2,"A")}</strong></div><div class="stat"><span>Corriente por R₃ (I₁ − I₂)</span><strong>${Utils.eng(i1-i2,"A")}</strong></div>`;
        $("meshSolution").textContent=`Ecuaciones de malla:\n(${r1}+${r3})I₁ − ${r3}I₂ = ${e1}\n−${r3}I₁ + (${r2}+${r3})I₂ = ${e2}\n\nMatriz aumentada:\n[ ${a}  ${b} | ${u} ]\n[ ${c}  ${d} | ${v} ]\n\nF₂ ← F₂ − (${Utils.fmt(factor)})F₁\n[ ${a}  ${b} | ${u} ]\n[ 0  ${Utils.fmt(d2)} | ${Utils.fmt(v2)} ]\n\nI₂ = ${Utils.fmt(v2)}/${Utils.fmt(d2)} = ${Utils.eng(i2,"A")}\nI₁ = (${u} − (${b})·I₂)/${a} = ${Utils.eng(i1,"A")}`;
      }
      $("solveMesh").addEventListener("click",solveMesh);solveMesh();
      // Dos variables independientes bastan para determinar V, I, R y P.
      const ohmNames={V:"Voltaje (V)",I:"Corriente (A)",R:"Resistencia (Ω)",P:"Potencia (W)"};
      $("ohmFields").innerHTML=Object.entries(ohmNames).map(([key,name])=>`<label for="ohm${key}">${name}</label><input id="ohm${key}" type="number" step="any" placeholder="Vacío si se desconoce">`).join("");
      $("calculateOhm").addEventListener("click",()=>{
        const vals=Object.fromEntries(["V","I","R","P"].map(k=>[k,$(`ohm${k}`).value.trim()===""?null:Number($(`ohm${k}`).value)]));
        const known=Object.keys(vals).filter(k=>vals[k]!==null);
        if(known.length!==2||Object.values(vals).some(v=>v!==null&&!Number.isFinite(v))){$("ohmMsg").textContent="Ingresa exactamente dos valores numéricos.";return;}
        let {V,I,R,P}=vals;
        if(V!==null&&I!==null){if(I===0){$("ohmMsg").textContent="La corriente no puede ser cero para determinar R.";return;}R=V/I;P=V*I;}
        else if(V!==null&&R!==null){if(R===0){$("ohmMsg").textContent="La resistencia debe ser distinta de cero.";return;}I=V/R;P=V*I;}
        else if(V!==null&&P!==null){if(V===0){$("ohmMsg").textContent="El voltaje no puede ser cero para determinar I.";return;}I=P/V;R=V/I;}
        else if(I!==null&&R!==null){V=I*R;P=V*I;}
        else if(I!==null&&P!==null){if(I===0){$("ohmMsg").textContent="La corriente no puede ser cero para determinar R.";return;}V=P/I;R=V/I;}
        else if(R!==null&&P!==null){if(R<=0){$("ohmMsg").textContent="La resistencia debe ser positiva.";return;}V=Math.sqrt(P*R);I=V/R;}
        if([V,I,R,P].some(x=>!Number.isFinite(x))||R<=0){$("ohmMsg").textContent="Los valores no producen una solución física válida; verifica signos y magnitudes.";return;}
        $("ohmMsg").textContent="";$("ohmResults").textContent=`V = ${Utils.eng(V,"V")}\nI = ${Utils.eng(I,"A")}\nR = ${Utils.eng(R)}\nP = ${Utils.eng(P,"W")}\n\nComprobación: V = IR = ${Utils.fmt(I)} × ${Utils.fmt(R)} = ${Utils.fmt(I*R)} V.`;
      });
      // Ejercicio de resistencia equivalente para practicar redes serie/paralelo.
      function newQuestion(){
        const a=2+Math.floor(Math.random()*19),b=2+Math.floor(Math.random()*19),parallel=Math.random()<.5;
        const result=parallel?1/(1/a+1/b):a+b;
        quiz={a,b,parallel,result};$("circuitQuestion").textContent=`Dos resistencias de ${a} Ω y ${b} Ω están conectadas en ${parallel?"paralelo":"serie"}. ¿Cuál es la resistencia equivalente?`;
        $("circuitAnswer").value="";$("circuitQuizMsg").textContent="";$("circuitQuizSolution").textContent="";
      }
      $("newCircuitQuestion").addEventListener("click",newQuestion);
      $("checkCircuitAnswer").addEventListener("click",()=>{
        const answer=Number($("circuitAnswer").value);
        if(!quiz){$("circuitQuizMsg").textContent="Genera primero un problema.";return;}
        if(!Number.isFinite(answer)){$("circuitQuizMsg").textContent="Ingresa una respuesta numérica.";return;}
        const ok=Math.abs(answer-quiz.result)<=Math.max(.02,Math.abs(quiz.result)*.01);if(ok)score++;
        $("circuitScore").textContent=`Aciertos: ${score}`;$("circuitQuizMsg").textContent=ok?"¡Correcto!":`No exactamente. El resultado es ${Utils.fmt(quiz.result)} Ω.`;
        $("circuitQuizSolution").textContent=quiz.parallel?`1/Req = 1/${quiz.a} + 1/${quiz.b}\nReq = 1/(${Utils.fmt(1/quiz.a+1/quiz.b)}) = ${Utils.fmt(quiz.result)} Ω.`:`Req = R₁ + R₂ = ${quiz.a} + ${quiz.b} = ${quiz.result} Ω.`;
      });
      newQuestion();
      window.addEventListener("resize",resize);
      return {resize};
    })();

    // Péndulo doble: sistema caótico integrado con RK4 y comparado con un gemelo casi idéntico.
    const ChaosLab = (() => {
      const $ = id => document.getElementById(id), cv = $("chaosCanvas"), gc = $("chaosGraph");
      const st = { s: [], tr: [[], []], hist: [], t: 0, run: true, drag: false, on: false, E0: 0, w: 1, h: 1, last: 0, n: 0 };
      const par = () => ({ L1: +$("chL1").value, L2: +$("chL2").value, m1: +$("chM1").value, m2: +$("chM2").value, g: +$("chG").value });
      const valid = p => Object.values(p).every(v => Number.isFinite(v) && v > 0 && v <= 50);
      const geom = p => ({ k: Math.min(st.w * .4, st.h * .45) / (p.L1 + p.L2), px: st.w / 2, py: st.h * .3 });
      function deriv(p, a, b, wa, wb) {
        const d = a - b, den = 2*p.m1 + p.m2 - p.m2*Math.cos(2*d);
        return [wa, wb,
          (-p.g*(2*p.m1+p.m2)*Math.sin(a) - p.m2*p.g*Math.sin(a-2*b) - 2*Math.sin(d)*p.m2*(wb*wb*p.L2 + wa*wa*p.L1*Math.cos(d))) / (p.L1*den),
          2*Math.sin(d)*(wa*wa*p.L1*(p.m1+p.m2) + p.g*(p.m1+p.m2)*Math.cos(a) + wb*wb*p.L2*p.m2*Math.cos(d)) / (p.L2*den)];
      }
      function rk4(p, s, h) {
        const at = (k, c) => deriv(p, s.a+c*h*k[0], s.b+c*h*k[1], s.wa+c*h*k[2], s.wb+c*h*k[3]);
        const k1 = deriv(p, s.a, s.b, s.wa, s.wb), k2 = at(k1, .5), k3 = at(k2, .5), k4 = at(k3, 1);
        ["a", "b", "wa", "wb"].forEach((key, i) => s[key] += h/6*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
      }
      function energy(p, s) {
        const v1 = p.L1*s.wa, v2 = p.L2*s.wb;
        const T = .5*p.m1*v1*v1 + .5*p.m2*(v1*v1 + v2*v2 + 2*p.L1*p.L2*s.wa*s.wb*Math.cos(s.a-s.b));
        return T - p.g*((p.m1+p.m2)*p.L1*Math.cos(s.a) + p.m2*p.L2*Math.cos(s.b));
      }
      function pos(g, p, s) {
        const x1 = g.px + p.L1*g.k*Math.sin(s.a), y1 = g.py + p.L1*g.k*Math.cos(s.a);
        return [x1, y1, x1 + p.L2*g.k*Math.sin(s.b), y1 + p.L2*g.k*Math.cos(s.b)];
      }
      function setPose(a, b) {
        const p = par(); st.s = [0, .001].map(e => ({ a: a + e, b, wa: 0, wb: 0 }));
        st.tr = [[], []]; st.hist = []; st.t = 0; if (valid(p)) st.E0 = energy(p, st.s[0]);
      }
      function aim(x, y) {
        const p = par(); if (!valid(p)) return;
        const g = geom(p), l1 = p.L1*g.k, l2 = p.L2*g.k, dx = x - g.px, dy = y - g.py;
        const d = Math.max(Math.abs(l1-l2) + .5, Math.min(Math.hypot(dx, dy), l1 + l2 - .5));
        const dl = Math.acos(Math.max(-1, Math.min(1, (d*d - l1*l1 - l2*l2) / (2*l1*l2))));
        const a = Math.atan2(dx, dy) - Math.atan2(l2*Math.sin(dl), l1 + l2*Math.cos(dl));
        setPose(a, a + dl);
      }
      const xy = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); st.drag = true; aim(...xy(e)); });
      cv.addEventListener("pointermove", e => { if (st.drag) aim(...xy(e)); });
      cv.addEventListener("pointerup", () => { st.drag = false; });
      cv.addEventListener("pointercancel", () => { st.drag = false; });
      $("chaosPause").addEventListener("click", () => { st.run = !st.run; $("chaosPause").textContent = st.run ? "Pausar" : "Reanudar"; });
      $("chaosReset").addEventListener("click", () => setPose(2.2, 2.6));
      ["chL1", "chL2", "chM1", "chM2", "chG"].forEach(id => $(id).addEventListener("input", () => {
        const p = par(), ok = valid(p); $("chaosMsg").textContent = ok ? "" : "Usa valores entre 0 y 50 (mayores que cero).";
        if (ok) st.E0 = energy(p, st.s[0]);
      }));
      function drawScene(p) {
        const { ctx, w, h } = Utils.setupCanvas(cv); st.w = w; st.h = h; ctx.clearRect(0, 0, w, h);
        const g = geom(p), cols = [Utils.css("--blue"), Utils.css("--amber")], ink = Utils.css("--text");
        st.s.forEach((s, i) => {
          ctx.strokeStyle = cols[i]; ctx.globalAlpha = .55; ctx.lineWidth = 2; ctx.beginPath();
          st.tr[i].forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.globalAlpha = 1;
        });
        st.s.forEach((s, i) => {
          const [x1, y1, x2, y2] = pos(g, p, s);
          ctx.strokeStyle = ink; ctx.lineWidth = i ? 1.5 : 3; ctx.globalAlpha = i ? .6 : 1;
          ctx.beginPath(); ctx.moveTo(g.px, g.py); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
          [[x1, y1, 5 + p.m1], [x2, y2, 5 + p.m2]].forEach(([x, y, r]) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(x, y, Math.min(r, 16), 0, 7); ctx.fill(); });
        });
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(g.px, g.py, 5, 0, 7); ctx.fill();
      }
      function drawGraph() {
        const { ctx, w, h } = Utils.setupCanvas(gc); ctx.clearRect(0, 0, w, h);
        const H = st.hist, muted = Utils.css("--muted"); if (H.length < 2) return;
        const t1 = Math.max(20, st.t), t0 = t1 - 20, ymax = Math.max(1, ...H.map(q => q[1])) * 1.1, L = 38, B = 22;
        ctx.strokeStyle = Utils.css("--line"); ctx.fillStyle = muted; ctx.font = "11px system-ui"; ctx.lineWidth = 1;
        ctx.strokeRect(L, 6, w - L - 8, h - B - 6); ctx.fillText(Utils.fmt(ymax, 0) + "°", 2, 16); ctx.fillText("0", 24, h - B); ctx.fillText("t (s)", w - 38, h - 6);
        ctx.strokeStyle = Utils.css("--danger"); ctx.lineWidth = 2; ctx.beginPath(); let first = true;
        H.forEach(([t, d]) => { if (t < t0) return; const x = L + (t - t0) / 20 * (w - L - 8), y = h - B - d / ymax * (h - B - 6); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; });
        ctx.stroke();
      }
      function stats(p) {
        const E = energy(p, st.s[0]), dr = st.E0 ? (E - st.E0) / Math.abs(st.E0) * 100 : 0, dg = 180 / Math.PI, s = st.s[0];
        const items = [["Energía total E", Utils.fmt(E, 3) + " J"], ["Deriva de energía", Utils.fmt(dr, 4) + " %"], ["θ₁ (azul)", Utils.fmt(s.a * dg, 1) + "°"], ["θ₂ (azul)", Utils.fmt(s.b * dg, 1) + "°"],
          ["|Δθ₂| entre gemelos", Utils.fmt(Math.abs(st.s[1].b - s.b) * dg, 3) + "°"], ["Tiempo t", Utils.fmt(st.t, 1) + " s"]];
        $("chaosStats").innerHTML = items.map(([n, v]) => `<div class="stat"><span>${n}</span><strong>${v}</strong></div>`).join("");
      }
      function tick(now) {
        if (!st.on) return; requestAnimationFrame(tick);
        const dt = Math.min((now - st.last) / 1000 || .016, .033); st.last = now; const p = par();
        if (valid(p)) {
          if (st.run && !st.drag) {
            for (let i = 0; i < 16; i++) st.s.forEach(s => rk4(p, s, dt / 16));
            st.t += dt; const g = geom(p);
            st.s.forEach((s, i) => { const q = pos(g, p, s); st.tr[i].push([q[2], q[3]]); if (st.tr[i].length > 380) st.tr[i].shift(); });
            st.hist.push([st.t, Math.abs(st.s[1].b - st.s[0].b) * 180 / Math.PI]); if (st.hist.length > 4000) st.hist.shift();
          }
          drawScene(p); drawGraph(); if (++st.n % 6 === 0) stats(p);
        }
      }
      function start() { if (st.on) return; st.on = true; st.last = performance.now(); if (!st.s.length) setPose(2.2, 2.6); requestAnimationFrame(tick); }
      function stop() { st.on = false; }
      return { start, stop };
    })();
    // Estado inicial y primer dibujo del diagrama eléctrico de ejemplo.
    document.getElementById("calculateCircuit").click();
