/**
 * Column Dragger for Dynamic Grid
 * Handles column reordering with drag and drop functionality
 */

class ColumnDragger {
    constructor() {
        this.isDragging = false;
        this.draggedColumn = null;
        this.draggedColumnName = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.ghostElement = null;
        this.tableName = '';
        this.init();
    }

    init() {
        this.tableName = document.querySelector('[data-table-name]')?.dataset.tableName || 'default';
        this.attachEventListeners();
        this.loadSavedColumnOrder();
    }

    attachEventListeners() {
        const columnHeaders = document.querySelectorAll('.resizable-column');
        
        columnHeaders.forEach(header => {
            header.addEventListener('mousedown', (e) => this.startDrag(e));
        });

        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
        
        document.addEventListener('selectstart', (e) => {
            if (this.isDragging) {
                e.preventDefault();
            }
        });
    }

    startDrag(e) {
        if (e.target.classList.contains('resize-handle')) {
            return;
        }

        if (window.columnResizer && window.columnResizer.isResizing) {
            return;
        }

        e.preventDefault();
        this.isDragging = true;
        this.draggedColumn = e.currentTarget;
        this.draggedColumnName = this.draggedColumn.dataset.columnName;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        this.createGhostElement();
        this.draggedColumn.classList.add('dragging');
        document.body.classList.add('dragging');
        this.addDropZones();
    }

    createGhostElement() {
        this.ghostElement = this.draggedColumn.cloneNode(true);
        this.ghostElement.classList.add('ghost-column');
        this.ghostElement.style.position = 'fixed';
        this.ghostElement.style.zIndex = '9999';
        this.ghostElement.style.opacity = '0.8';
        this.ghostElement.style.pointerEvents = 'none';
        this.ghostElement.style.transform = 'rotate(5deg)';
        this.ghostElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        this.ghostElement.style.left = `${this.dragStartX - this.ghostElement.offsetWidth / 2}px`;
        this.ghostElement.style.top = `${this.dragStartY - this.ghostElement.offsetHeight / 2}px`;
        
        const resizeHandle = this.ghostElement.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.remove();
        }
        
        document.body.appendChild(this.ghostElement);
    }

    addDropZones() {
        const headers = document.querySelectorAll('.resizable-column');
        headers.forEach(header => {
            if (header !== this.draggedColumn) {
                header.classList.add('drop-zone');
            }
        });
    }

    drag(e) {
        if (!this.isDragging || !this.ghostElement) return;

        this.ghostElement.style.left = `${e.clientX - this.ghostElement.offsetWidth / 2}px`;
        this.ghostElement.style.top = `${e.clientY - this.ghostElement.offsetHeight / 2}px`;
        this.highlightDropZones(e.clientX);
    }

    highlightDropZones(mouseX) {
        const headers = document.querySelectorAll('.resizable-column');
        headers.forEach(header => {
            if (header !== this.draggedColumn) {
                const rect = header.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                
                if (Math.abs(mouseX - centerX) < rect.width / 2) {
                    header.classList.add('drop-highlight');
                } else {
                    header.classList.remove('drop-highlight');
                }
            }
        });
    }

    stopDrag() {
        if (!this.isDragging) return;

        this.isDragging = false;
        const targetColumn = this.findTargetColumn();
        
        if (targetColumn && targetColumn.dataset.columnName !== this.draggedColumnName) {
            this.reorderColumns(this.draggedColumnName, targetColumn.dataset.columnName);
        }

        this.cleanup();
    }

    findTargetColumn() {
        const headers = document.querySelectorAll('.resizable-column');
        let targetColumn = null;
        let minDistance = Infinity;

        const currentMouseX = this.ghostElement ? 
            parseFloat(this.ghostElement.style.left) + this.ghostElement.offsetWidth / 2 : 
            this.dragStartX;

        headers.forEach((header, index) => {
            if (header.dataset.columnName !== this.draggedColumnName) {
                const rect = header.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const distance = Math.abs(currentMouseX - centerX);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    targetColumn = header;
                }
            }
        });

        return targetColumn;
    }

    reorderColumns(sourceColumnName, targetColumnName) {
        try {
            const table = document.querySelector('#dynamic-grid-table');
            if (!table) return;

            const thead = table.querySelector('thead tr');
            const tbody = table.querySelector('tbody');
            
            if (!thead || !tbody) return;

            const allHeaders = Array.from(thead.children);
            const sourceIndex = allHeaders.findIndex(header => header.dataset.columnName === sourceColumnName);
            const targetIndex = allHeaders.findIndex(header => header.dataset.columnName === targetColumnName);

            if (sourceIndex === -1 || targetIndex === -1) return;

            const newHeaderOrder = [...allHeaders];
            const [movedHeader] = newHeaderOrder.splice(sourceIndex, 1);
            newHeaderOrder.splice(targetIndex, 0, movedHeader);

            newHeaderOrder.forEach(header => {
                thead.appendChild(header);
            });

            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                const newCellOrder = [...cells];
                const [movedCell] = newCellOrder.splice(sourceIndex, 1);
                newCellOrder.splice(targetIndex, 0, movedCell);

                newCellOrder.forEach(cell => {
                    row.appendChild(cell);
                });
            });

            this.saveColumnOrder();
        } catch (error) {
            console.error('Error during column reordering:', error);
        }
    }

    cleanup() {
        if (this.ghostElement) {
            document.body.removeChild(this.ghostElement);
            this.ghostElement = null;
        }

        if (this.draggedColumn) {
            this.draggedColumn.classList.remove('dragging');
        }

        const headers = document.querySelectorAll('.resizable-column');
        headers.forEach(header => {
            header.classList.remove('drop-zone', 'drop-highlight');
        });

        document.body.classList.remove('dragging');
        this.draggedColumn = null;
        this.draggedColumnName = null;
    }

    saveColumnOrder() {
        const headers = document.querySelectorAll('.resizable-column');
        const columnOrder = [];
        
        headers.forEach(header => {
            const columnName = header.dataset.columnName;
            if (columnName) {
                columnOrder.push(columnName);
            }
        });

        const storageKey = `grid_column_order_${this.tableName}`;
        localStorage.setItem(storageKey, JSON.stringify(columnOrder));
    }

    loadSavedColumnOrder() {
        const storageKey = `grid_column_order_${this.tableName}`;
        const savedOrder = localStorage.getItem(storageKey);
        
        if (savedOrder) {
            try {
                const columnOrder = JSON.parse(savedOrder);
                const currentHeaders = document.querySelectorAll('.resizable-column');
                const currentColumnNames = Array.from(currentHeaders).map(h => h.dataset.columnName);
                
                const validColumnOrder = columnOrder.filter(colName => 
                    currentColumnNames.includes(colName)
                );
                
                currentColumnNames.forEach(colName => {
                    if (!validColumnOrder.includes(colName)) {
                        validColumnOrder.push(colName);
                    }
                });
                
                if (validColumnOrder.length > 0) {
                    this.applyColumnOrder(validColumnOrder);
                }
            } catch (error) {
                console.warn('Failed to load saved column order:', error);
            }
        }
    }

    applyColumnOrder(columnOrder) {
        const table = document.querySelector('#dynamic-grid-table');
        if (!table) return;

        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        
        if (!thead || !tbody) return;

        const currentHeaders = Array.from(thead.querySelectorAll('.resizable-column'));
        if (currentHeaders.length === 0) return;
        
        const headerMap = {};
        currentHeaders.forEach(header => {
            headerMap[header.dataset.columnName] = header;
        });

        columnOrder.forEach(columnName => {
            if (headerMap[columnName]) {
                const header = headerMap[columnName];
                thead.appendChild(header);
            }
        });

        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const dataCells = cells.slice(1);
            
            const cellMap = {};
            currentHeaders.forEach((header, index) => {
                if (dataCells[index]) {
                    cellMap[header.dataset.columnName] = dataCells[index];
                }
            });

            columnOrder.forEach(columnName => {
                if (cellMap[columnName]) {
                    const cell = cellMap[columnName];
                    row.appendChild(cell);
                }
            });
        });
    }

    resetColumnOrder() {
        const storageKey = `grid_column_order_${this.tableName}`;
        localStorage.removeItem(storageKey);
    }

    onTableChange(newTableName) {
        if (this.tableName !== newTableName) {
            this.tableName = newTableName;
            this.loadSavedColumnOrder();
        }
    }

    applyColumnOrderWithDelay() {
        setTimeout(() => {
            this.loadSavedColumnOrder();
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.columnDragger = new ColumnDragger();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColumnDragger;
} 