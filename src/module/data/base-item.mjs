import DeckOfDestinyDataModel from './base-model.mjs';

/**
 * The DeckOfDestinyItemBase class is an abstract base class for all item types.
 */
export default class DeckOfDestinyItemBase extends DeckOfDestinyDataModel {
  /**
   * Define the schema for the DeckOfDestinyItemBase.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });

    return schema;
  }
}
