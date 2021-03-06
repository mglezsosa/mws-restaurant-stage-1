/**
* Common database helper functions.
*/
class DBHelper {

    /**
    * Database URL.
    * Change this to restaurants.json file location on your server.
    */
    static get DATABASE_URL() {
        const port = 1337 // Change this to your server port
        return `http://localhost:${port}/restaurants`;
    }

    static REVIEWS_BY_ID_URL(id) {
        const port = 1337 // Change this to your server port
        return `http://localhost:${port}/reviews/?restaurant_id=${id}`;
    }

    static get _dbPromise() {
        // If the browser doesn't support service worker,
        // we don't care about having a database
        if (!navigator.serviceWorker) {
            return Promise.resolve();
        }

        return idb.open('restaurants-data', 1, function(upgradeDb) {
            upgradeDb.createObjectStore('restaurants-data', {
                keyPath: 'id'
            });
            upgradeDb.createObjectStore('restaurant-reviews', {
                keyPath: 'id'
            }).createIndex('by-restaurant', 'restaurant_id', { unique:false });
            upgradeDb.createObjectStore('enqueued-requests', {
                keyPath: 'id',
                autoIncrement: true
            }).createIndex('by-restaurant', 'body.restaurant_id', { unique: false });
        });
    }

    /**
    * Fetch all restaurants.
    */
    static fetchRestaurants(callback) {
        this._dbPromise.then(function(db) {
            if (!db) return;

            let tx = db.transaction('restaurants-data', 'readwrite');
            let store = tx.objectStore('restaurants-data');
            let numberOfRest;

            store.count().then(count => {
                numberOfRest = count;
                if (count === 0) {
                    return fetch(DBHelper.DATABASE_URL)
                    .then(response => response.json())
                    .catch(error => callback(`Request failed. ${error.message}`, null));
                } else {
                    return store.getAll();
                }
            }).then(restaurants => {
                callback(null, restaurants);
                if (numberOfRest === 0) {
                    let tx = db.transaction('restaurants-data', 'readwrite');
                    restaurants.forEach(function(message) {
                        tx.objectStore('restaurants-data').put(message);
                    });
                }
            });
        });
    }

    static fetchRestaurantReviews(id, callback) {
        this._dbPromise.then(function(db) {
            if (!db) return;

            let tx = db.transaction('restaurant-reviews', 'readwrite');
            let index = tx.objectStore('restaurant-reviews').index('by-restaurant');

            let gl_reviews, gl_enq_reviews;

            // Stored reviews
            index.getAll(id).then(reviews => {
                gl_reviews = reviews;
                let tx = db.transaction('enqueued-requests', 'readwrite');
                let index = tx.objectStore('enqueued-requests').index('by-restaurant');
                return index.getAll(id).then(enq_req => {

                    // Enqueued reviews
                    gl_enq_reviews = enq_req.filter(function(req) {
                        return req.url === 'http://localhost:1337/reviews/'
                    }).map(rev => rev.body);
                    callback([...gl_reviews, ...gl_enq_reviews]);
                    // Try to update
                    return fetch(DBHelper.REVIEWS_BY_ID_URL(id))
                    .then(response => response.json())
                    .catch(err => console.log(err));
                });
            })
            .then(fetched_reviews => {
                if (!fetched_reviews) return;
                const new_reviews = fetched_reviews.filter(rev => {
                    return ![...gl_reviews, ...gl_enq_reviews].find(el => el.id == rev.id);
                });
                callback(new_reviews);
                let tx = db.transaction('restaurant-reviews', 'readwrite');
                fetched_reviews.forEach(function(rev) {
                    tx.objectStore('restaurant-reviews').put(rev);
                });
            });
        });
    }

    /**
    * Fetch a restaurant by its ID. Trying to use the 'id' index of indexedDB?
    */
    static fetchRestaurantById(id, callback) {
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                const restaurant = restaurants.find(r => r.id == id);
                if (restaurant) { // Got the restaurant
                    callback(null, restaurant);
                } else { // Restaurant does not exist in the database
                    callback('Restaurant does not exist', null);
                }
            }
        });
    }

    /**
    * Fetch restaurants by a cuisine type with proper error handling.
    */
    static fetchRestaurantByCuisine(cuisine, callback) {
        // Fetch all restaurants  with proper error handling
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given cuisine type
                const results = restaurants.filter(r => r.cuisine_type == cuisine);
                callback(null, results);
            }
        });
    }

    /**
    * Fetch restaurants by a neighborhood with proper error handling.
    */
    static fetchRestaurantByNeighborhood(neighborhood, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given neighborhood
                const results = restaurants.filter(r => r.neighborhood == neighborhood);
                callback(null, results);
            }
        });
    }

    /**
    * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
    */
    static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                let results = restaurants
                if (cuisine != 'all') { // filter by cuisine
                    results = results.filter(r => r.cuisine_type == cuisine);
                }
                if (neighborhood != 'all') { // filter by neighborhood
                    results = results.filter(r => r.neighborhood == neighborhood);
                }
                callback(null, results);
            }
        });
    }

    /**
    * Fetch all neighborhoods with proper error handling.
    */
    static fetchNeighborhoods(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all neighborhoods from all restaurants
                const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
                // Remove duplicates from neighborhoods
                const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
                callback(null, uniqueNeighborhoods);
            }
        });
    }

    /**
    * Fetch all cuisines with proper error handling.
    */
    static fetchCuisines(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all cuisines from all restaurants
                const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
                // Remove duplicates from cuisines
                const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
                callback(null, uniqueCuisines);
            }
        });
    }

    /**
    * Restaurant page URL.
    */
    static urlForRestaurant(restaurant) {
        return (`./restaurant.html?id=${restaurant.id}`);
    }

    /**
    * Restaurant image URL.
    */
    static imageUrlForRestaurant(restaurant) {
        return (`/img/${restaurant.photograph}`);
    }

    /**
    * Map marker for a restaurant.
    */
    static mapMarkerForRestaurant(restaurant, map) {
        // https://leafletjs.com/reference-1.3.0.html#marker
        const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
            {
                title: restaurant.name,
                alt: restaurant.name,
                url: DBHelper.urlForRestaurant(restaurant)
            });
        marker.addTo(newMap);
        return marker;
    }

    static setFav(id, fav) {
        this._dbPromise.then(function(db) {
            if (!db) return;

            let tx = db.transaction('restaurants-data', 'readwrite');
            let store = tx.objectStore('restaurants-data');

            store.get(id).then((rest) => {
                rest.is_favorite = fav;
                store.put(rest);
            });
        });
    }
}
