/* Small native HTML-page navigation layer; never intercepts links, auth or file downloads. */
(() => {
  'use strict';
  const KEY='fitness-page-transition';
  const overlay=document.getElementById('pageLoadOverlay');
  const message=document.getElementById('pageLoadText');
  let slowTimer=null;
  const show=()=>{
    if(!overlay)return;
    overlay.hidden=false;
    document.documentElement.setAttribute('aria-busy','true');
    if(message)message.textContent='Loading your progress…';
    if(slowTimer)clearTimeout(slowTimer);
    slowTimer=setTimeout(()=>{
      if(!overlay.hidden && message)message.textContent='Still loading. Check your connection or retry.';
    },9000);
  };
  const hide=()=>{
    if(slowTimer)clearTimeout(slowTimer);
    if(overlay)overlay.hidden=true;
    document.documentElement.removeAttribute('aria-busy');
    try{sessionStorage.removeItem(KEY);}catch(_){}
  };
  try{
    const t=Number(sessionStorage.getItem(KEY)||0);
    if(t && Date.now()-t<25000)show();
    else sessionStorage.removeItem(KEY);
  }catch(_){}
  document.getElementById('pageLoadRetry')?.addEventListener('click',()=>window.location.reload());
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=event.target?.closest?.('a[href]');
    if(!anchor||anchor.target||anchor.hasAttribute('download'))return;
    let url;
    try{url=new URL(anchor.href,window.location.href)}catch(_){return}
    if(url.origin!==window.location.origin || !['/','/log.html','/history.html','/share.html'].includes(url.pathname))return;
    if(url.pathname===window.location.pathname && url.search===window.location.search)return;
    try{sessionStorage.setItem(KEY,String(Date.now()));}catch(_){}
    show();
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)hide();});
  // Optimistic warmup of real HTML documents (never fetches private Supabase data).
  const warmed=new Set();
  const prefetch=anchor=>{
    if(!anchor?.href)return;
    let url;try{url=new URL(anchor.href)}catch(_){return}
    if(url.origin!==window.location.origin||warmed.has(url.pathname)||url.pathname===window.location.pathname)return;
    if(!['/','/log.html','/history.html','/share.html'].includes(url.pathname))return;
    warmed.add(url.pathname);
    const link=document.createElement('link');
    link.rel='prefetch';link.as='document';link.href=url.pathname;
    document.head.append(link);
  };
  document.querySelectorAll('.bottom-tab[href],.page-nav-link[href]').forEach(link=>{
    link.addEventListener('pointerenter',()=>prefetch(link),{once:true,passive:true});
    link.addEventListener('touchstart',()=>prefetch(link),{once:true,passive:true});
  });
  window.FitnessPageLoading=Object.freeze({show,hide});
})();