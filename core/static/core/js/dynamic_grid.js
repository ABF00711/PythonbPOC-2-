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
                        return { results: data.options };
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
            fieldConfigs.forEach(f => {
                let val = form.querySelector(`[name="${f.name}"]`).value;
                if ((['select', 'autocomplete', 'dropdown'].includes(f.type)) && val && isNaN(val)) {
                    // If not a number, treat as new entry
                    val = val.trim();
                }
                console.log(f.name, val);
                formData[f.name] = val;
            });
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
}); 