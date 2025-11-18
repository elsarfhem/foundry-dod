// Runtime XP non-rerender enhancement.
// Attaches handlers after sheet render without needing to modify core actor-sheet.mjs when mapping fails.

Hooks.on('renderDeckOfDestinyActorSheet', (app, html) => {
  // Avoid duplicate binding
  if (html.data('xp-lite-bound')) return;
  html.data('xp-lite-bound', true);

  // Only bind if sheet is editable (spent always editable, total only GM)
  if (!app.isEditable) return;

  const totalSel = 'input[name="system.xp.total"]';
  const spentSel = 'input[name="system.xp.spent"]';
  const remainingSel = 'input[name="system.xp.remaining"]';

  const $total = html.find(totalSel);
  const $spent = html.find(spentSel);
  const $remaining = html.find(remainingSel);

  function patch(total, spent, remaining) {
    if ($total.length) $total.val(total);
    if ($spent.length) $spent.val(spent);
    if ($remaining.length) $remaining.val(remaining);
  }

  async function silentUpdate(field, value) {
    const xp = app.actor.system.xp || { total: 0, spent: 0, remaining: 0 };
    let total = xp.total;
    let spent = xp.spent;
    if (field === 'total') total = Math.max(0, parseInt(value) || 0);
    if (field === 'spent') spent = Math.max(0, parseInt(value) || 0);
    if (spent > total) spent = total; // clamp
    const remaining = Math.max(0, total - spent);
    try {
      await app.actor.update({
        'system.xp.total': total,
        'system.xp.spent': spent,
        'system.xp.remaining': remaining
      }, { render: false });
    } catch (e) {
      console.warn('XP silent update failed; fallback render', e);
      await app.actor.update({
        'system.xp.total': total,
        'system.xp.spent': spent,
        'system.xp.remaining': remaining
      });
    }
    patch(total, spent, remaining);
  }

  // Bind events with stopPropagation to prevent Foundry's default form handler
  if ($total.length && game.user.isGM) {
    $total.on('change.xpLite blur.xpLite', async (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      await silentUpdate('total', ev.currentTarget.value);
    });
  }
  if ($spent.length) {
    $spent.on('change.xpLite blur.xpLite', async (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      await silentUpdate('spent', ev.currentTarget.value);
    });
  }

  // Prevent enter key from submitting form
  html.on('keydown', 'input[name^="system.xp."]', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.currentTarget.blur();
    }
  });
});

