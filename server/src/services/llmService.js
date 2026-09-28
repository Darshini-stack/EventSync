/**
 * llmService.js
 * Interfaces with LLM APIs (Groq openai/gpt-oss-120b, OpenAI-compatible, Google Gemini)
 * and provides safe, grounded fallback handling with zero fake data.
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
 * Generates intelligent rule-based / database-grounded response when offline or LLM key is absent.
 * Strictly adheres to ZERO FAKE DATA: No invented dates, numbers, phones, or fake inventions.
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
  const isGeneralKnowledgeQuestion =
    q.includes('python') ||
    q.includes('java') ||
    q.includes('c++') ||
    q.includes('telephone') ||
    q.includes('lightbulb') ||
    q.includes('light bulb') ||
    q.includes('computer') ||
    q.includes('electricity') ||
    q.includes('internet') ||
    q.includes('world wide web') ||
    q.includes('relativity') ||
    q.includes('gravity') ||
    q.includes('microsoft') ||
    q.includes('google') ||
    q.includes('apple') ||
    q.includes('linux');

  const isCreatorQuestion =
    !isGeneralKnowledgeQuestion &&
    (q.includes('eventsync') ||
      q.includes('this project') ||
      q.includes('this platform') ||
      q.includes('this app') ||
      q === 'who created eventsync' ||
      q === 'who developed eventsync' ||
      q === 'who created eventsync?' ||
      q === 'who developed eventsync?' ||
      q === 'who is the creator' ||
      q === 'who is the creator?' ||
      q === 'who is the developer' ||
      q === 'who is the developer?' ||
      q === 'who created this' ||
      q === 'who created this?' ||
      q === 'who developed this' ||
      q === 'who developed this?' ||
      q === 'who made this' ||
      q === 'who made this?' ||
      q === 'who built this' ||
      q === 'who built this?' ||
      q === 'creator' ||
      q === 'creator details' ||
      q === 'developer' ||
      q === 'developer details' ||
      (q.includes('creator') && !isGeneralKnowledgeQuestion) ||
      (q.includes('developer') && !isGeneralKnowledgeQuestion) ||
      (q.includes('evaru') && (q.includes('eventsync') || q.includes('chatbot') || q.includes('develop') || q.includes('create'))));

  if (isCreatorQuestion) {
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

  // 2. Privacy refusal for Student (Strict Isolation)
  if (userRole === 'STUDENT') {
    const asksAnotherPerson =
      q.includes('another student') ||
      q.includes('vere student') ||
      q.includes('other student') ||
      q.includes("someone else") ||
      q.includes("someone's") ||
      /\b(rahul|sneha|priya|anusha|harika|john|rohit|kiran|student)['’]?s\b/i.test(q) ||
      /show me .*['’]s (attendance|pass|ticket|registration|certificate)/i.test(q) ||
      /(can you show me|show me|tell me).*(rahul|sneha|priya|anusha|harika|john|rohit|kiran)/i.test(q);

    if (asksAnotherPerson) {
      return {
        type: 'text',
        message: 'Sorry, sharing another student\'s private details is strictly prohibited by our privacy policy. Meeru kevalam mee own account registration, attendance & certificate details mathrame access cheyagalaru.',
      };
    }
  }

  // 3. Admin-specific metrics & Live MongoDB Administrative Context
  if (userRole === 'EVENTADMIN') {
    const allEvents = adminData?.eventsSummary || [];

    // Who registered for this event? / Which students registered?
    if (
      q.includes('who registered') ||
      q.includes('registered participants') ||
      q.includes('who is registered') ||
      q.includes('list of students') ||
      q.includes('which students registered') ||
      (q.includes('registered') && q.includes('who'))
    ) {
      if (allEvents.length > 0) {
        const matched = allEvents.find((ev) => q.includes((ev.title || '').toLowerCase())) || allEvents[0];
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
      return {
        type: 'text',
        message: 'No event registration records found in the database.',
      };
    }

    // Which students are present? / Who is present?
    if (
      q.includes('who is present') ||
      q.includes('which students are present') ||
      q.includes('present students') ||
      (q.includes('present') && (q.includes('who') || q.includes('which')))
    ) {
      if (allEvents.length > 0) {
        const matched = allEvents.find((ev) => q.includes((ev.title || '').toLowerCase())) || allEvents[0];
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
    }

    // Who is absent? / Which students are absent?
    if (
      q.includes('who is absent') ||
      q.includes('which students are absent') ||
      q.includes('absent students') ||
      (q.includes('absent') && (q.includes('who') || q.includes('which')))
    ) {
      if (allEvents.length > 0) {
        const matched = allEvents.find((ev) => q.includes((ev.title || '').toLowerCase())) || allEvents[0];
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

    // Who is not marked? / Which students are not marked?
    if (q.includes('not marked') || q.includes('unmarked')) {
      if (allEvents.length > 0) {
        const matched = allEvents.find((ev) => q.includes((ev.title || '').toLowerCase())) || allEvents[0];
        const notMarked = matched.notMarkedStudents || [];
        if (notMarked.length === 0) {
          return {
            type: 'text',
            message: `All registered attendees have been marked for "${matched.title}".`,
          };
        }
        return {
          type: 'text',
          message: `**Attendees Not Marked for ${matched.title}** (${notMarked.length}):\n\n${notMarked
            .map((s, i) => `${i + 1}. ${s}`)
            .join('\n')}`,
        };
      }
    }

    // Which certificates are issued?
    if (
      (q.includes('which certificates') && q.includes('issued')) ||
      q.includes('certificates are issued') ||
      q.includes('issued certificates')
    ) {
      if (allEvents.length > 0) {
        const matched = allEvents.find((ev) => q.includes((ev.title || '').toLowerCase())) || allEvents[0];
        const issued = matched.certIssuedStudents || [];
        if (issued.length === 0) {
          return {
            type: 'text',
            message: `No certificates have been issued yet for "${matched.title}".`,
          };
        }
        return {
          type: 'text',
          message: `**Certificates Issued for ${matched.title}** (${issued.length}):\n\n${issued
            .map((s, i) => `${i + 1}. ${s}`)
            .join('\n')}`,
        };
      }
    }

    // Which students received their certificates?
    if (
      q.includes('received their certificates') ||
      q.includes('who received certificates') ||
      q.includes('certificates received') ||
      q.includes('received certificates')
    ) {
      if (allEvents.length > 0) {
        const matched = allEvents.find((ev) => q.includes((ev.title || '').toLowerCase())) || allEvents[0];
        const received = matched.certReceivedStudents || [];
        if (received.length === 0) {
          return {
            type: 'text',
            message: `No students have confirmed receipt of their certificates yet for "${matched.title}".`,
          };
        }
        return {
          type: 'text',
          message: `**Students Who Received Certificates for ${matched.title}** (${received.length}):\n\n${received
            .map((s, i) => `${i + 1}. ${s}`)
            .join('\n')}`,
        };
      }
    }

    // How many teams registered?
    if (q.includes('teams') && (q.includes('how many') || q.includes('registered') || q.includes('count'))) {
      const totalTeams = adminData?.metrics?.totalTeams ?? '0';
      const breakdown = allEvents.map((e) => `- **${e.title}**: ${e.teamsCount || 0} team(s)`).join('\n');
      return {
        type: 'text',
        message: `**Team Registrations**:\n\n- **Total Teams Registered**: ${totalTeams}\n\n**Event Breakdown**:\n${
          breakdown || 'No active events.'
        }`,
      };
    }

    // How many registrations / total registrations
    if (q.includes('registration') || q.includes('total') || q.includes('registered') || q.includes('how many')) {
      const totalRegs = adminData?.metrics?.totalRegistrations ?? '0';
      const totalTeams = adminData?.metrics?.totalTeams ?? '0';
      const totalEvents = adminData?.metrics?.totalEvents ?? (eventsData ? eventsData.length : 0);
      return {
        type: 'text',
        message: `**EventSync Admin Overview**:\n\n- **Total Active Registrations**: ${totalRegs}\n- **Total Teams**: ${totalTeams}\n- **Total Events**: ${totalEvents}\n\nAll metrics are calculated directly from active MongoDB records.`,
      };
    }

    // Attendance summary
    if (q.includes('attendance')) {
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
    if (q.includes('certificate')) {
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

  // 4. Student's own records (strictly from actual MongoDB data)
  if (userRole === 'STUDENT') {
    // Strict privacy protection: Refuse access to another student's pass/attendance/records
    const isRequestingOther =
      /\b(ananya|kiran|sameer|divya|arun|other|someone else|friend|another student)\b/i.test(q) ||
      (/\b(pass|ticket|attendance|records?)\b/i.test(q) && /\b(show|give|get|view|what is)\b/i.test(q) && !/\b(my|mine|me|nenu|naa)\b/i.test(q));

    if (isRequestingOther) {
      return {
        type: 'text',
        message: 'Sorry, due to student privacy policy and security restrictions, I can only provide your own registration, pass, and attendance details. Accessing another student\'s personal records is strictly prohibited.',
      };
    }

    if (q.includes('attendance') || q.includes('present') || q.includes('absent')) {
      if (userData && Array.isArray(userData.attendance) && userData.attendance.length > 0) {
        const attList = userData.attendance
          .map(a => `- **${a.eventName}**: **${a.status || 'NOT_MARKED'}**`)
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

    if (q.includes('certificate')) {
      if (userData && Array.isArray(userData.certificates) && userData.certificates.length > 0) {
        const certList = userData.certificates
          .map(c => `- **${c.eventName}**: **${c.status || 'NOT_ISSUED'}**`)
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
          .map(r => `- **${r.eventName}** (Roll: **${r.rollNumber || 'Registered'}**, Status: **${r.status}**)`)
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

    if (q.includes('pass') || q.includes('ticket')) {
      if (userData && Array.isArray(userData.digitalPasses) && userData.digitalPasses.length > 0) {
        const passList = userData.digitalPasses
          .map(p => `- **${p.eventName}**: Pass Code \`${p.passCode}\` (${p.status})`)
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
    const matchedEvent = eventsData.find(e => q.includes((e.eventName || e.title || '').toLowerCase())) || eventsData[0];

    if (q.includes('deadline') || q.includes('last date') || q.includes('close')) {
      if (matchedEvent && matchedEvent.registrationDeadline) {
        const d = new Date(matchedEvent.registrationDeadline);
        const formatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        return {
          type: 'text',
          message: `**${matchedEvent.eventName}** registration deadline: **${formatted}**. Deadline taruvatha registrations close aipothayi.`,
        };
      }
      return {
        type: 'text',
        message: 'Registration deadline details are not available for this event.',
      };
    }

    if (q.includes('coordinator') || q.includes('contact') || (q.includes('phone') && !q.includes('telephone'))) {
      if (matchedEvent && Array.isArray(matchedEvent.coordinators) && matchedEvent.coordinators.length > 0) {
        const coords = matchedEvent.coordinators
          .filter(c => c.name)
          .map((c, i) => `${i + 1}. **${c.name}**${c.phone ? ` (📞 ${c.phone})` : ''}`)
          .join('\n');
        return {
          type: 'text',
          message: `**${matchedEvent.eventName}** coordinators:\n\n${coords}${matchedEvent.facultyCoordinatorName ? `\n\nFaculty Coordinator: **${matchedEvent.facultyCoordinatorName}**` : ''}`,
        };
      }
      return {
        type: 'text',
        message: 'Coordinator contact details are not available in EventSync right now.',
      };
    }

    if (q.includes('seat') || q.includes('capacity')) {
      if (matchedEvent) {
        return {
          type: 'text',
          message: `**${matchedEvent.eventName}**: Total capacity is **${matchedEvent.capacity || 0}**, and currently **${matchedEvent.seatsLeft ?? 0} seats are available**.`,
        };
      }
    }
  }

  // 6. General Knowledge: Always normal type: "text" (NEVER invention_card)
  if (q.includes('python')) {
    return {
      type: 'text',
      message: '**Python** is a popular high-level, general-purpose programming language created by **Guido van Rossum** and first released in 1991.',
    };
  }
  if (q.includes('java')) {
    return {
      type: 'text',
      message: '**Java** is a class-based, object-oriented programming language created by **James Gosling** at Sun Microsystems and released in 1995.',
    };
  }
  if (q.includes('c++')) {
    return {
      type: 'text',
      message: '**C++** is a general-purpose programming language created by **Bjarne Stroustrup** as an extension of the C programming language in 1979.',
    };
  }
  if (q.includes('telephone')) {
    return {
      type: 'text',
      message: 'The practical telephone was patented by **Alexander Graham Bell** in **1876**. It revolutionized telecommunications by enabling real-time human voice transmission over electrical wires.',
    };
  }
  if (q.includes('light bulb') || q.includes('lightbulb')) {
    return {
      type: 'text',
      message: 'The commercially viable incandescent light bulb was developed by **Thomas Edison** in **1879**, using carbonized filament designs to provide long-lasting practical illumination.',
    };
  }
  if (q.includes('recursion')) {
    return {
      type: 'text',
      message: '**Recursion** is a programming concept where a function calls itself directly or indirectly to solve smaller instances of the same problem. A base condition is required to terminate execution.',
    };
  }

  // 7. Safe Default Unavailable / General greeting
  return {
    type: 'text',
    message: 'Hello! I am **EventSync Assistant**. You can ask me about events, registrations, attendance, certificates, deadlines, or general knowledge. How can I help you today?',
  };
};

/**
 * Main chat generation function with Groq integration and reliable JSON output.
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

  // If no external API key, use the smart rule-based/database-grounded fallback
  if (!apiKey || apiKey === 'your_llm_api_key_here' || apiKey.trim() === '') {
    return generateLocalFallback({ message, userRole, userData, adminData, eventsData, projectCreatorData });
  }

  // Assemble contextual system prompt with real injected MongoDB data and role
  const fullSystemPrompt = `${CHAT_SYSTEM_PROMPT}

[USER_ROLE]
${userRole}

[PROJECT_CREATOR_DATA]
${JSON.stringify(projectCreatorData, null, 2)}

[USER_DATA]
${JSON.stringify(userData, null, 2)}

[ADMIN_DATA]
${JSON.stringify(adminData, null, 2)}

[EVENTS_DATA]
${JSON.stringify(eventsData, null, 2)}`;

  // Keep only latest 10 messages for context window
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
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
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
        ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages,
          temperature: 0.3,
          max_completion_tokens: 1000,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Handle Groq rate limit gracefully with automated backoff retry
      if (res.status === 429) {
        console.warn('[LLMService] Rate limited (429), waiting 3.5s before retry...');
        await new Promise((r) => setTimeout(r, 3500));
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 15000);
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages,
            temperature: 0.3,
            max_completion_tokens: 1000,
            response_format: { type: 'json_object' }
          }),
          signal: retryController.signal,
        });
        clearTimeout(retryTimeoutId);
      }

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) rawResponse = content;
      } else {
        const errText = await res.text();
        console.warn('[LLMService] Groq API response not OK:', res.status, errText);
      }
    }

    if (rawResponse) {
      const cleaned = stripMarkdownFences(rawResponse);
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          return parsed;
        }
      } catch (parseErr) {
        return {
          type: 'text',
          message: cleaned,
        };
      }
    }

    // Fallback to local answering if external API returned empty
    return generateLocalFallback({ message, userRole, userData, adminData, eventsData, projectCreatorData });
  } catch (apiErr) {
    console.warn('[LLMService] API call failed, using safe fallback:', apiErr.message);
    return generateLocalFallback({ message, userRole, userData, adminData, eventsData, projectCreatorData });
  }
};

module.exports = { generateChatResponse, generateLocalFallback, stripMarkdownFences };
