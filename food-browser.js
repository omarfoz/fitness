/* Interactive food picker; stays client-side until a daily entry is saved.
 * Itemized meal data belongs to the signed-in user's daily_entries row.
 * Estimate data is illustrative; edit each item from restaurant/label details.
 */
(() => {
  'use strict';
  const foods = Array.isArray(window.FITNESS_FOODS) ? window.FITNESS_FOODS : [];
  const $ = (id) => document.getElementById(id);
  let items = [], contextKey = null, manualTotal = false, manualValue = '';
  let category = 'Popular', searchText = '';
  const popularNames = [
    'Chicken shawarma Arabic','Chicken shawarma sandwich','Double cheeseburger',
    'Chicken burrito','Beef taco','Chicken taco','Margherita pizza slice',
    'Chicken kabsa','Chicken mandi','Chicken biryani','Chicken alfredo',
    'Chicken Caesar salad','Chicken nuggets','Medium French fries',
    'Scrambled eggs','Latte'
  ];
  const popularIds = new Set(foods.filter(f=>popularNames.includes(f.name)).map(f=>f.id));
  const fmt = n => Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
  const validKcal = n => Number.isInteger(n) && n>=0 && n<=10000;
  const validQty = n => Number.isFinite(n) && n>=.5 && n<=20 && Number.isInteger(n*2);
  const normalize = text => String(text||'').toLowerCase().normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670\u0640]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[\u0300-\u036f]/g,'').trim();
  const svgAdd = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const svgTrash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18m-15 0 1 15h10l1-15M9 6V4h6v2m-5 4v7m4-7v7"/></svg>';

  function total() {
    return Math.round(items.reduce((sum,item)=>sum+item.kcal*item.quantity,0));
  }
  function canAdd() {
    return items.length < 50;
  }
  function setFoodMessage(message,kind='') {
    const element=$('foodMessage');
    element.textContent=message;
    element.className='inline-message'+(kind?' '+kind:'');
  }
  function syncTotal() {
    const sum=total();
    $('foodSum').textContent=fmt(sum);
    if (items.length && !manualTotal) $('calories').value=String(sum);
    if (items.length===0 && !manualTotal) $('calories').value='';
    renderHint();
  }
  function renderHint() {
    $('useFoodSumBtn').hidden = items.length===0 || !manualTotal;
    const note=$('calorieModeHint');
    if (manualTotal) {
      note.textContent=items.length
        ? 'Manual daily total. Use food total to recalculate.'
        : 'Manual daily estimate. Add foods if you like.';
    } else {
      note.textContent=items.length
        ? 'Calculated from your food list. You can override it.'
        : 'Add foods to calculate an estimated total.';
    }
  }
  function restoreItem(raw) {
    if (!raw || typeof raw!=='object') return null;
    const name=String(raw.name||'').trim().slice(0,100);
    const id=String(raw.id||'').trim().slice(0,100);
    const quantity=Number(raw.quantity);
    const kcal=Number(raw.kcal);
    if (!id || !name || !validQty(quantity) || !validKcal(kcal)) return null;
    return {id,name,arabic:String(raw.arabic||'').slice(0,100),serving:String(raw.serving||'1 serving').slice(0,100),quantity,kcal};
  }
  function openEntry(entry,key) {
    if(contextKey!==key) {
      contextKey=key;
      items=(Array.isArray(entry?.meal_items)?entry.meal_items:[]).slice(0,50).map(restoreItem).filter(Boolean);
      const saved=entry?.calories_estimate;
      const hasSaved=saved!==null && saved!==undefined;
      manualTotal=hasSaved&&(items.length===0 || saved!==total());
      manualValue=hasSaved?String(saved):'';
      renderSelected();
    }
    if (manualTotal) $('calories').value=manualValue;
    syncTotal();
  }
  function invalidate() {
    contextKey=null;
  }
  function getItems() {
    return items.map(({id,name,arabic,serving,quantity,kcal})=>({id,name,arabic,serving,quantity,kcal}));
  }
  function validItems() {
    return items.length<=50&&items.every(item=>validQty(item.quantity)&&validKcal(item.kcal))&&total()<=15000;
  }
  function addFood(food) {
    if (!food) return;
    const existing=items.find(item=>item.id===food.id);
    if (existing) {
      if (existing.quantity>=20) {
        setFoodMessage('This food has reached the quantity limit.','error');return;
      }
      existing.quantity=Math.min(20,existing.quantity+1);
    } else {
      if (!canAdd()) {setFoodMessage('You can record up to 50 different foods per day.','error');return;}
      items.push({
        id:food.id,name:food.name,arabic:food.arabic||'',
        serving:food.serving||'1 serving',quantity:1,kcal:food.kcal
      });
    }
    renderSelected();
    syncTotal();
    setFoodMessage(food.name+' added. Edit its quantity and calories below.','success');
  }
  function el(tag,cls,txt) {
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!==undefined)e.textContent=txt;
    return e;
  }
  function selectedRow(item,index) {
    const row=el('div','selected-food-row');
    row.dataset.foodIndex=String(index);
    const main=el('div','selected-food-main');
    main.append(el('strong','',item.name));
    main.append(el('small','',item.serving+(item.arabic?' · '+item.arabic:'')));
    const edits=el('div','selected-food-edit');
    for (const [field,label,value,min,max,step] of [
      ['quantity','Quantity',item.quantity,'.5','20','.5'],
      ['kcal','Kcal / serving',item.kcal,'0','10000','1']
    ]) {
      const wrap=el('label','',label);
      const input=el('input','');
      input.type='number';input.inputMode=field==='quantity'?'decimal':'numeric';
      input.min=min;input.max=max;input.step=step;input.value=String(value);
      input.dataset.foodField=field;
      input.dataset.foodIndex=String(index);
      input.setAttribute('aria-label',label+' for '+item.name);
      wrap.append(input);
      edits.append(wrap);
    }
    main.append(edits);
    const side=el('div','selected-food-side');
    const line=el('strong','',fmt(Math.round(item.quantity*item.kcal))+' kcal');
    line.dataset.foodLine=String(index);
    const remove=el('button','food-remove');
    remove.type='button';remove.dataset.foodRemove=String(index);
    remove.innerHTML=svgTrash;
    remove.title='Remove '+item.name;
    remove.setAttribute('aria-label','Remove '+item.name);
    side.append(line,remove);
    row.append(main,side);
    return row;
  }
  function renderSelected() {
    const list=$('selectedFoodList');
    list.replaceChildren();
    for(let i=0;i<items.length;i++) list.append(selectedRow(items[i],i));
    $('selectedFoodEmpty').hidden=items.length>0;
    $('foodSum').textContent=fmt(total());
    renderHint();
  }
  function categories() {
    const host=$('foodCategories');
    host.replaceChildren();
    const options=['Popular','All',...new Set(foods.map(f=>f.category))];
    for(const name of options){
      const btn=el('button','food-category'+(category===name?' is-active':''),name);
      btn.type='button';btn.dataset.foodCategory=name;
      btn.setAttribute('aria-pressed',String(category===name));
      host.append(btn);
    }
  }
  function matches(food,q) {
    if(!q) return true;
    return normalize([food.name,food.arabic,food.category,food.serving].join(' ')).includes(q);
  }
  function renderCatalog() {
    categories();
    const query=normalize(searchText);
    let visible=foods.filter(food=>{
      const inCategory=category==='All'||(category==='Popular'?popularIds.has(food.id):food.category===category);
      return inCategory&&matches(food,query);
    });
    const host=$('foodResults');
    host.replaceChildren();
    $('foodNoResults').hidden=visible.length>0;
    $('clearFoodSearchBtn').hidden=searchText.length===0;
    $('foodResultsMeta').textContent=category+(searchText?' · '+fmt(visible.length)+' matches':' · '+fmt(visible.length)+' foods');
    for(const food of visible) {
      const button=el('button','food-result');
      button.type='button';
      button.dataset.foodAdd=food.id;
      button.title='Add '+food.name+', estimated '+fmt(food.kcal)+' kcal for '+food.serving;
      button.setAttribute('aria-label',button.title);
      button.append(el('span','food-result-name',food.name));
      button.append(el('span','food-result-ar',food.arabic));
      const foot=el('span','food-result-bottom');
      foot.append(el('span','food-result-serve',food.serving));
      const kcal=el('span','food-result-energy',fmt(food.kcal)+' kcal ');
      kcal.insertAdjacentHTML('beforeend',svgAdd);
      foot.append(kcal);
      button.append(foot);
      host.append(button);
    }
  }
  $('foodCategories').addEventListener('click',event=>{
    const btn=event.target.closest('[data-food-category]');
    if(!btn) return;
    category=btn.dataset.foodCategory;
    renderCatalog();
    $('foodResults').scrollTop=0;
  });
  $('foodSearch').addEventListener('input',event=>{
    searchText=event.target.value.trim().slice(0,100);
    if(searchText)category='All'; // Searching always includes every category.
    if(!searchText && category==='All')category='Popular';
    renderCatalog();
    $('foodResults').scrollTop=0;
  });
  $('clearFoodSearchBtn').addEventListener('click',()=>{
    searchText='';category='Popular';$('foodSearch').value='';
    renderCatalog();$('foodSearch').focus();
  });
  $('foodResults').addEventListener('click',event=>{
    const button=event.target.closest('[data-food-add]');
    if(!button) return;
    addFood(foods.find(food=>food.id===button.dataset.foodAdd));
  });
  $('addCustomFoodBtn').addEventListener('click',()=>{
    const name=$('customFoodName').value.trim();
    const raw=$('customFoodCalories').value.trim();
    const kcal=raw===''?NaN:Number(raw);
    if(!name || name.length>100 || !validKcal(kcal)) {
      setFoodMessage('Enter a food name and a whole-number estimate between 0 and 10,000 kcal.','error');
      return;
    }
    const id='custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
    addFood({id,name,arabic:'',serving:'1 serving',kcal});
    $('customFoodName').value='';$('customFoodCalories').value='';
  });
  // Pressing Enter inside the custom-food mini form should add that item,
  // not accidentally submit and save the entire daily entry.
  for (const inputId of ['customFoodName','customFoodCalories']) {
    $(inputId).addEventListener('keydown',event=>{
      if(event.key==='Enter') {
        event.preventDefault();
        $('addCustomFoodBtn').click();
      }
    });
  }
  $('selectedFoodList').addEventListener('click',event=>{
    const btn=event.target.closest('[data-food-remove]');
    if(!btn) return;
    const index=Number(btn.dataset.foodRemove);
    if(index<0 || index>=items.length) return;
    items.splice(index,1);
    renderSelected();
    syncTotal();
    setFoodMessage('Food removed. Review your daily total before saving.','success');
  });
  $('selectedFoodList').addEventListener('input',event=>{
    const input=event.target.closest('[data-food-field]');
    if(!input) return;
    const index=Number(input.dataset.foodIndex), item=items[index];
    if(!item)return;
    const key=input.dataset.foodField,number=Number(input.value);
    if(input.value.trim()==='' || (key==='kcal'?!validKcal(number):!validQty(number)))return;
    item[key]=number;
    const label=$('selectedFoodList').querySelector('[data-food-line="'+index+'"]');
    if(label)label.textContent=fmt(Math.round(item.kcal*item.quantity))+' kcal';
    syncTotal();
  });
  $('selectedFoodList').addEventListener('change',event=>{
    const input=event.target.closest('[data-food-field]');
    if(!input)return;
    // Restore valid stored value when an incomplete numeric input loses focus.
    const item=items[Number(input.dataset.foodIndex)];
    if(item)input.value=String(item[input.dataset.foodField]);
    renderSelected();syncTotal();
  });
  $('calories').addEventListener('input',()=>{
    manualTotal=true;
    manualValue=$('calories').value;
    renderHint();
  });
  $('useFoodSumBtn').addEventListener('click',()=>{
    if(!items.length)return;
    manualTotal=false;
    manualValue='';
    syncTotal();
  });
  $('foodCatalogCount').textContent=fmt(foods.length)+' foods';
  renderCatalog();
  renderSelected();
  window.FitnessFoodBrowser=Object.freeze({
    openEntry,invalidate,getItems,validItems,selectedTotal:total
  });
})();
