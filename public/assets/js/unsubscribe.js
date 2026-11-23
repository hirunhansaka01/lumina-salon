/**
 * The unsubscribe page.
 *
 * Arrives from a link in a studio letter: /unsubscribe?token=abc123.
 * Nothing happens until the reader presses a button, so a link-preview scanner
 * fetching the URL can never unsubscribe someone by accident.
 */
(() => {
  'use strict';

  const H = window.Hearth;
  const token = new URLSearchParams(location.search).get('token') || '';

  const els = {};
  let email = '';

  function paint(state, message) {
    els.title.textContent = state.title;
    els.body.textContent = message;
    els.actions.hidden = state.showActions !== true;
    els.done.hidden = state.showDone !== true;
  }

  async function load() {
    if (!token) return paint({ title: 'This link is incomplete' }, 'It is missing its unsubscribe code. Open the link from the bottom of a studio letter, or reply to one and we will sort it out.');
    try {
      const info = await H.api.get(`/api/unsubscribe/${encodeURIComponent(token)}`);
      email = info.email;
      if (info.status === 'unsubscribed') {
        paint({ title: 'You are already unsubscribed', showDone: true }, `${email} is off the studio letters list.`);
        els.doneTitle.textContent = 'Already unsubscribed';
        els.doneBody.textContent = 'You will not receive studio letters from us again. Anything you already had booked is unaffected.';
        els.doneActionsUndo.hidden = false;
      } else {
        paint({ title: 'Stay on the studio letters list?', showActions: true }, `${email} receives the occasional note: seasonal colour ideas, care rituals and first pick of new slots.`);
      }
    } catch (err) {
      paint({ title: 'That link has expired' }, err.message || 'We could not find that address. Reply to any studio letter and we will remove you by hand.');
    }
  }

  async function unsubscribe() {
    els.yes.disabled = true;
    els.yes.textContent = 'Removing…';
    try {
      const r = await H.api.post(`/api/unsubscribe/${encodeURIComponent(token)}`, {});
      paint({ title: 'You are unsubscribed', showDone: true }, r.message || 'You are off the list.');
      els.doneTitle.textContent = 'You are unsubscribed';
      els.doneBody.textContent = 'You will not receive studio letters from us again. Anything you already had booked is unaffected.';
      els.doneActionsUndo.hidden = false;
      H.toast('Unsubscribed — no hard feelings.', { type: 'success' });
    } catch (err) {
      H.toast(err.message, { type: 'error' });
      els.yes.disabled = false;
      els.yes.textContent = 'Unsubscribe me';
    }
  }

  async function resubscribe() {
    try {
      const r = await H.api.post(`/api/resubscribe/${encodeURIComponent(token)}`, {});
      paint({ title: 'You are back on the list', showDone: false }, r.message || 'Welcome back.');
      H.toast('You are back on the studio letters list.', { type: 'success' });
      setTimeout(() => paint({ title: 'Stay on the studio letters list?', showActions: true }, `${email} receives the occasional note: seasonal colour ideas, care rituals and first pick of new slots.`), 1400);
    } catch (err) {
      H.toast(err.message, { type: 'error' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    els.title = H.qs('#unsub-title');
    els.body = H.qs('#unsub-body');
    els.actions = H.qs('#unsub-actions');
    els.done = H.qs('#unsub-done');
    els.doneTitle = H.qs('#unsub-done-title');
    els.doneBody = H.qs('#unsub-done-body');
    els.yes = H.qs('#unsub-yes');
    els.no = H.qs('#unsub-no');
    els.undo = H.qs('#unsub-undo');
    els.doneActionsUndo = els.undo;
    els.doneActionsUndo.hidden = true;

    els.yes.addEventListener('click', unsubscribe);
    els.no.addEventListener('click', () => {
      paint({ title: 'Nothing changed', showDone: false }, `Thanks — ${email} stays on the list.`);
      H.toast('No change made.');
    });
    els.undo.addEventListener('click', resubscribe);
    load();
  });
})();
