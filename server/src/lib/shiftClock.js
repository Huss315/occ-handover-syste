// Works out which shift is on right now, using the operations centre's clock
// rather than the server's (Heroku runs in UTC).
//
//   Morning    07:00 - 14:59
//   Afternoon  15:00 - 22:59
//   Night      23:00 - 06:59  (belongs to the date it started on)

const SHIFT_ORDER = ['Morning', 'Afternoon', 'Night'];

const SHIFT_START_LABELS = {
  Morning: '7:00 AM',
  Afternoon: '3:00 PM',
  Night: '11:00 PM',
};

function localParts(now) {
  const timeZone = process.env.SHIFT_TIMEZONE || 'Asia/Bahrain';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

function getCurrentSlot(now = new Date()) {
  const { year, month, day, hour } = localParts(now);

  let shiftName;
  let dayOffset = 0;
  if (hour < 7) {
    // After midnight is still the night shift of the day before
    shiftName = 'Night';
    dayOffset = -1;
  } else if (hour < 15) {
    shiftName = 'Morning';
  } else if (hour < 23) {
    shiftName = 'Afternoon';
  } else {
    shiftName = 'Night';
  }

  const shiftDate = new Date(Date.UTC(year, month - 1, day + dayOffset));
  const nextShiftName = SHIFT_ORDER[(SHIFT_ORDER.indexOf(shiftName) + 1) % SHIFT_ORDER.length];

  return {
    shiftName,
    shiftDate,
    dateStr: shiftDate.toISOString().split('T')[0],
    startsAt: SHIFT_START_LABELS[shiftName],
    nextShiftName,
    nextStartsAt: SHIFT_START_LABELS[nextShiftName],
  };
}

function isCurrentSlot(session, shiftName, slot = getCurrentSlot()) {
  return shiftName === slot.shiftName && session.shiftDate.getTime() === slot.shiftDate.getTime();
}

function slotRank(date, shiftName) {
  return new Date(date).getTime() + SHIFT_ORDER.indexOf(shiftName);
}

// The Notes and Temp Tasks screens only list items from the last 3 days onward.
// Older rows stay in the database for reports.
const LIST_DAYS_BACK = 3;

function getListCutoffDate(slot = getCurrentSlot()) {
  return new Date(slot.shiftDate.getTime() - LIST_DAYS_BACK * 24 * 60 * 60 * 1000);
}

// Notes and temp tasks: what is still coming goes first, closest at the top.
// Delivered or missed items follow, most recent first.
function sortScheduledItems(items, slot = getCurrentSlot()) {
  const currentRank = slotRank(slot.shiftDate, slot.shiftName);
  const rankOf = (item) => slotRank(item.targetDate, item.targetShift?.name);
  const isUpcoming = (item) => !item.isDelivered && rankOf(item) >= currentRank;

  const upcoming = items.filter(isUpcoming).sort((a, b) => rankOf(a) - rankOf(b) || a.id - b.id);
  const old = items.filter((item) => !isUpcoming(item)).sort((a, b) => rankOf(b) - rankOf(a) || b.id - a.id);
  return [...upcoming, ...old];
}

module.exports = { SHIFT_ORDER, getCurrentSlot, isCurrentSlot, getListCutoffDate, sortScheduledItems };
