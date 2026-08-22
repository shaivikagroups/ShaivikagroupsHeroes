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

function doGet(e) {
  try {
    const slug = e.parameter.slug;
    if (!slug) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "No slug provided" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // Find column index helper
    function getCol(names, fallbackIndex) {
      for (const name of names) {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].toString().trim().toLowerCase() === name.toLowerCase()) {
            return i;
          }
        }
      }
      return fallbackIndex; // Fallback to index if header is completely renamed
    }
    
    const urlColIndex = getCol(['Portfolio URL', 'Portfolio', 'URL'], 13);
    if (urlColIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Portfolio URL column not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    let rowData = null;
    for (let i = 1; i < values.length; i++) {
      const url = values[i][urlColIndex];
      if (url && url.toString().endsWith("/" + slug)) {
        rowData = values[i];
        break;
      }
    }
    
    if (!rowData) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Portfolio not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Map array to object matching Employee structure with robust column detection
    const employee = {
      fullName: rowData[getCol(['Full Name', 'Name'], 0)] || '',
      email: rowData[getCol(['Email', 'Email Address'], 1)] || '',
      phone: rowData[getCol(['Phone Number', 'Phone'], 2)] || '',
      role: rowData[getCol(['Role', 'Position'], 3)] || '',
      linkedin: rowData[getCol(['LinkedIn URL', 'LinkedIn'], 4)] || '',
      github: rowData[getCol(['GitHub URL', 'GitHub'], 5)] || '',
      resumeUrl: rowData[getCol(['Resume', 'Resume URL'], 6)] || '',
      profilePhotoUrl: rowData[getCol(['Profile Photo', 'Photo'], 7)] || '',
      laptopName: rowData[getCol(['Laptop Name', 'Laptop'], 8)] || '',
      mobileName: rowData[getCol(['Mobile Name', 'Mobile'], 9)] || '',
      summary: rowData[getCol(['Summary', 'Professional Summary', 'About'], 10)] || '',
      projects: [],
      submittedAt: rowData[getCol(['Submitted At', 'Date'], 12)] || '',
      portfolioUrl: rowData[urlColIndex] || '',
      slug: slug
    };

    // Safely parse projects
    const projIndex = getCol(['Projects', 'Project'], 11);
    if (projIndex !== -1 && rowData[projIndex]) {
      try {
        employee.projects = JSON.parse(rowData[projIndex]);
      } catch (e) {
        employee.projects = [];
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": employee }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
