/**
 * NPC-specific event handlers for the actor sheet
 */

/**
 * Activate NPC-specific event listeners
 * @param {DeckOfDestinyActorSheet} sheet - The actor sheet instance
 * @param {jQuery} html - The rendered HTML
 */
export function activateNPCListeners(sheet, html) {
  // Progress tracking increment/decrement
  html.on('click', '.progress-increment', async (e) => {
    e.preventDefault();
    const current = sheet.actor.system.currentSuccesses;
    const max = sheet.actor.system.depth;
    if (current < max) {
      await sheet.actor.update({ 'system.currentSuccesses': current + 1 });
    }
  });

  html.on('click', '.progress-decrement', async (e) => {
    e.preventDefault();
    const current = sheet.actor.system.currentSuccesses;
    if (current > 0) {
      await sheet.actor.update({ 'system.currentSuccesses': current - 1 });
    }
  });

  // Add special attack
  html.on('click', '.add-attack', async (e) => {
    e.preventDefault();
    const attacks = [...sheet.actor.system.specialAttacks];
    attacks.push({
      name: '',
      description: '',
      effect: '',
      damageBonus: 0
    });
    await sheet.actor.update({ 'system.specialAttacks': attacks });
  });

  // Delete special attack
  html.on('click', '.attack-delete', async (e) => {
    e.preventDefault();
    const index = parseInt(e.currentTarget.dataset.index);
    const attacks = [...sheet.actor.system.specialAttacks];
    attacks.splice(index, 1);
    await sheet.actor.update({ 'system.specialAttacks': attacks });
  });
}
