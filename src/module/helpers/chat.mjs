import { isSpecialSuit } from './special-cards.mjs';

/**
 * Resolve the display label for a suit. Special cards (suit starting with
 * "special:") have no localization key, so they fall back to the card's
 * own name.
 * @param {string} suit
 * @param {string} [cardName] - Required to resolve a special card's label.
 * @returns {string}
 */
export function suitToName(suit, cardName) {
  if (isSpecialSuit(suit)) return cardName ?? suit;
  const key = `DECK_OF_DESTINY.cards.${suit}`;
  const localized = game.i18n.localize(key);
  return localized === key ? suit : localized;
}

/**
 * Render a single drawn card as a thumbnail with a visible name caption
 * (not just an alt/title tooltip).
 * @param {{name: string, img: string}} card
 * @returns {string}
 */
export function renderCardThumbnail(card) {
  // safeName also escapes `"` because it's interpolated into `alt="..."`/
  // `title="..."` attributes (not just element content), where an
  // unescaped quote would break out of the attribute.
  const safeName = $('<div>').text(card.name).html().replace(/"/g, '&quot;');
  return `
    <div class="card-thumb">
      <img class="card-face" src="${card.img}" alt="${safeName}" title="${safeName}" style="max-width: 90px;"/>
      <span class="card-thumb-name">${safeName}</span>
    </div>
  `;
}

// Registry of available chat button actions
const actionRegistry = {
  viewHand: () => game.cards.getName('Mano')?.sheet.render(true),
  viewDeck: () => game.cards.getName('Mazzo')?.sheet.render(true),
  emptyDeck: () => game.dod?.macros?.svuotaMazzo?.(),
  divideFortune: () => game.dod?.macros?.divisioneCarteFortuna?.(),
  risk: () => game.dod?.macros?.rischia?.(),
  addCards: () => game.dod?.macros?.aggiungiAlMazzo?.(),
  draw: () => game.dod?.macros?.pesca?.()
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
      btn.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        button.classList.add('dod-busy');
        try {
          const actionKey = button.dataset.dodAction;
          const action = actionRegistry[actionKey];
          if (action) await action();
        } finally {
          button.disabled = false;
          button.classList.remove('dod-busy');
        }
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
  const suitInfo = new Map();
  let cardsHtml = '';
  for (const card of drawCards) {
    const existing = suitInfo.get(card.suit);
    if (existing) {
      existing.count++;
    } else {
      suitInfo.set(card.suit, { count: 1, name: card.name });
    }
    cardsHtml += renderCardThumbnail(card);
  }
  const summary = Array.from(suitInfo)
    .map(([suit, { count, name }]) => `<li>${suitToName(suit, name)}: ${count}</li>`)
    .join('');

  const successCount = suitInfo.get('success')?.count || 0;
  const failureCount = suitInfo.get('failure')?.count || 0;
  const fortuneCount = suitInfo.get('fortune')?.count || 0;

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
