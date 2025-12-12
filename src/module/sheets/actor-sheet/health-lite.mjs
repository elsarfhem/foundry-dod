// Non-rerender handlers for health inputs in actor header
Hooks.on('renderDeckOfDestinyActorSheet', (app, html) => {
  // Avoid duplicate binding
  if (html.data('health-lite-bound')) return;
  html.data('health-lite-bound', true);

  // Helper to update a single health field
  const updateHealthField = async (input) => {
    const name = input.name; // system.health.value or system.health.max
    let newValue = parseInt(input.value);

    // Validation
    if (isNaN(newValue) || newValue < 0) newValue = 0;

    try {
      await app.actor.update({ [name]: newValue }, { render: false });
      input.value = newValue; // Ensure clamped value shows

      // Optional: Visual feedback
      input.classList.add('dod-pulse');
      setTimeout(() => input.classList.remove('dod-pulse'), 400);
    } catch (err) {
      console.warn('Silent health update failed; fallback render', err);
      await app.actor.update({ [name]: newValue });
    }
  };

  // Use capture phase to intercept BEFORE Foundry's form handler
  const healthValueInput = html[0].querySelector('input[name="system.health.value"]');
  const healthMaxInput = html[0].querySelector('input[name="system.health.max"]');

  if (healthValueInput) {
    healthValueInput.addEventListener('change', async (ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      await updateHealthField(ev.currentTarget);
    }, true); // Capture phase

    healthValueInput.addEventListener('blur', async (ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      await updateHealthField(ev.currentTarget);
    }, true); // Capture phase
  }

  if (healthMaxInput) {
    healthMaxInput.addEventListener('change', async (ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      await updateHealthField(ev.currentTarget);
    }, true); // Capture phase

    healthMaxInput.addEventListener('blur', async (ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      await updateHealthField(ev.currentTarget);
    }, true); // Capture phase
  }

  // Prevent enter key from submitting form
  html.on('keydown', 'input[name^="system.health."]', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.currentTarget.blur();
    }
  });
});

