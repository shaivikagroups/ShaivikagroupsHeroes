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

// Security: Disable X-Powered-By to prevent technology fingerprinting
app.disable('x-powered-by');

// Security: Enforce strict production headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Structured Audit Logger (System-Wide Standard)
function auditLog(actor, action, resourceId, status, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    actor: actor || 'anonymous',
    action: action,
    resource_id: resourceId || 'system',
    status: status,
    ...details
  };
  console.log(JSON.stringify(entry));
}

// In-memory rate limiter to prevent API abuse & brute force
const rateLimitMap = new Map();
function rateLimiter({ windowMs = 15 * 60 * 1000, max = 25, message = 'Too many requests. Please try again later.' }) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count++;
    rateLimitMap.set(ip, record);

    if (record.count > max) {
      auditLog(ip, 'rate_limit_exceeded', req.path, 'blocked');
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Input sanitizer helper to block XSS and malicious script payloads
function sanitizeText(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim()
    .slice(0, maxLen);
}

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

// Secure proxy to fetch Cloudinary raw/image assets and stream safely to the browser
app.get('/api/proxy-resume', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing URL parameter.');
    }

    try {
        const parsed = new URL(targetUrl);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        
        // Strict SSRF validation: only HTTPS, only Cloudinary CDN, and strictly scoped to this account
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
            auditLog('security', 'proxy_rejected_unauthorized_host', parsed.hostname, 'blocked');
            return res.status(403).send('Forbidden: External host not permitted.');
        }

        if (cloudName && !parsed.pathname.startsWith(`/${cloudName}/`)) {
            auditLog('security', 'proxy_rejected_invalid_cloud', parsed.pathname, 'blocked');
            return res.status(403).send('Forbidden: Cloud environment mismatch.');
        }

        const isDownload = req.query.download === 'true';
        const rawFilename = req.query.filename || 'Resume.pdf';
        const safeFilename = rawFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '');

        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`Cloudinary returned HTTP ${response.status}`);
        
        const contentType = response.headers.get('content-type') || 'application/pdf';
        const buffer = await response.arrayBuffer();
        
        res.setHeader('Content-Type', contentType.includes('octet-stream') ? 'application/pdf' : contentType);
        res.setHeader('Content-Disposition', isDownload ? `attachment; filename="${safeFilename}"` : 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        res.send(Buffer.from(buffer));
    } catch (e) {
        auditLog('system', 'proxy_resume_error', targetUrl, 'failed', { error: e.message });
        // Fallback to Google Docs viewer if direct streaming fails
        res.redirect(`https://docs.google.com/viewer?url=${encodeURIComponent(targetUrl)}&embedded=true`);
    }
});

// Fallback for root (Handles serverless environments where static middleware might fail)
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
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

// Server-side buffer for pending Google Sheets sync (Keeps secrets 100% off DevTools)
const pendingSheetSync = new Map();

async function triggerSheetSync(slug) {
    if (!process.env.APPS_SCRIPT_WEB_APP_URL) return false;
    
    const payload = pendingSheetSync.get(slug);
    if (!payload) return false;

    try {
        const response = await fetch(process.env.APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            pendingSheetSync.delete(slug);
            auditLog('system', 'google_sheet_sync', slug, 'success');
            return true;
        } else {
            auditLog('system', 'google_sheet_sync', slug, 'failed', { http_status: response.status });
        }
    } catch (err) {
        auditLog('system', 'google_sheet_sync', slug, 'failed', { error: err.message });
    }
    return false;
}

// Secure server-side decoupled sync endpoint (DevTools only sees this relative endpoint)
app.post('/api/sync-sheet', rateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }), async (req, res) => {
    const slug = (req.body.slug || '').toLowerCase();
    if (!slug) {
        return res.status(400).json({ error: 'Slug is required' });
    }

    // Trigger sync asynchronously on the server
    const success = await triggerSheetSync(slug);
    res.json({ success });
});

// API Endpoint to submit form (Hardened with rate limiting, input sanitization, and secret encapsulation)
app.post('/api/submit', 
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Submission limit reached for this session. Please try again later.' }),
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
  ]), 
  async (req, res) => {
  try {
    const fullName   = sanitizeText(req.body.fullName, 100);
    const email      = sanitizeText(req.body.email, 150).toLowerCase();
    const phone      = sanitizeText(req.body.phone, 25);
    const role       = sanitizeText(req.body.role, 100);
    const linkedin   = sanitizeText(req.body.linkedin, 250);
    const github     = sanitizeText(req.body.github, 250);
    const laptopName = sanitizeText(req.body.laptopName, 100);
    const mobileName = sanitizeText(req.body.mobileName, 100);
    const summary    = sanitizeText(req.body.summary, 3000);
    const projects   = req.body.projects || '[]';

    // Strict validation
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    if (!req.files || !req.files.resume) {
      return res.status(400).json({ error: 'Resume file is required.' });
    }
    if (!req.files || !req.files.profilePhoto) {
      return res.status(400).json({ error: 'Profile photo is required.' });
    }

    // 1 & 2. Upload Profile Photo and Resume
    const photoFilename = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const resumeFilename = `employee_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const [photoResult, resumeResult] = await Promise.all([
        uploadToCloudinary(req.files.profilePhoto[0].buffer, photoFilename, 'shaivika/employees/profile-photos', 'image'),
        uploadToCloudinary(req.files.resume[0].buffer, resumeFilename, 'shaivika/employees/resumes', 'image')
    ]);

    const profilePhotoUrl = photoResult.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    const resumeUrl = resumeResult.secure_url;

    // 3. Generate Slug and Portfolio URL
    const slug = generateUniqueSlug(fullName);
    const proto   = req.headers['x-forwarded-proto'] || req.protocol;
    const host    = req.headers['x-forwarded-host']  || req.get('host');
    const portfolioUrl = `${proto}://${host}/${slug}`;

    // 4. Save to Local Cache (Strictly excluding private device data from public profile)
    let parsedProjects = [];
    try {
        parsedProjects = JSON.parse(projects);
        if (Array.isArray(parsedProjects)) {
            parsedProjects = parsedProjects.map(p => ({
                name: sanitizeText(p.name, 100),
                description: sanitizeText(p.description, 1000),
                technologies: Array.isArray(p.technologies) ? p.technologies.map(t => sanitizeText(t, 50)) : [],
                projectUrl: sanitizeText(p.projectUrl, 250),
                githubUrl: sanitizeText(p.githubUrl, 250)
            }));
        }
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

    // 5. Store private hardware and sync details server-side only
    const employeeDataPayload = {
        fullName,
        email,
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

    pendingSheetSync.set(slug, employeeDataPayload);
    // Auto-cleanup after 15 minutes if not collected
    setTimeout(() => { pendingSheetSync.delete(slug); }, 15 * 60 * 1000);

    // Trigger immediate background sync
    triggerSheetSync(slug).catch(() => {});

    auditLog(email, 'profile_submitted', slug, 'success');

    // SECURE RESPONSE: Zero secrets, Zero private hardware fields, Zero Google Script URLs exposed
    res.status(200).json({ 
      success: true, 
      message: 'Profile completed successfully.',
      portfolioUrl: portfolioUrl,
      slug: slug
    });

  } catch (error) {
    auditLog('unknown', 'profile_submission_error', 'unknown', 'failed', { error: error.message });
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
