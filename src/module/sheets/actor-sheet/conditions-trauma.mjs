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
