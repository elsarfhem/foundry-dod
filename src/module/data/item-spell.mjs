import DeckOfDestinyItemBase from './base-item.mjs';

/**
 * The DeckOfDestinySpell class extends the DeckOfDestinyItemBase class with
 * spell-specific data and behaviors.
 */
export default class DeckOfDestinySpell extends DeckOfDestinyItemBase {
  /**
   * Define the schema for the DeckOfDestinySpell.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.spellLevel = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 1,
      min: 1,
      max: 9
    });

    return schema;
  }
}
