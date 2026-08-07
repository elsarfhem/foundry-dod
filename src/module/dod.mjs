// Import document classes.
import { DeckOfDestinyActor } from './documents/actor.mjs';
import { DeckOfDestinyItem } from './documents/item.mjs';
// Import sheet classes.
import { DeckOfDestinyActorSheet } from './sheets/actor-sheet.mjs';
import { DeckOfDestinyItemSheet } from './sheets/item-sheet.mjs';
// Import lightweight non-rerender enhancements
import './sheets/actor-sheet/xp-lite.mjs';
import './sheets/actor-sheet/cards-lite.mjs';
import './sheets/actor-sheet/health-lite.mjs';
import './sheets/actor-sheet/name-player-lite.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { DECK_OF_DESTINY } from './helpers/config.mjs';
import { initChatListeners } from './helpers/chat.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';
import {
  aggiungiAlMazzo,
  componiIlMazzoEPesca,
  divisioneCarteFortuna,
  gestisciCarteSpeciali,
  isCardOperationLocked,
  richiediProva,
  pesca,
  rischia,
  svuotaMazzo,
  tiroDifesa
} from './globals.mjs';
import { createGMRelay, setGMRelay, pickTargetGM } from './helpers/gm-relay.mjs';
import {
  gmAddCardsToPile,
  gmAddToDeck,
  gmResetPileForNewRound,
  gmComposeAndDraw,
  gmDrawFromPile,
  gmExecutePlayerDraw,
  gmRisk,
  gmCreateSpecialCard,
  gmUpdateSpecialCard,
  gmDeleteSpecialCard
} from './helpers/gm-card-actions.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.dod = {
    DeckOfDestinyActor,
    DeckOfDestinyItem,
    isCardOperationLocked,
    rollItemMacro,
    macros: {
      aggiungiAlMazzo,
      componiIlMazzoEPesca,
      divisioneCarteFortuna,
      gestisciCarteSpeciali,
      pesca,
      richiediProva,
      rischia,
      svuotaMazzo,
      tiroDifesa
    }
  };

  // Add custom constants for configuration.
  CONFIG.DECK_OF_DESTINY = DECK_OF_DESTINY;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    // TODO: remember to update this formula to match the system
    formula: '1d20 + @characteristics.inu.value',
    decimals: 2
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = DeckOfDestinyActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.DeckOfDestinyCharacter,
    npc: models.DeckOfDestinyNPC
  };
  CONFIG.Item.documentClass = DeckOfDestinyItem;
  CONFIG.Item.dataModels = {
    item: models.DeckOfDestinyItem,
    ability: models.DeckOfDestinyAbility,
    talent: models.DeckOfDestinyTalent,
    condition: models.DeckOfDestinyCondition,
    trauma: models.DeckOfDestinyTrauma,
    attribute: models.DeckOfDestinyAttribute,
    power: models.DeckOfDestinyPower
  };

  // Register sheet application classes
  Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
  Actors.registerSheet('dod', DeckOfDestinyActorSheet, {
    makeDefault: true,
    label: 'DECK_OF_DESTINY.sheet.labels.actor'
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('dod', DeckOfDestinyItemSheet, {
    makeDefault: true,
    label: 'DECK_OF_DESTINY.sheet.labels.item'
  });

  // Initialize chat button listeners for all players
  initChatListeners();

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Socketlib GM Relay                          */
/* -------------------------------------------- */

// Card mutations shared across clients (deck/pile/hand) are relayed through
// one deterministically-chosen GM via socketlib, so a single process is the
// real point of serialization instead of each browser's own in-memory lock.
// Every client - including any GM who isn't the chosen target - relays
// through `socket.executeAsUser`, never `executeAsGM`: that call alone
// would let socketlib route different calls to different GMs when more
// than one is online, splitting the queue in two (see `pickTargetGM`). If
// socketlib is missing/inactive, this hook never fires and the relay stays
// unavailable for every caller (see gm-relay.mjs's `relayNotReady` error) -
// no silent fallback to unserialized mutation.
Hooks.once('socketlib.ready', () => {
  const socket = socketlib.registerSystem('dod');
  const handlers = {
    addCardsToPile: gmAddCardsToPile,
    addToDeck: gmAddToDeck,
    resetPileForNewRound: gmResetPileForNewRound,
    composeAndDraw: gmComposeAndDraw,
    drawFromPile: gmDrawFromPile,
    executePlayerDraw: gmExecutePlayerDraw,
    risk: gmRisk,
    createSpecialCard: gmCreateSpecialCard,
    updateSpecialCard: gmUpdateSpecialCard,
    deleteSpecialCard: gmDeleteSpecialCard
  };
  for (const [actionKey, handler] of Object.entries(handlers)) {
    socket.register(actionKey, handler);
  }

  setGMRelay(
    createGMRelay({
      hasTransport: () => true,
      getTargetGMId: () => pickTargetGM(game.users)?.id ?? null,
      isSelf: (userId) => game.user.id === userId,
      executeLocal: (actionKey, payload) => handlers[actionKey](payload),
      executeRemote: (targetId, actionKey, payload) =>
        socket.executeAsUser(actionKey, targetId, payload)
    })
  );
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

// Add 2 values
Handlebars.registerHelper('add', function (value1, value2) {
  return value1 + value2;
});

// Check if a value is greater than another
Handlebars.registerHelper('gt', function (a, b) {
  return a > b;
});

// Check if a value is different from another
Handlebars.registerHelper('ne', function (a, b) {
  return a !== b;
});

Handlebars.registerHelper('simplify', function (text, length) {
  if (!text) return ''; // Handle undefined or null text
  // Remove HTML tags
  const strippedText = text.replace(/<\/?[^>]+(>|$)/g, '');
  // Truncate text to the specified length
  const truncatedText =
    strippedText.length > length
      ? strippedText.substring(0, length) + '...'
      : strippedText;
  return new Handlebars.SafeString(truncatedText);
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @return {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn('You can only create macro buttons for owned Items');
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.dod.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find((m) => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'dod.itemMacro': true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}
