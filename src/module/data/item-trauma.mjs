import DeckOfDestinyItemBase from './base-item.mjs';

/**
 * The DeckOfDestinyTrauma class extends the DeckOfDestinyItemBase class with
 * trauma-specific data and behaviors.
 */
export default class DeckOfDestinyTrauma extends DeckOfDestinyItemBase {
  /**
   * Define the schema for the DeckOfDestinyItem.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.label = new fields.StringField({
      required: true,
      blank: true
    });

    schema.value = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: -5
    });

    // defines if the trauma is currently selected because the PC has a critical injury
    schema.selected = new fields.BooleanField({
      required: true,
      initial: false
    });

    // defines if the trauma is optional (true) or mandatory (false). The Die Hard level only affects optional traumas
    schema.optional = new fields.BooleanField({
      required: true,
      initial: false
    });

    // defines if the trauma is currently visible/enabled based on the Die Hard level
    schema.enabled = new fields.BooleanField({
      required: true,
      initial: false
    });

    return schema;
  }
}
