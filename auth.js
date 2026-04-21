/**
 * Cashflow – Authentication Module (Supabase)
 * Uses Supabase Auth for signup, login, and session management.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const sb = window._supabaseClient;

    // ── State ──
    let isDarkMode = false;

    // ── DOM Refs ──
    const tabs = document.querySelectorAll('.auth-tab');
    const panels = document.querySelectorAll('.auth-panel');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const themeToggle = document.getElementById('auth-theme-toggle');
    const toast = document.getElementById('auth-toast');
    const toastMsg = document.getElementById('auth-toast-msg');
    const passwordToggles = document.querySelectorAll('.auth-password-toggle');

    // Strength meter
    const signupPassword = document.getElementById('signup-password');
    const strengthBars = [
        document.getElementById('str-bar-1'),
        document.getElementById('str-bar-2'),
        document.getElementById('str-bar-3'),
        document.getElementById('str-bar-4')
    ];
    const strengthText = document.getElementById('strength-text');

    // ── Redirect if already logged in ──
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        window.location.href = 'index.html';
        return;
    }

    // ── Helpers ──

    function showToast(message, type = 'success') {
        const icon = toast.querySelector('i');
        icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        toast.className = 'auth-toast ' + type;
        toastMsg.textContent = message;
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3200);
    }

    function setLoading(btn, loading) {
        if (loading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>&nbsp; Please wait…';
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.innerHTML = btn.dataset.originalText;
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // ── Tab Switching ──
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            panels.forEach(p => {
                p.classList.remove('active');
                if (p.id === `panel-${target}`) {
                    p.classList.add('active');
                }
            });
        });
    });

    // ── Password Visibility Toggle ──
    passwordToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // ── Password Strength Meter ──
    function evaluateStrength(password) {
        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 10) score++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return Math.min(score, 4);
    }

    function updateStrengthMeter(score) {
        const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['', 'weak', 'medium', 'medium', 'strong'];

        strengthBars.forEach((bar, i) => {
            bar.className = 'auth-strength-bar';
            if (i < score) {
                bar.classList.add(colors[score]);
            }
        });

        if (score === 0) {
            strengthText.textContent = '';
            strengthText.style.color = '';
        } else {
            strengthText.textContent = labels[score];
            const textColors = { weak: 'var(--danger)', medium: 'var(--warning)', strong: 'var(--success)' };
            strengthText.style.color = textColors[colors[score]];
        }
    }

    if (signupPassword) {
        signupPassword.addEventListener('input', () => {
            const score = evaluateStrength(signupPassword.value);
            updateStrengthMeter(score);
        });
    }

    // ── Login Form (Supabase Auth) ──
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('login-submit');

        if (!email || !password) {
            showToast('Please fill in all fields.', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('Please enter a valid email address.', 'error');
            return;
        }

        setLoading(submitBtn, true);

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            setLoading(submitBtn, false);
            showToast(error.message || 'Invalid email or password.', 'error');
            return;
        }

        const userName = data.user?.user_metadata?.full_name || email.split('@')[0];
        showToast(`Welcome back, ${userName}!`, 'success');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    });

    // ── Signup Form (Supabase Auth) ──
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        const submitBtn = document.getElementById('signup-submit');

        if (!name || !email || !password || !confirm) {
            showToast('Please fill in all fields.', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('Please enter a valid email address.', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Password must be at least 6 characters.', 'error');
            return;
        }

        if (password !== confirm) {
            showToast('Passwords do not match.', 'error');
            return;
        }

        setLoading(submitBtn, true);

        const { data, error } = await sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (error) {
            setLoading(submitBtn, false);
            showToast(error.message || 'Signup failed. Please try again.', 'error');
            return;
        }

        // Check if email confirmation is required
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            setLoading(submitBtn, false);
            showToast('An account with this email already exists.', 'error');
            return;
        }

        showToast('Account created successfully!', 'success');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    });

    // ── Forgot Password ──
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            if (email && isValidEmail(email)) {
                const { error } = await sb.auth.resetPasswordForEmail(email);
                if (error) {
                    showToast(error.message, 'error');
                } else {
                    showToast('Password reset link sent to ' + email, 'success');
                }
            } else {
                showToast('Enter your email above first.', 'error');
            }
        });
    }

    // ── Theme Toggle ──
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        themeToggle.innerHTML = isDarkMode
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    });
});
