(function () {
  'use strict';
  const core = window.ExploreCore;
  const sourcePuzzles = window.PalacePuzzles;
  let puzzles,restoredSave=false;
  const $ = id => document.getElementById(id);
  const KEY = 'palace-exploration-v3';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = core.fresh(), warning = '', selected = 0, pendingClue = null, transitionBusy = false, audio;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const restored = core.restore(raw); if (restored) {state = restored;restoredSave=true;} else warning = '存檔無法讀取，已建立新調查。'; }
  } catch { warning = '瀏覽器禁止儲存，當次可玩，關閉後無法延續。'; }
  if(!restoredSave)state.questionSet=window.QuestionVariants.newSet();
  if (!Array.isArray(sourcePuzzles) || sourcePuzzles.length !== 12) { $('save-message').textContent = '題庫載入失敗，請保留src資料夾與入口檔相對位置。'; return; }
  puzzles=window.QuestionVariants.build(sourcePuzzles,state.questionSet);
  let config = [
    {labels:['末位數字','三位數的數字和','可證成的整除數'],max:[9,20,10],initial:[1,8,4],note:'補上43□的末位，核對偶數與數字和，再選出能由2與3的整除性證成的令牌。'},
    {labels:['密牌號','除以5的商','除以3的商'],max:[30,10,10],initial:[12,2,4],note:'點選密牌觀察兩道餘數；商會隨牌號更新。找出同時符合兩份記錄的牌號。'},
    {labels:['真藥方編號','定位貨架號','原有藥包數'],max:[60,4,60],initial:[31,1,48],note:'點藥罐選出符合全部條件的編號，再定位貨架並還原藥包數。'},
    {labels:['每段長度（公分）','青緞段數','紅緞段數'],max:[60,30,30],totals:[84,126],initial:[20,4,6],note:'移動裁布尺，觀察切口與餘料；相同段長且無剩料，還要盡可能長。'},
    {labels:['質底數 p','p 的指數 a','3 的指數 b'],max:[7,6,6],initial:[2,2,2],note:'按質數籌碼調整底數，再調整指數，將完整乘積還原為72。'},
    {labels:['已選配對數','不同正因數個數','中央因數'],max:[7,14,36],initial:[0,0,0],note:'選齊乘積36且較小的數在前的配對；翻轉不重算，平方根只列一次。'},
    {labels:['鼓隊間隔（分鐘）','舞隊間隔（分鐘）','可接頭（第幾分鐘）'],max:[20,20,60],offset:[0,0],initial:[6,10,20],note:'用合演時間軸確認兩隊同台，並避開11時20分之前的時刻。'},
    {labels:['錯誤說法編號','反例數字','修正句編號'],max:[3,11,3],initial:[2,7,1],note:'先找錯誤的全稱說法，再選能推翻它的反例，最後蓋上正確的修正印章。'},
    {labels:['正方形每邊格數','需要補入份數','總份數'],max:[10,60,100],initial:[6,1,36],note:'原有40份，移動方陣邊長；只能補不能拿走，選新增最少的完整正方形。'},
    {labels:['兵符編號','末兩位組成的數','所有位數的數字和'],max:[3,60,20],initial:[1,34,9],note:'點兵符並觀察末兩位與數字和；偶數不一定能被4整除。'},
    {labels:['暗號門牌','除以4的商','除以6的商'],max:[39,10,10],initial:[25,6,4],note:'在25至39中逐一驗牌，同時滿足除4餘1、除6餘3。不是換崗時間題。'},
    {labels:['36的最小質因數','與它配對的正因數','重複計數的質因數個數'],max:[7,36,20],initial:[3,12,1],note:'先回驗兩因數乘積為36，再逐次拆出質數直到剩1；重複出現也要計數。'}
  ];
  const diverse=[0,1,5,7,8,9,10];
  let pairOptions=[[1,36],[2,18],[3,12],[4,9],[5,7],[6,6],[9,4]];
  function minimum(i,n){return i===1&&n===0?puzzles[1].parameters.min:i===10&&n===0?puzzles[10].parameters.min:i===5||i===0&&n===0||i===2&&n===1||i===8&&n===1?0:1;}
  const baselineConfig=JSON.parse(JSON.stringify(config));
  function applyQuestionSet(){
    puzzles=window.QuestionVariants.build(sourcePuzzles,state.questionSet);config=JSON.parse(JSON.stringify(baselineConfig));pairOptions=puzzles[5].parameters.pairOptions;
    puzzles.forEach((p,i)=>{if(p.variant)config[i].note=p.intro.join(' ');});
    config[0].initial=[1,String(puzzles[0].parameters.prefix).split('').reduce((a,b)=>a+Number(b),0)+1,4];
    for(const i of [1,10]){const t=puzzles[i].parameters;config[i].max=[t.max,20,20];config[i].initial=[t.min,1,1];}
    const medicine=puzzles[2].parameters;config[2].initial=[medicine.candidates[0],1,48];
    config[3].totals=puzzles[3].parameters.totals;
    config[4].note=`按質數籌碼調整底數，再調整指數，將完整乘積還原為${puzzles[4].parameters.target}。`;
    config[5].note=`選齊乘積${puzzles[5].parameters.target}且較小的數在前的配對；翻轉不重算，平方根只列一次。`;
    config[7].max[1]=60;config[7].initial[1]=puzzles[7].parameters.counters[0];
    config[11].labels[0]=puzzles[11].parameters.target+'的最小質因數';config[11].max[1]=60;
    config[11].note=`回驗兩因數乘積為${puzzles[11].parameters.target}，再逐次拆出質數直到剩1；重複出現也要計數。`;
  }
  applyQuestionSet();
  const coords = [[240,170],[250,365],[165,500],[960,530],[475,510],[1190,690],[1160,315],[1200,480],[1250,135],[230,700],[700,790],[700,145]];
  let view = { zoom: innerWidth < 720 ? .64 : .83, x:0, y:0 };
  const palaceSVG = '<svg viewBox="0 0 160 100" aria-hidden="true"><path class="roof" d="M20 25Q30 21 38 7H122Q130 21 140 25L154 31H6Z"/><path class="roof-detail" d="M34 18H126M22 26H138"/><path class="wall" d="M20 33H140V83H20Z"/><path class="wood" d="M28 35H35V80H28ZM74 35H86V80H74ZM125 35H132V80H125Z"/><path class="plaque" d="M55 38H105V53H55Z"/><path fill="#6e7a62" d="M12 84H148V91H12ZM3 92H157V98H3Z"/><path fill="#87957a" d="M41 58H62V76H41ZM99 58H120V76H99Z"/></svg>';
  function make(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function asset(file,className,alt='') { const img=make('img',className);img.src='assets/'+file;img.alt=alt;img.draggable=false;return img; }
  const kitchenProps=['props/fruit_basket.png','props/food_box.png','props/ledger.png'];
  const gardenProps=['props/garden_notice.png','props/garden_notice.png','props/garden_lantern.png'];
  const materialProps=[kitchenProps,gardenProps,['props/herb_packet.png','props/medicine_cabinet.png','props/clinic_desk.png'],['props/tailor_fabric.png','props/tailor_frame.png','props/tailor_scissors.png'],['props/library_1.png','props/library_2.png','props/library_3.png'],['props/treasury_1.png','props/treasury_2.png','props/treasury_3.png'],['props/banquet_1.png','props/banquet_2.png','props/banquet_3.png'],['props/alliance_1.png','props/alliance_2.png','props/alliance_3.png'],['props/cold_palace_1.png','props/cold_palace_2.png','props/cold_palace_3.png'],['props/guards_1.png','props/guards_2.png','props/guards_3.png'],['props/gate_1.png','props/gate_2.png','props/gate_3.png'],['props/throne_1.png','props/throne_2.png','props/throne_3.png']];
  const materialActors=['kitchen_steward.png','garden_attendant.png','clinic_doctor.png','tailor_officer.png','library_officer.png','treasury_officer.png','banquet_officer.png','alliance_officer.png','cold_palace_officer.png','guards_officer.png','gate_officer.png','throne_officer.png'];
  const materialEvidence=['props/evidence_seal.png','props/garden_letter.png','props/clinic_letter.png','props/tailor_evidence.png','props/library_evidence.png','props/treasury_evidence.png','props/banquet_evidence.png','props/alliance_evidence.png','props/cold_palace_evidence.png','props/guards_evidence.png','props/gate_evidence.png','props/throne_evidence.png'];
  const laterBackgrounds=['backgrounds/bg_05_library.png', 'backgrounds/bg_06_treasury.png', 'backgrounds/bg_07_banquet.png', 'backgrounds/bg_08_alliance.png', 'backgrounds/bg_09_cold_palace.png', 'backgrounds/bg_10_guards.png', 'backgrounds/bg_11_gate.png','backgrounds/bg_12_throne.png'];
  const roomBackgrounds=['backgrounds/bg_01_kitchen.png','backgrounds/bg_02_garden.png','backgrounds/bg_03_clinic.png','backgrounds/bg_04_tailor.png',...laterBackgrounds];
  // Entrance approaches follow the illustrated axis and cross-courtyard lanes.
  const approaches=[[[430,270],[430,215],[300,215]],[[430,330],[400,330]],[[390,490],[185,490]],[[1010,490],[920,490]],[[700,490],[570,490]],[[1010,490],[1030,580],[1140,580]],[[1010,210],[1100,270]],[[1010,390],[1030,390]],[[1010,210],[1110,190],[1200,170]],[[390,490],[330,570]],[[700,490]],[[700,220]]];
  let journey=null;
  const materialCG=['cg_01_ledger_closeup.png','cg_02_garden.png','cg_03_clinic.png','cg_04_tailor.png','cg_05_library.png','cg_06_treasury.png','cg_07_banquet.png','cg_08_alliance.png','cg_09_cold_palace.png','cg_10_guards.png','cg_11_gate.png','cg_12_throne.png'];
  $('map-canvas').classList.add('has-map-art');
  const npcImage=asset('characters/kitchen_steward.png','npc-art','御膳房總管立繪');npcImage.hidden=true;$('npc-talk').prepend(npcImage);
  const dialogueImage=asset('characters/kitchen_steward.png','npc-art','御膳房總管立繪');dialogueImage.hidden=true;$('dialog-scene').prepend(dialogueImage);
  const heroImage=asset('characters/hero.png','hero-art','宮廷密探立繪');heroImage.hidden=true;$('dialog-scene').prepend(heroImage);
  const gardenFlowers=asset('props/garden_flowers.png','garden-flower-art','御花園牡丹花盆');gardenFlowers.hidden=true;$('room-scene').append(gardenFlowers);
  function animate(el, frames, options) {
    if (reduced.matches) return Promise.resolve();
    return el.animate(frames, { duration:450, easing:'cubic-bezier(.16,1,.3,1)', ...options }).finished.catch(() => {});
  }
  async function changeScene(action) {
    if (transitionBusy) return;
    transitionBusy = true; $('veil').classList.add('busy');
    await animate($('veil'), [{opacity:0},{opacity:1}], {duration:450,fill:'forwards'});
    action();
    await animate($('veil'), [{opacity:1},{opacity:0}], {duration:900,fill:'forwards'});
    $('veil').classList.remove('busy'); transitionBusy = false;
  }
  function save() {
    try { localStorage.setItem(KEY,JSON.stringify(state)); if (!warning.includes('禁止')) warning = ''; }
    catch { if(!warning.includes('禁止'))warning = '無法儲存；可繼續當次遊玩，關閉後可能無法延續。'; }
    $('save-message').textContent = warning || '探索進度已本機保存 · 不傳送個人資料';
    renderHud();
  }
  function renderHud() {
    $('progress').textContent = `證據 ${core.evidence(state)} / 12 · 聲望 ${core.reputation(state)}`;
    $('sound').textContent = `音效：${state.muted?'關':'開'}`;
    $('sound').setAttribute('aria-pressed',String(!state.muted));
  }
  function tone(ok) {
    if (state.muted || ok) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(); osc.connect(gain); gain.connect(audio.destination);
      osc.frequency.setValueAtTime(ok?392:196,audio.currentTime); osc.frequency.setValueAtTime(ok?587:164,audio.currentTime+.15);
      gain.gain.setValueAtTime(.04,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.4); osc.start(); osc.stop(audio.currentTime+.41);
    } catch { /* Sound is optional; game remains usable. */ }
  }
  function panMap() { $('map-canvas').style.transform = `translate(calc(-50% + ${view.x}px),calc(-50% + ${view.y}px)) scale(${view.zoom})`; }
  function focusMapTarget() {
    if(journey){$('world').style.setProperty('--journey-hud',document.querySelector('.hud').getBoundingClientRect().height+'px');return;}
    if(innerWidth>=720)return;
    view.zoom=.64;view.x=(700-coords[selected][0])*view.zoom-65;view.y=(394-coords[selected][1]*.788)*view.zoom-75;panMap();
  }
  let drag = null;
  $('map-viewport').onpointerdown = e => { if (e.target.closest('button')) return; drag = {x:e.clientX,y:e.clientY,oldX:view.x,oldY:view.y}; $('map-viewport').setPointerCapture(e.pointerId); };
  $('map-viewport').onpointermove = e => { if (!drag) return; view.x = Math.max(-650,Math.min(650,drag.oldX+e.clientX-drag.x)); view.y = Math.max(-450,Math.min(450,drag.oldY+e.clientY-drag.y)); panMap(); };
  $('map-viewport').onpointerup = $('map-viewport').onpointercancel = () => { drag=null; };
  $('zoom-in').onclick = () => { view.zoom=Math.min(1.6,view.zoom+.12);panMap(); };
  $('zoom-out').onclick = () => { view.zoom=Math.max(.45,view.zoom-.12);panMap(); };
  $('map-reset').onclick = () => { view={zoom:innerWidth<720?.64:.83,x:0,y:0};focusMapTarget();panMap(); };
  window.addEventListener('resize',focusMapTarget);
  function selectPlace(i) {
    selected=i; const p=puzzles[i], unlocked=core.unlocked(state,i);
    $('dest-number').textContent=`第 ${i+1} 局 · ${p.topic}`;
    $('dest-name').textContent=p.location+' · '+p.title;
    $('dest-summary').textContent=p.intro[0];
    $('dest-state').textContent=state.levels[i].complete?'已查明，可重訪查看證據。':unlocked?'調查已開放 · 搜集線索後解開機關。':`先取得${puzzles[i-1].location}的證據，才能循線進入。`;
    $('enter').disabled=!unlocked;$('enter').textContent=state.levels[i].complete?'重訪現場 →':'循線前往 →';
    document.querySelectorAll('.map-node').forEach((b,n)=>{b.className=`map-node${n===i?' selected':''}${state.levels[n].complete?' done':''}${core.unlocked(state,n)?' available':' locked'}`;});
  }
  puzzles.forEach((p,i)=>{
    const b=make('button','map-node'); b.style.left=coords[i][0]/14+'%';b.style.top=coords[i][1]/10+'%';
    b.innerHTML=palaceSVG;b.append(make('span','node-name',p.location),make('span','node-number',String(i+1).padStart(2,'0')));
    b.setAttribute('aria-label',`${p.location}，第${i+1}局`);b.onclick=()=>selectPlace(i);$('map-buildings').append(b);
  });
  // Local vector trees extend the existing geometric palace components.
  for(let i=0;i<62;i++) {
    const x=140+(i*193)%1120,y=125+(i*137)%720;
    if(Math.abs(x-680)<85)continue;
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.innerHTML=`<path d="M${x} ${y+12}V${y+35}" stroke="#80764f" stroke-width="4"/><circle cx="${x}" cy="${y}" r="18" fill="#829575"/><circle cx="${x-8}" cy="${y+8}" r="13" fill="#6c8668"/>`;
    $('map-gardens').append(g);
  }
  function showMap(persist=true) {
    state.current=-1;if(persist)save();$('world').hidden=false;$('room').hidden=true;$('workbench').hidden=true;
    heroAt(state.place<0?[700,490]:approaches[state.place].at(-1));
    selectPlace(Math.min(core.evidence(state),11));focusMapTarget();panMap();window.scrollTo(0,0);
  }
  function heroAt(point,facing=1){$('map-hero').style.transform=`translate(${point[0]}px,${point[1]}px)`;$('map-hero').style.setProperty('--facing',String(facing));}
  function journeyProgress(value){$('journey-progress').setAttribute('aria-valuenow',String(Math.round(value)));$('journey-progress').firstElementChild.style.transform=`scaleX(${value/100})`;}
  function skipJourney(){if(journey){journey.skipped=true;journey.finish?.();}}
  function journeyTween(duration,draw){
    const current=journey;
    if(current.skipped||reduced.matches){current.skipped=true;draw(1);return Promise.resolve();}
    return new Promise(resolve=>{
      let start,frame;
      const finish=()=>{cancelAnimationFrame(frame);draw(1);current.finish=null;resolve();};current.finish=finish;
      const tick=now=>{if(current.skipped||reduced.matches){current.skipped=true;finish();return;}start??=now;const t=Math.min(1,(now-start)/duration);draw(t);if(t<1)frame=requestAnimationFrame(tick);else{current.finish=null;resolve();}};
      frame=requestAnimationFrame(tick);
    });
  }
  function routeBetween(from,to){
    if(from===to){const door=approaches[to].at(-1);return [door,[door[0],door[1]-40]];}
    const source=from<0?[[700,490]]:[...approaches[from]].reverse();
    const route=[...source,[700,source.at(-1)[1]],[700,approaches[to][0][1]],...approaches[to]];
    return route.filter((p,n)=>!n||p[0]!==route[n-1][0]||p[1]!==route[n-1][1]);
  }
  async function beginJourney(i){
    if(transitionBusy||!core.unlocked(state,i))return;
    document.dispatchEvent(new CustomEvent('palace-sound',{detail:'entry'}));
    transitionBusy=true;const from=state.place,previousView={...view};journey={skipped:reduced.matches,finish:null};
    $('home').inert=$('journal-open').inert=$('settings').inert=true;
    try{
      if(reduced.matches){
        $('veil').classList.add('busy');await $('veil').animate([{opacity:0},{opacity:1}],{duration:120,fill:'forwards'}).finished;
        core.enter(state,i);room(i);save();
        await $('veil').animate([{opacity:1},{opacity:0}],{duration:120,fill:'forwards'}).finished;
      }else{
        showMap(false);selectPlace(i);$('world').classList.add('travelling');$('world').style.setProperty('--journey-hud',document.querySelector('.hud').getBoundingClientRect().height+'px');
        $('map-viewport').inert=true;document.querySelector('.map-controls').inert=true;$('destination').inert=true;
        $('journey-controls').hidden=false;$('journey-heading').textContent=from===i?`重訪${puzzles[i].location} · 步入廳門`:`${from<0?'宮城入口':puzzles[from].location} → ${puzzles[i].location}`;$('journey-status').textContent='正在準備主角，稍候沿宮道出發';journeyProgress(0);$('journey-skip').focus({preventScroll:true});
        $('entry-background').src='assets/'+roomBackgrounds[i];$('entry-background').alt=puzzles[i].location+'廳內景';
        const route=routeBetween(from,i),lengths=route.slice(1).map((p,n)=>Math.hypot(p[0]-route[n][0],p[1]-route[n][1])),total=lengths.reduce((a,b)=>a+b,0);
        $('journey-path').setAttribute('d',route.map((p,n)=>(n?'L':'M')+p.join(' ')).join(' '));$('journey-route').toggleAttribute('hidden',total===0);$('journey-path').style.strokeDasharray=String(total);$('journey-path').style.strokeDashoffset=String(total);
        const viewport=$('map-viewport'),zoom=Math.max(innerWidth<720?1.15:1.3,viewport.clientWidth/1400,viewport.clientHeight/788)*1.02;
        const camera=(point,z)=>{const bx=Math.max(0,(1400*z-viewport.clientWidth)/2),by=Math.max(0,(788*z-viewport.clientHeight)/2);return {zoom:z,x:Math.max(-bx,Math.min(bx,(700-point[0])*z)),y:Math.max(-by,Math.min(by,(394-point[1])*z+15))};};
        const follow=(point,z=zoom)=>{view=camera(point,z);panMap();};
        heroAt(route[0]);$('world').dataset.journeyPhase='departing';
        await new Promise(resolve=>{const current=journey;let done=false;const ready=()=>{if(done)return;done=true;current.finish=null;resolve();};current.finish=ready;$('map-hero').querySelector('img').decode().catch(()=>{}).then(ready);});$('journey-status').textContent=from===i?'密探正在走近廳門':'密探正在沿著宮道前往';
        const initial={...view},target=camera(route[0],zoom);await journeyTween(900,t=>{const e=1-Math.pow(1-t,3);view={zoom:initial.zoom+(target.zoom-initial.zoom)*e,x:initial.x+(target.x-initial.x)*e,y:initial.y+(target.y-initial.y)*e};panMap();});
        $('world').dataset.journeyPhase='walking';$('map-hero').classList.add('walking');
        if(total>0)await journeyTween(from===i?3000:Math.max(6000,Math.min(10000,total*9)),t=>{
          let distance=t*total,segment=0;while(segment<lengths.length-1&&distance>lengths[segment]){distance-=lengths[segment];segment++;}
          const a=route[segment],b=route[segment+1],ratio=lengths[segment]?distance/lengths[segment]:1,point=[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio];
          heroAt(point,b[0]<a[0]?-1:1);follow(point);$('journey-path').style.strokeDashoffset=String(total*(1-t));journeyProgress(t*78);
        });
        $('map-hero').classList.remove('walking');$('world').dataset.journeyPhase='approaching';$('journey-status').textContent=`已抵達${puzzles[i].location}，準備入廳`;
        await journeyTween(1200,()=>{});
        const door=route.at(-1);await journeyTween(1400,t=>{const e=t*t*(3-2*t);follow(door,zoom+e*.4);$('map-hero').style.opacity=String(1-e*.65);journeyProgress(78+t*8);});
        if(!journey.skipped){
          $('entry-title').textContent=puzzles[i].location;$('hall-entry').dataset.progress='0';$('entry-door-left').style.transform=$('entry-door-right').style.transform='none';$('entry-hero').style.cssText='';$('entry-background').style.transform='scale(1)';$('hall-entry').showModal();
          core.enter(state,i);room(i);save();
          await journeyTween(4600,t=>{
            const open=Math.max(0,Math.min(1,(t-.12)/.65)),walk=Math.max(0,Math.min(1,(t-.35)/.6));
            $('hall-entry').dataset.progress=String(t);$('entry-door-left').style.transform=`translateX(${-open*102}%) rotateY(${-open*35}deg)`;$('entry-door-right').style.transform=`translateX(${open*102}%) rotateY(${open*35}deg)`;
            $('entry-background').style.transform=`scale(${1+t*.1})`;$('entry-hero').style.transform=`translateY(${-walk*70}px) scale(${1-walk*.35})`;$('entry-hero').style.opacity=String(1-Math.max(0,Math.min(1,(t-.65)/.25)));journeyProgress(86+t*14);
          });await journeyTween(800,()=>{});$('hall-entry').close();
        }else{core.enter(state,i);room(i);save();}
      }
      if(!state.levels[i].filmSeen)film(talk);else talk();
    }finally{
      if($('hall-entry').open)$('hall-entry').close();$('world').classList.remove('travelling');delete $('world').dataset.journeyPhase;$('journey-controls').hidden=true;$('journey-route').toggleAttribute('hidden',true);$('map-hero').classList.remove('walking');$('map-hero').style.opacity='1';heroAt(state.place<0?[700,490]:approaches[state.place].at(-1));
      $('veil').classList.remove('busy');$('map-viewport').inert=false;document.querySelector('.map-controls').inert=false;$('destination').inert=false;$('home').inert=$('journal-open').inert=$('settings').inert=false;
      view=previousView;panMap();journey=null;transitionBusy=false;
    }
  }
  $('journey-skip').onclick=$('entry-skip').onclick=skipJourney;
  $('hall-entry').addEventListener('cancel',e=>{e.preventDefault();skipJourney();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&journey){e.preventDefault();skipJourney();}});
  function clueOpen(index, collectedOnly=false) {
    const i=state.current,p=puzzles[i],clue=p.clues[index];
    pendingClue=collectedOnly?null:{i,id:clue.id};
    if(!collectedOnly&&!state.levels[i].clues.includes(clue.id))document.dispatchEvent(new CustomEvent('palace-sound',{detail:'clue'}));
    $('clue-title').textContent=clue.title;$('clue-text').textContent=clue.text;$('clue-art').textContent=clue.title;
    $('clue-art').classList.toggle('with-asset',i<materialActors.length);
    if(i<materialActors.length){$('clue-art').replaceChildren(asset(materialProps[i][index],'clue-prop',clue.title));}
    $('clue-close').textContent=collectedOnly?'收好手札':'記入手札';
    $('clue-dialog').showModal();animate($('clue-dialog'),[{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}]);
  }
  $('clue-close').onclick=()=>{
    if(pendingClue){core.collect(state,pendingClue.i,pendingClue.id,puzzles[pendingClue.i]);save();renderClues();pendingClue=null;tone(true);}
    $('clue-dialog').close();
  };
  function renderClues() {
    const i=state.current,p=puzzles[i],l=state.levels[i];$('scene-clues').replaceChildren();$('collected-clues').replaceChildren();
    p.clues.forEach((c,n)=>{
      const found=l.clues.includes(c.id),b=make('button',`scene-clue${found?' found':''}`);
      b.append(i<materialActors.length?asset(materialProps[i][n],'prop-image',c.title):make('span','prop-art',config[i].glyphs[n]),make('b','',c.title));b.setAttribute('aria-label',`探索${c.title}`);b.onclick=()=>clueOpen(n);$('scene-clues').append(b);
      const slip=make('div','clue-slip');slip.append(make('h3','',found?'✓ '+c.title:'？ 尚未探索的物件'));
      if(found){slip.append(make('p','',c.text));const read=make('button','','重看線索');read.onclick=()=>clueOpen(n,true);slip.append(read);}
      $('collected-clues').append(slip);
    });
    $('clue-count').textContent=`已搜集 ${l.clues.length} / 3 條線索`;
    $('mechanism-note').textContent=l.complete?'證據已取得':l.clues.length===3?'線索已齊，可解密':`線索 ${l.clues.length} / 3`;
    $('puzzle-open').textContent=l.complete?'重看機關與解法':l.clues.length===3?'啟動解密機關':'檢查機關';
  }
  function room(i) {
    const p=puzzles[i];$('world').hidden=true;$('room').hidden=false;$('workbench').hidden=true;
    $('chapter-label').textContent=`第 ${i+1} 局 · 宮城調查`;$('room-name').textContent=p.location+' · '+p.title;
    $('room-topic').textContent=p.topic;$('scene-banner').textContent=p.location+' · '+(i%2?'暮色':'午時');
    $('npc-label').textContent=p.npc;$('mission-title').textContent=p.title;$('mission-goal').textContent=p.intro[0];
    $('npc-talk').classList.toggle('female',[1,3,6,7,8].includes(i));
    $('room-scene').classList.toggle('has-kitchen-art',i===0);$('room-scene').classList.toggle('has-garden-art',i===1);npcImage.hidden=i>=materialActors.length;
    $('room-scene').classList.toggle('has-clinic-stage',i===2);
    $('room-scene').classList.toggle('has-tailor-material',i===3);
    $('room-scene').classList.toggle('has-later-material',i>=4&&i<materialActors.length);
    if(i>=4&&i<materialActors.length)$('room-scene').style.setProperty('--room-art',`url('../assets/${laterBackgrounds[i-4]}')`);
    if(i<materialActors.length)npcImage.src='assets/characters/'+materialActors[i];npcImage.alt=p.npc+'立繪';gardenFlowers.hidden=i!==1;
    $('room-scene').style.filter=`hue-rotate(${[0,12,-8,-15,5,0,8,-10,-20,10,-5,0][i]}deg)`;
    renderClues();window.scrollTo(0,0);
  }
  let dialogueLines=[], dialogueIndex=0, dialogueAfter=null;
  function dialogRender(){
    $('dialog-text').textContent=dialogueLines[dialogueIndex];$('dialog-position').textContent=`${dialogueIndex+1} / ${dialogueLines.length}`;
    $('dialog-back').disabled=dialogueIndex===0;$('dialog-next').textContent=dialogueIndex===dialogueLines.length-1?'開始探索':'繼續 →';
    animate($('dialog-text'),[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:400});
  }
  function dialogue(lines,after,canQuestion=false) {
    const i=state.current;dialogueLines=lines;dialogueIndex=0;dialogueAfter=after;
    $('speaker').textContent=puzzles[i].npc;$('dialog-location').textContent=puzzles[i].location;
    $('dialogue').classList.toggle('female',[1,3,6,7,8].includes(i));
    $('dialogue').classList.toggle('has-character-art',i<materialActors.length);$('dialogue').classList.toggle('has-garden-material',i===1);$('dialogue').classList.toggle('has-clinic-material',i===2);$('dialogue').classList.toggle('has-tailor-material',i===3);$('dialogue').classList.toggle('has-later-material',i>=4&&i<materialActors.length);if(i>=4&&i<materialActors.length)$('dialogue').style.setProperty('--room-art',`url('../assets/${laterBackgrounds[i-4]}')`);dialogueImage.hidden=i>=materialActors.length;heroImage.hidden=i>=materialActors.length;
    if(i<materialActors.length)dialogueImage.src='assets/characters/'+materialActors[i];dialogueImage.alt=puzzles[i].npc+'立繪';
    $('dialog-scene').classList.toggle('kitchen-dialogue',i===0);
    $('dialogue').querySelector('.robe').textContent=['膳','花','醫','衣','書','銀','貴','盟','忍','衛','禁','皇'][i];
    $('dialog-question').hidden=!canQuestion;
    $('dialogue').showModal();dialogRender();animate($('dialogue'),[{opacity:0,transform:'translateY(25px)'},{opacity:1,transform:'translateY(0)'}],{duration:650});
  }
  $('dialog-back').onclick=()=>{if(dialogueIndex>0){dialogueIndex--;dialogRender();}};
  $('dialog-next').onclick=async()=>{
    if(dialogueIndex<dialogueLines.length-1){dialogueIndex++;dialogRender();return;}
    await animate($('dialogue'),[{opacity:1},{opacity:0}],{duration:300});$('dialogue').close();if(dialogueAfter)dialogueAfter();
  };
  $('dialogue').addEventListener('cancel',()=>{if(dialogueAfter)dialogueAfter();});
  const characterLines=[
    ['「噓……這批果子的總數，昨夜還清清楚楚。今早，最後一位卻被人刮去了。」','「若報錯數，罪名就落在御膳房。果籃、食盒、分裝令還在，請你替我查個明白。」'],
    ['「你來遲了一步，又早了一步。宮裡的人，最會拿時辰騙人。」','「這回暗號藏在牌號的餘數裡。東、西兩份記錄各只說了一半，你得一起核對。」'],
    ['「藥能救人，假藥方卻能害人。別因那編號看著像個奇數，就信了它。」','「有人換過藥籤，但櫃門規則還在。你若找到真正的那包藥，我便敢出面作證。」'],
    ['「她們說是我剪壞了錦緞。可你看，連量布的記錄都被拆散了。」','「我不求你信我，只求你親手量一遍。裁得最長又無剩料，謊話自然站不住。」'],
    ['「這封密詔，我看守了二十年。封蠟上的數字，昨夜卻換了位置。」','「鎖認的是質因數，不認看似相等的合數。你若能還原，我就把卷軸交給你。」'],
    ['「賞賜人人有份？哼，有人恨不得同一箱銀錢報上兩次。」','「箱標寫著36。請把不同的因數配對排出來，別讓翻轉的同一對又報一次帳。」'],
    ['「鼓點不會等人，密使也不會。錯過一次合演，未必就該等到天黑。」','「我的便箋另有時限。請把兩隊的節奏排在同一條時間上，再來回話。」'],
    ['「想結盟，先查盟書哪句是假的。不能只看幾個例子，就信了每個都是。」','「請拿出一個能推翻假話的反例，再把錯誤敘述修正。沒有證據，我不會蓋印。」'],
    ['「冷宮的人，數得最清楚的就是箱裡還剩幾份糧。」','「把40份糧磚補成完整正方形，不能少放，也不要多補。請先排給我看。」'],
    ['「軍營不只要點兵，還要查兵符。234、245、252，只有一個編碼過得了兩道關。」','「先查末兩位，再查數字和。只因個位是偶數就放行，可是會出事的。」'],
    ['「我能替你守住這道門，卻不能把錯誤的暗號放進去。」','「甲班留下除4的餘數，乙班留下除6的餘數。還得核對範圍，別拿舊門牌冒充。」'],
    ['「十二處宮門，你竟真走到了這裡。可零碎的指控，動不了朕的印。」','「把最小質因數、對應因數與完整分解連成一條能回驗的證據鏈。若你算得明白，便當眾揭開它。」']
  ];
  $('dialog-question').onclick=()=>{
    dialogueLines=[state.current===11?'「朕問的是：你的三份證據，能否互相證明，而不是剛好算出三個數字？」':'「你問誰動過手腳？我只見到記錄被改過，還沒有能指認任何人的證據。」',`「先把${puzzles[state.current].clues.map(c=>c.title).join('、')}交叉核對。讓物證說話，比猜測更有力。」`];
    dialogueIndex=0;$('dialog-question').hidden=true;dialogRender();
  };
  function talk(){const i=state.current,l=state.levels[i],p=puzzles[i];
    const lines=l.complete?[`「${p.explanation}」`,'「這份證據與前一處的疑點相呼應。沿宮城路線繼續查下去。」']:
      l.clues.length===3?['「三條線索都找到了。先別急著猜鎖碼，把它們的條件交叉比對。」',p.intro[2],`「${p.hints[0]}」`]:[...characterLines[i].map(line=>i===5?line.replace('36',String(p.parameters.target)):i===8?line.replace('40',String(p.parameters.original)):i===9?line.replace('234、245、252',p.parameters.codes.join('、')):line),p.intro[2]];
    dialogue(lines,()=>{l.talkSeen=true;save();},true);
  }
  $('npc-talk').onclick=talk;
  let filmIndex=0,filmTimer=null,filmAuto=true,filmAfter=null;
  function clearFilmTimer(){if(filmTimer){clearTimeout(filmTimer);filmTimer=null;}}
  function filmRender(){
    clearFilmTimer();const i=state.current,p=puzzles[i];$('film-image').replaceChildren();
    if(i===0){
      const file=['backgrounds/bg_map_palace.png','cg/cg_01_kitchen.png','backgrounds/bg_01_kitchen.png'][filmIndex];
      $('film-image').append(asset(file,'film-full-art',['宮城全景','御膳房查帳事件','進入御膳房'][filmIndex]));
    }
    else if(i===1){$('film-image').append(asset(filmIndex===1?'cg/cg_02_garden.png':'backgrounds/bg_02_garden.png','film-full-art',filmIndex===1?'御花園查證事件':'御花園專屬場景'));}
    else if(i===2){$('film-image').append(asset(filmIndex===1?'cg/cg_03_clinic.png':'backgrounds/bg_03_clinic.png','film-full-art',filmIndex===1?'太醫院查證事件':'太醫院專屬場景'));}
    else if(i===3){$('film-image').append(asset(filmIndex===1?'cg/cg_04_tailor.png':'backgrounds/bg_04_tailor.png','film-full-art',filmIndex===1?'尚衣局裁切事件':'尚衣局專屬場景'));}
    else if(i>=4&&i<materialActors.length){const event=filmIndex===1;const file=event?'cg/'+materialCG[i]:laterBackgrounds[i-4];$('film-image').append(asset(file,'film-full-art',p.location+(event?'關鍵物證':'專屬場景')));}
    else if(filmIndex===0){const el=make('div','film-palace');el.innerHTML=palaceSVG;$('film-image').append(el);$('film-image').style.background='#899978';}
    else if(filmIndex===1){$('film-image').append(make('div','film-prop',config[i].glyphs[1]));$('film-image').style.background='radial-gradient(ellipse at 60% 30%,#a49167,#354d3d)';}
    else {const scene=make('div','film-bg-scene');scene.innerHTML='<div class="window-lattice"></div><div class="shelf"><i>甕</i><i>罐</i><i>罐</i></div><div class="table"></div>';$('film-image').append(scene);$('film-image').style.background='#5c755e';}
    $('film-kicker').textContent=`第 ${i+1} 局 · ${['循線入宮','疑點浮現','調查開始'][filmIndex]}`;
    $('film-title').textContent=[p.location+' · '+(i===0?'暗帳初現':'線索未斷'),p.title,'把線索變成證據'][filmIndex];
    $('film-text').textContent=[i===0?'宮中帳冊與實物數量對不上。你奉命暗查，第一條線索指向御膳房。':`前一份證據把你帶到${p.location}。新的紀錄看似無誤，卻藏著另一種矛盾。`,p.intro[0],`與${p.npc}交談，查找三處物件，再親手操作機關。`][filmIndex];
    $('film-count').textContent=`${String(filmIndex+1).padStart(2,'0')} / 03`;$('film-next').textContent=filmIndex===2?'進入對話':'下一幕';
    animate($('film-image'),[{opacity:.4,scale:1},{opacity:1,scale:1.05}],{duration:reduced.matches?0:7800,fill:'forwards',easing:'linear'});
    animate($('film-caption'),[{opacity:0,transform:'translateY(15px)'},{opacity:1,transform:'translateY(0)'}],{duration:1000});
    if(filmAuto&&!reduced.matches)filmTimer=setTimeout(filmAdvance,9000);
  }
  function filmAdvance(){if(!$('film').open)return;if(filmIndex<2){filmIndex++;filmRender();}else finishFilm();}
  function finishFilm(){clearFilmTimer();$('film').close();state.levels[state.current].filmSeen=true;save();if(filmAfter)filmAfter();}
  function film(after){filmIndex=0;filmAfter=after;filmAuto=!reduced.matches;$('film-auto').textContent=`自動播放：${filmAuto?'開':'關'}`;$('film').showModal();filmRender();}
  $('film-next').onclick=filmAdvance;$('film-skip').onclick=finishFilm;
  $('film-auto').onclick=()=>{filmAuto=!filmAuto;$('film-auto').textContent=`自動播放：${filmAuto?'開':'關'}`;clearFilmTimer();if(filmAuto)filmTimer=setTimeout(filmAdvance,9000);};
  $('film').addEventListener('cancel',e=>{e.preventDefault();finishFilm();});
  $('replay').onclick=()=>film(()=>{});
  $('enter').onclick=()=>beginJourney(selected);
  $('return-map').onclick=()=>changeScene(showMap);$('home').onclick=e=>{e.preventDefault();changeScene(showMap);};
  function openPuzzle(){
    const i=state.current,l=state.levels[i];
    if(l.clues.length<3){dialogue(['「現在還缺少現場線索。機關上的三格不能只靠猜測。」',`「先查看${puzzles[i].clues.filter(c=>!l.clues.includes(c.id)).map(c=>c.title).join('、')}。」`],()=>{});return;}
    $('workbench').hidden=false;buildPuzzle();$('workbench').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    animate($('workbench'),[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:650});
  }
  $('puzzle-open').onclick=$('mechanism').onclick=openPuzzle;$('close-workbench').onclick=async()=>{await animate($('workbench'),[{opacity:1},{opacity:0}],{duration:250});$('workbench').hidden=true;};
  function values(){return state.levels[state.current].values;}
  let finalFactors=[];
  function deriveMechanism(i) {
    const v=values();
    if(i===3){
      const totals=config[i].totals;
      v[1]=Math.floor(totals[0]/v[0]);v[2]=Math.floor(totals[1]/v[0]);
    }
    if(i===0)v[1]=String(puzzles[0].parameters.prefix).split('').reduce((a,b)=>a+Number(b),0)+v[0];
    if(i===1){v[1]=Math.floor(v[0]/puzzles[i].parameters.a);v[2]=Math.floor(v[0]/puzzles[i].parameters.b);}
    if(i===5){const picked=state.levels[i].pairs;const numbers=[...new Set(picked.flatMap(n=>pairOptions[n]))].sort((a,b)=>a-b);v[0]=picked.length;v[1]=numbers.length;v[2]=numbers.length%2?numbers[Math.floor(numbers.length/2)]:0;}
    if(i===8){v[1]=Math.max(0,v[0]*v[0]-puzzles[i].parameters.original);v[2]=v[0]*v[0];}
    if(i===9){const number=puzzles[i].parameters.codes[v[0]-1];v[1]=number%100;v[2]=String(number).split('').reduce((a,b)=>a+Number(b),0);}
    if(i===10){v[1]=Math.floor(v[0]/puzzles[i].parameters.a);v[2]=Math.floor(v[0]/puzzles[i].parameters.b);}
    for(let n=0;n<3;n++){const input=$('value-'+n);if(input)input.value=v[n];const range=$('range-'+n);if(range)range.value=v[n];}
  }
  function setValue(n,value){const i=state.current,min=minimum(i,n);state.levels[i].values[n]=Math.max(min,Math.min(config[i].max[n],Number(value)||min));
    if(i===11&&n<2){finalFactors=[];state.levels[i].factors=finalFactors;values()[2]=1;}
    const input=$('value-'+n);if(input)input.value=values()[n];const range=$('range-'+n);if(range)range.value=values()[n];
    deriveMechanism(i);save();visual();}
  const primeTrials={};
  function buildPuzzle(){
    const i=state.current,p=puzzles[i],l=state.levels[i],c=config[i];
    if(l.attempts===0&&l.values.every(v=>v===1))l.values=[...c.initial];
    $('puzzle-title').textContent=p.title;$('puzzle-instructions').textContent=c.note;
    $('puzzle-feedback').textContent=l.complete?'這個機關已解開，可重看操作與推理，不會重複發獎。':'';
    $('puzzle-controls').replaceChildren();
    c.labels.forEach((label,n)=>{
      const dial=make('div','dial');const lab=make('label','',label);lab.htmlFor='value-'+n;const row=make('div','dial-row');
      const minus=make('button','','−'),plus=make('button','','＋');minus.setAttribute('aria-label',`減少${label}`);plus.setAttribute('aria-label',`增加${label}`);
      const input=make('input');input.id='value-'+n;input.type='number';input.min=String(minimum(i,n));input.max=c.max[n];input.step='1';input.value=l.values[n];input.inputMode='numeric';
      input.oninput=()=>{if(input.value.trim()!==''&&Number.isInteger(Number(input.value)))setValue(n,input.value);};
      minus.onclick=()=>setValue(n,values()[n]-1);plus.onclick=()=>setValue(n,values()[n]+1);row.append(minus,input,plus);
      const range=make('input');range.id='range-'+n;range.type='range';range.min=input.min;range.max=input.max;range.value=l.values[n];range.setAttribute('aria-label',label+'滑桿');range.oninput=()=>setValue(n,range.value);
      dial.append(lab,row,range);$('puzzle-controls').append(dial);
    });
    if(i===11)finalFactors=l.factors;
    deriveMechanism(i);renderHint();
    for(let n=0;n<3;n++){
      const generated=(i===0)||(i===5)||(i===7)||(i===9)||(i===1&&n>0)||(i===8&&n>0)||(i===10&&n>0)||(i===3&&n>0)||(i===11&&n===2)||(i===2&&n<2)||(i===4&&n===0)||(i===6&&n===2);
      if(generated){$('value-'+n).readOnly=true;$('value-'+n).title='由機關操作產生，請操作上方圖像';$('range-'+n).hidden=true;
        const buttons=$('value-'+n).parentElement.querySelectorAll('button');buttons.forEach(b=>b.hidden=true);}
    }
    if(i===11)finalFactors=l.factors;
    visual();save();
  }
  function equation(text){$('puzzle-visual').append(make('p','visual-equation',text));}
  function note(text){$('puzzle-visual').append(make('p','visual-note',text));}
  function choices(box,title,options,selected,action){
    const section=make('section','deduction-section');section.append(make('h3','',title));const grid=make('div','deduction-choices');
    for(const [value,label]of options){const b=make('button',Array.isArray(selected)?(selected.includes(value)?'selected':''):(selected===value?'selected':''),label);b.setAttribute('aria-pressed',String(Array.isArray(selected)?selected.includes(value):selected===value));b.onclick=()=>action(value);grid.append(b);}
    section.append(grid);box.append(section);return grid;
  }
  function materialChoices(grid,file,className,labels){
    grid.classList.add(className);
    [...grid.children].forEach((button,n)=>{const label=button.textContent;button.setAttribute('aria-label',label);button.classList.add('material-choice');button.replaceChildren(asset('props/'+file,'choice-prop',''),make('span','material-label',labels?labels[n]:label));});
  }
  function diverseVisual(i,box,v){
    const t=puzzles[i].parameters;
    if(i===0){
      choices(box,`補上帳冊末位：${t.prefix}□`,Array.from({length:10},(_,n)=>[n,'填入末位'+n]),v[0],n=>setValue(0,n));
      const number=t.prefix*10+v[0];equation(`帳冊 ${number} ｜ 數字和 ${String(t.prefix).split('').join('＋')}＋${v[0]}＝${v[1]}`);
      note(`2的查驗：${number%2===0?'個位為偶數，可整除':'個位為奇數，不可整除'}；9的查驗：數字和${v[1]}${v[1]%9===0?'可':'不可'}被9整除。`);
      choices(box,'選出能由「同時被2與3整除」證成的整除令',[4,5,6,10].map(n=>[n,'整除令'+n]),v[2],n=>setValue(2,n));
    }else if(i===1||i===10){
      const garden=i===1,start=t.min,end=t.max,a=t.a,b=t.b;
      const plates=choices(box,garden?'逐一查驗花燈密牌':'逐一查驗暗號門牌',Array.from({length:end-start+1},(_,n)=>[n+start,(garden?'試驗密牌':'查驗門牌')+(n+start)]),v[0],n=>setValue(0,n));
      if(!garden)materialChoices(plates,'gate_number_plate.png','gate-cards',Array.from({length:end-start+1},(_,n)=>String(n+start)));
      equation(`${v[0]} ＝ ${a} × ${v[1]} ＋ ${v[0]%a}`);equation(`${v[0]} ＝ ${b} × ${v[2]} ＋ ${v[0]%b}`);
      note(`範圍${t.min}至${t.max}；${garden?'東側':'甲班'}要求除${a}餘${t.ra}，${garden?'西側':'乙班'}要求除${b}餘${t.rb}。商與餘數不要互換。`);
    }else if(i===5){
      const picked=state.levels[i].pairs;
      const pairs=choices(box,'把所有合法配對收入帳簿（再按可移除）',pairOptions.map((p,n)=>[n,`配對 ${p[0]} × ${p[1]}`]),picked,n=>{
        const at=picked.indexOf(n);if(at<0)picked.push(n);else picked.splice(at,1);deriveMechanism(i);save();visual();
      });
      [...pairs.children].forEach((button,n)=>{button.setAttribute('aria-label',button.textContent);button.classList.add('coin-pair');const coins=make('span','coin-values');coins.setAttribute('aria-hidden','true');for(const value of pairOptions[n]){const coin=make('span','coin-number');coin.append(asset('props/silver_token.png','',''),make('b','',String(value)));coins.append(coin);}button.prepend(coins);});
      const ledger=make('div','pair-ledger material-ledger'),pages=make('div','ledger-pages'),left=make('div','ledger-page'),right=make('div','ledger-page');
      ledger.append(asset('props/factor_pair_ledger.png','ledger-art','因數配對帳簿'));pages.append(left,right);ledger.append(pages);
      picked.forEach((n,index)=>{const [a,b]=pairOptions[n],invalid=a*b!==t.target||a>b;const row=make('p',invalid?'invalid-pair':'',`${a} × ${b} ＝ ${a*b}`);row.setAttribute('aria-label',row.textContent+(a*b!==t.target?'：不是'+t.target:a>b?'：與翻轉配對重複':'：已收入配對'));row.title=row.getAttribute('aria-label');(index%2?right:left).append(row);});
      if(!picked.length)left.append(make('span','ledger-empty','尚未收入配對'));box.append(ledger);
      const numbers=[...new Set(picked.flatMap(n=>pairOptions[n]))].sort((a,b)=>a-b);
      equation(`已選 ${v[0]} 對 ｜ 不同數字 ${v[1]} 個`);note('帳簿中的不同數字：'+(numbers.join('、')||'尚未配對')+'。請先排除非法配對，再核對是否收齊；中央因數只能算一次。');
    }else if(i===7){
      const claims=choices(box,'第一步：指出錯誤說法',[[1,'說法1：每個奇數都是質數'],[2,'說法2：2是唯一偶質數'],[3,'說法3：1非質數也非合數']],v[0],n=>setValue(0,n));
      materialChoices(claims,'claim_scroll.png','claim-cards');
      const counters=choices(box,'第二步：選能推翻錯說的反例',t.counters.map(n=>[n,'反例信物'+n]),v[1],n=>setValue(1,n));
      materialChoices(counters,'counterexample_token.png','counter-cards',t.counters.map(String));
      const factors=[];for(let n=1;n<=v[1];n++)if(v[1]%n===0)factors.push(n);equation(`信物 ${v[1]} 的正因數：${factors.join('、')}`);
      const seals=choices(box,'第三步：換上正確修正句',[[1,'修正1：每個奇數都是質數'],[2,'修正2：奇數也可能是合數'],[3,'修正3：只有偶數才可能是合數']],v[2],n=>setValue(2,n));
      materialChoices(seals,'reasoning_seal.png','seal-cards');
      note('反例要同時符合原句的前提，卻不符合結論；支持例子不能推翻「每個」的說法。');
    }else if(i===8){
      choices(box,'調整方陣每邊格數',[5,6,7,8].map(n=>[n,'排成 '+n+' × '+n]),v[0],n=>setValue(0,n));
      const grid=make('div','square-board');grid.style.gridTemplateColumns=`repeat(${v[0]},1fr)`;
      grid.setAttribute('aria-label',`${v[0]}乘${v[0]}方陣，共${v[2]}份，新增${Math.max(0,v[2]-t.original)}份`);
      for(let n=0;n<v[2];n++){const tile=make('span',n>=t.original?'new-tile':'');tile.append(asset('props/grain_tile.png','',''));if(n>=t.original)tile.append(make('b','','＋'));grid.append(tile);}
      const tray=make('div','grain-tray');tray.append(asset('props/grain_square_tray.png','tray-art','木製方陣托盤'),grid);box.append(tray);
      equation(`${v[0]} × ${v[0]} ＝ ${v[2]} 格`);note(v[2]<t.original?`還有 ${t.original-v[2]} 份原有糧磚放不下，不能拿走；請擴大方陣。`:`原有${t.original}份 ＋ 補入${v[1]}份 ＝ ${v[2]}份；金色格為新增。能排下還不夠，新增量要最少。`);
    }else if(i===9){
      const guards=choices(box,'選一枚兵符，查驗兩個條件',t.codes.map((n,index)=>[index+1,`兵符${index+1}：${n}`]),v[0],n=>setValue(0,n));
      materialChoices(guards,'guard_code_token.png','guard-cards',t.codes.map(String));
      equation(`末兩位 ${v[1]} ÷ 4 ＝ ${Math.floor(v[1]/4)} … 餘 ${v[1]%4}`);
      equation(`數字和 ${v[2]} ÷ 9 ＝ ${Math.floor(v[2]/9)} … 餘 ${v[2]%9}`);
      note('真兵符必須兩道檢查都整除；不能只看偶數或數字和其中一項。');
    }
  }
  function visual(){
    const i=state.current,c=config[i],v=values(),t=puzzles[i].parameters,box=$('puzzle-visual');box.replaceChildren();
    if(diverse.includes(i)){diverseVisual(i,box,v);return;}
    if(i===6){
      const max=60;
      for(let n=0;n<2;n++){const track=make('div','time-track');track.append(make('b','',n?'舞隊':'鼓隊'));
        for(let t=c.offset[n];t<=max;t+=v[n]){const marker=make('span');marker.style.left=(t/max*100)+'%';track.append(marker);}
        const cursor=make('span','cursor');cursor.style.left=v[2]/max*100+'%';track.append(cursor);track.setAttribute('aria-label',`${n?'乙':'甲'}隊時間軸，從${c.offset[n]}起，每隔${v[n]}分鐘`);box.append(track);
      }
      const nav=make('div','timeline-nav');for(const t of [12,16,20,24,28,36,40,48,60]){const b=make('button',t===v[2]?'selected':'',String(t)+' 分');b.onclick=()=>setValue(2,t);nav.append(b);}box.append(nav);
      const meet=v[2]>=c.offset[0]&&v[2]>=c.offset[1]&&(v[2]-c.offset[0])%v[0]===0&&(v[2]-c.offset[1])%v[1]===0;
      equation(`第 ${v[2]} 分鐘 · ${meet?'兩排標記重合':'兩排標記尚未重合'}`);
      note(`從11時起算，目前11時${String(v[2]).padStart(2,'0')}分；要在11時20分或之後。`);
    }else if(i===2){
      const rack=make('div','jar-grid');for(const n of t.candidates){const b=make('button','jar'+(n===v[0]?' selected':''),String(n));b.append(make('small','','藥方編號'));b.onclick=()=>setValue(0,n);rack.append(b);}box.append(rack);
      const trial=make('section','prime-trial');trial.append(make('h3','','藥方查驗臺'));
      trial.append(make('p','',`先選一張藥方，再試除。目前編號 ${v[0]}；數字和為 ${Math.floor(v[0]/10)+v[0]%10}。`));
      const tools=make('div','prime-tools');for(const d of[2,3,5]){const b=make('button','',`用 ${d} 試除`);b.setAttribute('aria-label',`以${d}試除`);b.onclick=()=>{primeTrials[v[0]]||=[];if(!primeTrials[v[0]].includes(d))primeTrials[v[0]].push(d);visual();};tools.append(b);}trial.append(tools);
      const checked=primeTrials[v[0]]||[],results=make('div','prime-trial-results');results.id='prime-trial-results';
      for(const d of checked)results.append(make('p','',`${v[0]} ÷ ${d} ＝ ${Math.floor(v[0]/d)} … 餘 ${v[0]%d}${v[0]%d===0?'，找到1與本身以外的因數。':''}`));
      const composite=checked.some(d=>v[0]%d===0),allChecked=[2,3,5].every(d=>checked.includes(d));
      const verdict=make('p','prime-verdict',composite?'已找到其他因數，這是合數，不能當作真藥方。':allChecked?'2、3、5都無法整除；在這批候選範圍內，已確認是質數，還要核對範圍與數字和。':'尚未完成質數查驗。請把試除結果當作證據，不要只看奇偶。');verdict.id='prime-verdict';trial.append(results,verdict);
      trial.append(make('p','tiny','候選數皆小於7×7；檢查2、3、5即可涵蓋可能的小質因數。試算紀錄只作觀察，刷新後可重新試除。'));box.append(trial);
      equation(`${v[0]} ÷ 5 ＝ ${Math.floor(v[0]/5)} … 餘 ${v[0]%5}`);note(`數字和 ${Math.floor(v[0]/10)+v[0]%10}；原有藥包推算：2 × ${v[0]} − ${t.drugOffset} ＝ ${v[0]*2-t.drugOffset}。請自行判斷候選是否為質數。`);
      const shelves=make('div','clinic-drawers');for(let shelf=0;shelf<=4;shelf++){const b=make('button','clinic-drawer'+(v[1]===shelf?' selected':''),shelf+'號');b.append(make('span','drawer-handle','○'));b.setAttribute('aria-label',`選擇${shelf}號貨架`);b.onclick=()=>setValue(1,shelf);shelves.append(b);}box.append(shelves);
    }else if(i===3){
      c.totals.forEach((length,n)=>{const sheet=make('div','cloth-sheet'),cloth=make('div','cloth'+(n===0?' blue':''));cloth.style.width=length/Math.max(...c.totals)*100+'%';cloth.append(make('b','',`${n?'紅':'青'}緞 ${length} cm`));for(let cut=v[0];cut<length;cut+=v[0]){const mark=make('i');mark.style.left=cut/length*100+'%';cloth.append(mark);}const scissors=asset('props/tailor_scissors.png','cutting-tool','裁切工具位置');scissors.style.left=v[0]/Math.max(...c.totals)*100+'%';sheet.append(cloth,scissors);box.append(sheet);});
      equation(`${t.totals[0]} ÷ ${v[0]}：${Math.floor(t.totals[0]/v[0])} 段、餘 ${t.totals[0]%v[0]} ｜ ${t.totals[1]} ÷ ${v[0]}：${Math.floor(t.totals[1]/v[0])} 段、餘 ${t.totals[1]%v[0]}`);note('切口會隨裁布尺移動。兩匹都無剩料仍不一定是最長段長，請回看裁切規則。');
    }else if(i===4){
      const tree=make('div','factor-tree');tree.append(make('span','factor-token',String(t.target)),make('span','','＝'),make('span','factor-token',`${v[0]}^${v[1]}`),make('span','','×'),make('span','factor-token',`3^${v[2]}`));box.append(tree);
      const shelf=make('div','factor-shelf');for(const prime of [2,3,5,7]){const b=make('button','',String(prime));b.setAttribute('aria-label',`選擇質底數${prime}`);b.onclick=()=>setValue(0,prime);shelf.append(b);}box.append(shelf);
      equation(`${v[0]}^${v[1]} × 3^${v[2]} ＝ ${Math.pow(v[0],v[1])*Math.pow(3,v[2])}`);note('鎖盤分別控制質底數、左側指數、右側指數。乘積相同之外，也要符合書脊指定的底數條件。');
    }else{
      const chain=make('div','evidence-lock');['最小質因數','對應因數','分解回驗'].forEach((label,n)=>{const cell=make('span','',String(v[n]));cell.append(make('small','',label));chain.append(cell);});box.append(chain);
      equation(`密詔原數 N ＝ ${v[0]} × ${v[1]} ＝ ${v[0]*v[1]}`);note(`前兩格的乘積必須回到${t.target}；第三格再完整質因數分解，將重複出現的質數分別計數。三項證據缺一不可。`);
      const product=finalFactors.reduce((a,b)=>a*b,1),remaining=v[0]*v[1]/product;
      equation(`尚待分解 ${remaining}　｜　已拆出 ${finalFactors.length} 個質因數`);
      const shelf=make('div','factor-shelf');for(const prime of [2,3,5,7]){const b=make('button','',`拆出 ${prime}`);b.setAttribute('aria-label','拆出質因數'+prime);b.disabled=remaining===1||remaining%prime!==0;b.onclick=()=>{finalFactors.push(prime);state.levels[i].factors=finalFactors;v[2]=finalFactors.length;$('value-2').value=v[2];save();visual();};shelf.append(b);}const reset=make('button','','重排分解');reset.onclick=()=>{finalFactors=[];state.levels[i].factors=finalFactors;v[2]=1;$('value-2').value=1;save();visual();};shelf.append(reset);box.append(shelf);
      if(finalFactors.length)note('已拆出的鏈：'+finalFactors.join(' × '));
    }
  }
  function renderHint(){const i=state.current,l=state.levels[i];$('puzzle-hint').hidden=l.hints===0;$('puzzle-hint').textContent=l.hints?`提示 ${l.hints} / 3：${puzzles[i].hints[l.hints-1]}`:'';$('hint').disabled=l.hints>=3;}
  $('hint').onclick=()=>{const l=state.levels[state.current];l.hints=Math.min(3,l.hints+1);renderHint();save();};
  $('verify').onclick=()=>{
    const i=state.current,p=puzzles[i],l=state.levels[i];
    if(i===11&&!l.complete&&finalFactors.reduce((a,b)=>a*b,1)!==values()[0]*values()[1]){$('puzzle-feedback').textContent='密詔還未完整拆解：請操作質數籌碼，直到尚待分解數值為1，再提出證據。';return;}
    const submitted=config[i].labels.map((_,n)=>$('value-'+n).value);const result=core.verify(state,i,submitted,p);save();tone(result.correct);
    if(!result.correct){$('puzzle-feedback').textContent=result.reason==='operation'?'請找齊所有合法配對，排除錯誤乘積與翻轉重複，再提出證據。':result.reason==='input'?'請填入控制盤允許範圍內的整數。':'機關沒有開啟：目前組合尚未同時滿足三份線索。對照圖像、餘數與條件，再調整一次。';renderHint();return;}
    $('puzzle-feedback').textContent='三份線索相互吻合，機關已開啟。';renderClues();
    if(result.already)return;
    document.dispatchEvent(new CustomEvent('palace-sound',{detail:'success'}));
    $('victory-cg').hidden=i>=materialCG.length;
    if(i<materialCG.length){$('victory-cg').src='assets/cg/'+materialCG[i];$('victory-cg').alt=p.location+'查證事件';}
    $('victory').classList.toggle('with-cg',i<materialCG.length);
    $('victory-title').textContent=p.location+' · 證據到手';$('victory-explanation').textContent=p.explanation;
    $('victory-followup').textContent=i===11?'十二份證據完成回驗。密詔與虛報帳冊的矛盾已公開，你以推理終結了這場宮廷密謀。':`藏在機關裡的記錄指向${puzzles[i+1].location}。下一局已解鎖，調查尚未結束。`;
    $('victory-next').textContent=i===11?'返回宮城':'前往下一廳 →';
    $('victory').showModal();animate($('victory'),[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:650});
  };
  $('victory-next').onclick=()=>{const i=state.current;$('victory').close();if(i<11)beginJourney(i+1);else changeScene(showMap);};$('victory-stay').onclick=()=>$('victory').close();
  function journalTab(evidence) {
    $('journal-content').hidden=evidence;$('evidence-case').hidden=!evidence;
    $('journal-clues-tab').setAttribute('aria-pressed',String(!evidence));$('journal-evidence-tab').setAttribute('aria-pressed',String(evidence));
  }
  function evidenceSlots() {
    $('evidence-slots').replaceChildren();$('evidence-detail').replaceChildren(make('p','','選取已取得的證據，回看它與線索的關係。'));
    state.levels.forEach((l,i)=>{
      const button=make('button','evidence-slot');button.disabled=!l.complete;
      button.setAttribute('aria-label',l.complete?`查看${puzzles[i].location}證據`:`${puzzles[i].location}證據尚未取得`);
      button.append(l.complete?(i<materialActors.length?asset(materialEvidence[i],'evidence-item',puzzles[i].location+'證據信物'):make('span','evidence-placeholder','證')):make('span','evidence-empty',String(i+1).padStart(2,'0')));
      button.append(make('small','',l.complete?puzzles[i].location:'未取得'));
      button.onclick=()=>{
        const detail=$('evidence-detail');detail.replaceChildren(make('h3','',puzzles[i].location+' · '+puzzles[i].title));
        for(const c of puzzles[i].clues)detail.append(make('p','',c.title+'：'+c.text));
        detail.append(make('p','evidence-conclusion','回驗：'+puzzles[i].explanation));
        detail.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'nearest'});
      };
      $('evidence-slots').append(button);
    });
  }
  $('journal-clues-tab').onclick=()=>journalTab(false);$('journal-evidence-tab').onclick=()=>journalTab(true);
  $('journal-open').onclick=()=>{
    journalTab(false);evidenceSlots();
    $('journal-content').replaceChildren();let has=false;
    state.levels.forEach((l,i)=>{if(!l.clues.length&&!l.complete)return;has=true;const section=make('section','journal-level');section.append(make('h3','',`${String(i+1).padStart(2,'0')} ${puzzles[i].location}${l.complete?' · 已取得證據':''}`));
      for(const clue of puzzles[i].clues.filter(c=>l.clues.includes(c.id)))section.append(make('p','',clue.title+'：'+clue.text));if(l.complete)section.append(make('p','',`回驗：${puzzles[i].explanation}`));$('journal-content').append(section);});
    if(!has)$('journal-content').append(make('p','','手札尚空。先循線前往御膳房，查看場景物件。'));$('journal').showModal();
  };
  $('journal-close').onclick=()=>$('journal').close();$('sound').onclick=()=>{state.muted=!state.muted;save();tone(true);};
  $('settings').onclick=()=>$('reset-dialog').showModal();$('reset-cancel').onclick=()=>$('reset-dialog').close();
  $('reset-confirm').onclick=()=>{const previous=state.questionSet;state=core.fresh();state.questionSet=window.QuestionVariants.newSet(previous);applyQuestionSet();$('reset-dialog').close();save();showMap();};
  // Restore the location without replaying the film; all clues remain in the hand-written journal.
  if(state.current>=0){room(state.current);}else showMap(false);
  heroAt(state.place<0?[700,490]:approaches[state.place].at(-1));
  selectPlace(Math.min(core.evidence(state),11));panMap();
  renderHud();if(!restoredSave)save();
  $('save-message').textContent=warning||'素材已整合：宮城總圖與十二局專屬場景、人物、道具及過場';
})();
