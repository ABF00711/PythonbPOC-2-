/**
 * Column Resizer for Dynamic Grid
 * Handles interactive column resizing with drag handles
 */

class ColumnResizer {
    constructor() {
        this.isResizing = false;
        this.currentColumn = null;
        this.startX = 0;
        this.startWidth = 0;
        this.tableName = '';
        this.init();
    }

    init() {
        this.tableName = document.querySelector('[data-table-name]')?.dataset.tableName || 'default';
        this.attachEventListeners();
        this.loadSavedColumnWidths();
    }

    attachEventListeners() {
        const resizeHandles = document.querySelectorAll('.resize-handle');
        
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => this.startResize(e));
        });

        document.addEventListener('mousemove', (e) => this.resize(e));
        document.addEventListener('mouseup', () => this.stopResize());
        
        // Prevent text selection during resize
        document.addEventListener('selectstart', (e) => {
            if (this.isResizing) {
                e.preventDefault();
            }
        });
    }

    startResize(e) {
        // Prevent resize if we're already dragging
        if (window.columnDragger && window.columnDragger.isDragging) {
            return;
        }

        e.preventDefault();
        this.isResizing = true;
        this.currentColumn = e.target.closest('.resizable-column');
        this.startX = e.clientX;
        this.startWidth = this.currentColumn.offsetWidth;

        // Add visual feedback
        this.currentColumn.classList.add('resizing');
        e.target.classList.add('resizing');
        
        // Add global resizing class to body
        document.body.classList.add('resizing');
    }

    resize(e) {
        if (!this.isResizing || !this.currentColumn) return;

        const deltaX = e.clientX - this.startX;
        const newWidth = Math.max(100, this.startWidth + deltaX); // Minimum width of 100px
        
        this.currentColumn.style.width = `${newWidth}px`;
        
        // Update the resize handle position
        const handle = this.currentColumn.querySelector('.resize-handle');
        if (handle) {
            handle.style.right = '0px';
        }
    }

    stopResize() {
        if (!this.isResizing || !this.currentColumn) return;

        this.isResizing = false;
        
        // Remove visual feedback
        this.currentColumn.classList.remove('resizing');
        const handle = this.currentColumn.querySelector('.resize-handle');
        if (handle) {
            handle.classList.remove('resizing');
        }
        
        // Remove global resizing class
        document.body.classList.remove('resizing');

        // Save the new width
        this.saveColumnWidths();
        
        this.currentColumn = null;
    }

    saveColumnWidths() {
        const columns = document.querySelectorAll('.resizable-column');
        const columnWidths = {};
        
        columns.forEach(column => {
            const columnName = column.dataset.columnName;
            const width = column.offsetWidth;
            columnWidths[columnName] = width;
        });

        const storageKey = `grid_column_widths_${this.tableName}`;
        localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    }

    loadSavedColumnWidths() {
        const storageKey = `grid_column_widths_${this.tableName}`;
        const savedWidths = localStorage.getItem(storageKey);
        
        if (savedWidths) {
            try {
                const columnWidths = JSON.parse(savedWidths);
                const columns = document.querySelectorAll('.resizable-column');
                
                columns.forEach(column => {
                    const columnName = column.dataset.columnName;
                    if (columnWidths[columnName]) {
                        column.style.width = `${columnWidths[columnName]}px`;
                    }
                });
            } catch (error) {
                console.warn('Failed to load saved column widths:', error);
            }
        }
    }

    resetColumnWidths() {
        const columns = document.querySelectorAll('.resizable-column');
        columns.forEach(column => {
            column.style.width = '';
        });
        
        // Clear saved widths
        const storageKey = `grid_column_widths_${this.tableName}`;
        localStorage.removeItem(storageKey);
    }

    // Method to apply column widths after grid updates
    applyColumnWidthsAfterGridUpdate() {
        setTimeout(() => {
            this.loadSavedColumnWidths();
        }, 100);
    }

    // Method to restore column widths on page load
    async restoreColumnWidths() {
        console.log('Restoring column widths for table:', this.tableName);
        
        try {
            // Load and apply saved column widths
            this.loadSavedColumnWidths();
            
            console.log('Column widths restored successfully');
        } catch (error) {
            console.error('Error restoring column widths:', error);
        }
    }
}

// Initialize column resizer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.columnResizer = new ColumnResizer();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColumnResizer;
} 