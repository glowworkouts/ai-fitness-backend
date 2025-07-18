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

function generatePdfBuffer(planJson, customerName = "Client") {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // --- Title Page ---
    doc.fontSize(26).fillColor("#000").text("Your Personalized Fitness Plan", {
      align: "center",
      underline: true
    });
    doc.moveDown(2);
    doc.fontSize(20).text(`Prepared for: ${customerName}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Thank you for using Glow Workouts!", { align: "center" });
    doc.moveDown(4);
    doc.fontSize(12).text("This document contains a tailored 1-week workout plan created by our AI fitness assistant.", {
      align: "center"
    });

    doc.addPage(); // ➕ Go to a new page after title

    // --- Actual Plan Content ---
    doc.fontSize(20).text("Your 1-Week Workout Plan", { align: "center" });
    doc.moveDown();

    const workouts = planJson.week_1.workouts;
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

app.post("/generate-sample-plan", async (req, res) => {
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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful fitness assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    });

    const rawText = completion.choices[0].message.content;

const planJson = JSON.parse(rawText);

const customerName = req.body.name || "Client";
const pdfBuffer = await generatePdfBuffer(planJson, customerName);
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

