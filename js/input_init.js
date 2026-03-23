// ============================================================================
// INPUT_INIT.JS - Global UI State & Initialization
// ============================================================================

// UI State Variables
let width = window.innerWidth;
let height = window.innerHeight;

let isDragging = false;
let hasMoved = false;
let lastMouseX = 0;
let lastMouseY = 0;

let isPainting = false;
let paintAction = 'select';
let lastPaintedHexId = null;

let contextHexId = null;
let contextSectorPrefix = null;
let contextSubsectorPrefix = null;

// Hex Editor State
let editingHexId = null;

// Make Hex Editor Draggable
let isDraggingEditor = false;
let editorDragOffsetX = 0;
let editorDragOffsetY = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeInput() {
    // UI Elements
    const contextMenu = document.getElementById('context-menu');
    const hexEditor = document.getElementById('hex-editor');
    const hexEditorHeader = hexEditor.querySelector('h3');

    // Make Hex Editor Draggable
    hexEditorHeader.addEventListener('mousedown', (e) => {
        isDraggingEditor = true;
        const style = window.getComputedStyle(hexEditor);
        editorDragOffsetX = e.clientX - parseInt(style.left, 10);
        editorDragOffsetY = e.clientY - parseInt(style.top, 10);
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingEditor) return;
        hexEditor.style.left = (e.clientX - editorDragOffsetX) + 'px';
        hexEditor.style.top = (e.clientY - editorDragOffsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDraggingEditor = false;
    });

    // Setup all event listeners (These functions will live in our other new files)
    setupAccordions();
    setupCanvasEvents();
    setupKeyboardShortcuts();
    setupContextMenu();
    setupSettingsPanel();
    setupHexEditor();
    setupHelpModal();
    setupSaveLoad();

    setupSectorPicker();
    setupSectorImporter();
    setupSplashScreen();
}

// ============================================================================
// ACCORDION FUNCTIONALITY
// ============================================================================

function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion-btn');
    accordions.forEach(acc => {
        // Default all accordions to closed state
        acc.classList.remove('active');
        if (acc.nextElementSibling) acc.nextElementSibling.style.display = 'none';

        acc.addEventListener('click', function () {
            const isActive = this.classList.contains('active');

            // Close all first to ensure mutual exclusivity
            accordions.forEach(btn => {
                btn.classList.remove('active');
                if (btn.nextElementSibling) btn.nextElementSibling.style.display = 'none';
            });

            // If it wasn't active before, open it
            if (!isActive) {
                this.classList.add('active');
                this.nextElementSibling.style.display = 'block';
            }
        });
    });
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, duration = 3000) {
    console.log("Toast:", message);
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, duration);
}

// ============================================================================
// UI HELPERS (Settings & Modals)
// ============================================================================

function openHelpModal() {
    document.getElementById('context-menu').classList.remove('visible');
    document.getElementById('help-modal').style.display = 'flex';
}

function closeHelpModal() {
    document.getElementById('help-modal').style.display = 'none';
}

function setupHelpModal() {
    document.getElementById('btn-close-help').addEventListener('click', closeHelpModal);
}

function setupSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const launchBtn = document.getElementById('btn-launch-app');

    if (splash && launchBtn) {
        launchBtn.addEventListener('click', () => {
            splash.classList.add('hidden');
            // Give a small toast welcome
            setTimeout(() => {
                showToast("Welcome to As Above So Below", 3000);
            }, 800);
        });
    }
}

// ============================================================================
// APP STARTUP
// ============================================================================

window.addEventListener('load', () => {
    initializeInput();
    if (typeof resize === 'function') {
        resize();
    }
});