function doPost(e) {
  try {
    // Parse the incoming JSON payload from our Node.js server
    const data = JSON.parse(e.postData.contents);
    
    // 1. Add Data to Google Sheets
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    
    // Ensure the sheet has headers if it's empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Full Name', 'Email', 'Phone Number', 'Role', 'LinkedIn URL', 
        'GitHub URL', 'Resume', 'Profile Photo', 'Laptop Name', 
        'Mobile Name', 'Summary', 'Projects', 'Submitted At', 'Portfolio URL'
      ]);
      // Make headers bold
      sheet.getRange(1, 1, 1, 14).setFontWeight("bold");
    }

    // Append the new row
    sheet.appendRow([
      data.fullName || '',
      data.email || '',
      data.phone || '',
      data.role || '',
      data.linkedin || '',
      data.github || '',
      data.resume || '',
      data.profilePhoto || '',
      data.laptopName || '',
      data.mobileName || '',
      data.summary || '',
      data.projects || '',
      data.submittedAt || new Date().toISOString(),
      data.portfolioUrl || ''
    ]);

    // 2. Send the Premium Email
    sendWelcomeEmail(data);

    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Row added and email sent" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendWelcomeEmail(data) {
  // Evaluate the HTML template
  const htmlTemplate = HtmlService.createTemplateFromFile('EmailTemplate');
  
  // Pass dynamic variables to the template
  htmlTemplate.fullName = data.fullName;
  htmlTemplate.role = data.role;
  htmlTemplate.portfolioUrl = data.portfolioUrl;
  
  const htmlBody = htmlTemplate.evaluate().getContent();
  
  // Send the email
  MailApp.sendEmail({
    to: data.email,
    subject: `🎉 Welcome to Shaivika, ${data.fullName}! Your Portfolio is Ready.`,
    htmlBody: htmlBody,
    name: "Shaivika Employee Onboarding"
  });
}
