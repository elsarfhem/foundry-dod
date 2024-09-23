// Import document classes.
import { DeckOfDestinyActor } from './documents/actor.mjs';
import { DeckOfDestinyItem } from './documents/item.mjs';
// Import sheet classes.
import { DeckOfDestinyActorSheet } from './sheets/actor-sheet.mjs';
import { DeckOfDestinyItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { DECK_OF_DESTINY } from './helpers/config.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.dod = {
    DeckOfDestinyActor,
    DeckOfDestinyItem,
    rollItemMacro
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
    condition: models.DeckOfDestinyCondition,
    spell: models.DeckOfDestinySpell
  };

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('dod', DeckOfDestinyActorSheet, {
    makeDefault: true,
    label: 'DECK_OF_DESTINY.SheetLabels.Actor'
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('dod', DeckOfDestinyItemSheet, {
    makeDefault: true,
    label: 'DECK_OF_DESTINY.SheetLabels.Item'
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
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
