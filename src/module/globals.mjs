import {
  getCardsToDraw,
  passCardsBySuitAndSync,
  drawCards
} from './helpers/card-utils.mjs';
import { createDrawChat, suitToName } from './helpers/chat.mjs';
import { clearRoundState } from './helpers/draw-round.mjs';
import {
  getSpecialCardDefinitions,
  createSpecialCardDefinition,
  updateSpecialCardDefinition,
  adjustSpecialCardCopies,
  deleteSpecialCardDefinition
} from './helpers/special-cards.mjs';

/**
 * Global lock to prevent concurrent card macro execution.
 * Card operations modify shared deck/pile/hand state; running two macros
 * simultaneously (e.g. double-click or rapid button presses) can cause
 * stale-state errors even for a single player.
 * @type {boolean}
 */
let _cardOperationInProgress = false;

/**
 * Check whether a card operation is currently in progress.
 * @returns {boolean}
 */
export function isCardOperationLocked() {
  return _cardOperationInProgress;
}

/**
 * Execute a card operation with a global lock.
 * If another card operation is already running, shows a notification and returns.
 * @param {Function} fn - Async function to execute
 * @returns {Promise<*>} Result of fn, or undefined if locked
 */
export async function withCardLock(fn) {
  if (_cardOperationInProgress) {
    ui.notifications.warn(
      game.i18n.localize('DECK_OF_DESTINY.messages.warnings.operationInProgress')
    );
    return;
  }
  _cardOperationInProgress = true;
  try {
    return await fn();
  } finally {
    _cardOperationInProgress = false;
  }
}

/**
 * Adds cards to the deck based on user input.
 * Opens a dialog to select the number of each card type to add.
 */
export async function aggiungiAlMazzo() {
  const deck = game.cards.getName('DoD - lista carte');
  const pile = game.cards.getName('Mazzo');

  const specialDefinitions = getSpecialCardDefinitions(deck);
  const specialRows = specialDefinitions.length
    ? `<div class="form-group"><label><strong>${game.i18n.localize(
        'DECK_OF_DESTINY.dialogs.createDeck.specialCardsSection'
      )}</strong></label></div>` +
      specialDefinitions
        .map(
          (d, i) => `
          <div class="form-group">
           <label>${d.name} (${d.available})</label>
           <input id="special-${i}" name="special-${i}" value="0" tabindex="${
            6 + i
          }" type="number" min="0" max="${d.available}"></input>
          </div>`
        )
        .join('')
    : '';

  let confirmed = false;

  new Dialog({
    title: game.i18n.localize('DECK_OF_DESTINY.dialogs.createDeck.title'),
    content: `
       <form>
          <div class="form-group">
           <label>${game.i18n.localize(
             'DECK_OF_DESTINY.dialogs.createDeck.numSuccess'
           )}</label>
           <input id="success-cards" name="success-cards" value="0" autofocus onFocus="select()" tabindex="1" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>${game.i18n.localize(
             'DECK_OF_DESTINY.dialogs.createDeck.numFailure'
           )}</label>
           <input id="failure-cards" name="failure-cards" value="0" tabindex="2" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>${game.i18n.localize(
             'DECK_OF_DESTINY.dialogs.createDeck.numIssue'
           )}</label>
           <input id="issue-cards" name="issue-cards" value="0" tabindex="3" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>${game.i18n.localize(
             'DECK_OF_DESTINY.dialogs.createDeck.numDestiny'
           )}</label>
           <input id="destiny-cards" name="destiny-cards" value="0" tabindex="4" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>${game.i18n.localize(
             'DECK_OF_DESTINY.dialogs.createDeck.numFortune'
           )}</label>
           <input id="fortune-cards" name="fortune-cards" value="0" tabindex="5" type="number" min="0"></input>
          </div>
          ${specialRows}
         </form>
         `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.addToDeck'),
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel'),
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        await withCardLock(async () => {
          const {
            issueCardsNum,
            successCardsNum,
            destinyCardsNum,
            failureCardsNum,
            fortuneCardsNum
          } = getCardCountsFromDialog(html);

          const specialCounts = {};
          specialDefinitions.forEach((d, i) => {
            const qty = parseInt(html.find(`[name=special-${i}]`)[0]?.value) || 0;
            if (qty > 0) specialCounts[d.suit] = qty;
          });
          const totalSpecialQty = Object.values(specialCounts).reduce(
            (a, b) => a + b,
            0
          );
          const specialSummary = Object.entries(specialCounts)
            .map(([suit, qty]) => {
              const def = specialDefinitions.find((d) => d.suit === suit);
              return `<li>${def.name}: ${qty}</li>`;
            })
            .join('');

          const totalCards =
            issueCardsNum +
            successCardsNum +
            destinyCardsNum +
            failureCardsNum +
            fortuneCardsNum +
            totalSpecialQty;

          if (totalCards > 0) {
            await passCardsBySuitAndSync(
              deck,
              pile,
              {
                success: successCardsNum,
                failure: failureCardsNum,
                issue: issueCardsNum,
                destiny: destinyCardsNum,
                fortune: fortuneCardsNum,
                ...specialCounts
              },
              { chatNotification: false }
            );

            ChatMessage.create({
              user: game.user._id,
              content: `<p>${game.user.name} ${game.i18n.localize(
                'DECK_OF_DESTINY.messages.addedToDeck'
              )}</p>
          <ul>
            <li>${game.i18n.localize(
              'DECK_OF_DESTINY.cards.success'
            )}: ${successCardsNum}</li>
            <li>${game.i18n.localize(
              'DECK_OF_DESTINY.cards.failure'
            )}: ${failureCardsNum}</li>
            <li>${game.i18n.localize(
              'DECK_OF_DESTINY.cards.issue'
            )}: ${issueCardsNum}</li>
            <li>${game.i18n.localize(
              'DECK_OF_DESTINY.cards.fortune'
            )}: ${fortuneCardsNum}</li>
            <li>${game.i18n.localize(
              'DECK_OF_DESTINY.cards.destiny'
            )}: ${destinyCardsNum}</li>
            ${specialSummary}
          </ul>`
            });
          }
        });
      }
    }
  }).render(true);
}

function getCardCountsFromDialog(html) {
  return {
    issueCardsNum: parseInt(html.find('[name=issue-cards]')[0].value) || 0,
    successCardsNum: parseInt(html.find('[name=success-cards]')[0].value) || 0,
    destinyCardsNum: parseInt(html.find('[name=destiny-cards]')[0].value) || 0,
    failureCardsNum: parseInt(html.find('[name=failure-cards]')[0].value) || 0,
    fortuneCardsNum: parseInt(html.find('[name=fortune-cards]')[0].value) || 0
  };
}

/**
 * Composes the deck and draws cards based on user configuration.
 * Opens a dialog to configure deck composition and number of players, then draws cards.
 */
export async function componiIlMazzoEPesca() {
  const deck = game.cards.getName('DoD - lista carte');
  await deck.recall({
    chatNotification: false
  });
  const pile = game.cards.getName('Mazzo');
  const hand = game.cards.getName('Mano');

  const specialDefinitions = getSpecialCardDefinitions(deck);
  const specialRows = specialDefinitions.length
    ? `<div class="form-group"><label><strong>${game.i18n.localize(
        'DECK_OF_DESTINY.dialogs.createDeck.specialCardsSection'
      )}</strong></label></div>` +
      specialDefinitions
        .map(
          (d, i) => `
          <div class="form-group">
           <label>${d.name} (${d.available})</label>
           <input id="special-${i}" name="special-${i}" value="0" tabindex="${
            7 + i
          }" type="number" min="0" max="${d.available}"></input>
          </div>`
        )
        .join('')
    : '';

  let confirmed = false;

  new Dialog({
    title: game.i18n.localize('DECK_OF_DESTINY.dialogs.composeDeck.title'),
    content: `
       <form>
       <div class="form-group">
         <label>${game.i18n.localize(
           'DECK_OF_DESTINY.dialogs.composeDeck.numPlayers'
         )}</label>
         <input id="num-players" name="num-players" value="1" autofocus onFocus="select()" tabindex="1" type="number" min="1"></input>
        </div>
        <div class="form-group">
         <label>${game.i18n.localize(
           'DECK_OF_DESTINY.dialogs.createDeck.numSuccess'
         )}</label>
         <input id="success-cards" name="success-cards" value="0" tabindex="2" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>${game.i18n.localize(
           'DECK_OF_DESTINY.dialogs.createDeck.numFailure'
         )}</label>
         <input id="failure-cards" name="failure-cards" value="0" tabindex="3" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>${game.i18n.localize(
           'DECK_OF_DESTINY.dialogs.createDeck.numIssue'
         )}</label>
         <input id="issue-cards" name="issue-cards" value="0" tabindex="4" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>${game.i18n.localize(
           'DECK_OF_DESTINY.dialogs.createDeck.numDestiny'
         )}</label>
         <input id="destiny-cards" name="destiny-cards" value="0" tabindex="5" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>${game.i18n.localize(
           'DECK_OF_DESTINY.dialogs.createDeck.numFortune'
         )}</label>
         <input id="fortune-cards" name="fortune-cards" value="0" tabindex="6" type="number" min="0"></input>
        </div>
        ${specialRows}
       </form>
       `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.composeAndDraw'),
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel'),
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        await withCardLock(async () => {
          const playersNum = parseInt(html.find('[name=num-players]')[0].value) || 1;
          const {
            issueCardsNum,
            successCardsNum,
            destinyCardsNum,
            failureCardsNum,
            fortuneCardsNum
          } = getCardCountsFromDialog(html);

          const specialCounts = {};
          specialDefinitions.forEach((d, i) => {
            const qty = parseInt(html.find(`[name=special-${i}]`)[0]?.value) || 0;
            if (qty > 0) specialCounts[d.suit] = qty;
          });
          const totalSpecialQty = Object.values(specialCounts).reduce(
            (a, b) => a + b,
            0
          );
          const specialSummary = Object.entries(specialCounts)
            .map(([suit, qty]) => {
              const def = specialDefinitions.find((d) => d.suit === suit);
              return `<li>${def.name}: ${qty}</li>`;
            })
            .join('');

          ChatMessage.create({
            user: game.user._id,
            content: `<p>Il mazzo é composto da: </p>
          <ul>
          <li>Carta Successo: ${successCardsNum}</li>
          <li>Carta Fallimento: ${failureCardsNum}</li>
              <li>Carta Imprevisto: ${issueCardsNum}</li>
              <li>Carta Fortuna: ${fortuneCardsNum}</li>
              <li>Carta del Destino: ${destinyCardsNum}</li>
              ${specialSummary}
          </ul>`
          });

          const whiteCardsNum = Math.max(
            0,
            20 -
              successCardsNum -
              issueCardsNum -
              destinyCardsNum -
              failureCardsNum -
              fortuneCardsNum -
              totalSpecialQty
          );

          const totalCards =
            issueCardsNum +
            successCardsNum +
            destinyCardsNum +
            failureCardsNum +
            fortuneCardsNum +
            totalSpecialQty;

          if (totalCards > 0) {
            await passCardsBySuitAndSync(
              deck,
              pile,
              {
                white: whiteCardsNum,
                success: successCardsNum,
                failure: failureCardsNum,
                issue: issueCardsNum,
                destiny: destinyCardsNum,
                fortune: fortuneCardsNum,
                ...specialCounts
              },
              { chatNotification: false }
            );
          }

          if (pile.cards.size > 0) {
            const drawnCards = await drawCards(
              hand,
              pile,
              getCardsToDraw(pile.cards.size, playersNum),
              {
                how: CONST.CARD_DRAW_MODES.RANDOM,
                chatNotification: false
              }
            );
            createDrawChat(drawnCards, playersNum);
          }
        });
      }
    }
  }).render(true);
}

/**
 * Draws cards from the current deck based on number of players.
 * Opens a dialog to specify number of players and draws appropriate cards.
 */
export async function pesca() {
  let confirmed = false;

  new Dialog({
    title: game.i18n.localize('DECK_OF_DESTINY.dialogs.draw.title'),
    content: `
       <form>
         <div class="form-group">
           <label>${game.i18n.localize(
             'DECK_OF_DESTINY.dialogs.draw.numPlayers'
           )}</label>
           <input id="num-players" name="num-players" value="1" autofocus onFocus="select()" tabindex="1" type="number" min="1"></input>
         </div>
       </form>
     `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.draw'),
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel'),
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        await withCardLock(async () => {
          const deck = game.cards.getName('DoD - lista carte');
          const pile = game.cards.getName('Mazzo');
          const hand = game.cards.getName('Mano');

          const successCardsNum = pile.cards.filter(
            (card) => card.suit === 'success'
          ).length;
          const issueCardsNum = pile.cards.filter(
            (card) => card.suit === 'issue'
          ).length;
          const destinyCardsNum = pile.cards.filter(
            (card) => card.suit === 'destiny'
          ).length;
          const failureCardsNum = pile.cards.filter(
            (card) => card.suit === 'failure'
          ).length;
          const fortuneCardsNum = pile.cards.filter(
            (card) => card.suit === 'fortune'
          ).length;

          const playersNum = parseInt(html.find('[name=num-players]')[0].value) || 1;
          const whiteCardsNum = Math.max(
            0,
            20 -
              successCardsNum -
              issueCardsNum -
              destinyCardsNum -
              failureCardsNum -
              fortuneCardsNum
          );

          ChatMessage.create({
            user: game.user._id,
            content: `<p>Il mazzo é composto da: </p>
          <ul>
          <li>Carta Successo: ${successCardsNum}</li>
          <li>Carta Fallimento: ${failureCardsNum}</li>
              <li>Carta Imprevisto: ${issueCardsNum}</li>
              <li>Carta Fortuna: ${fortuneCardsNum}</li>
              <li>Carta del Destino: ${destinyCardsNum}</li>
          </ul>`
          });

          const totalCards =
            issueCardsNum +
            successCardsNum +
            destinyCardsNum +
            failureCardsNum +
            fortuneCardsNum;

          if (totalCards === 0) return;

          await passCardsBySuitAndSync(
            deck,
            pile,
            { white: whiteCardsNum },
            { chatNotification: false }
          );

          if (pile.cards.size > 0) {
            const drawnCards = await drawCards(
              hand,
              pile,
              getCardsToDraw(pile.cards.size, playersNum),
              {
                how: CONST.CARD_DRAW_MODES.RANDOM,
                chatNotification: false
              }
            );
            createDrawChat(drawnCards, playersNum);
          }
        });
      }
    }
  }).render(true);
}

/**
 * Performs a risk action by drawing cards until success or failure.
 * Validates equal success and failure cards in hand before proceeding.
 */
export async function rischia() {
  return withCardLock(async () => {
    const pile = game.cards.getName('Mazzo');
    const hand = game.cards.getName('Mano');

    const numFailure = hand.cards.filter((card) => card.suit === 'failure').length;
    const numSuccess = hand.cards.filter((card) => card.suit === 'success').length;

    let msg = '';

    if (pile.cards.size === 0) {
      msg = game.i18n.localize('DECK_OF_DESTINY.messages.errors.noDeckCards');
      ui.notifications.error(msg);
      await ChatMessage.create({
        user: game.user._id,
        content: msg
      });
      return;
    }

    if (numSuccess !== numFailure) {
      msg =
        game.i18n.localize('DECK_OF_DESTINY.messages.warnings.unequalCards') +
        ` ${game.i18n.localize('DECK_OF_DESTINY.cards.success')}: ` +
        numSuccess +
        ` - ${game.i18n.localize('DECK_OF_DESTINY.cards.failure')}: ` +
        numFailure;
      ui.notifications.warn(msg);
      ChatMessage.create({
        user: game.user._id,
        content: msg
      });
      return;
    }

    let drawCard;
    const drawnCards = [];
    let cardsHtml = '';
    do {
      if (pile.cards.size === 0) {
        ui.notifications.error(
          game.i18n.localize('DECK_OF_DESTINY.messages.errors.noCardsForRisk')
        );
        return;
      }
      const drawn = await drawCards(hand, pile, 1, {
        how: CONST.CARD_DRAW_MODES.RANDOM,
        chatNotification: false
      });
      [drawCard] = drawn || [];
      if (!drawCard) break;
      drawnCards.push(drawCard);
      console.log('you draw ' + drawCard);
    } while (drawCard.suit !== 'success' && drawCard.suit !== 'failure');
    if (drawCard) {
      drawnCards.sort((a, b) => a.suit.localeCompare(b.suit));
      const map = new Map();
      drawnCards.forEach((card) => {
        const existing = map.get(card.suit);
        if (existing) {
          existing.count++;
        } else {
          map.set(card.suit, { count: 1, name: card.name });
        }
        cardsHtml += `<img class="card-face" src="${card.img}" alt="${card.name}" title="${card.name}" style="max-width: 90px;margin-right: 5px;margin-bottom: 5px;"/>`;
      });
      const summary = Array.from(map)
        .map(
          ([suit, { count, name }]) => `<li>${suitToName(suit, name)}: ${count}</li>`
        )
        .join('');

      const outcomeText =
        drawCard.suit === 'success'
          ? game.i18n.localize('DECK_OF_DESTINY.messages.success.riskSuccess')
          : game.i18n.localize('DECK_OF_DESTINY.messages.failure.riskFailure');

      msg = `<h1>${game.i18n.localize('DECK_OF_DESTINY.messages.info.drewCard')} ${
        drawCard.name
      } ${outcomeText}</h1>
            <ul>${summary}</ul>
           <div class="card-draw flexrow">${cardsHtml}</div>`;
    } else {
      msg = game.i18n.localize('DECK_OF_DESTINY.messages.errors.noSuccessOrFailure');
    }
    await ChatMessage.create({
      user: game.user._id,
      content: msg
    });
  });
}

/**
 * Divides fortune cards among selected players.
 * Opens a dialog to select players and distribute fortune cards from hand.
 */
export async function divisioneCarteFortuna() {
  /**
   * Attempts to assign a fortune card to a player based on their configuration.
   * @param {Map} resultMap - Map of player names to their assigned cards
   * @param {string[]} players - Array of player names
   * @param {number} index - Current player index
   * @param {Object[]} data - Player configuration data
   * @param {Object} card - Card to assign
   * @return {number} Updated player index
   */
  function tryAssignFortuneCard(resultMap, players, index, data, card) {
    for (let i = 0; i < players.length; i++) {
      const currentPlayer = players[index];
      const currentFortuneCards = resultMap.get(currentPlayer);
      const configDataPlayer = data.filter((obj) => obj.player === currentPlayer)[0];
      console.log(
        `${currentPlayer} has ${currentFortuneCards.length} of ${configDataPlayer.fortuneCards}`
      );
      if (currentFortuneCards.length < configDataPlayer.fortuneCards) {
        console.log(`card assigned to ${currentPlayer}`);
        currentFortuneCards.push(card);
        break;
      } else {
        console.log(`${currentPlayer} has reached max`);
      }
      index = ++index % players.length;
    }
    return index;
  }

  const hand = game.cards.getName('Mano');

  const fortuneCards = hand.cards.filter((card) => card.suit == 'fortune');
  if (fortuneCards.length === 0) {
    ChatMessage.create({
      user: game.user._id,
      content: game.i18n.localize(
        'DECK_OF_DESTINY.messages.errors.noFortuneCardsInHand'
      )
    });
    return;
  }

  let confirmed = false;

  const select = game.users
    .map((u) => {
      return `
      <div>
        <input type="checkbox" id="${u.id}" value="${u.id}"/>
        <label for="${u.id}">${u.name}</label>
        <input style="width: 24px" type="number" min="0" id="value-${u.id}" value="1"/>
      </div>
    `;
    })
    .join('');

  new Dialog({
    title: `${game.i18n.localize('DECK_OF_DESTINY.dialogs.divideFortune.title')} (${
      fortuneCards.length
    } ${game.i18n.localize('DECK_OF_DESTINY.dialogs.divideFortune.card')})`,
    content: `
      <form>
        <div class="form-group">
          <div>
            ${select}
          </div>
        </div>
      </form>
    `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.divide'),
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel'),
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async () => {
      if (confirmed) {
        const selectedUserIds = Array.from(
          document.querySelectorAll('input[type=checkbox]:checked')
        );
        console.log(selectedUserIds);
        if (selectedUserIds.length === 0) {
          ChatMessage.create({
            user: game.user._id,
            content: 'Non hai selezionato nessun giocatore'
          });
          return;
        }
        const data = selectedUserIds.map((e) => {
          return {
            player: game.users.get(e.id).name,
            fortuneCards: parseInt(document.getElementById(`value-${e.id}`).value)
          };
        });
        const totalCardsNumber = data
          .map((p) => {
            return p.fortuneCards;
          })
          .reduce((a, b) => a + b, 0);
        if (totalCardsNumber < fortuneCards.length) {
          ChatMessage.create({
            user: game.user._id,
            content: `Il totale delle carte (${totalCardsNumber}) deve essere maggiore delle carte da dividere (${fortuneCards.length})`
          });
          return;
        }

        console.log(data);

        if (selectedUserIds.length <= 0) {
          ChatMessage.create({
            user: game.user._id,
            content: 'Devono essere specificati almeno 2 giocatori'
          });
          return;
        }

        const cards = Array.from(hand.cards.values());
        console.log(cards);
        if (cards.filter((c) => c.suit === 'fortune').length === 0) {
          ChatMessage.create({
            user: game.user._id,
            content: 'Non ci sono carte fortuna nella mano attuale'
          });
          return;
        }

        const players = data.map((d) => {
          return d.player;
        });
        const resultMap = new Map();
        for (const player of players) {
          resultMap.set(player, []);
        }
        console.log(resultMap);

        let index = 0;
        while (cards.length > 0) {
          cards.sort(() => Math.random() - 0.5);
          const card = cards.pop();
          console.log(index);
          console.log(card);

          if (card.suit === 'fortune') {
            index = tryAssignFortuneCard(resultMap, players, index, data, card);
          }
          index = ++index % players.length;
        }
        console.log(resultMap);

        let htmlMsg = `
          <h3>Divisione Carte Fortuna</h3>
        `;
        for (const [p, cs] of resultMap) {
          htmlMsg += `<p>${p} (${cs.length})</p><div class="card-draw flexrow">`;
          for (const c of cs) {
            htmlMsg += `<img class="card-face" src="${c.img}" alt="${c.name}" title="${c.name}" style="max-width: 90px;margin-right: 5px;margin-bottom: 5px;"/>`;
          }
          htmlMsg += '</div>';
        }

        await ChatMessage.create({
          user: game.user._id,
          content: htmlMsg
        });
      }
    }
  }).render(true);
}

/**
 * Requests a test/trial from players.
 * Opens a dialog for the narrator to request a test with a reason.
 */
export async function richiediProva() {
  const deck = game.cards.getName('DoD - lista carte');

  await deck.recall({
    chatNotification: false
  });

  // Clear the draw round state when starting a new test
  await clearRoundState();

  let confirmed = false;

  new Dialog({
    title: game.i18n.localize('DECK_OF_DESTINY.dialogs.requestTest.title'),
    content: `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize(
            'DECK_OF_DESTINY.dialogs.requestTest.reason'
          )}</label>
          <input id="reason" name="reason" autofocus onFocus="select()" tabindex="1" type="text"></input>
        </div>
      </form>
    `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.request'),
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel'),
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        const reason = html.find('[name=reason]')[0].value ?? '';

        const messageContent = `
          <div>
            <h1>${game.i18n.localize('DECK_OF_DESTINY.messages.requestTest.title')}</h1>
            <p>${reason}</p>
            <div class="dod-macro-buttons">
              <button data-dod-action="addCards" style="background: linear-gradient(180deg, #aaffaa 50%, #009900 100%); border: 1px solid #009900;">
                <i class="fas fa-plus"></i> ${game.i18n.localize(
                  'DECK_OF_DESTINY.messages.requestTest.addCards'
                )}
              </button>
              <button data-dod-action="viewDeck" style="background: linear-gradient(180deg, #8c4aff 50%, #4a0099 100%); border: 1px solid #4a0099;">
                <i class="fas fa-eye"></i> ${game.i18n.localize(
                  'DECK_OF_DESTINY.chat.buttons.viewDeck'
                )}
              </button>
              <button data-dod-action="draw" style="background: linear-gradient(180deg, #aac8ff 50%, #16448e 100%); border: 1px solid #16448e;">
                <i class="fas fa-draw-polygon"></i> ${game.i18n.localize(
                  'DECK_OF_DESTINY.actions.draw'
                )}
              </button>
            </div>
          </div>
        `;

        await ChatMessage.create({
          user: game.user._id,
          content: messageContent,
          speaker: {
            actor: null,
            token: null,
            alias: game.user.name
          }
        });
      }
    }
  }).render(true);
}

/**
 * Empties the deck by recalling all cards.
 * Returns all cards to the main deck.
 */
export async function svuotaMazzo() {
  if (!game.user?.isGM) {
    ui.notifications.warn(
      game.i18n.localize('DECK_OF_DESTINY.messages.warnings.onlyGMEmpty')
    );
    return;
  }
  return withCardLock(async () => {
    const deck = game.cards.getName('DoD - lista carte');
    await deck.recall({ chatNotification: false });

    // Clear the draw round state
    await clearRoundState();

    ChatMessage.create({
      user: game.user.id,
      content: `<p><strong>${game.i18n.localize(
        'DECK_OF_DESTINY.messages.info.deckEmptiedTitle'
      )}</strong> ${game.i18n.localize(
        'DECK_OF_DESTINY.messages.info.deckEmptied'
      )}</p>`
    });
    ui.notifications.info(
      game.i18n.localize('DECK_OF_DESTINY.messages.info.deckEmptiedToast')
    );
  });
}

/**
 * Performs a defense roll with damage absorption.
 * Opens a dialog to configure damage, additional dice, and defense level.
 * @param {Actor} actor - Optional actor to pre-select absorption coefficient
 */
export async function tiroDifesa(actor = null) {
  let confirmed = false;

  // Get actor's absorption value (0-3) and convert to select value (1-4)
  const absorptionValue = actor?.system?.attributes?.absorption?.value ?? 0;
  const selectedValue = absorptionValue + 1;

  const dialogContent = `
    <form>
      <div class="form-group">
        <label>${game.i18n.localize(
          'DECK_OF_DESTINY.dialogs.defenseRoll.damageTaken'
        )}</label>
        <input
          id="dmg"
          name="dmg"
          value="1"
          autofocus
          onFocus="select()"
          tabindex="1"
          type="number"
          min="1"
        />
      </div>
      <div class="form-group">
        <label>${game.i18n.localize(
          'DECK_OF_DESTINY.dialogs.defenseRoll.additionalDice'
        )}</label>
        <input
          id="additional"
          name="additional"
          value="0"
          tabindex="2"
          type="number"
          min="0"
        />
      </div>
      <div class="form-group">
        <label>${game.i18n.localize(
          'DECK_OF_DESTINY.dialogs.defenseRoll.absorptionCoeff'
        )}</label>
        <select name="defense" id="defense" tabindex="3">
          <option value="1" ${
            selectedValue === 1 ? 'selected' : ''
          }>${game.i18n.localize(
    'DECK_OF_DESTINY.attributes.absorption.0.label'
  )}</option>
          <option value="2" ${
            selectedValue === 2 ? 'selected' : ''
          }>${game.i18n.localize(
    'DECK_OF_DESTINY.attributes.absorption.1.label'
  )}</option>
          <option value="3" ${
            selectedValue === 3 ? 'selected' : ''
          }>${game.i18n.localize(
    'DECK_OF_DESTINY.attributes.absorption.2.label'
  )}</option>
          <option value="4" ${
            selectedValue === 4 ? 'selected' : ''
          }>${game.i18n.localize(
    'DECK_OF_DESTINY.attributes.absorption.3.label'
  )}</option>
        </select>
      </div>
    </form>
  `;

  new Dialog({
    title: game.i18n.localize('DECK_OF_DESTINY.actions.defense_roll'),
    content: dialogContent,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.roll'),
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel'),
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        const dmg = parseInt(html.find('[name=dmg]')[0].value) || 0;
        const additionalDice = parseInt(html.find('[name=additional]')[0].value) || 0;
        const select = document.getElementById('defense');
        const defenseLevel = parseInt(select.options[select.selectedIndex].value);
        console.log(`${dmg + additionalDice}d6cs<=${defenseLevel}`);
        const r = new Roll(`${dmg + additionalDice}d6cs<=${defenseLevel}`); // Execute the roll
        await r.evaluate();
        await r.toMessage({}, { create: false });
        const rollsAsString = r.terms[0].results
          .map((d) => {
            const successClass = d.success ? 'success' : '';
            return `<li class="roll die d6 ${successClass}">${d.result}</li>`;
          })
          .join('');

        const absorbed = r.result;
        const damageKey =
          dmg > 1
            ? 'DECK_OF_DESTINY.messages.defenseRoll.damagePlural'
            : 'DECK_OF_DESTINY.messages.defenseRoll.damageSingular';

        const damageLabel = game.i18n.localize(damageKey);
        const summaryHtml = game.i18n.format(
          'DECK_OF_DESTINY.messages.defenseRoll.summary',
          {
            absorbed,
            damage: dmg,
            damageLabel
          }
        );

        const chatContent = `
          <h2>${game.i18n.localize('DECK_OF_DESTINY.actions.defense_roll')}</h2>
          ${summaryHtml}
          <div class="dice-tooltip expanded" style="display: block;">
            <section class="tooltip-part">
              <div class="dice">
                <ol class="dice-rolls">
                  ${rollsAsString}
                </ol>
              </div>
            </section>
          </div>
        `;

        await ChatMessage.create({
          user: game.user.id,
          content: chatContent
        });
      }
    }
  }).render(true);
}

/**
 * Open/close/edit a single special card definition's add-or-edit form.
 * Resolves once the nested dialog is confirmed or cancelled.
 * @param {{deck: Cards, cardsDocuments: Cards[], definition: object|null}} args
 * @returns {Promise<void>}
 */
function openSpecialCardForm({ deck, cardsDocuments, definition = null }) {
  return new Promise((resolve) => {
    const isEdit = Boolean(definition);
    new Dialog({
      title: isEdit
        ? game.i18n.localize('DECK_OF_DESTINY.dialogs.manageSpecialCards.editTitle')
        : game.i18n.localize('DECK_OF_DESTINY.dialogs.manageSpecialCards.addTitle'),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize(
              'DECK_OF_DESTINY.dialogs.manageSpecialCards.name'
            )}</label>
            <input name="name" type="text" value="${
              definition?.name ?? ''
            }" autofocus onFocus="select()"/>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize(
              'DECK_OF_DESTINY.dialogs.manageSpecialCards.power'
            )}</label>
            <textarea name="description">${definition?.description ?? ''}</textarea>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize(
              'DECK_OF_DESTINY.dialogs.manageSpecialCards.image'
            )}</label>
            <input name="img" type="text" value="${definition?.img ?? ''}"/>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize(
              'DECK_OF_DESTINY.dialogs.manageSpecialCards.copies'
            )}</label>
            <input name="copies" type="number" min="1" value="${
              definition?.available ?? 1
            }"/>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.save'),
          callback: async (html) => {
            const name = html.find('[name=name]')[0].value.trim();
            const description = html.find('[name=description]')[0].value.trim();
            const img = html.find('[name=img]')[0].value.trim();
            const copies = Math.max(
              1,
              parseInt(html.find('[name=copies]')[0].value) || 1
            );

            if (!name) {
              ui.notifications.error(
                game.i18n.localize(
                  'DECK_OF_DESTINY.messages.errors.specialCardNameRequired'
                )
              );
              resolve();
              return;
            }

            await withCardLock(async () => {
              if (isEdit) {
                await updateSpecialCardDefinition(cardsDocuments, definition.suit, {
                  name,
                  description,
                  img
                });
                const { shortfall } = await adjustSpecialCardCopies(
                  deck,
                  definition.suit,
                  copies,
                  { name, description, img }
                );
                if (shortfall > 0) {
                  ui.notifications.warn(
                    game.i18n.format(
                      'DECK_OF_DESTINY.messages.warnings.copiesShortfall',
                      {
                        name,
                        shortfall
                      }
                    )
                  );
                }
              } else {
                await createSpecialCardDefinition(deck, {
                  name,
                  description,
                  img,
                  copies
                });
              }
            });
            resolve();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel'),
          callback: () => resolve()
        }
      },
      default: 'save',
      close: () => resolve()
    }).render(true);
  });
}

/**
 * Opens the GM-only special card management dialog: list, add, edit, and
 * delete special card definitions living in the master deck.
 */
export async function gestisciCarteSpeciali() {
  if (!game.user?.isGM) {
    ui.notifications.warn(
      game.i18n.localize('DECK_OF_DESTINY.messages.warnings.onlyGMManageSpecial')
    );
    return;
  }

  const deck = game.cards.getName('DoD - lista carte');
  const pile = game.cards.getName('Mazzo');
  const hand = game.cards.getName('Mano');
  const cardsDocuments = [deck, pile, hand];

  const definitions = getSpecialCardDefinitions(deck);

  const rows = definitions.length
    ? definitions
        .map(
          (d) => `
        <li data-suit="${
          d.suit
        }" style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
          <img src="${d.img || 'icons/svg/card-hand.svg'}" width="32" height="32"/>
          <span style="flex:1;">${d.name} (${d.available})</span>
          <button type="button" data-action="edit" data-suit="${d.suit}">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" data-action="delete" data-suit="${d.suit}">
            <i class="fas fa-trash"></i>
          </button>
        </li>`
        )
        .join('')
    : `<li>${game.i18n.localize(
        'DECK_OF_DESTINY.dialogs.manageSpecialCards.noCards'
      )}</li>`;

  const dialog = new Dialog({
    title: game.i18n.localize('DECK_OF_DESTINY.dialogs.manageSpecialCards.title'),
    content: `
      <ul style="list-style:none; padding:0;">${rows}</ul>
      <button type="button" data-action="add">
        <i class="fas fa-plus"></i> ${game.i18n.localize(
          'DECK_OF_DESTINY.dialogs.manageSpecialCards.addNew'
        )}
      </button>
    `,
    buttons: {
      close: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('DECK_OF_DESTINY.dialogs.buttons.cancel')
      }
    },
    default: 'close',
    render: (html) => {
      html.find('[data-action=add]').on('click', async () => {
        await openSpecialCardForm({ deck, cardsDocuments });
        await dialog.close();
        gestisciCarteSpeciali();
      });
      html.find('[data-action=edit]').on('click', async (event) => {
        const suit = event.currentTarget.dataset.suit;
        const definition = definitions.find((d) => d.suit === suit);
        await openSpecialCardForm({ deck, cardsDocuments, definition });
        await dialog.close();
        gestisciCarteSpeciali();
      });
      html.find('[data-action=delete]').on('click', async (event) => {
        const suit = event.currentTarget.dataset.suit;
        await withCardLock(async () => {
          await deleteSpecialCardDefinition(cardsDocuments, suit);
        });
        await dialog.close();
        gestisciCarteSpeciali();
      });
    }
  });
  dialog.render(true);
}
