// grid.js
// Handles rendering and updating the grid table

export function updateGrid(columns, data, totalCount) {
    const table = document.querySelector('table.table');
    if (!table) return;
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    // Remove all header cells
    while (thead.firstChild) thead.removeChild(thead.firstChild);

    // Add checkbox header
    const thCheckbox = document.createElement('th');
    thCheckbox.style.width = '40px';
    thCheckbox.className = 'no-resize';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.id = 'select-all-checkbox';
    selectAll.title = 'Select all';
    thCheckbox.appendChild(selectAll);
    thead.appendChild(thCheckbox);

    // Add new header cells with resizable structure
    columns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'resizable-column';
        th.setAttribute('data-column-name', col[1]);
        
        const headerContent = document.createElement('div');
        headerContent.className = 'header-content';
        headerContent.textContent = col[0];
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        
        th.appendChild(headerContent);
        th.appendChild(resizeHandle);
        thead.appendChild(th);
    });

    // Remove all body rows
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    // Add new rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-record-id', row.id || '');

        // Checkbox cell
        const tdCheckbox = document.createElement('td');
        const rowCheckbox = document.createElement('input');
        rowCheckbox.type = 'checkbox';
        rowCheckbox.className = 'row-select-checkbox';
        tdCheckbox.appendChild(rowCheckbox);
        tr.appendChild(tdCheckbox);

        columns.forEach(col => {
            const td = document.createElement('td');
            let value = row[col[1]];
            td.textContent = value == null ? '' : value;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // Update total count
    const totalCountEl = document.querySelector('.badge.bg-secondary');
    if (totalCountEl) {
        totalCountEl.textContent = `Total: ${totalCount}`;
    }

    // Reinitialize column resizer after grid update
    if (window.columnResizer) {
        window.columnResizer.attachEventListeners();
        window.columnResizer.loadSavedColumnWidths();
    }
} 