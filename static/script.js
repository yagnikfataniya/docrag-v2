// ==============================
// DocRAG — Frontend Logic
// ==============================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// DOM Elements
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const uploadProgress = $('#uploadProgress');
const progressFilename = $('#progressFilename');
const progressPercent = $('#progressPercent');
const progressFill = $('#progressFill');
const progressStatus = $('#progressStatus');
const documentsList = $('#documentsList');
const emptyDocState = $('#emptyDocState');
const chatArea = $('#chatArea');
const welcomeScreen = $('#welcomeScreen');
const messagesContainer = $('#messages');
const questionInput = $('#questionInput');
const sendBtn = $('#sendBtn');
const clearChatBtn = $('#clearChatBtn');
const menuToggle = $('#menuToggle');
const sidebar = $('#sidebar');

let isProcessing = false;

// ====== File Upload ======

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    fileInput.value = '';
});

async function handleFileUpload(file) {
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(ext)) {
        showToast('Unsupported file type. Please upload PDF, DOCX, or TXT.', 'error');
        return;
    }

    // Show progress
    uploadProgress.style.display = 'block';
    progressFilename.textContent = file.name;
    progressPercent.textContent = '0%';
    progressFill.style.width = '0%';
    progressStatus.textContent = 'Uploading...';
    progressStatus.className = 'progress-status';

    // Simulate progress steps
    animateProgress(0, 30, 300);

    const formData = new FormData();
    formData.append('file', file);

    try {
        animateProgress(30, 60, 500);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');

        animateProgress(60, 90, 300);

        const data = await response.json();

        animateProgress(90, 100, 200);

        setTimeout(() => {
            progressStatus.textContent = 'Document processed successfully!';
            progressStatus.className = 'progress-status success';
            addDocumentToList(data.filename);
            showToast(`"${data.filename}" uploaded and indexed.`, 'success');

            setTimeout(() => {
                uploadProgress.style.display = 'none';
            }, 2000);
        }, 300);

    } catch (err) {
        progressStatus.textContent = 'Upload failed. Please try again.';
        progressStatus.className = 'progress-status error';
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--error)';
        showToast('Failed to upload the document.', 'error');

        setTimeout(() => {
            uploadProgress.style.display = 'none';
            progressFill.style.background = '';
        }, 3000);
    }
}

function animateProgress(from, to, duration) {
    const start = performance.now();
    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const current = from + (to - from) * easeOutCubic(progress);
        progressFill.style.width = current + '%';
        progressPercent.textContent = Math.round(current) + '%';
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// ====== Documents List ======

function addDocumentToList(filename) {
    emptyDocState.style.display = 'none';

    // Don't add duplicates
    const existing = documentsList.querySelector(`[data-filename="${filename}"]`);
    if (existing) return;

    const ext = filename.split('.').pop().toLowerCase();
    const li = document.createElement('li');
    li.className = 'doc-item active';
    li.setAttribute('data-filename', filename);

    // Deactivate previous active items
    documentsList.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));

    li.innerHTML = `
        <div class="doc-icon ${ext}">${ext}</div>
        <div class="doc-info">
            <div class="doc-name" title="${filename}">${filename}</div>
        </div>
        <div class="doc-status"></div>
    `;

    documentsList.appendChild(li);
}

// Load existing documents on page load
async function loadDocuments() {
    try {
        const response = await fetch('/documents');
        const data = await response.json();
        data.documents.forEach(doc => addDocumentToList(doc));
    } catch (err) {
        // silently fail
    }
}

// ====== Chat ======

// Auto-resize textarea
questionInput.addEventListener('input', () => {
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
    sendBtn.disabled = !questionInput.value.trim();
});

// Send on Enter (Shift+Enter for newline)
questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled && !isProcessing) {
            sendMessage();
        }
    }
});

sendBtn.addEventListener('click', () => {
    if (!isProcessing) sendMessage();
});

// Suggestion chips
$$('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const question = chip.getAttribute('data-question');
        questionInput.value = question;
        questionInput.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

async function sendMessage() {
    const question = questionInput.value.trim();
    if (!question) return;

    isProcessing = true;
    sendBtn.disabled = true;

    // Hide welcome, show messages
    welcomeScreen.style.display = 'none';
    messagesContainer.style.display = 'flex';

    // Add user message
    appendMessage('user', question);

    // Clear input
    questionInput.value = '';
    questionInput.style.height = 'auto';

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        const response = await fetch('/ask?question=' + encodeURIComponent(question), {
            method: 'POST',
        });

        removeTypingIndicator(typingId);

        if (!response.ok) {
            const errData = await response.json();
            appendMessage('assistant', `<p style="color: var(--error);">${errData.error || 'Something went wrong.'}</p>`);
        } else {
            const data = await response.json();
            appendMessage('assistant', data.answer);
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        appendMessage('assistant', '<p style="color: var(--error);">Network error. Please try again.</p>');
    }

    isProcessing = false;
    scrollToBottom();
}

function appendMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarContent = role === 'user'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 21V19C20 16.79 18.21 15 16 15H8C5.79 15 4 16.79 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const label = role === 'user' ? 'You' : 'DocRAG';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarContent}</div>
        <div class="message-content">
            <div class="message-label">${label}</div>
            <div class="message-body">${role === 'user' ? escapeHtml(content) : content}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.id = id;

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <div class="message-content">
            <div class="message-label">DocRAG</div>
            <div class="message-body">
                <div class="typing-indicator">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: 'smooth',
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ====== Clear Chat ======

clearChatBtn.addEventListener('click', () => {
    messagesContainer.innerHTML = '';
    messagesContainer.style.display = 'none';
    welcomeScreen.style.display = 'flex';
});

// ====== Mobile Sidebar Toggle ======

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    toggleOverlay();
});

function toggleOverlay() {
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    if (sidebar.classList.contains('open')) {
        setTimeout(() => overlay.classList.add('active'), 10);
    } else {
        overlay.classList.remove('active');
    }
}

// ====== Toast Notifications ======

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 11L12 14L22 4M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };

    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) container.remove();
    }, 3500);
}

// ====== Theme Toggle ======

const themeToggle = $('#themeToggle');

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('docrag-theme', theme);
}

function getStoredTheme() {
    return localStorage.getItem('docrag-theme') || 'dark';
}

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
});

// ====== Init ======

document.addEventListener('DOMContentLoaded', () => {
    // Restore saved theme
    const savedTheme = getStoredTheme();
    setTheme(savedTheme);

    loadDocuments();
});

