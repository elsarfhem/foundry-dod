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
 *
 * @param {*} sheet
 */
export async function resetActorCards(sheet) {
  await sheet.actor.update({
    'system.cards': {
      'success.value': 0,
      'failure.value': 0,
      'issue.value': 0,
      'destiny.value': 0,
      'fortune.value': 0
    }
  });
}

/**
 * Handle adding Success Cards based on the selected characteristic.
 * @param {*} sheet - The actor sheet instance.
 * @param {Event} event - The originating left click event.
 */
export async function addCards(sheet, event) {
  event.preventDefault();
  const actor = sheet.actor.toObject().system;
  const element = event.currentTarget;
  const elementData = element.dataset;
  let value = 0;
  let cardType = '';
  if (elementData.type === 'characteristic') {
    value = actor.characteristics[elementData.label].value;
    cardType = 'success';
  } else if (elementData.type === 'ability') {
    const itemId = element.closest('.item').dataset.itemId;
    const item = sheet.actor.items.get(itemId);
    value = item.system.value;
    cardType = 'success';
  } else if (elementData.type === 'condition') {
    const itemId = element.closest('.item').dataset.itemId;
    const item = sheet.actor.items.get(itemId);
    value = item.system.value;
    cardType = 'failure';
  }
  const newVal = actor.cards[cardType].value + value;
  // Update without forcing a full sheet re-render and update header input in-place
  await sheet.actor.update(
    { [`system.cards.${cardType}.value`]: newVal },
    { render: false }
  );
  try {
    const input = sheet.querySelector(`input[name="system.cards.${cardType}.value"]`);
    if (input) input.value = newVal;
  } catch (err) {
    // If the sheet DOM isn't available for some reason, ignore and allow the update to persist
    console.debug('Could not update card input in-place', err);
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
  const cards = getSheetCardsToAdd(deck, data);
  if (!cards.length) return ui.notifications.warn('No available cards to add to pile.');
  await deck.pass(
    pile,
    cards.map((c) => c.id),
    { chatNotification: false }
  );
  notifyAddedCardsToChat(pile, data);
  await resetActorCards(sheet);
}

/**
 *
 * @param {Object} sheet
 * @return {Promise<void>}
 */
export async function drawCardsFromPile(sheet) {
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
    await hand.draw(pile, Math.ceil(pile.cards.size / (3 + players)), {
      how: CONST.CARD_DRAW_MODES.RANDOM,
      chatNotification: false
    });
    notifyDrawnCardsToChat(hand);
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
 * @param {Object} data
 * @return {Array}
 */
function getSheetCardsToAdd(deck, data) {
  const cards = [];
  for (const [cardType, cardObj] of Object.entries(data)) {
    cards.push(
      ...deck.availableCards
        .filter((c) => c.suit === cardType)
        .slice(0, Math.max(0, cardObj.value + cardObj.modifier))
    );
  }
  return cards;
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
  await deck.pass(
    pile,
    whiteCards.map((c) => c.id),
    { chatNotification: false }
  );
}

/**
 *
 * @param {*} pile
 * @param {*} data
 */
function notifyAddedCardsToChat(pile, data) {
  ChatMessage.create({
    user: game.user._id,
    content: `<p>I added to ${pile.link}: </p><ul><li>Success Cards: ${Math.max(
      0,
      data.success.value + data.success.modifier
    )}</li><li>Failure Cards: ${Math.max(
      0,
      data.failure.value + data.failure.modifier
    )}</li><li>Issue Cards: ${Math.max(
      data.issue.value + data.issue.modifier
    )}</li><li>Fortune Cards: ${Math.max(
      data.fortune.value + data.fortune.modifier
    )}</li><li>Destiny Cards: ${Math.max(
      data.destiny.value + data.destiny.modifier
    )}</li></ul>`
  });
}

/**
 *
 * @param {*} hand
 */
function notifyDrawnCardsToChat(hand) {
  const suitToName = (suit) =>
    ({
      white: 'White Cards',
      success: 'Success Cards',
      issue: 'Issue Cards',
      destiny: 'Destiny Cards',
      failure: 'Failure Cards',
      fortune: 'Fortune Cards'
    }[suit]);
  const cardsMap = new Map();
  hand.cards.forEach((card) => {
    cardsMap.set(card.suit, (cardsMap.get(card.suit) || 0) + 1);
  });
  const cardsHtml = hand.cards
    .map(
      (card) =>
        `<img class="card-face" src="${card.img}" alt="${card.name}" title="${card.name}" style="max-width: 90px;margin-right: 5px;margin-bottom: 5px;"/>`
    )
    .join('');
  const summary = Array.from(cardsMap)
    .map(([suit, num]) => `<li>${suitToName(suit)}: ${num}</li>`)
    .join('');
  ChatMessage.create({
    user: game.user._id,
    content: `<p>I drew ${hand.link}: </p><ul>${summary}</ul><div class="card-draw flexrow">${cardsHtml}</div>`
  });
}
