// Authentication Manager
const AuthManager = {
    // User registration
    registerUser: function(userData) {
        const users = NepDrive.StorageManager.getItem('users') || [];
        
        // Check if email already exists
        if (users.some(user => user.email === userData.email)) {
            throw new Error('Email already registered');
        }

        // Add user with encrypted password
        users.push({
            ...userData,
            id: 'user_' + Date.now(),
            password: this.encryptPassword(userData.password),
            createdAt: new Date().toISOString(),
            status: 'active'
        });

        NepDrive.StorageManager.setItem('users', users);
        return true;
    },

    // Driver registration
    registerDriver: function(driverData) {
        const drivers = NepDrive.StorageManager.getItem('drivers') || [];
        
        // Check if email already exists
        if (drivers.some(driver => driver.email === driverData.email)) {
            throw new Error('Email already registered');
        }

        // Add driver with encrypted password
        drivers.push({
            ...driverData,
            id: 'driver_' + Date.now(),
            password: this.encryptPassword(driverData.password),
            createdAt: new Date().toISOString(),
            status: 'pending', // Requires admin approval
            currentLocation: null,
            isAvailable: false
        });

        NepDrive.StorageManager.setItem('drivers', drivers);
        return true;
    },

    // User login
    loginUser: function(email, password) {
        const users = NepDrive.StorageManager.getItem('users') || [];
        const user = users.find(u => u.email === email);

        if (!user || user.password !== this.encryptPassword(password)) {
            throw new Error('Invalid email or password');
        }

        if (user.status !== 'active') {
            throw new Error('Account is not active');
        }

        // Create session
        NepDrive.SessionManager.createSession('user', {
            id: user.id,
            name: user.name,
            email: user.email
        });

        return true;
    },

    // Driver login
    loginDriver: function(email, password) {
        const drivers = NepDrive.StorageManager.getItem('drivers') || [];
        const driver = drivers.find(d => d.email === email);

        if (!driver || driver.password !== this.encryptPassword(password)) {
            throw new Error('Invalid email or password');
        }

        if (driver.status !== 'active') {
            throw new Error('Your account is pending approval or has been suspended');
        }

        // Create session
        NepDrive.SessionManager.createSession('driver', {
            id: driver.id,
            name: driver.name,
            email: driver.email,
            vehicleType: driver.vehicleType
        });

        return true;
    },

    // Admin login
    loginAdmin: function(username, password) {
        // In a real application, this would be stored securely
        const adminCredentials = {
            username: 'admin',
            password: this.encryptPassword('admin123')
        };

        if (username !== adminCredentials.username || 
            this.encryptPassword(password) !== adminCredentials.password) {
            throw new Error('Invalid admin credentials');
        }

        // Create admin session
        NepDrive.SessionManager.createSession('admin', {
            username: 'admin'
        });

        return true;
    },

    // Logout
    logout: function() {
        NepDrive.SessionManager.endSession();
        return true;
    },

    // Password encryption (basic - in real app use proper encryption)
    encryptPassword: function(password) {
        // This is a very basic encryption - in production use proper encryption
        return btoa(password);
    },

    // Get current user data
    getCurrentUser: function() {
        const session = NepDrive.SessionManager.getSession();
        if (!session) return null;

        const { userType, userData } = session;
        
        if (userType === 'admin') return userData;

        const users = NepDrive.StorageManager.getItem(userType === 'user' ? 'users' : 'drivers') || [];
        return users.find(u => u.id === userData.id);
    },

    // Update user profile
    updateProfile: function(userData) {
        const session = NepDrive.SessionManager.getSession();
        if (!session) throw new Error('Not authenticated');

        const { userType } = session;
        const storageKey = userType === 'user' ? 'users' : 'drivers';
        const items = NepDrive.StorageManager.getItem(storageKey) || [];
        
        const index = items.findIndex(item => item.id === userData.id);
        if (index === -1) throw new Error('User not found');

        // Update user data
        items[index] = {
            ...items[index],
            ...userData,
            password: items[index].password // Keep existing password
        };

        NepDrive.StorageManager.setItem(storageKey, items);
        return true;
    }
};

// Export AuthManager
window.NepDrive = {
    ...window.NepDrive,
    AuthManager
}; 
