document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const form = document.getElementById('onboarding-form');
    const roleSelect = document.getElementById('role');
    const customRoleGroup = document.getElementById('customRoleGroup');
    const customRoleInput = document.getElementById('customRole');
    
    // Summary
    const summaryInput = document.getElementById('summary');
    const summaryCount = document.getElementById('summary-count');

    // Projects
    const projectsContainer = document.getElementById('projects-container');
    const addProjectBtn = document.getElementById('add-project-btn');
    let projectCounter = 0;

    // Upload Zones
    const photoZone = document.getElementById('photo-upload-zone');
    const photoInput = document.getElementById('profilePhoto');
    const photoPreview = document.getElementById('photo-preview');
    const photoImg = document.getElementById('photo-img-preview');
    const photoContent = document.getElementById('photo-upload-content');
    const removePhotoBtn = document.getElementById('remove-photo');
    const photoError = document.getElementById('photo-error');

    const resumeZone = document.getElementById('resume-upload-zone');
    const resumeInput = document.getElementById('resume');
    const resumePreview = document.getElementById('resume-preview');
    const resumeContent = document.getElementById('resume-upload-content');
    const resumeFilename = document.getElementById('resume-filename');
    const resumeFilesize = document.getElementById('resume-filesize');
    const removeResumeBtn = document.getElementById('remove-resume');
    const resumeError = document.getElementById('resume-error');

    // Progress
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    // Submit & Success
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');
    const formFeedback = document.getElementById('form-feedback');
    const formCard = document.getElementById('form-card-container');
    const successScreen = document.getElementById('success-screen');
    const generatedUrlInput = document.getElementById('generated-url');
    const viewPortfolioBtn = document.getElementById('view-portfolio-btn');
    const copyBtn = document.getElementById('copy-btn');

    let selectedPhoto = null;
    let selectedResume = null;

    // --- Role Logic ---
    roleSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Other') {
            customRoleGroup.classList.remove('hidden');
            customRoleInput.setAttribute('required', 'true');
        } else {
            customRoleGroup.classList.add('hidden');
            customRoleInput.removeAttribute('required');
            customRoleInput.value = '';
        }
        updateProgress();
    });

    // --- Summary Logic ---
    summaryInput.addEventListener('input', () => {
        summaryInput.style.height = 'auto';
        summaryInput.style.height = (summaryInput.scrollHeight) + 'px';
        const len = summaryInput.value.length;
        summaryCount.textContent = len;
        if (len > 500) summaryCount.style.color = 'var(--error)';
        else summaryCount.style.color = 'var(--text-muted)';
        updateProgress();
    });

    // --- Dynamic Projects Logic ---
    function addProject() {
        projectCounter++;
        const pId = projectCounter;
        
        const card = document.createElement('div');
        card.className = 'project-card';
        card.id = `project-${pId}`;
        
        card.innerHTML = `
            <div class="project-header">
                <h4>Project ${pId < 10 ? '0'+pId : pId}</h4>
                <button type="button" class="remove-project-btn" onclick="document.getElementById('project-${pId}').remove(); updateProgress();">Remove</button>
            </div>
            <div class="form-grid">
                <div class="input-group full-width">
                    <input type="text" class="proj-name" placeholder=" " required>
                    <label>Project Name</label>
                </div>
                <div class="input-group full-width">
                    <input type="text" class="proj-desc" placeholder=" " required>
                    <label>Short Description</label>
                </div>
                <div class="input-group full-width">
                    <input type="text" class="proj-tech" placeholder=" " required>
                    <label>Technologies (Comma separated)</label>
                </div>
                <div class="input-group">
                    <input type="url" class="proj-url" placeholder=" ">
                    <label>Live URL (Optional)</label>
                </div>
                <div class="input-group">
                    <input type="url" class="proj-github" placeholder=" ">
                    <label>GitHub URL (Optional)</label>
                </div>
            </div>
        `;
        
        // Add listeners for progress
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                validateInput(input);
                updateProgress();
            });
            input.addEventListener('blur', () => {
                validateInput(input, true);
            });
        });

        projectsContainer.appendChild(card);
        updateProgress();
    }
    
    addProjectBtn.addEventListener('click', addProject);
    // Add one project by default
    addProject();

    function getProjectsData() {
        const projects = [];
        const cards = projectsContainer.querySelectorAll('.project-card');
        cards.forEach(card => {
            const name = card.querySelector('.proj-name').value.trim();
            if (name) { // Only save if name exists
                projects.push({
                    name: name,
                    description: card.querySelector('.proj-desc').value.trim(),
                    technologies: card.querySelector('.proj-tech').value.split(',').map(s => s.trim()).filter(Boolean),
                    projectUrl: card.querySelector('.proj-url').value.trim(),
                    githubUrl: card.querySelector('.proj-github').value.trim()
                });
            }
        });
        return projects;
    }

    // --- Upload Zones Logic ---
    function setupUpload(zone, input, content, preview, errorEl, maxMb, types, isImage, onSelect, onRemove) {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', (e) => { e.preventDefault(); zone.classList.remove('dragover'); });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        });
        
        // Fix: Make the entire zone clickable to open the file dialog
        zone.addEventListener('click', (e) => {
            // Prevent triggering if they click the remove button
            if (e.target.closest('.remove-file')) return;
            // Prevent double triggering if they click the browse link which might have its own handler
            if (e.target.closest('.browse-link')) return;
            // Trigger input click
            input.click();
        });

        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]);
        });
        
        function handleFile(file) {
            errorEl.style.display = 'none';
            zone.style.borderColor = 'var(--border-light)';

            if (!types.includes(file.type)) {
                errorEl.textContent = 'Invalid file type.';
                errorEl.style.display = 'block';
                zone.style.borderColor = 'var(--error)';
                return;
            }

            if (file.size > maxMb * 1024 * 1024) {
                errorEl.textContent = `File exceeds ${maxMb}MB limit.`;
                errorEl.style.display = 'block';
                zone.style.borderColor = 'var(--error)';
                return;
            }

            content.classList.add('hidden');
            preview.classList.remove('hidden');
            zone.style.borderColor = 'var(--success)';
            onSelect(file);
        }
    }

    // Photo
    setupUpload(photoZone, photoInput, photoContent, photoPreview, photoError, 5, 
        ['image/jpeg', 'image/png', 'image/webp'], true, 
        (file) => {
            selectedPhoto = file;
            const url = URL.createObjectURL(file);
            photoImg.src = url;
            updateProgress();
        }
    );
    removePhotoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedPhoto = null;
        photoInput.value = '';
        photoContent.classList.remove('hidden');
        photoPreview.classList.add('hidden');
        photoZone.style.borderColor = 'var(--border-light)';
        updateProgress();
    });

    // Resume
    setupUpload(resumeZone, resumeInput, resumeContent, resumePreview, resumeError, 10, 
        ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], false, 
        (file) => {
            selectedResume = file;
            resumeFilename.textContent = file.name;
            resumeFilesize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            updateProgress();
        }
    );
    removeResumeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedResume = null;
        resumeInput.value = '';
        resumeContent.classList.remove('hidden');
        resumePreview.classList.add('hidden');
        resumeZone.style.borderColor = 'var(--border-light)';
        updateProgress();
    });


    // --- Validation & Progress Logic ---
    const getBaseInputs = () => Array.from(form.querySelectorAll('.input-group > input:not([type="file"]), .input-group > select, .input-group > textarea'));
    
    getBaseInputs().forEach(input => {
        input.addEventListener('input', () => { validateInput(input); updateProgress(); });
        input.addEventListener('blur', () => { validateInput(input, true); });
    });

    function validateInput(input, showVisualError = false) {
        let isValid = input.checkValidity();
        const group = input.closest('.input-group');
        
        if (input.type === 'url' && input.value) {
            try { new URL(input.value); isValid = true; } catch (_) { isValid = false; }
        }

        if (showVisualError) {
            if (!isValid && input.value !== '') group.classList.add('error');
            else group.classList.remove('error');
        } else {
            if (isValid) group.classList.remove('error');
        }
        return isValid;
    }

    function updateProgress() {
        const sections = {
            personal: ['fullName', 'email', 'phone', 'role'],
            professional: ['summary', 'linkedin', 'github'],
            projects: [], // Handled dynamically
            documents: ['photo', 'resume']
        };

        if (roleSelect.value === 'Other') sections.personal.push('customRole');

        let totalWeight = 0;
        let currentWeight = 0;

        for (const [sectionName, fields] of Object.entries(sections)) {
            let sectionValid = true;
            
            if (sectionName === 'documents') {
                sectionValid = (selectedPhoto !== null && selectedResume !== null);
                totalWeight += 2;
                if(selectedPhoto) currentWeight += 1;
                if(selectedResume) currentWeight += 1;
            } else if (sectionName === 'projects') {
                // A project is valid if name, desc, tech are filled
                const projCards = projectsContainer.querySelectorAll('.project-card');
                let validProjects = 0;
                projCards.forEach(card => {
                    const req = Array.from(card.querySelectorAll('input[required]'));
                    if(req.length > 0 && req.every(i => i.checkValidity() && i.value)) validProjects++;
                });
                
                totalWeight += Math.max(1, projCards.length); // At least 1 project expected
                currentWeight += validProjects;
                sectionValid = validProjects > 0 && validProjects === projCards.length;
            } else {
                for (const fieldId of fields) {
                    const input = document.getElementById(fieldId);
                    if (!input || !input.checkValidity()) {
                        sectionValid = false;
                        break;
                    }
                }
                totalWeight += fields.length;
                if (sectionValid) {
                    currentWeight += fields.length;
                } else {
                    fields.forEach(id => {
                        const el = document.getElementById(id);
                        if (el && el.checkValidity() && el.value) currentWeight += 1;
                    });
                }
            }

            const indicator = document.querySelector(`.step[data-section="${sectionName}"]`);
            if (indicator) {
                if (sectionValid) {
                    indicator.classList.add('completed');
                    indicator.classList.remove('active');
                } else {
                    indicator.classList.remove('completed');
                    indicator.classList.add('active'); // active if incomplete
                }
            }
        }

        let percentage = Math.round((currentWeight / totalWeight) * 100);
        if (percentage > 100) percentage = 100;
        
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    }

    // --- Form Submission ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Final Validation
        let formValid = true;
        
        const allInputs = form.querySelectorAll('input:not([type="file"]), select, textarea');
        allInputs.forEach(input => {
            if (input.hasAttribute('required') || input.value) {
                if (!validateInput(input, true)) formValid = false;
            }
        });

        if (!selectedPhoto) {
            photoError.textContent = 'Please select a profile photo.';
            photoError.style.display = 'block';
            photoZone.style.borderColor = 'var(--error)';
            formValid = false;
        }

        if (!selectedResume) {
            resumeError.textContent = 'Please select a resume to upload.';
            resumeError.style.display = 'block';
            resumeZone.style.borderColor = 'var(--error)';
            formValid = false;
        }

        if (!formValid) {
            const firstInvalid = form.querySelector('.input-group.error input, .input-group.error select, .input-group.error textarea');
            if (firstInvalid) {
                firstInvalid.focus();
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Prepare FormData
        const formData = new FormData();
        formData.append('fullName', document.getElementById('fullName').value.trim());
        formData.append('email', document.getElementById('email').value.trim().toLowerCase());
        formData.append('phone', document.getElementById('phone').value.trim());
        
        const finalRole = roleSelect.value === 'Other' 
            ? document.getElementById('customRole').value.trim() 
            : roleSelect.value;
        formData.append('role', finalRole);
        
        formData.append('linkedin', document.getElementById('linkedin').value.trim());
        formData.append('github', document.getElementById('github').value.trim());
        formData.append('summary', document.getElementById('summary').value.trim());
        formData.append('laptopName', document.getElementById('laptopName').value.trim());
        formData.append('mobileName', document.getElementById('mobileName').value.trim());
        
        formData.append('projects', JSON.stringify(getProjectsData()));
        
        formData.append('profilePhoto', selectedPhoto);
        formData.append('resume', selectedResume);

        submitBtn.disabled = true;
        btnText.textContent = 'Generating Portfolio...';
        loader.classList.remove('hidden');
        formFeedback.classList.add('hidden');

        try {
            const response = await fetch('/api/submit', { method: 'POST', body: formData });
            const result = await response.json();

            if (response.ok) {
                formCard.classList.add('hidden');
                
                // Update Success UI
                generatedUrlInput.value = result.portfolioUrl;
                viewPortfolioBtn.href = result.portfolioUrl;
                successScreen.classList.remove('hidden');
            } else {
                throw new Error(result.error || 'An error occurred during submission.');
            }
        } catch (error) {
            console.error('Submission error:', error);
            formFeedback.textContent = error.message;
            formFeedback.classList.remove('hidden');
            formFeedback.classList.add('error');
            
            submitBtn.disabled = false;
            btnText.textContent = 'Generate My Portfolio →';
            loader.classList.add('hidden');
        }
    });

    // Copy URL functionality
    copyBtn.addEventListener('click', () => {
        generatedUrlInput.select();
        document.execCommand('copy');
        const orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = orig, 2000);
    });
});
