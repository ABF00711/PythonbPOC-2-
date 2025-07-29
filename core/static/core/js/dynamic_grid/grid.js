// grid.js
// Handles rendering and updating the grid table

export function updateGrid(tableName, data, columns) {
    const table = document.querySelector('#dynamic-grid-table');
    if (!table) return;

    // Update table headers
    const thead = table.querySelector('thead tr');
    thead.innerHTML = `
        <th style="width:40px;" class="no-resize">
            <input type="checkbox" id="select-all-checkbox" title="Select all">
        </th>
        ${columns.map(col => `
            <th class="resizable-column" data-column-name="${col[1]}">
                <div class="header-content">
                    <span class="column-title">${col[0]}</span>
                    <div class="sort-buttons">
                        <button type="button" class="btn btn-sm btn-outline-secondary sort-btn sort-asc" 
                                data-column="${col[1]}" title="Sort ascending">
                            <i class="bi bi-arrow-up"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary sort-btn sort-desc" 
                                data-column="${col[1]}" title="Sort descending">
                            <i class="bi bi-arrow-down"></i>
                        </button>
                    </div>
                </div>
                <div class="resize-handle"></div>
            </th>
        `).join('')}
    `;

    // Update table body
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = data.length > 0 ? 
        data.map(row => `
            <tr data-record-id="${row.id || ''}">
                <td><input type="checkbox" class="row-select-checkbox"></td>
                ${columns.map(col => `
                    <td>${row[col[1]] || ''}</td>
                `).join('')}
            </tr>
        `).join('') : 
        `<tr><td colspan="${columns.length + 1}" class="text-center">No data found.</td></tr>`;

    // Re-attach event handlers
    attachGridEventHandlers(tableName, columns);

    // Re-initialize column functionality
    if (window.columnResizer) {
        window.columnResizer.attachEventListeners();
        window.columnResizer.loadSavedColumnWidths();
    }

    if (window.columnDragger) {
        window.columnDragger.attachEventListeners();
        window.columnDragger.applyColumnOrderWithDelay();
    }

    if (window.columnVisibilityManager) {
        window.columnVisibilityManager.applyVisibilityAfterGridUpdate();
    }

    if (window.columnSorter) {
        window.columnSorter.applySortAfterGridUpdate();
    }
} 