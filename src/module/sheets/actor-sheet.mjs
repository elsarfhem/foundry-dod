import {
  createItem,
  decreaseItemValue,
  deleteItemRow,
  increaseItemValue
} from './actor-sheet/items.mjs';
import {
  addCards,
  addCardsToPile,
  addSheetCard,
  drawCardsFromPile,
  resetActorCards,
  subtractSheetCard,
  toggleHeaderCards
} from './actor-sheet/cards.mjs';
import {
  decreaseAttribute,
  increaseAttribute,
  setCharacteristicValue
} from './actor-sheet/attributes.mjs';
import {
  changeConditionName,
  changeTrauma,
  toggleConditionDeadly,
  toggleTraumaOptional
} from './actor-sheet/conditions-trauma.mjs';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class DeckOfDestinyActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['dod', 'sheet', 'actor'],
      width: 850,
      height: 600,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'core'
        }
      ]
    });
  }

  /** @override */
  get template() {
    return `systems/dod/src/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toPlainObject();

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Add isGM flag
    context.isGM = game.user.isGM;

    // Adding a pointer to CONFIG.DECK_OF_DESTINY
    context.config = CONFIG.DECK_OF_DESTINY;

    // Prepare items to display
    this._prepareItems(context);

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography = await TextEditor.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
        relativeTo: this.actor
      }
    );

    return context;
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    const gear = [];
    const abilities = [];
    const talents = [];
    const conditions = [];
    const traumas = [];
    const attributes = []; // user-defined attributes

    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      if (i.type === 'item') {
        gear.push(i);
      } else if (i.type === 'ability') {
        abilities.push(i);
      } else if (i.type === 'talent') {
        talents.push(i);
      } else if (i.type === 'condition') {
        conditions.push(i);
      } else if (i.type === 'trauma') {
        traumas.push(i);
      } else if (i.type === 'attribute') {
        attributes.push(i);
      }
    }

    // Assign and return
    context.gear = gear;
    context.abilities = abilities;
    context.talents = talents;
    context.conditions = conditions;
    context.traumas = traumas;
    context.attributes = attributes;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Ensure eq helper exists for the partial conditionals
    if (!Handlebars.helpers.eq) {
      Handlebars.registerHelper('eq', (a, b) => a === b);
    }

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    html.on('click', '.toggle-header-cards', (ev) => toggleHeaderCards(html, ev));

    const editOnRightClick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!this.isEditable) return;

      const nameDiv = $(ev.currentTarget);
      const li = nameDiv.closest('li.item');

      // ignore header rows and special condition rows
      if (
        li.hasClass('inventory-header') ||
        li.hasClass('items-header') ||
        li.hasClass('condition')
      )
        return;

      const item = this.actor.items.get(li.data('itemId'));
      if (!item) return;

      // Only open sheets for inventory ('item'), abilities and talents
      if (['item', 'ability', 'talent'].includes(item.type)) {
        item.sheet.render(true);
      }
    };

    // Right-clicking an item's name opens its sheet in edit mode for abilities, talents and inventory items.
    html.on('contextmenu', 'li.item .item-name', (ev) => {
      editOnRightClick(ev);
    });

    html.on('contextmenu', 'li.item .item-fixed-name', (ev) => {
      editOnRightClick(ev);
    });

    html.on('contextmenu', 'li.item .item-description', (ev) => {
      editOnRightClick(ev);
    });

    html.on('contextmenu', 'li.item .item-quantity', (ev) => {
      editOnRightClick(ev);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on('click', '.item-create', (e) => createItem(this, e));

    // Delete Inventory Item
    html.on('click', '.item-delete', async (e) => deleteItemRow(this, e));

    // Add event listener to all input fields to handle keydown events
    html.find('input').on('keydown', this._onInputKeydown.bind(this));

    // Rollable characteristics.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Addable characteristics.
    html.on('click', '.addable', (e) => addCards(this, e));

    // Add or subtract cards.
    html.on('contextmenu', '.manage-sheet-card', (e) => subtractSheetCard(this, e));
    html.on('click', '.manage-sheet-card', (e) => addSheetCard(this, e));

    // Reset cards.
    html.on('mouseenter', '.reset-sheet-cards', () => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur(); // Remove focus from the active input element
      }
    });
    html.on('click', '.reset-sheet-cards', async (event) => {
      event.target.blur(); // Remove focus from the button.
      await resetActorCards(this);
    });

    // Add cards from sheet to pile.
    html.on('mouseenter', '.add-sheet-cards-to-pile', (event) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur(); // Remove focus from the active input element
      }
    });
    html.on('click', '.add-sheet-cards-to-pile', async (event) => {
      event.target.blur(); // Remove focus from the button.
      await addCardsToPile(this);
    });

    // Draw cards from the pile.
    html.on('mouseenter', '.draw-from-pile', (event) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur(); // Remove focus from the active input element
      }
    });
    html.on('click', '.draw-cards-from-pile', async (event) => {
      event.target.blur(); // Remove focus from the button.
      await drawCardsFromPile(this);
    });

    // Characteristic value setting.
    html.on('click', '.characteristic-click', (e) => setCharacteristicValue(this, e));

    // Attribute value setting.
    html.on('click', '.attribute-click', (e) => increaseAttribute(this, e));
    html.on('contextmenu', '.attribute-click', (e) => decreaseAttribute(this, e));

    // Ability/Talent value setting.
    html.on('click', '.item-click', (e) => increaseItemValue(this, e));
    html.on('contextmenu', '.item-click', (e) => decreaseItemValue(this, e));
    html.on('click', '.item-increase-click', (e) => increaseItemValue(this, e));
    html.on('click', '.item-decrease-click', (e) => decreaseItemValue(this, e));

    // Condition name setting.
    html.on('focusout', '.item-condition-input', (e) => changeConditionName(this, e));

    // Condition deadly setting.
    html.on('click', '.item-condition-deadly', (e) => toggleConditionDeadly(this, e));

    // Handle trauma selection
    html.on('click', '.trauma-input', (e) => changeTrauma(this, e));

    // Handle trauma optional toggle
    html.on('click', '.trauma-optional-input', (e) => toggleTraumaOptional(this, e));

    // Drag events for macros.
    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (
          li.classList.contains('inventory-header') ||
          li.classList.contains('items-header') ||
          li.classList.contains('condition')
        )
          return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  /**
   * Stop enter key press from triggering buttons and trigger focusout event.
   * @param {Event} event - The originating keydown event.
   */
  _onInputKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur(); // Trigger the blur event to simulate focusout
    }
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @return {Roll} The rolled result.
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      const label = dataset.label ? `[characteristic] ${dataset.label}` : '';
      const roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode')
      });
      return roll;
    }
  }
}
