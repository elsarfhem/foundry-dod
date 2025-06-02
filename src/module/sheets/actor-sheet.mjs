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

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Add event listener to all input fields to handle keydown events
    html.find('input').on('keydown', this._onInputKeydown.bind(this));

    // Rollable characteristics.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Addable characteristics.
    html.on('click', '.addable', this._onAdd.bind(this));

    // Add or subtract cards.
    html.on('contextmenu', '.manage-sheet-card', this._onSubtractSheetCard.bind(this));
    html.on('click', '.manage-sheet-card', this._onAddSheetCard.bind(this));

    // Reset cards.
    html.on('mouseenter', '.reset-sheet-cards', (event) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur(); // Remove focus from the active input element
      }
    });
    html.on('click', '.reset-sheet-cards', async (event) => {
      event.target.blur(); // Remove focus from the button.
      this._onResetSheetCards(event);
    });

    // Add cards from sheet to pile.
    html.on('mouseenter', '.add-sheet-cards-to-pile', (event) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur(); // Remove focus from the active input element
      }
    });
    html.on('click', '.add-sheet-cards-to-pile', async (event) => {
      event.target.blur(); // Remove focus from the button.
      this._onAddSheetCardsToPile(event);
    });

    // Draw cards from the pile.
    html.on('mouseenter', '.draw-from-pile', (event) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur(); // Remove focus from the active input element
      }
    });
    html.on('click', '.draw-cards-from-pile', async (event) => {
      event.target.blur(); // Remove focus from the button.
      this._onDrawCardsFromPile(event);
    });

    // Characteristic value setting.
    html.on(
      'click',
      '.characteristic-click',
      this._onCharacteristicValueSetting.bind(this)
    );

    // Attribute value setting.
    html.on('click', '.attribute-click', this._onIncreaseAttributeValue.bind(this));
    html.on(
      'contextmenu',
      '.attribute-click',
      this._onDecreaseAttributeValue.bind(this)
    );

    // Ability/Talent value setting.
    html.on('click', '.item-click', this._onIncreaseItemValue.bind(this));
    html.on('contextmenu', '.item-click', this._onDecreaseItemValue.bind(this));
    html.on('click', '.item-increase-click', this._onIncreaseItemValue.bind(this));
    html.on('click', '.item-decrease-click', this._onDecreaseItemValue.bind(this));

    // Condition name setting.
    html.on(
      'focusout',
      '.item-condition-input',
      this._onConditionNameChange.bind(this)
    );

    // Condition deadly setting.
    html.on('click', '.item-condition-deadly', this._onConditionDeadly.bind(this));

    // Handle trauma selection
    html.on('click', '.trauma-input', this._onTraumaChange.bind(this));

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
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Initialize a default name.
    const name = game.i18n.localize(`DECK_OF_DESTINY.types.item.${type}`);
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system['type'];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
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

  /**
   * Handle adding a card.
   * @param {Event} event - The originating left click event.
   */
  async _onAddSheetCard(event) {
    event.preventDefault();
    const data = this.actor.toObject().system;
    const cardType = event.currentTarget.dataset.cardType;
    await this.actor.update({
      [`system.cards.${cardType}.value`]: data.cards[cardType].value + 1
    });
  }

  /**
   * Handle subtracting a card.
   * @param {Event} event - The originating right click event.
   */
  async _onSubtractSheetCard(event) {
    event.preventDefault();
    const data = this.actor.toObject().system;
    const cardType = event.currentTarget.dataset.cardType;
    await this.actor.update({
      [`system.cards.${cardType}.value`]: data.cards[cardType].value - 1
    });
  }

  /**
   * Handle resetting the cards.
   * @param {Event} event - The originating click event.
   */
  async _onResetSheetCards(event) {
    event.preventDefault();
    await this._resetActorSheetCards();
  }

  /**
   * Handle adding the cards to the deck.
   * @param {Event} event - The originating click event.
   */
  async _onAddSheetCardsToPile(event) {
    event.preventDefault();
    try {
      const data = this.actor.toObject().system.cards;
      if (this._isEmptyCardData(data)) {
        return ui.notifications.warn('There are no cards to add to pile.');
      }

      const deck = game.cards.getName('DoD - lista carte');
      if (!deck) {
        return ui.notifications.error(
          'The deck of cards is not available. Please make sure the deck is loaded.'
        );
      }

      const pile = game.cards.getName('Mazzo');
      if (!pile) {
        return ui.notifications.error(
          'The pile of cards is not available. Please make sure the pile is loaded.'
        );
      }

      const cards = this._getSheetCardsToAdd(deck, data);
      if (cards.length === 0) {
        return ui.notifications.warn('No available cards to add to pile.');
      }

      await this._passSheetCardsToPile(deck, pile, cards);
      this._notifyAddedCardsToChat(pile, data);
      await this._resetActorSheetCards();
    } catch (error) {
      console.error('Error adding cards to pile:', error);
      ui.notifications.error('An error occurred while adding cards to pile.');
    }
  }

  /**
   * Handle drawing cards from pile.
   * @param {Event} event - The originating click event.
   */
  async _onDrawCardsFromPile(event) {
    event.preventDefault();
    try {
      const deck = game.cards.getName('DoD - lista carte');
      if (!deck) {
        return ui.notifications.error(
          'The deck of cards is not available. Please make sure the deck is loaded.'
        );
      }
      const pile = game.cards.getName('Mazzo');
      if (!pile) {
        return ui.notifications.error(
          'The pile of cards is not available. Please make sure the pile is loaded.'
        );
      }
      if (pile.cards.size === 0) {
        return ui.notifications.warn(
          'The pile of cards is empty. Please add cards to the pile.'
        );
      }
      const hand = game.cards.getName('Mano');
      if (!hand) {
        return ui.notifications.error(
          'The hand of cards is not available. Please make sure the hand is loaded.'
        );
      }
      await this._drawCardsFromPileDialog(deck, pile, hand);
    } catch (error) {
      console.error('Error drawing cards from pile:', error);
      ui.notifications.error('An error occurred while drawing cards from pile.');
    }
  }

  /**
   * Draw cards from pile Dialog.
   * @param {Object} deck - The deck of cards.
   * @param {Object} pile - The pile of cards.
   * @param {Object} hand - The hand of cards.
   */
  async _drawCardsFromPileDialog(deck, pile, hand) {
    const confirmed = await Dialog.prompt({
      title: 'Draw Cards',
      content: `
        <form>
          <div class="form-group">
            <label>Test Players Number:</label>
            <input id="num-players" name="num-players" value="1" autofocus onFocus="select()" tabindex="1" type="number" min="1"></input>
          </div>
        </form>
      `,
      label: 'Draw',
      rejectClose: false
    });

    if (confirmed) {
      const players = parseInt(document.querySelector('[name=num-players]').value) || 1;
      await this._passWhiteCardsToPile(deck, pile);
      await this._drawCardsFromPile(pile, hand, players);
      this._notifyDrawnCardsToChat(hand);
    }
  }

  /**
   * Check if the card data is empty.
   * @param {Object} data - The card data.
   * @return {boolean} - True if the card data is empty, false otherwise.
   */
  _isEmptyCardData(data) {
    return (
      Object.values(data).reduce((sum, card) => {
        return sum + Math.max(0, card.value + card.modifier);
      }, 0) === 0
    );
  }

  /**
   * Get the cards to add to the pile.
   * @param {Object} deck - The deck of cards.
   * @param {Object} data - The card data.
   * @return {Array} - The array of cards to add.
   */
  _getSheetCardsToAdd(deck, data) {
    const cards = [];
    for (const [cardType, cardObj] of Object.entries(data)) {
      cards.push(
        ...deck.availableCards
          .filter((card) => card.suit === cardType)
          .slice(0, Math.max(0, cardObj.value + cardObj.modifier))
      );
    }
    return cards;
  }

  /**
   * Pass the cards to the pile.
   * @param {Object} deck - The deck of cards.
   * @param {Object} pile - The pile of cards.
   * @param {Array} cards - The array of cards to pass.
   */
  async _passSheetCardsToPile(deck, pile, cards) {
    await deck.pass(
      pile,
      cards.map((card) => card.id),
      { chatNotification: false }
    );
  }

  /**
   * Pass white cards to the pile.
   * @param {Object} deck - The deck of cards.
   * @param {Object} pile - The pile of cards.
   */
  async _passWhiteCardsToPile(deck, pile) {
    const whiteCardsNum = Math.max(0, 20 - pile.cards.size);
    const whiteCards = deck.availableCards
      .filter((card) => card.suit === 'white')
      .slice(0, whiteCardsNum);
    await deck.pass(
      pile,
      whiteCards.map((card) => card.id),
      { chatNotification: false }
    );
  }

  /**
   * Draw cards from pile.
   * @param {Object} pile - The pile of cards.
   * @param {Object} hand - The hand of cards.
   * @param {number} players - The number of players.
   */
  async _drawCardsFromPile(pile, hand, players) {
    return await hand.draw(pile, Math.ceil(pile.cards.size / (3 + players)), {
      how: CONST.CARD_DRAW_MODES.RANDOM,
      chatNotification: false
    });
  }

  /**
   * Notify the added cards to chat.
   * @param {Object} pile - The pile of cards.
   * @param {Object} data - The card data.
   */
  _notifyAddedCardsToChat(pile, data) {
    ChatMessage.create({
      user: game.user._id,
      content: `<p>I added to ${pile.link}: </p>
      <ul>
        <li>Success Cards: ${Math.max(
          0,
          data.success.value + data.success.modifier
        )}</li>
        <li>Failure Cards: ${Math.max(
          0,
          data.failure.value + data.failure.modifier
        )}</li>
        <li>Issue Cards: ${Math.max(data.issue.value + data.issue.modifier)}</li>
        <li>Fortune Cards: ${Math.max(data.fortune.value + data.fortune.modifier)}</li>
        <li>Destiny Cards: ${Math.max(data.destiny.value + data.destiny.modifier)}</li>
      </ul>`
    });
  }

  /**
   * Notify the drawn cards to chat.
   * @param {Object} hand - The hand of cards.
   */
  _notifyDrawnCardsToChat(hand) {
    const suitToName = (suit) => {
      switch (suit) {
        case 'white':
          return 'White Cards';
        case 'success':
          return 'Success Cards';
        case 'issue':
          return 'Issue Cards';
        case 'destiny':
          return 'Destiny Cards';
        case 'failure':
          return 'Failure Cards';
        case 'fortune':
          return 'Fortune Cards';
      }
    };
    const cardsMap = new Map();
    hand.cards.forEach((card) => {
      let cardTypeNum = cardsMap.get(card.suit);
      if (cardTypeNum > 0) {
        cardsMap.set(card.suit, ++cardTypeNum);
      } else {
        cardsMap.set(card.suit, 1);
      }
    });
    const cardsHtml = hand.cards
      .map(
        (card) =>
          `<img class="card-face" src="${card.img}" alt="${card.name}" title="${card.name}" style="max-width: 90px;margin-right: 5px;margin-bottom: 5px;"/>`
      )
      .join('');
    const summary = Array.from(cardsMap)
      .map(([suit, num]) => `<li>${suitToName(suit)}: ${num}</li>`)
      .join('');
    ChatMessage.create({
      user: game.user._id,
      content: `<p>I drew ${hand.link}: </p>
      <ul>${summary}</ul>
      <div class="card-draw flexrow">${cardsHtml}</div>`
    });
  }

  /**
   * Reset the actor's cards.
   */
  async _resetActorSheetCards() {
    await this.actor.update({
      'system.cards': {
        'success.value': 0,
        'failure.value': 0,
        'issue.value': 0,
        'destiny.value': 0,
        'fortune.value': 0
      }
    });
  }

  /**
   * Handle adding Success Cards based on the selected characteristic.
   * @param {Event} event - The originating left click event.
   */
  async _onAdd(event) {
    event.preventDefault();
    const actor = this.actor.toObject().system;
    const element = event.currentTarget;
    const elementData = element.dataset;
    let value = 0;
    let cardType = '';
    if (elementData.type === 'characteristic') {
      value = actor.characteristics[elementData.label].value;
      cardType = 'success';
    } else if (elementData.type === 'ability') {
      const itemId = element.closest('.item').dataset.itemId;
      const item = this.actor.items.get(itemId);
      value = item.system.value;
      cardType = 'success';
    } else if (elementData.type === 'condition') {
      const itemId = element.closest('.item').dataset.itemId;
      const item = this.actor.items.get(itemId);
      value = item.system.value;
      cardType = 'failure';
    }
    await this.actor.update({
      [`system.cards.${cardType}.value`]: actor.cards[cardType].value + value
    });
  }

  /**
   * Handle clicks on characteristic circles.
   * @param {Event} event - The originating click event.
   */
  async _onCharacteristicValueSetting(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const characteristicKey = target.closest('.characteristic-circles').dataset
      .characteristicKey;
    const newValue = parseInt(target.dataset.value);

    // Update the characteristic value
    await this.actor.update({
      [`system.characteristics.${characteristicKey}.value`]: newValue
    });
  }

  /**
   * Handle increasing the attribute value.
   * @param {Event} event - The originating left click event.
   */
  async _onIncreaseAttributeValue(event) {
    event.preventDefault();
    const data = this.actor.toObject().system;
    const attributeType = event.currentTarget.dataset.attributeType;
    await this.actor.update({
      [`system.attributes.${attributeType}.value`]:
        data.attributes[attributeType].value + 1
    });
  }

  /**
   * Handle decreasing the attribute value.
   * @param {Event} event - The originating right click event.
   */
  async _onDecreaseAttributeValue(event) {
    event.preventDefault();
    const data = this.actor.toObject().system;
    const attributeType = event.currentTarget.dataset.attributeType;
    await this.actor.update({
      [`system.attributes.${attributeType}.value`]:
        data.attributes[attributeType].value - 1
    });
  }

  /**
   * Handle increasing the ability/talent value.
   * @param {Event} event - The originating left click event.
   */
  async _onIncreaseItemValue(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const value = item.system.value;
    await item.update({ 'system.value': value + 1 });
  }

  /**
   * Handle decreasing the ability/talent value.
   * @param {Event} event - The originating right click event.
   */
  async _onDecreaseItemValue(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const value = item.system.value;
    await item.update({ 'system.value': value - 1 });
  }

  /**
   * Handle changing the condition name.
   * @param {Event} event - The originating focusout event.
   */
  async _onConditionNameChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const name = element.value;
    if (name.trim() !== '') {
      // check if name is empty
      await item.update({ 'system.name': name, 'system.enabled': true });
    } else {
      await item.update({
        'system.name': '',
        'system.enabled': false,
        'system.deadly': false
      });
    }
    // update actor failure cards modifier
    const items = this.actor.toObject().items;
    const modifier = items.reduce((sum, item) => {
      return item.type === 'condition' && item.system.enabled
        ? sum + item.system.value
        : sum;
    }, 0);
    // NOTE: for now, only conditions update the failure modifier
    // in the future, other items might affect the modifier (?)
    // remember to modify this part of the code accordingly
    await this.actor.update({
      'system.cards.failure.modifier': modifier
    });
  }

  /**
   * Handle changing the condition deadly.
   * @param {Event} event - The originating click event.
   */
  async _onConditionDeadly(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    await item.update({ 'system.deadly': !item.system.deadly });
  }

  /**
   * Handle changing the trauma.
   * @param {Event} event - The originating click event.
   */
  async _onTraumaChange(event) {
    event.preventDefault();
    const traumaModifier = parseInt(event.currentTarget.dataset.modifier);
    const traumaIndex = parseInt(event.currentTarget.id.split('-')[1]);
    const traumas = this.actor.items.filter((item) => item.type === 'trauma');
    const currentSelectedTrauma = traumas.find((trauma) => trauma.system.selected);
    let modifier = 0;
    // Toggle the selected trauma
    for (const [index, trauma] of traumas.entries()) {
      const isSelected = index === traumaIndex;
      // Deselect if the same trauma is clicked again
      await trauma.update({
        'system.selected': isSelected && trauma !== currentSelectedTrauma
      });
      if (isSelected && trauma !== currentSelectedTrauma) {
        modifier = traumaModifier;
      }
    }
    // Update the success modifier
    await this.actor.update({
      'system.cards.success.modifier': modifier
    });
  }
}
