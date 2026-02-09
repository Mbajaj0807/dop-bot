const state = new Map();

/*
state.get(telegramUserId) = {
  step: "WAIT_EMAIL" | "WAIT_PASSWORD" | "WAIT_REASON",
  tempEmail?: string
}
*/

module.exports = {
  get: id => state.get(id),
  set: (id, data) => state.set(id, data),
  clear: id => state.delete(id)
};
