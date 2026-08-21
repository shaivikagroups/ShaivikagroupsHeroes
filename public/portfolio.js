document.addEventListener('DOMContentLoaded', async () => {
    // Attempt to get slug from query param first, then fallback to pathname
    const urlParams = new URLSearchParams(window.location.search);
    let slug = urlParams.get('slug');
    
    if (!slug) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            slug = pathParts[pathParts.length - 1]; // Get last part of the path
        }
    }

    if (!slug) {
        showError("No profile requested. URL is missing the slug.");
        return;
    }

    try {
        const response = await fetch(`/api/employee/${slug}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Server returned ${response.status} ${response.statusText}`);
        }
        
        const employee = await response.json();
        renderPortfolio(employee);
        
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
});

function showError(msg = "We couldn't find the requested profile.") {
    document.getElementById('loading-state').style.display = 'none';
    const errorState = document.getElementById('error-state');
    errorState.classList.remove('hidden');
    
    // Create or update error message text
    let errorText = document.getElementById('error-message-text');
    if (!errorText) {
        errorText = document.createElement('p');
        errorText.id = 'error-message-text';
        errorText.style.color = '#ff6b6b';
        errorText.style.marginTop = '1rem';
        errorText.style.fontWeight = 'bold';
        // Insert it before the Return Home button
        const btn = errorState.querySelector('.btn');
        errorState.insertBefore(errorText, btn);
    }
    errorText.textContent = msg;
}

function renderPortfolio(employee) {
    // Hide loader, show main
    document.getElementById('loading-state').style.display = 'none';
    const mainContent = document.getElementById('main-content');
    mainContent.style.opacity = '1';

    // SEO & Meta
    document.title = `${employee.fullName} | ${employee.role} | Shaivika`;
    const summaryText = employee.summary ? employee.summary.substring(0, 160) : `Professional portfolio of ${employee.fullName}, ${employee.role} at Shaivika.`;
    document.getElementById('meta-desc').content = summaryText;
    document.getElementById('og-desc').content = summaryText;
    document.getElementById('og-title').content = `${employee.fullName} | ${employee.role} | Shaivika`;
    if (employee.profilePhotoUrl) document.getElementById('og-image').content = employee.profilePhotoUrl;
    
    const fullUrl = window.location.href;
    document.getElementById('meta-canonical').href = fullUrl;
    document.getElementById('og-url').content = fullUrl;

    // Names
    const nameParts = employee.fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    document.getElementById('name-first').textContent = firstName;
    if (lastName) {
        document.getElementById('name-last').textContent = lastName;
    }

    document.getElementById('hero-role').textContent = employee.role;
    
    // Photo
    if (employee.profilePhotoUrl) {
        document.getElementById('profile-img').src = employee.profilePhotoUrl;
    }

    // Nav Resume
    if (employee.resumeUrl) {
        const navResume = document.getElementById('nav-resume-btn');
        navResume.href = employee.resumeUrl;
        navResume.classList.remove('hidden');
    }

    // Hero Actions
    if (employee.linkedin) {
        const btn = document.getElementById('btn-linkedin');
        btn.href = employee.linkedin;
        btn.classList.remove('hidden');
    }
    if (employee.github) {
        const btn = document.getElementById('btn-github');
        btn.href = employee.github;
        btn.classList.remove('hidden');
    }
    if (employee.resumeUrl) {
        const btn = document.getElementById('btn-resume');
        btn.href = employee.resumeUrl;
        btn.classList.remove('hidden');
    }

    // About Section
    if (employee.summary) {
        document.getElementById('hero-summary').textContent = employee.summary;
        
        document.getElementById('about').classList.remove('hidden');
        document.getElementById('nav-about-link').classList.remove('hidden');
        document.getElementById('about-desc').textContent = employee.summary;
    }

    // Projects & Tech
    let allTech = [];
    if (employee.projects && employee.projects.length > 0) {
        document.getElementById('projects-section').classList.remove('hidden');
        document.getElementById('nav-projects-link').classList.remove('hidden');
        
        const projectList = document.getElementById('project-list');
        
        employee.projects.forEach((project, index) => {
            // Collect Tech
            if (project.technologies) {
                project.technologies.forEach(t => {
                    const tech = t.trim();
                    if (tech && !allTech.includes(tech)) {
                        allTech.push(tech);
                    }
                });
            }

            // Build Project Card
            const row = document.createElement('div');
            row.className = 'project-row reveal active';
            
            let techHTML = '';
            if (project.technologies) {
                techHTML = project.technologies.map(t => `<span class="tech-pill">${t}</span>`).join('');
            }
            
            let linksHTML = '';
            if (project.projectUrl) {
                linksHTML += `
                    <a href="${project.projectUrl}" target="_blank" class="link-anim" style="color: var(--blue);">
                        Live Preview 
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                `;
            }
            if (project.githubUrl) {
                linksHTML += `
                    <a href="${project.githubUrl}" target="_blank" class="link-anim">
                        GitHub Source
                    </a>
                `;
            }

            row.innerHTML = `
                <div class="project-info">
                    <span class="project-num">0${index + 1}</span>
                    <h3 class="project-title">${project.name}</h3>
                    <p class="project-desc">${project.description}</p>
                    <div class="project-tech">
                        ${techHTML}
                    </div>
                    <div class="project-links">
                        ${linksHTML}
                    </div>
                </div>
            `;
            projectList.appendChild(row);
        });
    }

    // Tech Section
    if (allTech.length > 0) {
        document.getElementById('skills-section').classList.remove('hidden');
        document.getElementById('nav-skills-link').classList.remove('hidden');
        const techGrid = document.getElementById('tech-grid');
        
        allTech.forEach(tech => {
            const card = document.createElement('div');
            card.className = 'tech-card';
            card.innerHTML = `<div class="tech-dot" style="background: var(--blue);"></div>${tech}`;
            techGrid.appendChild(card);
        });
    }

    // Connect Links
    const connectLinks = document.getElementById('connect-links');
    if (employee.linkedin) {
        connectLinks.innerHTML += `
            <a href="${employee.linkedin}" target="_blank" class="btn btn-secondary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                LinkedIn Profile
            </a>
        `;
    }
    if (employee.github) {
        connectLinks.innerHTML += `
            <a href="${employee.github}" target="_blank" class="btn btn-secondary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                GitHub Profile
            </a>
        `;
    }
    if (employee.resumeUrl) {
        connectLinks.innerHTML += `
            <a href="${employee.resumeUrl}" target="_blank" class="btn btn-primary">
                View Complete Resume
            </a>
        `;
    }

    // Trigger Reveal Animation for statically present elements (dynamic ones got 'active' already)
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    obs.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -100px 0px" });
        revealElements.forEach(el => observer.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('active'));
    }
}
