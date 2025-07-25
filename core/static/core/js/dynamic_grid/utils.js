// utils.js
// Utility functions for dynamic grid

export function formatDateYMDToMDY(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    const [year, month, day] = ymd.split('-');
    return `${month}/${day}/${year}`;
}

export function showToast(message, type = 'success') {
    const toastEl = document.getElementById('grid-toast');
    const toastBody = document.getElementById('grid-toast-body');
    if (!toastEl || !toastBody) return;
    toastBody.textContent = message;
    toastEl.classList.remove('text-bg-success', 'text-bg-danger');
    toastEl.classList.add(type === 'success' ? 'text-bg-success' : 'text-bg-danger');
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
    toast.show();
} 