import DeckOfDestinyDataModel from './base-model.mjs';

/**
 * The DeckOfDestinyActorBase class is an abstract base class for all actor types.
 * It extends the DeckOfDestinyDataModel class with actor-specific data and behaviors.
 */
export default class DeckOfDestinyActorBase extends DeckOfDestinyDataModel {
  /**
   * Define the schema for the DeckOfDestinyActorBase.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 10 })
    });
    schema.power = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 5, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 5 })
    });
    schema.biography = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields

    return schema;
  }
}
