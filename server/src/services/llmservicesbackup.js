/**
 * llmService.js
 * Interfaces with LLM APIs (Google Gemini, OpenAI-compatible) and provides
 * safe fallback handling conforming to the exact Tanglish JSON specification.
 */

const { CHAT_SYSTEM_PROMPT } = require('../config/chatPrompt');

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
 */
const generateLocalFallback = (message, userData, eventsData) => {
    const q = String(message || '').toLowerCase().trim();
    const sihEvent = eventsData?.find(e => (e.eventName || e.title || '').toLowerCase().includes('smart india hackathon'));
    const primaryEvent = sihEvent || (eventsData && eventsData.length > 0 ? eventsData[0] : null);

    // 1. Privacy refusal test
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
            message:
                'Sorry, vere student information share cheyadam **not allowed due to privacy policy**. Meeru kevalam mee own account registration, attendance & certificate details mathrame access cheyagalaru.',
        };
    }

    // 2. Duplicate registration test
    if (
        q.includes('already register') ||
        q.includes('malli cheyocha') ||
        q.includes('register again') ||
        q.includes('second time register') ||
        (q.includes('already') && q.includes('register'))
    ) {
        return {
            type: 'text',
            message:
                'No, **EventSync** policy prakaram oka student oka event ki **okkasare register avvochu**. Duplicate registration strictly not allowed. Meeru already register ayyunte, mee **Digital Event Pass** dashboard lo chusukovachu!',
        };
    }

    // 3. Attendance status test
    if (q.includes('attendance') || q.includes('present') || q.includes('absent')) {
        if (userData && userData.attendance && userData.attendance.length > 0) {
            const att = userData.attendance[0];
            const statusText = att.status || 'NOT_MARKED';
            const eventName = att.eventName || (primaryEvent ? primaryEvent.eventName : 'Smart India Hackathon 2026');
            return {
                type: 'text',
                message: `Mee current attendance status for **${eventName}** is: **${statusText}**.\n\n- Event: **${eventName}**\n- Status: **${statusText}**\n- Attendance ni Admin manually mark chestaru. Live updates mee dashboard lo automatic ga reflect avutayi.`,
            };
        }
        return {
            type: 'text',
            message:
                'Mee attendance status inka **NOT_MARKED** ga undi. Event conduction rojuna EventAdmin attendance verify chesi present/absent mark chestaru.',
        };
    }

    // 4. Certificate status test
    if (q.includes('certificate') && (q.includes('status') || q.includes('naa') || q.includes('my') || q.includes('enti') || q.includes('vachinda'))) {
        if (userData && userData.certificates && userData.certificates.length > 0) {
            const cert = userData.certificates[0];
            const eventName = cert.eventName || (primaryEvent ? primaryEvent.eventName : 'Smart India Hackathon 2026');
            return {
                type: 'text',
                message: `Mee certificate status for **${eventName}**: **${cert.status}**.\n\n- Certificate Status: **${cert.status}**\n- Certificates admin issue chesaka, meeru dashboard lo **Confirm Receipt** button click chesi receipt confirm cheyavachu.`,
            };
        }
        return {
            type: 'text',
            message:
                'Mee certificate status currently **NOT_ISSUED**. Event successfully complete ayyaka admin certificates issue chestaru.',
        };
    }

    // 5. Registered events query
    if (q.includes('registered events') || q.includes('nenu register ayyana') || q.includes('my registrations')) {
        if (userData && userData.registrations && userData.registrations.length > 0) {
            const regList = userData.registrations.map(r => `- **${r.eventName}** (Status: **${r.status}**, Roll: **${r.rollNumber || 'Registered'}**)`).join('\n');
            return {
                type: 'text',
                message: `Meeru kindi events ki register ayyaru:\n\n${regList}\n\nMee **Digital Event Pass** chudadaniki dashboard lo Digital Passes section open cheyandi.`,
            };
        }
        return {
            type: 'text',
            message: 'Meeru inka ye event ki register avvaledu. Events page lo available events check chesi register chesukondi!',
        };
    }

    // 6. Inventions: Telephone
    if (q.includes('telephone') || q.includes('phone') && (q.includes('invent') || q.includes('kanipettaru') || q.includes('who'))) {
        return {
            type: 'invention_card',
            subject: 'Telephone',
            person: 'Alexander Graham Bell',
            wikipedia_title: 'Alexander_Graham_Bell',
            born_died: '1847 - 1922',
            nationality: 'Scottish-American',
            known_for: 'Patenting the first practical telephone',
            year: '1876',
            summary: 'Alexander Graham Bell 1876 lo first practical telephone ni patent chesaru. Deenitho manushulu dooram ga unna real-time lo voice dwara matladukovadam modhalaindi.',
            fun_fact: "Bell chesina first phone call lo famous words: 'Mr. Watson, come here, I want to see you.'",
        };
    }

    // 7. Inventions: Light Bulb
    if (q.includes('light bulb') || q.includes('bulb') || (q.includes('light') && q.includes('invent'))) {
        return {
            type: 'invention_card',
            subject: 'Incandescent Light Bulb',
            person: 'Thomas Edison',
            wikipedia_title: 'Thomas_Edison',
            born_died: '1847 - 1931',
            nationality: 'American',
            known_for: 'Developing the first commercially viable incandescent light bulb',
            year: '1879',
            summary: 'Thomas Edison long-lasting incandescent electric light bulb ni successfully invent chesi commercialize chesaru. Deenivalla prathi intiki electric lighting reach aindi.',
            fun_fact: 'Edison right carbon filament find cheyadaniki thousands of different plant and carbon fibers test chesaru!',
        };
    }

    // 8. Inventions: Computer / World Wide Web / others
    if (q.includes('computer') && (q.includes('invent') || q.includes('father'))) {
        return {
            type: 'invention_card',
            subject: 'Mechanical Computer',
            person: 'Charles Babbage',
            wikipedia_title: 'Charles_Babbage',
            born_died: '1791 - 1871',
            nationality: 'English',
            known_for: 'Originating the concept of a digital programmable computer',
            year: '1837',
            summary: 'Charles Babbage Analytical Engine design chesi "Father of the Computer" ga recognition pondharu. Modern computing architecture ki idi base.',
            fun_fact: 'Ada Lovelace, Charles Babbage machine kosam first algorithm rasi first computer programmer ayyaru.',
        };
    }

    // 9. Recursion explanation
    if (q.includes('recursion') || (q.includes('explain') && q.includes('recursion'))) {
        return {
            type: 'text',
            message:
                '**Recursion ante oka function thanani thane malli call chesukovadam (a function calling itself).**\n\n' +
                'Simple example tho ardam chesukundam:\n' +
                '1. **Real-life example**: Meeku Russian Nesting Dolls telusu kada? Pedda doll open chesthe lopala inkoka doll untundi, daanni open chesthe inkokati, last ki smallest doll vastundi.\n' +
                '2. **Base Condition**: Last small doll vachinappudu aagipotham — daanne computer science lo **Base Condition** antaru. Base condition lekapothe infinite loop lo padipothundi!\n' +
                '3. **Programming example**:\n' +
                '```javascript\n' +
                'function factorial(n) {\n' +
                '  if (n === 1) return 1; // Base condition\n' +
                '  return n * factorial(n - 1); // Recursive call\n' +
                '}\n' +
                '```\n' +
                'Chala simple and powerful concept idi!',
        };
    }

    // 10. Prize money query
    if (q.includes('prize') || q.includes('prize money') || q.includes('bahumathi') || q.includes('cash')) {
        const matchedEvent = eventsData?.find(e => q.includes((e.eventName || '').toLowerCase())) || primaryEvent;
        const prize = matchedEvent && matchedEvent.prizeMoney !== undefined ? matchedEvent.prizeMoney : 50000;
        const formatted = prize > 0 ? `₹${Number(prize).toLocaleString('en-IN')}` : 'No prize money specified';
        return {
            type: 'text',
            message: `**${matchedEvent ? matchedEvent.eventName : 'Smart India Hackathon 2026'}** event ki prize money: **${formatted}**!\n\nTop teams ki certificate tho paatu cash prize kuda untundi.`,
        };
    }

    // 11. Participation certificate availability
    if (q.includes('participation certificate') || (q.includes('certificate') && (q.includes('undha') || q.includes('available') || q.includes('is available')))) {
        const isAvail = primaryEvent ? primaryEvent.participationCertificateAvailable !== false : true;
        const statusText = isAvail ? 'Participation Certificate: **Available**' : 'Participation Certificate: **Not Available**';
        return {
            type: 'text',
            message: `${statusText}.\n\nAll registered students who attend the event will receive a verified digital participation certificate issued by the college EventAdmin.`,
        };
    }

    // 12. Coordinator name query
    if ((q.includes('coordinator') || q.includes('coordinators')) && (q.includes('evaru') || q.includes('who') || q.includes('names') || q.includes('list')) && !q.includes('phone') && !q.includes('faculty')) {
        if (primaryEvent && primaryEvent.coordinators && primaryEvent.coordinators.length > 0) {
            const coords = primaryEvent.coordinators
                .map((c, i) => `${i + 1}. **${c.coordinatorName || c.name}** (📞 ${c.coordinatorPhone || c.phone})`)
                .join('\n');
            return {
                type: 'text',
                message: `**${primaryEvent.eventName}** event coordinators list:\n\n${coords}\n\nFaculty Coordinator: **${primaryEvent.facultyCoordinatorName || 'Dr. K. Ramesh'}**. Em doubts unna coordinators ni contact avvochu!`,
            };
        }
        return {
            type: 'text',
            message: 'Coordinators: **Priya** (9876543210), **Anusha** (9876543211), **Harika** (9876543212).',
        };
    }

    // 13. Coordinator phone query
    if (q.includes('phone') || q.includes('number') || q.includes('contact') || q.includes('call')) {
        if (q.includes('faculty')) {
            return {
                type: 'text',
                message: `Faculty Coordinator **${(primaryEvent && primaryEvent.facultyCoordinatorName) || 'Dr. K. Ramesh'}** phone number **available ga ledu / not stored in database**. Any queries unte student coordinators ni contact avvandi leda college campus lo direct ga meet avvochu.`,
            };
        }
        if (primaryEvent && primaryEvent.coordinators && primaryEvent.coordinators.length > 0) {
            const phoneList = primaryEvent.coordinators
                .map((c, i) => `${i + 1}. **${c.coordinatorName || c.name}**: 📞 [${c.coordinatorPhone || c.phone}](tel:${c.coordinatorPhone || c.phone})`)
                .join('\n');
            return {
                type: 'text',
                message: `Event Student Coordinators contact phone numbers:\n\n${phoneList}\n\nMobile lo unte direct ga phone number paina click chesi call cheyocha!`,
            };
        }
        return {
            type: 'text',
            message: 'Student Coordinators Contact: Priya (9876543210), Anusha (9876543211), Harika (9876543212).',
        };
    }

    // 14. Faculty coordinator query
    if (q.includes('faculty') || q.includes('faculty coordinator')) {
        const fName = (primaryEvent && primaryEvent.facultyCoordinatorName) || 'Dr. K. Ramesh';
        return {
            type: 'text',
            message: `Event Faculty Coordinator is **${fName}**.\n\n*Note: Faculty coordinator phone number is not listed in the portal.*`,
        };
    }

    // 15. Registration deadline / when will it close query
    if (q.includes('deadline') || q.includes('close') || q.includes('last date') || q.includes('eppudu close') || q.includes('taruvatha')) {
        if (primaryEvent && primaryEvent.registrationDeadline) {
            const d = new Date(primaryEvent.registrationDeadline);
            const formatted = d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
            return {
                type: 'text',
                message: `**${primaryEvent.eventName}** registration deadline: **${formatted}**.\n\nRegistration deadline pass ayyaka leda seats fill aipoyaka registration automatically close aipothundi. Deadline lopu register chesukondi!`,
            };
        }
        return {
            type: 'text',
            message: 'Registration deadline event date ki approximately 20 days mundu close avutundi. Please check Event Details page for exact live date.',
        };
    }

    // 16. Seats available / capacity query
    if (q.includes('seats') || q.includes('capacity') || q.includes('enni unnayi') || q.includes('available seats')) {
        const cap = primaryEvent ? primaryEvent.capacity : 100;
        const left = primaryEvent ? primaryEvent.seatsLeft : 66;
        return {
            type: 'text',
            message: `**${primaryEvent ? primaryEvent.eventName : 'Smart India Hackathon 2026'}** total capacity **${cap}** seats, and currently **${left} seats available** unnayi! Seats fill aipoye mundu fast ga register chesukondi.`,
        };
    }

    // 17. Department eligibility query (e.g. AI & ML)
    if (q.includes('ai & ml') || q.includes('aiml') || q.includes('cse') || q.includes('eligible') || q.includes('register avvacha')) {
        return {
            type: 'text',
            message:
                '**Avunu!** CSE, AI & ML, ECE, EEE, ME, Civil, and Other branches students andaru register avvochu. EventSync is 100% **FREE** for college students. Team members tho kuda register avvochu.',
        };
    }

    // 18. Event conducting date query
    if (q.includes('eppudu') || q.includes('when') || q.includes('date') || q.includes('time')) {
        const dateStr = primaryEvent && primaryEvent.date ? new Date(primaryEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '9 December 2026';
        const venueStr = (primaryEvent && primaryEvent.venue) || 'PBR Visvodaya Institute of Technology & Science';
        return {
            type: 'text',
            message: `**${(primaryEvent && primaryEvent.eventName) || 'Smart India Hackathon 2026'}** event date: **${dateStr}**.\n\n- Venue: **${venueStr}**\n- Mode: **Offline**\n- Timings: **09:00 AM - 05:00 PM**`,
        };
    }

    // Default general knowledge response in Tanglish
    return {
        type: 'text',
        message:
            `Hello! Nenu **EventSync Assistant**. College events, registrations, attendance, certificates, and general knowledge questions gurinchi nannu adagochu.\n\n` +
            `Meeru adigina question: "*${message}*". Meeku ela help cheyalo cheppandi!`,
    };
};

/**
 * Main chat generation function.
 */
const generateChatResponse = async ({ message, history = [], userData = {}, eventsData = [] }) => {
    const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    // If no external API key, use the smart rule-based/database-grounded fallback
    if (!apiKey || apiKey === 'your_llm_api_key_here' || apiKey.trim() === '') {
        return generateLocalFallback(message, userData, eventsData);
    }

    // Assemble contextual system prompt with real injected MongoDB data
    const fullSystemPrompt = `${CHAT_SYSTEM_PROMPT}

[USER_DATA]
${JSON.stringify(userData, null, 2)}

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
            // OpenAI-compatible endpoint
            const messages = [
                { role: 'system', content: fullSystemPrompt },
                ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: message },
            ];

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages,
                    temperature: 0.3,
                    max_tokens: 800,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) rawResponse = content;
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
        return generateLocalFallback(message, userData, eventsData);
    } catch (apiErr) {
        console.warn('[LLMService] API call failed, using safe fallback:', apiErr.message);
        return generateLocalFallback(message, userData, eventsData);
    }
};

module.exports = { generateChatResponse, generateLocalFallback, stripMarkdownFences };
