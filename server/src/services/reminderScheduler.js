const Event = require('../models/Event');
const Registration = require('../models/Registration');
const notificationService = require('./notificationService');

let intervalId = null;

/**
 * Checks for upcoming published events and generates 24h & 1h reminders for registered students.
 * Idempotency is strictly guaranteed via dedupeKey (EVENT_REMINDER_24H:<eventId>:<studentId>).
 *
 * Timezone note:
 * All comparisons are performed on absolute UTC timestamps (epoch ms). Event dates stored
 * in MongoDB as UTC Dates are compared against UTC ranges without local timezone skew.
 */
const checkAndSendReminders = async (now = new Date()) => {
  try {
    const currentMs = now.getTime();

    // 1. 24-Hour Reminder Window: [23h, 25h] ahead of now
    const win24Start = new Date(currentMs + 23 * 60 * 60 * 1000);
    const win24End = new Date(currentMs + 25 * 60 * 60 * 1000);

    // 2. 1-Hour Reminder Window: [45m, 75m] ahead of now
    const win1Start = new Date(currentMs + 45 * 60 * 1000);
    const win1End = new Date(currentMs + 75 * 60 * 1000);

    // Find active PUBLISHED events falling into either window
    const [events24h, events1h] = await Promise.all([
      Event.find({
        status: 'PUBLISHED',
        date: { $gte: win24Start, $lte: win24End },
      }).lean(),
      Event.find({
        status: 'PUBLISHED',
        date: { $gte: win1Start, $lte: win1End },
      }).lean(),
    ]);

    // Process 24-hour reminders
    for (const event of events24h) {
      const activeRegs = await Registration.find({
        event: event._id,
        status: 'REGISTERED',
      }).lean();

      for (const reg of activeRegs) {
        const dedupeKey = `EVENT_REMINDER_24H:${event._id}:${reg.student}`;
        await notificationService.createNotification({
          recipient: reg.student,
          type: 'EVENT_REMINDER_24H',
          title: `Upcoming Event Reminder (24h): ${event.title}`,
          message: `Reminder: "${event.title}" is scheduled for tomorrow at ${event.venue || 'the campus venue'}${event.time ? ` (${event.time})` : ''}.`,
          event: event._id,
          registration: reg._id,
          dedupeKey,
        });
      }
    }

    // Process 1-hour reminders
    for (const event of events1h) {
      const activeRegs = await Registration.find({
        event: event._id,
        status: 'REGISTERED',
      }).lean();

      for (const reg of activeRegs) {
        const dedupeKey = `EVENT_REMINDER_1H:${event._id}:${reg.student}`;
        await notificationService.createNotification({
          recipient: reg.student,
          type: 'EVENT_REMINDER_1H',
          title: `Event Starting Soon (1h): ${event.title}`,
          message: `Get ready! "${event.title}" starts in approximately 1 hour at ${event.venue || 'the campus venue'}.`,
          event: event._id,
          registration: reg._id,
          dedupeKey,
        });
      }
    }

    // 3. Registration Deadline Passed: notify registered students
    const eventsClosed = await Event.find({
      status: 'PUBLISHED',
      registrationDeadline: { $lte: now, $ne: null },
    }).lean();

    for (const event of eventsClosed) {
      const activeRegs = await Registration.find({
        event: event._id,
        status: 'REGISTERED',
      }).lean();

      for (const reg of activeRegs) {
        const dedupeKey = `REGISTRATION_CLOSED:${event._id}:${reg.student}`;
        await notificationService.createNotification({
          recipient: reg.student,
          type: 'REGISTRATION_CLOSED',
          title: 'Registration Closed',
          message: `Registration for ${event.title} is now closed.`,
          event: event._id,
          registration: reg._id,
          dedupeKey,
        });
      }
    }
  } catch (err) {
    console.warn('[ReminderScheduler] Error running reminder checks:', err.message);
  }
};

const startReminderScheduler = (intervalMs = 60000) => {
  if (intervalId) clearInterval(intervalId);
  console.log(`[ReminderScheduler] Starting automated event reminder worker (interval: ${intervalMs}ms)`);
  intervalId = setInterval(() => {
    checkAndSendReminders().catch((e) => console.warn('[ReminderScheduler] Tick error:', e.message));
  }, intervalMs);
};

const stopReminderScheduler = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[ReminderScheduler] Stopped automated event reminder worker.');
  }
};

module.exports = {
  checkAndSendReminders,
  startReminderScheduler,
  stopReminderScheduler,
};
