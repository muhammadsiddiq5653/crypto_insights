// Utility functions for the Crypto Trading Portal

// Format currency (USD)
function formatCurrency(value) {
    if (value === null || value === undefined) return '$0.00';

    if (value >= 1) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    } else {
        // For values less than $1, show more decimal places
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(value);
    }
}

// Format large numbers (market cap, volume)
function formatLargeNumber(value) {
    if (value === null || value === undefined) return '0';

    if (value >= 1e12) {
        return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
        return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
        return `$${(value / 1e3).toFixed(2)}K`;
    } else {
        return formatCurrency(value);
    }
}

// Format percentage
function formatPercentage(value) {
    if (value === null || value === undefined) return '0.00%';

    const formatted = Math.abs(value).toFixed(2);
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${formatted}%`;
}

// Format date/time
function formatDate(date) {
    if (!date) return '';

    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

// Format full date and time
function formatDateTime(date) {
    if (!date) return '';

    const d = new Date(date);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// API request helper
async function apiRequest(endpoint) {
    try {
        const response = await fetch(`http://localhost:3000${endpoint}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'API request failed');
        }

        return data.data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Show loading state
function showLoading(element) {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element) {
        element.innerHTML = '<div class="loading">Loading...</div>';
    }
}

// Show error message
function showError(element, message) {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element) {
        element.innerHTML = `
      <div class="info-message">
        <span class="info-icon">⚠️</span>
        <p>${message}</p>
      </div>
    `;
    }
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get signal color class
function getSignalClass(signal) {
    const signalLower = signal.toLowerCase();
    if (signalLower.includes('buy')) return 'buy';
    if (signalLower.includes('sell')) return 'sell';
    return 'hold';
}

// Get change color class
function getChangeClass(value) {
    return value >= 0 ? 'positive' : 'negative';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatCurrency,
        formatLargeNumber,
        formatPercentage,
        formatDate,
        formatDateTime,
        apiRequest,
        showLoading,
        showError,
        debounce,
        getSignalClass,
        getChangeClass,
        escapeHtml
    };
}
