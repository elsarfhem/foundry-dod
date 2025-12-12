// Item-related helper functions for DeckOfDestinyActorSheet
// Each function receives the sheet instance as first argument.

/**
 *
 * @param {*} sheet
 * @param {Event} event
 */
export async function createItem(sheet, event) {
  event.preventDefault();
  const header = event.currentTarget;
  const type = header.dataset.type;
  const data = foundry.utils.duplicate(header.dataset);
  const name =
    game.i18n.localize(`DECK_OF_DESTINY.types.item.${type}`) || `New ${type}`;
  const itemData = { name, type, system: data };
  delete itemData.system['type'];

  const optimizeTypes = ['item', 'ability', 'talent', 'power'];
  if (!optimizeTypes.includes(type)) {
    return await Item.create(itemData, { parent: sheet.actor });
  }

  let created;
  try {
    created = await Item.create(itemData, { parent: sheet.actor, render: false });
  } catch (err) {
    console.error('Optimized item creation failed; falling back to full render:', err);
    return Item.create(itemData, { parent: sheet.actor });
  }

  if (!sheet.rendered || !sheet.element || !sheet.element[0]) return created;

  const root = sheet.element[0];
  const createBtn = root.querySelector(
    `.item-control.item-create[data-type='${type}']`
  );
  const list = createBtn?.closest('ol.items-list');
  if (!list) {
    sheet.render(false);
    return created;
  }

  // Render shared partial for item row
  let rowHtml;
  try {
    rowHtml = await renderTemplate(
      'systems/dod/src/templates/actor/parts/actor-item-row.hbs',
      { item: created }
    );
  } catch (tplErr) {
    console.error('Failed to render item row partial; re-rendering sheet:', tplErr);
    sheet.render(false);
    return created;
  }
  if (!rowHtml) {
    sheet.render(false);
    return created;
  }

  try {
    const temp = document.createElement('div');
    temp.innerHTML = rowHtml.trim();
    const newLi = temp.firstElementChild;
    if (!newLi) {
      sheet.render(false);
      return created;
    }
    newLi.style.display = 'none';
    list.appendChild(newLi);
    if (window.$) $(newLi).slideDown(160);
    else newLi.style.display = '';
  } catch (injectErr) {
    console.error('Failed to inject rendered item row; re-rendering sheet:', injectErr);
    sheet.render(false);
  }

  return created;
}

/**
 * @param {*} sheet
 * @param {Event} event
 */
export async function deleteItemRow(sheet, event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const li = btn.closest('.item');
  if (!li) return;
  const itemId = li.dataset.itemId;
  if (!itemId) return;
  const item = sheet.actor.items.get(itemId);
  if (!item) return;
  if (!['item', 'ability', 'talent', 'power'].includes(item.type)) return;
  btn.disabled = true;
  try {
    await sheet.actor.deleteEmbeddedDocuments('Item', [itemId], { render: false });
    const $li = $(li);
    $li.slideUp(150, () => $li.remove());
  } catch (err) {
    console.error('Item deletion failed:', err);
    ui.notifications.error(
      game.i18n.localize('DECK_OF_DESTINY.errors.itemDeleteFailed') ||
        'Item deletion failed'
    );
    btn.disabled = false;
  }
}

/**
 * @param {*} sheet
 * @param {Event} event
 */
export async function increaseItemValue(sheet, event) {
  event.preventDefault();
  const element = event.currentTarget;
  const li = element.closest('.item');
  if (!li) return;
  const itemId = li.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item) return;
  const value = item.system.value;
  const proposed = value + 1;
  const typeCaps = { talent: 3, ability: 7 };
  const cap = typeCaps[item.type] ?? Number.POSITIVE_INFINITY;
  const newVal = Math.min(proposed, cap);
  if (newVal === value) return;
  await item.update({ 'system.value': newVal }, { render: false });
  const valueSpan =
    li.querySelector('.ability-value') ||
    li.querySelector('.item-core-button') ||
    element;
  if (valueSpan) valueSpan.textContent = newVal;
  const decreaseBtn = li.querySelector('.item-decrease-click');
  const increaseBtn = li.querySelector('.item-increase-click');
  if (decreaseBtn) {
    decreaseBtn.title =
      game.i18n.format('DECK_OF_DESTINY.actions.decrease') +
      ': +' +
      game.i18n.format(`DECK_OF_DESTINY.attributes.xp.abilities.${newVal}`);
  }
  if (increaseBtn) {
    increaseBtn.title =
      game.i18n.format('DECK_OF_DESTINY.actions.increase') +
      ': -' +
      game.i18n.format(`DECK_OF_DESTINY.attributes.xp.abilities.${newVal + 1}`);
  }
}

/**
 * @param {*} sheet
 * @param {Event} event
 */
export async function decreaseItemValue(sheet, event) {
  event.preventDefault();
  const element = event.currentTarget;
  const li = element.closest('.item');
  if (!li) return;
  const itemId = li.dataset.itemId;
  const item = sheet.actor.items.get(itemId);
  if (!item) return;
  const value = item.system.value;
  if (value <= 0) return;
  const newVal = value - 1;
  await item.update({ 'system.value': newVal }, { render: false });
  const valueSpan =
    li.querySelector('.ability-value') ||
    li.querySelector('.item-core-button') ||
    element;
  if (valueSpan) valueSpan.textContent = newVal;
  const decreaseBtn = li.querySelector('.item-decrease-click');
  const increaseBtn = li.querySelector('.item-increase-click');
  if (decreaseBtn) {
    decreaseBtn.title =
      game.i18n.format('DECK_OF_DESTINY.actions.decrease') +
      ': +' +
      game.i18n.format(`DECK_OF_DESTINY.attributes.xp.abilities.${newVal}`);
  }
  if (increaseBtn) {
    increaseBtn.title =
      game.i18n.format('DECK_OF_DESTINY.actions.increase') +
      ': -' +
      game.i18n.format(`DECK_OF_DESTINY.attributes.xp.abilities.${newVal + 1}`);
  }
}

export function editOnRightClick(sheet, ev) {
    ev.preventDefault();
    ev.stopPropagation();

    const nameDiv = $(ev.currentTarget);
    const li = nameDiv.closest('li.item');

    // ignore header rows and special condition rows
    if (
        li.hasClass('inventory-header') ||
        li.hasClass('items-header') ||
        li.hasClass('condition')
    )
        return;

    const item = sheet.actor.items.get(li.data('itemId'));
    if (!item) return;

    // Only open sheets for inventory ('item'), abilities and talents
    if (['item', 'ability', 'talent', 'power'].includes(item.type)) {
        item.sheet.render(true);
    }
}
