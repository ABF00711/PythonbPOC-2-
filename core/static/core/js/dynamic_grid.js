// dynamic_grid.js
// Main orchestrator for the dynamic grid UI
import { updateGrid } from './dynamic_grid/grid.js';
import { createRecord, updateRecord, deleteRecords, searchRecords, resetGrid } from './dynamic_grid/crud.js';
import { formatDateYMDToMDY, showToast } from './dynamic_grid/utils.js';
import { SearchPatternManager } from './dynamic_grid/search_patterns.js';

// Assumes modal.js is loaded and exposes window.renderFormFields, window.showEditModal, window.renderSearchFields

// Global state restoration coordinator
class GridStateRestorer {
    constructor() {
        this.tableName = '';
        this.isRestoring = false;
        this.restorationQueue = [];
    }

    setTableName(tableName) {
        this.tableName = tableName;
    }

    // Add a restoration task to the queue
    addRestorationTask(task) {
        this.restorationQueue.push(task);
    }

    // Execute all restoration tasks in order
    async executeRestoration() {
        if (this.isRestoring) return;
        this.isRestoring = true;

        console.log('Starting grid state restoration for table:', this.tableName);

        try {
            // Wait for DOM to be ready
            await this.waitForDOM();

            // Execute restoration tasks in order
            for (const task of this.restorationQueue) {
                try {
                    await task();
                } catch (error) {
                    console.error('Error executing restoration task:', error);
                }
            }

            console.log('Grid state restoration completed');
        } catch (error) {
            console.error('Error during grid state restoration:', error);
        } finally {
            this.isRestoring = false;
        }
    }

    // Wait for DOM elements to be available
    async waitForDOM() {
        const maxAttempts = 50; // 5 seconds max
        let attempts = 0;

        while (attempts < maxAttempts) {
            const table = document.querySelector('#dynamic-grid-table');
            const headers = document.querySelectorAll('.resizable-column');
            
            if (table && headers.length > 0) {
                console.log('DOM ready for state restoration');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        throw new Error('DOM not ready for state restoration');
    }

    // Check if states exist for this table
    hasSavedStates() {
        const visibilityKey = `grid_visible_columns_${this.tableName}`;
        const orderKey = `grid_column_order_${this.tableName}`;
        const widthsKey = `grid_column_widths_${this.tableName}`;
        const sortKey = `grid_column_sort_${this.tableName}`;

        return localStorage.getItem(visibilityKey) || 
               localStorage.getItem(orderKey) || 
               localStorage.getItem(widthsKey) || 
               localStorage.getItem(sortKey);
    }
}

// Global instance
window.gridStateRestorer = new GridStateRestorer();

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

    // Set table name for state restorer
    window.gridStateRestorer.setTableName(tableName);
    
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

    // Bulk delete functionality
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            const checkedBoxes = document.querySelectorAll('.row-select-checkbox:checked');
            if (checkedBoxes.length === 0) {
                showToast('Please select records to delete.', 'warning');
                return;
            }
            
            const recordIds = Array.from(checkedBoxes).map(cb => cb.value);
            bulkDeleteMsg.textContent = `Are you sure you want to delete ${recordIds.length} selected record(s)?`;
            
            const bulkModal = new bootstrap.Modal(bulkDeleteModal);
            bulkModal.show();
        });
    }

    if (confirmBulkDeleteBtn) {
        confirmBulkDeleteBtn.addEventListener('click', async function() {
            const checkedBoxes = document.querySelectorAll('.row-select-checkbox:checked');
            const recordIds = Array.from(checkedBoxes).map(cb => cb.value);
            
            try {
                const data = await deleteRecords(tableName, recordIds);
                if (data.success) {
                    bootstrap.Modal.getInstance(bulkDeleteModal).hide();
                    location.reload();
                } else {
                    showToast('Error deleting records: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error during bulk delete:', error);
                showToast('Error deleting records. Please try again.', 'error');
            }
        });
    }

    // Search functionality
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            const searchModal = new bootstrap.Modal(document.getElementById('searchModal'));
            searchModal.show();
        });
    }

    // Reset Grid functionality
    const resetGridBtn = document.getElementById('reset-grid-btn');
    if (resetGridBtn) {
        resetGridBtn.addEventListener('click', async function() {
            resetGridBtn.disabled = true;
            resetGridBtn.innerHTML = 'Resetting...';
            
            try {
                const response = await fetch(`/api/reset-grid/${tableName}/`);
                const data = await response.json();
                
                if (data.success) {
                    // Update grid with original data
                    updateGrid(tableName, data.data, data.columns);
                    showToast('Grid reset successfully', 'success');
                } else {
                    showToast('Error resetting grid: ' + data.error, 'error');
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

    // Initialize state restoration
    initializeStateRestoration(tableName);
    
    // Initialize default column states for first-time users after a delay
    // to ensure DOM is fully loaded and column managers are initialized
    setTimeout(() => {
        initializeDefaultColumnStates(tableName);
    }, 500);
    
    // Also try again after a longer delay as a fallback
    setTimeout(() => {
        initializeDefaultColumnStates(tableName);
    }, 2000);

    // Initialize state restoration after column managers are loaded
    setTimeout(() => {
        restoreGridStates(tableName);
    }, 1000);
}); 

// Initialize state restoration for the grid
function initializeStateRestoration(tableName) {
    console.log('Initializing state restoration for table:', tableName);
    
    // Add restoration tasks to the queue
    window.gridStateRestorer.addRestorationTask(async () => {
        // Restore column order first
        if (window.columnDragger) {
            await window.columnDragger.restoreColumnOrder();
        }
    });

    window.gridStateRestorer.addRestorationTask(async () => {
        // Restore column widths
        if (window.columnResizer) {
            await window.columnResizer.restoreColumnWidths();
        }
    });

    window.gridStateRestorer.addRestorationTask(async () => {
        // Restore column visibility
        if (window.columnVisibilityManager) {
            await window.columnVisibilityManager.restoreVisibility();
        }
    });

    window.gridStateRestorer.addRestorationTask(async () => {
        // Restore column sorting
        if (window.columnSorter) {
            await window.columnSorter.restoreSortState();
        }
    });

    // Execute restoration after a short delay to ensure all managers are initialized
    setTimeout(() => {
        if (window.gridStateRestorer.hasSavedStates()) {
            window.gridStateRestorer.executeRestoration();
        }
    }, 100);
}

// Function to initialize default column states for first-time users
async function initializeDefaultColumnStates(tableName) {
    try {
        console.log('Checking for default column states for table:', tableName);
        
        // Check if any column state exists for this table
        const visibilityKey = `grid_visible_columns_${tableName}`;
        const orderKey = `grid_column_order_${tableName}`;
        const widthsKey = `grid_column_widths_${tableName}`;
        
        const hasVisibilityState = localStorage.getItem(visibilityKey);
        const hasOrderState = localStorage.getItem(orderKey);
        const hasWidthsState = localStorage.getItem(widthsKey);
        
        console.log('Existing states:', {
            visibility: !!hasVisibilityState,
            order: !!hasOrderState,
            widths: !!hasWidthsState
        });
        
        // If no states exist, initialize defaults
        if (!hasVisibilityState || !hasOrderState || !hasWidthsState) {
            console.log('Initializing default column states for first-time user...');
            
            // Fetch field configurations to get column information
            const response = await fetch(`/api/fields/${tableName}/`);
            const data = await response.json();
            const fields = data.fields;
            
            console.log('Fetched fields:', fields.length);
            
            // Initialize default visibility (all columns visible)
            if (!hasVisibilityState) {
                const defaultVisibleColumns = fields.map(field => field.name);
                localStorage.setItem(visibilityKey, JSON.stringify(defaultVisibleColumns));
                console.log('Default visibility state saved:', defaultVisibleColumns);
            }
            
            // Initialize default column order (current order from DOM)
            if (!hasOrderState) {
                const currentHeaders = document.querySelectorAll('.resizable-column');
                console.log('Found headers:', currentHeaders.length);
                
                if (currentHeaders.length > 0) {
                    const defaultColumnOrder = Array.from(currentHeaders).map(h => h.dataset.columnName);
                    localStorage.setItem(orderKey, JSON.stringify(defaultColumnOrder));
                    console.log('Default column order saved:', defaultColumnOrder);
                } else {
                    console.warn('No resizable columns found in DOM, will retry...');
                    // Retry after a short delay
                    setTimeout(() => {
                        const retryHeaders = document.querySelectorAll('.resizable-column');
                        if (retryHeaders.length > 0) {
                            const retryColumnOrder = Array.from(retryHeaders).map(h => h.dataset.columnName);
                            localStorage.setItem(orderKey, JSON.stringify(retryColumnOrder));
                            console.log('Default column order saved on retry:', retryColumnOrder);
                        }
                    }, 1000);
                }
            }
            
            // Initialize default column widths (current widths from DOM)
            if (!hasWidthsState) {
                const currentHeaders = document.querySelectorAll('.resizable-column');
                console.log('Found headers for widths:', currentHeaders.length);
                
                if (currentHeaders.length > 0) {
                    const defaultColumnWidths = {};
                    currentHeaders.forEach(header => {
                        const columnName = header.dataset.columnName;
                        const width = header.offsetWidth;
                        defaultColumnWidths[columnName] = width;
                    });
                    localStorage.setItem(widthsKey, JSON.stringify(defaultColumnWidths));
                    console.log('Default column widths saved:', defaultColumnWidths);
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
                            console.log('Default column widths saved on retry:', retryColumnWidths);
                        }
                    }, 1000);
                }
            }
            
            console.log('Default column states initialization completed');
        } else {
            console.log('Column states already exist, skipping initialization');
        }
    } catch (error) {
        console.error('Error initializing default column states:', error);
    }
}

// Function to restore all grid states when page loads
async function restoreGridStates(tableName) {
    console.log('Restoring grid states for table:', tableName);
    
    try {
        // Check if any saved states exist
        const visibilityKey = `grid_visible_columns_${tableName}`;
        const orderKey = `grid_column_order_${tableName}`;
        const widthsKey = `grid_column_widths_${tableName}`;
        const sortKey = `grid_column_sort_${tableName}`;

        const hasSavedStates = localStorage.getItem(visibilityKey) || 
                              localStorage.getItem(orderKey) || 
                              localStorage.getItem(widthsKey) || 
                              localStorage.getItem(sortKey);

        if (!hasSavedStates) {
            console.log('No saved states found, skipping restoration');
            return;
        }

        console.log('Found saved states, restoring...');

        // Wait for DOM to be ready
        await waitForDOM();

        // Restore states in order
        if (window.columnDragger) {
            await window.columnDragger.restoreColumnOrder();
        }

        if (window.columnResizer) {
            await window.columnResizer.restoreColumnWidths();
        }

        if (window.columnVisibilityManager) {
            await window.columnVisibilityManager.restoreVisibility();
        }

        if (window.columnSorter) {
            await window.columnSorter.restoreSortState();
        }

        console.log('Grid state restoration completed');
    } catch (error) {
        console.error('Error restoring grid states:', error);
    }
}

// Helper function to wait for DOM elements
async function waitForDOM() {
    const maxAttempts = 50; // 5 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
        const table = document.querySelector('#dynamic-grid-table');
        const headers = document.querySelectorAll('.resizable-column');
        
        if (table && headers.length > 0) {
            console.log('DOM ready for state restoration');
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    throw new Error('DOM not ready for state restoration');
}

// --- Helper to re-attach row and checkbox handlers after grid update ---
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

// --- Initial attach on page load ---
//attachGridEventHandlers();
// After every updateGrid (e.g., after search, after delete), call attachGridEventHandlers();
// For example, after updateGrid in search:
// updateGrid(data.columns, data.data, data.total_count);
// attachGridEventHandlers();
// ... existing code ...
// In all places where updateGrid is called, add attachGridEventHandlers() immediately after. 