import DeckOfDestinyItemBase from './base-item.mjs';

/**
 * The DeckOfDestinyTalent class extends the DeckOfDestinyItemBase class with
 * talent-specific data and behaviors.
 */
export default class DeckOfDestinyTalent extends DeckOfDestinyItemBase {
  /**
   * Define the schema for the DeckOfDestinyItem.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.value = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
      max: 3
    });

    return schema;
  }
}
