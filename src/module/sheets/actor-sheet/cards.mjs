import { showChatRequest, suitToName } from '../../helpers/chat.mjs';
import { addCardsReplacingWhite } from '../../helpers/card-utils.mjs';
import { recordPlayerAdded, executePlayerDraw } from '../../helpers/draw-round.mjs';
import { isSpecialSuit } from '../../helpers/special-cards.mjs';
import { withCardLock } from '../../globals.mjs';

// Card management helpers
/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function addSheetCard(sheet, event) {
  event.preventDefault();
  const data = sheet.actor.toObject().system;
  const cardType = event.currentTarget.dataset.cardType;
  const newVal = data.cards[cardType].value + 1;
  await sheet.actor.update(
    { [`system.cards.${cardType}.value`]: newVal },
    { render: false }
  );
  updateCardInput(sheet, cardType, newVal);
}

/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function subtractSheetCard(sheet, event) {
  event.preventDefault();
  const data = sheet.actor.toObject().system;
  const cardType = event.currentTarget.dataset.cardType;
  const newVal = data.cards[cardType].value - 1;
  await sheet.actor.update(
    { [`system.cards.${cardType}.value`]: newVal },
    { render: false }
  );
  updateCardInput(sheet, cardType, newVal);
}

/**
 * Reset all card values to 0 without full sheet rerender.
 * @param {*} sheet
 */
export async function resetActorCards(sheet) {
  await sheet.actor.update(
    {
      'system.cards.success.value': 0,
      'system.cards.failure.value': 0,
      'system.cards.issue.value': 0,
      'system.cards.destiny.value': 0,
      'system.cards.fortune.value': 0
    },
    { render: false }
  );

  // Update only the card inputs in the DOM
  try {
    const root = sheet.element[0];
    const cardTypes = ['success', 'failure', 'issue', 'destiny', 'fortune'];
    cardTypes.forEach((cardType) => {
      const input = root.querySelector(`input[name="system.cards.${cardType}.value"]`);
      if (input) {
        input.value = 0;
        // Optional: Add visual feedback
        input.classList.add('dod-pulse');
        setTimeout(() => input.classList.remove('dod-pulse'), 400);
      }
    });
  } catch (e) {
    console.debug('Card reset DOM update skipped', e);
  }
}

/**
 * Handle adding Success Cards based on the selected characteristic.
 * @param {*} sheet - The actor sheet instance.
 * @param {Event} event - The originating left click event.
 */
export async function addCards(sheet, event) {
  event.preventDefault();
  const actorSystem = sheet.actor.toObject().system;
  const element = event.currentTarget;
  const elementData = element.dataset;
  let value = 0;
  let cardType = '';
  if (elementData.type === 'characteristic') {
    value = actorSystem.characteristics[elementData.label].value;
    cardType = 'success';
  } else if (elementData.type === 'ability') {
    const itemId = element.closest('.item')?.dataset.itemId;
    const item = itemId ? sheet.actor.items.get(itemId) : null;
    value = item?.system.value ?? 0;
    cardType = 'success';
  } else if (elementData.type === 'condition') {
    const itemId = element.closest('.item')?.dataset.itemId;
    const item = itemId ? sheet.actor.items.get(itemId) : null;
    value = item?.system.value ?? 0;
    cardType = 'failure';
  } else {
    return; // Unhandled type
  }
  const newVal = actorSystem.cards[cardType].value + value;
  await sheet.actor.update(
    { [`system.cards.${cardType}.value`]: newVal },
    { render: false }
  );

  // Update only the specific input element, no fragment rerender
  try {
    const root = sheet.element[0];
    const input = root.querySelector(`input[name="system.cards.${cardType}.value"]`);
    if (input) {
      input.value = newVal;
      // Optional visual feedback
      input.classList.add('dod-pulse');
      setTimeout(() => input.classList.remove('dod-pulse'), 500);
    }
  } catch (err) {
    console.debug('Direct card input update failed (non-fatal):', err);
  }
}

/**
 *
 * @param {Object} sheet
 * @param {String} cardType
 * @param {String} value
 */
function updateCardInput(sheet, cardType, value) {
  try {
    const root = sheet.element[0];
    const input = root.querySelector(`input[name="system.cards.${cardType}.value"]`);
    if (input) input.value = value;
  } catch (e) {
    console.debug('Card input update skipped', e);
  }
}

/**
 * Add cards from the actor sheet to the pile.
 * @param {Object} sheet
 * @return {Promise<void>}
 */
export async function addCardsToPile(sheet) {
  const data = sheet.actor.toObject().system.cards;
  const checkedSpecials = Array.from(
    sheet.element[0].querySelectorAll(
      'input[name^="specialCard."]:checked:not(:disabled)'
    )
  );
  if (isEmptyCardData(data) && checkedSpecials.length === 0)
    return ui.notifications.warn('There are no cards to add to pile.');
  const deck = game.cards.getName('DoD - lista carte');
  if (!deck)
    return ui.notifications.error(
      'The deck of cards is not available. Please make sure the deck is loaded.'
    );
  const pile = game.cards.getName('Mazzo');
  if (!pile)
    return ui.notifications.error(
      'The pile of cards is not available. Please make sure the pile is loaded.'
    );
  // Build suit counts from actor card data for suit-based re-selection on retry
  const suitCounts = {};
  for (const [cardType, cardObj] of Object.entries(data)) {
    const count = Math.max(0, cardObj.value + cardObj.modifier);
    if (count > 0) suitCounts[cardType] = count;
  }

  // Merge checked special cards into the same suitCounts object, so the
  // whole pile-add happens in one addCardsReplacingWhite call.
  const addedSpecials = checkedSpecials.map((input) => {
    const suit = input.name.replace('specialCard.', '');
    const name = input
      .closest('.special-card-row')
      .querySelector('.special-card-name').textContent;
    suitCounts[suit] = 1;
    return { suit, name, count: 1 };
  });

  if (!Object.keys(suitCounts).length)
    return ui.notifications.warn('No available cards to add to pile.');

  // Serialize against other card-mutating operations from this client (see
  // withCardLock in globals.mjs). addCardsReplacingWhite reads the pile's
  // current white-card count and then performs two sequential pass() calls,
  // so an overlapping call from the same client could race on that read.
  await withCardLock(async () => {
    await addCardsReplacingWhite(deck, pile, suitCounts, { chatNotification: false });
    notifyAddedCardsToChat(pile, data, addedSpecials);
    await resetActorCards(sheet);
    uncheckSpecialCards(sheet);

    // Record that this player has added cards for the draw round
    await recordPlayerAdded(game.user.id);
  });
}

/**
 * Uncheck every special-card checkbox on the sheet after a successful add.
 * @param {Object} sheet
 */
function uncheckSpecialCards(sheet) {
  try {
    const root = sheet.element[0];
    root.querySelectorAll('input[name^="specialCard."]').forEach((input) => {
      input.checked = false;
    });
  } catch (e) {
    console.debug('Special card checkbox reset skipped', e);
  }
}

/**
 * Draw cards for the current player using the individual draw round system.
 * Wraps executePlayerDraw with card operation lock.
 * @return {Promise<void>}
 */
export async function drawCardsForPlayer() {
  const result = await executePlayerDraw(game.user.id);

  if (!result.success) {
    const errorMsg = game.i18n.localize(result.error) || result.error;
    return ui.notifications.error(errorMsg);
  }

  // Chat message is generated by executePlayerDraw -> generatePlayerDrawMessage
  // No need for additional notification here
}

/**
 * Toggle the collapsed state of a collapsible section, reading which
 * section from the clicked button's data-target attribute.
 * @param {JQuery} html - The jQuery-wrapped HTML of the sheet
 * @param {Event} ev - The click event
 */
export function toggleCollapsible(html, ev) {
  const $btn = $(ev.currentTarget);
  const $section = html.find($btn.data('target'));
  $section.toggleClass('collapsed');
  const expanded = !$section.hasClass('collapsed');
  $btn.attr('aria-expanded', expanded);

  // Update button text based on expanded state
  const hideLabel = $btn.data('label-hide');
  const showLabel = $btn.data('label-show');
  $btn.text(expanded ? hideLabel : showLabel);
}

/**
 *
 * @param {Object} data
 * @return {boolean}
 */
function isEmptyCardData(data) {
  return (
    Object.values(data).reduce(
      (sum, card) => sum + Math.max(0, card.value + card.modifier),
      0
    ) === 0
  );
}

/**
 * Notify added cards to chat using consistent styling and buttons
 * @param {*} pile - The pile document
 * @param {*} data - Actor card data
 * @param {Array} addedSpecials - Array of special cards added
 */
function notifyAddedCardsToChat(pile, data, addedSpecials = []) {
  // Count cards by suit in the pile
  const pileSuits = {
    success: 0,
    failure: 0,
    issue: 0,
    fortune: 0,
    destiny: 0,
    white: 0
  };
  const pileSpecials = new Map();
  for (const card of pile.cards) {
    if (pileSuits[card.suit] !== undefined) {
      pileSuits[card.suit]++;
    } else if (isSpecialSuit(card.suit)) {
      const existing = pileSpecials.get(card.suit);
      if (existing) {
        existing.count++;
      } else {
        pileSpecials.set(card.suit, { count: 1, name: card.name });
      }
    }
  }

  // HTML-escape actor name (character name), fallback to user name
  const actor = game.user.character;
  const displayName = actor ? actor.name : game.user.name;
  const safeName = $('<div>').text(displayName).html();

  // Build cards added with flex layout
  const lines = [];
  lines.push('<div class="add-cards-content">');
  lines.push(
    `<div class="add-cards-header"><strong>${safeName}</strong> ${game.i18n.localize(
      'DECK_OF_DESTINY.messages.addedToDeck'
    )}</div>`
  );

  // Cards added
  const cardsAdded = [
    { suit: 'success', count: Math.max(0, data.success.value + data.success.modifier) },
    { suit: 'failure', count: Math.max(0, data.failure.value + data.failure.modifier) },
    { suit: 'issue', count: Math.max(0, data.issue.value + data.issue.modifier) },
    { suit: 'fortune', count: Math.max(0, data.fortune.value + data.fortune.modifier) },
    { suit: 'destiny', count: Math.max(0, data.destiny.value + data.destiny.modifier) }
  ];

  lines.push('<ul class="suit-list">');
  for (const { suit, count } of cardsAdded) {
    if (count > 0) {
      lines.push(`<li>${suitToName(suit)}: ${count}</li>`);
    }
  }
  for (const { suit, name, count } of addedSpecials) {
    const safeSpecialName = $('<div>').text(name).html();
    lines.push(`<li>${suitToName(suit, safeSpecialName)}: ${count}</li>`);
  }
  lines.push('</ul>');
  lines.push('</div>');

  // Add pile totals
  lines.push(
    `<p><strong>${game.i18n.localize(
      'DECK_OF_DESTINY.messages.DrawRound.Summary.Total'
    )}:</strong></p>`
  );
  lines.push('<ul class="suit-list">');
  for (const suit of ['success', 'failure', 'issue', 'fortune', 'destiny', 'white']) {
    if (pileSuits[suit] > 0) {
      lines.push(`<li>${suitToName(suit)}: ${pileSuits[suit]}</li>`);
    }
  }
  for (const [suit, { count, name }] of pileSpecials) {
    const safePileSpecialName = $('<div>').text(name).html();
    lines.push(`<li>${suitToName(suit, safePileSpecialName)}: ${count}</li>`);
  }
  lines.push('</ul>');

  // Build button data
  const buttons = [
    {
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewDeck'),
      icon: 'fas fa-eye',
      color: '#aaaaff',
      borderColor: '#0000cc',
      actionKey: 'viewDeck'
    },
    {
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.emptyDeck'),
      icon: 'fas fa-trash',
      color: '#ffaaaa',
      borderColor: '#cc0000',
      actionKey: 'emptyDeck'
    }
  ];

  // Use showChatRequest to create message with buttons
  showChatRequest({
    title: game.i18n.localize('DECK_OF_DESTINY.messages.DrawRound.AddedCards'),
    description: lines.join(''),
    buttonData: buttons
  });
}

/**
 * Update a single card value without full sheet rerender.
 * @param {Object} sheet - The actor sheet instance
 * @param {Event} event - The change/blur event
 */
export async function changeCardValue(sheet, event) {
  event.preventDefault();
  const input = event.currentTarget;
  const name = input.name; // system.cards.<type>.value
  const match = /system\.cards\.(\w+)\.value/.exec(name);
  if (!match) return;

  const cardType = match[1];
  let newVal = parseInt(input.value);
  if (isNaN(newVal) || newVal < 0) newVal = 0;

  try {
    await sheet.actor.update({ [name]: newVal }, { render: false });
  } catch (e) {
    console.warn('Silent card value update failed, fallback render', e);
    await sheet.actor.update({ [name]: newVal });
  }

  // Patch just this input
  updateCardInput(sheet, cardType, newVal);

  // Pulse feedback
  input.classList.add('dod-pulse');
  setTimeout(() => input.classList.remove('dod-pulse'), 400);
}
