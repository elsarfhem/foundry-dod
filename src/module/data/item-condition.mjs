import DeckOfDestinyItemBase from './base-item.mjs';

/**
 * The DeckOfDestinyCondition class extends the DeckOfDestinyItemBase class with
 * condition-specific data and behaviors.
 */
export default class DeckOfDestinyCondition extends DeckOfDestinyItemBase {
  /**
   * Define the schema for the DeckOfDestinyItem.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.name = new fields.StringField({
      required: true,
      blank: true
    });

    schema.value = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    schema.deadly = new fields.BooleanField({
      required: true,
      initial: false
    });

    schema.enabled = new fields.BooleanField({
      required: true,
      initial: false
    });

    schema.label = new fields.StringField({
      required: true,
      blank: true
    });

    return schema;
  }
}
