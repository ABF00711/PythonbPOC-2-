// Search Patterns Module
import { showToast } from './utils.js';

export class SearchPatternManager {
    constructor(tableName) {
        this.tableName = tableName;
        this.patterns = [];
        this.currentPattern = null;
        this.eventListenersAttached = false;
        this.init();
    }

    async init() {
        // Clear any existing patterns to prevent duplicates
        this.patterns = [];
        this.currentPattern = null;
        
        await this.loadPatterns();
        this.attachEventListeners();
        this.resetForm();
    }

    resetForm() {
        // Reset pattern form fields
        const patternSelect = document.getElementById('search-pattern-select');
        const patternNameInput = document.getElementById('search-pattern-name');
        const deleteBtn = document.getElementById('delete-pattern-btn');
        
        if (patternSelect) patternSelect.value = '';
        if (patternNameInput) patternNameInput.value = '';
        if (deleteBtn) deleteBtn.disabled = true;
        
        // Clear current pattern
        this.currentPattern = null;
    }

    async loadPatterns() {
        try {
            const response = await fetch(`/api/search-patterns/${this.tableName}/`);
            const data = await response.json();
            this.patterns = data.patterns || [];
            this.populatePatternSelect();
        } catch (error) {
            console.error('Error loading search patterns:', error);
            showToast('Error loading search patterns', 'error');
            alert('Error loading search patterns: ' + error.message);
        }
    }

    populatePatternSelect() {
        const select = document.getElementById('search-pattern-select');
        if (!select) return;

        // Clear existing options except the first one
        select.innerHTML = '<option value="">-- Select Saved Pattern --</option>';
        
        this.patterns.forEach(pattern => {
            const option = document.createElement('option');
            option.value = pattern.searchname;
            option.textContent = pattern.searchname;
            option.dataset.patternId = pattern.id;
            select.appendChild(option);
        });
    }

    attachEventListeners() {
        // Only attach listeners once
        if (this.eventListenersAttached) {
            console.log('Event listeners already attached, skipping');
            return;
        }

        // Pattern selection
        console.log('attachEventListeners called');
        const patternSelect = document.getElementById('search-pattern-select');
        if (patternSelect) {
            console.log('Found pattern select, adding event listener');
            patternSelect.addEventListener('change', (e) => this.onPatternSelect(e));
        } else {
            console.log('Pattern select not found');
        }

        // Save pattern
        const saveBtn = document.getElementById('save-pattern-btn');
        if (saveBtn) {
            console.log('Found save button, adding event listener');
            saveBtn.addEventListener('click', () => this.savePattern());
        } else {
            console.log('Save button not found');
        }

        // Delete pattern
        const deleteBtn = document.getElementById('delete-pattern-btn');
        if (deleteBtn) {
            console.log('Found delete button, adding event listener');
            deleteBtn.addEventListener('click', () => this.deletePattern());
        } else {
            console.log('Delete button not found');
        }

        this.eventListenersAttached = true;
    }

    onPatternSelect(event) {
        const selectedValue = event.target.value;
        const patternNameInput = document.getElementById('search-pattern-name');
        const deleteBtn = document.getElementById('delete-pattern-btn');

        if (selectedValue) {
            // Load existing pattern
            const pattern = this.patterns.find(p => p.searchname === selectedValue);
            if (pattern) {
                this.currentPattern = pattern;
                patternNameInput.value = pattern.searchname;
                deleteBtn.disabled = false;
                this.applyPattern(pattern.searchdata);
            }
        } else {
            // Clear pattern
            this.currentPattern = null;
            patternNameInput.value = '';
            deleteBtn.disabled = true;
            this.clearAllFields();
        }
    }

    applyPattern(searchData) {
        // Apply filters
        if (searchData.filters) {
            Object.keys(searchData.filters).forEach(fieldName => {
                const filter = searchData.filters[fieldName];
                const fieldContainer = document.querySelector(`[data-field="${fieldName}"]`);
                if (fieldContainer) {
                    const operatorSelect = fieldContainer.querySelector('.operator-select');
                    const valueInput = fieldContainer.querySelector('.search-input');
                    
                    if (operatorSelect) {
                        operatorSelect.value = filter.operator;
                    }
                    if (valueInput) {
                        valueInput.value = filter.value || '';
                    }
                }
            });
        }

        // Apply sorts
        if (searchData.sorts) {
            searchData.sorts.forEach((sort, index) => {
                const sortContainer = document.querySelector(`[data-sort="${index}"]`);
                if (sortContainer) {
                    const fieldSelect = sortContainer.querySelector('.sort-field-select');
                    const directionSelect = sortContainer.querySelector('.sort-direction-select');
                    
                    if (fieldSelect) {
                        fieldSelect.value = sort.field || '';
                    }
                    if (directionSelect) {
                        directionSelect.value = sort.direction || '';
                    }
                }
            });
        }
    }

    clearAllFields() {
        // Clear all filter fields
        document.querySelectorAll('.search-input').forEach(input => {
            input.value = '';
        });
        
        // Clear all operator selects
        document.querySelectorAll('.operator-select').forEach(select => {
            select.value = '';
        });

        // Clear all sort fields
        document.querySelectorAll('.sort-field-select').forEach(select => {
            select.value = '';
        });
        
        document.querySelectorAll('.sort-direction-select').forEach(select => {
            select.value = '';
        });
    }

    async savePattern() {
        console.log('savePattern called');
        const patternNameInput = document.getElementById('search-pattern-name');
        console.log('Pattern name input:', patternNameInput);
        const searchName = patternNameInput.value.trim();
        console.log('Search name:', searchName);

        if (!searchName) {
            showToast('Please enter a pattern name', 'error');
            alert('Please enter a pattern name');
            return;
        }

        // Collect current search data
        const searchData = this.collectSearchData();
        
        if (!searchData.filters && !searchData.sorts) {
            showToast('Please add at least one filter or sort before saving', 'error');
            alert('Please add at least one filter or sort before saving');
            return;
        }

        try {
            // Check if pattern name already exists
            const existingPattern = this.patterns.find(p => p.searchname === searchName);
            
            if (existingPattern && existingPattern.id !== (this.currentPattern?.id || null)) {
                // Pattern name exists and it's not the current pattern being edited
                const confirmMessage = `A search pattern named "${searchName}" already exists.\n\nDo you want to update the existing pattern with your current search criteria?\n\nThis will overwrite the previous pattern settings.`;
                
                // Use a more sophisticated confirmation with custom modal
                const shouldUpdate = await this.showConfirmModal(
                    'Update Existing Pattern',
                    `A search pattern named <strong>"${searchName}"</strong> already exists.<br><br>
                    Do you want to update the existing pattern with your current search criteria?<br><br>
                    <small class="text-warning"><i class="bi bi-exclamation-triangle"></i> This will overwrite the previous pattern settings.</small>`,
                    'Update Pattern',
                    'Cancel'
                );
                
                if (!shouldUpdate) {
                    showToast('Pattern save cancelled', 'warning');
                    return;
                }
            }

            const response = await fetch(`/api/save-search-pattern/${this.tableName}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    searchname: searchName,
                    searchdata: searchData
                })
            });

            const result = await response.json();
            
            if (result.success) {
                const actionMessage = existingPattern ? 'updated' : 'saved';
                showToast(`Pattern "${searchName}" ${actionMessage} successfully!`, 'success');
                alert(`Pattern "${searchName}" ${actionMessage} successfully!`);
                await this.loadPatterns(); // Reload patterns
                
                // Update the select to show the saved pattern
                const patternSelect = document.getElementById('search-pattern-select');
                patternSelect.value = searchName;
                this.currentPattern = result.pattern;
                
                // Enable delete button
                document.getElementById('delete-pattern-btn').disabled = false;
            } else {
                showToast(result.error || 'Error saving pattern', 'error');
                alert(result.error || 'Error saving pattern');
            }
        } catch (error) {
            console.error('Error saving pattern:', error);
            showToast('Error saving pattern', 'error');
            alert('Error saving pattern: ' + error.message);
        }
    }

    async deletePattern() {
        if (!this.currentPattern) {
            showToast('No pattern selected for deletion', 'error');
            alert('No pattern selected for deletion');
            return;
        }

        if (!confirm(`Are you sure you want to delete the pattern "${this.currentPattern.searchname}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/delete-search-pattern/${this.tableName}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    searchname: this.currentPattern.searchname
                })
            });

            const result = await response.json();
            
            if (result.success) {
                showToast(`Pattern "${this.currentPattern.searchname}" deleted successfully!`, 'success');
                alert(`Pattern "${this.currentPattern.searchname}" deleted successfully!`);
                this.currentPattern = null;
                await this.loadPatterns(); // Reload patterns
                
                // Clear the form
                document.getElementById('search-pattern-name').value = '';
                document.getElementById('search-pattern-select').value = '';
                document.getElementById('delete-pattern-btn').disabled = true;
                this.clearAllFields();
            } else {
                showToast(result.error || 'Error deleting pattern', 'error');
                alert(result.error || 'Error deleting pattern');
            }
        } catch (error) {
            console.error('Error deleting pattern:', error);
            showToast('Error deleting pattern', 'error');
            alert('Error deleting pattern: ' + error.message);
        }
    }

    collectSearchData() {
        const searchData = {
            filters: {},
            sorts: []
        };

        // Collect filters
        document.querySelectorAll('[data-field]').forEach(container => {
            const fieldName = container.dataset.field;
            const operatorSelect = container.querySelector('.operator-select');
            const valueInput = container.querySelector('.search-input');
            
            if (operatorSelect && operatorSelect.value && valueInput && valueInput.value.trim()) {
                searchData.filters[fieldName] = {
                    operator: operatorSelect.value,
                    value: valueInput.value.trim()
                };
            }
        });

        // Collect sorts
        document.querySelectorAll('[data-sort]').forEach(container => {
            const fieldSelect = container.querySelector('.sort-field-select');
            const directionSelect = container.querySelector('.sort-direction-select');
            
            if (fieldSelect && fieldSelect.value && directionSelect && directionSelect.value) {
                searchData.sorts.push({
                    field: fieldSelect.value,
                    direction: directionSelect.value
                });
            }
        });

        return searchData;
    }

    getCSRFToken() {
        const token = document.querySelector('[name=csrfmiddlewaretoken]');
        return token ? token.value : '';
    }

    showConfirmModal(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            // Create modal HTML
            const modalId = 'confirmModal';
            let modal = document.getElementById(modalId);
            
            // Remove existing modal if it exists
            if (modal) {
                modal.remove();
            }
            
            // Create new modal
            modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = modalId;
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'confirmModalLabel');
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmModalLabel">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            ${message}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="cancelBtn">${cancelText}</button>
                            <button type="button" class="btn btn-primary" id="confirmBtn">${confirmText}</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add modal to body
            document.body.appendChild(modal);
            
            // Create Bootstrap modal instance
            const bootstrapModal = new bootstrap.Modal(modal);
            
            // Add event listeners
            const confirmBtn = modal.querySelector('#confirmBtn');
            const cancelBtn = modal.querySelector('#cancelBtn');
            
            const handleConfirm = () => {
                bootstrapModal.hide();
                resolve(true);
            };
            
            const handleCancel = () => {
                bootstrapModal.hide();
                resolve(false);
            };
            
            const handleHidden = () => {
                // Clean up event listeners and remove modal
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('hidden.bs.modal', handleHidden);
                modal.remove();
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            modal.addEventListener('hidden.bs.modal', handleHidden);
            
            // Show modal
            bootstrapModal.show();
        });
    }
}

// Export for use in other modules
window.SearchPatternManager = SearchPatternManager; 