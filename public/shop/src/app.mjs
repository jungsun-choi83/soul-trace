import { createArchiveApi } from './archive-api.mjs';
import { createArchiveFlow } from './archive-flow.mjs';
import { PRODUCTS, SHOP } from './catalog.mjs';
import { getProduct, getVariant, catalogProductIdFromQuery, createLine, addLine, changeQuantity, calculateCart, serializeCart, restoreCart, validateDelivery, validateFileMetadata, escapeHtml } from './core.mjs';
import { applyStaticCopy, getLang, initLang, langToggleHtml, localizedFaqs, localizedProduct, money, setLang, t, uxError } from './i18n.mjs';

const h = escapeHtml;
const icon = (name, className = '') => `<svg class="icon ${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const asset = name => globalThis.SOULTRACE_EMBEDDED_ASSETS?.[name] ?? new URL(`../assets/${name}`, import.meta.url).href;
const $ = selector => document.querySelector(selector);
const dialog = $('#shop-dialog');
const state = { cart: [], archive: null, filter: 'all', modal: null, draft: null, productId: null, variantId: null, quantity: 1, editId: null, photoBusy: false, uploadToken: 0, previousFocus: null, result: null };
let toastTimer;
let archiveReturn = null;
let archiveFlow;
const archiveApi = createArchiveApi();
const privacyChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('soultrace-shop-privacy-v2') : null;
try { state.cart = restoreCart(localStorage.getItem(SHOP.cartKey)); } catch { /* Storage disabled: keep a functional in-memory cart. */ }

function productArt(product, thumbnail = false) {
  if (product.art === 'letter') return `<div class="product-art art-letter"><img src="${asset('letter-suite.webp')}" alt="${h(t('product.letterAlt'))}" loading="lazy" width="657" height="652"><img class="nfc-tag-cutout" src="${asset('photo-keyring.png')}" alt="${h(t('product.tagAlt'))}" loading="lazy" width="330" height="614"></div>`;
  if (product.art === 'book') return `<div class="product-art art-book"><img src="${asset('mini-book-front.webp')}" alt="${h(t('product.bookAlt'))}" loading="lazy" width="380" height="401"></div>`;
  return `<div class="product-art art-nfc" role="img" aria-label="${h(t('product.nfcAria'))}"><div class="nfc-card"><img src="${asset('pet-bori.webp')}" alt="" loading="lazy"><div class="nfc-card-meta"><span class="nfc-mark">${icon('spark')} NFC</span><strong>${thumbnail ? 'OPEN' : 'A MEMORY TO OPEN'}</strong><small>SOUL TRACE</small></div></div>${thumbnail ? '' : `<p class="nfc-card-caption">${h(t('product.nfcCaption'))}</p>`}</div>`;
}

function shownProduct(id) {
  return localizedProduct(getProduct(id));
}
function renderProducts() {
  const visible = PRODUCTS.filter(product => state.filter === 'all' || product.category === state.filter).map(product => localizedProduct(product));
  $('#product-grid').innerHTML = visible.map(product => `<article class="product-card" data-product-card="${product.id}">
    <button type="button" class="product-visual-button" data-action="product" data-product="${product.id}" aria-label="${h(t('product.detailAria', { name: product.name }))}"><span class="product-badge">${h(product.tag)}</span>${productArt(product)}<span class="product-quick">${h(t('product.quick'))} ${icon('plus')}</span></button>
    <div class="product-info"><div class="product-overline"><span>${h(product.english.toUpperCase())}</span><div class="color-dots" aria-label="${h(product.variants.map(v => v.name).join(', '))}">${product.variants.map(v => `<span class="color-dot" style="--swatch:${v.color}"></span>`).join('')}</div></div><h3 class="product-title"><button type="button" data-action="product" data-product="${product.id}">${h(product.name)}</button></h3><p class="product-short">${h(product.short)}</p><p class="product-price">${money(product.price)}<span>${h(t('product.made'))}</span></p></div>
  </article>`).join('');
  $('#collection-count').textContent = t('collection.count', { n: visible.length });
  document.querySelectorAll('[data-filter]').forEach(button => { const active = button.dataset.filter === state.filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}
function updateHeader() {
  const { quantity } = calculateCart(state.cart);
  $('#cart-count').textContent = String(quantity);
  $('#cart-count').hidden = quantity === 0;
  $('.cart-trigger').setAttribute('aria-label', t('cart.count', { n: quantity }));
  $('#archive-header-label').textContent = state.archive ? t('archive.story', { name: state.archive.name }) : t('archive.mine');
}
function renderFaqs() {
  $('#faq-list').innerHTML = localizedFaqs().map(([question, answer]) => `<details><summary>${h(question)}${icon('plus')}</summary><p>${h(answer)}</p></details>`).join('');
}
function applyLanguage() {
  applyStaticCopy();
  updateHeader();
  renderProducts();
  renderFaqs();
  if (state.modal === 'product' && state.draft) { syncDraftFromFields(); renderProductDialog(); }
  else if (state.modal === 'cart') renderCart();
  else if (state.modal === 'checkout') {
    const form = $('#checkout-form');
    const saved = form ? Object.fromEntries(new FormData(form).entries()) : null;
    const reviewed = form?.elements.reviewed?.checked;
    const demo = form?.elements.demoAcknowledged?.checked;
    renderCheckout();
    const next = $('#checkout-form');
    if (saved && next) {
      Object.entries(saved).forEach(([key, value]) => {
        if (next.elements[key] && next.elements[key].type !== 'checkbox') next.elements[key].value = value;
      });
      next.elements.reviewed.checked = Boolean(reviewed);
      next.elements.demoAcknowledged.checked = Boolean(demo);
    }
  }
  else if (state.modal === 'result' && state.result) renderOrderResult();
  else if (state.modal === 'archive') archiveFlow?.refresh?.();
  else if (state.modal === 'info' && state.infoKey) renderInfo(state.infoKey);
}
function persistCart() {
  try { localStorage.setItem(SHOP.cartKey, serializeCart(state.cart)); } catch { /* Privacy mode/quota: the cart continues in memory. */ }
  updateHeader();
}
function toast(text) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3400);
}
function dialogHeader(title, eyebrow = 'SOUL TRACE MEMORY SHOP') {
  return `<div class="dialog-header"><div><p class="eyebrow">${h(eyebrow)}</p><h2 id="dialog-title" tabindex="-1">${h(title)}</h2></div><div class="dialog-header-tools">${langToggleHtml()}<button class="icon-button dialog-close" type="button" data-action="close" aria-label="${h(t('close'))}">${icon('close')}</button></div></div>`;
}
function openDialog(kind, markup, className = '') {
  if (!dialog.open) state.previousFocus = document.activeElement;
  state.modal = kind;
  if (kind !== 'archive') delete dialog.dataset.flow;
  dialog.className = className;
  dialog.innerHTML = markup;
  if (!dialog.open) dialog.showModal();
  document.body.style.overflow = 'hidden';
  dialog.scrollTop = 0;
  $('#dialog-title')?.focus({ preventScroll: true });
}
function closePlainDialog() {
  dialog.close();
  dialog.innerHTML = ''; // Remove transient form data and image data URLs from the dialog DOM.
  document.body.style.overflow = '';
  state.modal = null;
  state.infoKey = null;
  state.draft = null;
  state.result = null;
  state.photoBusy = false;
  state.uploadToken += 1;
  if (state.previousFocus?.isConnected) state.previousFocus.focus({ preventScroll: true });
}
function closeDialog() {
  if (state.modal === 'archive') {
    archiveFlow?.cancel();
    if (archiveReturn) { restoreProduct(); return; }
  }
  closePlainDialog();
}
function emptyDraft() { return { name: '', message: '', letter: '', photo: '', sample: false }; }
function defaultDraft() {
  return state.archive ? { name: state.archive.name, message: state.archive.message, letter: state.archive.letter,
    photo: state.archive.photo || '', sample: false, sourceArchiveId: state.archive.id,
    sourcePhotoId: state.archive.photoId || '', sourceTitle: state.archive.title } : emptyDraft();
}
function restoreProduct(selection = null, manual = false) {
  const saved = archiveReturn; archiveReturn = null;
  if (saved) {
    Object.assign(state, saved);
    if (selection) state.draft = defaultDraft();
    else if (manual) state.draft = saved.draft || emptyDraft();
    state.photoBusy = false; state.uploadToken += 1;
    renderProductDialog();
  } else if (selection) { closePlainDialog(); document.querySelector('#collection').scrollIntoView({ behavior: 'smooth' }); }
  else if (manual) { state.archive = null; updateHeader(); closePlainDialog(); openProduct('letter'); }
  else closePlainDialog();
}
function clearPrivateContent(reason = 'expired', broadcast = false) {
  state.archive = null;
  state.cart = state.cart.map(line => (reason !== 'unauthenticated' || line.personalization?.sourceArchiveId) ? { ...line, personalization: null } : line);
  if (state.draft && (reason !== 'unauthenticated' || state.draft.sourceArchiveId)) state.draft = emptyDraft();
  if (archiveReturn?.draft && (reason !== 'unauthenticated' || archiveReturn.draft.sourceArchiveId)) archiveReturn.draft = emptyDraft();
  state.result = null; state.uploadToken += 1; state.photoBusy = false;
  persistCart();
  if (state.modal === 'product' && state.draft) renderProductDialog();
  else if (state.modal === 'cart') renderCart();
  else if (['checkout','result'].includes(state.modal)) closePlainDialog();
  if (broadcast) privacyChannel?.postMessage({ type: 'clear-private' });
}
function openProduct(productId, editId = null) {
  const product = getProduct(productId);
  if (!product) return;
  const line = editId ? state.cart.find(item => item.id === editId) : null;
  state.productId = productId;
  state.variantId = line?.variantId ?? product.variants[0].id;
  state.quantity = line?.quantity ?? 1;
  state.editId = line?.id ?? null;
  state.draft = line?.personalization ? { ...line.personalization } : defaultDraft();
  state.photoBusy = false;
  state.uploadToken += 1;
  renderProductDialog();
}
function stepper(value, scope, id = '') {
  return `<div class="stepper" aria-label="${h(t('qty.group'))}"><button type="button" data-action="quantity" data-scope="${scope}" data-id="${h(id)}" data-delta="-1" aria-label="${h(t('qty.down'))}" ${value <= 1 ? 'disabled' : ''}>${icon('minus')}</button><output aria-live="polite">${value}</output><button type="button" data-action="quantity" data-scope="${scope}" data-id="${h(id)}" data-delta="1" aria-label="${h(t('qty.up'))}" ${value >= SHOP.maxQuantity ? 'disabled' : ''}>${icon('plus')}</button></div>`;
}
function draftPhoto() { return state.draft?.photo || (state.draft?.sample ? asset('pet-bori.webp') : ''); }
function renderProductDialog() {
  const product = shownProduct(state.productId);
  const draft = state.draft;
  const photo = draftPhoto();
  const photoHint = product.photoRule === 'required' ? t('photo.hint.required') : product.photoRule === 'letter-or-photo' ? t('photo.hint.either') : t('photo.hint.optional');
  const letterHint = product.photoRule === 'letter-or-photo' ? t('letter.hint.either') : t('letter.hint.optional');
  const variantNote = product.id === 'minibook' ? t('variant.minibook') : product.id === 'nfc' ? t('variant.nfc') : t('variant.letter');
  const markup = `${dialogHeader(t('dialog.personalize'), t('dialog.personalize.eye'))}<div class="dialog-body product-detail"><div class="detail-visual">${productArt(product)}<div class="detail-gallery-note">${h(t('gallery.note'))}<br><span id="variant-note">${h(variantNote)}</span></div></div><div class="detail-info"><p class="eyebrow">${h(product.english.toUpperCase())}</p><h3>${h(product.name)}</h3><p class="product-price">${money(product.price)}</p><p class="detail-description">${h(product.description)}</p><p class="option-label">${h(t('color.label'))} <span class="field-help">${h(t('color.help'))}</span></p><div class="variant-buttons">${product.variants.map(variant => `<button type="button" class="variant-button" data-action="variant" data-variant="${variant.id}" aria-pressed="${state.variantId === variant.id}"><span class="swatch" style="--swatch:${variant.color}"></span>${h(variant.name)}</button>`).join('')}</div>
    <form id="personalize-form" class="detail-form"><div class="form-heading"><strong>${h(t('form.heading'))}</strong><button class="mini-link" type="button" data-action="fill-archive">${h(t('form.loadLetter'))}</button></div>${draft.sourceArchiveId ? `<div class="source-letter-badge">✉ ${h(draft.sourceTitle || t('form.sourceLetter'))}<small>${h(t('form.sourceHelp'))}</small></div>` : ''}<label class="field"><span>${h(t('form.name'))} <small>${h(t('form.name.help'))}</small></span><input name="petName" value="${h(draft.name)}" maxlength="20" required placeholder="${h(t('form.name.ph'))}" autocomplete="off"></label><label class="field"><span>${h(t('form.sentence'))} <small><span id="message-count">${draft.message.length}</span>/120</small></span><textarea name="message" maxlength="120" rows="3" placeholder="${h(t('form.sentence.ph'))}">${h(draft.message)}</textarea></label>
    ${product.showsLetter ? `<label class="field"><span>${h(t('form.letter'))} <small>${h(letterHint)}</small></span><textarea name="letter" maxlength="2000" rows="5" placeholder="${h(t('form.letter.ph'))}">${h(draft.letter)}</textarea></label>` : ''}
    <span class="field-label">${h(t('photo.label'))} <small>${h(photoHint)}</small></span><label class="photo-upload"><span id="photo-upload-visual">${photo ? `<img src="${h(photo)}" alt="${h(t('photo.alt'))}">` : icon('photo')}</span><span><p id="photo-upload-label">${photo ? (draft.sample ? h(t('photo.sample')) : h(t('photo.mine'))) : h(t('photo.choose'))}</p><small>${h(t('photo.types'))}</small></span><input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="${h(t('photo.aria'))}"></label><p class="field-help">${t('photo.help')}</p>
    <div class="personalized-preview">${icon('heart')}<div><p id="personalization-title">${h(t('preview.title', { name: draft.name || t('preview.defaultName') }))}</p><small id="personalization-message">${h(draft.message || t('preview.defaultMsg'))}</small></div></div><div class="detail-quantity"><span>${h(t('qty'))}</span><div id="detail-stepper">${stepper(state.quantity, 'detail')}</div></div><p id="product-error" class="form-error" role="alert"></p><button type="submit" class="button button-dark detail-submit"><span>${h(state.editId ? t('cart.update') : t('cart.add'))}</span><span id="detail-total">${money(product.price * state.quantity)}</span></button><p class="field-help">${h(t('pay.help'))}</p></form>
    <dl class="detail-specs">${product.details.map(([key, value]) => `<div><dt>${h(key)}</dt><dd>${h(value)}</dd></div>`).join('')}</dl></div></div>`;
  openDialog('product', markup);
}
function syncDraftFromFields() {
  if (!state.draft) return;
  const form = $('#personalize-form');
  if (!form) return;
  state.draft.name = form.elements.petName.value;
  state.draft.message = form.elements.message.value;
  if (form.elements.letter) state.draft.letter = form.elements.letter.value;
}
function updateDraftPreview() {
  const draft = state.draft;
  if (!draft) return;
  $('#message-count').textContent = String(draft.message.length);
  $('#personalization-title').textContent = t('preview.title', { name: draft.name || t('preview.defaultName') });
  $('#personalization-message').textContent = draft.message || t('preview.defaultMsg');
}
async function choosePhoto(file) {
  const error = validateFileMetadata(file);
  if (error) { $('#product-error').textContent = uxError(error); return; }
  const token = ++state.uploadToken;
  state.photoBusy = true;
  $('#product-error').textContent = '';
  $('#photo-upload-label').textContent = t('photo.busy');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 30_000_000) throw new Error(t('err.pixels'));
    const ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('err.preview'));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.87);
    if (token !== state.uploadToken || state.modal !== 'product') return;
    state.draft.photo = data;
    state.draft.sample = false;
    state.draft.sourcePhotoId = ''; // Replaced locally; never identify it as the archived original.
    $('#photo-upload-visual').innerHTML = `<img src="${h(data)}" alt="${h(t('photo.alt'))}">`;
    $('#photo-upload-label').textContent = t('photo.mine');
  } catch (err) {
    if (token === state.uploadToken && state.modal === 'product') {
      $('#product-error').textContent = uxError(err instanceof Error ? err.message : t('err.read'));
      $('#photo-upload-label').textContent = draftPhoto() ? t('photo.keep') : t('photo.retry');
    }
  } finally {
    bitmap?.close();
    if (token === state.uploadToken) state.photoBusy = false;
  }
}
function renderCart() {
  const { subtotal, quantity } = calculateCart(state.cart);
  if (!state.cart.length) {
    openDialog('cart', `${dialogHeader(t('cart.title'))}<div class="empty-state">${icon('bag')}<h3>${h(t('cart.empty.title'))}</h3><p>${t('cart.empty.body')}</p><button type="button" class="button button-dark" data-action="browse">${h(t('cart.empty.cta'))} ${icon('arrow')}</button></div>`, 'drawer');
    return;
  }
  const markup = state.cart.map(line => {
    const product = shownProduct(line.productId);
    const variant = getVariant(product, line.variantId);
    return `<article class="cart-line" data-cart-line="${h(line.id)}"><div class="cart-thumbnail">${productArt(product, true)}</div><div><div class="cart-line-head"><h3>${h(product.name)}</h3><button type="button" class="remove-line" data-action="remove" data-id="${h(line.id)}" aria-label="${h(t('cart.remove', { name: product.name }))}">${icon('close')}</button></div><p>${h(variant.name)}</p>${line.personalization ? `<p>${h(t('cart.memory', { name: line.personalization.name }))}${line.personalization.sample ? h(t('cart.sample')) : ''}</p>` : `<p class="cart-warning">${h(t('cart.need'))}</p>`}<button type="button" class="mini-link" data-action="edit" data-id="${h(line.id)}">${h(line.personalization ? t('cart.edit') : t('cart.reenter'))}</button><div class="cart-line-bottom">${stepper(line.quantity, 'cart', line.id)}<strong>${money(product.price * line.quantity)}</strong></div></div></article>`;
  }).join('');
  openDialog('cart', `${dialogHeader(t('cart.title.n', { n: quantity }))}<div class="cart-body">${markup}<p class="disclosure">${h(t('cart.disclosure'))}</p></div><div class="cart-footer"><div class="amount-row"><span>${h(t('cart.subtotal'))}</span><strong>${money(subtotal)}</strong></div><div class="amount-row muted"><span>${h(t('cart.shipping'))}</span><span>${h(t('cart.pending'))}</span></div><button type="button" class="button button-dark" data-action="checkout">${h(t('cart.checkout'))} ${icon('arrow')}</button><p>${h(t('cart.previewOnly'))}</p></div>`, 'drawer');
}
function renderArchive() {
  if (state.modal === 'product' && state.draft) {
    syncDraftFromFields();
    archiveReturn = { productId: state.productId, variantId: state.variantId, quantity: state.quantity,
      editId: state.editId, draft: { ...state.draft } };
    state.uploadToken += 1; state.photoBusy = false;
  } else archiveReturn = null;
  archiveFlow.open();
}
function orderSummaryLines(lines) {
  return lines.map(line => { const product = shownProduct(line.productId); return `<div class="summary-line"><p>${h(product.name)} × ${line.quantity}</p><small>${h(getVariant(product, line.variantId).name)} · ${h(line.personalization?.name || t('checkout.unnamed'))}</small><strong>${money(product.price * line.quantity)}</strong></div>`; }).join('');
}
function renderCheckout() {
  if (!state.cart.length) { renderCart(); return; }
  const missing = state.cart.find(line => !line.personalization);
  if (missing) { openProduct(missing.productId, missing.id); toast(t('toast.needPersonal')); return; }
  const { subtotal } = calculateCart(state.cart);
  openDialog('checkout', `${dialogHeader(t('checkout.title'), t('checkout.eye'))}<div class="dialog-body checkout-grid"><form id="checkout-form" class="checkout-form"><div class="checkout-heading"><h3>${h(t('checkout.heading'))}</h3><button type="button" class="mini-link" data-action="fill-test">${h(t('checkout.fill'))}</button></div><p class="disclosure">${h(t('checkout.disclosure'))}</p><div class="two-fields"><label class="field"><span>${h(t('checkout.recipient'))}</span><input name="recipient" maxlength="50" required autocomplete="off" placeholder="${h(t('checkout.ph.recipient'))}"></label><label class="field"><span>${h(t('checkout.phone'))}</span><input name="phone" maxlength="25" required autocomplete="off" inputmode="tel" placeholder="010-0000-0000"></label></div><label class="field"><span>${h(t('checkout.email'))}</span><input type="email" name="email" maxlength="254" required autocomplete="off" placeholder="sample@example.test"></label><div class="two-fields"><label class="field"><span>${h(t('checkout.country'))}</span><select name="country" aria-label="${h(t('checkout.country.aria'))}"><option value="KR">${h(t('checkout.country.kr'))}</option></select></label><label class="field"><span>${h(t('checkout.postal'))}</span><input name="postal" maxlength="5" pattern="[0-9]{5}" required autocomplete="off" inputmode="numeric" placeholder="00000"></label></div><label class="field"><span>${h(t('checkout.address'))}</span><input name="address" maxlength="200" required autocomplete="off" placeholder="${h(t('checkout.ph.address'))}"></label><label class="field"><span>${h(t('checkout.address2'))} <small>${h(t('checkout.optional'))}</small></span><input name="addressDetail" maxlength="150" autocomplete="off" placeholder="${h(t('checkout.ph.address2'))}"></label><label class="checkbox-row"><input name="reviewed" type="checkbox" required><span>${h(t('checkout.reviewed'))}</span></label><label class="checkbox-row"><input name="demoAcknowledged" type="checkbox" required><span>${h(t('checkout.demo'))}</span></label><p id="checkout-error" class="form-error" role="alert"></p><button type="submit" class="button button-dark">${h(t('checkout.submit'))} ${icon('arrow')}</button><button type="button" class="mini-link" data-action="cart">${h(t('checkout.back'))}</button></form><aside class="checkout-side"><h3>${h(t('checkout.side'))}</h3>${orderSummaryLines(state.cart)}<div class="amount-row"><span>${h(t('cart.subtotal'))}</span><strong>${money(subtotal)}</strong></div><div class="amount-row muted"><span>${h(t('checkout.ship'))}</span><span>${h(t('cart.pending'))}</span></div><div class="amount-row muted"><span>${h(t('checkout.pay'))}</span><span>${h(t('checkout.unpriced'))}</span></div><p class="disclosure">${h(t('checkout.sideHelp'))}</p></aside></div>`);
}
function renderOrderResult() {
  const result = state.result;
  openDialog('result', `${dialogHeader(t('result.title'), t('result.eye'))}<div class="dialog-body"><div class="preview-result"><div class="success-mark">${icon('check')}</div><h3>${h(t('result.h3'))}</h3><p>${t('result.body')}</p><div class="preview-reference">${h(result.reference)}</div>${orderSummaryLines(state.cart)}<div class="amount-row"><span>${h(t('cart.subtotal'))}</span><strong>${money(result.subtotal)}</strong></div><div class="amount-row muted"><span>${h(t('result.final'))}</span><span>${h(t('result.unpaid'))}</span></div><button type="button" class="button button-dark" data-action="browse">${h(t('result.continue'))} ${icon('arrow')}</button></div></div>`, 'compact');
}
function renderInfo(key) {
  const title = t(`info.${key}.title`);
  const body = t(`info.${key}.body`);
  if (!title || title.startsWith('info.')) return;
  state.infoKey = key;
  openDialog('info', `${dialogHeader(title)}<div class="dialog-body info-copy">${body}</div>`, 'compact');
}

document.addEventListener('click', event => {
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.filter = filter.dataset.filter; renderProducts(); return; }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, product, id, variant, info, scope, delta, lang } = button.dataset;
  switch (action) {
    case 'lang':
      if (lang === 'en' || lang === 'ko') { setLang(lang); applyLanguage(); }
      break;
    case 'product': openProduct(product); break;
    case 'archive': renderArchive(); break;
    case 'cart': renderCart(); break;
    case 'close': closeDialog(); break;
    case 'browse': closeDialog(); $('#collection').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); break;
    case 'variant':
      if (!getVariant(getProduct(state.productId), variant)) break;
      state.variantId = variant;
      dialog.querySelectorAll('[data-action="variant"]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.variant === variant)));
      break;
    case 'quantity':
      try {
        if (scope === 'detail') {
          state.quantity = Math.min(SHOP.maxQuantity, Math.max(1, state.quantity + Number(delta)));
          $('#detail-stepper').innerHTML = stepper(state.quantity, 'detail');
          $('#detail-total').textContent = money(getProduct(state.productId).price * state.quantity);
        } else {
          const line = state.cart.find(item => item.id === id);
          if (!line) break;
          state.cart = changeQuantity(state.cart, id, line.quantity + Number(delta)); persistCart(); renderCart();
        }
      } catch (err) { toast(uxError(err.message)); }
      break;
    case 'remove': state.cart = state.cart.filter(line => line.id !== id); persistCart(); renderCart(); break;
    case 'edit': { const line = state.cart.find(item => item.id === id); if (line) openProduct(line.productId, id); break; }
    case 'fill-archive': renderArchive(); break;
    case 'disconnect': renderArchive(); break;
    case 'checkout': renderCheckout(); break;
    case 'fill-test': {
      const form = $('#checkout-form');
      const fills = getLang() === 'en'
        ? { recipient: 'Test recipient', phone: '010-0000-0000', email: 'sample@example.test', postal: '00000', address: 'Test street for preview only', addressDetail: 'Preview only · not shipped' }
        : { recipient: '테스트 수령인', phone: '010-0000-0000', email: 'sample@example.test', postal: '00000', address: '테스트용 가상 주소입니다', addressDetail: '미리보기 전용 · 발송하지 않음' };
      Object.entries(fills).forEach(([key, value]) => { form.elements[key].value = value; });
      break;
    }
    case 'info': renderInfo(info); break;
    case 'clear-local':
      state.cart = []; clearPrivateContent('logout', true); archiveApi.bootstrap().then(() => archiveApi.logout()).catch(() => toast(t('toast.logoutFail'))); updateHeader();
      try { localStorage.removeItem(SHOP.cartKey); } catch { /* No storage permission. */ }
      closeDialog(); toast(t('toast.cleared')); break;
  }
});
document.addEventListener('input', event => {
  if (event.target.closest('#personalize-form') && event.target.id !== 'photo-input') { syncDraftFromFields(); updateDraftPreview(); $('#product-error').textContent = ''; }
});
document.addEventListener('change', event => { if (event.target.id === 'photo-input' && event.target.files?.[0]) choosePhoto(event.target.files[0]); });
document.addEventListener('submit', event => {
  if (event.target.id === 'personalize-form') {
    event.preventDefault();
    try {
      if (state.photoBusy) throw new Error(t('toast.photoWait'));
      syncDraftFromFields();
      if (state.productId !== 'letter' && !state.draft.photo && !state.draft.sample) throw new Error(t('toast.photoNeed'));
      const line = createLine(state.productId, state.variantId, state.quantity, state.draft);
      if (state.editId) state.cart = state.cart.map(item => item.id === state.editId ? { ...line, id: state.editId } : item);
      else state.cart = addLine(state.cart, line);
      persistCart(); state.draft = null; state.uploadToken += 1; renderCart(); toast(t('toast.added'));
    } catch (err) { $('#product-error').textContent = uxError(err.message); }
  }
  if (event.target.id === 'checkout-form') {
    event.preventDefault();
    const form = event.target;
    const delivery = { name: form.elements.recipient.value, phone: form.elements.phone.value, email: form.elements.email.value, postal: form.elements.postal.value, address: form.elements.address.value };
    const error = validateDelivery(delivery);
    if (error) { $('#checkout-error').textContent = uxError(error); return; }
    if (!form.elements.reviewed.checked || !form.elements.demoAcknowledged.checked) { $('#checkout-error').textContent = t('toast.checkoutAck'); return; }
    if (!state.cart.length || state.cart.some(line => !line.personalization)) { $('#checkout-error').textContent = t('toast.checkoutCart'); return; }
    // Deliberately does NOT fetch, post, charge, create an order, or retain delivery fields.
    state.result = { reference: `PREVIEW-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`, subtotal: calculateCart(state.cart).subtotal };
    form.reset(); renderOrderResult();
  }
});
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); });
// Clear ephemeral personalization on back-forward cache entry as well, without altering cart metadata.
window.addEventListener('pagehide', () => { archiveReturn = null; archiveFlow?.cancel(); state.archive = null; state.cart = state.cart.map(({ id, productId, variantId, quantity }) => ({ id, productId, variantId, quantity, personalization: null })); state.draft = null; state.result = null; if (dialog.open) closePlainDialog(); });
window.addEventListener('pageshow', event => { if (event.persisted) { updateHeader(); } });
document.querySelectorAll('[data-asset]').forEach(image => { image.src = asset(image.dataset.asset); });
initLang();
archiveFlow = createArchiveFlow({ api: archiveApi, openDialog, closeDialog: closePlainDialog, dialogHeader,
  onSelected(selection) { state.archive = selection; updateHeader(); restoreProduct(selection); toast(t('toast.selected', { name: selection.name })); },
  onCleared(reason) { clearPrivateContent(reason, reason === 'logout'); },
  onCancelled(manual) { restoreProduct(null, manual); }, notify: toast });
privacyChannel?.addEventListener('message', event => { if (event.data?.type === 'clear-private') { archiveFlow.cancel(); clearPrivateContent('logout'); if (state.modal === 'archive') closePlainDialog(); } });
applyStaticCopy();
renderFaqs();
renderProducts(); updateHeader();
const deepLinkedProduct = catalogProductIdFromQuery(location.search);
if (deepLinkedProduct) openProduct(deepLinkedProduct);
