// Condition and Trauma helpers
/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function changeConditionName(sheet, event) {
  event.preventDefault();
  const element = event.currentTarget;
  const itemId = element.closest('.item').dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  const name = element.value;
  if (name.trim() !== '') {
    await item.update({ 'system.name': name, 'system.enabled': true });
  } else {
    await item.update({
      'system.name': '',
      'system.enabled': false,
      'system.deadly': false
    });
  }
  const items = sheet.actor.toObject().items;
  const modifier = items.reduce(
    (sum, it) =>
      it.type === 'condition' && it.system.enabled ? sum + it.system.value : sum,
    0
  );
  await sheet.actor.update({ 'system.cards.failure.modifier': modifier });
}
/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function toggleConditionDeadly(sheet, event) {
  event.preventDefault();
  const element = event.currentTarget;
  const itemId = element.closest('.item').dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  await item.update({ 'system.deadly': !item.system.deadly });
}
/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function changeTrauma(sheet, event) {
  event.preventDefault();
  const traumaModifier = parseInt(event.currentTarget.dataset.modifier);
  const traumaIndex = parseInt(event.currentTarget.id.split('-')[1]);
  const traumas = sheet.actor.items.filter((it) => it.type === 'trauma');
  const currentSelectedTrauma = traumas.find((t) => t.system.selected);
  let modifier = 0;
  for (const [index, trauma] of traumas.entries()) {
    const isSelected = index === traumaIndex;
    await trauma.update({
      'system.selected': isSelected && trauma !== currentSelectedTrauma
    });
    if (isSelected && trauma !== currentSelectedTrauma) modifier = traumaModifier;
  }
  await sheet.actor.update({ 'system.cards.success.modifier': modifier });
}

/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function toggleTraumaOptional(sheet, event) {
  event.preventDefault();
  const element = event.currentTarget;
  const itemId = element.closest('.trauma-button').dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  const enabled = element.checked;
  await item.update({ 'system.enabled': enabled });
  // If disabling a trauma that is currently selected, deselect it.
  if (!enabled && item.system.selected) {
    await item.update({ 'system.selected': false });
    // Update success card modifier.
    const traumas = sheet.actor.items.filter((it) => it.type === 'trauma');
    const selectedTrauma = traumas.find((t) => t.system.selected);
    const modifier = selectedTrauma ? selectedTrauma.system.value : 0;
    await sheet.actor.update({ 'system.cards.success.modifier': modifier });
  }
}

/**
 *
 * @param {*} sheet
 * @param {Event} dieHardLevel
 */
export async function applyDieHardLevel(sheet, dieHardLevel) {
  const level = Number(dieHardLevel) || 0;

  // Update the dieHard.value in the data model
  await sheet.actor.update(
    { 'system.attributes.dieHard.value': level },
    { render: false }
  );

  // All trauma items sorted by sort order
  const traumas = sheet.actor.items
    .filter((it) => it.type === 'trauma')
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  // Only optional traumas, in that same order
  const optionalTraumas = traumas.filter((t) => t.system?.optional);

  // Enable up to 'level' optional traumas, disable the rest
  for (const [index, trauma] of optionalTraumas.entries()) {
    const shouldEnable = index < level;
    if (trauma.system.enabled !== shouldEnable) {
      await trauma.update({ 'system.enabled': shouldEnable }, { render: false });

      // If disabling a selected trauma, also clear selection
      if (!shouldEnable && trauma.system.selected) {
        await trauma.update({ 'system.selected': false }, { render: false });
      }
    }
  }

  // Recalculate success card modifier based on currently selected trauma
  const updatedTraumas = sheet.actor.items.filter((it) => it.type === 'trauma');
  const selectedTrauma = updatedTraumas.find((t) => t.system.selected);
  const modifier = selectedTrauma ? selectedTrauma.system.value : 0;
  await sheet.actor.update(
    { 'system.cards.success.modifier': modifier },
    { render: false }
  );
}
