// Attribute and characteristic helpers

/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function increaseAttribute(sheet, event) {
  event.preventDefault();
  const root = sheet.element[0];
  const attributeType = event.currentTarget.dataset.attributeType;
  const data = sheet.actor.toObject().system;
  const current = data.attributes[attributeType].value;
  const newVal = current + 1;
  await sheet.actor.update(
    { [`system.attributes.${attributeType}.value`]: newVal },
    { render: false }
  );
  updateAttributeDisplay(root, attributeType, newVal);
}

/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function decreaseAttribute(sheet, event) {
  event.preventDefault();
  const root = sheet.element[0];
  const attributeType = event.currentTarget.dataset.attributeType;
  const data = sheet.actor.toObject().system;
  const current = data.attributes[attributeType].value;
  const newVal = Math.max(0, current - 1);
  await sheet.actor.update(
    { [`system.attributes.${attributeType}.value`]: newVal },
    { render: false }
  );
  updateAttributeDisplay(root, attributeType, newVal);
}

/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function setCharacteristicValue(sheet, event) {
  event.preventDefault();
  const target = event.currentTarget;
  const root = sheet.element[0];
  const characteristicKey = target.closest('.characteristic-circles').dataset
    .characteristicKey;
  const newValue = parseInt(target.dataset.value);
  // Update actor without triggering full sheet render
  await sheet.actor.update(
    { [`system.characteristics.${characteristicKey}.value`]: newValue },
    { render: false }
  );
  updateCharacteristicCircles(root, characteristicKey, newValue);
}

function updateAttributeDisplay(root, attributeType, newVal) {
  try {
    const btn = root.querySelector(
      `button.attribute-button[data-attribute-type="${attributeType}"]`
    );
    if (btn) btn.textContent = newVal;

    // Companion span (the line beneath the button)
    const span = btn?.parentElement?.querySelector('span.mt-half');
    if (!span) return; // Nothing further to update

    // Lookup label maps from CONFIG
    const cfg = CONFIG?.DECK_OF_DESTINY || {};
    if (attributeType === 'absorption') {
      const key = cfg.absorption?.[newVal];
      span.textContent = key ? game.i18n.localize(key) : '\u00A0';
    } else if (attributeType === 'mitigation') {
      const key = cfg.mitigation?.[newVal];
      span.textContent = key ? game.i18n.localize(key) : '\u00A0';
    } else {
      // For attributes like fortune (or custom user-defined ones without a label map)
      // Keep a clean placeholder (non-breaking space) so layout stays consistent.
      span.textContent = '\u00A0';
    }
  } catch (e) {
    console.debug('Attribute display update skipped', e);
  }
}

function updateCharacteristicCircles(root, characteristicKey, newValue) {
  try {
    const container = root.querySelector(
      `.characteristic-circles[data-characteristic-key="${characteristicKey}"]`
    );
    if (!container) return;
    container.querySelectorAll('span.characteristic-click.circle').forEach((span) => {
      const val = parseInt(span.dataset.value);
      if (val <= newValue) {
        span.classList.add('filled');
      } else {
        span.classList.remove('filled');
      }
      // Show numeric value only on the selected circle (matching original template behavior)
      span.textContent = val === newValue ? String(val) : '';
    });
  } catch (e) {
    console.debug('Characteristic circles update skipped', e);
  }
}
