import { createServer } from "http";
import { createRouter, Response } from "fets";
import polyline from "@mapbox/polyline";
import pg from "pg";
import { fromNodeMiddleware } from 'vinxi/runtime/server';
import { any, number } from "zod";
// import { encode } from "punycode";
const { Pool } = pg;
const { decode, encode } = polyline

// Define the Coordinate type
type Coordinate = [number, number];

const directionsAPICache: any = {};



const dbConfig = {
    host: "14.98.61.195",
    port: 5440,
    database: "leptonmaps",
    user: "postgres",
    password: "LEpt0n@91",
};
const maxRetriesQuery = 3;
const maxRetries = 3;
const executeQueryInsert = async (query: any, values: any) => {
    let retryCount = 0;

    while (retryCount < maxRetriesQuery) {
        try {
            const pool = new Pool(dbConfig);
            const client = await pool.connect();

            try {
                const result = await client.query(query, values);
                console.log("result: ", result)
                return result.rows;
            } finally {
                client.release();
            }
        } catch (error) {
            retryCount++;
            console.log(error);
            console.error(`Attempt ${retryCount} failed. Retrying...`);
        }
    }

    throw new Error(`Failed to execute query after ${maxRetries} attempts`);
};

const decodePolyline = (encodedPolyline: any): Coordinate[] => {
    const coordinates = decode(encodedPolyline);
    return coordinates.map(([lng, lat]: Coordinate) => [lat, lng]);
};


const executeQuery = async (query: any) => {
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            const pool = new Pool(dbConfig);
            const client = await pool.connect();

            try {
                const result = await client.query(query);
                return result.rows;
            } finally {
                client.release();
            }
        } catch (error) {
            retryCount++;
            console.log(error);
            console.error(`Attempt ${retryCount} failed. Retrying...`);
        }
    }

    throw new Error(`Failed to execute query after ${maxRetries} attempts`);
};



const router = createRouter({
    openAPI: {
        components: {
            schemas: {
                // Define a model named Directions
                Directions: {
                    "type": "object",
                    "properties": {
                        "routes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "route": {
                                        "type": "array",
                                        "items": {
                                            "type": "array",
                                            "items": {
                                                "type": "number"
                                            }
                                        },
                                        "description": "Polyline of the route"
                                    },
                                    "start_location": {
                                        "type": "object",
                                        "description": "Coordinates of the origin location",
                                        "properties": {
                                            "latitude": {
                                                "type": "integer"
                                            },
                                            "longitude": {
                                                "type": "integer"
                                            }
                                        }
                                    },
                                    "end_location": {
                                        "type": "object",
                                        "description": "Coordinates of the destination location",
                                        "properties": {
                                            "latitude": {
                                                "type": "integer"
                                            },
                                            "longitude": {
                                                "type": "integer"
                                            }
                                        }
                                    },
                                    "distance": {
                                        "type": "integer",
                                        "description": "Total distance of the route"
                                    },
                                    "duration": {
                                        "type": "integer",
                                        "description": "Total duration of the route"
                                    }
                                }
                            }
                        }
                    }
                },

                ChargingStations: {
                    "type": "object",
                    "properties": {
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "evStationDetails": {
                                        "type": "object",
                                        "properties": {
                                            "stationName": {
                                                "type": "string",
                                                "description": "Name of the station"
                                            },
                                            "coordinates": {
                                                "type": "object",
                                                "description": "Coordinates of the EV station location.",
                                                "properties": {
                                                    "latitude": {
                                                        "type": "number"
                                                    },
                                                    "longitude": {
                                                        "type": "number"
                                                    }
                                                }
                                            },
                                            "city": {
                                                "type": "string",
                                                "description": "Name of the city"
                                            }
                                        }
                                    },
                                    "distanceFromOrigin": {
                                        "type": "number",
                                        "description": "Distance from the origin point in meters"
                                    },
                                    "distancePreviousStation": {
                                        "type": "number",
                                        "description": "Distance from the previous EV station in meters"
                                    },
                                    "averageTime": {
                                        "type": "number",
                                        "description": "average time"
                                    }
                                }
                            }
                        }
                    }
                }
                ,
                POI: {
                    "type": "object",
                    "properties": {
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                properties: {
                                    coordinates: {
                                        type: 'object',
                                        description: 'Coordinates of the EV station location',
                                        properties: {
                                            latitude: {
                                                type: 'integer'
                                            },
                                            longitude: {
                                                type: 'integer'
                                            }
                                        },

                                    },
                                    subcategory: {
                                        type: 'string',
                                        description: 'Points of Interest (POI) near EV stations'
                                    },
                                    category: {
                                        type: 'string',
                                        description: 'Points of Interest (POI) near EV stations'
                                    },
                                    name: {
                                        type: 'string',
                                        description: 'Name of the EV charging station'
                                    },
                                },
                            },
                        },
                    }

                },
                Waypoints: {
                    "type": "object",
                    "properties": {
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                properties: {
                                    route: {
                                        type: 'string',
                                        description: "Polyline or coordinates of the route"
                                    },
                                    // start_location: {
                                    //     type: 'object',
                                    //     description: "Origin location coordinates",
                                    //     properties: {
                                    //         latitude: {
                                    //             type: 'integer'
                                    //         },
                                    //         longitude: {
                                    //             type: 'integer'
                                    //         }
                                    //     },
                                    // },
                                    // end_location: {
                                    //     type: 'object',
                                    //     description: "Destination location coordinates",
                                    //     properties: {
                                    //         latitude: {
                                    //             type: 'integer'
                                    //         },
                                    //         longitude: {
                                    //             type: 'integer'
                                    //         }
                                    //     },
                                    // },
                                    distance: {
                                        type: 'integer',
                                        description: "Total distance of the route"
                                    },
                                    duration: {
                                        type: 'integer',
                                        description: "Total distance of the route"
                                    }
                                }
                            },
                        },
                    },
                },
                sinkChargingStation: {

                },



            }
        } as const
    }

}).route({
    description: "This API will be used to get up to three routes from the origin to the destination.",
    method: "POST",
    path: "/directions",
    schemas: {
        request: {
            json: {
                type: 'object',
                properties: {
                    origin: {
                        description: 'Enter origin name or coordinate .',
                        type: 'string'
                    },
                    destination: {
                        description: 'Enter destination name or coordinate ',
                        type: 'string'
                    },
                    decoded: {
                        description: 'Enter "true" for route coordinates and "false" for route polyline',
                        type: 'boolean'
                    }
                }
            },
        },
        responses: {
            200: {
                $ref: '#/components/schemas/Directions'
            },
            400: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
            }
        }
    } as const,
    handler: async (request) => {
        try {
            const { origin, destination, decoded } = await request.json();

            // Check if both 'origin' and 'destination' parameters are provided
            if (!origin || !destination) {
                return Response.json({ error: 'Origin and destination are required ' }, { status: 400 });
            }
            // Google Maps Directions API key
            const apiKey = 'AIzaSyAI-wa5Y7css2okp-HjaS2tIUJCYBgtYAA';
            let directionsAPIResponse: any;
            try {
                // Make a GET request to the Google Maps Directions API
                const params = new URLSearchParams({
                    origin: origin,
                    destination: destination,
                    key: apiKey,
                    alternatives: String(true)
                });

                const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
                try {
                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    directionsAPIResponse = await response.json();

                    // Now you can use directionsAPIResponse as needed

                } catch (error) {
                    console.error('Error fetching directions:', error);
                }

                // Check if the directionsAPIResponse contains data and if there are no routes available.
                // If there are no routes available, return a JSON response with the status and error message from the Directions API.
                if (directionsAPIResponse && directionsAPIResponse.routes.length == 0) {
                    return Response.json({ status: directionsAPIResponse.status, message: directionsAPIResponse.error_message });
                }

                const decodePolyline = (route: any): any => {
                    // const coordinates = decode(encodedPolyline);
                    // return coordinates.map(([lng, lat]: Coordinate) => [lat, lng]);
                    let stepData = route.legs[0].steps

                    let polylinePoints: any = [];
                    stepData.forEach((step: any) => {
                        // console.log("sssssssss", step);
                        const coordinates = decode(step.polyline.points);
                        polylinePoints.push(...coordinates.map(([lng, lat]: Coordinate) => [lat, lng]));
                    });
                    return polylinePoints;
                };
                const encodePolyline = (route: any): any => {
                    // const coordinates = decode(encodedPolyline);
                    // return coordinates.map(([lng, lat]: Coordinate) => [lat, lng]);
                    let stepData = route.legs[0].steps

                    let polylinePoints: any = [];
                    stepData.forEach((step: any) => {
                        polylinePoints.push(...decode(step.polyline.points));
                    });
                    return encode(polylinePoints);
                };

                // Process the directions API response data and extract relevant information
                const routesData = directionsAPIResponse.routes.slice(0, 3);
                const routes = routesData.map((route: any) => {
                    const encodedPolyline = encodePolyline(route)
                    directionsAPICache[encodedPolyline] = route
                    const Polyline = decoded ? decodePolyline(route) : encodedPolyline;

                    return {
                        route: Polyline,
                        encodedRoute: encodedPolyline,
                        start_location: {
                            lat: route.legs[0].start_location.lat,
                            lng: route.legs[0].start_location.lng
                        },
                        end_location: {
                            lat: route.legs[0].end_location.lat,
                            lng: route.legs[0].end_location.lng
                        },
                        distance: route.legs[0].distance.value,
                        duration: route.legs[0].duration.value,
                    };
                });


                // Send the extracted data back as JSON response
                return Response.json({ routes }, { status: 200 });
            } catch (error) {
                // Handle any errors that occurred during the request
                console.error('Error fetching directions:', error);
                return Response.json({ error: 'Invalid Request' }, { status: 400 });
            }
        } catch (error) {
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    }
}).route({
    description: "This API will fetch all the charging stations that fall on the selected route along with their distance from the origin and the adjacent EV station",
    method: "POST",
    path: "/charging-stations",
    schemas: {
        request: {
            json: {
                type: 'object',
                properties: {
                    polyline: {
                        description: 'Enter route polyline ',
                        type: 'string'
                    },
                    radius: {
                        description: 'Enter buffer radius ',
                        type: 'integer',
                        default: 1
                    }
                }
            },
        },
        responses: {
            200: {
                $ref: '#/components/schemas/ChargingStations'
            },
            400: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
            }
        }
    } as const,
    handler: async (request) => {
        try {

            const { polyline, radius = 1 } = await request.json();
            // Check if the 'data' array is empty.
            let totalInfo

            if (Object.keys(directionsAPICache).length == 0) {
                const coordinates = decodePolyline(polyline)
                const firstCoordinate = coordinates[0];
                const lastCoordinate = coordinates[coordinates.length - 1];
                let origin = [...firstCoordinate].reverse().join(',');
                let destination = [...lastCoordinate].reverse().join(',');

                let directionsAPIInfo
                const totalInfom = async (origin: any, destination: any): Promise<any> => {
                    const apiKey = 'AIzaSyAI-wa5Y7css2okp-HjaS2tIUJCYBgtYAA';
                    const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;

                    try {
                        const response = await fetch(apiUrl);

                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }

                        const encodePolyline = (route: any): any => {
                            // const coordinates = decode(encodedPolyline);
                            // return coordinates.map(([lng, lat]: Coordinate) => [lat, lng]);


                            let stepData = route.legs[0].steps
                            let polylinePoints: any = [];
                            stepData.forEach((step: any) => {
                                // console.log("sssssssss", step);
                                polylinePoints.push(...decode(step.polyline.points));
                            });

                            return encode(polylinePoints);
                        };

                        const responseData = await response.json();
                        // console.log("vvvvvv", responseData)
                        // console.log("rrrrrrrrrr", responseData)
                        // for (let i = 0; i < responseData.length; i++) {
                        // console.log("eeee", responseData)
                        let durationInSeconds;
                        let distanceInMeters;
                        for (let i = 0; i < responseData.routes.length; i++) {
                            console.log("hhhhhhh", responseData)
                            const polylineInput = encodePolyline(responseData.routes[i]);
                            if (polyline == polylineInput) {
                                durationInSeconds = responseData.routes[i].legs[0].duration.value;
                                distanceInMeters = responseData.routes[i].legs[0].distance.value;
                            }
                        }
                        // Convert duration to minutes or any other format you need
                        const durationInMinutes = Math.ceil(durationInSeconds / 60);

                        // Use the duration and distance in your code or return them
                        console.log('Total duration in minutes:', durationInMinutes);

                        directionsAPIInfo = {
                            durationInSeconds,
                            distanceInMeters,
                        };

                        return directionsAPIInfo;

                    } catch (error) {
                        console.error('Error fetching directions:', error);
                        // Handle the error as needed
                        throw error;
                    }
                };
                totalInfo = await totalInfom(origin, destination)
                // console.log("rrrrrr", totalInfo)
            }



            if (!polyline || !radius) {
                return Response.json({ error: "polyline and radius are required ." }, { status: 400 });
            }
            let radiusInKm = radius / 100

            const geojsonData = {
                type: 'LineString',
                coordinates: decodePolyline(polyline),
            };

            const convertedCoordinates = geojsonData.coordinates.map(
                (coord) => `ST_MakePoint(${coord[0]}, ${coord[1]})`
            );

            // console.time("first")
            // PostGIS query to find charging stations within a buffer distance from the decoded polyline.
            const query = `WITH RECURSIVE line AS (
                SELECT ST_Simplify(ST_SetSRID(ST_MakeLine(ARRAY[${convertedCoordinates}]), 4326), 0.003) AS line_geom
                ),
               buffer AS (
                SELECT ST_Buffer(line.line_geom, buffer_distance) AS buffer_geom
                FROM line, (VALUES (${radiusInKm})) AS distances(buffer_distance)
               ),
               -- Calculate the first point in the line
               first_point AS (
                SELECT ST_PointN(line_geom, 1) AS first_point_geom
                FROM line
               ),
               -- Calculate the distance along the line for each point
               tata_ev_station_with_distance AS (
                   SELECT
                       tata_ev_station.geom,
                       tata_ev_station.station_name,
                       tata_ev_station.city ,
                       charging_station_details,
                       ST_LineLocatePoint(line.line_geom, tata_ev_station.geom) AS distance_along_line
                   FROM tata_ev_station
                   JOIN buffer ON ST_Intersects(tata_ev_station.geom, ST_Transform(buffer.buffer_geom, ST_SRID(tata_ev_station.geom)))
                   CROSS JOIN line
               )
               -- Calculate the corresponding point on the line for each distance
               SELECT
               ST_AsText(tata_ev_station_with_distance.geom) AS coordinates,
                   tata_ev_station_with_distance.station_name,
                   tata_ev_station_with_distance.city ,
                   ST_AsText(ST_LineInterpolatePoint(line.line_geom, tata_ev_station_with_distance.distance_along_line)) AS point_on_line,
                   ST_Distance(ST_SetSRID(first_point.first_point_geom, 4326)::geography, ST_SetSRID(tata_ev_station_with_distance.geom, 4326)::geography
                 ) AS distance_from_origin_point,
                 charging_station_details::json
               FROM tata_ev_station_with_distance, line, first_point;
               `;

            const evStationData = await executeQuery(query);
            //Sort the charging stations based on their distance from the end point.
            evStationData.sort((a: any, b: any) => a.distance_from_origin_point - b.distance_from_origin_point);

            // // Calculate the distances between consecutive charging stations and add them to each station object.
            const stDistances = evStationData.map((chargingStation: any) => chargingStation.distance_from_origin_point);
            evStationData.forEach((chargingStation: any, index: any) => {
                if (index > 0) {
                    chargingStation.distance_previous_station = chargingStation.distance_from_origin_point - stDistances[index - 1];
                } else {
                    chargingStation.distance_previous_station = 0; // For the first charging station, set difference to 0 since there is no previous value.
                }
            });

            function formatDistance(distance: any) {
                return `${parseFloat(distance).toFixed(2)}`;
            }
            function formatTime(time: any) {
                // Parse the time as a float
                const parsedTime = parseFloat(time);
                // If greater than or equal to zero, return minutes
                return `${parsedTime.toFixed(2)} minutes`;
            }
            // console.log("ssss", directionsAPICache)
            const encodePolyline = (route: any): any => {
                // const coordinates = decode(encodedPolyline);
                // return coordinates.map(([lng, lat]: Coordinate) => [lat, lng]);

                let stepData = route.legs[0].steps
                let polylinePoints: any = [];
                stepData.forEach((step: any) => {
                    // console.log("sssssssss", step);
                    polylinePoints.push(...decode(step.polyline.points));
                });

                return encode(polylinePoints);
            };
            const routes = [];
            let directionsAPIInfoCache
            if (Object.keys(directionsAPICache)) {
                const keys = Object.keys(directionsAPICache);
                console.log("333333333333333", keys)

                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    console.log("kkkkk", key);
                    console.log("ppppp", polyline)

                    if (key == polyline) {
                        console.log("true")
                        const durationInSeconds = directionsAPICache[key].legs[0].duration.value;
                        const distanceInMeters = directionsAPICache[key].legs[0].distance.value;
                        directionsAPIInfoCache = {
                            durationInSeconds,
                            distanceInMeters
                        };
                    }
                }
            }
            console.log("yyyyyy", directionsAPIInfoCache)
            let directionsAPIInformations = Object.keys(directionsAPICache).length == 0 ? totalInfo : directionsAPIInfoCache;

            const data = evStationData.map((station: any) => {
                const evStationDetails = {
                    stationName: station.station_name,
                    coordinates: station.coordinates.slice(6, -1).split(' ').map(parseFloat),
                    city: station.city,
                };


                const distanceFromOrigin = formatDistance(station.distance_from_origin_point);
                const distancePreviousStation = formatDistance(station.distance_previous_station);

                let timePreviousStation = null;

                timePreviousStation = formatTime(distancePreviousStation / (directionsAPIInformations.distanceInMeters) * directionsAPIInformations.durationInSeconds);


                const evStationinfo = station.charging_station_details;

                return {
                    evStationDetails,
                    distanceFromOrigin,
                    distancePreviousStation,
                    timePreviousStation,
                    evStationinfo,
                };
            });
            // Send the array of nearby POIs in the response.
            return Response.json({ data }, { status: 200 });
        } catch (error) {
            // If an error occurs during the process, log the error and send a 500 Internal Server Error response.
            console.error('Error executing query:', error);
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    },
}).route({
    description: "This API will provide all the POIs around the selected charging station.",
    method: "POST",
    path: "/pois",
    schemas: {
        request: {
            json: {
                type: 'object',
                properties: {
                    latitude: {
                        description: 'Enter latitude coordinate',
                        type: 'integer',
                    },
                    longitude: {
                        description: 'Enter longitude coordinate',
                        type: 'integer',
                    },
                    category: {
                        description: 'Enter category name or add multiple categories using the "," symbol. ',
                        type: 'string'
                    },
                    radius: {
                        description: 'Enter radius in meters',
                        type: 'integer',
                        default: 1000,
                    }
                },
                required: ['latitude', 'longitude'],
                additionalProperties: false
            },
        },
        responses: {
            200: {
                $ref: '#/components/schemas/POI'
            },
            400: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
            }
        }
    } as const,
    handler: async (request) => {
        try {
            let { latitude, longitude, category, radius } = await request.json();
            console.log(radius, JSON.stringify({ latitude: latitude, longitude: longitude, category: category }));

            if (!latitude || !longitude) {
                return Response.json({ error: "Location (lat/long) is required ." }, { status: 400 });
            }

            // Check if latitude and longitude are valid numbers
            if (isNaN(Number(latitude)) || isNaN(Number(longitude))) {
                return Response.json({ error: "Invalid latitude or longitude values." }, { status: 400 });
            }

            // Convert radius to a number
            let bufferRadius = Number(radius);
            bufferRadius = radius ? bufferRadius : 1000; //radius in meter
            const bufferRadiusInDegrees = bufferRadius / 111319.9;

            // Check if radius is a valid number
            if (isNaN(bufferRadius) || bufferRadius <= 0) {
                return Response.json({ error: "Invalid radius value." }, { status: 400 });
            }

            // Convert radius to a number
            const defaultCategories = ['coffee_shops', 'shopping_malls', 'other_shopping_centres', 'others_restaurants', 'oriental_restaurants', 'premium_hotels', 'fast_food_restaurants', 'pubs_and_bars', 'shopping_markets', 'shopping_retail_chains', 'shopping_retail_shops', 'bakery_and_desserts'];

            // If 'category' is an array, use it directly; otherwise, convert it into an array
            const searchCategories = category ? (Array.isArray(category) ? category : category.split(',')) : defaultCategories;



            // To retrieve nearby points of interest (POIs) 
            const query = `
                        SELECT
                        ARRAY[ST_Y(geometry), ST_X(geometry)] AS coordinates,
                        INITCAP(REPLACE(subcategory, '_', ' ')) AS subcategory,
                        INITCAP(REPLACE(category, '_', ' ')) AS category,
                        name AS name
                        FROM poi
                        WHERE ST_Intersects(ST_SetSRID(ST_Buffer((ST_MakePoint(${longitude},${latitude})), ${bufferRadiusInDegrees}), 4326), geometry) 
                        AND subcategory in (${searchCategories.map(cat => `'${cat}'`).join(',')})`;

            // Log the generated PostGIS query for debugging purposes
            console.log("Generated PostGIS query:", query);

            const data = await executeQuery(query);

            // Send the array of nearby POIs in the response.
            return Response.json({ data }, { status: 200 });
        } catch (error) {
            console.log("Error: ", error)
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    }
}).route({
    description: "This API will fetch the optimal route and total duration of the trip once the user selects all the  charging stations they wish to stop at.",
    method: "POST",
    path: "/route",
    schemas: {
        request: {
            json: {
                type: 'object',
                properties: {
                    origin: {
                        description: 'Enter origin name or coordinates ',
                        type: 'string',
                    },
                    destination: {
                        description: 'Enter destination name or coordinates ',
                        type: 'string',
                    },
                    waypoint: {
                        description: 'Enter the destination name or coordinates or add multiple destinations using the "|" symbol.',
                        type: 'string',
                    },


                }
            },
        },
        responses: {
            200: {
                $ref: '#/components/schemas/Waypoints'
            },
            400: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
            }
        }
    } as const,
    handler: async (request) => {
        try {

            const { origin, destination, waypoint } = await request.json();

            // Check if both 'origin' and 'destination' parameters are provided
            if (!origin || !destination || !waypoint) {
                return Response.json({ error: 'Origin, destination, and waypoint are required query parameters' }, { status: 400 });
            }

            // Google Maps Directions API key
            const apiKey = 'AIzaSyAI-wa5Y7css2okp-HjaS2tIUJCYBgtYAA';
            let directionsAPIResponse: any;
            try {
                // Make a GET request to the Google Maps Directions API
                const params = new URLSearchParams({
                    origin: origin,
                    destination: destination,
                    waypoints: waypoint,
                    key: apiKey,
                });

                const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;

                try {
                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    directionsAPIResponse = await response.json();

                    // Now you can use directionsAPIResponse as needed

                } catch (error) {
                    console.error('Error fetching directions:', error);
                }


                // Check if the directionsAPIResponse contains data and if there are no routes available.
                // If there are no routes available, return a JSON response with the status and error message from the Directions API.
                if (directionsAPIResponse && directionsAPIResponse.routes.length == 0) {
                    return Response.json({ status: directionsAPIResponse.status, message: directionsAPIResponse.error_message });
                }

                // Process the directions API response data and extract relevant information
                // let geocoded_waypoints = directionsAPIResponse.data.geocoded_waypoints;
                console.log("11111111111")
                const routesData = directionsAPIResponse.routes.slice(0, 3);
                console.log("rrrrrrrr", routesData)

                const decodePolyline = (encodedPolyline: any): Coordinate[] => {
                    const coordinates = decode(encodedPolyline);
                    return coordinates.map(([lng, lat]: Coordinate) => [lat, lng]);
                };

                let result = [];
                let polyline = decodePolyline(routesData[0].overview_polyline.points);
                const legs = routesData[0].legs;

                for (let i = 0; i < legs.length; i++) {
                    const steps = legs[i].steps;
                    let startPoint;
                    let endPoint;
                    let totalDistanceValue = 0;
                    let totalDurationValue = 0;

                    for (let j = 0; j < steps.length; j++) {
                        const step = steps[j];
                        startPoint = step.start_location
                        endPoint = step.end_location
                        totalDistanceValue += step.distance.value;
                        totalDurationValue += step.duration.value;
                    }

                    // Create an object for each leg with polyline, total distance, and total duration
                    const legObj = {
                        startPoint: startPoint,
                        endPoint: endPoint,
                        distance: totalDistanceValue,
                        duration: totalDurationValue,
                    };
                    result.push(legObj);
                }
                let data = {
                    steps: result,
                    polyline: polyline
                }

                return Response.json(data, { status: 200 });
            } catch (error) {
                // Handle any errors that occurred during the request
                console.error('Error fetching directions:', error);
                return Response.json({ error: 'Invalid Request' }, { status: 400 });
            }
        } catch (error) {
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }

    }
}).route({
    description: "This API will fetch data from an external source and insert it into the 'tata_power' table.",
    method: "GET",
    path: "/sync-charging-station",
    schemas: {
        responses: {
            200: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                },
            },
        }
    } as const,
    handler: async () => {
        try {
            // Fetch data from the external source(You can reuse your existing code here)
            const fetchDataFromAPI = async () => {
                try {
                    const api_url = 'https://evapimprod.azure-api.net/getChargingStationsAll/syncRequestHandler';
                    const headers = {
                        'Content-Type': 'application/json',
                        'Ocp-Apim-Subscription-Key': '204ace3ee1a8427687cda96a2f02ad25',
                        'Cookie': 'sess_map=txxtrrxszdffscuuwwzqcuavqexbqsxyfbfwfwayyqvcstdqseqeefcfyaabzruqqdesybfsewtwwvfuyvyvdsbsbbdcvsxqeaufdvqeccxvxzzquyqxweyzfqbadsetwarzrwbtfwzbwxvqtdqcayfv'
                    };

                    const filter_data = {
                        "filter": {
                            "amenities": [],
                            "availability": "some_value",
                            "connector_standard": [],
                            "connector_type": "some_value",
                            "free_chargers": "some_value"
                        },
                        "profileType": "some_value",
                        "profileid": "Public",
                        "userid": "579ab102-3938-433f-8a18-5ab7a7d4c201"
                    };

                    const requestOptions = {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(filter_data),
                    };

                    try {
                        const response = await fetch(api_url, requestOptions);

                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }

                        const data = await response.json();
                        // Now you can use 'data' as needed
                        return data;
                    } catch (error) {
                        console.error('Error fetching data:', error);
                    }


                } catch (error) {
                    console.error(`Error fetching data from the API: ${error}`);
                    return null;
                }
            };

            const getChargingLocationDetails = async (station_code: any) => {
                try {
                    const url = 'https://evapimprod.azure-api.net/getLocationDetails/syncRequestHandler';
                    const headers = {
                        'Ocp-Apim-Subscription-Key': '204ace3ee1a8427687cda96a2f02ad25',
                        'Content-Type': 'application/json',
                        'Cookie': 'sess_map=drbeuerduxvcwwrfvxbezfdctydecrszywdcwbvqvrxffxvcrdawbuzfssyxtsvuscswbqwdsefeddftffbysvvwqftyrezdddwewxbazuysvwdyczctydszsuussadwywdcwsvdcazfydrvbxqcayfv',
                    };

                    const data = {
                        station_code: `${station_code}`,
                    };

                    try {
                        const response = await fetch(url, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(data),
                        });

                        if (!response.ok) {
                            throw new Error(`Request failed with status ${response.status}`);
                        }

                        const responseData = await response.json();
                        return responseData;
                    } catch (error) {
                        console.error(error);
                        return null;
                    }
                } catch (error) {
                    console.error(error);
                    return null;
                }
            };

            // Collect data in an array
            const charging_stations = await fetchDataFromAPI();



            if (charging_stations) {
                await executeQuery('TRUNCATE TABLE tata_ev_station');
                for (const station of charging_stations["chargingStations"]) {
                    const dataToInsert = [];
                    const station_name = station["station_name"];
                    const city = station["city"];
                    const station_status = station["station_status"];
                    const latitude = station["coordinates"]["latitude"];
                    const longitude = station["coordinates"]["longitude"];
                    const station_code = station["station_code"];
                    const station_id = station["id"];
                    const connector_count = station["connector_count"];
                    const state = station["state"];
                    const limited_access_charger = station["limitedAccessCharger"];
                    // const getChargingLocationData = await getChargingLocationDetails(station_code);
                    // console.log("ddddddddddd", getChargingLocationData);
                    let getChargingLocationData = null;
                    try {
                        getChargingLocationData = await getChargingLocationDetails(station_code);
                    } catch (error) {
                        console.error("Error fetching charging location data:", error);
                    }

                    // Add station data to the array
                    dataToInsert.push([
                        station_name,
                        city,
                        station_status,
                        latitude,
                        longitude,
                        station_code,
                        station_id,
                        connector_count,
                        state,
                        limited_access_charger,
                        longitude, // Remove this duplicate entry for longitude
                        latitude, // Remove this duplicate entry for latitude
                        getChargingLocationData
                    ]);

                    const query = `
                    INSERT INTO tata_ev_station (
                        station_name,
                        city,
                        station_status,
                        latitude,
                        longitude,
                        station_code,
                        id,
                        connector_count,
                        state,
                        limitedaccesscharger,
                        geom,
                        charging_station_details
                    ) VALUES 
                    ${dataToInsert.map((_, i) => `($${i * 13 + 1}, $${i * 13 + 2}, $${i * 13 + 3}, $${i * 13 + 4}, $${i * 13 + 5}, $${i * 13 + 6}, $${i * 13 + 7}, $${i * 13 + 8}, $${i * 13 + 9}, $${i * 13 + 10}, ST_SetSRID(ST_MakePoint($${i * 13 + 11}, $${i * 13 + 12}), 4326), $${i * 13 + 13})`).join(', ')}
                `;

                    const values = dataToInsert.flat();

                    await executeQueryInsert(query, values);

                }
                return Response.json({ message: 'Data fetched and inserted successfully' }, { status: 200 });

            } else {
                return Response.json({ error: 'Failed to fetch or insert data' }, { status: 500 });
            }

        } catch (error) {
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    },
}).route({
    description: "This API allows you to find the pincode, state, city, district, and tehsil based on latitude and longitude coordinates",
    method: "GET",
    path: "/v1/find/pincode",
    schemas: {
        request: {
            query: {
                type: 'object',
                properties: {
                    latitude: {
                        description: 'The latitude coordinate for the location. Example: 28.6139',
                        type: 'number',
                    },
                    longitude: {
                        description: 'The longitude coordinate for the location. Example: 77.2090',
                        type: 'number',
                    }

                }
            },
            headers: {
                Authorization: {
                    description: 'The longitude coordinate for the location. Example: 77.2090',
                    type: 'string',
                }
            }
        },
        responses: {
            200: {
                $ref: '/components/schemas/Waypoints'
            },
            400: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
            }
        }
    } as const,
    handler: async (request) => {
        try {
            const { latitude, longitude } = request.query;
            const Authorization = request.headers.get('Authorization');
            if (!latitude || !longitude) {
                return Response.json({ error: 'latitude and longitude are required' }, { status: 400 });
            }
            if (!Authorization) {
                return Response.json({ error: 'Authorization is required' }, { status: 400 });
            }
            if (Authorization !== '4107a0780e205c1168043bc0e09e4c26d093e7cac991e73244c33bd2e89d5aab') {
                return Response.json({ error: 'Unauthorized' }, { status: 401 });  // Return 401 Unauthorized
            }
            const url = `http://api.leptonmaps.com/v1/find/pincode?latitude=${latitude}&longitude=${longitude}`;
            console.log(url);

            const headers = {
                Authorization: `${Authorization}`,
            };

            try {
                const requestOptions = {
                    method: 'GET',
                    headers: headers,
                };

                try {
                    const response = await fetch(url, requestOptions);

                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    const data = await response.json();

                    // Now you can use 'data' as needed
                    console.log(data)
                    return Response.json(data)

                } catch (error) {
                    console.error('Error fetching data:', error);
                }


            } catch (error) {
                return error;
            }
        } catch (error) {
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    }

});


export default fromNodeMiddleware(router)














