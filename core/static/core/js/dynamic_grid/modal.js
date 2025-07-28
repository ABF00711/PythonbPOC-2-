// Modal handling for dynamic grid
// Handles create, edit, and search modals

// Exported functions will be attached to window for now for compatibility

function renderFormFields(fields, formFieldsDiv, tableName) {
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
            dropdownParent: $('#createModal')
        });
    });
}

function showEditModal(fields, rowData, tableName) {
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
    // Add event listener for form submission
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

function renderSearchFields(fields, searchFieldsContainer, tableName) {
    if (!searchFieldsContainer) return;
    searchFieldsContainer.innerHTML = '';
    fields.forEach(field => {
        const fieldRow = document.createElement('div');
        fieldRow.className = 'row mb-3';
        fieldRow.setAttribute('data-field', field.name);
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
    // --- Add Sort Fields Below Filters ---
    const sortFieldsDiv = document.createElement('div');
    sortFieldsDiv.id = 'dynamic-sort-fields';
    // Build options for sort field dropdowns from fields array
    let sortFieldOptions = '<option value="">Select field</option>';
    fields.forEach(field => {
        sortFieldOptions += `<option value="${field.name}">${field.label}</option>`;
    });
    // Sort1 row
    const sort1Row = document.createElement('div');
    sort1Row.className = 'row mb-3';
    sort1Row.setAttribute('data-sort', '0');
    sort1Row.innerHTML = `
        <div class="col-md-2">
            <label class="form-label">Sort1</label>
        </div>
        <div class="col-md-5">
            <select class="form-select sort-field-select" data-sort="0">
                ${sortFieldOptions}
            </select>
        </div>
        <div class="col-md-5">
            <select class="form-select sort-direction-select" data-sort="0">
                <option value="">Select direction</option>
                <option value="asc">Increase</option>
                <option value="desc">Decrease</option>
            </select>
        </div>
    `;
    // Sort2 row
    const sort2Row = document.createElement('div');
    sort2Row.className = 'row mb-3';
    sort2Row.setAttribute('data-sort', '1');
    sort2Row.innerHTML = `
        <div class="col-md-2">
            <label class="form-label">Sort2</label>
        </div>
        <div class="col-md-5">
            <select class="form-select sort-field-select" data-sort="1">
                ${sortFieldOptions}
            </select>
        </div>
        <div class="col-md-5">
            <select class="form-select sort-direction-select" data-sort="1">
                <option value="">Select direction</option>
                <option value="asc">Increase</option>
                <option value="desc">Decrease</option>
            </select>
        </div>
    `;
    sortFieldsDiv.appendChild(sort1Row);
    sortFieldsDiv.appendChild(sort2Row);
    searchFieldsContainer.appendChild(sortFieldsDiv);
}

window.renderFormFields = renderFormFields;
window.showEditModal = showEditModal;
window.renderSearchFields = renderSearchFields;
window.generateSearchInput = generateSearchInput;
// Add more modal-related exports as needed 