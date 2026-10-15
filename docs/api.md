# API Documentation

## Endpoints

### 1. Root / Home Page
- **Method**: `GET`
- **Path**: `/`
- **Description**: Serves the primary portfolio submission single-page application (`public/index.html`).
- **Request**: None
- **Responses**:
  - `200 OK`: Returns HTML page content.
  - `500 Internal Server Error`: Returns `"Error loading home page"` on filesystem error.

---

### 2. Employee Profile View
- **Method**: `GET`
- **Path**: `/:slug`
- **Description**: Renders the server-side generated employee portfolio page. If not cached locally, attempts to retrieve the record from Google Apps Script.
- **Path Parameters**:
  - `slug` (string, required): Lowercase URL slug representing the employee.
- **Responses**:
  - `200 OK`: Server-side rendered HTML (`text/html; charset=utf-8`) with SEO metadata and portfolio details.
  - `404 Not Found`: Returns standard 404 HTML if the profile does not exist or lacks full name.

---

### 3. Fetch Employee Details
- **Method**: `GET`
- **Path**: `/api/employee/:slug`
- **Description**: Retrieves JSON data for an individual employee by their slug.
- **Path Parameters**:
  - `slug` (string, required): Lowercase URL slug representing the employee.
- **Responses**:
  - `200 OK`:
    ```json
    {
      "slug": "sharath-kumar",
      "fullName": "Sharath Kumar",
      "email": "sharath@example.com",
      "phone": "9876543210",
      "role": "Full Stack Developer",
      "linkedin": "https://linkedin.com/in/...",
      "github": "https://github.com/...",
      "summary": "...",
      "projects": [],
      "profilePhotoUrl": "https://res.cloudinary.com/...",
      "resumeUrl": "https://res.cloudinary.com/...",
      "portfolioUrl": "http://localhost:3001/sharath-kumar",
      "submittedAt": "2026-10-15T16:20:00.000Z"
    }
    ```
  - `404 Not Found`:
    ```json
    { "error": "Portfolio not found" }
    ```

---

### 4. Submit Employee Profile
- **Method**: `POST`
- **Path**: `/api/submit`
- **Content-Type**: `multipart/form-data`
- **Description**: Handles file uploads (profile photo and resume) to Cloudinary, creates employee record, caches locally, and returns payload for Google Apps Script sync.
- **Form Data Fields**:
  - `fullName` (string, required)
  - `email` (string, required)
  - `phone` (string)
  - `role` (string)
  - `linkedin` (string)
  - `github` (string)
  - `laptopName` (string)
  - `mobileName` (string)
  - `summary` (string)
  - `projects` (JSON string array)
  - `profilePhoto` (file, required - jpg/png/webp up to 10MB)
  - `resume` (file, required - pdf/doc/docx up to 10MB)
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Profile completed successfully.",
      "portfolioUrl": "http://localhost:3001/john-doe",
      "appsScriptUrl": "https://script.google.com/macros/s/.../exec",
      "employeeData": { ... }
    }
    ```
  - `400 Bad Request`:
    ```json
    { "error": "Resume file is required." }
    ```
  - `500 Internal Server Error`:
    ```json
    { "error": "An error occurred during submission." }
    ```

---

### 5. Proxy Resume Asset
- **Method**: `GET`
- **Path**: `/api/proxy-resume`
- **Description**: Fetches Cloudinary raw assets and serves them with `inline` Content-Disposition to enable native browser rendering.
- **Query Parameters**:
  - `url` (string, required): Cloudinary asset URL.
- **Responses**:
  - `200 OK`: Binary stream (`application/pdf`) with inline disposition.
  - `400 Bad Request`: Returns `"Invalid URL"` if target URL is missing or not a Cloudinary link.
  - `302 Found`: Redirects to Google Docs Viewer fallback if fetching fails.

---

### 6. XML Sitemap
- **Method**: `GET`
- **Path**: `/sitemap.xml`
- **Description**: Generates an XML sitemap of all active employee profiles and root page.
- **Responses**:
  - `200 OK`: XML document (`application/xml`).

---

### 7. Robots.txt
- **Method**: `GET`
- **Path**: `/robots.txt`
- **Description**: Provides web crawler instructions.
- **Responses**:
  - `200 OK`: Plain text (`text/plain`).
