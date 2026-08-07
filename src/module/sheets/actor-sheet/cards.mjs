import { showChatRequest, suitToName } from '../../helpers/chat.mjs';
import { getRequesterActorIdentity, runOnGM } from '../../helpers/gm-relay.mjs';

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
  // Build suit counts from actor card data for suit-based re-selection on retry
  const suitCounts = {};
  for (const [cardType, cardObj] of Object.entries(data)) {
    const count = Math.max(0, cardObj.value + cardObj.modifier);
    if (count > 0) suitCounts[cardType] = count;
  }

  // Merge checked special cards into the same suitCounts object, so the
  // whole pile-add happens in one addCardsToPile relay call.
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

  // Relayed to the GM as one atomic operation (mutate the pile + record
  // this actor for the draw round), serialized there against every other
  // actor's add/draw - not just other actions on this same client. The
  // actor identity comes from the open sheet (sheet.actor), not from
  // game.user.character - the person clicking may be looking at a
  // different actor's sheet than their own (e.g. helping another player,
  // or the GM acting on someone's behalf).
  const result = await runOnGM('addCardsToPile', {
    ...getRequesterActorIdentity(sheet.actor),
    suitCounts
  });
  if (!result.success) {
    return ui.notifications.error(game.i18n.localize(result.error) || result.error);
  }

  // pile totals come from the GM's snapshot, not a local re-read of `pile`
  // (which may not have synced this mutation yet on this client).
  notifyAddedCardsToChat(
    data,
    addedSpecials,
    result.data.pileSnapshot,
    sheet.actor.name
  );
  await resetActorCards(sheet);
  uncheckSpecialCards(sheet);
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
 * Draw cards for the given actor sheet using the individual draw round
 * system. Relayed to the GM (see gm-relay.mjs) so it's serialized against
 * every other actor's draw/add, not just other actions on this same
 * client. The GM handler itself posts both the individual draw message and
 * (once complete) the round summary, in that order - see draw-round.mjs's
 * executeActorDraw - so two actors' messages can never arrive out of order
 * from a caller-side network round-trip race.
 * @param {Object} sheet - The actor sheet instance the "Draw Cards" button
 *   was clicked from - identifies which actor is drawing (may differ from
 *   game.user.character).
 * @return {Promise<void>}
 */
export async function drawCardsForPlayer(sheet) {
  const identity = getRequesterActorIdentity(sheet.actor);
  const result = await runOnGM('executePlayerDraw', identity);

  if (!result.success) {
    const errorMsg = game.i18n.localize(result.error) || result.error;
    return ui.notifications.error(errorMsg);
  }
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
 * @param {*} data - Actor card data
 * @param {Array} addedSpecials - Array of special cards added
 * @param {{pileSuits: Object<string, number>, pileSpecials: Array<{suit: string, name: string, count: number}>}} pileSnapshot -
 *   pile totals computed by the GM right after the mutation (see
 *   gm-card-actions.mjs#buildPileSnapshot) - not re-derived from a local
 *   `pile` read, which may not have synced yet on this client.
 * @param {string} actorName - The acting actor's name (sheet.actor.name),
 *   displayed as the message's author label.
 */
function notifyAddedCardsToChat(data, addedSpecials = [], pileSnapshot, actorName) {
  const { pileSuits, pileSpecials } = pileSnapshot;

  // HTML-escape the acting actor's name - always the sheet that was
  // actually open, not game.user.character (see addCardsToPile).
  const safeName = $('<div>').text(actorName).html();

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
  for (const { suit, name, count } of pileSpecials) {
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
