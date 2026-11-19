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
    const monthStart=new Date(at.getFullYear(),at.getMonth(),1,12);
    const daysInMonth=new Date(at.getFullYear(),at.getMonth()+1,0).getDate();
    const offset=(monthStart.getDay()+6)%7; // Monday first, like a real calendar
    const weeks=Math.ceil((offset+daysInMonth)/7);
    const monthDays=Array.from({length:daysInMonth},(_,i)=>{
      const d=new Date(at.getFullYear(),at.getMonth(),i+1,12);
      const date=key(d);
      const entry=date<=selected?entries.get(date)||null:null;
      return {date,day:i+1,entry,selected:date===selected,
        future:date>selected,
        steps:Number.isFinite(entry?.steps)?entry.steps:null,
        kcal:Number.isFinite(entry?.calories_estimate)?entry.calories_estimate:null,
        goal:Number.isFinite(entry?.steps)&&entry.steps>=GOAL};
    });
    const monthEntries=monthDays.filter(d=>d.entry);
    const goalDays=monthDays.filter(d=>d.goal).length;
    const past=monthDays.filter(d=>d.entry && d.date<selected).reverse().slice(0,4);
    const rawStreak=window.FitnessProgress?.streak(entries,selected)||
      {current:0,best:0,goalDays:goalDays};
    // For a completed historical day, a missed goal breaks the streak.
    // Today remains eligible to extend yesterday's streak during the day.
    const streak={
      ...rawStreak,
      current:selected<key(new Date()) && !monthDays.some(d=>d.selected && d.goal)
        ?0:rawStreak.current
    };
    return {date:selected,archived,day,entry:entries.get(selected)||null,
      monthLabel:at.toLocaleDateString('en-US',{month:'long',year:'numeric'}),
      offset,weeks,daysInMonth,monthDays,monthEntries,goalDays,past,streak};
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
  function flame(c,x,y,size=32,glow=false){
    // Hand-drawn vector flame, not an emoji, font glyph or external image.
    c.save();c.translate(x,y);c.scale(size/100,size/100);
    if(glow){c.shadowColor='rgba(255,121,53,.85)';c.shadowBlur=30;}
    const fire=c.createLinearGradient(0,4,95,96);
    fire.addColorStop(0,'#FFF1BA');fire.addColorStop(.38,'#FFA65A');
    fire.addColorStop(1,'#F25D43');
    c.beginPath();
    c.moveTo(51,96);
    c.bezierCurveTo(18,93,13,69,28,43);
    c.bezierCurveTo(33,59,43,59,44,44);
    c.bezierCurveTo(49,27,51,17,46,5);
    c.bezierCurveTo(78,25,92,50,89,69);
    c.bezierCurveTo(88,87,73,96,51,96);
    c.closePath();
    c.fillStyle=fire;c.fill();
    c.shadowBlur=0;
    c.beginPath();c.moveTo(55,88);
    c.bezierCurveTo(38,83,37,67,49,54);
    c.bezierCurveTo(49,69,59,69,63,57);
    c.bezierCurveTo(78,75,70,88,55,88);
    c.closePath();c.fillStyle='#FFE6AF';c.fill();c.restore();
  }
  function shoe(c,x,y,size=27,color='#9DBADB'){
    // A tiny original line-art running shoe for step days.
    c.save();c.translate(x,y);c.scale(size/40,size/40);
    c.lineWidth=3;c.strokeStyle=color;c.lineJoin='round';c.lineCap='round';
    c.beginPath();
    c.moveTo(4,27);c.bezierCurveTo(10,26,11,17,15,10);
    c.lineTo(22,16);c.lineTo(27,18);
    c.bezierCurveTo(28,23,34,25,37,26);
    c.lineTo(37,32);c.quadraticCurveTo(19,35,4,32);c.closePath();c.stroke();
    c.beginPath();c.moveTo(16,17);c.lineTo(21,21);c.moveTo(21,14);c.lineTo(26,19);
    c.moveTo(7,30);c.lineTo(36,30);c.stroke();c.restore();
  }
  function compact(v){
    if(v==null)return '—';
    if(v>=10000)return (v/1000).toFixed(1).replace(/\.0$/,'')+'k';
    if(v>=1000)return (v/1000).toFixed(1).replace(/\.0$/,'')+'k';
    return String(Math.round(v));
  }
  function draw(data){
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920;
    const c=canvas.getContext('2d',{alpha:false});
    if(!c)throw new Error('Could not render the story on this device.');
    const bg=c.createLinearGradient(0,0,1040,1920);
    bg.addColorStop(0,'#07172E');bg.addColorStop(.53,'#122650');bg.addColorStop(1,'#09132C');
    c.fillStyle=bg;c.fillRect(0,0,1080,1920);
    const halo=c.createRadialGradient(960,290,20,960,290,850);
    halo.addColorStop(0,'rgba(38,136,251,.35)');halo.addColorStop(1,'rgba(38,136,251,0)');
    c.fillStyle=halo;c.fillRect(0,0,1080,1300);
    const orange=c.createRadialGradient(85,1670,20,85,1670,650);
    orange.addColorStop(0,'rgba(232,100,61,.22)');orange.addColorStop(1,'rgba(232,100,61,0)');
    c.fillStyle=orange;c.fillRect(0,970,950,950);
    // Dynamic electric-blue ribbons behind the floating calendar.
    c.save();
    c.beginPath();c.moveTo(0,0);c.lineTo(570,0);
    c.bezierCurveTo(425,135,325,240,0,330);c.closePath();
    c.fillStyle='rgba(37,130,235,.22)';c.fill();
    c.beginPath();c.moveTo(1080,1630);c.bezierCurveTo(820,1750,660,1830,385,1920);
    c.lineTo(1080,1920);c.closePath();
    c.fillStyle='rgba(44,124,227,.16)';c.fill();
    c.restore();

    // Brand line-art, deliberately no emoji or user-specific information.
    panel(c,63,76,67,67,'rgba(107,181,255,.16)','rgba(135,204,255,.42)',18);
    shoe(c,77,94,43,'#D5EAFF');
    text(c,'FITNESS',153,121,41,K.white,true);
    text(c,'YOUR MOVEMENT. YOUR MOMENT.',154,151,19,K.muted,true);
    text(c,'oalfawzan.sa',1010,123,23,K.muted,false,'right');

    // Frosted navy calendar panel with a cyan rim.
    panel(c,50,204,980,1352,'rgba(13,35,70,.88)','rgba(136,200,255,.40)',49);
    const topGlow=c.createLinearGradient(70,210,1006,1530);
    topGlow.addColorStop(0,'rgba(170,218,255,.12)');
    topGlow.addColorStop(.55,'rgba(46,108,201,.025)');
    topGlow.addColorStop(1,'rgba(252,146,94,.12)');
    c.save();rr(c,52,206,976,1348,46);c.clip();
    c.fillStyle=topGlow;c.fillRect(52,206,976,1348);c.restore();

    text(c,data.monthLabel.toUpperCase(),93,282,44,K.white,true);
    text(c,data.archived?'HISTORICAL STEPS':'CONSISTENCY, ONE DAY AT A TIME',95,322,24,K.muted);
    panel(c,786,244,209,49,'rgba(80,152,225,.12)','rgba(141,197,255,.27)',20);
    text(c,'AS OF '+short(data.date).toUpperCase(),887,275,22,K.blue,true,'center');

    // Three strong stats. All values are computed from actual saved entries.
    const statX=[90,395,700],statWidth=288;
    for(let i=0;i<3;i++)panel(c,statX[i],362,statWidth,177,
      i===0?'rgba(255,155,96,.12)':'rgba(153,207,255,.075)',
      i===0?'rgba(255,173,119,.30)':'rgba(158,210,255,.17)',24);
    text(c,'10K STREAK',115,410,23,K.gold,true);
    flame(c,322,385,37,true);
    text(c,number(data.streak.current),114,487,71,K.white,true);
    text(c,data.streak.current===1?'DAY':'DAYS',114,519,19,K.muted,true);

    text(c,'10K DAYS',420,410,23,K.mint,true);
    text(c,number(data.goalDays),419,489,71,K.white,true);
    text(c,'THIS MONTH',419,519,19,K.muted,true);

    text(c,'BEST STREAK',727,410,23,K.blue,true);
    text(c,number(data.streak.best),725,489,71,K.white,true);
    text(c,'DAYS TO DATE',725,519,19,K.muted,true);

    text(c,'YOUR MONTH',96,623,31,K.white,true);
    const achieved=data.monthDays.filter(d=>d.goal).length;
    text(c,achieved+' / '+data.daysInMonth+' DAYS REACHED 10K',
      991,621,20,K.muted,true,'right');
    const weekdays=['M','T','W','T','F','S','S'];
    const x0=99,colStep=124;
    for(let i=0;i<7;i++)text(c,weekdays[i],x0+i*colStep+50,687,24,
      i===6?'#FFCCA4':K.muted,true,'center');

    const stride=data.weeks===6?97:data.weeks===5?107:118;
    const cellH=data.weeks===6?87:data.weeks===5?94:104;
    const y0=712;
    let lastTileBottom=y0;
    for(const d of data.monthDays){
      const index=data.offset+d.day-1;
      const col=index%7,row=Math.floor(index/7);
      const x=x0+col*colStep,y=y0+row*stride,w=103,h=cellH;
      lastTileBottom=Math.max(lastTileBottom,y+h);
      const isLogged=Boolean(d.entry);
      const fill=d.goal?'rgba(229,117,62,.16)':
        d.selected?'rgba(74,146,239,.20)':
        isLogged?'rgba(82,158,215,.15)':'rgba(255,255,255,.035)';
      const stroke=d.selected?'#94CBFF':d.goal?'rgba(255,168,97,.62)':
        isLogged?'rgba(149,205,255,.27)':'rgba(172,205,248,.10)';
      c.save();
      if(d.selected){c.shadowColor='rgba(68,152,255,.60)';c.shadowBlur=18;}
      panel(c,x,y,w,h,fill,stroke,20);
      c.restore();
      text(c,String(d.day),x+12,y+27,24,
        d.future?'#7185A4':d.goal?K.gold:d.selected?K.white:'#DAE5F5',true);
      if(d.goal){
        flame(c,x+69,y+5,29,d.selected);
      }else if(isLogged){
        shoe(c,x+77,y+7,21,K.blue);
      }
      if(isLogged){
        // Step and kcal figures are abbreviated to fit in each calendar tile.
        // The selected-day panel below shows the exact numbers.
        text(c,compact(d.steps)+' st',x+12,y+h-30,18,d.goal?K.gold:K.mint,true);
        text(c,compact(d.kcal)+' cal',x+12,y+h-9,16,K.coral,false);
      }else if(d.selected){
        text(c,'NO LOG',x+12,y+h-14,15,K.muted,true);
      }
    }

    // Slim streak connector, borrowed as a concept from sports heatmaps.
    // Position reflects how many actual 10K days were logged in this month.
    const railX=973,railTop=720,railBottom=lastTileBottom;
    panel(c,965,railTop,22,Math.max(45,railBottom-railTop),
      'rgba(255,179,101,.12)','rgba(255,164,91,.18)',11);
    const ratio=data.daysInMonth?achieved/data.daysInMonth:0;
    if(ratio>0){
      const height=(railBottom-railTop-8)*ratio;
      const g=c.createLinearGradient(0,railBottom-height,0,railBottom);
      g.addColorStop(0,'#FFCE84');g.addColorStop(1,'#FA6C48');
      rr(c,970,railBottom-height-4,12,height,6);c.fillStyle=g;c.fill();
      flame(c,953,Math.max(railTop,railBottom-height-26),39,true);
    }

    // Key to the heatmap, colors are descriptive and never a fabricated score.
    panel(c,91,1350,892,52,'rgba(255,255,255,.038)','rgba(185,218,255,.12)',19);
    c.beginPath();c.arc(124,1376,9,0,Math.PI*2);c.fillStyle=K.blue;c.fill();
    text(c,'LOGGED',144,1383,19,K.muted,true);
    flame(c,344,1359,24,false);
    text(c,'10K REACHED',381,1383,19,K.gold,true);
    c.beginPath();c.arc(620,1376,10,0,Math.PI*2);c.strokeStyle=K.blue;
    c.lineWidth=3;c.stroke();
    text(c,'SELECTED DAY',643,1383,19,K.muted,true);

    // Selected day always gets generous real-number typography.
    panel(c,89,1417,895,118,'rgba(77,135,192,.16)','rgba(157,202,252,.25)',25);
    text(c,'SELECTED DAY',119,1451,20,K.muted,true);
    c.strokeStyle='rgba(205,226,255,.18)';c.lineWidth=2;
    c.beginPath();c.moveTo(544,1443);c.lineTo(544,1514);c.stroke();
    text(c,display(data.entry?.steps),116,1504,53,K.mint,true);
    text(c,'STEPS',407,1504,20,K.muted,true);
    text(c,display(data.entry?.calories_estimate),571,1504,50,K.coral,true);
    text(c,'KCAL',864,1504,20,K.muted,true);

    // Actual previously logged days as-of the selected date.
    text(c,'THE DAYS BEFORE',70,1634,31,K.white,true);
    text(c,'RECORDED, NEVER ESTIMATED',1015,1632,19,K.muted,true,'right');
    const recentX=[70,312,554,796];
    for(let i=0;i<4;i++){
      const x=recentX[i],d=data.past[i];
      panel(c,x,1660,218,138,
        d?'rgba(51,94,144,.35)':'rgba(255,255,255,.035)',
        d?'rgba(160,203,247,.24)':'rgba(160,203,247,.09)',22);
      if(!d)continue;
      text(c,short(d.date).toUpperCase(),x+17,1696,21,d.goal?K.gold:K.white,true);
      if(d.goal)flame(c,x+178,1672,27,false);
      text(c,compact(d.steps)+' STEPS',x+17,1738,27,K.mint,true);
      text(c,compact(d.kcal)+' KCAL',x+17,1773,22,K.coral);
    }
    if(!data.past.length)text(c,'Your first saved day is where it all begins.',82,1741,27,K.muted);

    text(c,'PROGRESS, NOT PERFECTION.',70,1868,25,K.white,true);
    text(c,'fitness.oalfawzan.sa',1012,1868,23,K.muted,false,'right');
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