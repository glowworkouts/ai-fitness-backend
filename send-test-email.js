require("dotenv").config();
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: "personaltrainer@glowworkouts.com", // 👉 Replace this with YOUR email to receive the test
  from: "personaltrainer@glowworkouts.com", // 👉 This can be any verified sender identity (or just use your Gmail for now)
  subject: "Test Email from AI Fitness App",
  text: "This is a test email to confirm your SendGrid setup.",
  html: "<strong>This is a test email to confirm your SendGrid setup.</strong>",
};

sgMail
  .send(msg)
  .then(() => {
    console.log("✅ Test email sent successfully!");
  })
  .catch((error) => {
    console.error("❌ Error sending test email:");
    console.error(error);
  });

