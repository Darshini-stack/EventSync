const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      minlength: [3, 'Event title must be at least 3 characters'],
      maxlength: [150, 'Event title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      minlength: [10, 'Event description must be at least 10 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'Technology',
          'Workshop',
          'Seminar',
          'Hackathon',
          'Hackathon / Innovation',
          'Cultural',
          'Sports',
          'College',
          'Other',
        ],
        message: '{VALUE} is not a supported category',
      },
    },
    mode: {
      type: String,
      enum: ['Offline', 'Online', 'Hybrid'],
      default: 'Offline',
    },
    registrationStartDate: {
      type: Date,
      default: null,
    },
    registrationDeadline: {
      type: Date,
      default: null,
    },
    maxTeamSize: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    time: {
      type: String,
      required: [true, 'Event time is required'],
      trim: true,
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    availableSeats: {
      type: Number,
      required: [true, 'Available seats count is required'],
      min: [0, 'Available seats cannot be negative'],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    fee: {
      type: Number,
      default: 0,
      min: [0, 'Fee cannot be negative'],
    },
    prizeMoney: {
      type: Number,
      default: 0,
      min: [0, 'Prize money cannot be negative'],
    },
    participationCertificateAvailable: {
      type: Boolean,
      default: true,
    },
    facultyCoordinatorName: {
      type: String,
      trim: true,
      default: '',
    },
    coordinators: {
      type: [
        {
          coordinatorName: { type: String, trim: true },
          coordinatorPhone: { type: String, trim: true },
        },
      ],
      validate: [
        (val) => val.length <= 3,
        'Cannot have more than 3 coordinators',
      ],
      default: [],
    },
    gradient: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: [
          'DRAFT',
          'PUBLISHED',
          'REGISTRATION_OPEN',
          'REGISTRATION_CLOSED',
          'COMPLETED',
          'CANCELLED',
        ],
        message: '{VALUE} is not a valid event status',
      },
      default: 'DRAFT',
    },
    poster: {
      filename: { type: String, trim: true },
      originalName: { type: String, trim: true },
      path: { type: String, trim: true },
      mimetype: { type: String, trim: true },
      size: { type: Number },
      uploadedAt: { type: Date, default: Date.now },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Event organizer reference (createdBy) is required'],
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
