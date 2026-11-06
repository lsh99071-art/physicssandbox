<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Physics Sandbox 전체 수정 파일 생성</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f3f6ef;color:#213c2b;font:15px/1.8 system-ui,sans-serif}
main{max-width:900px;margin:30px auto;padding:22px}
section{background:#fff;border:1px solid #d9e3d3;border-radius:16px;padding:22px;margin:18px 0}
h1{font-size:26px;line-height:1.4}
button,input{font:inherit}
button{padding:11px 16px;border:1px solid #a9c2a0;border-radius:9px;background:#fff;color:#24432d;cursor:pointer;margin:5px}
button.primary{background:#19794e;color:#fff}
button:disabled{opacity:.45;cursor:not-allowed}
textarea{width:100%;height:320px;font:12px/1.5 monospace;padding:12px;border:1px solid #cbd8c3;border-radius:10px}
#status{white-space:pre-line;padding:14px;background:#eaf3e4;border-radius:10px}
small{color:#63795b}
label{display:block;margin:14px 0}
</style>
</head>
<body>
<main>
<h1>Physics Sandbox — 전체 app.js 생성</h1>
<p>현재 원본을 읽어 거리 기반 관찰과 8단계 풀이가 포함된 전체 파일을 만듭니다.</p>
<section>
<ol>
<li>아래 버튼으로 현재 GitHub 원본을 읽습니다.</li>
<li>생성이 완료되면 app.js 전체를 저장하거나 복사합니다.</li>
<li>기존 app.js 전체와 교체합니다. index.html과 styles.css는 유지합니다.</li>
</ol>
<button id="fetchSource" class="primary">현재 GitHub 파일 읽고 생성</button>
<label>또는 현재 app.js 파일 선택
<input id="sourceFile" type="file" accept=".js,text/javascript,application/javascript">
</label>
<p id="status" role="status">아직 파일을 생성하지 않았습니다.</p>
</section>
<section>
<button id="download" class="primary" disabled>app.js 전체 저장</button>
<button id="copy" disabled>전체 코드 복사</button>
<p><small>아래에는 수정된 파일의 전체 내용이 표시됩니다.</small></p>
<textarea id="output" readonly aria-label="수정된 app.js 전체 코드"></textarea>
</section>
</main>

<script>
"use strict";
(() => {

function quadraticTimes(c0,c1,c2,h){
  const roots=[];
  if(Math.abs(c2)<1e-13){
    if(Math.abs(c1)>1e-13)roots.push(-c0/c1);
  }else{
    const d=c1*c1-4*c2*c0;
    if(d>=0){
      const sq=Math.sqrt(Math.max(0,d));
      const q=-.5*(c1+(c1>=0?sq:-sq));
      if(Math.abs(q)>1e-14)roots.push(q/c2,c0/q);
      else roots.push(-c1/(2*c2));
    }
  }
  return roots.filter(t=>
    Number.isFinite(t)&&t>=-1e-10&&t<=h+1e-10
  ).map(t=>Math.max(0,t)).sort((a,b)=>a-b);
}

function surfaceAxes(p){
  const a=p.angle*Math.PI/180;
  return {
    tx:Math.cos(a),ty:Math.sin(a),
    nx:-Math.sin(a),ny:Math.cos(a)
  };
}

function physicalRest(e){
  const s=e.phase?.solution||e.solution;
  return s.reliable&&e.dynamic.every(n=>
    hypot(n.vx,n.vy)<1e-8&&
    hypot(s.values.get(n.id).ax,s.values.get(n.id).ay)<1e-7
  );
}

function projectedState(n,a,t){
  return {
    x:n.x+n.vx*t+.5*a.ax*t*t,
    y:n.y+n.vy*t+.5*a.ay*t*t,
    vx:n.vx+a.ax*t,
    vy:n.vy+a.ay*t
  };
}

function firstCrossing(fn,h){
  let t0=0,f0=fn(0);
  if(f0<=1e-10&&fn(Math.min(h,1e-7))<f0-1e-12)return 0;
  for(let i=1;i<=12;i++){
    const t1=h*i/12,f1=fn(t1);
    if(f0>0&&f1<=0){
      let lo=t0,hi=t1;
      for(let k=0;k<48;k++){
        const mid=(lo+hi)/2;
        if(fn(mid)>0)lo=mid;else hi=mid;
      }
      return hi;
    }
    t0=t1;f0=f1;
  }
  return null;
}

function nextPhysicalEvent(e,h){
  const s=e.phase.solution;
  if(!s.constant)return null;
  const events=[];
  const add=(t,kind,label,data={})=>{
    if(t!==null&&t>=0&&t<=h+1e-9){
      events.push({time:t,kind,label,...data});
    }
  };
  const pos=(n,t)=>DYNAMIC(n)
    ?projectedState(n,s.values.get(n.id),t):n;

  for(const n of e.dynamic){
    const acc=s.values.get(n.id);
    for(const p of e.nodes.filter(SURFACE)){
      if(e.departed?.has(n.id+"|"+p.id))continue;
      const u=surfaceAxes(p);
      const dx=n.x-p.x,dy=n.y-p.y;
      const along=dx*u.tx+dy*u.ty;
      const gap=dx*u.nx+dy*u.ny-n.radius;
      const vt=n.vx*u.tx+n.vy*u.ty;
      const at=acc.ax*u.tx+acc.ay*u.ty;
      const vn=n.vx*u.nx+n.vy*u.ny;
      const an=acc.ax*u.nx+acc.ay*u.ny;
      const support=s.contacts.find(r=>
        r.bodyId===n.id&&r.surfaceId===p.id
      );

      if(support){
        for(const side of [-1,1]){
          const roots=quadraticTimes(
            along-side*p.length/2,vt,.5*at,h
          );
          for(const t of roots){
            if(side*(vt+at*t)>1e-8){
              add(
                t,"edge",
                `${n.name}가 ${p.name}의 끝에 도달했습니다.`,
                {bodyId:n.id,surfaceId:p.id,side}
              );
              break;
            }
          }
        }
        if(Math.min(n.mu,p.mu)>0&&
           Math.abs(vt)>1e-8&&vt*at<0){
          add(
            -vt/at,
            "friction-stop",
            `${n.name}의 미끄럼 속도가 0이 되어 정지 마찰 조건을 다시 계산했습니다.`,
            {bodyId:n.id,surfaceId:p.id}
          );
        }
      }else if(gap>=-1e-6){
        for(const t of quadraticTimes(gap,vn,.5*an,h)){
          const q=pos(n,t);
          const tangent=(q.x-p.x)*u.tx+(q.y-p.y)*u.ty;
          if(vn+an*t< -1e-8&&
             Math.abs(tangent)<=p.length/2+1e-8){
            add(
              t,"impact",
              `${n.name}가 ${p.name}에 도달했습니다. 반발계수 0으로 충돌을 처리했습니다.`,
              {bodyId:n.id,surfaceId:p.id}
            );
            break;
          }
        }
      }
    }
  }

  for(let i=0;i<e.dynamic.length;i++){
    for(let j=i+1;j<e.dynamic.length;j++){
      const a=e.dynamic[i],b=e.dynamic[j];
      const radius=a.radius+b.radius;
      const t=firstCrossing(t=>{
        const p=pos(a,t),q=pos(b,t);
        return hypot(p.x-q.x,p.y-q.y)-radius;
      },h);
      add(
        t,"pair-impact",
        `${a.name}와 ${b.name}가 접촉했습니다. 반발계수 0으로 충돌을 처리했습니다.`,
        {bodyId:a.id,otherId:b.id}
      );
    }
  }

  for(const r of e.model.ropes){
    for(let i=1;i<r.path.length;i++){
      const a=e.map.get(r.path[i-1]),b=e.map.get(r.path[i]);
      const t=firstCrossing(t=>{
        const p=pos(a,t),q=pos(b,t);
        return hypot(p.x-q.x,p.y-q.y)-.05;
      },h);
      add(
        t,"model-limit",
        `${r.name}의 인접 연결점 간격이 0.05 m가 되었습니다. 점 도르래 모형의 경로 방향을 정의할 수 없어 지원 한계에서 멈춥니다.`,
        {ropeId:r.id}
      );
    }
  }
  return events.sort((a,b)=>a.time-b.time)[0]||null;
}

function publishCurrentPhase(e){
  const s=e.phase.solution;
  for(const n of e.dynamic){
    const value=s.values.get(n.id);
    n.ax=value.ax;
    n.ay=value.ay;
    n.forces=s.reliable?copy(value.forces):[
      {kind:"gravity",name:"mg",x:0,y:-n.m*e.model.g},
      {kind:"external",name:"F",x:n.fx,y:n.fy}
    ];
  }
  e.rows=s.rows.map(r=>({
    ...r,impulse:r.force*(e.lastH||DT)
  }));
  e.residual=s.residual*(e.lastH||DT);
}

function resolveInstantImpact(e){
  const rows=makeRows(e,DT).filter(r=>
    r.kind==="friction"
      ?r.parent.gap<=1e-7
      :r.gap<=1e-7
  );
  for(let pass=0;pass<800;pass++){
    let largest=0;
    for(const r of rows){
      if(r.diag<1e-12)continue;
      const old=r.impulse;
      const next=old-dotVelocity(r,e.map)/r.diag;
      r.impulse=r.kind==="friction"
        ?clamp(next,-r.mu*r.parent.impulse,r.mu*r.parent.impulse)
        :Math.max(0,next);
      applyImpulse(r,r.impulse-old,e.map);
      largest=Math.max(largest,Math.abs(r.impulse-old));
    }
    if(largest<1e-12)break;
  }
  e.lastImpact=rows.filter(r=>
    Math.abs(r.impulse)>1e-9
  ).map(r=>({name:r.label,impulse:r.impulse}));
}

function rebasePhase(e){
  e.phase={solution:solveProblem(e),start:e.time};
  publishCurrentPhase(e);
}

function handlePhysicalEvent(e,event){
  const n=e.map.get(event.bodyId);
  const p=e.map.get(event.surfaceId);

  if(event.kind==="edge"&&n&&p){
    const u=surfaceAxes(p);
    const along=(n.x-p.x)*u.tx+(n.y-p.y)*u.ty;
    n.x+=(event.side*p.length/2-along)*u.tx;
    n.y+=(event.side*p.length/2-along)*u.ty;
    e.departed.add(n.id+"|"+p.id);
  }

  if(event.kind==="impact"&&n&&p){
    const u=surfaceAxes(p);
    const gap=(n.x-p.x)*u.nx+(n.y-p.y)*u.ny-n.radius;
    n.x-=gap*u.nx;
    n.y-=gap*u.ny;
  }

  if(event.kind==="friction-stop"&&n&&p){
    const u=surfaceAxes(p);
    const vt=n.vx*u.tx+n.vy*u.ty;
    n.vx-=vt*u.tx;
    n.vy-=vt*u.ty;
  }

  if(["impact","pair-impact","friction-stop"].includes(event.kind)){
    resolveInstantImpact(e);
  }

  e.phaseEnded=true;
  e.phaseReason=event.label;
  if(event.kind!=="model-limit")rebasePhase(e);

  const rest=physicalRest(e);
  e.event=event.label;
  e.stopInfo={
    kind:event.kind==="model-limit"?"limit":rest?"rest":"transition",
    physicalRest:rest,
    text:event.label,
    eventKind:event.kind
  };
}

function forecastPhysicalEvent(e){
  const s=e.phase?.solution||e.solution;
  if(!s.constant)return null;
  const events=[],h=Number.MAX_SAFE_INTEGER;

  for(const n of e.dynamic){
    const a=s.values.get(n.id);
    for(const p of e.nodes.filter(SURFACE)){
      if(e.departed?.has(n.id+"|"+p.id))continue;
      const u=surfaceAxes(p);
      const dx=n.x-p.x,dy=n.y-p.y;
      const along=dx*u.tx+dy*u.ty;
      const gap=dx*u.nx+dy*u.ny-n.radius;
      const vt=n.vx*u.tx+n.vy*u.ty;
      const at=a.ax*u.tx+a.ay*u.ty;
      const vn=n.vx*u.nx+n.vy*u.ny;
      const an=a.ax*u.nx+a.ay*u.ny;
      const supported=s.contacts.some(r=>
        r.bodyId===n.id&&r.surfaceId===p.id
      );

      if(supported){
        for(const side of [-1,1]){
          for(const t of quadraticTimes(
            along-side*p.length/2,vt,.5*at,h
          )){
            if(t>1e-9&&side*(vt+at*t)>1e-8){
              events.push({
                time:t,label:`${n.name}: ${p.name} 끝 도달`
              });
              break;
            }
          }
        }
        if(Math.min(n.mu,p.mu)>0&&
           Math.abs(vt)>1e-8&&vt*at<0){
          events.push({
            time:-vt/at,label:`${n.name}: 마찰로 정지`
          });
        }
      }else if(gap>=-1e-6){
        for(const t of quadraticTimes(gap,vn,.5*an,h)){
          const q=projectedState(n,a,t);
          const alongAt=(q.x-p.x)*u.tx+(q.y-p.y)*u.ty;
          if(t>1e-9&&vn+an*t< -1e-8&&
             Math.abs(alongAt)<=p.length/2+1e-8){
            events.push({
              time:t,label:`${n.name}: ${p.name} 도달`
            });
            break;
          }
        }
      }
    }
  }
  return events.sort((a,b)=>a.time-b.time)[0]||null;
}

function setObservation(e,distance,target="all",mode="distance"){
  e.observation={
    distance,target,mode,
    physicalTarget:mode==="auto"?forecastPhysicalEvent(e):null,
    origin:new Map(e.travel),
    reached:false
  };
}

function observationValue(e,increment=new Map()){
  const o=e.observation;
  if(!o)return 0;
  const ids=o.target==="all"
    ?e.dynamic.map(n=>n.id):[o.target];

  return Math.max(0,...ids.map(id=>
    (e.travel.get(id)||0)+(increment.get(id)||0)-
    (o.origin.get(id)||0)
  ));
}

function saveMotion(e){
  return {
    nodes:e.dynamic.map(n=>({
      id:n.id,x:n.x,y:n.y,vx:n.vx,vy:n.vy,
      ax:n.ax,ay:n.ay,forces:n.forces
    })),
    rows:e.rows,matrix:e.matrix,rhs:e.rhs,
    residual:e.residual,lastH:e.lastH
  };
}

function restoreMotion(e,b){
  b.nodes.forEach(n=>Object.assign(e.map.get(n.id),n));
  for(const key of ["rows","matrix","rhs","residual","lastH"]){
    e[key]=b[key];
  }
}

function rawAdvance(e,h,analytic){
  e.lastH=h;
  if(analytic){
    const s=e.phase.solution;
    for(const n of e.dynamic){
      const a=s.values.get(n.id);
      n.x+=n.vx*h+.5*a.ax*h*h;
      n.y+=n.vy*h+.5*a.ay*h*h;
      n.vx+=a.ax*h;
      n.vy+=a.ay*h;
      n.ax=a.ax;
      n.ay=a.ay;
      n.forces=copy(a.forces);
    }
    e.rows=s.rows.map(r=>({...r,impulse:r.force*h}));
    e.residual=0;
  }else{
    numericalStep(e,h);
  }
}

function stepDistances(e,before,h,analytic){
  const result=new Map();
  const knots=[
    0,-.5384693101056831,.5384693101056831,
    -.906179845938664,.906179845938664
  ];
  const weights=[
    .568888888888889,.4786286704993665,.4786286704993665,
    .2369268850561891,.2369268850561891
  ];

  for(const old of before.nodes){
    const n=e.map.get(old.id);
    let distance=hypot(n.x-old.x,n.y-old.y);
    if(analytic){
      const a=e.phase.solution.values.get(n.id);
      distance=0;
      for(let i=0;i<knots.length;i++){
        const t=.5*h*(knots[i]+1);
        distance+=weights[i]*
          hypot(old.vx+a.ax*t,old.vy+a.ay*t)*.5*h;
      }
    }
    result.set(n.id,distance);
  }
  return result;
}

function numericalTransition(e,before){
  const oldNormals=new Set(
    before.rows.filter(r=>
      r.kind==="normal"&&r.impulse>1e-9
    ).map(r=>r.bodyId+"|"+(r.surfaceId||r.label))
  );

  for(const r of e.rows){
    if(r.kind==="normal"&&r.impulse>1e-8&&
       !oldNormals.has(r.bodyId+"|"+(r.surfaceId||r.label))){
      if(r.surfaceId){
        return {
          kind:"impact",
          bodyId:r.bodyId,
          surfaceId:r.surfaceId,
          label:"새로운 접촉이 발생하여 충돌 후 힘을 다시 계산했습니다."
        };
      }
      if(r.pair){
        return {
          kind:"pair-impact",
          bodyId:r.bodyId,
          label:"물체 사이 접촉 상태가 바뀌어 충돌 후 힘을 다시 계산했습니다."
        };
      }
    }
  }

  for(const r of before.rows){
    if(r.kind!=="normal"||!r.surfaceId||r.impulse<1e-8)continue;
    const n=e.map.get(r.bodyId);
    const p=e.map.get(r.surfaceId);
    const u=surfaceAxes(p);
    const along=(n.x-p.x)*u.tx+(n.y-p.y)*u.ty;

    if(Math.abs(along)>p.length/2){
      return {
        kind:"edge",bodyId:n.id,surfaceId:p.id,
        side:Math.sign(along),
        label:`${n.name}가 ${p.name}의 끝에 도달했습니다.`
      };
    }
  }
  return null;
}

function observationProblem(e){
  const o=e.observation;
  if(!o||o.target==="all"||o.physicalTarget)return "";
  const n=e.map.get(o.target);
  if(!n||!DYNAMIC(n)){
    return "관찰 대상이 장면에 없습니다. 다른 물체를 선택하세요.";
  }

  const s=e.phase?.solution||e.solution;
  const a=s.values.get(n.id);

  if(s.constant&&hypot(n.vx,n.vy)<1e-9&&
     hypot(a.ax,a.ay)<1e-9&&!physicalRest(e)){
    return "선택한 물체는 현재 운동 구간에서 움직이지 않아 양의 관찰 거리에 도달할 수 없습니다. 관찰 대상을 ‘가장 먼저 도달하는 물체’ 또는 움직이는 물체로 바꾸세요.";
  }
  return "";
}

function integrate(e,h=DT){
  if(e.event)return;

  const badObservation=observationProblem(e);
  if(badObservation){
    e.event=badObservation;
    e.stopInfo={
      kind:"configuration",physicalRest:false,text:badObservation
    };
    return;
  }

  if(!e.phase)e.phase={solution:e.solution,start:e.time};

  if(physicalRest(e)){
    e.event="속도와 알짜힘이 모두 0인 평형 상태입니다. 애니메이션만 멈춘 상태가 아니라 실제로 정지한 상태입니다.";
    e.stopInfo={kind:"rest",physicalRest:true,text:e.event};
    return;
  }

  const analytic=e.useTextbook&&e.phase.solution.constant;
  const event=nextPhysicalEvent(e,h);
  let duration=event?Math.min(h,event.time):h;
  const before=saveMotion(e);

  if(duration>1e-12)rawAdvance(e,duration,analytic);

  let increments=stepDistances(e,before,duration,analytic);
  let distanceReached=false;

  if(e.observation&&!e.observation.physicalTarget&&
     observationValue(e,increments)>=e.observation.distance-1e-10){
    let lo=0,hi=duration;
    restoreMotion(e,before);

    for(let i=0;i<44;i++){
      const mid=(lo+hi)/2;
      restoreMotion(e,before);
      if(mid>1e-14)rawAdvance(e,mid,analytic);
      const ds=stepDistances(e,before,mid,analytic);
      if(observationValue(e,ds)<e.observation.distance)lo=mid;
      else hi=mid;
    }

    duration=hi;
    restoreMotion(e,before);
    if(duration>1e-12)rawAdvance(e,duration,analytic);
    increments=stepDistances(e,before,duration,analytic);
    distanceReached=true;
  }

  increments.forEach((d,id)=>
    e.travel.set(id,(e.travel.get(id)||0)+d)
  );
  e.time+=duration;

  let stateEvent=event&&duration>=event.time-1e-9
    ?event:null;

  if(!analytic&&!stateEvent&&duration>0){
    stateEvent=numericalTransition(e,before);
  }

  if(stateEvent){
    handlePhysicalEvent(e,stateEvent);
  }else if(distanceReached){
    e.observation.reached=true;
    e.event=`관찰 거리 ${fmt(e.observation.distance,3)} m에 도달했습니다. 계산된 속도·힘을 유지하고 학습을 위해 재생만 일시정지했습니다.`;
    e.stopInfo={
      kind:"observation",physicalRest:false,text:e.event
    };
  }

  if(e.time+1e-9>=e.nextSample||e.event){
    if(e.event&&e.history.length&&
       Math.abs(e.history[e.history.length-1].t-e.time)<1e-10){
      e.history.pop();
    }
    if(!e.history.length||
       Math.abs(e.history[e.history.length-1].t-e.time)>1e-10){
      record(e);
    }
    e.nextSample=Math.floor(e.time/.05+1e-8)*.05+.05;
    if(e.history.length>6001){
      e.history.splice(0,e.history.length-6001);
    }
  }
}

function lessonDirection(x,y){
  if(hypot(x,y)<1e-8)return "0: 방향 없음";
  if(Math.abs(y)<1e-7)return x>0?"오른쪽":"왼쪽";
  if(Math.abs(x)<1e-7)return y>0?"위쪽":"아래쪽";
  return (y>0?"위":"아래")+"·"+(x>0?"오른":"왼")+"쪽";
}

function forceProjection(value,u,excludeRope=true){
  return value.forces
    .filter(f=>!excludeRope||f.kind!=="rope")
    .reduce((sum,f)=>sum+f.x*u.x+f.y*u.y,0);
}

function classifyLesson(e){
  const s=e.solution;
  const map=new Map(e.model.nodes.map(n=>[n.id,n]));
  const bodies=e.model.nodes.filter(DYNAMIC);

  if(!s.reliable||s.forceDeterminate===false){
    return {type:"general",bodies};
  }

  if(bodies.length===2&&e.model.ropes.length===1&&
     bodies.every(n=>n.kind==="body")){
    const r=e.model.ropes[0];
    const a=map.get(r.path[0]);
    const b=map.get(r.path[r.path.length-1]);

    if(a&&b&&DYNAMIC(a)&&DYNAMIC(b)&&
       r.path.slice(1,-1).every(id=>map.get(id).kind==="fixed")&&
       s.constant){
      const geo=geometry(r,map);
      const ga=geo.terms.get(a.id),gb=geo.terms.get(b.id);
      const la=hypot(ga.x,ga.y),lb=hypot(gb.x,gb.y);
      const ua={x:ga.x/la,y:ga.y/la};
      const ub={x:-gb.x/lb,y:-gb.y/lb};

      const transverse=s.rows.filter(q=>
        q.kind==="normal"
      ).every(q=>[a,b].every(n=>{
        const g=q.terms.get(n.id),u=n===a?ua:ub;
        return !g||Math.abs(g.x*u.x+g.y*u.y)<1e-6;
      }));

      const aa=s.values.get(a.id),ab=s.values.get(b.id);
      const accA=aa.ax*ua.x+aa.ay*ua.y;
      const accB=ab.ax*ub.x+ab.ay*ub.y;

      if(transverse&&Math.abs(la-1)<1e-6&&
         Math.abs(lb-1)<1e-6&&Math.abs(accA-accB)<1e-6){
        return {
          type:"two",bodies,a,b,ua,ub,r,acc:accA,
          P:forceProjection(aa,ua),
          Q:forceProjection(ab,ub)
        };
      }
    }
  }

  const moving=bodies.find(n=>n.kind==="moving");
  const body=bodies.find(n=>n.kind==="body");

  if(bodies.length===2&&moving&&body&&
     e.model.ropes.length===1&&s.constant){
    const geo=geometry(e.model.ropes[0],map);
    const gp=geo.terms.get(moving.id);
    const gb=geo.terms.get(body.id);

    if(gp&&gb&&Math.abs(gp.x)<1e-7&&
       Math.abs(gp.y-2)<1e-7&&Math.abs(gb.x)<1e-7&&
       Math.abs(gb.y-1)<1e-7){
      return {
        type:"moving",bodies,moving,body,
        P:forceProjection(s.values.get(moving.id),{x:0,y:-1}),
        Q:forceProjection(s.values.get(body.id),{x:0,y:1}),
        acc:-s.values.get(moving.id).ay
      };
    }
  }

  if(bodies.length===1&&!e.model.ropes.length){
    const n=bodies[0];
    const support=s.contacts.find(r=>r.bodyId===n.id);
    const p=support?map.get(support.surfaceId):null;

    if(p){
      const a=p.angle*Math.PI/180;
      const sign=Math.sin(a)>0?-1:1;
      const u={x:sign*Math.cos(a),y:sign*Math.sin(a)};
      return {
        type:"singleSurface",bodies,n,p,u,
        acc:s.values.get(n.id).ax*u.x+s.values.get(n.id).ay*u.y
      };
    }
    return {type:"free",bodies,n};
  }

  if(bodies.length>=3&&s.constant&&
     e.model.ropes.length===bodies.length-1&&
     e.model.ropes.every(r=>
       r.path.length===2&&r.path.every(id=>DYNAMIC(map.get(id)))
     )){
    const u={x:1,y:0};
    const projected=bodies.map(n=>s.values.get(n.id).ax);
    const allSame=projected.every(a=>
      Math.abs(a-projected[0])<1e-7
    )&&bodies.every(n=>Math.abs(s.values.get(n.id).ay)<1e-7);

    const linked=new Set([bodies[0].id]);
    for(let k=0;k<bodies.length;k++){
      for(const r of e.model.ropes){
        if(r.path.some(id=>linked.has(id))){
          r.path.forEach(id=>linked.add(id));
        }
      }
    }

    const horizontal=e.model.ropes.every(r=>
      Math.abs(map.get(r.path[0]).y-map.get(r.path[1]).y)<1e-7
    );

    if(allSame&&horizontal&&linked.size===bodies.length){
      return {
        type:"serial",bodies,u,acc:projected[0],
        P:bodies.map(n=>forceProjection(s.values.get(n.id),u))
      };
    }
  }

  return {type:"general",bodies};
}

function readableElimination(system){
  const names=system.active.map((r,i)=>
    (r.kind==="rope"?"T":r.kind==="normal"?"N":"f")+(i+1)
  );
  const matrix=system.A.map((row,i)=>row.concat(system.b[i]));

  const equation=row=>{
    const lhs=row.slice(0,-1).map((v,j)=>
      Math.abs(v)<1e-8?"":`(${fmt(v,6)})${names[j]}`
    ).filter(Boolean).join(" + ")||"0";
    return lhs+" = "+fmt(row[row.length-1],6);
  };

  const log=[];

  for(let k=0;k<matrix.length;k++){
    let pivot=k;
    for(let i=k+1;i<matrix.length;i++){
      if(Math.abs(matrix[i][k])>Math.abs(matrix[pivot][k])){
        pivot=i;
      }
    }
    if(Math.abs(matrix[pivot][k])<1e-9){
      return "<p>독립된 식이 부족하여 유일한 구속력을 확인할 수 없습니다.</p>";
    }
    if(pivot!==k){
      [matrix[pivot],matrix[k]]=[matrix[k],matrix[pivot]];
      log.push(
        `<p>${k+1}번 식과 ${pivot+1}번 식의 순서를 바꿉니다.</p>`
      );
    }

    const d=matrix[k][k];
    for(let j=k;j<=matrix.length;j++)matrix[k][j]/=d;

    log.push(
      `<p>${k+1}번 식을 ${fmt(d,6)}으로 나누어 ${names[k]}의 계수를 1로 만듭니다.</p>`+
      `<div class="formula">${esc(equation(matrix[k]))}</div>`
    );

    for(let i=0;i<matrix.length;i++){
      if(i===k||Math.abs(matrix[i][k])<1e-10)continue;
      const factor=matrix[i][k];
      for(let j=k;j<=matrix.length;j++){
        matrix[i][j]-=factor*matrix[k][j];
      }
      log.push(
        `<p>${i+1}번 식에서 ‘${k+1}번 식 × ${fmt(factor,6)}’를 빼 ${names[k]} 항을 없앱니다.</p>`+
        `<div class="formula">${esc(equation(matrix[i]))}</div>`
      );
    }
  }

  return `<p>${names.map((name,i)=>
    `${name}: ${esc(system.active[i].label)}`
  ).join(" · ")}</p>`+
  system.A.map((r,i)=>
    `<div class="formula">${i+1}번 식: ${esc(equation(r.concat(system.b[i])))}</div>`
  ).join("")+log.join("");
}

function lessonCalculation(e,kind){
  const f=fmt;

  if(kind.type==="two"){
    const {a,b,P,Q,acc}=kind;
    const T=maximumT(e.solution,a.id);
    return `
      <p>미지수는 공통 경로 가속도 a와 장력 T입니다.
      두 식을 같은 좌표 약속으로 씁니다.</p>
      <div class="formula">
      ① ${f(a.m)}a = (${f(P,6)}) + T<br>
      ② ${f(b.m)}a = (${f(Q,6)}) − T
      </div>
      <p>①+②를 하면 +T와 −T가 더해져 0이 됩니다.
      장력이 없다는 뜻이 아니라, 두 물체를 하나의 계로 보면
      내부 힘이 서로 상쇄된다는 뜻입니다.</p>
      <div class="formula">
      (${f(a.m)} + ${f(b.m)})a =
      (${f(P,6)}) + (${f(Q,6)}) + T − T<br>
      ${f(a.m+b.m)}a = ${f(P+Q,6)}<br>
      a = ${f(P+Q,6)} / ${f(a.m+b.m)}
      = ${signed(acc)} m/s²
      </div>
      <p>이 가속도를 ①에 대입하여 T만 남깁니다.</p>
      <div class="formula">
      ${f(a.m)} × (${f(acc,6)}) = (${f(P,6)}) + T<br>
      T = ${f(a.m)} × (${f(acc,6)}) − (${f(P,6)})
      = ${f(T,6)} N
      </div>
      <p>②에도 대입하면 ${f(b.m*acc,6)} =
      ${f(Q,6)} − ${f(T,6)}으로 같은 결과가 나옵니다.</p>
    `;
  }

  if(kind.type==="moving"){
    const {moving:p,body:b,P,Q,acc}=kind;
    return `
      <p>이동 도르래가 아래로 x만큼 움직이면 양쪽 줄이
      각각 x만큼 길어집니다. 줄 전체 길이가 일정하려면
      반대쪽 물체는 위로 2x만큼 움직여야 합니다.</p>
      <div class="formula">
      a물체 = 2a도르래<br>
      ① ${f(p.m)}a도르래 = (${f(P,6)}) − 2T<br>
      ② ${f(b.m)}a물체 = (${f(Q,6)}) + T
      </div>
      <p>②에 a물체=2a도르래를 대입하고 T를 정리합니다.</p>
      <div class="formula">
      2 × ${f(b.m)}a도르래 = (${f(Q,6)}) + T<br>
      T = 2 × ${f(b.m)}a도르래 − (${f(Q,6)})
      </div>
      <p>이 T를 ①에 대입하여 괄호를 전개합니다.</p>
      <div class="formula">
      ${f(p.m)}a도르래 =
      (${f(P,6)}) − 2[2 × ${f(b.m)}a도르래 − (${f(Q,6)})]<br>
      ${f(p.m)}a도르래 =
      (${f(P,6)}) − 4 × ${f(b.m)}a도르래 + 2 × (${f(Q,6)})<br>
      (${f(p.m)} + 4 × ${f(b.m)})a도르래 =
      (${f(P,6)}) + 2 × (${f(Q,6)})<br>
      a도르래 = ${f(P+2*Q,6)} / ${f(p.m+4*b.m)}
      = ${signed(acc)} m/s²<br>
      a물체 = 2 × (${f(acc,6)})
      = ${signed(2*acc)} m/s²<br>
      T = 2 × ${f(b.m)} × (${f(acc,6)}) − (${f(Q,6)})
      = ${f(maximumT(e.solution,p.id),6)} N
      </div>
      <p>이 앱에서는 이동 도르래 자체의 병진 질량
      ${f(p.m)} kg도 중력과 관성에 포함합니다.</p>
    `;
  }

  if(kind.type==="singleSurface"){
    const {n,p,u}=kind;
    const v=e.solution.values.get(n.id);
    const angle=p.angle*Math.PI/180;
    const normal={x:-Math.sin(angle),y:Math.cos(angle)};
    const grav=n.m*e.model.g*Math.abs(Math.sin(angle));
    const ext=n.fx*u.x+n.fy*u.y;
    const extN=n.fx*normal.x+n.fy*normal.y;
    const friction=v.forces.filter(f=>
      f.kind==="friction"
    ).reduce((sum,f)=>sum+f.x*u.x+f.y*u.y,0);

    return `
      <p>면에 수직으로는 가속도가 0이므로 먼저 N을 구합니다.
      외력의 수직 성분도 빠뜨리지 않습니다.</p>
      <div class="formula">
      N + F외력,수직 − mg cosθ = 0<br>
      N = ${f(n.m)} × ${f(e.model.g)}
      × cos(${f(Math.abs(p.angle))}°)
      − (${f(extN,6)}) = ${f(v.normal,6)} N
      </div>
      <p>미끄러질 때 마찰력의 크기는 μN이고 운동 반대 방향입니다.
      정지할 때에는 필요한 마찰력이 μN 이내인지 먼저 확인합니다.</p>
      <div class="formula">
      μN = ${f(Math.min(n.mu,p.mu),3)}
      × ${f(v.normal,6)}
      = ${f(Math.min(n.mu,p.mu)*v.normal,6)} N<br>
      실제 계산된 마찰 성분 f = ${signed(friction)} N<br>
      ${f(n.m)}a = mg sin|θ| + F외력,경로 + f<br>
      ${f(n.m)}a =
      (${f(grav,6)}) + (${f(ext,6)}) + (${f(friction,6)})<br>
      a = ${f(grav+ext+friction,6)} / ${f(n.m)}
      = ${signed(kind.acc)} m/s²
      </div>
    `;
  }

  if(kind.type==="free"){
    const n=kind.n,v=e.solution.values.get(n.id);
    return `
      <p>접촉면과 줄이 없으므로 중력과 설정한 외력만 더합니다.
      수평과 수직을 따로 풉니다.</p>
      <div class="formula">
      ${f(n.m)}aₓ = ${f(n.fx)}<br>
      aₓ = ${f(n.fx)} / ${f(n.m)}
      = ${signed(v.ax)} m/s²<br>
      ${f(n.m)}aᵧ =
      ${f(n.fy)} − ${f(n.m)} × ${f(e.model.g)}<br>
      aᵧ = (${f(n.fy)} − ${f(n.m*e.model.g)}) / ${f(n.m)}
      = ${signed(v.ay)} m/s²
      </div>
      <p>외력이 0이면 aₓ=0, aᵧ=−g입니다.
      수평 속도가 있으면 포물선 운동이 되지만
      가속도가 수평 운동 때문에 더 커지지는 않습니다.</p>
    `;
  }

  if(kind.type==="serial"){
    const totalMass=kind.bodies.reduce((sum,n)=>sum+n.m,0);
    const totalDrive=kind.P.reduce((a,b)=>a+b,0);
    const map=new Map(e.model.nodes.map(n=>[n.id,n]));
    const known=new Map(),trace=[];

    for(let pass=0;pass<e.model.ropes.length;pass++){
      let found=false;
      for(let i=0;i<kind.bodies.length;i++){
        const n=kind.bodies[i];
        const attached=e.model.ropes.filter(r=>
          r.path.includes(n.id)
        );
        const unknown=attached.filter(r=>!known.has(r.id));
        if(unknown.length!==1)continue;

        const r=unknown[0];
        const coefficient=geometry(r,map).terms.get(n.id).x;
        const other=attached.filter(q=>known.has(q.id))
          .reduce((sum,q)=>
            sum+geometry(q,map).terms.get(n.id).x*known.get(q.id),0);
        const tension=(n.m*kind.acc-kind.P[i]-other)/coefficient;
        known.set(r.id,tension);
        found=true;

        trace.push(`
          <p>${esc(n.name)}의 식에서 아직 모르는 장력
          ${esc(r.name)}만 남깁니다.</p>
          <div class="formula">
          ${f(n.m)} × (${f(kind.acc,6)}) =
          (${f(kind.P[i],6)}) + (${f(other,6)})
          + (${f(coefficient)})T${esc(r.name)}<br>
          T${esc(r.name)} =
          [${f(n.m*kind.acc,6)} − (${f(kind.P[i],6)})
          − (${f(other,6)})] / (${f(coefficient)})
          = ${f(tension,6)} N
          </div>
        `);
      }
      if(!found)break;
    }

    return `
      <p>모든 물체의 식을 더합니다.
      각 줄은 양 끝 물체를 반대 방향으로 당기므로
      내부 장력 항이 서로 없어집니다.</p>
      <div class="formula">
      (${kind.bodies.map(n=>f(n.m)).join(" + ")})a =
      ${kind.P.map(p=>"("+f(p,6)+")").join(" + ")}<br>
      ${f(totalMass)}a = ${f(totalDrive,6)}<br>
      a = ${f(totalDrive,6)} / ${f(totalMass)}
      = ${signed(kind.acc)} m/s²
      </div>
      ${trace.join("")}
      <p>구한 장력과 공통 가속도를 각 물체의 원래 식에
      대입하면 모든 식을 만족합니다.</p>
    `;
  }

  return `
    <p>방향이 서로 다른 여러 구속이 있으므로 각 물체의
    x·y 식과 줄 길이 식을 함께 사용합니다.
    먼저 a=ΣF/m을 구속식에 대입하여 장력·수직항력·마찰력에
    관한 식으로 정리한 뒤, 같은 문자를 차례로 소거합니다.</p>
    ${readableElimination(e.solution.system)}
  `;
}

function buildGuidedSteps(e){
  const s=e.solution,kind=classifyLesson(e);
  const nodes=e.model.nodes.filter(DYNAMIC);

  const condition=nodes.map(n=>`
    <li><b>${esc(n.name)}</b>:
    질량 ${fmt(n.m)} kg,
    외력 (${signed(n.fx)}, ${signed(n.fy)}) N,
    초기 속도 (${signed(n.vx)}, ${signed(n.vy)}) m/s,
    마찰계수 설정 ${fmt(n.mu,3)}.</li>
  `).join("");

  const assumptions=`
    <p>중력가속도는 ${fmt(e.model.g)} m/s²입니다.
    공기 저항은 없고 줄은 질량·탄성이 없는 이상적인 줄입니다.
    고정 도르래는 회전 관성이 없는 방향 전환점입니다.
    접촉 마찰에는 물체와 면의 마찰계수 중 작은 값을 사용합니다.
    줄은 당길 수 있지만 밀 수 없으며, 느슨해지면 T=0입니다.</p>
  `;

  let direction=`
    <p>속도는 지금 움직이는 방향, 가속도는 속도가 변하는 방향입니다.
    두 방향은 반드시 같지 않습니다.</p>
  `;

  if(kind.type==="two"){
    direction+=`
      <p>${esc(kind.a.name)}는
      ${lessonDirection(kind.ua.x,kind.ua.y)},
      ${esc(kind.b.name)}는
      ${lessonDirection(kind.ub.x,kind.ub.y)}을
      각각 +방향으로 정합니다.
      이 방향의 장력을 제외한 힘을 각각 P, Q라고 하면,
      두 물체를 움직이게 하는 힘은 P+Q입니다.
      ${kind.acc>1e-7
        ?"이 합이 양수이므로 선택한 +방향으로 가속합니다."
        :kind.acc< -1e-7
          ?"이 합이 음수이므로 선택한 +방향의 반대로 가속합니다."
          :"힘이 균형을 이루어 가속도는 0입니다."}</p>
    `;
  }else if(kind.type==="moving"){
    direction+=`
      <p>이동 도르래는 아래쪽, 반대쪽 물체는 위쪽을 각각 +로 정합니다.
      이동 도르래가 내려가면 양쪽 줄 구간이 함께 길어져
      반대쪽 물체는 두 배의 거리를 올라갑니다.</p>
    `;
  }else if(kind.type==="singleSurface"){
    direction+=`
      <p>경사면의 ${lessonDirection(kind.u.x,kind.u.y)}
      방향을 경로의 +로 정합니다.
      중력의 면과 나란한 성분은 아래로 미끄러지게 하고,
      마찰은 미끄러지려는 방향을 방해합니다.
      마찰이 충분하면 정지 상태를 유지할 수 있습니다.</p>
    `;
  }else if(kind.type==="free"){
    direction+=`
      <p>수평 외력이 없다면 수평 속도는 일정합니다.
      중력이 아래쪽으로 작용하므로 위로 던진 물체도
      아래쪽 가속도를 가집니다. 최고점에서 순간적으로
      수직 속도가 0이어도 중력은 사라지지 않습니다.</p>
    `;
  }else{
    direction+=`
      <p>각 물체의 중력과 외력, 줄이 당기는 방향을 먼저 표시한 뒤
      알짜힘을 비교합니다. 서로 다른 줄 구조에서 모든 가속도가
      같다고 가정하지 않습니다.</p>
    `;
  }

  direction+=nodes.filter(n=>hypot(n.vx,n.vy)>1e-7).map(n=>`
    <p>${esc(n.name)}는 처음에
    ${lessonDirection(n.vx,n.vy)}으로 움직입니다.
    가속도가 반대 방향이면 처음에는 느려집니다.</p>
  `).join("");

  const diagrams=nodes.map(n=>{
    const value=s.values.get(n.id);
    const forces=s.forceDeterminate===false
      ?value.forces.filter(f=>["gravity","external"].includes(f.kind))
      :value.forces;
    let svg=`
      <circle cx="210" cy="165" r="20" fill="#b4dca9"/>
      <text x="210" y="170" text-anchor="middle"
        font-size="13">${esc(n.name)}</text>
    `;

    forces.forEach((f,i)=>{
      svg+=arrow(
        210+(i-1)*7,165,f.x,f.y,forceColor(f.kind),
        study.revealed
          ?`${f.name} (${signed(f.x)}, ${signed(f.y)}) N`
          :f.name,
        true
      );
    });

    return `
      <article class="guide-force">
      <button data-lesson-body="${n.id}">
        ${esc(n.name)} 선택 · 운동 방정식과 비교
      </button>
      <svg class="study-fbd" viewBox="0 0 420 330"
        role="img" aria-label="${esc(n.name)} 초기 힘">${svg}</svg>
      <p>중력: 아래쪽. 수직항력: 닿은 면에서 밀어내는 방향.
      장력: 줄 구간을 따라 당기는 방향.
      마찰: 미끄러짐을 막는 방향.
      외력: 사용자가 지정한 방향입니다.</p>
      </article>
    `;
  }).join("");

  const formulaWhy=`
    <p>물체의 속도가 어떻게 바뀌는지는
    <b>뉴턴 제2법칙 ΣF=ma</b>로 판단합니다.
    힘이 클수록 같은 질량의 속도가 더 빠르게 변하고,
    같은 힘이라도 질량이 클수록 가속도는 작습니다.
    중력 하나가 아니라 <b>작용하는 모든 힘의 합</b>을 넣어야 합니다.</p>
    <div class="formula">ΣFₓ = maₓ　　ΣFᵧ = maᵧ</div>
    <p>경사면에서는 x·y보다 면에 나란한 방향과 수직인 방향을
    쓰면 식이 간단합니다. 물체가 면을 뚫거나 뜨지 않는 구간에는
    수직 가속도가 0이기 때문입니다.
    중력을 두 힘으로 새로 만드는 것이 아니라,
    같은 중력 벡터를 두 축에서 읽는 것입니다.</p>
    <div class="formula">
    면 아래쪽 성분: mg sinθ<br>
    면을 누르는 성분: mg cosθ
    </div>
  `;

  let equations="";

  if(kind.type==="two"){
    equations=`
      <p>+방향:
      ${esc(kind.a.name)}는 ${lessonDirection(kind.ua.x,kind.ua.y)},
      ${esc(kind.b.name)}는 ${lessonDirection(kind.ub.x,kind.ub.y)}.
      같은 a는 경로를 따라 정한 스칼라 가속도입니다.
      도르래 양쪽 물체의 전역 가속도 벡터가 같다는 뜻은 아닙니다.</p>
      <div class="formula">
      ${fmt(kind.a.m)}a = P + T<br>
      ${fmt(kind.b.m)}a = Q − T
      </div>
      <p>${esc(kind.a.name)}에서는 줄이 +방향으로 당겨 +T이고,
      ${esc(kind.b.name)}에서는 줄이 −방향으로 당겨 −T입니다.
      P와 Q는 각각 중력의 경로 성분, 외력의 경로 성분,
      마찰 성분의 합입니다.</p>
    `;

    for(const [n,u,label] of [
      [kind.a,kind.ua,"P"],[kind.b,kind.ub,"Q"]
    ]){
      const value=s.values.get(n.id);
      equations+=`
        <p>${esc(n.name)}의 ${label} 구성:</p>
        <div class="formula">${label} =
        ${value.forces.filter(f=>
          f.kind!=="rope"&&hypot(f.x,f.y)>1e-8
        ).map(f=>
          `${esc(f.name)}의 경로 성분 (${signed(f.x*u.x+f.y*u.y)} N)`
        ).join(" + ")||"0 N"}</div>
      `;
    }

    equations+=`
      <p>질량·신축성이 없는 팽팽한 한 줄과 고정 도르래에서는
      한쪽 줄 길이가 늘어난 만큼 다른 쪽이 줄어야 합니다.
      따라서 정해 둔 두 경로 좌표의 변위·속도·가속도가 같습니다.
      줄이 느슨하면 이 관계를 사용할 수 없습니다.</p>
    `;
  }else if(kind.type==="moving"){
    equations=`
      <div class="formula">
      ${fmt(kind.moving.m)}a도르래 = P − 2T<br>
      ${fmt(kind.body.m)}a물체 = Q + T<br>
      a물체 = 2a도르래
      </div>
      <p>P는 도르래의 아래쪽 구동력,
      Q는 물체의 위쪽 구동력입니다.
      평행한 두 줄이 도르래를 각각 T로 당겨 위쪽 합력이 2T가 됩니다.
      이동 도르래에서는 두 가속도를 같다고 놓으면 안 됩니다.</p>
    `;
  }else{
    equations=nodes.map(n=>{
      const value=s.values.get(n.id);
      return `
        <button data-lesson-body="${n.id}">
          ${esc(n.name)}의 자유물체도 보기
        </button>
        <div class="formula">
        ${fmt(n.m)}aₓ =
        ${value.forces.map(f=>`(${signed(f.x)})`).join(" + ")}<br>
        ${fmt(n.m)}aᵧ =
        ${value.forces.map(f=>`(${signed(f.y)})`).join(" + ")}
        </div>
        <p>왼쪽은 질량 × 가속도이고,
        오른쪽 항은 위 자유물체도 화살표들의 x·y 성분입니다.
        마이너스 부호는 정한 +축 반대 방향이라는 뜻입니다.</p>
      `;
    }).join("");
  }

  if(s.forceDeterminate===false){
    equations=`
      <p>각 물체에 대해 ΣF=ma=0을 세울 수 있지만,
      여러 정지 마찰력의 분담이 유일하지 않을 수 있습니다.
      μN은 정지 마찰의 실제 값이 아니라 상한이므로
      이를 모두 등호로 놓으면 안 됩니다.</p>
    `;
  }

  const finals=s.reliable&&s.forceDeterminate!==false
    ?`
      <div class="study-scroll">
      <table class="study-table">
      <thead><tr>
      <th>물체</th><th>aₓ (m/s²)</th><th>aᵧ (m/s²)</th>
      <th>알짜힘 (Fx,Fy) N</th><th>연결된 최대 T (N)</th>
      </tr></thead><tbody>
      ${nodes.map(n=>{
        const v=s.values.get(n.id);
        return `
          <tr><td>${esc(n.name)}</td>
          <td>${signed(v.ax)}</td><td>${signed(v.ay)}</td>
          <td>(${signed(v.fx)}, ${signed(v.fy)})</td>
          <td>${fmt(maximumT(s,n.id),3)}</td></tr>
        `;
      }).join("")}
      </tbody></table></div>
      <p>${s.constant
        ?"현재 줄 방향·접촉·마찰 상태가 유지되는 구간에서 일정합니다."
        :"위 표는 초기 순간값이며 운동 중 고정 답으로 사용할 수 없습니다."}
      현재 시각의 값은 별도의 실시간 표에서 확인하세요.</p>
    `
    :`
      <p class="notice">${s.forceDeterminate===false
        ?"정지 마찰의 분담 때문에 장력이 유일하게 정해지는지 확인할 수 없습니다. 임의로 하나의 장력을 정답으로 표시하지 않습니다."
        :"초기 충격 또는 계산 한계 때문에 유한한 초기 힘을 단일 정답으로 제시하지 않습니다."}</p>
    `;

  const concepts=`
    <ul>
    <li><b>같은 가속도:</b>
    팽팽한 한 줄의 길이가 일정하고 경로가 고정된 경우에만
    경로 좌표의 관계를 세웁니다.
    이동 도르래는 2:1 등 다른 관계가 생깁니다.</li>
    <li><b>장력 소거:</b>
    두 물체를 합친 계에서 줄의 내부 힘이 서로 상쇄됩니다.
    각 물체의 자유물체도에서 장력을 지워도 된다는 뜻은 아닙니다.</li>
    <li><b>경사면 성분:</b>
    mg와 mg sinθ를 같은 축의 서로 다른 힘처럼 함께 더하면
    중력을 두 번 세는 실수입니다.</li>
    <li><b>마찰:</b>
    정지 마찰은 항상 μN이 아닙니다.
    필요한 크기까지만 작용합니다.
    운동 마찰은 미끄럼 반대 방향입니다.</li>
    <li><b>방향·단위:</b>
    음의 가속도는 틀린 답이 아니라 +축 반대 방향입니다.
    장력은 N, 가속도는 m/s², 속도는 m/s입니다.</li>
    <li><b>정지와 일시정지:</b>
    관찰 거리에서 화면을 멈춰도 v가 0이 되지는 않습니다.
    속도와 알짜힘이 모두 0인 평형과 구분하세요.
    v=0, a≠0이면 순간적으로만 멈춘 상태입니다.</li>
    </ul>
  `;

  return [
    {
      title:"문제 상황 분석",
      html:`<ul>${condition}</ul>${assumptions}
        <p>발판·경사면 ${e.model.nodes.filter(SURFACE).length}개,
        고정 도르래 ${e.model.nodes.filter(n=>n.kind==="fixed").length}개,
        이동 도르래 ${e.model.nodes.filter(n=>n.kind==="moving").length}개,
        줄 ${e.model.ropes.length}개입니다.</p>`
    },
    {title:"운동 방향 예측",html:direction},
    {
      title:"자유물체도로 힘 분석",
      html:`<p>물체 하나만 떼어 놓고, 다른 물체나 면이
        이 물체에 주는 힘을 모두 표시합니다.
        다른 물체에 작용하는 힘을 섞지 마세요.</p>
        <div class="study-grid">${diagrams}</div>`
    },
    {title:"왜 이 공식을 쓰나요?",html:formulaWhy},
    {title:"물체별 운동 방정식",html:equations},
    {
      title:"식을 정리하고 연립 계산",
      html:s.reliable&&s.forceDeterminate!==false
        ?lessonCalculation(e,kind)
        :"<p class='notice'>유일한 초기 힘을 정할 수 없는 조건입니다. 위 안내에 따라 조건을 수정해야 수치 정답과 연립 풀이를 제시할 수 있습니다.</p>"
    },
    {title:"최종 답과 적용 구간",html:finals},
    {title:"핵심 개념과 자주 하는 실수",html:concepts}
  ];
}

function installLessonUI(){
  const css=document.createElement("style");
  css.textContent=`
    .observation-controls{padding:12px 16px;border-top:1px solid #365644;background:#1e4031;color:#d4e7cc;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px}
    .observation-controls input{width:85px}
    .observation-controls select{max-width:190px}
    #observationProgress{font-variant-numeric:tabular-nums}
    #pauseMeaning{width:100%;margin:0;font-size:12px;color:#d6edbd}
    #conditionDock{position:sticky;top:0;z-index:12;background:#fbfdf7;align-self:start;padding:10px 14px;box-shadow:0 5px 18px #213b2412}
    #conditionDock .study-scroll{max-height:158px}
    #conditionDock table{margin:4px 0;font-size:11px}
    #conditionDock th,#conditionDock td{padding:5px 8px}
    .guide-body{font-size:15px;line-height:1.95;overflow-wrap:anywhere}
    .guide-body p{margin:14px 0}
    .guide-body h3{font-size:16px}
    .guide-body .formula{font-size:14px;line-height:2}
    .guide-nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}
    .guide-step-label{font-weight:750;color:#24613d}
    .guide-force{padding:12px;border:1px solid #dce7d6;border-radius:12px}
    .guide-body li{margin-bottom:10px}
    .guide-title{margin:18px 0 8px}
    .guide-body button{white-space:normal;text-align:left}
    @media(max-width:600px){
      .guide-body{font-size:14px}
      .guide-body .formula{font-size:12px}
      #conditionDock{padding:8px}
      .observation-controls{padding:10px;gap:8px}
    }
  `;
  document.head.append(css);

  const controls=document.createElement("div");
  controls.className="observation-controls";
  controls.innerHTML=`
    <label for="observationMode">종료 기준</label>
    <select id="observationMode">
      <option value="auto" selected>자동: 운동 상태 변화 우선</option>
      <option value="distance">지정한 관찰 거리 우선</option>
    </select>
    <label for="observationDistance">자유 운동 관찰 거리 (m)</label>
    <input id="observationDistance" type="number"
      min=".1" max="30" step=".1" value="2">
    <label for="observationTarget">관찰 대상</label>
    <select id="observationTarget"></select>
    <output id="observationProgress">0 / 2 m</output>
    <p id="pauseMeaning">
      재생 일시정지와 실제 물리적 정지를 구분합니다.
    </p>
  `;
  $("workspace").parentElement.insertBefore(controls,$("workspace"));

  const dock=document.createElement("section");
  dock.id="conditionDock";
  dock.className="card";
  const stage=document.querySelector(".stage");
  stage.parentElement.insertBefore(dock,stage);

  const guide=document.createElement("section");
  guide.id="guidedLesson";
  guide.innerHTML=`
    <h2 class="guide-title">문제집처럼 한 단계씩 이해하기</h2>
    <p class="small">
      현재 배치의 초기 조건으로 만든 풀이입니다.
      조건을 바꾸면 처음 단계부터 새로 생성됩니다.
    </p>
    <div class="guide-nav">
      <button id="lessonPrevious">이전 단계</button>
      <span id="lessonStepLabel" class="guide-step-label"></span>
      <button id="lessonNext" class="primary">다음 단계</button>
      <button id="lessonFirst">풀이 처음부터</button>
    </div>
    <div id="lessonContent" class="guide-body"></div>
  `;
  $("studyPanel").append(guide);

  $("lessonPrevious").onclick=()=>{
    lessonStep=Math.max(0,lessonStep-1);
    renderGuidedLesson();
  };

  $("lessonNext").onclick=()=>{
    lessonStep=Math.min(7,lessonStep+1);
    if(lessonStep>=5&&!study.revealed){
      study.revealed=true;
      renderStudy(true);
    }
    renderGuidedLesson();
    render();
  };

  $("lessonFirst").onclick=()=>{
    lessonStep=0;
    renderGuidedLesson();
  };

  $("guidedLesson").addEventListener("click",e=>{
    const b=e.target.closest("[data-lesson-body]");
    if(b){
      selected=b.dataset.lessonBody;
      uiDirty=true;
      render(true);
    }
  });

  $("conditionDock").addEventListener("click",e=>{
    const b=e.target.closest("[data-dock-body]");
    if(b){
      selected=b.dataset.dockBody;
      uiDirty=true;
      render(true);
    }
  });

  $("observationMode").onchange=e=>{
    observationMode=e.target.value;
    setObservation(
      engine,observationDistance,observationTarget,observationMode
    );
    message(
      "현재 위치에서 종료 기준을 다시 계산했습니다. 자동 모드는 예측 가능한 운동 상태 변화가 있으면 그 지점까지 관찰합니다."
    );
    renderObservationControls();
  };

  $("observationDistance").onchange=e=>{
    if(!e.target.checkValidity()||e.target.value===""){
      e.target.value=observationDistance;
      return;
    }
    observationDistance=Number(e.target.value);
    setObservation(
      engine,observationDistance,observationTarget,observationMode
    );
    message(
      `현재 위치부터 새 관찰 거리 ${fmt(observationDistance,2)} m를 설정했습니다. 자동 모드에서 예측 가능한 상태 변화가 있으면 그 지점이 우선입니다. 시간 제한은 사용하지 않습니다.`
    );
    renderObservationControls();
  };

  $("observationTarget").onchange=e=>{
    observationTarget=e.target.value;
    setObservation(
      engine,observationDistance,observationTarget,observationMode
    );
    message("현재 위치부터 새 관찰 대상을 적용했습니다.");
    renderObservationControls();
  };

  $("example").innerHTML+=`
    <option value="inclinePulley">경사면과 도르래 연결</option>
    <option value="frictionTrain">마찰이 있는 두 연결 물체</option>
    <option value="multiple">세 물체의 힘과 장력</option>
  `;

  const helpText=document.createElement("p");
  helpText.className="notice";
  helpText.textContent=
    "학습 재생은 고정 시간으로 종료하지 않습니다. 자동 모드는 예측 가능한 바닥 도달·발판 끝·마찰 정지가 있으면 그 지점까지 진행합니다. 그런 종료 조건이 없는 운동에는 지정 관찰 거리를 적용합니다. 지정 거리 우선 모드에서는 실제 상태 변화와 관찰 거리 중 먼저 도달하는 지점에서 멈춥니다. 관찰 거리 일시정지는 속도를 0으로 만들지 않습니다. 다시 재생하면 다음 관찰 구간으로 이어집니다.";
  $("help").append(helpText);

  $("textbookPlayback").parentElement.lastChild.textContent=
    " 조건이 성립하면 정확한 교과서 운동으로 재생";

  document.querySelectorAll("#studyPanel .small").forEach(p=>{
    if(p.textContent.includes("초기 상태부터 일반 수치")){
      p.textContent=
        "교과서 조건에서는 현재 힘으로 정확한 등가속도 운동을 재생합니다. 상태 변화 지점에 도달하면 다음 구간의 힘을 계산하고 일시정지합니다. 다시 재생하면 그 지점에서 이어집니다.";
    }
  });

  document.querySelectorAll("#graphs .small").forEach(p=>{
    if(p.textContent.includes("300초")){
      p.textContent=
        "0.05초 간격으로 최근 약 300초를 기록합니다. 기록 길이는 애니메이션 종료 조건이 아닙니다.";
    }
  });
}

function populateObservationTargets(){
  if(!engine.map.has(observationTarget))observationTarget="all";
  $("observationTarget").innerHTML=
    '<option value="all">가장 먼저 도달하는 물체</option>'+
    engine.dynamic.map(n=>
      `<option value="${n.id}">${esc(n.name)}</option>`
    ).join("");
  $("observationTarget").value=observationTarget;
  $("observationDistance").value=observationDistance;
}

function renderObservationControls(){
  if(!$("observationProgress")||!engine.observation)return;

  $("observationMode").disabled=running;
  $("observationDistance").disabled=running;
  $("observationTarget").disabled=running;

  $("observationProgress").textContent=
    engine.observation.physicalTarget
      ?`자동 종료: ${engine.observation.physicalTarget.label} · 현재 이동 ${fmt(observationValue(engine),3)} m`
      :`${fmt(observationValue(engine),3)} / ${fmt(engine.observation.distance,3)} m`;

  const info=engine.stopInfo;
  $("pauseMeaning").textContent=info
    ?info.kind==="observation"
      ?"학습을 위한 화면 일시정지: 속도·가속도·힘은 지우지 않았습니다."
      :info.kind==="rest"
        ?"실제 물리적 정지: 속도와 알짜힘이 모두 0인 평형입니다."
        :info.kind==="transition"
          ?"운동 상태 변화 후 학습 일시정지: 모든 물체가 물리적으로 정지했다는 뜻은 아닙니다."
          :info.kind==="configuration"
            ?"관찰 조건 확인 필요: 도달 가능한 대상을 선택하세요."
            :"모형 지원 한계: 조건을 수정해야 합니다."
    :running
      ?"운동 중 · 물리량은 계산하고 화면은 느리게 재생합니다."
      :"재생 일시정지 또는 실험 준비: 속도가 0인지 여부는 실시간 표에서 별도로 확인하세요.";
}

function renderDock(){
  if(!$("conditionDock")||!engine)return;
  const key=engine.solution;

  if(dockCache&&dockCache.solution===key&&
     dockCache.revealed===study.revealed&&
     dockCache.phaseEnded===engine.phaseEnded)return;

  dockCache={
    solution:key,revealed:study.revealed,
    phaseEnded:engine.phaseEnded
  };

  const s=engine.solution;
  $("conditionDock").innerHTML=`
    <b>문제 조건·초기 계산 결과</b>
    <span class="small">
    g=${fmt(scene.g)} m/s² ·
    ${engine.phaseEnded
      ?"초기 구간 종료: 아래 답은 초기 조건 참고값"
      :s.constant?"초기 운동 구간에서 일정":"시간에 따라 변화 가능"}
    </span>
    <div class="study-scroll">
    <table class="study-table">
    <thead><tr>
    <th>물체</th><th>m (kg)</th><th>외력 (N)</th><th>μ</th>
    <th>초기 a (m/s²)</th><th>초기 최대 T (N)</th>
    </tr></thead>
    <tbody>
    ${engine.model.nodes.filter(DYNAMIC).map(n=>{
      const v=s.values.get(n.id);
      return `
        <tr>
        <td><button data-dock-body="${n.id}">${esc(n.name)}</button></td>
        <td>${fmt(n.m)}</td>
        <td>(${signed(n.fx)}, ${signed(n.fy)})</td>
        <td>${fmt(n.mu,3)}</td>
        <td>${study.revealed&&s.reliable
          ?`(${signed(v.ax)}, ${signed(v.ay)})`:"풀이 확인"}</td>
        <td>${study.revealed&&s.reliable&&s.forceDeterminate!==false
          ?fmt(maximumT(s,n.id),3):"—"}</td>
        </tr>
      `;
    }).join("")}
    </tbody></table></div>
  `;
}

function renderGuidedLesson(){
  if(!$("lessonContent")||!engine)return;
  const key=engine.solution;

  if(lessonCache&&lessonCache.solution===key&&
     lessonCache.step===lessonStep&&
     lessonCache.revealed===study.revealed)return;

  const steps=buildGuidedSteps(engine);
  const step=steps[lessonStep];

  $("lessonStepLabel").textContent=
    `${lessonStep+1} / 8 · ${step.title}`;
  $("lessonContent").innerHTML=
    `<h3>${lessonStep+1}. ${step.title}</h3>${step.html}`;
  $("lessonPrevious").disabled=lessonStep===0;
  $("lessonNext").disabled=lessonStep===7;
  $("lessonNext").textContent=
    lessonStep===4&&!study.revealed
      ?"계산 공개하고 다음 단계":"다음 단계";

  lessonCache={
    solution:key,step:lessonStep,revealed:study.revealed
  };
}

function keepVisible(){
  const invisible=engine.dynamic.some(n=>{
    const p=project(n.x,n.y),r=px(n.radius)+18;
    return p.x<r||p.x>1000-r||p.y<r||p.y>625-r;
  });
  if(invisible)fitView();
}

function pause(label="재생 일시정지"){
  running=false;
  lastTime=0;
  accumulated=0;
  uiDirty=true;
  $("play").textContent=
    engine?.stopInfo?.kind==="observation"
      ?"▶ 다음 관찰 구간"
      :engine?.stopInfo?.kind==="transition"
        ?"▶ 다음 운동 구간":"▶ 다시 재생";
  $("status").textContent=label;
  renderObservationControls();
}

function reset(announce=false){
  running=false;
  lastTime=0;
  accumulated=0;
  finished=false;
  study.revealed=false;
  study.predictions={};
  equationSolution=null;
  lessonStep=0;
  lessonCache=null;

  engine=createEngine(scene,textbookEnabled);
  setObservation(
    engine,observationDistance,observationTarget,observationMode
  );
  populateObservationTargets();
  setObservation(
    engine,observationDistance,observationTarget,observationMode
  );

  $("play").textContent="▶ 시작";
  $("status").textContent="초기 배치 · 실험 준비";
  uiDirty=true;
  renderStudy(true);
  render(true);

  if(announce){
    message(
      "처음 위치·초기 속도·관찰 거리의 시작점으로 돌아왔습니다. 8단계 풀이를 다시 확인할 수 있습니다."
    );
  }
}

function start(){
  if(running){
    pause("학습을 위한 수동 일시정지");
    render(true);
    return;
  }

  const errors=validate(scene);
  if(errors.length){
    message(errors.join("\n"),true);
    return;
  }

  if(route.length){
    message("연결 중인 줄을 먼저 완성하거나 취소하세요.",true);
    return;
  }

  const observationError=observationProblem(engine);
  if(observationError){
    pause("관찰 조건 확인 필요");
    message(observationError,true);
    return;
  }

  if(engine.stopInfo?.kind==="limit"){
    message(
      engine.event+" 처음 위치로 초기화하거나 배치를 수정하세요.",
      true
    );
    return;
  }

  if(physicalRest(engine)){
    engine.event="속도와 알짜힘이 모두 0인 실제 평형 상태입니다.";
    engine.stopInfo={
      kind:"rest",physicalRest:true,text:engine.event
    };
    pause("실제 물리적 정지 · 평형");
    message(engine.event+" 질량이나 힘을 바꾸면 새로 계산합니다.");
    render(true);
    return;
  }

  if(engine.stopInfo?.kind==="observation"||
     engine.observation?.reached||
     engine.stopInfo?.kind==="transition"&&observationMode==="auto"){
    setObservation(
      engine,observationDistance,observationTarget,observationMode
    );
  }

  engine.event="";
  engine.stopInfo=null;
  setTool("select");
  running=true;
  lastTime=0;
  accumulated=0;
  uiDirty=true;
  $("play").textContent="Ⅱ 일시정지";
  $("status").textContent="관찰 구간 재생 중";

  message(engine.observation.physicalTarget
    ?`시간 제한 없이 ${engine.observation.physicalTarget.label} 지점까지 재생합니다. 계산된 운동 조건이 바뀌면 그 지점에서 다음 구간을 계산합니다.`
    :`시간 제한 없이 관찰 거리 ${fmt(observationDistance,2)} m 또는 다음 운동 상태 변화까지 재생합니다.`
  );
  render(true);
}

function checkRuntime(){
  const invalid=engine.dynamic.some(n=>
    ![n.x,n.y,n.vx,n.vy,n.ax,n.ay].every(Number.isFinite)
  );

  if(invalid||engine.residual>.03){
    engine.stopInfo={
      kind:"limit",physicalRest:false,text:"구속조건 수렴 실패"
    };
    pause("계산 지원 한계");
    message(
      "구속조건이 수렴하지 않았습니다. 이 결과를 정답으로 사용하지 말고 줄 연결이나 접촉을 수정하세요.",
      true
    );
    render(true);
    return false;
  }

  if(engine.event){
    const info=engine.stopInfo;
    pause(
      info?.kind==="rest"
        ?"실제 물리적 정지 · 평형"
        :info?.kind==="observation"
          ?"관찰 거리 도달 · 학습 일시정지"
          :info?.kind==="limit"
            ?"모형 지원 한계"
            :info?.kind==="configuration"
              ?"관찰 조건 확인 필요"
              :"운동 상태 변화 · 학습 일시정지"
    );

    message(
      engine.event+
      (info?.kind==="transition"
        ?" 현재 힘은 상태 변화 후 다시 계산한 값입니다. 다시 재생하면 이 지점에서 이어집니다."
        :""),
      info?.kind==="limit"||info?.kind==="configuration"
    );

    render(true);
    return false;
  }
  return true;
}

function stepLearning(){
  pause("한 단계 관찰");
  const errors=validate(scene);
  if(errors.length){
    message(errors.join("\n"),true);
    return;
  }

  if(engine.stopInfo?.kind==="limit"){
    message("지원 한계에서는 초기화하거나 배치를 수정하세요.",true);
    return;
  }

  if(engine.stopInfo?.kind==="observation"||
     engine.stopInfo?.kind==="transition"&&observationMode==="auto"){
    setObservation(
      engine,observationDistance,observationTarget,observationMode
    );
  }

  engine.event="";
  engine.stopInfo=null;
  let remaining=.01;

  while(remaining>1e-10){
    const t=engine.time;
    const h=Math.min(DT,remaining);
    integrate(engine,h);
    remaining-=h;
    if(!checkRuntime()||engine.time===t)break;
  }

  if(!engine.event){
    $("status").textContent="0.01초 진행 · 학습 일시정지";
  }
  keepVisible();
  render(true);
}

function runLessonChecks(){
  runStudyChecks();
  const lines=[];

  const near=(a,b,tol=1e-6)=>{
    if(!Number.isFinite(a)||Math.abs(a-b)>tol){
      throw Error(`${a} ≠ ${b}`);
    }
  };

  const test=(name,fn)=>{
    try{
      fn();
      lines.push("✓ "+name);
    }catch(e){
      lines.push("✕ "+name+" — "+e.message);
    }
  };

  const untilStop=(e,max=100000)=>{
    for(let i=0;i<max&&!e.event;i++)integrate(e);
    if(!e.event)throw Error("종료 조건 미검출");
  };

  test("관찰 2 m: 정확히 도달하고 속도 보존",()=>{
    const e=createEngine(example("train"));
    setObservation(e,2);
    untilStop(e);
    near(observationValue(e),2);
    near(e.dynamic[0].x,6);
    near(e.dynamic[0].vx,Math.sqrt(2*2.4*2));
    if(e.stopInfo.kind!=="observation"){
      throw Error("정지 종류 오분류");
    }
  });

  test("관찰 거리 0.1·0.7·3 m와 질량 변경",()=>{
    for(const distance of [.1,.7,3]){
      const s=example("train");
      s.nodes.filter(DYNAMIC)[0].m=5;
      const e=createEngine(s);
      setObservation(e,distance);
      untilStop(e);
      near(observationValue(e),distance);
      near(
        e.dynamic[0].vx,
        Math.sqrt(2*1.5*distance),1e-5
      );
    }
  });

  test("관찰 대상: 이동 도르래와 반대 물체의 2:1 거리",()=>{
    const e=createEngine(example("moving"));
    const p=e.dynamic.find(n=>n.kind==="moving");
    setObservation(e,1,p.id);
    untilStop(e);
    near(e.travel.get(p.id),1);
    near(e.travel.get(
      e.dynamic.find(n=>n.kind==="body").id
    ),2);
  });

  test("느린 실제 운동: 5초를 넘어도 임의 종료하지 않음",()=>{
    const s={
      version:1,g:0,
      nodes:[node("body",0,2,{vx:.05,mu:0})],
      ropes:[]
    };
    const e=createEngine(s);
    setObservation(e,.5);
    untilStop(e);
    near(e.time,10,1e-5);
    near(e.dynamic[0].vx,.05);
  });

  test("다음 관찰 구간: 위치·속도를 초기화하지 않음",()=>{
    const e=createEngine(example("train"));
    setObservation(e,1);
    untilStop(e);
    const v=e.dynamic[0].vx;
    e.event="";
    e.stopInfo=null;
    setObservation(e,1);
    untilStop(e);
    near(e.dynamic[0].x,6);
    if(e.dynamic[0].vx<=v){
      throw Error("재생에서 속도 소실");
    }
  });

  test("바닥 도달: 접촉 위치에서 충돌 후 실제 정지",()=>{
    const e=createEngine(example("fall"));
    setObservation(e,20);
    untilStop(e);
    near(e.dynamic[0].y,.85);
    near(e.dynamic[0].vy,0);
    near(e.dynamic[0].ay,0);
    if(!e.stopInfo.physicalRest)throw Error("실제 정지 미표시");
    near(e.time,Math.sqrt(2*7.15/9.8),1e-6);
  });

  test("경사면 끝: 끝까지 도달하고 수직항력 제거",()=>{
    const e=createEngine(example("incline"));
    setObservation(e,20);
    untilStop(e);
    const n=e.dynamic[0],p=e.nodes.find(SURFACE);
    const u=surfaceAxes(p);
    near(
      (n.x-p.x)*u.tx+(n.y-p.y)*u.ty,
      -p.length/2
    );
    near(n.ay,-9.8);
    if(e.stopInfo.kind!=="transition"){
      throw Error("상태 변화 오분류");
    }
    const y=n.y;
    e.event="";
    e.stopInfo=null;
    integrate(e);
    if(n.y>=y)throw Error("끝에서 자유낙하로 이어지지 않음");
  });

  test("마찰 정지: 속도 0에서 정지 마찰 재계산",()=>{
    const s={
      version:1,g:9.8,
      nodes:[
        node("platform",0,0,{length:20,mu:.2}),
        node("body",0,.35,{mu:.2,vx:2})
      ],
      ropes:[]
    };
    const e=createEngine(s);
    setObservation(e,10);
    untilStop(e);
    near(e.dynamic[0].x,2*2/(2*.2*9.8));
    near(e.dynamic[0].vx,0);
    near(e.dynamic[0].ax,0);
    if(!physicalRest(e))throw Error("평형 판정 실패");
  });

  test("정지 평형은 화면 일시정지와 구분",()=>{
    const s=example("atwood");
    s.nodes.filter(DYNAMIC)[1].m=2;
    const e=createEngine(s);
    setObservation(e,2);
    integrate(e);
    if(e.stopInfo.kind!=="rest")throw Error("평형 오분류");
    near(e.time,0);
  });

  test("경사면·도르래: 가속도 3.92, 장력 17.64",()=>{
    const e=createEngine(example("inclinePulley"));
    near(-e.dynamic.find(n=>n.name==="B").ay,3.92);
    near(maximumT(e.solution,e.dynamic[0].id),17.64);
    if(classifyLesson(e).type!=="two"){
      throw Error("쉬운 연립 풀이 분류 실패");
    }
  });

  test("마찰 연결: 가속도 1.64, 장력 7.2",()=>{
    const e=createEngine(example("frictionTrain"));
    near(e.dynamic[0].ax,1.64);
    near(maximumT(e.solution,e.dynamic[0].id),7.2);
  });

  test("세 물체: 가속도 2, 장력 4·10",()=>{
    const e=createEngine(example("multiple"));
    e.dynamic.forEach(n=>near(n.ax,2));
    const tensions=e.solution.rows.filter(r=>
      r.kind==="rope"
    ).map(r=>r.force).sort((a,b)=>a-b);
    near(tensions[0],4);
    near(tensions[1],10);
    if(classifyLesson(e).type!=="serial"){
      throw Error("여러 물체 풀이 분류 실패");
    }
  });

  test("정지 마찰 구속력의 유일성 경고",()=>{
    const s=example("frictionTrain");
    s.nodes.filter(DYNAMIC)[1].fx=0;
    const e=createEngine(s);
    if(e.solution.forceDeterminate!==false){
      throw Error("모호한 장력 단일 답 표시");
    }
  });

  test("8단계 풀이가 질량 변경을 반영",()=>{
    const s=example("train");
    s.nodes.filter(DYNAMIC)[0].m=4;
    const e=createEngine(s);
    const steps=buildGuidedSteps(e);
    if(steps.length!==8||!steps[0].html.includes("4.00 kg")){
      throw Error("조건/단계 갱신 실패");
    }
    if(!steps[5].html.includes("T − T")){
      throw Error("장력 소거 설명 없음");
    }
  });

  test("전체 UI: 거리·단계·고정 조건 표시",()=>{
    for(const id of [
      "observationDistance","observationTarget",
      "conditionDock","lessonNext","lessonContent"
    ]){
      if(!$(id))throw Error(id+" 없음");
    }
  });

  test("자동 모드: 바닥이 있으면 2 m에서 조기 정지하지 않음",()=>{
    const e=createEngine(example("fall"));
    setObservation(e,2,"all","auto");
    untilStop(e);
    near(e.dynamic[0].y,.85);
    near(e.travel.get(e.dynamic[0].id),7.15);
  });

  test("자동 모드: 경사면 끝까지 관찰",()=>{
    const e=createEngine(example("incline"));
    setObservation(e,2,"all","auto");
    untilStop(e);
    near(e.travel.get(e.dynamic[0].id),5);
    if(e.stopInfo.eventKind!=="edge"){
      throw Error("경사면 끝 이전 종료");
    }
  });

  test("자동 모드: 실제 종료 조건 없으면 지정 거리 사용",()=>{
    const s={
      version:1,g:0,
      nodes:[node("body",0,1,{vx:1})],
      ropes:[]
    };
    const e=createEngine(s);
    setObservation(e,1.3,"all","auto");
    untilStop(e);
    near(observationValue(e),1.3);
    if(e.stopInfo.kind!=="observation"){
      throw Error("관찰 종료 오분류");
    }
  });

  $("checkResults").textContent+=
    "\n\n거리·운동 변화·상세 풀이 검증\n"+
    lines.join("\n")+
    "\n\n실제 모바일 터치·화면 배치는 브라우저에서 추가 확인해야 합니다.";
}

function renderForceSystem(){
  if(!study.revealed){
    $("systemEquations").innerHTML=
      "<p>위의 계산 결과와 풀이 확인 버튼을 눌러 주세요.</p>";
    return;
  }

  const s=engine.solution;
  if(!s.reliable||s.forceDeterminate===false){
    $("systemEquations").innerHTML=
      "<p class='notice'>초기 충격 또는 구속력의 유일성 문제 때문에 단일 장력 정답을 제시하지 않습니다. 위 8단계 풀이의 조건 안내를 확인하세요.</p>";
    return;
  }

  const steps=buildGuidedSteps(engine);
  $("systemEquations").innerHTML=
    "<h3>운동 방정식</h3>"+steps[4].html+
    "<h3>생략 없이 정리하기</h3>"+steps[5].html;
}

function lessonExtraExamples(kind,makeOriginal){
  if(!["inclinePulley","frictionTrain","multiple"].includes(kind)){
    return makeOriginal(kind);
  }

  if(kind==="frictionTrain"){
    const s=makeOriginal("train");
    s.nodes.forEach(n=>{
      if(DYNAMIC(n)||SURFACE(n))n.mu=.2;
    });
    s.nodes.filter(DYNAMIC)[1].fx=18;
    return s;
  }

  if(kind==="multiple"){
    const s={version:1,g:9.8,nodes:[],ropes:[]};
    s.nodes.push(node("platform",8,1,{length:14,mu:0}));
    const a=node("body",3,1.35,{name:"A",m:2,mu:0});
    const b=node("body",6,1.35,{name:"B",m:3,mu:0});
    const c=node("body",9,1.35,{name:"C",m:1,mu:0,fx:12});
    s.nodes.push(a,b,c);
    s.ropes.push(
      rope(s.nodes,[a.id,b.id]),
      rope(s.nodes,[b.id,c.id])
    );
    return s;
  }

  const s={version:1,g:9.8,nodes:[],ropes:[]};
  const theta=Math.PI/6;
  const ramp=node("ramp",6,3,{length:6,angle:30,mu:0});
  const a=node(
    "body",
    6-Math.sin(theta)*.35,
    3+Math.cos(theta)*.35,
    {name:"A",m:2,mu:0}
  );
  const p=node(
    "fixed",
    a.x+3*Math.cos(theta),
    a.y+3*Math.sin(theta),
    {name:"P₁"}
  );
  const q=node("fixed",12,p.y,{name:"P₂"});
  const b=node("body",12,p.y-2.5,{name:"B",m:3,mu:0});
  s.nodes.push(ramp,a,p,q,b);
  s.ropes.push(rope(s.nodes,[a.id,p.id,q.id,b.id]));
  return s;
}

function sourceFingerprint(text){
  let h=2166136261;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return (h>>>0).toString(16);
}

function produceUpdate(input,coreText,uiText,extraExampleText){
  let src=input.replace(/^\uFEFF/,"").replace(/\r\n/g,"\n");

  if(src.includes("function forecastPhysicalEvent")&&
     src.includes("function buildGuidedSteps")&&
     src.includes("function installLessonUI")){
    return src;
  }

  if(sourceFingerprint(src)!=="ccb6295d"){
    throw Error(
      "현재 파일이 검토한 버전과 다릅니다. 자동 수정을 중단했습니다. app.js 전체 파일을 다시 확인해야 합니다."
    );
  }

  const replace=(before,after)=>{
    if(!src.includes(before)){
      throw Error("수정 지점을 찾지 못했습니다: "+before.slice(0,70));
    }
    src=src.replace(before,after);
  };

  const block=(start,end,text)=>{
    const a=src.indexOf(start);
    const b=src.indexOf(end,a+1);
    if(a<0||b<0)throw Error("함수 경계를 찾지 못했습니다: "+start);
    src=src.slice(0,a)+text+"\n\n"+src.slice(b);
  };

  replace(
    '    function example(kind = "train") {',
    '    function originalExample(kind = "train") {'
  );

  const pos=src.indexOf("    function addTerm");
  src=src.slice(0,pos)+extraExampleText+
    '\nfunction example(kind="train"){return lessonExtraExamples(kind,originalExample);}\n'+
    src.slice(pos);

  block("    function boundaryReason","    function createEngine","");
  block("    function integrate","    return {",coreText);

  replace(
    "      e.solution = solveProblem(e);",
    "      e.travel=new Map(e.dynamic.map(n=>[n.id,0]));e.departed=new Set();e.observation=null;\n      e.solution = solveProblem(e);"
  );

  replace(
    "      seedSolution(e);\n      record(e);",
    "      seedSolution(e);\n      e.phase={solution:e.solution,start:0};\n      record(e);"
  );

  replace(
    'if (Math.abs(along) <= p.length / 2 &&\n              distance > -0.02 && gap < reach) {',
    'if (!e.departed?.has(b.id+"|"+p.id) && Math.abs(along) <= p.length / 2 &&\n              distance > -0.02 && gap < reach) {'
  );

  replace(
    "      return {\n        constant: reasons.length === 0,",
`
      const staticCandidates=rows.filter(r=>r.kind==="rope"||r.kind==="normal"&&r.force>1e-7||r.kind==="friction"&&r.mu>1e-9&&r.parent.force>1e-7);
      const stationary=e.dynamic.every(n=>hypot(n.vx,n.vy)<1e-7&&hypot(accelerations.get(n.id).x,accelerations.get(n.id).y)<1e-7);
      const staticGram=staticCandidates.map(r=>staticCandidates.map(q=>matrixEntry(r,q,e.map)));
      const uncertain=stationary&&staticCandidates.some(r=>r.kind==="friction")&&rank(staticGram)<staticCandidates.length;
      if(uncertain)reasons.push("정지 마찰이 여러 곳에서 힘을 나눠 받는 구조입니다. 장력·마찰력의 유일성을 확인할 수 없어 하나의 구속력을 정답으로 표시하지 않습니다.");
      values.forEach(v=>v.indeterminate=uncertain);
      return {
        forceDeterminate: !uncertain,
        constant: reasons.length === 0,`
  );

  replace(
    "      gaussian, solveProblem\n",
    "      gaussian, solveProblem, setObservation, observationValue, physicalRest, surfaceAxes, rebasePhase, observationProblem\n"
  );

  replace(
    "geometry, matrixEntry, validate, createEngine, integrate\n  } = PhysicsCore();",
    "geometry, matrixEntry, validate, createEngine, integrate, setObservation, observationValue, physicalRest, surfaceAxes, rebasePhase, observationProblem\n  } = PhysicsCore();"
  );

  replace(
    "  let equationSolution = null;",
    '  let equationSolution = null;\n  let lessonStep=0,lessonCache=null,dockCache=null,observationDistance=2,observationTarget="all",observationMode="auto";'
  );

  block("  function pause(","  function changed(","");
  block("  function start(","  function project(","");
  block("  function renderForceSystem","  function analysis","");

  replace(
    "  function maximumT(solution, id) {\n",
    "  function maximumT(solution, id) {\n    if(solution.forceDeterminate===false)return NaN;\n"
  );

  replace(
    "  function currentT(id) {\n",
    "  function currentT(id) {\n    if(engine.phase?.solution.forceDeterminate===false)return NaN;\n"
  );

  replace(
    "  function initialFBD(n, value) {\n",
    '  function initialFBD(n, value) {\n    if(value.indeterminate)value={...value,forces:value.forces.filter(f=>["gravity","external"].includes(f.kind))};\n'
  );

  replace(
    '${fmt(v.normal, 3)}',
    '${fmt(s.forceDeterminate===false?NaN:v.normal, 3)}'
  );

  replace(
    '${fmt(v.friction, 3)}',
    '${fmt(s.forceDeterminate===false?NaN:v.friction, 3)}'
  );

  const rs=src.indexOf("  function renderStudy(");
  const re=src.indexOf("  function analysis(",rs);
  let part=src.slice(rs,re);
  const last=part.lastIndexOf("\n  }");

  part=part.slice(0,last)+`
    if(s.forceDeterminate===false){
      $("studyTag").textContent="정지 마찰 구속력: 유일성 미확인";
      $("studyNotice").textContent=s.reasons.join("\\n")+" 가속도와 알짜힘 0은 확인할 수 있지만 장력·마찰력 한 값을 정답으로 고정하지 않습니다.";
    }
    renderGuidedLesson();renderDock();renderObservationControls();
`+part.slice(last);

  src=src.slice(0,rs)+part+src.slice(re);

  replace(
    '    if (!study.revealed) {\n      $("fbd")',
`
    if(study.revealed&&engine.phase?.solution.forceDeterminate===false){
      $("fbd").innerHTML=n&&DYNAMIC(n)?initialFBD(n,{forces:n.forces,indeterminate:true}):"";
      $("bodyEquations").innerHTML="<p class=\\"notice\\">현재 평형의 알짜힘과 가속도는 0이지만, 정지 마찰과 장력이 여러 방식으로 분담될 수 있습니다. 자유물체도에는 중력·외력만 수치 표시하고 구속력의 단일 수치를 제시하지 않습니다.</p>";
      if(equationSolution!==engine.solution){renderForceSystem();equationSolution=engine.solution;}return;
    }
    if (!study.revealed) {
      $("fbd")`
  );

  replace(
    '        body.forces.forEach((f, i) => {',
    '        body.forces.filter(f=>engine.phase?.solution.forceDeterminate!==false||["gravity","external"].includes(f.kind)).forEach((f, i) => {'
  );

  replace(
    '"T " + fmt((row?.impulse || 0) /',
    '"T " + fmt(engine.phase?.solution.forceDeterminate===false?NaN:(row?.impulse || 0) /'
  );

  replace(
    "  function render(full = false) {\n    draw();",
    "  function render(full = false) {\n    keepVisible();draw();"
  );

  block(
    '  $("step").onclick = () => {',
    '  ["showForces"',
    '  $("step").onclick=stepLearning;'
  );

  replace(
    '  $("runChecks").onclick = runStudyChecks;',
    '  $("runChecks").onclick = runLessonChecks;'
  );

  replace(
    '      if (now - renderAt > 33) {\n        draw();',
    '      if (now - renderAt > 33) {\n        keepVisible();draw();'
  );

  replace(
    "  installStudyUI();\n  reset();",
    uiText+
    "\n\n  installStudyUI();\n  installLessonUI();\n  reset();"
  );

  src=src.replace("1格 = 1 m","1칸 = 1 m");

  new Function(src);
  return src;
}

const CORE_TEXT=[
  quadraticTimes,surfaceAxes,physicalRest,projectedState,
  firstCrossing,nextPhysicalEvent,publishCurrentPhase,
  resolveInstantImpact,rebasePhase,handlePhysicalEvent,
  forecastPhysicalEvent,setObservation,observationValue,
  saveMotion,restoreMotion,rawAdvance,stepDistances,
  numericalTransition,observationProblem,integrate
].map(f=>f.toString()).join("\n\n");

const UI_TEXT=[
  lessonDirection,forceProjection,classifyLesson,
  readableElimination,lessonCalculation,buildGuidedSteps,
  installLessonUI,populateObservationTargets,
  renderObservationControls,renderDock,renderGuidedLesson,
  keepVisible,pause,reset,start,checkRuntime,stepLearning,
  runLessonChecks,renderForceSystem
].map(f=>f.toString()).join("\n\n");

const get=id=>document.getElementById(id);
let result="";

function generate(source){
  try{
    result=produceUpdate(
      source,CORE_TEXT,UI_TEXT,lessonExtraExamples.toString()
    );
    get("output").value=result;
    get("copy").disabled=false;
    get("download").disabled=false;
    get("status").textContent=
      "app.js 전체 파일 생성 완료 · JavaScript 구문 검사 통과. 아래에서 전체 코드를 복사하거나 파일로 저장하세요.";
  }catch(error){
    result="";
    get("copy").disabled=true;
    get("download").disabled=true;
    get("status").textContent=error.message;
  }
}

get("fetchSource").onclick=async()=>{
  get("status").textContent=
    "현재 저장소의 app.js를 읽는 중입니다…";
  try{
    const response=await fetch(
      "https://raw.githubusercontent.com/lsh99071-art/physicssandbox/main/app.js?v="+Date.now(),
      {cache:"no-store"}
    );
    if(!response.ok){
      throw Error("원본 읽기 실패: HTTP "+response.status);
    }
    generate(await response.text());
  }catch(error){
    get("status").textContent=
      error.message+
      " · 현재 app.js를 다운로드하여 파일 선택으로 불러올 수도 있습니다.";
  }
};

get("sourceFile").onchange=async e=>{
  const file=e.target.files[0];
  if(!file)return;
  if(file.size>1000000){
    get("status").textContent=
      "1 MB 이하의 app.js를 선택하세요.";
    return;
  }
  generate(await file.text());
};

get("copy").onclick=async()=>{
  try{
    await navigator.clipboard.writeText(result);
    get("status").textContent=
      "app.js 전체 코드를 복사했습니다. GitHub의 기존 app.js 전체 내용과 교체하세요.";
  }catch{
    get("output").focus();
    get("output").select();
    get("output").setSelectionRange(0,result.length);
    const copied=document.execCommand("copy");
    get("status").textContent=copied
      ?"전체 코드를 복사했습니다."
      :"코드가 전체 선택됐습니다. 브라우저의 복사 메뉴를 누르세요.";
  }
};

get("download").onclick=()=>{
  const url=URL.createObjectURL(
    new Blob([result],{type:"text/javascript;charset=utf-8"})
  );
  const a=document.createElement("a");
  a.href=url;
  a.download="app.js";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  get("status").textContent=
    "app.js 저장을 요청했습니다. 다운로드된 파일을 기존 app.js와 교체하세요.";
};

})();
</script>
</body>
</html>
