/* Private 1080 × 1920 Snapchat-ready story.
 * Any past day can be selected. Steps and estimated calories are only shown
 * when recorded, with no invented zeroes. All drawing happens locally.
 */
(() => {
  'use strict';
  const START='2026-11-15',GOAL=10000;
  const $=id=>document.getElementById(id);
  let getState=null,blob=null,previewURL=null,currentDate=null,busy=false,serial=0,queued=false;
  const K={white:'#F9FBFF',muted:'#B7CAE5',blue:'#8DC8FF',
    mint:'#90E8C7',coral:'#FFBAAE',gold:'#FFDC9A'};
  const number=v=>Number(v).toLocaleString('en-US');
  function key(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function parse(k){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k||''))return null;
    const [y,m,d]=k.split('-').map(Number);
    const val=new Date(y,m-1,d,12);
    return val.getFullYear()===y&&val.getMonth()===m-1&&val.getDate()===d?val:null;
  }
  function dateText(k){return parse(k).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}
  function short(k){return parse(k).toLocaleDateString('en-US',{day:'numeric',month:'short'});}
  function dayNumber(k){const base=parse(START),to=parse(k);return Math.round((to-base)/86400000)+1;}
  function compute(entries,selected){
    if(!(entries instanceof Map))entries=new Map();
    const at=parse(selected);
    if(!at||selected>key(new Date()))throw new Error('Choose a valid date up to today.');
    const archived=selected<START,day=archived?null:dayNumber(selected);
    // Retain original 30-day challenge boundaries for contemporary stories;
    // old historical stories show old history rather than future check-ins.
    const days=[...entries].filter(([date])=>date<=selected&&(archived||date>=START))
      .sort((a,b)=>b[0].localeCompare(a[0]));
    const history=days.filter(([date])=>date!==selected).slice(0,7)
      .map(([date,entry])=>({date,entry,current:false}));
    const current={date:selected,entry:entries.get(selected)||null,current:true};
    const cards=[current,...history];
    const logged=days.length;
    const stepRows=days.filter(([,value])=>Number.isFinite(value?.steps));
    const steps=stepRows.reduce((total,[,value])=>total+value.steps,0);
    const goals=stepRows.filter(([,value])=>value.steps>=GOAL).length;
    const streak=window.FitnessProgress?.streak(entries,selected)||
      {current:0,best:0,goalDays:goals};
    return {date:selected,archived,day,cards,entry:current.entry,logged,steps,goals,streak};
  }
  function rr(ctx,x,y,w,h,r=24){
    const q=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+q,y);ctx.lineTo(x+w-q,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+q);ctx.lineTo(x+w,y+h-q);
    ctx.quadraticCurveTo(x+w,y+h,x+w-q,y+h);ctx.lineTo(x+q,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-q);ctx.lineTo(x,y+q);
    ctx.quadraticCurveTo(x,y,x+q,y);ctx.closePath();
  }
  function panel(c,x,y,w,h,fill='rgba(255,255,255,.065)',stroke='rgba(202,222,255,.18)',r=27){
    c.save();rr(c,x,y,w,h,r);c.fillStyle=fill;c.fill();
    c.lineWidth=2;c.strokeStyle=stroke;c.stroke();c.restore();
  }
  function text(c,s,x,y,size=30,color=K.white,bold=false,align='left'){
    c.fillStyle=color;c.textAlign=align;
    c.font=(bold?'700 ':'500 ')+size+'px -apple-system, BlinkMacSystemFont, Arial, sans-serif';
    c.fillText(s,x,y);
  }
  function display(value){return value==null||!Number.isFinite(Number(value))?'—':number(value);}
  function draw(data){
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920;
    const c=canvas.getContext('2d',{alpha:false});
    if(!c)throw new Error('Could not render the story on this device.');
    const bg=c.createLinearGradient(0,0,1080,1920);
    bg.addColorStop(0,'#172F57');bg.addColorStop(.5,'#101E38');bg.addColorStop(1,'#0B162C');
    c.fillStyle=bg;c.fillRect(0,0,1080,1920);
    const glow=c.createRadialGradient(850,230,30,850,230,650);
    glow.addColorStop(0,'rgba(43,149,254,.21)');glow.addColorStop(1,'rgba(43,149,254,0)');
    c.fillStyle=glow;c.fillRect(0,0,1080,950);
    c.lineWidth=2;c.strokeStyle='rgba(157,197,242,.12)';
    rr(c,43,54,994,1817,49);c.stroke();

    panel(c,86,105,909,122,'rgba(255,255,255,.055)',undefined,25);
    panel(c,119,129,70,70,'rgba(98,171,255,.28)','rgba(160,211,255,.4)',18);
    c.strokeStyle=K.white;c.lineWidth=6;c.beginPath();
    c.moveTo(130,167);c.lineTo(146,167);c.lineTo(155,145);
    c.lineTo(167,186);c.lineTo(178,165);c.stroke();
    text(c,'FITNESS',215,167,38,K.white,true);
    text(c,'A day worth celebrating',215,201,24,K.muted);
    text(c,'PRIVATE PROGRESS • MADE TO SHARE',989,172,19,K.muted,false,'right');

    text(c,data.archived?'MY FITNESS HISTORY':'MY 30-DAY CHALLENGE',88,310,30,K.blue,true);
    text(c,data.archived?'A DAY IN MY JOURNEY':'DAY '+data.day+' / 30',85,374,62,K.white,true);
    text(c,dateText(data.date),90,417,27,K.muted);

    panel(c,86,458,909,306,'rgba(34,83,131,.36)','rgba(131,194,255,.28)',34);
    text(c,'THIS DAY',122,512,28,K.muted,true);
    c.strokeStyle='rgba(189,216,249,.22)';c.lineWidth=2;
    c.beginPath();c.moveTo(548,555);c.lineTo(548,723);c.stroke();
    const steps=data.entry?.steps??null,calories=data.entry?.calories_estimate??null;
    text(c,display(steps),122,636,steps===null?100:76,K.mint,true);
    text(c,'STEPS',126,695,27,K.mint,true);
    text(c,display(calories),580,636,calories===null?100:76,K.coral,true);
    text(c,'KCAL • ESTIMATED',584,695,25,K.coral,true);

    panel(c,86,792,909,127,'rgba(254,184,96,.095)','rgba(255,222,170,.22)',27);
    text(c,'10K DAILY STREAK',120,840,25,K.gold,true);
    text(c,number(data.streak.current),122,893,53,K.white,true);
    text(c,data.streak.current===1?'DAY':'DAYS',178,892,24,K.muted,true);
    text(c,'GOAL DAYS '+number(data.goals),956,849,22,K.muted,true,'right');
    text(c,'BEST STREAK '+number(data.streak.best),956,889,22,K.muted,true,'right');

    text(c,'THIS DAY & PREVIOUS LOGS',90,981,30,K.white,true);
    text(c,'Steps / estimated kcal',988,981,21,K.muted,false,'right');
    const width=440,height=166,gapX=27,gapY=18;
    const left=86,top=1014;
    for(let i=0;i<8;i++){
      const col=i%2,row=Math.floor(i/2),x=left+col*(width+gapX),y=top+row*(height+gapY);
      const entry=data.cards[i];
      panel(c,x,y,width,height,entry?.current?'rgba(55,126,188,.22)':entry?'rgba(255,255,255,.055)':'rgba(255,255,255,.028)',
        entry?.current?'rgba(146,205,255,.48)':'rgba(205,224,255,.17)',25);
      if(!entry)continue;
      text(c,short(entry.date),x+23,y+39,27,entry.current?K.blue:K.white,true);
      if(entry.current)text(c,'SELECTED',x+width-23,y+38,20,K.blue,true,'right');
      const step=entry.entry?.steps??null,cal=entry.entry?.calories_estimate??null;
      text(c,'STEPS',x+24,y+82,19,K.mint,true);
      text(c,display(step),x+width-25,y+91,38,step==null?K.muted:K.white,true,'right');
      text(c,'KCAL',x+24,y+133,19,K.coral,true);
      text(c,display(cal),x+width-25,y+143,35,cal==null?K.muted:K.white,true,'right');
    }
    text(c,'Small steps. Real progress.',88,1850,25,K.white,true);
    text(c,'fitness.oalfawzan.sa',990,1850,21,K.muted,false,'right');
    return canvas;
  }
  function status(s,type=''){
    const target=$('storyStatus');
    if(target){target.textContent=s;target.className='story-status'+(type?' is-'+type:'');}
  }
  function chosenDate(){
    const el=$('storySelectedDate');
    return el?.value||key(new Date());
  }
  async function prepare(){
    if(busy){queued=true;return;}
    const state=getState?.();
    if(!state?.userId||state.readonly)throw new Error('Only your own progress can be shared.');
    const selected=chosenDate();
    if(!parse(selected)||selected>key(new Date()))throw new Error('Choose a date up to today.');
    const request=++serial;
    busy=true;
    blob=null;status('Generating the image…');
    try{
      const info=compute(state.entries||new Map(),selected),canvas=draw(info);
      const image=await new Promise((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('Image export failed.')),'image/png'));
      if(request!==serial)return;
      if(previewURL)URL.revokeObjectURL(previewURL);
      currentDate=selected;
      blob=image;previewURL=URL.createObjectURL(image);
      $('storyPreviewImage').src=previewURL;
      const label=info.archived?'Historical day':('Day '+info.day);
      $('storyPreviewCaption').textContent=label+' · '+dateText(info.date)+' · '+
        display(info.entry?.steps)+' steps · '+display(info.entry?.calories_estimate)+' kcal';
      status('Image ready. Share it or save to your photos.','success');
    }finally{
      busy=false;
      // On iOS the PNG encoding may still be running as the user picks a
      // different date. Always render the last date selected in the picker.
      if(queued){
        queued=false;
        prepare().catch(e=>status(e?.message||'Could not update the story.','error'));
      }
    }
  }
  async function open(){
    const dlg=$('storyDialog');
    if(!getState||!dlg)return;
    const state=getState();
    if(!state?.userId||state.readonly)return;
    const input=$('storySelectedDate');
    const dates=[...state.entries.keys()].sort();
    input.min=dates[0]||START;input.max=key(new Date());
    const request=new URLSearchParams(window.location.search).get('story');
    const date=parse(request)&&request<=input.max&&request>=input.min?request:key(new Date());
    input.value=date;
    if(!dlg.open)dlg.showModal();
    try{await prepare()}catch(e){status(e.message||'Could not create a story.','error');}
  }
  function filename(){return 'fitness-story-'+(currentDate||key(new Date()))+'.png';}
  function save(){
    if(!blob){status('Select a day and wait for the image.','error');return;}
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename();document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    status('Saved the story image. Choose it from Snapchat photos.','success');
  }
  async function share(){
    if(!blob){status('Select a day and wait for the image.','error');return;}
    const file=new File([blob],filename(),{type:'image/png'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      try{
        await navigator.share({files:[file]});
        status('Sharing opened. Choose Snapchat or your photo app.','success');
      }catch(e){if(e.name!=='AbortError')status('Sharing was unavailable. Tap Save image.','error');}
    }else save();
  }
  function mount(callback){
    if(getState)return;
    getState=callback;
    $('storyOpenBtn')?.addEventListener('click',open);
    $('storySelectedDate')?.addEventListener('change',()=>{
      if(!$('storyDialog')?.open)return;
      prepare().catch(e=>status(e.message||'Invalid date','error'));
    });
    $('storyCloseBtn')?.addEventListener('click',()=>$('storyDialog').close());
    $('storyDownloadBtn')?.addEventListener('click',save);
    $('storyShareBtn')?.addEventListener('click',share);
  }
  let requestedOpened=false;
  function openRequested(){
    if(requestedOpened || !getState?.()?.userId)return;
    if(!new URLSearchParams(window.location.search).has('story'))return;
    requestedOpened=true;
    open();
  }
  window.FitnessStory=Object.freeze({mount,compute,openRequested});
})();