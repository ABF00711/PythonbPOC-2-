// dynamic_grid.js
// Handles dynamic create modal, inputable dropdowns, and AJAX grid update



document.addEventListener('DOMContentLoaded', function() {
    const addBtn = document.getElementById('add-record-btn');
    const modal = new bootstrap.Modal(document.getElementById('createModal'));
    const formFieldsDiv = document.getElementById('dynamic-form-fields');
    const form = document.getElementById('dynamic-create-form');
    const tableName = document.querySelector('.container[data-table-name]').dataset.tableName;
    let fieldConfigs = [];

    if (addBtn) {``
        addBtn.addEventListener('click', function() {
            fetch(`/api/fields/${tableName}/`)
                .then(res => res.json())
                .then(data => {
                    fieldConfigs = data.fields;
                    renderFormFields(fieldConfigs);
                    modal.show();
                })
                .catch(err => {
                    console.error('Error fetching fields:', err);
                    alert('Failed to load form fields.');
                });
        });
    }

    function renderFormFields(fields) {
        formFieldsDiv.innerHTML = '';
        fields.forEach(field => {
            const wrapper = document.createElement('div');
            wrapper.className = 'mb-3';
            const label = document.createElement('label');
            label.className = 'form-label';
            label.htmlFor = `field_${field.name}`;
            label.innerHTML = field.label + (field.mandatory ? ' <span class="text-danger">*</span>' : '');
            wrapper.appendChild(label);
            let input;
            if (['select', 'autocomplete', 'dropdown'].includes(field.type)) {
                input = document.createElement('select');
                input.className = 'form-control inputable-dropdown';
                input.id = `field_${field.name}`;
                input.name = field.name;
                input.setAttribute('data-lookup', '1');
                input.setAttribute('data-table', tableName);
                input.setAttribute('data-field', field.name);
                wrapper.appendChild(input);
            } else if (field.type === 'date') {
                input = document.createElement('input');
                input.type = 'date';
                input.className = 'form-control';
                input.id = `field_${field.name}`;
                input.name = field.name;
                wrapper.appendChild(input);
            } else if (field.type === 'number') {
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.id = `field_${field.name}`;
                input.name = field.name;
                wrapper.appendChild(input);
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.id = `field_${field.name}`;
                input.name = field.name;
                wrapper.appendChild(input);
            }
            // Validation error placeholder
            const errorDiv = document.createElement('div');
            errorDiv.className = 'invalid-feedback';
            errorDiv.id = `error_${field.name}`;
            wrapper.appendChild(errorDiv);
            formFieldsDiv.appendChild(wrapper);
        });
        // Initialize Select2 for inputable dropdowns
        $(formFieldsDiv).find('.inputable-dropdown').each(function() {
            const $select = $(this);
            const field = $select.data('field');
            const table = $select.data('table');
            // Ensure select is enabled BEFORE initializing Select2
            $select.prop('disabled', false);
            $select.select2({
                theme: 'bootstrap-5', // Use Bootstrap 5 theme
                tags: true, // Enable typing new tags
                width: '100%',
                ajax: {
                    url: `/api/options/${table}/${field}/`,
                    dataType: 'json',
                    processResults: function(data) {
                        return { results: data.options.map(function(option) { return { id: option.text, text: option.text }; }) };
                    }
                },
                placeholder: 'Select or type to add',
                allowClear: true,
                createTag: function (params) { // Allow creating new tags
                    var term = $.trim(params.term);
                    if (term === '') { return null; }
                    return { id: term, text: term, newTag: true };
                },
                dropdownParent: $('#createModal') // CRITICAL: ensures Select2 input is not disabled in modal
            });
        });
    }

    if (form) {
        form.addEventListener('submit', function(e) {
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
            fetch(`/api/create/${tableName}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            .then(res => res.json())
            .then(data => {
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
        });
    }

    // Add double-click event handler to grid rows for Edit
    const table = document.querySelector('table.table');
    if (table) {
        table.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('dblclick', function() {
                const recordId = row.getAttribute('data-record-id');
                if (!recordId) return;
                // Fetch field configs if not loaded
                const fetchFields = fieldConfigs.length === 0
                    ? fetch(`/api/fields/${tableName}/`).then(res => res.json()).then(data => { fieldConfigs = data.fields; })
                    : Promise.resolve();
                fetchFields.then(() => {
                    // Fetch the full record from backend
                    fetch(`/api/record/${tableName}/${recordId}/`)
                        .then(res => res.json())
                        .then(recordData => {
                            showEditModal(fieldConfigs, recordData);
                        });
                });
            });
        });
    }

    // Show Edit modal (dynamically generated)
    function showEditModal(fields, rowData) {
        // Clone the create modal and change IDs
        let editModal = document.getElementById('editModal');
        if (!editModal) {
            editModal = document.getElementById('createModal').cloneNode(true);
            editModal.id = 'editModal';
            editModal.querySelector('.modal-title').textContent = 'Edit ' + tableName.charAt(0).toUpperCase() + tableName.slice(1);
            editModal.querySelector('form').id = 'dynamic-edit-form';
            // Change Save button to Edit
            const editBtn = editModal.querySelector('button[type="submit"]');
            editBtn.textContent = 'Edit';
            // Insert modal into DOM
            document.body.appendChild(editModal);
        }
        // Render fields and pre-fill values
        const editFormFieldsDiv = editModal.querySelector('#dynamic-form-fields');
        editFormFieldsDiv.innerHTML = '';
        fields.forEach(field => {
            if (field.name.toLowerCase() === 'id') return; // skip ID
            const wrapper = document.createElement('div');
            wrapper.className = 'mb-3';
            const label = document.createElement('label');
            label.className = 'form-label';
            label.htmlFor = `edit_field_${field.name}`;
            label.innerHTML = field.label + (field.mandatory ? ' <span class="text-danger">*</span>' : '');
            wrapper.appendChild(label);
            let input;
            if (["select", "autocomplete", "dropdown"].includes(field.type)) {
                input = document.createElement('select');
                input.className = 'form-control inputable-dropdown';
                input.id = `edit_field_${field.name}`;
                input.name = field.name;
                input.setAttribute('data-lookup', '1');
                input.setAttribute('data-table', tableName);
                input.setAttribute('data-field', field.name);
                wrapper.appendChild(input);
            } else if (field.type === 'date') {
                input = document.createElement('input');
                input.type = 'date';
                input.className = 'form-control';
                input.id = `edit_field_${field.name}`;
                input.name = field.name;
                let val = rowData[field.name] || '';
                input.value = val;
                wrapper.appendChild(input);
            } else if (field.type === 'number') {
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.id = `edit_field_${field.name}`;
                input.name = field.name;
                input.value = rowData[field.name] || '';
                wrapper.appendChild(input);
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.id = `edit_field_${field.name}`;
                input.name = field.name;
                input.value = rowData[field.name] || '';
                wrapper.appendChild(input);
            }
            // Validation error placeholder
            const errorDiv = document.createElement('div');
            errorDiv.className = 'invalid-feedback';
            errorDiv.id = `edit_error_${field.name}`;
            wrapper.appendChild(errorDiv);
            editFormFieldsDiv.appendChild(wrapper);
        });
        // Initialize Select2 for inputable dropdowns
        $(editFormFieldsDiv).find('.inputable-dropdown').each(function() {
            const $select = $(this);
            const field = $select.data('field');
            const table = $select.data('table');
            $select.prop('disabled', false);
            $select.select2({
                theme: 'bootstrap-5',
                tags: true,
                width: '100%',
                ajax: {
                    url: `/api/options/${table}/${field}/`,
                    dataType: 'json',
                    processResults: function(data) {
                        return { results: data.options.map(function(option) { return { id: option.text, text: option.text }; }) };
                    }
                },
                placeholder: 'Select or type to add',
                allowClear: true,
                createTag: function (params) {
                    var term = $.trim(params.term);
                    if (term === '') { return null; }
                    return { id: term, text: term, newTag: true };
                },
                dropdownParent: $('#editModal')
            });
        });
        // Pre-fill dropdowns after Select2 is initialized
        setTimeout(() => {
            fields.forEach(field => {
                if (["select", "autocomplete", "dropdown"].includes(field.type)) {
                    const $select = $(editFormFieldsDiv).find(`[name="${field.name}"]`);
                    if ($select.length && rowData[field.name]) {
                        $select.append(new Option(rowData[field.name], rowData[field.name], true, true)).trigger('change');
                    }
                }
            });
        }, 300);
        // Set record id on modal for later use
        editModal.setAttribute('data-record-id', rowData.id);
        // Show modal
        const editModalInstance = new bootstrap.Modal(editModal);
        editModalInstance.show();
    }

    // Edit modal form submission
    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form && form.id === 'dynamic-edit-form') {
            e.preventDefault();
            const modal = form.closest('.modal');
            const recordId = modal && modal.getAttribute('data-record-id');
            if (!recordId) return;
            // Clear previous errors
            fieldConfigs.forEach(f => {
                const err = form.querySelector(`#edit_error_${f.name}`);
                if (err) err.textContent = '';
                const input = form.querySelector(`[name="${f.name}"]`);
                if (input) input.classList.remove('is-invalid');
            });
            // Collect form data and validate mandatory fields
            const formData = {};
            let firstInvalid = null;
            let hasError = false;
            fieldConfigs.forEach(f => {
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
            fetch(`/api/update/${tableName}/${recordId}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    bootstrap.Modal.getInstance(modal).hide();
                    location.reload();
                } else if (data.error) {
                    showToast('Error: ' + data.error, 'error');
                }
            });
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

        confirmBulkDeleteBtn.addEventListener('click', function() {
            const checked = table.querySelectorAll('.row-select-checkbox:checked');
            const ids = Array.from(checked).map(cb => cb.closest('tr').getAttribute('data-record-id'));
            if (!ids.length || !tableName) return;
            fetch(`/api/delete/${tableName}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            })
            .then(res => res.json())
            .then(data => {
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
            // Fetch search config and generate fields
            fetch(`/api/fields/${tableName}/`)
                .then(res => res.json())
                .then(data => {
                    if (data.fields) {
                        renderSearchFields(data.fields);
                        const modal = new bootstrap.Modal(searchModal);
                        modal.show();
                    }
                });
        });
    }

    function renderSearchFields(fields) {
        if (!searchFieldsContainer) return;
        searchFieldsContainer.innerHTML = '';
        
        fields.forEach(field => {
            const fieldRow = document.createElement('div');
            fieldRow.className = 'row mb-3';
            fieldRow.innerHTML = `
                <div class="col-md-3">
                    <label class="form-label">${field.label}</label>
                </div>
                <div class="col-md-3">
                    <select class="form-select operator-select" data-field="${field.name}">
                        <option value="">Select Operator</option>
                        ${field.operator_tags ? field.operator_tags.split(',').map(op => 
                            `<option value="${op.trim()}">${op.trim()}</option>`
                        ).join('') : ''}
                    </select>
                </div>
                <div class="col-md-6">
                    ${generateSearchInput(field)}
                </div>
            `;
            searchFieldsContainer.appendChild(fieldRow);

            // Populate dropdown options for search fields
            if (field.type === 'dropdown') {
                const select = fieldRow.querySelector('.search-input');
                if (select) {
                    // Use Select2 for search dropdowns (no tags)
                    $(select).select2({
                        theme: 'bootstrap-5',
                        width: '100%',
                        dropdownParent: $('#searchModal'),
                        allowClear: true,
                        placeholder: `Select ${field.label}`
                    });
                    fetch(`/api/options/${tableName}/${field.name}/`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.options) {
                                data.options.forEach(opt => {
                                    const option = new Option(opt.text, opt.text, false, false);
                                    select.appendChild(option);
                                });
                                $(select).trigger('change');
                            }
                        });
                }
            }

            // GSearch autocomplete for text fields
            if (field.type === 'text') {
                const operatorSelect = fieldRow.querySelector('.operator-select');
                let input = fieldRow.querySelector('.search-input');
                if (operatorSelect && input) {
                    operatorSelect.addEventListener('change', function() {
                        const inputCol = fieldRow.querySelector('.col-md-6');
                        if (operatorSelect.value === 'GSearch') {
                            // Replace input with a select for Select2
                            const select = document.createElement('select');
                            select.className = 'form-select search-input';
                            select.setAttribute('data-field', field.name);
                            select.setAttribute('style', 'width: 100%');
                            inputCol.innerHTML = '';
                            inputCol.appendChild(select);
                            $(select).select2({
                                theme: 'bootstrap-5',
                                width: '100%',
                                dropdownParent: $('#searchModal'),
                                allowClear: true,
                                placeholder: `Type to search ${field.label}`,
                                ajax: {
                                    url: `/api/gsearch/${tableName}/${field.name}/`,
                                    dataType: 'json',
                                    delay: 250,
                                    data: function(params) {
                                        return { q: params.term };
                                    },
                                    processResults: function(data) {
                                        return { results: data.options.map(function(opt) { return { id: opt.text, text: opt.text }; }) };
                                    }
                                },
                                minimumInputLength: 1
                            });
                        } else {
                            // Replace select2 with a normal text input
                            inputCol.innerHTML = '';
                            const textInput = document.createElement('input');
                            textInput.type = 'text';
                            textInput.className = 'form-control search-input';
                            textInput.setAttribute('data-field', field.name);
                            textInput.setAttribute('placeholder', `Enter ${field.label}`);
                            inputCol.appendChild(textInput);
                        }
                    });
                }
            }
        });
    }

    function generateSearchInput(field) {
        switch(field.type) {
            case 'text':
                return `<input type="text" class="form-control search-input" data-field="${field.name}" placeholder="Enter ${field.label}">`;
            case 'number':
                return `<input type="number" class="form-control search-input" data-field="${field.name}" placeholder="Enter ${field.label}">`;
            case 'date':
                return `<input type="date" class="form-control search-input" data-field="${field.name}">`;
            case 'dropdown':
                return `<select class="form-select search-input" data-field="${field.name}">
                    <option value="">Select ${field.label}</option>
                </select>`;
            default:
                return `<input type="text" class="form-control search-input" data-field="${field.name}" placeholder="Enter ${field.label}">`;
        }
    }

    // Reset Search Button
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', function() {
            const operatorSelects = searchModal.querySelectorAll('.operator-select');
            const searchInputs = searchModal.querySelectorAll('.search-input');
            
            operatorSelects.forEach(select => select.value = '');
            searchInputs.forEach(input => input.value = '');
        });
    }

    // Execute Search Button
    if (executeSearchBtn) {
        executeSearchBtn.addEventListener('click', function() {
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
            
            fetch(`/api/search/${tableName}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(searchData)
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.data) {
                    updateGrid(data.columns, data.data, data.total_count);
                    showToast('Search complete', 'success');
                } else {
                    showToast('No results found', 'warning');
                }
            })
            .catch(() => {
                showToast('Search failed', 'danger');
            });
            // Close modal
            const modalInstance = bootstrap.Modal.getInstance(searchModal);
            if (modalInstance) modalInstance.hide();
        });
    }

    function updateGrid(columns, data, totalCount) {
        // Update table headers
        const table = document.querySelector('table.table');
        if (!table) return;
        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        if (!thead || !tbody) return;
        // Remove all header cells
        while (thead.firstChild) thead.removeChild(thead.firstChild);
        // Add new header cells
        columns.forEach(col => {
            if (col[1] !== 'id') {
                const th = document.createElement('th');
                th.textContent = col[0];
                thead.appendChild(th);
            }
        });
        // Remove all body rows
        while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
        // Add new rows
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-record-id', row.id || '');
            columns.forEach(col => {
                if (col[1] !== 'id') {
                    const td = document.createElement('td');
                    let value = row[col[1]];
                    td.textContent = value == null ? '' : value;
                    tr.appendChild(td);
                }
            });
            tbody.appendChild(tr);
        });
        // Update total count
        const totalCountEl = document.getElementById('total-count');
        if (totalCountEl) {
            totalCountEl.textContent = totalCount;
        }
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

    // Toast notification function
    function showToast(message, type = 'success') {
        const toastEl = document.getElementById('grid-toast');
        const toastBody = document.getElementById('grid-toast-body');
        if (!toastEl || !toastBody) return;
        toastBody.textContent = message;
        toastEl.classList.remove('text-bg-success', 'text-bg-danger');
        toastEl.classList.add(type === 'success' ? 'text-bg-success' : 'text-bg-danger');
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
        toast.show();
    }
}); 