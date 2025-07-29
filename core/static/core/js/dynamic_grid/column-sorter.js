/**
 * Column Sorter for Dynamic Grid
 * Handles column sorting with click events on sort buttons
 */

class ColumnSorter {
    constructor() {
        this.tableName = '';
        this.currentSort = { column: null, direction: null };
        this.init();
    }

    init() {
        this.tableName = document.querySelector('[data-table-name]')?.dataset.tableName || 'default';
        this.attachEventListeners();
        this.loadSortState(); // Load saved sort state on init
    }

    attachEventListeners() {
        document.addEventListener('click', (e) => {
            const sortBtn = e.target.closest('.sort-btn');
            if (sortBtn) {
                e.preventDefault();
                e.stopPropagation();
                this.handleSortClick(sortBtn);
            }
        });
    }

    handleSortClick(sortBtn) {
        try {
            const column = sortBtn.dataset.column;
            const direction = sortBtn.classList.contains('sort-asc') ? 'asc' : 'desc';
            
            if (!column) {
                console.warn('Sort button missing column data');
                return;
            }
            
            this.clearActiveSortButtons();
            sortBtn.classList.add('active');
            this.currentSort = { column, direction };
            this.sortTable(column, direction);
        } catch (error) {
            console.error('Error handling sort click:', error);
        }
    }

    clearActiveSortButtons() {
        document.querySelectorAll('.sort-btn.active').forEach(btn => btn.classList.remove('active'));
    }

    sortTable(column, direction) {
        try {
            const table = document.querySelector('#dynamic-grid-table');
            if (!table) {
                console.warn('Table not found for sorting');
                return;
            }

            const tbody = table.querySelector('tbody');
            if (!tbody) {
                console.warn('Table body not found for sorting');
                return;
            }

            const rows = Array.from(tbody.querySelectorAll('tr'));
            if (rows.length === 0) {
                console.warn('No rows found for sorting');
                return;
            }

            // Sort and reorder - create a copy to avoid modifying original array
            const sortedRows = this.sortRows([...rows], column, direction);
            sortedRows.forEach(row => tbody.appendChild(row));
            
            this.saveSortState(column, direction);
        } catch (error) {
            console.error('Error sorting table:', error);
        }
    }

    sortRows(rows, column, direction) {
        return rows.sort((rowA, rowB) => {
            const valueA = this.parseValue(this.getCellValue(rowA, column));
            const valueB = this.parseValue(this.getCellValue(rowB, column));

            let comparison = 0;
            if (valueA < valueB) comparison = -1;
            else if (valueA > valueB) comparison = 1;

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    getCellValue(row, columnName) {
        const headers = document.querySelectorAll('.resizable-column');
        const columnIndex = Array.from(headers).findIndex(header => 
            header.dataset.columnName === columnName
        );

        if (columnIndex >= 0) {
            const cells = row.querySelectorAll('td');
            const cell = cells[columnIndex + 1]; // +1 for checkbox column
            return cell ? cell.textContent.trim() : '';
        }
        return '';
    }

    parseValue(value) {
        if (!value || value === '') return '';
        
        // Try number first
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) return numValue;

        // Try date
        const dateValue = new Date(value);
        if (!isNaN(dateValue.getTime())) return dateValue.getTime();

        // Return lowercase string
        return value.toLowerCase();
    }

    saveSortState(column, direction) {
        localStorage.setItem(`grid_sort_state_${this.tableName}`, JSON.stringify({ column, direction }));
    }

    loadSortState() {
        const savedState = localStorage.getItem(`grid_sort_state_${this.tableName}`);
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.currentSort = state;
                if (state.column && state.direction) {
                    this.applySavedSort(state.column, state.direction);
                }
            } catch (error) {
                console.warn('Failed to load sort state:', error);
            }
        }
    }

    applySavedSort(column, direction) {
        const sortBtn = document.querySelector(`.sort-btn[data-column="${column}"]`);
        if (sortBtn) {
            const isAsc = direction === 'asc';
            const correctBtn = isAsc ? 
                sortBtn.classList.contains('sort-asc') ? sortBtn : sortBtn.parentNode.querySelector('.sort-asc') :
                sortBtn.classList.contains('sort-desc') ? sortBtn : sortBtn.parentNode.querySelector('.sort-desc');
            
            if (correctBtn) {
                correctBtn.classList.add('active');
                // Also apply the actual sort
                this.sortTable(column, direction);
            }
        }
    }

    resetSort() {
        this.clearActiveSortButtons();
        this.currentSort = { column: null, direction: null };
        localStorage.removeItem(`grid_sort_state_${this.tableName}`);
    }

    onTableChange(newTableName) {
        if (this.tableName !== newTableName) {
            this.tableName = newTableName;
            this.resetSort();
            this.loadSortState();
        }
    }

    applySortAfterGridUpdate() {
        setTimeout(() => {
            if (this.currentSort.column && this.currentSort.direction) {
                this.applySavedSort(this.currentSort.column, this.currentSort.direction);
            }
        }, 100);
    }
}

// Initialize column sorter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.columnSorter = new ColumnSorter();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColumnSorter;
}