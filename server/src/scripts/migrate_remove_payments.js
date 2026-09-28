/**
 * migrate_remove_payments.js
 * Safe, idempotent, backward-compatible migration script for EventSync.
 *
 * Requirements:
 * 1. Does NOT drop collections or delete registrations, users, audit logs, or notifications.
 * 2. For every existing registration:
 *    - Backfills a Digital Event Pass (Ticket) if missing (with ES-PASS-XXXXXXXX and EVENTSYNC:PASS:...).
 *    - Backfills Attendance record with status 'NOT_MARKED', markedBy: null, markedAt: null if missing.
 *    - Backfills Certificate record with status 'NOT_ISSUED', issuedAt: null, issuedBy: null, receivedAt: null if missing.
 *    - Guarantees zero duplicate passes, attendance, or certificates.
 * 3. Specifically verifies existing registration: 6aaeb837ca449d8349e9d494 remains intact and valid.
 * 4. Ensures all events have isPaid: false, fee: 0, mode: 'Offline' if not set.
 */

const path = require('path');
module.paths.push(path.resolve(__dirname, '../../node_modules'));
const crypto = require('crypto');
const mongoose = require('mongoose');

const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const Attendance = require('../models/Attendance');
const Certificate = require('../models/Certificate');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventsync';

const generatePassCode = () => {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ES-PASS-${randomHex}`;
};

const runMigration = async () => {
  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('[Migration] Connected to MongoDB database successfully.');

  let passesCreated = 0;
  let attendancesCreated = 0;
  let certificatesCreated = 0;
  let eventsUpdated = 0;

  // 1. Ensure events have isPaid: false, fee: 0
  const events = await Event.find({});
  for (const ev of events) {
    let changed = false;
    if (ev.isPaid !== false) {
      ev.isPaid = false;
      changed = true;
    }
    if (ev.fee !== 0) {
      ev.fee = 0;
      changed = true;
    }
    if (!ev.mode) {
      ev.mode = 'Offline';
      changed = true;
    }
    if (changed) {
      await ev.save();
      eventsUpdated++;
    }
  }
  console.log(`[Migration] Events checked: ${events.length}. Updated: ${eventsUpdated}.`);

  // 2. Iterate all registrations
  const registrations = await Registration.find({}).populate('student').populate('event');
  console.log(`[Migration] Found ${registrations.length} existing registration(s) to inspect.`);

  for (const reg of registrations) {
    const studentId = reg.student?._id || reg.student;
    const eventId = reg.event?._id || reg.event;

    if (!studentId || !eventId) {
      console.warn(`[Migration] Skipping orphan registration ${reg._id}`);
      continue;
    }

    // A. Backfill Digital Event Pass (Ticket) if missing
    let pass = await Ticket.findOne({ registration: reg._id, status: 'ACTIVE' });
    if (!pass) {
      const passCode = generatePassCode();
      const qrPayload = `EVENTSYNC:PASS:${passCode}`;
      pass = await Ticket.create({
        ticketCode: passCode,
        passCode: passCode,
        student: studentId,
        event: eventId,
        registration: reg._id,
        status: 'ACTIVE',
        qrPayload: qrPayload,
        department: reg.department || reg.student?.department || 'CSE',
        year: reg.year || reg.student?.year || '1st Year',
      });
      passesCreated++;
      console.log(`[Migration] Created Digital Event Pass for reg ${reg._id}: ${passCode}`);
    }

    // B. Backfill Attendance with NOT_MARKED if missing
    let att = await Attendance.findOne({ registration: reg._id });
    if (!att) {
      att = await Attendance.create({
        student: studentId,
        event: eventId,
        registration: reg._id,
        ticket: pass?._id || null,
        status: 'NOT_MARKED',
        markedBy: null,
        markedAt: null,
      });
      attendancesCreated++;
      console.log(`[Migration] Created initial Attendance (NOT_MARKED) for reg ${reg._id}`);
    }

    // C. Backfill Certificate with NOT_ISSUED if missing
    let cert = await Certificate.findOne({ registration: reg._id });
    if (!cert) {
      cert = await Certificate.create({
        student: studentId,
        event: eventId,
        registration: reg._id,
        status: 'NOT_ISSUED',
        issuedAt: null,
        issuedBy: null,
        receivedAt: null,
      });
      certificatesCreated++;
      console.log(`[Migration] Created initial Certificate (NOT_ISSUED) for reg ${reg._id}`);
    }
  }

  // 3. Specifically verify existing registration 6aaeb837ca449d8349e9d494
  const targetRegId = '6aaeb837ca449d8349e9d494';
  const targetReg = await Registration.findById(targetRegId);
  if (targetReg) {
    const targetPass = await Ticket.findOne({ registration: targetReg._id });
    const targetAtt = await Attendance.findOne({ registration: targetReg._id });
    const targetCert = await Certificate.findOne({ registration: targetReg._id });
    console.log('---------------------------------------------------------');
    console.log(`[Migration Verification] Existing Registration ${targetRegId}:`);
    console.log(`  - Status:        ${targetReg.status}`);
    console.log(`  - Digital Pass:  ${targetPass ? targetPass.ticketCode || targetPass.passCode : 'MISSING'}`);
    console.log(`  - Attendance:    ${targetAtt ? targetAtt.status : 'MISSING'}`);
    console.log(`  - Certificate:   ${targetCert ? targetCert.status : 'MISSING'}`);
    console.log('---------------------------------------------------------');
  } else {
    console.log(`[Migration Note] Registration ${targetRegId} not present in this DB environment.`);
  }

  console.log(`[Migration Complete] Summary:`);
  console.log(`  - Passes Created:       ${passesCreated}`);
  console.log(`  - Attendances Created:  ${attendancesCreated}`);
  console.log(`  - Certificates Created: ${certificatesCreated}`);
};

if (require.main === module) {
  runMigration()
    .then(async () => {
      console.log('[Migration] Done!');
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Migration Error]', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { runMigration };
