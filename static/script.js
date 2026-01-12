/**
 * Dynamic Fretboard Mask - Main Controller
 * Handles API integration, Snapping Logic, and Collision Detection
 */

let activeElement = null;
let offset = { x: 0, y: 0 };
let strings = [];
let recognitionTimer = null;
let lastNoteSetString = "";

/**
 * 1. Initialize Fretboard from Backend API
 */
async function initFretboard() {
    const container = document.getElementById('table-container');
    const API_URL = 'http://127.0.0.1:8000/fretboard';

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        // Map column keys (e.g., E, A, D, G, B, E)
        const columns = Object.keys(data);
        strings = columns;

        const rowCount = data[columns[0]].length;
        const table = document.createElement('table');
        table.id = "numberTable";

        for (let r = 0; r < rowCount; r++) {
            const tr = document.createElement('tr');
            columns.forEach(key => {
                const td = document.createElement('td');
                td.textContent = data[key][r] || "";
                tr.appendChild(td);
            });
            table.appendChild(tr);
        }

        container.innerHTML = '';
        container.appendChild(table);

        setupDragging();

        // Initial check for the default chord shape
        const chordObj = document.getElementById('chord-svg');
        if (chordObj.contentDocument) {
            checkCollisions();
        } else {
            chordObj.onload = () => checkCollisions();
        }

    } catch (error) {
        console.error('Initialization Error:', error);
        document.getElementById('chord-details').textContent = "API Connection Failed";
    }
}

/**
 * 2. Chord Recognition Integration
 * Communicates with /recognise_chord endpoint
 */
async function sendNotesToRecognizer(noteList) {
    const display = document.getElementById('chord-name');
    const details = document.getElementById('chord-details');

    const params = new URLSearchParams();
    noteList.forEach(note => params.append('notes', note));

    const API_URL = `http://127.0.0.1:8000/recognise_chord?${params.toString()}`;

    try {
        const response = await fetch(API_URL);
        const chordInfo = await response.json();

        if (chordInfo && !chordInfo.error) {
            // Success Feedback
            display.textContent = chordInfo;
            display.style.transform = "scale(1.05)"; // Subtle "pop" on recognition
            details.textContent = `Notes: ${noteList.join(' - ')}`;

            setTimeout(() => display.style.transform = "scale(1)", 150);
        } else {
            display.textContent = "???";
            details.textContent = "Unknown voicing";
        }
    } catch (error) {
        console.error('Recognition error:', error);
        display.textContent = "ERR";
    }
}

/**
 * 3. Dragging & Snapping Logic
 * Snaps to 50px grid to match table layout
 */
function setupDragging() {
    const draggables = document.querySelectorAll('.draggable');

    draggables.forEach(el => {
        el.addEventListener('pointerdown', (e) => {
            activeElement = el;
            el.setPointerCapture(e.pointerId);
            el.style.opacity = "0.8"; // Visual feedback

            const rect = el.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;
        });

        el.addEventListener('pointermove', (e) => {
            if (activeElement !== el) return;

            const wrapperRect = document.getElementById('wrapper').getBoundingClientRect();

            let rawX = e.clientX - wrapperRect.left - offset.x;
            let rawY = e.clientY - wrapperRect.top - offset.y;

            // SNAP LOGIC: Forces position to 50px increments
            const snappedX = Math.round(rawX / 50) * 50;
            const snappedY = Math.round(rawY / 50) * 50;

            el.style.left = `${snappedX}px`;
            el.style.top = `${snappedY}px`;

            checkCollisions();
        });

        el.addEventListener('pointerup', (e) => {
            if (activeElement) {
                activeElement.style.opacity = "1";
                activeElement.releasePointerCapture(e.pointerId);
                activeElement = null;
            }
        });
    });
}

/**
 * 4. Collision Detection
 * Translates SVG position to Fretboard notes
 */
function checkCollisions() {
    const columns = strings;
    const cells = document.querySelectorAll('#numberTable td');
    const chordObj = document.getElementById('chord-svg');
    const svgDoc = chordObj.contentDocument;

    if (!svgDoc) return;

    const objRect = chordObj.getBoundingClientRect();
    const capturedData = {};

    cells.forEach(td => {
        const tRect = td.getBoundingClientRect();
        // Calculate center point of cell for hit-testing
        const tx = tRect.left + tRect.width / 2;
        const ty = tRect.top + tRect.height / 2;

        const hit = svgDoc.elementFromPoint(tx - objRect.left, ty - objRect.top);

        // Validating hits against <rect> elements in the SVG
        if (hit && hit.tagName === 'rect') {
            td.classList.add('active');
            const columnName = columns[td.cellIndex];
            const noteValue = td.textContent.trim();
            capturedData[columnName] = noteValue;
        } else {
            td.classList.remove('active');
        }
    });

    // Extract unique sorted notes
    const uniqueNotesSet = [...new Set(Object.values(capturedData))]
        .filter(note => note !== "")
        .sort();

    const currentNoteString = uniqueNotesSet.join(',');

    // DEBOUNCE: Prevents API spamming during movement
    clearTimeout(recognitionTimer);

    if (uniqueNotesSet.length >= 3) {
        if (currentNoteString !== lastNoteSetString) {
            recognitionTimer = setTimeout(() => {
                sendNotesToRecognizer(uniqueNotesSet);
                lastNoteSetString = currentNoteString;
            }, 100); // 100ms for high responsiveness
        }
    } else {
        document.getElementById('chord-name').textContent = "---";
        document.getElementById('chord-details').textContent = "Need 3+ notes";
        lastNoteSetString = "";
    }
}

/**
 * 5. Global Listeners & Events
 */
document.addEventListener('DOMContentLoaded', initFretboard);

// Shape Selector Logic
const selectElement = document.getElementById('chord-select');
if (selectElement) {
    selectElement.addEventListener('change', (e) => {
        const chordObj = document.getElementById('chord-svg');
        chordObj.data = e.target.value;

        chordObj.onload = () => {
            // Small delay ensures browser has finished rendering the new SVG
            setTimeout(checkCollisions, 50);
        };
    });
}
