console.log("DEBUG ENVIRONMENT:");
console.log("OPENAI_API_KEY:", JSON.stringify(process.env.OPENAI_API_KEY));
console.log("SENDGRID_API_KEY:", JSON.stringify(process.env.SENDGRID_API_KEY));
console.log("STRIPE_SECRET_KEY:", JSON.stringify(process.env.STRIPE_SECRET_KEY));
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const bodyParser = require("body-parser");
const fs = require("fs");
console.log("DEBUG ENV OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "exists" : "missing");
console.log("DEBUG - All environment variables at startup:", process.env);

const app = express();
app.use(bodyParser.json());
app.use(cors());

const exerciseLibrary = fs.readFileSync("exercises.json", "utf-8");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

function generatePdfBuffer(planJson, customerName = "Client", healthText = "", goalsText = "", testsText = "", cyclesText = "", freqText = "", summaryText = "", programIntroText = "") {
  return new Promise((resolve, reject) => {
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Extract values
    const monthYear = new Date().toLocaleString("default", { month: "long", year: "numeric" });
    const clientName = planJson.name || customerName;

    // --- Title Page (already there) ---
    doc.fontSize(20).text(monthYear, { align: "center" });

    doc.moveDown(10);

    doc.fontSize(28).text("Workout & Meal Plan", { align: "center" });
    doc.moveDown(6);

    doc.fontSize(14).text("Trainer: Personal Trainer AI", { align: "center" });
    doc.text("Contact: personaltrainer@glowworkouts.com", { align: "center" });

    doc.moveDown(3);
    doc.fontSize(16).text(`Client Name: ${clientName}`, { align: "center" });

    // --- 1. Client Health Overview ---
    doc.addPage();
    doc.fontSize(20).text("1. Client Health Overview", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(healthText, { align: "left" });

    // --- 2. Client Goals & Training Focus ---
    doc.addPage();
    doc.fontSize(20).text("2. Client Goals & Training Focus", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(goalsText, { align: "left" });

    // --- 2.3 Physical Fitness Tests for Progress Monitoring ---
    doc.addPage();
    doc.fontSize(20).text("2.3 Physical Fitness Tests for Progress Monitoring", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(testsText, { align: "left" });

    // --- 2.4 Training Cycles ---
    doc.addPage();
    doc.fontSize(20).text("2.4 Training Cycles", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(cyclesText, { align: "left" });

    // --- 2.5 Training Frequency ---
    doc.addPage();
    doc.fontSize(20).text("2.5 Training Frequency", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(freqText, { align: "left" });

    // --- 2.6 Plan Summary ---
    doc.addPage();
    doc.fontSize(20).text("2.6 Plan Summary", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(summaryText, { align: "left" });

    // --- 3. Training Program & Exercises (programIntroText) ---
    doc.addPage();
    doc.fontSize(20).text("3. Training Program & Exercises", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(programIntroText, { align: "left" });

    // --- Weekly Plan Content ---
    const workouts = planJson.week_1?.workouts || [];
    workouts.forEach((workout) => {
      doc.fontSize(16).text(`Day: ${workout.day}`);
      workout.exercises.forEach((ex) => {
        doc.fontSize(12).text(
          `- ${ex.exercise_name} (${ex.muscle_group}): ${ex.sets} sets x ${ex.reps} reps, RIR ${ex.reps_in_reserve}, Rest: ${ex.rest_info}`
        );
      });
      doc.moveDown();
    });

    doc.end();
  });
}

function generateExcelBuffer(planJson) {
  const data = [];

  const workouts = planJson.week_1.workouts;
  workouts.forEach(workout => {
    workout.exercises.forEach(ex => {
      data.push({
        Day: workout.day,
        MuscleGroup: ex.muscle_group,
        Exercise: ex.exercise_name,
        Sets: ex.sets,
        Reps: ex.reps,
        RIR: ex.reps_in_reserve,
        Rest: ex.rest_info
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Week1Plan");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

app.post("/generate-plan", async (req, res) => {
const {
  name,
  email,
  dob,
  service,
  training_times,
  goals,
  workout_preferences,
  training_history,
  health_stress,
  activity_level,
  injuries,
  cardio_conditions,
  other_factors,
  weight,
  height,
  nutrition_preferences
} = req.body;

const prompt = `
You are an expert personal trainer and nutritionist.

Based on the following client data, create a comprehensive report and plan in English, covering all requested sections:

Client Information:
- Name: ${name}
- Email: ${email}
- Date of Birth: ${dob}
- Service Requested: ${service}
- Preferred Training Times: ${training_times}
- Goals: ${goals}
- Preferred/Disliked Workouts: ${workout_preferences}
- Training History and Experience: ${training_history}
- Health & Stress Level: ${health_stress}
- Daily Activity Level: ${activity_level}
- Injuries/Pain: ${injuries}
- Cardiovascular Conditions: ${cardio_conditions}
- Other Health Factors: ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition Preferences/Intolerances: ${nutrition_preferences}

Generate the following sections:

1. Health Assessment
2. Goal Setting and Training Planning
   2.1 Client Goals
   2.2 Overview of Training Principles (Specificity, Individuality, Overload & Recovery, Supercompensation, Progression)
   2.3 Fitness Tests (instructions and example results)
   2.4 Training Cycles Overview (Mesocycle and Macrocycle if relevant)
   2.5 Training Frequency
   2.6 Free-form summary of client goals and considerations
3. 4-Week Workout Plan
   For each week and day:
   - Exercises (include muscle group)
   - Sets
   - Reps
   - Rest between exercises and between sets
   - Tips or special notes
4. Nutrition Recommendations
   4.1 Estimated Caloric Needs
     - BMR (Mifflin-St Jeor Equation)
     - Adjusted with PAL factor
   4.2 Recommended Macronutrient Distribution
   4.3 Sample Weekly Meal Plan (if relevant)
   4.4 Nutrition Preferences or Intolerances
   4.5 General Tips and Summary
5. Support Channels (WhatsApp, Facebook Group, Email, YouTube links)

Output in structured JSON with clear sections.
Mark each section clearly in the JSON so it can be displayed separately later.
Include Week 1 of the workout plan as a preview; Weeks 2-4 can be locked behind payment if desired.

Exercise Library:
${exerciseLibrary}

[
  {
    "week_number": 1,
    "workouts": [
      {
        "day": "Monday",
        "exercises": [
          {
            "name": "EXERCISE_NAME",
            "sets": 3,
            "reps": 10,
            "rest": "90 sec"
          }
        ]
      }
    ]
  }
]
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful fitness assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0
    });
// console.log("RAW COMPLETION:", JSON.stringify(completion, null, 2));

    let responseText = completion.choices[0].message.content.trim();

// Remove code block fences if present
if (responseText.startsWith("```")) {
  responseText = responseText.slice(responseText.indexOf("\n") + 1, responseText.lastIndexOf("```"));
}

let plan;
try {
  plan = JSON.parse(responseText);
;
    } catch (error) {
      return res.status(400).json({
        error: "Could not parse plan JSON.",
        raw: responseText
      });
    }

    res.json({ plan });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error generating plan." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

function calculateAge(dob) {
  if (!dob) return "";
  // Expecting dob as "DD/MM/YYYY"
  const [day, month, year] = dob.split("/");
  const birthDate = new Date(`${year}-${month}-${day}`);
  const diffMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

app.post("/generate-sample-plan", async (req, res) => {
  console.log("BODY RECEIVED FROM LANDBOT:", req.body);

  const {
    name,
    email,
    dob,
    service,
    training_times,
    goals,
    workout_preferences,
    training_history,
    health_stress,
    activity_level,
    injuries,
    cardio_conditions,
    other_factors,
    weight,
    height,
    nutrition_preferences
  } = req.body;
  const age = calculateAge(dob);

  const prompt = `
Client Information:
- Name: ${name}
- Email: ${email}
- Date of Birth: ${dob}
- Service Requested: ${service}
- Preferred Training Times: ${training_times}
- Goals: ${goals}
- Preferred/Disliked Workouts: ${workout_preferences}
- Training History and Experience: ${training_history}
- Health & Stress Level: ${health_stress}
- Daily Activity Level: ${activity_level}
- Injuries/Pain: ${injuries}
- Cardiovascular Conditions: ${cardio_conditions}
- Other Health Factors: ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition Preferences/Intolerances: ${nutrition_preferences}

Generate a **1-week personalized workout plan** that includes:
- 3 training days (e.g., Monday, Wednesday, Friday)
- Exercises per day
- Sets and reps
- Rest times
- Target muscle groups

Output as JSON exactly in this format:

{
  "week_1": {
    "workouts": [
      {
        "day": "Monday",
        "exercises": [
          {
            "name": "EXERCISE_NAME",
            "sets": 3,
            "reps": 10,
            "rest": "60 sec",
            "muscle_groups": ["chest", "triceps"]
          }
        ]
      }
    ]
  }
}
`;
const healthPrompt = `
You are a professional fitness coach. Use the following client data to write a **Client Health Overview** following the exact structure below. Write in clear, natural English. Use "you"/"your" form, and fill in [bracketed GPT instructions] with natural, personalized text based on the client data.

---
**Client Health Overview**

${name} is a ${age}-year-old. [What is the client's training background and experience? Write a conclusion based on: ${training_history}.] You are now motivated to train more regularly, preferably at fixed times following a personal plan. You prefer to workout ${training_times}.

You rate your general health and stress level as ${health_stress}/10.

Your goal is [write natural text about goals based on ${name} and ${goals}].

[Describe the client's daily activity level based on: ${activity_level}.]

Previous injuries: [Describe naturally previous injuries based on: ${injuries}, ${cardio_conditions}, and ${other_factors}. Explain how they might affect training. Explain how this plan provides support and takes these into account.]

Summary and training considerations: [Write a natural summary and training recommendations based on ${name}'s goals and health background.]
---

Client Data:
- Name: ${name}
- Date of Birth: ${dob}
- Training Times: ${training_times}
- Goals: ${goals}
- Training History: ${training_history}
- Activity Level: ${activity_level}
- Injuries: ${injuries}
- Cardio Conditions: ${cardio_conditions}
- Other Factors: ${other_factors}
- Health/Stress: ${health_stress}
`;

const goalsPrompt = `
You are a professional fitness coach. Based on the following client data, analyze their goals and health background, and write a section for a personalized plan (English).  
Structure the answer in clear, personal language, and organize as shown below.  
Be consistent with the health overview and use the client data.

**Examples of physical abilities to improve:** muscle mass, basic strength, endurance, stability, explosiveness, flexibility, balance, mobility.  
Always include at least 3 relevant abilities, and explain *why* these matter for this client.

**Client Data:**
- Name: ${name}
- Date of birth: ${dob}
- Training times: ${training_times}
- Goals: ${goals}
- Workout preferences: ${workout_preferences}
- Training history: ${training_history}
- Health/stress: ${health_stress}
- Activity level: ${activity_level}
- Injuries: ${injuries}
- Cardio/metabolic/hormonal/other factors: ${cardio_conditions}, ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition preferences: ${nutrition_preferences}

**Format your answer like this:**  
**2. Client Goals and Training Focus**

2.1 Client Goals
- [Summarize all major client goals as bullet points, using client’s words, but make them SMART (Specific, Measurable, Achievable, Relevant, Timely) if possible.]
- Within 6 months, you aim to see measurable progress in your key goals.

2.2 Physical Abilities to Improve
- [Physical ability #1]: [Explain why this is important for this client, based on their goals/history/injuries.]
- [Physical ability #2]: [Explanation...]
- [Physical ability #3]: [Explanation...]
- [Add more if necessary]
`

const testsPrompt = `
You are a professional fitness coach. For the following client, select 3 relevant physical tests for tracking progress. 
The first test must always be: 
- Bodyweight measurement (3x per week in the morning after first toilet visit).

The other 2 tests should be strength/ability tests that are directly related to the main exercises planned for this client (choose based on their goals and planned workouts). 
Describe each test as shown in the example: purpose, methodology, technical criteria, when to stop the test, and when to perform the test (timing).

**Client Data:**
- Name: ${name}
- Date of Birth: ${dob}
- Training Times: ${training_times}
- Goals: ${goals}
- Workout Preferences: ${workout_preferences}
- Training History: ${training_history}
- Activity Level: ${activity_level}
- Injuries: ${injuries}
- Cardiovascular Conditions: ${cardio_conditions}
- Other Factors: ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition Preferences: ${nutrition_preferences}

**Format your answer exactly like this (in English):**

**2.3 Physical Fitness Tests for Progress Monitoring**

Test 1 – Bodyweight measurement 3x/week  
Purpose: To track body weight changes over time.  
Method: Weigh yourself three times per week in the morning after the first toilet visit, before eating or drinking. Record the values and use the weekly average.  
Timing: Every week, throughout the program.

Test 2 – [Name of main exercise test, e.g. Deadlift 5-RM]  
Purpose: [Describe what this test evaluates and why it is relevant for this client based on their goals/exercises.]  
Method: [Step-by-step protocol for performing the test, including warm-up, increments, number of reps, and required equipment. Give clear, safe instructions.]  
Technical criteria: [Describe how to maintain proper form and what is considered a successful repetition.]  
Termination criteria: [List conditions under which the test must be stopped for safety or technical reasons.]  
Timing: [When to perform the test: e.g. first week, after 4 weeks, after 8 weeks, etc.]

Test 3 – [Name of another exercise test, e.g. Incline Dumbbell Press 5-RM]  
Purpose: [Description as above.]  
Method: [Description as above.]  
Technical criteria: [Description as above.]  
Termination criteria: [Description as above.]  
Timing: [Description as above.]

Output ONLY valid Markdown (no extra explanations).
`;

const cyclesPrompt = `
You are a professional fitness coach. For this client, generate a section titled "2.4 Training Cycles". The training plan is always for 6 months.
Give a time overview (in English) of cycles, with the length and focus of each mesocycle (4 weeks) and the macrocycle (6 months).
Use the format shown in the example below. Adapt the goals and explanations for this specific client, using their actual data provided as "Client Data".
Keep the content highly practical, personalized, and well-structured.

EXAMPLE:
2.4 Training Cycles  
2.4.1 Overview of cycles and main goals for each Mesocycle (4 weeks) and Macrocycle (6 months):

Macrocycle for this client is 6 months. It is divided into 6 mesocycles. 24 weeks in total, 6 different mesocycles.

Mesocycle 1: [list main goals/focus for first 4 weeks, e.g. adaptation, technique, stability, according to client needs]
Mesocycle 2: [list main goals/focus for next 4 weeks, e.g. increasing intensity, etc.]
Mesocycle 3: ...
...
Mesocycle 6: ...

Macrocycle main goals:
- [Main goal 1 from previous client goals, must be relevant to this client]
- [Main goal 2 ...]
- [Add as many as needed]

Client Data:
- Name: ${name}
- Email: ${email}
- Date of birth: ${dob}
- Service: ${service}
- Training times: ${training_times}
- Goals: ${goals}
- Workout preferences: ${workout_preferences}
- Training history: ${training_history}
- Health/stress: ${health_stress}
- Activity level: ${activity_level}
- Injuries: ${injuries}
- Cardiovascular conditions: ${cardio_conditions}
- Other health factors: ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition preferences: ${nutrition_preferences}

Output ONLY valid Markdown. Do not add any extra text, explanations, or formatting outside of the provided structure.
`;

const freqPrompt = `
You are a professional fitness coach. Using the following client data and previous plan sections, write the section **2.5 Training Frequency** for a long-term personalized training plan. Write in clear, friendly English. Focus on the client’s previous training habits, planned frequency, and how frequency will change during the mesocycles. Mention that deload weeks are included, and describe why.

Client Data:
- Name: ${name}
- Date of Birth: ${dob}
- Training Times: ${training_times}
- Goals: ${goals}
- Workout Preferences: ${workout_preferences}
- Training History: ${training_history}
- Health/Stress: ${health_stress}
- Activity Level: ${activity_level}
- Injuries: ${injuries}
- Cardio Conditions: ${cardio_conditions}
- Other Factors: ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition Preferences: ${nutrition_preferences}

**Format your answer like this (in English):**

**2.5 Training Frequency**

[Begin with "${name}, ..." and then write a short summary of the client's previous training consistency and routine. Then explain how many sessions per week are planned at the start, and how this will progress during the plan. Mention that training weeks are organized into mesocycles, with planned deload weeks for recovery. Explain why this structure supports long-term progress and avoids overtraining. End with a short note that tests are done before/after deload weeks to track adaptation.]
`;

const summaryPrompt = `
You are a professional fitness coach. Based on the following client data and all previous plan sections (goals, tests, cycles, training frequency, and health overview), write a comprehensive summary for the client plan, in fluent English.

**Instructions:**
- Start the summary with: "${name}, your training plan focuses on..." (summarize main goals in the first paragraph).
- List the main goals and focus areas for the next 6 months as bullet points.
- Explain the general plan structure (cycles, mesocycles, deload weeks, weekly routine).
- Add training principles used in this plan (specificity, individuality, progressive overload, recovery, etc.).
- Address special considerations for this client (e.g. injuries, imbalances, preferences, sports-specific needs, etc.).
- Summarize the client's weekly training schedule (for example: which days are for strength, which days are for cardio, and typical rest days), in clear and easy-to-understand text.
- Conclude with how the plan adapts over time and ensures steady progress.
- Make sure this section feels personal and references the client's real goals, limitations, and routine.

**Client Data:**
- Name: ${name}
- Email: ${email}
- Date of birth: ${dob}
- Service: ${service}
- Training times: ${training_times}
- Goals: ${goals}
- Workout preferences: ${workout_preferences}
- Training history: ${training_history}
- Health/stress: ${health_stress}
- Activity level: ${activity_level}
- Injuries: ${injuries}
- Cardio/metabolic/hormonal/other factors: ${cardio_conditions}, ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition preferences: ${nutrition_preferences}

Output ONLY valid Markdown (no extra explanations).
`;

const programIntroPrompt = `
You are a professional fitness coach. Based on the following client data and all previous sections (goals, health overview, training cycles, etc.), write a highly personal introduction to the training program for the client, using clear and encouraging English. Cover the following:

- Why this training program structure is selected for this client (link to their goals, needs, background, injuries, etc.).
- What are the main focuses of the plan (strength, mass, explosiveness, stability, injury prevention, etc.), with examples from client info.
- How the workouts are structured per week (number of days, main session types, focus days, etc.).
- Why certain exercises and progressions are chosen (mention if base lifts, explosive work, etc.).
- Explain the progression approach (mesocycles, gradual progression, rest, and deloads).
- How the client should use the plan: day-to-day, paying attention to form, rest, adjusting loads, and listening to the body.
- Reinforce that the program is made for their lifestyle and goals.

Personalize every paragraph and use the client's name (${name}) throughout. Do **not** repeat previous sections word-for-word; instead, give new context and motivation, as a personal message.

**Client Data:**
- Name: ${name}
- Date of Birth: ${dob}
- Training times: ${training_times}
- Goals: ${goals}
- Workout preferences: ${workout_preferences}
- Training history: ${training_history}
- Health/stress: ${health_stress}
- Activity level: ${activity_level}
- Injuries: ${injuries}
- Cardio/metabolic/hormonal/other factors: ${cardio_conditions}, ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition preferences: ${nutrition_preferences}

**Format your answer as a motivational, friendly introduction to the next section of the plan.**
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful fitness assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    });
    const healthSummaryResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful fitness assistant." },
    { role: "user", content: healthPrompt }
  ],
  temperature: 0.4
});

const healthText = healthSummaryResponse.choices[0].message.content;
const goalsSummaryResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful fitness assistant." },
    { role: "user", content: goalsPrompt }
  ],
  temperature: 0.4
});
const goalsText = goalsSummaryResponse.choices[0].message.content;

const testsSummaryResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful fitness assistant." },
    { role: "user", content: testsPrompt }
  ],
  temperature: 0.4
});
const testsText = testsSummaryResponse.choices[0].message.content;

const cyclesSummaryResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful fitness assistant." },
    { role: "user", content: cyclesPrompt }
  ],
  temperature: 0.4
});
const cyclesText = cyclesSummaryResponse.choices[0].message.content;

const freqSummaryResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful fitness assistant." },
    { role: "user", content: freqPrompt }
  ],
  temperature: 0.4
});
const freqText = freqSummaryResponse.choices[0].message.content;

const summarySummaryResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful fitness assistant." },
    { role: "user", content: summaryPrompt }
  ],
  temperature: 0.4
});
const summaryText = summarySummaryResponse.choices[0].message.content;

const programIntroResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful fitness assistant." },
    { role: "user", content: programIntroPrompt }
  ],
  temperature: 0.4
});
const programIntroText = programIntroResponse.choices[0].message.content;

const rawText = completion.choices[0].message.content;
console.log("AI rawText:", rawText);

const planJson = JSON.parse(rawText);

const customerName = req.body.name || "Client";
const pdfBuffer = await generatePdfBuffer(planJson, customerName, healthText, goalsText, testsText, cyclesText, freqText, summaryText, programIntroText);
const excelBuffer = generateExcelBuffer(planJson);

    // Send email with the generated plan
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: email,
  from: "personaltrainer@glowworkouts.com",
  subject: "Your Free 1-Week Workout Plan",
  text: `Here is your plan in JSON format:\n\n${rawText}`,
  html: `<h2>Your 1-Week Workout Plan</h2><p>See attached PDF and Excel files for details.</p>`,
  attachments: [
    {
      content: pdfBuffer.toString("base64"),
      filename: "workout-plan.pdf",
      type: "application/pdf",
      disposition: "attachment"
    },
    {
      content: excelBuffer.toString("base64"),
      filename: "workout-plan.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: "attachment"
    }
  ]
};

    await sgMail.send(msg);

    console.log("✅ Sample plan sent to email.");

    res.json({ status: "Sample plan sent to email." });
  } catch (error) {
    console.error("❌ Error generating or sending sample plan:", error);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/generate-full-plan", async (req, res) => {
  const {
    name,
    email,
    dob,
    service,
    training_times,
    goals,
    workout_preferences,
    training_history,
    health_stress,
    activity_level,
    injuries,
    cardio_conditions,
    other_factors,
    weight,
    height,
    nutrition_preferences
  } = req.body;

const prompt = `
Client Information:
- Name: ${name}
- Email: ${email}
- Date of Birth: ${dob}
- Service Requested: ${service}
- Preferred Training Times: ${training_times}
- Goals: ${goals}
- Preferred/Disliked Workouts: ${workout_preferences}
- Training History and Experience: ${training_history}
- Health & Stress Level: ${health_stress}
- Daily Activity Level: ${activity_level}
- Injuries/Pain: ${injuries}
- Cardiovascular Conditions: ${cardio_conditions}
- Other Health Factors: ${other_factors}
- Weight: ${weight}
- Height: ${height}
- Nutrition Preferences/Intolerances: ${nutrition_preferences}

Generate a 4-week personalized workout plan, ensuring each week contains EXACTLY the following JSON format:

{
  "week_1": {
    "workouts": [
      {
        "day": "Monday",
        "exercises": [
          {
            "name": "EXERCISE_NAME",
            "sets": 3,
            "reps": 10,
            "rest": "60 sec",
            "muscle_groups": ["muscle1", "muscle2"]
          }
        ]
      },
      {
        "day": "Wednesday",
        "exercises": [ ... ]
      },
      {
        "day": "Friday",
        "exercises": [ ... ]
      }
    ]
  },
  "week_2": { ... },
  "week_3": { ... },
  "week_4": { ... }
}

IMPORTANT:
- Do NOT include any text before or after the JSON.
- Do NOT include any "nutrition" or "focus" fields.
- ONLY output the JSON object in the specified format.
- Each exercise array must contain at least 2 exercises.
`;

try {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
messages: [
  { role: "system", content: "You are a helpful fitness assistant." },
  { 
    role: "user", 
    content: `${prompt}\n\nRespond ONLY in valid JSON format without any explanation or extra text.` 
  }
],
    temperature: 0.4
  });

  const rawText = completion.choices[0].message.content;
console.log("=== RAW GPT OUTPUT START ===");
console.log(rawText);
console.log("=== RAW GPT OUTPUT END ===");

  // Convert JSON safely
  const json = JSON.parse(rawText);

  // Generate PDF
  const PDFDocument = require("pdfkit");
  const pdfDoc = new PDFDocument();
  const pdfChunks = [];
  pdfDoc.on("data", (chunk) => pdfChunks.push(chunk));
  pdfDoc.on("end", async () => {
    const pdfBuffer = Buffer.concat(pdfChunks);

    // Generate XLSX
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();

Object.keys(json).forEach((weekKey) => {
  const week = json[weekKey];
  
  if (!week || !Array.isArray(week.workouts)) {
    console.log(`Skipping week "${weekKey}" because workouts missing or invalid.`);
    return;
  }

  const rows = [];

  week.workouts.forEach((workout, wIdx) => {
    if (!workout) {
      console.log(`Skipping workout index ${wIdx} in week "${weekKey}" because it is undefined.`);
      return;
    }
    if (!Array.isArray(workout.exercises)) {
      console.log(`Skipping workout "${workout.day}" because exercises missing or invalid.`);
      return;
    }

    workout.exercises.forEach((ex, eIdx) => {
      if (!ex || typeof ex !== "object") {
        console.log(`Skipping exercise index ${eIdx} in day "${workout.day}" because it is invalid.`);
        return;
      }

      rows.push({
        Day: workout.day || "N/A",
        Exercise: ex.name || "N/A",
        Sets: ex.sets ?? "N/A",
        Reps: ex.reps ?? "N/A",
        Rest: ex.rest ?? "N/A",
        Muscles: Array.isArray(ex.muscle_groups) ? ex.muscle_groups.join(", ") : "N/A"
      });
    });
  });

  if (rows.length > 0) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, weekKey);
  } else {
    console.log(`No valid rows for week "${weekKey}".`);
  }
});

    const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // Send email
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: "personaltrainer@glowworkouts.com",
      subject: "Your Premium 4-Week Fitness Plan",
      text: "Your premium plan is attached as PDF and Excel.",
      html: `<p>🎁 Your premium 4-week plan is attached as PDF and Excel.</p>`,
      attachments: [
        {
          content: pdfBuffer.toString("base64"),
          filename: "4-week-plan.pdf",
          type: "application/pdf",
          disposition: "attachment"
        },
        {
          content: xlsxBuffer.toString("base64"),
          filename: "4-week-plan.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: "attachment"
        }
      ]
    };

    await sgMail.send(msg);

    console.log("✅ Full plan sent to email.");
    res.json({ status: "Full plan sent to email." });
  });

  // Write PDF content
  pdfDoc.fontSize(16).text("4-Week Workout Plan", { underline: true });
  Object.keys(json).forEach((weekKey) => {
    const week = json[weekKey];
    pdfDoc.moveDown().fontSize(14).text(`Week: ${weekKey}`);
    week.workouts.forEach((workout) => {
      pdfDoc.moveDown().fontSize(12).text(`Day: ${workout.day}`);
      workout.exercises.forEach((ex) => {
        pdfDoc.fontSize(10).text(
          `- ${ex.name}: ${ex.sets} sets x ${ex.reps} reps (Rest: ${ex.rest})`
        );
      });
    });
  });
  pdfDoc.end();
} catch (error) {
  console.error("❌ Error generating or sending full plan:", error);
  res.status(500).json({ error: "Server error." });
}
});

