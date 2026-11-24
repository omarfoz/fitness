/* Private monthly image in two formats: a 9:16 story (2160 × 3840) with the
 * month card centred on a quiet background, or the card alone (2160 wide,
 * transparent corners).
 * Any past day can be selected. Steps and estimated calories are only shown
 * when recorded, with no invented zeroes. All drawing happens locally.
 *
 */
(() => {
  'use strict';
  const GOAL=10000;
  const $=id=>document.getElementById(id);
  let mode='story',getState=null,blob=null,previewURL=null,currentDate=null,busy=false,serial=0,queued=false;
  const K={ink:'#F5F2EE',mist:'#B9B1AA',dim:'#6B6460',glass:'#FFCBA0',
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
  function compute(entries,selected){
    if(!(entries instanceof Map))entries=new Map();
    const at=parse(selected);
    if(!at||selected>key(new Date()))throw new Error('Choose a valid date up to today.');
    const archived=false,day=null;
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

  /* ---------- composition ---------- */
  // One month card, used two ways: centred on a quiet 9:16 story
  // background, or exported alone with transparent corners.
  const CARD_W=920;
  // Rendered at 2× so the saved photo stays sharp when zoomed. 2160 × 3840
  // stays under the iOS Safari canvas area limit (16.7 MP).
  const SCALE=2;
  function cardHeight(w,weeks){return (w/CARD_W)*(408+weeks*108);}
  function steps(v){
    if(v==null||!Number.isFinite(Number(v)))return null;
    if(v>=10000)return Math.round(v/1000)+'k';
    if(v>=1000)return (v/1000).toFixed(1).replace(/\.0$/,'')+'k';
    return String(Math.round(v));
  }
  function check(c,cx,cy,size,color){
    c.save();c.lineWidth=size*.16;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;
    c.beginPath();c.moveTo(cx-size*.32,cy+size*.02);c.lineTo(cx-size*.08,cy+size*.26);
    c.lineTo(cx+size*.34,cy-size*.22);c.stroke();c.restore();
  }
  function drawCard(c,data,X,Y,w,shadow=true){
    const s=w/CARD_W,h=cardHeight(w,data.weeks);
    c.save();c.translate(X,Y);c.scale(s,s);
    const W=CARD_W,H=h/s,P=56;

    // Navy liquid-glass card.
    c.save();if(shadow){c.shadowColor='rgba(0,6,24,.6)';c.shadowBlur=70;c.shadowOffsetY=26;}
    rr(c,0,0,W,H,52);
    const g=c.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#24211F');g.addColorStop(1,'#141317');
    c.fillStyle=g;c.fill();c.restore();
    c.save();rr(c,0,0,W,H,52);c.lineWidth=2;c.strokeStyle='rgba(255,178,122,.22)';c.stroke();
    const rim=c.createLinearGradient(0,0,W,0);
    rim.addColorStop(0,'rgba(255,255,255,0)');rim.addColorStop(.3,'rgba(255,226,204,.6)');
    rim.addColorStop(.7,'rgba(255,226,204,.25)');rim.addColorStop(1,'rgba(255,255,255,0)');
    c.beginPath();c.moveTo(52,1.5);c.lineTo(W-52,1.5);c.lineWidth=3;c.strokeStyle=rim;c.stroke();
    c.restore();

    // Month + brand mark.
    text(c,data.monthLabel,P,112,54,K.ink,600);
    shoe(c,W-P-54,64,54,K.glass);

    // Three quiet stats along the top of the card.
    const n=data.streak.current;
    const stats=[
      ['10K streak',n+(n===1?' day':' days')],
      ['10K days',data.goalDays+' / '+data.elapsed],
      ['Best streak',data.streak.best+(data.streak.best===1?' day':' days')]
    ];
    stats.forEach(([label,value],i)=>{
      const x=P+i*262;
      text(c,label,x,186,27,K.mist,500);
      text(c,value,x-2,254,68,i===0&&n>0?'#FFB27A':K.ink,900,DISPLAY);
    });

    // Calendar grid with a weekly column on the right.
    const right=104,gridW=W-P*2-right-16,pitch=gridW/7,y0=354,R=41;
    ['M','T','W','T','F','S','S'].forEach((d,i)=>
      text(c,d,P+pitch*(i+.5),326,28,K.mist,600,BODY,'center'));
    const pos=d=>{const i=data.offset+d.day-1;
      return {cx:P+pitch*(i%7+.5),cy:y0+Math.floor(i/7)*108+54,row:Math.floor(i/7)};};

    for(const d of data.monthDays){
      const {cx,cy}=pos(d),logged=Boolean(d.entry);
      if(d.future){text(c,String(d.day),cx,cy+11,30,K.dim,500,BODY,'center');continue;}
      if(d.selected){
        c.save();c.shadowColor='rgba(255,203,160,.8)';c.shadowBlur=18;
        c.beginPath();c.arc(cx,cy,R+8,0,Math.PI*2);c.lineWidth=4;c.strokeStyle=K.glass;c.stroke();c.restore();
      }
      c.beginPath();c.arc(cx,cy,R,0,Math.PI*2);
      if(d.goal){
        const f=c.createLinearGradient(cx,cy-R,cx,cy+R);
        f.addColorStop(0,'#E0592A');f.addColorStop(1,K.emberDeep);
        c.save();c.shadowColor='rgba(255,104,44,.45)';c.shadowBlur=20;c.fillStyle=f;c.fill();c.restore();
        flame(c,cx-24,cy-27,48);
      }else if(logged){
        c.fillStyle='rgba(255,203,160,.12)';c.fill();
        c.lineWidth=2;c.strokeStyle='rgba(255,203,160,.40)';c.stroke();
        shoe(c,cx-21,cy-23,42,K.glass);
      }else{
        c.lineWidth=2;c.strokeStyle='rgba(169,188,216,.22)';c.stroke();
        text(c,String(d.day),cx,cy+11,30,K.mist,500,BODY,'center');
      }
      const label=logged?steps(d.steps):null;
      if(label){
        font(c,22,700);const bw=Math.max(38,c.measureText(label).width+18),bx=cx+R*.62,by=cy-R*.8;
        rr(c,bx-bw/2,by-18,bw,36,18);c.fillStyle='#141317';c.fill();
        c.lineWidth=2;c.strokeStyle=d.goal?'#FF9A5C':'rgba(255,203,160,.5)';c.stroke();
        text(c,label,bx,by+8,22,K.ink,700,BODY,'center');
      }
    }

    // Weekly column: a check for every finished week with a 10K day; the
    // selected week carries the current streak inside a flame.
    const colX=W-P-right/2;
    rr(c,colX-46,y0+4,92,data.weeks*108-8,46);
    const col=c.createLinearGradient(0,y0,0,y0+data.weeks*108);
    col.addColorStop(0,'rgba(255,128,64,.24)');col.addColorStop(1,'rgba(255,128,64,.08)');
    c.fillStyle=col;c.fill();
    const selRow=pos(data.monthDays.find(d=>d.selected)).row;
    for(let r=0;r<data.weeks;r++){
      const cy=y0+r*108+54;
      const week=data.monthDays.filter(d=>pos(d).row===r);
      if(r===selRow&&n>0){
        flame(c,colX-50,cy-62,100,true);
        text(c,String(n),colX,cy+30,n>99?36:42,'#5A1A06',900,DISPLAY,'center');
        continue;
      }
      if(week.every(d=>d.future))continue;
      c.beginPath();c.arc(colX,cy,25,0,Math.PI*2);
      if(week.some(d=>d.goal)){c.fillStyle=K.ember;c.fill();check(c,colX,cy,26,K.cream);}
      else{c.lineWidth=2;c.strokeStyle='rgba(169,188,216,.3)';c.stroke();}
    }
    c.restore();
    return h;
  }
  function drawStory(data){
    const W=1080,H=1920;
    const canvas=document.createElement('canvas');canvas.width=W*SCALE;canvas.height=H*SCALE;
    const c=canvas.getContext('2d',{alpha:false});
    if(!c)throw new Error('Could not render the story on this device.');
    c.scale(SCALE,SCALE);
    const bg=c.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1C1512');bg.addColorStop(.55,'#121114');bg.addColorStop(1,'#0E0F12');
    c.fillStyle=bg;c.fillRect(0,0,W,H);
    // One ember ring behind the card. It is a full circle, so its ends are
    // always hidden by the canvas edges or the card and never look cut off.
    c.save();
    const arc=c.createLinearGradient(400,0,1080,1100);
    arc.addColorStop(0,'#E0592A');arc.addColorStop(.6,K.ember);arc.addColorStop(1,K.emberDeep);
    c.globalAlpha=.9;c.beginPath();c.arc(860,520,560,0,Math.PI*2);
    c.lineWidth=140;c.strokeStyle=arc;c.stroke();c.restore();
    const cool=c.createRadialGradient(160,1700,10,160,1700,700);
    cool.addColorStop(0,'rgba(255,90,31,.10)');cool.addColorStop(1,'rgba(255,90,31,0)');
    c.fillStyle=cool;c.fillRect(0,1000,W,920);

    const w=CARD_W,h=cardHeight(w,data.weeks),x=(W-w)/2,y=Math.round((H-h)/2-50);
    drawCard(c,data,x,y,w);
    // Brand under the card.
    const by=y+h+120;
    font(c,46,600);const tw=c.measureText('Fitness').width,total=58+14+tw;
    shoe(c,W/2-total/2,by-46,58,K.ink);
    text(c,'Fitness',W/2-total/2+72,by,46,K.ink,600);
    text(c,'fitness.oalfawzan.sa',W/2,H-80,28,K.mist,500,BODY,'center');
    return canvas;
  }
  function drawCardOnly(data){
    const w=1080,h=Math.ceil(cardHeight(w,data.weeks)),pad=0;
    const canvas=document.createElement('canvas');canvas.width=(w+pad*2)*SCALE;canvas.height=(h+pad*2)*SCALE;
    const c=canvas.getContext('2d');
    if(!c)throw new Error('Could not render the card on this device.');
    c.scale(SCALE,SCALE);
    drawCard(c,data,pad,pad,w,false);
    return canvas;
  }
  function draw(data,mode){return mode==='card'?drawCardOnly(data):drawStory(data);}
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
      const info=compute(state.entries||new Map(),selected),canvas=draw(info,mode);
      const image=await new Promise((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('Image export failed.')),'image/png'));
      if(request!==serial)return;
      if(previewURL)URL.revokeObjectURL(previewURL);
      currentDate=selected;
      blob=image;previewURL=URL.createObjectURL(image);
      const img=$('storyPreviewImage');
      img.width=canvas.width;img.height=canvas.height;img.src=previewURL;
      $('storyPreviewCaption').textContent=dateText(info.date)+': '+
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
    input.min=dates[0]||key(new Date());input.max=key(new Date());
    const request=new URLSearchParams(window.location.search).get('story');
    const date=parse(request)&&request<=input.max&&request>=input.min?request:key(new Date());
    input.value=date;
    if(!dlg.open)dlg.showModal();
    try{await prepare()}catch(e){status(e.message||'Could not create a story.','error');}
  }
  function filename(){return 'fitness-'+mode+'-'+(currentDate||key(new Date()))+'.png';}
  // iPhone/iPad Safari turns <a download> into a file preview instead of
  // saving to Photos. There, the share sheet's "Save Image" is the way in.
  const touchApple=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function download(){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename();document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    status('Image saved to your downloads.','success');
  }
  async function save(){
    if(!blob){status('Select a day and wait for the image.','error');return;}
    const file=new File([blob],filename(),{type:'image/png'});
    if(touchApple()&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      try{
        await navigator.share({files:[file]});
        status('Choose "Save Image" to add it to Photos.','success');
      }catch(e){
        if(e.name!=='AbortError')status('Press and hold the preview, then tap "Save to Photos".','error');
      }
      return;
    }
    download();
  }
  async function share(){
    if(!blob){status('Select a day and wait for the image.','error');return;}
    const file=new File([blob],filename(),{type:'image/png'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      try{
        await navigator.share({files:[file]});
        status('Sharing opened. Choose Snapchat or your photo app.','success');
      }catch(e){if(e.name!=='AbortError')status('Sharing was unavailable. Tap Save image.','error');}
    }else download();
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
    document.querySelectorAll('[data-story-format]').forEach(btn=>btn.addEventListener('click',()=>{
      if(mode===btn.dataset.storyFormat)return;
      mode=btn.dataset.storyFormat;
      document.querySelectorAll('[data-story-format]').forEach(b=>
        b.setAttribute('aria-checked',String(b===btn)));
      if($('storyDialog')?.open)prepare().catch(e=>status(e.message||'Could not update the image.','error'));
    }));
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
