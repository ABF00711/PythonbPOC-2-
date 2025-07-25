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
    const res = await fetch(`/api/update/${tableName}/${recordId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });
    return res.json();
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