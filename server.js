require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume') {
        if (file.mimetype === 'application/pdf' || 
            file.mimetype === 'application/msword' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          cb(null, true);
        } else {
          cb(new Error('Invalid resume file type. Only PDF, DOC, and DOCX are allowed.'));
        }
    } else if (file.fieldname === 'profilePhoto') {
        if (file.mimetype === 'image/jpeg' || 
            file.mimetype === 'image/png' || 
            file.mimetype === 'image/webp') {
          cb(null, true);
        } else {
          cb(new Error('Invalid profile photo file type. Only JPG, PNG, and WEBP are allowed.'));
        }
    } else {
        cb(new Error('Unexpected field'));
    }
  }
});

// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = (buffer, filename, folder, resource_type = 'raw') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        public_id: filename,
        resource_type: resource_type,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// Data Storage (Local JSON Cache)
let dataFilePath = path.join(__dirname, 'data', 'employees.json');
try {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        dataFilePath = '/tmp/employees.json';
    } else {
        if (!fs.existsSync(path.dirname(dataFilePath))) {
            fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
        }
    }
    if (!fs.existsSync(dataFilePath)) {
        fs.writeFileSync(dataFilePath, JSON.stringify([]));
    }
} catch (err) {
    console.error("Failed to initialize cache file:", err);
}

function getEmployees() {
    try {
        if (fs.existsSync(dataFilePath)) {
            return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        }
    } catch(e) {
        console.error("Error reading employees:", e);
    }
    return [];
}

function saveEmployee(employee) {
    try {
        const employees = getEmployees();
        employees.push(employee);
        fs.writeFileSync(dataFilePath, JSON.stringify(employees, null, 2));
    } catch(e) {
        console.error("Error saving employee:", e);
    }
}

function generateUniqueSlug(fullName) {
    const baseSlug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let slug = baseSlug;
    const employees = getEmployees();
    let counter = 1;
    while (employees.some(emp => emp.slug === slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
}

// Portfolio Route
app.get('/:slug', (req, res) => {
    const employees = getEmployees();
    const employee = employees.find(emp => emp.slug === req.params.slug);
    
    if (!employee) {
        return res.status(404).send('Portfolio not found');
    }
    
    // Pass host for canonical URL
    const host = req.get('host');
    const protocol = req.protocol;
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;
    
    res.render('portfolio', { employee, fullUrl });
});

// API Endpoint to submit form
app.post('/api/submit', upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      fullName, email, phone, role, linkedin, github, laptopName, mobileName, summary, projects
    } = req.body;

    if (!req.files || !req.files.resume) {
      return res.status(400).json({ error: 'Resume file is required.' });
    }
    if (!req.files || !req.files.profilePhoto) {
        return res.status(400).json({ error: 'Profile photo is required.' });
    }

    // 1. Upload Profile Photo
    const photoFilename = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const photoResult = await uploadToCloudinary(req.files.profilePhoto[0].buffer, photoFilename, 'shaivika/employees/profile-photos', 'image');
    // Apply optimizations (f_auto, q_auto) to the URL
    const profilePhotoUrl = photoResult.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');

    // 2. Upload Resume
    const resumeFilename = `employee_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const resumeResult = await uploadToCloudinary(req.files.resume[0].buffer, resumeFilename, 'shaivika/employees/resumes', 'raw');
    const resumeUrl = resumeResult.secure_url;

    // 3. Generate Slug and Portfolio URL
    const slug = generateUniqueSlug(fullName);
    const host = req.get('host');
    const portfolioUrl = `${req.protocol}://${host}/${slug}`;

    // 4. Save to Local Cache (Excluding private device data for rendering safety)
    let parsedProjects = [];
    try {
        parsedProjects = JSON.parse(projects);
    } catch(e) {}

    const newEmployee = {
        slug,
        fullName,
        email, 
        phone, 
        role,
        linkedin,
        github,
        summary,
        projects: parsedProjects,
        profilePhotoUrl,
        resumeUrl,
        portfolioUrl,
        submittedAt: new Date().toISOString()
    };
    saveEmployee(newEmployee);

    // 5. Add to Google Sheets & Send Email via Google Apps Script Web App
    if (process.env.APPS_SCRIPT_WEB_APP_URL) {
        try {
            const appScriptResponse = await fetch(process.env.APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName,
                    email: email.toLowerCase(),
                    phone,
                    role,
                    linkedin,
                    github,
                    resume: resumeUrl,
                    profilePhoto: profilePhotoUrl,
                    laptopName,
                    mobileName,
                    summary,
                    projects: JSON.stringify(parsedProjects),
                    submittedAt: newEmployee.submittedAt,
                    portfolioUrl
                })
            });
            const textResponse = await appScriptResponse.text();
            console.log('Apps Script Response:', textResponse);
        } catch (appScriptError) {
            console.error('Failed to trigger Apps Script:', appScriptError);
        }
    } else {
        console.warn("APPS_SCRIPT_WEB_APP_URL not configured. Skipping sheets upload & email.");
    }

    res.status(200).json({ 
      success: true, 
      message: 'Profile completed successfully.',
      portfolioUrl: portfolioUrl
    });

  } catch (error) {
    console.error('Submission Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during submission.' });
  }
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
