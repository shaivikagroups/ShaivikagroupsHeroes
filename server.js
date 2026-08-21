require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// EJS removed for purely static frontend

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

let dataFilePath = path.join(__dirname, 'data', 'employees.json');
try {
    if (!fs.existsSync(path.dirname(dataFilePath))) {
        fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
    }
    if (!fs.existsSync(dataFilePath)) {
        fs.writeFileSync(dataFilePath, JSON.stringify([]));
    }
} catch (err) {
    console.error("Failed to initialize cache file:", err);
}

function getEmployees() {
    try {
        // Try /tmp first if in serverless environment
        if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
            if (fs.existsSync('/tmp/employees.json')) {
                return JSON.parse(fs.readFileSync('/tmp/employees.json', 'utf8'));
            }
        }
        // Fallback to the persistent data folder
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
        
        let targetPath = dataFilePath;
        if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
            targetPath = '/tmp/employees.json';
        }
        fs.writeFileSync(targetPath, JSON.stringify(employees, null, 2));
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

// Fallback for root (Handles serverless environments where static middleware might fail)
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            // Fallback to process.cwd() for some serverless setups
            res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
        }
    } catch (e) {
        res.status(500).send("Error loading home page");
    }
});

// API endpoint to fetch employee data
app.get('/api/employee/:slug', (req, res) => {
    const employees = getEmployees();
    const employee = employees.find(emp => emp.slug === req.params.slug);
    
    if (!employee) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    res.json(employee);
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

// Sitemap Route
app.get('/sitemap.xml', (req, res) => {
    const employees = getEmployees();
    const baseUrl = 'https://shaivikagroupsheros.netlify.app';
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <priority>1.0</priority>\n  </url>\n`;
    
    employees.forEach(employee => {
        if (employee.slug) {
            xml += `  <url>\n    <loc>${baseUrl}/${employee.slug}</loc>\n    <priority>0.8</priority>\n  </url>\n`;
        }
    });
    
    xml += `</urlset>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

// Clean URL Route (Fallback for /:slug)
app.get('/:slug', (req, res) => {
    // Ignore API routes
    if (req.path.startsWith('/api/')) return res.status(404).end();
    
    const filePath = path.join(__dirname, 'public', 'portfolio.html');
    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Portfolio template not found");
    }

    let html = fs.readFileSync(filePath, 'utf-8');
    
    // Inject SEO if employee exists
    const slug = req.params.slug;
    const employees = getEmployees();
    const employee = employees.find(e => e.slug === slug);

    if (employee) {
        const title = `${employee.fullName} | ${employee.role} | Shaivika`;
        const description = employee.summary ? employee.summary.substring(0, 150) + '...' : `View the professional portfolio of ${employee.fullName}.`;
        
        html = html.replace('<title>Employee Portfolio | Shaivika</title>', `<title>${title}</title>`);
        html = html.replace('content="Professional portfolio at Shaivika."', `content="${description}"`);
        html = html.replace('content="Employee Portfolio | Shaivika"', `content="${title}"`);
        html = html.replace('content="View professional portfolio."', `content="${description}"`);
        
        if (employee.profilePhotoUrl) {
            html = html.replace('id="og-image" content=""', `id="og-image" content="${employee.profilePhotoUrl}"`);
        }
        if (employee.portfolioUrl) {
            html = html.replace('id="og-url" content=""', `id="og-url" content="${employee.portfolioUrl}"`);
        }
        
        // Inject Advanced SEO (Twitter, Canonical, JSON-LD, Robots)
        const advancedSeo = `
    <!-- Advanced Dynamic SEO -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${employee.profilePhotoUrl || ''}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://shaivikagroupsheros.netlify.app/${slug}" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "${employee.fullName}",
      "jobTitle": "${employee.role}",
      "image": "${employee.profilePhotoUrl || ''}",
      "url": "https://shaivikagroupsheros.netlify.app/${slug}",
      "sameAs": [
        "${employee.linkedin || ''}",
        "${employee.github || ''}"
      ],
      "worksFor": {
        "@type": "Organization",
        "name": "Shaivika"
      }
    }
    </script>
</head>`;
        html = html.replace('</head>', advancedSeo);
    } else {
        // Private or Not Found profile - prevent indexing
        html = html.replace('</head>', `
    <meta name="robots" content="noindex, nofollow">
</head>`);
    }

    res.send(html);
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export for Vercel / Netlify
module.exports = app;
