// Password visibility toggle for login and register forms
function togglePassword(id, btn) {
    var pwd = document.getElementById(id);
    var icon = btn.querySelector('i');
    if (pwd.type === 'password') {
        pwd.type = 'text';
        if (icon) { icon.classList.remove('bi-eye'); icon.classList.add('bi-eye-slash'); }
    } else {
        pwd.type = 'password';
        if (icon) { icon.classList.remove('bi-eye-slash'); icon.classList.add('bi-eye'); }
    }
}
// For login form (single password field)
function toggleLoginPassword(btn) {
    togglePassword('id_password', btn);
} 