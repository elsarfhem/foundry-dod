// Attribute and characteristic helpers
export async function increaseAttribute(sheet, event) {
  event.preventDefault();
  const data = sheet.actor.toObject().system;
  const attributeType = event.currentTarget.dataset.attributeType;
  await sheet.actor.update({ [`system.attributes.${attributeType}.value`]: data.attributes[attributeType].value + 1 });
}
export async function decreaseAttribute(sheet, event) {
  event.preventDefault();
  const data = sheet.actor.toObject().system;
  const attributeType = event.currentTarget.dataset.attributeType;
  await sheet.actor.update({ [`system.attributes.${attributeType}.value`]: data.attributes[attributeType].value - 1 });
}
export async function setCharacteristicValue(sheet, event) {
  event.preventDefault();
  const target = event.currentTarget;
  const characteristicKey = target.closest('.characteristic-circles').dataset.characteristicKey;
  const newValue = parseInt(target.dataset.value);
  await sheet.actor.update({ [`system.characteristics.${characteristicKey}.value`]: newValue });
}

