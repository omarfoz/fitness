/* Fitness Tracker · client-side CSV steps import.
 * No raw CSV is uploaded: rows are parsed locally and only one daily steps
 * total per day is written to the signed-in user's Supabase records.
 */
(() => {
  'use strict';
  const START = '2026-11-15';
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_ROWS = 50000;
  const MAX_DAYS = 500;
  const $ = (id) => document.getElementById(id);
  let context = null;
  let onSaved = null;
  let pending = null;
  let busy = false;
  let parseSerial = 0;

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'),
      String(date.getDate()).padStart(2,'0')].join('-');
  }
  function normalizedDate(value) {
    const input = String(value ?? '').trim();
    // Accept Apple Health / Shortcuts: 2026.11.15 02:32:00,
    // as well as 2026-11-15, 2026/11/15 and full ISO timestamps.
    const match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T].*)?$/.exec(input);
    if (!match) return null;
    const year=Number(match[1]), month=Number(match[2]), day=Number(match[3]);
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year,month-1,day));
    if (date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) return null;
    return [String(year).padStart(4,'0'),String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
  }
  function parseRows(source) {
    const text=String(source).replace(/^\uFEFF/,'');
    if (text.length > MAX_BYTES) throw new Error('CSV is too large. Use a file smaller than 5 MB.');
    const rows=[];let row=[],cell='',quoted=false,justClosed=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){
        if(c==='"' && text[i+1]==='"'){cell+='"';i++;}
        else if(c==='"'){quoted=false;justClosed=true;}
        else cell+=c;
      }else if(c==='"' && cell.trim()==='' && !justClosed){quoted=true;}
      else if(c===',' ){row.push(cell);cell='';justClosed=false;}
      else if(c==='\n' || c==='\r'){
        row.push(cell);
        if(row.some(x=>String(x).trim()!==''))rows.push(row);
        if(rows.length>MAX_ROWS+1)throw new Error('CSV has too many rows (maximum 50,000).');
        row=[];cell='';justClosed=false;
        if(c==='\r' && text[i+1]==='\n')i++;
      }else if(justClosed && c===' ') { /* ignore spaces immediately after a closing quote */ }
      else if(justClosed){ throw new Error('Unexpected character after a quoted CSV value.'); }
      else if(c==='"'){throw new Error('Invalid quote inside an unquoted CSV value.');}
      else cell+=c;
    }
    if(quoted)throw new Error('CSV contains an unclosed quoted value.');
    if(cell.length || row.length){row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);}
    return rows;
  }
  function parse(text) {
    const rows=parseRows(text);
    if(rows.length<2)throw new Error('CSV needs a header and at least one data row.');
    const normalize=(v)=>String(v).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
    const head=rows[0].map(normalize);
    const datePos=head.findIndex(x=>['date','datetime','timestamp','entrydate'].includes(x));
    const stepsPos=head.findIndex(x=>['steps','stepcount','step'].includes(x));
    if(datePos<0 || stepsPos<0)throw new Error('Use columns Date, Time, Steps or entry_date,steps.');
    const days=new Map();
    let readings=0;
    const today=dateKey(new Date());
    for(let i=1;i<rows.length;i++){
      const row=rows[i];
      if(row.length!==head.length)throw new Error('CSV row '+(i+1)+' has '+row.length+' columns; expected '+head.length+'.');
      const key=normalizedDate(row[datePos]);
      if(!key)throw new Error('Invalid date on CSV row '+(i+1)+'.');
      if(key<START)throw new Error('CSV row '+(i+1)+' is before the tracker start date (15 Nov 2026).');
      if(key>today)throw new Error('CSV row '+(i+1)+' is dated in the future. Check the date format.');
      const raw=String(row[stepsPos]).trim();
      if(!/^(?:0|[1-9]\d*)(?:\.0+)?$/.test(raw))throw new Error('Steps must be a positive whole number or zero (row '+(i+1)+').');
      const steps=Number(raw);
      if(!Number.isSafeInteger(steps) || steps>100000)throw new Error('Steps are out of range on row '+(i+1)+'.');
      const previous=days.get(key)||{date:key,steps:0,readings:0};
      previous.steps+=steps;
      previous.readings++;
      if(previous.steps>100000)throw new Error('More than 100,000 steps for '+key+'. Check for overlapping step samples.');
      days.set(key,previous);
      if(days.size>MAX_DAYS)throw new Error('Too many different dates. Import up to 500 days per file.');
      readings++;
    }
    if(!readings)throw new Error('There are no valid steps to import.');
    return {readings,days:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),
      total:[...days.values()].reduce((sum,x)=>sum+x.steps,0)};
  }
  function message(value,kind=''){
    const el=$('csvImportStatus');
    if(!el)return;
    el.textContent=value;
    el.className='csv-import-status'+(kind?' is-'+kind:'');
  }
  function clearChildren(element){element.replaceChildren();}
  function badge(text,kind){
    const span=document.createElement('span');
    span.className='csv-import-badge '+kind;
    span.textContent=text;
    return span;
  }
  function currentExisting(date) {
    const current=context?.();
    return current?.existing?.get(date)?.steps ?? null;
  }
  function candidate(item,mode){
    const old=currentExisting(item.date);
    if(old===item.steps)return {type:'unchanged',old};
    if(old!=null && mode!=='replace')return {type:'skip',old};
    return {type:old==null?'add':'replace',old};
  }
  function redraw(){
    const holder=$('csvImportPreview');
    if(!holder)return;
    holder.hidden=!pending;
    const body=$('csvImportRows');
    clearChildren(body);
    if(!pending)return;
    const mode=$('csvConflictMode').value;
    let additions=0,updates=0,skipped=0;
    for(const item of pending.days){
      const decision=candidate(item,mode);
      if(decision.type==='add')additions++;
      else if(decision.type==='replace')updates++;
      else skipped++;
    }
    $('csvImportSummary').textContent=pending.readings.toLocaleString()+' rows · '+
      pending.days.length+' '+(pending.days.length===1?'day':'days')+' · '+
      pending.total.toLocaleString()+' steps';
    $('csvImportChanges').textContent=additions+' new · '+updates+' replaced · '+skipped+' skipped or unchanged';
    for(const item of pending.days.slice(0,18)){
      const row=document.createElement('div');
      row.className='csv-import-row';
      const heading=document.createElement('span');
      heading.className='csv-import-day';
      heading.textContent=item.date+' · '+item.readings+' samples';
      const summary=document.createElement('strong');
      summary.textContent=item.steps.toLocaleString()+' steps';
      const status=candidate(item,mode);
      row.append(heading,summary,badge(status.type,
        status.type==='add'?'is-new':status.type==='replace'?'is-replace':'is-skipped'));
      body.append(row);
    }
    if(pending.days.length>18){
      const more=document.createElement('p');more.className='csv-import-more';
      more.textContent='And '+(pending.days.length-18)+' more days…';
      body.append(more);
    }
    $('csvImportSave').disabled=busy || additions+updates===0 || !context?.()?.userId || context?.()?.readonly;
    $('csvImportSave').textContent=updates?'Import '+(additions+updates)+' days (replace steps)':
      'Import '+additions+' '+(additions===1?'day':'days');
  }
  function busyState(next){
    busy=next;
    $('csvStepsFile').disabled=next;
    $('csvConflictMode').disabled=next;
    redraw();
  }
  function reset(){
    parseSerial++;
    pending=null;
    busy=false;
    if(!$('csvImportPanel'))return;
    $('csvStepsFile').value='';
    $('csvConflictMode').value='skip';
    $('csvStepsFile').disabled=false;
    $('csvConflictMode').disabled=false;
    $('csvImportPreview').hidden=true;
    message('');
    redraw();
  }
  async function changeFile(){
    if(busy)return;
    const file=$('csvStepsFile').files?.[0];
    const serial=++parseSerial;
    pending=null;
    redraw();
    message('');
    if(!file)return;
    if(file.size>MAX_BYTES){message('File is too large (maximum 5 MB).','error');return;}
    if(!/\.csv$/i.test(file.name)){message('Please select a .csv file.','error');return;}
    if(!context?.()?.userId || context?.()?.readonly){message('Sign in to your own tracker to import steps.','error');return;}
    try{
      const content=await file.text();
      if(serial!==parseSerial)return;
      pending=parse(content);
      $('csvConflictMode').value='skip';
      redraw();
      message('Review the totals below. Nothing is saved until you tap Import.','success');
    }catch(err){
      if(serial!==parseSerial)return;
      pending=null;redraw();
      message(err.message||'Could not read the CSV file.','error');
    }
  }
  async function apply(){
    if(busy||!pending)return;
    const initial=context?.();
    if(!initial?.db || !initial?.userId || initial.readonly){
      message('Sign in to your own tracker before importing.','error');return;
    }
    const client=initial.db,uid=initial.userId,mode=$('csvConflictMode').value;
    const planned=pending.days.map(item=>({...item,...candidate(item,mode)}))
      .filter(x=>x.type==='add'||x.type==='replace');
    if(!planned.length){message('Nothing new to import.','error');return;}
    const replaces=planned.filter(x=>x.type==='replace').length;
    if(replaces && !window.confirm('Replace existing steps on '+replaces+
        ' '+(replaces===1?'date':'dates')+'? Calories, meals and other details will be preserved.'))return;
    busyState(true);
    let saved=0,skipped=0;
    try{
      // Re-read live values before applying, rather than trust a cached UI
      // preview that may be stale after another device saved a day.
      const dates=pending.days.map(x=>x.date);
      const {data:live,error:readError}=await client.from('daily_entries')
        .select('id,entry_date,steps').eq('user_id',uid).in('entry_date',dates);
      if(readError)throw readError;
      const existing=new Map((live||[]).map(x=>[x.entry_date,x]));
      for(const item of pending.days){
        if(context?.()?.userId!==uid || context?.()?.readonly)
          throw new Error('The active account changed. Stop and sign in again.');
        const row=existing.get(item.date);
        const old=row?.steps??null;
        if(old===item.steps||(old!=null&&mode!=='replace')){skipped++;continue;}
        message('Saving '+item.date+' ('+(saved+1)+' of '+pending.days.length+')…');
        let result;
        if(row){
          result=await client.from('daily_entries').update({
            steps:item.steps,updated_at:new Date().toISOString()
          }).eq('user_id',uid).eq('entry_date',item.date)
            .select('id,entry_date,steps').single();
        }else{
          result=await client.from('daily_entries').insert({
            user_id:uid,entry_date:item.date,steps:item.steps
          }).select('id,entry_date,steps').single();
        }
        if(result.error)throw result.error;
        saved++;
      }
      if(saved && onSaved)await onSaved();
      pending=null;
      $('csvStepsFile').value='';
      redraw();
      message('Imported '+saved+' '+(saved===1?'day':'days')+' successfully.'+
        (skipped?' '+skipped+' skipped.':'')+' Your calendar is updated.','success');
    }catch(err){
      try{if(saved&&onSaved)await onSaved();}catch(_){}
      message('Saved '+saved+' days before an error: '+(err?.message||'Unknown error')+
        '. Review your calendar before retrying.','error');
    }finally{busyState(false);}
  }
  function mount({getContext,onSaved:refresh}){
    if(context)return;
    context=getContext;
    onSaved=refresh;
    $('csvStepsFile').addEventListener('change',changeFile);
    $('csvConflictMode').addEventListener('change',redraw);
    $('csvImportSave').addEventListener('click',apply);
  }
  window.FitnessCsvImport=Object.freeze({mount,reset,parse});
})();
