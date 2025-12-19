// Non-rerender handlers for name and player text inputs in actor header
Hooks.on('renderDeckOfDestinyActorSheet', (app, html) => {
  // Avoid duplicate binding
  if (html.data('name-player-lite-bound')) return;
  html.data('name-player-lite-bound', true);

  // Helper to update name field
  const updateNameField = async (input) => {
    const name = input.name; // "name" or "system.player"
    const newValue = input.value.trim();

    try {
      await app.actor.update({ [name]: newValue }, { render: false });
      input.value = newValue;

      // Update window title if it's the name field
      if (name === 'name') {
        const windowTitle = app.element.closest('.app')?.querySelector('.window-title');
        if (windowTitle) windowTitle.textContent = newValue;
        const profileImg = html[0].querySelector('.profile-img');
        if (profileImg) profileImg.title = newValue;
      }

      // Optional: Visual feedback
      input.classList.add('dod-pulse');
      setTimeout(() => input.classList.remove('dod-pulse'), 400);
    } catch (err) {
      console.warn('Silent name/player update failed; fallback render', err);
      await app.actor.update({ [name]: newValue });
    }
  };

  // Get the inputs
  const nameInput = html[0].querySelector('input[name="name"]');
  const playerInput = html[0].querySelector('input[name="system.player"]');

  // Remove from form to prevent Foundry's automatic handling
  if (nameInput) {
    // Remove from form (this prevents Foundry's _onSubmit from processing it)
    nameInput.removeAttribute('form');

    // Add our handlers
    nameInput.addEventListener(
      'change',
      async (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        await updateNameField(ev.currentTarget);
      },
      true
    );

    nameInput.addEventListener(
      'blur',
      async (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        await updateNameField(ev.currentTarget);
      },
      true
    );
  }

  if (playerInput) {
    // Remove from form to prevent Foundry's automatic handling
    playerInput.removeAttribute('form');

    // Add our handlers
    playerInput.addEventListener(
      'change',
      async (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        await updateNameField(ev.currentTarget);
      },
      true
    );

    playerInput.addEventListener(
      'blur',
      async (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        await updateNameField(ev.currentTarget);
      },
      true
    );
  }

  // Prevent enter key from submitting form
  html.on('keydown', 'input[name="name"], input[name="system.player"]', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.currentTarget.blur();
    }
  });
});
