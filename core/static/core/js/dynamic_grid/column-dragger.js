/**
 * Column Dragger for Dynamic Grid
 * Handles column reordering with improved drag and drop functionality
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
        this.dropIndicator = null;
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
        
        // Prevent text selection during drag
        document.addEventListener('selectstart', (e) => {
            if (this.isDragging) {
                e.preventDefault();
            }
        });
    }

    startDrag(e) {
        // Don't start drag if clicking on resize handle
        if (e.target.classList.contains('resize-handle')) {
            return;
        }

        // Don't start drag if clicking on sort buttons
        if (e.target.closest('.sort-buttons') || e.target.closest('.sort-btn')) {
            return;
        }

        // Don't start drag if column resizer is active
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
        this.createDropIndicator();
        this.draggedColumn.classList.add('dragging');
        document.body.classList.add('dragging');
    }

    createGhostElement() {
        // Create a clean ghost element without rotation
        this.ghostElement = this.draggedColumn.cloneNode(true);
        this.ghostElement.classList.add('ghost-column');
        this.ghostElement.style.position = 'fixed';
        this.ghostElement.style.zIndex = '9999';
        this.ghostElement.style.opacity = '0.7';
        this.ghostElement.style.pointerEvents = 'none';
        this.ghostElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        this.ghostElement.style.border = '2px solid #007bff';
        this.ghostElement.style.borderRadius = '4px';
        this.ghostElement.style.backgroundColor = '#ffffff';
        
        // Remove resize handle from ghost
        const resizeHandle = this.ghostElement.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.remove();
        }
        
        // Position ghost at mouse position
        this.ghostElement.style.left = `${this.dragStartX - this.ghostElement.offsetWidth / 2}px`;
        this.ghostElement.style.top = `${this.dragStartY - this.ghostElement.offsetHeight / 2}px`;
        
        document.body.appendChild(this.ghostElement);
    }

    createDropIndicator() {
        this.dropIndicator = document.createElement('div');
        this.dropIndicator.className = 'drop-indicator';
        this.dropIndicator.style.position = 'absolute';
        this.dropIndicator.style.width = '3px';
        this.dropIndicator.style.height = '100%';
        this.dropIndicator.style.backgroundColor = '#007bff';
        this.dropIndicator.style.zIndex = '9998';
        this.dropIndicator.style.pointerEvents = 'none';
        this.dropIndicator.style.display = 'none';
        
        const table = document.querySelector('#dynamic-grid-table');
        if (table) {
            table.appendChild(this.dropIndicator);
        }
    }

    drag(e) {
        if (!this.isDragging || !this.ghostElement) return;

        // Update ghost position
        this.ghostElement.style.left = `${e.clientX - this.ghostElement.offsetWidth / 2}px`;
        this.ghostElement.style.top = `${e.clientY - this.ghostElement.offsetHeight / 2}px`;
        
        // Update drop indicator
        this.updateDropIndicator(e.clientX);
    }

    updateDropIndicator(mouseX) {
        if (!this.dropIndicator) return;

        const headers = document.querySelectorAll('.resizable-column');
        let bestPosition = null;
        let minDistance = Infinity;

        // Clear previous highlights
        this.clearColumnHighlights();

        headers.forEach((header, index) => {
            if (header.dataset.columnName === this.draggedColumnName) return;

            const rect = header.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const distance = Math.abs(mouseX - centerX);

            if (distance < minDistance) {
                minDistance = distance;
                bestPosition = {
                    header: header,
                    index: index,
                    rect: rect
                };
            }
        });

        if (bestPosition && minDistance < bestPosition.rect.width) {
            const rect = bestPosition.rect;
            const tableRect = document.querySelector('#dynamic-grid-table').getBoundingClientRect();
            
            // Position indicator at the appropriate edge of the target column
            let indicatorX;
            if (mouseX < rect.left + rect.width / 2) {
                // Drop before the column
                indicatorX = rect.left - tableRect.left;
                this.highlightTargetColumn(bestPosition.header, 'before');
            } else {
                // Drop after the column
                indicatorX = rect.right - tableRect.left;
                this.highlightTargetColumn(bestPosition.header, 'after');
            }

            this.dropIndicator.style.left = `${indicatorX}px`;
            this.dropIndicator.style.display = 'block';
        } else {
            this.dropIndicator.style.display = 'none';
        }
    }

    highlightTargetColumn(header, position) {
        if (!header) return;

        // Add highlight class
        header.classList.add('drop-target');
        
        // Add position-specific class
        if (position === 'before') {
            header.classList.add('drop-target-before');
        } else {
            header.classList.add('drop-target-after');
        }

        // Add highlight to corresponding body cells
        const columnName = header.dataset.columnName;
        const table = document.querySelector('#dynamic-grid-table');
        if (table) {
            const tbody = table.querySelector('tbody');
            const rows = tbody.querySelectorAll('tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const headerIndex = Array.from(document.querySelectorAll('.resizable-column'))
                    .findIndex(h => h.dataset.columnName === columnName);
                
                if (headerIndex >= 0 && cells[headerIndex + 1]) { // +1 for checkbox column
                    cells[headerIndex + 1].classList.add('drop-target');
                    if (position === 'before') {
                        cells[headerIndex + 1].classList.add('drop-target-before');
                    } else {
                        cells[headerIndex + 1].classList.add('drop-target-after');
                    }
                }
            });
        }
    }

    clearColumnHighlights() {
        // Clear header highlights
        const headers = document.querySelectorAll('.resizable-column');
        headers.forEach(header => {
            header.classList.remove('drop-target', 'drop-target-before', 'drop-target-after');
        });

        // Clear body cell highlights
        const cells = document.querySelectorAll('td');
        cells.forEach(cell => {
            cell.classList.remove('drop-target', 'drop-target-before', 'drop-target-after');
        });
    }

    stopDrag() {
        if (!this.isDragging) return;

        this.isDragging = false;
        const targetPosition = this.findTargetPosition();
        
        if (targetPosition) {
            this.reorderColumns(targetPosition);
        }

        this.cleanup();
    }

    findTargetPosition() {
        if (!this.ghostElement) return null;

        const mouseX = parseFloat(this.ghostElement.style.left) + this.ghostElement.offsetWidth / 2;
        const headers = document.querySelectorAll('.resizable-column');
        let bestPosition = null;
        let minDistance = Infinity;

        headers.forEach((header, index) => {
            if (header.dataset.columnName === this.draggedColumnName) return;

            const rect = header.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const distance = Math.abs(mouseX - centerX);

            if (distance < minDistance) {
                minDistance = distance;
                bestPosition = {
                    columnName: header.dataset.columnName,
                    index: index,
                    rect: rect,
                    dropBefore: mouseX < centerX
                };
            }
        });

        // Accept drop if within reasonable distance
        if (bestPosition && minDistance < bestPosition.rect.width) {
            return bestPosition;
        }

        return null;
    }

    reorderColumns(targetPosition) {
        try {
            const table = document.querySelector('#dynamic-grid-table');
            if (!table) return;

            const thead = table.querySelector('thead tr');
            const tbody = table.querySelector('tbody');
            
            if (!thead || !tbody) return;

            const allHeaders = Array.from(thead.children);
            const sourceIndex = allHeaders.findIndex(header => header.dataset.columnName === this.draggedColumnName);
            const targetIndex = allHeaders.findIndex(header => header.dataset.columnName === targetPosition.columnName);

            if (sourceIndex === -1 || targetIndex === -1) return;

            // Calculate final target index
            let finalTargetIndex = targetIndex;
            if (targetPosition.dropBefore && sourceIndex > targetIndex) {
                finalTargetIndex = targetIndex;
            } else if (!targetPosition.dropBefore && sourceIndex < targetIndex) {
                finalTargetIndex = targetIndex + 1;
            } else if (targetPosition.dropBefore && sourceIndex < targetIndex) {
                finalTargetIndex = targetIndex - 1;
            } else if (!targetPosition.dropBefore && sourceIndex > targetIndex) {
                finalTargetIndex = targetIndex;
            }

            // Don't reorder if dropping in the same position
            if (sourceIndex === finalTargetIndex) return;

            // Reorder headers
            const newHeaderOrder = [...allHeaders];
            const [movedHeader] = newHeaderOrder.splice(sourceIndex, 1);
            newHeaderOrder.splice(finalTargetIndex, 0, movedHeader);

            newHeaderOrder.forEach(header => {
                thead.appendChild(header);
            });

            // Reorder body cells
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                const newCellOrder = [...cells];
                const [movedCell] = newCellOrder.splice(sourceIndex, 1);
                newCellOrder.splice(finalTargetIndex, 0, movedCell);

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

        if (this.dropIndicator) {
            this.dropIndicator.remove();
            this.dropIndicator = null;
        }

        if (this.draggedColumn) {
            this.draggedColumn.classList.remove('dragging');
        }

        // Clear all column highlights
        this.clearColumnHighlights();

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
                
                // Validate and complete the saved order
                const validColumnOrder = columnOrder.filter(colName => 
                    currentColumnNames.includes(colName)
                );
                
                // Add any missing columns
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
        
        // Create header map
        const headerMap = {};
        currentHeaders.forEach(header => {
            headerMap[header.dataset.columnName] = header;
        });

        // Reorder headers
        columnOrder.forEach(columnName => {
            if (headerMap[columnName]) {
                const header = headerMap[columnName];
                thead.appendChild(header);
            }
        });

        // Reorder body cells
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const dataCells = cells.slice(1); // Skip checkbox column
            
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

// Initialize column dragger when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.columnDragger = new ColumnDragger();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColumnDragger;
} 