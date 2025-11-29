// Expense Tracker Application
const app = {
    // Data storage
    data: {
        loans: [],
        fixed: [],
        car: [],
        general: []
    },

    // Initialize app
    init() {
        this.loadData();
        this.renderAll();
        this.updateDashboard();
        this.populateMonthFilter();

        // Set default date inputs to today
        const today = new Date().toISOString().split('T')[0];
        document.querySelectorAll('input[type="date"]').forEach(input => {
            if (!input.value) input.value = today;
        });
    },

    // Load data from localStorage
    loadData() {
        const saved = localStorage.getItem('expenseTrackerData');
        if (saved) {
            this.data = JSON.parse(saved);
        }
    },

    // Save data to localStorage
    saveData() {
        localStorage.setItem('expenseTrackerData', JSON.stringify(this.data));
    },

    // Switch tabs
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.closest('.tab-btn').classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
    },

    // Toggle installment fields visibility
    toggleInstallmentFields(category) {
        const fieldsDiv = document.getElementById(`${category}-installment-fields`);
        const checkbox = document.getElementById(`${category}-installment-check`);
        fieldsDiv.style.display = checkbox.checked ? 'block' : 'none';
    },

    // Helper: Add months to a date
    addMonthsToDate(dateStr, months) {
        const date = new Date(dateStr + 'T00:00:00');
        const targetMonth = (date.getMonth() + months) % 12;
        const targetYear = date.getFullYear() + Math.floor((date.getMonth() + months) / 12);

        // Get the day of the original date
        const day = date.getDate();

        // Set to the first day of the target month/year
        date.setFullYear(targetYear, targetMonth, 1);

        // Get the last day of this month
        const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

        // Set to the minimum of the original day or the last day of the target month
        date.setDate(Math.min(day, lastDayOfMonth));

        return date.toISOString().split('T')[0];
    },

    // Helper: Create installments
    createInstallments(baseItem, totalInstallments, startDate, category) {
        const installments = [];
        // For loans, amount is already the installment value (manual input)
        // For other categories, we divide the total by installments
        const installmentAmount = category === 'loans' ? baseItem.amount : baseItem.amount / totalInstallments;
        const totalAmount = category === 'loans' ? baseItem.amount * totalInstallments : baseItem.amount;

        for (let i = 0; i < totalInstallments; i++) {
            const installmentDate = this.addMonthsToDate(startDate, i);
            const installment = {
                ...baseItem,
                id: Date.now() + i,
                amount: installmentAmount,
                isInstallment: true,
                installmentNumber: i + 1,
                totalInstallments: totalInstallments,
                installmentDate: installmentDate,
                parentId: baseItem.id,
                originalAmount: totalAmount
            };

            // Update date field based on category
            if (category === 'loans') {
                installment.dueDate = installmentDate;
            } else if (category === 'car' || category === 'general') {
                installment.date = installmentDate;
            }

            installments.push(installment);
        }

        return installments;
    },

    // Helper: Get monthly totals
    getMonthlyTotals(items, category) {
        const monthlyTotals = {};

        items.forEach(item => {
            let monthKey;

            // Get the appropriate date field based on category
            if (item.installmentDate) {
                monthKey = item.installmentDate.substring(0, 7);
            } else if (item.dueDate && category === 'loans') {
                monthKey = item.dueDate.substring(0, 7);
            } else if (item.date) {
                monthKey = item.date.substring(0, 7);
            } else {
                return; // Skip items without dates
            }

            if (!monthlyTotals[monthKey]) {
                monthlyTotals[monthKey] = 0;
            }

            monthlyTotals[monthKey] += item.amount;
        });

        // Convert to sorted array
        return Object.keys(monthlyTotals)
            .sort()
            .map(month => ({
                month,
                total: monthlyTotals[month]
            }));
    },

    // Helper: Render monthly summary
    renderMonthlySummary(monthlyData) {
        if (monthlyData.length === 0) return '';

        return `
            <div class="monthly-summary">
                <h3>📅 Resumo Mensal</h3>
                <div class="monthly-summary-grid">
                    ${monthlyData.map(item => `
                        <div class="month-item">
                            <span class="month-name">${this.formatMonthYear(item.month)}</span>
                            <span class="month-value">R$ ${item.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // Loans functions
    addLoan(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const loan = {
            id: Date.now(),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            type: formData.get('type'),
            interest: parseFloat(formData.get('interest')),
            dueDate: formData.get('dueDate'),
            status: formData.get('status'),
            createdAt: new Date().toISOString()
        };

        // Check if installment is enabled
        const isInstallment = formData.get('isInstallment') === 'on';

        if (isInstallment) {
            const installments = parseInt(formData.get('installments')) || 12;
            const startDate = formData.get('installmentStartDate') || new Date().toISOString().split('T')[0];

            const installmentItems = this.createInstallments(loan, installments, startDate, 'loans');
            this.data.loans.push(...installmentItems);
        } else {
            this.data.loans.push(loan);
        }

        this.saveData();
        this.renderLoans();
        this.updateDashboard();
        form.reset();
        // Reset installment fields visibility
        document.getElementById('loan-installment-fields').style.display = 'none';
    },

    renderLoans() {
        const container = document.getElementById('loans-list');

        if (this.data.loans.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💳</div>
                    <p class="empty-state-text">Nenhum empréstimo cadastrado</p>
                </div>
            `;
            return;
        }

        // Get monthly totals
        const monthlyData = this.getMonthlyTotals(this.data.loans, 'loans');

        container.innerHTML = `
            ${this.renderMonthlySummary(monthlyData)}
            <div class="items-list-wrapper">
                ${this.data.loans.map(loan => {
            // Show the installment/parcel value
            const displayAmount = loan.amount;
            const isPositive = loan.type === 'lent';

            return `
                        <div class="item">
                            <div class="item-header">
                                <span class="item-title">${loan.description}</span>
                                <span class="item-amount ${isPositive ? 'positive' : 'negative'}">
                                    ${isPositive ? '+' : '-'} R$ ${displayAmount.toFixed(2)}
                                </span>
                            </div>
                            <div class="item-details">
                                <span class="item-tag">${loan.type === 'lent' ? 'Emprestei' : 'Devo'}</span>
                                <span class="item-tag status-${loan.status}">${this.getStatusLabel(loan.status)}</span>
                                ${loan.interest > 0 ? `<span class="item-tag">Juros: ${loan.interest}%</span>` : ''}
                                ${loan.dueDate ? `<span class="item-tag">Venc: ${this.formatDate(loan.dueDate)}</span>` : ''}
                                ${loan.isInstallment ? `<span class="item-tag installment-badge">Parcela ${loan.installmentNumber} de ${loan.totalInstallments}</span>` : ''}
                                ${loan.isInstallment ? `<span class="item-tag month-badge">${this.formatMonthYear(loan.installmentDate.substring(0, 7))}</span>` : ''}
                            </div>
                            <div class="item-actions">
                                <button class="btn-danger" onclick="app.deleteItem('loans', ${loan.id})">Excluir</button>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    // Fixed expenses functions
    addFixed(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const fixed = {
            id: Date.now(),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            category: formData.get('category'),
            dueDay: parseInt(formData.get('dueDay')),
            createdAt: new Date().toISOString()
        };

        // Check if installment is enabled
        const isInstallment = formData.get('isInstallment') === 'on';

        if (isInstallment) {
            const installments = parseInt(formData.get('installments')) || 12;
            const startDate = formData.get('installmentStartDate') || new Date().toISOString().split('T')[0];

            const installmentItems = this.createInstallments(fixed, installments, startDate, 'fixed');
            this.data.fixed.push(...installmentItems);
        } else {
            this.data.fixed.push(fixed);
        }

        this.saveData();
        this.renderFixed();
        this.updateDashboard();
        form.reset();
        document.getElementById('fixed-installment-fields').style.display = 'none';
    },

    renderFixed() {
        const container = document.getElementById('fixed-list');

        if (this.data.fixed.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p class="empty-state-text">Nenhum gasto fixo cadastrado</p>
                </div>
            `;
            return;
        }

        const total = this.data.fixed.reduce((sum, item) => sum + item.amount, 0);
        const monthlyData = this.getMonthlyTotals(this.data.fixed, 'fixed');

        container.innerHTML = `
            ${this.renderMonthlySummary(monthlyData)}
            <div class="items-list-wrapper">
                ${this.data.fixed.map(item => `
                    <div class="item">
                        <div class="item-header">
                            <span class="item-title">${item.description}</span>
                            <span class="item-amount negative">R$ ${item.amount.toFixed(2)}</span>
                        </div>
                        <div class="item-details">
                            <span class="item-tag">${this.getCategoryLabel(item.category)}</span>
                            <span class="item-tag">Vencimento: dia ${item.dueDay}</span>
                            ${item.isInstallment ? `<span class="item-tag installment-badge">Parcela ${item.installmentNumber} de ${item.totalInstallments}</span>` : ''}
                            ${item.isInstallment ? `<span class="item-tag month-badge">${this.formatMonthYear(item.installmentDate.substring(0, 7))}</span>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn-danger" onclick="app.deleteItem('fixed', ${item.id})">Excluir</button>
                        </div>
                    </div>
                `).join('')}
                <div class="item" style="background: rgba(99, 102, 241, 0.1); border-color: var(--accent-1);">
                    <div class="item-header">
                        <span class="item-title">Total Mensal</span>
                        <span class="item-amount negative" style="font-size: 1.5rem;">R$ ${total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // Car expenses functions
    addCar(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const car = {
            id: Date.now(),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            category: formData.get('category'),
            date: formData.get('date'),
            mileage: formData.get('mileage') || null,
            createdAt: new Date().toISOString()
        };

        // Check if installment is enabled
        const isInstallment = formData.get('isInstallment') === 'on';

        if (isInstallment) {
            const installments = parseInt(formData.get('installments')) || 12;
            let startDate = formData.get('date');
            const startMonth = formData.get('installmentStartMonth');
            if (startMonth) {
                startDate = startMonth + '-01';
            }

            const installmentItems = this.createInstallments(car, installments, startDate, 'car');
            this.data.car.push(...installmentItems);
        } else {
            this.data.car.push(car);
        }

        this.saveData();
        this.renderCar();
        this.updateDashboard();
        form.reset();
        document.getElementById('car-installment-fields').style.display = 'none';
    },

    renderCar() {
        const container = document.getElementById('car-list');

        if (this.data.car.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <p class="empty-state-text">Nenhum gasto com carro cadastrado</p>
                </div>
            `;
            return;
        }

        // Sort by date descending
        const sorted = [...this.data.car].sort((a, b) => new Date(b.date) - new Date(a.date));
        const monthlyData = this.getMonthlyTotals(this.data.car, 'car');

        container.innerHTML = `
            ${this.renderMonthlySummary(monthlyData)}
            <div class="items-list-wrapper">
                ${sorted.map(item => `
                    <div class="item">
                        <div class="item-header">
                            <span class="item-title">${item.description}</span>
                            <span class="item-amount negative">R$ ${item.amount.toFixed(2)}</span>
                        </div>
                        <div class="item-details">
                            <span class="item-tag">${this.getCategoryLabel(item.category)}</span>
                            <span class="item-tag">${this.formatDate(item.date)}</span>
                            ${item.mileage ? `<span class="item-tag">KM: ${item.mileage}</span>` : ''}
                            ${item.isInstallment ? `<span class="item-tag installment-badge">Parcela ${item.installmentNumber} de ${item.totalInstallments}</span>` : ''}
                            ${item.isInstallment ? `<span class="item-tag month-badge">${this.formatMonthYear(item.installmentDate.substring(0, 7))}</span>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn-danger" onclick="app.deleteItem('car', ${item.id})">Excluir</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // General expenses functions
    addGeneral(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const general = {
            id: Date.now(),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            category: formData.get('category'),
            date: formData.get('date'),
            createdAt: new Date().toISOString()
        };

        // Check if installment is enabled
        const isInstallment = formData.get('isInstallment') === 'on';

        if (isInstallment) {
            const installments = parseInt(formData.get('installments')) || 12;
            let startDate = formData.get('date');
            const startMonth = formData.get('installmentStartMonth');
            if (startMonth) {
                startDate = startMonth + '-01';
            }

            const installmentItems = this.createInstallments(general, installments, startDate, 'general');
            this.data.general.push(...installmentItems);
        } else {
            this.data.general.push(general);
        }

        this.saveData();
        this.renderGeneral();
        this.updateDashboard();
        this.populateMonthFilter();
        form.reset();
        document.getElementById('general-installment-fields').style.display = 'none';
    },

    renderGeneral(filterMonth = '') {
        const container = document.getElementById('general-list');

        let filtered = this.data.general;

        if (filterMonth) {
            filtered = this.data.general.filter(item => {
                const itemMonth = item.date.substring(0, 7);
                return itemMonth === filterMonth;
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🛒</div>
                    <p class="empty-state-text">Nenhum gasto geral cadastrado</p>
                </div>
            `;
            return;
        }

        // Sort by date descending
        const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Get monthly totals for filtered items
        const monthlyData = this.getMonthlyTotals(filtered, 'general');

        // Group by month
        const grouped = {};
        sorted.forEach(item => {
            const month = item.date.substring(0, 7);
            if (!grouped[month]) grouped[month] = [];
            grouped[month].push(item);
        });

        container.innerHTML = `
            ${this.renderMonthlySummary(monthlyData)}
            <div class="items-list-wrapper">
                ${Object.keys(grouped).map(month => {
            const items = grouped[month];
            const monthTotal = items.reduce((sum, item) => sum + item.amount, 0);

            return `
                        <div style="margin-bottom: 24px;">
                            <h3 style="color: var(--text-secondary); margin-bottom: 12px; font-size: 0.875rem; text-transform: uppercase;">
                                ${this.formatMonthYear(month)} - Total: R$ ${monthTotal.toFixed(2)}
                            </h3>
                            ${items.map(item => `
                                <div class="item" style="margin-bottom: 8px;">
                                    <div class="item-header">
                                        <span class="item-title">${item.description}</span>
                                        <span class="item-amount negative">R$ ${item.amount.toFixed(2)}</span>
                                    </div>
                                    <div class="item-details">
                                        <span class="item-tag">${this.getCategoryLabel(item.category)}</span>
                                        <span class="item-tag">${this.formatDate(item.date)}</span>
                                        ${item.isInstallment ? `<span class="item-tag installment-badge">Parcela ${item.installmentNumber} de ${item.totalInstallments}</span>` : ''}
                                        ${item.isInstallment ? `<span class="item-tag month-badge">${this.formatMonthYear(item.installmentDate.substring(0, 7))}</span>` : ''}
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn-danger" onclick="app.deleteItem('general', ${item.id})">Excluir</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    filterGeneral() {
        const select = document.getElementById('month-filter');
        this.renderGeneral(select.value);
    },

    populateMonthFilter() {
        const select = document.getElementById('month-filter');
        const months = new Set();

        this.data.general.forEach(item => {
            months.add(item.date.substring(0, 7));
        });

        const sortedMonths = Array.from(months).sort().reverse();

        select.innerHTML = '<option value="">Todos os Meses</option>' +
            sortedMonths.map(month =>
                `<option value="${month}">${this.formatMonthYear(month)}</option>`
            ).join('');
    },

    // Delete item
    deleteItem(category, id) {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;

        this.data[category] = this.data[category].filter(item => item.id !== id);
        this.saveData();
        this.renderAll();
        this.updateDashboard();
    },

    // Update dashboard
    updateDashboard() {
        // Car expenses
        const carTotal = this.data.car.reduce((sum, item) => sum + item.amount, 0);

        // General expenses
        const generalTotal = this.data.general.reduce((sum, item) => sum + item.amount, 0);

        // Fixed monthly expenses
        const fixedMonthly = this.data.fixed.reduce((sum, item) => sum + item.amount, 0);

        // Loans balance (borrowed - lent) - showing MONTHLY value
        // For installments, we group by parent ID and show only one installment value
        // For regular loans, we show the total with interest
        const processedParents = new Set();
        const loansBalance = this.data.loans.reduce((sum, loan) => {
            let amount = 0;

            if (loan.isInstallment) {
                // For installments, count only once per parent (one installment value per month)
                if (!processedParents.has(loan.parentId)) {
                    processedParents.add(loan.parentId);
                    amount = loan.amount; // This is already the monthly installment value
                }
            } else {
                // For regular loans, apply interest and count the full amount
                amount = loan.amount * (1 + loan.interest / 100);
            }

            return sum + (loan.type === 'borrowed' ? -amount : amount);
        }, 0);

        // Total expenses = fixed + car + loans (absolute value)
        // Note: We use Math.abs for loans to count debts as expenses
        const totalExpenses = fixedMonthly + carTotal + Math.abs(loansBalance);

        document.getElementById('total-expenses').textContent = `R$ ${totalExpenses.toFixed(2)}`;
        document.getElementById('fixed-monthly').textContent = `R$ ${fixedMonthly.toFixed(2)}`;
        document.getElementById('car-total').textContent = `R$ ${carTotal.toFixed(2)}`;
        document.getElementById('loans-balance').textContent = `R$ ${Math.abs(loansBalance).toFixed(2)}`;
        document.getElementById('loans-balance').style.color = loansBalance >= 0 ? 'var(--success)' : 'var(--danger)';
    },

    // Render all
    renderAll() {
        this.renderLoans();
        this.renderFixed();
        this.renderCar();
        this.renderGeneral();
    },

    // Export data
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `controle-gastos-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },

    // Import data
    importData() {
        document.getElementById('import-file').click();
    },

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (confirm('Isso irá substituir todos os dados atuais. Continuar?')) {
                    this.data = imported;
                    this.saveData();
                    this.renderAll();
                    this.updateDashboard();
                    this.populateMonthFilter();
                    alert('Dados importados com sucesso!');
                }
            } catch (error) {
                alert('Erro ao importar dados. Verifique o arquivo.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    // Helper functions
    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('pt-BR');
    },

    formatMonthYear(monthStr) {
        const [year, month] = monthStr.split('-');
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${months[parseInt(month) - 1]} ${year}`;
    },

    getStatusLabel(status) {
        const labels = {
            pending: 'Pendente',
            paid: 'Pago',
            overdue: 'Atrasado'
        };
        return labels[status] || status;
    },

    getCategoryLabel(category) {
        const labels = {
            // Fixed
            rent: 'Aluguel',
            internet: 'Internet',
            phone: 'Telefone',
            utilities: 'Contas',
            subscription: 'Assinaturas',
            // Car
            fuel: 'Combustível',
            maintenance: 'Manutenção',
            insurance: 'Seguro',
            taxes: 'Impostos',
            repairs: 'Reparos',
            // General
            food: 'Alimentação',
            transport: 'Transporte',
            health: 'Saúde',
            entertainment: 'Lazer',
            education: 'Educação',
            clothing: 'Vestuário',
            shopping: 'Compras',
            other: 'Outros'
        };
        return labels[category] || category;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());
