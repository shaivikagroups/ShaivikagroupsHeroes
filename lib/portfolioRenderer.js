'use strict';

/**
 * Shaivika Dynamic Portfolio Engine V5
 * Server-Side HTML Renderer
 *
 * Generates a complete, SEO-ready HTML page for any employee.
 * Zero dependencies on static template files.
 * XSS-safe: all employee data is escaped before rendering.
 */

// ─── HTML Escape ────────────────────────────────────────────────────────────
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// ─── URL Validation ──────────────────────────────────────────────────────────
function safeUrl(url) {
    if (!url) return null;
    const s = String(url).trim();
    if (s.startsWith('https://') || s.startsWith('http://')) return s;
    return null;
}

// ─── Truncate ────────────────────────────────────────────────────────────────
function truncate(str, max) {
    if (!str) return '';
    const s = String(str);
    return s.length > max ? s.substring(0, max - 3) + '...' : s;
}

// ─── Initials Fallback ───────────────────────────────────────────────────────
function getInitials(name) {
    if (!name) return 'S';
    return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

// ─── Tech Icon SVG ─────────────────────────────────────────────────────────
function getTechIcon(tech) {
    const key = tech.toLowerCase().trim();
    
    const deviconMap = {
        python: 'python', javascript: 'javascript', typescript: 'typescript', java: 'java',
        react: 'react', 'node.js': 'nodejs', nodejs: 'nodejs', express: 'express',
        html: 'html5', css: 'css3', mongodb: 'mongodb', postgresql: 'postgresql',
        mysql: 'mysql', firebase: 'firebase', docker: 'docker', kubernetes: 'kubernetes',
        aws: 'amazonwebservices', gcp: 'googlecloud', azure: 'azure', git: 'git',
        flutter: 'flutter', dart: 'dart', 'c++': 'cplusplus', c: 'c',
        rust: 'rust', go: 'go', php: 'php', ruby: 'ruby',
        swift: 'swift', kotlin: 'kotlin', r: 'r',
        tensorflow: 'tensorflow', pytorch: 'pytorch',
        django: 'django', flask: 'flask', fastapi: 'fastapi', spring: 'spring',
        vue: 'vuejs', angular: 'angularjs', svelte: 'svelte', next: 'nextjs',
        'next.js': 'nextjs', tailwind: 'tailwindcss', figma: 'figma', xd: 'xd',
        blender: 'blender', unity: 'unity',
        linux: 'linux', bash: 'bash', redis: 'redis'
    };

    let iconName = null;
    for (const [k, v] of Object.entries(deviconMap)) {
        // use exact match or includes for certain common terms
        if (key === k || (key.includes(k) && k.length > 2)) {
            iconName = v;
            break;
        }
    }
    
    if (iconName) {
        return `<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${iconName}/${iconName}-original.svg" alt="${esc(tech)}" style="width:24px; height:24px; display:block;" onerror="this.outerHTML='💡'">`;
    }
    
    return '💡';
}

// ─── Description Builder ─────────────────────────────────────────────────────
function buildDescription(employee) {
    if (employee.summary && employee.summary.length > 20) {
        // Use actual summary, trim to 155 chars
        const raw = employee.summary.replace(/\s+/g, ' ').trim();
        return truncate(`${employee.fullName} — ${raw}`, 160);
    }
    const role = employee.role || 'Professional';
    return `Explore ${employee.fullName}'s professional portfolio, featured projects and work as a ${role} at Shaivika Groups.`;
}

// ─── Schema.org JSON-LD ──────────────────────────────────────────────────────
function buildJsonLd(employee, portfolioUrl) {
    const person = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: employee.fullName,
        jobTitle: employee.role || undefined,
        url: portfolioUrl,
        worksFor: {
            '@type': 'Organization',
            name: 'Shaivika Groups',
            url: 'https://shaivikagroupsheros.netlify.app',
        },
    };

    if (employee.profilePhotoUrl) person.image = employee.profilePhotoUrl;

    const sameAs = [];
    if (safeUrl(employee.linkedin)) sameAs.push(safeUrl(employee.linkedin));
    if (safeUrl(employee.github)) sameAs.push(safeUrl(employee.github));
    if (sameAs.length > 0) person.sameAs = sameAs;

    const breadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://shaivikagroupsheros.netlify.app' },
            { '@type': 'ListItem', position: 2, name: 'Employees', item: 'https://shaivikagroupsheros.netlify.app' },
            { '@type': 'ListItem', position: 3, name: employee.fullName, item: portfolioUrl },
        ],
    };

    return [person, breadcrumb];
}

// ─── Project Cards HTML ──────────────────────────────────────────────────────
function buildProjectCards(projects) {
    if (!projects || projects.length === 0) return '';

    return projects.map((project, i) => {
        if (!project.name) return '';

        const techPills = (project.technologies || [])
            .filter(t => t && t.trim())
            .map(t => `<span class="pg-tech-pill">${esc(t.trim())}</span>`)
            .join('');

        const liveLink = safeUrl(project.projectUrl)
            ? `<a href="${esc(safeUrl(project.projectUrl))}" target="_blank" rel="noopener noreferrer" class="pg-project-link pg-project-link-live" aria-label="Live preview of ${esc(project.name)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Live Preview
               </a>` : '';

        const githubLink = safeUrl(project.githubUrl)
            ? `<a href="${esc(safeUrl(project.githubUrl))}" target="_blank" rel="noopener noreferrer" class="pg-project-link pg-project-link-github" aria-label="GitHub repository for ${esc(project.name)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                  GitHub
               </a>` : '';

        const numLabel = String(i + 1).padStart(2, '0');

        return `
        <article class="pg-project-card pg-reveal" aria-label="${esc(project.name)}">
            <div class="pg-project-header">
                <span class="pg-project-num" aria-hidden="true">${esc(numLabel)}</span>
                <h3 class="pg-project-title">${esc(project.name)}</h3>
            </div>
            ${project.description ? `<p class="pg-project-desc">${esc(project.description)}</p>` : ''}
            ${techPills ? `<div class="pg-tech-pills" role="list" aria-label="Technologies used">${techPills}</div>` : ''}
            ${(liveLink || githubLink) ? `<div class="pg-project-links">${liveLink}${githubLink}</div>` : ''}
        </article>`;
    }).join('');
}

// ─── Tech Grid HTML ──────────────────────────────────────────────────────────
function buildTechGrid(allTech) {
    if (!allTech || allTech.length === 0) return '';
    return allTech.map(tech => `
        <div class="pg-tech-card" role="listitem">
            <div class="pg-tech-icon" aria-hidden="true">${getTechIcon(tech)}</div>
            <span>${esc(tech)}</span>
        </div>`).join('');
}

// ─── Extract all unique technologies from projects ───────────────────────────
function extractTech(projects) {
    if (!projects || projects.length === 0) return [];
    const seen = new Set();
    const tech = [];
    projects.forEach(p => {
        (p.technologies || []).forEach(t => {
            const trimmed = t.trim();
            if (trimmed && !seen.has(trimmed.toLowerCase())) {
                seen.add(trimmed.toLowerCase());
                tech.push(trimmed);
            }
        });
    });
    return tech;
}

// ─── Nav Links ───────────────────────────────────────────────────────────────
function buildNavLinks(employee, allTech, resumeUrl) {
    const links = [{ href: '#home', label: 'Home' }];
    if (employee.summary) links.push({ href: '#about', label: 'About' });
    if (employee.projects && employee.projects.length > 0) links.push({ href: '#projects', label: 'Projects' });
    if (allTech.length > 0) links.push({ href: '#skills', label: 'Skills' });

    const navHtml = links.map(l =>
        `<a href="${esc(l.href)}" class="pg-nav-link" data-target="${esc(l.href)}">${esc(l.label)}</a>`
    ).join('');

    const resumeBtn = safeUrl(resumeUrl)
        ? `<a href="${esc(safeUrl(resumeUrl))}" target="_blank" rel="noopener noreferrer" class="pg-nav-resume" aria-label="Download ${esc(employee.fullName)}'s resume">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
               Resume
           </a>` : '';

    const mobileLinks = links.map(l =>
        `<a href="${esc(l.href)}" class="pg-mobile-link">${esc(l.label)}</a>`
    ).join('');

    return { navHtml, resumeBtn, mobileLinks };
}

// ─── Hero Stats ──────────────────────────────────────────────────────────────
function buildStats(employee, allTech) {
    const stats = [];
    const pCount = (employee.projects || []).filter(p => p.name).length;
    const tCount = allTech.length;

    if (pCount > 0) stats.push({ num: pCount, label: pCount === 1 ? 'Project' : 'Projects' });
    if (tCount > 0) stats.push({ num: tCount, label: tCount === 1 ? 'Technology' : 'Technologies' });

    if (stats.length === 0) return '';
    return `<div class="pg-stat-row">
        ${stats.map(s => `
        <div class="pg-stat">
            <div class="pg-stat-num">${s.num}</div>
            <div class="pg-stat-label">${esc(s.label)}</div>
        </div>`).join('')}
    </div>`;
}

// ─── Social Buttons ──────────────────────────────────────────────────────────
function buildSocialButtons(employee) {
    const buttons = [];

    if (safeUrl(employee.linkedin)) {
        buttons.push(`<a href="${esc(safeUrl(employee.linkedin))}" target="_blank" rel="noopener noreferrer" class="pg-btn pg-btn-outline" aria-label="${esc(employee.fullName)}'s LinkedIn profile">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
            LinkedIn
        </a>`);
    }

    if (safeUrl(employee.github)) {
        buttons.push(`<a href="${esc(safeUrl(employee.github))}" target="_blank" rel="noopener noreferrer" class="pg-btn pg-btn-outline" aria-label="${esc(employee.fullName)}'s GitHub profile">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            GitHub
        </a>`);
    }

    if (safeUrl(employee.resumeUrl)) {
        buttons.push(`<a href="${esc(safeUrl(employee.resumeUrl))}" target="_blank" rel="noopener noreferrer" class="pg-btn pg-btn-primary" aria-label="View ${esc(employee.fullName)}'s resume">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            View Resume
        </a>`);
    }

    return buttons.join('');
}

// ─── Profile Photo HTML ──────────────────────────────────────────────────────
function buildProfilePhoto(employee) {
    const initials = getInitials(employee.fullName);
    const altText = `${esc(employee.fullName)}${employee.role ? ' - ' + esc(employee.role) : ''} at Shaivika`;

    if (safeUrl(employee.profilePhotoUrl)) {
        // Use Cloudinary responsive transformations
        const rawUrl = safeUrl(employee.profilePhotoUrl);
        const optimizedUrl = rawUrl.includes('cloudinary.com')
            ? rawUrl.replace('/upload/', '/upload/f_auto,q_auto,w_400/')
            : rawUrl;
        return `<img src="${esc(optimizedUrl)}" alt="${altText}" class="pg-profile-img" loading="eager" fetchpriority="high" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';">
                <div class="pg-profile-placeholder" style="display:none" aria-hidden="true">${esc(initials)}</div>`;
    }
    return `<div class="pg-profile-placeholder" aria-label="${altText}">${esc(initials)}</div>`;
}

// ─── Main Renderer ───────────────────────────────────────────────────────────
function generatePortfolioHTML(employee, portfolioUrl) {
    const name = esc(employee.fullName || 'Employee');
    const role = esc(employee.role || '');
    const summary = employee.summary && employee.summary.length > 20 ? employee.summary : null;
    const projects = (employee.projects || []).filter(p => p && p.name);
    const allTech = extractTech(projects);
    const description = buildDescription(employee);
    const pageTitle = role
        ? `${employee.fullName} | ${employee.role} | Shaivika`
        : `${employee.fullName} | Professional Portfolio | Shaivika`;
    const jsonLd = buildJsonLd(employee, portfolioUrl);
    const photoUrl = safeUrl(employee.profilePhotoUrl) || '';
    const { navHtml, resumeBtn, mobileLinks } = buildNavLinks(employee, allTech, employee.resumeUrl);
    const socialButtons = buildSocialButtons(employee);
    const projectCards = buildProjectCards(projects);
    const techGrid = buildTechGrid(allTech);
    const stats = buildStats(employee, allTech);
    const nameParts = (employee.fullName || 'Employee').trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <!-- Primary SEO -->
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(truncate(description, 160))}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${esc(portfolioUrl)}">

    <!-- Open Graph (WhatsApp, Facebook, LinkedIn) -->
    <meta property="og:type" content="profile">
    <meta property="og:title" content="${esc(pageTitle)}">
    <meta property="og:description" content="${esc(truncate(description, 200))}">
    <meta property="og:url" content="${esc(portfolioUrl)}">
    ${photoUrl ? `<meta property="og:image" content="${esc(photoUrl)}">
    <meta property="og:image:alt" content="${esc(employee.fullName)} - ${esc(employee.role || 'Professional')} at Shaivika">` : ''}
    <meta property="og:site_name" content="Shaivika Groups">

    <!-- Twitter / X -->
    <meta name="twitter:card" content="${photoUrl ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${esc(pageTitle)}">
    <meta name="twitter:description" content="${esc(truncate(description, 200))}">
    ${photoUrl ? `<meta name="twitter:image" content="${esc(photoUrl)}">
    <meta name="twitter:image:alt" content="${esc(employee.fullName)} - ${esc(employee.role || 'Professional')} at Shaivika">` : ''}

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="https://res.cloudinary.com/dzfntkzce/image/upload/v1787328790/Shaivika_Groups_LogoA12_e1cwfa.png">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!-- Portfolio CSS -->
    <link rel="stylesheet" href="/portfolio.css">

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">${JSON.stringify(jsonLd[0])}</script>
    <script type="application/ld+json">${JSON.stringify(jsonLd[1])}</script>
</head>
<body>
    <!-- Background System -->
    <div class="pg-bg" aria-hidden="true">
        <div class="pg-bg-mesh"></div>
        <div class="pg-watermark"></div>
    </div>

    <!-- Navigation -->
    <nav class="pg-nav" role="navigation" aria-label="Portfolio navigation" id="pg-nav">
        <div class="pg-nav-inner">
            <a href="/" class="pg-nav-logo" aria-label="Shaivika Groups — Home">
                <img src="https://res.cloudinary.com/dzfntkzce/image/upload/v1787327106/shaivika_goups_logo_with_background_zym7ap.png"
                     alt="Shaivika Groups" width="36" height="36" loading="eager">
            </a>

            <!-- Desktop Nav -->
            <div class="pg-nav-links" role="list" aria-label="Page sections">
                ${navHtml}
            </div>

            ${resumeBtn}

            <!-- Hamburger -->
            <button class="pg-hamburger" id="pg-hamburger" aria-label="Toggle menu" aria-expanded="false" aria-controls="pg-mobile-menu">
                <span></span><span></span><span></span>
            </button>
        </div>
    </nav>

    <!-- Mobile Menu -->
    <div class="pg-mobile-menu" id="pg-mobile-menu" role="menu" aria-hidden="true">
        ${mobileLinks}
        ${safeUrl(employee.resumeUrl) ? `<a href="${esc(safeUrl(employee.resumeUrl))}" target="_blank" rel="noopener noreferrer" class="pg-mobile-link">Download Resume</a>` : ''}
    </div>

    <!-- Main Content -->
    <main class="pg-main" id="main-content">

        <!-- ── HERO ────────────────────────────────────────────────────── -->
        <section class="pg-section pg-hero" id="home" aria-label="${name}'s introduction">
            <div class="pg-container">
                <div class="pg-hero-grid">

                    <!-- Left: Content -->
                    <div class="pg-hero-content pg-reveal">
                        <div class="pg-hero-greeting" aria-label="Introduction">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>
                            HELLO, I'M
                        </div>

                        <h1 class="pg-hero-name">
                            ${firstName ? `<span>${esc(firstName)}</span>` : ''}
                            ${lastName ? `<br><span class="pg-name-highlight">${esc(lastName)}</span>` : ''}
                        </h1>

                        ${role ? `
                        <div class="pg-hero-role">
                            <span class="pg-role-badge">
                                <span class="pg-role-dot" aria-hidden="true"></span>
                                ${role}
                            </span>
                        </div>` : ''}

                        ${summary ? `<p class="pg-hero-summary">${esc(summary)}</p>` : ''}

                        ${stats}

                        <div class="pg-hero-actions" role="list" aria-label="Professional links">
                            ${socialButtons}
                        </div>
                    </div>

                    <!-- Right: Profile Photo -->
                    <div class="pg-hero-visual pg-reveal" style="--delay:0.15s">
                        <div class="pg-profile-wrap">
                            <div class="pg-float-decor pg-float-1" aria-hidden="true"></div>
                            <div class="pg-float-decor pg-float-2" aria-hidden="true"></div>
                            <div class="pg-float-decor pg-float-3" aria-hidden="true"></div>

                            <div class="pg-profile-card" id="profile-card" role="img" aria-label="Profile photo of ${name}">
                                ${buildProfilePhoto(employee)}
                                <div class="pg-verified-badge" aria-label="Verified Shaivika Professional">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>

        ${summary ? `
        <!-- ── ABOUT ────────────────────────────────────────────────────── -->
        <section class="pg-section" id="about" aria-label="About ${name}">
            <div class="pg-container">
                <div class="pg-about pg-reveal">
                    <div class="pg-about-grid">
                        <div class="pg-about-left">
                            <div class="pg-section-badge pg-section-badge-gold">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>
                                ABOUT ME
                            </div>
                            <h2 class="pg-section-title">Professional Profile</h2>
                            <p class="pg-section-desc">${esc(summary)}</p>
                        </div>
                        <div class="pg-trait-list" role="list" aria-label="Professional traits">
                            <div class="pg-trait" role="listitem">
                                <div class="pg-trait-icon pg-trait-icon-gold" aria-hidden="true">⚡</div>
                                <div class="pg-trait-text">
                                    <strong>Results Driven</strong>
                                    <span>Focused on impact</span>
                                </div>
                            </div>
                            <div class="pg-trait" role="listitem">
                                <div class="pg-trait-icon pg-trait-icon-blue" aria-hidden="true">🎯</div>
                                <div class="pg-trait-text">
                                    <strong>Problem Solver</strong>
                                    <span>Analytical mindset</span>
                                </div>
                            </div>
                            <div class="pg-trait" role="listitem">
                                <div class="pg-trait-icon pg-trait-icon-green" aria-hidden="true">🤝</div>
                                <div class="pg-trait-text">
                                    <strong>Team Player</strong>
                                    <span>Collaborative spirit</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>` : ''}

        ${projects.length > 0 ? `
        <!-- ── PROJECTS ──────────────────────────────────────────────────── -->
        <section class="pg-section" id="projects" aria-label="Featured Projects">
            <div class="pg-container">
                <div class="pg-reveal">
                    <div class="pg-section-badge pg-section-badge-blue">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>
                        PORTFOLIO
                    </div>
                    <h2 class="pg-section-title">${projects.length === 1 ? 'Featured Project' : `${projects.length} Featured Projects`}</h2>
                </div>
                <div class="pg-project-list" role="list">
                    ${projectCards}
                </div>
            </div>
        </section>` : ''}

        ${allTech.length > 0 ? `
        <!-- ── TECHNOLOGIES ───────────────────────────────────────────────── -->
        <section class="pg-section" id="skills" aria-label="Technologies and Skills">
            <div class="pg-container">
                <div class="pg-reveal" style="text-align:center; margin-bottom: 2rem;">
                    <div class="pg-section-badge pg-section-badge-green" style="justify-content:center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>
                        TECHNOLOGIES
                    </div>
                    <h2 class="pg-section-title">Tools &amp; Technologies</h2>
                </div>
                <div class="pg-tech-grid pg-reveal" role="list" aria-label="Technologies used by ${name}">
                    ${techGrid}
                </div>
            </div>
        </section>` : ''}

        <!-- ── CONNECT ───────────────────────────────────────────────────── -->
        <section class="pg-section" id="connect" aria-label="Connect with ${name}">
            <div class="pg-container-sm">
                <div class="pg-connect pg-reveal">
                    <h2 class="pg-connect-title">Ready to Connect?</h2>
                    <p class="pg-connect-desc">Reach out to ${name} for professional opportunities and collaborations.</p>
                    <div class="pg-connect-actions">
                        ${socialButtons || `<a href="/" class="pg-btn pg-btn-primary">Back to Home</a>`}
                    </div>
                </div>
            </div>
        </section>

    </main>

    <!-- Footer -->
    <footer class="pg-footer" role="contentinfo">
        <!-- Decorative floating orbs (CSS handles them via ::before/::after) -->

        <!-- Top glow bar -->
        <div class="pg-footer-glow-bar" aria-hidden="true">
            <div class="pg-footer-glow-bar-inner"></div>
        </div>

        <div class="pg-footer-inner">

            <!-- Brand -->
            <div class="pg-footer-brand">
                <img src="https://res.cloudinary.com/dzfntkzce/image/upload/v1787327106/shaivika_goups_logo_with_background_zym7ap.png"
                     alt="Shaivika Groups" class="pg-footer-logo" width="56" height="56" loading="lazy">
            </div>

            <!-- Employee Identity -->
            <div class="pg-footer-identity">
                <h2 class="pg-footer-name">${name}</h2>
                ${role ? `
                <div class="pg-footer-role-badge">
                    <span class="pg-footer-role-dot" aria-hidden="true"></span>
                    ${esc(employee.role)}
                </div>` : ''}
            </div>

            <!-- Email -->
            ${employee.email ? `
            <a href="mailto:${esc(employee.email)}" class="pg-footer-email" aria-label="Send email to ${name}">
                <span class="pg-footer-email-icon" aria-hidden="true">📧</span>
                <span>${esc(employee.email)}</span>
            </a>` : ''}

            <!-- Social Links Row -->
            <div class="pg-footer-socials">
                ${safeUrl(employee.linkedin) ? `
                <a href="${esc(safeUrl(employee.linkedin))}" target="_blank" rel="noopener noreferrer" class="pg-footer-social pg-footer-social-li" aria-label="LinkedIn profile">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    <span>LinkedIn</span>
                </a>` : ''}
                ${safeUrl(employee.github) ? `
                <a href="${esc(safeUrl(employee.github))}" target="_blank" rel="noopener noreferrer" class="pg-footer-social pg-footer-social-gh" aria-label="GitHub profile">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                    <span>GitHub</span>
                </a>` : ''}
                ${safeUrl(employee.resumeUrl) ? `
                <a href="${esc(safeUrl(employee.resumeUrl))}" target="_blank" rel="noopener noreferrer" class="pg-footer-social pg-footer-social-cv" aria-label="Download Resume">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>Resume</span>
                </a>` : ''}
            </div>

            <!-- Bottom bar -->
            <div class="pg-footer-bottom">
                <div class="pg-footer-divider" aria-hidden="true"></div>
                <div class="pg-footer-bottom-row">
                    <p class="pg-footer-tagline">⚡ Building People. Building Technology.</p>
                    <p class="pg-footer-copy">&copy; ${new Date().getFullYear()} Shaivika Groups</p>
                </div>
            </div>

        </div>
    </footer>

    <!-- Interaction Scripts (no SEO dependency) -->
    <script src="/portfolio.js" defer></script>
</body>
</html>`;
}

// ─── 404 Page ────────────────────────────────────────────────────────────────
function generate404HTML(slug) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 | Portfolio Not Found | Shaivika</title>
    <meta name="robots" content="noindex, nofollow">
    <meta name="description" content="The requested portfolio could not be found.">
    <link rel="icon" type="image/png" href="https://res.cloudinary.com/dzfntkzce/image/upload/v1787328790/Shaivika_Groups_LogoA12_e1cwfa.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/portfolio.css">
</head>
<body>
    <div class="pg-bg" aria-hidden="true"><div class="pg-bg-mesh"></div></div>
    <nav class="pg-nav" role="navigation" aria-label="Site navigation">
        <div class="pg-nav-inner">
            <a href="/" class="pg-nav-logo" aria-label="Shaivika Groups — Home">
                <img src="https://res.cloudinary.com/dzfntkzce/image/upload/v1787327106/shaivika_goups_logo_with_background_zym7ap.png"
                     alt="Shaivika Groups" width="36" height="36">
            </a>
            <div class="pg-nav-links"><a href="/" class="pg-nav-link">Home</a></div>
        </div>
    </nav>
    <main class="pg-main">
        <div class="pg-404" role="main">
            <div class="pg-container-sm" style="text-align:center">
                <div class="pg-404-code" aria-label="Error 404">404</div>
                <h1 class="pg-404-title">Portfolio Not Found</h1>
                <p class="pg-404-desc">
                    The portfolio <strong>${esc(slug || 'requested')}</strong> doesn't exist yet.
                    It may have been removed or the URL may be incorrect.
                </p>
                <a href="/" class="pg-btn pg-btn-primary" style="display:inline-flex; margin-top:1rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    Return Home
                </a>
            </div>
        </div>
    </main>
    <footer class="pg-footer" role="contentinfo">
        <div class="pg-footer-inner">
            <img src="https://res.cloudinary.com/dzfntkzce/image/upload/v1787327106/shaivika_goups_logo_with_background_zym7ap.png"
                 alt="Shaivika Groups" class="pg-footer-logo" width="80" height="40" loading="lazy">
            <div class="pg-footer-divider" aria-hidden="true"></div>
            <p class="pg-footer-tagline">Building People. Building Technology.</p>
            <p class="pg-footer-copy">&copy; ${new Date().getFullYear()} Shaivika Groups &mdash; All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;
}

module.exports = { generatePortfolioHTML, generate404HTML };
