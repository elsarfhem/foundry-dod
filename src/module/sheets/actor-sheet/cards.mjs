import { createDrawChat, showChatRequest, suitToName } from '../../helpers/chat.mjs';
import {
  drawCards,
  passCardsAndSync,
  passCardsBySuitAndSync,
  getCardsToDraw
} from '../../helpers/card-utils.mjs';
import { recordPlayerAdded, executePlayerDraw } from '../../helpers/draw-round.mjs';

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
  if (isEmptyCardData(data))
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
  if (!Object.keys(suitCounts).length)
    return ui.notifications.warn('No available cards to add to pile.');
  await passCardsBySuitAndSync(deck, pile, suitCounts, { chatNotification: false });
  notifyAddedCardsToChat(pile, data);
  await resetActorCards(sheet);

  // Record that this player has added cards for the draw round
  await recordPlayerAdded(game.user.id);
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
 *
 * @param {Object} sheet
 * @return {Promise<void>}
 */
export async function drawCardsFromPile() {
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
  if (!pile.cards.size)
    return ui.notifications.warn(
      'The pile of cards is empty. Please add cards to the pile.'
    );
  const hand = game.cards.getName('Mano');
  if (!hand)
    return ui.notifications.error(
      'The hand of cards is not available. Please make sure the hand is loaded.'
    );
  const confirmed = await Dialog.prompt({
    title: 'Draw Cards',
    content: `<form><div class="form-group"><label>Test Players Number:</label><input id="num-players" name="num-players" value="1" autofocus onFocus="select()" tabindex="1" type="number" min="1"></div></form>`,
    label: 'Draw',
    rejectClose: false
  });
  if (confirmed) {
    const players = parseInt(document.querySelector('[name=num-players]').value) || 1;
    await passWhiteCardsToPile(deck, pile);
    const drawnCards = await drawCards(
      hand,
      pile,
      getCardsToDraw(pile.cards.size, players),
      {
        how: CONST.CARD_DRAW_MODES.RANDOM,
        chatNotification: false
      }
    );
    if (drawnCards.length) createDrawChat(drawnCards, players);
  }
}

/**
 * Toggle the collapsed state of the header-cards section.
 * @param {JQuery} html - The jQuery-wrapped HTML of the sheet
 * @param {Event} ev - The click event
 */
export function toggleHeaderCards(html, ev) {
  const $btn = $(ev.currentTarget);
  const $cards = html.find('.header-cards');
  $cards.toggleClass('collapsed');
  const expanded = !$cards.hasClass('collapsed');
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
 *
 * @param {Object} deck
 * @param {Object} pile
 */
async function passWhiteCardsToPile(deck, pile) {
  const whiteCardsNum = Math.max(0, 20 - pile.cards.size);
  const whiteCards = deck.availableCards
    .filter((c) => c.suit === 'white')
    .slice(0, whiteCardsNum);
  if (!whiteCards.length) return;
  await passCardsAndSync(
    deck,
    pile,
    whiteCards.map((c) => c.id),
    { chatNotification: false }
  );
}

/**
 * Notify added cards to chat using consistent styling and buttons
 * @param {*} pile - The pile document
 * @param {*} data - Actor card data
 */
function notifyAddedCardsToChat(pile, data) {
  // Count cards by suit in the pile
  const pileSuits = {
    success: 0,
    failure: 0,
    issue: 0,
    fortune: 0,
    destiny: 0,
    white: 0
  };
  for (const card of pile.cards) {
    if (pileSuits[card.suit] !== undefined) {
      pileSuits[card.suit]++;
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
  lines.push('</ul>');
  lines.push('</div>');

  // Add pile totals
  lines.push(
    `<p><strong>${game.i18n.localize(
      'DECK_OF_DESTINY.messages.DrawRound.Summary.Total'
    )}:</strong></p>`
  );
  lines.push('<ul class="suit-list">');
  lines.push(`<li>${suitToName('success')}: ${pileSuits.success}</li>`);
  lines.push(`<li>${suitToName('failure')}: ${pileSuits.failure}</li>`);
  lines.push(`<li>${suitToName('issue')}: ${pileSuits.issue}</li>`);
  lines.push(`<li>${suitToName('fortune')}: ${pileSuits.fortune}</li>`);
  lines.push(`<li>${suitToName('destiny')}: ${pileSuits.destiny}</li>`);
  lines.push(`<li>${suitToName('white')}: ${pileSuits.white}</li>`);
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
