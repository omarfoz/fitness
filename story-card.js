/* Private 1080 × 1920 Snapchat-ready story.
 * Any past day can be selected. Steps and estimated calories are only shown
 * when recorded, with no invented zeroes. All drawing happens locally.
 *
 * Composition: a sentence headline, then one liquid-glass month sheet in
 * which consecutive 10K days fuse into a continuous ember "streak bar".
 */
(() => {
  'use strict';
  const START='2026-11-15',GOAL=10000;
  const $=id=>document.getElementById(id);
  let getState=null,blob=null,previewURL=null,currentDate=null,busy=false,serial=0,queued=false;
  const K={ink:'#F4F7FF',mist:'#A9BCD8',dim:'#56688A',glass:'#8DC8FF',
    mint:'#90E8C7',coral:'#FFBAAE',
    emberDeep:'#7A2610',ember:'#C4461C',cream:'#FFF3E1',peach:'#FFD7C6',flameDay:'#FFD3A1'};
  // Story-only typefaces, registered under private names so the app UI's
  // own font stack is untouched. System fonts are the offline fallback.
  const DISPLAY='"Story Display","Arial Narrow","Helvetica Neue",Arial,sans-serif';
  const BODY='"Story Body",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
  const FONT_CSS='https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900'+
    '&family=DM+Sans:wght@400;500;600&display=swap';
  let fontsPromise=null;
  function ready(){
    if(fontsPromise)return fontsPromise;
    const load=(async()=>{
      if(!window.FontFace||!document.fonts)return;
      const css=await (await fetch(FONT_CSS)).text();
      const faces=[];
      for(const block of css.split('@font-face').slice(1)){
        // Latin subset only: every glyph the story draws lives there.
        if(/unicode-range/i.test(block)&&!/U\+0000-00FF/i.test(block))continue;
        const fam=/font-family:\s*'([^']+)'/.exec(block)?.[1];
        const weight=/font-weight:\s*(\d+)/.exec(block)?.[1]||'400';
        const url=/src:\s*url\(([^)]+)\)/.exec(block)?.[1];
        if(!fam||!url)continue;
        const alias=fam==='DM Sans'?'Story Body':'Story Display';
        const face=new FontFace(alias,'url('+url+')',{weight});
        document.fonts.add(face);faces.push(face.load());
      }
      await Promise.all(faces);
    })().catch(()=>{});
    // Never hold the story hostage to a slow network.
    fontsPromise=Promise.race([load,new Promise(r=>setTimeout(r,2500))]);
    return fontsPromise;
  }
  const number=v=>Number(v).toLocaleString('en-US');
  function key(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function parse(k){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k||''))return null;
    const [y,m,d]=k.split('-').map(Number);
    const val=new Date(y,m-1,d,12);
    return val.getFullYear()===y&&val.getMonth()===m-1&&val.getDate()===d?val:null;
  }
  function dateText(k){return parse(k).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}
  function short(k){return parse(k).toLocaleDateString('en-GB',{day:'numeric',month:'short'});}
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
    // A day before the 1st (from the previous month) feeds the bar on day 1.
    const prev=new Date(at.getFullYear(),at.getMonth(),0,12);
    const prevGoal=Number(entries.get(key(prev))?.steps)>=GOAL;
    return {date:selected,archived,day,entry:entries.get(selected)||null,
      monthLabel:at.toLocaleDateString('en-US',{month:'long',year:'numeric'}),
      monthName:at.toLocaleDateString('en-US',{month:'long'}),
      elapsed:at.getDate(),prevGoal,
      offset,weeks,daysInMonth,monthDays,monthEntries,goalDays,past,streak};
  }

  /* ---------- drawing primitives ---------- */
  function rr(ctx,x,y,w,h,r=24){
    const q=Array.isArray(r)?r:[r,r,r,r];
    const [tl,tr,br,bl]=q.map(v=>Math.min(v,w/2,h/2));
    ctx.beginPath();ctx.moveTo(x+tl,y);ctx.lineTo(x+w-tr,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+tr);ctx.lineTo(x+w,y+h-br);
    ctx.quadraticCurveTo(x+w,y+h,x+w-br,y+h);ctx.lineTo(x+bl,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-bl);ctx.lineTo(x,y+tl);
    ctx.quadraticCurveTo(x,y,x+tl,y);ctx.closePath();
  }
  function font(c,size,weight=500,fam=BODY){c.font=weight+' '+size+'px '+fam;}
  function text(c,s,x,y,size,color,weight=500,fam=BODY,align='left'){
    font(c,size,weight,fam);c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y);
    return c.measureText(s).width;
  }
  function fit(c,s,maxW,size,weight,fam){
    font(c,size,weight,fam);
    while(size>40&&c.measureText(s).width>maxW){size-=4;font(c,size,weight,fam);}
    return size;
  }
  function wrap(c,s,maxW,size,weight=500,fam=BODY){
    font(c,size,weight,fam);
    const lines=[];let line='';
    for(const word of s.split(' ')){
      const next=line?line+' '+word:word;
      if(line&&c.measureText(next).width>maxW){lines.push(line);line=word;}
      else line=next;
    }
    if(line)lines.push(line);
    return lines;
  }
  function display(value){return value==null||!Number.isFinite(Number(value))?'—':number(value);}
  function compact(v){
    if(v==null||!Number.isFinite(Number(v)))return '—';
    if(v>=1000)return (v/1000).toFixed(1).replace(/\.0$/,'')+'k';
    return String(Math.round(v));
  }
  function flame(c,x,y,size=32,glow=false){
    // Hand-drawn vector flame, not an emoji, font glyph or external image.
    c.save();c.translate(x,y);c.scale(size/100,size/100);
    if(glow){c.shadowColor='rgba(255,121,53,.9)';c.shadowBlur=34;}
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
    // A tiny original line-art running shoe: the Fitness brand mark.
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

  /* ---------- copy ---------- */
  function headline(d){
    const n=d.streak.current;
    if(n>=2)return n+' days in a row';
    if(n===1)return '1-day streak';
    if(d.goalDays)return d.goalDays+(d.goalDays===1?' day':' days')+' at 10K';
    if(d.monthEntries.length)return d.monthEntries.length+
      (d.monthEntries.length===1?' day logged':' days logged');
    return 'No days logged yet';
  }
  function facts(d){
    const days=v=>v+(v===1?' day':' days');
    const parts=[];
    if(d.streak.current>=1)parts.push('10,000 steps or more each day.');
    parts.push(d.goalDays+' of '+d.elapsed+' days in '+d.monthName+' reached 10K.');
    if(d.streak.best)parts.push('Longest streak: '+days(d.streak.best)+'.');
    return parts.join(' ');
  }

  /* ---------- composition ---------- */
  function draw(data){
    const W=1080,H=1920,M=64;
    const canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;
    const c=canvas.getContext('2d',{alpha:false});
    if(!c)throw new Error('Could not render the story on this device.');

    // Night-navy ground with one cool and one warm light source.
    const bg=c.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#0E2147');bg.addColorStop(.55,'#0A1A3B');bg.addColorStop(1,'#071330');
    c.fillStyle=bg;c.fillRect(0,0,W,H);
    const cool=c.createRadialGradient(980,180,10,980,180,760);
    cool.addColorStop(0,'rgba(64,150,255,.30)');cool.addColorStop(1,'rgba(64,150,255,0)');
    c.fillStyle=cool;c.fillRect(0,0,W,1100);
    const warm=c.createRadialGradient(120,1180,10,120,1180,700);
    warm.addColorStop(0,'rgba(232,96,48,.16)');warm.addColorStop(1,'rgba(232,96,48,0)');
    c.fillStyle=warm;c.fillRect(0,520,W,1300);

    // Brand row.
    shoe(c,M,110,48,K.glass);
    text(c,'Fitness',M+64,148,36,K.ink,600);
    text(c,data.monthLabel,W-M,148,34,K.mist,500,BODY,'right');

    // Headline: the streak said as a sentence, not a stat card.
    const head=headline(data);
    const hs=fit(c,head,W-M*2,168,900,DISPLAY);
    text(c,head,M-4,330,hs,K.ink,900,DISPLAY);
    const lines=wrap(c,facts(data),W-M*2-40,38,500).slice(0,2);
    lines.forEach((l,i)=>text(c,l,M,402+i*52,38,K.mist,500));

    // Liquid-glass month sheet.
    const sx=40,sw=W-80,sy=lines.length>1?500:450;
    const pad=26,gap=10,cols=7;
    const tw=(sw-pad*2-gap*(cols-1))/cols;
    const gy=sy+92;
    const gridH=Math.min(1318-gy,data.weeks*150+(data.weeks-1)*gap);
    const th=Math.min(150,(gridH-gap*(data.weeks-1))/data.weeks);
    const sh=(gy-sy)+data.weeks*th+(data.weeks-1)*gap+pad;
    c.save();
    c.shadowColor='rgba(0,8,30,.55)';c.shadowBlur=60;c.shadowOffsetY=24;
    rr(c,sx,sy,sw,sh,46);
    const glass=c.createLinearGradient(0,sy,0,sy+sh);
    glass.addColorStop(0,'rgba(150,200,255,.13)');glass.addColorStop(1,'rgba(120,170,240,.05)');
    c.fillStyle=glass;c.fill();c.restore();
    c.save();rr(c,sx,sy,sw,sh,46);c.lineWidth=2;c.strokeStyle='rgba(170,212,255,.24)';c.stroke();
    // Specular rim along the top edge, the liquid-glass signature.
    const rim=c.createLinearGradient(sx,0,sx+sw,0);
    rim.addColorStop(0,'rgba(255,255,255,0)');rim.addColorStop(.3,'rgba(220,240,255,.75)');
    rim.addColorStop(.7,'rgba(220,240,255,.35)');rim.addColorStop(1,'rgba(255,255,255,0)');
    c.beginPath();c.moveTo(sx+46,sy+1.5);c.lineTo(sx+sw-46,sy+1.5);
    c.lineWidth=3;c.strokeStyle=rim;c.stroke();c.restore();

    const colX=i=>sx+pad+i*(tw+gap);
    const rowY=r=>gy+r*(th+gap);
    ['M','T','W','T','F','S','S'].forEach((d,i)=>
      text(c,d,colX(i)+16,sy+66,30,K.mist,800,DISPLAY));

    const cell=d=>{const i=data.offset+d.day-1;return {col:i%7,row:Math.floor(i/7)};};

    // Streak bars: consecutive 10K days fuse into one ember bar per week row.
    // A bar that runs on into the next week keeps a square edge to say so.
    const days=data.monthDays;
    for(let i=0;i<days.length;i++){
      if(!days[i].goal||(i>0&&days[i-1].goal&&cell(days[i]).col!==0))continue;
      let j=i;
      while(j+1<days.length&&days[j+1].goal&&cell(days[j+1]).col!==0)j++;
      const a=cell(days[i]),b=cell(days[j]);
      const fromBefore=a.col===0&&(i>0?days[i-1].goal:data.prevGoal);
      const intoAfter=b.col===6&&j+1<days.length&&days[j+1].goal;
      const x=colX(a.col),y=rowY(a.row),w=colX(b.col)+tw-x;
      const R=26,r=[fromBefore?6:R,intoAfter?6:R,intoAfter?6:R,fromBefore?6:R];
      c.save();
      c.shadowColor='rgba(255,104,44,.42)';c.shadowBlur=28;
      rr(c,x,y,w,th,r);
      const fire=c.createLinearGradient(0,y,0,y+th);
      fire.addColorStop(0,K.ember);fire.addColorStop(1,K.emberDeep);
      c.fillStyle=fire;c.fill();c.restore();
      c.save();rr(c,x,y,w,th,r);c.clip();
      c.fillStyle='rgba(255,214,170,.32)';c.fillRect(x,y,w,2);
      // Faint seams keep each day readable inside one continuous bar.
      c.fillStyle='rgba(40,8,0,.22)';
      for(let k=a.col+1;k<=b.col;k++)c.fillRect(colX(k)-gap/2-1,y+18,2,th-36);
      c.restore();
    }

    for(const d of days){
      const {col,row}=cell(d);
      const x=colX(col),y=rowY(row),w=tw,h=th;
      const logged=Boolean(d.entry);
      if(!d.goal){
        if(logged){rr(c,x,y,w,h,24);c.fillStyle='rgba(141,200,255,.12)';c.fill();}
        else if(!d.future){
          rr(c,x+1,y+1,w-2,h-2,24);c.lineWidth=2;c.strokeStyle='rgba(169,188,216,.12)';c.stroke();
        }
      }
      if(d.selected){
        c.save();c.shadowColor='rgba(141,200,255,.85)';c.shadowBlur=22;
        rr(c,x-6,y-6,w+12,h+12,30);c.lineWidth=4;c.strokeStyle=K.glass;c.stroke();c.restore();
      }
      const dayColor=d.future?K.dim:d.goal?K.flameDay:K.ink;
      text(c,String(d.day),x+14,y+38,34,dayColor,800,DISPLAY);
      if(d.goal)flame(c,x+w-42,y+10,32,d.selected);
      if(logged){
        // Abbreviated to fit the tile; the selected-day numbers below are exact.
        const big=h>=120;
        text(c,compact(d.steps),x+14,y+h-(big?40:34),big?40:34,d.goal?K.cream:K.mint,800,DISPLAY);
        text(c,compact(d.kcal)+' kcal',x+14,y+h-(big?14:11),big?21:19,d.goal?K.peach:K.coral,500);
      }
    }

    // Selected day: exact recorded numbers.
    let y=sy+sh+86;
    const when=parse(data.date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    text(c,when,M,y,40,K.ink,600);
    if(!data.archived)text(c,'Challenge day '+data.day+(data.day<=30?' of 30':''),W-M,y,34,K.glass,500,BODY,'right');
    y+=146;
    // A missing value says so in words; it is never drawn as a zero.
    const figure=(v,unit,x,color)=>{
      if(v==null||!Number.isFinite(Number(v))){text(c,'No '+unit+' logged',x,y-12,40,K.mist,500);return;}
      const w=text(c,number(v),x-3,y,150,color,900,DISPLAY);
      text(c,unit,x+w+14,y,36,K.mist,500);
    };
    if(data.entry){
      figure(data.entry.steps,'steps',M,K.mint);
      figure(data.entry.calories_estimate,'kcal',W/2+40,K.coral);
    }else text(c,'Nothing logged on this day.',M,y-12,44,K.mist,500);

    // Earlier logged days in this month, as of the selected date.
    y+=82;
    if(data.past.length||data.entry){c.fillStyle='rgba(169,188,216,.22)';c.fillRect(M,y-46,W-M*2,2);}
    if(data.past.length){
      const colW=(W-M*2)/4;
      data.past.forEach((d,i)=>{
        const x=M+i*colW;
        const dw=text(c,short(d.date),x,y,28,K.mist,500);
        if(d.goal)flame(c,x+dw+10,y-26,28);
        text(c,compact(d.steps),x,y+56,52,K.mint,800,DISPLAY);
        text(c,compact(d.kcal)+' kcal',x,y+92,26,K.coral,500);
      });
    }else if(data.entry){
      text(c,'The first logged day of '+data.monthName+'.',M,y+20,32,K.mist,500);
    }

    text(c,'fitness.oalfawzan.sa',M,H-62,28,K.mist,500);
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
      await ready();
      const info=compute(state.entries||new Map(),selected),canvas=draw(info);
      const image=await new Promise((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('Image export failed.')),'image/png'));
      if(request!==serial)return;
      if(previewURL)URL.revokeObjectURL(previewURL);
      currentDate=selected;
      blob=image;previewURL=URL.createObjectURL(image);
      $('storyPreviewImage').src=previewURL;
      const label=info.archived?'Before the challenge':('Challenge day '+info.day);
      $('storyPreviewCaption').textContent=label+', '+dateText(info.date)+': '+
        display(info.entry?.steps)+' steps, '+display(info.entry?.calories_estimate)+' kcal';
      status('Image ready. Share it or save it to your photos.','success');
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
    ready();
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
