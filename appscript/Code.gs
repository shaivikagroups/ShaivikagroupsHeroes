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
    
    // Find column index for 'Portfolio URL' to extract the slug, or recreate the slug logic based on Full Name.
    // The Portfolio URL is like 'https://example.com/slug'. So we can check if it ends with the slug.
    const urlColIndex = headers.indexOf('Portfolio URL');
    if (urlColIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Portfolio URL column not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    let rowData = null;
    for (let i = 1; i < values.length; i++) {
      const url = values[i][urlColIndex];
      // Check if this row matches the requested slug
      if (url && url.endsWith("/" + slug)) {
        rowData = values[i];
        break;
      }
    }
    
    if (!rowData) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Portfolio not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Map array to object matching Employee structure
    const employee = {
      fullName: rowData[headers.indexOf('Full Name')] || '',
      email: rowData[headers.indexOf('Email')] || '',
      phone: rowData[headers.indexOf('Phone Number')] || '',
      role: rowData[headers.indexOf('Role')] || '',
      linkedin: rowData[headers.indexOf('LinkedIn URL')] || '',
      github: rowData[headers.indexOf('GitHub URL')] || '',
      resumeUrl: rowData[headers.indexOf('Resume')] || '',
      profilePhotoUrl: rowData[headers.indexOf('Profile Photo')] || '',
      laptopName: rowData[headers.indexOf('Laptop Name')] || '',
      mobileName: rowData[headers.indexOf('Mobile Name')] || '',
      summary: rowData[headers.indexOf('Summary')] || '',
      projects: rowData[headers.indexOf('Projects')] ? JSON.parse(rowData[headers.indexOf('Projects')]) : [],
      submittedAt: rowData[headers.indexOf('Submitted At')] || '',
      portfolioUrl: rowData[headers.indexOf('Portfolio URL')] || '',
      slug: slug
    };
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": employee }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
