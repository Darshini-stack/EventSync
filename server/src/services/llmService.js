/**
 * llmService.js
 * Interfaces with LLM APIs (Groq openai/gpt-oss-120b / openai/gpt-oss-20b / qwen/qwen3.8-27b, Google Gemini, OpenAI-compatible)
 * and provides safe, grounded fallback handling with zero fake data.
 *
 * Implements "General AI Assistant + EventSync Assistant":
 * - General knowledge, coding, science, casual conversation handled naturally by configured LLM.
 * - EventSync queries grounded strictly in live MongoDB context.
 * - Strict student privacy isolation.
 * - Verified Creator Card for EventSync creator questions.
 * - Strict Event Matching (NEVER falls back to events[0]).
 */

const { CHAT_SYSTEM_PROMPT } = require('../config/chatPrompt');
const { CREATOR_DATA } = require('../config/creatorConfig');

/**
 * Strips markdown code blocks (e.g. ```json ... ```) from LLM output.
 */
const stripMarkdownFences = (text) => {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
  }
  return cleaned.trim();
};

/**
 * Safely extracts a JSON object from text that may contain extra preamble or reasoning.
 */
const extractJsonObject = (text) => {
  if (!text || typeof text !== 'string') return null;
  const cleaned = stripMarkdownFences(text);

  // 1. Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    // Continue to regex extraction
  }

  // 2. Try regex extraction of first outer JSON object
  const match = cleaned.match(/(\{[\s\S]*\})/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
      // Continue to fallback
    }
  }

  return null;
};

/**
 * Case-insensitive match for an event in a list by title/eventName.
 * Sorts by descending title length to match the most specific event title.
 * NEVER returns events[0] or a random default.
 */
const findMatchingEvent = (query, eventsList) => {
  if (!query || !Array.isArray(eventsList) || eventsList.length === 0) return null;
  const q = String(query).toLowerCase();

  // Sort descending by title length so longer titles match first
  const sorted = [...eventsList].sort((a, b) => {
    const titleA = String(a.eventName || a.title || '').length;
    const titleB = String(b.eventName || b.title || '').length;
    return titleB - titleA;
  });

  // Check full title match in query
  for (const ev of sorted) {
    const title = String(ev.eventName || ev.title || '').trim().toLowerCase();
    if (!title) continue;
    if (q.includes(title)) {
      return ev;
    }
  }

  // Check significant words (3+ characters) for match
  for (const ev of sorted) {
    const title = String(ev.eventName || ev.title || '').trim().toLowerCase();
    if (!title) continue;
    // Extract non-generic words
    const words = title
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 4 && !['event', '2026', 'hackathon', 'competition'].includes(w));
    for (const w of words) {
      if (q.includes(w)) {
        return ev;
      }
    }
  }

  return null;
};

/**
 * Checks if a query is specifically asking about the creator/developer of EventSync.
 * Excludes general knowledge questions about inventions/languages and mixed queries.
 */
const isEventSyncCreatorQuestion = (query) => {
  const q = String(query || '').toLowerCase().trim();

  // General questions or mixed questions that should NOT trigger the creator card
  const isGeneralOrMixedQuery =
    q.includes('telephone') ||
    q.includes('lightbulb') ||
    q.includes('light bulb') ||
    q.includes('computer') ||
    q.includes('electricity') ||
    q.includes('internet') ||
    q.includes('world wide web') ||
    q.includes('python') ||
    q.includes('java') ||
    q.includes('c++') ||
    q.includes('linux') ||
    q.includes('machine learning') ||
    q.includes('ai ') ||
    q.includes('ai?') ||
    q.includes('qr ') ||
    q.includes('qr?') ||
    q.includes('registration') ||
    q.includes('attendance') ||
    q.includes('certificate') ||
    q.includes('deadline') ||
    q.includes('when is') ||
    q.includes('seat');

  if (isGeneralOrMixedQuery) return false;

  // Must explicitly ask who created, developed, made, or built EventSync
  const asksWhoMade =
    q.includes('who created') ||
    q.includes('who developed') ||
    q.includes('who built') ||
    q.includes('who made') ||
    q.includes('who is the creator') ||
    q.includes('who is the developer') ||
    q.includes('creator of') ||
    q.includes('developer of') ||
    q.includes('creator name') ||
    q.includes('developer name') ||
    q.includes('creator details') ||
    q.includes('developer details') ||
    q === 'creator' ||
    q === 'developer' ||
    (q.includes('evaru') &&
      (q.includes('create') || q.includes('develop') || q.includes('chesaru') || q.includes('chestaru')));

  return asksWhoMade;
};

/**
 * Generates safe local fallback responses when the external LLM API is unavailable.
 * Strictly adheres to:
 * - Basic EventSync database questions
 * - Strict student privacy checks
 * - Basic greetings
 * - Creator card for EventSync creator queries
 * - Zero fake data & no silent fallbacks to events[0]
 * Does NOT replace the general LLM with dozens of hardcoded keywords.
 */
const generateLocalFallback = ({
  message,
  userRole = 'STUDENT',
  userData = {},
  adminData = {},
  eventsData = [],
  projectCreatorData = CREATOR_DATA,
}) => {
  const q = String(message || '').toLowerCase().trim();

  // 1. Creator Card (ONLY for EventSync creator / developer questions)
  if (isEventSyncCreatorQuestion(q)) {
    const creator = projectCreatorData || CREATOR_DATA;
    return {
      type: 'invention_card',
      message: `${creator.name || 'Atmakuru Priya Darshini'} is the ${creator.role || 'Creator & Lead Developer'} of ${creator.project || 'EventSync'} from ${creator.college || 'PBR Visvodaya Institute of Technology & Science'}.`,
      subject: creator.project || 'EventSync',
      person: creator.name || 'Atmakuru Priya Darshini',
      role: creator.role || 'Creator & Lead Developer',
      known_for: creator.known_for || 'Architecting and developing EventSync',
      education: creator.education || 'B.Tech in Computer Science and Engineering (CSE)',
      department: creator.department || 'Computer Science and Engineering',
      college: creator.college || 'PBR Visvodaya Institute of Technology & Science',
      interests: creator.interests || 'Software Development, Data Analytics, Full-Stack Web Development',
      year: creator.year || '2026',
      summary: creator.summary || 'Creator and lead developer of EventSync platform.',
      fun_fact: creator.fun_fact || 'Engineered EventSync with real-time sync and custom bilingual AI assistance.',
    };
  }

  // 1b. Image generation refusal (Image generation feature completely removed)
  const isImageGenQuery =
    /\b(?:generate|create|design|draw|paint|sketch|render|synthesize)\b.*\b(?:image|picture|poster|banner|flyer|artwork|visual|photo|illustration|drawing)\b/i.test(q) ||
    /\b(?:make|build)\b.*\b(?:poster|flyer|banner|image|picture)\b/i.test(q) ||
    /\bposter\s+(?:generate|create|cheyyi|kavali|ivvu|ivvandi)\b/i.test(q) ||
    /\b(?:image\s+create\s+cheyyi|image\s+generate\s+cheyyi|poster\s+cheyyi|bomma\s+veyyi)\b/i.test(q) ||
    /\b(?:event\s+ki|event\s+kosam)\s+(?:poster|banner|flyer)\b/i.test(q);

  if (isImageGenQuery) {
    return {
      type: 'text',
      message:
        'Image and poster generation features are not supported in EventSync Assistant. However, I can help you with event details, schedules, registration links, writing promotional copy, or answering any questions you have in text!',
    };
  }

  // 2. Strict Privacy refusal for Student (Isolation Check)
  if (userRole === 'STUDENT') {
    const asksAnotherPerson =
      q.includes('another student') ||
      q.includes('vere student') ||
      q.includes('other student') ||
      q.includes('someone else') ||
      q.includes("someone's") ||
      /\b(rahul|sneha|priya|anusha|harika|john|rohit|kiran|student)['’]?s\b/i.test(q) ||
      /show me .*['’]s (attendance|pass|ticket|registration|certificate)/i.test(q) ||
      /(can you show me|show me|tell me).*(rahul|sneha|priya|anusha|harika|john|rohit|kiran)/i.test(q);

    if (asksAnotherPerson) {
      return {
        type: 'text',
        message:
          "Sorry, sharing another student's private details is strictly prohibited by our privacy policy. Meeru kevalam mee own account registration, attendance & certificate details mathrame access cheyagalaru.",
      };
    }
  }

  // 3. Admin-specific metrics & Live Administrative Context
  if (userRole === 'EVENTADMIN') {
    const allEvents = adminData?.eventsSummary || [];

    // Who registered for an event?
    if (
      q.includes('who registered') ||
      q.includes('registered participants') ||
      q.includes('who is registered') ||
      q.includes('list of students') ||
      q.includes('which students registered') ||
      (q.includes('registered') && q.includes('who'))
    ) {
      const matched = findMatchingEvent(q, allEvents);
      if (matched) {
        const participants = matched.registeredParticipants || [];
        if (participants.length === 0) {
          return {
            type: 'text',
            message: `There are currently no registrations recorded in MongoDB for "${matched.title}".`,
          };
        }
        const listText = participants
          .map(
            (p, idx) =>
              `${idx + 1}. **${p.name}** (${p.rollNumber || 'N/A'}) - ${p.department || 'N/A'}${
                p.isTeam ? ` [Team: ${p.teamName || 'Yes'}]` : ''
              }`
          )
          .join('\n');
        return {
          type: 'text',
          message: `**Registered Participants for ${matched.title}** (${participants.length} total):\n\n${listText}`,
        };
      }

      // Check if user named an event that doesn't exist
      const isAskingSpecific = /who registered for\s+(.+)/i.exec(message);
      if (isAskingSpecific && isAskingSpecific[1]) {
        const queryName = isAskingSpecific[1].replace(/[?.,!]/g, '').trim();
        return {
          type: 'text',
          message: `Event "${queryName}" could not be found in EventSync records.`,
        };
      }

      // If general registration inquiry for admin
      const totalRegs = adminData?.metrics?.totalRegistrations ?? '0';
      return {
        type: 'text',
        message: `**Total Registered Participants**: ${totalRegs} across all events. To see participants for a specific event, please ask: "Who registered for [Event Name]?".`,
      };
    }

    // Attendance breakdown for specific or all events
    if (q.includes('who is present') || q.includes('which students are present') || q.includes('present students')) {
      const matched = findMatchingEvent(q, allEvents);
      if (matched) {
        const present = matched.presentStudents || [];
        if (present.length === 0) {
          return {
            type: 'text',
            message: `Currently, no students are marked present for "${matched.title}".`,
          };
        }
        return {
          type: 'text',
          message: `**Students Present for ${matched.title}** (${present.length}):\n\n${present
            .map((s, i) => `${i + 1}. ${s}`)
            .join('\n')}`,
        };
      }
      const isAskingSpecific = /present (?:for|in)\s+(.+)/i.exec(message);
      if (isAskingSpecific && isAskingSpecific[1]) {
        return {
          type: 'text',
          message: `Event "${isAskingSpecific[1].replace(/[?.,!]/g, '').trim()}" could not be found in EventSync records.`,
        };
      }
    }

    if (q.includes('who is absent') || q.includes('which students are absent') || q.includes('absent students')) {
      const matched = findMatchingEvent(q, allEvents);
      if (matched) {
        const absent = matched.absentStudents || [];
        if (absent.length === 0) {
          return {
            type: 'text',
            message: `Currently, no students are marked absent for "${matched.title}".`,
          };
        }
        return {
          type: 'text',
          message: `**Students Absent for ${matched.title}** (${absent.length}):\n\n${absent
            .map((s, i) => `${i + 1}. ${s}`)
            .join('\n')}`,
        };
      }
    }

    // Team registrations count
    if (q.includes('teams') && (q.includes('how many') || q.includes('registered') || q.includes('count') || q.includes('total'))) {
      const totalTeams = adminData?.metrics?.totalTeams ?? '0';
      const breakdown = allEvents.map((e) => `- **${e.title}**: ${e.teamsCount || 0} team(s)`).join('\n');
      return {
        type: 'text',
        message: `**Team Registrations**:\n\n- **Total Teams Registered**: ${totalTeams}\n\n**Event Breakdown**:\n${
          breakdown || 'No active events.'
        }`,
      };
    }

    // Total registrations overview
    if (q.includes('registration') && (q.includes('total') || q.includes('how many') || q.includes('count'))) {
      const totalRegs = adminData?.metrics?.totalRegistrations ?? '0';
      const totalTeams = adminData?.metrics?.totalTeams ?? '0';
      const totalEvents = adminData?.metrics?.totalEvents ?? (eventsData ? eventsData.length : 0);
      return {
        type: 'text',
        message: `**EventSync Admin Overview**:\n\n- **Total Active Registrations**: ${totalRegs}\n- **Total Teams**: ${totalTeams}\n- **Total Events**: ${totalEvents}\n\nAll metrics are calculated directly from active MongoDB records.`,
      };
    }

    // Live attendance summary
    if (q.includes('attendance') && (q.includes('summary') || q.includes('rate') || q.includes('total') || q.includes('status'))) {
      const att = adminData?.metrics?.attendance;
      if (att) {
        return {
          type: 'text',
          message: `**Live Attendance Summary**:\n\n- **Present**: ${att.present || 0}\n- **Absent**: ${
            att.absent || 0
          }\n- **Not Marked**: ${att.notMarked || 0}\n- **Attendance Rate**: ${att.attendanceRate || '0%'}`,
        };
      }
    }

    // Certificate summary
    if (q.includes('certificate') && (q.includes('summary') || q.includes('status') || q.includes('issued') || q.includes('overview'))) {
      const certs = adminData?.metrics?.certificates;
      if (certs) {
        return {
          type: 'text',
          message: `**Certificate Issuance Summary**:\n\n- **Issued**: ${certs.issued || 0}\n- **Pending / Not Issued**: ${
            certs.notIssued || 0
          }\n- **Received by Students**: ${certs.received || 0}`,
        };
      }
    }
  }

  // 4. Student's own records (strictly from actual MongoDB userData)
  if (userRole === 'STUDENT') {
    // Specific event registration check: "Am I registered for X?"
    const matchedEventInStudentRegs = findMatchingEvent(q, userData?.registrations || []);
    const isAskingRegistrationCheck =
      q.includes('am i registered') ||
      q.includes('registered for') ||
      q.includes('register ayyana') ||
      q.includes('register ayina');

    if (isAskingRegistrationCheck) {
      if (matchedEventInStudentRegs) {
        return {
          type: 'text',
          message: `Yes! You are registered for **${matchedEventInStudentRegs.eventName}** (Status: **${matchedEventInStudentRegs.status}**). Registration Code: \`${matchedEventInStudentRegs.rollNumber || 'Active'}\`.`,
        };
      }
      // Check if event exists in published events
      const eventInDb = findMatchingEvent(q, eventsData);
      if (eventInDb) {
        return {
          type: 'text',
          message: `You are not currently registered for **${eventInDb.eventName || eventInDb.title}**. You can register from the Events page before the deadline!`,
        };
      }
      // If asking about a specific named event that wasn't found
      const matchName = /(?:for|in)\s+([a-zA-Z0-9\s]+?)(?:\?|$)/i.exec(message);
      if (matchName && matchName[1] && matchName[1].trim().length > 3) {
        return {
          type: 'text',
          message: `Could not find event "${matchName[1].trim()}" in EventSync.`,
        };
      }
    }

    // Attendance queries
    if (q.includes('attendance') || q.includes('present') || q.includes('absent')) {
      const matchedAtt = findMatchingEvent(q, userData?.attendance || []);
      if (matchedAtt) {
        return {
          type: 'text',
          message: `Mee attendance for **${matchedAtt.eventName}**: **${matchedAtt.status || 'NOT_MARKED'}**.`,
        };
      }
      if (userData && Array.isArray(userData.attendance) && userData.attendance.length > 0) {
        const attList = userData.attendance
          .map((a) => `- **${a.eventName}**: **${a.status || 'NOT_MARKED'}**`)
          .join('\n');
        return {
          type: 'text',
          message: `Mee live attendance status:\n\n${attList}\n\nAttendance updates admin verify chesaka automatic ga mee dashboard lo reflect avutayi.`,
        };
      }
      return {
        type: 'text',
        message: 'Mee attendance records inka levu leda **NOT_MARKED** ga unnai. Event conduction rojuna EventAdmin attendance verify chestaru.',
      };
    }

    // Certificate queries
    if (q.includes('certificate')) {
      const matchedCert = findMatchingEvent(q, userData?.certificates || []);
      if (matchedCert) {
        return {
          type: 'text',
          message: `Mee certificate status for **${matchedCert.eventName}**: **${matchedCert.status || 'NOT_ISSUED'}**.`,
        };
      }
      if (userData && Array.isArray(userData.certificates) && userData.certificates.length > 0) {
        const certList = userData.certificates
          .map((c) => `- **${c.eventName}**: **${c.status || 'NOT_ISSUED'}**`)
          .join('\n');
        return {
          type: 'text',
          message: `Mee certificate status:\n\n${certList}\n\nAdmin certificates issue chesaka, mee dashboard lo **Confirm Receipt** click chesi confirm cheyavachu.`,
        };
      }
      return {
        type: 'text',
        message: 'Mee certificates inka issue avaledu (status: **NOT_ISSUED**). Event complete ayyaka admin verify chesi certificates issue chestaru.',
      };
    }

    // Registered events list
    if (
      q.includes('my registration') ||
      q.includes('registered event') ||
      q.includes('nenu register') ||
      q.includes('register ayina') ||
      q.includes('register ayyana') ||
      (q.includes('events') && q.includes('register'))
    ) {
      if (userData && Array.isArray(userData.registrations) && userData.registrations.length > 0) {
        const regList = userData.registrations
          .map((r) => `- **${r.eventName}** (Roll: **${r.rollNumber || 'Registered'}**, Status: **${r.status}**)`)
          .join('\n');
        return {
          type: 'text',
          message: `Meeru kindi events ki register ayyaru:\n\n${regList}\n\nDigital passes chudadaniki mee dashboard lo Digital Passes tab open cheyandi.`,
        };
      }
      return {
        type: 'text',
        message: 'Meeru inka ye event ki register avvaledu. Events page lo available events chusi register chesukondi!',
      };
    }

    // Digital passes & ticket codes
    if (q.includes('pass') || q.includes('ticket') || q.includes('code')) {
      if (userData && Array.isArray(userData.digitalPasses) && userData.digitalPasses.length > 0) {
        const passList = userData.digitalPasses
          .map((p) => `- **${p.eventName}**: Pass Code \`${p.passCode}\` (${p.status})`)
          .join('\n');
        return {
          type: 'text',
          message: `Mee Digital Passes:\n\n${passList}\n\nEvent venue daggara entry kosam ee QR pass ni chupinchandi.`,
        };
      }
      return {
        type: 'text',
        message: 'Meku inka active digital passes levu. Event ki register ayyaka automatic ga pass generate avutundi.',
      };
    }
  }

  // 5. Events Data (strictly from actual MongoDB eventsData)
  if (Array.isArray(eventsData) && eventsData.length > 0) {
    // Check if user is asking for list of all available events
    if (
      q.includes('what events') ||
      q.includes('available events') ||
      q.includes('list of events') ||
      q.includes('upcoming events') ||
      q === 'events' ||
      q === 'events available'
    ) {
      const list = eventsData
        .map(
          (e, idx) =>
            `${idx + 1}. **${e.eventName}** — Date: ${
              e.date ? new Date(e.date).toLocaleDateString('en-IN') : 'TBA'
            } | Seats Left: **${e.seatsLeft ?? e.capacity}** | Venue: ${e.venue || 'College Campus'}`
        )
        .join('\n');
      return {
        type: 'text',
        message: `**Available Events in EventSync** (${eventsData.length} events):\n\n${list}`,
      };
    }

    // Specific event queries (Never default to eventsData[0]!)
    const matchedEvent = findMatchingEvent(q, eventsData);

    if (q.includes('deadline') || q.includes('last date') || q.includes('close')) {
      if (matchedEvent) {
        if (matchedEvent.registrationDeadline) {
          const d = new Date(matchedEvent.registrationDeadline);
          const formatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
          return {
            type: 'text',
            message: `**${matchedEvent.eventName}** registration deadline: **${formatted}**. Deadline taruvatha registrations close aipothayi.`,
          };
        }
        return {
          type: 'text',
          message: `Registration deadline details are not specified for "${matchedEvent.eventName}".`,
        };
      }

      // If specific event was asked for but not found
      const matchSpecific = /(?:for|of)\s+([a-zA-Z0-9\s]+?)(?:\?|$)/i.exec(message);
      if (matchSpecific && matchSpecific[1]) {
        return {
          type: 'text',
          message: `Could not find event "${matchSpecific[1].trim()}" in EventSync.`,
        };
      }
    }

    if (q.includes('coordinator') || q.includes('contact') || (q.includes('phone') && !q.includes('telephone'))) {
      if (matchedEvent) {
        if (Array.isArray(matchedEvent.coordinators) && matchedEvent.coordinators.length > 0) {
          const coords = matchedEvent.coordinators
            .filter((c) => c.name)
            .map((c, i) => `${i + 1}. **${c.name}**${c.phone ? ` (📞 ${c.phone})` : ''}`)
            .join('\n');
          return {
            type: 'text',
            message: `**${matchedEvent.eventName}** coordinators:\n\n${coords}${
              matchedEvent.facultyCoordinatorName
                ? `\n\nFaculty Coordinator: **${matchedEvent.facultyCoordinatorName}**`
                : ''
            }`,
          };
        }
        return {
          type: 'text',
          message: `Coordinator contact details are not available for "${matchedEvent.eventName}".`,
        };
      }

      const matchSpecific = /(?:for|of)\s+([a-zA-Z0-9\s]+?)(?:\?|$)/i.exec(message);
      if (matchSpecific && matchSpecific[1]) {
        return {
          type: 'text',
          message: `Could not find event "${matchSpecific[1].trim()}" in EventSync.`,
        };
      }
    }

    if (q.includes('seat') || q.includes('capacity') || q.includes('seats left') || q.includes('available seats')) {
      if (matchedEvent) {
        return {
          type: 'text',
          message: `**${matchedEvent.eventName}**: Total capacity is **${matchedEvent.capacity || 0}**, and currently **${
            matchedEvent.seatsLeft ?? 0
          } seats are available**.`,
        };
      }
      const matchSpecific = /(?:for|in)\s+([a-zA-Z0-9\s]+?)(?:\?|$)/i.exec(message);
      if (matchSpecific && matchSpecific[1]) {
        return {
          type: 'text',
          message: `Could not find event "${matchSpecific[1].trim()}" in EventSync.`,
        };
      }
    }

    // General question about a specific event (e.g. "When is MindSprint?", "Tell me about Hackathon")
    if (matchedEvent) {
      const d = matchedEvent.date ? new Date(matchedEvent.date).toLocaleDateString('en-IN') : 'TBA';
      return {
        type: 'text',
        message: `**${matchedEvent.eventName}**:\n\n- **Date**: ${d}\n- **Venue**: ${
          matchedEvent.venue || 'TBA'
        }\n- **Mode**: ${matchedEvent.mode || 'Offline'}\n- **Seats Left**: ${
          matchedEvent.seatsLeft ?? matchedEvent.capacity
        }\n- **Category**: ${matchedEvent.category || 'General'}\n\n${matchedEvent.description || ''}`,
      };
    }
  }

  // 6. Conversational Greetings
  if (
    q === 'hi' ||
    q === 'hello' ||
    q === 'hey' ||
    q === 'namaste' ||
    q === 'namaskaram' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.startsWith('hey ')
  ) {
    return {
      type: 'text',
      message:
        'Namaste! Nenu **EventSync Assistant** 🤖. College events, registrations, attendance, certificates, deadlines, or general knowledge gurinchi nannu adagochu. Ela help cheyagalanu?',
    };
  }

  // 7. Safe Fallback for offline mode
  // If the query is an event-seeking question that couldn't be found
  const eventMatchAttempt = /(?:when is|deadline for|seats in|about|coordinator for)\s+([a-zA-Z0-9\s]+?)(?:\?|$)/i.exec(message);
  if (eventMatchAttempt && eventMatchAttempt[1] && eventMatchAttempt[1].trim().length > 2) {
    return {
      type: 'text',
      message: `Could not find event "${eventMatchAttempt[1].trim()}" in the EventSync database. Please check the available events list.`,
    };
  }

  // Helpful offline fallback informing user that AI cloud is currently in local mode
  return {
    type: 'text',
    message:
      'I am currently operating in local offline mode without an active cloud AI connection. In this mode, I can provide EventSync event schedules, your registrations, attendance, and certificates. For general AI answers, coding, and explanations, please ensure the external LLM service is connected.',
  };
};

/**
 * Main chat generation function with Groq integration and reliable JSON output.
 * Gives the LLM full ability to handle general questions, coding, explanations, and conversation,
 * while anchoring EventSync questions in verified MongoDB data.
 */
const generateChatResponse = async ({
  message,
  history = [],
  userRole = 'STUDENT',
  userData = {},
  adminData = {},
  eventsData = [],
  projectCreatorData = CREATOR_DATA,
}) => {
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  // If no external API key, use the safe database-grounded local fallback
  if (!apiKey || apiKey === 'your_llm_api_key_here' || apiKey.trim() === '') {
    return generateLocalFallback({ message, userRole, userData, adminData, eventsData, projectCreatorData });
  }

  // Assemble contextual system prompt with token-efficient data injection
  const roleContext =
    userRole === 'EVENTADMIN'
      ? `[USER_ROLE]\nEVENTADMIN\n\n[ADMIN_DATA]\n${JSON.stringify(adminData)}`
      : `[USER_ROLE]\nSTUDENT\n\n[USER_DATA]\n${JSON.stringify(userData)}`;

  const fullSystemPrompt = `${CHAT_SYSTEM_PROMPT}

${roleContext}

[PROJECT_CREATOR_DATA]
${JSON.stringify(projectCreatorData)}

[EVENTS_DATA]
${JSON.stringify(eventsData)}`;

  // Keep latest 10 messages for context window
  const trimmedHistory = Array.isArray(history) ? history.slice(-10) : [];

  try {
    let rawResponse = '';

    // Check if Google Gemini key
    if (apiKey.startsWith('AIza') || process.env.GEMINI_API_KEY) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const contents = [
        {
          role: 'user',
          parts: [{ text: `${fullSystemPrompt}\n\nStart conversation.` }],
        },
        {
          role: 'model',
          parts: [{ text: '{"type":"text","message":"Namaste! Nenu EventSync Assistant. Ela help cheyagalanu?"}' }],
        },
      ];

      for (const msg of trimmedHistory) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.content || '') }],
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: String(message) }],
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) rawResponse = candidate;
      }
    } else {
      // Groq OpenAI-compatible endpoint
      const messages = [
        { role: 'system', content: fullSystemPrompt },
        ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ];

      const callGroq = async (modelName) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.3,
            max_completion_tokens: 800,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // If rate limited on this model, check if we can switch model or wait and retry
        if (res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || '';
          console.warn(`[LLMService] Rate limited (429) on ${modelName}:`, errMsg);

          // Try fallback model on Groq first (has its own separate TPM bucket)
          const fallbackModels = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'].filter((m) => m !== modelName);
          for (const fallbackModel of fallbackModels) {
            console.log(`[LLMService] Attempting immediate fallback to ${fallbackModel}...`);
            const fallbackCtrl = new AbortController();
            const fallbackTimeoutId = setTimeout(() => fallbackCtrl.abort(), 20000);
            const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: fallbackModel,
                messages,
                temperature: 0.3,
                max_completion_tokens: 800,
                response_format: { type: 'json_object' },
              }),
              signal: fallbackCtrl.signal,
            });
            clearTimeout(fallbackTimeoutId);
            if (fallbackRes.ok) return fallbackRes;
          }

          // If still rate limited across models, extract wait delay and retry
          const matchSeconds = errMsg.match(/try again in\s+(\d+(?:\.\d+)?)\s*s/i);
          const waitMs = matchSeconds ? Math.ceil(parseFloat(matchSeconds[1]) * 1000) + 600 : 5500;
          console.log(`[LLMService] Waiting ${waitMs}ms before retry...`);
          await new Promise((r) => setTimeout(r, Math.min(waitMs, 7500)));

          const retryCtrl = new AbortController();
          const retryTimeoutId = setTimeout(() => retryCtrl.abort(), 20000);
          res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages,
              temperature: 0.3,
              max_completion_tokens: 800,
              response_format: { type: 'json_object' },
            }),
            signal: retryCtrl.signal,
          });
          clearTimeout(retryTimeoutId);
        }

        return res;
      };

      // Try primary model (openai/gpt-oss-120b)
      let res = await callGroq('openai/gpt-oss-120b');

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) rawResponse = content;
      } else {
        const errText = await res.text().catch(() => '');
        console.warn('[LLMService] Groq API response not OK:', res.status, errText);
      }
    }

    if (rawResponse) {
      const parsed = extractJsonObject(rawResponse);
      if (parsed) {
        // Ensure type exists
        if (!parsed.type) {
          parsed.type = 'text';
        }
        // If type is text but message is missing, fallback to stringifying or string property
        if (parsed.type === 'text' && !parsed.message) {
          parsed.message = parsed.answer || parsed.response || JSON.stringify(parsed);
        }
        return parsed;
      }

      // If raw text wasn't valid JSON, return cleaned text wrapped in text object
      const cleaned = stripMarkdownFences(rawResponse);
      return {
        type: 'text',
        message: cleaned,
      };
    }

    // Fallback to local answering if external API returned empty response
    return generateLocalFallback({ message, userRole, userData, adminData, eventsData, projectCreatorData });
  } catch (apiErr) {
    console.warn('[LLMService] API call failed, using safe fallback:', apiErr.message);
    return generateLocalFallback({ message, userRole, userData, adminData, eventsData, projectCreatorData });
  }
};

module.exports = {
  generateChatResponse,
  generateLocalFallback,
  stripMarkdownFences,
  extractJsonObject,
  findMatchingEvent,
};
