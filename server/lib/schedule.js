'use strict';

/**
 * Appointment status model
 *   pending   → requested online, waiting for the studio to confirm
 *   confirmed → on the books
 *   in_chair  → client is seated
 *   completed → done
 *   cancelled / no_show
 */
const STATUSES = ['pending', 'confirmed', 'in_chair', 'completed', 'cancelled', 'no_show'];
const ACTIVE = ['pending', 'confirmed', 'in_chair'];
const BLOCKING = ['pending', 'confirmed', 'in_chair', 'completed'];

/** Do two [start, end) ranges overlap? */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Work out the bookable grid for one stylist on one date.
 * @param {object} p
 * @param {Array} p.appointments      rows with time, end_time, status
 * @param {Object|null} p.availability { is_working, start_time, end_time, break_start, break_end }
 * @param {Object} p.settings         { slot_interval_minutes, lead_time_minutes, max_advance_days }
 * @param {number} p.duration         requested service duration in minutes
 * @param {string} p.date             'YYYY-MM-DD'
 * @param {string} p.nowDate          salon today 'YYYY-MM-DD'
 * @param {string} p.nowTime          salon now 'HH:MM'
 */
function buildSlots({ appointments, availability, settings, duration, date, nowDate, nowTime }) {
  const { toMinutes, fromMinutes } = require('./time');
  const interval = settings.slot_interval_minutes || 30;
  const lead = settings.lead_time_minutes || 0;

  if (!availability || !availability.is_working) {
    return { slots: [], is_working: false, message: 'The studio is closed on this day.' };
  }

  const open = toMinutes(availability.start_time);
  const close = toMinutes(availability.end_time);
  const breakStart = availability.break_start ? toMinutes(availability.break_start) : null;
  const breakEnd = availability.break_end ? toMinutes(availability.break_end) : null;

  const taken = (appointments || [])
    .filter((a) => BLOCKING.includes(a.status))
    .map((a) => [toMinutes(a.time), toMinutes(a.end_time)]);

  const earliest = date === nowDate ? toMinutes(nowTime) + lead : 0;

  const slots = [];
  for (let start = open; start + duration <= close; start += interval) {
    const end = start + duration;
    const conflictAppt = taken.some(([s, e]) => overlaps(start, end, s, e));
    const conflictBreak = breakStart !== null && breakEnd !== null && overlaps(start, end, breakStart, breakEnd);
    const tooSoon = start < earliest;
    slots.push({
      time: fromMinutes(start),
      end_time: fromMinutes(end),
      available: !conflictAppt && !conflictBreak && !tooSoon,
      reason: tooSoon ? 'too_soon' : conflictAppt ? 'booked' : conflictBreak ? 'break' : null,
    });
  }

  return {
    slots,
    is_working: true,
    start_time: availability.start_time,
    end_time: availability.end_time,
    break_start: availability.break_start,
    break_end: availability.break_end,
  };
}

module.exports = { STATUSES, ACTIVE, BLOCKING, overlaps, buildSlots };
