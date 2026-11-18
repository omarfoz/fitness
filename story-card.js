/* Shareable 1080 × 1920 fitness progress story. Drawn locally from
   authenticated tracker entries. No data is uploaded or embedded in URLs. */
(() => {
  'use strict';
  const START='2026-11-15',DAYS=30,GOAL=10000;
  const $=id=>document.getElementById(id);
  let getState=null,blob=null,previewURL=null,rendering=false;
  const C={bg:'#0D1730',navy:'#162C51',white:'#F8FBFF',muted:'#B6C8E4',blue:'#75B8FF',
    mint:'#8CE7C5',peach:'#FFB9AB',gold:'#FFD797',stroke:'rgba(194,219,255,.22)'};
  function ymd(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
  function localDate(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d,12)}
  function dateAdd(key,n){const d=localDate(key);d.setDate(d.getDate()+n);return ymd(d)}
  function daysBetween(first,second){return Math.round((localDate(second)-localDate(first))/86400000)}
  function fmt(key){return localDate(key).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
  function number(value){return Number(value).toLocaleString('en-US')}
  function round(ctx,x,y,w,h,r=20){
    const z=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+z,y);ctx.lineTo(x+w-z,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+z);ctx.lineTo(x+w,y+h-z);
    ctx.quadraticCurveTo(x+w,y+h,x+w-z,y+h);ctx.lineTo(x+z,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-z);ctx.lineTo(x,y+z);
    ctx.quadraticCurveTo(x,y,x+z,y);ctx.closePath();
  }
  function panel(ctx,x,y,w,h,{fill='rgba(255,255,255,.065)',border='rgba(201,222,255,.19)',r=32}={}){
    ctx.save();round(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=2;
    ctx.strokeStyle=border;ctx.stroke();ctx.restore();
  }
  function label(ctx,text,x,y,font,color=C.white,align='left'){
    ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;
    ctx.fillText(text,x,y);
  }
  function compute(entries,today){
    const day=Math.max(1,daysBetween(START,today)+1);
    const capped=Math.min(DAYS,day);
    const slots=Array.from({length:DAYS},(_,i)=>{
      const date=dateAdd(START,i);
      const value=entries.get(date);
      return {date,day:i+1,logged:date<=today&&Boolean(value),today:date===today,
        steps:typeof value?.steps==='number'?value.steps:null,
        calories:typeof value?.calories_estimate==='number'?value.calories_estimate:null};
    });
    const before=slots.filter(x=>x.date<today && x.logged).reverse();
    const logged=slots.filter(x=>x.logged && x.date<=today);
    const walked=logged.reduce((sum,x)=>sum+(x.steps??0),0);
    const stepped=logged.filter(x=>x.steps!=null);
    const best=stepped.length?Math.max(...stepped.map(x=>x.steps)):null;
    let streak=0;
    for(let i=capped-1;i>=0;i--){
      if(slots[i].logged)streak++;
      else if(i!==capped-1)break;
    }
    return {day,capped,slots,before,logged:logged.length,walked,best,streak,todayEntry:entries.get(today)||null};
  }
  function renderToCanvas(data,now){
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('This browser cannot create the story image.');
    const main=ctx.createLinearGradient(0,0,1080,1920);
    main.addColorStop(0,'#142B52');main.addColorStop(.55,'#111D39');main.addColorStop(1,'#09152D');
    ctx.fillStyle=main;ctx.fillRect(0,0,1080,1920);
    ctx.save();
    const glow=ctx.createRadialGradient(920,220,35,920,220,650);
    glow.addColorStop(0,'rgba(49,139,249,.33)');glow.addColorStop(1,'rgba(49,139,249,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,1080,930);
    const pink=ctx.createRadialGradient(90,1420,15,90,1420,500);
    pink.addColorStop(0,'rgba(211,110,219,.12)');pink.addColorStop(1,'rgba(211,110,219,0)');
    ctx.fillStyle=pink;ctx.fillRect(0,950,700,920);ctx.restore();
    // Decorative framing, no image resources or external fonts needed.
    ctx.strokeStyle='rgba(160,206,255,.12)';ctx.lineWidth=2;
    round(ctx,45,53,990,1809,52);ctx.stroke();
    panel(ctx,87,106,906,138,{fill:'rgba(255,255,255,.045)',r:29});
    round(ctx,122,140,72,72,18);ctx.fillStyle='#2D7AD7';ctx.fill();
    ctx.strokeStyle='#EAF5FF';ctx.lineWidth=6;ctx.beginPath();
    ctx.moveTo(134,179);ctx.lineTo(147,179);ctx.lineTo(157,161);
    ctx.lineTo(170,195);ctx.lineTo(180,177);ctx.lineTo(191,177);ctx.stroke();
    label(ctx,'FITNESS',220,180,'bold 39px -apple-system, Arial',C.white);
    label(ctx,'A journey worth celebrating',220,213,'22px -apple-system, Arial',C.muted);
    label(ctx,'30-DAY CHALLENGE',88,346,'bold 31px -apple-system, Arial',C.blue);
    label(ctx,'YOUR PROGRESS',88,406,'bold 60px -apple-system, Arial',C.white);
    label(ctx,localDate(now).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'}),92,459,
      '28px -apple-system, Arial',C.muted);
    panel(ctx,86,502,908,364,{fill:'rgba(21,54,98,.78)',border:'rgba(120,183,255,.38)',r:40});
    label(ctx,'DAY',137,600,'bold 32px -apple-system, Arial',C.blue);
    label(ctx,number(data.day).padStart(2,'0'),131,757,'bold 166px -apple-system, Arial',C.white);
    label(ctx,data.day>DAYS?'BEYOND THE CHALLENGE':'OF '+DAYS+' DAYS',458,710,'bold 34px -apple-system, Arial',C.muted);
    label(ctx,data.day>DAYS?'Keep moving forward':'Every day counts',458,765,'28px -apple-system, Arial',C.mint);
    // Segmented progress bar.
    const progress=Math.min(1,data.capped/DAYS);
    panel(ctx,133,809,813,14,{fill:'rgba(224,238,255,.20)',border:'rgba(224,238,255,.0)',r:7});
    if(progress>0){round(ctx,133,809,813*progress,14,7);ctx.fillStyle=C.blue;ctx.fill();}
    label(ctx,'THE JOURNEY SO FAR',90,958,'bold 31px -apple-system, Arial',C.white);
    panel(ctx,86,996,282,199,{fill:'rgba(122,197,252,.10)',r:30});
    panel(ctx,396,996,282,199,{fill:'rgba(132,226,191,.09)',r:30});
    panel(ctx,705,996,289,199,{fill:'rgba(254,205,149,.085)',r:30});
    label(ctx,number(data.logged),119,1089,'bold 68px -apple-system, Arial',C.blue);
    label(ctx,'DAYS LOGGED',119,1147,'bold 23px -apple-system, Arial',C.muted);
    label(ctx,number(data.walked),427,1089,'bold 56px -apple-system, Arial',C.mint);
    label(ctx,'STEPS LOGGED',427,1147,'bold 23px -apple-system, Arial',C.muted);
    label(ctx,data.best==null?'—':number(data.best),731,1089,'bold 56px -apple-system, Arial',C.gold);
    label(ctx,'BEST STEP DAY',731,1147,'bold 23px -apple-system, Arial',C.muted);
    label(ctx,'MY 30 DAYS',90,1274,'bold 31px -apple-system, Arial',C.white);
    label(ctx,'Filled tiles = logged days',991,1274,'22px -apple-system, Arial',C.muted,'right');
    const cw=81,gap=9,startX=90,startY=1314;
    for(const item of data.slots){
      const col=(item.day-1)%10,row=Math.floor((item.day-1)/10);
      const x=startX+col*(cw+gap),y=startY+row*93;
      round(ctx,x,y,cw,77,17);
      ctx.fillStyle=item.logged?'#246E74':item.today?'rgba(91,160,250,.16)':'rgba(211,224,249,.075)';
      ctx.fill();
      ctx.strokeStyle=item.today?C.blue:item.logged?'rgba(143,235,202,.6)':'rgba(202,222,247,.12)';
      ctx.lineWidth=item.today?4:2;ctx.stroke();
      label(ctx,String(item.day).padStart(2,'0'),x+cw/2,y+49,'bold 29px -apple-system, Arial',
        item.logged?C.mint:item.today?C.blue:'#8090AD','center');
      if(item.logged){
        ctx.beginPath();ctx.arc(x+cw-12,y+13,4,0,Math.PI*2);ctx.fillStyle=C.mint;ctx.fill();
      }
    }
    panel(ctx,87,1631,906,158,{fill:'rgba(255,255,255,.046)',r:30});
    label(ctx,'PREVIOUS LOGGED DAYS',119,1683,'bold 25px -apple-system, Arial',C.blue);
    const previous=data.before.slice(0,4);
    if(previous.length){
      for(let i=0;i<previous.length;i++){
        const item=previous[i],x=122+(i%4)*225;
        label(ctx,fmt(item.date),x,1734,'bold 24px -apple-system, Arial',C.white);
        label(ctx,item.steps==null?'Logged':number(item.steps)+' steps',x,1763,
          '19px -apple-system, Arial',C.muted);
      }
    }else{
      label(ctx,'Your first check-in is the beginning.',120,1752,'25px -apple-system, Arial',C.muted);
    }
    label(ctx,'Progress, not perfection.',88,1851,'25px -apple-system, Arial',C.white);
    label(ctx,'fitness.oalfawzan.sa',992,1851,'22px -apple-system, Arial',C.muted,'right');
    return canvas;
  }
  function status(text,kind=''){
    const el=$('storyStatus');if(!el)return;
    el.textContent=text;el.className='story-status'+(kind?' is-'+kind:'');
  }
  async function prepare(){
    if(rendering)return;
    const state=getState?.();
    if(!state?.userId||state.readonly)throw new Error('Sign in to your own tracker to share a progress story.');
    rendering=true;
    try{
      const today=ymd(new Date()),computed=compute(state.entries||new Map(),today);
      const canvas=renderToCanvas(computed,today);
      const next=await new Promise((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('Could not prepare the story image.')),'image/png'));
      if(previewURL)URL.revokeObjectURL(previewURL);
      blob=next;previewURL=URL.createObjectURL(blob);
      $('storyPreviewImage').src=previewURL;
      const msg='Day '+computed.day+' · '+computed.logged+' logged days · '+
        number(computed.walked)+' steps recorded';
      $('storyPreviewCaption').textContent=msg;
      status('Ready for Snapchat, Instagram Stories or your photo library.','success');
    }finally{rendering=false}
  }
  async function open(){
    const dialog=$('storyDialog');
    if(!dialog||!getState)return;
    status('Preparing your progress card…');
    dialog.showModal();
    try{await prepare()}catch(error){status(error.message||'Could not generate the story.','error');}
  }
  function filename(){return 'fitness-progress-'+ymd(new Date())+'.png'}
  function save(){
    if(!blob){status('Prepare your story first.','error');return;}
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename();document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    status('Story image saved. Open Snapchat and select it from your photos/files.','success');
  }
  async function share(){
    if(!blob){status('Prepare your story first.','error');return;}
    const file=new File([blob],filename(),{type:'image/png'});
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      try{
        await navigator.share({files:[file]});
        status('Sharing opened. Choose Snapchat to post your story.','success');
      }catch(e){
        if(e.name!=='AbortError')status('Sharing could not start. Use Save image instead.','error');
      }
    }else save();
  }
  function mount(callback){
    if(getState)return;
    getState=callback;
    $('storyOpenBtn')?.addEventListener('click',open);
    $('storyCloseBtn')?.addEventListener('click',()=>$('storyDialog').close());
    $('storyDownloadBtn')?.addEventListener('click',save);
    $('storyShareBtn')?.addEventListener('click',share);
    $('storyDialog')?.addEventListener('close',()=>{
      // Preview URL revoked only on next render to avoid a black flash while closing.
    });
  }
  window.FitnessStory=Object.freeze({mount,compute});
})();