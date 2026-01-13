/**
 * Dynamic Fretboard Mask - Controller with Default Loading
 */

let activeElement = null;
let offset = { x: 0, y: 0 };
let strings = [];
let recognitionTimer = null;
let lastNoteSetString = "";

async function initFretboard(tuning = "Standard") {
    const container = document.getElementById('table-container');
    // Pass the tuning to the API
    const API_URL = `/fretboard?tuning_name=${tuning}`;

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        const columns = Object.keys(data);
        strings = columns;
        const rowCount = data[columns[0]].length;
        const table = document.createElement('table');
        table.id = "numberTable";

        for (let r = 0; r < rowCount; r++) {
            const tr = document.createElement('tr');
            const indexTd = document.createElement('td');
            indexTd.textContent = r;
            indexTd.classList.add('fret-index');
            tr.appendChild(indexTd);

            columns.forEach(key => {
                const td = document.createElement('td');
                td.textContent = data[key][r] || "";
                tr.appendChild(td);
            });
            table.appendChild(tr);
        }

        container.innerHTML = '';
        container.appendChild(table);

        // Setup dragging only if it hasn't been initialized,
        // or just ensure setupDragging handles re-initialization
        setupDragging();

        // Recalculate notes for the current position with new tuning
        checkCollisions();

    } catch (error) {
        console.error('Init Error:', error);
    }
}

// Add this listener at the bottom of your script
const tuningSelect = document.getElementById('tuning-select');
if (tuningSelect) {
    tuningSelect.addEventListener('change', (e) => {
        console.log("Changing tuning to:", e.target.value);
        initFretboard(e.target.value);
    });
}

// Ensure the initial call in DOMContentLoaded is correct
document.addEventListener('DOMContentLoaded', () => {
    initFretboard("Standard");
    populateChordMenu();
});

/**
 * UPDATED: Populates menu AND loads the first shape automatically
 */
async function populateChordMenu() {
    const select = document.getElementById('chord-select');
    const chordObj = document.getElementById('chord-svg');
    if (!select) return;

    try {
        const response = await fetch('/chord-manifest');
        const data = await response.json();

        select.innerHTML = ''; // Clear "Loading..."
        let firstChordPath = null;

        for (const [category, chords] of Object.entries(data)) {
            const group = document.createElement('optgroup');
            group.label = `── ${category.toUpperCase()} ──`;

            chords.forEach((chord, index) => {
                const option = document.createElement('option');
                option.value = chord.path;
                option.textContent = chord.name;
                group.appendChild(option);

                // Capture the very first chord path found
                if (!firstChordPath) {
                    firstChordPath = chord.path;
                }
            });
            select.appendChild(group);
        }

        // LOAD FIRST SHAPE BY DEFAULT
        if (firstChordPath) {
            select.value = firstChordPath;
            // Force a reload with cache-busting for Chrome
            const defaultPath = `${firstChordPath}?t=${Date.now()}`;
            chordObj.data = defaultPath;

            chordObj.onload = () => {
                console.log("Default shape loaded:", firstChordPath);
                setTimeout(checkCollisions, 500); // Wait for browser paint
            };
        }

    } catch (e) {
        console.error("Manifest Error:", e);
    }
}

function checkCollisions() {
    const chordObj = document.getElementById('chord-svg');
    let svgDoc = null;

    try {
        svgDoc = chordObj.getSVGDocument() || chordObj.contentDocument;
    } catch (e) {
        return; // Security block
    }

    if (!svgDoc || !svgDoc.documentElement) return;

    const columns = strings;
    const cells = document.querySelectorAll('#numberTable td');
    const objRect = chordObj.getBoundingClientRect();
    const capturedData = {};
    const activeColumnIndices = new Set();

    cells.forEach(td => {
        if (td.classList.contains('fret-index')) return;
        td.classList.remove('active', 'open-string');

        const tRect = td.getBoundingClientRect();
        const tx = tRect.left + tRect.width / 2;
        const ty = tRect.top + tRect.height / 2;

        const hit = svgDoc.elementFromPoint(tx - objRect.left, ty - objRect.top);

        if (hit && (hit.tagName === 'rect' || hit.tagName === 'circle')) {
            td.classList.add('active');
            const colIndex = td.cellIndex;
            const columnName = columns[colIndex - 1];
            capturedData[columnName] = td.textContent.trim();
            activeColumnIndices.add(colIndex);
        }
    });

    const tableRows = document.querySelectorAll('#numberTable tr');
    if(tableRows.length > 0) {
        const firstRowCells = tableRows[0].querySelectorAll('td');
        for (let i = 1; i < columns.length + 1; i++) {
            if (!activeColumnIndices.has(i)) {
                const openCell = firstRowCells[i];
                if (openCell) {
                    openCell.classList.add('open-string');
                    capturedData[columns[i-1]] = openCell.textContent.trim();
                }
            }
        }
    }

    const uniqueNotesSet = [...new Set(Object.values(capturedData))]
        .filter(note => note !== "" && isNaN(note))
        .sort();

    const currentNoteString = uniqueNotesSet.join(',');
    clearTimeout(recognitionTimer);

    if (uniqueNotesSet.length >= 2) {
        if (currentNoteString !== lastNoteSetString) {
            recognitionTimer = setTimeout(() => {
                sendNotesToRecognizer(uniqueNotesSet);
                lastNoteSetString = currentNoteString;
            }, 100);
        }
    } else {
        document.getElementById('chord-name').textContent = "---";
        lastNoteSetString = "";
    }
}

async function sendNotesToRecognizer(noteList) {
    const params = new URLSearchParams();
    noteList.forEach(note => params.append('notes', note));
    try {
        const response = await fetch(`/recognise_chord?${params.toString()}`);
        const chordInfo = await response.json();
        document.getElementById('chord-name').textContent = chordInfo || "???";
        document.getElementById('chord-details').textContent = `Notes: ${noteList.join(' - ')}`;
    } catch (e) { console.error(e); }
}

function setupDragging() {
    const draggables = document.querySelectorAll('.draggable');
    draggables.forEach(el => {
        el.addEventListener('pointerdown', (e) => {
            activeElement = el;
            el.setPointerCapture(e.pointerId);
            const rect = el.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;
        });

        el.addEventListener('pointermove', (e) => {
            if (activeElement !== el) return;
            const wrapperRect = document.getElementById('wrapper').getBoundingClientRect();
            let rawX = e.clientX - wrapperRect.left - offset.x;
            let rawY = e.clientY - wrapperRect.top - offset.y;
            const snappedX = Math.round(rawX / 50) * 50;
            const snappedY = Math.round(rawY / 50) * 50;
            if(el.style.left !== `${snappedX}px` || el.style.top !== `${snappedY}px`) {
                 el.style.left = `${snappedX}px`;
                 el.style.top = `${snappedY}px`;
                 checkCollisions();
            }
        });

        el.addEventListener('pointerup', (e) => {
            if (activeElement) {
                activeElement.releasePointerCapture(e.pointerId);
                activeElement = null;
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initFretboard();
    populateChordMenu();
});

const selectElement = document.getElementById('chord-select');
if (selectElement) {
    selectElement.addEventListener('change', (e) => {
        const chordObj = document.getElementById('chord-svg');
        const freshPath = `${e.target.value}?t=${Date.now()}`;
        chordObj.data = "";
        setTimeout(() => {
            chordObj.data = freshPath;
            chordObj.onload = () => setTimeout(checkCollisions, 300);
        }, 50);
    });
}
