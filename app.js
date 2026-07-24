const APP_VERSION='0.26.0';
const SEED={"tripSummaries":[],"stays":[],"fuel":[],"siteFees":[],"electric":[],"sharedNotes":[],"meta":{"source":"Supabase","version":APP_VERSION},"phillisUpgrades":[],"rubyMaintenance":[],"rubyUpgrades":[],"phillisMaintenance":[]};
const KEY='phillis-ruby-hub-v04', OLDKEY='phillis-ruby-hub-v03';
const $=s=>document.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const clone=x=>JSON.parse(JSON.stringify(x));
const escapeHtml=value=>String(value).replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
function migrate(x){
  if(!x) return null;
  if(x.maintenance&&!x.phillisMaintenance) x.phillisMaintenance=x.maintenance;
  delete x.maintenance;
  for(const k of ['phillisMaintenance','phillisUpgrades','rubyMaintenance','rubyUpgrades','fuel','electric','siteFees','stays','tripSummaries','sharedNotes']) x[k]=x[k]||[];
  x.sharedNotes.forEach(note=>{
    note.photoPaths=Array.isArray(note.photoPaths)?note.photoPaths:[];
    note.photoUrls=Array.isArray(note.photoUrls)?note.photoUrls:[];
  });
  return x;
}
let db=migrate(JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(OLDKEY)||'null'))||clone(SEED);
let cloudLoaded=false;
const save=()=>{
  localStorage.setItem(KEY,JSON.stringify(db));
  if(cloudLoaded&&window.ADVENTURE_HUB_STORE){
    const status=$('#cloudAccountStatus');
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
  const summary=viewer
    ?'<span class="stay-card-chevron" aria-hidden="true">›</span>'
    :`<div class="stay-card-summary"><span>${money(stay.price)}</span><i aria-hidden="true">›</i></div>`;
  return `<article class="stay-listing-card" data-stay-detail="${index}" tabindex="0" aria-label="Open details for ${escapeHtml(stay.name)}"><div class="stay-listing-main"><div class="stay-listing-copy"><h4>${escapeHtml(stay.name)}</h4><p>${date(stay.arrival)}${stay.checkInTime?` · Check in ${clockTime(stay.checkInTime)}`:''} – ${date(stay.departure)}${stay.checkOutTime?` · Check out ${clockTime(stay.checkOutTime)}`:''}</p>${stayLocationHtml(stay)}${stay.site?`<p>Site ${escapeHtml(stay.site)}</p>`:''}<div class="stay-badges">${stayTypeBadges(stay)}</div></div>${stayPhotoGallery(stay)}${summary}</div></article>`;
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
function go(view){
  if(view==='notes'&&window.ADVENTURE_HUB_CLOUD?.role==='viewer')view='home';
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===view));
  $$('.bottom-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  window.scrollTo(0,0);
  if(view==='home') renderHome();
  if(view==='trips') renderTrips();
  if(view==='notes') renderNotes();
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));

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
function sortedSharedNotes(){
  return [...(db.sharedNotes||[])].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
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
  return `<button class="note-card${compact?' home-note-card':''}" type="button" data-note-index="${index}"><div class="note-card-top"><h3>${escapeHtml(note.title||'Untitled note')}</h3><span>Edit ›</span></div>${content}${photoContent}<small>${noteWhen(note.updatedAt||note.createdAt)?`Updated ${noteWhen(note.updatedAt||note.createdAt)}`:'Shared note'}</small></button>`;
}
function bindNoteCards(host){
  $$('[data-note-index]',host).forEach(button=>button.onclick=()=>openEntry('hub-note',+button.dataset.noteIndex));
}
function renderNotes(){
  const host=$('#noteList'); if(!host)return;
  const notes=sortedSharedNotes();
  host.innerHTML=notes.map(note=>noteCardHtml(note)).join('')||'<div class="empty">No shared notes yet. Add your first list, reminder, or idea.</div>';
  bindNoteCards(host);
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
  const recentNotes=sortedSharedNotes().slice(0,3);
  $('#recentNotes').innerHTML=recentNotes.map(note=>noteCardHtml(note,true)).join('')||'<div class="empty">New notes will appear here.</div>';
  bindNoteCards($('#recentNotes'));
  const recent=[];
  db.fuel.forEach((x,index)=>recent.push({type:'Fuel',kind:'fuel',index,icon:'⛽',title:x.station||'Fuel stop',sub:`${date(x.date)} · ${money(x.total)}`,stamp:x.date||''}));
  db.phillisMaintenance.forEach((x,index)=>recent.push({type:'Phillis',kind:'phillis',index,icon:'🔧',title:x.description||'Maintenance',sub:`${date(x.date)} · ${money(x.price)}`,stamp:x.date||''}));
  db.rubyMaintenance.forEach((x,index)=>recent.push({type:'Ruby',kind:'ruby',index,icon:'🛻',title:x.description||'Maintenance',sub:`${date(x.date)} · ${money(x.price)}`,stamp:x.date||''}));
  $('#recentRecords').innerHTML=recent.sort((a,b)=>b.stamp.localeCompare(a.stamp)).slice(0,3).map(r=>`<button class="record-item record-link" type="button" data-recent-record-kind="${r.kind}" data-recent-record-index="${r.index}" aria-label="Open ${escapeHtml(r.title)}"><span class="record-icon">${r.icon}</span><div class="item-copy"><h3>${escapeHtml(r.title)}</h3><p>${r.sub}</p></div><span class="recent-record-end"><span class="pill">${r.type}</span><span class="record-chevron">›</span></span></button>`).join('')||'<div class="empty">New entries will appear here.</div>';
  $$('[data-recent-record-kind]',$('#recentRecords')).forEach(button=>button.onclick=()=>{
    const index=+button.dataset.recentRecordIndex;
    if(button.dataset.recentRecordKind==='fuel')showFuelRecord(index);
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
  if(!openTripYears.size&&years.length) openTripYears.add(years[0]);
  if(q) years.forEach(year=>openTripYears.add(year));
  $('#tripList').innerHTML=years.map(year=>{
    const yearTrips=groups.get(year), totals=yearTotals(yearTrips), expanded=openTripYears.has(year);
    return `<section class="trip-year-group ${expanded?'is-open':''}" data-trip-year-group="${year}"><button class="trip-year-card" type="button" data-trip-year-toggle="${year}" aria-expanded="${expanded}"><div class="trip-year-heading"><div><small>TRAVEL YEAR</small><h2>${year}</h2><p>${yearTrips.length} ${yearTrips.length===1?'trip':'trips'} · ${totals.nights} nights</p></div><span class="year-chevron">⌄</span></div><div class="trip-year-numbers"><div><small>Miles</small><b>${number(totals.distance,1)}</b></div><div><small>Fuel</small><b>${money(totals.fuel)}</b></div><div><small>MPG</small><b>${number(totals.mpg,2)}</b></div><div><small>Stay cost</small><b>${money(totals.stayCost)}</b></div><div><small>Nights</small><b>${totals.nights}</b></div><div><small>Stays</small><b>${totals.stays}</b></div></div></button><div class="trip-year-content" ${expanded?'':'hidden'}>${yearTrips.map(tripCardHtml).join('')}</div></section>`;
  }).join('')||'<div class="empty">No trips found.</div>';
  $$('[data-trip-year-toggle]').forEach(button=>button.onclick=()=>{const year=Number(button.dataset.tripYearToggle);openTripYears.has(year)?openTripYears.delete(year):openTripYears.add(year);renderTrips()});
  bindTripButtons();
}
$('#tripSearch').addEventListener('input',renderTrips); $('#tripYear').addEventListener('change',renderTrips);
function matchingStays(t){
  const [start,end]=tripDates(t);
  if(tripHasDates(t)){
    return db.stays.filter(stay=>{
      if(stay.arrival==='Season') return false;
      const arrival=stay.arrival||'';
      const departure=stay.departure||arrival;
      return arrival<=end && departure>=start;
    }).sort((a,b)=>(a.arrival||'').localeCompare(b.arrival||''));
  }
  return [];
}
function matchingFuel(t){
  return db.fuel.filter(f=>(f._tripId&&t._cloudId&&f._tripId===t._cloudId)||f.trip===t.name||(f.date&&+f.date.slice(0,4)===+t.year&&f.trip?.toLowerCase().includes(t.name.toLowerCase())));
}
function showStay(index,tripIndex=null){
  const stay=db.stays[index]; if(!stay)return;
  const viewer=window.ADVENTURE_HUB_CLOUD?.role==='viewer';
  const type=stay.harvestHost||stay.stayType==='harvest-host'?'HARVEST HOST':stay.moochdocking||stay.stayType==='moochdocking'?'MOOCHDOCKING':stay.boondocking||stay.stayType==='boondocking'?'BOONDOCKING':'CAMPGROUND';
  const headerMeta=`<p class="detail-header-dates">${date(stay.arrival)} – ${date(stay.departure)}</p>`;
  setDetailHeader(type,stay.name,null,headerMeta);
  const actions=`<div class="record-detail-actions stay-detail-actions">${tripIndex!==null?'<button class="text-button" id="backToTripButton">← Back to trip</button>':''}${viewer?'':'<button class="primary" id="editStayButton">Edit stay</button>'}</div>`;
  const photos=stayPhotoGallery(stay);
  $('#detailBody').innerHTML=`${actions}<div class="detail-section"><div class="detail-row"><span>Arrival</span><span>${date(stay.arrival)}${stay.checkInTime?` · ${clockTime(stay.checkInTime)}`:''}</span></div><div class="detail-row"><span>Departure</span><span>${date(stay.departure)}${stay.checkOutTime?` · ${clockTime(stay.checkOutTime)}`:''}</span></div>${stay.site?`<div class="detail-row"><span>Site</span><span>${escapeHtml(stay.site)}</span></div>`:''}${viewer?'':`<div class="detail-row"><span>Stay cost</span><span>${money(stay.price)}</span></div>`}<div class="stay-detail-location"><small>LOCATION</small>${stayLocationHtml(stay,{full:true})}</div>${photos?`<div class="stay-detail-photos"><small>PHOTOS</small>${photos}</div>`:''}${stay.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(stay.notes)}</p></div>`:''}</div>`;
  if(tripIndex!==null)$('#backToTripButton').onclick=()=>{$('#detailDialog').close();showTrip(tripIndex)};
  if(!viewer)$('#editStayButton').onclick=()=>{$('#detailDialog').close();openEntry('stay',index,tripIndex)};
  bindStayPhotoButtons($('#detailBody'));
  bindStayMapLinks($('#detailBody'));
  if(!$('#detailDialog').open)$('#detailDialog').showModal();
}
function refreshTripFuelSummaries(){
  db.tripSummaries.forEach(trip=>{
    const rows=matchingFuel(trip);
    const distance=rows.reduce((sum,row)=>sum+(Number(row.tripMiles)||0),0);
    const gallons=rows.reduce((sum,row)=>sum+(Number(row.gallons)||0),0);
    const cost=rows.reduce((sum,row)=>sum+(Number(row.total)||0),0);
    trip.distance=distance||null;
    trip.gallons=gallons;
    trip.cost=cost;
    trip.mpg=distance&&gallons?distance/gallons:null;
  });
}
function bindTripButtons(){$$('[data-trip-index]').forEach(b=>b.onclick=()=>showTrip(+b.dataset.tripIndex))}
function showTrip(index){
  const t=db.tripSummaries[index]; if(!t)return;
  const [s,e]=tripDates(t), stays=matchingStays(t), fuel=matchingFuel(t);
  const stayCost=stays.reduce((total,stay)=>total+(Number(stay.price)||0),0);
  const fuelCost=fuel.length?fuel.reduce((total,stop)=>total+(Number(stop.total)||0),0):Number(t.cost)||0;
  const headerMeta=`<p class="detail-header-dates">${tripHasDates(t)?`${date(s)} – ${date(e)}`:t.year}</p>${rigLineHtml(t)}`;
  setDetailHeader('TRIP',t.name,t,headerMeta);
  if(window.ADVENTURE_HUB_CLOUD?.role==='viewer'){
    $('#detailBody').innerHTML=`${t.destination?`<div class="detail-section"><h3>Destination</h3><p>${escapeHtml(t.destination)}</p></div>`:''}<div class="detail-section"><h3>Itinerary</h3><div class="stay-listing-stack">${stays.map(x=>stayListing(x,{viewer:true})).join('')||'<p class="intro">No campground details have been added yet.</p>'}</div></div>`;
    bindStayPhotoButtons($('#detailBody'));
    bindStayMapLinks($('#detailBody'));
    bindStayCards($('#detailBody'),index);
    $('#detailDialog').showModal();
    return;
  }
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editTripButton">Edit trip</button></div><div class="detail-section trip-totals-section"><h3>Trip totals</h3><div class="trip-totals-compact"><div><small>Stay cost</small><b>${money(stayCost)}</b></div><div><small>Fuel cost</small><b>${money(fuelCost)}</b></div><div><small>Miles</small><b>${number(t.distance,1)}</b></div><div><small>MPG</small><b>${number(t.mpg,2)}</b></div></div></div><div class="detail-section"><h3>Campgrounds & hosts</h3><div class="stay-listing-stack">${stays.map(x=>stayListing(x)).join('')||'<p class="intro">No campground stays linked yet.</p>'}</div></div><div class="detail-section"><div class="detail-section-head"><h3>Fuel stops</h3><button class="text-button" id="addTripFuelButton">Add fuel</button></div>${fuel.map(x=>`<div class="detail-row editable-detail-row"><span><b>${escapeHtml(x.station)}</b><br><small>${date(x.date)} · ${escapeHtml(x.vehicle||t.towVehicle||'')} · ${x.fuelType==='diesel'?'Diesel':'Gasoline'} · ${number(x.gallons,2)} gal</small></span><div class="detail-value-actions"><span>${money(x.total)}</span><button class="small-button" data-edit-fuel="${db.fuel.indexOf(x)}">Edit</button></div></div>`).join('')||'<p class="intro">No fuel stops linked yet.</p>'}</div>${t.notes?`<div class="detail-section"><h3>Notes</h3><p>${escapeHtml(t.notes)}</p></div>`:''}<div class="trip-delete-area"><button class="delete-link" id="deleteTripButton">Delete trip</button></div>`;
  $('#editTripButton').onclick=()=>{$('#detailDialog').close();openEntry('trip',index)};
  $('#addTripFuelButton').onclick=()=>{$('#detailDialog').close();openEntry('fuel',null,index)};
  $$('[data-edit-fuel]').forEach(button=>button.onclick=()=>{$('#detailDialog').close();openEntry('fuel',+button.dataset.editFuel,index)});
  bindStayPhotoButtons($('#detailBody'));
  bindStayMapLinks($('#detailBody'));
  bindStayCards($('#detailBody'),index);
  $('#deleteTripButton').onclick=()=>deleteTrip(index);
  $('#detailDialog').showModal();
}
function deleteTrip(index){
  const t=db.tripSummaries[index]; if(!t)return;
  const linkedStays=matchingStays(t);
  const message=linkedStays.length?`Delete “${t.name}” and its ${linkedStays.length} linked campground ${linkedStays.length===1?'stay':'stays'}? Fuel records will remain.`:`Delete “${t.name}”?`;
  if(!confirm(message))return;
  linkedStays.forEach(stay=>{const i=db.stays.indexOf(stay);if(i>=0)db.stays.splice(i,1)});
  db.tripSummaries.splice(index,1);
  save(); $('#detailDialog').close(); renderHome(); renderTrips();
}
function rubyRecordList(items,key,type,page){
  return items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<button class="record-item record-link" type="button" data-ruby-record-key="${key}" data-ruby-record-index="${items.indexOf(x)}" data-ruby-record-type="${type}" data-ruby-record-page="${page}"><div class="item-copy"><h3>${x.description||'Record'}</h3><p>${date(x.date)}${x.location?' · '+x.location:''}${x.price?' · '+money(x.price):''}</p></div><span class="record-chevron">›</span></button>`).join('')||'<div class="empty">No records yet.</div>'
}
function showRubyRecord(key,index,type,page){
  const record=db[key]?.[index]; if(!record)return;
  setDetailHeader(type==='ruby-upgrade'?'RUBY UPGRADE':'RUBY MAINTENANCE',record.description||'Record details');
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editRubyRecord">Edit entry</button></div><div class="detail-section"><div class="detail-row"><span>Date</span><span>${date(record.date)}</span></div>${record.location?`<div class="detail-row"><span>Vendor / location</span><span>${escapeHtml(record.location)}</span></div>`:''}<div class="detail-row"><span>Cost</span><span>${money(record.price||0)}</span></div>${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}</div><div class="trip-delete-area"><button class="delete-link" id="deleteRubyRecord">Delete entry</button></div>`;
  $('#editRubyRecord').onclick=()=>{$('#detailDialog').close();openEntry(type,index)};
  $('#deleteRubyRecord').onclick=()=>{if(!confirm(`Delete “${record.description||'this record'}”?`))return;db[key].splice(index,1);save();$('#detailDialog').close();renderHome();showPanel(page)};
  $('#detailDialog').showModal();
}
function phillisRecordList(items,key,type,page){
  return items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<button class="record-item record-link" type="button" data-record-key="${key}" data-record-index="${items.indexOf(x)}" data-record-type="${type}" data-record-page="${page}"><div class="item-copy"><h3>${x.description||'Record'}</h3><p>${date(x.date)}${x.location?' · '+x.location:''}${x.price?' · '+money(x.price):''}</p></div><span class="record-chevron">›</span></button>`).join('')||'<div class="empty">No records yet.</div>'
}
function showPhillisRecord(key,index,type,page){
  const record=db[key]?.[index]; if(!record)return;
  setDetailHeader(type==='phillis-upgrade'?'PHILLIS UPGRADE':'PHILLIS MAINTENANCE',record.description||'Record details');
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editPhillisRecord">Edit entry</button></div><div class="detail-section"><div class="detail-row"><span>Date</span><span>${date(record.date)}</span></div>${record.location?`<div class="detail-row"><span>Vendor / location</span><span>${escapeHtml(record.location)}</span></div>`:''}<div class="detail-row"><span>Cost</span><span>${money(record.price||0)}</span></div>${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}</div><div class="trip-delete-area"><button class="delete-link" id="deletePhillisRecord">Delete entry</button></div>`;
  $('#editPhillisRecord').onclick=()=>{$('#detailDialog').close();openEntry(type,index)};
  $('#deletePhillisRecord').onclick=()=>{if(!confirm(`Delete “${record.description||'this record'}”?`))return;db[key].splice(index,1);save();$('#detailDialog').close();renderHome();showPanel(page)};
  $('#detailDialog').showModal();
}

function fuelRecordList(items){
  return items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<button class="record-item record-link" type="button" data-fuel-record-index="${items.indexOf(x)}"><span class="record-icon">⛽</span><div class="item-copy"><h3>${x.station||'Fuel stop'}</h3><p>${date(x.date)} · ${escapeHtml(x.vehicle||'Truck')} · ${x.fuelType==='diesel'?'Diesel':'Gasoline'} · ${number(x.gallons,2)} gal · ${money(x.total)}</p></div><span class="record-chevron">›</span></button>`).join('')||'<div class="empty">No fuel records yet.</div>'
}
function showFuelRecord(index){
  const record=db.fuel?.[index]; if(!record)return;
  setDetailHeader(`${record.vehicle||'TRIP'} FUEL STOP`.toUpperCase(),record.station||'Fuel stop');
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editFuelRecord">Edit entry</button></div><div class="detail-section"><div class="detail-row"><span>Date</span><span>${date(record.date)}</span></div>${record.trip?`<div class="detail-row"><span>Trip</span><span>${escapeHtml(record.trip)}</span></div>`:''}${record.vehicle?`<div class="detail-row"><span>Vehicle</span><span>${escapeHtml(record.vehicle)}</span></div>`:''}<div class="detail-row"><span>Fuel</span><span>${record.fuelType==='diesel'?'Diesel':'Gasoline'}</span></div>${record.location?`<div class="detail-row"><span>Location</span><span>${escapeHtml(record.location)}</span></div>`:''}<div class="detail-row"><span>Gallons</span><span>${number(record.gallons,3)}</span></div><div class="detail-row"><span>Total</span><span>${money(record.total||0)}</span></div><div class="detail-row"><span>Price per gallon</span><span>${money(record.price||((record.gallons&&record.total)?record.total/record.gallons:0))}</span></div>${record.odometer?`<div class="detail-row"><span>Odometer</span><span>${number(record.odometer,1)}</span></div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}</div><div class="trip-delete-area"><button class="delete-link" id="deleteFuelRecord">Delete entry</button></div>`;
  $('#editFuelRecord').onclick=()=>{$('#detailDialog').close();openEntry('fuel',index)};
  $('#deleteFuelRecord').onclick=()=>{if(!confirm(`Delete this fuel stop at ${record.station||'this station'}?`))return;db.fuel.splice(index,1);refreshTripFuelSummaries();save();$('#detailDialog').close();renderHome();renderTrips();showPanel('fuel-history')};
  $('#detailDialog').showModal();
}
function showSeasonRecord(index){
  const record=db.stays?.[index]; if(!record||record.arrival!=='Season')return;
  const payments=(db.siteFees||[]).filter(x=>+x.year===+record.year).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const yearElectric=(db.electric||[]).filter(x=>String(x.date||'').startsWith(String(record.year)));
  const electricTotal=yearElectric.reduce((sum,x)=>sum+(+x.total||0),0);
  setDetailHeader('LEHIGH GORGE SEASON',String(record.year));
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editSeasonRecord">Edit season</button></div><div class="detail-section"><div class="detail-row"><span>Site</span><span>${escapeHtml(record.site||'39')}</span></div><div class="detail-row"><span>Seasonal fee</span><span>${money(record.price||0)}</span></div><div class="detail-row"><span>Electric</span><span>${money(electricTotal)}</span></div><div class="detail-row"><span>Year total</span><span>${money((+record.price||0)+electricTotal)}</span></div>${record.address?`<div class="detail-row"><span>Address</span><span>${escapeHtml([record.address,record.city,record.state,record.zip].filter(Boolean).join(', '))}</span></div>`:''}${payments.length?`<div class="record-notes"><small>PAYMENTS</small>${payments.map(p=>`<p>${date(p.date)} · ${money(p.payment||0)}${p.check?' · check '+escapeHtml(p.check):''}</p>`).join('')}</div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}</div><div class="trip-delete-area"><button class="delete-link" id="deleteSeasonRecord">Delete season</button></div>`;
  $('#editSeasonRecord').onclick=()=>{$('#detailDialog').close();openEntry('sitefee',index)};
  $('#deleteSeasonRecord').onclick=()=>{if(!confirm(`Delete the ${record.year} Lehigh Gorge season and its payment records?`))return;db.stays.splice(index,1);db.siteFees=(db.siteFees||[]).filter(x=>+x.year!==+record.year);save();$('#detailDialog').close();renderHome();showPanel('lehigh')};
  $('#detailDialog').showModal();
}
function showSitePaymentRecord(index){
  const record=db.siteFees?.[index]; if(!record)return;
  setDetailHeader('LEHIGH GORGE SEASON PAYMENT',`${record.year} payment`);
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editSitePaymentRecord">Edit payment</button></div><div class="detail-section"><div class="detail-row"><span>Season</span><span>${record.year}</span></div><div class="detail-row"><span>Payment date</span><span>${date(record.date)}</span></div><div class="detail-row"><span>Amount</span><span>${money(record.payment||0)}</span></div>${record.check?`<div class="detail-row"><span>Check</span><span>${escapeHtml(record.check)}</span></div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}</div><div class="trip-delete-area"><button class="delete-link" id="deleteSitePaymentRecord">Delete payment</button></div>`;
  $('#editSitePaymentRecord').onclick=()=>{$('#detailDialog').close();openEntry('sitepayment',index)};
  $('#deleteSitePaymentRecord').onclick=()=>{if(!confirm('Delete this seasonal fee payment?'))return;db.siteFees.splice(index,1);save();$('#detailDialog').close();renderHome();showPanel('lehigh')};
  $('#detailDialog').showModal();
}
function showElectricRecord(index){
  const record=db.electric?.[index]; if(!record)return;
  setDetailHeader('LEHIGH GORGE ELECTRIC',date(record.date));
  $('#detailBody').innerHTML=`<div class="record-detail-actions"><button class="primary" id="editElectricRecord">Edit reading</button></div><div class="detail-section"><div class="detail-row"><span>Reading date</span><span>${date(record.date)}</span></div><div class="detail-row"><span>Previous meter</span><span>${number(record.previous,0)}</span></div><div class="detail-row"><span>Current meter</span><span>${number(record.current,0)}</span></div><div class="detail-row"><span>Usage</span><span>${number(record.usage,0)} kWh</span></div><div class="detail-row"><span>Rate</span><span>${money(record.unitPrice||0)} / kWh</span></div><div class="detail-row"><span>Total</span><span>${money(record.total||0)}</span></div>${record.paid?`<div class="detail-row"><span>Paid</span><span>${date(record.paid)}</span></div>`:''}${record.check?`<div class="detail-row"><span>Check</span><span>${escapeHtml(record.check)}</span></div>`:''}${record.notes?`<div class="record-notes"><small>NOTES</small><p>${escapeHtml(record.notes)}</p></div>`:''}</div><div class="trip-delete-area"><button class="delete-link" id="deleteElectricRecord">Delete reading</button></div>`;
  $('#editElectricRecord').onclick=()=>{$('#detailDialog').close();openEntry('electric',index)};
  $('#deleteElectricRecord').onclick=()=>{if(!confirm('Delete this electric reading?'))return;db.electric.splice(index,1);save();$('#detailDialog').close();renderHome();showPanel('lehigh')};
  $('#detailDialog').showModal();
}

function showPanel(page){
  let title='',html='';
  if(page==='phillis-maintenance'){title='Maintenance & repairs';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="phillis-maint">Add</button></div><div class="stack">${phillisRecordList(db.phillisMaintenance,'phillisMaintenance','phillis-maint','phillis-maintenance')}</div>`}
  if(page==='phillis-upgrades'){title='Upgrades';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="phillis-upgrade">Add</button></div><div class="stack">${phillisRecordList(db.phillisUpgrades,'phillisUpgrades','phillis-upgrade','phillis-upgrades')}</div>`}
  if(page==='ruby-maintenance'){title='Maintenance & service';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="ruby-maint">Add</button></div><div class="stack">${rubyRecordList(db.rubyMaintenance,'rubyMaintenance','ruby-maint','ruby-maintenance')}</div>`}
  if(page==='ruby-upgrades'){title='Upgrades';html=`<div class="section-row"><h2>${title}</h2><button class="text-button" data-open="ruby-upgrade">Add</button></div><div class="stack">${rubyRecordList(db.rubyUpgrades,'rubyUpgrades','ruby-upgrade','ruby-upgrades')}</div>`}
  if(page==='fuel-history'){html=`<div class="section-row"><h2>Fuel history</h2><button class="text-button" data-open="fuel">Add</button></div><div class="stack">${fuelRecordList(db.fuel)}</div>`}
  if(page==='lehigh'){
    const seasonal=db.stays.filter(x=>x.arrival==='Season').sort((a,b)=>b.year-a.year);
    const seasonalTotal=seasonal.reduce((sum,x)=>sum+(+x.price||0),0);
    const electricTotal=db.electric.reduce((sum,x)=>sum+(+x.total||0),0);
    const seasonCards=seasonal.map((season,position)=>{
      const year=+season.year;
      const payments=(db.siteFees||[]).filter(x=>+x.year===year).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const electric=(db.electric||[]).filter(x=>String(x.date||'').startsWith(String(year))).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const paymentTotal=payments.reduce((sum,x)=>sum+(+x.payment||0),0);
      const siteFee=+season.price||paymentTotal;
      const yearElectric=electric.reduce((sum,x)=>sum+(+x.total||0),0);
      const paidDifference=siteFee-paymentTotal;
      return `<details class="lehigh-year-group" ${position===0?'open':''}><summary class="lehigh-year-card"><div><small>LEHIGH GORGE SEASON</small><h2>${year}</h2><p>Site ${escapeHtml(season.site||'39')} · ${payments.length} ${payments.length===1?'payment':'payments'} · ${electric.length} electric ${electric.length===1?'bill':'bills'}</p></div><div class="lehigh-year-totals"><div><small>Site fee</small><b>${money(siteFee)}</b></div><div><small>Electric</small><b>${money(yearElectric)}</b></div><div><small>Season total</small><b>${money(siteFee+yearElectric)}</b></div><span class="year-chevron">⌄</span></div></summary><div class="lehigh-year-content"><div class="lehigh-section-head"><div><h3>Seasonal fee payments</h3><p>${money(paymentTotal)} paid${Math.abs(paidDifference)>.009?` · ${paidDifference>0?money(paidDifference)+' remaining':money(Math.abs(paidDifference))+' over'}`:''}</p></div><button class="text-button" data-add-site-payment="${year}">Add payment</button></div><div class="stack compact-stack">${payments.map(x=>`<button class="record-item record-link" type="button" data-site-payment-index="${db.siteFees.indexOf(x)}"><div class="item-copy"><h3>${date(x.date)}</h3><p>${x.check?'Check '+escapeHtml(x.check):'Payment'}</p></div><div class="record-value"><b>${money(x.payment)}</b><span class="record-chevron">›</span></div></button>`).join('')||'<div class="empty">No payment details recorded.</div>'}</div><div class="lehigh-section-head electric-head"><div><h3>Electric bills</h3><p>${money(yearElectric)} total</p></div><button class="text-button" data-add-electric-year="${year}">Add bill</button></div><div class="stack compact-stack">${electric.map(x=>`<button class="record-item record-link" type="button" data-electric-index="${db.electric.indexOf(x)}"><div class="item-copy"><h3>${date(x.date)}</h3><p>${number(x.usage,0)} kWh · meter ${x.previous} → ${x.current}${x.check?' · check '+escapeHtml(x.check):''}</p></div><div class="record-value"><b>${money(x.total)}</b><span class="record-chevron">›</span></div></button>`).join('')||'<div class="empty">No electric bills recorded.</div>'}</div><div class="season-actions"><button class="secondary" data-season-index="${db.stays.indexOf(season)}">Edit season details</button></div></div></details>`;
    }).join('');
    const seasonalSite=seasonal[0]||{};
    const seasonalTitle=seasonalSite.name||'Seasonal site';
    const seasonalAddress=[seasonalSite.address,seasonalSite.city,seasonalSite.state,seasonalSite.zip].filter(Boolean).join(', ');
    html=`<div class="section-row"><h2>${escapeHtml(seasonalTitle)}${seasonalSite.site?` · Site ${escapeHtml(seasonalSite.site)}`:''}</h2></div><article class="card">${seasonalAddress?`<b>${escapeHtml(seasonalAddress)}</b>`:''}<p>Phillis's seasonal home.</p><div class="trip-stat-grid lehigh-summary"><div><span>Years</span><strong>${seasonal.length}</strong></div><div><span>Season fees</span><strong>${money(seasonalTotal)}</strong></div><div><span>Electric</span><strong>${money(electricTotal)}</strong></div><div><span>Grand total</span><strong>${money(seasonalTotal+electricTotal)}</strong></div></div><div class="button-row"><button class="primary" data-open="sitefee">Add season</button></div></article><div class="lehigh-year-list">${seasonCards||'<div class="empty">No seasonal records yet.</div>'}</div>`
  }
  const target=page.startsWith('ruby')||page==='fuel-history'?$('#rubyPanel'):$('#phillisPanel'); target.innerHTML=html; bindOpeners(); bindDeletes();
  $$('[data-fuel-record-index]',target).forEach(button=>button.onclick=()=>showFuelRecord(+button.dataset.fuelRecordIndex));
  $$('[data-record-key]',target).forEach(button=>button.onclick=()=>showPhillisRecord(button.dataset.recordKey,+button.dataset.recordIndex,button.dataset.recordType,button.dataset.recordPage));
  $$('[data-ruby-record-key]',target).forEach(button=>button.onclick=()=>showRubyRecord(button.dataset.rubyRecordKey,+button.dataset.rubyRecordIndex,button.dataset.rubyRecordType,button.dataset.rubyRecordPage));
  $$('[data-season-index]',target).forEach(button=>button.onclick=()=>showSeasonRecord(+button.dataset.seasonIndex));
  $$('[data-electric-index]',target).forEach(button=>button.onclick=()=>showElectricRecord(+button.dataset.electricIndex));
  $$('[data-site-payment-index]',target).forEach(button=>button.onclick=()=>showSitePaymentRecord(+button.dataset.sitePaymentIndex));
  $$('[data-add-site-payment]',target).forEach(button=>button.onclick=()=>openEntry('sitepayment',null,+button.dataset.addSitePayment));
  $$('[data-add-electric-year]',target).forEach(button=>button.onclick=()=>openEntry('electric',null,+button.dataset.addElectricYear));
}
$$('[data-page]').forEach(b=>b.onclick=()=>showPanel(b.dataset.page));
function bindDeletes(){$$('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this record?')){db[b.dataset.delete].splice(+b.dataset.index,1);save();showPanel(b.closest('#rubyPanel')?'ruby-maintenance':'phillis-maintenance');renderHome()}})}
function stayPhotoEditorSlot(kind,title,help){
  return `<article class="stay-photo-editor"><div class="stay-photo-editor-copy"><b>${title}</b><p>${help}</p></div><div class="stay-photo-preview" id="${kind}PhotoPreview"><span>No photo yet</span></div><div class="stay-photo-actions"><label class="secondary photo-picker">Choose photo<input id="${kind}PhotoFile" type="file" accept="image/*" hidden></label><button class="delete-link remove-stay-photo" id="remove${kind[0].toUpperCase()+kind.slice(1)}Photo" type="button" hidden>Remove</button></div></article>`;
}
function notePhotoFields(){
  return `<section class="note-photo-editor"><div class="note-photo-editor-heading"><div><b>Pictures</b><p>Add up to six pictures from your phone.</p></div><label class="secondary photo-picker">Choose pictures<input id="notePhotoFiles" type="file" accept="image/*" multiple hidden></label></div><div id="notePhotoEditorGrid" class="note-photo-editor-grid"></div><small id="notePhotoCount">0 of 6 pictures</small></section>`;
}
function fields(type){
  if(type==='hub-note') return `<label>Title<input id="name" required maxlength="120"></label><label class="note-checklist-toggle"><input id="noteChecklist" type="checkbox"> Use checkboxes</label><div class="checklist-editor" id="checklistEditor" hidden></div><button type="button" class="secondary add-checklist-item" id="addChecklistItem" hidden>+ Add item</button>`;
  if(type==='trip') return `<label>Trip name<input id="name" required></label><div class="two"><label>Start date<input id="startDate" type="date" required></label><label>End date<input id="endDate" type="date" required></label></div><section class="trip-photo-editor"><div class="stay-photo-editors-heading"><b>On the Road Again</b><p>The photo you take near the start of this trip. It becomes the cover of the trip card.</p></div><div class="trip-photo-preview" id="onRoadPhotoPreview"><span>No photo yet</span></div><div class="stay-photo-actions"><label class="secondary photo-picker">Choose photo<input id="onRoadPhotoFile" type="file" accept="image/*" hidden></label><button class="delete-link remove-stay-photo" id="removeOnRoadPhoto" type="button" hidden>Remove</button></div></section><div class="trip-stays-heading"><div><b>Places you are staying</b><p class="field-help">Add and edit every stop for this trip.</p></div><button type="button" class="secondary small-add" id="addTripStay">Add another stay</button></div><div id="tripStaysEditor" class="trip-stays-editor"></div>`;
  if(type==='fuel'){
    const options=db.tripSummaries.slice().sort((a,b)=>tripStamp(b).localeCompare(tripStamp(a))).map(t=>`<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('');
    return `<div class="two"><label>Date<input id="date" type="date" required></label><label>Trip<select id="tripName" required><option value="">Choose a trip</option>${options}</select></label></div><label>Station<input id="station" required></label><label>Location<input id="location"></label><div class="three"><label>Gallons<input id="gallons" type="number" min=".001" step=".001" required></label><label>Total<input id="total" type="number" min="0" step=".01" required></label><label>Fuel type<select id="fuelType" required><option value="diesel">Diesel</option><option value="gasoline">Gasoline</option></select></label></div><div class="two"><label>Trip meter<input id="tripMeter" type="number" min="0" step=".1" required></label><label>Odometer<input id="odometer" type="number" min="0" step=".1"></label></div><div class="fuel-calculations" id="fuelCalculations"><span>MPG <b>—</b></span><span>Price / gallon <b>—</b></span></div>`;
  }
  if(type==='stay') return `<div class="two"><label>Arrival<input id="arrival" type="date" required></label><label>Departure<input id="departure" type="date"></label></div><div class="two"><label>Check-in time<input id="checkInTime" type="time"></label><label>Check-out time<input id="checkOutTime" type="time"></label></div><label>Campground<input id="name" required></label><label>Address<input id="address"></label><div class="three"><label>City<input id="city"></label><label>State<input id="state"></label><label>Site<input id="site"></label></div><label>Total cost<input id="total" type="number" step=".01"></label><div class="stay-type-options"><label><input id="harvestHost" type="checkbox"> Harvest Host</label><label><input id="moochdocking" type="checkbox"> Moochdocking</label><label><input id="boondocking" type="checkbox"> Boondocking</label></div><section class="stay-photo-editors"><div class="stay-photo-editors-heading"><b>Stay photos</b><p>Add these from Kayla’s photo library now or come back later.</p></div>${stayPhotoEditorSlot('site','Campsite','The campsite photo you take at nearly every stop.')}${stayPhotoEditorSlot('sign','Sign','The entrance, campground, winery, farm, or host sign.')}</section>`;
  if(type==='electric') return `<div class="two"><label>Reading date<input id="date" type="date" required></label><label>Paid date<input id="paid" type="date"></label></div><div class="three"><label>Previous meter<input id="previous" type="number" required></label><label>Current meter<input id="current" type="number" required></label><label>Rate / kWh<input id="rate" type="number" step=".001" value=".16"></label></div><label>Check number<input id="check"></label>`;
  if(type==='sitepayment') return `<div class="three"><label>Season year<input id="year" type="number" value="${new Date().getFullYear()}" required></label><label>Payment date<input id="date" type="date" required></label><label>Amount<input id="payment" type="number" step=".01" required></label></div><label>Check number<input id="check"></label>`;
  if(type==='sitefee'){
    const currentSite=db.stays.find(x=>x.arrival==='Season')||{};
    return `<div class="three"><label>Year<input id="year" type="number" value="${new Date().getFullYear()}" required></label><label>Seasonal fee<input id="total" type="number" step=".01"></label><label>Site<input id="site" value="${escapeHtml(currentSite.site||'')}"></label></div><label>Address<input id="address" value="${escapeHtml(currentSite.address||'')}"></label><div class="three"><label>City<input id="city" value="${escapeHtml(currentSite.city||'')}"></label><label>State<input id="state" value="${escapeHtml(currentSite.state||'')}"></label><label>ZIP<input id="zip" value="${escapeHtml(currentSite.zip||'')}"></label></div>`;
  }
  return `<label>Date<input id="date" type="date" required></label><label>${type.includes('upgrade')?'Upgrade':'Work performed'}<input id="description" required></label><div class="two"><label>Vendor / location<input id="location"></label><label>Cost<input id="total" type="number" step=".01"></label></div>`;
}
function bindOpeners(){$$('[data-open]').forEach(b=>b.onclick=()=>openEntry(b.dataset.open))}
let tripStayEditorItems=[];
function blankTripStay(start='',end=''){
  return {dbIndex:null,arrival:start,departure:end,checkInTime:'',checkOutTime:'',name:'',address:'',city:'',state:'',site:'',price:'',harvestHost:false,moochdocking:false,boondocking:false,stayType:'campground',notes:''};
}
function renderTripStayEditor(){
  const host=$('#tripStaysEditor'); if(!host)return;
  host.innerHTML=tripStayEditorItems.map((stay,i)=>`<fieldset class="trip-stay-card" data-stay-card="${i}"><div class="trip-stay-card-head"><legend>Stay ${i+1}</legend>${tripStayEditorItems.length>1?`<button type="button" class="remove-stay" data-remove-stay="${i}">Remove</button>`:''}</div><div class="two"><label>Arrival<input data-stay-field="arrival" type="date" value="${stay.arrival||''}" required></label><label>Departure<input data-stay-field="departure" type="date" value="${stay.departure||''}"></label></div><div class="two"><label>Check-in time<input data-stay-field="checkInTime" type="time" value="${String(stay.checkInTime||'').slice(0,5)}"></label><label>Check-out time<input data-stay-field="checkOutTime" type="time" value="${String(stay.checkOutTime||'').slice(0,5)}"></label></div><label>Campground or location<input data-stay-field="name" value="${escapeHtml(stay.name||'')}" required></label><label>Address<input data-stay-field="address" value="${escapeHtml(stay.address||'')}"></label><div class="three"><label>City<input data-stay-field="city" value="${escapeHtml(stay.city||'')}"></label><label>State<input data-stay-field="state" value="${escapeHtml(stay.state||'')}"></label><label>Site<input data-stay-field="site" value="${escapeHtml(stay.site||'')}"></label></div><label>Total cost<input data-stay-field="price" type="number" step=".01" value="${stay.price??''}"></label><div class="stay-type-options"><label><input data-stay-check="harvestHost" type="checkbox" ${stay.harvestHost||stay.stayType==='harvest-host'?'checked':''}> Harvest Host</label><label><input data-stay-check="moochdocking" type="checkbox" ${stay.moochdocking||stay.stayType==='moochdocking'?'checked':''}> Moochdocking</label><label><input data-stay-check="boondocking" type="checkbox" ${stay.boondocking||stay.stayType==='boondocking'?'checked':''}> Boondocking</label></div></fieldset>`).join('');
  $$('[data-remove-stay]',host).forEach(button=>button.onclick=()=>{tripStayEditorItems.splice(+button.dataset.removeStay,1);renderTripStayEditor()});
  $$('[data-stay-card]',host).forEach(card=>{
    const cost=card.querySelector('[data-stay-field="price"]');
    const checks=[...card.querySelectorAll('[data-stay-check]')];
    const syncCost=()=>{
      const freeStay=checks.some(check=>check.checked);
      if(freeStay){
        if(cost.value && +cost.value!==0) cost.dataset.previousCost=cost.value;
        cost.value='0';
        cost.disabled=true;
      }else{
        cost.disabled=false;
        if(cost.dataset.previousCost!==undefined){cost.value=cost.dataset.previousCost;delete cost.dataset.previousCost;}
      }
    };
    checks.forEach(check=>check.addEventListener('change',()=>{
      if(check.checked) checks.forEach(other=>{if(other!==check) other.checked=false;});
      syncCost();
    }));
    const initiallyChecked=checks.filter(check=>check.checked);
    if(initiallyChecked.length>1) initiallyChecked.slice(1).forEach(check=>check.checked=false);
    syncCost();
  });
}
function readTripStayCards(){
  return $$('[data-stay-card]').map((card,i)=>{
    const original=tripStayEditorItems[i]||{};
    const value=name=>card.querySelector(`[data-stay-field="${name}"]`)?.value||'';
    const checked=name=>Boolean(card.querySelector(`[data-stay-check="${name}"]`)?.checked);
    const harvestHost=checked('harvestHost'),moochdocking=checked('moochdocking'),boondocking=checked('boondocking');
    return {...original,arrival:value('arrival'),departure:value('departure'),checkInTime:value('checkInTime'),checkOutTime:value('checkOutTime'),name:value('name').trim(),address:value('address'),city:value('city'),state:value('state'),site:value('site'),price:+value('price')||0,harvestHost,moochdocking,boondocking,stayType:harvestHost?'harvest-host':moochdocking?'moochdocking':boondocking?'boondocking':'campground'};
  }).filter(stay=>stay.name);
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
  const titles={'hub-note':index===null?'Add note':'Edit note',trip:index===null?'Add trip':'Edit trip',fuel:index===null?'Add fuel':'Edit fuel stop',stay:index===null?'Add campground':'Edit stay','phillis-maint':index===null?'Add Phillis maintenance':'Edit Phillis maintenance','phillis-upgrade':index===null?'Add Phillis upgrade':'Edit Phillis upgrade','ruby-maint':index===null?'Add Ruby maintenance':'Edit Ruby maintenance','ruby-upgrade':index===null?'Add Ruby upgrade':'Edit Ruby upgrade',electric:index===null?'Add electric reading':'Edit electric reading',sitepayment:index===null?'Add seasonal payment':'Edit seasonal payment',sitefee:index===null?'Add season':'Edit season'};
  $('#entryType').value=type; $('#entryIndex').value=index===null?'':index; $('#entryStayIndex').value=returnTripIndex===null?'':returnTripIndex;
  $('#entryTitle').textContent=titles[type]; $('#entryFields').innerHTML=fields(type); $('#entryExtras').innerHTML=type==='hub-note'?notePhotoFields():''; $('#entryNotes').value='';
  $('#entryNotesLabel').textContent=type==='hub-note'?'Note':'Notes';
  const deleteNote=$('#deleteEntryNote');
  deleteNote.hidden=true;
  deleteNote.onclick=null;
  const today=new Date().toISOString().slice(0,10), d=$('#date')||$('#arrival')||$('#startDate'); if(d)d.value=today; if(type==='trip')$('#endDate').value=$('#startDate').value;
  if(type==='hub-note'){
    const note=index===null?null:db.sharedNotes?.[index];
    if(note){$('#name').value=note.title||'';$('#entryNotes').value=note.body||'';}
    setupNoteEditor(note?.body||'');
    bindNotePhotoEditor(note||{});
    if(note){
      deleteNote.hidden=false;
      deleteNote.onclick=async()=>{
        if(!confirm(`Delete “${note.title||'this note'}”?`))return;
        deleteNote.disabled=true;
        try{
          if(window.ADVENTURE_HUB_STORE&&note._cloudId)await window.ADVENTURE_HUB_STORE.deleteNotePhotos(note);
          db.sharedNotes.splice(index,1);
          await save();
          clearNotePhotoEditor();
          $('#entryDialog').close();
          renderHome();
          renderNotes();
        }catch(error){
          console.error(error);
          alert(`The note could not be deleted.\n\n${error.message}`);
          deleteNote.disabled=false;
        }
      };
    }
  }
  if(index===null && returnTripIndex!==null && (type==='sitepayment'||type==='electric')){const year=+returnTripIndex;if($('#year'))$('#year').value=year;if($('#date'))$('#date').value=`${year}-${type==='electric'?'06':'01'}-01`;if(type==='electric'&&$('#paid'))$('#paid').value='';}
  if(type==='stay'){
    const cost=$('#total'),checks=[$('#harvestHost'),$('#moochdocking'),$('#boondocking')];
    const syncCost=()=>{
      const freeStay=checks.some(check=>check?.checked);
      if(freeStay){
        if(cost.value && +cost.value!==0) cost.dataset.previousCost=cost.value;
        cost.value='0';
        cost.disabled=true;
      }else{
        cost.disabled=false;
        if(cost.dataset.previousCost!==undefined){cost.value=cost.dataset.previousCost;delete cost.dataset.previousCost;}
      }
    };
    checks.forEach(check=>check?.addEventListener('change',()=>{
      if(check.checked) checks.forEach(other=>{if(other&&other!==check) other.checked=false;});
      syncCost();
    }));
    syncCost();
  }
  if(type==='fuel'){
    const syncTripFuelType=()=>{
      const trip=db.tripSummaries.find(item=>item.name===$('#tripName').value);
      if(trip?.towFuelType)$('#fuelType').value=trip.towFuelType;
    };
    const updatePreview=()=>{
      const gallons=Number($('#gallons').value),total=Number($('#total').value),tripMeter=Number($('#tripMeter').value);
      const values=$$('#fuelCalculations b');
      values[0].textContent=gallons>0&&tripMeter>=0?number(tripMeter/gallons,2):'—';
      values[1].textContent=gallons>0&&total>=0?money(total/gallons):'—';
    };
    if(index!==null){
      const fuel=db.fuel[index];
      if(fuel){
        $('#date').value=fuel.date||today; $('#tripName').value=fuel.trip||''; $('#station').value=fuel.station||''; $('#location').value=fuel.location||'';
        $('#gallons').value=fuel.gallons??''; $('#total').value=fuel.total??''; $('#fuelType').value=fuel.fuelType||(+String(fuel.date||'').slice(0,4)>=2025?'diesel':'gasoline'); $('#tripMeter').value=fuel.tripMiles??''; $('#odometer').value=fuel.odometer??''; $('#entryNotes').value=fuel.notes||'';
      }
    }else if(returnTripIndex!==null){
      $('#tripName').value=db.tripSummaries[returnTripIndex]?.name||'';
    }else{
      const currentTrip=db.tripSummaries.find(trip=>tripStatus(trip)==='current');
      if(currentTrip)$('#tripName').value=currentTrip.name;
    }
    if(index===null)syncTripFuelType();
    $('#tripName').addEventListener('change',syncTripFuelType);
    $('#date').addEventListener('change',()=>{
      if($('#tripName').value)return;
      const value=$('#date').value;
      const matching=db.tripSummaries.find(trip=>{const [start,end]=tripDates(trip);return start<=value&&end>=value;});
      if(matching){$('#tripName').value=matching.name;syncTripFuelType();}
    });
    ['#gallons','#total','#tripMeter'].forEach(selector=>$(selector).addEventListener('input',updatePreview));
    updatePreview();
  }
  if(type==='stay' && index!==null){
    const stay=db.stays[index];
    if(stay){
      $('#arrival').value=stay.arrival||today; $('#departure').value=stay.departure||''; $('#name').value=stay.name||''; $('#address').value=stay.address||'';
      $('#checkInTime').value=String(stay.checkInTime||'').slice(0,5); $('#checkOutTime').value=String(stay.checkOutTime||'').slice(0,5);
      $('#city').value=stay.city||''; $('#state').value=stay.state||''; $('#site').value=stay.site||''; $('#total').value=stay.price??'';
      $('#harvestHost').checked=Boolean(stay.harvestHost||stay.stayType==='harvest-host'); $('#moochdocking').checked=Boolean(stay.moochdocking||stay.stayType==='moochdocking'); $('#boondocking').checked=Boolean(stay.boondocking||stay.stayType==='boondocking'); $('#entryNotes').value=stay.notes||'';
      const selected=[$('#harvestHost'),$('#moochdocking'),$('#boondocking')].filter(x=>x.checked); if(selected.length>1) selected.slice(1).forEach(x=>x.checked=false);
      $('#harvestHost').dispatchEvent(new Event('change'));
    }
  }
  if(type==='stay')bindStayPhotoEditor(index===null?{}:db.stays[index]);
  if(type==='sitepayment' && index!==null){
    const record=db.siteFees?.[index];
    if(record){$('#year').value=record.year||new Date().getFullYear();$('#date').value=record.date||today;$('#payment').value=record.payment??'';$('#check').value=record.check||'';$('#entryNotes').value=record.notes||'';}
  }
  if(type==='electric' && index!==null){
    const record=db.electric?.[index];
    if(record){$('#date').value=record.date||today;$('#paid').value=record.paid||'';$('#previous').value=record.previous??'';$('#current').value=record.current??'';$('#rate').value=record.unitPrice??.16;$('#check').value=record.check||'';$('#entryNotes').value=record.notes||'';}
  }
  if(type==='sitefee' && index!==null){
    const record=db.stays?.[index];
    if(record){$('#year').value=record.year||new Date().getFullYear();$('#total').value=record.price??'';$('#site').value=record.site||'';$('#address').value=record.address||'';$('#city').value=record.city||'';$('#state').value=record.state||'';$('#zip').value=record.zip||'';$('#entryNotes').value=record.notes||'';}
  }
  if(['phillis-maint','phillis-upgrade','ruby-maint','ruby-upgrade'].includes(type) && index!==null){
    const key=type==='phillis-maint'?'phillisMaintenance':type==='phillis-upgrade'?'phillisUpgrades':type==='ruby-maint'?'rubyMaintenance':'rubyUpgrades';
    const record=db[key]?.[index];
    if(record){$('#date').value=record.date||today;$('#description').value=record.description||'';$('#location').value=record.location||'';$('#total').value=record.price??'';$('#entryNotes').value=record.notes||'';}
  }
  if(type==='trip'){
    if(index!==null){
      const t=db.tripSummaries[index], [start,end]=tripDates(t), stays=matchingStays(t);
      $('#name').value=t.name||''; $('#startDate').value=start; $('#endDate').value=end; $('#entryNotes').value=t.notes||'';
      tripStayEditorItems=stays.length?stays.map(stay=>({...stay,dbIndex:db.stays.indexOf(stay)})):[blankTripStay(start,end)];
    } else tripStayEditorItems=[blankTripStay($('#startDate').value,$('#endDate').value)];
    renderTripStayEditor();
    bindTripPhotoEditor(index===null?{}:db.tripSummaries[index]);
    $('#addTripStay').onclick=()=>{
      const current=readTripStayCards();
      tripStayEditorItems=current.length?current:tripStayEditorItems;
      const last=tripStayEditorItems[tripStayEditorItems.length-1]||{};
      tripStayEditorItems.push(blankTripStay(last.departure||$('#startDate').value,$('#endDate').value));
      renderTripStayEditor();
    };
  }
  $('#entryDialog').showModal();
}
$$('dialog .close').forEach(b=>b.onclick=()=>{const dialog=b.closest('dialog');dialog.close();if(dialog.id==='entryDialog'){clearStayPhotoPreviewUrls();clearNotePhotoEditor();}});
$$('dialog').forEach(dialog=>dialog.addEventListener('mousedown',event=>{const box=dialog.getBoundingClientRect();const outside=event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;if(outside){dialog.close();if(dialog.id==='entryDialog'){clearStayPhotoPreviewUrls();clearNotePhotoEditor();}}}));
bindOpeners();
$('#entryForm').onsubmit=async e=>{
  e.preventDefault(); const type=$('#entryType').value;
  const notes=type==='hub-note'&&$('#noteChecklist')?.checked?checklistBody(readChecklistEditor()):$('#entryNotes').value;
  const submitButton=$('#entryForm').querySelector('.form-actions .primary');
  const originalButtonText=submitButton.textContent;
  let savedStay=null;
  let savedTrip=null;
  let savedNote=null;
  const pendingNotePhotoChanges=type==='hub-note'?notePhotoChanges():{addFiles:[],removePaths:[]};
  const stayPhotoChanges=type==='stay'?[
    {kind:'site',file:$('#sitePhotoFile')?.files?.[0]||null,remove:$('#sitePhotoFile')?.dataset.remove==='true'},
    {kind:'sign',file:$('#signPhotoFile')?.files?.[0]||null,remove:$('#signPhotoFile')?.dataset.remove==='true'}
  ].filter(change=>change.file||change.remove):[];
  const tripPhotoChange=type==='trip'&&($('#onRoadPhotoFile')?.files?.[0]||$('#onRoadPhotoFile')?.dataset.remove==='true')
    ?{file:$('#onRoadPhotoFile')?.files?.[0]||null,remove:$('#onRoadPhotoFile')?.dataset.remove==='true'}
    :null;
  if(type==='hub-note'){
    const index=$('#entryIndex').value===''?null:+$('#entryIndex').value;
    const prior=index===null?null:db.sharedNotes[index];
    const now=new Date().toISOString();
    const record={
      ...(prior||{}),
      title:$('#name').value.trim(),
      body:notes,
      photoPaths:[...(prior?.photoPaths||[])],
      photoUrls:[...(prior?.photoUrls||[])],
      createdAt:prior?.createdAt||now,
      updatedAt:now
    };
    if(index===null)db.sharedNotes.push(record);else db.sharedNotes[index]=record;
    savedNote=record;
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
    const originalIndices=new Set(tripStayEditorItems.map(x=>x.dbIndex).filter(x=>x!==null&&x!==undefined));
    db.stays=db.stays.filter((_,i)=>!originalIndices.has(i));
    editedStays.forEach(stay=>{
      const arrival=stay.arrival||s,departure=stay.departure||eDate;
      db.stays.push({...stay,dbIndex:undefined,year:+arrival.slice(0,4),arrival,departure,nights:departure?Math.round((new Date(departure)-new Date(arrival))/86400000):null,notes:stay.notes||''});
    });
  }
  else if(type==='fuel'){
    const g=+$('#gallons').value||0,total=+$('#total').value||0,index=$('#entryIndex').value===''?null:+$('#entryIndex').value;
    const selectedTrip=db.tripSummaries.find(trip=>trip.name===$('#tripName').value);
    if(!selectedTrip){alert('Please choose a trip from the list.');$('#tripName').focus();return;}
    const record={...(index===null?{}:db.fuel[index]),_tripId:selectedTrip._cloudId||null,_vehicleId:selectedTrip._towVehicleId||null,vehicle:selectedTrip.towVehicle||'',date:$('#date').value,trip:selectedTrip.name,station:$('#station').value.trim(),location:$('#location').value.trim(),gallons:g,total,price:g?total/g:0,fuelType:$('#fuelType').value,tripMiles:+$('#tripMeter').value,odometer:$('#odometer').value===''?null:+$('#odometer').value,notes};
    if(index===null) db.fuel.push(record); else db.fuel[index]=record;
    refreshTripFuelSummaries();
  }
  else if(type==='stay'){
    const a=$('#arrival').value,d=$('#departure').value,index=$('#entryIndex').value===''?null:+$('#entryIndex').value,harvestHost=$('#harvestHost').checked,moochdocking=$('#moochdocking').checked,boondocking=$('#boondocking').checked,stayType=harvestHost?'harvest-host':moochdocking?'moochdocking':boondocking?'boondocking':'campground';
    const record={...(index===null?{}:db.stays[index]),year:+a.slice(0,4),arrival:a,departure:d,checkInTime:$('#checkInTime').value,checkOutTime:$('#checkOutTime').value,nights:d?Math.round((new Date(d)-new Date(a))/86400000):null,name:$('#name').value,address:$('#address').value,city:$('#city').value,state:$('#state').value,site:$('#site').value,price:+$('#total').value||0,harvestHost,moochdocking,boondocking,stayType,notes};
    if(index===null) db.stays.push(record); else db.stays[index]=record;
    savedStay=record;
  }
  else if(type==='sitepayment'){const index=$('#entryIndex').value===''?null:+$('#entryIndex').value,record={...(index===null?{}:db.siteFees[index]),year:+$('#year').value,date:$('#date').value,payment:+$('#payment').value||0,check:$('#check').value,notes};if(index===null)db.siteFees.push(record);else db.siteFees[index]=record}
  else if(type==='electric'){const p=+$('#previous').value,c=+$('#current').value,r=+$('#rate').value||.16,u=c-p,index=$('#entryIndex').value===''?null:+$('#entryIndex').value,record={...(index===null?{}:db.electric[index]),date:$('#date').value,previous:p,current:c,usage:u,unitPrice:r,total:u*r,paid:$('#paid').value,check:$('#check').value,notes};if(index===null)db.electric.push(record);else db.electric[index]=record}
  else if(type==='sitefee'){const y=+$('#year').value,total=+$('#total').value||0,index=$('#entryIndex').value===''?null:+$('#entryIndex').value,record={...(index===null?{}:db.stays[index]),year:y,arrival:'Season',departure:'Season',nights:null,name:'Lehigh Gorge Campground',address:$('#address').value,city:$('#city').value,state:$('#state').value,zip:$('#zip').value,site:$('#site').value||'39',price:total,harvestHost:false,notes};if(index===null)db.stays.push(record);else db.stays[index]=record;const annual=(db.siteFees||[]).find(x=>+x.year===y&&x.yearTotal!=null);if(annual)annual.yearTotal=total}
  else {const obj={date:$('#date').value,description:$('#description').value,location:$('#location').value,price:+$('#total').value||0,notes},key=type==='phillis-maint'?'phillisMaintenance':type==='phillis-upgrade'?'phillisUpgrades':type==='ruby-maint'?'rubyMaintenance':'rubyUpgrades',index=$('#entryIndex').value===''?null:+$('#entryIndex').value;if(index===null)db[key].push(obj);else db[key][index]={...db[key][index],...obj}}
  const returnTripIndex=$('#entryStayIndex').value===''?null:+$('#entryStayIndex').value;
  submitButton.disabled=true;
  submitButton.textContent=stayPhotoChanges.length?'Saving stay…':tripPhotoChange?'Saving trip…':pendingNotePhotoChanges.addFiles.length||pendingNotePhotoChanges.removePaths.length?'Saving note…':'Saving…';
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
  $('#entryDialog').close(); renderHome(); renderTrips(); renderNotes();
  if(type==='fuel' && returnTripIndex===null) showPanel('fuel-history');
  if(type==='phillis-maint') showPanel('phillis-maintenance');
  if(type==='phillis-upgrade') showPanel('phillis-upgrades');
  if(type==='electric'||type==='sitepayment'||type==='sitefee') showPanel('lehigh');
  if(returnTripIndex!==null && !['sitepayment','electric'].includes(type)) showTrip(returnTripIndex);
};
$('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='adventure-hub-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('#importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=migrate(JSON.parse(r.result));applyDataMigrations();save();renderHome();renderTrips();renderNotes();alert('Backup imported.')}catch{alert('That file could not be imported.')}};r.readAsText(f)};
async function loadCloudData(){
  const status=$('#cloudAccountStatus');
  if(status)status.textContent='Loading shared Travel Journal records…';
  try{
    db=migrate(await window.ADVENTURE_HUB_STORE.load());
    TODAY=new Date(); TODAY.setHours(0,0,0,0);
    cloudLoaded=true;
    localStorage.setItem(KEY,JSON.stringify(db));
    renderHome();renderTrips();renderNotes();
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
  document.addEventListener('touchstart',event=>{
    if(refreshing||window.scrollY>2||document.querySelector('dialog[open]')||event.touches.length!==1)return;
    startY=event.touches[0].clientY;
    startX=event.touches[0].clientX;
    distance=0;
    pulling=true;
  },{passive:true});
  document.addEventListener('touchmove',event=>{
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
  document.addEventListener('touchend',async()=>{
    if(!pulling||refreshing)return;
    pulling=false;
    if(distance<threshold){hide();return;}
    await runRefresh();
  },{passive:true});
  document.addEventListener('touchcancel',()=>{if(!refreshing){pulling=false;hide()}},{passive:true});
}
window.addEventListener('adventure-store-ready',loadCloudData);
if(window.ADVENTURE_HUB_STORE)loadCloudData();
enablePullToRefresh();
renderHome(); renderTrips(); renderNotes();
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
