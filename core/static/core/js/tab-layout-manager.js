import { showToast } from './dynamic_grid/utils.js';

/**
 * Tab Layout Manager for Top Navbar
 * Handles saving, loading, and managing tab layouts
 */

class TabLayoutManager {
    constructor() {
        this.layouts = [];
        this.pendingLayoutData = null;
        this.isLoadingDefault = false; // Flag to prevent infinite loops
        this.init();
    }

    init() {
        this.attachEventListeners();
        // Only load default layout if user has no tabs set up
        this.loadDefaultLayoutIfNeeded();
    }

    attachEventListeners() {
        // Tab Layout Manager button
        const tabLayoutsBtn = document.getElementById('tab-layouts-btn');
        if (tabLayoutsBtn) {
            tabLayoutsBtn.addEventListener('click', () => this.showTabLayoutsModal());
        }

        // Save tab layout button
        const saveTabLayoutBtn = document.getElementById('save-tab-layout-btn');
        if (saveTabLayoutBtn) {
            saveTabLayoutBtn.addEventListener('click', () => this.saveCurrentTabLayout());
        }

        // Confirm overwrite button
        const confirmOverwriteBtn = document.getElementById('confirm-tab-overwrite-btn');
        if (confirmOverwriteBtn) {
            confirmOverwriteBtn.addEventListener('click', () => this.confirmOverwriteTabLayout());
        }

        // Tab layout name input enter key
        const tabLayoutNameInput = document.getElementById('tab-layout-name-input');
        if (tabLayoutNameInput) {
            tabLayoutNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveCurrentTabLayout();
                }
            });
        }
    }

    async showTabLayoutsModal() {
        try {
            await this.loadTabLayouts();
            this.renderTabLayoutsList();
            
            const modal = new bootstrap.Modal(document.getElementById('tabLayoutsModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing tab layouts modal:', error);
            showToast('Error loading tab layouts', 'error');
        }
    }

    async loadTabLayouts() {
        try {
            const response = await fetch('/api/tab-layouts/');
            const data = await response.json();
            this.layouts = data.layouts || [];
        } catch (error) {
            console.error('Error loading tab layouts:', error);
            this.layouts = [];
        }
    }

    renderTabLayoutsList() {
        const container = document.getElementById('saved-tab-layouts-list');
        if (!container) return;

        if (this.layouts.length === 0) {
            container.innerHTML = '<p class="text-muted">No saved tab layouts found.</p>';
            return;
        }

        container.innerHTML = this.layouts.map(layout => `
            <div class="layout-item border rounded p-3 mb-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            ${layout.tabs_name}
                            ${layout.is_default ? '<span class="badge bg-primary ms-2">Default</span>' : ''}
                        </h6>
                        <small class="text-muted">
                            Updated: ${layout.updated_at}
                        </small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary" 
                                onclick="window.tabLayoutManager.loadTabLayout(${layout.id})">
                            Load
                        </button>
                        ${!layout.is_default ? `
                            <button type="button" class="btn btn-outline-success" 
                                    onclick="window.tabLayoutManager.setDefaultTabLayout(${layout.id})">
                                Set Default
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-outline-danger" 
                                onclick="window.tabLayoutManager.deleteTabLayout(${layout.id})">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async saveCurrentTabLayout() {
        const layoutNameInput = document.getElementById('tab-layout-name-input');
        const setDefaultCheckbox = document.getElementById('tab-set-default-checkbox');
        
        if (!layoutNameInput) return;

        const layoutName = layoutNameInput.value.trim();
        const isDefault = setDefaultCheckbox ? setDefaultCheckbox.checked : false;
        
        if (!layoutName) {
            showToast('Please enter a layout name', 'error');
            return;
        }

        // Check if layout with same name exists
        const existingLayout = this.layouts.find(layout => layout.tabs_name === layoutName);
        if (existingLayout) {
            this.pendingLayoutData = { layoutName, isDefault };
            this.showOverwriteConfirmation(layoutName);
            return;
        }

        await this.performSaveTabLayout(layoutName, isDefault);
    }

    showOverwriteConfirmation(layoutName) {
        const modal = new bootstrap.Modal(document.getElementById('tabLayoutOverwriteModal'));
        document.getElementById('overwrite-layout-name').textContent = layoutName;
        modal.show();
    }

    async confirmOverwriteTabLayout() {
        if (this.pendingLayoutData) {
            await this.performSaveTabLayout(this.pendingLayoutData.layoutName, this.pendingLayoutData.isDefault);
            this.pendingLayoutData = null;
            
            // Close overwrite modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('tabLayoutOverwriteModal'));
            if (modal) modal.hide();
        }
    }

    async performSaveTabLayout(layoutName, isDefault) {
        try {
            const currentTabData = this.getCurrentTabData();
            
            const response = await fetch('/api/tab-layouts/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    tabs_name: layoutName,
                    tabs_data: currentTabData,
                    is_default: isDefault
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                showToast(data.message, 'success');
                
                // Close save modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('tabLayoutsModal'));
                if (modal) modal.hide();
                
                // Refresh layouts list
                await this.loadTabLayouts();
                this.renderTabLayoutsList();
                
                // Clear input and checkbox
                const layoutNameInput = document.getElementById('tab-layout-name-input');
                const setDefaultCheckbox = document.getElementById('tab-set-default-checkbox');
                if (layoutNameInput) layoutNameInput.value = '';
                if (setDefaultCheckbox) setDefaultCheckbox.checked = false;
            } else {
                showToast(data.error || 'Error saving tab layout', 'error');
            }
        } catch (error) {
            console.error('Error saving tab layout:', error);
            showToast('Error saving tab layout', 'error');
        }
    }

    getCurrentTabData() {
        // Get current tabs from the tabbed navbar
        const tabs = getTabs(); // Using the existing getTabs function from top_nav_tabs.html
        const activeTab = getActiveTab(); // Using the existing getActiveTab function
        
        // Extract tags and tabTexts from current tabs
        const tags = tabs.map(tab => {
            // Extract the tag from the URL based on the URL format
            if (tab.url === '/') {
                return 'home';
            } else if (tab.url === '/about/') {
                return 'about';
            } else if (tab.url === '/contact/') {
                return 'contact';
            } else if (tab.url.startsWith('/dynamic-grid/')) {
                // Extract the tag from the URL (e.g., "/dynamic-grid/customers/" -> "customers")
                const urlParts = tab.url.split('/');
                return urlParts[urlParts.length - 2] || tab.url;
            } else {
                // Fallback: use the title as tag
                return tab.title.toLowerCase();
            }
        });
        
        const tabTexts = tabs.map(tab => tab.title);
        
        // Find the selected tag from the active tab
        const selectedTag = activeTab ? (() => {
            if (activeTab === '/') {
                return 'home';
            } else if (activeTab === '/about/') {
                return 'about';
            } else if (activeTab === '/contact/') {
                return 'contact';
            } else if (activeTab.startsWith('/dynamic-grid/')) {
                const urlParts = activeTab.split('/');
                return urlParts[urlParts.length - 2] || activeTab;
            } else {
                return activeTab;
            }
        })() : (tags[0] || '');
        
        return {
            tags: tags,
            tabTexts: tabTexts,
            selectedTag: selectedTag
        };
    }

    async loadTabLayout(layoutId) {
        try {
            const response = await fetch(`/api/tab-layouts/${layoutId}/load/`);
            const data = await response.json();
            
            if (response.ok) {
                this.applyTabLayoutData(data.tabs_data, true); // true = manual load
                showToast(`Tab layout "${data.tabs_name}" loaded successfully`, 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('tabLayoutsModal'));
                if (modal) modal.hide();
            } else {
                showToast(data.error || 'Error loading tab layout', 'error');
            }
        } catch (error) {
            console.error('Error loading tab layout:', error);
            showToast('Error loading tab layout', 'error');
        }
    }

    applyTabLayoutData(tabsData, isManualLoad = false) {
        // Clear current tabs
        setTabs([]);
        
        // Add tabs from the layout data
        if (tabsData.tags && tabsData.tabTexts) {
            const newTabs = tabsData.tags.map((tag, index) => {
                const title = tabsData.tabTexts[index] || tag;
                // Use correct URL format based on the tag/title
                let url;
                if (tag.toLowerCase() === 'home') {
                    url = '/';
                } else if (tag.toLowerCase() === 'about') {
                    url = '/about/';
                } else if (tag.toLowerCase() === 'contact') {
                    url = '/contact/';
                } else {
                    url = `/dynamic-grid/${tag}/`;
                }
                
                return { title, url };
            });
            
            setTabs(newTabs);
        }
        
        // Set active tab
        if (tabsData.selectedTag) {
            let activeUrl;
            if (tabsData.selectedTag.toLowerCase() === 'home') {
                activeUrl = '/';
            } else if (tabsData.selectedTag.toLowerCase() === 'about') {
                activeUrl = '/about/';
            } else if (tabsData.selectedTag.toLowerCase() === 'contact') {
                activeUrl = '/contact/';
            } else {
                activeUrl = `/dynamic-grid/${tabsData.selectedTag}/`;
            }
            setActiveTab(activeUrl);
        }
        
        // Re-render tabs
        renderTabs();
        
        // Only navigate if it's a manual load or if we're not already on the correct page
        if (tabsData.selectedTag && (isManualLoad || this.shouldNavigateToTab(tabsData.selectedTag))) {
            let navigateUrl;
            if (tabsData.selectedTag.toLowerCase() === 'home') {
                navigateUrl = '/';
            } else if (tabsData.selectedTag.toLowerCase() === 'about') {
                navigateUrl = '/about/';
            } else if (tabsData.selectedTag.toLowerCase() === 'contact') {
                navigateUrl = '/contact/';
            } else {
                navigateUrl = `/dynamic-grid/${tabsData.selectedTag}/`;
            }
            window.location.href = navigateUrl;
        }
    }

    shouldNavigateToTab(selectedTag) {
        // Check if we're already on the correct page to prevent unnecessary navigation
        const currentPath = window.location.pathname;
        let expectedPath;
        
        if (selectedTag.toLowerCase() === 'home') {
            expectedPath = '/';
        } else if (selectedTag.toLowerCase() === 'about') {
            expectedPath = '/about/';
        } else if (selectedTag.toLowerCase() === 'contact') {
            expectedPath = '/contact/';
        } else {
            expectedPath = `/dynamic-grid/${selectedTag}/`;
        }
        
        return currentPath !== expectedPath;
    }

    async setDefaultTabLayout(layoutId) {
        try {
            const response = await fetch(`/api/tab-layouts/${layoutId}/set-default/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                showToast(data.message, 'success');
                
                // Refresh layouts list
                await this.loadTabLayouts();
                this.renderTabLayoutsList();
            } else {
                showToast(data.error || 'Error setting default tab layout', 'error');
            }
        } catch (error) {
            console.error('Error setting default tab layout:', error);
            showToast('Error setting default tab layout', 'error');
        }
    }

    async deleteTabLayout(layoutId) {
        if (!confirm('Are you sure you want to delete this tab layout?')) {
            return;
        }

        try {
            const response = await fetch(`/api/tab-layouts/${layoutId}/delete/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                showToast(data.message, 'success');
                
                // Refresh layouts list
                await this.loadTabLayouts();
                this.renderTabLayoutsList();
            } else {
                showToast(data.error || 'Error deleting tab layout', 'error');
            }
        } catch (error) {
            console.error('Error deleting tab layout:', error);
            showToast('Error deleting tab layout', 'error');
        }
    }

    async loadDefaultLayoutIfNeeded() {
        // Only load default layout if user has no tabs set up
        const currentTabs = getTabs();
        if (currentTabs.length <= 1 && currentTabs[0]?.url === '/') {
            try {
                await this.loadTabLayouts();
                const defaultLayout = this.layouts.find(layout => layout.is_default);
                
                if (defaultLayout && !this.isLoadingDefault) {
                    this.isLoadingDefault = true;
                    
                    // Load the default layout automatically
                    const response = await fetch(`/api/tab-layouts/${defaultLayout.id}/load/`);
                    const data = await response.json();
                    
                    if (response.ok) {
                        this.applyTabLayoutData(data.tabs_data, false); // false = auto-load
                        console.log(`Default tab layout "${data.tabs_name}" loaded automatically`);
                    }
                    
                    this.isLoadingDefault = false;
                }
            } catch (error) {
                console.error('Error loading default tab layout:', error);
                this.isLoadingDefault = false;
            }
        }
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || '';
    }
}

// Initialize the tab layout manager
window.tabLayoutManager = new TabLayoutManager(); 