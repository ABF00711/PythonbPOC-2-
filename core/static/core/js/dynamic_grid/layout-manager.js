import { showToast } from './utils.js';

/**
 * Layout Manager for Dynamic Grid
 * Handles saving, loading, and managing grid layouts
 */

class LayoutManager {
    constructor() {
        this.tableName = '';
        this.layouts = [];
        this.pendingLayoutData = null;
        this.init();
    }

    init() {
        this.tableName = document.querySelector('[data-table-name]')?.dataset.tableName || 'default';
        this.attachEventListeners();
        this.loadDefaultLayout();
    }

    attachEventListeners() {
        // Layout Manager button
        const layoutsBtn = document.getElementById('layouts-btn');
        if (layoutsBtn) {
            layoutsBtn.addEventListener('click', () => this.showLayoutsModal());
        }

        // Save layout button
        const saveLayoutBtn = document.getElementById('save-layout-btn');
        if (saveLayoutBtn) {
            saveLayoutBtn.addEventListener('click', () => this.saveCurrentLayout());
        }

        // Confirm overwrite button
        const confirmOverwriteBtn = document.getElementById('confirm-overwrite-btn');
        if (confirmOverwriteBtn) {
            confirmOverwriteBtn.addEventListener('click', () => this.confirmOverwriteLayout());
        }

        // Layout name input enter key
        const layoutNameInput = document.getElementById('layout-name-input');
        if (layoutNameInput) {
            layoutNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveCurrentLayout();
                }
            });
        }
    }

    async showLayoutsModal() {
        try {
            await this.loadLayouts();
            this.renderLayoutsList();
            
            const modal = new bootstrap.Modal(document.getElementById('layoutsModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing layouts modal:', error);
            showToast('Error loading layouts', 'error');
        }
    }

    async loadLayouts() {
        try {
            const response = await fetch(`/api/layouts/${this.tableName}/`);
            const data = await response.json();
            this.layouts = data.layouts || [];
        } catch (error) {
            console.error('Error loading layouts:', error);
            this.layouts = [];
        }
    }

    renderLayoutsList() {
        const container = document.getElementById('saved-layouts-list');
        if (!container) return;

        if (this.layouts.length === 0) {
            container.innerHTML = '<p class="text-muted">No saved layouts found.</p>';
            return;
        }

        container.innerHTML = this.layouts.map(layout => `
            <div class="layout-item border rounded p-3 mb-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            ${layout.layout_name}
                            ${layout.is_default ? '<span class="badge bg-primary ms-2">Default</span>' : ''}
                        </h6>
                        <small class="text-muted">
                            Updated: ${layout.updated_at}
                        </small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary" 
                                onclick="window.layoutManager.loadLayout(${layout.id})">
                            Load
                        </button>
                        ${!layout.is_default ? `
                            <button type="button" class="btn btn-outline-success" 
                                    onclick="window.layoutManager.setDefaultLayout(${layout.id})">
                                Set Default
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-outline-danger" 
                                onclick="window.layoutManager.deleteLayout(${layout.id})">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async saveCurrentLayout() {
        const layoutName = document.getElementById('layout-name-input')?.value.trim();
        const isDefault = document.getElementById('set-as-default-checkbox')?.checked || false;

        if (!layoutName) {
            showToast('Please enter a layout name', 'error');
            return;
        }

        // Check if layout name already exists
        const existingLayout = this.layouts.find(layout => layout.layout_name === layoutName);
        if (existingLayout) {
            this.showOverwriteConfirmation(layoutName);
            return;
        }

        await this.performSaveLayout(layoutName, isDefault);
    }

    showOverwriteConfirmation(layoutName) {
        document.getElementById('existing-layout-name').textContent = layoutName;
        this.pendingLayoutData = {
            name: layoutName,
            isDefault: document.getElementById('set-as-default-checkbox')?.checked || false
        };
        
        const modal = new bootstrap.Modal(document.getElementById('layoutOverwriteModal'));
        modal.show();
    }

    async confirmOverwriteLayout() {
        if (this.pendingLayoutData) {
            await this.performSaveLayout(this.pendingLayoutData.name, this.pendingLayoutData.isDefault);
            this.pendingLayoutData = null;
            
            // Close overwrite modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('layoutOverwriteModal'));
            if (modal) modal.hide();
        }
    }

    async performSaveLayout(layoutName, isDefault) {
        try {
            const layoutData = this.getCurrentLayoutData();
            
            const response = await fetch(`/api/layouts/${this.tableName}/save/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    layout_name: layoutName,
                    layout_json: layoutData,
                    is_default: isDefault
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                showToast(result.message, 'success');
                document.getElementById('layout-name-input').value = '';
                document.getElementById('set-as-default-checkbox').checked = false;
                await this.loadLayouts();
                this.renderLayoutsList();
            } else {
                showToast(result.error || 'Error saving layout', 'error');
            }
        } catch (error) {
            console.error('Error saving layout:', error);
            showToast('Error saving layout', 'error');
        }
    }

    getCurrentLayoutData() {
        const layoutData = {
            columnVisibility: {},
            columnWidths: {},
            columnOrder: [],
            sortState: null
        };

        // Get column visibility
        if (window.columnVisibilityManager) {
            layoutData.columnVisibility = Array.from(window.columnVisibilityManager.visibleColumns);
        }

        // Get column widths
        if (window.columnResizer) {
            const headers = document.querySelectorAll('.resizable-column');
            headers.forEach(header => {
                const columnName = header.dataset.columnName;
                if (columnName) {
                    layoutData.columnWidths[columnName] = header.style.width || '';
                }
            });
        }

        // Get column order
        if (window.columnDragger) {
            const headers = document.querySelectorAll('.resizable-column');
            layoutData.columnOrder = Array.from(headers).map(header => header.dataset.columnName);
        }

        // Get sort state
        if (window.columnSorter) {
            layoutData.sortState = window.columnSorter.currentSort;
        }

        return layoutData;
    }

    async loadLayout(layoutId) {
        try {
            const response = await fetch(`/api/layouts/${this.tableName}/${layoutId}/load/`);
            const data = await response.json();
            
            if (response.ok) {
                this.applyLayoutData(data.layout_json);
                showToast(`Layout "${data.layout_name}" loaded successfully`, 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('layoutsModal'));
                if (modal) modal.hide();
            } else {
                showToast(data.error || 'Error loading layout', 'error');
            }
        } catch (error) {
            console.error('Error loading layout:', error);
            showToast('Error loading layout', 'error');
        }
    }

    applyLayoutData(layoutData) {
        // Apply column visibility
        if (layoutData.columnVisibility && window.columnVisibilityManager) {
            window.columnVisibilityManager.visibleColumns = new Set(layoutData.columnVisibility);
            window.columnVisibilityManager.applyVisibilityToGrid();
        }

        // Apply column widths
        if (layoutData.columnWidths && window.columnResizer) {
            Object.entries(layoutData.columnWidths).forEach(([columnName, width]) => {
                const header = document.querySelector(`[data-column-name="${columnName}"]`);
                if (header && width) {
                    header.style.width = width;
                }
            });
        }

        // Apply column order
        if (layoutData.columnOrder && window.columnDragger) {
            // Save the order and let the dragger apply it
            const storageKey = `grid_column_order_${this.tableName}`;
            localStorage.setItem(storageKey, JSON.stringify(layoutData.columnOrder));
            window.columnDragger.loadSavedColumnOrder();
        }

        // Apply sort state
        if (layoutData.sortState && window.columnSorter) {
            window.columnSorter.currentSort = layoutData.sortState;
            window.columnSorter.applySavedSort(layoutData.sortState.column, layoutData.sortState.direction);
        }
    }

    async setDefaultLayout(layoutId) {
        try {
            const response = await fetch(`/api/layouts/${this.tableName}/${layoutId}/set-default/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                }
            });

            const result = await response.json();
            
            if (response.ok) {
                showToast(result.message, 'success');
                await this.loadLayouts();
                this.renderLayoutsList();
            } else {
                showToast(result.error || 'Error setting default layout', 'error');
            }
        } catch (error) {
            console.error('Error setting default layout:', error);
            showToast('Error setting default layout', 'error');
        }
    }

    async deleteLayout(layoutId) {
        if (!confirm('Are you sure you want to delete this layout?')) {
            return;
        }

        try {
            const response = await fetch(`/api/layouts/${this.tableName}/${layoutId}/delete/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                }
            });

            const result = await response.json();
            
            if (response.ok) {
                showToast(result.message, 'success');
                await this.loadLayouts();
                this.renderLayoutsList();
            } else {
                showToast(result.error || 'Error deleting layout', 'error');
            }
        } catch (error) {
            console.error('Error deleting layout:', error);
            showToast('Error deleting layout', 'error');
        }
    }

    async loadDefaultLayout() {
        try {
            await this.loadLayouts();
            const defaultLayout = this.layouts.find(layout => layout.is_default);
            if (defaultLayout) {
                await this.loadLayout(defaultLayout.id);
            }
        } catch (error) {
            console.error('Error loading default layout:', error);
        }
    }

    onTableChange(newTableName) {
        if (this.tableName !== newTableName) {
            this.tableName = newTableName;
            this.layouts = [];
            this.loadDefaultLayout();
        }
    }
}

// Initialize layout manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.layoutManager = new LayoutManager();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutManager;
}