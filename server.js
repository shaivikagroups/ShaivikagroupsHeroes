require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { generatePortfolioHTML, generate404HTML } = require('./lib/portfolioRenderer');

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
        const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
        if (isServerless) {
            // Try /tmp first (has data from previous submissions in this instance)
            if (fs.existsSync('/tmp/employees.json')) {
                return JSON.parse(fs.readFileSync('/tmp/employees.json', 'utf8'));
            }
            // Cold start: try multiple paths to find the bundled data file
            const candidatePaths = [
                dataFilePath,
                path.join(process.cwd(), 'data', 'employees.json'),
                path.join(__dirname, '..', 'data', 'employees.json'),
                path.join(__dirname, 'data', 'employees.json'),
            ];
            for (const p of candidatePaths) {
                if (fs.existsSync(p)) {
                    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                    // Warm /tmp for subsequent calls in this instance
                    fs.writeFileSync('/tmp/employees.json', JSON.stringify(data, null, 2));
                    return data;
                }
            }
            return [];
        }
        // Local dev: use the persistent data folder
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
        // Use /tmp for all serverless environments
        const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
        if (isServerless) {
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

async function fetchEmployeeFromSheet(slug) {
    if (!process.env.APPS_SCRIPT_WEB_APP_URL) return null;
    
    try {
        const url = `${process.env.APPS_SCRIPT_WEB_APP_URL}?slug=${encodeURIComponent(slug)}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.status === 'success' && data.data) {
            // Save it locally to warm up the cache
            saveEmployee(data.data);
            return data.data;
        }
    } catch (e) {
        console.error("Error fetching from Google Sheet:", e);
    }
    return null;
}

async function fetchSitemapSlugsFromSheet() {
    if (!process.env.APPS_SCRIPT_WEB_APP_URL) return [];
    try {
        const url = `${process.env.APPS_SCRIPT_WEB_APP_URL}?action=sitemap`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
            return data.data;
        }
    } catch (e) {
        console.error("Error fetching sitemap slugs:", e);
    }
    return [];
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
app.get('/api/employee/:slug', async (req, res) => {
    const slug = (req.params.slug || '').toLowerCase();
    const employees = getEmployees();
    let employee = employees.find(emp => emp.slug === slug);
    
    if (!employee) {
        employee = await fetchEmployeeFromSheet(slug);
    }
    
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

    // 1 & 2. Upload Profile Photo and Resume (Parallelized to avoid 10s serverless timeouts)
    const photoFilename = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Determine optimal Cloudinary resource type for the Resume
    const isPDF = req.files.resume[0].mimetype === 'application/pdf';
    const resumeResourceType = isPDF ? 'image' : 'raw';
    // Append .pdf to the filename if it's a PDF so Cloudinary correctly identifies and serves it
    const resumeFilename = isPDF 
        ? `employee_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`
        : `employee_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const [photoResult, resumeResult] = await Promise.all([
        uploadToCloudinary(req.files.profilePhoto[0].buffer, photoFilename, 'shaivika/employees/profile-photos', 'image'),
        uploadToCloudinary(req.files.resume[0].buffer, resumeFilename, 'shaivika/employees/resumes', resumeResourceType)
    ]);

    // Apply optimizations (f_auto, q_auto) to the URL
    const profilePhotoUrl = photoResult.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    const resumeUrl = resumeResult.secure_url;

    // 3. Generate Slug and Portfolio URL
    const slug = generateUniqueSlug(fullName);
    const proto   = req.headers['x-forwarded-proto'] || req.protocol;
    const host    = req.headers['x-forwarded-host']  || req.get('host');
    const portfolioUrl = `${proto}://${host}/${slug}`;

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

    // 5. Decouple Google Apps Script to bypass Netlify 10s Serverless timeout
    // We send the appsScriptUrl and the exact payload to the frontend, 
    // which will execute the slow Apps Script fetch in the background.
    const employeeDataPayload = {
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
    };

    res.status(200).json({ 
      success: true, 
      message: 'Profile completed successfully.',
      portfolioUrl: portfolioUrl,
      appsScriptUrl: process.env.APPS_SCRIPT_WEB_APP_URL || null,
      employeeData: employeeDataPayload
    });

  } catch (error) {
    console.error('Submission Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during submission.' });
  }
});

// ── Sitemap ─────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', async (req, res) => {
    const localEmployees = getEmployees();
    const sheetsSlugs = await fetchSitemapSlugsFromSheet();
    
    const slugMap = new Map();
    // 1. Add locals
    localEmployees.forEach(e => {
        if (e.slug) slugMap.set(e.slug, e.submittedAt || new Date().toISOString());
    });
    // 2. Add remote from Sheets
    sheetsSlugs.forEach(s => {
        if (s.slug && !slugMap.has(s.slug)) {
            slugMap.set(s.slug, s.submittedAt || new Date().toISOString());
        }
    });

    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host  = req.headers['x-forwarded-host']  || req.get('host');
    const baseUrl = `${proto}://${host}`;

    const urls = Array.from(slugMap.entries())
        .map(([slug, submittedAt]) => {
            const loc = `${baseUrl}/${slug}`;
            const lastmod = new Date(submittedAt).toISOString().split('T')[0];
            return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
        })
        .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
});

// ── Robots.txt ───────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host  = req.headers['x-forwarded-host']  || req.get('host');
    const baseUrl = `${proto}://${host}`;
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

// ── Clean URL Portfolio Route ─────────────────────────────────────────────────
app.get('/:slug', async (req, res) => {
    const slug = (req.params.slug || '').toLowerCase();

    // Skip static file extensions — express.static handles them
    if (/\.[a-zA-Z0-9]{1,6}$/.test(slug)) {
        return res.status(404).end();
    }

    const employees  = getEmployees();
    let employee   = employees.find(e => e.slug === slug);

    if (!employee) {
        employee = await fetchEmployeeFromSheet(slug);
    }

    // STRICT SEO REQUIREMENT: Never render placeholder "Employee"
    // If the record exists but has no name due to data corruption, throw 404.
    if (!employee || !employee.fullName || employee.fullName.trim() === '') {
        return res.status(404).send(generate404HTML(slug));
    }

    const proto      = req.headers['x-forwarded-proto'] || req.protocol;
    const host       = req.headers['x-forwarded-host']  || req.get('host');
    const baseUrl    = `${proto}://${host}`;
    const portfolioUrl = `${baseUrl}/${employee.slug}`;

    const html = generatePortfolioHTML(employee, portfolioUrl);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    res.send(html);
});

// ── Start Server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export for Netlify / Vercel
module.exports = app;
