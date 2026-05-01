export const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

export const initNavigation = () => {
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
    document.getElementById('nav-to-exams')?.addEventListener('click', () => {
        document.querySelector('.nav-item[data-tab="exams"]')?.click();
    });
};
