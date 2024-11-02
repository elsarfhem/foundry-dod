import DeckOfDestinyItemBase from './base-item.mjs';

/**
 * The DeckOfDestinyItem class extends the DeckOfDestinyItemBase class with
 * item-specific data and behaviors.
 */
export default class DeckOfDestinyItem extends DeckOfDestinyItemBase {
  /**
   * Define the schema for the DeckOfDestinyItem.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 1
    });

    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0
    });

    return schema;
  }
}
