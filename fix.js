const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/fetch\(\s*\+\s*"\$\{RESEND_API_URL\}\/emails"\s*\+\s*,/g, 'fetch($/emails,');
    content = content.replace(/'Authorization':\s*\+\s*"\Bearer\s+\$\{RESEND_API_KEY\}\"\s*\+\s*,/g, 'Authorization': \Bearer {RESEND_API_KEY}\,);
    content = content.replace(/subject:\s*\+\s*"\\$\{req\.user\.name\} has invited you to join their Creator Cash Flow roster\"\s*\+\s*,/g, "subject: ${req.user.name} has invited you to join their Creator Cash Flow roster,");
    content = content.replace(/html:\s*\+\s*"\<p>Hello/g, "html: <p>Hello");
    content = content.replace(/Join Roster<\/a><\/p>\"\s*\+\s*/g, "Join Roster</a></p>");
    fs.writeFileSync(file, content);
}

try { fixFile('controllers/authController.js'); } catch(e){}
try { fixFile('routes/agencyRoutes.js'); } catch(e){}

