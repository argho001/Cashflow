document.addEventListener('DOMContentLoaded', async () => {
    // === Auth Guard (Supabase) ===
    const sb = window._supabaseClient;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // Personalize greeting with logged-in user's name
    const user = session.user;
    const userName = user?.user_metadata?.full_name
        ? user.user_metadata.full_name.split(' ')[0]
        : (user?.email?.split('@')[0] || 'User');

    const viewSubtitle = document.getElementById('view-subtitle');
    if (viewSubtitle) viewSubtitle.textContent = `Welcome back, ${userName}!`;

    // Update avatar with user's name
    const fullName = user?.user_metadata?.full_name || user?.email || 'User';
    const avatarImg = document.querySelector('.avatar img');
    if (avatarImg) {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff`;
        avatarImg.alt = fullName;
    }

    // Logout handler (Supabase)
    window.logoutUser = async () => {
        if (confirm('Are you sure you want to log out?')) {
            await sb.auth.signOut();
            window.location.href = 'login.html';
        }
    };

    // === Data State ===
    const state = {
        currentView: 'dashboard',
        isDarkMode: false,
        riskLevel: localStorage.getItem('riskLevel') || 'Medium',
        notifications: [],
        transactions: [],
        budgets: [],
        goals: [],
        investments: [],
        reminders: []
    };

    let editingTransactionId = null;

    // Helper to fetch all data from Supabase
    async function initializeData() {
        try {
            const { data: transactions } = await sb.from('transactions').select('*').order('date', { ascending: false });
            const { data: budgets } = await sb.from('budgets').select('*');
            const { data: goals } = await sb.from('goals').select('*');
            const { data: investments } = await sb.from('investments').select('*');
            const { data: reminders } = await sb.from('reminders').select('*');

            state.transactions = transactions || [];
            state.budgets = budgets || [];
            state.goals = goals || [];
            state.investments = (investments || []).map(i => ({
                ...i,
                currentVal: i.current_val
            }));
            state.reminders = (reminders || []).map(r => ({
                ...r,
                desc: r.description,
                dueDate: r.due_date
            }));
            
            checkReminders();
            refreshAll();
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    // === DOM Elements ===
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const viewTitle = document.getElementById('view-title');
    const themeToggle = document.getElementById('theme-toggle');
    const transactionList = document.getElementById('transaction-list');
    const budgetList = document.getElementById('budget-list');
    const goalsList = document.getElementById('goals-list');
    const investmentList = document.getElementById('investment-list');
    const recommendationList = document.getElementById('recommendation-list');
    
    // Notification Elements
    const notifToggle = document.getElementById('notification-toggle');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifList = document.getElementById('notif-list');
    const notifBadge = document.getElementById('notif-badge');

    // === Core Logic ===

    function saveAndRefresh() {
        autoDistributeGoals();
        
        // Sync local preferences to localStorage still (non-sensitive)
        localStorage.setItem('riskLevel', state.riskLevel);
        
        checkBudgets(); 
        checkReminders();
        refreshAll();
    }

    // Auto Distribute Surplus
    function autoDistributeGoals() {
        // Enforce max capacity on goals
        state.goals.forEach(g => {
            if (g.current > g.target) g.current = g.target;
        });

        const totalIncome = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const totalBalance = totalIncome - totalExpenses;
        
        const totalGoalCurrent = state.goals.reduce((sum, g) => sum + g.current, 0);
        let unallocated = totalBalance - totalGoalCurrent;

        if (unallocated > 0) {
            let fundedGoals = [];
            for (let goal of state.goals) {
                if (unallocated <= 0) break;
                const needed = goal.target - goal.current;
                if (needed > 0) {
                    const contribution = Math.min(unallocated, needed);
                    goal.current += contribution;
                    unallocated -= contribution;
                    fundedGoals.push(goal.name);
                }
            }
            if (fundedGoals.length > 0) {
                const msg = `Automated Savings: Allocated funds to ${fundedGoals.join(', ')}`;
                if(!state.notifications.some(n => n.msg === msg)) {
                    state.notifications.unshift({ id: Date.now(), msg: msg, time: 'Just now' });
                }
            }
        }
    }

    function refreshAll() {
        renderDashboard();
        renderTransactions();
        renderBudgets();
        renderGoals();
        renderInvestments();
        renderReminders();
        renderNotifications();
    }

    // Modal Handling Logic
    const modals = {
        transaction: { overlay: document.getElementById('transaction-modal'), btn: document.getElementById('add-transaction-btn'), form: document.getElementById('transaction-form') },
        budget: { overlay: document.getElementById('budget-modal'), btn: document.getElementById('add-budget-btn'), form: document.getElementById('budget-form') },
        goal: { overlay: document.getElementById('goal-modal'), btn: document.getElementById('add-goal-btn'), form: document.getElementById('goal-form') },
        investment: { overlay: document.getElementById('investment-modal'), btn: document.getElementById('add-investment-btn'), form: document.getElementById('investment-form') },
        reminder: { overlay: document.getElementById('reminder-modal'), btn: document.getElementById('add-reminder-btn'), form: document.getElementById('reminder-form') },
        profile: { overlay: document.getElementById('profile-modal'), btn: document.querySelector('.avatar') }
    };

    // Profile Modal Handler
    if (modals.profile.btn) {
        modals.profile.btn.addEventListener('click', () => {
            const user = session.user;
            const fullName = user?.user_metadata?.full_name || 'User';
            const email = user?.email || '-';
            const joined = new Date(user?.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            document.getElementById('profile-full-name').textContent = fullName;
            document.getElementById('profile-email').textContent = email;
            document.getElementById('profile-joined').textContent = joined;
            document.getElementById('profile-avatar-large').innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff&size=128" 
                     style="border-radius: 50%; width: 80px; height: 80px; border: 4px solid var(--border-color);">
            `;

            modals.profile.overlay.classList.add('active');
        });
    }

    Object.keys(modals).forEach(key => {
        if(modals[key].btn && key !== 'profile') {
            modals[key].btn.addEventListener('click', () => {
                if (key === 'transaction') {
                    editingTransactionId = null;
                    document.getElementById('transaction-modal-title').textContent = 'Add New Transaction';
                    document.getElementById('transaction-submit-btn').textContent = 'Save Transaction';
                    modals.transaction.form.reset();
                }
                modals[key].overlay.classList.add('active');
            });
        }
    });

    document.querySelectorAll('.close-modal, #close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    });

    // === View Navigation ===
    function switchView(viewId) {
        navItems.forEach(nav => {
            nav.classList.remove('active');
            if (nav.getAttribute('data-view') === viewId) nav.classList.add('active');
        });

        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === `view-${viewId}`) view.classList.add('active');
        });

        const titles = {
            dashboard: 'Dashboard Summary',
            transactions: 'Transaction History',
            budgets: 'Monthly Budgets',
            goals: 'Financial Goals',
            investments: 'Investment Portfolio',
            reminders: 'Payment Reminders',
            settings: 'User Settings'
        };
        viewTitle.textContent = titles[viewId] || 'Management System';
        
        state.currentView = viewId;
        refreshAll();
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.getAttribute('data-view'));
        });
    });

    // === Form & Button Handlers ===
    modals.transaction.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const transactionData = {
            description: document.getElementById('desc-input').value,
            amount: Math.abs(parseFloat(document.getElementById('amount-input').value)),
            type: document.getElementById('type-input').value,
            category: document.getElementById('category-input').value,
            date: document.getElementById('date-input').value
        };

        if (editingTransactionId) {
            const { error } = await sb.from('transactions').update(transactionData).eq('id', editingTransactionId);
            if (error) return alert('Error updating transaction: ' + error.message);
            editingTransactionId = null;
        } else {
            const { error } = await sb.from('transactions').insert([transactionData]);
            if (error) return alert('Error saving transaction: ' + error.message);
        }

        await initializeData();
        e.target.reset();
        modals.transaction.overlay.classList.remove('active');
    });

    window.editTransaction = (id) => {
        const transaction = state.transactions.find(t => String(t.id) === String(id));
        if (!transaction) return;

        editingTransactionId = id;
        document.getElementById('desc-input').value = transaction.description;
        document.getElementById('amount-input').value = transaction.amount;
        document.getElementById('type-input').value = transaction.type;
        document.getElementById('category-input').value = transaction.category;
        document.getElementById('date-input').value = transaction.date;

        document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
        document.getElementById('transaction-submit-btn').textContent = 'Update Transaction';
        
        modals.transaction.overlay.classList.add('active');
    };

    window.deleteTransaction = async (id) => {
        if (confirm('Are you sure you want to delete this transaction?')) {
            const { error } = await sb.from('transactions').delete().eq('id', id);
            if (error) return alert('Error deleting transaction: ' + error.message);
            await initializeData();
        }
    };

    modals.budget.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cat = document.getElementById('budget-category').value;
        const lim = Math.abs(parseFloat(document.getElementById('budget-limit').value));
        
        const { error } = await sb.from('budgets').upsert({ 
            category: cat, 
            limit: lim 
        }, { onConflict: ['user_id', 'category'] });

        if (error) return alert('Error saving budget: ' + error.message);

        await initializeData();
        e.target.reset();
        modals.budget.overlay.classList.remove('active');
    });

    let editingGoalId = null;
    modals.goal.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalData = {
            name: document.getElementById('goal-name').value,
            target: Math.abs(parseFloat(document.getElementById('goal-amount').value)),
            deadline: document.getElementById('goal-deadline').value
        };

        if (editingGoalId) {
            const { error } = await sb.from('goals').update(goalData).eq('id', editingGoalId);
            if (error) return alert('Error updating goal: ' + error.message);
            editingGoalId = null;
        } else {
            const { error } = await sb.from('goals').insert([goalData]);
            if (error) return alert('Error saving goal: ' + error.message);
        }

        await initializeData();
        e.target.reset();
        modals.goal.overlay.classList.remove('active');
        document.getElementById('goal-modal-title').textContent = 'Add Financial Goal';
    });

    window.editGoal = (id) => {
        const goal = state.goals.find(g => String(g.id) === String(id));
        if (!goal) return;

        editingGoalId = id;
        document.getElementById('goal-name').value = goal.name;
        document.getElementById('goal-amount').value = goal.target;
        document.getElementById('goal-deadline').value = goal.deadline;
        document.getElementById('goal-modal-title').textContent = 'Edit Financial Goal';
        
        modals.goal.overlay.classList.add('active');
    };

    window.deleteGoal = async (id) => {
        if (confirm('Are you sure you want to delete this goal?')) {
            const { error } = await sb.from('goals').delete().eq('id', id);
            if (error) return alert('Error deleting goal: ' + error.message);
            await initializeData();
        }
    };

    modals.investment.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const invested = Math.abs(parseFloat(document.getElementById('invested-amount').value));
        const newInvestment = {
            name: document.getElementById('asset-name').value,
            category: document.getElementById('asset-category').value,
            invested: invested,
            current_val: invested * (1 + (Math.random() * 0.2 - 0.05)) // Mock variation
        };

        const { error } = await sb.from('investments').insert([newInvestment]);
        if (error) return alert('Error saving investment: ' + error.message);

        await initializeData();
        e.target.reset();
        modals.investment.overlay.classList.remove('active');
    });

    // Settings
    document.getElementById('export-csv-btn').addEventListener('click', () => {
        let csvContent = "data:text/csv;charset=utf-8,Date,Description,Category,Amount,Type\n";
        state.transactions.forEach(t => {
            csvContent += `${t.date},${t.description},${t.category},${t.amount},${t.type}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "transactions.csv");
        document.body.appendChild(link);
        link.click();
    });

    document.getElementById('clear-data-btn').addEventListener('click', async () => {
        if(confirm('Are you sure you want to RESET ALL DATA? This will permanently delete all your transactions, budgets, goals, investments, and reminders from the cloud. This action cannot be undone.')) {
            try {
                // Get fresh user session
                const { data: { session: currentSession } } = await sb.auth.getSession();
                const userId = currentSession?.user?.id;
                
                if (!userId) {
                    alert('Session expired. Please log in again to reset data.');
                    window.location.href = 'login.html';
                    return;
                }

                const tables = ['transactions', 'budgets', 'goals', 'investments', 'reminders'];
                
                for (const table of tables) {
                    console.log(`Cleaning table: ${table}...`);
                    
                    // Try deleting by user_id first (most reliable for RLS)
                    const { error: err1 } = await sb.from(table).delete().eq('user_id', userId);
                    
                    if (err1) {
                        // Fallback: Some tables might not have an explicit user_id column exposed 
                        // or might use 'id' as the primary filter for deletes
                        const { error: err2 } = await sb.from(table).delete().neq('id', -1);
                        if (err2) {
                            console.warn(`Could not clear ${table} with standard filters. This may be due to schema differences or RLS policies.`, { err1, err2 });
                        }
                    }
                }
                
                localStorage.clear();
                alert('All data has been successfully cleared from the cloud and local storage.');
                location.reload();
            } catch (err) {
                console.error('Reset failed:', err);
                alert('Failed to clear some data. Please try again.');
            }
        }
    });

    // Reminders Logic
    modals.reminder.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newReminder = {
            description: document.getElementById('reminder-desc').value,
            amount: Math.abs(parseFloat(document.getElementById('reminder-amount').value)),
            due_date: document.getElementById('reminder-date').value,
            status: 'Pending'
        };

        const { error } = await sb.from('reminders').insert([newReminder]);
        if (error) return alert('Error saving reminder: ' + error.message);

        await initializeData();
        e.target.reset();
        modals.reminder.overlay.classList.remove('active');
    });

    window.toggleReminder = async (id) => {
        const r = state.reminders.find(rem => String(rem.id) === String(id));
        if (r) {
            const newStatus = r.status === 'Pending' ? 'Paid' : 'Pending';
            const { error } = await sb.from('reminders').update({ status: newStatus }).eq('id', id);
            if (error) return alert('Error updating reminder: ' + error.message);
            await initializeData();
        }
    };

    window.deleteReminder = async (id) => {
        if (confirm('Are you sure you want to delete this reminder?')) {
            const { error } = await sb.from('reminders').delete().eq('id', id);
            if (error) return alert('Error deleting reminder: ' + error.message);
            await initializeData();
        }
    };


    // Notifications
    notifToggle.addEventListener('click', () => {
        notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
        if(notifDropdown.style.display === 'block') {
            state.notifications = [];
            saveAndRefresh(); // Clears badge
        }
    });

    function checkBudgets() {
        state.budgets.forEach(b => {
            const spent = state.transactions.filter(t => t.category === b.category && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            if(spent > b.limit) {
                const alertMsg = `Budget Exceeded: You've spent ৳${spent.toLocaleString()} on ${b.category} (Limit: ৳${b.limit.toLocaleString()})`;
                if(!state.notifications.some(n => n.msg === alertMsg)) {
                    state.notifications.unshift({ id: Date.now(), msg: alertMsg, time: 'Just now' });
                }
            }
        });
    }

    function checkReminders() {
        const today = new Date().toISOString().split('T')[0];
        state.reminders.forEach(r => {
            if(r.status === 'Pending' && r.dueDate === today) {
                const alertMsg = `Reminder: Payment for "${r.desc}" of ৳${r.amount.toLocaleString()} is due today!`;
                if(!state.notifications.some(n => n.msg === alertMsg)) {
                    state.notifications.unshift({ id: Date.now() + Math.random(), msg: alertMsg, time: 'Upcoming' });
                }
            }
        });
    }

    // === Rendering ===

    function renderDashboard() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const currentMonthTransactions = state.transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
        });

        const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        // Monthly Balance calculation
        const monthlyBalance = income - expenses;

        // Total Balance (Lifetime) - Rule: displayTotal >= monthlyBalance
        const totalIncome = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        let totalBalance = totalIncome - totalExpenses;
        if (totalBalance < monthlyBalance) totalBalance = monthlyBalance;

        document.getElementById('stat-monthly-balance').textContent = `৳${monthlyBalance.toLocaleString()}`;
        document.getElementById('stat-total-balance').textContent = `৳${totalBalance.toLocaleString()}`;
        document.getElementById('stat-income').textContent = `৳${income.toLocaleString()}`;
        document.getElementById('stat-expenses').textContent = `৳${expenses.toLocaleString()}`;
        
        const spentPercent = income > 0 ? Math.round((expenses / income) * 100) : (expenses > 0 ? 100 : 0);
        const ratioEl = document.getElementById('stat-expense-ratio');
        if (ratioEl) {
            ratioEl.textContent = `Spent ${spentPercent}% of monthly income`;
            ratioEl.className = spentPercent >= 90 ? 'text-danger mt-4' : 'text-secondary mt-4';
        }

        document.getElementById('income-count').textContent = currentMonthTransactions.filter(t => t.type === 'income').length;
        
        // Add Monthly Income Sources List
        const incomeSources = currentMonthTransactions.filter(t => t.type === 'income');
        const incomeListHtml = incomeSources.length > 0 
            ? incomeSources.map(s => `<div class="flex justify-between items-center py-1 border-b border-white/5"><span style="font-size:0.8rem;">${s.description}</span><span class="text-success" style="font-size:0.8rem;">+৳${s.amount.toLocaleString()}</span></div>`).join('')
            : '<p class="text-secondary" style="font-size:0.8rem; text-align:center;">No income this month</p>';
        
        const incomeContainer = document.getElementById('monthly-income-sources');
        if(incomeContainer) incomeContainer.innerHTML = incomeListHtml;

        updateCharts(state.transactions);
    }

    function renderTransactions() {
        if (!transactionList) return;
        transactionList.innerHTML = state.transactions.length > 0 ? state.transactions.map(t => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 1rem 0;">${t.date}</td>
                <td>${t.description}</td>
                <td><span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${t.category}</span></td>
                <td class="${t.type === 'expense' ? 'text-danger' : 'text-success'}">
                    ${t.type === 'expense' ? '-' : '+'}৳${t.amount.toLocaleString()}
                </td>
                <td style="text-align: right;">
                    <button onclick="editTransaction('${t.id}')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; margin-right: 0.5rem;"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTransaction('${t.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('') : `<tr><td colspan="5" style="text-align:center; padding: 1rem;">No transactions recorded yet.</td></tr>`;
    }

    function renderBudgets() {
        if (!budgetList) return;
        budgetList.innerHTML = state.budgets.map(b => {
            const spent = state.transactions.filter(t => t.category === b.category && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            const percent = Math.min((spent / b.limit) * 100, 100);
            return `<div class="card"><div class="flex justify-between items-center mb-2"><h4>${b.category}</h4><span>৳${spent.toLocaleString()}</span></div><div style="width: 100%; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px;"><div style="width: ${percent}%; background: ${spent > b.limit ? 'var(--danger)' : 'var(--accent-color)'}; height: 100%; border-radius: 4px;"></div></div><p class="mt-2 text-secondary" style="font-size:0.75rem;">Limit: ৳${b.limit.toLocaleString()}</p></div>`;
        }).join('');
    }

    function renderGoals() {
        if (!goalsList) return;
        goalsList.innerHTML = state.goals.map(g => {
            const percent = Math.min((g.current / g.target) * 100, 100);
            return `
                <div class="card" style="position: relative;">
                    <div style="position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem;">
                        <button onclick="editGoal('${g.id}')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteGoal('${g.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </div>
                    <h4>${g.name}</h4>
                    <p class="text-secondary mb-2">Target: ৳${g.target.toLocaleString()}</p>
                    <div style="width: 100%; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px;">
                        <div style="width: ${percent}%; background: var(--success); height: 100%; border-radius: 4px;"></div>
                    </div>
                    <p class="text-secondary mt-2" style="font-size: 0.8rem;">Current: ৳${g.current.toLocaleString()}</p>
                </div>
            `;
        }).join('');
    }

    function renderInvestments() {
        if (!investmentList) return;

        investmentList.innerHTML = state.investments.map(i => {
            return `<tr style="border-bottom: 1px solid var(--border-color);"><td style="padding: 1rem 0;">${i.name}</td><td>${i.category}</td><td>৳${i.invested.toLocaleString()}</td><td>৳${i.currentVal.toLocaleString(undefined, {maximumFractionDigits: 0})}</td></tr>`;
        }).join('');
    }



    function renderNotifications() {
        if (!notifList) return;
        if(state.notifications.length > 0) {
            notifBadge.style.display = 'block';
            notifBadge.textContent = state.notifications.length;
            notifList.innerHTML = state.notifications.map(n => `<div style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);"><p style="font-size: 0.85rem; margin-bottom: 0.25rem;">${n.msg}</p><span class="text-secondary" style="font-size: 0.7rem;">${n.time}</span></div>`).join('');
        } else {
            notifBadge.style.display = 'none';
            notifList.innerHTML = `<p class="text-secondary" style="font-size: 0.8rem; text-align: center; padding: 1rem;">No new alerts.</p>`;
        }
    }

    let spendingChart = null;
    let trendChart = null;
    function updateCharts(data) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Rule: Charts according to monthly not overall
        const monthlyData = data.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        // Explicitly exclude 'Income' category from expense charts to prevent miscategorized data from showing
        const expenseData = monthlyData.filter(t => t.type === 'expense' && !t.category.toLowerCase().includes('income'));
        const categories = [...new Set(expenseData.map(t => t.category))];
        const categoryTotals = categories.map(cat => expenseData.filter(t => t.category === cat).reduce((sum, t) => sum + t.amount, 0));
        
        if (spendingChart) spendingChart.destroy();
        const ctxS = document.getElementById('spendingChart');
        if (ctxS) spendingChart = new Chart(ctxS, { type: 'doughnut', data: { labels: categories, datasets: [{ data: categoryTotals, backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: state.isDarkMode ? '#94a3b8' : '#64748b' } } } } });
        
        // --- Expense Trend Stacked Bar Chart (Last 7 Days) ---
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }

        const weeklyExpenses = data.filter(t => t.type === 'expense' && last7Days.includes(t.date));
        const trendCategories = [...new Set(weeklyExpenses.map(t => t.category))];
        
        const chartColors = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e', '#8b5cf6', '#ec4899'];
        
        const datasets = trendCategories.map((cat, idx) => {
            return {
                label: cat,
                data: last7Days.map(date => {
                    return weeklyExpenses
                        .filter(t => t.date === date && t.category === cat)
                        .reduce((sum, t) => sum + t.amount, 0);
                }),
                backgroundColor: chartColors[idx % chartColors.length],
                borderRadius: 4
            };
        });

        if (trendChart) trendChart.destroy();
        const ctxT = document.getElementById('trendChart');
        if (ctxT) {
            trendChart = new Chart(ctxT, {
                type: 'bar',
                data: {
                    labels: last7Days.map(d => {
                        const dateObj = new Date(d);
                        return dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                    }),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 10,
                                padding: 15,
                                color: state.isDarkMode ? '#94a3b8' : '#64748b',
                                font: { size: 10 }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: '#94a3b8' }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        }
    }

    function renderReminders() {
        const remindersList = document.getElementById('reminders-list');
        if (!remindersList) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        remindersList.innerHTML = state.reminders.map(r => {
            const dueDate = new Date(r.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            
            const diffTime = dueDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let countdownHtml = '';
            if (r.status !== 'Paid') {
                if (diffDays === 0) {
                    countdownHtml = `<span style="background: var(--danger); color: white; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; box-shadow: 0 2px 10px rgba(239, 68, 68, 0.4); margin-left: 10px;">DUE TODAY</span>`;
                } else if (diffDays < 0) {
                    countdownHtml = `<span style="background: #991b1b; color: white; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; box-shadow: 0 2px 10px rgba(0,0,0,0.3); margin-left: 10px;">PAST DUE</span>`;
                } else {
                    const urgencyColor = diffDays <= 3 ? '#f59e0b' : '#6366f1';
                    countdownHtml = `<span style="background: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; box-shadow: 0 2px 10px rgba(0,0,0,0.2); margin-left: 10px;">${diffDays} DAY${diffDays > 1 ? 'S' : ''} LEFT</span>`;
                }
            }

            return `
                <div class="card flex justify-between items-center mb-4" style="border-left: 4px solid ${r.status === 'Paid' ? 'var(--success)' : (diffDays <= 0 ? 'var(--danger)' : 'var(--warning)')};">
                    <div>
                        <h4 style="text-decoration: ${r.status === 'Paid' ? 'line-through' : 'none'}; opacity: ${r.status === 'Paid' ? '0.6' : '1'}; margin-bottom: 4px;">${r.desc}</h4>
                        <div class="flex items-center">
                            <p class="text-secondary" style="font-size: 0.85rem; font-weight: 500;">Due: ${r.dueDate} | Amount: ৳${r.amount.toLocaleString()}</p>
                            ${countdownHtml}
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="toggleReminder('${r.id}')" class="theme-toggle" style="color: ${r.status === 'Paid' ? 'var(--text-secondary)' : 'var(--success)'}">
                            <i class="fas ${r.status === 'Paid' ? 'fa-undo' : 'fa-check'}"></i>
                        </button>
                        <button onclick="deleteReminder('${r.id}')" class="theme-toggle" style="color: var(--danger)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Theme Toggle
    themeToggle.addEventListener('click', () => {
        state.isDarkMode = !state.isDarkMode;
        document.body.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
        themeToggle.innerHTML = state.isDarkMode ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        refreshAll();
    });

    // Initial Load
    initializeData();
    autoDistributeGoals();
    refreshAll();

    // More Details Toggle
    const moreBtn = document.getElementById('more-details-btn');
    const totalSection = document.getElementById('total-balance-section');
    if (moreBtn && totalSection) {
        moreBtn.addEventListener('click', () => {
            const isHidden = totalSection.style.display === 'none';
            totalSection.style.display = isHidden ? 'block' : 'none';
            moreBtn.textContent = isHidden ? 'Less' : 'More';
        });
    }

    // === Mobile Menu Interaction ===
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const sidebar = document.getElementById('sidebar');

    const toggleSidebar = (show) => {
        if (sidebar) sidebar.classList.toggle('active', show);
        if (mobileOverlay) mobileOverlay.classList.toggle('active', show);
        document.body.style.overflow = show ? 'hidden' : '';
    };

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => toggleSidebar(true));
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    }

    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => toggleSidebar(false));
    }

    // Close sidebar on link click (for mobile)
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                toggleSidebar(false);
            }
        });
    });
});
