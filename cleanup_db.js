const path = require('path');
module.paths.push(path.resolve(__dirname, 'server/node_modules'));

const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });
const config = require('./server/src/config/env');

async function cleanDb() {
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;

  await db.collection('events').deleteMany({});
  await db.collection('registrations').deleteMany({});
  await db.collection('payments').deleteMany({});
  await db.collection('tickets').deleteMany({});
  await db.collection('attendances').deleteMany({});
  await db.collection('users').deleteMany({
    email: { $nin: ['admin@eventsync.edu', 'test.student@eventsync.edu', 'aarav.patel@eventsync.edu'] }
  });

  const events = await db.collection('events').countDocuments();
  const registrations = await db.collection('registrations').countDocuments();
  const payments = await db.collection('payments').countDocuments();
  const tickets = await db.collection('tickets').countDocuments();
  const attendances = await db.collection('attendances').countDocuments();
  const users = await db.collection('users').countDocuments();
  const userList = await db.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();

  console.log(JSON.stringify({ events, registrations, payments, tickets, attendances, users, userList }, null, 2));
  await mongoose.disconnect();
}

cleanDb();
