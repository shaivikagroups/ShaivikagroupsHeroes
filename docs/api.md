# API Documentation

## Security Architecture & Policies
- **Technology Cloaking**: `X-Powered-By` header is strictly disabled to prevent server profiling.
- **Security Headers**: All responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-XSS-Protection`.
- **Secret Encapsulation**: Cloudinary secrets and Google Apps Script Web App endpoints are strictly server-side and never exposed to the client or Developer Tools.
- **Rate Limiting**: Built-in in-memory rate limiting applied to `/api/submit` and `/api/sync-sheet`.
- **SSRF Protection**: Proxy endpoints strictly whitelist the application's assigned Cloudinary account domain.

---

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
- **Security**: Rate-limited (max 10 submissions per 15 min per IP), sanitized inputs.
- **Description**: Uploads media to Cloudinary, creates employee record, buffers server-side Google Sheets synchronization payload, and returns clean portfolio details without exposing external URLs.
- **Form Data Fields**:
  - `fullName` (string, required, max 100 chars)
  - `email` (string, required, valid email format)
  - `phone` (string, max 25 chars)
  - `role` (string, max 100 chars)
  - `linkedin` (string, max 250 chars)
  - `github` (string, max 250 chars)
  - `laptopName` (string, max 100 chars - stored securely server-side)
  - `mobileName` (string, max 100 chars - stored securely server-side)
  - `summary` (string, max 3000 chars)
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
      "slug": "john-doe"
    }
    ```
  - `400 Bad Request`:
    ```json
    { "error": "Resume file is required." }
    ```
  - `429 Too Many Requests`:
    ```json
    { "error": "Submission limit reached for this session. Please try again later." }
    ```
  - `500 Internal Server Error`:
    ```json
    { "error": "An error occurred during submission." }
    ```

---

### 5. Decoupled Sheet Synchronization
- **Method**: `POST`
- **Path**: `/api/sync-sheet`
- **Content-Type**: `application/json`
- **Security**: Rate-limited (max 30 requests per 15 min per IP), relative internal routing.
- **Description**: Triggers server-side push of the buffered employee record to Google Apps Script. Shields Google Apps Script Web App URL and private device details from browser Developer Tools.
- **Request Body**:
  ```json
  {
    "slug": "john-doe"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    { "success": true }
    ```
  - `400 Bad Request`:
    ```json
    { "error": "Slug is required" }
    ```

---

### 6. Proxy Resume Asset
- **Method**: `GET`
- **Path**: `/api/proxy-resume`
- **Security**: Strict SSRF verification; whitelisted to `res.cloudinary.com` scoped to current Cloudinary cloud name.
- **Description**: Fetches Cloudinary assets and streams them to the browser. Supports inline viewing and sanitized attachment downloads.
- **Query Parameters**:
  - `url` (string, required): Cloudinary asset URL.
  - `download` (boolean, optional): Set to `true` to force attachment download.
  - `filename` (string, optional): Clean filename for download header.
- **Responses**:
  - `200 OK`: Binary stream (`application/pdf`) with `inline` or `attachment` Content-Disposition.
  - `400 Bad Request`: Returns `"Missing URL parameter."`
  - `403 Forbidden`: Returns `"Forbidden"` if URL is not an authorized Cloudinary asset.
  - `302 Found`: Redirects to Google Docs Viewer fallback if fetching fails.

---

### 7. XML Sitemap
- **Method**: `GET`
- **Path**: `/sitemap.xml`
- **Description**: Generates an XML sitemap of all active employee profiles and root page.
- **Responses**:
  - `200 OK`: XML document (`application/xml`).

---

### 8. Robots.txt
- **Method**: `GET`
- **Path**: `/robots.txt`
- **Description**: Provides web crawler instructions.
- **Responses**:
  - `200 OK`: Plain text (`text/plain`).
