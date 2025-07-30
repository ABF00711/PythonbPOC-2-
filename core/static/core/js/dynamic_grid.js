// dynamic_grid.js
// Main orchestrator for the dynamic grid UI
import { updateGrid } from './dynamic_grid/grid.js';
import { createRecord, updateRecord, deleteRecords, searchRecords, resetGrid } from './dynamic_grid/crud.js';
import { formatDateYMDToMDY, showToast } from './dynamic_grid/utils.js';
import { SearchPatternManager } from './dynamic_grid/search_patterns.js';

// Assumes modal.js is loaded and exposes window.renderFormFields, window.showEditModal, window.renderSearchFields

document.addEventListener('DOMContentLoaded', function() {
    const addBtn = document.getElementById('add-record-btn');
    const modal = new bootstrap.Modal(document.getElementById('createModal'));
    const formFieldsDiv = document.getElementById('dynamic-form-fields');
    const form = document.getElementById('dynamic-create-form');
    
    // Get table name with proper error handling
    const tableNameElement = document.querySelector('.dynamic-grid-wrapper[data-table-name]');
    if (!tableNameElement) {
        console.error('Table name element not found');
        return;
    }
    const tableName = tableNameElement.dataset.tableName;
    if (!tableName) {
        console.error('Table name not found in data attribute');
        return;
    }
    
    let fieldConfigs = [];
    
    // Initialize search pattern manager (will be initialized when search modal is shown)
    let searchPatternManager = null;

    if (addBtn) {
        addBtn.addEventListener('click', function() {
            fetch(`/api/fields/${tableName}/`)
                .then(res => res.json())
                .then(data => {
                    fieldConfigs = data.fields;
                    window.renderFormFields(fieldConfigs, formFieldsDiv, tableName);
                    modal.show();
                })
                .catch(err => {
                    console.error('Error fetching fields:', err);
                    alert('Failed to load form fields.');
                });
        });
    }

    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            // Clear previous errors
            fieldConfigs.forEach(f => {
                const err = document.getElementById(`error_${f.name}`);
                if (err) err.textContent = '';
            });
            const formData = {};
            let firstInvalid = null;
            let hasError = false;
            fieldConfigs.forEach(f => {
                let val = form.querySelector(`[name="${f.name}"]`).value;
                if ((['select', 'autocomplete', 'dropdown'].includes(f.type)) && val && isNaN(val)) {
                    val = val.trim();
                }
                // Mandatory validation
                if (f.mandatory && (!val || val.trim() === '')) {
                    const err = document.getElementById(`error_${f.name}`);
                    if (err) err.textContent = 'This field is required.';
                    form.querySelector(`[name="${f.name}"]`).classList.add('is-invalid');
                    if (!firstInvalid) firstInvalid = form.querySelector(`[name="${f.name}"]`);
                    hasError = true;
                } else {
                    form.querySelector(`[name="${f.name}"]`).classList.remove('is-invalid');
                }
                formData[f.name] = val;
            });
            if (hasError) {
                if (firstInvalid) firstInvalid.focus();
                return;
            }
            const data = await createRecord(tableName, formData);
            if (data.success) {
                modal.hide();
                location.reload(); // For now, reload grid. Can be replaced with AJAX update.
            } else if (data.errors) {
                Object.entries(data.errors).forEach(([field, msg]) => {
                    const err = document.getElementById(`error_${field}`);
                    if (err) err.textContent = msg;
                });
            }
        });
    }

    // Add double-click event handler to grid rows for Edit
    const table = document.querySelector('table.table');
    if (table) {
        table.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('dblclick', function() {
                const recordId = row.getAttribute('data-record-id');
                if (!recordId) return;
                const fetchFields = fieldConfigs.length === 0
                    ? fetch(`/api/fields/${tableName}/`).then(res => res.json()).then(data => { fieldConfigs = data.fields; })
                    : Promise.resolve();
                fetchFields.then(() => {
                    fetch(`/api/record/${tableName}/${recordId}/`)
                        .then(res => res.json())
                        .then(recordData => {
                            window.showEditModal(fieldConfigs, recordData, tableName);
                        });
                });
            });
        });
    }

    // Edit modal form submission (global handler)
    document.addEventListener('submit', async function(e) {
        const form = e.target;
        if (form && form.id === 'dynamic-edit-form') {
            e.preventDefault();
            const modal = form.closest('.modal');
            const recordId = modal && modal.getAttribute('data-record-id');
            if (!recordId) return;
            
            // Ensure fieldConfigs is loaded
            let currentFieldConfigs = fieldConfigs;
            if (!currentFieldConfigs || currentFieldConfigs.length === 0) {
                try {
                    const response = await fetch(`/api/fields/${tableName}/`);
                    const data = await response.json();
                    currentFieldConfigs = data.fields;
                    fieldConfigs = currentFieldConfigs; // Update the global variable
                } catch (error) {
                    console.error('Error fetching field configs for edit:', error);
                    showToast('Error loading form fields. Please try again.', 'error');
                    return;
                }
            }
            
            // Clear previous errors
            currentFieldConfigs.forEach(f => {
                const err = form.querySelector(`#edit_error_${f.name}`);
                if (err) err.textContent = '';
                const input = form.querySelector(`[name="${f.name}"]`);
                if (input) input.classList.remove('is-invalid');
            });
            
            // Collect form data and validate mandatory fields
            const formData = {};
            let firstInvalid = null;
            let hasError = false;
            currentFieldConfigs.forEach(f => {
                if (f.name.toLowerCase() === 'id') return;
                const input = form.querySelector(`[name="${f.name}"]`);
                let val = input ? input.value : '';
                if (f.mandatory && (!val || val.trim() === '')) {
                    const err = form.querySelector(`#edit_error_${f.name}`);
                    if (err) err.textContent = 'This field is required.';
                    if (input) input.classList.add('is-invalid');
                    if (!firstInvalid && input) firstInvalid = input;
                    hasError = true;
                } else if (input) {
                    input.classList.remove('is-invalid');
                }
                formData[f.name] = val;
            });
            
            if (hasError) {
                if (firstInvalid) firstInvalid.focus();
                return;
            }
            
            const data = await updateRecord(tableName, recordId, formData);
            if (data.success) {
                bootstrap.Modal.getInstance(modal).hide();
                location.reload();
            } else if (data.error) {
                showToast('Error: ' + data.error, 'error');
            }
        }
    }, true);

    // Bulk select/deselect logic for grid checkboxes
    function updateDeleteButtonState() {
        const anyChecked = document.querySelectorAll('.row-select-checkbox:checked').length > 0;
        document.getElementById('delete-selected-btn').disabled = !anyChecked;
    }

    const selectAll = document.getElementById('select-all-checkbox');
    const deleteBtn = document.getElementById('delete-selected-btn');
    const bulkDeleteModal = document.getElementById('bulkDeleteModal');
    const bulkDeleteMsg = document.getElementById('bulk-delete-message');
    const confirmBulkDeleteBtn = document.getElementById('confirm-bulk-delete-btn');

    if (selectAll && table) {
        selectAll.addEventListener('change', function() {
            const checkboxes = table.querySelectorAll('.row-select-checkbox');
            checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
            updateDeleteButtonState();
        });
        table.addEventListener('change', function(e) {
            if (e.target.classList.contains('row-select-checkbox')) {
                const checkboxes = table.querySelectorAll('.row-select-checkbox');
                const checked = table.querySelectorAll('.row-select-checkbox:checked');
                selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                updateDeleteButtonState();
            }
        });
    }

    // Bulk Delete Button click
    if (deleteBtn && bulkDeleteModal && bulkDeleteMsg && confirmBulkDeleteBtn) {
        deleteBtn.addEventListener('click', function() {
            const checked = table.querySelectorAll('.row-select-checkbox:checked');
            const count = checked.length;
            bulkDeleteMsg.textContent = `Are you sure you want to permanently delete ${count} selected record${count > 1 ? 's' : ''}?`;
            const modal = new bootstrap.Modal(bulkDeleteModal);
            modal.show();
        });

        confirmBulkDeleteBtn.addEventListener('click', async function() {
            const checked = table.querySelectorAll('.row-select-checkbox:checked');
            const ids = Array.from(checked).map(cb => cb.closest('tr').getAttribute('data-record-id'));
            if (!ids.length || !tableName) return;
            const data = await deleteRecords(tableName, ids);
            if (data.success) {
                // Hide the confirmation modal
                const modalInstance = bootstrap.Modal.getInstance(bulkDeleteModal);
                if (modalInstance) modalInstance.hide();
                showToast('Records deleted successfully!', 'success');
                // Remove deleted rows from DOM
                data.deleted.forEach(id => {
                    const row = table.querySelector(`tr[data-record-id="${id}"]`);
                    if (row) row.remove();
                });
                // Update total count badge
                const totalBadge = document.querySelector('.badge.bg-secondary.fs-5');
                if (totalBadge) {
                    const current = parseInt(totalBadge.textContent.replace(/\D/g, ''));
                    const newTotal = Math.max(0, current - data.deleted.length);
                    totalBadge.textContent = `Total: ${newTotal}`;
                }
                // If no rows left, show 'No data found'
                const tbody = table.querySelector('tbody');
                if (tbody && !tbody.querySelector('tr')) {
                    const colCount = table.querySelectorAll('thead th').length;
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    td.colSpan = colCount;
                    td.className = 'text-center';
                    td.textContent = 'No data found.';
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                }
                // Deselect select-all and disable delete button
                if (selectAll) selectAll.checked = false;
                if (deleteBtn) deleteBtn.disabled = true;
            } else if (data.error) {
                showToast('Error: ' + data.error, 'error');
            }
        });
    }

    // Search Button click
    const searchBtn = document.getElementById('search-grid-btn');
    const searchModal = document.getElementById('searchModal');
    const searchFieldsContainer = document.getElementById('dynamic-search-fields');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    const executeSearchBtn = document.getElementById('execute-search-btn');

    if (searchBtn && searchModal) {
        searchBtn.addEventListener('click', function() {
            fetch(`/api/fields/${tableName}/`)
                .then(res => res.json())
                .then(data => {
                    if (data.fields) {
                        window.renderSearchFields(data.fields, searchFieldsContainer, tableName);
                        const modal = new bootstrap.Modal(searchModal);
                        modal.show();
                        
                        // Initialize search pattern manager after modal is shown and fields are rendered
                        if (tableName) {
                            // Use setTimeout to ensure modal is fully rendered
                            setTimeout(() => {
                                if (!searchPatternManager) {
                                    searchPatternManager = new SearchPatternManager(tableName);
                                } else {
                                    // Re-initialize if it already exists to refresh patterns
                                    searchPatternManager.init();
                                }
                            }, 100);
                        }
                    }
                });
        });
    }

    // Reset Search Button
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', function() {
            const operatorSelects = searchModal.querySelectorAll('.operator-select');
            const searchInputs = searchModal.querySelectorAll('.search-input');
            const sortFieldSelects = searchModal.querySelectorAll('.sort-field-select');
            const sortDirectionSelects = searchModal.querySelectorAll('.sort-direction-select');
            
            operatorSelects.forEach(select => select.value = '');
            searchInputs.forEach(input => input.value = '');
            sortFieldSelects.forEach(select => select.value = '');
            sortDirectionSelects.forEach(select => select.value = '');
            
            // Reset search pattern form using the manager
            if (searchPatternManager) {
                searchPatternManager.resetForm();
            }
        });
    }

    // Execute Search Button
    if (executeSearchBtn) {
        executeSearchBtn.addEventListener('click', async function() {
            const searchData = {};
            const operatorSelects = searchModal.querySelectorAll('.operator-select');
            const searchInputs = searchModal.querySelectorAll('.search-input');

            operatorSelects.forEach((select, index) => {
                const fieldName = select.getAttribute('data-field');
                const operator = select.value;
                let value = '';
                const input = searchInputs[index];
                if (input) {
                    if (input.tagName === 'SELECT') {
                        value = $(input).val();
                    } else {
                        value = input.value;
                    }
                }
                if (operator && value) {
                    searchData[fieldName] = { operator, value };
                }
            });

            // --- Collect sort info ---
            const sort = [];
            const sortFields = searchModal.querySelectorAll('.sort-field-select');
            const sortDirections = searchModal.querySelectorAll('.sort-direction-select');
            for (let i = 0; i < sortFields.length; i++) {
                const field = sortFields[i].value;
                const direction = sortDirections[i].value;
                if (field && direction) {
                    sort.push({ field, direction });
                }
            }
            // Add sort array to searchData
            searchData.sort = sort;

            const data = await searchRecords(tableName, searchData);
            if (data && data.data) {
                updateGrid(tableName, data.data, data.columns);
                showToast('Search complete', 'success');
                attachGridEventHandlers(tableName, fieldConfigs);
                
                // Show reset grid button after search
                const resetGridBtn = document.getElementById('reset-grid-btn');
                if (resetGridBtn) {
                    resetGridBtn.style.display = 'inline-block';
                }
            } else {
                showToast('No results found', 'warning');
            }
            // Close modal
            const modalInstance = bootstrap.Modal.getInstance(searchModal);
            if (modalInstance) modalInstance.hide();
        });
    }

    // Reset Grid Button
    const resetGridBtn = document.getElementById('reset-grid-btn');
    if (resetGridBtn) {
        resetGridBtn.addEventListener('click', async function() {
            try {
                // Show loading state
                resetGridBtn.disabled = true;
                resetGridBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
                
                // Fetch original data from the API
                const data = await resetGrid(tableName);
                if (data && data.data) {
                    // Update grid with original data
                    updateGrid(tableName, data.data, data.columns);
                    // Hide reset button
                    resetGridBtn.style.display = 'none';
                    
                    // Re-attach event handlers
                    attachGridEventHandlers(tableName, fieldConfigs);
                        
                    showToast('Grid reset to original data', 'success');
                } else {
                    throw new Error('Failed to fetch original data');
                }
            } catch (error) {
                console.error('Error resetting grid:', error);
                showToast('Error resetting grid. Please refresh the page.', 'error');
            } finally {
                // Reset button state
                resetGridBtn.disabled = false;
                resetGridBtn.innerHTML = 'Reset Grid';
            }
        });
    }

    // After DOMContentLoaded, update grid display for birthday fields
    if (window.GRID_COLUMNS && Array.isArray(window.GRID_COLUMNS)) {
        const birthdayIdx = window.GRID_COLUMNS.findIndex(col => col[1] === 'birthday');
        if (birthdayIdx !== -1) {
            document.querySelectorAll('table.table tbody tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells[birthdayIdx]) {
                    cells[birthdayIdx].textContent = formatDateYMDToMDY(cells[birthdayIdx].textContent.trim());
                }
            });
        }
    }

    // Initialize default column states for first-time users after a delay
    // to ensure DOM is fully loaded and column managers are initialized
    setTimeout(() => {
        initializeDefaultColumnStates(tableName);
    }, 500);
    
    // Also try again after a longer delay as a fallback
    setTimeout(() => {
        initializeDefaultColumnStates(tableName);
    }, 2000);
}); 

// Function to initialize default column states for first-time users
async function initializeDefaultColumnStates(tableName) {
    try {

        
        // Check if any column state exists for this table
        const visibilityKey = `grid_visible_columns_${tableName}`;
        const orderKey = `grid_column_order_${tableName}`;
        const widthsKey = `grid_column_widths_${tableName}`;
        
        const hasVisibilityState = localStorage.getItem(visibilityKey);
        const hasOrderState = localStorage.getItem(orderKey);
        const hasWidthsState = localStorage.getItem(widthsKey);
        

        
        // If no states exist, initialize defaults
        if (!hasVisibilityState || !hasOrderState || !hasWidthsState) {

            
            // Fetch field configurations to get column information
            const response = await fetch(`/api/fields/${tableName}/`);
            const data = await response.json();
            const fields = data.fields;
            

            
            // Initialize default visibility (all columns visible)
            if (!hasVisibilityState) {
                const defaultVisibleColumns = fields.map(field => field.name);
                localStorage.setItem(visibilityKey, JSON.stringify(defaultVisibleColumns));

            }
            
            // Initialize default column order (current order from DOM)
            if (!hasOrderState) {
                const currentHeaders = document.querySelectorAll('.resizable-column');

                
                if (currentHeaders.length > 0) {
                    const defaultColumnOrder = Array.from(currentHeaders).map(h => h.dataset.columnName);
                    localStorage.setItem(orderKey, JSON.stringify(defaultColumnOrder));

                } else {
                    console.warn('No resizable columns found in DOM, will retry...');
                    // Retry after a short delay
                    setTimeout(() => {
                        const retryHeaders = document.querySelectorAll('.resizable-column');
                        if (retryHeaders.length > 0) {
                            const retryColumnOrder = Array.from(retryHeaders).map(h => h.dataset.columnName);
                            localStorage.setItem(orderKey, JSON.stringify(retryColumnOrder));

                        }
                    }, 1000);
                }
            }
            
            // Initialize default column widths (current widths from DOM)
            if (!hasWidthsState) {
                const currentHeaders = document.querySelectorAll('.resizable-column');

                
                if (currentHeaders.length > 0) {
                    const defaultColumnWidths = {};
                    currentHeaders.forEach(header => {
                        const columnName = header.dataset.columnName;
                        const width = header.offsetWidth;
                        defaultColumnWidths[columnName] = width;
                    });
                    localStorage.setItem(widthsKey, JSON.stringify(defaultColumnWidths));

                } else {
                    console.warn('No resizable columns found for width initialization, will retry...');
                    // Retry after a short delay
                    setTimeout(() => {
                        const retryHeaders = document.querySelectorAll('.resizable-column');
                        if (retryHeaders.length > 0) {
                            const retryColumnWidths = {};
                            retryHeaders.forEach(header => {
                                const columnName = header.dataset.columnName;
                                const width = header.offsetWidth;
                                retryColumnWidths[columnName] = width;
                            });
                            localStorage.setItem(widthsKey, JSON.stringify(retryColumnWidths));

                        }
                    }, 1000);
                }
            }
        }
    } catch (error) {
        console.error('Error initializing default column states:', error);
    }
}

function attachGridEventHandlers(tableName, fieldConfigs) {
    const table = document.querySelector('table.table');
    if (!table) return;
    // Row double-click for Edit
    table.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('dblclick', function() {
            const recordId = row.getAttribute('data-record-id');
            if (!recordId) return;
            const fetchFields = fieldConfigs.length === 0
                ? fetch(`/api/fields/${tableName}/`).then(res => res.json()).then(data => { fieldConfigs = data.fields; })
                : Promise.resolve();
            fetchFields.then(() => {
                fetch(`/api/record/${tableName}/${recordId}/`)
                    .then(res => res.json())
                    .then(recordData => {
                        window.showEditModal(fieldConfigs, recordData, tableName);
                    });
            });
        });
    });
    // Bulk select/deselect logic for grid checkboxes
    const selectAll = document.getElementById('select-all-checkbox');
    const deleteBtn = document.getElementById('delete-selected-btn');
    function updateDeleteButtonState() {
        const anyChecked = document.querySelectorAll('.row-select-checkbox:checked').length > 0;
        if (deleteBtn) deleteBtn.disabled = !anyChecked;
    }
    if (selectAll && table) {
        selectAll.addEventListener('change', function() {
            const checkboxes = table.querySelectorAll('.row-select-checkbox');
            checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
            updateDeleteButtonState();
        });
        table.addEventListener('change', function(e) {
            if (e.target.classList.contains('row-select-checkbox')) {
                const checkboxes = table.querySelectorAll('.row-select-checkbox');
                const checked = table.querySelectorAll('.row-select-checkbox:checked');
                selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
                updateDeleteButtonState();
            }
        });
    }
}
 