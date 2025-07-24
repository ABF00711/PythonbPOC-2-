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
                // Get row data from cells
                const cells = Array.from(row.querySelectorAll('td'));
                const rowData = {};
                fieldConfigs.forEach((f, idx) => {
                    rowData[f.name] = cells[idx] ? cells[idx].textContent.trim() : '';
                });
                // Fetch field configs if not loaded
                if (fieldConfigs.length === 0) {
                    fetch(`/api/fields/${tableName}/`)
                        .then(res => res.json())
                        .then(data => {
                            fieldConfigs = data.fields;
                            showEditModal(fieldConfigs, rowData);
                        });
                } else {
                    showEditModal(fieldConfigs, rowData);
                }
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
                input.value = rowData[field.name] || '';
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
        // Show modal
        const editModalInstance = new bootstrap.Modal(editModal);
        editModalInstance.show();
    }
}); 