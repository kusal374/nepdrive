// MapsManager for NepDrive
const NepDrive = window.NepDrive || {};

NepDrive.MapsManager = {
    // Configuration
    settings: {
        maxDistance: 5000, // 5km radius for nearby drivers
        updateInterval: 10000, // 10 seconds interval for location updates
        watchOptions: {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    },

    // Store active watchers
    activeWatchers: new Map(),

    // Initialize location tracking
    async initializeTracking() {
        try {
            // Check if geolocation is supported
            if (!navigator.geolocation) {
                throw new Error('Geolocation is not supported by your browser');
            }

            // Check if location permission is granted
            const permission = await this.checkLocationPermission();
            if (permission !== 'granted') {
                throw new Error('Location permission is required for tracking');
            }

            // Get initial position
            const position = await this.getCurrentPosition();
            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };
        } catch (error) {
            console.error('Location initialization failed:', error);
            throw new Error('Unable to access location services. Please enable location access and refresh the page.');
        }
    },

    // Find driver by phone number
    findDriverByPhone(phone) {
        const drivers = NepDrive.StorageManager.getItem('drivers') || [];
        return drivers.find(d => d.phone === phone && d.status === 'active' && d.isAvailable);
    },

    // Book ride by phone number
    async bookRideByPhone(userPhone, driverPhone) {
        try {
            const users = NepDrive.StorageManager.getItem('users') || [];
            const user = users.find(u => u.phone === userPhone);
            
            if (!user) {
                throw new Error('User not found');
            }

            const driver = this.findDriverByPhone(driverPhone);
            if (!driver) {
                throw new Error('Driver not available or not found');
            }

            // Get current locations
            const userLocation = await this.getCurrentPosition();
            const driverLocation = driver.currentLocation;

            if (!driverLocation) {
                throw new Error('Driver location not available');
            }

            // Create ride request
            const ride = {
                id: 'ride_' + Date.now(),
                userId: user.id,
                driverId: driver.id,
                status: 'pending',
                createdAt: new Date().toISOString(),
                userLocation: {
                    latitude: userLocation.coords.latitude,
                    longitude: userLocation.coords.longitude
                },
                driverLocation: {
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude
                }
            };

            // Save ride request
            const rides = NepDrive.StorageManager.getItem('rides') || [];
            rides.push(ride);
            NepDrive.StorageManager.setItem('rides', rides);

            return {
                ride,
                userTrackingLink: this.generateTrackingLink(
                    userLocation.coords.latitude,
                    userLocation.coords.longitude,
                    driverLocation.latitude,
                    driverLocation.longitude
                ),
                driverTrackingLink: this.generateTrackingLink(
                    driverLocation.latitude,
                    driverLocation.longitude,
                    userLocation.coords.latitude,
                    userLocation.coords.longitude
                )
            };
        } catch (error) {
            console.error('Error booking ride:', error);
            throw error;
        }
    },

    // Generate tracking link with both locations
    generateTrackingLink(originLat, originLng, destLat, destLng) {
        return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
    },

    // Start continuous location watching for a specific entity (user/driver)
    startLocationWatch(entityId, onUpdate, onError) {
        if (this.activeWatchers.has(entityId)) {
            return; // Already watching this entity
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const locationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                onUpdate(locationData);

                // Update stored location
                this.updateStoredLocation(entityId, locationData);
            },
            (error) => {
                console.error('Location watch error:', error);
                if (onError) onError(error);
            },
            this.settings.watchOptions
        );

        this.activeWatchers.set(entityId, watchId);
        return watchId;
    },

    // Update stored location for entity
    updateStoredLocation(entityId, locationData) {
        if (entityId.startsWith('user_')) {
            const users = NepDrive.StorageManager.getItem('users') || [];
            const userIndex = users.findIndex(u => u.id === entityId);
            if (userIndex !== -1) {
                users[userIndex].currentLocation = locationData;
                NepDrive.StorageManager.setItem('users', users);
            }
        } else if (entityId.startsWith('driver_')) {
            const drivers = NepDrive.StorageManager.getItem('drivers') || [];
            const driverIndex = drivers.findIndex(d => d.id === entityId);
            if (driverIndex !== -1) {
                drivers[driverIndex].currentLocation = locationData;
                NepDrive.StorageManager.setItem('drivers', drivers);
            }
        }
    },

    // Get entity's current location
    getEntityLocation(entityId) {
        if (entityId.startsWith('user_')) {
            const users = NepDrive.StorageManager.getItem('users') || [];
            const user = users.find(u => u.id === entityId);
            return user?.currentLocation;
        } else if (entityId.startsWith('driver_')) {
            const drivers = NepDrive.StorageManager.getItem('drivers') || [];
            const driver = drivers.find(d => d.id === entityId);
            return driver?.currentLocation;
        }
        return null;
    },

    // Update ride tracking
    async updateRideTracking(rideId) {
        const rides = NepDrive.StorageManager.getItem('rides') || [];
        const rideIndex = rides.findIndex(r => r.id === rideId);
        
        if (rideIndex === -1) return null;

        const ride = rides[rideIndex];
        const userLocation = this.getEntityLocation(ride.userId);
        const driverLocation = this.getEntityLocation(ride.driverId);

        if (userLocation && driverLocation) {
            rides[rideIndex].tracking = {
                userLocation,
                driverLocation,
                timestamp: Date.now()
            };
            NepDrive.StorageManager.setItem('rides', rides);

            return {
                userTrackingLink: this.generateTrackingLink(
                    userLocation.latitude,
                    userLocation.longitude,
                    driverLocation.latitude,
                    driverLocation.longitude
                ),
                driverTrackingLink: this.generateTrackingLink(
                    driverLocation.latitude,
                    driverLocation.longitude,
                    userLocation.latitude,
                    userLocation.longitude
                )
            };
        }

        return null;
    },

    // Check location permission
    async checkLocationPermission() {
        try {
            // Check if the Permissions API is supported
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                return result.state;
            }
            // Fallback for browsers that don't support Permissions API
            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    () => resolve('granted'),
                    () => resolve('denied')
                );
            });
        } catch (error) {
            console.error('Permission check failed:', error);
            return 'denied';
        }
    },

    // Get current position with error handling
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                (error) => {
                    let errorMessage = 'Unable to get your location. ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Please enable location access in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out.';
                            break;
                        default:
                            errorMessage += 'An unknown error occurred.';
                    }
                    reject(new Error(errorMessage));
                },
                this.settings.watchOptions
            );
        });
    },

    // Stop watching location for a specific entity
    stopLocationWatch(entityId) {
        const watchId = this.activeWatchers.get(entityId);
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            this.activeWatchers.delete(entityId);
        }
    },

    // Update driver location
    async updateDriverLocation(driverId) {
        try {
            const session = NepDrive.SessionManager.getSession();
            if (!session || session.userType !== 'driver' || session.userId !== driverId) {
                throw new Error('Unauthorized location update attempt');
            }

            const position = await this.getCurrentPosition();
            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };

            // Update driver's location in storage
            const drivers = NepDrive.StorageManager.getItem('drivers') || [];
            const driverIndex = drivers.findIndex(d => d.id === driverId);
            
            if (driverIndex !== -1) {
                drivers[driverIndex].currentLocation = locationData;
                NepDrive.StorageManager.setItem('drivers', drivers);
            }

            return locationData;
        } catch (error) {
            console.error('Driver location update failed:', error);
            throw error;
        }
    },

    // Get nearby drivers
    async getNearbyDrivers(userLocation) {
        try {
            const drivers = NepDrive.StorageManager.getItem('drivers') || [];
            const nearbyDrivers = drivers.filter(driver => {
                // Only include active and available drivers
                if (driver.status !== 'active' || !driver.isAvailable) {
                    return false;
                }

                // Check if driver has current location
                if (!driver.currentLocation) {
                    return false;
                }

                // Calculate distance
                const distance = this.calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    driver.currentLocation.latitude,
                    driver.currentLocation.longitude
                );

                // Check if within range and location is recent (within last 5 minutes)
                const isRecent = (Date.now() - driver.currentLocation.timestamp) < 300000;
                return distance <= this.settings.maxDistance && isRecent;
            });

            return nearbyDrivers.map(driver => ({
                id: driver.id,
                name: driver.name,
                vehicleType: driver.vehicleType,
                vehicleNumber: driver.vehicleNumber,
                distance: this.calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    driver.currentLocation.latitude,
                    driver.currentLocation.longitude
                )
            }));
        } catch (error) {
            console.error('Error getting nearby drivers:', error);
            throw error;
        }
    },

    // Calculate distance between two points using Haversine formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const φ1 = this.toRad(lat1);
        const φ2 = this.toRad(lat2);
        const Δφ = this.toRad(lat2 - lat1);
        const Δλ = this.toRad(lon2 - lon1);

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    },

    // Convert degrees to radians
    toRad(degrees) {
        return degrees * Math.PI / 180;
    },

    // Start ride tracking
    async startRideTracking(rideId) {
        try {
            const position = await this.getCurrentPosition();
            const locationData = {
                startLocation: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                }
            };

            // Update ride tracking data
            const rides = NepDrive.StorageManager.getItem('rides') || [];
            const rideIndex = rides.findIndex(r => r.id === rideId);
            
            if (rideIndex !== -1) {
                rides[rideIndex].tracking = locationData;
                NepDrive.StorageManager.setItem('rides', rides);

                // Start continuous location watching
                this.startLocationWatch(rideId, (location) => {
                    this.updateRideLocation(rideId, location);
                });
            }

            return locationData;
        } catch (error) {
            console.error('Failed to start ride tracking:', error);
            throw error;
        }
    },

    // Update ongoing ride location
    async updateRideLocation(rideId, location) {
        const rides = NepDrive.StorageManager.getItem('rides') || [];
        const rideIndex = rides.findIndex(r => r.id === rideId);
        
        if (rideIndex !== -1 && rides[rideIndex].tracking) {
            rides[rideIndex].tracking.currentLocation = location;
            NepDrive.StorageManager.setItem('rides', rides);
        }
    },

    // End ride tracking
    async endRideTracking(rideId) {
        try {
            const position = await this.getCurrentPosition();
            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };

            // Update ride tracking data
            const rides = NepDrive.StorageManager.getItem('rides') || [];
            const rideIndex = rides.findIndex(r => r.id === rideId);
            
            if (rideIndex !== -1 && rides[rideIndex].tracking) {
                rides[rideIndex].tracking.endLocation = locationData;
                NepDrive.StorageManager.setItem('rides', rides);

                // Stop location watching
                this.stopLocationWatch(rideId);
            }

            return locationData;
        } catch (error) {
            console.error('Failed to end ride tracking:', error);
            throw error;
        }
    },

    // Generate shareable location link
    generateLocationLink(latitude, longitude) {
        return `https://www.google.com/maps?q=${latitude},${longitude}`;
    },

    // Share live location
    async shareLiveLocation() {
        try {
            const position = await this.getCurrentPosition();
            return this.generateLocationLink(
                position.coords.latitude,
                position.coords.longitude
            );
        } catch (error) {
            console.error('Failed to share location:', error);
            throw error;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NepDrive.MapsManager;
} 
