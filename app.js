/* app.js - Full Strategic Academic Hub */
import { db } from './firebase.js';
import { collection, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { 
  addStudent, deleteStudent, addResult, releaseAllAndCalculate, 
  getStudent, getStudentResults, updateStudent, uploadMaterialFile, 
  addMaterial, getMaterials, addExam, deleteExam, updateExam, deleteResult, unpublishResult,
  loginAdmin, logoutAdmin, subscribeToAuth
} from './functions.js';

const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };
let examsList = [];
let studentsList = [];
let isAppInitialized = false;

// Navigation Tab Engine
const initNavigation = () => {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    if (!navItems.length) return;
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            if (!tabId) return;
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${tabId}`) content.classList.add('active');
            });
            refreshIcons();
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar?.classList.contains('mobile-open')) { sidebar.classList.remove('mobile-open'); overlay?.classList.remove('active'); }
        });
    });
    document.getElementById('nav-to-exams')?.addEventListener('click', () => { document.querySelector('.nav-item[data-tab="exams"]')?.click(); });
};

const initAdmin = () => {
    const adminOverlay = document.getElementById('admin-login-overlay');
    const adminMain = document.getElementById('admin-main-wrapper');
    if (!adminOverlay) return;

    // AUTH SESSION MONITOR
    subscribeToAuth(user => {
        if (user) {
            adminOverlay.style.display = 'none';
            adminMain.style.display = 'flex';
        } else {
            adminOverlay.style.display = 'flex';
            adminMain.style.display = 'none';
        }
    });

    // LOGIN ACTION HANDLER
    const loginForm = document.getElementById('admin-login-form');
    const errorMsg = document.getElementById('admin-login-error');
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-password').value;
        const btn = document.getElementById('admin-login-submit');
        
        btn.disabled = true; btn.innerText = 'AUTHENTICATING...';
        errorMsg.style.display = 'none';

        try {
            await loginAdmin(email, pass);
        } catch (err) {
            console.error(err); 
            errorMsg.style.display = 'block';
            btn.disabled = false; btn.innerText = 'AUTHENTICATE';
        }
    });

    // LOGOUT ACTION HANDLER
    document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
        if (confirm('Terminate administrative session?')) await logoutAdmin();
    });

    if (!document.getElementById('sidebar')) return;

    // Real-time Dashboard Stats
    onSnapshot(collection(db, "students"), snap => { const el = document.getElementById('stat-students'); if (el) el.innerText = snap.size; });
    onSnapshot(query(collection(db, "results"), where("isReleased", "==", false)), snap => { const el = document.getElementById('stat-pending'); if (el) el.innerText = snap.size; });
    onSnapshot(query(collection(db, "results"), where("isReleased", "==", true)), snap => { const el = document.getElementById('stat-published'); if (el) el.innerText = snap.size; });

    // Mobile & Form Toggles
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    if (toggle) toggle.onclick = () => { sidebar?.classList.add('mobile-open'); overlay?.classList.add('active'); };
    if (overlay) overlay.onclick = () => { sidebar?.classList.remove('mobile-open'); overlay?.classList.remove('active'); };
    
    document.getElementById('toggle-add-form')?.addEventListener('click', () => { const f = document.getElementById('add-student-form'); if(f) f.style.display = window.getComputedStyle(f).display === 'none' ? 'block' : 'none'; });
    document.getElementById('cancel-student-add')?.addEventListener('click', () => { const f = document.getElementById('add-student-form'); if(f) f.style.display = 'none'; });

    // STUDENT REGISTRY & BATCH MAPPING
    onSnapshot(query(collection(db, "students"), orderBy("createdAt", "desc")), snapshot => {
        const tableBody = document.getElementById('student-table-body');
        const dashList = document.getElementById('dashboard-student-list');
        const batchSelect = document.getElementById('bulk-result-batch');
        if (!tableBody || !dashList) return;
        tableBody.innerHTML = ''; dashList.innerHTML = '';
        studentsList = [];
        const uniqueBatches = new Set();
        
        snapshot.forEach(doc => {
            const s = { id: doc.id, ...doc.data() };
            studentsList.push(s);
            uniqueBatches.add(s.class);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong style="color:white; display:block;">${s.name}</strong><small style="opacity:0.5;">ID: ${s.studentId}</small></td><td>${s.class}</td><td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success);">LIVE</span></td><td style="text-align:right;"><button class="delete-student-btn" data-id="${s.id}" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:0.4rem 0.8rem; border-radius:10px; font-size:0.65rem;">REMOVE</button></td>`;
            tableBody.appendChild(tr);
            const d = document.createElement('div'); d.style.padding = '1rem 0'; d.style.borderBottom = '1px solid var(--card-border)'; d.style.display='flex'; d.style.justifyContent='space-between';
            d.innerHTML = `<div><strong style="color:white; display:block; font-size:0.9rem;">${s.name}</strong><small style="opacity:0.4; font-size:0.75rem;">ID: ${s.studentId}</small></div><span class="mini-tag">${s.class}</span>`;
            dashList.appendChild(d);
        });

        if (batchSelect) {
            const currentVal = batchSelect.value;
            batchSelect.innerHTML = '<option value="">Select Target Batch...</option>';
            [...uniqueBatches].sort().forEach(b => { const opt = document.createElement('option'); opt.value = b; opt.innerText = b; batchSelect.appendChild(opt); });
            batchSelect.value = currentVal;
        }
        document.querySelectorAll('.delete-student-btn').forEach(btn => btn.onclick = async () => { if(confirm('Delete student and academic history?')) await deleteStudent(btn.getAttribute('data-id')); });
        
        // RE-TRIGGER REGISTRY RENDER IF PREVIOUSLY UNKNOWN
        const historyTable = document.getElementById('history-results-list');
        if (historyTable && historyTable.innerHTML.includes('Unknown Student')) {
           // We can't easily re-render without the snapshot, but the next results snapshot will pick it up.
           // For now, we'll manually trigger a refresh if a hidden global results list exists.
           if (window.lastResultsSnapshot) renderGroupedRegistry(window.lastResultsSnapshot);
        }
        refreshIcons();
    });

    // EXAMINATIONS TRACKER
    onSnapshot(query(collection(db, "exams"), orderBy("date", "desc")), snapshot => {
        const list = document.getElementById('exam-list');
        const examSelect = document.getElementById('bulk-result-exam');
        if (!list || !examSelect) return;
        examsList = []; list.innerHTML = '';
        const selectHTML = ['<option value="">Select Examination Paper...</option>'];
        snapshot.forEach(doc => {
            const e = { id: doc.id, ...doc.data() };
            examsList.push(e);
            selectHTML.push(`<option value="${e.id}">${e.paperName} (${e.paperPart} - ${e.subSection})</option>`);
            const d = document.createElement('div'); d.className='card exam-card'; d.style.padding='1.2rem'; d.style.background='rgba(255,255,255,0.02)'; d.style.cursor='pointer'; d.setAttribute('data-id', e.id);
            d.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><strong>${e.paperName}</strong><div style="font-size:0.75rem; opacity:0.6;">${e.paperPart} | ${e.subSection}</div></div><button class="delete-exam-btn" data-id="${e.id}" style="padding:0.4rem 0.8rem; font-size:0.6rem; background:rgba(239,68,68,0.1); color:var(--danger);">DEL</button></div>`;
            list.appendChild(d);
        });
        examSelect.innerHTML = selectHTML.join('');
        if (window.lastResultsSnapshot) renderGroupedRegistry(window.lastResultsSnapshot);
        document.querySelectorAll('.delete-exam-btn').forEach(btn => btn.onclick = async (e) => { e.stopPropagation(); if(confirm('Delete this exam log?')) await deleteExam(btn.getAttribute('data-id')); });
        
        // Edit Exam Modal Handlers
        document.querySelectorAll('.exam-card').forEach(card => {
            card.onclick = () => {
                const id = card.getAttribute('data-id');
                const e = examsList.find(exam => exam.id === id);
                if (e) {
                    document.getElementById('edit-exam-id').value = e.id;
                    document.getElementById('edit-exam-paper-name').value = e.paperName;
                    document.getElementById('edit-exam-part').value = e.paperPart;
                    document.getElementById('edit-exam-sub').value = e.subSection;
                    document.getElementById('edit-exam-date').value = e.date || '';
                    document.getElementById('edit-exam-structure').value = e.structure || '';
                    document.getElementById('edit-exam-overlay').style.display = 'flex';
                }
            };
        });
        
        refreshIcons();
    });

    document.getElementById('cancel-exam-edit')?.addEventListener('click', () => {
        document.getElementById('edit-exam-overlay').style.display = 'none';
    });

    document.getElementById('edit-exam-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-exam-id').value;
        const updateData = {
            paperName: document.getElementById('edit-exam-paper-name').value,
            paperPart: document.getElementById('edit-exam-part').value,
            subSection: document.getElementById('edit-exam-sub').value,
            date: document.getElementById('edit-exam-date').value,
            structure: document.getElementById('edit-exam-structure').value
        };
        try {
            await updateExam(id, updateData);
            document.getElementById('edit-exam-overlay').style.display = 'none';
            alert('Examination record refined.');
        } catch (err) {
            console.error('Update failed:', err);
            alert('Encountered an error updating the exam.');
        }
    });

    // BULK MARKS ENTRY ENGINE
    const batchSel = document.getElementById('bulk-result-batch');
    const examSel = document.getElementById('bulk-result-exam');
    const entryArea = document.getElementById('bulk-entry-area');
    const rosterTable = document.getElementById('bulk-student-roster');
    const bulkSaveBtn = document.getElementById('stage-bulk-btn');

    const triggerRoster = () => {
        const batch = batchSel.value;
        const examId = examSel.value;
        if (!batch || !examId) { entryArea.style.display = 'none'; return; }
        const filtered = studentsList.filter(s => s.class === batch).sort((a,b) => a.name.localeCompare(b.name));
        rosterTable.innerHTML = '';
        filtered.forEach(s => {
            const tr = document.createElement('tr'); tr.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            tr.innerHTML = `<td style="padding:1.2rem 1rem;"><strong style="display:block; color:white;">${s.name}</strong><small style="opacity:0.4;">REF: ${s.studentId}</small></td><td style="padding:1rem;"><input type="number" class="bulk-mark-input" data-sid="${s.studentId}" data-sname="${s.name}" placeholder="Enter Marks" style="margin:0; padding:0.8rem; font-weight:800; text-align:center; border-color: rgba(106, 215, 255, 0.2);"></td>`;
            rosterTable.appendChild(tr);
        });
        entryArea.style.display = 'block';
    };
    batchSel?.addEventListener('change', triggerRoster);
    examSel?.addEventListener('change', triggerRoster);

    bulkSaveBtn?.addEventListener('click', async () => {
        const examId = examSel.value; const batch = batchSel.value;
        const examDetails = examsList.find(e => e.id === examId); if (!examDetails) return;
        bulkSaveBtn.disabled = true; const initialText = bulkSaveBtn.innerText; bulkSaveBtn.innerHTML = 'SYNCING BATCH DATA...';
        const inputs = document.querySelectorAll('.bulk-mark-input');
        const promises = [];
        inputs.forEach(input => {
            const val = input.value.trim();
            if (val !== '') {
                promises.push(addResult({ 
                    studentId: input.getAttribute('data-sid'),
                    studentName: input.getAttribute('data-sname'), // Added for grouping clarity
                    batch: batch, // Added specifically for Registry grouping
                    examId, marks: parseFloat(val), 
                    examName: examDetails.paperName, 
                    paperPart: examDetails.paperPart, 
                    subSection: examDetails.subSection,
                    examDate: examDetails.date // Added date tracking
                }));
            }
        });
        if (promises.length === 0) { alert('No marks entered.'); bulkSaveBtn.disabled=false; bulkSaveBtn.innerText=initialText; return; }
        await Promise.all(promises);
        alert(`Successfully staged ${promises.length} entries for ${batch}.`);
        bulkSaveBtn.disabled = false; bulkSaveBtn.innerText = initialText; entryArea.style.display = 'none';
        batchSel.value = ''; examSel.value = '';
    });

    // STAGING & GROUPED HISTORY VIEWS
    onSnapshot(query(collection(db, "results"), where("isReleased", "==", false)), snap => {
        const list = document.getElementById('pending-results-list'); if (!list) return;
        const results = []; snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        results.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        list.innerHTML = results.length === 0 ? '<p style="color:var(--text-muted); padding:3rem; text-align:center;">No pending staging entries.</p>' : '';
        results.forEach(r => {
            const d = document.createElement('div'); d.className='card'; d.style.padding='1.2rem'; d.style.marginBottom='1rem'; d.style.background='rgba(255,158,11,0.03)';
            d.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><strong style="color:white; display:block;">${r.studentId}</strong><small style="opacity:0.6;">${r.examName} (${r.paperPart})</small></div><div style="text-align:right;"><span style="font-weight:800; font-size:1.4rem; color:var(--accent); display:block;">${r.marks}</span><button class="del-res-btn" data-id="${r.id}" style="padding:4px 8px; font-size:10px; background:transparent; color:var(--danger);">CANCEL</button></div></div>`;
            list.appendChild(d);
        });
        document.querySelectorAll('.del-res-btn').forEach(btn => btn.onclick = async () => { if(confirm('Discard this staged entry?')) await deleteResult(btn.getAttribute('data-id')); });
    });

    // ALL Results Registry (Archive Management)
    onSnapshot(query(collection(db, "results"), where("isReleased", "==", true)), snapshot => {
        window.lastResultsSnapshot = snapshot; // Cache for re-renders
        renderGroupedRegistry(snapshot);
    });

    async function downloadSheet(gid, format) {
        const element = document.getElementById(`export-area-${gid}`);
        if (!element) return;

        const originalStyle = element.style.cssText;
        element.style.padding = '40px';
        element.style.background = '#051d34'; // Ensure dark background for export
        element.style.color = '#fff';
        
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#051d34',
                scale: 2,
                logging: false,
                useCORS: true
            });

            if (format === 'png') {
                const link = document.createElement('a');
                link.download = `Results_Sheet_${gid}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } else if (format === 'pdf') {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Results_Sheet_${gid}.pdf`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate results sheet.');
        } finally {
            element.style.cssText = originalStyle;
        }
    }

    function renderGroupedRegistry(snapshot) {
        const tableBody = document.getElementById('history-results-list'); if (!tableBody) return;
        const all = []; snapshot.forEach(doc => {
            const r = { id: doc.id, ...doc.data() };
            if (!r.studentName || !r.batch || r.studentName === 'Unknown Student') {
                const sid = r.studentId?.toUpperCase();
                const s = studentsList.find(st => st.studentId?.toUpperCase() === sid);
                if (s) { r.studentName = s.name; r.batch = s.class; }
            }
            if (!r.examDate && r.examId) {
                const e = examsList.find(ex => ex.id === r.examId);
                if (e) r.examDate = e.date;
            }
            all.push(r);
        });
        
        const groups = {};
        all.forEach(r => {
            const gid = `${r.examName}_${r.paperPart}_${r.subSection}_${r.batch || 'Unassigned'}`;
            if (!groups[gid]) groups[gid] = { gid, paper: r.examName, part: r.paperPart, sec: r.subSection, batch: r.batch || 'Unassigned', date: r.examDate || '', items: [] };
            groups[gid].items.push(r);
        });

        tableBody.innerHTML = '';
        Object.values(groups).sort((a,b) => a.paper.localeCompare(b.paper)).forEach((g, idx) => {
            // Sort items by rank
            g.items.sort((a, b) => (parseInt(a.rank) || 999) - (parseInt(b.rank) || 999));

            const parentRow = document.createElement('tr');
            parentRow.style.cursor='pointer'; parentRow.style.background='rgba(255,255,255,0.02)';
            parentRow.innerHTML = `
                <td style="padding:1.4rem 1rem;"><strong style="color:white; display:block; font-size:0.95rem;">${g.paper}</strong><small style="opacity:0.5;">${g.part} - ${g.sec}</small></td>
                <td style="padding:1rem;"><span class="mini-tag">${g.batch}</span><br><small style="opacity:0.3; font-size:0.6rem; display:block; margin-top:4px;">${g.date || 'No Date'}</small></td>
                <td style="padding:1rem;"><span class="mini-tag" style="background:rgba(16,185,129,0.1); color:var(--success); border:none;">${g.items.length} RESULTS LIVE</span></td>
                <td style="text-align:right; padding:1rem;">
                    <button class="group-unpub-btn" data-batch='${JSON.stringify(g.items.map(i => i.id))}' style="background:rgba(245,158,11,0.1); color:var(--accent); padding:0.4rem 0.8rem; border-radius:10px; font-size:0.65rem;">UNPUB</button>
                    <button class="group-del-btn" data-batch='${JSON.stringify(g.items.map(i => i.id))}' style="background:rgba(239,68,68,0.1); color:var(--danger); padding:0.4rem 0.8rem; border-radius:10px; font-size:0.65rem;">DELETE</button>
                </td>
            `;
            
            const childRow = document.createElement('tr');
            childRow.style.display = 'none';
            
            const generateRowHTML = (i, isExport) => {
                const isFullPaper = (i.paperPart === 'Full Paper' && i.subSection === 'None');
                const roundedMark = Math.round(i.marks);
                return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid rgba(255,255,255,0.03);">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <span style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border-radius:50%; font-size:0.7rem; font-weight:800; color:var(--primary); border:1px solid var(--card-border);">#${i.rank}</span>
                        <div><strong style="color:var(--primary); font-size:0.85rem;">${i.studentName || 'Unknown Student'}</strong><small style="display:block; opacity:0.4; font-size:0.7rem;">ID: ${i.studentId}</small></div>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        ${isFullPaper ? `<span class="mini-tag" style="background:rgba(255,255,255,0.05); color:white; border:none; padding:4px 8px;">GRADE ${i.grade}</span>` : ''}
                        <span style="font-weight:800; font-size:1.1rem; color:white; min-width:65px; text-align:right;">${roundedMark}${isFullPaper ? '%' : ' / 50'}</span>
                        ${!isExport ? `<button class="del-res-btn" data-id="${i.id}" style="padding:4px 8px; font-size:9px; background:rgba(239,68,68,0.1); color:var(--danger);">DEL</button>` : ''}
                    </div>
                </div>
            `;
            };

            childRow.innerHTML = `
                <td colspan="4" style="padding: 0; background:rgba(0,0,0,0.3);">
                    <div style="padding:1.5rem; display:flex; justify-content:flex-end; gap:10px; border-bottom:1px solid var(--card-border);">
                        <button class="dl-btn-png" data-gid="${g.gid}" style="background:rgba(106, 215, 255, 0.1); color:var(--primary); padding:0.5rem 1rem; font-size:0.7rem; border-radius:10px;"><i data-lucide="image" style="width:14px;"></i> PNG SHEET</button>
                        <button class="dl-btn-pdf" data-gid="${g.gid}" style="background:rgba(106, 215, 255, 0.1); color:var(--primary); padding:0.5rem 1rem; font-size:0.7rem; border-radius:10px;"><i data-lucide="file-text" style="width:14px;"></i> PDF SHEET</button>
                    </div>
                    <div id="export-area-${g.gid}" style="padding:2.5rem; background:#051d34; max-width:800px; margin:0 auto; border:1px solid var(--card-border);">
                        <div style="text-align:center; padding-bottom:2rem; border-bottom:2px solid var(--primary); margin-bottom:2.5rem;">
                            <img src="Nethsara Rahiru.png" alt="Official Logo" style="height: 100px; display: block; margin: 0 auto 1.5rem auto;">
                            <h2 style="color:white; margin:10px 0 0 0; font-size:1.2rem; opacity:0.9;">${g.paper}</h2>
                            <div style="display:flex; justify-content:center; gap:10px; margin-top:10px;">
                                <span class="mini-tag" style="background:rgba(255,255,255,0.05); color:white; border:none;">BATCH: ${g.batch}</span>
                                <span class="mini-tag" style="background:rgba(255,255,255,0.05); color:white; border:none;">COMPONENT: ${g.part} ${g.sec}</span>
                                <span class="mini-tag" style="background:rgba(106,215,255,0.1); color:var(--primary); border:none;">HELD ON: ${g.date || 'TBD'}</span>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            ${g.items.map(i => generateRowHTML(i, true)).join('')}
                        </div>
                        <div style="margin-top:3rem; padding-top:1.5rem; border-top:1px solid rgba(255,255,255,0.1); text-align:center;">
                           <p style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:3px; font-weight:800; margin:0;">
                               Official Performance Record Registry
                           </p>
                           <p style="font-size:0.55rem; color:var(--primary); margin-top:5px; font-weight:600;">
                               VERIFIED BY NETHSARA RAHIRU ACADEMIC HUB
                           </p>
                        </div>
                    </div>
                    <!-- Admin View (with delete buttons) -->
                    <div style="padding:1.5rem; background:rgba(0,0,0,0.2);">
                        <div style="font-size:0.6rem; color:var(--text-muted); font-weight:800; margin-bottom:1rem; text-transform:uppercase;">Registry Console (Editable)</div>
                        ${g.items.map(i => generateRowHTML(i, false)).join('')}
                    </div>
                </td>
            `;
            
            parentRow.onclick = (e) => { if(e.target.tagName !== 'BUTTON') childRow.style.display = childRow.style.display === 'none' ? 'table-row' : 'none'; refreshIcons(); };
            
            tableBody.appendChild(parentRow);
            tableBody.appendChild(childRow);
        });

        // Event listeners for download buttons
        document.querySelectorAll('.dl-btn-png').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); downloadSheet(btn.getAttribute('data-gid'), 'png'); });
        document.querySelectorAll('.dl-btn-pdf').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); downloadSheet(btn.getAttribute('data-gid'), 'pdf'); });

        document.querySelectorAll('.group-unpub-btn').forEach(btn => btn.onclick = async (e) => { e.stopPropagation(); const ids = JSON.parse(btn.getAttribute('data-batch')); if(confirm(`Unpublish all ${ids.length} entries?`)) { for(const id of ids) await unpublishResult(id); await releaseAllAndCalculate(); } });
        document.querySelectorAll('.group-del-btn').forEach(btn => btn.onclick = async (e) => { e.stopPropagation(); const ids = JSON.parse(btn.getAttribute('data-batch')); if(confirm(`Delete all ${ids.length} results?`)) { for(const id of ids) await deleteResult(id); await releaseAllAndCalculate(); } });
        document.querySelectorAll('.del-res-btn').forEach(btn => btn.onclick = async (e) => { e.stopPropagation(); if(confirm('Delete single result?')) { await deleteResult(btn.getAttribute('data-id')); await releaseAllAndCalculate(); } });
        refreshIcons();
    }

    // GLOBAL ACTIONS
    document.querySelectorAll('#release-all-btn, #direct-release-btn').forEach(btn => {
        btn.onclick = async () => { btn.disabled = true; const oldText = btn.innerText; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Syncing...'; await releaseAllAndCalculate(); alert('Live Sync Complete: Rankings & History Refreshed.'); btn.innerText = oldText; btn.disabled = false; refreshIcons(); };
    });

    onSnapshot(query(collection(db, "materials"), orderBy("createdAt", "desc")), snapshot => {
        const list = document.getElementById('shared-materials-list'); if (!list) return; list.innerHTML = '';
        snapshot.forEach(doc => {
            const m = doc.data();
            const d = document.createElement('div'); d.style.padding = '0.75rem 0'; d.style.display='flex'; d.style.justifyContent='space-between'; d.style.borderBottom='1px solid var(--card-border)';
            d.innerHTML = `<div><strong style="color:white; font-size:0.9rem;">${m.title}</strong><small style="display:block; opacity:0.6; font-size:0.75rem;">${m.lesson}</small></div><i data-lucide="file-check" style="color:var(--primary); width:16px;"></i>`;
            list.appendChild(d);
        });
        refreshIcons();
    });
};

// Student Dashboard Logic
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
    display.innerHTML = allReleased.length ? '' : '<p>Academic data pending release.</p>';
    const groups = {};
    allReleased.forEach(r => { if (!groups[r.examName]) groups[r.examName] = { final: null, parts: [] }; groups[r.examName].parts.push(r); if (r.finalAggregate) groups[r.examName].final = r; });
    Object.values(groups).forEach(data => {
        const primary = data.final || data.parts[0];
        const isFullPaper = (primary.paperPart === 'Full Paper' && primary.subSection === 'None') || (primary.finalAggregate && data.parts.length > 1);
        const displayMarksValue = primary.finalAggregate || primary.marks;
        const displayMarks = Math.round(displayMarksValue);
        const card = document.createElement('div'); card.className='card';
        let segmentsHTML = '';
        data.parts.forEach(p => {
            let cls = 'p1a'; if (p.paperPart === 'Part 1' && p.subSection === 'Part B') cls = 'p1b'; else if (p.paperPart === 'Part 2' && p.subSection === 'Part A') cls = 'p2a'; else if (p.paperPart === 'Part 2' && p.subSection === 'Part B') cls = 'p2b';
            segmentsHTML += `<div class="segment ${cls}" style="width: ${p.marks * 0.5}%" data-tooltip="${p.paperPart} ${p.subSection}: ${Math.round(p.marks)} / 50"></div>`;
        });
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><h3 style="font-size:1.15rem; margin:0; font-family:'Outfit';">${primary.examName}</h3><div class="tag-bar" style="margin-top:8px;"><span class="mini-tag">RANK #${primary.rank}</span>${isFullPaper ? `<span class="mini-tag">GRADE ${primary.grade}</span>` : ''}</div></div><div style="text-align:right;"><span class="marks-counter" style="font-size:2.8rem;">${displayMarks}${isFullPaper ? '%' : ' / 50'}</span></div></div><div class="comparison-line">${segmentsHTML}<div class="comparison-mark" style="left: ${primary.classAverage}%"></div></div><div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); font-weight:800; letter-spacing:0.5px;"><span>AGGREGATE OUTCOME</span><span>MEAN: ${Math.round(primary.classAverage)}%</span></div><div class="legend-group"><div class="legend-item"><div class="legend-color" style="background:#6ad7ff;"></div> PAPER 1 (A)</div><div class="legend-item"><div class="legend-color" style="background:#7820d0;"></div> PAPER 1 (B)</div><div class="legend-item"><div class="legend-color" style="background:#f59e0b;"></div> PAPER 2 (A)</div><div class="legend-item"><div class="legend-color" style="background:#10b981;"></div> PAPER 2 (B)</div></div>`;
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

const run = () => { if (isAppInitialized) return; isAppInitialized = true; initNavigation(); initAdmin(); initPortal(); refreshIcons(); };
window.addEventListener('load', run); if (document.readyState === 'complete') run();
