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

    schema.player = new fields.StringField({ required: true, blank: true });
    schema.xp = new fields.SchemaField({
      total: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      spent: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      remaining: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0
      })
    });

    schema.cards = new fields.SchemaField(
      Object.keys(CONFIG.DECK_OF_DESTINY.cards).reduce((obj, card) => {
        obj[card] = new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
          modifier: new fields.NumberField({ ...requiredInteger, initial: 0 })
        });
        return obj;
      }, {})
    );

    schema.attributes = new fields.SchemaField({
      fortune: new fields.SchemaField({
        value: new fields.NumberField({
          ...requiredInteger,
          initial: 0,
          min: 0,
          max: 4
        })
      }),
      power: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
      mitigation: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
      absorption: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      })
    });

    // Iterate over characteristic names and create a new SchemaField for each.
    schema.characteristics = new fields.SchemaField(
      Object.keys(CONFIG.DECK_OF_DESTINY.characteristics).reduce(
        (obj, characteristic) => {
          obj[characteristic] = new fields.SchemaField({
            value: new fields.NumberField({
              ...requiredInteger,
              initial: 0,
              min: 0,
              max: 5
            })
          });
          return obj;
        },
        {}
      )
    );

    return schema;
  }

  /**
   * Prepare derived data for the character.
   * This method calculates characteristic modifiers and localizes characteristic labels.
   */
  prepareDerivedData() {
    // eslint-disable-next-line guard-for-in
    for (const key in this.characteristics) {
      // Handle characteristic label localization.
      this.characteristics[key].label =
        game.i18n.localize(CONFIG.DECK_OF_DESTINY.characteristics[key]) ?? key;
    }
    this.xp.remaining = this.xp.total - this.xp.spent;
  }

  /**
   * Get roll data for the character.
   * This method prepares data for use in roll formulas.
   * @return {Object} The roll data.
   */
  getRollData() {
    const data = {};

    // Copy the characteristic scores to the top level, so that rolls can use
    // formulas like `@bdy.value + 4`.
    if (this.characteristics) {
      for (const [k, v] of Object.entries(this.characteristics)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    return data;
  }
}
