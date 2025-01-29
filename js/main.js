// Mobile menu functionality
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        });
    }
});

// Local Storage Management
const StorageManager = {
    setItem: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
    },

    getItem: function(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return null;
        }
    },

    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Error removing from localStorage:', e);
            return false;
        }
    }
};

// User Session Management
const SessionManager = {
    createSession: function(userType, userData) {
        const session = {
            userType: userType,
            userData: userData,
            timestamp: new Date().getTime()
        };
        return StorageManager.setItem('currentSession', session);
    },

    getSession: function() {
        return StorageManager.getItem('currentSession');
    },

    endSession: function() {
        return StorageManager.removeItem('currentSession');
    },

    isLoggedIn: function() {
        const session = this.getSession();
        return session !== null;
    }
};

// Form Validation
const FormValidator = {
    validateEmail: function(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePhone: function(phone) {
        const re = /^[0-9]{10}$/;
        return re.test(phone);
    },

    validatePassword: function(password) {
        return password.length >= 8;
    },

    showError: function(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.color = 'red';
            errorDiv.style.fontSize = '0.8rem';
            errorDiv.style.marginTop = '0.5rem';
            errorDiv.textContent = message;
            
            // Remove any existing error message
            const existingError = element.parentNode.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }
            
            element.parentNode.appendChild(errorDiv);
        }
    },

    clearError: function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const errorDiv = element.parentNode.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
    }
};

// Location Services
const LocationService = {
    getCurrentPosition: function() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                error => {
                    reject(error);
                }
            );
        });
    },

    generateMapLink: function(latitude, longitude) {
        return `https://www.google.com/maps?q=${latitude},${longitude}`;
    },

    shareLocation: async function() {
        try {
            const position = await this.getCurrentPosition();
            const mapLink = this.generateMapLink(position.latitude, position.longitude);
            return mapLink;
        } catch (error) {
            console.error('Error getting location:', error);
            throw error;
        }
    }
};

// Notification System
const NotificationSystem = {
    show: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '1rem';
        notification.style.borderRadius = '5px';
        notification.style.backgroundColor = type === 'error' ? '#ff4444' : '#00C851';
        notification.style.color = 'white';
        notification.style.zIndex = '1000';
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
};

// Export modules for use in other files
window.NepDrive = {
    StorageManager,
    SessionManager,
    FormValidator,
    LocationService,
    NotificationSystem
}; 
