import {getCardsToDraw} from "./sheets/actor-sheet/cards.mjs";
import { createDrawChat } from './helpers/chat.mjs';

Hooks.once('init', () => {
  console.log('Deck of Destiny | Macros module initialized');

  game.dod.macros = {
    aggiungiAlMazzo,
    componiIlMazzoEPesca,
    divisioneCarteFortuna,
    pesca,
    rischia,
    svuotaMazzo,
    tiroDifesa
  };
});

const suitToName = (suit) => {
  switch (suit) {
    case 'white':
      return 'Carta Bianca';
    case 'success':
      return 'Carta Successo';
    case 'issue':
      return 'Carta Imprevisto';
    case 'destiny':
      return 'Carta del Destino';
    case 'failure':
      return 'Carta Fallimento';
    case 'fortune':
      return 'Carta Fortuna';
  }
};

/**
 * Adds cards to the deck based on user input.
 * Opens a dialog to select the number of each card type to add.
 */
export async function aggiungiAlMazzo() {
  // ...code from "aggiungi-al-mazzo.json" command property...
  const deck = game.cards.getName('DoD - lista carte');
  const pile = game.cards.getName('Mazzo');

  let confirmed = false;

  new Dialog({
    title: 'Crea il mazzo',
    content: `
       <form>
          <div class="form-group">
           <label>Num. Carte Successo:</label>
           <input id="success-cards" name="success-cards" value="0" autofocus onFocus="select()" tabindex="1" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>Num. Carte Fallimento:</label>
           <input id="failure-cards" name="failure-cards" value="0" tabindex="2" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>Num. Carte Imprevisto:</label>
           <input id="issue-cards" name="issue-cards" value="0" tabindex="3" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>Num. Carte del Destino:</label>
           <input id="destiny-cards" name="destiny-cards" value="0" tabindex="4" type="number" min="0"></input>
          </div>
          <div class="form-group">
           <label>Num. Carte Fortuna:</label>
           <input id="fortune-cards" name="fortune-cards" value="0" tabindex="5" type="number" min="0"></input>
          </div>
         </form>
         `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Aggiungi al Mazzo',
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Annulla',
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        const successCards = deck.cards.filter(
          (card) => card.suit === 'success' && !card.drawn
        );
        const issueCards = deck.cards.filter(
          (card) => card.suit === 'issue' && !card.drawn
        );
        const destinyCards = deck.cards.filter(
          (card) => card.suit === 'destiny' && !card.drawn
        );
        const failureCards = deck.cards.filter(
          (card) => card.suit === 'failure' && !card.drawn
        );
        const fortuneCards = deck.cards.filter(
          (card) => card.suit === 'fortune' && !card.drawn
        );

          const {
              issueCardsNum,
              successCardsNum,
              destinyCardsNum,
              failureCardsNum,
              fortuneCardsNum,
          } = getCardCountsFromDialog(html);


          const successSelected = successCards.slice(0, successCardsNum);
        const issueSelected = issueCards.slice(0, issueCardsNum);
        const destinySelected = destinyCards.slice(0, destinyCardsNum);
        const failureSelected = failureCards.slice(0, failureCardsNum);
        const fortuneSelected = fortuneCards.slice(0, fortuneCardsNum);

        if (
          issueCardsNum +
            successCardsNum +
            destinyCardsNum +
            failureCardsNum +
            fortuneCardsNum >
          0
        ) {
          await deck.pass(
            pile,
            successSelected
              .map((card) => card.id)
              .concat(issueSelected.map((card) => card.id))
              .concat(destinySelected.map((card) => card.id))
              .concat(failureSelected.map((card) => card.id))
              .concat(fortuneSelected.map((card) => card.id)),
            {
              chatNotification: false
            }
          );

          ChatMessage.create({
            user: game.user._id,
            content: `<p>${game.user.name} ha aggiunto al mazzo: </p>
          <ul>
          <li>Carta Successo: ${successCardsNum}</li>
          <li>Carta Fallimento: ${failureCardsNum}</li>
              <li>Carta Imprevisto: ${issueCardsNum}</li>
              <li>Carta Fortuna: ${fortuneCardsNum}</li>
              <li>Carta del Destino: ${destinyCardsNum}</li>
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
        fortuneCardsNum: parseInt(html.find('[name=fortune-cards]')[0].value) || 0,
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

  const whiteCards = deck.cards.filter((card) => card.suit === 'white');
  const successCards = deck.cards.filter((card) => card.suit === 'success');
  const issueCards = deck.cards.filter((card) => card.suit === 'issue');
  const destinyCards = deck.cards.filter((card) => card.suit === 'destiny');
  const failureCards = deck.cards.filter((card) => card.suit === 'failure');
  const fortuneCards = deck.cards.filter((card) => card.suit === 'fortune');

  let confirmed = false;

  new Dialog({
    title: 'Crea il mazzo',
    content: `
       <form>
       <div class="form-group">
         <label>Num. giocatori nella prova:</label>
         <input id="num-players" name="num-players" value="1" autofocus onFocus="select()" tabindex="1" type="number" min="1"></input>
        </div>
        <div class="form-group">
         <label>Num. Carte Successo:</label>
         <input id="success-cards" name="success-cards" value="0" tabindex="2" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>Num. Carte Fallimento:</label>
         <input id="failure-cards" name="failure-cards" value="0" tabindex="3" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>Num. Carte Imprevisto:</label>
         <input id="issue-cards" name="issue-cards" value="0" tabindex="4" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>Num. Carte del Destino:</label>
         <input id="destiny-cards" name="destiny-cards" value="0" tabindex="5" type="number" min="0"></input>
        </div>
        <div class="form-group">
         <label>Num. Carte Fortuna:</label>
         <input id="fortune-cards" name="fortune-cards" value="0" tabindex="6" type="number" min="0"></input>
        </div>
       </form>
       `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Componi & Pesca',
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Annulla',
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
              fortuneCardsNum,
          } = getCardCountsFromDialog(html);

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

        const whiteCardsNum = Math.max(
          0,
          20 -
            successCardsNum -
            issueCardsNum -
            destinyCardsNum -
            failureCardsNum -
            fortuneCardsNum
        );

        const whiteSelected = whiteCards.slice(0, whiteCardsNum);
        const successSelected = successCards.slice(0, successCardsNum);
        const issueSelected = issueCards.slice(0, issueCardsNum);
        const destinySelected = destinyCards.slice(0, destinyCardsNum);
        const failureSelected = failureCards.slice(0, failureCardsNum);
        const fortuneSelected = fortuneCards.slice(0, fortuneCardsNum);

        let cardsHtml = ``;

        if (
          issueCardsNum +
            successCardsNum +
            destinyCardsNum +
            failureCardsNum +
            fortuneCardsNum >
          0
        )
          await deck.pass(
            pile,
            whiteSelected
              .map((card) => card.id)
              .concat(successSelected.map((card) => card.id))
              .concat(issueSelected.map((card) => card.id))
              .concat(destinySelected.map((card) => card.id))
              .concat(failureSelected.map((card) => card.id))
              .concat(fortuneSelected.map((card) => card.id)),
            {
              chatNotification: false
            }
          );

        if (pile.cards.size > 0) {
          const drawCards = await hand.draw(
            pile,
            getCardsToDraw(pile.cards.size, playersNum),
            {
              how: CONST.CARD_DRAW_MODES.RANDOM,
              chatNotification: false
            }
          );
          createDrawChat(drawCards, playersNum);
        }
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
    title: 'Pesca dal mazzo',
    content: `
       <form>
         <div class="form-group">
           <label>Num. giocatori nella prova:</label>
           <input id="num-players" name="num-players" value="1" autofocus onFocus="select()" tabindex="1" type="number" min="1"></input>
         </div>
       </form>
     `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Pesca',
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Annulla',
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        const deck = game.cards.getName('DoD - lista carte');
        let pile = game.cards.getName('Mazzo');
        const hand = game.cards.getName('Mano');

        const whiteCards = deck.cards.filter((card) => card.suit === 'white');
        const successSelected = pile.cards.filter((card) => card.suit === 'success');
        const issueSelected = pile.cards.filter((card) => card.suit === 'issue');
        const destinySelected = pile.cards.filter((card) => card.suit === 'destiny');
        const failureSelected = pile.cards.filter((card) => card.suit === 'failure');
        const fortuneSelected = pile.cards.filter((card) => card.suit === 'fortune');

        const playersNum = parseInt(html.find('[name=num-players]')[0].value) || 1;
        const issueCardsNum = issueSelected.length;
        const successCardsNum = successSelected.length;
        const destinyCardsNum = destinySelected.length;
        const failureCardsNum = failureSelected.length;
        const fortuneCardsNum = fortuneSelected.length;
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

        const whiteSelected = whiteCards.slice(0, whiteCardsNum);

        let cardsHtml = ``;

        if (
          issueCardsNum +
            successCardsNum +
            destinyCardsNum +
            failureCardsNum +
            fortuneCardsNum ===
          0
        )
          return;

        await deck.pass(
          pile,
          whiteSelected.map((card) => card.id),
          {
            chatNotification: false
          }
        );

        pile = game.cards.getName('Mazzo');

        if (pile.cards.size > 0) {
          const drawCards = await hand.draw(
            pile,
            getCardsToDraw(pile.cards.size, playersNum),
            {
              how: CONST.CARD_DRAW_MODES.RANDOM,
              chatNotification: false
            }
          );
          createDrawChat(drawCards, playersNum);
        }
      }
    }
  }).render(true);
}

/**
 * Performs a risk action by drawing cards until success or failure.
 * Validates equal success and failure cards in hand before proceeding.
 */
export async function rischia() {
  const pile = game.cards.getName('Mazzo');
  const hand = game.cards.getName('Mano');

  const numFailure = hand.cards.filter((card) => card.suit === 'failure').length;
  const numSuccess = hand.cards.filter((card) => card.suit === 'success').length;

  let msg = '';

  if (pile.cards.size === 0) {
    msg = 'Errore: non puoi rischiare se non ci sono carte nel mazzo';
    ui.notifications.error(msg);
    await ChatMessage.create({
      user: game.user._id,
      content: msg
    });
    return;
  }

  if (numSuccess !== numFailure || numSuccess === 0) {
    msg =
      'Attenzione: il numero di successi e di fallimenti nella mano non sono uguali. Successi: ' +
      numSuccess +
      ' - Fallimenti: ' +
      numFailure;
    ui.notifications.warn(msg);
    ChatMessage.create({
      user: game.user._id,
      content: msg
    });
    return;
  }

  let drawCard;
  const drawCards = [];
  let cardsHtml = '';
  do {
      if(pile.cards.size === 0) {
          ui.notifications.error('No success or failure cards found in the deck! The risk action cannot be completed.');
          return
      }
    [drawCard] =
      (await hand.draw(pile, 1, {
        how: CONST.CARD_DRAW_MODES.RANDOM,
        chatNotification: false
      })) || [];
    drawCards.push(drawCard);
    console.log('you draw ' + drawCard);
  } while (drawCard && drawCard.suit !== 'success' && drawCard.suit !== 'failure');
  if (drawCard) {
    drawCards.sort((a, b) => a.suit.localeCompare(b.suit));
    const map = new Map();
    drawCards.forEach((card) => {
      let cardTypeNum = map.get(card.suit);
      if (cardTypeNum > 0) {
        map.set(card.suit, ++cardTypeNum);
      } else {
        map.set(card.suit, 1);
      }
      cardsHtml += `<img class="card-face" src="${card.img}" alt="${card.name}" title="${card.name}" style="max-width: 90px;margin-right: 5px;margin-bottom: 5px;"/>`;
    });
    console.log('map ' + map);
    const summary = Array.from(map)
      .map(([suit, num]) => `<li>${suitToName(suit)}: ${num}</li>`)
      .join('');

    msg = `<h1>Hai pescato una carta ${drawCard.name} ${
      drawCard.suit === 'success'
        ? 'La prova ha avuto successo!'
        : 'La prova é fallita!'
    }</h1>
            <ul>${summary}</ul>
           <div class=\"card-draw flexrow\">${cardsHtml}</div>`;
  } else {
    msg =
      'Nessun successo o fallimento trovato nel mazzo! La prova non ha avuto successo né fallimento.';
  }
  await ChatMessage.create({
    user: game.user._id,
    content: msg
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
      content: 'Non ci sono Carte Fortuna nella mano'
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
    title: `Dividi Carte Fortuna (${fortuneCards.length} carta/e)`,
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
        label: 'Dividi',
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Annulla',
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
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
  const pile = game.cards.getName('Mazzo');
  const hand = game.cards.getName('Mano');

  await deck.recall({
    chatNotification: false
  });

  let confirmed = false;

  new Dialog({
    title: 'Richiedi una prova',
    content: `
      <form>
        <div class="form-group">
          <label>Motivo:</label>
          <input id="reason" name="reason" autofocus onFocus="select()" tabindex="1" type="text"></input>
        </div>
      </form>
    `,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Richiedi',
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Annulla',
        callback: () => (confirmed = false)
      }
    },
    default: 'one',
    close: async (html) => {
      if (confirmed) {
        const reason = html.find('[name=reason]')[0].value ?? '';
        Requestor.request({
          description: `
            <h3>Il Narratore sta richiedendo una prova!</h3>
            <p>${reason}</p>
          `,
          img: 'icons/svg/card-hand.svg',
          title: 'Componi il mazzo!',
          buttonData: [
            {
              label: 'Aggiungi Carte',
              command: async () => {
                game.macros.find((k, v) => k.name === 'Aggiungi al mazzo').execute();
              }
            },
            {
              label: 'Vedi il Mazzo',
              command: async () => {
                pile.sheet.render(true);
              }
            },
            {
              label: 'Pesca',
              command: async () => {
                game.macros.find((k, v) => k.name === 'Pesca').execute();
                hand.sheet.render(true);
              }
            }
          ]
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
  // GM-only safeguard
  if (!game.user?.isGM) {
    ui.notifications.warn('Only the GM can empty the deck.');
    return;
  }
  const deck = game.cards.getName('DoD - lista carte');
  await deck.recall({ chatNotification: false });
  ChatMessage.create({
    user: game.user.id,
    content: `<p><strong>Mazzo svuotato:</strong> tutte le carte sono state richiamate</p>`
  });
  ui.notifications.info('Il mazzo è stato svuotato.');
}

/**
 * Performs a defense roll with damage absorption.
 * Opens a dialog to configure damage, additional dice, and defense level.
 */
export async function tiroDifesa() {
  let confirmed = false;

  // Dialog content HTML
  const dialogContent = `
    <form>
      <div class="form-group">
        <label>Danni subiti:</label>
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
        <label>Dadi aggiuntivi:</label>
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
        <label>Coeff. di Assorbimento:</label>
        <select name="defense" id="defense" tabindex="3">
          <option value="1">Base</option>
          <option value="2">Leggero</option>
          <option value="3">Medio</option>
          <option value="4">Alto</option>
        </select>
      </div>
    </form>
  `;

  new Dialog({
    title: 'Tiro Difesa',
    content: dialogContent,
    buttons: {
      one: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Tira',
        callback: () => (confirmed = true)
      },
      two: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Annulla',
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

        // Build chat message HTML
        const absorbed = r.result;
        const damageWord = dmg > 1 ? 'danni' : 'danno';
        const chatContent = `
          <h2>Tiro Difesa</h2>
          <p>
            Hai assorbito 
            <span style="font-size: large; font-weight: bold;">${absorbed}</span> 
            su ${dmg} ${damageWord}
          </p>
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
