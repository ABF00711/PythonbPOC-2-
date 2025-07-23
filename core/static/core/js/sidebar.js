// Sidebar submenu collapse state persistence
const sidebarCollapseKey = 'pythonpoc_sidebar_expanded';

function getExpandedMenus() {
    return JSON.parse(localStorage.getItem(sidebarCollapseKey) || '[]');
}
function setExpandedMenus(ids) {
    localStorage.setItem(sidebarCollapseKey, JSON.stringify(ids));
}

function setupSidebarCollapsePersistence() {
    const expanded = new Set(getExpandedMenus());
    // Restore expanded state
    expanded.forEach(id => {
        const submenu = document.getElementById('submenu-' + id);
        if (submenu) submenu.classList.add('show');
    });
    // Listen for collapse/expand events
    document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#submenu-')) {
            const id = href.replace('#submenu-', '');
            link.addEventListener('click', function(e) {
                setTimeout(() => {
                    const submenu = document.getElementById('submenu-' + id);
                    let expandedMenus = new Set(getExpandedMenus());
                    if (submenu && submenu.classList.contains('show')) {
                        expandedMenus.add(id);
                    } else {
                        expandedMenus.delete(id);
                    }
                    setExpandedMenus(Array.from(expandedMenus));
                }, 350); // Wait for collapse animation
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', setupSidebarCollapsePersistence); 