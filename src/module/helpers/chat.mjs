export function suitToName(suit) {
  const key = `DECK_OF_DESTINY.cards.${suit}`;
  return game.i18n.localize(key) || suit;
}

/**
 * Generic chat message with interactive buttons.
 * @param {Object} opts
 * @param {string} opts.description - HTML description body.
 * @param {string} opts.img - Optional icon image.
 * @param {string} opts.title - Title of the message.
 * @param {Array<{label:string,action:function}>} opts.buttonData - Buttons array.
 */
export function showChatRequest({ description, img, title, buttonData }) {
  const htmlContent = `
    <h2>${title ?? ''}</h2>
    ${img ? `<img src="${img}" alt="ico" style="width:2em;height:2em;vertical-align:middle;">` : ''}
    <div>${description ?? ''}</div>
    <div class="dod-macro-buttons">
      ${(buttonData || [])
        .map((b, i) => `<button data-dod-macro-btn="${i}">${b.label}</button>`)
        .join('')}
    </div>
  `;
  ChatMessage.create({ user: game.user.id, content: htmlContent }).then((msg) => {
    Hooks.once('renderChatMessage', (message, html) => {
      if (message.id !== msg.id) return;
      html.find('button[data-dod-macro-btn]').each((i, btn) => {
        btn.addEventListener('click', () => {
          buttonData[i]?.action?.();
        });
      });
    });
  });
}

/**
 * Build and send the unified draw result chat message (used by sheet draw button and macro).
 * @param {Array} drawCards - Array of drawn Card documents.
 * @param {number} playersNum - Number of players involved.
 */
export function createDrawChat(drawCards, playersNum) {
  if (!Array.isArray(drawCards) || drawCards.length === 0) return;
  // Sort cards for predictable suit ordering
  drawCards.sort((a, b) => a.suit.localeCompare(b.suit));
  const suitCounts = new Map();
  let cardsHtml = '';
  for (const card of drawCards) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
    cardsHtml += `<img class="card-face" src="${card.img}" alt="${card.name}" title="${card.name}" style="max-width: 90px; margin-right: 5px; margin-bottom: 5px;"/>`;
  }
  const summary = Array.from(suitCounts)
    .map(([suit, num]) => `<li>${suitToName(suit)}: ${num}</li>`)
    .join('');

  const hand = game.cards.getName('Mano');
  const pile = game.cards.getName('Mazzo');

  const successCount = suitCounts.get('success') || 0;
  const failureCount = suitCounts.get('failure') || 0;
  const fortuneCount = suitCounts.get('fortune') || 0;

  const buttons = [
    {
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewHand'),
      action: () => hand?.sheet.render(true)
    },
    {
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewDeck'),
      action: () => pile?.sheet.render(true)
    },
    {
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.emptyDeck'),
      action: () => game.macros.find((m) => m.name === 'Svuota il mazzo')?.execute()
    }
  ];
  if (playersNum > 1 && fortuneCount > 0) {
    buttons.push({
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.divideFortune'),
      action: () => game.macros.find((m) => m.name === 'Divisione Carte Fortuna')?.execute()
    });
  }
  if (successCount <= failureCount && failureCount <= successCount + fortuneCount) {
    buttons.push({
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.risk'),
      action: () => game.macros.find((m) => m.name === 'Rischia')?.execute()
    });
  }
  showChatRequest({
    description: `<ul>${summary}</ul><div class="card-draw flexrow">${cardsHtml}</div>`,
    title: game.i18n.localize('DECK_OF_DESTINY.chat.titles.drawResult'),
    buttonData: buttons
  });
}
