import { getMaterials, getUnits } from './functions.js';
import { refreshIcons } from './ui.js';

let allMaterials = [];
let allUnits = [];
let currentLesson = null;

const initSSLE = async () => {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('active');

    try {
        const [mats, units] = await Promise.all([getMaterials(), getUnits()]);
        allMaterials = mats;
        allUnits = units;
        renderSidebar(allMaterials, allUnits);
        initSearch();
    } catch (error) {
        console.error('Failed to load SSLE data:', error);
    } finally {
        overlay.classList.remove('active');
        refreshIcons();
    }
};

const getProgress = () => {
    const p = localStorage.getItem('ssle_progress');
    return p ? JSON.parse(p) : {};
};

const saveProgress = (lessonId) => {
    const p = getProgress();
    p[lessonId] = true;
    localStorage.setItem('ssle_progress', JSON.stringify(p));
};

const renderSidebar = (materials, unitsSource = allUnits) => {
    const container = document.getElementById('unit-container');
    container.innerHTML = '';

    if (unitsSource.length === 0 && materials.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding: 2rem;">No units available yet.</p>';
        return;
    }

    const progress = getProgress();
    
    // Group materials by "lesson" (Unit Name)
    const groupedMats = {};
    materials.forEach(m => {
        const unitName = m.lesson || 'General Units';
        if (!groupedMats[unitName]) groupedMats[unitName] = [];
        groupedMats[unitName].push(m);
    });

    // We render based on unitsSource (which could be the full list or filtered list)
    // If we're searching, we might want to show units that have matching materials
    unitsSource.forEach(u => {
        const unitName = u.name;
        const lessons = groupedMats[unitName] || [];
        
        // Skip units with no lessons if we are searching and there are no direct unit matches
        // For now, we'll show units if they have lessons.
        if (lessons.length === 0 && unitsSource.length !== allUnits.length) return;

        const completedCount = lessons.filter(l => progress[l.id]).length;
        const completionRate = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

        const unitDiv = document.createElement('div');
        unitDiv.className = 'unit-item';
        
        const title = document.createElement('div');
        title.className = 'unit-title';
        title.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <span style="display:flex; align-items:center; gap:8px;"><i data-lucide="layers" style="width:14px; height:14px;"></i> ${unitName}</span>
                <span style="font-size:0.6rem; opacity:0.6;">${completionRate}%</span>
            </div>
        `;
        unitDiv.appendChild(title);

        lessons.forEach(lesson => {
            const isCompleted = progress[lesson.id];
            const link = document.createElement('a');
            link.href = '#';
            link.className = `lesson-link ${currentLesson?.id === lesson.id ? 'active' : ''}`;
            link.innerHTML = `
                <i data-lucide="${isCompleted ? 'check-circle' : (lesson.fileURL.includes('youtube') || lesson.fileURL.includes('vimeo') ? 'play-circle' : 'file-text')}" 
                   style="${isCompleted ? 'color:var(--success); opacity:1;' : ''}"></i>
                <span>${lesson.title}</span>
            `;
            link.onclick = (e) => {
                e.preventDefault();
                selectLesson(lesson);
                document.querySelectorAll('.lesson-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                if(window.innerWidth <= 1024) document.getElementById('ssle-sidebar').classList.remove('active');
            };
            unitDiv.appendChild(link);
        });

        container.appendChild(unitDiv);
    });
    refreshIcons();
};

const selectLesson = (lesson) => {
    currentLesson = lesson;
    const contentArea = document.getElementById('content-display');
    const progress = getProgress();
    const isCompleted = progress[lesson.id];
    
    const isVideo = lesson.fileURL.includes('youtube.com') || lesson.fileURL.includes('youtu.be') || lesson.fileURL.includes('vimeo.com');
    
    let mediaHTML = '';
    if (isVideo) {
        let embedURL = lesson.fileURL;
        if (embedURL.includes('youtube.com/watch?v=')) embedURL = embedURL.replace('watch?v=', 'embed/');
        else if (embedURL.includes('youtu.be/')) embedURL = embedURL.replace('youtu.be/', 'youtube.com/embed/');
        mediaHTML = `<div class="media-container"><iframe src="${embedURL}" allowfullscreen></iframe></div>`;
    } else {
        mediaHTML = `<div class="media-container pdf-placeholder"><div><i data-lucide="file-text" style="width: 60px; height: 60px; color: var(--primary); margin-bottom: 1.5rem; opacity: 0.5;"></i><h3 style="margin-bottom: 1rem;">Document Resource</h3><p style="color: var(--text-muted); margin-bottom: 2rem;">This lesson contains a PDF or document resource.</p><a href="${lesson.fileURL}" target="_blank" class="btn-primary"><i data-lucide="external-link"></i> VIEW RESOURCE</a></div></div>`;
    }

    contentArea.innerHTML = `
        <div class="content-header">
            <span class="badge" style="background: rgba(106, 215, 255, 0.1); color: var(--primary); margin-bottom: 1rem;">${lesson.lesson}</span>
            <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; letter-spacing: -1px;">${lesson.title}</h1>
            <div style="display: flex; gap: 1rem; align-items: center; color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">
                <span style="display: flex; align-items: center; gap: 4px;"><i data-lucide="clock" style="width:14px;"></i> 15 MIN READ</span>
                ${isCompleted ? '<span style="color:var(--success); display:flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px;"></i> COMPLETED</span>' : ''}
            </div>
        </div>

        <div class="content-card">
            ${mediaHTML}
            <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Lesson Overview</h2>
            <p style="color: var(--text-muted); line-height: 1.8; font-size: 1rem; margin-bottom: 2rem;">
                This lesson covers the essential concepts of <strong>${lesson.title}</strong> within the <strong>${lesson.lesson}</strong> unit. 
            </p>
            
            <div style="padding: 1.5rem; background: rgba(106, 215, 255, 0.03); border-radius: 16px; border-left: 4px solid var(--primary); margin-bottom: 3rem;">
                <h4 style="color: var(--primary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Learning Objective</h4>
                <p style="font-size: 0.9rem; color: white;">Master the fundamental principles and apply them to solve complex problems related to this topic.</p>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--card-border); padding-top: 2rem;">
                <button class="btn-primary" style="background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--card-border);" onclick="window.scrollTo(0,0)">
                    <i data-lucide="arrow-up"></i> TOP
                </button>
                <button class="btn-primary" id="complete-btn" ${isCompleted ? 'style="opacity:0.5; cursor:default;" disabled' : ''}>
                    ${isCompleted ? 'COMPLETED' : 'MARK AS COMPLETED <i data-lucide="check-circle"></i>'}
                </button>
            </div>
        </div>
    `;

    document.getElementById('complete-btn').onclick = () => {
        saveProgress(lesson.id);
        renderSidebar(allMaterials, allUnits); // Refresh sidebar progress
        selectLesson(lesson); // Refresh current view
    };

    refreshIcons();
    window.scrollTo(0,0);
};


const initSearch = () => {
    const searchInput = document.getElementById('unit-search');
    searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase();
        
        // Filter units that match the query OR have materials that match the query
        const filteredUnits = allUnits.filter(u => {
            const unitMatches = u.name.toLowerCase().includes(query);
            const materialsInUnit = allMaterials.filter(m => m.lesson === u.name);
            const materialMatches = materialsInUnit.some(m => m.title.toLowerCase().includes(query));
            return unitMatches || materialMatches;
        });

        // Also filter materials globally to show only relevant ones under the filtered units
        const filteredMaterials = allMaterials.filter(m => 
            m.title.toLowerCase().includes(query) || 
            (m.lesson && m.lesson.toLowerCase().includes(query))
        );

        renderSidebar(filteredMaterials, filteredUnits);
    };
};

window.addEventListener('load', initSSLE);
if (document.readyState === 'complete') initSSLE();
