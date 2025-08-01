// grid.js
// Handles rendering and updating the grid table

export function updateGrid(tableName, data, columns) {
    const table = document.querySelector('#dynamic-grid-table');
    if (!table) return;

    // Update the table content
    const tbody = table.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = data.map(row => {
            const cells = columns.map(col => {
                const value = row[col[1]] || '';
                return `<td class="align-middle">${value}</td>`;
            }).join('');
            return `<tr data-record-id="${row.id}">${cells}</tr>`;
        }).join('');
    }

    // Update the header content
    const thead = table.querySelector('thead');
    if (thead) {
        const headerRow = thead.querySelector('tr');
        if (headerRow) {
            headerRow.innerHTML = columns.map(col => {
                return `
                    <th class="resizable-column align-middle" data-column-name="${col[1]}">
                        <div class="header-content d-flex align-items-center">
                            <span class="flex-grow-1">${col[0]}</span>
                            <div class="sort-buttons">
                                <button type="button" class="btn btn-sm btn-outline-secondary sort-btn" data-sort="asc" data-column="${col[1]}">
                                    <i class="bi bi-arrow-up"></i>
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-secondary sort-btn" data-sort="desc" data-column="${col[1]}">
                                    <i class="bi bi-arrow-down"></i>
                                </button>
                            </div>
                        </div>
                        <div class="resize-handle"></div>
                    </th>
                `;
            }).join('');
        }
    }

    // Re-apply column states after grid update
    setTimeout(() => {
        // Re-apply column order
        if (window.columnDragger) {
            window.columnDragger.applyColumnOrderAfterGridUpdate();
        }

        // Re-apply column widths
        if (window.columnResizer) {
            window.columnResizer.applyColumnWidthsAfterGridUpdate();
        }

        // Re-apply column visibility
        if (window.columnVisibilityManager) {
            window.columnVisibilityManager.applyVisibilityAfterGridUpdate();
        }

        // Re-apply column sorting
        if (window.columnSorter) {
            window.columnSorter.applySortStateAfterGridUpdate();
        }
    }, 200);
} 