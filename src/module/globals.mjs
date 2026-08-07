import { createDrawChat, suitToName, renderCardThumbnail } from './helpers/chat.mjs';
import { getSpecialCardDefinitions } from './helpers/special-cards.mjs';
import { getRequesterIdentity, runOnGM } from './helpers/gm-relay.mjs';

/**
 * FIFO queue tail for card macro execution. Card operations modify shared
 * deck/pile/hand state; running two concurrently (e.g. double-click, rapid
 * button presses, or - once GM-relayed - two different players' requests
 * landing on the same GM process) can cause stale-state errors. Queuing
 * (rather than rejecting a busy call) matters once callers can be different
 * people: dropping a second local double-click is fine, dropping another
 * player's real request is not.
 * @type {Promise<void>}
 */
let _queueTail = Promise.resolve();

/**
 * Number of withCardLock calls currently queued or running.
 * @type {number}
 */
let _pendingCount = 0;

/**
 * The currently-open "Gestisci carte speciali" dialog instance, if any.
 * Tracked so that re-invoking the macro (e.g. a double-click on the hotbar
 * icon, or clicking it again while already open) closes the previous
 * instance instead of stacking an independent one — otherwise editing a
 * card in one instance leaves any other open instance showing stale data.
 * @type {Dialog|null}
 */
let _manageSpecialCardsDialog = null;

/**
 * Check whether a card operation is currently queued or running.
 * @returns {boolean}
 */
export function isCardOperationLocked() {
  return _pendingCount > 0;
}

/**
 * Execute a card operation, queued behind any other call already in
 * flight. Never rejects/drops a call - it just waits its turn, so it stays
 * correct once GM-relayed calls from different players share this queue.
 * A throwing `fn` propagates its rejection to its own caller without
 * blocking later queued calls.
 * @param {Function} fn - Async function to execute
 * @returns {Promise<*>} Result of fn
 */
export async function withCardLock(fn) {
  _pendingCount++;
  const run = _queueTail.then(() => fn());
  _queueTail = run.catch(() => {});
  try {
    return await run;
  } finally {
    _pendingCount--;
  }
}

/**
 * Adds cards to the deck based on user input.
 * Opens a dialog to select the number of each card type to add.
 */
export async function aggiungiAlMazzo() {
  const deck = game.cards.getName('DoD - lista carte');

  const specialDefinitions = getSpecialCardDefinitions(deck);
  const specialRows = specialDefinitions.length
    ? `<div class="form-group"><label><strong>${game.i18n.localize(
        'DECK_OF_DESTINY.dialogs.createDeck.specialCardsSection'
      )}</strong></label></div>` +
      specialDefinitions
        .map((d, i) => {
          const safeName = $('<div>').text(d.name).html();
          return `
          <div class="form-group">
           <label>${safeName} (${d.available})</label>
           <input id="special-${i}" name="special-${i}" value="0" tabindex="${
            6 + i
          }" type="number" min="0" max="${d.available}"></input>
          </div>`;
        })
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
        const totalSpecialQty = Object.values(specialCounts).reduce((a, b) => a + b, 0);
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
          const result = await runOnGM('addToDeck', {
            counts: {
              success: successCardsNum,
              failure: failureCardsNum,
              issue: issueCardsNum,
              destiny: destinyCardsNum,
              fortune: fortuneCardsNum
            },
            specialCounts
          });
          if (!result.success) {
            return ui.notifications.error(
              game.i18n.localize(result.error) || result.error
            );
          }

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
  const resetResult = await runOnGM('resetPileForNewRound', {});
  if (!resetResult.success) {
    return ui.notifications.error(
      game.i18n.localize(resetResult.error) || resetResult.error
    );
  }

  const specialDefinitions = getSpecialCardDefinitions(deck);
  const specialRows = specialDefinitions.length
    ? `<div class="form-group"><label><strong>${game.i18n.localize(
        'DECK_OF_DESTINY.dialogs.createDeck.specialCardsSection'
      )}</strong></label></div>` +
      specialDefinitions
        .map((d, i) => {
          const safeName = $('<div>').text(d.name).html();
          return `
          <div class="form-group">
           <label>${safeName} (${d.available})</label>
           <input id="special-${i}" name="special-${i}" value="0" tabindex="${
            7 + i
          }" type="number" min="0" max="${d.available}"></input>
          </div>`;
        })
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

        const result = await runOnGM('composeAndDraw', {
          playersNum,
          counts: {
            success: successCardsNum,
            failure: failureCardsNum,
            issue: issueCardsNum,
            destiny: destinyCardsNum,
            fortune: fortuneCardsNum
          },
          specialCounts
        });
        if (!result.success) {
          return ui.notifications.error(
            game.i18n.localize(result.error) || result.error
          );
        }
        if (result.data.drawnCards.length)
          createDrawChat(result.data.drawnCards, playersNum);
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
        const pile = game.cards.getName('Mazzo');

        const successCardsNum = pile.cards.filter(
          (card) => card.suit === 'success'
        ).length;
        const issueCardsNum = pile.cards.filter((card) => card.suit === 'issue').length;
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

        const result = await runOnGM('drawFromPile', { playersNum });
        if (!result.success) {
          return ui.notifications.error(
            game.i18n.localize(result.error) || result.error
          );
        }
        if (result.data.drawnCards.length)
          createDrawChat(result.data.drawnCards, playersNum);
      }
    }
  }).render(true);
}

/**
 * Performs a risk action by drawing cards until success or failure.
 * Validates equal success and failure cards in hand before proceeding.
 * The actual mutation is relayed to the GM (see gm-relay.mjs,
 * gm-card-actions.mjs#gmRisk) so two players risking at nearly the same
 * time run one after another instead of interleaving mid-draw. This client
 * only renders the outcome, using its own (correct, non-fakeable)
 * game.user for the resulting chat message.
 */
export async function rischia() {
  const identity = getRequesterIdentity();
  const result = await runOnGM('risk', identity);
  if (!result.success) {
    return ui.notifications.error(game.i18n.localize(result.error) || result.error);
  }

  const { outcome } = result.data;
  let msg;

  if (outcome === 'noDeckCards') {
    msg = game.i18n.localize('DECK_OF_DESTINY.messages.errors.noDeckCards');
    ui.notifications.error(msg);
    await ChatMessage.create({ user: game.user._id, content: msg });
    return;
  }

  if (outcome === 'unequalCards') {
    const { numSuccess, numFailure } = result.data;
    msg =
      game.i18n.localize('DECK_OF_DESTINY.messages.warnings.unequalCards') +
      ` ${game.i18n.localize('DECK_OF_DESTINY.cards.success')}: ` +
      numSuccess +
      ` - ${game.i18n.localize('DECK_OF_DESTINY.cards.failure')}: ` +
      numFailure;
    ui.notifications.warn(msg);
    ChatMessage.create({ user: game.user._id, content: msg });
    return;
  }

  if (outcome === 'noCardsForRisk') {
    ui.notifications.error(
      game.i18n.localize('DECK_OF_DESTINY.messages.errors.noCardsForRisk')
    );
    return;
  }

  if (outcome === 'resolved') {
    const { drawnCards, finalSuit, finalName } = result.data;
    drawnCards.sort((a, b) => a.suit.localeCompare(b.suit));
    const map = new Map();
    let cardsHtml = '';
    drawnCards.forEach((card) => {
      const existing = map.get(card.suit);
      if (existing) {
        existing.count++;
      } else {
        map.set(card.suit, { count: 1, name: card.name });
      }
      cardsHtml += renderCardThumbnail(card);
    });
    const summary = Array.from(map)
      .map(([suit, { count, name }]) => `<li>${suitToName(suit, name)}: ${count}</li>`)
      .join('');

    const outcomeText =
      finalSuit === 'success'
        ? game.i18n.localize('DECK_OF_DESTINY.messages.success.riskSuccess')
        : game.i18n.localize('DECK_OF_DESTINY.messages.failure.riskFailure');

    msg = `<h1>${game.i18n.localize(
      'DECK_OF_DESTINY.messages.info.drewCard'
    )} ${finalName} ${outcomeText}</h1>
          <ul>${summary}</ul>
         <div class="card-draw flexrow">${cardsHtml}</div>`;
  } else {
    // outcome === 'noSuccessOrFailure'
    msg = game.i18n.localize('DECK_OF_DESTINY.messages.errors.noSuccessOrFailure');
  }
  await ChatMessage.create({ user: game.user._id, content: msg });
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
  const resetResult = await runOnGM('resetPileForNewRound', { clearRound: true });
  if (!resetResult.success) {
    return ui.notifications.error(
      game.i18n.localize(resetResult.error) || resetResult.error
    );
  }

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
 *
 * Relayed to the GM (same target-GM queue as every other card mutation) so
 * that a second GM emptying the deck can never race a relayed
 * addCardsToPile/composeAndDraw that's mid-flight on the target's queue -
 * two independent local `withCardLock` calls on two different GM processes
 * would not have protected against that.
 */
export async function svuotaMazzo() {
  if (!game.user?.isGM) {
    ui.notifications.warn(
      game.i18n.localize('DECK_OF_DESTINY.messages.warnings.onlyGMEmpty')
    );
    return;
  }
  const result = await runOnGM('resetPileForNewRound', { clearRound: true });
  if (!result.success) {
    return ui.notifications.error(game.i18n.localize(result.error) || result.error);
  }
  ChatMessage.create({
    user: game.user.id,
    content: `<p><strong>${game.i18n.localize(
      'DECK_OF_DESTINY.messages.info.deckEmptiedTitle'
    )}</strong> ${game.i18n.localize('DECK_OF_DESTINY.messages.info.deckEmptied')}</p>`
  });
  ui.notifications.info(
    game.i18n.localize('DECK_OF_DESTINY.messages.info.deckEmptiedToast')
  );
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
 * Resolves once the nested dialog is confirmed or cancelled. The mutation
 * itself is relayed to the GM (see gmCreateSpecialCard/gmUpdateSpecialCard
 * in gm-card-actions.mjs) so it serializes against every other card
 * mutation on the same target-GM queue, not just other actions on this
 * client - the deck/pile/hand documents it touches are resolved GM-side.
 * @param {{definition: object|null}} args
 * @returns {Promise<void>}
 */
function openSpecialCardForm({ definition = null } = {}) {
  return new Promise((resolve) => {
    const isEdit = Boolean(definition);
    // HTML-escape GM-controlled text before interpolating into the form
    // (same pattern as draw-round.mjs's NFR #5 escaping).
    // safeName also escapes `"` because it's interpolated into a `value="..."`
    // attribute (not just element content), where an unescaped quote would
    // break out of the attribute.
    const safeName = $('<div>')
      .text(definition?.name ?? '')
      .html()
      .replace(/"/g, '&quot;');
    const safeDescription = $('<div>')
      .text(definition?.description ?? '')
      .html();
    const safeImg = $('<div>')
      .text(definition?.img ?? '')
      .html()
      .replace(/"/g, '&quot;');
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
            <input name="name" type="text" value="${safeName}" autofocus onFocus="select()"/>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize(
              'DECK_OF_DESTINY.dialogs.manageSpecialCards.power'
            )}</label>
            <textarea name="description">${safeDescription}</textarea>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize(
              'DECK_OF_DESTINY.dialogs.manageSpecialCards.image'
            )}</label>
            <div class="form-fields">
              <input name="img" type="text" value="${safeImg}"/>
              <button type="button" class="file-picker" data-type="image" data-target="img" title="${game.i18n.localize(
                'DECK_OF_DESTINY.dialogs.manageSpecialCards.image'
              )}">
                <i class="fas fa-file-import fa-fw"></i>
              </button>
            </div>
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

            const result = isEdit
              ? await runOnGM('updateSpecialCard', {
                  ...getRequesterIdentity(),
                  suit: definition.suit,
                  name,
                  description,
                  img,
                  copies
                })
              : await runOnGM('createSpecialCard', {
                  ...getRequesterIdentity(),
                  name,
                  description,
                  img,
                  copies
                });

            if (!result.success) {
              ui.notifications.error(game.i18n.localize(result.error) || result.error);
              resolve();
              return;
            }
            if (isEdit && result.data.shortfall > 0) {
              ui.notifications.warn(
                game.i18n.format('DECK_OF_DESTINY.messages.warnings.copiesShortfall', {
                  name,
                  shortfall: result.data.shortfall
                })
              );
            }
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
      close: () => resolve(),
      render: (html) => {
        html.find('.file-picker').on('click', (event) => {
          const button = event.currentTarget;
          const input = html.find(`[name="${button.dataset.target}"]`);
          new FilePicker({
            type: button.dataset.type,
            current: input.val(),
            callback: (path) => input.val(path)
          }).browse();
        });
      }
    }).render(true);
  });
}

/**
 * True while an open/close cycle of the manage-special-cards dialog is in
 * flight. Guards against a rapid double-click on the macro (or clicking it
 * again while already open): concurrent extra invocations are silently
 * ignored rather than queued, since Foundry's own Dialog render()/close()
 * don't reliably serialize against each other even when each step is
 * individually awaited — attempting to queue several open cycles back to
 * back was still observed to leave stale "ghost" dialog elements behind.
 * Dropping the redundant extra calls sidesteps that entirely: only one
 * cycle ever runs, and it already reflects the latest state by the time it
 * finishes.
 * @type {boolean}
 */
let _manageSpecialCardsDialogBusy = false;

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

  if (_manageSpecialCardsDialogBusy) return;
  _manageSpecialCardsDialogBusy = true;
  try {
    await _openManageSpecialCardsDialog();
  } finally {
    _manageSpecialCardsDialogBusy = false;
  }
}

/**
 * Builds and renders the manage-special-cards Dialog. Only ever invoked
 * through the busy-guard in {@link gestisciCarteSpeciali} — never call this
 * directly.
 * @returns {Promise<void>}
 */
async function _openManageSpecialCardsDialog() {
  if (_manageSpecialCardsDialog) {
    await _manageSpecialCardsDialog.close();
    _manageSpecialCardsDialog = null;
  }

  const deck = game.cards.getName('DoD - lista carte');
  const definitions = getSpecialCardDefinitions(deck);

  const rows = definitions.length
    ? definitions
        .map((d) => {
          const safeName = $('<div>').text(d.name).html();
          return `
        <li data-suit="${d.suit}" style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
          <img src="${d.img}" width="32" height="32"/>
          <span style="flex:1;">${safeName} (${d.available})</span>
          <button type="button" data-action="edit" data-suit="${d.suit}">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" data-action="delete" data-suit="${d.suit}">
            <i class="fas fa-trash"></i>
          </button>
        </li>`;
        })
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
        await openSpecialCardForm({});
        gestisciCarteSpeciali();
      });
      html.find('[data-action=edit]').on('click', async (event) => {
        const suit = event.currentTarget.dataset.suit;
        const definition = definitions.find((d) => d.suit === suit);
        await openSpecialCardForm({ definition });
        gestisciCarteSpeciali();
      });
      html.find('[data-action=delete]').on('click', async (event) => {
        const suit = event.currentTarget.dataset.suit;
        const result = await runOnGM('deleteSpecialCard', {
          ...getRequesterIdentity(),
          suit
        });
        if (!result.success) {
          ui.notifications.error(game.i18n.localize(result.error) || result.error);
        }
        gestisciCarteSpeciali();
      });
    },
    close: () => {
      if (_manageSpecialCardsDialog === dialog) _manageSpecialCardsDialog = null;
    }
  });
  _manageSpecialCardsDialog = dialog;
  await dialog.render(true);
}
