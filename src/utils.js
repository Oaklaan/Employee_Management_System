// Inclusive number of days between two dates
function leaveDays(from, to) {
  const d = (new Date(to) - new Date(from)) / 86400000;
  if (isNaN(d) || d < 0) throw new Error('Invalid date range');
  return d + 1;
}
function utcToday() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}
module.exports = { leaveDays, utcToday };
