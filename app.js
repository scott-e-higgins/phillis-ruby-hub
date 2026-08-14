const APP_VERSION='0.49.5';
const SEED={"tripSummaries":[],"campgrounds":[],"stays":[],"tripPlans":[],"fuel":[],"def":[],"siteFees":[],"electric":[],"sharedNotes":[],"vehicleDetails":[],"meta":{"source":"Supabase","version":APP_VERSION},"phillisUpgrades":[],"rubyMaintenance":[],"rubyUpgrades":[],"phillisMaintenance":[]};
const KEY='phillis-ruby-hub-v04', OLDKEY='phillis-ruby-hub-v03';
const NO_TRIP_VALUE='__everyday_ruby__';
const NO_TRIP_LABEL='No trip · Everyday Ruby';
const $=s=>document.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const clone=x=>JSON.parse(JSON.stringify(x));
const escapeHtml=value=>String(value).replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
function splitFuelLocation(value){
  const location=String(value||'').trim();
  if(!location)return {city:'',state:''};
  const match=location.match(/^(.*?),\s*([A-Za-z]{2})$/);
  return match?{city:match[1].trim(),state:match[2].toUpperCase()}:{city:location,state:''};
}
let migratedTrailerAssignments=false;
function migrate(x){
  if(!x) return null;
  migratedTrailerAssignments=false;
  if(x.maintenance&&!x.phillisMaintenance) x.phillisMaintenance=x.maintenance;
  delete x.maintenance;
  for(const k of ['phillisMaintenance','phillisUpgrades','rubyMaintenance','rubyUpgrades','fuel','def','electric','siteFees','stays','tripPlans','tripSummaries','campgrounds','sharedNotes','vehicleDetails']) x[k]=x[k]||[];
  for(const key of ['phillisMaintenance','phillisUpgrades']){
    x[key].forEach(record=>{
      const trailer=Number(String(record.date||'').slice(0,4))>=2026?'Phillis II.0':'Phillis';
      if(record.trailer!==trailer){record.trailer=trailer;migratedTrailerAssignments=true;}
    });
  }
  x.sharedNotes.forEach(note=>{
    note.pinned=Boolean(note.pinned);
    note.archived=Boolean(note.archived);
    note.tripId=note.tripId||null;
    note.photoPaths=Array.isArray(note.photoPaths)?note.photoPaths:[];
    note.photoUrls=Array.isArray(note.photoUrls)?note.photoUrls:[];
  });
  x.fuel.forEach(record=>{
    const legacy=splitFuelLocation(record.location);
    if(!record.city)record.city=legacy.city;
    if(!record.state)record.state=legacy.state;
    record.location=[record.city,record.state].filter(Boolean).join(', ');
  });
  x.def.forEach(record=>{
    const legacy=splitFuelLocation(record.location);
    if(!record.city)record.city=legacy.city;
    if(!record.state)record.state=legacy.state;
    record.location=[record.city,record.state].filter(Boolean).join(', ');
  });
  x.tripPlans.forEach(plan=>{
    plan.planType=plan.planType||'activity';
    plan.status=plan.status||'planned';
    plan.receiptPhotoPaths=Array.isArray(plan.receiptPhotoPaths)?plan.receiptPhotoPaths:[];
    plan.receiptPhotoUrls=Array.isArray(plan.receiptPhotoUrls)?plan.receiptPhotoUrls:[];
    plan.documentAttachments=Array.isArray(plan.documentAttachments)?plan.documentAttachments:[];
  });
  return x;
}
let db=migrate(JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(OLDKEY)||'null'))||clone(SEED);
let cloudLoaded=false;
let detailReturnTripIndex=null;
let entryReturnTripIndex=null;
let suppressNextDetailReturn=false;
let suppressNextEntryReturn=false;
function closeDetailForTransition(){
  detailReturnTripIndex=null;
  if($('#detailDialog')?.open){
    suppressNextDetailReturn=true;
    $('#detailDialog').close();
  }
}
function closeEntryForTransition(){
  entryReturnTripIndex=null;
  if($('#entryStayIndex'))$('#entryStayIndex').value='';
  if($('#entryDialog')?.open){
    suppressNextEntryReturn=true;
    $('#entryDialog').close();
  }
}
const save=()=>{
  localStorage.setItem(KEY,JSON.stringify(db));
  if(cloudLoaded&&window.ADVENTURE_HUB_STORE){
    const status=$('#cloudAccountStatus');
    if(window.ADVENTURE_HUB_CLOUD?.role==='viewer'){
      if(status)status.textContent=`Connected as ${window.ADVENTURE_HUB_CLOUD.user.email} · Higgins Hub · View only`;
      return Promise.resolve(true);
    }
    if(status)status.textContent='Saving shared changes…';
    return window.ADVENTURE_HUB_STORE.save(db).then(()=>{
      if(status&&window.ADVENTURE_HUB_CLOUD)status.textContent=`Connected as ${window.ADVENTURE_HUB_CLOUD.user.email} · Higgins Hub · All changes saved`;
      return true;
    }).catch(error=>{
      console.error(error);
      if(status)status.textContent='Cloud save needs attention. Your browser backup is still safe.';
      alert(`The change is saved on this device, but cloud syncing failed.\n\n${error.message}`);
      return false;
    });
  }
  return Promise.resolve(true);
};
function applyDataMigrations(){
  db.meta=db.meta||{};
  db.meta.migrations=db.meta.migrations||[];
  let changed=false;
  db.stays.forEach(stay=>{
    if(stay.harvestHost && !stay.stayType){stay.stayType='harvest-host';changed=true;}
    if(stay.moochdocking && !stay.stayType){stay.stayType='moochdocking';changed=true;}
    if(stay.boondocking && !stay.stayType){stay.stayType='boondocking';changed=true;}
  });
  if(!db.meta.migrations.includes('v075-trip-stays-types')){
    db.meta.migrations.push('v075-trip-stays-types');changed=true;
  }
  if(changed) save();
}
applyDataMigrations();
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(+n||0);
const number=(n,d=1)=>n==null||Number.isNaN(+n)?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:d});
const date=d=>!d||d==='Season'?'Season':new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const clockTime=value=>{
  if(!value)return '';
  const [hours,minutes]=String(value).slice(0,5).split(':').map(Number);
  if(!Number.isFinite(hours)||!Number.isFinite(minutes))return '';
  return new Date(2000,0,1,hours,minutes).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
};
const US_STATE_ABBREVIATIONS=['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const stateOptions=()=>'<option value="">Choose</option>'+US_STATE_ABBREVIATIONS.map(state=>`<option value="${state}">${state}</option>`).join('');
function stayPhotoGallery(stay){
  const photos=[
    {url:stay.sitePhotoUrl,label:'Campsite'},
    {url:stay.signPhotoUrl,label:'Sign'}
  ].filter(photo=>photo.url);
  if(!photos.length)return '';
  return `<div class="stay-photo-strip">${photos.map(photo=>`<button class="stay-photo-thumb" type="button" data-photo-url="${escapeHtml(photo.url)}" data-photo-label="${escapeHtml(`${stay.name} · ${photo.label}`)}" aria-label="Open ${escapeHtml(photo.label)} photo"><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.label)}" loading="lazy"><span>${escapeHtml(photo.label)}</span></button>`).join('')}</div>`;
}
function tripPhotoHtml(trip,{detail=false,header=false}={}){
  if(!trip.onRoadPhotoUrl)return '';
  const label=`${trip.name} · On the Road Again`;
  const photoClass=header?'trip-detail-photo':detail?'trip-hero-photo':'trip-card-photo';
  return `<button class="${photoClass}" type="button" data-photo-url="${escapeHtml(trip.onRoadPhotoUrl)}" data-photo-label="${escapeHtml(label)}" aria-label="Open On the Road Again photo"><img src="${escapeHtml(trip.onRoadPhotoUrl)}" alt="${escapeHtml(`On the Road Again for ${trip.name}`)}" loading="lazy"><span>On the Road Again</span></button>`;
}
function setDetailHeader(kicker,title,trip=null,metaHtml=''){
  $('#detailKicker').textContent=kicker;
  $('#detailTitle').textContent=title;
  $('#detailHeaderMeta').innerHTML=metaHtml;
  const media=$('#detailHeaderMedia');
  media.innerHTML=tripPhotoHtml(trip||{},{header:true});
  bindStayPhotoButtons(media);
}
function stayTypeBadges(stay){
  return `${stay.harvestHost||stay.stayType==='harvest-host'?'<span class="stay-badge">Harvest Host</span>':''}${stay.moochdocking||stay.stayType==='moochdocking'?'<span class="stay-badge">Moochdocking</span>':''}${stay.boondocking||stay.stayType==='boondocking'?'<span class="stay-badge">Boondocking</span>':''}`;
}
function stayLocationHtml(stay,{full=false}={}){
  const mapAddress=[stay.address,stay.city,stay.state,stay.zip].filter(Boolean).join(', ');
  const displayLocation=full?mapAddress:([stay.city,stay.state].filter(Boolean).join(', ')||stay.address||'');
  if(!mapAddress||!displayLocation)return '';
  const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`;
  return `<p><a class="stay-address-link" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener" data-map-address="${escapeHtml(mapAddress)}" aria-label="Open ${escapeHtml(mapAddress)} in Google Maps"><span aria-hidden="true">⌖</span>${escapeHtml(displayLocation)}</a></p>`;
}
function stayListing(stay,{viewer=false}={}){
  const index=db.stays.indexOf(stay);
  const journalStatus=viewer?null:campgroundJournalStatus(stay);
  const journalBadge=journalStatus&&journalStatus.tone!=='empty'
    ?`<span class="stay-log-badge stay-log-${journalStatus.tone}">${journalStatus.tone==='complete'?'Log complete':'Log draft'}</span>`
    :'';
  const summary=viewer
    ?'<span class="stay-card-chevron" aria-hidden="true">›</span>'
    :`<div class="stay-card-summary"><span>${money(stay.price)}</span><i aria-hidden="true">›</i></div>`;
  return `<article class="stay-listing-card" data-stay-detail="${index}" tabindex="0" aria-label="Open details for ${escapeHtml(stay.name)}"><div class="stay-listing-main"><div class="stay-listing-copy"><h4>${escapeHtml(stay.name)}</h4><p>${date(stay.arrival)}${stay.checkInTime?` · Check in ${clockTime(stay.checkInTime)}`:''} – ${date(stay.departure)}${stay.checkOutTime?` · Check out ${clockTime(stay.checkOutTime)}`:''}</p>${stayLocationHtml(stay)}${stay.site?`<p>Site ${escapeHtml(stay.site)}</p>`:''}<div class="stay-badges">${stayTypeBadges(stay)}${journalBadge}</div></div>${stayPhotoGallery(stay)}${summary}</div></article>`;
}
function bindStayPhotoButtons(root=document){
  $$('[data-photo-url]',root).forEach(button=>button.onclick=()=>{
    const dialog=$('#photoDialog');
    $('#photoDialogImage').src=button.dataset.photoUrl;
    $('#photoDialogImage').alt=button.dataset.photoLabel||'Stay photo';
    $('#photoDialogCaption').textContent=button.dataset.photoLabel||'Stay photo';
    dialog.showModal();
  });
}
function bindStayMapLinks(root=document){
  $$('[data-map-address]',root).forEach(link=>link.onclick=event=>{
    const address=link.dataset.mapAddress;
    if(!confirm(`Open this address in Google Maps?\n\n${address}`))event.preventDefault();
  });
}
function bindStayCards(root=document,tripIndex=null){
  $$('[data-stay-detail]',root).forEach(card=>{
    const open=()=>showStay(+card.dataset.stayDetail,tripIndex);
    card.onclick=event=>{
      if(event.target.closest('a,button,input,label'))return;
      open();
    };
    card.onkeydown=event=>{
      if(!['Enter',' '].includes(event.key)||event.target.closest('a,button,input,label'))return;
      event.preventDefault();
      open();
    };
  });
}
let TODAY=new Date(); TODAY.setHours(0,0,0,0);
function tripDates(t){
  const fallback=`${t.year}-12-31`;
  return [t.startDate||fallback,t.endDate||t.startDate||fallback];
}
function tripStamp(t){return tripDates(t)[0]}
function tripHasDates(t){return Boolean(t.startDate)}
function rigLabel(t){return [t?.towVehicle,t?.rv].filter(Boolean).join(' + ')}
function rigLineHtml(t,compact=false){
  const rig=rigLabel(t);
  return rig?`<div class="rig-line${compact?' rig-line-compact':''}"><span>Rig</span><b>${escapeHtml(rig)}</b></div>`:'';
}
function tripStatus(t){
  if(!tripHasDates(t)) return 'completed';
  const [start,end]=tripDates(t);
  const startDate=new Date(start+'T00:00:00'), endDate=new Date(end+'T23:59:59');
  if(TODAY<startDate) return 'planned';
  if(TODAY<=endDate) return 'current';
  return 'completed';
}
function isUpcoming(t){return ['planned','current'].includes(tripStatus(t))}
function daysUntil(d){return Math.max(0,Math.ceil((new Date(d+'T00:00:00')-TODAY)/86400000))}
function tripProgress(t){
  const [start,end]=tripDates(t);
  const elapsed=Math.floor((TODAY-new Date(start+'T00:00:00'))/86400000)+1;
  const length=Math.floor((new Date(end+'T00:00:00')-new Date(start+'T00:00:00'))/86400000)+1;
  return {day:Math.max(1,elapsed),length:Math.max(1,length)};
}
function daysSince(d){return Math.max(0,Math.floor((TODAY-new Date(d+'T00:00:00'))/86400000))}
const countPaths=records=>records.reduce((sum,record)=>sum+(Array.isArray(record?.receiptPhotoPaths)?record.receiptPhotoPaths.length:0),0);
const countSingleReceipts=records=>records.reduce((sum,record)=>sum+((record?.receiptPhotoPath||record?.receiptPhotoUrl)?1:0),0);
const formatBytes=bytes=>{
  const value=Math.max(0,Number(bytes)||0);
  if(value<1024)return `${number(value,0)} B`;
  if(value<1024*1024)return `${number(value/1024,1)} KB`;
  if(value<1024*1024*1024)return `${number(value/(1024*1024),1)} MB`;
  return `${number(value/(1024*1024*1024),2)} GB`;
};
const STORAGE_QUOTA_BYTES=1024*1024*1024;
const DATABASE_QUOTA_BYTES=500*1024*1024;
const quotaPercent=(used,limit)=>Math.max(0,Math.min(100,(Number(used)||0)/limit*100));
const formatQuotaPercent=value=>value===0?'0%':value<.1?`${value.toFixed(2)}%`:value<10?`${value.toFixed(1)}%`:`${number(value,0)}%`;
function setQuotaMeter(selector,percent){
  const meter=$(selector);
  if(meter)meter.style.width=`${percent>0?Math.max(.7,percent):0}%`;
}
function journalRecordBytes(){
  const json=JSON.stringify(db,(key,value)=>/(?:Photo)?Urls?$/.test(key)?undefined:value);
  return typeof TextEncoder==='function'?new TextEncoder().encode(json).byteLength:new Blob([json]).size;
}
function journalMediaCounts(){
  const tripPictures=db.tripSummaries.reduce((sum,trip)=>sum+((trip.onRoadPhotoPath||trip.onRoadPhotoUrl)?1:0),0);
  const stayPictures=db.stays.reduce((sum,stay)=>
    sum+((stay.sitePhotoPath||stay.sitePhotoUrl)?1:0)+((stay.signPhotoPath||stay.signPhotoUrl)?1:0),0);
  const notePictures=db.sharedNotes.reduce((sum,note)=>
    sum+(Array.isArray(note.photoPaths)&&note.photoPaths.length?note.photoPaths.length:(note.photoUrls||[]).length),0);
  const documents=
    countSingleReceipts(db.fuel)+
    countSingleReceipts(db.electric)+
    countPaths(db.siteFees)+
    countPaths(db.phillisMaintenance)+
    countPaths(db.phillisUpgrades)+
    countPaths(db.rubyMaintenance)+
    countPaths(db.rubyUpgrades)+
    countPaths(db.tripPlans);
  return {pictures:tripPictures+stayPictures+notePictures,documents};
}
let journalStatsRendering=0;
async function renderJournalStats({refreshStorage=false}={}){
  if(window.ADVENTURE_HUB_CLOUD?.role==='viewer')return;
  const card=$('#journalStatsCard');
  if(!card)return;
  const request=++journalStatsRendering;
  const counts=journalMediaCounts();
  const databaseBytes=journalRecordBytes();
  const databasePercent=quotaPercent(databaseBytes,DATABASE_QUOTA_BYTES);
  $('#statDatabaseSize').textContent=`${formatBytes(databaseBytes)} of 500 MB`;
  $('#statDatabaseDetail').textContent=`${formatQuotaPercent(databasePercent)} used · Supabase Free`;
  setQuotaMeter('#statDatabaseMeter',databasePercent);
  $('#statDocumentCount').textContent=number(counts.documents,0);
  $('#statPictureCount').textContent=number(counts.pictures,0);
  const monthKey=new Date().toISOString().slice(0,7);
  const monthUsage=db.meta?.aiUsage?.[monthKey]||{};
  const scans=Number(monthUsage.scans)||0;
  const cost=Number(monthUsage.cost)||0;
  $('#statAiUsage').textContent=money(cost);
  $('#statAiUsageDetail').textContent=`${number(scans,0)} ${scans===1?'scan':'scans'} · ${new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'})}`;
  const status=$('#journalStatsStatus');
  const storage=$('#statStorageUsage');
  const button=$('#refreshJournalStats');
  if(!window.ADVENTURE_HUB_STORE?.getStorageUsage){
    storage.textContent='Waiting for cloud…';
    status.textContent='Storage will appear after cloud syncing finishes.';
    return;
  }
  button?.classList.add('refreshing');
  storage.textContent='Calculating…';
  status.textContent='Checking uploaded files…';
  try{
    const usage=await window.ADVENTURE_HUB_STORE.getStorageUsage(refreshStorage);
    if(request!==journalStatsRendering)return;
    const storagePercent=quotaPercent(usage.bytes,STORAGE_QUOTA_BYTES);
    storage.textContent=`${formatBytes(usage.bytes)} of 1 GB`;
    $('#statStorageDetail').textContent=`${formatQuotaPercent(storagePercent)} used · ${number(usage.files,0)} ${usage.files===1?'file':'files'}`;
    setQuotaMeter('#statStorageMeter',storagePercent);
    status.textContent=`${number(usage.files,0)} uploaded ${usage.files===1?'file':'files'} · updated just now`;
  }catch(error){
    console.warn('Journal storage usage could not be calculated.',error);
    if(request!==journalStatsRendering)return;
    storage.textContent='Unavailable';
    status.textContent='The other Journal totals are current.';
  }finally{
    if(request===journalStatsRendering)button?.classList.remove('refreshing');
  }
}
function go(view){
  if(view==='notes'&&window.ADVENTURE_HUB_CLOUD?.role==='viewer')view='home';
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===view));
  $$('.bottom-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const appScroll=$('#appScroll');
  if(appScroll)appScroll.scrollTop=0;
  else window.scrollTo(0,0);
  if(view==='home') renderHome();
  if(view==='trips') renderTrips();
  if(view==='notes') renderNotes();
  if(view==='more') renderJournalStats();
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
$('#refreshJournalStats').onclick=()=>renderJournalStats({refreshStorage:true});

function renderVehicleDetails(){
  const details=new Map((db.vehicleDetails||[]).map(vehicle=>[vehicle.name,vehicle]));
  const showDetail=(selector,name,key)=>{
    const host=$(selector);
    if(!host)return;
    const value=details.get(name)?.[key]||'';
    host.hidden=!value;
    const code=host.querySelector('code');
    if(code)code.textContent=value;
  };
  showDetail('#phillisPlate','Phillis II.0','licensePlate');
  showDetail('#phillisVin','Phillis II.0','vin');
  showDetail('#rubyPlate','Ruby','licensePlate');
  showDetail('#rubyVin','Ruby','vin');
}

function noteWhen(value){
  if(!value)return '';
  const stamp=new Date(value);
  if(Number.isNaN(stamp.getTime()))return '';
  return stamp.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}
const checklistPattern=/^\s*-\s*\[([ xX])\]\s*(.*)$/;
function parseChecklist(body=''){
  const lines=String(body).split(/\r?\n/).filter(line=>line.trim());
  if(!lines.length)return null;
  const matches=lines.map(line=>line.match(checklistPattern));
  if(matches.some(match=>!match))return null;
  return matches.map(match=>({checked:match[1].toLowerCase()==='x',text:match[2]}));
}
function checklistBody(items=[]){
  return items.filter(item=>item.text.trim()).map(item=>`- [${item.checked?'x':' '}] ${item.text.trim()}`).join('\n');
}
let noteChecklistItems=[];
function readChecklistEditor(){
  return $$('[data-checklist-row]').map(row=>({
    checked:Boolean(row.querySelector('[data-checklist-checked]')?.checked),
    text:row.querySelector('[data-checklist-text]')?.value||''
  }));
}
function renderChecklistEditor(){
  const host=$('#checklistEditor'); if(!host)return;
  if(!noteChecklistItems.length)noteChecklistItems=[{checked:false,text:''}];
  host.innerHTML=noteChecklistItems.map((item,index)=>`<div class="checklist-editor-row" data-checklist-row="${index}"><input data-checklist-checked type="checkbox" ${item.checked?'checked':''} aria-label="Mark item complete"><input data-checklist-text value="${escapeHtml(item.text)}" placeholder="Checklist item" aria-label="Checklist item ${index+1}"><button type="button" class="remove-checklist-item" data-remove-checklist="${index}" aria-label="Remove checklist item">×</button></div>`).join('');
  $$('[data-remove-checklist]',host).forEach(button=>button.onclick=()=>{
    noteChecklistItems=readChecklistEditor();
    noteChecklistItems.splice(+button.dataset.removeChecklist,1);
    renderChecklistEditor();
  });
}
function setupNoteEditor(body=''){
  const toggle=$('#noteChecklist'),textField=$('#entryNotesField'),editor=$('#checklistEditor'),add=$('#addChecklistItem');
  const parsed=parseChecklist(body);
  toggle.checked=Boolean(parsed);
  noteChecklistItems=parsed||String(body).split(/\r?\n/).filter(line=>line.trim()).map(text=>({checked:false,text}));
  if(!noteChecklistItems.length)noteChecklistItems=[{checked:false,text:''}];
  const sync=()=>{
    const checklistMode=toggle.checked;
    textField.hidden=checklistMode;
    editor.hidden=!checklistMode;
    add.hidden=!checklistMode;
    if(checklistMode)renderChecklistEditor();
  };
  toggle.onchange=()=>{
    if(toggle.checked){
      const text=$('#entryNotes').value;
      noteChecklistItems=String(text).split(/\r?\n/).filter(line=>line.trim()).map(line=>({checked:false,text:line}));
      if(!noteChecklistItems.length)noteChecklistItems=[{checked:false,text:''}];
    }else{
      noteChecklistItems=readChecklistEditor();
      $('#entryNotes').value=noteChecklistItems.map(item=>item.text).filter(Boolean).join('\n');
    }
    sync();
  };
  add.onclick=()=>{
    noteChecklistItems=readChecklistEditor();
    noteChecklistItems.push({checked:false,text:''});
    renderChecklistEditor();
    const inputs=$$('[data-checklist-text]');
    inputs[inputs.length-1]?.focus();
  };
  sync();
}
function sortedSharedNotes({includeArchived=false,archivedOnly=false}={}){
  const notes=[...(db.sharedNotes||[])].filter(note=>
    archivedOnly?Boolean(note.archived):includeArchived||!note.archived
  );
  return notes.sort((a,b)=>
    Number(Boolean(b.pinned&&!b.archived))-Number(Boolean(a.pinned&&!a.archived))||
    String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))
  );
}
function noteTrip(note){
  if(!note?.tripId)return null;
  return db.tripSummaries.find(trip=>trip._cloudId===note.tripId)||null;
}
function notesForTrip(trip){
  if(!trip?._cloudId)return [];
  return sortedSharedNotes({includeArchived:true}).filter(note=>note.tripId===trip._cloudId);
}
function noteCardHtml(note,compact=false){
  const index=db.sharedNotes.indexOf(note);
  const preview=(note.body||'').trim();
  const checklist=parseChecklist(preview);
  const previewLimit=compact?3:4;
  const photos=(note.photoUrls||[]).filter(Boolean);
  const shownPhotos=photos.slice(0,compact?1:3);
  const photoContent=shownPhotos.length
    ?`<span class="note-card-photo-strip">${shownPhotos.map((url,i)=>`<span class="note-card-photo"><img src="${escapeHtml(url)}" alt="Picture ${i+1} attached to ${escapeHtml(note.title||'note')}" loading="lazy"></span>`).join('')}${photos.length>shownPhotos.length?`<span class="note-card-photo-count">+${photos.length-shownPhotos.length}</span>`:''}</span>`
    :'';
  const content=checklist
    ?`<div class="note-checklist-preview">${checklist.slice(0,previewLimit).map(item=>`<span><i class="${item.checked?'checked':''}">${item.checked?'✓':''}</i><b class="${item.checked?'completed':''}">${escapeHtml(item.text)}</b></span>`).join('')}${checklist.length>previewLimit?`<em>+${checklist.length-previewLimit} more</em>`:''}</div>`
    :preview?`<p>${escapeHtml(preview)}</p>`:'<p class="note-empty-copy">No text yet.</p>';
  const linkedTrip=noteTrip(note);
  const flags=`${note.archived?'<span class="note-card-archive">▣ ARCHIVED</span>':''}${note.pinned&&!note.archived?'<span class="note-card-pin">◆ PINNED</span>':''}${linkedTrip?`<span class="note-card-trip">◇ ${escapeHtml(linkedTrip.name)}</span>`:''}`;
  return `<button class="note-card${compact?' home-note-card':''}${note.pinned&&!note.archived?' note-card-pinned':''}${note.archived?' note-card-archived':''}" type="button" data-note-index="${index}"><div class="note-card-top"><h3>${escapeHtml(note.title||'Untitled note')}</h3><span>Edit ›</span></div>${flags?`<span class="note-card-flags">${flags}</span>`:''}${content}${photoContent}<small>${noteWhen(note.updatedAt||note.createdAt)?`Updated ${noteWhen(note.updatedAt||note.createdAt)}`:'Shared note'}</small></button>`;
}
function bindNoteCards(host,returnTripIndex=null){
  $$('[data-note-index]',host).forEach(button=>button.onclick=()=>{
    if(returnTripIndex!==null)closeDetailForTransition();
    openEntry('hub-note',+button.dataset.noteIndex,returnTripIndex);
  });
}
function renderNotes(){
  const host=$('#noteList'); if(!host)return;
  const notes=sortedSharedNotes();
  host.innerHTML=notes.map(note=>noteCardHtml(note)).join('')||'<div class="empty">No active notes. Add a new note or restore one from the archive.</div>';
  bindNoteCards(host);
  const archived=sortedSharedNotes({archivedOnly:true});
  const archiveSection=$('#archivedNotesSection');
  const archiveHost=$('#archivedNoteList');
  const archiveCount=$('#archivedNoteCount');
  if(archiveSection&&archiveHost&&archiveCount){
    archiveSection.hidden=!archived.length;
    archiveCount.textContent=archived.length;
    archiveHost.innerHTML=archived.map(note=>noteCardHtml(note)).join('');
    bindNoteCards(archiveHost);
  }
  bindOpeners();
}

function renderHome(){
  const upcoming=db.tripSummaries.filter(isUpcoming).sort((a,b)=>{
    const activeOrder=(tripStatus(a)==='current'?0:1)-(tripStatus(b)==='current'?0:1);
    return activeOrder||tripStamp(a).localeCompare(tripStamp(b));
  });
  const activeTrip=upcoming.find(trip=>tripStatus(trip)==='current');
  const plannedTrips=upcoming.filter(trip=>tripStatus(trip)==='planned').slice(0,2);
  const lastTrip=db.tripSummaries
    .filter(trip=>tripStatus(trip)==='completed')
    .sort((a,b)=>tripDates(b)[1].localeCompare(tripDates(a)[1]))[0];
  const homeTripSquare=(trip,type)=>{
    const labels={last:'LAST TRIP',next:'NEXT TRIP',after:'AFTER THAT'};
    if(!trip)return `<article class="next-trip next-trip-glance next-trip-${type} next-trip-placeholder"><small>${labels[type]}</small><h2>${type==='last'?'No earlier trip':'Nothing planned'}</h2></article>`;
    const [start,end]=tripDates(trip),tripIndex=db.tripSummaries.indexOf(trip),isLast=type==='last';
    const count=isLast?`-${daysSince(end)}`:daysUntil(start);
    return `<button type="button" class="next-trip next-trip-glance next-trip-${type}" data-trip-index="${tripIndex}" aria-label="Open ${escapeHtml(trip.name)} trip"><small>${labels[type]}</small><h2>${escapeHtml(trip.name)}</h2><p>${isLast?'Ended ':''}${date(isLast?end:start)}</p><div class="countdown"><strong>${count}</strong><span>${isLast?'days ago':'days to go'}</span></div><span class="countdown-open">Open ›</span></button>`;
  };
  const activeCard=activeTrip?(()=>{
    const [start,end]=tripDates(activeTrip),progress=tripProgress(activeTrip),tripIndex=db.tripSummaries.indexOf(activeTrip);
    return `<button type="button" class="next-trip next-trip-current" data-trip-index="${tripIndex}" aria-label="Open ${escapeHtml(activeTrip.name)} trip"><small>● ACTIVE TRIP</small><h2>${escapeHtml(activeTrip.name)}</h2><p>${date(start)} – ${date(end)}</p>${rigLineHtml(activeTrip,true)}<div class="countdown"><strong>Day ${progress.day}</strong><span>of ${progress.length}</span></div><span class="countdown-open">Open ›</span></button>`;
  })():'';
  $('#nextTrips').innerHTML=(activeTrip||lastTrip||plannedTrips.length)
    ?activeCard+homeTripSquare(lastTrip,'last')+homeTripSquare(plannedTrips[0],'next')+homeTripSquare(plannedTrips[1],'after')
    :`<article class="next-trip next-trip-empty"><small>NEXT TRIP</small><h2>Nothing planned yet</h2><p>Add the next adventure whenever you're ready.</p><div class="button-row"><button class="secondary" data-open="trip">Add a trip</button></div></article>`;
  $('#upcomingList').innerHTML=upcoming.slice(0,3).map(t=>{const [s,e]=tripDates(t),tripIndex=db.tripSummaries.indexOf(t);return `<button class="list-item" data-trip-index="${tripIndex}"><div class="date-box"><small>${new Date(s+'T12:00:00').toLocaleDateString(undefined,{month:'short'})}</small><b>${new Date(s+'T12:00:00').getDate()}</b></div><div class="item-copy"><h3>${escapeHtml(t.name)}</h3><p>${date(s)} – ${date(e)}</p>${rigLineHtml(t,true)}</div><span class="item-chevron">›</span></button>`}).join('')||'<div class="empty">No upcoming trips yet.</div>';
  const sortedNotes=sortedSharedNotes();
  const pinnedNotes=sortedNotes.filter(note=>note.pinned);
  const recentNotes=[...pinnedNotes,...sortedNotes.filter(note=>!note.pinned).slice(0,Math.max(0,3-pinnedNotes.length))];
  $('#recentNotes').innerHTML=recentNotes.map(note=>noteCardHtml(note,true)).join('')||'<div class="empty">New notes will appear here.</div>';
  bindNoteCards($('#recentNotes'));
  const recent=[];
  db.fuel.forEach((x,index)=>recent.push({type:'Fuel',kind:'fuel',index,icon:'⛽',title:x.station||'Fuel stop',sub:`${date(x.date)} · ${money(x.total)}`,stamp:x.date||''}));
  db.def.forEach((x,index)=>recent.push({type:'DEF',kind:'def',index,icon:'💧',title:x.station||'DEF purchase',sub:`${date(x.date)} · ${number(x.gallons,2)} gal · ${money(x.total)}`,stamp:x.date||''}));
  db.phillisMaintenance.forEach((x,index)=>recent.push({type:'Phillis',kind:'phillis',index,icon:'🔧',title:x.description||'Maintenance',sub:`${date(x.date)} · ${escapeHtml(x.trailer||'Phillis')} · ${money(x.price)}`,stamp:x.date||''}));
  db.rubyMaintenance.forEach((x,index)=>recent.push({type:'Ruby',kind:'ruby',index,icon:'🛻',title:x.description||'Maintenance',sub:`${date(x.date)} · ${money(x.price)}`,stamp:x.date||''}));
  $('#recentRecords').innerHTML=recent.sort((a,b)=>b.stamp.localeCompare(a.stamp)).slice(0,3).map(r=>`<button class="record-item record-link" type="button" data-recent-record-kind="${r.kind}" data-recent-record-index="${r.index}" aria-label="Open ${escapeHtml(r.title)}"><span class="record-icon">${r.icon}</span><div class="item-copy"><h3>${escapeHtml(r.title)}</h3><p>${r.sub}</p></div><span class="recent-record-end"><span class="pill">${r.type}</span><span class="record-chevron">›</span></span></button>`).join('')||'<div class="empty">New entries will appear here.</div>';
  $$('[data-recent-record-kind]',$('#recentRecords')).forEach(button=>button.onclick=()=>{
    const index=+button.dataset.recentRecordIndex;
    if(button.dataset.recentRecordKind==='fuel')showFuelRecord(index);
    if(button.dataset.recentRecordKind==='def')showDefRecord(index);
    if(button.dataset.recentRecordKind==='phillis')showPhillisRecord('phillisMaintenance',index,'phillis-maint','phillis-maintenance');
    if(button.dataset.recentRecordKind==='ruby')showRubyRecord('rubyMaintenance',index,'ruby-maint','ruby-maintenance');
  });
  bindTripButtons(); bindOpeners();
}
function initYears(){
  const years=[...new Set(db.tripSummaries.map(t=>t.year))].sort((a,b)=>b-a);
  const selected=$('#tripYear').value||'all';
  $('#tripYear').innerHTML='<option value="all">All years</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
  $('#tripYear').value=years.includes(+selected)?selected:'all';
}
const openTripYears=new Set();
let travelLogMode='trips';
const campgroundPlaceTypeLabel=value=>({
  campground:'Campground',
  harvest_host:'Harvest Host',
  'harvest-host':'Harvest Host',
  moochdocking:'Moochdocking',
  boondocking:'Boondocking',
  other:'Other'
}[value]||'Campground');
const campgroundIdentity=value=>[
  String(value?.name||'').trim().toLowerCase(),
  String(value?.city||'').trim().toLowerCase(),
  String(value?.state||'').trim().toUpperCase()
].join('|');
function campgroundVisits(campground){
  const identity=campgroundIdentity(campground);
  return db.stays
    .filter(stay=>stay.arrival!=='Season'&&(
      (stay._campgroundId&&campground._cloudId&&stay._campgroundId===campground._cloudId)
      ||(!stay._campgroundId&&campgroundIdentity(stay)===identity)
    ))
    .sort((a,b)=>String(b.arrival||'').localeCompare(String(a.arrival||'')));
}
function campgroundLocation(campground,full=false){
  return full
    ?[campground.address,campground.city,campground.state,campground.zip].filter(Boolean).join(', ')
    :[campground.city,campground.state].filter(Boolean).join(', ');
}
function updateTravelLogModeUi(){
  const viewer=window.ADVENTURE_HUB_CLOUD?.role==='viewer';
  if(viewer)travelLogMode='trips';
  $('#travelLogSwitch').hidden=viewer;
  const showingCampgrounds=travelLogMode==='campgrounds';
  $('#travelLogKicker').textContent=showingCampgrounds?'PLACES WE HAVE STAYED':'YOUR TRAVEL LOG';
  $('#travelLogTitle').textContent=showingCampgrounds?'Campground Log':'Trips';
  $('#travelLogAddTrip').hidden=showingCampgrounds;
  $('#tripFilters').hidden=showingCampgrounds;
  $('#campgroundFilters').hidden=!showingCampgrounds;
  $('#tripList').hidden=showingCampgrounds;
  $('#campgroundList').hidden=!showingCampgrounds;
  $$('[data-travel-log-mode]').forEach(button=>{
    const active=button.dataset.travelLogMode===travelLogMode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function setTravelLogMode(mode){
  travelLogMode=mode==='campgrounds'?'campgrounds':'trips';
  updateTravelLogModeUi();
  renderTrips();
}
function campgroundCardHtml(campground){
  const index=db.campgrounds.indexOf(campground);
  const visits=campgroundVisits(campground);
  const latest=visits[0];
  const photo=latest?.signPhotoUrl||latest?.sitePhotoUrl||'';
  const completed=visits.filter(stay=>stay.journalCompletedAt).length;
  const location=campgroundLocation(campground)||'Location not recorded';
  const lastVisit=latest?.arrival?`Last stayed ${date(latest.arrival)}`:'No visit date';
  return `<article class="campground-log-card" data-campground-index="${index}" tabindex="0" aria-label="Open ${escapeHtml(campground.name)} campground log"><div class="campground-log-thumb">${photo?`<img src="${escapeHtml(photo)}" alt="" loading="lazy">`:'<span aria-hidden="true">⌂</span>'}</div><div class="campground-log-copy"><small>${escapeHtml(campgroundPlaceTypeLabel(campground.placeType))}</small><h3>${escapeHtml(campground.name)}</h3><p>${escapeHtml(location)}</p><div class="campground-log-meta"><span>${visits.length} ${visits.length===1?'visit':'visits'}</span><span>${escapeHtml(lastVisit)}</span>${completed?`<span>${completed} ${completed===1?'log':'logs'} completed</span>`:''}</div></div><span class="campground-log-chevron" aria-hidden="true">›</span></article>`;
}
function renderCampgroundLog(){
  updateTravelLogModeUi();
  const q=$('#campgroundSearch').value.trim().toLowerCase();
  const sort=$('#campgroundSort').value;
  const campgrounds=(db.campgrounds||[]).filter(campground=>{
    const haystack=[campground.name,campground.address,campground.city,campground.state,campground.zip,campgroundPlaceTypeLabel(campground.placeType)].join(' ').toLowerCase();
    return !q||haystack.includes(q);
  });
  campgrounds.sort((a,b)=>{
    const aVisits=campgroundVisits(a),bVisits=campgroundVisits(b);
    if(sort==='name')return String(a.name||'').localeCompare(String(b.name||''));
    if(sort==='visits')return bVisits.length-aVisits.length||String(a.name||'').localeCompare(String(b.name||''));
    return String(bVisits[0]?.arrival||'').localeCompare(String(aVisits[0]?.arrival||''))||String(a.name||'').localeCompare(String(b.name||''));
  });
  $('#campgroundList').innerHTML=campgrounds.map(campgroundCardHtml).join('')||'<div class="empty">No campgrounds or hosts found.</div>';
  $$('[data-campground-index]',$('#campgroundList')).forEach(card=>{
    const open=()=>showCampgroundProfile(+card.dataset.campgroundIndex);
    card.onclick=open;
    card.onkeydown=event=>{
      if(!['Enter',' '].includes(event.key))return;
      event.preventDefault();
      open();
    };
  });
}
function showCampgroundProfile(index){
  const campground=db.campgrounds[index]; if(!campground)return;
  detailReturnTripIndex=null;
  const visits=campgroundVisits(campground);
  const completed=visits.filter(stay=>stay.journalCompletedAt).length;
  const profile={...campground,zip:campground.zip||campground.postalCode||''};
  const location=campgroundLocation(profile,true);
  setDetailHeader('CAMPGROUND LOG',campground.name,null,location?`<p class="detail-header-dates">${escapeHtml(campgroundLocation(profile))}</p>`:'');
  const contact=[campground.phone?`<div class="detail-row"><span>Phone</span><span>${escapeHtml(campground.phone)}</span></div>`:'',campground.websiteUrl?`<div class="detail-row"><span>Website</span><a class="text-button" href="${escapeHtml(campground.websiteUrl)}" target="_blank" rel="noopener">Open website ↗</a></div>`:''].join('');
  $('#detailBody').innerHTML=`<div class="campground-profile-summary"><div><small>VISIT HISTORY</small><b>${visits.length}</b><span>${visits.length===1?'stay':'stays'}</span></div><div><small>COMPLETED LOGS</small><b>${completed}</b><span>${completed===1?'entry':'entries'}</span></div></div>${location?`<div class="detail-section"><h3>Location</h3>${stayLocationHtml(profile,{full:true})}${contact}</div>`:''}<div class="detail-section"><h3>Our visits</h3><p class="campground-profile-help">Open a visit to complete or edit its detailed campground log.</p><div class="stay-listing-stack">${visits.map(stay=>stayListing(stay)).join('')||'<p class="intro">No visits are linked yet.</p>'}</div></div>`;
  bindStayPhotoButtons($('#detailBody'));
  bindStayMapLinks($('#detailBody'));
  bindStayCards($('#detailBody'));
  $('#detailDialog').showModal();
}
function tripStayNights(stay){
  if(Number.isFinite(Number(stay.nights))) return Number(stay.nights);
  const arrival=stay.arrival&&stay.arrival!=='Season'?new Date(stay.arrival+'T12:00:00'):null;
  const departure=stay.departure&&stay.departure!=='Season'?new Date(stay.departure+'T12:00:00'):null;
  return arrival&&departure?Math.max(0,Math.round((departure-arrival)/86400000)):0;
}
function nextPlannedTrip(){
  return db.tripSummaries
    .filter(t=>tripStatus(t)==='planned')
    .sort((a,b)=>tripStamp(a).localeCompare(tripStamp(b)))[0]||null;
}
function tripCardHtml(t){
  const [s,e]=tripDates(t),stays=matchingStays(t),tripIndex=db.tripSummaries.indexOf(t);
  const stayCost=stays.reduce((sum,stay)=>sum+(Number(stay.price)||0),0);
  const nights=stays.reduce((sum,stay)=>sum+tripStayNights(stay),0);
  const status=tripStatus(t);
  const isNext=status==='planned'&&nextPlannedTrip()===t;
  const visualStatus=status==='current'?'current':isNext?'next':status;
  const statusLabel=status==='current'?'CURRENT':isNext?'NEXT TRIP':status==='planned'?'PLANNED':'COMPLETED';
  return `<article class="trip-item trip-item-${visualStatus}" data-trip-index="${tripIndex}"><div class="trip-top"><div class="trip-card-heading"><div class="trip-card-title"><small class="pill trip-status-pill trip-status-${visualStatus}">${statusLabel}</small><h3>${escapeHtml(t.name)}</h3><div class="trip-meta">${tripHasDates(t)?`${date(s)} – ${date(e)}`:String(t.year)}</div>${rigLineHtml(t)}</div>${tripPhotoHtml(t)}</div><span>›</span></div><div class="trip-numbers"><div><small>Miles</small><b>${number(t.distance,1)}</b></div><div><small>Fuel</small><b>${money(t.cost)}</b></div><div><small>MPG</small><b>${number(t.mpg,2)}</b></div><div><small>Stay cost</small><b>${money(stayCost)}</b></div><div><small>Nights</small><b>${nights}</b></div><div><small>Stays</small><b>${stays.length}</b></div></div></article>`;
}
function yearTotals(trips){
  const allStays=trips.flatMap(matchingStays);
  const distance=trips.reduce((sum,t)=>sum+(Number(t.distance)||0),0);
  const gallons=trips.reduce((sum,t)=>sum+(Number(t.gallons)||0),0);
  const fuel=trips.reduce((sum,t)=>sum+(Number(t.cost)||0),0);
  const stayCost=allStays.reduce((sum,stay)=>sum+(Number(stay.price)||0),0);
  const nights=allStays.reduce((sum,stay)=>sum+tripStayNights(stay),0);
  return {distance,gallons,fuel,stayCost,nights,stays:allStays.length,mpg:gallons>0?distance/gallons:null};
}
function renderTrips(){
  updateTravelLogModeUi();
  if(travelLogMode==='campgrounds'){
    renderCampgroundLog();
    return;
  }
  initYears();
  const q=$('#tripSearch').value.trim().toLowerCase(), y=$('#tripYear').value;
  const trips=db.tripSummaries.filter(t=>(y==='all'||String(t.year)===y)&&t.name.toLowerCase().includes(q)).sort((a,b)=>{
    const byDate=tripStamp(b).localeCompare(tripStamp(a));
    if(byDate) return byDate;
    const byYear=Number(b.year||0)-Number(a.year||0);
    return byYear||b.name.localeCompare(a.name);
  });
  const groups=new Map();
  trips.forEach(t=>{const year=Number(t.year)||new Date(tripDates(t)[0]+'T12:00:00').getFullYear();if(!groups.has(year))groups.set(year,[]);groups.get(year).push(t)});
  const years=[...groups.keys()].sort((a,b)=>b-a);
  if(q) years.forEach(year=>openTripYears.add(year));
  $('#tripList').innerHTML=years.map(year=>{
    const yearTrips=groups.get(year), totals=yearTotals(yearTrips), expanded=openTripYears.has(year);
    return `<section class="trip-year-group ${expanded?'is-open':''}" data-trip-year-group="${year}"><button class="trip-year-card" type="button" data-trip-year-toggle="${year}" aria-expanded="${expanded}"><div class="trip-year-heading"><div><small>TRAVEL YEAR</small><h2>${year}</h2><p>${yearTrips.length} ${yearTrips.length===1?'trip':'trips'} · ${totals.nights} nights</p></div><span class="year-chevron">⌄</span></div><div class="trip-year-numbers"><div><small>Miles</small><b>${number(totals.distance,1)}</b></div><div><small>Fuel</small><b>${money(totals.fuel)}</b></div><div><small>MPG</small><b>${number(totals.mpg,2)}</b></div><div><small>Stay cost</small><b>${money(totals.stayCost)}</b></div><div><small>Nights</small><b>${totals.nights}</b></div><div><small>Stays</small><b>${totals.stays}</b></div></div></button><div class="trip-year-content" ${expanded?'':'hidden'}>${yearTrips.map(tripCardHtml).join('')}</div></section>`;
  }).join('')||'<div class="empty">No trips found.</div>';
  $$('[data-trip-year-toggle]').forEach(button=>button.onclick=()=>{const year=Number(button.dataset.tripYearToggle);openTripYears.has(year)?openTripYears.delete(year):openTripYears.add(year);renderTrips()});
  bindTripButtons();
}
$('#tripSearch').addEventListener('input',renderTrips); $('#tripYear').addEventListener('change',renderTrips);
$('#campgroundSearch').addEventListener('input',renderCampgroundLog);
$('#campgroundSort').addEventListener('change',renderCampgroundLog);
$$('[data-travel-log-mode]').forEach(button=>button.onclick=()=>setTravelLogMode(button.dataset.travelLogMode));
function matchingStays(t){
  const [start,end]=tripDates(t);
  if(tripHasDates(t)){
    return db.stays.filter(stay=>{
      if(stay.arrival==='Season') return false;
      const arrival=stay.arrival||'';
      const departure=stay.departure||arrival;
      return arrival<=end && departure>=start;
    }).sort((a,b)=>String(b.arrival||'').localeCompare(String(a.arrival||''))||String(b.departure||'').localeCompare(String(a.departure||'')));
  }
  return [];
}
function matchingFuel(t){
  return db.fuel
    .filter(f=>(f._tripId&&t._cloudId&&f._tripId===t._cloudId)||f.trip===t.name||(f.date&&+f.date.slice(0,4)===+t.year&&f.trip?.toLowerCase().includes(t.name.toLowerCase())))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.odometer||0)-Number(a.odometer||0));
}
function matchingDef(t){
  return db.def
    .filter(record=>(record._tripId&&t._cloudId&&record._tripId===t._cloudId)||record.trip===t.name)
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.odometer||0)-Number(a.odometer||0));
}
function cumulativeTripDistance(rows){
  return rows.reduce((greatest,row)=>Math.max(greatest,Number(row.tripMiles)||0),0);
}
const fuelLocation=record=>[record.city,record.state].filter(Boolean).join(', ')||record.location||'';
const campgroundHookupChoices=[
  ['full_all','Full hookups · all sites'],
  ['full_some','Full hookups · some sites'],
  ['water_electric','Water and electric'],
  ['electric_only','Electric only'],
  ['dry','Dry camping'],
  ['dump_station','Dump station']
];
const campgroundAmenityChoices=[
  ['pool','Swimming pool'],
  ['hot_tub','Hot tub'],
  ['lodge_game_room','Lodge / game room'],
  ['adult_center','Adult center'],
  ['laundry','Laundry'],
  ['restaurant','Restaurant'],
  ['pickleball','Pickleball'],
  ['mini_golf','Mini golf'],
  ['pet_friendly','Pet-friendly'],
  ['dog_park','Dog park'],
  ['hiking','Hiking'],
  ['canoeing','Canoeing / kayaking'],
  ['fishing','Fishing'],
  ['horseback_riding','Horseback riding'],
  ['fitness_center','Fitness center']
];
const internetSourceChoices=[
  ['campground_wifi','Campground Wi-Fi'],
  ['travlfi','TravlFi'],
  ['starlink','Starlink'],
  ['none','None used']
];
const journalCheckboxGrid=(name,choices,selected=[])=>{
  const values=new Set(Array.isArray(selected)?selected:[]);
  return `<div class="campground-journal-checks">${choices.map(([value,label])=>`<label><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${values.has(value)?'checked':''}><span>${escapeHtml(label)}</span></label>`).join('')}</div>`;
};
const journalBoolean=(id,label,checked=false)=>`<label class="campground-journal-boolean"><input id="${id}" type="checkbox" ${checked?'checked':''}><span>${escapeHtml(label)}</span></label>`;
const journalRatingOptions=value=>`<option value="">Not rated</option>${[
  [1,'1 · Poor'],
  [2,'2 · Fair'],
  [3,'3 · Good'],
  [4,'4 · Very good'],
  [5,'5 · Excellent']
].map(([rating,label])=>`<option value="${rating}" ${Number(value)===rating?'selected':''}>${label}</option>`).join('')}`;
function campgroundForStay(stay){
  if(!stay)return null;
  return (db.campgrounds||[]).find(campground=>campground._cloudId&&campground._cloudId===stay._campgroundId)
    ||(db.campgrounds||[]).find(campground=>campgroundIdentity(campground)===campgroundIdentity(stay))
    ||null;
}
function journalSelectedValues(name){
  return $$(`input[name="${name}"]:checked`,$('#campgroundJournalDialog')).map(input=>input.value);
}
function campsiteLogSummary(stay){
  const campsite=stay?.journalData?.campsite||{};
  return [
    stay.site?`Site ${stay.site}`:'',
    campsite.electrical||'',
    campsite.hookups||'',
    campsite.level||'',
    campsite.surface||'',
    campsite.size||'',
    campsite.shade||'',
    campsite.noise||''
  ].filter(Boolean).join(' · ');
}
function campgroundJournalStatus(stay){
  if(stay.journalCompletedAt)return {label:'Completed',tone:'complete',button:'View / edit campground log'};
  if(stay.journalData&&Object.keys(stay.journalData).length)return {label:'Draft',tone:'draft',button:'Continue campground log'};
  return {label:'Not started',tone:'empty',button:'Complete campground log'};
}
function campgroundJournalCallout(stay){
  const status=campgroundJournalStatus(stay);
  const summary=campsiteLogSummary(stay);
  const rating=Number(stay.overallRating)||0;
  return `<section class="campground-journal-callout campground-journal-callout-${status.tone}"><div class="campground-journal-callout-heading"><div><small>CAMPGROUND LOG</small><h3>${escapeHtml(status.label)}</h3></div>${rating?`<span class="campground-rating" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</span>`:''}</div>${summary?`<p>${escapeHtml(summary)}</p>`:''}<button class="secondary" id="openCampgroundJournalButton" type="button">${escapeHtml(status.button)}</button></section>`;
}
function openCampgroundJournal(stayIndex){
  const stay=db.stays[stayIndex]; if(!stay)return;
  const campground=campgroundForStay(stay);
  if(!campground){
    alert('This stay is not connected to its campground profile yet. Refresh the Journal and try again.');
    return;
  }
  const profile=campground.profileData&&typeof campground.profileData==='object'?campground.profileData:{};
  const facilities=profile.facilities||{};
  const bathhouse=facilities.bathhouse||{};
  const access=profile.access||{};
  const journal=stay.journalData&&typeof stay.journalData==='object'?stay.journalData:{};
  const campsite=journal.campsite||{};
  const localArea=journal.localArea||{};
  const connectivity=journal.connectivity||{};
  $('#campgroundJournalStayIndex').value=String(stayIndex);
  $('#campgroundJournalTitle').textContent=stay.name;
  $('#campgroundJournalSubtitle').textContent=`${date(stay.arrival)} – ${date(stay.departure)}${stay.site?` · Site ${stay.site}`:''}`;
  $('#campgroundJournalComplete').checked=Boolean(stay.journalCompletedAt);
  $('#campgroundJournalBody').innerHTML=`
    <section class="campground-journal-lead">
      <div class="campground-journal-rating-row">
        <label>Overall rating<select id="journalOverallRating">${journalRatingOptions(stay.overallRating)}</select></label>
        <label>Would we return?<select id="journalWouldReturn"><option value="" ${stay.wouldReturn==null?'selected':''}>Not answered</option><option value="yes" ${stay.wouldReturn===true?'selected':''}>Yes</option><option value="no" ${stay.wouldReturn===false?'selected':''}>No</option></select></label>
      </div>
      <label>Our notes<textarea id="journalOurNotes" rows="7" placeholder="The story of this stay, what stood out, and anything you want to remember…">${escapeHtml(journal.ourNotes||stay.notes||'')}</textarea></label>
    </section>

    <details class="campground-journal-section" open>
      <summary><span><small>PERMANENT PROFILE</small><b>Campground & facilities</b></span><i>⌄</i></summary>
      <div class="campground-journal-section-body">
        <p class="campground-journal-help">These details carry forward when you return to this campground or host.</p>
        <fieldset><legend>Hookups</legend>${journalCheckboxGrid('journalCampgroundHookups',campgroundHookupChoices,facilities.hookups)}</fieldset>
        <fieldset><legend>Bathhouse</legend>
          <div class="campground-journal-checks compact">
            ${journalBoolean('journalFlushToilets','Flush toilets',bathhouse.flushToilets)}
            ${journalBoolean('journalShowers','Showers',bathhouse.showers)}
            ${journalBoolean('journalFreeShowers','Free showers',bathhouse.freeShowers)}
            ${journalBoolean('journalQuarterShowers','Quarter-operated showers',bathhouse.quarterShowers)}
            ${journalBoolean('journalHotWater','Hot water',bathhouse.hotWater)}
          </div>
          <div class="campground-journal-two"><label>Cleanliness<select id="journalBathhouseCleanliness">${journalRatingOptions(bathhouse.cleanliness)}</select></label><label>Bathhouse notes<input id="journalBathhouseNotes" value="${escapeHtml(bathhouse.notes||'')}"></label></div>
        </fieldset>
        <fieldset><legend>Amenities</legend>${journalCheckboxGrid('journalAmenities',campgroundAmenityChoices,facilities.amenities)}<label>Other amenities<input id="journalOtherAmenities" value="${escapeHtml(facilities.otherAmenities||'')}" placeholder="Anything else worth remembering"></label></fieldset>
        <label>Management, booking, and cancellation notes<textarea id="journalBookingNotes" rows="3">${escapeHtml(profile.bookingNotes||'')}</textarea></label>
        <label>Scenery<textarea id="journalScenery" rows="2">${escapeHtml(profile.scenery||'')}</textarea></label>
        <fieldset><legend>Maneuvering and access</legend>
          <div class="campground-journal-checks compact">
            ${journalBoolean('journalTightRoads','Tight roads or turns',access.tightRoads)}
            ${journalBoolean('journalLowTrees','Low trees',access.lowTrees)}
            ${journalBoolean('journalBadRoads','Rough or bad roads',access.badRoads)}
          </div>
          <label>Parking and access notes<textarea id="journalAccessNotes" rows="3">${escapeHtml(access.notes||'')}</textarea></label>
        </fieldset>
      </div>
    </details>

    <details class="campground-journal-section">
      <summary><span><small>THIS VISIT</small><b>Our campsite</b></span><i>⌄</i></summary>
      <div class="campground-journal-section-body">
        <div class="campground-journal-two">
          <label>Hookups<select id="journalSiteHookups"><option value="">Not recorded</option>${['Full hookups','Water / electric','Electric only','Dry'].map(value=>`<option ${campsite.hookups===value?'selected':''}>${value}</option>`).join('')}</select></label>
          <label>Electrical service<select id="journalSiteElectrical"><option value="">Not recorded</option>${['50 amp','30 amp','20 amp','None'].map(value=>`<option ${campsite.electrical===value?'selected':''}>${value}</option>`).join('')}</select></label>
          <label>Pad level<select id="journalSiteLevel"><option value="">Not recorded</option>${['Level','Slightly unlevel','Unlevel'].map(value=>`<option ${campsite.level===value?'selected':''}>${value}</option>`).join('')}</select></label>
          <label>Surface<select id="journalSiteSurface"><option value="">Not recorded</option>${['Concrete','Paved','Gravel','Grass','Dirt','Rock / grass','Mixed','Other'].map(value=>`<option ${campsite.surface===value?'selected':''}>${value}</option>`).join('')}</select></label>
          <label>Site size<select id="journalSiteSize"><option value="">Not recorded</option>${['Tight','Average','Spacious'].map(value=>`<option ${campsite.size===value?'selected':''}>${value}</option>`).join('')}</select></label>
          <label>Shade<select id="journalSiteShade"><option value="">Not recorded</option>${['None','Some shade','Heavy shade'].map(value=>`<option ${campsite.shade===value?'selected':''}>${value}</option>`).join('')}</select></label>
        </div>
        <div class="campground-journal-checks compact">
          ${journalBoolean('journalFireRing','Fire ring',campsite.fireRing)}
          ${journalBoolean('journalFiresAllowed','Fires allowed',campsite.firesAllowed)}
          ${journalBoolean('journalPicnicTable','Picnic table',campsite.picnicTable)}
          ${journalBoolean('journalCloseAmenities','Close to amenities',campsite.closeToAmenities)}
        </div>
        <label>View<input id="journalSiteView" value="${escapeHtml(campsite.view||'')}"></label>
        <label>Noise<input id="journalSiteNoise" value="${escapeHtml(campsite.noise||'')}" placeholder="Quiet, road noise, train noise…"></label>
        <label>Wildlife and bugs<input id="journalWildlife" value="${escapeHtml(campsite.wildlife||'')}"></label>
        <label>Campsite notes<textarea id="journalCampsiteNotes" rows="4">${escapeHtml(campsite.notes||'')}</textarea></label>
      </div>
    </details>

    <details class="campground-journal-section">
      <summary><span><small>THIS VISIT</small><b>Local area</b></span><i>⌄</i></summary>
      <div class="campground-journal-section-body">
        <label>Weather<textarea id="journalWeather" rows="2">${escapeHtml(localArea.weather||'')}</textarea></label>
        <label>Sightseeing<textarea id="journalSightseeing" rows="3">${escapeHtml(localArea.sightseeing||'')}</textarea></label>
        <label>Restaurants<textarea id="journalRestaurants" rows="3">${escapeHtml(localArea.restaurants||'')}</textarea></label>
        <label>Grocery distance and notes<textarea id="journalGrocery" rows="2">${escapeHtml(localArea.grocery||'')}</textarea></label>
        <label>Places visited<textarea id="journalPlacesVisited" rows="3">${escapeHtml(localArea.placesVisited||'')}</textarea></label>
        <label>Next time<textarea id="journalNextTime" rows="3">${escapeHtml(localArea.nextTime||'')}</textarea></label>
      </div>
    </details>

    <details class="campground-journal-section">
      <summary><span><small>THIS VISIT</small><b>Connectivity</b></span><i>⌄</i></summary>
      <div class="campground-journal-section-body">
        <div class="campground-journal-two">
          <label>Campground Wi-Fi<select id="journalWifiAvailable"><option value="">Not recorded</option><option value="yes" ${connectivity.campgroundWifiAvailable===true?'selected':''}>Available</option><option value="no" ${connectivity.campgroundWifiAvailable===false?'selected':''}>Not available</option></select></label>
          <label>Wi-Fi quality<select id="journalWifiRating">${journalRatingOptions(connectivity.wifiRating)}</select></label>
          <label>Mobile service<select id="journalMobileService"><option value="">Not recorded</option>${['None','Poor','Fair','Good','Excellent'].map(value=>`<option ${connectivity.mobileService===value?'selected':''}>${value}</option>`).join('')}</select></label>
        </div>
        <fieldset><legend>Internet used</legend>${journalCheckboxGrid('journalInternetUsed',internetSourceChoices,connectivity.internetUsed)}</fieldset>
        <label>Connectivity notes<textarea id="journalConnectivityNotes" rows="3">${escapeHtml(connectivity.notes||'')}</textarea></label>
      </div>
    </details>`;
  $$('input[name="journalInternetUsed"]',$('#campgroundJournalDialog')).forEach(input=>input.onchange=()=>{
    if(!input.checked)return;
    const choices=$$('input[name="journalInternetUsed"]',$('#campgroundJournalDialog'));
    if(input.value==='none')choices.forEach(choice=>{if(choice!==input)choice.checked=false;});
    else choices.find(choice=>choice.value==='none')?.removeAttribute('checked');
    if(input.value!=='none'){
      const none=choices.find(choice=>choice.value==='none');
      if(none)none.checked=false;
    }
  });
  $('#campgroundJournalDialog').showModal();
}
function showStay(index,tripIndex=null){
  const stay=db.stays[index]; if(!stay)return;
  detailReturnTripIndex=tripIndex;
  const viewer=window.ADVENTURE_HUB_CLOUD?.role==='viewer';
  const type=stay.harvestHost||stay.stayType==='harvest-host'?'HARVEST HOST':stay.moochdocking||stay.stayType==='moochdocking'?'MOOCHDOCKING':stay.boondocking||stay.stayType==='boondocking'?'BOONDOCKING':'CAMPGROUND';
  const headerMeta=`<p class="detail-header-dates">${date(stay.arrival)} – ${date(stay.departure)}</p>`;
  setDetailHeader(type,stay.name,null,headerMeta);
  const actions=`<div class="record-detail-actions stay-detail-actions">${tripIndex!==null?'<button class="text-button" id="backToTripButton">← Back to trip</button>':''}${viewer?'':'<button class="primary" id="editStayButton">Edit stay</button>'}</div>`;
  const photos=stayPhotoGallery(stay);
  $('#detailBody').innerHTML=`${actions}<div class="detail-section"><div class="detail-row"><span>Arrival</span><span>${date(stay.arrival)}${stay.checkInTime?` · ${clockTime(stay.checkInTime)}`:''}</span></div><div class="detail-row"><span>Departure</span><span>${date(stay.departure)}${stay.checkOutTime?` · ${clockTime(stay.checkOutTime)}`:''}</span></div>${stay.site?`<div class="detail-row"><span>Site</span><span>${escapeHtml(stay.site)}</span></div>`:''}${viewer?'':`<div class="detail-row"><span>Stay cost</span><span>${money(stay.price)}</span></div>`}<div class="stay-detail-location"><small>LOCATION</small>${stayLocationHtml(stay,{full:true})}</div>${photos?`<div class="stay-detail-photos"><small>PHOTOS</small>${photos}</div>`:''}${stay.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(stay.notes)}</p></div>`:''}</div>${viewer?'':campgroundJournalCallout(stay)}`;
  if(tripIndex!==null)$('#backToTripButton').onclick=()=>$('#detailDialog').close();
  if(!viewer)$('#editStayButton').onclick=()=>{closeDetailForTransition();openEntry('stay',index,tripIndex)};
  if(!viewer)$('#openCampgroundJournalButton').onclick=()=>openCampgroundJournal(index);
  bindStayPhotoButtons($('#detailBody'));
  bindStayMapLinks($('#detailBody'));
  if(!$('#detailDialog').open)$('#detailDialog').showModal();
}
function refreshTripFuelSummaries(){
  db.tripSummaries.forEach(trip=>{
    const rows=matchingFuel(trip);
    const distance=cumulativeTripDistance(rows);
    const gallons=rows.reduce((sum,row)=>sum+(Number(row.gallons)||0),0);
    const cost=rows.reduce((sum,row)=>sum+(Number(row.total)||0),0);
    trip.distance=distance||null;
    trip.gallons=gallons;
    trip.cost=cost;
    trip.mpg=distance&&gallons?distance/gallons:null;
  });
}
const planTypeLabel=value=>({
  activity:'Activity',
  tour:'Tour',
  reservation:'Reservation',
  dining:'Dining',
  transportation:'Transportation',
  other:'Other'
}[value]||'Activity');
const planStatusLabel=value=>({
  planned:'Planned',
  reserved:'Reserved',
  paid:'Paid',
  completed:'Completed',
  cancelled:'Cancelled'
}[value]||'Planned');
function plansForTrip(trip){
  if(!trip?._cloudId)return [];
  return (db.tripPlans||[])
    .filter(plan=>plan._tripId===trip._cloudId)
    .sort((a,b)=>`${b.date||''}T${b.startTime||'23:59'}`.localeCompare(`${a.date||''}T${a.startTime||'23:59'}`)||(a.title||'').localeCompare(b.title||''));
}
function planLocationHtml(plan,{full=false}={}){
  const mapAddress=[plan.address,plan.city,plan.state,plan.zip].filter(Boolean).join(', ');
  const displayLocation=full?mapAddress:([plan.locationName,[plan.city,plan.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')||mapAddress);
  if(!displayLocation)return '';
  if(!mapAddress)return `<p class="plan-card-location">${escapeHtml(displayLocation)}</p>`;
  const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`;
  return `<p class="plan-card-location"><a class="stay-address-link" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener" data-map-address="${escapeHtml(mapAddress)}" aria-label="Open ${escapeHtml(mapAddress)} in Google Maps"><span aria-hidden="true">⌖</span>${escapeHtml(displayLocation)}</a></p>`;
}
function planTimeLine(plan){
  const times=[plan.startTime?clockTime(plan.startTime):'',plan.endTime?clockTime(plan.endTime):''].filter(Boolean);
  return `${date(plan.date)}${times.length?` · ${times.join(' – ')}`:''}`;
}
function planCardHtml(plan,{viewer=false}={}){
  const index=db.tripPlans.indexOf(plan);
  const body=`<div class="plan-card-copy"><span class="plan-card-flags"><small>${escapeHtml(planTypeLabel(plan.planType))}</small><small class="plan-status plan-status-${escapeHtml(plan.status||'planned')}">${escapeHtml(planStatusLabel(plan.status))}</small></span><h4>${escapeHtml(plan.title||'Untitled plan')}</h4><p>${escapeHtml(planTimeLine(plan))}</p>${planLocationHtml(plan)}${!viewer&&plan.confirmationCode?`<span class="plan-confirmation">Confirmation ${escapeHtml(plan.confirmationCode)}</span>`:''}</div>${!viewer?`<div class="plan-card-end"><b>${money(plan.cost||0)}</b><span aria-hidden="true">›</span></div>`:''}`;
  return viewer
    ?`<article class="plan-listing-card viewer-plan-card">${body}</article>`
    :`<button class="plan-listing-card" type="button" data-trip-plan-index="${index}">${body}</button>`;
}
function bindPlanCards(root,returnTripIndex){
  $$('[data-trip-plan-index]',root).forEach(button=>button.onclick=()=>{
    closeDetailForTransition();
    showPlanRecord(+button.dataset.tripPlanIndex,returnTripIndex);
  });
}
function bindTripButtons(){$$('[data-trip-index]').forEach(b=>b.onclick=()=>showTrip(+b.dataset.tripIndex))}
function tripPurchaseRows(trip,fuelRows,defRows){
  const rows=[
    ...fuelRows.map(record=>({kind:'fuel',record,index:db.fuel.indexOf(record)})),
    ...defRows.map(record=>({kind:'def',record,index:db.def.indexOf(record)}))
  ].sort((a,b)=>String(b.record.date||'').localeCompare(String(a.record.date||''))||Number(b.record.odometer||0)-Number(a.record.odometer||0));
  return rows.map(({kind,record,index})=>{
    const isDef=kind==='def';
    const label=isDef?'DEF':record.fuelType==='diesel'?'Diesel':'Gasoline';
    const data=isDef?`data-trip-def-record-index="${index}"`:`data-trip-fuel-record-index="${index}"`;
    return `<button class="detail-row editable-detail-row trip-fuel-record record-link" type="button" ${data}><span><b>${escapeHtml(record.station||(isDef?'DEF purchase':'Fuel stop'))}</b><br><small>${date(record.date)}${fuelLocation(record)?` · ${escapeHtml(fuelLocation(record))}`:''} · ${escapeHtml(record.vehicle||trip.towVehicle||'')} · ${label} · ${number(record.gallons,2)} gal</small></span><span class="trip-fuel-record-end"><b>${money(record.total)}</b><span class="record-chevron">›</span></span></button>`;
  }).join('')||'<p class="intro">No fuel or DEF purchases linked yet.</p>';
}
function showTrip(index){
  const t=db.tripSummaries[index]; if(!t)return;
  detailReturnTripIndex=null;
  const [s,e]=tripDates(t), stays=matchingStays(t), plans=plansForTrip(t), fuel=matchingFuel(t), def=matchingDef(t), linkedNotes=notesForTrip(t);
  const stayCost=stays.reduce((total,stay)=>total+(Number(stay.price)||0),0);
  const fuelCost=fuel.length?fuel.reduce((total,stop)=>total+(Number(stop.total)||0),0):Number(t.cost)||0;
  const headerMeta=`<p class="detail-header-dates">${tripHasDates(t)?`${date(s)} – ${date(e)}`:t.year}</p>${rigLineHtml(t)}`;
  setDetailHeader('TRIP',t.name,t,headerMeta);
  if(window.ADVENTURE_HUB_CLOUD?.role==='viewer'){
    $('#detailBody').innerHTML=`${t.destination?`<div class="detail-section"><h3>Destination</h3><p>${escapeHtml(t.destination)}</p></div>`:''}<div class="detail-section"><h3>Campgrounds & hosts</h3><div class="stay-listing-stack">${stays.map(x=>stayListing(x,{viewer:true})).join('')||'<p class="intro">No campground details have been added yet.</p>'}</div></div><div class="detail-section"><h3>Plans & reservations</h3><div class="trip-plan-list">${plans.map(plan=>planCardHtml(plan,{viewer:true})).join('')||'<p class="intro">No activity plans have been added yet.</p>'}</div></div>`;
    bindStayPhotoButtons($('#detailBody'));
    bindStayMapLinks($('#detailBody'));
    bindStayCards($('#detailBody'),index);
    $('#detailDialog').showModal();
    return;
  }
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editTripButton">Edit trip</button></div><div class="detail-section trip-totals-section"><h3>Trip totals</h3><div class="trip-totals-compact"><div><small>Stay cost</small><b>${money(stayCost)}</b></div><div><small>Fuel cost</small><b>${money(fuelCost)}</b></div><div><small>Miles</small><b>${number(t.distance,1)}</b></div><div><small>MPG</small><b>${number(t.mpg,2)}</b></div></div></div><div class="detail-section"><h3>Campgrounds & hosts</h3><div class="stay-listing-stack">${stays.map(x=>stayListing(x)).join('')||'<p class="intro">No campground stays linked yet.</p>'}</div></div><div class="detail-section trip-plans-section"><div class="detail-section-head"><h3>Plans & reservations</h3><button class="text-button" id="addTripPlanButton">Add plan</button></div><div class="trip-plan-list">${plans.map(plan=>planCardHtml(plan)).join('')||'<p class="intro">No activity plans or reservations linked yet.</p>'}</div></div><div class="detail-section trip-linked-notes-section"><div class="detail-section-head"><h3>Linked notes</h3><button class="text-button" id="addTripNoteButton">Add note</button></div><div class="trip-linked-notes">${linkedNotes.map(note=>noteCardHtml(note,true)).join('')||'<p class="intro">No notes linked to this trip yet.</p>'}</div></div><div class="detail-section"><div class="detail-section-head"><h3>Fuel &amp; DEF</h3><button class="text-button" id="addTripFuelButton">Add purchase</button></div>${tripPurchaseRows(t,fuel,def)}</div>${t.notes?`<div class="detail-section"><h3>Trip description</h3><p>${escapeHtml(t.notes)}</p></div>`:''}<div class="trip-delete-area"><button class="delete-link" id="deleteTripButton">Delete trip</button></div>`;
  $('#editTripButton').onclick=()=>{closeDetailForTransition();openEntry('trip',index)};
  $('#addTripFuelButton').onclick=()=>{closeDetailForTransition();openEntry('fuel',null,index)};
  $('#addTripPlanButton').onclick=()=>{closeDetailForTransition();openEntry('trip-plan',null,index)};
  $('#addTripNoteButton').onclick=()=>{closeDetailForTransition();openEntry('hub-note',null,index)};
  $$('[data-trip-fuel-record-index]').forEach(button=>button.onclick=()=>showFuelRecord(+button.dataset.tripFuelRecordIndex,index));
  $$('[data-trip-def-record-index]').forEach(button=>button.onclick=()=>showDefRecord(+button.dataset.tripDefRecordIndex,index));
  bindNoteCards($('#detailBody'),index);
  bindPlanCards($('#detailBody'),index);
  bindStayPhotoButtons($('#detailBody'));
  bindStayMapLinks($('#detailBody'));
  bindStayCards($('#detailBody'),index);
  $('#deleteTripButton').onclick=()=>deleteTrip(index);
  $('#detailDialog').showModal();
}
function normalizedWebsiteUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  try{return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).href}catch{return ''}
}
function showPlanRecord(index,returnTripIndex=null){
  const plan=db.tripPlans?.[index]; if(!plan)return;
  detailReturnTripIndex=returnTripIndex;
  setDetailHeader(planTypeLabel(plan.planType).toUpperCase(),plan.title||'Plan details');
  const website=normalizedWebsiteUrl(plan.websiteUrl);
  const mapAddress=[plan.address,plan.city,plan.state,plan.zip].filter(Boolean).join(', ');
  const actions=`<div class="record-detail-actions stay-detail-actions">${returnTripIndex!==null?'<button class="text-button" id="backToTripButton">← Back to trip</button>':''}<button class="primary" id="editPlanRecord">Edit plan</button></div>`;
  $('#detailBody').innerHTML=`${actions}<div class="detail-section"><div class="detail-row"><span>Type</span><span>${escapeHtml(planTypeLabel(plan.planType))}</span></div><div class="detail-row"><span>Status</span><span>${escapeHtml(planStatusLabel(plan.status))}</span></div><div class="detail-row"><span>Date</span><span>${date(plan.date)}</span></div>${plan.startTime||plan.endTime?`<div class="detail-row"><span>Time</span><span>${[plan.startTime?clockTime(plan.startTime):'',plan.endTime?clockTime(plan.endTime):''].filter(Boolean).join(' – ')}</span></div>`:''}${plan.locationName?`<div class="detail-row"><span>Location</span><span>${escapeHtml(plan.locationName)}</span></div>`:''}${mapAddress?`<div class="plan-detail-address">${planLocationHtml(plan,{full:true})}</div>`:''}<div class="detail-row"><span>Cost</span><span>${money(plan.cost||0)}</span></div>${plan.confirmationCode?`<div class="detail-row"><span>Confirmation</span><span class="confirmation-code">${escapeHtml(plan.confirmationCode)}</span></div>`:''}${website?`<div class="detail-row"><span>Website / tickets</span><a class="text-button plan-website-link" href="${escapeHtml(website)}" target="_blank" rel="noopener">Open link ↗</a></div>`:''}${plan.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(plan.notes)}</p></div>`:''}${tripPlanAttachmentsDetailHtml(plan)}</div><div class="trip-delete-area"><button class="delete-link" id="deletePlanRecord">Delete plan</button></div>`;
  bindStayPhotoButtons($('#detailBody'));
  bindStayMapLinks($('#detailBody'));
  if(returnTripIndex!==null)$('#backToTripButton').onclick=()=>$('#detailDialog').close();
  $('#editPlanRecord').onclick=()=>{closeDetailForTransition();openEntry('trip-plan',index,returnTripIndex)};
  $('#deletePlanRecord').onclick=async()=>{
    if(!confirm(`Delete “${plan.title||'this plan'}”?`))return;
    const button=$('#deletePlanRecord');
    button.disabled=true;
    const removed=db.tripPlans.splice(index,1)[0];
    const cloudSaved=await save();
    if(!cloudSaved){db.tripPlans.splice(index,0,removed);button.disabled=false;return}
    if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){
      try{await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(removed)}
      catch(error){console.warn('The deleted reservation pictures could not be removed.',error)}
    }
    if(window.ADVENTURE_HUB_STORE&&hasLinkedDocuments(removed)){
      try{await window.ADVENTURE_HUB_STORE.setTripPlanPdfDocument(removed,null)}
      catch(error){console.warn('The deleted reservation PDF could not be removed.',error)}
    }
    closeDetailForTransition();
    renderTrips();
    if(returnTripIndex!==null)showTrip(returnTripIndex);
  };
  $('#detailDialog').showModal();
}
async function deleteTrip(index){
  const t=db.tripSummaries[index]; if(!t)return;
  const linkedStays=matchingStays(t);
  const linkedPlans=plansForTrip(t);
  const linkedSummary=[linkedStays.length?`${linkedStays.length} campground ${linkedStays.length===1?'stay':'stays'}`:'',linkedPlans.length?`${linkedPlans.length} ${linkedPlans.length===1?'plan':'plans'}`:''].filter(Boolean).join(' and ');
  const message=linkedSummary?`Delete “${t.name}” and its linked ${linkedSummary}? Fuel records will remain.`:`Delete “${t.name}”?`;
  if(!confirm(message))return;
  const originalStays=[...db.stays];
  const originalPlans=[...db.tripPlans];
  const originalNotes=db.sharedNotes.map(note=>({...note}));
  const originalTrips=[...db.tripSummaries];
  linkedStays.forEach(stay=>{const i=db.stays.indexOf(stay);if(i>=0)db.stays.splice(i,1)});
  db.tripPlans=db.tripPlans.filter(plan=>plan._tripId!==t._cloudId);
  db.sharedNotes.forEach(note=>{if(note.tripId&&note.tripId===t._cloudId)note.tripId=null});
  db.tripSummaries.splice(index,1);
  const cloudSaved=await save();
  if(!cloudSaved){
    db.stays=originalStays;
    db.tripPlans=originalPlans;
    db.sharedNotes=originalNotes;
    db.tripSummaries=originalTrips;
    return;
  }
  if(window.ADVENTURE_HUB_STORE){
    for(const plan of linkedPlans.filter(hasReceiptPhotos)){
      try{await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(plan)}
      catch(error){console.warn('A deleted trip plan picture could not be removed.',error)}
    }
    for(const plan of linkedPlans.filter(hasLinkedDocuments)){
      try{await window.ADVENTURE_HUB_STORE.setTripPlanPdfDocument(plan,null)}
      catch(error){console.warn('A deleted trip plan PDF could not be removed.',error)}
    }
  }
  $('#detailDialog').close(); renderHome(); renderTrips();
}
function rubyRecordList(items,key,type,page){
  return items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<button class="record-item record-link" type="button" data-ruby-record-key="${key}" data-ruby-record-index="${items.indexOf(x)}" data-ruby-record-type="${type}" data-ruby-record-page="${page}"><div class="item-copy"><h3>${x.description||'Record'}</h3><p>${date(x.date)}${x.location?' · '+x.location:''}${x.price?' · '+money(x.price):''}</p></div><span class="record-chevron">›</span></button>`).join('')||'<div class="empty">No records yet.</div>'
}
function receiptDetailHtml(record,label='Receipt'){
  if(!record?.receiptPhotoUrl)return '';
  return `<div class="fuel-receipt-detail"><small>${record.documentId?'HIGGINS DOCUMENTS':'RECEIPT'}</small><button class="stay-photo-thumb fuel-receipt-thumb" type="button" data-photo-url="${escapeHtml(record.receiptPhotoUrl)}" data-photo-label="${escapeHtml(label)}" aria-label="Open receipt photo"><img src="${escapeHtml(record.receiptPhotoUrl)}" alt="${escapeHtml(label)}" loading="lazy"><span>${record.documentId?'Filed bill':'Receipt'}</span></button></div>`;
}
function electricDocumentDetailHtml(record){
  const files=(record?.documentFiles||[]).filter(file=>file.url);
  if(!files.length)return receiptDetailHtml(record,`${date(record.date)} electric bill`);
  const preview=files.slice(0,3).map((file,index)=>{
    const isPdf=file.mimeType==='application/pdf'||/\.pdf$/i.test(file.originalFilename||'');
    return isPdf
      ?`<span class="electric-document-summary-pdf">PDF</span>`
      :`<img src="${escapeHtml(file.url)}" alt="" loading="lazy">`;
  }).join('');
  const status=record.documentAiStatus==='review'?'AI values ready to review':record.documentAiStatus==='complete'?'AI values reviewed':'Saved privately';
  return `<div class="electric-document-detail"><small>HIGGINS DOCUMENTS</small><button class="electric-document-summary" id="openElectricDocument" type="button"><span class="electric-document-summary-previews">${preview}</span><span class="electric-document-summary-copy"><b>${escapeHtml(record.documentTitle||'Electric bill document')}</b><small>${files.length} ${files.length===1?'file':'files'} · ${escapeHtml(status)}</small></span><span class="record-chevron">›</span></button></div>`;
}
function fuelDocumentDetailHtml(record){
  const files=(record?.documentFiles||[]).filter(file=>file.url);
  const isDef=(db.def||[]).includes(record);
  if(!files.length)return receiptDetailHtml(record,`${record.station||(isDef?'DEF purchase':'Fuel stop')} receipt`);
  const file=files[0];
  const preview=/^image\//i.test(file.mimeType||'')?`<img src="${escapeHtml(file.url)}" alt="" loading="lazy">`:'<span class="electric-document-summary-pdf">DOC</span>';
  const status=record.documentAiStatus==='review'?'Values ready to review':record.documentAiStatus==='complete'?'Values reviewed':'Saved privately';
  return `<div class="electric-document-detail"><small>HIGGINS DOCUMENTS</small><button class="electric-document-summary" id="openFuelDocument" type="button"><span class="electric-document-summary-previews">${preview}</span><span class="electric-document-summary-copy"><b>${escapeHtml(record.documentTitle||(isDef?'DEF receipt':'Fuel receipt'))}</b><small>${escapeHtml(status)}</small></span><span class="record-chevron">›</span></button></div>`;
}
function multiReceiptDetailHtml(record,label='Receipt',heading='RECEIPTS'){
  const urls=Array.isArray(record?.receiptPhotoUrls)?record.receiptPhotoUrls.filter(Boolean):[];
  if(!urls.length)return '';
  return `<div class="fuel-receipt-detail"><small>${escapeHtml(heading)}</small><div class="stay-photo-strip">${urls.map((url,index)=>`<button class="stay-photo-thumb fuel-receipt-thumb" type="button" data-photo-url="${escapeHtml(url)}" data-photo-label="${escapeHtml(`${label} ${index+1}`)}" aria-label="Open receipt photo ${index+1}"><img src="${escapeHtml(url)}" alt="${escapeHtml(`${label} ${index+1}`)}" loading="lazy"><span>Page ${index+1}</span></button>`).join('')}</div></div>`;
}
function pdfDocumentDetailHtml(record){
  const pdfs=(record?.documentAttachments||[]).filter(file=>file.url&&(file.mimeType==='application/pdf'||/\.pdf$/i.test(file.originalFilename||'')));
  if(!pdfs.length)return '';
  return `<div class="plan-pdf-detail"><small>PDF DOCUMENT${pdfs.length===1?'':'S'}</small>${pdfs.map(file=>`<a class="plan-pdf-link" href="${escapeHtml(file.url)}" target="_blank" rel="noopener"><span class="plan-pdf-icon">PDF</span><span><b>${escapeHtml(file.originalFilename||'Reservation document.pdf')}</b><small>${file.fileSizeBytes?`${number(file.fileSizeBytes/1024,0)} KB · `:''}Open document</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div>`;
}
function tripPlanAttachmentsDetailHtml(record){
  const pictures=Array.isArray(record?.receiptPhotoUrls)?record.receiptPhotoUrls.filter(Boolean):[];
  const pdfs=(record?.documentAttachments||[]).filter(file=>file.url&&(file.mimeType==='application/pdf'||/\.pdf$/i.test(file.originalFilename||'')));
  if(!pictures.length&&!pdfs.length)return '';
  return `<div class="plan-attachments-detail"><small>PICTURES &amp; PDFS</small>${pictures.length?`<div class="stay-photo-strip">${pictures.map((url,index)=>`<button class="stay-photo-thumb fuel-receipt-thumb" type="button" data-photo-url="${escapeHtml(url)}" data-photo-label="${escapeHtml(`${record.title||'Reservation'} picture ${index+1}`)}" aria-label="Open picture ${index+1}"><img src="${escapeHtml(url)}" alt="${escapeHtml(`${record.title||'Reservation'} picture ${index+1}`)}" loading="lazy"><span>Picture ${index+1}</span></button>`).join('')}</div>`:''}${pdfs.map(file=>`<a class="plan-pdf-link" href="${escapeHtml(file.url)}" target="_blank" rel="noopener"><span class="plan-pdf-icon">PDF</span><span><b>${escapeHtml(file.originalFilename||'Reservation document.pdf')}</b><small>${file.fileSizeBytes?`${number(file.fileSizeBytes/1024,0)} KB · `:''}Open document</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div>`;
}
const hasReceiptPhotos=record=>Boolean(record?.documentId||(record?.documentFiles||[]).length||record?.receiptPhotoPath||(record?.receiptPhotoPaths||[]).length);
const hasLinkedDocuments=record=>Boolean((record?.documentAttachments||[]).length);
function showRubyRecord(key,index,type,page){
  const record=db[key]?.[index]; if(!record)return;
  setDetailHeader(type==='ruby-upgrade'?'RUBY UPGRADE':'RUBY MAINTENANCE',record.description||'Record details');
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editRubyRecord">Edit entry</button></div><div class="detail-section"><div class="detail-row"><span>Date</span><span>${date(record.date)}</span></div>${record.location?`<div class="detail-row"><span>Vendor / location</span><span>${escapeHtml(record.location)}</span></div>`:''}<div class="detail-row"><span>Cost</span><span>${money(record.price||0)}</span></div>${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}${multiReceiptDetailHtml(record,`${record.description||'Ruby record'} receipt`)}</div><div class="trip-delete-area"><button class="delete-link" id="deleteRubyRecord">Delete entry</button></div>`;
  bindStayPhotoButtons($('#detailBody'));
  $('#editRubyRecord').onclick=()=>{$('#detailDialog').close();openEntry(type,index)};
  $('#deleteRubyRecord').onclick=async()=>{if(!confirm(`Delete “${record.description||'this record'}”?`))return;const removed=db[key].splice(index,1)[0];const cloudSaved=await save();if(!cloudSaved){db[key].splice(index,0,removed);return;}if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){try{await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(removed)}catch(error){console.warn('The deleted receipt could not be removed.',error)}}$('#detailDialog').close();renderHome();showPanel(page)};
  $('#detailDialog').showModal();
}
function phillisRecordList(items,key,type,page){
  return items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<button class="record-item record-link" type="button" data-record-key="${key}" data-record-index="${items.indexOf(x)}" data-record-type="${type}" data-record-page="${page}"><div class="item-copy"><span class="record-asset">${escapeHtml(x.trailer||'Phillis')}</span><h3>${x.description||'Record'}</h3><p>${date(x.date)}${x.location?' · '+x.location:''}${x.price?' · '+money(x.price):''}</p></div><span class="record-chevron">›</span></button>`).join('')||'<div class="empty">No records yet.</div>'
}
function showPhillisRecord(key,index,type,page){
  const record=db[key]?.[index]; if(!record)return;
  setDetailHeader(type==='phillis-upgrade'?'PHILLIS UPGRADE':'PHILLIS MAINTENANCE',record.description||'Record details');
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editPhillisRecord">Edit entry</button></div><div class="detail-section"><div class="detail-row"><span>Trailer</span><span>${escapeHtml(record.trailer||'Phillis')}</span></div><div class="detail-row"><span>Date</span><span>${date(record.date)}</span></div>${record.location?`<div class="detail-row"><span>Vendor / location</span><span>${escapeHtml(record.location)}</span></div>`:''}<div class="detail-row"><span>Cost</span><span>${money(record.price||0)}</span></div>${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}${multiReceiptDetailHtml(record,`${record.description||'Phillis record'} receipt`)}</div><div class="trip-delete-area"><button class="delete-link" id="deletePhillisRecord">Delete entry</button></div>`;
  bindStayPhotoButtons($('#detailBody'));
  $('#editPhillisRecord').onclick=()=>{$('#detailDialog').close();openEntry(type,index)};
  $('#deletePhillisRecord').onclick=async()=>{if(!confirm(`Delete “${record.description||'this record'}”?`))return;const removed=db[key].splice(index,1)[0];const cloudSaved=await save();if(!cloudSaved){db[key].splice(index,0,removed);return;}if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){try{await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(removed)}catch(error){console.warn('The deleted receipt could not be removed.',error)}}$('#detailDialog').close();renderHome();showPanel(page)};
  $('#detailDialog').showModal();
}

function fuelRecordList(items){
  return items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<button class="record-item record-link" type="button" data-fuel-record-index="${items.indexOf(x)}"><span class="record-icon">⛽</span><div class="item-copy"><h3>${x.station||'Fuel stop'}</h3><p>${date(x.date)}${fuelLocation(x)?` · ${escapeHtml(fuelLocation(x))}`:''} · ${x.trip?escapeHtml(x.vehicle||'Truck'):'Everyday Ruby'} · ${x.fuelType==='diesel'?'Diesel':'Gasoline'} · ${number(x.gallons,2)} gal · ${money(x.total)}</p></div><span class="record-chevron">›</span></button>`).join('')||'<div class="empty">No fuel records yet.</div>'
}
function defStats(){
  const rows=(db.def||[]).filter(record=>Number(record.gallons)>0);
  const gallons=rows.reduce((sum,record)=>sum+Number(record.gallons||0),0);
  const cost=rows.reduce((sum,record)=>sum+Number(record.total||0),0);
  const byVehicle=new Map();
  rows.filter(record=>Number.isFinite(Number(record.odometer))&&Number(record.odometer)>0).forEach(record=>{
    const key=record._vehicleId||record.vehicle||'vehicle';
    if(!byVehicle.has(key))byVehicle.set(key,[]);
    byVehicle.get(key).push(record);
  });
  const gaps=[...byVehicle.values()].flatMap(vehicleRows=>{
    vehicleRows.sort((a,b)=>Number(a.odometer)-Number(b.odometer));
    return vehicleRows.slice(1).map((record,index)=>Number(record.odometer)-Number(vehicleRows[index].odometer)).filter(value=>value>0);
  });
  return {gallons,cost,average:gallons?cost/gallons:null,averageMiles:gaps.length?gaps.reduce((sum,value)=>sum+value,0)/gaps.length:null};
}
function fuelAndDefHistory(){
  return [
    ...db.fuel.map((record,index)=>({kind:'fuel',record,index})),
    ...db.def.map((record,index)=>({kind:'def',record,index}))
  ].sort((a,b)=>String(b.record.date||'').localeCompare(String(a.record.date||''))||Number(b.record.odometer||0)-Number(a.record.odometer||0));
}
function fuelAndDefRecordList(){
  return fuelAndDefHistory().map(({kind,record,index})=>{
    const isDef=kind==='def';
    return `<button class="record-item record-link ${isDef?'def-record-item':''}" type="button" ${isDef?`data-def-record-index="${index}"`:`data-fuel-record-index="${index}"`}><span class="record-icon">${isDef?'💧':'⛽'}</span><div class="item-copy"><span class="record-asset">${isDef?'DEF':'FUEL'}</span><h3>${escapeHtml(record.station||(isDef?'DEF purchase':'Fuel stop'))}</h3><p>${date(record.date)}${fuelLocation(record)?` · ${escapeHtml(fuelLocation(record))}`:''} · ${record.trip?escapeHtml(record.vehicle||'Truck'):'Everyday Ruby'} · ${isDef?'Diesel exhaust fluid':record.fuelType==='diesel'?'Diesel':'Gasoline'} · ${number(record.gallons,2)} gal · ${money(record.total)}</p></div><span class="record-chevron">›</span></button>`;
  }).join('')||'<div class="empty">No fuel or DEF records yet.</div>';
}
function showFuelRecord(index,returnTripIndex=null){
  const record=db.fuel?.[index]; if(!record)return;
  detailReturnTripIndex=returnTripIndex;
  setDetailHeader(`${record.vehicle||'TRIP'} FUEL STOP`.toUpperCase(),record.station||'Fuel stop');
  const actions=`<div class="record-detail-actions stay-detail-actions">${returnTripIndex!==null?'<button class="text-button" id="backToTripButton">← Back to trip</button>':''}<button class="primary" id="editFuelRecord">Edit fuel stop</button></div>`;
  const receipt=fuelDocumentDetailHtml(record);
  const previous=record.trip?db.fuel.filter((row,rowIndex)=>rowIndex!==index&&row.trip===record.trip&&Number(row.tripMiles)<Number(record.tripMiles)).sort((a,b)=>(Number(b.tripMiles)||0)-(Number(a.tripMiles)||0))[0]:null;
  const tankMiles=previous?Number(record.tripMiles)-Number(previous.tripMiles):Number(record.tripMiles);
  const mpg=Number(record.gallons)>0&&Number.isFinite(tankMiles)?tankMiles/Number(record.gallons):null;
  $('#detailBody').innerHTML=`${actions}<div class="detail-section"><div class="detail-row"><span>Date</span><span>${date(record.date)}</span></div><div class="detail-row"><span>Trip</span><span>${escapeHtml(record.trip||NO_TRIP_LABEL)}</span></div>${record.vehicle?`<div class="detail-row"><span>Vehicle</span><span>${escapeHtml(record.vehicle)}</span></div>`:''}<div class="detail-row"><span>Fuel</span><span>${record.fuelType==='diesel'?'Diesel':'Gasoline'}</span></div>${record.city?`<div class="detail-row"><span>City</span><span>${escapeHtml(record.city)}</span></div>`:''}${record.state?`<div class="detail-row"><span>State</span><span>${escapeHtml(record.state)}</span></div>`:''}<div class="detail-row"><span>Gallons</span><span>${number(record.gallons,3)}</span></div><div class="detail-row"><span>Total</span><span>${money(record.total||0)}</span></div><div class="detail-row"><span>Price per gallon</span><span>${money(record.price||((record.gallons&&record.total)?record.total/record.gallons:0))}</span></div>${record.tripMiles!=null?`<div class="detail-row"><span>Trip meter</span><span>${number(record.tripMiles,1)}</span></div>`:''}${previous?`<div class="detail-row"><span>Tank miles</span><span>${number(tankMiles,1)}</span></div>`:''}${mpg!=null?`<div class="detail-row"><span>${previous?'Tank MPG':'Trip MPG'}</span><span>${number(mpg,2)}</span></div>`:''}${record.odometer?`<div class="detail-row"><span>Odometer</span><span>${number(record.odometer,1)}</span></div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}${receipt}</div><div class="trip-delete-area"><button class="delete-link" id="deleteFuelRecord">Delete fuel stop</button></div>`;
  bindStayPhotoButtons($('#detailBody'));
  if($('#openFuelDocument'))$('#openFuelDocument').onclick=()=>openFuelReceiptDocumentReview(record,false,{index,returnTripIndex});
  if(returnTripIndex!==null)$('#backToTripButton').onclick=()=>$('#detailDialog').close();
  $('#editFuelRecord').onclick=()=>{closeDetailForTransition();openEntry('fuel',index,returnTripIndex)};
  $('#deleteFuelRecord').onclick=async()=>{
    if(!confirm(`Delete this fuel stop at ${record.station||'this station'}?`))return;
    const button=$('#deleteFuelRecord');
    button.disabled=true;
    const removed=db.fuel.splice(index,1)[0];
    refreshTripFuelSummaries();
    const cloudSaved=await save();
    if(!cloudSaved){
      db.fuel.splice(index,0,removed);
      refreshTripFuelSummaries();
      button.disabled=false;
      return;
    }
    if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){
      try{removed.documentId?await window.ADVENTURE_HUB_STORE.deleteFuelReceiptDocument(removed):await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(removed);}
      catch(error){console.warn('The deleted fuel stop receipt could not be removed.',error);}
    }
    closeDetailForTransition();
    renderHome();
    renderTrips();
    if(returnTripIndex!==null)showTrip(returnTripIndex);
    else showPanel('fuel-history');
  };
  if(!$('#detailDialog').open)$('#detailDialog').showModal();
}
function showDefRecord(index,returnTripIndex=null){
  const record=db.def?.[index]; if(!record)return;
  detailReturnTripIndex=returnTripIndex;
  const prior=(db.def||[]).filter((row,rowIndex)=>rowIndex!==index&&(row._vehicleId||row.vehicle)===(record._vehicleId||record.vehicle)&&Number(row.odometer)>0&&Number(row.odometer)<Number(record.odometer)).sort((a,b)=>Number(b.odometer)-Number(a.odometer))[0];
  const miles=prior?Number(record.odometer)-Number(prior.odometer):null;
  setDetailHeader(`${record.vehicle||'RUBY'} DEF PURCHASE`.toUpperCase(),record.station||'DEF purchase');
  const actions=`<div class="record-detail-actions stay-detail-actions">${returnTripIndex!==null?'<button class="text-button" id="backToTripButton">← Back to trip</button>':''}<button class="primary" id="editDefRecord">Edit DEF purchase</button></div>`;
  $('#detailBody').innerHTML=`${actions}<div class="detail-section"><div class="detail-row"><span>Purchase type</span><span>DEF</span></div><div class="detail-row"><span>Date</span><span>${date(record.date)}${record.time?` · ${clockTime(record.time)}`:''}</span></div><div class="detail-row"><span>Trip</span><span>${escapeHtml(record.trip||NO_TRIP_LABEL)}</span></div>${record.vehicle?`<div class="detail-row"><span>Vehicle</span><span>${escapeHtml(record.vehicle)}</span></div>`:''}${record.address?`<div class="detail-row"><span>Address</span><span>${escapeHtml(record.address)}</span></div>`:''}${record.city?`<div class="detail-row"><span>City</span><span>${escapeHtml(record.city)}</span></div>`:''}${record.state?`<div class="detail-row"><span>State</span><span>${escapeHtml(record.state)}</span></div>`:''}<div class="detail-row"><span>DEF gallons</span><span>${number(record.gallons,3)}</span></div><div class="detail-row"><span>DEF total</span><span>${money(record.total||0)}</span></div><div class="detail-row"><span>Price per gallon</span><span>${money(record.price||((record.gallons&&record.total)?record.total/record.gallons:0))}</span></div>${record.odometer?`<div class="detail-row"><span>Odometer</span><span>${number(record.odometer,1)}</span></div>`:''}${miles!=null?`<div class="detail-row"><span>Miles since recorded DEF purchase</span><span>${number(miles,1)}</span></div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}${fuelDocumentDetailHtml(record)}</div><div class="trip-delete-area"><button class="delete-link" id="deleteDefRecord">Delete DEF purchase</button></div>`;
  bindStayPhotoButtons($('#detailBody'));
  if($('#openFuelDocument'))$('#openFuelDocument').onclick=()=>openFuelReceiptDocumentReview(record,false,{index,kind:'def',returnTripIndex});
  if(returnTripIndex!==null)$('#backToTripButton').onclick=()=>$('#detailDialog').close();
  $('#editDefRecord').onclick=()=>{closeDetailForTransition();openEntry('def',index,returnTripIndex)};
  $('#deleteDefRecord').onclick=async()=>{
    if(!confirm(`Delete this DEF purchase at ${record.station||'this station'}?`))return;
    const button=$('#deleteDefRecord'); button.disabled=true;
    const removed=db.def.splice(index,1)[0];
    const cloudSaved=await save();
    if(!cloudSaved){db.def.splice(index,0,removed);button.disabled=false;return}
    if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){
      try{await window.ADVENTURE_HUB_STORE.deleteDefReceiptDocument(removed)}catch(error){console.warn('The deleted DEF receipt could not be removed.',error)}
    }
    closeDetailForTransition(); renderHome(); renderTrips();
    if(returnTripIndex!==null)showTrip(returnTripIndex);else showPanel('fuel-history');
  };
  if(!$('#detailDialog').open)$('#detailDialog').showModal();
}
function seasonDocumentTypeLabel(type){
  return type==='welcome_letter'?'Welcome letter':type==='registration_forms'?'Registration forms':'Seasonal document';
}
function seasonDocumentCards(season){
  const source=season.seasonDocuments||[];
  const documents=source.slice().sort((a,b)=>
    String(b.documentDate||b.documentUploadedAt||'').localeCompare(String(a.documentDate||a.documentUploadedAt||''))
  );
  return documents.map((document,index)=>{
    const sourceIndex=source.indexOf(document);
    const files=document.documentFiles||[];
    const image=files.find(file=>/^image\//i.test(file.mimeType||'')&&file.url);
    const hasPdf=files.some(file=>file.mimeType==='application/pdf'||/\.pdf$/i.test(file.originalFilename||''));
    const preview=image
      ?`<img src="${escapeHtml(image.url)}" alt="">`
      :`<span class="season-document-file-icon">${hasPdf?'PDF':'▤'}</span>`;
    return `<button class="record-item record-link season-document-card" type="button" data-season-document-index="${sourceIndex}"><span class="season-document-thumb">${preview}</span><div class="item-copy"><h3>${escapeHtml(document.documentTitle||seasonDocumentTypeLabel(document.documentType))}</h3><p>${seasonDocumentTypeLabel(document.documentType)} · ${files.length} ${files.length===1?'file':'files'}${document.documentDate?' · '+date(document.documentDate):''}</p></div><span class="record-chevron">›</span></button>`;
  }).join('')||'<div class="empty">No seasonal documents saved yet.</div>';
}
function showSeasonDocument(seasonIndex,documentIndex){
  const season=db.stays?.[seasonIndex];
  const document=season?.seasonDocuments?.[documentIndex];
  if(!season||!document)return;
  const files=document.documentFiles||[];
  setDetailHeader(`${season.year} SEASONAL DOCUMENT`,document.documentTitle||seasonDocumentTypeLabel(document.documentType));
  $('#detailBody').innerHTML=`<div class="detail-section"><div class="detail-row"><span>Type</span><span>${escapeHtml(seasonDocumentTypeLabel(document.documentType))}</span></div>${document.documentDate?`<div class="detail-row"><span>Document date</span><span>${date(document.documentDate)}</span></div>`:''}<div class="season-document-detail-files">${files.map((file,index)=>{
    const isPdf=file.mimeType==='application/pdf'||/\.pdf$/i.test(file.originalFilename||'');
    return isPdf
      ?`<a class="plan-pdf-link" href="${escapeHtml(file.url||'#')}" target="_blank" rel="noopener"><span class="plan-pdf-icon">PDF</span><span><b>${escapeHtml(file.originalFilename||`Document ${index+1}`)}</b><small>${file.fileSizeBytes?`${number(file.fileSizeBytes/1024,0)} KB · `:''}Open PDF</small></span><span aria-hidden="true">↗</span></a>`
      :file.url
        ?`<button class="season-document-detail-image" type="button" data-photo-url="${escapeHtml(file.url)}" data-photo-label="${escapeHtml(document.documentTitle||`Seasonal document page ${index+1}`)}"><img src="${escapeHtml(file.url)}" alt="${escapeHtml(`Page ${index+1}`)}"><span>Page ${index+1}</span></button>`
        :'<div class="empty">This file cannot be previewed.</div>';
  }).join('')}</div></div>${viewer?'':`<div class="trip-delete-area"><button class="delete-link" id="deleteSeasonDocument">Delete document</button></div>`}`;
  bindStayPhotoButtons($('#detailBody'));
  if(!viewer)$('#deleteSeasonDocument').onclick=async()=>{
    if(!confirm(`Delete “${document.documentTitle||'this seasonal document'}”?`))return;
    const button=$('#deleteSeasonDocument');
    button.disabled=true;
    try{
      await window.ADVENTURE_HUB_STORE.deleteSeasonDocument(season,document.documentId);
      $('#detailDialog').close();
      showPanel('lehigh');
      renderJournalStats();
    }catch(error){
      button.disabled=false;
      alert(`The document could not be deleted.\n\n${error.message||error}`);
    }
  };
  $('#detailDialog').showModal();
}
let seasonDocumentDraft={seasonIndex:null,items:[]};
function clearSeasonDocumentDraft(){
  seasonDocumentDraft.items.forEach(item=>item.url&&URL.revokeObjectURL(item.url));
  seasonDocumentDraft={seasonIndex:null,items:[]};
}
function renderSeasonDocumentDraft(){
  const host=$('#seasonDocumentFileList');
  const count=$('#seasonDocumentFileCount');
  if(!host||!count)return;
  const items=seasonDocumentDraft.items;
  host.innerHTML=items.length?items.map((item,index)=>{
    const isPdf=item.file.type==='application/pdf'||/\.pdf$/i.test(item.file.name||'');
    const preview=isPdf
      ?`<span class="plan-pdf-link electric-document-editor-preview"><span class="plan-pdf-icon">PDF</span><span><b>${escapeHtml(item.file.name||'Seasonal document.pdf')}</b><small>Ready to upload</small></span></span>`
      :`<button class="electric-document-editor-image" type="button" data-photo-url="${escapeHtml(item.url)}" data-photo-label="${escapeHtml(`Seasonal document page ${index+1}`)}"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(`Seasonal document page ${index+1}`)}"></button>`;
    return `<article class="electric-document-editor-item"><span class="electric-document-page-number">${index+1}</span>${preview}<div class="electric-document-editor-copy"><b>${isPdf?'PDF document':`Page ${index+1}`}</b><small>${number(item.file.size/1024,0)} KB · Ready to save</small></div><div class="electric-document-order-actions">${items.length>1?`<button class="secondary" type="button" data-season-document-up="${index}" ${index===0?'disabled':''}>↑</button><button class="secondary" type="button" data-season-document-down="${index}" ${index===items.length-1?'disabled':''}>↓</button>`:''}<button class="delete-link" type="button" data-season-document-remove="${index}">Remove</button></div></article>`;
  }).join(''):'<div class="note-photo-empty">No pictures or PDFs attached yet.</div>';
  count.textContent=`${items.length} ${items.length===1?'file':'files'} attached · no set limit`;
  $$('[data-season-document-up]',host).forEach(button=>button.onclick=()=>moveSeasonDocumentFile(+button.dataset.seasonDocumentUp,-1));
  $$('[data-season-document-down]',host).forEach(button=>button.onclick=()=>moveSeasonDocumentFile(+button.dataset.seasonDocumentDown,1));
  $$('[data-season-document-remove]',host).forEach(button=>button.onclick=()=>{
    const [removed]=seasonDocumentDraft.items.splice(+button.dataset.seasonDocumentRemove,1);
    if(removed?.url)URL.revokeObjectURL(removed.url);
    renderSeasonDocumentDraft();
  });
  bindStayPhotoButtons(host);
}
function moveSeasonDocumentFile(index,direction){
  const destination=index+direction;
  if(index<0||destination<0||destination>=seasonDocumentDraft.items.length)return;
  const [item]=seasonDocumentDraft.items.splice(index,1);
  seasonDocumentDraft.items.splice(destination,0,item);
  renderSeasonDocumentDraft();
}
function addSeasonDocumentFile(file,metadata={}){
  if(!file)return;
  try{Object.defineProperty(file,'higginsDocumentMetadata',{value:{...metadata},configurable:true});}catch{}
  seasonDocumentDraft.items.push({file,url:URL.createObjectURL(file)});
  renderSeasonDocumentDraft();
}
function openSeasonDocumentEditor(seasonIndex){
  const season=db.stays?.[seasonIndex];
  if(!season||season.arrival!=='Season')return;
  clearSeasonDocumentDraft();
  seasonDocumentDraft.seasonIndex=seasonIndex;
  $('#seasonDocumentDialogTitle').textContent=`Add ${season.year} document`;
  $('#seasonDocumentType').value='welcome_letter';
  $('#seasonDocumentDate').value='';
  $('#seasonDocumentTitle').value=`${season.year} welcome letter`;
  $('#seasonDocumentTitle').dataset.edited='false';
  $('#seasonDocumentStatus').textContent='Nothing is uploaded until you save.';
  renderSeasonDocumentDraft();
  $('#seasonDocumentDialog').showModal();
}
$('#seasonDocumentType').addEventListener('change',()=>{
  const season=db.stays?.[seasonDocumentDraft.seasonIndex];
  const title=$('#seasonDocumentTitle');
  if(!season||title.dataset.edited==='true')return;
  title.value=`${season.year} ${seasonDocumentTypeLabel($('#seasonDocumentType').value).toLowerCase()}`;
});
$('#seasonDocumentTitle').addEventListener('input',()=>{$('#seasonDocumentTitle').dataset.edited='true'});
$('#addSeasonDocumentFile').onclick=()=>{
  if(!window.HIGGINS_DOCUMENT_SCANNER){
    alert('The scanner is still loading. Please try again in a moment.');
    return;
  }
  const season=db.stays?.[seasonDocumentDraft.seasonIndex];
  window.HIGGINS_DOCUMENT_SCANNER.open({
    title:`${season?.year||''} seasonal document`,
    useLabel:'Add to document',
    allowPdfUse:true,
    onUse:({file,metadata})=>{
      addSeasonDocumentFile(file,metadata);
      $('#seasonDocumentStatus').textContent=metadata.preservedOriginal
        ?'PDF added intact. Add another file or save the document.'
        :'Page cleaned and prepared locally. Add another page or save the document.';
      return true;
    }
  });
};
$('#seasonDocumentForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const season=db.stays?.[seasonDocumentDraft.seasonIndex];
  if(!season)return;
  if(!seasonDocumentDraft.items.length){
    alert('Add at least one picture or PDF first.');
    return;
  }
  if(!window.ADVENTURE_HUB_STORE?.saveSeasonDocument){
    alert('Cloud documents are not ready. Please refresh and try again.');
    return;
  }
  const button=$('#saveSeasonDocument');
  button.disabled=true;
  button.textContent='Saving…';
  $('#seasonDocumentStatus').textContent='Uploading the document securely…';
  try{
    await window.ADVENTURE_HUB_STORE.saveSeasonDocument(season,{
      title:$('#seasonDocumentTitle').value.trim(),
      documentType:$('#seasonDocumentType').value,
      documentDate:$('#seasonDocumentDate').value,
      items:seasonDocumentDraft.items.map(item=>({file:item.file}))
    });
    $('#seasonDocumentDialog').close();
    clearSeasonDocumentDraft();
    showPanel('lehigh');
    renderJournalStats();
  }catch(error){
    $('#seasonDocumentStatus').textContent='The document was not saved.';
    alert(`The document could not be saved.\n\n${error.message||error}`);
  }finally{
    button.disabled=false;
    button.textContent='Save document';
  }
});
function showSeasonRecord(index){
  const record=db.stays?.[index]; if(!record||record.arrival!=='Season')return;
  const payments=(db.siteFees||[]).filter(x=>+x.year===+record.year).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const yearElectric=(db.electric||[]).filter(x=>String(x.date||'').startsWith(String(record.year)));
  const electricTotal=yearElectric.reduce((sum,x)=>sum+(+x.total||0),0);
  setDetailHeader('LEHIGH GORGE SEASON',String(record.year));
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editSeasonRecord">Edit season</button></div><div class="detail-section"><div class="detail-row"><span>Site</span><span>${escapeHtml(record.site||'39')}</span></div><div class="detail-row"><span>Seasonal fee</span><span>${money(record.price||0)}</span></div><div class="detail-row"><span>Electric</span><span>${money(electricTotal)}</span></div><div class="detail-row"><span>Year total</span><span>${money((+record.price||0)+electricTotal)}</span></div>${record.address?`<div class="detail-row"><span>Address</span><span>${escapeHtml([record.address,record.city,record.state,record.zip].filter(Boolean).join(', '))}</span></div>`:''}${payments.length?`<div class="record-notes"><small>PAYMENTS</small>${payments.map(p=>`<p>${date(p.date)} · ${money(p.payment||0)}${p.check?' · check '+escapeHtml(p.check):''}</p>`).join('')}</div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}</div><div class="trip-delete-area"><button class="delete-link" id="deleteSeasonRecord">Delete season</button></div>`;
  $('#editSeasonRecord').onclick=()=>{$('#detailDialog').close();openEntry('sitefee',index)};
  $('#deleteSeasonRecord').onclick=async()=>{
    if(!confirm(`Delete the ${record.year} Lehigh Gorge season, its payments, electric bills, and seasonal documents?`))return;
    const button=$('#deleteSeasonRecord');
    button.disabled=true;
    const relatedPayments=(db.siteFees||[]).filter(x=>+x.year===+record.year);
    const relatedElectric=(db.electric||[]).filter(x=>String(x.date||'').startsWith(String(record.year)));
    db.stays.splice(index,1);
    db.siteFees=(db.siteFees||[]).filter(x=>+x.year!==+record.year);
    db.electric=(db.electric||[]).filter(x=>!String(x.date||'').startsWith(String(record.year)));
    const cloudSaved=await save();
    if(!cloudSaved){
      db.stays.splice(index,0,record);
      db.siteFees.push(...relatedPayments);
      db.electric.push(...relatedElectric);
      button.disabled=false;
      return;
    }
    if(window.ADVENTURE_HUB_STORE){
      try{
        for(const document of record.seasonDocuments||[]){
          if(document.documentId)await window.ADVENTURE_HUB_STORE.deleteSeasonDocument(record,document.documentId);
        }
        for(const bill of relatedElectric){
          if(bill.documentId||(bill.documentFiles||[]).length||bill.receiptPhotoPath){
            await window.ADVENTURE_HUB_STORE.setElectricBillDocuments(bill,{items:[]});
          }
        }
        for(const payment of relatedPayments){
          if(hasReceiptPhotos(payment))await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(payment);
        }
      }catch(error){
        console.warn('The season was deleted, but an attached file could not be removed.',error);
      }
    }
    $('#detailDialog').close();
    renderHome();
    showPanel('lehigh');
    renderJournalStats();
  };
  $('#detailDialog').showModal();
}
function showSitePaymentRecord(index){
  const record=db.siteFees?.[index]; if(!record)return;
  setDetailHeader('LEHIGH GORGE SEASON PAYMENT',`${record.year} payment`);
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editSitePaymentRecord">Edit payment</button></div><div class="detail-section"><div class="detail-row"><span>Season</span><span>${record.year}</span></div><div class="detail-row"><span>Payment date</span><span>${date(record.date)}</span></div><div class="detail-row"><span>Amount</span><span>${money(record.payment||0)}</span></div>${record.check?`<div class="detail-row"><span>Check</span><span>${escapeHtml(record.check)}</span></div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}${multiReceiptDetailHtml(record,`${record.year} seasonal payment receipt`)}</div><div class="trip-delete-area"><button class="delete-link" id="deleteSitePaymentRecord">Delete payment</button></div>`;
  bindStayPhotoButtons($('#detailBody'));
  $('#editSitePaymentRecord').onclick=()=>{$('#detailDialog').close();openEntry('sitepayment',index)};
  $('#deleteSitePaymentRecord').onclick=async()=>{if(!confirm('Delete this seasonal fee payment?'))return;const removed=db.siteFees.splice(index,1)[0];const cloudSaved=await save();if(!cloudSaved){db.siteFees.splice(index,0,removed);return;}if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){try{await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(removed)}catch(error){console.warn('The deleted receipt could not be removed.',error)}}$('#detailDialog').close();renderHome();showPanel('lehigh')};
  $('#detailDialog').showModal();
}
let pendingElectricAiApproval=null;
function applyElectricDocumentSuggestionFields(fields={}){
  if(fields.bill_date)$('#date').value=fields.bill_date;
  if(fields.previous_meter_reading!=null)$('#previous').value=fields.previous_meter_reading;
  if(fields.current_meter_reading!=null)$('#current').value=fields.current_meter_reading;
  if(fields.rate!=null)$('#rate').value=fields.rate;
  if(fields.amount_paid!=null||fields.amount_due!=null)$('#amountDue').value=fields.amount_paid??fields.amount_due;
  if(fields.payment_date)$('#paid').value=fields.payment_date;
  if(fields.check_number)$('#check').value=fields.check_number;
  const status=$('#documentScannerAttachStatus');
  if(status)status.textContent='AI suggestions are loaded. Check the bill values, then tap Save bill to approve them.';
}
function useElectricDocumentSuggestions(record,index,result){
  const fields=result?.fields||{};
  pendingElectricAiApproval={
    documentId:record.documentId,
    corrections:{fields,reviewed_at:new Date().toISOString(),model:result?.model||''}
  };
  $('#detailDialog').close();
  openEntry('electric',index);
  applyElectricDocumentSuggestionFields(fields);
}
function openElectricDraftDocumentReview(document,autoAnalyze=false){
  if(!window.HIGGINS_DOCUMENT_REVIEW){
    alert('The document viewer is still loading. Please try again in a moment.');
    return;
  }
  window.HIGGINS_DOCUMENT_REVIEW.open({
    record:document,
    autoAnalyze,
    defaultFields:{
      campground:'Lehigh Gorge Campground',
      site_number:'39',
      previous_meter_reading:$('#previous')?.value===''?null:Number($('#previous')?.value)
    },
    onExtracted:updated=>{
      Object.assign(document,updated);
      electricDocumentEditorState.draftDocument=document;
    },
    onUse:result=>{
      const fields=result?.fields||{};
      pendingElectricAiApproval={
        documentId:document.documentId,
        corrections:{fields,reviewed_at:new Date().toISOString(),model:result?.model||''}
      };
      applyElectricDocumentSuggestionFields(fields);
    }
  });
}
function openElectricDocumentReview(record,index,autoAnalyze=false){
  if(!window.HIGGINS_DOCUMENT_REVIEW){
    alert('The document viewer is still loading. Please try again in a moment.');
    return;
  }
  window.HIGGINS_DOCUMENT_REVIEW.open({
    record,
    autoAnalyze,
    defaultFields:{
      campground:'Lehigh Gorge Campground',
      site_number:'39',
      previous_meter_reading:record.previous
    },
    onExtracted:updated=>{
      Object.assign(record,updated);
      localStorage.setItem(KEY,JSON.stringify(db));
      renderJournalStats();
    },
    onUse:result=>useElectricDocumentSuggestions(record,index,result)
  });
}
function showElectricRecord(index){
  const record=db.electric?.[index]; if(!record)return;
  setDetailHeader('LEHIGH GORGE ELECTRIC',date(record.date));
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editElectricRecord">Edit reading</button></div><div class="detail-section"><div class="detail-row"><span>Reading date</span><span>${date(record.date)}</span></div><div class="detail-row"><span>Previous meter</span><span>${number(record.previous,0)}</span></div><div class="detail-row"><span>Current meter</span><span>${number(record.current,0)}</span></div><div class="detail-row"><span>Usage</span><span>${number(record.usage,0)} kWh</span></div><div class="detail-row"><span>Rate</span><span>${money(record.unitPrice||0)} / kWh</span></div><div class="detail-row"><span>Total</span><span>${money(record.total||0)}</span></div>${record.paid?`<div class="detail-row"><span>Paid</span><span>${date(record.paid)}</span></div>`:''}${record.check?`<div class="detail-row"><span>Check</span><span>${escapeHtml(record.check)}</span></div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}${electricDocumentDetailHtml(record)}</div><div class="trip-delete-area"><button class="delete-link" id="deleteElectricRecord">Delete reading</button></div>`;
  bindStayPhotoButtons($('#detailBody'));
  if($('#openElectricDocument'))$('#openElectricDocument').onclick=()=>openElectricDocumentReview(record,index);
  $('#editElectricRecord').onclick=()=>{$('#detailDialog').close();openEntry('electric',index)};
  $('#deleteElectricRecord').onclick=async()=>{if(!confirm('Delete this electric reading?'))return;const removed=db.electric.splice(index,1)[0];const cloudSaved=await save();if(!cloudSaved){db.electric.splice(index,0,removed);return;}if(window.ADVENTURE_HUB_STORE&&(removed.documentId||(removed.documentFiles||[]).length||removed.receiptPhotoPath)){try{await window.ADVENTURE_HUB_STORE.setElectricBillDocuments(removed,{items:[]})}catch(error){console.warn('The deleted electric-bill document could not be removed.',error)}}$('#detailDialog').close();renderHome();showPanel('lehigh')};
  $('#detailDialog').showModal();
}

function showPanel(page,{toggle=false}={}){
  const target=$(`[data-page-panel="${page}"]`);
  const trigger=$(`[data-page="${page}"]`);
  if(!target||!trigger)return;
  if(toggle&&!target.hidden){
    target.hidden=true;
    target.innerHTML='';
    trigger.setAttribute('aria-expanded','false');
    return;
  }
  let title='',html='';
  if(page==='phillis-maintenance'){title='Maintenance & repairs';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="phillis-maint">Add</button></div><div class="stack">${phillisRecordList(db.phillisMaintenance,'phillisMaintenance','phillis-maint','phillis-maintenance')}</div>`}
  if(page==='phillis-upgrades'){title='Upgrades';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="phillis-upgrade">Add</button></div><div class="stack">${phillisRecordList(db.phillisUpgrades,'phillisUpgrades','phillis-upgrade','phillis-upgrades')}</div>`}
  if(page==='ruby-maintenance'){title='Maintenance & service';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="ruby-maint">Add</button></div><div class="stack">${rubyRecordList(db.rubyMaintenance,'rubyMaintenance','ruby-maint','ruby-maintenance')}</div>`}
  if(page==='ruby-upgrades'){title='Upgrades';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="ruby-upgrade">Add</button></div><div class="stack">${rubyRecordList(db.rubyUpgrades,'rubyUpgrades','ruby-upgrade','ruby-upgrades')}</div>`}
  if(page==='fuel-history'){
    const stats=defStats();
    html=`<div class="section-row"><h2>Fuel &amp; DEF history</h2><button class="text-button" data-open="fuel">Add purchase</button></div><section class="def-stats-card"><div><small>Total DEF</small><b>${number(stats.gallons,2)} gal</b></div><div><small>DEF cost</small><b>${money(stats.cost)}</b></div><div><small>Average price</small><b>${stats.average==null?'—':money(stats.average)}/gal</b></div><div><small>Avg. miles between recorded DEF</small><b>${stats.averageMiles==null?'—':number(stats.averageMiles,0)}</b></div></section><div class="stack">${fuelAndDefRecordList()}</div>`;
  }
  if(page==='lehigh'){
    const seasonal=db.stays.filter(x=>x.arrival==='Season').sort((a,b)=>b.year-a.year);
    const seasonalTotal=seasonal.reduce((sum,x)=>sum+(+x.price||0),0);
    const electricTotal=db.electric.reduce((sum,x)=>sum+(+x.total||0),0);
    const seasonCards=seasonal.map((season,position)=>{
      const year=+season.year;
      const payments=(db.siteFees||[]).filter(x=>+x.year===year).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      const electric=(db.electric||[]).filter(x=>String(x.date||'').startsWith(String(year))).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      const seasonalDocuments=season.seasonDocuments||[];
      const paymentTotal=payments.reduce((sum,x)=>sum+(+x.payment||0),0);
      const siteFee=+season.price||paymentTotal;
      const yearElectric=electric.reduce((sum,x)=>sum+(+x.total||0),0);
      const paidDifference=siteFee-paymentTotal;
      return `<details class="lehigh-year-group" ${position===0?'open':''}>
        <summary class="lehigh-year-card">
          <div><small>LEHIGH GORGE SEASON</small><h2>${year}</h2><p>Site ${escapeHtml(season.site||'39')} · ${payments.length} ${payments.length===1?'payment':'payments'} · ${electric.length} electric ${electric.length===1?'bill':'bills'} · ${seasonalDocuments.length} ${seasonalDocuments.length===1?'document':'documents'}</p></div>
          <div class="lehigh-year-totals"><div><small>Site fee</small><b>${money(siteFee)}</b></div><div><small>Electric</small><b>${money(yearElectric)}</b></div><div><small>Season total</small><b>${money(siteFee+yearElectric)}</b></div><span class="year-chevron">⌄</span></div>
        </summary>
        <div class="lehigh-year-content">
          <div class="lehigh-section-head"><div><h3>Seasonal fee payments</h3><p>${money(paymentTotal)} paid${Math.abs(paidDifference)>.009?` · ${paidDifference>0?money(paidDifference)+' remaining':money(Math.abs(paidDifference))+' over'}`:''}</p></div><button class="text-button" data-add-site-payment="${year}">Add payment</button></div>
          <div class="stack compact-stack">${payments.map(x=>`<button class="record-item record-link" type="button" data-site-payment-index="${db.siteFees.indexOf(x)}"><div class="item-copy"><h3>${date(x.date)}</h3><p>${x.check?'Check '+escapeHtml(x.check):'Payment'}</p></div><div class="record-value"><b>${money(x.payment)}</b><span class="record-chevron">›</span></div></button>`).join('')||'<div class="empty">No payment details recorded.</div>'}</div>
          <div class="lehigh-section-head seasonal-documents-head"><div><h3>Seasonal documents</h3><p>Welcome letter, registration forms &amp; other paperwork</p></div><button class="text-button" data-add-season-document="${db.stays.indexOf(season)}">Add document</button></div>
          <div class="stack compact-stack">${seasonDocumentCards(season)}</div>
          <div class="lehigh-section-head electric-head"><div><h3>Electric bills</h3><p>${money(yearElectric)} total</p></div><button class="text-button" data-add-electric-year="${year}">Add bill</button></div>
          <div class="stack compact-stack">${electric.map(x=>`<button class="record-item record-link" type="button" data-electric-index="${db.electric.indexOf(x)}"><div class="item-copy"><h3>${date(x.date)}</h3><p>${number(x.usage,0)} kWh · meter ${x.previous} → ${x.current}${x.check?' · check '+escapeHtml(x.check):''}</p></div><div class="record-value"><b>${money(x.total)}</b><span class="record-chevron">›</span></div></button>`).join('')||'<div class="empty">No electric bills recorded.</div>'}</div>
          <div class="season-actions"><button class="secondary" data-season-index="${db.stays.indexOf(season)}">Edit season details</button></div>
        </div>
      </details>`;
    }).join('');
    const seasonalSite=seasonal[0]||{};
    const seasonalTitle=seasonalSite.name||'Seasonal site';
    const seasonalAddress=[seasonalSite.address,seasonalSite.city,seasonalSite.state,seasonalSite.zip].filter(Boolean).join(', ');
    html=`<div class="section-row"><h2>${escapeHtml(seasonalTitle)}${seasonalSite.site?` · Site ${escapeHtml(seasonalSite.site)}`:''}</h2></div><article class="card">${seasonalAddress?`<b>${escapeHtml(seasonalAddress)}</b>`:''}<p>Phillis's seasonal home.</p><div class="trip-stat-grid lehigh-summary"><div><span>Years</span><strong>${seasonal.length}</strong></div><div><span>Season fees</span><strong>${money(seasonalTotal)}</strong></div><div><span>Electric</span><strong>${money(electricTotal)}</strong></div><div><span>Grand total</span><strong>${money(seasonalTotal+electricTotal)}</strong></div></div><div class="button-row"><button class="primary" data-open="sitefee">Add season</button></div></article><div class="lehigh-year-list">${seasonCards||'<div class="empty">No seasonal records yet.</div>'}</div>`
  }
  target.innerHTML=html;
  target.hidden=false;
  trigger.setAttribute('aria-expanded','true');
  bindOpeners(); bindDeletes();
  $$('[data-fuel-record-index]',target).forEach(button=>button.onclick=()=>showFuelRecord(+button.dataset.fuelRecordIndex));
  $$('[data-def-record-index]',target).forEach(button=>button.onclick=()=>showDefRecord(+button.dataset.defRecordIndex));
  $$('[data-record-key]',target).forEach(button=>button.onclick=()=>showPhillisRecord(button.dataset.recordKey,+button.dataset.recordIndex,button.dataset.recordType,button.dataset.recordPage));
  $$('[data-ruby-record-key]',target).forEach(button=>button.onclick=()=>showRubyRecord(button.dataset.rubyRecordKey,+button.dataset.rubyRecordIndex,button.dataset.rubyRecordType,button.dataset.rubyRecordPage));
  $$('[data-season-index]',target).forEach(button=>button.onclick=()=>showSeasonRecord(+button.dataset.seasonIndex));
  $$('[data-electric-index]',target).forEach(button=>button.onclick=()=>showElectricRecord(+button.dataset.electricIndex));
  $$('[data-site-payment-index]',target).forEach(button=>button.onclick=()=>showSitePaymentRecord(+button.dataset.sitePaymentIndex));
  $$('[data-add-site-payment]',target).forEach(button=>button.onclick=()=>openEntry('sitepayment',null,+button.dataset.addSitePayment));
  $$('[data-add-electric-year]',target).forEach(button=>button.onclick=()=>openEntry('electric',null,+button.dataset.addElectricYear));
  $$('[data-add-season-document]',target).forEach(button=>button.onclick=()=>openSeasonDocumentEditor(+button.dataset.addSeasonDocument));
  $$('[data-season-document-index]',target).forEach(button=>{
    const season=button.closest('.lehigh-year-content')?.querySelector('[data-add-season-document]');
    button.onclick=()=>showSeasonDocument(+(season?.dataset.addSeasonDocument||-1),+button.dataset.seasonDocumentIndex);
  });
}
$$('[data-page]').forEach(b=>b.onclick=()=>showPanel(b.dataset.page,{toggle:true}));
function bindDeletes(){$$('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this record?')){const panel=b.closest('[data-page-panel]');db[b.dataset.delete].splice(+b.dataset.index,1);save();if(panel)showPanel(panel.dataset.pagePanel);renderHome()}})}
function stayPhotoEditorSlot(kind,title,help){
  return `<article class="stay-photo-editor"><div class="stay-photo-editor-copy"><b>${title}</b><p>${help}</p></div><div class="stay-photo-preview" id="${kind}PhotoPreview"><span>No photo yet</span></div><div class="stay-photo-actions"><label class="secondary photo-picker">Choose photo<input id="${kind}PhotoFile" type="file" accept="image/*" hidden></label><button class="delete-link remove-stay-photo" id="remove${kind[0].toUpperCase()+kind.slice(1)}Photo" type="button" hidden>Remove</button></div></article>`;
}
function receiptEditorFields(help='Optional. Take a picture or choose one from your photo library.'){
  return `<section class="fuel-receipt-editor"><article class="stay-photo-editor"><div class="stay-photo-editor-copy"><b>Receipt</b><p>${help}</p></div><div class="stay-photo-preview" id="receiptPhotoPreview"><span>No receipt yet</span></div><div class="stay-photo-actions"><label class="secondary photo-picker">Take photo<input id="receiptCameraFile" type="file" accept="image/*" capture="environment" hidden></label><label class="secondary photo-picker">Choose photo<input id="receiptPhotoFile" type="file" accept="image/*" hidden></label><button class="delete-link remove-stay-photo" id="removeReceiptPhoto" type="button" hidden>Remove</button></div></article></section>`;
}
function documentScannerFields(){
  return `<section class="document-scanner-entry"><div class="document-scanner-entry-heading"><div><small>HIGGINS HUB SCANNER</small><b>Bill pages &amp; PDFs</b><p>Scan a page, choose a picture, or add a PDF. Add as many files as this bill needs.</p></div><button class="secondary" id="openDocumentScanner" type="button">Scan or add document</button></div><div id="electricDocumentEditorList" class="electric-document-editor-list"></div><div class="electric-document-editor-footer"><p id="documentScannerAttachStatus">Everything here will be saved together as one Higgins document.</p><small id="electricDocumentEditorCount">0 files attached</small></div></section>`;
}
function fuelReceiptScannerFields(){
  return `<section class="document-scanner-entry fuel-receipt-scanner-entry"><div class="document-scanner-entry-heading"><div><small>HIGGINS HUB SCANNER</small><b>Fuel / DEF receipt</b><p>Scan one receipt—even when it contains both fuel and DEF. Review the suggested values before saving.</p></div><button class="primary" id="openFuelReceiptScanner" type="button">Take or add receipt</button></div><div id="fuelReceiptDocumentPreview" class="fuel-receipt-document-preview"><div class="note-photo-empty">No receipt attached yet.</div></div><div class="electric-document-editor-footer"><p id="fuelReceiptScannerStatus">Nothing is uploaded until you add a receipt.</p><small>Low-confidence fields will be highlighted for review.</small></div></section>`;
}
function multiReceiptFields(help){
  return `<section class="note-photo-editor seasonal-receipt-editor"><div class="note-photo-editor-heading"><div><b>Receipts and documents</b><p>${help}</p></div><div class="stay-photo-actions"><label class="secondary photo-picker">Take photo<input id="multiReceiptCameraFile" type="file" accept="image/*" capture="environment" hidden></label><label class="secondary photo-picker">Choose pictures<input id="multiReceiptFiles" type="file" accept="image/*" multiple hidden></label></div></div><div id="multiReceiptGrid" class="note-photo-editor-grid"></div><small id="multiReceiptCount">0 of 6 pictures</small></section>`;
}
function tripPlanAttachmentFields(){
  return `<section class="trip-plan-attachment-editor note-photo-editor"><div class="note-photo-editor-heading"><div><b>Pictures &amp; PDFs</b><p>Add confirmation pictures, tickets, itineraries, or reservation PDFs in one place.</p></div><div class="stay-photo-actions"><label class="secondary photo-picker">Take photo<input id="multiReceiptCameraFile" type="file" accept="image/*" capture="environment" hidden></label><label class="secondary photo-picker">Choose files<input id="planAttachmentFiles" type="file" accept="image/*,application/pdf,.pdf" multiple hidden></label></div></div><div class="trip-attachment-group"><div class="trip-attachment-subheading"><b>Pictures</b><small id="multiReceiptCount">0 of 6</small></div><div id="multiReceiptGrid" class="note-photo-editor-grid"></div></div><div class="trip-attachment-group"><div class="trip-attachment-subheading"><b>PDF documents</b><small id="planPdfCount">0 of 6</small></div><div class="plan-pdf-list" id="planPdfList"><span>No PDFs attached</span></div></div></section>`;
}
function notePhotoFields(){
  return `<section class="note-photo-editor"><div class="note-photo-editor-heading"><div><b>Pictures</b><p>Add up to six pictures from your phone.</p></div><label class="secondary photo-picker">Choose pictures<input id="notePhotoFiles" type="file" accept="image/*" multiple hidden></label></div><div id="notePhotoEditorGrid" class="note-photo-editor-grid"></div><small id="notePhotoCount">0 of 6 pictures</small></section>`;
}
function noteTripOptions(){
  return db.tripSummaries.slice().sort((a,b)=>tripStamp(b).localeCompare(tripStamp(a))).map(trip=>{
    const [start]=tripDates(trip);
    return `<option value="${escapeHtml(trip._cloudId||'')}" ${trip._cloudId?'':'disabled'}>${escapeHtml(trip.name)} · ${date(start)}</option>`;
  }).join('');
}
function fields(type){
  if(type==='hub-note') return `<label>Title<input id="name" required maxlength="120"></label><label>Related trip<select id="noteTripId"><option value="">No related trip</option>${noteTripOptions()}</select></label><label class="note-pinned-toggle"><input id="notePinned" type="checkbox"><span><b>Pin this note</b><small>Keep it at the top of Notes and guarantee it appears on Home.</small></span></label><label class="note-checklist-toggle"><input id="noteChecklist" type="checkbox"> Use checkboxes</label><div class="checklist-editor" id="checklistEditor" hidden></div><button type="button" class="secondary add-checklist-item" id="addChecklistItem" hidden>+ Add item</button>`;
  if(type==='trip') return `<label>Trip name<input id="name" required></label><div class="two"><label>Start date<input id="startDate" type="date" required></label><label>End date<input id="endDate" type="date" required></label></div><section class="trip-photo-editor"><div class="stay-photo-editors-heading"><b>On the Road Again</b><p>The photo you take near the start of this trip. It becomes the cover of the trip card.</p></div><div class="trip-photo-preview" id="onRoadPhotoPreview"><span>No photo yet</span></div><div class="stay-photo-actions"><label class="secondary photo-picker">Choose photo<input id="onRoadPhotoFile" type="file" accept="image/*" hidden></label><button class="delete-link remove-stay-photo" id="removeOnRoadPhoto" type="button" hidden>Remove</button></div></section><div class="trip-stays-heading"><div><b>Places you are staying</b><p class="field-help">Each stop opens in its own window, then appears here as a card.</p></div><button type="button" class="secondary small-add" id="addTripStay">Add stay</button></div><div id="tripStaysEditor" class="trip-stays-editor"></div>`;
  if(type==='trip-plan') return `<label>Related trip<select id="planTripId" required><option value="">Choose a trip</option>${noteTripOptions()}</select></label><label>Plan or reservation name<input id="name" required maxlength="160" placeholder="Acadia sunrise, Dry Tortugas day trip…"></label><div class="two"><label>Type<select id="planType"><option value="activity">Activity</option><option value="tour">Tour</option><option value="reservation">Reservation</option><option value="dining">Dining</option><option value="transportation">Transportation</option><option value="other">Other</option></select></label><label>Status<select id="planStatus"><option value="planned">Planned</option><option value="reserved">Reserved</option><option value="paid">Paid</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></div><div class="three"><label>Date<input id="date" type="date" required></label><label>Start time<input id="planStartTime" type="time"></label><label>End time<input id="planEndTime" type="time"></label></div><label>Location name<input id="planLocationName" placeholder="Cadillac Mountain, ferry terminal…"></label><label>Address<input id="address"></label><div class="three"><label>City<input id="city" autocomplete="address-level2"></label><label>State<select id="state" autocomplete="address-level1">${stateOptions()}</select></label><label>ZIP code<input id="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10"></label></div><div class="two"><label>Confirmation code<input id="planConfirmation"></label><label>Cost<input id="total" type="number" min="0" step=".01"></label></div><label>Website or ticket link<input id="planWebsite" inputmode="url" placeholder="https://…"></label>${tripPlanAttachmentFields()}`;
  if(type==='fuel'||type==='def'){
    const options=db.tripSummaries.slice().sort((a,b)=>tripStamp(b).localeCompare(tripStamp(a))).map(t=>`<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('');
    return `${fuelReceiptScannerFields()}<section class="fuel-entry-basics"><label>Purchase type<select id="purchaseType" required><option value="fuel">Fuel</option><option value="def">DEF</option><option value="fuel_def">Fuel + DEF</option></select></label><div class="two"><label>Date<input id="date" type="date" required></label><label>Trip<select id="tripName"><option value="${NO_TRIP_VALUE}">${NO_TRIP_LABEL}</option>${options}</select></label></div><p class="field-help fuel-trip-help">Everyday Ruby is a complete no-trip entry. Choose a trip only when this purchase belongs to one.</p><label>Station / store<input id="station" required></label><div class="two"><label>City<input id="city" autocomplete="address-level2"></label><label>State<select id="state" autocomplete="address-level1">${stateOptions()}</select></label></div><details class="fuel-more-details"><summary>More receipt details</summary><div class="two"><label>Time<input id="purchaseTime" type="time"></label><label>Street address<input id="address" autocomplete="street-address"></label></div></details></section><section class="purchase-fields fuel-purchase-fields" id="fuelPurchaseFields"><div class="purchase-fields-heading"><b>Fuel</b><small>Trip MPG is calculated only when this purchase belongs to a trip.</small></div><div class="three"><label>Fuel gallons<input id="gallons" type="number" min=".001" step=".001"></label><label>Fuel price / gallon<input id="pricePerGallon" type="number" min="0" step=".001"></label><label>Fuel total<input id="total" type="number" min="0" step=".01"></label></div><div class="two"><label>Fuel type<select id="fuelType"><option value="diesel">Diesel</option><option value="gasoline">Gasoline</option></select></label><label id="tripMeterField">Trip meter<input id="tripMeter" type="number" min="0" step=".1"><small>Needed only for trip MPG.</small></label></div><div class="fuel-calculations" id="fuelCalculations"><span><span id="fuelMpgLabel">Trip MPG</span> <b>—</b></span><span>Tank miles <b>—</b></span></div></section><section class="purchase-fields def-purchase-fields" id="defPurchaseFields"><div class="purchase-fields-heading"><b>DEF</b><small>No trip-meter reading is needed.</small></div><div class="three"><label>DEF gallons<input id="defGallons" type="number" min=".001" step=".001"></label><label>DEF price / gallon<input id="defPricePerGallon" type="number" min="0" step=".001"></label><label>DEF total<input id="defTotal" type="number" min="0" step=".01"></label></div></section><label>Odometer<input id="odometer" type="number" min="0" step=".1"></label>`;
  }
  if(type==='stay') return `<div class="two"><label>Arrival<input id="arrival" type="date" required></label><label>Departure<input id="departure" type="date"></label></div><div class="two"><label>Check-in time<input id="checkInTime" type="time" value="12:00"></label><label>Check-out time<input id="checkOutTime" type="time" value="12:00"></label></div><label>Campground<input id="name" required></label><label>Address<input id="address"></label><div class="three"><label>City<input id="city"></label><label>State<select id="state">${stateOptions()}</select></label><label>ZIP code<input id="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10"></label></div><div class="two"><label>Site<input id="site"></label><label>Total cost<input id="total" type="number" step=".01"></label></div><div class="stay-type-options"><label><input id="harvestHost" type="checkbox"> Harvest Host</label><label><input id="moochdocking" type="checkbox"> Moochdocking</label><label><input id="boondocking" type="checkbox"> Boondocking</label></div><section class="stay-photo-editors"><div class="stay-photo-editors-heading"><b>Stay photos</b><p>Add these from Kayla’s photo library now or come back later.</p></div>${stayPhotoEditorSlot('site','Campsite','The campsite photo you take at nearly every stop.')}${stayPhotoEditorSlot('sign','Sign','The entrance, campground, winery, farm, or host sign.')}</section>`;
  if(type==='electric') return `<div class="two"><label>Reading date<input id="date" type="date" required></label><label>Paid date<input id="paid" type="date"></label></div><div class="three"><label>Previous meter<input id="previous" type="number" required></label><label>Current meter<input id="current" type="number" required></label><label>Rate / kWh<input id="rate" type="number" step=".001" value=".16"></label></div><div class="two"><label>Amount due<input id="amountDue" type="number" min="0" step=".01"></label><label>Check number<input id="check"></label></div>${documentScannerFields()}`;
  if(type==='sitepayment') return `<div class="three"><label>Season year<input id="year" type="number" value="${new Date().getFullYear()}" required></label><label>Payment date<input id="date" type="date" required></label><label>Amount<input id="payment" type="number" step=".01" required></label></div><label>Check number<input id="check"></label>${multiReceiptFields('Add up to six pictures for this seasonal-fee payment.')}`;
  if(type==='sitefee'){
    const currentSite=db.stays.find(x=>x.arrival==='Season')||{};
    return `<div class="three"><label>Year<input id="year" type="number" value="${new Date().getFullYear()}" required></label><label>Seasonal fee<input id="total" type="number" step=".01"></label><label>Site<input id="site" value="${escapeHtml(currentSite.site||'')}"></label></div><label>Address<input id="address" value="${escapeHtml(currentSite.address||'')}"></label><div class="three"><label>City<input id="city" value="${escapeHtml(currentSite.city||'')}"></label><label>State<input id="state" value="${escapeHtml(currentSite.state||'')}"></label><label>ZIP<input id="zip" value="${escapeHtml(currentSite.zip||'')}"></label></div>`;
  }
  const trailerField=type.startsWith('phillis-')?`<label>Trailer<select id="trailer" required><option value="Phillis II.0">Phillis II.0 · 2026 Brinkley Model I265</option><option value="Phillis">Phillis · 2020 Kodiak Ultralite 289BHSL</option></select></label>`:'';
  return `${trailerField}<label>Date<input id="date" type="date" required></label><label>${type.includes('upgrade')?'Upgrade':'Work performed'}<input id="description" required></label><div class="two"><label>Vendor / location<input id="location"></label><label>Cost<input id="total" type="number" step=".01"></label></div>${multiReceiptFields('Add up to six pictures of receipts, invoices, work orders, or related documents.')}`;
}
function bindOpeners(){$$('[data-open]').forEach(b=>b.onclick=()=>openEntry(b.dataset.open))}
let tripStayEditorItems=[];
let tripOriginalStayIndices=new Set();
let tripStayModalIndex=null;
function blankTripStay(start='',end=''){
  return {dbIndex:null,arrival:start,departure:end,checkInTime:'12:00',checkOutTime:'12:00',name:'',address:'',city:'',state:'',site:'',price:'',harvestHost:false,moochdocking:false,boondocking:false,stayType:'campground',notes:''};
}
function renderTripStayEditor(){
  const host=$('#tripStaysEditor'); if(!host)return;
  host.innerHTML=tripStayEditorItems.map((stay,i)=>{
    const type=stay.harvestHost||stay.stayType==='harvest-host'?'Harvest Host':stay.moochdocking||stay.stayType==='moochdocking'?'Moochdocking':stay.boondocking||stay.stayType==='boondocking'?'Boondocking':'Campground';
    const location=[stay.city,stay.state].filter(Boolean).join(', ');
    return `<article class="trip-stay-summary"><button type="button" class="trip-stay-summary-main" data-edit-trip-stay="${i}"><span class="trip-stay-order">${i+1}</span><span class="trip-stay-summary-copy"><small>${escapeHtml(type)}</small><b>${escapeHtml(stay.name||'Unnamed stay')}</b><span>${date(stay.arrival)} – ${date(stay.departure)}${stay.site?` · Site ${escapeHtml(stay.site)}`:''}${location?` · ${escapeHtml(location)}`:''}</span></span><span class="record-chevron">›</span></button><button type="button" class="remove-stay" data-remove-stay="${i}">Remove</button></article>`;
  }).join('')||'<div class="empty compact-empty">No stays added yet.</div>';
  $$('[data-edit-trip-stay]',host).forEach(button=>button.onclick=()=>openTripStayEditor(+button.dataset.editTripStay));
  $$('[data-remove-stay]',host).forEach(button=>button.onclick=()=>{tripStayEditorItems.splice(+button.dataset.removeStay,1);renderTripStayEditor()});
}
function readTripStayCards(){
  return tripStayEditorItems.filter(stay=>stay.name).map(stay=>({...stay}));
}
function nextTripStayDates(){
  const start=$('#startDate')?.value||'';
  const end=$('#endDate')?.value||start;
  const last=tripStayEditorItems[tripStayEditorItems.length-1];
  return {start:last?.departure||start,end};
}
function syncTripStayTypeFields(){
  const cost=$('#tripStayCost');
  const site=$('#tripStaySite');
  const checks=[
    {input:$('#tripStayHarvestHost'),code:'HH'},
    {input:$('#tripStayMoochdocking'),code:'MD'},
    {input:$('#tripStayBoondocking'),code:'BD'}
  ];
  cost.disabled=false;
  checks.forEach(item=>item.input.onchange=()=>{
    if(item.input.checked){
      checks.forEach(other=>{if(other!==item)other.input.checked=false;});
      site.value=item.code;
      cost.value='0';
    }
  });
}
function openTripStayEditor(index=null){
  const dates=nextTripStayDates();
  const stay=index===null?blankTripStay(dates.start,dates.end):tripStayEditorItems[index];
  tripStayModalIndex=index;
  $('#tripStayDialogTitle').textContent=index===null?'Add stay':'Edit stay';
  $('#tripStayArrival').value=stay.arrival||dates.start;
  $('#tripStayDeparture').value=stay.departure||dates.end;
  $('#tripStayCheckIn').value=String(stay.checkInTime||'12:00').slice(0,5);
  $('#tripStayCheckOut').value=String(stay.checkOutTime||'12:00').slice(0,5);
  $('#tripStayName').value=stay.name||'';
  $('#tripStayAddress').value=stay.address||'';
  $('#tripStayCity').value=stay.city||'';
  $('#tripStayState').value=stay.state||'';
  $('#tripStayZip').value=stay.zip||'';
  $('#tripStaySite').value=stay.site||'';
  $('#tripStayCost').value=stay.price??'';
  $('#tripStayHarvestHost').checked=Boolean(stay.harvestHost||stay.stayType==='harvest-host');
  $('#tripStayMoochdocking').checked=Boolean(stay.moochdocking||stay.stayType==='moochdocking');
  $('#tripStayBoondocking').checked=Boolean(stay.boondocking||stay.stayType==='boondocking');
  $('#tripStayNotes').value=stay.notes||'';
  $('#tripStayCost').disabled=false;
  syncTripStayTypeFields();
  $('#tripStayDialog').showModal();
}
let stayPhotoPreviewUrls=[];
function clearStayPhotoPreviewUrls(){
  stayPhotoPreviewUrls.forEach(url=>URL.revokeObjectURL(url));
  stayPhotoPreviewUrls=[];
}
function bindStayPhotoEditor(stay={}){
  clearStayPhotoPreviewUrls();
  [
    {kind:'site',url:stay.sitePhotoUrl,label:'Campsite'},
    {kind:'sign',url:stay.signPhotoUrl,label:'Sign'}
  ].forEach(photo=>{
    const input=$(`#${photo.kind}PhotoFile`);
    const preview=$(`#${photo.kind}PhotoPreview`);
    const remove=$(`#remove${photo.kind[0].toUpperCase()+photo.kind.slice(1)}Photo`);
    if(!input||!preview||!remove)return;
    const show=url=>{
      preview.innerHTML=url?`<img src="${escapeHtml(url)}" alt="${escapeHtml(photo.label)}">`:'<span>No photo yet</span>';
      remove.hidden=!url;
    };
    input.dataset.remove='false';
    show(photo.url||'');
    input.addEventListener('change',()=>{
      input.dataset.remove='false';
      const file=input.files?.[0];
      if(!file){show(photo.url||'');return;}
      const url=URL.createObjectURL(file);
      stayPhotoPreviewUrls.push(url);
      show(url);
    });
    remove.addEventListener('click',()=>{
      input.value='';
      input.dataset.remove='true';
      show('');
    });
  });
}
function bindTripPhotoEditor(trip={}){
  clearStayPhotoPreviewUrls();
  const input=$('#onRoadPhotoFile');
  const preview=$('#onRoadPhotoPreview');
  const remove=$('#removeOnRoadPhoto');
  if(!input||!preview||!remove)return;
  const show=url=>{
    preview.innerHTML=url?`<img src="${escapeHtml(url)}" alt="On the Road Again">`:'<span>No photo yet</span>';
    remove.hidden=!url;
  };
  input.dataset.remove='false';
  show(trip.onRoadPhotoUrl||'');
  input.addEventListener('change',()=>{
    input.dataset.remove='false';
    const file=input.files?.[0];
    if(!file){show(trip.onRoadPhotoUrl||'');return;}
    const url=URL.createObjectURL(file);
    stayPhotoPreviewUrls.push(url);
    show(url);
  });
  remove.addEventListener('click',()=>{
    input.value='';
    input.dataset.remove='true';
    show('');
  });
}
let receiptEditorSelectedFile=null;
function bindReceiptEditor(record={}){
  clearStayPhotoPreviewUrls();
  const input=$('#receiptPhotoFile');
  const cameraInput=$('#receiptCameraFile');
  const preview=$('#receiptPhotoPreview');
  const remove=$('#removeReceiptPhoto');
  if(!input||!cameraInput||!preview||!remove)return;
  const show=url=>{
    preview.innerHTML=url?`<img src="${escapeHtml(url)}" alt="Receipt photo">`:'<span>No receipt yet</span>';
    remove.hidden=!url;
  };
  const selectFile=file=>{
    input.dataset.remove='false';
    receiptEditorSelectedFile=file||null;
    if(!file){show(record.receiptPhotoUrl||'');return;}
    const url=URL.createObjectURL(file);
    stayPhotoPreviewUrls.push(url);
    show(url);
  };
  input._selectReceiptFile=selectFile;
  receiptEditorSelectedFile=null;
  input.dataset.remove='false';
  show(record.receiptPhotoUrl||'');
  input.addEventListener('change',()=>selectFile(input.files?.[0]));
  cameraInput.addEventListener('change',()=>selectFile(cameraInput.files?.[0]));
  remove.addEventListener('click',()=>{
    input.value='';
    cameraInput.value='';
    input.dataset.remove='true';
    receiptEditorSelectedFile=null;
    show('');
  });
}
let fuelReceiptScannerState={document:null,originalDocumentId:'',draftDocumentId:'',approval:null};
function discardPendingFuelReceiptDraft(){
  const documentId=fuelReceiptScannerState.draftDocumentId;
  fuelReceiptScannerState.draftDocumentId='';
  if(documentId&&window.ADVENTURE_HUB_STORE?.discardHubDocumentDraft){
    window.ADVENTURE_HUB_STORE.discardHubDocumentDraft(documentId).catch(error=>console.warn('The unused fuel receipt draft could not be removed.',error));
  }
}
function clearFuelReceiptScanner({discardDraft=false}={}){
  if(discardDraft)discardPendingFuelReceiptDraft();
  fuelReceiptScannerState={document:null,originalDocumentId:'',draftDocumentId:'',approval:null};
}
function renderFuelReceiptScanner(){
  const host=$('#fuelReceiptDocumentPreview');
  const status=$('#fuelReceiptScannerStatus');
  const button=$('#openFuelReceiptScanner');
  if(!host||!status||!button)return;
  const document=fuelReceiptScannerState.document;
  const file=document?.documentFiles?.find(item=>/^image\//i.test(item.mimeType||''))||document?.documentFiles?.[0];
  if(!file?.url){
    host.innerHTML='<div class="note-photo-empty">No receipt attached yet.</div>';
    status.textContent='Nothing is uploaded until you add a receipt.';
    button.textContent='Take or add receipt';
    return;
  }
  host.innerHTML=`<button class="fuel-receipt-document-card" id="openFuelReceiptReview" type="button"><img src="${escapeHtml(file.url)}" alt="Fuel or DEF receipt"><span><b>${escapeHtml(document.documentTitle||'Scanned purchase receipt')}</b><small>${document.documentAiStatus==='review'?'Suggestions ready to review':document.documentAiStatus==='complete'?'Reviewed':fuelReceiptScannerState.draftDocumentId?'Scanned draft':'Saved receipt'}</small></span><span class="record-chevron">›</span></button>`;
  status.textContent=fuelReceiptScannerState.approval
    ?'Suggested values are loaded. Check the fuel stop, then tap Save.'
    :fuelReceiptScannerState.draftDocumentId
      ?'Receipt scanned. Open it to read or review the values.'
      :'This receipt is securely attached to the purchase.';
  button.textContent='Replace receipt';
  $('#openFuelReceiptReview').onclick=()=>openFuelReceiptDocumentReview(document,false);
}
function applyFuelReceiptSuggestions(document,result){
  const fields=result?.fields||{};
  const setValue=(selector,value)=>{const element=$(selector);if(element&&value!==null&&value!==undefined&&value!=='')element.value=value;};
  setValue('#date',fields.receipt_date);
  setValue('#purchaseTime',fields.receipt_time);
  setValue('#station',fields.station_name);
  setValue('#address',fields.address);
  setValue('#city',fields.city);
  setValue('#state',String(fields.state||'').toUpperCase());
  setValue('#purchaseType',fields.purchase_type);
  setValue('#fuelType',fields.fuel_type);
  setValue('#gallons',fields.gallons);
  setValue('#pricePerGallon',fields.price_per_gallon);
  setValue('#total',fields.total_cost);
  setValue('#tripMeter',fields.trip_meter);
  setValue('#odometer',fields.odometer);
  setValue('#defGallons',fields.def_gallons);
  setValue('#defPricePerGallon',fields.def_price_per_gallon);
  setValue('#defTotal',fields.def_total_cost);
  fuelReceiptScannerState.approval={
    documentId:document.documentId,
    corrections:{fields,reviewed_at:new Date().toISOString(),model:result?.model||''}
  };
  $('#purchaseType')?.dispatchEvent(new Event('change'));
  ['#gallons','#total','#tripMeter','#pricePerGallon','#defGallons','#defTotal','#defPricePerGallon'].forEach(selector=>$(selector)?.dispatchEvent(new Event('input')));
  renderFuelReceiptScanner();
}
function openFuelReceiptDocumentReview(document,autoAnalyze=false,editContext=null){
  if(!window.HIGGINS_DOCUMENT_REVIEW){alert('The document viewer is still loading. Please try again in a moment.');return;}
  window.HIGGINS_DOCUMENT_REVIEW.open({
    profile:'fuel_receipt',
    record:document,
    autoAnalyze,
    onExtracted:updated=>{
      Object.assign(document,updated);
      const collection=editContext?.kind==='def'?db.def:db.fuel;
      if(editContext?.index!=null&&collection?.[editContext.index])Object.assign(collection[editContext.index],updated);
      fuelReceiptScannerState.document=document;
      renderFuelReceiptScanner();
    },
    onUse:result=>{
      if(editContext?.index!=null&&!$('#entryDialog')?.open){
        const collection=editContext?.kind==='def'?db.def:db.fuel;
        if(collection?.[editContext.index])Object.assign(collection[editContext.index],document);
        closeDetailForTransition();
        openEntry(editContext?.kind==='def'?'def':'fuel',editContext.index,editContext.returnTripIndex??null);
      }
      applyFuelReceiptSuggestions(document,result);
    }
  });
}
function bindFuelReceiptScanner(record={}){
  clearFuelReceiptScanner();
  if(record.documentId&&(record.documentFiles||[]).length){
    fuelReceiptScannerState.document={...record,documentFiles:[...(record.documentFiles||[])]};
    fuelReceiptScannerState.originalDocumentId=record.documentId;
  }else if(record.receiptPhotoUrl){
    fuelReceiptScannerState.document={
      ...record,
      documentTitle:'Saved fuel receipt',
      documentType:'fuel_receipt',
      documentFiles:[{mimeType:'image/jpeg',originalFilename:'Fuel receipt',url:record.receiptPhotoUrl}]
    };
  }
  renderFuelReceiptScanner();
  const launch=$('#openFuelReceiptScanner');
  if(!launch)return;
  launch.onclick=()=>{
    if(!window.HIGGINS_DOCUMENT_SCANNER){alert('The scanner is still loading. Please try again in a moment.');return;}
    window.HIGGINS_DOCUMENT_SCANNER.open({
      title:'Fuel / DEF receipt',
      useLabel:'Read receipt',
      useOnlyLabel:'Use photo',
      allowPdfUse:false,
      preferFullImage:false,
      maxDimension:1600,
      quality:.82,
      cameraLabel:'Take receipt photo',
      fileLabel:'Choose receipt photo',
      emptyPrompt:'Take a receipt photo or choose one from your phone.',
      onUseOnly:async({file,metadata})=>saveFuelReceiptScan(file,metadata,false),
      onUse:async({file,metadata})=>saveFuelReceiptScan(file,metadata,true)
    });
    async function saveFuelReceiptScan(file,metadata,readReceipt){
        const status=$('#fuelReceiptScannerStatus');
        launch.disabled=true;
        if(status)status.textContent='Securely saving the cleaned receipt…';
        try{
          discardPendingFuelReceiptDraft();
          const document=await window.ADVENTURE_HUB_STORE.createFuelReceiptDraft(file,metadata);
          fuelReceiptScannerState.document=document;
          fuelReceiptScannerState.draftDocumentId=document.documentId;
          fuelReceiptScannerState.approval=null;
          renderFuelReceiptScanner();
          if(readReceipt){
            if(status)status.textContent='Receipt saved. Starting the reader…';
            setTimeout(()=>openFuelReceiptDocumentReview(document,true),0);
          }else if(status){
            status.textContent='Receipt saved. Enter the fuel-stop details, then tap Save.';
          }
          return true;
        }catch(error){
          console.error(error);
          if(status)status.textContent='The receipt was not uploaded.';
          throw new Error(`The fuel receipt could not be prepared. ${error.message||error}`);
        }finally{launch.disabled=false;}
    }
  };
}
let electricDocumentEditorState={items:[],initialOrder:'',changed:false,readAfterSave:false,draftDocument:null,draftDocumentId:''};
function clearElectricDocumentEditor({discardDraft=false}={}){
  const draftDocumentId=electricDocumentEditorState.draftDocumentId;
  electricDocumentEditorState.items.forEach(item=>item.url&&(/^blob:/i.test(item.url)||item.kind==='pending')&&URL.revokeObjectURL(item.url));
  electricDocumentEditorState={items:[],initialOrder:'',changed:false,readAfterSave:false,draftDocument:null,draftDocumentId:''};
  if(discardDraft&&draftDocumentId&&window.ADVENTURE_HUB_STORE?.discardHubDocumentDraft){
    window.ADVENTURE_HUB_STORE.discardHubDocumentDraft(draftDocumentId).catch(error=>console.warn('The unused electric-bill draft could not be removed.',error));
  }
}
function electricDocumentItemKey(item){
  return item.kind==='existing'?`existing:${item.fileId}`:item.kind==='legacy'?`legacy:${item.legacyPath}`:`pending:${item.token}`;
}
function renderElectricDocumentEditor(){
  const host=$('#electricDocumentEditorList');
  const count=$('#electricDocumentEditorCount');
  if(!host||!count)return;
  const items=electricDocumentEditorState.items;
  host.innerHTML=items.length?items.map((item,index)=>{
    const isPdf=item.mimeType==='application/pdf'||/\.pdf$/i.test(item.originalFilename||item.file?.name||'');
    const name=item.originalFilename||item.file?.name||(isPdf?'Electric bill.pdf':`Scanned page ${index+1}`);
    const preview=isPdf
      ?`<a class="plan-pdf-link electric-document-editor-preview" href="${escapeHtml(item.url||'#')}" ${item.url?'target="_blank" rel="noopener"':''}><span class="plan-pdf-icon">PDF</span><span><b>${escapeHtml(name)}</b><small>${item.kind==='pending'?'Ready to upload':'Saved in Higgins Documents'}</small></span><span aria-hidden="true">↗</span></a>`
      :item.url
        ?`<button class="electric-document-editor-image" type="button" data-photo-url="${escapeHtml(item.url)}" data-photo-label="${escapeHtml(`Electric bill page ${index+1}`)}"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(`Electric bill page ${index+1}`)}"></button>`
        :`<span class="note-photo-missing">Page ${index+1}</span>`;
    const orderButtons=items.length>1?`<button class="secondary" type="button" data-electric-document-up="${index}" ${index===0?'disabled':''} aria-label="Move file earlier">↑</button><button class="secondary" type="button" data-electric-document-down="${index}" ${index===items.length-1?'disabled':''} aria-label="Move file later">↓</button>`:'';
    return `<article class="electric-document-editor-item"><span class="electric-document-page-number">${index+1}</span>${preview}<div class="electric-document-editor-copy"><b>${isPdf?'PDF document':`Page ${index+1}`}</b><small>${item.fileSizeBytes?`${number(item.fileSizeBytes/1024,0)} KB · `:''}${item.kind==='pending'?'Ready to save':'Saved'}</small></div><div class="electric-document-order-actions">${orderButtons}<button class="delete-link" type="button" data-electric-document-remove="${index}">Remove ${isPdf?'PDF':'page'}</button></div></article>`;
  }).join(''):'<div class="note-photo-empty">No bill pages or PDFs attached yet.</div>';
  count.textContent=`${items.length} ${items.length===1?'file':'files'} attached · no set limit`;
  const launch=$('#openDocumentScanner');
  if(launch)launch.textContent=items.length?'Add another page or PDF':'Scan or add document';
  $$('[data-electric-document-up]',host).forEach(button=>button.onclick=()=>moveElectricDocumentItem(+button.dataset.electricDocumentUp,-1));
  $$('[data-electric-document-down]',host).forEach(button=>button.onclick=()=>moveElectricDocumentItem(+button.dataset.electricDocumentDown,1));
  $$('[data-electric-document-remove]',host).forEach(button=>button.onclick=()=>removeElectricDocumentItem(+button.dataset.electricDocumentRemove));
  bindStayPhotoButtons(host);
}
function moveElectricDocumentItem(index,direction){
  const target=index+direction;
  if(index<0||target<0||target>=electricDocumentEditorState.items.length)return;
  const [item]=electricDocumentEditorState.items.splice(index,1);
  electricDocumentEditorState.items.splice(target,0,item);
  electricDocumentEditorState.changed=true;
  renderElectricDocumentEditor();
  const status=$('#documentScannerAttachStatus');
  if(status)status.textContent='Page order updated. Tap Save bill to confirm the new order.';
}
function removeElectricDocumentItem(index){
  const [removed]=electricDocumentEditorState.items.splice(index,1);
  if(removed?.kind==='pending'&&removed.url)URL.revokeObjectURL(removed.url);
  electricDocumentEditorState.changed=true;
  renderElectricDocumentEditor();
  const status=$('#documentScannerAttachStatus');
  if(status)status.textContent=removed?.kind==='pending'
    ?'The unsaved file was removed.'
    :'The saved file will be removed when you tap Save bill. Tap Cancel to keep it.';
}
function addElectricDocumentFile(file,metadata={},readAfterSave=false){
  if(!file)return;
  const token=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
  try{Object.defineProperty(file,'higginsDocumentMetadata',{value:{...metadata},configurable:true});}catch{}
  const item={
    kind:'pending',
    token,
    file,
    url:URL.createObjectURL(file),
    originalFilename:file.name||'Electric bill document',
    mimeType:file.type||'application/octet-stream',
    fileSizeBytes:Number(file.size)||0
  };
  electricDocumentEditorState.items.push(item);
  electricDocumentEditorState.changed=true;
  electricDocumentEditorState.readAfterSave=Boolean(electricDocumentEditorState.readAfterSave||readAfterSave);
  renderElectricDocumentEditor();
  return item;
}
function bindElectricDocumentEditor(record={}){
  clearElectricDocumentEditor();
  const files=(record.documentFiles||[]).map(file=>({
    kind:'existing',
    fileId:file.id,
    documentId:file.documentId,
    originalFilename:file.originalFilename||'Electric bill page',
    mimeType:file.mimeType||'image/jpeg',
    fileSizeBytes:Number(file.fileSizeBytes)||0,
    storageBucket:file.storageBucket||'hub-documents',
    storagePath:file.storagePath||'',
    url:file.url||''
  }));
  if(!files.length&&record.receiptPhotoPath){
    files.push({
      kind:'legacy',
      legacyPath:record.receiptPhotoPath,
      originalFilename:`electric-bill-${record.date||'legacy'}.jpg`,
      mimeType:'image/jpeg',
      fileSizeBytes:0,
      url:record.receiptPhotoUrl||''
    });
  }
  electricDocumentEditorState.items=files;
  electricDocumentEditorState.initialOrder=files.map(electricDocumentItemKey).join('|');
  electricDocumentEditorState.changed=false;
  electricDocumentEditorState.readAfterSave=false;
  renderElectricDocumentEditor();
  const status=$('#documentScannerAttachStatus');
  if(status)status.textContent=files.length
    ?'Everything shown here is part of this bill document.'
    :'Add the first page, picture, or PDF for this bill.';
  bindDocumentScannerLauncher(record);
}
function electricDocumentChanges(){
  const order=electricDocumentEditorState.items.map(electricDocumentItemKey).join('|');
  if(!electricDocumentEditorState.changed&&order===electricDocumentEditorState.initialOrder)return null;
  return {
    items:electricDocumentEditorState.items.map(item=>item.kind==='pending'
      ?{file:item.file}
      :item.kind==='legacy'
        ?{legacyPath:item.legacyPath,originalFilename:item.originalFilename,mimeType:item.mimeType,fileSizeBytes:item.fileSizeBytes,url:item.url}
        :{fileId:item.fileId})
  };
}
function bindDocumentScannerLauncher(record={}){
  const launch=$('#openDocumentScanner');
  const status=$('#documentScannerAttachStatus');
  if(!launch)return;
  launch.onclick=()=>{
    if(!window.HIGGINS_DOCUMENT_SCANNER){
      alert('The scanner is still loading. Please try again in a moment.');
      return;
    }
    window.HIGGINS_DOCUMENT_SCANNER.open({
      title:'Lehigh Gorge electric bill',
      useLabel:'Read bill',
      useOnlyLabel:'Use document',
      allowPdfUse:true,
      preferFullImage:true,
      onUseOnly:({file,metadata})=>addBillDocument(file,metadata,false),
      onUse:({file,metadata})=>addBillDocument(file,metadata,true)
    });
    async function addBillDocument(file,metadata,readAfterSave){
        const addedItem=addElectricDocumentFile(file,metadata,readAfterSave);
        if(readAfterSave&&record?._cloudId&&window.ADVENTURE_HUB_STORE){
          if(status)status.textContent='Uploading the bill and starting the reader…';
          launch.disabled=true;
          try{
            const changes=electricDocumentChanges();
            await window.ADVENTURE_HUB_STORE.setElectricBillDocuments(record,changes);
            localStorage.setItem(KEY,JSON.stringify(db));
            const electricIndex=db.electric.indexOf(record);
            bindElectricDocumentEditor(record);
            if(status)status.textContent='Bill saved. The reader is opening now…';
            if(electricIndex>=0)setTimeout(()=>openElectricDocumentReview(record,electricIndex,true),0);
            return true;
          }catch(error){
            console.error(error);
            if(status)status.textContent='The bill could not be uploaded. Nothing was removed; please try again.';
            throw error;
          }finally{
            launch.disabled=false;
          }
        }
        if(readAfterSave&&!record?._cloudId&&window.ADVENTURE_HUB_STORE?.createElectricBillDraft){
          if(status)status.textContent='Uploading the bill and starting the reader…';
          launch.disabled=true;
          try{
            if(electricDocumentEditorState.draftDocumentId){
              await window.ADVENTURE_HUB_STORE.discardHubDocumentDraft(electricDocumentEditorState.draftDocumentId);
            }
            const document=await window.ADVENTURE_HUB_STORE.createElectricBillDraft(file,metadata);
            const itemIndex=electricDocumentEditorState.items.findIndex(item=>item.token===addedItem?.token);
            if(itemIndex>=0){
              const prior=electricDocumentEditorState.items[itemIndex];
              if(prior?.url)URL.revokeObjectURL(prior.url);
              const savedFile=document.documentFiles?.[0];
              electricDocumentEditorState.items[itemIndex]={
                kind:'existing',
                fileId:savedFile.id,
                documentId:document.documentId,
                originalFilename:savedFile.originalFilename,
                mimeType:savedFile.mimeType,
                fileSizeBytes:savedFile.fileSizeBytes,
                storageBucket:savedFile.storageBucket,
                storagePath:savedFile.storagePath,
                url:savedFile.url
              };
            }
            electricDocumentEditorState.draftDocument=document;
            electricDocumentEditorState.draftDocumentId=document.documentId;
            electricDocumentEditorState.changed=true;
            renderElectricDocumentEditor();
            if(status)status.textContent='Bill uploaded. The reader is opening now…';
            setTimeout(()=>openElectricDraftDocumentReview(document,true),0);
            return true;
          }catch(error){
            console.error(error);
            if(status)status.textContent='The bill could not be uploaded. Nothing was removed; please try again.';
            throw error;
          }finally{
            launch.disabled=false;
          }
        }
        if(status){
          const saved=Math.max(0,(metadata.originalBytes||0)-(metadata.optimizedBytes||0));
          const nextStep=readAfterSave?'Tap Save & read bill to upload it and start the reader.':'Add another file or save the electric record.';
          status.textContent=metadata.preservedOriginal
            ?`PDF added intact. ${nextStep}`
            :`Page prepared locally at ${metadata.width||'—'} × ${metadata.height||'—'}${saved?` · ${Math.round(saved/1024)} KB smaller`:''}. ${nextStep}`;
        }
        if(readAfterSave){
          const saveButton=$('#entryForm')?.querySelector('.form-actions .primary');
          if(saveButton){
            saveButton.textContent='Save & read bill';
            saveButton.classList.add('attention-pulse');
            saveButton.scrollIntoView({behavior:'smooth',block:'center'});
            setTimeout(()=>saveButton.focus({preventScroll:true}),350);
          }
        }
        return true;
    }
  };
}
let multiReceiptEditorState={existing:[],pending:[],removedPaths:new Set()};
function clearMultiReceiptEditor(){
  multiReceiptEditorState.pending.forEach(photo=>URL.revokeObjectURL(photo.url));
  multiReceiptEditorState={existing:[],pending:[],removedPaths:new Set()};
}
function renderMultiReceiptEditor(){
  const host=$('#multiReceiptGrid');
  const count=$('#multiReceiptCount');
  if(!host||!count)return;
  const existing=multiReceiptEditorState.existing.filter(photo=>!multiReceiptEditorState.removedPaths.has(photo.path));
  const pending=multiReceiptEditorState.pending;
  const items=[
    ...existing.map((photo,index)=>`<article class="note-photo-editor-item">${photo.url?`<button class="note-photo-preview-button" type="button" data-photo-url="${escapeHtml(photo.url)}" data-photo-label="${escapeHtml(`Receipt page ${index+1}`)}"><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(`Receipt page ${index+1}`)}"></button>`:'<span class="note-photo-missing">Receipt</span>'}<button class="remove-note-photo" type="button" data-remove-multi-receipt="${escapeHtml(photo.path)}">Remove</button></article>`),
    ...pending.map((photo,index)=>`<article class="note-photo-editor-item"><span class="note-photo-preview-button"><img src="${escapeHtml(photo.url)}" alt="New receipt picture"></span><button class="remove-note-photo" type="button" data-remove-pending-multi-receipt="${index}">Remove</button></article>`)
  ];
  host.innerHTML=items.join('')||`<div class="note-photo-empty">No ${$('#planAttachmentFiles')?'pictures':'receipts'} attached yet.</div>`;
  count.textContent=$('#planAttachmentFiles')?`${existing.length+pending.length} of 6`:`${existing.length+pending.length} of 6 pictures`;
  $$('[data-remove-multi-receipt]',host).forEach(button=>button.onclick=()=>{
    multiReceiptEditorState.removedPaths.add(button.dataset.removeMultiReceipt);
    renderMultiReceiptEditor();
  });
  $$('[data-remove-pending-multi-receipt]',host).forEach(button=>button.onclick=()=>{
    const index=+button.dataset.removePendingMultiReceipt;
    const [removed]=multiReceiptEditorState.pending.splice(index,1);
    if(removed)URL.revokeObjectURL(removed.url);
    renderMultiReceiptEditor();
  });
  bindStayPhotoButtons(host);
}
function addMultiReceiptFiles(files){
  const existingCount=multiReceiptEditorState.existing.filter(photo=>!multiReceiptEditorState.removedPaths.has(photo.path)).length;
  const available=Math.max(0,6-existingCount-multiReceiptEditorState.pending.length);
  const chosen=[...(files||[])];
  if(chosen.length>available)alert(`You can attach up to six pictures. ${available||'No'} more can be added to this record.`);
  chosen.slice(0,available).forEach(file=>multiReceiptEditorState.pending.push({file,url:URL.createObjectURL(file)}));
  renderMultiReceiptEditor();
}
function bindMultiReceiptEditor(record={}){
  clearMultiReceiptEditor();
  const paths=Array.isArray(record.receiptPhotoPaths)?record.receiptPhotoPaths:[];
  const urls=Array.isArray(record.receiptPhotoUrls)?record.receiptPhotoUrls:[];
  multiReceiptEditorState.existing=paths.map((path,index)=>({path,url:urls[index]||''}));
  renderMultiReceiptEditor();
  const input=$('#multiReceiptFiles');
  const cameraInput=$('#multiReceiptCameraFile');
  if(input)input.addEventListener('change',()=>{
    addMultiReceiptFiles(input.files);
    input.value='';
  });
  if(cameraInput)cameraInput.addEventListener('change',()=>{
    addMultiReceiptFiles(cameraInput.files);
    cameraInput.value='';
  });
}
function multiReceiptChanges(){
  return {
    addFiles:multiReceiptEditorState.pending.map(photo=>photo.file),
    removePaths:[...multiReceiptEditorState.removedPaths]
  };
}
let tripPlanPdfEditorState={existing:[],pending:[],removedDocumentIds:new Set()};
function clearTripPlanPdfEditor(){
  tripPlanPdfEditorState.pending.forEach(item=>URL.revokeObjectURL(item.url));
  tripPlanPdfEditorState={existing:[],pending:[],removedDocumentIds:new Set()};
}
function renderTripPlanPdfEditor(){
  const host=$('#planPdfList');
  const count=$('#planPdfCount');
  if(!host||!count)return;
  const existing=tripPlanPdfEditorState.existing.filter(file=>!tripPlanPdfEditorState.removedDocumentIds.has(file.documentId));
  const pending=tripPlanPdfEditorState.pending;
  const rows=[
    ...existing.map(file=>({kind:'existing',file,url:file.url||'',name:file.originalFilename||'Reservation document.pdf',size:file.fileSizeBytes||0,id:file.documentId})),
    ...pending.map((item,index)=>({kind:'pending',file:item.file,url:item.url,name:item.file.name||'Reservation document.pdf',size:item.file.size||0,index}))
  ];
  host.innerHTML=rows.length?rows.map(item=>`<article class="plan-pdf-editor-item"><a class="plan-pdf-link plan-pdf-link-editor" href="${escapeHtml(item.url||'#')}" ${item.url?'target="_blank" rel="noopener"':''}><span class="plan-pdf-icon">PDF</span><span><b>${escapeHtml(item.name)}</b><small>${item.size?`${number(item.size/1024,0)} KB · `:''}${item.kind==='pending'?'Ready to upload':'Saved in Higgins Documents'}</small></span><span aria-hidden="true">↗</span></a><button class="delete-link" type="button" ${item.kind==='existing'?`data-remove-plan-pdf-document="${escapeHtml(item.id)}"`:`data-remove-pending-plan-pdf="${item.index}"`}>Remove</button></article>`).join(''):'<span>No PDFs attached</span>';
  count.textContent=$('#planAttachmentFiles')?`${rows.length} of 6`:`${rows.length} of 6 PDFs`;
  $$('[data-remove-plan-pdf-document]',host).forEach(button=>button.onclick=()=>{
    tripPlanPdfEditorState.removedDocumentIds.add(button.dataset.removePlanPdfDocument);
    renderTripPlanPdfEditor();
  });
  $$('[data-remove-pending-plan-pdf]',host).forEach(button=>button.onclick=()=>{
    const index=+button.dataset.removePendingPlanPdf;
    const [removed]=tripPlanPdfEditorState.pending.splice(index,1);
    if(removed?.url)URL.revokeObjectURL(removed.url);
    renderTripPlanPdfEditor();
  });
}
function addTripPlanPdfFiles(files){
  const chosen=[...(files||[])];
  const existingCount=tripPlanPdfEditorState.existing.filter(file=>!tripPlanPdfEditorState.removedDocumentIds.has(file.documentId)).length;
  let available=Math.max(0,6-existingCount-tripPlanPdfEditorState.pending.length);
  for(const file of chosen){
    if(!(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))){
      alert(`${file.name||'That file'} is not a PDF.`);
      continue;
    }
    if(file.size>25*1024*1024){
      alert(`${file.name||'That PDF'} is larger than the 25 MB document limit.`);
      continue;
    }
    if(available<=0){
      alert('An activity can have up to six PDF documents.');
      break;
    }
    tripPlanPdfEditorState.pending.push({file,url:URL.createObjectURL(file)});
    available-=1;
  }
  renderTripPlanPdfEditor();
}
function bindTripPlanPdfEditor(record={}){
  clearTripPlanPdfEditor();
  tripPlanPdfEditorState.existing=(record.documentAttachments||[]).filter(file=>file.mimeType==='application/pdf'||/\.pdf$/i.test(file.originalFilename||''));
  renderTripPlanPdfEditor();
  const input=$('#planPdfFiles');
  if(!input)return;
  input.addEventListener('change',()=>{
    addTripPlanPdfFiles(input.files);
    input.value='';
  });
}
function bindTripPlanAttachmentPicker(){
  const input=$('#planAttachmentFiles');
  if(!input)return;
  input.addEventListener('change',()=>{
    const chosen=[...(input.files||[])];
    const pictures=chosen.filter(file=>String(file.type||'').startsWith('image/'));
    const pdfs=chosen.filter(file=>file.type==='application/pdf'||/\.pdf$/i.test(file.name||''));
    const unsupported=chosen.filter(file=>!pictures.includes(file)&&!pdfs.includes(file));
    if(unsupported.length)alert(`${unsupported[0].name||'A selected file'} is not a supported picture or PDF.`);
    if(pictures.length)addMultiReceiptFiles(pictures);
    if(pdfs.length)addTripPlanPdfFiles(pdfs);
    input.value='';
  });
}
function tripPlanPdfChanges(){
  const changes={
    addFiles:tripPlanPdfEditorState.pending.map(item=>item.file),
    removeDocumentIds:[...tripPlanPdfEditorState.removedDocumentIds]
  };
  return changes.addFiles.length||changes.removeDocumentIds.length?changes:null;
}
let notePhotoEditorState={existing:[],pending:[],removedPaths:new Set()};
function clearNotePhotoEditor(){
  notePhotoEditorState.pending.forEach(photo=>URL.revokeObjectURL(photo.url));
  notePhotoEditorState={existing:[],pending:[],removedPaths:new Set()};
}
function renderNotePhotoEditor(){
  const host=$('#notePhotoEditorGrid');
  const count=$('#notePhotoCount');
  if(!host||!count)return;
  const existing=notePhotoEditorState.existing.filter(photo=>!notePhotoEditorState.removedPaths.has(photo.path));
  const pending=notePhotoEditorState.pending;
  const items=[
    ...existing.map(photo=>`<article class="note-photo-editor-item">${photo.url?`<button class="note-photo-preview-button" type="button" data-photo-url="${escapeHtml(photo.url)}" data-photo-label="Note picture"><img src="${escapeHtml(photo.url)}" alt="Picture attached to this note"></button>`:'<span class="note-photo-missing">Picture</span>'}<button class="remove-note-photo" type="button" data-remove-note-photo="${escapeHtml(photo.path)}">Remove</button></article>`),
    ...pending.map((photo,index)=>`<article class="note-photo-editor-item"><span class="note-photo-preview-button"><img src="${escapeHtml(photo.url)}" alt="New picture for this note"></span><button class="remove-note-photo" type="button" data-remove-pending-photo="${index}">Remove</button></article>`)
  ];
  host.innerHTML=items.join('')||'<div class="note-photo-empty">No pictures attached yet.</div>';
  count.textContent=`${existing.length+pending.length} of 6 pictures`;
  $$('[data-remove-note-photo]',host).forEach(button=>button.onclick=()=>{
    notePhotoEditorState.removedPaths.add(button.dataset.removeNotePhoto);
    renderNotePhotoEditor();
  });
  $$('[data-remove-pending-photo]',host).forEach(button=>button.onclick=()=>{
    const index=+button.dataset.removePendingPhoto;
    const [removed]=notePhotoEditorState.pending.splice(index,1);
    if(removed)URL.revokeObjectURL(removed.url);
    renderNotePhotoEditor();
  });
  bindStayPhotoButtons(host);
}
function bindNotePhotoEditor(note={}){
  clearNotePhotoEditor();
  const paths=Array.isArray(note.photoPaths)?note.photoPaths:[];
  const urls=Array.isArray(note.photoUrls)?note.photoUrls:[];
  notePhotoEditorState.existing=paths.map((path,index)=>({path,url:urls[index]||''}));
  renderNotePhotoEditor();
  const input=$('#notePhotoFiles');
  if(!input)return;
  input.addEventListener('change',()=>{
    const existingCount=notePhotoEditorState.existing.filter(photo=>!notePhotoEditorState.removedPaths.has(photo.path)).length;
    const available=Math.max(0,6-existingCount-notePhotoEditorState.pending.length);
    const chosen=[...(input.files||[])];
    if(chosen.length>available)alert(`You can attach up to six pictures. ${available||'No'} more can be added to this note.`);
    chosen.slice(0,available).forEach(file=>notePhotoEditorState.pending.push({file,url:URL.createObjectURL(file)}));
    input.value='';
    renderNotePhotoEditor();
  });
}
function notePhotoChanges(){
  return {
    addFiles:notePhotoEditorState.pending.map(photo=>photo.file),
    removePaths:[...notePhotoEditorState.removedPaths]
  };
}
function openEntry(type,index=null,returnTripIndex=null){
  const titles={'hub-note':index===null?'Add note':'Edit note',trip:index===null?'Add trip':'Edit trip','trip-plan':index===null?'Add plan or reservation':'Edit plan or reservation',fuel:index===null?'Add fuel or DEF':'Edit fuel stop',def:index===null?'Add DEF':'Edit DEF purchase',stay:index===null?'Add campground':'Edit stay','phillis-maint':index===null?'Add Phillis maintenance':'Edit Phillis maintenance','phillis-upgrade':index===null?'Add Phillis upgrade':'Edit Phillis upgrade','ruby-maint':index===null?'Add Ruby maintenance':'Edit Ruby maintenance','ruby-upgrade':index===null?'Add Ruby upgrade':'Edit Ruby upgrade',electric:index===null?'Add electric reading':'Edit electric reading',sitepayment:index===null?'Add seasonal payment':'Edit seasonal payment',sitefee:index===null?'Add season':'Edit season'};
  $('#entryType').value=type; $('#entryIndex').value=index===null?'':index; $('#entryStayIndex').value=returnTripIndex===null?'':returnTripIndex;
  entryReturnTripIndex=returnTripIndex;
  $('#entryKicker').textContent=index===null?'NEW RECORD':'EDIT RECORD';
  $('#entryTitle').textContent=titles[type]; $('#entryFields').innerHTML=fields(type); $('#entryExtras').innerHTML=type==='hub-note'?notePhotoFields():''; $('#entryNotes').value='';
  $('#entryForm').querySelector('.form-actions .primary').textContent=type==='electric'?'Save bill':'Save';
  $('#entryNotesLabel').textContent=type==='hub-note'?'Note':'Notes';
  const deleteEntry=$('#deleteEntryNote');
  deleteEntry.hidden=true;
  deleteEntry.disabled=false;
  deleteEntry.textContent='Delete';
  deleteEntry.onclick=null;
  const archiveEntry=$('#archiveEntryNote');
  archiveEntry.hidden=true;
  archiveEntry.disabled=false;
  archiveEntry.textContent='Archive note';
  archiveEntry.onclick=null;
  const today=new Date().toISOString().slice(0,10), d=$('#date')||$('#arrival')||$('#startDate'); if(d)d.value=today; if(type==='trip')$('#endDate').value=$('#startDate').value;
  if(type==='hub-note'){
    const note=index===null?null:db.sharedNotes?.[index];
    if(note){$('#name').value=note.title||'';$('#entryNotes').value=note.body||'';$('#notePinned').checked=Boolean(note.pinned);$('#noteTripId').value=note.tripId||'';}
    else if(returnTripIndex!==null)$('#noteTripId').value=db.tripSummaries[returnTripIndex]?._cloudId||'';
    setupNoteEditor(note?.body||'');
    bindNotePhotoEditor(note||{});
    if(note){
      archiveEntry.textContent=note.archived?'Restore note':'Archive note';
      archiveEntry.hidden=false;
      archiveEntry.onclick=async()=>{
        archiveEntry.disabled=true;
        const priorArchived=Boolean(note.archived);
        const priorUpdatedAt=note.updatedAt;
        note.archived=!priorArchived;
        note.updatedAt=new Date().toISOString();
        try{
          await save();
          clearNotePhotoEditor();
          closeEntryForTransition();
          renderHome();
          renderNotes();
          if(returnTripIndex!==null)showTrip(returnTripIndex);
        }catch(error){
          note.archived=priorArchived;
          note.updatedAt=priorUpdatedAt;
          console.error(error);
          alert(`The note could not be ${priorArchived?'restored':'archived'}.\n\n${error.message}`);
          archiveEntry.disabled=false;
        }
      };
      deleteEntry.textContent='Delete note';
      deleteEntry.hidden=false;
      deleteEntry.onclick=async()=>{
        if(!confirm(`Delete “${note.title||'this note'}”?`))return;
        deleteEntry.disabled=true;
        try{
          if(window.ADVENTURE_HUB_STORE&&note._cloudId)await window.ADVENTURE_HUB_STORE.deleteNotePhotos(note);
          db.sharedNotes.splice(index,1);
          await save();
          clearNotePhotoEditor();
          closeEntryForTransition();
          renderHome();
          renderNotes();
          if(returnTripIndex!==null)showTrip(returnTripIndex);
        }catch(error){
          console.error(error);
          alert(`The note could not be deleted.\n\n${error.message}`);
          deleteEntry.disabled=false;
        }
      };
    }
  }
  if(type==='trip-plan'){
    const plan=index===null?null:db.tripPlans?.[index];
    const relatedTrip=returnTripIndex!==null
      ?db.tripSummaries[returnTripIndex]
      :db.tripSummaries.find(trip=>trip._cloudId===(plan?._tripId||null));
    if(plan){
      $('#planTripId').value=plan._tripId||'';
      $('#name').value=plan.title||'';
      $('#planType').value=plan.planType||'activity';
      $('#planStatus').value=plan.status||'planned';
      $('#date').value=plan.date||today;
      $('#planStartTime').value=String(plan.startTime||'').slice(0,5);
      $('#planEndTime').value=String(plan.endTime||'').slice(0,5);
      $('#planLocationName').value=plan.locationName||'';
      $('#address').value=plan.address||'';
      $('#city').value=plan.city||'';
      $('#state').value=plan.state||'';
      $('#zip').value=plan.zip||'';
      $('#planConfirmation').value=plan.confirmationCode||'';
      $('#total').value=plan.cost??'';
      $('#planWebsite').value=plan.websiteUrl||'';
      $('#entryNotes').value=plan.notes||'';
      deleteEntry.textContent='Delete plan';
      deleteEntry.hidden=false;
      deleteEntry.onclick=async()=>{
        if(!confirm(`Delete “${plan.title||'this plan'}”?`))return;
        deleteEntry.disabled=true;
        const removed=db.tripPlans.splice(index,1)[0];
        const cloudSaved=await save();
        if(!cloudSaved){db.tripPlans.splice(index,0,removed);deleteEntry.disabled=false;return}
        if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){
          try{await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(removed)}
          catch(error){console.warn('The deleted reservation pictures could not be removed.',error)}
        }
        if(window.ADVENTURE_HUB_STORE&&hasLinkedDocuments(removed)){
          try{await window.ADVENTURE_HUB_STORE.setTripPlanPdfDocument(removed,null)}
          catch(error){console.warn('The deleted reservation PDF could not be removed.',error)}
        }
        clearMultiReceiptEditor();
        clearTripPlanPdfEditor();
        closeEntryForTransition();
        renderTrips();
        if(returnTripIndex!==null)showTrip(returnTripIndex);
      };
    }else if(relatedTrip){
      $('#planTripId').value=relatedTrip._cloudId||'';
      $('#date').value=tripDates(relatedTrip)[0]||today;
    }
  }
  if(index===null && returnTripIndex!==null && (type==='sitepayment'||type==='electric')){const year=+returnTripIndex;if($('#year'))$('#year').value=year;if($('#date'))$('#date').value=`${year}-${type==='electric'?'06':'01'}-01`;if(type==='electric'&&$('#paid'))$('#paid').value='';}
  if(index===null&&type==='electric'&&$('#previous')){
    const selectedYear=returnTripIndex!==null?String(returnTripIndex):String(new Date().getFullYear());
    const priorBill=(db.electric||[])
      .filter(record=>String(record.date||'').startsWith(selectedYear))
      .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
    if(priorBill?.current!=null)$('#previous').value=priorBill.current;
  }
  if(type==='stay'){
    const cost=$('#total'),checks=[$('#harvestHost'),$('#moochdocking'),$('#boondocking')];
    const site=$('#site');
    const siteCodes=new Map([[$('#harvestHost'),'HH'],[$('#moochdocking'),'MD'],[$('#boondocking'),'BD']]);
    cost.disabled=false;
    checks.forEach(check=>check?.addEventListener('change',()=>{
      if(check.checked) checks.forEach(other=>{if(other&&other!==check) other.checked=false;});
      if(check.checked){
        if(site)site.value=siteCodes.get(check);
        cost.value='0';
      }
    }));
  }
  if(type==='fuel'||type==='def'){
    const collection=type==='def'?db.def:db.fuel;
    const purchase=index===null?null:collection[index];
    const syncTripFuelType=()=>{
      if(!$('#tripName').value||$('#tripName').value===NO_TRIP_VALUE){
        $('#fuelType').value='diesel';
        return;
      }
      const trip=db.tripSummaries.find(item=>item.name===$('#tripName').value);
      if(trip?.towFuelType)$('#fuelType').value=trip.towFuelType;
    };
    const syncTripMode=()=>{
      const includesFuel=['fuel','fuel_def'].includes($('#purchaseType').value);
      const everydayRuby=!$('#tripName').value||$('#tripName').value===NO_TRIP_VALUE;
      const tripMeter=$('#tripMeter');
      if(tripMeter)tripMeter.required=includesFuel&&!everydayRuby;
      if($('#tripMeterField'))$('#tripMeterField').hidden=!includesFuel||everydayRuby;
      if($('#fuelCalculations'))$('#fuelCalculations').hidden=!includesFuel||everydayRuby;
    };
    const syncPurchaseType=()=>{
      const purchaseType=$('#purchaseType').value;
      const includesFuel=purchaseType==='fuel'||purchaseType==='fuel_def';
      const includesDef=purchaseType==='def'||purchaseType==='fuel_def';
      $('#fuelPurchaseFields').hidden=!includesFuel;
      $('#defPurchaseFields').hidden=!includesDef;
      ['#gallons','#total','#fuelType'].forEach(selector=>{const field=$(selector);if(field)field.required=includesFuel;});
      ['#defGallons','#defTotal'].forEach(selector=>{const field=$(selector);if(field)field.required=includesDef;});
      syncTripMode();
    };
    const updatePreview=()=>{
      const gallons=Number($('#gallons').value),total=Number($('#total').value),tripMeterValue=$('#tripMeter').value,tripMeter=Number(tripMeterValue),hasTripMeter=tripMeterValue!=='';
      const values=$$('#fuelCalculations b');
      const tripName=$('#tripName').value;
      const isEveryday=tripName===NO_TRIP_VALUE;
      const previous=isEveryday?null:db.fuel
        .filter((row,rowIndex)=>rowIndex!==index&&row.trip===tripName&&Number(row.tripMiles)<tripMeter)
        .sort((a,b)=>(Number(b.tripMiles)||0)-(Number(a.tripMiles)||0))[0];
      const tankMiles=hasTripMeter?(previous?tripMeter-Number(previous.tripMiles):tripMeter):null;
      $('#fuelMpgLabel').textContent=isEveryday?'Fill MPG':previous?'Tank MPG':'Trip MPG';
      values[0].textContent=gallons>0&&hasTripMeter&&tankMiles>=0?number(tankMiles/gallons,2):'—';
      values[1].textContent=hasTripMeter&&Number.isFinite(tankMiles)&&!isEveryday?number(tankMiles,1):'—';
      if(!$('#pricePerGallon').value&&gallons>0&&total>0)$('#pricePerGallon').value=(total/gallons).toFixed(3);
      const defGallons=Number($('#defGallons').value),defTotal=Number($('#defTotal').value);
      if(!$('#defPricePerGallon').value&&defGallons>0&&defTotal>0)$('#defPricePerGallon').value=(defTotal/defGallons).toFixed(3);
    };
    if(index!==null){
      if(purchase){
        const pairedDef=type==='fuel'?db.def.find(record=>(purchase._cloudId&&record._fuelId===purchase._cloudId)||(purchase.documentId&&record.documentId===purchase.documentId)):null;
        $('#purchaseType').value=type==='def'?'def':pairedDef?'fuel_def':'fuel';
        $('#date').value=purchase.date||today; $('#purchaseTime').value=String(purchase.time||'').slice(0,5); $('#tripName').value=purchase.trip||NO_TRIP_VALUE; $('#station').value=purchase.station||''; $('#address').value=purchase.address||''; $('#city').value=purchase.city||splitFuelLocation(purchase.location).city; $('#state').value=purchase.state||splitFuelLocation(purchase.location).state;
        if(type==='fuel'){$('#gallons').value=purchase.gallons??''; $('#pricePerGallon').value=purchase.price??''; $('#total').value=purchase.total??''; $('#fuelType').value=purchase.fuelType||(+String(purchase.date||'').slice(0,4)>=2025?'diesel':'gasoline'); $('#tripMeter').value=purchase.tripMiles??'';}
        else{$('#defGallons').value=purchase.gallons??'';$('#defPricePerGallon').value=purchase.price??'';$('#defTotal').value=purchase.total??'';}
        if(pairedDef){$('#defGallons').value=pairedDef.gallons??'';$('#defPricePerGallon').value=pairedDef.price??'';$('#defTotal').value=pairedDef.total??'';}
        $('#odometer').value=purchase.odometer??''; $('#entryNotes').value=purchase.notes||'';
        deleteEntry.textContent=type==='def'?'Delete DEF purchase':'Delete fuel stop';
        deleteEntry.hidden=false;
        deleteEntry.onclick=async()=>{
          if(!confirm(`Delete this ${type==='def'?'DEF purchase':'fuel stop'} at ${purchase.station||'this station'}?`))return;
          deleteEntry.disabled=true;
          const removed=collection.splice(index,1)[0];
          refreshTripFuelSummaries();
          const cloudSaved=await save();
          if(!cloudSaved){
            collection.splice(index,0,removed);
            refreshTripFuelSummaries();
            deleteEntry.disabled=false;
            return;
          }
          if(window.ADVENTURE_HUB_STORE&&hasReceiptPhotos(removed)){
            try{removed.documentId?await window.ADVENTURE_HUB_STORE[type==='def'?'deleteDefReceiptDocument':'deleteFuelReceiptDocument'](removed):await window.ADVENTURE_HUB_STORE.deleteRecordReceipt(removed);}
            catch(error){console.warn('The deleted purchase receipt could not be removed.',error);}
          }
          closeEntryForTransition();
          renderHome();
          renderTrips();
          if(returnTripIndex!==null)showTrip(returnTripIndex);
          else showPanel('fuel-history');
        };
      }
    }else if(returnTripIndex!==null){
      $('#tripName').value=db.tripSummaries[returnTripIndex]?.name||'';
    }else{
      const currentTrip=db.tripSummaries.find(trip=>tripStatus(trip)==='current');
      $('#tripName').value=currentTrip?.name||NO_TRIP_VALUE;
    }
    if(index===null){$('#purchaseType').value=type==='def'?'def':'fuel';syncTripFuelType();}
    $('#purchaseType').addEventListener('change',syncPurchaseType);
    $('#tripName').addEventListener('change',()=>{syncTripFuelType();syncTripMode();updatePreview()});
    ['#gallons','#total','#tripMeter','#pricePerGallon','#defGallons','#defTotal','#defPricePerGallon'].forEach(selector=>$(selector).addEventListener('input',updatePreview));
    syncPurchaseType();
    updatePreview();
  }
  if(type==='stay' && index!==null){
    const stay=db.stays[index];
    if(stay){
      $('#arrival').value=stay.arrival||today; $('#departure').value=stay.departure||''; $('#name').value=stay.name||''; $('#address').value=stay.address||'';
      $('#checkInTime').value=String(stay.checkInTime||'').slice(0,5); $('#checkOutTime').value=String(stay.checkOutTime||'').slice(0,5);
      $('#city').value=stay.city||''; $('#state').value=stay.state||''; $('#zip').value=stay.zip||''; $('#site').value=stay.site||''; $('#total').value=stay.price??'';
      $('#harvestHost').checked=Boolean(stay.harvestHost||stay.stayType==='harvest-host'); $('#moochdocking').checked=Boolean(stay.moochdocking||stay.stayType==='moochdocking'); $('#boondocking').checked=Boolean(stay.boondocking||stay.stayType==='boondocking'); $('#entryNotes').value=stay.notes||'';
      const selected=[$('#harvestHost'),$('#moochdocking'),$('#boondocking')].filter(x=>x.checked); if(selected.length>1) selected.slice(1).forEach(x=>x.checked=false);
    }
  }
  if(type==='stay')bindStayPhotoEditor(index===null?{}:db.stays[index]);
  if(type==='sitepayment' && index!==null){
    const record=db.siteFees?.[index];
    if(record){$('#year').value=record.year||new Date().getFullYear();$('#date').value=record.date||today;$('#payment').value=record.payment??'';$('#check').value=record.check||'';$('#entryNotes').value=record.notes||'';}
  }
  if(type==='electric' && index!==null){
    const record=db.electric?.[index];
    if(record){$('#date').value=record.date||today;$('#paid').value=record.paid||'';$('#previous').value=record.previous??'';$('#current').value=record.current??'';$('#rate').value=record.unitPrice??.16;$('#amountDue').value=record.total??'';$('#check').value=record.check||'';$('#entryNotes').value=record.notes||'';}
  }
  if(type==='sitefee' && index!==null){
    const record=db.stays?.[index];
    if(record){$('#year').value=record.year||new Date().getFullYear();$('#total').value=record.price??'';$('#site').value=record.site||'';$('#address').value=record.address||'';$('#city').value=record.city||'';$('#state').value=record.state||'';$('#zip').value=record.zip||'';$('#entryNotes').value=record.notes||'';}
  }
  if(['phillis-maint','phillis-upgrade','ruby-maint','ruby-upgrade'].includes(type) && index!==null){
    const key=type==='phillis-maint'?'phillisMaintenance':type==='phillis-upgrade'?'phillisUpgrades':type==='ruby-maint'?'rubyMaintenance':'rubyUpgrades';
    const record=db[key]?.[index];
    if(record){if($('#trailer'))$('#trailer').value=record.trailer||'Phillis II.0';$('#date').value=record.date||today;$('#description').value=record.description||'';$('#location').value=record.location||'';$('#total').value=record.price??'';$('#entryNotes').value=record.notes||'';}
  }
  if(type==='trip'){
    if(index!==null){
      const t=db.tripSummaries[index], [start,end]=tripDates(t), stays=matchingStays(t);
      $('#name').value=t.name||''; $('#startDate').value=start; $('#endDate').value=end; $('#entryNotes').value=t.notes||'';
      tripStayEditorItems=stays.map(stay=>({...stay,dbIndex:db.stays.indexOf(stay)}));
      tripOriginalStayIndices=new Set(tripStayEditorItems.map(stay=>stay.dbIndex));
    } else {
      tripStayEditorItems=[];
      tripOriginalStayIndices=new Set();
    }
    renderTripStayEditor();
    bindTripPhotoEditor(index===null?{}:db.tripSummaries[index]);
    $('#addTripStay').onclick=()=>openTripStayEditor();
  }
  if(type==='fuel'||type==='def')bindFuelReceiptScanner(index===null?{}:((type==='def'?db.def:db.fuel)?.[index]||{}));
  if(type==='electric')bindElectricDocumentEditor(index===null?{}:(db.electric?.[index]||{}));
  if(['phillis-maint','phillis-upgrade','ruby-maint','ruby-upgrade','sitepayment','trip-plan'].includes(type)){
    const key=type==='phillis-maint'?'phillisMaintenance':type==='phillis-upgrade'?'phillisUpgrades':type==='ruby-maint'?'rubyMaintenance':type==='ruby-upgrade'?'rubyUpgrades':type==='trip-plan'?'tripPlans':'siteFees';
    bindMultiReceiptEditor(index===null?{}:(db[key]?.[index]||{}));
  }
  if(type==='trip-plan'){
    bindTripPlanPdfEditor(index===null?{}:(db.tripPlans?.[index]||{}));
    bindTripPlanAttachmentPicker();
  }
  $('#entryDialog').showModal();
}
$('#campgroundJournalForm').onsubmit=async event=>{
  event.preventDefault();
  const stayIndex=Number($('#campgroundJournalStayIndex').value);
  const stay=db.stays[stayIndex];
  const campground=campgroundForStay(stay);
  if(!stay||!campground)return;
  const existingProfile=campground.profileData&&typeof campground.profileData==='object'?campground.profileData:{};
  const existingFacilities=existingProfile.facilities&&typeof existingProfile.facilities==='object'?existingProfile.facilities:{};
  const existingBathhouse=existingFacilities.bathhouse&&typeof existingFacilities.bathhouse==='object'?existingFacilities.bathhouse:{};
  const existingAccess=existingProfile.access&&typeof existingProfile.access==='object'?existingProfile.access:{};
  const existingJournal=stay.journalData&&typeof stay.journalData==='object'?stay.journalData:{};
  const existingCampsite=existingJournal.campsite&&typeof existingJournal.campsite==='object'?existingJournal.campsite:{};
  const existingLocalArea=existingJournal.localArea&&typeof existingJournal.localArea==='object'?existingJournal.localArea:{};
  const existingConnectivity=existingJournal.connectivity&&typeof existingJournal.connectivity==='object'?existingJournal.connectivity:{};
  const value=id=>$(id)?.value?.trim()||'';
  const checked=id=>Boolean($(id)?.checked);
  const optionalNumber=id=>{
    const raw=value(id);
    return raw===''?null:Number(raw);
  };
  const optionalBoolean=id=>{
    const raw=value(id);
    return raw==='yes'?true:raw==='no'?false:null;
  };

  campground.profileData={
    ...existingProfile,
    facilities:{
      ...existingFacilities,
      hookups:journalSelectedValues('journalCampgroundHookups'),
      bathhouse:{
        ...existingBathhouse,
        flushToilets:checked('#journalFlushToilets'),
        showers:checked('#journalShowers'),
        freeShowers:checked('#journalFreeShowers'),
        quarterShowers:checked('#journalQuarterShowers'),
        hotWater:checked('#journalHotWater'),
        cleanliness:optionalNumber('#journalBathhouseCleanliness'),
        notes:value('#journalBathhouseNotes')
      },
      amenities:journalSelectedValues('journalAmenities'),
      otherAmenities:value('#journalOtherAmenities')
    },
    bookingNotes:value('#journalBookingNotes'),
    scenery:value('#journalScenery'),
    access:{
      ...existingAccess,
      tightRoads:checked('#journalTightRoads'),
      lowTrees:checked('#journalLowTrees'),
      badRoads:checked('#journalBadRoads'),
      notes:value('#journalAccessNotes')
    }
  };
  stay.journalData={
    ...existingJournal,
    ourNotes:value('#journalOurNotes'),
    campsite:{
      ...existingCampsite,
      hookups:value('#journalSiteHookups'),
      electrical:value('#journalSiteElectrical'),
      level:value('#journalSiteLevel'),
      surface:value('#journalSiteSurface'),
      size:value('#journalSiteSize'),
      shade:value('#journalSiteShade'),
      fireRing:checked('#journalFireRing'),
      firesAllowed:checked('#journalFiresAllowed'),
      picnicTable:checked('#journalPicnicTable'),
      closeToAmenities:checked('#journalCloseAmenities'),
      view:value('#journalSiteView'),
      noise:value('#journalSiteNoise'),
      wildlife:value('#journalWildlife'),
      notes:value('#journalCampsiteNotes')
    },
    localArea:{
      ...existingLocalArea,
      weather:value('#journalWeather'),
      sightseeing:value('#journalSightseeing'),
      restaurants:value('#journalRestaurants'),
      grocery:value('#journalGrocery'),
      placesVisited:value('#journalPlacesVisited'),
      nextTime:value('#journalNextTime')
    },
    connectivity:{
      ...existingConnectivity,
      campgroundWifiAvailable:optionalBoolean('#journalWifiAvailable'),
      wifiRating:optionalNumber('#journalWifiRating'),
      mobileService:value('#journalMobileService'),
      internetUsed:journalSelectedValues('journalInternetUsed'),
      notes:value('#journalConnectivityNotes')
    }
  };
  stay.overallRating=optionalNumber('#journalOverallRating');
  stay.wouldReturn=optionalBoolean('#journalWouldReturn');
  const complete=checked('#campgroundJournalComplete');
  stay.journalCompletedAt=complete?(stay.journalCompletedAt||new Date().toISOString()):'';

  const saveButton=$('#saveCampgroundJournal');
  saveButton.disabled=true;
  saveButton.textContent='Saving…';
  const saved=await save();
  saveButton.disabled=false;
  saveButton.textContent='Save campground log';
  if(!saved)return;
  $('#campgroundJournalDialog').close();
  renderHome();
  renderTrips();
  if($('#detailDialog').open)showStay(stayIndex,detailReturnTripIndex);
};
$$('dialog .close').forEach(b=>b.onclick=()=>{const dialog=b.closest('dialog');dialog.close();if(dialog.id==='entryDialog'){pendingElectricAiApproval=null;clearFuelReceiptScanner({discardDraft:true});clearStayPhotoPreviewUrls();clearNotePhotoEditor();clearMultiReceiptEditor();clearTripPlanPdfEditor();clearElectricDocumentEditor({discardDraft:true});}if(dialog.id==='seasonDocumentDialog')clearSeasonDocumentDraft();});
$$('dialog').forEach(dialog=>dialog.addEventListener('mousedown',event=>{const box=dialog.getBoundingClientRect();const outside=event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;if(outside){dialog.close();if(dialog.id==='entryDialog'){pendingElectricAiApproval=null;clearFuelReceiptScanner({discardDraft:true});clearStayPhotoPreviewUrls();clearNotePhotoEditor();clearMultiReceiptEditor();clearTripPlanPdfEditor();clearElectricDocumentEditor({discardDraft:true});}if(dialog.id==='seasonDocumentDialog')clearSeasonDocumentDraft();}}));
$('#detailDialog').addEventListener('close',()=>{
  if(suppressNextDetailReturn){
    suppressNextDetailReturn=false;
    return;
  }
  const returnTripIndex=detailReturnTripIndex;
  detailReturnTripIndex=null;
  if(returnTripIndex!==null)queueMicrotask(()=>showTrip(returnTripIndex));
});
$('#entryDialog').addEventListener('close',()=>{
  if(suppressNextEntryReturn){
    suppressNextEntryReturn=false;
    return;
  }
  const returnTripIndex=entryReturnTripIndex;
  entryReturnTripIndex=null;
  if($('#entryStayIndex'))$('#entryStayIndex').value='';
  if(returnTripIndex!==null)queueMicrotask(()=>showTrip(returnTripIndex));
});
$('#tripStayForm').onsubmit=event=>{
  event.preventDefault();
  const prior=tripStayModalIndex===null?{}:tripStayEditorItems[tripStayModalIndex];
  const harvestHost=$('#tripStayHarvestHost').checked;
  const moochdocking=$('#tripStayMoochdocking').checked;
  const boondocking=$('#tripStayBoondocking').checked;
  const record={
    ...prior,
    arrival:$('#tripStayArrival').value,
    departure:$('#tripStayDeparture').value,
    checkInTime:$('#tripStayCheckIn').value||'12:00',
    checkOutTime:$('#tripStayCheckOut').value||'12:00',
    name:$('#tripStayName').value.trim(),
    address:$('#tripStayAddress').value.trim(),
    city:$('#tripStayCity').value.trim(),
    state:$('#tripStayState').value.trim(),
    zip:$('#tripStayZip').value.trim(),
    site:$('#tripStaySite').value.trim(),
    price:+$('#tripStayCost').value||0,
    harvestHost,
    moochdocking,
    boondocking,
    stayType:harvestHost?'harvest-host':moochdocking?'moochdocking':boondocking?'boondocking':'campground',
    notes:$('#tripStayNotes').value
  };
  if(tripStayModalIndex===null)tripStayEditorItems.push(record);
  else tripStayEditorItems[tripStayModalIndex]=record;
  $('#tripStayDialog').close();
  renderTripStayEditor();
};
bindOpeners();
$('#entryForm').onsubmit=async e=>{
  e.preventDefault(); const type=$('#entryType').value;
  const notes=type==='hub-note'&&$('#noteChecklist')?.checked?checklistBody(readChecklistEditor()):$('#entryNotes').value;
  const submitButton=$('#entryForm').querySelector('.form-actions .primary');
  submitButton.classList.remove('attention-pulse');
  const originalButtonText=submitButton.textContent;
  let savedStay=null;
  let savedTrip=null;
  let savedNote=null;
  let savedReceiptRecord=null;
  let savedDefRecord=null;
  let savedReceiptKind='';
  let savedMultiReceiptRecord=null;
  let savedMultiReceiptKind='';
  let electricDocumentToRead=null;
  let electricDocumentToReadIndex=null;
  const pendingNotePhotoChanges=type==='hub-note'?notePhotoChanges():{addFiles:[],removePaths:[]};
  const multiReceiptKinds={'phillis-maint':'maintenance','phillis-upgrade':'maintenance','ruby-maint':'maintenance','ruby-upgrade':'maintenance',sitepayment:'seasonal-payment','trip-plan':'trip-plan'};
  const pendingMultiReceiptChanges=multiReceiptKinds[type]?multiReceiptChanges():{addFiles:[],removePaths:[]};
  const pendingTripPlanPdfChanges=type==='trip-plan'?tripPlanPdfChanges():null;
  const pendingElectricDocumentChanges=type==='electric'?electricDocumentChanges():null;
  const shouldReadElectricDocument=type==='electric'&&Boolean(electricDocumentEditorState.readAfterSave)&&Boolean(pendingElectricDocumentChanges?.items?.some(item=>item.file));
  const pendingFuelReceiptDocument=(type==='fuel'||type==='def')&&fuelReceiptScannerState.draftDocumentId?fuelReceiptScannerState.document:null;
  const stayPhotoChanges=type==='stay'?[
    {kind:'site',file:$('#sitePhotoFile')?.files?.[0]||null,remove:$('#sitePhotoFile')?.dataset.remove==='true'},
    {kind:'sign',file:$('#signPhotoFile')?.files?.[0]||null,remove:$('#signPhotoFile')?.dataset.remove==='true'}
  ].filter(change=>change.file||change.remove):[];
  const tripPhotoChange=type==='trip'&&($('#onRoadPhotoFile')?.files?.[0]||$('#onRoadPhotoFile')?.dataset.remove==='true')
    ?{file:$('#onRoadPhotoFile')?.files?.[0]||null,remove:$('#onRoadPhotoFile')?.dataset.remove==='true'}
    :null;
  const receiptChange=null;
  if(type==='hub-note'){
    const index=$('#entryIndex').value===''?null:+$('#entryIndex').value;
    const prior=index===null?null:db.sharedNotes[index];
    const now=new Date().toISOString();
    const record={
      ...(prior||{}),
      title:$('#name').value.trim(),
      body:notes,
      pinned:Boolean($('#notePinned')?.checked),
      archived:Boolean(prior?.archived),
      tripId:$('#noteTripId')?.value||null,
      photoPaths:[...(prior?.photoPaths||[])],
      photoUrls:[...(prior?.photoUrls||[])],
      createdAt:prior?.createdAt||now,
      updatedAt:now
    };
    if(index===null)db.sharedNotes.push(record);else db.sharedNotes[index]=record;
    savedNote=record;
  }
  else if(type==='trip-plan'){
    const index=$('#entryIndex').value===''?null:+$('#entryIndex').value;
    const tripId=$('#planTripId').value;
    const selectedTrip=db.tripSummaries.find(trip=>trip._cloudId===tripId);
    if(!selectedTrip){alert('Please choose the trip this plan belongs to.');$('#planTripId').focus();return}
    const prior=index===null?{}:db.tripPlans[index];
    const record={
      ...prior,
      _tripId:tripId,
      title:$('#name').value.trim(),
      planType:$('#planType').value,
      status:$('#planStatus').value,
      date:$('#date').value,
      startTime:$('#planStartTime').value,
      endTime:$('#planEndTime').value,
      locationName:$('#planLocationName').value.trim(),
      address:$('#address').value.trim(),
      city:$('#city').value.trim(),
      state:$('#state').value,
      zip:$('#zip').value.trim(),
      confirmationCode:$('#planConfirmation').value.trim(),
      cost:+$('#total').value||0,
      websiteUrl:$('#planWebsite').value.trim(),
      receiptPhotoPaths:[...(prior.receiptPhotoPaths||[])],
      receiptPhotoUrls:[...(prior.receiptPhotoUrls||[])],
      notes
    };
    if(index===null)db.tripPlans.push(record);else db.tripPlans[index]=record;
    savedMultiReceiptRecord=record;
    savedMultiReceiptKind='trip-plan';
  }
  else if(type==='trip'){
    const s=$('#startDate').value,eDate=$('#endDate').value,name=$('#name').value.trim(),index=$('#entryIndex').value===''?null:+$('#entryIndex').value;
    const duplicateIndex=db.tripSummaries.findIndex((trip,i)=>i!==index&&(trip.name||'').trim().toLocaleLowerCase()===name.toLocaleLowerCase());
    if(duplicateIndex!==-1){
      const duplicate=db.tripSummaries[duplicateIndex], [duplicateStart,duplicateEnd]=tripDates(duplicate);
      alert(`Trip name already exists\n\n“${duplicate.name}” is already being used for ${date(duplicateStart)} – ${date(duplicateEnd)}.\n\nPlease choose a different trip name.`);
      $('#name').focus();
      $('#name').select();
      return;
    }
    const prior=index===null?null:db.tripSummaries[index];
    const trip={...(prior||{}),year:+s.slice(0,4),name,startDate:s,endDate:eDate,distance:prior?.distance??null,cost:prior?.cost??0,gallons:prior?.gallons??0,mpg:prior?.mpg??null,notes};
    if(index===null) db.tripSummaries.push(trip); else db.tripSummaries[index]=trip;
    savedTrip=trip;
    const editedStays=readTripStayCards();
    db.stays=db.stays.filter((_,i)=>!tripOriginalStayIndices.has(i));
    editedStays.forEach(stay=>{
      const arrival=stay.arrival||s,departure=stay.departure||eDate;
      db.stays.push({...stay,dbIndex:undefined,year:+arrival.slice(0,4),arrival,departure,nights:departure?Math.round((new Date(departure)-new Date(arrival))/86400000):null,notes:stay.notes||''});
    });
  }
  else if(type==='fuel'||type==='def'){
    const index=$('#entryIndex').value===''?null:+$('#entryIndex').value;
    const purchaseType=$('#purchaseType').value;
    const includesFuel=purchaseType==='fuel'||purchaseType==='fuel_def';
    const includesDef=purchaseType==='def'||purchaseType==='fuel_def';
    const selectedTripValue=$('#tripName').value||NO_TRIP_VALUE;
    const everydayRuby=selectedTripValue===NO_TRIP_VALUE;
    const selectedTrip=everydayRuby?null:db.tripSummaries.find(trip=>trip.name===selectedTripValue);
    if(!everydayRuby&&!selectedTrip){alert('Please choose a trip from the list.');$('#tripName').focus();return;}
    const city=$('#city').value.trim(),state=$('#state').value;
    const scannedDocument=fuelReceiptScannerState.document;
    const shared={_tripId:everydayRuby?null:(selectedTrip._cloudId||null),vehicle:everydayRuby?'Ruby':(selectedTrip.towVehicle||''),date:$('#date').value,time:$('#purchaseTime').value,trip:everydayRuby?'':selectedTrip.name,station:$('#station').value.trim(),address:$('#address').value.trim(),city,state,location:[city,state].filter(Boolean).join(', '),odometer:$('#odometer').value===''?null:+$('#odometer').value,notes};
    const documentFields=prior=>({receiptPhotoPath:prior.receiptPhotoPath||'',receiptPhotoUrl:scannedDocument?.documentFiles?.find(file=>/^image\//i.test(file.mimeType||'')&&file.url)?.url||prior.receiptPhotoUrl||'',documentId:scannedDocument?.documentId||prior.documentId||'',documentTitle:scannedDocument?.documentTitle||prior.documentTitle||'',documentType:scannedDocument?.documentType||prior.documentType||'',documentStatus:scannedDocument?.documentStatus||prior.documentStatus||'',documentAiStatus:scannedDocument?.documentAiStatus||prior.documentAiStatus||'',documentExtractedText:scannedDocument?.documentExtractedText||prior.documentExtractedText||'',documentExtractedData:scannedDocument?.documentExtractedData||prior.documentExtractedData||{},documentUserCorrections:scannedDocument?.documentUserCorrections||prior.documentUserCorrections||{},documentReviewFields:scannedDocument?.documentReviewFields||prior.documentReviewFields||[],documentFiles:[...(scannedDocument?.documentFiles||prior.documentFiles||[])]});
    let fuelRecord=null;
    if(includesFuel){
      const fuelIndex=type==='fuel'?index:null;
      const prior=fuelIndex===null?{}:db.fuel[fuelIndex];
      const g=+$('#gallons').value||0,total=+$('#total').value||0;
      fuelRecord={...prior,...shared,_cloudId:prior._cloudId||crypto.randomUUID(),_vehicleId:everydayRuby?(prior._vehicleId||null):(selectedTrip._towVehicleId||null),gallons:g,total,price:$('#pricePerGallon').value===''?(g?total/g:0):+$('#pricePerGallon').value,fuelType:$('#fuelType').value,tripMiles:+$('#tripMeter').value,...documentFields(prior)};
      if(fuelIndex===null)db.fuel.push(fuelRecord);else db.fuel[fuelIndex]=fuelRecord;
      savedReceiptRecord=fuelRecord;
      savedReceiptKind='fuel';
    }else if(type==='fuel'&&index!==null){
      db.fuel.splice(index,1);
    }
    if(includesDef){
      const linkedFuelId=fuelRecord?._cloudId||null;
      const existingDefIndex=type==='def'&&index!==null?index:db.def.findIndex(record=>linkedFuelId&&(record._fuelId===linkedFuelId||(record.documentId&&record.documentId===scannedDocument?.documentId)));
      const prior=existingDefIndex===-1?{}:db.def[existingDefIndex];
      const gallons=+$('#defGallons').value||0,total=+$('#defTotal').value||0;
      const defRecord={...prior,...shared,_vehicleId:everydayRuby?(prior._vehicleId||null):(selectedTrip._towVehicleId||null),_fuelId:linkedFuelId||prior._fuelId||null,gallons,total,price:$('#defPricePerGallon').value===''?(gallons?total/gallons:0):+$('#defPricePerGallon').value,...documentFields(prior)};
      if(existingDefIndex===-1)db.def.push(defRecord);else db.def[existingDefIndex]=defRecord;
      savedDefRecord=defRecord;
      if(!savedReceiptRecord){savedReceiptRecord=defRecord;savedReceiptKind='def';}
    }else if(type==='def'&&index!==null){
      db.def.splice(index,1);
    }
    refreshTripFuelSummaries();
  }
  else if(type==='stay'){
    const a=$('#arrival').value,d=$('#departure').value,index=$('#entryIndex').value===''?null:+$('#entryIndex').value,harvestHost=$('#harvestHost').checked,moochdocking=$('#moochdocking').checked,boondocking=$('#boondocking').checked,stayType=harvestHost?'harvest-host':moochdocking?'moochdocking':boondocking?'boondocking':'campground';
    const record={...(index===null?{}:db.stays[index]),year:+a.slice(0,4),arrival:a,departure:d,checkInTime:$('#checkInTime').value,checkOutTime:$('#checkOutTime').value,nights:d?Math.round((new Date(d)-new Date(a))/86400000):null,name:$('#name').value,address:$('#address').value,city:$('#city').value,state:$('#state').value,zip:$('#zip').value,site:$('#site').value,price:+$('#total').value||0,harvestHost,moochdocking,boondocking,stayType,notes};
    if(index===null) db.stays.push(record); else db.stays[index]=record;
    savedStay=record;
  }
  else if(type==='sitepayment'){const index=$('#entryIndex').value===''?null:+$('#entryIndex').value,prior=index===null?{}:db.siteFees[index],record={...prior,year:+$('#year').value,date:$('#date').value,payment:+$('#payment').value||0,check:$('#check').value,receiptPhotoPaths:[...(prior.receiptPhotoPaths||[])],receiptPhotoUrls:[...(prior.receiptPhotoUrls||[])],notes};if(index===null)db.siteFees.push(record);else db.siteFees[index]=record;savedMultiReceiptRecord=record;savedMultiReceiptKind='seasonal-payment'}
  else if(type==='electric'){
    const p=+$('#previous').value,c=+$('#current').value,r=+$('#rate').value||.16,u=c-p,index=$('#entryIndex').value===''?null:+$('#entryIndex').value;
    const prior=index===null?{}:db.electric[index];
    const document=electricDocumentEditorState.draftDocument||prior;
    const enteredAmount=$('#amountDue').value===''?null:+$('#amountDue').value;
    const record={
      ...prior,
      date:$('#date').value,previous:p,current:c,usage:u,unitPrice:r,total:enteredAmount??u*r,
      paid:$('#paid').value,check:$('#check').value,
      receiptPhotoPath:prior.receiptPhotoPath||'',
      receiptPhotoUrl:document.receiptPhotoUrl||prior.receiptPhotoUrl||'',
      documentId:document.documentId||prior.documentId||'',
      documentTitle:document.documentTitle||prior.documentTitle||'',
      documentType:document.documentType||prior.documentType||'electric_bill',
      documentStatus:document.documentStatus||prior.documentStatus||'',
      documentAiStatus:document.documentAiStatus||prior.documentAiStatus||'',
      documentExtractedText:document.documentExtractedText||prior.documentExtractedText||'',
      documentExtractedData:document.documentExtractedData||prior.documentExtractedData||{},
      documentUserCorrections:document.documentUserCorrections||prior.documentUserCorrections||{},
      documentReviewFields:document.documentReviewFields||prior.documentReviewFields||[],
      documentFiles:[...(document.documentFiles||prior.documentFiles||[])],
      notes
    };
    if(index===null)db.electric.push(record);else db.electric[index]=record;
    savedReceiptRecord=record;savedReceiptKind='electric';
  }
  else if(type==='sitefee'){const y=+$('#year').value,total=+$('#total').value||0,index=$('#entryIndex').value===''?null:+$('#entryIndex').value,record={...(index===null?{}:db.stays[index]),year:y,arrival:'Season',departure:'Season',nights:null,name:'Lehigh Gorge Campground',address:$('#address').value,city:$('#city').value,state:$('#state').value,zip:$('#zip').value,site:$('#site').value||'39',price:total,harvestHost:false,notes};if(index===null)db.stays.push(record);else db.stays[index]=record;const annual=(db.siteFees||[]).find(x=>+x.year===y&&x.yearTotal!=null);if(annual)annual.yearTotal=total}
  else {const key=type==='phillis-maint'?'phillisMaintenance':type==='phillis-upgrade'?'phillisUpgrades':type==='ruby-maint'?'rubyMaintenance':'rubyUpgrades',index=$('#entryIndex').value===''?null:+$('#entryIndex').value,prior=index===null?{}:db[key][index],obj={...prior,date:$('#date').value,description:$('#description').value,location:$('#location').value,price:+$('#total').value||0,receiptPhotoPaths:[...(prior.receiptPhotoPaths||[])],receiptPhotoUrls:[...(prior.receiptPhotoUrls||[])],notes,...(type.startsWith('phillis-')?{trailer:$('#trailer').value}:{})};if(index===null)db[key].push(obj);else db[key][index]=obj;savedMultiReceiptRecord=obj;savedMultiReceiptKind='maintenance'}
  const returnTripIndex=$('#entryStayIndex').value===''?null:+$('#entryStayIndex').value;
  submitButton.disabled=true;
  submitButton.textContent=stayPhotoChanges.length?'Saving stay…':tripPhotoChange?'Saving trip…':pendingElectricDocumentChanges?'Saving bill document…':pendingFuelReceiptDocument?'Saving purchase receipt…':pendingTripPlanPdfChanges?'Saving PDFs…':receiptChange||pendingMultiReceiptChanges.addFiles.length||pendingMultiReceiptChanges.removePaths.length?'Saving receipt…':pendingNotePhotoChanges.addFiles.length||pendingNotePhotoChanges.removePaths.length?'Saving note…':'Saving…';
  const cloudSaved=await save();
  if(savedStay&&stayPhotoChanges.length&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Uploading photos…';
      for(const change of stayPhotoChanges){
        await window.ADVENTURE_HUB_STORE.setStayPhoto(savedStay,change.kind,change.remove?null:change.file);
      }
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The stay details were saved, but a photo could not be uploaded.\n\n${error.message}`);
    }
  }
  if(savedTrip&&tripPhotoChange&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Uploading trip photo…';
      await window.ADVENTURE_HUB_STORE.setTripPhoto(savedTrip,tripPhotoChange.remove?null:tripPhotoChange.file);
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The trip details were saved, but the On the Road Again photo could not be uploaded.\n\n${error.message}`);
    }
  }
  if(savedReceiptRecord&&receiptChange&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Uploading receipt…';
      await window.ADVENTURE_HUB_STORE.setRecordReceipt(savedReceiptRecord,savedReceiptKind,receiptChange.remove?null:receiptChange.file);
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The record was saved, but its receipt could not be updated.\n\n${error.message}`);
    }
  }
  if(savedReceiptRecord&&['fuel','def'].includes(savedReceiptKind)&&pendingFuelReceiptDocument&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Linking purchase receipt…';
      await window.ADVENTURE_HUB_STORE.linkPurchaseReceiptDocument(
        savedReceiptKind==='fuel'?savedReceiptRecord:null,
        savedDefRecord||(savedReceiptKind==='def'?savedReceiptRecord:null),
        pendingFuelReceiptDocument
      );
      fuelReceiptScannerState.draftDocumentId='';
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The purchase was saved, but its scanned receipt could not be linked.\n\n${error.message}`);
    }
  }
  if(savedReceiptRecord&&['fuel','def'].includes(savedReceiptKind)&&fuelReceiptScannerState.approval&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Approving receipt values…';
      const approved=await window.ADVENTURE_HUB_STORE.approveHubDocument(
        fuelReceiptScannerState.approval.documentId,
        fuelReceiptScannerState.approval.corrections
      );
      Object.assign(savedReceiptRecord,approved);
      if(savedDefRecord&&savedDefRecord!==savedReceiptRecord)Object.assign(savedDefRecord,approved);
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The purchase values were saved, but the receipt review could not be marked complete.\n\n${error.message}`);
    }
  }
  if(savedReceiptRecord&&savedReceiptKind==='electric'&&pendingElectricDocumentChanges&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Uploading bill document…';
      await window.ADVENTURE_HUB_STORE.setElectricBillDocuments(savedReceiptRecord,pendingElectricDocumentChanges);
      electricDocumentEditorState.draftDocumentId='';
      if(shouldReadElectricDocument&&savedReceiptRecord.documentId){
        electricDocumentToRead=savedReceiptRecord;
        electricDocumentToReadIndex=db.electric.indexOf(savedReceiptRecord);
      }
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The electric reading was saved, but its document could not be updated.\n\n${error.message}`);
    }
  }
  if(savedReceiptRecord&&savedReceiptKind==='electric'&&pendingElectricAiApproval&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Approving bill values…';
      const approved=await window.ADVENTURE_HUB_STORE.approveHubDocument(
        pendingElectricAiApproval.documentId,
        pendingElectricAiApproval.corrections
      );
      Object.assign(savedReceiptRecord,approved);
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The electric bill values were saved, but the document review could not be marked complete.\n\n${error.message}`);
    }
  }
  if(savedMultiReceiptRecord&&(pendingMultiReceiptChanges.addFiles.length||pendingMultiReceiptChanges.removePaths.length)&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Uploading receipts…';
      await window.ADVENTURE_HUB_STORE.setMultiRecordReceipts(savedMultiReceiptRecord,savedMultiReceiptKind,pendingMultiReceiptChanges);
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The record was saved, but its receipt pictures could not be updated.\n\n${error.message}`);
    }
  }
  if(type==='trip-plan'&&savedMultiReceiptRecord&&pendingTripPlanPdfChanges&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Uploading PDFs…';
      await window.ADVENTURE_HUB_STORE.setTripPlanPdfDocuments(savedMultiReceiptRecord,pendingTripPlanPdfChanges);
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The activity was saved, but its PDFs could not be updated.\n\n${error.message}`);
    }
  }
  if(savedNote&&(pendingNotePhotoChanges.addFiles.length||pendingNotePhotoChanges.removePaths.length)&&cloudSaved&&window.ADVENTURE_HUB_STORE){
    try{
      submitButton.textContent='Uploading note pictures…';
      await window.ADVENTURE_HUB_STORE.setNotePhotos(savedNote,pendingNotePhotoChanges);
      localStorage.setItem(KEY,JSON.stringify(db));
    }catch(error){
      console.error(error);
      alert(`The note was saved, but its pictures could not be updated.\n\n${error.message}`);
    }
  }
  submitButton.disabled=false;
  submitButton.textContent=originalButtonText;
  clearStayPhotoPreviewUrls();
  clearNotePhotoEditor();
  clearMultiReceiptEditor();
  clearTripPlanPdfEditor();
  clearElectricDocumentEditor();
  clearFuelReceiptScanner();
  pendingElectricAiApproval=null;
  closeEntryForTransition(); renderHome(); renderTrips(); renderNotes();
  if((type==='fuel'||type==='def') && returnTripIndex===null) showPanel('fuel-history');
  if(type==='phillis-maint') showPanel('phillis-maintenance');
  if(type==='phillis-upgrade') showPanel('phillis-upgrades');
  if(type==='electric'||type==='sitepayment'||type==='sitefee') showPanel('lehigh');
  if(electricDocumentToRead&&electricDocumentToReadIndex>=0){
    setTimeout(()=>openElectricDocumentReview(electricDocumentToRead,electricDocumentToReadIndex,true),0);
  }
  if(returnTripIndex!==null && !['sitepayment','electric'].includes(type)) showTrip(returnTripIndex);
};
$('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='adventure-hub-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('#importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=migrate(JSON.parse(r.result));applyDataMigrations();refreshTripFuelSummaries();save();renderHome();renderTrips();renderNotes();alert('Backup imported.')}catch{alert('That file could not be imported.')}};r.readAsText(f)};
async function loadCloudData(){
  const status=$('#cloudAccountStatus');
  if(status)status.textContent='Loading shared Travel Journal records…';
  try{
    const browserBackup=migrate(JSON.parse(localStorage.getItem(KEY)||'null'));
    db=migrate(await window.ADVENTURE_HUB_STORE.load());
    refreshTripFuelSummaries();
    const canEditCloud=window.ADVENTURE_HUB_CLOUD?.role!=='viewer';
    let recoveredLocalChanges=false;
    if(browserBackup&&canEditCloud){
      const tripKey=trip=>`${String(trip.name||'').trim().toLowerCase()}|${trip.startDate||''}|${trip.endDate||''}`;
      const cloudTripKeys=new Set(db.tripSummaries.map(tripKey));
      browserBackup.tripSummaries
        .filter(trip=>!trip._cloudId&&!cloudTripKeys.has(tripKey(trip)))
        .forEach(trip=>{db.tripSummaries.push({...trip});cloudTripKeys.add(tripKey(trip));recoveredLocalChanges=true;});
      const stayKey=stay=>`${String(stay.name||'').trim().toLowerCase()}|${stay.arrival||''}|${stay.departure||''}`;
      const cloudStayKeys=new Set(db.stays.filter(stay=>stay.arrival!=='Season').map(stayKey));
      browserBackup.stays
        .filter(stay=>stay.arrival!=='Season'&&!stay._cloudId&&!cloudStayKeys.has(stayKey(stay)))
        .forEach(stay=>{
          const trip=db.tripSummaries.find(item=>item.startDate<=stay.departure&&item.endDate>=stay.arrival);
          db.stays.push({...stay,_tripId:trip?._cloudId||stay._tripId||null});
          cloudStayKeys.add(stayKey(stay));
          recoveredLocalChanges=true;
        });
    }
    const shouldSaveTrailerAssignments=migratedTrailerAssignments;
    TODAY=new Date(); TODAY.setHours(0,0,0,0);
    cloudLoaded=true;
    if(canEditCloud&&(shouldSaveTrailerAssignments||recoveredLocalChanges))await save();
    localStorage.setItem(KEY,JSON.stringify(db));
    renderHome();renderTrips();renderNotes();renderVehicleDetails();
    if($('#more')?.classList.contains('active'))renderJournalStats();
    if(status&&window.ADVENTURE_HUB_CLOUD)status.textContent=`Connected as ${window.ADVENTURE_HUB_CLOUD.user.email} · Higgins Hub · Cloud sync is on · v${APP_VERSION}`;
    return true;
  }catch(error){
    console.error(error);
    if(status)status.textContent='Could not load cloud records. Showing the browser backup.';
    return false;
  }
}
function enablePullToRefresh(){
  const indicator=$('#pullRefresh');
  const refreshButton=$('#cloudRefresh');
  if(!indicator)return;
  const scroller=$('#appScroll')||document;
  const scrollTop=()=>scroller===document?window.scrollY:scroller.scrollTop;
  const label=indicator.querySelector('b');
  const threshold=44;
  let startY=0,startX=0,distance=0,pulling=false,refreshing=false;
  const position=value=>{indicator.style.transform=`translate(-50%, ${Math.min(0,value-48)}px)`};
  const hide=()=>{
    indicator.classList.remove('ready','refreshing');
    indicator.style.transform='';
    label.textContent='Pull down to refresh';
  };
  const runRefresh=async()=>{
    if(refreshing)return;
    refreshing=true;
    refreshButton?.classList.add('refreshing');
    refreshButton?.setAttribute('aria-label','Refreshing shared data');
    indicator.classList.remove('ready');
    indicator.classList.add('refreshing');
    indicator.style.transform='translate(-50%, 0)';
    label.textContent='Refreshing trips…';
    let refreshed=false;
    if(window.ADVENTURE_HUB_STORE)refreshed=await loadCloudData();
    label.textContent=refreshed?'Updated just now':'Could not refresh';
    window.setTimeout(()=>{
      refreshing=false;
      refreshButton?.classList.remove('refreshing');
      refreshButton?.setAttribute('aria-label','Refresh shared data');
      hide();
    },refreshed?800:1500);
  };
  refreshButton?.addEventListener('click',runRefresh);
  scroller.addEventListener('touchstart',event=>{
    if(refreshing||scrollTop()>2||document.querySelector('dialog[open]')||event.touches.length!==1)return;
    startY=event.touches[0].clientY;
    startX=event.touches[0].clientX;
    distance=0;
    pulling=true;
  },{passive:true});
  scroller.addEventListener('touchmove',event=>{
    if(!pulling||refreshing||event.touches.length!==1)return;
    const deltaY=event.touches[0].clientY-startY;
    const deltaX=Math.abs(event.touches[0].clientX-startX);
    if(deltaY<=0||deltaX>deltaY){pulling=false;hide();return;}
    distance=Math.min(82,deltaY*.9);
    if(distance>5)event.preventDefault();
    position(distance);
    const ready=distance>=threshold;
    indicator.classList.toggle('ready',ready);
    label.textContent=ready?'Release to refresh':'Pull down to refresh';
  },{passive:false});
  scroller.addEventListener('touchend',async()=>{
    if(!pulling||refreshing)return;
    pulling=false;
    if(distance<threshold){hide();return;}
    await runRefresh();
  },{passive:true});
  scroller.addEventListener('touchcancel',()=>{if(!refreshing){pulling=false;hide()}},{passive:true});
}
window.addEventListener('adventure-store-ready',loadCloudData);
if(window.ADVENTURE_HUB_STORE)loadCloudData();
enablePullToRefresh();
renderHome(); renderTrips(); renderNotes(); renderVehicleDetails();
async function checkForAppUpdate(){
  try{
    const response=await fetch(`version.json?checked=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)return;
    const latest=await response.json();
    if(latest.version&&latest.version!==APP_VERSION){
      const url=new URL(window.location.href);
      url.searchParams.set('v',latest.version);
      window.location.replace(url);
    }
  }catch(error){
    console.debug('Update check unavailable',error);
  }
}
window.addEventListener('pageshow',checkForAppUpdate);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForAppUpdate()});
