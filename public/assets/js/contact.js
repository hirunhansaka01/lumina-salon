/* =====================================================================
   Contact page — validated message form
   ===================================================================== */
(function () {
  'use strict';
  const H = window.Hearth;

  function setError(name, message) {
    const node = H.qs(`[data-error-for="${name}"]`);
    if (node) node.textContent = message || '';
    const input = H.qs(`[name="${name}"]`);
    input?.closest('.field')?.classList.toggle('is-invalid', !!message);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = H.qs('#contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      let valid = true;

      setError('name', ''); setError('email', ''); setError('message', '');
      if (!data.name || data.name.trim().length < 2) { setError('name', 'Please tell us your name.'); valid = false; }
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(data.email || '')) { setError('email', 'Please enter a valid email address.'); valid = false; }
      if (!data.message || data.message.trim().length < 10) { setError('message', 'A little more detail helps us help you.'); valid = false; }
      if (!valid) return;

      const btn = H.qs('#send-btn');
      btn.disabled = true;
      btn.innerHTML = 'Sending…';
      try {
        const res = await H.api.post('/api/contact', data);
        form.hidden = true;
        const ok = H.qs('#contact-success');
        ok.hidden = false;
        H.hydrate(ok);
        H.toast(res.message || 'Message sent — we will reply within 24 hours.');
      } catch (err) {
        H.toast(err.message, { type: 'error' });
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send message';
      }
    });
  });
})();
