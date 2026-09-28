const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const Attendance = require('../models/Attendance');
const Certificate = require('../models/Certificate');
const Ticket = require('../models/Ticket');

const seedDemoEvent = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventsync';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB.');

    // 1. Find an admin user to be creator if needed
    let admin = await User.findOne({ role: 'EVENTADMIN' });
    if (!admin) {
      admin = await User.findOne();
    }

    // 2. Identify all potential "Smart India Hackathon 2026" duplicate events
    const matchingEvents = await Event.find({
      title: { $regex: /Smart\s*India\s*Hackathon\s*2026/i },
    }).sort({ createdAt: 1 });

    console.log(`[Seed] Found ${matchingEvents.length} event(s) matching "Smart India Hackathon 2026".`);

    let primaryEvent = null;
    const PRIMARY_ID = '6aaeb6fcca449d8349e9d3d7';

    // Check if designated primary ID exists
    const designated = matchingEvents.find((e) => e._id.toString() === PRIMARY_ID);
    if (designated) {
      primaryEvent = designated;
    } else if (matchingEvents.length > 0) {
      // Find event with the most registrations
      let maxRegs = -1;
      for (const ev of matchingEvents) {
        const c = await Registration.countDocuments({ event: ev._id });
        if (c > maxRegs) {
          maxRegs = c;
          primaryEvent = ev;
        }
      }
    }

    // If duplicate events exist, merge and re-point dependent records
    if (matchingEvents.length > 1 && primaryEvent) {
      console.log(`[Seed] Resolving duplicates... Primary event ID: ${primaryEvent._id}`);
      for (const dup of matchingEvents) {
        if (dup._id.toString() === primaryEvent._id.toString()) continue;

        console.log(`[Seed] Re-pointing dependent records from duplicate ${dup._id} to primary ${primaryEvent._id}...`);
        await Registration.updateMany({ event: dup._id }, { $set: { event: primaryEvent._id } });
        await Attendance.updateMany({ event: dup._id }, { $set: { event: primaryEvent._id } });
        await Certificate.updateMany({ event: dup._id }, { $set: { event: primaryEvent._id } });
        await Ticket.updateMany({ event: dup._id }, { $set: { event: primaryEvent._id } });

        // Safe removal of empty duplicate event
        await Event.findByIdAndDelete(dup._id);
        console.log(`[Seed] Removed redundant duplicate event: ${dup._id}`);
      }
    }

    // Standardize event conducting date (future date)
    let eventDate = primaryEvent?.date;
    const now = new Date();
    if (!eventDate || new Date(eventDate) <= now) {
      // Set to future date: 2026-12-09
      eventDate = new Date('2026-12-09T09:00:00.000Z');
    }

    // Registration deadline: approximately 20 days before event date
    const deadlineDate = new Date(new Date(eventDate).getTime() - 20 * 24 * 60 * 60 * 1000);
    deadlineDate.setHours(23, 59, 59, 999);

    const coordinatorsData = [
      { coordinatorName: 'Priya', coordinatorPhone: '9876543210' },
      { coordinatorName: 'Anusha', coordinatorPhone: '9876543211' },
      { coordinatorName: 'Harika', coordinatorPhone: '9876543212' },
    ];

    const eventPayload = {
      title: 'Smart India Hackathon 2026',
      description: 'Smart India Hackathon 2026 is a student innovation event where participants work on real-world problems and develop useful solutions.',
      category: 'Hackathon / Innovation',
      mode: 'Offline',
      venue: 'PBR Visvodaya Institute of Technology & Science',
      capacity: 100,
      fee: 0,
      isPaid: false,
      status: 'PUBLISHED',
      maxTeamSize: 4,
      date: eventDate,
      time: '09:00 AM - 05:00 PM',
      registrationDeadline: deadlineDate,
      prizeMoney: 50000,
      participationCertificateAvailable: true,
      facultyCoordinatorName: 'Dr. K. Ramesh',
      coordinators: coordinatorsData,
      createdBy: admin ? admin._id : (primaryEvent?.createdBy || new mongoose.Types.ObjectId()),
    };

    if (primaryEvent) {
      // Update in place
      primaryEvent.title = eventPayload.title;
      primaryEvent.description = eventPayload.description;
      primaryEvent.category = eventPayload.category;
      primaryEvent.mode = eventPayload.mode;
      primaryEvent.venue = eventPayload.venue;
      primaryEvent.capacity = eventPayload.capacity;
      primaryEvent.fee = 0;
      primaryEvent.isPaid = false;
      primaryEvent.status = 'PUBLISHED';
      primaryEvent.maxTeamSize = 4;
      primaryEvent.date = eventPayload.date;
      primaryEvent.time = eventPayload.time;
      primaryEvent.registrationDeadline = eventPayload.registrationDeadline;
      primaryEvent.prizeMoney = 50000;
      primaryEvent.participationCertificateAvailable = true;
      primaryEvent.facultyCoordinatorName = 'Dr. K. Ramesh';
      primaryEvent.coordinators = coordinatorsData;

      // Calculate seatsLeft accurately from active registrations
      const activeRegs = await Registration.countDocuments({
        event: primaryEvent._id,
        status: 'REGISTERED',
      });
      primaryEvent.availableSeats = Math.max(0, primaryEvent.capacity - activeRegs);

      await primaryEvent.save();
      console.log(`[Seed] Updated existing primary event ${primaryEvent._id} in place.`);
    } else {
      // Create primary if none existed with designated PRIMARY_ID
      const activeRegs = await Registration.countDocuments({
        event: PRIMARY_ID,
        status: 'REGISTERED',
      });
      eventPayload._id = new mongoose.Types.ObjectId(PRIMARY_ID);
      eventPayload.availableSeats = Math.max(0, eventPayload.capacity - activeRegs);
      primaryEvent = await Event.create(eventPayload);
      console.log(`[Seed] Created new primary event: ${primaryEvent._id} (Available Seats: ${primaryEvent.availableSeats})`);
    }

    const activeRegCount = await Registration.countDocuments({
      event: primaryEvent._id,
      status: 'REGISTERED',
    });

    console.log('[Seed] Smart India Hackathon 2026 status:');
    console.log({
      id: primaryEvent._id.toString(),
      title: primaryEvent.title,
      mode: primaryEvent.mode,
      venue: primaryEvent.venue,
      date: primaryEvent.date,
      registrationDeadline: primaryEvent.registrationDeadline,
      capacity: primaryEvent.capacity,
      activeRegistrations: activeRegCount,
      availableSeats: primaryEvent.availableSeats,
      prizeMoney: primaryEvent.prizeMoney,
      participationCertificateAvailable: primaryEvent.participationCertificateAvailable,
      facultyCoordinatorName: primaryEvent.facultyCoordinatorName,
      coordinators: primaryEvent.coordinators,
      status: primaryEvent.status,
    });

    await mongoose.disconnect();
    console.log('[Seed] Done successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDemoEvent();
}

module.exports = { seedDemoEvent };
