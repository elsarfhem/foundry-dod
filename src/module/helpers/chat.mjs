export function suitToName(suit) {
  const key = `DECK_OF_DESTINY.cards.${suit}`;
  return game.i18n.localize(key) || suit;
}

// Registry of available chat button actions
const actionRegistry = {
  viewHand: () => game.cards.getName('Mano')?.sheet.render(true),
  viewDeck: () => game.cards.getName('Mazzo')?.sheet.render(true),
  emptyDeck: () => game.dod?.macros?.svuotaMazzo?.(),
  divideFortune: () => game.dod?.macros?.divisioneCarteFortuna?.(),
  risk: () => game.dod?.macros?.rischia?.()
};

/**
 * Initialize chat button click handler via event delegation.
 * Call this once during system init.
 */
export function initChatListeners() {
  Hooks.on('renderChatMessage', (message, html) => {
    const buttons = html.find('button[data-dod-action]');
    if (!buttons.length) return;

    buttons.each((i, btn) => {
      btn.addEventListener('click', () => {
        const actionKey = btn.dataset.dodAction;
        const action = actionRegistry[actionKey];
        if (action) action();
      });
    });
  });
}

/**
 * Generic chat message with interactive buttons.
 * @param {Object} opts
 * @param {string} opts.description - HTML description body.
 * @param {string} opts.img - Optional icon image.
 * @param {string} opts.title - Title of the message.
 * @param {Array<{label:string,actionKey:string,icon?:string,color?:string}>} opts.buttonData - Buttons array.
 */
export function showChatRequest({ description, img, title, buttonData }) {
  const htmlContent = `
    <h2>${title ?? ''}</h2>
    ${
      img
        ? `<img src="${img}" alt="ico" style="width:2em;height:2em;vertical-align:middle;">`
        : ''
    }
    <div>${description ?? ''}</div>
    <div class="dod-macro-buttons">
      ${(buttonData || [])
        .map((b) => {
          const icon = b.icon ? `<i class="${b.icon}"></i> ` : '';
          const bgColor = b.color || '#f0f0e0';
          const borderColor = b.borderColor || '#7a7971';
          return `
            <button 
              data-dod-action="${b.actionKey}" 
              style="background: linear-gradient(180deg, ${bgColor} 50%, ${borderColor} 100%); border: 1px solid ${borderColor};"
            >
              ${icon}${b.label}
            </button>
          `;
        })
        .join('')}
    </div>
  `;
  ChatMessage.create({ user: game.user.id, content: htmlContent });
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

  const successCount = suitCounts.get('success') || 0;
  const failureCount = suitCounts.get('failure') || 0;
  const fortuneCount = suitCounts.get('fortune') || 0;

  const buttons = [
    {
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewHand'),
      icon: 'fas fa-hand-paper',
      color: '#d9d7c8',
      borderColor: '#b5b3a4',
      actionKey: 'viewHand'
    },
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
  if (playersNum > 1 && fortuneCount > 0) {
    buttons.push({
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.divideFortune'),
      icon: 'fas fa-share-alt',
      color: '#b7ffaa',
      borderColor: '#00ff3c',
      actionKey: 'divideFortune'
    });
  }
  if (successCount <= failureCount && failureCount <= successCount + fortuneCount) {
    buttons.push({
      label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.risk'),
      icon: 'fas fa-dice',
      color: '#ffccaa',
      borderColor: '#ff9900',
      actionKey: 'risk'
    });
  }
  showChatRequest({
    description: `<ul>${summary}</ul><div class="card-draw flexrow">${cardsHtml}</div>`,
    title: game.i18n.localize('DECK_OF_DESTINY.chat.titles.drawResult'),
    buttonData: buttons
  });
}
