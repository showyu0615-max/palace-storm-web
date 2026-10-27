/* Original pentatonic instrumental score, synthesized locally with Web Audio. */
(function(){
  'use strict';
  const button=document.getElementById('music'),slider=document.getElementById('music-volume');
  const KEY='palace-background-music-v1';
  let enabled=true,volume=.25,unlocked=false,context,master,timer,pauseTimer,next=0,step=0;
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved.enabled==='boolean'&&Number.isFinite(saved.volume)){enabled=saved.enabled;volume=Math.max(0,Math.min(1,saved.volume));}}catch{/* Optional local preference. */}
  // Eight phrases; one beat per step at 76 BPM, with space for dialogue.
  const melody=[
    72,null,76,74,72,69,67,null, 69,72,74,null,76,74,72,null,
    67,69,72,74,72,null,69,null, 67,64,67,69,67,null,64,null,
    72,76,79,null,76,74,72,null, 69,72,76,74,72,69,67,null,
    64,67,69,72,69,null,67,null, 64,62,64,67,60,null,null,null
  ];
  const roots=[48,45,43,48,48,45,43,48],beat=60/76;
  function render(){
    slider.value=String(Math.round(volume*100));button.setAttribute('aria-pressed',String(enabled));
    button.textContent=!enabled?'配樂：關':volume===0?'配樂：靜音':!unlocked?'配樂：待播放':document.hidden?'配樂：暫停':context?.state==='running'?'配樂：開':'配樂：點擊播放';
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify({enabled,volume}));}catch{/* Playing does not require storage. */}}
  function note(midi,time,strength,length,plucked){
    const hz=440*Math.pow(2,(midi-69)/12);
    for(const [partial,level]of(plucked?[[1,.8],[2,.22],[3,.08]]:[[1,1]])){
      const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=hz*partial;
      gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(strength*level,time+(plucked?.012:.35));gain.gain.exponentialRampToValueAtTime(.0001,time+length);
      osc.connect(gain);gain.connect(master);osc.start(time);osc.stop(time+length+.02);
    }
  }
  function schedule(){
    if(next<context.currentTime)next=context.currentTime+.06;
    while(next<context.currentTime+.5){
      const index=step%melody.length;
      if(melody[index]!==null)note(melody[index],next,.18,beat*2.2,true);
      if(index%8===0){const root=roots[index/8];note(root,next,.11,beat*7.5,false);note(root+7,next+beat*.5,.035,beat*6,false);}
      step++;next+=beat;
    }
  }
  async function sync(){
    clearTimeout(pauseTimer);
    if(!enabled||!unlocked||document.hidden||volume===0){
      clearInterval(timer);timer=null;
      if(context&&context.state==='running'){
        master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(0,context.currentTime,.06);
        pauseTimer=setTimeout(()=>{if(!enabled||document.hidden||volume===0)context.suspend().then(render).catch(()=>{});},250);
      }
      render();return;
    }
    try{
      if(!context){const Audio=window.AudioContext||window.webkitAudioContext;context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);}
      await context.resume();
      if(!enabled||document.hidden||volume===0)return sync();
      master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(volume,context.currentTime,.15);
      if(!timer){schedule();timer=setInterval(schedule,200);}render();
    }catch{button.textContent='配樂：無法播放';}
  }
  function unlock(){if(!unlocked){unlocked=true;sync();}}
  button.onclick=e=>{e.stopPropagation();if(!unlocked||enabled&&volume>0&&context?.state!=='running'){unlocked=true;enabled=true;}else enabled=!enabled;save();sync();};
  slider.oninput=()=>{volume=Number(slider.value)/100;save();sync();};
  document.addEventListener('click',unlock);
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('#music'))unlock();});
  document.addEventListener('visibilitychange',sync);
  render();
})();
