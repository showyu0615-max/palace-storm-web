/* User-provided scene music; MP3 files remain unchanged in music/. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),button=$('music'),slider=$('music-volume'),files=window.PalaceAudioTracks;
  const KEY='palace-background-music-v1',tracks=new Map(),pending=new Set(),failed=new Set();
  let enabled=true,volume=.25,unlocked=false,wanted='',fadeTimer,effect;
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved.enabled==='boolean'&&Number.isFinite(saved.volume)){enabled=saved.enabled;volume=Math.max(0,Math.min(1,saved.volume));}}catch{/* Optional preference. */}
  function selectTrack(){
    const late=Number($('progress').textContent.match(/證據\s*(\d+)/)?.[1])>=8;
    if($('victory').open||$('journal').open&&!$('evidence-case').hidden)return 'victory';
    if($('journal').open)return late?'late':'explore';
    if($('hall-entry').open||$('world').classList.contains('travelling')||!$('world').hidden)return 'map';
    return late?'late':!$('workbench').hidden?'puzzle':'explore';
  }
  function render(){
    slider.value=String(Math.round(volume*100));button.setAttribute('aria-pressed',String(enabled));button.dataset.track=wanted;
    button.title='目前配樂：'+({map:'Track 1 · 宮道慢行',explore:'Track 2 · 廳堂搜證',puzzle:'Track 3 · 算籌心計',late:'Track 4 · 深宮暗湧',victory:'Track 5 · 證據入匣'}[wanted]);
    button.textContent=!enabled?'配樂：關':volume===0?'配樂：靜音':!unlocked?'配樂：待播放':document.hidden?'配樂：暫停':failed.has(wanted)?'配樂：檔案無法播放':tracks.get(wanted)?.paused===false?'配樂：開':'配樂：點擊播放';
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify({enabled,volume}));}catch{/* Storage is optional. */}}
  function music(name){
    if(!tracks.has(name)){
      const audio=new Audio();audio.src=files[name];audio.loop=true;audio.preload='none';audio.volume=0;audio.dataset.palaceTrack=name;audio.hidden=true;document.body.append(audio);
      audio.addEventListener('error',()=>{failed.add(name);render();});tracks.set(name,audio);
    }
    return tracks.get(name);
  }
  function fade(active){
    clearInterval(fadeTimer);
    const start=performance.now(),duck=effect&&!effect.paused ? .45 : 1;
    const plan=[...tracks.values()].map(audio=>({audio,from:audio.volume,to:audio===active?volume*duck:0}));
    fadeTimer=setInterval(()=>{
      const t=Math.min(1,(performance.now()-start)/900);
      for(const {audio,from,to}of plan){audio.volume=from+(to-from)*t;if(t===1&&to===0)audio.pause();}
      if(t===1){clearInterval(fadeTimer);fadeTimer=null;render();}
    },40);
  }
  function pauseAll(){clearInterval(fadeTimer);fadeTimer=null;for(const audio of tracks.values()){audio.volume=0;audio.pause();}if(effect)effect.pause();}
  function sync(){
    wanted=selectTrack();
    if(document.hidden){pauseAll();render();return;}
    const active=enabled&&unlocked&&volume>0?music(wanted):null;
    if(active&&active.paused&&!pending.has(active)&&!failed.has(wanted)){
      pending.add(active);active.play().then(()=>{pending.delete(active);if(!enabled||document.hidden||volume===0||tracks.get(wanted)!==active)active.pause();render();}).catch(error=>{pending.delete(active);if(error.name!=='AbortError'){failed.add(active.dataset.palaceTrack);render();}});
    }
    fade(active);render();
  }
  function playEffect(name){
    if(!['clue','entry','success'].includes(name)||$('sound').getAttribute('aria-pressed')!=='true'||document.hidden)return;
    unlocked=true;
    if(!effect){effect=new Audio();effect.preload='none';effect.hidden=true;effect.volume=.45;document.body.append(effect);effect.addEventListener('ended',sync);effect.addEventListener('error',sync);}
    effect.pause();effect.src=files[name];effect.dataset.palaceEffect=name;
    effect.play().then(sync).catch(()=>sync());
  }
  button.onclick=e=>{
    e.stopPropagation();
    if(!unlocked||enabled&&volume>0&&tracks.get(wanted)?.paused){unlocked=true;enabled=true;failed.delete(wanted);}else enabled=!enabled;
    save();sync();
  };
  slider.oninput=()=>{unlocked=true;volume=Number(slider.value)/100;save();sync();};
  function unlock(){if(!unlocked){unlocked=true;sync();}}
  document.addEventListener('click',unlock);document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('#music'))unlock();});
  document.addEventListener('palace-sound',e=>playEffect(e.detail));
  document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',pauseAll);window.addEventListener('pageshow',sync);
  const observer=new MutationObserver(()=>{if($('sound').getAttribute('aria-pressed')!=='true'&&effect)effect.pause();sync();});
  for(const id of ['world','room','workbench','victory','journal','hall-entry','evidence-case'])observer.observe($(id),{attributes:true,attributeFilter:['hidden','open',...(id==='world'?['class']:[])]});
  observer.observe($('progress'),{childList:true});observer.observe($('sound'),{attributes:true,attributeFilter:['aria-pressed']});
  sync();
})();
