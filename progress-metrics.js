/* 10K daily goal streaks computed on-device from saved step records.
   The streak is independent of the 30-day challenge and includes imported history. */
(() => {
  'use strict';
  const START='2026-11-15',GOAL=10000;
  function parse(key){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key||''))return null;
    const [y,m,d]=key.split('-').map(Number);
    const date=new Date(Date.UTC(y,m-1,d,12));
    if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;
    return date;
  }
  function shift(key,n){
    const d=parse(key);if(!d)return null;
    d.setUTCDate(d.getUTCDate()+n);
    return d.toISOString().slice(0,10);
  }
  function today(){
    const date=new Date();
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function streak(entries,asOf=today()){
    if(!(entries instanceof Map))entries=new Map();
    const selected=parse(asOf)?asOf:today();
    const dates=[...entries.keys()].filter(d=>parse(d)&&d<=selected).sort();
    const start=dates[0]||selected;
    const succeeded=(date)=>Number(entries.get(date)?.steps)>=GOAL;
    let best=0,chain=0,goalDays=0;
    // Iterate chronologically, so gaps break the chain even with no row.
    let key=start;
    let guard=0;
    while(key<=selected && guard++<20000){
      if(succeeded(key)){chain++;goalDays++;best=Math.max(best,chain);}
      else chain=0;
      key=shift(key,1);
    }
    // Keep yesterday's streak visible while the current day is still in
    // progress. It expires when the following calendar day begins.
    const metToday=succeeded(selected);
    const anchor=metToday?selected:shift(selected,-1);
    let current=0,walker=anchor;
    while(walker && walker>=start && succeeded(walker) && current<20000){
      current++;walker=shift(walker,-1);
    }
    return {current,best,goalDays,latest:current?anchor:null,metToday,
      pendingToday:!metToday&&current>0,asOf:selected};
  }
  window.FitnessProgress=Object.freeze({streak,shift,today,GOAL,START});
})();