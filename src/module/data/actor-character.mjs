import DeckOfDestinyActorBase from './base-actor.mjs';

/**
 * The DeckOfDestinyCharacter class extends the DeckOfDestinyActorBase class with
 * character-specific data and behaviors.
 */
export default class DeckOfDestinyCharacter extends DeckOfDestinyActorBase {
  /**
   * Define the schema for the DeckOfDestinyCharacter.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.player = new fields.StringField({ required: false, blank: true });
    schema.xp = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    schema.cards = new fields.SchemaField({
      success: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      failure: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      issue: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      fortune: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      destiny: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.attributes = new fields.SchemaField({
      level: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 1 })
      })
    });

    // Iterate over ability names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(
      Object.keys(CONFIG.DECK_OF_DESTINY.abilities).reduce((obj, ability) => {
        obj[ability] = new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 })
        });
        return obj;
      }, {})
    );

    return schema;
  }

  /**
   * Prepare derived data for the character.
   * This method calculates ability modifiers and localizes ability labels.
   */
  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    // eslint-disable-next-line guard-for-in
    for (const key in this.abilities) {
      // Calculate the modifier using d20 rules.
      this.abilities[key].mod = Math.floor((this.abilities[key].value - 10) / 2);
      // Handle ability label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.DECK_OF_DESTINY.abilities[key]) ?? key;
    }
  }

  /**
   * Get roll data for the character.
   * This method prepares data for use in roll formulas.
   * @return {Object} The roll data.
   */
  getRollData() {
    const data = {};

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (this.abilities) {
      for (const [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.lvl = this.attributes.level.value;

    return data;
  }
}
