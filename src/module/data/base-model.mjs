/**
 * Extend the base data model to add a custom `toPlainObject` method.
 */
export default class DeckOfDestinyDataModel extends foundry.abstract.TypeDataModel {
  /**
   * Convert the schema to a plain object.
   *
   * The built in `toObject()` method will ignore derived data when using Data Models.
   * This additional method will instead use the spread operator to return a simplified
   * version of the data.
   *
   * @return {object} Plain object either via deepClone or the spread operator.
   */
  toPlainObject() {
    return { ...this };
  }
}
