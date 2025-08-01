// crud.js
// Handles AJAX CRUD operations for the dynamic grid

export async function createRecord(tableName, formData) {
    const res = await fetch(`/api/create/${tableName}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });
    return res.json();
}

export async function updateRecord(tableName, recordId, formData) {
    try {
        const res = await fetch(`/api/update/${tableName}/${recordId}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Update failed:', res.status, errorData);
            return { error: errorData.error || `HTTP ${res.status}: ${res.statusText}` };
        }
        
        return await res.json();
    } catch (error) {
        console.error('Network error during update:', error);
        return { error: 'Network error. Please check your connection and try again.' };
    }
}

export async function deleteRecords(tableName, ids) {
    const res = await fetch(`/api/delete/${tableName}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
    });
    return res.json();
}

export async function searchRecords(tableName, searchData) {
    const res = await fetch(`/api/search/${tableName}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData)
    });
    return res.json();
}

export async function resetGrid(tableName) {
    const res = await fetch(`/api/reset-grid/${tableName}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
} 