import { escapeHtml } from './core.mjs';
import { DEMO_EMAIL } from './fixtures.mjs';
import { getLang, t, uxError } from './i18n.mjs';

/** Accessible email -> code -> record picker. Callbacks integrate with the existing product editor. */
export function createArchiveFlow({api,openDialog,closeDialog,dialogHeader,onSelected,onCleared,onCancelled,notify}) {
  const esc=escapeHtml;
  let step='email',email='',challenge=null,items=[],record=null,selectedPhoto=null,error='',busy=false,epoch=0,nextCursor=null;
  let resendAt=0,expiryTimer=null,tickTimer=null;
  const dialog=document.querySelector('#shop-dialog');
  const isOpen=()=>dialog.open&&dialog.dataset.flow==='archive';
  const modeLabel=()=>api.getMode()==='live'?t('arc.mode.live'):t('arc.mode.demo');
  function banner(){return `<div class="archive-mode ${api.getMode()==='live'?'is-live':''}">${esc(modeLabel())}</div>`;}
  function progress(){const index=step==='email'?0:step==='code'?1:2;return `<ol class="archive-progress" aria-label="${esc(t('arc.progress'))}">${[t('arc.step.email'),t('arc.step.code'),t('arc.step.pick')].map((label,i)=>`<li class="${i===index?'current':i<index?'complete':''}" ${i===index?'aria-current="step"':''}><span>${i<index?'✓':i+1}</span>${esc(label)}</li>`).join('')}</ol>`;}
  function status(){return `<p id="archive-error" class="form-error" role="alert">${esc(error)}</p>`;}
  function endActions(){return `<div class="archive-secondary"><button type="button" class="mini-link" data-archive="manual">${esc(t('arc.manual'))}</button>${api.getSession()?`<button type="button" class="mini-link" data-archive="logout">${esc(t('arc.logout'))}</button>`:''}</div>`;}
  function shell(title,content){
    openDialog('archive',`${dialogHeader(title,'YOUR LETTER, YOUR WAY')}<div class="dialog-body archive-v2">${banner()}${progress()}${content}${status()}${endActions()}</div>`,'compact');dialog.dataset.flow='archive';
  }
  function render(){
    if(step==='loading'){shell(t('arc.loading'),`<div class="archive-loading" role="status"><span class="loading-ring"></span><p>${esc(t('arc.wait'))}</p></div>`);return;}
    if(step==='email'){
      shell(t('arc.email.title'),`<p class="archive-intro">${t('arc.email.intro')}</p><form id="archive-email-form"><label class="field"><span>${esc(t('arc.email.label'))}</span><input name="archiveEmail" type="email" maxlength="254" required autocomplete="email" placeholder="your@email.com" value="${esc(email)}" ${busy?'disabled':''}></label><p class="field-help">${t('arc.email.help')}</p><button class="button button-dark archive-primary" type="submit" ${busy?'disabled':''}>${esc(busy?t('arc.email.busy'):t('arc.email.submit'))} <span>→</span></button></form>${api.getMode()!=='live'?`<div class="demo-entry"><strong>${esc(t('arc.demo.title'))}</strong><p>${esc(t('arc.demo.body'))}</p><button class="demo-chip" type="button" data-archive="demo-email" data-email="${DEMO_EMAIL}">${esc(t('arc.demo.bori'))}</button><button class="demo-chip" type="button" data-archive="demo-email" data-email="nabi@example.test">${esc(t('arc.demo.nabi'))}</button><button class="demo-chip" type="button" data-archive="demo-email" data-email="empty@example.test">${esc(t('arc.demo.empty'))}</button></div>`:''}`);
    }else if(step==='code'){
      shell(t('arc.code.title'),`<p class="archive-intro">${t('arc.code.intro',{email:esc(email)})}</p><form id="archive-code-form"><label class="field"><span>${esc(t('arc.code.label'))} <small>${esc(t('arc.code.help'))}</small></span><input class="otp-input" name="archiveCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="000000" ${busy?'disabled':''}></label>${challenge?.demoCode?`<div class="demo-otp"><span>${esc(t('arc.demo.otp'))}</span><strong id="demo-code">${esc(challenge.demoCode)}</strong><button type="button" class="mini-link" data-archive="fill-code">${esc(t('arc.demo.fill'))}</button></div>`:''}<button type="submit" class="button button-dark archive-primary" ${busy?'disabled':''}>${esc(busy?t('arc.code.busy'):t('arc.code.submit'))} <span>→</span></button></form><div class="archive-resend"><button type="button" class="mini-link" data-archive="resend" ${busy?'disabled':''}>${esc(t('arc.resend'))}</button><span id="resend-count"></span><button type="button" class="mini-link" data-archive="change-email">${esc(t('arc.changeEmail'))}</button></div><p class="field-help">${esc(t('arc.code.spam'))}</p>`);updateCountdown();
    }else if(step==='list'){
      const session=api.getSession();
      shell(items.length?t('arc.list.title'):t('arc.list.emptyTitle'),`<p class="archive-account">${esc(session?.maskedEmail||'')} <span>${esc(t('arc.verified'))}</span></p>${items.length?`<p class="archive-intro">${t('arc.list.intro')}</p><div class="archive-records">${items.map(item=>`<button type="button" class="archive-record" data-archive="select" data-id="${esc(item.id)}"><span class="record-glyph">✉</span><span><small>${esc(item.petName)}</small><strong>${esc(item.title)}</strong><em>${esc(formatDate(item.createdAt))} · ${esc(t('arc.photos',{n:Number(item.photoCount)||0}))}</em></span><span class="record-arrow">↗</span></button>`).join('')}</div>${nextCursor?`<button type="button" class="button button-outline archive-primary" data-archive="more">${esc(t('arc.more'))}</button>`:''}`:`<div class="archive-empty"><span>✉</span><p>${t('arc.empty')}</p><p>${t('arc.empty2')}</p></div><button type="button" class="button button-outline archive-primary" data-archive="logout">${esc(t('arc.otherEmail'))}</button>`}`);
    }else if(step==='detail'){
      shell(t('arc.detail.title'),`<button type="button" class="mini-link" data-archive="back-list">${esc(t('arc.back'))}</button><div class="selected-record-heading"><p>${esc(t('arc.petStory',{name:record.petName}))}</p><h3>${esc(record.title)}</h3><small>${esc(formatDate(record.createdAt))}</small></div><div class="real-letter-preview">${esc(record.letter||record.message||t('arc.noLetter'))}</div>${record.letter.length>2000?`<p class="field-help">${esc(t('arc.long'))}</p>`:''}<p class="option-label">${esc(t('arc.photoPick'))} <span class="field-help">${esc(record.photos.length?t('arc.photoChange'):t('arc.photoNone'))}</span></p>${record.photos.length?`<div class="archive-photo-grid">${record.photos.map(p=>`<button class="archive-photo-choice" type="button" data-archive="photo" data-id="${esc(p.id)}" aria-pressed="${selectedPhoto===p.id}"><img src="${esc(api.photoUrl(record.id,p.id))}" alt="${esc(p.label||t('arc.photoAlt'))}" loading="lazy"><span>${esc(p.label||t('arc.photoWord'))}</span></button>`).join('')}</div><button type="button" class="mini-link" data-archive="no-photo">${esc(t('arc.photoLater'))}</button>`:`<p class="disclosure">${esc(t('arc.photoEmpty'))}</p>`}<button type="button" class="button button-dark archive-primary" data-archive="apply" ${busy?'disabled':''}>${esc(busy?t('arc.apply.busy'):t('arc.apply'))} <span>→</span></button><p class="field-help">${t('arc.apply.help')}</p>`);
    }else if(step==='error'){
      shell(t('arc.error.title'),`<p class="archive-intro">${t('arc.error.body')}</p><button type="button" class="button button-outline archive-primary" data-archive="retry">${esc(t('arc.retry'))}</button>`);
    }
  }
  function formatDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?t('arc.dateUnknown'):d.toLocaleDateString(getLang()==='en'?'en-US':'ko-KR',{year:'numeric',month:'long',day:'numeric'});}
  function updateCountdown(){
    if(!isOpen()||step!=='code')return;const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));const button=dialog.querySelector('[data-archive="resend"]');if(button)button.disabled=busy||seconds>0;const output=document.querySelector('#resend-count');if(output)output.textContent=seconds?t('arc.resend.in',{n:seconds}):'';
  }
  function scheduleExpiry(){clearTimeout(expiryTimer);const s=api.getSession();if(!s)return;expiryTimer=setTimeout(()=>{epoch++;record=null;items=[];onCleared('expired');step='email';error=t('arc.expired');if(isOpen())render();notify(t('arc.cleared'));},Math.max(1,s.expiresAt-Date.now()));}
  async function handleError(e){if(e.status===401){onCleared('expired');step='email';record=null;items=[];error=uxError(e.message);}else error=uxError(e.message||t('arc.retryShort'));busy=false;if(isOpen())render();}
  async function run(action){if(busy)return;busy=true;error='';const version=++epoch;render();try{await action(version);}catch(e){if(version===epoch)await handleError(e);}finally{if(version===epoch){busy=false;if(isOpen())render();}}}
  async function loadList(more=false, version=epoch){const result=await api.list(more?nextCursor:null);if(version!==epoch)return;items=more?[...items,...result.archives.filter(x=>!items.some(i=>i.id===x.id))]:result.archives;nextCursor=result.nextCursor;step='list';scheduleExpiry();}
  async function open(){
    ++epoch;record=null;error='';busy=false;step='loading';render();const version=epoch;
    try{const status=await api.bootstrap();if(version!==epoch)return;if(status.session){await loadList();}else{onCleared('unauthenticated');step='email';}if(version===epoch&&isOpen())render();}
    catch(e){if(version===epoch){error=e.message;step='error';render();}}
    clearInterval(tickTimer);tickTimer=setInterval(updateCountdown,500);
  }
  async function submitEmail(){await run(async(version)=>{challenge=await api.requestCode(email);if(version!==epoch)return;resendAt=Date.now()+challenge.resendAfterMs;step='code';});}
  async function disconnect(){await run(async()=>{await api.logout();clearTimeout(expiryTimer);onCleared('logout');record=null;items=[];email='';challenge=null;await api.bootstrap();step='email';notify(t('arc.disconnected'));});}
  document.addEventListener('submit',event=>{
    if(event.target.id==='archive-email-form'){event.preventDefault();email=event.target.elements.archiveEmail.value.trim();submitEmail();}
    if(event.target.id==='archive-code-form'){event.preventDefault();const code=event.target.elements.archiveCode.value.trim();run(async(version)=>{await api.verifyCode(challenge.challengeId,code);if(version!==epoch)return;await loadList();});}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-archive]');if(!button||button.disabled||!isOpen())return;
    const action=button.dataset.archive;
    if(action==='demo-email'){email=button.dataset.email;render();dialog.querySelector('input')?.focus();}
    else if(action==='fill-code'){const input=dialog.querySelector('[name="archiveCode"]');if(input)input.value=challenge.demoCode;}
    else if(action==='change-email'){epoch++;busy=false;step='email';error='';render();}
    else if(action==='resend')submitEmail();
    else if(action==='logout')disconnect();
    else if(action==='retry')open();
    else if(action==='select')run(async(version)=>{const data=await api.read(button.dataset.id);if(version!==epoch)return;record=data.archive;selectedPhoto=record.photos[0]?.id||null;step='detail';});
    else if(action==='more')run(async()=>loadList(true));
    else if(action==='back-list'){step='list';error='';render();}
    else if(action==='photo'){selectedPhoto=button.dataset.id;render();}
    else if(action==='no-photo'){selectedPhoto=null;render();}
    else if(action==='apply')run(async(version)=>{
      const photo=selectedPhoto?await api.photoData(record.id,selectedPhoto):'';if(version!==epoch)return;
      const selection={id:record.id,name:record.petName,title:record.title,message:record.message,letter:record.letter,photo,photoId:selectedPhoto,sample:false,source:'soultrace'};
      // clear marker before returning to the product editor; no stale completion can reopen the picker.
      delete dialog.dataset.flow;onSelected(selection);record=null;
    });
    else if(action==='manual'){epoch++;busy=false;delete dialog.dataset.flow;closeDialog();onCancelled(true);}
  });
  // In-flight work must not reopen a dismissed dialog.
  dialog.addEventListener('close',()=>{epoch++;busy=false;delete dialog.dataset.flow;record=null;clearInterval(tickTimer);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&api.getSession()?.expiresAt<=Date.now()){onCleared('expired');if(isOpen())open();}});
  return {open,cancel(){epoch++;busy=false;record=null;clearInterval(tickTimer);delete dialog.dataset.flow;},refresh(){if(isOpen())render();},async logout(){await disconnect();},scheduleExpiry};
}
