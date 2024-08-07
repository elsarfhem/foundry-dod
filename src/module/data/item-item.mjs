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

    // Break down roll formula into three independent fields
    schema.roll = new fields.SchemaField({
      diceNum: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      diceSize: new fields.StringField({ initial: 'd20' }),
      diceBonus: new fields.StringField({ initial: '+@str.mod+ceil(@lvl / 2)' })
    });

    schema.formula = new fields.StringField({ blank: true });

    return schema;
  }

  /**
   * Prepare derived data for the item.
   * This method calculates the formula based on the roll data.
   */
  prepareDerivedData() {
    // Build the formula dynamically using string interpolation
    const roll = this.roll;

    this.formula = `${roll.diceNum}${roll.diceSize}${roll.diceBonus}`;
  }
}
