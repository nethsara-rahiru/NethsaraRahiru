import { getStudent, getStudentResults, getMaterials, updateStudent } from './functions.js';
import { refreshIcons, initNavigation } from './ui.js';

const initPortal = () => {
    const loginForm = document.getElementById('login-form'); if (!loginForm) return;
    document.getElementById('logout-btn')?.addEventListener('click', () => { if(confirm('Exit satellite session?')) window.location.reload(); });
    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const rawId = document.getElementById('login-id').value.trim(); if (!rawId) return;
        const s = await getStudent(rawId.toUpperCase());
        if (s) {
            document.getElementById('login-section').style.display='none'; document.getElementById('dashboard-section').style.display='block';
            document.getElementById('display-name').innerText=s.name; document.getElementById('display-class').innerText=s.studentId;
            const hour = new Date().getHours(); const gr = document.getElementById('greeting-text'); 
            if(hour < 12) gr.innerText="SATELLITE MORNING"; else if(hour < 18) gr.innerText="SATELLITE AFTERNOON"; else gr.innerText="SATELLITE EVENING";
            const [rs, ms] = await Promise.all([getStudentResults(s.studentId), getMaterials()]);
            renderResults(rs); renderResources(ms);
            if(s.hasNewResult) setTimeout(() => { const o = document.getElementById('reveal-overlay'); o.classList.add('active'); o.onclick = async () => { o.classList.remove('active'); await executeReveal(s); }; refreshIcons(); }, 800);
        } else alert('Unauthorized Student Reference ID.');
    });
};

async function executeReveal(student) {
    const overlay = document.getElementById('loading-overlay'); overlay.classList.add('active');
    const allReleased = await getStudentResults(student.studentId);
    if (!allReleased.length) return;
    const latestEntry = allReleased[0];
    
    // Grades always calculated on 100% basis
    const rawMarks = latestEntry.marks;
    const percentageMarks = (latestEntry.subSection !== 'None' && latestEntry.paperPart !== 'Full Paper') ? rawMarks * 2 : rawMarks;
    
    // Display value depends on paper type
    const isFullPaper = (latestEntry.paperPart === 'Full Paper' && latestEntry.subSection === 'None');
    const finalDisplayMark = Math.round(rawMarks);
    
    // Dynamic Local Grade
    const getLocalGrade = (m) => { if(m>=75) return 'A'; if(m>=65) return 'B'; if(m>=55) return 'C'; if(m>=40) return 'S'; return 'W'; };
    const localGrade = getLocalGrade(percentageMarks);

    setTimeout(() => {
        overlay.classList.remove('active'); document.getElementById('result-reveal-screen').classList.add('active');
        const partInfo = latestEntry.subSection !== 'None' ? `${latestEntry.paperPart} ${latestEntry.subSection}` : latestEntry.paperPart;
        document.getElementById('rev-exam-name').innerText = `${latestEntry.examName} (${partInfo})`;
        
        const gradeEl = document.getElementById('rev-grade');
        const gradeContainer = document.getElementById('rev-grade-container');
        if (gradeEl && gradeContainer) {
            gradeEl.innerText = localGrade;
            gradeContainer.style.display = isFullPaper ? 'block' : 'none';
        }
        
        document.getElementById('rev-rank').innerText = `#${latestEntry.rank}`;
        document.getElementById('rev-avg').innerText = Math.round(latestEntry.classAverage) + "%";
        
        let v = 0; const c = document.getElementById('rev-marks'); 
        const suffix = isFullPaper ? '%' : ' / 50';
        const tick = () => { 
            if (v < finalDisplayMark) { 
                v += Math.ceil(finalDisplayMark / 40) || 1; 
                if (v > finalDisplayMark) v = finalDisplayMark; 
                c.innerText = Math.round(v) + suffix; 
                requestAnimationFrame(tick); 
            } else { 
                c.innerText = Math.round(finalDisplayMark) + suffix; 
            } 
        }; 
        tick();
        
        document.getElementById('close-reveal-btn').onclick = async () => { document.getElementById('result-reveal-screen').classList.remove('active'); await updateStudent(student.id, { hasNewResult: false }); };
        refreshIcons();
    }, 1200);
}

function renderResults(allReleased) {
    const display = document.getElementById('results-display'); if (!display) return;
    display.innerHTML = allReleased.length ? '' : '<p style="text-align:center; padding: 3rem; color: var(--text-muted);">Academic data pending release.</p>';
    
    const groups = {};
    allReleased.forEach(r => { 
        // Group by name AND date to keep different sittings isolated
        const sittingKey = `${r.examName}_${r.examDate || 'NoDate'}`;
        if (!groups[sittingKey]) groups[sittingKey] = { final: null, parts: [] }; 
        groups[sittingKey].parts.push(r); 
        if (r.finalAggregate !== undefined) groups[sittingKey].final = r; 
    });

    Object.values(groups).forEach(data => {
        const primary = data.final || data.parts[0];
        const isFullPaperCombined = (primary.paperPart === 'Full Paper' && primary.subSection === 'None') || (data.parts.length > 1);
        const displayMarksValue = primary.finalAggregate || primary.marks;
        const displayMarks = Math.round(displayMarksValue);
        
        const card = document.createElement('div'); 
        card.className = 'card';
        card.style.marginBottom = '2.5rem';

        let segmentsHTML = '';
        data.parts.forEach(p => {
            let cls = 'p1a'; 
            const part = p.paperPart;
            const sub = p.subSection;

            if (part === 'Part 1' && sub === 'Part B') cls = 'p1b';
            else if (part === 'Part 2' && sub === 'Part A') cls = 'p2a';
            else if (part === 'Part 2' && sub === 'Part B') cls = 'p2b';
            else if (part === 'Part 1' || part === 'Full Paper') cls = 'p1a';
            else if (part === 'Part 2') cls = 'p2a';

            // Each part is expected to be out of 50. In a combined paper (A+B+A+B = 200),
            // marks * 0.5 converts a 0-200 range to 0-100%. 
            // If it's a single paper out of 100, we should adjust.
            const segmentWidth = p.marks * 0.5; 
            segmentsHTML += `<div class="segment ${cls}" style="width: ${segmentWidth}%" data-tooltip="${part} ${sub}: ${Math.round(p.marks)} / 50"></div>`;
        });

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3 style="font-size:1.15rem; margin:0; font-family:'Outfit'; color: white;">${primary.examName}</h3>
                    <div class="tag-bar" style="margin-top:8px; display:flex; gap:6px;">
                        <span class="mini-tag">RANK #${primary.rank}</span>
                        ${isFullPaperCombined ? `<span class="mini-tag" style="background:rgba(106, 215, 255, 0.1);">GRADE ${primary.grade}</span>` : ''}
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="marks-counter" style="font-size:2.5rem;">${displayMarks}${isFullPaperCombined ? '%' : ' / 50'}</span>
                </div>
            </div>
            <div class="comparison-line">
                ${segmentsHTML}
                <div class="comparison-mark" style="left: ${primary.classAverage}%"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); font-weight:800; letter-spacing:0.5px; opacity:0.8;">
                <span>ACADEMIC PERFORMANCE INDEX</span>
                <span>BATCH MEAN: ${Math.round(primary.classAverage)}%</span>
            </div>
            <div class="legend-group">
                <div class="legend-item"><div class="legend-color" style="background:#6ad7ff;"></div> P1 (A)</div>
                <div class="legend-item"><div class="legend-color" style="background:#7820d0;"></div> P1 (B)</div>
                <div class="legend-item"><div class="legend-color" style="background:#f59e0b;"></div> P2 (A)</div>
                <div class="legend-item"><div class="legend-color" style="background:#10b981;"></div> P2 (B)</div>
            </div>`;
        display.appendChild(card);
    });
    refreshIcons();
}

function renderResources(mats) {
    const d = document.getElementById('materials-display'); if (!d) return; d.innerHTML = '';
    mats.forEach(m => {
        const r = document.createElement('div'); r.style.padding = '1rem 0'; r.style.display = 'flex'; r.style.justifyContent = 'space-between'; r.style.borderBottom='1px solid var(--card-border)';
        r.innerHTML = `<div><strong style="font-size:0.9rem;">${m.title}</strong><p style="opacity:0.6; font-size:0.75rem;">${m.lesson}</p></div><a href="${m.fileURL}" target="_blank"><button style="padding: 0.6rem 1.4rem; font-size:0.7rem;">OPEN</button></a>`;
        d.appendChild(r);
    });
    refreshIcons();
}


let isAppInitialized = false;
const run = () => { if (isAppInitialized) return; isAppInitialized = true; initNavigation(); initPortal(); refreshIcons(); };
window.addEventListener("load", run); if (document.readyState === "complete") run();
