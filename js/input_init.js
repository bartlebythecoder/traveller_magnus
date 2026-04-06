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

    // Initialize Floating Palettes
    const filterModal = document.getElementById('filter-modal');
    const filterHandle = filterModal.querySelector('.modal-drag-handle');
    makeDraggable(filterModal, filterHandle);

    makeDraggable(hexEditor, hexEditorHeader);

    // Default Placement
    filterModal.style.left = '10px';
    filterModal.style.top = '50px';
    
    // For Hex Editor (Right-aligned)
    hexEditor.style.right = '400px';
    hexEditor.style.left = 'auto'; // Ensure it doesn't conflict with left
    hexEditor.style.top = '50px';

    document.addEventListener('mouseup', () => {
        // Global safety net handled inside makeDraggable
    });

    // Setup all event listeners (These functions will live in our other new files)
    setupAccordions();
    setupCanvasEvents();
    setupKeyboardShortcuts();
    setupContextMenu();
    setupSettingsPanel();
    setupHelpToggle();
    setupHexEditor();
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
        const panel = acc.nextElementSibling;
        if (panel && panel.classList.contains('accordion-content')) {
            panel.style.display = 'none';
            // Teleport panel to document.body to escape backdrop-filter stacking context
            // backdrop-filter on .draggable-palette traps position:fixed children inside it
            if (panel.parentElement !== document.body) {
                document.body.appendChild(panel);
            }
        }

        acc.addEventListener('click', function () {
            const isActive = this.classList.contains('active');
            const panelId = this.dataset.accordionPanel || this.nextElementSibling?.id;

            // Close all panels
            accordions.forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.accordion-content').forEach(p => {
                p.style.display = 'none';
            });

            // If it wasn't active before, open it
            if (!isActive) {
                this.classList.add('active');
                // Find the panel by stored reference (it may have been moved to body)
                const targetPanel = panelId ? document.getElementById(panelId) : null;
                if (targetPanel) {
                    const rect = this.getBoundingClientRect();
                    const panelW = 440;
                    // Use 80vh (the CSS max-height) as the assumed panel height — scrollHeight is 0 on hidden elements
                    const panelH = window.innerHeight * 0.8;
                    const margin = 10;

                    // Prefer right of the editor; flip left if it would overflow
                    let left = rect.right + margin;
                    if (left + panelW > window.innerWidth) {
                        left = rect.left - panelW - margin;
                    }
                    // Clamp so panel never goes off left or right edge
                    left = Math.max(margin, Math.min(left, window.innerWidth - panelW - margin));

                    // Align top of panel with top of button; clamp bottom
                    let top = rect.top;
                    if (top + panelH > window.innerHeight - margin) {
                        top = window.innerHeight - panelH - margin;
                    }
                    top = Math.max(margin, top);

                    targetPanel.style.left = left + 'px';
                    targetPanel.style.top = top + 'px';
                    targetPanel.style.display = 'block';
                }
            }
        });

        // Store panel ID on button for lookup after DOM move
        if (panel && panel.id) {
            acc.dataset.accordionPanel = panel.id;
        }
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
// DRAGGABLE PALETTE LOGIC
// ============================================================================

function makeDraggable(element, handle) {
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;

    handle.addEventListener('mousedown', (e) => {
        // Don't drag if clicking buttons/inputs inside handle
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;

        isDragging = true;
        
        // Initial offset
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // Bring to front
        bringToFront(element);

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        
        // Use fixed positioning relative to viewport
        element.style.left = (e.clientX - offsetX) + 'px';
        element.style.top = (e.clientY - offsetY) + 'px';
        element.style.right = 'auto'; // Reset right once moved
        element.style.bottom = 'auto';
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    // Bring to front on click anywhere inside
    element.addEventListener('mousedown', () => {
        bringToFront(element);
    });
}

function bringToFront(element) {
    // Other palettes to back
    document.querySelectorAll('.draggable-palette').forEach(p => {
        p.style.zIndex = '1100';
    });
    // This one to front
    element.style.zIndex = '1200';
}

// ============================================================================
// UI HELPERS (Settings & Modals)
// ============================================================================

function openHelpModal() {
    document.getElementById('context-menu').classList.remove('visible');
    // Mutually exclusive: close settings if open
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) settingsPanel.classList.remove('open');
    
    document.getElementById('help-panel').classList.add('open');
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