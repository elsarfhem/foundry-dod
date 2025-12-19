// Non-invasive binding of card input non-rerender handlers.
import { changeCardValue } from './cards.mjs';

Hooks.on('renderDeckOfDestinyActorSheet', (app, html) => {
  // Avoid duplicate binding
  if (html.data('cards-lite-bound')) return;
  html.data('cards-lite-bound', true);

  // Use capture phase to intercept BEFORE Foundry's form handler
  const cardInputs = html[0].querySelectorAll('.card-input');

  cardInputs.forEach((input) => {
    input.addEventListener(
      'change',
      async (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        await changeCardValue(app, ev);
      },
      true
    ); // Capture phase

    input.addEventListener(
      'blur',
      async (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        await changeCardValue(app, ev);
      },
      true
    ); // Capture phase
  });

  // Prevent keydown/enter from submitting
  html.on('keydown', '.card-input', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.currentTarget.blur();
    }
  });
});
