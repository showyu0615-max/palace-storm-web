(function () {
  'use strict';
  const core = window.ExploreCore;
  const puzzles = window.PalacePuzzles;
  const $ = id => document.getElementById(id);
  const KEY = 'palace-exploration-v2';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = core.fresh(), warning = '', selected = 0, pendingClue = null, transitionBusy = false, audio;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const restored = core.restore(raw); if (restored) state = restored; else warning = '存檔無法讀取，已建立新調查。'; }
  } catch { warning = '瀏覽器禁止儲存，當次可玩，關閉後無法延續。'; }
  if (!Array.isArray(puzzles) || puzzles.length !== 12) { $('save-message').textContent = '題庫載入失敗，請保留src資料夾與入口檔相對位置。'; return; }
  const config = [
    { labels:['推定總顆數','平均分成幾袋','每袋顆數'], max:[60,24,24], glyphs:['果','盒','令'], initial:[44,5,8], note:'先從兩種分裝規則找出總數，再挑出每袋至少5顆時最多的袋數。' },
    { labels:['甲隊間隔（分鐘）','乙隊間隔（分鐘）','最早接頭（第幾分鐘）'], max:[15,15,60], offset:[2,4], initial:[5,7,12], glyphs:['東','西','燈'], note:'拖動時間，觀察兩排巡邏標記。首次到達時間不同，不能直接填最小公倍數。' },
    { labels:['真藥方編號','定位貨架號','原有藥包數'], max:[60,4,60], initial:[31,1,48], glyphs:['藥','櫃','簿'], note:'點藥罐選出符合全部條件的編號，再定位貨架並還原藥包數。' },
    { labels:['每段長度（公分）','青緞段數','紅緞段數'], max:[60,30,30], totals:[84,126], initial:[20,4,6], glyphs:['青','紅','尺'], note:'移動裁布尺，觀察兩匹布的切口與餘料；相同段長且無剩料，還要盡可能長。' },
    { labels:['質底數 p','p 的指數 a','3 的指數 b'], max:[7,6,6], initial:[2,2,2], glyphs:['卷','脊','蠟'], note:'按質數籌碼調整底數，再調整兩側指數，將完整乘積還原為72。' },
    { labels:['賞賜份數','每份銀錢（枚）','每份米糧（袋）'], max:[60,30,30], totals:[72,90], initial:[12,6,7], glyphs:['銀','米','賞'], note:'調整份數，看相同賞賜如何消耗兩種物資；要全數分完且份數最多。' },
    { labels:['鼓隊間隔（分鐘）','舞隊間隔（分鐘）','可接頭（第幾分鐘）'], max:[20,20,60], offset:[0,0], initial:[6,10,20], glyphs:['鼓','舞','箋'], note:'用合演時間軸確認兩隊同台，並避開11時20分之前的時刻。' },
    { labels:['最多禮包份數','再次送信間隔（日）','兩項合成的盟印碼'], max:[40,60,60], initial:[6,12,18], glyphs:['禮','信','印'], note:'把兩份盟約分配到正確的推理方法，再操作數量與時間，組成盟印。' },
    { labels:['盤點日（第幾日）','期間新增口糧（份）','盤點後剩餘（份）'], max:[60,60,60], initial:[12,16,44], glyphs:['糧','途','曆'], note:'拖曳盤點日期，逐日查看入庫和消耗。盤點當天的兩路補給都必須計入。' },
    { labels:['留營小隊數','每隊弓手數','每隊槍手數'], max:[60,30,30], totals:[72,108], initial:[18,4,5], glyphs:['冊','調','旗'], note:'先扣除被抽調的兵力，再重編成完全相同的小隊。不可留人，也不可把兩個兵種混算。' },
    { labels:['甲班換崗間隔','乙班換崗間隔','通門時刻（第幾分鐘）'], max:[20,20,60], offset:[0,0], initial:[5,10,24], glyphs:['甲','乙','禁'], note:'找到同步換崗後還要檢查禁行令；紅色區間內就算同步也不能通過。' },
    { labels:['最多禮包份數','最少等待日數','重複計數的質因數個數'], max:[60,60,20], initial:[3,12,4], glyphs:['賞','時','詔'], note:'依序接合三項證據。最後一格要計質因數總個數，不是種類數，也不是乘積本身。' }
  ];
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
    await animate($('veil'), [{opacity:0},{opacity:1}], {duration:300,fill:'forwards'});
    action();
    await animate($('veil'), [{opacity:1},{opacity:0}], {duration:650,fill:'forwards'});
    $('veil').classList.remove('busy'); transitionBusy = false;
  }
  function save() {
    try { localStorage.setItem(KEY,JSON.stringify(state)); if (!warning.includes('禁止')) warning = ''; }
    catch { warning = '無法儲存；可繼續當次遊玩，關閉後可能無法延續。'; }
    $('save-message').textContent = warning || '探索進度已本機保存 · 不傳送個人資料';
    renderHud();
  }
  function renderHud() {
    $('progress').textContent = `證據 ${core.evidence(state)} / 12 · 聲望 ${core.reputation(state)}`;
    $('sound').textContent = `音效：${state.muted?'關':'開'}`;
    $('sound').setAttribute('aria-pressed',String(!state.muted));
  }
  function tone(ok) {
    if (state.muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(); osc.connect(gain); gain.connect(audio.destination);
      osc.frequency.setValueAtTime(ok?392:196,audio.currentTime); osc.frequency.setValueAtTime(ok?587:164,audio.currentTime+.15);
      gain.gain.setValueAtTime(.04,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.4); osc.start(); osc.stop(audio.currentTime+.41);
    } catch { /* Sound is optional; game remains usable. */ }
  }
  function panMap() { $('map-canvas').style.transform = `translate(calc(-50% + ${view.x}px),calc(-50% + ${view.y}px)) scale(${view.zoom})`; }
  function focusMapTarget() {
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
    selectPlace(Math.min(core.evidence(state),11));focusMapTarget();panMap();window.scrollTo(0,0);
  }
  function clueOpen(index, collectedOnly=false) {
    const i=state.current,p=puzzles[i],clue=p.clues[index];
    pendingClue=collectedOnly?null:{i,id:clue.id};
    $('clue-title').textContent=clue.title;$('clue-text').textContent=clue.text;$('clue-art').textContent=config[i].glyphs[index];
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
    ['「噓……這批果子的總數，昨夜還清清楚楚。今早，墨字卻被人潑濕了。」','「若報錯數，罪名就落在御膳房。果籃、食盒、分裝令還在，請你替我查個明白。」'],
    ['「你來遲了一步，又早了一步。宮裡的人，最會拿時辰騙人。」','「兩隊侍衛各走各的花徑。若只照同時出發的算法，密會的人早就散了。」'],
    ['「藥能救人，假藥方卻能害人。別因那編號看著像個奇數，就信了它。」','「有人換過藥籤，但櫃門規則還在。你若找到真正的那包藥，我便敢出面作證。」'],
    ['「她們說是我剪壞了錦緞。可你看，連量布的記錄都被拆散了。」','「我不求你信我，只求你親手量一遍。裁得最長又無剩料，謊話自然站不住。」'],
    ['「這封密詔，我看守了二十年。封蠟上的數字，昨夜卻換了位置。」','「鎖認的是質因數，不認看似相等的合數。你若能還原，我就把卷軸交給你。」'],
    ['「賞賜人人有份？哼，有人恨不得同一箱銀錢報上兩次。」','「箱標沒法說謊。把銀與米一份份排開，讓我看看最多到底能分幾份。」'],
    ['「鼓點不會等人，密使也不會。錯過一次合演，未必就該等到天黑。」','「我的便箋另有時限。請把兩隊的節奏排在同一條時間上，再來回話。」'],
    ['「想結盟，先證明你分得清：有些事要分，有些事要等。」','「兩份盟約只差幾個字，算錯一步，盟印就落入對方手裡。你會怎麼選？」'],
    ['「冷宮的人，數得最清楚的就是還能撐幾天。」','「別只盯著庫裡那幾袋糧。路上會有人送來，也有人刻意漏記，請把每一天都算進去。」'],
    ['「原兵冊沒錯，錯的是拿原兵冊編今天的隊伍。」','「抽調的弓手與槍手都不在場。先點清留下的人，再把隊伍重新排起來。」'],
    ['「我能替你守住這道門，卻不能讓你撞上禁行令。」','「兩班同時換崗只是一半條件。若那一刻仍在禁行，你帶著證據也走不出去。」'],
    ['「十二處宮門，你竟真走到了這裡。可零碎的指控，動不了朕的印。」','「把賞賜、時序、密詔連成一條能回驗的證據鏈。若你算得明白，便當眾揭開它。」']
  ];
  $('dialog-question').onclick=()=>{
    dialogueLines=[state.current===11?'「朕問的是：你的三份證據，能否互相證明，而不是剛好算出三個數字？」':'「你問誰動過手腳？我只見到記錄被改過，還沒有能指認任何人的證據。」',`「先把${puzzles[state.current].clues.map(c=>c.title).join('、')}交叉核對。讓物證說話，比猜測更有力。」`];
    dialogueIndex=0;$('dialog-question').hidden=true;dialogRender();
  };
  function talk(){const i=state.current,l=state.levels[i],p=puzzles[i];
    const lines=l.complete?[`「${p.explanation}」`,'「這份證據與前一處的疑點相呼應。沿宮城路線繼續查下去。」']:
      l.clues.length===3?['「三條線索都找到了。先別急著猜鎖碼，把它們的條件交叉比對。」',p.intro[2],`「${p.hints[0]}」`]:[...characterLines[i],p.intro[2]];
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
    animate($('film-image'),[{opacity:.4,scale:1},{opacity:1,scale:1.05}],{duration:reduced.matches?0:5200,fill:'forwards',easing:'linear'});
    animate($('film-caption'),[{opacity:0,transform:'translateY(15px)'},{opacity:1,transform:'translateY(0)'}],{duration:700});
    if(filmAuto&&!reduced.matches)filmTimer=setTimeout(filmAdvance,6500);
  }
  function filmAdvance(){if(!$('film').open)return;if(filmIndex<2){filmIndex++;filmRender();}else finishFilm();}
  function finishFilm(){clearFilmTimer();$('film').close();state.levels[state.current].filmSeen=true;save();if(filmAfter)filmAfter();}
  function film(after){filmIndex=0;filmAfter=after;filmAuto=!reduced.matches;$('film-auto').textContent=`自動播放：${filmAuto?'開':'關'}`;$('film').showModal();filmRender();}
  $('film-next').onclick=filmAdvance;$('film-skip').onclick=finishFilm;
  $('film-auto').onclick=()=>{filmAuto=!filmAuto;$('film-auto').textContent=`自動播放：${filmAuto?'開':'關'}`;clearFilmTimer();if(filmAuto)filmTimer=setTimeout(filmAdvance,6500);};
  $('film').addEventListener('cancel',e=>{e.preventDefault();finishFilm();});
  $('replay').onclick=()=>film(()=>{});
  $('enter').onclick=()=>{const i=selected;if(!core.enter(state,i))return;save();changeScene(()=>{room(i);if(!state.levels[i].filmSeen)film(talk);else talk();});};
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
    if([3,5,9].includes(i)){
      const totals=config[i].totals;
      v[1]=Math.floor(totals[0]/v[0]);v[2]=Math.floor(totals[1]/v[0]);
    }
    if(i===8){v[1]=Math.floor(v[0]/6)*4+Math.floor(v[0]/8)*6;v[2]=40+v[1]-v[0];}
    for(let n=0;n<3;n++){const input=$('value-'+n);if(input)input.value=v[n];const range=$('range-'+n);if(range)range.value=v[n];}
  }
  function setValue(n,value){const i=state.current,min=i===2&&n===1?0:1;state.levels[i].values[n]=Math.max(min,Math.min(config[i].max[n],Number(value)||min));
    if(i===11&&n<2){finalFactors=[];state.levels[i].factors=finalFactors;values()[2]=1;}
    const input=$('value-'+n);if(input)input.value=values()[n];const range=$('range-'+n);if(range)range.value=values()[n];
    if(i===1){if($('garden-clock'))$('garden-clock').value=values()[2];if($('garden-clock-range'))$('garden-clock-range').value=values()[2];}
    deriveMechanism(i);save();visual();}
  let contracts=['',''];
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
      const input=make('input');input.id='value-'+n;input.type='number';input.min=i===2&&n===1?'0':'1';input.max=c.max[n];input.step='1';input.value=l.values[n];input.inputMode='numeric';
      input.oninput=()=>{if(input.value.trim()!==''&&Number.isInteger(Number(input.value)))setValue(n,input.value);};
      minus.onclick=()=>setValue(n,values()[n]-1);plus.onclick=()=>setValue(n,values()[n]+1);row.append(minus,input,plus);
      const range=make('input');range.id='range-'+n;range.type='range';range.min=input.min;range.max=input.max;range.value=l.values[n];range.setAttribute('aria-label',label+'滑桿');range.oninput=()=>setValue(n,range.value);
      dial.append(lab,row,range);$('puzzle-controls').append(dial);
    });
    if(i===1){
      const clock=make('div','garden-clock-control');const label=make('label','','逐分觀察巡園：開園後第幾分鐘？');label.htmlFor='garden-clock';
      const input=make('input');input.type='number';input.id='garden-clock';input.min=1;input.max=60;input.value=l.values[2];input.inputMode='numeric';
      input.oninput=()=>{if(input.value.trim()&&Number.isInteger(Number(input.value)))setValue(2,input.value);};
      const next=make('button','','下一分鐘 →');next.id='garden-next-minute';next.onclick=()=>setValue(2,values()[2]+1);
      const previous=make('button','','← 上一分鐘');previous.onclick=()=>setValue(2,values()[2]-1);
      const slider=make('input');slider.type='range';slider.id='garden-clock-range';slider.min=1;slider.max=60;slider.value=l.values[2];slider.setAttribute('aria-label','巡園觀察分鐘滑桿');slider.oninput=()=>setValue(2,slider.value);
      clock.append(label,previous,input,next,slider);$('puzzle-controls').append(clock);
    }
    contracts=l.complete?['gcd','lcm']:['',''];renderHint();visual();save();
    if(!l.complete)deriveMechanism(i);
    for(let n=0;n<3;n++){
      const generated=([3,5,8,9].includes(i)&&n>0)||(i===11&&n===2)||(i===2&&n<2)||(i===4&&n===0)||([1,6,10].includes(i)&&n===2);
      if(generated){$('value-'+n).readOnly=true;$('value-'+n).title='由機關操作產生，請操作上方圖像';$('range-'+n).hidden=true;
        const buttons=$('value-'+n).parentElement.querySelectorAll('button');buttons.forEach(b=>b.hidden=true);}
    }
    if(i===11)finalFactors=l.factors;
    visual();save();
  }
  function equation(text){$('puzzle-visual').append(make('p','visual-equation',text));}
  function note(text){$('puzzle-visual').append(make('p','visual-note',text));}
  function visual(){
    const i=state.current,c=config[i],v=values(),box=$('puzzle-visual');box.replaceChildren();
    if(i===0){
      const grid=make('div','packing-grid');const each=Math.floor(v[0]/v[1]),remaining=v[0]%v[1];
      for(let n=0;n<v[1];n++){const bag=make('div','mini-bag');bag.append(make('div','orbs','●'.repeat(Math.min(each,16))),make('span','',`${each} 顆`));grid.append(bag);}box.append(grid);
      equation(`${v[0]} ÷ ${v[1]} ＝ ${each}${remaining?' … 餘 '+remaining:''}`);note(`每袋至少5顆：${each>=5?'符合':'尚未符合'}；無剩餘：${remaining===0?'符合':'尚未符合'}。第三格目前記為 ${v[2]} 顆。總數仍須符合兩份分裝紀錄。`);
    }else if([1,6,10].includes(i)){
      if(i===1){
        const board=make('div','garden-patrol-board');const t=v[2];
        const at=v.map((_,n)=>n<2&&t>=c.offset[n]&&(t-c.offset[n])%v[n]===0);
        const points=[0,1].map(n=>{
          if(t<c.offset[n])return {x:45+n*70,y:330};
          const angle=((t-c.offset[n])%v[n])/v[n]*Math.PI*2;
          return {x:310+Math.sin(angle)*(n?260:200)+(at[0]&&at[1]?(n?12:-12):0),y:95+(1-Math.cos(angle))*(n?110:85)};
        });
        board.innerHTML='<svg viewBox="0 0 620 370" role="img" aria-label="兩隊侍衛的巡園路線及目前位置"><ellipse cx="310" cy="180" rx="200" ry="85" class="route-a"/><ellipse cx="310" cy="205" rx="260" ry="110" class="route-b"/>'+palaceSVG.replace('<svg viewBox','<svg x="230" y="-5" width="160" height="100" viewBox')+points.map((p,n)=>`<g transform="translate(${p.x} ${p.y})" class="guard guard-${n}"><circle r="18"/><text y="5" text-anchor="middle">${n?'乙':'甲'}</text></g>`).join('')+'<text x="20" y="365" class="route-caption">甲：第2分鐘起，每'+v[0]+'分鐘</text><text x="350" y="365" class="route-caption">乙：第4分鐘起，每'+v[1]+'分鐘</text></svg>';
        box.append(board);
        const status=make('p','garden-status',`第 ${t} 分鐘 · ${at[0]&&at[1]?'兩隊同時到亭':(at[0]?'甲隊到亭，乙隊仍在巡園':at[1]?'乙隊到亭，甲隊仍在巡園':'兩隊尚未同時到亭')}`);status.id='garden-status';status.setAttribute('aria-live','polite');box.append(status);
      }
      const max=60;
      for(let n=0;n<2;n++){const track=make('div','time-track');track.append(make('b','',i===6?(n?'舞隊':'鼓隊'):i===10?(n?'乙班':'甲班'):(n?'乙隊':'甲隊')));
        if(i===10){const ban=make('div');ban.style.cssText='position:absolute;left:33.333%;width:13.333%;height:100%;background:#ae513f66';track.append(ban);}
        for(let t=c.offset[n];t<=max;t+=v[n]){const marker=make('span');marker.style.left=(t/max*100)+'%';track.append(marker);}
        const cursor=make('span','cursor');cursor.style.left=v[2]/max*100+'%';track.append(cursor);track.setAttribute('aria-label',`${n?'乙':'甲'}隊時間軸，從${c.offset[n]}起，每隔${v[n]}分鐘`);box.append(track);
      }
      const nav=make('div','timeline-nav');for(const t of [12,16,20,24,28,36,48,60]){const b=make('button',t===v[2]?'selected':'',String(t)+' 分');b.onclick=()=>setValue(2,t);nav.append(b);}box.append(nav);
      const meet=v[2]>=c.offset[0]&&v[2]>=c.offset[1]&&(v[2]-c.offset[0])%v[0]===0&&(v[2]-c.offset[1])%v[1]===0;
      equation(`第 ${v[2]} 分鐘 · ${meet?'兩排標記重合':'兩排標記尚未重合'}`);
      note(i===10?`禁行窗20–28分鐘（含端點）：${v[2]>=20&&v[2]<=28?'目前落在禁行窗':'目前在禁行窗外'}。仍須找最早可用時刻。`:i===6?`從11時起算，目前11時${String(v[2]).padStart(2,'0')}分；要在11時20分或之後。`:'注意兩隊起點不同：甲第2分鐘、乙第4分鐘。用線索校準間隔後，再找最早重合。');
    }else if(i===2){
      const rack=make('div','jar-grid');for(const n of [31,33,35,37,39,41]){const b=make('button','jar'+(n===v[0]?' selected':''),String(n));b.append(make('small','','藥方編號'));b.onclick=()=>setValue(0,n);rack.append(b);}box.append(rack);
      const trial=make('section','prime-trial');trial.append(make('h3','','藥方查驗臺'));
      trial.append(make('p','',`先選一張藥方，再試除。目前編號 ${v[0]}；數字和為 ${Math.floor(v[0]/10)+v[0]%10}。`));
      const tools=make('div','prime-tools');for(const d of[2,3,5]){const b=make('button','',`用 ${d} 試除`);b.setAttribute('aria-label',`以${d}試除`);b.onclick=()=>{primeTrials[v[0]]||=[];if(!primeTrials[v[0]].includes(d))primeTrials[v[0]].push(d);visual();};tools.append(b);}trial.append(tools);
      const checked=primeTrials[v[0]]||[],results=make('div','prime-trial-results');results.id='prime-trial-results';
      for(const d of checked)results.append(make('p','',`${v[0]} ÷ ${d} ＝ ${Math.floor(v[0]/d)} … 餘 ${v[0]%d}${v[0]%d===0?'，找到1與本身以外的因數。':''}`));
      const composite=checked.some(d=>v[0]%d===0),allChecked=[2,3,5].every(d=>checked.includes(d));
      const verdict=make('p','prime-verdict',composite?'已找到其他因數，這是合數，不能當作真藥方。':allChecked?'2、3、5都無法整除；在這批候選範圍內，已確認是質數，還要核對範圍與數字和。':'尚未完成質數查驗。請把試除結果當作證據，不要只看奇偶。');verdict.id='prime-verdict';trial.append(results,verdict);
      trial.append(make('p','tiny','候選數最大41，小於7×7；檢查2、3、5即可涵蓋可能的小質因數。試算紀錄只作觀察，刷新後可重新試除。'));box.append(trial);
      equation(`${v[0]} ÷ 5 ＝ ${Math.floor(v[0]/5)} … 餘 ${v[0]%5}`);note(`數字和 ${Math.floor(v[0]/10)+v[0]%10}；原有藥包推算：2 × ${v[0]} − 14 ＝ ${v[0]*2-14}。請自行判斷候選是否為質數。`);
      const shelves=make('div','clinic-drawers');for(let shelf=0;shelf<=4;shelf++){const b=make('button','clinic-drawer'+(v[1]===shelf?' selected':''),shelf+'號');b.append(make('span','drawer-handle','○'));b.setAttribute('aria-label',`選擇${shelf}號貨架`);b.onclick=()=>setValue(1,shelf);shelves.append(b);}box.append(shelves);
    }else if(i===3){
      c.totals.forEach((length,n)=>{const sheet=make('div','cloth-sheet'),cloth=make('div','cloth'+(n===0?' blue':''));cloth.style.width=length/Math.max(...c.totals)*100+'%';cloth.append(make('b','',`${n?'紅':'青'}緞 ${length} cm`));for(let cut=v[0];cut<length;cut+=v[0]){const mark=make('i');mark.style.left=cut/length*100+'%';cloth.append(mark);}const scissors=asset('props/tailor_scissors.png','cutting-tool','裁切工具位置');scissors.style.left=v[0]/Math.max(...c.totals)*100+'%';sheet.append(cloth,scissors);box.append(sheet);});
      equation(`84 ÷ ${v[0]}：${Math.floor(84/v[0])} 段、餘 ${84%v[0]} ｜ 126 ÷ ${v[0]}：${Math.floor(126/v[0])} 段、餘 ${126%v[0]}`);note('切口會隨裁布尺移動。兩匹都無剩料仍不一定是最長段長，請回看裁切規則。');
    }else if(i===4){
      const tree=make('div','factor-tree');tree.append(make('span','factor-token','72'),make('span','','＝'),make('span','factor-token',`${v[0]}^${v[1]}`),make('span','','×'),make('span','factor-token',`3^${v[2]}`));box.append(tree);
      const shelf=make('div','factor-shelf');for(const prime of [2,3,5,7]){const b=make('button','',String(prime));b.setAttribute('aria-label',`選擇質底數${prime}`);b.onclick=()=>setValue(0,prime);shelf.append(b);}box.append(shelf);
      equation(`${v[0]}^${v[1]} × 3^${v[2]} ＝ ${Math.pow(v[0],v[1])*Math.pow(3,v[2])}`);note('鎖盤分別控制質底數、左側指數、右側指數。乘積相同之外，也要符合書脊指定的底數條件。');
    }else if(i===5||i===9){
      const grid=make('div','unit-grid');for(let n=0;n<Math.min(v[0],60);n++){const group=make('div','unit');group.append(make('span','',i===9?'♜':'◈'),make('b','',`第${n+1}${i===9?'隊':'份'}`),make('div','',`${v[1]} ${i===9?'弓':'銀'} / ${v[2]} ${i===9?'槍':'米'}`));grid.append(group);}box.append(grid);
      equation(`${v[0]} × ${v[1]} ＝ ${v[0]*v[1]} / ${c.totals[0]}　｜　${v[0]} × ${v[2]} ＝ ${v[0]*v[2]} / ${c.totals[1]}`);
      note(`尚未分配：${i===9?'弓手':'銀錢'} ${c.totals[0]-v[0]*v[1]}、${i===9?'槍手':'米糧'} ${c.totals[1]-v[0]*v[2]}。負數表示超用；兩類都須恰好分完。`);
    }else if(i===7){
      const grid=make('div','contract-grid');['分禮盟約','送信盟約'].forEach((name,n)=>{const card=make('div','contract');card.append(make('h3','',name));for(const [key,text]of[['gcd','最大公因數'],['lcm','最小公倍數']]){const b=make('button',contracts[n]===key?'selected':'',text);b.onclick=()=>{contracts[n]=key;visual();};card.append(b);}grid.append(card);});box.append(grid);
      equation(`${v[0]} ＋ ${v[1]} ＝ ${v[0]+v[1]} → 盟印目前 ${v[2]}`);note('先把兩份盟約分到適合的方法，再填數值。不能只看「最多」「最少」而忽略分組與同步的結構。');
    }else if(i===8){
      const chart=make('div','supply-chart');let stock=40,added=0;
      for(let day=1;day<=v[0];day++){let gain=0;if(day%6===0)gain+=4;if(day%8===0)gain+=6;stock+=gain-1;added+=gain;const bar=make('i',gain?'':'used');bar.style.height=Math.max(3,Math.min(150,stock*2))+'px';bar.title=`第${day}日：入庫${gain}份、消耗1份後剩${stock}份`;chart.append(bar);}box.append(chart);
      const labels=make('div','supply-labels');labels.append(make('span','','第1日'),make('span','',`第${v[0]}日`));box.append(labels);equation(`原有40 ＋ 新收${added} − 消耗${v[0]} ＝ ${stock}`);note('綠柱為當日有補給，紅柱為當日只有消耗。圖表計入盤點當天；盤點日期還須符合兩路首次再次同日到達。');
    }else{
      const chain=make('div','evidence-lock');['賞賜證據','時序證據','密詔回驗'].forEach((label,n)=>{const cell=make('span','',String(v[n]));cell.append(make('small','',label));chain.append(cell);});box.append(chain);
      equation(`密詔原數 N ＝ ${v[0]} × ${v[1]} ＝ ${v[0]*v[1]}`);note('第三格必須用前兩格乘積重新質因數分解，將重複出現的質數分別計數。三項證據缺一不可。');
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
    if(i===7&&(contracts[0]!=='gcd'||contracts[1]!=='lcm')){$('puzzle-feedback').textContent='兩份盟約需要不同的推理方法；先把分禮與送信分別歸類，再驗證數值。';return;}
    if(i===11&&!l.complete&&finalFactors.reduce((a,b)=>a*b,1)!==values()[0]*values()[1]){$('puzzle-feedback').textContent='密詔還未完整拆解：請操作質數籌碼，直到尚待分解數值為1，再提出證據。';return;}
    const submitted=config[i].labels.map((_,n)=>$('value-'+n).value);const result=core.verify(state,i,submitted,p);save();tone(result.correct);
    if(!result.correct){$('puzzle-feedback').textContent=result.reason==='input'?'請填入控制盤允許範圍內的整數。':'機關沒有開啟：目前組合尚未同時滿足三份線索。對照圖像、餘數與條件，再調整一次。';renderHint();return;}
    $('puzzle-feedback').textContent='三份線索相互吻合，機關已開啟。';renderClues();
    if(result.already)return;
    $('victory-cg').hidden=i>=materialCG.length;
    if(i<materialCG.length){$('victory-cg').src='assets/cg/'+materialCG[i];$('victory-cg').alt=p.location+'查證事件';}
    $('victory').classList.toggle('with-cg',i<materialCG.length);
    $('victory-title').textContent=p.location+' · 證據到手';$('victory-explanation').textContent=p.explanation;
    $('victory-followup').textContent=i===11?'十二份證據完成回驗。密詔與虛報帳冊的矛盾已公開，你以推理終結了這場宮廷密謀。':`藏在機關裡的記錄指向${puzzles[i+1].location}。下一局已解鎖，調查尚未結束。`;
    $('victory').showModal();animate($('victory'),[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:650});
  };
  $('victory-next').onclick=()=>{$('victory').close();changeScene(showMap);};$('victory-stay').onclick=()=>$('victory').close();
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
  $('reset-confirm').onclick=()=>{state=core.fresh();$('reset-dialog').close();save();showMap();};
  // Restore the location without replaying the film; all clues remain in the hand-written journal.
  if(state.current>=0){room(state.current);}else showMap(false);
  selectPlace(Math.min(core.evidence(state),11));panMap();
  renderHud();
  $('save-message').textContent=warning||'素材已整合：宮城總圖與十二局專屬場景、人物、道具及過場';
})();
