/**
 * Column Visibility Manager for Dynamic Grid
 * Handles column visibility management with modal interface
 */

class ColumnVisibilityManager {
    constructor() {
        this.tableName = '';
        this.fieldConfigs = [];
        this.visibleColumns = new Set();
        this.init();
    }

    init() {
        this.tableName = document.querySelector('[data-table-name]')?.dataset.tableName || 'default';
        this.attachEventListeners();
        this.loadVisibleColumns();
    }

    attachEventListeners() {
        const columnsBtn = document.getElementById('columns-btn');
        if (columnsBtn) {
            columnsBtn.addEventListener('click', () => this.showColumnsModal());
        }

        const selectAllBtn = document.getElementById('select-all-columns-btn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllColumns());
        }

        const deselectAllBtn = document.getElementById('deselect-all-columns-btn');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => this.deselectAllColumns());
        }

        const applyBtn = document.getElementById('apply-columns-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyColumnVisibility());
        }
    }

    async showColumnsModal() {
        try {
            // Fetch field configurations
            const response = await fetch(`/api/fields/${this.tableName}/`);
            const data = await response.json();
            this.fieldConfigs = data.fields;

            // Render column checkboxes
            this.renderColumnCheckboxes();

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('columnsModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading column configurations:', error);
        }
    }

    renderColumnCheckboxes() {
        const container = document.getElementById('column-visibility-fields');
        if (!container) return;

        container.innerHTML = '';

        // If no saved state exists, set all columns as visible by default
        if (this.visibleColumns.size === 0) {
            this.fieldConfigs.forEach(field => {
                this.visibleColumns.add(field.name);
            });
        }

        this.fieldConfigs.forEach(field => {
            const isVisible = this.visibleColumns.has(field.name);
            
            const div = document.createElement('div');
            div.className = 'form-check mb-2';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input column-visibility-checkbox';
            checkbox.id = `col-${field.name}`;
            checkbox.dataset.columnName = field.name;
            checkbox.checked = isVisible;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `col-${field.name}`;
            label.textContent = field.label;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
    }

    selectAllColumns() {
        const checkboxes = document.querySelectorAll('.column-visibility-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    deselectAllColumns() {
        const checkboxes = document.querySelectorAll('.column-visibility-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    applyColumnVisibility() {
        const checkboxes = document.querySelectorAll('.column-visibility-checkbox');
        const newVisibleColumns = new Set();

        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                newVisibleColumns.add(checkbox.dataset.columnName);
            }
        });

        // Update visible columns
        this.visibleColumns = newVisibleColumns;
        this.saveVisibleColumns();

        // Apply visibility to grid
        this.applyVisibilityToGrid();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('columnsModal'));
        if (modal) {
            modal.hide();
        }
    }

    applyVisibilityToGrid() {
        const table = document.querySelector('#dynamic-grid-table');
        if (!table) return;

        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        // Store current column widths and order before applying visibility
        const columnWidths = {};
        const currentOrder = [];
        
        const headers = thead.querySelectorAll('th');
        headers.forEach((header, index) => {
            if (index === 0) return; // Skip checkbox column
            
            const columnName = header.dataset.columnName;
            if (columnName) {
                columnWidths[columnName] = header.style.width || '';
                currentOrder.push(columnName);
            }
        });

        // Apply visibility to headers
        headers.forEach((header, index) => {
            if (index === 0) return; // Skip checkbox column
            
            const columnName = header.dataset.columnName;
            const isVisible = this.visibleColumns.has(columnName);
            header.style.display = isVisible ? '' : 'none';
        });

        // Apply visibility to body cells
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (index === 0) return; // Skip checkbox column
                
                const header = headers[index];
                if (header) {
                    const columnName = header.dataset.columnName;
                    const isVisible = this.visibleColumns.has(columnName);
                    cell.style.display = isVisible ? '' : 'none';
                }
            });
        });

        // Restore column widths and ensure order is maintained
        setTimeout(() => {
            // Restore column widths
            headers.forEach((header, index) => {
                if (index === 0) return; // Skip checkbox column
                
                const columnName = header.dataset.columnName;
                if (columnName && columnWidths[columnName]) {
                    header.style.width = columnWidths[columnName];
                }
            });

            // Preserve the current order by ensuring it's saved
            if (window.columnDragger) {
                window.columnDragger.saveColumnOrder();
            }
        }, 10);
    }

    saveVisibleColumns() {
        const storageKey = `grid_visible_columns_${this.tableName}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(this.visibleColumns)));
    }

    loadVisibleColumns() {
        const storageKey = `grid_visible_columns_${this.tableName}`;
        const savedColumns = localStorage.getItem(storageKey);
        
        if (savedColumns) {
            try {
                this.visibleColumns = new Set(JSON.parse(savedColumns));
            } catch (error) {
                console.warn('Failed to load visible columns:', error);
                this.setDefaultVisibleColumns();
            }
        } else {
            this.setDefaultVisibleColumns();
        }
    }

    setDefaultVisibleColumns() {
        // Set all columns as visible by default
        this.visibleColumns = new Set();
        
        // If we have field configs, set all as visible
        if (this.fieldConfigs.length > 0) {
            this.fieldConfigs.forEach(field => {
                this.visibleColumns.add(field.name);
            });
        }
    }

    resetVisibleColumns() {
        const storageKey = `grid_visible_columns_${this.tableName}`;
        localStorage.removeItem(storageKey);
        
        // Set all columns as visible
        this.visibleColumns = new Set();
        if (this.fieldConfigs.length > 0) {
            this.fieldConfigs.forEach(field => {
                this.visibleColumns.add(field.name);
            });
        }
        
        // Apply visibility to show all columns
        this.applyVisibilityToGrid();
    }

    // Method to handle table changes
    onTableChange(newTableName) {
        if (this.tableName !== newTableName) {
            this.tableName = newTableName;
            this.loadVisibleColumns();
        }
    }

    // Method to apply visibility after grid updates
    applyVisibilityAfterGridUpdate() {
        setTimeout(() => {
            // First apply the saved column order
            if (window.columnDragger) {
                window.columnDragger.loadSavedColumnOrder();
            }
            
            // Then apply visibility settings
            setTimeout(() => {
                this.applyVisibilityToGrid();
            }, 50);
        }, 100);
    }
}

// Initialize column visibility manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.columnVisibilityManager = new ColumnVisibilityManager();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColumnVisibilityManager;
} 