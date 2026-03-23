/* app.js - Advanced Result Reveal & Aggregation */
import { db } from './firebase.js';
import { collection, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { 
  addStudent, deleteStudent, addResult, releaseAllAndCalculate, 
  getStudent, getStudentResults, updateStudent, uploadMaterialFile, 
  addMaterial, getMaterials, addExam, deleteExam
} from './functions.js';

const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };
let examsList = [];

const initNavigation = () => {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${tabId}`) content.classList.add('active');
            });
            refreshIcons();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
    document.getElementById('nav-to-exams')?.addEventListener('click', () => { document.querySelector('.nav-item[data-tab="exams"]')?.click(); });
};

if (window.location.pathname.includes('admin.html')) {
    onSnapshot(collection(db, "students"), snap => { document.getElementById('stat-students').innerText = snap.size; });
    onSnapshot(query(collection(db, "results"), where("isReleased", "==", false)), snap => { document.getElementById('stat-pending').innerText = snap.size; });
    onSnapshot(query(collection(db, "results"), where("isReleased", "==", true)), snap => { document.getElementById('stat-published').innerText = snap.size; });

    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    if (toggle) toggle.onclick = () => { sidebar.classList.add('mobile-open'); overlay.classList.add('active'); };
    if (overlay) overlay.onclick = () => { sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); };

    onSnapshot(query(collection(db, "students"), orderBy("createdAt", "desc")), snapshot => {
        const tableBody = document.getElementById('student-table-body');
        const dashList = document.getElementById('dashboard-student-list');
        if (!tableBody || !dashList) return;
        tableBody.innerHTML = ''; dashList.innerHTML = '';
        snapshot.forEach(doc => {
            const s = { id: doc.id, ...doc.data() };
            const tr = document.createElement('tr'); tr.style.borderBottom = '1px solid var(--card-border)';
            tr.innerHTML = `<td style="padding: 1rem;"><strong style="color:white; display:block;">${s.name}</strong><small style="opacity:0.5;">ID: ${s.studentId}</small></td><td style="padding: 1rem;">${s.class}</td><td style="padding: 1rem;"><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success);">LIVE</span></td><td style="padding: 1rem; text-align:right;"><button class="delete-student-btn" data-id="${s.id}" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:0.4rem 0.8rem; border-radius:10px; font-size:0.65rem;">REMOVE</button></td>`;
            tableBody.appendChild(tr);
            const d = document.createElement('div'); d.style.padding = '0.8rem 0'; d.style.borderBottom = '1px solid var(--card-border)'; d.style.display='flex'; d.style.justifyContent='space-between';
            d.innerHTML = `<div><strong style="color:white; display:block; font-size:0.9rem;">${s.name}</strong><small style="opacity:0.4; font-size:0.7rem;">ID: ${s.studentId}</small></div><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted); font-size:0.65rem;">${s.class}</span>`;
            dashList.appendChild(d);
        });
        document.querySelectorAll('.delete-student-btn').forEach(btn => btn.onclick = async () => { if(confirm('Delete student?')) await deleteStudent(btn.getAttribute('data-id')); });
        refreshIcons();
    });

    onSnapshot(query(collection(db, "exams"), orderBy("date", "desc")), snapshot => {
        const list = document.getElementById('exam-list');
        const examSelect = document.getElementById('result-exam-name');
        if (!list || !examSelect) return;
        examsList = [];
        list.innerHTML = snapshot.empty ? '<p style="text-align:center; padding: 2rem; color: var(--text-muted);">Empty logs.</p>' : '';
        const selectHTML = ['<option value="">Select Paper...</option>'];
        snapshot.forEach(doc => {
            const e = { id: doc.id, ...doc.data() };
            examsList.push(e);
            selectHTML.push(`<option value="${e.id}">${e.paperName} (${e.paperPart} - ${e.subSection})</option>`);
            const d = document.createElement('div'); d.style.padding='1.2rem'; d.style.marginBottom='1.2rem'; d.style.background='rgba(255,255,255,0.02)'; d.style.borderRadius='15px'; d.style.border='1px solid var(--card-border)';
            d.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><strong style="color:white; font-size:1rem; display:block; margin-bottom:5px;">${e.paperName}</strong><div style="font-size:0.75rem; opacity:0.6;">${e.paperPart} | ${e.subSection}</div></div><button class="delete-exam-btn" data-id="${e.id}" style="padding:0.4rem 0.8rem; font-size:0.6rem; background:rgba(239,68,68,0.1); color:var(--danger);">DELETE</button></div>`;
            list.appendChild(d);
        });
        examSelect.innerHTML = selectHTML.join('');
        document.querySelectorAll('.delete-exam-btn').forEach(btn => btn.onclick = async () => { if(confirm('Delete log?')) await deleteExam(btn.getAttribute('data-id')); });
        refreshIcons();
    });

    document.getElementById('add-student-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        try { await addStudent({ studentId: document.getElementById('student-id').value, name: document.getElementById('student-name').value, class: document.getElementById('student-class').value }); e.target.reset(); document.getElementById('add-student-form').style.display = 'none'; } catch(err) { alert('Save Error.'); }
    });

    document.getElementById('add-exam-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        try { await addExam({ paperName: document.getElementById('exam-paper-name').value, paperPart: document.getElementById('exam-part').value, subSection: document.getElementById('exam-sub').value, date: document.getElementById('exam-date').value, structure: document.getElementById('exam-structure').value }); e.target.reset(); alert('Synced.'); } catch(err) { alert('Error.'); }
    });

    document.getElementById('result-student-id')?.addEventListener('input', async (e) => {
        const s = await getStudent(e.target.value);
        const l = document.getElementById('lookup-name');
        if(s) { l.innerText = s.name; l.style.color = 'var(--primary)'; } else { l.innerText = 'NOT FOUND'; l.style.color = 'var(--danger)'; }
    });
    
    document.getElementById('add-result-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const examId = document.getElementById('result-exam-name').value;
        const examDetails = examsList.find(ex => ex.id === examId);
        try { await addResult({ studentId: document.getElementById('result-student-id').value, examId, marks: parseFloat(document.getElementById('result-marks').value), examName: examDetails.paperName, paperPart: examDetails.paperPart, subSection: examDetails.subSection }); e.target.reset(); document.getElementById('lookup-name').innerText='---'; alert('Ready.'); } catch(e) { alert('Error.'); }
    });

    document.querySelectorAll('#release-all-btn, #direct-release-btn').forEach(btn => {
        btn.onclick = async () => { btn.disabled = true; const old = btn.innerText; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> RECALC...'; refreshIcons(); await releaseAllAndCalculate(); alert(`SUCCESS: Rankings Refreshed.`); btn.innerText = old; btn.disabled = false; refreshIcons(); };
    });

    onSnapshot(query(collection(db, "materials"), orderBy("createdAt", "desc")), snapshot => {
        const list = document.getElementById('shared-materials-list');
        if (!list) return; list.innerHTML = snapshot.empty ? '<p>Empty vault.</p>' : '';
        snapshot.forEach(doc => {
            const m = doc.data();
            const d = document.createElement('div'); d.style.padding = '0.7rem 0'; d.style.display='flex'; d.style.justifyContent='space-between'; d.style.borderBottom='1px solid var(--card-border)';
            d.innerHTML = `<div><strong style="color:white; font-size:0.9rem;">${m.title}</strong><small style="display:block; opacity:0.6; font-size:0.7rem;">${m.lesson}</small></div><i data-lucide="file-check" style="color:var(--primary); width:16px;"></i>`;
            list.appendChild(d);
        });
        refreshIcons();
    });

    document.getElementById('add-material-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('upload-btn'); btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Syncing...'; refreshIcons();
        try { const url = await uploadMaterialFile(document.getElementById('mat-file').files[0]); await addMaterial({ title: document.getElementById('mat-title').value, lesson: document.getElementById('mat-lesson').value, fileURL: url }); e.target.reset(); alert('Synced.'); } catch(err) { alert('Error.'); }
        finally { btn.disabled = false; btn.innerText = 'Upload To Hub'; refreshIcons(); }
    });
}

// Student Portal Dashboard
if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        if(confirm('Logout?')) window.location.reload();
    });

    document.getElementById('login-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const rawId = document.getElementById('login-id').value.trim();
        if (!rawId) return;
        
        const s = await getStudent(rawId.toUpperCase());
        if (s) {
            document.getElementById('login-section').style.display='none'; document.getElementById('dashboard-section').style.display='block';
            document.getElementById('display-name').innerText=s.name; document.getElementById('display-class').innerText=s.studentId;
            const hour = new Date().getHours(); const gr = document.getElementById('greeting-text'); 
            if(hour < 12) gr.innerText="SATELLITE MORNING"; else if(hour < 18) gr.innerText="SATELLITE AFTERNOON"; else gr.innerText="SATELLITE EVENING";
            const [rs, ms] = await Promise.all([getStudentResults(s.studentId), getMaterials()]);
            renderResults(rs); renderResources(ms);
            if(s.hasNewResult) setTimeout(() => { const o = document.getElementById('reveal-overlay'); o.classList.add('active'); o.onclick = async () => { o.classList.remove('active'); await executeReveal(s); }; refreshIcons(); }, 800);
        } else alert('Credentials not recognized. Please check your Student ID.');
    });

    async function executeReveal(student) {
        document.getElementById('loading-overlay').classList.add('active');
        const allReleased = await getStudentResults(student.studentId);
        const latestEntry = allReleased[0]; // The very latest piece of data entered
        
        // Find all parts associated with this specific exam name
        const batchParts = allReleased.filter(r => r.examName === latestEntry.examName);
        
        // We want to show the specific result for the part that was just released
        // Check if the latest entry belongs to Part 1 or Part 2
        const focusPart = latestEntry.paperPart;
        const focusResults = batchParts.filter(p => p.paperPart === focusPart);
        const focusSum = focusResults.reduce((s, r) => s + r.marks, 0);

        setTimeout(() => {
            document.getElementById('loading-overlay').classList.remove('active'); 
            document.getElementById('result-reveal-screen').classList.add('active');
            
            document.getElementById('rev-exam-name').innerText = `${latestEntry.examName} (${focusPart})`;
            
            // Re-calc specific sums for the breakdown boxes
            let p1Sum = 0; let p2Sum = 0;
            let p1V = false; let p2V = false;
            batchParts.forEach(p => {
              if (p.paperPart === 'Part 1') { p1Sum += p.marks; p1V = true; }
              else if (p.paperPart === 'Part 2') { p2Sum += p.marks; p2V = true; }
            });

            document.getElementById('rev-p1-marks').innerText = p1V ? p1Sum.toFixed(1) : '--';
            document.getElementById('rev-p2-marks').innerText = p2V ? p2Sum.toFixed(1) : '--';
            document.getElementById('rev-grade').innerText = latestEntry.grade;
            document.getElementById('rev-rank').innerText = `#${latestEntry.rank}`;
            document.getElementById('rev-avg').innerText = Number(latestEntry.classAverage).toFixed(1) + "%";
            
            let v = 0; const c = document.getElementById('rev-marks'); 
            const tick = () => { if (v < focusSum) { v += Math.ceil(focusSum / 40); if (v > focusSum) v = focusSum; c.innerText = v.toFixed(1); requestAnimationFrame(tick); } else { c.innerText = focusSum.toFixed(1); } }; tick();
            
            document.getElementById('close-reveal-btn').onclick = async () => { document.getElementById('result-reveal-screen').classList.remove('active'); await updateStudent(student.id, { hasNewResult: false }); };
            refreshIcons();
        }, 1200);
    }

    function renderResults(allReleased) {
        const display = document.getElementById('results-display');
        display.innerHTML = allReleased.length ? '' : '<p>No results yet.</p>';

        const groups = {};
        allReleased.forEach(r => {
            if (!groups[r.examName]) groups[r.examName] = { final: null, parts: [] };
            groups[r.examName].parts.push(r);
            if (r.finalAggregate) groups[r.examName].final = r;
        });

        Object.values(groups).forEach(data => {
            const primary = data.final || data.parts[0];
            const displayMarks = primary.finalAggregate || primary.marks;
            const card = document.createElement('div'); card.className='card'; card.style.padding='1.8rem';
            let segmentsHTML = '';
            data.parts.forEach(p => {
                let cls = 'p1a';
                if (p.paperPart === 'Part 1' && p.subSection === 'Part B') cls = 'p1b';
                else if (p.paperPart === 'Part 2' && p.subSection === 'Part A') cls = 'p2a';
                else if (p.paperPart === 'Part 2' && p.subSection === 'Part B') cls = 'p2b';
                const width = p.marks * 0.5;
                const partTitle = `${p.paperPart} ${p.subSection}: ${p.marks.toFixed(1)}`;
                segmentsHTML += `<div class="segment ${cls}" style="width: ${width}%" data-tooltip="${partTitle}"></div>`;
            });

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><h3 style="font-size:1.15rem; margin:0; font-family:'Outfit';">${primary.examName}</h3><div class="tag-bar" style="margin-top:8px;"><span class="mini-tag">RANK #${primary.rank}</span><span class="mini-tag">GRADE ${primary.grade}</span></div></div>
                    <div style="text-align:right;"><span class="marks-counter" style="font-size:2.8rem;">${displayMarks.toFixed(1)}</span></div>
                </div>
                <div class="comparison-line">${segmentsHTML}<div class="comparison-mark" style="left: ${primary.classAverage}%"></div></div>
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); font-weight:800; letter-spacing:0.5px;"><span>AGGREGATE OUTCOME</span><span>MEAN: ${primary.classAverage}%</span></div>
                <div class="legend-group">
                   <div class="legend-item"><div class="legend-color" style="background:#6ad7ff;"></div> PAPER 1 (A)</div>
                   <div class="legend-item"><div class="legend-color" style="background:#0c4e89;"></div> PAPER 1 (B)</div>
                   <div class="legend-item"><div class="legend-color" style="background:#f59e0b;"></div> PAPER 2 (A)</div>
                   <div class="legend-item"><div class="legend-color" style="background:#10b981;"></div> PAPER 2 (B)</div>
                </div>
            `;
            display.appendChild(card);
        });
        refreshIcons();
    }

    function renderResources(mats) {
        const d = document.getElementById('materials-display'); d.innerHTML = '';
        mats.forEach(m => {
            const r = document.createElement('div'); r.style.padding = '0.9rem 0.5rem'; r.style.display = 'flex'; r.style.justifyContent = 'space-between'; r.style.borderBottom='1px solid var(--card-border)';
            r.innerHTML = `<div><strong style="font-size:0.85rem;">${m.title}</strong><p style="opacity:0.6; font-size:0.7rem;">${m.lesson}</p></div><a href="${m.fileURL}" target="_blank"><button style="padding: 0.5rem 1.4rem; font-size:0.7rem;">OPEN</button></a>`;
            d.appendChild(r);
        });
        refreshIcons();
    }
}
document.addEventListener('DOMContentLoaded', () => { initNavigation(); refreshIcons(); });
